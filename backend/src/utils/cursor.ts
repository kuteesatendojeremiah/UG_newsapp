import { Types } from "mongoose";

export interface Cursor {
  publishedAt: Date;
  id: Types.ObjectId;
}

// Plain "<iso-timestamp>_<objectid>" — ISO strings and hex ObjectIds never contain "_",
// so a simple split is safe and there's no need for base64/JSON overhead.
export function encodeCursor(publishedAt: Date, id: Types.ObjectId): string {
  return `${publishedAt.toISOString()}_${id.toHexString()}`;
}

export function decodeCursor(cursor: string): Cursor | null {
  const separatorIndex = cursor.lastIndexOf("_");
  if (separatorIndex === -1) return null;

  const iso = cursor.slice(0, separatorIndex);
  const idPart = cursor.slice(separatorIndex + 1);

  const publishedAt = new Date(iso);
  if (Number.isNaN(publishedAt.getTime()) || !Types.ObjectId.isValid(idPart)) return null;

  return { publishedAt, id: new Types.ObjectId(idPart) };
}

// Trending sorts by (trending_score, published_at, _id) — three-key tiebreak, since
// trending_score is a slow-changing stored field (cron rollup) and will commonly tie
// (all 0 until Phase 4's scoring job exists), falling back to recency, then id.
export interface TrendingCursor {
  score: number;
  publishedAt: Date;
  id: Types.ObjectId;
}

export function encodeTrendingCursor(score: number, publishedAt: Date, id: Types.ObjectId): string {
  return `${score}_${publishedAt.toISOString()}_${id.toHexString()}`;
}

export function decodeTrendingCursor(cursor: string): TrendingCursor | null {
  const parts = cursor.split("_");
  if (parts.length !== 3) return null;

  const [scoreStr, iso, idPart] = parts;
  const score = Number(scoreStr);
  const publishedAt = new Date(iso);
  if (Number.isNaN(score) || Number.isNaN(publishedAt.getTime()) || !Types.ObjectId.isValid(idPart)) return null;

  return { score, publishedAt, id: new Types.ObjectId(idPart) };
}
