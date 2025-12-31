import type { ExternalJob } from "@/types/jobs";
import { detectJobType, extractSalary } from "./jobUtils";

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
 * Fetch jobs from Adzuna API (free, requires app_id and app_key)
 * 
 * API Documentation: https://developer.adzuna.com/overview
 * Example URL: https://api.adzuna.com/v1/api/jobs/ca/search/1?app_id=YOUR_APP_ID&app_key=YOUR_APP_KEY&results_per_page=25&what=java%20developer
 * 
 * Field mapping to ExternalJob:
 * - id -> id (prefixed with "adzuna-")
 * - title -> title
 * - company.display_name -> company
 * - location.display_name -> location
 * - description -> description (truncated)
 * - redirect_url -> url
 * - company.logo_url -> logoUrl (fallback to Clearbit)
 * - category.tag -> skills (as tags)
 * - salary_min, salary_max, salary_currency -> salary fields
 * - description -> jobType detection
 * - "Adzuna" -> source
 */
export async function fetchJobsFromAdzuna(
  query: string,
  skills: string[] = []
): Promise<ExternalJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn("ADZUNA_APP_ID or ADZUNA_APP_KEY not configured, skipping Adzuna API");
    return [];
  }

  try {
    // Build search query from skills and query
    let searchQuery = query?.trim() || "";
    if (!searchQuery && skills.length > 0) {
      searchQuery = skills.slice(0, 3).join(" ");
    }
    if (!searchQuery) {
      searchQuery = "developer";
    }

    // Adzuna uses country codes (e.g., "ca" for Canada, "us" for USA)
    // Default to "us" if not specified
    const country = "us"; // Can be made configurable later

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "25",
      what: searchQuery,
    });

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[ADZUNA] API error ${response.status}: ${response.statusText}`, errorText);
      throw new Error(`Adzuna API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const jobs = data.results || [];

    if (jobs.length === 0) {
      return [];
    }

    // Transform Adzuna format to ExternalJob interface
    const transformedJobs: ExternalJob[] = await Promise.all(
      jobs.slice(0, 25).map(async (job: any) => {
        // Extract salary information
        const salaryInfo = extractSalary(job);

        // Build location string
        let locationStr = "Remote";
        if (job.location && Array.isArray(job.location) && job.location.length > 0) {
          const location = job.location[0];
          if (location.display_name && typeof location.display_name === "string") {
            locationStr = location.display_name.trim() || "Remote";
          }
        } else if (job.location?.display_name && typeof job.location.display_name === "string") {
          locationStr = job.location.display_name.trim() || "Remote";
        }

        // Get company name
        let companyName = "Unknown company";
        if (job.company && Array.isArray(job.company) && job.company.length > 0) {
          const company = job.company[0];
          if (company.display_name && typeof company.display_name === "string") {
            companyName = company.display_name.trim();
          }
        } else if (job.company?.display_name && typeof job.company.display_name === "string") {
          companyName = job.company.display_name.trim();
        }

        // Get company logo - prefer API-provided logo, fallback to Clearbit
        let logoUrl: string | undefined = undefined;
        if (job.company && Array.isArray(job.company) && job.company.length > 0) {
          logoUrl = job.company[0].logo_url;
        } else if (job.company?.logo_url) {
          logoUrl = job.company.logo_url;
        }
        
        if (!logoUrl) {
          logoUrl = await getCompanyLogo(companyName);
        }

        // Get description
        let description = "";
        if (job.description && typeof job.description === "string") {
          description = job.description.substring(0, 500).trim() + 
            (job.description.length > 500 ? "..." : "");
        }
        if (!description || description.trim().length === 0) {
          description = "No description available";
        }

        // Detect job type from description
        const jobType = detectJobType(description);

        // Get title
        const title = (job.title && typeof job.title === "string") 
          ? job.title.trim() 
          : "No title";

        // Get URL
        let url = "#";
        if (job.redirect_url && typeof job.redirect_url === "string" && job.redirect_url.trim().length > 0) {
          const trimmedUrl = job.redirect_url.trim();
          if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
            url = trimmedUrl;
          }
        }

        // Extract skills from category
        const skillsList: string[] = [];
        if (job.category && Array.isArray(job.category) && job.category.length > 0) {
          job.category.forEach((cat: any) => {
            if (cat.tag && typeof cat.tag === "string") {
              skillsList.push(cat.tag.trim());
            }
          });
        } else if (job.category?.tag && typeof job.category.tag === "string") {
          skillsList.push(job.category.tag.trim());
        }

        // Generate unique ID
        const uniqueId = `adzuna-${job.id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`}`;

        return {
          id: uniqueId,
          title: title || "No title",
          company: companyName || "Unknown company",
          location: locationStr || "Remote",
          description: description || "No description available",
          url: url || "#",
          logoUrl: logoUrl,
          source: "Adzuna",
          skills: skillsList.length > 0 ? skillsList : undefined,
          ...salaryInfo,
          jobType: jobType,
        };
      })
    );

    return transformedJobs;
  } catch (error) {
    console.error("[ADZUNA] Error fetching jobs:", error);
    throw error; // Re-throw to be handled by caller
  }
}

