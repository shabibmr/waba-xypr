import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client configuration
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
        },
        mutations: {
            retry: 0,
        },
    },
});
