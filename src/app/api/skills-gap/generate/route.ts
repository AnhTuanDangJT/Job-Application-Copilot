import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody } from "@/lib/validation";
import { isAIAvailable, generateText } from "@/lib/aiService";
import { z } from "zod";
import { sanitizeTextContent } from "@/lib/sanitize";

const skillsGapGenerateSchema = z.object({
  resumeText: z.string().min(1).max(100000).transform((val) => sanitizeTextContent(val, 100000)),
  jobDescription: z.string().max(100000).optional().transform((val) => val ? sanitizeTextContent(val, 100000) : undefined),
  jobUrl: z.string().url().max(2000).optional(),
  jobTitle: z.string().max(200).optional().transform((val) => val ? sanitizeTextContent(val, 200) : undefined),
  company: z.string().max(200).optional().transform((val) => val ? sanitizeTextContent(val, 200) : undefined),
  location: z.string().max(200).optional().transform((val) => val ? sanitizeTextContent(val, 200) : undefined),
});

interface AIJobAnalysis {
  role: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
}

/**
 * Fetch job description from URL
 */
async function fetchJobDescriptionFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Simple text extraction - remove HTML tags and decode entities
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit length
    if (text.length > 50000) {
      text = text.substring(0, 50000);
    }

    return text || "";
  } catch (error) {
    console.error("Error fetching job description from URL:", error);
    throw new Error("Failed to fetch job description from URL. Please paste the job description directly.");
  }
}

/**
 * Extract job requirements using AI
 */
async function extractJobRequirements(
  jobDescription: string,
  jobTitle?: string,
  company?: string,
  location?: string
): Promise<AIJobAnalysis> {
  if (!isAIAvailable()) {
    throw new Error("AI service is not available. Please configure GITHUB_TOKEN.");
  }

  const contextInfo = [];
  if (jobTitle) contextInfo.push(`Job Title: ${jobTitle}`);
  if (company) contextInfo.push(`Company: ${company}`);
  if (location) contextInfo.push(`Location: ${location}`);

  const systemPrompt = `You are a job analysis expert. Extract structured information from job descriptions and return ONLY valid JSON.`;

  const userMessage = `Analyze the following job description and return a JSON object with this EXACT structure:
{
  "role": "string",
  "requiredSkills": ["skill1", "skill2", ...],
  "preferredSkills": ["skill1", "skill2", ...],
  "responsibilities": ["responsibility1", "responsibility2", ...]
}

${contextInfo.length > 0 ? `Context:\n${contextInfo.join("\n")}\n\n` : ""}Job Description:
${jobDescription}

Return ONLY the JSON object, no other text.`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.3,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini",
  });

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<AIJobAnalysis>;
    
    return {
      role: parsed.role || jobTitle || "Unknown Role",
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
      responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Failed to parse AI analysis. Please try again.");
  }
}

/**
 * Infer job requirements from job title only
 */
async function inferJobRequirementsFromTitle(jobTitle: string): Promise<AIJobAnalysis & { inferred: boolean }> {
  if (!isAIAvailable()) {
    throw new Error("AI service is not available. Please configure GITHUB_TOKEN.");
  }

  const systemPrompt = `You are a job analysis expert. Based on job titles, infer common requirements and return ONLY valid JSON.`;

  const userMessage = `Based on the job title "${jobTitle}", infer the typical requirements for this role and return a JSON object with this EXACT structure:
{
  "role": "string",
  "requiredSkills": ["skill1", "skill2", ...],
  "preferredSkills": ["skill1", "skill2", ...],
  "responsibilities": ["responsibility1", "responsibility2", ...]
}

Return common, realistic requirements for this role. Return ONLY the JSON object, no other text.`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.5,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini",
  });

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<AIJobAnalysis>;
    
    return {
      role: parsed.role || jobTitle,
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
      responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
      inferred: true,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Failed to infer job requirements. Please try again.");
  }
}

import { extractResumeSkills, normalizeSkills, calculateMatchScore } from "@/lib/skills/matchScore";

/**
 * Generate next steps recommendations
 */
function generateNextSteps(
  missingSkills: string[],
  role: string,
  score: number
): string[] {
  const steps: string[] = [];

  if (missingSkills.length > 0) {
    steps.push(`Focus on learning: ${missingSkills.slice(0, 3).join(", ")}`);
  }

  if (score < 60) {
    steps.push("Consider taking online courses or bootcamps to build missing skills");
    steps.push("Build projects to demonstrate your capabilities");
  } else if (score < 80) {
    steps.push("Continue developing your skills through practice and projects");
  } else {
    steps.push("You have strong alignment with this role. Highlight your relevant experience in your application.");
  }

  steps.push("Tailor your resume to emphasize matching skills and experience");

  return steps;
}

/**
 * POST /api/skills-gap/generate - Generate skills gap analysis with AI-driven match score
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.analysis(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, skillsGapGenerateSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { resumeText, jobDescription, jobUrl, jobTitle, company, location } = validation.data;

  try {
    let finalJobDescription = jobDescription;
    let inferred = false;

    // Priority: jobDescription > jobUrl > jobTitle
    if (!finalJobDescription && jobUrl) {
      try {
        finalJobDescription = await fetchJobDescriptionFromUrl(jobUrl);
      } catch (error) {
        return errors.validation(
          error instanceof Error ? error.message : "Failed to fetch job description from URL. Please paste the job description directly."
        );
      }
    }

    if (!finalJobDescription && jobTitle) {
      // Infer requirements from job title
      try {
        const inferredAnalysis = await inferJobRequirementsFromTitle(jobTitle);
        finalJobDescription = `Job Title: ${jobTitle}\n\nInferred Requirements:\n${inferredAnalysis.requiredSkills.join(", ")}`;
        inferred = true;
      } catch (error) {
        return errors.validation(
          error instanceof Error ? error.message : "Failed to infer job requirements. Please provide a job description."
        );
      }
    }

    if (!finalJobDescription) {
      return errors.validation("Please provide either jobDescription, jobUrl, or jobTitle");
    }

    // Extract skills from resume
    const resumeSkills = await extractResumeSkills(resumeText);

    // Extract job requirements
    const jobAnalysis = await extractJobRequirements(
      finalJobDescription,
      jobTitle,
      company,
      location
    );

    // Calculate match score
    const matchScore = calculateMatchScore(
      resumeSkills,
      jobAnalysis.requiredSkills,
      jobAnalysis.preferredSkills
    );

    // Find skills you have and missing skills
    const normalizedResume = normalizeSkills(resumeSkills);
    const normalizedRequired = normalizeSkills(jobAnalysis.requiredSkills);
    const normalizedPreferred = normalizeSkills(jobAnalysis.preferredSkills);

    const skillsYouHave = [
      ...normalizedRequired.filter((req) =>
        normalizedResume.some((res) => res === req || res.includes(req) || req.includes(res))
      ),
      ...normalizedPreferred.filter((pref) =>
        normalizedResume.some((res) => res === pref || res.includes(pref) || pref.includes(res))
      ),
    ];

    // Dedupe skillsYouHave
    const uniqueSkillsYouHave = Array.from(new Set(skillsYouHave));

    const missingSkills = normalizedRequired.filter(
      (req) => !normalizedResume.some((res) => res === req || res.includes(req) || req.includes(res))
    );

    // Generate next steps
    const nextSteps = generateNextSteps(missingSkills, jobAnalysis.role, matchScore);

    return NextResponse.json({
      matchScore,
      role: jobAnalysis.role,
      skillsYouHave: uniqueSkillsYouHave,
      missingSkills,
      requiredSkills: jobAnalysis.requiredSkills,
      preferredSkills: jobAnalysis.preferredSkills,
      nextSteps,
      generatedAt: new Date().toISOString(),
      ...(inferred && { inferred: true }),
    });
  } catch (error) {
    console.error("Skills gap generate error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal(
      error instanceof Error ? error.message : "An error occurred while generating skills gap analysis"
    );
  }
}

