import { PrismaClient } from '@prisma/client';
import log from '../utils/logger.js';

// Wraps PrismaClient so we get a single shared instance across the whole app.
// The client is created lazily on first access — no connection until we need it.
class Database {
  #client = null;

  get client() {
    if (!this.#client) {
      this.#client = new PrismaClient({
        log: [
          { level: 'warn',  emit: 'event' },
          { level: 'error', emit: 'event' },
        ],
      });
      this.#client.$on('warn',  (e) => log.warn('[db]',  { msg: e.message }));
      this.#client.$on('error', (e) => log.error('[db]', { msg: e.message }));
    }
    return this.#client;
  }

  async connect()    { await this.client.$connect(); log.info('[db] connected'); }
  async disconnect() { await this.client.$disconnect(); log.info('[db] disconnected'); }

  // Fetch (or create) a guild's config row. Safe to call before /setup is run —
  // it just returns defaults until the admin fills everything in.
  async getGuildConfig(guildId) {
    return this.client.guildConfig.upsert({
      where:  { guildId },
      create: { guildId },
      update: {},
    });
  }

  // Returns the next ticket number for a guild by looking at the highest existing one.
  // Simple and reliable — no separate counter table to keep in sync.
  async nextTicketNumber(guildId) {
    const latest = await this.client.ticket.findFirst({
      where:   { guildId },
      orderBy: { ticketNum: 'desc' },
      select:  { ticketNum: true },
    });
    return (latest?.ticketNum ?? 0) + 1;
  }
}

export const db = new Database();

// Direct accessor for the raw Prisma client, handy for one-off queries.
export const prisma = () => db.client;

// Legacy aliases — kept so older imports don't break while you migrate.
export { db as hanks, db as prismaService };
