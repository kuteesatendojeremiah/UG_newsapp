import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { ingestAllSources } from "../jobs/ingestRss";

async function main(): Promise<void> {
  await connectDB();
  const results = await ingestAllSources();

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  console.log(`Done. Total new articles inserted: ${totalInserted}`);

  await mongoose.disconnect();

  // rss-parser's underlying HTTP client appears to hold a keep-alive socket open even
  // after this script has nothing left to do — observed directly: the process didn't
  // exit on its own after printing "Done" until forced. Explicit exit is standard/safe
  // for a one-shot script like this one (as opposed to the long-running server process).
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion run failed:", err);
  process.exit(1);
});
