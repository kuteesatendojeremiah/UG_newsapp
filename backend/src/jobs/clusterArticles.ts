import { Types } from "mongoose";
import Article from "../models/Article";
import JobState from "../models/JobState";
import { textSimilarity } from "../services/clustering";

const JOB_NAME = "article_clustering";

// How far back a new article can look for a matching earlier story. Matches ingestRss's
// own staleness cutoff — no point clustering against articles the feed itself treats as
// too old to have ingested fresh.
const CANDIDATE_WINDOW_MS = 1000 * 60 * 60 * 48;

// Jaccard similarity is coarse (whole-word overlap, no synonyms/stemming), so this sits
// well above "same topic" and closer to "same specific story" — tuned against real Uganda
// Monitor/NTV/Nile Post headlines covering the same event, where overlap on named entities
// and specific nouns runs high even with different phrasing.
const SIMILARITY_THRESHOLD = 0.45;

const SAFETY_BUFFER_MS = 5000;

interface CandidateArticle {
  _id: Types.ObjectId;
  title: string;
  summary: string;
  cluster_id?: Types.ObjectId;
}

export interface ClusteringResult {
  processed: number;
  matched: number;
  newClusters: number;
}

export async function clusterNewArticles(): Promise<ClusteringResult> {
  const state = await JobState.findOneAndUpdate(
    { name: JOB_NAME },
    { $setOnInsert: { last_run_at: new Date(0) } },
    { upsert: true, new: true }
  );

  const since = state.last_run_at;
  const cutoff = new Date(Date.now() - SAFETY_BUFFER_MS);

  // Watermarked on created_at (ingestion time), not published_at — a backfilled/late item
  // could have an old published_at but still needs to run through clustering once.
  const newArticles = await Article.find({ created_at: { $gt: since, $lte: cutoff } }).sort({
    created_at: 1,
  });

  if (newArticles.length === 0) {
    await JobState.updateOne({ name: JOB_NAME }, { $set: { last_run_at: cutoff } });
    return { processed: 0, matched: 0, newClusters: 0 };
  }

  const candidateWindowStart = new Date(Date.now() - CANDIDATE_WINDOW_MS);

  // Fetched once per run, not once per new article — the candidate pool is the same for
  // every article in this batch, and Atlas round-trips add up otherwise.
  const candidates: CandidateArticle[] = await Article.find({
    published_at: { $gte: candidateWindowStart },
    cluster_id: { $exists: true },
  })
    .select("_id title summary cluster_id")
    .lean();

  let matched = 0;
  let newClusters = 0;

  for (const article of newArticles) {
    let bestMatch: { clusterId: Types.ObjectId; score: number } | null = null;

    for (const candidate of candidates) {
      if (candidate._id.equals(article._id) || !candidate.cluster_id) continue;

      const score = textSimilarity(
        `${article.title} ${article.summary}`,
        `${candidate.title} ${candidate.summary}`
      );
      if (score >= SIMILARITY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { clusterId: candidate.cluster_id, score };
      }
    }

    article.cluster_id = bestMatch ? bestMatch.clusterId : article._id;
    if (bestMatch) matched++;
    else newClusters++;

    await article.save();

    // Add the just-processed article to the in-memory candidate pool too, so two same-story
    // articles ingested seconds apart in the same batch (common with cron picking up
    // multiple feeds at once) still cluster with each other, not just with older articles.
    candidates.push({
      _id: article._id,
      title: article.title,
      summary: article.summary,
      cluster_id: article.cluster_id,
    });
  }

  await JobState.updateOne({ name: JOB_NAME }, { $set: { last_run_at: cutoff } });

  return { processed: newArticles.length, matched, newClusters };
}
