import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

/**
 * GET /api/users/list
 * 
 * PRIVACY: This endpoint exposes user emails and should be admin-only.
 * Changed from requireAuth to requireAdmin to prevent email enumeration.
 * 
 * Note: This endpoint is not currently used in the frontend.
 * The communication feature uses manual email input instead.
 */
export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // PRIVACY FIX: Require admin access to prevent email enumeration
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await connectToDatabase();

    // Get query params
    const { searchParams } = req.nextUrl;
    const role = searchParams.get("role"); // "mentor" or "mentee"

    // Build filter
    const filter: { role: string } = { role: role || "mentor" };

    // Validate role
    if (role && !["mentor", "mentee"].includes(role)) {
      return errors.validation("Invalid role. Must be 'mentor' or 'mentee'");
    }

    // Fetch users with the specified role
    const users = await User.find(filter)
      .select("name email role")
      .sort({ name: 1 })
      .lean();

    // Return safe user data
    const safeUsers = users.map((user) => ({
      id: String(user._id),
      name: user.name,
      fullName: user.name,
      email: user.email,
      role: user.role,
    }));

    return NextResponse.json(
      { users: safeUsers },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("Get users error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching users");
  }
}





