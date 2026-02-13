import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import dashboardService from '../../services/dashboardService';

vi.mock('axios');

describe('DashboardService', () => {
    const API_BASE_URL = 'http://localhost:3000';
    const mockToken = 'test-token-789';

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.setItem('agent_access_token', mockToken);
    });

    describe('getMetrics', () => {
        it('should fetch dashboard metrics successfully', async () => {
            const mockMetrics = {
                kpis: {
                    total: 100,
                    active: 25,
                    closed: 75,
                    today: 10
                },
                tokenHealth: {
                    daysRemaining: 30,
                    status: 'healthy'
                }
            };

            axios.get.mockResolvedValue({ data: mockMetrics });

            const result = await dashboardService.getMetrics();

            expect(axios.get).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/dashboard/metrics`,
                { headers: { Authorization: `Bearer ${mockToken}` } }
            );
            expect(result).toEqual(mockMetrics);
        });

        it('should handle metrics fetch error', async () => {
            axios.get.mockRejectedValue({
                response: { data: { error: 'Access denied' } }
            });

            await expect(dashboardService.getMetrics())
                .rejects.toThrow('Access denied');
        });

        it('should handle network error with default message', async () => {
            axios.get.mockRejectedValue(new Error('Connection timeout'));

            await expect(dashboardService.getMetrics())
                .rejects.toThrow('Failed to fetch dashboard metrics');
        });

        it('should include authorization token', async () => {
            axios.get.mockResolvedValue({ data: {} });

            await dashboardService.getMetrics();

            expect(axios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockToken}`
                    })
                })
            );
        });

        it('should return complete metrics structure', async () => {
            const completeMetrics = {
                kpis: { total: 50, active: 15, closed: 35, today: 5 },
                tokenHealth: { daysRemaining: 45, status: 'healthy', expiresAt: '2024-03-30' },
                charts: { conversationsOverTime: [] }
            };

            axios.get.mockResolvedValue({ data: completeMetrics });

            const result = await dashboardService.getMetrics();

            expect(result).toHaveProperty('kpis');
            expect(result).toHaveProperty('tokenHealth');
            expect(result).toHaveProperty('charts');
            expect(result.kpis).toEqual(completeMetrics.kpis);
        });
    });
});
