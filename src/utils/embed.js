import { EmbedBuilder } from 'discord.js';

export const COLORS = {
  PRIMARY: 0x5865F2,
  SUCCESS: 0x57F287,
  WARNING: 0xFEE75C,
  ERROR:   0xED4245,
  INFO:    0x5865F2,
  NEUTRAL: 0x4F545C,
};

// Creates a success embed with a green checkmark
export const successEmbed = (title, description) => 
  new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();

// Creates an error embed with a red cross mark
export const errorEmbed = (title, description) => 
  new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();

// Creates an informational embed with a blue info icon
export const infoEmbed = (title, description) => 
  new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();

// Creates a warning embed with a yellow warning triangle
export const warnEmbed = (title, description) => 
  new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();

/**
 * Create the welcome message when a ticket is opened
 * @param {any} user - Who opened the ticket
 * @param {any} ticket - Ticket data from Database
 * @param {any} categoryLabel - Category name
 * @param {any} priority - optional (label, emoji, color)
 */
export function ticketWelcomeEmbed(user, ticket, categoryLabel, priority) {
  const activePriority = priority ?? { color: 0xFEE75C, emoji: '🟡', label: 'Medium' };

  return new EmbedBuilder()
    .setColor(activePriority.color)
    .setTitle(`${activePriority.emoji} Ticket #${ticket.ticketNum} — ${categoryLabel}`)
    .setDescription(
      `Hello ${user}, your support ticket has been successfully opened.\n\n` +
      `A staff member will be with you as soon as possible. In the meantime, please describe your issue in detail.\n\n` +
      `**Quick Commands:**\n` +
      `• \`/close [reason]\` — Resolve and close this ticket\n` +
      `• \`/transcript\` — Request a copy of the chat log\n` +
      `• \`/priority\` — Update ticket urgency (Staff only)`
    )
    .addFields(
      { name: 'Category', value: categoryLabel, inline: true },
      { name: 'Priority', value: `${activePriority.emoji} ${activePriority.label}`, inline: true },
      { name: 'Status', value: '🟢 Active', inline: true }
    )
    .setFooter({ text: `Opened by ${user.tag}` })
    .setTimestamp();
}

/**
 * Build audit log / System notification message
 * @param {any} options - Config for Embed
 */
export function logEmbed({ title, description, color = COLORS.NEUTRAL, fields = [], footer, thumbnail }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }
  
  if (footer) {
    embed.setFooter({ text: footer });
  }
  
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}
