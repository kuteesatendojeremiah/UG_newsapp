import { Router } from "express";
import { trackImpression, trackClick } from "../controllers/event.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { DeviceRequest } from "../middleware/requireDeviceId";

const router = Router();

router.post("/impression", asyncHandler<DeviceRequest>(trackImpression));
router.post("/click", asyncHandler<DeviceRequest>(trackClick));

export default router;
