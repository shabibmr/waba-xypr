FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/inbound-transformer/package*.json ./services/inbound-transformer/
WORKDIR /app/services/inbound-transformer
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/inbound-transformer
COPY services/inbound-transformer .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/inbound-transformer
RUN npm ci --only=production
COPY services/inbound-transformer .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY --from=builder /app/services/inbound-transformer/node_modules ./services/inbound-transformer/node_modules
COPY --from=builder /app/services/inbound-transformer/src ./services/inbound-transformer/src
COPY --from=builder /app/services/inbound-transformer/package*.json ./services/inbound-transformer/

WORKDIR /app/services/inbound-transformer
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

CMD ["npm", "start"]
