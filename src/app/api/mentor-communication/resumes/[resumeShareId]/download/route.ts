import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ResumeShare } from "@/models/ResumeShare";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { isValidObjectId } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resumeShareId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { resumeShareId } = await params;

  try {
    await connectToDatabase();

    // Validate ObjectId
    if (!isValidObjectId(resumeShareId)) {
      return errors.notFound("Resume not found");
    }

    // Find ResumeShare
    const resumeShare = await ResumeShare.findById(resumeShareId).lean();
    if (!resumeShare) {
      return errors.notFound("Resume not found");
    }

    // Ensure user is part of the conversation
    const accessCheck = await assertConversationAccess(
      resumeShare.conversationId.toString(),
      auth.sub
    );
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    /**
     * Normalize stored path
     * Examples we accept:
     *  - uploads/userId/resumes/file.pdf
     *  - uploads\userId\resumes\file.pdf
     */
    const normalizedRelativePath = resumeShare.storagePath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    // Absolute uploads directory
    const uploadsDir = path.resolve(process.cwd(), "uploads");

    // Resolve absolute file path
    const absoluteFilePath = path.resolve(
      process.cwd(),
      normalizedRelativePath
    );

    // SECURITY CHECK — must be inside /uploads
    if (!absoluteFilePath.startsWith(uploadsDir)) {
      console.error("Blocked invalid file path:", absoluteFilePath);
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 500 }
      );
    }

    if (!existsSync(absoluteFilePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const fileBuffer = readFileSync(absoluteFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": resumeShare.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resumeShare.originalName}"`,
      },
    });
  } catch (error) {
    console.error("Download resume error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while downloading resume");
  }
}

