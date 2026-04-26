"""
Crestbound Duelists — Nash Equilibrium Analysis (v2.1)
=======================================================
Computes single-turn normal form games per matchup:
  - 3×3 expected-payoff matrix (attacker move × defender move)
  - Mixed-strategy Nash equilibrium via linear programming
  - Policy entropy as a measure of strategic stochasticity
  - Comparison: does Nash differ from Greedy?

Core question:
  "When do stochastic execution dynamics fail to induce
   mixed-strategy optimal play?"
"""

from __future__ import annotations
import math
import numpy as np
from scipy.optimize import linprog

from models import ClassName, create_unit, Unit, Move, MoveType
from combat import VARIANCE_LO, VARIANCE_HI, BRACE_MULTIPLIER


ALL_CLASSES = list(ClassName)


# ── Expected Damage (Deterministic) ──────────────────────────────────

def _expected_damage(move: Move, attacker: Unit, defender: Unit) -> float:
    """Expected damage of a move = power × compressed_ratio × avg_variance."""
    if move.move_type == MoveType.ADAPTIVE:
        phys = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
        mag = 2 * attacker.mag / max(1, attacker.mag + defender.res)
        ratio = max(phys, mag)
    elif move.move_type == MoveType.PHYSICAL:
        ratio = 2 * attacker.atk / max(1, attacker.atk + defender.def_)
    else:
        ratio = 2 * attacker.mag / max(1, attacker.mag + defender.res)

    avg_v = (VARIANCE_LO + VARIANCE_HI) / 2
    return move.power * ratio * avg_v * move.accuracy


# ── Build Payoff Matrix ──────────────────────────────────────────────

def build_payoff_matrix(class_a: ClassName, class_b: ClassName) -> tuple[np.ndarray, list[str], list[str]]:
    """
    Build the 3×3 expected payoff matrix for a single-turn game.
    Payoff[i][j] = E[damage_A(move_i)] − E[damage_B(move_j)]
    
    This represents: if A picks move i and B picks move j simultaneously,
    A's net advantage is the damage A deals minus the damage A receives.
    """
    unit_a = create_unit(class_a)
    unit_b = create_unit(class_b)

    moves_a = unit_a.moves
    moves_b = unit_b.moves

    n_a = len(moves_a)
    n_b = len(moves_b)

    payoff = np.zeros((n_a, n_b))

    for i, ma in enumerate(moves_a):
        for j, mb in enumerate(moves_b):
            dmg_a = _expected_damage(ma, unit_a, unit_b)
            dmg_b = _expected_damage(mb, unit_b, unit_a)
            payoff[i, j] = dmg_a - dmg_b

    names_a = [m.name for m in moves_a]
    names_b = [m.name for m in moves_b]

    return payoff, names_a, names_b


# ── Nash Equilibrium Solver (Maximin via LP) ─────────────────────────

def solve_maximin(payoff: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Solve for Player A's maximin mixed strategy using linear programming.
    
    Player A chooses probability distribution p over rows to maximise
    the minimum expected payoff against any column choice by B.
    
    Returns (strategy, value) where strategy is the probability vector.
    """
    m, n = payoff.shape

    # LP: maximise v subject to:
    #   sum(p_i * payoff[i,j]) >= v  for all j
    #   sum(p_i) = 1, p_i >= 0
    #
    # Rewrite as minimise -v:
    #   c = [0, 0, ..., 0, -1]  (m zeros for p, then -1 for v)
    #   A_ub: for each j: -sum(p_i * payoff[i,j]) + v <= 0
    #   A_eq: sum(p_i) = 1

    c = np.zeros(m + 1)
    c[-1] = -1  # minimise -v = maximise v

    # Inequality constraints: -payoff.T @ p + v <= 0
    A_ub = np.zeros((n, m + 1))
    for j in range(n):
        A_ub[j, :m] = -payoff[:, j]
        A_ub[j, -1] = 1
    b_ub = np.zeros(n)

    # Equality constraint: sum(p) = 1
    A_eq = np.zeros((1, m + 1))
    A_eq[0, :m] = 1
    b_eq = np.array([1.0])

    # Bounds: p_i >= 0, v is free
    bounds = [(0, None)] * m + [(None, None)]

    result = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
                     bounds=bounds, method='highs')

    if result.success:
        strategy = result.x[:m]
        value = result.x[-1]
        # Clean up tiny numerical artifacts
        strategy = np.maximum(strategy, 0)
        strategy /= strategy.sum()
        return strategy, value
    else:
        # Fallback: uniform
        return np.ones(m) / m, 0.0


# ── Entropy ──────────────────────────────────────────────────────────

def policy_entropy(strategy: np.ndarray) -> float:
    """Shannon entropy of a probability distribution. 0 = pure, log2(n) = uniform."""
    s = strategy[strategy > 1e-10]
    return -np.sum(s * np.log2(s))


# ── Greedy Comparison ────────────────────────────────────────────────

def greedy_choice(payoff: np.ndarray) -> int:
    """Greedy picks the row with highest average payoff (= highest expected damage)."""
    return int(np.argmax(payoff.mean(axis=1)))


# ── Full Analysis ────────────────────────────────────────────────────

def analyse_matchup(class_a: ClassName, class_b: ClassName) -> dict:
    """Full Nash analysis for a single matchup."""
    payoff, names_a, names_b = build_payoff_matrix(class_a, class_b)
    strategy_a, value_a = solve_maximin(payoff)
    strategy_b, value_b = solve_maximin(-payoff.T)

    entropy_a = policy_entropy(strategy_a)
    entropy_b = policy_entropy(strategy_b)

    greedy_idx = greedy_choice(payoff)
    nash_dominant = int(np.argmax(strategy_a))

    is_pure_a = entropy_a < 0.01
    greedy_matches_nash = greedy_idx == nash_dominant

    return {
        "class_a": class_a.value,
        "class_b": class_b.value,
        "payoff": payoff,
        "moves_a": names_a,
        "moves_b": names_b,
        "strategy_a": strategy_a,
        "strategy_b": strategy_b,
        "entropy_a": entropy_a,
        "entropy_b": entropy_b,
        "value_a": value_a,
        "is_pure_a": is_pure_a,
        "greedy_idx": greedy_idx,
        "greedy_move": names_a[greedy_idx],
        "nash_dominant": names_a[nash_dominant],
        "greedy_matches_nash": greedy_matches_nash,
    }


def run_full_analysis(verbose: bool = True) -> list[dict]:
    """Run Nash analysis for all 15 unique matchups."""
    results = []

    if verbose:
        print(f"\n{'='*75}")
        print(f"  NASH EQUILIBRIUM ANALYSIS — Single-Turn Normal Form Games")
        print(f"{'='*75}\n")

    for i, class_a in enumerate(ALL_CLASSES):
        for j, class_b in enumerate(ALL_CLASSES):
            if i >= j:
                continue

            r = analyse_matchup(class_a, class_b)
            results.append(r)

            if verbose:
                eq_type = "PURE" if r["is_pure_a"] else "MIXED"
                match = "✓" if r["greedy_matches_nash"] else "✗"

                print(f"  {r['class_a']:>10} vs {r['class_b']:<10}  "
                      f"Equilibrium: {eq_type:<5}  "
                      f"Entropy: {r['entropy_a']:.3f}  "
                      f"Greedy={r['greedy_move']:<16} "
                      f"Nash={r['nash_dominant']:<16} "
                      f"Match: {match}")

                if not r["is_pure_a"]:
                    print(f"{'':>25}Strategy: ", end="")
                    for name, prob in zip(r["moves_a"], r["strategy_a"]):
                        if prob > 0.01:
                            print(f"{name}={prob:.1%}  ", end="")
                    print()

    # Summary
    if verbose:
        n_pure = sum(1 for r in results if r["is_pure_a"])
        n_mixed = len(results) - n_pure
        n_greedy_match = sum(1 for r in results if r["greedy_matches_nash"])
        avg_entropy = np.mean([r["entropy_a"] for r in results])

        print(f"\n{'='*75}")
        print(f"  SUMMARY")
        print(f"{'='*75}")
        print(f"  Total matchups:        {len(results)}")
        print(f"  Pure equilibria:       {n_pure} ({100*n_pure/len(results):.0f}%)")
        print(f"  Mixed equilibria:      {n_mixed} ({100*n_mixed/len(results):.0f}%)")
        print(f"  Greedy = Nash:         {n_greedy_match}/{len(results)} ({100*n_greedy_match/len(results):.0f}%)")
        print(f"  Avg policy entropy:    {avg_entropy:.3f} (0=pure, 1.58=uniform over 3)")
        print()

        if avg_entropy < 0.1:
            print(f"  Verdict: System is STRATEGY-DETERMINISTIC")
            print(f"  → Execution stochasticity does NOT induce mixed optimal play")
        elif avg_entropy < 0.5:
            print(f"  Verdict: System is PARTIALLY STRATEGIC")
            print(f"  → Some matchups admit mixed play, others are dominated")
        else:
            print(f"  Verdict: System is STRATEGICALLY STOCHASTIC")
            print(f"  → Mixed strategies are genuinely optimal")

    return results


if __name__ == "__main__":
    run_full_analysis()
