// Shared two-pane register shell. Mounts a list-on-left + detail-on-right view
// driven by a column config + row data. Used by Actions, Decisions, Risks,
// Watching, Library — anywhere you want an inbox-style triage.

window.DT_Register = (function(){
  const D = window.DT_DATA;

  // ---- helper: render a column cell ----
  function cell(col, row){
    const v = row[col.key];
    switch (col.kind){
      case 'id':   return `<span class="rg-id">${v||''}</span>`;
      case 'tone': return `<span class="tone ${col.toneMap?.[v]||'grey'} sq">${v}</span>`;
      case 'who':  return D.avatar(v||'me','sm');
      case 'who+': return (v||[]).map(p=>D.avatar(p,'sm')).join('');
      case 'due':  return `<span class="rg-due ${row.late?'late':''}">${v||''}</span>`;
      case 'score':return `<span class="rg-score" style="background:var(--tone-${col.tone||'red'}-bg);border-color:var(--tone-${col.tone||'red'}-bd);color:var(--tone-${col.tone||'red'}-ink)">${v||''}</span>`;
      case 'pip':  return col.render ? col.render(v,row) : v;
      case 'mono': return `<span class="t-mono muted">${v||''}</span>`;
      case 'plain':default:
        return col.bold ? `<span class="rg-ti">${v||''}</span>` : `<span>${v||''}</span>`;
    }
  }

  function listRow(cols, row, sel){
    const cells = cols.list.map(c=>`<div class="rg-c rg-c-${c.kind||'plain'}" style="${c.w?`flex:0 0 ${c.w}px`:''}${c.flex?`flex:${c.flex}`:''}">${cell(c,row)}</div>`).join('');
    return `<div class="rg-row ${row.late?'late':''} ${sel?'sel':''}" data-id="${row.id||''}">${cells}</div>`;
  }

  function bucket(label, ct){
    return `<div class="rg-bucket">${label} <span class="ct">${ct}</span></div>`;
  }

  function mount(opts){
    const root = document.getElementById('dt-content');
    if (!root) return;
    root.style.padding = '0';

    const buckets = opts.buckets || [{label:'All', rows:opts.rows||[]}];
    const sel = opts.selected || (buckets[0]?.rows[0]?.id);

    const tabs = (opts.tabs||[]).map((t,i)=>`
      <div class="rg-tab ${i===0?'on':''}">${t.label}${t.ct!=null?` <span class="ct">${t.ct}</span>`:''}</div>`).join('');

    const filters = (opts.filters||[]).map((f,i)=>`<span class="rg-chip ${i===0?'on':''}">${f}</span>`).join('');

    const listHtml = buckets.map(b=>`
      ${b.label?bucket(b.label, b.rows.length):''}
      ${b.rows.map(r=>listRow(opts.cols, r, r.id===sel)).join('')}
    `).join('');

    const sortOpts = (opts.sortBy||['Due date','Priority','Updated','Owner']).map((s,i)=>`<option ${i===0?'selected':''}>${s}</option>`).join('');

    root.innerHTML = `
      <div class="rg-wrap">
        <aside class="rg-list">
          <div class="rg-lh">
            <h2>${opts.title}</h2>
            <span class="ct">${opts.totalCount||buckets.reduce((a,b)=>a+b.rows.length,0)}</span>
            <div class="rg-lh-actions">
              <select class="rg-sel" title="Sort">${sortOpts}</select>
              <button class="btn icon" title="Bulk select">☐</button>
              <button class="btn icon" title="More">⋯</button>
            </div>
          </div>
          ${tabs?`<div class="rg-tabs">${tabs}</div>`:''}
          ${filters?`<div class="rg-filter">${filters}</div>`:''}
          <div class="rg-items">${listHtml}</div>
          <div class="rg-foot">
            <span><kbd>J</kbd>/<kbd>K</kbd> next</span>
            <span><kbd>X</kbd> ${opts.completeKey||'done'}</span>
            <span><kbd>E</kbd> snooze</span>
            <span><kbd>L</kbd> log</span>
          </div>
        </aside>
        <section class="rg-detail" id="rg-detail">${opts.detailHtml||''}</section>
      </div>`;
  }

  return { mount, listRow };
})();
