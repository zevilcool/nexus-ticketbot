import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { successEmbed, errorEmbed, logEmbed, COLORS } from '../../utils/embed.js';
import { isStaff, sanitizeInput } from '../../utils/permissions.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage the ticket blacklist')
    .addSubcommand((sub) =>
      sub.setName('add')
        .setDescription('Block a user from opening ticketRepository')
        .addUserOption((o) => o.setName('user').setDescription('User to blacklist').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(256))
    )
    .addSubcommand((sub) =>
      sub.setName('remove')
        .setDescription('Remove a user from the blacklist')
        .addUserOption((o) => o.setName('user').setDescription('User to unblacklist').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('list')
        .setDescription('Show all blacklisted users in this server')
    ),

  async execute(client, interaction) {
    if (!(await isStaff(interaction.member))) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', 'Staff only.')], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (sub === 'add') {
      const user   = interaction.options.getUser('user');
      const reason = sanitizeInput(interaction.options.getString('reason') ?? 'No reason provided', 256);

      if (user.id === interaction.user.id) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid', "You can't blacklist yourself.")] });
      }

      await ticketRepository.addBlacklist(user.id, interaction.guildId, interaction.user.id, reason);

      return interaction.editReply({
        embeds: [
          successEmbed('User Blacklisted', `**${user.tag}** can no longer open ticketRepository.`)
            .addFields(
              { name: '📋 Reason',   value: reason,                        inline: false },
              { name: '👮 Added by', value: `<@${interaction.user.id}>`,   inline: true }
            ),
        ],
      });
    }

    if (sub === 'remove') {
      const user   = interaction.options.getUser('user');
      const result = await ticketRepository.removeBlacklist(user.id, interaction.guildId);

      if (result.count === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', `**${user.tag}** is not blacklisted.`)] });
      }

      return interaction.editReply({
        embeds: [successEmbed('Removed from Blacklist', `**${user.tag}** can open ticketRepository again.`)],
      });
    }

    if (sub === 'list') {
      const entries = await ticketRepository.listBlacklist(interaction.guildId);

      if (!entries.length) {
        return interaction.editReply({
          embeds: [logEmbed({ title: '📋 Blacklist', description: 'No users are blacklisted.', color: COLORS.NEUTRAL })],
        });
      }

      const lines = entries
        .map((entry, i) => `**${i + 1}.** <@${entry.userId}> — ${entry.reason ?? 'no reason'} *(added by <@${entry.addedBy}>)*`)
        .join('\n');

      return interaction.editReply({
        embeds: [logEmbed({ title: `📋 Blacklist (${entries.length})`, description: lines.slice(0, 4000), color: COLORS.NEUTRAL })],
      });
    }
  },
};
