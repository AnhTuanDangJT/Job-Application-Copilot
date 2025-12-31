import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "job-app-copilot", ts: Date.now() });
}


