import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { resendVerificationSchema, validateRequestBody } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { errors } from "@/lib/errors";
import { rateLimiters } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting - 1 request per 60 seconds per email
    let rateLimitResult;
    try {
      rateLimitResult = await rateLimiters.auth(req);
      if (!rateLimitResult.success) {
        return rateLimitResult.response;
      }
    } catch (error) {
      // Continue if rate limiting fails (graceful degradation)
      console.warn("[RESEND-VERIFICATION] Rate limiting error (continuing anyway):", error instanceof Error ? error.message : "Unknown error");
    }

    const validation = await validateRequestBody(req, resendVerificationSchema);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { email } = validation.data;

    await connectToDatabase();

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return NextResponse.json({
        message: "If an account with this email exists and is unverified, a verification code has been sent.",
      }, { status: 200 });
    }

    // If already verified, don't send code
    if (user.emailVerified) {
      return NextResponse.json({
        message: "Email is already verified",
      }, { status: 200 });
    }

    // Generate new 6-digit verification code
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

    // Update user with new code
    user.emailVerificationCodeHash = codeHash;
    user.emailVerificationExpiresAt = expiresAt;
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail({
        email: user.email,
        code: verificationCode,
        name: user.name,
      });
      // Never log the actual code
      console.log(`[RESEND-VERIFICATION] Verification email sent to ${user.email}`);
    } catch (emailError) {
      console.error("[RESEND-VERIFICATION] Failed to send verification email:", emailError instanceof Error ? emailError.message : "Unknown error");
      return errors.internal("Failed to send verification email");
    }

    return NextResponse.json({
      message: "Verification code sent",
      email: user.email,
    }, { status: 200 });
  } catch (error) {
    console.error("[RESEND-VERIFICATION] Error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while resending verification code");
  }
}



