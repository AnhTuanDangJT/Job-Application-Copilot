import { NextResponse } from "next/server";

/**
 * Standardized error response format
 */
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 400,
  message?: string,
  code?: string
): NextResponse<ApiError> {
  const response: ApiError = { error };
  if (message) response.message = message;
  if (code) response.code = code;

  return NextResponse.json(response, { status });
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: (message = "Unauthorized") =>
    createErrorResponse("Unauthorized", 401, message),
  
  forbidden: (message = "Forbidden") =>
    createErrorResponse("Forbidden", 403, message),
  
  notFound: (message = "Resource not found") =>
    createErrorResponse("Not Found", 404, message),
  
  validation: (message: string) =>
    createErrorResponse("Validation Error", 400, message, "VALIDATION_ERROR"),
  
  rateLimit: (retryAfter?: number) =>
    createErrorResponse(
      "Too Many Requests",
      429,
      retryAfter
        ? `Rate limit exceeded. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
        : "Rate limit exceeded. Please try again later.",
      "RATE_LIMIT_EXCEEDED"
    ),
  
  internal: (message = "Internal server error") =>
    createErrorResponse("Internal Server Error", 500, message, "INTERNAL_ERROR"),
};

