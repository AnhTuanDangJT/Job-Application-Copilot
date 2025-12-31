import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { requireAuth } from "@/lib/apiAuth";
import { isValidObjectId } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Server-side guard
    if (typeof window !== "undefined") {
      throw new Error("This endpoint must only run on the server");
    }

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
    
    // Mentors cannot browse jobs
    if (auth.role === "mentor") {
      return errors.forbidden("Mentors are not allowed to browse jobs");
    }

    // Get and validate job ID
    let id: string;
    try {
      const paramsObj = await params;
      id = paramsObj?.id || "";
    } catch (paramsError) {
      console.error("[GET JOB] Error parsing params:", paramsError instanceof Error ? paramsError.message : String(paramsError));
      return errors.validation("Invalid request parameters");
    }

    if (!id || typeof id !== "string") {
      return errors.validation("Job ID is required");
    }

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return errors.validation("Invalid job ID format");
    }

    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("[GET JOB] Database connection error:", dbError instanceof Error ? dbError.message : String(dbError));
      return errors.internal("Database connection failed. Please try again later.");
    }

    // Fetch job from database
    let job;
    try {
      job = await Job.findById(id).lean();
    } catch (dbQueryError) {
      console.error("[GET JOB] Database query error:", dbQueryError instanceof Error ? dbQueryError.message : String(dbQueryError));
      return errors.internal("Failed to fetch job from database. Please try again later.");
    }

    if (!job || Array.isArray(job)) {
      return errors.notFound("Job not found");
    }

    // Return job data with all required fields and defensive checks
    return NextResponse.json(
      {
        id: String(job._id || ""),
        title: typeof job.title === "string" ? job.title : "",
        company: typeof job.company === "string" ? job.company : "",
        description: typeof job.jd_text === "string" ? job.jd_text : "", // Map jd_text to description
        location: typeof job.location === "string" ? job.location : null,
        skills: Array.isArray(job.skills) ? job.skills.filter((s): s is string => typeof s === "string") : [],
        tags: Array.isArray(job.tags) 
          ? job.tags.filter((t): t is string => typeof t === "string")
          : (Array.isArray(job.skills) ? job.skills.filter((s): s is string => typeof s === "string") : []),
        source: typeof job.source === "string" ? job.source : "unknown",
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        // Keep jd_text for backward compatibility
        jd_text: typeof job.jd_text === "string" ? job.jd_text : "",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300", // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[GET JOB] Unexpected error:", errorMessage, errorStack);
    return errors.internal("An error occurred while fetching job");
  }
}

