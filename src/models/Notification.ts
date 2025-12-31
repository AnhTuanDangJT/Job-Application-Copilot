import { Schema, model, models, Document, Types } from "mongoose";

export type NotificationType =
  | "chat_message"
  | "NEW_MESSAGE"
  | "reminder_due"
  | "insight_ready"
  | "mentor_suggestion"
  | "GROUP_ANNOUNCEMENT";

export interface INotification extends Document {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId; // Optional for group announcements
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt?: Date;
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: false, index: true },
    type: {
      type: String,
      enum: ["chat_message", "NEW_MESSAGE", "reminder_due", "insight_ready", "mentor_suggestion", "GROUP_ANNOUNCEMENT"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 1000 },
    link: { type: String, maxlength: 500 },
    readAt: { type: Date },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Index for user notifications sorted by createdAt (unread first)
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

// Index for conversation notifications
NotificationSchema.index({ conversationId: 1, createdAt: -1 });

export const Notification = models.Notification || model<INotification>("Notification", NotificationSchema);

