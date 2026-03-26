import React from 'react';
import { ExternalLink, Phone, Copy, Star } from 'lucide-react';

/**
 * WhatsApp CTA Buttons Component
 * Renders call-to-action buttons in WhatsApp style
 */
function WhatsAppCTAButtons({ buttons = [] }) {
  if (!buttons || buttons.length === 0) return null;

  const getButtonIcon = (type) => {
    switch (type) {
      case 'URL':
        return <ExternalLink className="w-4 h-4" />;
      case 'PHONE_NUMBER':
        return <Phone className="w-4 h-4" />;
      case 'COPY_CODE':
        return <Copy className="w-4 h-4" />;
      case 'ONE_TAP':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <Star className="w-4 h-4" />;
    }
  };

  const isQuickReply = (type) => type === 'QUICK_REPLY';

  return (
    <div className="wa-cta-buttons">
      {buttons.map((btn, index) => (
        <button
          key={index}
          className={`wa-cta-button ${btn.type.toLowerCase().replace('_', '-')} ${
            isQuickReply(btn.type) ? 'quick-reply' : ''
          }`}
        >
          {!isQuickReply(btn.type) && (
            <span className="wa-cta-icon">
              {getButtonIcon(btn.type)}
            </span>
          )}
          <span className="wa-cta-text">{btn.text || btn.type}</span>
        </button>
      ))}
    </div>
  );
}

export default WhatsAppCTAButtons;
