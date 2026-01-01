import { connectToDatabase } from "@/lib/db";
import { Job } from "@/models/Job";
import { getResumeText } from "./getResumeText";

export interface MatchedJob {
  id: string;
  title: string;
  company: string;
  jd_text?: string;
  source?: string;
  createdAt?: string;
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Extract keywords and skills from resume text
 */
function extractResumeKeywords(resumeText: string): {
  keywords: Set<string>;
  skills: Set<string>;
  experience: string[];
} {
  const text = resumeText.toLowerCase();
  
  // Common technical skills (expandable list)
  const commonSkills = [
    "javascript", "typescript", "python", "java", "c++", "c#", "go", "rust", "php", "ruby",
    "react", "vue", "angular", "node.js", "express", "next.js", "django", "flask", "spring",
    "sql", "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "git", "github", "gitlab", "ci/cd", "jenkins",
    "html", "css", "sass", "tailwind", "bootstrap",
    "machine learning", "ai", "deep learning", "nlp", "computer vision",
    "agile", "scrum", "devops", "microservices", "rest api", "graphql",
    "testing", "jest", "cypress", "selenium", "unit testing",
    "project management", "leadership", "team collaboration"
  ];

  // Extract skills mentioned in resume
  const foundSkills = new Set<string>();
  for (const skill of commonSkills) {
    if (text.includes(skill.toLowerCase())) {
      foundSkills.add(skill.toLowerCase());
    }
  }

  // Extract keywords (important words, typically 3+ characters, excluding common stop words)
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "can",
    "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "my", "your", "his", "her", "its", "our", "their", "me", "him", "us", "them"
  ]);

  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word.toLowerCase()));

  // Count word frequency and get top keywords
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase();
    wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
  }

  // Get top keywords (excluding skills already found)
  const sortedWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word)
    .filter(word => !foundSkills.has(word));

  const keywords = new Set(sortedWords);

  // Extract experience-related phrases (years, roles, etc.)
  const experiencePatterns = [
    /\d+\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)/gi,
    /(senior|junior|lead|principal|staff)\s+\w+/gi,
    /(engineer|developer|manager|analyst|specialist|architect|consultant)/gi
  ];

  const experience: string[] = [];
  for (const pattern of experiencePatterns) {
    const matches = resumeText.match(pattern);
    if (matches) {
      experience.push(...matches.map(m => m.toLowerCase()));
    }
  }

  return { keywords, skills: foundSkills, experience };
}

/**
 * Calculate relevance score between resume and job
 */
function calculateRelevanceScore(
  resumeKeywords: Set<string>,
  resumeSkills: Set<string>,
  resumeExperience: string[],
  job: { title: string; company: string; jd_text?: string }
): { score: number; matchedKeywords: string[] } {
  const jobText = `${job.title} ${job.company} ${job.jd_text || ""}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;

  // Title match (highest weight)
  const titleLower = job.title.toLowerCase();
  for (const skill of resumeSkills) {
    if (titleLower.includes(skill)) {
      score += 10;
      matchedKeywords.push(skill);
    }
  }

  // Skills match in job description (high weight)
  for (const skill of resumeSkills) {
    if (jobText.includes(skill) && !matchedKeywords.includes(skill)) {
      score += 8;
      matchedKeywords.push(skill);
    }
  }

  // Keywords match (medium weight)
  for (const keyword of resumeKeywords) {
    if (jobText.includes(keyword) && !matchedKeywords.includes(keyword)) {
      score += 3;
      matchedKeywords.push(keyword);
    }
  }

  // Experience level match (bonus)
  for (const exp of resumeExperience) {
    if (jobText.includes(exp)) {
      score += 5;
    }
  }

  // Job description length bonus (more detailed = potentially better match)
  if (job.jd_text && job.jd_text.length > 500) {
    score += 2;
  }

  return { score, matchedKeywords };
}

/**
 * Match jobs based on user's resume
 * Returns jobs ranked by relevance, or all jobs if no resume exists
 */
export async function matchJobsByResume(
  userId: string,
  limit: number = 50
): Promise<MatchedJob[]> {
  try {
    await connectToDatabase();

    // Get user's resume text
    const resumeText = await getResumeText(userId);

    // If no resume, return all jobs (no filtering)
    if (!resumeText || resumeText.trim().length < 50) {
      const jobs = await Job.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return jobs.map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        jd_text: job.jd_text,
        source: job.source,
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        relevanceScore: 0,
        matchedKeywords: [],
      }));
    }

    // Extract keywords and skills from resume
    const { keywords, skills, experience } = extractResumeKeywords(resumeText);

    // If no meaningful keywords/skills extracted, return all jobs
    if (keywords.size === 0 && skills.size === 0) {
      const jobs = await Job.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return jobs.map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        jd_text: job.jd_text,
        source: job.source,
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        relevanceScore: 0,
        matchedKeywords: [],
      }));
    }

    // Get all jobs
    const allJobs = await Job.find({}).sort({ createdAt: -1 }).limit(limit * 2).lean();

    // Calculate relevance for each job
    const matchedJobs: MatchedJob[] = allJobs.map((job) => {
      const { score, matchedKeywords } = calculateRelevanceScore(
        keywords,
        skills,
        experience,
        {
          title: job.title,
          company: job.company,
          jd_text: job.jd_text,
        }
      );

      return {
        id: String(job._id),
        title: job.title,
        company: job.company,
        jd_text: job.jd_text,
        source: job.source,
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        relevanceScore: score,
        matchedKeywords,
      };
    });

    // Filter out jobs with zero relevance and sort by score (highest first)
    const relevantJobs = matchedJobs
      .filter((job) => job.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    // If we have relevant jobs, return them
    if (relevantJobs.length > 0) {
      return relevantJobs;
    }

    // If no relevant matches, return top jobs by date (fallback)
    return matchedJobs
      .filter((job) => job.relevanceScore === 0)
      .slice(0, limit)
      .map((job) => ({
        ...job,
        relevanceScore: 0,
        matchedKeywords: [],
      }));
  } catch (error) {
    console.error("Error matching jobs by resume:", error instanceof Error ? error.message : "Unknown error");
    
    // Fallback: return all jobs on error
    try {
      await connectToDatabase();
      const jobs = await Job.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return jobs.map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        jd_text: job.jd_text,
        source: job.source,
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        relevanceScore: 0,
        matchedKeywords: [],
      }));
    } catch (fallbackError) {
      console.error("Fallback error:", fallbackError);
      return [];
    }
  }
}















