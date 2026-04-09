import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isStaff } from '../../utils/permissions.js';
import { COLORS } from '../../utils/embed.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),

  async execute(client, interaction) {
    const staffMember = await isStaff(interaction.member);

    const ticketField = {
      name:  'Tickets',
      value: [
        '`/add` — add a user or role to this ticket',
        '`/remove` — remove a user or role from this ticket',
        '`/close` — close this ticket',
        '`/reopen` — reopen a closed ticket by number',
        '`/rename` — rename the ticket channel',
        '`/assign` — assign a staff member to this ticket',
        '`/priority` — set the ticket priority',
        '`/note` — add a private staff note',
        '`/transcript` — download a transcript of this ticket',
      ].join('\n'),
    };

    // Only show staff commands to people who actually have access to them.
    const staffField = {
      name:  'Staff Only',
      value: [
        '`/panel` — post the ticket panel in a channel',
        '`/setup` — configure the bot for this server',
        '`/blacklist add` — block a user from opening ticketRepository',
        '`/blacklist remove` — unblock a user',
        '`/blacklist list` — view all blacklisted users',
      ].join('\n'),
    };

    const fields = staffMember ? [ticketField, staffField] : [ticketField];

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('Commands')
      .setDescription('Here\'s what you can do:')
      .addFields(fields)
      .setFooter({ text: 'Staff commands require the staff role configured via /setup' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
