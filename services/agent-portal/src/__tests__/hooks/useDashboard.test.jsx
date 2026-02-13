import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboard } from '../../hooks/useDashboard';
import dashboardService from '../../services/dashboardService';
import { mockDashboardMetrics } from '../../test/fixtures';

vi.mock('../../services/dashboardService');

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch dashboard metrics successfully', async () => {
        dashboardService.getMetrics.mockResolvedValue(mockDashboardMetrics);

        const { result } = renderHook(() => useDashboard(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(mockDashboardMetrics);
        expect(dashboardService.getMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle loading state', () => {
        dashboardService.getMetrics.mockReturnValue(
            new Promise(() => { }) // Never resolves
        );

        const { result } = renderHook(() => useDashboard(), {
            wrapper: createWrapper()
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
    });

    it('should handle error state', async () => {
        const error = new Error('Failed to fetch metrics');
        dashboardService.getMetrics.mockRejectedValue(error);

        const { result } = renderHook(() => useDashboard(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
    });

    it('should include all metric sections', async () => {
        dashboardService.getMetrics.mockResolvedValue(mockDashboardMetrics);

        const { result } = renderHook(() => useDashboard(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toHaveProperty('kpis');
        expect(result.current.data).toHaveProperty('tokenHealth');
        expect(result.current.data.kpis).toHaveProperty('total');
        expect(result.current.data.kpis).toHaveProperty('active');
        expect(result.current.data.kpis).toHaveProperty('closed');
        expect(result.current.data.kpis).toHaveProperty('today');
    });

    it('should include token health status', async () => {
        dashboardService.getMetrics.mockResolvedValue(mockDashboardMetrics);

        const { result } = renderHook(() => useDashboard(), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data.tokenHealth).toHaveProperty('daysRemaining');
        expect(result.current.data.tokenHealth).toHaveProperty('status');
        expect(result.current.data.tokenHealth.status).toMatch(/healthy|warning|critical/);
    });
});
