import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // Log to error tracking service (e.g., Sentry)
        if (window.Sentry) {
            window.Sentry.captureException(error, { extra: errorInfo });
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-surface-100 flex items-center justify-center px-4">
                    <div className="card shadow-2xl-light max-w-2xl w-full border border-surface-200">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 text-red-600 rounded-2xl mb-6 shadow-sm">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-bold mb-2 text-surface-900">Oops! Something went wrong</h1>
                            <p className="text-surface-500 font-medium">
                                We encountered an unexpected error. Our team has been notified.
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-surface-50 border border-surface-100 rounded-xl p-6 mb-8 overflow-auto max-h-[300px]">
                                <p className="text-sm font-mono text-red-600 font-bold mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-xs text-surface-400 leading-relaxed font-mono whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                            <button
                                onClick={this.handleReset}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reload Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </button>
                        </div>

                        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5">
                            <div className="flex gap-3">
                                <div className="text-primary-600 font-bold">ℹ️</div>
                                <div className="text-sm text-primary-700 leading-relaxed">
                                    <p className="font-bold mb-1 text-primary-800">Need immediate assistance?</p>
                                    If this problem persists, please contact our support team with the error details shown above.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
