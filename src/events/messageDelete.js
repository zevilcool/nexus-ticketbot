import { Events } from 'discord.js';

export default {
  name: Events.MessageDelete,

  async execute(client, message) {
    if (!message.guild) return;

    const cached = await client.loggingService.getCachedMessage(message.id);

    // Ignore bot messages — we don't need to log those.
    if (message.author?.bot || cached?.authorId === client.user.id) return;

    const embed = client.loggingService.buildMessageDeleteEmbed({ cached, message });
    client.loggingService.log({
      guildId:   message.guildId,
      eventType: 'MESSAGE_DELETE',
      actorId:   cached?.authorId ?? message.author?.id ?? null,
      targetId:  message.id,
      targetType: 'MESSAGE',
      details:   { content: cached?.content ?? null, channelId: message.channelId },
      channelId: message.channelId,
      messageId: message.id,
      embed,
    });
  },
};
