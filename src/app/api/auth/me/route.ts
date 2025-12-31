import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAuth } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { isAdminEmail } from "@/lib/adminConfig";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");
  
  try {
    await connectToDatabase();
    const user = await User.findById(auth.sub).lean();
    if (!user || Array.isArray(user)) {
      return errors.unauthorized("User not found");
    }
    
    // Determine admin status based on email (not DB role)
    const isAdmin = isAdminEmail(user.email);
    
    // CRITICAL: Role is the SINGLE SOURCE OF TRUTH from database
    // Return the actual DB role (mentee, mentor, or admin)
    // If user is admin by email, return "admin" role for UI display
    // Otherwise return the actual DB role
    let displayRole: "mentee" | "mentor" | "admin" = user.role as "mentee" | "mentor" | "admin";
    
    // Validate role exists and is valid enum value
    if (!["mentee", "mentor", "admin"].includes(displayRole)) {
      console.warn(`[AUTH/ME] Invalid role in DB for user ${user.email}: ${displayRole}. Defaulting to mentee.`);
      displayRole = "mentee";
    }
    
    // If user is admin by email, ensure role is "admin" for UI consistency
    // (DB may have "mentee" or "mentor" but for display we use "admin")
    if (isAdmin) {
      displayRole = "admin";
    }
    
    // Return only safe user data (no password hash, etc.)
    return NextResponse.json(
      {
        id: String(user._id),
        email: user.email,
        role: displayRole, // DB role or "admin" if isAdmin=true
        isAdmin: isAdmin, // Email-based admin status
        name: user.name,
      },
      {
        headers: {
          "Cache-Control": "private, no-store", // Never cache user data
        },
      }
    );
  } catch (error) {
    console.error("Get user error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred");
  }
}


