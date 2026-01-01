import { createWorker } from "tesseract.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Extract text from PDF using OCR (Tesseract.js)
 * This is used as a fallback when pdf-parse fails (image-based PDFs)
 * 
 * @param pdfBuffer - PDF file buffer
 * @param tempFilePath - Optional temporary file path (if PDF is already saved)
 * @returns Extracted text from OCR
 */
export async function extractTextFromPDFWithOCR(
  pdfBuffer: Buffer,
  tempFilePath?: string
): Promise<string> {
  // Ensure this only runs server-side
  if (typeof window !== "undefined") {
    throw new Error("OCR is only available server-side");
  }

  let tempFile: string | null = null;
  let cleanup = async () => {};

  try {
    // If no temp file provided, create one
    if (!tempFilePath) {
      const tempDir = os.tmpdir();
      tempFile = path.join(tempDir, `pdf-ocr-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
      await fs.writeFile(tempFile, pdfBuffer);
      cleanup = async () => {
        try {
          await fs.unlink(tempFile!);
        } catch (e) {
          // Ignore cleanup errors
        }
      };
    } else {
      tempFile = tempFilePath;
    }

    // For now, we'll use a simplified approach
    // Note: Tesseract.js works best with images, not PDFs directly
    // For a full implementation, you'd need to:
    // 1. Convert PDF pages to images (using pdfjs-dist + canvas)
    // 2. OCR each image
    // 3. Combine results
    
    // For this implementation, we'll use Tesseract's PDF support if available
    // Otherwise, we'll need to convert PDF to image first
    
    const worker = await createWorker("eng");
    
    try {
      // Try to recognize the PDF directly
      // Note: Tesseract.js v5 may support PDF, but if not, we need image conversion
      const { data: { text } } = await worker.recognize(tempFile);
      await worker.terminate();
      
      return text.trim();
    } catch (ocrError) {
      await worker.terminate();
      console.warn("[OCR] Direct PDF OCR failed, PDF may need to be converted to images first:", ocrError);
      throw new Error("OCR processing failed. PDF may need to be converted to images first.");
    } finally {
      await cleanup();
    }
  } catch (error) {
    await cleanup();
    const errorMessage = error instanceof Error ? error.message : "Unknown OCR error";
    console.error("[OCR] Error:", errorMessage);
    throw error;
  }
}

/**
 * Convert PDF page to image and extract text with OCR
 * This is a more robust approach that converts PDF pages to images first
 * 
 * @param pdfBuffer - PDF file buffer
 * @returns Extracted text from all pages
 */
export async function extractTextFromPDFWithOCRAdvanced(
  pdfBuffer: Buffer
): Promise<string> {
  // This would require:
  // 1. Using pdfjs-dist to render PDF pages
  // 2. Using canvas to convert pages to images
  // 3. Using Tesseract to OCR each image
  // 4. Combining all text
  
  // For now, return empty - this is a placeholder for full implementation
  throw new Error("Advanced OCR with PDF-to-image conversion not yet implemented");
}















