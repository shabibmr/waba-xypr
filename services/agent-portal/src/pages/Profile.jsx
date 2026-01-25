import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, LogOut, Loader2, Building, Phone, CheckCircle, AlertCircle } from 'lucide-react';
import authService from '../services/authService';
import whatsappService from '../services/whatsappService';

function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [whatsappStatus, setWhatsappStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const profileData = await authService.getProfile();
            const waStatus = await whatsappService.getStatus();
            setUser(profileData);
            setWhatsappStatus(waStatus);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Your Profile</h1>

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
                        <button
                            onClick={handleLogout}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
