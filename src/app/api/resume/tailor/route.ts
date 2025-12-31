import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { tailorResumeSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.analysis(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, tailorResumeSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { resume, jd } = validation.data;

    // TODO: Use jd to tailor the resume
    // Placeholder: prepend a targeted summary
    const tailored = `Summary: Tailored for this JD.\n\n${resume}`;
    return NextResponse.json({ resume: tailored });
  } catch (error) {
    console.error("Tailor resume error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while tailoring resume");
  }
}


