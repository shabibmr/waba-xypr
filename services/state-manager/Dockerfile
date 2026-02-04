FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/state-manager/package*.json ./services/state-manager/
WORKDIR /app/services/state-manager
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/state-manager
COPY services/state-manager .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/state-manager
RUN npm ci --only=production
COPY services/state-manager .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY --from=builder /app/services/state-manager/node_modules ./services/state-manager/node_modules
COPY --from=builder /app/services/state-manager/src ./services/state-manager/src
COPY --from=builder /app/services/state-manager/package*.json ./services/state-manager/

WORKDIR /app/services/state-manager
EXPOSE 3005
CMD ["npm", "start"]
