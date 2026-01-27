FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/whatsapp-webhook-service/package*.json ./services/whatsapp-webhook-service/
WORKDIR /app/services/whatsapp-webhook-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/whatsapp-webhook-service
COPY services/whatsapp-webhook-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/whatsapp-webhook-service
RUN npm ci --only=production
COPY services/whatsapp-webhook-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/whatsapp-webhook-service/node_modules ./services/whatsapp-webhook-service/node_modules
COPY --from=builder /app/services/whatsapp-webhook-service/src ./services/whatsapp-webhook-service/src
COPY --from=builder /app/services/whatsapp-webhook-service/package*.json ./services/whatsapp-webhook-service/

WORKDIR /app/services/whatsapp-webhook-service
EXPOSE 3009
CMD ["npm", "start"]
