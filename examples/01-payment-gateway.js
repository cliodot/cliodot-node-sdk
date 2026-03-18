const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const validatePayment = flosync
  .function('validate-payment')
  .input({ amount: 'number', currency: 'string', reference: 'string' })
  .step('check', s =>
    s.transform({
      valid: '{{ args.amount > 0 && args.currency && args.reference }}',
      amount: '{{ args.amount }}',
      currency: '{{ args.currency }}',
      reference: '{{ args.reference }}',
    })
  )
  .outputFrom('check')
  .build();

flosync.registerFunction(validatePayment);

const w = flosync
  .workflow('payment-gateway')
  .http('POST', '/payments')
  .step('auth', s =>
    s.auth('bearer.system', 'bearer.validate', { token: '{{ headers.authorization }}' })
      .then('validate')
      .else('unauthorized')
  )
  .step('validate', s =>
    s.call('validate-payment', {
      amount: '{{ body.amount }}',
      currency: '{{ body.currency }}',
      reference: '{{ body.reference }}',
    })
  )
  .step('genId', s => s.util('utility.random', 'uuid', {}))
  .step('process', s =>
    s.condition('{{ stepResults.validate.valid }}')
      .then('success')
      .else('invalid')
  )
  .step('success', s =>
    s.transform({
      status: 'success',
      transactionId: '{{ stepResults.genId }}',
      amount: '{{ stepResults.validate.amount }}',
      currency: '{{ stepResults.validate.currency }}',
    })
  )
  .step('respond_ok', s =>
    s.responder('json', { statusCode: 200, body: '{{ stepResults.success }}' })
  )
  .step('invalid', s =>
    s.responder('json', { statusCode: 400, body: { error: 'Invalid payment data' } })
  )
  .step('unauthorized', s =>
    s.responder('json', { statusCode: 401, body: { error: 'Unauthorized' } })
  )
  .build();

flosync.register(w);

async function run() {
  const ok = await flosync.run('payment-gateway', {
    body: { amount: 5000, currency: 'NGN', reference: 'ref-001' },
    headers: { authorization: 'Bearer valid-token' },
  });
  console.log('Payment success:', ok.body);

  const unauth = await flosync.run('payment-gateway', {
    body: { amount: 100, currency: 'USD' },
    headers: {},
  });
  console.log('Unauthorized:', unauth.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
