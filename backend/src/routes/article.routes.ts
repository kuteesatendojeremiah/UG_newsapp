import { Router } from "express";
import { getArticleById } from "../controllers/article.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/:id", asyncHandler(getArticleById));

export default router;
