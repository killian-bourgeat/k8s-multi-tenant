export interface RetryOptions {
  /** Max attempts before giving up. @default 3 */
  maxAttempts?: number;
  /** Base delay in ms (exponential factor 2^attempt). @default 250 */
  baseMs?: number;
  /** Maximum delay between attempts in ms. @default 5000 */
  maxMs?: number;
}

/**
 * Run `fn`, retrying with exponential backoff + jitter on transient
 * errors (5xx, 429, network issues). Non-retryable errors (4xx) are
 * re-thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const max = options.maxAttempts ?? 3;
  const base = options.baseMs ?? 250;
  const cap = options.maxMs ?? 5000;

  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === max - 1) throw err;
      const backoff = Math.min(cap, base * 2 ** attempt);
      const jitter = Math.random() * backoff;
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
  throw lastErr;
}

export function isRetryable(err: any): boolean {
  const status = err?.response?.statusCode ?? err?.statusCode;
  if (status && (status >= 500 || status === 429)) return true;
  const code = err?.code;
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN'
  ) {
    return true;
  }
  return false;
}
