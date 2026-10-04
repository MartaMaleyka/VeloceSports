# VeloceSports Accessibility Guide

## Goal: WCAG 2.1 Level AA Compliance

This guide outlines accessibility standards and implementation patterns for VeloceSports to achieve WCAG 2.1 Level AA compliance.

## Core Principles

### 1. Perceivable
Information must be presented in ways users can perceive.

- **Text Alternatives**: All images have descriptive alt text
- **Adaptable Content**: Information presented in multiple ways
- **Distinguishable**: Sufficient color contrast (4.5:1 minimum for normal text)

### 2. Operable
Users must be able to navigate and interact with the interface.

- **Keyboard Access**: All functionality available via keyboard
- **Focus Management**: Clear focus indicators on interactive elements
- **No Seizure Risk**: No flashing content exceeding 3 Hz

### 3. Understandable
Information and operation must be understandable.

- **Readable**: Clear language, defined abbreviations
- **Predictable**: Consistent navigation and behavior
- **Input Assistance**: Clear labels, error messages in plain language

### 4. Robust
Content must be compatible with assistive technologies.

- **Valid HTML**: Proper semantic structure
- **ARIA**: Appropriate use of ARIA attributes
- **Screen Reader**: Content announced correctly

## Implementation Guidelines

### HTML & Semantic Markup

```html
<!-- ✅ Good: Semantic HTML -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
    <li><a href="/players">Players</a></li>
  </ul>
</nav>

<!-- ❌ Bad: Non-semantic divs -->
<div class="nav">
  <div class="item"><span onclick="...">Dashboard</span></div>
</div>
```

### Form Labels & Associations

```html
<!-- ✅ Good: Explicit association -->
<label for="email-input">Email Address</label>
<input id="email-input" type="email" name="email" required />

<!-- ✅ Good: Wrapped label -->
<label>
  Email Address
  <input type="email" name="email" required />
</label>

<!-- ❌ Bad: Missing label -->
<input type="email" placeholder="email@example.com" />
```

### Color Contrast

**WCAG AA Requirements:**
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Graphics/UI components: 3:1 contrast ratio

```css
/* ✅ Good: High contrast */
.button {
  color: #000000;
  background-color: #FFFFFF;
  /* Contrast: 21:1 */
}

/* ❌ Bad: Low contrast */
.button {
  color: #888888;
  background-color: #AAAAAA;
  /* Contrast: 1.2:1 (fails) */
}
```

Tools:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools Chrome Extension](https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnkpklempisson)

### Focus Management

```tsx
// ✅ Good: Visible focus indicator
.button:focus {
  outline: 3px solid #4A90E2;
  outline-offset: 2px;
}

// ❌ Bad: Hidden focus
.button:focus {
  outline: none;
}
```

### ARIA Attributes

#### Landmark Roles
```html
<header role="banner">Site header</header>
<nav role="navigation" aria-label="Main">...</nav>
<main role="main">Primary content</main>
<aside role="complementary">Secondary content</aside>
<footer role="contentinfo">Site footer</footer>
```

#### Live Regions
```tsx
// Announce dynamic content changes
<div aria-live="polite" aria-atomic="true">
  {loadingMessage}
</div>

// For errors
<div role="alert">{errorMessage}</div>
```

#### Button States
```tsx
<button
  aria-pressed={isActive}
  aria-label="Toggle menu"
>
  ☰
</button>
```

#### Form Validation
```tsx
<input
  type="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby="email-error"
/>
{hasError && <span id="email-error">{errorMessage}</span>}
```

### Keyboard Navigation

```tsx
// ✅ Good: Handling keyboard events
const handleKeydown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    handleAction();
  }
};

// ✅ Good: Using keyboard-compatible elements
<button onClick={handleAction}>Action</button>

// ❌ Bad: Non-keyboard accessible
<div onClick={handleAction}>Action</div>
```

### Screen Reader Announcements

```tsx
// ✅ Good: Meaningful alternative text
<img src="player.jpg" alt="Player #10 John Smith in midfield position" />

// ❌ Bad: Generic or missing alt text
<img src="player.jpg" alt="player" />
<img src="logo.png" alt="Logo" /> {/* Only if decorative */}

// ✅ For decorative images
<img src="divider.png" alt="" aria-hidden="true" />
```

### Skip Links

```html
<!-- ✅ Include skip link at start of page -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<style>
  .skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    z-index: 100;
  }

  .skip-link:focus {
    top: 0;
  }
</style>

<main id="main-content">...</main>
```

### Error Messages

```tsx
// ✅ Good: Clear, actionable errors
<div role="alert" className="error">
  <p>Password must be at least 8 characters</p>
  <p>Include uppercase, lowercase, and numbers</p>
</div>

// ❌ Bad: Vague error
<div className="error">Error: Invalid input</div>
```

## Testing Accessibility

### Manual Testing

1. **Keyboard Navigation**
   ```bash
   # Test without mouse
   - Tab through all interactive elements
   - Verify focus is always visible
   - Ensure logical tab order (left→right, top→bottom)
   ```

2. **Screen Reader Testing**
   ```bash
   # Use built-in screen readers
   - Windows: NVDA (free) or JAWS
   - macOS: VoiceOver (free)
   - iOS: VoiceOver
   - Android: TalkBack
   ```

3. **Color Contrast**
   - Use browser extensions to check contrast ratios
   - Verify minimum 4.5:1 for normal text

### Automated Testing

#### axe DevTools
```bash
# Install Chrome extension
# Open DevTools → axe DevTools → Scan Page
```

#### WAVE (WebAIM)
```bash
# Install Firefox/Chrome extension
# Highlights accessibility issues on the page
```

#### Lighthouse (Chrome DevTools)
```bash
# Open DevTools → Lighthouse
# Run audit including Accessibility
# Target: 90+ score
```

#### ESLint Plugin
```bash
# Install: npm install --save-dev eslint-plugin-jsx-a11y

# Configure .eslintrc.json:
{
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "error"
  }
}
```

## Frontend Component Checklist

### Form Components
- [ ] Labels associated with inputs (for/id)
- [ ] Error messages linked via aria-describedby
- [ ] Required fields marked with aria-required
- [ ] Validation feedback provided
- [ ] Sufficient color contrast on labels

### Buttons
- [ ] Keyboard operable (Enter/Space)
- [ ] Clear focus indicator
- [ ] Descriptive text or aria-label
- [ ] Icon buttons include aria-label
- [ ] State indicated (aria-pressed, aria-expanded)

### Navigation
- [ ] Skip link to main content
- [ ] Landmark roles (nav, main, aside)
- [ ] aria-label for nav sections
- [ ] Logical tab order
- [ ] Focus trapped in modals

### Modals/Dialogs
- [ ] Focus moved to dialog on open
- [ ] Keyboard closeable (Escape)
- [ ] Focus returned to trigger on close
- [ ] Background content inert (aria-hidden)
- [ ] role="dialog" or role="alertdialog"

### Tables
- [ ] Table headers with `<th scope="col|row">`
- [ ] Summary for complex tables
- [ ] Data cells associated with headers
- [ ] Scroll containers keyboard accessible

### Images & Icons
- [ ] Meaningful alt text
- [ ] Decorative images: alt="" + aria-hidden
- [ ] Icon buttons: aria-label or visible text
- [ ] SVG icons: role="img" + aria-label

## Translation & Localization

All messages and labels are i18n enabled:

```typescript
import { t } from './utils/i18n';

// Get translated message
const errorMsg = t('validation.email.invalid', 'es');
```

## Performance & Accessibility

Optimize for accessibility:
- **Animations**: Respect prefers-reduced-motion
- **Font Sizes**: Minimum 12px, scale with zoom
- **Touch Targets**: Minimum 44×44px (mobile)
- **Load Time**: Fast loading aids screen readers

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Articles](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Measurement

### Coverage Target: WCAG AA
- **Before**: Level A
- **Target**: Level AA
- **Success**: 100% automated audit pass + manual testing

### Metrics
- Axe DevTools violations: 0 critical/serious
- Lighthouse score: 90+
- Manual testing: Keyboard + screen reader pass
- WCAG Criteria: AA conformance for all pages

## Maintenance

- Review accessibility on every feature PR
- Run automated tests in CI/CD
- Quarterly manual accessibility audit
- Team training: 1 hour/quarter on a11y
- User feedback: Gather from assistive tech users

---

**Last Updated**: 2026-10-04
**Version**: 1.0
**Status**: In Progress (targeting Q4 2026)
