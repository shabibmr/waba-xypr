import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Loader2, User, Clock, Phone, Search, Filter } from 'lucide-react';
import conversationService from '../services/conversationService';
import messageService from '../services/messageService';

function ConversationList({ conversations, onSelect, selectedId }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, closed

    // Filter conversations based on search and status
    const filteredConversations = conversations.filter((conv) => {
        // Status filter
        if (statusFilter === 'active' && conv.status !== 'active' && conv.status !== 'open') return false;
        if (statusFilter === 'closed' && conv.status !== 'closed') return false;

        // Search filter (name or phone)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const name = (conv.contact_name || '').toLowerCase();
            const phone = (conv.wa_id || '').toLowerCase();
            return name.includes(query) || phone.includes(query);
        }

        return true;
    });

    return (
        <div className="bg-white border-r border-surface-200 w-72 flex flex-col">
            <div className="p-4 border-b border-surface-200">
                <h2 className="text-lg font-semibold mb-3 text-surface-900">Conversations</h2>

                {/* Search Input */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search by name or number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
                    />
                </div>

                {/* Status Filter */}
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface-50 border border-surface-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
                    >
                        <option value="all">All Conversations</option>
                        <option value="active">Active Only</option>
                        <option value="closed">Closed Only</option>
                    </select>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-surface-500">
                        <p>{searchQuery || statusFilter !== 'all' ? 'No matching conversations' : 'No conversations yet'}</p>
                    </div>
                ) : (
                    filteredConversations.map((conv) => (
                        <button
                            key={conv.conversation_id}
                            onClick={() => onSelect(conv)}
                            className={`w-full p-4 border-b border-surface-100 text-left hover:bg-surface-50 transition ${selectedId === conv.conversation_id ? 'bg-surface-50' : ''
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-medium truncate text-surface-900">{conv.contact_name || 'Unknown'}</p>
                                        {conv.unread_count > 0 && (
                                            <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                                                {conv.unread_count}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-surface-500">
                                        <Phone className="w-3 h-3" />
                                        {conv.wa_id}
                                    </div>
                                    {conv.last_message && (
                                        <p className="text-sm text-surface-500 truncate mt-1">
                                            {conv.last_message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

function MessageThread({ conversation, messages, onSendMessage }) {
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!messageText.trim() || sending) return;

        setSending(true);
        try {
            await onSendMessage({
                to: conversation.wa_id,
                text: messageText
            });
            setMessageText('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
    };

    if (!conversation) {
        return (
            <div className="flex-1 flex items-center justify-center text-surface-400">
                <p>Select a conversation to start messaging</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-surface-200 p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-medium text-surface-900">{conversation.contact_name || 'Unknown Contact'}</p>
                        <p className="text-sm text-surface-500">{conversation.wa_id}</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-md px-4 py-2 rounded-lg ${msg.direction === 'outbound'
                                ? 'bg-primary-600 text-white'
                                : 'bg-surface-100 text-surface-900'
                                }`}
                        >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs opacity-70">
                                <Clock className="w-3 h-3" />
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="bg-white border-t border-surface-200 p-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="p-2 hover:bg-surface-100 rounded transition"
                        title="Attach file"
                    >
                        <Paperclip className="w-5 h-5 text-surface-400" />
                    </button>
                    <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 input-field"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={sending || !messageText.trim()}
                        className="btn-primary px-4"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export { ConversationList, MessageThread };
