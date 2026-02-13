import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building, MessageSquare, CheckCircle, Loader2, AlertCircle, ArrowRight
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import authService from '../services/authService';
import tenantService from '../services/tenantService';
import whatsappService from '../services/whatsappService';
import { useToast } from '../contexts/ToastContext';

const STEPS = {
    ORG_REVIEW: 0,
    WABA: 1,
    COMPLETE: 2
};

function Onboarding() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();
    const [currentStep, setCurrentStep] = useState(STEPS.ORG_REVIEW);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill org data from Genesys
    const genesysOrg = authService.getGenesysOrg();
    const [orgData, setOrgData] = useState({
        organizationName: genesysOrg?.name || '',
        domain: genesysOrg?.domain || ''
    });

    // WhatsApp state
    const [whatsappData, setWhatsappData] = useState(null);
    const [whatsappSkipped, setWhatsappSkipped] = useState(false);

    // Handle WhatsApp OAuth popup callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorCode = params.get('error_code');
        const errorMessage = params.get('error_message');

        if (window.opener && (code || errorCode)) {
            if (code) {
                window.opener.postMessage(
                    { type: 'WHATSAPP_SIGNUP_SUCCESS', data: { code } },
                    window.location.origin
                );
            } else {
                window.opener.postMessage(
                    { type: 'WHATSAPP_SIGNUP_ERROR', error: errorMessage || 'Unknown error' },
                    window.location.origin
                );
            }
            window.close();
        }
    }, []);

    const handleSaveOrg = async () => {
        if (!orgData.organizationName) {
            setError('Organization name is required');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await tenantService.updateProfile(orgData);
            toast.success('Organization details saved!');
            setCurrentStep(STEPS.WABA);
        } catch (err) {
            setError(err.message || 'Failed to save organization details');
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppSignup = async () => {
        setError('');
        setLoading(true);
        try {
            const data = await whatsappService.initiateSignup();
            await whatsappService.completeSetup(data);
            setWhatsappData(data);
            toast.success('WhatsApp Business connected!');
        } catch (err) {
            setError(err.message || 'Failed to connect WhatsApp Business');
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (skipped = false) => {
        setLoading(true);
        setError('');
        try {
            const tenantId = user?.organization?.tenant_id || user?.tenant_id;
            if (!tenantId) throw new Error('Tenant ID not found. Please try logging in again.');

            await tenantService.completeOnboarding(tenantId, {
                whatsappConfigured: !!whatsappData,
                skippedWhatsApp: skipped
            });

            toast.success('Setup complete! Welcome!');
            setCurrentStep(STEPS.COMPLETE);
            setTimeout(() => navigate('/workspace'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to complete onboarding');
        } finally {
            setLoading(false);
        }
    };

    const renderOrgReview = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
                    <Building className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Your Organization</h1>
                <p className="text-gray-400">We fetched these details from your Genesys account. Confirm or edit before continuing.</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveOrg(); }} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={orgData.organizationName}
                        onChange={(e) => setOrgData({ ...orgData, organizationName: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="Organization name"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Domain</label>
                    <input
                        type="text"
                        value={orgData.domain}
                        onChange={(e) => setOrgData({ ...orgData, domain: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="example.com"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !orgData.organizationName}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Saving...</>
                    ) : (
                        <>Continue <ArrowRight className="w-5 h-5" /></>
                    )}
                </button>
            </form>
        </div>
    );

    const renderWABA = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                    <MessageSquare className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Connect WhatsApp Business</h1>
                <p className="text-gray-400">Link your WhatsApp Business Account to start messaging customers.</p>
            </div>

            {!whatsappData ? (
                <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg text-sm">
                        <p className="font-medium mb-1">What you'll need:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>A Meta Business Account</li>
                            <li>WhatsApp Business Account access</li>
                            <li>A phone number for WhatsApp</li>
                        </ul>
                    </div>

                    <button
                        onClick={handleWhatsAppSignup}
                        disabled={loading}
                        className="w-full bg-[#1877F2] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Connecting...</>
                        ) : (
                            <><MessageSquare className="w-5 h-5" />Connect WhatsApp Business</>
                        )}
                    </button>

                    <button
                        onClick={() => { setWhatsappSkipped(true); handleComplete(true); }}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                    >
                        Skip for now — set up later in Settings
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">WhatsApp Connected!</p>
                            {whatsappData.phone_number && (
                                <p className="text-sm mt-1">Phone: {whatsappData.phone_number}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleComplete(false)}
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Finishing...</>
                        ) : (
                            <>Complete Setup <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                </div>
            )}
        </div>
    );

    const renderComplete = () => (
        <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600 rounded-full mb-6 animate-pulse">
                <CheckCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold mb-4">You're All Set!</h1>
            <p className="text-gray-400 text-lg mb-4">Redirecting to your workspace...</p>
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
        </div>
    );

    const stepLabels = ['Organization', 'WhatsApp', 'Done'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center px-4">
            <div className="card max-w-lg w-full">
                {/* Progress */}
                {currentStep !== STEPS.COMPLETE && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Step {currentStep + 1} of 2</span>
                            <span className="text-sm text-gray-400">{stepLabels[currentStep]}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / 2) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {currentStep === STEPS.ORG_REVIEW && renderOrgReview()}
                {currentStep === STEPS.WABA && renderWABA()}
                {currentStep === STEPS.COMPLETE && renderComplete()}
            </div>
        </div>
    );
}

export default Onboarding;
