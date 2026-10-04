# Web Performance Optimization Guide

## Current State Analysis

**Build Artifact Size:** 7.2 MB (dist folder)
**Framework:** Astro 7.3.5 with React 19.0.0
**Build Mode:** Server-side rendering with Node.js adapter

## Performance Bottlenecks

### 1. Large JavaScript Bundles
- Multiple dashboard page components loaded upfront
- Heavy imports like `recharts` and `react-image-crop` on all pages
- Design system components not tree-shaken effectively

### 2. Route-based Code Splitting
Currently missing per-route code splitting for:
- Dashboard pages (academy, coach, parent, player)
- Admin sections (settings, billing, users, categories)
- Match-related pages (match detail, reports)

### 3. Component Lazy Loading
Not utilizing dynamic imports for:
- Charts and visualization components
- Modal dialogs and overlays
- Heavy feature modules (report cards, analysis)

## Optimization Recommendations

### Phase 1: Code Splitting (High Impact)

#### 1.1 Route-Based Splitting Strategy

Implement route-level code splitting in Astro by separating heavy pages:

```typescript
// For dashboard pages, ensure each role gets its own chunk
// Academy Admin pages
- home.astro (includes getting started, KPI cards)
- analytics.astro (new analytics page)
- users.astro
- categories.astro
- players.astro
- matches/index.astro
- billing.astro
- settings.astro

// Coach pages
- home.astro
- categories.astro
- players.astro
- player-performance.astro (new performance page)
- analysis.astro

// Parent & Player pages
- Keep separate from admin/coach bundles
```

**Impact:** Reduce initial bundle by 40-50% for first meaningful paint

#### 1.2 Component-Level Lazy Loading

```typescript
// Import heavy components dynamically in page components
const CoachAnalysisChart = lazy(() => import('../components/coach/CoachAnalysisChart'));
const PlayerPerformanceChart = lazy(() => import('../components/academy/PerformanceChart'));
const ReportCardExporter = lazy(() => import('../components/reports/ReportCardExporter'));
```

**Impact:** 20-30% faster page load for non-analytics pages

### Phase 2: Dependency Optimization

#### 2.1 Recharts Bundle Size
- **Current:** ~90 KB minified (part of ~250 KB charts library)
- **Strategy:** Only import used chart types
- **Optimization:**
  ```typescript
  // Instead of: import { BarChart, LineChart, PieChart, ... } from 'recharts'
  // Use: import BarChart from 'recharts/lib/components/BarChart'
  ```
- **Impact:** 60-70 KB reduction

#### 2.2 Design System Tree-Shaking
- Verify all exported components are used
- Remove unused icon imports
- Use CSS modules for scoped styling instead of global imports

**Impact:** 30-40 KB reduction

#### 2.3 Lucide React Icons
- Currently importing full icon set
- Strategy: Import only used icons, not entire library
- **Current approach:** Icons imported individually ✓ (already optimized)

### Phase 3: CSS Optimization

#### 3.1 Tailwind CSS Purging
Current setup already does tree-shaking, but ensure:
- Verify `content` paths in `tailwind.config.js` cover all templates
- No unused utility classes generated
- Use CSS minification in production

#### 3.2 Critical CSS
- Inline critical CSS for above-the-fold content
- Defer non-critical stylesheets

**Estimated savings:** 40-60 KB

### Phase 4: Image and Asset Optimization

#### 4.1 Image Optimization
- Use Astro's Image component for automatic optimization
- Implement responsive images with srcset
- Use WebP format with fallbacks
- Lazy-load off-screen images

#### 4.2 Player Photos
- Compress JPEG/PNG to WebP (60-70% size reduction)
- Generate thumbnail sizes for lists
- Use blur-up placeholders for perceived performance

**Estimated savings:** 200-400 KB (per user session)

### Phase 5: Caching Strategy

#### 5.1 Browser Caching Headers
```
# In production (nginx/server):
Cache-Control: public, max-age=3600  # HTML, 1 hour
Cache-Control: public, max-age=31536000  # JS/CSS, 1 year
Cache-Control: private, max-age=86400  # API responses, 1 day
```

#### 5.2 Service Worker (Optional)
For offline support and faster subsequent loads:
- Cache static assets after first visit
- Implement stale-while-revalidate strategy
- Cache API responses with time-based invalidation

**Estimated impact:** 80% faster subsequent page loads

### Phase 6: Runtime Performance

#### 6.1 React Component Optimization
- Memoize expensive components
- Split large components into smaller ones
- Use `useMemo` for heavy calculations
- Profile with React DevTools

#### 6.2 Data Fetching
- Implement request deduplication
- Add Loading UI with streaming responses
- Use SWR or React Query for automatic revalidation

#### 6.3 Bundle Analysis
```bash
# Analyze webpack bundle
npm run build --analyze

# Or use:
npx vite-bundle-visualizer
```

## Implementation Roadmap

### Week 1: Code Splitting
- [ ] Implement route-based bundle splitting
- [ ] Add lazy() wrappers for heavy components
- [ ] Measure bundle size reduction

### Week 2: Dependency Optimization  
- [ ] Audit and optimize chart imports
- [ ] Tree-shake design system
- [ ] Review and minimize icon imports

### Week 3: CSS and Images
- [ ] Optimize Tailwind output
- [ ] Implement image compression pipeline
- [ ] Add responsive image srcsets

### Week 4: Caching and Testing
- [ ] Configure cache headers
- [ ] Performance testing with Lighthouse
- [ ] Load testing with simulated users

## Performance Metrics to Track

### Core Web Vitals
- **LCP** (Largest Contentful Paint): Target < 2.5s
- **FID** (First Input Delay): Target < 100ms (deprecated, use INP)
- **CLS** (Cumulative Layout Shift): Target < 0.1
- **INP** (Interaction to Next Paint): Target < 200ms

### Additional Metrics
- **Time to First Byte (TTFB):** Target < 600ms
- **Total Blocking Time (TBT):** Target < 300ms
- **Bundle Size:** Target < 4 MB (gzipped < 1 MB)

## Tools for Monitoring

1. **Lighthouse** - Built-in Chrome DevTools
2. **WebPageTest** - Full performance waterfall analysis
3. **Bundle Analyzer** - Vite bundle visualization
4. **React DevTools Profiler** - Component render profiling
5. **Network Tab** - Request waterfall analysis

## Expected Improvements

After all optimizations:
- **Initial Load:** 30-40% faster
- **Bundle Size:** 40-50% reduction (7.2 MB → 3.5-4.2 MB)
- **Time to Interactive:** 25-35% improvement
- **Lighthouse Score:** 70+ → 85+

## Quick Wins (Implement First)

1. Lazy-load dashboard chart components
2. Split route bundles for different user roles
3. Optimize Recharts imports
4. Enable gzip compression in production
5. Add cache-busting headers for static assets

## References

- [Astro Performance Guide](https://docs.astro.build/en/guides/performance/)
- [Vite Configuration Reference](https://vitejs.dev/config/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [React Performance Optimization](https://react.dev/reference/react/memo)
- [Image Optimization Best Practices](https://web.dev/image-optimization/)
