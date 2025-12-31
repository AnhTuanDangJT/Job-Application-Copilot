import { Schema, model, models, Document, Types } from "mongoose";

export interface IResumeShare extends Document {
  conversationId: Types.ObjectId;
  sharedBy: Types.ObjectId;
  sharedTo: Types.ObjectId;
  storagePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  sharedAt: Date;
  viewedAt?: Date;
  status: "PENDING_REVIEW" | "REVIEWED";
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  purpose?: "REVIEW" | "REFERENCE" | "EDITED_VERSION";
  versionNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeShareSchema = new Schema<IResumeShare>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sharedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sharedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storagePath: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sharedAt: { type: Date, required: true, default: Date.now },
    viewedAt: { type: Date },
    status: { type: String, enum: ["PENDING_REVIEW", "REVIEWED"], default: "PENDING_REVIEW" },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    purpose: { type: String, enum: ["REVIEW", "REFERENCE", "EDITED_VERSION"], default: "REVIEW" },
    versionNumber: { type: Number, index: true },
  },
  { timestamps: true }
);

// Index for conversation resumes sorted by sharedAt
ResumeShareSchema.index({ conversationId: 1, sharedAt: -1 });

// Index for user's shared resumes
ResumeShareSchema.index({ sharedBy: 1, sharedAt: -1 });

export const ResumeShare = models.ResumeShare || model<IResumeShare>("ResumeShare", ResumeShareSchema);

