/* ============================================================
   The Standard HQ — Analytics panel library  (window.P)
   Each builder returns an HTML string in the Board language.
   Charts/counters hook in via data-* attrs + AC.init().
   ============================================================ */
(function () {
  const D = window.DATA, K = window.K;
  const comma = n => Number(n).toLocaleString('en-US');
  const RV = '<div class="rivets"><span></span><span></span><span></span><span></span></div>';

  const ICON = {
    clock:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    push:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    warn:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>',
    up:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  };

  function panel(inner, cls, style){ return `<div class="panel ${cls||''}" style="${style||''}">${RV}${inner}</div>`; }

  // ---------- HEADER ----------
  P_header(); function P_header(){}
  const P = {};

  P.header = (desc) => `
    <header style="display:flex; align-items:flex-end; justify-content:space-between; gap:28px; margin-bottom:30px; flex-wrap:wrap;">
      <div>
        <div class="eyebrow">${ICON.up.replace('20','15').replace('20','15')} Performance
          <span class="pill blue" style="margin-left:4px; padding:5px 10px; font-size:10px;"><span class="dot" style="background:var(--blue)"></span>Preview · Sample Data</span>
        </div>
        <h1 style="font:800 60px/0.95 var(--disp); letter-spacing:-.01em; text-transform:uppercase; margin:14px 0 10px; color:var(--ink);">Analytics</h1>
        <p style="font:500 18px/1.4 var(--body); color:var(--mut); margin:0;">${desc}</p>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="display:flex; gap:3px; padding:5px; border-radius:13px; background:var(--panel); border:1px solid var(--line2);">
          ${['MTD','YTD','30D','60D','90D','12M'].map((s,i)=>`<button style="font:700 13px var(--mono); letter-spacing:.05em; padding:9px 14px; border-radius:9px; border:none; cursor:pointer; ${i===0?'background:rgba(91,155,255,0.14); color:var(--blue); box-shadow:inset 0 0 0 1px rgba(91,155,255,0.35);':'background:transparent; color:var(--mut);'}">${s}</button>`).join('')}
        </div>
        <button style="display:inline-flex; align-items:center; gap:9px; font:700 14px var(--disp); color:var(--ink); padding:12px 18px; border-radius:11px; cursor:pointer; background:linear-gradient(180deg,var(--panel2),var(--panel)); border:1px solid var(--line2);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6"/></svg>Export
        </button>
      </div>
    </header>`;

  // ---------- HERO VERDICT BAND ----------
  P.heroBand = () => {
    const stats = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; min-width:330px;">
        <div class="flap"><div class="k">MTD Written</div><div class="v sm" data-count="${D.mtd}" data-prefix="$">$0</div></div>
        <div class="flap"><div class="k">Monthly Goal</div><div class="v sm" data-count="${D.monthGoal}" data-prefix="$">$0</div></div>
        <div class="flap"><div class="k">Gap to Goal</div><div class="v sm red" data-count="${D.gap}" data-prefix="$">$0</div></div>
        <div class="flap"><div class="k">Need / Day</div><div class="v sm blue" data-count="${D.needDay}" data-prefix="$">$0</div></div>
      </div>`;
    const inner = `
      <div style="display:flex; align-items:center; gap:40px; flex-wrap:wrap;">
        <div data-radial="monthGoal"></div>
        <div style="flex:1; min-width:300px;">
          <div class="eyebrow" style="margin-bottom:14px;">Departure Status · ${D.month}</div>
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <div class="num-xl lit" data-count="${D.projected}" data-prefix="$">$0</div>
            <span class="pill amber" style="font-size:13px;"><span class="dot"></span>Projected · ${D.pctProjected}%</span>
          </div>
          <div class="p-title" style="margin-top:10px;">Projected AP at current pace</div>
          <p style="font:500 18px/1.5 var(--body); color:var(--mut); margin:18px 0 0; max-width:520px;">
            Behind the board's pace — <b style="color:var(--red); font-weight:700;">$${comma(D.projDeficit)} short</b> of the
            <b style="color:var(--ink);">$34K</b> target at close. <b style="color:var(--ink);">${D.daysLeft} days</b> left to make it up.</p>
        </div>
        ${stats}
      </div>`;
    return `<div class="panel" style="background:radial-gradient(130% 180% at 0% 0%, rgba(91,155,255,0.12), rgba(91,155,255,0.01)), linear-gradient(180deg,var(--panel2),var(--panel)); border-color:rgba(91,155,255,0.28); margin-bottom:24px;">${RV}${inner}</div>`;
  };

  // compact pace tile (bento)
  P.paceTile = () => {
    const inner = `
      <div class="p-head"><div><p class="p-title">Pace Metrics</p><p class="p-sub dim">${D.month} · ${D.daysLeft}d left</p></div>
        <span class="pill amber"><span class="dot"></span>Behind</span></div>
      <div style="display:flex; align-items:center; gap:26px; flex-wrap:wrap;">
        <div data-radial="monthGoalSm"></div>
        <div style="flex:1; min-width:160px; display:grid; gap:12px;">
          <div class="flap"><div class="k">Projected AP</div><div class="v sm" data-count="${D.projected}" data-prefix="$">$0</div></div>
          <div class="flap"><div class="k">Gap to Goal</div><div class="v sm red" data-count="${D.gap}" data-prefix="$">$0</div></div>
          <div class="flap"><div class="k">Need / Day</div><div class="v sm blue" data-count="${D.needDay}" data-prefix="$">$0</div></div>
        </div>
      </div>`;
    return panel(inner);
  };

  // ---------- ACTION FEED ----------
  const moveRow = (m,last)=>`
    <div style="display:flex; align-items:center; gap:16px; padding:17px 0; ${last?'':'border-bottom:1px solid var(--line);'}">
      <span style="width:9px; height:9px; border-radius:50%; background:var(--${m[3]}); box-shadow:0 0 8px var(--${m[3]}); flex-shrink:0;"></span>
      <div style="flex:1; min-width:0;">
        <div style="font:800 16px var(--disp); color:var(--ink);">${m[0]}</div>
        <div style="font:500 14px var(--body); color:var(--mut); margin-top:3px;">${m[1]}</div>
      </div>
      <span class="pill ${m[3]}">${m[2]==='High'?'Act Now':'Monitor'}</span>
    </div>`;
  P.actionFeed = () => {
    const scen = `
      <div class="divline"></div>
      <p class="p-title" style="margin-bottom:14px;">What-If Scenarios</p>
      <table><thead><tr><th style="text-align:left;">Scenario</th><th>Projected</th><th>Goal %</th></tr></thead><tbody>
      ${D.scenarios.map(s=>`<tr><td style="text-align:left; color:var(--ink); font-weight:700;">${s[0]}</td><td>$${comma(s[1])}</td><td class="${s[3]}">${s[2]}%</td></tr>`).join('')}
      </tbody></table>`;
    const inner = `
      <div class="p-head"><div><p class="p-title">Smart Moves · Flags</p><p class="p-sub dim">What to do about it</p></div>
        <span class="p-right"><span class="big" style="color:var(--amber);">${D.smartMoves.length.toString().padStart(2,'0')}</span></span></div>
      ${D.smartMoves.map((m,i)=>moveRow(m,i===D.smartMoves.length-1)).join('')}
      ${scen}`;
    return panel(inner);
  };

  // recommended-actions carousel (Option C)
  P.actionsCarousel = () => {
    const slide = (m,i)=>`
      <div class="acx-slide"><div style="padding:6px 6px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:14px;">
          <span class="eyebrow">Move ${String(i+1).padStart(2,'0')} / ${String(D.smartMoves.length).padStart(2,'0')}</span>
          <span class="pill ${m[3]}"><span class="dot"></span>${m[2]} Priority</span>
        </div>
        <div style="font:800 30px/1.1 var(--disp); color:var(--ink); margin:18px 0 12px;">${m[0]}</div>
        <p style="font:500 17px/1.5 var(--body); color:var(--mut); margin:0 0 22px; max-width:520px;">${m[1]}</p>
        <button style="display:inline-flex; align-items:center; gap:10px; font:700 13px var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--blue); padding:12px 18px; border-radius:11px; cursor:pointer; background:rgba(91,155,255,0.12); border:1px solid rgba(91,155,255,0.35);">Take action ${ICON.up.replace(/20/g,'15')}</button>
      </div></div>`;
    const inner = `
      <div class="p-head"><div><p class="p-title">Recommended Actions</p><p class="p-sub dim">Swipe through your priorities</p></div></div>
      <div class="acx-carousel" style="min-height:230px;">
        <div class="acx-vp"><div class="acx-track">${D.smartMoves.map(slide).join('')}</div></div>
        <div class="acx-nav">
          <div class="acx-dots">${D.smartMoves.map(()=>'<button class="acx-dot"></button>').join('')}</div>
          <div class="acx-arrows">
            <button class="acx-arr" data-arr="prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg></button>
            <button class="acx-arr" data-arr="next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>
          </div>
        </div>
      </div>`;
    return panel(inner);
  };

  // ---------- CHARTS ----------
  P.trendBody = (key) => `
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:22px;">
      <div class="flap"><div class="k" style="color:var(--green)">Active</div><div class="v" data-count="${D.active}">0</div></div>
      <div class="flap"><div class="k" style="color:var(--amber)">Lapsed</div><div class="v" data-count="${D.lapsed}">0</div></div>
      <div class="flap"><div class="k" style="color:var(--red)">Cancelled</div><div class="v" data-count="${D.cancelled}">0</div></div>
    </div>
    <div data-area="${key||'trend'}"></div>
    <div class="legend"><span><i style="background:var(--green)"></i>Active policies</span><span><i style="background:var(--amber)"></i>Lapsed</span></div>`;
  P.trendPanel = (key) => panel(`<div class="p-head"><div><p class="p-title">Policy Status · 12-Month Trend</p><p class="p-sub dim">Active vs lapsed retention</p></div>
    <span class="p-right"><span class="big" data-count="${D.active}">0</span><span class="lbl">active</span></span></div>${P.trendBody(key)}`);

  P.growthBody = (key) => `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px;">
      <div class="flap"><div class="k">Next 3 Mo · Renewals</div><div class="v sm" data-count="${D.renewals3mo}">0</div></div>
      <div class="flap"><div class="k">Est. Renewal Revenue</div><div class="v sm green" data-count="${D.renewalRev}" data-prefix="$">$0</div></div>
    </div>
    <div data-area="${key||'growth'}"></div>
    <div class="legend"><span><i style="background:var(--green)"></i>High</span><span><i style="background:var(--amber)"></i>Medium</span><span><i style="background:var(--red)"></i>Low confidence</span><span style="color:var(--blue)"><i style="background:var(--blue)"></i>$34K goal</span></div>`;
  P.growthPanel = (key) => panel(`<div class="p-head"><div><p class="p-title">Predictive Analytics</p><p class="p-sub dim">Growth forecast &amp; renewals</p></div>
    <span class="p-right"><span class="big" style="color:var(--green); display:inline-flex; align-items:center; gap:7px;">${ICON.up}<span data-count="${D.growth}" data-suffix="%" data-decimals="1">0%</span></span><span class="lbl">projected growth</span></span></div>${P.growthBody(key)}`);

  // ---------- AGENTS ----------
  P.agentsBody = () => `
    <table><thead><tr><th style="width:30px;">#</th><th style="text-align:left;">Agent</th><th>Policies</th><th>AP</th><th>IP</th></tr></thead><tbody>
    ${D.agents.map((a,i)=>`<tr><td class="rank">${i+1}</td><td style="text-align:left;"><span class="agent">${a[0]}</span></td><td>${a[1]}</td><td>$${comma(a[2])}</td><td>$${comma(a[3])}</td></tr>`).join('')}
    </tbody></table>
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:20px;">
      <div class="flap"><div class="k">Total Policies</div><div class="v sm" data-count="${D.totalPolicies}">0</div></div>
      <div class="flap"><div class="k">Total AP</div><div class="v sm" data-count="${D.totalAgentAP}" data-prefix="$">$0</div></div>
      <div class="flap"><div class="k">Total IP</div><div class="v sm green" data-count="${D.totalIP}" data-prefix="$">$0</div></div>
    </div>`;
  P.agentsPanel = () => panel(`<div class="p-head"><div><p class="p-title">Agent Performance</p><p class="p-sub dim">${D.agentCount} agents · top 10 shown</p></div>
    <span class="p-right"><span class="big" style="font-size:24px;">Hayes Crockett</span><span class="lbl">top performer</span></span></div>${P.agentsBody()}`);

  // ---------- FUNNEL ----------
  P.funnelBody = () => {
    const rows=[['Leads Purchased',D.leads,100,'blue'],['Applications',D.applications,44,'amber'],['Approved',D.approved,32,'amber'],['Active',D.activeF,27,'green']];
    return `${rows.map(r=>`
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px;">
          <span style="font:600 15px var(--body); color:var(--ink);">${r[0]}</span>
          <span style="font:800 18px var(--disp); color:var(--cream); font-variant-numeric:tabular-nums;" data-count="${r[1]}">0</span>
        </div>
        <div class="bar ${r[3]}"><i style="width:${r[2]}%;"></i></div>
      </div>`).join('')}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:24px;">
        <div class="flap"><div class="k">Lead → Active</div><div class="v sm green" data-count="${D.leadToActive}" data-suffix="%" data-decimals="1">0%</div></div>
        <div class="flap"><div class="k">Avg Close Time</div><div class="v sm" data-count="${D.avgClose}" data-suffix="d" data-decimals="1">0d</div></div>
      </div>`;
  };
  P.funnelPanel = () => panel(`<div class="p-head"><div><p class="p-title">Conversion Funnel</p><p class="p-sub dim">Lead-to-policy pipeline</p></div></div>${P.funnelBody()}`);

  // ---------- SEGMENTS ----------
  P.segmentsPanel = () => panel(`<div class="p-head"><div><p class="p-title">Client Segments</p><p class="p-sub dim">Value tiers &amp; mix</p></div>
    <span class="p-right"><span class="big" data-count="${D.bookPremium}" data-prefix="$">$0</span><span class="lbl">total AP</span></span></div>
    <table><thead><tr><th>Tier</th><th>Clients</th><th>Total AP</th><th>Avg AP</th><th>Mix %</th></tr></thead><tbody>
    ${D.segments.map(s=>`<tr><td class="${s[5]}" style="font:800 15px var(--disp);">${s[0]}</td><td>${s[1]}</td><td>${K(s[2])}</td><td>$${comma(s[3])}</td><td class="${s[5]}">${s[4]}.0%</td></tr>`).join('')}
    </tbody></table>`);

  // ---------- PIPELINE ----------
  P.pipelinePanel = () => panel(`<div class="p-head"><div><p class="p-title">Commission Pipeline</p><p class="p-sub dim">Cash flow forecast</p></div></div>
    <p class="p-title">Total Pending</p><div class="num-lg" style="margin:12px 0 8px;" data-count="${D.pendingComm}" data-prefix="$">$0</div>
    <p class="meta">Quarterly projection · <b data-count="${D.quarterly}" data-prefix="$">$0</b></p>
    <div class="divline"></div>
    ${[['Next 30 days',D.comm30],['Next 60 days',D.comm60],['Next 90 days',D.comm90]].map(r=>`
      <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 0; border-bottom:1px solid var(--line);">
        <span style="display:flex; align-items:center; gap:13px; font:600 16px var(--body); color:var(--ink);"><span style="color:var(--mut)">${ICON.clock}</span>${r[0]}</span>
        <span style="font:800 18px var(--disp); color:var(--green); font-variant-numeric:tabular-nums;" data-count="${r[1]}" data-prefix="$">$0</span>
      </div>`).join('')}
    <p class="note green" style="margin-top:18px;">Healthy pipeline · ${Math.round(D.pendingComm/D.quarterly*100)}% of quarterly target booked</p>`);

  // ---------- PRODUCT MIX ----------
  P.productsPanel = () => panel(`<div class="p-head"><div><p class="p-title">Product Mix</p><p class="p-sub dim">${D.products} products in book</p></div></div>
    ${D.productMix.map(p=>`<div style="margin-bottom:18px;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font:600 15px var(--body); color:var(--ink);">${p[0]}</span><span style="font:700 15px var(--mono); color:var(--cream);">${p[1]}%</span></div>
      <div class="bar"><i style="width:${p[1]}%; background:var(--${p[2]}); box-shadow:0 0 10px var(--${p[2]});"></i></div></div>`).join('')}`);

  // ---------- STATES ----------
  P.statesPanel = () => panel(`<div class="p-head"><div><p class="p-title">Premium by State</p><p class="p-sub dim">Top ${D.states.length} states by AP</p></div>
    <span class="p-right"><span class="big" data-count="${D.bookPremium}" data-prefix="$">$0</span><span class="lbl">total premium</span></span></div>
    ${D.states.map(s=>`<div style="margin-bottom:16px;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font:700 15px var(--disp); color:var(--ink); letter-spacing:.04em;">${s[0]}</span><span style="font:700 15px var(--mono); color:var(--cream);">${K(s[1])}</span></div>
      <div class="bar"><i style="width:${s[2]*3.4}%;"></i></div></div>`).join('')}`);

  // ---------- SPARK TRENDS ----------
  const sc=(lab,val,delta,spark,pos)=>`
    <div class="sparkcard"><div class="top"><span class="lab">${lab}</span>
      <span class="pill ${pos?'green':'red'}" style="padding:5px 9px; font-size:11px;">${pos?'▲':'▼'} ${delta}</span></div>
      <div class="mid"><span class="v">${val}</span><div class="spark" data-spark="${spark}"></div></div></div>`;
  P.sparkTrends = () => panel(`<div class="p-head"><div><p class="p-title">Trend Comparison</p><p class="p-sub dim">vs prior period</p></div>
    <span class="p-right"><span class="big" style="color:var(--green); display:inline-flex; align-items:center; gap:7px;">${ICON.up}+21%</span><span class="lbl">AP change</span></span></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      ${sc('Policies Written','58','41%','policies',true)}
      ${sc('AP Written','$19.6K','21%','ap',true)}
      ${sc('Commissions','$5.3K','29%','commissions',true)}
      ${sc('Avg Premium','$818','3%','avgprem',true)}
      ${sc('Active Policies','312','5%','activep',true)}
      ${sc('Pipeline','$18.2K','14%','pipeline',true)}
    </div>`);

  // ---------- KPI RAIL ----------
  P.kpiRail = () => {
    const t=(k,val,pre,suf,dec,delta,pos)=>`<div class="flap" style="flex:1; min-width:150px;">
      <div class="k">${k}</div>
      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:8px;">
        <div class="v sm" data-count="${val}" ${pre?`data-prefix="${pre}"`:''} ${suf?`data-suffix="${suf}"`:''} ${dec?`data-decimals="${dec}"`:''}>${pre||''}0${suf||''}</div>
        <span class="pill ${pos?'green':'red'}" style="padding:4px 8px; font-size:10px;">${pos?'▲':'▼'}${delta}</span>
      </div></div>`;
    return `<div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:24px;">
      ${t('Premium MTD',D.mtd,'$','',0,'21%',true)}
      ${t('Active Policies',D.active,'','',0,'5%',true)}
      ${t('Pending Comm.',D.pendingComm,'$','',0,'14%',true)}
      ${t('Book Premium',D.bookPremium,'$','',0,'8%',true)}
      ${t('Growth',D.growth,'','%',1,'2.1%',true)}
      ${t('Avg Premium',D.avgAP,'$','',0,'3%',true)}
    </div>`;
  };

  // ---------- CHARTS CAROUSEL (Option C) ----------
  P.chartsCarousel = () => {
    const tabs=['Trend','Growth','Funnel','Agents'];
    const slides=[
      `<div class="acx-slide"><div style="padding:4px;">${P.trendBody('trendWide')}</div></div>`,
      `<div class="acx-slide"><div style="padding:4px;">${P.growthBody('growthWide')}</div></div>`,
      `<div class="acx-slide"><div style="padding:4px;">${P.funnelBody()}</div></div>`,
      `<div class="acx-slide"><div style="padding:4px;">${P.agentsBody()}</div></div>`,
    ];
    const inner=`
      <div class="p-head" style="align-items:center;"><div><p class="p-title">Insights</p><p class="p-sub dim">One stage · swap the view</p></div>
        <div class="acx-tabs">${tabs.map((t,i)=>`<button class="acx-tab ${i===0?'on':''}">${t}</button>`).join('')}</div></div>
      <div class="acx-carousel">
        <div class="acx-vp"><div class="acx-track">${slides.join('')}</div></div>
        <div class="acx-nav">
          <div class="acx-dots">${tabs.map(()=>'<button class="acx-dot"></button>').join('')}</div>
          <div class="acx-arrows">
            <button class="acx-arr" data-arr="prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg></button>
            <button class="acx-arr" data-arr="next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>
          </div>
        </div>
      </div>`;
    return panel(inner);
  };

  P.footer = () => `<p style="text-align:center; font:600 14px var(--mono); letter-spacing:.06em; color:var(--mut2); margin-top:40px;">Real-time calculations · Auto-refresh on data changes · Sample data shown for preview</p>`;

  window.P = P;
})();
