/*
 * GalleryCanvas — the 3D infinite flythrough behind "Inside the platform".
 * Raw imperative `import * as THREE`, following the JarvisOrbCanvas lifecycle/
 * loop split (one effect owns renderer/scene + ResizeObserver; a second owns the
 * rAF loop, paused offscreen via useCanvasActive).
 *
 * CONTENT HONESTY: this never fabricates product dashboards. When real
 * screenshots are supplied (PRODUCT_SCREENSHOTS → `shots` prop) the planes fly
 * those actual images. When none are supplied it flies ABSTRACT brand panels
 * (gradient + wordmark + neutral blocks, no numbers/names) — representative of
 * "a screen" without claiming to be the real UI. Real images load async and
 * swap onto the planes when ready, so frames are never blank.
 *
 * r150 → r184: CanvasTextures are sRGB hex art → tagged SRGBColorSpace, renderer
 * keeps its default sRGB output. Fog matches the charcoal section bg (#0d0d0e).
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCanvasActive } from "./useCanvasActive";
import type { ProductShot } from "../data/product-screenshots";

/** Abstract, non-deceptive "screen" — brand gradient + wordmark + neutral blocks. */
function drawAbstractPanel(index: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 400;
  const x = c.getContext("2d");
  if (!x) return c;
  // charcoal base with a subtle blue/cyan diagonal wash that varies per panel
  const g = x.createLinearGradient(0, 0, 640, 400);
  const hueShift =
    index % 2 === 0 ? "rgba(91,155,255,0.10)" : "rgba(70,216,245,0.08)";
  g.addColorStop(0, "#161617");
  g.addColorStop(1, "#0e0e10");
  x.fillStyle = g;
  x.fillRect(0, 0, 640, 400);
  x.fillStyle = hueShift;
  x.fillRect(0, 0, 640, 400);
  // border + header bar (chrome only, no labels claiming data)
  x.strokeStyle = "rgba(236,226,205,0.16)";
  x.lineWidth = 2;
  x.strokeRect(1, 1, 638, 398);
  x.fillStyle = "rgba(255,255,255,0.04)";
  x.fillRect(0, 0, 640, 54);
  // three dots
  ["#5b9bff", "#46d8f5", "#b6f59e"].forEach((col, i) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(26 + i * 22, 27, 6, 0, Math.PI * 2);
    x.fill();
  });
  // neutral content blocks (skeleton, not data)
  x.fillStyle = "rgba(236,226,205,0.07)";
  for (let r = 0; r < 4; r++) {
    x.fillRect(24, 84 + r * 40, 360 - r * 30, 18);
  }
  x.fillStyle = "rgba(91,155,255,0.12)";
  x.fillRect(420, 84, 196, 132);
  // wordmark
  x.fillStyle = "rgba(241,233,214,0.85)";
  x.font = "800 26px Arial";
  x.fillText("THE STANDARD", 24, 320);
  x.fillStyle = "rgba(91,155,255,0.9)";
  x.font = "800 26px Arial";
  x.fillText("HQ", 256, 320);
  x.fillStyle = "rgba(236,226,205,0.3)";
  x.font = "600 12px monospace";
  x.fillText("YOUR OPERATING SYSTEM", 24, 348);
  return c;
}

export default function GalleryCanvas({
  className,
  shots = [],
}: {
  className?: string;
  shots?: ProductShot[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);
  const active = useCanvasActive(canvasRef);
  // Stable signature so the scene effect only rebuilds when the actual srcs change.
  const shotsKey = shots.map((s) => s.src).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d0d0e, 6, 22);
    const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    cam.position.z = 0;

    // Base textures: real screenshots if provided, otherwise abstract panels.
    const hasShots = shots.length > 0;
    const baseCount = hasShots ? shots.length : 6;
    const ownedTextures: THREE.Texture[] = [];
    const baseTextures: THREE.Texture[] = [];
    for (let i = 0; i < baseCount; i++) {
      const t = new THREE.CanvasTexture(drawAbstractPanel(i));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      ownedTextures.push(t);
      baseTextures.push(t);
    }

    const N = Math.max(10, baseCount * 2);
    const SPACING = 4;
    const DEPTH = N * SPACING;
    const geometries: THREE.PlaneGeometry[] = [];
    const materials: THREE.MeshBasicMaterial[] = [];
    const planes: THREE.Mesh[] = [];
    for (let i = 0; i < N; i++) {
      const g = new THREE.PlaneGeometry(3.4, 2.13);
      const m = new THREE.MeshBasicMaterial({
        map: baseTextures[i % baseTextures.length],
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(g, m);
      const ang = i * 2.4;
      const rad = (i % 3) * 0.9;
      mesh.position.set(
        Math.sin(ang) * rad,
        Math.cos(ang * 1.3) * rad * 0.7,
        -i * SPACING - 2,
      );
      scene.add(mesh);
      geometries.push(g);
      materials.push(m);
      planes.push(mesh);
    }

    // Swap in real screenshots as they load (keeps aspect via abstract fallback).
    let disposed = false;
    if (hasShots) {
      const loader = new THREE.TextureLoader();
      shots.forEach((shot, si) => {
        loader.load(
          shot.src,
          (tex) => {
            if (disposed) {
              tex.dispose();
              return;
            }
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            ownedTextures.push(tex);
            // assign to every plane that maps to this base index
            for (let i = si; i < N; i += baseTextures.length) {
              materials[i].map = tex;
              materials[i].needsUpdate = true;
            }
          },
          undefined,
          () => {
            /* load failed → keep abstract fallback */
          },
        );
      });
    }

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Speed is FRAME-RATE INDEPENDENT. The reference advanced a fixed amount per
    // rAF tick, so on a 120Hz ProMotion display it ran at 2× (and faster on
    // 144Hz+) — "too fast, can't see anything". We normalize every step by the
    // real elapsed time against a 60fps baseline (dt≈1 @60Hz, ≈0.5 @120Hz), and
    // cap dt so a backgrounded tab doesn't lurch on return.
    const FRAME_MS = 1000 / 60;
    let lastT = performance.now();
    // Scroll gives a gentle, CAPPED boost — an uncapped term let a fast scroll
    // spike the drift and blur the screens past. Base drift + cap lowered again
    // (0.01→0.006, 0.03→0.016) so each screen — the FIRST one especially —
    // lingers long enough to actually read.
    const BASE_DRIFT = 0.006;
    const MAX_VEL = 0.016;
    let vel = 0;
    let lastY = window.scrollY;
    const onScroll = () => {
      vel = Math.min(MAX_VEL, vel + Math.abs(window.scrollY - lastY) * 0.0004);
      lastY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    renderFrameRef.current = () => {
      const now = performance.now();
      let dt = (now - lastT) / FRAME_MS;
      lastT = now;
      if (dt > 3) dt = 3; // clamp tab-return / stall jumps
      vel *= Math.pow(0.92, dt); // frame-rate-independent decay
      const adv = (BASE_DRIFT + vel) * dt;
      planes.forEach((p) => {
        p.position.z += adv;
        if (p.position.z > 1.2) p.position.z -= DEPTH;
        const d = -p.position.z;
        let o = 1;
        if (p.position.z > -1.5)
          o = Math.max(0, 1 - (p.position.z + 1.5) / 2.7);
        else if (d > DEPTH - 5) o = Math.max(0, 1 - (d - (DEPTH - 5)) / 5);
        (p.material as THREE.MeshBasicMaterial).opacity = o;
        p.rotation.y = Math.sin(p.position.z * 0.15) * 0.06;
      });
      renderer.render(scene, cam);
    };

    return () => {
      disposed = true;
      renderFrameRef.current = null;
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      ownedTextures.forEach((t) => t.dispose());
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotsKey]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      renderFrameRef.current?.();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
