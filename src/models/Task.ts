import { Schema, model, models, Document, Types } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  completed: boolean;
  mentorId: Types.ObjectId;
  menteeId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, maxlength: 500 },
    description: { type: String, maxlength: 5000 },
    completed: { type: Boolean, default: false, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

// Compound index for mentor queries
TaskSchema.index({ mentorId: 1, createdAt: -1 });

// Compound index for mentee queries
TaskSchema.index({ menteeId: 1, completed: 1, createdAt: -1 });

// Ensure mentorId and menteeId are different (enforced at application level)
// Also ensure mentorId role is MENTOR and menteeId role is MENTEE (enforced at application level)

export const Task = models.Task || model<ITask>("Task", TaskSchema);



