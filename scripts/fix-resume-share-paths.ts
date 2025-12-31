import "dotenv/config";
import { connectToDatabase } from "../src/lib/db";
import { ResumeShare } from "../src/models/ResumeShare";

/**
 * Migration script to fix storagePath in ResumeShare documents
 * 
 * This script normalizes storagePath values that may contain:
 * - Absolute Windows paths (C:\Users\...)
 * - Backslashes instead of forward slashes
 * - Paths that include "public/" prefix
 * 
 * It converts them to relative paths with forward slashes only:
 * uploads/{userId}/resumes/{filename}
 * 
 * Usage:
 *   npx tsx scripts/fix-resume-share-paths.ts
 */

async function main() {
  console.log("Connecting to database...");
  await connectToDatabase();
  console.log("Connected successfully.\n");

  console.log("Finding all ResumeShare documents...");
  const resumeShares = await ResumeShare.find({}).lean();
  console.log(`Found ${resumeShares.length} ResumeShare document(s).\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const resumeShare of resumeShares) {
    const originalPath = resumeShare.storagePath;
    
    // Skip if already in correct format (starts with "uploads/" and uses forward slashes)
    if (originalPath.startsWith("uploads/") && !originalPath.includes("\\")) {
      console.log(`✓ Skipping (already correct): ${originalPath}`);
      skippedCount++;
      continue;
    }

    let fixedPath: string;

    // Check if path contains "uploads" (might be absolute or have wrong separators)
    if (originalPath.includes("uploads")) {
      // Extract path starting from "uploads"
      const idx = originalPath.indexOf("uploads");
      fixedPath = originalPath
        .substring(idx)
        .replace(/\\/g, "/") // Replace backslashes with forward slashes
        .replace(/^\/+/, ""); // Remove leading slashes
    } else {
      // If path doesn't contain "uploads", try to construct it
      // This handles edge cases where paths might be malformed
      console.warn(`⚠ Warning: Path "${originalPath}" doesn't contain "uploads". Skipping.`);
      skippedCount++;
      continue;
    }

    // Validate the fixed path
    if (!fixedPath.startsWith("uploads/")) {
      console.warn(`⚠ Warning: Fixed path "${fixedPath}" doesn't start with "uploads/". Skipping.`);
      skippedCount++;
      continue;
    }

    // Update the document
    try {
      await ResumeShare.updateOne(
        { _id: resumeShare._id },
        { $set: { storagePath: fixedPath } }
      );
      console.log(`✓ Updated: "${originalPath}" → "${fixedPath}"`);
      updatedCount++;
    } catch (error) {
      console.error(`✗ Failed to update ${resumeShare._id}:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary:");
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total: ${resumeShares.length}`);
  console.log("=".repeat(60));
}

main()
  .then(() => {
    console.log("\nMigration completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nMigration failed:", err);
    process.exit(1);
  });






