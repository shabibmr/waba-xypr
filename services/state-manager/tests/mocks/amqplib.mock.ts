export const mockChannel = {
    assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue', messageCount: 0, consumerCount: 0 }),
    sendToQueue: jest.fn().mockReturnValue(true),
    consume: jest.fn().mockResolvedValue({ consumerTag: 'amq.ctag-test' }),
    prefetch: jest.fn().mockResolvedValue(null),
    checkQueue: jest.fn().mockResolvedValue({ messageCount: 5, consumerCount: 1 }),
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(null),
    on: jest.fn(),
};

export const mockConnection = {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(null),
};

export const connect = jest.fn().mockResolvedValue(mockConnection);

export default {
    connect,
    mockConnection,
    mockChannel,
};
