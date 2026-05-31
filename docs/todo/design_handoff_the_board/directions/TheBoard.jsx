// THE BOARD — split-flap (Solari) departure-board aesthetic for The Standard HQ.
// A tactile mechanical tote board: numbers look freshly flipped, alerts are
// "delayed departures", nav rows are lit tracks. Reuses window.Icon + window.DASH.
(function () {
  const Icon = window.Icon;
  if (typeof document !== 'undefined' && !document.getElementById('board-fx')) {
    const s = document.createElement('style'); s.id = 'board-fx';
    s.textContent = '@keyframes jpulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.1);opacity:0}}'
      + '@keyframes jbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}';
    document.head.appendChild(s);
  }
  const T = {
    bg: '#120f08', panel: '#19140b', panel2: '#1d1810',
    tile: '#221b10', tileText: '#ece2cd', tileEdge: 'rgba(0,0,0,0.55)',
    litBg: '#1a2740', litText: '#cfe0ff',
    line: 'rgba(236,226,205,0.10)', line2: 'rgba(236,226,205,0.18)',
    ink: '#f1e9d6', mut: 'rgba(236,226,205,0.55)', mut2: 'rgba(236,226,205,0.36)',
    amber: '#f4b43a', blue: '#5b9bff', red: '#ff6a5d', green: '#5fd08a',
    disp: '"Archivo", system-ui, sans-serif', mono: '"Space Mono", monospace', data: '"Hanken Grotesk", system-ui, sans-serif',
  };

  // one split-flap character tile
  function Flap({ ch, w, h, fs, lit, color }) {
    const bg = lit ? T.litBg : T.tile, fg = lit ? T.litText : (color || T.tileText);
    return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: w, height: h, borderRadius: Math.max(3, w * 0.13), background: bg, color: fg,
        font: `700 ${fs}px ${T.mono}`, overflow: 'hidden', flexShrink: 0,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -2px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5)`,
        textShadow: lit ? `0 0 8px ${T.blue}` : 'none' }}>
        <span style={{ position: 'relative', zIndex: 1 }}>{ch === ' ' ? '\u00A0' : ch}</span>
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, zIndex: 2,
          background: T.tileEdge, boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />
      </span>
    );
  }
  function SplitFlap({ text, size = 'md', lit, color }) {
    const S = { xs: [13, 19, 12], sm: [18, 26, 15], md: [24, 34, 19], lg: [34, 48, 28], xl: [50, 70, 42] }[size];
    return (
      <span style={{ display: 'inline-flex', gap: Math.max(2, S[0] * 0.12), alignItems: 'center' }}>
        {[...String(text)].map((c, i) => <Flap key={i} ch={c} w={S[0]} h={S[1]} fs={S[2]} lit={lit} color={color} />)}
      </span>
    );
  }
  // clean, legible number/value type (used everywhere except rank)
  function Num({ text, size = 'md', lit, color }) {
    const FS = { xs: 15, sm: 18, md: 24, lg: 34, xl: 60 }[size];
    const fw = (size === 'xl' || size === 'lg') ? 800 : 700;
    const c = lit ? '#82bcff' : (color || T.tileText);
    return (
      <span style={{ font: `${fw} ${FS}px ${T.disp}`, color: c, letterSpacing: size === 'xl' ? '-0.01em' : '0.01em',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        textShadow: lit ? '0 0 14px rgba(91,155,255,0.4)' : 'none' }}>{text}</span>
    );
  }
  const Rivets = () => (
    [['8px', '8px'], ['8px', null, '8px'], [null, '8px', null, '8px'], [null, null, '8px', '8px']].map((p, i) => (
      <span key={i} style={{ position: 'absolute', top: p[0], right: p[1], bottom: p[2], left: p[3], width: 5, height: 5,
        borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #4a4031, #110d06)',
        boxShadow: '0 1px 1px rgba(0,0,0,0.6)' }} />
    ))
  );
  const Board = ({ children, style, pad = 20, rivets = true }) => (
    <div style={{ position: 'relative', background: `linear-gradient(180deg, ${T.panel2}, ${T.panel})`,
      border: `1px solid ${T.line2}`, borderRadius: 12, padding: pad,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45)', ...style }}>
      {rivets && <Rivets />}{children}
    </div>
  );
  const Cap = ({ children, style }) => (
    <div style={{ font: `700 11px ${T.mono}`, letterSpacing: '0.2em', color: T.mut2, textTransform: 'uppercase', ...style }}>{children}</div>
  );
  const brushed = { backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)' };

  // ── RAIL: the lit departure board ────────────────────────
  function Rail() {
    const D = window.DASH;
    const flat = [];
    Object.entries(D.nav).forEach(([g, items]) => { flat.push({ g }); items.forEach((it, j) => flat.push({ it, n: j })); });
    let track = 0;
    return (
      <div style={{ width: 296, flexShrink: 0, background: T.bg, borderRight: `1px solid ${T.line2}`,
        ...brushed, display: 'flex', flexDirection: 'column', padding: '16px 14px 14px' }}>
        {/* station header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 12px' }}>
          <div style={{ font: `800 16px ${T.disp}`, letterSpacing: '0.04em', color: T.ink }}>THE&nbsp;STANDARD</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `700 10px ${T.mono}`, color: T.amber, letterSpacing: '0.1em' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: T.amber, boxShadow: `0 0 6px ${T.amber}` }} />HQ</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 12,
          borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(180deg, rgba(70,216,245,0.08), rgba(70,216,245,0.02))', border: '1px solid rgba(70,216,245,0.32)',
          boxShadow: '0 0 18px rgba(70,216,245,0.12)' }}>
          <JarvisOrbView size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ font: `800 17px ${T.disp}`, letterSpacing: '0.04em', color: T.ink }}>JARVIS</span>
              <span style={{ font: `700 8px ${T.mono}`, color: '#46d8f5', border: '1px solid rgba(70,216,245,0.4)', borderRadius: 4, padding: '2px 5px' }}>AI</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(70,216,245,0.85)', marginTop: 3 }}>Ask anything · ⌘J</div>
          </div>
        </div>
        {/* nav as lit tracks */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {flat.map((row, i) => {
            if (row.g) return (
              <div key={'g' + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px 5px' }}>
                <Cap style={{ fontSize: 12, color: T.mut, letterSpacing: '0.16em' }}>{row.g}</Cap>
                <div style={{ flex: 1, height: 1, background: T.line }} />
              </div>
            );
            track += 1;
            const [l, ic, a] = row.it;
            const num = String(track).padStart(2, '0');
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px', borderRadius: 8,
                height: 28, background: a ? 'rgba(91,155,255,0.10)' : 'transparent',
                boxShadow: a ? `inset 0 0 0 1px rgba(91,155,255,0.35)` : 'none' }}>
                <Icon name={ic} size={17} sw={a ? 2 : 1.7} style={{ color: a ? T.blue : T.mut, flexShrink: 0 }} />
                <span style={{ font: `${a ? 800 : 600} 13.5px ${T.disp}`, letterSpacing: '0.03em',
                  color: a ? T.ink : T.mut, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{l}</span>
                {a && <span style={{ marginLeft: 'auto', font: `700 8px ${T.mono}`, color: T.blue, letterSpacing: '0.1em' }}>● NOW</span>}
              </div>
            );
          })}
        </div>
        {/* bottom — operator profile */}
        <Board pad={12} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Num text="NN" size="sm" color={T.ink} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: `800 15px ${T.disp}`, color: T.ink }}>Nick Neessen</div>
              <Cap style={{ fontSize: 10, marginTop: 3 }}>GATE FFG · OWN IMO</Cap>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[['PREMIUM', '$2K', false], ['RANK', '#01', true], ['LVL', '04', false]].map(([l, v, lit]) => (
              <div key={l} style={{ flex: 1 }}>
                <Cap style={{ fontSize: 9, marginBottom: 5 }}>{l}</Cap>
                {lit ? <SplitFlap text={v} size="xs" lit /> : <Num text={v} size="xs" />}
              </div>
            ))}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.4)', marginTop: 12, overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
            <div style={{ width: '5%', height: '100%', background: T.blue, boxShadow: `0 0 8px ${T.blue}` }} /></div>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 7 }}><b style={{ color: T.ink }}>$2K</b> of $34K · 1 day left</div>
        </Board>
      </div>
    );
  }

  // ── MAIN ─────────────────────────────────────────────────
  function Topbar() {
    const seg = ['DAY', 'WK', 'MTD', 'MO', 'YR'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ font: `800 40px ${T.disp}`, letterSpacing: '0.01em', color: T.ink, lineHeight: 1, whiteSpace: 'nowrap' }}>MAY 2026</div>
          <Num text="30/31" size="sm" color={T.amber} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 10, background: T.panel, border: `1px solid ${T.line2}` }}>
            {seg.map(s => (
              <div key={s} style={{ padding: '7px 12px', borderRadius: 7, font: `700 11px ${T.mono}`, letterSpacing: '0.06em',
                background: s === 'MTD' ? T.blue : 'transparent', color: s === 'MTD' ? '#08152b' : T.mut }}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function Hero() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Board pad={24} style={{ ...brushed }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Cap>Premium Written · MTD</Cap>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `700 10px ${T.mono}`, color: T.amber, letterSpacing: '0.1em' }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: T.amber, boxShadow: `0 0 6px ${T.amber}` }} />LIVE</span>
          </div>
          <div style={{ margin: '20px 0 18px' }}><Num text="$2,040" size="xl" lit /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.4)', overflow: 'hidden',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
              <div style={{ width: '5%', height: '100%', background: T.blue, boxShadow: `0 0 10px ${T.blue}` }} /></div>
            <span style={{ font: `700 12px ${T.mono}`, color: T.mut, whiteSpace: 'nowrap' }}>5% OF $34K</span>
          </div>
          <div style={{ marginTop: 16, fontSize: 13.5, color: T.mut }}>
            Behind the board's pace — <b style={{ color: T.red }}>$32K</b> to clear the target before close.</div>
        </Board>
        <Board pad={24} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Cap>Season Rank</Cap>
          <SplitFlap text="#01" size="lg" lit />
          <div style={{ font: `800 15px ${T.disp}`, color: T.ink, letterSpacing: '0.02em' }}>THE STANDARD</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999,
            background: 'rgba(95,208,138,0.12)', color: T.green, font: `800 11px ${T.data}` }}>
            <Icon name="arrowUp" size={13} sw={3} /> Holding the lead</div>
        </Board>
      </div>
    );
  }

  function StatRow() {
    const cells = [['Commissions', '$945', '8%'], ['Policies', '01', '6%'], ['Pipeline', '$0', '—']];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {cells.map(([l, v, p]) => (
          <Board key={l} pad={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Cap>{l}</Cap><span style={{ font: `700 11px ${T.mono}`, color: T.mut }}>{p}</span></div>
            <Num text={v} size="md" />
          </Board>
        ))}
      </div>
    );
  }

  // alerts reframed as a delayed-departures board
  function Flags() {
    const D = window.DASH;
    const tag = { warn: ['DELAYED', T.amber], crit: ['HALTED', T.red], info: ['BOARDING', T.blue] };
    return (
      <Board pad={0}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px',
          borderBottom: `1px solid ${T.line}` }}>
          <Cap>Flags · Departure Status</Cap>
          <Num text="04" size="xs" color={T.amber} />
        </div>
        {D.alerts.map((a, i) => {
          const [status, col] = tag[a.sev];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px',
              borderBottom: i < D.alerts.length - 1 ? `1px solid ${T.line}` : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: col, boxShadow: `0 0 7px ${col}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `800 14.5px ${T.disp}`, color: T.ink, letterSpacing: '0.01em' }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: T.mut, marginTop: 1 }}>{a.desc}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <Num text={status} size="xs" color={col} />
              </div>
            </div>
          );
        })}
      </Board>
    );
  }

  // bottom broadcast ticker (real org / override data)
  function Ticker() {
    const items = [['ANN. PREMIUM', '$0'], ['COMMISSIONS', '$630'], ['UNEARNED', '$1,575'],
      ['OVERRIDES', '0'], ['UPLINES', '0'], ['DOWNLINES', '0'], ['AVG/AGENT', '$0'], ['CLIENTS', '02']];
    return (
      <Board pad={0} style={{ marginTop: 'auto', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ flexShrink: 0, padding: '14px 16px', background: T.blue, color: '#08152b',
            font: `800 11px ${T.mono}`, letterSpacing: '0.12em', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>◈ ORG</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 22, padding: '12px 20px', overflow: 'hidden' }}>
            {items.map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                <span style={{ font: `700 10px ${T.mono}`, letterSpacing: '0.08em', color: T.mut2 }}>{l}</span>
                <Num text={v} size="xs" />
                {i < items.length - 1 && <span style={{ width: 4, height: 4, borderRadius: 2, background: T.amber, marginLeft: 13 }} />}
              </div>
            ))}
          </div>
        </div>
      </Board>
    );
  }

  // reusable animated Jarvis orb (Twin Shells WebGL), soft glow, no hard edge
  function JarvisOrbView({ size = 56 }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      let inst, iv;
      const m = () => { if (window.JarvisOrb && ref.current && !ref.current.__m) { ref.current.__m = true; inst = window.JarvisOrb.twin(ref.current); } };
      m();
      if (!window.JarvisOrb) iv = setInterval(() => { if (window.JarvisOrb) { clearInterval(iv); m(); } }, 200);
      return () => { iv && clearInterval(iv); inst && inst.stop && inst.stop(); };
    }, []);
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: -Math.round(size * 0.24), pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(70,216,245,0.28), rgba(70,216,245,0) 66%)' }} />
        <div ref={ref} style={{ width: size, height: size }} />
      </div>
    );
  }

  // quick actions + Jarvis launcher
  function QuickActions() {
    const acts = [
      { ic: 'docplus', l: 'Add Policy', primary: true },
      { ic: 'addperson', l: 'Add Recruit' },
      { ic: 'send', l: 'Send Email' },
      { ic: 'receipt', l: 'Log Expense' },
      { ic: 'chat', l: 'Discord', soon: true },
    ];
    return (
      <Board pad={0} style={{ marginBottom: 16, display: 'flex', overflow: 'hidden' }}>
        {/* Jarvis launcher */}
        <div style={{ flex: '0 0 36%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          borderRight: `1px solid ${T.line2}`, position: 'relative', cursor: 'pointer',
          background: `radial-gradient(130% 160% at 0% 0%, rgba(70,216,245,0.16), rgba(70,216,245,0.02))` }}>
          <JarvisOrbView size={58} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: `800 19px ${T.disp}`, letterSpacing: '0.06em', color: T.ink }}>JARVIS</span>
              <span style={{ font: `700 8.5px ${T.mono}`, letterSpacing: '0.12em', color: '#46d8f5', padding: '2px 6px',
                borderRadius: 4, border: `1px solid rgba(70,216,245,0.4)` }}>AI</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(70,216,245,0.8)', marginTop: 3 }}>Ask anything, run any task</div>
          </div>
          <kbd style={{ font: `700 11px ${T.mono}`, color: '#46d8f5', background: 'rgba(70,216,245,0.1)', borderRadius: 6,
            padding: '6px 9px', border: `1px solid rgba(70,216,245,0.35)`, flexShrink: 0 }}>⌘J</kbd>
        </div>
        {/* action tiles */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
          {acts.map((a, i) => (
            <div key={a.l} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 9, padding: '14px 4px', cursor: 'pointer',
              borderRight: i < acts.length - 1 ? `1px solid ${T.line}` : 'none',
              background: a.primary ? 'rgba(91,155,255,0.12)' : 'transparent' }}>
              {a.soon && <span style={{ position: 'absolute', top: 8, right: 8, font: `700 7.5px ${T.mono}`, letterSpacing: '0.08em',
                color: T.amber, border: `1px solid rgba(244,180,58,0.4)`, borderRadius: 4, padding: '2px 4px' }}>SOON</span>}
              <Icon name={a.ic} size={27} sw={1.6} style={{ color: a.primary ? '#5b9bff' : T.ink,
                filter: a.primary ? 'drop-shadow(0 0 9px rgba(91,155,255,0.65))' : 'none' }} />
              <span style={{ font: `700 11px ${T.disp}`, letterSpacing: '0.04em', color: a.primary ? T.ink : T.mut,
                textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{a.l}</span>
            </div>
          ))}
        </div>
      </Board>
    );
  }

  // floating Jarvis launcher — Twin Shells WebGL core, drag anywhere
  function Jarvis() {
    const orbRef = React.useRef(null);
    const startPos = () => { try { const p = JSON.parse(localStorage.getItem('jarvis-pos')); if (p && typeof p.x === 'number') return p; } catch (e) {} return { x: 1380 - 332, y: 920 - 150 }; };
    const posRef = React.useRef(startPos());
    const [, force] = React.useReducer(n => n + 1, 0);
    const drag = React.useRef(null);

    React.useEffect(() => {
      let inst, iv;
      const mount = () => { if (window.JarvisOrb && orbRef.current && !orbRef.current.__m) { orbRef.current.__m = true; inst = window.JarvisOrb.twin(orbRef.current); } };
      mount();
      if (!window.JarvisOrb) iv = setInterval(() => { if (window.JarvisOrb) { clearInterval(iv); mount(); } }, 200);
      return () => { iv && clearInterval(iv); inst && inst.stop && inst.stop(); };
    }, []);

    const onMove = (e) => {
      const d = drag.current; if (!d) return;
      const sc = window.__boardScale || 1;
      let nx = d.x + (e.clientX - d.sx) / sc, ny = d.y + (e.clientY - d.sy) / sc;
      nx = Math.max(4, Math.min(1380 - 134, nx)); ny = Math.max(4, Math.min(920 - 134, ny));
      posRef.current = { x: nx, y: ny }; force();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      drag.current = null; try { localStorage.setItem('jarvis-pos', JSON.stringify(posRef.current)); } catch (e) {}
    };
    const onDown = (e) => {
      e.preventDefault();
      drag.current = { sx: e.clientX, sy: e.clientY, x: posRef.current.x, y: posRef.current.y };
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    };

    const CY = '#46d8f5', p = posRef.current;
    return (
      <div onPointerDown={onDown} style={{ position: 'absolute', left: p.x, top: p.y, zIndex: 40, display: 'flex',
        alignItems: 'center', gap: 13, cursor: 'grab', userSelect: 'none', touchAction: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 14,
          background: `linear-gradient(180deg, ${T.panel2}, ${T.panel})`, border: `1px solid rgba(70,216,245,0.5)`,
          boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 22px rgba(70,216,245,0.22)` }}>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ font: `800 13px ${T.disp}`, letterSpacing: '0.06em', color: T.ink }}>ASK JARVIS</div>
            <div style={{ fontSize: 10.5, color: 'rgba(70,216,245,0.85)' }}>Drag me anywhere</div>
          </div>
          <kbd style={{ font: `700 11px ${T.mono}`, color: CY, background: 'rgba(70,216,245,0.12)', borderRadius: 6,
            padding: '5px 8px', border: `1px solid rgba(70,216,245,0.4)` }}>⌘J</kbd>
        </div>
        <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: -20, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(70,216,245,0.2), rgba(70,216,245,0) 66%)' }} />
          <div ref={orbRef} style={{ position: 'relative', width: 130, height: 130 }} />
        </div>
      </div>
    );
  }

  function Board_Screen() {
    return (
      <div style={{ position: 'relative', display: 'flex', width: 1380, height: 920, background: T.bg, ...brushed,
        fontFamily: T.data, color: T.ink, overflow: 'hidden' }}>
        <Rail />
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', padding: '22px 30px', display: 'flex', flexDirection: 'column' }}>
          <Topbar />
          <Hero />
          <QuickActions />
          <StatRow />
          <Flags />
          <Ticker />
        </div>
      </div>
    );
  }
  window.Board = Board_Screen;
})();
