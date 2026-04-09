import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { db } from '../../database/prisma.service.js';
import { successEmbed, errorEmbed } from '../../utils/embed.js';

// Pulls valid role IDs out of a string of @mentions or raw snowflakes.
// Filters to only roles that actually exist in the guild.
const parseRoleIds = (input, guild) =>
  [...input.matchAll(/(?:<@&)?(\d{17,20})>?/g)]
    .map((m) => m[1])
    .filter((id) => guild.roles.cache.has(id));

export default {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) => o.setName('ticket_category').setDescription('Category channel where ticket channels will be created').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addChannelOption((o) => o.setName('log_channel').setDescription('Channel for general logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('mod_log_channel').setDescription('Channel for moderation logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption((o) => o.setName('staff_roles').setDescription('Staff roles — @mention as many as you need').setRequired(true))
    .addStringOption((o) => o.setName('admin_roles').setDescription('Admin roles — @mention as many as you need').setRequired(true)),

  async execute(client, interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [errorEmbed('Access Denied', 'Admin only.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketCategory = interaction.options.getChannel('ticket_category');
      const logChannel     = interaction.options.getChannel('log_channel');
      const modLogChannel  = interaction.options.getChannel('mod_log_channel');
      const staffRoleIds   = parseRoleIds(interaction.options.getString('staff_roles'), interaction.guild);
      const adminRoleIds   = parseRoleIds(interaction.options.getString('admin_roles'), interaction.guild);

      if (!staffRoleIds.length) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid Staff Roles', 'No valid roles found. Mention them directly, e.g. @Support @Moderator')] });
      }
      if (!adminRoleIds.length) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid Admin Roles', 'No valid roles found. Mention them directly, e.g. @Admin')] });
      }

      await db.client.guildConfig.upsert({
        where:  { guildId: interaction.guildId },
        create: {
          guildId:         interaction.guildId,
          ticketCategoryId: ticketCategory.id,
          logChannelId:    logChannel.id,
          modLogChannelId: modLogChannel.id,
          staffRoleIds:    JSON.stringify(staffRoleIds),
          adminRoleIds:    JSON.stringify(adminRoleIds),
        },
        update: {
          ticketCategoryId: ticketCategory.id,
          logChannelId:    logChannel.id,
          modLogChannelId: modLogChannel.id,
          staffRoleIds:    JSON.stringify(staffRoleIds),
          adminRoleIds:    JSON.stringify(adminRoleIds),
        },
      });

      return interaction.editReply({
        embeds: [
          successEmbed('Setup Complete', 'The bot is configured and ready.')
            .addFields(
              { name: '🎫 Ticket Category', value: `<#${ticketCategory.id}>`,                           inline: true },
              { name: '📋 Log Channel',     value: `<#${logChannel.id}>`,                               inline: true },
              { name: '🔨 Mod Log',         value: `<#${modLogChannel.id}>`,                            inline: true },
              { name: '🛡️ Staff Roles',    value: staffRoleIds.map((id) => `<@&${id}>`).join(', '),   inline: false },
              { name: '⚙️ Admin Roles',    value: adminRoleIds.map((id) => `<@&${id}>`).join(', '),   inline: false }
            )
            .setFooter({ text: 'Run /setup again to update any of these settings.' }),
        ],
      });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Setup Failed', err.message)] });
    }
  },
};
