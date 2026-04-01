import React, { useEffect } from 'react';
import { MessageSquare, BarChart3, FileText, Settings } from 'lucide-react';
import { useView } from '../contexts/ViewContext';

// Tab configuration by view
const TABS_CONFIG = {
    agent: [
        { id: 'conversations', label: 'Chats', icon: MessageSquare },
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }
    ],
    admin: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings }
    ]
};

function Sidebar({ activeTab, onTabChange }) {
    const { currentView } = useView();

    // Get visible tabs for current view
    const visibleTabs = TABS_CONFIG[currentView];

    // Auto-switch tab if current tab not available in new view
    useEffect(() => {
        const isTabAvailable = visibleTabs.some(tab => tab.id === activeTab);
        if (!isTabAvailable && visibleTabs.length > 0) {
            onTabChange(visibleTabs[0].id);
        }
    }, [currentView, activeTab, visibleTabs, onTabChange]);

    return (
        <div className="w-16 bg-white border-r border-surface-200 flex flex-col items-center py-4 gap-1 shadow-sm-light">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onTabChange(id)}
                    className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition text-xs gap-0.5 ${
                        activeTab === id
                            ? 'bg-primary-600 text-white shadow-md-light'
                            : 'text-surface-500 hover:bg-surface-100 hover:text-primary-600'
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
