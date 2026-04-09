import { Events } from 'discord.js';
import { ticketRepository } from '../modules/tickets/ticket.repository.js';

export default {
  name: Events.MessageCreate,

  async execute(client, message) {
    if (!message.guild || message.author.bot) return;

    await client.loggingService.cacheMessage(message);

    // If the message was sent inside a ticket, update its last-activity timestamp.
    // This resets the inactivity warning timer.
    const ticket = await ticketRepository.findByChannelId(message.channelId);
    if (ticket && ticket.status === 'OPEN') {
      await ticketRepository.touchActivity(ticket.id);

      // Track how many times the ticket opener has messaged.
      // The inactivity manager uses this to skip warnings when the opener is clearly active.
      if (message.author.id === ticket.userId) {
        await ticketRepository.incrementOpenerMessageCount(ticket.id);
      }
    }
  },
};
