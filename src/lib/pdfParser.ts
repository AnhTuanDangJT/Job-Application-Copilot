export interface ParsePDFResult {
  text?: string;
  warning?: string;
}

/**
 * Parse PDF buffer and extract text content.
 * This function never throws - it always returns a result, even if text extraction fails.
 * 
 * @param buffer - PDF file buffer
 * @returns Object with extracted text and optional warning message
 */
export async function parsePDF(buffer: Buffer): Promise<ParsePDFResult> {
  // Ensure this only runs server-side
  if (typeof window !== "undefined") {
    throw new Error("pdf-parse must run on server");
  }

  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      return {
        text: "",
        warning: "PDF buffer is empty or invalid.",
      };
    }

    // Ensure Node's Buffer type
    let pdfParse: (buffer: Buffer) => Promise<{ text: string }>;

    try {
      pdfParse = require("pdf-parse"); // Fix for ESM/CJS interop
      console.log("[pdf-parse] Loaded OK");
    } catch (err) {
      console.error("[pdf-parse] Failed to load", err);
      return {
        text: "",
        warning: "PDF parsing library is not available. Please ensure pdf-parse is installed.",
      };
    }
    
    // Attempt to parse PDF using pdf-parse
    const result = await pdfParse(buffer);

    // Extract text from parsed data
    const extractedText = result.text || "";

    // Check if text extraction was successful
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        text: "",
        warning: "No text could be extracted from this PDF. The file may be image-based or corrupted. The file has been uploaded successfully, but text analysis features may not work.",
      };
    }

    // Success - return extracted text
    return {
      text: extractedText,
    };
  } catch (error) {
    // Handle any errors gracefully - never throw
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.warn("PDF parsing error (non-blocking):", errorMessage);

    // Return empty result with warning
    return {
      text: "",
      warning: "The PDF file could not be parsed for text extraction. The file has been uploaded successfully, but text analysis features may not work.",
    };
  }
}
