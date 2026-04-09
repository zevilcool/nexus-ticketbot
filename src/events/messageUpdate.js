import { Events } from 'discord.js';

export default {
  name: Events.MessageUpdate,

  async execute(client, oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;

    // Discord fires this event for things like embed unfurls — skip those.
    if (oldMessage.content === newMessage.content) return;

    const cached = await client.loggingService.getCachedMessage(newMessage.id);
    const embed  = client.loggingService.buildMessageUpdateEmbed({ cached, newMessage });
    if (!embed) return;

    client.loggingService.log({
      guildId:   newMessage.guildId,
      eventType: 'MESSAGE_UPDATE',
      actorId:   newMessage.author?.id,
      targetId:  newMessage.id,
      targetType: 'MESSAGE',
      details:   { before: cached?.content ?? null, after: newMessage.content, channelId: newMessage.channelId },
      channelId: newMessage.channelId,
      messageId: newMessage.id,
      embed,
    });

    // Update the cache so the next edit has the correct "before" content.
    await client.loggingService.cacheMessage(newMessage);
  },
};
