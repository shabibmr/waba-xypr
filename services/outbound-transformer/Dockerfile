FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/outbound-transformer/package*.json ./services/outbound-transformer/
WORKDIR /app/services/outbound-transformer
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/outbound-transformer
COPY services/outbound-transformer .
ENV NODE_PATH=/app/services/outbound-transformer/node_modules
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/outbound-transformer
COPY services/outbound-transformer/package*.json ./
RUN npm install
COPY services/outbound-transformer .
COPY shared ../../shared
COPY tsconfig.base.json ../../tsconfig.base.json
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

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

CMD ["node", "dist/index.js"]
