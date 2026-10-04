# VeloceSports API Documentation

## Overview

VeloceSports API is a RESTful API for managing sports academy operations including players, matches, coaching analysis, and reporting.

**Base URL**: `https://api.velocesports.com/api`

**Documentation**: Available at `/api-docs` (Swagger UI)

## Authentication

All API endpoints (except `/auth/*`) require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Getting a Token

**POST** `/auth/login`
```json
{
  "email": "coach@academy.com",
  "password": "SecurePassword123!"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

## Rate Limiting

All endpoints are subject to rate limiting:

| Endpoint Group | Limit | Window |
|---|---|---|
| Global | 100 requests | 15 minutes |
| Auth (login) | 5 attempts | 15 minutes |
| Photo uploads | 5 uploads | 1 minute |
| Observations | 10 per minute | 1 minute |
| Match actions | 20 per minute | 1 minute |

Rate limit headers are included in responses:
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1696424400
```

## Response Format

All responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "email": ["Invalid email format"],
      "jerseyNumber": ["Must be between 1 and 99"]
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Error Codes

See [ERROR_CODES.md](./ERROR_CODES.md) for detailed error code reference.

## Key Endpoints

### Players
- **GET** `/tenant/players` - List all players
- **POST** `/tenant/players` - Create new player
- **GET** `/tenant/players/:playerId` - Get player details
- **PATCH** `/tenant/players/:playerId` - Update player
- **DELETE** `/tenant/players/:playerId` - Delete player

### Matches
- **GET** `/tenant/matches` - List matches
- **POST** `/tenant/matches` - Create match
- **GET** `/tenant/matches/:matchId` - Get match details
- **PATCH** `/tenant/matches/:matchId` - Update match
- **POST** `/tenant/matches/:matchId/actions` - Record game action
- **PUT** `/tenant/matches/:matchId/attendance` - Save attendance

### Observations
- **GET** `/tenant/matches/players/:playerId/observations` - List observations
- **POST** `/tenant/matches/players/:playerId/observations` - Create observation
- **PATCH** `/tenant/matches/player-observations/:observationId` - Update observation
- **DELETE** `/tenant/matches/player-observations/:observationId` - Delete observation

### Photos
- **POST** `/players/:playerId/photo` - Upload player photo
- **DELETE** `/players/:playerId/photo` - Delete player photo
- **GET** `/players/:playerId/photo-url` - Get photo URL

### Reports
- **POST** `/tenant/reports` - Generate report (PDF/CSV/JSON)
- **GET** `/tenant/reports/:reportId` - Get report details

## Query Parameters

### Pagination
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)

### Filtering
- `status` (string): Filter by status (e.g., ACTIVE, INACTIVE)
- `search` (string): Full-text search

### Sorting
- `sort` (string): Field to sort by
- `order` (string): `asc` or `desc`

Example:
```
GET /tenant/players?page=1&limit=10&sort=lastName&order=asc
```

## Examples

### Create a Player
```bash
curl -X POST https://api.velocesports.com/api/tenant/players \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Juan",
    "lastName": "García",
    "jerseyNumber": 10,
    "dateOfBirth": "2005-06-15",
    "position": "Forward",
    "email": "juan@example.com",
    "parentEmail": "parent@example.com"
  }'
```

### Record Match Action
```bash
curl -X POST https://api.velocesports.com/api/tenant/matches/123/actions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": 456,
    "actionCode": 1,
    "minute": 25,
    "period": 1
  }'
```

### Create Observation
```bash
curl -X POST https://api.velocesports.com/api/tenant/matches/players/456/observations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "observation": "Good ball control and passing accuracy",
    "category": "TECHNICAL",
    "rating": 4
  }'
```

## Webhooks (Coming Soon)

Subscribe to events like:
- `player.created`
- `match.finished`
- `observation.recorded`

## Rate Limit Best Practices

1. **Handle 429 responses**: Implement exponential backoff when hitting rate limits
2. **Check headers**: Always check `RateLimit-Remaining` to avoid hitting limits
3. **Batch operations**: Group requests efficiently to minimize API calls
4. **Cache when possible**: Cache read-only data to reduce request count

## Changelog

### v1.0.0 (2026-10-04)
- Initial API release
- Player management
- Match management
- Game actions and observations
- Photo uploads
- Report generation

## Support

For API issues and support:
- Email: api-support@velocesports.com
- Documentation: https://docs.velocesports.com
- Issues: https://github.com/MartaMaleyka/VeloceSports/issues
