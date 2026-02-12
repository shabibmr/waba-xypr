import React from 'react';

export default function CustomerInfo({ waId, tenantId }) {
    if (!waId) return null;
    return (
        <div className="customer-info" aria-label="Customer information">
            <span className="customer-info__waid">+{waId}</span>
        </div>
    );
}
