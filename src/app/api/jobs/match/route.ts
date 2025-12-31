import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody } from "@/lib/validation";
import { z } from "zod";
import { type JobMatchResult } from "@/lib/resume/advancedMatching";
import { scoreJobWithResume, getMatchedItems, type JobType } from "@/lib/resume/scoreJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema
const matchJobsSchema = z.object({
  resumeText: z.string().min(1, "Resume text is required"),
  searchQuery: z.string().optional().default(""),
});

/**
 * POST /api/jobs/match
 * Match jobs based on resume text with advanced scoring
 */
export async function POST(req: NextRequest) {
  try {
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

    // Validate request body
    const validation = await validateRequestBody(req, matchJobsSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status || 400 }
      );
    }

    const { resumeText, searchQuery } = validation.data;

    // Defensive check: if resume text is empty, return empty results with helpful message
    if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length === 0) {
      return NextResponse.json({
        jobs: [],
        error: "Resume text is required for job matching. Please upload a resume first.",
      });
    }

    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("[JOB MATCH] Database connection error:", dbError instanceof Error ? dbError.message : String(dbError));
      return errors.internal("Database connection failed. Please try again later.");
    }

    // Build job query filter with defensive sanitization
    let filter: Record<string, unknown> = {};
    if (searchQuery && typeof searchQuery === "string" && searchQuery.trim().length > 0) {
      // Sanitize search query to prevent regex injection
      const sanitizedQ = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      
      // Limit query length to prevent performance issues
      const maxQueryLength = 100;
      const trimmedQuery = sanitizedQ.substring(0, maxQueryLength);
      
      filter = {
        $or: [
          { title: { $regex: trimmedQuery, $options: "i" } },
          { company: { $regex: trimmedQuery, $options: "i" } },
          { jd_text: { $regex: trimmedQuery, $options: "i" } },
        ],
      };
    }

    // Fetch all jobs (or filtered by search query) with error handling
    let allJobs;
    try {
      allJobs = await Job.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    } catch (dbQueryError) {
      console.error("[JOB MATCH] Database query error:", dbQueryError instanceof Error ? dbQueryError.message : String(dbQueryError));
      return errors.internal("Failed to fetch jobs from database. Please try again later.");
    }

    // Defensive check: ensure allJobs is an array
    if (!Array.isArray(allJobs)) {
      console.error("[JOB MATCH] Unexpected non-array result from database query");
      return NextResponse.json({
        jobs: [],
      });
    }

    // Calculate match scores for each job using the simpler scoring algorithm
    const matchedJobs: JobMatchResult[] = allJobs
      .filter((job) => job && job._id) // Filter out invalid jobs
      .map((job) => {
        try {
          const jobData: JobType = {
            id: String(job._id || ""),
            title: typeof job.title === "string" ? job.title : "",
            company: typeof job.company === "string" ? job.company : "",
            description: typeof job.jd_text === "string" ? job.jd_text : "",
            location: typeof job.location === "string" ? job.location : null,
            skills: Array.isArray(job.skills) ? job.skills.filter((s): s is string => typeof s === "string") : [],
            tags: Array.isArray(job.tags) 
              ? job.tags.filter((t): t is string => typeof t === "string")
              : (Array.isArray(job.skills) ? job.skills.filter((s): s is string => typeof s === "string") : []),
            jd_text: typeof job.jd_text === "string" ? job.jd_text : "",
          };

          // Use the simpler scoring algorithm (will return 0 if inputs are invalid)
          const rawScore = scoreJobWithResume(resumeText, jobData);
          // Normalize to 0-100 (assuming max score around 200-300 for normalization)
          const matchScore = Math.min(Math.max(Math.round((rawScore / 250) * 100), 0), 100);
          
          // Get matched items for display with defensive checks
          let matchedSkills: string[] = [];
          let matchedTechStack: string[] = [];
          try {
            const matchedItems = getMatchedItems(resumeText, jobData);
            matchedSkills = Array.isArray(matchedItems.matchedSkills) ? matchedItems.matchedSkills : [];
            matchedTechStack = Array.isArray(matchedItems.matchedTechStack) ? matchedItems.matchedTechStack : [];
          } catch (matchedItemsError) {
            console.warn("[JOB MATCH] Error getting matched items:", matchedItemsError instanceof Error ? matchedItemsError.message : String(matchedItemsError));
          }
          
          // Check for job title matches with defensive checks
          const matchedJobTitles: string[] = [];
          try {
            const resumeLower = resumeText.toLowerCase();
            const jobTitle = typeof jobData.title === "string" ? jobData.title : "";
            const jobTitleLower = jobTitle.toLowerCase();
            const titleWords = jobTitleLower
              .split(/\s+/)
              .filter((word: string) => word && word.length > 3);
            titleWords.forEach((word: string) => {
              if (resumeLower.includes(word)) {
                matchedJobTitles.push(word);
              }
            });
          } catch (titleMatchError) {
            console.warn("[JOB MATCH] Error matching job titles:", titleMatchError instanceof Error ? titleMatchError.message : String(titleMatchError));
          }

          return {
            id: jobData.id,
            title: jobData.title || "No title",
            company: jobData.company || "Unknown company",
            description: jobData.description || "", // Map jd_text to description
            location: jobData.location || null,
            skills: jobData.skills || [],
            tags: jobData.tags || [], // Use skills as tags if tags don't exist
            source: typeof job.source === "string" ? job.source : "unknown",
            createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
            matchScore,
            matchedSkills: matchedSkills,
            matchedTechStack: matchedTechStack,
            matchedJobTitles: matchedJobTitles,
            // Keep jd_text for backward compatibility
            jd_text: jobData.jd_text || "",
          };
        } catch (jobProcessingError) {
          // If processing a single job fails, log and skip it
          console.warn("[JOB MATCH] Error processing job:", jobProcessingError instanceof Error ? jobProcessingError.message : String(jobProcessingError));
          return null;
        }
      })
      .filter((job): job is JobMatchResult => job !== null); // Filter out null results

    // Sort by match score (descending) and filter out zero scores
    const sortedJobs = matchedJobs
      .filter((job) => job.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50); // Return top 50 matches

    // If no matches found, return jobs sorted by date
    if (sortedJobs.length === 0) {
      const fallbackJobs = allJobs.slice(0, 50).map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        description: job.jd_text, // Map jd_text to description
        location: job.location || null,
        skills: job.skills || [],
        tags: job.tags || job.skills || [], // Use skills as tags if tags don't exist
        source: job.source,
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        matchScore: 0,
        matchedSkills: [],
        matchedTechStack: [],
        matchedJobTitles: [],
        // Keep jd_text for backward compatibility
        jd_text: job.jd_text,
      }));

      return NextResponse.json({
        jobs: fallbackJobs,
      });
    }

    return NextResponse.json({
      jobs: sortedJobs,
    });
  } catch (error) {
    console.error("Match jobs error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while matching jobs");
  }
}

