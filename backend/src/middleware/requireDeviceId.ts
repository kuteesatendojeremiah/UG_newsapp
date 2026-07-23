import { Request, Response, NextFunction } from "express";
import { fail } from "../types/api.types";

export interface DeviceRequest extends Request {
  deviceId: string;
}

export function requireDeviceId(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.headers["x-device-id"];

  if (!deviceId || typeof deviceId !== "string") {
    res.status(400).json(fail("MISSING_DEVICE_ID", "x-device-id header is required"));
    return;
  }

  (req as DeviceRequest).deviceId = deviceId;
  next();
}
