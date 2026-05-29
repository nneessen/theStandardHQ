import * as THREE from "three";
import type { ReactorMode } from "./ArcReactor";

interface ModeTarget {
  /** Overall rotation speed multiplier. */
  speed: number;
  /** Emissive brightness multiplier. */
  intensity: number;
  /** Core breathing amount. */
  pulse: number;
  /** Surface turbulence displacement amplitude. */
  turbulence: number;
  /** Particle convergence: 1 = pulled tight to the core, 0 = wide orbit. */
  convergence: number;
  /** Rim/fresnel sharpness. */
  fresnel: number;
}

// Each mode reads as a distinct silhouette — see update() for how these are eased.
const TARGETS: Record<ReactorMode, ModeTarget> = {
  idle: {
    speed: 0.35,
    intensity: 0.95,
    pulse: 0.06,
    turbulence: 0.16,
    convergence: 0.1,
    fresnel: 3.4,
  },
  listening: {
    speed: 0.7,
    intensity: 1.15,
    pulse: 0.14,
    turbulence: 0.28,
    convergence: 0.25,
    fresnel: 3.0,
  },
  thinking: {
    speed: 2.6,
    intensity: 1.45,
    pulse: 0.2,
    turbulence: 0.6,
    convergence: 0.85,
    fresnel: 2.4,
  },
  responding: {
    speed: 1.2,
    intensity: 1.6,
    pulse: 0.12,
    turbulence: 0.38,
    convergence: 0.45,
    fresnel: 2.7,
  },
  speaking: {
    speed: 0.9,
    intensity: 1.3,
    pulse: 0.32,
    turbulence: 0.32,
    convergence: 0.2,
    fresnel: 3.0,
  },
};

const PARTICLE_COUNT = 360;

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

// Ashima Arts simplex noise (public domain) — used for the energy core displacement.
const SIMPLEX_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uTurbulence;
uniform float uAudio;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vNoise;
${SIMPLEX_GLSL}
void main(){
  float t = uTime * 0.5;
  // Layered turbulence — big rolling shape + fine crackle.
  float n1 = snoise(normal * 1.6 + vec3(0.0, t, 0.0));
  float n2 = snoise(normal * 3.4 - vec3(t * 1.3, 0.0, t));
  float disp = n1 * 0.7 + n2 * 0.3;
  vNoise = disp;
  float amp = uTurbulence * (1.0 + uAudio * 1.4);
  vec3 pos = position + normal * disp * amp;
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CORE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uColorHot;
uniform float uIntensity;
uniform float uPulse;
uniform float uTime;
uniform float uFresnel;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vNoise;
void main(){
  float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
  float fres = pow(1.0 - ndv, uFresnel);
  // Glowing veins of energy carved by the displacement field.
  float veins = smoothstep(0.25, 0.62, abs(vNoise));
  float breathe = 0.65 + 0.35 * sin(uTime * 3.2);
  // Bright fresnel rim + sharp energy veins; only a faint facing-surface fill so the
  // core reads as a defined sphere, not a washed-out disc.
  vec3 col = mix(uColorHot, uColor, clamp(fres * 1.2, 0.0, 1.0));
  float emit = (ndv * 0.22 + fres * 1.7 + veins * 0.85 + 0.06)
             * uIntensity * (0.72 + uPulse * breathe);
  gl_FragColor = vec4(col * emit, emit);
}
`;

// A thin additive atmosphere shell — pure rim glow that fakes bloom around the core.
const GLOW_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDir;
void main(){
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPower;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main(){
  float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
  float glow = pow(1.0 - ndv, uPower);
  gl_FragColor = vec4(uColor * glow * uIntensity, glow * uIntensity);
}
`;

export interface Reactor {
  group: THREE.Group;
  update(
    dt: number,
    t: number,
    mode: ReactorMode,
    accent: THREE.Color,
    audioLevel: number,
  ): void;
  dispose(): void;
}

/**
 * Imperative three.js arc reactor. A turbulent GLSL energy core (animated simplex
 * displacement + fresnel rim + emissive veins) sits inside additive bloom shells,
 * counter-rotating tori, a coil crown, and a converging particle field. Built with
 * raw three.js (no @react-three/fiber) so it adds no global JSX type augmentation.
 */
export function buildReactor(): Reactor {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const accentColor = new THREE.Color(0x22d3ee);
  const hotColor = new THREE.Color(0xeaffff);

  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    disposables.push(geo);
    return new THREE.Mesh(geo, mat);
  };

  // --- GLSL energy core --------------------------------------------------------
  const coreUniforms = {
    uTime: { value: 0 },
    uColor: { value: accentColor.clone() },
    uColorHot: { value: hotColor.clone() },
    uIntensity: { value: 1 },
    uPulse: { value: 0.1 },
    uFresnel: { value: 2.4 },
    uTurbulence: { value: 0.2 },
    uAudio: { value: 0 },
  };
  const coreMat = new THREE.ShaderMaterial({
    uniforms: coreUniforms,
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposables.push(coreMat);
  const coreGroup = new THREE.Group();
  const coreMesh = addMesh(new THREE.IcosahedronGeometry(0.62, 48), coreMat);
  coreGroup.add(coreMesh);

  // Two tight fresnel shells fake a compact bloom that hugs the core — NOT a big
  // diffuse halo (that washed out the crisp dial rings layered on top).
  const glowUniformsList: {
    uColor: { value: THREE.Color };
    uIntensity: { value: number };
    uPower: { value: number };
  }[] = [];
  const makeGlow = (radius: number, power: number, intensity: number) => {
    const u = {
      uColor: { value: accentColor.clone() },
      uIntensity: { value: intensity },
      uPower: { value: power },
    };
    glowUniformsList.push(u);
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(mat);
    coreGroup.add(addMesh(new THREE.IcosahedronGeometry(radius, 24), mat));
  };
  makeGlow(0.82, 3.6, 0.7);
  makeGlow(1.15, 3.0, 0.32);
  group.add(coreGroup);

  // --- Fine orbiting particle dust --------------------------------------------
  // Store each particle's wide-orbit rest position; convergence lerps it inward.
  const rest = new Float32Array(PARTICLE_COUNT * 3);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 1.45 + Math.random() * 1.25;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 0.7;
    rest[i * 3] = Math.cos(theta) * r;
    rest[i * 3 + 1] = y;
    rest[i * 3 + 2] = Math.sin(theta) * r;
    positions[i * 3] = rest[i * 3];
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = rest[i * 3 + 2];
    seeds[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  const pAttr = new THREE.BufferAttribute(positions, 3);
  pAttr.setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute("position", pAttr);
  const pMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.028,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  disposables.push(pGeo, pMat);
  group.add(points);

  const cur: ModeTarget = { ...TARGETS.idle };
  const liveColor = new THREE.Color(0x22d3ee);

  return {
    group,
    update(dt, t, mode, accent, audioLevel) {
      const target = TARGETS[mode];
      cur.speed = damp(cur.speed, target.speed, 4, dt);
      cur.intensity = damp(cur.intensity, target.intensity, 4, dt);
      cur.pulse = damp(cur.pulse, target.pulse, 4, dt);
      cur.turbulence = damp(cur.turbulence, target.turbulence, 3.5, dt);
      cur.convergence = damp(cur.convergence, target.convergence, 3, dt);
      cur.fresnel = damp(cur.fresnel, target.fresnel, 4, dt);
      liveColor.lerp(accent, 1 - Math.exp(-3 * dt));

      const spin = cur.speed;
      group.rotation.z += dt * spin * 0.18;
      coreGroup.rotation.y += dt * spin * 0.4;
      coreGroup.rotation.x += dt * spin * 0.12;

      // Core breathing — eased pulse plus a live audio kick.
      const breathe =
        1 + Math.sin(t * (2 + spin)) * cur.pulse + audioLevel * 0.5;
      coreGroup.scale.setScalar(breathe);

      // Drive the shader uniforms.
      coreUniforms.uTime.value = t;
      coreUniforms.uIntensity.value = cur.intensity;
      coreUniforms.uPulse.value = cur.pulse * 5;
      coreUniforms.uFresnel.value = cur.fresnel;
      coreUniforms.uTurbulence.value = cur.turbulence;
      coreUniforms.uAudio.value = audioLevel;
      coreUniforms.uColor.value.copy(liveColor);
      for (const u of glowUniformsList) u.uColor.value.copy(liveColor);

      // Particles: spin, swirl, and converge toward the core when "thinking".
      const arr = pAttr.array as Float32Array;
      const swirl = t * spin * 0.5;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const rx = rest[ix];
        const rz = rest[ix + 2];
        const cosS = Math.cos(swirl + seeds[i] * 6.28);
        const sinS = Math.sin(swirl + seeds[i] * 6.28);
        // Rotate the rest position around Y for an orbiting feel.
        const ox = rx * cosS - rz * sinS;
        const oz = rx * sinS + rz * cosS;
        const pull = 1 - cur.convergence * (0.55 + 0.35 * seeds[i]);
        arr[ix] = ox * pull;
        arr[ix + 2] = oz * pull;
        arr[ix + 1] = rest[ix + 1] * (1 - cur.convergence * 0.4);
      }
      pAttr.needsUpdate = true;
      pMat.color.copy(liveColor);
      pMat.opacity = 0.45 + cur.convergence * 0.4;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
