import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimiters } from "@/lib/rateLimit";
import { validateRequestBody } from "@/lib/validation";
import { z } from "zod";
import type { ExternalJob } from "@/types/jobs";
import { fetchJobsFromAdzuna } from "@/lib/jobs/fetchAdzunaJobs";
import { rankJobsInBatches } from "@/lib/jobs/rankJobs";
import { detectJobType, extractSalary } from "@/lib/jobs/jobUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema
// Allow empty skills and query - API will use fallback "software developer junior"
const searchJobsSchema = z.object({
  skills: z.array(z.string()),
  query: z.string().optional(),
  resumeText: z.string().optional(), // Optional resume text for AI ranking
});

/**
 * GitHub Models API-enhanced keyword and job title generation
 * Transforms skills list into search-optimized keywords, locations, and seniority levels
 */
interface EnhancedSearchParams {
  keywords: string[];
  locations: string[];
  seniority: string[];
}

async function enhanceSearchWithAI(
  skills: string[]
): Promise<EnhancedSearchParams | null> {
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
              "You are a job search assistant. Convert a list of technical skills into optimized job search parameters. Return ONLY valid JSON in this exact format: {\"keywords\": [\"keyword1\", \"keyword2\"], \"locations\": [\"location1\", \"location2\"], \"seniority\": [\"level1\", \"level2\"]}. Keywords should be job-relevant terms (e.g., \"Java developer\", \"Full stack\", \"React\"). Locations should be common job locations (e.g., \"remote\", \"USA\", \"Canada\"). Seniority should be levels like \"intern\", \"junior\", \"mid-level\", \"senior\". Return no other text.",
          },
          {
            role: "user",
            content: `Convert these skills into job search parameters: ${skills.join(", ")}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("GitHub Models API error:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return null;
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      seniority: Array.isArray(parsed.seniority) ? parsed.seniority : [],
    };
  } catch (error) {
    console.error("GitHub Models API enhancement error:", error);
    return null;
  }
}

/**
 * Fallback keyword generation when GitHub Models API is not available
 * Simple strategy: join skills and create basic search terms
 */
function generateFallbackKeywords(skills: string[]): EnhancedSearchParams {
  // If no skills, return empty keywords (will use query or generic fallback)
  if (!skills || skills.length === 0) {
    return {
      keywords: [],
      locations: ["remote", "USA"],
      seniority: ["junior", "mid-level"],
    };
  }
  
  return {
    keywords: [
      ...skills,
      ...skills.map((skill) => `${skill} developer`),
      `${skills.slice(0, 2).join(" ")}`,
    ].slice(0, 5), // Limit to 5 keywords
    locations: ["remote", "USA"],
    seniority: ["junior", "mid-level"],
  };
}

/**
 * Fetch company logo from Clearbit Logo API (free, no API key required)
 * Falls back gracefully if logo is not available
 */
async function getCompanyLogo(companyName: string): Promise<string | undefined> {
  try {
    const cleanCompanyName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

    if (cleanCompanyName) {
      return `https://logo.clearbit.com/${cleanCompanyName}.com`;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Fetch jobs from JSearch API (via RapidAPI)
 * 
 * API Documentation: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * Example URL: https://jsearch.p.rapidapi.com/search?query=Java%20developer&num_pages=1&engine=linkedin
 * 
 * Supported engines:
 * - linkedin
 * - indeed
 * - glassdoor
 * - google_jobs
 * - careerjet
 * - zip_recruiter
 * - monster
 * 
 * Field mapping to ExternalJob:
 * - job_id -> id (prefixed with "jsearch-{engine}-")
 * - job_title -> title
 * - employer_name -> company
 * - job_city, job_state, job_country -> location (combined)
 * - job_description -> description (truncated to 500 chars)
 * - job_apply_link / job_google_link -> url
 * - employer_logo (if available) -> logoUrl (otherwise fetched via Clearbit)
 * - job_required_skills -> skills
 * - engine name -> source
 */
async function fetchJobsFromJSearch(
  searchQuery: string,
  location?: string,
  engine?: string
): Promise<ExternalJob[]> {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    console.warn("JSEARCH_API_KEY not configured, skipping JSearch API");
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: searchQuery,
      num_pages: "1", // Fetch first page only (10 jobs per page)
      ...(location && location !== "remote" && { location }),
      ...(engine && { engine }),
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
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[JSearch ${engine || "default"}] API error ${response.status}: ${response.statusText}`, errorText);
      throw new Error(`JSearch API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const jobs = data.data || [];

    if (jobs.length === 0) {
      return [];
    }

    // Transform JSearch format to ExternalJob interface
    const transformedJobs: ExternalJob[] = await Promise.all(
      jobs.slice(0, 20).map(async (job: any) => {
        // Build location string from city, state, country
        let locationStr = "Remote";
        if (job.job_city) {
          const parts = [job.job_city];
          if (job.job_state) parts.push(job.job_state);
          if (job.job_country) parts.push(job.job_country);
          locationStr = parts.join(", ").trim() || "Remote";
        } else if (job.job_country) {
          locationStr = String(job.job_country).trim() || "Remote";
        } else if (job.job_is_remote) {
          locationStr = "Remote";
        }
        // Ensure locationStr is never empty
        if (!locationStr || locationStr.trim().length === 0) {
          locationStr = "Remote";
        }

        // Get company logo - prefer API-provided logo, fallback to Clearbit
        let logoUrl: string | undefined = job.employer_logo;
        if (!logoUrl) {
          logoUrl = await getCompanyLogo(job.employer_name || "");
        }

        // Truncate description to 500 characters
        // Ensure description is always a non-empty string
        let description = "";
        if (job.job_description && typeof job.job_description === "string") {
          description = job.job_description.substring(0, 500).trim() + 
            (job.job_description.length > 500 ? "..." : "");
        } else if (job.job_highlights?.summary?.[0] && typeof job.job_highlights.summary[0] === "string") {
          description = String(job.job_highlights.summary[0]).substring(0, 500).trim() + 
            (job.job_highlights.summary[0].length > 500 ? "..." : "");
        }
        // Final fallback to ensure description is never empty
        if (!description || description.trim().length === 0) {
          description = "No description available";
        }

        // Handle missing apply link - use job_google_link or fallback to "#"
        // Ensure URL is always a valid string (required by ExternalJob interface)
        let applyUrl = "#";
        if (job.job_apply_link && typeof job.job_apply_link === "string" && job.job_apply_link.trim().length > 0) {
          applyUrl = job.job_apply_link.trim();
        } else if (job.job_google_link && typeof job.job_google_link === "string" && job.job_google_link.trim().length > 0) {
          applyUrl = job.job_google_link.trim();
        }
        // Validate URL format (must start with http:// or https://)
        if (applyUrl !== "#" && !applyUrl.startsWith("http://") && !applyUrl.startsWith("https://")) {
          applyUrl = "#";
        }

        // Generate unique ID with better collision avoidance
        const uniqueId = `jsearch-${engine || "default"}-${job.job_id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`}`;

        // Ensure all required fields are present with defaults and never empty
        const title = (job.job_title && typeof job.job_title === "string") 
          ? job.job_title.trim() 
          : "No title";
        const company = (job.employer_name && typeof job.employer_name === "string") 
          ? job.employer_name.trim() 
          : "Unknown company";
        
        // Extract salary information
        const salaryInfo = extractSalary(job);
        
        // Detect job type from description
        const jobType = detectJobType(description);

        // Final validation: ensure no empty strings for required fields
        return {
          id: uniqueId,
          title: title || "No title",
          company: company || "Unknown company",
          location: locationStr || "Remote",
          description: description || "No description available",
          url: applyUrl || "#",
          logoUrl: logoUrl,
          source: engine || "JSearch",
          skills: Array.isArray(job.job_required_skills) ? job.job_required_skills.filter((s: any) => s && typeof s === "string") : [],
          ...salaryInfo,
          jobType: jobType,
        };
      })
    );

    return transformedJobs;
  } catch (error) {
    console.error(`[JSearch ${engine || "default"}] Error fetching jobs:`, error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Alternative: Fetch jobs from Remotive API (free, no API key required)
 * 
 * API Documentation: https://remotive.io/api-documentation
 * Example URL: https://remotive.com/api/remote-jobs?search=Java
 * 
 * Field mapping to ExternalJob:
 * - id -> id (prefixed with "remotive-")
 * - title -> title
 * - company_name -> company
 * - candidate_required_location -> location (or "Remote")
 * - description (HTML stripped) -> description (truncated)
 * - url -> url
 * - company_logo -> logoUrl
 * - tags -> skills
 * - "Remotive" -> source
 */
async function fetchJobsFromRemotive(
  searchQuery: string
): Promise<ExternalJob[]> {
  try {
    // Remotive API is free and doesn't require authentication
    const params = new URLSearchParams({
      search: searchQuery,
      limit: "20",
    });

    const url = `https://remotive.com/api/remote-jobs?${params.toString()}`;
    console.log("[REMOTIVE] Fetching from URL:", url);

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    console.log("[REMOTIVE] Response status:", response.status);
    console.log("[REMOTIVE] Response statusText:", response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[REMOTIVE] API error ${response.status}: ${response.statusText}`, errorText);
      throw new Error(`Remotive API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[REMOTIVE] Response status:", response.status);
    console.log("[REMOTIVE] Response received, keys:", Object.keys(data));
    const jobs = data.jobs || [];
    console.log("[REMOTIVE] Raw jobs length:", jobs?.length || 0);

    if (jobs.length === 0) {
      return [];
    }

    // Transform Remotive format to ExternalJob interface
    const transformedJobs: ExternalJob[] = jobs.map((job: any) => {
      // Strip HTML from description and truncate
      // Ensure description is always a non-empty string
      let descriptionText = "";
      if (job.description && typeof job.description === "string") {
        descriptionText = job.description.replace(/<[^>]*>/g, "").substring(0, 500).trim() +
          (job.description.length > 500 ? "..." : "");
      }
      if (!descriptionText || descriptionText.trim().length === 0) {
        descriptionText = "No description available";
      }

      // Validate and normalize required fields
      const title = (job.title && typeof job.title === "string") 
        ? job.title.trim() 
        : "No title";
      const company = (job.company_name && typeof job.company_name === "string") 
        ? job.company_name.trim() 
        : "Unknown company";
      
      // Build location string
      let location = "Remote";
      if (job.candidate_required_location && typeof job.candidate_required_location === "string") {
        location = job.candidate_required_location.trim() || "Remote";
      }
      
      // Validate URL
      let url = "#";
      if (job.url && typeof job.url === "string" && job.url.trim().length > 0) {
        const trimmedUrl = job.url.trim();
        if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
          url = trimmedUrl;
        }
      }

      // Extract salary information
      const salaryInfo = extractSalary(job);
      
      // Detect job type from description
      const jobType = detectJobType(descriptionText);

      // Ensure all required fields are present with defaults and never empty
      return {
        id: `remotive-${job.id || Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        title: title || "No title",
        company: company || "Unknown company",
        location: location || "Remote",
        description: descriptionText || "No description available",
        url: url || "#",
        logoUrl: (job.company_logo && typeof job.company_logo === "string" && job.company_logo.trim().length > 0) 
          ? job.company_logo.trim() 
          : undefined,
        source: "Remotive",
        skills: Array.isArray(job.tags) ? job.tags.filter((s: any) => s && typeof s === "string") : [],
        ...salaryInfo,
        jobType: jobType,
      };
    });

    return transformedJobs;
  } catch (error) {
    console.error("[REMOTIVE] Error fetching jobs:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * POST /api/jobs/search
 * 
 * Search for jobs on the internet based on detected skills from CV.
 * 
 * This endpoint:
 * 1. Uses GitHub Models API to enhance skills into search keywords (optional, requires GITHUB_TOKEN)
 * 2. Calls external job APIs (JSearch via RapidAPI, or Remotive as fallback)
 * 3. Normalizes job data into ExternalJob format
 * 4. Returns jobs with company logos and apply URLs
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.api(req);
    if (!rateLimitResult.success) {
      // Rate limit response already has proper format, but ensure jobs array is included
      const rateLimitResponse = rateLimitResult.response;
      try {
        const rateLimitData = await rateLimitResponse.clone().json();
        if (!rateLimitData.jobs) {
          return NextResponse.json(
            { 
              jobs: [],
              error: rateLimitData.error || rateLimitData.message || "Too many requests"
            },
            { status: 429 }
          );
        }
      } catch {
        // If response is not JSON, return standard format
        return NextResponse.json(
          { 
            jobs: [],
            error: "Too many requests. Please try again later."
          },
          { status: 429 }
        );
      }
      return rateLimitResponse;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { 
          jobs: [],
          error: "Authentication required. Please log in to search for jobs."
        },
        { status: 401 }
      );
    }
    
    // Mentors cannot browse jobs
    if (auth.role === "mentor") {
      return NextResponse.json(
        { 
          jobs: [],
          error: "Mentors are not allowed to browse jobs"
        },
        { status: 403 }
      );
    }

    // Validate request body
    const validation = await validateRequestBody(req, searchJobsSchema);
    if (!validation.success) {
      return NextResponse.json(
        { 
          jobs: [],
          error: validation.error 
        },
        { status: validation.status || 400 }
      );
    }

    const { skills, query, resumeText = "" } = validation.data;

    // DEBUG: Log initial parameters
    console.log("\n===== JOB SEARCH START =====");
    console.log("[JOB SEARCH] Incoming request body:", { skills, query, resumeTextLength: resumeText?.length || 0 });
    console.log("[JOB SEARCH] skills:", skills);
    console.log("[JOB SEARCH] query:", query);

    // Step 1: Enhance search parameters with GitHub Models API (if available and skills exist)
    let searchParams: EnhancedSearchParams;
    let aiError: string | null = null;
    
    // Only enhance if we have skills
    if (skills && skills.length > 0) {
      try {
        const enhancedParams = await enhanceSearchWithAI(skills);
        
        if (enhancedParams) {
          searchParams = enhancedParams;
        } else {
          // Fallback to simple keyword generation
          searchParams = generateFallbackKeywords(skills);
        }
      } catch (error) {
        // GitHub Models API failed, use fallback but log the error
        aiError = error instanceof Error ? error.message : "Unknown AI error";
        console.warn("[JOB_SEARCH] GitHub Models API enhancement failed, using fallback:", aiError);
        searchParams = generateFallbackKeywords(skills);
      }
    } else {
      // No skills provided, use query-based fallback
      searchParams = {
        keywords: query?.trim() ? [query.trim()] : [],
        locations: ["remote", "USA"],
        seniority: [],
      };
    }

    // Step 2: Build search query - create meaningful queries from skills
    // Priority: user query > AI-enhanced query > skill-based query > generic fallback
    let finalQuery = query?.trim() || "";
    
    if (!finalQuery && skills && skills.length > 0) {
      // Generate meaningful query from skills
      // Map common skills to job titles
      const skillToTitle: Record<string, string> = {
        "java": "software engineer",
        "python": "backend developer",
        "javascript": "full stack developer",
        "typescript": "full stack developer",
        "react": "frontend developer",
        "node": "backend developer",
        "nodejs": "backend developer",
        "node.js": "backend developer",
        "angular": "frontend developer",
        "vue": "frontend developer",
        "sql": "database developer",
        "mongodb": "backend developer",
        "postgresql": "backend developer",
        "aws": "cloud engineer",
        "docker": "devops engineer",
        "kubernetes": "devops engineer",
        "git": "software developer",
      };
      
      // Find matching job title from skills
      let jobTitle = "";
      const lowerSkills = skills.map(s => s.toLowerCase().trim());
      
      for (const skill of lowerSkills) {
        if (skillToTitle[skill]) {
          jobTitle = skillToTitle[skill];
          break;
        }
      }
      
      // If no specific match, use generic "software engineer"
      if (!jobTitle) {
        jobTitle = "software engineer";
      }
      
      // Build query: job title + top skill
      const topSkill = skills[0]?.trim() || "";
      if (topSkill) {
        finalQuery = `${jobTitle} ${topSkill}`;
      } else {
        finalQuery = jobTitle;
      }
    }
    
    // Final fallback
    if (!finalQuery) {
      finalQuery = "software engineer";
    }

    // DEBUG: Log final query
    console.log("[JOB SEARCH] finalQuery:", finalQuery);

    // Step 3: Always fetch jobs from Remotive first (no API key required)
    let allResults: ExternalJob[] = [];
    let apiErrors: string[] = [];
    const engineStats: Record<string, number> = {};

    // Helper function to try multiple fallback queries if main search returns 0 jobs
    const trySearchWithFallbacks = async (
      searchFn: (query: string) => Promise<ExternalJob[]>,
      initialQuery: string,
      engineName: string
    ): Promise<ExternalJob[]> => {
      const fallbackQueries = [
        "software engineer",
        "software developer",
        "junior developer",
        "backend developer",
        "full stack developer",
        "intern software developer",
      ];
      
      // Try initial query first
      try {
        const timeoutPromise = new Promise<ExternalJob[]>((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 30000);
        });
        
        const jobsPromise = searchFn(initialQuery);
        const jobs = await Promise.race([jobsPromise, timeoutPromise]);
        
        if (jobs.length > 0) {
          console.log(`[JOB SEARCH] ${engineName} returned ${jobs.length} jobs with query: "${initialQuery}"`);
          return jobs;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.warn(`[JOB SEARCH] ${engineName} failed with initial query "${initialQuery}":`, errorMsg);
      }
      
      // Try fallback queries sequentially
      for (const fallbackQuery of fallbackQueries) {
        if (fallbackQuery === initialQuery) {
          continue; // Skip if fallback is same as initial query
        }
        
        try {
          const timeoutPromise = new Promise<ExternalJob[]>((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 30000);
          });
          
          const jobsPromise = searchFn(fallbackQuery);
          const jobs = await Promise.race([jobsPromise, timeoutPromise]);
          
          if (jobs.length > 0) {
            console.log(`[JOB SEARCH] ${engineName} returned ${jobs.length} jobs with fallback query: "${fallbackQuery}"`);
            return jobs;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.warn(`[JOB SEARCH] ${engineName} failed with fallback query "${fallbackQuery}":`, errorMsg);
          continue; // Try next fallback
        }
      }
      
      console.log(`[JOB SEARCH] ${engineName} returned 0 jobs after trying all queries`);
      return [];
    };

    // Always run Remotive first (no API key needed)
    console.log("[JOB SEARCH] Running Remotive with query:", finalQuery);
    const remotiveUrl = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(finalQuery)}&limit=20`;
    console.log("[REMOTIVE] URL:", remotiveUrl);
    
    try {
      const remotiveJobs = await trySearchWithFallbacks(
        fetchJobsFromRemotive,
        finalQuery,
        "Remotive"
      );
      
      allResults = [...remotiveJobs];
      engineStats["remotive"] = remotiveJobs.length;
    } catch (err) {
      // Remotive failure is logged but doesn't break the response
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[JOB SEARCH ERROR][Remotive]:", errorMsg);
      if (err instanceof Error && err.stack) {
        console.error("[JOB SEARCH ERROR][Remotive] Stack:", err.stack);
      }
      apiErrors.push(`remotive: ${errorMsg}`);
      engineStats["remotive"] = 0;
    }

    // Step 3.25: Fetch from Adzuna if keys are present (runs after Remotive, before JSearch)
    if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
      console.log("[JOB SEARCH] Running Adzuna with query:", finalQuery);
      try {
        // Use fallback queries if needed
        const adzunaSearchFn = (query: string) => fetchJobsFromAdzuna(query, skills);
        const adzunaJobs = await trySearchWithFallbacks(
          adzunaSearchFn,
          finalQuery,
          "Adzuna"
        );
        
        allResults = [...allResults, ...adzunaJobs];
        engineStats["adzuna"] = adzunaJobs.length;
      } catch (err) {
        // Adzuna failure is logged but doesn't break the response
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[JOB SEARCH ERROR][Adzuna]:", errorMsg);
        if (err instanceof Error && err.stack) {
          console.error("[JOB SEARCH ERROR][Adzuna] Stack:", err.stack);
        }
        apiErrors.push(`adzuna: ${errorMsg}`);
        engineStats["adzuna"] = 0;
        // Continue - will try JSearch if available
      }
    } else {
      engineStats["adzuna"] = 0;
      console.log("[JOB SEARCH] Adzuna DISABLED - API keys not configured");
    }

    // Step 3.5: Optionally fetch from JSearch if API key is configured
    // This runs in parallel with Remotive results and combines them
    if (process.env.JSEARCH_API_KEY) {
      console.log("[JOB SEARCH] Running JSearch with query:", finalQuery);
      // Define all supported engines
      const engines = [
        "linkedin",
        "indeed",
        "glassdoor",
        "google_jobs",
        "careerjet",
        "zip_recruiter",
        "monster",
      ];

      // Get location for search (prefer non-remote location)
      const location = searchParams.locations.find(
        (loc) => loc.toLowerCase() !== "remote"
      );

      // Fetch from all engines in parallel
      // Each engine is wrapped in try/catch to prevent one failure from breaking others
      const enginePromises = engines.map(async (engine) => {
        try {
          // Use fallback queries if needed
          const jsearchSearchFn = (query: string) => fetchJobsFromJSearch(query, location, engine);
          const jobs = await trySearchWithFallbacks(
            jsearchSearchFn,
            finalQuery,
            engine
          );
          
          engineStats[engine] = jobs.length;
          return jobs;
        } catch (err) {
          // All errors are caught and logged, but don't break the entire search
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[JOB SEARCH ERROR][${engine}]:`, errorMsg);
          if (err instanceof Error && err.stack) {
            console.error(`[JOB SEARCH ERROR][${engine}] Stack:`, err.stack);
          }
          apiErrors.push(`${engine}: ${errorMsg}`);
          engineStats[engine] = 0;
          return [];
        }
      });

      // Wait for all engines to complete (even if some fail)
      // Promise.allSettled would be better, but Promise.all with individual try/catch works
      try {
        const results = await Promise.all(enginePromises);
        const jsearchJobs = results.flat();
        // Combine Remotive and JSearch results
        allResults = [...allResults, ...jsearchJobs];
        console.log("[JOB SEARCH] JSearch total returned", jsearchJobs.length, "jobs");
      } catch (err) {
        // JSearch overall failure is logged but doesn't break the response
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[JOB SEARCH ERROR][JSearch engines]:", errorMsg);
        // Continue with Remotive results only
      }
    } else {
      console.log("[JOB SEARCH] JSearch DISABLED - API key not configured");
    }

    // Step 4: Remove duplicates by company + title + URL (more accurate deduplication)
    // Normalize all fields for consistent deduplication
    const seen = new Set<string>();
    const deduplicatedJobs: ExternalJob[] = [];
    
    for (const job of allResults) {
      // Ensure job has required fields before processing
      // After STEP A fixes, these should always be present, but double-check
      if (!job.company || !job.title || typeof job.company !== "string" || typeof job.title !== "string") {
        console.warn("[JOB_SEARCH] Skipping job with missing required fields:", job.id);
        continue;
      }

      // Normalize fields for deduplication:
      // - Lowercase and trim company and title
      // - Remove query params and fragments from URL
      // - Remove special characters that might cause false negatives
      const normalizedCompany = job.company.toLowerCase().trim().replace(/[^\w\s]/g, "");
      const normalizedTitle = job.title.toLowerCase().trim().replace(/[^\w\s]/g, "");
      
      // Extract base URL (remove query params, fragments, trailing slashes)
      let urlPart = "";
      if (job.url && job.url !== "#" && typeof job.url === "string") {
        try {
          // Try to parse as URL for better normalization
          const urlObj = new URL(job.url);
          urlPart = urlObj.hostname + urlObj.pathname.replace(/\/$/, "");
        } catch {
          // If URL parsing fails, use simple string manipulation
          urlPart = job.url.split("?")[0].split("#")[0].replace(/\/$/, "").toLowerCase();
        }
      }
      
      // Create deduplication key: company + title + URL
      // This ensures same job from different engines is only shown once
      const key = `${normalizedCompany}_${normalizedTitle}_${urlPart}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedJobs.push(job);
      }
    }

    // Step 5: Rank jobs with AI if resume text is available
    let rankedJobs = deduplicatedJobs;
    if (resumeText && resumeText.trim().length > 0) {
      try {
        rankedJobs = await rankJobsInBatches(resumeText, deduplicatedJobs, skills);
      } catch (err) {
        // AI ranking failure is logged but doesn't break the response
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[JOB_SEARCH] AI ranking failed:", errorMsg);
        // Continue with unranked jobs
      }
    }

    // Step 6: Sort by matchScore (if available), then by relevance
    const sortedJobs = rankedJobs.sort((a, b) => {
      // First sort by AI match score (descending) if available
      if (a.matchScore !== undefined && b.matchScore !== undefined) {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
      } else if (a.matchScore !== undefined) {
        return -1; // Jobs with match score come first
      } else if (b.matchScore !== undefined) {
        return 1;
      }
      
      // Then sort by skill count (descending)
      const aSkillCount = (a.skills?.length || 0);
      const bSkillCount = (b.skills?.length || 0);
      if (bSkillCount !== aSkillCount) {
        return bSkillCount - aSkillCount;
      }
      
      // Finally sort by title length (shorter, more specific titles first)
      return (a.title?.length || 0) - (b.title?.length || 0);
    });

    // Limit to ~50 jobs
    const limitedJobs = sortedJobs.slice(0, 50);

    // Set externalJobs for backward compatibility
    const externalJobs = limitedJobs;

    // DEBUG: Log combined jobs count
    console.log("[JOB SEARCH] Combined jobs:", allResults.length);
    console.log("[JOB SEARCH] Deduplicated jobs:", deduplicatedJobs.length);
    console.log("[JOB SEARCH] Ranked jobs:", rankedJobs.length);
    console.log("[JOB SEARCH] Final limited jobs:", externalJobs.length);
    console.log("[JOB SEARCH] Engine stats:", JSON.stringify(engineStats, null, 2));
    console.log("[JOB SEARCH] API errors:", apiErrors.length > 0 ? apiErrors : "none");
    console.log("===== JOB SEARCH END =====\n");

    // Step 6: Return results with engine statistics
    if (externalJobs.length === 0) {
      // Always return empty jobs array with a user-friendly message
      // Never show "No job search APIs are configured" - Remotive always runs
      console.warn("[JOB SEARCH] No jobs found after searching all available APIs");
      console.log("[JOB SEARCH] ========== SUMMARY ==========");
      console.log("[JOB SEARCH] Job engines executed:", Object.keys(engineStats).join(", ") || "none");
      console.log("[JOB SEARCH] Query used:", finalQuery);
      console.log("[JOB SEARCH] Errors seen:", apiErrors.length > 0 ? apiErrors.join("; ") : "none");
      console.log("[JOB SEARCH] Engine results:", JSON.stringify(engineStats, null, 2));
      console.log("[JOB SEARCH] Why result was empty:");
      console.log("  - Remotive returned:", engineStats["remotive"] || 0, "jobs");
      console.log("  - Adzuna returned:", engineStats["adzuna"] || 0, "jobs");
      console.log("  - JSearch returned:", Object.keys(engineStats).filter(k => k !== "remotive" && k !== "adzuna").reduce((sum, k) => sum + (engineStats[k] || 0), 0), "jobs");
      console.log("[JOB SEARCH] ============================");
      
      return NextResponse.json({
        jobs: [],
      });
    }

    if (apiErrors.length > 0) {
      console.warn("[JOB SEARCH] Some engines had errors:", apiErrors);
    }

    console.log("[JOB SEARCH] ========== SUMMARY ==========");
    console.log("[JOB SEARCH] Job engines executed:", Object.keys(engineStats).join(", ") || "none");
    console.log("[JOB SEARCH] Query used:", finalQuery);
    console.log("[JOB SEARCH] Errors seen:", apiErrors.length > 0 ? apiErrors.join("; ") : "none");
    console.log("[JOB SEARCH] Engine results:", JSON.stringify(engineStats, null, 2));
    console.log("[JOB SEARCH] Total jobs returned:", externalJobs.length);
    console.log("[JOB SEARCH] ============================");

    return NextResponse.json({
      jobs: externalJobs,
    });
  } catch (error) {
    // Top-level error handler
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[JOB_SEARCH] Unexpected error:", errorMessage, errorStack);
    
    return NextResponse.json(
      {
        jobs: [],
        error: "An unexpected error occurred while searching for jobs. Please try again later.",
      },
      { status: 500 }
    );
  }
}

