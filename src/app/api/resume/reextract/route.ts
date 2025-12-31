import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

/**
 * Re-extract API endpoint - DISABLED
 * 
 * This endpoint is no longer supported. Resume text is extracted immediately
 * during upload and stored in cv_text. Files are not stored on disk.
 * 
 * If text extraction fails during upload, the upload will be rejected.
 * Users should re-upload their resume if text extraction is needed.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.analysis(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    // Return error - re-extract is disabled
    return NextResponse.json(
      {
        success: false,
        code: "REEXTRACT_DISABLED",
        message: "Re-extract is disabled. Resume text is extracted immediately during upload. Please re-upload your resume if needed.",
      },
      { status: 410 } // 410 Gone - indicates the resource is no longer available
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Re-extract] Unexpected error:", errorMessage);
    return errors.internal("An unexpected error occurred.");
  }
}

