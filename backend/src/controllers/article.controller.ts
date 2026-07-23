import { Request, Response } from "express";
import { Types } from "mongoose";
import Article from "../models/Article";
import { serializeArticle } from "../utils/serializeArticle";
import { ok, fail } from "../types/api.types";

export async function getArticleById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    res.status(404).json(fail("ARTICLE_NOT_FOUND", "Article does not exist"));
    return;
  }

  const article = await Article.findById(id);
  if (!article) {
    res.status(404).json(fail("ARTICLE_NOT_FOUND", "Article does not exist"));
    return;
  }

  res.status(200).json(ok(serializeArticle(article)));
}
