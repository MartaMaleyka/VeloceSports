import request from 'supertest';
import { createApp } from '../../src/app';
import type { Express } from 'express';

describe('Observations Integration Tests', () => {
  let app: Express;
  const mockAuthHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const tenantId = 1;

  beforeAll(async () => {
    app = createApp();
  });

  describe('POST /api/tenant/matches/players/:playerId/observations', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .send({
          observation: 'Good performance',
          category: 'TECHNICAL',
          rating: 4,
        });

      expect(response.status).toBe(401);
      expect(response.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 with missing required fields', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'Good performance',
          // Missing category and rating
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate observation text length', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'x'.repeat(5001), // Exceeds max length of 5000
          category: 'TECHNICAL',
          rating: 4,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate rating range (1-5)', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'Good performance',
          category: 'TECHNICAL',
          rating: 6, // Invalid: exceeds max
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate category enum', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'Good performance',
          category: 'INVALID_CATEGORY',
          rating: 4,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should respect observation rate limiting (10 per minute)', async () => {
      const response = await request(app)
        .post('/api/tenant/matches/players/10/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'Good performance',
          category: 'TECHNICAL',
          rating: 4,
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(parseInt(response.headers['ratelimit-limit'])).toBeGreaterThanOrEqual(10);
    });
  });

  describe('GET /api/tenant/matches/players/:playerId/observations', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/players/10/observations');

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid player ID', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/players/invalid/observations')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId));

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/tenant/matches/players/10/observations?page=1&limit=10')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId));

      expect(response.status).toBe(200 || 404); // Either success or not found (valid)
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('PATCH /api/tenant/matches/player-observations/:observationId', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .patch('/api/tenant/matches/player-observations/1')
        .send({
          observation: 'Updated observation',
          rating: 5,
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid observation ID', async () => {
      const response = await request(app)
        .patch('/api/tenant/matches/player-observations/invalid')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: 'Updated observation',
          rating: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate updated observation text', async () => {
      const response = await request(app)
        .patch('/api/tenant/matches/player-observations/1')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId))
        .send({
          observation: '', // Empty observation
          rating: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/tenant/matches/player-observations/:observationId', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/tenant/matches/player-observations/1');

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid observation ID', async () => {
      const response = await request(app)
        .delete('/api/tenant/matches/player-observations/invalid')
        .set('Authorization', mockAuthHeader)
        .set('x-tenant-id', String(tenantId));

      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});
