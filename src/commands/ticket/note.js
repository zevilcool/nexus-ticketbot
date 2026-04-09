import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { logEmbed, errorEmbed, COLORS } from '../../utils/embed.js';
import { sanitizeInput } from '../../utils/permissions.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a private staff note to this ticket')
    .addStringOption((o) => o.setName('message').setDescription('Note content').setRequired(true).setMaxLength(1024)),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const content = sanitizeInput(interaction.options.getString('message'), 1024);

    await ticketRepository.addNote(ticket.id, interaction.user.id, content);
    await ticketRepository.logAction(ticket.id, 'NOTE_ADDED', interaction.user.id, { preview: content.slice(0, 80) });

    // Post the note visibly in the ticket so other staff can see it.
    // It's sent as an embed to make it visually distinct from regular messages.
    await interaction.channel.send({
      embeds: [logEmbed({
        title:       '📝 Staff Note',
        description: content,
        color:       COLORS.WARNING,
        fields:      [{ name: 'Author', value: `<@${interaction.user.id}>`, inline: true }],
        footer:      `Ticket #${ticket.ticketNum} · Staff only`,
      })],
    });

    await interaction.editReply({ content: '✅ Note added.' });
  },
};
