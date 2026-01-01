import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { aiResumeFeedbackSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isAIAvailable, getResumeFeedback } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  // Check if AI is available
  if (!isAIAvailable()) {
    return errors.internal("AI service is not configured. Please contact administrator.");
  }

  // Rate limiting
  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const rateLimitResult = await rateLimiters.ai(req, auth.sub);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Validation
  const validation = await validateRequestBody(req, aiResumeFeedbackSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { resumeText } = validation.data;
    
    // Guardrails: Check input length
    if (resumeText.length < 50) {
      return errors.validation("Resume text must be at least 50 characters");
    }

    const feedback = await getResumeFeedback(resumeText);

    return NextResponse.json({ 
      feedback,
    });
  } catch (error) {
    console.error("AI resume feedback error:", error instanceof Error ? error.message : "Unknown error");
    
    // Don't expose internal errors to users
    const errorMessage = error instanceof Error 
      ? (error.message.includes("timeout") 
          ? "AI request timed out. Please try again."
          : "An error occurred while analyzing your resume. Please try again.")
      : "An error occurred while analyzing your resume.";

    return errors.internal(errorMessage);
  }
}



