# Code Quality & Standards Guide

## Overview

Comprehensive code quality standards for VeloceSports ensuring consistency, maintainability, security, and performance across frontend and backend.

## Quality Gates

All code must pass:

1. **Linting** (ESLint)
2. **Type Checking** (TypeScript)
3. **Formatting** (Prettier)
4. **Security** (npm audit, SAST)
5. **Testing** (70%+ coverage)
6. **Performance** (budget checks)

## Code Formatting

### Prettier Configuration

**File**: `.prettierrc.json`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Ignore file**: `.prettierignore`

```
node_modules/
dist/
build/
coverage/
*.min.js
*.min.css
package-lock.json
yarn.lock
pnpm-lock.yaml
```

**Format code**:

```bash
# Format all files
npm run format

# Format and check
npm run format:check

# Format specific file
npx prettier --write src/index.ts
```

## Linting

### ESLint Configuration

**File**: `.eslintrc.json`

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "security", "sonarjs"],
  "rules": {
    "@typescript-eslint/explicit-function-return-types": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-regexp": "warn",
    "sonarjs/cognitive-complexity": "warn",
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "eqeqeq": ["error", "always"],
    "curly": "error",
    "brace-style": ["error", "1tbs"]
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

**Run linting**:

```bash
# Check all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check specific file
npx eslint src/index.ts
```

## TypeScript Configuration

### Backend tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Type checking**:

```bash
# Check types
npm run type-check

# Watch mode
npm run type-check:watch
```

## Testing Standards

### Unit Test Requirements

**Minimum coverage by file**:
- Utilities: 90%
- Services: 85%
- Controllers: 70%
- Hooks: 90%
- Components: 80%

**Test structure**:

```typescript
describe('PlayerService', () => {
  // Setup
  beforeEach(() => {
    // Initialize test data
  });

  describe('findByCategory', () => {
    it('should return players in category', async () => {
      // Arrange
      const categoryId = 1;
      const expectedPlayers = [
        { id: 1, firstName: 'John', lastName: 'Doe' },
        { id: 2, firstName: 'Jane', lastName: 'Smith' },
      ];

      // Act
      const result = await playerService.findByCategory(categoryId);

      // Assert
      expect(result).toEqual(expectedPlayers);
    });

    it('should return empty array when no players found', async () => {
      // Arrange
      vi.spyOn(db, 'query').mockResolvedValue([]);

      // Act
      const result = await playerService.findByCategory(999);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      // Arrange
      vi.spyOn(db, 'query').mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(playerService.findByCategory(1)).rejects.toThrow('DB Error');
    });
  });
});
```

### E2E Test Requirements

**Coverage for critical paths**:
- ✓ Authentication (login, logout, refresh)
- ✓ Match creation and updates
- ✓ Player management (CRUD)
- ✓ Coach analysis
- ✓ File uploads

**Test naming**:

```typescript
test('user should successfully create match and record actions', async () => {
  // Follows: [user role] should [expected outcome]
});
```

## Code Review Checklist

### Before Submitting PR

- [ ] Code passes all linters and formatters
- [ ] TypeScript type checking passes
- [ ] All tests pass (unit + E2E)
- [ ] New code has test coverage (70%+)
- [ ] No console.log statements
- [ ] No hardcoded values or secrets
- [ ] Error handling implemented
- [ ] Performance budget respected
- [ ] Accessibility requirements met (if UI)
- [ ] Documentation updated

### Automated Checks

```yaml
# .github/workflows/quality.yml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run format:check
      - run: npm test -- --coverage
      - run: npm audit --audit-level=moderate
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Naming Conventions

### Files

**Backend**:
```
services/       → player.service.ts
controllers/    → player.controller.ts
repositories/   → player.repository.ts
validators/     → player.validator.ts
middlewares/    → auth.middleware.ts
utils/          → logger.ts
routes/         → player.routes.ts
tests/          → player.service.test.ts
```

**Frontend**:
```
components/     → PlayerCard.tsx
pages/          → players.tsx
hooks/          → usePlayerForm.ts
lib/            → playerApi.ts
styles/         → playerCard.module.css
tests/          → PlayerCard.test.tsx
```

### Variables & Functions

**Constants**:
```typescript
const MAX_PLAYERS_PER_CATEGORY = 20;
const DEFAULT_PAGE_SIZE = 50;
```

**Booleans**:
```typescript
const isLoading = true;
const hasErrors = false;
const canEditMatch = true;
```

**Functions**:
```typescript
// Verb-first for actions
async function fetchPlayers(): Promise<Player[]> {}
function validateEmail(email: string): boolean {}

// Predicate functions
function isActive(user: User): boolean {}
function shouldRetry(attempt: number): boolean {}
```

**Classes & Interfaces**:
```typescript
interface PlayerDTO {
  id: number;
  firstName: string;
}

class PlayerService {
  async findById(id: number): Promise<PlayerDTO> {}
}
```

## Security Standards

### Input Validation

**Never trust user input**:

```typescript
// ❌ Bad: No validation
const player = req.body as Player;

// ✅ Good: Zod validation
const input = getValidated<CreatePlayerBody>(req, 'body');
```

### Secrets Management

**Never commit secrets**:

```typescript
// ❌ Bad
const JWT_SECRET = 'super-secret-key-12345';

// ✅ Good
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET not configured');
}
```

### SQL Injection Prevention

**Use parameterized queries**:

```typescript
// ❌ Bad: Vulnerable
db.query(`SELECT * FROM players WHERE id = ${id}`);

// ✅ Good: Safe
db.query('SELECT * FROM players WHERE id = ?', [id]);
```

## Performance Standards

### Bundle Size

**Targets**:
- Frontend main bundle: < 200KB (gzipped)
- Frontend chunk: < 50KB (gzipped)
- Backend: < 20MB (uncompressed)

**Check bundle size**:

```bash
# Build and analyze
npm run build
npm run analyze

# Check specific dependencies
npm ls <package-name>
```

### Runtime Performance

**API endpoint targets**:
- GET endpoints: p95 < 150ms
- POST endpoints: p95 < 200ms
- Complex operations: p95 < 500ms

**Frontend targets**:
- First Contentful Paint (FCP): < 2s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1

## Documentation Standards

### Code Comments

**Only comment WHY, not WHAT**:

```typescript
// ❌ Bad: Obvious
const count = users.length; // Get user count

// ✅ Good: Explains decision
// Cache results for 5 minutes to reduce database load on popular categories
const cacheKey = `category:${categoryId}`;
```

### Function Documentation

```typescript
/**
 * Fetch players in a specific category with pagination
 * 
 * @param categoryId - Category to fetch players from
 * @param page - Page number (1-indexed)
 * @param limit - Results per page
 * @returns Array of players and pagination info
 * @throws BadRequestError if categoryId is invalid
 */
async function findByCategory(
  categoryId: number,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<Player>> {
  // Implementation
}
```

### README.md Structure

```markdown
# Feature Name

## Overview
Brief description of what this feature does.

## Implementation
How it works, key components.

## Usage
Code example showing how to use.

## Performance
Expected performance characteristics.

## Testing
How to test this feature.
```

## Dependency Management

### Regular Audits

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (use with caution)
npm audit fix

# Check for outdated packages
npm outdated

# Update to latest
npm update
```

### Review Process for New Dependencies

Before adding a dependency:

1. **Check necessity**: Is this really needed?
2. **Check quality**: Github stars, maintenance status, downloads/week
3. **Check security**: npm audit of the package
4. **Check size**: Impact on bundle size
5. **Check alternatives**: Are there lighter alternatives?

### Dependency Policy

- **Prefer**: Built-in Node.js APIs, well-maintained packages
- **Avoid**: Unmaintained packages, bloated packages, duplicates
- **Security**: Audit weekly, update critical patches immediately
- **Lock files**: Always commit package-lock.json / yarn.lock

## Git Workflow

### Commit Messages

**Format**:

```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (not code changes)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Test additions
- `chore`: Build, CI/CD, dependencies

**Examples**:

```
feat: add coach analysis dashboard

Implement new dashboard showing team KPIs including
wins, losses, goals scored, and performance trends.

Closes #42
```

```
fix: prevent N+1 queries in player list

Use batch photo URL generation instead of loading
each photo individually. Reduces coach analysis
from 3s to 500ms with 50 players.

Fixes #89
```

### Branch Naming

```
feature/short-description      # New feature
fix/short-description          # Bug fix
docs/short-description         # Documentation
refactor/short-description     # Code restructuring
perf/short-description         # Performance improvement
```

## Pre-commit Hooks

**Setup**:

```bash
npm install -D husky lint-staged

npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**File**: `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"],
  "src/**/*.test.ts": ["npm test --"]
}
```

## Quality Metrics Dashboard

**Track over time**:

```typescript
interface QualityMetrics {
  testCoverage: number;        // %
  lintScore: number;           // 0-100
  typeCheckPassing: boolean;
  securityIssues: number;
  performanceBudgetCompliance: boolean;
  averageCycloComplexity: number;
  technicalDebt: number;       // days
}

// Weekly report
generateQualityReport().then(metrics => {
  console.log('Test Coverage:', metrics.testCoverage);
  console.log('Security Issues:', metrics.securityIssues);
  console.log('Cyclomatic Complexity:', metrics.averageCycloComplexity);
});
```

## Refactoring Guidelines

### When to Refactor

- After feature is complete and tests pass
- When code becomes difficult to understand
- When similar patterns repeat (DRY principle)
- Before adding new features to the same area
- When performance tests fail

### How to Refactor

1. Write tests (if not already)
2. Make small, incremental changes
3. Run tests after each change
4. Review changes carefully
5. Commit with clear message

### Code Smells to Watch For

- Duplicate code (DRY violation)
- Long functions (> 50 lines)
- Long parameter lists (> 4 parameters)
- Deep nesting (> 3 levels)
- Large classes (> 500 lines)
- High cyclomatic complexity (> 10)

## Code Review Best Practices

### For Reviewers

- ✓ Look for bugs, security issues, performance problems
- ✓ Suggest improvements, but be respectful
- ✓ Approve only when you're confident in the code
- ✓ Check: tests, types, linting, documentation
- ✓ Don't request trivial changes (let formatters handle it)

### For Authors

- ✓ Keep PRs small and focused
- ✓ Write clear commit messages
- ✓ Self-review before submitting
- ✓ Respond to feedback professionally
- ✓ Re-request review after changes

## Continuous Improvement

### Metrics to Track

- Code coverage trend
- Lint warnings count
- Average PR review time
- Bug escape rate (bugs found in production)
- Test flakiness
- Performance metrics

### Monthly Review

1. Analyze code quality metrics
2. Identify patterns in bugs
3. Update standards if needed
4. Share learnings with team
5. Plan improvements

---

**Last Updated**: 2026-10-05  
**Status**: Code quality standards ready for team adoption
