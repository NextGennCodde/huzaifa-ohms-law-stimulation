"use client";

import { useRef } from "react";
import { type Q, RANGE, fmt } from "./physics";

type Props = {
  q: Q;
  value: number;
  locked: boolean;
  responding: boolean;
  onLock: () => void;
  onChange: (v: number) => void;
};

// Current and resistance span a wide range, so their columns use a square-root
// scale: small values still get a visible bar.
const toPos = (q: Q, v: number) => {
  const { min, max } = RANGE[q];
  const t = (v - min) / (max - min);
  return q === "V" ? t : Math.sqrt(Math.max(0, t));
};
const fromPos = (q: Q, pos: number) => {
  const { min, max } = RANGE[q];
  const t = q === "V" ? pos : pos * pos;
  return min + t * (max - min);
};
const snap = (q: Q, v: number) => {
  const { min, max, step } = RANGE[q];
  return Math.min(max, Math.max(min, Number((Math.round(v / step) * step).toFixed(3))));
};

const TICKS: Record<Q, number[]> = {
  V: [0, 3, 6, 9, 12],
  I: [0, 0.5, 2, 5, 12],
  R: [1, 5, 20, 50, 100],
};

const TIPS: Record<Q, string> = {
  V: "the push",
  I: "the flow",
  R: "the obstacles",
};

export default function Gauge({ q, value, locked, responding, onLock, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pos = toPos(q, value);
  const r = RANGE[q];

  const fromPointer = (clientY: number) => {
    const box = track.current!.getBoundingClientRect();
    const p = 1 - (clientY - box.top) / box.height;
    onChange(snap(q, fromPos(q, Math.min(1, Math.max(0, p)))));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (locked) return;
    const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
    const step = q === "I" ? (value < 1 ? 0.01 : 0.1) : r.step;
    const d = (big ? 10 : 1) * step;
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "PageUp") next = value + d;
    if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "PageDown") next = value - d;
    if (e.key === "Home") next = r.min;
    if (e.key === "End") next = r.max;
    if (next === null) return;
    e.preventDefault();
    onChange(snap(q, next));
  };

  return (
    <div
      className={`gauge gauge--${q.toLowerCase()}`}
      data-locked={locked}
      data-responding={responding}
    >
      <div className="gauge__head">
        <span className="gauge__letter">{q}</span>
        <span className="gauge__name">
          {r.name}
          <small>{TIPS[q]}</small>
        </span>
      </div>
      <output className="gauge__value">{fmt(q, value)}</output>

      <div
        ref={track}
        className="gauge__track"
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={`${r.name}${locked ? " (locked)" : ""}`}
        aria-valuemin={r.min}
        aria-valuemax={r.max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={fmt(q, value)}
        aria-disabled={locked}
        aria-orientation="vertical"
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (locked) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          // A missed pointerup would leave the gauge following the mouse; stop when no button is down.
          if (e.buttons === 0) {
            dragging.current = false;
            return;
          }
          fromPointer(e.clientY);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onLostPointerCapture={() => (dragging.current = false)}
      >
        {TICKS[q].map((t) => (
          <span key={t} className="gauge__tick" style={{ bottom: `${toPos(q, t) * 100}%` }}>
            {t}
          </span>
        ))}
        <div className="gauge__fill" style={{ height: `${pos * 100}%` }} />
        <div className="gauge__handle" style={{ bottom: `${pos * 100}%` }} />
        {locked && (
          <div className="gauge__locked-label" aria-hidden>
            held
          </div>
        )}
      </div>

      <button className="gauge__lock" onClick={onLock} aria-pressed={locked} disabled={locked}>
        <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
          <rect x="1" y="6" width="10" height="7.5" rx="1" fill="currentColor" />
          <path
            d={locked ? "M3 6V4a3 3 0 0 1 6 0v2" : "M3 6V4a3 3 0 0 1 6 0"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            transform={locked ? undefined : "translate(3 -1.5) rotate(18 9 4)"}
          />
        </svg>
        {locked ? "Locked" : `Lock ${q}`}
      </button>
    </div>
  );
}
