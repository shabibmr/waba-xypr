FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/auth-service/package*.json ./services/auth-service/
WORKDIR /app/services/auth-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/auth-service
COPY services/auth-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/auth-service
RUN npm ci --only=production
COPY services/auth-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/auth-service/node_modules ./services/auth-service/node_modules
COPY --from=builder /app/services/auth-service/src ./services/auth-service/src
COPY --from=builder /app/services/auth-service/package*.json ./services/auth-service/

WORKDIR /app/services/auth-service
EXPOSE 3004
CMD ["npm", "start"]
