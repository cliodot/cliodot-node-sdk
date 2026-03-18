const path = require('path');

async function runExamples() {
  const examples = [
    '01-payment-gateway',
    '02-custom-connector-stripe',
    '03-api-with-auth',
    '05-scheduled-job',
    '06-data-pipeline',
    '08-webhook-processor',
    '09-full-stack',
    '11-hybrid-local-remote',
    '12-custom-connector-discord',
    '13-validator-groups',
  ];

  console.log('Running examples (skipping MongoDB-dependent: 04, 07)...\n');

  for (const name of examples) {
    try {
      console.log(`--- ${name} ---`);
      const mod = require(path.join(__dirname, name + '.js'));
      if (mod.run) await mod.run();
      console.log('');
    } catch (err) {
      console.error(`${name} failed:`, err.message);
      console.log('');
    }
  }

  console.log('Done. For 04-ecommerce-order and 07-user-registration, set MONGO_URI and run them separately.');
}

runExamples().catch(console.error);
