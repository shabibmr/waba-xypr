import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import whatsappService from '../services/whatsappService';

function Onboarding() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [whatsappData, setWhatsappData] = useState(null);

    // Handle being loaded inside the popup (Callback URL)
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorCode = params.get('error_code');
        const errorMessage = params.get('error_message');

        if (window.opener && (code || errorCode)) {
            if (code) {
                window.opener.postMessage({
                    type: 'WHATSAPP_SIGNUP_SUCCESS',
                    data: { code } // Send the code back to be exchanged
                }, window.location.origin);
            } else {
                window.opener.postMessage({
                    type: 'WHATSAPP_SIGNUP_ERROR',
                    error: errorMessage || 'Unknown error'
                }, window.location.origin);
            }
            window.close();
        }
    }, []);

    const handleWhatsAppSignup = async () => {
        setError('');
        setLoading(true);

        try {
            const data = await whatsappService.initiateSignup();
            await whatsappService.completeSetup(data);
            handleComplete();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setError('');
        setLoading(true);
        try {
            await whatsappService.skipSetup();
            handleComplete();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = () => {
        navigate('/workspace');
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="card max-w-2xl w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                        <MessageSquare className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">WhatsApp Setup</h1>
                    <p className="text-gray-400">Connect your WhatsApp Business Account</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {!whatsappData ? (
                    <div className="space-y-6">
                        <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
                            <p className="font-medium mb-2">What you'll need:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>A Meta Business Account</li>
                                <li>WhatsApp Business Account access</li>
                                <li>Phone number for WhatsApp</li>
                            </ul>
                        </div>

                        <button
                            onClick={handleWhatsAppSignup}
                            disabled={loading}
                            className="w-full bg-[#1877F2] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Opening WhatsApp Signup...
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="w-6 h-6" />
                                    Connect WhatsApp Business
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={loading}
                            className="btn-secondary w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                                    Skipping...
                                </>
                            ) : (
                                'Skip for now'
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg flex items-start gap-3">
                            <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium mb-1">WhatsApp Connected Successfully!</p>
                                <p className="text-sm">Your account is ready to receive messages.</p>
                            </div>
                        </div>

                        <div className="bg-gray-700 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-400">WABA ID:</span>
                                <span className="font-mono">{whatsappData.waba_id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Phone Number:</span>
                                <span className="font-mono">{whatsappData.phone_number}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleComplete}
                            className="btn-primary w-full"
                        >
                            Go to Workspace
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Onboarding;
