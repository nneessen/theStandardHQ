// Landing-page effects — vanilla, no framework.
// reveal-on-scroll · count-up · matrix scramble · glow border · tilt · nav state
(function () {
  // ── reveal on scroll (staggered via --i) ──
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

  // ── count-up ──
  const fmt = (n, suf) => {
    if (suf === '$') return '$' + Math.round(n).toLocaleString();
    return Math.round(n).toLocaleString();
  };
  const countIO = new IntersectionObserver((es) => {
    es.forEach(e => {
      if (!e.isIntersecting) return; countIO.unobserve(e.target);
      const el = e.target, to = parseFloat(el.dataset.count), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
      const dur = 1400, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), e2 = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + Math.round(to * e2).toLocaleString() + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(el => countIO.observe(el));

  // ── matrix scramble text ──
  const GLYPHS = '01';
  function scramble(el) {
    const final = el.dataset.scramble, chars = [...final];
    let frame = 0; const hold = [];
    chars.forEach((c, i) => hold.push(c === ' ' ? 9999 : 2 + i * 1.4 + Math.random() * 3));
    el.textContent = '';
    const span = document.createElement('span'); el.appendChild(span);
    const run = () => {
      let out = '', done = true;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ') { out += ' '; continue; }
        if (frame >= hold[i]) out += chars[i];
        else { out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; done = false; }
      }
      span.textContent = out; frame++;
      if (!done) requestAnimationFrame(run);
      else span.textContent = final;
    };
    run();
  }
  const scrIO = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { scrIO.unobserve(e.target); scramble(e.target); } });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-scramble]').forEach(el => scrIO.observe(el));

  // ── glow border (viewport-space, background-attachment:fixed) ──
  const glows = [...document.querySelectorAll('[data-glow]')];
  if (glows.length) {
    addEventListener('pointermove', (e) => {
      for (const c of glows) { c.style.setProperty('--x', e.clientX.toFixed(1)); c.style.setProperty('--y', e.clientY.toFixed(1)); }
    }, { passive: true });
  }

  // ── 3D tilt ──
  document.querySelectorAll('[data-tilt]').forEach(card => {
    const max = 7;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
      card.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'; });
  });

  // ── nav scrolled state + scroll progress bar ──
  const nav = document.querySelector('[data-nav]'), bar = document.querySelector('[data-progress]');
  addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', scrollY > 40);
    if (bar) {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    }
  }, { passive: true });

  // ── FAQ accordion ──
  document.querySelectorAll('[data-faq]').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('[data-faq].open').forEach(o => o.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  // ── magnetic buttons ──
  document.querySelectorAll('[data-magnet]').forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 12}px, ${((e.clientY - r.top) / r.height - 0.5) * 12}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = 'translate(0,0)'; });
  });
  // ── horizontal scroll carousel (sticky pin → translateX) ──
  document.querySelectorAll('[data-hscroll]').forEach(sec => {
    const track = sec.querySelector('[data-htrack]');
    if (!track) return;
    const update = () => {
      const total = sec.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / total));
      const max = track.scrollWidth - innerWidth + 80;
      track.style.transform = `translateX(${-p * max}px)`;
    };
    addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
  });
  // ── scramble-on-hover (button labels) ──
  const SCH='ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*0123456789';
  document.querySelectorAll('[data-scramble-hover]').forEach(el => {
    const final = el.dataset.scrambleHover; let raf;
    el.closest('.btn,[data-magnet]')?.addEventListener('mouseenter', () => {
      let f = 0; const tot = final.length * 3; cancelAnimationFrame(raf);
      const run = () => { f++; const rev = Math.floor(f / 3);
        el.textContent = final.split('').map((c, i) => c === ' ' ? ' ' : i < rev ? c : SCH[Math.floor(Math.random() * SCH.length)]).join('');
        if (f < tot) raf = requestAnimationFrame(run); else el.textContent = final; };
      run();
    });
  });
  // ── 3D scroll-tilt card (container reveal) ──
  document.querySelectorAll('[data-tilt-card]').forEach(card => {
    const upd = () => {
      const r = card.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.15) / (innerHeight * 0.7)));
      card.style.transform = `perspective(1500px) rotateX(${((1 - p) * 24).toFixed(2)}deg) scale(${(0.94 + p * 0.06).toFixed(3)})`;
    };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  });

  // ── cursor-proximity kinetic text ──
  document.querySelectorAll('[data-kinetic]').forEach(el => {
    const text = el.dataset.kinetic;
    el.innerHTML = text.split('').map(c => c === ' ' ? '<span class="sp">&nbsp;</span>' : `<span class="kl">${c}</span>`).join('');
    const wrap = el.closest('[data-kinwrap]') || el;
    const letters = [...el.querySelectorAll('.kl')];
    let mx = -9999, my = -9999;
    wrap.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
    wrap.addEventListener('pointerleave', () => { mx = my = -9999; });
    const R = 165, A = [241, 233, 214], B = [70, 216, 245];
    const loop = () => {
      for (const l of letters) {
        const r = l.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const p = Math.max(0, 1 - Math.hypot(mx - cx, my - cy) / R);
        l.style.transform = `scale(${(1 + p * 0.55).toFixed(3)}) translateY(${(-p * 5).toFixed(1)}px)`;
        l.style.color = p > 0.02 ? `rgb(${Math.round(A[0]+(B[0]-A[0])*p)},${Math.round(A[1]+(B[1]-A[1])*p)},${Math.round(A[2]+(B[2]-A[2])*p)})` : '';
        l.style.textShadow = p > 0.25 ? `0 0 ${(p*16).toFixed(0)}px rgba(70,216,245,${(p*0.6).toFixed(2)})` : '';
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
  // ── raining letters (matrix) ──
  document.querySelectorAll('[data-rain]').forEach(host => {
    const G = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    const N = 70, items = [];
    for (let i = 0; i < N; i++) {
      const s = document.createElement('span');
      s.className = 'rain-ch'; s.textContent = G[Math.floor(Math.random() * G.length)];
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      const dur = 6 + Math.random() * 8, delay = -Math.random() * dur;
      s.style.animationDuration = dur + 's'; s.style.animationDelay = delay + 's';
      s.style.fontSize = (10 + Math.random() * 12).toFixed(0) + 'px';
      host.appendChild(s); items.push(s);
    }
    setInterval(() => { const s = items[Math.floor(Math.random() * items.length)]; s.textContent = G[Math.floor(Math.random() * G.length)]; }, 120);
  });
})();
