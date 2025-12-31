import { Schema, model, models, Document, Types } from "mongoose";

// CellValue can be string, number, boolean, or null
// For dates, store as ISO string "YYYY-MM-DD" or full ISO string
export type CellValue = string | number | boolean | null;

export interface ITag {
  id: string;
  label: string;
  color: string;
}

export interface IReminder {
  id: string;
  type: "follow-up" | "interview" | "thank-you";
  date: Date;
  createdBy: "mentor" | "mentee";
}

export interface IActivityLogEntry {
  id: string;
  authorRole: "mentor" | "mentee";
  message: string;
  timestamp: Date;
}

export interface IHistoryEntry {
  id: string;
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: "mentor" | "mentee";
  timestamp: Date;
}

export interface IApplicationRow extends Document {
  boardId: Types.ObjectId;
  conversationId: Types.ObjectId;
  createdBy: Types.ObjectId;
  cells: Record<string, CellValue>; // key -> value mapping where key is column.key
  tags?: ITag[];
  reminders?: IReminder[];
  activityLog?: IActivityLogEntry[];
  history?: IHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 100 },
    color: { type: String, required: true, maxlength: 20 },
  },
  { _id: false }
);

const ReminderSchema = new Schema<IReminder>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["follow-up", "interview", "thank-you"], required: true },
    date: { type: Date, required: true },
    createdBy: { type: String, enum: ["mentor", "mentee"], required: true },
  },
  { _id: false }
);

const ActivityLogEntrySchema = new Schema<IActivityLogEntry>(
  {
    id: { type: String, required: true },
    authorRole: { type: String, enum: ["mentor", "mentee"], required: true },
    message: { type: String, required: true, maxlength: 5000 },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const HistoryEntrySchema = new Schema<IHistoryEntry>(
  {
    id: { type: String, required: true },
    field: { type: String, required: true, maxlength: 100 },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: String, enum: ["mentor", "mentee"], required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const ApplicationRowSchema = new Schema<IApplicationRow>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "ApplicationBoard",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cells: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: {
      type: [TagSchema],
      default: [],
    },
    reminders: {
      type: [ReminderSchema],
      default: [],
    },
    activityLog: {
      type: [ActivityLogEntrySchema],
      default: [],
    },
    history: {
      type: [HistoryEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
ApplicationRowSchema.index({ conversationId: 1, updatedAt: -1 });
ApplicationRowSchema.index({ boardId: 1, updatedAt: -1 });
ApplicationRowSchema.index({ conversationId: 1, createdAt: -1 });
ApplicationRowSchema.index({ conversationId: 1, applicationId: 1 }); // For lookups

export const ApplicationRow =
  models.ApplicationRow || model<IApplicationRow>("ApplicationRow", ApplicationRowSchema);

