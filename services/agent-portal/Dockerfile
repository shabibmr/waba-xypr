FROM node:18-alpine as build

WORKDIR /app
ARG VITE_API_GATEWAY
ARG VITE_AGENT_WIDGET_URL
ARG VITE_ENABLE_DEV_LOGIN
ENV VITE_API_GATEWAY=$VITE_API_GATEWAY
ENV VITE_AGENT_WIDGET_URL=$VITE_AGENT_WIDGET_URL
ENV VITE_ENABLE_DEV_LOGIN=$VITE_ENABLE_DEV_LOGIN

COPY services/agent-portal/package*.json ./services/agent-portal/
WORKDIR /app/services/agent-portal
RUN npm install

WORKDIR /app/services/agent-portal
COPY services/agent-portal .
RUN npm run build


# Development stage
FROM build AS development
WORKDIR /app/services/agent-portal
# Expose Vite dev server port
EXPOSE 3014
CMD ["npm", "run", "dev", "--", "--host"]

# Production stage
FROM nginx:alpine AS production

COPY --from=build /app/services/agent-portal/dist /usr/share/nginx/html
COPY services/agent-portal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
