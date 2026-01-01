/**
 * Shared utilities for AI-driven match score calculation
 */

import { isAIAvailable, generateText } from "@/lib/aiService";

export interface JobRequirements {
  requiredSkills: string[];
  preferredSkills: string[];
}

/**
 * Extract skills from resume using AI
 */
export async function extractResumeSkills(resumeText: string): Promise<string[]> {
  if (!isAIAvailable()) {
    throw new Error("AI service is not available. Please configure GITHUB_TOKEN.");
  }

  const systemPrompt = `You are a resume analysis expert. Extract skills from resumes and return ONLY a JSON array of skill strings.`;

  const userMessage = `Extract all technical and professional skills from this resume. Return ONLY a JSON array of skill strings, no other text.

Example format: ["JavaScript", "React", "Node.js", "Python", "SQL"]

Resume:
${resumeText}`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.3,
    max_tokens: 1000,
    model: "openai/gpt-4o-mini",
  });

  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON array");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error("AI did not return an array");
    }
    return parsed.filter((s) => typeof s === "string" && s.trim().length > 0);
  } catch (error) {
    console.error("Failed to parse resume skills:", error);
    throw new Error("Failed to extract skills from resume. Please try again.");
  }
}

/**
 * Extract job requirements from job description using AI
 */
export async function extractJobRequirements(jobDescription: string): Promise<JobRequirements> {
  if (!isAIAvailable()) {
    throw new Error("AI service is not available. Please configure GITHUB_TOKEN.");
  }

  const systemPrompt = `You are a job analysis expert. Extract structured information from job descriptions and return ONLY valid JSON.`;

  const userMessage = `Analyze the following job description and return a JSON object with this EXACT structure:
{
  "requiredSkills": ["skill1", "skill2", ...],
  "preferredSkills": ["skill1", "skill2", ...]
}

Return ONLY the JSON object, no other text.

Job Description:
${jobDescription}`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.3,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini",
  });

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<JobRequirements>;
    
    return {
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Failed to parse AI analysis. Please try again.");
  }
}

/**
 * Normalize skills: lowercase, trim, dedupe
 */
export function normalizeSkills(skills: string[]): string[] {
  const normalized = skills
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 0);
  
  // Dedupe
  return Array.from(new Set(normalized));
}

/**
 * Calculate match score
 */
export function calculateMatchScore(
  resumeSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[]
): number {
  const normalizedResume = normalizeSkills(resumeSkills);
  const normalizedRequired = normalizeSkills(requiredSkills);
  const normalizedPreferred = normalizeSkills(preferredSkills);

  // Find overlaps
  const requiredOverlap = normalizedRequired.filter((req) =>
    normalizedResume.some((res) => res === req || res.includes(req) || req.includes(res))
  );

  const preferredOverlap = normalizedPreferred.filter((pref) =>
    normalizedResume.some((res) => res === pref || res.includes(pref) || pref.includes(res))
  );

  // Calculate score
  const requiredScore = normalizedRequired.length > 0
    ? (requiredOverlap.length / normalizedRequired.length) * 0.75
    : 0;

  const preferredScore = normalizedPreferred.length > 0
    ? (preferredOverlap.length / normalizedPreferred.length) * 0.25
    : 0;

  const score = (requiredScore + preferredScore) * 100;

  // Clamp between 0 and 100, NEVER default to 50%
  return Math.max(0, Math.min(100, Math.round(score)));
}



