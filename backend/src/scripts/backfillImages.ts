import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Article from "../models/Article";
import { fetchOgImage, mapWithConcurrency } from "../services/articleImage";

// One-off: existing articles were ingested before image fallbacks existed (ingestRss only
// sets image_url on insert, so they would never be picked up by a normal run). Fetches each
// image-less article's og:image and stores it. Safe to re-run — it only touches documents
// that still have no image_url. Pass --dry-run to report without writing.
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  const missing = await Article.find(
    { $or: [{ image_url: { $exists: false } }, { image_url: null }, { image_url: "" }] },
    { url: 1, source: 1 }
  ).lean();
  console.log(`Articles without an image: ${missing.length}${dryRun ? " (dry run)" : ""}`);

  let found = 0;
  const perSource: Record<string, { tried: number; found: number }> = {};

  await mapWithConcurrency(missing, 4, async (article) => {
    const stats = (perSource[article.source] ??= { tried: 0, found: 0 });
    stats.tried++;
    const image = await fetchOgImage(article.url);
    if (!image) return;
    stats.found++;
    found++;
    if (!dryRun) await Article.updateOne({ _id: article._id }, { $set: { image_url: image } });
  });

  console.log("Per source:", perSource);
  console.log(`${dryRun ? "Would set" : "Set"} image_url on ${found} of ${missing.length} articles`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Image backfill failed:", err);
  process.exit(1);
});
