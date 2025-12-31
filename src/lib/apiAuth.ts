import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, verifyJwt } from "@/lib/auth";
import { getAuthCookie } from "@/lib/cookies";
import { errors } from "@/lib/errors";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { isAdminEmail } from "@/lib/adminConfig";

/**
 * Get authentication token from cookie or Authorization header
 */
function getAuthToken(req: NextRequest): string | null {
  // Try cookie first (preferred method)
  const cookieToken = getAuthCookie(req);
  if (cookieToken) return cookieToken;
  
  // Fall back to Authorization header for backward compatibility
  return getBearerToken(req.headers.get("authorization"));
}

export function requireAuth(req: NextRequest) {
  const token = getAuthToken(req);
  if (!token) return null;
  const payload = verifyJwt(token);
  return payload;
}

export function requireRole(req: NextRequest, roles: string[]) {
  const payload = requireAuth(req);
  if (!payload) return errors.unauthorized("Authentication required");
  
  // Normalize role: JWT should never have "admin" role, only "mentee" or "mentor"
  const jwtRole = payload.role === "admin" ? "mentor" : payload.role;
  
  // Check if user has required role OR is admin (email-based)
  const hasRole = roles.includes(jwtRole);
  const isAdmin = payload.isAdmin === true;
  
  if (!hasRole && !isAdmin) {
    return errors.forbidden("Insufficient permissions");
  }
  
  return payload;
}

/**
 * Require admin access - checks email-based admin status
 * Fetches user from DB to verify email matches ADMIN_EMAIL
 */
export async function requireAdmin(req: NextRequest) {
  const payload = requireAuth(req);
  if (!payload) return errors.unauthorized("Authentication required");
  
  try {
    await connectToDatabase();
    const user = await User.findById(payload.sub).lean();
    if (!user || Array.isArray(user)) {
      return errors.unauthorized("User not found");
    }
    
    // Admin is determined ONLY by email, never by role
    const isAdmin = isAdminEmail(user.email);
    
    if (!isAdmin) {
      return errors.forbidden("Admin access required");
    }
    
    return payload;
  } catch (error) {
    console.error("[requireAdmin] Error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred");
  }
}


