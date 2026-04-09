import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { successEmbed, errorEmbed } from '../../utils/embed.js';
import { sanitizeChannelName, sanitizeInput } from '../../utils/permissions.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename this ticket channel')
    .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(30)),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const rawName  = sanitizeInput(interaction.options.getString('name'), 30);
    const newName  = `ticket-${sanitizeChannelName(rawName)}-${ticket.ticketNum}`;

    try {
      await interaction.channel.setName(newName, `Renamed by ${interaction.user.tag}`);
      await ticketRepository.logAction(ticket.id, 'RENAMED', interaction.user.id, { from: interaction.channel.name, to: newName });
      await interaction.editReply({ embeds: [successEmbed('Renamed', `Channel renamed to \`${newName}\``)] });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Failed', 'Discord rate-limits channel renames to 2 per 10 minutes. Try again shortly.')] });
    }
  },
};
