// Projection/forecast calculations ported from the Inventory sheet formulas.
// Each was verified against the spreadsheet's cached values.
import { THREADSPIN, SHARD_DELTA, SPINCHAIN, SPINCHAIN_PER_THREAD } from "./constants.js";
const round2 = (n) => Math.round(n * 100) / 100;

// Rental runs every other week; the 2026-06-18 patch week (a Thursday) is a
// NON-rental week. weeksFromAnchor counts weeks from that Thursday.
const RENTAL_ANCHOR = Date.parse("2026-06-18T00:00:00");
const ANCHOR_ISO = "2026-06-18";
const weeksFromAnchor = (iso) =>
  Math.round((Date.parse((iso || ANCHOR_ISO) + "T00:00:00") - RENTAL_ANCHOR) / (7 * 24 * 3600 * 1000));
const isRentalWeek = (wk) => (((wk % 2) + 2) % 2) === 1; // anchor week even -> no rental
// Single source of truth for the stored md.rentalWeek flag (0 = rental week,
// 1 = non-rental week — matches Code.gs / normalCheck), derived from the patch date.
export const rentalWeekFlag = (iso) => (isRentalWeek(weeksFromAnchor(iso)) ? 0 : 1);
// A week's MD types in run order: (Hard, Normal) x3, then a Rental (counts as
// Normal) on rental weeks. "H" = Hard (+120 XP), "N"/"R" = +100 XP.
const weekTypes = (rental) => (rental ? ["H", "N", "H", "N", "H", "N", "R"] : ["H", "N", "H", "N", "H", "N"]);

// The next `count` Mirror Dungeon runs (true = Hard), rolled up from the first
// run not yet done this week (read off the Mirror Dungeon card) and continuing
// into following weeks (rental alternates). Week starts Thursday.
export function mdSchedule(s, count = 7) {
  const md = s.md;
  const w0 = weeksFromAnchor(s.lunacy && s.lunacy.currentDate);
  const rental0 = isRentalWeek(w0);
  const pending = []; // true = still to do (its pill on the MD card isn't struck)
  for (let i = 0; i < 3; i++) { pending.push(!!(md.hard && md.hard[i])); pending.push(!!(md.normal && md.normal[i])); }
  if (rental0) pending.push(!!md.rental);
  let start = pending.findIndex((p) => p);
  if (start < 0) start = pending.length;            // all done -> start next week
  const types = weekTypes(rental0).slice(start);
  for (let k = 1; types.length < count; k++) types.push(...weekTypes(isRentalWeek(w0 + k)));
  return types.slice(0, count).map((t) => t === "H");
}
export function nextMDIsHard(s) { return mdSchedule(s, 1)[0]; }

// Manager XP forecast: two independent projections from the current XP. "After N
// Daily" = current + N dailies; "after MD" = current + the first N scheduled MDs
// (cumulative). `cumMD` is the MD XP added so far, `mdHard` flags that row's MD
// type, `levels` flags any value that reaches the next-level XP.
export function managerForecast(s) {
  const daily = s.constants.dailyManagerXP;
  const cur = s.manager.currentXP;
  const nextXP = s.manager.nextLevelXP;
  const sched = mdSchedule(s, 7);
  const rows = [];
  let cumMD = 0;
  for (let i = 1; i <= 7; i++) {
    const hard = sched[i - 1];
    cumMD += hard ? 120 : 100;
    const afterDaily = round2(cur + daily * i);
    const afterMD = round2(cur + cumMD);   // MD-only projection from current XP (independent of dailies)
    rows.push({
      n: i, afterDaily, afterMD, mdHard: hard, cumMD,
      dailyLevels: afterDaily >= nextXP, mdLevels: afterMD >= nextXP,
    });
  }
  const nextRow = s.constants.managerCurve.find((r) => r.level === s.manager.level + 1);
  const enk = nextRow && nextRow.maxIncrease !== 0 ? "+1" : "0";
  return { rows, nextLevelXP: nextXP, enk };
}

// Crate + Pass forecasts (Inventory C/D 17-23 and E/F 17-23).
// Pass gain is independent of crates; crate-to-grind drives the pass requirement;
// crate-final depends on pass-final — computed in that order (no real cycle).
export function resourceForecast(s) {
  const m = s.md;
  const h = m.hard.map((b) => (b ? 1 : 0));
  const n = m.normal.map((b) => (b ? 1 : 0));
  const K18 = s.weekTilSeasonEnd, H18 = m.dailyLeft, I18 = m.weeklyLeft, J18 = m.normalLeftTotal;

  const passCur = s.inventory.pass;
  const hardPass = h[0] * 7.5 + h[1] * 8 + h[2] * 9.5;
  const passWillGain = round2(34 * K18 + H18 + 0.4 * I18 + hardPass + J18 * 3);            // F21
  const passFinal = round2(passCur + passWillGain);                                        // F22
  const passThisWeek = round2(passCur + H18 + 0.4 * I18 + hardPass + (n[0] + n[1] + n[2]) * 3); // D17 helper

  // Crate Required (D18) = SUM of the *derived* per-sinner crate needs.
  const crateRequired = round2(shardPlanRows(s).reduce((a, r) => a + r.crateNeeded, 0)); // D18
  const cratePossessed = s.inventory.crate;                                                // D19
  const crateToGrind = Math.max(0, round2(crateRequired - cratePossessed));                // D20
  const crateFinal = Math.floor(passFinal - passCur) * 3 + cratePossessed;                 // D21
  const crateThisWeek = round2(cratePossessed + (passThisWeek - Math.floor(passCur)) * 3); // D17
  const cap000Now = Math.floor((cratePossessed * 2) / 400);                                // D22
  const cap000End = Math.floor((crateFinal * 2) / 400);                                     // D23

  const passReq = Math.ceil(crateToGrind / 3);                                             // F18
  const passGoal = round2(passCur + passReq);                                              // F20

  return {
    pass: { current: passCur, willGain: passWillGain, final: passFinal, thisWeek: passThisWeek, requirement: passReq, goal: passGoal },
    crate: { required: crateRequired, possessed: cratePossessed, toGrind: crateToGrind, final: crateFinal, thisWeek: crateThisWeek, cap000Now, cap000End },
  };
}

// Per-sinner shard plan rollup. Everything is derived (faithful to Inventory
// array formulas A27/A28/A29/A32):
//   shardNeeded  = VLOOKUP(type, ShardNumber, 2)
//   shardsOwned  = live sinner shards
//   crateNeeded  = enabled ? max(0, (shardNeeded - owned)/2) : 0   (row 24 toggle)
//   threadNeeded = VLOOKUP(type, ShardNumber, 3)
// The only inputs are the shard Type and the per-sinner Enabled toggle.
export function shardPlanRows(s) {
  const lookup = (type) => s.constants.shardTable.find((t) => t.type === type) || {};
  return s.shardPlan.map((p, i) => {
    const sinner = s.sinners[i];
    const t = lookup(p.type);
    const shardNeeded = t.shardNeeded ?? 0;
    const shardShort = Math.max(0, round2(shardNeeded - sinner.shards));
    return {
      index: i,
      sinner: sinner.name,
      acronym: sinner.acronym,
      type: p.type,
      enabled: p.enabled,
      shardNeeded,
      shardsOwned: sinner.shards,
      shardShort,
      crateNeeded: p.enabled ? round2(shardShort / 2) : 0,
      threadNeeded: t.threadNeeded ?? 0,
      target: p.target || "",
      targetMode: p.targetMode || "text",
      targetA: p.targetA || "",
      targetB: p.targetB || "",
      targetAUT: !!p.targetAUT,
      targetBUT: !!p.targetBUT,
    };
  });
}

// ID leveling: XP needed to take a chosen ID from its current level to a target
// (Inventory M1/M2/M3). xpNeeded = totalXP(target) - totalXP(current) - levelExtra.
export function totalXPAt(s, level) {
  const c = s.constants.idLevelCurve.find((r) => r.level === Math.round(level));
  return c ? c.totalXP : null;
}
// EXP-ticket XP values (Inventory M11:M14): IV=3000, III=1000, II=200, I=50.
export function ticketXpMap(s) {
  return Array.isArray(s.constants.tickets)
    ? Object.fromEntries(s.constants.tickets.map((t) => [t.tier, t.xp]))
    : s.constants.ticketXP;
}
const TICKET_ORDER = ["IV", "III", "II", "I"];

// Shift one EXP ticket of `tier` in the planned breakdown without changing the
// total XP covered: lowering a tier (dir<0) refills the gap with the tiers below
// it; raising a tier (dir>0) pulls that XP back out of the lower tiers. Returns a
// new counts object, or null if the move isn't possible (no lower tier / nothing
// to give back). All ticket XP values are exact multiples of the smaller ones, so
// the greedy refill always lands exactly.
export function adjustTicketUse(s, counts, tier, dir) {
  const xp = ticketXpMap(s);
  const lower = TICKET_ORDER.slice(TICKET_ORDER.indexOf(tier) + 1);
  if (!lower.length) return null;                       // Tier I: nothing below
  const lowerXP = lower.reduce((a, t) => a + (counts[t] || 0) * xp[t], 0);
  const next = { ...counts };
  if (dir < 0) {
    if ((next[tier] || 0) <= 0) return null;
    next[tier] -= 1;
  } else {
    if (lowerXP < xp[tier]) return null;                // not enough below to give back
    next[tier] += 1;
  }
  let remaining = lowerXP + (dir < 0 ? xp[tier] : -xp[tier]);
  for (const t of lower) { next[t] = Math.floor(remaining / xp[t]); remaining -= next[t] * xp[t]; }
  return next;
}
// Highest curve level whose cumulative totalXP is <= xp, plus the partial XP past it.
export function levelForTotalXP(s, xp) {
  const curve = s.constants.idLevelCurve;
  let best = curve[0];
  for (const r of curve) { if (r.totalXP <= xp) best = r; else break; }
  return { level: best.level, extra: round2(xp - best.totalXP) };
}
export function idLeveling(s, idx, target) {
  const id = s.ids[idx];
  if (!id) return null;
  const current = id.level || 1;
  const atCur = totalXPAt(s, current) ?? 0;
  const atTarget = totalXPAt(s, target) ?? 0;
  // XP needed = totalXP(target) - totalXP(current) - current "level extra" XP (N9).
  const xpNeeded = Math.max(0, round2(atTarget - atCur - (id.levelExtra || 0)));

  // Greedy EXP-ticket breakdown, flooring each tier so the tickets never overshoot
  // the target: after applying them you are < one Tier I ticket (50 XP) short, so
  // no ticket XP is ever wasted (the `leftover` is filled by normal play).
  const xp = ticketXpMap(s);
  let rem = xpNeeded;
  const need = {};
  for (const tier of ["IV", "III", "II", "I"]) {
    need[tier] = Math.floor(rem / xp[tier]);
    rem -= need[tier] * xp[tier];
  }
  const owned = s.inventory.tickets;
  const left = { IV: owned.IV - need.IV, III: owned.III - need.III, II: owned.II - need.II, I: owned.I - need.I };
  const affordable = left.IV >= 0 && left.III >= 0 && left.II >= 0 && left.I >= 0;

  return { name: id.name, sinner: id.sinner, current, target, atCur, atTarget, levelExtra: id.levelExtra || 0, xpNeeded, need, left, affordable, leftover: rem };
}

// Spend the EXP tickets from `idLeveling` on the chosen ID: subtract them from the
// inventory and raise the ID's level / level-extra XP. Capped at owned tickets so
// inventory never goes negative. Returns a summary, or null if nothing to do.
export function applyIdLeveling(s, idx, target, counts) {
  const res = idLeveling(s, idx, target);
  if (!res || res.xpNeeded <= 0) return null;
  const id = s.ids[idx];
  const xp = ticketXpMap(s);
  const owned = s.inventory.tickets;
  const use = counts || res.need;
  const used = {};
  let appliedXP = 0;
  for (const tier of ["IV", "III", "II", "I"]) {
    used[tier] = Math.min(use[tier] || 0, owned[tier] || 0);
    appliedXP += used[tier] * xp[tier];
    owned[tier] = (owned[tier] || 0) - used[tier];
  }
  const newTotal = res.atCur + (id.levelExtra || 0) + appliedXP;
  const { level, extra } = levelForTotalXP(s, newTotal);
  id.level = level;
  id.levelExtra = extra;
  return { name: id.name, used, appliedXP, fromLevel: res.current, newLevel: level, newExtra: extra, target };
}

export const SHARD_TYPES = (s) => s.constants.shardTable.map((t) => t.type);

// EGO threadspinning: threads + EGO shard to spin from current TS to target TS,
// using the Thread Spinning quick-button costs per grade (TS4 also shards).
// Cumulative threads to reach TS level (1..5); TS5 == TS4 (no further spin step).
export const TS_MAX = 5;
function tsCumulative(grade) {
  const c = THREADSPIN[grade];
  if (!c) return null;
  const a = Math.abs(c.TS2), b = Math.abs(c.TS3), d = Math.abs(c.TS4);
  return [null, 0, a, a + b, a + b + d, a + b + d]; // index 1..5
}
export function egoThreadspin(s, idx, target) {
  const ego = s.egos[idx];
  if (!ego) return null;
  const grade = ego.tier;
  const cum = tsCumulative(grade);
  const curRaw = ego.threadspin;
  const maxTS = ego.ts5 ? TS_MAX : 4;        // TS5 only if released for this EGO
  const clamp = (v) => Math.max(1, Math.min(maxTS, Math.round(Number(v) || 1)));
  const cur = clamp(curRaw), tgt = clamp(target);
  let threads = 0, shard = 0, spinchain = 0;
  if (cum) {
    threads = Math.max(0, cum[tgt] - cum[cur]);
    shard = (cur < 4 && tgt >= 4) ? Math.abs(SHARD_DELTA[grade] || 0) : 0; // TS4 shards once
    spinchain = (ego.ts5 && cur < 5 && tgt >= 5) ? (SPINCHAIN[grade] || 0) : 0; // TS5 spinchain cost
  }
  // EGO shard comes from the sinner the EGO belongs to.
  const sinnerObj = s.sinners.find((x) => x.name === ego.sinner);
  const shardOwned = sinnerObj ? sinnerObj.shards : 0;
  return {
    name: ego.name, sinner: ego.sinner, grade, valid: !!cum,
    current: curRaw, currentNum: cur, target: tgt,
    threads, shard, spinchain,
    scShard: spinchain,                          // craft 1 spinchain from 1 EGO shard
    scThread: spinchain * SPINCHAIN_PER_THREAD,  // or from 2 threads
    threadsOwned: s.inventory.threads, threadsLeft: round2(s.inventory.threads - threads),
    shardOwned, shardLeft: round2(shardOwned - shard),
  };
}

// ---- Intervallo event-shop planner (Inventory A1:G13) ----
export const REWARD_TYPES = ["EGO", "000 ID", "00 ID"];
const REWARD_TYPE_COST = { EGO: 1000, "000 ID": 1000, "00 ID": 500 }; // A4 = SWITCH(A15,...)

export function eventShop(s) {
  const e = s.event;
  // ID/EGO reward (index 0) cost follows the Reward Type; others are fixed.
  const rewardCost = (r, i) => (i === 0 ? (REWARD_TYPE_COST[e.rewardType] ?? r.cost) : r.cost);

  const items = e.items.map((it) => {
    const remaining = Math.max(0, round2(it.total - it.bought));
    return { ...it, remaining, toFinish: round2(remaining * it.cost) };
  });
  const rewards = e.rewards.map((r, i) => {
    const cost = rewardCost(r, i);
    return { ...r, cost, due: r.claimed ? 0 : cost };
  });

  const itemsCost = items.reduce((a, it) => a + it.toFinish, 0);              // Σ cost·remaining
  const rewardsCost = rewards.reduce((a, r) => a + r.due, 0);                 // Σ cost·notClaimed
  const required = round2(itemsCost + rewardsCost);                          // B12
  // D12 excludes the still-unclaimed Banner (idx2) and Ticket (idx4) rewards.
  const needed = round2(required - rewards[2].due - rewards[4].due);         // D12
  const shortRequired = round2(required - e.currency);                       // B13
  const shortNeeded = round2(needed - e.currency);                           // D13

  return { items, rewards, required, needed, currency: e.currency, shortRequired, shortNeeded };
}
