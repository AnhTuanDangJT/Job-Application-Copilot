import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { errors } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return errors.internal("Database connection failed. Please try again later.");
    }

    // Get user document with all document-related fields including extracted text
    const user = await User.findById(auth.sub).select(
      "cv_filename cv_storage_path cv_uploaded_at cv_text cover_letter_filename cover_letter_storage_path cover_letter_uploaded_at cover_letter_text"
    );
    if (!user) {
      return errors.notFound("User not found");
    }

    // Prepare response
    const cvFilename = user.cv_filename || "";
    const cvStoragePath = user.cv_storage_path || "";
    const cvUploadedAt = user.cv_uploaded_at;
    const cvText = user.cv_text || "";
    const coverLetterFilename = user.cover_letter_filename || "";
    const coverLetterStoragePath = user.cover_letter_storage_path || "";
    const coverLetterUploadedAt = user.cover_letter_uploaded_at;
    const coverLetterText = user.cover_letter_text || "";

    // Check upload status based on filename
    const cvUploaded = !!cvFilename;
    const coverLetterUploaded = !!coverLetterFilename;

    // Create text preview (first 200 characters)
    const getTextPreview = (text: string, maxLength: number = 200) => {
      if (!text || text.length === 0) return null;
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + "...";
    };

    return NextResponse.json({
      cv: {
        uploaded: cvUploaded,
        fileName: cvFilename || null,
        storagePath: cvStoragePath || null,
        uploadedAt: cvUploadedAt ? cvUploadedAt.toISOString() : null,
        extractedText: cvText || null, // Full extracted text (for job matching)
        extractedTextPreview: getTextPreview(cvText),
        extractedTextLength: cvText ? cvText.length : 0,
      },
      coverLetter: {
        uploaded: coverLetterUploaded,
        fileName: coverLetterFilename || null,
        storagePath: coverLetterStoragePath || null,
        uploadedAt: coverLetterUploadedAt ? coverLetterUploadedAt.toISOString() : null,
        extractedText: coverLetterText || null, // Full extracted text
        extractedTextPreview: getTextPreview(coverLetterText),
        extractedTextLength: coverLetterText ? coverLetterText.length : 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Documents fetch error:", errorMessage);
    return errors.internal("Failed to fetch documents. Please try again.");
  }
}
