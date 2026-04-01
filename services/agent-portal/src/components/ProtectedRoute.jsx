import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import useAuth from '../hooks/useAuth';

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-surface-100">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-6" />
                    <h2 className="text-xl font-bold text-surface-900 mb-2">Authenticating</h2>
                    <p className="text-surface-500 font-medium italic">Securing your workspace...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;
