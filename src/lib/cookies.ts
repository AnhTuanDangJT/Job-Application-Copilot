import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Set authentication token as httpOnly cookie
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Get authentication token from cookie
 */
export function getAuthCookie(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}

