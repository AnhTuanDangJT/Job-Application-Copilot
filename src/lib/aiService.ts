/**
 * AI Service for GitHub Models API Integration
 * Uses GitHub Models API with free models: gpt-4o-mini, phi-3, mistral
 * Requires GITHUB_TOKEN from .env.local
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
}

/**
 * Get GitHub Models API token from environment
 * Uses GITHUB_TOKEN as specified in requirements
 */
function getApiKey(): string | null {
  const key = process.env.GITHUB_TOKEN;
  if (!key || key.trim() === "") {
    return null;
  }
  return key.trim();
}

/**
 * Check if AI service is available
 * Fails fast if GITHUB_TOKEN is missing
 */
export function isAIAvailable(): boolean {
  const key = getApiKey();
  if (!key) {
    console.error("[AI Service] GITHUB_TOKEN is not configured. AI features will not work.");
  }
  return key !== null;
}

/**
 * Make a request to GitHub Models API
 * Uses official GitHub Models API endpoint
 */
async function callGitHubModelsAPI(
  messages: ChatMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
    model?: string;
  } = {}
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GITHUB_TOKEN is not configured. Please set GITHUB_TOKEN in .env.local");
  }

  const {
    temperature = 0.7,
    max_tokens = 2000,
    timeout = 30000, // 30 seconds default timeout
    model = "openai/gpt-4o-mini", // Default to free model
  } = options;

  // GitHub Models API endpoint (official)
  const apiUrl = "https://models.github.ai/inference/chat/completions";

  const requestBody: ChatCompletionRequest = {
    model,
    messages,
    temperature,
    max_tokens,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed with status ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const data: ChatCompletionResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "API returned an error");
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from AI model");
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI model");
    }

    return content.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("AI request timed out. Please try again.");
      }
      throw error;
    }
    throw new Error("Unknown error occurred while calling AI service");
  }
}

/**
 * Generate text using AI with a system prompt and user message
 */
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
    model?: string;
  } = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  return callGitHubModelsAPI(messages, options);
}

/**
 * Generate cover letter
 */
export async function generateCoverLetter(
  jobDescription: string,
  resumeText: string,
  tone: "professional" | "confident" | "friendly" = "professional"
): Promise<string> {
  const systemPrompt = `You are a professional career assistant. Write complete, tailored cover letters based on job descriptions and resumes.`;

  const toneInstruction = 
    tone === "confident" 
      ? "Use a confident and assertive tone."
      : tone === "friendly"
      ? "Use a warm and friendly tone."
      : "Use a professional and polished tone.";

  const userMessage = `Write a complete, tailored cover letter based on the following job description and resume.

CRITICAL REQUIREMENTS:
- Generate a FULL cover letter with: Header (date, recipient info), Opening paragraph, Body paragraphs (2-3 paragraphs), Closing paragraph
- Match the job requirements with relevant experience from the resume
- ${toneInstruction}
- Do NOT invent experience that is not in the resume
- Do NOT add personal contact information (name, address, phone, email) - use placeholders like [Your Name], [Your Address], etc.
- Do NOT generate bullet points or summaries
- Generate a complete, flowing letter format
- Start with "Dear Hiring Manager," and end with "Sincerely," followed by "[Your Name]"
- Use proper business letter formatting

Job Description:
${jobDescription}

Resume:
${resumeText}`;

  return generateText(systemPrompt, userMessage, {
    temperature: 0.8,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini", // Use free GitHub Models model
  });
}

/**
 * Get resume feedback
 */
export async function getResumeFeedback(resumeText: string): Promise<string> {
  const systemPrompt = `You are a senior recruiter with years of experience reviewing resumes. Provide constructive, actionable feedback.`;

  const userMessage = `Analyze this resume and provide feedback in the following format:

**Strengths:**
[List key strengths]

**Weaknesses:**
[Identify areas for improvement]

**Actionable Suggestions:**
[Provide specific, actionable improvement suggestions]

Keep feedback constructive, clear, and professional.

Resume:
${resumeText}`;

  return generateText(systemPrompt, userMessage, {
    temperature: 0.7,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini", // Use free GitHub Models model
  });
}

/**
 * Grade and check resume with scoring
 * Returns structured feedback with score, grade, strengths, weaknesses, and ATS tips
 */
export interface ResumeGradingResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  strengths: string[];
  weaknesses: string[];
  atsTips: string[];
  overallFeedback: string;
}

export async function gradeResume(resumeText: string): Promise<ResumeGradingResult> {
  const systemPrompt = `You are an expert resume reviewer and ATS (Applicant Tracking System) specialist. Analyze resumes comprehensively and provide structured feedback with scoring.`;

  const userMessage = `Analyze this resume and provide a comprehensive grading in JSON format. Return ONLY valid JSON, no other text.

Required JSON structure:
{
  "score": 85,
  "grade": "A",
  "strengths": ["Clear formatting", "Relevant experience", "Quantifiable achievements"],
  "weaknesses": ["Missing keywords", "Weak summary section"],
  "atsTips": ["Add more industry keywords", "Use standard section headings", "Avoid graphics"],
  "overallFeedback": "Brief overall assessment (2-3 sentences)"
}

Scoring guidelines:
- Score 0-100 based on: content quality (30%), formatting/ATS compatibility (25%), clarity (20%), relevance (15%), completeness (10%)
- Grade: A (90-100), B (80-89), C (70-79), D (60-69), F (0-59)
- Provide 3-5 specific strengths
- Provide 3-5 specific weaknesses
- Provide 3-5 actionable ATS optimization tips
- Keep overall feedback concise and constructive

Resume:
${resumeText}`;

  const response = await generateText(systemPrompt, userMessage, {
    temperature: 0.5,
    max_tokens: 2000,
    model: "openai/gpt-4o-mini",
  });

  // Parse JSON response
  try {
    // Extract JSON from response (handle cases where AI adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ResumeGradingResult>;

    // Validate and set defaults
    const score = Math.max(0, Math.min(100, parsed.score || 0));
    const grade = getGradeFromScore(score);
    
    return {
      score,
      grade,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      atsTips: Array.isArray(parsed.atsTips) ? parsed.atsTips : [],
      overallFeedback: parsed.overallFeedback || "Resume analysis completed.",
    };
  } catch (error) {
    console.error("Failed to parse resume grading response:", error);
    // Return default structure on parse error
    return {
      score: 0,
      grade: "F",
      strengths: [],
      weaknesses: ["Unable to parse AI response"],
      atsTips: ["Please try again"],
      overallFeedback: "An error occurred while analyzing your resume. Please try again.",
    };
  }
}

function getGradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Generate resume summary
 */
export async function generateResumeSummary(resumeText: string): Promise<string> {
  const systemPrompt = `You are a professional resume analyzer. Create concise, well-structured summaries.`;

  const userMessage = `Create a concise summary of this resume highlighting:
- Key skills and expertise
- Professional experience highlights
- Education and qualifications
- Notable achievements

Keep it brief (2-3 paragraphs) and professional.

Resume:
${resumeText}`;

  return generateText(systemPrompt, userMessage, {
    temperature: 0.6,
    max_tokens: 500,
    model: "openai/gpt-4o-mini", // Use free GitHub Models model
  });
}

/**
 * Rewrite announcement text
 */
export async function rewriteAnnouncement(draftText: string): Promise<string> {
  const systemPrompt = `You are a professional communication assistant. Rewrite text to be clear, professional, and friendly while preserving the original meaning.`;

  const userMessage = `Rewrite the following announcement so it is:
- Clear and easy to understand
- Professional yet approachable
- Friendly and engaging
- Well-structured

Do not change the meaning or key information.

Draft text:
${draftText}`;

  return generateText(systemPrompt, userMessage, {
    temperature: 0.7,
    max_tokens: 1000,
    model: "openai/gpt-4o-mini", // Use free GitHub Models model
  });
}

/**
 * General chat completion
 */
export async function chatCompletion(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  } = {}
): Promise<string> {
  const chatMessages: ChatMessage[] = messages.map((msg) => ({
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content,
  }));

  // Default to free model if not specified
  const model = options.model || "openai/gpt-4o-mini";
  
  return callGitHubModelsAPI(chatMessages, { ...options, model });
}

