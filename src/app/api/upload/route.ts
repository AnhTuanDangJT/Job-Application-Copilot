import { NextRequest, NextResponse } from "next/server";
import { extractPDF, extractDOCX } from "@/lib/resume/extractText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * File upload and text extraction API endpoint
 * Supports PDF and DOCX files
 * 
 * POST /api/upload
 * Body: FormData with "file" field
 * 
 * Returns:
 * {
 *   message: "File processed successfully",
 *   text: string,
 *   fileName: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Only allow POST method
    if (req.method !== "POST") {
      return NextResponse.json(
        { error: "Method not allowed" },
        { status: 405 }
      );
    }

    // Read uploaded file from FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF and DOCX files are allowed." },
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isPDF = file.type === "application/pdf" || fileExtension === ".pdf";
    const isDOCX = 
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileExtension === ".docx";

    let extractedText = "";
    let extractionMethod = "";

    // Extract text based on file type
    if (isPDF) {
      try {
        // pdf-parse requires Buffer, not ArrayBuffer
        extractedText = await extractPDF(buffer);
        extractionMethod = "pdf-parse";
      } catch (pdfError) {
        console.error("[Upload] PDF extraction error:", pdfError instanceof Error ? pdfError.message : "Unknown error");
        return NextResponse.json(
          { error: "Error processing PDF file" },
          { status: 500 }
        );
      }
    } else if (isDOCX) {
      try {
        extractedText = await extractDOCX(buffer);
        extractionMethod = "mammoth";
      } catch (docxError) {
        console.error("[Upload] DOCX parsing error:", docxError instanceof Error ? docxError.message : "Unknown error");
        return NextResponse.json(
          { error: "Error processing DOCX file" },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF and DOCX files are allowed." },
        { status: 400 }
      );
    }

    // Return success response with extracted text
    // Note: If text is empty, it means extraction failed (image-based PDF or other issue)
    return NextResponse.json({
      message: extractedText 
        ? "File processed successfully" 
        : "File processed but no text could be extracted. The file may be image-based.",
      text: extractedText,
      fileName: file.name,
      extractionMethod: extractionMethod || "unknown",
    });
  } catch (error) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: "Error processing file" },
      { status: 500 }
    );
  }
}

