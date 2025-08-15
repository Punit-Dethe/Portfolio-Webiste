// Desktop-like interactions: draggable windows and notes, dock actions
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Z-index manager
  let zTop = 10;
  const bringToFront = (el) => { el.style.zIndex = ++zTop; };

  // Generic drag using CSS custom props --x and --y
  function makeDraggable(target, handle){
    const h = handle || target;
    let startX = 0, startY = 0, baseX = 0, baseY = 0;
    const get = () => {
      const cs = getComputedStyle(target);
      return [parseFloat(cs.getPropertyValue('--x')||'0'), parseFloat(cs.getPropertyValue('--y')||'0')];
    };
    const down = (e) => {
      if(e.button !== 0 && e.pointerType !== 'touch') return; // primary only
      // Do not start drag when interacting with controls/links/inputs inside the handle
      if (e.target.closest('.control') || e.target.closest('button, a, input, textarea, select, [role="button"]')) return;
      bringToFront(target);
      target.focus?.();
      const [x, y] = get();
      baseX = x; baseY = y; startX = e.clientX; startY = e.clientY;
      h.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    };
    const move = (e) => {
      const dx = e.clientX - startX; const dy = e.clientY - startY;
      target.style.setProperty('--x', (baseX + dx) + 'px');
      target.style.setProperty('--y', (baseY + dy) + 'px');
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      persistPosition(target);
    };
    h.addEventListener('pointerdown', down);
  }

  // Windows
  const windows = qsa('.window');
  windows.forEach(w => {
    const handle = qs('.drag-handle', w) || w;
    makeDraggable(w, handle);
    w.addEventListener('mousedown', () => bringToFront(w));

    const closeBtn = qs('.control.close', w);
    const minBtn = qs('.control.minimize', w);
    closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); w.hidden = true; saveOpenState(w.id, false); });
    minBtn?.addEventListener('click', (e) => { e.stopPropagation(); w.classList.toggle('minimized'); });
    handle?.addEventListener('dblclick', () => w.classList.toggle('minimized'));
  });

  // Dock actions
  qsa('.dock-item[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open');
      const win = qs('#' + id);
      if(!win) return;
      win.hidden = false;
      bringToFront(win);
      win.classList.remove('minimized');
      saveOpenState(id, true);
      win.focus();
    });
  });

  // Notes: drag via header bar if present, else whole note
  qsa('.note').forEach(note => {
    const bar = qs('.note-bar', note) || note;
    makeDraggable(note, bar);
    // Bring to front only on click (like windows), not on hover
    note.addEventListener('mousedown', () => bringToFront(note));
  });

  // Scatter notes around the center-ish area on load to avoid heavy overlap
  function scatterNotes(){
    const notes = qsa('.note');
    const n = notes.length;
    if(!n) return;
    const viewport = Math.min(window.innerWidth || 1200, window.innerHeight || 800);
    const radiusBase = Math.max(180, Math.min(240, viewport * 0.25));
    const angle0 = Math.random() * Math.PI * 2;
    const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.399 rad, good spread
    notes.forEach((note, i) => {
      const ang = angle0 + i * golden;
      const r = radiusBase * (0.75 + 0.25 * (i / Math.max(1, n-1)));
      const x = Math.round(Math.cos(ang) * r);
      const y = Math.round(Math.sin(ang) * r * 0.6 + 80); // push down from 20% baseline
      note.style.setProperty('--x', x + 'px');
      note.style.setProperty('--y', y + 'px');
      const rot = (Math.random() * 4 - 2).toFixed(2); // -2deg..2deg
      note.style.setProperty('--r', rot + 'deg');
    });
  }

  // Keyboard nudge for focused note or window
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement?.closest?.('.note, .window');
    if(!active) return;
    const step = e.shiftKey ? 12 : 4;
    const cs = getComputedStyle(active);
    const x = parseFloat(cs.getPropertyValue('--x')||'0');
    const y = parseFloat(cs.getPropertyValue('--y')||'0');
    if(e.key === 'ArrowLeft'){ active.style.setProperty('--x', (x - step) + 'px'); e.preventDefault(); }
    if(e.key === 'ArrowRight'){ active.style.setProperty('--x', (x + step) + 'px'); e.preventDefault(); }
    if(e.key === 'ArrowUp'){ active.style.setProperty('--y', (y - step) + 'px'); e.preventDefault(); }
    if(e.key === 'ArrowDown'){ active.style.setProperty('--y', (y + step) + 'px'); e.preventDefault(); }
  });

  // Persistence of positions and open state
  const LS_KEY = 'desktop-positions-v1';
  const LS_OPEN = 'desktop-open-v1';
  function persistPosition(el){
    const id = el.id || el.dataset.persistId;
    if(!id) return;
    const cs = getComputedStyle(el);
    const x = cs.getPropertyValue('--x');
    const y = cs.getPropertyValue('--y');
    const map = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    map[id] = { x, y };
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  }
  function applyPositions(){
    const map = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    [...qsa('.note'), ...qsa('.window')].forEach(el => {
      const id = el.id || el.dataset.persistId;
      if(id && map[id]){
        el.style.setProperty('--x', map[id].x);
        el.style.setProperty('--y', map[id].y);
      }
    });
  }
  function saveOpenState(id, isOpen){
    const map = JSON.parse(localStorage.getItem(LS_OPEN)||'{}');
    map[id] = isOpen;
    localStorage.setItem(LS_OPEN, JSON.stringify(map));
  }
  function applyOpenState(){
    const map = JSON.parse(localStorage.getItem(LS_OPEN)||'{}');
    qsa('.window').forEach(w => {
      if(map[w.id]) w.hidden = false;
    });
  }

  // Dynamic data rendering for Projects and Experience
  function renderFeedList(listEl, items){
    if(!listEl) return;
    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'feed-item';
      li.innerHTML = `
        <div class="thumb" aria-hidden="true"></div>
        <div class="info">
          <h3 class="title"></h3>
          <div class="meta"></div>
        </div>`;
      li.querySelector('.title').textContent = item.title || '';
      const meta = li.querySelector('.meta');
      (item.tags||[]).forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        meta.appendChild(s);
      });
      frag.appendChild(li);
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function renderFromData(data){
    const projList = qs('#win-projects .feed-list');
    const expList = qs('#win-experience .feed-list');
    if(data?.projects) renderFeedList(projList, data.projects);
    if(data?.experience) renderFeedList(expList, data.experience);
  }

  async function loadData(){
    const defaults = {
      projects: [
        { title: 'Smart Slide Browser', tags: ['Project','Student','Slides','Search'] },
        { title: 'AI Menu System', tags: ['AI/ML','Prototype','Computer Vision'] }
      ],
      experience: [
        { title: 'Machine Learning Intern • Dates TBD', tags: ['Internship','AI/ML'] },
        { title: 'Full Stack Developer • Dates TBD', tags: ['Web','Backend+Frontend'] },
        { title: 'Web Developer • Dates TBD', tags: ['Frontend','HTML/CSS/JS'] }
      ]
    };
    try {
      const res = await fetch('./data.json', { cache: 'no-store' });
      if(!res.ok) throw new Error('Failed to load data.json');
      const data = await res.json();
      renderFromData(data);
    } catch (err){
      // Likely opened from file:// or no data.json; fallback to defaults
      renderFromData(defaults);
    }
  }

  // Initial state
  scatterNotes();
  applyPositions();
  applyOpenState();
  loadData();
})();
