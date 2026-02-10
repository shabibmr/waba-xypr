FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/whatsapp-api-service/package*.json ./services/whatsapp-api-service/
WORKDIR /app/services/whatsapp-api-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/whatsapp-api-service
COPY services/whatsapp-api-service .
ENV NODE_PATH=/app/services/whatsapp-api-service/node_modules
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/whatsapp-api-service
RUN npm ci --only=production
COPY services/whatsapp-api-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/whatsapp-api-service/node_modules ./services/whatsapp-api-service/node_modules
COPY --from=builder /app/services/whatsapp-api-service/src ./services/whatsapp-api-service/src
COPY --from=builder /app/services/whatsapp-api-service/package*.json ./services/whatsapp-api-service/

WORKDIR /app/services/whatsapp-api-service
EXPOSE 3008
CMD ["npm", "start"]
