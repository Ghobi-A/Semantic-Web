# Crestbound Duelists

**Optimal decision-making under uncertainty in adversarial turn-based systems.**

*When do stochastic execution dynamics fail to induce mixed-strategy optimal play?*

A turn-based class combat engine designed as a data science portfolio piece. Six classes, three move archetypes, probabilistic speed resolution, and a compressed damage formula — all fully automatable for Monte Carlo simulation, AI policy comparison, and game-theoretic equilibrium analysis.

The game is the domain. The data science is the product.

---

## What This Project Does

Pits six combat classes against each other across thousands of simulated battles, comparing how different AI decision policies perform under uncertainty. Every action, damage roll, and decision is logged to CSV for analysis.

**Core question:** *How much does strategic depth matter when outcomes are stochastic?*

### Key Results (v2.1, 10k sims/matchup)

| Class | Avg Win Rate | Delta |
|-------|-------------|-------|
| Mage | ~55% | +5 |
| Warrior | ~53% | +3 |
| Neutral | ~49% | -1 |
| Guardian | ~49% | -1 |
| Sorcerer | ~49% | -1 |
| Assassin | ~46% | -4 |

Balance spread: **~9pp** — all classes viable, no class below 45% or above 55%.

---

## Architecture

```
crestbound/
├── models.py        # Unit, Move, StatusEffect dataclasses. 6-class × 3-move table.
├── combat.py        # Damage calc, speed resolution, Brace passive, battle loop.
├── ai.py            # Random, Greedy, Lookahead AI policies.
├── nash.py          # Nash equilibrium solver, policy entropy, Greedy vs Nash comparison.
├── simulation.py    # Monte Carlo harness, 6×6 matrix, CSV export.
├── main.py          # Runner: matrices, policy comparison, log export.
├── analysis.ipynb   # Jupyter notebook with heatmaps and visualisations.
└── results/         # Generated PNGs and CSV battle logs.
```

### Combat System

| Mechanic | Implementation |
|----------|---------------|
| **Damage** | `floor(Power × 2·ATK/(ATK+DEF) × v)`, v ~ U(0.85, 1.0) |
| **Speed** | Probabilistic band (B=7), guaranteed at 2× ratio |
| **Brace** | Second actor gets 1.05× DEF/RES |
| **Cooldowns** | Signature/Gambit on 1-turn cooldown after use |
| **Stat decay** | All modifiers expire after 3 turns |
| **Hex** | Blocks self-buff moves for 2 turns |

### Move System

Each class has three moves:

- **Basic** — 24 power, 100% accuracy, no cooldown. Reliable fallback.
- **Signature** — 16–18 power with a secondary effect (debuff/buff/status). Defines class identity.
- **Gambit** — 28–32 power, 70–80% accuracy. High-risk/high-reward.

### AI Policies

| Policy | Strategy | Use |
|--------|----------|-----|
| **Random** | Uniform random from available moves | Baseline |
| **Greedy** | Highest expected damage this turn | Balance testing |
| **Lookahead** | 1-step minimax (my EV − 0.5 × opp best response) | Strategic depth measurement |

---

## Quick Start

```bash
# Clone
git clone https://github.com/Ghobi-A/Crestbound-Duelists.git
cd Crestbound-Duelists

# Run the full simulation suite (takes a few minutes at 100k sims)
python main.py

# Or quick test at 10k sims — edit SIMS_MATRIX in main.py
```

**Requirements:** Python 3.10+ (stdlib only — no external dependencies for the engine).

For the notebook: `pip install matplotlib seaborn jupyter pandas numpy`

---

## Class Stats (v2.1)

| Class | HP | ATK | DEF | MAG | RES | SPD | Role |
|-------|---:|----:|----:|----:|----:|----:|------|
| Warrior | 85 | 75 | 70 | 30 | 35 | 40 | Physical bruiser |
| Mage | 75 | 30 | 35 | 80 | 75 | 42 | Magical specialist |
| Assassin | 70 | 70 | 35 | 38 | 55 | 80 | Fast glass cannon |
| Guardian | 85 | 40 | 75 | 40 | 75 | 35 | Dual-defence tank |
| Neutral | 78 | 55 | 50 | 55 | 50 | 50 | Adaptive generalist |
| Sorcerer | 72 | 40 | 30 | 80 | 48 | 80 | Fast magical cannon |

---

## Design Decisions

**Compressed damage formula** — Raw ATK/DEF ratio created 2.5× multipliers and 2HKO determinism. `2·ATK/(ATK+DEF)` bounds the multiplier to [0, 2], extending fights to 3–4 turns where move choices actually matter.

**Brace at 1.05×** — Compensates slow units for always taking the first hit. 1.1× was tested and caused Guardian to hit 90%+ win rates.

**3-turn stat decay** — Prevents infinite debuff stacking. Creates timing pressure: you must capitalise on Armor Break before it expires.

**Hex as buff counter** — Instead of giving Sorcerer raw stat superiority, Hex blocks Guardian's Fortify for 2 turns. Strategic tool with clear counterplay.

---

## Nash Equilibrium Analysis

Single-turn normal form game analysis reveals that **all 15 matchups have pure-strategy Nash equilibria**. Greedy play equals Nash-optimal play in every case. Average policy entropy = 0.

| Metric | Result |
|--------|--------|
| Pure equilibria | 15/15 (100%) |
| Mixed equilibria | 0/15 (0%) |
| Greedy = Nash | 15/15 (100%) |
| Avg policy entropy | 0.000 |

**Verdict:** The system is *strategy-deterministic* — execution stochasticity (damage variance, speed resolution) does **not** induce mixed-strategy optimal play at the single-turn level.

**Why:** Basic moves dominate because Signature/Gambit effects (debuffs, buffs, status) only pay off over multiple turns, which the single-turn payoff matrix cannot capture. The real question is whether the *multi-turn extensive form game* admits mixed equilibria.

---

## Known Issues / Next Steps

- **Mage vs Assassin** is near-deterministic (~100/0) — structural type mismatch (physical-only into high RES)
- **Multi-turn Nash analysis** — extend equilibrium computation to the extensive form game to test whether multi-turn setup moves (Armor Break → Gambit sequences) induce mixed play
- **Policy entropy by matchup** — identify which matchups are game-theoretically trivial vs genuinely strategic
- **3v3 team composition** — switching, TFT-style synergy traits
- **Streamlit web demo** — interactive version for non-technical users

---

## Version History

| Version | Changes |
|---------|---------|
| v2.0 | Compressed formula, Brace passive, 3-move system, Greedy + Lookahead AI |
| v2.1 | Balance pass: Neutral buffs (HP 78, Hybrid Strike 23p, Focus Shift +5/+5), Assassin tuning (RES 55, MAG 38, Cripple -5/-5), Guardian ATK 40, Sorcerer HP 72. CSV export. Spread reduced from 36pp to 9pp. |
| v2.1+Nash | Single-turn Nash equilibrium solver. Proved system is strategy-deterministic: all 15 matchups have pure equilibria, Greedy = Nash optimal. |

---

## License

MIT
