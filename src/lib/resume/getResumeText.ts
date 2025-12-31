import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

/**
 * Get the user's resume text from the database
 * Uses ONLY cv_text field - no file paths or re-extraction
 * @param userId - The user's ID (MongoDB ObjectId as string)
 * @returns The extracted resume text, or null if no resume text exists
 */
export async function getResumeText(userId: string): Promise<string | null> {
  try {
    await connectToDatabase();
    
    // Fetch only cv_text field
    const user = await User.findById(userId).select("cv_text").lean();
    
    if (!user || Array.isArray(user)) {
      return null;
    }
    
    const resumeText = user.cv_text;
    
    // DIAGNOSTIC: Log what we found in the database
    const cvTextLength = resumeText ? resumeText.length : 0;
    const cvTextTrimmedLength = resumeText ? resumeText.trim().length : 0;
    console.log(`[DIAGNOSTIC getResumeText] userId=${userId}, cv_text length in DB=${cvTextLength}, trimmed length=${cvTextTrimmedLength}`);
    
    // If cv_text exists and has content (at least 20 characters) -> return it
    // Lowered from 50 to 20 to be more lenient
    if (resumeText && resumeText.trim().length >= 20) {
      console.log(`[DIAGNOSTIC getResumeText] Returning resume text (length=${resumeText.trim().length})`);
      return resumeText.trim();
    }
    
    // DIAGNOSTIC: Log why we're returning null
    if (!resumeText) {
      console.log(`[DIAGNOSTIC getResumeText] Returning null: cv_text is missing or undefined`);
    } else {
      console.log(`[DIAGNOSTIC getResumeText] Returning null: cv_text is too short (length=${resumeText.trim().length} < 20)`);
    }
    
    // If cv_text is missing, empty, or too short -> return null
    return null;
  } catch (error) {
    console.error("Error fetching resume text:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

