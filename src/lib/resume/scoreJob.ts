/**
 * Simple job scoring algorithm based on skill overlap, keyword similarity,
 * title relevance, and tech stack match
 */

import { extractSkillsFromResume } from "./extractSkills";

export interface JobType {
  id: string;
  title: string;
  company: string;
  description?: string;
  location?: string | null;
  skills?: string[];
  tags?: string[];
  jd_text?: string; // Fallback for description
}

/**
 * Score a job based on how well it matches the resume
 * This function never throws - it always returns a number (0 if inputs are invalid)
 * 
 * @param resumeText - The full resume text
 * @param skills - Array of skills extracted from the resume
 * @param job - The job object to score
 * @returns A numerical score (higher is better match, 0 if inputs invalid)
 */
export function scoreJob(resumeText: string | null | undefined, skills: string[] | null | undefined, job: JobType | null | undefined): number {
  // Defensive checks: handle null, undefined, or empty inputs
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length === 0) {
    return 0;
  }

  if (!job || typeof job !== "object") {
    return 0;
  }

  // Ensure skills is an array
  const skillsArray = Array.isArray(skills) ? skills : [];

  let score = 0;
  const resumeLower = resumeText.toLowerCase();
  
  // Get job description (prefer description, fallback to jd_text) with defensive checks
  const jobDescription = (
    (typeof job.description === "string" ? job.description : "") ||
    (typeof job.jd_text === "string" ? job.jd_text : "") ||
    ""
  ).toLowerCase();
  
  const jobTitle = (typeof job.title === "string" ? job.title : "").toLowerCase();

  // 1. Skill overlap scoring
  // Check if resume skills appear in job description
  skillsArray.forEach(skill => {
    if (!skill || typeof skill !== "string") return;
    
    const skillLower = skill.toLowerCase();
    if (jobDescription.includes(skillLower)) {
      score += 10;
    }
    // Also check job skills/tags if available
    if (Array.isArray(job.skills) && job.skills.length > 0) {
      const jobSkillsLower = job.skills
        .filter((s): s is string => typeof s === "string")
        .map(s => s.toLowerCase());
      if (jobSkillsLower.includes(skillLower)) {
        score += 10; // Bonus if skill is explicitly listed
      }
    }
    if (Array.isArray(job.tags) && job.tags.length > 0) {
      const jobTagsLower = job.tags
        .filter((t): t is string => typeof t === "string")
        .map(t => t.toLowerCase());
      if (jobTagsLower.includes(skillLower)) {
        score += 5; // Smaller bonus for tag match
      }
    }
  });

  // 2. Keyword matching
  // Common job-related keywords that indicate relevance
  const jobKeywords = [
    "developer", "engineer", "frontend", "backend", "full stack", "fullstack",
    "api", "react", "java", "python", "javascript", "typescript",
    "node", "nodejs", "node.js", "express", "django", "flask",
    "database", "sql", "mongodb", "postgresql", "mysql",
    "aws", "cloud", "docker", "kubernetes", "git",
    "agile", "scrum", "ci/cd", "devops", "testing",
    "machine learning", "ai", "data science", "analytics"
  ];

  jobKeywords.forEach(keyword => {
    if (resumeLower.includes(keyword)) {
      // Check if keyword also appears in job description
      if (jobDescription.includes(keyword)) {
        score += 3;
      }
      // Bonus if keyword appears in job title
      if (jobTitle.includes(keyword)) {
        score += 2;
      }
    }
  });

  // 3. Title match (strong signal)
  // Check if resume mentions the job title or similar roles
  const titleWords = jobTitle.split(/\s+/).filter(word => word.length > 3);
  titleWords.forEach(word => {
    if (resumeLower.includes(word)) {
      score += 5; // Partial title match
    }
  });
  
  // Full title match (strongest signal)
  if (resumeLower.includes(jobTitle)) {
    score += 15;
  }

  // 4. Tech stack match
  // Common tech stack terms
  const techStackTerms = [
    "react", "vue", "angular", "next.js", "node.js", "express",
    "django", "flask", "spring", "laravel", "rails",
    "postgresql", "mongodb", "redis", "elasticsearch",
    "aws", "azure", "gcp", "docker", "kubernetes",
    "typescript", "javascript", "python", "java", "go", "rust"
  ];

  techStackTerms.forEach(tech => {
    const techLower = tech.toLowerCase();
    // Check if tech appears in both resume and job
    if (resumeLower.includes(techLower) && jobDescription.includes(techLower)) {
      score += 5;
    }
    // Bonus if tech is in job skills/tags
    if (resumeLower.includes(techLower)) {
      if (job.skills?.some(s => s.toLowerCase().includes(techLower))) {
        score += 8;
      }
      if (job.tags?.some(t => t.toLowerCase().includes(techLower))) {
        score += 5;
      }
    }
  });

  return score;
}

/**
 * Score a job using extracted skills from resume text
 * Convenience function that extracts skills and scores in one call
 * This function never throws - it always returns a number
 * 
 * @param resumeText - The full resume text
 * @param job - The job object to score
 * @returns A numerical score (higher is better match, 0 if inputs invalid)
 */
export function scoreJobWithResume(resumeText: string | null | undefined, job: JobType | null | undefined): number {
  // Defensive checks
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length === 0) {
    return 0;
  }

  if (!job || typeof job !== "object") {
    return 0;
  }

  try {
    const skills = extractSkillsFromResume(resumeText);
    return scoreJob(resumeText, skills, job);
  } catch (error) {
    // If extraction fails, return 0 instead of throwing
    console.warn("[scoreJobWithResume] Error scoring job:", error instanceof Error ? error.message : String(error));
    return 0;
  }
}

/**
 * Score a job and normalize to 0-100 range
 * This is useful for compatibility with systems expecting percentage scores
 * @param resumeText - The full resume text
 * @param job - The job object to score
 * @param maxScore - Maximum possible score (used for normalization, default: 200)
 * @returns A normalized score from 0-100
 */
export function scoreJobNormalized(
  resumeText: string,
  job: JobType,
  maxScore: number = 200
): number {
  const rawScore = scoreJobWithResume(resumeText, job);
  // Normalize to 0-100 range
  const normalized = Math.min(Math.round((rawScore / maxScore) * 100), 100);
  return Math.max(normalized, 0);
}

/**
 * Get matched skills and tech stack from scoring
 * Helper function to extract which skills/tech matched for display
 * This function never throws - it always returns arrays (empty if inputs are invalid)
 * 
 * @param resumeText - The full resume text
 * @param job - The job object to score
 * @returns Object with matched skills and tech stack arrays
 */
export function getMatchedItems(
  resumeText: string | null | undefined, 
  job: JobType | null | undefined
): {
  matchedSkills: string[];
  matchedTechStack: string[];
} {
  // Defensive checks
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length === 0) {
    return { matchedSkills: [], matchedTechStack: [] };
  }

  if (!job || typeof job !== "object") {
    return { matchedSkills: [], matchedTechStack: [] };
  }

  try {
    const resumeLower = resumeText.toLowerCase();
    const jobDescription = (
      (typeof job.description === "string" ? job.description : "") ||
      (typeof job.jd_text === "string" ? job.jd_text : "") ||
      ""
    ).toLowerCase();
    
    const skills = extractSkillsFromResume(resumeText);
    
    const matchedSkills: string[] = [];
    const matchedTechStack: string[] = [];
    
    // Find matched skills with defensive checks
    if (Array.isArray(skills)) {
      skills.forEach(skill => {
        if (!skill || typeof skill !== "string") return;
        
        const skillLower = skill.toLowerCase();
        if (jobDescription.includes(skillLower) || 
            (Array.isArray(job.skills) && job.skills.some((s): s is string => typeof s === "string" && s.toLowerCase() === skillLower)) ||
            (Array.isArray(job.tags) && job.tags.some((t): t is string => typeof t === "string" && t.toLowerCase() === skillLower))) {
          matchedSkills.push(skill);
        }
      });
    }
    
    // Tech stack terms
    const techStackTerms = [
      "react", "vue", "angular", "next.js", "node.js", "express",
      "django", "flask", "spring", "laravel", "rails",
      "postgresql", "mongodb", "redis", "elasticsearch",
      "aws", "azure", "gcp", "docker", "kubernetes"
    ];
    
    techStackTerms.forEach(tech => {
      const techLower = tech.toLowerCase();
      if (resumeLower.includes(techLower) && 
          (jobDescription.includes(techLower) || 
           (Array.isArray(job.skills) && job.skills.some((s): s is string => typeof s === "string" && s.toLowerCase().includes(techLower))) ||
           (Array.isArray(job.tags) && job.tags.some((t): t is string => typeof t === "string" && t.toLowerCase().includes(techLower))))) {
        matchedTechStack.push(tech);
      }
    });
    
    return {
      matchedSkills: [...new Set(matchedSkills)],
      matchedTechStack: [...new Set(matchedTechStack)],
    };
  } catch (error) {
    // If any error occurs, return empty arrays instead of throwing
    console.warn("[getMatchedItems] Error extracting matched items:", error instanceof Error ? error.message : String(error));
    return { matchedSkills: [], matchedTechStack: [] };
  }
}

