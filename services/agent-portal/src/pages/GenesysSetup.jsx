import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, ShieldCheck, MessageSquare, Check, ArrowRight, Loader2, AlertCircle, Plus } from 'lucide-react';
import genesysPlatformService from '../services/genesysPlatformService';
import authService from '../services/authService';
import { useToast } from '../contexts/ToastContext';
import '../styles/genesysSetup.css';

const STEPS = {
    ORG_DISCOVERY: 0,
    OAUTH_CLIENT: 1,
    INTEGRATION: 2,
    SUCCESS: 3
};

function GenesysSetup() {
    const navigate = useNavigate();
    const toast = useToast();
    const [currentStep, setCurrentStep] = useState(STEPS.ORG_DISCOVERY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Step 1 State
    const [orgInfo, setOrgInfo] = useState(null);

    // Step 2 State
    const [oauthClients, setOauthClients] = useState([]);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [clientName, setClientName] = useState('Agent Widget Middleware Client');

    // Step 3 State
    const [webhookUrl, setWebhookUrl] = useState('');

    useEffect(() => {
        // Auto-detect a webhook URL if possible, otherwise leave empty
        const host = window.location.host;
        if (host !== 'localhost:3000' && host !== '127.0.0.1:3000') {
            setWebhookUrl(`https://${host}/api/genesys/webhook`);
        }
    }, []);

    const fetchOrgInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await genesysPlatformService.getOrgInfo();
            setOrgInfo(data);
            setCurrentStep(STEPS.OAUTH_CLIENT);
            await fetchOAuthClients(); // Pre-fetch next step
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOAuthClients = async () => {
        try {
            const data = await genesysPlatformService.listOAuthClients();
            setOauthClients(data.entities || []);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCreateClient = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await genesysPlatformService.createOAuthClient({ name: clientName });
            toast.success('OAuth Client created and saved securely!');
            // Move to next step since it's saved in the backend
            setCurrentStep(STEPS.INTEGRATION);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProvisionMessaging = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await genesysPlatformService.provisionMessaging({
                name: 'Agent Widget Open Messaging',
                webhookUrl: webhookUrl
            });
            toast.success('Messaging & Widget provisioned!');
            setCurrentStep(STEPS.SUCCESS);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderOrgDiscovery = () => (
        <div className="setup-step text-center">
            <div className="icon-wrapper mb-6 mx-auto bg-blue-600/20 text-blue-500">
                <Building className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Welcome to setup</h2>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                We'll configure your Genesys Cloud organization automatically.
            </p>

            <button
                onClick={fetchOrgInfo}
                disabled={loading}
                className="btn-primary w-full max-w-xs flex items-center justify-center gap-2 mx-auto"
            >
                {loading ? <><Loader2 className="animate-spin w-5 h-5" /> Connecting...</> : 'Start Discovery'}
            </button>
        </div>
    );

    const renderOAuthClient = () => (
        <div className="setup-step">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-800">
                <div className="icon-wrapper bg-purple-600/20 text-purple-500">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-xl font-bold">OAuth Client</h2>
                    <p className="text-sm text-gray-400">Org: {orgInfo?.name}</p>
                </div>
            </div>

            {oauthClients.length > 0 && !showNewClientForm ? (
                <div className="mb-6">
                    <p className="text-sm text-gray-400 mb-4">You have {oauthClients.length} existing clients.</p>
                    <div className="space-y-3 max-h-48 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                        {oauthClients.map(client => (
                            <div key={client.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer flex justify-between items-center group">
                                <div>
                                    <h4 className="font-medium text-sm group-hover:text-blue-400 transition-colors">{client.name}</h4>
                                    <p className="text-xs text-gray-500">{client.authorizedGrantType}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${client.state === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700'}`}>
                                    {client.state}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowNewClientForm(true)}
                        className="w-full py-3 border border-dashed border-gray-600 hover:border-blue-500 rounded-lg text-gray-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Automatically create a new one
                    </button>
                </div>
            ) : (
                <form onSubmit={handleCreateClient} className="space-y-6">
                    <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg mb-6 text-sm text-blue-200">
                        We will create a Client Credentials grant for backend services. The secret will be stored securely.
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Client Name</label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="form-input w-full"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !clientName}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? <><Loader2 className="animate-spin w-5 h-5" /> Creating...</> : 'Create & Save Securely'}
                    </button>

                    {oauthClients.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowNewClientForm(false)}
                            className="w-full text-center text-sm text-gray-500 hover:text-gray-300 mt-4"
                        >
                            Cancel and view existing
                        </button>
                    )}
                </form>
            )}
        </div>
    );

    const renderIntegration = () => (
        <div className="setup-step">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-800">
                <div className="icon-wrapper bg-green-600/20 text-green-500">
                    <MessageSquare className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-xl font-bold">Messaging & Widget</h2>
                    <p className="text-sm text-gray-400">Step 3 of 4</p>
                </div>
            </div>

            <form onSubmit={handleProvisionMessaging} className="space-y-6">
                <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
                    <h3 className="font-medium mb-2">What happens here?</h3>
                    <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                        <li>An <strong>Open Messaging Integration</strong> will be created.</li>
                        <li>A securely generated webhook token will be attached.</li>
                        <li>A <strong>Widget Deployment</strong> will be provisioned.</li>
                    </ul>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                        Public Webhook URL <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://your-domain.ngrok.app/api/genesys/webhook"
                        className="form-input w-full"
                        required
                    />
                    <p className="text-xs text-gray-500 mt-2">The URL where Genesys will send inbound messages.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setCurrentStep(STEPS.OAUTH_CLIENT)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !webhookUrl}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {loading ? <><Loader2 className="animate-spin w-5 h-5" /> Provisioning...</> : 'Provision automatically'}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderSuccess = () => (
        <div className="setup-step text-center py-8">
            <div className="icon-wrapper mb-6 mx-auto bg-green-500 text-white animate-bounce-short">
                <Check className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Provisioning Complete!</h2>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                Genesys Cloud is perfectly configured. The Agent portal backend is now securely linked to your org.
            </p>

            <div className="bg-gray-800 rounded-xl p-6 mb-8 text-left border border-gray-700">
                <h3 className="font-medium mb-4 pb-2 border-b border-gray-700">Next Step: WhatsApp</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Connect your WhatsApp Business Account (WABA) using Facebook Login to start routing messages into Genesys.
                </p>
                <button
                    onClick={() => navigate('/onboarding')}
                    className="w-full bg-[#1877F2] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-2"
                >
                    <MessageSquare className="w-5 h-5" /> Connect WABA
                </button>
            </div>
        </div>
    );

    const renderStepIndicators = () => {
        return (
            <div className="flex items-center justify-between mb-8 max-w-xs mx-auto">
                {[0, 1, 2, 3].map(step => (
                    <React.Fragment key={step}>
                        <div className={`w-3 h-3 rounded-full ${currentStep >= step ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-gray-700'}`} />
                        {step < 3 && (
                            <div className={`flex-1 h-0.5 ${currentStep > step ? 'bg-blue-500' : 'bg-gray-700'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">

                {renderStepIndicators()}

                <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 relative overflow-hidden">
                    {/* Background glow effect */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/20 blur-3xl rounded-full pointer-events-none" />

                    {error && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex gap-3 text-red-400 text-sm items-start relative z-10">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>{error}</div>
                        </div>
                    )}

                    <div className="relative z-10">
                        {currentStep === STEPS.ORG_DISCOVERY && renderOrgDiscovery()}
                        {currentStep === STEPS.OAUTH_CLIENT && renderOAuthClient()}
                        {currentStep === STEPS.INTEGRATION && renderIntegration()}
                        {currentStep === STEPS.SUCCESS && renderSuccess()}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default GenesysSetup;
