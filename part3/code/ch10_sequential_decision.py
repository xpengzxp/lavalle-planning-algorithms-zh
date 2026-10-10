"""第 10 章参考实现：核对教程页面里出现的数值。

只用 Python 标准库。运行：

    python3 part3/code/ch10_sequential_decision.py

会依次打印：
  1. 例 10.3：非确定前向投影 X_{k+1} = {k, ..., 3k}
  2. 例 10.4：概率前向投影 (10.18)(10.19)，并用转移矩阵 (10.17) 再算一遍
  3. 例 10.5：弱 / 强反向投影 WB、SB（含不允许 u_T 的情形）
  4. 例 10.2：15×15 网格（图 10.1）上的值迭代——无自然 / 非确定 / 概率，两种自然模型
  5. 非确定 Dijkstra（图 10.8）与最坏情况值迭代给出相同的 G*（侧滑模型）
  6. 例 10.6（图 10.3）：G_pi(x_I) = 7；值迭代的渐近收敛速度
  7. 例 10.7（图 10.5）：策略迭代的每一步（精确分数）；值迭代对照；Q* 值
  8. 10.3 节：几何级数 (10.66)；「机器保养」MDP（补充例子）的折扣值迭代、策略随 alpha 的变化、平均代价
  9. 10.4.2 节：在例 10.7 的计划 pi = (2, 2) 上做蒙特卡罗、TD(lambda)、TD(0)、常数 rho 的评估
 10. 10.4.3 节：例 10.7 上的 Q-learning (10.101)
 11. 10.5.1 节：图 10.13 的博弈树——上值 / 下值、阶段式矩阵博弈、开环 4×4 矩阵 (10.106) 的随机化值、alpha-beta 剪枝
 12. 习题 18（图 10.23）：阶段式模型下的随机化值
 13. 图 10.19：期望矩阵 A = A1/3 + 2 A2/3（式 10.119 的核对）
 14. 环上的追逐博弈（补充例子）：(10.110)(10.111)(10.115) 的上值 / 下值 / 随机化值
"""
import itertools
import math
import random
from fractions import Fraction as F

INF = math.inf


def show(title):
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


# ====================================================================== 1–3 数轴
def num_line_fp(x1, u, Theta, k):
    """式 (10.12)：重复施加同一个动作 u 的非确定前向投影。"""
    S = {x1}
    for _ in range(k):
        S = {x + u + th for x in S for th in Theta}
    return S


def num_line_prob_fp(x1, u, Theta, k):
    """式 (10.13)：概率前向投影（自然均匀分布）。"""
    P = {x1: F(1)}
    p = F(1, len(Theta))
    for _ in range(k):
        Q = {}
        for x, px in P.items():
            for th in Theta:
                Q[x + u + th] = Q.get(x + u + th, F(0)) + px * p
        P = Q
    return dict(sorted(P.items()))


def item1():
    show("1. 例 10.3：U={-2,2,uT}, Theta={-1,0,1}, x1=0, 每步 u=2")
    for k in range(1, 6):
        S = num_line_fp(0, 2, [-1, 0, 1], k)
        print(f"  X_{k + 1} = {sorted(S)}   (= {{{k},...,{3 * k}}}: {S == set(range(k, 3 * k + 1))})")


def item2():
    show("2. 例 10.4：自然均匀 1/3，x1=0，每步 u=2")
    for k in (1, 2, 3):
        P = num_line_prob_fp(0, 2, [-1, 0, 1], k)
        print(f"  {k} 步：" + "  ".join(f"P({x})={p}" for x, p in P.items()))
    # 用 (10.15)–(10.17) 的转移矩阵再算一遍（状态截断到 [-2, 10]）
    states = list(range(-2, 11))
    idx = {x: i for i, x in enumerate(states)}
    n = len(states)
    M = [[F(0)] * n for _ in range(n)]
    for j, x in enumerate(states):         # 第 j 列 = 从 x 出发的分布
        for th in (-1, 0, 1):
            y = x + 2 + th
            if y in idx:
                M[idx[y]][j] += F(1, 3)
    v = [F(0)] * n
    v[idx[0]] = F(1)
    for _ in range(2):
        v = [sum(M[i][j] * v[j] for j in range(n)) for i in range(n)]
    print("  矩阵形式 M_u M_u v：" + "  ".join(f"P({states[i]})={v[i]}" for i in range(n) if v[i]))


def item3():
    show("3. 例 10.5：反向投影（U={-2,2,uT}, Theta={-1,0,1}）")
    Theta = (-1, 0, 1)
    rng = range(-20, 21)

    def WB(S, u):
        return {x for x in rng if any(x + u + th in S for th in Theta)}

    def SB(S, u):
        return {x for x in rng if all(x + u + th in S for th in Theta)}

    XG = {-1, 0, 1}
    print("  WB(0,2)  =", sorted(WB({0}, 2)))
    print("  SB(0,2)  =", sorted(SB({0}, 2)))
    print("  WB(XG,2) =", sorted(WB(XG, 2)))
    print("  SB(XG,2) =", sorted(SB(XG, 2)), "  而 ∪_x SB(x,2) =", sorted(set().union(*(SB({x}, 2) for x in XG))))
    wbx = WB(XG, 2) | WB(XG, -2) | XG     # u_T：状态不动
    sbx = SB(XG, 2) | SB(XG, -2) | XG
    print("  WB(XG)   =", sorted(wbx))
    print("  SB(XG)   =", sorted(sbx))
    print("  不允许 uT 时 SB(XG) =", sorted(SB(XG, 2) | SB(XG, -2)))


# ====================================================================== 4–5 网格
DIRS = [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)]   # 0 不动, 1 右, 2 上, 3 左, 4 下（例 10.2）
RIGHT_OF = {1: 4, 2: 1, 3: 2, 4: 3}                  # 运动方向的右侧：右→下，上→右，左→上，下→左


def make_grid():
    X = {(i, j) for i in range(1, 16) for j in range(1, 16)
         if not (6 <= i <= 10 and 6 <= j <= 10)}
    XG = {(i, j) for i in range(11, 16) for j in range(11, 16)}
    return X, XG, (1, 1)


def nature_set(X, x, u, model):
    """Theta(x,u)。model: 'none' 无自然；'all' 例 10.2（施加 u 之后所有可用的动作）；
    'drift' 右偏漂移（补充）：可能被推向运动方向的右侧一格；'slip' 两侧滑（补充）：可能被推向左侧或右侧一格。
    u = 0（不动）时，后两种模型里自然也不动。"""
    y = (x[0] + DIRS[u][0], x[1] + DIRS[u][1])
    if model == "none":
        cand = [0]
    elif model == "all":
        cand = [0, 1, 2, 3, 4]
    elif model == "drift":
        cand = [0] + ([RIGHT_OF[u]] if u in RIGHT_OF else [])
    else:
        cand = [0] + ([2, 4] if u in (1, 3) else [1, 3] if u in (2, 4) else [])
    return [(th, (y[0] + DIRS[th][0], y[1] + DIRS[th][1])) for th in cand
            if (y[0] + DIRS[th][0], y[1] + DIRS[th][1]) in X]


def actions(X, x):
    return [u for u in range(5) if (x[0] + DIRS[u][0], x[1] + DIRS[u][1]) in X]


def grid_vi(model, kind, tol=1e-10, max_it=100000):
    """kind: 'nondet' 用 (10.39)，非目标初值 ∞；'prob' 用 (10.46)，非目标初值 0（见页面上的说明）。"""
    X, XG, xI = make_grid()
    G = {x: (0.0 if x in XG else (INF if kind == "nondet" else 0.0)) for x in X}
    hist = []
    for it in range(1, max_it + 1):
        H = {}
        for x in X:
            if x in XG:
                H[x] = 0.0
                continue
            best = INF
            for u in actions(X, x):
                outs = nature_set(X, x, u, model)
                if kind == "nondet":
                    val = 1 + max(G[y] for _, y in outs)
                else:
                    val = 1 + sum(G[y] for _, y in outs) / len(outs)
                best = min(best, val)
            H[x] = best
        ch = max((abs(H[x] - G[x]) if H[x] < INF and G[x] < INF else (0 if H[x] == G[x] else INF)) for x in X)
        G = H
        hist.append(ch)
        if ch <= tol:
            return G, it, hist
    return G, max_it, hist


def nondet_dijkstra(model):
    """图 10.8：非确定 Dijkstra（反向），返回 G* 与状态进入 S 的顺序。"""
    X, XG, _ = make_grid()
    S = set()
    G = {x: (0.0 if x in XG else INF) for x in X}
    A = set(XG)
    order = []
    while A:
        xs = min(A, key=lambda x: (G[x], x))
        A.remove(xs)
        S.add(xs)
        order.append(xs)
        # Front(xs, S)：存在 u 使一步前向投影含 xs 且 ⊆ S
        for x in X - S:
            best = None
            for u in actions(X, x):
                Y = [y for _, y in nature_set(X, x, u, model)]
                if xs in Y and all(y in S for y in Y):
                    val = 1 + max(G[y] for y in Y)
                    best = val if best is None else min(best, val)
            if best is not None:
                if best < G[x]:
                    G[x] = best
                A.add(x)
    return G, order


def item4():
    show("4. 例 10.2（图 10.1）：15×15 网格，x_I=(1,1)，X_G 是右上角 5×5")
    X, XG, xI = make_grid()
    print(f"  |X| = {len(X)}, |X_G| = {len(XG)}")
    print("  (2,2) 处 u=3（左）时 Theta =", [th for th, _ in nature_set(X, (2, 2), 3, 'all')], "（书中：{0,1,2,4}）")
    for model, name in (("none", "无自然"), ("all", "例 10.2 的自然"), ("drift", "右偏漂移（补充）"), ("slip", "两侧滑（补充）")):
        for kind in ("nondet", "prob"):
            if model == "none" and kind == "prob":
                continue
            G, it, hist = grid_vi(model, kind, tol=1e-9)
            v = G[xI]
            finite = sum(1 for x in X if G[x] < INF)
            extra = ""
            if kind == "prob":
                k6 = next(i + 1 for i, c in enumerate(hist) if c < 1e-6)
                extra = f"，最大变化 < 1e-6 需要 {k6} 次"
            print(f"  {name:10s} {('最坏情况' if kind == 'nondet' else '期望'):4s}: G*(x_I) = {v:.4f}，"
                  f"有限值状态 {finite}/{len(X)}，迭代 {it} 次{extra}")


def item5():
    show("5. 非确定 Dijkstra（图 10.8）vs 最坏情况值迭代")
    X, XG, xI = make_grid()
    for model, name in (("drift", "右偏漂移"), ("slip", "两侧滑")):
        G1, order = nondet_dijkstra(model)
        G2, _, _ = grid_vi(model, "nondet")
        same = all((G1[x] == G2[x]) for x in X)
        mono = all(G1[order[i]] <= G1[order[i + 1]] for i in range(len(order) - 1))
        print(f"  {name}：两者处处相等 {same}；G*(x_I) = {G1[xI]}；进入 S 的状态 {len(order)}/{len(X)}；"
              f"按进入顺序 G* 单调不减 {mono}")
    G, _, _ = grid_vi("drift", "nondet")
    print("  右偏漂移的最坏情况 G*（上方为 j = 15，## 为障碍）：")
    for j in range(15, 0, -1):
        print("   " + " ".join("##" if (6 <= i <= 10 and 6 <= j <= 10) else f"{G[(i, j)]:2.0f}" for i in range(1, 16)))


# ====================================================================== 6 图 10.3
def item6():
    show("6. 例 10.6（图 10.3）：环上的渐近收敛")
    # 状态：I -> A -> B，B 以 1/2 到 G、1/2 到 C，C -> D -> A；每步代价 1
    succ = {"I": [("A", F(1))], "A": [("B", F(1))], "B": [("G", F(1, 2)), ("C", F(1, 2))],
            "C": [("D", F(1))], "D": [("A", F(1))]}
    # 精确解：G(A)=1+G(B), G(B)=1+G(C)/2, G(C)=1+G(D), G(D)=1+G(A)  => G(A)=6
    GA = F(6)
    GB = GA - 1
    assert GB == 1 + (1 + (1 + GA)) / 2
    print(f"  精确解 G_pi(x_I) = {1 + GA}（式 10.47：3 + 4·Σ 1/2^i = 7）")
    s = sum(F(1, 2 ** i) for i in range(1, 60))
    print(f"  级数部分和（60 项）= {float(3 + 4 * s):.12f}")
    for p in (F(1, 2),):
        G = {k: 0.0 for k in list(succ) + ["G"]}
        rows = []
        for it in range(1, 201):
            H = {"G": 0.0}
            for x, outs in succ.items():
                H[x] = 1 + sum(float(q) * G[y] for y, q in outs)
            ch = max(abs(H[x] - G[x]) for x in H)
            G = H
            rows.append((it, G["I"], ch))
        for it, gi, ch in rows:
            if it in (4, 8, 12, 16, 20, 40, 60, 80, 100, 120):
                print(f"  初值全 0，第 {it:3d} 次迭代：G(x_I) = {gi:.10f}，本次最大变化 = {ch:.3e}")
        first = next(it for it, _, ch in rows if ch < 1e-9)
        print(f"  最大变化首次 < 1e-9 的迭代：第 {first} 次")
    print("  初值取 ∞（l_F = ∞）时：B 的每个动作都有概率 1/2 落到 C，C→D→A→B 都是 ∞，所以永远是 ∞。")


# ====================================================================== 7 例 10.7
EX107 = {  # P(x' | x, u)，u ∈ {1, 2}；c 是目标，总是施加 u_T
    ("a", 1): {"a": F(1, 3), "b": F(1, 3), "c": F(1, 3)},
    ("b", 1): {"a": F(1, 3), "b": F(1, 3), "c": F(1, 3)},
    ("a", 2): {"b": F(1, 2), "c": F(1, 2)},
    ("b", 2): {"a": F(1, 4), "c": F(3, 4)},
}


def eval_plan_107(pi):
    """解 (10.53) 的 2×2 线性方程组（G(c) = 0）。"""
    # G(a) = 1 + P(a|a)G(a) + P(b|a)G(b);  G(b) = 1 + P(a|b)G(a) + P(b|b)G(b)
    Pa, Pb = EX107[("a", pi["a"])], EX107[("b", pi["b"])]
    a11, a12 = 1 - Pa.get("a", 0), -Pa.get("b", 0)
    a21, a22 = -Pb.get("a", 0), 1 - Pb.get("b", 0)
    det = a11 * a22 - a12 * a21
    Ga = (1 * a22 - a12 * 1) / det
    Gb = (a11 * 1 - 1 * a21) / det
    return {"a": Ga, "b": Gb, "c": F(0)}


def q_107(G, x, u):
    return 1 + sum(p * G[y] for y, p in EX107[(x, u)].items())


def item7():
    show("7. 例 10.7（图 10.5）：策略迭代（图 10.4）")
    pi = {"a": 1, "b": 1}
    for rnd in range(1, 5):
        G = eval_plan_107(pi)
        print(f"  第 {rnd} 轮：pi = (a:{pi['a']}, b:{pi['b']})，G_pi = (a:{G['a']}, b:{G['b']})")
        new = {}
        for x in ("a", "b"):
            qs = {u: q_107(G, x, u) for u in (1, 2)}
            print(f"     状态 {x}：u=1 → {qs[1]}，u=2 → {qs[2]}")
            new[x] = min(qs, key=lambda u: (qs[u], u != pi[x]))
        better = any(q_107(G, x, new[x]) < G[x] for x in ("a", "b"))
        if not better:
            print("     不能再改进 ⇒ pi* = pi")
            break
        pi = new
    Gs = eval_plan_107(pi)
    print("  Q*：" + "，".join(f"Q*({x},{u}) = {q_107(Gs, x, u)} ≈ {float(q_107(Gs, x, u)):.4f}"
                             for x in ("a", "b") for u in (1, 2)))
    # 值迭代对照：初值 0
    G = {"a": 0.0, "b": 0.0, "c": 0.0}
    for it in range(1, 200):
        H = {"c": 0.0}
        for x in ("a", "b"):
            H[x] = min(1 + sum(float(p) * G[y] for y, p in EX107[(x, u)].items()) for u in (1, 2))
        ch = max(abs(H[x] - G[x]) for x in H)
        G = H
        if it in (1, 2, 3, 5, 10):
            print(f"  值迭代第 {it:2d} 次：G = (a:{G['a']:.6f}, b:{G['b']:.6f})")
        if ch < 1e-9:
            print(f"  值迭代：第 {it} 次最大变化 < 1e-9，G = (a:{G['a']:.9f}, b:{G['b']:.9f})，12/7 = {12 / 7:.9f}，10/7 = {10 / 7:.9f}")
            break


# ====================================================================== 8 无限时域
MACHINE = {  # 补充例子：0 = 新，1 = 磨损，2 = 坏；动作 run（运行）/ maint（保养）/ repair（修理）
    0: {"run": (0, {0: 0.7, 1: 0.3}), "maint": (2, {0: 1.0})},
    1: {"run": (1, {1: 0.6, 2: 0.4}), "maint": (3, {0: 1.0})},
    2: {"repair": (10, {0: 1.0})},
}


def machine_vi(alpha, tol=1e-12):
    J = {x: 0.0 for x in MACHINE}
    for it in range(1, 100000):
        H = {}
        for x, acts in MACHINE.items():
            H[x] = min(c + alpha * sum(p * J[y] for y, p in nxt.items()) for c, nxt in acts.values())
        ch = max(abs(H[x] - J[x]) for x in J)
        J = H
        if ch < tol:
            break
    pi = {x: min(acts, key=lambda a: acts[a][0] + alpha * sum(p * J[y] for y, p in acts[a][1].items()))
          for x, acts in MACHINE.items()}
    return J, pi, it


def item8():
    show("8. 10.3 节：折扣代价与平均代价")
    for a in (F(1, 2), F(9, 10)):
        print(f"  (10.66) alpha = {a}：1/(1-alpha) = {1 / (1 - a)}，前 30 项和 = {float(sum(a ** k for k in range(30))):.6f}")
    print("  「机器保养」MDP（补充例子）：")
    prev = None
    for a in [i / 100 for i in range(1, 100)]:
        J, pi, it = machine_vi(a, tol=1e-10)
        key = tuple(sorted(pi.items()))
        if key != prev:
            print(f"    alpha = {a:.2f} 起：plan = {pi}，J* = " + ", ".join(f"{J[x]:.4f}" for x in sorted(J)))
            prev = key
    # 找切换点（二分）
    lo, hi = 0.01, 0.99
    for _ in range(60):
        mid = (lo + hi) / 2
        _, pi, _ = machine_vi(mid, tol=1e-13)
        if pi[1] == "maint":
            hi = mid
        else:
            lo = mid
    print(f"    状态「磨损」的最优动作在 alpha ≈ {hi:.4f} 处由 run 变为 maint")
    for a in (0.5, 0.9, 0.99):
        J, pi, it = machine_vi(a, tol=1e-6)
        print(f"    alpha = {a}：最大变化 < 1e-6 需要 {it} 次迭代；J* = " + ", ".join(f"{J[x]:.3f}" for x in sorted(J)) + f"；plan = {pi}")
    # 平均代价：不除以 K 的值迭代 (10.79) + 停止准则 (10.80) + 相对值迭代
    G = {x: 0.0 for x in MACHINE}
    hist = []
    for N in range(1, 401):
        H = {x: min(c + sum(p * G[y] for y, p in nxt.items()) for c, nxt in acts.values()) for x, acts in MACHINE.items()}
        hist.append(H)
        G = H
    for N in (10, 50, 100, 400):
        print(f"    平均代价：N = {N:3d} 次后 G_N/N = " + ", ".join(f"{hist[N - 1][x] / N:.4f}" for x in sorted(G)))
    for N in range(2, 401):
        crit = max(abs(hist[N - 1][x] / N - hist[N - 2][x] / (N - 1)) for x in G)
        if crit < 1e-3:
            print(f"    准则 (10.80)：ε = 1e-3 时在 N = {N} 满足")
            break
    h = {x: 0.0 for x in MACHINE}
    for it in range(400):
        T = {x: min(c + sum(p * h[y] for y, p in nxt.items()) for c, nxt in acts.values()) for x, acts in MACHINE.items()}
        g = T[0]
        h = {x: T[x] - g for x in T}
    print(f"    相对值迭代（s = 新）：平均代价 g = {g:.6f}（精确值 9/13 = {9 / 13:.6f}），h = " + ", ".join(f"{h[x]:.4f}" for x in sorted(h)))
    stat = {"run/run": 75 / 41, "run/maint": 9 / 13, "maint/*": 2.0}
    print("    各平稳计划的平均代价（马尔可夫链平稳分布手算）：", {k: round(v, 4) for k, v in stat.items()})


# ====================================================================== 9–10 强化学习
def sim_107(rng, x, u):
    r, acc = rng.random(), 0.0
    for y, p in EX107[(x, u)].items():
        acc += float(p)
        if r < acc:
            return y
    return y


def item9():
    show("9. 10.4.2 节：用模拟评估例 10.7 的计划 pi = (a:2, b:2)，真值 G_pi = (12/7, 10/7) ≈ (1.7143, 1.4286)")
    pi = {"a": 2, "b": 2}

    def run(method, trials, seed, lam=1.0, rho=0.1):
        rng = random.Random(seed)
        G = {"a": 0.0, "b": 0.0, "c": 0.0}
        v = {"a": 0, "b": 0}
        out = {}
        for t in range(1, trials + 1):
            x = "a" if t % 2 else "b"
            traj = []
            while x != "c":
                v[x] += 1
                y = sim_107(rng, x, pi[x])
                traj.append(x)
                if method == "td":        # (10.93)
                    d = 1 + G[y] - G[x]
                    k = len(traj) - 1
                    for j, xj in enumerate(traj):
                        G[xj] += lam ** (k - j) * d / v[xj]
                elif method == "rho":     # (10.96)
                    G[x] = (1 - rho) * G[x] + rho * (1 + G[y])
                x = y
            if method == "mc":            # (10.85)(10.86)：每个访问到的状态都更新
                K = len(traj)
                cnt = {}
                for j, xj in enumerate(traj):
                    cnt[xj] = cnt.get(xj, 0) + 1
                for j, xj in enumerate(traj):
                    c = K - j             # 从 x_j 起累计的代价（每步 1）
                    G[xj] += (c - G[xj]) / (v[xj] - cnt[xj] + 1)
                    cnt[xj] -= 1
            if t in (10, 100, 1000, 10000):
                out[t] = (G["a"], G["b"])
        return out

    for name, kw in (("蒙特卡罗 (10.85)", dict(method="mc")), ("TD(1) (10.91)", dict(method="td", lam=1.0)),
                     ("TD(0) (10.94)", dict(method="td", lam=0.0)), ("TD(0.5)", dict(method="td", lam=0.5)),
                     ("常数 rho=0.1 (10.96)", dict(method="rho", rho=0.1)), ("常数 rho=0.01", dict(method="rho", rho=0.01))):
        errs = []
        for seed in range(20):
            o = run(trials=10000, seed=seed, **kw)
            errs.append({t: max(abs(o[t][0] - 12 / 7), abs(o[t][1] - 10 / 7)) for t in o})
        line = "  ".join(f"{t}次:{sum(e[t] for e in errs) / len(errs):.4f}" for t in (10, 100, 1000, 10000))
        print(f"  {name:22s} 20 个种子的平均最大误差  {line}")


def item10():
    show("10. 10.4.3 节：例 10.7 上的 Q-learning (10.101)，epsilon-贪心探索")
    Qs = {("a", 1): 43 / 21, ("a", 2): 12 / 7, ("b", 1): 43 / 21, ("b", 2): 10 / 7}
    for rho_mode in ("1/n", "0.1"):
        errs = []
        for seed in range(20):
            rng = random.Random(seed)
            Q = {k: 0.0 for k in Qs}
            n = {k: 0 for k in Qs}
            for ep in range(1, 5001):
                x = rng.choice("ab")
                while x != "c":
                    if rng.random() < 0.2:
                        u = rng.choice((1, 2))
                    else:
                        u = min((1, 2), key=lambda a: (Q[(x, a)], a))
                    y = sim_107(rng, x, u)
                    n[(x, u)] += 1
                    rho = 1 / n[(x, u)] if rho_mode == "1/n" else 0.1
                    target = 1 + (0.0 if y == "c" else min(Q[(y, 1)], Q[(y, 2)]))
                    Q[(x, u)] = (1 - rho) * Q[(x, u)] + rho * target
                    x = y
            errs.append(max(abs(Q[k] - Qs[k]) for k in Qs))
            if seed == 0:
                print(f"  rho = {rho_mode}，种子 0，5000 回合后：" + "，".join(f"Q({x},{u})={Q[(x, u)]:.4f}" for (x, u) in Qs)
                      + f"；贪心计划 a:{min((1, 2), key=lambda a: Q[('a', a)])} b:{min((1, 2), key=lambda a: Q[('b', a)])}")
        print(f"  rho = {rho_mode}：20 个种子的平均最大误差 {sum(errs) / len(errs):.4f}")


# ====================================================================== 11–14 博弈
def simplex_max(Mt, b, c):
    """max c·y s.t. Mt y ≤ b, y ≥ 0（b ≥ 0），Bland 规则，精确分数。返回 (y, 对偶变量, 最优值)。"""
    m, n = len(Mt), len(c)
    T = [list(Mt[i]) + [F(int(i == j)) for j in range(m)] + [b[i]] for i in range(m)]
    obj = [-ci for ci in c] + [F(0)] * m + [F(0)]
    basis = [n + i for i in range(m)]
    while True:
        enter = next((j for j in range(n + m) if obj[j] < 0), None)
        if enter is None:
            break
        best, leave = None, None
        for i in range(m):
            if T[i][enter] > 0:
                r = T[i][-1] / T[i][enter]
                if best is None or r < best or (r == best and basis[i] < basis[leave]):
                    best, leave = r, i
        piv = T[leave][enter]
        T[leave] = [v / piv for v in T[leave]]
        for i in range(m):
            if i != leave and T[i][enter] != 0:
                f = T[i][enter]
                T[i] = [a - f * bb for a, bb in zip(T[i], T[leave])]
        f = obj[enter]
        obj = [a - f * bb for a, bb in zip(obj, T[leave])]
        basis[leave] = enter
    y = [F(0)] * n
    for i, bi in enumerate(basis):
        if bi < n:
            y[bi] = T[i][-1]
    dual = obj[n:n + m]
    return y, dual, obj[-1]


def matrix_game(A):
    """零和矩阵博弈：P1 选行、最小化；P2 选列、最大化。返回 (随机化值, w, z)。"""
    A = [[F(a) for a in row] for row in A]
    m, n = len(A), len(A[0])
    shift = 1 - min(min(r) for r in A)
    B = [[a + shift for a in row] for row in A]
    Mt = [[B[i][j] for i in range(m)] for j in range(n)]       # 约束：Σ_i B_ij y_i ≤ 1
    y, dual, val = simplex_max(Mt, [F(1)] * n, [F(1)] * m)
    v = 1 / val
    w = [yi * v for yi in y]
    z = [d * v for d in dual]
    return v - shift, w, z


def det_values(A):
    upper = min(max(row) for row in A)
    lower = max(min(A[i][j] for i in range(len(A))) for j in range(len(A[0])))
    return upper, lower


def tree_values(leaves):
    """二人二阶段博弈树（叶子顺序 u1 v1 u2 v2，L=0,R=1）。"""
    C = lambda u1, v1, u2, v2: leaves[8 * u1 + 4 * v1 + 2 * u2 + v2]
    upper = min(max(min(max(C(u1, v1, u2, v2) for v2 in (0, 1)) for u2 in (0, 1)) for v1 in (0, 1)) for u1 in (0, 1))
    lower = max(min(max(min(C(u1, v1, u2, v2) for u2 in (0, 1)) for v2 in (0, 1)) for u1 in (0, 1)) for v1 in (0, 1))
    sub = {}
    for u1 in (0, 1):
        for v1 in (0, 1):
            M = [[C(u1, v1, u2, v2) for v2 in (0, 1)] for u2 in (0, 1)]
            sub[(u1, v1)] = (M, matrix_game(M), det_values(M))
    top = [[sub[(u1, v1)][1][0] for v1 in (0, 1)] for u1 in (0, 1)]
    plans = [(0, 0), (0, 1), (1, 0), (1, 1)]
    openloop = [[C(p[0], q[0], p[1], q[1]) for q in plans] for p in plans]
    return upper, lower, sub, top, openloop


def alphabeta(leaves):
    """深度优先、从左到右的 alpha-beta；返回 (值, 实际访问的叶子下标)。P1 在第 0、2 层取 min。"""
    seen = []

    def rec(level, idx, alpha, beta):
        if level == 4:
            seen.append(idx)
            return leaves[idx]
        if level % 2 == 0:   # P1 min
            v = INF
            for a in (0, 1):
                v = min(v, rec(level + 1, 2 * idx + a, alpha, beta))
                if v <= alpha:
                    return v
                beta = min(beta, v)
            return v
        v = -INF
        for a in (0, 1):
            v = max(v, rec(level + 1, 2 * idx + a, alpha, beta))
            if v >= beta:
                return v
            alpha = max(alpha, v)
        return v

    return rec(0, 0, -INF, INF), seen


def fmt_strategy(w):
    return "(" + ", ".join(str(x) for x in w) + ")"


def item11():
    show("11. 图 10.13 的博弈树")
    leaves = [4, 2, 0, 0, 1, 0, 3, 2, 2, 3, 1, 2, 4, 1, 3, 2]
    upper, lower, sub, top, openloop = tree_values(leaves)
    print(f"  交替行动：上值（P1 的安全计划，图 10.14）= {upper}；下值（图 10.15）= {lower}")
    names = "LR"
    for (u1, v1), (M, (val, w, z), (up, lo)) in sub.items():
        print(f"  (u1,v1)=({names[u1]},{names[v1]}) 的矩阵博弈 {M}：确定性上/下值 {up}/{lo}，随机化值 {val}")
    tv, tw, tz = matrix_game(top)
    print(f"  式 (10.105) {[[str(x) for x in r] for r in top]}：值 {tv}，P1 {fmt_strategy(tw)}，P2 {fmt_strategy(tz)}；确定性上/下值 {det_values(top)}")
    print("  开环 4×4 矩阵（式 10.106，行/列顺序 LL, LR, RL, RR）：")
    for row in openloop:
        print("     ", row)
    up, lo = det_values(openloop)
    v, w, z = matrix_game(openloop)
    print(f"  确定性上值 {up}，下值 {lo} → 没有确定性鞍点；随机化值 = {v} ≈ {float(v):.4f}")
    print(f"  P1 的随机化安全策略 w = {fmt_strategy(w)}，P2 的 z = {fmt_strategy(z)}")
    # 核对：w 保证每列 ≤ v，z 保证每行 ≥ v
    print("  核对 w^T A ≤ v：", [str(sum(w[i] * openloop[i][j] for i in range(4))) for j in range(4)])
    print("  核对 A z ≥ v：  ", [str(sum(openloop[i][j] * z[j] for j in range(4))) for i in range(4)])
    print(f"  阶段式模型下每个玩家的确定性计划数：2^5 = {2 ** 5}（P1 的 1 + 4 个决策顶点）")
    val, seen = alphabeta(leaves)
    print(f"  alpha-beta（DFS、从左到右）：值 {val}，访问了 {len(seen)}/16 个叶子：{seen}")


def item12():
    show("12. 习题 18（图 10.23）：阶段式模型")
    leaves = [-1, 2, 0, 1, 2, 4, 1, 5, 7, 1, -1, 3, 1, 0, 2, 4]
    upper, lower, sub, top, openloop = tree_values(leaves)
    print(f"  交替行动的上值 {upper}，下值 {lower}")
    names = "LR"
    for (u1, v1), (M, (val, w, z), (up, lo)) in sub.items():
        print(f"  ({names[u1]},{names[v1]}) 子博弈 {M}：确定性 {up}/{lo}，随机化值 {val}，P1 {fmt_strategy(w)}，P2 {fmt_strategy(z)}")
    tv, tw, tz = matrix_game(top)
    print(f"  第一阶段矩阵 {[[str(x) for x in r] for r in top]}：随机化值 {tv} ≈ {float(tv):.4f}，P1 {fmt_strategy(tw)}，P2 {fmt_strategy(tz)}")


def item13():
    show("13. 图 10.19：引入自然的单阶段零和博弈")
    A1 = [[3, -2], [-6, 3]]
    A2 = [[3, -1], [6, 0]]
    A = [[F(1, 3) * A1[i][j] + F(2, 3) * A2[i][j] for j in range(2)] for i in range(2)]
    print("  A = (1/3)A1 + (2/3)A2 =", [[str(x) for x in r] for r in A], "（书中 (10.119) 右上角印成 0）")
    up, lo = det_values(A)
    print(f"  确定性上值 {up}，下值 {lo} → 鞍点在第 2 行、第 1 列，值 2")
    for p in (F(1, 3), F(1, 2), F(3, 5), F(9, 10)):
        Ap = [[p * A1[i][j] + (1 - p) * A2[i][j] for j in range(2)] for i in range(2)]
        up, lo = det_values(Ap)
        v, w, z = matrix_game(Ap)
        print(f"  自然左支概率 p = {p}：上/下值 {up}/{lo}，随机化值 {v}，w = {fmt_strategy(w)}，z = {fmt_strategy(z)}")


def ring_game(n, K):
    """环上的追逐（补充例子）：d = 逃跑者相对追捕者的位置（模 n），两人每阶段同时向左或向右走一格，
    d' = d + v - u；代价只依赖状态 l(x) = 环上距离，l_F 同样（式 10.115/10.116 的简化形式）。"""
    dist = lambda d: min(d % n, (-d) % n)
    moves = (-1, 1)
    up = {d: F(dist(d)) for d in range(n)}
    lo, rnd = dict(up), dict(up)
    table = [(K + 1, up, lo, rnd)]
    for k in range(K, 0, -1):
        nu, nl, nr = {}, {}, {}
        for d in range(n):
            M = lambda Lk: [[dist(d) + Lk[(d + v - u) % n] for v in moves] for u in moves]
            nu[d] = min(max(r) for r in M(up))                                   # (10.110)
            Ml = M(lo)
            nl[d] = max(min(Ml[i][j] for i in range(2)) for j in range(2))       # (10.111)
            nr[d] = matrix_game(M(rnd))[0]                                       # (10.115)
        up, lo, rnd = nu, nl, nr
        table.append((k, up, lo, rnd))
    return table


def item14():
    show("14. 环上的追逐博弈（补充例子，用于 10.5.2 节）：n = 8，K = 3，两人每阶段同时左右走一格")
    n = 8
    for k, up, lo, rnd in ring_game(n, 3):
        print(f"  k = {k}：上值 {[str(up[d]) for d in range(n)]}")
        print(f"         下值 {[str(lo[d]) for d in range(n)]}")
        print(f"       随机化 {[str(rnd[d]) for d in range(n)]}")
    print("  d = 0 的最后一阶段矩阵（行 u = 左/右，列 v = 左/右）：l + L_F =",
          [[0 + min((v - u) % n, (u - v) % n) for v in (-1, 1)] for u in (-1, 1)], "→ 猜硬币，值 1")


if __name__ == "__main__":
    for f in (item1, item2, item3, item4, item5, item6, item7, item8, item9, item10, item11, item12, item13, item14):
        f()
