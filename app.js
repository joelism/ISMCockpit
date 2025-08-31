/* ISM Cockpit – Fälle + Dateien (TXT/Bilder) pro Ordner, PIN 500011, Fallnummer-Helfer */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };

const keys = {
  session: 'ismc-session',
  cases: 'ismc-cases-v2',          // bump for new structure (files)
  seq: 'ismc-case-seq',            // sequence for case numbers
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
function uid(){ return (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); }
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;' }[c])); }

/* ---------- IndexedDB (Blobs) ---------- */
const DB_NAME = 'ismc-files-db';
const DB_STORE = 'files';
let dbPromise = null;

function dbOpen(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)){
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function dbPutFile(fileRec){
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(fileRec);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function dbGetFile(id){
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbDeleteFile(id){
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Theme ---------- */
function initTheme(){
  const pref = localStorage.getItem(keys.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
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

/* ---------- Pseudo-Login „Anmelden als A017“ (PIN 500011) ---------- */
function renderLogin(){
  const view = $('#view');
  view.innerHTML = `
    <div class="login card" style="max-width:420px;margin:40px auto;display:grid;gap:16px;text-align:center">
      <h1>🔐 ISM Cockpit</h1>
      <p><strong>Anmelden als A017</strong></p>

      <div class="field" style="display:grid;gap:6px;text-align:left">
        <label for="pinInput">PIN</label>
        <input id="pinInput" type="password" inputmode="numeric" placeholder="******" maxlength="12"
               style="padding:.8rem;border-radius:10px;border:1px solid var(--border)">
        <label style="user-select:none;font-size:.9rem;display:inline-flex;gap:6px;align-items:center">
          <input type="checkbox" id="showPin"> Anzeigen
        </label>
      </div>

      <button id="loginBtn" class="primary" style="padding:12px;font-size:1.1rem">Jetzt einloggen</button>
      <div id="loginError" class="error" style="display:none;color:#d93025;font-weight:600">Falscher PIN.</div>
    </div>
  `;

  const pin = $('#pinInput');
  $('#showPin').onchange = e => { pin.type = e.target.checked ? 'text' : 'password'; };

  const tryLogin = () => {
    const ok = (pin.value || '').trim().replace(/\s+$/,'').replace(/\.+$/,'') === '500011';
    if (!ok){
      $('#loginError').style.display = 'block';
      pin.focus(); pin.select?.();
      return;
    }
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

/* ---------- CASE NUMBER HELPER ---------- */
function nextCaseNumber(){
  const agent = (state.session?.agent) || 'A017';
  const seq = (parseInt(localStorage.getItem(keys.seq)||'9',10) + 1); // start at 10 -> F010A017
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
  const err = document.createElement('div'); err.className='card'; err.textContent='Seite nicht gefunden.'; view.appendChild(err);
}

function renderDashboard(){
  const view = $('#view');
  const wrap = document.createElement('div'); wrap.className = 'grid k3';

  const c1 = document.createElement('div'); c1.className='card';
  c1.innerHTML = `<h2>📁 Fälle</h2><p>${state.cases.length} Fall/Fälle</p>
                  <div class="btn-row"><a class="btn" href="#/cases">Öffnen</a></div>`;
  const c2 = document.createElement('div'); c2.className='card';
  c2.innerHTML = `<h2>🪪 My ISM</h2><p>Ausweis: in Kürze</p>
                  <div class="btn-row"><a class="btn" href="#/my">Öffnen</a></div>`;
  const c3 = document.createElement('div'); c3.className='card';
  c3.innerHTML = `<h2>🛈 Helpcenter</h2><p>Platzhalter</p>
                  <div class="btn-row"><a class="btn" href="#/help">Öffnen</a></div>`;

  wrap.append(c1,c2,c3);
  view.appendChild(wrap);
}

/* ---------- CASES / FILE MANAGER + FILES ---------- */
function renderCases(){
  const view = $('#view');
  const h2 = document.createElement('h2'); h2.textContent='📁 Fälle (File Manager)';
  const container = document.createElement('div'); container.className='columns';

  // LEFT: Cases list + create
  const left = document.createElement('div'); left.className='pane';
  const newCaseName = Object.assign(document.createElement('input'), { placeholder:'Fallnummer (z. B. F010A017)', value: nextCaseNumber() });
  const addCaseBtn = Object.assign(document.createElement('button'), { textContent:'+ Fall anlegen', className:'primary' });
  const genBtn = Object.assign(document.createElement('button'), { textContent:'Fallnummer neu generieren' });
  addCaseBtn.addEventListener('click', () => {
    const name = newCaseName.value.trim(); if (!name) return;
    state.cases.push({ id: uid(), title: name, created: now(), folders: [] });
    save(keys.cases, state.cases); newCaseName.value = nextCaseNumber(); render('/cases');
  });
  genBtn.addEventListener('click', () => { newCaseName.value = nextCaseNumber(); });
  const caseCreator = document.createElement('div'); caseCreator.className='card grid'; caseCreator.append(newCaseName, addCaseBtn, genBtn);
  left.append(caseCreator);

  const list = document.createElement('div'); list.className='list';
  const q = state.search.trim().toLowerCase();
  state.cases
    .slice().sort((a,b)=>b.created-a.created)
    .filter(c => !q || c.title.toLowerCase().includes(q))
    .forEach(c => {
      const item = document.createElement('div'); item.className='case';
      item.innerHTML = `
        <header>
          <strong>${escapeHtml(c.title)}</strong>
          <div class="btn-row">
            <button data-act="open" data-id="${c.id}">Öffnen</button>
            <button data-act="del" data-id="${c.id}">Löschen</button>
          </div>
        </header>
        <div class="meta">Angelegt: ${fmt(c.created)} · Ordner: ${c.folders.length}</div>
      `;
      list.appendChild(item);
    });
  left.append(list);

  // RIGHT: selected case
  const right = document.createElement('div'); right.className='pane';
  const selId = sessionStorage.getItem('ismc-selected-case');
  const selected = state.cases.find(c=>c.id===selId) || state.cases[0];
  if (selected){
    sessionStorage.setItem('ismc-selected-case', selected.id);
    const head = document.createElement('div'); head.className='card';
    head.innerHTML = `<h3>Fall: ${escapeHtml(selected.title)}</h3>`;
    right.append(head);

    // Folder create
    const newFolderName = Object.assign(document.createElement('input'), { placeholder:'Neuer Unterordner (z. B. Berichte)' });
    const addFolderBtn = Object.assign(document.createElement('button'), { textContent:'+ Unterordner anlegen', className:'primary' });
    addFolderBtn.addEventListener('click', () => {
      const name = newFolderName.value.trim(); if (!name) return;
      selected.folders.push({ id: uid(), name, docs: [], files: [] });
      save(keys.cases, state.cases); newFolderName.value=''; render('/cases');
    });
    const folderCreator = document.createElement('div'); folderCreator.className='card grid'; folderCreator.append(newFolderName, addFolderBtn);
    right.append(folderCreator);

    // Folders list
    selected.folders.forEach(f => {
      const box = document.createElement('div'); box.className='card';
      const title = document.createElement('h4'); title.textContent = `Ordner: ${f.name}`;
      const exportBtn = Object.assign(document.createElement('button'), { textContent:'Ordner exportieren (JSON)' });
      exportBtn.addEventListener('click', ()=> exportFolder(selected, f));
      const row = document.createElement('div'); row.className='btn-row'; row.append(exportBtn);
      box.append(title, row);

      /* Files section */
      const filesSec = document.createElement('div'); filesSec.className='grid';
      const fileInput = Object.assign(document.createElement('input'), { type:'file', multiple:true, accept:'.txt,image/*' });
      const uploadBtn = Object.assign(document.createElement('button'), { textContent:'+ Dateien hinzufügen' });
      uploadBtn.addEventListener('click', ()=> fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        for (const file of files){
          const id = uid();
          const isImage = file.type.startsWith('image/');
          // Store blob in IndexedDB
          const rec = { id, name:file.name, type:file.type, size:file.size, created: now(), blob: file };
          await dbPutFile(rec);
          // Keep metadata in folder
          f.files = f.files || [];
          f.files.push({ id, name:file.name, type:file.type, size:file.size, created: now(), isImage });
        }
        save(keys.cases, state.cases);
        render('/cases');
      });
      filesSec.append(uploadBtn);
      // Files list
      const filesList = document.createElement('div'); filesList.className='list';
      (f.files||[]).slice().sort((a,b)=>b.created-a.created).forEach(meta => {
        const item = document.createElement('div'); item.className='file';
        const info = document.createElement('div');
        info.innerHTML = `<strong>${escapeHtml(meta.name)}</strong>
                          <div class="meta">${(meta.type||'').split('/')[0]||'file'} • ${(meta.size/1024).toFixed(1)} KB • ${fmt(meta.created)}</div>`;
        const actions = document.createElement('div'); actions.className='btn-row';
        const viewBtn = Object.assign(document.createElement('button'), { textContent: meta.isImage?'Ansehen':'Herunterladen' });
        viewBtn.addEventListener('click', async ()=>{
          const rec = await dbGetFile(meta.id);
          if (!rec) return alert('Datei nicht gefunden (Speicher).');
          const url = URL.createObjectURL(rec.blob);
          if (meta.isImage){
            const w = window.open(); if (w) w.document.write(`<img src="${url}" style="max-width:100%;height:auto">`);
          }else{
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

        // Optional thumbnail
        const wrap = document.createElement('div'); wrap.style.display='grid'; wrap.style.gap='8px';
        if (meta.isImage){
          // Try to show a thumb via object URL
          (async () => {
            const rec = await dbGetFile(meta.id);
            if (rec){
              const url = URL.createObjectURL(rec.blob);
              const img = document.createElement('img'); img.src = url; img.className='file-thumb';
              wrap.appendChild(img);
              setTimeout(()=>URL.revokeObjectURL(url), 10000);
            }
          })();
        }
        wrap.append(info, actions);
        item.append(wrap);
        filesList.append(item);
      });
      if (!f.files || !f.files.length){
        const empty = document.createElement('div'); empty.className='meta'; empty.textContent='Noch keine Dateien.';
        filesList.append(empty);
      }
      filesSec.append(filesList);
      box.append(document.createElement('hr'), document.createTextNode('Dateien'), filesSec);

      /* Reports section */
      const form = document.createElement('div'); form.className='grid';
      const type = document.createElement('select');
      ['Personenbericht','Erstbericht','Abschlussbericht'].forEach(t => {
        const o = document.createElement('option'); o.value=t; o.textContent=t; type.appendChild(o);
      });
      const date = Object.assign(document.createElement('input'), { type:'date', value: fmtDateInput(Date.now()) });
      const rtitle = Object.assign(document.createElement('input'), { placeholder:'Berichtstitel' });
      const body = Object.assign(document.createElement('textarea'), { placeholder:'Berichtstext …', rows:4 });
      const addDoc = Object.assign(document.createElement('button'), { textContent:'+ Bericht speichern', className:'primary' });
      addDoc.addEventListener('click', ()=>{
        const doc = { id: uid(), kind: type.value, date: date.value, title: rtitle.value.trim(), body: body.value.trim(), created: now(), updated: now() };
        if (!doc.title && !doc.body) return;
        f.docs = f.docs || [];
        f.docs.push(doc); save(keys.cases, state.cases);
        rtitle.value=''; body.value=''; render('/cases');
      });
      form.append(type, date, rtitle, body, addDoc);
      box.append(form);

      // Docs list
      if (f.docs && f.docs.length){
        const dl = document.createElement('div'); dl.className='list';
        f.docs.slice().sort((a,b)=>b.updated-a.updated).forEach(d => {
          const di = document.createElement('div'); di.className='doc';
          di.innerHTML = `
            <header>
              <strong>${escapeHtml(d.title||'(Ohne Titel)')}</strong>
              <div class="btn-row">
                <button data-act="edit" data-fid="${f.id}" data-id="${d.id}">Bearb.</button>
                <button data-act="del" data-fid="${f.id}" data-id="${d.id}">Löschen</button>
              </div>
            </header>
            <div class="meta">${escapeHtml(d.kind)} • Datum: ${escapeHtml(d.date)} • Zuletzt: ${fmt(d.updated)}</div>
            <div class="body">${escapeHtml(d.body)}</div>
          `;
          dl.appendChild(di);
        });
        box.append(dl);
      } else {
        const empty = document.createElement('div'); empty.className='meta'; empty.textContent='Noch keine Berichte.'; box.append(empty);
      }

      right.append(box);
    });

    // Right pane click handlers
    right.addEventListener('click', e => {
      const id = e.target.dataset?.id;
      const fid = e.target.dataset?.fid;
      const act = e.target.dataset?.act;
      const selected2 = state.cases.find(c=>c.id===sessionStorage.getItem('ismc-selected-case'));
      const folder = selected2?.folders.find(x=>x.id===fid);
      if (act === 'edit' && id && folder){
        const doc = folder.docs.find(x=>x.id===id);
        if (!doc) return;
        const nt = prompt('Titel bearbeiten:', doc.title || '');
        if (nt === null) return;
        const nb = prompt('Text bearbeiten:', doc.body || '');
        if (nb === null) return;
        doc.title = nt.trim(); doc.body = nb.trim(); doc.updated = now(); save(keys.cases, state.cases); render('/cases');
      } else if (act === 'del' && id && folder){
        if (confirm('Bericht löschen?')){
          folder.docs = folder.docs.filter(x=>x.id!==id); save(keys.cases, state.cases); render('/cases');
        }
      }
    }, { once:true });
  } else {
    const empty = document.createElement('div'); empty.className='card'; empty.textContent='Noch kein Fall angelegt.';
    right.append(empty);
  }

  // Left pane click handlers
  left.addEventListener('click', e => {
    const id = e.target.dataset?.id;
    const act = e.target.dataset?.act;
    if (act === 'open' && id){ sessionStorage.setItem('ismc-selected-case', id); render('/cases'); }
    else if (act === 'del' && id){
      if (confirm('Diesen Fall komplett löschen?')){
        // delete file blobs as well
        const c = state.cases.find(x=>x.id===id);
        if (c){
          (c.folders||[]).forEach(f => (f.files||[]).forEach(async m => { try{ await dbDeleteFile(m.id); }catch{} }));
        }
        state.cases = state.cases.filter(c=>c.id!==id); save(keys.cases, state.cases); sessionStorage.removeItem('ismc-selected-case'); render('/cases');
      }
    }
  }, { once:true });

  view.append(h2, container);
  container.append(left, right);
}

function exportFolder(fall, folder){
  const data = JSON.stringify({
    case: fall.title, folder: folder.name, exportedAt: new Date().toISOString(),
    docs: folder.docs||[], files: (folder.files||[]).map(({id, name, type, size, created}) => ({id,name,type,size,created}))
  }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (fall.title + '-' + folder.name).replace(/[^a-z0-9]+/gi,'_');
  a.href = url; a.download = `ISM_${safe}_export.json`; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Simple Help/My/Settings ---------- */
function renderHelp(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card';
  c.innerHTML='<h2>🛈 ISM Helpcenter</h2><p>Inhalt folgt. (Platzhalter)</p>';
  v.append(c);
}
function renderMy(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card';
  c.innerHTML='<h2>🪪 My ISM</h2><p>Ihr Beamtenausweis erscheint in Kürze hier.</p>';
  v.append(c);
}
function renderSettings(){
  const v=$('#view'); v.innerHTML='';
  const c=document.createElement('div'); c.className='card grid';
  const h2=document.createElement('h2'); h2.textContent='⚙️ Einstellungen';
  const themeBtn=Object.assign(document.createElement('button'),{textContent:'Dark/Light umschalten'});
  themeBtn.onclick = toggleTheme;
  const clearBtn=Object.assign(document.createElement('button'),{textContent:'Alle Daten löschen (lokal)'});
  clearBtn.onclick = async () => {
    if (!confirm('Wirklich alle lokalen Cockpit-Daten löschen?')) return;
    // wipe case data + blobs
    for (const c of state.cases) for (const f of (c.folders||[])) for (const m of (f.files||[])){ try{ await dbDeleteFile(m.id); }catch{} }
    state.cases = []; save(keys.cases, state.cases);
    render('/');
  };
  const logoutBtn=Object.assign(document.createElement('button'),{textContent:'Abmelden (zur Login-Maske)'});
  logoutBtn.onclick = logout;
  c.append(h2, themeBtn, clearBtn, logoutBtn);
  v.append(c);
}

/* ---------- Global Events ---------- */
$('#themeToggle')?.addEventListener('click', toggleTheme);
$('#exportAll')?.addEventListener('click', () => {
  // Export only metadata (not blobs)
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
  state.cases = [ { id: uid(), title:'F010A017', created: now(), folders: [ { id: uid(), name:'Berichte', docs: [], files: [] } ] } ];
  save(keys.cases, state.cases);
}
window.addEventListener('hashchange', syncRoute);
syncRoute();
updateAgentBadge();
