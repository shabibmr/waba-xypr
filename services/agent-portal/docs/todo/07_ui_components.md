# Task File 07: UI Component Library

**Priority**: 🟡 MEDIUM
**Depends on**: `01_security_auth.md` (to understand what auth UI components look like)
**Blocks**: `04_dashboard_analytics.md`, `05_conversation_management.md`, `06_settings.md` (all need shared components)
**Estimated effort**: 1 week

---

## Context

The FRD specifies a component library built on Radix UI + Tailwind CSS with reusable, accessible components. Currently all components are inlined in page files with ad-hoc styling and no standardization. `@radix-ui/react-*` packages are NOT installed. React Hook Form + Zod are installed but inconsistently used.

**FRD Reference**: Section 9 — UI Component Library

**Relevant files**:
- `src/components/` — currently only: AgentWidget.jsx, AgentWidgetIframe.jsx, AuthCallback.jsx, ConversationComponents.jsx, ErrorBoundary.jsx, ProtectedRoute.jsx, Sidebar.jsx
- `package.json` — has: tailwindcss, lucide-react, zod, react-hook-form; missing: radix-ui

---

## Tasks

### UI-01 — Install Radix UI packages
**Status**: ❌ Missing
**FRD Reference**: Section 9 — "Radix UI primitives"

**Action**:
```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip \
  @radix-ui/react-progress @radix-ui/react-switch
```

**Files to change**: `package.json`

---

### UI-02 — Create `Button` component
**Status**: ❌ Missing (inline buttons everywhere)
**FRD Reference**: Section 9 — "Button component with variants"

**Action**: Create `src/components/ui/Button.jsx`:
```jsx
// Props: variant (primary|secondary|ghost|danger), size (sm|md|lg), loading, disabled, onClick
```
- `primary`: solid blue background
- `secondary`: outlined
- `ghost`: transparent
- `danger`: red
- `loading`: shows spinner, disables click

Replace ad-hoc `<button className="...">` in all pages.

**Files to create**: `src/components/ui/Button.jsx`

---

### UI-03 — Create `Input` component
**Status**: ❌ Missing
**FRD Reference**: Section 9 — "Input component with label, error, and helper text"

**Action**: Create `src/components/ui/Input.jsx`:
```jsx
// Props: label, name, type, placeholder, error (string), helperText, required
```
- Label renders above input
- Red border + error message below when `error` prop set
- Integrates with React Hook Form via `register` or `Controller`

**Files to create**: `src/components/ui/Input.jsx`

---

### UI-04 — Create `Select` component
**Status**: ❌ Missing

**Action**: Create `src/components/ui/Select.jsx`:
- Wraps Radix UI `@radix-ui/react-select`
- Props: `options: [{value, label}]`, `value`, `onChange`, `placeholder`, `error`
- Accessible keyboard navigation

**Files to create**: `src/components/ui/Select.jsx`

---

### UI-05 — Create `Modal` component
**Status**: ❌ Missing (inline divs used)
**FRD Reference**: Section 9 — "Modal/Dialog component"

**Action**: Create `src/components/ui/Modal.jsx`:
- Wraps `@radix-ui/react-dialog`
- Props: `open`, `onClose`, `title`, `children`, `footer`
- ESC key closes, backdrop click closes (optional)
- Focus trap inside modal

**Files to create**: `src/components/ui/Modal.jsx`

---

### UI-06 — Create `Drawer` component
**Status**: ❌ Missing (needed for conversation detail)
**FRD Reference**: Section 9 — "Drawer for conversation detail"

**Action**: Create `src/components/ui/Drawer.jsx`:
- Slides in from right edge (300ms transition)
- Props: `open`, `onClose`, `title`, `width` (default 600px), `children`
- Overlay backdrop
- Close button in header

**Files to create**: `src/components/ui/Drawer.jsx`

---

### UI-07 — Create `Badge` component
**Status**: ❌ Missing (inline spans used)

**Action**: Create `src/components/ui/Badge.jsx`:
- Props: `variant` (default|success|warning|error|info), `size`
- Variants map to colors: success=green, warning=yellow, error=red, info=blue

**Files to create**: `src/components/ui/Badge.jsx`

---

### UI-08 — Create `Card` component
**Status**: ❌ Missing (inline divs)

**Action**: Create `src/components/ui/Card.jsx`:
- Props: `title`, `subtitle`, `children`, `footer`, `actions`, `padding`
- Standard shadow + border radius + padding

**Files to create**: `src/components/ui/Card.jsx`

---

### UI-09 — Create `Tabs` component
**Status**: ❌ Missing (needed for conversation detail drawer)

**Action**: Create `src/components/ui/Tabs.jsx`:
- Wraps `@radix-ui/react-tabs`
- Props: `tabs: [{id, label}]`, `activeTab`, `onChange`, `children`

**Files to create**: `src/components/ui/Tabs.jsx`

---

### UI-10 — Create `LoadingSpinner` + skeleton components
**Status**: ❌ Missing

**Action**: Create `src/components/ui/Loading.jsx`:
- `<Spinner size="sm|md|lg" />` — spinning circle
- `<Skeleton width height />` — grey pulsing placeholder

**Files to create**: `src/components/ui/Loading.jsx`

---

### UI-11 — Create `EmptyState` component
**Status**: ❌ Missing

**Action**: Create `src/components/ui/EmptyState.jsx`:
- Props: `icon`, `title`, `description`, `action` (button)
- Used for empty conversation list, no results, etc.

**Files to create**: `src/components/ui/EmptyState.jsx`

---

### UI-12 — Improve `Toast` / notification system
**Status**: ⚠️ Custom implementation exists in `ToastContext.jsx`

**Action**:
- Keep existing ToastContext but improve styling:
  - Success (green), Error (red), Warning (yellow), Info (blue) variants
  - Auto-dismiss after 4 seconds
  - Manual dismiss button
  - Position: top-right, stacked

**Files to change**: `src/contexts/ToastContext.jsx`

---

### UI-13 — Create `PageHeader` layout component
**Status**: ❌ Missing

**Action**: Create `src/components/layout/PageHeader.jsx`:
- Props: `title`, `subtitle`, `actions` (render prop or children)
- Consistent spacing and font at top of each page

**Files to create**: `src/components/layout/PageHeader.jsx`

---

### UI-14 — Improve `Sidebar` component
**Status**: ⚠️ Partial (basic sidebar exists)
**FRD Reference**: Section 9 — "Sidebar with nav items, active state, collapse"

**Action** in `src/components/Sidebar.jsx`:
- Add active route highlighting (using `useLocation` from react-router)
- Add collapse/expand button (icon-only mode vs full labels)
- Add user info at bottom (avatar, name, role)
- Add notification badge on Conversations nav item for unread count

**Files to change**: `src/components/Sidebar.jsx`

---

### UI-15 — Create centralized `validators.ts` with Zod schemas
**Status**: ❌ Missing (ad-hoc Zod in each page)

**Action**: Create `src/lib/validators.ts`:
```typescript
export const orgProfileSchema = z.object({ ... })
export const genesysConfigSchema = z.object({ ... })
export const whatsappConfigSchema = z.object({ ... })
export const messageSchema = z.object({ content: z.string().min(1).max(4096) })
```

**Files to create**: `src/lib/validators.ts`

---

## Acceptance Criteria

- [ ] Button, Input, Select, Modal, Drawer, Badge, Card, Tabs components in `src/components/ui/`
- [ ] All existing pages use shared components (no more inline button divs)
- [ ] Loading skeletons shown during API calls in all pages
- [ ] Empty state component used when lists return 0 items
- [ ] Toast notifications have color variants and auto-dismiss
- [ ] Sidebar highlights active route and shows unread badge
- [ ] Radix UI installed and used for accessible Dialog/Select/Tabs
