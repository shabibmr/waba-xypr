import React from 'react';

export default function OfflineBanner({ visible }) {
    if (!visible) return null;
    return (
        <div className="offline-banner" role="alert" aria-live="assertive">
            Reconnecting…
        </div>
    );
}
