import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, LogOut, Loader2, Building, Phone, CheckCircle, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import whatsappService from '../services/whatsappService';
import authService from '../services/authService';
import { useToast } from '../contexts/ToastContext';

function Profile() {
    const navigate = useNavigate();
    const { user, logout, refreshProfile, loading: authLoading } = useAuth();
    const toast = useToast();
    const [whatsappStatus, setWhatsappStatus] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutSuccess, setLogoutSuccess] = useState(false);

    useEffect(() => {
        loadWhatsAppStatus();
    }, []);

    const loadWhatsAppStatus = async () => {
        try {
            const waStatus = await whatsappService.getStatus();
            setWhatsappStatus(waStatus);
        } catch (error) {
            console.error('Failed to load WhatsApp status:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshProfile();
            await loadWhatsAppStatus();
            toast.success('Profile refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh:', error);
            toast.error('Failed to refresh profile');
        } finally {
            setRefreshing(false);
        }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await logout();
            setLogoutSuccess(true);
            toast.success('Logged out successfully');
            setTimeout(() => {
                navigate('/login');
            }, 1000);
        } catch (error) {
            console.error('Logout error:', error);
            toast.error('Logout failed, but redirecting anyway');
            navigate('/login'); // Still navigate even on error
        } finally {
            setLoggingOut(false);
            setShowLogoutConfirm(false);
        }
    };

    const handleLogoutAll = async () => {
        setLoggingOut(true);
        try {
            await authService.logoutAll();
            setLogoutSuccess(true);
            toast.success('Logged out from all devices');
            setTimeout(() => {
                navigate('/login');
            }, 1500);
        } catch (error) {
            console.error('Logout all error:', error);
            toast.error('Logout failed, but redirecting anyway');
            navigate('/login'); // Still navigate even on error
        } finally {
            setLoggingOut(false);
            setShowLogoutAllConfirm(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-surface-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-surface-900">Your Profile</h1>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="btn-secondary flex items-center gap-2 px-4"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="grid gap-6">
                    {/* User Information */}
                    <div className="card shadow-md-light">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-surface-900">
                            <User className="w-5 h-5 text-primary-600" />
                            Personal Information
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Full Name</label>
                                <p className="text-lg font-medium text-surface-900">{user?.name || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Email Address</label>
                                <div className="flex items-center gap-2 text-lg font-medium text-surface-900">
                                    <Mail className="w-4 h-4 text-surface-400" />
                                    {user?.email || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Role</label>
                                <p className="mt-1">
                                    <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-xs font-bold rounded-full uppercase tracking-tight">
                                        {user?.role || 'agent'}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">User ID</label>
                                <p className="text-sm font-mono text-surface-400 bg-surface-50 px-2 py-1 rounded inline-block mt-1">{user?.user_id || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Organization Information */}
                    <div className="card shadow-md-light">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-surface-900">
                            <Building className="w-5 h-5 text-primary-600" />
                            Organization
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Organization Name</label>
                                <p className="text-lg font-medium text-surface-900">{user?.organization?.tenant_name || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Tenant ID</label>
                                <p className="text-sm font-mono text-surface-400 bg-surface-50 px-2 py-1 rounded inline-block mt-1">{user?.tenant_id || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Connection Status (Read-only) */}
                    <div className="card shadow-md-light">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-surface-900">
                            <Phone className="w-5 h-5 text-primary-600" />
                            WhatsApp Connection
                        </h2>

                        {user?.organization?.whatsapp?.connected ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-bold">Connected</span>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Phone Number</label>
                                    <p className="font-mono text-lg text-surface-900">{user.organization.whatsapp.phone_number}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">WABA ID</label>
                                    <p className="text-sm font-mono text-surface-400 bg-surface-50 px-2 py-1 rounded inline-block mt-1">{user.organization.whatsapp.waba_id}</p>
                                </div>
                                <div className="bg-primary-50 border border-primary-100 rounded-lg p-3">
                                    <p className="text-sm text-primary-700 font-medium">
                                        ℹ️ This WhatsApp account is shared by all users in your organization.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 text-surface-400">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-medium">Not connected</span>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm text-amber-800 font-bold mb-2">
                                        WhatsApp not configured
                                    </p>
                                    <p className="text-sm text-amber-700">
                                        Contact your organization administrator to set up WhatsApp Business for your organization.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="card shadow-md-light border-red-100">
                        <h2 className="text-xl font-semibold mb-6 text-surface-900">Account Actions</h2>

                        {/* Logout Success Message */}
                        {logoutSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                                <p className="text-sm font-semibold">✓ Logged out successfully. Redirecting...</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Logout Button */}
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                disabled={loggingOut}
                                className="btn-secondary w-full flex items-center justify-center gap-2 py-3"
                            >
                                {loggingOut ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Logging out...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="w-5 h-5" />
                                        Logout from this device
                                    </>
                                )}
                            </button>

                            {/* Logout All Devices Button */}
                            <button
                                onClick={() => setShowLogoutAllConfirm(true)}
                                disabled={loggingOut}
                                className="btn-danger w-full flex items-center justify-center gap-2 py-3"
                            >
                                <Shield className="w-5 h-5" />
                                Logout All Devices
                            </button>

                            <p className="text-sm text-surface-500 text-center mt-2">
                                Use "Logout All Devices" if you suspect unauthorized access to your account. This will sign you out from all active sessions.
                            </p>
                        </div>

                        {/* Logout Confirmation Dialog */}
                        {showLogoutConfirm && (
                            <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                                <div className="bg-white rounded-xl shadow-2xl-light p-8 max-w-md w-full mx-4 border border-surface-200">
                                    <h3 className="text-2xl font-bold mb-2 text-surface-900">Confirm Logout</h3>
                                    <p className="text-surface-500 mb-8">
                                        Are you sure you want to logout from this device?
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setShowLogoutConfirm(false)}
                                            className="btn-secondary flex-1 py-3"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="btn-danger flex-1 py-3"
                                        >
                                            Yes, Logout
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Logout All Confirmation Dialog */}
                        {showLogoutAllConfirm && (
                            <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                                <div className="bg-white rounded-xl shadow-2xl-light p-8 max-w-md w-full mx-4 border border-surface-200">
                                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-red-600">
                                        <Shield className="w-8 h-8" />
                                        Logout All Devices
                                    </h3>
                                    <p className="text-surface-600 mb-4 font-medium">
                                        This will sign you out from <strong>all active sessions</strong> on all devices, including this one.
                                    </p>
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-8">
                                        <p className="text-sm text-amber-800 font-semibold">
                                            ⚠️ You'll need to login again on all devices.
                                        </p>
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setShowLogoutAllConfirm(false)}
                                            className="btn-secondary flex-1 py-3"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleLogoutAll}
                                            className="btn-danger flex-1 py-3"
                                        >
                                            Logout All Devices
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
