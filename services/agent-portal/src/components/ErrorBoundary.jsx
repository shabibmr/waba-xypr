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
                <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center px-4">
                    <div className="card max-w-2xl w-full">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-full mb-6">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-bold mb-2">Oops! Something went wrong</h1>
                            <p className="text-gray-400">
                                We encountered an unexpected error. Our team has been notified.
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-gray-800 rounded-lg p-4 mb-6 overflow-auto">
                                <p className="text-sm font-mono text-red-400 mb-2">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-xs text-gray-400 overflow-auto">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReset}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Reload Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                <Home className="w-5 h-5" />
                                Go Home
                            </button>
                        </div>

                        <div className="mt-6 bg-blue-500/10 border border-blue-500 rounded-lg p-4">
                            <p className="text-sm text-blue-400">
                                <strong>Need help?</strong> If this problem persists, please contact support with the error details.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
