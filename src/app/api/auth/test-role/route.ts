/**
 * TEST ENDPOINT: Verify role correctness
 * This endpoint is used for testing role detection from database
 * 
 * Tests:
 * 1. User "Tuan mentor" (dangtuanjt@gmail.com) should return role=MENTOR
 * 2. Admin email should return role=ADMIN
 * 
 * Usage: GET /api/auth/test-role?email=<email>
 * Returns: { email, role, isAdmin, dbRole }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAuth } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { isAdminEmail } from "@/lib/adminConfig";

export async function GET(req: NextRequest) {
  // Only allow authenticated requests for testing
  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");
  
  try {
    await connectToDatabase();
    
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get("email");
    
    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required. Use ?email=<email>" },
        { status: 400 }
      );
    }
    
    const user = await User.findOne({ email }).lean();
    if (!user || Array.isArray(user)) {
      return NextResponse.json(
        { error: "User not found", email },
        { status: 404 }
      );
    }
    
    const isAdmin = isAdminEmail(user.email);
    const dbRole = user.role;
    
    // Determine display role (same logic as /api/auth/me)
    let displayRole: "mentee" | "mentor" | "admin" = user.role as "mentee" | "mentor" | "admin";
    if (!["mentee", "mentor", "admin"].includes(displayRole)) {
      displayRole = "mentee";
    }
    if (isAdmin) {
      displayRole = "admin";
    }
    
    return NextResponse.json({
      email: user.email,
      name: user.name,
      dbRole: dbRole, // Role stored in database
      displayRole: displayRole, // Role returned by /api/auth/me
      isAdmin: isAdmin, // Email-based admin check
      userId: String(user._id),
    });
  } catch (error) {
    console.error("Test role error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred");
  }
}


