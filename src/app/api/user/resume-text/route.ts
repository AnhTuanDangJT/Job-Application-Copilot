import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { getResumeText } from "@/lib/resume/getResumeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/user/resume-text
 * Get the authenticated user's stored resume text
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.api(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    // Connect to database
    await connectToDatabase();

    // Get resume text from database
    const resumeText = await getResumeText(auth.sub);

    // Also check if user has cv_filename (resume uploaded but text extraction might have failed)
    const user = await User.findById(auth.sub).select("cv_filename cv_text").lean();
    const hasResumeFile = user && (user as any).cv_filename;

    if (resumeText && resumeText.trim().length > 0) {
      console.log(`[Resume Text API] Found resume text for user ${auth.sub}, length=${resumeText.length}`);
      return NextResponse.json({
        success: true,
        text: resumeText.trim(),
      });
    }

    // No resume text found
    console.log(`[Resume Text API] No resume text found for user ${auth.sub}. Has file: ${hasResumeFile ? 'YES' : 'NO'}`);
    return NextResponse.json({
      success: false,
      text: "",
      hasResumeFile: !!hasResumeFile, // Indicate if file exists but text extraction failed
    });
  } catch (error) {
    console.error("Get resume text error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      success: false,
      text: "",
    });
  }
}

/**
 * PUT /api/user/resume-text
 * Update the authenticated user's resume text
 */
export async function PUT(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.api(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    // Parse request body
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return errors.validation("Resume text is required and cannot be empty");
    }

    // Connect to database
    await connectToDatabase();

    // Update user's resume text
    const updateResult = await User.findByIdAndUpdate(
      auth.sub,
      { cv_text: text.trim() },
      { new: true, runValidators: true }
    );

    if (!updateResult) {
      return errors.notFound("User not found");
    }

    console.log(`[Resume Text API] Updated resume text for user ${auth.sub}, length=${text.trim().length}`);

    return NextResponse.json({
      success: true,
      message: "Resume text updated successfully",
    });
  } catch (error) {
    console.error("Update resume text error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("Failed to update resume text");
  }
}
