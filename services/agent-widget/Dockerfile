FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Build React client ────────────────────────────────────
FROM base AS client-builder
COPY src/client ./src/client
COPY vite.config.js ./
RUN npm run build:client

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/server.js ./src/
COPY src/config ./src/config
# Copy built React app
COPY --from=client-builder /app/src/public ./src/public
EXPOSE 3012
CMD ["node", "src/server.js"]
