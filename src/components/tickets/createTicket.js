import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { config } from '../../config.js';
import { errorEmbed, infoEmbed } from '../../utils/embed.js';

// The "Open a Ticket" button on the panel. Shows a category select menu.
export const openTicketButton = {
  customId: 'open_ticket_panel',

  async execute(client, interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Choose a category…')
      .addOptions(
        config.tickets.categories.map((cat) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setValue(cat.key)
            .setEmoji(cat.emoji)
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      embeds:     [infoEmbed('Open a Ticket', 'Pick the category that best fits your issue.')],
      components: [row],
      ephemeral:  true,
    });
  },
};

// Handles the category selection and kicks off ticket creation.
export const ticketCategorySelect = {
  customId: 'ticket_category_select',

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const categoryKey = interaction.values[0];
    const result      = await client.ticketService.createTicket(interaction.guild, interaction.user, categoryKey);

    if (result.error) {
      return interaction.editReply({ embeds: [errorEmbed('Cannot Open Ticket', result.error)] });
    }

    return interaction.editReply({
      embeds: [{ color: 0x57F287, description: `✅ Ticket created: ${result.channel}` }],
    });
  },
};

export default openTicketButton;
