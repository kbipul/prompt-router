// Thin wrapper around a transformers.js feature-extraction pipeline.
// all-MiniLM-L6-v2 (~23MB) downloads once from the Hugging Face CDN, is cached
// by the browser, and then runs fully on-device. Everything downstream of this
// file is pure math, so the router still works (in feature-only mode) if the
// model never loads - which matters, because a router that hard-fails offline
// is a router nobody trusts in production.
import type { Vec } from "./vec";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

interface Tensorish {
  tolist: () => number[][];
}
type Embedder = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<Tensorish>;

let pipePromise: Promise<Embedder> | null = null;

export type ProgressCallback = (status: string, pct: number) => void;

export function getEmbedder(onProgress?: ProgressCallback): Promise<Embedder> {
  pipePromise ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const build = pipeline as unknown as (
      task: string,
      model: string,
      opts: Record<string, unknown>,
    ) => Promise<unknown>;
    const pipe = await build("feature-extraction", MODEL_ID, {
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (onProgress) onProgress(p.status ?? "", Math.round(p.progress ?? 0));
      },
    });
    return pipe as Embedder;
  })();
  return pipePromise;
}

/** Embed a batch of texts into L2-normalized vectors. */
export async function embed(
  texts: string[],
  onProgress?: ProgressCallback,
): Promise<Vec[]> {
  if (texts.length === 0) return [];
  const pipe = await getEmbedder(onProgress);
  const out = await pipe(texts, { pooling: "mean", normalize: true });
  return out.tolist();
}
