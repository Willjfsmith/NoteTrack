<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DayTrack — Home C · Two-pane Inbox</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="daytrack.css">
<style>
  /* Variation C — two-pane inbox */
  .c-wrap{display:grid;grid-template-columns:380px 1fr;gap:0;height:calc(100vh - 49px);margin:-18px -22px -60px}
  @media (max-width:1100px){.c-wrap{grid-template-columns:1fr;height:auto}}

  .c-list{border-right:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;min-height:0}
  .c-list .lh{padding:10px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;background:var(--bg-2)}
  .c-list .lh h2{margin:0;font-family:var(--serif);font-size:18px;font-weight:500;letter-spacing:-.01em}
  .c-list .lh .ct{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:1px 6px}

  .c-tabs{display:flex;gap:0;padding:0 8px;border-bottom:1px solid var(--line);background:var(--surface)}
  .c-tabs .tab{padding:9px 10px;font-size:12px;color:var(--ink-3);cursor:pointer;border-bottom:2px solid transparent;font-weight:500;display:flex;align-items:center;gap:5px}
  .c-tabs .tab .ct{font-family:var(--mono);font-size:10px;background:var(--bg-3);padding:0 5px;border-radius:4px;color:var(--ink-3)}
  .c-tabs .tab.on{color:var(--ink);border-bottom-color:var(--accent)}
  .c-tabs .tab.on .ct{background:var(--accent-bg);color:var(--accent)}
  .c-tabs .tab:hover{color:var(--ink)}

  .c-filter{display:flex;gap:5px;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--bg);overflow-x:auto;white-space:nowrap}
  .c-filter .chip{font-size:11px;padding:2px 8px;border:1px solid var(--line);border-radius:99px;color:var(--ink-3);background:var(--surface);cursor:pointer}
  .c-filter .chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
  .c-filter .chip:hover{border-color:var(--line-3)}

  .c-items{flex:1;overflow-y:auto;min-height:0}
  .c-bucket{padding:10px 14px 4px;font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em;font-weight:600;background:var(--bg-2);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:1}
  .c-bucket .ct{font-family:var(--mono);color:var(--ink-4);margin-left:4px}

  .c-item{display:grid;grid-template-columns:14px 1fr;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer;align-items:flex-start}
  .c-item:hover{background:var(--bg-2)}
  .c-item.sel{background:var(--accent-bg);border-left:3px solid var(--accent);padding-left:11px}
  .c-item .chk{width:14px;height:14px;border:1.5px solid var(--ink-5);border-radius:3px;margin-top:2px;flex:0 0 auto}
  .c-item.late .chk{border-color:var(--tone-red-bd)}
  .c-item .top{display:flex;align-items:center;gap:6px;margin-bottom:2px}
  .c-item .top .id{font-family:var(--mono);font-size:10.5px;color:var(--ink-4)}
  .c-item .top .due{margin-left:auto;font-family:var(--mono);font-size:10.5px;color:var(--ink-3);font-weight:500}
  .c-item.late .top .due{color:var(--tone-red-ink);font-weight:700}
  .c-item .ti{color:var(--ink);font-size:13px;font-weight:500;line-height:1.35;margin-bottom:3px}
  .c-item .meta{font-size:11px;color:var(--ink-3);display:flex;align-items:center;gap:6px}

  /* DETAIL PANE */
  .c-detail{display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--bg)}
  .c-dh{padding:12px 22px 10px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
  .c-dh .ids{font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-bottom:3px}
  .c-dh h1{margin:0;font-family:var(--serif);font-size:24px;font-weight:500;letter-spacing:-.01em;line-height:1.2}
  .c-dh .meta{display:flex;gap:14px;margin-top:8px;color:var(--ink-3);font-size:12px;align-items:center}
  .c-dh .meta b{color:var(--ink);font-weight:500}
  .c-dh .actions{margin-left:auto;display:flex;gap:6px;align-self:center}

  .c-subtabs{display:flex;gap:0;padding:0 22px;border-bottom:1px solid var(--line);background:var(--surface)}
  .c-subtabs .tab{padding:8px 0;margin-right:18px;font-size:12px;color:var(--ink-3);cursor:pointer;border-bottom:2px solid transparent;font-weight:500}
  .c-subtabs .tab.on{color:var(--ink);border-bottom-color:var(--ink)}

  .c-body{flex:1;overflow-y:auto;padding:18px 22px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px;align-items:start}
  @media (max-width:1280px){.c-body{grid-template-columns:1fr}}

  .c-section h3{font-family:var(--sans);font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin:0 0 8px}
  .c-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-3);padding:12px 14px;box-shadow:var(--sh-1);margin-bottom:10px}
  .c-card p{margin:0 0 6px;color:var(--ink-2);line-height:1.55;font-size:13px}
  .c-card .ref{font-family:var(--mono);font-size:11px;background:var(--bg-2);border:1px solid var(--line);border-radius:3px;padding:0 4px;color:var(--ink-2);text-decoration:none}

  /* gate strip in detail */
  .c-gates{margin:8px 0 14px}

  /* timeline (small) */
  .mini-tl{padding-left:18px;position:relative}
  .mini-tl::before{content:"";position:absolute;left:6px;top:4px;bottom:4px;width:1px;background:var(--line)}
  .mini-tl .e{position:relative;font-size:12px;padding:5px 0;color:var(--ink-2)}
  .mini-tl .e::before{content:"";position:absolute;left:-18px;top:9px;width:8px;height:8px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-4)}
  .mini-tl .e.gate::before{background:var(--tone-green-bd);border-color:var(--tone-green-ink)}
  .mini-tl .e.note::before{background:var(--tone-yellow-bd);border-color:var(--tone-yellow-ink)}
  .mini-tl .e.action::before{background:var(--tone-orange-bd);border-color:var(--tone-orange-ink)}
  .mini-tl .e.decision::before{background:var(--tone-purple-bd);border-color:var(--tone-purple-ink)}
  .mini-tl .e .when{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);margin-right:6px}

  /* facts table */
  .facts{display:grid;grid-template-columns:90px 1fr;gap:6px 10px;font-size:12px}
  .facts dt{color:var(--ink-3);font-weight:500}
  .facts dd{margin:0;color:var(--ink)}
  .facts dd .tone{font-size:11px}

  /* keybar */
  .keybar{display:flex;align-items:center;gap:14px;padding:6px 22px;border-top:1px solid var(--line);background:var(--bg-2);font-size:11px;color:var(--ink-3)}
  .keybar .k{display:flex;align-items:center;gap:4px}

  /* shortcut hint */
  .first-shortcuts{padding:10px 14px;background:var(--bg-2);border-bottom:1px solid var(--line);font-size:11px;color:var(--ink-3);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
  .first-shortcuts kbd{margin:0 2px}
</style>
</head>
<body>
<div id="dt-shell" data-active="home"></div>
<script src="daytrack-data.js"></script>
<script src="daytrack-shell.js"></script>
<script>
  DT_Shell.mount({ crumbs:['DayTrack', DT_DATA.project.name, 'Home'], wide:true });
  const D = DT_DATA;
  const root = document.getElementById('dt-content');
  root.style.padding = '0';

  // Bucket items: late, today, this week, decisions
  const late   = D.onyou.filter(a=>a.late);
  const dueToday = D.onyou.filter(a=>!a.late && a.due==='Today');
  const dueWeek  = D.onyou.filter(a=>!a.late && a.due!=='Today');

  function itemRow(a, sel){
    const toneCls = a.kind==='action'?'orange':a.kind==='decision'?'purple':'blue';
    return `
      <div class="c-item ${a.late?'late':''} ${sel?'sel':''}">
        <div class="chk"></div>
        <div>
          <div class="top">
            <span class="tone sq ${toneCls}">${a.kind}</span>
            <span class="id">${a.id}</span>
            <span class="due">${a.due}</span>
          </div>
          <div class="ti">${a.ti}</div>
          <div class="meta">
            <span>From ${a.from}</span>
          </div>
        </div>
      </div>`;
  }

  const list = `
    <div class="c-list">
      <div class="lh">
        <h2>Inbox</h2>
        <span class="ct">${D.onyou.length}</span>
        <div style="margin-left:auto;display:flex;gap:4px">
          <button class="btn icon" title="Sort">⇅</button>
          <button class="btn icon" title="Refresh">↻</button>
        </div>
      </div>
      <div class="c-tabs">
        <div class="tab on">On you <span class="ct">${D.onyou.length}</span></div>
        <div class="tab">Watching <span class="ct">9</span></div>
        <div class="tab">Diary</div>
        <div class="tab">Mentions <span class="ct">3</span></div>
      </div>
      <div class="c-filter">
        <span class="chip on">All</span>
        <span class="chip">Actions</span>
        <span class="chip">Reviews</span>
        <span class="chip">Decisions</span>
        <span class="chip">Late</span>
      </div>
      <div class="c-items">
        <div class="c-bucket">Late <span class="ct">${late.length}</span></div>
        ${late.map(a=>itemRow(a,false)).join('')}
        <div class="c-bucket">Today <span class="ct">${dueToday.length}</span></div>
        ${dueToday.map((a,i)=>itemRow(a, a.id==='DEC-027')).join('')}
        <div class="c-bucket">This week <span class="ct">${dueWeek.length}</span></div>
        ${dueWeek.map(a=>itemRow(a,false)).join('')}
      </div>
      <div class="first-shortcuts">
        <span><kbd>J</kbd>/<kbd>K</kbd> next</span>
        <span><kbd>X</kbd> done</span>
        <span><kbd>E</kbd> snooze</span>
        <span><kbd>R</kbd> reply</span>
      </div>
    </div>`;

  // Selected item: DEC-027 — Approve gearbox vendor switch
  const detail = `
    <div class="c-detail">
      <div class="c-dh">
        <div>
          <div class="ids">DEC-027 · linked to #SAG-mill #SAG-mill/gearbox</div>
          <h1>Approve gearbox vendor switch — Flender → Siemens</h1>
          <div class="meta">
            <span class="tone purple">decision</span>
            <span><b>Due today</b> · 16:00</span>
            <span>Owner ${D.avatar('jt','sm')} <b>Jules T.</b></span>
            <span>Impact <b>£180k</b> · 2-week schedule pull-in</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn">Snooze</button>
          <button class="btn">Decline</button>
          <button class="btn primary">Approve <kbd style="margin-left:4px;background:rgba(255,255,255,.2);border-color:transparent;color:#fff">⌘↵</kbd></button>
        </div>
      </div>
      <div class="c-subtabs">
        <div class="tab on">Overview</div>
        <div class="tab">Activity · 14</div>
        <div class="tab">Actions · 3</div>
        <div class="tab">Drawings · 2</div>
        <div class="tab">Vendors · 2</div>
      </div>
      <div class="c-body">
        <div>
          <div class="c-section">
            <h3>Phase</h3>
            <div class="c-gates">
              <div class="gates">
                <span class="g done">Concept</span>
                <span class="g done">Design</span>
                <span class="g now">Vendor select</span>
                <span class="g future">Procure</span>
                <span class="g future">Fabricate</span>
                <span class="g future">Install</span>
                <span class="g future">Commission</span>
              </div>
            </div>
          </div>

          <div class="c-section">
            <h3>Context</h3>
            <div class="c-card">
              <p>Flender quoted 22-week lead time on the SAG-mill gearbox; Siemens can deliver in 14 weeks at <b>+£180k</b>. Pavel confirmed compatibility with existing motor envelope and frame.</p>
              <p>Process review (Sarah K.) signed off on torque/ratio. Mech review (Marc R.) requires updated foundation bolt pattern — see <a class="ref">DRW-1142</a>.</p>
              <p>This pulls SAG-mill commissioning gate forward by ~2 weeks if approved by EOW.</p>
            </div>
          </div>

          <div class="c-section">
            <h3>Recent activity</h3>
            <div class="c-card" style="padding:8px 14px">
              <div class="mini-tl">
                <div class="e decision"><span class="when">10:48 today</span>Decision logged by Jules T. — Siemens recommended</div>
                <div class="e note"><span class="when">11:40 today</span>Pavel sent revised P&amp;ID rev D — incorporates Siemens footprint</div>
                <div class="e action"><span class="when">Mon 14:20</span>Sarah K. completed torque/ratio review — approved</div>
                <div class="e gate"><span class="when">Mon 09:15</span>Moved Concept → Vendor select</div>
                <div class="e note"><span class="when">Fri 16:00</span>Quote received from Siemens — £180k delta over Flender</div>
              </div>
            </div>
          </div>

          <div class="c-section">
            <h3>Reply</h3>
            <div class="c-card">
              <div style="display:flex;align-items:flex-start;gap:8px">
                ${D.avatar('me','sm')}
                <div style="flex:1">
                  <textarea style="width:100%;border:none;outline:none;font-family:var(--sans);font-size:13px;color:var(--ink);background:transparent;resize:vertical;min-height:50px" placeholder="Add a note that's logged against this decision…"></textarea>
                  <div class="row" style="margin-top:6px">
                    <button class="btn sm ghost">@ mention</button>
                    <button class="btn sm ghost"># link</button>
                    <button class="btn sm ghost">📎 attach</button>
                    <span style="flex:1"></span>
                    <button class="btn sm">Save note</button>
                    <button class="btn sm primary">Decide & log</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside>
          <div class="c-section">
            <h3>Quick facts</h3>
            <div class="c-card">
              <dl class="facts">
                <dt>Item</dt><dd>SAG-mill</dd>
                <dt>Type</dt><dd><span class="tone grey sq">major equip.</span></dd>
                <dt>Owner</dt><dd>${D.avatar('jt','sm')} Jules T.</dd>
                <dt>Vendor</dt><dd>Siemens (recommended)</dd>
                <dt>Cost</dt><dd>£180k delta</dd>
                <dt>Schedule</dt><dd>−2 weeks</dd>
                <dt>Risk</dt><dd><span class="tone yellow">RSK-021 · 12</span></dd>
              </dl>
            </div>
          </div>

          <div class="c-section">
            <h3>People</h3>
            <div class="c-card">
              <div class="row" style="gap:6px"><span style="font-size:11px;color:var(--ink-3);width:18px">R</span>${D.avatar('jt','sm')}<span style="font-size:12px">Jules T.</span></div>
              <div class="row" style="gap:6px;margin-top:4px"><span style="font-size:11px;color:var(--ink-3);width:18px">A</span>${D.avatar('me','sm')}<span style="font-size:12px">You</span></div>
              <div class="row" style="gap:6px;margin-top:4px"><span style="font-size:11px;color:var(--ink-3);width:18px">C</span>${D.avatar('sk','sm')} ${D.avatar('mr','sm')} ${D.avatar('pv','sm')}</div>
              <div class="row" style="gap:6px;margin-top:4px"><span style="font-size:11px;color:var(--ink-3);width:18px">I</span>${D.avatar('dn','sm')} ${D.avatar('lr','sm')}</div>
            </div>
          </div>

          <div class="c-section">
            <h3>Linked items</h3>
            <div class="c-card" style="font-size:12px">
              <div class="row" style="margin-bottom:5px"><a class="ref">SAG-mill</a><span class="muted">parent</span></div>
              <div class="row" style="margin-bottom:5px"><a class="ref">DRW-1142</a><span class="muted">foundation bolt pattern</span></div>
              <div class="row" style="margin-bottom:5px"><a class="ref">PID-D</a><span class="muted">supersedes rev C</span></div>
              <div class="row"><a class="ref">RSK-021</a><span class="muted">vendor change rework</span></div>
            </div>
          </div>
        </aside>
      </div>
      <div class="keybar">
        <span class="k"><kbd>⌘↵</kbd> approve</span>
        <span class="k"><kbd>J</kbd>/<kbd>K</kbd> prev/next</span>
        <span class="k"><kbd>E</kbd> snooze</span>
        <span class="k"><kbd>L</kbd> log note</span>
        <span class="k"><kbd>G</kbd> go to item</span>
        <span style="margin-left:auto" class="k">3 of 7 in inbox</span>
      </div>
    </div>`;

  root.innerHTML = `<div class="c-wrap">${list}${detail}</div>`;
</script>
</body>
</html>
