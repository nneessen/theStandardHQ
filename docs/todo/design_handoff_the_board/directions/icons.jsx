// Minimal stroke icon set shared across directions. Lucide-ish line icons.
(function () {
  const P = {
    sparkle: 'M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z',
    home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
    trend: 'M4 16l5-5 4 3 7-8M16 6h4v4',
    target: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12h.01',
    bars: 'M5 20V10M12 20V4M19 20v-7',
    doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
    card: 'M3 7h18v11H3zM3 11h18',
    people: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.5-5 5-5s5 2 5 5M16 11a3 3 0 1 0 0-6M21 20c0-3-1.6-4.6-4-5',
    addperson: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6',
    trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 18h6M10 14v4M14 14v4',
    store: 'M4 9l1-4h14l1 4M4 9v11h16V9M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0',
    mega: 'M4 10v4h3l8 5V5l-8 5H4zM18 9a3 3 0 0 1 0 6',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    shield: 'M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z',
    badge: 'M12 3l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-1 2.5-2.7-.2L12 21l-2.2-1.6-2.7.2-1-2.5L3.8 16l.8-2.6L3.8 11l2.3-1.4 1-2.5 2.7.2z',
    bot: 'M9 3v3M15 3v3M6 8h12v9H6zM3 12h3M18 12h3M10 13v1M14 13v1',
    bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 21h4',
    leaderboard: 'M5 21V9h4v12M10 21V3h4v18M15 21v-8h4v8M3 21h18',
    expense: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    plus: 'M12 5v14M5 12h14',
    chev: 'M9 6l6 6-6 6',
    warn: 'M12 3l9 16H3zM12 9v5M12 17v.5',
    crit: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v5M12 16v.5',
    info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v5M12 8v.5',
    flame: 'M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8 1.5-3.5C9 10 10 8 10 8c.5 1.5 2 2 2 2 .5-1.5 0-3 0-4z',
    arrowUp: 'M12 19V5M6 11l6-6 6 6',
    arrowDown: 'M12 5v14M6 13l6 6 6-6',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    chat: 'M4 5h16v11H9l-4 4v-4H4zM8 10h.5M12 10h.5M16 10h.5',
    docplus: 'M6 3h8l4 4v14H6zM14 3v4h4M9 14h6M12 11v6',
    send: 'M22 2L2 9l8 3 3 8zM10 12l6-6',
    receipt: 'M5 3h14v18l-2.5-1.8-2 1.8-2-1.8-2 1.8-2-1.8L5 21zM9 8h6M9 12h5',
  };
  function Icon({ name, size = 18, sw = 1.6, fill = false, style }) {
    const d = P[name] || '';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
        strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
        {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
      </svg>
    );
  }
  window.Icon = Icon;
})();
