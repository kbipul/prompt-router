import { describe, expect, it } from "vitest";
import { EXEMPLARS } from "../exemplars";
import {
  bumpUp,
  maxTier,
  parseWorkload,
  route,
  semanticVerdict,
  tierForScore,
} from "../route";
import type { Vec } from "../vec";

// Fake, deterministic "embeddings": a 3-dim one-hot per tier. This lets us test
// the semantic path and the guards without downloading a 23MB model.
const ONE_HOT: Record<string, Vec> = {
  value: [1, 0, 0],
  mid: [0, 1, 0],
  frontier: [0, 0, 1],
};
const exemplarVecs: Vec[] = EXEMPLARS.map((e) => ONE_HOT[e.tier]);

describe("tierForScore", () => {
  it("maps the three bands", () => {
    expect(tierForScore(0)).toBe("value");
    expect(tierForScore(34)).toBe("value");
    expect(tierForScore(35)).toBe("mid");
    expect(tierForScore(69)).toBe("mid");
    expect(tierForScore(70)).toBe("frontier");
    expect(tierForScore(100)).toBe("frontier");
  });
});

describe("bumpUp / maxTier", () => {
  it("moves up one tier and saturates at frontier", () => {
    expect(bumpUp("value")).toBe("mid");
    expect(bumpUp("mid")).toBe("frontier");
    expect(bumpUp("frontier")).toBe("frontier");
  });
  it("picks the higher tier", () => {
    expect(maxTier("value", "frontier")).toBe("frontier");
    expect(maxTier("mid", "value")).toBe("mid");
  });
});

describe("semanticVerdict", () => {
  it("returns the tier of the nearest exemplars with full confidence", () => {
    const v = semanticVerdict(ONE_HOT.frontier, exemplarVecs);
    expect(v.tier).toBe("frontier");
    expect(v.confidence).toBeCloseTo(1, 5);
  });

  it("is unconfident when the prompt is orthogonal to everything", () => {
    const v = semanticVerdict([0, 0, 0], exemplarVecs);
    expect(v.confidence).toBe(0);
  });
});

describe("route (feature-only mode)", () => {
  it("sends bulk work to the value tier", () => {
    const d = route("Summarize this article in three bullet points.");
    expect(d.tier).toBe("value");
    expect(d.semanticTier).toBeNull();
    expect(d.reasons).toContain("feature-only mode (no embeddings)");
  });

  it("never sends a high-stakes prompt to the value tier", () => {
    const d = route("Summarize this contract clause about liability.");
    expect(d.tier).not.toBe("value");
  });

  it("always escalates agentic loops to frontier", () => {
    const d = route("You are an agent: browse the docs and fix the typo.");
    expect(d.tier).toBe("frontier");
    expect(d.escalated).toBe(true);
  });

  it("estimates input and output tokens", () => {
    const d = route("Write a python function that parses this log format.");
    expect(d.inputTokens).toBeGreaterThan(0);
    expect(d.outputTokens).toBe(700);
  });
});

describe("route (semantic mode)", () => {
  it("guard 1: a value-looking embedding cannot drag high-stakes work down", () => {
    // Blended score lands in the value band (the embeddings think this is
    // routine), but the prompt is about contractual liability. The guard wins.
    const d = route("Summarize this contract clause about liability.", {
      promptVec: ONE_HOT.value,
      exemplarVecs,
    });
    expect(d.semanticTier).toBe("value");
    expect(d.tier).not.toBe("value");
    expect(d.escalated).toBe(true);
    expect(d.reasons.some((r) => r.includes("high-stakes"))).toBe(true);
  });

  it("guard 4: a confident semantic verdict overrules the blend upward", () => {
    // No keyword rule fires on this, so the feature score is 0 - but its
    // nearest exemplars are unanimous that it is frontier work.
    const d = route("Please have a look at this.", {
      promptVec: ONE_HOT.frontier,
      exemplarVecs,
    });
    expect(d.featureScore).toBe(0);
    expect(d.confidence).toBeCloseTo(1, 5);
    expect(d.tier).toBe("frontier");
    expect(d.escalated).toBe(true);
  });

  it("blends the semantic verdict into the score", () => {
    // Trivially-worded prompt, but its embedding says 'frontier'.
    const d = route("Please have a look at this.", {
      promptVec: ONE_HOT.frontier,
      exemplarVecs,
    });
    expect(d.semanticTier).toBe("frontier");
    expect(d.score).toBeGreaterThan(d.featureScore);
    expect(d.confidence).toBeCloseTo(1, 5);
  });

  it("routes a keyword-free bulk prompt cheaply when embeddings agree", () => {
    const d = route("Please have a look at this.", {
      promptVec: ONE_HOT.value,
      exemplarVecs,
    });
    expect(d.tier).toBe("value");
    expect(d.escalated).toBe(false);
  });

  it("escalates rather than guessing when the k-NN vote is split", () => {
    // Build a neighbourhood that is genuinely split: exactly three 'value' and
    // two 'frontier' exemplars sit near the prompt, everything else is
    // orthogonal (zero vector => zero weight). An ambiguous prompt vector is
    // then equidistant from both camps, so the top-5 vote is 3-2 and
    // confidence lands at 0.6 - a coin-flip the router must not take.
    const near = (tier: string, n: number) => {
      let left = n;
      return EXEMPLARS.map((e) =>
        e.tier === tier && left-- > 0 ? ONE_HOT[tier] : null,
      );
    };
    const valueNear = near("value", 3);
    const frontierNear = near("frontier", 2);
    const splitVecs: Vec[] = EXEMPLARS.map(
      (_e, i) => valueNear[i] ?? frontierNear[i] ?? [0, 0, 0],
    );
    const ambiguous: Vec = [1, 0, 1];

    const split = semanticVerdict(ambiguous, splitVecs);
    expect(split.tier).toBe("value");
    expect(split.confidence).toBeCloseTo(0.6, 5);

    const d = route("Please have a look at this.", {
      promptVec: ambiguous,
      exemplarVecs: splitVecs,
      confidenceFloor: 0.75,
    });
    expect(d.escalated).toBe(true);
    expect(d.tier).not.toBe("value");
  });

  it("does not escalate when the vote is confident", () => {
    const d = route("Please have a look at this.", {
      promptVec: ONE_HOT.value,
      exemplarVecs,
      confidenceFloor: 0.75,
    });
    expect(d.confidence).toBeGreaterThan(0.75);
    expect(d.escalated).toBe(false);
    expect(d.tier).toBe("value");
  });
});

describe("parseWorkload", () => {
  it("splits on lines and drops blanks", () => {
    expect(parseWorkload("a\n\n  b  \n")).toEqual(["a", "b"]);
  });
});
