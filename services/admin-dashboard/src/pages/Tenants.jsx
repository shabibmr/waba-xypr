// admin-dashboard/src/pages/Tenants.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus,
    RefreshCw,
    Search,
    Building2,
    CheckCircle,
    XCircle,
    ExternalLink,
    Shield,
    Globe,
    CreditCard
} from 'lucide-react';
import axios from 'axios';

function Tenants() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get('/tenants');
            setTenants(response.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredTenants = tenants.filter(tenant =>
        tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.tenant_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tenant.genesys_org_id && tenant.genesys_org_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="spinner"></div>
                    <p className="text-gray-400 animate-pulse">Fetching tenant data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                        Tenants Management
                    </h1>
                    <p className="text-gray-400 mt-2 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-400" />
                        Configure and monitor organization-level integrations
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchTenants}
                        className="btn btn-secondary border border-gray-700 hover:border-gray-500"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <Link to="/tenants/new" className="btn btn-primary shadow-lg shadow-blue-600/20">
                        <Plus className="w-4 h-4" />
                        New Tenant
                    </Link>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-6 backdrop-blur-md bg-red-900/10 border-red-500/30">
                    <XCircle className="w-5 h-5" />
                    <div>
                        <div className="font-semibold text-red-400">Connection Error</div>
                        <div className="text-sm opacity-80">{error}</div>
                    </div>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Organizations"
                    value={tenants.length}
                    icon={Building2}
                    color="blue"
                />
                <StatCard
                    title="Active Deployments"
                    value={tenants.filter(t => t.status === 'active').length}
                    icon={CheckCircle}
                    color="green"
                />
                <StatCard
                    title="Service Domains"
                    value={tenants.filter(t => t.subdomain).length}
                    icon={Globe}
                    color="purple"
                />
                <StatCard
                    title="Enterprise Tier"
                    value={tenants.filter(t => t.plan === 'enterprise' || t.plan === 'professional').length}
                    icon={CreditCard}
                    color="yellow"
                />
            </div>

            {/* Control Bar */}
            <div className="card mb-6 border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name, ID, or Genesys Org ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-11 bg-gray-900/50 border-gray-700 focus:border-blue-500/50"
                    />
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="card overflow-hidden border border-gray-700/30 bg-gray-800/40 backdrop-blur-md">
                <div className="overflow-x-auto">
                    {filteredTenants.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="bg-gray-700/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Building2 className="w-10 h-10 text-gray-500" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-300">
                                {searchTerm ? 'No results found' : 'No tenants configured'}
                            </h3>
                            <p className="text-gray-500 mt-2 max-w-xs mx-auto">
                                {searchTerm
                                    ? `We couldn't find any tenants matching "${searchTerm}"`
                                    : 'Start by creating your first tenant organization to begin integration.'}
                            </p>
                            {!searchTerm && (
                                <Link to="/tenants/new" className="btn btn-primary mt-6">
                                    <Plus className="w-4 h-4" />
                                    Get Started
                                </Link>
                            )}
                        </div>
                    ) : (
                        <table className="table w-full text-left">
                            <thead className="bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Organization</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Status</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Infrastructure</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Genesys ID</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400">Plan</th>
                                    <th className="px-6 py-4 font-semibold text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredTenants.map((tenant) => (
                                    <tr key={tenant.tenant_id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                                    {tenant.name}
                                                </span>
                                                <span className="text-xs text-gray-500 font-mono">
                                                    {tenant.tenant_id}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {tenant.status === 'active' ? (
                                                <span className="badge badge-success bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-2"></div>
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="badge badge-error bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2"></div>
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm flex items-center gap-1.5">
                                                    <Globe className="w-3.5 h-3.5 text-blue-400/70" />
                                                    <span className={tenant.subdomain ? 'text-blue-300' : 'text-gray-600 italic'}>
                                                        {tenant.subdomain || 'no domain'}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    Created {new Date(tenant.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {tenant.genesys_org_id ? (
                                                <code className="text-[11px] bg-gray-900 px-2 py-1 rounded text-gray-400 border border-gray-700">
                                                    {tenant.genesys_org_id}
                                                </code>
                                            ) : (
                                                <span className="text-gray-600 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider
                                                ${tenant.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                    tenant.plan === 'professional' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                        'bg-gray-700 text-gray-400 border border-gray-600'}
                                            `}>
                                                {tenant.plan || 'standard'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/tenants/${tenant.tenant_id}`}
                                                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                            >
                                                Manage
                                                <ExternalLink className="w-4 h-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }) {
    const colors = {
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: 'bg-blue-600' },
        green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', icon: 'bg-green-600' },
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', icon: 'bg-purple-600' },
        yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', icon: 'bg-yellow-600' }
    };

    const style = colors[color] || colors.blue;

    return (
        <div className={`card group hover:scale-[1.02] transition-all duration-300 border ${style.border} ${style.bg} backdrop-blur-md`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                    <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
                        {value}
                    </div>
                </div>
                <div className={`${style.icon} p-2.5 rounded-xl shadow-lg shadow-black/20 group-hover:rotate-12 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>
        </div>
    );
}

export default Tenants;
