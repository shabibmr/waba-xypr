import React, { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, CheckCircle, Clock, Activity } from 'lucide-react';
import conversationService from '../services/conversationService';
import { useSocket } from '../contexts/SocketContext';
import { useDashboard } from '../hooks/useDashboard';

function Dashboard() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isConnected } = useSocket();

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await conversationService.getConversations();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const total = conversations.length;
    const active = conversations.filter(c => c.status === 'active' || c.status === 'open').length;
    const closed = conversations.filter(c => c.status === 'closed').length;

    const today = new Date().toDateString();
    const todayConversations = conversations.filter(c => {
        const created = new Date(c.created_at || c.createdAt);
        return created.toDateString() === today;
    });

    const recent = [...conversations]
        .sort((a, b) => new Date(b.updated_at || b.updatedAt || b.created_at) - new Date(a.updated_at || a.updatedAt || a.created_at))
        .slice(0, 5);

    const stats = [
        { label: 'Total Conversations', value: total, icon: MessageSquare, color: 'text-primary-600' },
        { label: 'Active', value: active, icon: Activity, color: 'text-primary-600' },
        { label: 'Closed', value: closed, icon: CheckCircle, color: 'text-surface-400' },
        { label: 'Today', value: todayConversations.length, icon: Clock, color: 'text-accent-600' },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-primary-600" />
                <h2 className="text-xl font-bold text-surface-900">Dashboard</h2>
                {isConnected && (
                    <span className="text-xs text-primary-600 flex items-center gap-1 font-medium">
                        <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></span>
                        Live
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm-light hover:shadow-light transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${color}`} />
                            <span className="text-sm text-surface-500 font-medium">{label}</span>
                        </div>
                        <p className="text-2xl font-bold text-surface-900">{value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-surface-200 shadow-sm-light overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
                    <h3 className="font-semibold text-surface-900">Recent Activity</h3>
                </div>
                {recent.length === 0 ? (
                    <p className="p-6 text-surface-500 text-sm text-center">No conversations yet.</p>
                ) : (
                    <div className="divide-y divide-surface-100">
                        {recent.map((conv) => (
                            <div key={conv.conversation_id || conv.id} className="px-4 py-3 flex items-center justify-between hover:bg-surface-50 transition">
                                <div>
                                    <p className="text-sm font-medium text-surface-900">{conv.customer_name || conv.from_number || 'Unknown'}</p>
                                    <p className="text-xs text-surface-500">{conv.last_message || ''}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    conv.status === 'active' || conv.status === 'open'
                                        ? 'bg-primary-100 text-primary-700'
                                        : 'bg-surface-100 text-surface-600'
                                }`}>
                                    {(conv.status || 'unknown').toUpperCase()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
