import type { Tier } from "./models";

/**
 * The semantic half of the router: a small, hand-labelled set of exemplar
 * prompts, one per tier. At runtime every exemplar is embedded once, and an
 * incoming prompt is routed by cosine similarity to its nearest neighbours
 * (k-NN). This is what lets the router recognise "translate this to French"
 * as bulk work even though no keyword rule fires on it.
 *
 * Labels are my judgement calls about what each tier can reliably do in July
 * 2026, not benchmark results. They are the tuning surface of this project:
 * disagree with a label, change it, and the router changes with it.
 */
export interface Exemplar {
  text: string;
  tier: Tier;
}

export const EXEMPLARS: Exemplar[] = [
  // --- value: bulk work; a cheap model does this as well as an expensive one
  { text: "Classify this support ticket as billing, bug, or feature request.", tier: "value" },
  { text: "Extract the company name, date and invoice total from this email.", tier: "value" },
  { text: "Summarize this article in three bullet points.", tier: "value" },
  { text: "Rewrite this paragraph to be shorter and more polite.", tier: "value" },
  { text: "Translate this product description into French.", tier: "value" },
  { text: "Is the sentiment of this review positive, negative or neutral?", tier: "value" },
  { text: "Turn these meeting notes into a bulleted action list.", tier: "value" },
  { text: "Fix the spelling and grammar in this message.", tier: "value" },
  { text: "Write a friendly one-line reply confirming the order shipped.", tier: "value" },
  { text: "Tag this blog post with five relevant keywords.", tier: "value" },

  // --- mid: real reasoning or real code, but bounded and low-stakes
  { text: "Write a Python function that parses this log format and returns a dataframe.", tier: "mid" },
  { text: "Explain why this SQL query is slow and suggest two indexes.", tier: "mid" },
  { text: "Given these three vendor quotes, compare them on cost and support, and recommend one.", tier: "mid" },
  { text: "Draft a project plan with milestones for migrating our API to v2.", tier: "mid" },
  { text: "Refactor this React component to use hooks and explain each change.", tier: "mid" },
  { text: "Read this 20-page report and answer the five questions below.", tier: "mid" },
  { text: "Write unit tests covering the edge cases of this parsing function.", tier: "mid" },
  { text: "Convert this business rule description into a decision table.", tier: "mid" },

  // --- frontier: hard reasoning, agentic loops, or expensive-to-be-wrong
  { text: "Review this commercial contract, flag every clause that shifts liability to us, and quantify the exposure.", tier: "frontier" },
  { text: "Debug this intermittent production outage from these logs, form hypotheses, and rank them by likelihood.", tier: "frontier" },
  { text: "Prove that this scheduling algorithm terminates, then derive its worst-case complexity.", tier: "frontier" },
  { text: "You are an agent with a search tool and a code tool. Iterate until the test suite passes.", tier: "frontier" },
  { text: "Design a multi-region failover architecture and justify each trade-off against our compliance constraints.", tier: "frontier" },
  { text: "Assess whether this data-processing flow is GDPR compliant and cite the articles that apply.", tier: "frontier" },
  { text: "Given this patient's history, list the differential diagnoses a clinician should rule out.", tier: "frontier" },
  { text: "Plan and execute a multi-step research task: browse sources, cross-check claims, and produce a cited report.", tier: "frontier" },
];
