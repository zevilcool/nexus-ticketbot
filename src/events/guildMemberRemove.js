import { Events } from 'discord.js';

export default {
  name: Events.GuildMemberRemove,

  async execute(client, member) {
    const embed = client.loggingService.buildMemberLeaveEmbed(member);
    client.loggingService.log({
      guildId:   member.guild.id,
      eventType: 'MEMBER_LEAVE',
      targetId:  member.id,
      targetType: 'USER',
      details:   { tag: member.user.tag, roles: member.roles.cache.map((r) => r.id) },
      embed,
    });
  },
};
