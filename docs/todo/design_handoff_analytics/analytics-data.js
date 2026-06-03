/* ============================================================
   The Standard HQ — Analytics sample data + chart definitions
   PREVIEW data only — for evaluating the redesign. Plugs into
   AC.RADIAL / AC.CHART / AC.SPARK registries.
   ============================================================ */
(function () {
  const T = AC.T;
  const k = v => '$' + (v/1000).toFixed(v%1000===0?0:1) + 'K';

  // ---- shared sample figures ----
  window.DATA = {
    month:'June 2026', daysElapsed:18, daysTotal:30, daysLeft:12,
    monthGoal:34000, mtd:19640, pctMonth:58, projected:32700, pctProjected:96, gap:14360, needDay:1197, projDeficit:1267,
    annualGoal:408000, ytd:214800, pctAnnual:53,
    active:312, lapsed:18, cancelled:6, policiesMTD:24, avgAP:818,
    carriers:7, products:9, bookPremium:214800,
    pendingComm:18240, comm30:7400, comm60:6100, comm90:4740, quarterly:22300,
    growth:12.4, renewals3mo:41, renewalRev:9360,
    leads:480, applications:212, approved:156, activeF:132, leadToActive:27.5, avgClose:9.4,
    agents:[
      ['Hayes Crockett',5,4090,16252],['James Schulze',4,3275,5545],['Devin Nilson',4,3120,4094],
      ['Dylan Kemple',1,820,3792],['Chase Cockrell',2,1640,3334],['Jake Houston',2,1580,3083],
      ['Kali Hamilton',1,910,2736],['Conrad Seaman',2,1490,2410],['Jackson Mayo',1,760,2136],['Romina Mikurak',1,705,2032],
    ],
    totalPolicies:27, totalAgentAP:19640, totalIP:49504, agentCount:84,
    segments:[['HIGH',38,128900,3392,60,'green'],['MED',96,64400,671,30,'amber'],['LOW',178,21500,121,10,'red']],
    states:[['TX',58000,27],['FL',41200,19],['GA',28600,13],['NC',22400,10],['OH',18100,8],['AZ',14900,7]],
    productMix:[['Term Life',42,'blue'],['Whole Life',23,'cyan'],['IUL',16,'green'],['Final Expense',12,'amber'],['Annuity',7,'red']],
    smartMoves:[
      ['Push for close','7 applications approved & awaiting first payment','High','red'],
      ['Reactivate 18 lapsed','$14.7K AP at risk this cycle','High','red'],
      ['Lean into Term Life','42% of mix, best close rate at 31%','Medium','amber'],
      ['Recruit pipeline thin','Only 3 prospects in onboarding','Medium','amber'],
    ],
    scenarios:[['Keep current pace',32700,96,'amber'],['Add 1 policy/week',37360,110,'green'],['Add 2 policies/week',42020,124,'green']],
  };
  const D = window.DATA;

  // ---- radial ----
  AC.RADIAL.monthGoal = { pct:D.pctMonth, color:T.blue, size:208, thickness:18, sub:'of monthly goal' };
  AC.RADIAL.monthGoalSm = { pct:D.pctMonth, color:T.blue, size:172, thickness:15, sub:'of goal' };
  AC.RADIAL.annual = { pct:D.pctAnnual, color:T.green, size:172, thickness:15, sub:'annual goal' };

  // ---- 12-month policy trend (active vs lapsed) ----
  AC.CHART.trend = {
    height:250, yTicks:4, skip:2,
    labels:['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'],
    series:[
      { name:'Active', color:T.green, fill:true, dots:false, data:[248,256,262,270,268,278,284,290,296,300,306,312] },
      { name:'Lapsed', color:T.amber, fill:false, dash:true, dots:false, data:[9,11,8,13,10,14,12,15,11,16,13,18] },
    ],
    yfmt:v=>Math.round(v),
  };

  // ---- growth projection (goal vs projection + confidence dots) ----
  (function(){
    const proj=[19.6,21.2,22.8,24.1,25.6,27.0,28.7,30.1,31.8,33.4,35.0,36.7];
    const dots=proj.map((_,i)=> i<4?T.green : i<8?T.amber : T.red);
    AC.CHART.growth = {
      height:250, yTicks:4, skip:2, min:0,
      labels:['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'],
      refY:34, refColor:T.blue,
      series:[
        { name:'Projected AP', color:T.blue, fill:true, dots:dots, data:proj },
      ],
      yfmt:v=>'$'+v.toFixed(0)+'K', tipfmt:v=>'$'+v.toFixed(1)+'K',
    };
  })();

  // compact trend used inside carousel / bento (same as trend)
  AC.CHART.trendWide = Object.assign({}, AC.CHART.trend, { height:300 });
  AC.CHART.growthWide = Object.assign({}, AC.CHART.growth, { height:300 });

  // ---- sparklines for trend-comparison cards ----
  AC.SPARK.policies   = { color:T.green, data:[41,44,43,48,46,52,50,55,58] };
  AC.SPARK.ap         = { color:T.green, data:[16.2,15.8,17.1,16.4,18.0,17.6,18.9,19.2,19.6] };
  AC.SPARK.commissions= { color:T.green, data:[4.1,3.9,4.4,4.2,4.8,4.6,5.0,5.2,5.3] };
  AC.SPARK.avgprem    = { color:T.blue,  data:[792,788,801,796,808,804,812,815,818] };
  AC.SPARK.activep    = { color:T.green, data:[298,300,301,304,303,307,309,310,312] };
  AC.SPARK.pipeline   = { color:T.amber, data:[12,15,13,17,16,18,17.4,18.2,18.24] };

  window.K = k;
})();
