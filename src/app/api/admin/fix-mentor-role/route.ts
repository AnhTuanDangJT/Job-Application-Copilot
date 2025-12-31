import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { ADMIN_EMAIL } from "@/lib/adminConfig";

/**
 * API endpoint to clean up all user roles
 * Only accessible by admin (email-based authorization)
 * 
 * CRITICAL: This ensures ONLY ADMIN_EMAIL can be admin
 * All other users (including mentors) are set to their correct role (mentee or mentor, never admin)
 */
export async function POST(req: NextRequest) {
  try {
    // Only admin email can access this endpoint
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) {
      return auth; // Returns 401 or 403
    }

    await connectToDatabase();

    // Update all users: set role to MENTOR if email != ADMIN_EMAIL
    // This ensures no user has role="admin" except potentially the admin email
    // But even admin email should have role="mentor" or "mentee" - admin status is email-based
    const result = await User.updateMany(
      { email: { $ne: ADMIN_EMAIL } },
      [
        {
          $set: {
            role: {
              $cond: [
                { $eq: ["$role", "mentor"] },
                "mentor",
                "mentee"
              ]
            }
          }
        }
      ]
    );

    // Also ensure admin email doesn't have role="admin" (should be mentor or mentee)
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });
    if (adminUser && adminUser.role === "admin") {
      adminUser.role = "mentor"; // Admin email should have mentor role, admin status is email-based
      await adminUser.save();
    }

    return NextResponse.json({
      message: "User roles cleaned up successfully",
      updated: result.modifiedCount,
      adminEmail: ADMIN_EMAIL,
      note: "Admin status is determined by email, not DB role. All users now have role='mentee' or 'mentor', never 'admin'."
    });
  } catch (error) {
    console.error("Cleanup roles error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while cleaning up roles");
  }
}

