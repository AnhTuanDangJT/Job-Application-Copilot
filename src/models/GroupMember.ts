import { Schema, model, models, Document, Types } from "mongoose";

export interface IGroupMember extends Document {
  groupId: Types.ObjectId;
  menteeId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GroupMemberSchema = new Schema<IGroupMember>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    menteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

// Unique index: a mentee can only be in a group once
GroupMemberSchema.index({ groupId: 1, menteeId: 1 }, { unique: true });

// Index for finding all groups a mentee belongs to
GroupMemberSchema.index({ menteeId: 1, createdAt: -1 });

// Index for finding all members of a group
GroupMemberSchema.index({ groupId: 1, createdAt: -1 });

export const GroupMember = models.GroupMember || model<IGroupMember>("GroupMember", GroupMemberSchema);




