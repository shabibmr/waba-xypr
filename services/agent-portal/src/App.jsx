import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Workspace from './pages/Workspace';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import AuthCallback from './components/AuthCallback';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <AuthProvider>
                    <Router>
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
                            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                            {/* Protected Routes */}
                            <Route
                                path="/workspace"
                                element={
                                    <ProtectedRoute>
                                        <Workspace />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <ProtectedRoute>
                                        <Profile />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Redirect root to workspace */}
                            <Route path="/" element={<Navigate to="/workspace" replace />} />
                        </Routes>
                    </Router>
                </AuthProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
}

export default App;
