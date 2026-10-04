/**
 * Performance testing utilities for benchmarking critical paths
 */

export interface PerformanceResult<T> {
  value: T;
  duration: number; // milliseconds
  startTime: number;
  endTime: number;
}

export interface PerformanceOptions {
  maxDuration?: number; // milliseconds
  label?: string;
}

/**
 * Measure the duration of an async function
 * @example
 * const result = await measurePerformance(async () => {
 *   return await heavyOperation();
 * });
 * console.log(`Took ${result.duration}ms`);
 */
export async function measurePerformance<T>(
  fn: () => Promise<T>,
  options: PerformanceOptions = {},
): Promise<PerformanceResult<T>> {
  const startTime = Date.now();
  const value = await fn();
  const endTime = Date.now();
  const duration = endTime - startTime;

  if (options.maxDuration && duration > options.maxDuration) {
    console.warn(
      `Performance warning${options.label ? ` (${options.label})` : ''}: ` +
      `took ${duration}ms, expected < ${options.maxDuration}ms`,
    );
  }

  return {
    value,
    duration,
    startTime,
    endTime,
  };
}

/**
 * Measure sync function performance
 */
export function measurePerformanceSync<T>(
  fn: () => T,
  options: PerformanceOptions = {},
): PerformanceResult<T> {
  const startTime = Date.now();
  const value = fn();
  const endTime = Date.now();
  const duration = endTime - startTime;

  if (options.maxDuration && duration > options.maxDuration) {
    console.warn(
      `Performance warning${options.label ? ` (${options.label})` : ''}: ` +
      `took ${duration}ms, expected < ${options.maxDuration}ms`,
    );
  }

  return {
    value,
    duration,
    startTime,
    endTime,
  };
}

/**
 * Run a function multiple times and get statistics
 * @example
 * const stats = await benchmarkAsync(
 *   () => db.query('SELECT ...'),
 *   { iterations: 100 }
 * );
 * console.log(`Avg: ${stats.average}ms, Min: ${stats.min}ms, Max: ${stats.max}ms`);
 */
export interface BenchmarkStats {
  iterations: number;
  average: number;
  min: number;
  max: number;
  total: number;
  p50: number; // median
  p95: number;
  p99: number;
  standardDeviation: number;
}

export async function benchmarkAsync<T>(
  fn: () => Promise<T>,
  options: { iterations?: number } = {},
): Promise<BenchmarkStats> {
  const iterations = options.iterations ?? 10;
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const perf = await measurePerformance(fn);
    results.push(perf.duration);
  }

  return calculateStats(results);
}

/**
 * Run sync function multiple times and get statistics
 */
export function benchmarkSync<T>(
  fn: () => T,
  options: { iterations?: number } = {},
): BenchmarkStats {
  const iterations = options.iterations ?? 10;
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const perf = measurePerformanceSync(fn);
    results.push(perf.duration);
  }

  return calculateStats(results);
}

/**
 * Calculate statistics from performance measurements
 */
export function calculateStats(durations: number[]): BenchmarkStats {
  if (durations.length === 0) {
    throw new Error('No durations provided');
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const average = total / durations.length;

  // Calculate standard deviation
  const squaredDiffs = durations.map(d => Math.pow(d - average, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / durations.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    iterations: durations.length,
    average: Math.round(average * 10) / 10,
    min: Math.min(...durations),
    max: Math.max(...durations),
    total,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    standardDeviation: Math.round(standardDeviation * 10) / 10,
  };
}

/**
 * Assert that a value is below a threshold
 * @example
 * assertPerformance(result.duration, 200, 'API response time');
 */
export function assertPerformance(
  actual: number,
  expected: number,
  label?: string,
): void {
  if (actual > expected) {
    throw new Error(
      `Performance assertion failed${label ? ` (${label})` : ''}: ` +
      `${actual}ms > ${expected}ms`,
    );
  }
}

/**
 * Assert percentile performance
 * @example
 * const stats = await benchmarkAsync(fn, { iterations: 100 });
 * assertPercentile(stats.p95, 200, 'p95 response time');
 */
export function assertPercentile(
  actual: number,
  expected: number,
  label?: string,
): void {
  if (actual > expected) {
    throw new Error(
      `Percentile assertion failed${label ? ` (${label})` : ''}: ` +
      `${actual}ms > ${expected}ms`,
    );
  }
}

/**
 * Format performance result for logging
 */
export function formatPerformanceResult(result: PerformanceResult<unknown>): string {
  return `${result.duration}ms`;
}

/**
 * Format benchmark stats for logging
 */
export function formatBenchmarkStats(stats: BenchmarkStats): string {
  return (
    `Avg: ${stats.average}ms, ` +
    `Min: ${stats.min}ms, ` +
    `Max: ${stats.max}ms, ` +
    `p95: ${stats.p95}ms, ` +
    `p99: ${stats.p99}ms`
  );
}

/**
 * Log performance baseline for tracking
 */
export function logPerformanceBaseline(label: string, stats: BenchmarkStats): void {
  console.log(`[PERF BASELINE] ${label}`);
  console.log(`  Iterations: ${stats.iterations}`);
  console.log(`  Average: ${stats.average}ms`);
  console.log(`  Min: ${stats.min}ms`);
  console.log(`  Max: ${stats.max}ms`);
  console.log(`  p95: ${stats.p95}ms`);
  console.log(`  p99: ${stats.p99}ms`);
  console.log(`  StdDev: ${stats.standardDeviation}ms`);
}
