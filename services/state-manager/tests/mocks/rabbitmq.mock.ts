/**
 * RabbitMQ Mock — Stubs for RabbitMQService publishers and consumers
 */

export class MockRabbitMQ {
    private queues: Map<string, any[]> = new Map();
    private isConnectedState = true;

    // Publishers
    publishToInboundProcessed = jest.fn().mockImplementation(async (msg: any) => {
        if (!this.isConnectedState) throw new Error('RabbitMQ disconnected');
        this.pushToQueue('inbound-processed', msg);
    });

    publishToOutboundProcessed = jest.fn().mockImplementation(async (msg: any) => {
        if (!this.isConnectedState) throw new Error('RabbitMQ disconnected');
        this.pushToQueue('outbound-processed', msg);
    });

    sendToDLQ = jest.fn().mockImplementation(async (msg: any, reason: any, error?: string) => {
        this.pushToQueue('dlq', { msg, reason, error });
    });

    // Consumers
    consumeInbound = jest.fn().mockResolvedValue(undefined);
    consumeOutbound = jest.fn().mockResolvedValue(undefined);
    consumeStatus = jest.fn().mockResolvedValue(undefined);

    // Connection
    connect = jest.fn().mockResolvedValue(undefined);
    isConnected = jest.fn().mockReturnValue(true);

    // --------------- Internal ---------------

    private pushToQueue(name: string, item: any) {
        if (!this.queues.has(name)) this.queues.set(name, []);
        this.queues.get(name)!.push(item);
    }

    // --------------- Test utilities ---------------

    getQueue(name: string): any[] {
        return this.queues.get(name) || [];
    }

    simulateDisconnect() {
        this.isConnectedState = false;
        this.isConnected.mockReturnValue(false);
    }

    simulateReconnect() {
        this.isConnectedState = true;
        this.isConnected.mockReturnValue(true);
    }

    clear() {
        this.queues.clear();
    }

    reset() {
        this.clear();
        this.isConnectedState = true;
        this.publishToInboundProcessed.mockClear();
        this.publishToOutboundProcessed.mockClear();
        this.sendToDLQ.mockClear();
        this.consumeInbound.mockClear();
        this.consumeOutbound.mockClear();
        this.consumeStatus.mockClear();
        this.connect.mockClear();
        this.isConnected.mockReturnValue(true);
    }
}

export const createMockRabbitMQ = () => new MockRabbitMQ();
