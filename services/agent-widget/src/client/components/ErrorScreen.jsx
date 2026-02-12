import React from 'react';
import { detectMode } from '../utils/hostDetector';

export default function ErrorScreen({ message, mode }) {
    const isGenesysContext = (mode || detectMode()) === 'genesys';

    return (
        <div className="error-screen" role="alert">
            {isGenesysContext && message === 'InvalidConversation' ? (
                <p>No active Genesys conversation. Please select an active interaction.</p>
            ) : (
                <p>Error: {message}</p>
            )}
        </div>
    );
}
