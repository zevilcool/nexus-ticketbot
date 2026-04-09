import { nanoid } from 'nanoid';
import { AttachmentBuilder } from 'discord.js';
import { ticketRepository } from './ticket.repository.js';
import { buildTicketPermissions, sanitizeChannelName, sanitizeInput } from '../../utils/permissions.js';
import { ticketWelcomeEmbed, successEmbed, errorEmbed, warnEmbed } from '../../utils/embed.js';
import { generateTranscript } from '../../utils/transcript.js';
import { db } from '../../database/prisma.service.js';
import { config } from '../../config.js';
import logger from '../../utils/logger.js';

/**
 * Service class responsible for managing the lifecycle of support ticketRepository,
 * including creation, closing, priority management, and member access.
 */
export class TicketService {
  constructor(client) {
    this.client = client;
  }

  /*
 /=================/
       Ticket Lifecycle Management
 /=================/
*/

  /**
 * Create a new support ticket channel and records it in the database.
 * @param {Guild} guild - The Discord guild where the ticket is being created.
 * @param {User} user - The user requesting the ticket.
 * @param {string} categoryKey - The identifier for the ticket category.
 * @returns {Promise<Object>} An object containing the new ticket and channel, or an error message.
 */
  async createTicket(guild, user, categoryKey) {
    const guildSettings = await db.getGuildConfig(guild.id);

    // Limit the number of concurrent open ticketRepository per user to prevent abuse.
    const userOpenTickets = await ticketRepository.findOpenByUser(guild.id, user.id);
    if (userOpenTickets.length >= config.tickets.maxOpenPerUser) {
      return { 
        error: `You've reached the maximum limit of **${config.tickets.maxOpenPerUser}** open ticketRepository. Please close an existing ticket before opening a new one.` 
      };
    }

    // Apply a category-specific cooldown to prevent rapid ticket reopening.
    const activeCooldown = await ticketRepository.getCooldown(user.id, guild.id, categoryKey);
    if (activeCooldown && activeCooldown.expiresAt > new Date()) {
      const remainingSeconds = Math.ceil((activeCooldown.expiresAt - Date.now()) / 1000);
      return { 
        error: `This category is currently on cooldown for you. Please try again in **${remainingSeconds}s**.` 
      };
    }

    // Check if the user already has a ticket open in this specific category.
    const recentTickets = await ticketRepository.findRecentByUser(guild.id, user.id, 3);
    const existingTicketInCategory = recentTickets.find(
      (t) => t.categoryKey === categoryKey && t.status !== 'CLOSED'
    );
    
    if (existingTicketInCategory) {
      const existingChannel = guild.channels.cache.get(existingTicketInCategory.channelId);
      if (existingChannel) {
        return { 
          error: `You already have an active ticket in this category: ${existingChannel}. Please continue the conversation there.` 
        };
      }
    }

    const categoryMetadata = config.tickets.categories.find((c) => c.key === categoryKey);
    const categoryDisplayName = categoryMetadata?.label ?? categoryKey;

    // Generate a unique channel name with a random suffix to prevent collisions.
    const uniqueSuffix = nanoid(6);
    const cleanUsername = sanitizeChannelName(user.username);
    const channelName = `ticket-${cleanUsername}-${uniqueSuffix}`;
    
    // Determine the correct permission overwrites for the new ticket.
    const permissionOverwrites = await buildTicketPermissions(guild, user);

    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: channelName,
        parent: guildSettings.ticketCategoryId ?? undefined,
        permissionOverwrites: permissionOverwrites,
        reason: `Support ticket opened by ${user.tag}`,
      });
    } catch (err) {
      logger.error('[TicketService] Failed to create Discord channel', { error: err.message });
      return { 
        error: 'Unable to create the ticket channel. Please ensure the bot has the "Manage Channels" permission.' 
      };
    }

    // Persist the ticket in the database before proceeding with announcements.
    const newTicket = await ticketRepository.create({ 
      guildId: guild.id, 
      userId: user.id, 
      categoryKey, 
      channelId: ticketChannel.id 
    });
    
    await ticketRepository.logAction(newTicket.id, 'CREATED', user.id, { categoryKey });
    await ticketRepository.setCooldown(user.id, guild.id, categoryKey, config.tickets.cooldownMs);

    // Identify roles to be notified and prepare the welcome message.
    const roleIdsToPing = JSON.parse(guildSettings.panelPingRoleIds ?? '[]');
    const pingMentions = roleIdsToPing.map((id) => `<@&${id}>`).join(' ');

    await ticketChannel.send({
      content: `${user} has opened a new ticket.\n${pingMentions}`.trim(),
      embeds: [ticketWelcomeEmbed(user, newTicket, categoryDisplayName)],
    });

    logger.info('[TicketService] New ticket successfully created', { 
      ticketId: newTicket.id, 
      guildId: guild.id, 
      userId: user.id 
    });
    
    return { ticket: newTicket, channel: ticketChannel };
  }

  /**
 * Close a ticket, generates a transcript, and deletes the channel after a short delay.
 * @param {Object} ticket - The ticket database record.
 * @param {TextChannel} channel - The Discord channel for the ticket.
 * @param {string} closedById - The ID of the user closing the ticket.
 * @param {string} [reason] - The reason for closing the ticket.
 */
  async closeTicket(ticket, channel, closedById, reason = 'No reason provided') {
    const sanitizedReason = sanitizeInput(reason, 256);

    const transcriptHtml = await generateTranscript(channel, ticket);
    const transcriptFile = new AttachmentBuilder(Buffer.from(transcriptHtml, 'utf-8'), {
      name: `transcript-${ticket.ticketNum}.html`,
    });

    const guildSettings = await db.getGuildConfig(ticket.guildId);
    if (guildSettings.logChannelId) {
      const logChannel = channel.guild.channels.cache.get(guildSettings.logChannelId);
      if (logChannel) {
        await logChannel.send({
          embeds: [successEmbed(
            `Ticket #${ticket.ticketNum} Closed`,
            `**Closed by:** <@${closedById}>\n**Reason:** ${sanitizedReason}\n**Category:** ${ticket.categoryKey}`
          )],
          files: [transcriptFile],
        });
      }
    }

    await channel.send({
      embeds: [warnEmbed('Closing Ticket', `This channel will be deleted in **5 seconds**.\nReason: ${sanitizedReason}`)],
    }).catch(() => {});

    await ticketRepository.close(ticket.id, closedById, sanitizedReason);
    await ticketRepository.logAction(ticket.id, 'CLOSED', closedById, { reason: sanitizedReason });

    setTimeout(() => {
      channel.delete(`Ticket closed by user ID: ${closedById}`).catch((err) => {
        logger.warn('[TicketService] Failed to delete channel after closing', { error: err.message });
      });
    }, 5000);

    return { success: true };
  }

  /*
 /=================/
       Ticket Customization and Management
 /=================/
*/

  /**
 * Update the priority level of a ticket and updates the channel name to reflect it.
 */
  async setPriority(ticket, channel, actorId, priorityLevel) {
    const priorityMeta = config.tickets.priorities[priorityLevel];
    if (!priorityMeta) return { error: 'Invalid priority level specified.' };

    await ticketRepository.update(ticket.id, { priority: priorityLevel });
    await ticketRepository.logAction(ticket.id, 'PRIORITY_CHANGED', actorId, { 
      from: ticket.priority, 
      to: priorityLevel 
    });

    const currentBaseName = channel.name.replace(/^[^-]+-/, '');
    const cleanEmoji = priorityMeta.emoji.replace(/\p{Emoji}/u, '');
    const newChannelName = `${cleanEmoji}-${currentBaseName}`.slice(0, 100);
    
    await channel.setName(newChannelName).catch(() => {
    });

    await channel.send({
      embeds: [successEmbed('Priority Updated', `Priority has been set to **${priorityMeta.emoji} ${priorityMeta.label}** by <@${actorId}>`)],
    });

    return { success: true };
  }

  /**
 * Assign a staff member to be responsible for a ticket.
 */
  async assignTicket(ticket, channel, actorId, assigneeId) {
    await ticketRepository.update(ticket.id, { assignedTo: assigneeId });
    await ticketRepository.logAction(ticket.id, 'ASSIGNED', actorId, { assignedTo: assigneeId });

    await channel.send({
      embeds: [successEmbed('Ticket Assigned', `This ticket has been assigned to <@${assigneeId}> by <@${actorId}>`)],
    });

    return { success: true };
  }

  /**
 * Reopen a closed ticket by creating a fresh channel linked to the previous ticket history.
 */
  async reopenTicket(guild, previousTicket, actor, reason = '') {
    const creationResult = await this.createTicket(guild, actor, previousTicket.categoryKey);
    if (creationResult.error) return creationResult;

    const sanitizedReason = reason ? `\nReason: ${sanitizeInput(reason)}` : '';
    await creationResult.channel.send({
      embeds: [successEmbed(
        'Ticket Reopened',
        `Continuing from ticket #${previousTicket.ticketNum}.${sanitizedReason}`
      )],
    });

    await ticketRepository.logAction(creationResult.ticket.id, 'REOPENED', actor.id, { 
      previousTicketId: previousTicket.id 
    });
    
    return creationResult;
  }

  /*
 /=================/
       Member Access Management
 /=================/
*/

  /**
 * Grant a user or role access to view and participate in a ticket channel.
 */
  async addMember(channel, targetId, isRole, actorId) {
    await channel.permissionOverwrites.create(targetId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    const targetMention = isRole ? `<@&${targetId}>` : `<@${targetId}>`;
    await channel.send({
      embeds: [successEmbed('Access Granted', `${targetMention} has been added to this ticket by <@${actorId}>`)],
    });

    return { success: true };
  }

  /**
 * Remove a user's access from a ticket channel.
 */
  async removeMember(channel, targetId, actorId) {
    await channel.permissionOverwrites.delete(targetId);

    await channel.send({
      embeds: [successEmbed('Access Revoked', `<@${targetId}> has been removed from this ticket by <@${actorId}>`)],
    });

    return { success: true };
  }
}
