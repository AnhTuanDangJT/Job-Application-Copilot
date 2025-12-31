import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { ADMIN_EMAIL } from "@/lib/adminConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/admins
 * List admin user (email-based)
 * Requires: admin email
 * 
 * Note: Admin status is determined by email, not DB role.
 * Only ADMIN_EMAIL can be admin.
 */
export async function GET(req: NextRequest) {
  // SECURITY: Only admin email can access this endpoint
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) {
    return auth; // Returns 401 or 403
  }

  try {
    await connectToDatabase();
    
    // Find admin user by email (not by role)
    const adminUser = await User.findOne({ email: ADMIN_EMAIL })
      .select("name email role createdAt")
      .lean();

    if (!adminUser) {
      return NextResponse.json({
        admins: [],
        message: "Admin user not found in database"
      });
    }

    return NextResponse.json({
      admins: [{
        id: String(adminUser._id),
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role, // Should be "mentor" or "mentee", not "admin"
        isAdmin: true, // Admin status is email-based
        createdAt: adminUser.createdAt,
      }],
      note: "Admin status is determined by email, not DB role. Only one admin email exists."
    });
  } catch (error) {
    console.error("Error fetching admins:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("Failed to fetch admins");
  }
}




