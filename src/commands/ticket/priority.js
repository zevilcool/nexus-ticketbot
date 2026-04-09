import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { errorEmbed } from '../../utils/embed.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Set the priority level for this ticket')
    .addStringOption((o) =>
      o.setName('level').setDescription('Priority level').setRequired(true)
        .addChoices(
          { name: '🟢 Low',    value: 'LOW' },
          { name: '🟡 Medium', value: 'MEDIUM' },
          { name: '🟠 High',   value: 'HIGH' },
          { name: '🔴 Urgent', value: 'URGENT' }
        )
    ),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const level  = interaction.options.getString('level');
    const result = await client.ticketService.setPriority(ticket, interaction.channel, interaction.user.id, level);

    if (result.error) return interaction.editReply({ embeds: [errorEmbed('Error', result.error)] });

    await interaction.deleteReply();
  },
};
