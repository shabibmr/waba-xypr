import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Wifi, LogOut, Save, X, Briefcase } from 'lucide-react';
import authService from '../services/authService';
import tenantService from '../services/tenantService';
import { useToast } from '../contexts/ToastContext';
import useAuth from '../hooks/useAuth';

function Settings({ agent }) {
    const navigate = useNavigate();
    const { refreshProfile, logout } = useAuth();
    const toast = useToast();
    const whatsapp = agent?.organization?.whatsapp;
    const genesys = agent?.organization?.genesys;

    // Edit modes
    const [editingProfile, setEditingProfile] = useState(false);
    const [editingGenesys, setEditingGenesys] = useState(false);
    const [editingWhatsApp, setEditingWhatsApp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [whatsappToken, setWhatsappToken] = useState('');

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

    const handleLogout = async () => {
        setLoading(true);
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed', error);
            // Force navigation even if logout fails
            navigate('/login');
        } finally {
            setLoading(false);
        }
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

    const handleSaveWhatsAppToken = async () => {
        setLoading(true);
        try {
            await tenantService.updateWhatsAppToken(whatsappToken.trim());
            toast.success('WhatsApp access token updated!');
            setEditingWhatsApp(false);
            setWhatsappToken('');
        } catch (error) {
            toast.error(error.message || 'Failed to update WhatsApp token');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 p-6 overflow-y-auto bg-surface-50">
            <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-6 h-6 text-primary-600" />
                <h2 className="text-xl font-bold text-surface-900">Settings</h2>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Profile */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-100">
                        <div className="flex items-center gap-2">
                            <User className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-semibold text-surface-900">Organization Profile</h3>
                        </div>
                        {!editingProfile && (
                            <button
                                onClick={() => setEditingProfile(true)}
                                className="text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {editingProfile ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Organization Name</label>
                                <input
                                    type="text"
                                    value={profileData.organizationName}
                                    onChange={(e) => setProfileData({ ...profileData, organizationName: e.target.value })}
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    value={profileData.email}
                                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Timezone</label>
                                <select
                                    value={profileData.timezone}
                                    onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                                    className="input-field w-full"
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
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                <span className="text-surface-500">Name</span>
                                <span className="font-medium text-surface-900">{agent?.organization?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                <span className="text-surface-500">Email</span>
                                <span className="font-medium text-surface-900">{agent?.email || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-surface-500">Timezone</span>
                                <span className="font-medium text-surface-900">{agent?.organization?.timezone || 'UTC'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Genesys */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-100">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-accent-500" />
                            <h3 className="text-lg font-semibold text-surface-900">Genesys Cloud</h3>
                        </div>
                        {!editingGenesys && (
                            <button
                                onClick={() => setEditingGenesys(true)}
                                className="text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                    </div>

                    {editingGenesys ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Client ID</label>
                                <input
                                    type="text"
                                    value={genesysData.clientId}
                                    onChange={(e) => setGenesysData({ ...genesysData, clientId: e.target.value })}
                                    className="input-field w-full font-mono text-sm"
                                    placeholder="Enter Client ID"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Client Secret</label>
                                <input
                                    type="password"
                                    value={genesysData.clientSecret}
                                    onChange={(e) => setGenesysData({ ...genesysData, clientSecret: e.target.value })}
                                    className="input-field w-full font-mono text-sm"
                                    placeholder="Enter new secret (leave blank to keep current)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-600 mb-1.5">Region</label>
                                <select
                                    value={genesysData.region}
                                    onChange={(e) => setGenesysData({ ...genesysData, region: e.target.value })}
                                    className="input-field w-full"
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
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                <span className="text-surface-500">Client ID</span>
                                <span className="font-mono text-surface-900 bg-surface-100 px-2 py-0.5 rounded">{genesys?.client_id ? `${genesys.client_id.substring(0, 8)}...` : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                <span className="text-surface-500">Region</span>
                                <span className="font-medium text-surface-900">{genesys?.region || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-surface-500">Status</span>
                                <span className="text-primary-600 font-semibold flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                                    Connected
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* WhatsApp */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-100">
                        <div className="flex items-center gap-2">
                            <Wifi className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-semibold text-surface-900">WhatsApp Business</h3>
                        </div>
                        {whatsapp && !editingWhatsApp && (
                            <button
                                onClick={() => setEditingWhatsApp(true)}
                                className="text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                    {whatsapp ? (
                        <>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                    <span className="text-surface-500">WABA ID</span>
                                    <span className="font-mono text-surface-900 bg-surface-100 px-2 py-0.5 rounded">{whatsapp.waba_id || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 border-b border-surface-50">
                                    <span className="text-surface-500">Phone Number</span>
                                    <span className="font-medium text-surface-900">{whatsapp.phone_number || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-surface-500">Status</span>
                                    <span className="text-primary-600 font-semibold flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                                        Connected
                                    </span>
                                </div>
                            </div>

                            {editingWhatsApp ? (
                                <div className="mt-4 pt-4 border-t border-surface-200 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-surface-600 mb-1.5">Meta Access Token</label>
                                        <input
                                            type="password"
                                            value={whatsappToken}
                                            onChange={(e) => setWhatsappToken(e.target.value)}
                                            className="input-field w-full font-mono text-sm"
                                            placeholder="Paste new Meta access token"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveWhatsAppToken}
                                            disabled={loading || !whatsappToken.trim()}
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            Save Token
                                        </button>
                                        <button
                                            onClick={() => { setEditingWhatsApp(false); setWhatsappToken(''); }}
                                            disabled={loading}
                                            className="btn-secondary flex items-center gap-2"
                                        >
                                            <X className="w-4 h-4" />
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleReconnect}
                                    className="mt-4 text-xs font-semibold text-accent-600 hover:text-accent-700 transition-colors uppercase tracking-wider"
                                >
                                    Reconnect via Onboarding
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-surface-500 text-sm mb-4">WhatsApp not configured</p>
                            <button onClick={handleReconnect} className="btn-primary">
                                <Plus className="w-4 h-4 mr-2 inline" />
                                Connect WhatsApp
                            </button>
                        </div>
                    )}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="btn-danger w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <LogOut className="w-5 h-5" />
                    )}
                    {loading ? 'Logging out...' : 'Logout'}
                </button>
            </div>
        </div>
    );
}

export default Settings;
