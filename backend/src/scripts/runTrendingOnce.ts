import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { computeTrending } from "../jobs/computeTrending";

async function main(): Promise<void> {
  await connectDB();
  const result = await computeTrending();

  console.log(
    `Rescored ${result.articlesRescored} articles; ${result.articlesWithNewActivity} had new activity since ${result.eventsSince.toISOString()}.`
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Trending rollup failed:", err);
  process.exit(1);
});
