import React, { useState } from 'react';
import { X, Send, Loader2, Upload } from 'lucide-react';
import messageService from '../../services/messageService';
import templateService from '../../services/templateService';
import TemplatePreview from './TemplatePreview';

const COUNTRY_CODES = [
    { code: '1', label: 'US/CA (+1)' },
    { code: '44', label: 'UK (+44)' },
    { code: '91', label: 'IN (+91)' },
    { code: '61', label: 'AU (+61)' },
    { code: '49', label: 'DE (+49)' },
    { code: '33', label: 'FR (+33)' },
    { code: '55', label: 'BR (+55)' },
    { code: '81', label: 'JP (+81)' },
    { code: '86', label: 'CN (+86)' },
    { code: '971', label: 'UAE (+971)' },
    { code: '966', label: 'SA (+966)' },
    { code: '234', label: 'NG (+234)' },
    { code: '27', label: 'ZA (+27)' },
    { code: '52', label: 'MX (+52)' },
    { code: '65', label: 'SG (+65)' },
];

function SendTemplateModal({ template, onClose, onSent, prefillPhone = '' }) {
    const [countryCode, setCountryCode] = useState('1');
    const [phoneNumber, setPhoneNumber] = useState(prefillPhone);
    const [parameters, setParameters] = useState([]);
    const [headerMedia, setHeaderMedia] = useState(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    // Extract variables from body component
    const bodyComp = (template.components || []).find(c => c.type === 'BODY');
    const headerComp = (template.components || []).find(c => c.type === 'HEADER');
    const bodyVars = bodyComp?.text?.match(/\{\{(\d+)\}\}/g) || [];
    const hasMediaHeader = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format);

    // Initialize parameters from sample values
    React.useEffect(() => {
        const savedSamples = template.sample_values?.body || [];
        setParameters(bodyVars.map((_, i) => savedSamples[i] || ''));
    }, [template.id]);

    // Build live sample values for preview
    const liveSampleValues = {
        ...template.sample_values,
        body: parameters
    };

    const handleMediaUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingMedia(true);
        setError('');
        try {
            const result = await templateService.uploadMedia(file);
            setHeaderMedia({ handle: result.handle, fileName: file.name });
        } catch (err) {
            setError('Media upload failed: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleSend = async () => {
        setError('');

        const fullPhone = countryCode + phoneNumber;
        if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
            setError('Enter a valid phone number (digits only)');
            return;
        }

        const emptyParams = parameters.some((p, i) => i < bodyVars.length && !p);
        if (emptyParams) {
            setError('All parameters must be filled');
            return;
        }

        if (hasMediaHeader && !headerMedia) {
            setError('Please upload the header media file');
            return;
        }

        setSending(true);
        try {
            const payload = {
                to: fullPhone,
                template_name: template.name,
                language: template.language,
                parameters: parameters.slice(0, bodyVars.length).map(text => ({ type: 'text', text }))
            };

            if (headerMedia) {
                payload.header_handle = headerMedia.handle;
            }

            await messageService.sendTemplate(payload);
            onSent();
        } catch (err) {
            setError(err.message || 'Failed to send template');
        } finally {
            setSending(false);
        }
    };

    const acceptTypes = headerComp?.format === 'IMAGE' ? 'image/jpeg,image/png'
        : headerComp?.format === 'VIDEO' ? 'video/mp4,video/3gpp'
            : headerComp?.format === 'DOCUMENT' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' : '';

    return (
        <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl-light w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <div>
                        <h3 className="text-xl font-bold text-surface-900">Send Template</h3>
                        <p className="text-sm text-surface-500">{template.name} • {template.language}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full text-surface-400 hover:text-surface-600 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto flex">
                    {/* Form */}
                    <div className="flex-1 p-6 space-y-4">
                        {/* Recipient */}
                        <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
                            <label className="block text-sm font-semibold text-surface-700 mb-2 uppercase tracking-wider">Recipient Details</label>
                            <div className="flex gap-2">
                                <select
                                    value={countryCode}
                                    onChange={e => setCountryCode(e.target.value)}
                                    className="px-3 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-40 shadow-sm-light"
                                >
                                    {COUNTRY_CODES.map(cc => (
                                        <option key={cc.code} value={cc.code}>{cc.label}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter Phone number"
                                    className="flex-1 px-4 py-2 bg-white border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 shadow-sm-light"
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <p className="text-xs text-surface-500">Preview: <span className="font-mono text-primary-600">+{countryCode} {phoneNumber || '...'}</span></p>
                                {phoneNumber && phoneNumber.length < 8 && <span className="text-[10px] text-amber-600 font-medium italic">Check number length</span>}
                            </div>
                        </div>

                        {/* Header media upload (for templates with media headers) */}
                        {hasMediaHeader && (
                            <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
                                <label className="block text-sm font-semibold text-surface-700 mb-2 uppercase tracking-wider">
                                    Header {headerComp.format.charAt(0) + headerComp.format.slice(1).toLowerCase()} Meta
                                </label>
                                {headerMedia ? (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-surface-200 rounded-xl shadow-sm-light">
                                        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-surface-900 truncate">{headerMedia.fileName}</p>
                                            <p className="text-[10px] text-surface-500">Ready to send</p>
                                        </div>
                                        <button
                                            onClick={() => setHeaderMedia(null)}
                                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                                            title="Remove media"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center gap-2 px-6 py-8 bg-white border-2 border-surface-200 border-dashed rounded-xl text-surface-500 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition group">
                                        <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                            {uploadingMedia
                                                ? <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                                : <Upload className="w-6 h-6 text-surface-400" />
                                            }
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-surface-900">
                                                {uploadingMedia ? 'Uploading media...' : `Click to upload ${headerComp.format.toLowerCase()}`}
                                            </p>
                                            <p className="text-xs text-surface-500 mt-1">Maximum file size: 64MB</p>
                                        </div>
                                        <input
                                            type="file"
                                            accept={acceptTypes}
                                            onChange={handleMediaUpload}
                                            disabled={uploadingMedia}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        )}

                        {/* Parameters */}
                        {bodyVars.length > 0 && (
                            <div className="bg-surface-50 p-4 rounded-xl border border-surface-100 space-y-3">
                                <label className="block text-sm font-semibold text-surface-700 uppercase tracking-wider">Dynamic Parameters</label>
                                {bodyVars.map((v, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-mono text-xs font-bold border border-primary-200">
                                            {v}
                                        </div>
                                        <input
                                            type="text"
                                            value={parameters[i] || ''}
                                            onChange={e => {
                                                const updated = [...parameters];
                                                updated[i] = e.target.value;
                                                setParameters(updated);
                                            }}
                                            placeholder={`Value for ${v}`}
                                            className="flex-1 input-field py-2"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium animate-in slide-in-from-top-2 duration-200">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="w-80 border-l border-surface-100 p-6 flex flex-col items-center gap-4 bg-surface-50/30">
                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Message Preview</div>
                        <TemplatePreview
                            components={template.components || []}
                            sampleValues={liveSampleValues}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-surface-100 bg-surface-50/50">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || uploadingMedia}
                        className="btn-primary flex items-center gap-2 min-w-[120px] justify-center"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Sending...' : 'Send Message'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SendTemplateModal;
