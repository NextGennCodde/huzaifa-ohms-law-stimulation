"use client";

import { useState } from "react";
import Gauge from "./Gauge";
import WireCanvas from "./WireCanvas";
import { type Q, type State, RANGE, fmt, fmtW, move, third } from "./physics";

const START: State = { V: 6, I: 0.5, R: 12 };
const START_LOCK: Q = "R";

type Gesture = { moved: Q; lock: Q; from: State };

const NOTES: { id: string; text: string; check: (from: State, to: State, g: Gesture) => boolean }[] = [
  {
    id: "doubleV",
    text: "Lock R, then double the voltage. The current doubles too: twice the push, same obstacles.",
    check: (f, t, g) => g.lock === "R" && g.moved === "V" && f.I > 0 && t.I >= 2 * f.I - 1e-9,
  },
  {
    id: "doubleR",
    text: "Lock V, then double the resistance. The current halves: same push, twice the obstacles.",
    check: (f, t, g) => g.lock === "V" && g.moved === "R" && f.I > 0 && t.R >= 2 * f.R - 1e-9,
  },
  {
    id: "holdI",
    text: "Lock I, then double R. The battery has to push twice as hard to keep the same flow.",
    check: (f, t, g) => g.lock === "I" && g.moved === "R" && t.I > 0 && t.R >= 2 * f.R - 1e-9,
  },
  {
    id: "zero",
    text: "Bring the voltage to zero. The electrons still jiggle, but the gate count hovers near zero. No push, no current.",
    check: (_f, t) => t.V === 0,
  },
  {
    id: "big",
    text: "Get 8 A or more flowing. Watch the wire glow: every bump turns into heat.",
    check: (_f, t) => t.I >= 8,
  },
  {
    id: "crowded",
    text: "Push the resistance near 100 Ω with some voltage on. Crowded atoms, constant bumps, a trickle of current.",
    check: (_f, t) => t.R >= 90 && t.V > 0,
  },
];

const WHY: Record<string, string> = {
  "R:V": "Same obstacles, so the flow follows the push: more push, more flow.",
  "R:I": "Same obstacles, so changing the flow takes a matching change in push.",
  "V:R": "Same push, so more obstacles mean less flow, and fewer mean more.",
  "V:I": "Same push, so the only way to change the flow is to change the obstacles the other way.",
  "I:V": "Same flow, so a bigger push only balances out with more in the way.",
  "I:R": "Same flow, so more obstacles need a bigger push, and fewer need a smaller one.",
};

const FORMULA: Record<Q, string> = { V: "V = I × R", I: "I = V ÷ R", R: "R = V ÷ I" };

export default function Lab() {
  const [s, setS] = useState<State>(START);
  const [lock, setLock] = useState<Q>(START_LOCK);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [noted, setNoted] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);

  const change = (moved: Q, value: number) => {
    const next = move(s, lock, moved, value);
    const g = gesture && gesture.moved === moved && gesture.lock === lock ? gesture : { moved, lock, from: s };
    setS(next);
    setGesture(g);
    const fresh = NOTES.filter((n) => !noted.includes(n.id) && n.check(g.from, next, g)).map((n) => n.id);
    if (fresh.length) setNoted([...noted, ...fresh]);
  };

  const pickLock = (q: Q) => {
    setLock(q);
    setGesture(null);
  };

  const reset = () => {
    setS(START);
    setLock(START_LOCK);
    setGesture(null);
    setPaused(false);
  };

  const follow = gesture ? third(gesture.lock, gesture.moved) : null;
  const P = s.V * s.I;

  return (
    <div className="page">
      <header className="masthead">
        <span>Plate II · Current electricity</span>
        <span>V = I × R</span>
      </header>

      <section className="intro">
        <h1>
          Inside <em>the</em> wire
        </h1>
        <div>
          <p className="lede">
            Voltage, current and resistance are tied together: <b>V = I × R</b>. Change one and at least one of
            the others has to change too.
          </p>
          <p className="lede lede--steps">
            <span>1</span> Lock one quantity. <span>2</span> Drag another. <span>3</span> Watch the third respond,
            on the gauges and inside the wire.
          </p>
        </div>
      </section>

      <figure className="plate">
        <div className="plate__bar">
          <span className="plate__tag">Fig. 1</span>
          <span className="plate__title">A wire, magnified until you can see what V, I and R really are</span>
          <button className="pill" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="pill pill--ghost" onClick={reset}>
            Reset
          </button>
        </div>
        <WireCanvas V={s.V} I={s.I} R={s.R} paused={paused} />
        <div className="legend">
          <div>
            <span className="legend__q legend__q--v">V</span>
            <span>
              <b>Voltage is the push.</b> The battery shoves electrons from − to +. More cells, a thicker arrow.
            </span>
          </div>
          <div>
            <span className="legend__q legend__q--r">R</span>
            <span>
              <b>Resistance is the obstacles.</b> More resistance packs in more atoms, so electrons bump more
              often (the pink rings).
            </span>
          </div>
          <div>
            <span className="legend__q legend__q--i">I</span>
            <span>
              <b>Current is the flow.</b> How many electrons cross the dashed gate each second.
            </span>
          </div>
        </div>
      </figure>

      <section className="balance" aria-label="Voltage, current and resistance">
        <div className="gauges">
          {(["V", "I", "R"] as Q[]).map((q) => (
            <Gauge
              key={q}
              q={q}
              value={s[q]}
              locked={lock === q}
              responding={follow === q}
              onLock={() => pickLock(q)}
              onChange={(v) => change(q, v)}
            />
          ))}
        </div>

        <div className="readout" aria-live="polite">
          <div className="equation">
            {(["V", "=", "I", "×", "R"] as const).map((t, i) =>
              t === "=" || t === "×" ? (
                <span key={i} className="equation__op">
                  {t}
                </span>
              ) : (
                <span
                  key={i}
                  className={`equation__term equation__term--${t.toLowerCase()}`}
                  data-locked={lock === t}
                  data-responding={follow === t}
                >
                  <span className="equation__letter">{t}</span>
                  <span className="equation__value">{fmt(t, s[t])}</span>
                  <span className="equation__tag">
                    {lock === t ? "locked" : follow === t ? "responds" : gesture?.moved === t ? "you moved" : "free"}
                  </span>
                </span>
              ),
            )}
          </div>

          <Explain s={s} lock={lock} gesture={gesture} />

          <dl className="facts">
            <div>
              <dt>Check</dt>
              <dd>
                {fmt("I", s.I)} × {fmt("R", s.R)} = {fmt("V", s.I * s.R)}
              </dd>
            </div>
            <div>
              <dt>Heat in the wire</dt>
              <dd>P = V × I = {fmtW(P)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="notes" aria-label="Field notes">
        <div className="notes__head">
          <h2>Field notes</h2>
          <span className="notes__count">
            {noted.length} / {NOTES.length} observed
          </span>
        </div>
        <ol>
          {NOTES.map((n) => (
            <li key={n.id} data-done={noted.includes(n.id)}>
              <span className="tick" aria-hidden>
                {noted.includes(n.id) ? "✓" : ""}
              </span>
              <span>{n.text}</span>
              <span className="sr-only">{noted.includes(n.id) ? "(observed)" : "(not yet)"}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="colophon">
        <span>Inside the Wire · an Ohm’s law simulation</span>
        <span>
          Made by <b>Huzaifa Bilal</b>
        </span>
      </footer>
    </div>
  );
}

function Explain({ s, lock, gesture }: { s: State; lock: Q; gesture: Gesture | null }) {
  if (!gesture) {
    const free = (["V", "I", "R"] as Q[]).filter((q) => q !== lock);
    return (
      <p className="explain">
        <b>{RANGE[lock].name}</b> is locked at {fmt(lock, s[lock])}. Drag the{" "}
        <b>{RANGE[free[0]].name.toLowerCase()}</b> or the <b>{RANGE[free[1]].name.toLowerCase()}</b> gauge and see
        what the other one does.
      </p>
    );
  }
  const { moved, from } = gesture;
  const f = third(gesture.lock, moved);
  const movedUp = s[moved] > from[moved] + 1e-9;
  const movedDown = s[moved] < from[moved] - 1e-9;
  const fUp = s[f] > from[f] + 1e-9;
  const fDown = s[f] < from[f] - 1e-9;
  const verb = movedUp ? "raised" : movedDown ? "lowered" : "kept";
  const result = fUp ? "rose" : fDown ? "fell" : "stayed";
  return (
    <p className="explain">
      With <b>{RANGE[gesture.lock].name.toLowerCase()}</b> locked at {fmt(gesture.lock, s[gesture.lock])}, you {verb}{" "}
      the <b>{RANGE[moved].name.toLowerCase()}</b>
      {verb !== "kept" ? (
        <>
          {" "}
          from {fmt(moved, from[moved])} to {fmt(moved, s[moved])}
        </>
      ) : (
        <> at {fmt(moved, s[moved])}</>
      )}
      . So the <b className={`hl hl--${f.toLowerCase()}`}>{RANGE[f].name.toLowerCase()}</b> {result}
      {result !== "stayed" && <> from {fmt(f, from[f])}</>} {result === "stayed" ? "at" : "to"} {fmt(f, s[f])}{" "}
      <span className="explain__formula">({FORMULA[f]})</span>.{" "}
      {(movedUp || movedDown) && <span className="explain__why">{WHY[`${gesture.lock}:${moved}`]}</span>}
    </p>
  );
}
