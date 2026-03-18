const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const validatePayment = flosync
  .function('validate-payment')
  .input({ amount: 'number', currency: 'string' })
  .step('check', s =>
    s.transform({
      valid: '{{ args.amount > 0 && args.currency }}',
      amount: '{{ args.amount }}',
    })
  )
  .outputFrom('check')
  .build();

flosync.registerFunction(validatePayment);

const w = flosync
  .workflow('payment')
  .http('POST', '/pay')
  .step('validate', s =>
    s.call('validate-payment', {
      amount: '{{ trigger.body.amount }}',
      currency: '{{ trigger.body.currency }}',
    })
  )
  .step('respond', s => s.responder('json', { body: '{{ stepResults.validate }}' }))
  .build();

flosync.register(w);

async function main() {
  const fnResult = await flosync.runFunction('validate-payment', { amount: 50, currency: 'USD' });
  console.log('Function result:', fnResult);

  const wfResult = await flosync.run('payment', { body: { amount: 100, currency: 'NGN' } });
  console.log('Workflow result:', wfResult);
}

main().catch(console.error);
