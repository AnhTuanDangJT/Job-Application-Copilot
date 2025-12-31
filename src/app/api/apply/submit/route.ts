import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { Job } from "@/models/Job";
import { submitApplicationSchema, validateRequestBody, isValidObjectId } from "@/lib/validation";
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

  const validation = await validateRequestBody(req, submitApplicationSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { jobId, resume_version, cover_letter } = validation.data;

  // Validate ObjectId format
  if (!isValidObjectId(jobId)) {
    return errors.validation("Invalid job ID format");
  }

  try {
    await connectToDatabase();
    
    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return errors.notFound("Job not found");
    }

    const application = await Application.create({
      userId: auth.sub,
      jobId,
      resume_version,
      cover_letter,
      status: "submitted",
      dateSubmitted: new Date(),
    });
    
    // Return only safe data
    return NextResponse.json({ id: String(application._id) });
  } catch (error) {
    console.error("Submit application error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while submitting application");
  }
}


