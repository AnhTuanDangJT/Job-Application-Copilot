export type UserRole = "mentee" | "mentor" | "admin"; // Role from database - "admin" is set for admin users

export interface UserProfile {
  skills: string[];
  goals?: string;
}


