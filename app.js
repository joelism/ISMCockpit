/* ISM Cockpit – Login tolerant + Modules */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };
const AGENTS = { 'A017': 'BananaTomate1107' };

const keys = {
  session: 'ismc-session',
  notes: 'ismc-notes-v1',
  tasks: 'ismc-tasks-v1',
  links: 'ismc-links-v1',
  cases: 'ismc-cases-v1',
  theme: 'ismc-theme',
  route: 'ismc-route'
};

const state = {
  session: load(keys.session),
  notes: load(keys.notes) || [],
  tasks: load(keys.tasks) || [],
  links: load(keys.links) || [],
  cases: load(keys.cases) || [],
  search: '',
  route: localStorage.getItem(keys.route) || '/'
};

function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function now(){ return Date.now(); }
function fmt(ts){ return new Date(ts).toLocaleString(undefined,{dateStyle:'medium', timeStyle:'short'}); }
function fmtDateInput(ts){ const d=new Date(ts); return d.toISOString().slice(0,10); }
function uid(){ return (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); }

/* Router */
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

/* Theme */
function initTheme(){
  const pref = localStorage.getItem(keys.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (pref === 'dark' || (pref === null && prefersDark)) document.documentElement.classList.add('dark');
  $('#themeToggle').textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}
function toggleTheme(){
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(keys.theme, isDark ? 'dark' : 'light');
  $('#themeToggle').textContent = isDark ? '☀️' : '🌙';
}

/* Backup */
function exportAll(){
  const data = JSON.stringify({
    exportedAt: new Date().toISOString(),
    notes: state.notes, tasks: state.tasks, links: state.links, cases: state.cases
  }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ism-cockpit-backup.json'; a.click();
  URL.revokeObjectURL(url);
}
function importAll(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if (parsed){
        state.notes = parsed.notes || [];
        state.tasks = parsed.tasks || [];
        state.links = parsed.links || [];
        state.cases = parsed.cases || [];
        save(keys.notes, state.notes);
        save(keys.tasks, state.tasks);
        save(keys.links, state.links);
        save(keys.cases, state.cases);
        render(currentRoute());
      } else alert('Ungültiges Backup.');
    }catch(e){ alert('Konnte die Datei nicht lesen.'); }
  };
  reader.readAsText(file);
}

/* LOGIN */
function renderLogin(){
  const view = $('#view');
  view.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'login card';
  box.innerHTML = `
    <h1>🔐 ISM Cockpit</h1>
    <div class="hint">Organisation: <strong>${ISM.org}</strong></div>
    <div class="field">
      <label for="agentId">Beamtennummer</label>
      <input id="agentId" placeholder="z. B. A017" autocomplete="username">
    </div>
    <div class="field">
      <label for="agentPw">Passwort</label>
      <input id="agentPw" type="password" placeholder="Passwort" autocomplete="current-password">
    </div>
    <button id="loginBtn" class="primary">Anmelden</button>
    <div id="loginError" class="error" style="display:none">Falsche Anmeldedaten.</div>
    <div class="hint">Hinweis: Lokale Sperre ohne Server. Für echte Sicherheit bräuchte es Backend‑Auth.</div>
  `;
  view.appendChild(box);
  $('#loginBtn').addEventListener('click', doLogin);
  ['agentId','agentPw'].forEach(id => $(`#${id}`).addEventListener('keyup', (e)=>{ if(e.key==='Enter') doLogin(); }));
}
function doLogin(){
  const id = ($('#agentId').value || '').trim().toUpperCase();
  let pw = ($('#agentPw').value || '').trim();
  pw = pw.replace(/\.$/, ''); // versehentlicher Punkt am Ende
  const ok = AGENTS[id] && pw === AGENTS[id];
  const err = document.getElementById('loginError');
  if (!ok){ if (err) err.style.display='block'; return; }
  state.session = { agent:id, org:ISM.org, loginAt: now() };
  save(keys.session, state.session);
  updateAgentBadge();
  render(currentRoute());
}
function logout(){ state.session=null; localStorage.removeItem(keys.session); renderLogin(); }
function updateAgentBadge(){
  const el = document.querySelector('#agentBadge #agentId');
  if (el && state.session){ el.textContent = `${state.session.agent} • ${ISM.org}`; }
}

/* Views */
function render(route){
  if (!state.session) return renderLogin();
  const view = $('#view'); view.innerHTML='';
  $('#globalSearch').value = state.search;
  updateAgentBadge();
  if (route === '/' || route === '') return renderDashboard();
  if (route === '/cases') return renderCases();
  if (route === '/notes') return renderNotes();
  if (route === '/tasks') return renderTasks();
  if (route === '/links') return renderLinks();
  if (route === '/help') return renderHelp();
  if (route === '/my') return renderMy();
  if (route === '/settings') return renderSettings();
  const err = document.createElement('div'); err.className='card'; err.textContent='Seite nicht gefunden.'; view.appendChild(err);
}

function renderDashboard(){
  const view = $('#view');
  const wrap = document.createElement('div'); wrap.className = 'grid k3';
  const cards = [
    ['📁 Fälle', state.cases.length, '#/cases'],
    ['📝 Notizen', state.notes.length, '#/notes'],
    ['✅ Aufgaben', state.tasks.filter(t=>!t.done).length + ' offen', '#/tasks']
  ];
  cards.forEach(([label, meta, href]) => {
    const c = document.createElement('div'); c.className='card';
    c.innerHTML = `<h2>${label}</h2><p>${meta}</p><div class="btn-row"><a class="btn" href="${href}">Öffnen</a></div>`;
    wrap.appendChild(c);
  });
  view.appendChild(wrap);
}

/* CASES */
function renderCases(){
  const view = $('#view');
  const h2 = document.createElement('h2'); h2.textContent='📁 Fälle (File Manager)';
  const container = document.createElement('div'); container.className='columns';

  const left = document.createElement('div'); left.className='pane';
  const newCaseName = Object.assign(document.createElement('input'), { placeholder:'Neuer Fall (z. B. CRV-2025-001)' });
  const addCaseBtn = Object.assign(document.createElement('button'), { textContent:'+ Fall anlegen', className:'primary' });
  addCaseBtn.addEventListener('click', () => {
    const name = newCaseName.value.trim(); if (!name) return;
    state.cases.push({ id: uid(), title: name, created: now(), folders: [] });
    save(keys.cases, state.cases); newCaseName.value=''; render('/cases');
  });
  const caseCreator = document.createElement('div'); caseCreator.className='card grid'; caseCreator.append(newCaseName, addCaseBtn);
  left.append(caseCreator);

  const list = document.createElement('div'); list.className='list';
  const q = state.search.trim().toLowerCase();
  state.cases.slice().sort((a,b)=>b.created-a.created).filter(c => !q || c.title.toLowerCase().includes(q)).forEach(c => {
    const item = document.createElement('div'); item.className='case';
    item.innerHTML = `
      <header>
        <strong>${escapeHtml(c.title)}</strong>
        <div class="btn-row">
          <button data-act="open" data-id="${c.id}">Öffnen</button>
          <button data-act="del" data-id="${c.id}">Löschen</button>
        </div>
      </header>
      <div class="meta">Angelegt: ${fmt(c.created)} · Ordner: ${c.folders.length}</div>`;
    list.appendChild(item);
  });
  left.append(list);

  const right = document.createElement('div'); right.className='pane';
  const selId = sessionStorage.getItem('ismc-selected-case');
  const selected = state.cases.find(c=>c.id===selId) || state.cases[0];
  if (selected){
    sessionStorage.setItem('ismc-selected-case', selected.id);
    const head = document.createElement('div'); head.className='card'; head.innerHTML = `<h3>Fall: ${escapeHtml(selected.title)}</h3>`;
    right.append(head);
    const newFolderName = Object.assign(document.createElement('input'), { placeholder:'Neuer Unterordner (z. B. Berichte)' });
    const addFolderBtn = Object.assign(document.createElement('button'), { textContent:'+ Unterordner anlegen', className:'primary' });
    addFolderBtn.addEventListener('click', () => {
      const name = newFolderName.value.trim(); if (!name) return;
      selected.folders.push({ id: uid(), name, docs: [] });
      save(keys.cases, state.cases); newFolderName.value=''; render('/cases');
    });
    const folderCreator = document.createElement('div'); folderCreator.className='card grid'; folderCreator.append(newFolderName, addFolderBtn);
    right.append(folderCreator);

    selected.folders.forEach(f => {
      const box = document.createElement('div'); box.className='card';
      const title = document.createElement('h4'); title.textContent = `Ordner: ${f.name}`;
      const exportBtn = Object.assign(document.createElement('button'), { textContent:'Ordner exportieren (JSON)' });
      exportBtn.addEventListener('click', ()=> exportFolder(selected, f));
      const row = document.createElement('div'); row.className='btn-row'; row.append(exportBtn);
      box.append(title, row);

      const form = document.createElement('div'); form.className='grid';
      const type = document.createElement('select');
      ['Personenbericht','Erstbericht','Abschlussbericht'].forEach(t => { const o = document.createElement('option'); o.value=t; o.textContent=t; type.appendChild(o); });
      const date = Object.assign(document.createElement('input'), { type:'date', value: fmtDateInput(Date.now()) });
      const rtitle = Object.assign(document.createElement('input'), { placeholder:'Berichtstitel' });
      const body = Object.assign(document.createElement('textarea'), { placeholder:'Berichtstext …', rows:4 });
      const addDoc = Object.assign(document.createElement('button'), { textContent:'+ Bericht speichern', className:'primary' });
      addDoc.addEventListener('click', ()=>{
        const doc = { id: uid(), kind: type.value, date: date.value, title: rtitle.value.trim(), body: body.value.trim(), created: now(), updated: now() };
        if (!doc.title && !doc.body) return;
        f.docs.push(doc); save(keys.cases, state.cases);
        rtitle.value=''; body.value=''; render('/cases');
      });
      form.append(type, date, rtitle, body, addDoc);
      box.append(form);

      if (f.docs.length){
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
            <div class="body">${escapeHtml(d.body)}</div>`;
          dl.appendChild(di);
        });
        box.append(dl);
      } else {
        const empty = document.createElement('div'); empty.className='meta'; empty.textContent='Noch keine Berichte.'; box.append(empty);
      }
      right.append(box);
    });

    right.addEventListener('click', e => {
      const id = e.target.dataset?.id;
      const fid = e.target.dataset?.fid;
      const act = e.target.dataset?.act;
      if (act === 'edit' && id && fid){
        const folder = selected.folders.find(x=>x.id===fid);
        const doc = folder?.docs.find(x=>x.id===id);
        if (!doc) return;
        const nt = prompt('Titel bearbeiten:', doc.title || '');
        if (nt === null) return;
        const nb = prompt('Text bearbeiten:', doc.body || '');
        if (nb === null) return;
        doc.title = nt.trim(); doc.body = nb.trim(); doc.updated = now(); save(keys.cases, state.cases); render('/cases');
      } else if (act === 'del' && id && fid){
        const folder = selected.folders.find(x=>x.id===fid);
        if (!folder) return;
        if (confirm('Bericht löschen?')){
          folder.docs = folder.docs.filter(x=>x.id!==id); save(keys.cases, state.cases); render('/cases');
        }
      }
    }, { once:true });
  } else {
    const empty = document.createElement('div'); empty.className='card'; empty.textContent='Noch kein Fall angelegt.';
    right.append(empty);
  }

  left.addEventListener('click', e => {
    const id = e.target.dataset?.id;
    const act = e.target.dataset?.act;
    if (act === 'open' && id){ sessionStorage.setItem('ismc-selected-case', id); render('/cases'); }
    else if (act === 'del' && id){
      if (confirm('Diesen Fall komplett löschen?')){
        state.cases = state.cases.filter(c=>c.id!==id); save(keys.cases, state.cases); sessionStorage.removeItem('ismc-selected-case'); render('/cases');
      }
    }
  }, { once:true });

  view.append(h2, container);
  container.append(left, right);
}

function exportFolder(fall, folder){
  const data = JSON.stringify({ case: fall.title, folder: folder.name, exportedAt: new Date().toISOString(), docs: folder.docs }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (fall.title + '-' + folder.name).replace(/[^a-z0-9]+/gi,'_');
  a.href = url; a.download = `ISM_${safe}_export.json`; a.click();
  URL.revokeObjectURL(url);
}

/* Notes/Tasks/Links/Help/My/Settings same as before */
function renderNotes(){/* simplified: reuse from previous build */ return go('/'); }
function renderTasks(){ return go('/'); }
function renderLinks(){ return go('/'); }
function renderHelp(){ const v=$('#view'); v.innerHTML=''; const c=document.createElement('div'); c.className='card'; c.innerHTML='<h2>🛈 ISM Helpcenter</h2><p>Inhalt folgt. (Platzhalter)</p>'; v.append(c); }
function renderMy(){ const v=$('#view'); v.innerHTML=''; const c=document.createElement('div'); c.className='card'; c.innerHTML='<h2>🪪 My ISM</h2><p>Ihr Beamtenausweis erscheint in Kürze hier.</p>'; v.append(c); }
function renderSettings(){ const v=$('#view'); v.innerHTML=''; const c=document.createElement('div'); c.className='card grid'; const h2=document.createElement('h2'); h2.textContent='⚙️ Einstellungen'; const themeBtn=Object.assign(document.createElement('button'),{textContent:'Dark/Light umschalten'}); themeBtn.addEventListener('click',toggleTheme); const logoutBtn=Object.assign(document.createElement('button'),{textContent:'Abmelden'}); logoutBtn.addEventListener('click',logout); c.append(themeBtn,logoutBtn); v.append(h2,c); }

/* Helpers */
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* Global search */
$('#globalSearch').addEventListener('input', e => { state.search = e.target.value; if (state.session) render(currentRoute()); });

/* Nav */
$$('.sidebar nav a').forEach(a => a.addEventListener('click', () => { const path = a.getAttribute('href').slice(1); localStorage.setItem(keys.route, path); }));

/* Install prompt */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; const btn = $('#installBtn'); btn.hidden = false; btn.onclick = async () => { deferredPrompt.prompt(); deferredPrompt = null; btn.hidden = true; }; });

/* Hash routing */
window.addEventListener('hashchange', syncRoute);

/* Init */
initTheme();
if (!state.cases.length){ state.cases = [ { id: uid(), title:'DEMO-CASE', created: now(), folders: [ { id: uid(), name:'Berichte', docs: [] } ] } ]; save(keys.cases, state.cases); }
syncRoute();
