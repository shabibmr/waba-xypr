import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { ConversationList } from '../components/ConversationComponents';
import AgentWidget from '../components/AgentWidget';
import AgentWidgetInline from '../components/AgentWidgetInline';
import Sidebar from '../components/Sidebar';
import Dashboard from './Dashboard';
import Templates from './Templates';
import Settings from './Settings';
import authService from '../services/authService';
import { useConversations } from '../hooks/useConversations';
import { useSocket } from '../contexts/SocketContext';

function Workspace() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('conversations');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [agent, setAgent] = useState(null);

    const { data: conversations = [], isLoading: loading, refetch } = useConversations();
    const { isConnected } = useSocket();

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
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                <div className="flex items-center gap-3">
                    <MessageSquare className="w-8 h-8 text-blue-500" />
                    <div>
                        <h1 className="text-xl font-bold">Agent Workspace</h1>
                        <p className="text-sm text-gray-400">{agent?.name || 'Agent'}</p>
                    </div>
                </div>
            </header>

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
