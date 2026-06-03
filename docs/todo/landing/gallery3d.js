// 3D infinite flythrough gallery + hero shader background. Needs window.THREE.
(function () {
  // ── Hero shader bg: dim radial line-burst, brand-tinted ──
  window.initHeroShader = function (canvas) {
    if (!window.THREE) return;
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new THREE.Scene(), cam = new THREE.Camera(); cam.position.z = 1;
    const uniforms = { time: { value: 0 }, resolution: { value: new THREE.Vector2() } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true,
      vertexShader: 'void main(){ gl_Position = vec4(position,1.0); }',
      fragmentShader: `precision highp float; uniform vec2 resolution; uniform float time;
        void main(){
          vec2 uv = (gl_FragCoord.xy*2.0 - resolution.xy)/min(resolution.x,resolution.y);
          float t = time*0.04; float lw = 0.0016; vec3 col = vec3(0.0);
          for(int j=0;j<3;j++){ for(int i=0;i<5;i++){
            col[j] += lw*float(i*i)/abs(fract(t-0.01*float(j)+float(i)*0.012)*5.0 - length(uv) + mod(uv.x+uv.y,0.2));
          }}
          // tint toward electric blue, keep dim
          vec3 tint = vec3(col.b*0.5, col.g*0.7, col.r*1.2);
          gl_FragColor = vec4(tint*0.6, 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); uniforms.resolution.value.set(canvas.width, canvas.height);
    };
    addEventListener('resize', resize); resize();
    (function loop() { uniforms.time.value += 0.05; renderer.render(scene, cam); requestAnimationFrame(loop); })();
  };

  // ── draw a fake dashboard "screen" onto a canvas → texture ──
  function screenTexture(kind) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400;
    const x = c.getContext('2d');
    x.fillStyle = '#0e0b06'; x.fillRect(0, 0, 640, 400);
    // border
    x.strokeStyle = 'rgba(236,226,205,0.16)'; x.lineWidth = 2; x.strokeRect(1, 1, 638, 398);
    // header bar
    x.fillStyle = '#15110a'; x.fillRect(0, 0, 640, 54);
    x.fillStyle = 'rgba(236,226,205,0.5)'; x.font = '600 16px monospace'; x.fillText(kind.title, 22, 33);
    const blue = '#5b9bff', mint = '#b6f59e', cream = '#f1e9d6', mut = 'rgba(236,226,205,0.4)';
    if (kind.type === 'kpi') {
      const cells = [['PACE', '73%', blue], ['COMMISSION', '$8,420', cream], ['APPS MTD', '14', mint]];
      cells.forEach((cl, i) => {
        const cx = 22 + i * 200; x.fillStyle = '#15110a'; x.fillRect(cx, 78, 184, 96);
        x.strokeStyle = 'rgba(236,226,205,0.1)'; x.strokeRect(cx + .5, 78.5, 184, 96);
        x.fillStyle = mut; x.font = '600 10px monospace'; x.fillText(cl[0], cx + 16, 104);
        x.fillStyle = cl[2]; x.font = '800 34px Arial'; x.fillText(cl[1], cx + 16, 150);
      });
      x.fillStyle = mut; x.font = '600 11px monospace'; x.fillText('LEADERBOARD', 24, 212);
      [['1. Maria L.', '$12,400'], ['2. James K.', '$10,100'], ['3. You', '$8,420']].forEach((r, i) => {
        x.fillStyle = i === 2 ? blue : cream; x.font = '500 15px monospace';
        x.fillText(r[0], 24, 244 + i * 34); x.textAlign = 'right'; x.fillText(r[1], 616, 244 + i * 34); x.textAlign = 'left';
      });
    } else if (kind.type === 'list') {
      x.fillStyle = mint; x.font = '600 11px monospace'; x.textAlign = 'right'; x.fillText('LIVE', 616, 33); x.textAlign = 'left';
      const rows = [['94', 'Carlos R.'], ['91', 'Rebecca M.'], ['88', 'Tony N.'], ['84', 'Tasha K.'], ['79', 'Mark D.']];
      rows.forEach((r, i) => {
        const y = 78 + i * 60; x.fillStyle = '#15110a'; x.fillRect(22, y, 596, 50);
        x.strokeStyle = 'rgba(236,226,205,0.08)'; x.strokeRect(22.5, y + .5, 596, 50);
        x.fillStyle = blue; x.font = '800 22px Arial'; x.fillText(r[0], 40, y + 33);
        x.fillStyle = cream; x.font = '600 16px monospace'; x.fillText(r[1], 96, y + 31);
      });
    } else {
      // chart
      x.fillStyle = mut; x.font = '600 11px monospace'; x.fillText('PREMIUM · 30 DAYS', 24, 96);
      x.strokeStyle = blue; x.lineWidth = 3; x.beginPath();
      for (let i = 0; i <= 30; i++) { const px = 24 + i * 19.7, py = 320 - (Math.sin(i * 0.5) * 40 + i * 5 + 40); i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
      x.fillStyle = mint; for (let i = 0; i < 7; i++) x.fillRect(24 + i * 84, 340, 60, -(20 + Math.random() * 40));
    }
    const t = new window.THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  window.initGallery = function (canvas, container) {
    if (!window.THREE) return;
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x120f08, 6, 22);
    const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 100); cam.position.z = 0;
    const kinds = [
      { title: 'Dashboard', type: 'kpi' }, { title: 'AI Hot 100', type: 'list' },
      { title: 'Analytics', type: 'chart' }, { title: 'Close KPI', type: 'kpi' },
      { title: 'Leaderboard', type: 'list' }, { title: 'Reports', type: 'chart' },
    ];
    const texes = kinds.map(screenTexture);
    const N = 10, SPACING = 4, DEPTH = N * SPACING;
    const planes = [];
    for (let i = 0; i < N; i++) {
      const g = new THREE.PlaneGeometry(3.4, 2.13);
      const m = new THREE.MeshBasicMaterial({ map: texes[i % texes.length], transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(g, m);
      const ang = i * 2.4, rad = (i % 3) * 0.9;
      mesh.position.set(Math.sin(ang) * rad, Math.cos(ang * 1.3) * rad * 0.7, -i * SPACING - 2);
      mesh.userData = { baseX: mesh.position.x, baseY: mesh.position.y };
      scene.add(mesh); planes.push(mesh);
    }
    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    addEventListener('resize', resize); resize();

    // scroll velocity (passive, non-hijacking) + auto-drift
    let vel = 0, lastY = scrollY;
    addEventListener('scroll', () => { vel += Math.abs(scrollY - lastY) * 0.0016; lastY = scrollY; }, { passive: true });

    (function loop() {
      vel *= 0.92; const adv = 0.018 + vel;
      planes.forEach(p => {
        p.position.z += adv;
        if (p.position.z > 1.2) { p.position.z -= DEPTH; }
        // depth fade
        const d = -p.position.z; // 0 near .. DEPTH far
        let o = 1;
        if (p.position.z > -1.5) o = Math.max(0, 1 - (p.position.z + 1.5) / 2.7); // fade as it passes camera
        else if (d > DEPTH - 5) o = Math.max(0, 1 - (d - (DEPTH - 5)) / 5);
        p.material.opacity = o;
        p.rotation.y = Math.sin(p.position.z * 0.15) * 0.06;
      });
      renderer.render(scene, cam); requestAnimationFrame(loop);
    })();
  };
})();
