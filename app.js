/* ═══════════════════════════════════════════════════════════════════
   ISM COCKPIT — Switzerland
   Amtliche Fall-Datenbank · Build: kapo-style-1
   ═══════════════════════════════════════════════════════════════════ */

const $  = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const ISM = { org: "ISM Switzerland" };

/* ── Persistenz-Keys (kompatibel zu vorheriger Version, "cf"-Key unverändert!) ── */
const KEYS = {
  session: "ismc-session",
  cases:   "ismc-cases-v5",
  people:  "ismc-people-v1",   // identisch zur Vorversion -> Cloudflare-Daten bleiben kompatibel
  seq:     "ismc-case-seq",
  theme:   "ismc-theme",
  route:   "ismc-route",
  cf:      "ismc-cf-config"    // { endpoint, apiKey } -- UNVERÄNDERT, Cloudflare-Wire-Format bleibt gleich
};

function load(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
}
function save(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
  if (k === KEYS.cases || k === KEYS.people) cfSchedulePush();
}
function now() { return Date.now(); }
function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function fmt(ts) {
  if (!ts) return "–";
  return new Date(ts).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(ts) {
  if (!ts) return "–";
  return new Date(ts).toLocaleDateString("de-CH", { dateStyle: "medium" });
}
function fmtDateInput(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

/* ── State ─────────────────────────────────────────────────────── */
const state = {
  session: load(KEYS.session),
  cases:   load(KEYS.cases) || [],
  people:  load(KEYS.people) || [],
  myCases: [],
  search:  "",
  ui: { activeCaseTab: "uebersicht" }
};

/* ── Supabase: Auth + "Meine Fälle" ───────────────────────────────
   Nur Login + persönliche Fälle. Cloudflare/Globale Datenbank bleibt
   komplett unabhängig davon, wie zuvor.                              */
const SUPABASE_URL = "https://eptldytuwvvczwgtgzwq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdGxkeXR1d3Z2Y3p3Z3RnendxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDg1OTUsImV4cCI6MjA5NzYyNDU5NX0.ZFlxt-mbx42mBJfhBGoUs05Ocmlb1KWBXpzwWOMdK5A";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sbCurrentUser() {
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user || null;
}
async function sbLogin(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
async function sbLogout() { await sb.auth.signOut(); }

async function sbFetchMyCases() {
  const { data, error } = await sb.from("personal_cases").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function sbCreateCase({ title, status, description, data: extra }) {
  const user = await sbCurrentUser();
  if (!user) throw new Error("Nicht eingeloggt.");
  const { data, error } = await sb.from("personal_cases").insert({
    owner_id: user.id, title, status: status || "offen",
    description: description || "", data: extra || {}
  }).select().single();
  if (error) throw error;
  return data;
}
async function sbUpdateCase(id, patch) {
  const { data, error } = await sb.from("personal_cases").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
async function sbDeleteCase(id) {
  const { error } = await sb.from("personal_cases").delete().eq("id", id);
  if (error) throw error;
}

/* ── Icons (SVG, strichbasiert, keine Emojis) ─────────────────────
   Alle Icons teilen denselben Stroke-Stil (1.6, round) für Konsistenz. */
const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
  folderOpen: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7a2 2 0 0 0-1.9 1.4L3 17V7Z"/><path d="M3 17l2.1-6.6A2 2 0 0 1 7 9h13l-2.4 7.4A2 2 0 0 1 15.7 18H5a2 2 0 0 1-2-2v-1Z"/></svg>`,
  myFolder: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><circle cx="12" cy="12.5" r="2"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.8 1c0 1.5-2.3 1.8-2.3 3.4"/><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/></svg>`,
  badge: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z"/><circle cx="12" cy="10" r="2.3"/><path d="M8.5 16c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4M9 12h6M9 16h6M9 8h2"/></svg>`,
  docShort: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4M9 13h6M9 16h4"/></svg>`,
  docRequest: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M9 13.5l1.6 1.6L14.5 11"/></svg>`,
  docPerson: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><circle cx="11.5" cy="12.3" r="1.6"/><path d="M9 17c.5-1.4 1.4-2 2.5-2s2 .6 2.5 2"/></svg>`,
  docClose: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="m9.5 12.5 2 2 3-3.5"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2.5 19c.8-3 3.4-5 6.5-5s5.7 2 6.5 5"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.5 14.2c2.4.3 4.4 2 5 4.8"/></svg>`,
  print: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 14h12v7H6z"/></svg>`,
  stack: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M18 7l-.8 12.5A1.5 1.5 0 0 1 15.7 21H8.3a1.5 1.5 0 0 1-1.5-1.5L6 7"/><path d="M10 11v6M14 11v6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 5.5 18.5 11.5 8 22H2v-6L12.5 5.5Z"/><path d="m15 3 6 6"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V7m0 0 4 4m-4-4-4 4"/><path d="M4 19h16"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a9 9 0 0 1 15.3-5.7L21 8"/><path d="M21 4v4h-4"/><path d="M21 13a9 9 0 0 1-15.3 5.7L3 16"/><path d="M3 20v-4h4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m4 6.5 8 6 8-6"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4.5l1.5 3h6l1.5-3H21"/><path d="M5.5 5h13l2.5 7v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-7l2.5-7Z"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V7l8-4 8 4v14"/><path d="M4 21h16M9 21v-5h6v5M9 11h.01M14.99 11h.01M9 8h.01M14.99 8h.01"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h3l1.5 4.5-2 1.5a13 13 0 0 0 6 6l1.5-2L21 14.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 5 6.6 1.5 1.5 0 0 1 6.5 3Z"/></svg>`,
  at: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5"/></svg>`,
};
function icon(name) { return ICONS[name] || ""; }

/* ── Falltyp- und Berichtstyp-Definitionen ────────────────────────
   Aktenzeichen-Schema: ISM.{Jahr}.{Falltyp-Code}.{Laufnummer}        */
const CASE_TYPES = [
  { code: "ERM", label: "Ermittlung",   icon: "search" },
  { code: "UEW", label: "Überwachung",  icon: "filter" },
  { code: "AUS", label: "Auskunft",     icon: "inbox" },
  { code: "SOF", label: "Sonderfall",   icon: "warn" }
];
const CASE_STATUS = [
  { id: "erfasst",      label: "Erfasst",        badge: "badge-open" },
  { id: "bearbeitung",  label: "In Bearbeitung",  badge: "badge-progress" },
  { id: "abgeschlossen",label: "Abgeschlossen",   badge: "badge-closed" },
  { id: "sistiert",     label: "Sistiert",        badge: "badge-urgent" }
];
const CASE_PRIORITY = [
  { id: "tief",    label: "Tief",     cls: "prio-low" },
  { id: "normal",  label: "Normal",   cls: "prio-normal" },
  { id: "hoch",    label: "Hoch",     cls: "prio-high" },
  { id: "dringend",label: "Dringend", cls: "prio-urgent" }
];
const REPORT_TYPES = [
  { id: "kurzbericht",   label: "Kurzbericht",       icon: "docShort" },
  { id: "antragsbericht",label: "Antragsbericht",    icon: "docRequest" },
  { id: "personenbericht",label: "Personenbericht",  icon: "docPerson" },
  { id: "abschlussbericht",label: "Abschlussbericht",icon: "docClose" }
];

function caseTypeDef(code) { return CASE_TYPES.find(t => t.code === code) || CASE_TYPES[0]; }
function caseStatusDef(id) { return CASE_STATUS.find(s => s.id === id) || CASE_STATUS[0]; }
function casePriorityDef(id) { return CASE_PRIORITY.find(p => p.id === id) || CASE_PRIORITY[1]; }
function reportTypeDef(id) { return REPORT_TYPES.find(r => r.id === id) || REPORT_TYPES[0]; }

function stampClassForStatus(id) {
  if (id === "abgeschlossen") return "stamp-closed";
  if (id === "bearbeitung") return "stamp-progress";
  if (id === "sistiert") return "stamp-progress";
  return "stamp-open";
}

/* ── Aktenzeichen-Vergabe ──────────────────────────────────────── */
function nextCaseRef(typeCode) {
  const year = new Date().getFullYear();
  const seqKey = KEYS.seq + "-" + year;
  const raw = parseInt(localStorage.getItem(seqKey) || "0", 10) + 1;
  localStorage.setItem(seqKey, String(raw));
  const num = String(raw).padStart(4, "0");
  return `ISM.${year}.${typeCode}.${num}`;
}

/** Kurzes Kürzel aus der Agent-Kennung (Email) für Anzeige-Zwecke */
function agentCode() {
  const agent = (state.session && state.session.agent) || "AGENT";
  const local = agent.split("@")[0] || agent;
  return local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase() || "AGENT";
}

/* ── Theme ─────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem(KEYS.theme);
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}
function toggleTheme() {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(KEYS.theme, dark ? "dark" : "light");
  const btn = $("#themeToggle");
  if (btn) btn.innerHTML = dark ? icon("sun") : icon("moon");
}

/* ── Toasts ────────────────────────────────────────────────────── */
function toast(msg, type = "default") {
  let stack = $(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
  el.innerHTML = (type === "success" ? icon("check") : type === "error" ? icon("warn") : "") + `<span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 3400);
}

/* ── Router ────────────────────────────────────────────────────── */
function currentRoute() { return location.hash.replace(/^#/, "") || "/"; }

function navItems() {
  return [
    { section: "Übersicht", items: [
      { route: "/", label: "Dashboard", icon: "dashboard" },
    ]},
    { section: "Fallführung", items: [
      { route: "/cases", label: "Fall-Datenbank", icon: "folder" },
      { route: "/my-cases", label: "Meine Fälle", icon: "myFolder" },
      { route: "/global-db", label: "Globale Datenbank", icon: "globe" },
    ]},
    { section: "Organisation", items: [
      { route: "/help", label: "Helpcenter", icon: "help" },
      { route: "/my", label: "Dienstausweis", icon: "badge" },
      { route: "/settings", label: "Einstellungen", icon: "settings" },
    ]}
  ];
}

function renderShell() {
  const app = $("#app");
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <img src="icons/icon-192.png" alt="">
        <div class="brand-text">
          <strong>ISM Cockpit</strong>
          <small>Switzerland</small>
        </div>
      </div>
      <nav id="sideNav"></nav>
      <div class="sidebar-foot">
        <div class="agent-chip">${icon("user")}<span>Angemeldet · <span class="agent-id" id="agentIdLabel">–</span></span></div>
        <button class="ghost-btn" id="exportAllBtn">${icon("download")} Backup exportieren</button>
        <button class="ghost-btn" id="importAllBtn">${icon("upload")} Backup importieren</button>
        <button class="ghost-btn" id="logoutBtn">${icon("logout")} Abmelden</button>
        <input id="importAllFile" type="file" accept="application/json" hidden>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="search-wrap">
          ${icon("search")}
          <input id="globalSearch" type="search" placeholder="Suche … Name, Aktenzeichen, Inhalt">
        </div>
        <div class="spacer"></div>
        <span class="org-tag">${icon("building")} ${escapeHtml(ISM.org)}</span>
        <button class="icon-btn" id="themeToggle" title="Hell/Dunkel">${document.documentElement.classList.contains("dark") ? icon("sun") : icon("moon")}</button>
      </header>
      <section id="view" class="view" tabindex="-1"></section>
    </div>
  `;

  const nav = $("#sideNav");
  navItems().forEach(group => {
    const label = document.createElement("div");
    label.className = "nav-section-label";
    label.textContent = group.section;
    nav.appendChild(label);
    group.items.forEach(it => {
      const a = document.createElement("a");
      a.href = "#" + it.route;
      a.className = "nav-link";
      a.dataset.route = it.route;
      a.innerHTML = icon(it.icon) + `<span>${escapeHtml(it.label)}</span>`;
      nav.appendChild(a);
    });
  });

  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#globalSearch").addEventListener("input", e => { state.search = e.target.value; rerenderIfSearchable(); });
  $("#logoutBtn").addEventListener("click", logout);
  $("#exportAllBtn").addEventListener("click", exportAllBackup);
  $("#importAllBtn").addEventListener("click", () => $("#importAllFile").click());
  $("#importAllFile").addEventListener("change", importAllBackup);

  updateAgentBadge();
}

function rerenderIfSearchable() {
  const route = currentRoute();
  if (route === "/cases" || route === "/global-db") render(route);
}

function highlightNav(route) {
  $$(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.route === route));
}

function updateAgentBadge() {
  const el = $("#agentIdLabel");
  if (el && state.session) el.textContent = state.session.agent;
}

function syncRoute() {
  const route = currentRoute();
  localStorage.setItem(KEYS.route, route);
  if (!state.session) {
    renderLogin();
  } else {
    if (!$("#app .sidebar")) renderShell();
    highlightNav(route);
    render(route);
  }
}

function render(route) {
  const view = $("#view");
  if (!view) return;
  view.innerHTML = "";
  updateAgentBadge();

  if (route === "/" || route === "") return renderDashboard();
  if (route === "/cases") return renderCasesList();
  if (route.startsWith("/case/")) return renderCaseDetail(route.slice("/case/".length));
  if (route === "/my-cases") return renderMyCases();
  if (route === "/global-db") return renderGlobalDatabase();
  if (route === "/help") return renderHelp();
  if (route === "/my") return renderMy();
  if (route === "/settings") return renderSettings();

  view.innerHTML = `<div class="empty-state">${icon("warn")}<div class="empty-title">Seite nicht gefunden</div></div>`;
}

/* ── Login (Supabase Auth) ────────────────────────────────────── */
function renderLogin() {
  document.title = "ISM Cockpit – Anmeldung";
  const app = $("#app");
  app.className = "";
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-head">
          <img class="crest" src="icons/icon-192.png" alt="">
          <h1>ISM Cockpit</h1>
          <div class="login-sub">Sichere Fall-Datenbank · Schweiz</div>
        </div>
        <div class="login-body">
          <div class="field">
            <label for="emailInput">Benutzerkennung (Email)</label>
            <input id="emailInput" class="input" type="email" autocomplete="username" placeholder="agent@ism.ch">
          </div>
          <div class="field">
            <label for="pwInput">Passwort</label>
            <input id="pwInput" class="input" type="password" autocomplete="current-password" placeholder="••••••••">
          </div>
          <button id="loginBtn" class="btn btn-primary" style="justify-content:center">${icon("lock")} Anmelden</button>
          <div id="loginError" class="login-error">${icon("warn")} <span></span></div>
        </div>
        <div class="login-foot">ISM Internal Use Only · Unauthorized access prohibited</div>
      </div>
    </div>
  `;
  const emailEl = $("#emailInput"), pwEl = $("#pwInput"), errEl = $("#loginError"), btn = $("#loginBtn");

  async function tryLogin() {
    const email = (emailEl.value || "").trim();
    const password = pwEl.value || "";
    if (!email || !password) { showErr("Bitte Email und Passwort eingeben."); return; }
    btn.disabled = true;
    errEl.style.display = "none";
    try {
      const user = await sbLogin(email, password);
      state.session = { agent: user.email, userId: user.id, org: ISM.org, loginAt: now() };
      save(KEYS.session, state.session);
      const route = localStorage.getItem(KEYS.route) || "/cases";
      location.hash = "#" + route;
      syncRoute();
    } catch (e) {
      showErr("Anmeldung fehlgeschlagen: " + (e.message || "unbekannter Fehler"));
      pwEl.focus(); pwEl.select && pwEl.select();
    } finally {
      btn.disabled = false;
    }
  }
  function showErr(msg) { errEl.querySelector("span").textContent = msg; errEl.style.display = "flex"; }

  btn.addEventListener("click", tryLogin);
  [emailEl, pwEl].forEach(el => el.addEventListener("keyup", e => { if (e.key === "Enter") tryLogin(); }));
  setTimeout(() => emailEl.focus(), 0);
}

function logout() {
  state.session = null;
  localStorage.removeItem(KEYS.session);
  sbLogout().catch(() => {});
  renderLogin();
}

/* ── Backup Export/Import (gesamter lokaler Stand) ───────────────  */
function exportAllBackup() {
  const payload = { cases: state.cases, people: state.people, exportedAt: now() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ism-cockpit-backup-${fmtDateInput(now())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportiert", "success");
}
function importAllBackup(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.cases)) { toast("Ungültiges Backup.", "error"); return; }
      state.cases = parsed.cases;
      state.people = parsed.people || [];
      save(KEYS.cases, state.cases);
      save(KEYS.people, state.people);
      syncGlobalPeopleFromCases();
      toast("Backup importiert", "success");
      render(currentRoute());
    } catch {
      toast("Konnte die Datei nicht lesen.", "error");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}


/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const view = $("#view");
  const cases = state.cases || [];
  const open = cases.filter(c => c.status === "erfasst" || c.status === "bearbeitung");
  const urgent = cases.filter(c => c.priority === "dringend" && c.status !== "abgeschlossen");
  const closedThisMonth = cases.filter(c => {
    if (c.status !== "abgeschlossen" || !c.closedAt) return false;
    const d = new Date(c.closedAt), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });
  const allReports = [];
  cases.forEach(c => (c.reports || []).forEach(r => allReports.push({ case: c, report: r })));
  allReports.sort((a, b) => (b.report.createdAt || 0) - (a.report.createdAt || 0));

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${icon("dashboard")} Dashboard</h1>
        <div class="page-sub">Lagebild der laufenden Fallführung</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">${icon("folder")} Offene Fälle</div>
        <div class="kpi-value">${open.length}</div>
        <div class="kpi-foot">von ${cases.length} Fällen total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${icon("warn")} Dringende Fälle</div>
        <div class="kpi-value">${urgent.length}</div>
        <div class="kpi-foot">Priorität "Dringend", nicht abgeschlossen</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${icon("docClose")} Abgeschlossen (Monat)</div>
        <div class="kpi-value">${closedThisMonth.length}</div>
        <div class="kpi-foot">im laufenden Kalendermonat</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${icon("doc")} Berichte total</div>
        <div class="kpi-value">${allReports.length}</div>
        <div class="kpi-foot">über alle Fälle hinweg</div>
      </div>
    </div>

    <div class="grid-2 section-gap">
      <div class="panel">
        <div class="panel-head"><h2>${icon("clock")} Letzte Berichte</h2></div>
        <table class="data-table">
          <thead><tr><th>Aktenzeichen</th><th>Typ</th><th>Erstellt</th></tr></thead>
          <tbody id="recentReportsBody"></tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>${icon("warn")} Priorität Dringend</h2></div>
        <table class="data-table">
          <thead><tr><th>Aktenzeichen</th><th>Titel</th><th>Status</th></tr></thead>
          <tbody id="urgentBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const recentBody = $("#recentReportsBody");
  if (!allReports.length) {
    recentBody.innerHTML = `<tr class="empty-row"><td colspan="3">Noch keine Berichte erfasst.</td></tr>`;
  } else {
    allReports.slice(0, 8).forEach(({ case: c, report: r }) => {
      const tr = document.createElement("tr");
      tr.className = "row-link";
      tr.innerHTML = `
        <td class="case-ref">${escapeHtml(c.ref || "")}</td>
        <td>${escapeHtml(reportTypeDef(r.type).label)}</td>
        <td>${fmt(r.createdAt)}</td>
      `;
      tr.addEventListener("click", () => { location.hash = "#/case/" + c.id; });
      recentBody.appendChild(tr);
    });
  }

  const urgentBody = $("#urgentBody");
  if (!urgent.length) {
    urgentBody.innerHTML = `<tr class="empty-row"><td colspan="3">Keine dringenden Fälle offen.</td></tr>`;
  } else {
    urgent.forEach(c => {
      const tr = document.createElement("tr");
      tr.className = "row-link";
      const st = caseStatusDef(c.status);
      tr.innerHTML = `
        <td class="case-ref">${escapeHtml(c.ref || "")}</td>
        <td>${escapeHtml(c.title || "")}</td>
        <td><span class="badge ${st.badge}">${escapeHtml(st.label)}</span></td>
      `;
      tr.addEventListener("click", () => { location.hash = "#/case/" + c.id; });
      urgentBody.appendChild(tr);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   FALL-DATENBANK — Liste + Neuanlage
   ═══════════════════════════════════════════════════════════════ */
function renderCasesList() {
  const view = $("#view");
  const q = (state.search || "").trim().toLowerCase();

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${icon("folder")} Fall-Datenbank</h1>
        <div class="page-sub">${state.cases.length} Fälle erfasst</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-primary" id="newCaseBtn">${icon("plus")} Fall anlegen</button>
      </div>
    </div>

    <div class="panel" id="newCasePanel" style="display:none;margin-bottom:18px;">
      <div class="panel-head"><h2>${icon("folder")} Neuer Fall</h2></div>
      <div class="panel-pad">
        <div class="form-grid" id="newCaseForm">
          <div class="field span-2">
            <label>Falltyp</label>
            <select class="input" id="ncType">
              ${CASE_TYPES.map(t => `<option value="${t.code}">${t.label} (${t.code})</option>`).join("")}
            </select>
            <div class="hint">Bestimmt den Code im Aktenzeichen (z.B. ISM.${new Date().getFullYear()}.ERM.0001)</div>
          </div>
          <div class="field span-2">
            <label>Titel</label>
            <input class="input" id="ncTitle" placeholder="Kurzbezeichnung des Falls">
          </div>
          <div class="field">
            <label>Priorität</label>
            <select class="input" id="ncPriority">
              ${CASE_PRIORITY.map(p => `<option value="${p.id}" ${p.id === "normal" ? "selected" : ""}>${p.label}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Sachbearbeiter</label>
            <input class="input" id="ncOfficer" value="${escapeHtml(agentCode())}">
          </div>
          <div class="field span-2">
            <label>Sachverhalt (kurz)</label>
            <textarea class="input" id="ncDesc" rows="3" placeholder="Kurze Beschreibung des Sachverhalts"></textarea>
          </div>
        </div>
        <div class="btn-row section-gap">
          <button class="btn btn-primary" id="ncCreateBtn">${icon("check")} Fall anlegen</button>
          <button class="btn" id="ncCancelBtn">Abbrechen</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>${icon("stack")} Übersicht</h2>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Aktenzeichen</th><th>Titel</th><th>Typ</th><th>Priorität</th><th>Status</th><th>Sachbearbeiter</th><th>Erstellt</th>
          </tr>
        </thead>
        <tbody id="casesBody"></tbody>
      </table>
    </div>
  `;

  $("#newCaseBtn").addEventListener("click", () => {
    const p = $("#newCasePanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
    if (p.style.display === "block") $("#ncTitle").focus();
  });
  $("#ncCancelBtn").addEventListener("click", () => { $("#newCasePanel").style.display = "none"; });
  $("#ncCreateBtn").addEventListener("click", () => {
    const title = ($("#ncTitle").value || "").trim();
    if (!title) { toast("Titel ist erforderlich.", "error"); return; }
    const typeCode = $("#ncType").value;
    const c = {
      id: uid(),
      ref: nextCaseRef(typeCode),
      title,
      type: typeCode,
      priority: $("#ncPriority").value,
      status: "erfasst",
      officer: ($("#ncOfficer").value || agentCode()).trim(),
      description: ($("#ncDesc").value || "").trim(),
      createdAt: now(),
      updatedAt: now(),
      closedAt: null,
      reports: [],
      contacts: []
    };
    state.cases.push(c);
    save(KEYS.cases, state.cases);
    toast("Fall " + c.ref + " angelegt", "success");
    location.hash = "#/case/" + c.id;
  });

  const body = $("#casesBody");
  let list = state.cases.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (q) {
    list = list.filter(c => {
      const hay = [c.ref, c.title, c.description, c.officer, caseTypeDef(c.type).label].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if (!list.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">Keine Fälle gefunden.</td></tr>`;
  } else {
    list.forEach(c => {
      const st = caseStatusDef(c.status);
      const pr = casePriorityDef(c.priority);
      const ty = caseTypeDef(c.type);
      const tr = document.createElement("tr");
      tr.className = "row-link";
      tr.innerHTML = `
        <td class="case-ref">${escapeHtml(c.ref || "")}</td>
        <td>${escapeHtml(c.title || "")}</td>
        <td><span class="case-type-tag">${icon(ty.icon)}${escapeHtml(ty.code)}</span></td>
        <td><span class="prio-dot ${pr.cls}">${escapeHtml(pr.label)}</span></td>
        <td><span class="badge ${st.badge}">${escapeHtml(st.label)}</span></td>
        <td>${escapeHtml(c.officer || "–")}</td>
        <td>${fmtDate(c.createdAt)}</td>
      `;
      tr.addEventListener("click", () => { location.hash = "#/case/" + c.id; });
      body.appendChild(tr);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   FALL-DETAIL — Deckblatt + Tabs (Übersicht / Berichte / Kontakte)
   ═══════════════════════════════════════════════════════════════ */
function findCase(id) { return state.cases.find(c => c.id === id); }

function renderCaseDetail(id) {
  const view = $("#view");
  const c = findCase(id);
  if (!c) {
    view.innerHTML = `<div class="empty-state">${icon("warn")}<div class="empty-title">Fall nicht gefunden</div><div class="empty-sub">Dieser Fall existiert nicht oder wurde gelöscht.</div><button class="btn" onclick="location.hash='#/cases'">Zur Fall-Datenbank</button></div>`;
    return;
  }
  const st = caseStatusDef(c.status);
  const pr = casePriorityDef(c.priority);
  const ty = caseTypeDef(c.type);

  view.innerHTML = `
    <button class="btn btn-sm" id="backToCases" style="margin-bottom:14px;">${icon("chevronLeft")} Zur Fall-Datenbank</button>

    <div class="case-cover">
      <div class="stamp ${stampClassForStatus(c.status)}">${escapeHtml(st.label)}</div>
      <div class="case-cover-top">
        <div class="case-cover-meta">
          <div class="case-cover-ref">${escapeHtml(c.ref || "")}</div>
          <h1>${escapeHtml(c.title || "")}</h1>
          <div class="case-cover-tags">
            <span class="case-type-tag">${icon(ty.icon)}${escapeHtml(ty.label)}</span>
            <span class="prio-dot ${pr.cls}">${escapeHtml(pr.label)}</span>
          </div>
        </div>
        <div class="head-actions">
          <button class="btn" id="editCaseBtn">${icon("edit")} Bearbeiten</button>
          <button class="btn btn-primary" id="dossierBtn">${icon("print")} Dossier drucken</button>
        </div>
      </div>
      <div class="case-cover-facts">
        <div><div class="case-fact-label">Sachbearbeiter</div><div class="case-fact-value">${escapeHtml(c.officer || "–")}</div></div>
        <div><div class="case-fact-label">Erstellt</div><div class="case-fact-value">${fmtDate(c.createdAt)}</div></div>
        <div><div class="case-fact-label">Zuletzt geändert</div><div class="case-fact-value">${fmtDate(c.updatedAt)}</div></div>
        <div><div class="case-fact-label">Berichte / Kontakte</div><div class="case-fact-value">${(c.reports || []).length} / ${(c.contacts || []).length}</div></div>
      </div>
    </div>

    <div class="tabs" id="caseTabs">
      <button class="tab-btn" data-tab="uebersicht">${icon("doc")} Übersicht</button>
      <button class="tab-btn" data-tab="berichte">${icon("docShort")} Berichte</button>
      <button class="tab-btn" data-tab="kontakte">${icon("users")} Kontaktpersonen</button>
    </div>
    <div class="tab-panel" id="caseTabPanel"></div>
  `;

  $("#backToCases").addEventListener("click", () => { location.hash = "#/cases"; });
  $("#editCaseBtn").addEventListener("click", () => openCaseEditDialog(c));
  $("#dossierBtn").addEventListener("click", () => exportCaseDossier(c));

  const tabs = $$(".tab-btn", $("#caseTabs"));
  function setTab(tab) {
    state.ui.activeCaseTab = tab;
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    const panel = $("#caseTabPanel");
    panel.innerHTML = "";
    if (tab === "uebersicht") renderCaseOverviewTab(panel, c);
    if (tab === "berichte") renderCaseReportsTab(panel, c);
    if (tab === "kontakte") renderCaseContactsTab(panel, c);
  }
  tabs.forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  setTab(state.ui.activeCaseTab || "uebersicht");
}

function renderCaseOverviewTab(panel, c) {
  panel.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>${icon("doc")} Sachverhalt</h2></div>
        <div class="doc-card-body" style="white-space:pre-wrap;">${escapeHtml(c.description || "Kein Sachverhalt erfasst.")}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>${icon("clock")} Verlauf</h2></div>
        <div class="panel-pad" id="caseHistory"></div>
      </div>
    </div>
  `;
  const hist = $("#caseHistory", panel);
  const events = [];
  events.push({ t: c.createdAt, label: "Fall erfasst", who: c.officer });
  (c.reports || []).forEach(r => events.push({ t: r.createdAt, label: reportTypeDef(r.type).label + " erstellt", who: r.author }));
  if (c.closedAt) events.push({ t: c.closedAt, label: "Fall abgeschlossen", who: c.officer });
  events.sort((a, b) => (b.t || 0) - (a.t || 0));
  if (!events.length) {
    hist.innerHTML = `<p class="text-muted" style="font-size:.85rem;">Keine Einträge.</p>`;
  } else {
    hist.innerHTML = events.map(e => `
      <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:.83rem;">
        <div class="text-faint mono" style="white-space:nowrap;">${fmt(e.t)}</div>
        <div>${escapeHtml(e.label)}${e.who ? ` <span class="text-muted">· ${escapeHtml(e.who)}</span>` : ""}</div>
      </div>
    `).join("");
  }
}

/* ═══════════════════════════════════════════════════════════════
   BERICHTE-TAB — 4 Berichtstypen mit eigenen Formularfeldern
   ═══════════════════════════════════════════════════════════════ */

/** Feld-Definitionen je Berichtstyp. Jedes Feld: {key,label,type,rows?,placeholder?} */
function reportFieldsFor(type) {
  const common = [];
  if (type === "kurzbericht") {
    return [
      { key: "datum", label: "Datum/Zeit Ereignis", type: "datetime-local" },
      { key: "ort", label: "Ort", type: "text" },
      { key: "inhalt", label: "Beobachtung / Sachverhalt", type: "textarea", rows: 6 },
    ];
  }
  if (type === "antragsbericht") {
    return [
      { key: "antragAn", label: "Antrag an (Stelle/Person)", type: "text" },
      { key: "rechtsgrundlage", label: "Rechtsgrundlage", type: "text" },
      { key: "begehren", label: "Antragsbegehren", type: "textarea", rows: 4 },
      { key: "begruendung", label: "Begründung", type: "textarea", rows: 6 },
      { key: "frist", label: "Frist", type: "date" },
    ];
  }
  if (type === "personenbericht") {
    return [
      { key: "personName", label: "Name der Person", type: "text" },
      { key: "geburtsdatum", label: "Geburtsdatum", type: "date" },
      { key: "rolle", label: "Rolle im Fall", type: "text", placeholder: "z.B. Beschuldigte:r, Auskunftsperson" },
      { key: "beschreibung", label: "Personenbeschreibung / Feststellungen", type: "textarea", rows: 6 },
    ];
  }
  if (type === "abschlussbericht") {
    return [
      { key: "ergebnis", label: "Ergebnis der Ermittlung", type: "textarea", rows: 4 },
      { key: "massnahmen", label: "Getroffene Massnahmen", type: "textarea", rows: 4 },
      { key: "empfehlung", label: "Empfehlung / weiteres Vorgehen", type: "textarea", rows: 4 },
      { key: "abschlussdatum", label: "Abschlussdatum", type: "date" },
    ];
  }
  return common;
}

function renderCaseReportsTab(panel, c) {
  panel.innerHTML = `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head">
        <h2>${icon("plus")} Neuer Bericht</h2>
      </div>
      <div class="panel-pad">
        <div class="form-grid">
          <div class="field span-2">
            <label>Berichtstyp</label>
            <select class="input" id="rtSelect">
              ${REPORT_TYPES.map(r => `<option value="${r.id}">${r.label}</option>`).join("")}
            </select>
          </div>
        </div>
        <div id="rtFieldsHost" class="form-grid section-gap"></div>
        <div class="btn-row section-gap">
          <button class="btn btn-primary" id="rtCreateBtn">${icon("check")} Bericht erstellen</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>${icon("stack")} Erfasste Berichte</h2></div>
      <div class="panel-pad" id="reportsList" style="display:grid;gap:12px;"></div>
    </div>
  `;

  const rtSelect = $("#rtSelect", panel);
  const fieldsHost = $("#rtFieldsHost", panel);

  function buildFields(type) {
    fieldsHost.innerHTML = "";
    const fields = reportFieldsFor(type);
    fields.forEach(f => {
      const wrap = document.createElement("div");
      wrap.className = "field" + (f.type === "textarea" ? " span-2" : "");
      const label = document.createElement("label");
      label.textContent = f.label;
      let input;
      if (f.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = f.rows || 4;
      } else {
        input = document.createElement("input");
        input.type = f.type;
      }
      input.className = "input";
      input.dataset.fieldKey = f.key;
      if (f.placeholder) input.placeholder = f.placeholder;
      wrap.append(label, input);
      fieldsHost.appendChild(wrap);
    });
  }
  buildFields(rtSelect.value);
  rtSelect.addEventListener("change", () => buildFields(rtSelect.value));

  $("#rtCreateBtn", panel).addEventListener("click", () => {
    const type = rtSelect.value;
    const fields = reportFieldsFor(type);
    const data = {};
    let hasContent = false;
    fields.forEach(f => {
      const input = fieldsHost.querySelector(`[data-field-key="${f.key}"]`);
      const val = (input && input.value || "").trim();
      data[f.key] = val;
      if (val) hasContent = true;
    });
    if (!hasContent) { toast("Bitte mindestens ein Feld ausfüllen.", "error"); return; }
    const report = {
      id: uid(),
      type,
      data,
      author: agentCode(),
      createdAt: now()
    };
    c.reports = c.reports || [];
    c.reports.push(report);
    c.updatedAt = now();
    save(KEYS.cases, state.cases);
    toast(reportTypeDef(type).label + " erstellt", "success");
    buildFields(type);
    renderReportsList();
  });

  function renderReportsList() {
    const list = $("#reportsList", panel);
    const reports = (c.reports || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!reports.length) {
      list.innerHTML = `<div class="empty-state">${icon("doc")}<div class="empty-title">Noch keine Berichte</div><div class="empty-sub">Erstelle den ersten Bericht über das Formular oben.</div></div>`;
      return;
    }
    list.innerHTML = "";
    reports.forEach(r => {
      const def = reportTypeDef(r.type);
      const fields = reportFieldsFor(r.type);
      const card = document.createElement("div");
      card.className = "doc-card";
      const bodyLines = fields.map(f => {
        const v = r.data && r.data[f.key];
        if (!v) return "";
        return `<div style="margin-bottom:8px;"><strong style="font-family:var(--font-ui);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--accent-ink);display:block;margin-bottom:2px;">${escapeHtml(f.label)}</strong>${escapeHtml(v)}</div>`;
      }).join("");
      card.innerHTML = `
        <div class="doc-card-head">
          <div class="doc-title">${icon(def.icon)} ${escapeHtml(def.label)}</div>
          <div class="doc-meta">${fmt(r.createdAt)} · ${escapeHtml(r.author || "")}</div>
        </div>
        <div class="doc-card-body">${bodyLines || "<em>Keine Angaben.</em>"}</div>
        <div class="doc-card-foot">
          <button class="btn btn-sm" data-action="delete-report">${icon("trash")} Löschen</button>
        </div>
      `;
      card.querySelector('[data-action="delete-report"]').addEventListener("click", () => {
        if (!confirm(`${def.label} vom ${fmtDate(r.createdAt)} wirklich löschen?`)) return;
        c.reports = (c.reports || []).filter(x => x.id !== r.id);
        c.updatedAt = now();
        save(KEYS.cases, state.cases);
        renderReportsList();
      });
      list.appendChild(card);
    });
  }
  renderReportsList();
}

/* ═══════════════════════════════════════════════════════════════
   KONTAKTPERSONEN-TAB
   ═══════════════════════════════════════════════════════════════ */
function renderCaseContactsTab(panel, c) {
  panel.innerHTML = `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-head"><h2>${icon("plus")} Kontaktperson erfassen</h2></div>
      <div class="panel-pad">
        <fieldset class="form-block">
          <legend>Personalien</legend>
          <div class="form-grid section-gap">
            <div class="field"><label>Name</label><input class="input" id="ctName"></div>
            <div class="field"><label>Rolle im Fall</label><input class="input" id="ctRole" placeholder="z.B. Beschuldigte:r, Zeuge"></div>
            <div class="field"><label>Geburtsdatum</label><input class="input" id="ctDob" type="text" placeholder="JJJJ-MM-TT oder Jahrgang"></div>
            <div class="field"><label>Geschlecht</label>
              <select class="input" id="ctGender">
                <option value="unbekannt">Unbekannt</option><option value="männlich">Männlich</option><option value="weiblich">Weiblich</option><option value="divers">Divers</option>
              </select>
            </div>
            <div class="field"><label>Nationalität</label><input class="input" id="ctNationality"></div>
            <div class="field"><label>Körpergrösse (cm)</label><input class="input" id="ctHeight" type="number"></div>
          </div>
        </fieldset>
        <fieldset class="form-block section-gap">
          <legend>Kontaktangaben</legend>
          <div class="form-grid section-gap">
            <div class="field"><label>Telefon</label><input class="input" id="ctPhone"></div>
            <div class="field"><label>E-Mail</label><input class="input" id="ctEmail" type="email"></div>
            <div class="field span-2"><label>Adresse / Wohnort</label><input class="input" id="ctAddress"></div>
            <div class="field"><label>Instagram</label><input class="input" id="ctInsta"></div>
            <div class="field"><label>Snapchat</label><input class="input" id="ctSnap"></div>
            <div class="field"><label>TikTok</label><input class="input" id="ctTiktok"></div>
          </div>
        </fieldset>
        <fieldset class="form-block section-gap">
          <legend>Äusseres Erscheinungsbild</legend>
          <div class="form-grid section-gap">
            <div class="field"><label>Haarfarbe</label><input class="input" id="ctHair"></div>
            <div class="field"><label>Augenfarbe</label><input class="input" id="ctEye"></div>
            <div class="field span-2"><label>Statur / besondere Merkmale</label><input class="input" id="ctBuild"></div>
            <div class="field span-2"><label>Ausweisdaten</label><input class="input" id="ctIdDoc"></div>
            <div class="field span-2"><label>Foto-URL</label><input class="input" id="ctPhoto"></div>
          </div>
        </fieldset>
        <div class="field section-gap"><label>Ermittlungsgrund / Bemerkungen</label><textarea class="input" id="ctNotes" rows="3"></textarea></div>
        <div class="btn-row section-gap">
          <button class="btn btn-primary" id="ctCreateBtn">${icon("check")} Person speichern</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>${icon("users")} Kontaktpersonen in diesem Fall</h2></div>
      <div class="panel-pad" id="contactsList" style="display:grid;gap:10px;"></div>
    </div>
  `;

  $("#ctCreateBtn", panel).addEventListener("click", () => {
    const name = ($("#ctName", panel).value || "").trim();
    if (!name) { toast("Name ist erforderlich.", "error"); return; }
    const contact = {
      id: uid(),
      name,
      role: ($("#ctRole", panel).value || "").trim(),
      dob: ($("#ctDob", panel).value || "").trim(),
      gender: $("#ctGender", panel).value,
      heightCm: ($("#ctHeight", panel).value || "").trim(),
      nationality: ($("#ctNationality", panel).value || "").trim(),
      elnr: ($("#ctPhone", panel).value || "").trim(),
      phone: ($("#ctPhone", panel).value || "").trim(),
      email: ($("#ctEmail", panel).value || "").trim(),
      address: ($("#ctAddress", panel).value || "").trim(),
      instagram: ($("#ctInsta", panel).value || "").trim(),
      snapchat: ($("#ctSnap", panel).value || "").trim(),
      tiktok: ($("#ctTiktok", panel).value || "").trim(),
      hairColor: ($("#ctHair", panel).value || "").trim(),
      eyeColor: ($("#ctEye", panel).value || "").trim(),
      build: ($("#ctBuild", panel).value || "").trim(),
      idDoc: ($("#ctIdDoc", panel).value || "").trim(),
      photoUrl: ($("#ctPhoto", panel).value || "").trim(),
      notes: ($("#ctNotes", panel).value || "").trim(),
      createdAt: now()
    };
    c.contacts = c.contacts || [];
    c.contacts.push(contact);
    c.updatedAt = now();
    save(KEYS.cases, state.cases);
    upsertGlobalPersonFromContact(c, contact); // auch in globale Datenbank übernehmen
    toast("Kontaktperson gespeichert", "success");
    $$('input, textarea', panel).forEach(el => { if (el.id && el.id.startsWith("ct")) el.value = ""; });
    $("#ctGender", panel).value = "unbekannt";
    renderContactsList();
  });

  function renderContactsList() {
    const list = $("#contactsList", panel);
    const contacts = c.contacts || [];
    if (!contacts.length) {
      list.innerHTML = `<div class="empty-state">${icon("users")}<div class="empty-title">Keine Kontaktpersonen erfasst</div></div>`;
      return;
    }
    list.innerHTML = "";
    contacts.forEach(p => {
      const card = document.createElement("div");
      card.className = "person-card";
      card.innerHTML = `
        <div class="person-photo">${p.photoUrl ? `<img src="${escapeHtml(p.photoUrl)}" alt="">` : icon("user")}</div>
        <div class="person-info">
          <div class="person-name">${escapeHtml(p.name)}</div>
          ${p.role ? `<div class="person-role">${escapeHtml(p.role)}</div>` : ""}
          <div class="person-facts">${[p.dob, p.nationality, p.elnr, p.address].filter(Boolean).map(escapeHtml).join(" · ") || "Keine weiteren Angaben"}</div>
        </div>
        <div class="person-actions">
          <button class="btn btn-sm" data-action="report">${icon("docPerson")} Bericht</button>
          <button class="btn btn-sm" data-action="delete">${icon("trash")}</button>
        </div>
      `;
      card.querySelector('[data-action="report"]').addEventListener("click", () => exportPersonReport(p, c.ref));
      card.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!confirm(`Kontaktperson "${p.name}" aus diesem Fall entfernen?`)) return;
        c.contacts = (c.contacts || []).filter(x => x.id !== p.id);
        c.updatedAt = now();
        save(KEYS.cases, state.cases);
        renderContactsList();
      });
      list.appendChild(card);
    });
  }
  renderContactsList();
}

/* ═══════════════════════════════════════════════════════════════
   FALL BEARBEITEN — Modal
   ═══════════════════════════════════════════════════════════════ */
function openCaseEditDialog(c) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h3>${icon("edit")} Fall bearbeiten</h3>
        <button class="icon-btn" id="closeEditCase">${icon("close")}</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Titel</label><input class="input" id="ecTitle" value="${escapeHtml(c.title || "")}"></div>
        <div class="form-grid">
          <div class="field">
            <label>Status</label>
            <select class="input" id="ecStatus">
              ${CASE_STATUS.map(s => `<option value="${s.id}" ${s.id === c.status ? "selected" : ""}>${s.label}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Priorität</label>
            <select class="input" id="ecPriority">
              ${CASE_PRIORITY.map(p => `<option value="${p.id}" ${p.id === c.priority ? "selected" : ""}>${p.label}</option>`).join("")}
            </select>
          </div>
          <div class="field span-2"><label>Sachbearbeiter</label><input class="input" id="ecOfficer" value="${escapeHtml(c.officer || "")}"></div>
          <div class="field span-2"><label>Sachverhalt</label><textarea class="input" id="ecDesc" rows="5">${escapeHtml(c.description || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-danger" id="ecDelete">${icon("trash")} Fall löschen</button>
        <div class="btn-row">
          <button class="btn" id="ecCancel">Abbrechen</button>
          <button class="btn btn-primary" id="ecSave">${icon("check")} Speichern</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  $("#closeEditCase", overlay).addEventListener("click", close);
  $("#ecCancel", overlay).addEventListener("click", close);
  $("#ecDelete", overlay).addEventListener("click", () => {
    if (!confirm(`Fall "${c.title}" (${c.ref}) endgültig löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    state.cases = state.cases.filter(x => x.id !== c.id);
    save(KEYS.cases, state.cases);
    close();
    location.hash = "#/cases";
  });
  $("#ecSave", overlay).addEventListener("click", () => {
    const newStatus = $("#ecStatus", overlay).value;
    if (newStatus === "abgeschlossen" && c.status !== "abgeschlossen") c.closedAt = now();
    if (newStatus !== "abgeschlossen") c.closedAt = null;
    c.title = ($("#ecTitle", overlay).value || "").trim() || c.title;
    c.status = newStatus;
    c.priority = $("#ecPriority", overlay).value;
    c.officer = ($("#ecOfficer", overlay).value || "").trim();
    c.description = ($("#ecDesc", overlay).value || "").trim();
    c.updatedAt = now();
    save(KEYS.cases, state.cases);
    close();
    render("/case/" + c.id);
  });
}

/* ═══════════════════════════════════════════════════════════════
   DOSSIER-EXPORT — alle Berichte eines Falls als druckbares PDF
   (Browser-Druckdialog, gleiches Prinzip wie bisheriger Export)
   ═══════════════════════════════════════════════════════════════ */
function printDocument(title, bodyHtml) {
  const win = window.open("", "_blank");
  if (!win) { toast("Popup blockiert. Bitte Popups für diese Seite erlauben.", "error"); return; }
  win.document.write(`
    <!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
      *{box-sizing:border-box;}
      body{font-family:'Source Serif 4',Georgia,serif;color:#1a1d23;margin:0;padding:36px 44px;font-size:13.5px;line-height:1.6;}
      .doc-letterhead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #ff7800;padding-bottom:10px;margin-bottom:22px;font-family:'Inter',sans-serif;}
      .doc-letterhead .org{font-weight:700;font-size:1.05rem;}
      .doc-letterhead .org small{display:block;font-weight:500;font-size:.7rem;color:#5b6270;letter-spacing:.04em;text-transform:uppercase;}
      .doc-letterhead .ref{font-family:'JetBrains Mono',monospace;font-size:.78rem;color:#5b6270;text-align:right;}
      h1{font-size:1.3rem;margin:0 0 2px;font-weight:700;}
      .sub{font-family:'Inter',sans-serif;font-size:.78rem;color:#5b6270;margin-bottom:24px;}
      .meta-table{width:100%;border-collapse:collapse;margin-bottom:24px;font-family:'Inter',sans-serif;font-size:.8rem;}
      .meta-table td{padding:5px 0;border-bottom:1px solid #e2e5ea;}
      .meta-table td:first-child{color:#5b6270;font-weight:600;width:180px;text-transform:uppercase;font-size:.7rem;letter-spacing:.04em;}
      .report-block{margin-bottom:26px;page-break-inside:avoid;}
      .report-block h2{font-family:'Inter',sans-serif;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:#b85600;border-bottom:1px solid #d7dbe1;padding-bottom:5px;margin-bottom:10px;display:flex;justify-content:space-between;font-weight:700;}
      .report-block h2 .meta{font-weight:500;color:#5b6270;text-transform:none;letter-spacing:0;font-family:'JetBrains Mono',monospace;}
      .field-row{margin-bottom:8px;}
      .field-row .flabel{font-family:'Inter',sans-serif;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6270;font-weight:600;display:block;}
      .signature-block{margin-top:50px;display:flex;justify-content:space-between;font-family:'Inter',sans-serif;font-size:.78rem;}
      .signature-line{border-top:1px solid #1a1d23;padding-top:6px;width:220px;}
      .footer-note{margin-top:40px;font-family:'Inter',sans-serif;font-size:.68rem;color:#9aa1ad;text-align:center;border-top:1px solid #e2e5ea;padding-top:10px;}
      @media print{ body{padding:14mm 16mm;} }
    </style></head><body>${bodyHtml}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function exportCaseDossier(c) {
  const st = caseStatusDef(c.status), pr = casePriorityDef(c.priority), ty = caseTypeDef(c.type);
  const reports = (c.reports || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const reportBlocks = reports.map(r => {
    const def = reportTypeDef(r.type);
    const fields = reportFieldsFor(r.type);
    const rows = fields.map(f => {
      const v = r.data && r.data[f.key];
      if (!v) return "";
      return `<div class="field-row"><span class="flabel">${escapeHtml(f.label)}</span>${escapeHtml(v)}</div>`;
    }).join("");
    return `
      <div class="report-block">
        <h2><span>${escapeHtml(def.label)}</span><span class="meta">${fmt(r.createdAt)} · ${escapeHtml(r.author || "")}</span></h2>
        ${rows || "<em>Keine Angaben.</em>"}
      </div>
    `;
  }).join("");

  const contactBlocks = (c.contacts || []).map(p => `
    <div class="report-block">
      <h2><span>Kontaktperson: ${escapeHtml(p.name)}</span><span class="meta">${escapeHtml(p.role || "")}</span></h2>
      <div class="field-row"><span class="flabel">Geburtsdatum</span>${escapeHtml(p.dob || "–")}</div>
      <div class="field-row"><span class="flabel">Nationalität</span>${escapeHtml(p.nationality || "–")}</div>
      <div class="field-row"><span class="flabel">Adresse</span>${escapeHtml(p.address || "–")}</div>
      <div class="field-row"><span class="flabel">Telefon</span>${escapeHtml(p.elnr || "–")}</div>
      ${p.notes ? `<div class="field-row"><span class="flabel">Bemerkungen</span>${escapeHtml(p.notes)}</div>` : ""}
    </div>
  `).join("");

  const html = `
    <div class="doc-letterhead">
      <div class="org">ISM Switzerland<small>Internal Service for Monitoring</small></div>
      <div class="ref">${escapeHtml(c.ref || "")}<br>Druckdatum: ${escapeHtml(new Date().toLocaleDateString("de-CH"))}</div>
    </div>
    <h1>Fall-Dossier — ${escapeHtml(c.title || "")}</h1>
    <div class="sub">${escapeHtml(ty.label)} · Priorität ${escapeHtml(pr.label)} · Status ${escapeHtml(st.label)}</div>

    <table class="meta-table">
      <tr><td>Aktenzeichen</td><td>${escapeHtml(c.ref || "")}</td></tr>
      <tr><td>Sachbearbeiter</td><td>${escapeHtml(c.officer || "–")}</td></tr>
      <tr><td>Erfasst am</td><td>${fmt(c.createdAt)}</td></tr>
      <tr><td>Status</td><td>${escapeHtml(st.label)}${c.closedAt ? " (" + fmtDate(c.closedAt) + ")" : ""}</td></tr>
      <tr><td>Sachverhalt</td><td>${escapeHtml(c.description || "–")}</td></tr>
    </table>

    ${reports.length ? `<h2 style="font-family:'Inter',sans-serif;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;">Berichte (${reports.length})</h2>${reportBlocks}` : ""}
    ${(c.contacts || []).length ? `<h2 style="font-family:'Inter',sans-serif;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;">Kontaktpersonen (${c.contacts.length})</h2>${contactBlocks}` : ""}

    <div class="signature-block">
      <div class="signature-line">Ort, Datum</div>
      <div class="signature-line">Unterschrift Sachbearbeiter:in</div>
    </div>
    <div class="footer-note">ISM Internal Use Only · Dieses Dossier ist vertraulich und nur für den internen Gebrauch bestimmt.</div>
  `;
  printDocument("Dossier " + (c.ref || ""), html);
}

function exportPersonReport(person, caseRefLabel) {
  const rows = [
    ["Name", person.name], ["Geburtsdatum", person.dob], ["Geschlecht", person.gender],
    ["Körpergrösse", person.heightCm ? person.heightCm + " cm" : ""], ["Nationalität", person.nationality],
    ["Adresse / Wohnort", person.address], ["Telefon", person.elnr || person.phone], ["E-Mail", person.email],
    ["Instagram", person.instagram], ["Snapchat", person.snapchat], ["TikTok", person.tiktok],
    ["Haarfarbe", person.hairColor], ["Augenfarbe", person.eyeColor], ["Statur / Merkmale", person.build],
    ["Ausweisdaten", person.idDoc], ["Ermittlungsgrund", person.reason], ["Bemerkungen", person.notes]
  ].filter(([, v]) => v);

  const html = `
    <div class="doc-letterhead">
      <div class="org">ISM Switzerland<small>Internal Service for Monitoring</small></div>
      <div class="ref">${escapeHtml(caseRefLabel || "Globale Datenbank")}<br>${escapeHtml(new Date().toLocaleDateString("de-CH"))}</div>
    </div>
    <h1>Personenbericht</h1>
    <div class="sub">${escapeHtml(caseRefLabel || "Globale Datenbank")}</div>
    <table class="meta-table">
      ${rows.map(([l, v]) => `<tr><td>${escapeHtml(l)}</td><td>${escapeHtml(v)}</td></tr>`).join("")}
    </table>
    <div class="signature-block">
      <div class="signature-line">Ort, Datum</div>
      <div class="signature-line">Unterschrift Sachbearbeiter:in</div>
    </div>
    <div class="footer-note">ISM Internal Use Only · Vertraulich.</div>
  `;
  printDocument("Personenbericht " + (person.name || ""), html);
}

/* ═══════════════════════════════════════════════════════════════
   MEINE FÄLLE — persönlich, pro Agent (Supabase)
   ═══════════════════════════════════════════════════════════════ */
async function renderMyCases() {
  const view = $("#view");
  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${icon("myFolder")} Meine Fälle</h1>
        <div class="page-sub">Persönlich angelegt · nur für dich sichtbar</div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:18px;">
      <div class="panel-head"><h2>${icon("plus")} Neuer Fall</h2></div>
      <div class="panel-pad">
        <div class="form-grid">
          <div class="field span-2"><label>Titel</label><input class="input" id="mcTitle"></div>
          <div class="field">
            <label>Status</label>
            <select class="input" id="mcStatus">
              <option value="offen">Offen</option><option value="in Bearbeitung">In Bearbeitung</option><option value="geschlossen">Geschlossen</option>
            </select>
          </div>
          <div class="field span-2"><label>Beschreibung</label><textarea class="input" id="mcDesc" rows="3"></textarea></div>
        </div>
        <div class="btn-row section-gap">
          <button class="btn btn-primary" id="mcCreateBtn">${icon("check")} Fall anlegen</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>${icon("stack")} Übersicht</h2></div>
      <div class="panel-pad" id="mcList" style="display:grid;gap:10px;"></div>
    </div>
  `;

  const list = $("#mcList");

  async function loadAndRender() {
    list.innerHTML = `<p class="text-muted" style="font-size:.85rem;">Lade …</p>`;
    try {
      const cases = await sbFetchMyCases();
      state.myCases = cases;
      if (!cases.length) {
        list.innerHTML = `<div class="empty-state">${icon("myFolder")}<div class="empty-title">Noch keine persönlichen Fälle</div></div>`;
        return;
      }
      list.innerHTML = "";
      cases.forEach(c => {
        const card = document.createElement("div");
        card.className = "doc-card";
        const statusBadge = c.status === "geschlossen" ? "badge-closed" : c.status === "in Bearbeitung" ? "badge-progress" : "badge-open";
        card.innerHTML = `
          <div class="doc-card-head">
            <div class="doc-title">${escapeHtml(c.title)}</div>
            <span class="badge ${statusBadge}">${escapeHtml(c.status || "offen")}</span>
          </div>
          <div class="doc-card-body">${c.description ? escapeHtml(c.description) : "<em>Keine Beschreibung.</em>"}<div class="text-faint mono" style="font-size:.72rem;margin-top:10px;">Erstellt: ${fmt(new Date(c.created_at).getTime())}</div></div>
          <div class="doc-card-foot">
            <button class="btn btn-sm" data-action="cycle">${icon("sync")} Status ändern</button>
            <button class="btn btn-sm" data-action="delete">${icon("trash")} Löschen</button>
          </div>
        `;
        card.querySelector('[data-action="cycle"]').addEventListener("click", async () => {
          const order = ["offen", "in Bearbeitung", "geschlossen"];
          const next = order[(order.indexOf(c.status) + 1) % order.length];
          try { await sbUpdateCase(c.id, { status: next }); await loadAndRender(); }
          catch (e) { toast("Fehler: " + e.message, "error"); }
        });
        card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!confirm(`Fall "${c.title}" wirklich löschen?`)) return;
          try { await sbDeleteCase(c.id); await loadAndRender(); }
          catch (e) { toast("Fehler: " + e.message, "error"); }
        });
        list.appendChild(card);
      });
    } catch (e) {
      list.innerHTML = `<div class="empty-state">${icon("warn")}<div class="empty-title">Fehler beim Laden</div><div class="empty-sub">${escapeHtml(e.message)}</div></div>`;
    }
  }

  $("#mcCreateBtn").addEventListener("click", async () => {
    const title = ($("#mcTitle").value || "").trim();
    if (!title) { toast("Titel ist erforderlich.", "error"); return; }
    try {
      await sbCreateCase({ title, status: $("#mcStatus").value, description: ($("#mcDesc").value || "").trim() });
      $("#mcTitle").value = ""; $("#mcDesc").value = ""; $("#mcStatus").value = "offen";
      toast("Fall angelegt", "success");
      await loadAndRender();
    } catch (e) { toast("Fehler: " + e.message, "error"); }
  });

  await loadAndRender();
}

/* ═══════════════════════════════════════════════════════════════
   CLOUDFLARE SYNC — Wire-Format UNVERÄNDERT zur Vorversion
   (gleicher Endpoint, gleiches Payload-Schema: {people, cases})
   ═══════════════════════════════════════════════════════════════ */
let _cfPushTimer = null;
function cfSchedulePush() {
  clearTimeout(_cfPushTimer);
  _cfPushTimer = setTimeout(() => {
    if (cfConfig()) cfPush().catch(e => console.warn("[CF] Background-Push:", e.message));
  }, 2000);
}

function cfConfig() {
  try { const raw = localStorage.getItem(KEYS.cf); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function cfSaveConfig(endpoint, apiKey) {
  localStorage.setItem(KEYS.cf, JSON.stringify({ endpoint, apiKey }));
}

async function cfPull() {
  const cfg = cfConfig();
  if (!cfg || !cfg.endpoint || !cfg.apiKey) throw new Error("Cloudflare nicht konfiguriert (Einstellungen → Cloudflare Sync).");
  const res = await fetch(cfg.endpoint + "/api/all", { headers: { "x-api-key": cfg.apiKey } });
  if (!res.ok) throw new Error("Worker-Fehler " + res.status);
  const remote = await res.json();

  const remotePeople = Array.isArray(remote.people) ? remote.people : [];
  const localPeople = state.people || [];
  const pMap = new Map();
  remotePeople.forEach(p => pMap.set(p.id, p));
  localPeople.forEach(p => {
    const rem = pMap.get(p.id);
    if (!rem || (p.updated || 0) >= (rem.updated || 0)) pMap.set(p.id, p);
  });
  state.people = Array.from(pMap.values());
  save(KEYS.people, state.people);

  const remoteCases = Array.isArray(remote.cases) ? remote.cases : [];
  const localCases = state.cases || [];
  const cMap = new Map();
  remoteCases.forEach(c => cMap.set(c.id, c));
  localCases.forEach(c => {
    const rem = cMap.get(c.id);
    if (!rem || (c.updatedAt || c.createdAt || 0) >= (rem.updatedAt || rem.createdAt || 0)) cMap.set(c.id, c);
  });
  state.cases = Array.from(cMap.values());
  save(KEYS.cases, state.cases);

  return { people: state.people.length, cases: state.cases.length };
}

async function cfPush() {
  const cfg = cfConfig();
  if (!cfg || !cfg.endpoint || !cfg.apiKey) throw new Error("Cloudflare nicht konfiguriert (Einstellungen → Cloudflare Sync).");
  const res = await fetch(cfg.endpoint + "/api/all", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey },
    body: JSON.stringify({ people: state.people || [], cases: state.cases || [] })
  });
  if (!res.ok) throw new Error("Worker-Fehler " + res.status);
  return true;
}

async function cfSync(statusEl) {
  function setStatus(msg, isErr = false) {
    if (statusEl) { statusEl.textContent = msg; statusEl.style.color = isErr ? "var(--status-urgent-fg)" : "var(--muted)"; }
  }
  try {
    setStatus("Verbinde mit Cloudflare …");
    const pulled = await cfPull();
    setStatus("Übertrage lokale Daten …");
    await cfPush();
    setStatus(`Synchronisiert – ${pulled.people} Personen, ${pulled.cases} Fälle`);
    return true;
  } catch (err) {
    setStatus(err.message, true);
    console.error("cfSync:", err);
    return false;
  }
}

/* ── Globale Personen-Datenbank — gleiches Schema wie Vorversion ── */
function upsertGlobalPersonFromContact(caseObj, contact) {
  if (!contact || !contact.name) return;
  const nameKey = (contact.name || "").trim().toLowerCase();
  const dobKey = (contact.dob || "").trim();
  const nowTs = now();
  state.people = state.people || [];

  let person = state.people.find(p => (p.name || "").trim().toLowerCase() === nameKey && (p.dob || "").trim() === dobKey);
  const caseRef = caseObj && caseObj.id ? { id: caseObj.id, title: caseObj.title || caseObj.ref || "" } : null;

  if (!person) {
    person = {
      id: uid(), name: contact.name || "", dob: contact.dob || "", gender: contact.gender || "",
      heightCm: contact.heightCm || "", nationality: contact.nationality || "", elnr: contact.elnr || "",
      address: contact.address || "", email: contact.email || "", reason: contact.reason || contact.notes || "",
      instagram: contact.instagram || "", snapchat: contact.snapchat || "", tiktok: contact.tiktok || "",
      hairColor: contact.hairColor || "", eyeColor: contact.eyeColor || "", build: contact.build || "",
      idDoc: contact.idDoc || "", photoUrl: contact.photoUrl || "", notes: contact.notes || "",
      cases: caseRef ? [caseRef] : [], created: nowTs, updated: nowTs
    };
    state.people.push(person);
  } else {
    ["gender","heightCm","nationality","elnr","address","email","reason","instagram","snapchat","tiktok","hairColor","eyeColor","build","idDoc","photoUrl","notes"]
      .forEach(field => { if (!person[field] && contact[field]) person[field] = contact[field]; });
    person.updated = nowTs;
    if (caseRef) {
      person.cases = person.cases || [];
      if (!person.cases.some(c => c.id === caseRef.id)) person.cases.push(caseRef);
    }
  }
  save(KEYS.people, state.people);
}

function syncGlobalPeopleFromCases() {
  state.people = state.people || [];
  state.cases.forEach(c => (c.contacts || []).forEach(contact => upsertGlobalPersonFromContact(c, contact)));
}

/* ═══════════════════════════════════════════════════════════════
   GLOBALE DATENBANK — gleiches Datenmodell, neues Design
   ═══════════════════════════════════════════════════════════════ */
function renderGlobalDatabase() {
  const view = $("#view");
  const cfg = cfConfig();
  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${icon("globe")} Globale Datenbank</h1>
        <div class="page-sub">${state.people.length} Personen erfasst · weltweite ISM-Personendatenbank</div>
      </div>
      <div class="head-actions">
        <button class="btn" id="gdSyncBtn">${icon("sync")} Sync</button>
        <button class="btn btn-primary" id="gdNewBtn">${icon("plus")} Person erfassen</button>
      </div>
    </div>
    <div class="text-muted" id="gdSyncStatus" style="font-size:.78rem;margin:-10px 0 14px;">${cfg ? "" : "Cloudflare nicht konfiguriert (siehe Einstellungen)."}</div>

    <div class="panel" id="gdFormPanel" style="display:none;margin-bottom:16px;">
      <div class="panel-head"><h2>${icon("plus")} Neue Person (ohne Fallbezug)</h2></div>
      <div class="panel-pad">
        <div class="form-grid" id="gdForm">
          <div class="field"><label>Name</label><input class="input" id="gdName"></div>
          <div class="field"><label>Geburtsdatum</label><input class="input" id="gdDob" placeholder="JJJJ-MM-TT oder Jahrgang"></div>
          <div class="field"><label>Geschlecht</label>
            <select class="input" id="gdGender"><option value="unbekannt">Unbekannt</option><option value="männlich">Männlich</option><option value="weiblich">Weiblich</option><option value="divers">Divers</option></select>
          </div>
          <div class="field"><label>Körpergrösse (cm)</label><input class="input" id="gdHeight" type="number"></div>
          <div class="field"><label>Nationalität</label><input class="input" id="gdNationality"></div>
          <div class="field"><label>Telefonnummer</label><input class="input" id="gdPhone"></div>
          <div class="field"><label>Adresse</label><input class="input" id="gdAddress"></div>
          <div class="field"><label>E-Mail</label><input class="input" id="gdEmail" type="email"></div>
          <div class="field span-2"><label>Ermittlungsgrund</label><input class="input" id="gdReason"></div>
          <div class="field"><label>Instagram</label><input class="input" id="gdInsta"></div>
          <div class="field"><label>Snapchat</label><input class="input" id="gdSnap"></div>
          <div class="field"><label>TikTok</label><input class="input" id="gdTiktok"></div>
          <div class="field"><label>Haarfarbe</label><input class="input" id="gdHair"></div>
          <div class="field"><label>Augenfarbe</label><input class="input" id="gdEye"></div>
          <div class="field span-2"><label>Statur / Merkmale</label><input class="input" id="gdBuild"></div>
          <div class="field span-2"><label>Ausweisdaten</label><input class="input" id="gdIdDoc"></div>
          <div class="field span-2"><label>Foto-URL</label><input class="input" id="gdPhoto"></div>
          <div class="field span-2"><label>Weitere Infos</label><textarea class="input" id="gdNotes" rows="3"></textarea></div>
        </div>
        <div class="btn-row section-gap">
          <button class="btn btn-primary" id="gdSaveBtn">${icon("check")} Person speichern</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Geburt</th><th>Nationalität</th><th>Telefon</th><th>Ermittlungsgrund</th><th>Fälle</th><th></th></tr></thead>
        <tbody id="gdBody"></tbody>
      </table>
    </div>
  `;

  $("#gdNewBtn").addEventListener("click", () => {
    const p = $("#gdFormPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });
  $("#gdSyncBtn").addEventListener("click", async () => {
    const btn = $("#gdSyncBtn"); btn.disabled = true;
    const ok = await cfSync($("#gdSyncStatus"));
    btn.disabled = false;
    if (ok) render("/global-db");
  });
  $("#gdSaveBtn").addEventListener("click", () => {
    const name = ($("#gdName").value || "").trim();
    if (!name) { toast("Name fehlt.", "error"); return; }
    const contactLike = {
      name, dob: $("#gdDob").value || "", gender: $("#gdGender").value || "",
      heightCm: $("#gdHeight").value ? String($("#gdHeight").value) : "",
      nationality: ($("#gdNationality").value || "").trim(), elnr: ($("#gdPhone").value || "").trim(),
      address: ($("#gdAddress").value || "").trim(), email: ($("#gdEmail").value || "").trim(),
      reason: ($("#gdReason").value || "").trim(), instagram: ($("#gdInsta").value || "").trim(),
      snapchat: ($("#gdSnap").value || "").trim(), tiktok: ($("#gdTiktok").value || "").trim(),
      hairColor: ($("#gdHair").value || "").trim(), eyeColor: ($("#gdEye").value || "").trim(),
      build: ($("#gdBuild").value || "").trim(), idDoc: ($("#gdIdDoc").value || "").trim(),
      photoUrl: ($("#gdPhoto").value || "").trim(), notes: ($("#gdNotes").value || "").trim()
    };
    upsertGlobalPersonFromContact(null, contactLike);
    toast("Person gespeichert", "success");
    render("/global-db");
  });

  const body = $("#gdBody");
  const q = (state.search || "").trim().toLowerCase();
  let list = (state.people || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "") || (a.dob || "").localeCompare(b.dob || ""));
  if (q) {
    list = list.filter(p => [p.name, p.dob, p.nationality, p.elnr, p.address, p.email, p.reason].join(" ").toLowerCase().includes(q));
  }
  if (!list.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">Noch keine Personen in der globalen Datenbank.</td></tr>`;
  } else {
    list.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name || "")}</td>
        <td>${escapeHtml(p.dob || "–")}</td>
        <td>${escapeHtml(p.nationality || "–")}</td>
        <td>${escapeHtml(p.elnr || "–")}</td>
        <td>${escapeHtml(p.reason || "–")}</td>
        <td>${(p.cases && p.cases.length) || 0}</td>
        <td class="col-actions"></td>
      `;
      const actions = document.createElement("div");
      actions.className = "btn-row";
      actions.style.justifyContent = "flex-end";
      const detailsBtn = document.createElement("button");
      detailsBtn.className = "btn btn-sm"; detailsBtn.innerHTML = icon("edit") + "Details";
      detailsBtn.addEventListener("click", () => openPersonEditDialog(p));
      const reportBtn = document.createElement("button");
      reportBtn.className = "btn btn-sm"; reportBtn.innerHTML = icon("docPerson") + "Bericht";
      reportBtn.addEventListener("click", () => exportPersonReport(p, "Globale Datenbank"));
      actions.append(detailsBtn, reportBtn);
      tr.querySelector(".col-actions").appendChild(actions);
      body.appendChild(tr);
    });
  }
}

function openPersonEditDialog(person) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const box = document.createElement("div");
  box.className = "modal-box modal-lg";

  function field(label, key, type = "text") {
    return `<div class="field"><label>${escapeHtml(label)}</label><input class="input" data-pf="${key}" type="${type}" value="${escapeHtml(person[key] || "")}"></div>`;
  }
  box.innerHTML = `
    <div class="modal-head"><h3>${icon("user")} Person bearbeiten</h3><button class="icon-btn" id="pdClose">${icon("close")}</button></div>
    <div class="modal-body">
      <div class="form-grid">
        ${field("Name", "name")}
        ${field("Geburtsdatum", "dob")}
        ${field("Geschlecht", "gender")}
        ${field("Körpergrösse (cm)", "heightCm")}
        ${field("Nationalität", "nationality")}
        ${field("Telefonnummer", "elnr")}
        ${field("Adresse / Wohnort", "address")}
        ${field("E-Mail", "email", "email")}
        ${field("Ermittlungsgrund", "reason")}
        ${field("Haarfarbe", "hairColor")}
        ${field("Augenfarbe", "eyeColor")}
        ${field("Statur / Merkmale", "build")}
        ${field("Ausweisdaten", "idDoc")}
        ${field("Foto-URL", "photoUrl")}
        ${field("Instagram", "instagram")}
        ${field("Snapchat", "snapchat")}
        ${field("TikTok", "tiktok")}
        <div class="field span-2"><label>Weitere Infos / Notizen</label><textarea class="input" data-pf="notes" rows="3">${escapeHtml(person.notes || "")}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" id="pdDelete">${icon("trash")} Person löschen</button>
      <div class="btn-row"><button class="btn" id="pdCancel">Abbrechen</button><button class="btn btn-primary" id="pdSave">${icon("check")} Speichern</button></div>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  $("#pdClose", box).addEventListener("click", close);
  $("#pdCancel", box).addEventListener("click", close);
  $("#pdDelete", box).addEventListener("click", () => {
    const ok = confirm("Das Löschen dieser Person ohne entsprechende Berechtigung kann zu internen Untersuchungen sowie rechtlichen Schwierigkeiten führen.\n\nBist du sicher, dass du diese Person endgültig löschen möchtest?");
    if (!ok) return;
    state.people = (state.people || []).filter(p => p.id !== person.id);
    save(KEYS.people, state.people);
    close();
    render("/global-db");
  });
  $("#pdSave", box).addEventListener("click", () => {
    $$("[data-pf]", box).forEach(el => { person[el.dataset.pf] = el.value.trim(); });
    person.phone = person.elnr;
    person.updated = now();
    save(KEYS.people, state.people);
    close();
    render("/global-db");
  });
}

/* ═══════════════════════════════════════════════════════════════
   HELPCENTER
   ═══════════════════════════════════════════════════════════════ */
function renderHelp() {
  const view = $("#view");
  view.innerHTML = `
    <div class="page-head"><div><h1>${icon("help")} Helpcenter</h1><div class="page-sub">Richtlinien, Zuständigkeiten und Falltyp-Übersicht</div></div></div>
    <div class="panel"><div class="panel-pad help-grid">
      <div class="help-block">
        <h3>Aktenzeichen-Schema</h3>
        <p>Jeder Fall erhält automatisch ein Aktenzeichen nach dem Schema <span class="mono">ISM.Jahr.Typ.Laufnummer</span>, z.B. <span class="mono">ISM.${new Date().getFullYear()}.ERM.0001</span>. Die Laufnummer wird pro Kalenderjahr fortlaufend vergeben.</p>
      </div>
      <div class="help-block">
        <h3>Falltypen</h3>
        <p>${CASE_TYPES.map(t => `<strong>${escapeHtml(t.code)}</strong> – ${escapeHtml(t.label)}`).join(" · ")}</p>
      </div>
      <div class="help-block">
        <h3>Berichtstypen</h3>
        <p>${REPORT_TYPES.map(r => `<strong>${escapeHtml(r.label)}</strong>`).join(" · ")} — jeder Typ hat eigene, vorstrukturierte Formularfelder. Alle Berichte eines Falls können über "Dossier drucken" gesammelt als PDF ausgegeben werden.</p>
      </div>
      <div class="help-block">
        <h3>Fälle vs. Meine Fälle</h3>
        <p>Die <strong>Fall-Datenbank</strong> ist die globale, über Cloudflare synchronisierte Ablage. <strong>Meine Fälle</strong> sind persönlich, pro Agent getrennt gespeichert und nur für dich sichtbar.</p>
      </div>
      <div class="help-block">
        <h3>Globale Datenbank</h3>
        <p>Erfasst Personen unabhängig von einzelnen Fällen. Kontaktpersonen aus Fällen werden automatisch hier übernommen und mit ihren Fallbezügen verknüpft.</p>
      </div>
    </div></div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   DIENSTAUSWEIS
   ═══════════════════════════════════════════════════════════════ */
function renderMy() {
  const view = $("#view");
  const agentCases = state.cases.filter(c => c.officer === agentCode());
  view.innerHTML = `
    <div class="page-head"><div><h1>${icon("badge")} Dienstausweis</h1></div></div>
    <div class="panel" style="max-width:420px;">
      <div class="panel-pad" style="display:grid;gap:14px;">
        <div style="display:flex;gap:14px;align-items:center;">
          <div class="person-photo" style="width:64px;height:64px;">${icon("user")}</div>
          <div>
            <div style="font-weight:700;font-size:1.05rem;">${escapeHtml(agentCode())}</div>
            <div class="text-muted mono" style="font-size:.8rem;">${escapeHtml(state.session ? state.session.agent : "")}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="case-cover-facts" style="grid-template-columns:1fr 1fr;border:none;padding:0;margin:0;">
          <div><div class="case-fact-label">Organisation</div><div class="case-fact-value">${escapeHtml(ISM.org)}</div></div>
          <div><div class="case-fact-label">Zugeordnete Fälle</div><div class="case-fact-value">${agentCases.length}</div></div>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   EINSTELLUNGEN
   ═══════════════════════════════════════════════════════════════ */
function renderSettings() {
  const view = $("#view");
  const existingCfg = cfConfig() || {};
  const isCfg = !!(existingCfg.endpoint && existingCfg.apiKey);

  view.innerHTML = `
    <div class="page-head"><div><h1>${icon("settings")} Einstellungen</h1></div></div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h2>${icon("user")} Konto</h2></div>
        <div class="panel-pad" style="display:grid;gap:10px;">
          <div class="text-muted" style="font-size:.85rem;">Angemeldet als <strong>${escapeHtml(state.session ? state.session.agent : "")}</strong></div>
          <button class="btn" id="themeToggleSettings">${document.documentElement.classList.contains("dark") ? icon("sun") : icon("moon")} Hell/Dunkel umschalten</button>
          <button class="btn btn-danger" id="clearLocalBtn">${icon("trash")} Alle lokalen Fälle löschen</button>
          <button class="btn" id="logoutBtnSettings">${icon("logout")} Abmelden</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>${icon("sync")} Cloudflare Sync</h2></div>
        <div class="panel-pad" style="display:grid;gap:10px;">
          <div class="text-muted" style="font-size:.82rem;">Synchronisiert Fälle und die globale Personendatenbank über deinen Cloudflare Worker.</div>
          <div class="field"><label>Worker-URL</label><input class="input" id="cfEndpoint" value="${escapeHtml(existingCfg.endpoint || "")}" placeholder="https://ism-cockpit.dein-name.workers.dev"></div>
          <div class="field"><label>API-Key (x-api-key)</label><input class="input" id="cfKey" type="password" value="${escapeHtml(existingCfg.apiKey || "")}"></div>
          <div id="cfStatus" class="text-muted" style="font-size:.8rem;">${isCfg ? "Konfiguriert" : "Noch nicht konfiguriert"}</div>
          <div class="btn-row">
            <button class="btn btn-primary" id="cfSaveBtn">Speichern</button>
            <button class="btn" id="cfSyncBtn">${icon("sync")} Jetzt synchronisieren</button>
            <button class="btn" id="cfPushBtn">${icon("upload")} Lokal → Cloud</button>
            <button class="btn" id="cfPullBtn">${icon("download")} Cloud → Lokal</button>
          </div>
        </div>
      </div>
    </div>
  `;

  $("#themeToggleSettings").addEventListener("click", () => { toggleTheme(); render("/settings"); });
  $("#logoutBtnSettings").addEventListener("click", logout);
  $("#clearLocalBtn").addEventListener("click", () => {
    if (!confirm("Wirklich alle lokalen Fälle löschen? (Cloudflare-Daten bleiben unberührt, bis erneut synchronisiert wird.)")) return;
    state.cases = [];
    save(KEYS.cases, state.cases);
    toast("Lokale Fälle gelöscht", "success");
    render("/");
  });

  const cfStatus = $("#cfStatus");
  $("#cfSaveBtn").addEventListener("click", () => {
    const ep = ($("#cfEndpoint").value || "").trim().replace(/\/$/, "");
    const key = ($("#cfKey").value || "").trim();
    if (!ep || !key) { cfStatus.textContent = "URL und Key sind erforderlich."; cfStatus.style.color = "var(--status-urgent-fg)"; return; }
    cfSaveConfig(ep, key);
    cfStatus.textContent = "Gespeichert"; cfStatus.style.color = "var(--muted)";
  });
  $("#cfSyncBtn").addEventListener("click", async () => {
    const btn = $("#cfSyncBtn"); btn.disabled = true;
    await cfSync(cfStatus);
    btn.disabled = false;
  });
  $("#cfPushBtn").addEventListener("click", async () => {
    if (!confirm("Lokale Daten überschreiben die Cloud-Daten komplett. Fortfahren?")) return;
    const btn = $("#cfPushBtn"); btn.disabled = true;
    try { await cfPush(); cfStatus.textContent = "Erfolgreich hochgeladen"; cfStatus.style.color = "var(--muted)"; }
    catch (e) { cfStatus.textContent = e.message; cfStatus.style.color = "var(--status-urgent-fg)"; }
    btn.disabled = false;
  });
  $("#cfPullBtn").addEventListener("click", async () => {
    const btn = $("#cfPullBtn"); btn.disabled = true;
    try { const r = await cfPull(); cfStatus.textContent = `Geladen – ${r.people} Personen, ${r.cases} Fälle`; cfStatus.style.color = "var(--muted)"; }
    catch (e) { cfStatus.textContent = e.message; cfStatus.style.color = "var(--status-urgent-fg)"; }
    btn.disabled = false;
  });
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
(function init() {
  initTheme();

  window.addEventListener("hashchange", syncRoute);

  sbCurrentUser().then(user => {
    if (!user && state.session) {
      state.session = null;
      localStorage.removeItem(KEYS.session);
    } else if (user && !state.session) {
      state.session = { agent: user.email, userId: user.id, org: ISM.org, loginAt: now() };
      save(KEYS.session, state.session);
    }
    syncRoute();
    if (cfConfig()) {
      cfPull().then(r => console.log(`[CF] Auto-Sync: ${r.people} Personen, ${r.cases} Fälle`))
              .catch(e => console.warn("[CF] Auto-Sync fehlgeschlagen:", e.message));
    }
  }).catch(() => { syncRoute(); });

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && state.session) {
      state.session = null;
      localStorage.removeItem(KEYS.session);
      renderLogin();
    }
  });
})();
