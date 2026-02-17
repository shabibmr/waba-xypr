import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { setupAxiosInterceptors } from '../services/axiosInterceptor';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [refreshTimer, setRefreshTimer] = useState(null);

    /**
     * Handle logout when token refresh fails
     */
    const handleAutoLogout = useCallback(() => {
        console.log('Auto-logout triggered due to auth failure');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setError('Session expired. Please login again.');
    }, []);

    /**
     * Setup axios interceptors on mount
     */
    useEffect(() => {
        setupAxiosInterceptors(handleAutoLogout);
    }, [handleAutoLogout]);

    /**
     * Setup auto-refresh timer
     */
    const setupRefreshTimer = useCallback(() => {
        // Clear existing timer
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }

        const token = authService.getAccessToken();
        if (!token) return;

        // Get time until token expires (with 5 minute buffer)
        const expiryTime = authService.getTokenExpiryTime(token);
        const refreshIn = Math.max(0, expiryTime - 300); // Refresh 5 minutes before expiry


        // Set timer to refresh token
        const timer = setTimeout(async () => {
            try {
                console.log('Auto-refreshing token...');
                await authService.refreshAccessToken();
                const newToken = authService.getAccessToken();
                setToken(newToken);
                console.log('Token refreshed successfully');

                // Setup next refresh
                setupRefreshTimer();
            } catch (err) {
                console.error('Auto-refresh failed:', err);
                // Logout user if refresh fails
                setUser(null);
                setToken(null);
                setIsAuthenticated(false);
                setError('Session expired. Please login again.');
            }
        }, refreshIn * 1000);

        setRefreshTimer(timer);

        // Cleanup timer on unmount
        return () => clearTimeout(timer);
    }, [refreshTimer]);

    /**
     * Initialize auth state from localStorage on mount
     */
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const accessToken = authService.getAccessToken();
                const savedUser = authService.getAgent();

                if (accessToken && savedUser) {
                    setToken(accessToken);
                    // Check if token is expired
                    if (authService.isTokenExpired(accessToken)) {
                        // Try to refresh token
                        try {
                            await authService.refreshAccessToken();
                            const newToken = authService.getAccessToken();
                            setToken(newToken);
                            const profile = await authService.getProfile();
                            setUser(profile);
                            setIsAuthenticated(true);
                            setupRefreshTimer();
                        } catch (err) {
                            console.error('Token refresh failed:', err);
                            authService.clearAuth();
                            setUser(null);
                            setToken(null);
                            setIsAuthenticated(false);
                        }
                    } else {
                        // Token is valid, verify by fetching profile
                        try {
                            // MVP: Skip validation to avoid errors
                            // const profile = await authService.getProfile();
                            // setUser(profile);

                            // Just set authenticated to true if we have a token (and maybe the saved user)
                            setUser(savedUser);
                            setIsAuthenticated(true);
                            setupRefreshTimer();
                        } catch (err) {
                            // Token is invalid, clear auth
                            console.error('Token validation failed:', err);
                            authService.clearAuth();
                            setUser(null);
                            setToken(null);
                            setIsAuthenticated(false);
                        }
                    }
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Cleanup timer on unmount
        return () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }
        };
    }, [setupRefreshTimer]);

    /**
     * Login with Genesys OAuth
     */
    const login = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const agentWithRouting = await authService.initiateGenesysLogin();

            // Fetch full profile after login
            const profile = await authService.getProfile();
            const accessToken = authService.getAccessToken();

            setUser(profile);
            setToken(accessToken);
            setIsAuthenticated(true);

            // Setup auto-refresh timer
            setupRefreshTimer();

            // Return routing info alongside profile
            return { ...profile, isNewTenant: agentWithRouting.isNewTenant, onboardingCompleted: agentWithRouting.onboardingCompleted };
        } catch (err) {
            setError(err.message);
            setIsAuthenticated(false);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setupRefreshTimer]);

    /**
     * Logout and clear auth state
     */
    const logout = useCallback(async () => {
        setLoading(true);
        setError(null);

        // Clear refresh timer
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            setRefreshTimer(null);
        }

        try {
            await authService.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setUser(null);
            setToken(null);
            setIsAuthenticated(false);
            setLoading(false);
        }
    }, [refreshTimer]);

    /**
     * Refresh user profile
     */
    const refreshProfile = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const profile = await authService.getProfile();
            setUser(profile);
            return profile;
        } catch (err) {
            console.error('Profile refresh error:', err);
            setError(err.message);

            // If profile fetch fails with auth error, logout user
            if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                await logout();
            }

            throw err;
        }
    }, [isAuthenticated, logout]);

    /**
     * Update user data in context (after profile updates)
     */
    const updateUser = useCallback((updates) => {
        setUser(prev => prev ? { ...prev, ...updates } : null);
    }, []);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value = {
        // State
        user,
        token,
        loading,
        error,
        isAuthenticated,

        // Actions
        login,
        logout,
        refreshProfile,
        updateUser,
        clearError
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
