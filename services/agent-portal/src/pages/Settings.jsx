import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Wifi, LogOut, Save, X, Briefcase } from 'lucide-react';
import authService from '../services/authService';
import tenantService from '../services/tenantService';
import { useToast } from '../contexts/ToastContext';
import useAuth from '../hooks/useAuth';

function Settings({ agent }) {
    const navigate = useNavigate();
    const { refreshProfile } = useAuth();
    const toast = useToast();
    const whatsapp = agent?.organization?.whatsapp;
    const genesys = agent?.organization?.genesys;

    // Edit modes
    const [editingProfile, setEditingProfile] = useState(false);
    const [editingGenesys, setEditingGenesys] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form data
    const [profileData, setProfileData] = useState({
        organizationName: agent?.organization?.name || '',
        email: agent?.email || '',
        timezone: agent?.organization?.timezone || 'UTC'
    });

    const [genesysData, setGenesysData] = useState({
        clientId: genesys?.client_id || '',
        clientSecret: '',
        region: genesys?.region || 'us-east-1'
    });

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const handleReconnect = () => {
        navigate('/onboarding');
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            await tenantService.updateProfile(profileData);
            await refreshProfile();
            toast.success('Profile updated successfully!');
            setEditingProfile(false);
        } catch (error) {
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGenesys = async () => {
        setLoading(true);
        try {
            await tenantService.updateGenesysCredentials(genesysData);
            await refreshProfile();
            toast.success('Genesys credentials updated!');
            setEditingGenesys(false);
            setGenesysData({ ...genesysData, clientSecret: '' });
        } catch (error) {
            toast.error(error.message || 'Failed to update Genesys credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold">Settings</h2>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Profile */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-400" />
                            <h3 className="font-semibold">Organization Profile</h3>
                        </div>
                        {!editingProfile && (
                            <button
                                onClick={() => setEditingProfile(true)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {editingProfile ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Organization Name</label>
                                <input
                                    type="text"
                                    value={profileData.organizationName}
                                    onChange={(e) => setProfileData({ ...profileData, organizationName: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Email</label>
                                <input
                                    type="email"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Timezone</label>
                                <select
                                    value={profileData.timezone}
                                    onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                >
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">EST</option>
                                    <option value="America/Chicago">CST</option>
                                    <option value="America/Denver">MST</option>
                                    <option value="America/Los_Angeles">PST</option>
                                    <option value="Europe/London">GMT</option>
                                    <option value="Asia/Tokyo">JST</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditingProfile(false)}
                                    disabled={loading}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Name</span>
                                <span>{agent?.organization?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Email</span>
                                <span>{agent?.email || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Timezone</span>
                                <span>{agent?.organization?.timezone || 'UTC'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Genesys */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-purple-400" />
                            <h3 className="font-semibold">Genesys Cloud</h3>
                        </div>
                        {!editingGenesys && (
                            <button
                                onClick={() => setEditingGenesys(true)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {editingGenesys ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Client ID</label>
                                <input
                                    type="text"
                                    value={genesysData.clientId}
                                    onChange={(e) => setGenesysData({ ...genesysData, clientId: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="Enter Client ID"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Client Secret</label>
                                <input
                                    type="password"
                                    value={genesysData.clientSecret}
                                    onChange={(e) => setGenesysData({ ...genesysData, clientSecret: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="Enter new secret (leave blank to keep current)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-gray-400">Region</label>
                                <select
                                    value={genesysData.region}
                                    onChange={(e) => setGenesysData({ ...genesysData, region: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                >
                                    <option value="us-east-1">US East (Virginia)</option>
                                    <option value="us-west-2">US West (Oregon)</option>
                                    <option value="eu-west-1">EU West (Ireland)</option>
                                    <option value="eu-central-1">EU Central (Frankfurt)</option>
                                    <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSaveGenesys}
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingGenesys(false);
                                        setGenesysData({ ...genesysData, clientSecret: '' });
                                    }}
                                    disabled={loading}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Client ID</span>
                                <span className="font-mono">{genesys?.client_id ? `${genesys.client_id.substring(0, 8)}...` : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Region</span>
                                <span>{genesys?.region || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Status</span>
                                <span className="text-green-400">Connected</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* WhatsApp */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Wifi className="w-4 h-4 text-green-400" />
                        <h3 className="font-semibold">WhatsApp Business</h3>
                    </div>
                    {whatsapp ? (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">WABA ID</span>
                                <span className="font-mono">{whatsapp.waba_id || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Phone Number</span>
                                <span>{whatsapp.phone_number || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Status</span>
                                <span className="text-green-400">Connected</span>
                            </div>
                            <button
                                onClick={handleReconnect}
                                className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                            >
                                Reconnect / Update Token
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-gray-400 text-sm mb-3">WhatsApp not configured</p>
                            <button onClick={handleReconnect} className="btn-primary">
                                Connect WhatsApp
                            </button>
                        </div>
                    )}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

export default Settings;
