// admin-dashboard/src/pages/TenantDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    Cloud,
    MessageCircle,
    Shield,
    Settings,
    Trash2,
    CheckCircle,
    XCircle,
    Copy,
    ExternalLink,
    RefreshCw,
    Globe,
    CreditCard,
    Key,
    Phone
} from 'lucide-react';
import axios from 'axios';

const TenantDetail = () => {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState(null);
    const [genesys, setGenesys] = useState(null);
    const [whatsapp, setWhatsapp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchData();
    }, [tenantId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [tenantRes, genesysRes, whatsappRes] = await Promise.all([
                axios.get(`/tenants/${tenantId}`),
                axios.get(`/tenants/${tenantId}/genesys/credentials`).catch(() => ({ data: null })),
                axios.get(`/tenants/${tenantId}/whatsapp`).catch(() => ({ data: null }))
            ]);

            setTenant(tenantRes.data);
            setGenesys(genesysRes.data);
            setWhatsapp(whatsappRes.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete tenant ${tenant.name}? This action cannot be undone.`)) {
            return;
        }

        try {
            await axios.delete(`/tenants/${tenantId}`);
            alert('Tenant deleted successfully');
            navigate('/tenants');
        } catch (err) {
            alert(`Failed to delete tenant: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="spinner"></div>
                    <p className="text-gray-400">Loading configurations...</p>
                </div>
            </div>
        );
    }

    if (error || !tenant) {
        return (
            <div className="card border-red-500/30 bg-red-900/10 p-10">
                <div className="flex flex-col items-center text-center">
                    <XCircle className="w-16 h-16 text-red-500 mb-4" />
                    <h2 className="text-2xl font-bold text-white">Error Loading Tenant</h2>
                    <p className="text-gray-400 mt-2">{error || 'Tenant not found'}</p>
                    <Link to="/tenants" className="btn btn-secondary mt-6">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Tenants
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Navigation & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Link
                        to="/tenants"
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all border border-gray-700 text-gray-400 hover:text-white"
                        title="Back to list"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold text-white">{tenant.name}</h1>
                            <span className={`badge text-[10px] py-0.5 ${tenant.status === 'active' ? 'badge-success' : 'badge-error'}`}>
                                {tenant.status}
                            </span>
                        </div>
                        <p className="text-gray-400 font-mono text-sm mt-1">{tenant.tenant_id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData} className="btn btn-secondary border border-gray-700">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button onClick={handleDelete} className="btn border border-red-500/30 text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex border-b border-gray-700 mb-8 gap-8">
                <TabButton
                    active={activeTab === 'overview'}
                    onClick={() => setActiveTab('overview')}
                    icon={Building2}
                    label="Overview"
                />
                <TabButton
                    active={activeTab === 'genesys'}
                    onClick={() => setActiveTab('genesys')}
                    icon={Cloud}
                    label="Genesys Cloud"
                />
                <TabButton
                    active={activeTab === 'whatsapp'}
                    onClick={() => setActiveTab('whatsapp')}
                    icon={MessageCircle}
                    label="WhatsApp"
                />
            </div>

            {/* Tab Panels */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            <SectionCard title="Organization Details" icon={Shield}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <DetailRow label="Display Name" value={tenant.name} />
                                    <DetailRow label="Internal ID" value={tenant.tenant_id} />
                                    <DetailRow
                                        label="Subdomain"
                                        value={tenant.subdomain || 'Not configured'}
                                        icon={Globe}
                                    />
                                    <DetailRow
                                        label="Service Plan"
                                        value={tenant.plan || 'standard'}
                                        badge
                                        badgeType={tenant.plan === 'enterprise' ? 'purple' : 'blue'}
                                    />
                                    <DetailRow label="Created On" value={new Date(tenant.created_at).toLocaleString()} />
                                    <DetailRow label="Last Updated" value={new Date(tenant.updated_at).toLocaleString()} />
                                </div>
                            </SectionCard>

                            <SectionCard title="System Connectivity" icon={Settings}>
                                <div className="space-y-4">
                                    <StatusIndicator
                                        label="Genesys Cloud Integration"
                                        status={genesys ? 'connected' : 'not_configured'}
                                    />
                                    <StatusIndicator
                                        label="WhatsApp API Channel"
                                        status={whatsapp ? 'connected' : 'not_configured'}
                                    />
                                    <StatusIndicator
                                        label="Custom Domains"
                                        status={tenant.subdomain ? 'connected' : 'not_configured'}
                                    />
                                </div>
                            </SectionCard>
                        </div>

                        <div className="space-y-6">
                            <div className="card bg-blue-600/5 border border-blue-600/20 p-6 rounded-xl">
                                <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-widest mb-4">API Access</h4>
                                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700 flex items-center justify-between">
                                    <div className="text-xs font-mono text-gray-500 truncate mr-4">••••••••••••••••••••</div>
                                    <button
                                        className="text-blue-400 hover:text-blue-300 p-1"
                                        title="Keys can only be viewed during creation"
                                        disabled
                                    >
                                        <Shield className="w-4 h-4 opacity-50" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">
                                    API Keys are hidden for security. If you lost your key, you must rotate it.
                                </p>
                            </div>

                            <div className="card bg-gray-800/50 border border-gray-700 p-6 rounded-xl">
                                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Internal Metrics</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Active Conversations</span>
                                        <span className="font-bold text-white">--</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Messages/Month</span>
                                        <span className="font-bold text-white">--</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'genesys' && (
                    <div className="max-w-4xl space-y-6">
                        {genesys ? (
                            <>
                                <SectionCard title="Authentication Configuration" icon={Key}>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <DetailRow label="Client ID" value={genesys.clientId || '••••••••'} copyable />
                                            <DetailRow label="Client Secret" value="••••••••••••••••" copyable={false} />
                                            <DetailRow label="Region" value={genesys.region} icon={Globe} />
                                            <DetailRow label="Organization ID" value={tenant.genesys_org_id || 'Not found'} />
                                        </div>
                                        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Access Tokens</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] text-gray-600 block mb-1">Access Token (Masked)</span>
                                                    <div className="text-xs font-mono text-gray-400 truncate">
                                                        {genesys.accessToken?.substring(0, 20)}...
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-600 block mb-1">Refresh Token (Masked)</span>
                                                    <div className="text-xs font-mono text-gray-400 truncate">
                                                        {genesys.refreshToken?.substring(0, 10)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </SectionCard>
                                <div className="flex justify-end gap-3">
                                    <button className="btn btn-secondary text-sm">Update Credentials</button>
                                    <button className="btn btn-primary text-sm flex items-center gap-2 font-semibold">
                                        Test connection
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <EmptyConfig
                                icon={Cloud}
                                title="No Genesys Configuration"
                                description="This tenant does not have a Genesys Cloud connection established yet."
                                actionLabel="Set up Genesys OAuth"
                                onAction={() => navigate(`/tenants/new?step=2&id=${tenantId}`)}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'whatsapp' && (
                    <div className="max-w-4xl space-y-6">
                        {whatsapp ? (
                            <>
                                <SectionCard title="Meta Business Account" icon={Shield}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <DetailRow label="WABA ID" value={whatsapp.waba_id} copyable />
                                        <DetailRow label="Business ID" value={whatsapp.business_id || '---'} copyable />
                                        <DetailRow label="Access Token" value="••••••••••••••••" />
                                    </div>
                                </SectionCard>

                                <SectionCard title="Phone Integration" icon={Phone}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <DetailRow label="Display Number" value={whatsapp.display_phone_number} icon={Phone} />
                                        <DetailRow label="Phone Number ID" value={whatsapp.phone_number_id} copyable />
                                        <DetailRow
                                            label="Quality Rating"
                                            value={whatsapp.quality_rating || 'GREEN'}
                                            badge
                                            badgeType={whatsapp.quality_rating === 'RED' ? 'red' : 'green'}
                                        />
                                    </div>
                                </SectionCard>
                            </>
                        ) : (
                            <EmptyConfig
                                icon={MessageCircle}
                                title="No WhatsApp Setup"
                                description="Messaging capabilities are not yet enabled for this tenant."
                                actionLabel="Configure WhatsApp"
                                onAction={() => navigate(`/tenants/new?step=3&id=${tenantId}`)}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// UI Components
const TabButton = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2.5 pb-4 px-1 transition-all relative font-medium ${active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
    >
        <Icon className="w-4 h-4" />
        {label}
        {active && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 animate-in fade-in slide-in-from-left-2" />
        )}
    </button>
);

const SectionCard = ({ title, icon: Icon, children }) => (
    <div className="card border border-gray-700/50 bg-gray-800/30 backdrop-blur-sm p-6 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Icon className="w-4 h-4 text-blue-400/70" />
            {title}
        </h3>
        {children}
    </div>
);

const DetailRow = ({ label, value, icon: Icon, copyable, badge, badgeType }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2 group">
            {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
            {badge ? (
                <span className={`badge text-[10px] py-0 px-2 uppercase ${badgeType === 'purple' ? 'bg-purple-600/20 text-purple-400' :
                        badgeType === 'blue' ? 'bg-blue-600/20 text-blue-400' :
                            badgeType === 'red' ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
                    }`}>
                    {value}
                </span>
            ) : (
                <span className="text-sm font-medium text-white truncate">{value || '---'}</span>
            )}
            {copyable && value && (
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(value);
                        alert(`${label} copied!`);
                    }}
                    className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Copy className="w-3 h-3 text-blue-400" />
                </button>
            )}
        </div>
    </div>
);

const StatusIndicator = ({ label, status }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/30 border border-gray-700/50">
        <span className="text-sm text-gray-300">{label}</span>
        {status === 'connected' ? (
            <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                Configured
            </div>
        ) : (
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
                <XCircle className="w-4 h-4" />
                Pending
            </div>
        )}
    </div>
);

const EmptyConfig = ({ icon: Icon, title, description, actionLabel, onAction }) => (
    <div className="flex flex-col items-center py-16 text-center card border-dashed border-gray-700 bg-transparent p-6 rounded-xl">
        <div className="bg-gray-800 p-4 rounded-2xl mb-4">
            <Icon className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-gray-400 mt-2 max-w-sm mb-8">{description}</p>
        <button onClick={onAction} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            {actionLabel}
        </button>
    </div>
);

export default TenantDetail;
