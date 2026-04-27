<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DayTrack — Home A · Editorial Diary</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="daytrack.css">
<style>
  /* Variation A — diary-first home */
  .a-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}
  @media (max-width:1100px){ .a-grid{grid-template-columns:1fr} }

  .a-hero{padding:8px 0 18px;border-bottom:1px solid var(--line);margin-bottom:20px}
  .a-hero .eyebrow{font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .a-hero h1{font-family:var(--serif);font-size:42px;font-weight:500;letter-spacing:-.02em;line-height:1.05;margin:6px 0 8px;color:var(--ink)}
  .a-hero h1 .date{color:var(--ink-3);font-style:italic;font-weight:400}
  .a-hero .summary{font-family:var(--serif);font-size:16px;line-height:1.55;color:var(--ink-2);max-width:62ch}
  .a-hero .summary em{color:var(--ink);font-style:normal;font-weight:500;background:linear-gradient(transparent 60%, var(--tone-yellow-bg) 60%)}
  .a-hero .meta{display:flex;gap:18px;margin-top:14px;color:var(--ink-3);font-size:12px}
  .a-hero .meta b{color:var(--ink);font-weight:500}

  /* composer */
  .a-composer{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-4);padding:10px 12px;margin-bottom:18px;box-shadow:var(--sh-1)}
  .a-composer .row{gap:8px}
  .a-composer .input{flex:1;font-family:var(--sans);font-size:14px;color:var(--ink-3);padding:6px 4px;border:none;outline:none;background:transparent}
  .a-composer .types{display:flex;gap:4px}
  .a-composer .ck{font-size:11px;padding:2px 7px;border:1px solid var(--line);border-radius:99px;color:var(--ink-3);cursor:pointer;background:var(--bg-2)}
  .a-composer .ck:hover{background:var(--bg-3)}
  .a-composer .ck.on{background:var(--accent-bg);border-color:var(--accent-bd);color:var(--accent)}
  .a-composer .hint{font-family:var(--mono);font-size:10px;color:var(--ink-4);margin-top:4px}

  /* diary day groups */
  .day-h{display:flex;align-items:baseline;gap:10px;padding:18px 0 8px;border-top:1px solid var(--line);margin-top:8px}
  .day-h:first-child{border-top:none;padding-top:0}
  .day-h .dnum{font-family:var(--serif);font-size:30px;font-weight:500;letter-spacing:-.015em;color:var(--ink);line-height:1}
  .day-h .dlabel{font-family:var(--sans);font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .day-h .dsum{margin-left:auto;font-size:11.5px;color:var(--ink-3)}

  /* diary entry */
  .entry{display:grid;grid-template-columns:56px 22px 1fr;gap:10px;padding:7px 4px;border-radius:var(--r-2);position:relative}
  .entry:hover{background:var(--surface-2)}
  .entry .t{font-family:var(--mono);font-size:11px;color:var(--ink-4);padding-top:3px;text-align:right;letter-spacing:-.02em}
  .entry .gut{position:relative}
  .entry .gut::before{content:"";position:absolute;left:50%;top:0;bottom:-7px;width:1px;background:var(--line);transform:translateX(-50%)}
  .entry:last-child .gut::before{bottom:50%}
  .entry .gut .marker{position:absolute;left:50%;top:6px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-4);z-index:1}
  .entry.note     .gut .marker{background:var(--tone-yellow-bg); border-color:var(--tone-yellow-ink)}
  .entry.gate     .gut .marker{background:var(--tone-green-bg);  border-color:var(--tone-green-ink); border-width:2px}
  .entry.action   .gut .marker{background:var(--tone-orange-bg); border-color:var(--tone-orange-ink)}
  .entry.decision .gut .marker{background:var(--tone-purple-bg); border-color:var(--tone-purple-ink); border-width:2px}
  .entry.risk     .gut .marker{background:var(--tone-red-bg);    border-color:var(--tone-red-ink); border-width:2px}
  .entry.meeting  .gut .marker{background:var(--tone-blue-bg);   border-color:var(--tone-blue-ink)}
  .entry .body{padding:2px 0;min-width:0}
  .entry .body .kind{display:inline-block;font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-4);margin-right:6px;font-weight:600}
  .entry .body .text{color:var(--ink);font-size:13.5px;line-height:1.5}
  .entry .body .text .ref{font-family:var(--mono);font-size:11.5px;background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--ink-2);text-decoration:none}
  .entry .body .text .ref:hover{background:var(--accent-bg);color:var(--accent);border-color:var(--accent-bd);text-decoration:none}
  .entry .body .foot{margin-top:3px;display:flex;align-items:center;gap:8px;color:var(--ink-4);font-size:11px}
  .entry.gate .body .text, .entry.decision .body .text, .entry.risk .body .text{font-weight:500}

  /* day end summary */
  .day-end{display:flex;gap:14px;padding:8px 12px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-3);margin-top:6px;font-size:11.5px;color:var(--ink-3)}
  .day-end b{color:var(--ink)}

  /* RIGHT RAIL */
  .rail{display:flex;flex-direction:column;gap:14px;position:sticky;top:64px}
  .rail .panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-4);box-shadow:var(--sh-1)}
  .rail .panel .ph{display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid var(--line)}
  .rail .panel .ph h4{margin:0;font-size:12px;font-weight:600;letter-spacing:.01em}
  .rail .panel .ph .ct{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-4);background:var(--bg-2);padding:1px 6px;border-radius:4px}
  .rail .panel .pb{padding:6px 8px}

  .miniact{display:flex;align-items:flex-start;gap:8px;padding:6px 6px;border-radius:var(--r-2);cursor:pointer;font-size:12.5px}
  .miniact:hover{background:var(--bg-2)}
  .miniact .chk{width:14px;height:14px;border:1.5px solid var(--ink-5);border-radius:3px;flex:0 0 auto;margin-top:2px}
  .miniact.late .chk{border-color:var(--tone-red-bd)}
  .miniact .ti{color:var(--ink);line-height:1.35;font-weight:500}
  .miniact .meta{display:flex;align-items:center;gap:5px;margin-top:2px;color:var(--ink-3);font-size:11px}
  .miniact .due{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
  .miniact.late .due{color:var(--tone-red-ink);font-weight:600}

  /* heatmap */
  .heat{display:flex;gap:3px;padding:8px 12px}
  .heat .col{display:flex;flex-direction:column;gap:3px}
  .heat .cell{width:11px;height:11px;border-radius:2px;background:var(--bg-3)}
  .heat .cell.l1{background:#dde8f7}
  .heat .cell.l2{background:#b5cff7}
  .heat .cell.l3{background:#7faeee}
  .heat .cell.l4{background:#1f6feb}
  .heat-foot{display:flex;align-items:center;gap:8px;padding:0 12px 8px;font-size:10.5px;color:var(--ink-4)}
  .heat-foot .leg{display:flex;gap:2px}
  .heat-foot .leg span{width:9px;height:9px;border-radius:2px}

  /* mini cal */
  .cal{padding:8px 12px}
  .cal .ch{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-2);font-weight:600;margin-bottom:6px}
  .cal .ch span{font-family:var(--serif);font-weight:500;font-size:13px}
  .cal .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-family:var(--mono);font-size:10px;text-align:center}
  .cal .grid .dn{color:var(--ink-4);padding:2px 0}
  .cal .grid .d{padding:4px 0;border-radius:4px;color:var(--ink-2);position:relative}
  .cal .grid .d.dim{color:var(--ink-5)}
  .cal .grid .d.has::after{content:"";position:absolute;left:50%;bottom:1px;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--accent)}
  .cal .grid .d.today{background:var(--accent);color:#fff;font-weight:700}
  .cal .grid .d.weekend{color:var(--ink-4)}

  /* recent refs cloud */
  .cloud{display:flex;flex-wrap:wrap;gap:5px;padding:8px 12px}
  .cloud .ref{font-family:var(--mono);font-size:11px;background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--ink-2);text-decoration:none}
  .cloud .ref .ct{color:var(--ink-4);margin-left:3px;font-size:10px}
  .cloud .ref:hover{background:var(--accent-bg);border-color:var(--accent-bd);color:var(--accent)}

  /* footer */
  .foot-bar{display:flex;align-items:center;gap:8px;padding:14px 0 6px;color:var(--ink-3);font-size:11.5px;border-top:1px solid var(--line);margin-top:24px}
</style>
</head>
<body>
<div id="dt-shell" data-active="home"></div>

<script src="daytrack-data.js"></script>
<script src="daytrack-shell.js"></script>
<script>
  DT_Shell.mount({ crumbs:['DayTrack', DT_DATA.project.name, 'Today'] });
  const D = DT_DATA;
  const root = document.getElementById('dt-content');

  // group entries by day — we only have today; for variety, include yesterday & prior day stubs
  const yest = [
    { t:'17:30', type:'gate',    text:'#TNK-12 tank moved Design → Procurement.', who:'mr' },
    { t:'15:14', type:'action',  text:'Closed: signed off CIV-013 plinth drawing.', who:'me' },
    { t:'11:00', type:'meeting', text:'Vendor call · Outotec · 45 min · 2 actions',  who:'jt' },
    { t:'09:20', type:'note',    text:'Drone footage of #SAG-mill area — saved to library.', who:'ai' },
  ];
  const day2 = [
    { t:'16:42', type:'decision',text:'Decided: stick with concrete spec C40 for plinth.', who:'jt' },
    { t:'14:00', type:'risk',    text:'Risk closed: AQ permit variation accepted by regulator.', who:'jt' },
    { t:'10:05', type:'note',    text:'Photos of rebar — flag possible cover issue, see #CIV-014.', who:'ai' },
  ];

  function entry(e){
    return `
      <div class="entry ${e.type}">
        <div class="t">${e.t}</div>
        <div class="gut"><span class="marker"></span></div>
        <div class="body">
          <div class="text"><span class="kind">${e.type}</span>${D.hilite(e.text)}</div>
          <div class="foot">${D.avatar(e.who,'sm')}<span>${D.p(e.who).name}</span></div>
        </div>
      </div>`;
  }

  function dayBlock(label, dnum, summary, entries, end){
    return `
      <div class="day-h">
        <div class="dnum">${dnum}</div>
        <div>
          <div class="dlabel">${label}</div>
        </div>
        <div class="dsum">${summary}</div>
      </div>
      <div>${entries.map(entry).join('')}</div>
      ${end ? `<div class="day-end">${end}</div>` : ''}
    `;
  }

  // Hero summary — narrative paragraph derived from today's events
  const hero = `
    <div class="a-hero">
      <div class="eyebrow">Wednesday · 12 Mar 2026</div>
      <h1>Good morning. <span class="date">Eleven entries so far —</span> mostly the SAG-mill.</h1>
      <p class="summary">A <em>gearbox vendor decision</em> needs your sign-off today; <em>P&amp;ID rev D</em> is in for review by Friday; HV switchgear delivery slipped <em>five weeks</em> and is now your top open risk. Site walk with Aisha is booked for Thursday at 09:00.</p>
      <div class="meta">
        <span><b>${D.project.name}</b> · ${D.project.phase}</span>
        <span><b>42%</b> overall</span>
        <span><b>38</b> days to FEL3 gate</span>
        <span><b>£3.4M</b> of £8.2M spent</span>
      </div>
    </div>`;

  const composer = `
    <div class="a-composer">
      <div class="row">
        <input class="input" placeholder="Log something — start with /note, /todo, /done, /decision, /risk, /call…" />
        <div class="types">
          <span class="ck on">note</span>
          <span class="ck">todo</span>
          <span class="ck">done</span>
          <span class="ck">decision</span>
          <span class="ck">risk</span>
          <span class="ck">call</span>
        </div>
        <button class="btn primary sm">Log <kbd style="margin-left:4px;background:rgba(255,255,255,.2);border-color:transparent;color:#fff">↵</kbd></button>
      </div>
      <div class="hint">Tip — type <b>#</b> to link an item, <b>@</b> to mention a person, <b>$</b> to attach money.</div>
    </div>`;

  const todaySummary = `
    <span><b>${D.today.length}</b> entries</span> ·
    <span>${D.today.filter(e=>e.type==='note').length} notes</span> ·
    <span>${D.today.filter(e=>e.type==='action').length} actions</span> ·
    <span>${D.today.filter(e=>e.type==='decision').length} decisions</span> ·
    <span>${D.today.filter(e=>e.type==='gate').length} gate moves</span>
  `;
  const todayEnd = `
    <span><b>End of day:</b> 11 entries, 4 items touched, 2 hours of meetings.</span>
    <span class="dim">·</span>
    <span><b>${D.onyou.length}</b> still on you</span>
    <span class="dim">·</span>
    <span><b>${D.slipping.length}</b> slipping</span>
  `;

  // RIGHT RAIL
  function miniact(a){
    return `
      <div class="miniact ${a.late?'late':''}">
        <div class="chk"></div>
        <div style="flex:1;min-width:0">
          <div class="ti">${a.ti}</div>
          <div class="meta">
            <span class="tone sq ${a.kind==='action'?'orange':a.kind==='decision'?'purple':'blue'}">${a.kind}</span>
            <span class="dim">${a.id}</span>
            <span class="dim">·</span>
            <span>${a.from}</span>
          </div>
        </div>
        <div class="due">${a.due}</div>
      </div>`;
  }

  const onyou = `
    <div class="panel">
      <div class="ph"><h4>On you today</h4><span class="ct">${D.onyou.length}</span></div>
      <div class="pb">${D.onyou.map(miniact).join('')}</div>
    </div>`;

  // mini cal — March 2026
  function calGrid(){
    const offsets = [' ',' ',' ',' ',' ',' ','01']; // start col Sat — adjusted: Mar 1 2026 is a Sun
    const ds = [];
    // Mar 1 2026 was Sunday; we'll lay out Mon..Sun grid; Feb 23..28 fill prefix
    const prefixFeb = [23,24,25,26,27,28];
    prefixFeb.forEach(d=>ds.push({n:d, dim:true}));
    for (let i=1;i<=31;i++){
      const obj={n:i};
      if (i===12) obj.today=true;
      if ([3,5,8,10,11,12,13,14,17,19,20,24].includes(i)) obj.has=true;
      const dow = (i + 6) % 7; // Mar 1 = sun -> col 6; Mar 2 = mon -> col 0
      if (dow===5||dow===6) obj.weekend=true;
      ds.push(obj);
    }
    // suffix to complete the last row
    while(ds.length%7!==0) ds.push({n:ds.length-prefixFeb.length-31+1, dim:true});
    return ds.map(d=>{
      const cls = ['d',d.dim?'dim':'',d.has?'has':'',d.today?'today':'',d.weekend?'weekend':''].filter(Boolean).join(' ');
      return `<div class="${cls}">${String(d.n).padStart(2,'0')}</div>`;
    }).join('');
  }
  const cal = `
    <div class="panel">
      <div class="ph"><h4>March 2026</h4><span class="ct">12</span></div>
      <div class="cal">
        <div class="ch"><span>Mar</span><div><span class="dim">‹</span> <span class="dim">›</span></div></div>
        <div class="grid">
          <div class="dn">M</div><div class="dn">T</div><div class="dn">W</div><div class="dn">T</div><div class="dn">F</div><div class="dn">S</div><div class="dn">S</div>
          ${calGrid()}
        </div>
      </div>
    </div>`;

  const heatCols = D.heat.map(col=>{
    const cells = col.map(v=>`<div class="cell l${v}"></div>`).join('');
    return `<div class="col">${cells}</div>`;
  }).join('');
  const heat = `
    <div class="panel">
      <div class="ph"><h4>Last 12 weeks</h4><span class="ct">643 entries</span></div>
      <div class="heat">${heatCols}</div>
      <div class="heat-foot"><span>Less</span><div class="leg"><span style="background:var(--bg-3)"></span><span style="background:#dde8f7"></span><span style="background:#b5cff7"></span><span style="background:#7faeee"></span><span style="background:#1f6feb"></span></div><span>More</span></div>
    </div>`;

  const cloud = `
    <div class="panel">
      <div class="ph"><h4>Recent refs</h4></div>
      <div class="cloud">
        <a class="ref">SAG-mill <span class="ct">17</span></a>
        <a class="ref">CV-203 <span class="ct">9</span></a>
        <a class="ref">PMP-101 <span class="ct">8</span></a>
        <a class="ref">PID-D <span class="ct">6</span></a>
        <a class="ref">SWG-401 <span class="ct">5</span></a>
        <a class="ref">CIV-014 <span class="ct">5</span></a>
        <a class="ref">ENV-AQ-3 <span class="ct">4</span></a>
        <a class="ref">TNK-12 <span class="ct">3</span></a>
      </div>
    </div>`;

  // Compose page
  root.innerHTML = `
    <div class="a-grid">
      <div>
        ${hero}
        ${composer}
        ${dayBlock('Today · Wed','12', todaySummary, D.today, todayEnd)}
        ${dayBlock('Yesterday · Tue','11','7 entries · 1 gate move · 2 actions closed', yest)}
        ${dayBlock('Mon','10','9 entries · steerco prep day', day2)}
        <div class="foot-bar">
          <span>Showing 3 days</span>
          <span class="dim">·</span>
          <a href="#">Load older →</a>
          <span style="margin-left:auto;color:var(--ink-4)">643 entries · 12 weeks</span>
        </div>
      </div>
      <div class="rail">
        ${onyou}
        ${cal}
        ${heat}
        ${cloud}
      </div>
    </div>`;
</script>
</body>
</html>
