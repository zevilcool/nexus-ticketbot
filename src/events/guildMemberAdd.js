import { Events } from 'discord.js';

export default {
  name: Events.GuildMemberAdd,

  async execute(client, member) {
    const embed = client.loggingService.buildMemberJoinEmbed(member);
    client.loggingService.log({
      guildId:   member.guild.id,
      eventType: 'MEMBER_JOIN',
      targetId:  member.id,
      targetType: 'USER',
      details: {
        tag:        member.user.tag,
        accountAge: Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000),
        bot:        member.user.bot,
      },
      embed,
    });
  },
};
