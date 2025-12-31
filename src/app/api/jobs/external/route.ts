import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody } from "@/lib/validation";
import { z } from "zod";
import type { ExternalJob } from "@/types/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema
const externalJobsSchema = z.object({
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  location: z.string().optional(),
  searchQuery: z.string().optional().default(""),
});

/**
 * Fetch company logo from Clearbit Logo API (free, no API key required)
 * Falls back to generating a logo URL based on company name
 */
async function getCompanyLogo(companyName: string): Promise<string | null> {
  try {
    // Use Clearbit Logo API - free, no API key needed
    const cleanCompanyName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
    
    if (cleanCompanyName) {
      return `https://logo.clearbit.com/${cleanCompanyName}.com`;
    }
    return null;
  } catch (error) {
    console.error("Error fetching company logo:", error);
    return null;
  }
}

/**
 * Fetch jobs from JSearch API (via RapidAPI)
 * Requires JSEARCH_API_KEY environment variable
 */
async function fetchJobsFromJSearch(
  skills: string[],
  location?: string,
  searchQuery?: string
): Promise<ExternalJob[]> {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    console.warn("JSEARCH_API_KEY not configured, skipping JSearch API");
    return [];
  }

  try {
    // Build search query from skills
    const skillsQuery = skills.slice(0, 3).join(" OR "); // Use top 3 skills
    const query = searchQuery || skillsQuery;
    
    const params = new URLSearchParams({
      query: query,
      num_pages: "1", // Fetch first page only
      ...(location && { location }),
    });

    const response = await fetch(
      `https://jsearch.p.rapidapi.com/search?${params.toString()}`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      console.error("JSearch API error:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    const jobs = data.data || [];

    // Transform JSearch format to our format
    const transformedJobs: ExternalJob[] = await Promise.all(
      jobs.slice(0, 20).map(async (job: any) => {
        const companyLogo = await getCompanyLogo(job.employer_name || "");
        
        // Build location string
        let location = "Remote";
        if (job.job_city) {
          const parts = [job.job_city];
          if (job.job_state) parts.push(job.job_state);
          if (job.job_country) parts.push(job.job_country);
          location = parts.join(", ");
        } else if (job.job_country) {
          location = job.job_country;
        }
        
        return {
          id: `jsearch-${job.job_id || Date.now()}-${Math.random()}`,
          title: job.job_title || "No title",
          company: job.employer_name || "Unknown company",
          location: location,
          description: job.job_description || job.job_highlights?.summary?.[0] || "",
          url: job.job_apply_link || job.job_google_link || "#",
          logoUrl: companyLogo || undefined,
          source: "JSearch",
          skills: job.job_required_skills || [],
        };
      })
    );

    return transformedJobs;
  } catch (error) {
    console.error("Error fetching jobs from JSearch:", error);
    return [];
  }
}

/**
 * Use GitHub Models API to enhance job search query from skills (optional)
 */
async function enhanceSearchQueryWithAI(
  skills: string[]
): Promise<string | null> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return null;
  }

  try {
    const response = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Using free GitHub Models API
        messages: [
          {
            role: "system",
            content:
              "You are a job search assistant. Convert a list of technical skills into a concise job search query (2-5 words). Return only the query, no explanation.",
          },
          {
            role: "user",
            content: `Convert these skills into a job search query: ${skills.join(", ")}`,
          },
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("GitHub Models API enhancement error:", error);
    return null;
  }
}

/**
 * POST /api/jobs/external
 * Fetch jobs from external APIs based on detected skills
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
    const validation = await validateRequestBody(req, externalJobsSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status || 400 }
      );
    }

    const { skills, location, searchQuery } = validation.data;

    // Try to enhance search query with AI if GitHub Models API is available
    let enhancedQuery = searchQuery;
    if (!enhancedQuery && skills.length > 0) {
      const aiQuery = await enhanceSearchQueryWithAI(skills);
      if (aiQuery) {
        enhancedQuery = aiQuery;
      }
    }

    // Fetch jobs from external APIs
    const externalJobs: ExternalJob[] = await fetchJobsFromJSearch(
      skills,
      location,
      enhancedQuery
    );

    // If no jobs found from external APIs, return empty array
    if (externalJobs.length === 0) {
      return NextResponse.json({
        jobs: [],
        message: "No external jobs found. Try adjusting your skills or location.",
      });
    }

    return NextResponse.json({
      jobs: externalJobs,
    });
  } catch (error) {
    console.error("External jobs error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching external jobs");
  }
}

