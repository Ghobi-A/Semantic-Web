import { useState, useEffect, useRef } from "react";

const SPEED_BAND = 7;
const GUARANTEED_RATIO = 2.0;
const V_LO = 0.85;
const V_HI = 1.0;
const BRACE = 1.05;
const MAX_T = 100;
const DECAY = 3;

const CLASS_STATS = {
  Warrior: { hp: 85, atk: 75, def: 70, mag: 30, res: 35, spd: 40 },
  Mage: { hp: 75, atk: 30, def: 35, mag: 80, res: 75, spd: 42 },
  Assassin: { hp: 70, atk: 70, def: 35, mag: 38, res: 55, spd: 80 },
  Guardian: { hp: 85, atk: 40, def: 75, mag: 40, res: 75, spd: 35 },
  Neutral: { hp: 78, atk: 55, def: 50, mag: 55, res: 50, spd: 50 },
  Sorcerer: { hp: 72, atk: 40, def: 30, mag: 80, res: 48, spd: 80 },
};

const CLASS_META = {
  Warrior: { mark: "⚔️", role: "Physical bruiser", tone: "#dc2626" },
  Mage: { mark: "🔮", role: "Magical specialist", tone: "#7c3aed" },
  Assassin: { mark: "🗡️", role: "Fast physical attacker", tone: "#64748b" },
  Guardian: { mark: "🛡️", role: "Defensive tank", tone: "#059669" },
  Neutral: { mark: "⚖️", role: "Adaptive generalist", tone: "#6b7280" },
  Sorcerer: { mark: "🔥", role: "Fast magical attacker", tone: "#ea580c" },
};

const COLORS = Object.fromEntries(
  Object.entries(CLASS_META).map(([name, meta]) => [name, meta.tone])
);

const MOVES = {
  Warrior: [
    { name: "Power Slash", type: "physical", slot: "basic", power: 24, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Armor Break", type: "physical", slot: "signature", power: 18, acc: 1.0, tMods: [["def", -5]], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Reckless Charge", type: "physical", slot: "gambit", power: 30, acc: 0.75, tMods: [], sMods: [["def", -4]], buff: false, status: null, sDur: 0 },
  ],
  Mage: [
    { name: "Arcane Bolt", type: "magical", slot: "basic", power: 24, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Mind Pierce", type: "magical", slot: "signature", power: 18, acc: 1.0, tMods: [["res", -5]], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Overload", type: "magical", slot: "gambit", power: 30, acc: 0.75, tMods: [], sMods: [["res", -4]], buff: false, status: null, sDur: 0 },
  ],
  Assassin: [
    { name: "Quick Strike", type: "physical", slot: "basic", power: 24, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Cripple", type: "physical", slot: "signature", power: 18, acc: 1.0, tMods: [["def", -5], ["res", -5]], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Lethal Edge", type: "physical", slot: "gambit", power: 32, acc: 0.70, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
  ],
  Guardian: [
    { name: "Shield Bash", type: "adaptive", slot: "basic", power: 23, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Fortify", type: "magical", slot: "signature", power: 16, acc: 1.0, tMods: [], sMods: [["def", 4], ["res", 4]], buff: true, status: null, sDur: 0 },
    { name: "Avalanche", type: "physical", slot: "gambit", power: 28, acc: 0.80, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
  ],
  Neutral: [
    { name: "Hybrid Strike", type: "adaptive", slot: "basic", power: 23, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Focus Shift", type: "magical", slot: "signature", power: 18, acc: 1.0, tMods: [], sMods: [["atk", 5], ["mag", 5], ["def", -4], ["res", -4]], buff: false, status: null, sDur: 0 },
    { name: "Wild Card", type: "adaptive", slot: "gambit", power: 30, acc: 0.75, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
  ],
  Sorcerer: [
    { name: "Flame", type: "magical", slot: "basic", power: 24, acc: 1.0, tMods: [], sMods: [], buff: false, status: null, sDur: 0 },
    { name: "Hex", type: "magical", slot: "signature", power: 18, acc: 1.0, tMods: [], sMods: [], buff: false, status: "hexed", sDur: 2 },
    { name: "Voidfire", type: "magical", slot: "gambit", power: 30, acc: 0.75, tMods: [], sMods: [["res", -4]], buff: false, status: null, sDur: 0 },
  ],
};

const ALL_CLS = Object.keys(CLASS_STATS);
const TABS = [
  { id: "battle", label: "Duel" },
  { id: "simulate", label: "Monte Carlo" },
  { id: "nash", label: "Equilibrium" },
];

const STAT_ROWS = [
  ["HP", "hp", 92],
  ["ATK", "atk", 80],
  ["DEF", "def", 75],
  ["MAG", "mag", 80],
  ["RES", "res", 75],
  ["SPD", "spd", 80],
];

const STATUS_COLORS = {
  win: "#d6b35a",
  loss: "#ef4444",
  info: "#94a3b8",
  accent: "#9fc5ff",
};

function mkUnit(cls, name) {
  const s = CLASS_STATS[cls];
  return {
    name: name || cls,
    cls,
    bHp: s.hp,
    bAtk: s.atk,
    bDef: s.def,
    bMag: s.mag,
    bRes: s.res,
    bSpd: s.spd,
    hp: s.hp,
    moves: MOVES[cls].map((m) => ({ ...m })),
    mods: [],
    status: [],
    cd: {},
  };
}

function eff(u, st) {
  const b = u[`b${st[0].toUpperCase() + st.slice(1)}`];
  return Math.max(1, b + u.mods.filter((m) => m.s === st).reduce((a, m) => a + m.v, 0));
}

function hasSt(u, n) {
  return u.status.some((s) => s.n === n);
}

function avail(u) {
  return u.moves.filter((m) => (u.cd[m.name] || 0) <= 0);
}

function tick(u) {
  u.mods = u.mods.filter((m) => {
    m.t--;
    return m.t > 0;
  });
  u.status = u.status.filter((s) => {
    s.t--;
    return s.t > 0;
  });
  for (const k of Object.keys(u.cd)) u.cd[k] = Math.max(0, u.cd[k] - 1);
}

function spd(a, b) {
  const sa = eff(a, "spd");
  const sb = eff(b, "spd");
  if (sa === sb) return Math.random() < 0.5 ? [a, b] : [b, a];
  const [f, sl] = sa > sb ? [a, b] : [b, a];
  const d = Math.abs(sa - sb);
  if (eff(f, "spd") >= GUARANTEED_RATIO * eff(sl, "spd") || d >= SPEED_BAND) return [f, sl];
  return Math.random() < 0.5 + 0.5 * (d / SPEED_BAND) ? [f, sl] : [sl, f];
}

function adaptType(a, d) {
  const p = (2 * eff(a, "atk")) / Math.max(1, eff(a, "atk") + eff(d, "def"));
  const m = (2 * eff(a, "mag")) / Math.max(1, eff(a, "mag") + eff(d, "res"));
  return p >= m ? "physical" : "magical";
}

function dmg(mv, a, d, br) {
  const rt = mv.type === "adaptive" ? adaptType(a, d) : mv.type;
  const ak = rt === "physical" ? eff(a, "atk") : eff(a, "mag");
  let df = rt === "physical" ? eff(d, "def") : eff(d, "res");
  if (br) df = Math.floor(df * BRACE);
  const v = V_LO + Math.random() * (V_HI - V_LO);
  return {
    d: Math.max(1, Math.floor(mv.power * 2 * ak / Math.max(1, ak + df) * v)),
    rt,
    v,
  };
}

function exec(a, d, mv, br) {
  const log = {
    actor: a.name,
    aCls: a.cls,
    target: d.name,
    tCls: d.cls,
    move: mv.name,
    slot: mv.slot,
    hit: false,
    dmg: 0,
    hpB: d.hp,
    hpA: d.hp,
    fx: [],
  };
  const hit = Math.random() < mv.acc;
  log.hit = hit;
  if (mv.slot !== "basic") a.cd[mv.name] = 1;
  if (!hit) {
    log.fx.push("Miss");
    return log;
  }
  if (mv.buff && hasSt(a, "hexed")) {
    log.fx.push("Blocked by Hex");
    return log;
  }
  const { d: dd, rt } = dmg(mv, a, d, br);
  log.dmg = dd;
  d.hp = Math.max(0, d.hp - dd);
  log.hpA = d.hp;
  log.fx.push(`${dd} ${rt} damage`);
  for (const [s, v] of mv.tMods) {
    d.mods.push({ s, v, t: DECAY });
    log.fx.push(`${d.name} ${s}${v > 0 ? "+" : ""}${v}`);
  }
  if (!(mv.sMods.length > 0 && hasSt(a, "hexed"))) {
    for (const [s, v] of mv.sMods) {
      a.mods.push({ s, v, t: DECAY });
      log.fx.push(`${a.name} ${s}${v > 0 ? "+" : ""}${v}`);
    }
  }
  if (mv.status) {
    const ex = d.status.find((x) => x.n === mv.status);
    if (ex) ex.t = mv.sDur;
    else d.status.push({ n: mv.status, t: mv.sDur });
    log.fx.push(`${d.name} is ${mv.status}`);
  }
  return log;
}

function ev(mv, a, d) {
  let r;
  if (mv.type === "adaptive") {
    const p = (2 * eff(a, "atk")) / Math.max(1, eff(a, "atk") + eff(d, "def"));
    const m = (2 * eff(a, "mag")) / Math.max(1, eff(a, "mag") + eff(d, "res"));
    r = Math.max(p, m);
  } else if (mv.type === "physical") {
    r = (2 * eff(a, "atk")) / Math.max(1, eff(a, "atk") + eff(d, "def"));
  } else {
    r = (2 * eff(a, "mag")) / Math.max(1, eff(a, "mag") + eff(d, "res"));
  }
  return mv.power * r * ((V_LO + V_HI) / 2) * mv.acc;
}

function aiGreedy(a, d) {
  const av = avail(a);
  if (!av.length) return a.moves[0];
  return av.reduce((b, m) => (ev(m, a, d) > ev(b, a, d) ? m : b), av[0]);
}

function simBattle(cA, cB, pA, pB) {
  const a = mkUnit(cA, `${cA}_A`);
  const b = mkUnit(cB, `${cB}_B`);
  let finalTurn = 1;
  for (let t = 1; t <= MAX_T; t++) {
    finalTurn = t;
    if (a.hp <= 0 || b.hp <= 0) break;
    const [f, s] = spd(a, b);
    const fo = f === a ? b : a;
    const so = s === a ? b : a;
    const pf = f === a ? pA : pB;
    const ps = s === a ? pA : pB;
    exec(f, fo, pf(f, fo), true);
    if (fo.hp <= 0) break;
    exec(s, so, ps(s, so), false);
    if (so.hp <= 0) break;
    tick(a);
    tick(b);
  }
  const winner = a.hp > 0 && b.hp <= 0 ? cA : b.hp > 0 && a.hp <= 0 ? cB : a.hp >= b.hp ? cA : cB;
  return { winner, turns: finalTurn };
}

function nashPayoff(cA, cB) {
  const a = mkUnit(cA);
  const b = mkUnit(cB);
  const mA = a.moves;
  const mB = b.moves;
  const P = mA.map((ma) => mB.map((mb) => {
    let rA;
    let rB;
    if (ma.type === "adaptive") {
      const p = (2 * eff(a, "atk")) / Math.max(1, eff(a, "atk") + eff(b, "def"));
      const m = (2 * eff(a, "mag")) / Math.max(1, eff(a, "mag") + eff(b, "res"));
      rA = Math.max(p, m);
    } else if (ma.type === "physical") rA = (2 * eff(a, "atk")) / Math.max(1, eff(a, "atk") + eff(b, "def"));
    else rA = (2 * eff(a, "mag")) / Math.max(1, eff(a, "mag") + eff(b, "res"));

    if (mb.type === "adaptive") {
      const p = (2 * eff(b, "atk")) / Math.max(1, eff(b, "atk") + eff(a, "def"));
      const m = (2 * eff(b, "mag")) / Math.max(1, eff(b, "mag") + eff(a, "res"));
      rB = Math.max(p, m);
    } else if (mb.type === "physical") rB = (2 * eff(b, "atk")) / Math.max(1, eff(b, "atk") + eff(a, "def"));
    else rB = (2 * eff(b, "mag")) / Math.max(1, eff(b, "mag") + eff(a, "res"));

    const avgV = (V_LO + V_HI) / 2;
    return ma.power * rA * avgV * ma.acc - mb.power * rB * avgV * mb.acc;
  }));

  const m = P.length;
  const n = P[0].length;
  let bestVal = -Infinity;
  let bestStrat = Array(m).fill(1 / m);

  for (let i = 0; i < m; i++) {
    const worstJ = Math.min(...P[i]);
    if (worstJ > bestVal) {
      bestVal = worstJ;
      bestStrat = Array(m).fill(0);
      bestStrat[i] = 1;
    }
  }

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      for (let p = 0; p <= 100; p++) {
        const w = p / 100;
        const worst = Math.min(...Array.from({ length: n }, (_, k) => w * P[i][k] + (1 - w) * P[j][k]));
        if (worst > bestVal) {
          bestVal = worst;
          bestStrat = Array(m).fill(0);
          bestStrat[i] = w;
          bestStrat[j] = 1 - w;
        }
      }
    }
  }

  const entropy = -bestStrat.filter((p) => p > 1e-10).reduce((s, p) => s + p * Math.log2(p), 0);
  const greedyIdx = P.map((r) => r.reduce((x, y) => x + y, 0) / n).reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
  const nashIdx = bestStrat.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);

  return {
    classA: cA,
    classB: cB,
    matchup: `${cA} vs ${cB}`,
    payoff: P,
    movesA: mA.map((mv) => mv.name),
    movesB: mB.map((mv) => mv.name),
    strat: bestStrat,
    entropy,
    val: bestVal,
    greedyIdx,
    nashIdx,
    pure: entropy < 0.01,
    match: greedyIdx === nashIdx,
  };
}

function className(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtDelta(n) {
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
}

function advantageClass(v) {
  if (v === null) return "mirror";
  if (v >= 60) return "strong";
  if (v >= 55) return "edge";
  if (v <= 40) return "weak";
  if (v <= 45) return "risk";
  return "even";
}

function AppStyles() {
  return (
    <style>{`
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      .app {
        min-height: 100vh;
        padding: 28px 18px 48px;
        background:
          radial-gradient(circle at 18% -10%, rgba(159, 197, 255, 0.16), transparent 30%),
          linear-gradient(135deg, #05070d 0%, #0a1019 48%, #10120f 100%);
        color: #e5edf7;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        width: min(1180px, 100%);
        margin: 0 auto;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: end;
        padding: 24px;
        border: 1px solid rgba(159, 197, 255, 0.16);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(17, 24, 39, 0.72));
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
      }
      .eyebrow {
        margin: 0 0 9px;
        color: #d6b35a;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        color: #f8fafc;
        font-family: Georgia, "Times New Roman", serif;
        font-size: clamp(2.25rem, 6vw, 4.7rem);
        font-weight: 700;
        line-height: 0.95;
        letter-spacing: 0;
      }
      .subtitle {
        margin: 12px 0 0;
        color: #9fc5ff;
        font-size: clamp(1rem, 2vw, 1.28rem);
        font-weight: 700;
      }
      .thesis {
        max-width: 790px;
        margin: 12px 0 0;
        color: #aab8ca;
        font-size: 0.96rem;
        line-height: 1.65;
      }
      .hero-metrics {
        display: grid;
        grid-template-columns: repeat(3, 96px);
        gap: 10px;
      }
      .mini-metric,
      .summary-card {
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: rgba(7, 11, 18, 0.74);
      }
      .mini-metric {
        padding: 12px;
        text-align: center;
      }
      .metric-value {
        color: #f8fafc;
        font-size: 1.42rem;
        font-weight: 800;
      }
      .metric-label {
        margin-top: 3px;
        color: #708196;
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .tabs {
        display: flex;
        gap: 8px;
        margin: 18px 0;
        padding: 6px;
        width: fit-content;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: rgba(5, 9, 16, 0.72);
      }
      .tab {
        min-width: 128px;
        padding: 10px 16px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #8fa0b8;
        cursor: pointer;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transition: background 140ms ease, color 140ms ease;
      }
      .tab:hover {
        background: rgba(159, 197, 255, 0.08);
        color: #dbeafe;
      }
      .tab.active {
        background: linear-gradient(135deg, rgba(159, 197, 255, 0.18), rgba(214, 179, 90, 0.12));
        color: #f8fafc;
      }
      .workspace {
        padding: 22px;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: rgba(8, 13, 22, 0.84);
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: end;
        margin-bottom: 18px;
      }
      .kicker {
        margin: 0 0 5px;
        color: #d6b35a;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }
      h2 {
        margin: 0;
        color: #f8fafc;
        font-size: 1.25rem;
        letter-spacing: 0;
      }
      .section-copy {
        max-width: 700px;
        margin: 7px 0 0;
        color: #93a4bb;
        line-height: 1.6;
        font-size: 0.92rem;
      }
      .class-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .class-card {
        position: relative;
        min-height: 206px;
        padding: 15px;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(7, 11, 18, 0.9));
        cursor: pointer;
        overflow: hidden;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }
      .class-card::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: var(--tone);
        opacity: 0.7;
      }
      .class-card:hover,
      .class-card.selected {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--tone) 58%, #9fc5ff 42%);
        background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 14%, #0f172a 86%), rgba(7, 11, 18, 0.92));
      }
      .class-top {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 13px;
      }
      .class-mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 1px solid color-mix(in srgb, var(--tone) 50%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, var(--tone) 13%, transparent);
        font-size: 1.3rem;
        line-height: 1;
      }
      .class-name {
        color: #f8fafc;
        font-size: 1rem;
        font-weight: 800;
      }
      .role {
        margin-top: 2px;
        color: #8fa0b8;
        font-size: 0.76rem;
      }
      .stat-row {
        display: grid;
        grid-template-columns: 36px 1fr 28px;
        gap: 8px;
        align-items: center;
        margin-top: 7px;
      }
      .stat-label,
      .stat-value {
        color: #75869d;
        font-size: 0.68rem;
        font-weight: 800;
      }
      .stat-value {
        text-align: right;
        color: #bdc9d8;
      }
      .stat-track {
        height: 7px;
        border-radius: 999px;
        background: #172233;
        overflow: hidden;
      }
      .stat-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--tone), color-mix(in srgb, var(--tone) 55%, #f8fafc 45%));
      }
      .action-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .btn {
        border: 1px solid rgba(159, 197, 255, 0.18);
        border-radius: 8px;
        background: rgba(159, 197, 255, 0.09);
        color: #dbeafe;
        cursor: pointer;
        font: inherit;
        font-size: 0.76rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        padding: 11px 16px;
        text-transform: uppercase;
      }
      .btn:hover {
        border-color: #9fc5ff;
        background: rgba(159, 197, 255, 0.14);
      }
      .btn:disabled {
        color: #56657a;
        cursor: not-allowed;
        background: rgba(15, 23, 42, 0.55);
      }
      .btn.gold {
        border-color: rgba(214, 179, 90, 0.38);
        background: rgba(214, 179, 90, 0.12);
        color: #f1d38a;
      }
      .duel-topbar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 14px;
      }
      .turn-pill,
      .legend-pill {
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 999px;
        background: rgba(7, 11, 18, 0.78);
        color: #aab8ca;
        font-size: 0.76rem;
        font-weight: 800;
        padding: 8px 12px;
      }
      .unit-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .unit-panel {
        position: relative;
        padding: 16px;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: rgba(8, 13, 22, 0.92);
        overflow: hidden;
      }
      .unit-panel.player {
        box-shadow: inset 0 0 0 1px rgba(159, 197, 255, 0.05);
      }
      .unit-panel.enemy {
        background: rgba(14, 12, 15, 0.92);
      }
      .unit-panel::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 4px;
        background: linear-gradient(90deg, var(--tone), transparent);
      }
      .unit-title {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }
      .unit-name {
        display: flex;
        gap: 9px;
        align-items: center;
        color: #f8fafc;
        font-weight: 900;
      }
      .unit-label {
        color: #74859a;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .hp-track {
        height: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        background: #101827;
        overflow: hidden;
      }
      .hp-fill {
        height: 100%;
        border-radius: inherit;
        transition: width 260ms ease;
      }
      .hp-meta {
        display: flex;
        justify-content: space-between;
        margin: 7px 0 10px;
        color: #8fa0b8;
        font-size: 0.76rem;
        font-weight: 700;
      }
      .effect-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 7px;
      }
      .chip {
        border-radius: 999px;
        padding: 3px 8px;
        background: rgba(214, 179, 90, 0.12);
        color: #f1d38a;
        font-size: 0.68rem;
        font-weight: 800;
      }
      .chip.bad {
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
      }
      .move-list {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }
      .move-card {
        width: 100%;
        padding: 11px;
        border: 1px solid rgba(159, 197, 255, 0.13);
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.8);
        color: #e5edf7;
        text-align: left;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      }
      .move-card:hover:not(:disabled) {
        transform: translateX(2px);
        border-color: var(--tone);
        background: color-mix(in srgb, var(--tone) 12%, #111827 88%);
      }
      .move-card:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .move-line {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }
      .move-name {
        font-weight: 850;
        font-size: 0.86rem;
      }
      .move-slot {
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 0.63rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .slot-basic {
        background: rgba(148, 163, 184, 0.12);
        color: #cbd5e1;
      }
      .slot-signature {
        background: rgba(159, 197, 255, 0.14);
        color: #bfdbfe;
      }
      .slot-gambit {
        background: rgba(214, 179, 90, 0.14);
        color: #f1d38a;
      }
      .move-meta {
        margin-top: 6px;
        color: #8495ab;
        font-size: 0.74rem;
      }
      .combat-log {
        margin-top: 14px;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
        background: rgba(4, 8, 13, 0.82);
        overflow: hidden;
      }
      .log-head {
        display: flex;
        justify-content: space-between;
        padding: 9px 12px;
        border-bottom: 1px solid rgba(159, 197, 255, 0.1);
        color: #708196;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .log-body {
        max-height: 190px;
        overflow-y: auto;
        padding: 10px 12px;
      }
      .log-entry {
        display: grid;
        grid-template-columns: 6px 1fr;
        gap: 9px;
        align-items: start;
        padding: 5px 0;
        color: #aab8ca;
        font-size: 0.82rem;
        line-height: 1.45;
      }
      .log-dot {
        width: 6px;
        height: 6px;
        margin-top: 7px;
        border-radius: 999px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .summary-card {
        padding: 14px;
      }
      .summary-label {
        color: #708196;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .summary-value {
        margin-top: 7px;
        color: #f8fafc;
        font-size: 1.35rem;
        font-weight: 900;
      }
      .summary-note {
        margin-top: 4px;
        color: #8fa0b8;
        font-size: 0.75rem;
      }
      .progress {
        height: 7px;
        margin: 12px 0 18px;
        border-radius: 999px;
        background: #172233;
        overflow: hidden;
      }
      .progress > div {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #9fc5ff, #d6b35a);
        transition: width 200ms ease;
      }
      .table-wrap {
        overflow-x: auto;
        border: 1px solid rgba(159, 197, 255, 0.14);
        border-radius: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 690px;
      }
      th,
      td {
        border-bottom: 1px solid rgba(159, 197, 255, 0.1);
        padding: 10px;
      }
      th {
        background: rgba(15, 23, 42, 0.92);
        color: #74859a;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.11em;
        text-transform: uppercase;
        text-align: center;
      }
      td {
        color: #b8c5d6;
        font-size: 0.84rem;
        text-align: center;
      }
      .row-head {
        text-align: left;
        font-weight: 900;
        white-space: nowrap;
      }
      .matrix-cell {
        font-weight: 850;
      }
      .matrix-cell.strong {
        background: rgba(34, 197, 94, 0.2);
        color: #86efac;
      }
      .matrix-cell.edge {
        background: rgba(34, 197, 94, 0.1);
        color: #bbf7d0;
      }
      .matrix-cell.even {
        background: rgba(159, 197, 255, 0.05);
        color: #cbd5e1;
      }
      .matrix-cell.risk {
        background: rgba(239, 68, 68, 0.1);
        color: #fecaca;
      }
      .matrix-cell.weak {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }
      .matrix-cell.mirror {
        background: rgba(148, 163, 184, 0.08);
        color: #64748b;
      }
      .ranking-list {
        display: grid;
        gap: 8px;
        margin-top: 16px;
      }
      .ranking-row {
        display: grid;
        grid-template-columns: 120px 1fr 92px;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border: 1px solid rgba(159, 197, 255, 0.12);
        border-radius: 8px;
        background: rgba(7, 11, 18, 0.58);
      }
      .rank-name {
        color: #f8fafc;
        font-size: 0.82rem;
        font-weight: 900;
      }
      .rank-bar {
        height: 9px;
        border-radius: 999px;
        background: #172233;
        overflow: hidden;
      }
      .rank-fill {
        height: 100%;
        border-radius: inherit;
      }
      .rank-num {
        color: #dbeafe;
        font-size: 0.82rem;
        font-weight: 900;
        text-align: right;
      }
      .callout {
        margin-bottom: 16px;
        padding: 16px;
        border: 1px solid rgba(214, 179, 90, 0.22);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(214, 179, 90, 0.11), rgba(159, 197, 255, 0.07));
      }
      .callout-title {
        margin: 0;
        color: #f1d38a;
        font-size: 0.9rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .callout p {
        margin: 8px 0 0;
        color: #b8c5d6;
        line-height: 1.6;
      }
      .matchup {
        display: flex;
        gap: 7px;
        align-items: center;
        white-space: nowrap;
        font-weight: 900;
      }
      .match-chip {
        border-radius: 999px;
        padding: 3px 8px;
        background: rgba(159, 197, 255, 0.08);
      }
      .result-good {
        color: #86efac;
        font-weight: 900;
      }
      .result-warn {
        color: #f1d38a;
        font-weight: 900;
      }
      .result-bad {
        color: #fca5a5;
        font-weight: 900;
      }
      @media (max-width: 820px) {
        .app {
          padding: 16px 10px 32px;
        }
        .hero,
        .section-head,
        .duel-topbar {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .hero-metrics,
        .summary-grid,
        .class-grid,
        .unit-grid {
          grid-template-columns: 1fr;
        }
        .tabs {
          width: 100%;
        }
        .tab {
          flex: 1;
          min-width: 0;
          padding-inline: 10px;
        }
        .workspace {
          padding: 14px;
        }
        .ranking-row {
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .rank-num {
          text-align: left;
        }
      }
    `}</style>
  );
}

function ClassCard({ cls, selected, onClick }) {
  const s = CLASS_STATS[cls];
  const meta = CLASS_META[cls];

  return (
    <button
      type="button"
      className={className("class-card", selected && "selected")}
      onClick={onClick}
      style={{ "--tone": meta.tone }}
    >
      <div className="class-top">
        <div className="class-mark">{meta.mark}</div>
        <div>
          <div className="class-name">{cls}</div>
          <div className="role">{meta.role}</div>
        </div>
      </div>
      {STAT_ROWS.map(([label, key, max]) => (
        <div className="stat-row" key={key}>
          <span className="stat-label">{label}</span>
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${Math.min(100, (s[key] / max) * 100)}%` }} />
          </div>
          <span className="stat-value">{s[key]}</span>
        </div>
      ))}
    </button>
  );
}

function UnitPanel({ unit, cls, label, isPlayer, phase, onMove }) {
  if (!unit) return null;
  const meta = CLASS_META[cls];
  const pct = Math.max(0, (unit.hp / unit.bHp) * 100);
  const hpColor = pct > 50 ? "#22c55e" : pct > 25 ? "#d6b35a" : "#ef4444";

  return (
    <div className={className("unit-panel", isPlayer ? "player" : "enemy")} style={{ "--tone": meta.tone }}>
      <div className="unit-title">
        <div className="unit-name">
          <span className="class-mark">{meta.mark}</span>
          <span>{cls}</span>
        </div>
        <span className="unit-label">{label}</span>
      </div>

      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor }} />
      </div>
      <div className="hp-meta">
        <span>{unit.hp} / {unit.bHp} HP</span>
        <span>{Math.round(pct)}%</span>
      </div>

      {(unit.mods.length > 0 || unit.status.length > 0) && (
        <div className="effect-row">
          {unit.mods.map((m, i) => (
            <span className="chip" key={`${m.s}-${i}`}>{m.s.toUpperCase()} {m.v > 0 ? "+" : ""}{m.v} / {m.t}t</span>
          ))}
          {unit.status.map((s, i) => (
            <span className="chip bad" key={`${s.n}-${i}`}>{s.n} / {s.t}t</span>
          ))}
        </div>
      )}

      <div className="move-list">
        {unit.moves.map((move) => {
          const onCd = (unit.cd[move.name] || 0) > 0;
          const disabled = !isPlayer || phase !== "player" || onCd;
          return (
            <button
              type="button"
              key={move.name}
              className="move-card"
              disabled={disabled}
              onClick={() => !disabled && onMove(move)}
              style={{ "--tone": meta.tone }}
            >
              <div className="move-line">
                <span className="move-name">{move.name}</span>
                <span className={className("move-slot", `slot-${move.slot}`)}>{onCd ? "cooldown" : move.slot}</span>
              </div>
              <div className="move-meta">
                {move.power} power / {Math.round(move.acc * 100)}% accuracy / {move.type}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("battle");
  const [selP, setSelP] = useState(null);
  const [selE, setSelE] = useState(null);
  const [player, setPlayer] = useState(null);
  const [enemy, setEnemy] = useState(null);
  const [turn, setTurn] = useState(1);
  const [logs, setLogs] = useState([]);
  const [phase, setPhase] = useState("pick");
  const [winner, setWinner] = useState(null);
  const [simRes, setSimRes] = useState(null);
  const [simRun, setSimRun] = useState(false);
  const [simProg, setSimProg] = useState(0);
  const [nashRes, setNashRes] = useState(null);
  const [nashRun, setNashRun] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const resetBattlePick = () => {
    setPhase("pick");
    setSelP(null);
    setSelE(null);
    setPlayer(null);
    setEnemy(null);
    setWinner(null);
    setLogs([]);
  };

  const startBattle = (pc, ec) => {
    setSelP(pc);
    setSelE(ec);
    const p = mkUnit(pc, "You");
    const e = mkUnit(ec, "Enemy");
    setPlayer(p);
    setEnemy(e);
    setTurn(1);
    setLogs([{ t: `${pc} vs ${ec}: duel initialized`, c: STATUS_COLORS.info }]);
    setPhase("player");
    setWinner(null);
  };

  const doMove = (move) => {
    if (phase !== "player") return;
    const p = player;
    const e = enemy;
    const [first] = spd(p, e);
    const isFirst = first === p;
    const newLogs = [];

    if (isFirst) {
      const pl = exec(p, e, move, true);
      newLogs.push({ t: `T${turn} You -> ${pl.move}: ${pl.fx.join(", ")}`, c: COLORS[selP] });
      if (e.hp <= 0) {
        newLogs.push({ t: `Victory: ${selP} wins in ${turn} turns`, c: STATUS_COLORS.win });
        setLogs((l) => [...l, ...newLogs]);
        setPhase("over");
        setWinner("player");
        setPlayer({ ...p });
        setEnemy({ ...e });
        return;
      }
      const em = aiGreedy(e, p);
      const el = exec(e, p, em, false);
      newLogs.push({ t: `T${turn} Enemy -> ${el.move}: ${el.fx.join(", ")}`, c: COLORS[selE] });
    } else {
      const em = aiGreedy(e, p);
      const el = exec(e, p, em, true);
      newLogs.push({ t: `T${turn} Enemy acts first -> ${el.move}: ${el.fx.join(", ")}`, c: COLORS[selE] });
      if (p.hp <= 0) {
        newLogs.push({ t: `Defeat: ${selE} wins in ${turn} turns`, c: STATUS_COLORS.loss });
        setLogs((l) => [...l, ...newLogs]);
        setPhase("over");
        setWinner("enemy");
        setPlayer({ ...p });
        setEnemy({ ...e });
        return;
      }
      const pl = exec(p, e, move, false);
      newLogs.push({ t: `T${turn} You -> ${pl.move}: ${pl.fx.join(", ")}`, c: COLORS[selP] });
    }

    if (p.hp <= 0) {
      newLogs.push({ t: `Defeat: ${selE} wins in ${turn} turns`, c: STATUS_COLORS.loss });
      setLogs((l) => [...l, ...newLogs]);
      setPhase("over");
      setWinner("enemy");
    } else if (e.hp <= 0) {
      newLogs.push({ t: `Victory: ${selP} wins in ${turn} turns`, c: STATUS_COLORS.win });
      setLogs((l) => [...l, ...newLogs]);
      setPhase("over");
      setWinner("player");
    } else {
      tick(p);
      tick(e);
      setTurn((t) => t + 1);
      setLogs((l) => [...l, ...newLogs]);
    }
    setPlayer({ ...p });
    setEnemy({ ...e });
  };

  const runSim = async () => {
    setSimRun(true);
    setSimProg(0);
    const N = 10000;
    const mx = {};
    const turnsMx = {};
    const total = (ALL_CLS.length * (ALL_CLS.length - 1)) / 2;
    let done = 0;
    await new Promise((r) => setTimeout(r, 20));
    for (let i = 0; i < ALL_CLS.length; i++) {
      for (let j = i + 1; j < ALL_CLS.length; j++) {
        let w = 0;
        let totalTurns = 0;
        for (let s = 0; s < N; s++) {
          const result = simBattle(ALL_CLS[i], ALL_CLS[j], aiGreedy, aiGreedy);
          if (result.winner === ALL_CLS[i]) w++;
          totalTurns += result.turns;
        }
        mx[`${ALL_CLS[i]}_${ALL_CLS[j]}`] = +(100 * w / N).toFixed(1);
        mx[`${ALL_CLS[j]}_${ALL_CLS[i]}`] = +(100 * (N - w) / N).toFixed(1);
        turnsMx[`${ALL_CLS[i]}_${ALL_CLS[j]}`] = +(totalTurns / N).toFixed(1);
        done++;
        setSimProg(Math.round(100 * done / total));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const avgs = {};
    for (const c of ALL_CLS) {
      const rs = ALL_CLS.filter((o) => o !== c).map((o) => mx[`${c}_${o}`]);
      avgs[c] = +(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1);
    }
    const turnsArr = Object.values(turnsMx);
    const meanTurns = turnsArr.length ? +(turnsArr.reduce((a, b) => a + b, 0) / turnsArr.length).toFixed(1) : 0;
    setSimRes({ mx, avgs, meanTurns, N });
    setSimRun(false);
  };

  const runNash = async () => {
    setNashRun(true);
    await new Promise((r) => setTimeout(r, 20));
    const results = [];
    for (let i = 0; i < ALL_CLS.length; i++) {
      for (let j = i + 1; j < ALL_CLS.length; j++) {
        results.push(nashPayoff(ALL_CLS[i], ALL_CLS[j]));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setNashRes(results);
    setNashRun(false);
  };

  const renderBattle = () => {
    if (phase === "pick" || !player) {
      return (
        <>
          <div className="section-head">
            <div>
              <p className="kicker">Duel setup</p>
              <h2>{!selP ? "Select your class" : "Select opposing policy target"}</h2>
              <p className="section-copy">
                Pick a class, then choose an opponent controlled by the greedy expected-damage policy.
              </p>
            </div>
            {selP && (
              <button type="button" className="btn" onClick={resetBattlePick}>Reset Selection</button>
            )}
          </div>
          <div className="class-grid">
            {ALL_CLS.map((c) => (
              <ClassCard
                key={c}
                cls={c}
                selected={c === selP}
                onClick={() => {
                  if (!selP) setSelP(c);
                  else if (c !== selP) startBattle(selP, c);
                }}
              />
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="duel-topbar">
          <div className="action-row">
            <span className="turn-pill">Turn {turn}</span>
            <span className="legend-pill">Player policy: manual</span>
            <span className="legend-pill">Enemy policy: greedy EV</span>
          </div>
          <div className="action-row">
            {phase === "over" && (
              <span className={className("legend-pill", winner === "player" ? "result-good" : "result-bad")}>
                {winner === "player" ? "Victory" : "Defeat"}
              </span>
            )}
            <button type="button" className="btn" onClick={resetBattlePick}>New Duel</button>
          </div>
        </div>
        <div className="unit-grid">
          <UnitPanel unit={player} cls={selP} label="You" isPlayer phase={phase} onMove={doMove} />
          <UnitPanel unit={enemy} cls={selE} label="Greedy AI" phase={phase} onMove={doMove} />
        </div>
        <div className="combat-log">
          <div className="log-head">
            <span>Combat Log</span>
            <span>Speed order, damage, modifiers</span>
          </div>
          <div className="log-body" ref={logRef}>
            {logs.map((l, i) => (
              <div className="log-entry" key={`${l.t}-${i}`}>
                <span className="log-dot" style={{ background: l.c || STATUS_COLORS.info }} />
                <span style={{ color: l.c || STATUS_COLORS.info }}>{l.t}</span>
              </div>
            ))}
          </div>
        </div>
        {phase === "over" && (
          <div className="action-row" style={{ marginTop: 14, justifyContent: "center" }}>
            <button type="button" className="btn gold" onClick={() => startBattle(selP, selE)}>Rematch</button>
            <button type="button" className="btn" onClick={resetBattlePick}>Change Classes</button>
          </div>
        )}
      </>
    );
  };

  const renderSim = () => {
    const ranked = simRes
      ? Object.entries(simRes.avgs).sort((a, b) => b[1] - a[1])
      : [];
    const spread = ranked.length ? (ranked[0][1] - ranked[ranked.length - 1][1]).toFixed(1) : "0.0";

    return (
      <>
        <div className="section-head">
          <div>
            <p className="kicker">Monte Carlo simulation</p>
            <h2>Greedy policy balance matrix</h2>
            <p className="section-copy">
              Runs 10,000 simulated battles per non-mirror matchup. Cell values are row-class win rates against column-class opponents.
            </p>
          </div>
          <button type="button" className="btn gold" onClick={runSim} disabled={simRun}>
            {simRun ? `Running ${simProg}%` : simRes ? "Re-run Matrix" : "Run Matrix"}
          </button>
        </div>

        {simRun && <div className="progress"><div style={{ width: `${simProg}%` }} /></div>}

        {simRes && (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">Simulations</div>
                <div className="summary-value">{simRes.N.toLocaleString()}</div>
                <div className="summary-note">per matchup</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Best avg.</div>
                <div className="summary-value">{ranked[0][0]}</div>
                <div className="summary-note">{ranked[0][1]}% win rate</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Lowest avg.</div>
                <div className="summary-value">{ranked[ranked.length - 1][0]}</div>
                <div className="summary-note">{ranked[ranked.length - 1][1]}% win rate</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Spread</div>
                <div className="summary-value">{spread}pp</div>
                <div className="summary-note">average class gap</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Avg duration</div>
                <div className="summary-value">{simRes.meanTurns}</div>
                <div className="summary-note">turns per fight</div>
              </div>
            </div>

            <div className="action-row" style={{ marginBottom: 12 }}>
              <span className="legend-pill">Green: row class advantage</span>
              <span className="legend-pill">Red: row class disadvantage</span>
              <span className="legend-pill">Neutral: near 50/50</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    {ALL_CLS.map((c) => <th key={c}>{CLASS_META[c].mark}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ALL_CLS.map((r) => (
                    <tr key={r}>
                      <td className="row-head" style={{ color: COLORS[r] }}>{CLASS_META[r].mark} {r}</td>
                      {ALL_CLS.map((c) => {
                        const v = r === c ? null : simRes.mx[`${r}_${c}`];
                        return (
                          <td key={c} className={className("matrix-cell", advantageClass(v))}>
                            {v === null ? "—" : `${v}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ranking-list">
              {ranked.map(([c, avg]) => {
                const delta = avg - 50;
                return (
                  <div className="ranking-row" key={c}>
                    <div className="rank-name" style={{ color: COLORS[c] }}>{CLASS_META[c].mark} {c}</div>
                    <div className="rank-bar" style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(159,197,255,0.3)", zIndex: 1 }} />
                      <div
                        className="rank-fill"
                        style={{
                          width: `${avg}%`,
                          background: delta >= 0 ? "linear-gradient(90deg, #22c55e, #86efac)" : "linear-gradient(90deg, #ef4444, #fca5a5)",
                        }}
                      />
                    </div>
                    <div className="rank-num">{avg}% ({fmtDelta(delta)})</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  };

  const renderNash = () => {
    const avgEntropy = nashRes ? nashRes.reduce((s, r) => s + r.entropy, 0) / nashRes.length : 0;
    const pureCount = nashRes ? nashRes.filter((r) => r.pure).length : 0;
    const mixedCount = nashRes ? nashRes.length - pureCount : 0;
    const matchCount = nashRes ? nashRes.filter((r) => r.match).length : 0;

    return (
      <>
        <div className="section-head">
          <div>
            <p className="kicker">Equilibrium analysis</p>
            <h2>Single-turn normal form games</h2>
            <p className="section-copy">
              Each matchup is reduced to a 3x3 expected-damage payoff matrix. The current result is intentionally narrow: execution randomness alone does not make mixed strategies optimal in this single-turn abstraction.
            </p>
          </div>
          <button type="button" className="btn gold" onClick={runNash} disabled={nashRun}>
            {nashRun ? "Computing" : nashRes ? "Re-run Analysis" : "Run Analysis"}
          </button>
        </div>

        <div className="callout">
          <p className="callout-title">Current technical reading</p>
          <p>
            Pure strategies and near-zero entropy mean that the best single-turn action is deterministic.
            Buffs, debuffs, cooldowns, and statuses only become strategically rich once future turns are modeled.
          </p>
        </div>

        {nashRes && (
          <>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">Matchups</div>
                <div className="summary-value">{nashRes.length}</div>
                <div className="summary-note">unique class pairs</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Pure</div>
                <div className="summary-value">{pureCount}/{nashRes.length}</div>
                <div className="summary-note">deterministic picks</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Mixed</div>
                <div className="summary-value">{mixedCount}/{nashRes.length}</div>
                <div className="summary-note">positive entropy</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Avg entropy</div>
                <div className="summary-value">{avgEntropy.toFixed(3)}</div>
                <div className="summary-note">0 = pure policy</div>
              </div>
            </div>

            <div className="callout">
              <p className="callout-title">
                {avgEntropy < 0.01 ? "Strategy-deterministic at single-turn level" : "Mixed play detected"}
              </p>
              <p>
                {avgEntropy < 0.01
                  ? "The single-turn Nash analysis finds pure strategies / zero entropy where applicable. Stochastic execution changes realized outcomes, but not the optimal one-turn action."
                  : "Some matchups return positive entropy, indicating a mixed policy in the current single-turn payoff model."}
              </p>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matchup</th>
                    <th>Equilibrium</th>
                    <th>Entropy</th>
                    <th>Greedy Pick</th>
                    <th>Nash Pick</th>
                    <th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {nashRes.map((r) => (
                    <tr key={r.matchup}>
                      <td>
                        <div className="matchup">
                          <span className="match-chip" style={{ color: COLORS[r.classA] }}>{r.classA}</span>
                          <span>vs</span>
                          <span className="match-chip" style={{ color: COLORS[r.classB] }}>{r.classB}</span>
                        </div>
                      </td>
                      <td className={r.pure ? "result-bad" : "result-good"}>{r.pure ? "Pure" : "Mixed"}</td>
                      <td>{r.entropy.toFixed(3)}</td>
                      <td>{r.movesA[r.greedyIdx]}</td>
                      <td>{r.movesA[r.nashIdx]}</td>
                      <td className={r.match ? "result-good" : "result-warn"}>{r.match ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="section-copy" style={{ marginTop: 14 }}>
              Greedy equals Nash in {matchCount}/{nashRes.length} displayed row-player analyses. The next research step is a multi-turn stateful equilibrium model that carries HP, cooldowns, buffs, debuffs, and status durations through the game tree.
            </p>
          </>
        )}
      </>
    );
  };

  return (
    <div className="app">
      <AppStyles />
      <main className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Dark academic strategy lab</p>
            <h1>Crestbound Duelists</h1>
            <p className="subtitle">Execution stochasticity vs strategic optimal play</p>
            <p className="thesis">
              A compact tactical combat engine used as a data science case study: simulate uncertain battles,
              compare decision policies, and test when random execution dynamics fail to produce mixed-strategy equilibria.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Project scope">
            <div className="mini-metric">
              <div className="metric-value">6</div>
              <div className="metric-label">Classes</div>
            </div>
            <div className="mini-metric">
              <div className="metric-value">3</div>
              <div className="metric-label">Moves</div>
            </div>
            <div className="mini-metric">
              <div className="metric-value">15</div>
              <div className="metric-label">Pairs</div>
            </div>
          </div>
        </header>

        <nav className="tabs" aria-label="Analysis modes">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              className={className("tab", tab === t.id && "active")}
              onClick={() => {
                setTab(t.id);
                if (t.id === "battle") resetBattlePick();
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="workspace">
          {tab === "battle" && renderBattle()}
          {tab === "simulate" && renderSim()}
          {tab === "nash" && renderNash()}
        </section>
      </main>
    </div>
  );
}
