import { Router } from "express";
import { getTrendingHandler } from "../controllers/trending.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(getTrendingHandler));

export default router;
