FROM node:20-alpine AS base
WORKDIR /app
COPY services/admin-dashboard/package*.json ./services/admin-dashboard/
WORKDIR /app/services/admin-dashboard
RUN npm install

# Development stage
FROM base AS development
WORKDIR /app/services/admin-dashboard
COPY services/admin-dashboard .
# Expose Vite dev server port
EXPOSE 3006
CMD ["npm", "run", "dev", "--", "--host"]

# Builder stage
FROM base AS builder
WORKDIR /app/services/admin-dashboard
RUN npm ci
COPY services/admin-dashboard .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY services/admin-dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/services/admin-dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
