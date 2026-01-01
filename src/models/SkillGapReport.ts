import { Schema, model, models, Document, Types } from "mongoose";

export interface ISkillGapReport extends Document {
  conversationId: Types.ObjectId;
  targetRole: string;
  detectedSkills: string[];
  missingSkills: string[];
  score: number; // 0-100
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SkillGapReportSchema = new Schema<ISkillGapReport>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    targetRole: { type: String, required: true, maxlength: 200 },
    detectedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    score: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Index for conversation reports
SkillGapReportSchema.index({ conversationId: 1, createdAt: -1 });

export const SkillGapReport =
  models.SkillGapReport || model<ISkillGapReport>("SkillGapReport", SkillGapReportSchema);





