const { flosync, variable: v, connector } = require('../dist');

flosync.registerConnector(
  'payments.api',
  connector('payments.api', 'Payments API')
    .baseUrl('https://api.example.com')
    .bearer(process.env.PAYMENT_API_KEY || 'test-key')
    .post('Charge', '/v1/charge')
    .build()
);

const hasRemote = !!(process.env.FLOSYNC_BASE_URL && process.env.FLOSYNC_API_KEY && process.env.FLOSYNC_API_SECRET);

flosync.configure({
  apiKey: process.env.FLOSYNC_API_KEY,
  apiSecret: process.env.FLOSYNC_API_SECRET,
  baseUrl: process.env.FLOSYNC_BASE_URL,
  connectors: { 'payments.api': { apiKey: process.env.PAYMENT_API_KEY || 'test-key' } },
});

const formatOrder = flosync
  .function('format-order')
  .input({ items: 'array', customerId: 'string' })
  .step('format', s =>
    s.transform({
      itemCount: v.expr('length(args.items)'),
      customer: v.args('customerId'),
      total: v.expr('length(args.items) * 10'),
    })
  )
  .outputFrom('format')
  .build();

flosync.registerFunction(formatOrder);

const w = flosync
  .workflow('order-processor')
  .http('POST', '/orders')
  .step('validate', s =>
    s.validator({
      items: v.body('items'),
      customerId: v.body('customerId'),
    })
      .then('format')
      .else('error')
  )
  .step('format', s =>
    s.call('format-order', {
      items: v.body('items'),
      customerId: v.body('customerId'),
    })
  )
  .step('charge', s =>
    s.transform({
      id: 'ch_mock_' + Date.now(),
      amount: v.stepResult('format', 'total'),
      customer: v.body('customerId'),
      status: 'succeeded',
    })
  )
  .step('route', s =>
    s.condition(v.vars('useRemote'))
      .then('call_remote')
      .else('respond_local')
  )
  .step('call_remote', s =>
    s.callWorkflow('checkout', {
      body: {
        items: v.body('items'),
        customerId: v.body('customerId'),
        chargeId: v.stepResult('charge', 'id'),
        total: v.stepResult('format', 'total'),
      },
    })
  )
  .step('respond_remote', s =>
    s.responder('json', {
      body: {
        source: 'remote',
        remoteResult: v.stepResult('call_remote'),
      },
    })
  )
  .step('respond_local', s =>
    s.responder('json', {
      body: {
        source: 'local',
        chargeId: v.stepResult('charge', 'id'),
        total: v.stepResult('format', 'total'),
        status: v.stepResult('charge', 'status'),
      },
    })
  )
  .step('error', s =>
    s.responder('json', { statusCode: 400, body: { error: 'Validation failed' } })
  )
  .build();

flosync.register(w);

async function run() {
  const payload = {
    body: { items: [{ id: 1 }, { id: 2 }], customerId: 'cust-1' },
    vars: { useRemote: hasRemote },
  };

  const result = await flosync.run('order-processor', payload);
  console.log('Order processor:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
