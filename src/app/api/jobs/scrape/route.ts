import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { requireRole } from "@/lib/apiAuth";
import { jobScrapeSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireRole(req, ["admin", "mentor"]);
  if (auth instanceof Response) return auth;

  const validation = await validateRequestBody(req, jobScrapeSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    await connectToDatabase();

    // Placeholder scrape: insert a sample job
    const created = await Job.create({
      title: validation.data.title || "Software Engineer Intern",
      company: validation.data.company || "Contoso",
      jd_text: validation.data.jd_text || "Assist in building web applications. Familiarity with JS/TS required.",
      source: validation.data.source || "manual",
    });

    // Return only safe data
    return NextResponse.json({ created: { id: String(created._id) } });
  } catch (error) {
    console.error("Job scrape error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while creating job");
  }
}


