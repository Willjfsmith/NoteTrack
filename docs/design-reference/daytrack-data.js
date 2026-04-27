// Shared mock data for DayTrack home variations.
// Single project context: "South Plant — Phase 2" mineral processing build.

window.DT_DATA = (function(){
  const me = { id: 'me', name: 'You', initials: 'YO', color: 'blue' };

  const people = [
    { id: 'sk', name: 'Sarah K.',   initials: 'SK', color: 'purple', role: 'Process eng.' },
    { id: 'mr', name: 'Marc R.',    initials: 'MR', color: 'green',  role: 'Mech. lead' },
    { id: 'jt', name: 'Jules T.',   initials: 'JT', color: 'pink',   role: 'Project mgr' },
    { id: 'dn', name: 'Diane N.',   initials: 'DN', color: 'orange', role: 'EPCM rep' },
    { id: 'pv', name: 'Pavel V.',   initials: 'PV', color: 'yellow', role: 'Vendor — Outotec' },
    { id: 'ai', name: 'Aisha I.',   initials: 'AI', color: 'red',    role: 'Civil/struct' },
    { id: 'lr', name: 'Leo R.',     initials: 'LR', color: 'blue',   role: 'Instr/control' },
    me
  ];

  const project = {
    id: 'sp2',
    code: 'SP-2',
    name: 'South Plant — Phase 2',
    phase: 'Detail design',
    pct: 42,
    daysToFEL3: 38,
    color: 'yellow',
    budget: { spent: 3.4, total: 8.2, unit: 'M£' },
    risks: { high: 3, med: 11, low: 22 },
  };

  // KPI tiles
  const kpis = [
    { lbl: 'On you today',     num: 7,  delta: '+2 vs Mon',   tone: 'warn',  hint: '3 actions, 2 reviews, 2 decisions' },
    { lbl: 'Slipping',         num: 4,  delta: '+1 this wk',  tone: 'danger', hint: 'gate dates at risk' },
    { lbl: 'Awaiting input',   num: 12, delta: 'from 6 ppl',  tone: '',      hint: 'where you are R/A' },
    { lbl: 'Decisions due',    num: 3,  delta: 'this week',   tone: '',      hint: 'logged in register' },
  ];

  // Today's diary seed entries (chronological, mixed types)
  const today = [
    { t:'08:42', type:'note',     text:'Walked the SAG mill plinth pour — looks clean, photos in #SAG-mill.',     refs:['SAG-mill'], who:'me' },
    { t:'09:10', type:'gate',     text:'#CV-203 conveyor moved Procurement → Fabrication.',                       refs:['CV-203'], who:'jt' },
    { t:'09:35', type:'meeting',  text:'Daily stand-up · 6 attendees · 4 actions logged',                         refs:['MTG-118'], who:'jt' },
    { t:'10:02', type:'action',   text:'You owe Sarah the pump curve markup by Thu.',                             refs:['ACT-241','PMP-101'], who:'sk' },
    { t:'10:48', type:'decision', text:'Decided: switch gearbox vendor on #SAG-mill from Flender to Siemens.',    refs:['DEC-027','SAG-mill'], who:'jt' },
    { t:'11:15', type:'risk',     text:'Risk raised: late delivery of HV switchgear — 5 wk lead time slip.',      refs:['RSK-014','SWG-401'], who:'lr' },
    { t:'11:40', type:'note',     text:'Pavel sent revised P&ID rev D — needs review before Fri.',                refs:['PID-D','SAG-mill'], who:'pv' },
    { t:'13:20', type:'action',   text:'Reply to regulator on dust assessment (#ENV-AQ-3).',                      refs:['ACT-244','ENV-AQ-3'], who:'me' },
    { t:'14:05', type:'note',     text:'Site visit booked Thu 09:00 with Aisha — rebar inspection.',              refs:['CIV-014'], who:'ai' },
    { t:'15:30', type:'gate',     text:'#PMP-101 pump skid passed FAT at vendor works.',                          refs:['PMP-101'], who:'pv' },
    { t:'16:10', type:'note',     text:'Jules: tighten P6 schedule before Friday\'s steerco.',                     refs:['SCHED'], who:'jt' },
  ];

  // On-you-today slice
  const onyou = [
    { id:'ACT-241', kind:'action',   ti:'Markup pump curves on PMP-101 datasheet',  due:'Thu',  late:false, from:'Sarah K.' },
    { id:'DEC-027', kind:'decision', ti:'Approve gearbox vendor switch (SAG-mill)', due:'Today',late:false, from:'Steerco' },
    { id:'ACT-244', kind:'action',   ti:'Reply to regulator — ENV-AQ-3 dust',       due:'Today',late:false, from:'You' },
    { id:'REV-019', kind:'review',   ti:'P&ID rev D — Pavel',                       due:'Fri',  late:false, from:'Pavel V.' },
    { id:'ACT-238', kind:'action',   ti:'Sign-off civil rebar drawing CIV-014',     due:'Yest', late:true,  from:'Aisha I.' },
    { id:'REV-020', kind:'review',   ti:'CV-203 conveyor GA drawing rev B',         due:'Mon',  late:false, from:'Marc R.' },
    { id:'DEC-028', kind:'decision', ti:'Pick HV switchgear backup vendor',         due:'Wed',  late:false, from:'Risk #14'},
  ];

  // Slipping items
  const slipping = [
    { id:'SWG-401', ti:'HV switchgear delivery',   was:'18 Mar', now:'22 Apr', slip:'+5w',  by:'PV' },
    { id:'CIV-014', ti:'Rebar inspection sign-off',was:'12 Mar', now:'15 Mar', slip:'+3d',  by:'AI' },
    { id:'PID-D',   ti:'P&ID rev D issue',         was:'08 Mar', now:'14 Mar', slip:'+6d',  by:'PV' },
    { id:'SAG-mill',ti:'Gearbox vendor decision',  was:'05 Mar', now:'11 Mar', slip:'+6d',  by:'JT' },
  ];

  // Recent gate moves
  const moves = [
    { id:'CV-203',  from:'Procurement', to:'Fabrication', when:'today 09:10', who:'jt' },
    { id:'PMP-101', from:'FAT',         to:'Shipping',    when:'today 15:30', who:'pv' },
    { id:'TNK-12',  from:'Design',      to:'Procurement', when:'yest 16:00',  who:'mr' },
    { id:'ELE-310', from:'Concept',     to:'Design',      when:'Mon 11:00',   who:'lr' },
  ];

  // Open decisions
  const decisions = [
    { id:'DEC-027', ti:'Gearbox vendor switch — SAG-mill', due:'Today', impact:'£180k', owner:'jt' },
    { id:'DEC-028', ti:'Backup HV switchgear vendor',      due:'Wed',   impact:'5w lead', owner:'me' },
    { id:'DEC-029', ti:'Concrete mix change for plinth pour', due:'Fri', impact:'£24k',  owner:'ai' },
  ];

  // Top risks (5x5 — score = p*i, 1..5 each)
  const risks = [
    { id:'RSK-014', ti:'HV switchgear lead time',      p:4, i:4, owner:'lr', tone:'red'    },
    { id:'RSK-009', ti:'Regulator delays on AQ permit',p:3, i:5, owner:'jt', tone:'red'    },
    { id:'RSK-021', ti:'SAG-mill vendor change rework',p:4, i:3, owner:'sk', tone:'orange' },
    { id:'RSK-018', ti:'Civil rebar QC findings',      p:2, i:4, owner:'ai', tone:'orange' },
    { id:'RSK-005', ti:'Cost overrun on CV conveyors', p:3, i:3, owner:'mr', tone:'yellow' },
  ];

  // Week strip — Mon..Sun, today = Wed (idx 2)
  const week = [
    { dn:'Mon', dnum:'10', evs:[{t:'Stand-up'},{t:'Vendor call'}] },
    { dn:'Tue', dnum:'11', evs:[{t:'Steerco prep'},{t:'PID rev'}] },
    { dn:'Wed', dnum:'12', today:true, evs:[{t:'Stand-up 09:00'},{t:'Steerco 14:00'},{t:'Vendor — Pavel'}] },
    { dn:'Thu', dnum:'13', evs:[{t:'Site walk 09:00'},{t:'Pump curve'}] },
    { dn:'Fri', dnum:'14', evs:[{t:'P&ID rev D ◴'},{t:'AQ reply ◴'}] },
    { dn:'Sat', dnum:'15', evs:[] },
    { dn:'Sun', dnum:'16', evs:[] },
  ];

  // Activity heatmap — 12 weeks x 7 days (0..4)
  const heat = [];
  for (let w=0; w<12; w++){
    const col = [];
    for (let d=0; d<7; d++){
      // weekends low; recent weeks more active
      let v = (d===5||d===6) ? Math.floor(Math.random()*2) : 1+Math.floor(Math.random()*4);
      if (w<3) v = Math.max(0, v-2);
      if (w>9 && (d<5)) v = Math.min(4, v+1);
      col.push(v);
    }
    heat.push(col);
  }

  // helpers
  function p(id){ return people.find(x=>x.id===id) || me; }
  function avatar(id, sz){
    const pp = p(id);
    return `<span class="av ${sz||''} ${pp.color}" title="${pp.name}">${pp.initials}</span>`;
  }
  function ref(r){ return `<a class="ref" data-ref="${r}">#${r}</a>`; }
  function hilite(text){
    return text.replace(/#([A-Za-z0-9-]+)/g, (m,r)=>`<a class="ref" data-ref="${r}">#${r}</a>`);
  }

  return { me, people, project, kpis, today, onyou, slipping, moves, decisions, risks, week, heat, p, avatar, ref, hilite };
})();
