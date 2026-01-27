FROM node:18-alpine as build

WORKDIR /app

COPY services/agent-portal/package*.json ./services/agent-portal/
WORKDIR /app/services/agent-portal
RUN npm install

WORKDIR /app/services/agent-portal
COPY services/agent-portal .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/services/agent-portal/dist /usr/share/nginx/html
COPY services/agent-portal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
