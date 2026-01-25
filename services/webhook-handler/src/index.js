// webhook-handler/server.js
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const amqp = require('amqplib');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

let rabbitChannel;

// Initialize RabbitMQ connection
async function initRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('inbound-messages', { durable: true });
    await rabbitChannel.assertQueue('outbound-messages', { durable: true });
    console.log('RabbitMQ connected');
  } catch (error) {
    console.error('RabbitMQ connection failed:', error);
    setTimeout(initRabbitMQ, 5000);
  }
}

initRabbitMQ();

// Verify Meta webhook signature
function verifyMetaSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', process.env.META_APP_SECRET);
  const body = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + hmac.update(body).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Meta webhook verification (GET request)
app.get('/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('Webhook verified for Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta webhook receiver (POST request)
app.post('/webhook/meta', async (req, res) => {
  // Immediately respond to Meta
  res.sendStatus(200);

  // Verify signature
  if (!verifyMetaSignature(req)) {
    console.error('Invalid Meta signature');
    return;
  }

  try {
    const { entry } = req.body;
    
    if (!entry || entry.length === 0) return;

    for (const item of entry) {
      const changes = item.changes || [];
      
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        
        const messages = change.value.messages || [];
        const contacts = change.value.contacts || [];
        const statuses = change.value.statuses || [];

        // Process inbound messages
        for (const message of messages) {
          const contact = contacts.find(c => c.wa_id === message.from);
          
          const payload = {
            messageId: message.id,
            from: message.from,
            contactName: contact?.profile?.name || 'Unknown',
            timestamp: message.timestamp,
            type: message.type,
            content: extractMessageContent(message),
            metadata: {
              phoneNumberId: change.value.metadata.phone_number_id,
              displayPhoneNumber: change.value.metadata.display_phone_number
            }
          };

          // Queue for processing
          await rabbitChannel.sendToQueue(
            'inbound-messages',
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
          );

          console.log('Queued inbound message:', message.id);
        }

        // Process status updates (delivery receipts)
        for (const status of statuses) {
          const statusPayload = {
            messageId: status.id,
            recipientId: status.recipient_id,
            status: status.status,
            timestamp: status.timestamp,
            errors: status.errors || []
          };

          // Forward to Genesys via state manager
          await forwardStatusToGenesys(statusPayload);
        }
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }
});

// Genesys webhook receiver
app.post('/webhook/genesys', async (req, res) => {
  res.sendStatus(200);

  try {
    const { eventType, conversationId, message } = req.body;

    if (eventType === 'agent.message') {
      const payload = {
        conversationId,
        messageId: message.id,
        text: message.text,
        timestamp: message.timestamp,
        agentId: message.from?.id
      };

      // Queue for outbound processing
      await rabbitChannel.sendToQueue(
        'outbound-messages',
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );

      console.log('Queued outbound message:', message.id);
    }
  } catch (error) {
    console.error('Genesys webhook error:', error);
  }
});

// Extract message content based on type
function extractMessageContent(message) {
  switch (message.type) {
    case 'text':
      return { text: message.text.body };
    case 'image':
      return { imageId: message.image.id, caption: message.image.caption };
    case 'document':
      return { documentId: message.document.id, filename: message.document.filename };
    case 'audio':
      return { audioId: message.audio.id };
    case 'video':
      return { videoId: message.video.id, caption: message.video.caption };
    case 'location':
      return { 
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        name: message.location.name,
        address: message.location.address
      };
    default:
      return { raw: message };
  }
}

// Forward status updates to Genesys
async function forwardStatusToGenesys(status) {
  try {
    const stateService = process.env.STATE_SERVICE_URL || 'http://state-manager:3005';
    const response = await axios.get(
      `${stateService}/state/mapping/${status.recipientId}`
    );
    
    const { conversationId } = response.data;
    
    if (conversationId) {
      // Send receipt to Genesys
      const authService = process.env.AUTH_SERVICE_URL || 'http://auth-service:3004';
      const tokenResponse = await axios.get(`${authService}/auth/token`);
      const { token } = tokenResponse.data;

      const genesysUrl = `${process.env.GENESYS_BASE_URL}/api/v2/conversations/messages/${conversationId}/receipts`;
      
      await axios.post(genesysUrl, {
        messageId: status.messageId,
        status: mapStatusToGenesys(status.status),
        timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Status forward error:', error.message);
  }
}

function mapStatusToGenesys(metaStatus) {
  const statusMap = {
    'sent': 'Sent',
    'delivered': 'Delivered',
    'read': 'Read',
    'failed': 'Failed'
  };
  return statusMap[metaStatus] || 'Unknown';
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    rabbitmq: rabbitChannel ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`Webhook Handler running on port ${PORT}`);
});