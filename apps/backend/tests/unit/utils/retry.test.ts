import { retryWithBackoff, createRetryableFunction } from '../../../src/utils/retry.js';

describe('Retry Utilities', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      jest.useFakeTimers();
      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });

      // Fast-forward through delays
      jest.runAllTimers();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Network error'));

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      });

      jest.runAllTimers();

      await expect(promise).rejects.toThrow('Network error');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Not retryable'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        shouldRetry: () => false,
      });

      await expect(promise).rejects.toThrow('Not retryable');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should implement exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const delayTimes: number[] = [];
      const originalSetTimeout = global.setTimeout;
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        delayTimes.push(delay as number);
        return originalSetTimeout(callback, 0);
      });

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });

      jest.runAllTimers();
      await promise;

      // Should have exponential delays: 100ms, 200ms
      expect(delayTimes).toEqual([100, 200]);
    });

    it('should respect maxDelayMs cap', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const delayTimes: number[] = [];
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        delayTimes.push(delay as number);
        return jest.setTimeout(callback, 0);
      });

      const promise = retryWithBackoff(fn, {
        maxAttempts: 4,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      });

      jest.runAllTimers();
      await promise;

      // Delays: 1000, 2000, 4000 (capped at 5000)
      expect(delayTimes).toEqual([1000, 2000, 4000]);
    });

    it('should detect retryable network errors', async () => {
      const errors = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('ENOTFOUND'),
      ];

      for (const error of errors) {
        const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

        const promise = retryWithBackoff(fn, {
          maxAttempts: 2,
          initialDelayMs: 10,
        });

        jest.runAllTimers();
        await promise;

        expect(fn).toHaveBeenCalledTimes(2);
      }
    });

    it('should pass through non-retryable errors immediately', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Validation error'));

      const promise = retryWithBackoff(fn, {
        maxAttempts: 3,
        shouldRetry: (error: unknown) => {
          return error instanceof Error && error.message.includes('Network');
        },
      });

      await expect(promise).rejects.toThrow('Validation error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error objects', async () => {
      const fn = jest.fn().mockRejectedValue('String error');

      const promise = retryWithBackoff(fn, {
        maxAttempts: 2,
      });

      await expect(promise).rejects.toBe('String error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('createRetryableFunction', () => {
    it('should create a retryable wrapper function', async () => {
      const originalFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const retryableFn = createRetryableFunction(originalFn, {
        maxAttempts: 2,
        initialDelayMs: 50,
      });

      const promise = retryableFn('arg1', 'arg2');

      jest.runAllTimers();
      const result = await promise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should preserve function arguments', async () => {
      const originalFn = jest.fn().mockResolvedValue('result');

      const retryableFn = createRetryableFunction(originalFn, {
        maxAttempts: 1,
      });

      await retryableFn('test', 123, { key: 'value' });

      expect(originalFn).toHaveBeenCalledWith('test', 123, { key: 'value' });
    });

    it('should handle async functions', async () => {
      const originalFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'delayed result';
      });

      const retryableFn = createRetryableFunction(originalFn, {
        maxAttempts: 1,
      });

      const result = await retryableFn();

      expect(result).toBe('delayed result');
    });
  });

  describe('Default options', () => {
    it('should use sensible defaults', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(fn);

      jest.runAllTimers();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
