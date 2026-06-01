// Login hero reactor — an enhanced, scaled-up evolution of the dashboard's
// approved "Twin Shells" Jarvis orb. Particles are ROUND soft dots (custom
// shader, not the default square PointsMaterial) and all motion runs on the GPU
// (vertex-shader displacement / orbit) so we can push very high particle counts
// for a fine, dense "4K" look without per-frame CPU work. Rendered through an
// UnrealBloom composer (see LoginReactorCanvas). Raw three.js (NO r3f).
import * as THREE from "three";

export interface LoginReactorScene {
  group: THREE.Group;
  update: (t: number) => void;
  /** Call on resize with the drawing-buffer height so point sizes stay constant. */
  setViewportHeight: (h: number) => void;
  dispose: () => void;
}

// Shared GLSL: the same displacement field as the dashboard orb, on the GPU.
const DISP_GLSL = `
float disp(float t, float x, float y, float z){
  return 0.16*sin(t*1.4 + x*3.0 + y*2.0) + 0.1*sin(t*2.0 + z*4.0 + x*1.5);
}`;

// Round, soft, additive point — discards the square corners, soft radial falloff.
const ROUND_FRAG = `
precision highp float;
uniform vec3 uColor; uniform float uOpacity;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;                 // clip to a circle
  float a = smoothstep(0.5, 0.0, d);    // soft edge → round glow dot
  a = pow(a, 1.5);
  gl_FragColor = vec4(uColor, a * uOpacity);
}`;

const SHELL_VERT =
  DISP_GLSL +
  `
uniform float uTime; uniform float uAmpl; uniform float uSize; uniform float uScale;
void main(){
  vec3 p = position;
  float s = 1.0 + disp(uTime, p.x, p.y, p.z) * uAmpl;
  p *= s;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * (uScale / -mv.z), 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_VERT = `
attribute float aSeed;
uniform float uTime; uniform float uSize; uniform float uScale;
void main(){
  vec3 p = position;
  float a = uTime * (0.1 + aSeed * 0.25);
  float ca = cos(a), sa = sin(a);
  vec3 q = vec3(p.x*ca - p.z*sa, p.y + sin(uTime*1.3 + aSeed*6.28)*0.06, p.x*sa + p.z*ca);
  vec4 mv = modelViewMatrix * vec4(q, 1.0);
  gl_PointSize = clamp(uSize * (uScale / -mv.z), 1.0, 48.0);
  gl_Position = projectionMatrix * mv;
}`;

export function buildLoginReactor(): LoginReactorScene {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const pointMats: THREE.ShaderMaterial[] = [];
  const timed: THREE.ShaderMaterial[] = [];

  const makeShell = (
    detail: number,
    radius: number,
    sizeWorld: number,
    color: number,
    sign: number,
    ampl: number,
    opacity: number,
  ) => {
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmpl: { value: ampl },
        uSize: { value: sizeWorld },
        uScale: { value: 1000 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
      vertexShader: SHELL_VERT,
      fragmentShader: ROUND_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    pointMats.push(mat);
    timed.push(mat);
    const points = new THREE.Points(geo, mat);
    points.userData.sign = sign;
    group.add(points);
    disposables.push(geo, mat);
    return points;
  };

  // Dense counter-rotating shells, all cyan (no white blowout). Higher detail =
  // more points; tiny sizes for a fine, powdery look.
  const shellPts = [
    makeShell(14, 1.15, 0.0075, 0x2fcdf5, 1, 0.85, 0.8),
    makeShell(11, 0.8, 0.009, 0x6fd8ff, -1, 0.7, 0.78),
    makeShell(8, 0.46, 0.012, 0xa6e9ff, 1, 0.5, 0.82),
  ];

  // GPU-orbited spark field — high count, cheap because the orbit is in-shader.
  const N = 6000;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 1.3 + Math.random() * 1.8;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
    seed[i] = Math.random();
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  fGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const fMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.0075 },
      uScale: { value: 1000 },
      uColor: { value: new THREE.Color(0x46d8f5) },
      uOpacity: { value: 0.7 },
    },
    vertexShader: SPARK_VERT,
    fragmentShader: ROUND_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  pointMats.push(fMat);
  timed.push(fMat);
  const field = new THREE.Points(fGeo, fMat);
  group.add(field);
  disposables.push(fGeo, fMat);

  const update = (t: number) => {
    for (const m of timed) m.uniforms.uTime.value = t;
    for (const p of shellPts) {
      const sign = p.userData.sign as number;
      p.rotation.y = t * 0.35 * sign;
      p.rotation.x = t * 0.15 * sign;
    }
    field.rotation.y = t * 0.04;
    group.rotation.y = Math.sin(t * 0.1) * 0.25;
  };

  const setViewportHeight = (h: number) => {
    for (const m of pointMats) m.uniforms.uScale.value = h * 0.5;
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
    group.clear();
  };

  return { group, update, setViewportHeight, dispose };
}
