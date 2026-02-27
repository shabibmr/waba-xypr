import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const BUTTON_TYPES = [
    { value: 'QUICK_REPLY', label: 'Quick Reply', max: 10 },
    { value: 'URL', label: 'URL', max: 2 },
    { value: 'PHONE_NUMBER', label: 'Phone Number', max: 1 },
    { value: 'COPY_CODE', label: 'Copy Code', max: 1 },
    { value: 'ONE_TAP', label: 'One-Tap Autofill', max: 1 }
];

function ButtonsEditor({ buttons, onChange }) {
    const buttonList = buttons?.buttons || [];
    const totalButtons = buttonList.length;

    const addButton = (type) => {
        if (totalButtons >= 10) return;
        const newButton = { type, text: '' };
        if (type === 'URL') newButton.url = '';
        if (type === 'PHONE_NUMBER') newButton.phone_number = '';
        if (type === 'COPY_CODE') newButton.example = '';
        if (type === 'ONE_TAP') {
            newButton.text = 'Autofill';
            newButton.autofill_text = '';
            newButton.package_name = '';
            newButton.signature_hash = '';
        }

        onChange({
            type: 'BUTTONS',
            buttons: [...buttonList, newButton]
        });
    };

    const updateButton = (index, field, value) => {
        const updated = buttonList.map((btn, i) =>
            i === index ? { ...btn, [field]: value } : btn
        );
        onChange({ type: 'BUTTONS', buttons: updated });
    };

    const removeButton = (index) => {
        onChange({
            type: 'BUTTONS',
            buttons: buttonList.filter((_, i) => i !== index)
        });
    };

    const moveButton = (fromIndex, toIndex) => {
        if (toIndex < 0 || toIndex >= buttonList.length) return;
        const updated = [...buttonList];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        onChange({ type: 'BUTTONS', buttons: updated });
    };

    // Count buttons by type
    const typeCounts = buttonList.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300">Buttons</label>
                <span className="text-xs text-gray-500">{totalButtons}/10</span>
            </div>

            {/* Button list */}
            {buttonList.map((btn, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex flex-col gap-1 mt-1">
                        <button
                            onClick={() => moveButton(i, i - 1)}
                            disabled={i === 0}
                            className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-30"
                        >
                            <GripVertical className="w-3 h-3 text-gray-500" />
                        </button>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-400">
                                {BUTTON_TYPES.find(t => t.value === btn.type)?.label || btn.type}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={btn.text || ''}
                            onChange={e => updateButton(i, 'text', e.target.value.slice(0, 25))}
                            placeholder="Button text"
                            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                            maxLength={25}
                        />
                        {btn.type === 'URL' && (
                            <input
                                type="text"
                                value={btn.url || ''}
                                onChange={e => updateButton(i, 'url', e.target.value)}
                                placeholder="https://example.com/{{1}}"
                                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                            <input
                                type="text"
                                value={btn.phone_number || ''}
                                onChange={e => updateButton(i, 'phone_number', e.target.value)}
                                placeholder="+1234567890"
                                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                        )}
                        {btn.type === 'COPY_CODE' && (
                            <input
                                type="text"
                                value={btn.example || ''}
                                onChange={e => updateButton(i, 'example', e.target.value)}
                                placeholder="Sample OTP code"
                                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                        )}
                        {btn.type === 'ONE_TAP' && (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={btn.autofill_text || ''}
                                    onChange={e => updateButton(i, 'autofill_text', e.target.value)}
                                    placeholder="Autofill text"
                                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    value={btn.package_name || ''}
                                    onChange={e => updateButton(i, 'package_name', e.target.value)}
                                    placeholder="Android package name (e.g. com.example.app)"
                                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    value={btn.signature_hash || ''}
                                    onChange={e => updateButton(i, 'signature_hash', e.target.value)}
                                    placeholder="App signature hash"
                                    className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => removeButton(i)}
                        className="p-1.5 hover:bg-gray-700 rounded transition mt-1"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            ))}

            {/* Add button */}
            {totalButtons < 10 && (
                <div className="flex gap-2 flex-wrap">
                    {BUTTON_TYPES.map(t => {
                        const disabled = (typeCounts[t.value] || 0) >= t.max;
                        return (
                            <button
                                key={t.value}
                                onClick={() => addButton(t.value)}
                                disabled={disabled}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-3 h-3" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ButtonsEditor;
