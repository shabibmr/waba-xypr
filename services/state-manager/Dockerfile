FROM node:20-alpine AS base
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
COPY services/state-manager/package*.json ./services/state-manager/
# Install shared dependencies first
WORKDIR /app/shared
RUN npm install
# Then install state-manager dependencies
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
# Install all dependencies (including dev) to build
COPY services/state-manager/package*.json ./
RUN npm install
COPY services/state-manager .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY tsconfig.base.json ./
COPY shared ./shared
# Install only production dependencies
COPY services/state-manager/package*.json ./services/state-manager/
WORKDIR /app/services/state-manager
RUN npm install --only=production

COPY --from=builder /app/services/state-manager/dist ./dist

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1

CMD ["node", "dist/index.js"]
