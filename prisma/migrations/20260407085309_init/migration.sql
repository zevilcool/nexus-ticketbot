-- CreateTable
CREATE TABLE "guild_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "ticketCategoryId" TEXT,
    "logChannelId" TEXT,
    "modLogChannelId" TEXT,
    "staffRoleIds" TEXT NOT NULL DEFAULT '[]',
    "adminRoleIds" TEXT NOT NULL DEFAULT '[]',
    "panelPingRoleIds" TEXT NOT NULL DEFAULT '[]',
    "maxTicketsPerUser" INTEGER NOT NULL DEFAULT 3,
    "ticketCooldownMs" INTEGER NOT NULL DEFAULT 300000,
    "inactivityHours" INTEGER NOT NULL DEFAULT 48,
    "warnBeforeHours" INTEGER NOT NULL DEFAULT 12,
    "escalationHours" INTEGER NOT NULL DEFAULT 72,
    "cacheTtlDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNum" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "userId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "subject" TEXT,
    "closedAt" DATETIME,
    "closedBy" TEXT,
    "closeReason" TEXT,
    "warnedAt" DATETIME,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openerMsgCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ticket_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transcripts_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_cooldowns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "message_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "embeds" TEXT NOT NULL DEFAULT '[]',
    "stickers" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "targetType" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "channelId" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "guild_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "openTickets" INTEGER NOT NULL DEFAULT 0,
    "closedTickets" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "blacklists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "reason" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_guildId_key" ON "guild_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channelId_key" ON "tickets"("channelId");

-- CreateIndex
CREATE INDEX "tickets_guildId_status_idx" ON "tickets"("guildId", "status");

-- CreateIndex
CREATE INDEX "tickets_userId_guildId_idx" ON "tickets"("userId", "guildId");

-- CreateIndex
CREATE INDEX "tickets_channelId_idx" ON "tickets"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_guildId_ticketNum_key" ON "tickets"("guildId", "ticketNum");

-- CreateIndex
CREATE INDEX "ticket_notes_ticketId_idx" ON "ticket_notes"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_logs_ticketId_idx" ON "ticket_logs"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_ticketId_key" ON "transcripts"("ticketId");

-- CreateIndex
CREATE INDEX "user_cooldowns_expiresAt_idx" ON "user_cooldowns"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_cooldowns_userId_guildId_categoryKey_key" ON "user_cooldowns"("userId", "guildId", "categoryKey");

-- CreateIndex
CREATE UNIQUE INDEX "message_cache_messageId_key" ON "message_cache"("messageId");

-- CreateIndex
CREATE INDEX "message_cache_messageId_idx" ON "message_cache"("messageId");

-- CreateIndex
CREATE INDEX "message_cache_channelId_idx" ON "message_cache"("channelId");

-- CreateIndex
CREATE INDEX "message_cache_guildId_idx" ON "message_cache"("guildId");

-- CreateIndex
CREATE INDEX "message_cache_expiresAt_idx" ON "message_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_eventType_idx" ON "audit_logs"("guildId", "eventType");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_createdAt_idx" ON "audit_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_stats_guildId_key" ON "guild_stats"("guildId");

-- CreateIndex
CREATE INDEX "blacklists_guildId_idx" ON "blacklists"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "blacklists_userId_guildId_key" ON "blacklists"("userId", "guildId");
