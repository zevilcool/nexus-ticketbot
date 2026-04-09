import { Events } from 'discord.js';

export default {
  name: Events.ChannelCreate,

  async execute(client, channel) {
    if (!channel.guild) return;

    const embed = client.loggingService.buildChannelCreateEmbed(channel);
    client.loggingService.log({
      guildId:   channel.guild.id,
      eventType: 'CHANNEL_CREATE',
      targetId:  channel.id,
      targetType: 'CHANNEL',
      details:   { name: channel.name, type: channel.type, parent: channel.parent?.name },
      channelId: channel.id,
      embed,
    });
  },
};
