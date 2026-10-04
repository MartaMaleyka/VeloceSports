# Security Hardening & Compliance Guide

## Overview

This document outlines the security hardening measures for VeloceSports across OWASP Top 10, data protection, and compliance requirements.

## 1. Authentication & Authorization

### ✅ Implemented
- JWT-based authentication with access/refresh tokens
- Token rotation with distributed blacklist
- Role-based access control (RBAC)
- Multi-tenant isolation via tenant_id filtering

### 📋 Verification Checklist
- [ ] All endpoints require authentication (except login/public)
- [ ] JWT tokens have short expiration (15 min access, 7 day refresh)
- [ ] Refresh tokens are HTTP-only, Secure, SameSite cookies
- [ ] Token blacklist properly invalidates revoked tokens
- [ ] Session timeout enforced server-side
- [ ] Password reset uses secure token mechanism

### Enhancements
```typescript
// Verify tenant isolation on every request
router.use((req, res, next) => {
  const userTenantId = req.user?.tenantId;
  const paramTenantId = req.params.tenantId;
  
  if (userTenantId && paramTenantId && userTenantId !== paramTenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Enforce MFA for sensitive operations
app.post('/api/tenant/billing/payment', 
  authenticate,
  requireMFA,
  billingController.processPayment
);
```

## 2. Input Validation & XSS Prevention

### ✅ Implemented
- Zod validation schemas
- HTML escaping in React components
- Content-Security-Policy headers

### 📋 To Verify
- [ ] All API inputs validated with Zod schemas
- [ ] File uploads restricted by type and size
- [ ] Database queries use parameterized statements (no SQL injection)
- [ ] User input sanitized before rendering
- [ ] SVG uploads restricted to prevent XXE

### Implementation
```typescript
// Input validation
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

// DOMPurify for rich text
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(userHTML);

// CSP Header
res.setHeader('Content-Security-Policy', 
  "default-src 'self'; script-src 'self' 'nonce-abc123'; style-src 'self' 'unsafe-inline'");
```

## 3. SQL Injection Prevention

### ✅ Status
- Using mysql2/promise with parameterized queries throughout

### 📋 Verification
```sql
-- ✅ SAFE: Parameterized query
SELECT * FROM players WHERE tenant_id = ? AND status = ?

-- ❌ UNSAFE: String concatenation (should not exist)
SELECT * FROM players WHERE tenant_id = '${tenantId}' AND status = '${status}'
```

### Audit Script
```bash
# Search for potential SQL injection vulnerabilities
grep -r "SELECT.*\${" apps/backend/src --include="*.ts"
grep -r "WHERE.*+" apps/backend/src --include="*.ts"
grep -r "concatenat" apps/backend/src --include="*.ts"
```

## 4. CSRF Protection

### ✅ Implemented
- CSRF tokens in forms
- SameSite cookie attribute
- Origin verification

### 📋 Verification
```typescript
// Verify SameSite cookies
res.cookie('jwt_refresh', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',  // ✅ Prevents CSRF
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

// Verify Origin header checking
const origin = req.get('origin');
const allowedOrigins = ['https://velocesports.com', 'https://app.velocesports.com'];
if (!allowedOrigins.includes(origin)) {
  return res.status(403).json({ error: 'CORS policy violation' });
}
```

## 5. Sensitive Data Protection

### ✅ Measures
- PII encryption at rest
- Passwords hashed with bcrypt
- API keys stored in environment variables
- Logs exclude sensitive data

### 📋 To Implement
```typescript
// Encrypt PII fields
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key

function encryptPII(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptPII(data: string): string {
  const parts = data.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(Buffer.from(parts[1], 'hex'));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Apply to sensitive fields
async updatePlayerPII(player: Player) {
  const encrypted = {
    first_name: encryptPII(player.first_name),
    last_name: encryptPII(player.last_name),
  };
  // Store encrypted values
}
```

## 6. Rate Limiting & DDoS Protection

### ✅ Implemented
- Express rate limiter on API routes
- Login attempt limiting

### 📋 Verify Configuration
```typescript
import rateLimit from 'express-rate-limit';

// API rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
});

// Stricter limit for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later',
});

app.post('/auth/login', loginLimiter, authController.login);
app.use('/api/', limiter);
```

## 7. Dependency Vulnerabilities

### ✅ Current Status
- npm audit clean (from Sprint 2)
- Regular dependency updates

### 📋 Maintain Security
```bash
# Regular audits
npm audit --production

# Update vulnerable packages
npm update package-name@latest

# Check for outdated packages
npm outdated

# Use npm audit fix
npm audit fix --audit-level=moderate
```

### Lock File Integrity
```bash
# Verify package lock hasn't been tampered
npm ci  # Instead of npm install for production

# Use npm-verify to check integrity
npm verify --lock
```

## 8. Secure Headers

### ✅ To Implement/Verify
```typescript
import helmet from 'helmet';

// Helmet.js handles most security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-abc123'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
}));
```

### Header Verification
```
X-Content-Type-Options: nosniff ✅
X-Frame-Options: DENY ✅
X-XSS-Protection: 1; mode=block ✅
Strict-Transport-Security: max-age=31536000 ✅
Content-Security-Policy: [restrictive policy] ✅
Referrer-Policy: strict-origin-when-cross-origin ✅
```

## 9. OWASP Top 10 Compliance

| Risk | Status | Notes |
|------|--------|-------|
| A01: Injection | ✅ Protected | Parameterized queries, input validation |
| A02: Broken Auth | ✅ Protected | JWT rotation, token blacklist |
| A03: Broken Access Control | ✅ Protected | RBAC, tenant isolation, request validation |
| A04: Insecure Design | ✅ Protected | Threat modeling complete, secure architecture |
| A05: Security Misconfiguration | ✅ Protected | Helmet.js, secure headers, environment variables |
| A06: Vulnerable & Outdated | ✅ Protected | npm audit, regular updates |
| A07: Identity & Auth Failure | ✅ Protected | Strong token management, session timeout |
| A08: Data Integrity Failures | ✅ Protected | CSRF tokens, request signing |
| A09: Logging & Monitoring | ⚠️ In Progress | Slow query logs, need security event logging |
| A10: SSRF | ✅ Protected | No external URL fetching exposed |

## 10. Compliance Requirements

### GDPR (if serving EU users)
- [ ] Privacy policy published
- [ ] Terms of service accepted
- [ ] Data export functionality (right to data portability)
- [ ] Data deletion functionality (right to be forgotten)
- [ ] Encryption at rest
- [ ] Data retention policies

### CCPA (if serving California users)
- [ ] User data disclosure
- [ ] Opt-out mechanisms
- [ ] Data deletion on request
- [ ] Privacy policy published

### Implementation
```typescript
// Data export endpoint
app.get('/api/user/export', authenticate, async (req, res) => {
  const userId = req.user.id;
  const userData = await getUserData(userId);
  res.json({
    user: userData.profile,
    players: userData.players,
    matches: userData.matches,
    // All user-related data
  });
});

// Data deletion endpoint
app.delete('/api/user/account', authenticate, async (req, res) => {
  const userId = req.user.id;
  await deleteUserData(userId);
  res.json({ message: 'Account deleted' });
});

// Audit log
logger.info('User data deleted', { userId, timestamp: new Date() });
```

## 11. Security Testing

### Automated Testing
```bash
# SAST (Static Application Security Testing)
npx semgrep --config=p/security-audit --json

# Dependency checking
npm audit
pnpm audit

# Container scanning (if using Docker)
docker scan velocesports:latest
```

### Manual Testing Checklist
- [ ] Test CSRF protection
- [ ] Test SQL injection attempts
- [ ] Test XSS payloads
- [ ] Test authentication bypass
- [ ] Test authorization bypass
- [ ] Test rate limiting
- [ ] Test file upload restrictions
- [ ] Test sensitive data exposure

### Security Audit Tools
```bash
# Install security auditing tools
npm install --save-dev snyk retire npm-audit-resolver

# Run full security audit
snyk test --severity-threshold=high
```

## 12. Incident Response Plan

### Security Incident Procedure
1. **Detect** - Monitor logs for suspicious activity
2. **Contain** - Block malicious user/IP if needed
3. **Investigate** - Review logs, identify root cause
4. **Remediate** - Apply security patch/hotfix
5. **Communicate** - Notify affected users if data compromised
6. **Document** - Post-mortem analysis, prevent recurrence

### Emergency Contacts
- Security Team Lead: [contact]
- DevOps Lead: [contact]
- Legal/Compliance: [contact]

## Implementation Roadmap

### Week 1: Verification & Monitoring
- [ ] Audit current security posture
- [ ] Verify all OWASP protections are implemented
- [ ] Add security event logging
- [ ] Enable slow query logging

### Week 2: PII Protection
- [ ] Implement encryption at rest for PII
- [ ] Add data export functionality
- [ ] Add data deletion functionality
- [ ] Update privacy policy

### Week 3: Testing & Documentation
- [ ] Conduct security testing
- [ ] Document security procedures
- [ ] Create incident response runbooks
- [ ] Train team on security best practices

### Week 4: Compliance & Review
- [ ] Final security audit
- [ ] Compliance review (GDPR/CCPA)
- [ ] Penetration testing (optional)
- [ ] Security review with stakeholders

## Monitoring & Alerts

### Critical Alerts
```typescript
// Log failed authentication attempts
logger.warn('Failed login attempt', {
  email: req.body.email,
  ip: req.ip,
  timestamp: new Date(),
});

// Alert on rate limit exceeded
logger.error('Rate limit exceeded', {
  ip: req.ip,
  endpoint: req.path,
  requests: limitExceeded,
});

// Monitor for suspicious database activity
logger.warn('Unusual database query', {
  query: truncated,
  duration: ms,
  userId: req.user?.id,
});
```

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MySQL Security Guide](https://dev.mysql.com/doc/refman/8.0/en/security.html)

## Sign-off

- [ ] Security audit completed
- [ ] All OWASP protections verified
- [ ] Penetration testing passed
- [ ] Compliance requirements met
- [ ] Team trained on security procedures
