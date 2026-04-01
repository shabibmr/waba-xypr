import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { ConversationList } from '../components/ConversationComponents';
import AgentWidget from '../components/AgentWidget';
import AgentWidgetInline from '../components/AgentWidgetInline';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Dashboard from './Dashboard';
import Templates from './Templates';
import Settings from './Settings';
import authService from '../services/authService';
import { useConversations } from '../hooks/useConversations';
import { useSocket } from '../contexts/SocketContext';
import { useView } from '../contexts/ViewContext';

function Workspace() {
    const navigate = useNavigate();
    const { currentView } = useView();
    const [activeTab, setActiveTab] = useState(() => {
        // Load last active tab for current view from localStorage
        const savedTab = localStorage.getItem(`activeTab_${currentView}`);
        return savedTab || (currentView === 'agent' ? 'conversations' : 'dashboard');
    });
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [agent, setAgent] = useState(null);

    const { data: conversations = [], isLoading: loading, refetch } = useConversations();
    const { isConnected } = useSocket();

    // Persist active tab per view
    useEffect(() => {
        localStorage.setItem(`activeTab_${currentView}`, activeTab);
    }, [activeTab, currentView]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const agentData = await authService.getProfile();
            setAgent(agentData);
            authService.setAgent(agentData);
        } catch (error) {
            console.error('Failed to load profile:', error);
            const localAgent = authService.getAgent();
            if (localAgent) setAgent(localAgent);
        }
    };

    useEffect(() => {
        if (agent) {
            const hasWhatsapp = agent.organization?.whatsapp?.connected;
            if (!hasWhatsapp) {
                navigate('/onboarding');
            }
        }
    }, [agent, navigate]);

    const handleSelectConversation = async (conversation) => {
        setSelectedConversation(conversation);
    };

    const handleDismissNotification = (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleViewConversation = (conversationId) => {
        const conv = conversations.find(c => c.conversation_id === conversationId);
        if (conv) {
            setActiveTab('conversations');
            handleSelectConversation(conv);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            {/* Header with View Switcher */}
            <Header agent={agent} />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

                {activeTab === 'conversations' && (
                    <>
                        <ConversationList
                            conversations={conversations}
                            onSelect={handleSelectConversation}
                            selectedId={selectedConversation?.conversation_id}
                        />
                        <AgentWidgetInline
                            conversationId={selectedConversation?.conversation_id}
                        />
                    </>
                )}

                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'templates' && <Templates />}
                {activeTab === 'settings' && <Settings agent={agent} />}
            </div>

            {/* Agent Widget for Notifications */}
            <AgentWidget
                notifications={notifications}
                onDismiss={handleDismissNotification}
                onViewConversation={handleViewConversation}
            />
        </div>
    );
}

export default Workspace;
