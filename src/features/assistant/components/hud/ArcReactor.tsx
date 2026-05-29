import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDocumentVisible } from "../../lib/useDocumentVisible";
import { buildReactor } from "./reactorScene";

export type ReactorMode =
  | "idle"
  | "listening"
  | "thinking"
  | "responding"
  | "speaking";

interface Props {
  mode: ReactorMode;
  accent: string;
  /** 0–1 mic amplitude; drives core pulse during voice. */
  audioLevel?: number;
  className?: string;
}

/**
 * The arc reactor centerpiece. Renders an imperative three.js scene that pauses when
 * the tab is hidden and degrades to a static CSS glow under prefers-reduced-motion.
 */
export function ArcReactor({ mode, accent, audioLevel = 0, className }: Props) {
  const prefersReduced = useReducedMotion();
  const visible = useDocumentVisible();
  const mountRef = useRef<HTMLDivElement>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);

  // Latest props read by the animation loop without restarting it.
  const live = useRef({ mode, accent: new THREE.Color(accent), audioLevel });
  live.current.mode = mode;
  live.current.accent.set(accent);
  live.current.audioLevel = audioLevel;

  // Renderer/scene lifecycle — created once while motion is allowed, torn down on
  // unmount. Tab visibility does NOT recreate the WebGL context (see loop effect).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || prefersReduced) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 5;
    const reactor = buildReactor();
    scene.add(reactor.group);
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const startedAt = performance.now();
    let last = startedAt;
    renderFrameRef.current = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      reactor.update(
        dt,
        (now - startedAt) / 1000,
        live.current.mode,
        live.current.accent,
        live.current.audioLevel,
      );
      renderer.render(scene, camera);
    };

    return () => {
      renderFrameRef.current = null;
      ro.disconnect();
      reactor.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [prefersReduced]);

  // Run/pause the rAF loop on visibility — without disposing the WebGL context.
  useEffect(() => {
    if (prefersReduced || !visible) return;
    let raf = 0;
    const tick = () => {
      renderFrameRef.current?.();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prefersReduced, visible]);

  if (prefersReduced) {
    return <StaticReactor accent={accent} className={className} />;
  }

  return (
    <div
      ref={mountRef}
      className={cn(
        "pointer-events-none [&>canvas]:!h-full [&>canvas]:!w-full",
        className,
      )}
      aria-hidden
    />
  );
}

/** Motion-free fallback: a layered radial glow in the active accent. */
function StaticReactor({
  accent,
  className,
}: {
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none grid place-items-center", className)}
      aria-hidden
    >
      <div
        className="h-1/2 w-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${accent} 0%, ${accent}55 30%, transparent 70%)`,
          boxShadow: `0 0 80px 20px ${accent}40`,
        }}
      />
    </div>
  );
}
