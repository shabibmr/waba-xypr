# Task File 02: State Management (React Query)

**Priority**: 🔴 HIGH
**Depends on**: `01_security_auth.md` (auth context must be stable)
**Blocks**: `03_onboarding.md`, `04_dashboard_analytics.md`, `05_conversation_management.md`
**Estimated effort**: 1 week

---

## Context

The FRD specifies React Query (TanStack Query) as the data-fetching layer with a 5-minute stale time, 3-retry policy, and centralized query key factory. Currently, the codebase uses manual `useState` + raw `axios` calls inside `useEffect` in every component.

`@tanstack/react-query` is already in `package.json` but is **not used anywhere** in the source.

**Relevant files**:
- `src/main.jsx` — needs QueryClientProvider wrapping
- `src/pages/Dashboard.jsx` — manual fetch, should use React Query
- `src/pages/Workspace.jsx` — manual fetch, should use React Query
- `src/services/conversationService.js`, `messageService.js` — become query functions
- `src/contexts/AuthContext.jsx` — stays as is (not React Query)

---

## Tasks

### SM-01 — Configure React Query QueryClient
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "QueryClient with staleTime: 5min, retry: 3"

**Action**: Create `src/lib/queryClient.ts`:
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

Wrap `App` in `src/main.jsx`:
```jsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

**Files to create**: `src/lib/queryClient.ts`
**Files to change**: `src/main.jsx`

---

### SM-02 — Create query key factory
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "Centralized query key definitions"

**Action**: Create `src/lib/queryKeys.ts`:
```typescript
export const queryKeys = {
  auth: {
    session: () => ['auth', 'session'] as const,
    profile: () => ['auth', 'profile'] as const,
  },
  dashboard: {
    metrics: () => ['dashboard', 'metrics'] as const,
    messageVolume: (range: string) => ['dashboard', 'volume', range] as const,
    deliveryStats: (range: string) => ['dashboard', 'delivery', range] as const,
  },
  conversations: {
    list: (filters: Record<string, unknown>) => ['conversations', 'list', filters] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
    messages: (id: string) => ['conversations', 'messages', id] as const,
  },
  onboarding: {
    progress: () => ['onboarding', 'progress'] as const,
  },
  organization: {
    profile: () => ['organization', 'profile'] as const,
    users: () => ['organization', 'users'] as const,
    settings: () => ['organization', 'settings'] as const,
  },
};
```

**Files to create**: `src/lib/queryKeys.ts`

---

### SM-03 — Create `useConversations` hook
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "useConversations custom hook"

**Action**: Create `src/hooks/useConversations.ts`:
- `useConversationList(filters)` → `useQuery({ queryKey: queryKeys.conversations.list(filters), queryFn })`
- `useConversationDetail(id)` → `useQuery({ queryKey: queryKeys.conversations.detail(id) })`
- `useConversationMessages(id)` → `useQuery({ queryKey: queryKeys.conversations.messages(id), refetchInterval: 5000 })`
- `useSendMessage()` → `useMutation({ onSuccess: () => invalidateQueries(...) })`

Replace `useState` + `useEffect` + manual axios in `Workspace.jsx`.

**Files to create**: `src/hooks/useConversations.ts`
**Files to change**: `src/pages/Workspace.jsx`

---

### SM-04 — Create `useAnalytics` hook
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "useAnalytics custom hook"

**Action**: Create `src/hooks/useAnalytics.ts`:
- `useDashboardMetrics()` → `useQuery({ refetchInterval: 30000 })`
- `useMessageVolume(dateRange)` → `useQuery(...)`
- `useDeliveryStats(dateRange)` → `useQuery(...)`

Replace current stub in `Dashboard.jsx`.

**Files to create**: `src/hooks/useAnalytics.ts`
**Files to change**: `src/pages/Dashboard.jsx`

---

### SM-05 — Create `useOnboarding` hook
**Status**: ❌ Missing
**FRD Reference**: Section 8 — "useOnboarding custom hook"

**Action**: Create `src/hooks/useOnboarding.ts`:
- `useOnboardingProgress()` → fetches saved onboarding step from backend
- `useSaveOnboardingStep()` → mutation to save progress
- `useValidateIntegration()` → mutation to call `/api/onboarding/validate`
- `useCompleteOnboarding()` → mutation to finalize

**Files to create**: `src/hooks/useOnboarding.ts`
**Files to change**: `src/pages/Onboarding.jsx`

---

### SM-06 — Refactor Workspace.jsx to use hooks
**Status**: ⚠️ Partial
**FRD Reference**: Section 8 — "Remove manual useEffect fetch patterns"

**Action**:
- Replace `loadConversations()` with `useConversationList()`
- Replace `loadMessages()` with `useConversationMessages(conversationId)`
- Replace `handleSend()` with `useSendMessage().mutate()`
- Remove all `useState([])` + `useEffect` manual fetches
- Loading/error states from React Query's `isLoading`, `isError` flags

**Files to change**: `src/pages/Workspace.jsx`

---

### SM-07 — Refactor Dashboard.jsx to use hooks
**Status**: ❌ Missing (Dashboard has no real data loading)

**Action**:
- Replace stub stats with `useDashboardMetrics()`
- Add loading skeleton while fetching
- Add error state with retry button

**Files to change**: `src/pages/Dashboard.jsx`

---

## Acceptance Criteria

- [ ] `QueryClientProvider` wraps the app in `main.jsx`
- [ ] No `useState([])` + `useEffect(() => fetch...)` patterns remain in Workspace or Dashboard
- [ ] Conversations auto-refetch every 5 seconds in Workspace
- [ ] Dashboard metrics auto-refetch every 30 seconds
- [ ] Cache invalidated correctly after sending a message
- [ ] All query keys use the centralized factory
