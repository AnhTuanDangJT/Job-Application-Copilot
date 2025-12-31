import { Schema, model, models, Document, Types } from "mongoose";

export interface IInterviewPrep extends Document {
  conversationId: Types.ObjectId;
  question: string;
  assessment?: "WEAK" | "AVERAGE" | "STRONG";
  notes?: string;
  updatedAt: Date;
  createdAt: Date;
}

const InterviewPrepSchema = new Schema<IInterviewPrep>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    question: { type: String, required: true, maxlength: 1000 },
    assessment: { type: String, enum: ["WEAK", "AVERAGE", "STRONG"] },
    notes: { type: String, maxlength: 10000 },
  },
  { timestamps: true }
);

// Index for conversation interview prep questions sorted by createdAt
InterviewPrepSchema.index({ conversationId: 1, createdAt: -1 });

export const InterviewPrep = models.InterviewPrep || model<IInterviewPrep>("InterviewPrep", InterviewPrepSchema);






