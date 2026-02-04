// admin-dashboard/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity,
    MessageSquare,
    Database,
    Users,
    RefreshCw,
    AlertCircle,
    Building2,
    ChevronRight,
    Settings,
    Shield
} from 'lucide-react';

const API_GATEWAY = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [services, setServices] = useState({});
    const [recentTenants, setRecentTenants] = useState([]);
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

            // Fetch recent tenants
            const tenantsRes = await fetch('/tenants');
            const tenantsData = await tenantsRes.json();
            setRecentTenants(tenantsData.slice(0, 5));

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

            {/* Service Status & Recent Tenants */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 card">
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Service Health
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(services).map(([name, service]) => (
                            <div key={name} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 transition-all hover:bg-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-gray-200">{name}</span>
                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(service.status)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`}></div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{service.status}</span>
                                    {service.data?.version && <span className="text-[10px] text-gray-600 font-mono">v{service.data.version}</span>}
                                </div>
                                {service.data?.redis && (
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Redis: {service.data.redis}
                                    </div>
                                )}
                                {service.data?.rabbitmq && (
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        RabbitMQ: {service.data.rabbitmq}
                                    </div>
                                )}
                                {service.error && (
                                    <div className="text-[10px] text-red-100 mt-2 bg-red-400/5 p-1.5 rounded border border-red-400/10 font-mono truncate">
                                        {service.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-purple-400" />
                            Recent Tenants
                        </h2>
                        <Link to="/tenants" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium rounded p-1 transition-all">
                            View All
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {recentTenants.length > 0 ? (
                            recentTenants.map((tenant) => (
                                <Link
                                    key={tenant.tenant_id}
                                    to={`/tenants/${tenant.tenant_id}`}
                                    className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/30 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg group-hover:bg-blue-500 group-hover:text-white transition-all">
                                            {tenant.name?.[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{tenant.name}</div>
                                            <div className="text-[10px] text-gray-500 font-mono">{new Date(tenant.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-gray-600 text-xs italic">No recently added tenants</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* System Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="card bg-gray-800/20 border-gray-700/50">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" />
                        System Config
                    </h2>
                    <div className="space-y-1">
                        <InfoRow label="API Gateway" value={API_GATEWAY} />
                        <InfoRow label="Tenant Service" value="http://localhost:3007" />
                        <InfoRow label="Environment" value={import.meta.env.MODE || 'development'} />
                    </div>
                </div>

                <div className="card bg-gray-800/20 border-gray-700/50 flex flex-col justify-center items-center text-center">
                    <div className="p-3 rounded-full bg-green-500/10 border border-green-500/20 mb-3">
                        <Shield className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tighter">System Secure</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">All security protocols are operational and monitoring active sessions.</p>
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
