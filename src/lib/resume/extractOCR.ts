import Tesseract from "tesseract.js";
import { withTimeout } from "@/lib/utils/timeoutPromise";

/**
 * Extract text from PDF using OCR (Tesseract.js)
 * This is used as a fallback when pdf-parse fails (image-based PDFs)
 * 
 * @param buffer - PDF file buffer (must be proper Node.js Buffer)
 * @returns Extracted text (empty string if OCR fails)
 */
export async function extractPDFWithOCR(buffer: Buffer): Promise<string> {
  // Server-side guard - ensure this never runs client-side
  if (typeof window !== "undefined") {
    throw new Error("OCR must only be called on the server");
  }

  // Validate buffer
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid PDF buffer provided for OCR");
  }

  // Validate buffer size (OCR is memory-intensive)
  const MAX_BUFFER_SIZE = 20 * 1024 * 1024; // 20MB max for OCR
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new Error(`PDF buffer too large for OCR: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: 20MB)`);
  }

  const startTime = Date.now();
  console.log("[OCR] Starting OCR extraction...");

  // Create OCR task with proper error handling
  const ocrTask = new Promise<string>(async (resolve, reject) => {
    try {
      // Ensure Tesseract is available
      if (!Tesseract || typeof Tesseract.recognize !== "function") {
        reject(new Error("Tesseract.js OCR library is not available"));
        return;
      }

      // Perform OCR recognition
      const { data } = await Tesseract.recognize(buffer, "eng", {
        logger: (m) => {
          // Only log important progress updates, not every message
          if (m.status === "recognizing text" && m.progress >= 0.5) {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const extractedText = (data?.text || "").trim();
      const duration = Date.now() - startTime;
      console.log(`[OCR] OCR extraction completed in ${duration}ms, extracted ${extractedText.length} characters`);
      
      resolve(extractedText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[OCR] OCR task error after ${Date.now() - startTime}ms:`, errorMessage);
      reject(err);
    }
  });

  try {
    // HARD TIMEOUT: 30 seconds for OCR (it's slower than pdf-parse)
    const extractedText = await withTimeout(ocrTask, 30000, "OCR timeout (30 seconds)");
    
    // Free memory after OCR (force garbage collection hint)
    if (global.gc) {
      global.gc();
    }
    
    return extractedText;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[OCR] OCR extraction failed after ${duration}ms:`, errorMessage);
    
    // Always return empty string instead of throwing - let caller decide what to do
    // Re-throw with context for proper error handling upstream
    throw new Error(`OCR extraction failed: ${errorMessage}`);
  }
}
