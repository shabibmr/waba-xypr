FROM node:20-alpine AS base
WORKDIR /app
# Shared is not used by tenant-service yet but keeping it for consistency in monorepo
# COPY shared ./shared 
COPY services/tenant-service/package*.json ./services/tenant-service/
WORKDIR /app/services/tenant-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/tenant-service
COPY services/tenant-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/tenant-service
RUN npm ci --only=production
COPY services/tenant-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
# COPY shared ./shared
COPY --from=builder /app/services/tenant-service/node_modules ./services/tenant-service/node_modules
COPY --from=builder /app/services/tenant-service/src ./services/tenant-service/src
COPY --from=builder /app/services/tenant-service/package*.json ./services/tenant-service/

WORKDIR /app/services/tenant-service
EXPOSE 3007
CMD ["npm", "start"]
