import { Events, AuditLogEvent } from 'discord.js';

export default {
  name: Events.GuildBanAdd,

  async execute(client, ban) {
    let mod    = null;
    let reason = ban.reason;

    // Try to fetch the moderator from the audit log.
    // This can fail if the bot lacks VIEW_AUDIT_LOG — handle gracefully.
    try {
      const logs  = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const entry = logs.entries.find((e) => e.target?.id === ban.user.id);
      if (entry) {
        mod    = entry.executor;
        reason = entry.reason ?? reason;
      }
    } catch {}

    const embed = client.loggingService.buildBanEmbed(ban.guild, ban.user, mod, reason);
    client.loggingService.log({
      guildId:   ban.guild.id,
      eventType: 'MEMBER_BAN',
      actorId:   mod?.id ?? null,
      targetId:  ban.user.id,
      targetType: 'USER',
      details:   { reason, mod: mod?.tag },
      embed,
    });
  },
};
