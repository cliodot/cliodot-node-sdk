const { flosync, connector } = require('../dist');

flosync.registerConnector(
  'stripe.payment',
  connector('stripe.payment', 'Stripe Payment')
    .baseUrl(process.env.STRIPE_MOCK_URL || 'https://api.stripe.com/v1')
    .bearer(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx')
    .post('CreatePaymentIntent', '/payment_intents', {
      description: 'Create a payment intent',
      body_schema: { amount: 'number', currency: 'string' },
    })
    .get('RetrievePaymentIntent', '/payment_intents/{{ pathParams.id }}', {
      pathParams: { id: '{{ pathParams.id }}' },
      response_mapping: { clientSecret: 'client_secret', status: 'status' },
    })
    .build()
);

flosync.configure({
  connectors: {
    'stripe.payment': { apiKey: process.env.STRIPE_SECRET_KEY || 'sk_test_xxx' },
  },
});

const w = flosync
  .workflow('stripe-charge')
  .http('POST', '/charge')
  .step('validate', s =>
    s.validator({
      amount: '{{ body.amount }}',
      currency: '{{ body.currency }}',
    })
      .then('genId')
      .else('error')
  )
  .step('genId', s => s.util('utility.random', 'uuid', {}))
  .step('charge', s =>
    s.transform({
      client_secret: '{{ "pi_mock_" + stepResults.genId }}',
      status: 'requires_payment_method',
      amount: '{{ body.amount }}',
      currency: '{{ body.currency }}',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      statusCode: 200,
      body: {
        clientSecret: '{{ stepResults.charge.client_secret }}',
        status: '{{ stepResults.charge.status }}',
      },
    })
  )
  .step('error', s =>
    s.responder('json', { statusCode: 400, body: { error: 'Validation failed' } })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('stripe-charge', {
    body: { amount: 1000, currency: 'usd', orderId: 'ord-123' },
  });
  console.log('Stripe charge result:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
