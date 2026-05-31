import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildTwinShells } from "./twinShells";

// Local visibility hook — pauses the rAF loop when the tab is hidden without
// tearing down the WebGL context. Kept local to avoid coupling the shared
// board layer to the assistant feature.
function useDocumentVisible() {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * Imperative three.js mount for the Twin Shells orb. Lazy-loaded (see
 * JarvisOrbView) so `three` stays out of the main bundle. Renderer/scene are
 * created once on mount; the rAF loop pauses on tab-hidden. Mirrors the
 * ArcReactor lifecycle pattern.
 */
export default function JarvisOrbCanvas({ size }: { size: number }) {
  const visible = useDocumentVisible();
  const mountRef = useRef<HTMLDivElement>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.15;
    const orb = buildTwinShells();
    scene.add(orb.group);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

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
    renderFrameRef.current = () => {
      orb.update((performance.now() - startedAt) / 1000);
      renderer.render(scene, camera);
    };

    return () => {
      renderFrameRef.current = null;
      ro.disconnect();
      orb.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const tick = () => {
      renderFrameRef.current?.();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="[&>canvas]:!h-full [&>canvas]:!w-full"
      style={{ position: "absolute", inset: 0, width: size, height: size }}
    />
  );
}
