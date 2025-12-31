import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { AdminInvite } from "@/models/AdminInvite";
import { hashPassword } from "@/lib/auth";
import { registerSchema, validateRequestBody } from "@/lib/validation";
import { errors } from "@/lib/errors";
import { rateLimiters } from "@/lib/rateLimit";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/adminConfig";
import { sendVerificationEmail } from "@/lib/email";

// Ensure this route always runs in Node.js runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Check environment variables
    const mongoUri = process.env.MONGODB_URI;
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!mongoUri || !jwtSecret) {
      return errors.internal("Server configuration error");
    }

    // Rate limiting
    try {
      const rateLimitResult = await rateLimiters.auth(req);
      if (!rateLimitResult.success) {
        return rateLimitResult.response;
      }
    } catch (rateLimitError) {
      // Continue if rate limiting fails (graceful degradation)
    }

    // Parse and validate request body
    const validation = await validateRequestBody(req, registerSchema);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { name, email, password, role } = validation.data;
    
    // SECURITY: Reject admin role from frontend - admin can only be set via whitelist or invite
    if (role === "admin") {
      return NextResponse.json(
        { error: "Admin role cannot be set during registration" },
        { status: 403 }
      );
    }
    
    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError) {
      if (dbError instanceof Error) {
        if (dbError.message.includes("ECONNREFUSED") || dbError.message.includes("connect")) {
          return NextResponse.json(
            { error: "Database Connection Failed", message: "Cannot connect to MongoDB" },
            { status: 503 }
          );
        }
        if (dbError.message.includes("timeout") || dbError.message.includes("serverSelectionTimeoutMS")) {
          return NextResponse.json(
            { error: "Database Connection Timeout", message: "MongoDB connection timed out" },
            { status: 503 }
          );
        }
      }
      return errors.internal("Database error");
    }

    // Check if user exists
    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    } catch (dbQueryError) {
      return errors.internal("Database error occurred while checking user");
    }

    // CRITICAL: Admin status is determined ONLY by email, not by role
    // NEVER set role to "admin" in the database
    // Only ADMIN_EMAIL can be admin, and that's determined by email check, not DB role
    
    // Determine user role: mentee or mentor (never admin)
    let userRole: "mentee" | "mentor" = role === "mentor" ? "mentor" : "mentee";
    
    // CRITICAL: Admin email should NEVER be mentor - Admin is NOT a mentor
    // Admin must have "mentee" role in DB (or we could use a separate "admin" role, but we use "mentee" for simplicity)
    // Admin status is determined by email check, not DB role
    if (isAdminEmail(email)) {
      // Force admin to be "mentee" role in DB - Admin is NOT a mentor
      userRole = "mentee";
      console.log("[REGISTER] Admin email registering - forcing role to 'mentee' (Admin is NOT a mentor)");
    }
    
    // Hash password
    let passwordHash;
    try {
      passwordHash = await hashPassword(password);
    } catch (hashError) {
      return errors.internal("Failed to process password");
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash verification code
    let codeHash;
    try {
      codeHash = await hashPassword(verificationCode);
    } catch (hashError) {
      return errors.internal("Failed to generate verification code");
    }

    // Set expiration (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create user
    try {
      const user = await User.create({ 
        name, 
        email, 
        passwordHash, 
        role: userRole,
        emailVerified: false,
        emailVerificationCodeHash: codeHash,
        emailVerificationExpiresAt: expiresAt
      });

      // Send verification email
      try {
        await sendVerificationEmail({
          email: user.email,
          code: verificationCode,
          name: user.name,
        });
        // Never log the actual code - only log that email was sent
        console.log(`[REGISTER] Verification email sent to ${user.email}`);
      } catch (emailError) {
        // If email fails, still create user but log the error
        console.error("[REGISTER] Failed to send verification email:", emailError instanceof Error ? emailError.message : "Unknown error");
        // Continue - user can request resend later
      }

      // Note: Admin invites are deprecated - admin status is email-based only
      // DO NOT issue JWT - user must verify email first

      return NextResponse.json({
        message: "Verification code sent",
        email: user.email,
      }, { status: 201 });
    } catch (createError) {
      if (createError instanceof Error) {
        // Check for duplicate key error (MongoDB)
        if (createError.message.includes("E11000") || createError.message.includes("duplicate key")) {
          return NextResponse.json({ error: "Email already in use" }, { status: 409 });
        }
      }
      return errors.internal("Failed to create user account");
    }
    
  } catch (error) {
    console.error("Registration error:", error instanceof Error ? error.message : "Unknown error");
    
    if (error instanceof Error) {
      return errors.internal(error.message);
    }
    return errors.internal("An error occurred during registration");
  }
}
