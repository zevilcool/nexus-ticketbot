import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import log from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loads and registers all event listeners from the events/ directory.
// The client is always passed as the first argument so handlers don't need to import it themselves.
export async function loadEvents(client) {
  const baseDir = join(__dirname, '../events');
  let count = 0;

  for (const file of readdirSync(baseDir).filter((f) => f.endsWith('.js'))) {
    const { default: event } = await import(`file://${join(baseDir, file)}`);

    if (!event?.name || !event?.execute) {
      log.warn(`[events] Skipping ${file} — missing name or execute`);
      continue;
    }

    // `once` events fire exactly once (e.g. ClientReady).
    // Everything else uses `on` and fires every time.
    const handler = (...args) => event.execute(client, ...args);
    event.once ? client.once(event.name, handler) : client.on(event.name, handler);
    count++;
  }

  log.info(`[events] Registered ${count} listeners`);
}
