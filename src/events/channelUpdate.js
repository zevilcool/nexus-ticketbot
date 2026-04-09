import { Events } from 'discord.js';

export default {
  name: Events.ChannelUpdate,

  async execute(client, oldChannel, newChannel) {
    if (!newChannel.guild) return;

    const embed = client.loggingService.buildChannelUpdateEmbed(oldChannel, newChannel);
    if (!embed) return; // no meaningful changes detected

    client.loggingService.log({
      guildId:   newChannel.guild.id,
      eventType: 'CHANNEL_UPDATE',
      targetId:  newChannel.id,
      targetType: 'CHANNEL',
      details:   { id: newChannel.id },
      channelId: newChannel.id,
      embed,
    });
  },
};
