import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { warnEmbed, errorEmbed } from '../../utils/embed.js';
import { sanitizeInput, isStaff } from '../../utils/permissions.js';

export default {
  staffOnly: false,

  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close this ticket')
    .addStringOption((o) => o.setName('reason').setDescription('Reason for closing').setMaxLength(256)),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket || ticket.status !== 'OPEN') {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside an open ticket.')], ephemeral: true });
    }

    const isOwner = ticket.userId === interaction.user.id;
    const staff   = await isStaff(interaction.member);

    if (!isOwner && !staff) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', 'Only the ticket owner or staff can close this.')], ephemeral: true });
    }

    const reason    = sanitizeInput(interaction.options.getString('reason') ?? 'No reason provided');
    const encoded   = encodeURIComponent(reason).slice(0, 150);
    const confirmId = `close_confirm:${ticket.id}:${encoded}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds:     [warnEmbed('Confirm Closure', `Close **Ticket #${ticket.ticketNum}**?\n**Reason:** ${reason}`)],
      components: [row],
    });
  },
};
