const { flosync } = require('../dist');

flosync.configure({ connectors: {} });

const w = flosync
  .workflow('daily-report')
  .job('0 9 * * *', 'UTC')
  .step('log', s => s.log('Daily report job started'))
  .step('datetime', s => s.util('utility.date_time', 'get_current_datetime', {}))
  .step('transform', s =>
    s.transform({
      summary: 'Daily metrics',
      generatedAt: '{{ stepResults.datetime ? stepResults.datetime.iso : "" }}',
    })
  )
  .step('respond', s =>
    s.responder('json', {
      body: {
        status: 'completed',
        summary: '{{ stepResults.transform.summary }}',
        generatedAt: '{{ stepResults.transform.generatedAt }}',
      },
    })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('daily-report', {});
  console.log('Job result:', result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
