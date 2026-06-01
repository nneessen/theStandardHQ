/*
 * HeroShaderCanvas — the hero's dim, blue-tinted radial line-burst background.
 * Ported from gallery3d.js initHeroShader() (window.THREE global) to raw
 * imperative `import * as THREE` following src/components/board/jarvis/
 * JarvisOrbCanvas.tsx: one effect owns the renderer/scene lifecycle + a
 * ResizeObserver; a second effect owns the rAF loop and pauses when offscreen
 * or the tab is hidden.
 *
 * r150 → r184: the original relied on the legacy default of NO output color
 * transform (r150 LinearEncoding). The fragment shader writes gl_FragColor
 * pre-tuned for that, so we pin outputColorSpace to LinearSRGBColorSpace to
 * reproduce the intended look instead of letting r184's default sRGB transform
 * brighten it.
 *
 * Lazy-loaded (see HeroShaderCanvasLazy) so `three` stays in its own chunk.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCanvasActive } from "./useCanvasActive";

export default function HeroShaderCanvas({
  className,
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);
  const active = useCanvasActive(canvasRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch {
      return; // WebGL unavailable — section bg still shows; no crash.
    }
    // NOTE: outputColorSpace has no effect on this fully-custom ShaderMaterial
    // (three only injects the colorspace transform into its built-in material
    // shaders, not raw fragmentShader output). Brightness is tuned directly in
    // the shader's final multiplier below + the canvas opacity in CSS.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const cam = new THREE.Camera();
    cam.position.z = 1;

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: "void main(){ gl_Position = vec4(position,1.0); }",
      fragmentShader: `precision highp float; uniform vec2 resolution; uniform float time;
        void main(){
          vec2 uv = (gl_FragCoord.xy*2.0 - resolution.xy)/min(resolution.x,resolution.y);
          float t = time*0.04; float lw = 0.0016; vec3 col = vec3(0.0);
          for(int j=0;j<3;j++){ for(int i=0;i<5;i++){
            col[j] += lw*float(i*i)/abs(fract(t-0.01*float(j)+float(i)*0.012)*5.0 - length(uv) + mod(uv.x+uv.y,0.2));
          }}
          vec3 tint = vec3(col.b*0.5, col.g*0.7, col.r*1.2);
          // EXACT reference value (0.6). Do NOT raise this: the pattern is a
          // glow-falloff burst, so brightening fattens every line's halo and
          // the whole effect reads as "way too big". Keep it tight/restrained.
          gl_FragColor = vec4(tint*0.6, 1.0);
        }`,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      uniforms.resolution.value.set(canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    renderFrameRef.current = () => {
      uniforms.time.value += 0.05;
      renderer.render(scene, cam);
    };

    return () => {
      renderFrameRef.current = null;
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

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
