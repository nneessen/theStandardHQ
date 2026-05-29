import { useRef } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import { useDocumentVisible } from "../../lib/useDocumentVisible";
import type { ReactorMode } from "./ArcReactor";

/** Base angular velocity (deg/sec at mult 1) eased toward per-mode targets. */
const SPEED: Record<ReactorMode, number> = {
  idle: 6,
  listening: 10,
  thinking: 30,
  responding: 17,
  speaking: 9,
};

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

const C = 300; // viewBox center

function pt(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

/** Stroked arc path from `a0`→`a1` degrees at radius `r`. */
function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Ticks({
  r,
  count,
  len,
  longEvery = 0,
  longLen = 0,
  width = 0.6,
  color,
  opacity = 0.5,
}: {
  r: number;
  count: number;
  len: number;
  longEvery?: number;
  longLen?: number;
  width?: number;
  color: string;
  opacity?: number;
}) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const deg = (i / count) * 360;
    const long = longEvery > 0 && i % longEvery === 0;
    const l = long ? longLen : len;
    const [x1, y1] = pt(r, deg);
    const [x2, y2] = pt(r - l, deg);
    lines.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={long ? width * 1.8 : width}
        opacity={long ? Math.min(1, opacity * 1.8) : opacity}
      />,
    );
  }
  return <>{lines}</>;
}

interface Props {
  mode: ReactorMode;
  accent: string;
  className?: string;
}

/**
 * The crisp HUD reactor dial: many thin concentric rings — tick scales, dashed and
 * broken segmented arcs, a radar sweep, and bright "active" arcs — rotating
 * independently around the energy core. Pure SVG so it stays pixel-sharp at any DPR
 * and never reads as chunky. A single framer-motion clock drives all layers with an
 * eased per-mode speed (no CSS-duration jumps); honors prefers-reduced-motion.
 */
export function ReactorDial({ mode, accent, className }: Props) {
  const reduced = useReducedMotion();
  const visible = useDocumentVisible();
  const layerRefs = useRef<(SVGGElement | null)[]>([]);
  const activeRef = useRef<SVGGElement | null>(null);
  const sweepRef = useRef<SVGGElement | null>(null);
  const speed = useRef(SPEED.idle);
  const angle = useRef(0);
  const elapsed = useRef(0);

  // mult = relative speed (sign = direction); base = static offset.
  const layers = useRef<{ mult: number; base: number }[]>([
    { mult: 0.35, base: 0 }, // outer fine ticks
    { mult: -0.6, base: 0 }, // dotted ring
    { mult: 0.5, base: 12 }, // broken outer arcs
    { mult: -0.3, base: 0 }, // scale ring
    { mult: 0.45, base: 7 }, // numbered markers
    { mult: -0.85, base: 0 }, // medium dashes
    { mult: 1.0, base: 0 }, // inner segments
    { mult: -0.7, base: 0 }, // inner ticks
    { mult: 0.8, base: 0 }, // core ring
  ]).current;

  useAnimationFrame((_t, delta) => {
    if (reduced || !visible) return;
    const dt = Math.min(delta / 1000, 0.05);
    elapsed.current += dt;
    speed.current = damp(speed.current, SPEED[mode], 2.5, dt);
    angle.current += dt * speed.current;
    for (let i = 0; i < layers.length; i++) {
      const el = layerRefs.current[i];
      if (el) {
        const a = angle.current * layers[i].mult + layers[i].base;
        el.setAttribute("transform", `rotate(${a.toFixed(2)} ${C} ${C})`);
      }
    }
    if (sweepRef.current) {
      const a = angle.current * 2.4;
      sweepRef.current.setAttribute(
        "transform",
        `rotate(${a.toFixed(2)} ${C} ${C})`,
      );
    }
    if (activeRef.current) {
      const a = angle.current * -1.5;
      const pulse = 0.55 + 0.45 * Math.sin(elapsed.current * 4);
      activeRef.current.setAttribute(
        "transform",
        `rotate(${a.toFixed(2)} ${C} ${C})`,
      );
      activeRef.current.setAttribute("opacity", pulse.toFixed(3));
    }
  });

  const reg = (i: number) => (el: SVGGElement | null) => {
    layerRefs.current[i] = el;
  };

  return (
    <svg
      viewBox="0 0 600 600"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <filter id="reactor-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="reactor-haze" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="45%" stopColor={accent} stopOpacity="0.06" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* faint volumetric haze behind the rings */}
      <circle cx={C} cy={C} r={250} fill="url(#reactor-haze)" />

      {/* L0 — outer fine tick scale */}
      <g ref={reg(0)}>
        <circle
          cx={C}
          cy={C}
          r={286}
          fill="none"
          stroke={accent}
          strokeWidth={0.4}
          opacity={0.35}
        />
        <Ticks
          r={284}
          count={180}
          len={5}
          longEvery={15}
          longLen={11}
          width={0.55}
          color={accent}
          opacity={0.4}
        />
      </g>

      {/* L1 — dotted ring */}
      <g ref={reg(1)}>
        <circle
          cx={C}
          cy={C}
          r={270}
          fill="none"
          stroke={accent}
          strokeWidth={1.1}
          strokeDasharray="1 7"
          opacity={0.5}
        />
      </g>

      {/* L2 — broken outer arcs */}
      <g
        ref={reg(2)}
        fill="none"
        stroke={accent}
        strokeWidth={1.4}
        opacity={0.7}
      >
        <path d={arc(256, 4, 66)} />
        <path d={arc(256, 96, 150)} />
        <path d={arc(256, 188, 262)} />
        <path d={arc(256, 290, 350)} />
      </g>

      {/* L3 — mid scale ring */}
      <g ref={reg(3)}>
        <circle
          cx={C}
          cy={C}
          r={238}
          fill="none"
          stroke={accent}
          strokeWidth={0.4}
          opacity={0.3}
        />
        <Ticks
          r={238}
          count={90}
          len={4}
          width={0.5}
          color={accent}
          opacity={0.32}
        />
      </g>

      {/* L4 — numbered markers (short ticks + tiny segment blocks) */}
      <g ref={reg(4)}>
        <Ticks
          r={216}
          count={24}
          len={7}
          width={0.9}
          color={accent}
          opacity={0.6}
        />
        {Array.from({ length: 8 }).map((_, i) => {
          const [x, y] = pt(224, (i / 8) * 360);
          return (
            <rect
              key={i}
              x={x - 3}
              y={y - 1.2}
              width={6}
              height={2.4}
              fill={accent}
              opacity={0.55}
              transform={`rotate(${(i / 8) * 360} ${x} ${y})`}
            />
          );
        })}
      </g>

      {/* L5 — medium dashed ring */}
      <g ref={reg(5)}>
        <circle
          cx={C}
          cy={C}
          r={192}
          fill="none"
          stroke={accent}
          strokeWidth={1.1}
          strokeDasharray="11 7"
          opacity={0.55}
        />
      </g>

      {/* L6 — inner segmented ring */}
      <g ref={reg(6)}>
        <circle
          cx={C}
          cy={C}
          r={150}
          fill="none"
          stroke={accent}
          strokeWidth={1.3}
          strokeDasharray="20 11"
          opacity={0.65}
        />
        <circle
          cx={C}
          cy={C}
          r={140}
          fill="none"
          stroke={accent}
          strokeWidth={0.4}
          opacity={0.25}
        />
      </g>

      {/* L7 — inner tick ring */}
      <g ref={reg(7)}>
        <Ticks
          r={122}
          count={72}
          len={4}
          longEvery={6}
          longLen={8}
          width={0.5}
          color={accent}
          opacity={0.4}
        />
      </g>

      {/* L8 — core ring with quadrant diamonds */}
      <g ref={reg(8)}>
        <circle
          cx={C}
          cy={C}
          r={96}
          fill="none"
          stroke={accent}
          strokeWidth={0.9}
          opacity={0.6}
        />
        <Ticks
          r={96}
          count={48}
          len={3}
          width={0.5}
          color={accent}
          opacity={0.35}
        />
        {[0, 90, 180, 270].map((d) => {
          const [x, y] = pt(96, d);
          return (
            <rect
              key={d}
              x={x - 3}
              y={y - 3}
              width={6}
              height={6}
              fill={accent}
              opacity={0.85}
              transform={`rotate(45 ${x} ${y})`}
            />
          );
        })}
      </g>

      {/* radar sweep — a fan of fading radial lines with a bright leading edge */}
      <g ref={sweepRef}>
        {Array.from({ length: 18 }).map((_, i) => {
          const [x, y] = pt(232, -i * 2.6);
          return (
            <line
              key={i}
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              stroke={accent}
              strokeWidth={i === 0 ? 1.6 : 1}
              opacity={i === 0 ? 0.5 : 0.16 * (1 - i / 18)}
            />
          );
        })}
      </g>

      {/* bright active arcs (glow + pulse) */}
      <g ref={activeRef} filter="url(#reactor-glow)" fill="none">
        <path
          d={arc(216, 20, 38)}
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <path
          d={arc(150, 200, 226)}
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <path
          d={arc(256, 150, 158)}
          stroke="#eaffff"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>

      {/* static crosshair guides */}
      <g stroke={accent} strokeWidth={0.4} opacity={0.18}>
        <line x1={C} y1={20} x2={C} y2={120} />
        <line x1={C} y1={480} x2={C} y2={580} />
        <line x1={20} y1={C} x2={120} y2={C} />
        <line x1={480} y1={C} x2={580} y2={C} />
      </g>
    </svg>
  );
}
