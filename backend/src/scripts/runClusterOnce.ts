import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { clusterNewArticles } from "../jobs/clusterArticles";

async function main(): Promise<void> {
  await connectDB();
  const result = await clusterNewArticles();

  console.log(
    `Processed ${result.processed} articles; ${result.matched} matched an existing cluster, ${result.newClusters} started new ones.`
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Clustering run failed:", err);
  process.exit(1);
});
