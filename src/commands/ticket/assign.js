import { SlashCommandBuilder } from 'discord.js';
import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { errorEmbed } from '../../utils/embed.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('assign')
    .setDescription('Assign this ticket to a staff member')
    .addUserOption((o) => o.setName('staff').setDescription('Staff member to assign').setRequired(true)),

  async execute(client, interaction) {
    const ticket = await ticketRepository.findByChannelId(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Not a Ticket', 'Use this command inside a ticket channel.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const assignee = interaction.options.getUser('staff');
    const result   = await client.ticketService.assignTicket(ticket, interaction.channel, interaction.user.id, assignee.id);

    if (result.error) return interaction.editReply({ embeds: [errorEmbed('Error', result.error)] });

    await interaction.deleteReply();
  },
};
