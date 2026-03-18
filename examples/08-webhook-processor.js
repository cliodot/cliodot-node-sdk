const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('webhook-processor')
  .step('log', s =>
    s.log('Webhook received: {{ body.event }} from {{ headers["x-source"] }}')
  )
  .step('check', s =>
    s.condition('{{ body.event == "payment.completed" }}')
      .then('process')
      .else('ignore')
  )
  .step('process', s =>
    s.transform({
      event: '{{ body.event }}',
      payload: '{{ body.payload }}',
      source: '{{ headers["x-source"] }}',
      processedAt: '{{ vars.timestamp }}',
    })
  )
  .step('respond', s =>
    s.responder('json', { body: '{{ stepResults.process }}' })
  )
  .step('ignore', s =>
    s.responder('json', { statusCode: 200, body: { received: true } })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('webhook-processor', {
    body: { event: 'payment.completed', payload: { amount: 100 } },
    headers: { 'x-source': 'stripe' },
    vars: { timestamp: new Date().toISOString() },
  });
  console.log('Webhook result:', result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
