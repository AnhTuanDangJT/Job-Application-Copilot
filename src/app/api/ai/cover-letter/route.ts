import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { aiCoverLetterSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isAIAvailable, generateCoverLetter } from "@/lib/aiService";

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
  const validation = await validateRequestBody(req, aiCoverLetterSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { jobDescription, resumeText, tone } = validation.data;
    
    // Guardrails: Check input lengths
    if (jobDescription.length < 50) {
      return errors.validation("Job description must be at least 50 characters");
    }
    if (resumeText.length < 50) {
      return errors.validation("Resume text must be at least 50 characters");
    }

    const coverLetter = await generateCoverLetter(
      jobDescription,
      resumeText,
      tone || "professional"
    );

    return NextResponse.json({ 
      cover_letter: coverLetter,
    });
  } catch (error) {
    console.error("AI cover letter error:", error instanceof Error ? error.message : "Unknown error");
    
    // Don't expose internal errors to users
    const errorMessage = error instanceof Error 
      ? (error.message.includes("timeout") 
          ? "AI request timed out. Please try again."
          : "An error occurred while generating the cover letter. Please try again.")
      : "An error occurred while generating the cover letter.";

    return errors.internal(errorMessage);
  }
}



