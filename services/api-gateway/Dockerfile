FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/api-gateway/package*.json ./services/api-gateway/
WORKDIR /app/services/api-gateway
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/api-gateway
COPY services/api-gateway .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/api-gateway
RUN npm ci --only=production
COPY services/api-gateway .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/api-gateway/node_modules ./services/api-gateway/node_modules
COPY --from=builder /app/services/api-gateway/src ./services/api-gateway/src
COPY --from=builder /app/services/api-gateway/package*.json ./services/api-gateway/

WORKDIR /app/services/api-gateway
EXPOSE 3000
CMD ["npm", "start"]
