import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { UserRole } from '@velocesport/shared';

// Extract tenant ID from request (from headers or auth context)
const getTenantId = (req: Request): string => {
  const headerId = req.headers['x-tenant-id'] as string;
  const tenantId = req.user?.tenantId;
  return headerId || (tenantId ? String(tenantId) : 'anonymous');
};

// Extract user ID from request
const getUserId = (req: Request): string => {
  const userId = req.user?.userId;
  return userId ? String(userId) : (req.ip || 'anonymous');
};

// Global rate limiter: moderate limits for general API usage
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req: Request) => {
    // Use tenant ID for authenticated requests, IP for anonymous
    return getTenantId(req) || req.ip || '';
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Strict rate limiter for photo uploads
export const photoUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many photo uploads. Maximum 5 per minute.',
  keyGenerator: (req: Request) => {
    return `photo-${getTenantId(req)}-${getUserId(req)}`;
  },
  skip: (req: Request) => {
    // Check if user is admin (bypass rate limit)
    return req.user?.role === UserRole.ACADEMY_ADMIN || req.user?.role === UserRole.SUPER_ADMIN;
  },
});

// Moderate rate limiter for observations
export const observationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 observations per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many observations. Maximum 10 per minute.',
  keyGenerator: (req: Request) => {
    return `observation-${getTenantId(req)}-${getUserId(req)}`;
  },
});

// Moderate rate limiter for match actions (captures, attendance)
export const matchActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 actions per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many match actions. Maximum 20 per minute.',
  keyGenerator: (req: Request) => {
    return `match-action-${getTenantId(req)}-${getUserId(req)}`;
  },
});

// Strict rate limiter for reports generation (CPU intensive)
export const reportGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 reports per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many report generation requests. Maximum 3 per minute.',
  keyGenerator: (req: Request) => {
    return `report-${getTenantId(req)}-${getUserId(req)}`;
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (req: Request) => {
    return req.ip || '';
  },
  skip: (req: Request) => {
    // Only apply to login endpoint
    return !req.path.includes('/login');
  },
});

// Moderate rate limiter for player/academy data operations
export const dataMutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 mutations per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many data modifications. Please slow down.',
  keyGenerator: (req: Request) => {
    return `mutation-${getTenantId(req)}-${getUserId(req)}`;
  },
  skip: (req: Request) => {
    // Only apply to POST/PUT/DELETE requests
    return !['POST', 'PUT', 'DELETE'].includes(req.method);
  },
});

// Note: express-rate-limit handles error responses automatically.
// Custom error formatting can be done via the `handler` option on specific limiters if needed.
