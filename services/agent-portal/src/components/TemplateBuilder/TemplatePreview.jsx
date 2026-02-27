import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image, Video, FileText, MapPin, Copy, ExternalLink } from 'lucide-react';

function TemplatePreview({ components = [], sampleValues = {} }) {
    const header = components.find(c => c.type === 'HEADER');
    const body = components.find(c => c.type === 'BODY');
    const footer = components.find(c => c.type === 'FOOTER');
    const buttons = components.find(c => c.type === 'BUTTONS');
    const carousel = components.find(c => c.type === 'CAROUSEL');

    const replaceVariables = (text, source) => {
        if (!text) return '';
        return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
            const idx = parseInt(num) - 1;
            const vals = sampleValues[source];
            if (vals && vals[idx]) return vals[idx];
            return match;
        });
    };

    const formatWhatsAppText = (text) => {
        if (!text) return '';
        return text
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            .replace(/~([^~]+)~/g, '<del>$1</del>')
            .replace(/```([^`]+)```/g, '<code>$1</code>');
    };

    // Detect if this is an authentication/OTP template
    const isOTP = body?.text?.includes('verification code') || buttons?.buttons?.some(b => b.type === 'COPY_CODE' || b.type === 'ONE_TAP');

    return (
        <div className="flex flex-col items-center">
            <div className="w-72 bg-gray-900 rounded-2xl overflow-hidden shadow-xl border border-gray-700">
                {/* Phone header */}
                <div className="bg-green-700 px-4 py-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold">WA</div>
                    <div>
                        <div className="text-sm font-medium">WhatsApp Preview</div>
                        <div className="text-xs text-green-200">{isOTP ? 'OTP Template' : 'Template Message'}</div>
                    </div>
                </div>

                {/* Chat area */}
                <div className="p-3 min-h-[200px] bg-[#0b141a]"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23111b21\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>

                    {/* Message bubble */}
                    <div className="bg-[#005c4b] rounded-lg p-2 max-w-[260px] ml-auto shadow">
                        {/* Header */}
                        {header && (
                            <div className="mb-1">
                                {header.format === 'TEXT' && header.text && (
                                    <div className="font-bold text-sm">{replaceVariables(header.text, 'header')}</div>
                                )}
                                {header.format === 'IMAGE' && (
                                    <div className="bg-gray-700/60 rounded h-32 flex flex-col items-center justify-center text-xs text-gray-400 mb-1">
                                        <Image className="w-6 h-6 mb-1 opacity-60" />
                                        <span>Image Header</span>
                                    </div>
                                )}
                                {header.format === 'VIDEO' && (
                                    <div className="bg-gray-700/60 rounded h-32 flex flex-col items-center justify-center text-xs text-gray-400 mb-1">
                                        <Video className="w-6 h-6 mb-1 opacity-60" />
                                        <span>Video Header</span>
                                    </div>
                                )}
                                {header.format === 'DOCUMENT' && (
                                    <div className="bg-gray-700/60 rounded p-3 flex items-center gap-2 text-xs text-gray-400 mb-1">
                                        <FileText className="w-5 h-5 opacity-60" />
                                        <span>Document</span>
                                    </div>
                                )}
                                {header.format === 'LOCATION' && (
                                    <div className="bg-gray-700/60 rounded h-24 flex flex-col items-center justify-center text-xs text-gray-400 mb-1">
                                        <MapPin className="w-6 h-6 mb-1 opacity-60" />
                                        <span>Location</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Body */}
                        {body && body.text && (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: formatWhatsAppText(replaceVariables(body.text, 'body')) }}
                            />
                        )}

                        {/* Footer */}
                        {footer && footer.text && (
                            <div className="text-xs text-gray-400 mt-1">{footer.text}</div>
                        )}

                        {/* Timestamp */}
                        <div className="text-[10px] text-gray-400 text-right mt-1">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>

                    {/* Buttons */}
                    {buttons && buttons.buttons && buttons.buttons.length > 0 && (
                        <div className="mt-1 max-w-[260px] ml-auto space-y-0.5">
                            {buttons.buttons.map((btn, i) => (
                                <div key={i} className="bg-[#005c4b] rounded-lg py-2 text-center text-sm text-blue-300 flex items-center justify-center gap-1.5">
                                    {btn.type === 'COPY_CODE' && <Copy className="w-3 h-3" />}
                                    {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                                    {btn.type === 'ONE_TAP' && <ExternalLink className="w-3 h-3" />}
                                    {btn.text || btn.type}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Carousel preview */}
                    {carousel && carousel.cards && carousel.cards.length > 0 && (
                        <CarouselPreview cards={carousel.cards} sampleValues={sampleValues} />
                    )}
                </div>
            </div>
        </div>
    );
}

function CarouselPreview({ cards, sampleValues = {} }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const card = cards[activeIndex];
    if (!card) return null;

    const cardHeader = card.components?.find(c => c.type === 'HEADER');
    const cardBody = card.components?.find(c => c.type === 'BODY');
    const cardButtons = card.components?.find(c => c.type === 'BUTTONS');

    return (
        <div className="mt-2 max-w-[260px] ml-auto">
            <div className="bg-[#005c4b] rounded-lg p-2 shadow">
                {/* Card header */}
                {cardHeader && (
                    <div className="bg-gray-700/60 rounded h-20 flex flex-col items-center justify-center text-xs text-gray-400 mb-1">
                        {cardHeader.format === 'IMAGE' ? <Image className="w-5 h-5 opacity-60" /> : <Video className="w-5 h-5 opacity-60" />}
                        <span className="mt-0.5">Card {activeIndex + 1} {cardHeader.format?.toLowerCase()}</span>
                    </div>
                )}
                {/* Card body */}
                {cardBody?.text && (
                    <div className="text-xs leading-relaxed whitespace-pre-wrap">{cardBody.text}</div>
                )}
                {/* Card buttons */}
                {cardButtons?.buttons?.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                        {cardButtons.buttons.map((btn, i) => (
                            <div key={i} className="bg-[#006d5b] rounded py-1 text-center text-xs text-blue-300">
                                {btn.text || btn.type}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Card navigation dots */}
            {cards.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-1.5">
                    <button onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0} className="p-0.5 disabled:opacity-30">
                        <ChevronLeft className="w-3 h-3 text-gray-400" />
                    </button>
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveIndex(i)}
                            className={`w-1.5 h-1.5 rounded-full transition ${i === activeIndex ? 'bg-blue-400' : 'bg-gray-600'}`}
                        />
                    ))}
                    <button onClick={() => setActiveIndex(Math.min(cards.length - 1, activeIndex + 1))} disabled={activeIndex === cards.length - 1} className="p-0.5 disabled:opacity-30">
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default TemplatePreview;
