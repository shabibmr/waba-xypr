import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Smile, Mic } from 'lucide-react';
import WhatsAppPhone from './WhatsAppPhone';
import WhatsAppChatHeader from './WhatsAppChatHeader';
import WhatsAppMessageBubble from './WhatsAppMessageBubble';
import WhatsAppCTAButtons from './WhatsAppCTAButtons';
import WhatsAppMediaPreview from './WhatsAppMediaPreview';
import './whatsapp-preview.css';

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
    const isOTP = body?.text?.includes('verification code') ||
                  buttons?.buttons?.some(b => b.type === 'COPY_CODE' || b.type === 'ONE_TAP');

    const businessName = isOTP ? 'Your Business' : 'Your Business';

    return (
        <WhatsAppPhone>
            {/* WhatsApp Chat Header */}
            <WhatsAppChatHeader businessName={businessName} />

            {/* Chat Area */}
            <div className="wa-chat-area">
                {/* Message Bubble */}
                <WhatsAppMessageBubble sent={true} status="read">
                    {/* Media Header */}
                    {header && header.format !== 'TEXT' && (
                        <WhatsAppMediaPreview
                            format={header.format}
                            mediaUrl={sampleValues.headerHandle}
                            fileName={sampleValues.headerFileName}
                        />
                    )}

                    {/* Text Header */}
                    {header && header.format === 'TEXT' && header.text && (
                        <div className="font-bold text-sm mb-1">
                            {replaceVariables(header.text, 'header')}
                        </div>
                    )}

                    {/* Body */}
                    {body && body.text && (
                        <div
                            className="leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                                __html: formatWhatsAppText(replaceVariables(body.text, 'body'))
                            }}
                        />
                    )}

                    {/* Footer */}
                    {footer && footer.text && (
                        <div className="text-[11px] text-[#8696a0]/80 mt-1 leading-tight">
                            {footer.text}
                        </div>
                    )}

                    {/* CTA Buttons */}
                    {buttons && buttons.buttons && buttons.buttons.length > 0 && (
                        <WhatsAppCTAButtons buttons={buttons.buttons} />
                    )}
                </WhatsAppMessageBubble>

                {/* Carousel preview */}
                {carousel && carousel.cards && carousel.cards.length > 0 && (
                    <CarouselPreview cards={carousel.cards} sampleValues={sampleValues} />
                )}
            </div>

            {/* WhatsApp Input Bar */}
            <div className="wa-input-bar">
                <button className="wa-input-action">
                    <Plus className="w-5 h-5" />
                </button>
                <div className="wa-input-field">
                    <input type="text" placeholder="Message" disabled />
                    <button className="wa-emoji-btn">
                        <Smile className="w-5 h-5" />
                    </button>
                </div>
                <button className="wa-input-action">
                    <Mic className="w-5 h-5" />
                </button>
            </div>
        </WhatsAppPhone>
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
        <div className="wa-message-container sent">
            <div className="wa-message-bubble sent" style={{ maxWidth: '280px' }}>
                <div className="wa-bubble-content">
                    {/* Card Media Header */}
                    {cardHeader && (
                        <WhatsAppMediaPreview
                            format={cardHeader.format}
                            mediaUrl={null}
                        />
                    )}

                    {/* Card Body */}
                    {cardBody?.text && (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
                            {cardBody.text}
                        </div>
                    )}

                    {/* Card Buttons */}
                    {cardButtons?.buttons?.length > 0 && (
                        <WhatsAppCTAButtons buttons={cardButtons.buttons} />
                    )}
                </div>

                {/* Card Navigation */}
                {cards.length > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-3 pb-1">
                        <button
                            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                            disabled={activeIndex === 0}
                            className="p-1 disabled:opacity-30 text-white"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex gap-1.5">
                            {cards.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveIndex(i)}
                                    className={`w-1.5 h-1.5 rounded-full transition ${
                                        i === activeIndex ? 'bg-blue-400' : 'bg-gray-600'
                                    }`}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setActiveIndex(Math.min(cards.length - 1, activeIndex + 1))}
                            disabled={activeIndex === cards.length - 1}
                            className="p-1 disabled:opacity-30 text-white"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="wa-bubble-tail sent"></div>
            </div>
        </div>
    );
}

export default TemplatePreview;
