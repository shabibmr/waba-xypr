# WhatsApp UI Preview Enhancement Plan

## Overview

Upgrade the template message preview in `TemplatePreview.jsx` to accurately mirror the actual WhatsApp mobile app UI for better user visualization during template creation.

## Current Implementation Analysis

**File:** `services/agent-portal/src/components/TemplateBuilder/TemplatePreview.jsx`

**Current Features:**
- Basic green message bubble (#005c4b)
- Simple phone header mockup
- WhatsApp pattern background
- Component rendering (header, body, footer, buttons)
- Text formatting (bold, italic, strikethrough, code)
- Timestamp display

**Current Limitations:**
- Generic phone UI (not WhatsApp-specific)
- Missing authentic WhatsApp branding elements
- No status bar (iOS/Android)
- Simplified chat header
- Message bubbles don't match actual WhatsApp styling
- Missing read receipts (double checkmarks)
- No typing indicator or online status
- Buttons don't match WhatsApp CTA button style

---

## Design Goals

### 1. **Authentic WhatsApp Mobile UI**
- Recreate iOS WhatsApp interface (primary)
- Match exact color scheme, fonts, and spacing
- Accurate message bubble shape and shadow
- Proper WhatsApp branding

### 2. **Realistic Chat Context**
- Show full WhatsApp screen (status bar, chat header, input bar)
- Display business profile picture and name
- Include WhatsApp UI chrome (back button, call icons, menu)

### 3. **Enhanced Message Rendering**
- Accurate message bubble tail (triangle pointer)
- Proper read receipts (✓✓)
- Timestamp positioning
- Media preview improvements

### 4. **Better UX**
- Toggle between iOS / Android styles (optional)
- Dark mode / Light mode support
- Interactive preview (scroll, tap buttons)

---

## Implementation Plan

### Phase 1: WhatsApp Screen Container

**1.1 Create iPhone Mockup Frame**

Create a realistic iPhone frame around the WhatsApp UI:

```jsx
<div className="whatsapp-phone-mockup">
  {/* iPhone frame border */}
  <div className="phone-bezel">
    {/* iOS status bar */}
    <div className="status-bar">
      <span className="time">9:41</span>
      <div className="notch"></div>
      <div className="status-icons">
        <SignalIcon />
        <WifiIcon />
        <BatteryIcon />
      </div>
    </div>

    {/* WhatsApp Chat Header */}
    <div className="wa-chat-header">
      <BackButton />
      <ProfilePicture />
      <BusinessName />
      <CallIcons />
      <MenuIcon />
    </div>

    {/* Chat Area */}
    <div className="wa-chat-area">
      {/* Messages */}
    </div>

    {/* WhatsApp Input Bar */}
    <div className="wa-input-bar">
      <PlusIcon />
      <InputField placeholder="Message" disabled />
      <EmojiIcon />
      <AttachIcon />
    </div>
  </div>
</div>
```

**Design Specs:**
- **Phone dimensions:** 375px × 667px (iPhone 8 size) or 390px × 844px (iPhone 13)
- **Border radius:** 40px with black bezel
- **Status bar height:** 44px
- **Chat header height:** 60px
- **Input bar height:** 50px

---

### Phase 2: Authentic WhatsApp Colors & Typography

**2.1 Update Color Palette**

Replace generic colors with actual WhatsApp brand colors:

```css
/* WhatsApp Official Colors */
--wa-green-primary: #25D366;      /* WhatsApp brand green */
--wa-green-dark: #075E54;         /* Dark header green */
--wa-green-light: #128C7E;        /* Light green accent */
--wa-teal: #34B7F1;              /* Light mode chat bg */
--wa-bg-dark: #0B141A;           /* Dark mode chat bg */
--wa-bg-pattern: #111B21;        /* Dark mode pattern overlay */

/* Message Bubbles */
--wa-bubble-sent: #005C4B;       /* Outgoing (green) */
--wa-bubble-received: #202C33;   /* Incoming (dark gray) */
--wa-bubble-sent-light: #DCF8C6; /* Outgoing light mode */
--wa-bubble-received-light: #FFFFFF; /* Incoming light mode */

/* UI Elements */
--wa-text-primary: #E9EDEF;      /* Primary text (dark mode) */
--wa-text-secondary: #8696A0;    /* Secondary text */
--wa-text-tertiary: #667781;     /* Tertiary text */
--wa-divider: #2A3942;          /* Divider lines */
```

**2.2 Typography**

WhatsApp uses San Francisco (iOS) and Roboto (Android):

```css
.whatsapp-preview {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
               'Helvetica Neue', Arial, sans-serif;
  font-size: 15px; /* Base message font size */
  line-height: 1.4;
}

.wa-message-body {
  font-size: 14.5px;
  font-weight: 400;
}

.wa-timestamp {
  font-size: 11px;
  font-weight: 400;
}

.wa-chat-header-name {
  font-size: 16px;
  font-weight: 600;
}
```

---

### Phase 3: Realistic Message Bubbles

**3.1 Message Bubble Shape**

Add the signature WhatsApp message tail (triangle pointer):

```jsx
<div className="wa-message-container">
  <div className="wa-message-bubble sent">
    {/* Message content */}
    <div className="bubble-content">
      {body}
    </div>

    {/* Message tail */}
    <div className="bubble-tail"></div>

    {/* Timestamp + Read Receipts */}
    <div className="message-meta">
      <span className="timestamp">9:41 AM</span>
      <CheckDoubleIcon className="read-receipt" />
    </div>
  </div>
</div>
```

**CSS for Tail:**
```css
.wa-message-bubble.sent {
  position: relative;
  background: #005C4B;
  border-radius: 7.5px 7.5px 0 7.5px;
  padding: 6px 7px 8px 9px;
  box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
}

.wa-message-bubble.sent::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -8px;
  width: 0;
  height: 0;
  border-left: 8px solid #005C4B;
  border-bottom: 13px solid transparent;
}

.wa-message-bubble.received {
  background: #202C33;
  border-radius: 7.5px 7.5px 7.5px 0;
}

.wa-message-bubble.received::after {
  left: -8px;
  border-right: 8px solid #202C33;
  border-left: none;
}
```

**3.2 Read Receipts (Checkmarks)**

Add proper WhatsApp read receipts:

```jsx
// checkmark-double.svg (inline SVG)
<svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-400">
  <path fill="currentColor"
    d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
</svg>

// Status states:
// - Gray checkmark: Sent
// - Double gray: Delivered
// - Double blue: Read
```

---

### Phase 4: Enhanced Chat Header

**4.1 WhatsApp Chat Header Component**

```jsx
<div className="wa-chat-header">
  {/* Back button */}
  <button className="back-btn">
    <ChevronLeft className="w-6 h-6" />
  </button>

  {/* Business Profile */}
  <div className="business-profile">
    <div className="profile-pic">
      <div className="avatar">
        <Building className="w-5 h-5 text-gray-400" />
      </div>
    </div>
    <div className="profile-info">
      <div className="business-name">Your Business</div>
      <div className="business-status">
        <span className="verified-badge">
          <CheckCircle className="w-3 h-3 text-blue-400" />
        </span>
        <span className="status-text">Business Account</span>
      </div>
    </div>
  </div>

  {/* Action buttons */}
  <div className="header-actions">
    <button className="action-btn">
      <Video className="w-5 h-5" />
    </button>
    <button className="action-btn">
      <Phone className="w-5 h-5" />
    </button>
    <button className="action-btn">
      <MoreVertical className="w-5 h-5" />
    </button>
  </div>
</div>
```

**Styling:**
```css
.wa-chat-header {
  background: #202C33;
  height: 60px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #2A3942;
}

.business-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2A3942;
  display: flex;
  align-items: center;
  justify-content: center;
}

.verified-badge {
  display: inline-flex;
  margin-right: 4px;
}
```

---

### Phase 5: Improved Component Rendering

**5.1 Media Header Preview**

Replace generic placeholders with realistic media previews:

```jsx
{/* IMAGE Header */}
{header.format === 'IMAGE' && (
  <div className="wa-media-container image">
    {sampleValues.headerHandle ? (
      <img src={getMediaUrl(sampleValues.headerHandle)}
           alt="Header"
           className="wa-media-image" />
    ) : (
      <div className="wa-media-placeholder">
        <Image className="w-10 h-10 text-gray-500" />
        <span className="text-xs text-gray-500 mt-2">Image</span>
      </div>
    )}
  </div>
)}

{/* VIDEO Header */}
{header.format === 'VIDEO' && (
  <div className="wa-media-container video">
    <div className="video-overlay">
      <div className="play-button">
        <Play className="w-8 h-8 text-white" fill="white" />
      </div>
      <div className="video-duration">0:15</div>
    </div>
  </div>
)}

{/* DOCUMENT Header */}
{header.format === 'DOCUMENT' && (
  <div className="wa-document-preview">
    <div className="doc-icon">
      <FileText className="w-8 h-8 text-blue-400" />
    </div>
    <div className="doc-info">
      <div className="doc-name">Document.pdf</div>
      <div className="doc-size">1 page · PDF</div>
    </div>
    <button className="doc-download">
      <Download className="w-5 h-5" />
    </button>
  </div>
)}
```

**Styling:**
```css
.wa-media-container {
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  margin: -6px -7px 6px -9px; /* Bleed to bubble edges */
  background: #1a2730;
  min-height: 200px;
}

.wa-media-image {
  width: 100%;
  height: auto;
  display: block;
}

.video-overlay {
  position: relative;
}

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 56px;
  height: 56px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wa-document-preview {
  background: #1a2730;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
```

**5.2 CTA Buttons (Call-to-Action)**

WhatsApp buttons have a specific style:

```jsx
{buttons && buttons.buttons && buttons.buttons.length > 0 && (
  <div className="wa-cta-buttons">
    {buttons.buttons.map((btn, i) => (
      <button key={i} className={`wa-cta-button ${btn.type.toLowerCase()}`}>
        <div className="cta-icon">
          {btn.type === 'URL' && <ExternalLink className="w-4 h-4" />}
          {btn.type === 'PHONE_NUMBER' && <Phone className="w-4 h-4" />}
          {btn.type === 'COPY_CODE' && <Copy className="w-4 h-4" />}
        </div>
        <span className="cta-text">{btn.text || btn.type}</span>
      </button>
    ))}
  </div>
)}
```

**Button Styling:**
```css
.wa-cta-buttons {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wa-cta-button {
  background: transparent;
  border: none;
  color: #53BDEB;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.wa-cta-button:hover {
  background: rgba(255, 255, 255, 0.05);
}

.wa-cta-button:first-child {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 8px;
}

/* Quick Reply buttons */
.wa-cta-button.quick_reply {
  background: #1f3a47;
  border: 1px solid #2a3942;
  border-radius: 20px;
  padding: 8px 16px;
  margin: 4px 0;
}
```

---

### Phase 6: Additional UI Polish

**6.1 iOS Status Bar**

```jsx
<div className="ios-status-bar">
  <div className="status-left">
    <span className="time">9:41</span>
  </div>
  <div className="status-center">
    {/* Dynamic Island / Notch */}
    <div className="notch"></div>
  </div>
  <div className="status-right">
    <Signal className="w-4 h-4" />
    <Wifi className="w-4 h-4" />
    <Battery className="w-6 h-3" />
  </div>
</div>
```

**6.2 WhatsApp Background Pattern**

Use the authentic WhatsApp chat wallpaper:

```css
.wa-chat-area {
  background: #0B141A;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(42, 57, 66, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(42, 57, 66, 0.3) 0%, transparent 50%);
  background-size: 100% 100%;
  position: relative;
}

/* Authentic WhatsApp pattern overlay */
.wa-chat-area::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('data:image/svg+xml;base64,...'); /* WhatsApp pattern */
  opacity: 0.06;
  pointer-events: none;
}
```

**6.3 Input Bar**

```jsx
<div className="wa-input-bar">
  <button className="input-action">
    <Plus className="w-5 h-5 text-gray-400" />
  </button>
  <div className="input-field">
    <input type="text" placeholder="Message" disabled />
    <button className="emoji-btn">
      <Smile className="w-5 h-5 text-gray-400" />
    </button>
  </div>
  <button className="input-action">
    <Mic className="w-5 h-5 text-gray-400" />
  </button>
</div>
```

---

## File Structure

### New/Modified Files

```
services/agent-portal/src/components/TemplateBuilder/
├── TemplatePreview.jsx (MODIFY - main preview component)
├── WhatsAppPhone.jsx (NEW - phone mockup container)
├── WhatsAppChatHeader.jsx (NEW - chat header component)
├── WhatsAppMessageBubble.jsx (NEW - message bubble component)
├── WhatsAppMediaPreview.jsx (NEW - media components)
├── WhatsAppCTAButtons.jsx (NEW - CTA button components)
└── whatsapp-preview.css (NEW - WhatsApp-specific styles)
```

---

## Implementation Steps

### Step 1: Extract Components (Refactoring)
1. Create `WhatsAppPhone.jsx` - Phone frame container
2. Create `WhatsAppChatHeader.jsx` - Chat header UI
3. Create `WhatsAppMessageBubble.jsx` - Message bubble with tail
4. Create `WhatsAppCTAButtons.jsx` - CTA button rendering

### Step 2: Update Styles
5. Create `whatsapp-preview.css` with authentic colors
6. Add message bubble tail CSS
7. Add media preview styles
8. Add CTA button styles

### Step 3: Enhance TemplatePreview.jsx
9. Import new components
10. Wrap preview in `<WhatsAppPhone>` container
11. Replace message bubble rendering with `<WhatsAppMessageBubble>`
12. Replace button rendering with `<WhatsAppCTAButtons>`
13. Add read receipts and proper timestamps

### Step 4: Media Enhancements
14. Update image/video/document previews
15. Add play button overlay for videos
16. Add download icon for documents
17. Handle sample media URLs

### Step 5: Polish & Testing
18. Add iOS status bar
19. Add input bar UI
20. Test all template types (MARKETING, UTILITY, AUTHENTICATION)
21. Test all component combinations
22. Responsive adjustments

---

## Design Reference

### WhatsApp UI Screenshots
- iOS WhatsApp Dark Mode (primary reference)
- Message bubble dimensions: max-width 260px, padding 6-9px
- Border radius: 7.5px
- Shadow: `0 1px 0.5px rgba(0,0,0,0.13)`
- Font: San Francisco Display (iOS system font)

### Component Dimensions
- Phone mockup: 375px × 812px (iPhone X size)
- Status bar: 44px height
- Chat header: 60px height
- Message bubble: max-width 260px
- Input bar: 50px height
- Profile picture: 40px diameter

---

## Expected Outcome

### Before (Current):
- Generic green bubble on patterned background
- Basic phone header
- Simple component rendering

### After (Enhanced):
- Full iPhone mockup with WhatsApp branding
- Authentic chat header with business profile
- Message bubbles with tail and read receipts
- Realistic media previews
- Proper CTA buttons matching WhatsApp style
- iOS status bar and input bar
- Professional, pixel-perfect WhatsApp UI

---

## Benefits

✅ **Better User Experience** - Users see exactly how templates will appear
✅ **Reduced Errors** - Clear preview reduces template submission mistakes
✅ **Professional** - Matches actual WhatsApp UI increases trust
✅ **Educational** - Helps users understand WhatsApp template structure
✅ **Marketing** - Impressive preview can be used in product demos

---

## Future Enhancements (Out of Scope)

1. Android WhatsApp style toggle
2. Light mode / Dark mode switcher
3. Animated preview (typing indicator, message send animation)
4. Interactive buttons (click to preview action)
5. Multi-message thread preview (show conversation flow)
6. Carousel card swiping animation
7. Template A/B comparison view

---

## Testing Checklist

- [ ] All header types render correctly (TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION)
- [ ] Body text formatting works (bold, italic, strikethrough, code)
- [ ] Variables are replaced with sample values
- [ ] Footer displays correctly
- [ ] CTA buttons render with proper icons and text
- [ ] Quick Reply buttons styled differently from URL buttons
- [ ] OTP/Authentication templates show COPY_CODE button correctly
- [ ] Carousel preview works with navigation
- [ ] Read receipts display correctly
- [ ] Timestamp shows correctly
- [ ] Message bubble tail appears on correct side
- [ ] Media placeholders vs actual media display
- [ ] Responsive on smaller screens
- [ ] No console errors or warnings

---

## Dependencies

**No new npm packages required.**

Existing dependencies:
- React 18
- Lucide React (icons)
- Tailwind CSS (optional: can use plain CSS)

**Assets Needed:**
- WhatsApp logo SVG
- WhatsApp pattern background (inline SVG data URI)
- Read receipt checkmark SVG
- Signal/Wifi/Battery icons for status bar

---

## Timeline Estimate

- **Phase 1-2:** Phone container + Colors (2 hours)
- **Phase 3:** Message bubbles with tail (2 hours)
- **Phase 4:** Chat header (1.5 hours)
- **Phase 5:** Media & buttons (2 hours)
- **Phase 6:** Polish & status bar (1 hour)
- **Testing:** (1.5 hours)

**Total:** ~10 hours

---

## Success Criteria

✅ Preview looks indistinguishable from real WhatsApp screenshot
✅ All template types render accurately
✅ No visual regressions in template builder
✅ Clean, maintainable component architecture
✅ Positive user feedback on realism

---

## Notes

- Focus on iOS WhatsApp UI (most recognizable)
- Dark mode only (matches current agent portal theme)
- Business messaging context (not personal chat)
- Prioritize accuracy over interactivity
- Keep performance in mind (avoid heavy animations)
