import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 does not forward a rejected promise from an async handler to error-handling
// middleware — without this, a thrown/rejected error just hangs the request instead of
// producing a 500 via errorHandler.ts.
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req as T, res, next).catch(next);
  };
}
