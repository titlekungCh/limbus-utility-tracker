// Projection/forecast calculations ported from the Inventory sheet formulas.
// Each was verified against the spreadsheet's cached values.
import { THREADSPIN, SHARD_DELTA } from "./constants.js";
const round2 = (n) => Math.round(n * 100) / 100;

// Manager XP: "After 1..7 Daily" and "+1 MD" (Inventory I10:I16 / J10:J16),
// plus the next-level enkephalin flag (K9).
export function managerForecast(s) {
  const daily = s.constants.dailyManagerXP;
  const cur = s.manager.currentXP;
  const rows = [];
  for (let i = 1; i <= 7; i++) {
    const afterDaily = round2(cur + daily * i);
    rows.push({ n: i, afterDaily, afterMD: round2(afterDaily + 100) });
  }
  const nextRow = s.constants.managerCurve.find((r) => r.level === s.manager.level + 1);
  const enk = nextRow && nextRow.maxIncrease !== 0 ? "+1" : "0";
  return { rows, nextLevelXP: s.manager.nextLevelXP, enk };
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
    };
  });
}

// ID leveling: XP needed to take a chosen ID from its current level to a target
// (Inventory M1/M2/M3). xpNeeded = totalXP(target) - totalXP(current) - levelExtra.
export function totalXPAt(s, level) {
  const c = s.constants.idLevelCurve.find((r) => r.level === Math.round(level));
  return c ? c.totalXP : null;
}
export function idLeveling(s, idx, target) {
  const id = s.ids[idx];
  if (!id) return null;
  const current = id.level || 1;
  const atCur = totalXPAt(s, current) ?? 0;
  const atTarget = totalXPAt(s, target) ?? 0;
  // XP needed = totalXP(target) - totalXP(current) - current "level extra" XP (N9).
  const xpNeeded = Math.max(0, round2(atTarget - atCur - (id.levelExtra || 0)));

  // Greedy EXP-ticket breakdown (Inventory M11:M14): IV=3000, III=1000, II=200, I=50.
  const xp = s.constants.ticketXP;
  let rem = xpNeeded;
  const need = {};
  for (const tier of ["IV", "III", "II", "I"]) {
    need[tier] = Math.floor(rem / xp[tier]);
    rem -= need[tier] * xp[tier];
  }
  const owned = s.inventory.tickets;
  const left = { IV: owned.IV - need.IV, III: owned.III - need.III, II: owned.II - need.II, I: owned.I - need.I };

  return { name: id.name, sinner: id.sinner, current, target, atCur, atTarget, levelExtra: id.levelExtra || 0, xpNeeded, need, left, leftover: rem };
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
  const clamp = (v) => Math.max(1, Math.min(TS_MAX, Math.round(Number(v) || 1)));
  const cur = clamp(curRaw), tgt = clamp(target);
  let threads = 0, shard = 0;
  if (cum) {
    threads = Math.max(0, cum[tgt] - cum[cur]);
    shard = (cur < 4 && tgt >= 4) ? Math.abs(SHARD_DELTA[grade] || 0) : 0; // TS4 shards once
  }
  // EGO shard comes from the sinner the EGO belongs to.
  const sinnerObj = s.sinners.find((x) => x.name === ego.sinner);
  const shardOwned = sinnerObj ? sinnerObj.shards : 0;
  return {
    name: ego.name, sinner: ego.sinner, grade, valid: !!cum,
    current: curRaw, currentNum: cur, target: tgt,
    threads, shard,
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
