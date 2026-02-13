import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building, MessageSquare, CheckCircle, Loader2, AlertCircle,
    ArrowRight, ArrowLeft, Rocket, Users, Briefcase, Wifi
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import authService from '../services/authService';
import tenantService from '../services/tenantService';
import whatsappService from '../services/whatsappService';
import { useToast } from '../contexts/ToastContext';

const STEPS = {
    WELCOME: 0,
    ORGANIZATION: 1,
    GENESYS: 2,
    WHATSAPP: 3,
    VALIDATION: 4,
    WEBHOOKS: 5,
    COMPLETE: 6
};

function Onboarding() {
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Organization form data
    const [orgData, setOrgData] = useState({
        organizationName: '',
        industry: '',
        companySize: '',
        country: '',
        timezone: ''
    });

    // Genesys credentials data
    const [genesysData, setGenesysData] = useState({
        clientId: '',
        clientSecret: '',
        region: 'us-east-1'
    });

    // WhatsApp data
    const [whatsappData, setWhatsappData] = useState(null);
    const [whatsappSetupSkipped, setWhatsappSetupSkipped] = useState(false);

    // Validation results
    const [validationResults, setValidationResults] = useState(null);
    const [webhookUrls, setWebhookUrls] = useState(null);

    // Handle WhatsApp OAuth callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorCode = params.get('error_code');
        const errorMessage = params.get('error_message');

        if (window.opener && (code || errorCode)) {
            if (code) {
                window.opener.postMessage({
                    type: 'WHATSAPP_SIGNUP_SUCCESS',
                    data: { code }
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

    // Pre-fill organization name from user's tenant
    useEffect(() => {
        if (user?.organization?.tenant_name && !orgData.organizationName) {
            setOrgData(prev => ({
                ...prev,
                organizationName: user.organization.tenant_name
            }));
        }
    }, [user]);

    const handleNext = () => {
        if (currentStep === STEPS.WELCOME) {
            setCurrentStep(STEPS.ORGANIZATION);
        } else if (currentStep === STEPS.ORGANIZATION) {
            handleSaveOrganization();
        } else if (currentStep === STEPS.GENESYS) {
            handleSaveGenesys();
        } else if (currentStep === STEPS.WHATSAPP) {
            setCurrentStep(STEPS.VALIDATION);
        } else if (currentStep === STEPS.VALIDATION) {
            handleValidation();
        } else if (currentStep === STEPS.WEBHOOKS) {
            handleCompleteOnboarding();
        }
    };

    const handleBack = () => {
        if (currentStep > STEPS.WELCOME) {
            setCurrentStep(currentStep - 1);
            setError('');
        }
    };

    const handleSaveOrganization = async () => {
        // Validation
        if (!orgData.organizationName) {
            const errorMsg = 'Organization name is required';
            setError(errorMsg);
            toast.error(errorMsg);
            return;
        }

        setLoading(true);
        setError('');

        try {
            await tenantService.updateProfile(orgData);
            await refreshProfile();
            toast.success('Organization profile saved!');
            setCurrentStep(STEPS.GENESYS);
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Failed to save organization profile');
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
            toast.success('WhatsApp Business connected successfully!');
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Failed to connect WhatsApp Business');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipWhatsApp = () => {
        setWhatsappSetupSkipped(true);
        toast.info('WhatsApp setup skipped. You can configure it later.');
        handleCompleteOnboarding();
    };

    const handleCompleteOnboarding = async () => {
        setLoading(true);
        setError('');

        try {
            // Get tenant ID from user profile
            const tenantId = user?.organization?.tenant_id;

            if (!tenantId) {
                throw new Error('Tenant ID not found. Please try logging in again.');
            }

            await tenantService.completeOnboarding(tenantId, {
                whatsappConfigured: !!whatsappData,
                skippedWhatsApp: whatsappSetupSkipped
            });

            toast.success('Setup complete! Welcome to XYPR!');
            setCurrentStep(STEPS.COMPLETE);

            // Redirect after 2 seconds
            setTimeout(() => {
                navigate('/workspace');
            }, 2000);
        } catch (err) {
            const errorMsg = err.message || 'Failed to complete onboarding';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGenesys = async () => {
        // Validation
        if (!genesysData.clientId || !genesysData.clientSecret) {
            const errorMsg = 'Client ID and Secret are required';
            setError(errorMsg);
            toast.error(errorMsg);
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Save Genesys credentials to backend
            await tenantService.updateGenesysCredentials(genesysData);
            toast.success('Genesys credentials saved!');
            setCurrentStep(STEPS.WHATSAPP);
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Failed to save Genesys credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleValidation = async () => {
        setLoading(true);
        setError('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000';
            const response = await fetch(`${API_BASE_URL}/api/onboarding/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authService.getAccessToken()}`
                },
                body: JSON.stringify({
                    genesys: genesysData,
                    whatsapp: whatsappData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Validation failed');
            }

            setValidationResults(data.results);
            setWebhookUrls(data.webhookUrls);
            toast.success('Integration validated successfully!');
            setCurrentStep(STEPS.WEBHOOKS);
        } catch (err) {
            setError(err.message);
            toast.error(err.message || 'Validation failed');
        } finally {
            setLoading(false);
        }
    };

    const renderWelcome = () => (
        <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-6">
                <Rocket className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Welcome to XYPR!</h1>
            <p className="text-gray-400 text-lg mb-8">
                Let's get your WhatsApp Business integration set up in just a few steps.
            </p>

            <div className="bg-gray-800 rounded-lg p-6 mb-8 text-left">
                <h2 className="text-xl font-semibold mb-4">What we'll do:</h2>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Building className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-medium">Organization Setup</h3>
                            <p className="text-sm text-gray-400">Tell us about your company</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-medium">WhatsApp Connection</h3>
                            <p className="text-sm text-gray-400">Connect your WhatsApp Business Account</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-medium">Ready to Go!</h3>
                            <p className="text-sm text-gray-400">Start managing conversations</p>
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-sm text-gray-500 mt-4">
                This will take about 10 minutes
            </p>
        </div>
    );

    const renderOrganization = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
                    <Building className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Organization Information</h1>
                <p className="text-gray-400">Help us customize your experience</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                {/* Organization Name */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={orgData.organizationName}
                        onChange={(e) => setOrgData({ ...orgData, organizationName: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="Acme Corporation"
                        required
                    />
                </div>

                {/* Industry */}
                <div>
                    <label className="block text-sm font-medium mb-2">Industry</label>
                    <select
                        value={orgData.industry}
                        onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select industry</option>
                        <option value="technology">Technology</option>
                        <option value="retail">Retail / E-commerce</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="finance">Finance / Banking</option>
                        <option value="education">Education</option>
                        <option value="hospitality">Hospitality</option>
                        <option value="real-estate">Real Estate</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                {/* Company Size */}
                <div>
                    <label className="block text-sm font-medium mb-2">Company Size</label>
                    <select
                        value={orgData.companySize}
                        onChange={(e) => setOrgData({ ...orgData, companySize: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select size</option>
                        <option value="1-10">1-10 employees</option>
                        <option value="11-50">11-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="201-500">201-500 employees</option>
                        <option value="501+">501+ employees</option>
                    </select>
                </div>

                {/* Country */}
                <div>
                    <label className="block text-sm font-medium mb-2">Country</label>
                    <input
                        type="text"
                        value={orgData.country}
                        onChange={(e) => setOrgData({ ...orgData, country: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="United States"
                    />
                </div>

                {/* Timezone */}
                <div>
                    <label className="block text-sm font-medium mb-2">Timezone</label>
                    <select
                        value={orgData.timezone}
                        onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select timezone</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Dubai">Dubai (GST)</option>
                        <option value="Asia/Kolkata">India (IST)</option>
                        <option value="Asia/Singapore">Singapore (SGT)</option>
                    </select>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="btn-secondary flex-1 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !orgData.organizationName}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                Continue
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderWhatsApp = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                    <MessageSquare className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">WhatsApp Business Setup</h1>
                <p className="text-gray-400">Connect your WhatsApp Business Account</p>
            </div>

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

                    <div className="flex gap-3">
                        <button
                            onClick={handleBack}
                            className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                        <button
                            onClick={handleSkipWhatsApp}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            Skip for now
                        </button>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                        You can set up WhatsApp later from Settings
                    </p>
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
                        onClick={handleNext}
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Completing Setup...
                            </>
                        ) : (
                            <>
                                Complete Setup
                                <ArrowRight className="w-5 h-5" />
                            </>
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
            <p className="text-gray-400 text-lg mb-8">
                Your XYPR workspace is ready. Redirecting you now...
            </p>

            <div className="bg-gray-800 rounded-lg p-6 text-left">
                <h2 className="text-xl font-semibold mb-4">What's Next?</h2>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Start receiving WhatsApp messages from customers</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Manage conversations in your workspace</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>View analytics and performance metrics</span>
                    </li>
                </ul>
            </div>

            <div className="mt-6">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
            </div>
        </div>
    );

    const renderGenesys = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
                    <Briefcase className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Genesys Cloud Setup</h1>
                <p className="text-gray-400">Connect your Genesys Cloud account</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Client ID <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={genesysData.clientId}
                        onChange={(e) => setGenesysData({ ...genesysData, clientId: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="Enter Genesys Client ID"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Client Secret <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={genesysData.clientSecret}
                        onChange={(e) => setGenesysData({ ...genesysData, clientSecret: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="Enter Genesys Client Secret"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Region</label>
                    <select
                        value={genesysData.region}
                        onChange={(e) => setGenesysData({ ...genesysData, region: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                        <option value="us-east-1">US East (Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU West (Ireland)</option>
                        <option value="eu-central-1">EU Central (Frankfurt)</option>
                        <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                        <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                    </select>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="btn-secondary flex-1 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !genesysData.clientId || !genesysData.clientSecret}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                Continue
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderValidation = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-600 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Validate Integration</h1>
                <p className="text-gray-400">Test Genesys and WhatsApp connectivity</p>
            </div>

            <div className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
                    <p className="font-medium mb-2">We'll test:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Genesys Cloud API connectivity</li>
                        <li>WhatsApp Business API connectivity</li>
                        <li>Webhook endpoints availability</li>
                    </ul>
                </div>

                {validationResults && (
                    <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
                        <CheckCircle className="w-5 h-5 inline mr-2" />
                        All tests passed successfully!
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleBack}
                        className="btn-secondary flex-1 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Validating...
                            </>
                        ) : (
                            <>
                                {validationResults ? 'Continue' : 'Run Tests'}
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderWebhooks = () => (
        <div>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                    <Wifi className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Webhook Configuration</h1>
                <p className="text-gray-400">Copy these URLs to your Meta and Genesys dashboards</p>
            </div>

            <div className="space-y-6">
                <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Meta Webhook URL</h3>
                    <div className="bg-gray-800 p-3 rounded border border-gray-600">
                        <code className="text-sm text-blue-400 break-all">
                            {webhookUrls?.meta || `${import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000'}/webhook/meta/${user?.organization?.tenant_id}`}
                        </code>
                    </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Genesys Webhook URL</h3>
                    <div className="bg-gray-800 p-3 rounded border border-gray-600">
                        <code className="text-sm text-blue-400 break-all">
                            {webhookUrls?.genesys || `${import.meta.env.VITE_API_GATEWAY || 'http://localhost:3000'}/webhook/genesys/${user?.organization?.tenant_id}`}
                        </code>
                    </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg text-sm">
                    <strong>Important:</strong> Configure these webhook URLs in your Meta and Genesys dashboards to receive messages.
                </div>

                <button
                    onClick={handleNext}
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Completing...
                        </>
                    ) : (
                        <>
                            Complete Setup
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center px-4">
            <div className="card max-w-2xl w-full">
                {/* Progress Indicator */}
                {currentStep !== STEPS.COMPLETE && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Step {currentStep + 1} of 7</span>
                            <span className="text-sm text-gray-400">{Math.round(((currentStep + 1) / 7) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${((currentStep + 1) / 7) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Step Content */}
                {currentStep === STEPS.WELCOME && renderWelcome()}
                {currentStep === STEPS.ORGANIZATION && renderOrganization()}
                {currentStep === STEPS.GENESYS && renderGenesys()}
                {currentStep === STEPS.WHATSAPP && renderWhatsApp()}
                {currentStep === STEPS.VALIDATION && renderValidation()}
                {currentStep === STEPS.WEBHOOKS && renderWebhooks()}
                {currentStep === STEPS.COMPLETE && renderComplete()}
            </div>
        </div>
    );
}

export default Onboarding;
