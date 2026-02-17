FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/agent-portal-service/package*.json ./services/agent-portal-service/
WORKDIR /app/services/agent-portal-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/agent-portal-service
COPY services/agent-portal-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/agent-portal-service
RUN apk add --no-cache python3 make g++
RUN npm install --only=production
COPY services/agent-portal-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/agent-portal-service/node_modules ./services/agent-portal-service/node_modules
COPY --from=builder /app/services/agent-portal-service/src ./services/agent-portal-service/src
COPY --from=builder /app/services/agent-portal-service/package*.json ./services/agent-portal-service/

WORKDIR /app/services/agent-portal-service
EXPOSE 3015
CMD ["npm", "start"]
