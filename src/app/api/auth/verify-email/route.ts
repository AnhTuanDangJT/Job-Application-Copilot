import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { verifyPassword, signJwt } from "@/lib/auth";
import { verifyEmailSchema, validateRequestBody } from "@/lib/validation";
import { setAuthCookie } from "@/lib/cookies";
import { errors } from "@/lib/errors";
import { isAdminEmail } from "@/lib/adminConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, verifyEmailSchema);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { email, code } = validation.data;

    await connectToDatabase();

    // Find user by email and include verification fields
    const user = await User.findOne({ email }).select("+emailVerificationCodeHash");

    if (!user) {
      return errors.unauthorized("Invalid email or verification code");
    }

    // If already verified, issue JWT and return success
    if (user.emailVerified) {
      const isAdmin = isAdminEmail(user.email);
      let jwtRole: "mentee" | "mentor";
      if (isAdmin) {
        jwtRole = "mentee";
      } else {
        jwtRole = user.role === "mentor" ? "mentor" : "mentee";
      }

      const token = signJwt({
        sub: String(user._id),
        role: jwtRole,
        isAdmin: isAdmin,
      });

      const displayRole = isAdmin ? "admin" : (user.role as "mentee" | "mentor" | "admin");

      const response = NextResponse.json({
        message: "Email already verified",
        user: {
          id: String(user._id),
          email: user.email,
          role: displayRole,
          isAdmin: isAdmin,
          name: user.name,
        },
      });

      setAuthCookie(response, token);
      return response;
    }

    // Check if verification code exists
    if (!user.emailVerificationCodeHash) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new code." },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Verify the code
    const codeValid = await verifyPassword(code, user.emailVerificationCodeHash);

    if (!codeValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Code is valid - mark email as verified and clear verification fields
    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    // Issue JWT
    const isAdmin = isAdminEmail(user.email);
    let jwtRole: "mentee" | "mentor";
    if (isAdmin) {
      jwtRole = "mentee";
    } else {
      jwtRole = user.role === "mentor" ? "mentor" : "mentee";
    }

    const token = signJwt({
      sub: String(user._id),
      role: jwtRole,
      isAdmin: isAdmin,
    });

    const displayRole = isAdmin ? "admin" : (user.role as "mentee" | "mentor" | "admin");

    const response = NextResponse.json({
      message: "Email verified successfully",
      user: {
        id: String(user._id),
        email: user.email,
        role: displayRole,
        isAdmin: isAdmin,
        name: user.name,
      },
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("[VERIFY-EMAIL] Error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred during email verification");
  }
}


