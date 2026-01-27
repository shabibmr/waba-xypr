FROM node:20-alpine AS base
WORKDIR /app
# COPY shared ./shared
COPY services/agent-widget/package*.json ./services/agent-widget/
WORKDIR /app/services/agent-widget
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/agent-widget
COPY services/agent-widget .
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app/services/agent-widget
RUN npm ci --only=production
COPY services/agent-widget .

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
# COPY shared ./shared
COPY --from=builder /app/services/agent-widget/node_modules ./services/agent-widget/node_modules
COPY --from=builder /app/services/agent-widget/src ./services/agent-widget/src
COPY --from=builder /app/services/agent-widget/package*.json ./services/agent-widget/

WORKDIR /app/services/agent-widget
EXPOSE 3012
CMD ["npm", "start"]
