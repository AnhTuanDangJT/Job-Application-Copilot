import { promises as fs } from "fs";
import path from "path";

/**
 * Save uploaded file to disk in user-specific directory
 * @param userId - User ID
 * @param fileType - "cv", "coverletter", "resumes", or "images"
 * @param fileName - Original filename
 * @param fileBuffer - File buffer to save
 * @returns Storage path relative to project root
 */
export async function saveUserFile(
  userId: string,
  fileType: "cv" | "coverletter" | "resumes" | "images",
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  // Create directory structure: uploads/{userId}/{fileType}/
  const uploadsDir = path.join(process.cwd(), "uploads", userId, fileType);
  
  // Ensure directory exists
  await fs.mkdir(uploadsDir, { recursive: true });

  // Sanitize filename to prevent path traversal
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  // Add timestamp to prevent filename conflicts
  const timestamp = Date.now();
  const ext = path.extname(sanitizedFileName);
  const baseName = path.basename(sanitizedFileName, ext);
  const uniqueFileName = `${baseName}-${timestamp}${ext}`;
  
  // Full path to save file
  const filePath = path.join(uploadsDir, uniqueFileName);
  
  // Save file
  await fs.writeFile(filePath, fileBuffer);
  
  // Return relative path from project root with forward slashes only (platform-independent)
  const relativePath = path.join("uploads", userId, fileType, uniqueFileName);
  return relativePath.replace(/\\/g, "/");
}

/**
 * Delete old file if it exists (when user uploads a new file)
 * @param storagePath - Path to file to delete (relative to project root)
 */
export async function deleteUserFile(storagePath: string | undefined | null): Promise<void> {
  if (!storagePath) return;
  
  try {
    const fullPath = path.join(process.cwd(), storagePath);
    await fs.unlink(fullPath);
  } catch (error) {
    // File doesn't exist or already deleted - that's okay
    console.warn(`Could not delete file ${storagePath}:`, error instanceof Error ? error.message : "Unknown error");
  }
}









