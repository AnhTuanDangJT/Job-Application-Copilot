import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { validateRequestBody } from "@/lib/validation";
import { isAIAvailable, generateText } from "@/lib/aiService";
import { extractResumeSkills, normalizeSkills, calculateMatchScore } from "@/lib/skills/matchScore";
import { sanitizeTextContent } from "@/lib/sanitize";
import { z } from "zod";

const skillsGapSchema = z.object({
  role: z.string().min(1).max(200).transform((val) => sanitizeTextContent(val.trim(), 200)),
});

interface RoleSkillsAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
}

/**
 * Use GitHub AI to search for role skill requirements
 * This function uses AI to infer skills based on the role name
 */
async function getRoleSkillsFromAI(role: string): Promise<RoleSkillsAnalysis> {
  if (!isAIAvailable()) {
    throw new Error("AI service is not available. Please configure GITHUB_TOKEN.");
  }

  const systemPrompt = `You are a career and job market expert. Based on job role titles, identify the typical required and preferred skills for that role. Return ONLY valid JSON.`;

  const userMessage = `For the role "${role}", identify the typical skills required for this position.

Return a JSON object with this EXACT structure:
{
  "requiredSkills": ["skill1", "skill2", "skill3", ...],
  "preferredSkills": ["skill1", "skill2", ...]
}

Guidelines:
- Include 8-15 required skills that are essential for this role
- Include 3-8 preferred skills that are nice-to-have
- Use specific, industry-standard skill names (e.g., "React", "Python", "AWS", "Docker")
- Focus on technical skills, tools, frameworks, and technologies
- Be realistic and current with industry standards
- Return ONLY the JSON object, no other text`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.4,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini",
  });

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<RoleSkillsAnalysis>;
    
    return {
      requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.filter((s) => typeof s === "string" && s.trim().length > 0) : [],
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Failed to parse AI analysis. Please try again.");
  }
}

/**
 * Generate next steps recommendations
 */
function generateNextSteps(
  missingSkills: string[],
  role: string,
  matchPercentage: number
): string[] {
  const steps: string[] = [];

  if (missingSkills.length > 0) {
    steps.push(`Focus on learning: ${missingSkills.slice(0, 3).join(", ")}`);
  }

  if (matchPercentage < 60) {
    steps.push("Consider taking online courses or bootcamps to build missing skills");
    steps.push("Build projects to demonstrate your capabilities");
  } else if (matchPercentage < 80) {
    steps.push("Continue developing your skills through practice and projects");
  } else {
    steps.push("You have strong alignment with this role. Highlight your relevant experience in your application.");
  }

  steps.push("Tailor your resume to emphasize matching skills and experience");

  return steps;
}

/**
 * POST /api/skills-gap - Generate skills gap analysis for any role
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.analysis(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const validation = await validateRequestBody(req, skillsGapSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { role } = validation.data;

  try {
    await connectToDatabase();

    // Get user's resume text
    const user = await User.findById(auth.sub).select("cv_text");
    if (!user) {
      return errors.notFound("User not found");
    }

    const resumeText = user.cv_text || "";
    if (!resumeText.trim()) {
      return errors.validation("Please upload your resume first to generate a skills gap analysis.");
    }

    // Extract skills from resume
    const resumeSkills = await extractResumeSkills(resumeText);

    // Get role requirements using GitHub AI
    const roleAnalysis = await getRoleSkillsFromAI(role);

    if (roleAnalysis.requiredSkills.length === 0) {
      return errors.validation("Unable to determine skills for this role. Please try a different role name.");
    }

    // Calculate match score
    const matchPercentage = calculateMatchScore(
      resumeSkills,
      roleAnalysis.requiredSkills,
      roleAnalysis.preferredSkills
    );

    // Find skills you have and missing skills
    const normalizedResume = normalizeSkills(resumeSkills);
    const normalizedRequired = normalizeSkills(roleAnalysis.requiredSkills);
    const normalizedPreferred = normalizeSkills(roleAnalysis.preferredSkills);

    const skillsHave = [
      ...normalizedRequired.filter((req) =>
        normalizedResume.some((res) => res === req || res.includes(req) || req.includes(res))
      ),
      ...normalizedPreferred.filter((pref) =>
        normalizedResume.some((res) => res === pref || pref.includes(res) || res.includes(pref))
      ),
    ];

    // Dedupe skillsHave
    const uniqueSkillsHave = Array.from(new Set(skillsHave));

    const missingSkills = normalizedRequired.filter(
      (req) => !normalizedResume.some((res) => res === req || res.includes(req) || req.includes(res))
    );

    // Generate next steps
    const nextSteps = generateNextSteps(missingSkills, role, matchPercentage);

    return NextResponse.json({
      role,
      matchPercentage,
      skillsHave: uniqueSkillsHave,
      missingSkills,
      nextSteps,
    });
  } catch (error) {
    console.error("Skills gap error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal(
      error instanceof Error ? error.message : "An error occurred while generating skills gap analysis"
    );
  }
}



