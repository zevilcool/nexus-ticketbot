import { db } from '../database/prisma.service.js';

/**
 * Generate a static HTML transcript of a Discord channel's conversation.
 * Fetches up to 500 messages and formats them into a readable document.
 * @param {TextChannel} channel - The Discord channel to transcribe.
 * @param {Object} ticket - The ticket record from the database.
 * @returns {Promise<string>} The complete HTML transcript as a string.
 */
export async function generateTranscript(channel, ticket) {
  const messageLog = [];
  let lastMessageId;

  // Fetch messages in batches of 100 to avoid hitting API limits.
  // We limit the total to 500 messages to keep file sizes manageable.
  for (let i = 0; i < 5; i++) {
    const fetchedBatch = await channel.messages.fetch({ 
      limit: 100, 
      before: lastMessageId 
    });
    
    if (fetchedBatch.size === 0) break;
    
    messageLog.push(...fetchedBatch.values());
    lastMessageId = fetchedBatch.last()?.id;
  }

  // Ensure the transcript is in chronological order (oldest to newest).
  messageLog.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const renderedMessages = messageLog.map((message) => {
    const escapedContent = escapeHtml(message.content || '');
    const authorAvatar = message.author.displayAvatarURL({ size: 32, extension: 'webp' });
    const formattedTimestamp = message.createdAt.toISOString().replace('T', ' ').substring(0, 19);
    const botBadge = message.author.bot ? '<span class="bot-badge">BOT</span>' : '';
    
    const attachmentLinks = message.attachments.size > 0
      ? [...message.attachments.values()]
          .map((file) => `<a href="${file.url}" target="_blank">${escapeHtml(file.name)}</a>`)
          .join(', ')
      : null;

    return `
      <div class="message-container">
        <img class="user-avatar" src="${authorAvatar}" alt="Avatar">
        <div class="message-body">
          <div class="message-header">
            <span class="user-name">${escapeHtml(message.author.tag)}</span>
            ${botBadge}
            <span class="message-time">${formattedTimestamp} UTC</span>
          </div>
          <div class="message-content">${escapedContent}</div>
          ${attachmentLinks ? `<div class="message-attachments">📎 ${attachmentLinks}</div>` : ''}
        </div>
      </div>`;
  }).join('\n');

  // Persist the transcript content to the database for future reference.
  try {
    await db.client.transcript.upsert({
      where: { ticketId: ticket.id },
      create: { ticketId: ticket.id, content: renderedMessages },
      update: { content: renderedMessages },
    });
  } catch (err) {
    // We don't want to fail the entire transcript generation if the DB save fails.
  }

  return assembleHtmlDocument(renderedMessages, ticket);
}

/**
 * Escape special characters in a string to prevent HTML injection.
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wrap the rendered messages in a complete HTML document with styling.
 */
function assembleHtmlDocument(content, ticket) {
  const ticketId = ticket.ticketNum ?? 'Unknown';
  const creationDate = ticket.createdAt.toISOString().replace('T', ' ').substring(0, 19);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript - Ticket #${ticketId}</title>
  <style>
    :root {
      --bg-color: #36393f;
      --text-color: #dcddde;
      --header-color: #ffffff;
      --meta-color: #72767d;
      --accent-color: #5865f2;
      --link-color: #00b0f4;
    }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background-color: var(--bg-color); 
      color: var(--text-color); 
      margin: 0; 
      padding: 24px; 
      line-height: 1.4;
    }
    .transcript-header { 
      border-bottom: 1px solid #4f545c;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { color: var(--header-color); margin: 0 0 8px 0; font-size: 1.5rem; }
    .metadata { font-size: 0.85rem; color: var(--meta-color); }
    .message-container { display: flex; gap: 16px; padding: 8px 0; }
    .message-container:hover { background-color: rgba(255, 255, 255, 0.02); }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .message-body { flex: 1; min-width: 0; }
    .message-header { margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .user-name { font-weight: 600; color: var(--header-color); }
    .bot-badge { 
      background-color: var(--accent-color); 
      color: white; 
      font-size: 0.65rem; 
      padding: 2px 4px; 
      border-radius: 3px; 
      font-weight: bold;
    }
    .message-time { font-size: 0.75rem; color: var(--meta-color); }
    .message-content { white-space: pre-wrap; word-break: break-word; font-size: 0.95rem; }
    .message-attachments { margin-top: 6px; font-size: 0.85rem; font-style: italic; }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="transcript-header">
    <h1>Support Ticket #${ticketId}</h1>
    <div class="metadata">
      <strong>Guild ID:</strong> ${ticket.guildId} | 
      <strong>Category:</strong> ${ticket.categoryKey} | 
      <strong>Opened:</strong> ${creationDate} UTC
    </div>
  </div>
  <div class="transcript-content">
    ${content}
  </div>
</body>
</html>`;
}
