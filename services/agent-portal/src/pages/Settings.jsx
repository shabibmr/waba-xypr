import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Wifi, LogOut } from 'lucide-react';
import authService from '../services/authService';

function Settings({ agent }) {
    const navigate = useNavigate();
    const whatsapp = agent?.organization?.whatsapp;

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const handleReconnect = () => {
        navigate('/onboarding');
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
                    <div className="flex items-center gap-2 mb-4">
                        <User className="w-4 h-4 text-blue-400" />
                        <h3 className="font-semibold">Profile</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Name</span>
                            <span>{agent?.name || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Email</span>
                            <span>{agent?.email || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Role</span>
                            <span>{agent?.role || 'Agent'}</span>
                        </div>
                    </div>
                </div>

                {/* WhatsApp */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Wifi className="w-4 h-4 text-green-400" />
                        <h3 className="font-semibold">WhatsApp Connection</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Status</span>
                            <span className={whatsapp?.connected ? 'text-green-400' : 'text-red-400'}>
                                {whatsapp?.connected ? 'Connected' : 'Not Connected'}
                            </span>
                        </div>
                        {whatsapp?.waba_id && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">WABA ID</span>
                                <span>{whatsapp.waba_id}</span>
                            </div>
                        )}
                        {whatsapp?.phone_number && (
                            <div className="flex justify-between">
                                <span className="text-gray-400">Phone Number</span>
                                <span>{whatsapp.phone_number}</span>
                            </div>
                        )}
                        <button
                            onClick={handleReconnect}
                            className="mt-2 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                        >
                            {whatsapp?.connected ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
                        </button>
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </div>
        </div>
    );
}

export default Settings;
