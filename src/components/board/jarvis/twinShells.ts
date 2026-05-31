// Twin Shells — the chosen Jarvis energy orb (per the Orb Lab).
// Ported from the design handoff `jarvisOrbs.js` `twin()` variant to an ES module
// using a real `three` import (no window.THREE). Returns a disposable scene
// factory mirroring features/assistant/components/hud/reactorScene.ts so the
// view component can own the renderer + rAF loop (two-effect mount pattern).
import * as THREE from "three";

export interface TwinShellsScene {
  group: THREE.Group;
  /** Advance the simulation. `t` is elapsed seconds. */
  update: (t: number) => void;
  dispose: () => void;
}

// Vertex displacement noise — verbatim from the handoff `disp()`.
function disp(t: number, x: number, y: number, z: number): number {
  return (
    0.16 * Math.sin(t * 1.4 + x * 3 + y * 2) +
    0.1 * Math.sin(t * 2.0 + z * 4 + x * 1.5)
  );
}

interface Shell {
  geo: THREE.IcosahedronGeometry;
  base: Float32Array;
  points: THREE.Points;
  sign: number;
}

/**
 * Build the Twin Shells orb: two counter-rotating, displaced icosahedron point
 * clouds (cyan outer, white-cyan inner), additive blending, no solid geometry.
 */
export function buildTwinShells(): TwinShellsScene {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];

  const makeShell = (
    detail: number,
    radius: number,
    size: number,
    color: number,
    sign: number,
  ): Shell => {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const base = geo.attributes.position.array.slice() as Float32Array;
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(material);
    const points = new THREE.Points(geo, material);
    group.add(points);
    return { geo, base, points, sign };
  };

  const shells: Shell[] = [
    makeShell(6, 1.05, 0.03, 0x35d6f5, 1),
    makeShell(5, 0.7, 0.04, 0xc8f6ff, -1),
  ];

  const update = (t: number) => {
    for (const shell of shells) {
      const pos = shell.geo.attributes.position;
      const arr = pos.array as Float32Array;
      const base = shell.base;
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const x = base[ix];
        const y = base[ix + 1];
        const z = base[ix + 2];
        const s = 1 + disp(t, x, y, z) * 0.8;
        arr[ix] = x * s;
        arr[ix + 1] = y * s;
        arr[ix + 2] = z * s;
      }
      pos.needsUpdate = true;
      shell.points.rotation.y = t * 0.35 * shell.sign;
      shell.points.rotation.x = t * 0.15 * shell.sign;
    }
  };

  const dispose = () => {
    for (const shell of shells) shell.geo.dispose();
    for (const material of materials) material.dispose();
    group.clear();
  };

  return { group, update, dispose };
}
