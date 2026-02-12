import React from 'react';

// WhatsApp-style delivery tick icons
export default function StatusIcons({ status }) {
    if (!status) return null;

    const icons = {
        pending: <span className="tick tick--pending" aria-label="Pending">○</span>,
        sent:    <span className="tick tick--sent"    aria-label="Sent">✓</span>,
        delivered: <span className="tick tick--delivered" aria-label="Delivered">✓✓</span>,
        read:    <span className="tick tick--read"    aria-label="Read">✓✓</span>,
        failed:  <span className="tick tick--failed"  aria-label="Failed">✗</span>,
    };

    return <span className="status-icons">{icons[status] ?? null}</span>;
}
