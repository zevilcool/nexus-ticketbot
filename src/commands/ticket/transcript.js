import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { generateTranscript } from '../../utils/transcript.js';
import { successEmbed, errorEmbed } from '../../utils/embed.js';

export default {
  staffOnly: false,

  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Download a transcript of this ticket'),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const html = await generateTranscript(interaction.channel, ticket);
      const file = new AttachmentBuilder(Buffer.from(html, 'utf-8'), {
        name: `transcript-${ticket.ticketNum}.html`,
      });

      await ticketRepository.logAction(ticket.id, 'TRANSCRIPT_GENERATED', interaction.user.id);

      return interaction.editReply({
        embeds: [successEmbed('Transcript Ready', `Ticket #${ticket.ticketNum} — attached below.`)],
        files:  [file],
      });
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Failed', 'Could not generate the transcript.')] });
    }
  },
};
