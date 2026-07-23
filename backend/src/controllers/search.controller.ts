import { Request, Response } from "express";
import { getSearchResults } from "../services/search.service";
import { ok, fail } from "../types/api.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    res.status(400).json(fail("INVALID_QUERY", "q is required"));
    return;
  }

  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  if (req.query.cursor && !cursor) {
    res.status(400).json(fail("INVALID_CURSOR", "cursor must be a string"));
    return;
  }

  const result = await getSearchResults({ q, cursor, limit });

  res.status(200).json(ok({ articles: result.articles }, { next_cursor: result.next_cursor, has_more: result.has_more }));
}
