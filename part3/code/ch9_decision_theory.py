"""第 9 章参考实现：核对教程页面里出现的数值（以及原书笔误的判断）。

只用 Python 标准库。运行：

    python3 part3/code/ch9_decision_theory.py

会依次打印：
  1. 例 9.1、9.2：Pareto 最优（含宾夕法尼亚收费公路的车速）
  2. 例 9.4、9.5：骰子的期望；贝叶斯「马赛克图」互动图的默认数值
  3. 例 9.8–9.10：最坏情况 / 期望情况决策、遗憾矩阵；原书例 9.10 笔误的核对
  4. 互动图「与自然对弈」的各种决策准则（含习题 3 的乐观系数），习题 2、8 只核对不公开
  5. 补充例子「温度计」：观测、Θ(y)、后验与条件贝叶斯风险 (9.23)–(9.31)
  6. 例 9.11：图 9.1 的 OCR 特征、Θ(y) 与冲突（含补充的角点数 c）
  7. 例 9.12 / 习题 16：参数估计（平方损失下最优估计 = 后验均值）
  8. 例 9.13–9.15：安全策略、上 / 下值、鞍点；原书 9.3.2 节「遗憾」段笔误的核对
  9. 例 9.16 等：用精确分数单纯形法求随机化鞍点（线性规划）
 10. 例 9.17–9.19：纯 Nash 均衡、可容许均衡、安全策略
 11. 例 9.20：混合 Nash 均衡；核对 (9.75)(9.76) 丢掉的常数项
 12. 例 9.21：三人博弈的纯 Nash 均衡（原书笔误核对）；补充的「多数派」三人博弈
 13. 例 9.22、9.23：彩票的期望、效用与确定性等价；补充：圣彼得堡悖论
 14. 例 9.26、9.27：熵与「无信息先验」；球面 vs 立方体表面参数化的直线分布
 15. 例 9.28：支票 vs 现金的反推先验阈值
 16. 补充：重复囚徒困境（9.5.4 节提到的 Tit-for-Tat）
 17. 补充：猜硬币（例 9.7）对手知道你的策略时的期望代价
"""
import itertools
import math
import random
from fractions import Fraction as F


def show(x):
    """分数友好的打印。"""
    if isinstance(x, F):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    if isinstance(x, float):
        return f"{x:.6g}"
    return str(x)


def vec(v):
    return "[" + ", ".join(show(x) for x in v) + "]"


# ---------------------------------------------------------------- 1. Pareto
def dominates(a, b):
    """a 支配 b：不相等，且每个分量都 ≤。"""
    return a != b and all(x <= y for x, y in zip(a, b))


def pareto_set(costs):
    """costs: {action: cost_vector}，返回 Pareto 最优动作（按出现顺序）。"""
    return [u for u, c in costs.items() if not any(dominates(d, c) for v, d in costs.items() if v != u)]


def turnpike_fine(s):
    if s <= 55:
        return 0
    if s <= 65:
        return 50
    if s <= 75:
        return 100
    if s <= 85:
        return 200
    return 500


# ---------------------------------------------------------------- 3/4. 与自然对弈
def worst(row):
    return max(row)


def expected(row, p):
    return sum(c * q for c, q in zip(row, p))


def regret_matrix(L):
    cols = list(zip(*L))
    mins = [min(c) for c in cols]
    return [[L[i][j] - mins[j] for j in range(len(mins))] for i in range(len(L))]


def argmins(vals):
    m = min(vals)
    return [i for i, v in enumerate(vals) if v == m], m


def label(idx, prefix="u"):
    return ",".join(f"{prefix}{i + 1}" for i in idx)


# ---------------------------------------------------------------- 9. 线性规划（精确分数）
def simplex_max(c, A, b):
    """max c·x  s.t. A x ≤ b, x ≥ 0（b ≥ 0）。Bland 规则，返回 (x, 对偶 y, 最优值)。"""
    m, n = len(A), len(c)
    # 表：m 行约束 + 目标行；列：n 个原变量 + m 个松弛 + 右端
    T = [[F(v) for v in A[i]] + [F(int(i == k)) for k in range(m)] + [F(b[i])] for i in range(m)]
    z = [F(-v) for v in c] + [F(0)] * m + [F(0)]
    basis = [n + i for i in range(m)]
    while True:
        enter = next((j for j in range(n + m) if z[j] < 0), None)
        if enter is None:
            break
        rows = [(T[i][-1] / T[i][enter], basis[i], i) for i in range(m) if T[i][enter] > 0]
        if not rows:
            raise ValueError("无界")
        _, _, r = min(rows)
        piv = T[r][enter]
        T[r] = [v / piv for v in T[r]]
        for i in range(m):
            if i != r and T[i][enter] != 0:
                f = T[i][enter]
                T[i] = [a - f * bb for a, bb in zip(T[i], T[r])]
        f = z[enter]
        z = [a - f * bb for a, bb in zip(z, T[r])]
        basis[r] = enter
    x = [F(0)] * n
    for i, j in enumerate(basis):
        if j < n:
            x[j] = T[i][-1]
    y = [z[n + i] for i in range(m)]  # 松弛变量的检验数 = 对偶变量
    return x, y, z[-1]


def solve_zero_sum(A):
    """代价矩阵 A（P1 最小化、P2 最大化）。返回 (w*, z*, 值)。

    令 A' = A + c > 0，值 V' = V + c > 0。P1 的问题 min V' s.t. (wA')_j ≤ V'，
    换元 x = w / V' 得到 max Σx s.t. A'^T x ≤ 1；它的对偶给出 P2 的 z*。
    """
    m, n = len(A), len(A[0])
    c = 1 - min(min(r) for r in A)
    Ap = [[F(A[i][j]) + c for j in range(n)] for i in range(m)]
    AT = [[Ap[i][j] for i in range(m)] for j in range(n)]
    x, y, opt = simplex_max([1] * m, AT, [1] * n)
    Vp = 1 / opt
    w = [xi * Vp for xi in x]
    z = [yi * Vp for yi in y]
    return w, z, Vp - c


def security(A):
    rowmax = [max(r) for r in A]
    colmin = [min(A[i][j] for i in range(len(A))) for j in range(len(A[0]))]
    up = min(rowmax)
    lo = max(colmin)
    us = [i for i, v in enumerate(rowmax) if v == up]
    vs = [j for j, v in enumerate(colmin) if v == lo]
    return rowmax, colmin, us, vs, up, lo


def saddle_points(A):
    """满足 (9.52) 的格子：在所在行最大、在所在列最小。"""
    out = []
    for i, r in enumerate(A):
        for j, v in enumerate(r):
            if v == max(r) and v == min(A[k][j] for k in range(len(A))):
                out.append((i + 1, j + 1))
    return out


# ---------------------------------------------------------------- 10–12. 非零和
def pure_nash(A, B):
    """(9.66)(9.67)：A 的列最小、B 的行最小。"""
    out = []
    for i in range(len(A)):
        for j in range(len(A[0])):
            if A[i][j] == min(A[k][j] for k in range(len(A))) and B[i][j] == min(B[i]):
                out.append((i + 1, j + 1))
    return out


def admissible(vecs):
    return [v for v in vecs if not any(dominates(w, v) for w in vecs)]


def mixed_2x2(A, B):
    """2×2 内部混合均衡：P1 的 w 让 P2 无差别，P2 的 z 让 P1 无差别。"""
    # P1 对 z1 无差别：A[0][0]z + A[0][1](1-z) = A[1][0]z + A[1][1](1-z)
    da = (A[0][0] - A[0][1] - A[1][0] + A[1][1])
    db = (B[0][0] - B[1][0] - B[0][1] + B[1][1])
    if da == 0 or db == 0:
        return None
    z1 = F(A[1][1] - A[0][1], da)
    w1 = F(B[1][1] - B[1][0], db)
    if not (0 <= z1 <= 1 and 0 <= w1 <= 1):
        return None
    return w1, z1


def exp_cost(M, w, z):
    return sum(M[i][j] * w[i] * z[j] for i in range(len(w)) for j in range(len(z)))


def three_player_nash(L):
    """(9.79)：每个玩家单独改选都不能严格降低自己的代价。"""
    nes = []
    for a in itertools.product((1, 2), repeat=3):
        ok = True
        for i in range(3):
            b = list(a)
            b[i] = 3 - b[i]
            if L[tuple(b)][i] < L[a][i]:
                ok = False
        if ok:
            nes.append(a)
    return nes


# 补充：「多数派」三人博弈——全体一致时 P1 偏好 1、P2/P3 偏好 2；不一致时少数派代价 1、多数派 0
MAJ = {}
for _a in itertools.product((1, 2), repeat=3):
    if len(set(_a)) == 1:
        MAJ[_a] = (-2, -1, -1) if _a[0] == 1 else (-1, -2, -2)
    else:
        _maj = 1 if _a.count(1) >= 2 else 2
        MAJ[_a] = tuple(0 if x == _maj else 1 for x in _a)


# ---------------------------------------------------------------- 7. 参数估计
def posterior_mean_uniform(y_list, a, b, sigma, n=20000):
    """先验 U[a,b]、高斯噪声：数值积分求后验均值（= 平方损失下的最优 u）。"""
    num = den = 0.0
    for k in range(n):
        t = a + (b - a) * (k + 0.5) / n
        lik = math.exp(-sum((y - t) ** 2 for y in y_list) / (2 * sigma ** 2))
        num += t * lik
        den += lik
    return num / den


def posterior_mean_normal(y_list, mu0, s0, s):
    """先验 N(mu0, s0^2)，观测 N(θ, s^2)：共轭公式。"""
    k = len(y_list)
    prec = 1 / s0 ** 2 + k / s ** 2
    return (mu0 / s0 ** 2 + sum(y_list) / s ** 2) / prec


def main():
    print("1. 例 9.1：Pareto 最优")
    L91 = {1: (4, 0), 2: (3, 3), 3: (2, 2), 4: (5, 7), 5: (9, 0)}
    print("   Pareto 最优动作:", pareto_set(L91), " （原书：u = 1 和 u = 3）")
    print("   例 9.2：宾夕法尼亚收费公路，代价 = (穿越时间 ∝ 1/速度, 罚款)")
    tp = {s: (F(1, s), turnpike_fine(s)) for s in range(50, 101)}
    print("   Pareto 最优车速:", pareto_set(tp), " （原书：55, 65, 75, 85, 100）")
    ex1 = {u / 10: ((u / 10) ** 2, u / 10 - 1) for u in range(-100, 101)}
    ps = pareto_set(ex1)
    print(f"   习题 1（数值核对，不在页面公开）：U=[-10,10] 的网格上 Pareto 集 = [{min(ps)}, {max(ps)}]")

    print("\n2. 例 9.4、9.5：骰子")
    S = range(1, 7)
    print("   P(偶数) =", show(F(3, 6)), "  E[X] =", show(sum(F(s, 6) for s in S)),
          "  E[X | X>3] =", show(sum(F(s, 3) for s in (4, 5, 6))),
          "  两颗骰子之和的期望 =", show(sum(F(i + j, 36) for i in S for j in S)))
    PF = [F(1, 2), F(3, 10), F(1, 5)]
    PEF = [F(1, 10), F(1, 2), F(9, 10)]
    PE = sum(a * b for a, b in zip(PF, PEF))
    print("   马赛克图默认值：P(F)=", vec(PF), " P(E|F)=", vec(PEF))
    print("     (9.8) P(E) =", show(PE), f"= {float(PE):.2f}",
          "  (9.9) P(F_i|E) =", vec([a * b / PE for a, b in zip(PF, PEF)]),
          "≈", [round(float(a * b / PE), 3) for a, b in zip(PF, PEF)])

    print("\n3. 例 9.8–9.10")
    L98 = [[1, -1, 0], [-1, 2, -2], [2, -1, 1]]
    wc = [worst(r) for r in L98]
    idx, v = argmins(wc)
    print("   (9.14) 每行最大:", wc, "→ u* =", label(idx), "最坏代价", v)
    for P in ([F(1, 5), F(1, 5), F(3, 5)], [F(1, 10), F(4, 5), F(1, 10)], [F(1, 3)] * 3):
        ex = [expected(r, P) for r in L98]
        idx, v = argmins(ex)
        print(f"   (9.15) P = {vec(P)}: 期望代价 {vec(ex)} → u* = {label(idx)}（{show(v)}）")
    T = regret_matrix(L98)
    print("   (9.20) 遗憾矩阵 T:", T, " （原书例 9.10 一致）")
    wr = [max(r) for r in T]
    idx, v = argmins(wr)
    print("   (9.21) 每行最大遗憾:", wr, "→ u* =", label(idx), "最坏遗憾", v)
    U3 = [F(1, 3)] * 3
    er = [expected(r, U3) for r in T]
    idx, v = argmins(er)
    print("   (9.22) 均匀先验下的期望遗憾:", vec(er), "→ u* =", label(idx), "期望遗憾", show(v))
    print("   ⇒ 原书例 9.10 写「u* = u1，期望遗憾 1」：u1 的期望遗憾是 4/3，取到 1 的是 u2（笔误）")
    colmin = [min(c) for c in zip(*L98)]
    print("   补充：E[T(u,θ)] = E[L(u,θ)] − E[min_u' L(u',θ)]，后一项与 u 无关，常数 =",
          show(expected(colmin, U3)), "；所以期望遗憾与期望代价总选同一个动作")

    print("\n4. 互动图「与自然对弈」：各种准则（例 9.8 的矩阵、P = [1/5,1/5,3/5]）")
    P = [F(1, 5), F(1, 5), F(3, 5)]
    for name, f in [("最坏情况 max", worst), ("最好情况 min", min),
                    ("期望", lambda r: expected(r, P))]:
        vals = [f(r) for r in L98]
        idx, v = argmins(vals)
        print(f"   {name:<12}: {vec(vals)} → {label(idx)}")
    for a in (F(0), F(1, 4), F(1, 2), F(3, 4), F(1)):
        vals = [a * max(r) + (1 - a) * min(r) for r in L98]
        idx, v = argmins(vals)
        print(f"   乐观系数 (9.94) α = {show(a):>3}: {vec(vals)} → {label(idx)}")
    # 习题 2、8 只在这里核对，页面上只给提示
    ex2 = [[-1, 3, 2, -1], [-1, 0, 7, -1], [1, 5, 5, -2]]
    p2 = [F(1, 5), F(2, 5), F(1, 10), F(3, 10)]
    ex8 = [[2, -2, -2, 1], [-1, -2, -2, 6], [4, 0, -3, 4]]
    p8 = [F(1, 4), F(1, 2), F(1, 8), F(1, 8)]
    for name, M, p in [("习题 2", ex2, p2), ("习题 8", ex8, p8)]:
        a = argmins([max(r) for r in M])
        b = argmins([expected(r, p) for r in M])
        print(f"   {name}（不公开）：minimax → {label(a[0])} ({show(a[1])})；期望 → {label(b[0])} ({show(b[1])})")
    # 例 9.28 在第 15 项

    print("\n5. 补充例子「温度计」：θ ∈ {干燥, 潮湿, 结冰}，u ∈ {快速, 慢速, 绕行}，y ∈ {暖, 凉, 冷}")
    Lt = [[1, 2, 10], [3, 3, 4], [5, 5, 5]]
    prior = [F(1, 2), F(3, 10), F(1, 5)]
    Py = [[F(7, 10), F(3, 10), F(0)], [F(3, 10), F(1, 2), F(1, 5)], [F(0), F(1, 5), F(4, 5)]]  # 行 θ，列 y
    ys = ["暖", "凉", "冷"]
    us = ["快速", "慢速", "绕行"]
    a = argmins([worst(r) for r in Lt])
    b = argmins([expected(r, prior) for r in Lt])
    print(f"   无观测：最坏情况 → {us[a[0][0]]}（{a[1]}）；期望（先验 {vec(prior)}）→ {us[b[0][0]]}（{show(b[1])}）")
    for y in range(3):
        Th = [t for t in range(3) if Py[t][y] > 0]
        nd = argmins([max(Lt[u][t] for t in Th) for u in range(3)])
        joint = [Py[t][y] * prior[t] for t in range(3)]
        post = [j / sum(joint) for j in joint]
        risk = [expected(Lt[u], post) for u in range(3)]
        pr = argmins(risk)
        print(f"   y = {ys[y]}: Θ(y) = {[t + 1 for t in Th]} → π*(y) = {us[nd[0][0]]}（最坏 {nd[1]}）；"
              f"后验 {[round(float(q), 3) for q in post]}，条件贝叶斯风险 {[round(float(r), 3) for r in risk]} → {us[pr[0][0]]}")
    seq = [1, 1, 2]
    joint = [prior[t] * Py[t][seq[0]] * Py[t][seq[1]] * Py[t][seq[2]] for t in range(3)]
    post = [j / sum(joint) for j in joint]
    inter = [t + 1 for t in range(3) if all(Py[t][y] > 0 for y in seq)]
    print(f"   连续观测 凉, 凉, 冷：(9.30) 交集 Θ = {inter}；(9.31) 后验 {[round(float(q), 3) for q in post]}，"
          f"风险 {[round(float(expected(Lt[u], post)), 3) for u in range(3)]}")

    print("\n6. 例 9.11：图 9.1 的特征 (s, e, h)")
    feat = {"A": (0, 2, 1), "B": (1, 0, 2), "C": (1, 2, 0), "D": (1, 0, 1),
            "E": (0, 3, 0), "F": (0, 3, 0), "G": (1, 2, 0), "H": (0, 4, 0)}
    groups = {}
    for k, v in feat.items():
        groups.setdefault(v, []).append(k)
    for v, ks in groups.items():
        print(f"   y = {v}: Θ(y) = {ks}{'   ← 冲突' if len(ks) > 1 else ''}")
    print("   原书只提到 (0,3,0) 同时对应 E、F；按图 9.1，(1,2,0) 也同时对应 C、G")
    corners = {"A": 0, "B": 2, "C": 0, "D": 2, "E": 2, "F": 1, "G": 1, "H": 0}  # E=2, F=1 来自原书，其余为补充
    full = {k: feat[k] + (corners[k],) for k in feat}
    print("   加上角点数 c（E=2、F=1 来自原书；其余是我们按「直角拐角」数的补充值）后是否两两不同:",
          len(set(full.values())) == len(full))

    print("\n7. 参数估计")
    print(f"   例 9.12：先验 U[0,10]，σ = 2，y = 9.5 → u* ≈ {posterior_mean_uniform([9.5], 0, 10, 2):.3f}"
          "（截断使估计被拉回区间内；不截断时 u* = y）")
    print(f"   例 9.12：先验 U[0,10]，σ = 2，y = 5   → u* ≈ {posterior_mean_uniform([5], 0, 10, 2):.3f}")
    for k in (1, 10, 1000):
        print(f"   习题 16（不公开）：k = {k:>4}, y_i = 4 → u* = {posterior_mean_normal([4] * k, 0, 4, 9):.4f}")

    print("\n8. 零和博弈：安全策略、上 / 下值、鞍点")
    A942 = [[1, 3, 3, 2], [0, -1, 2, 1], [-2, 2, 0, 1]]
    rmax, cmin, uS, vS, up, lo = security(A942)
    print(f"   (9.43) 行最大 {rmax} → u* ∈ {[u + 1 for u in uS]}，上值 {up}")
    print(f"   (9.48) 列最小 {cmin} → v* ∈ {[v + 1 for v in vS]}，下值 {lo}")
    print(f"   u*=2, v*=4：L(2,4) = {A942[1][3]}；若 P2 预先知道 u=2，最好的列是 v = "
          f"{max(range(4), key=lambda j: A942[1][j]) + 1}，L = {max(A942[1])}；而 L(2,2) = {A942[1][1]}")
    print("   ⇒ 原书写「picked v = 2 to receive cost L(2,2) = 2」，应为 v = 3、L(2,3) = 2（笔误）")
    print("   鞍点 (9.42):", saddle_points(A942))
    A953 = [[3, 3, 5], [1, -1, 7], [0, -2, 4]]
    print("   例 9.14 (9.53) 鞍点:", saddle_points(A953), "值", A953[2][2])
    A954 = [[4, 3, 5, 1, 2], [-1, 0, -2, 0, -1], [-4, 1, 4, 3, 5], [-3, 0, -1, 0, -2], [3, 2, -7, 3, 8]]
    print("   例 9.15 (9.54) 鞍点:", saddle_points(A954), "（原书：(2,2)、(4,4)，以及 (2,4)、(4,2)）")

    print("\n9. 随机化鞍点（精确线性规划）")
    games = {
        "例 9.16 (9.63)": [[3, 0], [-1, 1]],
        "(9.42)": A942,
        "猜硬币 例 9.7": [[1, -1], [-1, 1]],
        "石头剪刀布": [[0, 1, -1], [-1, 0, 1], [1, -1, 0]],
        "(9.53) 有纯鞍点": A953,
    }
    for name, A in games.items():
        w, z, val = solve_zero_sum(A)
        print(f"   {name:<14}: w* = {vec(w)}, z* = {vec(z)}, 值 = {show(val)}")
        # 核对：w* 对每个纯 z 的代价 ≤ 值，z* 对每个纯 w 的代价 ≥ 值
        assert all(sum(w[i] * A[i][j] for i in range(len(A))) <= val for j in range(len(A[0])))
        assert all(sum(A[i][j] * z[j] for j in range(len(A[0]))) >= val for i in range(len(A)))
    w, z, val = solve_zero_sum([[0, -1], [-1, 2]])
    print(f"   习题 15（不公开）：w* = {vec(w)}, z* = {vec(z)}, 值 = {show(val)}")
    print("   例 9.16 图 9.4：上包络 max(4w1−1, 1−w1) 在 w1 = 2/5 取最小 3/5；下包络 min(3z1, 1−2z1) 在 z1 = 1/5 取最大 3/5")

    print("\n10. 非零和：纯 Nash 均衡")
    A968 = [[9, 4, 7], [6, -1, 5], [1, 4, 2]]
    B968 = [[2, 1, 6], [5, 0, 2], [2, 2, 5]]
    ne = pure_nash(A968, B968)
    print("   例 9.17:", ne, "代价", [(A968[i - 1][j - 1], B968[i - 1][j - 1]) for i, j in ne])
    AB, BB = [[-2, 0], [0, -1]], [[-1, 0], [0, -2]]
    ne = pure_nash(AB, BB)
    vv = [(AB[i - 1][j - 1], BB[i - 1][j - 1]) for i, j in ne]
    print("   例 9.18 两性之争:", ne, "代价", vv, "可容许:", admissible(vv))
    AP, BP = [[8, 0], [30, 2]], [[8, 30], [0, 2]]
    ne = pure_nash(AP, BP)
    print("   例 9.19 囚徒困境:", ne, "代价", [(AP[i - 1][j - 1], BP[i - 1][j - 1]) for i, j in ne])
    print("     P1 安全策略（行最大最小）:", argmins([max(r) for r in AP]),
          "  P2 安全策略（列最大最小）:", argmins([max(BP[i][j] for i in range(2)) for j in range(2)]))
    outs = [(AP[i][j], BP[i][j]) for i in range(2) for j in range(2)]
    print("     所有结局:", outs, " Pareto 最优结局:", admissible(outs), "（(8,8) 被 (2,2) 支配）")
    print("     两人都拒绝 (2,2) 时，P1 若改为合作（认罪）得 A(1,2) =", AP[0][1],
          "⇒ 「拒绝得 0」应为「合作得 0」（原书笔误）")
    print("   猜硬币（零和写成双矩阵）纯 Nash 均衡:", pure_nash([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]))

    print("\n11. 例 9.20：两性之争的混合 Nash 均衡")
    w1, z1 = mixed_2x2(AB, BB)
    w, z = [w1, 1 - w1], [z1, 1 - z1]
    print(f"   w* = {vec(w)}, z* = {vec(z)}；期望代价 L1 = {show(exp_cost(AB, w, z))}, L2 = {show(exp_cost(BB, w, z))}")
    print("   比两个纯均衡 (−2,−1)、(−1,−2) 对两人都差")
    # 核对 (9.75)(9.76) 的展开
    for (a, b) in [(F(0), F(0)), (F(1, 2), F(1, 3)), (F(1), F(1))]:
        ww, zz = [a, 1 - a], [b, 1 - b]
        L1, L2 = exp_cost(AB, ww, zz), exp_cost(BB, ww, zz)
        print(f"   w1={show(a)}, z1={show(b)}: wAz = {show(L1)}，原书末行 −3w1z1+w1+z1 = {show(-3 * a * b + a + b)}；"
              f"wBz = {show(L2)}，原书末行 −3w1z1+2w1+2z1 = {show(-3 * a * b + 2 * a + 2 * b)}")
    print("   ⇒ 末行分别差常数 −1、−2（原书漏写；不影响 (9.77)(9.78) 的导数）")

    print("\n12. 例 9.21：三人博弈")
    L3 = {(1, 1, 1): (1, 1, -2), (1, 1, 2): (-4, 3, 1), (1, 2, 1): (2, -4, 2), (1, 2, 2): (-5, -5, 10),
          (2, 1, 1): (3, -2, -1), (2, 1, 2): (-6, -6, 12), (2, 2, 1): (2, 2, -4), (2, 2, 2): (-2, 3, -1)}
    nes = three_player_nash(L3)
    print("   纯 Nash 均衡:", nes, "代价", [L3[a] for a in nes], " 可容许:", admissible([L3[a] for a in nes]))
    for a in [(2, 1, 1)]:
        for i in range(3):
            b = list(a)
            b[i] = 3 - b[i]
            print(f"   {a} 处 P{i + 1} 单独改选 → 代价 {L3[a][i]} 变为 {L3[tuple(b)][i]}")
    print("   ⇒ 原书说 (2,−4,2) 与 (3,−2,−1) 两个均衡；按 (9.79) 只有前者，(2,1,1) 处 P1 改选 1 可从 3 降到 1")
    print("   （穷举发现：把代价当收益最大化、并交换 P2/P3 的下标，恰好得到原书的两个均衡——推测是计算时的混淆）")
    nes2 = three_player_nash(MAJ)
    print("   补充「多数派」三人博弈:", nes2, "代价", [MAJ[a] for a in nes2], "可容许:", admissible([MAJ[a] for a in nes2]))

    print("\n13. 效用与彩票")
    lot = {"1: 稳拿 1000": [(1, 1000)], "2: 硬币 2000/0": [(F(1, 2), 2000), (F(1, 2), 0)],
           "3: 2/3 得 3000, 1/3 付 3000": [(F(2, 3), 3000), (F(1, 3), -3000)]}
    W0 = 5000
    for k, v in lot.items():
        ev = sum(p * x for p, x in v)
        eu = sum(float(p) * math.log(W0 + x) for p, x in v)
        ce = math.exp(eu) - W0
        print(f"   例 9.22 选择 {k:<26}: 期望 {show(ev)}；ln 效用、初始财富 {W0} 的确定性等价 ≈ {ce:.1f}")
    print("   例 9.23 第 4 项：稳拿 10000 vs 一半概率得 25000：期望", 10000, "vs", 12500)
    pr = sum(math.comb(100, k) for k in range(41, 101)) / 2 ** 100
    print(f"   例 9.23 第 5 项：100 次 × (稳拿 100 | 一半概率得 250)：期望总额 10000 vs 12500；"
          f"赌 100 次总额超过 10000（需至少 41 次正面）的概率 = {pr:.4f}")
    print("   补充：圣彼得堡悖论（第一次正面出现在第 k 次，奖金 2^k）")
    print("     期望奖金：前 n 项部分和 = n →∞；ln 效用（初始财富 0）期望 = Σ k ln2 / 2^k = 2 ln 2 → 确定性等价 =",
          f"{math.exp(sum(k * math.log(2) / 2 ** k for k in range(1, 200))):.4f}")
    for w0 in (0, 10, 100, 1000, 10 ** 6):
        if w0 == 0:
            continue
        eu = sum(math.log(w0 + 2 ** k) / 2 ** k for k in range(1, 200))
        print(f"     初始财富 {w0:>7}：门票的确定性等价 ≈ {math.exp(eu) - w0:.2f}")
    print("     截断：庄家最多付 2^20（约百万）时，期望 =", sum(F(2 ** min(k, 20), 2 ** k) for k in range(1, 400)).__round__(4))

    print("\n14. 无信息先验")
    H = lambda P: -sum(p * math.log2(p) for p in P if p > 0)
    print(f"   例 9.26：Θ = {{p, c}} 熵 {H([.5, .5]):.3f} bit，P(降水) = 1/2；"
          f"Θ = {{r, s, c}} 熵 {H([1 / 3] * 3):.3f} bit，P(降水) = 2/3")
    rng = random.Random(9)
    N = 200000

    def sphere():
        while True:
            v = [rng.gauss(0, 1) for _ in range(3)]
            n = math.sqrt(sum(x * x for x in v))
            if n > 0:
                v = [x / n for x in v]
                return v if v[0] >= 0 else [-x for x in v]

    def cube():
        face = rng.randrange(6)
        ax, sgn = face // 2, (1 if face % 2 else -1)
        v = [rng.uniform(-1, 1) for _ in range(3)]
        v[ax] = sgn
        return v if v[0] >= 0 else [-x for x in v]

    for name, gen in [("上半球面", sphere), ("上半立方体表面", cube)]:
        near, diag = 0, 0
        for _ in range(N):
            t = gen()
            d = abs(t[2]) / math.hypot(t[0], t[1])
            phi = math.degrees(math.atan2(t[1], t[0]))  # 法向角 ∈ [-90, 90]
            near += d < 1
            diag += 30 <= abs(phi) <= 60
        print(f"   例 9.27 {name}：直线到原点距离 < 1 的比例 ≈ {near / N:.3f}；法向角在 ±[30°,60°] 的比例 ≈ {diag / N:.3f}")
    print(f"     （球面理论值：θ3 在 [-1,1] 上均匀，距离 < 1 ⇔ |θ3| < 1/√2，比例 = {1 / math.sqrt(2):.4f}；法向角均匀，比例 = 1/3）")

    print("\n15. 例 9.28：支票 1000 vs 现金 1（收益，不是代价）")
    print("   现金收益 1；支票期望收益 1000(1 − p)，p = 跳票概率；两者相等于 p =", show(1 - F(1, 1000)),
          "⇒ 只要先验认为跳票概率 > 0.999，期望分析也会选现金；原书举的 0.999999 足够")

    print("\n16. 补充：重复囚徒困境（原书 (9.70) 的代价，200 轮，循环赛不含自我对局）")
    A70 = {(1, 1): (8, 8), (1, 2): (0, 30), (2, 1): (30, 0), (2, 2): (2, 2)}  # 1 = 与当局合作（认罪），2 = 拒绝

    def strat(name):
        def f(mine, theirs):
            if name == "总是认罪":
                return 1
            if name == "总是拒绝":
                return 2
            if name == "以牙还牙":
                return theirs[-1] if theirs else 2
            if name == "冷酷":
                return 1 if 1 in theirs else 2
        return f
    names = ["总是认罪", "总是拒绝", "以牙还牙", "冷酷"]
    tot = {n: 0 for n in names}
    for a, b in itertools.combinations(names, 2):
        ha, hb = [], []
        fa, fb = strat(a), strat(b)
        sa = sb = 0
        for _ in range(200):
            x, y = fa(ha, hb), fb(hb, ha)
            ca, cb = A70[(x, y)]
            sa += ca
            sb += cb
            ha.append(x)
            hb.append(y)
        tot[a] += sa
        tot[b] += sb
        print(f"   {a} vs {b}: {sa} 年 / {sb} 年")
    print("   总刑期（越少越好）:", tot)

    print("\n17. 补充：猜硬币（例 9.7），P1 代价：同面 +1，异面 −1")
    for p in (F(1), F(3, 4), F(1, 2)):
        # 对手知道 p，选择让 P1 代价最大的面
        cost_H = p * 1 + (1 - p) * (-1)   # P2 出正面
        cost_T = p * (-1) + (1 - p) * 1   # P2 出反面
        print(f"   P(正面) = {show(p)}：对手出正面 → {show(cost_H)}，出反面 → {show(cost_T)}；最坏期望代价 {show(max(cost_H, cost_T))}")


if __name__ == "__main__":
    main()
