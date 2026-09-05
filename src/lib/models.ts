// Model catalog — USD per 1,000,000 tokens, grouped into routing tiers.
//
// HONESTY NOTE: these are publicly cited list prices as of PRICES_AS_OF, not a
// source of truth. Prices move weekly and every provider tokenizes differently.
// Everything here is an editable default — change it in the UI (or this file)
// before you trust a number. The router's *logic* is the product; the price
// table is only the yardstick it measures savings against.

export type Tier = "value" | "mid" | "frontier";

export interface Model {
  id: string;
  name: string;
  vendor: string;
  tier: Tier;
  /** USD per 1M input tokens */
  inputPerM: number;
  /** USD per 1M output tokens */
  outputPerM: number;
  /**
   * This app estimates tokens with one simple heuristic counter. Providers
   * whose native tokenizer splits the same English text differently get a
   * multiplier so the billed estimate lands closer to reality. 1.0 == same.
   */
  tokenMultiplier: number;
  note: string;
}

export const PRICES_AS_OF = "2026-07-14";

export const MODELS: Model[] = [
  {
    id: "glm-5-2",
    name: "GLM-5.2",
    vendor: "Z.ai",
    tier: "value",
    inputPerM: 1.4,
    outputPerM: 4.4,
    tokenMultiplier: 1.0,
    note: "Open weights. First-party list price; reported to match frontier coding quality at a fraction of the cost — the reason routing suddenly matters.",
  },
  {
    id: "gpt-5-6-luna",
    name: "GPT-5.6 Luna",
    vendor: "OpenAI",
    tier: "value",
    inputPerM: 1.0,
    outputPerM: 6.0,
    tokenMultiplier: 1.0,
    note: "The high-volume tier — cheapest OpenAI option at GA (mid-July 2026).",
  },
  {
    id: "grok-4-5",
    name: "Grok 4.5",
    vendor: "xAI",
    tier: "mid",
    inputPerM: 2.0,
    outputPerM: 6.0,
    tokenMultiplier: 1.0,
    note: "Launched 2026-07-09 — strong reasoning at a volume-tier output price.",
  },
  {
    id: "gpt-5-6-terra",
    name: "GPT-5.6 Terra",
    vendor: "OpenAI",
    tier: "mid",
    inputPerM: 2.5,
    outputPerM: 15.0,
    tokenMultiplier: 1.0,
    note: "GA mid-July 2026; the mid tier that anchors against Sonnet 5.",
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    vendor: "Anthropic",
    tier: "frontier",
    inputPerM: 3.0,
    outputPerM: 15.0,
    tokenMultiplier: 1.42,
    note: "Standard list price. Its tokenizer emits ~42% more tokens on English text, so the same prompt bills higher than the raw count suggests.",
  },
];

export const TIER_ORDER: Tier[] = ["value", "mid", "frontier"];

export const TIER_LABEL: Record<Tier, string> = {
  value: "Value",
  mid: "Mid",
  frontier: "Frontier",
};

export const TIER_BLURB: Record<Tier, string> = {
  value:
    "Bulk work: classification, extraction, rewriting, short answers. Cheap models are already good enough here — this is where the money leaks.",
  mid: "Real reasoning, non-trivial code, multi-step instructions, long inputs.",
  frontier:
    "Hard reasoning, high-stakes output, agentic tool loops — anywhere a wrong answer is expensive.",
};

/** Cheapest model in a tier, blended 3:1 input:output (a typical chat mix). */
export function cheapestInTier(tier: Tier, models: Model[] = MODELS): Model {
  const inTier = models.filter((m) => m.tier === tier);
  if (inTier.length === 0) throw new Error(`No models in tier: ${tier}`);
  const blended = (m: Model) =>
    (m.inputPerM * 3 + m.outputPerM) * m.tokenMultiplier;
  return inTier.reduce((a, b) => (blended(b) < blended(a) ? b : a));
}

export function modelById(id: string, models: Model[] = MODELS): Model {
  const m = models.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown model: ${id}`);
  return m;
}

/** What a team pays if it never routes at all: everything to the best model. */
export const DEFAULT_BASELINE_ID = "claude-sonnet-5";
