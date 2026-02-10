// admin-dashboard/src/components/GenesysOAuth.jsx
import React, { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, Loader } from 'lucide-react';

function GenesysOAuth({ onSuccess, initialData }) {
    const [loading, setLoading] = useState(false);
    const [orgDetails, setOrgDetails] = useState(initialData || null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Listen for OAuth callback from popup
        const handleMessage = (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data.type === 'genesys-oauth-success') {
                setOrgDetails(event.data.orgDetails);
                setLoading(false);
                onSuccess(event.data.orgDetails);
            } else if (event.data.type === 'genesys-oauth-error') {
                setError(event.data.error);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onSuccess]);

    const handleConnect = () => {
        setLoading(true);
        setError(null);

        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const popup = window.open(
            '/auth/genesys/authorize',
            'genesys-oauth',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        // Check if popup was blocked
        if (!popup) {
            setError('Popup was blocked. Please allow popups for this site.');
            setLoading(false);
        }
    };

    const handleDisconnect = () => {
        setOrgDetails(null);
        onSuccess(null);
    };

    if (orgDetails) {
        return (
            <div className="card bg-green-600/10 border border-green-600/30">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-400 mb-2">
                                Genesys Account Connected
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Organization:</span>
                                    <span className="font-medium">{orgDetails.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Org ID:</span>
                                    <code className="text-sm bg-gray-800 px-2 py-1 rounded">
                                        {orgDetails.orgId}
                                    </code>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Region:</span>
                                    <span className="font-medium">{orgDetails.region}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDisconnect}
                        className="btn btn-secondary text-sm"
                    >
                        Change
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <h3 className="text-lg font-semibold mb-3">Connect Genesys Account</h3>
            <p className="text-gray-400 mb-4">
                Authenticate with your Genesys Cloud account to retrieve organization details
                and enable OAuth integration.
            </p>

            {error && (
                <div className="alert alert-error mb-4">
                    <div className="text-sm">{error}</div>
                </div>
            )}

            <button
                onClick={handleConnect}
                disabled={loading}
                className="btn btn-primary w-full"
            >
                {loading ? (
                    <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Waiting for authentication...
                    </>
                ) : (
                    <>
                        <ExternalLink className="w-4 h-4" />
                        Connect Genesys Cloud
                    </>
                )}
            </button>

            <button
                onClick={() => {
                    const demoOrg = {
                        name: 'Demo Organization',
                        orgId: 'demo-org-001',
                        region: 'aps1',
                        clientId: '7c513299-40e9-4c51-a34f-935bd56cfb56',
                        clientSecret: '-Yn-vPj1HCDq8HvYeadbLVBAx0I5wVkvcVKdS1MqRXo',
                        accessToken: 'demo-access-token',
                        refreshToken: 'demo-refresh-token'
                    };
                    setOrgDetails(demoOrg);
                    onSuccess(demoOrg);
                }}
                disabled={loading}
                className="btn btn-secondary w-full mt-2"
            >
                Skip (Use Demo Tenant)
            </button>

            <p className="text-xs text-gray-500 mt-3">
                A popup window will open for you to sign in with your Genesys Cloud credentials.
            </p>
        </div>
    );
}

export default GenesysOAuth;
