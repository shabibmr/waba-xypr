import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, RefreshCw, Search, Filter, Send, Copy, Trash2, Edit3, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import templateService from '../services/templateService';
import { useSocket } from '../contexts/SocketContext';
import TemplateBuilder from '../components/TemplateBuilder/TemplateBuilder';
import SendTemplateModal from '../components/TemplateBuilder/SendTemplateModal';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'];

const STATUS_COLORS = {
    APPROVED: 'bg-green-500/20 text-green-400',
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    REJECTED: 'bg-red-500/20 text-red-400',
    PAUSED: 'bg-orange-500/20 text-orange-400',
    DISABLED: 'bg-gray-500/20 text-gray-400',
    DRAFT: 'bg-blue-500/20 text-blue-400'
};

const QUALITY_COLORS = {
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-500',
    RED: 'bg-red-500'
};

const CATEGORY_COLORS = {
    MARKETING: 'bg-purple-500/20 text-purple-400',
    UTILITY: 'bg-blue-500/20 text-blue-400',
    AUTHENTICATION: 'bg-orange-500/20 text-orange-400'
};

function Templates() {
    const [templates, setTemplates] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [filters, setFilters] = useState({ category: '', status: '', search: '', limit: 50, offset: 0 });
    const [showBuilder, setShowBuilder] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [sendTemplate, setSendTemplate] = useState(null);
    const [toast, setToast] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const { socket } = useSocket();

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const activeFilters = {};
            Object.entries(filters).forEach(([k, v]) => { if (v) activeFilters[k] = v; });
            const data = await templateService.fetchTemplates(activeFilters);
            setTemplates(data.templates || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to load templates:', error);
            showToast('Failed to load templates', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    // Real-time status updates via Socket.IO
    useEffect(() => {
        if (!socket) return;
        const handleStatusUpdate = (data) => {
            setTemplates(prev => prev.map(t =>
                t.meta_template_id === data.metaTemplateId
                    ? { ...t, status: data.status, quality_score: data.qualityScore || t.quality_score, rejected_reason: data.rejectedReason || t.rejected_reason }
                    : t
            ));
            showToast(`Template "${data.name}" status: ${data.status}`, data.status === 'APPROVED' ? 'success' : 'info');
        };
        socket.on('template_status_update', handleStatusUpdate);
        return () => socket.off('template_status_update', handleStatusUpdate);
    }, [socket]);

    // Fallback polling for pending templates
    useEffect(() => {
        const hasPending = templates.some(t => t.status === 'PENDING');
        if (!hasPending) return;
        const interval = setInterval(loadTemplates, 60000);
        return () => clearInterval(interval);
    }, [templates, loadTemplates]);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            const result = await templateService.syncTemplatesFromMeta();
            const parts = [`${result.created} new`, `${result.updated} updated`];
            if (result.unchanged) parts.push(`${result.unchanged} unchanged`);
            showToast(`Synced: ${parts.join(', ')}`, 'success');
            loadTemplates();
        } catch (error) {
            showToast('Sync failed: ' + (error.response?.data?.error?.message || error.message), 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (template) => {
        if (!confirm(`Delete template "${template.name}"? This will also delete it from Meta.`)) return;
        try {
            await templateService.deleteTemplate(template.id);
            showToast(`Template "${template.name}" deleted`, 'success');
            loadTemplates();
        } catch (error) {
            showToast('Delete failed: ' + (error.response?.data?.error?.message || error.message), 'error');
        }
    };

    const handleDuplicate = async (template) => {
        try {
            await templateService.duplicateTemplate(template.id, { name: `${template.name}_copy` });
            showToast(`Template duplicated`, 'success');
            loadTemplates();
        } catch (error) {
            showToast('Duplicate failed: ' + (error.response?.data?.error?.message || error.message), 'error');
        }
    };

    const handleBuilderClose = (saved) => {
        setShowBuilder(false);
        setEditingTemplate(null);
        if (saved) loadTemplates();
    };

    const toggleGroup = (name) => {
        setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
    };

    // Group templates by name for language variants
    // Apply client-side quality filter since it's not in the backend query
    const filteredTemplates = filters.quality
        ? templates.filter(t => t.quality_score === filters.quality)
        : templates;

    const grouped = filteredTemplates.reduce((acc, t) => {
        if (!acc[t.name]) acc[t.name] = [];
        acc[t.name].push(t);
        return acc;
    }, {});

    if (showBuilder) {
        return <TemplateBuilder template={editingTemplate} onClose={handleBuilderClose} />;
    }

    return (
        <div className="flex-1 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-500" />
                    <h2 className="text-xl font-bold">Message Templates</h2>
                    <span className="text-sm text-gray-400">({total})</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync from Meta'}
                    </button>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value, offset: 0 }))}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
                <select
                    value={filters.category}
                    onChange={e => setFilters(f => ({ ...f, category: e.target.value, offset: 0 }))}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={filters.status}
                    onChange={e => setFilters(f => ({ ...f, status: e.target.value, offset: 0 }))}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                    value={filters.quality || ''}
                    onChange={e => setFilters(f => ({ ...f, quality: e.target.value, offset: 0 }))}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                    <option value="">All Quality</option>
                    <option value="GREEN">Green</option>
                    <option value="YELLOW">Yellow</option>
                    <option value="RED">Red</option>
                </select>
            </div>

            {/* Template Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <FileText className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-lg">No templates found</p>
                    <p className="text-sm mt-1">Create a new template or sync from Meta</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Language</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Quality</th>
                                <th className="px-4 py-3">Updated</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(grouped).map(([name, variants]) => {
                                const isMulti = variants.length > 1;
                                const isExpanded = expandedGroups[name];
                                const visibleVariants = isMulti && !isExpanded ? [variants[0]] : variants;

                                return (
                                    <React.Fragment key={name}>
                                        {visibleVariants.map((template, idx) => (
                                            <tr key={template.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {isMulti && idx === 0 && (
                                                            <button onClick={() => toggleGroup(name)} className="p-0.5 hover:bg-gray-600 rounded">
                                                                {isExpanded
                                                                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                                            </button>
                                                        )}
                                                        {isMulti && idx > 0 && <div className="w-4" />}
                                                        <div>
                                                            <div className="font-medium text-sm">{template.name}</div>
                                                            {isMulti && idx === 0 && !isExpanded && (
                                                                <div className="text-xs text-gray-500 mt-0.5">{variants.length} languages</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[template.category] || ''}`}>
                                                        {template.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-300">{template.language}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[template.status] || ''}`}>
                                                        {template.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {template.quality_score && (
                                                        <span className={`inline-block w-3 h-3 rounded-full ${QUALITY_COLORS[template.quality_score] || 'bg-gray-500'}`}
                                                            title={template.quality_score} />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-400">
                                                    {new Date(template.updated_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {template.status === 'APPROVED' && (
                                                            <button
                                                                onClick={() => setSendTemplate(template)}
                                                                className="p-1.5 hover:bg-gray-600 rounded transition"
                                                                title="Send"
                                                            >
                                                                <Send className="w-4 h-4 text-green-400" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditingTemplate(template); setShowBuilder(true); }}
                                                            className="p-1.5 hover:bg-gray-600 rounded transition"
                                                            title="Edit"
                                                        >
                                                            <Edit3 className="w-4 h-4 text-blue-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicate(template)}
                                                            className="p-1.5 hover:bg-gray-600 rounded transition"
                                                            title="Duplicate"
                                                        >
                                                            <Copy className="w-4 h-4 text-gray-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(template)}
                                                            className="p-1.5 hover:bg-gray-600 rounded transition"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {total > filters.limit && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                    <span>Showing {filters.offset + 1}-{Math.min(filters.offset + filters.limit, total)} of {total}</span>
                    <div className="flex gap-2">
                        <button
                            disabled={filters.offset === 0}
                            onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition"
                        >
                            Previous
                        </button>
                        <button
                            disabled={filters.offset + filters.limit >= total}
                            onClick={() => setFilters(f => ({ ...f, offset: f.offset + f.limit }))}
                            className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50 hover:bg-gray-600 transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Send Template Modal */}
            {sendTemplate && (
                <SendTemplateModal
                    template={sendTemplate}
                    onClose={() => setSendTemplate(null)}
                    onSent={() => { setSendTemplate(null); showToast('Template message sent', 'success'); }}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm z-50 ${
                    toast.type === 'success' ? 'bg-green-600' :
                    toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default Templates;
