/**
 * Generate insights for a document using NLP/AI
 * This is a vendor-agnostic function that can use OpenAI, Anthropic, or other providers
 */

import { DocumentInsightResults } from "@/models/DocumentInsight";

/**
 * Generate insights for a resume or cover letter
 * This is a simplified version - in production, you'd call an actual NLP provider
 */
export async function generateDocumentInsight(
  text: string,
  docType: "resume" | "cover"
): Promise<DocumentInsightResults> {
  // For now, we'll use a simple rule-based approach
  // In production, replace this with actual AI/NLP API calls (OpenAI, Anthropic, etc.)

  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  // Extract common skills (simplified - in production use NLP)
  const commonSkills = [
    "javascript",
    "typescript",
    "python",
    "java",
    "react",
    "node",
    "sql",
    "mongodb",
    "aws",
    "docker",
    "git",
    "html",
    "css",
    "api",
    "rest",
    "graphql",
    "testing",
    "agile",
    "scrum",
    "leadership",
    "communication",
    "problem solving",
    "teamwork",
  ];

  const detectedSkills: string[] = [];
  for (const skill of commonSkills) {
    if (text.toLowerCase().includes(skill)) {
      detectedSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }

  // Generate recommendations
  const actionItems: string[] = [];
  let lengthRecommendation = "";

  if (docType === "resume") {
    if (wordCount < 200) {
      lengthRecommendation = "Resume is too short. Aim for 300-500 words.";
      actionItems.push("Add more detail about your work experience");
      actionItems.push("Include relevant projects and achievements");
    } else if (wordCount > 800) {
      lengthRecommendation = "Resume is too long. Aim for 1-2 pages.";
      actionItems.push("Remove less relevant experiences");
      actionItems.push("Focus on most recent and relevant positions");
    } else {
      lengthRecommendation = "Resume length is appropriate.";
    }

    if (detectedSkills.length < 5) {
      actionItems.push("Add more technical skills relevant to your target role");
    }

    if (!text.toLowerCase().includes("education")) {
      actionItems.push("Include education section if applicable");
    }
  } else {
    // Cover letter
    if (wordCount < 150) {
      lengthRecommendation = "Cover letter is too short. Aim for 200-400 words.";
      actionItems.push("Expand on why you're interested in the role");
      actionItems.push("Add specific examples of your experience");
    } else if (wordCount > 500) {
      lengthRecommendation = "Cover letter is too long. Keep it concise.";
      actionItems.push("Remove redundant information");
      actionItems.push("Focus on key points");
    } else {
      lengthRecommendation = "Cover letter length is appropriate.";
    }
  }

  const overallNotes = `This ${docType} has ${wordCount} words and mentions ${detectedSkills.length} skills. ${
    actionItems.length > 0
      ? "Consider the action items below to improve it."
      : "It looks good overall!"
  }`;

  return {
    detectedSkills,
    missingSkills: [], // Would be populated by comparing against job requirements
    lengthRecommendation,
    actionItems,
    overallNotes,
  };
}

/**
 * Generate insights using GitHub Models API (if configured)
 * Uses GITHUB_TOKEN from .env.local
 */
export async function generateDocumentInsightWithAI(
  text: string,
  docType: "resume" | "cover"
): Promise<DocumentInsightResults> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    // Fallback to rule-based approach if no token
    return generateDocumentInsight(text, docType);
  }

  try {
    const prompt = `Analyze this ${docType} and provide insights:
${text}

Return a JSON object with:
- detectedSkills: array of skills mentioned
- missingSkills: array of commonly expected skills not mentioned
- lengthRecommendation: string with length feedback
- actionItems: array of actionable improvement suggestions
- overallNotes: string with overall assessment`;

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
            content: "You are a career advisor. Analyze documents and provide constructive feedback in JSON format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("GitHub Models API error:", response.status, response.statusText);
      return generateDocumentInsight(text, docType);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return generateDocumentInsight(text, docType);
    }

    const result = JSON.parse(content);
    return result as DocumentInsightResults;
  } catch (error) {
    console.error("GitHub Models API insight generation error:", error);
    // Fallback to rule-based approach
    return generateDocumentInsight(text, docType);
  }
}



