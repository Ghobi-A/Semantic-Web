# Crestbound Duelists

Crestbound Duelists is a turn-based combat simulation engine built in Python, with a React frontend prototype for playtesting and in-browser simulation.

## What it is

This project models a 1v1 tactical combat system with six classes, class-specific move sets, cooldowns, status effects, temporary stat modifiers, probabilistic turn order, and a compressed damage formula designed for balance stability.

It also includes a Monte Carlo simulation harness for evaluating matchup balance and comparing AI policies.

## Core mechanics

- 6 playable classes:
  - Warrior
  - Mage
  - Assassin
  - Guardian
  - Neutral
  - Sorcerer

- 3 move archetypes per class:
  - Basic
  - Signature
  - Gambit

- Combat features:
  - compressed damage formula
  - probabilistic speed resolution
  - Brace passive for second actor
  - cooldowns
  - stat-modifier decay
  - status effects such as Hex

## AI policies

The engine includes three policy tiers:

- Random
- Greedy
- Lookahead

These policies can be benchmarked against one another through large-scale automated battle simulation.

## Monte Carlo analysis

The simulation layer supports:

- class-vs-class win-rate matrices
- average win-rate ranking by class
- mirror-match policy comparison
- battle-log export for downstream notebook analysis

## Files

- `models.py` — data models, class definitions, unit factory
- `combat.py` — combat engine and battle loop
- `ai.py` — policy implementations
- `simulation.py` — Monte Carlo harness and log export
- `main.py` — full runner
- `frontend/crestbound_duelists.jsx` — React GUI prototype

## Run the Python engine

```bash
python main.py
