import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { aiChatSchema, validateRequestBody } from "@/lib/validation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { isAIAvailable, chatCompletion } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  // Check if AI is available
  if (!isAIAvailable()) {
    return errors.internal("AI service is not configured. Please contact administrator.");
  }

  // Rate limiting
  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const rateLimitResult = await rateLimiters.ai(req, auth.sub);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Validation
  const validation = await validateRequestBody(req, aiChatSchema);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  try {
    const { messages } = validation.data;
    const response = await chatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 2000,
    });

    return NextResponse.json({ 
      message: response,
    });
  } catch (error) {
    console.error("AI chat error:", error instanceof Error ? error.message : "Unknown error");
    
    // Don't expose internal errors to users
    const errorMessage = error instanceof Error 
      ? (error.message.includes("timeout") 
          ? "AI request timed out. Please try again."
          : "An error occurred while processing your request. Please try again.")
      : "An error occurred while processing your request.";

    return errors.internal(errorMessage);
  }
}


