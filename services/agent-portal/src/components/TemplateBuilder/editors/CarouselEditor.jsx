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
            // Store the handle on the header component
            updateCard(cardIndex, 'HEADER', { mediaHandle: result.handle, fileName: file.name });
            // Also store in sample values for Meta submission
            const cardSamples = { ...sampleValues };
            if (!cardSamples.carouselHeaders) cardSamples.carouselHeaders = {};
            cardSamples.carouselHeaders[cardIndex] = result.handle;
            onSampleChange(cardSamples);
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
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300">Carousel Cards</label>
                <span className="text-xs text-gray-500">{cards.length}/10 cards (min 2)</span>
            </div>

            {/* Card navigation strip */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setActiveCard(Math.max(0, activeCard - 1))}
                    disabled={activeCard === 0}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1 flex-1 overflow-x-auto">
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveCard(i)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap ${
                                i === activeCard
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            Card {i + 1}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setActiveCard(Math.min(cards.length - 1, activeCard + 1))}
                    disabled={activeCard === cards.length - 1}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <button
                    onClick={addCard}
                    disabled={cards.length >= 10}
                    className="flex items-center gap-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition disabled:opacity-30"
                >
                    <Plus className="w-3 h-3" /> Add
                </button>
            </div>

            {/* Active card editor */}
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Card {activeCard + 1}</span>
                    {cards.length > 2 && (
                        <button
                            onClick={() => removeCard(activeCard)}
                            className="p-1 hover:bg-gray-700 rounded transition"
                        >
                            <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                    )}
                </div>

                {/* Card header media upload */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Header Media ({cardHeader?.format || 'IMAGE'})</label>
                    {cardHeader?.fileName ? (
                        <div className="flex items-center gap-2 bg-gray-700 rounded p-2 text-xs text-gray-300">
                            <span className="flex-1 truncate">{cardHeader.fileName}</span>
                            <button
                                onClick={() => updateCard(activeCard, 'HEADER', { mediaHandle: null, fileName: null })}
                                className="text-red-400 hover:text-red-300 text-xs"
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <label className="flex items-center gap-2 bg-gray-700 rounded h-20 justify-center text-xs text-gray-400 cursor-pointer hover:bg-gray-600 transition">
                            {uploading
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                : <><Upload className="w-4 h-4" /> Upload {(cardHeader?.format || 'IMAGE').toLowerCase()}</>
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
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Body Text</label>
                    <textarea
                        value={cardBody?.text || ''}
                        onChange={e => updateCard(activeCard, 'BODY', { text: e.target.value })}
                        placeholder="Card body text..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                </div>

                {/* Card buttons */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Buttons</label>
                    {(cardButtons?.buttons || []).map((btn, bi) => (
                        <div key={bi} className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500 w-16">{btn.type === 'QUICK_REPLY' ? 'Reply' : 'URL'}</span>
                            <input
                                type="text"
                                value={btn.text || ''}
                                onChange={e => updateCardButton(activeCard, bi, 'text', e.target.value.slice(0, 25))}
                                placeholder="Button text"
                                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                                maxLength={25}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <p className="text-xs text-gray-500">
                All cards must share the same structure (header type, button count/types). Minimum 2 cards required.
            </p>
        </div>
    );
}

export default CarouselEditor;
