import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Article from "../models/Article";
import ArticleEvent from "../models/ArticleEvent";

// One-off: run after changing index definitions in a model (e.g. adding/changing a TTL).
// Mongoose's default autoIndex only creates indexes that don't exist yet — an existing
// index with the same keys but different options (like expireAfterSeconds) is left alone,
// so the live Atlas cluster needs this explicit reconciliation.
async function main(): Promise<void> {
  await connectDB();

  const articleResult = await Article.syncIndexes();
  console.log("Article indexes synced:", articleResult);

  const eventResult = await ArticleEvent.syncIndexes();
  console.log("ArticleEvent indexes synced:", eventResult);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Index sync failed:", err);
  process.exit(1);
});
