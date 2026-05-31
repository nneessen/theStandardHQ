// Shared, real data lifted from the current dashboard screenshots.
window.DASH = {
  period: 'May 2026',
  dayLabel: 'Day 30 of 31',
  day: 30, days: 31, elapsed: 97,
  user: { name: 'Nick Neessen', handle: 'nickneessen', org: 'FFG · FFG-ST', role: 'Own IMO', initials: 'NN' },

  nav: {
    MAIN: [['Command Center','sparkle'], ['Dashboard','home',true], ['Analytics','trend'], ['Targets','target'], ['Reports','bars']],
    BUSINESS: [['Policies','doc'], ['Expenses','card'], ['Team','people']],
    GROWTH: [['Recruiting','addperson'], ['Leaderboard','trophy'], ['Lead Vendors','store'], ['Marketing','mega']],
    CONNECT: [['Messages','mail']],
    TOOLS: [['UW Wizard','shield'], ['UW Admin','badge'], ['Chat Bot','bot']],
  },

  kpis: [
    { key:'premium',    label:'Premium',     value:'$2K',   pct:5,  sub:'5% of $34K target',  target:'$34K' },
    { key:'commissions',label:'Commissions', value:'$945',  pct:8,  sub:'8% of $12K target',  target:'$12K' },
    { key:'policies',   label:'Policies',    value:'1',     pct:6,  sub:'1 of 17 target',     target:'17' },
    { key:'pipeline',   label:'Pipeline',    value:'$0',    pct:0,  sub:'current pending',    target:'—' },
  ],

  pace: [
    { label:'Commissions', pct:8, note:'$945', of:'8% of $12K' },
    { label:'Policies',    pct:6, note:'1',    of:'6% of 17' },
  ],

  alerts: [
    { sev:'warn', title:'No Commissions Month to Date', desc:'No commission earned in this mtd period' },
    { sev:'crit', title:'High Lapse Rate (Month to Date)', desc:'100.0% of mtd policies lapsed' },
    { sev:'info', title:'Get Started', desc:'Add your first policy' },
    { sev:'crit', title:'1 chargeback', desc:'$630 clawed back this period' },
  ],

  financial: [ ['Profit Margin','100.0%','up'], ['Recurring Expenses','$0'], ['One-Time Expenses','$0'], ['Tax Deductible','$0'] ],
  policyHealth: [ ['Active Policies','0'], ['Retention Rate','0.0%','down'], ['Cancelled','0'], ['Lapsed','1'], ['Lapse Rate','100.0%','down'] ],
  clients: [ ['Total Clients','2'], ['Policies/Client','1.00','up'], ['Avg Client Value','$1,800'] ],

  imo: { name:'Founders Financial G…', agencies:1, agents:1,
    rows:[ ['Active Policies','0'],['Annual Premium','$0'],['Commissions','$630'],['Earned','$0'],['Unearned','$1,575'],['Avg/Agent','$0 premium'] ] },
  overrides: { count:0, total:'$0',
    rows:[ ['Pending','$0'],['Earned','$0'],['Paid','$0'],['Uplines','0 receiving'],['Downlines','0 generating'],['Avg/Policy','$0'] ] },
  production: [ { rank:1, name:'The Standard', who:'Nick Neessen · 2 agents', value:'$0', pct:'0.0%' } ],
};
