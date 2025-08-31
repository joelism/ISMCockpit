/* ISM Cockpit – Login mit Passwort ODER PIN-Pad */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const ISM = { org: 'ISM Switzerland' };

// Erlaubte Geheimnisse pro Beamtennummer
const CREDENTIALS = {
  'A017': ['BananaTomate1107', '500011'] // Passwort ODER 6-stelliger PIN
};

const keys = {
  session:'ismc-session',
  theme:'ismc-theme',
  route:'ismc-route'
};

const state = {
  session: load(keys.session),
  route: localStorage.getItem(keys.route) || '/'
};

/* ========== Utils ========== */
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function normalize(s=''){ return String(s).trim().replace(/\s+$/,'').replace(/\.+$/,''); }

/* ========== Theme ========== */
function initTheme(){
  const pref = localStorage.getItem(keys.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (pref === 'dark' || (pref === null && prefersDark)) document.documentElement.classList.add('dark');
  const btn = $('#themeToggle'); if (btn) btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}
function toggleTheme(){
  const on = document.documentElement.classList.toggle('dark');
  localStorage.setItem(keys.theme, on ? 'dark' : 'light');
  const btn = $('#themeToggle'); if (btn) btn.textContent = on ? '☀️' : '🌙';
}

/* ========== Router ========== */
function go(route){ location.hash = route.startsWith('#') ? route : `#${route}`; }
function cur(){ return location.hash.replace(/^#/,'') || '/'; }
function sync(){
  const r = cur();
  localStorage.setItem(keys.route, r);
  if (!state.session) return renderLogin();
  render(r);
}
window.addEventListener('hashchange', sync);

/* ========== LOGIN ========== */
function validFor(id, secret){
  const list = CREDENTIALS[id]; if (!Array.isArray(list)) return false;
  const n = normalize(secret);
  return list.some(x => normalize(x) === n);
}

function renderLogin(){
  const view = $('#view');
  view.innerHTML = `
    <div class="login card" style="max-width:420px;margin:40px auto;display:grid;gap:12px">
      <h1>🔐 ISM Cockpit</h1>

      <div class="field" style="display:grid;gap:6px">
        <label for="agentId">Beamtennummer</label>
        <input id="agentId" placeholder="z. B. A017" autocomplete="username">
      </div>

      <div class="tabs" style="display:flex;gap:8px">
        <button class="tab-btn primary" data-tab="pw">Passwort</button>
        <button class="tab-btn" data-tab="pin">PIN</button>
      </div>

      <div id="tab-pw" class="tab card" style="display:grid;gap:10px;padding:10px">
        <label style="display:block">Passwort</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="agentPw" type="password" placeholder="Passwort" autocomplete="current-password" style="flex:1">
          <label style="white-space:nowrap;font-size:.9rem">
            <input type="checkbox" id="showPw"> Anzeigen
          </label>
        </div>
        <button id="loginPw" class="primary">Anmelden</button>
      </div>

      <div id="tab-pin" class="tab card" style="display:none;gap:10px;padding:10px">
        <label>PIN eingeben</label>
        <input id="pinDisplay" value="" inputmode="none" readonly style="letter-spacing:.3rem;text-align:center;padding:.6rem;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--fg)">
        <div class="pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${[1,2,3,4,5,6,7,8,9,'←',0,'C'].map(k => `
            <button class="pad-key" data-k="${k}" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--card)">${k}</button>
          `).join('')}
        </div>
        <button id="loginPin" class="primary">Anmelden</button>
      </div>

      <div id="loginError" class="error" style="display:none;color:#d93025;font-weight:600"> Falsche Anmeldedaten. Bitte versuchen Sie es erneut oder wenden Sie sich an die zuständige Dienststelle für weitere Informationen. </div>
    </div>
  `;

  // Tabs
  $$('.tab-btn').forEach(b => b.onclick = () => {
    $$('.tab-btn').forEach(x => x.classList.toggle('primary', x===b));
    const t = b.dataset.tab;
    $('#tab-pw').style.display = (t==='pw') ? 'grid' : 'none';
    $('#tab-pin').style.display = (t==='pin') ? 'grid' : 'none';
    $('#loginError').style.display = 'none';
  });

  // Passwort anzeigen
  $('#showPw').onchange = e => { $('#agentPw').type = e.target.checked ? 'text' : 'password'; };

  // Enter = Login (Passwort)
  ['agentId','agentPw'].forEach(id => $(`#${id}`).addEventListener('keyup', e => { if (e.key === 'Enter') doLoginPw(); }));

  // Buttons
  $('#loginPw').onclick = doLoginPw;
  $('#loginPin').onclick = doLoginPin;

  // PIN-Pad
  $$('.pad-key').forEach(k => k.onclick = () => {
    const v = $('#pinDisplay').value;
    const key = k.dataset.k;
    if (key === 'C') $('#pinDisplay').value = '';
    else if (key === '←') $('#pinDisplay').value = v.slice(0, -1);
    else $('#pinDisplay').value = (v + key).slice(0, 12);
  });

  setTimeout(()=>$('#agentId')?.focus(),0);
}

function doLoginPw(){
  const id = ($('#agentId')?.value || '').trim().toUpperCase();
  const pw = ($('#agentPw')?.value || '');
  if (validFor(id, pw)) return finishLogin(id);
  $('#loginError').style.display = 'block';
}

function doLoginPin(){
  const id = ($('#agentId')?.value || '').trim().toUpperCase();
  const pin = ($('#pinDisplay')?.value || '');
  if (validFor(id, pin)) return finishLogin(id);
  $('#loginError').style.display = 'block';
}

function finishLogin(id){
  state.session = { agent: id, org: ISM.org, loginAt: Date.now() };
  save(keys.session, state.session);
  updateBadge();
  render('/');
}

function logout(){ state.session=null; localStorage.removeItem(keys.session); renderLogin(); }
function updateBadge(){
  const el = document.querySelector('#agentBadge #agentId');
  if (el && state.session){ el.textContent = `${state.session.agent} • ${ISM.org}`; }
}

/* ========== Views (Minimal) ========== */
function render(route){
  const view = $('#view'); view.innerHTML = '';
  if (route === '/' || route === '') return renderDashboard();
  if (route === '/settings') return renderSettings();
  const card = document.createElement('div'); card.className='card'; card.innerHTML = '<h2>Seite</h2><p>Platzhalter.</p>'; view.append(card);
}

function renderDashboard(){
  const v = $('#view');
  const c = document.createElement('div'); c.className='card';
  const who = state.session ? `<strong>${state.session.agent}</strong> · ${state.session.org}` : '—';
  c.innerHTML = `<h2>🧭 Dashboard</h2><p>Angemeldet: ${who}</p><div class="btn-row"><a class="btn" href="#/settings">Einstellungen</a></div>`;
  v.append(c);
}

function renderSettings(){
  const v = $('#view');
  const c = document.createElement('div'); c.className='card';
  c.innerHTML = `
    <h2>⚙️ Einstellungen</h2>
    <div class="btn-row">
      <button id="themeBtn">Dark/Light umschalten</button>
      <button id="logoutBtn">Abmelden</button>
    </div>`;
  v.append(c);
  $('#themeBtn').onclick = toggleTheme;
  $('#logoutBtn').onclick = logout;
}

/* ========== Init ========== */
initTheme();
if (!state.session) renderLogin(); else render('/');
