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
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Your Profile</h1>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="grid gap-6">
                    {/* User Information */}
                    <div className="card">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Personal Information
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400">Full Name</label>
                                <p className="text-lg">{user?.name || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Email Address</label>
                                <div className="flex items-center gap-2 text-lg">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {user?.email || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Role</label>
                                <p className="text-sm">
                                    <span className="inline-block px-3 py-1 bg-blue-600 rounded-full capitalize">
                                        {user?.role || 'agent'}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">User ID</label>
                                <p className="text-sm font-mono text-gray-300">{user?.user_id || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Organization Information */}
                    <div className="card">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5" />
                            Organization
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-400">Organization Name</label>
                                <p className="text-lg">{user?.organization?.tenant_name || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400">Tenant ID</label>
                                <p className="text-sm font-mono text-gray-300">{user?.tenant_id || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp Connection Status (Read-only) */}
                    <div className="card">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Phone className="w-5 h-5" />
                            WhatsApp Connection
                        </h2>

                        {user?.organization?.whatsapp?.connected ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-green-400">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">Connected</span>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">Phone Number</label>
                                    <p className="font-mono text-lg">{user.organization.whatsapp.phone_number}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">WABA ID</label>
                                    <p className="text-sm font-mono text-gray-300">{user.organization.whatsapp.waba_id}</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-3">
                                    <p className="text-sm text-blue-400">
                                        ℹ️ This WhatsApp account is shared by all users in your organization.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Not connected</span>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
                                    <p className="text-sm text-yellow-400 font-medium mb-2">
                                        WhatsApp not configured
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Contact your organization administrator to set up WhatsApp Business for your organization.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="card">
                        <h2 className="text-xl font-semibold mb-4">Account Actions</h2>

                        {/* Logout Success Message */}
                        {logoutSuccess && (
                            <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4">
                                <p className="text-sm font-medium">✓ Logged out successfully. Redirecting...</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {/* Logout Button */}
                            <button
                                onClick={() => setShowLogoutConfirm(true)}
                                disabled={loggingOut}
                                className="btn-secondary w-full flex items-center justify-center gap-2"
                            >
                                {loggingOut ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Logging out...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="w-5 h-5" />
                                        Logout
                                    </>
                                )}
                            </button>

                            {/* Logout All Devices Button */}
                            <button
                                onClick={() => setShowLogoutAllConfirm(true)}
                                disabled={loggingOut}
                                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Shield className="w-5 h-5" />
                                Logout All Devices
                            </button>

                            <p className="text-xs text-gray-400 mt-2">
                                Use "Logout All Devices" if you suspect unauthorized access to your account. This will sign you out from all active sessions.
                            </p>
                        </div>

                        {/* Logout Confirmation Dialog */}
                        {showLogoutConfirm && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                                    <h3 className="text-xl font-semibold mb-2">Confirm Logout</h3>
                                    <p className="text-gray-400 mb-6">
                                        Are you sure you want to logout from this device?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowLogoutConfirm(false)}
                                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                        >
                                            Yes, Logout
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Logout All Confirmation Dialog */}
                        {showLogoutAllConfirm && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                                    <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                        <Shield className="w-6 h-6 text-red-500" />
                                        Logout All Devices
                                    </h3>
                                    <p className="text-gray-400 mb-4">
                                        This will sign you out from <strong>all active sessions</strong> on all devices, including this one.
                                    </p>
                                    <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-3 mb-6">
                                        <p className="text-sm text-yellow-400">
                                            ⚠️ You'll need to login again on all devices.
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowLogoutAllConfirm(false)}
                                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleLogoutAll}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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
