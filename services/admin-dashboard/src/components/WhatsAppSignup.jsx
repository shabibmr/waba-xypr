// admin-dashboard/src/components/WhatsAppSignup.jsx
import React, { useState, useEffect } from 'react';
import { CheckCircle, MessageCircle, Loader } from 'lucide-react';

function WhatsAppSignup({ onSuccess, initialData }) {
    const [loading, setLoading] = useState(false);
    const [wabaData, setWabaData] = useState(initialData || null);
    const [error, setError] = useState(null);
    const [fbReady, setFbReady] = useState(false);

    useEffect(() => {
        // Initialize Facebook SDK
        if (window.FB) {
            initFB();
        } else {
            window.fbAsyncInit = initFB;
        }

        function initFB() {
            window.FB.init({
                appId: import.meta.env.VITE_META_APP_ID,
                cookie: true,
                xfbml: true,
                version: 'v18.0'
            });
            setFbReady(true);
        }
    }, []);

    const handleSignup = () => {
        if (!fbReady) {
            setError('Facebook SDK not loaded. Please refresh the page.');
            return;
        }

        setLoading(true);
        setError(null);

        // Launch WhatsApp Embedded Signup
        window.FB.login(
            (response) => {
                if (response.authResponse) {
                    handleSignupCallback(response.authResponse.code);
                } else {
                    setError('WhatsApp signup was cancelled or failed.');
                    setLoading(false);
                }
            },
            {
                config_id: import.meta.env.VITE_META_CONFIG_ID,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: '',
                    sessionInfoVersion: 2
                }
            }
        );
    };

    const handleSignupCallback = async (code) => {
        try {
            // Exchange code for access token and get WABA details
            const response = await fetch('/api/whatsapp/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!response.ok) {
                throw new Error('Failed to complete WhatsApp signup');
            }

            const data = await response.json();
            setWabaData(data);
            onSuccess(data);
            setLoading(false);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleDisconnect = () => {
        setWabaData(null);
        onSuccess(null);
    };

    if (wabaData) {
        return (
            <div className="card bg-green-600/10 border border-green-600/30">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-400 mb-2">
                                WhatsApp Business Connected
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Phone Number:</span>
                                    <span className="font-medium">{wabaData.displayPhoneNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">WABA ID:</span>
                                    <code className="text-sm bg-gray-800 px-2 py-1 rounded">
                                        {wabaData.wabaId}
                                    </code>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Phone Number ID:</span>
                                    <code className="text-sm bg-gray-800 px-2 py-1 rounded">
                                        {wabaData.phoneNumberId}
                                    </code>
                                </div>
                                {wabaData.qualityRating && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Quality Rating:</span>
                                        <span className="badge badge-success capitalize">
                                            {wabaData.qualityRating}
                                        </span>
                                    </div>
                                )}
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
            <h3 className="text-lg font-semibold mb-3">Connect WhatsApp Business</h3>
            <p className="text-gray-400 mb-4">
                Use Meta's embedded signup to connect your WhatsApp Business Account.
                This will allow you to send and receive WhatsApp messages.
            </p>

            {error && (
                <div className="alert alert-error mb-4">
                    <div className="text-sm">{error}</div>
                </div>
            )}

            <button
                onClick={handleSignup}
                disabled={loading || !fbReady}
                className="btn btn-success w-full"
            >
                {loading ? (
                    <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Completing signup...
                    </>
                ) : (
                    <>
                        <MessageCircle className="w-4 h-4" />
                        Connect WhatsApp Business
                    </>
                )}
            </button>

            <p className="text-xs text-gray-500 mt-3">
                A Meta popup will appear for you to select or create a WhatsApp Business Account.
            </p>
        </div>
    );
}

export default WhatsAppSignup;
