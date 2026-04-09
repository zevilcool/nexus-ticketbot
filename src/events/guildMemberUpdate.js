import { Events } from 'discord.js';

export default {
  name: Events.GuildMemberUpdate,

  async execute(client, oldMember, newMember) {
    const changes = [];
    const fields  = [];

    if (oldMember.nickname !== newMember.nickname) {
      changes.push('nickname');
      fields.push({
        name:   '📝 Nickname',
        value:  `${oldMember.nickname ?? '*none*'} → ${newMember.nickname ?? '*none*'}`,
        inline: false,
      });
    }

    const rolesAdded   = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    const rolesRemoved = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

    if (rolesAdded.size) {
      changes.push('roles_added');
      fields.push({ name: '✅ Roles Added',   value: rolesAdded.map((r) => `<@&${r.id}>`).join(', '),   inline: false });
    }
    if (rolesRemoved.size) {
      changes.push('roles_removed');
      fields.push({ name: '❌ Roles Removed', value: rolesRemoved.map((r) => `<@&${r.id}>`).join(', '), inline: false });
    }

    const hadTimeout = oldMember.communicationDisabledUntil;
    const hasTimeout = newMember.communicationDisabledUntil;

    if (!hadTimeout && hasTimeout) {
      changes.push('timeout_added');
      fields.push({ name: '🔇 Timed Out Until', value: `<t:${Math.floor(hasTimeout.getTime() / 1000)}:F>`, inline: false });
    }
    if (hadTimeout && !hasTimeout) {
      changes.push('timeout_removed');
      fields.push({ name: '🔊 Timeout Removed', value: 'Lifted', inline: false });
    }

    // Server avatar
    if (oldMember.avatar !== newMember.avatar) {
      changes.push('server_avatar');
      fields.push({ name: '🖼️ Server Avatar', value: 'Changed', inline: false });
    }

    if (!changes.length) return;

    const eventType = changes.some((c) => c.startsWith('timeout')) ? 'MEMBER_TIMEOUT' : 'MEMBER_UPDATE';
    const embed     = client.loggingService.buildMemberUpdateEmbed(oldMember, newMember, changes, fields);

    client.loggingService.log({
      guildId:   newMember.guild.id,
      eventType,
      targetId:  newMember.id,
      targetType: 'USER',
      details:   { changes },
      embed,
    });
  },
};
