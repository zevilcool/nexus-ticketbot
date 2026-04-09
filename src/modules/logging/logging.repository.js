import { db } from '../../database/prisma.service.js';

const orm = () => db.client;

export const logRepo = {
  // Cache a message so we can include its content in delete/edit logs later.
  // The TTL is configurable — longer means more storage but better coverage.
  async cacheMessage(message, ttlDays = 7) {
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

    const attachmentData = [...message.attachments.values()].map((a) => ({
      id: a.id, name: a.name, url: a.url, size: a.size,
    }));

    return orm().messageCache.upsert({
      where:  { messageId: message.id },
      create: {
        messageId:   message.id,
        channelId:   message.channelId,
        guildId:     message.guildId ?? 'DM',
        authorId:    message.author?.id ?? 'unknown',
        content:     message.content ?? '',
        attachments: JSON.stringify(attachmentData),
        embeds:      JSON.stringify(message.embeds?.map((e) => e.data) ?? []),
        stickers:    JSON.stringify([...(message.stickers?.values() ?? [])].map((s) => s.id)),
        expiresAt,
      },
      update: {
        content:     message.content ?? '',
        attachments: JSON.stringify(attachmentData),
        embeds:      JSON.stringify(message.embeds?.map((e) => e.data) ?? []),
        expiresAt,
      },
    });
  },

  async getCachedMessage(messageId) {
    return orm().messageCache.findUnique({ where: { messageId } });
  },

  // Run periodically to keep the cache table from growing forever.
  async purgeExpiredCache() {
    const result = await orm().messageCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return result.count;
  },

  async purgeOldLogs(retentionDays) {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const result = await orm().auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  },
};

// Alias with friendlier method names for use in the logging service.
export const loggingRepository = {
  cacheMessage:     (...args) => logRepo.cacheMessage(...args),
  getCachedMessage: (...args) => logRepo.getCachedMessage(...args),
  purgeExpiredCache: ()       => logRepo.purgeExpiredCache(),
  purgeOldLogs:     (...args) => logRepo.purgeOldLogs(...args),
};
