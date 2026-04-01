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
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-surface-200">
            <div className="flex items-center justify-between pb-1">
                <label className="block text-sm font-semibold text-surface-700">Interactive Buttons</label>
                <span className="text-[10px] uppercase tracking-widest font-bold text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full border border-surface-200">{totalButtons}/10</span>
            </div>

            {/* Button list */}
            {buttonList.map((btn, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-surface-50 rounded-2xl border border-surface-200 shadow-sm animate-slide-in-right relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex flex-col gap-1 mt-1 shrink-0">
                        <button
                            onClick={() => moveButton(i, i - 1)}
                            disabled={i === 0}
                            className="p-1 hover:bg-surface-200 rounded-lg disabled:opacity-20 text-surface-400 transition-colors"
                        >
                            <GripVertical className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] px-2 py-0.5 bg-primary-100/50 rounded-full text-primary-700 font-bold uppercase tracking-wider border border-primary-100">
                                {BUTTON_TYPES.find(t => t.value === btn.type)?.label || btn.type}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Button Label</label>
                            <input
                                type="text"
                                value={btn.text || ''}
                                onChange={e => updateButton(i, 'text', e.target.value.slice(0, 25))}
                                placeholder="Text shown on button..."
                                className="input-field w-full bg-white shadow-sm"
                                maxLength={25}
                            />
                        </div>
                        {btn.type === 'URL' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">URL Address</label>
                                <input
                                    type="text"
                                    value={btn.url || ''}
                                    onChange={e => updateButton(i, 'url', e.target.value)}
                                    placeholder="https://example.com/{{1}}"
                                    className="input-field w-full bg-white shadow-sm font-mono text-xs"
                                />
                            </div>
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <input
                                    type="text"
                                    value={btn.phone_number || ''}
                                    onChange={e => updateButton(i, 'phone_number', e.target.value)}
                                    placeholder="+1234567890"
                                    className="input-field w-full bg-white shadow-sm font-mono"
                                />
                            </div>
                        )}
                        {btn.type === 'COPY_CODE' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">OTP Sample</label>
                                <input
                                    type="text"
                                    value={btn.example || ''}
                                    onChange={e => updateButton(i, 'example', e.target.value)}
                                    placeholder="Sample OTP code"
                                    className="input-field w-full bg-white shadow-sm font-mono"
                                />
                            </div>
                        )}
                        {btn.type === 'ONE_TAP' && (
                            <div className="space-y-3 p-3 bg-white rounded-xl border border-surface-200">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Autofill Text</label>
                                    <input
                                        type="text"
                                        value={btn.autofill_text || ''}
                                        onChange={e => updateButton(i, 'autofill_text', e.target.value)}
                                        placeholder="Autofill text"
                                        className="input-field w-full"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Android Package Name</label>
                                    <input
                                        type="text"
                                        value={btn.package_name || ''}
                                        onChange={e => updateButton(i, 'package_name', e.target.value)}
                                        placeholder="e.g. com.example.app"
                                        className="input-field w-full font-mono text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Signature Hash</label>
                                    <input
                                        type="text"
                                        value={btn.signature_hash || ''}
                                        onChange={e => updateButton(i, 'signature_hash', e.target.value)}
                                        placeholder="App signature hash"
                                        className="input-field w-full font-mono text-xs"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => removeButton(i)}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-all active:scale-95 border border-transparent hover:border-red-100 shadow-sm shrink-0 mt-1"
                        title="Delete button"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}

            {/* Add button actions */}
            {totalButtons < 10 && (
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-200 mt-2">
                    <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3 ml-1">Add Dynamic Action</label>
                    <div className="flex gap-2 flex-wrap">
                        {BUTTON_TYPES.map(t => {
                            const disabled = (typeCounts[t.value] || 0) >= t.max;
                            return (
                                <button
                                    key={t.value}
                                    onClick={() => addButton(t.value)}
                                    disabled={disabled}
                                    className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-surface-200 hover:border-primary-300 hover:text-primary-600 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group"
                                >
                                    <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ButtonsEditor;
