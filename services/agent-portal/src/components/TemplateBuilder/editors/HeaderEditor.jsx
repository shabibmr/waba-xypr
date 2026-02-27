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
            onChange({ ...header, example: { header_handle: [result.handle] } });
        } catch (error) {
            setUploadError('Upload failed: ' + (error.response?.data?.error?.message || error.message));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Header</label>

            {/* Type selector */}
            <div className="flex gap-2 flex-wrap">
                {HEADER_TYPES.map(t => (
                    <button
                        key={t.value}
                        onClick={() => handleTypeChange(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            format === t.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Text header */}
            {format === 'TEXT' && (
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <input
                            type="text"
                            value={text}
                            onChange={e => handleTextChange(e.target.value)}
                            placeholder="Header text"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            maxLength={60}
                        />
                        <button
                            onClick={insertVariable}
                            disabled={text.includes('{{1}}')}
                            className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-blue-400 disabled:opacity-50 transition"
                        >
                            {'{{1}}'}
                        </button>
                    </div>
                    <div className="text-xs text-gray-500">{text.length}/60 characters</div>
                    {text.includes('{{1}}') && (
                        <input
                            type="text"
                            value={sampleValues?.header?.[0] || ''}
                            onChange={e => onSampleChange({ header: [e.target.value] })}
                            placeholder="Sample value for {{1}}"
                            className="mt-2 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        />
                    )}
                </div>
            )}

            {/* Media header */}
            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format) && (
                <div>
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
                        {uploading ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                Uploading to Meta...
                            </div>
                        ) : sampleValues?.headerHandle ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                                Media uploaded
                                <button
                                    onClick={() => onSampleChange({ headerHandle: null })}
                                    className="p-1 hover:bg-gray-700 rounded"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer">
                                <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">Click to upload {format.toLowerCase()}</p>
                                <p className="text-xs text-gray-500 mt-1">{MEDIA_LIMITS[format].label}</p>
                                <input
                                    type="file"
                                    accept={MEDIA_LIMITS[format].accept}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                    {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
                </div>
            )}

            {/* Location header */}
            {format === 'LOCATION' && (
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Latitude"
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        onChange={e => onChange({ ...header, latitude: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Longitude"
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        onChange={e => onChange({ ...header, longitude: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Location name"
                        className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        onChange={e => onChange({ ...header, location_name: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Address"
                        className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        onChange={e => onChange({ ...header, address: e.target.value })}
                    />
                </div>
            )}
        </div>
    );
}

export default HeaderEditor;
