// Sample workloads: a realistic day of prompts from three different teams.
// These are what the demo opens on, so they have to be honest - a workload
// stuffed with trivial prompts would fake a huge saving.

export interface Workload {
  id: string;
  name: string;
  blurb: string;
  prompts: string;
}

export const WORKLOADS: Workload[] = [
  {
    id: "support",
    name: "Support inbox",
    blurb:
      "The classic high-volume, low-difficulty workload - and the one most often pointed at a frontier model out of habit.",
    prompts: [
      "Classify this ticket: 'my card was charged twice for the same order' - billing, bug, or feature request?",
      "Summarize this 40-message email thread into three bullets for the account manager.",
      "Rewrite this reply to sound warmer without promising a refund.",
      "Extract the order number and delivery date from this customer message.",
      "Is this review positive, negative or neutral? 'Took 3 weeks but the product is great.'",
      "Translate this shipping delay notice into Spanish.",
      "Draft a one-line acknowledgement that we received the complaint.",
      "The customer is threatening legal action over a data deletion request under GDPR - draft our response and assess our exposure.",
      "Debug why our webhook retries are firing twice in production; here are the logs and the retry config.",
      "Tag this ticket with the right product area from our taxonomy.",
    ].join("\n"),
  },
  {
    id: "engineering",
    name: "Engineering team",
    blurb:
      "Mostly code, but not all code is equal - a rename is not an architecture review, and the router should say so.",
    prompts: [
      "Write a regex that validates our internal employee ID format: two letters, a dash, six digits.",
      "Add JSDoc comments to this TypeScript utility function.",
      "Explain why this SQL query is slow and suggest two indexes.",
      "Refactor this React component to use hooks and explain each change.",
      "Write unit tests covering the edge cases of this date-parsing function.",
      "Convert this shell script to Python.",
      "You are an agent with a shell tool: iterate until the failing test suite passes, then summarize what you changed.",
      "Design a multi-region failover architecture for our payments service and justify each trade-off against our compliance constraints.",
      "Prove that this retry-with-backoff algorithm terminates, then derive its worst-case complexity.",
      "Summarize the changes in this pull request in two sentences.",
    ].join("\n"),
  },
  {
    id: "mixed",
    name: "Mixed enterprise day",
    blurb:
      "What an internal copilot actually sees: a long tail of cheap work with a few genuinely hard prompts hidden in it.",
    prompts: [
      "Turn these meeting notes into a bulleted action list with owners.",
      "Draft a LinkedIn post announcing our new office, friendly tone.",
      "Brainstorm ten taglines for the campaign.",
      "Extract every date and amount from this invoice into JSON.",
      "Fix the grammar in this all-hands email.",
      "Review this vendor contract, flag every clause that shifts liability to us, and quantify the exposure.",
      "Compare these three cloud providers on cost and support, then recommend one for our data platform.",
      "Assess whether this data-processing flow is HIPAA compliant and cite the sections that apply.",
      "Summarize this 30-page quarterly report in five bullets.",
      "Write a friendly reminder that expense reports are due Friday.",
    ].join("\n"),
  },
];
