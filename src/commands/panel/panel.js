import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { errorEmbed } from '../../utils/embed.js';
import { isStaff } from '../../utils/permissions.js';
import { db } from '../../database/prisma.service.js';

const parseRoleIds = (input, guild) =>
  [...input.matchAll(/(?:<@&)?(\d{17,20})>?/g)]
    .map((m) => m[1])
    .filter((id) => guild.roles.cache.has(id));

export default {
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post the ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('ping_roles').setDescription('Roles to ping when a ticket is opened — @mention as many as you need').setRequired(true))
    .addStringOption((o) => o.setName('title').setDescription('Panel title (optional)').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('Panel description (optional)').setRequired(false)),

  async execute(client, interaction) {
    if (!(await isStaff(interaction.member))) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', 'Staff only.')], ephemeral: true });
    }

    const pingRoleIds = parseRoleIds(interaction.options.getString('ping_roles'), interaction.guild);
    if (!pingRoleIds.length) {
      return interaction.reply({
        embeds:    [errorEmbed('Invalid Roles', 'No valid roles found. Mention them directly, e.g. @Support')],
        ephemeral: true,
      });
    }

    const title       = interaction.options.getString('title')       ?? '🎫 Support Center';
    const description = interaction.options.getString('description') ?? 'Need help? Click below to open a support ticket.';

    // Save the ping role IDs so the ticket creation flow knows who to mention.
    await db.client.guildConfig.upsert({
      where:  { guildId: interaction.guildId },
      create: { guildId: interaction.guildId, panelPingRoleIds: JSON.stringify(pingRoleIds) },
      update: { panelPingRoleIds: JSON.stringify(pingRoleIds) },
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: 'You can only have a limited number of open ticketRepository at a time.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_ticket_panel')
        .setLabel('Open a Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      embeds:    [{ color: 0x57F287, description: `✅ Panel posted. Pinging: ${pingRoleIds.map((id) => `<@&${id}>`).join(', ')}` }],
      ephemeral: true,
    });
  },
};
