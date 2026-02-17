FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/genesys-api-service/package*.json ./services/genesys-api-service/
WORKDIR /app/services/genesys-api-service
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/genesys-api-service
COPY services/genesys-api-service .
ENV NODE_PATH=/app/services/genesys-api-service/node_modules
ENV NODE_PATH=/app/services/genesys-api-service/node_modules
RUN npm install
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/genesys-api-service
RUN npm ci --only=production
COPY services/genesys-api-service .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY shared ./shared
COPY --from=builder /app/services/genesys-api-service/node_modules ./services/genesys-api-service/node_modules
COPY --from=builder /app/services/genesys-api-service/src ./services/genesys-api-service/src
COPY --from=builder /app/services/genesys-api-service/package*.json ./services/genesys-api-service/

WORKDIR /app/services/genesys-api-service
EXPOSE 3010
CMD ["npm", "start"]
