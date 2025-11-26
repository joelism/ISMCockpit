
/* ISM Cockpit – Police-style DB layout (orange/black), build: policeDB2 */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };

const keys = {
  session: 'ismc-session',
  cases: 'ismc-cases-v3',   // v3: Kontakte & Kurzberichte
  seq: 'ismc-case-seq',
  theme: 'ismc-theme',
  route: 'ismc-route'
};

const state = {
  session: load(keys.session),
  cases: load(keys.cases) || [],
  search: '',
  route: localStorage.getItem(keys.route) || '/'
};

/* ---------- Utils ---------- */
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function now(){ return Date.now(); }
function fmt(ts){ return new Date(ts).toLocaleString(undefined,{dateStyle:'medium', timeStyle:'short'}); }
function fmtDateInput(ts){ const d = new Date(ts); return d.toISOString().slice(0,10); }
function fmtDateTimeLocal(ts){ const d = new Date(ts); const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function uid(){ return (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); }
function escapeHtml(str=''){ return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- IndexedDB für Dateien ---------- */
const DB_NAME = 'ismc-files-db';
const DB_STORE = 'files';
let dbPromise = null;

function dbOpen(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (err) {
      return reject(err);
    }
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)){
        db.createObjectStore(DB_STORE, { keyPath:'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function dbPutFile(fileRec){
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).put(fileRec);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
async function dbGetFile(id){
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE,'readonly');
    const rq = tx.objectStore(DB_STORE).get(id);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function dbDeleteFile(id){
  const db = await dbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE,'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

/* ---------- Theme ---------- */
function initTheme(){
  const pref = localStorage.getItem(keys.theme);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (pref === 'dark' || (pref === null && prefersDark)) document.documentElement.classList.add('dark');
  const t = $('#themeToggle'); if (t) t.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}
function toggleTheme(){
  const on = document.documentElement.classList.toggle('dark');
  localStorage.setItem(keys.theme, on ? 'dark' : 'light');
  const t = $('#themeToggle'); if (t) t.textContent = on ? '☀️' : '🌙';
}

/* ---------- Router ---------- */
function go(route){ location.hash = route.startsWith('#') ? route : `#${route}`; }
function currentRoute(){ return location.hash.replace(/^#/, '') || '/'; }
function syncRoute(){
  const route = currentRoute();
  localStorage.setItem(keys.route, route);
  highlightNav(route);
  if (!state.session) return renderLogin();
  render(route);
}
function highlightNav(route){
  $$('.sidebar nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${route}`));
}

/* ---------- Login (PIN 500011) ---------- */
function renderLogin(){
  const view = $('#view');
  view.innerHTML = `
    <div class="login card db-card" style="max-width:460px;margin:40px auto;display:grid;gap:18px;">
      <header class="db-header">
        <div class="db-title">ISM Cockpit</div>
        <div class="db-subtitle">Secure Case Database · Switzerland</div>
      </header>
      <section class="db-body">
        <p><strong>Anmelden als A017</strong></p>
        <div class="field" style="display:grid;gap:6px;text-align:left">
          <label for="pinInput">PIN</label>
          <input id="pinInput" type="password" inputmode="numeric" placeholder="******" maxlength="12"
                 class="db-input">
          <label class="db-checkbox">
            <input type="checkbox" id="showPin"> Anzeigen
          </label>
        </div>
        <button id="loginBtn" class="primary db-primary">Jetzt einloggen</button>
        <div id="loginError" class="db-error" style="display:none;">Falscher PIN.</div>
      </section>
      <footer class="db-footer">ISM Internal Use Only · Unauthorized access prohibited</footer>
    </div>
  `;
  const pin = $('#pinInput');
  $('#showPin').onchange = e => { pin.type = e.target.checked ? 'text' : 'password'; };
  const tryLogin = () => {
    const ok = (pin.value || '').trim().replace(/\s+$/,'').replace(/\.+$/,'') === '500011';
    if (!ok){ $('#loginError').style.display='block'; pin.focus(); pin.select?.(); return; }
    state.session = { agent:'A017', org: ISM.org, loginAt: now() };
    save(keys.session, state.session);
    updateAgentBadge();
    render('/');
  };
  $('#loginBtn').onclick = tryLogin;
  pin.addEventListener('keyup', e => { if (e.key === 'Enter') tryLogin(); });
  setTimeout(()=>pin.focus(), 0);
}
function logout(){ state.session=null; localStorage.removeItem(keys.session); renderLogin(); }
function updateAgentBadge(){
  const el = document.querySelector('#agentBadge #agentId');
  if (el && state.session){ el.textContent = `${state.session.agent} • ${ISM.org}`; }
}

/* ---------- Fallnummer-Helfer ---------- */
function nextCaseNumber(){
  const agent = (state.session?.agent) || 'A017';
  const seq = (parseInt(localStorage.getItem(keys.seq) || '9', 10) + 1);
  localStorage.setItem(keys.seq, String(seq));
  const triple = String(seq).padStart(3,'0');
  return `F${triple}${agent}`;
}

/* ---------- Views ---------- */
function render(route){
  if (!state.session) return renderLogin();
  const view = $('#view'); view.innerHTML='';
  updateAgentBadge();
  if (route === '/' || route === '') return renderDashboard();
  if (route === '/cases') return renderCases();
  if (route === '/help') return renderHelp();
  if (route === '/my') return renderMy();
  if (route === '/settings') return renderSettings();
  const err = document.createElement('div'); err.className='card db-card'; err.textContent='Seite nicht gefunden.'; view.appendChild(err);
}

function renderDashboard(){
  const view = $('#view');
  const wrap = document.createElement('div'); wrap.className = 'grid k3';

  const c1 = document.createElement('div'); c1.className='card db-card';
  const totalShorts = state.cases.reduce((acc,c)=> acc + (c.shorts?.length||0), 0);
  c1.innerHTML = `<h2>📁 Fälle</h2>
                  <p class="db-kpi">${state.cases.length}</p>
                  <p class="db-kpi-label">Gesamt-Fälle</p>
                  <div class="btn-row"><a class="btn" href="#/cases">Fallübersicht öffnen</a></div>`;
  const c2 = document.createElement('div'); c2.className='card db-card';
  c2.innerHTML = `<h2>⚡ Kurzberichte</h2>
                  <p class="db-kpi">${totalShorts}</p>
                  <p class="db-kpi-label">Einträge in allen Fällen</p>`;
  const c3 = document.createElement('div'); c3.className='card db-card';
  c3.innerHTML = `<h2>🪪 My ISM</h2>
                  <p>Ihr Ausweis erscheint in Kürze hier.</p>
                  <div class="btn-row"><a class="btn" href="#/my">My ISM öffnen</a></div>`;

  wrap.append(c1,c2,c3);
  view.appendChild(wrap);

  // Feed letzte Kurzberichte
  const feedCard = document.createElement('div'); feedCard.className='card db-card';
  feedCard.innerHTML = `<h3>Letzte Kurzberichte</h3>`;
  const table = document.createElement('div'); table.className='db-table';
  const header = document.createElement('div'); header.className='db-row db-row-head';
  header.innerHTML = `<div>Fall</div><div>Datum/Zeit</div><div>Text</div>`;
  table.appendChild(header);

  const allShorts = [];
  state.cases.forEach(c => {
    (c.shorts||[]).forEach(s => allShorts.push({ caseTitle:c.title, s }));
  });
  allShorts.sort((a,b)=> (new Date(b.s.dt)) - (new Date(a.s.dt)));
  allShorts.slice(0,8).forEach(entry => {
    const row = document.createElement('div'); row.className='db-row';
    row.innerHTML = `
      <div>${escapeHtml(entry.caseTitle)}</div>
      <div>${new Date(entry.s.dt).toLocaleString()}</div>
      <div class="db-cell-text">${escapeHtml(entry.s.text)}</div>`;
    table.appendChild(row);
  });
  if (!allShorts.length){
    const row = document.createElement('div'); row.className='db-row';
    row.innerHTML = `<div colspan="3" class="db-cell-empty">Noch keine Kurzberichte vorhanden.</div>`;
    table.appendChild(row);
  }
  feedCard.appendChild(table);
  view.appendChild(feedCard);
}

/* -------------------------------------------
   FÄLLE – mit Tabs: Akte | Berichte | Kurzberichte | Kontakte
-------------------------------------------- */
function renderCases(){
  const view = $('#view');
  const h2 = document.createElement('h2'); h2.textContent='📁 Fall-Datenbank';
  const container = document.createElement('div'); container.className='columns db-columns';

  // LEFT: Fälle anlegen/listen
  const left = document.createElement('div'); left.className='pane db-pane-left';
  const newCaseName = Object.assign(document.createElement('input'), { placeholder:'Fallnummer (z. B. F010A017)', value: nextCaseNumber(), className:'db-input' });
  const addCaseBtn = Object.assign(document.createElement('button'), { textContent:'+ Fall anlegen', className:'primary db-primary' });
  const genBtn = Object.assign(document.createElement('button'), { textContent:'Fallnummer neu generieren', className:'db-btn-ghost' });
  addCaseBtn.addEventListener('click', () => {
    const name = newCaseName.value.trim(); if (!name) return;
    state.cases.push({
      id: uid(), title: name, created: now(),
      status: 'open',
      folders: [],
      contacts: [],
      shorts: []
    });
    save(keys.cases, state.cases); newCaseName.value = nextCaseNumber(); render('/cases');
  });
  genBtn.addEventListener('click', () => { newCaseName.value = nextCaseNumber(); });
  const caseCreator = document.createElement('div'); caseCreator.className='card db-card grid'; caseCreator.append(newCaseName, addCaseBtn, genBtn);
  left.append(caseCreator);

  const searchBox = document.createElement('input');
  searchBox.className = 'db-input';
  searchBox.placeholder = 'Suche nach Fallnummer / Name / EL-Nr.';
  searchBox.value = state.search;
  searchBox.addEventListener('input', e => {
    state.search = e.target.value;
    render('/cases');
  });
  const searchCard = document.createElement('div'); searchCard.className='card db-card'; searchCard.append(searchBox);
  left.append(searchCard);

  const list = document.createElement('div'); list.className='list db-case-list';
  const q = state.search.trim().toLowerCase();
  state.cases
    .slice().sort((a,b)=>b.created-a.created)
    .filter(c => {
      if (!q) return true;
      const hay = [
        c.title,
        ...(c.contacts||[]).map(x=>x.name||''),
        ...(c.contacts||[]).map(x=>x.el||'')
      ].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .forEach(c => {
      const item = document.createElement('div'); item.className='case db-case-row';
      const statusLabel = c.status==='closed' ? 'Abgeschlossen' : c.status==='progress' ? 'In Bearbeitung' : 'Offen';
      item.innerHTML = `
        <div class="db-case-main">
          <div class="db-case-title">${escapeHtml(c.title)}</div>
          <div class="db-case-meta">Angelegt: ${fmt(c.created)}</div>
          <div class="db-case-meta">Ordner: ${c.folders.length} · Kontakte: ${c.contacts?.length||0} · Kurzberichte: ${c.shorts?.length||0}</div>
        </div>
        <div class="db-case-actions">
          <span class="db-status db-status-${c.status||'open'}">${statusLabel}</span>
          <div class="btn-row">
            <button data-act="open" data-id="${c.id}">Öffnen</button>
            <button data-act="del" data-id="${c.id}">Löschen</button>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  left.append(list);

  // RIGHT: ausgewählter Fall
  const right = document.createElement('div'); right.className='pane db-pane-right';
  const selId = sessionStorage.getItem('ismc-selected-case');
  const selected = state.cases.find(c=>c.id===selId) || state.cases[0];

  if (selected){
    sessionStorage.setItem('ismc-selected-case', selected.id);

    // Kopfzeile mit Status
    const head = document.createElement('div'); head.className='card db-card db-case-head';
    const statusLabel = selected.status==='closed' ? 'Abgeschlossen' : selected.status==='progress' ? 'In Bearbeitung' : 'Offen';
    head.innerHTML = `
      <div class="db-case-head-main">
        <div class="db-case-head-title">${escapeHtml(selected.title)}</div>
        <div class="db-case-head-meta">Angelegt: ${fmt(selected.created)}</div>
      </div>
      <div class="db-case-head-actions">
        <select id="caseStatusSelect" class="db-input db-select">
          <option value="open"${selected.status==='open'?' selected':''}>Offen</option>
          <option value="progress"${selected.status==='progress'?' selected':''}>In Bearbeitung</option>
          <option value="closed"${selected.status==='closed'?' selected':''}>Abgeschlossen</option>
        </select>
        <span class="db-status db-status-${selected.status||'open'}" id="caseStatusBadge">${statusLabel}</span>
      </div>
      <div class="tabbar">
        <button data-tab="files" class="active">📂 Akte & Dateien</button>
        <button data-tab="reports">📄 Berichte</button>
        <button data-tab="shorts">⚡ Kurzberichte</button>
        <button data-tab="contacts">👥 Kontakte</button>
      </div>
    `;
    right.append(head);

    const body = document.createElement('div'); body.className='tabcontent'; right.append(body);

    const switchTab = (name) => {
      $$('.tabbar button', head).forEach	b=>b.classList.toggle('active', b.dataset.tab===name));
      body.innerHTML='';
      if (name==='files') renderTabFiles(selected, body);
      if (name==='reports') renderTabReports(selected, body);
      if (name==='shorts') renderTabShortsCase(selected, body);
      if (name==='contacts') renderTabContacts(selected, body);
    };
    head.querySelector('.tabbar').addEventListener('click', e => {
      const t=e.target.closest('button'); if(t) switchTab(t.dataset.tab);
    });
    switchTab('files');

    const statusSelect = head.querySelector('#caseStatusSelect');
    const statusBadge  = head.querySelector('#caseStatusBadge');
    statusSelect.addEventListener('change', e => {
      selected.status = e.target.value;
      save(keys.cases, state.cases);
      const label = selected.status==='closed' ? 'Abgeschlossen' : selected.status==='progress' ? 'In Bearbeitung' : 'Offen';
      statusBadge.textContent = label;
      statusBadge.className = `db-status db-status-${selected.status}`;
      render('/cases');
    });
  } else {
    const empty = document.createElement('div'); empty.className='card db-card'; empty.textContent='Noch kein Fall angelegt.';
    right.append(empty);
  }

  // Klick-Handler links (Fall öffnen/löschen)
  left.addEventListener('click', async e => {
    const t = e.target;
    const id = t?.dataset?.id;
    const act = t?.dataset?.act;
    if (act === 'open' && id){
      sessionStorage.setItem('ismc-selected-case', id); render('/cases');
    } else if (act === 'del' && id){
      if (confirm('Diesen Fall komplett löschen?')){
        const c = state.cases.find(x=>x.id===id);
        if (c){
          for (const f of (c.folders||[])){
            for (const m of (f.files||[])){ try{ await dbDeleteFile(m.id); }catch{} }
          }
        }
        state.cases = state.cases.filter(c=>c.id!==id);
        save(keys.cases, state.cases);
        sessionStorage.removeItem('ismc-selected-case');
        render('/cases');
      }
    }
  });

  view.append(h2, container);
  container.append(left, right);
}

/* ---------- Tab: Akte & Dateien ---------- */
function renderTabFiles(selected, body){
  const newFolderName = Object.assign(document.createElement('input'), { placeholder:'Neuer Unterordner (z. B. Berichte)', className:'db-input' });
  const addFolderBtn = Object.assign(document.createElement('button'), { textContent:'+ Unterordner anlegen', className:'primary db-primary' });
  addFolderBtn.addEventListener('click', () => {
    const name = newFolderName.value.trim(); if (!name) return;
    selected.folders.push({ id: uid(), name, docs: [], files: [] });
    save(keys.cases, state.cases); newFolderName.value=''; render('/cases');
  });
  const folderCreator = document.createElement('div'); folderCreator.className='card db-card grid'; folderCreator.append(newFolderName, addFolderBtn);
  body.append(folderCreator);

  selected.folders.forEach(f => {
    const box = document.createElement('div'); box.className='card db-card';
    const title = document.createElement('div'); title.className='db-section-title';
    title.textContent = `Ordner: ${f.name}`;
    const exportBtn = Object.assign(document.createElement('button'), { textContent:'Ordner exportieren (JSON)', className:'db-btn-ghost' });
    exportBtn.addEventListener('click', ()=> exportFolder(selected, f));
    const headRow = document.createElement('div'); headRow.className='db-section-head';
    headRow.append(title, exportBtn);
    box.append(headRow);

    /* Dateien */
    const filesSec = document.createElement('div'); filesSec.className='grid';
    const fileInput = Object.assign(document.createElement('input'), { type:'file', multiple:true, accept:'.txt,image/*' });
    const uploadBtn = Object.assign(document.createElement('button'), { textContent:'+ Dateien hinzufügen', className:'db-btn-ghost' });
    uploadBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files){
        const id = uid();
        const isImage = file.type.startsWith('image/');
        const rec = { id, name:file.name, type:file.type, size:file.size, created: now(), blob: file };
        await dbPutFile(rec);
        f.files = f.files || [];
        f.files.push({ id, name:file.name, type:file.type, size:file.size, created: now(), isImage });
      }
      save(keys.cases, state.cases);
      render('/cases');
    });
    filesSec.append(uploadBtn);

    const filesTable = document.createElement('div'); filesTable.className='db-table';
    const header = document.createElement('div'); header.className='db-row db-row-head';
    header.innerHTML = `<div>Datei</div><div>Typ</div><div>Größe</div><div>Datum</div><div>Aktionen</div>`;
    filesTable.appendChild(header);

    (f.files||[]).slice().sort((a,b)=>b.created-a.created).forEach(meta => {
      const row = document.createElement('div'); row.className='db-row';
      const typeLabel = (meta.type||'').split('/')[0]||'file';
      const sizeLabel = (meta.size/1024).toFixed(1)+' KB';
      const actions = document.createElement('div'); actions.className='btn-row';
      const viewBtn = Object.assign(document.createElement('button'), { textContent: meta.isImage?'Ansehen':'Herunterladen' });
      viewBtn.addEventListener('click', async ()=>{
        const rec = await dbGetFile(meta.id);
        if (!rec) return alert('Datei nicht gefunden (Speicher).');
        const url = URL.createObjectURL(rec.blob);
        if (meta.isImage){
          const w = window.open(); if (w) w.document.write(`<img src="${url}" style="max-width:100%;height:auto">`);
        } else {
          const a = document.createElement('a'); a.href = url; a.download = meta.name; a.click();
        }
        setTimeout(()=>URL.revokeObjectURL(url), 10000);
      });
      const delBtn = Object.assign(document.createElement('button'), { textContent:'Löschen' });
      delBtn.addEventListener('click', async ()=>{
        if (!confirm(`Datei „${meta.name}“ löschen?`)) return;
        await dbDeleteFile(meta.id);
        f.files = (f.files||[]).filter(x=>x.id !== meta.id);
        save(keys.cases, state.cases);
        render('/cases');
      });
      actions.append(viewBtn, delBtn);

      row.innerHTML = `
        <div>${escapeHtml(meta.name)}</div>
        <div>${escapeHtml(typeLabel)}</div>
        <div>${escapeHtml(sizeLabel)}</div>
        <div>${fmt(meta.created)}</div>`;
      const actionsCell = document.createElement('div');
      actionsCell.appendChild(actions);
      row.appendChild(actionsCell);
      filesTable.appendChild(row);
    });
    if (!f.files || !f.files.length){
      const emptyRow = document.createElement('div'); emptyRow.className='db-row';
      emptyRow.innerHTML = `<div class="db-cell-empty" colspan="5">Noch keine Dateien.</div>`;
      filesTable.appendChild(emptyRow);
    }
    filesSec.append(filesTable);
    box.append(filesSec);
    body.append(box);
  });
}

/* ---------- Tab: Berichte ---------- */
function renderTabReports(selected, body){
  const box = document.createElement('div'); box.className='card db-card';
  const title = document.createElement('div'); title.className='db-section-title'; title.textContent='Bericht erfassen';
  box.append(title);

  const form = document.createElement('div'); form.className='grid db-form-grid';
  const type = document.createElement('select'); type.className='db-input db-select';
  ['Personenbericht','Erstbericht','Abschlussbericht','Kurzbericht'].forEach(t => {
    const o = document.createElement('option'); o.value=t; o.textContent=t; type.appendChild(o);
  });
  const date = Object.assign(document.createElement('input'), { type:'date', value: fmtDateInput(Date.now()), className:'db-input' });
  const rtitle = Object.assign(document.createElement('input'), { placeholder:'Berichtstitel', className:'db-input' });
  const bodyTxt = Object.assign(document.createElement('textarea'), { placeholder:'Berichtstext …', rows:5, className:'db-input' });
  const addDoc = Object.assign(document.createElement('button'), { textContent:'+ Bericht speichern', className:'primary db-primary' });
  addDoc.addEventListener('click', ()=>{
    let f = selected.folders.find(x=>x.name==='Berichte');
    if (!f){ f = { id: uid(), name:'Berichte', docs:[], files:[] }; selected.folders.push(f); }
    const doc = { id: uid(), kind: type.value, date: date.value, title: rtitle.value.trim(), body: bodyTxt.value.trim(), created: now(), updated: now() };
    if (!doc.title && !doc.body) return;
    f.docs.push(doc); save(keys.cases, state.cases);
    rtitle.value=''; bodyTxt.value='';
    render('/cases');
  });
  form.append(labelWrap('Typ', type), labelWrap('Datum', date), labelWrap('Titel', rtitle), labelWrap('Text', bodyTxt), addDoc);
  box.append(form);
  body.append(box);

  const f = selected.folders.find(x=>x.name==='Berichte');
  const table = document.createElement('div'); table.className='db-table';
  const header = document.createElement('div'); header.className='db-row db-row-head';
  header.innerHTML = `<div>Typ</div><div>Datum</div><div>Titel</div><div>Zuletzt</div><div>Aktionen</div>`;
  table.appendChild(header);

  (f?.docs||[]).slice().sort((a,b)=>b.updated-a.updated).forEach(d => {
    const row = document.createElement('div'); row.className='db-row';
    const actions = document.createElement('div'); actions.className='btn-row';
    const editBtn = Object.assign(document.createElement('button'), { textContent:'Bearb.' });
    const delBtn  = Object.assign(document.createElement('button'), { textContent:'Löschen' });
    editBtn.addEventListener('click', ()=>{
      const nt = prompt('Titel bearbeiten:', d.title||''); if (nt===null) return;
      const nb = prompt('Text bearbeiten:', d.body||''); if (nb===null) return;
      d.title = nt.trim(); d.body = nb.trim(); d.updated = now(); save(keys.cases, state.cases); render('/cases');
    });
    delBtn.addEventListener('click', ()=>{
      if (confirm('Bericht löschen?')){ f.docs = f.docs.filter(x=>x.id!==d.id); save(keys.cases, state.cases); render('/cases'); }
    });
    actions.append(editBtn, delBtn);

    row.innerHTML = `
      <div>${escapeHtml(d.kind)}</div>
      <div>${escapeHtml(d.date)}</div>
      <div>${escapeHtml(d.title||'(Ohne Titel)')}</div>
      <div>${fmt(d.updated)}</div>`;
    const actionsCell = document.createElement('div'); actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  });
  if (!f || !f.docs?.length){
    const emptyRow = document.createElement('div'); emptyRow.className='db-row';
    emptyRow.innerHTML = `<div class="db-cell-empty" colspan="5">Noch keine Berichte.</div>`;
    table.appendChild(emptyRow);
  }
  body.append(table);
}

/* ---------- Tab: Kurzberichte (Fall-Ebene) ---------- */
function renderTabShortsCase(selected, body){
  const card = document.createElement('div'); card.className='card db-card';
  const title = document.createElement('div'); title.className='db-section-title'; title.textContent='Kurzbericht erfassen';
  card.append(title);

  const form = document.createElement('div'); form.className='grid db-form-grid';
  const when = Object.assign(document.createElement('input'), { type:'datetime-local', value: fmtDateTimeLocal(Date.now()), className:'db-input' });
  const text = Object.assign(document.createElement('textarea'), { rows:3, placeholder:'Kurzbericht (max. einige Sätze) …', className:'db-input' });
  const add = Object.assign(document.createElement('button'), { className:'primary db-primary', textContent:'+ Kurzbericht speichern' });
  add.onclick = () => {
    const s = { id: uid(), dt: when.value, text: text.value.trim(), created: now() };
    if (!s.text) return;
    selected.shorts = selected.shorts || [];
    selected.shorts.push(s);
    save(keys.cases, state.cases);
    text.value=''; render('/cases');
  };
  form.append(labelWrap('Datum/Zeit', when), labelWrap('Text', text), add);
  card.append(form);
  body.append(card);

  const table = document.createElement('div'); table.className='db-table';
  const header = document.createElement('div'); header.className='db-row db-row-head';
  header.innerHTML = `<div>Datum/Zeit</div><div>Text</div><div>Aktionen</div>`;
  table.appendChild(header);

  (selected.shorts||[]).slice().sort((a,b)=> (new Date(b.dt)) - (new Date(a.dt))).forEach(s => {
    const row = document.createElement('div'); row.className='db-row';
    const actions = document.createElement('div'); actions.className='btn-row';
    const editBtn = Object.assign(document.createElement('button'), { textContent:'Bearb.' });
    const delBtn  = Object.assign(document.createElement('button'), { textContent:'Löschen' });
    editBtn.addEventListener('click', ()=>{
      const nd = prompt('Datum/Zeit (YYYY-MM-DDTHH:MM):', s.dt); if (nd===null) return;
      const nt = prompt('Text bearbeiten:', s.text); if (nt===null) return;
      s.dt = nd; s.text = nt.trim(); save(keys.cases, state.cases); render('/cases');
    });
    delBtn.addEventListener('click', ()=>{
      if (confirm('Kurzbericht löschen?')){ selected.shorts = selected.shorts.filter(x=>x.id!==s.id); save(keys.cases, state.cases); render('/cases'); }
    });
    actions.append(editBtn, delBtn);
    row.innerHTML = `<div>${new Date(s.dt).toLocaleString()}</div><div class="db-cell-text">${escapeHtml(s.text)}</div>`;
    const actionsCell = document.createElement('div'); actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  });
  if (!selected.shorts?.length){
    const emptyRow = document.createElement('div'); emptyRow.className='db-row';
    emptyRow.innerHTML = `<div class="db-cell-empty" colspan="3">Noch keine Kurzberichte.</div>`;
    table.appendChild(emptyRow);
  }
  body.append(table);
}

/* ---------- Tab: Kontakte ---------- */
function renderTabContacts(selected, body){
  const card = document.createElement('div'); card.className='card db-card';
  const title = document.createElement('div'); title.className='db-section-title'; title.textContent='Kontakt erfassen';
  card.append(title);

  const form = document.createElement('div'); form.className='grid db-form-grid';
  const type = document.createElement('select'); type.className='db-input db-select';
  [['ermittler','Ermittler'],['beschuldigt','Beschuldigte Person'],['zeuge','Zeuge'],['opfer','Opfer'],['sonstig','Sonstige Person']]
    .forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; type.appendChild(o); });
  const name = Object.assign(document.createElement('input'), { placeholder:'Name', className:'db-input' });
  const dob  = Object.assign(document.createElement('input'), { type:'date', className:'db-input' });
  const elnr = Object.assign(document.createElement('input'), { placeholder:'EL-Nr.', className:'db-input' });
  const addr = Object.assign(document.createElement('input'), { placeholder:'Adresse', className:'db-input' });
  const mail = Object.assign(document.createElement('input'), { placeholder:'E-Mail', type:'email', className:'db-input' });
  const more = Object.assign(document.createElement('textarea'), { rows:2, placeholder:'Weitere Infos', className:'db-input' });
  const add  = Object.assign(document.createElement('button'), { className:'primary db-primary', textContent:'+ Kontakt speichern' });

  add.onclick = () => {
    const c = {
      id: uid(), kind: type.value,
      name: name.value.trim(), dob: dob.value, el: elnr.value.trim(),
      address: addr.value.trim(), email: mail.value.trim(),
      more: more.value.trim(), shorts: []
    };
    if (!c.name) return;
    selected.contacts = selected.contacts || [];
    selected.contacts.push(c);
    save(keys.cases, state.cases);
    name.value=''; dob.value=''; elnr.value=''; addr.value=''; mail.value=''; more.value='';
    render('/cases');
  };

  form.append(
    labelWrap('Typ', type),
    labelWrap('Name', name),
    labelWrap('Geburtsdatum', dob),
    labelWrap('EL-Nr.', elnr),
    labelWrap('Adresse', addr),
    labelWrap('E-Mail', mail),
    labelWrap('Weitere Infos', more),
    add
  );
  card.append(form);
  body.append(card);

  const table = document.createElement('div'); table.className='db-table';
  const header = document.createElement('div'); header.className='db-row db-row-head';
  header.innerHTML = `<div>Typ</div><div>Name</div><div>Geburt</div><div>EL-Nr.</div><div>Aktionen</div>`;
  table.appendChild(header);

  (selected.contacts||[]).slice().sort((a,b)=> (a.kind>b.kind?1:-1) || (a.name>b.name?1:-1)).forEach(c => {
    const row = document.createElement('div'); row.className='db-row';
    const typeLabel = c.kind==='ermittler'?'Ermittler':c.kind==='beschuldigt'?'Beschuldigte Person':c.kind==='zeuge'?'Zeuge':c.kind==='opfer'?'Opfer':'Sonstige';
    const actions = document.createElement('div'); actions.className='btn-row';
    const openBtn = Object.assign(document.createElement('button'), { textContent:'Details' });
    const delBtn  = Object.assign(document.createElement('button'), { textContent:'Löschen' });
    openBtn.addEventListener('click', ()=>{ renderContactDetail(selected, c, body); });
    delBtn.addEventListener('click', ()=>{
      if (confirm('Kontakt löschen?')){ selected.contacts = selected.contacts.filter(x=>x.id!==c.id); save(keys.cases, state.cases); render('/cases'); }
    });
    actions.append(openBtn, delBtn);

    row.innerHTML = `
      <div>${escapeHtml(typeLabel)}</div>
      <div>${escapeHtml(c.name)}</div>
      <div>${escapeHtml(c.dob||'–')}</div>
      <div>${escapeHtml(c.el||'–')}</div>`;
    const actionsCell = document.createElement('div'); actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  });
  if (!selected.contacts?.length){
    const emptyRow = document.createElement('div'); emptyRow.className='db-row';
    emptyRow.innerHTML = `<div class="db-cell-empty" colspan="5">Noch keine Kontakte.</div>`;
    table.appendChild(emptyRow);
  }
  body.append(table);
}

function labelWrap(lbl, el){
  const w=document.createElement('label'); w.style.display='grid'; w.style.gap='6px';
  w.innerHTML = `<span>${lbl}</span>`; w.append(el); return w;
}

/* ---------- Kontakt-Detail (inkl. Kurzberichte am Kontakt) ---------- */
function renderContactDetail(selected, c, body){
  body.innerHTML='';
  const card = document.createElement('div'); card.className='card db-card';
  const typeLabel = c.kind==='ermittler'?'Ermittler':c.kind==='beschuldigt'?'Beschuldigte Person':c.kind==='zeuge'?'Zeuge':c.kind==='opfer'?'Opfer':'Sonstige';
  card.innerHTML = `<h4>Kontakt: ${escapeHtml(c.name)} <small class="db-chip">${escapeHtml(typeLabel)}</small></h4>`;
  body.append(card);

  const grid = document.createElement('div'); grid.className='card db-card db-form-grid';
  const fName = Object.assign(document.createElement('input'), { value:c.name, className:'db-input' });
  const fDob  = Object.assign(document.createElement('input'), { type:'date', value:c.dob||'', className:'db-input' });
  const fEl   = Object.assign(document.createElement('input'), { value:c.el||'', className:'db-input' });
  const fAdr  = Object.assign(document.createElement('input'), { value:c.address||'', className:'db-input' });
  const fMail = Object.assign(document.createElement('input'), { type:'email', value:c.email||'', className:'db-input' });
  const fMore = Object.assign(document.createElement('textarea'), { rows:2, value:c.more||'', className:'db-input' });
  const saveBtn = Object.assign(document.createElement('button'), { textContent:'Änderungen speichern', className:'primary db-primary' });
  const backBtn = Object.assign(document.createElement('button'), { textContent:'← Zurück zu Kontakten', className:'db-btn-ghost' });
  saveBtn.onclick = () => {
    c.name=fName.value.trim(); c.dob=fDob.value; c.el=fEl.value.trim(); c.address=fAdr.value.trim(); c.email=fMail.value.trim(); c.more=fMore.value.trim();
    save(keys.cases, state.cases); render('/cases');
    setTimeout(()=>{ document.querySelector('.tabbar button[data-tab="contacts"]')?.click(); }, 0);
  };
  backBtn.onclick = () => { render('/cases'); setTimeout(()=>{ document.querySelector('.tabbar button[data-tab="contacts"]')?.click(); }, 0); };
  grid.append(
    labelWrap('Name', fName),
    labelWrap('Geburtsdatum', fDob),
    labelWrap('EL-Nr.', fEl),
    labelWrap('Adresse', fAdr),
    labelWrap('E-Mail', fMail),
    labelWrap('Weitere Infos', fMore),
    saveBtn, backBtn
  );
  body.append(grid);

  // Kurzberichte am Kontakt
  const kb = document.createElement('div'); kb.className='card db-card';
  kb.innerHTML = `<div class="db-section-title">Kurzberichte zum Kontakt</div>`;
  const form = document.createElement('div'); form.className='grid db-form-grid';
  const when = Object.assign(document.createElement('input'), { type:'datetime-local', value: fmtDateTimeLocal(Date.now()), className:'db-input' });
  const text = Object.assign(document.createElement('textarea'), { rows:3, placeholder:'Kurzbericht zum Kontakt …', className:'db-input' });
  const add = Object.assign(document.createElement('button'), { className:'primary db-primary', textContent:'+ Kurzbericht hinzufügen' });
  add.onclick = () => {
    const s = { id: uid(), dt: when.value, text: text.value.trim(), created: now() };
    if (!s.text) return;
    c.shorts = c.shorts || [];
    c.shorts.push(s);
    save(keys.cases, state.cases);
    text.value='';
    renderContactDetail(selected, c, body);
  };
  form.append(labelWrap('Datum/Zeit', when), labelWrap('Text', text), add);
  kb.append(form);
  body.append(kb);

  const table = document.createElement('div'); table.className='db-table';
  const header = document.createElement('div'); header.className='db-row db-row-head';
  header.innerHTML = `<div>Datum/Zeit</div><div>Text</div><div>Aktionen</div>`;
  table.appendChild(header);

  (c.shorts||[]).slice().sort((a,b)=> (new Date(b.dt)) - (new Date(a.dt))).forEach(s => {
    const row = document.createElement('div'); row.className='db-row';
    const actions = document.createElement('div'); actions.className='btn-row';
    const editBtn = Object.assign(document.createElement('button'), { textContent:'Bearb.' });
    const delBtn  = Object.assign(document.createElement('button'), { textContent:'Löschen' });
    editBtn.addEventListener('click', ()=>{
      const nd = prompt('Datum/Zeit (YYYY-MM-DDTHH:MM):', s.dt); if (nd===null) return;
      const nt = prompt('Text bearbeiten:', s.text); if (nt===null) return;
      s.dt = nd; s.text = nt.trim(); save(keys.cases, state.cases); renderContactDetail(selected,c,body);
    });
    delBtn.addEventListener('click', ()=>{
      if (confirm('Kurzbericht löschen?')){ c.shorts = c.shorts.filter(x=>x.id!==s.id); save(keys.cases, state.cases); renderContactDetail(selected,c,body); }
    });
    actions.append(editBtn, delBtn);
    row.innerHTML = `<div>${new Date(s.dt).toLocaleString()}</div><div class="db-cell-text">${escapeHtml(s.text)}</div>`;
    const actionsCell = document.createElement('div'); actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  });
  if (!c.shorts?.length){
    const emptyRow = document.createElement('div'); emptyRow.className='db-row';
    emptyRow.innerHTML = `<div class="db-cell-empty" colspan="3">Noch keine Kurzberichte.</div>`;
    table.appendChild(emptyRow);
  }
  body.append(table);
}

/* ---------- Export Ordner ---------- */
function exportFolder(fall, folder){
  const data = JSON.stringify({
    case: fall.title, folder: folder.name, exportedAt: new Date().toISOString(),
    docs: folder.docs||[], files: (folder.files||[]).map(({id,name,type,size,created})=>({id,name,type,size,created}))
  }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (fall.title + '-' + folder.name).replace(/[^a-z0-9]+/gi,'_');
  a.href = url; a.download = `ISM_${safe}_export.json`; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Restseiten ---------- */
function renderHelp(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card db-card';
  c.innerHTML='<h2>🛈 ISM Helpcenter</h2><p>Inhalt folgt. (Platzhalter)</p>';
  v.append(c);
}
function renderMy(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card db-card';
  c.innerHTML='<h2>🪪 My ISM</h2><p>Ihr Beamtenausweis erscheint in Kürze hier.</p>';
  v.append(c);
}
function renderSettings(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card db-card grid';
  const h2=document.createElement('h2'); h2.textContent='⚙️ Einstellungen';
  const themeBtn=Object.assign(document.createElement('button'),{textContent:'Dark/Light umschalten', className:'db-btn-ghost'});
  themeBtn.onclick = toggleTheme;
  const clearBtn=Object.assign(document.createElement('button'),{textContent:'Alle Daten löschen (lokal)', className:'db-btn-ghost'});
  clearBtn.onclick = async () => {
    if (!confirm('Wirklich alle lokalen Cockpit-Daten löschen?')) return;
    for (const c of state.cases) for (const f of (c.folders||[])) for (const m of (f.files||[])){ try{ await dbDeleteFile(m.id); }catch{} }
    state.cases = []; save(keys.cases, state.cases);
    render('/');
  };
  const logoutBtn=Object.assign(document.createElement('button'),{textContent:'Abmelden (zur Login-Maske)', className:'db-btn-ghost'});
  logoutBtn.onclick = logout;
  c.append(h2, themeBtn, clearBtn, logoutBtn);
  v.append(c);
}

/* ---------- Global ---------- */
$('#themeToggle')?.addEventListener('click', toggleTheme);
$('#exportAll')?.addEventListener('click', () => {
  const data = JSON.stringify({ exportedAt:new Date().toISOString(), cases: state.cases }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='ism-cases-backup.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#importAll')?.addEventListener('click', ()=> $('#importAllFile')?.click());
$('#importAllFile')?.addEventListener('change', e => {
  const f = e.target.files?.[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.cases)) return alert('Ungültiges Backup.');
      state.cases = parsed.cases; save(keys.cases, state.cases); render('/cases');
    }catch{ alert('Konnte die Datei nicht lesen.'); }
  };
  reader.readAsText(f);
});
$('#globalSearch')?.addEventListener('input', e => {
  state.search = e.target.value;
  if (state.session) render(currentRoute());
});
$$('.sidebar nav a').forEach(a => a.addEventListener('click', () => {
  const path = a.getAttribute('href').slice(1);
  localStorage.setItem(keys.route, path);
}));
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const btn = $('#installBtn'); if (btn) { btn.hidden = false; btn.onclick = async ()=>{ deferredPrompt.prompt(); deferredPrompt=null; btn.hidden=true; }; }
});

/* ---------- Init ---------- */
initTheme();
if (!state.cases.length){
  state.cases = [ {
    id: uid(),
    title:'F010A017',
    created: now(),
    status: 'open',
    folders: [ { id: uid(), name:'Berichte', docs: [], files: [] } ],
    contacts: [],
    shorts: []
  } ];
  save(keys.cases, state.cases);
}
window.addEventListener('hashchange', syncRoute);
syncRoute();
updateAgentBadge();

/* ---------- Inject extra DB-style CSS (orange/schwarz) ---------- */
(function injectDbCss(){
  const css = `
  :root {
    --ism-orange: #ff7a00;
  }
  .db-card{background:var(--card-bg, #111);border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.6);}
  .db-header{border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.5rem;margin-bottom:.5rem;}
  .db-title{font-size:1.3rem;font-weight:600;color:var(--ism-orange);letter-spacing:.08em;text-transform:uppercase;}
  .db-subtitle{font-size:.85rem;opacity:.8;}
  .db-body{display:grid;gap:.75rem;}
  .db-footer{font-size:.75rem;opacity:.7;border-top:1px solid rgba(255,255,255,.1);padding-top:.4rem;}
  .db-input{padding:.5rem .6rem;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:#050505;color:#f5f5f5;font-size:.95rem;}
  .db-input:focus{outline:1px solid var(--ism-orange);border-color:var(--ism-orange);}
  .db-checkbox{user-select:none;font-size:.9rem;display:inline-flex;gap:6px;align-items:center;opacity:.8;}
  .db-primary{background:var(--ism-orange);border:none;color:#000;font-weight:600;}
  .db-primary:hover{filter:brightness(1.05);}
  .db-error{color:#ff6b6b;font-weight:600;font-size:.9rem;}
  .db-kpi{font-size:2.2rem;font-weight:700;color:var(--ism-orange);margin:.2rem 0;}
  .db-kpi-label{font-size:.9rem;opacity:.8;margin-bottom:.6rem;}
  .db-table{display:grid;border:1px solid rgba(255,255,255,.12);border-radius:8px;overflow:hidden;font-size:.9rem;}
  .db-row{display:grid;grid-template-columns:1.1fr .9fr 2.2fr .9fr .9fr;align-items:stretch;}
  .db-row-head{background:#181818;font-weight:600;border-bottom:1px solid rgba(255,255,255,.2);}
  .db-row > div{padding:.35rem .5rem;border-bottom:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.04);}
  .db-row > div:last-child{border-right:none;}
  .db-row:nth-child(even):not(.db-row-head){background:#0b0b0b;}
  .db-cell-text{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;max-width:260px;}
  .db-cell-empty{text-align:center;grid-column:1/-1;padding:.6rem .5rem;}
  .db-case-list{margin-top:.75rem;}
  .db-case-row{display:flex;justify-content:space-between;gap:.75rem;padding:.5rem .55rem;border-radius:8px;background:#050505;border:1px solid rgba(255,255,255,.06);margin-bottom:.35rem;}
  .db-case-row:hover{border-color:var(--ism-orange);}
  .db-case-main{display:grid;gap:.1rem;}
  .db-case-title{font-weight:600;}
  .db-case-meta{font-size:.75rem;opacity:.75;}
  .db-case-actions{text-align:right;display:grid;gap:.35rem;align-items:center;justify-items:end;}
  .db-status{padding:.1rem .5rem;border-radius:999px;font-size:.75rem;border:1px solid rgba(255,255,255,.3);}
  .db-status-open{color:#ffd28a;border-color:#ffd28a33;}
  .db-status-progress{color:#8fd1ff;border-color:#8fd1ff44;}
  .db-status-closed{color:#b0ffb0;border-color:#b0ffb044;}
  .db-columns{align-items:flex-start;}
  .db-pane-left{max-width:360px;}
  .db-pane-right{min-width:0;}
  .db-case-head{display:grid;gap:.5rem;}
  .db-case-head-main{display:grid;gap:.15rem;}
  .db-case-head-title{font-size:1.2rem;font-weight:600;color:var(--ism-orange);}
  .db-case-head-meta{font-size:.8rem;opacity:.75;}
  .db-case-head-actions{display:flex;gap:.5rem;align-items:center;justify-content:flex-end;}
  .db-select{padding-right:1.5rem;}
  .tabbar{display:flex;gap:.35rem;margin-top:.4rem;border-top:1px solid rgba(255,255,255,.1);padding-top:.35rem;}
  .tabbar button{padding:.3rem .7rem;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:#050505;font-size:.85rem;cursor:pointer;}
  .tabbar button.active{background:var(--ism-orange);color:#000;border-color:var(--ism-orange);}
  .tabcontent{display:grid;gap:.8rem;margin-top:.7rem;}
  .db-section-title{font-weight:600;margin-bottom:.4rem;}
  .db-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;}
  .db-btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.3);padding:.3rem .6rem;border-radius:6px;font-size:.85rem;cursor:pointer;}
  .db-btn-ghost:hover{border-color:var(--ism-orange);}
  .db-form-grid{grid-template-columns:1fr;gap:.5rem;}
  .db-chip{background:rgba(255,255,255,.08);border-radius:999px;padding:.1rem .5rem;font-size:.75rem;margin-left:.3rem;}
  @media (max-width:900px){
    .db-row{grid-template-columns:1.1fr .9fr 2fr;}
    .db-row-head{grid-template-columns:1.1fr .9fr 2fr;}
  }
  `;
  const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
})();
