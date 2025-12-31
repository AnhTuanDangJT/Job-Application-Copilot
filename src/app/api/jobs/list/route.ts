import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { requireAuth } from "@/lib/apiAuth";
import { jobListSchema, validateQueryParams } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");
  
  // Mentors cannot browse jobs
  if (auth.role === "mentor") {
    return errors.forbidden("Mentors are not allowed to browse jobs");
  }

  const validation = validateQueryParams(req.nextUrl.searchParams, jobListSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    await connectToDatabase();

    const q = validation.data.q?.trim() || "";
    // Sanitize regex input to prevent ReDoS
    const sanitizedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = sanitizedQ
      ? { $or: [{ title: { $regex: sanitizedQ, $options: "i" } }, { company: { $regex: sanitizedQ, $options: "i" } }] }
      : {};
    
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    
    // Return only safe job data with required fields
    const safeJobs = jobs.map((job) => ({
      id: String(job._id),
      title: job.title,
      company: job.company,
      description: job.jd_text, // Map jd_text to description
      location: job.location || null,
      skills: job.skills || [],
      tags: job.tags || job.skills || [], // Use skills as tags if tags don't exist
      source: job.source,
      createdAt: job.createdAt,
      // Keep jd_text for backward compatibility
      jd_text: job.jd_text,
    }));
    
    return NextResponse.json(
      { jobs: safeJobs },
      {
        headers: {
          "Cache-Control": "private, max-age=60", // Cache for 60 seconds
        },
      }
    );
  } catch (error) {
    console.error("List jobs error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching jobs");
  }
}


