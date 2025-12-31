import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Allow mentors OR admins (email-based) to access mentor overview
  const auth = requireRole(req, ["mentor"]);
  if (auth instanceof Response) return auth;

  try {
    await connectToDatabase();

    // Optimized: Use aggregation to get all counts in one query
    const stats = await Application.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          submitted: [{ $match: { status: "submitted" } }, { $count: "count" }],
          interview: [{ $match: { status: "interview" } }, { $count: "count" }],
          offer: [{ $match: { status: "offer" } }, { $count: "count" }],
        },
      },
    ]);

    const result = {
      total: stats[0]?.total[0]?.count || 0,
      submitted: stats[0]?.submitted[0]?.count || 0,
      interview: stats[0]?.interview[0]?.count || 0,
      offer: stats[0]?.offer[0]?.count || 0,
    };

    // Return only aggregate statistics (no sensitive data)
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=60", // Cache for 60 seconds
      },
    });
  } catch (error) {
    console.error("Mentor overview error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching overview");
  }
}


