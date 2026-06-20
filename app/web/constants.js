// Constants ported verbatim from Code.gs (the Apps Script).
// All "cost" numbers below mirror the original functions so the app behaves
// identically to the spreadsheet's Quick Buttons menu.

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thurs", "Fri", "Sat"];

// changeShard(shardType, sinner): delta applied to a sinner's shard count.
export const SHARD_DELTA = {
  "1Star": 3,
  "2Star": 15,
  "3Star": 50,
  S3S: -400,
  UT4: -50,
  "1SUT4": -20,
  "2SUT4": -30,
  "3SUT4": -50,
  ZAYIN: -80,
  TETH: -90,
  HE: -100,
  WAW: -150,
};

export const GACHA_TIERS = ["1Star", "2Star", "3Star"];

// Uptie menu: each entry = {threads, lunacy?, shard?:shardType, stars}. shard
// applies to the uptie sinner. `stars` = ID rarity the entry is for (1=0, 2=00,
// 3=000; 0 = any). A 1★ (0) ID only has UT4 (50 threads + 20 shard).
export const UPTIE = {
  ut4_0:      { label: "0 UT4 (50) +20 Shard",       threads: -50, shard: "1SUT4", stars: 1 },
  ut2_00:     { label: "00 UT2 (10)",                threads: -10, stars: 2 },
  ut3_00:     { label: "00 UT3 (40)",                threads: -40, lunacy: 40, stars: 2 },
  ut4_00:     { label: "00 UT4 (100) +30 Shard",     threads: -100, shard: "2SUT4", stars: 2 },
  ut3_00Ft1:  { label: "00 UT3 from UT1 (50)",       threads: -50, lunacy: 40, stars: 2, from: 1 },
  ut2_000:    { label: "000 UT2 (20)",               threads: -20, stars: 3 },
  ut3_000:    { label: "000 UT3 (80)",               threads: -80, lunacy: 40, stars: 3 },
  ut4_000:    { label: "000 UT4 (150) +50 Shard",    threads: -150, shard: "3SUT4", stars: 3 },
  ut3_000Ft1: { label: "000 UT3 from UT1 (100)",     threads: -100, lunacy: 40, stars: 3, from: 1 },
  ut4_module: { label: "UT4 Module",                 threads: 0, lunacy: 40, stars: 3, from: 1 },
};

// Thread-spinning menu, grouped by EGO grade. 4th step also shards the uptie sinner.
export const THREADSPIN = {
  ZAYIN: { TS2: -20, TS3: -60, TS3_1: -80,  TS4: -110, shard: "ZAYIN" },
  TETH:  { TS2: -25, TS3: -70, TS3_1: -95,  TS4: -130, shard: "TETH"  },
  HE:    { TS2: -30, TS3: -80, TS3_1: -110, TS4: -150, shard: "HE"    },
  WAW:   { TS2: -35, TS3: -90, TS3_1: -125, TS4: -170, shard: "WAW"   },
};
// TS5 (TS4 -> TS5) costs spinchains per grade. Spinchains aren't stockpiled —
// they're crafted at use from 1 EGO shard (1:1) or 2 threads (2:1).
export const SPINCHAIN = { ZAYIN: 125, TETH: 150, HE: 175, WAW: 225 };
export const SPINCHAIN_PER_THREAD = 2; // 2 threads -> 1 spinchain
// Target TS level for each thread-spin step (used to set the EGO's TS on click).
export const TS_STEP_LEVEL = { TS2: 2, TS3: 3, TS3_1: 3, TS4: 4, TS5: 5 };
// Target uptie level for each Uptie menu entry (used to set the ID's UT on click).
export const UPTIE_LEVEL = {
  ut4_0: 4,
  ut2_00: 2, ut3_00: 3, ut4_00: 4, ut3_00Ft1: 3,
  ut2_000: 2, ut3_000: 3, ut4_000: 4, ut3_000Ft1: 3, ut4_module: 4,
};

// Lunacy extractions menu. Each entry = net {paid, total} deltas applied to
// lunacy.paid and lunacy.total (free lunacy = total - paid is derived).
// Mirrors pLCH (changes paid AND total) and fLCH (changes total only).
export const LUNACY_ACTIONS = {
  mthlyFLunacy: { label: "Monthly Free Lunacy (+65)",       total: 65 },
  freePull:     { label: "Daily Paid Pull (-13)",          paid: -13, total: -13 },
  mf6513Lunacy: { label: "Daily Paid Pull + Monthly Free", paid: -13, total: 91 }, // pLCH(-13)+fLCH(104)
  f300Lunacy:   { label: "300 Free Lunacy",                total: 300 },
  f500Lunacy:   { label: "500 Free Lunacy",                total: 500 },
  f800Lunacy:   { label: "800 Free Lunacy",                total: 800 },
  f1300Lunacy:  { label: "1300 Free Lunacy",               total: 1300 },
  monthlyPL:    { label: "650 Paid Lunacy",                paid: 650, total: 650 },
};

// Ticket-grant menu.
export const TICKET_ACTIONS = {
  free10Pulls: { label: "Free Deca Ticket (+1)",       deca: 1 },
  free10Sep:   { label: "Free 10 Single Tickets",      ext: 10 },
  free1Sep:    { label: "Free 1 Single Ticket",        ext: 1 },
};

// Single-pull / 10-pull cost rules (pull1Pull / pull10Pulls in Code.gs).
export const PULL = {
  single: { ext: 1, lunacy: 130 },
  deca:   { deca: 1, ext: 10, lunacy: 1300 },
};

// Manager-XP runs. xp = manager XP added; effects applied in logic.js by key.
export const XP_RUNS = {
  addDailyXP:  { label: "Daily Luxcavation" },          // xp from constants.dailyManagerXP
  addNMDXP:    { label: "1 Normal MD Run",  xp: 100 },
  addWBMDXP:   { label: "1 Weekly Bonus Hard MD", xp: 120 },
  add3HMD:     { label: "3 Hard MD at once", xp: 360 },
  addwNormal:  { label: "1 Weekly Normal MD", xp: 100 },
};

// Sinner name -> index (0..11), matching DataSheet J1..J12 order.
export const SINNER_ORDER = [
  "Yi Sang", "Faust", "Don Quixote", "Ryoshu", "Meursault", "Hong Lu",
  "Heathcliff", "Ishmael", "Rodion", "Sinclair", "Outis", "Gregor",
];

// Per-sinner colours (fill + font) from the ID Level / EGO Tier conditional
// formatting — applied to the ID/EGO name cell.
export const SINNER_COLORS = {
  "Yi Sang":     { fill: "#E8EAED", font: "#202124" },
  "Faust":       { fill: "#FFCFC9", font: "#D92A2A" },
  "Don Quixote": { fill: "#FFE5A0", font: "#202124" },
  "Ryoshu":      { fill: "#D82E2E", font: "#F4CCCC" },
  "Meursault":   { fill: "#BFE1F6", font: "#1C4587" },
  "Hong Lu":     { fill: "#C6DBE1", font: "#073763" },
  "Heathcliff":  { fill: "#E6CFF2", font: "#351C75" },
  "Ishmael":     { fill: "#FFC076", font: "#20124D" },
  "Rodion":      { fill: "#A22323", font: "#FFFFFF" },
  "Sinclair":    { fill: "#D4EDBC", font: "#134F5C" },
  "Outis":       { fill: "#85CAB1", font: "#EFEFEF" },
  "Gregor":      { fill: "#DAA473", font: "#FCE5CD" },
};

// ID Level (col J) cellIs-equal fills; non-matching levels use the default.
export const LEVEL_FILL = {
  20: "#DAA473", 25: "#A22323", 30: "#D4EDBC", 35: "#E8EAED", 40: "#FFC076",
  45: "#E6CFF2", 50: "#FFE5A0", 55: "#C6DBE1", 60: "#D82E2E", 65: "#BFE1F6",
  70: "#85CAB1", 75: "#FFCFC9", 80: "#B10202", 85: "#FF0000",
};
export const LEVEL_FILL_DEFAULT = "#E8EAED";

// Uptie / Threadspin 3-stop colour scale (0 -> red, 2 -> yellow, 4 -> green).
export const SCALE_STOPS = [
  { at: 0, rgb: [0xE6, 0x7C, 0x73] },
  { at: 2, rgb: [0xFF, 0xD6, 0x66] },
  { at: 4, rgb: [0x57, 0xBB, 0x8A] },
];

// Shard-type fills (Inventory B18/B26:M26/I4 conditional formatting).
export const SHARD_TYPE_FILL = {
  "EGO/3 Star": "#FF9E00", "2 3 Star + UT4": "#FFF243", "2 Star": "#B10202",
  "000 UT4": "#FFE5A0", ZAYIN: "#D4EDBC", TETH: "#BFE1F6", HE: "#f3f3b4",
  WAW: "#E6CFF2", None: "#E8EAED", "3 Star UT": "#FFE400", "00 UT4": "#B10202",
  "2 3 Star": "#FFF243", ALEPH: "#F2CFCF",
};

// Gacha-tier fills (Inventory B36:M36/H5/L16).
export const GACHA_TIER_FILL = { "1Star": "#FFC8AA", "2Star": "#FFCFC9", "3Star": "#FFE5A0" };

// Lunacy & ticket fills (Lunacy sheet A1:E1).
export const LUNACY_FILL = { lunacy: "#F4CCCC", ticket: "#FFE599" };

// Daily-left / weekly-left value fills (Inventory H18 / I18 conditional formatting).
export const DAILY_LEFT_FILL = { 1: "#FFC9EF", 2: "#FFE5A0", 3: "#FFCFC9", 4: "#E6CFF2", 5: "#BFE1F6", 6: "#FFC8AA", 7: "#D4EDBC" };
export const WEEKLY_LEFT_FILL = { 0: "#FFE5A0", 1: "#BFE1F6", 2: "#FFC8AA", 5: "#D4EDBC" };

// Inventory item fills (DataSheet I13:J15 crate/pass/threads, I30:K33 tickets).
export const INVENTORY_FILL = {
  crate: "#FFE599", pass: "#EA9999", threads: "#EFEFEF",
  "tickets.I": "#C87329", "tickets.II": "#BDBDBD", "tickets.III": "#FFC000", "tickets.IV": "#02CFCB",
};

// Day-of-week fills (Inventory H18/J6/K14).
export const DAY_FILL = {
  Mon: "#FFE5A0", Tue: "#FFC9EF", Wed: "#D4EDBC", Thurs: "#FFC8AA",
  Fri: "#BFE1F6", Sat: "#E6CFF2", Sun: "#FFCFC9",
};

// Event-shop header fills (Inventory A8:G8 items, A10:F10 rewards) — keyed by name.
export const EVENT_ITEM_FILL = {
  "IV Ticket": "#6D9EEB", "III Ticket": "#FFD966", Threads: "#FCE5CD", Crates: "#FFE599",
  "Random Crates": "#EA9999", "Enkephalin Box": "#B6D7A8", "Extraction Ticket": "#FFF243",
};
export const EVENT_REWARD_FILL = {
  "ID/EGO Reward": "#FF0000", Announcer: "#00FFFF", Banner: "#00FF00",
  "Banner Effect": "#D9EAD3", Ticket: "#FFFF00", "Ticket Effect": "#FFF2CC",
};

// EGO Sin colours (sampled from the user's reference image).
export const SIN_ORDER = ["Wrath", "Lust", "Sloth", "Gluttony", "Gloom", "Pride", "Envy"];
export const SIN_FILL = {
  Wrath: "#F2CFCF", Lust: "#FFDAC6", Sloth: "#FFF6C6", Gluttony: "#D4EDBC",
  Gloom: "#BFE1F6", Pride: "#C6C8E1", Envy: "#E6CFF2",
};

// Combat status colours (sampled from the user's keyword reference image).
// Search order = priority when a cell holds more than one status.
export const STATUS_ORDER = ["Sinking", "Tremor", "Rupture", "Bleed", "Burn", "Poise", "Charge"];
export const STATUS_FILL = {
  Burn: "#FF0000", Bleed: "#FF4F00", Tremor: "#FFED00", Rupture: "#00FF03",
  Sinking: "#00FFFA", Poise: "#0021FF", Charge: "#AE00FF",
};
// Keyword tag colours = statuses plus "No Keyword".
export const KEYWORD_FILL = { ...STATUS_FILL, "No Keyword": "#E9E8E8" };
// Fixed display order for the Keyword dropdown (matches the in-game status list).
export const KEYWORD_ORDER = ["Burn", "Bleed", "Tremor", "Rupture", "Sinking", "Poise", "Charge", "No Keyword"];

// Extra-keyword option list — the union of the sheet's ID Level M and EGO Tier L
// data validations, shared by both the IDs and EGOs Extra Keyword pickers.
export const EXTRA_KEYWORD_ALL = ["Paralyze", "Bind", "Haste", "Protection", "Attack Type DMG/Power Up", "Sin DMG/Power Up", "Ammo", "Plus Coin Drop", "Offense Level Up", "Offense Level Down", "Defense Level Up", "Defense Level Down", "Damage Up", "Retreat", "Reload", "Assist Attack", "Assist Defense", "Defense Power Up", "Defense Power Down", "Damage Down", "Amplitude Conversion", "Amplitude Entanglement", "Aggro", "Attack Power Up", "Attack Power Down", "Power Up", "Power Down", "Plus Coin Boost", "Fragile", "Attack Type Fragility", "Sin Fragility", "Sin Protection", "Attack Type Protection", "Keyword Protection", "Unbreakable Coin", "Unfocused Volley", "Attack Type Resist Down", "Sin Resist Down", "Clash Power Up", "Clash Power Down", "Shin", "Load", "Photoelectricity", "Dimensional Rift", "Tremor Burst", "Tremor - Superposition", "Tremor - Chain", "Tremor - Decay", "Tremor - Reverb", "Tremor - Scorch", "Tremor - Hemorrhage", "Tremor - Fracture", "Tremor - Everlasting", "Tremor - Clockwinding", "Discard", "Clashable Guard", "Clashable Counter", "Bloodfeast", "Deathrite", "Crit DMG Up", "HP Healing Down", "Weak-resist DMG Boost", "SP Healing Efficiency", "SP Loss Efficiency", "E.G.O Resource Amp", "Nail", "Curse"];

// Uptie/Threadspin value 5 = "maxed" (ID Level col L cellIs "= 5" rule, theme accent4).
export const SCALE_MAX5 = "#34A853";

// Season tag colours (sampled from the user's reference image). Priority for
// the whole cell colour: Walpurgisnaught > season number > Standard Fare.
export const SEASON_FILL = {
  Walpurgisnaught: "#38FF00",
  "Standard Fare": "#FFD02E",
};
export const SEASON_NUMBER_FILL = {
  1: "#A80000", 2: "#E2E2E2", 3: "#00CABF", 4: "#B32AFF", 5: "#FFE300",
  6: "#00FFB5", 7: "#FF0000", 8: "#00809E", 9: "#007C60", 10: "#FFCFC9",
};

// ID Tier (★ count) colours (sampled from the user's reference image).
export const TIER_FILL = { 1: "#966537", 2: "#FF1C00", 3: "#FFEC00" };

// Resource icons (from limbuscompany.wiki.gg), kept in app/web/icons/resource.
export const RESOURCE_ICON = {
  thread: "icons/resource/thread.webp",
  spinchain: "icons/resource/spinchain.webp",
  egoshard: "icons/resource/egoshard.webp",
  lunacy: "icons/resource/lunacy.webp",
  extraction: "icons/resource/extraction.webp",
  deca: "icons/resource/deca.png",
  I: "icons/resource/ticket-1.webp",
  II: "icons/resource/ticket-2.webp",
  III: "icons/resource/ticket-3.webp",
  IV: "icons/resource/ticket-4.webp",
  crate: "icons/resource/crate.webp",
  randomCrate: "icons/resource/random-crate.webp",
  enkephalin: "icons/resource/enkephalin.webp",
  ego: "icons/resource/ego.webp",
};
// Event-shop item name -> resource icon (shown before the item name + on buy-out buttons).
export const EVENT_ITEM_ICON = {
  "IV Ticket": "icons/resource/ticket-4.webp",
  "III Ticket": "icons/resource/ticket-3.webp",
  "Threads": "icons/resource/thread.webp",
  "Crates": "icons/resource/crate.webp",
  "Random Crates": "icons/resource/random-crate.webp",
  "Enkephalin Box": "icons/resource/enkephalin.webp",
  "Extraction Ticket": "icons/resource/extraction.webp",
};
// Per-sinner shard icons (used for uptie/threadspin where the shard belongs to a
// specific sinner) — keyed by sinner name; falls back to RESOURCE_ICON.egoshard.
export const SINNER_SHARD_ICON = {
  "Yi Sang": "icons/sinnershard/yi-sang.webp",
  "Faust": "icons/sinnershard/faust.webp",
  "Don Quixote": "icons/sinnershard/don-quixote.webp",
  "Ryoshu": "icons/sinnershard/ryoshu.webp",
  "Meursault": "icons/sinnershard/meursault.webp",
  "Hong Lu": "icons/sinnershard/hong-lu.webp",
  "Heathcliff": "icons/sinnershard/heathcliff.webp",
  "Ishmael": "icons/sinnershard/ishmael.webp",
  "Rodion": "icons/sinnershard/rodion.webp",
  "Sinclair": "icons/sinnershard/sinclair.webp",
  "Outis": "icons/sinnershard/outis.webp",
  "Gregor": "icons/sinnershard/gregor.webp",
};
// Dropdown option icons + grade glyphs live in the generated ./icons-map.js.

// IF SS7 faction/source colours for the ID/EGO cells (G2:J13 conditional formatting).
// {match, fill, font}; match is the substring searched (order matters).
export const FACTION_COLORS = [
  { match: "Thumb", fill: "#F4CCCC", font: "#FF0000" },
  { match: "Index", fill: "#134F5C", font: "#00FFFF" },
  { match: "Middle", fill: "#EAD1DC", font: "#9900FF" },
  { match: "Ring", fill: "#FCE5CD", font: "#FF9900" },
  { match: "Pinky", fill: "#C9DAF8", font: "#4A86E8" },
  { match: " Walp", fill: "#38761D", font: "#00FF00" },
  { match: " Intv", fill: "#FFE400", font: "#202124" },
  { match: " Bkgk", fill: "#FF9900", font: "#000000" },
];
