import { db } from '../../database/prisma.service.js';

/**
 * Repository for managing all database interactions related to support ticketRepository.
 * This file serves as the data access layer (DAL) for the ticket module.
 */
export const ticketRepository = {

  /*
 /=================/
       Ticket Creation
 /=================/
*/

  /**
 * Record a new ticket in the database.
 */
  async create({ guildId, userId, categoryKey, channelId }) {
    const ticketNumber = await db.nextTicketNumber(guildId);
    
    return db.client.ticket.create({
      data: { 
        guildId, 
        userId, 
        categoryKey, 
        channelId, 
        ticketNum: ticketNumber 
      },
    });
  },

  /*
 /=================/
       Data Retrieval
 /=================/
*/

  /**
 * Find a single ticket by its internal database ID.
 */
  async findById(ticketId) {
    return db.client.ticket.findUnique({ where: { id: ticketId } });
  },

  /**
 * Find a ticket associated with a specific Discord channel ID.
 */
  async findByChannelId(channelId) {
    return db.client.ticket.findUnique({ where: { channelId } });
  },

  /**
 * Retrieve all currently open ticketRepository for a specific user in a guild.
 */
  async findOpenByUser(guildId, userId) {
    return db.client.ticket.findMany({ 
      where: { 
        guildId, 
        userId, 
        status: 'OPEN' 
      } 
    });
  },

  /**
 * Retrieve recent ticketRepository for a user to prevent duplicate submissions.
 */
  async findRecentByUser(guildId, userId, limitDays = 7) {
    const cutoffDate = new Date(Date.now() - limitDays * 86_400_000);
    
    return db.client.ticket.findMany({
      where: { 
        guildId, 
        userId, 
        createdAt: { gte: cutoffDate } 
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
 * Find open ticketRepository that have exceeded the inactivity threshold.
 */
  async findStale({ inactivityHours }) {
    const cutoffDate = new Date(Date.now() - inactivityHours * 3_600_000);
    
    return db.client.ticket.findMany({ 
      where: { 
        status: 'OPEN', 
        lastActivityAt: { lt: cutoffDate } 
      } 
    });
  },

  /**
 * Find ticketRepository that were warned for inactivity but still haven't been touched.
 */
  async findWarnedStale({ warnBeforeHours }) {
    const cutoffDate = new Date(Date.now() - warnBeforeHours * 3_600_000);
    
    return db.client.ticket.findMany({ 
      where: { 
        status: 'OPEN', 
        warnedAt: { lt: cutoffDate } 
      } 
    });
  },

  /*
 /=================/
       Data Modification
 /=================/
*/

  /**
 * Perform a generic update on a ticket record.
 */
  async update(ticketId, updateData) {
    return db.client.ticket.update({ 
      where: { id: ticketId }, 
      data: updateData 
    });
  },

  /**
 * Mark a ticket as closed and clears the associated channel ID.
 */
  async close(ticketId, closedById, closeReason) {
    return db.client.ticket.update({
      where: { id: ticketId },
      data: { 
        status: 'CLOSED', 
        closedBy: closedById, 
        closeReason, 
        closedAt: new Date(), 
        channelId: null 
      },
    });
  },

  /**
 * Reset the inactivity timer and clears any active warnings for a ticket.
 */
  async touchActivity(ticketId) {
    return db.client.ticket.update({
      where: { id: ticketId },
      data: { 
        lastActivityAt: new Date(), 
        warnedAt: null 
      },
    });
  },

  /**
 * Increment the message counter for the user who opened the ticket.
 */
  async incrementOpenerMessageCount(ticketId) {
    return db.client.ticket.update({
      where: { id: ticketId },
      data: { 
        openerMsgCount: { increment: 1 } 
      },
    });
  },

  /*
 /=================/
       Internal Notes
 /=================/
*/

  /**
 * Add a staff-only note to a ticket record.
 */
  async addNote(ticketId, authorId, content) {
    return db.client.ticketNote.create({ 
      data: { ticketId, authorId, content } 
    });
  },

  /*
 /=================/
       Audit Logging
 /=================/
*/

  /**
 * Record a specific action in the ticket's audit log.
 */
  async logAction(ticketId, actionType, actorId, actionDetails = null) {
    return db.client.ticketLog.create({
      data: { 
        ticketId, 
        action: actionType, 
        actorId, 
        details: actionDetails ? JSON.stringify(actionDetails) : null 
      },
    });
  },

  /*
 /=================/
       User Cooldowns
 /=================/
*/

  /**
 * Retrieve any active cooldown for a user in a specific category.
 */
  async getCooldown(userId, guildId, categoryKey) {
    return db.client.userCooldown.findUnique({
      where: { 
        userId_guildId_categoryKey: { userId, guildId, categoryKey } 
      },
    });
  },

  /**
 * Set or updates a cooldown for a user to prevent ticket spam.
 */
  async setCooldown(userId, guildId, categoryKey, durationMs) {
    const expiresAt = new Date(Date.now() + durationMs);
    
    return db.client.userCooldown.upsert({
      where: { 
        userId_guildId_categoryKey: { userId, guildId, categoryKey } 
      },
      create: { userId, guildId, categoryKey, expiresAt },
      update: { expiresAt },
    });
  },

  /**
 * Remove an active cooldown for a user.
 */
  async deleteCooldown(userId, guildId, categoryKey) {
    return db.client.userCooldown.deleteMany({ 
      where: { userId, guildId, categoryKey } 
    });
  },

  /*
 /=================/
       User Blacklist
 /=================/
*/

  /**
 * Check if a user is currently blacklisted from opening ticketRepository in a guild.
 */
  async isBlacklisted(userId, guildId) {
    const blacklistEntry = await db.client.blacklist.findUnique({ 
      where: { userId_guildId: { userId, guildId } } 
    });
    return !!blacklistEntry;
  },

  /**
 * Add a user to the guild's ticket blacklist.
 */
  async addBlacklist(userId, guildId, moderatorId, reason = null) {
    return db.client.blacklist.upsert({
      where: { userId_guildId: { userId, guildId } },
      create: { userId, guildId, addedBy: moderatorId, reason },
      update: { addedBy: moderatorId, reason },
    });
  },

  /**
 * Remove a user from the ticket blacklist.
 */
  async removeBlacklist(userId, guildId) {
    return db.client.blacklist.deleteMany({ 
      where: { userId, guildId } 
    });
  },

  /**
 * List all blacklisted users for a specific guild.
 */
  async listBlacklist(guildId) {
    return db.client.blacklist.findMany({ 
      where: { guildId }, 
      orderBy: { createdAt: 'desc' } 
    });
  },
};
