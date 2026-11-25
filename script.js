(() => {
  'use strict';

  const KEY = 'road_maintenance_issues_v1';
  const CREWS = ['Unassigned', 'Road Crew A', 'Signal Team B', 'Maintenance Team C'];
  const STATUSES = ['Reported', 'Assigned', 'In Progress', 'Resolved'];
  const ORDER = { High: 0, Medium: 1, Low: 2 };

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k === 'on') Object.entries(v).forEach(([e, fn]) => n.addEventListener(e, fn));
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids.filter(Boolean));
    return n;
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const fmtDate = (iso) => {
    const [y, m, d] = (iso || '').split('-').map(Number);
    return Number.isNaN(d) ? (iso || 'Unknown') : new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const svg = (t, c) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#e2e8f0"/><rect y="130" width="320" height="70" fill="#334155"/><path d="M20 165h70m30 0h180" stroke="#f8fafc" stroke-width="6" stroke-dasharray="22 14"/><circle cx="160" cy="88" r="34" fill="${c}"/><text x="160" y="95" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#fff">${t}</text></svg>`)}`;

  const SEED = () => [
    { id: 'ISS-1001', type: 'Broken Signal', location: 'Main St & 5th Ave', severity: 'High', description: 'Eastbound traffic signal head is completely dark during peak traffic hours, creating an intersection hazard.', photoDataUrl: svg('SIGNAL', '#b91c1c'), status: 'Assigned', crew: 'Signal Team B', reportedAt: '2026-11-24', createdAt: 1795478400000, resolutionNote: '', resolvedAt: '' },
    { id: 'ISS-1002', type: 'Pothole', location: 'Elm Blvd near Oak Park', severity: 'Medium', description: 'Deep asphalt pothole approximately 45 cm wide in the right-hand northbound lane.', photoDataUrl: svg('POTHOLE', '#b45309'), status: 'Reported', crew: 'Unassigned', reportedAt: '2026-11-25', createdAt: 1795564800000, resolutionNote: '', resolvedAt: '' },
    { id: 'ISS-1003', type: 'Damaged Road', location: 'River Rd Bridge Approach', severity: 'High', description: 'Cracked expansion joint and settled pavement edge along the westbound bridge apron.', photoDataUrl: svg('REPAIRED', '#15803d'), status: 'Resolved', crew: 'Road Crew A', reportedAt: '2026-11-20', createdAt: 1795132800000, resolutionNote: 'Milled damaged asphalt apron, leveled sub-base, and applied compacted hot-mix patch.', resolvedAt: '2026-11-22' },
  ];

  const banner = $('status-banner');
  const form = $('report-form');
  const queueList = $('queue-list');
  const recordsTbody = $('records-tbody');
  const resolveDialog = $('resolve-dialog');
  const deleteDialog = $('delete-dialog');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const radios = [...document.querySelectorAll('input[name="severity"]')];

  let issues = [];
  let photoUrl = '';
  let bannerTimer = 0;
  let pendingResolve = null;
  let pendingDelete = null;

  const announce = (msg) => {
    clearTimeout(bannerTimer);
    banner.textContent = '';
    requestAnimationFrame(() => {
      banner.textContent = msg;
      bannerTimer = setTimeout(() => { banner.textContent = ''; }, 6500);
    });
  };

  const save = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch { announce('Browser storage is full. Please delete older records or use a smaller photo.'); return false; }
  };

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(data)) return data;
    } catch { /* use seed */ }
    const s = SEED();
    save(s);
    return s;
  };

  // Tabs
  const activateTab = (target, focus = false) => {
    tabs.forEach((t) => {
      const on = t === target;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = panels.find((x) => x.id === t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    if (focus) target.focus();
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activateTab(t));
    t.addEventListener('keydown', (e) => {
      const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (next !== undefined) { e.preventDefault(); activateTab(tabs[next], true); }
    });
  });

  // Validation
  const syncField = (c, force = false) => {
    if (!c.matches?.('input, select, textarea') || c.type === 'radio' || c.type === 'file') return;
    let bad = false;
    try { bad = c.matches(':user-invalid'); } catch { bad = force && !c.validity.valid; }
    if (force && !CSS.supports('selector(:user-invalid)')) {
      c.classList.toggle('user-invalid-fallback', !c.validity.valid);
      c.classList.toggle('user-valid-fallback', c.validity.valid);
      bad = !c.validity.valid;
    }
    c.setAttribute('aria-invalid', String(bad));
    const errId = c.dataset.error;
    if (!errId) return;
    const ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== errId);
    if (bad) ids.push(errId);
    if (ids.length) c.setAttribute('aria-describedby', ids.join(' '));
    else c.removeAttribute('aria-describedby');
  };

  const syncSev = (show) => { $('severity-error').hidden = radios.some((r) => r.checked) || !show; };

  form.addEventListener('blur', (e) => syncField(e.target, true), true);
  form.addEventListener('input', (e) => e.target.hasAttribute('aria-invalid') && syncField(e.target));
  form.addEventListener('change', (e) => (e.target.name === 'severity' ? syncSev(false) : syncField(e.target, true)));
  form.addEventListener('invalid', (e) => {
    if (e.target.name === 'severity') return syncSev(true);
    e.target.classList.add('user-invalid-fallback');
    syncField(e.target, true);
  }, true);

  // GPS & Photo
  $('gps-btn').addEventListener('click', () => {
    const loc = $('issue-location');
    if (!('geolocation' in navigator)) { announce('GPS unavailable. Enter street or landmark.'); return loc.focus(); }
    const btn = $('gps-btn');
    btn.disabled = true;
    btn.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordsTxt = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        loc.value = `GPS (${coordsTxt})`;
        syncField(loc, true);
        btn.disabled = false;
        btn.textContent = 'Use GPS';
        announce(`Location filled (${coordsTxt}).`);
      },
      () => { btn.disabled = false; btn.textContent = 'Use GPS'; announce('Unable to read GPS. Enter location manually.'); loc.focus(); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  const clearPhoto = () => {
    photoUrl = '';
    $('issue-photo').value = '';
    $('photo-preview-img').removeAttribute('src');
    $('photo-preview-figure').hidden = true;
  };

  $('issue-photo').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return clearPhoto();
    if (!file.type.startsWith('image/')) { announce('Please choose a valid image file.'); return clearPhoto(); }
    const r = new FileReader();
    r.onload = (ev) => {
      const raw = String(ev.target?.result || '');
      const img = new Image();
      img.onload = () => {
        if (img.width <= 640 && raw.length <= 280000) photoUrl = raw;
        else {
          const s = Math.min(1, 640 / img.width);
          const c = el('canvas', { width: Math.round(img.width * s), height: Math.round(img.height * s) });
          c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
          photoUrl = c.toDataURL('image/jpeg', 0.72);
        }
        $('photo-preview-img').src = photoUrl;
        $('photo-preview-caption').textContent = `Photo attached: ${file.name}`;
        $('photo-preview-figure').hidden = false;
      };
      img.onerror = clearPhoto;
      img.src = raw;
    };
    r.readAsDataURL(file);
  });

  $('clear-photo-btn').addEventListener('click', () => { clearPhoto(); $('issue-photo').focus(); });

  form.addEventListener('reset', () => setTimeout(() => {
    clearPhoto();
    $('severity-error').hidden = true;
    ['issue-type', 'issue-location', 'issue-description'].forEach((id) => {
      const c = $(id);
      c.classList.remove('user-invalid-fallback', 'user-valid-fallback');
      c.setAttribute('aria-invalid', 'false');
      syncField(c);
    });
  }, 0));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const severity = radios.find((r) => r.checked)?.value || '';
    if (!severity) syncSev(true);
    if (!form.checkValidity()) { form.reportValidity(); return form.querySelector(':invalid')?.focus(); }

    const max = issues.reduce((a, i) => Math.max(a, Number((/^ISS-(\d+)$/.exec(i.id) || [])[1] || 1000)), 1000);
    const issue = {
      id: `ISS-${max + 1}`,
      type: $('issue-type').value,
      location: $('issue-location').value.trim(),
      severity,
      description: $('issue-description').value.trim(),
      photoDataUrl: photoUrl,
      status: 'Reported',
      crew: 'Unassigned',
      reportedAt: today(),
      createdAt: Date.now(),
      resolutionNote: '',
      resolvedAt: '',
    };
    if (!save([issue, ...issues])) return;
    issues.unshift(issue);
    form.reset();
    renderAll();
    activateTab($('tab-queue'), true);
    announce(`Submitted ${issue.id} (${issue.type} at ${issue.location}) to the Priority Queue.`);
  });

  // Render Helpers
  const timeEl = (iso) => el('time', { dateTime: iso, text: fmtDate(iso) });
  const delBtn = (issue, src) => el('button', {
    type: 'button',
    class: src === 'records' ? 'btn-danger btn-sm' : 'btn-danger',
    text: 'Delete',
    'aria-label': `Delete report ${issue.id}: ${issue.type} at ${issue.location}`,
    on: { click: () => openDelete(issue.id, src) },
  });
  const makeSelect = (id, label, opts, val, onChange) => el('div', { class: 'control-group' },
    el('label', { htmlFor: id, text: label }),
    el('select', { id, name: id, on: { change: (e) => onChange(e.target) } }, ...opts.map((v) => el('option', { value: v, text: v, selected: v === val })))
  );

  function renderQueue() {
    const active = issues.filter((i) => i.status !== 'Resolved');
    const sevF = $('filter-severity').value;
    const statF = $('filter-status').value;
    const list = active
      .filter((i) => (sevF === 'All' || i.severity === sevF) && (statF === 'All' || i.status === statF))
      .sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9) || (b.createdAt || 0) - (a.createdAt || 0));

    queueList.textContent = '';
    const empty = $('queue-empty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.textContent = active.length ? 'No active issues match the selected filters.' : 'All caught up! There are no active issues in the Priority Queue.';
      return;
    }

    queueList.append(...list.map((i) => el('li', {},
      el('article', { class: 'issue-card', dataset: { severity: i.severity } },
        el('div', { class: 'issue-header' },
          el('h3', { class: 'issue-title', text: `${i.type} \u2014 ${i.location}` }),
          el('span', { class: `severity-badge severity-${i.severity.toLowerCase()}`, text: `${i.severity} Severity` })
        ),
        el('div', { class: i.photoDataUrl ? 'issue-body has-photo' : 'issue-body' },
          el('div', {},
            el('p', { class: 'issue-description', text: i.description }),
            el('dl', { class: 'issue-meta' },
              ...[['Ticket ID', i.id], ['Location', i.location], ['Reported', timeEl(i.reportedAt)], ['Status', i.status], ['Assigned Crew', i.crew]]
                .map(([dt, dd]) => el('div', { class: 'meta-item' }, el('dt', { text: dt }), el('dd', typeof dd === 'string' ? { text: dd } : {}, typeof dd === 'string' ? null : dd)))
            )
          ),
          i.photoDataUrl && el('figure', { class: 'issue-figure' },
            el('img', { src: i.photoDataUrl, alt: `${i.type} at ${i.location}`, width: 240, height: 152, loading: 'lazy' }),
            el('figcaption', { text: `Photo evidence for ${i.id}` })
          )
        ),
        el('div', { class: 'issue-controls' },
          makeSelect(`assign-${i.id}`, 'Work Assignment', CREWS, i.crew, (s) => {
            i.crew = s.value;
            if (s.value !== 'Unassigned' && i.status === 'Reported') i.status = 'Assigned';
            else if (s.value === 'Unassigned' && i.status === 'Assigned') i.status = 'Reported';
            save(issues); renderAll(); announce(`Assigned ${i.id} to ${s.value}.`);
          }),
          makeSelect(`status-${i.id}`, 'Status', STATUSES, i.status, (s) => {
            if (s.value === 'Resolved') return openResolve(i.id, s);
            i.status = s.value; save(issues); renderAll(); announce(`Updated ${i.id} status to ${s.value}.`);
          }),
          el('div', { class: 'issue-action-group' },
            el('button', { type: 'button', class: 'btn-primary', text: 'Mark Resolved', on: { click: () => openResolve(i.id, null) } }),
            delBtn(i, 'queue')
          )
        )
      )
    )));
  }

  function renderRecords() {
    const done = issues.filter((i) => i.status === 'Resolved').sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || ''));
    recordsTbody.textContent = '';
    $('records-table-wrapper').hidden = !done.length;
    $('records-empty').hidden = !!done.length;
    if (!done.length) return;

    recordsTbody.append(...done.map((i) => el('tr', {},
      el('td', { text: `${i.type} (${i.severity})` }),
      el('td', { text: i.location }),
      el('td', {}, i.photoDataUrl
        ? el('img', { class: 'record-thumb', src: i.photoDataUrl, alt: `Resolved ${i.type} at ${i.location}`, width: 88, height: 60, loading: 'lazy' })
        : el('span', { class: 'no-photo-text', text: 'No photo' })),
      el('td', { text: i.crew }),
      el('td', { text: i.resolutionNote || 'Resolved' }),
      el('td', {}, timeEl(i.resolvedAt)),
      el('td', {}, delBtn(i, 'records'))
    )));
  }

  // Native Dialogs
  const openResolve = (id, sel) => {
    const i = issues.find((x) => x.id === id);
    if (!i) return;
    pendingResolve = { id, sel };
    $('resolve-dialog-summary').textContent = `${i.id}: ${i.type} at ${i.location} (${i.severity} Severity)`;
    $('resolution-note').value = '';
    resolveDialog.returnValue = '';
    resolveDialog.showModal();
  };

  resolveDialog.addEventListener('close', () => {
    const res = resolveDialog.returnValue;
    resolveDialog.returnValue = '';
    const ctx = pendingResolve; pendingResolve = null;
    const i = ctx && issues.find((x) => x.id === ctx.id);
    if (!i) return;
    if (res === 'confirm') {
      i.status = 'Resolved';
      i.resolutionNote = $('resolution-note').value.trim();
      i.resolvedAt = today();
      save(issues); renderAll(); announce(`Issue ${i.id} resolved and moved to Resolution Records.`);
    } else if (ctx.sel) ctx.sel.value = i.status;
  });

  const openDelete = (id, src) => {
    const i = issues.find((x) => x.id === id);
    if (!i) return;
    pendingDelete = { id, src };
    $('delete-dialog-summary').textContent = `${i.id}: ${i.type} at ${i.location}. ${i.status === 'Resolved' ? 'This resolved record will be permanently removed.' : 'This active report will be withdrawn and permanently removed.'}`;
    deleteDialog.returnValue = '';
    deleteDialog.showModal();
  };

  deleteDialog.addEventListener('close', () => {
    const res = deleteDialog.returnValue;
    deleteDialog.returnValue = '';
    const ctx = pendingDelete; pendingDelete = null;
    if (res !== 'confirm' || !ctx) return;
    const i = issues.find((x) => x.id === ctx.id);
    if (!i) return;
    issues = issues.filter((x) => x.id !== ctx.id);
    save(issues); renderAll(); announce(`Deleted report ${i.id} (${i.type} at ${i.location}).`);
    if (ctx.src === 'queue') (queueList.querySelector('.btn-danger') || $('filter-severity')).focus();
    else (recordsTbody.querySelector('.btn-danger') || $('tab-records')).focus();
  });

  function renderAll() {
    const active = issues.filter((i) => i.status !== 'Resolved').length;
    $('queue-count').textContent = `(${active})`;
    $('records-count').textContent = `(${issues.length - active})`;
    renderQueue();
    renderRecords();
  }

  $('filter-severity').addEventListener('change', renderQueue);
  $('filter-status').addEventListener('change', renderQueue);

  issues = load();
  renderAll();
})();
