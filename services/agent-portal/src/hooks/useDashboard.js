import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';

/**
 * React Query hook for dashboard metrics
 * Real-time updates via Socket.IO - no polling needed
 */
export const useDashboard = () => {
    return useQuery({
        queryKey: ['dashboard-metrics'],
        queryFn: () => dashboardService.getMetrics(),
        staleTime: 30 * 1000, // Keep data fresh for 30s
        cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
};
