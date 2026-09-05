// The money. Given routing decisions, what does the workload cost routed vs.
// sent entirely to one frontier model - which is what most teams actually do.

import {
  cheapestInTier,
  modelById,
  MODELS,
  type Model,
  type Tier,
} from "./models";
import type { Decision } from "./route";

export interface Priced {
  decision: Decision;
  model: Model;
  cost: number;
  baselineCost: number;
  saved: number;
}

export interface Ledger {
  rows: Priced[];
  totalRouted: number;
  totalBaseline: number;
  totalSaved: number;
  /** 0-1. */
  savedPct: number;
  byTier: Record<Tier, number>;
  escalatedCount: number;
}

/** Cost of one call, in USD. Output tokens dominate most real bills. */
export function costOf(
  model: Model,
  inputTokens: number,
  outputTokens: number,
): number {
  const inTok = inputTokens * model.tokenMultiplier;
  const outTok = outputTokens * model.tokenMultiplier;
  return (inTok * model.inputPerM + outTok * model.outputPerM) / 1_000_000;
}

export function buildLedger(
  decisions: Decision[],
  baselineId: string,
  models: Model[] = MODELS,
): Ledger {
  const baseline = modelById(baselineId, models);
  const rows: Priced[] = decisions.map((decision) => {
    const model = cheapestInTier(decision.tier, models);
    const cost = costOf(model, decision.inputTokens, decision.outputTokens);
    const baselineCost = costOf(
      baseline,
      decision.inputTokens,
      decision.outputTokens,
    );
    return { decision, model, cost, baselineCost, saved: baselineCost - cost };
  });

  const totalRouted = rows.reduce((s, r) => s + r.cost, 0);
  const totalBaseline = rows.reduce((s, r) => s + r.baselineCost, 0);
  const byTier: Record<Tier, number> = { value: 0, mid: 0, frontier: 0 };
  for (const r of rows) byTier[r.decision.tier] += 1;

  return {
    rows,
    totalRouted,
    totalBaseline,
    totalSaved: totalBaseline - totalRouted,
    savedPct: totalBaseline === 0 ? 0 : 1 - totalRouted / totalBaseline,
    byTier,
    escalatedCount: rows.filter((r) => r.decision.escalated).length,
  };
}

/** Extrapolate a pasted sample to a monthly bill: the number that gets budget. */
export function monthly(costPerRun: number, runsPerDay: number): number {
  return costPerRun * runsPerDay * 30;
}

export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
