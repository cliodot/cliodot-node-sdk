const { flosync, variable: v } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('validator-groups-demo')
  .http('POST', '/validate')
  .step('validate', s =>
    s.validator([
      {
        fields: [v.body('name'), v.body('email')],
        validators: [
          { name: 'not_empty', config: {} },
          { name: 'contains', config: { search: 'relevar', caseSensitive: true, message: 'Must contain relevar' } },
        ],
      },
      {
        fields: [v.body('name')],
        validators: [{ name: 'ends_with', config: { suffix: '.com', message: 'Name must end with .com' } }],
      },
    ])
      .then('ok')
      .else('error')
  )
  .step('ok', s =>
    s.responder('json', {
      body: { valid: true, message: 'All validations passed' },
    })
  )
  .step('error', s =>
    s.responder('json', {
      statusCode: 400,
      body: { valid: false, error: 'Validation failed' },
    })
  )
  .build();

flosync.register(w);

async function run() {
  const pass = await flosync.run('validator-groups-demo', {
    body: { name: 'relevar.com', email: 'user@relevar.com' },
  });
  console.log('Pass:', pass.statusCode, pass.body);

  const fail = await flosync.run('validator-groups-demo', {
    body: { name: 'other.com', email: 'user@example.com' },
  });
  console.log('Fail:', fail.statusCode, fail.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
