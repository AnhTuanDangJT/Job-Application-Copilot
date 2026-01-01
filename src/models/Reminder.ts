import { Schema, model, models, Document, Types } from "mongoose";

export type ReminderType = "follow-up" | "interview" | "thank-you";
export type ReminderStatus = "pending" | "triggered" | "cancelled";

export interface IReminder extends Document {
  conversationId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  type: ReminderType;
  dueAt: Date;
  createdBy: Types.ObjectId;
  status: ReminderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application" },
    type: {
      type: String,
      enum: ["follow-up", "interview", "thank-you"],
      required: true,
    },
    dueAt: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "triggered", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Index for finding due reminders
ReminderSchema.index({ dueAt: 1, status: 1 });

// Index for conversation reminders
ReminderSchema.index({ conversationId: 1, dueAt: -1 });

// Index for application reminders
ReminderSchema.index({ applicationId: 1, dueAt: -1 });

export const Reminder = models.Reminder || model<IReminder>("Reminder", ReminderSchema);





