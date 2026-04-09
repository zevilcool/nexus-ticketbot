import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import log from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same pattern as commandHandler, but for buttons and select menus.
export async function loadComponents(client) {
  const baseDir = join(__dirname, '../components');
  let count = 0;

  for (const folder of readdirSync(baseDir)) {
    const files = readdirSync(join(baseDir, folder)).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      const { default: component } = await import(`file://${join(baseDir, folder, file)}`);

      if (!component?.customId || !component?.execute) {
        log.warn(`[components] Skipping ${file} — missing customId or execute`);
        continue;
      }

      client.components.set(component.customId, component);
      count++;
    }
  }

  log.info(`[components] Loaded ${count} component handlers`);
}
