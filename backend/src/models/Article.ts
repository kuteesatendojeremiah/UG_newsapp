import mongoose, { Schema, Document } from "mongoose";
import { CATEGORIES, Category } from "../constants/categories";
import { REGIONS, Region } from "../constants/regions";

export interface ArticleDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  summary: string;
  image_url?: string;

  source: string;
  url: string;

  published_at: Date;

  categories: Category[]; // max 2, enforced below — controlled vocabulary only
  primary_category: Category;
  tags: string[]; // context/relevance dimension, e.g. "local" — not a topic, not personalization input

  region: Region; // set from the source's config, not derived from content

  // Points at the _id of the first article in its story cluster (itself, if it's the first
  // or has no match yet) — see jobs/clusterArticles.ts. Absent until the clustering job has
  // run on this article.
  cluster_id?: mongoose.Types.ObjectId;

  clicks: number;
  impressions: number;
  trending_score: number;
  metrics_updated_at?: Date;

  created_at: Date;
}

const ArticleSchema = new Schema<ArticleDocument>({
  title: { type: String, required: true },
  summary: { type: String, required: true },
  image_url: { type: String },

  source: { type: String, required: true },
  url: { type: String, required: true, unique: true }, // dedup key for RSS ingestion upserts

  published_at: { type: Date, required: true },

  categories: {
    type: [{ type: String, enum: CATEGORIES }],
    required: true,
    validate: {
      validator: (value: string[]) => value.length >= 1 && value.length <= 2,
      message: "categories must have between 1 and 2 entries",
    },
  },
  primary_category: { type: String, enum: CATEGORIES, required: true },
  tags: { type: [String], default: [] },

  region: { type: String, enum: REGIONS, required: true, index: true },

  cluster_id: { type: Schema.Types.ObjectId, index: true },

  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  trending_score: { type: Number, default: 0 },
  metrics_updated_at: { type: Date },

  created_at: { type: Date, default: Date.now },
});

// TTL — free-tier Atlas storage is capped, and this app only ever surfaces recent news
// (today/yesterday/last few days), so nothing is lost by letting old articles self-expire.
// Doubles as the sort index for feed pagination; direction doesn't affect TTL behavior.
export const ARTICLE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
ArticleSchema.index({ published_at: -1 }, { expireAfterSeconds: ARTICLE_TTL_SECONDS });
ArticleSchema.index({ trending_score: -1 });
ArticleSchema.index({ categories: 1 });
// Title weighted higher than summary — a query term appearing in the headline is a
// stronger match signal than the same term buried in the summary body.
ArticleSchema.index({ title: "text", summary: "text" }, { weights: { title: 3, summary: 1 } });

export default mongoose.model<ArticleDocument>("Article", ArticleSchema);
