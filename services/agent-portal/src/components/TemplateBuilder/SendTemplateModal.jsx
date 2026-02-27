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
    }, [template]);

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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div>
                        <h3 className="font-bold">Send Template</h3>
                        <p className="text-sm text-gray-400">{template.name} ({template.language})</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto flex">
                    {/* Form */}
                    <div className="flex-1 p-6 space-y-4">
                        {/* Recipient */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Phone Number</label>
                            <div className="flex gap-2">
                                <select
                                    value={countryCode}
                                    onChange={e => setCountryCode(e.target.value)}
                                    className="px-2 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-36"
                                >
                                    {COUNTRY_CODES.map(cc => (
                                        <option key={cc.code} value={cc.code}>{cc.label}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Phone number"
                                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Full number: +{countryCode}{phoneNumber || '...'}</p>
                        </div>

                        {/* Header media upload (for templates with media headers) */}
                        {hasMediaHeader && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Header {headerComp.format.charAt(0) + headerComp.format.slice(1).toLowerCase()}
                                </label>
                                {headerMedia ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm">
                                        <span className="flex-1 text-gray-300 truncate">{headerMedia.fileName}</span>
                                        <button
                                            onClick={() => setHeaderMedia(null)}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 border-dashed rounded-lg text-sm text-gray-400 cursor-pointer hover:border-gray-500 transition">
                                        {uploadingMedia
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                            : <><Upload className="w-4 h-4" /> Upload {headerComp.format.toLowerCase()}</>
                                        }
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
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300">Parameters</label>
                                {bodyVars.map((v, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-10">{v}</span>
                                        <input
                                            type="text"
                                            value={parameters[i] || ''}
                                            onChange={e => {
                                                const updated = [...parameters];
                                                updated[i] = e.target.value;
                                                setParameters(updated);
                                            }}
                                            placeholder={`Value for ${v}`}
                                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="px-3 py-2 bg-red-600/20 border border-red-600/40 rounded text-sm text-red-400">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="w-72 border-l border-gray-700 p-4 flex items-start justify-center">
                        <TemplatePreview
                            components={template.components || []}
                            sampleValues={liveSampleValues}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || uploadingMedia}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm transition disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SendTemplateModal;
