import { describe, expect, it } from "vitest";
import { buildLedger, costOf, monthly, usd } from "../ledger";
import { cheapestInTier, MODELS, modelById } from "../models";
import { route } from "../route";
import { WORKLOADS } from "../workloads";
import { parseWorkload } from "../route";

describe("costOf", () => {
  it("prices input and output separately", () => {
    const m = modelById("gpt-5-6-luna"); // $1/M in, $6/M out
    // 1M input tokens + 1M output tokens = $1 + $6
    expect(costOf(m, 1_000_000, 1_000_000)).toBeCloseTo(7, 6);
  });

  it("applies the tokenizer multiplier", () => {
    const sonnet = modelById("claude-sonnet-5"); // 1.42x
    const plain = { ...sonnet, tokenMultiplier: 1 };
    expect(costOf(sonnet, 1000, 1000)).toBeCloseTo(
      costOf(plain, 1000, 1000) * 1.42,
      9,
    );
  });
});

describe("cheapestInTier", () => {
  it("picks the cheapest model on a 3:1 blended mix", () => {
    // value tier: Luna ($1/$6 -> 9) vs GLM-5.2 ($1.4/$4.4 -> 8.6)
    expect(cheapestInTier("value", MODELS).id).toBe("glm-5-2");
  });

  it("throws on an empty tier", () => {
    expect(() => cheapestInTier("mid", [])).toThrow();
  });
});

describe("buildLedger", () => {
  const decisions = parseWorkload(WORKLOADS[0].prompts).map((p) => route(p));
  const ledger = buildLedger(decisions, "claude-sonnet-5");

  it("prices every prompt", () => {
    expect(ledger.rows).toHaveLength(decisions.length);
  });

  it("routing is never more expensive than the frontier baseline", () => {
    expect(ledger.totalRouted).toBeLessThanOrEqual(ledger.totalBaseline);
    expect(ledger.totalSaved).toBeGreaterThan(0);
    expect(ledger.savedPct).toBeGreaterThan(0);
    expect(ledger.savedPct).toBeLessThan(1);
  });

  it("a frontier-routed prompt saves nothing against a frontier baseline", () => {
    const d = route("You are an agent: iterate until the tests pass.");
    const l = buildLedger([d], "claude-sonnet-5");
    expect(l.rows[0].decision.tier).toBe("frontier");
    expect(l.totalSaved).toBeCloseTo(0, 9);
  });

  it("counts every prompt into exactly one tier", () => {
    const counted =
      ledger.byTier.value + ledger.byTier.mid + ledger.byTier.frontier;
    expect(counted).toBe(decisions.length);
  });

  it("counts guard escalations (the engineering workload has an agentic loop)", () => {
    const eng = parseWorkload(WORKLOADS[1].prompts).map((p) => route(p));
    expect(buildLedger(eng, "claude-sonnet-5").escalatedCount).toBeGreaterThan(0);
  });

  it("handles an empty workload without dividing by zero", () => {
    const l = buildLedger([], "claude-sonnet-5");
    expect(l.savedPct).toBe(0);
    expect(l.totalBaseline).toBe(0);
  });
});

describe("monthly + usd", () => {
  it("extrapolates a run to 30 days", () => {
    expect(monthly(0.5, 100)).toBeCloseTo(1500, 6);
  });
  it("formats small and large amounts readably", () => {
    expect(usd(0)).toBe("$0");
    expect(usd(0.0001234)).toBe("$0.00012");
    expect(usd(1234.5)).toBe("$1,234.5");
  });
});
