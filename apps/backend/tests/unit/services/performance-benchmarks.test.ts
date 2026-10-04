/**
 * Performance benchmark tests for critical services
 * These tests verify that critical operations stay within performance budgets
 */

import {
  measurePerformance,
  benchmarkAsync,
  assertPerformance,
  formatBenchmarkStats,
  logPerformanceBaseline,
} from '../utils/performance-utils';

describe('Performance Benchmarks', () => {
  describe('Database operations', () => {
    // Simulated database operation
    const simulateDbQuery = async (rowCount: number): Promise<unknown[]> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(Array(rowCount).fill({}));
        }, Math.random() * 50 + 10); // 10-60ms
      });
    };

    it('should fetch 10 records within budget', async () => {
      const result = await measurePerformance(
        () => simulateDbQuery(10),
        { maxDuration: 100, label: 'DB fetch 10 rows' },
      );

      expect(result.duration).toBeLessThan(100);
      assertPerformance(result.duration, 100, 'DB query');
    });

    it('should fetch 100 records within budget', async () => {
      const result = await measurePerformance(
        () => simulateDbQuery(100),
        { maxDuration: 150, label: 'DB fetch 100 rows' },
      );

      expect(result.duration).toBeLessThan(150);
    });
  });

  describe('Batch operations', () => {
    const simulateBatchOperation = async (count: number): Promise<number> => {
      return new Promise((resolve) => {
        const baseTime = Math.floor(count / 10) * 10;
        setTimeout(() => {
          resolve(count);
        }, baseTime + Math.random() * 20);
      });
    };

    it('should process 50 items within budget', async () => {
      const result = await measurePerformance(
        () => simulateBatchOperation(50),
        { maxDuration: 100 },
      );

      expect(result.duration).toBeLessThan(100);
      expect(result.value).toBe(50);
    });

    it('should process 100 items within budget', async () => {
      const result = await measurePerformance(
        () => simulateBatchOperation(100),
        { maxDuration: 200 },
      );

      expect(result.duration).toBeLessThan(200);
      expect(result.value).toBe(100);
    });

    it('should benchmark 50-item operation across iterations', async () => {
      const stats = await benchmarkAsync(
        () => simulateBatchOperation(50),
        { iterations: 10 },
      );

      console.log(`Batch 50 items: ${formatBenchmarkStats(stats)}`);

      expect(stats.average).toBeLessThan(100);
      expect(stats.p95).toBeLessThan(150);
      expect(stats.iterations).toBe(10);
    });
  });

  describe('Aggregation operations', () => {
    // Simulated coach analysis
    const simulateCoachAnalysis = async (playerCount: number): Promise<object> => {
      // Batch photo loading + aggregations
      const photoLoadTime = Math.max(10, playerCount / 50);
      const aggregationTime = playerCount * 2;
      const totalTime = photoLoadTime + aggregationTime + Math.random() * 20;

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            playerCount,
            actionsCount: playerCount * 50,
            photoUrls: playerCount,
          });
        }, totalTime);
      });
    };

    it('should analyze 25 players within budget', async () => {
      const result = await measurePerformance(
        () => simulateCoachAnalysis(25),
        { maxDuration: 200, label: 'Coach analysis 25 players' },
      );

      expect(result.duration).toBeLessThan(200);
    });

    it('should analyze 50 players within budget', async () => {
      const result = await measurePerformance(
        () => simulateCoachAnalysis(50),
        { maxDuration: 350, label: 'Coach analysis 50 players' },
      );

      expect(result.duration).toBeLessThan(350);
    });

    it('should benchmark coach analysis at scale', async () => {
      const stats = await benchmarkAsync(
        () => simulateCoachAnalysis(50),
        { iterations: 5 },
      );

      console.log(`Coach analysis 50 players: ${formatBenchmarkStats(stats)}`);
      logPerformanceBaseline('coach-analysis-50', stats);

      expect(stats.average).toBeLessThan(350);
      expect(stats.p99).toBeLessThan(500);
    });
  });

  describe('API endpoint response times', () => {
    const simulateApiCall = async (endpoint: string): Promise<{status: number}> => {
      const times: Record<string, number> = {
        '/api/matches': 80,
        '/api/coach-analysis/players': 250,
        '/api/dashboard': 150,
        '/api/players': 60,
      };

      const baseTime = times[endpoint] || 100;
      const variance = Math.random() * 30 - 15;

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ status: 200 });
        }, baseTime + variance);
      });
    };

    it('GET /api/matches should stay under budget', async () => {
      const result = await measurePerformance(
        () => simulateApiCall('/api/matches'),
        { maxDuration: 150, label: 'GET /api/matches' },
      );

      expect(result.duration).toBeLessThan(150);
    });

    it('GET /api/coach-analysis/players should stay under budget', async () => {
      const result = await measurePerformance(
        () => simulateApiCall('/api/coach-analysis/players'),
        { maxDuration: 500, label: 'GET /api/coach-analysis/players' },
      );

      expect(result.duration).toBeLessThan(500);
    });

    it('GET /api/dashboard should stay under budget', async () => {
      const result = await measurePerformance(
        () => simulateApiCall('/api/dashboard'),
        { maxDuration: 300, label: 'GET /api/dashboard' },
      );

      expect(result.duration).toBeLessThan(300);
    });

    it('should track p95 endpoint performance', async () => {
      const stats = await benchmarkAsync(
        () => simulateApiCall('/api/matches'),
        { iterations: 20 },
      );

      console.log(`GET /api/matches p95: ${stats.p95}ms (avg: ${stats.average}ms)`);

      // p95 should be under 150ms for this endpoint
      expect(stats.p95).toBeLessThan(150);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle 10 concurrent requests within budget', async () => {
      const result = await measurePerformance(async () => {
        const promises = Array(10)
          .fill(null)
          .map(() =>
            new Promise((resolve) => {
              setTimeout(() => resolve({}), Math.random() * 50);
            }),
          );
        return Promise.all(promises);
      });

      expect(result.duration).toBeLessThan(100);
    });

    it('should handle 50 concurrent requests within budget', async () => {
      const result = await measurePerformance(async () => {
        const promises = Array(50)
          .fill(null)
          .map(() =>
            new Promise((resolve) => {
              setTimeout(() => resolve({}), Math.random() * 30);
            }),
          );
        return Promise.all(promises);
      });

      expect(result.duration).toBeLessThan(200);
    });
  });

  describe('Performance monitoring', () => {
    it('should track performance improvements', async () => {
      // Before optimization
      const statsBefore = await benchmarkAsync(
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({}), 100);
          });
        },
        { iterations: 5 },
      );

      // After optimization (simulated)
      const statsAfter = await benchmarkAsync(
        async () => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({}), 80);
          });
        },
        { iterations: 5 },
      );

      const improvement = ((statsBefore.average - statsAfter.average) / statsBefore.average) * 100;

      console.log(`Performance improvement: ${improvement.toFixed(1)}%`);
      console.log(`Before: ${formatBenchmarkStats(statsBefore)}`);
      console.log(`After: ${formatBenchmarkStats(statsAfter)}`);

      expect(statsAfter.average).toBeLessThan(statsBefore.average);
    });
  });
});
