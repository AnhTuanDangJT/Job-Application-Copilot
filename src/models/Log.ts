import { Schema, model, models, Document } from "mongoose";

export interface ILog extends Document {
  agentName: string;
  action: string;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

const LogSchema = new Schema<ILog>({
  agentName: { type: String, required: true, index: true },
  action: { type: String, required: true },
  meta: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const Log = models.Log || model<ILog>("Log", LogSchema);


