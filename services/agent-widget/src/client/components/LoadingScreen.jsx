import React from 'react';

export default function LoadingScreen() {
    return (
        <div className="loading-screen" role="status" aria-label="Loading">
            <div className="spinner" aria-hidden="true" />
            <p>Loading…</p>
        </div>
    );
}
