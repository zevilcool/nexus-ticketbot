import { Events } from 'discord.js';

export default {
  name: Events.ChannelDelete,

  async execute(client, channel) {
    if (!channel.guild) return;

    const embed = client.loggingService.buildChannelDeleteEmbed(channel);
    client.loggingService.log({
      guildId:   channel.guild.id,
      eventType: 'CHANNEL_DELETE',
      targetId:  channel.id,
      targetType: 'CHANNEL',
      details:   { name: channel.name, type: channel.type },
      embed,
    });
  },
};
