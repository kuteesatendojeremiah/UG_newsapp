import mongoose, { Schema, Document } from "mongoose";

// Tracks the watermark for incremental jobs (currently just the trending rollup) — lets a
// cron job process "everything new since I last ran" without double-counting or dropping
// events, instead of re-aggregating the whole ArticleEvent collection every time.
export interface JobStateDocument extends Document {
  name: string;
  last_run_at: Date;
}

const JobStateSchema = new Schema<JobStateDocument>({
  name: { type: String, required: true, unique: true },
  last_run_at: { type: Date, required: true },
});

export default mongoose.model<JobStateDocument>("JobState", JobStateSchema);
