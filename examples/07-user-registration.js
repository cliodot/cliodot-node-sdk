const { flosync } = require('../dist');

flosync.configure({
  connectors: {
    'mongodb.system': { uri: process.env.MONGO_URI || 'mongodb://localhost:27017', database: 'app' },
  },
});

const validateUser = flosync
  .function('validate-user')
  .input({ email: 'string', name: 'string', password: 'string' })
  .step('validate', s =>
    s.validator({
      email: '{{ args.email }}',
      name: '{{ args.name }}',
      password: '{{ args.password }}',
    })
  )
  .step('hash', s =>
    s.encrypt('hash.encryption', 'hash', {
      data: '{{ args.password }}',
      algorithm: 'sha256',
    })
  )
  .step('format', s =>
    s.transform({
      valid: '{{ stepResults.validate.valid }}',
      email: '{{ args.email }}',
      name: '{{ args.name }}',
      passwordHash: '{{ stepResults.hash }}',
    })
  )
  .outputFrom('format')
  .build();

flosync.registerFunction(validateUser);

const w = flosync
  .workflow('register-user')
  .http('POST', '/users')
  .step('validate', s =>
    s.call('validate-user', {
      email: '{{ body.email }}',
      name: '{{ body.name }}',
      password: '{{ body.password }}',
    })
  )
  .step('check', s =>
    s.condition('{{ stepResults.validate.valid }}')
      .then('save')
      .else('error')
  )
  .step('save', s =>
    s.db('mongodb', 'insertOne', {
      collection: 'users',
      document: '{{ stepResults.validate }}',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      statusCode: 201,
      body: {
        id: '{{ stepResults.save.insertedId }}',
        email: '{{ stepResults.validate.email }}',
      },
    })
  )
  .step('error', s =>
    s.responder('json', { statusCode: 400, body: { error: 'Validation failed' } })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('register-user', {
    body: { email: 'user@example.com', name: 'John', password: 'secret123' },
  });
  console.log('Registration:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
