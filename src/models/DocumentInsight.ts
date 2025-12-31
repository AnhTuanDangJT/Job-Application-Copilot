import { Schema, model, models, Document, Types } from "mongoose";

export type DocumentType = "resume" | "cover";
export type InsightStatus = "pending" | "ready" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface DocumentInsightResults {
  detectedSkills: string[];
  missingSkills: string[];
  lengthRecommendation: string;
  actionItems: string[];
  overallNotes: string;
}

export interface IDocumentInsight extends Document {
  conversationId: Types.ObjectId;
  docType: DocumentType;
  inputHash: string; // Hash of input text to detect duplicates
  status: InsightStatus;
  resultsJson?: DocumentInsightResults;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentInsightSchema = new Schema<IDocumentInsight>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    docType: {
      type: String,
      enum: ["resume", "cover"],
      required: true,
    },
    inputHash: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
      index: true,
    },
    resultsJson: {
      type: Schema.Types.Mixed,
      default: {},
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Index for conversation insights
DocumentInsightSchema.index({ conversationId: 1, docType: 1, createdAt: -1 });

// Index for finding pending insights
DocumentInsightSchema.index({ status: 1, createdAt: 1 });

export const DocumentInsight =
  models.DocumentInsight || model<IDocumentInsight>("DocumentInsight", DocumentInsightSchema);




