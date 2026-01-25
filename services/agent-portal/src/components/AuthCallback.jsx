import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';

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
                    const response = await fetch(`${import.meta.env.VITE_API_GATEWAY}/api/agents/auth/callback?code=${code}`);
                    const data = await response.json();

                    if (window.opener) {
                        // Send success message to parent window
                        window.opener.postMessage({
                            type: 'GENESYS_AUTH_SUCCESS',
                            token: data.token,
                            agent: data.agent
                        }, window.location.origin);
                        window.close();
                    } else {
                        // Fallback: direct navigation
                        authService.setToken(data.token);
                        authService.setAgent(data.agent);
                        navigate('/workspace');
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
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Completing authentication...</p>
            </div>
        </div>
    );
}

export default AuthCallback;
