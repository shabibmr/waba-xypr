// Test setup for whatsapp-webhook-service
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.RABBITMQ_URL = 'amqp://localhost';
process.env.META_VERIFY_TOKEN = 'test-verify-token';
process.env.META_APP_SECRET = 'test-app-secret';
