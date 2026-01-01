import { Schema, model, models, Document, Types } from "mongoose";

export interface IConversationParticipant extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastSeenAt: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationParticipantSchema = new Schema<IConversationParticipant>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    lastActiveAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// Unique compound index on { conversationId, userId }
ConversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

// Index for user's conversations
ConversationParticipantSchema.index({ userId: 1, lastSeenAt: -1 });

export const ConversationParticipant =
  models.ConversationParticipant || model<IConversationParticipant>("ConversationParticipant", ConversationParticipantSchema);





