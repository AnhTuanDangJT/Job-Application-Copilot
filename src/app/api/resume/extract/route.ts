import { NextRequest, NextResponse } from "next/server";
import { extractResumeText } from "@/lib/resume/extractText";
import { withTimeout } from "@/lib/utils/timeoutPromise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

/**
 * POST /api/resume/extract
 * Extract text from uploaded PDF or DOCX resume file
 * 
 * This endpoint:
 * - Validates file type and size
 * - Converts file to Node.js Buffer
 * - Extracts text using appropriate method (pdf-parse for PDFs, mammoth for DOCX)
 * - Returns extracted text with success status
 */
export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();

  try {
    // Server-side guard
    if (typeof window !== "undefined") {
      throw new Error("This endpoint must only run on the server");
    }

    // Parse form data with timeout
    let formData: FormData;
    try {
      formData = await withTimeout(
        req.formData(),
        10000, // 10 second timeout for form parsing
        "Form data parsing timeout"
      );
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : "Failed to parse form data";
      console.error("[RESUME EXTRACT] Form data parsing error:", errorMessage);
      return NextResponse.json(
        { success: false, error: "Failed to parse uploaded file. Please ensure the file is valid." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded. Please select a PDF or DOCX file." },
        { status: 400 }
      );
    }

    console.log("[RESUME EXTRACT] File received:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file size
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "File is empty. Please upload a valid file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { success: false, error: `File size (${fileSizeMB}MB) exceeds maximum allowed size of 5MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
    
    if (!isValidMimeType && !isValidExtension) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type. Please upload a PDF or DOCX file. (Received: ${file.type || "unknown"})` },
        { status: 400 }
      );
    }

    // Convert file to Node.js Buffer with timeout
    let buffer: Buffer;
    try {
      const arrayBuffer = await withTimeout(
        file.arrayBuffer(),
        5000, // 5 second timeout for buffer conversion
        "File buffer conversion timeout"
      );
      buffer = Buffer.from(arrayBuffer);
      
      if (!buffer || buffer.length === 0) {
        throw new Error("File buffer is empty after conversion");
      }
      
      console.log("[RESUME EXTRACT] Buffer created:", {
        length: buffer.length,
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
      });
    } catch (bufferError) {
      const errorMessage = bufferError instanceof Error ? bufferError.message : "Failed to process file";
      console.error("[RESUME EXTRACT] Buffer conversion error:", errorMessage);
      return NextResponse.json(
        { success: false, error: "Failed to process uploaded file. Please try again." },
        { status: 500 }
      );
    }

    // Determine file type
    const isPDF = file.type === "application/pdf" || fileExtension === ".pdf";
    const isDOCX = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileExtension === ".docx";

    let text = "";

    // Extract text based on file type using unified extraction function
    if (isPDF) {
      console.log("[RESUME EXTRACT] Starting PDF extraction...");
      
      try {
        // Use unified extraction function (uses pdf-parse internally)
        const mimeTypeOrExtension = file.type || fileExtension;
        text = await extractResumeText(buffer, mimeTypeOrExtension);
        console.log("[RESUME EXTRACT] PDF extraction completed:", text.length, "characters");
      } catch (pdfErr) {
        const pdfErrorMessage = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        console.error("[RESUME EXTRACT] PDF extraction failed:", pdfErrorMessage);
        
        // Check if error indicates image-based PDF
        if (pdfErrorMessage.includes("image-based") || pdfErrorMessage.includes("Unable to extract")) {
          return NextResponse.json(
            {
              success: false,
              error: "This PDF appears to be image-based. Please upload a text-based PDF or DOCX.",
            },
            { status: 400 }
          );
        }
        
        // For other errors, return the error message
        return NextResponse.json(
          {
            success: false,
            error: `Failed to extract text from PDF: ${pdfErrorMessage}. Please ensure the file is a valid text-based PDF.`,
          },
          { status: 400 }
        );
      }
    } else if (isDOCX) {
      console.log("[RESUME EXTRACT] Starting DOCX extraction...");
      try {
        // Use unified extraction function
        const mimeTypeOrExtension = file.type || fileExtension;
        text = await extractResumeText(buffer, mimeTypeOrExtension);
        console.log("[RESUME EXTRACT] DOCX extraction completed:", text.length, "characters");
      } catch (docxErr) {
        const docxErrorMessage = docxErr instanceof Error ? docxErr.message : String(docxErr);
        console.error("[RESUME EXTRACT] DOCX extraction failed:", docxErrorMessage);
        
        return NextResponse.json(
          {
            success: false,
            error: `Failed to extract text from DOCX file: ${docxErrorMessage}. Please ensure the file is a valid DOCX document.`,
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Please upload PDF or DOCX." },
        { status: 400 }
      );
    }

    // Validate extracted text (should not be needed since extractResumeText throws on empty, but keep as safety)
    const trimmedText = text?.trim() || "";
    if (trimmedText.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "This PDF appears to be image-based. Please upload a text-based PDF or DOCX.",
        },
        { status: 400 }
      );
    }

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[RESUME EXTRACT] Extraction completed successfully in ${requestDuration}ms:`, {
      fileName: file.name,
      fileSize: file.size,
      textLength: trimmedText.length,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      text: trimmedText,
      fileName: file.name,
    });
  } catch (err: unknown) {
    const requestDuration = Date.now() - requestStartTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    console.error(`[RESUME EXTRACT] Unexpected error after ${requestDuration}ms:`, {
      error: errorMessage,
      stack: errorStack,
    });

    // Return user-friendly error message
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while extracting text from your resume. Please try again or contact support if the issue persists.",
      },
      { status: 500 }
    );
  }
}

