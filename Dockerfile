FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

FROM node:20-alpine AS runtime
RUN addgroup -S botgroup && adduser -S botuser -G botgroup
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma       ./prisma
COPY src ./src
VOLUME ["/app/data", "/app/logs"]
ENV DATABASE_URL="file:/app/data/prod.db"
ENV NODE_ENV=production
USER botuser
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('fs').existsSync('/app/data/prod.db') || process.exit(1)"
CMD ["node", "src/index.js"]
