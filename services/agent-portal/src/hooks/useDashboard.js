import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';

/**
 * React Query hook for dashboard metrics
 */
export const useDashboard = () => {
    return useQuery({
        queryKey: ['dashboard-metrics'],
        queryFn: () => dashboardService.getMetrics(),
        // Refetch every 5 minutes
        refetchInterval: 5 * 60 * 1000,
    });
};
