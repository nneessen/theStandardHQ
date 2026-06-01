import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildLoginReactor } from "./loginReactorScene";

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
 * Full-bleed login reactor — the enhanced Twin Shells orb rendered through an
 * UnrealBloom composer for true cinematic glow. Imperative three.js (lazy, so
 * the WebGL bundle stays out of the public login's initial payload). Renderer +
 * composer created once; rAF loop pauses when the tab is hidden.
 */
export default function LoginReactorCanvas() {
  const visible = useDocumentVisible();
  const mountRef = useRef<HTMLDivElement>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05070a, 1); // opaque deep-charcoal so bloom composites cleanly
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.4;

    const orb = buildLoginReactor();
    scene.add(orb.group);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.5, // strength — gentle, so it glows without blowing out to white
      0.8, // radius — wide, soft halo
      0.22, // threshold — only the brightest cores flare; particle structure survives
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // keep point sizes constant in screen space (drawing-buffer height)
      orb.setViewportHeight(
        renderer.getDrawingBufferSize(new THREE.Vector2()).y,
      );
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const startedAt = performance.now();
    renderFrameRef.current = () => {
      const t = (performance.now() - startedAt) / 1000;
      orb.update(t);
      // subtle camera parallax drift
      camera.position.x = Math.sin(t * 0.12) * 0.25;
      camera.position.y = Math.cos(t * 0.1) * 0.18;
      camera.lookAt(0, 0, 0);
      composer.render();
    };

    return () => {
      renderFrameRef.current = null;
      ro.disconnect();
      orb.dispose();
      composer.dispose();
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
      className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full"
    />
  );
}
