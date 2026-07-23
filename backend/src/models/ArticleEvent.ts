import mongoose, { Schema, Document, Types } from "mongoose";

// Rolling ledger, not a permanent log — powers trending score rollup and click dedup.
// Article.clicks/impressions/trending_score are the durable numbers; this collection
// self-expires via the TTL index below (~48h) so it never grows unbounded.
export interface ArticleEventDocument extends Document {
  article_id: Types.ObjectId;
  device_id: string;
  type: "impression" | "click";
  timestamp: Date;
}

const ArticleEventSchema = new Schema<ArticleEventDocument>({
  article_id: { type: Schema.Types.ObjectId, ref: "Article", required: true },
  device_id: { type: String, required: true },
  type: { type: String, enum: ["impression", "click"], required: true },
  timestamp: { type: Date, default: Date.now },
});

ArticleEventSchema.index({ article_id: 1, device_id: 1, timestamp: 1 });
ArticleEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 48 });

export default mongoose.model<ArticleEventDocument>("ArticleEvent", ArticleEventSchema);
