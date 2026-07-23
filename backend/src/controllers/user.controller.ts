import { Response } from "express";
import User from "../models/User";
import { isCategory } from "../constants/categories";
import { ok, fail } from "../types/api.types";
import { DeviceRequest } from "../middleware/requireDeviceId";

export async function updateInterests(req: DeviceRequest, res: Response): Promise<void> {
  const { interests } = req.body ?? {};

  if (!Array.isArray(interests) || interests.length === 0) {
    res.status(400).json(fail("INVALID_INTERESTS", "interests must be a non-empty array"));
    return;
  }

  const invalid = interests.filter((value: unknown) => typeof value !== "string" || !isCategory(value));
  if (invalid.length > 0) {
    res.status(400).json(
      fail("INVALID_INTERESTS", `Unknown categories: ${invalid.join(", ")}`)
    );
    return;
  }

  const now = new Date();

  // Replaces existing interests outright (not a merge) — matches the "edit interests"
  // UX in UI_STRUCTURE.md, where Save always sends the user's full current selection.
  const user = await User.findOneAndUpdate(
    { device_id: req.deviceId },
    {
      $set: { interests, updated_at: now, last_seen: now },
      $setOnInsert: { created_at: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json(ok({ interests: user.interests }));
}
