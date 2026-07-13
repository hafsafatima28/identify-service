# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma's query engine needs OpenSSL, which Alpine doesn't ship by default.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL at runtime too.
RUN apk add --no-cache openssl

# Run as non-root user (alpine images ship a generic "node" user)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package*.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
