import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AdminInvite } from "@/models/AdminInvite";
import { requireAdmin } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { sanitizedEmail } from "@/lib/validation";
import { z } from "zod";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/adminConfig";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: sanitizedEmail(),
});

/**
 * POST /api/admin/invite
 * DEPRECATED: Admin invites are no longer used.
 * Admin status is determined ONLY by email matching ADMIN_EMAIL.
 * This endpoint is kept for backward compatibility but will not grant admin access.
 * 
 * Requires: admin email (email-based authorization)
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  // SECURITY: Only admin email can access this endpoint
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) {
    return auth; // Returns 401 or 403
  }

  try {
    await connectToDatabase();

    // Parse and validate request body
    const body = await req.json();
    const validation = inviteSchema.safeParse(body);
    
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return errors.validation(firstError?.message || "Validation error");
    }

    const { email } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // CRITICAL: Admin status is determined ONLY by email, not by role
    // We should NOT set role to "admin" in the database
    // Only ADMIN_EMAIL can be admin
    
    if (isAdminEmail(normalizedEmail)) {
      return NextResponse.json({
        message: "This email is already the admin email",
        email: normalizedEmail,
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    
    if (existingUser) {
      // User exists but is not admin email - cannot grant admin access
      return NextResponse.json({
        message: "Admin access can only be granted to the admin email. Admin status is determined by email, not role.",
        email: normalizedEmail,
      }, { status: 403 });
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await AdminInvite.findOne({
      email: normalizedEmail,
      status: "pending",
    });

    if (existingInvite) {
      return NextResponse.json({
        message: "An admin invite is already pending for this email",
        email: normalizedEmail,
      }, { status: 409 });
    }

    // Create new admin invite
    const invite = await AdminInvite.create({
      email: normalizedEmail,
      invitedByAdminId: auth.sub,
      status: "pending",
    });

    return NextResponse.json({
      message: "Admin invite created successfully",
      invite: {
        id: String(invite._id),
        email: invite.email,
        status: invite.status,
        createdAt: invite.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating admin invite:", error instanceof Error ? error.message : "Unknown error");
    
    if (error instanceof Error) {
      // Check for duplicate key error
      if (error.message.includes("E11000") || error.message.includes("duplicate key")) {
        return NextResponse.json(
          { error: "An invite for this email already exists" },
          { status: 409 }
        );
      }
    }
    
    return errors.internal("Failed to create admin invite");
  }
}



