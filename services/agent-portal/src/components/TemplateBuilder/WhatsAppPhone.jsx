import React from 'react';
import { Signal, Wifi, Battery } from 'lucide-react';

/**
 * WhatsApp Phone Mockup Container
 * Simulates an iPhone with iOS status bar and WhatsApp chrome
 */
function WhatsAppPhone({ children }) {
  return (
    <div className="whatsapp-phone-container">
      {/* iPhone Bezel/Frame */}
      <div className="phone-frame">
        {/* iOS Status Bar */}
        <div className="ios-status-bar">
          <div className="status-left">
            <span className="time">9:41</span>
          </div>
          <div className="status-center">
            {/* Dynamic Island / Notch */}
            <div className="notch"></div>
          </div>
          <div className="status-right">
            <Signal className="w-3.5 h-3.5" strokeWidth={2.5} />
            <Wifi className="w-3.5 h-3.5" strokeWidth={2.5} />
            <div className="battery-icon">
              <Battery className="w-6 h-3.5" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Content Area (Header + Chat + Input) */}
        <div className="phone-content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default WhatsAppPhone;
