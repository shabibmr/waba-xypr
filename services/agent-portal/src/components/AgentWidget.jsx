import React, { useState, useEffect } from 'react';
import { X, MessageSquare, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function AgentWidget({ notifications, onDismiss, onViewConversation }) {
    const [visible, setVisible] = useState(false);
    const [currentNotification, setCurrentNotification] = useState(null);

    useEffect(() => {
        if (notifications.length > 0) {
            setCurrentNotification(notifications[0]);
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [notifications]);

    const handleClose = () => {
        setVisible(false);
        if (onDismiss && currentNotification) {
            onDismiss(currentNotification.id);
        }
    };

    const handleView = () => {
        if (onViewConversation && currentNotification) {
            onViewConversation(currentNotification.conversationId);
        }
        handleClose();
    };

    if (!visible || !currentNotification) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white border border-surface-200 rounded-xl shadow-2xl-light max-w-sm w-80 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-1.5 rounded-lg">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <span className="font-bold tracking-tight text-sm uppercase">New Message</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                            <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-surface-900 truncate">
                                {currentNotification.from_name || 'Unknown User'}
                            </p>
                            <p className="text-xs font-mono text-surface-500">
                                {currentNotification.from_number}
                            </p>
                        </div>
                    </div>

                    <div className="bg-surface-50 border border-surface-100 rounded-xl p-4 mb-5">
                        <p className="text-sm text-surface-700 leading-relaxed italic italic">
                            "{currentNotification.message}"
                        </p>
                    </div>

                    <button
                        onClick={handleView}
                        className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 group"
                    >
                        View Conversation
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AgentWidget;
