import mammoth from "mammoth";
import { withTimeout } from "@/lib/utils/timeoutPromise";

// Import pdf-parse using require (pdf-parse@1.1.1 uses CommonJS)
const pdfParseModule = require("pdf-parse");
const pdfParse = pdfParseModule.default || pdfParseModule;

// Validate pdf-parse export
if (typeof pdfParse !== "function") {
  throw new Error("Invalid pdf-parse export: pdf-parse module does not export a function");
}

/**
 * Unified function to extract text from resume files (PDF or DOCX)
 * 
 * @param buffer - File buffer (must be proper Node.js Buffer)
 * @param mimeTypeOrExtension - MIME type (e.g., "application/pdf") or file extension (e.g., ".pdf", ".docx")
 * @returns Extracted text as a trimmed string
 * @throws Error if extraction fails or file type is unsupported
 */
export async function extractResumeText(
  buffer: Buffer,
  mimeTypeOrExtension: string
): Promise<string> {
  // Server-side guard
  if (typeof window !== "undefined") {
    throw new Error("extractResumeText must only be called on the server");
  }

  // Validate buffer
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid file buffer provided");
  }

  // Validate buffer size (prevent memory issues)
  const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB max
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new Error(`File buffer too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
  }

  // Normalize MIME type or extension to lowercase for comparison
  const normalizedType = mimeTypeOrExtension.toLowerCase().trim();

  // Determine file type
  const isPDF = 
    normalizedType === "application/pdf" || 
    normalizedType === ".pdf" || 
    normalizedType === "pdf";
  
  const isDOCX = 
    normalizedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedType === ".docx" ||
    normalizedType === "docx";

  // Extract text based on file type
  let extracted: string;
  if (isPDF) {
    extracted = await extractPDF(buffer);
  } else if (isDOCX) {
    extracted = await extractDOCX(buffer);
  } else {
    throw new Error(`Unsupported resume type: ${mimeTypeOrExtension}. Only PDF and DOCX files are supported.`);
  }

  // Check if extraction returned empty text
  if (!extracted || extracted.trim().length === 0) {
    const fileType = isPDF ? "PDF" : "DOCX";
    throw new Error(`Unable to extract text from ${fileType} file. The file may be image-based, corrupted, or empty. Please upload a text-based ${fileType} file.`);
  }

  // Normalize whitespace
  const normalized = extracted
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  return normalized;
}

/**
 * Extract text from PDF using pdf-parse
 * 
 * @param buffer - PDF file buffer (must be proper Node.js Buffer)
 * @returns Extracted text (empty string if extraction fails or returns empty)
 */
export async function extractPDF(buffer: Buffer): Promise<string> {
  // Server-side guard
  if (typeof window !== "undefined") {
    throw new Error("extractPDF must only be called on the server");
  }

  // Validate buffer
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid PDF buffer provided");
  }

  // Validate buffer size (prevent memory issues)
  const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB max
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new Error(`PDF buffer too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
  }

  const startTime = Date.now();

  try {
    // Try pdf-parse with timeout
    const result = await withTimeout(
      pdfParse(buffer),
      8000,
      "pdf-parse timeout (8 seconds)"
    );
    
    const text = (result && result.text) || "";
    const trimmedText = text.trim();
    
    const duration = Date.now() - startTime;
    
    if (trimmedText.length > 0) {
      console.log(`[PDF] pdf-parse extraction completed in ${duration}ms, extracted ${trimmedText.length} characters`);
      return trimmedText;
    } else {
      console.log(`[PDF] pdf-parse extraction completed in ${duration}ms, but returned empty text`);
      return "";
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[PDF] extractPDF error after ${duration}ms:`, errorMessage);
    
    // Return empty string on error (no OCR, no external workers)
    return "";
  }
}

/**
 * Extract text from DOCX file using mammoth
 * 
 * @param buffer - DOCX file buffer (must be proper Node.js Buffer)
 * @returns Extracted text (empty string if extraction fails)
 */
export async function extractDOCX(buffer: Buffer): Promise<string> {
  // Server-side guard
  if (typeof window !== "undefined") {
    throw new Error("extractDOCX must only be called on the server");
  }

  // Validate buffer
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid DOCX buffer provided");
  }

  // Validate buffer size
  const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50MB max
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new Error(`DOCX buffer too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
  }

  const startTime = Date.now();

  try {
    // Wrap mammoth extraction with timeout to prevent hanging
    const result = await withTimeout(
      mammoth.extractRawText({ buffer }),
      10000, // 10 second timeout for DOCX
      "mammoth extraction timeout (10 seconds)"
    );
    
    const extractedText = (result.value || "").trim();
    const duration = Date.now() - startTime;
    console.log(`[DOCX] mammoth extraction completed in ${duration}ms, extracted ${extractedText.length} characters`);
    
    return extractedText;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[DOCX] extractDOCX error after ${duration}ms:`, errorMessage);
    
    throw new Error(`Failed to extract DOCX text: ${errorMessage}`);
  }
}
