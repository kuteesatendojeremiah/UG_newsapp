import { Types } from "mongoose";
import Article from "../models/Article";
import ArticleEvent from "../models/ArticleEvent";
import JobState from "../models/JobState";

const JOB_NAME = "trending_rollup";

// Gives in-flight event writes a moment to land before this run claims "everything up to
// now" — without it, an event inserted mid-aggregation with a timestamp at or just before
// the captured cutoff could be missed by this run AND excluded by the next (since the next
// run's window starts strictly after this run's cutoff). A rare dropped click/impression
// has negligible ranking impact, but this removes the failure mode for near-zero cost.
const SAFETY_BUFFER_MS = 5000;

interface EventDelta {
  _id: { article_id: Types.ObjectId; type: "impression" | "click" };
  count: number;
}

export interface TrendingRollupResult {
  eventsSince: Date;
  cutoff: Date;
  articlesWithNewActivity: number;
  articlesRescored: number;
}

export async function computeTrending(): Promise<TrendingRollupResult> {
  const state = await JobState.findOneAndUpdate(
    { name: JOB_NAME },
    { $setOnInsert: { last_run_at: new Date(0) } },
    { upsert: true, new: true }
  );

  const since = state.last_run_at;
  const cutoff = new Date(Date.now() - SAFETY_BUFFER_MS);

  // Incremental delta only, never a full recount — Article.clicks/impressions are durable
  // running totals that must survive ArticleEvent's ~48h TTL. Recounting the live
  // ArticleEvent collection each run would silently shrink counts as old events expire.
  const deltas = await ArticleEvent.aggregate<EventDelta>([
    { $match: { timestamp: { $gt: since, $lte: cutoff } } },
    { $group: { _id: { article_id: "$article_id", type: "$type" }, count: { $sum: 1 } } },
  ]);

  const incByArticle = new Map<string, { clicks: number; impressions: number }>();
  for (const delta of deltas) {
    const id = delta._id.article_id.toString();
    const entry = incByArticle.get(id) ?? { clicks: 0, impressions: 0 };
    if (delta._id.type === "click") entry.clicks += delta.count;
    else if (delta._id.type === "impression") entry.impressions += delta.count;
    incByArticle.set(id, entry);
  }

  if (incByArticle.size > 0) {
    const operations = Array.from(incByArticle.entries()).map(([id, inc]) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $inc: { clicks: inc.clicks, impressions: inc.impressions } },
      },
    }));
    await Article.bulkWrite(operations, { ordered: false });
  }

  // Recency decay changes every run regardless of new events, so every article's
  // trending_score is recomputed unconditionally — an article with no new clicks should
  // still fade over time rather than freeze at its last score. MVP formula from
  // PRODUCT_DESIGN.md: score = clicks / (hours_since_publish + 2). Done as a single
  // aggregation-pipeline update (Mongo 4.2+) rather than fetch-loop-save, so it stays
  // cheap regardless of catalog size.
  const rescoreResult = await Article.updateMany({}, [
    {
      $set: {
        trending_score: {
          $divide: [
            "$clicks",
            {
              $add: [
                { $divide: [{ $subtract: ["$$NOW", "$published_at"] }, 1000 * 60 * 60] },
                2,
              ],
            },
          ],
        },
        metrics_updated_at: "$$NOW",
      },
    },
  ]);

  await JobState.updateOne({ name: JOB_NAME }, { $set: { last_run_at: cutoff } });

  return {
    eventsSince: since,
    cutoff,
    articlesWithNewActivity: incByArticle.size,
    articlesRescored: rescoreResult.modifiedCount,
  };
}
