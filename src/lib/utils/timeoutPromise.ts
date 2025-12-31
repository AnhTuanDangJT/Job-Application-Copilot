/**
 * Wraps a promise with a timeout to prevent hanging operations
 * Ensures the timeout is ALWAYS cleared to prevent memory leaks
 * 
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds (must be positive)
 * @param timeoutMessage - Custom error message for timeout
 * @returns The promise result or throws timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = "Operation timed out"
): Promise<T> {
  // Validate timeout duration
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Invalid timeout duration: ${ms}ms (must be a positive number)`);
  }

  let timeout: NodeJS.Timeout | null = null;
  let timeoutCleared = false;

  // Create timeout promise that ALWAYS resolves or rejects
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      if (!timeoutCleared) {
        timeoutCleared = true;
        reject(new Error(timeoutMessage));
      }
    }, ms);
  });

  try {
    // Race the promise against the timeout
    const result = await Promise.race([promise, timeoutPromise]);
    
    // Clear timeout if promise resolved first
    if (timeout && !timeoutCleared) {
      clearTimeout(timeout);
      timeoutCleared = true;
    }
    
    return result;
  } catch (error) {
    // Clear timeout on error
    if (timeout && !timeoutCleared) {
      clearTimeout(timeout);
      timeoutCleared = true;
    }
    
    // Re-throw the error (could be from promise or timeout)
    throw error;
  } finally {
    // Final safety check - ensure timeout is always cleared
    if (timeout && !timeoutCleared) {
      clearTimeout(timeout);
      timeoutCleared = true;
    }
  }
}

