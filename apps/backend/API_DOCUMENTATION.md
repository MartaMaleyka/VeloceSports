# VeloceSports API Documentation

## Overview

Complete REST API documentation for VeloceSports backend. All endpoints are authenticated with JWT tokens and require tenant context. Base URL: `http://localhost:3001` (development) or `https://api.velocesports.com` (production).

## Authentication

### JWT Bearer Token

All endpoints (except `/auth/login`) require JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <access-token>
```

**Token Types:**
- **Access Token**: 15-minute lifetime, includes userId, role, tenantId, permissions
- **Refresh Token**: 30-day lifetime, stored in HTTP-only cookie, automatically rotated

### Headers

Every request must include:

```
Authorization: Bearer <access-token>
X-Tenant-Id: <tenant-id>
Content-Type: application/json
```

### Token Refresh

**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "correlationId": "req-12345-abcde"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Player fetched |
| 201 | Created | Match created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Player not found |
| 409 | Conflict | Duplicate entry |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limited |
| 500 | Server Error | Database error |

### Common Error Codes

- `AUTHENTICATION_FAILED`: Invalid credentials
- `TOKEN_EXPIRED`: JWT expired
- `INSUFFICIENT_PERMISSIONS`: User lacks required role
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Server error

## Authentication Endpoints

### POST /api/auth/login

**Description**: Authenticate user and receive tokens

**Request**:
```json
{
  "email": "coach@academy.local",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "coach@academy.local",
      "firstName": "John",
      "lastName": "Coach",
      "role": "COACH",
      "tenantIds": [1]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Status Codes**: 200, 401, 429 (rate limited)

**Rate Limit**: 5 attempts per 15 minutes

---

### POST /api/auth/logout

**Description**: Logout and revoke refresh token

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Status Codes**: 200, 401

---

### POST /api/auth/refresh

**Description**: Refresh access token using refresh token cookie

**Request**:
```json
{}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Status Codes**: 200, 401 (refresh token invalid/expired)

---

## Player Management Endpoints

### GET /api/players

**Description**: List all players in tenant

**Query Parameters**:
```
?categoryId=1&page=1&limit=20&search=john
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": 1,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@test.local",
        "jerseyNumber": 10,
        "categoryId": 1,
        "tenantId": 1,
        "photoUrl": "https://minio.example.com/photo-key.jpg",
        "notes": "Striker",
        "createdAt": "2026-10-01T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

**Status Codes**: 200, 401, 403

**Performance**: < 100ms (p95)

---

### POST /api/players

**Description**: Create new player

**Request**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@test.local",
  "jerseyNumber": 10,
  "categoryId": 1,
  "notes": "Striker"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.local",
    "jerseyNumber": 10,
    "categoryId": 1,
    "tenantId": 1,
    "notes": "Striker",
    "createdAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403, 409 (jersey number duplicate)

**Required Role**: ACADEMY_ADMIN

---

### GET /api/players/:id

**Description**: Get player details

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.local",
    "jerseyNumber": 10,
    "categoryId": 1,
    "tenantId": 1,
    "photoUrl": "https://minio.example.com/photo-key.jpg",
    "notes": "Striker",
    "stats": {
      "matchesPlayed": 15,
      "goalsScored": 8,
      "assists": 3
    },
    "createdAt": "2026-10-01T10:00:00Z"
  }
}
```

**Status Codes**: 200, 401, 403, 404

**Performance**: < 80ms

---

### PUT /api/players/:id

**Description**: Update player

**Request**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@test.local",
  "jerseyNumber": 11,
  "notes": "Forward"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.local",
    "jerseyNumber": 11,
    "notes": "Forward",
    "updatedAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 200, 400, 401, 403, 404, 409

**Required Role**: ACADEMY_ADMIN

---

### DELETE /api/players/:id

**Description**: Delete player

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Player deleted"
}
```

**Status Codes**: 200, 401, 403, 404

**Required Role**: ACADEMY_ADMIN

---

## Match Management Endpoints

### GET /api/matches

**Description**: List matches with optional filters

**Query Parameters**:
```
?categoryId=1&status=scheduled&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": 1,
        "categoryId": 1,
        "opponent": "Rival United",
        "matchDatetime": "2026-10-10T14:00:00Z",
        "status": "scheduled",
        "location": "Home Field",
        "notes": "Championship match",
        "playerCount": 11,
        "tenantId": 1,
        "createdAt": "2026-10-04T10:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

**Status Codes**: 200, 401, 403

**Performance**: < 150ms (p95)

---

### POST /api/matches

**Description**: Create match

**Request**:
```json
{
  "categoryId": 1,
  "opponent": "Rival United",
  "matchDatetime": "2026-10-10T14:00:00Z",
  "location": "Home Field",
  "notes": "Championship match"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "categoryId": 1,
    "opponent": "Rival United",
    "matchDatetime": "2026-10-10T14:00:00Z",
    "status": "scheduled",
    "location": "Home Field",
    "notes": "Championship match",
    "tenantId": 1,
    "createdAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403

**Required Role**: COACH

**Performance**: < 200ms

---

### GET /api/matches/:id

**Description**: Get match details with full analysis

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "categoryId": 1,
    "opponent": "Rival United",
    "matchDatetime": "2026-10-10T14:00:00Z",
    "status": "completed",
    "location": "Home Field",
    "notes": "Championship match",
    "score": {
      "our": 3,
      "opponent": 1
    },
    "attendance": 11,
    "actions": [
      {
        "id": 1,
        "playerId": 1,
        "actionCode": "GOAL",
        "timestamp": 1200,
        "notes": "Header from corner"
      }
    ],
    "observations": [
      {
        "id": 1,
        "playerId": 1,
        "text": "Excellent positioning",
        "createdAt": "2026-10-10T15:30:00Z"
      }
    ],
    "tenantId": 1,
    "createdAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 200, 401, 403, 404

**Performance**: < 150ms

---

### PUT /api/matches/:id

**Description**: Update match

**Request**:
```json
{
  "opponent": "New Opponent",
  "status": "in_progress",
  "notes": "Updated notes"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "opponent": "New Opponent",
    "status": "in_progress",
    "notes": "Updated notes",
    "updatedAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 200, 400, 401, 403, 404

**Required Role**: COACH

---

### POST /api/matches/:id/finish

**Description**: Mark match as completed with final score

**Request**:
```json
{
  "scoreOur": 3,
  "scoreOpponent": 1,
  "notes": "Great performance"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "completed",
    "score": {
      "our": 3,
      "opponent": 1
    },
    "updatedAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 200, 400, 401, 403, 404

**Required Role**: COACH

---

## Game Actions Endpoints

### POST /api/matches/:matchId/actions

**Description**: Record game action (goal, assist, yellow card, etc.)

**Request**:
```json
{
  "playerId": 1,
  "actionCode": "GOAL",
  "timestamp": 1200,
  "notes": "Header from corner"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "matchId": 1,
    "playerId": 1,
    "actionCode": "GOAL",
    "timestamp": 1200,
    "notes": "Header from corner",
    "createdAt": "2026-10-10T14:20:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403

**Required Role**: COACH

**Action Codes**: GOAL, ASSIST, YELLOW_CARD, RED_CARD, SUBSTITUTION_IN, SUBSTITUTION_OUT

---

### GET /api/matches/:matchId/actions

**Description**: Get all actions for a match

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": 1,
        "matchId": 1,
        "playerId": 1,
        "playerName": "John Doe",
        "actionCode": "GOAL",
        "timestamp": 1200,
        "notes": "Header from corner",
        "createdAt": "2026-10-10T14:20:00Z"
      }
    ]
  }
}
```

**Status Codes**: 200, 401, 403, 404

**Performance**: < 100ms

---

## Player Observations Endpoints

### POST /api/players/:playerId/observations

**Description**: Add observation for player

**Request**:
```json
{
  "matchId": 1,
  "text": "Excellent positioning and game awareness"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "playerId": 1,
    "matchId": 1,
    "text": "Excellent positioning and game awareness",
    "createdAt": "2026-10-10T15:30:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403

**Required Role**: COACH

---

### GET /api/players/:playerId/observations

**Description**: Get all observations for player

**Query Parameters**:
```
?matchId=1&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "observations": [
      {
        "id": 1,
        "playerId": 1,
        "matchId": 1,
        "matchOpponent": "Rival United",
        "text": "Excellent positioning",
        "createdAt": "2026-10-10T15:30:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

**Status Codes**: 200, 401, 403, 404

---

## Coach Analysis Endpoints

### GET /api/coach-analysis/players

**Description**: Get comprehensive player analysis with stats and photos

**Query Parameters**:
```
?categoryId=1&page=1&limit=50
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": 1,
        "firstName": "John",
        "lastName": "Doe",
        "jerseyNumber": 10,
        "categoryId": 1,
        "photoUrl": "https://minio.example.com/signed-url",
        "stats": {
          "matchesPlayed": 15,
          "goalsScored": 8,
          "assists": 3,
          "yellowCards": 2,
          "redCards": 0
        },
        "recentPerformance": {
          "last5Matches": [
            {
              "matchId": 1,
              "opponent": "Rival United",
              "date": "2026-10-10T14:00:00Z",
              "actions": 5,
              "goals": 1
            }
          ]
        },
        "observations": [
          {
            "text": "Excellent positioning",
            "date": "2026-10-10T15:30:00Z"
          }
        ]
      }
    ],
    "total": 20,
    "page": 1,
    "limit": 50
  }
}
```

**Status Codes**: 200, 401, 403

**Required Role**: COACH, ACADEMY_ADMIN

**Performance**: < 500ms (p95) for 50 players

---

### GET /api/coach-analysis/dashboard

**Description**: Get dashboard KPIs and aggregations

**Query Parameters**:
```
?categoryId=1&dateFrom=2026-01-01&dateTo=2026-12-31
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalMatches": 15,
      "wins": 10,
      "draws": 2,
      "losses": 3,
      "winPercentage": 66.7,
      "totalGoals": 45,
      "goalsPerMatch": 3.0,
      "totalAttendance": 165
    },
    "playerStats": [
      {
        "playerId": 1,
        "playerName": "John Doe",
        "matchesPlayed": 15,
        "goalsScored": 8,
        "assists": 3,
        "averageActions": 4.2
      }
    ],
    "trends": {
      "matchesPerMonth": [
        { "month": "January", "matches": 2, "wins": 1 }
      ],
      "performanceTrend": "improving"
    }
  }
}
```

**Status Codes**: 200, 401, 403

**Required Role**: COACH, ACADEMY_ADMIN

**Performance**: < 300ms (p95)

---

## Match Attendance Endpoints

### POST /api/matches/:matchId/attendance

**Description**: Record player attendance for match

**Request**:
```json
{
  "playerId": 1,
  "status": "present"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "matchId": 1,
    "playerId": 1,
    "status": "present",
    "createdAt": "2026-10-10T13:00:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403

**Status Values**: present, absent, injured, suspended

**Required Role**: COACH

---

### GET /api/matches/:matchId/attendance

**Description**: Get attendance for match

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "attendance": [
      {
        "playerId": 1,
        "playerName": "John Doe",
        "status": "present",
        "recordedAt": "2026-10-10T13:00:00Z"
      }
    ],
    "summary": {
      "present": 11,
      "absent": 2,
      "injured": 1,
      "suspended": 0
    }
  }
}
```

**Status Codes**: 200, 401, 403, 404

---

## Tenant Management Endpoints

### GET /api/tenants/me

**Description**: Get current tenant info

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Academy Sports",
    "slug": "academy-sports",
    "owner": "coach@academy.local",
    "createdAt": "2026-01-01T10:00:00Z",
    "playerCount": 50,
    "matchCount": 15
  }
}
```

**Status Codes**: 200, 401

---

### GET /api/tenants/:id/settings

**Description**: Get tenant settings

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tenantId": 1,
    "language": "en",
    "timezone": "UTC",
    "dateFormat": "YYYY-MM-DD",
    "maxPlayersPerCategory": 20,
    "allowPlayerPhotos": true
  }
}
```

**Status Codes**: 200, 401, 403, 404

**Required Role**: ACADEMY_ADMIN

---

## User Management Endpoints

### POST /api/users

**Description**: Create new user (invite)

**Request**:
```json
{
  "email": "coach@academy.local",
  "firstName": "John",
  "lastName": "Coach",
  "role": "COACH"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "coach@academy.local",
    "firstName": "John",
    "lastName": "Coach",
    "role": "COACH",
    "status": "invited",
    "createdAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 403, 409

**Required Role**: ACADEMY_ADMIN

**Roles**: PLATFORM_ADMIN, ACADEMY_ADMIN, COACH, PARENT, PLAYER

---

### GET /api/users

**Description**: List tenant users

**Query Parameters**:
```
?role=COACH&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "email": "coach@academy.local",
        "firstName": "John",
        "lastName": "Coach",
        "role": "COACH",
        "status": "active",
        "createdAt": "2026-10-01T10:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

**Status Codes**: 200, 401, 403

**Required Role**: ACADEMY_ADMIN

---

### DELETE /api/users/:id

**Description**: Remove user from tenant

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User removed"
}
```

**Status Codes**: 200, 401, 403, 404

**Required Role**: ACADEMY_ADMIN

---

## File Upload Endpoints

### POST /api/files/upload

**Description**: Upload player photo

**Content-Type**: multipart/form-data

**Form Fields**:
- `file`: Image file (JPEG, PNG, WebP)
- `playerId`: Player ID

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "fileKey": "photos/player-1-abc123.jpg",
    "url": "https://minio.example.com/photos/player-1-abc123.jpg",
    "size": 204800,
    "mimeType": "image/jpeg",
    "createdAt": "2026-10-04T10:00:00Z"
  }
}
```

**Status Codes**: 201, 400, 401, 413 (file too large)

**Limits**: Max 5MB per file, JPEG/PNG/WebP only

---

## Rate Limiting

Global rate limits apply:

- **Auth endpoints**: 5 requests per 15 minutes per IP
- **General endpoints**: 100 requests per minute per user
- **File uploads**: 10 requests per minute per user

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633353600
```

Response on rate limit (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 30
  }
}
```

---

## Performance Targets

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| GET /api/matches | 35ms | 150ms | 200ms |
| POST /api/matches | 80ms | 200ms | 300ms |
| GET /api/players | 40ms | 100ms | 150ms |
| GET /api/coach-analysis/players | 150ms | 500ms | 800ms |
| GET /api/coach-analysis/dashboard | 100ms | 300ms | 500ms |
| POST /api/files/upload | 500ms | 2000ms | 5000ms |

---

## Pagination

All list endpoints support pagination:

```
?page=1&limit=20
```

Response includes:
```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## Filtering

Endpoints support field-specific filters:

```
?categoryId=1&status=completed&dateFrom=2026-01-01&dateTo=2026-12-31
```

---

## Sorting

List endpoints support sorting:

```
?sort=createdAt&order=desc
```

Valid sort fields depend on endpoint (see endpoint docs).

---

## OpenAPI/Swagger

**Endpoint**: `GET /api/docs`

Returns OpenAPI 3.0 specification. Use Swagger UI for interactive API exploration:

```
http://localhost:3001/api/docs/swagger
```

---

## Webhooks (Future)

Reserved for future implementation. Will support:
- Match completed
- Player stats updated
- Performance alerts

---

**Last Updated**: 2026-10-04  
**API Version**: 1.0.0  
**Status**: Ready for production
