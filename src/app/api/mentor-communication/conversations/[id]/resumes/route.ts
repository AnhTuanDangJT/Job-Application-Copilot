import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { ResumeShare } from "@/models/ResumeShare";
import { Message } from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { assertConversationAccess, getOtherParticipant } from "@/lib/mentorCommunication/access";
import { saveUserFile, deleteUserFile } from "@/lib/fileStorage";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword", // .doc files
];
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const auth = requireAuth(req);
  if (!auth) return errors.unauthorized("Authentication required");

  const { id } = await params;

  try {
    await connectToDatabase();

    // Check conversation access
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    // List resumes for this conversation, sorted by sharedAt (chronological for timeline)
    const resumes = await ResumeShare.find({ conversationId: id })
      .sort({ sharedAt: 1 }) // Sort ascending for timeline (oldest first)
      .lean();

    return NextResponse.json(
      {
        resumes: resumes.map((resume) => ({
          id: resume._id.toString(),
          conversationId: resume.conversationId.toString(),
          sharedBy: resume.sharedBy.toString(),
          sharedTo: resume.sharedTo.toString(),
          originalName: resume.originalName,
          mimeType: resume.mimeType,
          size: resume.size,
          sharedAt: resume.sharedAt,
          viewedAt: resume.viewedAt,
          status: resume.status || "PENDING_REVIEW",
          reviewedAt: resume.reviewedAt,
          reviewedBy: resume.reviewedBy?.toString(),
          purpose: resume.purpose || "REVIEW",
          versionNumber: resume.versionNumber,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Get resumes error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while fetching resumes");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.api(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  // Authentication - requireAuth MUST be called
  const auth = requireAuth(req);
  if (!auth) {
    return errors.unauthorized("Authentication required");
  }

  // Upload permission: Allow only mentee or mentor roles
  if (auth.role !== "mentee" && auth.role !== "mentor") {
    return errors.forbidden("Only mentees and mentors can upload resumes");
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    // Check conversation access - assertConversationAccess MUST be enforced
    const accessCheck = await assertConversationAccess(id, auth.sub);
    if (!accessCheck.success) {
      return accessCheck.response;
    }

    const conversation = accessCheck.conversation;
    const userId = new Types.ObjectId(auth.sub);
    const menteeId = conversation.menteeId;
    const mentorId = conversation.mentorId;

    // Determine uploader role and set sharedBy/sharedTo accordingly
    let sharedBy: Types.ObjectId;
    let sharedTo: Types.ObjectId;
    let purpose: "REVIEW" | "REFERENCE" | "EDITED_VERSION";

    if (auth.role === "mentee") {
      // Mentee uploads for mentor review
      sharedBy = menteeId;
      sharedTo = mentorId;
      purpose = "REVIEW";
    } else {
      // Mentor uploads reference resume for mentee
      sharedBy = mentorId;
      sharedTo = menteeId;
      purpose = "REFERENCE";
    }

    // Security check: sharedBy MUST equal auth.sub
    if (!sharedBy.equals(userId)) {
      return errors.forbidden("Invalid upload permissions");
    }

    // Ensure sharedBy !== sharedTo
    if (sharedBy.equals(sharedTo)) {
      return errors.validation("Cannot share resume to yourself");
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      console.error("FormData parsing error:", error);
      return errors.validation("Failed to parse form data. Please ensure the request is sent as multipart/form-data.");
    }

    // Get file from form data
    const file = formData.get("file") as File | null;

    if (!file) {
      return errors.validation("No file provided");
    }

    // Validate file size
    if (file.size === 0) {
      return errors.validation("File is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return errors.validation(`File size (${fileSizeMB}MB) exceeds 5MB limit`);
    }

    // Validate file type: pdf/doc/docx only
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isValidType) {
      return errors.validation(`Invalid file type. Only PDF, DOC, and DOCX files are allowed.`);
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) {
      return errors.validation("Invalid file buffer");
    }

    // Save file to disk
    let storagePath: string;
    try {
      storagePath = await saveUserFile(auth.sub, "resumes", file.name, buffer);
    } catch (fileError) {
      console.error("[Resume Upload] File save error:", fileError);
      return errors.internal("Failed to save file to storage. Please try again.");
    }

    // Create ResumeShare entry and Message atomically
    // Clean up file if DB write fails
    try {
      // For mentee uploads (REVIEW), auto-increment versionNumber
      let versionNumber: number | undefined = undefined;
      if (auth.role === "mentee" && purpose === "REVIEW") {
        // Get the highest versionNumber for this conversation's REVIEW resumes
        const latestReview = await ResumeShare.findOne({
          conversationId: new Types.ObjectId(id),
          purpose: "REVIEW",
          versionNumber: { $exists: true },
        })
          .sort({ versionNumber: -1 })
          .select("versionNumber")
          .lean();
        
        versionNumber = latestReview?.versionNumber ? latestReview.versionNumber + 1 : 1;
      }

      const resumeShare = await ResumeShare.create({
        conversationId: new Types.ObjectId(id),
        sharedBy: sharedBy,
        sharedTo: sharedTo,
        storagePath,
        originalName: file.name,
        mimeType: file.type || "application/pdf",
        size: file.size,
        sharedAt: new Date(),
        purpose: purpose,
        versionNumber,
      });

      // Create Message with type FILE
      const messageContent = `Shared resume: ${file.name}`;
      const message = await Message.create({
        conversationId: new Types.ObjectId(id),
        senderId: userId,
        senderRole: auth.role as "mentee" | "mentor",
        type: "FILE",
        content: messageContent,
        resumeShareId: resumeShare._id,
        readBy: [userId], // Sender has read their own message
      });

      // Update conversation lastMessagePreview and lastMessageAt
      // CRITICAL: Only update mutable fields (never mentorId/menteeId)
      // Use updateOne with $set to explicitly update only allowed fields
      await Conversation.updateOne(
        { _id: new Types.ObjectId(id) },
        {
          $set: {
            lastMessagePreview: messageContent,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          id: resumeShare._id.toString(),
          conversationId: resumeShare.conversationId.toString(),
          sharedBy: resumeShare.sharedBy.toString(),
          sharedTo: resumeShare.sharedTo.toString(),
          originalName: resumeShare.originalName,
          mimeType: resumeShare.mimeType,
          size: resumeShare.size,
          sharedAt: resumeShare.sharedAt,
          purpose: resumeShare.purpose,
          versionNumber: resumeShare.versionNumber,
          messageId: message._id.toString(),
        },
        {
          status: 201,
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    } catch (dbError) {
      // If DB operations fail, clean up the file
      console.error("[Resume Upload] DB error after file save:", dbError);
      try {
        await deleteUserFile(storagePath);
      } catch (cleanupError) {
        console.error("[Resume Upload] Failed to cleanup file:", cleanupError);
      }
      return errors.internal("Failed to save resume information. Please try again.");
    }

  } catch (error) {
    console.error("Upload resume error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while uploading resume");
  }
}

