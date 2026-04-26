# Crestbound Duelists

**A data science case study in adversarial decision-making under stochastic execution.**

*When do stochastic execution dynamics fail to induce mixed-strategy optimal play?*

Crestbound Duelists is a compact turn-based combat simulator used as an experimental domain for Monte Carlo simulation, AI policy comparison, and single-turn game-theoretic analysis. The project treats the game engine as a controlled system: six asymmetric classes, three move archetypes, probabilistic speed resolution, damage variance, cooldowns, buffs, debuffs, and status effects.

The portfolio focus is not game production. It is the analytical workflow around a stochastic decision system: define mechanics, simulate repeated outcomes, compare policies, inspect generated logs, and test whether uncertainty is enough to make mixed strategies optimal.

## Current Findings

The current `nash.py` implementation models the 15 unique class pairings as single-turn normal form games where each player chooses one of three moves and payoff is expected damage dealt minus expected damage received.

Based on the checked-in Nash analysis logic:

| Question | Current result |
|----------|----------------|
| Do single-turn matchups require mixed strategies? | No. The analysis identifies pure-strategy equilibria. |
| Does execution stochasticity alone induce mixed-strategy optimal play? | No, not at the single-turn level. |
| Why not? | Immediate expected damage dominates because many secondary effects gain value only across later turns. |
| What is the next technical extension? | Multi-turn equilibrium analysis over cooldowns, buffs, debuffs, and status effects. |

This is the central result: stochastic execution does not automatically imply stochastic optimal play. In this codebase, damage variance and probabilistic speed order are not enough to create mixed-strategy equilibria in the single-turn abstraction.

The committed PNG files are useful exploratory outputs from the notebook, but they should be read as generated analysis artifacts rather than immutable benchmark claims:

- `greedy_heatmap.png`
- `class_rankings.png`
- `policy_comparison.png`
- `fight_duration.png`
- `move_usage.png`

## Repository Structure

```text
Crestbound-Duelists/
|-- models.py              # Class, unit, move, and status-effect definitions
|-- combat.py              # Damage, speed resolution, cooldowns, statuses, battle loop
|-- ai.py                  # Random, greedy, and one-step lookahead policies
|-- simulation.py          # Monte Carlo matchups, policy comparison, CSV log export
|-- nash.py                # Single-turn normal form payoff matrices and maximin solver
|-- main.py                # Full simulation runner
|-- analysis.ipynb         # Notebook for visual analysis and chart generation
|-- requirements.txt       # Notebook and Nash-analysis dependencies
|-- *.png                  # Committed exploratory visual outputs
|-- README.md
`-- LICENSE
```

Generated CSV logs are written under `results/` by `main.py` and are intentionally ignored by git.

## Methodology

The simulation layer runs repeated 1v1 matchups between all six classes and records win rates, fight duration, move usage, and optional per-turn action logs. This supports balance inspection and policy comparison without relying on a single deterministic playthrough.

The analysis layer compares three decision policies:

| Policy | Strategy | Analytical role |
|--------|----------|-----------------|
| Random | Uniform random legal move | Baseline behavior |
| Greedy | Highest immediate expected damage | Myopic EV benchmark |
| Lookahead | One-step minimax-style heuristic | Short-horizon strategic benchmark |

The Nash layer builds a 3x3 payoff matrix for each class pairing using expected single-turn damage. It then solves a maximin linear program and computes policy entropy. Low or zero entropy indicates a pure action rather than a mixed policy.

## Combat Model

| Mechanic | Current implementation |
|----------|------------------------|
| Damage | Compressed attack/defense ratio with random variance between 0.85 and 1.0 |
| Speed | Probabilistic turn order with guaranteed advantage at a 2x speed ratio |
| Brace | The second actor receives a small defensive multiplier |
| Cooldowns | Signature and Gambit moves enter cooldown after use |
| Stat decay | Temporary modifiers expire after several turns |
| Hex | Blocks self-buff moves for a short duration |

Each class has a Basic move, a Signature move, and a Gambit. This keeps the action space small enough for direct normal form analysis while still allowing longer-horizon effects in full simulations.

## Class Roster

| Class | HP | ATK | DEF | MAG | RES | SPD | Role |
|-------|---:|----:|----:|----:|----:|----:|------|
| Warrior | 85 | 75 | 70 | 30 | 35 | 40 | Physical bruiser |
| Mage | 75 | 30 | 35 | 80 | 75 | 42 | Magical specialist |
| Assassin | 70 | 70 | 35 | 38 | 55 | 80 | Fast physical attacker |
| Guardian | 85 | 40 | 75 | 40 | 75 | 35 | Defensive tank |
| Neutral | 78 | 55 | 50 | 55 | 50 | 50 | Adaptive generalist |
| Sorcerer | 72 | 40 | 30 | 80 | 48 | 80 | Fast magical attacker |

## Quick Start

```bash
git clone https://github.com/Ghobi-A/Crestbound-Duelists.git
cd Crestbound-Duelists
pip install -r requirements.txt
python nash.py
python main.py
```

`main.py` is configured for larger Monte Carlo runs. For quick local iteration, reduce `SIMS_MATRIX`, `SIMS_POLICY`, or `SIMS_LOG_EXPORT` before running the full suite.

## Interpreting The Nash Result

The single-turn Nash analysis should not be read as a complete solution to the full combat game. It is a deliberately compressed abstraction that asks whether simultaneous one-move choice under stochastic execution creates mixed-strategy optimal play.

The current answer is no. Pure strategies appear because the payoff matrix mostly rewards immediate expected damage, while buffs, debuffs, cooldown pressure, and status effects only become strategically meaningful over multiple turns. A full equilibrium treatment would need a multi-turn extensive form or dynamic programming formulation that includes state transitions such as cooldown timers, remaining HP, active modifiers, and status durations.

## Next Steps

- Extend equilibrium analysis from single-turn normal form games to multi-turn stateful games.
- Recompute and version generated PNG outputs after any balance or policy changes.
- Add tests around payoff-matrix construction and policy behavior.
- Keep generated CSV logs out of source control while preserving compact visual artifacts that support the case study.

## License

MIT
