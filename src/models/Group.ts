import { Schema, model, models, Document, Types } from "mongoose";

export interface IGroup extends Document {
  mentorId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, maxlength: 200, trim: true },
  },
  { timestamps: true }
);

// Index for mentor's groups
GroupSchema.index({ mentorId: 1, createdAt: -1 });

export const Group = models.Group || model<IGroup>("Group", GroupSchema);



