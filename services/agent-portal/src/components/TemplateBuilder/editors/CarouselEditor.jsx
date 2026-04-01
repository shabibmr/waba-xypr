import React from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Upload, Loader2 } from 'lucide-react';
import templateService from '../../../services/templateService';

function CarouselEditor({ carousel, sampleValues, onChange, onSampleChange }) {
    const cards = carousel?.cards || [createEmptyCard(), createEmptyCard()];
    const [activeCard, setActiveCard] = React.useState(0);
    const [uploading, setUploading] = React.useState(false);

    function createEmptyCard() {
        return {
            components: [
                { type: 'HEADER', format: 'IMAGE' },
                { type: 'BODY', text: '' },
                { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: '' }] }
            ]
        };
    }

    const addCard = () => {
        if (cards.length >= 10) return;
        // New card mirrors the structure of card 0
        const template = cards[0];
        const newCard = {
            components: template.components.map(c => {
                if (c.type === 'HEADER') return { ...c };
                if (c.type === 'BODY') return { type: 'BODY', text: '' };
                if (c.type === 'BUTTONS') return {
                    type: 'BUTTONS',
                    buttons: c.buttons.map(b => ({ ...b, text: '' }))
                };
                return { ...c };
            })
        };
        const updated = [...cards, newCard];
        onChange({ type: 'CAROUSEL', cards: updated });
        setActiveCard(updated.length - 1);
    };

    const removeCard = (index) => {
        if (cards.length <= 2) return;
        const updated = cards.filter((_, i) => i !== index);
        onChange({ type: 'CAROUSEL', cards: updated });
        setActiveCard(Math.min(activeCard, updated.length - 1));
    };

    const updateCard = (cardIndex, compType, updates) => {
        const updated = cards.map((card, ci) => {
            if (ci !== cardIndex) return card;
            return {
                ...card,
                components: card.components.map(c =>
                    c.type === compType ? { ...c, ...updates } : c
                )
            };
        });
        onChange({ type: 'CAROUSEL', cards: updated });
    };

    const updateCardButton = (cardIndex, btnIndex, field, value) => {
        const updated = cards.map((card, ci) => {
            if (ci !== cardIndex) return card;
            return {
                ...card,
                components: card.components.map(c => {
                    if (c.type !== 'BUTTONS') return c;
                    return {
                        ...c,
                        buttons: c.buttons.map((b, bi) =>
                            bi === btnIndex ? { ...b, [field]: value } : b
                        )
                    };
                })
            };
        });
        onChange({ type: 'CAROUSEL', cards: updated });
    };

    const handleMediaUpload = async (cardIndex, file) => {
        if (!file) return;
        setUploading(true);
        try {
            const result = await templateService.uploadMedia(file);
            // Store the handle on the header component (source of truth for buildMetaComponents)
            updateCard(cardIndex, 'HEADER', { mediaHandle: result.handle, fileName: file.name });
        } catch (err) {
            console.error('Carousel media upload failed:', err);
        } finally {
            setUploading(false);
        }
    };

    const card = cards[activeCard] || cards[0];
    const cardBody = card?.components?.find(c => c.type === 'BODY');
    const cardButtons = card?.components?.find(c => c.type === 'BUTTONS');
    const cardHeader = card?.components?.find(c => c.type === 'HEADER');

    const acceptTypes = cardHeader?.format === 'IMAGE' ? 'image/jpeg,image/png' : 'video/mp4,video/3gpp';

    return (
        <div className="space-y-4">
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-surface-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-1">
                <label className="block text-sm font-semibold text-surface-700">Carousel Components</label>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full border border-surface-200">{cards.length}/10 cards</span>
                </div>
            </div>

            {/* Card navigation strip */}
            <div className="flex items-center gap-3 p-2 bg-surface-50 rounded-xl border border-surface-100">
                <button
                    onClick={() => setActiveCard(Math.max(0, activeCard - 1))}
                    disabled={activeCard === 0}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-20 text-surface-400 transition-all active:scale-90"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1.5 flex-1 overflow-x-auto py-1 no-scrollbar">
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveCard(i)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border-2 ${i === activeCard
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100'
                                    : 'bg-white text-surface-500 border-surface-200 hover:border-primary-200 hover:text-primary-600 shadow-sm'
                                }`}
                        >
                            Card {i + 1}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setActiveCard(Math.min(cards.length - 1, activeCard + 1))}
                    disabled={activeCard === cards.length - 1}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg disabled:opacity-20 text-surface-400 transition-all active:scale-90"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-surface-200 mx-1" />
                <button
                    onClick={addCard}
                    disabled={cards.length >= 10}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 rounded-lg text-[10px] font-bold text-primary-600 transition-all active:scale-95 border border-primary-100 disabled:opacity-30"
                >
                    <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                    <span>ADD</span>
                </button>
            </div>

            {/* Active card editor */}
            <div className="p-5 bg-white rounded-2xl border border-surface-200 shadow-sm space-y-5 animate-slide-in-right relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500" />
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-700">Configuring Card {activeCard + 1}</span>
                    </div>
                    {cards.length > 2 && (
                        <button
                            onClick={() => removeCard(activeCard)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg border border-transparent hover:border-red-100 transition-all active:scale-95"
                            title="Remove card"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Card header media upload */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Card Media ({cardHeader?.format || 'IMAGE'})</label>
                    {cardHeader?.fileName ? (
                        <div className="flex items-center gap-3 bg-surface-50 border border-surface-200 rounded-xl p-3 text-sm group/media transition-all hover:bg-white hover:shadow-sm">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-surface-100">
                                <Upload className="w-4 h-4 text-primary-600" />
                            </div>
                            <span className="flex-1 truncate font-medium text-surface-700">{cardHeader.fileName}</span>
                            <button
                                onClick={() => updateCard(activeCard, 'HEADER', { mediaHandle: null, fileName: null })}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center gap-2 bg-surface-50 border-2 border-dashed border-surface-200 rounded-2xl h-24 justify-center text-sm font-bold text-surface-400 cursor-pointer hover:bg-primary-50 hover:border-primary-300 hover:text-primary-600 transition-all group/upload">
                            {uploading
                                ? <><Loader2 className="w-5 h-5 animate-spin text-primary-600" /> <span className="text-primary-600">Uploading...</span></>
                                : <><Upload className="w-5 h-5 group-hover/upload:scale-110 transition-transform text-surface-400 group-hover/upload:text-primary-500" /> <span>Upload {(cardHeader?.format || 'IMAGE').toLowerCase()}</span></>
                            }
                            <input
                                type="file"
                                accept={acceptTypes}
                                onChange={e => handleMediaUpload(activeCard, e.target.files?.[0])}
                                disabled={uploading}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                {/* Card body */}
                <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Card Primary Text</label>
                    <textarea
                        value={cardBody?.text || ''}
                        onChange={e => updateCard(activeCard, 'BODY', { text: e.target.value })}
                        placeholder="What should this card say?"
                        rows={3}
                        className="input-field w-full resize-none bg-surface-50/50"
                    />
                </div>

                {/* Card buttons */}
                <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Interactive Triggers</label>
                    {(cardButtons?.buttons || []).map((btn, bi) => (
                        <div key={bi} className="flex items-center gap-3 animate-in slide-in-from-right-2 duration-200" style={{ animationDelay: `${bi * 50}ms` }}>
                            <div className="w-20 px-2 py-1.5 bg-surface-100 rounded-lg text-[9px] font-bold text-surface-500 uppercase tracking-wider text-center border border-surface-200 shrink-0">
                                {btn.type === 'QUICK_REPLY' ? 'Reply' : 'Link'}
                            </div>
                            <input
                                type="text"
                                value={btn.text || ''}
                                onChange={e => updateCardButton(activeCard, bi, 'text', e.target.value.slice(0, 25))}
                                placeholder="Call to action..."
                                className="flex-1 input-field py-2 shadow-sm"
                                maxLength={25}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Consistency Check: All cards must share the same header type and buttons.
                </p>
            </div>
        </div>
        </div>
    );
}

export default CarouselEditor;
