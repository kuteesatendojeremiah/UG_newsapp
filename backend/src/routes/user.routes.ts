import { Router } from "express";
import { updateInterests } from "../controllers/user.controller";
import { asyncHandler } from "../utils/asyncHandler";
import { DeviceRequest } from "../middleware/requireDeviceId";

const router = Router();

router.post("/interests", asyncHandler<DeviceRequest>(updateInterests));

export default router;
