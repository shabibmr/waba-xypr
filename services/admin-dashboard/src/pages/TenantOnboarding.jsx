// admin-dashboard/src/pages/TenantOnboarding.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Building2, Cloud, MessageCircle, FileCheck } from 'lucide-react';
import axios from 'axios';
import GenesysOAuth from '../components/GenesysOAuth';
import WhatsAppSignup from '../components/WhatsAppSignup';

const STEPS = [
    { id: 1, name: 'Basic Info', icon: Building2 },
    { id: 2, name: 'Genesys OAuth', icon: Cloud },
    { id: 3, name: 'WhatsApp', icon: MessageCircle },
    { id: 4, name: 'Review', icon: FileCheck }
];

function TenantOnboarding() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        tenantId: '',
        name: '',
        subdomain: '',
        plan: 'standard',
        genesysOrg: null,
        whatsappData: null
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenesysConnect = (orgDetails) => {
        setFormData(prev => ({ ...prev, genesysOrg: orgDetails }));
    };

    const handleWhatsAppConnect = (wabaData) => {
        setFormData(prev => ({ ...prev, whatsappData: wabaData }));
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return formData.tenantId && formData.name;
            case 2:
                return formData.genesysOrg !== null;
            case 3:
                return formData.whatsappData !== null;
            case 4:
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (canProceed() && currentStep < 4) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            // Create tenant
            const tenantPayload = {
                tenantId: formData.tenantId,
                name: formData.name,
                subdomain: formData.subdomain,
                plan: formData.plan,
                genesysOrgId: formData.genesysOrg?.orgId,
                genesysOrgName: formData.genesysOrg?.name,
                genesysRegion: formData.genesysOrg?.region
            };

            const tenantResponse = await axios.post('/tenants', tenantPayload);
            const { tenant, apiKey } = tenantResponse.data;

            // Store Genesys credentials
            if (formData.genesysOrg) {
                await axios.post(`/tenants/${tenant.tenant_id}/credentials`, {
                    type: 'genesys',
                    credentials: {
                        clientId: formData.genesysOrg.clientId,
                        clientSecret: formData.genesysOrg.clientSecret,
                        accessToken: formData.genesysOrg.accessToken,
                        refreshToken: formData.genesysOrg.refreshToken,
                        region: formData.genesysOrg.region
                    }
                });
            }

            // Store WhatsApp credentials
            if (formData.whatsappData) {
                await axios.post(`/tenants/${tenant.tenant_id}/whatsapp`, {
                    wabaId: formData.whatsappData.wabaId,
                    phoneNumberId: formData.whatsappData.phoneNumberId,
                    accessToken: formData.whatsappData.accessToken,
                    businessId: formData.whatsappData.businessId,
                    displayPhoneNumber: formData.whatsappData.displayPhoneNumber,
                    qualityRating: formData.whatsappData.qualityRating
                });
            }

            // Show success and redirect
            alert(`Tenant created successfully!\\n\\nTenant ID: ${tenant.tenant_id}\\nAPI Key: ${apiKey}\\n\\nPlease save this API key - it won't be shown again.`);
            navigate('/tenants');
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Create New Tenant</h1>
                <p className="text-gray-400">Set up a new organization with WhatsApp and Genesys integration</p>
            </div>

            {/* Progress Steps */}
            <div className="card mb-8">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition ${isCompleted
                                                ? 'bg-green-600 text-white'
                                                : isActive
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-400'
                                            }`}
                                    >
                                        {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                    </div>
                                    <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                        {step.name}
                                    </div>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`h-1 flex-1 mx-4 rounded ${isCompleted ? 'bg-green-600' : 'bg-gray-700'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="alert alert-error mb-6">
                    <div>
                        <div className="font-semibold">Error Creating Tenant</div>
                        <div className="text-sm">{error}</div>
                    </div>
                </div>
            )}

            {/* Step Content */}
            <div className="card mb-8">
                {currentStep === 1 && <Step1BasicInfo formData={formData} onChange={handleInputChange} />}
                {currentStep === 2 && (
                    <Step2GenesysOAuth genesysOrg={formData.genesysOrg} onConnect={handleGenesysConnect} />
                )}
                {currentStep === 3 && (
                    <Step3WhatsApp whatsappData={formData.whatsappData} onConnect={handleWhatsAppConnect} />
                )}
                {currentStep === 4 && <Step4Review formData={formData} />}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="btn btn-secondary"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                {currentStep < 4 ? (
                    <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="btn btn-primary"
                    >
                        Next
                        <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !canProceed()}
                        className="btn btn-success"
                    >
                        {loading ? 'Creating...' : 'Create Tenant'}
                        <Check className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

// Step 1: Basic Information
function Step1BasicInfo({ formData, onChange }) {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-6">Basic Information</h2>

            <div className="space-y-4">
                <div>
                    <label className="label">
                        Tenant ID <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        name="tenantId"
                        value={formData.tenantId}
                        onChange={onChange}
                        placeholder="e.g., acme-corp"
                        className="input"
                        pattern="[a-z0-9-]+"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Lowercase letters, numbers, and hyphens only
                    </p>
                </div>

                <div>
                    <label className="label">
                        Organization Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={onChange}
                        placeholder="e.g., Acme Corporation"
                        className="input"
                    />
                </div>

                <div>
                    <label className="label">Subdomain (Optional)</label>
                    <input
                        type="text"
                        name="subdomain"
                        value={formData.subdomain}
                        onChange={onChange}
                        placeholder="e.g., acme"
                        className="input"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Used for subdomain-based tenant resolution
                    </p>
                </div>

                <div>
                    <label className="label">Plan</label>
                    <select name="plan" value={formData.plan} onChange={onChange} className="select">
                        <option value="starter">Starter</option>
                        <option value="standard">Standard</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

// Step 2: Genesys OAuth
function Step2GenesysOAuth({ genesysOrg, onConnect }) {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-2">Genesys Cloud Integration</h2>
            <p className="text-gray-400 mb-6">
                Connect your Genesys Cloud organization to enable contact center integration.
            </p>
            <GenesysOAuth onSuccess={onConnect} initialData={genesysOrg} />
        </div>
    );
}

// Step 3: WhatsApp
function Step3WhatsApp({ whatsappData, onConnect }) {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-2">WhatsApp Business Setup</h2>
            <p className="text-gray-400 mb-6">
                Connect your WhatsApp Business Account to enable messaging capabilities.
            </p>
            <WhatsAppSignup onSuccess={onConnect} initialData={whatsappData} />
        </div>
    );
}

// Step 4: Review
function Step4Review({ formData }) {
    return (
        <div>
            <h2 className="text-2xl font-semibold mb-6">Review Configuration</h2>

            <div className="space-y-6">
                {/* Basic Info */}
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-400">Basic Information</h3>
                    <div className="space-y-2">
                        <InfoRow label="Tenant ID" value={formData.tenantId} />
                        <InfoRow label="Organization Name" value={formData.name} />
                        <InfoRow label="Subdomain" value={formData.subdomain || '—'} />
                        <InfoRow label="Plan" value={<span className="capitalize">{formData.plan}</span>} />
                    </div>
                </div>

                {/* Genesys */}
                {formData.genesysOrg && (
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-green-400">Genesys Cloud</h3>
                        <div className="space-y-2">
                            <InfoRow label="Organization" value={formData.genesysOrg.name} />
                            <InfoRow label="Org ID" value={formData.genesysOrg.orgId} />
                            <InfoRow label="Region" value={formData.genesysOrg.region} />
                        </div>
                    </div>
                )}

                {/* WhatsApp */}
                {formData.whatsappData && (
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-green-400">WhatsApp Business</h3>
                        <div className="space-y-2">
                            <InfoRow label="Phone Number" value={formData.whatsappData.displayPhoneNumber} />
                            <InfoRow label="WABA ID" value={formData.whatsappData.wabaId} />
                            <InfoRow label="Phone Number ID" value={formData.whatsappData.phoneNumberId} />
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                <p className="text-sm text-blue-400">
                    <strong>Note:</strong> An API key will be generated upon tenant creation.
                    Make sure to save it securely as it will only be shown once.
                </p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

export default TenantOnboarding;
