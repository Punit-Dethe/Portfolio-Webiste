// Desktop-like interactions: draggable windows and notes, dock actions, and small UX polish.
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const setVarXY = (el, x, y) => {
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
  };

  // The polished mobile layout pins windows near the top of the viewport. Keep that
  // layout, but let the same --x/--y variables used by desktop dragging offset it.
  // This intentionally comes after styles.css so it can override the mobile !important
  // transform that previously made window dragging appear broken.
  const dragStyle = document.createElement('style');
  dragStyle.textContent = `
    @media (max-width: 900px) {
      .window {
        left: 50% !important;
        top: 10px !important;
        transform: translate(calc(-50% + var(--x, 0px)), var(--y, 0px)) !important;
      }
      .drag-handle { cursor: grab !important; touch-action: none; }
      .window.is-dragging .drag-handle { cursor: grabbing !important; }
    }
  `;
  document.head.appendChild(dragStyle);

  let zTop = 20;
  const bringToFront = (el) => { el.style.zIndex = ++zTop; };
  const rand = (min, max) => Math.random() * (max - min) + min;

  function syncDockState(){
    qsa('.dock-item[data-open]').forEach(btn => {
      const win = qs('#' + btn.getAttribute('data-open'));
      const open = Boolean(win && !win.hidden);
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-pressed', String(open));
    });
  }

  function placeWindowNearCenter(w){
    if (window.innerWidth <= 900) {
      setVarXY(w, 0, 0);
      return;
    }
    const container = qs('.windows') || document.body;
    const crect = container.getBoundingClientRect();
    const cw = crect.width || container.clientWidth || window.innerWidth || 1200;
    const ch = crect.height || container.clientHeight || window.innerHeight || 800;
    const jx = Math.round(rand(-110, 110));
    const jy = -105 + Math.round(rand(-14, 14));
    const viewportCX = (window.innerWidth || cw) / 2;
    const viewportCY = (window.innerHeight || ch) / 2;
    setVarXY(
      w,
      Math.round(viewportCX - (crect.left + cw / 2) + jx),
      Math.round(viewportCY - (crect.top + ch / 2) + jy)
    );
  }

  function makeDraggable(target, handle){
    const h = handle || target;
    let startX = 0, startY = 0, baseX = 0, baseY = 0;
    let activePointerId = null;

    const get = () => {
      const cs = getComputedStyle(target);
      return [parseFloat(cs.getPropertyValue('--x') || '0'), parseFloat(cs.getPropertyValue('--y') || '0')];
    };

    const move = (e) => {
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      setVarXY(target, baseX + e.clientX - startX, baseY + e.clientY - startY);
    };

    const up = (e) => {
      if (activePointerId !== null && e?.pointerId != null && e.pointerId !== activePointerId) return;
      target.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      activePointerId = null;
    };

    const down = (e) => {
      if(e.button !== 0 && e.pointerType !== 'touch') return;
      if (e.target.closest('.control') || e.target.closest('button, a, input, textarea, select, [role="button"]')) return;
      bringToFront(target);
      target.focus?.();
      [baseX, baseY] = get();
      startX = e.clientX;
      startY = e.clientY;
      activePointerId = e.pointerId;
      h.setPointerCapture?.(e.pointerId);
      target.classList.add('is-dragging');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      e.preventDefault();
    };

    h.addEventListener('pointerdown', down);
  }

  const windows = qsa('.window');
  windows.forEach(w => {
    const handle = qs('.drag-handle', w) || w;
    makeDraggable(w, handle);
    w.addEventListener('mousedown', () => bringToFront(w));

    qs('.control.close', w)?.addEventListener('click', (e) => {
      e.stopPropagation();
      w.hidden = true;
      syncDockState();
    });
    qs('.control.minimize', w)?.addEventListener('click', (e) => {
      e.stopPropagation();
      w.classList.toggle('minimized');
    });
    handle?.addEventListener('dblclick', (e) => {
      if (e.target.closest('.control')) return;
      w.classList.toggle('minimized');
    });
  });

  qsa('.dock-item[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const win = qs('#' + btn.getAttribute('data-open'));
      if(!win) return;
      const wasHidden = win.hidden;
      win.hidden = false;
      win.classList.remove('minimized');
      bringToFront(win);
      if (wasHidden) placeWindowNearCenter(win);
      win.focus();
      syncDockState();
    });
  });

  qsa('.note').forEach(note => {
    makeDraggable(note, qs('.note-bar', note) || note);
    note.addEventListener('mousedown', () => bringToFront(note));
  });

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
    const baseDx = Math.round(viewportCX - (crect.left + cw / 2));
    const baseDy = Math.round(viewportCY - (crect.top + ch / 2));
    const minDim = Math.min(window.innerWidth || cw, window.innerHeight || ch);
    const r1 = Math.min(150, Math.floor(minDim * 0.14));
    const r2 = Math.min(250, Math.floor(minDim * 0.22));
    const margin = 26;
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
      if (window.innerWidth <= 900) return false;
      return placed.some(p => !(
        rect.right + margin < p.left ||
        rect.left - margin > p.right ||
        rect.bottom + margin < p.top ||
        rect.top - margin > p.bottom
      ));
    };

    notes.forEach(note => {
      let choice = null;
      for(let i=0; i<90; i++){
        const rect = rectFor(note, Math.round(rand(-r1, r1)), Math.round(rand(-r1, r1)));
        if(!collides(rect)) { choice = rect; break; }
      }
      if(!choice){
        for(let i=0; i<140; i++){
          const rect = rectFor(note, Math.round(rand(-r2, r2)), Math.round(rand(-r2, r2)));
          if(!collides(rect)) { choice = rect; break; }
        }
      }
      if(!choice) choice = rectFor(note, Math.round(rand(-r1, r1)), Math.round(rand(-r1, r1)));
      setVarXY(note, choice.varX, choice.varY);
      note.style.setProperty('--r', (Math.random() * 1.2 - 0.6).toFixed(2) + 'deg');
      placed.push(choice);
    });
  }

  function renderFeedList(listEl, items){
    if(!listEl) return;
    const frag = document.createDocumentFragment();
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'feed-item';
      li.innerHTML = `
        <div class="thumb thumb-${index % 4}" aria-hidden="true"><span></span></div>
        <div class="info">
          <h3 class="title"></h3>
          <div class="meta"></div>
        </div>`;
      li.querySelector('.title').textContent = item.title || '';
      li.querySelector('.thumb span').textContent = String(index + 1).padStart(2, '0');
      const meta = li.querySelector('.meta');
      (item.tags || []).forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        meta.appendChild(s);
      });
      if (item.description) {
        const p = document.createElement('p');
        p.className = 'feed-description';
        p.textContent = item.description;
        li.querySelector('.info').appendChild(p);
      }
      if (item.link) {
        const action = document.createElement('div');
        action.className = 'action';
        const a = document.createElement('a');
        a.href = item.link;
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.className = 'btn';
        a.textContent = 'Open project ↗';
        action.appendChild(a);
        li.querySelector('.info').appendChild(action);
      }
      frag.appendChild(li);
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function renderFromData(data){
    if(data?.projects) renderFeedList(qs('#win-projects .feed-list'), data.projects);
    if(data?.experience) renderFeedList(qs('#win-experience .feed-list'), data.experience);
  }

  async function loadData(){
    const defaults = {
      projects: [
        { title: 'Smart Slide Browser', tags: ['Project','Student','Slides','Search'], link: 'https://github.com/Punit-Dethe/SideSurf_Side_Browser' },
        { title: 'AI Menu System', tags: ['AI/ML','Prototype','Computer Vision'], link: 'https://github.com/Punit-Dethe/Intuition-Eats' }
      ],
      experience: [
        { title: 'Intern at Triply', tags: ['Internship','Design','Development','Deployment'] },
        { title: 'Developer at PRANA Foundation', tags: ['NGO','In Development','Accessibility'] },
        { title: 'Freelance Full Stack Developer', tags: ['Freelancing','Full Stack','Web'] }
      ]
    };
    try {
      const res = await fetch('./data.json', { cache: 'no-store' });
      if(!res.ok) throw new Error('Failed to load data.json');
      renderFromData(await res.json());
    } catch (err){
      renderFromData(defaults);
    }
  }

  function startAboutIconBlink(){
    const img = qs('.dock-item[data-open="win-about"] .icon img');
    if(!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frames = ['Images/icons/suprise.png', 'Images/icons/laugh.png'];
    frames.forEach(src => { const i = new Image(); i.src = src; });
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % frames.length;
      img.src = frames[idx];
    }, 1400);
  }

  function polishChrome(){
    const social = qs('.social');
    if (social) {
      social.innerHTML = `
        <a href="https://github.com/Punit-Dethe" target="_blank" rel="noreferrer" aria-label="GitHub">GitHub ↗</a>
        <a href="https://www.linkedin.com/in/punit-dethe-32447b331/" target="_blank" rel="noreferrer" aria-label="LinkedIn">LinkedIn ↗</a>
        <a href="mailto:punitdethe2006@gmail.com" aria-label="Email">Email</a>`;
    }

    const brand = qs('.brand');
    if (brand && !qs('.brand-role', brand)) {
      const role = document.createElement('span');
      role.className = 'brand-role';
      role.textContent = 'developer / builder';
      brand.appendChild(role);
    }

    const board = qs('.board');
    if (board && !qs('.desktop-tip')) {
      const tip = document.createElement('div');
      tip.className = 'desktop-tip';
      tip.innerHTML = '<strong>Explore the desktop</strong><span>Open an icon • drag a window • press Esc to close</span>';
      board.appendChild(tip);
    }

    const resumeLink = qs('#win-resume a[href="#"]');
    if (resumeLink) {
      resumeLink.removeAttribute('download');
      resumeLink.href = 'mailto:punitdethe2006@gmail.com?subject=Resume%20request';
      resumeLink.textContent = 'Request resume by email →';
      resumeLink.classList.add('btn');
    }
  }

  qsa('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tab-btn').forEach(b => b.classList.remove('active'));
      qsa('.tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const targetContent = qs('#tab-' + btn.getAttribute('data-tab'));
      if(targetContent) targetContent.style.display = 'block';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = windows.filter(w => !w.hidden).sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0));
      if (open[0]) {
        open[0].hidden = true;
        syncDockState();
        e.preventDefault();
      }
      return;
    }

    const active = document.activeElement?.closest?.('.note, .window');
    if(!active || window.innerWidth <= 900) return;
    const step = e.shiftKey ? 12 : 4;
    const cs = getComputedStyle(active);
    const x = parseFloat(cs.getPropertyValue('--x') || '0');
    const y = parseFloat(cs.getPropertyValue('--y') || '0');
    if(e.key === 'ArrowLeft'){ setVarXY(active, x - step, y); e.preventDefault(); }
    if(e.key === 'ArrowRight'){ setVarXY(active, x + step, y); e.preventDefault(); }
    if(e.key === 'ArrowUp'){ setVarXY(active, x, y - step); e.preventDefault(); }
    if(e.key === 'ArrowDown'){ setVarXY(active, x, y + step); e.preventDefault(); }
  });

  polishChrome();
  scatterNotes();
  loadData();
  startAboutIconBlink();
  syncDockState();
})();