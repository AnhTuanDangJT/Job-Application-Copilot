import type { ExternalJob } from "@/types/jobs";

/**
 * Simple in-memory cache for job rankings
 * Key: job ID, Value: { matchScore, recommendation }
 */
const rankingCache = new Map<string, { matchScore: number; recommendation: "high" | "medium" | "low" }>();

/**
 * Rank a single job using GitHub Models API
 * Compares resume text and skills with job description
 * 
 * @param resumeText - The user's resume text
 * @param job - The job to rank
 * @param skills - Array of skills from the resume
 * @returns Object with matchScore (0-100) and recommendation badge
 */
export async function rankJob(
  resumeText: string,
  job: ExternalJob,
  skills: string[]
): Promise<{ matchScore: number; recommendation: "high" | "medium" | "low" }> {
  // Check cache first
  const cached = rankingCache.get(job.id);
  if (cached) {
    return cached;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    // If no GitHub token, return default low match
    const defaultRank = { matchScore: 0, recommendation: "low" as const };
    rankingCache.set(job.id, defaultRank);
    return defaultRank;
  }

  try {
    // Build prompt for comparison
    const skillsText = skills.length > 0 ? skills.join(", ") : "Not specified";
    const jobDescription = job.description || "No description available";
    const jobTitle = job.title || "Unknown";
    const jobCompany = job.company || "Unknown";

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
            content: "You are a job matching assistant. Analyze how well a resume matches a job description. Return ONLY valid JSON in this exact format: {\"matchScore\": 85, \"recommendation\": \"high\"}. matchScore should be 0-100. recommendation should be \"high\" (score >= 80), \"medium\" (score >= 50), or \"low\" (score < 50). Consider skills, experience, and job requirements. Return no other text.",
          },
          {
            role: "user",
            content: `Resume skills: ${skillsText}\n\nResume excerpt (first 500 chars): ${resumeText.substring(0, 500)}\n\nJob: ${jobTitle} at ${jobCompany}\nJob description: ${jobDescription.substring(0, 1000)}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("GitHub Models API ranking error:", response.status, response.statusText);
      const defaultRank = { matchScore: 0, recommendation: "low" as const };
      rankingCache.set(job.id, defaultRank);
      return defaultRank;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const defaultRank = { matchScore: 0, recommendation: "low" as const };
      rankingCache.set(job.id, defaultRank);
      return defaultRank;
    }

    // Parse JSON response
    let parsed: { matchScore?: number; recommendation?: string };
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse GitHub Models API ranking response:", content);
      const defaultRank = { matchScore: 0, recommendation: "low" as const };
      rankingCache.set(job.id, defaultRank);
      return defaultRank;
    }

    // Validate and normalize matchScore
    let matchScore = 0;
    if (typeof parsed.matchScore === "number") {
      matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore)));
    }

    // Validate and normalize recommendation
    let recommendation: "high" | "medium" | "low" = "low";
    if (parsed.recommendation === "high" || matchScore >= 80) {
      recommendation = "high";
    } else if (parsed.recommendation === "medium" || matchScore >= 50) {
      recommendation = "medium";
    } else {
      recommendation = "low";
    }

    const result = { matchScore, recommendation };
    rankingCache.set(job.id, result);
    return result;
  } catch (error) {
    console.error("GitHub Models API ranking error:", error);
    const defaultRank = { matchScore: 0, recommendation: "low" as const };
    rankingCache.set(job.id, defaultRank);
    return defaultRank;
  }
}

/**
 * Rank multiple jobs in batches
 * Processes jobs in batches of 5 to avoid rate limits
 * 
 * @param resumeText - The user's resume text
 * @param jobs - Array of jobs to rank
 * @param skills - Array of skills from the resume
 * @returns Array of jobs with matchScore and recommendation added
 */
export async function rankJobsInBatches(
  resumeText: string,
  jobs: ExternalJob[],
  skills: string[]
): Promise<ExternalJob[]> {
  if (!resumeText || resumeText.trim().length === 0) {
    // If no resume text, return jobs without ranking
    return jobs;
  }

  const batchSize = 5;
  const rankedJobs: ExternalJob[] = [];

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(job => rankJob(resumeText, job, skills));
    const batchResults = await Promise.all(batchPromises);

    // Add rankings to jobs
    batch.forEach((job, index) => {
      rankedJobs.push({
        ...job,
        matchScore: batchResults[index].matchScore,
        recommendation: batchResults[index].recommendation,
      });
    });

    // Small delay between batches to avoid rate limits
    if (i + batchSize < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return rankedJobs;
}










