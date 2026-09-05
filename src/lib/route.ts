// The router. Two independent opinions, then a deliberate bias toward safety.
//
//   feature score  ---\
//                      >--- blended difficulty --> tier --> escalation guard
//   semantic k-NN  ---/
//
// The guard exists because the two failure modes are not symmetric. Routing an
// easy prompt to an expensive model wastes cents. Routing a contract review to
// a bulk model can cost a company a lawsuit. So every rule below that changes a
// tier only ever moves it *up*.

import {
  expectedOutputTokens,
  extractFeatures,
  featureReasons,
  difficultyScore,
  type Features,
} from "./features";
import { EXEMPLARS } from "./exemplars";
import { TIER_ORDER, type Tier } from "./models";
import { cosine, type Vec } from "./vec";

export interface Decision {
  prompt: string;
  features: Features;
  /** 0-100 blended difficulty. */
  score: number;
  featureScore: number;
  /** Tier suggested by nearest exemplars, or null in feature-only mode. */
  semanticTier: Tier | null;
  /** Agreement of the k nearest exemplars, 0-1. Low = the router is unsure. */
  confidence: number;
  tier: Tier;
  /** True when the guard pushed the prompt up a tier. */
  escalated: boolean;
  reasons: string[];
  inputTokens: number;
  outputTokens: number;
}

const TIER_VALUE: Record<Tier, number> = { value: 15, mid: 55, frontier: 90 };
const K = 5;

/** Difficulty -> tier. Thresholds are the router's only magic numbers. */
export function tierForScore(score: number): Tier {
  if (score < 35) return "value";
  if (score < 70) return "mid";
  return "frontier";
}

export function bumpUp(tier: Tier): Tier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)];
}

export function maxTier(a: Tier, b: Tier): Tier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

interface SemanticVerdict {
  tier: Tier;
  confidence: number;
}

/** k-NN over the exemplar set, weighted by cosine similarity. */
export function semanticVerdict(
  promptVec: Vec,
  exemplarVecs: Vec[],
  k = K,
): SemanticVerdict {
  const scored = exemplarVecs
    .map((v, i) => ({ sim: cosine(promptVec, v), tier: EXEMPLARS[i].tier }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);

  const weights: Record<Tier, number> = { value: 0, mid: 0, frontier: 0 };
  let total = 0;
  for (const s of scored) {
    // Similarities live in roughly [0, 1] here; clamp negatives to zero so an
    // unrelated exemplar can never vote with negative weight.
    const w = Math.max(0, s.sim);
    weights[s.tier] += w;
    total += w;
  }
  if (total === 0) return { tier: "mid", confidence: 0 };

  const winner = TIER_ORDER.reduce((a, b) =>
    weights[b] > weights[a] ? b : a,
  );
  return { tier: winner, confidence: weights[winner] / total };
}

export interface RouteOptions {
  /** Embeddings for EXEMPLARS, in order. Omit for feature-only mode. */
  exemplarVecs?: Vec[];
  /** Embedding of this prompt. Omit for feature-only mode. */
  promptVec?: Vec;
  /** Below this k-NN agreement, escalate a tier rather than guess cheap. */
  confidenceFloor?: number;
  /** At or above this agreement, a higher semantic tier overrules the blend. */
  confidentOverrule?: number;
}

export function route(prompt: string, opts: RouteOptions = {}): Decision {
  const { confidenceFloor = 0.55, confidentOverrule = 0.8 } = opts;
  const features = extractFeatures(prompt);
  const featureScore = difficultyScore(features);
  const reasons = featureReasons(features);

  let semanticTier: Tier | null = null;
  let confidence = 0;
  let score = featureScore;

  if (opts.promptVec && opts.exemplarVecs?.length) {
    const v = semanticVerdict(opts.promptVec, opts.exemplarVecs);
    semanticTier = v.tier;
    confidence = v.confidence;
    // Blend: the keyword features are precise but blind; the embeddings are
    // fuzzy but see meaning. Weighting them evenly beat every lopsided split I
    // tried against the sample workloads.
    score = Math.round(0.5 * featureScore + 0.5 * TIER_VALUE[semanticTier]);
    reasons.push(`semantically nearest: ${semanticTier}`);
  } else {
    reasons.push("feature-only mode (no embeddings)");
  }

  let tier = tierForScore(score);
  let escalated = false;

  // --- Guard 1: never send an expensive-to-be-wrong prompt to the bulk tier.
  if (features.highStakes && tier === "value") {
    tier = "mid";
    escalated = true;
    reasons.push("guard: high-stakes never routes to value");
  }
  // --- Guard 2: agentic loops compound errors; they get the best model.
  if (features.agentic && tier !== "frontier") {
    tier = "frontier";
    escalated = true;
    reasons.push("guard: agentic loop escalated to frontier");
  }
  // --- Guard 3: when the k-NN vote is split, buy the insurance rather than
  // guessing cheap. A router that saves money by being unsure is a bug, not a
  // feature - the downside of one wrong frontier-grade answer dwarfs the few
  // cents saved by routing it to the bulk tier.
  if (semanticTier && confidence < confidenceFloor && tier !== "frontier") {
    tier = bumpUp(tier);
    escalated = true;
    reasons.push(
      `guard: low confidence (${Math.round(confidence * 100)}%), escalated`,
    );
  }
  // --- Guard 4: believe a confident embedding router over the keywords. The
  // keywords cannot see that "design a failover architecture and justify the
  // trade-offs" is hard work - no rule fires on it - but its nearest exemplars
  // can. Averaging the two would drag that prompt back down to the middle, so
  // a confident semantic verdict is allowed to overrule the blend upward.
  if (
    semanticTier &&
    confidence >= confidentOverrule &&
    maxTier(tier, semanticTier) !== tier
  ) {
    tier = semanticTier;
    escalated = true;
    reasons.push(
      `guard: embeddings confidently say ${semanticTier} (${Math.round(
        confidence * 100,
      )}%)`,
    );
  }

  return {
    prompt,
    features,
    score,
    featureScore,
    semanticTier,
    confidence,
    tier,
    escalated,
    reasons,
    inputTokens: features.estTokens,
    outputTokens: expectedOutputTokens(features),
  };
}

/** Split a pasted workload into prompts: one per non-empty line. */
export function parseWorkload(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
