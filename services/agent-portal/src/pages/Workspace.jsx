import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, User as UserIcon, Settings, LogOut, Loader2 } from 'lucide-react';
import { ConversationList, MessageThread } from '../components/ConversationComponents';
import AgentWidget from '../components/AgentWidget';
import authService from '../services/authService';
import conversationService from '../services/conversationService';
import messageService from '../services/messageService';
import socketService from '../services/socketService';

function Workspace() {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
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
            const agentData = authService.getAgent();
            setAgent(agentData);

            const convData = await conversationService.getConversations();
            setConversations(convData.conversations || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const setupSocket = () => {
        socketService.connect();
        socketService.onInboundMessage(handleInboundMessage);
    };

    const handleInboundMessage = useCallback((data) => {
        console.log('Inbound message received:', data);

        // Add to notifications
        setNotifications(prev => [...prev, {
            id: Date.now(),
            conversationId: data.conversationId,
            from_name: data.from_name,
            from_number: data.from,
            message: data.message
        }]);

        // Refresh conversations list
        loadData();
    }, []);

    const handleSelectConversation = async (conversation) => {
        setSelectedConversation(conversation);

        try {
            const msgData = await conversationService.getMessages(conversation.conversation_id);
            setMessages(msgData.messages || []);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    };

    const handleSendMessage = async (messageData) => {
        try {
            await messageService.sendMessage(messageData);

            // Refresh messages
            const msgData = await conversationService.getMessages(selectedConversation.conversation_id);
            setMessages(msgData.messages || []);
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
        }
    };

    const handleDismissNotification = (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    const handleViewConversation = (conversationId) => {
        const conv = conversations.find(c => c.conversation_id === conversationId);
        if (conv) {
            handleSelectConversation(conv);
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
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-bold">Agent Workspace</h1>
                            <p className="text-sm text-gray-400">WhatsApp Conversations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/profile')}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700 rounded transition"
                        >
                            <UserIcon className="w-5 h-5" />
                            <span>{agent?.name || 'Agent'}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-gray-700 rounded transition"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <ConversationList
                    conversations={conversations}
                    onSelect={handleSelectConversation}
                    selectedId={selectedConversation?.conversation_id}
                />
                <MessageThread
                    conversation={selectedConversation}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                />
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
