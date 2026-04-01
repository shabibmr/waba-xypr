# Agent Portal Light Mode Theme Guide

## Overview

The Agent Portal has been updated to a modern, elegant light mode theme. This guide documents the design system and provides instructions for maintaining consistency.

## Color Palette

### Primary Colors (Green)
Used for main actions, active states, and primary UI elements.
- **50**: `#f0fdf4` - Lightest (backgrounds)
- **100**: `#dcfce7` - Very Light
- **200**: `#bbf7d0` - Light
- **300**: `#86efac` - Medium-Light
- **400**: `#4ade80` - Medium
- **500**: `#22c55e` - Primary Base
- **600**: `#16a34a` - Primary (default for buttons/active states)
- **700**: `#15803d` - Primary Dark
- **800**: `#166534` - Very Dark
- **900**: `#145231` - Darkest

### Accent Colors (Violet)
Used for secondary actions and highlight states.
- **50**: `#f5f3ff` - Lightest
- **100**: `#ede9fe` - Very Light
- **200**: `#ddd6fe` - Light
- **300**: `#c4b5fd` - Medium-Light
- **400**: `#a78bfa` - Medium
- **500**: `#8b5cf6` - Accent Base
- **600**: `#7c3aed` - Accent (for secondary buttons)
- **700**: `#6d28d9` - Accent Dark
- **800**: `#5b21b6` - Very Dark
- **900**: `#4c1d95` - Darkest

### Surface Colors (Gray/Neutral)
Used for backgrounds, borders, and text.
- **50**: `#f9fafb` - Lightest background
- **100**: `#f3f4f6` - Light background
- **200**: `#e5e7eb` - Light borders/dividers
- **300**: `#d1d5db` - Medium borders
- **400**: `#9ca3af` - Light text/placeholders
- **500**: `#6b7280` - Medium text
- **600**: `#4b5563` - Body text (for detailed info)
- **700**: `#374151` - Body text
- **800**: `#1f2937` - Dark text
- **900**: `#111827` - Darkest (headings)

## Component Styles

### Base Elements

**Body Background**: `bg-white`
**Body Text**: `text-surface-700`
**Headings**: `text-surface-900 font-semibold`

### Cards
```jsx
// Standard card with subtle shadow
<div className="card">
  {/* content */}
</div>
// Usage: bg-white rounded-lg shadow-md-light p-6 border border-surface-200

// Elevated card with stronger shadow
<div className="card-elevated">
  {/* content */}
</div>
// Usage: bg-white rounded-lg shadow-lg-light p-6 border border-surface-200
```

### Buttons

**Primary Button** (main actions)
```jsx
<button className="btn-primary">
  Action
</button>
// bg-primary-600 hover:bg-primary-700 text-white font-semibold
```

**Secondary Button** (alternative actions)
```jsx
<button className="btn-secondary">
  Cancel
</button>
// bg-surface-100 hover:bg-surface-200 text-surface-900 font-semibold border border-surface-300
```

**Accent Button** (special/highlight actions)
```jsx
<button className="btn-accent">
  Special Action
</button>
// bg-accent-600 hover:bg-accent-700 text-white font-semibold
```

### Input Fields
```jsx
<input type="text" className="input-field" placeholder="Enter text..." />
// bg-white border border-surface-300 rounded-lg px-4 py-2 text-surface-900
// focus:ring-2 focus:ring-primary-500 focus:border-transparent
```

### Badges
```jsx
// Primary badge
<span className="badge-primary">Label</span>
// bg-primary-100 text-primary-700

// Accent badge
<span className="badge-accent">Label</span>
// bg-accent-100 text-accent-700

// Secondary badge
<span className="badge-secondary">Label</span>
// bg-surface-100 text-surface-700
```

## Shadow System

The design uses subtle, layered shadows for depth:

- **sm-light**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` - Minimal elevation
- **light**: `0 1px 3px 0 rgba(0, 0, 0, 0.1)` - Default card shadow
- **md-light**: `0 4px 6px -1px rgba(0, 0, 0, 0.1)` - Elevated card
- **lg-light**: `0 10px 15px -3px rgba(0, 0, 0, 0.1)` - Modal/dropdown shadow
- **xl-light**: `0 20px 25px -5px rgba(0, 0, 0, 0.1)` - Floating panels

## Typography

- **Headings (h1-h6)**: `font-semibold text-surface-900`
- **Body text**: `text-surface-700`
- **Muted text**: `text-surface-500`
- **Light text**: `text-surface-400`
- **Placeholder text**: `text-surface-400` on input fields

## Borders

- **Default border**: `border-surface-200` (light)
- **Medium border**: `border-surface-300`
- **Interactive borders**: Match the context (primary, accent, surface)

## Best Practices

### ✅ DO:
- Use color tokens from the palette for consistency
- Leverage CSS utility classes from the `.card`, `.btn-*`, and `.badge-*` component styles
- Maintain hover/active state transitions with `transition duration-200`
- Use semantic color names (primary for actions, accent for highlights, surface for neutral)
- Test color contrast for WCAG AA compliance

### ❌ DON'T:
- Hardcode hex colors (use Tailwind classes)
- Mix dark mode and light mode classes
- Use outdated color names like `gray-800`, `gray-900` for dark backgrounds
- Create custom shadows—use the predefined shadow-*-light classes

## Migration Notes

If you're updating existing components from the dark theme:

1. **Text Colors**:
   - `text-white` → `text-surface-900` or context-appropriate color
   - `text-gray-400` → `text-surface-500`
   - `text-gray-300` → `text-surface-600`

2. **Backgrounds**:
   - `bg-gray-900` → `bg-white` or `bg-surface-50` (for secondary sections)
   - `bg-gray-800` → `bg-white`
   - `bg-gray-700` → `bg-surface-100`

3. **Borders**:
   - `border-gray-700` → `border-surface-200`
   - `border-gray-600` → `border-surface-300`

4. **Component Colors**:
   - `bg-blue-600` → `bg-primary-600`
   - `text-blue-500` → `text-primary-600`

## Example: Complete Component Conversion

**Before (Dark Mode):**
```jsx
<div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
  <h2 className="text-white font-bold mb-4">Card Title</h2>
  <p className="text-gray-400 mb-4">Description text</p>
  <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg">
    Action
  </button>
</div>
```

**After (Light Mode):**
```jsx
<div className="card">
  <h2 className="text-surface-900 font-bold mb-4">Card Title</h2>
  <p className="text-surface-500 mb-4">Description text</p>
  <button className="btn-primary">
    Action
  </button>
</div>
```

## Configuration Files

- **Tailwind Config**: `tailwind.config.js` - Defines extended color palette and shadows
- **Global Styles**: `src/styles/index.css` - Base styles and component utilities
- **Theme Documentation**: This file

## Testing the Theme

After making changes:
1. Run `npm run dev` to preview
2. Check all interactive states: hover, active, disabled, focus
3. Verify text contrast meets WCAG standards
4. Test on light/neutral backgrounds for readability
5. Use browser DevTools to inspect computed styles

---

**Last Updated**: March 2025
**Theme Version**: 1.0 - Light Mode
