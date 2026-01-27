FROM node:20-alpine AS base
WORKDIR /app
# COPY shared ./shared
COPY services/webhook-handler/package*.json ./services/webhook-handler/
WORKDIR /app/services/webhook-handler
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/webhook-handler
COPY services/webhook-handler .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/webhook-handler
RUN npm ci --only=production
COPY services/webhook-handler .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
# COPY shared ./shared
COPY --from=builder /app/services/webhook-handler/node_modules ./services/webhook-handler/node_modules
COPY --from=builder /app/services/webhook-handler/src ./services/webhook-handler/src
COPY --from=builder /app/services/webhook-handler/package*.json ./services/webhook-handler/

WORKDIR /app/services/webhook-handler
EXPOSE 3001
CMD ["npm", "start"]
