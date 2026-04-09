import { ticketRepository } from '../../modules/tickets/ticket.repository.js';
import { errorEmbed } from '../../utils/embed.js';

export default {
  customId: 'close_confirm',

  async execute(client, interaction) {
    const [, ticketId, encodedReason] = interaction.customId.split(':');
    const reason = encodedReason ? decodeURIComponent(encodedReason) : 'No reason provided';

    await interaction.deferUpdate();

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || ticket.status !== 'OPEN') {
      return interaction.followUp({
        embeds:    [errorEmbed('Error', 'This ticket is no longer open.')],
        ephemeral: true,
      });
    }

    await client.ticketService.closeTicket(ticket, interaction.channel, interaction.user.id, reason);
  },
};
