import React from 'react';
import { Bold, Italic, Strikethrough, Code, Plus } from 'lucide-react';

function BodyEditor({ body, sampleValues, onChange, onSampleChange }) {
    const text = body?.text || '';
    const bodyVars = text.match(/\{\{(\d+)\}\}/g) || [];
    const varCount = bodyVars.length;

    const handleTextChange = (newText) => {
        if (newText.length > 1024) return;
        onChange({ type: 'BODY', text: newText });
    };

    const insertVariable = () => {
        const nextVar = varCount + 1;
        handleTextChange(text + `{{${nextVar}}}`);
    };

    const wrapSelection = (prefix, suffix) => {
        const textarea = document.getElementById('body-editor');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = text.substring(start, end);
        if (!selected) return;
        const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
        handleTextChange(newText);
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Body</label>

            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 border-b border-gray-700 pb-2">
                <button
                    onClick={() => wrapSelection('*', '*')}
                    className="p-1.5 hover:bg-gray-700 rounded transition"
                    title="Bold"
                >
                    <Bold className="w-4 h-4 text-gray-400" />
                </button>
                <button
                    onClick={() => wrapSelection('_', '_')}
                    className="p-1.5 hover:bg-gray-700 rounded transition"
                    title="Italic"
                >
                    <Italic className="w-4 h-4 text-gray-400" />
                </button>
                <button
                    onClick={() => wrapSelection('~', '~')}
                    className="p-1.5 hover:bg-gray-700 rounded transition"
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4 text-gray-400" />
                </button>
                <button
                    onClick={() => wrapSelection('```', '```')}
                    className="p-1.5 hover:bg-gray-700 rounded transition"
                    title="Monospace"
                >
                    <Code className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex-1" />
                <button
                    onClick={insertVariable}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-blue-400 transition"
                >
                    <Plus className="w-3 h-3" />
                    {`{{${varCount + 1}}}`}
                </button>
            </div>

            {/* Text area */}
            <textarea
                id="body-editor"
                value={text}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="Enter your message body text..."
                rows={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                maxLength={1024}
            />
            <div className="flex justify-between text-xs text-gray-500">
                <span>{varCount} variable{varCount !== 1 ? 's' : ''}</span>
                <span className={text.length > 950 ? 'text-yellow-400' : ''}>{text.length}/1024</span>
            </div>

            {/* Sample values for variables */}
            {varCount > 0 && (
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-400">Sample Values (required by Meta)</label>
                    {bodyVars.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-10">{v}</span>
                            <input
                                type="text"
                                value={sampleValues?.body?.[i] || ''}
                                onChange={e => {
                                    const newBody = [...(sampleValues?.body || [])];
                                    newBody[i] = e.target.value;
                                    onSampleChange({ body: newBody });
                                }}
                                placeholder={`Sample value for ${v}`}
                                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default BodyEditor;
