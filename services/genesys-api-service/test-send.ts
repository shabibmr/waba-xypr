import { connectRedis } from './src/services/redis.service';
import { createClient } from 'redis';
import { sendConversationMessage } from './src/services/genesys-api.service';
import config from './src/config/config';

async function main() {
    config.redis.url = 'redis://localhost:6379'; // Ensure local connection
    const client = createClient({ url: config.redis.url });
    await client.connect();

    console.log('[DEBUG] Connected to Redis.');

    let token = null;
    const tenantId = 't_3f5669aed9ce3d9e';
    const key = `auth:token:genesys:${tenantId}`;

    const value = await client.get(key);
    if (value) {
        try {
            const data = JSON.parse(value);
            token = data.access_token || data.token || value;
            console.log('[DEBUG] Retrieved user token from Redis.');
        } catch (e) {
            token = value;
            console.log('[DEBUG] Retrieved raw token from Redis.');
        }
    } else {
        console.log('[DEBUG] Token not found in Redis under auth:token:', key);
    }

    const conversationId = 'f8515162-7385-4b1f-9377-6d9864cae608';
    const communicationId = '7f9fb99f-3d10-4a8f-b57c-9305ad1ce4d2';

    console.log(`[DEBUG] Sending message for tenantId=${tenantId}`);

    try {
        const result = await sendConversationMessage(tenantId, conversationId, {
            text: 'Hello, this is a test message from Antigravity!',
            integrationId: '953973be-eb1f-4a3b-8541-62b3e809c803', // using the ENV var value
            communicationId: communicationId,
            genesysUserToken: token
        });

        console.log('[SUCCESS] Message sent successfully:', result);
    } catch (err: any) {
        console.error('[ERROR] Failed to send message:', err.response?.data || err.message);
    }

    await client.quit();
    process.exit(0);
}

main().catch(console.error);
