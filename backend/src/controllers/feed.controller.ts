import { Response } from "express";
import User from "../models/User";
import { getFeed } from "../services/feed.service";
import { ok, fail } from "../types/api.types";
import { DeviceRequest } from "../middleware/requireDeviceId";
import { isRegion, REGIONS, Region } from "../constants/regions";
import { isCategory, CATEGORIES, Category } from "../constants/categories";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function getFeedHandler(req: DeviceRequest, res: Response): Promise<void> {
  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  if (req.query.cursor && !cursor) {
    res.status(400).json(fail("INVALID_CURSOR", "cursor must be a string"));
    return;
  }

  const regionParam = typeof req.query.region === "string" ? req.query.region : undefined;

  if (req.query.region && !regionParam) {
    res.status(400).json(fail("INVALID_REGION", "region must be a string"));
    return;
  }

  let region: Region | "international" | undefined;
  if (regionParam) {
    if (regionParam === "international") {
      region = "international";
    } else if (!isRegion(regionParam)) {
      res
        .status(400)
        .json(fail("INVALID_REGION", `region must be one of: international, ${REGIONS.join(", ")}`));
      return;
    } else {
      region = regionParam;
    }
  }

  const categoryParam = typeof req.query.category === "string" ? req.query.category : undefined;

  if (req.query.category && !categoryParam) {
    res.status(400).json(fail("INVALID_CATEGORY", "category must be a string"));
    return;
  }

  let category: Category | undefined;
  if (categoryParam) {
    if (!isCategory(categoryParam)) {
      res.status(400).json(fail("INVALID_CATEGORY", `category must be one of: ${CATEGORIES.join(", ")}`));
      return;
    }
    category = categoryParam;
  }

  // A device that hasn't onboarded yet (no User doc) gets an unpersonalized feed —
  // trending_score alone decides order, same as anyone with zero overlapping interests.
  // last_seen is touched here (not via blanket middleware) since /feed already needs to
  // read the User doc anyway — see the note in API_DESIGN.md about not giving DB-independent
  // endpoints like /categories an unnecessary Mongo dependency.
  const user = await User.findOneAndUpdate(
    { device_id: req.deviceId },
    { $set: { last_seen: new Date() } },
    { new: true }
  );

  const result = await getFeed({
    interests: user?.interests ?? [],
    cursor,
    limit,
    region,
    category,
  });

  res.status(200).json(ok({ articles: result.articles }, { next_cursor: result.next_cursor, has_more: result.has_more }));
}
