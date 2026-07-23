import { Request, Response, NextFunction } from "express";
import { fail } from "../types/api.types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  console.error(err);

  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(500).json(fail("SERVER_ERROR", message));
}
