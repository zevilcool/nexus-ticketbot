import cron from 'node-cron';
import { ticketRepository } from './ticket.repository.js';
import { db } from '../../database/prisma.service.js';
import { warnEmbed } from '../../utils/embed.js';
import { config } from '../../config.js';
import logger from '../../utils/logger.js';

/**
 * Duration for which a user is timed out if their ticket is auto-closed due to inactivity.
 */
const INACTIVITY_TIMEOUT_DURATION = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Threshold of messages sent by the ticket opener.
 * If they've sent more than this, we assume they are actively waiting for a response.
 */
const ACTIVE_USER_MESSAGE_THRESHOLD = 3;

/**
 * Manage the lifecycle of stale ticketRepository, including sending warnings,
 * auto-closing inactive ticketRepository, and escalating long-running issues.
 */
export class InactivityManager {
  constructor(client) {
    this.client = client;
  }

  /**
 * Initialize the scheduled tasks for monitoring ticket activity.
 */
  start() {
    // Check for ticketRepository that have become stale and need a warning every 30 minutes.
    cron.schedule('*/30 * * * *', () => this.#processStaleWarnings());
    
    // Check for ticketRepository that should be auto-closed (runs at the 15th and 45th minute of every hour).
    cron.schedule('15,45 * * * *', () => this.#processAutoClosures());
    
    logger.info('[InactivityManager] Scheduled monitoring tasks initialized');
  }

  /**
 * Identifie ticketRepository with no recent activity and sends a warning message.
 * @private
 */
  async #processStaleWarnings() {
    try {
      const staleTickets = await ticketRepository.findStale({
        inactivityHours: config.tickets.inactivityHours - config.tickets.warningHours,
      });

      for (const ticket of staleTickets) {
        if (ticket.warnedAt) continue;

        // Skip warning if the user has been proactive; they are likely waiting on staff.
        if (ticket.openerMsgCount >= ACTIVE_USER_MESSAGE_THRESHOLD) {
          logger.info('[InactivityManager] Skipping warning for active user', { ticketId: ticket.id });
          continue;
        }

        const channel = this.client.channels.cache.get(ticket.channelId);
        if (!channel) continue;

        try {
          await channel.send({
            embeds: [warnEmbed(
              'Inactivity Warning',
              `This ticket has been inactive and will be **automatically closed in ${config.tickets.warningHours} hours**.\n\nTo keep this ticket open, please send a message here.`
            )],
          });

          await ticketRepository.update(ticket.id, { warnedAt: new Date() });
          logger.info('[InactivityManager] Inactivity warning sent', { ticketId: ticket.id });
        } catch (err) {
          logger.warn('[InactivityManager] Failed to send warning to channel', { channelId: ticket.channelId });
        }
      }
    } catch (err) {
      logger.error('[InactivityManager] Error during stale warning process', { error: err.message });
    }
  }

  /**
 * Close ticketRepository that remained inactive after receiving a warning.
 * @private
 */
  async #processAutoClosures() {
    try {
      const ticketsPendingClosure = await ticketRepository.findWarnedStale({ 
        warnBeforeHours: config.tickets.warningHours 
      });

      for (const ticket of ticketsPendingClosure) {
        if (ticket.lastActivityAt > ticket.warnedAt) {
          await ticketRepository.update(ticket.id, { warnedAt: null });
          logger.info('[InactivityManager] User activity detected after warning, resetting state', { ticketId: ticket.id });
          continue;
        }

        const guild = this.client.guilds.cache.get(ticket.guildId);
        const channel = guild?.channels.cache.get(ticket.channelId);

        // If the channel no longer exists, just mark the ticket as closed in the database.
        if (!guild || !channel) {
          await ticketRepository.close(ticket.id, this.client.user.id, 'System: Auto-closed due to inactivity');
          continue;
        }

        try {
          const member = await guild.members.fetch(ticket.userId).catch(() => null);
          if (member && !member.permissions.has('Administrator')) {
            await member.disableCommunicationUntil(
              Date.now() + INACTIVITY_TIMEOUT_DURATION,
              'Automated: Failure to respond to inactivity warning'
            );
            
            await channel.send({
              embeds: [warnEmbed(
                'User Timed Out', 
                `<@${ticket.userId}> has been temporarily timed out for **12 hours** due to lack of response.`
              )],
            }).catch(() => {});
            
            logger.info('[InactivityManager] User timed out for inactivity', { userId: ticket.userId });
          }
        } catch (err) {
          logger.warn('[InactivityManager] Could not apply timeout to user', { userId: ticket.userId, error: err.message });
        }

        // Finalize the ticket closure.
        await this.client.ticketService.closeTicket(
          ticket, 
          channel, 
          this.client.user.id, 
          'System: Auto-closed due to inactivity'
        );
        
        logger.info('[InactivityManager] Ticket auto-closed', { ticketId: ticket.id });
      }

      // Check for ticketRepository that need to be escalated.
      await this.#processEscalations();
    } catch (err) {
      logger.error('[InactivityManager] Error during auto-closure process', { error: err.message });
    }
  }

  /**
 * Identifie long-open ticketRepository and notifies staff for urgent review.
 * @private
 */
  async #processEscalations() {
    const escalationCutoff = new Date(Date.now() - config.tickets.escalationHours * 3_600_000);
    
    try {
      const overdueTickets = await db.client.ticket.findMany({
        where: { 
          status: 'OPEN', 
          createdAt: { lt: escalationCutoff } 
        },
      });

      for (const ticket of overdueTickets) {
        // Skip ticketRepository that are already escalated.
        if (ticket.status === 'ESCALATED') continue;

        const channel = this.client.channels.cache.get(ticket.channelId);
        if (!channel) continue;

        const guildSettings = await db.getGuildConfig(ticket.guildId);
        const staffRoleIds = JSON.parse(guildSettings.staffRoleIds);
        const staffMentions = staffRoleIds.map((id) => `<@&${id}>`).join(' ');

        try {
          await channel.send({
            content: staffMentions,
            embeds: [warnEmbed(
              '🚨 Ticket Escalated',
              `This ticket has been open for over **${config.tickets.escalationHours} hours** without resolution. Staff attention is required.`
            )],
          });

          await ticketRepository.update(ticket.id, { status: 'ESCALATED' });
          await ticketRepository.logAction(ticket.id, 'ESCALATED', this.client.user.id);
          
          logger.info('[InactivityManager] Ticket escalated', { ticketId: ticket.id });
        } catch (err) {
          logger.warn('[InactivityManager] Failed to send escalation notice', { channelId: ticket.channelId });
        }
      }
    } catch (err) {
      logger.error('[InactivityManager] Error during escalation process', { error: err.message });
    }
  }
}
