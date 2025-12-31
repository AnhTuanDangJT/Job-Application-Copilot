/**
 * ADMIN_EMAIL - The ONLY email that can have admin privileges
 * 
 * This is the single source of truth for admin authorization.
 * NEVER use role === "admin" for authorization checks.
 * ALWAYS use: user.email === ADMIN_EMAIL
 */
export const ADMIN_EMAIL = "dangtuananh04081972@gmail.com";

/**
 * Check if an email is the admin email
 * This is the ONLY way to determine admin status - email-based authorization only
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * @deprecated Use ADMIN_EMAIL and isAdminEmail() instead
 * Kept for backward compatibility during migration
 */
export const SUPER_ADMIN_EMAIL = ADMIN_EMAIL;

/**
 * @deprecated Use isAdminEmail() instead
 * Kept for backward compatibility during migration
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}

/**
 * @deprecated This whitelist is no longer used. Use ADMIN_EMAIL constant instead.
 */
export const ADMIN_EMAILS: string[] = [];




