// Logic ported from Code.gs. Every function mutates the shared `state` object
// (the same shape as data.json) exactly as the spreadsheet's Apps Script did.
import {
  DAYS, SHARD_DELTA, UPTIE, THREADSPIN, LUNACY_ACTIONS, TICKET_ACTIONS,
  PULL, SINNER_ORDER, SPINCHAIN, SPINCHAIN_PER_THREAD, TS_STEP_LEVEL, UPTIE_LEVEL,
} from "./constants.js";
import { rentalWeekFlag } from "./projections.js";

// ---- transient action log (shown in the UI after each action) ----
export let LOG = [];
function note(msg) { LOG.push(msg); }

// ---------- primitives (mirror Code.gs helpers) ----------
const round2 = (n) => Math.round(n * 100) / 100;
// local YYYY-MM-DD for "today" (used to mark when the day's daily lux was done)
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function freeLunacy(s) { return s.lunacy.total - s.lunacy.paid; }
function fLCH(s, a) { s.lunacy.total = round2(s.lunacy.total + a); }          // free lunacy change
function pLCH(s, a) { s.lunacy.paid = round2(s.lunacy.paid + a); fLCH(s, a); } // paid lunacy change
function crateAdd(s, a) { s.inventory.crate = round2(s.inventory.crate + a); }
function threadAdd(s, t) { s.inventory.threads = round2(s.inventory.threads + t); }
function manXPAdd(s, xp) { s.manager.currentXP = round2(s.manager.currentXP + xp); }
function tA(s, type, amount) { s.inventory.tickets[type] = round2((s.inventory.tickets[type] || 0) + amount); }

function limPassAdd(s, level, noDecimal) {
  s.inventory.pass = round2(s.inventory.pass + level);
  if (noDecimal === 1) crateAdd(s, level * 3);
}

function sinnerIndexByName(name) { return SINNER_ORDER.indexOf(name); }

function changeShard(s, shardType, sinnerName) {
  const i = sinnerIndexByName(sinnerName);
  if (i < 0 || !(shardType in SHARD_DELTA)) return;
  s.sinners[i].shards = round2(s.sinners[i].shards + SHARD_DELTA[shardType]);
  note(`${sinnerName}: ${SHARD_DELTA[shardType] >= 0 ? "+" : ""}${SHARD_DELTA[shardType]} shard (${shardType}) -> ${s.sinners[i].shards}`);
}
// subtract/add an arbitrary shard amount to a sinner (e.g. spinchain crafting)
function shardAddDirect(s, sinnerName, amount) {
  const i = sinnerIndexByName(sinnerName);
  if (i < 0) return;
  s.sinners[i].shards = round2(s.sinners[i].shards + amount);
}
// Buy out a shop item by name: deduct (remaining*cost) event currency, add the
// gained resource (perUnit per remaining unit) to inventory, mark fully bought.
function buyEventItem(s, name, perUnit, add) {
  const it = s.event.items.find((x) => x.name === name);
  if (!it) return;
  const remaining = Math.max(0, round2(it.total - it.bought));
  if (remaining <= 0) { note(`${name}: already bought`); return; }
  s.event.currency = round2(s.event.currency - remaining * it.cost);
  if (perUnit && add) add(s, round2(perUnit * remaining));
  it.bought = it.total;
  note(`${name}: bought ${remaining} (-${round2(remaining * it.cost)} currency)`);
}

// ---------- manager level / XP curve ----------
function nextXPForLevel(s, level) {
  const row = s.constants.managerCurve.find((r) => r.level === level);
  return row ? row.nextXP : Infinity;
}
function recomputeNextLevelXP(s) {
  s.manager.nextLevelXP = nextXPForLevel(s, s.manager.level);
}
// chkExceedMax: while current XP >= threshold, level up (Code.gs did a single
// `if`; a while-loop is used here so large jumps level correctly).
function chkExceedMax(s) {
  let guard = 0;
  while (s.manager.currentXP >= s.manager.nextLevelXP && guard++ < 100) {
    s.manager.currentXP = round2(s.manager.currentXP - s.manager.nextLevelXP);
    s.manager.level += 1;
    recomputeNextLevelXP(s);
    note(`Manager level up -> ${s.manager.level}`);
  }
}

// ---------- day handling ----------
function updateWeekDay(s) { s.currentDay = DAYS[new Date().getDay()]; }
function getLastDayOccurence(date, day) {
  const d = new Date(date.getTime());
  if (DAYS.includes(day)) {
    const modifier = (d.getDay() + DAYS.length - DAYS.indexOf(day)) % 7 || 7;
    d.setDate(d.getDate() - modifier);
  }
  return d;
}
function updateCurrentDate(s) {
  const lastThu = getLastDayOccurence(new Date(), "Thurs");
  s.lunacy.currentDate = lastThu.toISOString().slice(0, 10);
  s.md.rentalWeek = rentalWeekFlag(s.lunacy.currentDate); // keep rental-week flag derived from the patch date
}

// ---------- MD checkbox helpers ----------
// Weekly MD reset — fired deterministically once per patch-week (see
// maybeWeeklyReset) rather than on the Wednesday daily-lux click, so the hard-MD
// slots (1st/2nd/3rd = 7.5/8/9.5 pass, 21/24/27 crate) are always consumed in
// order within a real week regardless of when daily lux is pressed.
function weeklyMDReset(s) {
  s.md.hard = [true, true, true];
  s.md.normal = [true, true, true];
  if (Array.isArray(s.md.schedule)) s.md.schedule = s.md.schedule.map(() => false);
}
// most recent Thursday (incl. today), local, as YYYY-MM-DD — the patch-week key
function patchWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Reset MDs once when the patch-week changes. The first run after this lands
// adopts the current week silently (no reset — preserves in-progress checks).
// Returns true if it changed state (so the caller can persist it).
export function maybeWeeklyReset(s) {
  const wk = patchWeekISO();
  if (s.md.weekResetFor === wk) return false;
  const first = s.md.weekResetFor == null;
  s.md.weekResetFor = wk;
  if (!first) weeklyMDReset(s);
  return true;
}
function normalCheck(s, t) {
  const n = s.md.normal;
  if (t === "1") {            // uncheck first checked
    if (n[0]) n[0] = false;
    else if (n[1]) n[1] = false;
    else if (n[2]) n[2] = false;
    else if (s.md.rental && s.md.rentalWeek === 0) s.md.rental = false;
  } else if (t === "0") {     // check first unchecked
    if (!n[0]) n[0] = true;
    else if (!n[1]) n[1] = true;
    else if (!n[2]) n[2] = true;
    else if (!s.md.rental && s.md.rentalWeek === 0) s.md.rental = true;
  }
}

// ---------- weekly module (sets daily/weekly-left + pass/crate by weekday) ----------
function weeklyModule(s, t, d, w, l, c, n) {
  switch (t) {
    case "full":        s.md.dailyLeft = d; s.md.weeklyLeft = w; limPassAdd(s, l * n, 0); crateAdd(s, c * n); break;
    case "noCrate":     s.md.dailyLeft = d; s.md.weeklyLeft = w; limPassAdd(s, l * n, 0); break;
    case "dailyWeekly": s.md.dailyLeft = d; s.md.weeklyLeft = w; break;
    case "onlyDaily":   s.md.dailyLeft = d; break;
  }
}
function wLPXP(s, t) {
  const x = t === "normal" ? 1 : t === "undo" ? -1 : 0;
  switch (s.currentDay) {
    case "Thurs": updateCurrentDate(s); weeklyModule(s, "full", 6, 2, 1.1, 3, x); break;
    case "Fri":   weeklyModule(s, "noCrate", 5, 1, 0.4, 0, x); break;
    case "Sat":   weeklyModule(s, "onlyDaily", 4, 1, 0, 0, x); break;
    case "Sun":   weeklyModule(s, "onlyDaily", 3, 1, 0, 0, x); break;
    case "Mon":   weeklyModule(s, "full", 2, 0, 1.4, 6, x); break;
    case "Tue":   weeklyModule(s, "onlyDaily", 1, 0, 0, 0, x); break;
    case "Wed":   weeklyModule(s, "dailyWeekly", 7, 5, 0, 0, x); s.weekTilSeasonEnd += -1 * x; break;
  }
}

function manualXPLux(s, t) {
  const mult = t === "normal" ? 1 : -1;
  const tk = Array.isArray(s.constants.tickets)
    ? Object.fromEntries(s.constants.tickets.map((t) => [t.tier, t.dailyLux]))
    : s.constants.dailyLuxTickets;
  tA(s, "I", tk.I * mult);
  tA(s, "II", tk.II * mult);
  tA(s, "III", tk.III * mult);
  tA(s, "IV", tk.IV * mult);
}

// ---------- chkManLvlUp: the big effect switch ----------
function chkManLvlUp(s, type) {
  updateWeekDay(s);
  const dThreadC = s.constants.dailyThreads;
  switch (type) {
    case "dailyXP":
      manualXPLux(s, "normal"); threadAdd(s, dThreadC); limPassAdd(s, 1, 1); wLPXP(s, "normal"); fLCH(s, -26); break;
    case "normalMDXP":
      limPassAdd(s, 3, 1); s.md.normalLeftTotal -= 1; normalCheck(s, "1"); break;
    case "weeklyMDXP":
      fLCH(s, 250);
      if (s.md.hard[0])      { limPassAdd(s, 7.5, 0); crateAdd(s, 21); s.md.hard[0] = false; }
      else if (s.md.hard[1]) { limPassAdd(s, 8, 1);                    s.md.hard[1] = false; }
      else if (s.md.hard[2]) { limPassAdd(s, 9.5, 0); crateAdd(s, 27); s.md.hard[2] = false; }
      break;
    case "undoDaily":
      manualXPLux(s, "undo"); threadAdd(s, -dThreadC); limPassAdd(s, -1, 1); wLPXP(s, "undo"); fLCH(s, 26); break;
    case "undoNormal":
      limPassAdd(s, -3, 1); s.md.normalLeftTotal += 1; normalCheck(s, "0"); break;
    case "undoWeekly":
      fLCH(s, -250);
      if (!s.md.hard[2])      { limPassAdd(s, -9.5, 0); crateAdd(s, -27); s.md.hard[2] = true; }
      else if (!s.md.hard[1]) { limPassAdd(s, -8, 1);                     s.md.hard[1] = true; }
      else if (!s.md.hard[0]) { limPassAdd(s, -7.5, 0); crateAdd(s, -21); s.md.hard[0] = true; }
      break;
    case "3hmd":   fLCH(s, 750);  limPassAdd(s, 22.5, 0);  crateAdd(s, 67);  break;
    case "u3hmd":  fLCH(s, -750); limPassAdd(s, -22.5, 0); crateAdd(s, -67); break;
    case "wnormal":  fLCH(s, 250);  limPassAdd(s, 4.5, 1);  normalCheck(s, "1"); break;
    case "uwnormal": fLCH(s, -250); limPassAdd(s, -4.5, 1); normalCheck(s, "0"); break;
  }
  chkExceedMax(s);
}

// ============================================================
// Public actions (keys match constants & the menu). Each takes (state, arg?).
// ============================================================
export const ACTIONS = {
  // --- Manager XP runs ---
  addDailyXP: (s) => { manXPAdd(s, s.constants.dailyManagerXP); chkManLvlUp(s, "dailyXP"); s.lastDailyDate = todayISO(); },
  addNMDXP:   (s) => { manXPAdd(s, 100); chkManLvlUp(s, "normalMDXP"); },
  addWBMDXP:  (s) => { manXPAdd(s, 120); chkManLvlUp(s, "weeklyMDXP"); },
  add3HMD:    (s) => { manXPAdd(s, 360); chkManLvlUp(s, "3hmd"); },
  addwNormal: (s) => { manXPAdd(s, 100); chkManLvlUp(s, "wnormal"); },
  undoDailyXP:  (s) => { manXPAdd(s, -s.constants.dailyManagerXP); chkManLvlUp(s, "undoDaily"); s.lastDailyDate = null; },
  undoNMDXP:    (s) => { manXPAdd(s, -100); chkManLvlUp(s, "undoNormal"); },
  undoWBMDXP:   (s) => { manXPAdd(s, -120); chkManLvlUp(s, "undoWeekly"); },
  undo3HMD:     (s) => { manXPAdd(s, -360); chkManLvlUp(s, "u3hmd"); },
  undowNormal:  (s) => { manXPAdd(s, -100); chkManLvlUp(s, "uwnormal"); },

  // --- Day updates ---
  cmenuDayUpdate: (s) => { updateWeekDay(s); updateCurrentDate(s); maybeWeeklyReset(s); note(`Day -> ${s.currentDay}`); },
  newSeason: (s) => { s.weekTilSeasonEnd = 24; note("New season: 24 weeks to season end"); },

  // --- Lunacy / tickets (generic, driven by constants) ---
  lunacy: (s, key) => {
    const a = LUNACY_ACTIONS[key];
    if (a.paid) s.lunacy.paid = round2(s.lunacy.paid + a.paid);
    if (a.total) s.lunacy.total = round2(s.lunacy.total + a.total);
    note(`${a.label}`);
  },
  ticket: (s, key) => {
    const a = TICKET_ACTIONS[key];
    if (a.deca) s.lunacy.decaTickets += a.deca;
    if (a.ext) s.lunacy.extTickets += a.ext;
  },
  customPaidLunacy: (s, amount) => { pLCH(s, Number(amount) || 0); },
  customTickets: (s, amount) => { s.lunacy.extTickets += Number(amount) || 0; },

  // --- Pulls ---
  pull1Pull: (s) => {
    if (s.lunacy.extTickets >= PULL.single.ext) { s.lunacy.extTickets -= PULL.single.ext; note("1 pull via Extraction Ticket"); }
    else if (freeLunacy(s) >= PULL.single.lunacy) { fLCH(s, -PULL.single.lunacy); note("1 pull via 130 Lunacy"); }
    else note("Not enough for a single pull");
  },
  pull10Pulls: (s) => {
    if (s.lunacy.decaTickets >= PULL.deca.deca) { s.lunacy.decaTickets -= PULL.deca.deca; note("10 pulls via Deca Ticket"); }
    else if (s.lunacy.extTickets >= PULL.deca.ext) { s.lunacy.extTickets -= PULL.deca.ext; note("10 pulls via 10 Ext Tickets"); }
    else if (freeLunacy(s) >= PULL.deca.lunacy) { fLCH(s, -PULL.deca.lunacy); note("10 pulls via 1300 Lunacy"); }
    else note("Not enough for a 10-pull");
  },
  pullingCustom: (s, count) => {
    let x = Number(count) || 0;
    const singles = x % 10;
    const tens = (x - singles) / 10;
    for (let i = 0; i < tens; i++) ACTIONS.pull10Pulls(s);
    for (let j = 0; j < singles; j++) ACTIONS.pull1Pull(s);
  },

  // --- Gacha shard results ---
  gachaSelected: (s) => { changeShard(s, s.gacha.tier, s.gacha.sinner); },
  gachaFor: (s, sinnerName) => { changeShard(s, s.gacha.tier, sinnerName); },
  gachaTierFor: (s, tier, sinnerName) => { changeShard(s, tier, sinnerName); },

  // --- Gacha gained: mark a not-owned ID/EGO as acquired at base level ---
  acquireId: (s, idx) => { const x = s.ids[idx]; if (x) { x.acquired = true; x.uptie = 1; x.level = 1; note(`Acquired ID: ${x.name}`); } },
  acquireEgo: (s, idx) => { const x = s.egos[idx]; if (x) { x.acquired = true; x.threadspin = 1; note(`Acquired EGO: ${x.name}`); } },

  // --- Uptie ---
  uptie: (s, key) => {
    const u = UPTIE[key];
    if (u.threads) threadAdd(s, u.threads);
    if (u.lunacy) fLCH(s, u.lunacy);
    if (u.shard) changeShard(s, u.shard, s.uptie.sinner);
    // also bump the selected ID's uptie level (IDs page)
    const id = s.ids[s.uptie.idIdx];
    if (id && UPTIE_LEVEL[key] != null) { id.uptie = UPTIE_LEVEL[key]; note(`${id.name}: UT -> ${id.uptie}`); }
    note(`${u.label}: ${u.threads ? u.threads + " threads" : ""}${u.lunacy ? ", +" + u.lunacy + " lunacy" : ""}`);
  },

  // --- TS5: craft spinchains from EGO shard (1:1) or thread (2:1) ---
  threadspinTS5: (s, grade, method) => {
    const cost = SPINCHAIN[grade] || 0;
    if (method === "thread") threadAdd(s, -cost * SPINCHAIN_PER_THREAD);
    else shardAddDirect(s, s.uptie.sinner, -cost);          // 1 spinchain = 1 EGO shard
    const ego = s.egos[s.uptie.egoIdx];
    if (ego) { ego.threadspin = 5; note(`${ego.name}: TS -> 5`); }
    note(`${grade} TS5: ${cost} spinchain (${method === "thread" ? cost * SPINCHAIN_PER_THREAD + " threads" : cost + " shards"})`);
  },

  // --- Thread spinning ---
  threadspin: (s, grade, step) => {
    const g = THREADSPIN[grade];
    threadAdd(s, g[step]);
    if (step === "TS4") changeShard(s, g.shard, s.uptie.sinner);
    // also set the selected EGO's TS level (EGOs page)
    const ego = s.egos[s.uptie.egoIdx];
    if (ego && TS_STEP_LEVEL[step] != null) { ego.threadspin = TS_STEP_LEVEL[step]; note(`${ego.name}: TS -> ${ego.threadspin}`); }
    note(`${grade} ${step}: ${g[step]} threads`);
  },

  // --- For Completing Intervallo Shop (ported from Code.gs) ---
  // Buys out a shop item: adds its resource to inventory, deducts the currency,
  // and marks it fully bought. perUnit = resource gained per shop unit.
  intvStart:        (s) => { s.event.items.forEach((it) => { it.bought = 0; }); s.event.rewards.forEach((r) => { r.claimed = false; }); note("Intervallo start: shop reset"); },
  intvIV:           (s) => buyEventItem(s, "IV Ticket", 1, (s2, n) => tA(s2, "IV", n)),
  intvIII:          (s) => buyEventItem(s, "III Ticket", 1, (s2, n) => tA(s2, "III", n)),
  intvBothTickets:  (s) => { ACTIONS.intvIV(s); ACTIONS.intvIII(s); },
  intvThreads:      (s) => buyEventItem(s, "Threads", 5, (s2, n) => threadAdd(s2, n)),
  intvCrates:       (s) => buyEventItem(s, "Crates", 5, (s2, n) => crateAdd(s2, n)),
  intvRandomCrates: (s) => buyEventItem(s, "Random Crates", 0, null),
  intvEnkeBox:      (s) => buyEventItem(s, "Enkephalin Box", 0, null),
  intvExtraction:   (s) => buyEventItem(s, "Extraction Ticket", 1, (s2, n) => { s2.lunacy.extTickets = round2((s2.lunacy.extTickets || 0) + n); }),
  intvTheRest:      (s) => { s.event.rewards.forEach((r) => { r.claimed = true; }); note("Intervallo: all rewards claimed"); },

  // --- Full daily schedule (Daily Paid Pull + Monthly Free, then Daily Lux) ---
  fullCourse: (s) => { pLCH(s, -13); fLCH(s, 91); ACTIONS.addDailyXP(s); note("Full daily schedule done"); },
};

// Recompute derived fields (kept in sync for display).
export function recompute(s) {
  recomputeNextLevelXP(s);
}

// Run an action by descriptor, returning the log lines it produced.
export function run(state, fn) {
  LOG = [];
  fn(state);
  return LOG.slice();
}
