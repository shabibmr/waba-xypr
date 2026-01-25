// admin-dashboard/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Activity, MessageSquare, Database, Users, RefreshCw, AlertCircle } from 'lucide-react';

const API_GATEWAY = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [services, setServices] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            setError(null);

            // Fetch stats
            const statsRes = await fetch(`${API_GATEWAY}/state/stats`);
            const statsData = await statsRes.json();
            setStats(statsData);

            // Check service health
            const serviceChecks = {
                'API Gateway': `${API_GATEWAY}/health`,
                'Webhook Handler': `${API_GATEWAY}/webhook/health`,
                'Inbound Transformer': `${API_GATEWAY}/transform/inbound/health`,
                'Outbound Transformer': `${API_GATEWAY}/transform/outbound/health`,
                'Auth Service': `${API_GATEWAY}/auth/health`,
                'State Manager': `${API_GATEWAY}/state/health`,
                'Tenant Service': `http://localhost:3007/health`
            };

            const healthChecks = await Promise.all(
                Object.entries(serviceChecks).map(async ([name, url]) => {
                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        return [name, { status: res.ok ? 'healthy' : 'unhealthy', data }];
                    } catch (err) {
                        return [name, { status: 'unreachable', error: err.message }];
                    }
                })
            );

            setServices(Object.fromEntries(healthChecks));
            setLoading(false);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'healthy': return 'bg-green-600';
            case 'unhealthy': return 'bg-yellow-600';
            case 'unreachable': return 'bg-red-600';
            default: return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold">System Dashboard</h1>
                    <p className="text-gray-400 mt-2">WhatsApp ↔ Genesys Cloud Integration</p>
                </div>
                <button
                    onClick={fetchData}
                    className="btn btn-primary"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="alert alert-error mb-6">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <div className="font-semibold">Error Loading Data</div>
                        <div className="text-sm">{error}</div>
                    </div>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    icon={Users}
                    title="Total Conversations"
                    value={stats?.totalMappings || 0}
                    subtitle={`${stats?.activeConversations || 0} active`}
                    color="blue"
                />
                <StatCard
                    icon={MessageSquare}
                    title="Total Messages"
                    value={stats?.totalMessages || 0}
                    subtitle="All time"
                    color="green"
                />
                <StatCard
                    icon={Database}
                    title="System Status"
                    value={Object.values(services).filter(s => s.status === 'healthy').length}
                    subtitle={`of ${Object.keys(services).length} services healthy`}
                    color="purple"
                />
            </div>

            {/* Service Status */}
            <div className="card">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Service Health
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(services).map(([name, service]) => (
                        <div key={name} className="bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{name}</span>
                                <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`}></div>
                            </div>
                            <div className="text-sm text-gray-400 capitalize">{service.status}</div>
                            {service.data?.redis && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Redis: {service.data.redis}
                                </div>
                            )}
                            {service.data?.rabbitmq && (
                                <div className="text-xs text-gray-500 mt-1">
                                    RabbitMQ: {service.data.rabbitmq}
                                </div>
                            )}
                            {service.error && (
                                <div className="text-xs text-red-400 mt-1">{service.error}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* System Information */}
            <div className="card mt-6">
                <h2 className="text-2xl font-semibold mb-4">System Information</h2>
                <div className="space-y-3">
                    <InfoRow label="API Gateway" value={API_GATEWAY} />
                    <InfoRow label="Last Updated" value={new Date().toLocaleString()} />
                    <InfoRow label="Environment" value={import.meta.env.MODE || 'development'} />
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, title, value, subtitle, color }) {
    const colorMap = {
        blue: 'bg-blue-600',
        green: 'bg-green-600',
        purple: 'bg-purple-600'
    };

    return (
        <div className="card">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-gray-400 text-sm mb-1">{title}</div>
                    <div className="text-3xl font-bold">{value}</div>
                    <div className="text-gray-500 text-sm mt-1">{subtitle}</div>
                </div>
                <div className={`${colorMap[color]} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

export default Dashboard;
