import React from 'react';

function FooterEditor({ footer, onChange }) {
    const text = footer?.text || '';

    return (
        <div className="space-y-3 bg-white p-5 rounded-2xl border border-surface-200">
            <label className="block text-sm font-semibold text-surface-700">Footer Text</label>
            <div className="relative">
                <input
                    type="text"
                    value={text}
                    onChange={e => {
                        if (e.target.value.length > 60) return;
                        onChange({ type: 'FOOTER', text: e.target.value });
                    }}
                    placeholder="Optional footer text (e.g. Reply STOP to opt out)"
                    className="input-field w-full pr-12"
                    maxLength={60}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-surface-400">
                    {text.length}/60
                </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400 ml-1">Small, muted text that appears at the bottom of the message</p>
        </div>
    );
}

export default FooterEditor;
