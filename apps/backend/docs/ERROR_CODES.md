# VeloceSports Error Codes Reference

Standard error codes used throughout the API for client-side handling and user messaging.

## Client Errors (4xx)

### Validation Errors (400)
- `VALIDATION_ERROR` - Request validation failed (Zod schema validation)
- `INVALID_EMAIL` - Email format is invalid
- `INVALID_PASSWORD` - Password doesn't meet security requirements
- `INVALID_DATE` - Date format is incorrect
- `INVALID_ENUM` - Value is not in allowed enum

### Authentication (401)
- `UNAUTHORIZED` - Missing or invalid authentication credentials
- `TOKEN_EXPIRED` - JWT token has expired
- `TOKEN_INVALID` - JWT token is malformed or invalid
- `SESSION_EXPIRED` - User session has expired

### Forbidden (403)
- `FORBIDDEN` - User lacks required permissions
- `RBAC_DENIED` - Role-based access control denied the request
- `TENANT_MISMATCH` - User is not part of the requested tenant
- `RESOURCE_LOCKED` - Resource is locked and cannot be modified

### Not Found (404)
- `NOT_FOUND` - Resource does not exist
- `ACADEMY_NOT_FOUND` - Requested academy not found
- `USER_NOT_FOUND` - Requested user not found
- `PLAYER_NOT_FOUND` - Requested player not found
- `MATCH_NOT_FOUND` - Requested match not found

### Conflict (409)
- `CONFLICT` - Operation conflicts with existing data
- `DUPLICATE_EMAIL` - Email is already registered
- `DUPLICATE_SLUG` - Slug is already in use
- `DUPLICATE_JERSEY_NUMBER` - Jersey number already assigned
- `PLAYER_ALREADY_EXISTS` - Player with these details already exists

### Validation / Business Logic (422)
- `INVALID_STATE_TRANSITION` - Cannot transition to requested state
- `INVALID_OPERATION` - Operation is not allowed in current state
- `MISSING_REQUIRED_FIELD` - Required field is missing
- `INVALID_FIELD_VALUE` - Field value is invalid for business logic
- `USE_REACTIVATE_ENDPOINT` - Must use reactivate endpoint for this action

### Payment Required (402)
- `PLAN_LIMIT_EXCEEDED` - User has reached plan limit
- `PAYMENT_REQUIRED` - Payment is required to proceed
- `SUBSCRIPTION_EXPIRED` - Subscription has expired

## Server Errors (5xx)

### Internal Server Error (500)
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed
- `EXTERNAL_SERVICE_ERROR` - External service integration failed
- `FILE_OPERATION_ERROR` - File operation failed
- `EMAIL_SERVICE_ERROR` - Email sending failed

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "fieldName": ["Specific validation message"]
    },
    "requestId": "correlation-id-uuid"
  }
}
```

## Using Error Codes in Clients

1. **Show localized messages**: Map error codes to translated strings
2. **Handle programmatically**: Use code to determine retry logic or UI state
3. **Log for debugging**: Include requestId when reporting issues
4. **User feedback**: Use message for display, code for app logic

Example:
```typescript
try {
  await api.updateAcademy(academyId, data);
} catch (error) {
  if (error.code === 'DUPLICATE_SLUG') {
    showError('This identifier is already in use');
  } else if (error.code === 'VALIDATION_ERROR') {
    showValidationErrors(error.details);
  } else {
    showError('An unexpected error occurred');
  }
}
```
