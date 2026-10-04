import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AcademyApprovalStatus } from '@velocesport/shared';
import { getPool } from '../../src/config/db.js';
import { accountApprovalService } from '../../src/services/account-approval.service.js';
import { academyRepository } from '../../src/repositories/academy.repository.js';
import { academyService } from '../../src/services/academy.service.js';
import { ValidationError } from '../../src/types/index.js';

describe('AccountApprovalService', () => {
  let testAcademyId: number;

  beforeAll(async () => {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Create test academy with PENDING approval status
      testAcademyId = await academyRepository.create(
        {
          name: 'Test Academy for Approval',
          slug: `test-approval-${Date.now()}`,
          planId: 1,
          timezone: 'UTC',
          locale: 'en',
          currency: 'USD',
          billingAnchorDay: 1,
        },
        conn,
      );

      // Set approval status to PENDING
      await conn.query(
        'UPDATE academies SET approval_status = ? WHERE id = ?',
        [AcademyApprovalStatus.PENDING, testAcademyId],
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

  it('should approve pending account', async () => {
    const result = await accountApprovalService.approveAccount(
      1,
      testAcademyId,
      (id) => academyService.getAcademy(id),
    );

    expect(result).toBeDefined();
    expect(result.approvalStatus).toBe(AcademyApprovalStatus.APPROVED);
  });

  it('should throw error when approving already-approved account', async () => {
    await expect(
      accountApprovalService.approveAccount(
        1,
        testAcademyId,
        (id) => academyService.getAcademy(id),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should reject pending account', async () => {
    // Create new test academy for rejection
    const pool = getPool();
    const conn = await pool.getConnection();
    let rejectTestId: number;

    try {
      await conn.beginTransaction();

      rejectTestId = await academyRepository.create(
        {
          name: 'Test Academy for Rejection',
          slug: `test-reject-${Date.now()}`,
          planId: 1,
          timezone: 'UTC',
          locale: 'en',
          currency: 'USD',
          billingAnchorDay: 1,
        },
        conn,
      );

      await conn.query(
        'UPDATE academies SET approval_status = ? WHERE id = ?',
        [AcademyApprovalStatus.PENDING, rejectTestId],
      );

      await conn.commit();

      const result = await accountApprovalService.rejectAccount(
        1,
        rejectTestId,
        'Test rejection reason',
        (id) => academyService.getAcademy(id),
      );

      expect(result).toBeDefined();
      expect(result.approvalStatus).toBe(AcademyApprovalStatus.REJECTED);
      expect(result.approvalReason).toBe('Test rejection reason');

      // Cleanup
      await conn.query('DELETE FROM academies WHERE id = ?', [rejectTestId]);
    } finally {
      conn.release();
    }
  });
});
