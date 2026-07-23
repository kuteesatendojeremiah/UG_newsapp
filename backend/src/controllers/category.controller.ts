import { Request, Response } from "express";
import { CATEGORIES, CATEGORY_LABELS, TAGS } from "../constants/categories";
import { ok } from "../types/api.types";

// Tags aren't user-selectable and aren't used in personalization matching (see
// PRODUCT_DESIGN.md) — included here purely as reference data, not wired into onboarding UI.
const TAG_LABELS: Record<string, string> = {
  local: "Local Uganda",
};

export function getCategories(_req: Request, res: Response): void {
  const categories = CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] }));
  const tags = TAGS.map((id) => ({ id, label: TAG_LABELS[id] }));

  res.status(200).json(ok({ categories, tags }));
}
