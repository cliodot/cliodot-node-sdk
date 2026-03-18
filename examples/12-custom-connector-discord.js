const { flosync, connector, variable: v } = require('../dist');

flosync.registerConnector(
  'discord.api',
  connector('discord.api', 'Discord')
    .description('Discord Bot API connector for sending messages to channels and DMs')
    .baseUrl('https://discord.com/api/v10')
    .botToken(process.env.DISCORD_BOT_TOKEN || '')
    .meta({ category: 'Messaging' })
    .post('Send Message to Channel', '/channels/{{ channelId }}/messages', {
      description: 'Send a message to a Discord channel',
      headers: { 'Content-Type': 'application/json' },
      body_schema: { content: 'string', tts: false, embeds: [], components: [] },
    })
    .post('Send Message with Embed', '/channels/{{ channelId }}/messages', {
      description: 'Send a rich embed message',
      headers: { 'Content-Type': 'application/json' },
      body_schema: { embeds: [{ title: 'string', description: 'string', color: 0 }] },
    })
    .post('Send Direct Message', '/users/@me/channels', {
      description: 'Create a DM channel and send message',
      headers: { 'Content-Type': 'application/json' },
      body_schema: { recipient_id: 'string' },
    })
    .patch('Edit Message', '/channels/{{ channelId }}/messages/{{ messageId }}', {
      description: 'Edit an existing message',
      headers: { 'Content-Type': 'application/json' },
      body_schema: { content: 'string', embeds: [] },
    })
    .delete('Delete Message', '/channels/{{ channelId }}/messages/{{ messageId }}', {
      description: 'Delete a message',
    })
    .get('Get Channel', '/channels/{{ channelId }}', {
      description: 'Get channel information',
      response_mapping: { id: 'id', name: 'name', type: 'type' },
    })
    .get('Get Channel Messages', '/channels/{{ channelId }}/messages', {
      description: 'Get messages from a channel',
      params: { limit: 50, before: 'string', after: 'string' },
    })
    .get('Get Bot User', '/users/@me', {
      description: 'Get bot user information',
      response_mapping: { id: 'id', username: 'username' },
    })
    .build()
);

flosync.configure({
  connectors: {
    'discord.api': { apiKey: process.env.DISCORD_BOT_TOKEN || '' },
  },
});

const hasToken = !!(process.env.DISCORD_BOT_TOKEN);

const w = flosync
  .workflow('discord-notify')
  .http('POST', '/discord/notify')
  .step('validate', s =>
    s.validator({
      channelId: v.body('channelId'),
      content: v.body('content'),
    })
      .then('route')
      .else('error')
  )
  .step('route', s =>
    s.condition(v.expr('vars.useLive ? true : false'))
      .then('send')
      .else('mock')
  )
  .step('send', s =>
    s.connector('discord.api', 'Send Message to Channel', {
      pathParams: { channelId: v.body('channelId') },
      body: { content: v.body('content'), tts: false },
    }).then('respond')
  )
  .step('mock', s =>
    s.transform({
      id: 'mock_msg_demo',
      channel_id: v.body('channelId'),
      content: v.body('content'),
    }).then('respond')
  )
  .step('respond', s =>
    s.responder('json', {
      body: {
        ok: true,
        messageId: v.expr('stepResults.send ? stepResults.send.id : stepResults.mock.id'),
      },
    })
  )
  .step('error', s =>
    s.responder('json', { statusCode: 400, body: { error: 'channelId and content required' } })
  )
  .build();

flosync.register(w);

async function run() {
  const result = await flosync.run('discord-notify', {
    body: {
      channelId: process.env.DISCORD_CHANNEL_ID || '123456789',
      content: 'Hello from Flosync!',
    },
    vars: { useLive: hasToken },
  });
  console.log('Discord notify:', result.statusCode, result.body);
}

if (require.main === module) run().catch(console.error);
module.exports = { run };
