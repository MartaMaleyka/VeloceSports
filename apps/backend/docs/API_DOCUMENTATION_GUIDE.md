# API Documentation Guide

This guide explains how to document endpoints in the VeloceSports API using OpenAPI/Swagger.

## Setup

The API documentation is automatically generated from JSDoc comments in route files using `swagger-jsdoc`.

### Where to Add Documentation

1. **Route files** (`src/routes/*.routes.ts`) - Recommended
2. **Controller files** (`src/controllers/*.controller.ts`) - Alternative

## Documentation Format

Use JSDoc comments with OpenAPI-compatible YAML in route files:

### Basic Endpoint Documentation

```typescript
/**
 * @openapi
 * /api/tenant/players:
 *   get:
 *     summary: List all players
 *     description: Retrieve paginated list of players in the academy
 *     tags:
 *       - Players
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Players retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Player'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 */
router.get('/', authenticate, tenant, (req, res, next) =>
  playerController.listPlayers(req, res, next),
);
```

### POST Endpoint with Request Body

```typescript
/**
 * @openapi
 * /api/tenant/players:
 *   post:
 *     summary: Create new player
 *     description: Create a new player in the academy
 *     tags:
 *       - Players
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - jerseyNumber
 *               - dateOfBirth
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Juan
 *               lastName:
 *                 type: string
 *                 example: García
 *               jerseyNumber:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 99
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "2005-06-15"
 *               position:
 *                 type: string
 *                 example: Forward
 *     responses:
 *       201:
 *         description: Player created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Player'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticate, tenant, validate(createPlayerBodySchema),
  (req, res, next) => playerController.createPlayer(req, res, next),
);
```

### Path Parameters

```typescript
/**
 * @openapi
 * /api/tenant/players/{playerId}:
 *   get:
 *     summary: Get player details
 *     tags:
 *       - Players
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: playerId
 *         in: path
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Player details retrieved
 *       404:
 *         description: Player not found
 */
```

## Response Schema Examples

### Standard Success Response
```yaml
type: object
properties:
  success:
    type: boolean
  data:
    type: object
```

### Paginated Response
```yaml
type: object
properties:
  success:
    type: boolean
  data:
    type: array
    items:
      $ref: '#/components/schemas/Player'
  pagination:
    type: object
    properties:
      page:
        type: number
      limit:
        type: number
      total:
        type: number
      pages:
        type: number
```

### Error Response
```yaml
$ref: '#/components/schemas/Error'
```

## Common Tags

Organize endpoints by feature:
- `Players` - Player management
- `Matches` - Match management
- `GameActions` - In-match actions and observations
- `Photos` - Player photo uploads
- `Reports` - Report generation
- `Auth` - Authentication endpoints
- `Academy` - Academy management
- `Dashboard` - Analytics and KPIs

## Testing Documentation

After documenting endpoints, verify:

1. **Syntax**: Ensure YAML is valid
2. **Schema refs**: Verify all `$ref` paths exist
3. **Examples**: Check examples are accurate
4. **Security**: Ensure security requirements are specified

## Accessing Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/api-docs.json
- **ReDoc (alternative UI)**: http://localhost:3000/api-docs-redoc (optional)

## Best Practices

1. **Document as you code**: Add JSDoc comments when creating endpoints
2. **Keep descriptions clear**: Write human-readable summaries
3. **Include examples**: Provide realistic request/response examples
4. **Use consistent tags**: Group related endpoints
5. **Document errors**: List all possible error responses
6. **Validate schemas**: Reference Zod schemas in descriptions
7. **Security**: Always note which endpoints require auth

## Reusing Schemas

Define common schemas in `config/swagger.ts` and reference them:

```typescript
$ref: '#/components/schemas/Player'
$ref: '#/components/schemas/Match'
$ref: '#/components/schemas/Error'
```

## Migration Path

Document high-priority endpoints first:
1. Auth endpoints
2. Player CRUD
3. Match management
4. Game actions
5. Reports

Gradually document remaining endpoints as time permits.
