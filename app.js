const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };

// mehrere Passwörter erlaubt
const AGENTS = { 'A017': ['1107', 'BananaTomate1107'] };

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

/* Helpers */
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function now(){ return Date.now(); }
function fmt(ts){ return new Date(ts).toLocaleString(undefined,{dateStyle:'medium', timeStyle:'short'}); }
function fmtDateInput(ts){ const d=new Date(ts); return d.toISOString().slice(0,10); }
function uid(){ return (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2); }
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function normalizePw(s=''){
  return String(s).trim().replace(/\s+$/,'').replace(/\.+$/,'');
}

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

/* LOGIN */
function renderLogin(){
  const view = $('#view');
  view.innerHTML = `
    <div class="login card">
      <h1>🔐 ISM Cockpit</h1>
      <div class="field">
        <label for="agentId">Beamtennummer</label>
        <input id="agentId" placeholder="z. B. A017" autocomplete="username">
      </div>
      <div class="field">
        <label for="agentPw">Passwort</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="agentPw" type="password" placeholder="Passwort" autocomplete="current-password" style="flex:1;">
          <label style="white-space:nowrap; font-size:.9rem;">
            <input type="checkbox" id="showPw"> Anzeigen
          </label>
        </div>
      </div>
      <button id="loginBtn" class="primary">Anmelden</button>
      <div id="loginError" class="error" style="display:none;color:red;"> Falsche Anmeldedaten. Bitte versuchen Sie es erneut oder wenden Sie sich an Ihre zuständige Dienststelle für weitere Informationen.</div>
    </div>
  `;

  $('#loginBtn').onclick = doLogin;
  ['agentId','agentPw'].forEach(id => $(`#${id}`).addEventListener('keyup', e => { if (e.key === 'Enter') doLogin(); }));
  $('#showPw').onchange = e => { $('#agentPw').type = e.target.checked ? 'text' : 'password'; };
}

function doLogin(){
  const id = ($('#agentId')?.value || '').trim().toUpperCase();
  const pw = normalizePw($('#agentPw')?.value || '');
  const expectedList = AGENTS[id];
  const ok = Array.isArray(expectedList) && expectedList.some(exp => normalizePw(exp) === pw);

  if (!ok){
    $('#loginError').style.display = 'block';
    return;
  }

  state.session = { agent:id, org:ISM.org, loginAt: Date.now() };
  save(keys.session, state.session);
  updateAgentBadge();
  render(currentRoute());
}

function logout(){ state.session=null; localStorage.removeItem(keys.session); renderLogin(); }
function updateAgentBadge(){
  const el = document.querySelector('#agentBadge #agentId');
  if (el && state.session){ el.textContent = `${state.session.agent} • ${ISM.org}`; }
}

/* Views (Platzhalter außer Fälle) */
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
  const cards = [
    ['📁 Fälle', state.cases.length, '#/cases'],
    ['📝 Notizen', state.notes.length, '#/notes'],
    ['✅ Aufgaben', state.tasks.length, '#/tasks']
  ];
  cards.forEach(([label, meta, href]) => {
    const c = document.createElement('div'); c.className='card';
    c.innerHTML = `<h2>${label}</h2><p>${meta}</p><div class="btn-row"><a class="btn" href="${href}">Öffnen</a></div>`;
    wrap.appendChild(c);
  });
  view.appendChild(wrap);
}

function renderCases(){
  const view = $('#view');
  view.innerHTML = '<div class="card"><h2>📁 Fälle</h2><p>Hier kannst du Fälle und Berichte verwalten.</p></div>';
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
  themeBtn.addEventListener('click',toggleTheme);
  const logoutBtn=Object.assign(document.createElement('button'),{textContent:'Abmelden'});
  logoutBtn.addEventListener('click',logout);
  c.append(h2,themeBtn,logoutBtn); v.append(c);
}

/* Init */
initTheme();
syncRoute();
