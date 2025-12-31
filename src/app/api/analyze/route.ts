import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { analyzeSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { extractResumeSkills, extractJobRequirements, calculateMatchScore } from "@/lib/skills/matchScore";
import { isAIAvailable } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.analysis(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, analyzeSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { resume, jd } = validation.data;

    // Use AI-driven match score calculation
    if (!isAIAvailable()) {
      // Fallback to simple calculation if AI is not available
      const r = resume.toLowerCase();
      const j = jd.toLowerCase();
      let score = 0;
      const keywords = ["typescript", "react", "node", "python", "data", "cloud"];
      for (const k of keywords) {
        if (r.includes(k) && j.includes(k)) score += 1;
      }
      const match = keywords.length > 0 ? Math.round((score / keywords.length) * 100) : 0;
      return NextResponse.json({ match });
    }

    // Extract skills from resume
    const resumeSkills = await extractResumeSkills(resume);

    // Extract job requirements
    const jobRequirements = await extractJobRequirements(jd);

    // Calculate match score using AI-driven calculation
    const match = calculateMatchScore(
      resumeSkills,
      jobRequirements.requiredSkills,
      jobRequirements.preferredSkills
    );

    return NextResponse.json({ match });
  } catch (error) {
    console.error("Analyze error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal(
      error instanceof Error ? error.message : "An error occurred during analysis"
    );
  }
}


