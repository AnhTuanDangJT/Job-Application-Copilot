import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { isAdminEmail, ADMIN_EMAIL } from "@/lib/adminConfig";
import mongoose from "mongoose";

/**
 * DELETE /api/admin/users/:id
 * Delete a user by ID
 * Admin only
 * Cannot delete admin user
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth; // Error response

  try {
    await connectToDatabase();

    const { id: userId } = await params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errors.validation("Invalid user ID");
    }

    // Find user to delete
    const userToDelete = await User.findById(userId).lean();
    if (!userToDelete || Array.isArray(userToDelete)) {
      return errors.notFound("User not found");
    }

    // Prevent deleting admin user
    if (isAdminEmail(userToDelete.email)) {
      return NextResponse.json(
        { error: "Cannot delete admin user" },
        { status: 403 }
      );
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    return NextResponse.json({
      message: "User deleted successfully",
      deletedUserId: userId,
    });
  } catch (error) {
    console.error("[DELETE /api/admin/users/:id] Error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("Failed to delete user");
  }
}


