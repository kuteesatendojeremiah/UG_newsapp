import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Article from "../models/Article";

// One-off: Article.region is now a required field. Every pre-existing document predates it
// and was ingested from a Uganda-only source list, so backfilling "uganda" is correct for
// all of them — must run before any code path that calls article.save() on an old document
// (clusterArticles.ts does), since that would otherwise throw a ValidationError.
async function main(): Promise<void> {
  await connectDB();

  const result = await Article.updateMany(
    { region: { $exists: false } },
    { $set: { region: "uganda" } }
  );
  console.log("Backfilled region on existing articles:", result.modifiedCount);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Region backfill failed:", err);
  process.exit(1);
});
