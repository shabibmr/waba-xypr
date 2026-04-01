import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import authService from '../services/authService';
import { useToast } from '../contexts/ToastContext';

function Login() {
    const navigate = useNavigate();
    const { login, devLogin, loading, error, isAuthenticated, clearError } = useAuth();
    const toast = useToast();
    const enableDevLogin = import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true';

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/workspace', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleGenesysLogin = async () => {
        clearError();

        try {
            const result = await login();
            toast.success('Login successful! Redirecting...');
            const needsOnboarding = result?.isNewTenant || !result?.onboardingCompleted;
            navigate(needsOnboarding ? '/onboarding' : '/workspace');
        } catch (err) {
            console.error('Login failed:', err);
            toast.error(err.message || 'Login failed. Please try again.');
            // Error is already set in context
        }
    };

    const handleDevLogin = async () => {
        clearError();

        try {
            const result = await devLogin();
            toast.success('Dev login successful! Redirecting...');
            navigate('/workspace');
        } catch (err) {
            console.error('Dev login failed:', err);
            toast.error(err.message || 'Dev login failed. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-surface-100 to-primary-100 px-4">
            <div className="card max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2 text-surface-900">Xypr Agent Portal</h1>
                    <p className="text-surface-500">Sign in with your Genesys Cloud account</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium mb-1">Authentication failed</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleGenesysLogin}
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Connecting to Genesys...
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                            </svg>
                            Sign in with Genesys Cloud
                        </>
                    )}
                </button>

                {enableDevLogin && (
                    <>
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-surface-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-surface-500">Development Mode</span>
                            </div>
                        </div>

                        <button
                            onClick={handleDevLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-200 hover:bg-surface-300 text-surface-900 font-medium rounded-lg transition-colors"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Dev Login (Skip OAuth)
                                </>
                            )}
                        </button>

                        <div className="mt-2 bg-amber-100 border border-amber-300 rounded-lg p-3">
                            <p className="text-xs text-amber-900">
                                <strong>Dev Mode:</strong> Restores your last login from database. No OAuth required.
                            </p>
                        </div>
                    </>
                )}

                <div className="mt-6 bg-primary-50 border border-primary-300 rounded-lg p-4">
                    <p className="text-sm text-primary-700 font-medium mb-2">First time logging in?</p>
                    <p className="text-xs text-surface-600">
                        Your account will be automatically created when you sign in for the first time. You'll be linked to your organization based on your Genesys account.
                    </p>
                </div>

                <div className="mt-6 text-center border-t border-surface-200 pt-4">
                    <p className="text-xs text-surface-500">
                        By signing in, you agree to the Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
