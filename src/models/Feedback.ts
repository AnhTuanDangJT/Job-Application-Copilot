import { Schema, model, models, Document, Types } from "mongoose";

export interface IActionItem {
  text: string;
  done: boolean;
  createdAt: Date;
}

export interface IFeedback extends Document {
  conversationId: Types.ObjectId;
  resumeShareId: Types.ObjectId;
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  feedbackText: string;
  strengths?: string;
  issues?: string;
  actionItems: IActionItem[];
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ActionItemSchema = new Schema({
  text: { type: String, required: true, maxlength: 500 },
  done: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const FeedbackSchema = new Schema<IFeedback>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    resumeShareId: { type: Schema.Types.ObjectId, ref: "ResumeShare", required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    feedbackText: { type: String, maxlength: 10000 },
    strengths: { type: String, maxlength: 5000 },
    issues: { type: String, maxlength: 5000 },
    actionItems: { type: [ActionItemSchema], default: [] },
    rating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

// Index for resume feedback sorted by createdAt
FeedbackSchema.index({ resumeShareId: 1, createdAt: -1 });

// Index for conversation feedback sorted by createdAt
FeedbackSchema.index({ conversationId: 1, createdAt: -1 });

export const Feedback = models.Feedback || model<IFeedback>("Feedback", FeedbackSchema);

