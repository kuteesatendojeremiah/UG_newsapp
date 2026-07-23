import { Response } from "express";
import { Types } from "mongoose";
import ArticleEvent from "../models/ArticleEvent";
import { ok, fail } from "../types/api.types";
import { DeviceRequest } from "../middleware/requireDeviceId";

const CLICK_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseArticleId(body: unknown): Types.ObjectId | null {
  const articleId = (body as { article_id?: unknown } | null)?.article_id;
  if (typeof articleId !== "string" || !Types.ObjectId.isValid(articleId)) return null;
  return new Types.ObjectId(articleId);
}

// Phase 3 only records events — it does not touch Article.clicks/impressions/trending_score
// directly. That rollup is Phase 4's cron job, reading this collection. Keeping the write
// path here as cheap as possible (a single insert, or a lookup + insert for click dedup)
// matters since impressions in particular fire on every card render.
export async function trackImpression(req: DeviceRequest, res: Response): Promise<void> {
  const articleId = parseArticleId(req.body);
  if (!articleId) {
    res.status(400).json(fail("INVALID_ARTICLE_ID", "article_id must be a valid id"));
    return;
  }

  await ArticleEvent.create({
    article_id: articleId,
    device_id: req.deviceId,
    type: "impression",
  });

  res.status(200).json(ok({ recorded: true }));
}

export async function trackClick(req: DeviceRequest, res: Response): Promise<void> {
  const articleId = parseArticleId(req.body);
  if (!articleId) {
    res.status(400).json(fail("INVALID_ARTICLE_ID", "article_id must be a valid id"));
    return;
  }

  const since = new Date(Date.now() - CLICK_DEDUP_WINDOW_MS);
  const existing = await ArticleEvent.findOne({
    article_id: articleId,
    device_id: req.deviceId,
    type: "click",
    timestamp: { $gte: since },
  });

  // Idempotent from the caller's side either way — a repeat tap within the 24h window
  // just doesn't create a second counted event (see the dedup rule in API_DESIGN.md).
  if (!existing) {
    await ArticleEvent.create({
      article_id: articleId,
      device_id: req.deviceId,
      type: "click",
    });
  }

  res.status(200).json(ok({ recorded: true }));
}
