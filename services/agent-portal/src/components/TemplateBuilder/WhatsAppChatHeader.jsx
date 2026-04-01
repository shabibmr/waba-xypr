import React from 'react';
import { ChevronLeft, Video, Phone, MoreVertical, Building2, CheckCircle } from 'lucide-react';

/**
 * WhatsApp Chat Header Component
 * Displays business profile, verified badge, and action buttons
 */
function WhatsAppChatHeader({ businessName = 'Your Business' }) {
  return (
    <div className="wa-chat-header">
      {/* Back Button */}
      <button className="wa-back-btn">
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Business Profile */}
      <div className="wa-business-profile">
        <div className="wa-profile-pic">
          <div className="wa-avatar">
            <Building2 className="w-5 h-5 text-surface-400" />
          </div>
        </div>
        <div className="wa-profile-info">
          <div className="wa-business-name">{businessName}</div>
          <div className="wa-business-status">
            <CheckCircle className="w-3 h-3 text-[#2a75f3] fill-[#2a75f3]" />
            <span className="wa-status-text">Business Account</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="wa-header-actions">
        <button className="wa-action-btn">
          <Video className="w-5 h-5" />
        </button>
        <button className="wa-action-btn">
          <Phone className="w-5 h-5" />
        </button>
        <button className="wa-action-btn">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default WhatsAppChatHeader;
