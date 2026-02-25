const amqp = require('amqplib');

async function testPush() {
    try {
        const url = process.env.RABBITMQ_URL || 'amqp://admin:your_rabbitmq_password@localhost:5672';
        const conn = await amqp.connect(url);
        const ch = await conn.createChannel();
        const queue = 'outbound.agent.portal.evt';
        await ch.assertQueue(queue, { durable: true });

        const payload = {
            type: 'new_message',
            tenantId: 'test-tenant',
            data: {
                messageId: 'test-123',
                message: 'Hello from manual test push'
            }
        };

        ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
        console.log('Test message successfully pushed to queue:', queue);

        setTimeout(() => {
            conn.close();
            process.exit(0);
        }, 1000);
    } catch (e) {
        console.error('Failed to push message', e);
        process.exit(1);
    }
}

testPush();
