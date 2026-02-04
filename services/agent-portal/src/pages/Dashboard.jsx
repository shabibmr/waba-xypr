import React, { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, CheckCircle, Clock, Activity } from 'lucide-react';
import conversationService from '../services/conversationService';

function Dashboard() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

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
        { label: 'Total Conversations', value: total, icon: MessageSquare, color: 'text-blue-400' },
        { label: 'Active', value: active, icon: Activity, color: 'text-green-400' },
        { label: 'Closed', value: closed, icon: CheckCircle, color: 'text-gray-400' },
        { label: 'Today', value: todayConversations.length, icon: Clock, color: 'text-yellow-400' },
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold">Dashboard</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${color}`} />
                            <span className="text-sm text-gray-400">{label}</span>
                        </div>
                        <p className="text-2xl font-bold">{value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="px-4 py-3 border-b border-gray-700">
                    <h3 className="font-semibold">Recent Activity</h3>
                </div>
                {recent.length === 0 ? (
                    <p className="p-4 text-gray-400 text-sm">No conversations yet.</p>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {recent.map((conv) => (
                            <div key={conv.conversation_id || conv.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">{conv.customer_name || conv.from_number || 'Unknown'}</p>
                                    <p className="text-xs text-gray-400">{conv.last_message || ''}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    conv.status === 'active' || conv.status === 'open'
                                        ? 'bg-green-900 text-green-300'
                                        : 'bg-gray-700 text-gray-400'
                                }`}>
                                    {conv.status || 'unknown'}
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
