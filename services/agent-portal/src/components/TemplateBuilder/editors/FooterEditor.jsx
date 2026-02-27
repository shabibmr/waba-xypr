import React from 'react';

function FooterEditor({ footer, onChange }) {
    const text = footer?.text || '';

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Footer</label>
            <input
                type="text"
                value={text}
                onChange={e => {
                    if (e.target.value.length > 60) return;
                    onChange({ type: 'FOOTER', text: e.target.value });
                }}
                placeholder="Footer text (optional)"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                maxLength={60}
            />
            <div className="text-xs text-gray-500 text-right">{text.length}/60</div>
        </div>
    );
}

export default FooterEditor;
