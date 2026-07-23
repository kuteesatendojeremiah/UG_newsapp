import cron from "node-cron";
import { ingestAllSources } from "./ingestRss";
import { computeTrending } from "./computeTrending";
import { clusterNewArticles } from "./clusterArticles";

// 15 minutes — resolves the "ingestion cadence: TBD" placeholder from CLAUDE.md.
const INGEST_SCHEDULE = "*/15 * * * *";

// 5 minutes — matches the cadence specified in PRODUCT_DESIGN.md's trending section.
const TRENDING_SCHEDULE = "*/5 * * * *";

// Chained after ingestion rather than on its own cron: clustering only has new work right
// after an ingest run adds articles, so there's no reason to watermark/schedule it separately.
async function runIngestThenCluster(): Promise<void> {
  try {
    await ingestAllSources();
  } catch (err) {
    console.error("[ingest] scheduled run failed:", err);
  }

  try {
    const r = await clusterNewArticles();
    console.log(`[cluster] processed ${r.processed}, matched ${r.matched}, new ${r.newClusters}`);
  } catch (err) {
    console.error("[cluster] scheduled run failed:", err);
  }
}

export function startScheduledJobs(): void {
  cron.schedule(INGEST_SCHEDULE, () => {
    runIngestThenCluster();
  });

  cron.schedule(TRENDING_SCHEDULE, () => {
    computeTrending()
      .then((r) =>
        console.log(
          `[trending] rescored ${r.articlesRescored} articles, ${r.articlesWithNewActivity} with new activity`
        )
      )
      .catch((err) => console.error("[trending] scheduled run failed:", err));
  });

  console.log(`[scheduler] RSS ingestion scheduled: ${INGEST_SCHEDULE}`);
  console.log(`[scheduler] Trending rollup scheduled: ${TRENDING_SCHEDULE}`);
}
