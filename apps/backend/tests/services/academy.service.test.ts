import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getPool } from '../../src/config/db.js';
import { academyService } from '../../src/services/academy.service.js';
import { academyRepository } from '../../src/repositories/academy.repository.js';
import { NotFoundError } from '../../src/types/index.js';

describe('AcademyService', () => {
  let testAcademyId: number;

  beforeAll(async () => {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Create test academy
      testAcademyId = await academyRepository.create(
        {
          name: 'Test Academy for Service Tests',
          slug: `test-academy-${Date.now()}`,
          planId: 1,
          timezone: 'UTC',
          locale: 'en',
          currency: 'USD',
          billingAnchorDay: 1,
        },
        conn,
      );

      await conn.commit();
    } finally {
      conn.release();
    }
  });

  afterAll(async () => {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      if (testAcademyId) {
        await conn.query('DELETE FROM academies WHERE id = ?', [testAcademyId]);
      }
    } finally {
      conn.release();
    }
  });

  it('should get academy by ID', async () => {
    const academy = await academyService.getAcademy(testAcademyId);
    expect(academy).toBeDefined();
    expect(academy.id).toBe(testAcademyId);
    expect(academy.name).toBe('Test Academy for Service Tests');
  });

  it('should get current academy for tenant', async () => {
    const academy = await academyService.getCurrentAcademy(testAcademyId);
    expect(academy).toBeDefined();
    expect(academy.id).toBe(testAcademyId);
  });

  it('should throw NotFoundError for non-existent academy', async () => {
    await expect(academyService.getAcademy(99999)).rejects.toThrow(NotFoundError);
  });

  it('should list academies', async () => {
    const academies = await academyService.listAcademies();
    expect(Array.isArray(academies)).toBe(true);
    expect(academies.length).toBeGreaterThan(0);
  });

  it('should update academy', async () => {
    const updated = await academyService.updateAcademy(1, testAcademyId, {
      name: 'Updated Test Academy',
    });
    expect(updated.name).toBe('Updated Test Academy');
  });
});
