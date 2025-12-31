import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: "Logged out successfully" });
  clearAuthCookie(response);
  return response;
}

