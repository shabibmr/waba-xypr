# WhatsApp UI Preview - Quick Start Guide

## 🚀 See It In Action

### 1. Start Services
```bash
./manage.sh start
```

### 2. Open Agent Portal
```
http://localhost:3014
```

### 3. Navigate to Template Builder
1. Login (use dev login if enabled)
2. Click **"Admin"** button in header (top-right)
3. Click **"Templates"** tab in sidebar
4. Click **"Create Template"** button

### 4. See the New WhatsApp UI Preview
Look at the right panel → You'll see an authentic iPhone with WhatsApp UI! 📱

---

## 🎨 What You'll See

### Full WhatsApp Interface

```
┌──────────────────────────────────┐
│ 🕐 9:41        📶  📡  🔋        │ ← iOS Status Bar
├──────────────────────────────────┤
│ ← 🏢 Your Business ✓      📞 ⋮  │ ← WhatsApp Header
│    Business Account              │   (with verified badge)
├──────────────────────────────────┤
│                                  │
│              [Image/Video]     │ ← Media Header (if added)
│              ┌──────────────┐   │
│              │ Hello!       │   │ ← Message Bubble
│              │              │   │   (with green color)
│              │ This is a    │   │
│              │ **bold**     │   │   (formatted text)
│              │ message.     │   │
│              │              │   │
│              │ Footer text  │   │ ← Footer (gray)
│              ├──────────────┤   │
│              │ 🔗 Visit Us  │   │ ← CTA Button
│              └──────────────┤   │
│              9:41 AM ✓✓      │◄──┘ Tail + Timestamp
│                                  │
├──────────────────────────────────┤
│ ➕  💬 Message  😊  🎤          │ ← Input Bar (disabled)
└──────────────────────────────────┘
```

---

## ✨ Key Features to Try

### 1. Add an Image Header
- Select "Header" → "Image"
- See a realistic WhatsApp media preview

### 2. Use Text Formatting
In the body, try:
- `*bold*` → **bold**
- `_italic_` → _italic_
- `~strikethrough~` → ~~strikethrough~~
- ``` `code` ``` → `code`

### 3. Add Buttons
- Add a URL button → See link icon (🔗)
- Add a phone button → See phone icon (📞)
- See WhatsApp's blue color (#53BDEB)

### 4. Add a Footer
- Type footer text
- See it appear in gray at bottom of bubble

### 5. Check Read Receipts
- Look at bottom-right of message
- See double blue checkmarks (✓✓ = read)

---

## 📱 Components Breakdown

### Status Bar (Top)
- **9:41** - Apple's signature time
- Signal, WiFi, Battery icons
- Dark background (#111b21)

### Chat Header
- **Back button** - Navigate back
- **Profile picture** - Business icon
- **Business name** - Your Business
- **Verified badge** - Blue checkmark ✓
- **Status** - "Business Account"
- **Actions** - Video call, Phone, Menu

### Message Bubble
- **Green background** - #005c4b (WhatsApp authentic)
- **Rounded corners** - 7.5px radius
- **Tail** - Triangular pointer (signature WhatsApp)
- **Shadow** - Subtle depth effect
- **Max width** - 260px (WhatsApp standard)

### Read Receipts
- ✓ = Sent (gray)
- ✓✓ = Delivered (gray)
- ✓✓ = Read (blue)

### CTA Buttons
- **Transparent background**
- **Blue text** (#53BDEB)
- **Icons** - ExternalLink, Phone, Copy
- **Border separator** - Top border
- **Hover effect** - Subtle highlight

### Input Bar (Bottom)
- **Plus button** - Attachments
- **Message field** - Disabled (visual only)
- **Emoji button** - 😊
- **Mic button** - Voice message

---

## 🎯 Test Different Template Types

### Marketing Template
```
Header: IMAGE
Body: "Check out our *summer sale*! 🌞"
Footer: "Limited time offer"
Button: URL - "Shop Now"
```

### Utility Template
```
Header: DOCUMENT
Body: "Your invoice is ready.\n\nAmount: {{1}}"
Sample: "$99.99"
Button: QUICK_REPLY - "View Details"
```

### Authentication Template
```
Body: "{{1}} is your verification code."
Sample: "123456"
Button: COPY_CODE - "Copy Code"
```

---

## 🔍 What Changed vs Old Preview

| Feature | Old | New |
|---------|-----|-----|
| Container | Generic box | iPhone mockup |
| Header | Simple green bar | WhatsApp chat header |
| Message | Basic bubble | Bubble with tail |
| Media | Icon placeholder | Realistic preview |
| Buttons | Simple divs | WhatsApp CTA style |
| Read receipts | None | ✓✓ checkmarks |
| Timestamp | Simple text | Proper formatting |
| Background | Plain pattern | WhatsApp authentic |
| Status bar | None | iOS status bar |
| Input bar | None | WhatsApp input UI |

---

## 💡 Pro Tips

1. **Variable Preview**: Use sample values to see how {{1}}, {{2}} render
2. **Long Text**: Type long messages to see text wrapping
3. **Multiple Buttons**: Add 2-3 buttons to see stacking
4. **Footer**: Keep under 60 characters for best appearance
5. **Formatting**: Use WhatsApp markdown for emphasis

---

## 🐛 Troubleshooting

### Preview Not Showing?
- Check browser console for errors
- Ensure CSS file is loaded
- Refresh page (Cmd/Ctrl + R)

### Styles Look Wrong?
- Clear browser cache
- Rebuild: `npm run build`
- Check for CSS conflicts

### Build Errors?
```bash
cd services/agent-portal
rm -rf node_modules dist
npm install
npm run build
```

---

## 📸 Screenshot Comparison

### Before:
Simple green bubble on patterned background

### After:
Full iPhone mockup with:
- ✅ iOS status bar
- ✅ WhatsApp header with verified business
- ✅ Message bubble with tail
- ✅ Read receipts
- ✅ CTA buttons
- ✅ Input bar

---

## 🎊 Next Steps

1. **Create Templates** - Use the new preview to build better templates
2. **Share Feedback** - Report any visual issues
3. **Explore Features** - Try all component types (media, buttons, carousel)

---

## 📚 Documentation

For detailed implementation info, see:
- `WHATSAPP_UI_PREVIEW_PLAN.md` - Original plan
- `WHATSAPP_UI_IMPLEMENTATION_SUMMARY.md` - Complete summary
- `services/agent-portal/src/components/TemplateBuilder/` - Source code

---

## ✅ Verification Checklist

After starting the app, verify:
- [ ] iPhone frame appears with black bezel
- [ ] Status bar shows 9:41, signal icons
- [ ] WhatsApp header shows business profile
- [ ] Message bubble has green background
- [ ] Message bubble has triangular tail
- [ ] Read receipts (✓✓) appear
- [ ] Timestamp shows correctly
- [ ] Buttons have blue color and icons
- [ ] Input bar appears at bottom
- [ ] No console errors

---

## 🎉 Enjoy!

You now have a pixel-perfect WhatsApp preview that shows exactly how templates will appear to customers! 📱💬

Happy template building! ✨
