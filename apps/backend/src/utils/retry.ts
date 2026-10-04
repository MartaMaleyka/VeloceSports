export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    if (error instanceof Error) {
      // Retry on network errors or specific status codes
      const message = error.message.toLowerCase();
      return (
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('enotfound')
      );
    }
    return false;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!opts.shouldRetry(error) || attempt === opts.maxAttempts) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delayMs = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs,
      );

      await delay(delayMs);
    }
  }

  throw lastError;
}

export function createRetryableFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {},
): T {
  return (async (...args: unknown[]) => {
    return retryWithBackoff(() => fn(...args), options);
  }) as T;
}
