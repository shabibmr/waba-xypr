# Dual View Testing Guide

## Quick Start

### 1. Start the Services
```bash
cd /Users/admin/code/WABA/v1/waba-xypr
./manage.sh start
```

### 2. Access the Agent Portal
Open browser to: http://localhost:3014

### 3. Login
Use the dev login or your OAuth credentials

## Testing the Dual View Feature

### Test 1: Initial Load
**Expected:** Workspace loads in Agent View (default)

1. Navigate to `/workspace`
2. Verify header shows "Agent Workspace"
3. Verify ViewSwitcher shows "Agent" button highlighted (blue background)
4. Verify sidebar shows only 2 tabs:
   - Conversations (Chats)
   - Dashboard

### Test 2: Switch to Admin View
**Action:** Click "Admin" button in header

**Expected:**
- "Admin" button highlighted (blue background)
- "Agent" button becomes gray
- Sidebar now shows 3 tabs:
  - Dashboard
  - Templates
  - Settings
- If you were on "Conversations" tab, auto-switches to "Dashboard"

### Test 3: Navigate in Admin View
**Action:** Click through Admin tabs

**Expected:**
- Dashboard renders correctly
- Templates page loads
- Settings page loads
- No console errors

### Test 4: Switch Back to Agent View
**Action:** Click "Agent" button in header

**Expected:**
- Returns to Agent View
- Sidebar shows Conversations + Dashboard tabs
- Last active Agent tab restored (if you were on Dashboard before, should return to Dashboard)

### Test 5: Persistence Test
**Action:**
1. Switch to Admin View
2. Navigate to Templates tab
3. Refresh page (F5 or Cmd+R)

**Expected:**
- Page reloads in Admin View (preference persisted)
- Templates tab still active (tab persistence)

### Test 6: Clear Storage Test
**Action:**
1. Open DevTools (F12)
2. Go to Application > Local Storage
3. Clear all storage
4. Refresh page

**Expected:**
- Defaults to Agent View
- Defaults to Conversations tab

## Visual Verification

### Header Layout
```
┌────────────────────────────────────────────────────────────────┐
│  📱 Agent Workspace                [Agent] [Admin]     👤      │
│     John Doe                                                    │
└────────────────────────────────────────────────────────────────┘
```

### Agent View Sidebar
```
┌─────┐
│ 💬  │ Conversations (active = blue background)
│ 📊 │ Dashboard
└─────┘
```

### Admin View Sidebar
```
┌─────┐
│ 📊 │ Dashboard
│ 📄 │ Templates (active = blue background)
│ ⚙️  │ Settings
└─────┘
```

## Browser Console Tests

### Check ViewContext
Open browser console and run:
```javascript
// Should show 'agent' or 'admin'
localStorage.getItem('preferredView')

// Should show the active tab for each view
localStorage.getItem('activeTab_agent')
localStorage.getItem('activeTab_admin')
```

## Expected LocalStorage Keys

After using the dual view feature, you should see:
```
preferredView: "agent" | "admin"
activeTab_agent: "conversations" | "dashboard"
activeTab_admin: "dashboard" | "templates" | "settings"
```

## Common Issues & Solutions

### Issue: ViewSwitcher not appearing
**Check:**
- Header component imported in Workspace.jsx
- ViewProvider wrapped in App.jsx
- No console errors

### Issue: Tabs not switching correctly
**Check:**
- Sidebar importing useView hook
- TABS_CONFIG defined correctly
- Browser console for errors

### Issue: Persistence not working
**Check:**
- localStorage not disabled in browser
- No browser extensions blocking localStorage
- Private/Incognito mode may clear storage on close

### Issue: Build errors
**Solution:**
```bash
cd services/agent-portal
rm -rf node_modules dist
npm install
npm run build
```

## Manual UI Testing Checklist

- [ ] ViewSwitcher appears in header
- [ ] Agent button highlights in blue when active
- [ ] Admin button highlights in blue when active
- [ ] Agent View shows Conversations + Dashboard tabs
- [ ] Admin View shows Dashboard + Templates + Settings tabs
- [ ] Clicking Conversations tab in Agent View works
- [ ] Clicking Dashboard tab in both views works
- [ ] Clicking Templates tab in Admin View works
- [ ] Clicking Settings tab in Admin View works
- [ ] Switching views auto-switches unavailable tabs
- [ ] View preference persists after refresh
- [ ] Tab preference persists after refresh
- [ ] No console errors during switching
- [ ] Profile button (user icon) still works
- [ ] Responsive on mobile (ViewSwitcher adapts)

## Browser Compatibility

Test in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (responsive check)

## Performance Check

- [ ] View switching is instant (no lag)
- [ ] No memory leaks (use DevTools Memory profiler)
- [ ] LocalStorage operations don't block UI

## Accessibility Check

- [ ] Keyboard navigation works (Tab key)
- [ ] ViewSwitcher buttons focusable
- [ ] Enter/Space key activates buttons
- [ ] Screen reader announces view changes

## Success Criteria

✅ All tests pass without errors
✅ Smooth transitions between views
✅ Persistence works correctly
✅ No breaking changes to existing features
✅ Build succeeds without warnings

## Reporting Issues

If you find bugs, note:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (if any)
5. LocalStorage state (check DevTools)
