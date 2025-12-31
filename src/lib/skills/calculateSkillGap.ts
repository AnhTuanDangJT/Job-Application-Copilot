/**
 * Calculate skill gap between detected skills and target role requirements
 */

import roleProfilesData from "./roleProfiles.json";
const roleProfiles = roleProfilesData as Record<string, RoleProfile>;
import { SkillGapReport } from "@/models/SkillGapReport";

export interface RoleProfile {
  requiredSkills: string[];
  recommendedProjects: string[];
  nextRoles: string[];
}

/**
 * Get role profile from curated JSON
 */
export function getRoleProfile(targetRole: string): RoleProfile | null {
  return roleProfiles[targetRole] || null;
}

/**
 * Calculate skill gap score and generate report
 */
export function calculateSkillGap(
  detectedSkills: string[],
  targetRole: string
): {
  score: number;
  missingSkills: string[];
  recommendations: string[];
} {
  const profile = getRoleProfile(targetRole);

  if (!profile) {
    // If role not found, return generic recommendations
    return {
      score: 50,
      missingSkills: ["Role-specific skills"],
      recommendations: [
        "Research the requirements for this role",
        "Identify key skills needed",
        "Take relevant courses or projects",
      ],
    };
  }

  // Normalize skills for comparison (case-insensitive)
  const detectedLower = detectedSkills.map((s) => s.toLowerCase());
  const requiredLower = profile.requiredSkills.map((s) => s.toLowerCase());

  // Find missing skills
  const missingSkills = profile.requiredSkills.filter(
    (skill) => !detectedLower.some((detected) => detected.includes(skill.toLowerCase()) || skill.toLowerCase().includes(detected))
  );

  // Calculate score (percentage of required skills found)
  const foundCount = profile.requiredSkills.length - missingSkills.length;
  const score = Math.round((foundCount / profile.requiredSkills.length) * 100);

  // Generate recommendations
  const recommendations: string[] = [];
  if (missingSkills.length > 0) {
    recommendations.push(`Focus on learning: ${missingSkills.slice(0, 3).join(", ")}`);
  }
  if (profile.recommendedProjects.length > 0) {
    recommendations.push(`Recommended project: ${profile.recommendedProjects[0]}`);
  }
  if (score < 70) {
    recommendations.push("Consider taking online courses or bootcamps");
    recommendations.push("Build projects to demonstrate your skills");
  }

  return {
    score,
    missingSkills,
    recommendations,
  };
}

