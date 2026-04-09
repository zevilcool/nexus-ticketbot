import { REST, Routes } from 'discord.js';
import { readdirSync }  from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import log from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Registers slash commands with Discord.
// If GUILD_ID is set in .env, commands are deployed to that guild only (instant).
// Without it, commands go global — useful for production but takes up to an hour to show up.
async function deploy() {
  const commandDir = join(__dirname, 'commands');
  const body       = [];

  for (const folder of readdirSync(commandDir)) {
    for (const file of readdirSync(join(commandDir, folder)).filter((f) => f.endsWith('.js'))) {
      const { default: cmd } = await import(`file://${join(commandDir, folder, file)}`);
      if (cmd?.data) body.push(cmd.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  if (config.discord.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body }
    );
    log.info(`[deploy] Registered ${body.length} commands to guild ${config.discord.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    log.info(`[deploy] Registered ${body.length} commands globally`);
  }
}

deploy().catch((err) => {
  log.error('[deploy] Failed to register commands', { error: err.message });
  process.exit(1);
});
