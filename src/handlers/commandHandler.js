import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import log from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client) {
  const baseDir = join(__dirname, '../commands');
  let count = 0;

  for (const folder of readdirSync(baseDir)) {
    const files = readdirSync(join(baseDir, folder)).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      const { default: command } = await import(`file://${join(baseDir, folder, file)}`);

      if (!command?.data || !command?.execute) {
        log.warn(`[commands] Skipping ${file} — missing data or execute`);
        continue;
      }

      client.commands.set(command.data.name, command);
      count++;
    }
  }

  log.info(`[commands] Loaded ${count} commands`);
}
