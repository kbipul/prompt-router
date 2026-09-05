import { useEffect, useMemo, useRef, useState } from "react";
import { embed } from "./lib/embed";
import { EXEMPLARS } from "./lib/exemplars";
import { buildLedger, monthly, usd, type Ledger } from "./lib/ledger";
import {
  DEFAULT_BASELINE_ID,
  MODELS,
  PRICES_AS_OF,
  TIER_BLURB,
  TIER_LABEL,
  TIER_ORDER,
  modelById,
} from "./lib/models";
import { parseWorkload, route, type Decision } from "./lib/route";
import { WORKLOADS } from "./lib/workloads";
import type { Vec } from "./lib/vec";

type EmbedState = "loading" | "ready" | "failed";

export default function App() {
  const [workloadId, setWorkloadId] = useState(WORKLOADS[0].id);
  const [text, setText] = useState(WORKLOADS[0].prompts);
  const [baselineId, setBaselineId] = useState(DEFAULT_BASELINE_ID);
  const [runsPerDay, setRunsPerDay] = useState(500);

  // Start immediately: the app is useful in feature-only mode from the first
  // paint, and sharpens itself the moment MiniLM finishes downloading.
  const [embedState, setEmbedState] = useState<EmbedState>("loading");
  const [progress, setProgress] = useState(0);
  const [exemplarVecs, setExemplarVecs] = useState<Vec[] | null>(null);
  const [promptVecs, setPromptVecs] = useState<Map<string, Vec>>(new Map());

  const prompts = useMemo(() => parseWorkload(text), [text]);
  const runId = useRef(0);

  // Semantic mode: embed the exemplars once, then every prompt in the workload.
  // Feature-only routing keeps working the whole time - this only sharpens it.
  useEffect(() => {
    if (embedState !== "loading" && embedState !== "ready") return;
    if (prompts.length === 0) return;
    const id = ++runId.current;

    (async () => {
      try {
        let ex = exemplarVecs;
        if (!ex) {
          ex = await embed(
            EXEMPLARS.map((e) => e.text),
            (_s, pct) => setProgress(pct),
          );
          if (id !== runId.current) return;
          setExemplarVecs(ex);
        }
        const missing = prompts.filter((p) => !promptVecs.has(p));
        if (missing.length > 0) {
          const vecs = await embed(missing);
          if (id !== runId.current) return;
          setPromptVecs((prev) => {
            const next = new Map(prev);
            missing.forEach((p, i) => next.set(p, vecs[i]));
            return next;
          });
        }
        setEmbedState("ready");
      } catch (err) {
        console.error(err);
        setEmbedState("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedState, text]);

  const semanticOn = embedState === "ready" && exemplarVecs !== null;

  const decisions: Decision[] = useMemo(
    () =>
      prompts.map((p) =>
        route(p, {
          exemplarVecs: semanticOn ? exemplarVecs! : undefined,
          promptVec: semanticOn ? promptVecs.get(p) : undefined,
        }),
      ),
    [prompts, semanticOn, exemplarVecs, promptVecs],
  );

  const ledger: Ledger = useMemo(
    () => buildLedger(decisions, baselineId),
    [decisions, baselineId],
  );

  const baseline = modelById(baselineId);
  const savedPct = Math.round(ledger.savedPct * 100);

  function pickWorkload(id: string) {
    const w = WORKLOADS.find((x) => x.id === id)!;
    setWorkloadId(id);
    setText(w.prompts);
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>
          Prompt Router <span className="dot" />
        </h1>
        <p className="sub">
          Most teams send every prompt to their most expensive model. This routes
          each one to the cheapest tier that can actually handle it &mdash; and
          shows you the bill either way. Runs 100% in your browser.
        </p>
      </header>

      <section className="savings" aria-live="polite">
        <div className="saveblock">
          <span className="label">Baseline &mdash; everything to {baseline.name}</span>
          <span className="big strike">{usd(ledger.totalBaseline)}</span>
          <span className="label muted">
            {usd(monthly(ledger.totalBaseline, runsPerDay))}/mo at {runsPerDay}{" "}
            runs/day
          </span>
        </div>
        <div className="arrow">&rarr;</div>
        <div className="saveblock">
          <span className="label">Routed</span>
          <span className="big win">{usd(ledger.totalRouted)}</span>
          <span className="label muted">
            {usd(monthly(ledger.totalRouted, runsPerDay))}/mo
          </span>
        </div>
        <div className="saveblock pct">
          <span className="label">You keep</span>
          <span className="big">{savedPct}%</span>
          <span className="label muted">
            {usd(monthly(ledger.totalSaved, runsPerDay))} saved/mo
          </span>
        </div>
      </section>

      <section className="controls">
        <div className="row">
          <span className="ctl-label">Workload</span>
          {WORKLOADS.map((w) => (
            <button
              key={w.id}
              className={`chip ${workloadId === w.id ? "on" : ""}`}
              onClick={() => pickWorkload(w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>

        <div className="row">
          <span className="ctl-label">Baseline model</span>
          <select
            value={baselineId}
            onChange={(e) => setBaselineId(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.vendor})
              </option>
            ))}
          </select>
          <span className="ctl-label">Runs/day</span>
          <input
            type="number"
            min={1}
            max={1_000_000}
            value={runsPerDay}
            onChange={(e) =>
              setRunsPerDay(Math.max(1, Number(e.target.value) || 1))
            }
          />
        </div>

        <div className="row">
          <span className="ctl-label">Semantic routing</span>
          {embedState === "loading" && (
            <>
              <span className="status">
                downloading MiniLM (~23MB, cached after this) &mdash; {progress}%
              </span>
              <span className="hint">
                Routing on keyword features in the meantime. Watch the tiers
                shift when it lands.
              </span>
            </>
          )}
          {embedState === "ready" && (
            <span className="status ok">
              on &mdash; k-NN over {EXEMPLARS.length} labelled exemplars
            </span>
          )}
          {embedState === "failed" && (
            <>
              <span className="status bad">
                model failed to load &mdash; still routing on features alone
              </span>
              <span className="hint">
                Which is the point: the router degrades, it does not break.
              </span>
            </>
          )}
        </div>
      </section>

      <section className="grid">
        <div className="pane">
          <h2>Your workload</h2>
          <p className="pane-sub">
            One prompt per line.{" "}
            {WORKLOADS.find((w) => w.id === workloadId)?.blurb}
          </p>
          <textarea
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            rows={16}
          />
        </div>

        <div className="pane">
          <h2>
            Routing decisions <span className="count">{decisions.length}</span>
          </h2>
          <div className="tierbar">
            {TIER_ORDER.map((t) => (
              <div key={t} className={`tierseg ${t}`} title={TIER_BLURB[t]}>
                <b>{ledger.byTier[t]}</b> {TIER_LABEL[t]}
              </div>
            ))}
            <div className="tierseg esc" title="Prompts a safety guard moved up a tier">
              <b>{ledger.escalatedCount}</b> escalated
            </div>
          </div>

          <ul className="rows">
            {ledger.rows.map((r, i) => (
              <li key={i} className="rowitem">
                <div className="rowtop">
                  <span className={`badge ${r.decision.tier}`}>
                    {TIER_LABEL[r.decision.tier]}
                  </span>
                  <span className="model">{r.model.name}</span>
                  <span className="cost">
                    {usd(r.cost)}{" "}
                    {r.saved > 0 && (
                      <em className="saved">saves {usd(r.saved)}</em>
                    )}
                  </span>
                </div>
                <div className="prompt">{r.decision.prompt}</div>
                <div className="why">
                  <span className="score" title="Blended difficulty, 0-100">
                    {r.decision.score}
                  </span>
                  {r.decision.reasons.map((why, j) => (
                    <span
                      key={j}
                      className={`chip-why ${
                        why.startsWith("guard") ? "guard" : ""
                      }`}
                    >
                      {why}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer>
        <p>
          <b>How to read this.</b> Every prompt gets two independent opinions: a
          keyword/feature score, and (once embeddings are on) a k-NN vote over{" "}
          {EXEMPLARS.length} hand-labelled exemplar prompts. They are blended,
          then three safety guards can only ever move a prompt <i>up</i> a tier:
          high-stakes work never lands on the value tier, agentic loops always go
          frontier, and a low-confidence vote buys insurance instead of guessing
          cheap. Saving money by guessing is a bug, not a feature.
        </p>
        <p className="muted">
          Prices are publicly cited list prices as of {PRICES_AS_OF} and are
          rough by nature &mdash; they move weekly, tokenizers differ, and your
          negotiated rate is not the list rate. Treat the percentage, not the
          dollar figure, as the finding. Nothing leaves your browser: no API
          keys, no server, no telemetry.
        </p>
      </footer>
    </div>
  );
}
