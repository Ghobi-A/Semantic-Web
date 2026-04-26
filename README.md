# Crestbound Duelists

**A data science case study in adversarial decision-making under stochastic execution.**

*When does randomness fail to produce randomness in optimal strategy?*

---

## Key Results (TL;DR)

Across all 15 class matchups using single-turn payoff analysis:

- **All equilibria converge to pure strategies**
- **Execution stochasticity alone does not induce mixed-strategy optimal play**
- **Immediate expected damage dominates decision-making**
- **Strategic randomness only emerges in multi-turn stateful systems**

**Implication:**  
Uncertainty in execution ≠ uncertainty in optimal policy.

---

## Overview

Crestbound Duelists is a turn-based combat simulator used as a controlled environment to study decision-making under uncertainty.

The system includes:
- Six asymmetric classes
- Three move types per class
- Probabilistic turn order
- Damage variance
- Cooldowns, buffs, and status effects

This is not a game project.  
It is a **decision system experiment**.

The focus is:
- Policy evaluation under stochastic dynamics  
- Monte Carlo simulation at scale  
- Game-theoretic stability analysis  

---

## Core Question

> When does stochastic execution force optimal strategies to become mixed rather than deterministic?

---

## Findings

The `nash.py` module models each class pairing as a **single-turn normal form game**, where:

- Each player selects one of three actions  
- Payoff = expected damage dealt − expected damage received  

### Results

| Question | Answer |
|----------|--------|
| Do single-turn matchups require mixed strategies? | No |
| Does stochastic execution induce mixed strategies? | No |
| Why? | Immediate expected damage dominates |
| What’s missing? | Multi-turn state (cooldowns, buffs, status effects) |

### Interpretation

Despite:
- Damage randomness  
- Probabilistic speed resolution  

The system **collapses to deterministic optimal play**.

This occurs because:
- Secondary mechanics (buffs, cooldowns, status effects)  
  only provide value across multiple turns  
- The single-turn abstraction overweights immediate payoff  

---

## Methodology

### Simulation Layer

Monte Carlo simulations are used to evaluate policies across repeated matchups:

- 1v1 class combinations (15 pairings)
- Metrics tracked:
  - Win rate  
  - Fight duration  
  - Move usage  
  - Optional action logs  

---

### Policy Comparison

| Policy | Description | Role |
|--------|------------|------|
| Random | Uniform move selection | Baseline |
| Greedy | Max immediate expected damage | Myopic benchmark |
| Lookahead | One-step minimax heuristic | Short-horizon strategy |

---

### Game-Theoretic Analysis

For each matchup:

- Construct 3×3 payoff matrix  
- Solve maximin strategy via linear programming  
- Compute entropy of resulting policy  

**Observation:**  
Low entropy → pure strategy dominance

---

## Combat Model

| Mechanic | Implementation |
|----------|--------------|
| Damage | Scaled ratio with 0.85–1.0 random variance |
| Speed | Probabilistic turn order, deterministic at 2× ratio |
| Brace | Defensive modifier for second mover |
| Cooldowns | Signature/Gambit moves gated |
| Stat Decay | Temporary modifiers expire |
| Hex | Prevents buff usage temporarily |

Each class has:
- Basic move  
- Signature move  
- Gambit  

This constrains the action space while preserving strategic depth.

---

## Class Roster

| Class | HP | ATK | DEF | MAG | RES | SPD | Role |
|-------|---:|----:|----:|----:|----:|----:|------|
| Warrior | 85 | 75 | 70 | 30 | 35 | 40 | Physical bruiser |
| Mage | 75 | 30 | 35 | 80 | 75 | 42 | Magical specialist |
| Assassin | 70 | 70 | 35 | 38 | 55 | 80 | Fast attacker |
| Guardian | 85 | 40 | 75 | 40 | 75 | 35 | Defensive tank |
| Neutral | 78 | 55 | 50 | 55 | 50 | 50 | Generalist |
| Sorcerer | 72 | 40 | 30 | 80 | 48 | 80 | Fast caster |

---

## Outputs

The repository includes generated analysis artifacts:

- `greedy_heatmap.png` → policy preference patterns  
- `class_rankings.png` → matchup strength distribution  
- `policy_comparison.png` → performance differences  
- `fight_duration.png` → convergence dynamics  
- `move_usage.png` → behavioural tendencies  

These are **derived outputs**, not static benchmarks.

---

## Repository Structure

```text
Crestbound-Duelists/
|-- models.py
|-- combat.py
|-- ai.py
|-- simulation.py
|-- nash.py
|-- main.py
|-- analysis.ipynb
|-- requirements.txt
|-- *.png
|-- README.md
`-- LICENSE
