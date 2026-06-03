/* ============================================================
   The Standard HQ — Analytics chart + counter engine
   Vanilla JS. Recreates the visual language of the Recharts
   components (gradient area, dual series, sparklines, radial
   progress) in the warm "Board" palette. window.AC = API.
   ============================================================ */
(function () {
  const T = {
    bg:'#120f08', panel:'#19140b', panel2:'#1d1810', tile:'#221b10',
    line:'rgba(236,226,205,0.10)', line2:'rgba(236,226,205,0.18)',
    ink:'#f1e9d6', cream:'#ece2cd', mut:'rgba(236,226,205,0.55)', mut2:'rgba(236,226,205,0.36)',
    blue:'#5b9bff', cyan:'#46d8f5', amber:'#f4b43a', red:'#ff6a5d', green:'#5fd08a',
  };
  const NS = 'http://www.w3.org/2000/svg';
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ---------- shared CSS (injected once) ---------- */
  const CSS = `
  :root{
    --bg:#120f08; --panel:#19140b; --panel2:#1d1810; --tile:#221b10;
    --line:rgba(236,226,205,0.10); --line2:rgba(236,226,205,0.18);
    --ink:#f1e9d6; --cream:#ece2cd; --mut:rgba(236,226,205,0.55); --mut2:rgba(236,226,205,0.36);
    --blue:#5b9bff; --cyan:#46d8f5; --amber:#f4b43a; --red:#ff6a5d; --green:#5fd08a;
    --disp:"Archivo",system-ui,sans-serif; --body:"Hanken Grotesk",system-ui,sans-serif; --mono:"Space Mono",monospace;
  }
  .acx *{box-sizing:border-box;}
  .acx{font-family:var(--body); color:var(--ink);}
  .acx .eyebrow{font:700 13px/1 var(--mono); letter-spacing:.22em; text-transform:uppercase; color:var(--mut2); display:inline-flex; align-items:center; gap:9px;}

  /* panel + rivets */
  .acx .panel{position:relative; background:linear-gradient(180deg,var(--panel2),var(--panel)); border:1px solid var(--line2);
    border-radius:14px; padding:26px 28px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 26px rgba(0,0,0,0.45);}
  .acx .rivets{position:absolute; inset:0; pointer-events:none;}
  .acx .rivets span{position:absolute; width:5px; height:5px; border-radius:50%;
    background:radial-gradient(circle at 35% 30%, #4a4031, #110d06); box-shadow:0 1px 1px rgba(0,0,0,0.6);}
  .acx .rivets span:nth-child(1){top:9px; left:9px;} .acx .rivets span:nth-child(2){top:9px; right:9px;}
  .acx .rivets span:nth-child(3){bottom:9px; left:9px;} .acx .rivets span:nth-child(4){bottom:9px; right:9px;}

  .acx .p-head{display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px;}
  .acx .p-title{font:700 13px/1 var(--mono); letter-spacing:.2em; text-transform:uppercase; color:var(--mut2); margin:0 0 9px;}
  .acx .p-sub{font:600 18px/1.3 var(--body); color:var(--ink); margin:0;}
  .acx .p-sub.dim{color:var(--mut); font-weight:500;}
  .acx .p-right{text-align:right;}
  .acx .p-right .big{font:800 30px/1 var(--disp); color:var(--cream); font-variant-numeric:tabular-nums;}
  .acx .p-right .lbl{font:600 12px var(--mono); letter-spacing:.08em; color:var(--mut2); text-transform:uppercase; margin-top:6px;}

  .acx .num-xl{font:800 58px/1 var(--disp); color:var(--cream); letter-spacing:-.01em; font-variant-numeric:tabular-nums;}
  .acx .num-xl.lit{color:#dfe9ff; text-shadow:0 0 22px rgba(91,155,255,0.35);}
  .acx .num-lg{font:800 38px/1 var(--disp); color:var(--cream); font-variant-numeric:tabular-nums;}
  .acx .meta{font:500 15px/1.4 var(--body); color:var(--mut); margin-top:12px;}
  .acx .meta b{color:var(--ink); font-weight:700;}

  .acx .pill{font:700 12px var(--mono); letter-spacing:.12em; text-transform:uppercase; padding:7px 13px; border-radius:999px;
    display:inline-flex; align-items:center; gap:8px; white-space:nowrap;}
  .acx .pill .dot{width:7px; height:7px; border-radius:50%;}
  .acx .pill.red{background:rgba(255,106,93,0.14); color:var(--red);} .acx .pill.red .dot{background:var(--red);}
  .acx .pill.amber{background:rgba(244,180,58,0.14); color:var(--amber);} .acx .pill.amber .dot{background:var(--amber);}
  .acx .pill.green{background:rgba(95,208,138,0.14); color:var(--green);} .acx .pill.green .dot{background:var(--green);}
  .acx .pill.blue{background:rgba(91,155,255,0.14); color:var(--blue);} .acx .pill.blue .dot{background:var(--blue);}

  /* flap tiles */
  .acx .flap{position:relative; background:var(--tile); border-radius:9px; padding:16px 18px; overflow:hidden;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -3px 6px rgba(0,0,0,0.4);}
  .acx .flap::after{content:""; position:absolute; left:0; right:0; top:50%; height:1px; background:rgba(0,0,0,0.5); box-shadow:0 1px 0 rgba(255,255,255,0.04);}
  .acx .flap .k{font:700 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--mut2);}
  .acx .flap .v{font:800 26px/1 var(--disp); color:var(--cream); margin-top:10px; font-variant-numeric:tabular-nums; position:relative; z-index:1;}
  .acx .flap .v.sm{font-size:21px;}
  .acx .flap .v.red{color:var(--red);} .acx .flap .v.green{color:var(--green);} .acx .flap .v.blue{color:var(--blue);} .acx .flap .v.amber{color:var(--amber);}
  .acx .flap .sub{font:500 13px var(--body); color:var(--mut); margin-top:7px;}

  /* bars */
  .acx .bar{height:9px; border-radius:5px; background:rgba(0,0,0,0.45); overflow:hidden; box-shadow:inset 0 1px 2px rgba(0,0,0,0.6);}
  .acx .bar>i{display:block; height:100%; border-radius:5px; background:var(--blue); box-shadow:0 0 10px var(--blue);}
  .acx .bar.amber>i{background:var(--amber); box-shadow:0 0 10px var(--amber);}
  .acx .bar.green>i{background:var(--green); box-shadow:0 0 10px var(--green);}
  .acx .bar.red>i{background:var(--red); box-shadow:0 0 10px var(--red);}

  /* tables */
  .acx table{width:100%; border-collapse:collapse;}
  .acx thead th{font:700 11.5px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--mut2);
    text-align:right; padding:0 0 14px; border-bottom:1px solid var(--line2);}
  .acx thead th:first-child{text-align:left;}
  .acx tbody td{font:600 15.5px var(--body); color:var(--ink); padding:14px 0; text-align:right; border-bottom:1px solid var(--line); font-variant-numeric:tabular-nums;}
  .acx tbody td:first-child{text-align:left; color:var(--mut);}
  .acx tbody tr:last-child td{border-bottom:none;}
  .acx thead th+th{padding-left:18px;} .acx tbody td+td{padding-left:18px; white-space:nowrap;}
  .acx .agent{font:700 16px var(--disp); color:var(--ink);}
  .acx .rank{font:800 14px var(--disp); color:var(--mut2); width:30px;}
  .acx td.green{color:var(--green);} .acx td.amber{color:var(--amber);} .acx td.red{color:var(--red);}

  .acx .divline{height:1px; background:var(--line); margin:20px 0;}
  .acx .note{font:600 15px var(--body); text-align:center; padding:14px 0;}
  .acx .note.red{color:var(--red);} .acx .note.amber{color:var(--amber);} .acx .note.mut{color:var(--mut);}

  /* legend */
  .acx .legend{display:flex; gap:22px; justify-content:center; margin-top:14px; flex-wrap:wrap;}
  .acx .legend span{font:600 14px var(--body); color:var(--mut); display:inline-flex; align-items:center; gap:8px;}
  .acx .legend i{width:10px; height:10px; border-radius:50%; display:inline-block;}

  /* radial */
  .acx .radial{position:relative; display:inline-grid; place-items:center;}
  .acx .radial .ctr{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;}
  .acx .radial .ctr .b{font:800 40px/1 var(--disp); color:var(--cream); font-variant-numeric:tabular-nums;}
  .acx .radial .ctr .s{font:600 12px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--mut2); margin-top:8px;}

  /* chart tooltip */
  .acx .acx-tt{position:absolute; pointer-events:none; z-index:20; background:#1b150c; border:1px solid var(--line2);
    border-radius:10px; padding:10px 12px; box-shadow:0 12px 30px rgba(0,0,0,0.5); min-width:120px; opacity:0; transition:opacity .12s; transform:translate(-50%,-115%);}
  .acx .acx-tt .ttl{font:700 11px var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--mut2); margin-bottom:8px;}
  .acx .acx-tt .row{display:flex; align-items:center; gap:8px; font:600 14px var(--body); color:var(--ink); margin-top:4px; justify-content:space-between;}
  .acx .acx-tt .row .lab{display:flex; align-items:center; gap:7px; color:var(--mut);}
  .acx .acx-tt .row .lab i{width:9px; height:9px; border-radius:2px;}
  .acx .acx-tt .row .val{font-family:var(--mono); font-weight:700; color:var(--cream); font-variant-numeric:tabular-nums;}

  /* spark card */
  .acx .sparkcard{background:var(--tile); border:1px solid var(--line); border-radius:11px; padding:16px 18px;}
  .acx .sparkcard .top{display:flex; align-items:center; justify-content:space-between; gap:10px;}
  .acx .sparkcard .lab{font:600 15px var(--body); color:var(--ink);}
  .acx .sparkcard .mid{display:flex; align-items:flex-end; justify-content:space-between; gap:14px; margin-top:12px;}
  .acx .sparkcard .v{font:800 24px/1 var(--disp); color:var(--cream); font-variant-numeric:tabular-nums;}
  .acx .sparkcard .spark{flex:1; height:38px; min-width:60px;}

  /* carousel */
  .acx .acx-carousel{position:relative;}
  .acx .acx-vp{overflow:hidden; border-radius:12px;}
  .acx .acx-track{display:flex; transition:transform .45s cubic-bezier(.4,0,.2,1);}
  .acx .acx-slide{flex:0 0 100%; min-width:0;}
  .acx .acx-nav{display:flex; align-items:center; justify-content:space-between; margin-top:18px;}
  .acx .acx-dots{display:flex; gap:9px; align-items:center;}
  .acx .acx-dot{width:9px; height:9px; border-radius:50%; background:rgba(236,226,205,0.22); border:none; cursor:pointer; padding:0; transition:.2s;}
  .acx .acx-dot.on{background:var(--blue); box-shadow:0 0 10px var(--blue); width:26px; border-radius:5px;}
  .acx .acx-arrows{display:flex; gap:10px;}
  .acx .acx-arr{width:42px; height:42px; border-radius:11px; display:grid; place-items:center; cursor:pointer;
    background:linear-gradient(180deg,var(--panel2),var(--panel)); border:1px solid var(--line2); color:var(--ink);}
  .acx .acx-arr:hover{border-color:rgba(236,226,205,0.32);}
  .acx .acx-tabs{display:flex; gap:8px; flex-wrap:wrap;}
  .acx .acx-tab{font:700 12px var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--mut); padding:9px 15px; border-radius:9px;
    background:transparent; border:1px solid transparent; cursor:pointer;}
  .acx .acx-tab.on{color:var(--blue); background:rgba(91,155,255,0.12); box-shadow:inset 0 0 0 1px rgba(91,155,255,0.35);}
  `;
  function injectCSS(){
    if (document.getElementById('acx-css')) return;
    const s = document.createElement('style'); s.id='acx-css'; s.textContent=CSS; document.head.appendChild(s);
  }

  /* ---------- number formatting + countUp ---------- */
  function fmtNum(n, dec){
    const f = Number(n).toFixed(dec||0);
    const parts = f.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function countUp(el){
    const target = parseFloat(el.getAttribute('data-count'));
    const pre = el.getAttribute('data-prefix')||'';
    const suf = el.getAttribute('data-suffix')||'';
    const dec = parseInt(el.getAttribute('data-decimals')||'0',10);
    const dur = parseInt(el.getAttribute('data-dur')||'1100',10);
    if (el.__done) return; el.__done = true;
    const t0 = performance.now();
    function step(now){
      const p = Math.min(1,(now-t0)/dur), v = target*ease(p);
      el.textContent = pre + fmtNum(v,dec) + suf;
      if (p<1) requestAnimationFrame(step);
      else el.textContent = pre + fmtNum(target,dec) + suf;
    }
    requestAnimationFrame(step);
    setTimeout(()=>{ el.textContent = pre + fmtNum(target,dec) + suf; }, dur+120); // fallback when rAF is throttled (hidden tab)
  }

  /* ---------- radial progress ---------- */
  function radial(el, o){
    if (el.__done) return; el.__done = true;
    const size = o.size||190, th = o.thickness||16, r = (size-th)/2, c = 2*Math.PI*r, cx=size/2;
    el.classList.add('radial'); el.style.width=size+'px'; el.style.height=size+'px';
    const svg = document.createElementNS(NS,'svg'); svg.setAttribute('width',size); svg.setAttribute('height',size);
    svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
    const track = document.createElementNS(NS,'circle');
    track.setAttribute('cx',cx); track.setAttribute('cy',cx); track.setAttribute('r',r);
    track.setAttribute('fill','none'); track.setAttribute('stroke','rgba(0,0,0,0.45)'); track.setAttribute('stroke-width',th);
    const val = document.createElementNS(NS,'circle');
    const col = o.color||T.blue;
    val.setAttribute('cx',cx); val.setAttribute('cy',cx); val.setAttribute('r',r);
    val.setAttribute('fill','none'); val.setAttribute('stroke',col); val.setAttribute('stroke-width',th);
    val.setAttribute('stroke-linecap','round'); val.setAttribute('stroke-dasharray',c);
    val.setAttribute('stroke-dashoffset',c);
    val.setAttribute('transform',`rotate(-90 ${cx} ${cx})`);
    val.style.filter = `drop-shadow(0 0 7px ${col})`;
    svg.appendChild(track); svg.appendChild(val); el.appendChild(svg);
    const ctr = document.createElement('div'); ctr.className='ctr';
    ctr.innerHTML = `<div class="b" data-count="${o.pct}" data-suffix="%" data-dur="1300">0%</div>`+(o.sub?`<div class="s">${o.sub}</div>`:'');
    el.appendChild(ctr);
    countUp(ctr.querySelector('.b'));
    const t0 = performance.now(), dur=1300, end=c*(1-Math.max(0,Math.min(1,o.pct/100)));
    (function an(now){ const p=Math.min(1,(now-t0)/dur); val.setAttribute('stroke-dashoffset', c-(c-end)*ease(p)); if(p<1) requestAnimationFrame(an); })(performance.now());
    setTimeout(()=>val.setAttribute('stroke-dashoffset', end), dur+150); // fallback
  }

  /* ---------- path helpers ---------- */
  function smoothPath(pts){
    if (pts.length<2) return '';
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
      const c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6;
      const c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  function linePath(pts){ return 'M '+pts.map(p=>p[0]+','+p[1]).join(' L '); }

  /* ---------- area / line chart ---------- */
  function areaChart(el, o){
    if (el.__done) return; el.__done = true;
    const W = el.clientWidth||620, H = o.height||250;
    const padL=46, padR=o.rightAxis?46:16, padT=18, padB=34;
    const x0=padL, x1=W-padR, y0=H-padB, y1=padT;
    const labels=o.labels, n=labels.length;
    const xAt=i=> x0+(x1-x0)*(n===1?0.5:i/(n-1));
    // domain
    let lo=Infinity, hi=-Infinity;
    o.series.forEach(s=>s.data.forEach(v=>{ if(v<lo)lo=v; if(v>hi)hi=v; }));
    if (o.min!=null) lo=o.min; if (o.max!=null) hi=o.max;
    if (lo===hi){ hi=lo+1; } const pad=(hi-lo)*0.12; lo-=pad*(o.min!=null?0:1); hi+=pad;
    const yAt=v=> y0-(y0-y1)*((v-lo)/(hi-lo));
    el.style.position='relative';
    const svg=document.createElementNS(NS,'svg'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    svg.setAttribute('width','100%'); svg.setAttribute('height',H); svg.style.display='block';
    // defs gradients
    const defs=document.createElementNS(NS,'defs');
    o.series.forEach((s,si)=>{ if(!s.fill) return;
      const gid='acg'+Math.random().toString(36).slice(2);
      s.__gid=gid;
      const lg=document.createElementNS(NS,'linearGradient'); lg.setAttribute('id',gid);
      lg.setAttribute('x1','0'); lg.setAttribute('y1','0'); lg.setAttribute('x2','0'); lg.setAttribute('y2','1');
      lg.innerHTML=`<stop offset="0%" stop-color="${s.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0.02"/>`;
      defs.appendChild(lg);
    });
    svg.appendChild(defs);
    // gridlines + y labels
    const ticks=o.yTicks||4;
    for(let g=0; g<=ticks; g++){
      const gv=lo+(hi-lo)*(g/ticks), gy=yAt(gv);
      const ln=document.createElementNS(NS,'line');
      ln.setAttribute('x1',x0); ln.setAttribute('x2',x1); ln.setAttribute('y1',gy); ln.setAttribute('y2',gy);
      ln.setAttribute('stroke','rgba(236,226,205,0.08)'); ln.setAttribute('stroke-dasharray','4 10');
      svg.appendChild(ln);
      const tx=document.createElementNS(NS,'text');
      tx.setAttribute('x',x0-10); tx.setAttribute('y',gy+4); tx.setAttribute('text-anchor','end');
      tx.setAttribute('fill','rgba(236,226,205,0.4)'); tx.setAttribute('font-size','11'); tx.setAttribute('font-family','Space Mono, monospace');
      tx.textContent=(o.yfmt?o.yfmt(gv):Math.round(gv)); svg.appendChild(tx);
    }
    // x labels
    labels.forEach((lab,i)=>{ if(o.skip&&i%o.skip!==0&&i!==n-1) return;
      const tx=document.createElementNS(NS,'text');
      tx.setAttribute('x',xAt(i)); tx.setAttribute('y',H-10); tx.setAttribute('text-anchor','middle');
      tx.setAttribute('fill','rgba(236,226,205,0.4)'); tx.setAttribute('font-size','11'); tx.setAttribute('font-family','Hanken Grotesk, sans-serif');
      tx.textContent=lab; svg.appendChild(tx);
    });
    // reference line
    if (o.refX!=null){
      const rx=xAt(o.refX);
      const rl=document.createElementNS(NS,'line'); rl.setAttribute('x1',rx); rl.setAttribute('x2',rx);
      rl.setAttribute('y1',y1); rl.setAttribute('y2',y0); rl.setAttribute('stroke',T.blue); rl.setAttribute('stroke-width','1.4'); rl.setAttribute('stroke-opacity','0.55');
      svg.appendChild(rl);
    }
    if (o.refY!=null){
      const ry=yAt(o.refY);
      const rl=document.createElementNS(NS,'line'); rl.setAttribute('x1',x0); rl.setAttribute('x2',x1);
      rl.setAttribute('y1',ry); rl.setAttribute('y2',ry); rl.setAttribute('stroke',o.refColor||T.amber); rl.setAttribute('stroke-width','1.4');
      rl.setAttribute('stroke-dasharray','5 5'); rl.setAttribute('stroke-opacity','0.7'); svg.appendChild(rl);
    }
    // series
    const dotEls=[];
    o.series.forEach(s=>{
      const pts=s.data.map((v,i)=>[xAt(i), yAt(v)]);
      const dpath=o.smooth!==false? smoothPath(pts): linePath(pts);
      if (s.fill){
        const area=document.createElementNS(NS,'path');
        area.setAttribute('d', dpath+` L ${pts[pts.length-1][0]},${y0} L ${pts[0][0]},${y0} Z`);
        area.setAttribute('fill',`url(#${s.__gid})`); area.setAttribute('opacity','0');
        svg.appendChild(area);
        requestAnimationFrame(()=>{ area.style.transition='opacity .9s ease .25s'; area.setAttribute('opacity','1'); });
        setTimeout(()=>area.setAttribute('opacity','1'), 1300); // fallback
      }
      const line=document.createElementNS(NS,'path');
      line.setAttribute('d',dpath); line.setAttribute('fill','none'); line.setAttribute('stroke',s.color);
      line.setAttribute('stroke-width',s.width||2.4); line.setAttribute('stroke-linecap','round'); line.setAttribute('stroke-linejoin','round');
      if (s.dash) line.setAttribute('stroke-dasharray','7 5');
      svg.appendChild(line);
      // draw-on
      try{ const L=line.getTotalLength(); line.style.strokeDasharray=s.dash?'7 5':L; line.style.strokeDashoffset=L;
        requestAnimationFrame(()=>{ line.style.transition='stroke-dashoffset 1.1s ease'; line.style.strokeDashoffset=0; });
        setTimeout(()=>{ line.style.transition='none'; line.style.strokeDasharray=s.dash?'7 5':'none'; line.style.strokeDashoffset=0; }, 1300); // fallback
      }catch(e){}
      // dots
      const ds=[];
      pts.forEach((p,i)=>{
        const dc=(s.dots&&s.dots[i])||s.color;
        const c=document.createElementNS(NS,'circle');
        c.setAttribute('cx',p[0]); c.setAttribute('cy',p[1]); c.setAttribute('r', s.dots?4.5:0);
        c.setAttribute('fill','#19140b'); c.setAttribute('stroke',dc); c.setAttribute('stroke-width','2.4');
        if (s.dots) c.style.filter=`drop-shadow(0 0 5px ${dc})`;
        svg.appendChild(c); ds.push({el:c, x:p[0], y:p[1]});
      });
      dotEls.push({s, ds});
    });
    el.appendChild(svg);
    // tooltip + hover
    const tt=document.createElement('div'); tt.className='acx-tt'; el.appendChild(tt);
    const guide=document.createElementNS(NS,'line'); guide.setAttribute('stroke','rgba(236,226,205,0.25)');
    guide.setAttribute('stroke-width','1'); guide.setAttribute('y1',y1); guide.setAttribute('y2',y0); guide.style.opacity='0'; svg.appendChild(guide);
    const hov=document.createElementNS(NS,'rect'); hov.setAttribute('x',x0); hov.setAttribute('y',y1);
    hov.setAttribute('width',x1-x0); hov.setAttribute('height',y0-y1); hov.setAttribute('fill','transparent'); svg.appendChild(hov);
    function move(ev){
      const r=svg.getBoundingClientRect(), mx=(ev.clientX-r.left)*(W/r.width);
      let i=Math.round((mx-x0)/((x1-x0)/(n-1))); i=Math.max(0,Math.min(n-1,i));
      const gx=xAt(i); guide.setAttribute('x1',gx); guide.setAttribute('x2',gx); guide.style.opacity='1';
      let rows='';
      o.series.forEach((s,si)=>{ if(s.noTip) return;
        const v=s.data[i]; rows+=`<div class="row"><span class="lab"><i style="background:${s.color}"></i>${s.name||''}</span><span class="val">${o.tipfmt?o.tipfmt(v,s):v}</span></div>`;
      });
      tt.innerHTML=`<div class="ttl">${labels[i]}</div>${rows}`;
      tt.style.left=(gx/W*r.width)+'px';
      const topY=Math.min.apply(null,o.series.map(s=>yAt(s.data[i])));
      tt.style.top=(topY/H*r.height)+'px'; tt.style.opacity='1';
      dotEls.forEach(({ds})=>ds.forEach((d,di)=>d.el.setAttribute('r', di===i?5.5:(d.el.getAttribute('data-base')||0))));
    }
    dotEls.forEach(({s,ds})=>ds.forEach(d=>d.el.setAttribute('data-base', s.dots?4.5:0)));
    hov.addEventListener('mousemove',move);
    hov.addEventListener('mouseleave',()=>{ tt.style.opacity='0'; guide.style.opacity='0';
      dotEls.forEach(({ds})=>ds.forEach(d=>d.el.setAttribute('r', d.el.getAttribute('data-base')||0))); });
  }

  /* ---------- sparkline ---------- */
  function sparkline(el, o){
    if (el.__done) return; el.__done=true;
    const W=el.clientWidth||120, H=o.height||38, pad=4;
    const d=o.data, lo=Math.min.apply(null,d), hi=Math.max.apply(null,d);
    const xAt=i=> pad+(W-2*pad)*(i/(d.length-1));
    const yAt=v=> (H-pad)-((H-2*pad)*((v-lo)/((hi-lo)||1)));
    const pts=d.map((v,i)=>[xAt(i),yAt(v)]);
    const svg=document.createElementNS(NS,'svg'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    svg.setAttribute('width','100%'); svg.setAttribute('height',H); svg.style.display='block';
    const gid='sp'+Math.random().toString(36).slice(2);
    const defs=document.createElementNS(NS,'defs');
    defs.innerHTML=`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${o.color}" stop-opacity="0.28"/><stop offset="100%" stop-color="${o.color}" stop-opacity="0"/></linearGradient>`;
    svg.appendChild(defs);
    const dp=smoothPath(pts);
    const area=document.createElementNS(NS,'path'); area.setAttribute('d',dp+` L ${pts[pts.length-1][0]},${H} L ${pts[0][0]},${H} Z`);
    area.setAttribute('fill',`url(#${gid})`); svg.appendChild(area);
    const line=document.createElementNS(NS,'path'); line.setAttribute('d',dp); line.setAttribute('fill','none');
    line.setAttribute('stroke',o.color); line.setAttribute('stroke-width','2'); line.setAttribute('stroke-linecap','round'); svg.appendChild(line);
    const last=pts[pts.length-1];
    const c=document.createElementNS(NS,'circle'); c.setAttribute('cx',last[0]); c.setAttribute('cy',last[1]); c.setAttribute('r','3.2');
    c.setAttribute('fill',o.color); c.style.filter=`drop-shadow(0 0 5px ${o.color})`; svg.appendChild(c);
    try{ const L=line.getTotalLength(); line.style.strokeDasharray=L; line.style.strokeDashoffset=L;
      requestAnimationFrame(()=>{ line.style.transition='stroke-dashoffset 1s ease'; line.style.strokeDashoffset=0; });
      setTimeout(()=>{ line.style.transition='none'; line.style.strokeDasharray='none'; line.style.strokeDashoffset=0; }, 1200);
    }catch(e){}
    el.appendChild(svg);
  }

  /* ---------- carousel ---------- */
  function carousel(root){
    if (root.__done) return; root.__done=true;
    const track=root.querySelector('.acx-track');
    const slides=Array.from(track.children);
    const tabsWrap=root.querySelector('.acx-tabs');
    const dotsWrap=root.querySelector('.acx-dots');
    let idx=0;
    const tabs = tabsWrap? Array.from(tabsWrap.children):[];
    const dots = dotsWrap? Array.from(dotsWrap.children):[];
    function go(i){ idx=(i+slides.length)%slides.length; track.style.transform=`translateX(${-idx*100}%)`;
      tabs.forEach((t,k)=>t.classList.toggle('on',k===idx));
      dots.forEach((d,k)=>d.classList.toggle('on',k===idx));
      // init charts inside the now-visible slide
      AC.init(slides[idx]);
    }
    tabs.forEach((t,k)=>t.addEventListener('click',()=>go(k)));
    dots.forEach((d,k)=>d.addEventListener('click',()=>go(k)));
    const prev=root.querySelector('[data-arr="prev"]'), next=root.querySelector('[data-arr="next"]');
    if(prev) prev.addEventListener('click',()=>go(idx-1));
    if(next) next.addEventListener('click',()=>go(idx+1));
    go(0);
  }

  /* ---------- init scan ---------- */
  function init(root){
    injectCSS();
    root = root||document;
    root.querySelectorAll('[data-count]').forEach(el=>{ if(!el.closest('.ctr')) countUp(el); });
    root.querySelectorAll('[data-radial]').forEach(el=>{ const k=el.getAttribute('data-radial'); if(AC.RADIAL[k]) radial(el,AC.RADIAL[k]); });
    root.querySelectorAll('[data-area]').forEach(el=>{ const k=el.getAttribute('data-area'); if(AC.CHART[k]) areaChart(el,AC.CHART[k]); });
    root.querySelectorAll('[data-spark]').forEach(el=>{ const k=el.getAttribute('data-spark'); if(AC.SPARK[k]) sparkline(el,AC.SPARK[k]); });
    root.querySelectorAll('.acx-carousel').forEach(el=>carousel(el));
  }

  window.AC = { init, countUp, radial, areaChart, sparkline, carousel, T,
    RADIAL:{}, CHART:{}, SPARK:{} };
})();
