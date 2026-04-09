import { Events, AuditLogEvent } from 'discord.js';

export default {
  name: Events.GuildBanRemove,

  async execute(client, ban) {
    let mod = null;

    try {
      const logs  = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 });
      const entry = logs.entries.find((e) => e.target?.id === ban.user.id);
      if (entry) mod = entry.executor;
    } catch {}

    const embed = client.loggingService.buildUnbanEmbed(ban.guild, ban.user, mod);
    client.loggingService.log({
      guildId:   ban.guild.id,
      eventType: 'MEMBER_UNBAN',
      actorId:   mod?.id ?? null,
      targetId:  ban.user.id,
      targetType: 'USER',
      details:   { mod: mod?.tag },
      embed,
    });
  },
};
