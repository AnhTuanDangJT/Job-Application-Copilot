import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { Types } from "mongoose";

export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  try {
    await connectToDatabase();

    // Convert auth.sub to ObjectId for proper matching
    const userId = new Types.ObjectId(auth.sub);

    // Optimized: Use aggregation with lookup to avoid N+1 query
    const apps = await Application.aggregate([
      { $match: { userId: userId } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      {
        $project: {
          id: { $toString: "$_id" },
          status: 1,
          dateSubmitted: 1,
          job: {
            $cond: {
              if: { $gt: [{ $size: "$job" }, 0] },
              then: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: "$job",
                      as: "j",
                      in: {
                        id: { $toString: "$$j._id" },
                        title: "$$j.title",
                        company: "$$j.company",
                      },
                    },
                  },
                  0,
                ],
              },
              else: null,
            },
          },
        },
      },
    ]);

    return NextResponse.json(
      { history: apps },
      {
        headers: {
          "Cache-Control": "private, no-store", // Don't cache user-specific data
        },
      }
    );
  } catch (error) {
    console.error("Get application history error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching application history");
  }
}


