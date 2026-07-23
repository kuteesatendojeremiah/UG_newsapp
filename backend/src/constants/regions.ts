// Controlled vocabulary for Article.region — mirrors categories.ts's pattern.
export const REGIONS = ["uganda", "regional", "global"] as const;

export type Region = (typeof REGIONS)[number];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}
