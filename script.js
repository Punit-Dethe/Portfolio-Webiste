// Desktop-like interactions: draggable windows and notes, dock actions
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const getVarXY = (el) => {
    const cs = getComputedStyle(el);
    return [parseFloat(cs.getPropertyValue('--x')||'0'), parseFloat(cs.getPropertyValue('--y')||'0')];
  };
  const setVarXY = (el, x, y) => {
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
  };
  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // Z-index manager
  let zTop = 10;
  const bringToFront = (el) => { el.style.zIndex = ++zTop; };

  // Simple helpers
  const rand = (min, max) => Math.random() * (max - min) + min;

  // Place a window near the center of its container (.windows) with light jitter
  function placeWindowNearCenter(w){
    const container = qs('.windows') || document.body;
    const crect = container.getBoundingClientRect();
    const cw = crect.width || container.clientWidth || window.innerWidth || 1200;
    const ch = crect.height || container.clientHeight || window.innerHeight || 800;
    const isMobile = window.innerWidth <= 900;
    const hJitter = isMobile ? 10 : 120; // stronger left/right jitter in px on desktop
    const vUp = isMobile ? 60 : 120;     // push further above center
    const vJitter = 12;  // small vertical jitter
    const jx = Math.round(rand(-hJitter, hJitter));
    const jy = -vUp + Math.round(rand(-vJitter, vJitter));
    const viewportCX = (window.innerWidth || cw) / 2;
    const viewportCY = (window.innerHeight || ch) / 2;
    // var(--x), var(--y) are offsets from container center (CSS uses top: 50% and translate(-50%, -50%))
    const varX = Math.round(viewportCX - (crect.left + cw / 2) + jx);
    const varY = Math.round(viewportCY - (crect.top + ch / 2) + jy);
    setVarXY(w, varX, varY);
  }

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
    closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); w.hidden = true; });
    minBtn?.addEventListener('click', (e) => { e.stopPropagation(); w.classList.toggle('minimized'); });
    handle?.addEventListener('dblclick', () => w.classList.toggle('minimized'));

    // If visible on load, drop it near center
    if (!w.hidden) placeWindowNearCenter(w);
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
      placeWindowNearCenter(win);
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

  // Scatter notes near the true viewport center with small jitter and minimal overlap
  function scatterNotes(){
    const notes = qsa('.note');
    if(!notes.length) return;
    const container = qs('.notes') || document.body;
    const crect = container.getBoundingClientRect();
    const cw = crect.width || container.clientWidth || window.innerWidth || 1200;
    const ch = crect.height || container.clientHeight || window.innerHeight || 800;
    const centerX = cw / 2;
    const centerY = ch / 2;
    const viewportCX = (window.innerWidth || cw) / 2;
    const viewportCY = (window.innerHeight || ch) / 2;
    // offset to align container center with viewport center
    const baseDx = Math.round(viewportCX - (crect.left + cw / 2));
    const baseDy = Math.round(viewportCY - (crect.top + ch / 2));

    // two-pass search: tight cluster, then slightly wider ring for near non-overlap
    const minDim = Math.min(window.innerWidth || cw, window.innerHeight || ch);
    const r1 = Math.min(160, Math.floor(minDim * 0.14)); // near-center jitter
    const r2 = Math.min(260, Math.floor(minDim * 0.22)); // fallback slightly wider
    const margin = 32; // stronger spacing between notes
    const placed = [];

    const rectFor = (note, jx, jy) => {
      const w = note.offsetWidth || note.getBoundingClientRect().width || 420;
      const h = note.offsetHeight || note.getBoundingClientRect().height || 220;
      const varX = baseDx + jx;
      const varY = baseDy + jy;
      const left = Math.round(centerX - w / 2 + varX);
      const top = Math.round(centerY - h / 2 + varY);
      return { left, top, right: left + w, bottom: top + h, varX, varY };
    };

    const collides = (rect) => {
      if (window.innerWidth <= 900) return false; // Allow stack overlap on mobile
      return placed.some(p => !(
        rect.right + margin < p.left ||
        rect.left - margin > p.right ||
        rect.bottom + margin < p.top ||
        rect.top - margin > p.bottom
      ));
    };

    notes.forEach(note => {
      let choice = null;
      // Pass 1: keep tight near center
      for(let i=0; i<100; i++){
        const dx = Math.round(rand(-r1, r1));
        const dy = Math.round(rand(-r1, r1));
        const rect = rectFor(note, dx, dy);
        if(!collides(rect)) { choice = rect; break; }
      }
      // Pass 2: allow a bit wider but still centered cluster
      if(!choice){
        for(let i=0; i<160; i++){
          const dx = Math.round(rand(-r2, r2));
          const dy = Math.round(rand(-r2, r2));
          const rect = rectFor(note, dx, dy);
          if(!collides(rect)) { choice = rect; break; }
        }
      }
      // Fallback: accept last tried position inside r1
      if(!choice){
        const dx = Math.round(rand(-r1, r1));
        const dy = Math.round(rand(-r1, r1));
        choice = rectFor(note, dx, dy);
      }
      setVarXY(note, choice.varX, choice.varY);
      note.style.setProperty('--r', (Math.random() * 1 - 0.5).toFixed(2) + 'deg');
      placed.push(choice);
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

  // (Simplified) No persistence or open state tracking

  // About dock icon: toggle between two PNGs every 1s
  function startAboutIconBlink(){
    const img = qs('.dock-item[data-open="win-about"] .icon img');
    if(!img) return;
    const frames = [
      'Images/icons/suprise.png',
      'Images/icons/laugh.png'
    ];
    // Preload frames to avoid flicker
    frames.forEach(src => { const i = new Image(); i.src = src; });
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % frames.length;
      img.src = frames[idx];
    }, 1000);
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
      if (item.link) {
        const action = document.createElement('div');
        action.className = 'action';
        const a = document.createElement('a');
        a.href = item.link;
        a.target = '_blank';
        a.className = 'btn';
        a.textContent = 'View Project';
        action.appendChild(a);
        li.querySelector('.info').appendChild(action);
      }
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
        { title: 'Smart Slide Browser', tags: ['Project','Student','Slides','Search'], link: 'https://github.com/Punit-Dethe/SideSurf_Side_Browser' },
        { title: 'AI Menu System', tags: ['AI/ML','Prototype','Computer Vision'], link: 'https://github.com/Punit-Dethe/Intuition-Eats' }
      ],
      experience: [
        { title: 'Intern at Triply', tags: ['Internship', 'Design', 'Development', 'Deployment'] },
        { title: 'Developer at PRANA Foundation', tags: ['NGO', 'In Development', 'Accessibility'] },
        { title: 'Freelance Full Stack Developer', tags: ['Freelancing', 'Full Stack', 'Web'] }
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

  // Tab Switching logic for About Window
  qsa('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      qsa('.tab-btn').forEach(b => b.classList.remove('active'));
      qsa('.tab-content').forEach(c => c.style.display = 'none');
      
      // Activate clicked
      btn.classList.add('active');
      const targetId = 'tab-' + btn.getAttribute('data-tab');
      const targetContent = qs('#' + targetId);
      if(targetContent) {
        targetContent.style.display = 'block';
      }
    });
  });

  // Initial state
  scatterNotes();
  loadData();
  startAboutIconBlink();

})();
