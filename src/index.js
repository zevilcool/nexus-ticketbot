import { config } from './config.js';
import { BotClient } from './client.js';
import { db } from './database/prisma.service.js';
import { TicketService } from './modules/tickets/ticket.service.js';
import { LoggingService } from './modules/logging/logging.service.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { loadComponents } from './handlers/componentHandler.js';
import logger from './utils/logger.js';

async function bootstrapApplication() {
  logger.info('  Nexus — Ticket bot booting up  ');
  logger.info('  Please wait...');

  try {
    await db.connect();
    logger.info('[Database] Successfully connected');
  } catch (err) {
    logger.error('[Database] Connection failed during startup', { error: err.message });
    process.exit(1);
  }

  const client = new BotClient();

  client.ticketService = new TicketService(client);
  client.loggingService = new LoggingService(client);

  try {
    await Promise.all([
      loadCommands(client),
      loadComponents(client),
      loadEvents(client),
    ]);
    logger.info('[Loaders] All modules loaded successfully!');
  } catch (err) {
    logger.error('[Loaders] Failed to load one or more modules', { error: err.message });
    process.exit(1);
  }

  process.on('unhandledRejection', (reason) => {
    logger.error('[Process] Unhandled promise rejection detected', { 
      reason: reason instanceof Error ? reason.message : String(reason) 
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error('[Process] Uncaught exception occurred', { error: err.message });
    setTimeout(() => process.exit(1), 500);
  });

  const handleShutdown = async (signal) => {
    logger.info(`[Process] ${signal} received — initiating graceful shutdown`);
    
    if (client.loggingService) client.loggingService.stop();
    await db.disconnect();
    client.destroy();
    
    logger.info('[Process] Shutdown complete, exiting');
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  try {
    await client.login(config.discord.token);
    logger.info('[Discord] Successfully logged in and online');
  } catch (err) {
    logger.error('[Discord] Login failed — please check your token', { error: err.message });
    process.exit(1);
  }
}

bootstrapApplication().catch((err) => {
  console.error('[Boot] A fatal error occurred during the bootstrap process:', err);
  process.exit(1);
});
