FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/genesys-webhook-service/package*.json ./services/genesys-webhook-service/
WORKDIR /app/services/genesys-webhook-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/genesys-webhook-service
COPY services/genesys-webhook-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/genesys-webhook-service
RUN npm ci --only=production
COPY services/genesys-webhook-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/genesys-webhook-service/node_modules ./services/genesys-webhook-service/node_modules
COPY --from=builder /app/services/genesys-webhook-service/src ./services/genesys-webhook-service/src
COPY --from=builder /app/services/genesys-webhook-service/package*.json ./services/genesys-webhook-service/

WORKDIR /app/services/genesys-webhook-service
EXPOSE 3011

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3011/health || exit 1

CMD ["npm", "start"]
