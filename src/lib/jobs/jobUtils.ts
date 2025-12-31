/**
 * Shared utilities for job data extraction
 */

/**
 * Detect job type from description
 * Rules:
 * - If description includes "remote", "work from home", "WFH" → remote
 * - If description includes "hybrid", "2 days onsite", "part onsite" → hybrid
 * - Otherwise → onsite
 */
export function detectJobType(description: string): "remote" | "onsite" | "hybrid" {
  if (!description || typeof description !== "string") {
    return "onsite";
  }

  const descLower = description.toLowerCase();
  
  // Check for remote indicators
  const remoteKeywords = ["remote", "work from home", "wfh", "work remotely", "fully remote"];
  const isRemote = remoteKeywords.some(keyword => descLower.includes(keyword));
  
  if (isRemote) {
    // Check if it's hybrid (has both remote and onsite indicators)
    const hybridKeywords = ["hybrid", "2 days", "3 days", "part onsite", "part remote", "flexible"];
    const isHybrid = hybridKeywords.some(keyword => descLower.includes(keyword));
    
    if (isHybrid) {
      return "hybrid";
    }
    return "remote";
  }
  
  // Check for hybrid indicators
  const hybridKeywords = ["hybrid", "2 days onsite", "3 days onsite", "part onsite", "part remote"];
  const isHybrid = hybridKeywords.some(keyword => descLower.includes(keyword));
  
  if (isHybrid) {
    return "hybrid";
  }
  
  return "onsite";
}

/**
 * Extract salary information from job data
 * Handles various formats: salary_min, salary_max, salary_avg, salary_currency
 */
export function extractSalary(job: any): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
} {
  const result: {
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
  } = {};

  // Try salary_min
  if (job.salary_min && typeof job.salary_min === "number" && job.salary_min > 0) {
    result.salaryMin = job.salary_min;
  }
  
  // Try salary_max
  if (job.salary_max && typeof job.salary_max === "number" && job.salary_max > 0) {
    result.salaryMax = job.salary_max;
  }
  
  // Try salary_avg (use as both min and max if no range provided)
  if (job.salary_avg && typeof job.salary_avg === "number" && job.salary_avg > 0) {
    if (!result.salaryMin) {
      result.salaryMin = job.salary_avg;
    }
    if (!result.salaryMax) {
      result.salaryMax = job.salary_avg;
    }
  }

  // Currency (usually in salary_currency field)
  if (job.salary_currency && typeof job.salary_currency === "string") {
    result.salaryCurrency = job.salary_currency.toUpperCase();
  } else if (job.currency && typeof job.currency === "string") {
    result.salaryCurrency = job.currency.toUpperCase();
  } else {
    // Default to USD if not specified
    result.salaryCurrency = "USD";
  }

  return result;
}











