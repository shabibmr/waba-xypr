FROM node:20-alpine AS base
WORKDIR /app
COPY shared ./shared
COPY services/outbound-transformer/package*.json ./services/outbound-transformer/
WORKDIR /app/services/outbound-transformer
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/outbound-transformer
COPY services/outbound-transformer .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/outbound-transformer
RUN npm ci --only=production
COPY services/outbound-transformer .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/outbound-transformer/node_modules ./services/outbound-transformer/node_modules
COPY --from=builder /app/services/outbound-transformer/src ./services/outbound-transformer/src
COPY --from=builder /app/services/outbound-transformer/package*.json ./services/outbound-transformer/

WORKDIR /app/services/outbound-transformer
EXPOSE 3003
CMD ["npm", "start"]
