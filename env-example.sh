# .env.example
# Copy this file to .env and fill in your actual values

# Database
DB_PASSWORD=your_secure_postgres_password

# RabbitMQ
RABBITMQ_PASSWORD=your_rabbitmq_password

# Meta WhatsApp Configuration
META_APP_SECRET=your_meta_app_secret
META_VERIFY_TOKEN=your_meta_verify_token
META_ACCESS_TOKEN=your_meta_access_token

# Genesys Cloud Configuration
GENESYS_CLIENT_ID=your_genesys_client_id
GENESYS_CLIENT_SECRET=your_genesys_client_secret
GENESYS_REGION=mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com

# Optional: Service URLs (for development)
# API_GATEWAY_URL=http://localhost:3000
# WEBHOOK_SERVICE_URL=http://localhost:3001
# INBOUND_SERVICE_URL=http://localhost:3002
# OUTBOUND_SERVICE_URL=http://localhost:3003
# AUTH_SERVICE_URL=http://localhost:3004
# STATE_SERVICE_URL=http://localhost:3005