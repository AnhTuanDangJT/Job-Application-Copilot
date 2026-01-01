import { Schema, model, models, Document } from "mongoose";

export interface IAdminInvite extends Document {
  email: string;
  invitedByAdminId: string;
  status: "pending" | "accepted";
  createdAt: Date;
  updatedAt: Date;
}

const AdminInviteSchema = new Schema<IAdminInvite>(
  {
    email: { type: String, required: true, index: true },
    invitedByAdminId: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

// Index for efficient lookups
AdminInviteSchema.index({ email: 1, status: 1 });

export const AdminInvite = models.AdminInvite || model<IAdminInvite>("AdminInvite", AdminInviteSchema);






