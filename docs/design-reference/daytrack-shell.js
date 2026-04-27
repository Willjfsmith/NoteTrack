// Shared chrome — sidebar + topbar — for DayTrack mockups.
// Drop a <div id="dt-shell" data-active="home"></div> in the page and call DT_Shell.mount().

window.DT_Shell = (function(){
  const D = window.DT_DATA;

  const navGroups = [
    { h: 'Today', items: [
      { id:'home',     ico:'◐', label:'Home',           ct: 7  },
      { id:'diary',    ico:'✎', label:'Diary',          ct: 11 },
      { id:'meetings', ico:'☷', label:'Meetings',       ct: 2  },
    ]},
    { h: 'Track', items: [
      { id:'pipelines',ico:'⇉', label:'Pipelines',      ct: 84 },
      { id:'gantt',    ico:'≡', label:'Gantt',          ct: null },
      { id:'actions',  ico:'✓', label:'Actions',        ct: 47 },
      { id:'decisions',ico:'◆', label:'Decisions',      ct: 18 },
      { id:'risks',    ico:'△', label:'Risks',          ct: 36 },
    ]},
    { h: 'Reference', items: [
      { id:'detail',   ico:'⊡', label:'Item detail',    ct: null },
      { id:'people',   ico:'☺', label:'People',         ct: 12 },
      { id:'watching', ico:'⊙', label:'Watching',       ct: 9  },
      { id:'library',  ico:'⎙', label:'Library',        ct: 214 },
    ]},
    { h: 'Admin', items: [
      { id:'database', ico:'⛁', label:'Database',       ct: null },
      { id:'edit',     ico:'⌨', label:'Edit modes',     ct: null },
    ]},
  ];

  function sidebar(active){
    let html = `
      <aside class="dt-side">
        <div class="brand">
          <div class="logo">D</div>
          <div class="name">DayTrack</div>
          <div class="v">v0.4</div>
        </div>
        <div class="proj-pick" title="Switch project">
          <div class="pdot"></div>
          <div class="pname">${D.project.name}</div>
          <div class="chev">▾</div>
        </div>`;
    for (const g of navGroups){
      html += `<div class="group"><div class="group-h"><span>${g.h}</span><span class="add" title="New">+</span></div>`;
      for (const it of g.items){
        const on = it.id===active ? 'on' : '';
        const ct = it.ct!=null ? `<span class="ct t-num">${it.ct}</span>` : '';
        html += `<a class="navi ${on}" href="#" data-nav="${it.id}"><span class="ico">${it.ico}</span><span>${it.label}</span>${ct}</a>`;
      }
      html += `</div>`;
    }
    html += `</aside>`;
    return html;
  }

  function topbar(crumbs, opts){
    opts = opts || {};
    const crumbHtml = crumbs.map((c,i)=>{
      const last = i===crumbs.length-1;
      return last ? `<b>${c}</b>` : `<span>${c}</span><span class="dim">/</span>`;
    }).join(' ');
    return `
      <div class="dt-topbar">
        <div class="crumb">${crumbHtml}</div>
        <div class="spacer"></div>
        <div class="search" role="button" tabindex="0">
          <span>⌕</span><span>Search items, actions, people…</span>
          <kbd>⌘K</kbd>
        </div>
        <button class="btn ghost" title="Notifications">🔔<span class="t-num" style="margin-left:2px">3</span></button>
        <button class="btn"><span>+ New</span><kbd style="margin-left:4px">N</kbd></button>
        <span class="av lg blue" title="You">YO</span>
      </div>`;
  }

  function mount(opts){
    opts = opts || {};
    const root = document.getElementById('dt-shell');
    if (!root) return;
    const active = root.dataset.active || 'home';
    const crumbs = opts.crumbs || ['DayTrack', D.project.name, 'Home'];
    root.innerHTML = `
      <div class="dt-app">
        ${sidebar(active)}
        <div class="dt-main">
          ${topbar(crumbs, opts)}
          <div class="dt-content ${opts.wide?'wide':''}" id="dt-content"></div>
        </div>
      </div>`;
  }

  return { mount, sidebar, topbar, navGroups };
})();
