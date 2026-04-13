import time
from models import ClassName
from simulation import (
    generate_win_matrix,
    print_matrix,
    compute_averages,
    print_averages,
    compare_policies,
    export_battle_logs,
)

SIMS_MATRIX = 100_000      # per matchup for the 6×6 matrix
SIMS_POLICY = 10_000       # per class for policy comparison
SIMS_LOG_EXPORT = 1_000    # for CSV export (keep manageable)


def separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def main():
    t_start = time.time()

    # ── 1. Greedy AI Matrix ──────────────────────────────────────────
    separator("1. GREEDY AI — 6×6 WIN-RATE MATRIX")
    matrix_greedy = generate_win_matrix(SIMS_MATRIX, "greedy")
    print()
    print_matrix(matrix_greedy)
    avgs_greedy = compute_averages(matrix_greedy)
    print_averages(avgs_greedy)

    # ── 2. Lookahead AI Matrix ───────────────────────────────────────
    separator("2. LOOKAHEAD AI — 6×6 WIN-RATE MATRIX")
    matrix_lookahead = generate_win_matrix(SIMS_MATRIX, "lookahead")
    print()
    print_matrix(matrix_lookahead)
    avgs_lookahead = compute_averages(matrix_lookahead)
    print_averages(avgs_lookahead)

    # ── 3. Policy Comparison ─────────────────────────────────────────
    separator("3. POLICY COMPARISON — GREEDY vs LOOKAHEAD")
    compare_policies("lookahead", "greedy", SIMS_POLICY)

    # ── 4. Balance Delta Analysis ────────────────────────────────────
    separator("4. BALANCE DELTA — GREEDY vs LOOKAHEAD AVERAGES")
    print(f"  {'Class':<12} {'Greedy':>8} {'Lookahead':>10} {'Delta':>8}")
    print(f"  {'-'*40}")
    for cls in sorted(avgs_greedy, key=lambda c: avgs_greedy[c], reverse=True):
        g = avgs_greedy[cls]
        l = avgs_lookahead[cls]
        d = l - g
        sign = "+" if d >= 0 else ""
        print(f"  {cls.value:<12} {g:>7.1f}% {l:>9.1f}% {sign}{d:>6.1f}%")

    # ── 5. Sample Log Export ─────────────────────────────────────────
    separator("5. SAMPLE LOG EXPORT")
    export_battle_logs(
        ClassName.SORCERER, ClassName.GUARDIAN, SIMS_LOG_EXPORT,
        "greedy", "/home/claude/crestbound/sample_logs_sor_vs_gua.csv"
    )
    export_battle_logs(
        ClassName.ASSASSIN, ClassName.WARRIOR, SIMS_LOG_EXPORT,
        "greedy", "/home/claude/crestbound/sample_logs_ass_vs_war.csv"
    )

    # ── Summary ──────────────────────────────────────────────────────
    elapsed = time.time() - t_start
    separator(f"COMPLETE — Total time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
