const { flosync, variable: v, connector } = require('../dist');

flosync.registerConnector(
  'payments.api',
  connector('payments.api', 'Payments API')
    .baseUrl('https://api.example.com')
    .bearer(process.env.PAYMENT_API_KEY || 'test-key')
    .post('Charge', '/v1/charge')
    .build()
);

flosync.configure({
  connectors: {
    'payments.api': { apiKey: process.env.PAYMENT_API_KEY || 'test-key' },
  },
});

const calculateTotal = flosync
  .function('calculate-total')
  .input({ items: 'array' })
  .step('sum', s =>
    s.transform({
      total: v.expr('length(args.items) * 10'),
      count: v.expr('length(args.items)'),
    })
  )
  .outputFrom('sum')
  .build();

flosync.registerFunction(calculateTotal);

const w = flosync
  .workflow('checkout')
  .http('POST', '/checkout')
  .step('validate', s =>
    s.validator({
      items: v.body('items'),
      customerId: v.body('customerId'),
    })
  )
  .step('calculate', s =>
    s.call('calculate-total', { items: v.body('items') })
  )
  .step('charge', s =>
    s.transform({
      id: 'ch_mock_123',
      amount: v.stepResult('calculate', 'total'),
      customer: v.body('customerId'),
      status: 'succeeded',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      body: {
        chargeId: v.stepResult('charge', 'id'),
        total: v.stepResult('calculate', 'total'),
        status: v.stepResult('charge', 'status'),
      },
    })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('checkout', {
    body: { items: [{ id: 1 }, { id: 2 }], customerId: 'cust-1', token: 'Bearer secret' },
    headers: { Authorization: 'Bearer secret' },
  });
  console.log('Checkout:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
