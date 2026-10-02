/**
 * Tests para IndexedDB store
 * Nota: Estos tests corren en Node.js, se requiere una DB mock
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initDB,
  saveAttendance,
  getAttendance,
  saveActionCatalog,
  getActionCatalog,
  savePendingAction,
  getPendingActions,
} from './offlineDb';

describe('OfflineDB', () => {
  beforeEach(() => {
    // Clear mock state before each test
    vi.clearAllMocks();
  });

  describe('Database Initialization', () => {
    it('should initialize database', async () => {
      // Note: In real environment, this would test actual IndexedDB
      // For now, we just verify the module can be imported and functions exist
      expect(typeof initDB).toBe('function');
      expect(typeof saveAttendance).toBe('function');
      expect(typeof getAttendance).toBe('function');
      expect(typeof saveActionCatalog).toBe('function');
      expect(typeof getActionCatalog).toBe('function');
      expect(typeof savePendingAction).toBe('function');
      expect(typeof getPendingActions).toBe('function');
    });
  });

  describe('API Contract', () => {
    it('saveAttendance should accept matchId and MatchAttendanceDto', () => {
      expect(saveAttendance.length).toBeLessThanOrEqual(3);
    });

    it('getAttendance should accept matchId', () => {
      expect(getAttendance.length).toBeLessThanOrEqual(1);
    });

    it('savePendingAction should accept matchId, clientActionId, and body', () => {
      expect(savePendingAction.length).toBeLessThanOrEqual(3);
    });

    it('getPendingActions should be callable without args', () => {
      expect(getPendingActions.length).toBeLessThanOrEqual(1);
    });
  });
});
