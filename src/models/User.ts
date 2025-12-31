import { Schema, model, models, Document } from "mongoose";
import type { UserRole, UserProfile } from "@/types";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean; // Email verification status
  emailVerificationCodeHash?: string; // Hashed verification code
  emailVerificationExpiresAt?: Date; // Expiration time for verification code
  resume_base?: string;
  cv_text?: string; // Extracted text from uploaded CV (primary source of truth)
  cv_filename?: string; // Filename of uploaded CV (for display purposes)
  cv_storage_path?: string; // Full path to stored CV file on disk (e.g., uploads/{userId}/cv/{filename})
  cv_uploaded_at?: Date; // Timestamp when CV was uploaded
  /** @deprecated cv_path is no longer used. Files are not stored on disk. Only cv_text is used. */
  cv_path?: string; // DEPRECATED: Full path to stored CV file on disk (legacy field, not used in new logic)
  cover_letter_text?: string; // Extracted text from uploaded cover letter
  cover_letter_filename?: string; // Filename of uploaded cover letter
  cover_letter_storage_path?: string; // Full path to stored cover letter file on disk (e.g., uploads/{userId}/coverletter/{filename})
  cover_letter_uploaded_at?: Date; // Timestamp when cover letter was uploaded
  profile?: UserProfile;
  lastSeenAt?: Date; // Timestamp when user was last seen (for presence)
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["mentee", "mentor", "admin"], default: "mentee" },
    emailVerified: { type: Boolean, default: false }, // Default to false for new users
    emailVerificationCodeHash: { type: String, select: false }, // Hashed verification code (not selected by default)
    emailVerificationExpiresAt: { type: Date }, // Expiration time for verification code
    resume_base: { type: String },
    cv_text: { type: String }, // Primary: extracted text from CV
    cv_filename: { type: String }, // Display: original filename
    cv_storage_path: { type: String }, // Storage path on disk
    cv_uploaded_at: { type: Date }, // Upload timestamp
    cv_path: { type: String }, // DEPRECATED: legacy field, not used in new logic
    cover_letter_text: { type: String },
    cover_letter_filename: { type: String },
    cover_letter_storage_path: { type: String }, // Storage path on disk
    cover_letter_uploaded_at: { type: Date }, // Upload timestamp
    profile: {
      skills: { type: [String], default: [] },
      goals: { type: String },
    },
    lastSeenAt: { type: Date }, // Timestamp when user was last seen (for presence)
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);


