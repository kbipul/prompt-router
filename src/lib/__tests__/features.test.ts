import { describe, expect, it } from "vitest";
import {
  difficultyScore,
  estimateTokens,
  expectedOutputTokens,
  extractFeatures,
  featureReasons,
} from "../features";

describe("estimateTokens", () => {
  it("is zero for empty input", () => {
    expect(estimateTokens("   ")).toBe(0);
  });
  it("scales with length", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("extractFeatures", () => {
  it("detects code", () => {
    expect(extractFeatures("Refactor this React component").hasCode).toBe(true);
    expect(extractFeatures("Say hello to the customer").hasCode).toBe(false);
  });

  it("detects high-stakes prompts", () => {
    const f = extractFeatures(
      "Review this contract and flag any clause that shifts liability to us.",
    );
    expect(f.highStakes).toBe(true);
  });

  it("detects agentic loops", () => {
    expect(
      extractFeatures("You are an agent: iterate until the tests pass").agentic,
    ).toBe(true);
  });

  it("detects non-Latin script but not accents, dashes or currency", () => {
    expect(extractFeatures("Resume el ticket, por favor").nonLatin).toBe(false);
    expect(extractFeatures("It costs 500 - fine").nonLatin).toBe(false);
    expect(extractFeatures("hello नमस्ते").nonLatin).toBe(true);
  });

  it("only flags longContext past the threshold", () => {
    expect(extractFeatures("short one").longContext).toBe(false);
    expect(extractFeatures("x".repeat(4000)).longContext).toBe(true);
  });
});

describe("difficultyScore", () => {
  it("stays low for bulk work", () => {
    const f = extractFeatures("Summarize this article in three bullets.");
    expect(difficultyScore(f)).toBeLessThan(35);
  });

  it("rises for hard, high-stakes reasoning", () => {
    const f = extractFeatures(
      "Prove this algorithm terminates, then derive its complexity, and assess the compliance risk step-by-step.",
    );
    expect(difficultyScore(f)).toBeGreaterThanOrEqual(70);
  });

  it("never lets length alone reach the frontier band", () => {
    // A very long but trivial prompt: summarizing a big doc is still easy work.
    const f = extractFeatures("Summarize the following. " + "word ".repeat(2000));
    expect(f.longContext).toBe(true);
    expect(difficultyScore(f)).toBeLessThan(70);
  });

  it("is clamped to 0-100", () => {
    const f = extractFeatures(
      "As an agent, call the API tool, prove the algorithm, review the contract for GDPR compliance step-by-step in typescript. " +
        "x".repeat(3000),
    );
    const s = difficultyScore(f);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("featureReasons + expectedOutputTokens", () => {
  it("explains itself", () => {
    const f = extractFeatures("Refactor this python function and add unit tests");
    expect(featureReasons(f)).toContain("code");
  });

  it("expects longer output from code than from extraction", () => {
    const code = extractFeatures("Write a python function that parses logs");
    const extract = extractFeatures("Extract the invoice total as json");
    expect(expectedOutputTokens(code)).toBeGreaterThan(
      expectedOutputTokens(extract),
    );
  });
});
