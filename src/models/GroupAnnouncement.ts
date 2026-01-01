import { Schema, model, models, Document, Types } from "mongoose";

export interface IGroupAnnouncement extends Document {
  groupId: Types.ObjectId;
  mentorId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupAnnouncementSchema = new Schema<IGroupAnnouncement>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true }
);

// Index for group announcements sorted by date
GroupAnnouncementSchema.index({ groupId: 1, createdAt: -1 });

// Index for mentor's announcements
GroupAnnouncementSchema.index({ mentorId: 1, createdAt: -1 });

export const GroupAnnouncement = models.GroupAnnouncement || model<IGroupAnnouncement>("GroupAnnouncement", GroupAnnouncementSchema);




