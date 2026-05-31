// JarvisOrb — WebGL energy-orb variations. Pure points / lines / shader shells.
// NO solid background geometry. Each init(el) returns { stop }. Needs window.THREE.
(function () {
  const TAU = Math.PI * 2;
  function three(el) {
    if (!window.THREE) return null;
    const THREE = window.THREE, w = el.clientWidth || 1, h = el.clientHeight || 1;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 100); cam.position.z = 3.15;
    let raf = 0, stopped = false;
    return {
      THREE, scene, cam, renderer,
      run(update) { const f = (ts) => { if (stopped) return; update(ts / 1000); renderer.render(scene, cam); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); },
      stop() { stopped = true; cancelAnimationFrame(raf); renderer.dispose(); el.contains(renderer.domElement) && el.removeChild(renderer.domElement); },
    };
  }
  const disp = (t, x, y, z) => 0.16 * Math.sin(t * 1.4 + x * 3 + y * 2) + 0.1 * Math.sin(t * 2.0 + z * 4 + x * 1.5);

  // A · PLASMA — displaced point sphere, hot core → cyan rim, no solid fill
  function plasma(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const geo = new THREE.IcosahedronGeometry(1, 7);
    const base = geo.attributes.position.array.slice();
    const col = new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3);
    geo.setAttribute('color', col);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.032, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    const pos = geo.attributes.position;
    c.run((t) => {
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, x = base[ix], y = base[ix + 1], z = base[ix + 2], n = disp(t, x, y, z), s = 1 + n;
        pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s;
        const hot = Math.min(1, Math.max(0, (n + 0.18) / 0.36));
        col.array[ix] = 0.25 + 0.75 * hot; col.array[ix + 1] = 0.82 + 0.18 * hot; col.array[ix + 2] = 1;
      }
      pos.needsUpdate = true; col.needsUpdate = true; pts.rotation.y = t * 0.3; pts.rotation.x = t * 0.1;
    });
    return c;
  }

  // B · FILAMENT WEB — displaced wireframe lattice + node points
  function web(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const base = geo.attributes.position.array.slice();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x36cdf2, wireframe: true, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
    const nodes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb6f3ff, size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(mesh); scene.add(nodes);
    const pos = geo.attributes.position;
    c.run((t) => {
      for (let i = 0; i < pos.count; i++) { const ix = i * 3, x = base[ix], y = base[ix + 1], z = base[ix + 2], s = 1 + disp(t, x, y, z) * 0.9; pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s; }
      pos.needsUpdate = true; mesh.rotation.y = nodes.rotation.y = t * 0.28; mesh.rotation.x = nodes.rotation.x = -t * 0.12;
    });
    return c;
  }

  // C · TWIN SHELLS — two counter-rotating point shells
  function twin(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const make = (det, r, size, color, sign) => {
      const g = new THREE.IcosahedronGeometry(r, det); const b = g.attributes.position.array.slice();
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(p); return { g, b, p, sign };
    };
    const A = make(6, 1.05, 0.03, 0x35d6f5, 1), B = make(5, 0.7, 0.04, 0xc8f6ff, -1);
    c.run((t) => {
      [A, B].forEach(o => { const pos = o.g.attributes.position; for (let i = 0; i < pos.count; i++) { const ix = i * 3, x = o.b[ix], y = o.b[ix + 1], z = o.b[ix + 2], s = 1 + disp(t, x, y, z) * 0.8; pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s; } pos.needsUpdate = true; o.p.rotation.y = t * 0.35 * o.sign; o.p.rotation.x = t * 0.15 * o.sign; });
    });
    return c;
  }

  // D · FRESNEL BUBBLE — edge-lit energy shell (shader) + inner points
  function bubble(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const mat = new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(0x46d8f5) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; uniform float uT; void main(){ vec3 p=position*(1.0+0.05*sin(uT*1.6+position.y*4.0)); vec4 mv=modelViewMatrix*vec4(p,1.0); vV=normalize(-mv.xyz); vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uT; void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.6); float band=0.6+0.4*sin(uT*2.0); gl_FragColor=vec4(uColor*(f*1.6),f*band); }',
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 5), mat); scene.add(shell);
    const ig = new THREE.IcosahedronGeometry(0.62, 5); const ib = ig.attributes.position.array.slice();
    const inner = new THREE.Points(ig, new THREE.PointsMaterial({ color: 0xd6f7ff, size: 0.028, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(inner);
    const pos = ig.attributes.position;
    c.run((t) => {
      mat.uniforms.uT.value = t; shell.rotation.y = t * 0.18; shell.rotation.x = t * 0.07;
      for (let i = 0; i < pos.count; i++) { const ix = i * 3, x = ib[ix], y = ib[ix + 1], z = ib[ix + 2], s = 1 + disp(t, x, y, z); pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s; }
      pos.needsUpdate = true; inner.rotation.y = -t * 0.4;
    });
    return c;
  }

  // E · STORM — contained particle storm (3D shell with jitter), breathing
  function storm(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const N = 1100, arr = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * TAU, rr = 0.5 + Math.random() * 0.6, sp = Math.sqrt(1 - u * u);
      arr[i * 3] = Math.cos(th) * sp * rr; arr[i * 3 + 1] = u * rr; arr[i * 3 + 2] = Math.sin(th) * sp * rr;
      const hot = Math.random(); col[i * 3] = 0.3 + 0.6 * hot; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const base = arr.slice();
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.026, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    const pos = g.attributes.position;
    c.run((t) => {
      for (let i = 0; i < N; i++) { const ix = i * 3, x = base[ix], y = base[ix + 1], z = base[ix + 2], s = 1 + 0.12 * Math.sin(t * 2 + x * 5 + y * 5); pos.array[ix] = x * s; pos.array[ix + 1] = y * s; pos.array[ix + 2] = z * s; }
      pos.needsUpdate = true; pts.rotation.y = t * 0.5; pts.rotation.z = t * 0.12; pts.scale.setScalar(1 + 0.05 * Math.sin(t * 1.6));
    });
    return c;
  }

  // F · GYRO — gyroscopic energy rings + core cluster
  function gyro(el) {
    const c = three(el); if (!c) return; const { THREE, scene } = c;
    const circle = (r, color, op) => { const p = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU; p.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); } return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); };
    const rings = [circle(1.15, 0x35d6f5, 0.7), circle(1.0, 0x8fe9ff, 0.55), circle(0.82, 0x5ce0ff, 0.6)];
    rings[0].rotation.x = 1.2; rings[1].rotation.y = 1.1; rings[2].rotation.x = 0.6; rings[2].rotation.z = 0.8;
    rings.forEach(r => scene.add(r));
    const N = 350, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, th = Math.random() * TAU, rr = Math.random() * 0.4, sp = Math.sqrt(1 - u * u); arr[i * 3] = Math.cos(th) * sp * rr; arr[i * 3 + 1] = u * rr; arr[i * 3 + 2] = Math.sin(th) * sp * rr; }
    const core = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3)), new THREE.PointsMaterial({ color: 0xd6f7ff, size: 0.04, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(core);
    c.run((t) => {
      rings[0].rotation.z = t * 0.6; rings[1].rotation.z = -t * 0.5; rings[2].rotation.y = t * 0.7;
      core.rotation.y = t * 0.8; core.scale.setScalar(1 + 0.12 * Math.sin(t * 2.2));
    });
    return c;
  }

  window.JarvisOrb = { plasma, web, twin, bubble, storm, gyro };
})();
