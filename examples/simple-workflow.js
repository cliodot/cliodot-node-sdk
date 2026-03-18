const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('hello')
  .http('POST', '/hello')
  .step('transform', s =>
    s.transform({
      message: '{{ "Hello, " + trigger.body.name }}',
      at: '{{ uppercase(trigger.body.name) }}',
    })
  )
  .step('respond', s => s.responder('json', { body: '{{ stepResults.transform }}' }))
  .build();

flosync.register(w);

async function main() {
  const result = await flosync.run('hello', { body: { name: 'World' } });
  console.log(result);
}

main().catch(console.error);
