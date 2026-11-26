const KEY = 'road_issues_data';
const CREWS = ['Unassigned', 'Road Crew A', 'Signal Team B', 'Maintenance Team C'];
const STATUSES = ['Reported', 'Assigned', 'In Progress', 'Resolved'];

const form = document.getElementById('report-form');
const banner = document.getElementById('status-banner');
const queueList = document.getElementById('queue-list');
const recordsTbody = document.getElementById('records-tbody');
const resolveDialog = document.getElementById('resolve-dialog');
const deleteDialog = document.getElementById('delete-dialog');
const tabButtons = document.querySelectorAll('[role="tab"]');

let issues = [];
let photoData = '';
let resolveId = null;
let resolveSelect = null;
let deleteId = null;

function starterData() {
  return [
    { id: 'ISS-1', type: 'Broken Signal', location: 'Main St & 5th Ave', severity: 'High', description: 'Traffic signal is out at intersection.', photo: '', status: 'Assigned', crew: 'Signal Team B', reportedDate: '2026-11-24', resolutionNote: '', resolvedDate: '' },
    { id: 'ISS-2', type: 'Pothole', location: 'Elm Blvd near Oak Park', severity: 'Medium', description: 'Deep pothole in the right lane.', photo: '', status: 'Reported', crew: 'Unassigned', reportedDate: '2026-11-25', resolutionNote: '', resolvedDate: '' },
    { id: 'ISS-3', type: 'Damaged Road', location: 'River Rd Bridge', severity: 'High', description: 'Cracked pavement near bridge entrance.', photo: '', status: 'Resolved', crew: 'Road Crew A', reportedDate: '2026-11-20', resolutionNote: 'Filled cracks and repaved.', resolvedDate: '2026-11-22' }
  ];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function make(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(issues));
}

function load() {
  const saved = localStorage.getItem(KEY);
  if (!saved) {
    issues = starterData();
    save();
  } else {
    issues = JSON.parse(saved);
  }
}

// Tabs
function openTab(target) {
  for (let i = 0; i < tabButtons.length; i++) {
    const btn = tabButtons[i];
    const on = btn === target;
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !on;
  }
}

for (let i = 0; i < tabButtons.length; i++) {
  tabButtons[i].addEventListener('click', function () {
    openTab(this);
  });
  tabButtons[i].addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % tabButtons.length : (i - 1 + tabButtons.length) % tabButtons.length;
    openTab(tabButtons[next]);
    tabButtons[next].focus();
  });
}

// GPS & Photo
document.getElementById('gps-btn').addEventListener('click', function () {
  if (!navigator.geolocation) return (banner.textContent = 'GPS not supported.');
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      document.getElementById('issue-location').value = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
      banner.textContent = 'GPS location added.';
    },
    function () { banner.textContent = 'Could not get GPS location.'; }
  );
});

function clearPhoto() {
  photoData = '';
  document.getElementById('issue-photo').value = '';
  document.getElementById('photo-img').removeAttribute('src');
  document.getElementById('photo-preview').hidden = true;
}

document.getElementById('issue-photo').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return clearPhoto();
  const reader = new FileReader();
  reader.onload = function (e) {
    photoData = e.target.result;
    document.getElementById('photo-img').src = photoData;
    document.getElementById('photo-caption').textContent = file.name;
    document.getElementById('photo-preview').hidden = false;
  };
  reader.readAsDataURL(file);
});

document.getElementById('remove-photo-btn').addEventListener('click', clearPhoto);
form.addEventListener('reset', clearPhoto);

// Submit Issue
form.addEventListener('submit', function (e) {
  e.preventDefault();
  const sev = document.querySelector('input[name="severity"]:checked').value;
  issues.unshift({
    id: 'ISS-' + Date.now().toString().slice(-4),
    type: document.getElementById('issue-type').value,
    location: document.getElementById('issue-location').value.trim(),
    severity: sev,
    description: document.getElementById('issue-description').value.trim(),
    photo: photoData,
    status: 'Reported',
    crew: 'Unassigned',
    reportedDate: today(),
    resolutionNote: '',
    resolvedDate: ''
  });
  save();
  form.reset();
  renderAll();
  openTab(document.getElementById('tab-queue'));
  banner.textContent = 'Issue submitted to Priority Queue.';
});

function makeSelect(id, labelText, list, current) {
  const wrap = make('div');
  const label = make('label', labelText);
  label.htmlFor = id;
  const select = make('select');
  select.id = id;
  for (let i = 0; i < list.length; i++) {
    const opt = make('option', list[i]);
    opt.value = list[i];
    if (list[i] === current) opt.selected = true;
    select.appendChild(opt);
  }
  wrap.append(label, select);
  return { wrap: wrap, select: select };
}

function makeTime(dateStr) {
  const t = make('time', dateStr);
  t.setAttribute('datetime', dateStr);
  return t;
}

// Render Queue
function renderQueue() {
  const sevFilter = document.getElementById('filter-severity').value;
  const statFilter = document.getElementById('filter-status').value;
  const rank = { High: 1, Medium: 2, Low: 3 };

  const active = issues
    .filter(function (i) {
      return i.status !== 'Resolved' &&
        (sevFilter === 'All' || i.severity === sevFilter) &&
        (statFilter === 'All' || i.status === statFilter);
    })
    .sort(function (a, b) {
      return rank[a.severity] - rank[b.severity] || b.reportedDate.localeCompare(a.reportedDate);
    });

  queueList.innerHTML = '';
  document.getElementById('queue-empty').hidden = active.length > 0;

  for (let i = 0; i < active.length; i++) {
    const issue = active[i];
    const card = make('article', '', 'box');

    card.append(
      make('h3', issue.type + ' - ' + issue.location),
      make('span', issue.severity, 'badge ' + issue.severity.toLowerCase()),
      make('p', issue.description)
    );

    const dl = make('dl');
    const fields = [['ID', issue.id], ['Location', issue.location], ['Status', issue.status], ['Crew', issue.crew]];
    for (let j = 0; j < fields.length; j++) {
      const box = make('div');
      box.append(make('dt', fields[j][0]), make('dd', fields[j][1]));
      dl.appendChild(box);
    }
    const dateBox = make('div');
    const ddTime = make('dd');
    ddTime.appendChild(makeTime(issue.reportedDate));
    dateBox.append(make('dt', 'Reported'), ddTime);
    dl.appendChild(dateBox);
    card.appendChild(dl);

    if (issue.photo) {
      const fig = make('figure');
      const img = make('img');
      img.src = issue.photo;
      img.alt = issue.type + ' at ' + issue.location;
      fig.append(img, make('figcaption', 'Photo for ' + issue.id));
      card.appendChild(fig);
    }

    const row = make('div', '', 'row');
    const crewSel = makeSelect('assign-' + issue.id, 'Work Assignment', CREWS, issue.crew);
    crewSel.select.addEventListener('change', function () {
      issue.crew = this.value;
      if (issue.crew !== 'Unassigned' && issue.status === 'Reported') issue.status = 'Assigned';
      save();
      renderAll();
      banner.textContent = 'Assigned ' + issue.id + ' to ' + issue.crew + '.';
    });

    const statSel = makeSelect('status-' + issue.id, 'Status', STATUSES, issue.status);
    statSel.select.addEventListener('change', function () {
      if (this.value === 'Resolved') return openResolve(issue, this);
      issue.status = this.value;
      save();
      renderAll();
      banner.textContent = 'Updated ' + issue.id + ' status to ' + issue.status + '.';
    });

    const resBtn = make('button', 'Mark Resolved', 'blue');
    resBtn.type = 'button';
    resBtn.addEventListener('click', function () { openResolve(issue, null); });

    const delBtn = make('button', 'Delete', 'red');
    delBtn.type = 'button';
    delBtn.addEventListener('click', function () { openDelete(issue); });

    row.append(crewSel.wrap, statSel.wrap, resBtn, delBtn);
    card.appendChild(row);
    queueList.appendChild(card);
  }
}

// Render Records Table
function renderRecords() {
  const done = issues.filter(function (i) { return i.status === 'Resolved'; });
  recordsTbody.innerHTML = '';
  document.getElementById('records-box').hidden = done.length === 0;
  document.getElementById('records-empty').hidden = done.length > 0;

  for (let i = 0; i < done.length; i++) {
    const issue = done[i];
    const tr = make('tr');

    const photoTd = make('td');
    if (issue.photo) {
      const img = make('img', '', 'thumb');
      img.src = issue.photo;
      img.alt = issue.type + ' at ' + issue.location;
      photoTd.appendChild(img);
    } else {
      photoTd.textContent = 'No photo';
    }

    const dateTd = make('td');
    dateTd.appendChild(makeTime(issue.resolvedDate));

    const delTd = make('td');
    const delBtn = make('button', 'Delete', 'red');
    delBtn.type = 'button';
    delBtn.addEventListener('click', function () { openDelete(issue); });
    delTd.appendChild(delBtn);

    tr.append(make('td', issue.type), make('td', issue.location), photoTd, make('td', issue.crew), make('td', issue.resolutionNote), dateTd, delTd);
    recordsTbody.appendChild(tr);
  }
}

// Dialogs
function openResolve(issue, sel) {
  resolveId = issue.id;
  resolveSelect = sel;
  document.getElementById('resolve-summary').textContent = issue.type + ' - ' + issue.location;
  document.getElementById('resolution-note').value = '';
  resolveDialog.returnValue = '';
  resolveDialog.showModal();
}

resolveDialog.addEventListener('close', function () {
  const ans = resolveDialog.returnValue;
  resolveDialog.returnValue = '';
  for (let i = 0; i < issues.length; i++) {
    if (issues[i].id === resolveId) {
      if (ans === 'confirm') {
        issues[i].status = 'Resolved';
        issues[i].resolutionNote = document.getElementById('resolution-note').value.trim();
        issues[i].resolvedDate = today();
        save();
        renderAll();
        banner.textContent = 'Moved ' + issues[i].id + ' to Resolution Records.';
      } else if (resolveSelect) {
        resolveSelect.value = issues[i].status;
      }
      break;
    }
  }
  resolveId = null;
  resolveSelect = null;
});

function openDelete(issue) {
  deleteId = issue.id;
  document.getElementById('delete-summary').textContent = 'Delete ' + issue.type + ' at ' + issue.location + '?';
  deleteDialog.returnValue = '';
  deleteDialog.showModal();
}

deleteDialog.addEventListener('close', function () {
  if (deleteDialog.returnValue === 'confirm' && deleteId) {
    issues = issues.filter(function (i) { return i.id !== deleteId; });
    save();
    renderAll();
    banner.textContent = 'Report deleted.';
  }
  deleteDialog.returnValue = '';
  deleteId = null;
});

function renderAll() {
  const activeCount = issues.filter(function (i) { return i.status !== 'Resolved'; }).length;
  document.getElementById('queue-count').textContent = activeCount;
  document.getElementById('records-count').textContent = issues.length - activeCount;
  renderQueue();
  renderRecords();
}

document.getElementById('filter-severity').addEventListener('change', renderQueue);
document.getElementById('filter-status').addEventListener('change', renderQueue);

load();
renderAll();
