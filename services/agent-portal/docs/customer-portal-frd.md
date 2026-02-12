# Agent Portal Frontend - LLM-Optimized Technical Specification

**Version:** 1.0 (MVP+)  
**Service:** agent-portal (React Frontend)  
**Last Updated:** 2026-02-12  
**Purpose:** Complete technical specification for LLM-assisted code generation and debugging

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Technical Stack & Dependencies](#2-technical-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Data Models & Type Definitions](#4-data-models--type-definitions)
5. [Authentication System](#5-authentication-system)
6. [Feature Specifications](#6-feature-specifications)
7. [API Integration Layer](#7-api-integration-layer)
8. [State Management Strategy](#8-state-management-strategy)
9. [UI Component Library](#9-ui-component-library)
10. [Error Handling & Validation](#10-error-handling--validation)
11. [Security Implementation](#11-security-implementation)
12. [Performance Optimization](#12-performance-optimization)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & Configuration](#14-deployment--configuration)

---

## 1. SYSTEM OVERVIEW

### 1.1 Application Purpose

The Agent Portal is a **multi-tenant administrative web application** that serves as the control plane for managing integrations between:
- **Genesys Cloud** (Contact Center Platform)
- **WhatsApp Business Platform** (Messaging Channel)
- **XYPR Middleware** (Integration Layer)

### 1.2 Core User Workflows

```
WORKFLOW 1: Initial Setup
User → Login (Genesys SSO) → Onboarding Wizard → Integration Validation → Active Dashboard

WORKFLOW 2: Daily Operations
User → Login → Dashboard → View Conversations → Monitor Health → Review Logs

WORKFLOW 3: Maintenance
User → Settings → Update Credentials → Rotate Secrets → Audit Verification
```

### 1.3 Architecture Context

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Portal Frontend                     │
│                    (React Application)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              agent-portal-service (Backend)                  │
│              Base URL: http://localhost:3000                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│  Genesys     │      │  WhatsApp    │
│  Cloud       │      │  Business    │
└──────────────┘      └──────────────┘
```

---

## 2. TECHNICAL STACK & DEPENDENCIES

### 2.1 Core Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.17.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "lucide-react": "^0.303.0",
    "recharts": "^2.10.3",
    "axios": "^1.6.5",
    "date-fns": "^3.0.6",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.11",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "typescript": "^5.3.3",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

### 2.2 Build Tool Configuration

**Vite Configuration (vite.config.ts)**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
          'forms': ['react-hook-form', 'zod'],
          'charts': ['recharts'],
        },
      },
    },
  },
})
```

**Tailwind Configuration (tailwind.config.js)**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      spacing: {
        // 4px grid system
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
    },
  },
  plugins: [],
}
```

---

## 3. PROJECT STRUCTURE

### 3.1 Directory Tree

```
agent-portal/
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── api/                    # API client layer
│   │   ├── client.ts          # Axios instance configuration
│   │   ├── auth.ts            # Authentication endpoints
│   │   ├── onboarding.ts      # Onboarding endpoints
│   │   ├── analytics.ts       # Analytics endpoints
│   │   ├── conversations.ts   # Conversation endpoints
│   │   └── settings.ts        # Settings endpoints
│   ├── components/            # React components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── CallbackHandler.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── onboarding/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── Step1Organization.tsx
│   │   │   ├── Step2Genesys.tsx
│   │   │   ├── Step3WhatsApp.tsx
│   │   │   ├── Step4ConnectivityTest.tsx
│   │   │   └── Step5WebhookDeployment.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── MessageVolumeChart.tsx
│   │   │   ├── DeliverySuccessChart.tsx
│   │   │   └── TokenExpiryIndicator.tsx
│   │   ├── conversations/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationTable.tsx
│   │   │   ├── ConversationDetailDrawer.tsx
│   │   │   ├── ConversationFilters.tsx
│   │   │   └── WidgetEmbed.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── CredentialManager.tsx
│   │   │   ├── WebhookSecretRotation.tsx
│   │   │   └── RegionalSettings.tsx
│   │   ├── ui/                # Reusable UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   └── layout/
│   │       ├── AppLayout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   ├── contexts/              # React contexts
│   │   ├── AuthContext.tsx
│   │   └── UIContext.tsx
│   ├── hooks/                 # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useOnboarding.ts
│   │   ├── useAnalytics.ts
│   │   ├── useConversations.ts
│   │   └── useToast.ts
│   ├── lib/                   # Utilities
│   │   ├── utils.ts           # General utilities
│   │   ├── validators.ts      # Zod schemas
│   │   ├── constants.ts       # App constants
│   │   └── queryClient.ts     # React Query config
│   ├── types/                 # TypeScript definitions
│   │   ├── auth.ts
│   │   ├── onboarding.ts
│   │   ├── analytics.ts
│   │   ├── conversation.ts
│   │   └── api.ts
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── .env.example
├── .env.development
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 3.2 File Naming Conventions

- **Components:** PascalCase (e.g., `UserProfile.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Utilities:** camelCase (e.g., `formatDate.ts`)
- **Types:** PascalCase for interfaces/types (e.g., `User`, `ApiResponse`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

---

## 4. DATA MODELS & TYPE DEFINITIONS

### 4.1 Authentication Types (src/types/auth.ts)

```typescript
// User and Session Types
export interface User {
  id: string
  email: string
  name: string
  tenantId: string
  role: 'admin' | 'viewer'
  avatarUrl?: string
  createdAt: string
}

export interface AuthSession {
  user: User
  accessToken: string // Internal session JWT, NOT Genesys token
  expiresAt: number // Unix timestamp
  tenantId: string
}

export interface GenesysOAuthConfig {
  clientId: string
  region: GenesysRegion
  redirectUri: string
  scope: string[]
}

export type GenesysRegion = 
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-west-1'
  | 'ap-southeast-2'
  | 'ca-central-1'

export interface GenesysAuthResponse {
  code: string
  state: string
}

// API Request/Response Types
export interface LoginInitiateResponse {
  authUrl: string
  state: string
}

export interface CallbackRequest {
  code: string
  state: string
}

export interface CallbackResponse {
  session: AuthSession
}
```

### 4.2 Onboarding Types (src/types/onboarding.ts)

```typescript
export interface OnboardingState {
  currentStep: number
  completedSteps: number[]
  formData: OnboardingFormData
  validationResults?: ValidationResults
}

export interface OnboardingFormData {
  organization: OrganizationProfile
  genesys: GenesysConfig
  whatsapp: WhatsAppConfig
}

export interface OrganizationProfile {
  companyName: string
  contactEmail: string
  supportPhone: string
  region: 'north-america' | 'europe' | 'asia-pacific' | 'latin-america'
}

export interface GenesysConfig {
  clientId: string
  clientSecret: string
  region: GenesysRegion
  environment: 'production' | 'test'
}

export interface WhatsAppConfig {
  wabaId: string // WhatsApp Business Account ID
  phoneNumberId: string
  systemUserToken: string
  appId?: string // Future-proofing
  tokenExpiresAt?: string // ISO 8601
}

export interface ValidationResults {
  genesys: ValidationResult
  whatsapp: ValidationResult
  webhook: ValidationResult
}

export interface ValidationResult {
  status: 'success' | 'error' | 'pending'
  message: string
  timestamp: string
  details?: Record<string, any>
}

export interface WebhookUrls {
  meta: string // /webhook/meta/{tenantId}
  genesys: string // /webhook/genesys/{tenantId}
  tenantId: string
}

// API Types
export interface SaveOnboardingRequest {
  step: number
  data: Partial<OnboardingFormData>
}

export interface ValidateIntegrationResponse {
  results: ValidationResults
  webhookUrls?: WebhookUrls
}
```

### 4.3 Analytics Types (src/types/analytics.ts)

```typescript
export interface DashboardMetrics {
  kpis: KPIMetrics
  charts: ChartData
  tokenStatus: TokenStatus
  lastUpdated: string
}

export interface KPIMetrics {
  totalMessages: TimeSeriesMetric
  activeConversations: number
  failedDeliveries: FailureMetric
  avgResponseTime?: number // Future metric
}

export interface TimeSeriesMetric {
  today: number
  last7Days: number
  last30Days: number
}

export interface FailureMetric {
  count: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface ChartData {
  messageVolume: MessageVolumeDataPoint[]
  deliverySuccess: DeliverySuccessDataPoint[]
}

export interface MessageVolumeDataPoint {
  timestamp: string // ISO 8601
  count: number
  direction: 'inbound' | 'outbound'
}

export interface DeliverySuccessDataPoint {
  date: string // YYYY-MM-DD
  success: number
  failed: number
}

export interface TokenStatus {
  whatsappToken: TokenInfo
  genesysToken: TokenInfo
}

export interface TokenInfo {
  expiresAt: string // ISO 8601
  daysRemaining: number
  status: 'healthy' | 'warning' | 'critical' // >30d, 7-30d, <7d
}
```

### 4.4 Conversation Types (src/types/conversation.ts)

```typescript
export interface Conversation {
  id: string
  waId: string // WhatsApp ID
  contactName: string
  conversationId: string // Genesys conversation ID
  lastActivity: string // ISO 8601
  status: ConversationStatus
  messageCount: number
  createdAt: string
  metadata?: Record<string, any>
}

export type ConversationStatus = 'active' | 'closed' | 'error'

export interface ConversationListParams {
  page: number
  pageSize: number
  search?: string
  status?: ConversationStatus
  sortBy?: 'lastActivity' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ConversationListResponse {
  conversations: Conversation[]
  pagination: PaginationInfo
}

export interface PaginationInfo {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ConversationDetail extends Conversation {
  auditTrail: AuditEntry[]
  deliveryLogs: DeliveryLog[]
  widgetUrl: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  event: string
  actor: string
  details: Record<string, any>
}

export interface DeliveryLog {
  id: string
  timestamp: string
  direction: 'inbound' | 'outbound'
  status: 'delivered' | 'failed' | 'pending'
  error?: string
  messageId: string
}
```

### 4.5 Settings Types (src/types/settings.ts)

```typescript
export interface TenantSettings {
  webhookSecret: string // Masked
  credentials: CredentialStatus
  regional: RegionalSettings
  features: FeatureFlags
}

export interface CredentialStatus {
  genesys: CredentialInfo
  whatsapp: CredentialInfo
}

export interface CredentialInfo {
  lastUpdated: string
  status: 'active' | 'expired' | 'expiring-soon'
  maskedValue: string
}

export interface RegionalSettings {
  dataResidency: string
  timezone: string
  locale: string
}

export interface FeatureFlags {
  darkMode: boolean // Future
  advancedAnalytics: boolean // Future
  multiUser: boolean // Future
}

export interface RotateSecretRequest {
  confirmationToken: string // Requires re-auth
}

export interface RotateSecretResponse {
  newSecret: string
  oldSecretValidUntil: string
  auditId: string
}

export interface UpdateCredentialRequest {
  credentialType: 'genesys-secret' | 'whatsapp-token'
  newValue: string
  confirmationToken: string
}
```

### 4.6 API Response Wrapper (src/types/api.ts)

```typescript
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: ApiError
  timestamp: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  statusCode: number
}

export interface ApiErrorResponse {
  success: false
  error: ApiError
  timestamp: string
}

// Type guards
export function isApiError(response: any): response is ApiErrorResponse {
  return response.success === false && 'error' in response
}
```

---

## 5. AUTHENTICATION SYSTEM

### 5.1 Genesys OAuth2 Flow (PKCE Required)

**Flow Diagram:**

```
┌─────────┐                ┌──────────┐                ┌─────────────┐
│ Browser │                │ Frontend │                │   Backend   │
└────┬────┘                └─────┬────┘                └──────┬──────┘
     │                           │                            │
     │  1. Click "Login"         │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 2. Generate PKCE           │
     │                           │    code_verifier           │
     │                           │    code_challenge          │
     │                           │                            │
     │                           │ 3. GET /auth/login/init    │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │ 4. authUrl + state         │
     │                           │<───────────────────────────┤
     │                           │                            │
     │  5. Redirect to Genesys   │                            │
     │<──────────────────────────┤                            │
     │  + code_challenge         │                            │
     │                           │                            │
     │  6. User authenticates    │                            │
     │     on Genesys            │                            │
     │                           │                            │
     │  7. Redirect to /callback │                            │
     │     ?code=XXX&state=YYY   │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 8. POST /auth/callback     │
     │                           │    code, state, verifier   │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │  9. Exchange code for token│
     │                           │     (with code_verifier)   │
     │                           │                            │
     │                           │ 10. Session JWT            │
     │                           │<───────────────────────────┤
     │                           │                            │
     │                           │ 11. Store in memory        │
     │                           │     Redirect to /dashboard │
     │                           │                            │
```

### 5.2 Auth Context Implementation (src/contexts/AuthContext.tsx)

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthSession } from '@/types/auth'
import * as authApi from '@/api/auth'

interface AuthContextValue {
  user: User | null
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    checkSession()
  }, [])

  // Auto-refresh session before expiry
  useEffect(() => {
    if (!session) return

    const timeUntilExpiry = session.expiresAt - Date.now()
    const refreshTime = timeUntilExpiry - 5 * 60 * 1000 // 5 minutes before expiry

    if (refreshTime <= 0) {
      refreshSession()
      return
    }

    const timer = setTimeout(() => {
      refreshSession()
    }, refreshTime)

    return () => clearTimeout(timer)
  }, [session])

  const checkSession = async () => {
    try {
      const currentSession = await authApi.getCurrentSession()
      setSession(currentSession)
    } catch (error) {
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async () => {
    const { authUrl, state, codeVerifier } = await authApi.initiateLogin()
    
    // Store code_verifier in sessionStorage (only for PKCE flow)
    sessionStorage.setItem('pkce_verifier', codeVerifier)
    sessionStorage.setItem('oauth_state', state)
    
    // Redirect to Genesys
    window.location.href = authUrl
  }

  const logout = async () => {
    await authApi.logout()
    setSession(null)
    sessionStorage.clear()
  }

  const refreshSession = async () => {
    try {
      const newSession = await authApi.refreshSession()
      setSession(newSession)
    } catch (error) {
      // If refresh fails, logout
      await logout()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        isLoading,
        isAuthenticated: !!session,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 5.3 Protected Route Component (src/components/auth/ProtectedRoute.tsx)

```typescript
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
```

### 5.4 API Client with Auth (src/api/client.ts)

```typescript
import axios, { AxiosError, AxiosInstance } from 'axios'
import { ApiError, ApiResponse } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Important for HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Add tenant ID
apiClient.interceptors.request.use(
  (config) => {
    const tenantId = sessionStorage.getItem('tenantId')
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Handle 401 - Unauthorized
    if (error.response?.status === 401) {
      // Clear session and redirect to login
      sessionStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      // Show access denied message
      window.location.href = '/access-denied'
      return Promise.reject(error)
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
        statusCode: 0,
      })
    }

    return Promise.reject(error.response.data.error)
  }
)

// Helper function for API calls with retry logic
export async function apiCall<T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  retries = 3
): Promise<T> {
  let lastError: any

  for (let i = 0; i < retries; i++) {
    try {
      const response = await apiFunction()
      return response.data
    } catch (error) {
      lastError = error
      
      // Don't retry on 4xx errors (except 429)
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error
      }

      // Exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
  }

  throw lastError
}
```

---

## 6. FEATURE SPECIFICATIONS

### 6.1 Onboarding Wizard

#### 6.1.1 Wizard State Management Hook (src/hooks/useOnboarding.ts)

```typescript
import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { OnboardingState, OnboardingFormData } from '@/types/onboarding'
import * as onboardingApi from '@/api/onboarding'

const TOTAL_STEPS = 5

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    completedSteps: [],
    formData: {
      organization: {} as any,
      genesys: {} as any,
      whatsapp: {} as any,
    },
  })

  // Load existing progress
  const { data: savedProgress } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: onboardingApi.getProgress,
  })

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: onboardingApi.saveProgress,
    onSuccess: () => {
      console.log('Progress saved')
    },
  })

  const updateFormData = useCallback((step: number, data: any) => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        ...data,
      },
    }))
    
    // Auto-save
    saveProgressMutation.mutate({ step, data })
  }, [])

  const nextStep = useCallback(() => {
    setState(prev => {
      const newCompletedSteps = [...prev.completedSteps, prev.currentStep]
      return {
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
        completedSteps: newCompletedSteps,
      }
    })
  }, [])

  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }))
  }, [])

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: step }))
    }
  }, [])

  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    formData: state.formData,
    totalSteps: TOTAL_STEPS,
    isFirstStep: state.currentStep === 1,
    isLastStep: state.currentStep === TOTAL_STEPS,
    updateFormData,
    nextStep,
    previousStep,
    goToStep,
  }
}
```

#### 6.1.2 Step 1: Organization Profile (src/components/onboarding/Step1Organization.tsx)

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { OrganizationProfile } from '@/types/onboarding'

const organizationSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactEmail: z.string().email('Invalid email format'),
  supportPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  region: z.enum(['north-america', 'europe', 'asia-pacific', 'latin-america']),
})

interface Step1Props {
  initialData?: Partial<OrganizationProfile>
  onNext: (data: OrganizationProfile) => void
}

export function Step1Organization({ initialData, onNext }: Step1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationProfile>({
    resolver: zodResolver(organizationSchema),
    defaultValues: initialData,
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <h2 className="text-2xl font-bold">Organization Profile</h2>
      
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium mb-2">
          Company Name *
        </label>
        <input
          id="companyName"
          {...register('companyName')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.companyName && (
          <p className="text-error text-sm mt-1">{errors.companyName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-2">
          Contact Email *
        </label>
        <input
          id="contactEmail"
          type="email"
          {...register('contactEmail')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.contactEmail && (
          <p className="text-error text-sm mt-1">{errors.contactEmail.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="supportPhone" className="block text-sm font-medium mb-2">
          Support Phone *
        </label>
        <input
          id="supportPhone"
          type="tel"
          {...register('supportPhone')}
          placeholder="+1234567890"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        {errors.supportPhone && (
          <p className="text-error text-sm mt-1">{errors.supportPhone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="region" className="block text-sm font-medium mb-2">
          Region *
        </label>
        <select
          id="region"
          {...register('region')}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Select region...</option>
          <option value="north-america">North America</option>
          <option value="europe">Europe</option>
          <option value="asia-pacific">Asia Pacific</option>
          <option value="latin-america">Latin America</option>
        </select>
        {errors.region && (
          <p className="text-error text-sm mt-1">{errors.region.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700"
      >
        Continue
      </button>
    </form>
  )
}
```

#### 6.1.3 Step 4: Connectivity Test (src/components/onboarding/Step4ConnectivityTest.tsx)

```typescript
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ValidationResults } from '@/types/onboarding'
import * as onboardingApi from '@/api/onboarding'
import { CheckCircle, XCircle, Loader, ChevronDown } from 'lucide-react'

export function Step4ConnectivityTest({ onNext }: { onNext: () => void }) {
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const validationMutation = useMutation({
    mutationFn: onboardingApi.validateIntegration,
  })

  const handleTest = () => {
    validationMutation.mutate()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-success" size={24} />
      case 'error':
        return <XCircle className="text-error" size={24} />
      case 'pending':
        return <Loader className="animate-spin text-gray-400" size={24} />
      default:
        return null
    }
  }

  const results = validationMutation.data?.results

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Connectivity Test</h2>
      <p className="text-gray-600">
        We'll verify your configuration by testing connections to both platforms.
      </p>

      {!validationMutation.isSuccess && (
        <button
          onClick={handleTest}
          disabled={validationMutation.isPending}
          className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {validationMutation.isPending ? 'Testing...' : 'Run Connectivity Test'}
        </button>
      )}

      {results && (
        <div className="space-y-4">
          {/* Genesys Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.genesys.status)}
                <div>
                  <h3 className="font-medium">Genesys Cloud Connection</h3>
                  <p className="text-sm text-gray-600">{results.genesys.message}</p>
                </div>
              </div>
              {results.genesys.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'genesys' ? null : 'genesys')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'genesys' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'genesys' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.genesys.details, null, 2)}
              </pre>
            )}
          </div>

          {/* WhatsApp Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.whatsapp.status)}
                <div>
                  <h3 className="font-medium">WhatsApp Business API</h3>
                  <p className="text-sm text-gray-600">{results.whatsapp.message}</p>
                </div>
              </div>
              {results.whatsapp.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'whatsapp' ? null : 'whatsapp')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'whatsapp' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'whatsapp' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.whatsapp.details, null, 2)}
              </pre>
            )}
          </div>

          {/* Webhook Test */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(results.webhook.status)}
                <div>
                  <h3 className="font-medium">Webhook Handshake</h3>
                  <p className="text-sm text-gray-600">{results.webhook.message}</p>
                </div>
              </div>
              {results.webhook.details && (
                <button
                  onClick={() => setShowDetails(showDetails === 'webhook' ? null : 'webhook')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`transform transition-transform ${
                      showDetails === 'webhook' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>
            {showDetails === 'webhook' && (
              <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(results.webhook.details, null, 2)}
              </pre>
            )}
          </div>

          {/* Retry or Continue */}
          {results.genesys.status === 'error' ||
          results.whatsapp.status === 'error' ||
          results.webhook.status === 'error' ? (
            <button
              onClick={handleTest}
              className="w-full bg-warning text-white py-3 rounded-lg hover:bg-warning/90"
            >
              Retry Test
            </button>
          ) : (
            <button
              onClick={onNext}
              className="w-full bg-success text-white py-3 rounded-lg hover:bg-success/90"
            >
              Continue to Webhook Setup
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

### 6.2 Dashboard & Analytics

#### 6.2.1 Dashboard Data Hook (src/hooks/useAnalytics.ts)

```typescript
import { useQuery } from '@tanstack/react-query'
import { DashboardMetrics } from '@/types/analytics'
import * as analyticsApi from '@/api/analytics'

export function useAnalytics() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: analyticsApi.getDashboardMetrics,
    refetchInterval: 30000, // Poll every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 25000, // Consider data fresh for 25 seconds
  })

  return {
    metrics: data,
    isLoading,
    error,
    refresh: refetch,
  }
}
```

#### 6.2.2 KPI Card Component (src/components/dashboard/KPICard.tsx)

```typescript
import { LucideIcon } from 'lucide-react'
import { TimeSeriesMetric } from '@/types/analytics'

interface KPICardProps {
  title: string
  icon: LucideIcon
  value: number | TimeSeriesMetric
  trend?: 'up' | 'down' | 'stable'
  format?: 'number' | 'percentage' | 'time'
  timeRange?: 'today' | '7days' | '30days'
}

export function KPICard({
  title,
  icon: Icon,
  value,
  trend,
  format = 'number',
  timeRange = 'today',
}: KPICardProps) {
  // Extract value based on timeRange if TimeSeriesMetric
  const displayValue = typeof value === 'object' ? value[timeRange] : value

  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`
      case 'time':
        return `${val.toFixed(1)}s`
      default:
        return val.toLocaleString()
    }
  }

  const trendColor = {
    up: 'text-success',
    down: 'text-error',
    stable: 'text-gray-500',
  }[trend || 'stable']

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
        <Icon className="text-primary-600" size={24} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold">{formatValue(displayValue)}</span>
        {trend && (
          <span className={`text-sm ${trendColor}`}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
          </span>
        )}
      </div>
      {typeof value === 'object' && (
        <div className="mt-3 text-xs text-gray-500">
          7d: {formatValue(value.last7Days)} | 30d: {formatValue(value.last30Days)}
        </div>
      )}
    </div>
  )
}
```

#### 6.2.3 Message Volume Chart (src/components/dashboard/MessageVolumeChart.tsx)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MessageVolumeDataPoint } from '@/types/analytics'
import { format, parseISO } from 'date-fns'

interface Props {
  data: MessageVolumeDataPoint[]
}

export function MessageVolumeChart({ data }: Props) {
  // Group by timestamp and aggregate
  const aggregatedData = data.reduce((acc, point) => {
    const key = format(parseISO(point.timestamp), 'MMM dd HH:mm')
    if (!acc[key]) {
      acc[key] = { timestamp: key, inbound: 0, outbound: 0 }
    }
    if (point.direction === 'inbound') {
      acc[key].inbound += point.count
    } else {
      acc[key].outbound += point.count
    }
    return acc
  }, {} as Record<string, any>)

  const chartData = Object.values(aggregatedData)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Message Volume</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="inbound" stroke="#10b981" name="Inbound" />
          <Line type="monotone" dataKey="outbound" stroke="#6366f1" name="Outbound" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 6.3 Conversation Management

#### 6.3.1 Conversation List Hook (src/hooks/useConversations.ts)

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConversationListParams, ConversationStatus } from '@/types/conversation'
import * as conversationApi from '@/api/conversations'

export function useConversations() {
  const [params, setParams] = useState<ConversationListParams>({
    page: 1,
    pageSize: 20,
    sortBy: 'lastActivity',
    sortOrder: 'desc',
  })

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations', params],
    queryFn: () => conversationApi.getConversations(params),
  })

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }))
  }

  const setStatusFilter = (status?: ConversationStatus) => {
    setParams(prev => ({ ...prev, status, page: 1 }))
  }

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }))
  }

  const exportCSV = async () => {
    const csv = await conversationApi.exportConversations(params)
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversations-${new Date().toISOString()}.csv`
    a.click()
  }

  return {
    conversations: data?.conversations || [],
    pagination: data?.pagination,
    isLoading,
    error,
    params,
    setSearch,
    setStatusFilter,
    setPage,
    refresh: refetch,
    exportCSV,
  }
}
```

#### 6.3.2 Conversation Detail Drawer (src/components/conversations/ConversationDetailDrawer.tsx)

```typescript
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import * as conversationApi from '@/api/conversations'
import { WidgetEmbed } from './WidgetEmbed'

interface Props {
  conversationId: string
  onClose: () => void
}

export function ConversationDetailDrawer({ conversationId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversation-detail', conversationId],
    queryFn: () => conversationApi.getConversationDetail(conversationId),
    enabled: !!conversationId,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!data) {
    return null
  }

  return (
    <div className="fixed inset-y-0 right-0 w-2/3 bg-white shadow-2xl z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold">{data.contactName}</h2>
          <p className="text-sm text-gray-600">wa_id: {data.waId}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Widget */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Conversation Widget (Read-Only)</h3>
          <WidgetEmbed
            conversationId={data.conversationId}
            tenantId={data.metadata?.tenantId || ''}
            mode="portal"
          />
        </div>

        {/* Audit Trail */}
        <div>
          <h3 className="font-semibold mb-3">Audit Trail</h3>
          <div className="space-y-2">
            {data.auditTrail.map(entry => (
              <div key={entry.id} className="border-l-2 border-gray-300 pl-4 py-2">
                <div className="text-sm font-medium">{entry.event}</div>
                <div className="text-xs text-gray-600">
                  {new Date(entry.timestamp).toLocaleString()} • {entry.actor}
                </div>
                {entry.details && (
                  <pre className="text-xs text-gray-500 mt-1">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Logs */}
        <div>
          <h3 className="font-semibold mb-3">Delivery Logs</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Direction</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Message ID</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveryLogs.map(log => (
                <tr key={log.id} className="border-b">
                  <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.direction}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        log.status === 'delivered'
                          ? 'bg-success/20 text-success'
                          : log.status === 'failed'
                          ? 'bg-error/20 text-error'
                          : 'bg-gray-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.messageId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

#### 6.3.3 Widget Embed Component (src/components/conversations/WidgetEmbed.tsx)

```typescript
interface WidgetEmbedProps {
  conversationId: string
  tenantId: string
  mode: 'portal' | 'standalone'
}

export function WidgetEmbed({ conversationId, tenantId, mode }: WidgetEmbedProps) {
  const widgetUrl = `${window.location.origin}/widget?convId=${conversationId}&tenantId=${tenantId}&mode=${mode}`

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden">
      <iframe
        src={widgetUrl}
        className="w-full h-full"
        title="Conversation Widget"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
```

---

## 7. API INTEGRATION LAYER

### 7.1 Authentication API (src/api/auth.ts)

```typescript
import { apiClient } from './client'
import { AuthSession, GenesysRegion } from '@/types/auth'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'

export async function initiateLogin() {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const response = await apiClient.post<{
    authUrl: string
    state: string
  }>('/api/auth/login/init', {
    codeChallenge,
    redirectUri: `${window.location.origin}/callback`,
  })

  return {
    ...response.data,
    codeVerifier, // Return to store in sessionStorage
  }
}

export async function handleCallback(code: string, state: string) {
  const codeVerifier = sessionStorage.getItem('pkce_verifier')
  const savedState = sessionStorage.getItem('oauth_state')

  if (!codeVerifier || state !== savedState) {
    throw new Error('Invalid OAuth state')
  }

  const response = await apiClient.post<{ session: AuthSession }>('/api/auth/callback', {
    code,
    state,
    codeVerifier,
  })

  // Store tenant ID
  sessionStorage.setItem('tenantId', response.data.session.tenantId)

  // Clear PKCE data
  sessionStorage.removeItem('pkce_verifier')
  sessionStorage.removeItem('oauth_state')

  return response.data.session
}

export async function getCurrentSession(): Promise<AuthSession> {
  const response = await apiClient.get<{ session: AuthSession }>('/api/auth/session')
  return response.data.session
}

export async function refreshSession(): Promise<AuthSession> {
  const response = await apiClient.post<{ session: AuthSession }>('/api/auth/refresh')
  return response.data.session
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout')
}
```

### 7.2 PKCE Utilities (src/lib/pkce.ts)

```typescript
// PKCE helper functions for OAuth2 flow

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64URLEncode(new Uint8Array(hash))
}

function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
```

### 7.3 Onboarding API (src/api/onboarding.ts)

```typescript
import { apiClient } from './client'
import {
  OnboardingFormData,
  SaveOnboardingRequest,
  ValidateIntegrationResponse,
  WebhookUrls,
} from '@/types/onboarding'

export async function getProgress() {
  const response = await apiClient.get<{ progress: OnboardingFormData }>('/api/onboarding/progress')
  return response.data.progress
}

export async function saveProgress(request: SaveOnboardingRequest) {
  await apiClient.post('/api/onboarding/save', request)
}

export async function validateIntegration(): Promise<ValidateIntegrationResponse> {
  const response = await apiClient.post<ValidateIntegrationResponse>(
    '/api/integration/validate'
  )
  return response.data
}

export async function completeOnboarding(): Promise<WebhookUrls> {
  const response = await apiClient.post<{ webhookUrls: WebhookUrls }>(
    '/api/onboarding/complete'
  )
  return response.data.webhookUrls
}
```

### 7.4 Analytics API (src/api/analytics.ts)

```typescript
import { apiClient } from './client'
import { DashboardMetrics } from '@/types/analytics'

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await apiClient.get<DashboardMetrics>('/api/analytics/dashboard')
  return response.data
}

export async function getMessageVolume(days: number = 7) {
  const response = await apiClient.get(`/api/analytics/messages?days=${days}`)
  return response.data
}

export async function getDeliveryStats(days: number = 7) {
  const response = await apiClient.get(`/api/analytics/delivery?days=${days}`)
  return response.data
}
```

### 7.5 Conversations API (src/api/conversations.ts)

```typescript
import { apiClient } from './client'
import {
  ConversationListParams,
  ConversationListResponse,
  ConversationDetail,
} from '@/types/conversation'

export async function getConversations(
  params: ConversationListParams
): Promise<ConversationListResponse> {
  const queryParams = new URLSearchParams()
  queryParams.append('page', params.page.toString())
  queryParams.append('pageSize', params.pageSize.toString())
  if (params.search) queryParams.append('search', params.search)
  if (params.status) queryParams.append('status', params.status)
  if (params.sortBy) queryParams.append('sortBy', params.sortBy)
  if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder)

  const response = await apiClient.get<ConversationListResponse>(
    `/api/conversations?${queryParams}`
  )
  return response.data
}

export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const response = await apiClient.get<ConversationDetail>(`/api/conversations/${id}`)
  return response.data
}

export async function exportConversations(params: ConversationListParams): Promise<string> {
  const queryParams = new URLSearchParams()
  if (params.search) queryParams.append('search', params.search)
  if (params.status) queryParams.append('status', params.status)

  const response = await apiClient.get(`/api/conversations/export?${queryParams}`, {
    responseType: 'text',
  })
  return response.data
}
```

---

## 8. STATE MANAGEMENT STRATEGY

### 8.1 React Query Configuration (src/lib/queryClient.ts)

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})
```

### 8.2 Query Key Factory Pattern (src/lib/queryKeys.ts)

```typescript
export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  onboarding: {
    progress: ['onboarding', 'progress'] as const,
  },
  analytics: {
    dashboard: ['analytics', 'dashboard'] as const,
    messageVolume: (days: number) => ['analytics', 'messages', days] as const,
    deliveryStats: (days: number) => ['analytics', 'delivery', days] as const,
  },
  conversations: {
    list: (params: any) => ['conversations', 'list', params] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
}
```

---

## 9. UI COMPONENT LIBRARY

### 9.1 Button Component (src/components/ui/Button.tsx)

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { Loader } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variants = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
      danger: 'bg-error text-white hover:bg-error/90 focus:ring-error',
      ghost: 'hover:bg-gray-100 text-gray-700 focus:ring-gray-500',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader className="animate-spin mr-2" size={16} />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### 9.2 Toast Notification System (src/hooks/useToast.ts)

```typescript
import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))
    
    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, toast.duration || 5000)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export function useToast() {
  const { addToast } = useToastStore()

  return {
    success: (message: string, duration?: number) =>
      addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      addToast({ type: 'error', message, duration }),
    warning: (message: string, duration?: number) =>
      addToast({ type: 'warning', message, duration }),
    info: (message: string, duration?: number) =>
      addToast({ type: 'info', message, duration }),
  }
}
```

---

## 10. ERROR HANDLING & VALIDATION

### 10.1 Form Validation Schemas (src/lib/validators.ts)

```typescript
import { z } from 'zod'

// Organization schema
export const organizationSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid email address'),
  supportPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  region: z.enum(['north-america', 'europe', 'asia-pacific', 'latin-america']),
})

// Genesys schema
export const genesysSchema = z.object({
  clientId: z.string().uuid('Invalid client ID format').or(z.string().min(10)),
  clientSecret: z.string().min(20, 'Client secret is required'),
  region: z.enum(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-2', 'ca-central-1']),
  environment: z.enum(['production', 'test']),
})

// WhatsApp schema
export const whatsAppSchema = z.object({
  wabaId: z.string().regex(/^\d+$/, 'WABA ID must be numeric').min(10),
  phoneNumberId: z.string().regex(/^\d+$/, 'Phone Number ID must be numeric').min(10),
  systemUserToken: z.string().min(100, 'Invalid token format'),
  appId: z.string().optional(),
})

// Credential update schema
export const credentialUpdateSchema = z.object({
  credentialType: z.enum(['genesys-secret', 'whatsapp-token']),
  newValue: z.string().min(20, 'Invalid credential format'),
  confirmationToken: z.string().min(1, 'Confirmation required'),
})
```

### 10.2 Global Error Boundary (src/components/ErrorBoundary.tsx)

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
    
    // Send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error, { extra: errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <AlertTriangle className="mx-auto text-error mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We're sorry for the inconvenience. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## 11. SECURITY IMPLEMENTATION

### 11.1 Content Security Policy

```typescript
// src/lib/security.ts

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: [
    "'self'",
    'http://localhost:3000',
    'https://api.genesys.com',
  ],
  frameSrc: ["'self'"], // For widget embedding
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
}
```

### 11.2 Input Sanitization

```typescript
// src/lib/sanitize.ts

import DOMPurify from 'dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .slice(0, 1000) // Limit length
}
```

### 11.3 Session Management

```typescript
// Key security requirements:
// 1. NO tokens in localStorage
// 2. Session stored in memory (AuthContext)
// 3. HTTP-only cookies for backend session
// 4. Auto-refresh before expiry
// 5. Force logout on expiry

// Implementation already covered in AuthContext section
```

---

## 12. PERFORMANCE OPTIMIZATION

### 12.1 Code Splitting Strategy

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Lazy load route components
const Dashboard = lazy(() => import('@/components/dashboard/Dashboard'))
const OnboardingWizard = lazy(() => import('@/components/onboarding/OnboardingWizard'))
const ConversationList = lazy(() => import('@/components/conversations/ConversationList'))
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'))

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="onboarding" element={<OnboardingWizard />} />
          <Route path="conversations" element={<ConversationList />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
```

### 12.2 React Query Optimization

```typescript
// Prefetching strategy
export function usePrefetch() {
  const queryClient = useQueryClient()

  const prefetchDashboard = () => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard-metrics'],
      queryFn: analyticsApi.getDashboardMetrics,
    })
  }

  return { prefetchDashboard }
}

// Usage in navigation
<Link 
  to="/dashboard" 
  onMouseEnter={prefetchDashboard}
>
  Dashboard
</Link>
```

---

## 13. TESTING STRATEGY

### 13.1 Unit Test Example (Button.test.tsx)

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByText('Click'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

---

## 14. DEPLOYMENT & CONFIGURATION

### 14.1 Environment Variables (.env.example)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_WIDGET_BASE_URL=http://localhost:5173

# Genesys Configuration
VITE_GENESYS_OAUTH_REDIRECT_URI=http://localhost:5173/callback

# Feature Flags
VITE_ENABLE_DARK_MODE=false
VITE_ENABLE_ANALYTICS=true

# Monitoring
VITE_SENTRY_DSN=
VITE_ENVIRONMENT=development
```

### 14.2 Build & Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy (example for Vercel)
vercel deploy --prod
```

---

## 15. ACCEPTANCE CRITERIA

### 15.1 Feature Checklist

- [ ] **Authentication**
  - [ ] Genesys SSO login works with PKCE
  - [ ] Session persists across page refresh
  - [ ] Auto-refresh prevents session expiry
  - [ ] Logout clears all session data
  - [ ] Expired sessions redirect to login

- [ ] **Onboarding**
  - [ ] All 5 steps validate correctly
  - [ ] Form data auto-saves
  - [ ] Connectivity test shows real-time results
  - [ ] Webhook URLs are copyable
  - [ ] Can resume incomplete onboarding

- [ ] **Dashboard**
  - [ ] KPI cards show accurate metrics
  - [ ] Charts update every 30 seconds
  - [ ] Token expiry warnings appear 7 days before
  - [ ] Failed deliveries show error details

- [ ] **Conversations**
  - [ ] Table loads with pagination
  - [ ] Search filters work correctly
  - [ ] Detail drawer shows widget
  - [ ] Audit trail is complete
  - [ ] CSV export includes all columns

- [ ] **Settings**
  - [ ] Secret rotation requires confirmation
  - [ ] Credentials update successfully
  - [ ] Audit logs record all changes

- [ ] **Security**
  - [ ] No tokens in localStorage
  - [ ] CSP headers prevent XSS
  - [ ] Input sanitization works
  - [ ] HTTPS enforced in production

---

**END OF SPECIFICATION**
