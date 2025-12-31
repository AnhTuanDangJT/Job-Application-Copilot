import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { generateCoverLetterSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isAIAvailable, generateCoverLetter } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.analysis(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, generateCoverLetterSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { jd, resume, tone } = validation.data;
    const selectedTone = tone || "professional";
    
    // Use AI service if available, otherwise return placeholder
    if (isAIAvailable()) {
      try {
        const cover = await generateCoverLetter(jd, resume, selectedTone);
        return NextResponse.json({ cover_letter: cover });
      } catch (aiError) {
        console.error("AI cover letter generation error:", aiError instanceof Error ? aiError.message : "Unknown error");
        // Fall through to placeholder if AI fails
      }
    }
    
    // Fallback placeholder if AI is not available or fails
    const cover = `Dear Hiring Manager,\n\nI am excited to apply...\n\nSincerely,\nYour Candidate`;
    return NextResponse.json({ cover_letter: cover });
  } catch (error) {
    console.error("Generate cover letter error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while generating cover letter");
  }
}


