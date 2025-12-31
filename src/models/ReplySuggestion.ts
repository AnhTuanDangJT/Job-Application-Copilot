import { Schema, model, models, Document, Types } from "mongoose";

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface IReplySuggestion extends Document {
  conversationId: Types.ObjectId;
  messageContextIds: Types.ObjectId[]; // Array of message IDs for context
  suggestedText: string;
  createdBy: Types.ObjectId;
  status: SuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySuggestionSchema = new Schema<IReplySuggestion>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    messageContextIds: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    suggestedText: { type: String, required: true, maxlength: 10000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Index for conversation suggestions
ReplySuggestionSchema.index({ conversationId: 1, createdAt: -1 });

// Index for pending suggestions
ReplySuggestionSchema.index({ status: 1, createdAt: 1 });

export const ReplySuggestion =
  models.ReplySuggestion || model<IReplySuggestion>("ReplySuggestion", ReplySuggestionSchema);




