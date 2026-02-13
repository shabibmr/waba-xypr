import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';

// Create a custom render function that wraps components with providers
export function renderWithProviders(
    ui,
    {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        }),
        route = '/',
        ...renderOptions
    } = {}
) {
    window.history.pushState({}, 'Test page', route);

    function Wrapper({ children }) {
        return (
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <ToastProvider>
                        <AuthProvider>
                            {children}
                        </AuthProvider>
                    </ToastProvider>
                </BrowserRouter>
            </QueryClientProvider>
        );
    }

    return {
        ...render(ui, { wrapper: Wrapper, ...renderOptions }),
        queryClient
    };
}

// Helper to create a fresh QueryClient for each test
export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, cacheTime: 0 },
            mutations: { retry: false }
        }
    });
}

// Helper to wait for loading states to resolve
export async function waitForLoadingToFinish() {
    await new Promise(resolve => setTimeout(resolve, 0));
}
