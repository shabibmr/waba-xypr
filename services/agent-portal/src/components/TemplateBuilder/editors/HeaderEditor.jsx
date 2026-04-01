import React, { useState } from 'react';
import { Upload, X, Image, Video, FileText, MapPin } from 'lucide-react';
import templateService from '../../../services/templateService';

const HEADER_TYPES = [
    { value: 'NONE', label: 'None' },
    { value: 'TEXT', label: 'Text', icon: FileText },
    { value: 'IMAGE', label: 'Image', icon: Image },
    { value: 'VIDEO', label: 'Video', icon: Video },
    { value: 'DOCUMENT', label: 'Document', icon: FileText },
    { value: 'LOCATION', label: 'Location', icon: MapPin }
];

const MEDIA_LIMITS = {
    IMAGE: { maxSize: 5 * 1024 * 1024, accept: '.jpg,.jpeg,.png', label: '5 MB, JPEG/PNG' },
    VIDEO: { maxSize: 16 * 1024 * 1024, accept: '.mp4', label: '16 MB, MP4' },
    DOCUMENT: { maxSize: 100 * 1024 * 1024, accept: '.pdf', label: '100 MB, PDF' }
};

function HeaderEditor({ header, sampleValues, onChange, onSampleChange }) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const format = header?.format || 'NONE';
    const text = header?.text || '';

    const handleTypeChange = (newFormat) => {
        if (newFormat === 'NONE') {
            onChange(null);
        } else {
            onChange({ type: 'HEADER', format: newFormat, text: newFormat === 'TEXT' ? '' : undefined });
        }
    };

    const handleTextChange = (newText) => {
        if (newText.length > 60) return;
        onChange({ ...header, text: newText });
    };

    const insertVariable = () => {
        if (text.includes('{{1}}')) return; // Header only supports one variable
        handleTextChange(text + '{{1}}');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const limits = MEDIA_LIMITS[format];
        if (file.size > limits.maxSize) {
            setUploadError(`File too large. Max: ${limits.label}`);
            return;
        }

        setUploadError('');
        setUploading(true);
        try {
            const result = await templateService.uploadMedia(file);
            onSampleChange({ headerHandle: result.handle });
        } catch (error) {
            setUploadError('Upload failed: ' + (error.response?.data?.error?.message || error.message));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-surface-200">
            <label className="block text-sm font-semibold text-surface-700">Header Content</label>

            {/* Type selector */}
            <div className="flex gap-2 flex-wrap pb-1">
                {HEADER_TYPES.map(t => (
                    <button
                        key={t.value}
                        onClick={() => handleTypeChange(t.value)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm ${format === t.value
                                ? 'bg-primary-600 text-white shadow-primary-200 translate-y-[-1px]'
                                : 'bg-surface-50 text-surface-500 hover:bg-surface-100 border border-surface-100 hover:border-surface-200'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Text header */}
            {format === 'TEXT' && (
                <div className="animate-slide-in-right">
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="text"
                            value={text}
                            onChange={e => handleTextChange(e.target.value)}
                            placeholder="Header text"
                            className="input-field flex-1"
                            maxLength={60}
                        />
                        <button
                            onClick={insertVariable}
                            disabled={text.includes('{{1}}')}
                            className="w-10 h-10 flex items-center justify-center bg-primary-50 hover:bg-primary-100 border border-primary-100 rounded-xl text-xs font-bold text-primary-600 disabled:opacity-50 transition-all active:scale-95"
                            title="Insert Variable"
                        >
                            {'{{1}}'}
                        </button>
                    </div>
                    <div className="flex justify-between items-center px-1">
                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{text.length}/60 characters</div>
                    </div>
                    {text.includes('{{1}}') && (
                        <div className="mt-3 p-3 bg-primary-50/50 rounded-xl border border-primary-100">
                            <label className="block text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-1.5 ml-1">Sample Value</label>
                            <input
                                type="text"
                                value={sampleValues?.header?.[0] || ''}
                                onChange={e => onSampleChange({ header: [e.target.value] })}
                                placeholder="Value for {{1}}..."
                                className="input-field w-full"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Media header */}
            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format) && (
                <div className="animate-slide-in-right">
                    <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                        sampleValues?.headerHandle ? 'border-green-200 bg-green-50' : 'border-surface-200 bg-surface-50 hover:border-primary-300 hover:bg-primary-50/30'
                    }`}>
                        {uploading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-2">
                                <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full shadow-sm" />
                                <span className="text-sm font-semibold text-primary-700">Uploading to Meta...</span>
                            </div>
                        ) : sampleValues?.headerHandle ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-1">
                                    <Upload className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-green-700">Media ready!</span>
                                    <button
                                        onClick={() => onSampleChange({ headerHandle: null })}
                                        className="p-1.5 hover:bg-green-200 text-green-600 rounded-lg transition-colors group"
                                        title="Remove media"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className="cursor-pointer block group">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-surface-100 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 text-primary-500" />
                                </div>
                                <p className="text-sm font-bold text-surface-700 group-hover:text-primary-600">Click to upload {format.toLowerCase()}</p>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-surface-400 mt-2">{MEDIA_LIMITS[format].label}</p>
                                <input
                                    type="file"
                                    accept={MEDIA_LIMITS[format].accept}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                    {uploadError && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 animate-shake">
                            <X className="w-3 h-3" />
                            {uploadError}
                        </div>
                    )}
                </div>
            )}

            {/* Location header */}
            {format === 'LOCATION' && (
                <div className="grid grid-cols-2 gap-3 animate-slide-in-right">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Latitude</label>
                        <input
                            type="text"
                            placeholder="0.0"
                            className="input-field w-full"
                            onChange={e => onChange({ ...header, latitude: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Longitude</label>
                        <input
                            type="text"
                            placeholder="0.0"
                            className="input-field w-full"
                            onChange={e => onChange({ ...header, longitude: e.target.value })}
                        />
                    </div>
                    <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Location Name</label>
                        <input
                            type="text"
                            placeholder="Branch Name / Landmark"
                            className="input-field w-full"
                            onChange={e => onChange({ ...header, location_name: e.target.value })}
                        />
                    </div>
                    <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Address</label>
                        <input
                            type="text"
                            placeholder="Full address details"
                            className="input-field w-full"
                            onChange={e => onChange({ ...header, address: e.target.value })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default HeaderEditor;
