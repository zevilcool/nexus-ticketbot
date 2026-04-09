import cron from 'node-cron';
import { WebhookClient } from 'discord.js';
import { loggingRepository } from './logging.repository.js';
import { logEmbed, COLORS } from '../../utils/embed.js';
import { db } from '../../database/prisma.service.js';
import { config } from '../../config.js';
import logger from '../../utils/logger.js';

/**
 * Event that should be sent to the moderator log instead of general logs.
 */
const MODERATOR_ONLY_EVENTS = new Set(['MEMBER_BAN', 'MEMBER_UNBAN', 'MEMBER_TIMEOUT']);

/**
 * Human-friendly names for Discord channel types.
 */
const CHANNEL_TYPE_LABELS = {
  0: 'Text Channel',
  2: 'Voice Channel',
  4: 'Category',
  5: 'Announcement Channel',
  13: 'Stage Channel',
  15: 'Forum Channel',
};

// Internal state for lazy-loaded webhook clients.
let generalLogWebhook = null;
let moderatorLogWebhook = null;

/**
 * Initialize and returns the general log webhook client if configured.
 */
const getGeneralLogWebhook = () => {
  if (config.logging.webhookUrl && !generalLogWebhook) {
    generalLogWebhook = new WebhookClient({ url: config.logging.webhookUrl });
  }
  return generalLogWebhook;
};

/**
 * Initialize and returns the moderator log webhook client if configured.
 */
const getModeratorLogWebhook = () => {
  if (config.logging.moderatorWebhookUrl && !moderatorLogWebhook) {
    moderatorLogWebhook = new WebhookClient({ url: config.logging.moderatorWebhookUrl });
  }
  return moderatorLogWebhook;
};

export class LoggingService {
  #logQueue = [];
  #flushInterval = null;

  constructor(client) {
    this.client = client;
  }

  /**
 * Start the logging service, including periodic database flushing and maintenance tasks.
 */
  start() {
    // Periodically flush the log queue to the database to reduce write operations.
    this.#flushInterval = setInterval(
      () => this.#flushQueueToDatabase(),
      config.logging.dbBatchIntervalMs
    );

    cron.schedule('0 3 * * *', () => this.#performMaintenance());

    logger.info('[LoggingService] Service initialized and running');
  }

  /**
 * Stop the logging service and clears the flush interval.
 */
  stop() {
    if (this.#flushInterval) {
      clearInterval(this.#flushInterval);
      this.#flushInterval = null;
    }
  }

  /**
 * Queue a log entry and immediately sends the embed to the appropriate Discord channel.
 * @param {Object} entry - The log entry data.
 */
  log(entry) {
    this.#logQueue.push(entry);

    if (entry.embed && entry.guildId) {
      const isModEvent = MODERATOR_ONLY_EVENTS.has(entry.eventType);
      this.#dispatchEmbed(entry.guildId, entry.embed, isModEvent).catch((err) =>
        logger.error('[LoggingService] Failed to dispatch log embed', { error: err.message })
      );
    }
  }

  /**
 * Cache a message for later retrieval (e.g., to show content in delete/edit logs).
 * @param {Message} message - The Discord message to cache.
 */
  async cacheMessage(message) {
    if (!message.guild || message.author?.bot) return;
    try {
      await loggingRepository.cacheMessage(message, config.logging.messageCacheTtlDays);
    } catch (err) {
      // Silently fail cache operations to avoid interrupting message flow.
    }
  }

  /**
 * Retrieve a previously cached message by its ID.
 * @param {string} messageId - The ID of the message to retrieve.
 */
  async getCachedMessage(messageId) {
    return loggingRepository.getCachedMessage(messageId);
  }

  /**
 * Send a log embed to the configured channel or webhook.
 * @private
 */
  async #dispatchEmbed(guildId, embed, isModeratorLog = false) {
    const webhook = isModeratorLog ? getModeratorLogWebhook() : getGeneralLogWebhook();
    
    if (webhook) {
      try {
        await webhook.send({ embeds: [embed] });
        return;
      } catch (err) {
        logger.warn('[LoggingService] Webhook delivery failed, falling back to channel delivery', { error: err.message });
      }
    }

    const guildSettings = await db.getGuildConfig(guildId);
    const targetChannelId = isModeratorLog ? guildSettings.modLogChannelId : guildSettings.logChannelId;
    
    if (!targetChannelId) return;

    const channel = this.client.channels.cache.get(targetChannelId);
    if (!channel) return;

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      // Ignore delivery errors if the bot lacks permissions or the channel is missing.
    }
  }

  /**
 * Flushe all queued log entries to the database in a single batch.
 * @private
 */
  async #flushQueueToDatabase() {
    if (this.#logQueue.length === 0) return;

    const currentBatch = this.#logQueue.splice(0);

    try {
      await db.client.auditLog.createMany({
        data: currentBatch.map(({ embed, ...entry }) => ({
          guildId: entry.guildId,
          eventType: entry.eventType,
          actorId: entry.actorId ?? null,
          targetId: entry.targetId ?? null,
          targetType: entry.targetType ?? null,
          details: JSON.stringify(entry.details ?? {}),
          channelId: entry.channelId ?? null,
          messageId: entry.messageId ?? null,
        })),
      });
    } catch (err) {
      logger.error('[LoggingService] Failed to flush log batch to database', { error: err.message });
      // Re-queue the failed batch at the beginning to retry later.
      this.#logQueue.unshift(...currentBatch);
    }
  }

  /**
 * Run maintenance tasks like purging old logs and clearing expired message caches.
 * @private
 */
  async #performMaintenance() {
    try {
      const purgedCacheCount = await loggingRepository.purgeExpiredCache();
      const purgedLogsCount = await loggingRepository.purgeOldLogs(config.logging.logRetentionDays);
      logger.info('[LoggingService] Maintenance completed successfully', { purgedCacheCount, purgedLogsCount });
    } catch (err) {
      logger.error('[LoggingService] Error during maintenance tasks', { error: err.message });
    }
  }

  /*
 /=================/
       Log Embed Builders
 /=================/
*/

  buildMessageDeleteEmbed({ cached, message }) {
    const content = cached?.content || '*Content was not found in cache*';
    const authorMention = cached?.authorId ? `<@${cached.authorId}>` : '*Unknown User*';
    
    let attachmentsText = null;
    if (cached?.attachments) {
      try {
        attachmentsText = JSON.parse(cached.attachments)
          .map((file) => `[${file.name}](${file.url})`)
          .join('\n');
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return logEmbed({
      title: '🗑️ Message Deleted',
      description: `**Author:** ${authorMention}\n**Channel:** <#${message.channelId}>\n\n${content.slice(0, 1800)}`,
      color: COLORS.ERROR,
      fields: [
        ...(attachmentsText ? [{ name: '📎 Attachments', value: attachmentsText, inline: false }] : []),
        { name: 'Message ID', value: message.id, inline: true },
      ],
      footer: `Message ID: ${message.id}`,
    });
  }

  buildMessageUpdateEmbed({ cached, newMessage }) {
    const originalContent = cached?.content || '*Original content not cached*';
    const updatedContent = newMessage.content || '*Message content is empty*';
    
    if (originalContent === updatedContent) return null;

    const messageLink = `https://discord.com/channels/${newMessage.guildId}/${newMessage.channelId}/${newMessage.id}`;

    return logEmbed({
      title: '✏️ Message Edited',
      description: `**Author:** <@${newMessage.author?.id}>\n**Channel:** <#${newMessage.channelId}>\n[Jump to message](${messageLink})`,
      color: COLORS.WARNING,
      fields: [
        { name: '📝 Before', value: originalContent.slice(0, 1024) || '*Empty*', inline: false },
        { name: '📝 After', value: updatedContent.slice(0, 1024) || '*Empty*', inline: false },
      ],
      footer: `Message ID: ${newMessage.id}`,
    });
  }

  buildMemberJoinEmbed(member) {
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const isNewAccount = accountAgeDays < 7;

    return logEmbed({
      title: '📥 Member Joined',
      description: `${member} (${member.user.tag})${isNewAccount ? '\n⚠️ **New account — potential risk**' : ''}`,
      color: isNewAccount ? COLORS.WARNING : COLORS.SUCCESS,
      fields: [
        { name: '📅 Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🗓️ Account Age', value: `${accountAgeDays} days`, inline: true },
        { name: '👥 Total Members', value: `${member.guild.memberCount}`, inline: true },
      ],
      thumbnail: member.user.displayAvatarURL({ size: 128 }),
      footer: `User ID: ${member.id}`,
    });
  }

  buildMemberLeaveEmbed(member) {
    const joinTime = member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : '*Unknown*';

    const rolesList = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => `<@&${role.id}>`)
      .join(', ') || '*No roles assigned*';

    return logEmbed({
      title: '📤 Member Left',
      description: `**${member.user.tag}** has left the server.`,
      color: COLORS.ERROR,
      fields: [
        { name: '📅 Joined', value: joinTime, inline: true },
        { name: '🏷️ Roles', value: rolesList.slice(0, 1024), inline: false },
      ],
      thumbnail: member.user.displayAvatarURL({ size: 128 }),
      footer: `User ID: ${member.id}`,
    });
  }

  buildBanEmbed(guild, user, moderator = null, reason = null) {
    return logEmbed({
      title: '🔨 Member Banned',
      description: `**${user.tag}** was banned.`,
      color: COLORS.ERROR,
      fields: [
        { name: '👮 Moderator', value: moderator ? `<@${moderator.id}>` : '*Unknown*', inline: true },
        { name: '📋 Reason', value: reason ?? '*No reason provided*', inline: false },
      ],
      thumbnail: user.displayAvatarURL({ size: 128 }),
      footer: `User ID: ${user.id}`,
    });
  }

  buildUnbanEmbed(guild, user, moderator = null) {
    return logEmbed({
      title: '✅ Member Unbanned',
      description: `**${user.tag}** was unbanned.`,
      color: COLORS.SUCCESS,
      fields: [
        { name: '👮 Moderator', value: moderator ? `<@${moderator.id}>` : '*Unknown*', inline: true },
      ],
      thumbnail: user.displayAvatarURL({ size: 128 }),
      footer: `User ID: ${user.id}`,
    });
  }

  buildVoiceEmbed(oldState, newState) {
    const member = newState.member ?? oldState.member;
    const hasJoined = !oldState.channelId && newState.channelId;
    const hasLeft = oldState.channelId && !newState.channelId;
    const hasMoved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    // Handle state changes (mute, deafen, etc.) within the same channel
    if (!hasJoined && !hasLeft && !hasMoved) {
      const stateChanges = [];
      if (oldState.selfMute !== newState.selfMute) stateChanges.push(newState.selfMute ? '🔇 self-muted' : '🔊 self-unmuted');
      if (oldState.selfDeaf !== newState.selfDeaf) stateChanges.push(newState.selfDeaf ? '🙉 self-deafened' : '👂 self-undeafened');
      if (oldState.streaming !== newState.streaming) stateChanges.push(newState.streaming ? '📡 stream started' : '📡 stream stopped');
      if (oldState.selfVideo !== newState.selfVideo) stateChanges.push(newState.selfVideo ? '📷 camera on' : '📷 camera off');
      if (oldState.serverMute !== newState.serverMute) stateChanges.push(newState.serverMute ? '🔇 server muted' : '🔊 server unmuted');
      if (oldState.serverDeaf !== newState.serverDeaf) stateChanges.push(newState.serverDeaf ? '🙉 server deafened' : '👂 server undeafened');
      
      if (stateChanges.length === 0) return null;

      return logEmbed({
        title: '🎙️ Voice State Updated',
        description: `${member} in <#${newState.channelId ?? oldState.channelId}>\n${stateChanges.join('\n')}`,
        color: COLORS.NEUTRAL,
        footer: `User ID: ${member?.id}`,
      });
    }

    const title = hasJoined ? '🔊 Joined Voice' : hasLeft ? '🔇 Left Voice' : '🔀 Moved Voice';
    const description = hasJoined
      ? `${member} joined <#${newState.channelId}>`
      : hasLeft
      ? `${member} left <#${oldState.channelId}>`
      : `${member} moved from <#${oldState.channelId}> to <#${newState.channelId}>`;

    return logEmbed({
      title,
      description,
      color: hasJoined ? COLORS.SUCCESS : COLORS.ERROR,
      footer: `User ID: ${member?.id}`,
    });
  }

  buildChannelCreateEmbed(channel) {
    return logEmbed({
      title: '📂 Channel Created',
      description: channel.url ? `${channel} (\`${channel.name}\`)` : `\`${channel.name}\``,
      color: COLORS.SUCCESS,
      fields: [
        { name: 'Type', value: CHANNEL_TYPE_LABELS[channel.type] ?? `Type ${channel.type}`, inline: true },
        { name: 'Category', value: channel.parent?.name ?? '*No Category*', inline: true },
      ],
      footer: `Channel ID: ${channel.id}`,
    });
  }

  buildChannelDeleteEmbed(channel) {
    return logEmbed({
      title: '🗑️ Channel Deleted',
      description: `\`${channel.name}\``,
      color: COLORS.ERROR,
      fields: [
        { name: 'Type', value: CHANNEL_TYPE_LABELS[channel.type] ?? `Type ${channel.type}`, inline: true },
        { name: 'Category', value: channel.parent?.name ?? '*No Category*', inline: true },
      ],
      footer: `Channel ID: ${channel.id}`,
    });
  }

  buildChannelUpdateEmbed(oldChannel, newChannel) {
    const updateFields = [];

    if (oldChannel.name !== newChannel.name) {
      updateFields.push({ name: '📝 Name', value: `\`${oldChannel.name}\` → \`${newChannel.name}\``, inline: false });
    }
    if (oldChannel.topic !== newChannel.topic) {
      updateFields.push({ name: '📋 Topic', value: `${oldChannel.topic || '*No topic*'} → ${newChannel.topic || '*No topic*'}`, inline: false });
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      updateFields.push({ name: '🔞 NSFW', value: newChannel.nsfw ? 'Enabled' : 'Disabled', inline: true });
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      updateFields.push({ name: '⏱️ Slowmode', value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`, inline: true });
    }
    if (oldChannel.bitrate !== undefined && oldChannel.bitrate !== newChannel.bitrate) {
      updateFields.push({ name: '🔊 Bitrate', value: `${oldChannel.bitrate / 1000}kbps → ${newChannel.bitrate / 1000}kbps`, inline: true });
    }
    if (oldChannel.userLimit !== undefined && oldChannel.userLimit !== newChannel.userLimit) {
      updateFields.push({ name: '👥 User Limit', value: `${oldChannel.userLimit || 'Unlimited'} → ${newChannel.userLimit || 'Unlimited'}`, inline: true });
    }

    if (updateFields.length === 0) return null;

    return logEmbed({
      title: '✏️ Channel Updated',
      description: `${newChannel} (\`${newChannel.name}\`)`,
      color: COLORS.WARNING,
      fields: updateFields,
      footer: `Channel ID: ${newChannel.id}`,
    });
  }

  buildMemberUpdateEmbed(oldMember, newMember, changes, fields) {
    const isTimeout = !oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil;

    return logEmbed({
      title: '👤 Member Updated',
      description: `${newMember} (${newMember.user.tag})`,
      color: isTimeout ? COLORS.WARNING : COLORS.INFO,
      fields,
      thumbnail: newMember.user.displayAvatarURL({ size: 128 }),
      footer: `User ID: ${newMember.id}`,
    });
  }
}
