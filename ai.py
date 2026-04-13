"""
Crestbound Duelists — AI Policies (v2.0)
==========================================
Three AI tiers:
  1. Random  — uniform random from available moves
  2. Greedy  — picks highest expected damage this turn
  3. Lookahead — 1-step minimax (my value − 0.5 × opp best response)
"""

from __future__ import annotations
import math
import random

from models import Unit, Move, MoveType, MoveSlot
from combat import BRACE_MULTIPLIER, VARIANCE_LO, VARIANCE_HI


# ── Expected Damage Helper ───────────────────────────────────────────

def expected_damage(move: Move, attacker: Unit, defender: Unit, defender_braced: bool = False) -> float:
    """
    Expected damage of a move = power × compressed_ratio × avg_variance × accuracy.
    Compressed ratio: 2·ATK/(ATK+DEF), bounded [0, 2].
    For ADAPTIVE moves, picks the better type.
    """
    if move.move_type == MoveType.ADAPTIVE:
        phys_ratio = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
        mag_ratio = 2 * attacker.mag / max(1, attacker.mag + defender.res)
        ratio = max(phys_ratio, mag_ratio)
    elif move.move_type == MoveType.PHYSICAL:
        atk = attacker.atk
        dfn = defender.def_
        if defender_braced:
            dfn = math.floor(dfn * BRACE_MULTIPLIER)
        ratio = 2 * atk / max(1, atk + dfn)
    else:  # MAGICAL
        atk = attacker.mag
        dfn = defender.res
        if defender_braced:
            dfn = math.floor(dfn * BRACE_MULTIPLIER)
        ratio = 2 * atk / max(1, atk + dfn)

    avg_variance = (VARIANCE_LO + VARIANCE_HI) / 2
    return move.power * ratio * avg_variance * move.accuracy


def can_ko_this_turn(attacker: Unit, defender: Unit, move: Move) -> bool:
    """Can this move KO the defender at max roll?"""
    if move.move_type == MoveType.ADAPTIVE:
        phys_ratio = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
        mag_ratio = 2 * attacker.mag / max(1, attacker.mag + defender.res)
        ratio = max(phys_ratio, mag_ratio)
    elif move.move_type == MoveType.PHYSICAL:
        ratio = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
    else:
        ratio = 2 * attacker.mag / max(1, attacker.mag + defender.res)
    max_dmg = math.floor(move.power * ratio * VARIANCE_HI)
    return max_dmg >= defender.hp


# ── Policy: Random ───────────────────────────────────────────────────

def policy_random(attacker: Unit, defender: Unit, turn: int) -> Move:
    """Pick a random available move."""
    available = attacker.available_moves()
    return random.choice(available) if available else attacker.moves[0]


# ── Policy: Greedy ───────────────────────────────────────────────────

def policy_greedy(attacker: Unit, defender: Unit, turn: int) -> Move:
    """Pick the move with highest expected damage. Prioritise KO moves."""
    available = attacker.available_moves()
    if not available:
        return attacker.moves[0]

    # If we can KO, pick the most accurate KO move
    ko_moves = [(m, expected_damage(m, attacker, defender)) for m in available
                if can_ko_this_turn(attacker, defender, m)]
    if ko_moves:
        ko_moves.sort(key=lambda x: (-x[0].accuracy, -x[1]))
        return ko_moves[0][0]

    # Otherwise pick highest expected damage
    return max(available, key=lambda m: expected_damage(m, attacker, defender))


# ── Policy: Lookahead ────────────────────────────────────────────────

def _simulate_move_value(attacker: Unit, defender: Unit, move: Move) -> float:
    """
    Estimate the value of a move considering:
    - Expected damage
    - Debuff value (future damage increase from stat mods)
    - Self-cost (self debuffs from Gambit moves)
    """
    base_ev = expected_damage(move, attacker, defender)

    # Value of debuffs applied to target
    debuff_value = 0.0
    for stat, amount in move.target_stat_mods:
        # Negative amount = debuff = good for us
        # Each point of DEF/RES reduction ≈ 1-2% more damage over 3 turns
        debuff_value += abs(amount) * 2.0 if amount < 0 else 0

    # Cost of self-debuffs
    self_cost = 0.0
    for stat, amount in move.self_stat_mods:
        if amount < 0:
            self_cost += abs(amount) * 1.5

    # Buff value
    buff_value = 0.0
    for stat, amount in move.self_stat_mods:
        if amount > 0:
            buff_value += amount * 1.5

    # Hex value: blocking buffs is valuable against Guardian/Neutral
    hex_value = 0.0
    if move.applies_status == "hexed":
        hex_value = 5.0  # bonus for strategic control

    return base_ev + debuff_value + buff_value - self_cost + hex_value


def policy_lookahead(attacker: Unit, defender: Unit, turn: int) -> Move:
    """
    1-step minimax: pick the move that maximises
    (my expected value) − 0.5 × (opponent's best response).
    """
    available = attacker.available_moves()
    if not available:
        return attacker.moves[0]

    # KO check (same as greedy)
    ko_moves = [(m, expected_damage(m, attacker, defender)) for m in available
                if can_ko_this_turn(attacker, defender, m)]
    if ko_moves:
        ko_moves.sort(key=lambda x: (-x[0].accuracy, -x[1]))
        return ko_moves[0][0]

    opp_available = defender.available_moves()
    opp_best = 0.0
    if opp_available:
        opp_best = max(_simulate_move_value(defender, attacker, m) for m in opp_available)

    best_move = None
    best_score = -float("inf")
    for move in available:
        my_score = _simulate_move_value(attacker, defender, move)
        total_score = my_score - 0.5 * opp_best
        if total_score > best_score:
            best_score = total_score
            best_move = move

    return best_move if best_move else available[0]


POLICIES = {
    "random": policy_random,
    "greedy": policy_greedy,
    "lookahead": policy_lookahead,
}
