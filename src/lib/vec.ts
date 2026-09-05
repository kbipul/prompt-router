// Pure vector math. No imports, no network - so the routing logic that depends
// on it can be tested in milliseconds.

export type Vec = number[];

export function dot(a: Vec, b: Vec): number {
  if (a.length !== b.length) throw new Error("dimension mismatch");
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity, clamped to [-1, 1] against float drift. */
export function cosine(a: Vec, b: Vec): number {
  const d = norm(a) * norm(b);
  if (d === 0) return 0;
  return Math.max(-1, Math.min(1, dot(a, b) / d));
}
