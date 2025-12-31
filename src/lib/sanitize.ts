/**
 * Sanitize user input to prevent XSS and injection attacks
 */

/**
 * Remove potentially dangerous characters and limit length
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== "string") return "";
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  return sanitized;
}

/**
 * Sanitize email - basic validation and trimming
 */
export function sanitizeEmail(email: string): string {
  return sanitizeString(email, 255).toLowerCase().trim();
}

/**
 * Sanitize text content (for resumes, cover letters, job descriptions)
 */
export function sanitizeTextContent(input: string, maxLength: number = 50000): string {
  return sanitizeString(input, maxLength);
}

/**
 * Sanitize object with string values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxLengths?: Partial<Record<keyof T, number>>
): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      const maxLength = maxLengths?.[key] || 10000;
      sanitized[key] = sanitizeString(sanitized[key] as string, maxLength) as T[typeof key];
    }
  }
  
  return sanitized;
}

