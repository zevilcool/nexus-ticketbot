import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embed.js';
import { sanitizeInput } from '../../utils/permissions.js';
import { db } from '../../database/prisma.service.js';

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('reopen')
    .setDescription('Reopen a closed ticket by its number')
    .addIntegerOption((o) => o.setName('ticket_num').setDescription('Ticket number').setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for reopening').setMaxLength(256)),

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const num    = interaction.options.getInteger('ticket_num');
    const reason = sanitizeInput(interaction.options.getString('reason') ?? '');

    const closed = await db.client.ticket.findFirst({
      where: { guildId: interaction.guildId, ticketNum: num, status: 'CLOSED' },
    });

    if (!closed) {
      return interaction.editReply({ embeds: [errorEmbed('Not Found', `No closed ticket #${num} found.`)] });
    }

    const owner  = await interaction.client.users.fetch(closed.userId).catch(() => interaction.user);
    const result = await client.ticketService.reopenTicket(interaction.guild, closed, owner, reason);

    if (result.error) return interaction.editReply({ embeds: [errorEmbed('Cannot Reopen', result.error)] });

    return interaction.editReply({
      embeds: [successEmbed('Reopened', `Ticket #${closed.ticketNum} reopened as ${result.channel}.`)],
    });
  },
};
