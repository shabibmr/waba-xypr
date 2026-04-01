import React, { useRef } from 'react';
import { Bold, Italic, Strikethrough, Code, Plus } from 'lucide-react';

function BodyEditor({ body, sampleValues, onChange, onSampleChange }) {
    const text = body?.text || '';
    const textareaRef = useRef(null);
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
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = text.substring(start, end);
        if (!selected) return;
        const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
        handleTextChange(newText);
    };

    return (
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-surface-200">
            <label className="block text-sm font-semibold text-surface-700">Body Content</label>

            {/* Formatting toolbar */}
            <div className="flex items-center gap-1.5 border-b border-surface-100 pb-3">
                <button
                    onClick={() => wrapSelection('*', '*')}
                    className="w-8 h-8 flex items-center justify-center hover:bg-surface-100 rounded-lg transition-colors text-surface-500 hover:text-surface-900"
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => wrapSelection('_', '_')}
                    className="w-8 h-8 flex items-center justify-center hover:bg-surface-100 rounded-lg transition-colors text-surface-500 hover:text-surface-900"
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    onClick={() => wrapSelection('~', '~')}
                    className="w-8 h-8 flex items-center justify-center hover:bg-surface-100 rounded-lg transition-colors text-surface-500 hover:text-surface-900"
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </button>
                <button
                    onClick={() => wrapSelection('```', '```')}
                    className="w-8 h-8 flex items-center justify-center hover:bg-surface-100 rounded-lg transition-colors text-surface-500 hover:text-surface-900"
                    title="Monospace"
                >
                    <Code className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                    onClick={insertVariable}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 rounded-xl text-[10px] font-bold text-primary-600 transition-all active:scale-95 border border-primary-100 shadow-sm"
                >
                    <Plus className="w-3 h-3 stroke-[3px]" />
                    <span>VARIABLE {varCount + 1}</span>
                </button>
            </div>

            {/* Text area */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => handleTextChange(e.target.value)}
                    placeholder="Enter your message body text..."
                    rows={6}
                    className="input-field w-full resize-none min-h-[150px] font-medium leading-relaxed"
                    maxLength={1024}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{varCount} variable{varCount !== 1 ? 's' : ''}</div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${text.length > 950 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500'}`}>
                        {text.length}/1024
                    </div>
                </div>
            </div>

            {/* Sample values for variables */}
            {varCount > 0 && (
                <div className="mt-4 p-4 bg-primary-50/30 rounded-2xl border border-primary-100/50 space-y-3 animate-slide-in-right">
                    <label className="block text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-1 ml-1">Sample Values (Required by Meta)</label>
                    <div className="space-y-2.5">
                        {bodyVars.map((v, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center bg-white border border-primary-100 rounded-xl text-xs font-bold text-primary-600 shadow-sm shrink-0">
                                    {v}
                                </div>
                                <input
                                    type="text"
                                    value={sampleValues?.body?.[i] || ''}
                                    onChange={e => {
                                        const newBody = [...(sampleValues?.body || [])];
                                        newBody[i] = e.target.value;
                                        onSampleChange({ body: newBody });
                                    }}
                                    placeholder={`What should replacing ${v} look like?`}
                                    className="input-field flex-1"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default BodyEditor;
