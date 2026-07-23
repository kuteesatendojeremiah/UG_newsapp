import { Router } from "express";
import { searchHandler } from "../controllers/search.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(searchHandler));

export default router;
