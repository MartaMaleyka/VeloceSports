# Security Hardening Guide

## Overview

This guide covers security measures implemented in VeloceSports backend and OWASP compliance. Includes authentication, authorization, input validation, and production hardening.

## Security Architecture

### Threat Model

**Assets to Protect:**
- User credentials (emails, passwords, JWT tokens)
- Tenant data isolation
- Player information (PII)
- Financial data (invoices, payments)
- Match analysis and coaching observations

**Attack Vectors:**
- Credential theft (weak passwords, token leakage)
- Unauthorized access (broken auth, poor RBAC)
- Data breaches (SQL injection, insecure deserialization)
- Denial of Service (rate limiting bypass, resource exhaustion)
- Lateral movement (privilege escalation, tenant isolation)

## Authentication

### Password Security

**Requirements:**
- Minimum 8 characters
- Combination of uppercase, lowercase, numbers, symbols
- Hashing: bcryptjs with salt rounds = 10 (≈ 100ms/hash)
- Never store plain text passwords

**Implementation:**
```typescript
import bcryptjs from 'bcryptjs';

const hash = await bcryptjs.hash(password, 10);
const matches = await bcryptjs.compare(password, hash);
```

### JWT Token Strategy

**Access Token:**
- Duration: 15 minutes (short-lived)
- Payload: `{ userId, role, tenantId, permissions }`
- Algorithm: HS256 (HMAC-SHA256)
- Signed with `JWT_SECRET` (stored in env variables)

**Refresh Token:**
- Duration: 30 days
- Stored in HTTP-only cookie (secure in production)
- Rotation: New token issued on each refresh
- Revocation: Added to blacklist after logout

**Token Verification Middleware:**
```typescript
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }
  
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
```

### Token Refresh Rotation

**Process:**
1. Client sends old refresh token
2. Server validates token (not in blacklist)
3. Server generates new access token + new refresh token
4. Server adds old refresh token to blacklist
5. Client stores new tokens

**Blacklist Strategy:**
```typescript
// In-memory cache with TTL (production: Redis)
const tokenBlacklist = new Map<string, number>();

export function revokeToken(token: string): void {
  const decoded = jwt.decode(token) as JwtPayload;
  const expiresAt = (decoded.exp ?? 0) * 1000;
  tokenBlacklist.set(token, expiresAt);
}

export function isTokenBlacklisted(token: string): boolean {
  const expiresAt = tokenBlacklist.get(token);
  if (!expiresAt) return false;
  
  if (Date.now() > expiresAt) {
    tokenBlacklist.delete(token);
    return false;
  }
  
  return true;
}
```

## Authorization (RBAC)

### Role Definitions

**Roles:**
- `PLATFORM_ADMIN`: All access (platform-wide)
- `ACADEMY_ADMIN`: Tenant admin (academy management)
- `COACH`: Match analysis, player management
- `PARENT`: View child player data
- `PLAYER`: View own stats

**Permissions Model:**
```typescript
enum Permission {
  CREATE_ACADEMY = 'create:academy',
  MANAGE_USERS = 'manage:users',
  VIEW_PLAYERS = 'view:players',
  EDIT_MATCH = 'edit:match',
  DELETE_OBSERVATION = 'delete:observation',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.PLATFORM_ADMIN]: [
    // All permissions
  ],
  [UserRole.ACADEMY_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_PLAYERS,
  ],
  [UserRole.COACH]: [
    Permission.VIEW_PLAYERS,
    Permission.EDIT_MATCH,
  ],
  [UserRole.PARENT]: [
    Permission.VIEW_PLAYERS, // Only own child
  ],
  [UserRole.PLAYER]: [
    // View own stats
  ],
};
```

### Middleware Implementation

```typescript
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    
    next();
  };
}

// Usage
router.delete(
  '/users/:userId',
  authenticate,
  requireRole(UserRole.ACADEMY_ADMIN, UserRole.PLATFORM_ADMIN),
  controller.deleteUser
);
```

### Tenant Isolation

**Per-Request Tenant Validation:**
```typescript
export function tenant(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string;
  
  if (!tenantId) {
    throw new BadRequestError('Missing tenant ID');
  }
  
  // Verify user belongs to this tenant
  const userTenants = req.user?.tenantIds ?? [];
  if (!userTenants.includes(Number(tenantId))) {
    throw new ForbiddenError('Not authorized for this tenant');
  }
  
  req.tenantId = Number(tenantId);
  next();
}

// Every query filters by tenant_id
const query = `SELECT * FROM players WHERE tenant_id = ? AND id = ?`;
```

## Input Validation

### Zod Schema Validation

**Benefits:**
- Type-safe runtime validation
- Prevents injection attacks
- Clear error messages
- Automatic coercion

**Implementation:**
```typescript
import { z } from 'zod';

export const createPlayerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  jerseyNumber: z.number().int().min(1).max(99),
  categoryId: z.number().int().positive(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreatePlayerBody = z.infer<typeof createPlayerSchema>;

// In route
router.post(
  '/',
  validate(createPlayerSchema),
  controller.create
);
```

### No Type Coercion Bypasses

❌ **Bad:**
```typescript
const body = req.body as unknown as CreatePlayerBody;
// No validation, SQL injection risk
```

✅ **Good:**
```typescript
const body = getValidated<CreatePlayerBody>(req, 'body');
// Zod validated, type-safe
```

## Protection Against OWASP Top 10

### 1. Broken Access Control

**Mitigation:**
- ✓ RBAC middleware on every endpoint
- ✓ Tenant isolation checks
- ✓ Permission-based access
- ✓ Audit logging

**Test:**
```typescript
it('should deny access to other tenant data', async () => {
  const user = userFactory.create({ tenantIds: [1] });
  const result = await playerService.getPlayer(2, user);
  // Should throw ForbiddenError
});
```

### 2. Cryptographic Failures

**Mitigation:**
- ✓ Password hashing with bcrypt (10 rounds)
- ✓ JWT signing with strong secret (env variable)
- ✓ HTTPS only in production (enforced by Node.js)
- ✓ Secure cookie flags

**Configuration:**
```typescript
res.cookie('refreshToken', token, {
  httpOnly: true,  // Prevent XSS access
  secure: true,    // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

### 3. Injection

**Mitigation:**
- ✓ Parameterized queries with mysql2
- ✓ Zod input validation
- ✓ No string concatenation in SQL
- ✓ Sanitization of user input

**Safe Query:**
```typescript
// ✓ Parameterized (prevents SQL injection)
db.query('SELECT * FROM players WHERE id = ? AND tenant_id = ?', [id, tenantId]);

// ❌ Unsafe concatenation
db.query(`SELECT * FROM players WHERE id = ${id}`);
```

### 4. Insecure Design

**Mitigation:**
- ✓ Threat modeling
- ✓ Secure SDLC practices
- ✓ Rate limiting on sensitive endpoints
- ✓ MFA consideration for high-security operations

**Rate Limiting:**
```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
});

router.post('/login', loginLimiter, controller.login);
```

### 5. Security Misconfiguration

**Mitigation:**
- ✓ Environment variables for secrets
- ✓ Helmet.js for HTTP headers
- ✓ CORS configuration whitelist
- ✓ No sensitive data in logs
- ✓ Dependency scanning (npm audit)

**Helmet Configuration:**
```typescript
app.use(helmet());
// Sets security headers:
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Content-Security-Policy: default-src 'self'
// - Strict-Transport-Security: max-age=31536000
```

### 6. Vulnerable and Outdated Components

**Mitigation:**
- ✓ Regular npm audit
- ✓ Automated dependency updates
- ✓ Security advisory monitoring
- ✓ Minimal dependencies

**Audit Process:**
```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# View detailed report
npm audit --json | jq '.metadata.vulnerabilities'
```

### 7. Authentication Failures

**Mitigation:**
- ✓ Strong password requirements
- ✓ JWT token rotation
- ✓ Short-lived access tokens (15min)
- ✓ Refresh token blacklist
- ✓ Failed login attempt logging
- ✓ Account lockout after N attempts

**Failed Login Tracking:**
```typescript
async function trackFailedLogin(email: string): Promise<void> {
  const attempts = await getFailedAttempts(email);
  
  if (attempts >= 5) {
    await lockAccount(email);
    logger.warn('Account locked after failed attempts', { email });
  } else {
    await incrementFailedAttempts(email);
  }
}
```

### 8. Data Integrity Failures

**Mitigation:**
- ✓ Database transactions for atomic operations
- ✓ Optimistic locking for concurrent updates
- ✓ Change audit logging
- ✓ Data validation on every write

**Transaction Example:**
```typescript
try {
  await db.beginTransaction();
  
  await db.update('players', update);
  await db.insert('audit_log', { action: 'update', table: 'players' });
  
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

### 9. Logging and Monitoring Failures

**Mitigation:**
- ✓ Structured logging with correlation IDs
- ✓ Security event logging
- ✓ Error tracking without sensitive data
- ✓ Request tracing

**Security Event Logging:**
```typescript
logInfo('Login successful', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  correlationId: req.correlationId,
  timestamp: new Date(),
});

logWarn('Unauthorized access attempt', {
  path: req.path,
  userId: req.user?.id,
  ip: req.ip,
  correlationId: req.correlationId,
});
```

### 10. SSRF (Server-Side Request Forgery)

**Mitigation:**
- ✓ Whitelist external URLs
- ✓ Validate file uploads
- ✓ Restrict backend requests
- ✓ Rate limit file operations

**File Upload Validation:**
```typescript
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxFileSize = 5 * 1024 * 1024; // 5MB

if (!allowedMimeTypes.includes(file.mimetype)) {
  throw new BadRequestError('Invalid file type');
}

if (file.size > maxFileSize) {
  throw new BadRequestError('File too large');
}
```

## HTTPS & TLS

**Production Requirements:**
- ✓ Valid SSL/TLS certificate
- ✓ Force HTTPS redirect
- ✓ HSTS header (Strict-Transport-Security)
- ✓ Minimum TLS 1.2

**Node.js Configuration:**
```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
};

https.createServer(options, app).listen(443);
```

## Dependency Security

### npm audit Baseline

**Action Plan:**
```bash
# Check for vulnerabilities
npm audit --json

# Report must show:
# - No critical vulnerabilities
# - High vulnerabilities reviewed/resolved
# - Medium vulnerabilities documented
# - Low vulnerabilities can be waived
```

### Automated Security Scanning

**In CI/CD Pipeline:**
```yaml
# GitHub Actions example
- name: Security Audit
  run: npm audit --audit-level=moderate
  
- name: Dependency Check
  run: npm outdated --long
```

### Regular Updates

**Schedule:**
- Weekly: Check for security updates
- Monthly: Review and apply updates
- Quarterly: Major version compatibility check

## Secrets Management

### Environment Variables

**Required Secrets:**
```
JWT_SECRET=<very-long-random-string>
DB_PASSWORD=<strong-password>
MINIO_SECRET_KEY=<s3-secret>
ENCRYPTION_KEY=<for-sensitive-data>
```

**Never:**
- ❌ Commit secrets to git
- ❌ Log secrets
- ❌ Share in Slack/email
- ❌ Use weak defaults

**Verification:**
```bash
# Check for committed secrets
git log -p | grep -i "password\|secret\|key" | head

# Scan for exposed secrets
npm install -g detect-secrets
detect-secrets scan
```

## Incident Response

### Security Incident Checklist

**Upon Discovery:**
1. ✓ Isolate affected systems
2. ✓ Preserve logs/evidence
3. ✓ Notify stakeholders
4. ✓ Document timeline
5. ✓ Begin root cause analysis

**Communication:**
- Affected users: What happened, what to do
- Management: Impact assessment, timeline
- Security team: Technical details, remediation

### Breach Response Example

```typescript
// Detected unauthorized access
logger.error('Potential security breach detected', {
  correlationId: req.correlationId,
  userId: req.user?.id,
  unauthorizedAccess: true,
  table: 'players',
  affectedTenants: [tenantId],
  timestamp: new Date(),
});

// Immediately revoke all tokens for affected users
await revokeTokensForTenant(tenantId);

// Notify security team
await notifySecurityTeam({
  incident: 'Unauthorized access',
  severity: 'high',
  affectedUsers: count,
});
```

## Security Testing

### Test Examples

```typescript
describe('Security Tests', () => {
  it('should reject SQL injection attempt', async () => {
    const malicious = "'; DROP TABLE players; --";
    
    const result = playerSchema.safeParse({
      firstName: malicious,
    });
    
    expect(result.success).toBe(false);
  });

  it('should deny access to other tenant data', async () => {
    const coach = await loginAs('coach@tenant1.local');
    
    expect(async () => {
      await playerService.getPlayer(playerId, tenantId2, coach);
    }).rejects.toThrow(ForbiddenError);
  });

  it('should lock account after 5 failed logins', async () => {
    for (let i = 0; i < 5; i++) {
      await auth.login('user@test.local', 'wrong-password');
    }
    
    const locked = await db.query('SELECT locked FROM users WHERE email = ?');
    expect(locked[0].locked).toBe(true);
  });
});
```

## Production Checklist

Before deploying to production:

- [ ] All secrets in environment variables
- [ ] npm audit shows no critical vulnerabilities
- [ ] HTTPS enabled with valid certificate
- [ ] Database backups configured
- [ ] Monitoring and alerting active
- [ ] Incident response plan in place
- [ ] RBAC tested and verified
- [ ] Tenant isolation verified
- [ ] Rate limiting configured
- [ ] Logging configured (no sensitive data)
- [ ] Security headers verified
- [ ] CORS whitelist configured
- [ ] Password policy enforced
- [ ] Token expiry set appropriately
- [ ] Refresh token rotation enabled

## Security Headers

**HSTS (HTTP Strict Transport Security):**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**CSP (Content Security Policy):**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

**X-Frame-Options:**
```
X-Frame-Options: DENY
```

**X-Content-Type-Options:**
```
X-Content-Type-Options: nosniff
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Last Updated**: 2026-10-04  
**Status**: Security infrastructure ready for production
