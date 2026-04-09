import { Events, ActivityType } from 'discord.js';
import { InactivityManager } from '../modules/tickets/inactivity.manager.js';
import log from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    log.info(`[ready] Logged in as ${client.user.tag}`);

    client.user.setPresence({
      activities: [{ name: 'your ticketRepository', type: ActivityType.Watching }],
      status: 'online',
    });

    // Kick off the inactivity watcher and logging service.
    // These run on cron schedules — see their respective files for timing details.
    new InactivityManager(client).start();
    client.loggingService.start();

    log.info(`[ready] Serving ${client.guilds.cache.size} guild(s)`);
  },
};
