const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('protected-api')
  .http('GET', '/me')
  .step('auth', s =>
    s.auth('bearer.system', 'bearer.validate', {
      token: '{{ headers.authorization }}',
    })
      .then('fetch')
      .else('forbidden')
  )
  .step('fetch', s =>
    s.transform({
      user: '{{ vars.defaultUser }}',
      authenticated: true,
    })
  )
  .step('respond', s =>
    s.responder('json', { body: '{{ stepResults.fetch }}' })
  )
  .step('forbidden', s =>
    s.responder('json', { statusCode: 403, body: { error: 'Forbidden' } })
  )
  .build();

const wf = { ...w, vars: { defaultUser: 'user-123' } };
flosync.register(wf);

async function run() {
  const ok = await flosync.run('protected-api', {
    body: {},
    headers: { authorization: 'Bearer secret-key-123' },
    vars: { defaultUser: 'user-123' },
  });
  console.log('Authenticated:', ok.body);

  const fail = await flosync.run('protected-api', {
    body: {},
    headers: {},
    vars: { defaultUser: 'user-123' },
  });
  console.log('Forbidden:', fail.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
