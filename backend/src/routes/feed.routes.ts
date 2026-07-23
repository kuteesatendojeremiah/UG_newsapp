import { Router } from "express";
import { getFeedHandler } from "../controllers/feed.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { DeviceRequest } from "../middleware/requireDeviceId";

const router = Router();

router.get("/", asyncHandler<DeviceRequest>(getFeedHandler));

export default router;
