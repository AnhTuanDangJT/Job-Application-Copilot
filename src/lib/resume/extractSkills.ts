/**
 * Extract skills from resume text by matching against a list of common skills
 */

/**
 * Extracts skills from resume text by matching against a predefined list of common skills
 * This function never throws - it always returns an array (empty if no skills found or invalid input)
 * 
 * @param text - The resume text to search for skills
 * @returns Array of unique skills found in the resume text (empty array if text is invalid)
 */
export function extractSkillsFromResume(text: string | null | undefined): string[] {
  // Defensive check: handle null, undefined, or empty text
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return [];
  }

  const textLower = text.toLowerCase();

  const commonSkills = [
    "Java", "Python", "C", "JavaScript", "TypeScript", "HTML", "CSS", "SQL",
    "React", "Vue", "Angular", "Node.js", "NodeJS", "Express", "Django", "Flask", "FastAPI",
    "PostgreSQL", "MongoDB", "MySQL", "Redis", "Docker", "Kubernetes", "Git", "Bash",
    "Machine Learning", "AI", "TensorFlow", "scikit-learn", "PyTorch",
    "AWS", "GCP", "Azure", "Spring Boot", "GraphQL", "REST API",
    "Next.js", "Vue.js", "AngularJS", "jQuery", "SASS", "LESS",
    "Jenkins", "CI/CD", "DevOps", "Linux", "Unix", "Windows"
  ];

  try {
    const found = commonSkills.filter(skill => {
      const skillLower = skill.toLowerCase();
      // Use word boundaries for better matching (prevents false positives)
      const regex = new RegExp(`\\b${skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(textLower);
    });

    // Return unique skills in original case
    return [...new Set(found)];
  } catch (error) {
    // If regex or matching fails, return empty array instead of throwing
    console.warn("[extractSkills] Error extracting skills:", error instanceof Error ? error.message : String(error));
    return [];
  }
}




