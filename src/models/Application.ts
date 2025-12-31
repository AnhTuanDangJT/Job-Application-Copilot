import { Schema, model, models, Document, Types } from "mongoose";

export interface IApplication extends Document {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  resume_version?: string;
  cover_letter?: string;
  status: "draft" | "submitted" | "interview" | "offer" | "rejected";
  dateSubmitted?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    resume_version: { type: String },
    cover_letter: { type: String },
    status: {
      type: String,
      enum: ["draft", "submitted", "interview", "offer", "rejected"],
      default: "draft",
      index: true,
    },
    dateSubmitted: { type: Date },
  },
  { timestamps: true }
);

export const Application = models.Application || model<IApplication>("Application", ApplicationSchema);


