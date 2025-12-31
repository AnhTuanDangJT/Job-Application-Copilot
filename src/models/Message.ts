import { Schema, model, models, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId?: Types.ObjectId;
  senderRole?: "mentee" | "mentor" | "system";
  type: "TEXT" | "FILE" | "FEEDBACK" | "SYSTEM";
  content?: string;
  imageUrl?: string;
  resumeShareId?: Types.ObjectId;
  replyToMessageId?: Types.ObjectId;
  readBy: Types.ObjectId[];
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    senderRole: { type: String, enum: ["mentee", "mentor", "system"] },
    type: { type: String, enum: ["TEXT", "FILE", "FEEDBACK", "SYSTEM"], required: true, default: "TEXT" },
    content: { type: String, maxlength: 10000 },
    imageUrl: { type: String },
    resumeShareId: { type: Schema.Types.ObjectId, ref: "ResumeShare" },
    replyToMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    readBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Index for conversation messages sorted by createdAt
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = models.Message || model<IMessage>("Message", MessageSchema);

