// admin-dashboard/src/pages/Tenants.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Search, Building2, CheckCircle, XCircle } from 'lucide-react';
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
        tenant.tenant_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <h1 className="text-4xl font-bold">Tenants</h1>
                    <p className="text-gray-400 mt-2">Manage tenant organizations</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchTenants} className="btn btn-secondary">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <Link to="/tenants/new" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Create Tenant
                    </Link>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-6">
                    <XCircle className="w-5 h-5" />
                    <div>
                        <div className="font-semibold">Error Loading Tenants</div>
                        <div className="text-sm">{error}</div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="card mb-6">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by tenant name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input"
                    />
                </div>
            </div>

            {/* Tenant Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="card">
                    <div className="text-gray-400 text-sm mb-1">Total Tenants</div>
                    <div className="text-3xl font-bold">{tenants.length}</div>
                </div>
                <div className="card">
                    <div className="text-gray-400 text-sm mb-1">Active Tenants</div>
                    <div className="text-3xl font-bold text-green-400">
                        {tenants.filter(t => t.status === 'active').length}
                    </div>
                </div>
                <div className="card">
                    <div className="text-gray-400 text-sm mb-1">Inactive Tenants</div>
                    <div className="text-3xl font-bold text-red-400">
                        {tenants.filter(t => t.status !== 'active').length}
                    </div>
                </div>
            </div>

            {/* Tenant List */}
            <div className="card">
                <h2 className="text-2xl font-semibold mb-4">All Tenants</h2>

                {filteredTenants.length === 0 ? (
                    <div className="text-center py-12">
                        <Building2 className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400 text-lg mb-2">
                            {searchTerm ? 'No tenants found' : 'No tenants yet'}
                        </p>
                        <p className="text-gray-500 text-sm mb-6">
                            {searchTerm ? 'Try adjusting your search' : 'Create your first tenant to get started'}
                        </p>
                        {!searchTerm && (
                            <Link to="/tenants/new" className="btn btn-primary">
                                <Plus className="w-4 h-4" />
                                Create First Tenant
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Tenant ID</th>
                                    <th>Name</th>
                                    <th>Subdomain</th>
                                    <th>Plan</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.map((tenant) => (
                                    <tr key={tenant.tenant_id}>
                                        <td>
                                            <code className="text-sm bg-gray-700 px-2 py-1 rounded">
                                                {tenant.tenant_id}
                                            </code>
                                        </td>
                                        <td className="font-medium">{tenant.name}</td>
                                        <td>
                                            {tenant.subdomain ? (
                                                <span className="text-blue-400">{tenant.subdomain}</span>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge badge-info capitalize">
                                                {tenant.plan || 'standard'}
                                            </span>
                                        </td>
                                        <td>
                                            {tenant.status === 'active' ? (
                                                <span className="badge badge-success flex items-center gap-1 w-fit">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="badge badge-error flex items-center gap-1 w-fit">
                                                    <XCircle className="w-3 h-3" />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-sm text-gray-400">
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary text-sm">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Tenants;
