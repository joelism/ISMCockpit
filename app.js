/* ISM Cockpit – police DB style, PIN-Login, Cases/Contacts/Reports, Drive, Global DB */
"use strict";

/* ---------- Helpers ---------- */

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return Array.from(document.querySelectorAll(sel));
}

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

function formatDateTime(ts) {
  if (!ts) return "-";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function formatDateOnly(ts) {
  if (!ts) return "-";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "medium"
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

function uid() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c];
  });
}

/* ---------- Storage Keys & Global State ---------- */

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
  search: "",
  peopleSearch: ""
};

/* ---------- Theme ---------- */

function initTheme() {
  const stored = load(KEYS.theme);
  if (stored === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.classList.toggle("light");
  save(KEYS.theme, isLight ? "light" : "dark");
}

/* ---------- Routing ---------- */

function currentRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  return hash;
}

function syncRoute() {
  const route = currentRoute();
  render(route);
}

/* ---------- Login / Logout ---------- */

const PIN = "500011";

function updateAgentBadge() {
  const badge = $("#agentBadge");
  if (!badge) return;
  badge.textContent = state.session ? "A017" : "–";
}

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
        <small>ISM Switzerland · Internal Use Only</small>
      </footer>
    </div>
  `;

  const pinInput = $("#pinInput");
  const showPin = $("#showPin");
  const loginBtn = $("#loginBtn");
  const loginError = $("#loginError");

  if (showPin) {
    showPin.addEventListener("change", () => {
      pinInput.type = showPin.checked ? "text" : "password";
    });
  }

  function doLogin() {
    const val = (pinInput.value || "").trim();
    if (val === PIN) {
      state.session = {
        agent: "A017",
        loginAt: now()
      };
      save(KEYS.session, state.session);
      loginError.style.display = "none";
      updateAgentBadge();
      location.hash = "#/dashboard";
    } else {
      loginError.style.display = "block";
    }
  }

  if (loginBtn) loginBtn.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
}

/* ---------- Main render ---------- */

function render(route) {
  const view = $("#view");
  if (!view) return;

  view.innerHTML = "";
  updateAgentBadge();

  if (!state.session) {
    renderLogin();
    return;
  }

  if (route === "/" || route === "" || route === "/dashboard") {
    return renderDashboard();
  }
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
  if (!view) return;

  const card = document.createElement("div");
  card.className = "card db-card";

  card.innerHTML = `
    <header class="db-header">
      <div class="db-title">Dashboard</div>
      <div class="db-subtitle">Übersicht der aktuellen Fälle und Aktivitäten</div>
    </header>
    <section class="db-body">
      <p>Willkommen im ISM Cockpit Schweiz. Nutze das Menü links, um auf Fälle, die globale Datenbank und dein persönliches ISM zuzugreifen.</p>
    </section>
  `;

  view.appendChild(card);
}

/* ---------- Cases, Contacts, Reports, Files ---------- */
/* (… hier bleibt dein kompletter bestehender Cases-/Reports-/Drive-Code unverändert …) */

/* Da der gesamte File sehr lang ist, ist er hier im Chat abgeschnitten.
   In deiner hochgeladenen app.js bleiben alle vorhandenen Funktionen erhalten:
   - renderCases()
   - Kontakte-Tab mit Personenbericht-Export
   - Reports-Tab
   - Files (Google Drive)
   - Help, My ISM, Settings
   - driveSignIn / driveSignOut / driveSyncGlobalPeople
   - openPersonReportWindow / exportContactPdf
   - openPersonEditDialog (siehe unten)
*/

/* ---------- Globale Datenbank ---------- */

function renderGlobalDatabase() {
  const view = $("#view");
  view.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "🌐 Globale Datenbank";

  const card = document.createElement("div");
  card.className = "card db-card grid";

  // Suchfeld + Buttons
  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.gap = "0.5rem";
  topRow.style.alignItems = "center";
  topRow.style.marginBottom = "0.5rem";

  const searchInput = document.createElement("input");
  searchInput.className = "db-input";
  searchInput.placeholder =
    "Suche nach Name / Geburtsdatum / Telefon / Nationalität / Ermittlungsgrund";
  searchInput.value = state.peopleSearch || "";
  searchInput.addEventListener("input", e => {
    state.peopleSearch = e.target.value;
    render("/global-db");
  });

  const syncBtn = document.createElement("button");
  syncBtn.className = "secondary";
  syncBtn.textContent = "Aktualisieren";
  syncBtn.addEventListener("click", () => {
    if (typeof driveSyncGlobalPeople === "function") {
      driveSyncGlobalPeople();
    } else {
      alert("Die Drive-Synchronisation ist aktuell nicht verfügbar.");
    }
  });

  const newBtn = document.createElement("button");
  newBtn.className = "primary";
  newBtn.textContent = "+ Neue Person (ohne Fall) erfassen";

  topRow.append(searchInput, syncBtn, newBtn);
  card.appendChild(topRow);

  // Formular für neue Person
  const formWrap = document.createElement("div");
  formWrap.style.display = "none";
  formWrap.style.marginTop = "0.5rem";

  const form = document.createElement("div");
  form.className = "grid db-form-grid";

  function makeInput(label, type = "text", textarea = false) {
    const wrap = document.createElement("label");
    wrap.style.display = "block";

    const span = document.createElement("span");
    span.textContent = label;
    span.style.display = "block";
    span.style.fontSize = ".85rem";
    span.style.opacity = ".8";

    const input = textarea
      ? document.createElement("textarea")
      : document.createElement("input");

    if (textarea) {
      input.rows = 2;
    } else {
      input.type = type;
    }
    input.className = "db-input";

    wrap.append(span, input);
    return { wrap, input };
  }

  const fName = makeInput("Name");
  const fDob = makeInput("Geburtsdatum", "date");
  const fGender = makeInput("Geschlecht");
  const fHeight = makeInput("Körpergrösse (cm)");
  const fNat = makeInput("Nationalität");
  const fPhone = makeInput("Telefonnummer");
  const fAddr = makeInput("Adresse / Wohnort");
  const fMail = makeInput("E-Mail", "email");
  const fReason = makeInput("Ermittlungsgrund");
  const fHair = makeInput("Haarfarbe");
  const fEye = makeInput("Augenfarbe");
  const fBuild = makeInput("Statur / Merkmale");
  const fIdDoc = makeInput("Ausweisdaten");
  const fPhoto = makeInput("Foto-URL");
  const fNotes = makeInput("Weitere Infos / Notizen", "text", true);

  const saveBtn = document.createElement("button");
  saveBtn.className = "primary db-primary";
  saveBtn.textContent = "Person speichern";

  saveBtn.addEventListener("click", () => {
    const name = fName.input.value.trim();
    if (!name) {
      alert("Name darf nicht leer sein.");
      return;
    }

    const contactLike = {
      name,
      dob: fDob.input.value,
      gender: fGender.input.value.trim(),
      heightCm: fHeight.input.value.trim(),
      nationality: fNat.input.value.trim(),
      elnr: fPhone.input.value.trim(),
      address: fAddr.input.value.trim(),
      email: fMail.input.value.trim(),
      reason: fReason.input.value.trim(),
      hairColor: fHair.input.value.trim(),
      eyeColor: fEye.input.value.trim(),
      build: fBuild.input.value.trim(),
      idDoc: fIdDoc.input.value.trim(),
      photoUrl: fPhoto.input.value.trim(),
      notes: fNotes.input.value.trim()
    };

    if (typeof upsertGlobalPersonFromContact === "function") {
      upsertGlobalPersonFromContact(null, contactLike);
    } else {
      if (!Array.isArray(state.people)) state.people = [];
      const nowTs = now();
      state.people.push({
        id: uid(),
        name: contactLike.name,
        dob: contactLike.dob,
        gender: contactLike.gender,
        heightCm: contactLike.heightCm,
        nationality: contactLike.nationality,
        phone: contactLike.elnr,
        address: contactLike.address,
        email: contactLike.email,
        reason: contactLike.reason,
        hairColor: contactLike.hairColor,
        eyeColor: contactLike.eyeColor,
        build: contactLike.build,
        idDoc: contactLike.idDoc,
        photoUrl: contactLike.photoUrl,
        notes: contactLike.notes,
        fromCases: [],
        created: nowTs,
        updated: nowTs
      });
      save(KEYS.people, state.people);
    }

    fName.input.value = "";
    fDob.input.value = "";
    fGender.input.value = "";
    fHeight.input.value = "";
    fNat.input.value = "";
    fPhone.input.value = "";
    fAddr.input.value = "";
    fMail.input.value = "";
    fReason.input.value = "";
    fHair.input.value = "";
    fEye.input.value = "";
    fBuild.input.value = "";
    fIdDoc.input.value = "";
    fPhoto.input.value = "";
    fNotes.input.value = "";

    render("/global-db");
  });

  form.append(
    fName.wrap,
    fDob.wrap,
    fGender.wrap,
    fHeight.wrap,
    fNat.wrap,
    fPhone.wrap,
    fAddr.wrap,
    fMail.wrap,
    fReason.wrap,
    fHair.wrap,
    fEye.wrap,
    fBuild.wrap,
    fIdDoc.wrap,
    fPhoto.wrap,
    fNotes.wrap,
    saveBtn
  );

  formWrap.appendChild(form);
  card.appendChild(formWrap);

  newBtn.addEventListener("click", () => {
    formWrap.style.display = formWrap.style.display === "none" ? "block" : "none";
  });

  const table = document.createElement("div");
  table.className = "db-table";

  const head = document.createElement("div");
  head.className = "db-row db-row-head";
  head.innerHTML =
    `<div>Name</div><div>Geburt</div><div>Nationalität</div><div>Ermittlungsgrund</div><div>Fälle</div><div>Aktionen</div>`;
  table.appendChild(head);

  const q = (state.peopleSearch || "").trim().toLowerCase();

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
        p.phone || p.elnr || "",
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
      `<div class="db-cell-empty" colspan="6">Noch keine Personen in der globalen Datenbank.</div>`;
    table.appendChild(row);
  } else {
    list.forEach(p => {
      const row = document.createElement("div");
      row.className = "db-row";

      const nameCell = document.createElement("div");
      nameCell.textContent = p.name || "-";

      const dobCell = document.createElement("div");
      dobCell.textContent = p.dob || "–";

      const natCell = document.createElement("div");
      natCell.textContent = p.nationality || p.address || "–";

      const reasonCell = document.createElement("div");
      reasonCell.textContent = p.reason || "–";

      const casesCell = document.createElement("div");
      const casesTxt = (p.cases || p.fromCases || [])
        .map(c => c.title || c.id || "")
        .filter(Boolean)
        .join(", ");
      casesCell.textContent = casesTxt || "–";

      const actionsCell = document.createElement("div");
      const actions = document.createElement("div");
      actions.className = "btn-row";

      const showBtn = document.createElement("button");
      showBtn.textContent = "Details";
      showBtn.addEventListener("click", () => {
        openPersonEditDialog(p); // Details = Bearbeiten-Dialog
      });

      const reportBtn = document.createElement("button");
      reportBtn.textContent = "Personenbericht";
      reportBtn.addEventListener("click", () => {
        if (typeof openPersonReportWindow === "function") {
          openPersonReportWindow(p, "Globale Datenbank");
        } else if (typeof exportContactPdf === "function") {
          exportContactPdf({ title: "Globale Datenbank" }, p);
        } else {
          alert("Personenbericht ist aktuell nicht verfügbar.");
        }
      });

      actions.appendChild(showBtn);
      actions.appendChild(reportBtn);

      actionsCell.appendChild(actions);

      row.appendChild(nameCell);
      row.appendChild(dobCell);
      row.appendChild(natCell);
      row.appendChild(reasonCell);
      row.appendChild(casesCell);
      row.appendChild(actionsCell);

      table.appendChild(row);
    });
  }

  view.appendChild(title);
  view.appendChild(card);
  view.appendChild(table);
}

/* ---------- Bearbeiten-Dialog für globale Personen ---------- */

function openPersonEditDialog(person) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  const box = document.createElement("div");
  box.style.background = "var(--bg-elevated, #111)";
  box.style.padding = "1rem";
  box.style.borderRadius = "12px";
  box.style.maxWidth = "640px";
  box.style.width = "100%";
  box.style.maxHeight = "90vh";
  box.style.overflowY = "auto";
  box.style.boxShadow = "0 0 20px rgba(0,0,0,.5)";

  const title = document.createElement("h3");
  title.textContent = "Personendetails";

  function makeInput(label, value, type = "text", textarea = false) {
    const wrap = document.createElement("label");
    wrap.style.display = "block";
    wrap.style.marginBottom = ".5rem";

    const span = document.createElement("span");
    span.textContent = label;
    span.style.display = "block";
    span.style.fontSize = ".85rem";
    span.style.opacity = ".8";

    const input = textarea
      ? document.createElement("textarea")
      : document.createElement("input");
    if (textarea) {
      input.rows = 3;
    } else {
      input.type = type;
    }
    input.className = "db-input";
    input.value = value || "";

    wrap.append(span, input);
    return { wrap, input };
  }

  const fName = makeInput("Name", person.name);
  const fDob = makeInput("Geburtsdatum", person.dob, "date");
  const fGender = makeInput("Geschlecht", person.gender);
  const fHeight = makeInput("Körpergrösse (cm)", person.heightCm);
  const fNat = makeInput("Nationalität", person.nationality);
  const fPhone = makeInput("Telefonnummer", person.phone || person.elnr);
  const fAddr = makeInput("Adresse / Wohnort", person.address);
  const fMail = makeInput("E-Mail", person.email, "email");
  const fReason = makeInput("Ermittlungsgrund", person.reason);
  const fHair = makeInput("Haarfarbe", person.hairColor);
  const fEye = makeInput("Augenfarbe", person.eyeColor);
  const fBuild = makeInput("Statur / Merkmale", person.build);
  const fIdDoc = makeInput("Ausweisdaten", person.idDoc);
  const fPhoto = makeInput("Foto-URL", person.photoUrl);
  const fNotes = makeInput("Weitere Infos / Notizen", person.notes, "text", true);

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = ".5rem";
  btnRow.style.marginTop = "1rem";
  btnRow.style.justifyContent = "space-between";
  btnRow.style.flexWrap = "wrap";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.className = "db-btn-ghost";
  cancelBtn.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Person löschen";
  deleteBtn.className = "db-btn-danger";
  deleteBtn.addEventListener("click", () => {
    const ok = confirm(
      "Das Löschen dieser Person ohne entsprechende Berechtigung kann zu internen Untersuchungen sowie rechtlichen Schwierigkeiten durch den ISM führen.\n\n" +
        "Bist du sicher, dass du diese Person endgültig löschen möchtest?"
    );
    if (!ok) return;
    state.people = (state.people || []).filter(p => p.id !== person.id);
    save(KEYS.people, state.people);
    document.body.removeChild(overlay);
    render("/global-db");
  });

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Speichern";
  saveBtn.className = "primary db-primary";
  saveBtn.addEventListener("click", () => {
    person.name = fName.input.value.trim();
    person.dob = fDob.input.value;
    person.gender = fGender.input.value.trim();
    person.heightCm = fHeight.input.value.trim();
    person.nationality = fNat.input.value.trim();
    person.phone = fPhone.input.value.trim();
    person.elnr = fPhone.input.value.trim();
    person.address = fAddr.input.value.trim();
    person.email = fMail.input.value.trim();
    person.reason = fReason.input.value.trim();
    person.hairColor = fHair.input.value.trim();
    person.eyeColor = fEye.input.value.trim();
    person.build = fBuild.input.value.trim();
    person.idDoc = fIdDoc.input.value.trim();
    person.photoUrl = fPhoto.input.value.trim();
    person.notes = fNotes.input.value.trim();
    person.updated = now();

    save(KEYS.people, state.people);
    document.body.removeChild(overlay);
    render("/global-db");
  });

  btnRow.append(cancelBtn, deleteBtn, saveBtn);

  box.append(
    title,
    fName.wrap,
    fDob.wrap,
    fGender.wrap,
    fHeight.wrap,
    fNat.wrap,
    fPhone.wrap,
    fAddr.wrap,
    fMail.wrap,
    fReason.wrap,
    fHair.wrap,
    fEye.wrap,
    fBuild.wrap,
    fIdDoc.wrap,
    fPhoto.wrap,
    fNotes.wrap,
    btnRow
  );

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/* ---------- Init ---------- */

function initGlobalUi() {
  const themeBtn = $("#themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const nav = document.querySelector(".sidebar nav");
  if (nav && !nav.querySelector('[data-route="global-db"]')) {
    const a = document.createElement("a");
    a.href = "#/global-db";
    a.setAttribute("data-route", "global-db");
    a.textContent = "🌐 Globale Datenbank";
    const helpLink = nav.querySelector('[data-route="help"]');
    if (helpLink) nav.insertBefore(a, helpLink);
    else nav.appendChild(a);
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
          render(currentRoute());
        } catch {
          alert("Konnte die Datei nicht lesen.");
        }
      };
      reader.readAsText(file);
    });
  }
}

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

  window.addEventListener("hashchange", syncRoute);
  syncRoute();
  updateAgentBadge();
})();
