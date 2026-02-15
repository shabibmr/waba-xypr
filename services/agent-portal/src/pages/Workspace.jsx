import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';
import { ConversationList } from '../components/ConversationComponents';
import AgentWidget from '../components/AgentWidget';
import AgentWidgetInline from '../components/AgentWidgetInline';
import Sidebar from '../components/Sidebar';
import Dashboard from './Dashboard';
import Settings from './Settings';
import authService from '../services/authService';
import conversationService from '../services/conversationService';
import messageService from '../services/messageService';
import socketService from '../services/socketService';

function Workspace() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('conversations');
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [agent, setAgent] = useState(null);

    useEffect(() => {
        loadData();
        setupSocket();

        return () => {
            socketService.disconnect();
        };
    }, []);

    const loadData = async () => {
        try {
            const agentData = await authService.getProfile();
            setAgent(agentData);
            authService.setAgent(agentData);

            const convData = await conversationService.getConversations();
            setConversations(convData.conversations || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            const localAgent = authService.getAgent();
            if (localAgent) setAgent(localAgent);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && agent) {
            const hasWhatsapp = agent.organization?.whatsapp?.connected;
            if (!hasWhatsapp) {
                navigate('/onboarding');
            }
        }
    }, [loading, agent, navigate]);

    const setupSocket = () => {
        socketService.connect();
        socketService.onInboundMessage(handleInboundMessage);
    };

    const handleInboundMessage = useCallback((data) => {
        console.log('Inbound message received:', data);

        setNotifications(prev => [...prev, {
            id: Date.now(),
            conversationId: data.conversationId,
            from_name: data.from_name,
            from_number: data.from,
            message: data.message
        }]);

        loadData();
    }, []);

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
