import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { isAdminEmail } from "@/lib/adminConfig";

/**
 * GET /api/admin/users
 * Get all users with filtering by role
 * Admin only
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth; // Error response

  try {
    await connectToDatabase();

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role"); // "mentee" | "mentor" | null (all)

    // Build query
    const query: any = {};
    if (role === "mentee" || role === "mentor") {
      query.role = role;
    }

    // Fetch users (exclude password hash)
    const users = await User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    // Format response
    const formattedUsers = users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: isAdminEmail(user.email), // Email-based admin check
      createdAt: user.createdAt,
    }));

    return NextResponse.json({
      users: formattedUsers,
      total: formattedUsers.length,
    });
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("Failed to fetch users");
  }
}



