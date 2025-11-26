/* ISM Cockpit – police DB style, PIN-Login, Cases/Contacts/Reports
   Build: policeDB4
*/

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const ISM = { org: "ISM Switzerland" };

const KEYS = {
  session: "ismc-session",
  cases: "ismc-cases-v4",
  seq: "ismc-case-seq",
  theme: "ismc-theme",
  route: "ismc-route"
};

const state = {
  session: load(KEYS.session),
  cases: load(KEYS.cases) || [],
  search: ""
};

/* ---------- Utils ---------- */

function load(k) {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch {
    return null;
  }
}

function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

function now() {
  return Date.now();
}

function fmt(ts) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function fmtDateInput(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function fmtDateTimeLocal(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, c => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c];
  });
}

/* ---------- Theme ---------- */

function initTheme() {
  const pref = localStorage.getItem(KEYS.theme);
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const useDark = pref === "dark" || (pref === null && prefersDark);
  if (useDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  const t = $("#themeToggle");
  if (t) {
    t.textContent = document.documentElement.classList.contains("dark")
      ? "☀️"
      : "🌙";
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(KEYS.theme, isDark ? "dark" : "light");
  const t = $("#themeToggle");
  if (t) t.textContent = isDark ? "☀️" : "🌙";
}

/* ---------- Router ---------- */

function currentRoute() {
  return location.hash.replace(/^#/, "") || "/";
}

function highlightNav(route) {
  $$(".sidebar nav a").forEach(a => {
    const href = a.getAttribute("href") || "";
    a.classList.toggle("active", href === "#" + route);
  });
}

function syncRoute() {
  const route = currentRoute();
  localStorage.setItem(KEYS.route, route);
  highlightNav(route);

  if (!state.session) {
    renderLogin();
  } else {
    render(route);
  }
}

/* ---------- Login – PIN 500011, Agent A017 ---------- */

function renderLogin() {
  const view = $("#view");
  if (!view) return;

  view.innerHTML = `
    <div class="login card db-card" style="max-width:480px;margin:40px auto;display:grid;gap:18px;">
      <header class="db-header">
        <div class="db-title">ISM Cockpit</div>
        <div class="db-subtitle">Secure Case Database · Switzerland</div>
      </header>
      <section class="db-body">
        <p><strong>Anmelden als A017</strong></p>
        <div class="field" style="display:grid;gap:6px;text-align:left">
          <label for="pinInput">PIN</label>
          <input id="pinInput" class="db-input" type="password" inputmode="numeric"
                 maxlength="12" placeholder="*****">
          <label class="db-checkbox">
            <input type="checkbox" id="showPin"> Anzeigen
          </label>
        </div>
        <button id="loginBtn" class="primary db-primary">Jetzt einloggen</button>
        <div id="loginError" class="db-error" style="display:none;">Falscher PIN.</div>
      </section>
      <footer class="db-footer">
        ISM Internal Use Only · Unauthorized access prohibited
      </footer>
    </div>
  `;

  const pin = $("#pinInput");
  const showPin = $("#showPin");
  const error = $("#loginError");
  const btn = $("#loginBtn");

  if (showPin) {
    showPin.addEventListener("change", e => {
      pin.type = e.target.checked ? "text" : "password";
    });
  }

  function tryLogin() {
    const value = (pin.value || "").trim();
    if (value === "500011") {
      state.session = {
        agent: "A017",
        org: ISM.org,
        loginAt: now()
      };
      save(KEYS.session, state.session);
      updateAgentBadge();
      const route = localStorage.getItem(KEYS.route) || "/cases";
      location.hash = "#" + route;
    } else {
      if (error) error.style.display = "block";
      pin.focus();
      pin.select && pin.select();
    }
  }

  if (btn) btn.addEventListener("click", tryLogin);
  if (pin) {
    pin.addEventListener("keyup", e => {
      if (e.key === "Enter") tryLogin();
    });
    setTimeout(() => pin.focus(), 0);
  }
}

function logout() {
  state.session = null;
  localStorage.removeItem(KEYS.session);
  renderLogin();
}

function updateAgentBadge() {
  const el = $("#agentBadge #agentId");
  if (el && state.session) {
    el.textContent = `${state.session.agent} • ${ISM.org}`;
  }
}

/* ---------- Cases helpers ---------- */

function nextCaseNumber() {
  const agent = (state.session && state.session.agent) || "A017";
  const raw = parseInt(localStorage.getItem(KEYS.seq) || "9", 10) + 1;
  localStorage.setItem(KEYS.seq, String(raw));
  const triple = String(raw).padStart(3, "0");
  return `F${triple}${agent}`;
}

/* ---------- Main render ---------- */

function render(route) {
  const view = $("#view");
  if (!view) return;

  view.innerHTML = "";
  updateAgentBadge();

  if (route === "/" || route === "") return renderDashboard();
  if (route === "/cases") return renderCases();
  if (route === "/help") return renderHelp();
  if (route === "/my") return renderMy();
  if (route === "/settings") return renderSettings();

  const err = document.createElement("div");
  err.className = "card db-card";
  err.textContent = "Seite nicht gefunden.";
  view.appendChild(err);
}

/* ---------- Dashboard ---------- */

function renderDashboard() {
  const view = $("#view");
  const wrap = document.createElement("div");
  wrap.className = "grid k3";

  const totalShorts = state.cases.reduce(
    (acc, c) => acc + (c.shorts ? c.shorts.length : 0),
    0
  );

  const c1 = document.createElement("div");
  c1.className = "card db-card";
  c1.innerHTML = `
    <h2>📁 Fälle</h2>
    <p class="db-kpi">${state.cases.length}</p>
    <p class="db-kpi-label">Gesamt-Fälle</p>
    <div class="btn-row">
      <a class="btn" href="#/cases">Fallübersicht öffnen</a>
    </div>
  `;

  const c2 = document.createElement("div");
  c2.className = "card db-card";
  c2.innerHTML = `
    <h2>⚡ Kurzberichte</h2>
    <p class="db-kpi">${totalShorts}</p>
    <p class="db-kpi-label">Einträge in allen Fällen</p>
  `;

  const c3 = document.createElement("div");
  c3.className = "card db-card";
  c3.innerHTML = `
    <h2>🪪 My ISM</h2>
    <p>Ihr Ausweis erscheint in Kürze hier.</p>
    <div class="btn-row">
      <a class="btn" href="#/my">My ISM öffnen</a>
    </div>
  `;

  wrap.append(c1, c2, c3);
  view.appendChild(wrap);

  // Letzte Kurzberichte
  const feedCard = document.createElement("div");
  feedCard.className = "card db-card";
  feedCard.innerHTML = `<h3>Letzte Kurzberichte</h3>`;
  const table = document.createElement("div");
  table.className = "db-table";
  const header = document.createElement("div");
  header.className = "db-row db-row-head";
  header.innerHTML = `<div>Fall</div><div>Datum/Zeit</div><div>Text</div>`;
  table.appendChild(header);

  const allShorts = [];
  state.cases.forEach(c => {
    (c.shorts || []).forEach(s => allShorts.push({ caseTitle: c.title, s }));
  });
  allShorts.sort((a, b) => new Date(b.s.dt) - new Date(a.s.dt));

  if (allShorts.length === 0) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="3">Noch keine Kurzberichte vorhanden.</div>`;
    table.appendChild(row);
  } else {
    allShorts.slice(0, 8).forEach(entry => {
      const row = document.createElement("div");
      row.className = "db-row";
      row.innerHTML = `
        <div>${escapeHtml(entry.caseTitle)}</div>
        <div>${new Date(entry.s.dt).toLocaleString()}</div>
        <div class="db-cell-text">${escapeHtml(entry.s.text)}</div>
      `;
      table.appendChild(row);
    });
  }

  feedCard.appendChild(table);
  view.appendChild(feedCard);
}

/* ---------- Fälle ---------- */

function renderCases() {
  const view = $("#view");

  const title = document.createElement("h2");
  title.textContent = "📁 Fall-Datenbank";

  const layout = document.createElement("div");
  layout.className = "columns db-columns";

  /* Left column: new + search + list */
  const left = document.createElement("div");
  left.className = "pane db-pane-left";

  // Neuer Fall
  const creatorCard = document.createElement("div");
  creatorCard.className = "card db-card grid";

  const newCaseInput = document.createElement("input");
  newCaseInput.className = "db-input";
  newCaseInput.placeholder = "Fallnummer (z. B. F010A017)";
  newCaseInput.value = nextCaseNumber();

  const addBtn = document.createElement("button");
  addBtn.className = "primary db-primary";
  addBtn.textContent = "+ Fall anlegen";

  const regenBtn = document.createElement("button");
  regenBtn.className = "db-btn-ghost";
  regenBtn.textContent = "Fallnummer neu generieren";

  addBtn.addEventListener("click", () => {
    const name = newCaseInput.value.trim();
    if (!name) return;
    const c = {
      id: uid(),
      title: name,
      created: now(),
      status: "open",
      folders: [],
      reports: [],
      contacts: [],
      shorts: []
    };
    state.cases.push(c);
    save(KEYS.cases, state.cases);
    newCaseInput.value = nextCaseNumber();
    render("/cases");
  });

  regenBtn.addEventListener("click", () => {
    newCaseInput.value = nextCaseNumber();
  });

  creatorCard.append(newCaseInput, addBtn, regenBtn);
  left.appendChild(creatorCard);

  // Suche
  const searchCard = document.createElement("div");
  searchCard.className = "card db-card";
  const searchInput = document.createElement("input");
  searchInput.className = "db-input";
  searchInput.placeholder = "Suche nach Fallnummer / Name / Telefonnummer";
  searchInput.value = state.search;
  searchInput.addEventListener("input", e => {
    state.search = e.target.value;
    render("/cases");
  });
  searchCard.appendChild(searchInput);
  left.appendChild(searchCard);

  // Liste
  const list = document.createElement("div");
  list.className = "list db-case-list";

  const q = (state.search || "").trim().toLowerCase();
  const filtered = state.cases
    .slice()
    .sort((a, b) => b.created - a.created)
    .filter(c => {
      if (!q) return true;
      const haystack = [
        c.title,
        ...(c.contacts || []).map(x => x.name || ""),
        ...(c.contacts || []).map(x => x.elnr || "")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  filtered.forEach(c => {
    const item = document.createElement("div");
    item.className = "case db-case-row";

    const statusLabel =
      c.status === "closed"
        ? "Abgeschlossen"
        : c.status === "progress"
        ? "In Bearbeitung"
        : "Offen";

    item.innerHTML = `
      <div class="db-case-main">
        <div class="db-case-title">${escapeHtml(c.title)}</div>
        <div class="db-case-meta">Angelegt: ${fmt(c.created)}</div>
        <div class="db-case-meta">
          Kontakte: ${(c.contacts || []).length} · Kurzberichte: ${(c.shorts || []).length}
        </div>
      </div>
      <div class="db-case-actions">
        <span class="db-status db-status-${c.status || "open"}">${statusLabel}</span>
        <div class="btn-row">
          <button data-act="open" data-id="${c.id}">Öffnen</button>
          <button data-act="del" data-id="${c.id}">Löschen</button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  left.appendChild(list);

  // Clicks in der Liste
  left.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (!id || !act) return;

    const c = state.cases.find(x => x.id === id);
    if (!c) return;

    if (act === "open") {
      sessionStorage.setItem("ismc-selected-case", id);
      render("/cases");
    } else if (act === "del") {
      if (confirm("Diesen Fall komplett löschen?")) {
        state.cases = state.cases.filter(x => x.id !== id);
        save(KEYS.cases, state.cases);
        sessionStorage.removeItem("ismc-selected-case");
        render("/cases");
      }
    }
  });

  /* Right column: selected case */

  const right = document.createElement("div");
  right.className = "pane db-pane-right";

  const selId = sessionStorage.getItem("ismc-selected-case");
  const selected = state.cases.find(c => c.id === selId) || state.cases[0];

  if (!selected) {
    const empty = document.createElement("div");
    empty.className = "card db-card";
    empty.textContent = "Noch kein Fall angelegt.";
    right.appendChild(empty);
  } else {
    sessionStorage.setItem("ismc-selected-case", selected.id);

    const head = document.createElement("div");
    head.className = "card db-card db-case-head";

    const statusLabel =
      selected.status === "closed"
        ? "Abgeschlossen"
        : selected.status === "progress"
        ? "In Bearbeitung"
        : "Offen";

    head.innerHTML = `
      <div class="db-case-head-main">
        <div class="db-case-head-title">${escapeHtml(selected.title)}</div>
        <div class="db-case-head-meta">Angelegt: ${fmt(selected.created)}</div>
      </div>
      <div class="db-case-head-actions">
        <select id="caseStatusSelect" class="db-input db-select">
          <option value="open"${
            selected.status === "open" ? " selected" : ""
          }>Offen</option>
          <option value="progress"${
            selected.status === "progress" ? " selected" : ""
          }>In Bearbeitung</option>
          <option value="closed"${
            selected.status === "closed" ? " selected" : ""
          }>Abgeschlossen</option>
        </select>
        <span class="db-status db-status-${selected.status ||
          "open"}" id="caseStatusBadge">${statusLabel}</span>
      </div>
      <div class="tabbar">
        <button data-tab="files" class="active">📂 Akte</button>
        <button data-tab="reports">📄 Berichte</button>
        <button data-tab="shorts">⚡ Kurzberichte</button>
        <button data-tab="contacts">👥 Kontakte</button>
      </div>
    `;
    right.appendChild(head);

    const body = document.createElement("div");
    body.className = "tabcontent";
    right.appendChild(body);

    function showTab(name) {
      $$(".tabbar button", head).forEach(b => {
        b.classList.toggle("active", b.dataset.tab === name);
      });
      body.innerHTML = "";
      if (name === "files") renderTabFiles(selected, body);
      if (name === "reports") renderTabReports(selected, body);
      if (name === "shorts") renderTabShorts(selected, body);
      if (name === "contacts") renderTabContacts(selected, body);
    }

    showTab("files");

    const tabbar = $(".tabbar", head);
    tabbar.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      showTab(btn.dataset.tab);
    });

    const statusSelect = $("#caseStatusSelect", head);
    const statusBadge = $("#caseStatusBadge", head);
    statusSelect.addEventListener("change", e => {
      selected.status = e.target.value;
      save(KEYS.cases, state.cases);
      const lbl =
        selected.status === "closed"
          ? "Abgeschlossen"
          : selected.status === "progress"
          ? "In Bearbeitung"
          : "Offen";
      statusBadge.textContent = lbl;
      statusBadge.className = "db-status db-status-" + selected.status;
      render("/cases");
    });
  }

  layout.append(left, right);
  view.append(title, layout);
}

/* ----- Tab: Akte (Ordner / Platzhalter) ----- */

function renderTabFiles(selected, body) {
  const creator = document.createElement("div");
  creator.className = "card db-card grid";

  const input = document.createElement("input");
  input.className = "db-input";
  input.placeholder = "Neuer Unterordner (z. B. Berichte, Beweise, Fotos)";

  const btn = document.createElement("button");
  btn.className = "primary db-primary";
  btn.textContent = "+ Unterordner anlegen";

  btn.addEventListener("click", () => {
    const name = input.value.trim();
    if (!name) return;
    selected.folders.push({ id: uid(), name });
    save(KEYS.cases, state.cases);
    input.value = "";
    render("/cases");
  });

  creator.append(input, btn);
  body.appendChild(creator);

  selected.folders.forEach(f => {
    const card = document.createElement("div");
    card.className = "card db-card";
    card.innerHTML = `
      <div class="db-section-head">
        <div class="db-section-title">Ordner: ${escapeHtml(f.name)}</div>
        <div class="db-section-meta">Platzhalter für Dateien (lokal).</div>
      </div>
      <p style="font-size:.85rem;opacity:.8;">
        Später können hier echte Dateien (Bilder, TXT) verknüpft werden.
      </p>
    `;
    body.appendChild(card);
  });
}

/* ----- Tab: Berichte + Gesamtbericht-PDF ----- */

function renderTabReports(selected, body) {
  const card = document.createElement("div");
  card.className = "card db-card";

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  const typeSel = document.createElement("select");
  typeSel.className = "db-input db-select";
  ["Personenbericht", "Erstbericht", "Abschlussbericht", "Kurzbericht"].forEach(
    t => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
  );

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "db-input";
  dateInput.value = fmtDateInput(now());

  const titleInput = document.createElement("input");
  titleInput.className = "db-input";
  titleInput.placeholder = "Berichtstitel";

  const bodyInput = document.createElement("textarea");
  bodyInput.className = "db-input";
  bodyInput.rows = 5;
  bodyInput.placeholder = "Berichtstext …";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "+ Bericht speichern";

  saveBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    const text = bodyInput.value.trim();
    if (!title && !text) return;
    selected.reports.push({
      id: uid(),
      type: typeSel.value,
      date: dateInput.value,
      title,
      body: text,
      updated: now()
    });
    save(KEYS.cases, state.cases);
    titleInput.value = "";
    bodyInput.value = "";
    render("/cases");
  });

  const pdfBtn = document.createElement("button");
  pdfBtn.className = "db-btn-ghost";
  pdfBtn.textContent = "Gesamtberichte als PDF";
  pdfBtn.addEventListener("click", () => exportCasePdf(selected));

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";
  btnRow.append(saveBtn, pdfBtn);

  form.append(
    labelWrap("Typ", typeSel),
    labelWrap("Datum", dateInput),
    labelWrap("Titel", titleInput),
    labelWrap("Text", bodyInput),
    btnRow
  );

  card.innerHTML = `<div class="db-section-title">Bericht erfassen</div>`;
  card.appendChild(form);
  body.appendChild(card);

  const table = document.createElement("div");
  table.className = "db-table";
  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML =
    `<div>Typ</div><div>Datum</div><div>Titel</div><div>Zuletzt</div><div>Aktionen</div>`;
  table.appendChild(head);

  const docs = selected.reports.slice().sort((a, b) => b.updated - a.updated);

  if (docs.length === 0) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="5">Noch keine Berichte.</div>`;
    table.appendChild(row);
  } else {
    docs.forEach(d => {
      const row = document.createElement("div");
      row.className = "db-row";

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const viewBtn = document.createElement("button");
      viewBtn.textContent = "Anzeigen";
      viewBtn.addEventListener("click", () => {
        alert(
          `Typ: ${d.type}\nDatum: ${d.date}\nTitel: ${d.title}\n\n${d.body}`
        );
      });

      const editBtn = document.createElement("button");
      editBtn.textContent = "Bearb.";
      editBtn.addEventListener("click", () => {
        const nt = prompt("Titel bearbeiten:", d.title || "");
        if (nt === null) return;
        const nb = prompt("Text bearbeiten:", d.body || "");
        if (nb === null) return;
        d.title = nt.trim();
        d.body = nb.trim();
        d.updated = now();
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", () => {
        if (!confirm("Bericht löschen?")) return;
        selected.reports = selected.reports.filter(x => x.id !== d.id);
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      actions.append(viewBtn, editBtn, delBtn);

      row.innerHTML = `
        <div>${escapeHtml(d.type)}</div>
        <div>${escapeHtml(d.date)}</div>
        <div>${escapeHtml(d.title || "(Ohne Titel)")}</div>
        <div>${fmt(d.updated)}</div>
      `;
      const actCell = document.createElement("div");
      actCell.appendChild(actions);
      row.appendChild(actCell);

      table.appendChild(row);
    });
  }

  body.appendChild(table);
}

/* Gesamtberichte als „PDF“ (über Druckdialog) */

function exportCasePdf(selected) {
  try {
    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup blockiert. Bitte Popups/Pop-ups für diese Seite im Browser erlauben."
      );
      return;
    }

    const title = escapeHtml(selected.title || "");

    let html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gesamtbericht ${title}</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 24px;
            background: #ffffff;
            color: #000000;
            line-height: 1.4;
          }
          h1 { font-size: 22px; margin-bottom: 0.2em; }
          h2 { font-size: 18px; margin-top: 1.4em; margin-bottom: 0.3em; }
          h3 { font-size: 15px; margin-top: 1em; margin-bottom: 0.2em; }
          .meta { font-size: 11px; color: #444; margin-bottom: 0.8em; }
          .block { border-top: 1px solid #ccc; padding-top: 0.6em; margin-top: 0.6em; }
          ul { padding-left: 1.2em; }
        </style>
      </head>
      <body>
    `;

    html += `<h1>Gesamtbericht ${title}</h1>`;
    html += `<p class="meta">Generiert: ${escapeHtml(
      new Date().toLocaleString()
    )}</p>`;

    html += `<h2>Fallinformationen</h2>`;
    html += `<p><strong>Aktenzeichen:</strong> ${title}<br><strong>Angelegt:</strong> ${escapeHtml(
      fmt(selected.created)
    )}</p>`;

    html += `<h2>Beteiligte Kontakte</h2>`;
    if (!selected.contacts || !selected.contacts.length) {
      html += `<p>Keine Kontakte erfasst.</p>`;
    } else {
      html += "<ul>";
      selected.contacts.forEach(c => {
        html += "<li><strong>" + escapeHtml(c.name || "") + "</strong>";
        if (c.role) html += " (" + escapeHtml(c.role) + ")";
        const extra = [];
        if (c.dob) extra.push("Geburt: " + escapeHtml(c.dob));
        if (c.elnr) extra.push("Telefon: " + escapeHtml(c.elnr));
        if (c.address) extra.push("Adresse: " + escapeHtml(c.address));
        if (c.email) extra.push("E-Mail: " + escapeHtml(c.email));
        if (extra.length) html += "<br>" + extra.join(" · ");
        if (c.notes) html += "<br>" + escapeHtml(c.notes);
        html += "</li>";
      });
      html += "</ul>";
    }

    html += `<h2>Berichte</h2>`;
    if (!selected.reports || !selected.reports.length) {
      html += `<p>Keine Berichte erfasst.</p>`;
    } else {
      selected.reports
        .slice()
        .sort((a, b) => b.updated - a.updated)
        .forEach(r => {
          html += '<div class="block">';
          html +=
            "<h3>" +
            escapeHtml(r.type || "") +
            " – " +
            escapeHtml(r.title || "(Ohne Titel)") +
            "</h3>";
          if (r.date) {
            html +=
              '<p class="meta">Berichtsdatum: ' +
              escapeHtml(r.date) +
              "</p>";
          }
          const text = escapeHtml(r.body || "").replace(/\n/g, "<br>");
          html += "<p>" + text + "</p>";
          html += "</div>";
        });
    }

    html += `<h2>Kurzberichte</h2>`;
    if (!selected.shorts || !selected.shorts.length) {
      html += `<p>Keine Kurzberichte erfasst.</p>`;
    } else {
      html += "<ul>";
      selected.shorts
        .slice()
        .sort((a, b) => new Date(b.dt) - new Date(a.dt))
        .forEach(s => {
          html +=
            "<li><strong>" +
            escapeHtml(new Date(s.dt).toLocaleString()) +
            ":</strong> " +
            escapeHtml(s.text || "") +
            "</li>";
        });
      html += "</ul>";
    }

    html += `<p class="meta">
      Hinweis: Dieses Dokument wurde automatisch aus dem ISM Cockpit erzeugt.
      Um eine PDF-Datei zu erhalten, bitte im Browser den Druckdialog öffnen
      und „Als PDF speichern“ wählen.
    </p>`;

    html += "</body></html>";

    win.document.open();
    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.focus();
      try {
        win.print();
      } catch (_) {
        /* Ignore */
      }
    }, 400);
  } catch (err) {
    console.error(err);
    alert("Gesamtbericht konnte nicht geöffnet werden.");
  }
}

/* ----- Tab: Kurzberichte (Fall) ----- */

function renderTabShorts(selected, body) {
  const card = document.createElement("div");
  card.className = "card db-card";

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  const when = document.createElement("input");
  when.type = "datetime-local";
  when.className = "db-input";
  when.value = fmtDateTimeLocal(now());

  const text = document.createElement("textarea");
  text.className = "db-input";
  text.rows = 3;
  text.placeholder = "Kurzbericht (max. einige Sätze) …";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "+ Kurzbericht speichern";

  saveBtn.addEventListener("click", () => {
    const txt = text.value.trim();
    if (!txt) return;
    selected.shorts.push({
      id: uid(),
      dt: when.value,
      text: txt
    });
    save(KEYS.cases, state.cases);
    text.value = "";
    render("/cases");
  });

  form.append(labelWrap("Datum/Zeit", when), labelWrap("Text", text), saveBtn);

  card.innerHTML = `<div class="db-section-title">Kurzbericht erfassen</div>`;
  card.appendChild(form);
  body.appendChild(card);

  const table = document.createElement("div");
  table.className = "db-table";
  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML = `<div>Datum/Zeit</div><div>Text</div><div>Aktionen</div>`;
  table.appendChild(head);

  const list = selected.shorts
    .slice()
    .sort((a, b) => new Date(b.dt) - new Date(a.dt));

  if (list.length === 0) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="3">Noch keine Kurzberichte.</div>`;
    table.appendChild(row);
  } else {
    list.forEach(s => {
      const row = document.createElement("div");
      row.className = "db-row";

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const editBtn = document.createElement("button");
      editBtn.textContent = "Bearb.";
      editBtn.addEventListener("click", () => {
        const nd = prompt(
          "Datum/Zeit (YYYY-MM-DDTHH:MM):",
          s.dt || fmtDateTimeLocal(now())
        );
        if (nd === null) return;
        const nt = prompt("Text bearbeiten:", s.text);
        if (nt === null) return;
        s.dt = nd;
        s.text = nt.trim();
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", () => {
        if (!confirm("Kurzbericht löschen?")) return;
        selected.shorts = selected.shorts.filter(x => x.id !== s.id);
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      actions.append(editBtn, delBtn);

      row.innerHTML = `
        <div>${new Date(s.dt).toLocaleString()}</div>
        <div class="db-cell-text">${escapeHtml(s.text)}</div>
      `;
      const actCell = document.createElement("div");
      actCell.appendChild(actions);
      row.appendChild(actCell);

      table.appendChild(row);
    });
  }

  body.appendChild(table);
}

/* ----- Tab: Kontakte (mit Telefonnummer) ----- */

function renderTabContacts(selected, body) {
  const card = document.createElement("div");
  card.className = "card db-card";

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  const roleSel = document.createElement("select");
  roleSel.className = "db-input db-select";
  [
    ["ermittler", "Ermittler"],
    ["beschuldigt", "Beschuldigte Person"],
    ["zeuge", "Zeuge"],
    ["opfer", "Opfer"],
    ["sonstige", "Sonstige Person"]
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    roleSel.appendChild(o);
  });

  const nameInput = document.createElement("input");
  nameInput.className = "db-input";
  nameInput.placeholder = "Name";

  const dobInput = document.createElement("input");
  dobInput.type = "date";
  dobInput.className = "db-input";

  const phoneInput = document.createElement("input");
  phoneInput.className = "db-input";
  phoneInput.placeholder = "Telefonnummer";

  const addrInput = document.createElement("input");
  addrInput.className = "db-input";
  addrInput.placeholder = "Adresse";

  const mailInput = document.createElement("input");
  mailInput.type = "email";
  mailInput.className = "db-input";
  mailInput.placeholder = "E-Mail";

  const notesInput = document.createElement("textarea");
  notesInput.className = "db-input";
  notesInput.rows = 2;
  notesInput.placeholder = "Weitere Infos";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "+ Kontakt speichern";

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) return;
    selected.contacts.push({
      id: uid(),
      role: roleSel.value,
      name,
      dob: dobInput.value,
      elnr: phoneInput.value.trim(), // intern weiter elnr, Label = Telefonnummer
      address: addrInput.value.trim(),
      email: mailInput.value.trim(),
      notes: notesInput.value.trim()
    });
    save(KEYS.cases, state.cases);
    nameInput.value = "";
    dobInput.value = "";
    phoneInput.value = "";
    addrInput.value = "";
    mailInput.value = "";
    notesInput.value = "";
    render("/cases");
  });

  form.append(
    labelWrap("Typ", roleSel),
    labelWrap("Name", nameInput),
    labelWrap("Geburtsdatum", dobInput),
    labelWrap("Telefonnummer", phoneInput),
    labelWrap("Adresse", addrInput),
    labelWrap("E-Mail", mailInput),
    labelWrap("Weitere Infos", notesInput),
    saveBtn
  );

  card.innerHTML = `<div class="db-section-title">Kontakt erfassen</div>`;
  card.appendChild(form);
  body.appendChild(card);

  const table = document.createElement("div");
  table.className = "db-table";
  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML =
    `<div>Typ</div><div>Name</div><div>Geburt</div><div>Telefonnummer</div><div>Aktionen</div>`;
  table.appendChild(head);

  const list = (selected.contacts || [])
    .slice()
    .sort((a, b) => {
      const r = (a.role || "").localeCompare(b.role || "");
      if (r !== 0) return r;
      return (a.name || "").localeCompare(b.name || "");
    });

  if (list.length === 0) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="5">Noch keine Kontakte.</div>`;
    table.appendChild(row);
  } else {
    list.forEach(c => {
      const row = document.createElement("div");
      row.className = "db-row";

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const showBtn = document.createElement("button");
      showBtn.textContent = "Details";
      showBtn.addEventListener("click", () => {
        alert(
          [
            `Typ: ${c.role}`,
            `Name: ${c.name}`,
            `Geburt: ${c.dob || "-"}`,
            `Telefonnummer: ${c.elnr || "-"}`,
            `Adresse: ${c.address || "-"}`,
            `E-Mail: ${c.email || "-"}`,
            "",
            c.notes || ""
          ].join("\n")
        );
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", () => {
        if (!confirm("Kontakt löschen?")) return;
        selected.contacts = selected.contacts.filter(x => x.id !== c.id);
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      actions.append(showBtn, delBtn);

      row.innerHTML = `
        <div>${escapeHtml(c.role)}</div>
        <div>${escapeHtml(c.name)}</div>
        <div>${escapeHtml(c.dob || "–")}</div>
        <div>${escapeHtml(c.elnr || "–")}</div>
      `;
      const actCell = document.createElement("div");
      actCell.appendChild(actions);
      row.appendChild(actCell);

      table.appendChild(row);
    });
  }

  body.appendChild(table);
}

/* ---------- Misc Views ---------- */

function renderHelp() {
  const view = $("#view");
  view.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card db-card";
  card.innerHTML = `
    <h2>🛈 ISM Helpcenter</h2>
    <p>Platzhalter für interne Richtlinien, Zuständigkeiten, Notfallnummern etc.</p>
  `;
  view.appendChild(card);
}

function renderMy() {
  const view = $("#view");
  view.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card db-card";
  card.innerHTML = `
    <h2>🪪 My ISM</h2>
    <p>Ihr Beamtenausweis erscheint in Kürze hier.</p>
  `;
  view.appendChild(card);
}

function renderSettings() {
  const view = $("#view");
  view.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card db-card grid";

  const h2 = document.createElement("h2");
  h2.textContent = "⚙️ Einstellungen";

  const themeBtn = document.createElement("button");
  themeBtn.className = "db-btn-ghost";
  themeBtn.textContent = "Dark/Light umschalten";
  themeBtn.addEventListener("click", toggleTheme);

  const clearBtn = document.createElement("button");
  clearBtn.className = "db-btn-ghost";
  clearBtn.textContent = "Alle lokalen Daten löschen";
  clearBtn.addEventListener("click", () => {
    if (!confirm("Wirklich alle lokalen Cockpit-Daten löschen?")) return;
    state.cases = [];
    save(KEYS.cases, state.cases);
    render("/");
  });

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "db-btn-ghost";
  logoutBtn.textContent = "Abmelden (zur Login-Maske)";
  logoutBtn.addEventListener("click", logout);

  card.append(h2, themeBtn, clearBtn, logoutBtn);
  view.appendChild(card);
}

/* ---------- Helpers ---------- */

function labelWrap(label, element) {
  const w = document.createElement("label");
  w.style.display = "grid";
  w.style.gap = "6px";
  const span = document.createElement("span");
  span.textContent = label;
  w.append(span, element);
  return w;
}

/* ---------- Global UI wiring ---------- */

function initGlobalUi() {
  const themeBtn = $("#themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const globalSearch = $("#globalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("input", e => {
      state.search = e.target.value;
      if (state.session) render(currentRoute());
    });
  }

  $$(".sidebar nav a").forEach(a => {
    a.addEventListener("click", () => {
      const href = a.getAttribute("href") || "#/";
      const path = href.replace(/^#/, "");
      localStorage.setItem(KEYS.route, path);
    });
  });

  const exportBtn = $("#exportAll");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const data = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          cases: state.cases
        },
        null,
        2
      );
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ism-cases-backup.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const importBtn = $("#importAll");
  const importFile = $("#importAllFile");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.cases)) {
            alert("Ungültiges Backup.");
            return;
          }
          state.cases = parsed.cases;
          save(KEYS.cases, state.cases);
          render("/cases");
        } catch {
          alert("Konnte die Datei nicht lesen.");
        }
      };
      reader.readAsText(file);
    });
  }

  // PWA install button (optional)
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = $("#installBtn");
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt = null;
        btn.hidden = true;
      });
    }
  });
}

/* ---------- Init ---------- */

(function init() {
  initTheme();
  initGlobalUi();

  if (!state.cases.length) {
    // Demo-Fall
    state.cases = [
      {
        id: uid(),
        title: "F010A017",
        created: now(),
        status: "open",
        folders: [],
        reports: [],
        contacts: [],
        shorts: []
      }
    ];
    save(KEYS.cases, state.cases);
  }

  window.addEventListener("hashchange", syncRoute);
  syncRoute();
  updateAgentBadge();
})();

/* ---------- Extra CSS: Police-DB Look, bessere Lesbarkeit ---------- */

(function injectDbCss() {
  const css = `
  :root {
    --ism-orange: #ff7a00;
  }

  body {
    background: #05060a;
    color: #f2f2f2;
  }

  .sidebar {
    background: #05070a;
    border-right: 1px solid #262626;
  }

  .sidebar nav a {
    display: block;
    margin-bottom: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #2a2d3c;
    background: #101219;
    color: #e5e5e5;
    font-size: 0.92rem;
  }

  .sidebar nav a.active {
    background: var(--ism-orange);
    color: #000;
    border-color: var(--ism-orange);
  }

  #globalSearch {
    background: #101219;
    color: #f5f5f5;
    border-radius: 10px;
    border: 1px solid #34384a;
  }

  .db-card {
    background: #0c0e16;
    border: 1px solid rgba(255,255,255,.10);
    box-shadow: 0 0 0 1px rgba(0,0,0,.6);
    color: #f4f4f4;
  }

  .db-header {
    border-bottom: 1px solid rgba(255,255,255,.12);
    padding-bottom: .5rem;
    margin-bottom: .5rem;
  }

  .db-title {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--ism-orange);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .db-subtitle {
    font-size: .85rem;
    opacity: .8;
  }

  .db-body {
    display: grid;
    gap: .75rem;
  }

  .db-footer {
    font-size: .75rem;
    opacity: .7;
    border-top: 1px solid rgba(255,255,255,.12);
    padding-top: .4rem;
  }

  .db-input {
    padding: .5rem .6rem;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.30);
    background: #050609;
    color: #f5f5f5;
    font-size: .95rem;
  }

  .db-input:focus {
    outline: 1px solid var(--ism-orange);
    border-color: var(--ism-orange);
  }

  .db-select {
    padding-right: 1.5rem;
  }

  .db-checkbox {
    user-select: none;
    font-size: .9rem;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    opacity: .9;
  }

  .db-primary {
    background: var(--ism-orange);
    border: none;
    color: #000;
    font-weight: 600;
  }

  .db-primary:hover {
    filter: brightness(1.05);
  }

  .db-error {
    color: #ff6b6b;
    font-weight: 600;
    font-size: .9rem;
  }

  .db-kpi {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--ism-orange);
    margin: .2rem 0;
  }

  .db-kpi-label {
    font-size: .9rem;
    opacity: .8;
    margin-bottom: .6rem;
  }

  .db-table {
    display: grid;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 8px;
    overflow: hidden;
    font-size: .9rem;
  }

  .db-row {
    display: grid;
    grid-template-columns: 1.1fr .9fr 2.2fr .9fr .9fr;
    align-items: stretch;
  }

  .db-row-head {
    background: #181b25;
    font-weight: 600;
    border-bottom: 1px solid rgba(255,255,255,.25);
  }

  .db-row > div {
    padding: .35rem .5rem;
    border-bottom: 1px solid rgba(255,255,255,.06);
    border-right: 1px solid rgba(255,255,255,.04);
  }

  .db-row > div:last-child {
    border-right: none;
  }

  .db-row:nth-child(even):not(.db-row-head) {
    background: #10121c;
  }

  .db-cell-text {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 260px;
  }

  .db-cell-empty {
    text-align: center;
    grid-column: 1 / -1;
    padding: .6rem .5rem;
  }

  .db-case-list {
    margin-top: .75rem;
  }

  .db-case-row {
    display: flex;
    justify-content: space-between;
    gap: .75rem;
    padding: .5rem .55rem;
    border-radius: 8px;
    background: #05070e;
    border: 1px solid rgba(255,255,255,.10);
    margin-bottom: .35rem;
  }

  .db-case-row:hover {
    border-color: var(--ism-orange);
  }

  .db-case-main {
    display: grid;
    gap: .12rem;
  }

  .db-case-title {
    font-weight: 600;
  }

  .db-case-meta {
    font-size: .78rem;
    opacity: .8;
  }

  .db-case-actions {
    text-align: right;
    display: grid;
    gap: .35rem;
    align-items: center;
    justify-items: end;
  }

  .db-status {
    padding: .1rem .5rem;
    border-radius: 999px;
    font-size: .75rem;
    border: 1px solid rgba(255,255,255,.3);
  }

  .db-status-open {
    color: #ffd28a;
    border-color: #ffd28a33;
  }

  .db-status-progress {
    color: #8fd1ff;
    border-color: #8fd1ff44;
  }

  .db-status-closed {
    color: #b0ffb0;
    border-color: #b0ffb044;
  }

  .db-columns {
    align-items: flex-start;
  }

  .db-pane-left {
    max-width: 360px;
  }

  .db-pane-right {
    min-width: 0;
  }

  .db-case-head {
    display: grid;
    gap: .5rem;
  }

  .db-case-head-main {
    display: grid;
    gap: .15rem;
  }

  .db-case-head-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--ism-orange);
  }

  .db-case-head-meta {
    font-size: .8rem;
    opacity: .75;
  }

  .db-case-head-actions {
    display: flex;
    gap: .5rem;
    align-items: center;
    justify-content: flex-end;
  }

  .tabbar {
    display: flex;
    gap: .35rem;
    margin-top: .4rem;
    border-top: 1px solid rgba(255,255,255,.12);
    padding-top: .35rem;
  }

  .tabbar button {
    padding: .3rem .7rem;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.25);
    background: #05070e;
    font-size: .85rem;
    color: #e5e5e5;
    cursor: pointer;
  }

  .tabbar button.active {
    background: var(--ism-orange);
    color: #000;
    border-color: var(--ism-orange);
  }

  .tabcontent {
    display: grid;
    gap: .8rem;
    margin-top: .7rem;
  }

  .db-section-title {
    font-weight: 600;
    margin-bottom: .4rem;
  }

  .db-section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: .3rem;
  }

  .db-section-meta {
    font-size: .8rem;
    opacity: .7;
  }

  .db-btn-ghost {
    background: transparent;
    border: 1px solid rgba(255,255,255,.45);
    padding: .3rem .6rem;
    border-radius: 6px;
    font-size: .85rem;
    color: #f0f0f0;
    cursor: pointer;
  }

  .db-btn-ghost:hover {
    border-color: var(--ism-orange);
  }

  .db-form-grid {
    grid-template-columns: 1fr;
    gap: .5rem;
  }

  @media (max-width: 900px) {
    .db-row {
      grid-template-columns: 1.1fr .9fr 2fr;
    }
    .db-row-head {
      grid-template-columns: 1.1fr .9fr 2fr;
    }
  }
  `;

  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
})();
