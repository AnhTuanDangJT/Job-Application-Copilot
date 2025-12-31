import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { saveUserFile, deleteUserFile } from "@/lib/fileStorage";
import { extractResumeText } from "@/lib/resume/extractText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.api(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
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
    
    console.log("[UPLOAD] File received:", file?.name, file?.type, file?.size);

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

    // Validate file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = [".pdf", ".docx"];
    const isValidType = ALLOWED_TYPES.includes(file.type) || allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      return errors.validation(`Invalid file type (${file.type || "unknown"}). Only PDF and DOCX files are allowed.`);
    }

    console.log("[UPLOAD] Starting extraction...");
    
    // Fix 1: Always convert to proper Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    console.log("[UPLOAD] arrayBuffer length:", arrayBuffer.byteLength);

    const buffer = Buffer.from(arrayBuffer);
    console.log("[UPLOAD] buffer length:", buffer.length);
    
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      return errors.validation("Invalid file buffer");
    }

    // Store in database
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return errors.internal("Database connection failed. Please try again later.");
    }

    // Detect file type using MIME type or extension
    const isPDF = file.type === "application/pdf" || fileExtension === ".pdf";
    const isDOCX = 
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileExtension === ".docx";

    // Extract text from file using unified extraction function
    let extractedText: string | null = null;
    try {
      // Determine MIME type or extension for unified extraction
      const mimeTypeOrExtension = file.type || fileExtension;
      
      console.log(`[Cover Letter Upload] Extracting text from ${isPDF ? "PDF" : "DOCX"} file...`);
      extractedText = await extractResumeText(buffer, mimeTypeOrExtension);
      console.log(`[Cover Letter Upload] Extraction completed, extracted ${extractedText?.length || 0} characters`);
      
      if (!extractedText || extractedText.trim().length === 0) {
        console.warn(`[Cover Letter Upload] Extraction returned empty text for ${isPDF ? "PDF" : "DOCX"} file`);
        extractedText = null;
      }
    } catch (extractError) {
      // Proper error reporting with detailed logging
      console.error("[Cover Letter Upload] Text extraction error:", extractError);
      console.error("[Cover Letter Upload] Error stack:", extractError instanceof Error ? extractError.stack : "N/A");
      console.error("[Cover Letter Upload] Error name:", extractError instanceof Error ? extractError.name : "N/A");
      console.error("[Cover Letter Upload] Error message:", extractError instanceof Error ? extractError.message : String(extractError));
      
      const errorMessage = extractError instanceof Error 
        ? extractError.message 
        : "Unknown extraction error";
      
      // Return user-friendly error message
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to extract text from ${isPDF ? "PDF" : "DOCX"} cover letter: ${errorMessage}` 
        },
        { status: 500 }
      );
    }

    // Get existing user to check for old file
    const existingUser = await User.findById(auth.sub).select("cover_letter_storage_path");
    const oldStoragePath = existingUser?.cover_letter_storage_path;

    // Save file to disk
    let storagePath: string;
    try {
      storagePath = await saveUserFile(auth.sub, "coverletter", file.name, buffer);
    } catch (fileError) {
      console.error("[Cover Letter Upload] File save error:", fileError);
      return errors.internal("Failed to save file to storage. Please try again.");
    }

    // Delete old file if it exists
    if (oldStoragePath) {
      await deleteUserFile(oldStoragePath);
    }

    try {
      // Store filename, storage path, timestamp, and extracted text
      const updateData: {
        cover_letter_filename: string;
        cover_letter_storage_path: string;
        cover_letter_uploaded_at: Date;
        cover_letter_text?: string;
      } = {
        cover_letter_filename: file.name,
        cover_letter_storage_path: storagePath,
        cover_letter_uploaded_at: new Date(),
      };

      // Only add cover_letter_text if extraction was successful
      if (extractedText && extractedText.trim().length > 0) {
        updateData.cover_letter_text = extractedText.trim();
      }

      console.log("[UPLOAD] Saving text to DB...");

      const updateResult = await User.findByIdAndUpdate(
        auth.sub,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        // If DB update fails, try to clean up the saved file
        await deleteUserFile(storagePath);
        console.error("[Cover Letter Upload] User not found:", auth.sub);
        return errors.notFound("User not found");
      }

      // Verify cover_letter_text was saved
      const savedText = updateResult.cover_letter_text;
      const textLength = savedText ? savedText.length : 0;
      console.log(`[Cover Letter Upload] Successfully saved - filename="${updateResult.cover_letter_filename}", storage="${storagePath}"`);
      console.log(`[Cover Letter Upload] cover_letter_text saved: ${textLength > 0 ? 'YES' : 'NO'}, length=${textLength}`);
      
      if (extractedText && textLength === 0) {
        console.error(`[Cover Letter Upload] WARNING: Text was extracted (${extractedText.length} chars) but cover_letter_text is empty in DB!`);
      }
    } catch (dbUpdateError) {
      // If DB update fails, try to clean up the saved file
      await deleteUserFile(storagePath);
      console.error("Database update error:", dbUpdateError);
      return errors.internal("Failed to save cover letter to database. Please try again.");
    }

    // Return success response with required format
    return NextResponse.json({
      success: true,
      text: extractedText || "",
      fileUrl: storagePath,
      fileName: file.name,
    });
  } catch (error) {
    // Catch-all for any unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Cover letter upload unexpected error:", errorMessage, errorStack);
    
    // Return user-friendly error message
    return errors.internal("An unexpected error occurred while processing the cover letter. Please try again or contact support if the issue persists.");
  }
}
