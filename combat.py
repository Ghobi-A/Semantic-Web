"""
Crestbound Duelists — Combat Engine (v2.0)
============================================
Compressed damage formula, probabilistic speed, Brace passive,
move execution with cooldowns/decay, and the 1v1 battle loop.
"""

from __future__ import annotations
import math
import random
from dataclasses import dataclass, field
from typing import Optional

from models import (
    Unit, Move, MoveType, MoveSlot, StatModifier, StatusEffect,
    STAT_DECAY, ClassName
)


# ── Configuration ────────────────────────────────────────────────────

SPEED_BAND: int = 7             # B parameter for probabilistic speed
GUARANTEED_RATIO: float = 2.0   # SPD ratio for guaranteed first strike
VARIANCE_LO: float = 0.85
VARIANCE_HI: float = 1.0
BRACE_MULTIPLIER: float = 1.05  # DEF/RES bonus for acting second
MAX_TURNS: int = 100            # safety cap to prevent infinite loops


# ── Logging ──────────────────────────────────────────────────────────

@dataclass
class ActionLog:
    """Single action record for analysis."""
    turn: int
    actor: str
    actor_class: str
    target: str
    target_class: str
    move_name: str
    move_slot: str
    move_type: str
    raw_damage: int
    variance_roll: float
    hit: bool
    final_damage: int
    target_hp_before: int
    target_hp_after: int
    actor_braced: bool
    target_braced: bool
    stat_mods_applied: list[str] = field(default_factory=list)
    status_applied: Optional[str] = None
    blocked_by_hex: bool = False


@dataclass
class BattleResult:
    """Full result of a 1v1 battle."""
    winner: str
    winner_class: str
    loser: str
    loser_class: str
    turns: int
    logs: list[ActionLog] = field(default_factory=list)


# ── Speed Resolution ─────────────────────────────────────────────────

def resolve_speed(unit_a: Unit, unit_b: Unit) -> tuple[Unit, Unit]:
    """
    Probabilistic speed system.
    Returns (first_actor, second_actor).
    """
    spd_a, spd_b = unit_a.spd, unit_b.spd

    if spd_a == spd_b:
        return (unit_a, unit_b) if random.random() < 0.5 else (unit_b, unit_a)

    faster, slower = (unit_a, unit_b) if spd_a > spd_b else (unit_b, unit_a)
    diff = abs(spd_a - spd_b)

    # Guaranteed threshold
    if faster.spd >= GUARANTEED_RATIO * slower.spd or diff >= SPEED_BAND:
        return faster, slower

    # Probabilistic band
    p_faster_first = 0.5 + 0.5 * (diff / SPEED_BAND)
    return (faster, slower) if random.random() < p_faster_first else (slower, faster)


# ── Damage Calculation ───────────────────────────────────────────────

def _resolve_adaptive_type(move: Move, attacker: Unit, defender: Unit) -> str:
    """For ADAPTIVE moves, pick whichever type deals more damage."""
    phys_ratio = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
    mag_ratio = 2 * attacker.mag / max(1, attacker.mag + defender.res)
    return "physical" if phys_ratio >= mag_ratio else "magical"


def calculate_damage(
    move: Move,
    attacker: Unit,
    defender: Unit,
    defender_braced: bool = False,
) -> tuple[int, float, str]:
    """
    Compressed damage formula: Power × 2·ATK/(ATK+DEF) × v
    Returns (damage, variance_roll, resolved_type).
    """
    # Resolve type
    if move.move_type == MoveType.ADAPTIVE:
        resolved = _resolve_adaptive_type(move, attacker, defender)
    elif move.move_type == MoveType.PHYSICAL:
        resolved = "physical"
    else:
        resolved = "magical"

    # Pick stats
    if resolved == "physical":
        atk_stat = attacker.atk
        def_stat = defender.def_
    else:
        atk_stat = attacker.mag
        def_stat = defender.res

    # Brace passive: second actor gets defensive bonus
    if defender_braced:
        def_stat = math.floor(def_stat * BRACE_MULTIPLIER)

    # Variance roll
    v = random.uniform(VARIANCE_LO, VARIANCE_HI)

    # Core formula — compressed ratio: 2·ATK/(ATK+DEF)
    # Bounds multiplier to [0, 2], prevents extreme stat ratios
    # from creating deterministic outcomes
    ratio = 2 * atk_stat / max(1, atk_stat + def_stat)
    raw = math.floor(move.power * ratio * v)
    damage = max(1, raw)

    return damage, v, resolved


# ── Move Execution ───────────────────────────────────────────────────

def execute_move(
    attacker: Unit,
    defender: Unit,
    move: Move,
    turn: int,
    attacker_braced: bool,
    defender_braced: bool,
) -> ActionLog:
    """Execute a move: accuracy check, damage, effects. Returns log."""
    log = ActionLog(
        turn=turn,
        actor=attacker.name,
        actor_class=attacker.class_name.value,
        target=defender.name,
        target_class=defender.class_name.value,
        move_name=move.name,
        move_slot=move.slot.name,
        move_type="",
        raw_damage=0,
        variance_roll=0.0,
        hit=False,
        final_damage=0,
        target_hp_before=defender.hp,
        target_hp_after=defender.hp,
        actor_braced=attacker_braced,
        target_braced=defender_braced,
    )

    # Accuracy check
    hit = random.random() < move.accuracy
    log.hit = hit

    if not hit:
        log.target_hp_after = defender.hp
        # Still apply cooldown on miss
        if move.cooldown_turns > 0:
            attacker.cooldowns[move.name] = move.cooldown_turns
        return log

    # Check if buff move is blocked by Hex
    if move.is_buff_move and attacker.has_status("hexed"):
        log.blocked_by_hex = True
        log.target_hp_after = defender.hp
        if move.cooldown_turns > 0:
            attacker.cooldowns[move.name] = move.cooldown_turns
        return log

    # Calculate damage
    damage, v, resolved = calculate_damage(move, attacker, defender, defender_braced)
    log.move_type = resolved
    log.raw_damage = damage
    log.variance_roll = v
    log.final_damage = damage

    # Apply damage
    defender.hp = max(0, defender.hp - damage)
    log.target_hp_after = defender.hp

    # Apply target stat mods
    for stat, amount in move.target_stat_mods:
        defender.apply_stat_mod(stat, amount, STAT_DECAY)
        log.stat_mods_applied.append(f"{defender.name}.{stat}{amount:+d}")

    # Apply self stat mods (only if not hexed for buff moves)
    if not (move.self_stat_mods and attacker.has_status("hexed")):
        for stat, amount in move.self_stat_mods:
            attacker.apply_stat_mod(stat, amount, STAT_DECAY)
            log.stat_mods_applied.append(f"{attacker.name}.{stat}{amount:+d}")

    # Apply status effects
    if move.applies_status:
        defender.apply_status(move.applies_status, move.status_duration)
        log.status_applied = move.applies_status

    # Set cooldown
    if move.cooldown_turns > 0:
        attacker.cooldowns[move.name] = move.cooldown_turns

    return log


# ── 1v1 Battle Loop ─────────────────────────────────────────────────

def battle_1v1(
    unit_a: Unit,
    unit_b: Unit,
    ai_policy_a: callable,
    ai_policy_b: callable,
    log_actions: bool = False,
) -> BattleResult:
    """
    Run a full 1v1 battle between two units.
    ai_policy: callable(attacker, defender, turn) -> Move
    Returns BattleResult.
    """
    unit_a.reset()
    unit_b.reset()
    logs: list[ActionLog] = []

    for turn in range(1, MAX_TURNS + 1):
        if not unit_a.is_alive or not unit_b.is_alive:
            break

        # Resolve speed
        first, second = resolve_speed(unit_a, unit_b)
        first_opp = second    # first actor attacks second
        second_opp = first    # second actor attacks first

        # Brace: second actor is braced
        first_braced = False
        second_braced = True

        # Choose moves from each side's policy
        move_first = ai_policy_a(first, first_opp, turn) if first == unit_a else ai_policy_b(first, first_opp, turn)
        move_second = ai_policy_a(second, second_opp, turn) if second == unit_a else ai_policy_b(second, second_opp, turn)

        # First action
        log1 = execute_move(first, first_opp, move_first, turn, first_braced, second_braced)
        if log_actions:
            logs.append(log1)

        # If target died, skip second action
        if not first_opp.is_alive:
            break

        # Second action
        log2 = execute_move(second, second_opp, move_second, turn, second_braced, first_braced)
        if log_actions:
            logs.append(log2)

        # End-of-turn decay and cooldown tick
        unit_a.tick_modifiers()
        unit_b.tick_modifiers()
        unit_a.tick_cooldowns()
        unit_b.tick_cooldowns()

    # Determine result
    if unit_a.is_alive and not unit_b.is_alive:
        return BattleResult(unit_a.name, unit_a.class_name.value, unit_b.name, unit_b.class_name.value, turn, logs)
    elif unit_b.is_alive and not unit_a.is_alive:
        return BattleResult(unit_b.name, unit_b.class_name.value, unit_a.name, unit_a.class_name.value, turn, logs)
    else:
        # Rare stalemate: pick winner by HP remaining
        if unit_a.hp >= unit_b.hp:
            return BattleResult(unit_a.name, unit_a.class_name.value, unit_b.name, unit_b.class_name.value, MAX_TURNS, logs)
        else:
            return BattleResult(unit_b.name, unit_b.class_name.value, unit_a.name, unit_a.class_name.value, MAX_TURNS, logs)
