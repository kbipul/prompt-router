// Cheap, deterministic, network-free signals extracted from a prompt.
// These are half of the routing decision (the semantic half lives in route.ts).
// Keeping them pure makes the router unit-testable without downloading a model.

export interface Features {
  /** Rough token estimate: ~4 chars/token for English prose. */
  estTokens: number;
  hasCode: boolean;
  hasMath: boolean;
  multiStep: boolean;
  longContext: boolean;
  structuredOutput: boolean;
  agentic: boolean;
  creative: boolean;
  /** Wrong answers here are expensive: never route these to the cheap tier. */
  highStakes: boolean;
  nonLatin: boolean;
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

const CODE_HINTS =
  /(```|\bfunction\b|\bclass\b|\bconst\b|=>|\bdef\b|\bimport\b|\bselect\b|\bsql\b|\bquery\b|\bnpm\b|\brefactor\b|\bdebug\b|\bstack trace\b|\bexception\b|\bunit test\b|\bregex\b|\bcomponent\b|\bscript\b|\btypescript\b|\bpython\b)/i;
const MATH_HINTS =
  /(\bprove\b|\bderive\b|\bcalculate\b|\bintegral\b|\bprobability\b|\boptimi[sz]e\b|\bbig-?o\b|\bcomplexity\b|\balgorithm\b|\d+\s*[-+*/^=]\s*\d+)/i;
const MULTISTEP_HINTS =
  /(step[- ]by[- ]step|\bthen\b[\s\S]*\bthen\b|\bthen\b[\s\S]{0,90}\b(derive|prove|justify|recommend|rank|quantify|assess|explain)\b|\bfirst\b[\s\S]*\b(second|next|finally)\b|\bplan\b|\bcompare\b[\s\S]*\brecommend\b|\bfor each\b|\bbreak (it|this) down\b)/i;
const STRUCTURED_HINTS =
  /(\bjson\b|\byaml\b|\bcsv\b|\bschema\b|\bmarkdown table\b|\btable with\b|\bbullet(ed)? list\b|\bkey[- ]value\b)/i;
const AGENTIC_HINTS =
  /(\bcall the\b[\s\S]{0,30}\bapi\b|\buse the\b[\s\S]{0,30}\btool\b|\bbrowse\b|\bsearch the web\b|\biterate until\b|\bretry\b[\s\S]{0,20}\buntil\b|\bagent\b|\bmcp\b|\bfunction[- ]calling\b)/i;
const CREATIVE_HINTS =
  /(\bwrite a (poem|story|song|script)\b|\bbrainstorm\b|\bcome up with\b[\s\S]{0,30}\bideas\b|\btagline\b|\bslogan\b|\bcreative\b)/i;
const HIGH_STAKES_HINTS =
  /(\blegal\b|\bcontract\b|\bclause\b|\bliability\b|\bmedical\b|\bdiagnos\w*\b|\bpatient\b|\bcompliance\b|\bgdpr\b|\bhipaa\b|\bsecurity (review|audit)\b|\bincident\b|\bin production\b|\bproduction outage\b|\bfinancial (statement|advice)\b|\bregulat\w+\b)/i;

// Anything outside Latin (incl. extensions), general punctuation and currency
// symbols. Cheap models are far more uneven outside English, so the script a
// prompt is written in is a genuine routing signal.
const NON_LATIN = /[^\t\n\u0020-\u024F\u2000-\u206F\u20A0-\u20BF]/;

export function extractFeatures(prompt: string): Features {
  const estTokens = estimateTokens(prompt);
  return {
    estTokens,
    hasCode: CODE_HINTS.test(prompt),
    hasMath: MATH_HINTS.test(prompt),
    multiStep: MULTISTEP_HINTS.test(prompt),
    longContext: estTokens > 600,
    structuredOutput: STRUCTURED_HINTS.test(prompt),
    agentic: AGENTIC_HINTS.test(prompt),
    creative: CREATIVE_HINTS.test(prompt),
    highStakes: HIGH_STAKES_HINTS.test(prompt),
    nonLatin: NON_LATIN.test(prompt),
  };
}

/**
 * Feature-only difficulty, 0-100. Deliberately conservative about length:
 * a 5,000-token document that needs a one-line summary is still easy work,
 * so size alone can never push a prompt to the frontier tier.
 */
export function difficultyScore(f: Features): number {
  let s = 0;
  // Calibration note: any single "real work" signal must clear the value band
  // on its own. The keyword router is blind to nuance - it cannot tell "add
  // JSDoc comments" (trivial) from "refactor this module" (not) - so when it
  // is the only router running it deliberately errs toward overspending.
  // The semantic layer is what earns those cents back.
  if (f.hasCode) s += 40;
  if (f.hasMath) s += 45;
  if (f.multiStep) s += 38;
  if (f.agentic) s += 60;
  if (f.highStakes) s += 45;
  if (f.nonLatin) s += 8;
  if (f.longContext) s += 10;
  // Structured output and creative work are *easier* than they look: cheap
  // models follow a schema fine, and "brainstorm 5 taglines" has no wrong answer.
  if (f.structuredOutput) s -= 6;
  if (f.creative) s -= 10;
  return Math.max(0, Math.min(100, s));
}

/** Human-readable reasons, for the "why" chips in the UI. */
export function featureReasons(f: Features): string[] {
  const r: string[] = [];
  if (f.hasCode) r.push("code");
  if (f.hasMath) r.push("math/algorithmic");
  if (f.multiStep) r.push("multi-step");
  if (f.agentic) r.push("agentic / tool use");
  if (f.highStakes) r.push("high-stakes");
  if (f.longContext) r.push(`long input (~${f.estTokens} tok)`);
  if (f.nonLatin) r.push("non-Latin script");
  if (f.structuredOutput) r.push("structured output");
  if (f.creative) r.push("creative");
  return r;
}

/**
 * Expected output length in tokens, by prompt shape. Output is where the bill
 * actually lands (3-6x the input price), so guessing it badly ruins the ledger.
 */
export function expectedOutputTokens(f: Features): number {
  if (f.hasCode || f.agentic) return 700;
  if (f.multiStep || f.hasMath) return 550;
  if (f.creative) return 400;
  if (f.structuredOutput) return 200;
  return 250;
}
