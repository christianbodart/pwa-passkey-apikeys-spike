/**
 * Shared test utilities for timeout handling and cleanup
 */

/**
 * Wraps an async operation with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} operationName - Name for error messages
 * @returns {Promise} - The original promise result or timeout error
 */
export async function withTimeout(promise, timeout = 5000, operationName = 'Operation') {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise} - Result of successful operation
 */
export async function retry(fn, maxRetries = 3, initialDelay = 100) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} retries: ${lastError.message}`);
}

/**
 * Ensures cleanup runs even if test fails
 * @param {Function} testFn - Test function to run
 * @param {Function} cleanupFn - Cleanup function
 */
export async function withCleanup(testFn, cleanupFn) {
  try {
    await testFn();
  } finally {
    await cleanupFn();
  }
}

/**
 * Creates a deferred promise for manual resolution
 */
export function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
