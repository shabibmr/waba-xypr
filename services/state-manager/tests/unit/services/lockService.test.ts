import { createMockRedis } from '../../mocks/redis.mock';

// Mock Redis BEFORE importing service
const mockRedis = createMockRedis();

jest.mock('../../../src/config/redis', () => ({
    __esModule: true,
    default: mockRedis,
}));

import lockService from '../../../src/services/lockService';

describe('LockService', () => {
    afterEach(() => {
        mockRedis.reset();
        jest.clearAllMocks();
    });

    // ==================== acquireLock ====================

    describe('acquireLock', () => {
        it('should return true when Redis setNX succeeds', async () => {
            const wa_id = '12345';
            const result = await lockService.acquireLock(wa_id);
            expect(result).toBe(true);

            const cached = await mockRedis.get(`lock:mapping:${wa_id}`);
            expect(cached).toBe('1');
        });

        it('should return false when lock already exists', async () => {
            const wa_id = '12345';
            await lockService.acquireLock(wa_id);

            const result = await lockService.acquireLock(wa_id);
            expect(result).toBe(false);
        });

        it('should return false on Redis error', async () => {
            mockRedis.simulateDisconnect();
            const result = await lockService.acquireLock('12345');
            expect(result).toBe(false);
        });
    });

    // ==================== releaseLock ====================

    describe('releaseLock', () => {
        it('should delete the lock key', async () => {
            const wa_id = '12345';
            await lockService.acquireLock(wa_id);

            await lockService.releaseLock(wa_id);

            const cached = await mockRedis.get(`lock:mapping:${wa_id}`);
            expect(cached).toBeNull();
        });

        it('should handle Redis error gracefully', async () => {
            mockRedis.simulateDisconnect();
            // Should not throw
            await expect(lockService.releaseLock('12345')).resolves.not.toThrow();
        });
    });

    // ==================== withLockRetry ====================

    describe('withLockRetry', () => {
        it('should acquire lock immediately if available', async () => {
            const wa_id = '12345';
            const result = await lockService.withLockRetry(wa_id);
            expect(result).toBe(true);
        });

        it('should retry and succeed if lock becomes available', async () => {
            const wa_id = '12345';

            // Mock acquireLock to fail twice then succeed
            // We can spy on instance, but since it's a singleton exported default,
            // and we want to test REAL logic, we simulate lock contention via Redis mock
            // But RedisMock is synchronous. So we spy on acquireLock instead.
            const spy = jest.spyOn(lockService, 'acquireLock')
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            // Fast-forward delay (we mock setTimeout or just rely on small delays if logic uses it)
            // The service uses a sleep function. Best to just let it run if delays are small.
            // But delays are 100ms, 200ms etc. Better to mock setTimeout.
            jest.useFakeTimers();

            const promise = lockService.withLockRetry(wa_id);

            // Fast-forward timers
            await jest.runAllTimersAsync();

            const result = await promise;
            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledTimes(3);

            jest.useRealTimers();
        });

        it('should return false after max retries', async () => {
            const wa_id = '12345';
            jest.spyOn(lockService, 'acquireLock').mockResolvedValue(false);

            jest.useFakeTimers();
            const promise = lockService.withLockRetry(wa_id);
            await jest.runAllTimersAsync();

            const result = await promise;
            expect(result).toBe(false);

            jest.useRealTimers();
        });
    });
});
