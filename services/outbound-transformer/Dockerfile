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
COPY services/outbound-transformer/package*.json ./
RUN npm ci
COPY services/outbound-transformer .
COPY shared ../../shared
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/outbound-transformer/package*.json ./services/outbound-transformer/
COPY --from=builder /app/services/outbound-transformer/node_modules ./services/outbound-transformer/node_modules
COPY --from=builder /app/services/outbound-transformer/dist ./services/outbound-transformer/dist

WORKDIR /app/services/outbound-transformer
EXPOSE 3003
CMD ["node", "dist/index.js"]
