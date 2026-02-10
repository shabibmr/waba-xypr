# 11 - Customer Portal (Agent Portal) - Onboarding Flow

**Priority:** LOW (Optional for Backend MVP)  
**Estimated Time:** 6-8 hours  
**Dependencies:** 02 (Tenant Service)  
**Can Run in Parallel:** Yes (doesn't block backend services)

---

## 🎯 Objective
Implement basic customer onboarding flow in Agent Portal to allow demo tenant setup with Genesys and WhatsApp credentials.

---

## 🛡️ Guard Rails (Check Before Starting)

- [x] Tenant Service running with complete onboarding endpoint (Task 02)
- [x] Agent Portal exists at `/services/agent-portal`
- [x] React + Vite setup complete
- [x] Tailwind CSS configured

---

## 📍 Anchors (Where to Make Changes)

**Existing Files:**
- `/services/agent-portal/src/App.tsx` - Main app
- `/services/agent-portal/src/pages/` - Page components

**New Files to Create:**
- `/services/agent-portal/src/pages/Onboarding/OnboardingWizard.tsx`
- `/services/agent-portal/src/pages/Onboarding/steps/WelcomeStep.tsx`
- `/services/agent-portal/src/pages/Onboarding/steps/OrganizationStep.tsx`
- `/services/agent-portal/src/pages/Onboarding/steps/GenesysStep.tsx`
- `/services/agent-portal/src/pages/Onboarding/steps/WhatsAppStep.tsx`
- `/services/agent-portal/src/pages/Onboarding/steps/ReviewStep.tsx`
- `/services/agent-portal/src/services/tenant.service.ts`

---

## 📝 Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
cd services/agent-portal
npm install react-hook-form zod @hookform/resolvers axios
```

### Step 2: Create Tenant Service Client

**File:** `src/services/tenant.service.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface TenantData {
    name: string;
    genesysOrgId: string;
    genesysCredentials: {
        clientId: string;
        clientSecret: string;
        region: string;
    };
    whatsappCredentials: {
        access_token: string;
        phone_number_id: string;
        business_account_id: string;
        waba_id: string;
    };
}

export async function createTenant(data: TenantData) {
    const response = await axios.post(`${API_BASE_URL}/api/tenants`, {
        name: data.name,
        genesys_org_id: data.genesysOrgId,
        status: 'pending'
    });

    return response.data;
}

export async function setGenesysCredentials(tenantId: string, credentials: any) {
    await axios.put(`${API_BASE_URL}/api/tenants/${tenantId}/credentials`, {
        type: 'genesys',
        credentials
    });
}

export async function setWhatsAppCredentials(tenantId: string, credentials: any) {
    await axios.put(`${API_BASE_URL}/api/tenants/${tenantId}/credentials`, {
        type: 'whatsapp',
        credentials
    });
}

export async function completeOnboarding(tenantId: string) {
    await axios.post(`${API_BASE_URL}/api/tenants/${tenantId}/complete-onboarding`);
}
```

### Step 3: Create Welcome Step

**File:** `src/pages/Onboarding/steps/WelcomeStep.tsx`

```tsx
import React from 'react';

interface Props {
    onNext: () => void;
}

export default function WelcomeStep({ onNext }: Props) {
    return (
        <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome to XYPR Messaging</h1>
            <p className="text-lg text-gray-600 mb-8">
                Connect your Genesys Cloud with WhatsApp Business in minutes
            </p>

            <div className="bg-blue-50 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">What you'll need:</h2>
                <ul className="text-left space-y-2">
                    <li className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        Genesys Cloud organization credentials
                    </li>
                    <li className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        WhatsApp Business Account access
                    </li>
                    <li className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        5 minutes of your time
                    </li>
                </ul>
            </div>

            <button
                onClick={onNext}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition"
            >
                Get Started
            </button>
        </div>
    );
}
```

### Step 4: Create Organization Step

**File:** `src/pages/Onboarding/steps/OrganizationStep.tsx`

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';

interface FormData {
    organizationName: string;
    genesysOrgId: string;
}

interface Props {
    onNext: (data: FormData) => void;
    onBack: () => void;
    initialData?: Partial<FormData>;
}

export default function OrganizationStep({ onNext, onBack, initialData }: Props) {
    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        defaultValues: initialData
    });

    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Organization Details</h2>

            <form onSubmit={handleSubmit(onNext)} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Organization Name
                    </label>
                    <input
                        {...register('organizationName', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="ACME Corporation"
                    />
                    {errors.organizationName && (
                        <p className="text-red-500 text-sm mt-1">{errors.organizationName.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Genesys Organization ID
                    </label>
                    <input
                        {...register('genesysOrgId', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="abc123-def456-ghi789"
                    />
                    {errors.genesysOrgId && (
                        <p className="text-red-500 text-sm mt-1">{errors.genesysOrgId.message}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                        Find this in your Genesys Cloud Admin console
                    </p>
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 px-6 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Continue
                    </button>
                </div>
            </form>
        </div>
    );
}
```

### Step 5: Create Genesys Credentials Step

**File:** `src/pages/Onboarding/steps/GenesysStep.tsx`

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';

interface FormData {
    clientId: string;
    clientSecret: string;
    region: string;
}

interface Props {
    onNext: (data: FormData) => void;
    onBack: () => void;
    initialData?: Partial<FormData>;
}

export default function GenesysStep({ onNext, onBack, initialData }: Props) {
    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        defaultValues: initialData || { region: 'mypurecloud.com' }
    });

    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Genesys OAuth Credentials</h2>

            <form onSubmit={handleSubmit(onNext)} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">Client ID</label>
                    <input
                        {...register('clientId', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter Genesys OAuth Client ID"
                    />
                    {errors.clientId && (
                        <p className="text-red-500 text-sm mt-1">{errors.clientId.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Client Secret</label>
                    <input
                        {...register('clientSecret', { required: 'Required' })}
                        type="password"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter Genesys OAuth Client Secret"
                    />
                    {errors.clientSecret && (
                        <p className="text-red-500 text-sm mt-1">{errors.clientSecret.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Region</label>
                    <select
                        {...register('region', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="mypurecloud.com">US East (mypurecloud.com)</option>
                        <option value="usw2.pure.cloud">US West (usw2.pure.cloud)</option>
                        <option value="cac1.pure.cloud">Canada (cac1.pure.cloud)</option>
                        <option value="mypurecloud.ie">EMEA (mypurecloud.ie)</option>
                        <option value="mypurecloud.com.au">APAC (mypurecloud.com.au)</option>
                    </select>
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 px-6 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Continue
                    </button>
                </div>
            </form>
        </div>
    );
}
```

### Step 6: Create WhatsApp Credentials Step

**File:** `src/pages/Onboarding/steps/WhatsAppStep.tsx`

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';

interface FormData {
    access_token: string;
    phone_number_id: string;
    business_account_id: string;
    waba_id: string;
}

interface Props {
    onNext: (data: FormData) => void;
    onBack: () => void;
    initialData?: Partial<FormData>;
}

export default function WhatsAppStep({ onNext, onBack, initialData }: Props) {
    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        defaultValues: initialData
    });

    return (
        <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">WhatsApp Business Credentials</h2>

            <form onSubmit={handleSubmit(onNext)} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">Access Token</label>
                    <input
                        {...register('access_token', { required: 'Required' })}
                        type="password"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="EAA..."
                    />
                    {errors.access_token && (
                        <p className="text-red-500 text-sm mt-1">{errors.access_token.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Phone Number ID</label>
                    <input
                        {...register('phone_number_id', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="123456789"
                    />
                    {errors.phone_number_id && (
                        <p className="text-red-500 text-sm mt-1">{errors.phone_number_id.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Business Account ID</label>
                    <input
                        {...register('business_account_id', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="987654321"
                    />
                    {errors.business_account_id && (
                        <p className="text-red-500 text-sm mt-1">{errors.business_account_id.message}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">WABA ID</label>
                    <input
                        {...register('waba_id', { required: 'Required' })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="111222333"
                    />
                    {errors.waba_id && (
                        <p className="text-red-500 text-sm mt-1">{errors.waba_id.message}</p>
                    )}
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex-1 px-6 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Continue
                    </button>
                </div>
            </form>
        </div>
    );
}
```

### Step 7: Create Review Step

**File:** `src/pages/Onboarding/steps/ReviewStep.tsx`

```tsx
import React from 'react';

interface Props {
    data: any;
    onBack: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export default function ReviewStep({ data, onBack, onSubmit, loading }: Props) {
    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Review & Confirm</h2>

            <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold mb-3">Organization</h3>
                    <p className="text-gray-700">{data.organizationName}</p>
                    <p className="text-sm text-gray-500">Org ID: {data.genesysOrgId}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold mb-3">Genesys Cloud</h3>
                    <p className="text-sm text-gray-500">Client ID: {data.genesysClientId.substring(0, 8)}...</p>
                    <p className="text-sm text-gray-500">Region: {data.genesysRegion}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold mb-3">WhatsApp Business</h3>
                    <p className="text-sm text-gray-500">Phone Number ID: {data.phoneNumberId}</p>
                    <p className="text-sm text-gray-500">Business Account: {data.businessAccountId}</p>
                </div>
            </div>

            <div className="mt-8 flex gap-4">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={loading}
                    className="flex-1 px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                    Back
                </button>
                <button
                    onClick={onSubmit}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                    {loading ? 'Setting up...' : 'Complete Setup'}
                </button>
            </div>
        </div>
    );
}
```

### Step 8: Create Main Wizard Component

**File:** `src/pages/Onboarding/OnboardingWizard.tsx`

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeStep from './steps/WelcomeStep';
import OrganizationStep from './steps/OrganizationStep';
import GenesysStep from './steps/GenesysStep';
import WhatsAppStep from './steps/WhatsAppStep';
import ReviewStep from './steps/ReviewStep';
import * as tenantService from '../../services/tenant.service';

export default function OnboardingWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<any>({});

    const handleComplete = async () => {
        setLoading(true);
        try {
            // 1. Create tenant
            const tenant = await tenantService.createTenant({
                name: formData.organizationName,
                genesysOrgId: formData.genesysOrgId,
                genesysCredentials: {
                    clientId: formData.genesysClientId,
                    clientSecret: formData.genesysClientSecret,
                    region: formData.genesysRegion
                },
                whatsappCredentials: {
                    access_token: formData.access_token,
                    phone_number_id: formData.phoneNumberId,
                    business_account_id: formData.businessAccountId,
                    waba_id: formData.wabaId
                }
            });

            // 2. Set Genesys credentials
            await tenantService.setGenesysCredentials(tenant.id, {
                clientId: formData.genesysClientId,
                clientSecret: formData.genesysClientSecret,
                region: formData.genesysRegion
            });

            // 3. Set WhatsApp credentials
            await tenantService.setWhatsAppCredentials(tenant.id, {
                access_token: formData.access_token,
                phone_number_id: formData.phoneNumberId,
                business_account_id: formData.businessAccountId,
                waba_id: formData.wabaId
            });

            // 4. Complete onboarding
            await tenantService.completeOnboarding(tenant.id);

            // Success - navigate to dashboard
            navigate('/dashboard');
        } catch (error) {
            console.error('Onboarding error:', error);
            alert('Failed to complete onboarding. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        <WelcomeStep onNext={() => setCurrentStep(1)} />,
        <OrganizationStep
            onNext={(data) => {
                setFormData({ ...formData, ...data });
                setCurrentStep(2);
            }}
            onBack={() => setCurrentStep(0)}
            initialData={formData}
        />,
        <GenesysStep
            onNext={(data) => {
                setFormData({ ...formData, genesysClientId: data.clientId, genesysClientSecret: data.clientSecret, genesysRegion: data.region });
                setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
            initialData={formData}
        />,
        <WhatsAppStep
            onNext={(data) => {
                setFormData({ ...formData, ...data });
                setCurrentStep(4);
            }}
            onBack={() => setCurrentStep(2)}
            initialData={formData}
        />,
        <ReviewStep
            data={formData}
            onBack={() => setCurrentStep(3)}
            onSubmit={handleComplete}
            loading={loading}
        />
    ];

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between mb-2">
                        {['Welcome', 'Organization', 'Genesys', 'WhatsApp', 'Review'].map((label, index) => (
                            <div
                                key={label}
                                className={`text-sm font-medium ${
                                    index === currentStep ? 'text-blue-600' : index < currentStep ? 'text-green-600' : 'text-gray-400'
                                }`}
                            >
                                {label}
                            </div>
                        ))}
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                        <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${(currentStep / 4) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Current step */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {steps[currentStep]}
                </div>
            </div>
        </div>
    );
}
```

---

## ✅ Verification Steps

### 1. Start Agent Portal

```bash
cd services/agent-portal
npm install
npm run dev
```

### 2. Navigate to Onboarding

Open browser: `http://localhost:3014/onboarding`

### 3. Complete Wizard

- Step 1: Click "Get Started"
- Step 2: Fill organization details
- Step 3: Enter Genesys credentials
- Step 4: Enter WhatsApp credentials
- Step 5: Review and submit

### 4. Verify Backend Calls

Check browser DevTools Network tab. Should see:
```
POST /api/tenants
PUT /api/tenants/{id}/credentials (genesys)
PUT /api/tenants/{id}/credentials (whatsapp)
POST /api/tenants/{id}/complete-onboarding
```

### 5. Verify Database

```bash
psql -d waba_mvp -c "SELECT * FROM tenants;"
psql -d waba_mvp -c "SELECT tenant_id, credential_type FROM tenant_credentials;"
```

---

## 📤 Deliverables

- [x] 5-step onboarding wizard
- [x] Form validation for all inputs
- [x] Progress indicator
- [x] Integration with Tenant Service API
- [x] Credentials stored securely
- [x] Success navigation to dashboard

---

## 🎯 Note

This is **optional for backend-focused MVP**. You can:
1. **Skip this** and use database seeds for demo tenant
2. **Implement later** after backend is working
3. **Use Postman/curl** to manually create tenants for testing

For backend MVP, focus on Tasks 00-10 first! 🚀
