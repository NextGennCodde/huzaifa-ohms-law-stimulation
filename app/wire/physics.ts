// V = I × R, with three quantities you can hold or move.
// Lock one, drag another, and the third has to give.

export type Q = "V" | "I" | "R";

export type State = { V: number; I: number; R: number };

export const RANGE: Record<Q, { min: number; max: number; step: number; unit: string; name: string }> = {
  V: { min: 0, max: 12, step: 0.1, unit: "V", name: "Voltage" },
  I: { min: 0, max: 12, step: 0.01, unit: "A", name: "Current" },
  R: { min: 1, max: 100, step: 0.5, unit: "Ω", name: "Resistance" },
};

const clamp = (v: number, q: Q) => Math.min(RANGE[q].max, Math.max(RANGE[q].min, v));

/** The quantity that is neither locked nor being moved. */
export const third = (a: Q, b: Q): Q => (["V", "I", "R"] as Q[]).find((q) => q !== a && q !== b)!;

/** Work out `unknown` from the other two. Returns null when it can't be known (0 ÷ 0). */
function derive(s: State, unknown: Q): number | null {
  if (unknown === "V") return s.I * s.R;
  if (unknown === "I") return s.V / s.R;
  if (s.I === 0) return s.V === 0 ? null : Infinity;
  return s.V / s.I;
}

/**
 * Move `moved` to `value` while `locked` stays put. The remaining quantity follows
 * from V = I × R. If it would leave its range, it stops at the edge and the moved
 * value is pulled back to match, so the equation always holds.
 */
export function move(s: State, locked: Q, moved: Q, value: number): State {
  const follow = third(locked, moved);
  const next = { ...s, [moved]: clamp(value, moved) };
  const d = derive(next, follow);
  if (d === null) return next;
  const fitted = clamp(d, follow);
  next[follow] = fitted;
  if (fitted !== d) {
    // The follower hit a wall; recompute the moved one from the other two.
    const back = derive(next, moved);
    if (back !== null && Number.isFinite(back)) next[moved] = clamp(back, moved);
  }
  return next;
}

/* ---------- formatting ---------- */

const trim = (n: number, digits: number) => {
  const s = n.toFixed(digits);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
};

export function fmt(q: Q, v: number) {
  if (q === "V") return `${v.toFixed(1)} V`;
  if (q === "R") return `${trim(v, v >= 10 ? 1 : 2)} Ω`;
  if (v === 0) return "0 A";
  if (v < 1) return `${trim(v * 1000, 0)} mA`;
  return `${v.toFixed(2)} A`;
}

export function fmtW(P: number) {
  if (P === 0) return "0 W";
  if (P < 1) return `${trim(P * 1000, 0)} mW`;
  return `${trim(P, P >= 10 ? 1 : 2)} W`;
}

/* ---------- what the picture does ---------- */

/**
 * On screen: voltage is the push (field arrow + battery), resistance is how
 * crowded and twitchy the atom lattice is, and current is how fast the electron
 * crowd drifts past the gate. Drift is strictly proportional to I, so the gate
 * count obeys Ohm's law. Big currents play in slow motion, and the canvas says so.
 */
export const VIS = {
  driftPerAmp: 45,
  maxDrift: 200,
  thermal: 34,
};

export function visualDrift(I: number) {
  const raw = VIS.driftPerAmp * I;
  const slow = raw > VIS.maxDrift ? VIS.maxDrift / raw : 1;
  return { drift: raw * slow, slow };
}

/** Atom spacing in px: more resistance, more crowded. */
export const atomGap = (R: number) => 42 - 24 * Math.sqrt((R - RANGE.R.min) / (RANGE.R.max - RANGE.R.min));

/** Bumps per second per electron. */
export const bumpRate = (R: number) => 0.8 + 0.22 * R;
