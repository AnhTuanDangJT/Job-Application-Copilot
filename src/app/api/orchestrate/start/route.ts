import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { runPipeline } from "@/agents/orchestrator";
import { orchestrateStartSchema, validateRequestBody, isValidObjectId } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, orchestrateStartSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { jobId } = validation.data;

  // Validate ObjectId format
  if (!isValidObjectId(jobId)) {
    return errors.validation("Invalid job ID format");
  }

  try {
    const res = await runPipeline({ userId: auth.sub, jobId });
    // Ensure no sensitive data in response
    return NextResponse.json(res);
  } catch (error) {
    console.error("Orchestrate error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while starting pipeline");
  }
}


