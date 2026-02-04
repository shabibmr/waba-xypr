import React from 'react';
import { MessageSquare, BarChart3, Settings } from 'lucide-react';

const tabs = [
    { id: 'conversations', label: 'Chats', icon: MessageSquare },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
];

function Sidebar({ activeTab, onTabChange }) {
    return (
        <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onTabChange(id)}
                    className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition text-xs gap-0.5 ${
                        activeTab === id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                    title={label}
                >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] leading-tight">{label}</span>
                </button>
            ))}
        </div>
    );
}

export default Sidebar;
