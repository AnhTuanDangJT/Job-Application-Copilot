import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ResumeShare } from "@/models/ResumeShare";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess } from "@/lib/mentorCommunication/access";
// Removed filesystem imports - using MongoDB storage for Vercel compatibility
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

    // Find ResumeShare - don't use lean() when we need Buffer (fileContent)
    const resumeShare = await ResumeShare.findById(resumeShareId);
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

    // Vercel-safe: Serve file content from MongoDB Buffer (preferred) or legacy filesystem
    let fileBuffer: Buffer;
    
    if (resumeShare.fileContent) {
      // New MongoDB storage (Vercel-safe)
      fileBuffer = Buffer.isBuffer(resumeShare.fileContent) 
        ? resumeShare.fileContent 
        : Buffer.from(resumeShare.fileContent);
    } else if (resumeShare.storagePath) {
      // Legacy filesystem storage (for backward compatibility with existing records)
      // Note: This will fail on Vercel but allows existing local/test records to work
      try {
        const fs = await import("fs");
        const path = await import("path");
        
        const normalizedRelativePath = resumeShare.storagePath
          .replace(/\\/g, "/")
          .replace(/^\/+/, "");
        
        const absoluteFilePath = path.resolve(process.cwd(), normalizedRelativePath);
        
        // SECURITY CHECK — must be inside /uploads
        const uploadsDir = path.resolve(process.cwd(), "uploads");
        if (!absoluteFilePath.startsWith(uploadsDir)) {
          console.error("Blocked invalid file path:", absoluteFilePath);
          return NextResponse.json(
            { error: "Invalid file path" },
            { status: 500 }
          );
        }
        
        if (!fs.existsSync(absoluteFilePath)) {
          return NextResponse.json(
            { error: "File not found on filesystem. Please re-upload the resume." },
            { status: 404 }
          );
        }
        
        fileBuffer = fs.readFileSync(absoluteFilePath);
      } catch (fsError) {
        console.error("[Resume Download] Filesystem read error (expected on Vercel):", fsError);
        return NextResponse.json(
          { error: "File not available. This resume needs to be re-uploaded." },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "File content not found. Please re-upload the resume." },
        { status: 404 }
      );
    }

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

