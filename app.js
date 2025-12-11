/* ISM Cockpit – police DB style, PIN-Login, Cases/Contacts/Reports
   Build: policeDB6a – Kontakte mit Polizei-Feldern, Personenbericht-PDF
*/

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const ISM = { org: "ISM Switzerland" };

const KEYS = {
  session: "ismc-session",
  cases: "ismc-cases-v4",
  people: "ismc-people-v1",
  seq: "ismc-case-seq",
  theme: "ismc-theme",
  route: "ismc-route"
};

const state = {
  session: load(KEYS.session),
  cases: load(KEYS.cases) || [],
  people: load(KEYS.people) || [],
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



/* ---------- Personenbericht-Export (PDF via Druckdialog) ---------- */

function buildPersonReportHtml(person, sourceLabel = "Globale Datenbank") {
  const lines = [];

  const add = (label, val) => {
    lines.push(
      `<tr><th>${label}</th><td>${escapeHtml(val || "-")}</td></tr>`
    );
  };

  add("Name", person.name);
  add("Geburtsdatum", person.dob);
  add("Geschlecht", person.gender);
  add("Körpergrösse", person.heightCm ? person.heightCm + " cm" : "");
  add("Nationalität", person.nationality);
  add("Adresse / Wohnort", person.address);
  add("Telefon", person.elnr || person.phone);
  add("E-Mail", person.email);
  add("Instagram", person.instagram);
  add("Snapchat", person.snapchat);
  add("TikTok", person.tiktok);
  add("Haarfarbe", person.hairColor);
  add("Augenfarbe", person.eyeColor);
  add("Statur / Merkmale", person.build);
  add("Ausweisdaten", person.idDoc);

  if (person.notes) {
    add("Bemerkungen", person.notes);
  }

  if (person.cases && person.cases.length) {
    add(
      "Verknüpfte Fälle",
      person.cases.map(c => c.title || c.id || "").join(", ")
    );
  }

  const photoBlock =
    person.photoUrl
      ? `<div class="photo-block"><img src="${escapeHtml(
          person.photoUrl
        )}" alt="Personenfoto" /></div>`
      : "";

  return `
    <div class="report">
      <header class="report-header">
        <div class="report-org">${escapeHtml(ISM.org || "ISM")}</div>
        <div class="report-title">Personenbericht</div>
        <div class="report-meta">
          <div>Quelle: ${escapeHtml(sourceLabel)}</div>
          <div>Erstellt: ${escapeHtml(
            new Date().toLocaleString("de-CH")
          )}</div>
        </div>
      </header>
      <section class="report-body">
        ${photoBlock}
        <table class="report-table">
          ${lines.join("")}
        </table>
      </section>
    </div>
  `;
}

function openPersonReportWindow(person, sourceLabel) {
  // Nutzt das gleiche Personenbericht-Layout wie Kontakte im Fall
  const caseTitles = person.cases && person.cases.length
    ? person.cases.map(c => c.title || c.id || "").join(", ")
    : "";

  const label = sourceLabel || "Globale Datenbank";
  const titleCombined = caseTitles
    ? `${caseTitles} · ${label}`
    : label;

  const fakeCase = {
    title: titleCombined
  };

  // person besitzt die gleichen Felder wie ein Kontaktobjekt
  exportContactPdf(fakeCase, person);
}
function safeDate(r) {
  if (r.date) return new Date(r.date);
  if (r.updated) return new Date(r.updated);
  return new Date(0);
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

  // Dynamisch: Tab für globale Personen-Datenbank einfügen, falls noch nicht vorhanden
  const nav = document.querySelector(".sidebar nav");
  if (nav && !nav.querySelector('[data-route="global-db"]')) {
    const a = document.createElement("a");
    a.href = "#/global-db";
    a.setAttribute("data-route", "global-db");
    a.textContent = "🌐 Globale Datenbank";
    const helpLink = nav.querySelector('[data-route="help"]');
    if (helpLink) {
      nav.insertBefore(a, helpLink);
    } else {
      nav.appendChild(a);
    }
  }

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

/* ---------- Fälle helpers ---------- */

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
  if (route === "/global-db") return renderGlobalDatabase();
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
    (acc, c) =>
      acc +
      (c.reports || []).filter(r => r.type === "Kurzbericht").length,
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
    <p class="db-kpi-label">Kurzberichte in allen Fällen</p>
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

  const feedCard = document.createElement("div");
  feedCard.className = "card db-card";
  feedCard.innerHTML = `<h3>Kurzberichte</h3>`;
  const table = document.createElement("div");
  table.className = "db-table";
  const header = document.createElement("div");
  header.className = "db-row db-row-head";
  header.innerHTML = `<div>Fall</div><div>Datum</div><div>Text</div>`;
  table.appendChild(header);

  const allShorts = [];
  state.cases.forEach(c => {
    (c.reports || []).forEach(r => {
      if (r.type === "Kurzbericht") allShorts.push({ caseTitle: c.title, r });
    });
  });

  allShorts.sort((a, b) => safeDate(a.r) - safeDate(b.r));

  if (allShorts.length === 0) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="3">Noch keine Kurzberichte vorhanden.</div>`;
    table.appendChild(row);
  } else {
    allShorts.forEach(entry => {
      const row = document.createElement("div");
      row.className = "db-row";
      row.innerHTML = `
        <div>${escapeHtml(entry.caseTitle)}</div>
        <div>${escapeHtml(entry.r.date || "")}</div>
        <div class="db-cell-text">${escapeHtml(entry.r.body || "")}</div>
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

  const left = document.createElement("div");
  left.className = "pane db-pane-left";

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
      shorts: [],
      driveFolderId: null
    };
    state.cases.push(c);
    save(KEYS.cases, state.cases);

    if (driveState && driveState.clientInited && driveState.signedIn) {
      driveEnsureCaseFolder(c);
    }

    newCaseInput.value = nextCaseNumber();
    render("/cases");
  });

  regenBtn.addEventListener("click", () => {
    newCaseInput.value = nextCaseNumber();
  });

  creatorCard.append(newCaseInput, addBtn, regenBtn);
  left.appendChild(creatorCard);

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

    const shortCount = (c.reports || []).filter(
      r => r.type === "Kurzbericht"
    ).length;

    item.innerHTML = `
      <div class="db-case-main">
        <div class="db-case-title">${escapeHtml(c.title)}</div>
        <div class="db-case-meta">Angelegt: ${fmt(c.created)}</div>
        <div class="db-case-meta">
          Kontakte: ${(c.contacts || []).length} · Kurzberichte: ${shortCount}
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
          <option value="open"${selected.status === "open" ? " selected" : ""}>Offen</option>
          <option value="progress"${selected.status === "progress" ? " selected" : ""}>In Bearbeitung</option>
          <option value="closed"${selected.status === "closed" ? " selected" : ""}>Abgeschlossen</option>
        </select>
        <span class="db-status db-status-${selected.status ||
          "open"}" id="caseStatusBadge">${statusLabel}</span>
      </div>
      <div class="tabbar">
        <button data-tab="files" class="active">📂 Akte</button>
        <button data-tab="reports">📄 Berichte</button>
        <button data-tab="drive">📎 Dateien</button>
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
      if (name === "drive") renderTabDrive(selected, body);
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

/* ----- Tab: Akte (Unterordner) ----- */

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
        <div class="db-section-meta">Platzhalter für lokale Dateien.</div>
      </div>
      <p style="font-size:.85rem;opacity:.8;">
        Später können hier echte Dateien (Bilder, TXT usw.) verknüpft werden.
      </p>
    `;
    body.appendChild(card);
  });
}

/* ----- Tab: Berichte + Gesamtbericht-PDF (chronologisch) ----- */

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

  const docs = (selected.reports || [])
    .slice()
    .sort((a, b) => safeDate(a) - safeDate(b));

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
          `Typ: ${d.type}
Datum: ${d.date}
Titel: ${d.title}

${d.body}`
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
        <div>${escapeHtml(d.date || "")}</div>
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

function exportCasePdf(selected) {
  try {
    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup blockiert. Bitte Popups für diese Seite im Browser erlauben."
      );
      return;
    }

    const title = escapeHtml(selected.title || "");
    const allReports = (selected.reports || [])
      .slice()
      .sort((a, b) => safeDate(a) - safeDate(b));

    const shortReports = allReports.filter(r => r.type === "Kurzbericht");

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

    html += `<h2>Berichte (chronologisch)</h2>`;
    if (!allReports.length) {
      html += `<p>Keine Berichte erfasst.</p>`;
    } else {
      allReports.forEach(r => {
        html += '<div class="block">';
        html +=
          "<h3>" +
          escapeHtml(r.type || "") +
          " – " +
          escapeHtml(r.title || "(Ohne Titel)") +
          "</h3>";
        if (r.date) {
          html +=
            '<p class="meta">Berichtsdatum: ' + escapeHtml(r.date) + "</p>";
        }
        const text = escapeHtml(r.body || "").replace(/\n/g, "<br>");
        html += "<p>" + text + "</p>";
        html += "</div>";
      });
    }

    html += `<h2>Kurzberichte (aus Berichten)</h2>`;
    if (!shortReports.length) {
      html += `<p>Keine Kurzberichte erfasst.</p>`;
    } else {
      html += "<ul>";
      shortReports.forEach(r => {
        html +=
          "<li><strong>" +
          escapeHtml(r.date || "") +
          ":</strong> " +
          escapeHtml(r.body || "") +
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
      }
    }, 400);
  } catch (err) {
    console.error(err);
    alert("Gesamtbericht konnte nicht geöffnet werden.");
  }
}

/* ----- Personenbericht-PDF pro Kontakt (Polizei-Stil) ----- */

function exportContactPdf(caseObj, contact) {
  try {
    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup blockiert. Bitte Popups für diese Seite im Browser erlauben."
      );
      return;
    }

    const caseTitle   = escapeHtml(caseObj.title || "");
    const name        = escapeHtml(contact.name || "");
    const role        = escapeHtml(contact.role || "");
    const dob         = escapeHtml(contact.dob || "–");
    const gender      = escapeHtml(contact.gender || "–");
    const heightCm    = escapeHtml(contact.heightCm || "–");
    const nationality = escapeHtml(contact.nationality || "–");
    const phone       = escapeHtml(contact.elnr || "–");
    const address     = escapeHtml(contact.address || "–");
    const email       = escapeHtml(contact.email || "–");
    const instagram   = escapeHtml(contact.instagram || "–");
    const snapchat    = escapeHtml(contact.snapchat || "–");
    const tiktok      = escapeHtml(contact.tiktok || "–");
    const hairColor   = escapeHtml(contact.hairColor || "–");
    const eyeColor    = escapeHtml(contact.eyeColor || "–");
    const build       = escapeHtml(contact.build || "–");
    const idDoc       = escapeHtml(contact.idDoc || "–");
    const notes       = escapeHtml(contact.notes || "").replace(/\n/g, "<br>");
    const photoUrl    = contact.photoUrl ? escapeHtml(contact.photoUrl) : "";

    let html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Personenbericht ${name}</title>
        <style>
          :root {
            --ism-orange: #ff7a00;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 24px;
            background: #ffffff;
            color: #000000;
            line-height: 1.4;
          }
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .header-left {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: .08em;
          }
          .header-left strong {
            font-size: 16px;
            color: #000;
          }
          .header-tag {
            font-size: 10px;
            padding: 3px 7px;
            border-radius: 999px;
            border: 1px solid #000;
            text-transform: uppercase;
            letter-spacing: .08em;
          }
          .header-strip {
            height: 4px;
            background: linear-gradient(90deg,var(--ism-orange),#000);
            margin-top: 6px;
          }
          h1 {
            font-size: 20px;
            margin: 0 0 2px 0;
          }
          .meta {
            font-size: 11px;
            color: #444;
            margin-bottom: 16px;
          }
          .idcard {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 16px;
            border: 1px solid #000;
            padding: 12px;
            margin-bottom: 18px;
          }
          .idcard-left {
            font-size: 12px;
          }
          .id-row {
            display: grid;
            grid-template-columns: 120px 1fr;
            gap: 4px;
            margin-bottom: 4px;
          }
          .id-label {
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: .08em;
            color: #555;
          }
          .id-value {
            font-size: 12px;
          }
          .photo-box {
            width: 120px;
            height: 150px;
            border: 1px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #777;
            overflow: hidden;
          }
          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .section-title {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: .12em;
            margin: 14px 0 6px 0;
          }
          .notes-box {
            border: 1px solid #000;
            min-height: 80px;
            font-size: 12px;
            padding: 8px;
          }
          .footer-note {
            margin-top: 18px;
            font-size: 10px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div><strong>ISM Switzerland</strong></div>
            <div>INTERNE SACHBEARBEITUNG</div>
            <div>Personenbericht</div>
          </div>
          <div class="header-right">
            <div class="header-tag">Case File</div>
          </div>
        </div>
        <div class="header-strip"></div>

        <h1>Personenbericht ${name}</h1>
        <div class="meta">
          Aktenzeichen: ${caseTitle} · Generiert: ${escapeHtml(
            new Date().toLocaleString()
          )}
        </div>

        <div class="idcard">
          <div class="idcard-left">
            <div class="id-row">
              <div class="id-label">Name</div>
              <div class="id-value">${name}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Geburtsdatum</div>
              <div class="id-value">${dob}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Geschlecht</div>
              <div class="id-value">${gender}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Körpergrösse</div>
              <div class="id-value">${heightCm} cm</div>
            </div>
            <div class="id-row">
              <div class="id-label">Nationalität</div>
              <div class="id-value">${nationality}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Rolle im Fall</div>
              <div class="id-value">${role || "–"}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Adresse</div>
              <div class="id-value">${address}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Telefon</div>
              <div class="id-value">${phone}</div>
            </div>
            <div class="id-row">
              <div class="id-label">E-Mail</div>
              <div class="id-value">${email}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Instagram</div>
              <div class="id-value">${instagram}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Snapchat</div>
              <div class="id-value">${snapchat}</div>
            </div>
            <div class="id-row">
              <div class="id-label">TikTok</div>
              <div class="id-value">${tiktok}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Haarfarbe</div>
              <div class="id-value">${hairColor}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Augenfarbe</div>
              <div class="id-value">${eyeColor}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Statur / Merkmale</div>
              <div class="id-value">${build}</div>
            </div>
            <div class="id-row">
              <div class="id-label">Ausweisdaten</div>
              <div class="id-value">${idDoc}</div>
            </div>
          </div>
          <div class="idcard-right">
            <div class="photo-box">
    `;

    if (photoUrl) {
      html += `<img src="${photoUrl}" alt="Foto ${name}">`;
    } else {
      html += `kein Foto hinterlegt`;
    }

    html += `
            </div>
          </div>
        </div>

        <div class="section-title">Zusatzinformationen</div>
        <div class="notes-box">
          ${notes || "<span style='color:#888;'>Keine zusätzlichen Angaben erfasst.</span>"}
        </div>

        <div class="footer-note">
          Dieses Dokument wurde automatisch aus dem ISM Cockpit erzeugt.
          Für die Ablage als PDF bitte im Browser den Druckdialog öffnen
          und „Als PDF speichern“ wählen.
        </div>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();

    setTimeout(() => {
      win.focus();
      try {
        win.print();
      } catch (_) {}
    }, 400);
  } catch (err) {
    console.error(err);
    alert("Personenbericht konnte nicht geöffnet werden.");
  }
}

/* ----- Tab: Dateien (Google Drive – echte Anbindung) ----- */

const GD = {
  API_KEY: "AIzaSyCtd628byDsaRHu7mE_vj_gDedvTuUybFE",
  CLIENT_ID: "990383497142-prtdauaqssaveqjls6em5c5ngtkrvtsn.apps.googleusercontent.com",
  DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  SCOPES: "https://www.googleapis.com/auth/drive"
};

const driveState = {
  clientInited: false,
  signedIn: false,
  loading: false,
  files: [],
  currentFolderId: "root",
  folderStack: [{ id: "root", name: "Mein Drive" }],
  tokenClient: null,
  accessToken: null
};

function ensureGapiLoaded() {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      return resolve(window.gapi);
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.gapi);
    script.onerror = () => reject(new Error("Google API konnte nicht geladen werden."));
    document.head.appendChild(script);
  });
}

function ensureGisLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return resolve(window.google.accounts.oauth2);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        reject(new Error("Google Identity Services konnten nicht geladen werden."));
      }
    };
    script.onerror = () => reject(new Error("Google Identity Services Script konnte nicht geladen werden."));
  });
}

async function initDriveClient() {
  if (driveState.clientInited) return;
  const gapi = await ensureGapiLoaded();
  await new Promise((resolve, reject) => {
    gapi.load("client", {
      callback: resolve,
      onerror: () => reject(new Error("Google Client konnte nicht initialisiert werden."))
    });
  });
  await gapi.client.init({
    apiKey: GD.API_KEY,
    discoveryDocs: GD.DISCOVERY_DOCS
  });
  driveState.clientInited = true;
}

async function driveSignIn() {
  driveState.loading = true;
  try {
    await initDriveClient();
    const oauth2 = await ensureGisLoaded();

    if (!driveState.tokenClient) {
      driveState.tokenClient = oauth2.initTokenClient({
        client_id: GD.CLIENT_ID,
        scope: GD.SCOPES,
        callback: async (resp) => {
          if (resp.error) {
            throw resp;
          }
          driveState.accessToken = resp.access_token;
          driveState.signedIn = true;
          await driveLoadFiles();
        }
      });
    }

    driveState.tokenClient.requestAccessToken({
      prompt: driveState.signedIn ? "" : "consent"
    });
  } catch (e) {
    console.error(e);
    alert("Anmeldung bei Google Drive ist fehlgeschlagen:\n" + (e.error || e.details || e.message || e.toString()));
  } finally {
    driveState.loading = false;
  }
}

async function driveSignOut() {
  try {
    const oauth2 = window.google && window.google.accounts && window.google.accounts.oauth2;
    if (oauth2 && driveState.accessToken) {
      oauth2.revoke(driveState.accessToken, () => {});
    }
  } catch (e) {
    console.error(e);
  } finally {
    driveState.signedIn = false;
    driveState.files = [];
    driveState.accessToken = null;
  }
}

async function driveLoadFiles() {
  if (!window.gapi || !driveState.clientInited) return;
  driveState.loading = true;
  try {
    const folderId = driveState.currentFolderId || "root";
    const res = await window.gapi.client.drive.files.list({
      pageSize: 100,
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: "folder,name,modifiedTime desc",
      fields: "files(id, name, mimeType, modifiedTime, webViewLink)"
    });
    driveState.files = res.result.files || [];
  } catch (e) {
    console.error(e);
    alert("Dateien konnten nicht aus Google Drive geladen werden.");
  } finally {
    driveState.loading = false;
  }
}

function driveIsFolder(file) {
  return file && file.mimeType === "application/vnd.google-apps.folder";
}

async function driveCreateFolder(name) {
  if (!name || !window.gapi || !driveState.clientInited) return;
  const folderId = driveState.currentFolderId || "root";
  await window.gapi.client.drive.files.create({
    resource: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: folderId === "root" ? [] : [folderId]
    },
    fields: "id"
  });
  await driveLoadFiles();
}

async function driveEnsureCaseFolder(caseObj) {
  try {
    if (!caseObj || caseObj.driveFolderId) return;
    if (!window.gapi || !driveState.clientInited || !driveState.signedIn) return;

    const res = await window.gapi.client.drive.files.create({
      resource: {
        name: caseObj.title || "Fall",
        mimeType: "application/vnd.google-apps.folder",
        parents: []
      },
      fields: "id"
    });

    const id = res.result && res.result.id;
    if (id) {
      caseObj.driveFolderId = id;
      save(KEYS.cases, state.cases);
    }
  } catch (e) {
    console.error("Fehler beim Erstellen des Drive-Ordners für Fall", caseObj && caseObj.title, e);
  }
}

function drivePathLabel() {
  return driveState.folderStack.map(f => f.name).join(" / ");
}

function renderTabDrive(selected, body) {
  const card = document.createElement("div");
  card.className = "card db-card";

  const head = document.createElement("div");
  head.className = "db-section-head";
  head.innerHTML = `
    <div class="db-section-title">Dateien (Google Drive)</div>
    <div class="db-section-meta">
      Anmeldung mit eigenem Google-Konto, Übersicht pro Ordner. Ordner anklickbar, Dateien öffnen in neuem Tab.
    </div>
  `;

  const status = document.createElement("p");
  status.style.fontSize = ".85rem";
  status.style.opacity = ".85";

  if (selected && selected.driveFolderId) {
    driveState.currentFolderId = selected.driveFolderId;
    driveState.folderStack = [
      { id: "root", name: "Mein Drive" },
      { id: selected.driveFolderId, name: selected.title || "Fallordner" }
    ];
  } else {
    driveState.currentFolderId = "root";
    driveState.folderStack = [{ id: "root", name: "Mein Drive" }];
  }

  function updateStatus() {
    const pathLabel = drivePathLabel();
    if (driveState.loading) {
      status.textContent = "Status: Lade Daten …  |  Pfad: " + pathLabel;
    } else if (driveState.signedIn) {
      status.textContent = "Status: Angemeldet  |  Pfad: " + pathLabel;
    } else {
      status.textContent = "Status: Noch nicht angemeldet.";
    }
  }
  updateStatus();

  
  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";

  const upBtn = document.createElement("button");
  upBtn.className = "db-btn-ghost";
  upBtn.textContent = "⬆ Übergeordneter Ordner";

  const newFolderBtn = document.createElement("button");
  newFolderBtn.className = "db-btn-ghost";
  newFolderBtn.textContent = "Neuer Ordner";

  upBtn.addEventListener("click", async () => {
    if (driveState.folderStack.length > 1) {
      driveState.folderStack.pop();
      driveState.currentFolderId = driveState.folderStack[driveState.folderStack.length - 1].id;
      await driveLoadFiles();
      updateStatus();
      renderFileTable();
    }
  });

  newFolderBtn.addEventListener("click", async () => {
    const name = prompt("Name des neuen Ordners:");
    if (!name) return;
    try {
      await driveCreateFolder(name.trim());
      await driveLoadFiles();
      updateStatus();
      renderFileTable();
    } catch (e) {
      console.error(e);
      alert("Ordner konnte nicht erstellt werden.");
    }
  });

  btnRow.append(upBtn, newFolderBtn);


  const tableWrap = document.createElement("div");
  tableWrap.style.marginTop = ".6rem";

  function renderFileTable() {
    tableWrap.innerHTML = "";
    if (!driveState.signedIn) {
      const p = document.createElement("p");
      p.style.fontSize = ".85rem";
      p.style.opacity = ".8";
      p.textContent = "Bitte zuerst mit Google Drive verbinden.";
      tableWrap.appendChild(p);
      return;
    }

    if (driveState.loading) {
      const p = document.createElement("p");
      p.style.fontSize = ".85rem";
      p.style.opacity = ".8";
      p.textContent = "Lade Dateien …";
      tableWrap.appendChild(p);
      return;
    }

    const files = driveState.files;
    if (!files.length) {
      const p = document.createElement("p");
      p.style.fontSize = ".85rem";
      p.style.opacity = ".8";
      p.textContent = "Keine Dateien in diesem Ordner.";
      tableWrap.appendChild(p);
      return;
    }

    const table = document.createElement("div");
    table.className = "db-table";
    const headRow = document.createElement("div");
    headRow.className = "db-row db-row-head";
    headRow.innerHTML = "<div>Typ</div><div>Name</div><div>Geändert</div><div>Aktion</div><div></div>";
    table.appendChild(headRow);

    files
      .slice()
      .sort((a, b) => {
        const aFolder = driveIsFolder(a) ? 0 : 1;
        const bFolder = driveIsFolder(b) ? 0 : 1;
        if (aFolder !== bFolder) return aFolder - bFolder;
        return (a.name || "").localeCompare(b.name || "");
      })
      .forEach(f => {
        const row = document.createElement("div");
        row.className = "db-row";

        const typeCell = document.createElement("div");
        typeCell.textContent = driveIsFolder(f) ? "Ordner" : (f.mimeType || "").split(".").pop();

        const nameCell = document.createElement("div");
        nameCell.textContent = f.name || "";
        if (driveIsFolder(f)) {
          nameCell.style.cursor = "pointer";
          nameCell.style.fontWeight = "600";
          nameCell.addEventListener("click", async () => {
            driveState.folderStack.push({ id: f.id, name: f.name || "Ordner" });
            driveState.currentFolderId = f.id;
            await driveLoadFiles();
            updateStatus();
            renderFileTable();
          });
        }

        const modCell = document.createElement("div");
        modCell.textContent = f.modifiedTime || "";

        const actionCell = document.createElement("div");
        if (f.webViewLink && !driveIsFolder(f)) {
          const a = document.createElement("a");
          a.href = f.webViewLink;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = "Öffnen";
          actionCell.appendChild(a);
        } else if (driveIsFolder(f)) {
          const btn = document.createElement("button");
          btn.textContent = "Ordner öffnen";
          btn.addEventListener("click", async () => {
            driveState.folderStack.push({ id: f.id, name: f.name || "Ordner" });
            driveState.currentFolderId = f.id;
            await driveLoadFiles();
            updateStatus();
            renderFileTable();
          });
          actionCell.appendChild(btn);
        } else {
          actionCell.textContent = "—";
        }

        const dummy = document.createElement("div");
        dummy.textContent = "";

        row.appendChild(typeCell);
        row.appendChild(nameCell);
        row.appendChild(modCell);
        row.appendChild(actionCell);
        row.appendChild(dummy);

        table.appendChild(row);
      });

    tableWrap.appendChild(table);
  }

  card.append(head, status, btnRow, tableWrap);
  body.appendChild(card);

  (async () => {
    try {
      await initDriveClient();
      updateStatus();
      if (driveState.signedIn) {
        if (selected && !selected.driveFolderId) {
          await driveEnsureCaseFolder(selected);
          if (selected.driveFolderId) {
            driveState.currentFolderId = selected.driveFolderId;
            driveState.folderStack = [
              { id: "root", name: "Mein Drive" },
              { id: selected.driveFolderId, name: selected.title || "Fallordner" }
            ];
          }
        }
        await driveLoadFiles();
      }
      renderFileTable();
    } catch (e) {
      console.warn("Drive-Client konnte nicht initialisiert werden:", e);
      renderFileTable();
    }
  })();
}

/* ----- Tab: Kontakte (mit Polizei-Feldern) ----- */

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

  const genderSel = document.createElement("select");
  genderSel.className = "db-input db-select";
  [
    ["unbekannt", "Unbekannt"],
    ["männlich", "Männlich"],
    ["weiblich", "Weiblich"],
    ["divers", "Divers"]
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    genderSel.appendChild(o);
  });

  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "db-input";
  heightInput.placeholder = "z.B. 182";

  const nationalityInput = document.createElement("input");
  nationalityInput.className = "db-input";
  nationalityInput.placeholder = "z.B. Schweiz";

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

  const instaInput = document.createElement("input");
  instaInput.className = "db-input";
  instaInput.placeholder = "Instagram @";

  const snapInput = document.createElement("input");
  snapInput.className = "db-input";
  snapInput.placeholder = "Snapchat Benutzername";

  const tiktokInput = document.createElement("input");
  tiktokInput.className = "db-input";
  tiktokInput.placeholder = "TikTok Benutzername";

  const hairInput = document.createElement("input");
  hairInput.className = "db-input";
  hairInput.placeholder = "Haarfarbe (z.B. braun, kurz)";

  const eyeInput = document.createElement("input");
  eyeInput.className = "db-input";
  eyeInput.placeholder = "Augenfarbe (z.B. braun)";

  const buildInput = document.createElement("input");
  buildInput.className = "db-input";
  buildInput.placeholder = "Statur / Merkmale (z.B. schlank, tätowiert)";

  const idDocInput = document.createElement("input");
  idDocInput.className = "db-input";
  idDocInput.placeholder = "Ausweisdaten (Art, Nr.)";

  const photoInput = document.createElement("input");
  photoInput.className = "db-input";
  photoInput.placeholder = "Foto-URL (optional)";

  const notesInput = document.createElement("textarea");
  notesInput.className = "db-input";
  notesInput.rows = 2;
  notesInput.placeholder = "Weitere Infos (Besonderheiten, Hinweise …)";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "+ Kontakt speichern";

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const contact = {
      id: uid(),
      role:        roleSel.value,
      name,
      dob:         dobInput.value,
      gender:      genderSel.value,
      heightCm:    heightInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      elnr:        phoneInput.value.trim(),
      address:     addrInput.value.trim(),
      email:       mailInput.value.trim(),
      instagram:   instaInput.value.trim(),
      snapchat:    snapInput.value.trim(),
      tiktok:      tiktokInput.value.trim(),
      hairColor:   hairInput.value.trim(),
      eyeColor:    eyeInput.value.trim(),
      build:       buildInput.value.trim(),
      idDoc:       idDocInput.value.trim(),
      photoUrl:    photoInput.value.trim(),
      notes:       notesInput.value.trim()
    };
    selected.contacts.push(contact);
    save(KEYS.cases, state.cases);
    upsertGlobalPersonFromContact(selected, contact);

    nameInput.value = "";
    dobInput.value = "";
    genderSel.value = "unbekannt";
    heightInput.value = "";
    nationalityInput.value = "";
    phoneInput.value = "";
    addrInput.value = "";
    mailInput.value = "";
    instaInput.value = "";
    snapInput.value = "";
    tiktokInput.value = "";
    hairInput.value = "";
    eyeInput.value = "";
    buildInput.value = "";
    idDocInput.value = "";
    photoInput.value = "";
    notesInput.value = "";

    render("/cases");
  });

  form.append(
    labelWrap("Typ", roleSel),
    labelWrap("Name", nameInput),
    labelWrap("Geburtsdatum", dobInput),
    labelWrap("Geschlecht", genderSel),
    labelWrap("Körpergrösse (cm)", heightInput),
    labelWrap("Nationalität", nationalityInput),
    labelWrap("Telefonnummer", phoneInput),
    labelWrap("Adresse", addrInput),
    labelWrap("E-Mail", mailInput),
    labelWrap("Instagram", instaInput),
    labelWrap("Snapchat", snapInput),
    labelWrap("TikTok", tiktokInput),
    labelWrap("Haarfarbe", hairInput),
    labelWrap("Augenfarbe", eyeInput),
    labelWrap("Statur / besondere Merkmale", buildInput),
    labelWrap("Ausweisdaten", idDocInput),
    labelWrap("Foto-URL", photoInput),
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
            `Geschlecht: ${c.gender || "-"}`,
            `Körpergrösse: ${c.heightCm || "-"} cm`,
            `Nationalität: ${c.nationality || "-"}`,
            `Telefonnummer: ${c.elnr || "-"}`,
            `Adresse: ${c.address || "-"}`,
            `E-Mail: ${c.email || "-"}`,
            `Instagram: ${c.instagram || "-"}`,
            `Snapchat: ${c.snapchat || "-"}`,
            `TikTok: ${c.tiktok || "-"}`,
            `Haarfarbe: ${c.hairColor || "-"}`,
            `Augenfarbe: ${c.eyeColor || "-"}`,
            `Statur / Merkmale: ${c.build || "-"}`,
            `Ausweisdaten: ${c.idDoc || "-"}`,
            `Foto-URL: ${c.photoUrl || "-"}`,
            "",
            c.notes || ""
          ].join("\n")
        );
      });

      const reportBtn = document.createElement("button");
      reportBtn.textContent = "Personenbericht";
      reportBtn.addEventListener("click", () => {
        exportContactPdf(selected, c);
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", () => {
        if (!confirm("Kontakt löschen?")) return;
        selected.contacts = selected.contacts.filter(x => x.id !== c.id);
        save(KEYS.cases, state.cases);
        render("/cases");
      });

      actions.append(showBtn, reportBtn, delBtn);

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

  // Google Drive Sektion
  const driveTitle = document.createElement("h3");
  driveTitle.textContent = "Google Drive";

  const driveStatus = document.createElement("p");
  driveStatus.style.fontSize = ".85rem";
  driveStatus.style.opacity = ".85";

  function updateDriveStatus() {
    if (!window.gapi || !driveState.clientInited) {
      driveStatus.textContent = "Status: Noch nicht verbunden.";
    } else if (driveState.signedIn) {
      driveStatus.textContent = "Status: Verbunden mit Google Drive.";
    } else {
      driveStatus.textContent = "Status: Nicht angemeldet.";
    }
  }
  updateDriveStatus();

  const driveBtnRow = document.createElement("div");
  driveBtnRow.className = "btn-row";

  const driveConnectBtn = document.createElement("button");
  driveConnectBtn.className = "primary db-primary";
  driveConnectBtn.textContent = "Mit Google Drive verbinden";
  driveConnectBtn.addEventListener("click", async () => {
    await driveSignIn();
    updateDriveStatus();
  });

  const driveDisconnectBtn = document.createElement("button");
  driveDisconnectBtn.className = "db-btn-ghost";
  driveDisconnectBtn.textContent = "Abmelden";
  driveDisconnectBtn.addEventListener("click", async () => {
    await driveSignOut();
    updateDriveStatus();
  });

  const driveBackupBtn = document.createElement("button");
  driveBackupBtn.className = "db-btn-ghost";
  driveBackupBtn.textContent = "Datenbank in Drive sichern";
  driveBackupBtn.addEventListener("click", async () => {
    await driveSyncGlobalPeople();
  });

  driveBtnRow.append(driveConnectBtn, driveDisconnectBtn, driveBackupBtn);

  card.append(
    h2,
    themeBtn,
    clearBtn,
    logoutBtn,
    driveTitle,
    driveStatus,
    driveBtnRow
  );
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


/* ---------- Globale Personen-Datenbank (weltweit) ---------- */

function upsertGlobalPersonFromContact(caseObj, contact) {
  if (!contact || !contact.name) return;
  const nameKey = (contact.name || "").trim().toLowerCase();
  const dobKey  = (contact.dob || "").trim();
  const nowTs   = now();

  state.people = state.people || [];

  let person = state.people.find(p => {
    const pName = (p.name || "").trim().toLowerCase();
    const pDob  = (p.dob || "").trim();
    return pName === nameKey && pDob === dobKey;
  });

  const caseRef = caseObj && caseObj.id ? { id: caseObj.id, title: caseObj.title || "" } : null;

  if (!person) {
    person = {
      id: uid(),
      name:        contact.name || "",
      dob:         contact.dob || "",
      gender:      contact.gender || "",
      heightCm:    contact.heightCm || "",
      nationality: contact.nationality || "",
      elnr:        contact.elnr || "",
      address:     contact.address || "",
      email:       contact.email || "",
      reason:      contact.reason || "",
      instagram:   contact.instagram || "",
      snapchat:    contact.snapchat || "",
      tiktok:      contact.tiktok || "",
      hairColor:   contact.hairColor || "",
      eyeColor:    contact.eyeColor || "",
      build:       contact.build || "",
      idDoc:       contact.idDoc || "",
      photoUrl:    contact.photoUrl || "",
      notes:       contact.notes || "",
      cases:       caseRef ? [caseRef] : [],
      created:     nowTs,
      updated:     nowTs
    };
    state.people.push(person);
  } else {
    [
      "gender",
      "heightCm",
      "nationality",
      "elnr",
      "address",
      "email",
      "reason",
      "instagram",
      "snapchat",
      "tiktok",
      "hairColor",
      "eyeColor",
      "build",
      "idDoc",
      "photoUrl",
      "notes"
    ].forEach(field => {
      if (!person[field] && contact[field]) {
        person[field] = contact[field];
      }
    });
    person.updated = nowTs;
    if (caseRef) {
      person.cases = person.cases || [];
      if (!person.cases.some(c => c.id === caseRef.id)) {
        person.cases.push(caseRef);
      }
    }
  }

  save(KEYS.people, state.people);
}

function syncGlobalPeopleFromCases() {
  state.people = state.people || [];
  state.cases.forEach(c => {
    (c.contacts || []).forEach(contact => {
      upsertGlobalPersonFromContact(c, contact);
    });
  });
}

/* ---------- Weltweite ISM-Personendatenbank View ---------- */

function renderGlobalDatabase() {
  const view = $("#view");
  view.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "🌐 Globale Datenbankdatenbank";

  const card = document.createElement("div");
  card.className = "card db-card grid";

  const searchInput = document.createElement("input");
  searchInput.className = "db-input";
  searchInput.placeholder = "Suche nach Name / Geburtsdatum / Telefon / Nationalität";
  searchInput.value = state.search || "";
  searchInput.addEventListener("input", e => {
    state.search = e.target.value;
    render("/global-db");
  });

  const newBtn = document.createElement("button");
  newBtn.className = "db-btn-ghost";
  newBtn.textContent = "+ Neue Person (ohne Fall) erfassen";

  const formCard = document.createElement("div");
  formCard.className = "card db-card grid";
  formCard.style.marginTop = ".6rem";
  formCard.style.display = "none";

  newBtn.addEventListener("click", () => {
    formCard.style.display = formCard.style.display === "none" ? "block" : "none";
  });

  /* --- Formular für neue globale Person --- */

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  const nameInput = document.createElement("input");
  nameInput.className = "db-input";
  nameInput.placeholder = "Name";

  const dobInput = document.createElement("input");
  dobInput.type = "date";
  dobInput.className = "db-input";

  const genderSel = document.createElement("select");
  genderSel.className = "db-input db-select";
  [
    ["unbekannt", "Unbekannt"],
    ["männlich", "Männlich"],
    ["weiblich", "Weiblich"],
    ["divers", "Divers"]
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    genderSel.appendChild(o);
  });

  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "db-input";
  heightInput.placeholder = "Körpergrösse in cm (z.B. 182)";

  const nationalityInput = document.createElement("input");
  nationalityInput.className = "db-input";
  nationalityInput.placeholder = "Nationalität (z.B. Schweiz)";

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

  const reasonInput = document.createElement("input");
  reasonInput.className = "db-input";
  reasonInput.placeholder = "Ermittlungsgrund";

  const instaInput = document.createElement("input");
  instaInput.className = "db-input";
  instaInput.placeholder = "Instagram @";

  const snapInput = document.createElement("input");
  snapInput.className = "db-input";
  snapInput.placeholder = "Snapchat Benutzername";

  const tiktokInput = document.createElement("input");
  tiktokInput.className = "db-input";
  tiktokInput.placeholder = "TikTok Benutzername";

  const hairInput = document.createElement("input");
  hairInput.className = "db-input";
  hairInput.placeholder = "Haarfarbe";

  const eyeInput = document.createElement("input");
  eyeInput.className = "db-input";
  eyeInput.placeholder = "Augenfarbe";

  const buildInput = document.createElement("input");
  buildInput.className = "db-input";
  buildInput.placeholder = "Statur / besondere Merkmale";

  const idDocInput = document.createElement("input");
  idDocInput.className = "db-input";
  idDocInput.placeholder = "Ausweisdaten (Art, Nr.)";

  const photoInput = document.createElement("input");
  photoInput.className = "db-input";
  photoInput.placeholder = "Foto-URL (optional)";

  const notesInput = document.createElement("textarea");
  notesInput.className = "db-input";
  notesInput.rows = 2;
  notesInput.placeholder = "Weitere Infos (Hinweise, Bemerkungen …)";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "Person speichern";

  saveBtn.addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    if (!name) return;

    const person = {
      id: uid(),
      name,
      dob:         dobInput.value,
      gender:      genderSel.value,
      heightCm:    heightInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      elnr:        phoneInput.value.trim(),
      address:     addrInput.value.trim(),
      email:       mailInput.value.trim(),
      reason:      reasonInput.value.trim(),
      instagram:   instaInput.value.trim(),
      snapchat:    snapInput.value.trim(),
      tiktok:      tiktokInput.value.trim(),
      hairColor:   hairInput.value.trim(),
      eyeColor:    eyeInput.value.trim(),
      build:       buildInput.value.trim(),
      idDoc:       idDocInput.value.trim(),
      photoUrl:    photoInput.value.trim(),
      notes:       notesInput.value.trim(),
      cases:       [],
      created:     now(),
      updated:     now()
    };

    state.people.push(person);
    save(KEYS.people, state.people);

    nameInput.value = "";
    dobInput.value = "";
    genderSel.value = "unbekannt";
    heightInput.value = "";
    nationalityInput.value = "";
    phoneInput.value = "";
    addrInput.value = "";
    mailInput.value = "";
    reasonInput.value = "";
    instaInput.value = "";
    snapInput.value = "";
    tiktokInput.value = "";
    hairInput.value = "";
    eyeInput.value = "";
    buildInput.value = "";
    idDocInput.value = "";
    photoInput.value = "";
    notesInput.value = "";

    render("/global-db");
  });

  form.append(
    labelWrap("Name", nameInput),
    labelWrap("Geburtsdatum", dobInput),
    labelWrap("Geschlecht", genderSel),
    labelWrap("Körpergrösse (cm)", heightInput),
    labelWrap("Nationalität", nationalityInput),
    labelWrap("Telefonnummer", phoneInput),
    labelWrap("Adresse", addrInput),
    labelWrap("E-Mail", mailInput),
    labelWrap("Ermittlungsgrund", reasonInput),
    labelWrap("Instagram", instaInput),
    labelWrap("Snapchat", snapInput),
    labelWrap("TikTok", tiktokInput),
    labelWrap("Haarfarbe", hairInput),
    labelWrap("Augenfarbe", eyeInput),
    labelWrap("Statur / besondere Merkmale", buildInput),
    labelWrap("Ausweisdaten", idDocInput),
    labelWrap("Foto-URL", photoInput),
    labelWrap("Weitere Infos", notesInput),
    saveBtn
  );

  formCard.innerHTML = `<div class="db-section-title">Neue Person erfassen</div>`;
  formCard.appendChild(form);

  card.append(
    labelWrap("Schnellsuche", searchInput),
    newBtn
  );

  view.append(title, card, formCard);

  /* --- Tabelle mit allen gespeicherten Personen --- */

  const table = document.createElement("div");
  table.className = "db-table";
  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML =
    `<div>Name</div><div>Geburt</div><div>Nationalität</div><div>Telefon</div><div>Ermittlungsgrund</div><div>Fälle</div>`;
  table.appendChild(head);

  const q = (state.search || "").trim().toLowerCase();

  const list = (state.people || [])
    .slice()
    .sort((a, b) => {
      const n = (a.name || "").localeCompare(b.name || "");
      if (n !== 0) return n;
      return (a.dob || "").localeCompare(b.dob || "");
    })
    .filter(p => {
      if (!q) return true;
      const haystack = [
        p.name || "",
        p.dob || "",
        p.nationality || "",
        p.elnr || "",
        p.address || "",
        p.email || "",
        p.reason || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  if (!list.length) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML =
      `<div class="db-cell-empty" colspan="5">Noch keine Personen in der globalen Datenbank.</div>`;
    table.appendChild(row);
  } else {
    list.forEach(p => {
      const row = document.createElement("div");
      row.className = "db-row";

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const showBtn = document.createElement("button");
      showBtn.textContent = "Details";
      showBtn.addEventListener("click", () => {
        const lines = [
          `Name: ${p.name || "-"}`,
          `Geburt: ${p.dob || "-"}`,
          `Geschlecht: ${p.gender || "-"}`,
          `Körpergrösse: ${p.heightCm || "-"} cm`,
          `Nationalität: ${p.nationality || "-"}`,
          `Telefon: ${p.elnr || "-"}`,
          `Adresse: ${p.address || "-"}`,
          `E-Mail: ${p.email || "-"}`,
          `Ermittlungsgrund: ${p.reason || "-"}`,
          `Instagram: ${p.instagram || "-"}`,
          `Snapchat: ${p.snapchat || "-"}`,
          `TikTok: ${p.tiktok || "-"}`,
          `Haarfarbe: ${p.hairColor || "-"}`,
          `Augenfarbe: ${p.eyeColor || "-"}`,
          `Statur / Merkmale: ${p.build || "-"}`,
          `Ausweisdaten: ${p.idDoc || "-"}`,
          "",
          `Verknüpfte Fälle: ${
            p.cases && p.cases.length
              ? p.cases.map(c => c.title || c.id || "").join(", ")
              : "keine"
          }`,
          "",
          p.notes || ""
        ];
        alert(lines.join("\n"));
      });

      const reportBtn = document.createElement("button");
      reportBtn.textContent = "Personenbericht";
      reportBtn.addEventListener("click", () => {
        openPersonReportWindow(p, "Globale Datenbank");
      });

      actions.appendChild(showBtn);
      actions.appendChild(reportBtn);

      row.innerHTML = `
        <div>${escapeHtml(p.name || "")}</div>
        <div>${escapeHtml(p.dob || "–")}</div>
        <div>${escapeHtml(p.nationality || "–")}</div>
        <div>${escapeHtml(p.elnr || "–")}</div>
        <div>${escapeHtml(p.reason || "–")}</div>
        <div>${(p.cases && p.cases.length) ? escapeHtml(String(p.cases.length)) : "0"}</div>
      `;
      const actCell = document.createElement("div");
      actCell.appendChild(actions);
      row.appendChild(actCell);

      table.appendChild(row);
    });
  }

  view.appendChild(table);
}

/* ---------- Globale Personen-Synchronisation mit Google Drive ---------- */

async function driveSyncGlobalPeople() {
  try {
    // Sicherstellen, dass Drive-Client da ist
    if (!window.gapi || !driveState.clientInited) {
      alert("Bitte zuerst in den Einstellungen mit Google Drive verbinden.");
      return;
    }
    // Falls (noch) nicht signiert, versuchen anzumelden
    if (!driveState.signedIn) {
      await driveSignIn();
      if (!driveState.signedIn) {
        return;
      }
    }

    const gapi = window.gapi;
    const token =
      driveState.accessToken ||
      (gapi.client.getToken && gapi.client.getToken().access_token);
    if (!token) {
      alert("Kein gültiger Google-Drive-Zugriffstoken vorhanden.");
      return;
    }

    const fileName = "ism-global-people.json";

    // 1) Letzte Export-Datei finden
    let fileId = null;
    let remotePeople = [];

    try {
      const listRes = await gapi.client.drive.files.list({
        q: "name = '" + fileName + "' and trashed = false",
        spaces: "drive",
        fields: "files(id,name,modifiedTime)",
        pageSize: 1,
        orderBy: "modifiedTime desc"
      });
      const files = listRes.result && listRes.result.files;
      if (files && files.length) {
        fileId = files[0].id;

        // Inhalt laden
        const resp = await fetch(
          "https://www.googleapis.com/drive/v3/files/" +
            fileId +
            "?alt=media",
          {
            headers: {
              Authorization: "Bearer " + token
            }
          }
        );
        if (resp.ok) {
          const text = await resp.text();
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              remotePeople = parsed;
            } else if (parsed && Array.isArray(parsed.people)) {
              remotePeople = parsed.people;
            }
          } catch (e) {
            console.error("Konnte Remote-JSON nicht parsen:", e);
          }
        }
      }
    } catch (e) {
      console.error("Fehler beim Lesen aus Google Drive:", e);
    }

    // 2) Personen mergen – Bestehende bleiben, nur neue dazunehmen
    const keyOf = p =>
      ((p.name || "").trim().toLowerCase() +
        "|" +
        (p.dob || "").trim());

    const map = new Map();
    (remotePeople || []).forEach(p => {
      map.set(keyOf(p), p);
    });

    (state.people || []).forEach(p => {
      const k = keyOf(p);
      if (!map.has(k)) {
        map.set(k, p);
      }
    });

    const merged = Array.from(map.values());

    // Lokal auch aktualisieren
    state.people = merged;
    save(KEYS.people, state.people);

    // 3) Zurück nach Drive schreiben (Export)
    const payload = {
      exportedAt: new Date().toISOString(),
      count: merged.length,
      people: merged
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });

    const metadata = {
      name: fileName,
      mimeType: "application/json"
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], {
        type: "application/json"
      })
    );
    form.append("file", blob);

    const baseUrl = fileId
      ? "https://www.googleapis.com/upload/drive/v3/files/" +
        fileId +
        "?uploadType=multipart"
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

    const method = fileId ? "PATCH" : "POST";

    const uploadResp = await fetch(baseUrl, {
      method,
      headers: {
        Authorization: "Bearer " + token
      },
      body: form
    });

    if (!uploadResp.ok) {
      console.error("Upload-Response:", await uploadResp.text());
      alert("Export/Synchronisation mit Google Drive ist fehlgeschlagen.");
      return;
    }

    alert("Globale Datenbank wurde mit Google Drive aktualisiert.");
  } catch (e) {
    console.error(e);
    alert("Fehler bei der Google-Drive-Synchronisation: " + (e.message || e.toString()));
  }
}

/* ---------- Weltweite ISM-Personendatenbank View (override) ---------- */

function renderGlobalDatabase() {
  const view = $("#view");
  if (!view) return;
  view.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "🌐 Globale Datenbank";
  view.appendChild(title);

  // Top-Bar mit Suche + Buttons
  const topBar = document.createElement("div");
  topBar.className = "card db-card";
  topBar.style.display = "flex";
  topBar.style.gap = ".5rem";
  topBar.style.alignItems = "center";
  topBar.style.flexWrap = "wrap";

  const searchInput = document.createElement("input");
  searchInput.className = "db-input";
  searchInput.placeholder =
    "Suche nach Name / Geburtsdatum / Telefon / Nationalität / Ermittlungsgrund";
  searchInput.value = state.search || "";
  searchInput.addEventListener("input", e => {
    state.search = e.target.value;
    render("/global-db");
  });

  const syncBtn = document.createElement("button");
  syncBtn.className = "db-btn-ghost";
  syncBtn.textContent = "Aktualisieren";
  syncBtn.addEventListener("click", () => {
    driveSyncGlobalPeople();
  });

  const newBtn = document.createElement("button");
  newBtn.className = "db-btn-ghost";
  newBtn.textContent = "+ Neue Person (ohne Fall) erfassen";

  topBar.appendChild(searchInput);
  topBar.appendChild(syncBtn);
  topBar.appendChild(newBtn);

  view.appendChild(topBar);

  // Formular-Card
  const formCard = document.createElement("div");
  formCard.className = "card db-card grid";
  formCard.style.marginTop = ".6rem";
  formCard.style.display = "none";

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  const nameInput = document.createElement("input");
  nameInput.className = "db-input";
  nameInput.placeholder = "Name";

  const dobInput = document.createElement("input");
  dobInput.type = "date";
  dobInput.className = "db-input";

  const genderSel = document.createElement("select");
  genderSel.className = "db-input db-select";
  [
    ["unbekannt", "Unbekannt"],
    ["männlich", "Männlich"],
    ["weiblich", "Weiblich"],
    ["divers", "Divers"]
  ].forEach(([v, l]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = l;
    genderSel.appendChild(o);
  });

  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "db-input";
  heightInput.placeholder = "Körpergrösse in cm (z.B. 182)";

  const nationalityInput = document.createElement("input");
  nationalityInput.className = "db-input";
  nationalityInput.placeholder = "Nationalität (z.B. Schweiz)";

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

  const reasonInput = document.createElement("input");
  reasonInput.className = "db-input";
  reasonInput.placeholder = "Ermittlungsgrund";

  const instaInput = document.createElement("input");
  instaInput.className = "db-input";
  instaInput.placeholder = "Instagram @";

  const snapInput = document.createElement("input");
  snapInput.className = "db-input";
  snapInput.placeholder = "Snapchat Benutzername";

  const tiktokInput = document.createElement("input");
  tiktokInput.className = "db-input";
  tiktokInput.placeholder = "TikTok Benutzername";

  const hairInput = document.createElement("input");
  hairInput.className = "db-input";
  hairInput.placeholder = "Haarfarbe (z.B. braun, kurz)";

  const eyeInput = document.createElement("input");
  eyeInput.className = "db-input";
  eyeInput.placeholder = "Augenfarbe (z.B. braun)";

  const buildInput = document.createElement("input");
  buildInput.className = "db-input";
  buildInput.placeholder = "Statur / besondere Merkmale";

  const idDocInput = document.createElement("input");
  idDocInput.className = "db-input";
  idDocInput.placeholder = "Ausweisdaten (Art, Nr.)";

  const photoInput = document.createElement("input");
  photoInput.className = "db-input";
  photoInput.placeholder = "Foto-URL (optional)";

  const notesInput = document.createElement("textarea");
  notesInput.className = "db-input";
  notesInput.rows = 2;
  notesInput.placeholder = "Weitere Infos (Hinweise, Bemerkungen …)";

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "Person speichern";

  saveBtn.addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    if (!name) return;

    const person = {
      id: uid(),
      name,
      dob:         dobInput.value,
      gender:      genderSel.value,
      heightCm:    heightInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      elnr:        phoneInput.value.trim(),
      address:     addrInput.value.trim(),
      email:       mailInput.value.trim(),
      reason:      reasonInput.value.trim(),
      instagram:   instaInput.value.trim(),
      snapchat:    snapInput.value.trim(),
      tiktok:      tiktokInput.value.trim(),
      hairColor:   hairInput.value.trim(),
      eyeColor:    eyeInput.value.trim(),
      build:       buildInput.value.trim(),
      idDoc:       idDocInput.value.trim(),
      photoUrl:    photoInput.value.trim(),
      notes:       notesInput.value.trim(),
      cases:       [],
      created:     now(),
      updated:     now()
    };

    state.people = state.people || [];
    state.people.push(person);
    save(KEYS.people, state.people);

    nameInput.value = "";
    dobInput.value = "";
    genderSel.value = "unbekannt";
    heightInput.value = "";
    nationalityInput.value = "";
    phoneInput.value = "";
    addrInput.value = "";
    mailInput.value = "";
    reasonInput.value = "";
    instaInput.value = "";
    snapInput.value = "";
    tiktokInput.value = "";
    hairInput.value = "";
    eyeInput.value = "";
    buildInput.value = "";
    idDocInput.value = "";
    photoInput.value = "";
    notesInput.value = "";

    render("/global-db");
  });

  form.append(
    labelWrap("Name", nameInput),
    labelWrap("Geburtsdatum", dobInput),
    labelWrap("Geschlecht", genderSel),
    labelWrap("Körpergrösse (cm)", heightInput),
    labelWrap("Nationalität", nationalityInput),
    labelWrap("Telefonnummer", phoneInput),
    labelWrap("Adresse", addrInput),
    labelWrap("E-Mail", mailInput),
    labelWrap("Ermittlungsgrund", reasonInput),
    labelWrap("Instagram", instaInput),
    labelWrap("Snapchat", snapInput),
    labelWrap("TikTok", tiktokInput),
    labelWrap("Haarfarbe", hairInput),
    labelWrap("Augenfarbe", eyeInput),
    labelWrap("Statur / besondere Merkmale", buildInput),
    labelWrap("Ausweisdaten", idDocInput),
    labelWrap("Foto-URL", photoInput),
    labelWrap("Weitere Infos", notesInput),
    saveBtn
  );

  formCard.innerHTML = `<div class="db-section-title">Neue Person erfassen</div>`;
  formCard.appendChild(form);
  view.appendChild(formCard);

  newBtn.addEventListener("click", () => {
    formCard.style.display = formCard.style.display === "none" ? "block" : "none";
  });

  // Tabelle unten
  const table = document.createElement("div");
  table.className = "db-table";

  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML =
    `<div>Name</div><div>Geburt</div><div>Nationalität</div><div>Telefon</div><div>Ermittlungsgrund</div><div>Fälle</div>`;
  table.appendChild(head);

  const q = (state.search || "").trim().toLowerCase();

  const list = (state.people || [])
    .slice()
    .sort((a, b) => {
      const n = (a.name || "").localeCompare(b.name || "");
      if (n !== 0) return n;
      return (a.dob || "").localeCompare(b.dob || "");
    })
    .filter(p => {
      if (!q) return true;
      const haystack = [
        p.name || "",
        p.dob || "",
        p.nationality || "",
        p.elnr || "",
        p.address || "",
        p.email || "",
        p.reason || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  if (!list.length) {
    const row = document.createElement("div");
    row.className = "db-row";
    row.innerHTML = `<div class="db-cell-empty">Noch keine Personen in der globalen Datenbank.</div>`;
    table.appendChild(row);
  } else {
    list.forEach(p => {
      const row = document.createElement("div");
      row.className = "db-row";

      const actions = document.createElement("div");
      actions.className = "btn-row";

      const showBtn = document.createElement("button");
      showBtn.textContent = "Details";
      showBtn.addEventListener("click", () => {
        const lines = [
          `Name: ${p.name || "-"}`,
          `Geburt: ${p.dob || "-"}`,
          `Geschlecht: ${p.gender || "-"}`,
          `Körpergrösse: ${p.heightCm || "-"} cm`,
          `Nationalität: ${p.nationality || "-"}`,
          `Telefon: ${p.elnr || "-"}`,
          `Adresse: ${p.address || "-"}`,
          `E-Mail: ${p.email || "-"}`,
          `Ermittlungsgrund: ${p.reason || "-"}`,
          `Instagram: ${p.instagram || "-"}`,
          `Snapchat: ${p.snapchat || "-"}`,
          `TikTok: ${p.tiktok || "-"}`,
          `Haarfarbe: ${p.hairColor || "-"}`,
          `Augenfarbe: ${p.eyeColor || "-"}`,
          `Statur / Merkmale: ${p.build || "-"}`,
          `Ausweisdaten: ${p.idDoc || "-"}`,
          "",
          `Verknüpfte Fälle: ${
            p.cases && p.cases.length
              ? p.cases.map(c => c.title || c.id || "").join(", ")
              : "keine"
          }`,
          "",
          p.notes || ""
        ];
        alert(lines.join("\\n"));
      });

      const reportBtn = document.createElement("button");
      reportBtn.textContent = "Personenbericht";
      reportBtn.addEventListener("click", () => {
        openPersonReportWindow(p, "Globale Datenbank");
      });

      actions.appendChild(showBtn);
      actions.appendChild(reportBtn);

      row.innerHTML = `
        <div>${escapeHtml(p.name || "")}</div>
        <div>${escapeHtml(p.dob || "–")}</div>
        <div>${escapeHtml(p.nationality || "–")}</div>
        <div>${escapeHtml(p.elnr || "–")}</div>
        <div>${escapeHtml(p.reason || "–")}</div>
        <div>${(p.cases && p.cases.length) ? escapeHtml(String(p.cases.length)) : "0"}</div>
      `;
      const actCell = document.createElement("div");
      actCell.appendChild(actions);
      row.appendChild(actCell);

      table.appendChild(row);
    });
  }

  view.appendChild(table);
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
          cases: state.cases,
          people: state.people || []
        },
        null,
        2
      );
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ism-backup.json";
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
          state.people = parsed.people || [];
          save(KEYS.cases, state.cases);
          save(KEYS.people, state.people);
          syncGlobalPeopleFromCases();
          render("/cases");
        } catch {
          alert("Konnte die Datei nicht lesen.");
        }
      };
      reader.readAsText(file);
    });
  }

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
    state.cases = [
      {
        id: uid(),
        title: "F010A017",
        created: now(),
        status: "open",
        folders: [],
        reports: [],
        contacts: [],
        shorts: [],
        driveFolderId: null
      }
    ];
    save(KEYS.cases, state.cases);
  }

  // Bestehende Kontakte in die globale Personendatenbank übernehmen
  syncGlobalPeopleFromCases();
  save(KEYS.people, state.people);

  window.addEventListener("hashchange", syncRoute);
  syncRoute();
  updateAgentBadge();
})();

/* ---------- Extra CSS (police-like) ---------- */

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
