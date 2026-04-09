import { db } from '../database/prisma.service.js';

/**
 * Check if a member has staff or administrator permissions.
 * Members with the "Administrator" permission always pass.
 * @param {GuildMember} member - The member to check.
 * @returns {Promise<boolean>} True if the member is considered staff.
 */
export async function isStaff(member) {
  if (member.permissions.has('Administrator')) return true;

  const guildSettings = await db.getGuildConfig(member.guild.id);
  const staffRoleIds = JSON.parse(guildSettings.staffRoleIds);
  const adminRoleIds = JSON.parse(guildSettings.adminRoleIds);
  
  const authorizedRoleIds = [...staffRoleIds, ...adminRoleIds];

  return authorizedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Check if a member has administrator permissions.
 * Used for restricted configuration commands.
 * @param {GuildMember} member - The member to check.
 * @returns {Promise<boolean>} True if the member is considered an admin.
 */
export async function isAdmin(member) {
  if (member.permissions.has('Administrator')) return true;

  const guildSettings = await db.getGuildConfig(member.guild.id);
  const adminRoleIds = JSON.parse(guildSettings.adminRoleIds);
  
  return adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Generate the permission overwrites for a new ticket channel.
 * Restricts access to everyone except the ticket opener and authorized staff.
 * @param {Guild} guild - The Discord guild.
 * @param {User} user - The user who opened the ticket.
 * @returns {Promise<Array>} Array of permission overwrites.
 */
export async function buildTicketPermissions(guild, user) {
  const guildSettings = await db.getGuildConfig(guild.id);
  const staffRoleIds = JSON.parse(guildSettings.staffRoleIds);
  const adminRoleIds = JSON.parse(guildSettings.adminRoleIds);
  
  const authorizedStaffRoleIds = [...staffRoleIds, ...adminRoleIds];

  const permissionOverwrites = [
    // Lock out the @everyone role.
    { 
      id: guild.roles.everyone.id, 
      deny: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] 
    },
    // Grant access to the user who opened the ticket.
    { 
      id: user.id, 
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] 
    },
    // Grant access to all authorized staff roles.
    ...authorizedStaffRoleIds.map((roleId) => ({
      id: roleId,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks', 'ManageMessages'],
    })),
  ];

  return permissionOverwrites;
}

/**
 * Sanitize a string to be used as a Discord channel name.
 * Converts to lowercase and replaces invalid characters with hyphens.
 */
export const sanitizeChannelName = (inputString) => {
  return inputString
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 30);
};

/**
 * Sanitize user input to prevent basic formatting abuse.
 * Trims whitespace and strips angle brackets.
 */
export const sanitizeInput = (inputString, maxLength = 512) => {
  if (!inputString) return '';
  
  return String(inputString)
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
};
