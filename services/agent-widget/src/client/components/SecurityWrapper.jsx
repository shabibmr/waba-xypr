import React from 'react';

export default function SecurityWrapper({ tenantId, children }) {
    if (!tenantId) {
        return (
            <div className="error-screen" role="alert">
                <p>Access denied: tenant context missing.</p>
            </div>
        );
    }
    return children;
}
