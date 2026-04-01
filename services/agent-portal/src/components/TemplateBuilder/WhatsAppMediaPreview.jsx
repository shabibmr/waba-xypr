import React from 'react';
import { Image, Video, FileText, MapPin, Play, Download } from 'lucide-react';

/**
 * WhatsApp Media Preview Component
 * Renders media headers (image, video, document, location) in WhatsApp style
 */
function WhatsAppMediaPreview({ format, mediaUrl, fileName }) {
  if (!format) return null;

  switch (format) {
    case 'IMAGE':
      return (
        <div className="wa-media-container image">
          {mediaUrl ? (
            <img src={mediaUrl} alt="Header" className="wa-media-image" />
          ) : (
            <div className="wa-media-placeholder">
              <Image className="w-10 h-10 text-surface-300" strokeWidth={1.5} />
              <span className="wa-placeholder-text">Image</span>
            </div>
          )}
        </div>
      );

    case 'VIDEO':
      return (
        <div className="wa-media-container video">
          {mediaUrl ? (
            <div className="wa-video-preview">
              <video className="wa-media-video" src={mediaUrl} />
              <div className="wa-video-overlay">
                <div className="wa-play-button">
                  <Play className="w-8 h-8 text-white" fill="white" />
                </div>
                <div className="wa-video-duration">0:15</div>
              </div>
            </div>
          ) : (
            <div className="wa-media-placeholder">
              <Video className="w-10 h-10 text-surface-300" strokeWidth={1.5} />
              <span className="wa-placeholder-text">Video</span>
            </div>
          )}
        </div>
      );

    case 'DOCUMENT':
      return (
        <div className="wa-document-preview">
          <div className="wa-doc-icon">
            <FileText className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
          </div>
          <div className="wa-doc-info">
            <div className="wa-doc-name">{fileName || 'Document.pdf'}</div>
            <div className="wa-doc-size">1 page · PDF</div>
          </div>
          <div className="wa-media-placeholder">
            <MapPin className="w-10 h-10 text-primary-300" strokeWidth={1.5} />
            <span className="wa-placeholder-text">Location</span>
          </div>
        </div>
      );

    case 'LOCATION':
      return (
        <div className="wa-media-container location">
          <div className="wa-media-placeholder">
            <MapPin className="w-10 h-10 text-red-400" strokeWidth={1.5} />
            <span className="wa-placeholder-text">Location</span>
          </div>
        </div>
      );

    case 'TEXT':
      return null; // Text headers are rendered separately

    default:
      return null;
  }
}

export default WhatsAppMediaPreview;
