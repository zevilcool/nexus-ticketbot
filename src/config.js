import 'dotenv/config';

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Configuration Error: Missing required environment variable "${key}"`);
  }
  return value;
};

const getOptionalEnv = (key, defaultValue) => {
  return process.env[key] ?? defaultValue;
};

const getIntegerEnv = (key, defaultValue) => {
  const rawValue = process.env[key];
  if (!rawValue) return defaultValue;
  
  const parsedValue = parseInt(rawValue, 10);
  if (isNaN(parsedValue)) {
    throw new Error(`Configuration Error: Environment variable "${key}" must be a valid integer`);
  }
  return parsedValue;
};

export const config = Object.freeze({
  discord: {
    token: getRequiredEnv('DISCORD_TOKEN'),
    clientId: getRequiredEnv('CLIENT_ID'),
    // If GUILD_ID is provided, commands will be registered only for that server (fast updates).
    // If null, commands are registered globally (can take up to an hour).
    guildId: getOptionalEnv('GUILD_ID', null),
  },

  database: {
    url: getRequiredEnv('DATABASE_URL'),
  },

  ticketRepository: {
    maxOpenPerUser: getIntegerEnv('MAX_TICKETS_PER_USER', 3),
    cooldownMs: getIntegerEnv('TICKET_COOLDOWN_MS', 300_000),
    inactivityHours: getIntegerEnv('INACTIVITY_HOURS', 24),
    warningHours: getIntegerEnv('WARN_BEFORE_HOURS', 12),
    escalationHours: getIntegerEnv('ESCALATION_HOURS', 72),

/*
    Support categories available for users to choose from. (to create new category copy and paste this: 
     { key: 'support', label: 'category_name_here', emoji: 'emoji_here' },
*/
    categories: [
      { key: 'support', label: '🛠️ General Support', emoji: '🛠️' },
      { key: 'bug_report', label: '🐛 Bug Report', emoji: '🐛' },
      { key: 'user_report', label: '🚨 User Report', emoji: '🚨' },
      { key: 'feature_request', label: '💡 Feature Request', emoji: '💡' },
      { key: 'billing', label: '💳 Billing', emoji: '💳' },
    ],

    // Priority levels for ticketRepository.
    priorities: {
      LOW: { label: 'Low', emoji: '🟢', color: 0x57F287 },
      MEDIUM: { label: 'Medium', emoji: '🟡', color: 0xFEE75C },
      HIGH: { label: 'High', emoji: '🟠', color: 0xE67E22 },
      URGENT: { label: 'Urgent', emoji: '🔴', color: 0xED4245 },
    },
  },

  logging: {
    messageCacheTtlDays: getIntegerEnv('MESSAGE_CACHE_TTL_DAYS', 7),
    dbBatchIntervalMs: getIntegerEnv('LOG_BATCH_INTERVAL_MS', 2000),
    logRetentionDays: getIntegerEnv('LOG_RETENTION_DAYS', 90),
    webhookUrl: getOptionalEnv('LOG_WEBHOOK_URL', null),
    moderatorWebhookUrl: getOptionalEnv('MOD_LOG_WEBHOOK_URL', null),
  },

  environment: {
    nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
    isDevelopment: getOptionalEnv('NODE_ENV', 'development') === 'development',
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  },
});
