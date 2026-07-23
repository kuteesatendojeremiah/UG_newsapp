import express, { Express } from "express";
import cors from "cors";
import { requireDeviceId } from "./middleware/requireDeviceId";
import { errorHandler } from "./middleware/errorHandler";
import categoryRoutes from "./routes/category.routes";
import userRoutes from "./routes/user.routes";
import articleRoutes from "./routes/article.routes";
import feedRoutes from "./routes/feed.routes";
import trendingRoutes from "./routes/trending.routes";
import eventRoutes from "./routes/event.routes";
import searchRoutes from "./routes/search.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // No device_id required — infra/uptime check only.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const api = express.Router();
  api.use(requireDeviceId);

  api.use("/categories", categoryRoutes);
  api.use("/user", userRoutes);
  api.use("/articles", articleRoutes);
  api.use("/feed", feedRoutes);
  api.use("/trending", trendingRoutes);
  api.use("/events", eventRoutes);
  api.use("/search", searchRoutes);

  app.use("/api", api);

  app.use(errorHandler);

  return app;
}
