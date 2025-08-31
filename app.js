/* ISM Cockpit – Pseudo-Login „Anmelden als A017“ mit PIN 500011 */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };

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

/* ---------- Utils ---------- */
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function now(){ return Date.now(); }
function fmt(ts){ return new Date(ts).toLocaleString(undefined,{dateStyle:'medium', timeStyle:'short'}); }
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

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

/* ---------- Backup ---------- */
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
      if (!parsed) return alert('Ungültiges Backup.');
      state.notes = parsed.notes || [];
      state.tasks = parsed.tasks || [];
      state.links = parsed.links || [];
      state.cases = parsed.cases || [];
      save(keys.notes, state.notes);
      save(keys.tasks, state.tasks);
      save(keys.links, state.links);
      save(keys.cases, state.cases);
      render(currentRoute());
    }catch{ alert('Konnte die Datei nicht lesen.'); }
  };
  reader.readAsText(file);
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
  c1.innerHTML = `<h2>📁 Fälle</h2><p>${state.cases.length} Fall/Fälle</p><div class="btn-row"><a class="btn" href="#/cases">Öffnen</a></div>`;
  const c2 = document.createElement('div'); c2.className='card';
  c2.innerHTML = `<h2>🪪 My ISM</h2><p>Ausweis: in Kürze</p><div class="btn-row"><a class="btn" href="#/my">Öffnen</a></div>`;
  const c3 = document.createElement('div'); c3.className='card';
  c3.innerHTML = `<h2>🛈 Helpcenter</h2><p>Platzhalter</p><div class="btn-row"><a class="btn" href="#/help">Öffnen</a></div>`;

  wrap.append(c1,c2,c3);
  view.appendChild(wrap);
}

function renderCases(){
  const view = $('#view');
  const card = document.createElement('div'); card.className='card';
  card.innerHTML = `
    <h2>📁 Fälle (File Manager)</h2>
    <p>Lege Fälle und Unterordner an, verfasse Berichte und exportiere Ordner (JSON). <em>(Einfach-Version)</em></p>
  `;
  view.append(card);

  const creator = document.createElement('div'); creator.className='card grid';
  const inp = Object.assign(document.createElement('input'), { placeholder:'Neuer Fall (z. B. CRV-2025-001)' });
  const add = Object.assign(document.createElement('button'), { textContent:'+ Fall anlegen', className:'primary' });
  add.onclick = () => {
    const t = inp.value.trim(); if (!t) return;
    state.cases.push({ id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), title: t, created: now(), folders: [] });
    save(keys.cases, state.cases); inp.value=''; render('/cases');
  };
  creator.append(inp, add);
  view.append(creator);

  const list = document.createElement('div'); list.className='grid';
  state.cases.slice().sort((a,b)=>b.created-a.created).forEach(c => {
    const item = document.createElement('div'); item.className='card';
    item.innerHTML = `<strong>${escapeHtml(c.title)}</strong><div class="meta">Angelegt: ${fmt(c.created)}</div>`;
    list.append(item);
  });
  view.append(list);
}

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
  clearBtn.onclick = () => {
    if (!confirm('Wirklich alle lokalen Cockpit-Daten löschen?')) return;
    state.notes=[]; state.tasks=[]; state.links=[]; state.cases=[];
    save(keys.notes, state.notes); save(keys.tasks, state.tasks); save(keys.links, state.links); save(keys.cases, state.cases);
    render('/');
  };
  const logoutBtn=Object.assign(document.createElement('button'),{textContent:'Abmelden (zur Login-Maske)'});
  logoutBtn.onclick = logout;
  c.append(h2, themeBtn, clearBtn, logoutBtn);
  v.append(c);
}

/* ---------- Global Events ---------- */
$('#themeToggle')?.addEventListener('click', toggleTheme);
$('#exportAll')?.addEventListener('click', exportAll);
$('#importAll')?.addEventListener('click', ()=> $('#importAllFile')?.click());
$('#importAllFile')?.addEventListener('change', e => {
  const f = e.target.files?.[0]; if (f) importAll(f);
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
  state.cases = [{ id: crypto.randomUUID?.() || 'demo', title:'DEMO-CASE', created: now(), folders: [] }];
  save(keys.cases, state.cases);
}
window.addEventListener('hashchange', syncRoute);
syncRoute();
updateAgentBadge();
