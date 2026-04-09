import { Events } from 'discord.js';
import { isStaff } from '../utils/permissions.js';
import { errorEmbed } from '../utils/embed.js';
import log from '../utils/logger.js';

export default {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (command.staffOnly && !(await isStaff(interaction.member))) {
          return interaction.reply({ embeds: [errorEmbed('Access Denied', 'This command is for staff only.')], ephemeral: true });
        }

        await command.execute(client, interaction);

        // Log the slash command usage to the audit trail.
        client.loggingService.log({
          guildId:   interaction.guildId,
          eventType: 'SLASH_COMMAND',
          actorId:   interaction.user.id,
          details:   { command: interaction.commandName },
          channelId: interaction.channelId,
        });

        return;
      }

      // Buttons and select menus
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const [baseId] = interaction.customId.split(':');
        const handler  = client.components.get(baseId) ?? client.components.get(interaction.customId);

        if (!handler) {
          log.warn(`[interactions] No handler found for: ${interaction.customId}`);
          return;
        }

        await handler.execute(client, interaction);
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(client, interaction);
        return;
      }
    } catch (err) {
      log.error('[interactions] Error handling interaction', {
        error:   err.message,
        command: interaction.commandName ?? interaction.customId,
      });

      const reply = {
        embeds:    [errorEmbed('Unexpected Error', 'Something went wrong. Please try again.')],
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
};
