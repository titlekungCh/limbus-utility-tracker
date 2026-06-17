import { ACTIONS, run, recompute } from "./logic.js";
import {
  UPTIE, THREADSPIN, SPINCHAIN, UPTIE_LEVEL, TS_STEP_LEVEL, LUNACY_ACTIONS, TICKET_ACTIONS, GACHA_TIERS,
  SINNER_ORDER, SINNER_COLORS, LEVEL_FILL, LEVEL_FILL_DEFAULT, SCALE_STOPS,
  SHARD_TYPE_FILL, GACHA_TIER_FILL, DAY_FILL,
  EVENT_ITEM_FILL, EVENT_REWARD_FILL, SIN_ORDER, SIN_FILL,
  STATUS_ORDER, STATUS_FILL, FACTION_COLORS, SCALE_MAX5, SEASON_FILL, TIER_FILL,
  SEASON_NUMBER_FILL, KEYWORD_FILL, KEYWORD_ORDER, DAYS, INVENTORY_FILL, LUNACY_FILL,
  DAILY_LEFT_FILL, WEEKLY_LEFT_FILL, RESOURCE_ICON,
} from "./constants.js";
import { OPTION_ICONS, GRADE_GLYPH } from "./icons-map.js";

// Most recent Thursday (the current patch), incl. today; local date as YYYY-MM-DD.
function currentPatchISO() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
import {
  managerForecast, resourceForecast, shardPlanRows, idLeveling, SHARD_TYPES,
  eventShop, REWARD_TYPES, egoThreadspin,
} from "./projections.js";

// persists across dashboard re-renders (idx into state.ids / state.egos)
let idLevelSel = { idx: null, target: 60 };
let egoTSel = { idx: null, target: 4 };

let state = null;
let dirty = false;

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// inverted (complementary) hex colour, used for a contrasting icon glow
const invertHex = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (h.length < 6) return "#000000";
  return "#" + [0, 2, 4].map((i) => (255 - parseInt(h.slice(i, i + 2), 16)).toString(16).padStart(2, "0")).join("");
};
// <img> tag for an icon path (or "" when falsy); optional drop-shadow colour
const icoTag = (p, shadow) => (p ? `<img class="opt-ico" src="${esc(p)}" alt="" loading="lazy"${shadow ? ` style="filter:drop-shadow(0 0 2px ${shadow})"` : ""}>` : "");
// sinner icon with a drop shadow in the inverse of the sinner's colour
const sinnerIco = (name) => icoTag(OPTION_ICONS.sinner[name], SINNER_COLORS[name] ? invertHex(SINNER_COLORS[name].fill) : null);
// sinner acronym -> sinner name (e.g. "HL" -> "Hong Lu"); built from state.sinners
let _acroName = null;
const acroNameMap = () => {
  if (!_acroName) { _acroName = {}; for (const sn of state.sinners) if (sn.acronym) _acroName[sn.acronym] = sn.name; }
  return _acroName;
};
// keyword chips: colour each word as a combat status or a sin, with its icon
const kwChips = (text) => {
  if (!text) return "";
  return String(text).split(/\s+/).filter(Boolean).map((w) => {
    let c = fillColor(STATUS_FILL[w]), cat = "keyword";
    if (!c && SIN_FILL[w]) { c = fillColor(SIN_FILL[w]); cat = "sin"; }
    return c ? `<span class="chip" style="background:${c.fill};color:${c.font}">${optIcon(cat, w)}${esc(w)}</span>`
      : `<span class="chip plain">${esc(w)}</span>`;
  }).join(" ");
};
// render a grid cell value: mode "keyword" -> status chips; else sinner-acronym icons
const acellView = (value, mode) => {
  const v = String(value ?? "");
  if (!v) return "";
  if (mode === "keyword") return kwChips(v);
  const map = acroNameMap();
  return v.split(" ").map((tok) => (map[tok] ? optIcon("sinner", map[tok]) : esc(tok))).join(" ");
};
// wrap a grid <input> so the icon/chips view shows when the cell isn't focused
const wrapAcell = (inputHtml, value, colorObj, mode) => {
  const st = colorObj ? `background:${colorObj.fill};color:${colorObj.font};` : "";
  return `<div class="acell"${mode ? ` data-mode="${mode}"` : ""} style="${st}">${inputHtml}<div class="acell-view">${acellView(value, mode)}</div></div>`;
};
// after a cell edits, recolour its container + refresh the icon/chips view
const refreshAcell = (input) => {
  const cell = input.closest(".acell"); if (!cell) return;
  const mode = cell.dataset.mode;
  const c = mode === "keyword" ? null : acronymColor(input.value);
  cell.setAttribute("style", c ? `background:${c.fill};color:${c.font};` : "");
  const view = cell.querySelector(".acell-view");
  if (view) view.innerHTML = acellView(input.value, mode);
};
// icon shown before a dropdown option (not part of its text); "" when none maps
const optIcon = (cat, val) => (cat === "sinner" ? sinnerIco(val) : icoTag(cat && OPTION_ICONS[cat] && OPTION_ICONS[cat][val]));
// decoration before an option: image icon, or (for grade) the Hebrew glyph
const optDeco = (cat, val) => (cat === "grade"
  ? (GRADE_GLYPH[val] ? `<span class="grade-glyph">${esc(GRADE_GLYPH[val])}</span>` : "")
  : optIcon(cat, val));
// Wrap a generated <select> string into a custom icon dropdown. The native
// <select> stays in the DOM (hidden) as the source of truth + change target, so
// all existing handlers keep working; we only overlay an icon-bearing list.
// summaryDeco: optional icon HTML for the summary (when not derivable from value,
// e.g. ID/EGO pickers whose option value is an index). Options may also carry a
// `data-icon` attribute that the open list/summary will use.
const cselHtml = (selectStr, iconCat, value, colorObj, summaryDeco) => {
  const st = colorObj ? `background:${colorObj.fill};color:${colorObj.font};border-color:${colorObj.fill};` : "";
  const deco = summaryDeco != null ? summaryDeco : optDeco(iconCat, value);
  return `<details class="csel" data-iconcat="${esc(iconCat)}">`
    + `<summary class="csel-sum" style="${st}">${deco}<span class="csel-val">${esc(value)}</span><span class="csel-caret">▾</span></summary>`
    + `<div class="csel-panel"></div>${selectStr}</details>`;
};
// One-time delegated wiring for every custom dropdown (open/fill/select/close).
let cselWired = false;
function initCustomSelects() {
  if (cselWired) return;
  cselWired = true;
  // fill the option list lazily when a dropdown opens (toggle doesn't bubble)
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!(d.tagName === "DETAILS" && d.classList.contains("csel") && d.open)) return;
    document.querySelectorAll("details.csel[open]").forEach((o) => { if (o !== d) o.open = false; });
    const panel = d.querySelector(".csel-panel"), sel = d.querySelector("select");
    if (!panel || !sel || panel.dataset.filled) return;
    const cat = d.dataset.iconcat;
    panel.innerHTML = [...sel.options].map((o) =>
      `<div class="csel-opt${o.value === sel.value ? " on" : ""}" data-val="${esc(o.value)}" style="${o.style.cssText}">`
      + `${o.dataset.sinner ? optIcon("sinner", o.dataset.sinner) : (o.dataset.icon ? icoTag(o.dataset.icon) : optDeco(cat, o.value))}<span>${esc(o.textContent)}</span></div>`).join("");
    panel.dataset.filled = "1";
  }, true);
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".csel-opt");
    if (opt) {
      const d = opt.closest("details.csel"), sel = d.querySelector("select");
      if (sel && sel.value !== opt.dataset.val) {
        sel.value = opt.dataset.val;
        const o = sel.options[sel.selectedIndex], sum = d.querySelector(".csel-sum");
        sum.style.cssText = o.style.cssText + (o.style.backgroundColor ? `;border-color:${o.style.backgroundColor}` : "");
        const deco = o.dataset.sinner ? optIcon("sinner", o.dataset.sinner) : (o.dataset.icon ? icoTag(o.dataset.icon) : optDeco(d.dataset.iconcat, o.value));
        sum.innerHTML = `${deco}<span class="csel-val">${esc(o.textContent)}</span><span class="csel-caret">▾</span>`;
        const p = d.querySelector(".csel-panel"); if (p) p.dataset.filled = ""; // refill (marker/colors) on next open
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      d.open = false;
      return;
    }
    document.querySelectorAll("details.csel[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
}
const fmt = (n) => { if (n == null || n === "") return ""; const r = Math.round(Number(n) * 100) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, ""); };
// Limbus Pass level: no decimals when whole, 1 decimal otherwise.
const fmtPass = (v) => { const n = Number(v); return Number.isInteger(n) ? String(n) : n.toFixed(1); };
// per-<option> inline style for a colour-coded dropdown ({fill, font} | null)
const optStyle = (c) => (c ? ` style="background:${c.fill};color:${c.font}"` : "");
// optColor: optional (o) => {fill,font} to colour-code each option in the list
// iconCat: optional category -> render as a custom icon dropdown (cselHtml)
const selectHtml = (id, options, current, color, optColor, iconCat) => {
  const sel = `<select id="${id}" class="kv-select" style="${color ? `background:${color.fill};color:${color.font};` : ""}">${options.map((o) => `<option${o === current ? " selected" : ""}${optColor ? optStyle(optColor(o)) : ""}>${esc(o)}</option>`).join("")}</select>`;
  return iconCat ? cselHtml(sel, iconCat, current, color) : sel;
};

function toast(lines) {
  if (!lines || !lines.length) return;
  const box = $("#log");
  lines.forEach((line) => {
    const t = el(`<div class="toast">${esc(line)}</div>`);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 2600);
    setTimeout(() => t.remove(), 3100);
  });
}

function markDirty() { dirty = true; const s = $("#saveStatus"); s.textContent = "unsaved"; s.className = "save-status dirty"; }
function markSaved() { dirty = false; const s = $("#saveStatus"); s.textContent = "saved"; s.className = "save-status saved"; }

let saveTimer = null;
function autosave() {
  markDirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}
async function saveNow() {
  try {
    const res = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
    if (res.ok) markSaved(); else markDirty();
  } catch { markDirty(); }
}

// Run a logic action, then refresh + autosave.
function act(fn) {
  const lines = run(state, fn);
  recompute(state);
  renderDashboard();
  renderActions();   // sinner/tier selectors & values may have changed
  renderIDs();       // uptie/threadspin actions can change an ID/EGO's UT/TS level
  renderEGOs();
  toast(lines.length ? lines : ["Done"]);
  autosave();
}

// Set a dotted state path (supports array indices, e.g. "sinners.3.shards").
function setByPath(obj, path, val) {
  const p = path.split(".");
  let o = obj;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  o[p[p.length - 1]] = val;
}
const getByPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
// Delegated handler for editable number inputs on the Dashboard (data-path).
function dashboardEdit(e) {
  const t = e.target;
  if (!t.dataset || !t.dataset.path) return;
  setByPath(state, t.dataset.path, t.value === "" ? 0 : Number(t.value));
  recompute(state);
  renderDashboard();
  autosave();
}

// Update a dotted state path (e.g. "uptie.sinner") and keep the Dashboard
// Status card and the Quick Buttons selectors in sync, then save.
function setSelection(path, value) {
  const [a, b] = path.split(".");
  state[a][b] = value;
  renderDashboard();
  renderActions();
  renderEventShop();   // event currency is shown here too
  autosave();
}

// ---------- dashboard ----------
function renderDashboard() {
  const s = state;
  const free = s.lunacy.total - s.lunacy.paid;
  const pct = Math.max(0, Math.min(100, (s.manager.currentXP / s.manager.nextLevelXP) * 100));
  const t = s.inventory.tickets;
  // does the next manager level grant +1 max enkephalin? (sheet K9)
  const nextEnkRow = s.constants.managerCurve.find((r) => r.level === s.manager.level + 1);
  const nextEnk = nextEnkRow && nextEnkRow.maxIncrease !== 0 ? "+1" : "0";

  const kv = (rows) => rows.map(([k, v, big]) => `<div class="k">${esc(k)}</div><div class="v${big ? " big" : ""}">${esc(fmt(v))}</div>`).join("");
  // editable number row (writes to a dotted state path on change); optional colour + icon
  const erow = (label, path, val, big, color, ico) => {
    const st = color ? `background:${color.fill};color:${color.font};` : "";
    return `<div class="k" style="${st}">${ico ? icoTag(ico, color ? invertHex(color.fill) : null) : ""}${esc(label)}</div><div class="v${big ? " big" : ""}"><input type="number" class="kv-num" data-path="${path}" value="${val ?? ""}" style="${st}"/></div>`;
  };
  const invColor = (path) => {
    const m = /^inventory\.tickets\.(\w+)$/.exec(path);   // tickets get their editable colour from constants.tickets
    if (m && state.constants && state.constants.tickets) {
      const row = state.constants.tickets.find((t) => t.tier === m[1]);
      if (row && row.color) return fillColor(row.color);
    }
    return fillColor(INVENTORY_FILL[path.replace("inventory.", "")]);
  };
  // colored read-only row (e.g. derived Free Lunacy)
  const srow = (label, val, big, color, ico) => { const st = color ? `background:${color.fill};color:${color.font};` : ""; return `<div class="k" style="${st}">${ico ? icoTag(ico, color ? invertHex(color.fill) : null) : ""}${esc(label)}</div><div class="v${big ? " big" : ""}" style="${st}">${esc(fmt(val))}</div>`; };
  const checks = (arr, labels) => arr.map((on, i) => `<span class="pill ${on ? "on" : "off"}">${esc(labels[i])}</span>`).join("");

  $("#dashboard").innerHTML = `
    <div class="grid">
      <div class="card">
        <h2>Manager</h2>
        <div class="body">
          <div class="kv">
            ${erow("Level", "manager.level", s.manager.level, true)}
            ${erow("Current XP", "manager.currentXP", s.manager.currentXP)}
            ${kv([["Next Level XP", s.manager.nextLevelXP]])}
          </div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="bar-label">${fmt(s.manager.currentXP)} / ${fmt(s.manager.nextLevelXP)} (${pct.toFixed(1)}%)</div>
          <div class="kv" style="margin-top:8px;"><div class="k">Next Level Enkephalin</div><div class="v">${esc(nextEnk)}</div></div>
        </div>
      </div>

      <div class="card">
        <h2>Inventory</h2>
        <div class="body"><div class="kv">
          ${erow("Crates", "inventory.crate", s.inventory.crate, true, invColor("inventory.crate"))}
          ${erow("Limbus Pass Lv", "inventory.pass", fmtPass(s.inventory.pass), false, invColor("inventory.pass"))}
          ${erow("Threads", "inventory.threads", s.inventory.threads, false, invColor("inventory.threads"), RESOURCE_ICON.thread)}
          ${erow("IV Ticket", "inventory.tickets.IV", t.IV, false, invColor("inventory.tickets.IV"), RESOURCE_ICON.IV)}
          ${erow("III Ticket", "inventory.tickets.III", t.III, false, invColor("inventory.tickets.III"), RESOURCE_ICON.III)}
          ${erow("II Ticket", "inventory.tickets.II", t.II, false, invColor("inventory.tickets.II"), RESOURCE_ICON.II)}
          ${erow("I Ticket", "inventory.tickets.I", t.I, false, invColor("inventory.tickets.I"), RESOURCE_ICON.I)}
        </div></div>
      </div>

      <div class="card">
        <h2>Lunacy & Pulls</h2>
        <div class="body"><div class="kv kv-narrow">
          ${erow("Total Lunacy", "lunacy.total", s.lunacy.total, true, fillColor(LUNACY_FILL.lunacy), RESOURCE_ICON.lunacy)}
          ${erow("Paid Lunacy", "lunacy.paid", s.lunacy.paid, false, fillColor(LUNACY_FILL.lunacy), RESOURCE_ICON.lunacy)}
          ${srow("Free Lunacy", free, false, fillColor(LUNACY_FILL.lunacy), RESOURCE_ICON.lunacy)}
          ${erow("Extraction Tickets", "lunacy.extTickets", s.lunacy.extTickets, false, fillColor(LUNACY_FILL.ticket), RESOURCE_ICON.extraction)}
          ${erow("Deca Tickets", "lunacy.decaTickets", s.lunacy.decaTickets, false, fillColor(LUNACY_FILL.ticket), RESOURCE_ICON.deca)}
        </div></div>
      </div>

      <div class="card">
        <h2>Mirror Dungeon</h2>
        <div class="body">
          <div class="kv">
            ${srow("Daily left", s.md.dailyLeft, false, fillColor(DAILY_LEFT_FILL[s.md.dailyLeft]))}
            ${srow("Weekly left", s.md.weeklyLeft, false, fillColor(WEEKLY_LEFT_FILL[s.md.weeklyLeft]))}
            ${kv([
              ["Normal left total", s.md.normalLeftTotal],
              ["Week til Season end", s.weekTilSeasonEnd],
            ])}
          </div>
          <div class="subhead">Hard MD</div>
          <div class="checks">${s.md.hard.map((on, i) => mdPill(on, (s.md.hardStatus || [])[i] || `${i + 1} Hard`)).join("")}</div>
          <div class="subhead">Normal MD</div>
          <div class="checks">${s.md.normal.map((on, i) => mdPill(on, (s.md.normalStatus || [])[i] || `${i + 1} Norm`)).join("")}
            <span class="mdpill ${s.md.rental ? "" : "done"}">Rental</span></div>
        </div>
      </div>

      <div class="card">
        <h2>Status</h2>
        <div class="body">
          <div class="kv">
            <div class="k">Current Day</div><div class="v"><span class="tag" style="${styleAttr(dayColor(s.currentDay))}">${esc(s.currentDay)}</span></div>
            <div class="k">Current Patch</div><div class="v">${esc(s.lunacy.currentDate)}</div>
            <div class="k">Uptying Sinner</div><div class="v">${selectHtml("st-uptie", SINNER_ORDER, s.uptie.sinner, sinnerColor(s.uptie.sinner), sinnerColor, "sinner")}</div>
            <div class="k">Gacha Sinner</div><div class="v">${selectHtml("st-gsinner", SINNER_ORDER, s.gacha.sinner, sinnerColor(s.gacha.sinner), sinnerColor, "sinner")}</div>
            <div class="k">Gacha Tier</div><div class="v">${selectHtml("st-gtier", GACHA_TIERS, s.gacha.tier, gachaTierColor(s.gacha.tier), gachaTierColor, "tier")}</div>
            <div class="k">Rental Week</div><div class="v">${fmt(s.md.rentalWeek)}</div>
            <div class="k">Event Currency</div><div class="v"><input type="number" class="qty" id="st-currency" value="${fmt(s.event.currency)}"/></div>
          </div>
          <div class="btnrow" style="margin-top:10px;">
            <button class="act primary" id="st-applyGacha" title="Add a shard to the Gacha Sinner at the Gacha Tier">Apply Gacha Shard</button>
          </div>
          <div class="hint">These feed the Gacha &amp; Uptying Quick Buttons.</div>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Sinner Shards</h2>
        <div class="body" style="padding:0;">
          <table class="sheet">
            <thead><tr><th>Sinner</th>${SINNER_ORDER.map((n) => { const ac = state.sinners.find((x) => x.name === n)?.acronym || n; return `<th style="${styleAttr(sinnerColor(n))}" title="${esc(n)}"><div class="shard-hdr">${optIcon("sinner", n) || esc(ac)}<span>${esc(n)}</span></div></th>`; }).join("")}</tr></thead>
            <tbody><tr><td style="white-space:nowrap">${icoTag(RESOURCE_ICON.egoshard)}Shards</td>${SINNER_ORDER.map((n) => {
              const i = state.sinners.findIndex((x) => x.name === n);
              const sh = state.sinners[i]?.shards ?? 0;
              return `<td class="num${sh < 50 ? " shard-low-cell" : ""}" title="${sh < 50 ? "Low shards (<50)" : ""}"><input type="number" class="kv-num" data-path="sinners.${i}.shards" value="${sh}" style="${styleAttr(sinnerColor(n))}"/></td>`;
            }).join("")}</tr></tbody>
          </table>
        </div>
      </div>
    </div>
    <h2 class="section-title">Projections</h2>
    <div id="forecast"></div>`;

  // Status-card dropdowns (sync with the Quick Buttons selectors)
  const wire = (id, path) => { const e = $("#" + id); if (e) e.addEventListener("change", (ev) => setSelection(path, ev.target.value)); };
  wire("st-uptie", "uptie.sinner");
  wire("st-gsinner", "gacha.sinner");
  wire("st-gtier", "gacha.tier");
  const cur = $("#st-currency");
  if (cur) cur.addEventListener("change", (ev) => setSelection("event.currency", Number(ev.target.value) || 0));
  const ag = $("#st-applyGacha");
  if (ag) ag.addEventListener("click", () => act(ACTIONS.gachaSelected));

  renderForecast();
}

// ---------- forecasts / projections ----------
function renderForecast() {
  const s = state;
  const mf = managerForecast(s);
  const rf = resourceForecast(s);
  const plan = shardPlanRows(s);
  // Shard-plan target list: the un-owned IDs + EGOs you'd shard toward (mirrors the
  // sheet's Extraction + Need-to-Shard lists = everything not acquired).
  const targetSeen = new Set(), targetList = [];
  [...s.ids, ...s.egos].forEach((x) => {
    if (x.acquired || !x.name) return;
    const label = `[${x.name}] ${x.sinner}`;
    if (!targetSeen.has(label)) { targetSeen.add(label); targetList.push({ label, sinner: x.sinner }); }
  });
  const targetSinner = (label) => (targetList.find((o) => o.label === label) || {}).sinner;
  // colour-coded sinner-icon dropdown (like the calculator pickers); only the
  // row's own sinner's un-owned IDs/EGOs are listed
  const targetSelect = (idx, df, sel, sinnerName, ut) => {
    const opts = `<option${!sel ? " selected" : ""}></option>`
      + targetList.filter((o) => o.sinner === sinnerName).map((o) => `<option${o.label === sel ? " selected" : ""}${optStyle(sinnerColor(o.sinner))} data-sinner="${esc(o.sinner)}">${esc(o.label)}</option>`).join("");
    const sn = targetSinner(sel);
    const picker = cselHtml(`<select data-i="${idx}" data-f="${df}">${opts}</select>`, "sinner", sel || "", sn ? sinnerColor(sn) : null, sn ? optIcon("sinner", sn) : "");
    const toggle = `<button type="button" class="ut-toggle${ut ? " on" : ""}" data-i="${idx}" data-f="${df}UT" title="Uptie target / not">${ut ? "Uptie" : "No UT"}</button>`;
    return picker + toggle;
  };
  const kv = (rows) => rows.map(([k, v, big]) => `<div class="k">${esc(k)}</div><div class="v${big ? " big" : ""}">${esc(fmt(v))}</div>`).join("");
  // level-up marker: shown next to any forecast value that reaches next-level XP
  const lvlGlyph = (on) => (on ? ` <span class="lvlup" title="reaches next level">▲</span>` : "");

  $("#forecast").innerHTML = `
    <div class="grid">
      <div class="card">
        <h2>Manager XP Forecast</h2>
        <div class="body" style="padding:0;">
          <table class="sheet">
            <thead><tr><th>Run</th><th style="white-space:nowrap">After N Daily</th><th style="white-space:nowrap">after MD</th></tr></thead>
            <tbody>${mf.rows.map((r) => `<tr><td style="white-space:nowrap">${r.n} Daily</td><td class="num">${fmt(r.afterDaily)}${lvlGlyph(r.dailyLevels)}</td><td class="num"><span class="mdtype ${r.mdHard ? "h" : "n"}" title="${r.mdHard ? "Hard MD (+120)" : "Normal/Rental MD (+100)"}">${r.mdHard ? "H" : "N"}</span> ${fmt(r.afterMD)} <span class="count">(+${r.cumMD})</span>${lvlGlyph(r.mdLevels)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <div class="body"><div class="kv">${kv([["Next Level XP", mf.nextLevelXP], ["Next Lvl Enkephalin", mf.enk]])}</div></div>
      </div>

      <div class="card">
        <h2>Crate Forecast</h2>
        <div class="body"><div class="kv">${kv([
          ["Crate Required", rf.crate.required],
          ["Crate Possessed", rf.crate.possessed],
          ["Crate to Grind", rf.crate.toGrind, true],
          ["This Week Projection", rf.crate.thisWeek],
          ["Final Projection", rf.crate.final],
          ["000 Capable now", rf.crate.cap000Now],
          ["000 Capable season-end", rf.crate.cap000End],
        ])}</div></div>
      </div>

      <div class="card">
        <h2>Pass Level Forecast</h2>
        <div class="body"><div class="kv">${kv([
          ["Current Pass Level", rf.pass.current],
          ["Will Gain (to season end)", rf.pass.willGain, true],
          ["Final Pass Level", rf.pass.final],
          ["This Week Projection", rf.pass.thisWeek],
          ["Pass Level Requirement", rf.pass.requirement],
          ["Pass Level Goal", rf.pass.goal],
        ])}</div></div>
      </div>

      <div class="card" id="idlevel-card">
        <h2>ID Leveling Calculator</h2>
        <div class="body" id="idlevel-body"></div>
      </div>

      <div class="card" id="egots-card">
        <h2>EGO Threadspinning Calculator</h2>
        <div class="body" id="egots-body"></div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Shard Planning <span class="count">(set Type &amp; Enabled — Needed/Owned/Crate/Thread are derived, and roll up into the Crate Forecast)</span></h2>
        <div class="body" style="padding:0;">
          <table class="sheet" id="planTable">
            <thead><tr><th>Sinner</th><th>Shard Type</th><th>On</th><th class="num">Needed</th><th class="num">Owned</th><th class="num">Short</th><th class="num">Crate Need</th><th class="num">Thread Need</th><th>Target</th></tr></thead>
            <tbody>${plan.map((p) => `
              <tr class="${p.enabled ? "" : "disabled"}">
                <td style="${styleAttr(sinnerColor(p.sinner))}">${optIcon("sinner", p.sinner)}${esc(p.sinner)}</td>
                <td><select data-i="${p.index}" data-f="type" style="${styleAttr(shardTypeColor(p.type))}">${SHARD_TYPES(s).map((t) => `<option${t === p.type ? " selected" : ""}${optStyle(shardTypeColor(t))}>${esc(t)}</option>`).join("")}</select></td>
                <td style="text-align:center"><input type="checkbox" data-i="${p.index}" data-f="enabled" ${p.enabled ? "checked" : ""}/></td>
                <td class="num">${fmt(p.shardNeeded)}</td>
                <td class="num">${fmt(p.shardsOwned)}</td>
                <td class="num ${p.shardShort > 0 ? "shard-low" : "shard-ok"}">${fmt(p.shardShort)}</td>
                <td class="num">${fmt(p.crateNeeded)}</td>
                <td class="num">${fmt(p.threadNeeded)}</td>
                <td>${(() => {
                  const m = p.targetMode || "text";
                  const modeSel = `<select data-i="${p.index}" data-f="targetMode">${[["text", "Text"], ["one", "1 ID/EGO"], ["two", "2 ID/EGO"]].map(([v, l]) => `<option value="${v}"${v === m ? " selected" : ""}>${l}</option>`).join("")}</select>`;
                  const body = m === "one" ? targetSelect(p.index, "targetA", p.targetA, p.sinner, p.targetAUT)
                    : m === "two" ? targetSelect(p.index, "targetA", p.targetA, p.sinner, p.targetAUT) + targetSelect(p.index, "targetB", p.targetB, p.sinner, p.targetBUT)
                    : `<input type="text" data-i="${p.index}" data-f="target" value="${esc(p.target)}"/>`;
                  return `<div class="target-cell">${modeSel}${body}</div>`;
                })()}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  // shard-plan edits: type select + enabled checkbox are the only inputs
  $("#planTable").querySelectorAll("select, input").forEach((node) => {
    node.addEventListener("change", (e) => {
      const i = +e.target.dataset.i, f = e.target.dataset.f;
      state.shardPlan[i][f] = f === "enabled" ? e.target.checked : e.target.value;
      renderDashboard();     // re-runs renderForecast(): recompute derived cells + rollups
      autosave();
    });
  });
  // Uptie / No UT toggle next to each target picker
  $("#planTable").addEventListener("click", (e) => {
    const b = e.target.closest(".ut-toggle");
    if (!b) return;
    const i = +b.dataset.i, f = b.dataset.f;
    state.shardPlan[i][f] = !state.shardPlan[i][f];
    renderDashboard();
    autosave();
  });

  renderIdLeveling();
  renderEgoThreadspin();
}

function renderIdLeveling() {
  if (idLevelSel.idx == null && state.ids.length) {
    // default to a leveled, owned ID; else first owned (the list is owned-only)
    let i = state.ids.findIndex((x) => x.acquired && x.level);
    if (i < 0) i = state.ids.findIndex((x) => x.acquired);
    idLevelSel.idx = i >= 0 ? i : 0;
  }
  const res = idLeveling(state, idLevelSel.idx, idLevelSel.target);
  const body = $("#idlevel-body");
  if (!body) return;
  const selId = state.ids[idLevelSel.idx];
  const selSt = styleAttr(selId ? sinnerColor(selId.sinner) : null);   // ID dropdown -> sinner colour
  const lvlSt = res ? styleAttr(levelColor(res.current)) : "";          // current level -> bracket
  const tgtSt = styleAttr(levelColor(idLevelSel.target));
  const ticketRows = res ? ["IV", "III", "II", "I"].map((tier) => {
    const st = styleAttr(fillColor(INVENTORY_FILL["tickets." + tier]));
    return `<div class="k" style="${st}">${icoTag(RESOURCE_ICON[tier])}Ticket ${tier}</div><div class="v" style="${st}">${fmt(res.need[tier])} <span class="count">(${fmt(res.left[tier])} left)</span></div>`;
  }).join("") : "";
  body.innerHTML = `
    <div class="field"><label>ID</label>
      ${cselHtml(
        `<select id="idlevel-name" style="${selSt}">${state.ids.map((x, i) => [x, i]).filter(([x]) => x.acquired).map(([x, i]) => `<option value="${i}"${i === idLevelSel.idx ? " selected" : ""}${optStyle(sinnerColor(x.sinner))} data-sinner="${esc(x.sinner)}">[${esc(x.name)}] ${esc(x.sinner)}</option>`).join("")}</select>`,
        "sinner", selId ? `[${selId.name}] ${selId.sinner}` : "", selId ? sinnerColor(selId.sinner) : null, selId ? optIcon("sinner", selId.sinner) : "")}</div>
    <div class="field"><label>Target Lv</label>
      <input type="number" id="idlevel-target" class="qty" min="1" max="100" value="${idLevelSel.target}" style="${tgtSt}"/></div>
    <div class="kv" style="margin-top:6px;">
      <div class="k" style="${lvlSt}">Current Level</div><div class="v" style="${lvlSt}">${res ? fmt(res.current) : "—"}</div>
      <div class="k">Level Extra XP</div><div class="v">${res ? fmt(res.levelExtra) : "—"}</div>
      <div class="k">XP Needed</div><div class="v big">${res ? fmt(res.xpNeeded) : "—"}</div>
    </div>
    <div class="subhead">EXP Tickets needed</div>
    <div class="kv">${ticketRows}</div>`;
  $("#idlevel-name").addEventListener("change", (e) => { idLevelSel.idx = +e.target.value; renderIdLeveling(); });
  $("#idlevel-target").addEventListener("change", (e) => { idLevelSel.target = Number(e.target.value) || 1; renderIdLeveling(); });
}

function renderEgoThreadspin() {
  if (egoTSel.idx == null && state.egos.length) {
    const i = state.egos.findIndex((x) => x.acquired);
    egoTSel.idx = i >= 0 ? i : 0;
  }
  const res = egoThreadspin(state, egoTSel.idx, egoTSel.target);
  const body = $("#egots-body");
  if (!body) return;
  const selEgo = state.egos[egoTSel.idx];
  const selSt = styleAttr(selEgo ? sinnerColor(selEgo.sinner) : null);  // EGO dropdown -> sinner colour
  const gradeSt = res ? styleAttr(shardTypeColor(res.grade)) : "";       // grade -> ZAYIN/TETH/HE/WAW colour
  const curSt = res ? styleAttr(scaleColor(res.currentNum)) : "";
  body.innerHTML = `
    <div class="field"><label>EGO</label>
      ${cselHtml(
        `<select id="egots-name" style="${selSt}">${state.egos.map((x, i) => [x, i]).filter(([x]) => x.acquired).map(([x, i]) => `<option value="${i}"${i === egoTSel.idx ? " selected" : ""}${optStyle(sinnerColor(x.sinner))} data-sinner="${esc(x.sinner)}">[${esc(x.name)}] ${esc(x.sinner)}</option>`).join("")}</select>`,
        "sinner", selEgo ? `[${selEgo.name}] ${selEgo.sinner}` : "", selEgo ? sinnerColor(selEgo.sinner) : null, selEgo ? optIcon("sinner", selEgo.sinner) : "")}</div>
    <div class="field"><label>Target TS</label>
      <input type="number" id="egots-target" class="qty" min="1" max="5" value="${egoTSel.target}"/></div>
    <div class="kv" style="margin-top:6px;">
      <div class="k">Grade</div><div class="v" style="${gradeSt}">${res ? esc(res.grade || "—") : "—"}</div>
      <div class="k">Current TS</div><div class="v" style="${curSt}">${res ? esc(res.current ?? "—") : "—"}</div>
      <div class="k">${icoTag(RESOURCE_ICON.thread)}Threads Needed</div><div class="v big">${res ? fmt(res.threads) : "—"}</div>
      <div class="k">${icoTag(RESOURCE_ICON.thread)}Threads Left After</div><div class="v">${res ? fmt(res.threadsLeft) : "—"}</div>
      <div class="k">${icoTag(RESOURCE_ICON.egoshard)}EGO Shard Needed</div><div class="v">${res ? fmt(res.shard) : "—"}</div>
      <div class="k">${icoTag(RESOURCE_ICON.egoshard)}${res ? esc(res.sinner) : ""} Shard Left After</div><div class="v" style="${selSt}">${res ? fmt(res.shardLeft) : "—"}</div>
      ${res && res.spinchain ? `<div class="k">${icoTag(RESOURCE_ICON.spinchain)}Spinchain Needed (TS5)</div><div class="v big">${fmt(res.spinchain)}</div>
      <div class="k">${icoTag(RESOURCE_ICON.egoshard)}= EGO Shard (1:1)</div><div class="v">${fmt(res.scShard)}</div>
      <div class="k">${icoTag(RESOURCE_ICON.thread)}= Thread (2:1)</div><div class="v">${fmt(res.scThread)}</div>` : ""}
    </div>`;
  $("#egots-name").addEventListener("change", (e) => { egoTSel.idx = +e.target.value; renderEgoThreadspin(); });
  $("#egots-target").addEventListener("change", (e) => { egoTSel.target = Number(e.target.value) || 1; renderEgoThreadspin(); });
}

// ---------- Intervallo event shop (editable planner) ----------
function renderEventShop() {
  const root = $("#eventshop");
  if (!root) return;
  const es = eventShop(state);
  const e = state.event;

  root.innerHTML = `
    <div class="grid">
      <div class="card">
        <h2>Event Summary</h2>
        <div class="body">
          <div class="field"><label>Reward Type</label>${selectHtml("ev-rtype", REWARD_TYPES, e.rewardType)}</div>
          <div class="kv" style="margin-top:10px;">
            <div class="k">Currency Required</div><div class="v big">${fmt(es.required)}</div>
            <div class="k">Currency Needed <span class="count">(skip Banner+Ticket)</span></div><div class="v">${fmt(es.needed)}</div>
            <div class="k">Current Currency</div><div class="v"><input type="number" class="qty" id="ev-currency" value="${fmt(es.currency)}"/></div>
            <div class="k">Still Short (Required)</div><div class="v ${es.shortRequired > 0 ? "shard-low" : "shard-ok"}">${fmt(es.shortRequired)}</div>
            <div class="k">Still Short (Needed)</div><div class="v ${es.shortNeeded > 0 ? "shard-low" : "shard-ok"}">${fmt(es.shortNeeded)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Shop Items <span class="count">(enter Cost/Total per event; Bought as you buy)</span></h2>
        <div class="body" style="padding:0;">
          <table class="sheet">
            <thead><tr><th>Item</th><th class="num">Cost/Unit</th><th class="num">Total</th><th class="num">Bought</th><th class="num">Remaining</th><th class="num">Currency to Finish</th></tr></thead>
            <tbody>${es.items.map((it, i) => `
              <tr>
                <td style="${styleAttr(fillColor(EVENT_ITEM_FILL[it.name]))}">${esc(it.name)}</td>
                <td class="num"><input type="number" class="qty" data-t="items" data-i="${i}" data-f="cost" value="${fmt(it.cost)}"/></td>
                <td class="num"><input type="number" class="qty" data-t="items" data-i="${i}" data-f="total" value="${fmt(it.total)}"/></td>
                <td class="num"><input type="number" class="qty" data-t="items" data-i="${i}" data-f="bought" value="${fmt(it.bought)}"/></td>
                <td class="num">${fmt(it.remaining)}</td>
                <td class="num ${it.toFinish > 0 ? "shard-low" : "shard-ok"}">${fmt(it.toFinish)}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>One-time Rewards</h2>
        <div class="body" style="padding:0;">
          <table class="sheet">
            <thead><tr><th>Reward</th><th class="num">Cost</th><th>Claimed</th><th class="num">Currency Due</th></tr></thead>
            <tbody>${es.rewards.map((r, i) => `
              <tr class="${r.claimed ? "disabled" : ""}">
                <td style="${styleAttr(fillColor(EVENT_REWARD_FILL[r.name]))}">${esc(r.name)}</td>
                <td class="num">${i === 0
                  ? `${fmt(r.cost)} <span class="count">(by type)</span>`
                  : `<input type="number" class="qty" data-t="rewards" data-i="${i}" data-f="cost" value="${fmt(r.cost)}"/>`}</td>
                <td style="text-align:center"><input type="checkbox" data-t="rewards" data-i="${i}" data-f="claimed" ${r.claimed ? "checked" : ""}/></td>
                <td class="num ${r.due > 0 ? "shard-low" : "shard-ok"}">${fmt(r.due)}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  $("#ev-rtype").addEventListener("change", (ev) => { state.event.rewardType = ev.target.value; renderEventShop(); autosave(); });
  $("#ev-currency").addEventListener("change", (ev) => setSelection("event.currency", Number(ev.target.value) || 0));
  root.querySelectorAll("input[data-t]").forEach((node) => {
    node.addEventListener("change", (ev) => {
      const t = ev.target.dataset.t, i = +ev.target.dataset.i, f = ev.target.dataset.f;
      state.event[t][i][f] = f === "claimed" ? ev.target.checked : (Number(ev.target.value) || 0);
      renderEventShop();
      autosave();
    });
  });
}

// ---------- actions ----------
function btn(label, handler, cls = "") {
  const b = el(`<button class="act ${cls}">${esc(label)}</button>`);
  b.addEventListener("click", handler);
  return b;
}

function renderActions() {
  const root = $("#actions");
  root.innerHTML = `<div class="panels" id="panels"></div>`;
  const panels = $("#panels", root);

  const panel = (title) => {
    const p = el(`<div class="panel"><h3>${esc(title)}</h3><div class="body"></div></div>`);
    panels.appendChild(p);
    return $(".body", p);
  };
  const row = (parent) => { const r = el(`<div class="btnrow"></div>`); parent.appendChild(r); return r; };

  // colour-coded sinner-icon ID/EGO picker (same look as the calculators); `filter`
  // picks which rows are listed; `onPick(index)` gets the chosen array index.
  const idPicker = (label, arr, curIdx, filter, onPick) => {
    const cur = arr[curIdx];
    const sel = `<select>${arr.map((x, i) => [x, i]).filter(([x]) => filter(x)).map(([x, i]) => `<option value="${i}"${i === curIdx ? " selected" : ""}${optStyle(sinnerColor(x.sinner))} data-sinner="${esc(x.sinner)}">[${esc(x.name)}] ${esc(x.sinner)}</option>`).join("")}</select>`;
    const node = el(`<div class="field"><label>${esc(label)}</label>${cselHtml(sel, "sinner", cur ? `[${cur.name}] ${cur.sinner}` : "", cur ? sinnerColor(cur.sinner) : null, cur ? optIcon("sinner", cur.sinner) : "")}</div>`);
    node.querySelector("select").addEventListener("change", (e) => onPick(+e.target.value));
    return node;
  };
  const isOwned = (x) => x.acquired;
  // F13/F14 "Extractible" list: not-owned, named, not from a limited source.
  const isExtractible = (x) => !x.acquired && x.name && !/Event|Reward|Bokgak|BP/i.test(x.season || "");
  const firstIdx = (arr, f) => { const i = arr.findIndex(f); return i >= 0 ? i : 0; };

  // Daily
  let b = panel("Daily");
  let r = row(b);
  r.append(
    btn("Full Daily Schedule", () => act(ACTIONS.fullCourse), "primary"),
    btn("Day Update", () => act(ACTIONS.cmenuDayUpdate)),
  );

  // Gacha Gained: mark a newly-pulled (not-owned, extractible) ID/EGO as acquired
  b = panel("Gacha Gained");
  const validGain = (arr, idx) => arr[idx] && isExtractible(arr[idx]);
  if (!validGain(state.ids, state.gacha.gainIdIdx)) state.gacha.gainIdIdx = firstIdx(state.ids, isExtractible);
  if (!validGain(state.egos, state.gacha.gainEgoIdx)) state.gacha.gainEgoIdx = firstIdx(state.egos, isExtractible);
  b.appendChild(idPicker("ID", state.ids, state.gacha.gainIdIdx, isExtractible, (i) => { state.gacha.gainIdIdx = i; renderActions(); }));
  r = row(b);
  r.append(btn("Acquired", () => act((s) => ACTIONS.acquireId(s, s.gacha.gainIdIdx)), "primary"));
  b.appendChild(idPicker("EGO", state.egos, state.gacha.gainEgoIdx, isExtractible, (i) => { state.gacha.gainEgoIdx = i; renderActions(); }));
  r = row(b);
  r.append(btn("Acquired", () => act((s) => ACTIONS.acquireEgo(s, s.gacha.gainEgoIdx)), "primary"));

  // Manager XP
  b = panel("Manager XP");
  r = row(b);
  r.append(
    btn("Daily Luxcavation", () => act(ACTIONS.addDailyXP), "primary"),
    btn("1 Normal MD", () => act(ACTIONS.addNMDXP)),
    btn("1 Weekly Hard MD", () => act(ACTIONS.addWBMDXP)),
    btn("3 Hard MD at once", () => act(ACTIONS.add3HMD)),
    btn("1 Weekly Normal MD", () => act(ACTIONS.addwNormal)),
  );
  b.appendChild(el(`<div class="subhead">Undo</div>`));
  r = row(b);
  r.append(
    btn("Undo Daily Lux", () => act(ACTIONS.undoDailyXP), "undo"),
    btn("Undo Normal MD", () => act(ACTIONS.undoNMDXP), "undo"),
    btn("Undo Weekly Hard MD", () => act(ACTIONS.undoWBMDXP), "undo"),
    btn("Undo 3 Hard MD", () => act(ACTIONS.undo3HMD), "undo"),
    btn("Undo Weekly Normal MD", () => act(ACTIONS.undowNormal), "undo"),
  );

  // Gacha
  b = panel("Sinner Gacha Result");
  const gTierSel = `<select style="${styleAttr(gachaTierColor(state.gacha.tier))}">${GACHA_TIERS.map((t) => `<option ${t === state.gacha.tier ? "selected" : ""}${optStyle(gachaTierColor(t))}>${esc(t)}</option>`).join("")}</select>`;
  const gTier = el(`<div class="field"><label>Tier</label>${cselHtml(gTierSel, "tier", state.gacha.tier, gachaTierColor(state.gacha.tier))}</div>`);
  gTier.querySelector("select").addEventListener("change", (e) => setSelection("gacha.tier", e.target.value));
  const gSinnerSel = `<select style="${styleAttr(sinnerColor(state.gacha.sinner))}">${SINNER_ORDER.map((n) => `<option ${n === state.gacha.sinner ? "selected" : ""}${optStyle(sinnerColor(n))}>${esc(n)}</option>`).join("")}</select>`;
  const gSinner = el(`<div class="field"><label>Sinner</label>${cselHtml(gSinnerSel, "sinner", state.gacha.sinner, sinnerColor(state.gacha.sinner))}</div>`);
  gSinner.querySelector("select").addEventListener("change", (e) => setSelection("gacha.sinner", e.target.value));
  b.append(gTier, gSinner);
  r = row(b);
  r.append(btn("Apply to Selected Sinner", () => act(ACTIONS.gachaSelected), "primary"));
  b.appendChild(el(`<div class="subhead">Quick add (uses tier above)</div>`));
  // one colour-coded button per sinner, in DataSheet order, split YS..HL / HC..GG
  const qaBtn = (n) => {
    const ac = state.sinners.find((x) => x.name === n)?.acronym || n;
    const bn = btn(ac, () => act((s) => ACTIONS.gachaFor(s, n)), "qa-sinner");
    const ico = optIcon("sinner", n);
    if (ico) bn.innerHTML = ico;   // sinner icon (w/ inverted-colour shadow) instead of text
    bn.title = n;
    const c = sinnerColor(n);
    if (c) bn.style.cssText = `background:${c.fill};color:${c.font};border-color:${c.fill};`;
    return bn;
  };
  const qaR1 = row(b); SINNER_ORDER.slice(0, 6).forEach((n) => qaR1.append(qaBtn(n)));
  const qaR2 = row(b); SINNER_ORDER.slice(6).forEach((n) => qaR2.append(qaBtn(n)));

  // Extractions / Lunacy
  b = panel("Extractions (Lunacy)");
  r = row(b);
  Object.keys(LUNACY_ACTIONS).forEach((k) => r.append(btn(LUNACY_ACTIONS[k].label, () => act((s) => ACTIONS.lunacy(s, k)))));
  const cpl = el(`<div class="field"><label>Custom</label><input type="number" class="qty" id="cpl" placeholder="paid"/></div>`);
  b.appendChild(cpl);
  r = row(b);
  r.append(btn("Add Paid Lunacy", () => act((s) => ACTIONS.customPaidLunacy(s, $("#cpl").value))));

  // Pulls
  b = panel("Pulls");
  r = row(b);
  r.append(
    btn("Single Pull", () => act(ACTIONS.pull1Pull)),
    btn("10-Pull", () => act(ACTIONS.pull10Pulls), "primary"),
  );
  const pc = el(`<div class="field"><label>Custom</label><input type="number" class="qty" id="pc" placeholder="# pulls"/></div>`);
  b.appendChild(pc);
  r = row(b);
  r.append(btn("Pull Custom Amount", () => act((s) => ACTIONS.pullingCustom(s, $("#pc").value))));

  // Tickets
  b = panel("Tickets");
  r = row(b);
  Object.keys(TICKET_ACTIONS).forEach((k) => r.append(btn(TICKET_ACTIONS[k].label, () => act((s) => ACTIONS.ticket(s, k)))));
  const ct = el(`<div class="field"><label>Custom</label><input type="number" class="qty" id="ct" placeholder="# ext"/></div>`);
  b.appendChild(ct);
  r = row(b);
  r.append(btn("Add Ext Tickets", () => act((s) => ACTIONS.customTickets(s, $("#ct").value))));

  // Uptie
  b = panel("Uptying (sets the ID's UT level)");
  if (state.uptie.idIdx == null) { const i = state.ids.findIndex((x) => x.acquired); state.uptie.idIdx = i >= 0 ? i : 0; }
  b.appendChild(idPicker("ID", state.ids, state.uptie.idIdx, isOwned, (i) => { state.uptie.idIdx = i; setSelection("uptie.sinner", state.ids[i].sinner); }));
  r = row(b);
  // show only the UT options that match the ID's rarity AND still advance it
  const uId2 = state.ids[state.uptie.idIdx], uStars = uId2?.tierStars, uCur = Number(uId2?.uptie) || 1;
  Object.keys(UPTIE).filter((k) => {
    const e = UPTIE[k];
    if (e.stars !== 0 && uStars != null && e.stars !== uStars) return false;   // wrong rarity
    if (e.from != null) return uCur === e.from;                                // "from UT1" / module
    return uCur < UPTIE_LEVEL[k];                                              // step would advance the ID
  }).forEach((k) => {
    const bn = btn("", () => act((s) => ACTIONS.uptie(s, k)));
    const starIco = UPTIE[k].stars ? icoTag(OPTION_ICONS.tier["★".repeat(UPTIE[k].stars)]) : "";
    // rarity icon for the 0/00/000 prefix; thread icon by (N); EGO shard icon by "+N Shard"
    bn.innerHTML = starIco + esc(UPTIE[k].label.replace(/^0+\s*/, ""))
      .replace(/\((\d+)\)/, (m, n) => `(${icoTag(RESOURCE_ICON.thread)}${n})`)
      .replace(/\+(\d+)\s*Shard/, (m, n) => `+${icoTag(RESOURCE_ICON.egoshard)}${n}`);
    r.append(bn);
  });

  // Thread spinning
  b = panel("Thread Spinning (sets the EGO's TS level)");
  if (state.uptie.egoIdx == null) { const i = state.egos.findIndex((x) => x.acquired); state.uptie.egoIdx = i >= 0 ? i : 0; }
  b.appendChild(idPicker("EGO", state.egos, state.uptie.egoIdx, isOwned, (i) => { state.uptie.egoIdx = i; setSelection("uptie.sinner", state.egos[i].sinner); }));
  // only show the grade matching the selected EGO
  const egoGrade = state.egos[state.uptie.egoIdx]?.tier;
  const tsGrades = egoGrade ? (THREADSPIN[egoGrade] ? [egoGrade] : []) : Object.keys(THREADSPIN);
  if (egoGrade && !tsGrades.length) b.appendChild(el(`<div class="hint">No thread-spin steps for grade ${esc(egoGrade)}.</div>`));
  const tsCur = Number(state.egos[state.uptie.egoIdx]?.threadspin) || 1;
  tsGrades.forEach((grade) => {
    b.appendChild(el(`<div class="subhead">${grade}</div>`));
    const rr = row(b);
    // show only the TS steps that still advance the EGO ("from 1" only at TS1)
    ["TS2", "TS3", "TS3_1", "TS4"].filter((step) => step === "TS3_1" ? tsCur === 1 : tsCur < TS_STEP_LEVEL[step]).forEach((step) => {
      const bn = btn("", () => act((s) => ACTIONS.threadspin(s, grade, step)));
      bn.innerHTML = `${esc(step.replace("_1", " (from 1)"))} (${icoTag(RESOURCE_ICON.thread)}${Math.abs(THREADSPIN[grade][step])})`;
      rr.append(bn);
    });
    const ts5Btn = (method) => {
      const spent = method === "thread" ? SPINCHAIN[grade] * 2 : SPINCHAIN[grade];
      const bn = btn("", () => act((s) => ACTIONS.threadspinTS5(s, grade, method)));
      bn.innerHTML = `TS5 ${icoTag(RESOURCE_ICON.spinchain)}${SPINCHAIN[grade]} = ${icoTag(method === "thread" ? RESOURCE_ICON.thread : RESOURCE_ICON.egoshard)}${spent}`;
      bn.title = `TS5: ${SPINCHAIN[grade]} spinchain via ${method === "thread" ? "thread (2:1)" : "EGO shard (1:1)"}`;
      return bn;
    };
    if (tsCur < 5) rr.append(ts5Btn("shard"), ts5Btn("thread"));
  });

  // Intervallo shop lives on its own "Event Shop" tab (full editable planner).
  b = panel("Intervallo Event Shop");
  b.appendChild(el(`<div class="hint">Use the <b>Event Shop</b> tab to plan purchases and currency.</div>`));

  // Season / rental
  b = panel("Season & Misc");
  r = row(b);
  r.append(
    btn("New Season Start", () => act(ACTIONS.newSeason)),
    btn("Toggle Rental Week", () => act(ACTIONS.onRW)),
  );
}

// ---------- colour helpers (from xlsx conditional formatting) ----------
const styleAttr = (c) => (c ? `background:${c.fill};color:${c.font};` : "");
function sinnerColor(name) { return SINNER_COLORS[name] || null; }
function levelColor(v) {
  if (v == null || v === "") return null;
  const n = Math.round(Number(v));
  return { fill: LEVEL_FILL[n] || LEVEL_FILL_DEFAULT, font: "#202124" };
}
function scaleColor(v) {
  if (v == null || v === "") return null;
  if (Number(v) >= 5) return fillColor(SCALE_MAX5); // uptie/threadspin "maxed" (ID Level col L "=5")
  let n = Math.max(0, Math.min(4, Number(v)));
  let lo = SCALE_STOPS[0], hi = SCALE_STOPS[2];
  if (n <= 2) { lo = SCALE_STOPS[0]; hi = SCALE_STOPS[1]; } else { lo = SCALE_STOPS[1]; hi = SCALE_STOPS[2]; }
  const span = hi.at - lo.at, t = span ? (n - lo.at) / span : 0;
  const mix = lo.rgb.map((c, i) => Math.round(c + (hi.rgb[i] - c) * t));
  return { fill: `rgb(${mix.join(",")})`, font: "#202124" };
}
// Pick a readable font for an arbitrary fill (used by the non-sinner palettes).
function contrastFont(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#202124" : "#ffffff";
}
const fillColor = (hex) => (hex ? { fill: hex, font: contrastFont(hex) } : null);
// normalise to #rrggbb for an <input type=color>
const normHex = (v) => { const m = /^#?([0-9a-fA-F]{6})$/.exec(String(v ?? "")); return m ? "#" + m[1] : "#000000"; };
// shard-type colour: editable per-row colour in constants.shardTable, else the default palette
const shardTypeColor = (t) => {
  const row = state.constants && state.constants.shardTable && state.constants.shardTable.find((r) => r.type === t);
  return fillColor((row && row.color) || SHARD_TYPE_FILL[t]);
};
const gachaTierColor = (t) => fillColor(GACHA_TIER_FILL[t]);
const dayColor = (d) => fillColor(DAY_FILL[d]);
const sinColor = (s) => fillColor(SIN_FILL[s]);
const tierColor = (v) => { const n = (String(v || "").match(/★/g) || []).length; return n ? fillColor(TIER_FILL[n]) : null; };
const keywordTagColor = (tag) => fillColor(KEYWORD_FILL[tag]); // keyword tag coloured by text
function seasonTagColor(tag) { // per-tag season colour
  if (tag === "Walpurgisnaught") return fillColor(SEASON_FILL.Walpurgisnaught);
  if (/^\d+$/.test(tag)) return fillColor(SEASON_NUMBER_FILL[tag]);
  if (tag === "Standard Fare") return fillColor(SEASON_FILL["Standard Fare"]);
  return null;
}
function seasonCellColor(tags) { // whole-cell priority: Walp > number > Standard Fare
  if (tags.some((t) => t === "Walpurgisnaught")) return fillColor(SEASON_FILL.Walpurgisnaught);
  const num = tags.find((t) => /^\d+$/.test(t) && SEASON_NUMBER_FILL[t]);
  if (num) return fillColor(SEASON_NUMBER_FILL[num]);
  if (tags.some((t) => t === "Standard Fare")) return fillColor(SEASON_FILL["Standard Fare"]);
  return null;
}
// colour a cell by the first status keyword it contains (IF SS7 keyword cells / legend)
function statusColor(text) {
  if (!text) return null;
  for (const st of STATUS_ORDER) if (String(text).includes(st)) return fillColor(STATUS_FILL[st]);
  return null;
}
// colour an IF SS7 ID/EGO cell by its faction/source (G2:J13 conditional formatting)
function factionColor(text) {
  if (!text) return null;
  const s = String(text);
  for (const f of FACTION_COLORS) if (s.includes(f.match)) return { fill: f.fill, font: f.font };
  return null;
}
// MD slot pill: status theme coloured per word; dimmed when already done (unchecked).
function mdPill(on, status) {
  return `<span class="mdpill ${on ? "" : "done"}">${statusChips(status)}</span>`;
}
// IF SS7 keyword cells hold space-separated statuses; colour EACH word (by text)
function statusChips(text) {
  if (text == null || text === "") return "";
  return String(text).split(/\s+/).filter(Boolean).map((w) => {
    const c = fillColor(STATUS_FILL[w]);
    return c ? `<span class="chip" style="background:${c.fill};color:${c.font}">${esc(w)}</span>`
      : `<span class="chip plain">${esc(w)}</span>`;
  }).join(" ");
}

// ---------- ID / EGO editable, colour-coded tables ----------
function renderEditableList(viewId, arrayName, columns, searchKeys, makeBlank) {
  const root = $("#" + viewId);
  const colByKey = Object.fromEntries(columns.map((c) => [c.key, c]));

  root.innerHTML = `
    <div class="list-controls">
      <input type="text" placeholder="Search…" id="${viewId}-search" />
      <label class="count"><input type="checkbox" id="${viewId}-owned" /> Owned only</label>
      <button class="act primary" id="${viewId}-add">+ Add</button>
      <span class="count" id="${viewId}-count"></span>
    </div>
    <div class="table-wrap"><table class="sheet"><thead><tr>${
      columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th></th></tr></thead>
      <tbody id="${viewId}-body"></tbody></table></div>`;

  // multi-value "tags" columns (season, keyword, extra keyword) are stored
  // comma-separated, e.g. "Season, 7, Event" or "Reload, Retreat".
  const splitTags = (s) => (s ? String(s).split(",").map((x) => x.trim()).filter(Boolean) : []);
  // `order` (optional) pins those tags first in that exact order (and always
  // offers them, even if no row uses one yet); any extras follow alphabetically.
  const distinctTags = (key, order) => {
    const set = new Set();
    state[arrayName].forEach((it) => splitTags(it[key]).forEach((t) => set.add(t)));
    const extras = [...set].filter((t) => !order || !order.includes(t))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return order ? [...order, ...extras] : extras;
  };

  const chipHtml = (tc, t) => { const c = tc && tc(t); return c ? `<span class="chip" style="background:${c.fill};color:${c.font}">${esc(t)}</span>` : `<span class="chip plain">${esc(t)}</span>`; };
  const tagSummary = (col, tags) => {
    if (col.cellColor) return `<span class="tag" style="${styleAttr(col.cellColor(tags))}">${tags.length ? esc(tags.join(", ")) : "—"}</span>`;
    if (col.tagColor) return tags.length ? tags.map((t) => optIcon(col.iconCat, t) + chipHtml(col.tagColor, t)).join(" ") : "—";
    return tags.length ? esc(tags.join(", ")) : "—";
  };

  // fill a multi-select popover's options the first time it's opened
  const fillPanel = (panel) => {
    if (!panel || panel.dataset.filled) return;
    const col = colByKey[panel.dataset.key];
    const item = state[arrayName][+panel.dataset.idx];
    if (!col || !item) return;
    const tags = splitTags(item[col.key]);
    const opts = distinctTags(col.key, col.optOrder);
    const optColor = col.optColor || col.tagColor;
    const optLabel = (t) => optIcon(col.iconCat, t) + (optColor && optColor(t) ? chipHtml(optColor, t) : esc(t));
    panel.innerHTML =
      (opts.length > 10 ? `<input type="text" class="ms-search" placeholder="search…"/>` : "") +
      opts.map((t) => `<label class="ms-opt"><input type="checkbox" data-tag="${esc(t)}" ${tags.includes(t) ? "checked" : ""}/> ${optLabel(t)}</label>`).join("") +
      `<div class="ms-add"><input type="text" class="ms-newtag" placeholder="+ add…"/></div>`;
    panel.dataset.filled = "1";
  };

  const cellHtml = (col, item, idx) => {
    const v = item[col.key];
    const st = col.color ? styleAttr(col.color(v, item)) : "";
    if (col.type === "check")
      return `<td style="text-align:center"><input type="checkbox" data-idx="${idx}" data-key="${col.key}" ${v ? "checked" : ""}/></td>`;
    if (col.type === "select") {
      const sel = `<select data-idx="${idx}" data-key="${col.key}" style="${st}">${
        ["", ...col.options].map((o) => `<option${o === (v ?? "") ? " selected" : ""}${col.color ? optStyle(col.color(o, item)) : ""}>${esc(o)}</option>`).join("")}</select>`;
      return `<td>${col.iconCat ? cselHtml(sel, col.iconCat, v ?? "", col.color ? col.color(v, item) : null) : sel}</td>`;
    }
    if (col.type === "num")
      return `<td class="num"><input type="number" data-idx="${idx}" data-key="${col.key}" value="${v ?? ""}" style="${st}"/></td>`;
    if (col.type === "tags") {
      const tags = splitTags(v);
      // panel options are filled lazily on first open (see fillPanel) so we
      // don't bake every row's full option list into the DOM up-front.
      return `<td class="season-cell"><details class="ms"><summary>${tagSummary(col, tags)}</summary>
        <div class="ms-panel" data-idx="${idx}" data-key="${col.key}"></div></details></td>`;
    }
    if (col.type === "date")
      return `<td><input type="date" data-idx="${idx}" data-key="${col.key}" value="${esc(v ?? "")}"/></td>`;
    return `<td><input type="text" data-idx="${idx}" data-key="${col.key}" value="${esc(v ?? "")}" style="${st}"/></td>`;
  };

  const colorizeRow = (tr, item) => {
    tr.querySelectorAll("[data-key]").forEach((node) => {
      const col = colByKey[node.dataset.key];
      if (col && col.color) {
        const c = col.color(item[col.key], item);
        node.style.background = c ? c.fill : "";
        node.style.color = c ? c.font : "";
      }
    });
  };

  const draw = () => {
    const arr = state[arrayName];
    const q = $("#" + viewId + "-search").value.trim().toLowerCase();
    const ownedOnly = $("#" + viewId + "-owned").checked;
    const rows = arr.map((it, idx) => ({ it, idx })).filter(({ it }) => {
      if (ownedOnly && !it.acquired) return false;
      if (!q) return true;
      return searchKeys.some((k) => String(it[k] ?? "").toLowerCase().includes(q));
    });
    // sort by release date, then internal id (blanks last)
    rows.sort((a, b) => {
      const ra = a.it.release || "9999-99-99", rb = b.it.release || "9999-99-99";
      if (ra !== rb) return ra < rb ? -1 : 1;
      return (a.it.internalId ?? 1e9) - (b.it.internalId ?? 1e9);
    });
    $("#" + viewId + "-body").innerHTML = rows.map(({ it, idx }) =>
      `<tr data-row="${idx}">${columns.map((c) => cellHtml(c, it, idx)).join("")}` +
      `<td style="text-align:center"><button class="reset" data-del="${idx}" title="delete">✕</button></td></tr>`).join("");
    $("#" + viewId + "-count").textContent = `${rows.length} / ${arr.length}`;
  };

  const body = $("#" + viewId + "-body");
  // toggle doesn't bubble — capture it to lazily fill a popover when it opens
  body.addEventListener("toggle", (e) => {
    if (e.target.tagName === "DETAILS" && e.target.open) fillPanel(e.target.querySelector(".ms-panel"));
  }, true);
  body.addEventListener("change", (e) => {
    const t = e.target;
    // --- multi-select tags (season / keyword / extra keyword) ---
    const panel = t.closest(".ms-panel");
    if (panel) {
      if (t.classList.contains("ms-search")) return; // filter input, not a tag edit
      const item = state[arrayName][+panel.dataset.idx];
      const key = panel.dataset.key;
      if (t.classList.contains("ms-newtag")) {
        const tag = t.value.trim();
        if (tag) {
          const tags = splitTags(item[key]);
          if (!tags.includes(tag)) tags.push(tag);
          item[key] = tags.join(", ");
          draw();         // new tag should appear in every row's option list
          autosave();
        }
        return;
      }
      // a tag checkbox toggled: keep existing order, append newly-checked tags
      const checked = new Set([...panel.querySelectorAll('input[data-tag]:checked')].map((c) => c.dataset.tag));
      const prev = splitTags(item[key]);
      const kept = prev.filter((t) => checked.has(t));
      const added = [...checked].filter((t) => !prev.includes(t));
      const tags = [...kept, ...added];
      item[key] = tags.join(", ");
      panel.parentElement.querySelector("summary").innerHTML = tagSummary(colByKey[key], tags);
      autosave();
      return;
    }
    // --- normal fields ---
    if (t.dataset.idx == null) return;
    const item = state[arrayName][+t.dataset.idx];
    const key = t.dataset.key;
    item[key] = t.type === "checkbox" ? t.checked
      : t.type === "number" ? (t.value === "" ? null : Number(t.value))
      : t.value;
    if (key === "tier") item.tierStars = (String(item.tier).match(/★/g) || []).length;
    colorizeRow(t.closest("tr"), item);
    autosave();
  });
  body.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    state[arrayName].splice(+del.dataset.del, 1);
    draw();
    autosave();
  });
  // live filter for searchable tag dropdowns (e.g. Extra Keyword)
  body.addEventListener("input", (e) => {
    if (!e.target.classList.contains("ms-search")) return;
    const q = e.target.value.toLowerCase();
    e.target.closest(".ms-panel").querySelectorAll(".ms-opt").forEach((opt) => {
      opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
  $("#" + viewId + "-search").addEventListener("input", draw);
  $("#" + viewId + "-owned").addEventListener("change", draw);
  $("#" + viewId + "-add").addEventListener("click", () => {
    state[arrayName].push(makeBlank());
    $("#" + viewId + "-search").value = "";
    $("#" + viewId + "-owned").checked = false;
    draw();
    autosave();
    body.querySelector("tr:last-child input")?.focus();
  });
  draw();
}

function renderIDs() {
  renderEditableList("ids", "ids", [
    { label: "ID Name", key: "name", type: "text", color: (v, it) => sinnerColor(it.sinner) },
    { label: "Sinner", key: "sinner", type: "select", options: SINNER_ORDER, color: (v) => sinnerColor(v), iconCat: "sinner" },
    { label: "Tier", key: "tier", type: "select", options: ["★", "★★", "★★★"], color: (v) => tierColor(v), iconCat: "tier" },
    { label: "Season", key: "season", type: "tags", tagColor: seasonTagColor, iconCat: "season" },
    { label: "Keyword", key: "keyword", type: "tags", tagColor: keywordTagColor, optOrder: KEYWORD_ORDER, iconCat: "keyword" },
    { label: "Extra Keyword", key: "extraKeyword", type: "tags", iconCat: "keyword" },
    { label: "Owned", key: "acquired", type: "check" },
    { label: "Level", key: "level", type: "num", color: (v) => levelColor(v) },
    { label: "Lv Extra", key: "levelExtra", type: "num" },
    { label: "Uptie", key: "uptie", type: "num", color: (v) => scaleColor(v) },
    { label: "Released", key: "release", type: "date" },
    { label: "Int. ID", key: "internalId", type: "num" },
  ], ["name", "sinner", "keyword", "extraKeyword", "season"],
    () => ({ name: "", sinner: "Yi Sang", tier: "★★★", tierStars: 3, season: "", keyword: "", extraKeyword: "", acquired: false, level: null, levelExtra: 0, uptie: null, release: "", internalId: null }));
}
function renderEGOs() {
  renderEditableList("egos", "egos", [
    { label: "EGO Name", key: "name", type: "text", color: (v, it) => sinnerColor(it.sinner) },
    { label: "Sinner", key: "sinner", type: "select", options: SINNER_ORDER, color: (v) => sinnerColor(v), iconCat: "sinner" },
    { label: "Sin", key: "sin", type: "select", options: SIN_ORDER, color: (v) => sinColor(v), iconCat: "sin" },
    { label: "Grade", key: "tier", type: "select", options: ["ZAYIN", "TETH", "HE", "WAW", "ALEPH"], color: (v) => shardTypeColor(v), iconCat: "grade" },
    { label: "Season", key: "season", type: "tags", tagColor: seasonTagColor, iconCat: "season" },
    { label: "Keyword", key: "keyword", type: "tags", tagColor: keywordTagColor, optOrder: KEYWORD_ORDER, iconCat: "keyword" },
    { label: "Extra Keyword", key: "extraKeyword", type: "tags", iconCat: "keyword" },
    { label: "Owned", key: "acquired", type: "check" },
    { label: "Threadspin", key: "threadspin", type: "num", color: (v) => scaleColor(v) },
    { label: "Released", key: "release", type: "date" },
    { label: "Int. ID", key: "internalId", type: "num" },
  ], ["name", "sinner", "sin", "keyword", "extraKeyword", "season"],
    () => ({ name: "", sinner: "Yi Sang", sin: "", tier: "ZAYIN", season: "", keyword: "", extraKeyword: "", acquired: false, threadspin: null, release: "", internalId: null }));
}

// ---------- editable free-form grids (Teams / IF SS7) ----------
// Cells are coloured by the sinner acronym they contain (e.g. " YS"), matching
// the Bokgak Teams / IF SS7 conditional formatting.
function acronymColor(text) {
  if (!text) return null;
  const s = String(text);
  for (const sn of state.sinners) {
    if (sn.acronym && s.includes(" " + sn.acronym)) return SINNER_COLORS[sn.name] || null;
  }
  return null;
}
function renderEditableGrid(viewId, arrayName) {
  const root = $("#" + viewId);
  const colsOf = () => Math.max(1, ...state[arrayName].map((r) => r.length));
  root.innerHTML = `
    <div class="list-controls">
      <button class="act primary" id="${viewId}-addrow">+ Row</button>
      <button class="act" id="${viewId}-addcol">+ Column</button>
      <span class="count" id="${viewId}-count"></span>
    </div>
    <div class="table-wrap"><table class="sheet"><tbody id="${viewId}-gbody"></tbody></table></div>`;
  const gbody = $("#" + viewId + "-gbody");

  const draw = () => {
    const rows = state[arrayName], cols = colsOf();
    gbody.innerHTML = rows.map((r, ri) =>
      `<tr>${Array.from({ length: cols }, (_, ci) => {
        const v = r[ci] ?? "";
        return `<td>${wrapAcell(`<input type="text" data-r="${ri}" data-c="${ci}" value="${esc(v)}"/>`, v, acronymColor(v))}</td>`;
      }).join("")}<td style="text-align:center"><button class="reset" data-delrow="${ri}" title="delete row">✕</button></td></tr>`).join("");
    $("#" + viewId + "-count").textContent = `${rows.length} rows × ${cols} cols`;
  };

  gbody.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.r == null) return;
    const row = state[arrayName][+t.dataset.r], c = +t.dataset.c;
    while (row.length <= c) row.push("");
    row[c] = t.value;
    refreshAcell(t);
    autosave();
  });
  gbody.addEventListener("click", (e) => {
    const d = e.target.closest("[data-delrow]");
    if (!d) return;
    state[arrayName].splice(+d.dataset.delrow, 1);
    draw();
    autosave();
  });
  $("#" + viewId + "-addrow").addEventListener("click", () => { state[arrayName].push(Array(colsOf()).fill("")); draw(); autosave(); });
  $("#" + viewId + "-addcol").addEventListener("click", () => { const c = colsOf(); state[arrayName].forEach((r) => { while (r.length < c) r.push(""); r.push(""); }); draw(); autosave(); });
  draw();
}

// ---------- IF SS7 (structured: prediction/actual/keyword + computed stats) ----------
// Row indices in state.ifss7: 0 header, 1-12 sinners, 13 blank, 14-20 stats,
// 21 blank, 22+ team list. Columns: 0 A | 1 B 2 C 3 D | 6 G 7 H 8 I 9 J | 12 M 13 N 14 O 15 P.
function renderIFSS7() {
  const root = $("#ifss7");
  if (!root) return;
  const g = state.ifss7;
  const data = g.slice(1, 13);
  const txt = (row, c) => String(row[c] ?? "");
  const cSub = (cols, sub) => data.reduce((a, row) => a + cols.reduce((b, c) => b + (txt(row, c).includes(sub) ? 1 : 0), 0), 0);
  const cNon = (cols) => data.reduce((a, row) => a + cols.reduce((b, c) => b + (txt(row, c).trim() ? 1 : 0), 0), 0);
  const cRe = (cols, re) => data.reduce((a, row) => a + cols.reduce((b, c) => b + (re.test(txt(row, c)) ? 1 : 0), 0), 0);
  // ends-with (sheet's COUNTIF "* Bkgk" has no trailing *, so "...Bkgk2" doesn't match)
  const cEnds = (cols, suf) => data.reduce((a, row) => a + cols.reduce((b, c) => b + (txt(row, c).endsWith(suf) ? 1 : 0), 0), 0);
  const fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
  const fingerRe = /Thumb|Index|Middle|Ring|Pinky/;

  const predFinger = fingers.map((fn) => [fn, cSub([1, 2], fn)]);
  const actFinger = fingers.map((fn) => [fn, cSub([6, 7, 8], fn)]);
  actFinger.push(["Walpurgisnaughts", cSub([6, 7, 8, 9], " Walp")]);
  actFinger.push(["Intervallos & Bokgaks", cSub([6, 7, 8, 9], " Intv") + cEnds([6, 7, 8, 9], " Bkgk")]);
  const stats = [
    ["Non-Finger IDs", cNon([6, 7, 8]) - cRe([6, 7, 8], fingerRe)],
    ["Non-BP EGOs", cNon([9]) - cSub([9], " BP")],
    ["House of Spiders", cRe([6, 7, 8], /Father|Apprentice|App|Araya/)],
    ["Total IDs", cNon([6, 7, 8])],
    ["Total EGOs", cNon([9])],
    ["No Faction Stuff", cNon([6, 7, 8, 9]) - cRe([6, 7, 8, 9], /Thumb|Index|Middle|Ring|Pinky| Walp| Intv| Bkgk| BP/)],
    ["Standard Fare", cSub([6, 7, 8, 9], " SF")],
  ];
  const statuses = ["Burn", "Bleed", "Tremor", "Rupture", "Sinking", "Poise", "Charge"];
  const statusCounts = statuses.map((s) => [s, cSub([12, 13, 14], s), cSub([15], s)]);

  const ec = (r, c, fn) => `<td><input type="text" data-r="${r}" data-c="${c}" value="${esc(g[r][c] ?? "")}" style="${styleAttr(fn(g[r][c]))}"/></td>`;
  // keyword cell: coloured per status word (click to edit)
  const kw = (r, c) => `<td class="kw" data-r="${r}" data-c="${c}">${statusChips(g[r][c])}</td>`;
  const mainRows = [];
  for (let r = 1; r <= 12; r++) {
    mainRows.push(`<tr><td style="${styleAttr(sinnerColor(g[r][0]))}">${esc(g[r][0] ?? "")}</td>` +
      ec(r, 1, factionColor) + ec(r, 2, factionColor) + ec(r, 3, factionColor) +
      ec(r, 6, factionColor) + ec(r, 7, factionColor) + ec(r, 8, factionColor) + ec(r, 9, factionColor) +
      kw(r, 12) + kw(r, 13) + kw(r, 14) + kw(r, 15) + `</tr>`);
  }
  const kv2 = (rows) => rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join("");
  const legendRows = [];
  for (let r = 14; r <= 20 && r < g.length; r++)
    legendRows.push(`<tr>${[13, 14, 15].map((c) => `<td>${statusChips(g[r][c])}</td>`).join("")}</tr>`);

  root.innerHTML = `
    <div class="table-wrap ifss7-scroll" style="margin-bottom:14px;">
      <table class="sheet"><thead><tr>
        <th>Sinner</th><th>Pred ID#1</th><th>Pred ID#2</th><th>Pred EGO</th>
        <th>Actual ID#1</th><th>Actual ID#2</th><th>Actual ID#3</th><th>Actual EGO</th>
        <th>KW ID#1</th><th>KW ID#2</th><th>KW ID#3</th><th>KW EGO</th>
      </tr></thead><tbody id="ifss7-main">${mainRows.join("")}</tbody></table>
    </div>
    <h2 class="section-title">Stats <span class="count">(computed)</span></h2>
    <div class="grid">
      <div class="card"><h2>Predicted Fingers</h2><div class="body"><div class="kv">${kv2(predFinger)}</div></div></div>
      <div class="card"><h2>Actual Fingers / Source</h2><div class="body"><div class="kv">${kv2(actFinger)}</div></div></div>
      <div class="card"><h2>Totals</h2><div class="body"><div class="kv">${kv2(stats)}</div></div></div>
      <div class="card"><h2>Status Counts</h2><div class="body" style="padding:0;">
        <table class="sheet"><thead><tr><th>Status</th><th class="num">IDs</th><th class="num">EGOs</th></tr></thead>
        <tbody>${statusCounts.map(([s, idn, egn]) => `<tr><td style="${styleAttr(statusColor(s))}">${esc(s)}</td><td class="num">${idn}</td><td class="num">${egn}</td></tr>`).join("")}</tbody></table>
      </div></div>
      <div class="card"><h2>Status Combo Legend <span class="count">(possible 2-status looks)</span></h2><div class="body" style="padding:0;">
        <table class="sheet"><tbody>${legendRows.join("")}</tbody></table>
      </div></div>
    </div>`;

  // main block edits -> re-render so computed stats update
  const main = $("#ifss7-main");
  main.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.r == null) return;   // faction inputs only (kw-edit has no data-r)
    g[+t.dataset.r][+t.dataset.c] = t.value;
    renderIFSS7();
    autosave();
  });
  // keyword cells: click to edit, save on blur/Enter (re-render to recolour + update counts)
  main.addEventListener("click", (e) => {
    const cell = e.target.closest("td.kw");
    if (!cell || cell.querySelector("input")) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    cell.innerHTML = `<input type="text" class="kw-edit" value="${esc(g[r][c] ?? "")}"/>`;
    const inp = cell.querySelector("input");
    inp.focus();
    inp.select();
    inp.addEventListener("blur", () => { g[r][c] = inp.value; renderIFSS7(); autosave(); });
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); inp.blur(); } });
  });
}

// ---------- MD Teams (registered teams; shares state.ifss7 rows 22+) ----------
// 12 columns = a left team (cols 0-5) and a right team (cols 6-11), grouped into
// bands of 3 rows: a header keyword/faction row + two member rows.
function renderMDTeams() {
  const root = $("#mdteams");
  if (!root) return;
  const g = state.ifss7;
  const teamStart = 22, TEAM_W = 12;
  for (let r = teamStart; r < g.length; r++) if (g[r].length > TEAM_W) g[r] = g[r].slice(0, TEAM_W); // drop trailing blank cols
  while ((g.length - teamStart) % 3 !== 0) g.push(Array(TEAM_W).fill("")); // keep bands of 3
  const teamRows = [];
  for (let r = teamStart; r < g.length; r++) {
    const head = (r - teamStart) % 3 === 0;
    const cells = [];
    for (let c = 0; c < TEAM_W; c++) {
      const v = g[r][c] ?? "";
      const div = c === 6 ? " team-div" : "";
      const inp = `<input type="text" data-tr="${r}" data-tc="${c}" value="${esc(v)}"/>`;
      cells.push(head
        ? `<td class="team-kw${div}">${wrapAcell(inp, v, null, "keyword")}</td>`
        : `<td class="${div.trim()}">${wrapAcell(inp, v, acronymColor(v))}</td>`);
    }
    cells.push(head
      ? `<td class="team-del"><button class="reset" data-delband="${r}" title="delete team">✕</button></td>`
      : `<td></td>`);
    teamRows.push(`<tr class="${head ? "team-head" : ""}">${cells.join("")}</tr>`);
  }
  root.innerHTML = `
    <h2 class="section-title">MD Teams <span class="count">(left team = cols 1-6, right team = cols 7-12; each band is a header keyword/faction row + 2 member rows)</span></h2>
    <div class="list-controls"><button class="act primary" id="mdteams-addteam">+ Team Row</button></div>
    <div class="table-wrap ifss7-scroll"><table class="sheet"><tbody id="mdteams-body">${teamRows.join("")}</tbody></table></div>`;

  const teams = $("#mdteams-body");
  teams.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.tr == null) return;
    g[+t.dataset.tr][+t.dataset.tc] = t.value;
    refreshAcell(t);
    autosave();
  });
  teams.addEventListener("click", (e) => {
    const d = e.target.closest("[data-delband]");
    if (!d) return;
    g.splice(+d.dataset.delband, 3);   // remove the whole 3-row team band
    renderMDTeams();
    autosave();
  });
  // a "team row" is a 3-row band (header + 2 member rows) holding a left & right team
  $("#mdteams-addteam").addEventListener("click", () => { for (let i = 0; i < 3; i++) g.push(Array(12).fill("")); renderMDTeams(); autosave(); });
}

// ---------- Data (named ranges / constants) editor ----------
function renderData() {
  const root = $("#data");
  if (!root) return;
  const c = state.constants || {};
  const isScalar = (v) => v === null || ["number", "string", "boolean"].includes(typeof v);
  const coerce = (s) => { if (s === "") return ""; const n = Number(s); return (!isNaN(n) && s.trim() !== "") ? n : s; };
  const field = (label, path, val) =>
    `<div class="k">${esc(label)}</div><div class="v"><input class="kv-num data-edit" data-path="${esc(path)}" value="${esc(val ?? "")}"/></div>`;
  const card = (key, inner, wide) =>
    `<div class="card"${wide ? ' style="grid-column:1/-1;"' : ""}><h2>${esc(key)}<button class="reset data-delkey" data-key="${esc(key)}" title="delete this named range" style="float:right">✕</button></h2>${inner}</div>`;

  const sections = Object.keys(c).map((key) => {
    const v = c[key];
    if (isScalar(v)) {
      const inner = COMPUTED_SCALARS.includes(key)
        ? `<div class="k">value <span class="count">(calc)</span></div><div class="v"><input class="data-computed" data-path="constants.${key}" value="${esc(v ?? "")}" readonly disabled title="computed"/></div>`
        : field("value", "constants." + key, v);
      return card(key, `<div class="body"><div class="kv">${inner}</div></div>`);
    }
    if (Array.isArray(v)) {
      // array of objects -> editable table (scrollable for big curves)
      if (v.length && v.every((o) => o && typeof o === "object" && !Array.isArray(o))) {
        const cols = [...new Set(v.flatMap((o) => Object.keys(o)))];
        const computedCols = COMPUTED_COLS[key] || [];
        const dcell = (col, i, val) => {
          if (computedCols.includes(col))
            return `<td><input class="data-computed" data-path="constants.${key}.${i}.${col}" value="${esc(val ?? "")}" readonly disabled title="computed (running sum)"/></td>`;
          const isColor = col === "color" || /^#[0-9a-fA-F]{6}$/.test(String(val ?? ""));
          return isColor
            ? `<td><input type="color" class="data-edit" data-path="constants.${key}.${i}.${col}" value="${esc(normHex(val))}"/></td>`
            : `<td><input class="data-edit" data-path="constants.${key}.${i}.${col}" value="${esc(val ?? "")}"/></td>`;
        };
        const body = v.map((o, i) =>
          `<tr>${cols.map((col) => dcell(col, i, o[col])).join("")}` +
          `<td style="text-align:center"><button class="reset" data-delconst="${key}.${i}">✕</button></td></tr>`).join("");
        const head = cols.map((col) => `<th>${esc(col)}${computedCols.includes(col) ? ' <span class="count">(calc)</span>' : ""}</th>`).join("") + "<th></th>";
        return card(key,
          `<div class="body" style="padding:0;"><div class="table-wrap" style="max-height:340px;"><table class="sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>
           <div class="body"><button class="act" data-addconst="${key}">+ Row</button> <span class="count">${v.length} rows</span></div>`, true);
      }
      // array of primitives -> editable list
      const items = v.map((item, i) =>
        `<div class="dlist-row"><input class="data-edit" data-path="constants.${key}.${i}" value="${esc(item ?? "")}"/><button class="reset" data-delconst="${key}.${i}">✕</button></div>`).join("");
      return card(key, `<div class="body">${items || '<div class="hint">empty</div>'}<button class="act" data-addprim="${key}" style="margin-top:6px;">+ Item</button></div>`);
    }
    if (typeof v === "object" && v)
      return card(key, `<div class="body"><div class="kv">${Object.keys(v).map((sub) => field(sub, `constants.${key}.${sub}`, v[sub])).join("")}</div></div>`);
    return card(key, `<div class="body"><div class="hint">Unsupported value — use Advanced (raw JSON) below.</div></div>`, true);
  }).join("");

  root.innerHTML = `
    <h2 class="section-title">Dataset <span class="count">(named ranges — edit values & rows directly; changes feed every calculation)</span></h2>
    <div class="grid">${sections}</div>
    <h2 class="section-title">Add a named range</h2>
    <div class="card"><div class="body"><div class="field">
      <input type="text" id="data-newname" placeholder="name (e.g. myCost)" style="min-width:160px"/>
      <select id="data-newtype"><option value="number">Number</option><option value="text">Text</option><option value="list">List</option></select>
      <button class="act primary" id="data-add">+ Add</button>
    </div><div class="hint">For a new table or complex structure, use Advanced (raw JSON) below.</div></div></div>
    <details class="data-advanced"><summary>Advanced — edit raw JSON</summary>
      <div class="card" style="grid-column:1/-1;"><div class="body">
        <div class="hint">Edit the whole constants object directly, then Apply (validates JSON).</div>
        <textarea class="data-json" id="data-rawall" spellcheck="false" style="min-height:300px;">${esc(JSON.stringify(c, null, 2))}</textarea>
        <button class="act" id="data-applyall" style="margin-top:6px;">Apply all</button>
      </div></div></details>`;

  const afterEdit = () => { recomputeDerived(state); recompute(state); renderDashboard(); autosave(); };
  root.querySelectorAll(".data-edit").forEach((inp) => inp.addEventListener("change", (e) => {
    setByPath(state, e.target.dataset.path, coerce(e.target.value));
    afterEdit();
    // refresh the computed (running-sum) cells in place
    root.querySelectorAll("input.data-computed").forEach((el) => { const x = getByPath(state, el.dataset.path); el.value = x == null ? "" : x; });
  }));
  root.querySelectorAll("[data-addconst]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.addconst, arr = state.constants[key], blank = {};
    [...new Set(arr.flatMap((o) => Object.keys(o)))].forEach((k) => (blank[k] = ""));
    arr.push(blank); renderData(); afterEdit();
  }));
  root.querySelectorAll("[data-addprim]").forEach((b) => b.addEventListener("click", () => {
    state.constants[b.dataset.addprim].push(""); renderData(); afterEdit();
  }));
  root.querySelectorAll("[data-delconst]").forEach((b) => b.addEventListener("click", () => {
    const i = b.dataset.delconst.lastIndexOf("."), key = b.dataset.delconst.slice(0, i), idx = +b.dataset.delconst.slice(i + 1);
    state.constants[key].splice(idx, 1); renderData(); afterEdit();
  }));
  root.querySelectorAll(".data-delkey").forEach((b) => b.addEventListener("click", () => {
    if (!confirm(`Delete named range "${b.dataset.key}"?`)) return;
    delete state.constants[b.dataset.key]; renderData(); afterEdit();
  }));
  $("#data-add").addEventListener("click", () => {
    const name = ($("#data-newname").value || "").trim(), type = $("#data-newtype").value;
    if (!name) { toast(["Enter a name"]); return; }
    if (name in state.constants) { toast([`"${name}" already exists`]); return; }
    state.constants[name] = type === "number" ? 0 : type === "list" ? [""] : "";
    renderData(); afterEdit(); toast([`Added ${name}`]);
  });
  $("#data-applyall").addEventListener("click", () => {
    try { state.constants = JSON.parse($("#data-rawall").value); renderData(); afterEdit(); toast(["Dataset replaced"]); }
    catch (err) { toast([`Invalid JSON: ${err.message}`]); }
  });
}

// ---------- tabs ----------
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === name));
}
let dataRendered = false;
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  showTab(t.dataset.tab);
  // Data tab is heavy (full curves) -> render on first open
  if (t.dataset.tab === "data" && !dataRendered) { renderData(); dataRendered = true; }
});
$("#saveBtn").addEventListener("click", saveNow);
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------- boot ----------
// Curves whose cumulative column is computed (not edited) from a per-step source,
// mirroring the original sheet: ID Level Total XP = running sum of Exp increase;
// Manager Max Enkephalin = base 60 + running sum of Max Increase.
const COMPUTED_COLS = { idLevelCurve: ["totalXP"], managerCurve: ["nextXP", "maxEnk"] };
const COMPUTED_SCALARS = ["dailyManagerXP"]; // computed, read-only in the Data page
function recomputeDerived(s) {
  const c = s.constants || {};
  const cum = (arr, src, dst, base) => { if (!Array.isArray(arr)) return; let t = base; arr.forEach((r) => { t += Number(r[src]) || 0; r[dst] = t; }); };
  cum(c.idLevelCurve, "increase", "totalXP", 0);
  cum(c.managerCurve, "nextDiff", "nextXP", 0);     // nextXP = running sum of per-level difference (sheet AE)
  cum(c.managerCurve, "maxIncrease", "maxEnk", 60);
  // Daily Manager XP = (Thread Lux Skip * 3) + XP Lux  (sheet DataSheet J39 = (J38*3)+J35)
  if (c.threadLuxSkip != null && c.xpLux != null)
    c.dailyManagerXP = (Number(c.threadLuxSkip) || 0) * 3 + (Number(c.xpLux) || 0);
}

// Bring older data.json up to date: editable shardTable colour, a single tickets
// table, and an editable per-level `increase` on the ID Level curve (Total XP
// becomes the computed running sum).
function migrateConstants(s) {
  const c = s.constants || (s.constants = {});
  if (Array.isArray(c.shardTable))
    c.shardTable.forEach((r) => { if (!r.color) r.color = SHARD_TYPE_FILL[r.type] || ""; });
  if (!Array.isArray(c.tickets)) {
    const xp = c.ticketXP || {}, lux = c.dailyLuxTickets || {};
    const order = ["I", "II", "III", "IV"];
    const tiers = order.concat(Object.keys(xp).filter((t) => !order.includes(t)));
    c.tickets = tiers.map((tier) => ({
      tier, xp: xp[tier] ?? 0, dailyLux: lux[tier] ?? 0,
      color: INVENTORY_FILL["tickets." + tier] || "#FFE599",
    }));
    delete c.ticketXP; delete c.dailyLuxTickets;
  }
  if (Array.isArray(c.idLevelCurve)) {       // add `increase` (col B), order it before Total XP
    let prev = 0;
    c.idLevelCurve = c.idLevelCurve.map((r) => {
      const tot = Number(r.totalXP) || 0, inc = r.increase != null ? Number(r.increase) : tot - prev;
      prev = tot;
      return { level: r.level, increase: inc, totalXP: r.totalXP };
    });
  }
  if (Array.isArray(c.managerCurve)) {       // add `nextDiff` (sheet AE); nextXP/maxEnk are computed running sums
    let prevX = 0;
    c.managerCurve = c.managerCurve.map((r) => {
      const nx = Number(r.nextXP) || 0, diff = r.nextDiff != null ? Number(r.nextDiff) : nx - prevX;
      prevX = nx;
      return { level: r.level, nextDiff: diff, nextXP: r.nextXP, maxIncrease: r.maxIncrease, maxEnk: r.maxEnk };
    });
  }
  recomputeDerived(s);
}

(async function boot() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("state load failed");
    state = await res.json();
  } catch (e) {
    $("#saveStatus").textContent = "load error";
    document.body.innerHTML = `<p style="padding:20px;color:#e0524b">Could not load data.json. Run <code>python app/import_xlsx.py</code> then restart the server.</p>`;
    return;
  }
  // on launch: refresh current day, and set current patch = latest Thursday
  state.currentDay = DAYS[new Date().getDay()];
  state.lunacy.currentDate = currentPatchISO();
  migrateConstants(state);
  recompute(state);
  $("#dashboard").addEventListener("change", dashboardEdit); // once; #dashboard persists across re-renders
  initCustomSelects(); // one-time delegated wiring for the custom icon dropdowns
  renderDashboard();
  renderActions();
  renderEventShop();
  renderIDs();
  renderEGOs();
  renderEditableGrid("teams", "teams");
  renderIFSS7();
  renderMDTeams();
  markSaved();
})();
