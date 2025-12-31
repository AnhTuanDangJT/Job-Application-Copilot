import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";

export async function GET() {
  try {
    const conn = await connectToDatabase();
    return NextResponse.json({ ok: true, state: conn.connection.readyState });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}


