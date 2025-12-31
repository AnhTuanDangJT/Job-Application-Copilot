import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { isAdminEmail } from "@/lib/adminConfig";

/**
 * Get authentication payload from server-side cookies
 * Returns null if not authenticated
 */
export async function getServerAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;
    
    try {
      return verifyJwt(token);
    } catch (jwtError) {
      // If JWT verification fails, treat as unauthenticated
      return null;
    }
  } catch (error) {
    // If cookies() fails or other errors occur, treat as unauthenticated
    console.error("[getServerAuth] Error:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

/**
 * Check if the authenticated user is admin (email-based authorization)
 * Fetches user from database to get email
 * Returns false if not authenticated or not admin
 * 
 * @deprecated Use JWT payload.isAdmin instead when possible
 */
export async function isServerSuperAdmin(): Promise<boolean> {
  try {
    const auth = await getServerAuth();
    if (!auth) return false;

    await connectToDatabase();
    const user = await User.findById(auth.sub).lean();
    if (!user || Array.isArray(user)) return false;

    return isAdminEmail(user.email);
  } catch (error) {
    console.error("[isServerSuperAdmin] Error:", error instanceof Error ? error.message : "Unknown error");
    return false;
  }
}

