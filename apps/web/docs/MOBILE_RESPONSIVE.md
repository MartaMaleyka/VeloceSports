# Mobile & Responsive Design Guide

## Current Responsive Status

**Framework:** Tailwind CSS with mobile-first approach
**Breakpoints:** sm (640px), md (768px), lg (1024px), xl (1280px)
**Current Status:** Partially responsive, needs mobile optimization

## Mobile-First Strategy

### 1. Viewport & Base Styles
```html
<!-- Already in BaseLayout.astro -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 2. Touch-Friendly Interfaces

#### Button & Link Sizing
```typescript
// Minimum touch target: 48x48px (Apple) or 44x44px (Android)
// Current: Use Tailwind's min-h-touch, min-w-touch utilities

// Example:
<button className="min-h-touch min-w-touch px-4 py-2">
  Action
</button>
```

**Audit Required:**
- [ ] Check all buttons are >= 44px height
- [ ] Check all clickable elements have padding
- [ ] Verify spacing between touch targets (8px minimum)

#### Interactive Element Spacing
```css
/* Ensure proper spacing for touch */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  margin: 8px; /* Avoid accidental taps */
}
```

### 3. Mobile Navigation

#### Current Issues:
- Sidebar may not be optimized for mobile
- Navigation may not collapse properly
- Hamburger menu implementation check needed

#### Recommendations:
```typescript
// Mobile-first navigation approach
<nav className="hidden md:flex">
  {/* Desktop nav */}
</nav>

<button className="md:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
  <Menu className="h-6 w-6" />
</button>

{mobileNavOpen && (
  <nav className="md:hidden fixed inset-0 top-14 z-40">
    {/* Mobile nav overlay */}
  </nav>
)}
```

### 4. Responsive Grids & Layouts

#### Dashboard Cards (Current)
```typescript
// Good:
<StatCardGrid columns={3}>
  {/* Cards automatically stack on mobile */}
</StatCardGrid>

// Could be:
<StatCardGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }}>
  {/* Responsive column count */}
</StatCardGrid>
```

#### Form Layouts
```typescript
// Mobile-first form:
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <input /> {/* Full width on mobile */}
  <input /> {/* Two columns on tablet+ */}
</div>
```

### 5. Typography & Readability

#### Font Sizes
```css
/* Mobile optimized */
h1 {
  @apply text-2xl md:text-4xl lg:text-5xl;
}

body {
  @apply text-sm md:text-base;
  line-height: 1.6;
}
```

**Current Issues to Check:**
- [ ] Text too small on mobile (< 16px)
- [ ] Line-height insufficient (< 1.5)
- [ ] Contrast ratios meet WCAG AA (4.5:1)

### 6. Images & Media

#### Responsive Images
```typescript
import { Image } from 'astro:assets';

<Image
  src={playerPhoto}
  alt="Player name"
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  format="webp"
/>
```

#### Image Optimization for Mobile
```typescript
// Lazy load off-screen images
<img loading="lazy" src={...} />

// Responsive image sizes
<picture>
  <source media="(max-width: 640px)" srcset="...small.webp">
  <source media="(max-width: 1024px)" srcset="...medium.webp">
  <img src="...large.webp" alt="">
</picture>
```

### 7. Tables on Mobile

#### Current Issue:
Tables don't work well on small screens

#### Solution 1: Horizontal Scroll
```typescript
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

#### Solution 2: Card Layout
```typescript
// Convert table to cards on mobile
<div className="md:hidden space-y-4">
  {/* Card-based list */}
</div>

<div className="hidden md:block overflow-x-auto">
  <table>{/* Table on desktop */}</table>
</div>
```

### 8. Modal & Dialog Behavior

#### Mobile Fullscreen
```typescript
<div className={cn(
  'fixed inset-0 z-50',
  'sm:absolute sm:inset-auto sm:max-w-lg sm:rounded-lg'
)}>
  {/* Fullscreen on mobile, dialog on desktop */}
</div>
```

### 9. Viewport-Specific Concerns

#### Safe Area Support (notch)
```css
/* For devices with notches */
@supports (padding: max(0px)) {
  body {
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
  }
}
```

#### Landscape Orientation
```css
/* Handle landscape on mobile */
@media (max-height: 500px) {
  .large-banner {
    display: none;
  }
  
  input {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
```

## Testing Checklist

### Device Testing
- [ ] iPhone 12/13/14 (390px width)
- [ ] iPhone SE (375px width)
- [ ] Galaxy S21 (360px width)
- [ ] iPad (768px width)
- [ ] Desktop (1280px+ width)

### Orientation Testing
- [ ] Portrait orientation (mobile)
- [ ] Landscape orientation (mobile)
- [ ] Tablet modes

### Touch Testing
- [ ] All buttons/links tap-able (44px+)
- [ ] No accidental double-taps
- [ ] Form inputs accessible
- [ ] Keyboard doesn't obscure form fields

### Browser Testing
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Firefox Mobile
- [ ] Samsung Internet

### Performance on Mobile
- [ ] Lighthouse Mobile Score > 80
- [ ] FCP < 2s (First Contentful Paint)
- [ ] LCP < 2.5s (Largest Contentful Paint)
- [ ] CLS < 0.1 (Cumulative Layout Shift)

## Known Issues to Fix

1. **Dashboard KPI Cards**
   - Check 3-column layout on mobile (should be 1-column)
   - Verify stat values fit without wrapping

2. **Player Performance Table**
   - May need horizontal scroll on mobile
   - Consider card layout on small screens

3. **Forms**
   - Input sizes adequate for touch
   - Label positioning clear on mobile
   - Keyboard handling smooth

4. **Navigation**
   - Verify mobile menu opens/closes properly
   - Check sidebar collapse on mobile

## Implementation Priority

### Phase 1 (Immediate)
- [ ] Audit current mobile experience
- [ ] Fix critical breakage on small screens
- [ ] Ensure touch targets are 44px+
- [ ] Test navigation on mobile

### Phase 2 (Short-term)
- [ ] Optimize images for mobile
- [ ] Improve table responsiveness
- [ ] Add landscape orientation support
- [ ] Test on real devices

### Phase 3 (Long-term)
- [ ] Progressive Web App features
- [ ] Offline support
- [ ] Home screen installation
- [ ] Native app-like experience

## Performance Metrics

### Target Performance on Mobile (4G)
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 5s
- Cumulative Layout Shift: < 0.1

### Bundle Size Target
- JavaScript: < 200 KB (gzipped)
- CSS: < 50 KB (gzipped)
- Total: < 300 KB (gzipped)

## Tools & Resources

1. **Testing Tools:**
   - Chrome DevTools (mobile emulation)
   - BrowserStack (real device testing)
   - Responsively App (responsive design viewer)

2. **Performance Analysis:**
   - Lighthouse (Chrome DevTools)
   - PageSpeed Insights
   - WebPageTest

3. **Design Resources:**
   - iOS Human Interface Guidelines
   - Material Design Guidelines
   - WCAG 2.1 Mobile Accessibility

## References

- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Web.dev Mobile Optimization](https://web.dev/mobile-web-best-practices/)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Touch Target Size Guidelines](https://www.nngroup.com/articles/touch-target-size/)
