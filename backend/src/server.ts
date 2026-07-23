import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";
import { connectDB } from "./config/db";
import { startScheduledJobs } from "./jobs/scheduler";

const PORT = process.env.PORT || 4000;

async function main(): Promise<void> {
  await connectDB();
  startScheduledJobs();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
