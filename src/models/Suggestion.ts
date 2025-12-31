import { Schema, model, models, Document, Types } from "mongoose";

export interface ISuggestion extends Document {
  conversationId: Types.ObjectId;
  applicationId: Types.ObjectId; // References ApplicationRow._id
  field: string;
  oldValue: any;
  proposedValue: any;
  proposedByRole: "mentor" | "mentee";
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  resolvedAt?: Date;
}

const SuggestionSchema = new Schema<ISuggestion>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "ApplicationRow",
      required: true,
      index: true,
    },
    field: {
      type: String,
      required: true,
      maxlength: 100,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    proposedValue: {
      type: Schema.Types.Mixed,
    },
    proposedByRole: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
SuggestionSchema.index({ conversationId: 1, status: 1, createdAt: -1 });
SuggestionSchema.index({ applicationId: 1, status: 1 });
SuggestionSchema.index({ conversationId: 1, createdAt: -1 });
SuggestionSchema.index({ applicationId: 1, createdAt: -1 }); // For per-application queries

export const Suggestion =
  models.Suggestion || model<ISuggestion>("Suggestion", SuggestionSchema);

