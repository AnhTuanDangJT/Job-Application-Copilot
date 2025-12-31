import { Schema, model, models, Document, Types } from "mongoose";

export interface IApplicationBoardColumn {
  _id: Types.ObjectId;
  key: string; // Stable unique key (e.g. "company", "status", or UUID-like)
  name: string; // Display name
  type: "text" | "longtext" | "date" | "select" | "number" | "checkbox";
  required?: boolean;
  options?: string[]; // Only for select type
  width?: number; // Optional, for UI
  order: number; // Display order
}

export interface IApplicationBoard extends Document {
  conversationId: Types.ObjectId;
  columns: IApplicationBoardColumn[];
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationBoardColumnSchema = new Schema<IApplicationBoardColumn>({
  key: { type: String, required: true },
  name: { type: String, required: true, maxlength: 100 },
  type: {
    type: String,
    enum: ["text", "longtext", "date", "select", "number", "checkbox"],
    required: true,
  },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] }, // For select type
  width: { type: Number, min: 50, max: 1000 },
  order: { type: Number, required: true, default: 0 },
});

const ApplicationBoardSchema = new Schema<IApplicationBoard>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      unique: true,
      index: true,
    },
    columns: {
      type: [ApplicationBoardColumnSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Create default columns function (called on first board creation)
export function getDefaultColumns(): IApplicationBoardColumn[] {
  return [
    {
      _id: new Types.ObjectId(),
      key: "company",
      name: "Company",
      type: "text",
      required: true,
      order: 0,
    },
    {
      _id: new Types.ObjectId(),
      key: "dateApplied",
      name: "Date Applied",
      type: "date",
      order: 1,
    },
    {
      _id: new Types.ObjectId(),
      key: "position",
      name: "Position",
      type: "text",
      required: true,
      order: 2,
    },
    {
      _id: new Types.ObjectId(),
      key: "status",
      name: "Status",
      type: "select",
      options: ["Applied", "Rejected", "Interview", "Offer"],
      order: 3,
    },
    {
      _id: new Types.ObjectId(),
      key: "notes",
      name: "Notes",
      type: "longtext",
      order: 4,
    },
  ] as IApplicationBoardColumn[];
}

export const ApplicationBoard =
  models.ApplicationBoard || model<IApplicationBoard>("ApplicationBoard", ApplicationBoardSchema);

