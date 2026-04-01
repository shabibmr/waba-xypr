FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/genesys-webhook-service/package*.json ./services/genesys-webhook-service/
WORKDIR /app/services/genesys-webhook-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/genesys-webhook-service
COPY services/genesys-webhook-service .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/genesys-webhook-service
COPY services/genesys-webhook-service .
RUN npm install && npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/genesys-webhook-service/package*.json ./services/genesys-webhook-service/
WORKDIR /app/services/genesys-webhook-service
RUN npm install --only=production
COPY --from=builder /app/services/genesys-webhook-service/dist ./dist
COPY --from=builder /app/services/genesys-webhook-service/docs ./docs

EXPOSE 3011

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3011/health || exit 1

CMD ["node", "dist/index.js"]
