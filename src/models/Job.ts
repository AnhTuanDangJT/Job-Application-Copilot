import { Schema, model, models, Document } from "mongoose";

export interface IJob extends Document {
  title: string;
  company: string;
  jd_text: string;
  source?: string;
  location?: string;
  skills?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    jd_text: { type: String, required: true },
    source: { type: String },
    location: { type: String },
    skills: { type: [String], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Job = models.Job || model<IJob>("Job", JobSchema);


