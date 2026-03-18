const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('data-pipeline')
  .step('transform', s =>
    s.transform({
      items: '{{ body.items }}',
      total: '{{ length(body.items) }}',
    })
  )
  .step('hash', s =>
    s.encrypt('hash.encryption', 'hash', {
      data: '{{ json_stringify(stepResults.transform) || "{}" }}',
      algorithm: 'sha256',
    })
  )
  .step('encode', s =>
    s.encrypt('base64.encryption', 'encode', {
      data: '{{ stepResults.hash }}',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      body: {
        checksum: '{{ stepResults.encode }}',
        itemCount: '{{ stepResults.transform.total }}',
      },
    })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('data-pipeline', {
    body: { items: [{ id: 1 }, { id: 2 }] },
  });
  console.log('Pipeline result:', result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
