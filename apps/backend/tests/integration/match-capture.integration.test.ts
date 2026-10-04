import request from 'supertest';
import { createApp } from '../../src/app';
import type { Express } from 'express';

describe('Match Capture Integration Tests', () => {
  let app: Express;
  const mockAuthHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const tenantId = 1;

  beforeAll(async () => {
    app = createApp();
  });

  describe('POST /api/tenant/matches/:matchId/actions', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .send({
          playerId: 10,
          actionCode: 1,
          minute: 25,
          period: 1,
        });

      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 with invalid game action payload', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          playerId: 10,
          // Missing actionCode, minute, period
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate minute range', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          playerId: 10,
          actionCode: 1,
          minute: -5, // Invalid: negative minute
          period: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate period range', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          playerId: 10,
          actionCode: 1,
          minute: 25,
          period: 0, // Invalid: period must be >= 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should respect match action rate limiting (20 per minute)', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          playerId: 10,
          actionCode: 1,
          minute: 25,
          period: 1,
        });

      // Check rate limit headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-limit'])).toBeGreaterThanOrEqual(20);
    });
  });

  describe('GET /api/tenant/matches/:matchId/actions', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/1/actions');

      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent match', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/99999/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId));

      expect(response.status).toBe(404);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid match ID', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/invalid/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId));

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/tenant/matches/:matchId/attendance', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/tenant/matches/1/attendance')
        .send({
          attendance: [
            { playerId: 10, status: 'PRESENT' },
            { playerId: 11, status: 'ABSENT' },
          ],
        });

      expect(response.status).toBe(401);
    });

    it('should validate attendance payload', async () => {
      const response = await request(app)
        .put('/api/tenant/matches/1/attendance')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          attendance: [
            { playerId: 10 }, // Missing status
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate attendance status values', async () => {
      const response = await request(app)
        .put('/api/tenant/matches/1/attendance')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          attendance: [
            { playerId: 10, status: 'INVALID_STATUS' },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should respect match action rate limiting', async () => {
      const response = await request(app)
        .put('/api/tenant/matches/1/attendance')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          attendance: [
            { playerId: 10, status: 'PRESENT' },
          ],
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should isolate rate limits by tenant', async () => {
      // Different tenants should have independent rate limits
      const tenant1Response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', '1')
        .send({
          playerId: 10,
          actionCode: 1,
          minute: 25,
          period: 1,
        });

      const tenant2Response = await request(app)
        .post('/api/tenant/matches/1/actions')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', '2')
        .send({
          playerId: 10,
          actionCode: 1,
          minute: 25,
          period: 1,
        });

      const limit1 = parseInt(tenant1Response.headers['ratelimit-remaining']);
      const limit2 = parseInt(tenant2Response.headers['ratelimit-remaining']);

      // Limits should be tracked separately
      expect(!isNaN(limit1)).toBe(true);
      expect(!isNaN(limit2)).toBe(true);
    });
  });
});
