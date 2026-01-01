import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/apiAuth";
import { aiAnnouncementRewriteSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isAIAvailable, rewriteAnnouncement } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  // Check if AI is available
  if (!isAIAvailable()) {
    return errors.internal("AI service is not configured. Please contact administrator.");
  }

  // Rate limiting
  const authResult = requireRole(req, ["mentor", "admin"]);
  if (authResult instanceof NextResponse) {
    return authResult; // Error response
  }
  const auth = authResult;

  const rateLimitResult = await rateLimiters.ai(req, auth.sub);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Validation
  const validation = await validateRequestBody(req, aiAnnouncementRewriteSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { draftText } = validation.data;
    
    // Guardrails: Check input length
    if (draftText.length < 10) {
      return errors.validation("Draft text must be at least 10 characters");
    }

    const rewritten = await rewriteAnnouncement(draftText);

    return NextResponse.json({ 
      rewritten,
    });
  } catch (error) {
    console.error("AI announcement rewrite error:", error instanceof Error ? error.message : "Unknown error");
    
    // Don't expose internal errors to users
    const errorMessage = error instanceof Error 
      ? (error.message.includes("timeout") 
          ? "AI request timed out. Please try again."
          : "An error occurred while rewriting the announcement. Please try again.")
      : "An error occurred while rewriting the announcement.";

    return errors.internal(errorMessage);
  }
}



