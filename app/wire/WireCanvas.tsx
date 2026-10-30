"use client";

import { useEffect, useRef } from "react";
import { VIS, atomGap, bumpRate, fmt, visualDrift } from "./physics";

type Props = { V: number; I: number; R: number; paused: boolean };

type Electron = { x: number; y: number; vx: number; vy: number };
type Flash = { x: number; y: number; age: number };

const HEIGHT = 360;
const PAD_X = 70;
const WIRE_H = 132;
const ELECTRON_DENSITY = 1 / 240;
const INK = "#1b1a17";
const PAPER = "#f2ede3";
const FIELD = "#2340d6";
const ATOM = "#6b5a4e";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function randomThermal() {
  const s = VIS.thermal * (0.5 + Math.random());
  const a = Math.random() * Math.PI * 2;
  return { vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}

export default function WireCanvas({ V, I, R, paused }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ V, I, R, paused });

  useEffect(() => {
    live.current = { V, I, R, paused };
  });

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const mono = `${css.getPropertyValue("--font-mono").trim() || "ui-monospace"}, monospace`;
    const electrons: Electron[] = [];
    const flashes: Flash[] = [];
    const crossings: number[] = [];
    let phases: number[] = [];
    let width = 900;
    let lastLen = 0;
    let clock = 0;
    let last = performance.now();
    let raf = 0;
    let dpr = 1;

    const resize = () => {
      width = wrap.current!.clientWidth;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(width * dpr);
      el.height = Math.round(HEIGHT * dpr);
      el.style.width = `${width}px`;
      el.style.height = `${HEIGHT}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = live.current;
      const w = width;
      const x0 = PAD_X;
      const len = Math.max(160, w - PAD_X * 2);
      const x1 = x0 + len;
      const cy = HEIGHT / 2 + 14;
      const y0 = cy - WIRE_H / 2;
      const { drift, slow } = visualDrift(p.I);

      // keep the electron crowd in step with the wire size
      if (lastLen && len !== lastLen) for (const e of electrons) e.x *= len / lastLen;
      lastLen = len;
      const want = Math.round(len * WIRE_H * ELECTRON_DENSITY);
      while (electrons.length < want)
        electrons.push({ x: Math.random() * len, y: Math.random() * WIRE_H, ...randomThermal() });
      electrons.length = Math.min(electrons.length, want);

      const gap = atomGap(p.R);
      const cols = Math.max(1, Math.floor(len / gap));
      const rows = Math.max(1, Math.floor(WIRE_H / gap));
      if (phases.length < cols * rows * 2)
        phases = Array.from({ length: cols * rows * 2 + 200 }, () => Math.random() * Math.PI * 2);

      // ---- move ----
      if (!p.paused) {
        const simDt = dt * slow;
        clock += simDt;
        const hit = 1 - Math.exp(-bumpRate(p.R) * simDt);
        const gate = len / 2;
        for (const e of electrons) {
          const before = e.x;
          e.x += e.vx * simDt + drift * dt;
          e.y += e.vy * simDt;
          if (e.y < 2) {
            e.y = 2;
            e.vy = Math.abs(e.vy);
          } else if (e.y > WIRE_H - 2) {
            e.y = WIRE_H - 2;
            e.vy = -Math.abs(e.vy);
          }
          if (before < gate && e.x >= gate) crossings.push(now);
          else if (before >= gate && e.x < gate) crossings.push(-now);
          if (e.x > len) e.x -= len;
          else if (e.x < 0) e.x += len;
          if (Math.random() < hit) {
            Object.assign(e, randomThermal());
            if (flashes.length < 80 && Math.random() < 0.3) flashes.push({ x: e.x, y: e.y, age: 0 });
          }
        }
        for (const f of flashes) f.age += dt;
      }
      while (flashes.length && flashes[0].age > 0.45) flashes.shift();
      while (crossings.length && Math.abs(crossings[0]) < now - 2000) crossings.shift();
      const net = crossings.reduce((s, c) => s + (c > 0 ? 1 : -1), 0) / 2;

      // ---- paint ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, HEIGHT);
      ctx.textAlign = "center";

      // graph paper
      ctx.strokeStyle = "rgba(27,26,23,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < w; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
      }
      for (let y = 0.5; y < HEIGHT; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // leads back to the battery
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 - 26, cy);
      ctx.lineTo(16, cy);
      ctx.lineTo(16, 34);
      ctx.lineTo(w - 16, 34);
      ctx.lineTo(w - 16, cy);
      ctx.lineTo(x1 + 26, cy);
      ctx.stroke();

      // battery: more cells for more voltage
      const cells = Math.max(1, Math.ceil(p.V / 3));
      const bw = cells * 16 + 12;
      const bx = w / 2 - bw / 2;
      ctx.fillStyle = PAPER;
      ctx.fillRect(bx - 4, 16, bw + 8, 36);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let c = 0; c < cells; c++) {
        const cx = bx + 8 + c * 16;
        ctx.moveTo(cx, 24);
        ctx.lineTo(cx, 44);
        ctx.moveTo(cx + 8, 16);
        ctx.lineTo(cx + 8, 52);
      }
      ctx.stroke();
      ctx.font = `600 13px ${mono}`;
      ctx.fillStyle = FIELD;
      ctx.fillText(`V = ${fmt("V", p.V)}`, w / 2, 72);
      ctx.font = `11px ${mono}`;
      ctx.fillStyle = "rgba(27,26,23,0.55)";
      ctx.fillText("−", bx - 12, 30);
      ctx.fillText("+", bx + bw + 12, 30);

      // terminals
      ctx.fillStyle = INK;
      ctx.fillRect(x0 - 26, y0 - 10, 26, WIRE_H + 20);
      ctx.fillRect(x1, y0 - 10, 26, WIRE_H + 20);
      ctx.fillStyle = PAPER;
      ctx.font = `600 16px ${mono}`;
      ctx.fillText("−", x0 - 13, cy + 5);
      ctx.fillText("+", x1 + 13, cy + 5);

      // the wire, glowing with the heat the bumps make (P = I × V)
      const heat = clamp(Math.sqrt((p.V * p.I) / 144), 0, 1);
      ctx.fillStyle = `rgb(${236 + heat * 19} ${230 - heat * 95} ${218 - heat * 160})`;
      ctx.fillRect(x0, y0, len, WIRE_H);
      if (heat > 0.05) {
        ctx.save();
        ctx.shadowColor = `rgba(255,110,40,${0.7 * heat})`;
        ctx.shadowBlur = 30 * heat;
        ctx.strokeStyle = `rgba(255,110,40,${0.5 * heat})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(x0, y0, len, WIRE_H);
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, len, WIRE_H);
      ctx.clip();

      // atoms: crowding = resistance
      const amp = 0.6 + 2.4 * heat;
      const gx = (len - (cols - 1) * gap) / 2;
      const gy = (WIRE_H - (rows - 1) * gap) / 2;
      const radius = 3.6 + 2.6 * clamp((p.R - 1) / 99, 0, 1);
      ctx.strokeStyle = ATOM;
      ctx.fillStyle = ATOM;
      ctx.lineWidth = 1.5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const ax = x0 + gx + c * gap + (r % 2 ? gap / 4 : -gap / 4);
          const ay = y0 + gy + r * gap;
          const jx = Math.sin(clock * 13 + phases[i * 2]) * amp;
          const jy = Math.cos(clock * 11 + phases[i * 2 + 1]) * amp;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(ax + jx, ay + jy, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.22;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      for (const f of flashes) {
        const k = f.age / 0.45;
        ctx.strokeStyle = `rgba(255,61,127,${0.6 * (1 - k)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x0 + f.x, y0 + f.y, 3 + k * 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      // electrons with short tails
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,61,127,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const e of electrons) {
        const vx = e.vx * slow + drift;
        const vy = e.vy * slow;
        ctx.moveTo(x0 + e.x, y0 + e.y);
        ctx.lineTo(x0 + e.x - vx * 0.06, y0 + e.y - vy * 0.06);
      }
      ctx.stroke();
      ctx.fillStyle = "#ff3d7f";
      ctx.beginPath();
      for (const e of electrons) {
        ctx.moveTo(x0 + e.x + 2.4, y0 + e.y);
        ctx.arc(x0 + e.x, y0 + e.y, 2.4, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, len, WIRE_H);

      // R label on the wire
      ctx.font = `600 13px ${mono}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.fillText(`R = ${fmt("R", p.R)}`, x0 + 4, y0 + WIRE_H + 22);

      // gate + current reading
      const gxp = x0 + len / 2;
      ctx.textAlign = "center";
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#ff3d7f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gxp, y0 - 22);
      ctx.lineTo(gxp, y0 + WIRE_H + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#d81b60";
      ctx.font = `600 13px ${mono}`;
      ctx.fillText(`I = ${fmt("I", p.I)}`, gxp, y0 - 30);
      ctx.font = `11px ${mono}`;
      ctx.fillStyle = "rgba(27,26,23,0.6)";
      ctx.fillText(`gate count ${net >= 0 ? "+" : ""}${net.toFixed(1)} /s`, gxp, y0 + WIRE_H + 22);

      // drift arrow, thicker with more push
      if (p.V > 0) {
        const ay = y0 + WIRE_H + 44;
        ctx.strokeStyle = "rgba(35,64,214,0.6)";
        ctx.lineWidth = 1 + (p.V / 12) * 4;
        ctx.beginPath();
        ctx.moveTo(x0 + 10, ay);
        ctx.lineTo(x1 - 14, ay);
        ctx.stroke();
        ctx.fillStyle = "rgba(35,64,214,0.6)";
        ctx.beginPath();
        ctx.moveTo(x1 - 4, ay);
        ctx.lineTo(x1 - 18, ay - 7 - p.V / 3);
        ctx.lineTo(x1 - 18, ay + 7 + p.V / 3);
        ctx.fill();
        ctx.font = `11px ${mono}`;
        ctx.fillStyle = FIELD;
        ctx.fillText("push from the battery → electrons drift this way", x0 + len / 2, ay + 22);
      }

      ctx.textAlign = "right";
      ctx.font = `600 11px ${mono}`;
      if (slow < 0.999) {
        const txt = `SLOW MOTION · 1/${(1 / slow).toFixed(1)} SPEED`;
        const tw = ctx.measureText(txt).width + 16;
        ctx.fillStyle = INK;
        ctx.fillRect(w - 24 - tw, 80, tw, 22);
        ctx.fillStyle = PAPER;
        ctx.fillText(txt, w - 32, 95);
      }
      if (p.paused) {
        ctx.fillStyle = FIELD;
        ctx.fillText("PAUSED", w - 28, 120);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="wire-canvas">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Magnified wire. Voltage ${fmt("V", V)}, resistance ${fmt("R", R)}, current ${fmt("I", I)}. Electrons drift from the negative to the positive terminal.`}
      />
    </div>
  );
}
