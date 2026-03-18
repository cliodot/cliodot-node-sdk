const { flosync } = require('../dist');

flosync.configure({
  connectors: {
    'mongodb.system': { uri: process.env.MONGO_URI || 'mongodb://localhost:27017', database: 'ecommerce' },
  },
});

const formatOrder = flosync
  .function('format-order')
  .input({ items: 'array', total: 'number', customerId: 'string' })
  .step('genId', s => s.util('utility.random', 'uuid', {}))
  .step('format', s =>
    s.transform({
      orderId: '{{ stepResults.genId }}',
      items: '{{ args.items }}',
      total: '{{ args.total }}',
      customerId: '{{ args.customerId }}',
      status: 'pending',
    })
  )
  .outputFrom('format')
  .build();

flosync.registerFunction(formatOrder);

const w = flosync
  .workflow('create-order')
  .http('POST', '/orders')
  .step('validate', s =>
    s.validator({
      items: '{{ body.items }}',
      total: '{{ body.total }}',
      customerId: '{{ body.customerId }}',
    })
      .then('format')
      .else('error')
  )
  .step('format', s =>
    s.call('format-order', {
      items: '{{ body.items }}',
      total: '{{ body.total }}',
      customerId: '{{ body.customerId }}',
    })
  )
  .step('save', s =>
    s.db('mongodb', 'insertOne', {
      collection: 'orders',
      document: '{{ stepResults.format }}',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      statusCode: 201,
      body: {
        id: '{{ stepResults.save.insertedId }}',
        order: '{{ stepResults.format }}',
      },
    })
  )
  .step('error', s =>
    s.responder('json', { statusCode: 400, body: { error: 'Invalid order' } })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('create-order', {
    body: {
      items: [{ sku: 'A1', qty: 2, price: 10 }],
      total: 20,
      customerId: 'cust-001',
    },
  });
  console.log('Order created:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
