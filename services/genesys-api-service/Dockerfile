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
COPY services/genesys-api-service .
RUN npm install && npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/genesys-api-service/package*.json ./services/genesys-api-service/
WORKDIR /app/services/genesys-api-service
RUN npm install --only=production
COPY --from=builder /app/services/genesys-api-service/dist ./dist
COPY --from=builder /app/services/genesys-api-service/docs ./docs

EXPOSE 3010
CMD ["node", "dist/index.js"]
