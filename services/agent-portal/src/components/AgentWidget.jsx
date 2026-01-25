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
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
            <div className="bg-gray-800 border border-blue-500 rounded-lg shadow-2xl max-w-sm w-80">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-semibold">New Message</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-white/20 rounded transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">{currentNotification.from_name || 'Unknown'}</p>
                            <p className="text-sm text-gray-400">{currentNotification.from_number}</p>
                        </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-3 mb-4">
                        <p className="text-sm">{currentNotification.message}</p>
                    </div>

                    <button
                        onClick={handleView}
                        className="btn-primary w-full"
                    >
                        View Conversation
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AgentWidget;
