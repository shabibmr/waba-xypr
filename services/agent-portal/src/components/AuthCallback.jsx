import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';

function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                // Send error message to parent window
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'GENESYS_AUTH_ERROR',
                        error: error
                    }, window.location.origin);
                    window.close();
                } else {
                    navigate('/login?error=' + error);
                }
                return;
            }

            if (code) {
                try {
                    // Exchange code for token on backend
                    const response = await fetch(`${API_BASE_URL}/api/agents/auth/callback?code=${code}`);
                    const data = await response.json();

                    if (window.opener) {
                        // Send success message to parent window
                        window.opener.postMessage({
                            type: 'GENESYS_AUTH_SUCCESS',
                            accessToken: data.accessToken,
                            refreshToken: data.refreshToken,
                            agent: data.agent,
                            isNewTenant: data.isNewTenant || false,
                            onboardingCompleted: data.onboardingCompleted || false,
                            genesysOrg: data.genesysOrg || null
                        }, window.location.origin);
                        window.close();
                    } else {
                        // Fallback: direct navigation
                        authService.setAccessToken(data.accessToken);
                        authService.setRefreshToken(data.refreshToken);
                        authService.setAgent(data.agent);
                        if (data.genesysOrg) authService.setGenesysOrg(data.genesysOrg);
                        const needsOnboarding = data.isNewTenant || !data.onboardingCompleted;
                        navigate(needsOnboarding ? '/onboarding' : '/workspace');
                    }
                } catch (err) {
                    console.error('Auth callback error:', err);
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'GENESYS_AUTH_ERROR',
                            error: 'Authentication failed'
                        }, window.location.origin);
                        window.close();
                    } else {
                        navigate('/login?error=auth_failed');
                    }
                }
            }
        };

        processCallback();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-100 border-t-primary-600 mx-auto mb-6"></div>
                <h2 className="text-xl font-bold text-surface-900 mb-2">Almost there!</h2>
                <p className="text-surface-500 font-medium">Completing your secure authentication...</p>
            </div>
        </div>
    );
}

export default AuthCallback;
