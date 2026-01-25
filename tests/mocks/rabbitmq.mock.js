/**
 * RabbitMQ Mock
 * Mock message queue for testing without a real RabbitMQ instance
 */

class RabbitMQMock {
    constructor() {
        this.connection = null;
        this.channels = new Map();
        this.queues = new Map();
        this.exchanges = new Map();
        this.messages = new Map(); // Store messages for assertions
    }

    /**
     * Create a mock connection
     */
    async connect(url) {
        this.connection = {
            url,
            isConnected: true,
            createChannel: () => this.createChannel()
        };
        console.log('RabbitMQ mock connection created');
        return this.connection;
    }

    /**
     * Create a mock channel
     */
    async createChannel() {
        const channelId = `channel-${this.channels.size + 1}`;
        const channel = {
            id: channelId,

            // Assert queue
            assertQueue: async (queueName, options = {}) => {
                if (!this.queues.has(queueName)) {
                    this.queues.set(queueName, {
                        name: queueName,
                        options,
                        messages: []
                    });
                    this.messages.set(queueName, []);
                }
                return { queue: queueName };
            },

            // Assert exchange
            assertExchange: async (exchangeName, type, options = {}) => {
                if (!this.exchanges.has(exchangeName)) {
                    this.exchanges.set(exchangeName, {
                        name: exchangeName,
                        type,
                        options
                    });
                }
                return { exchange: exchangeName };
            },

            // Bind queue to exchange
            bindQueue: async (queueName, exchangeName, routingKey) => {
                const queue = this.queues.get(queueName);
                if (queue) {
                    queue.bindings = queue.bindings || [];
                    queue.bindings.push({ exchange: exchangeName, routingKey });
                }
                return {};
            },

            // Publish to queue
            sendToQueue: (queueName, content, options = {}) => {
                const queue = this.queues.get(queueName);
                if (queue) {
                    const message = {
                        content,
                        options,
                        timestamp: Date.now()
                    };
                    queue.messages.push(message);

                    // Store for assertions
                    const queueMessages = this.messages.get(queueName) || [];
                    queueMessages.push(message);
                    this.messages.set(queueName, queueMessages);
                }
                return true;
            },

            // Publish to exchange
            publish: (exchangeName, routingKey, content, options = {}) => {
                // Find queues bound to this exchange with matching routing key
                for (const [queueName, queue] of this.queues) {
                    if (queue.bindings) {
                        const binding = queue.bindings.find(
                            b => b.exchange === exchangeName &&
                                (b.routingKey === routingKey || b.routingKey === '#')
                        );
                        if (binding) {
                            channel.sendToQueue(queueName, content, options);
                        }
                    }
                }
                return true;
            },

            // Consume from queue
            consume: async (queueName, callback, options = {}) => {
                const queue = this.queues.get(queueName);
                if (queue) {
                    // Process existing messages
                    queue.messages.forEach(msg => {
                        callback({
                            content: msg.content,
                            fields: {
                                deliveryTag: Math.random().toString(36).substr(2, 9),
                                routingKey: queueName
                            },
                            properties: msg.options
                        });
                    });
                }
                return { consumerTag: `consumer-${Math.random().toString(36).substr(2, 9)}` };
            },

            // Acknowledge message
            ack: (message) => {
                return true;
            },

            // Negative acknowledge
            nack: (message, allUpTo, requeue) => {
                return true;
            },

            // Prefetch
            prefetch: (count) => {
                return true;
            },

            // Close channel
            close: async () => {
                this.channels.delete(channelId);
            }
        };

        this.channels.set(channelId, channel);
        return channel;
    }

    /**
     * Close connection
     */
    async close() {
        if (this.connection) {
            this.connection.isConnected = false;
            this.connection = null;
            this.channels.clear();
        }
    }

    /**
     * Get messages sent to a queue (for assertions)
     */
    getQueueMessages(queueName) {
        return this.messages.get(queueName) || [];
    }

    /**
     * Get the last message sent to a queue
     */
    getLastMessage(queueName) {
        const messages = this.getQueueMessages(queueName);
        return messages[messages.length - 1];
    }

    /**
     * Clear all messages from a queue
     */
    clearQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (queue) {
            queue.messages = [];
        }
        this.messages.set(queueName, []);
    }

    /**
     * Clear all queues
     */
    clearAll() {
        for (const queueName of this.queues.keys()) {
            this.clearQueue(queueName);
        }
    }

    /**
     * Get queue info
     */
    getQueueInfo(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) return null;

        return {
            name: queue.name,
            messageCount: queue.messages.length,
            options: queue.options,
            bindings: queue.bindings || []
        };
    }

    /**
     * Assert that a message was sent to a queue
     */
    assertMessageSent(queueName, expectedContent = null) {
        const messages = this.getQueueMessages(queueName);

        if (messages.length === 0) {
            throw new Error(`No messages sent to queue: ${queueName}`);
        }

        if (expectedContent) {
            const found = messages.some(msg => {
                const content = msg.content.toString();
                const expected = typeof expectedContent === 'string'
                    ? expectedContent
                    : JSON.stringify(expectedContent);
                return content.includes(expected);
            });

            if (!found) {
                throw new Error(`Expected message not found in queue: ${queueName}`);
            }
        }

        return true;
    }
}

// Export singleton instance
module.exports = new RabbitMQMock();
