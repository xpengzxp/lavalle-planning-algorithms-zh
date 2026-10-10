"""第 10 章「序贯决策论」参考实现：核对教程页面里出现的数值。

只用 Python 标准库。运行：

    python3 part3/code/ch10_sequential_decision.py

依次打印（编号与页面「参考代码第 N 项」对应）：
   1. 例 10.1 / 10.3：数轴上的非确定前向投影 {k, ..., 3k}；按反馈计划走时一定进入 X_G
   2. 例 10.4：概率前向投影 (10.18)(10.19)，并用转移矩阵乘积 (10.17) 再算一遍
   3. 例 10.5：弱 / 强反向投影 WB、SB；SB(S,u) 不是 SB(x,u) 的并（习题 1）
   4. 例 10.2（图 10.1）：15×15 网格上的值迭代——无自然 / 例 10.2 的自然 / 侧滑（补充）
   5. 「计划与 G_π」小网格（补充）：两个预设计划的可达性分类、最坏 / 期望代价
   6. 反向投影算法（图 10.6）与非确定 Dijkstra（图 10.8）：与最坏情况值迭代给出同样的 G*
   7. 例 10.6（图 10.3）：G_π(x_I) = 7；值迭代的变化量随迭代次数的衰减
   8. 例 10.7（图 10.5）：策略迭代的每一步（精确分数）；值迭代对照
   9. 10.3 节：几何级数 (10.66)；机器保养 MDP（补充）的折扣值迭代 / 策略迭代与平均代价
  10. 10.4.2 节：走廊（补充）上的蒙特卡罗、TD(λ)、TD(0)、常数 ρ 评估
  11. 10.4.3 节：Q-learning (10.101) 在「Q-learning 网格」（补充）上
  12. 10.5.1 节：图 10.12、10.13 的博弈树——上值 / 下值、alpha-beta、阶段式矩阵、开环 4×4 (10.106)
  13. 图 10.19：期望矩阵 A = A1/3 + 2A2/3（核对式 10.119 的笔误）
  14. 走廊追逐（补充）：(10.110)(10.111)(10.113) 的上值 / 下值 / 随机化值
  15. 习题 18（图 10.23）：只核对页面互动图给出的数值，不在页面正文里写答案
"""
import math
import random
from fractions import Fraction as F

INF = math.inf


def show(title):
    print()
    print("=" * 76)
    print(title)
    print("=" * 76)


def fr(x):
    """把 Fraction 打印成 a/b，整数打印成整数。"""
    if isinstance(x, F):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    return str(x)


# ============================================================================ 1–3 数轴
MODEL1 = {"U": [-2, 2], "Theta": [-1, 0, 1]}          # 例 10.1 第一个模型
MODEL2 = {"U": [-1, 1], "Theta": [-2, -1, 0, 1, 2]}   # 例 10.1 第二个模型


def fp_nondet(S, u, Theta):
    """式 (10.12)：X_{k+1}(X_k, u_k)。"""
    return {x + u + th for x in S for th in Theta}


def fp_prob(P, u, Theta):
    """式 (10.13)：一步概率前向投影（自然在 Θ 上均匀）。"""
    Q = {}
    p = F(1, len(Theta))
    for x, px in P.items():
        for th in Theta:
            Q[x + u + th] = Q.get(x + u + th, F(0)) + px * p
    return dict(sorted(Q.items()))


def item1():
    show("1. 例 10.1 / 10.3：非确定前向投影")
    S = {0}
    for k in range(1, 6):
        S = fp_nondet(S, 2, MODEL1["Theta"])
        lo, hi = min(S), max(S)
        assert S == set(range(k, 3 * k + 1))
        print(f"  X_{k+1}(0, 2, ..., 2) = {{{lo}, ..., {hi}}}   (= {{k, ..., 3k}}，k = {k})")
    # 例 10.1：从 100 出发一直用 −2，100 个阶段之内一定到达 X_G = {−1, 0, 1}
    S, k = {100}, 0
    while not (S & {-1, 0, 1}) or max(S) > 1:
        S = fp_nondet(S, -2, MODEL1["Theta"])
        k += 1
    print(f"  从 100 一直用 −2：第 {k} 步之后所有可能状态都 ≤ 1（集合 {min(S)}..{max(S)}）——")
    print("    但光看动作序列会冲过头；按反馈计划（进 X_G 就 u_T）才能保证停在目标里：")
    # 反馈计划：x > 1 用 −2，x < −1 用 +2，X_G 内 u_T
    for goal in ({-1, 0, 1}, {0}):
        S, k, ok = {20}, 0, False
        for k in range(1, 60):
            T = set()
            for x in S:
                if x in goal:
                    T.add(x)
                else:
                    u = -2 if x > max(goal) else 2
                    T |= {x + u + th for th in MODEL1["Theta"]}
            S = T
            if S <= goal:
                ok = True
                break
        print(f"    X_G = {sorted(goal)}，x1 = 20：" + (f"第 {k} 个阶段之后前向投影 ⊆ X_G" if ok else f"60 个阶段后仍有 {sorted(S)}，无法保证"))


def item2():
    show("2. 例 10.4：概率前向投影 (10.18)(10.19) 与转移矩阵 (10.17)")
    P = {0: F(1)}
    for k in range(1, 3):
        P = fp_prob(P, 2, MODEL1["Theta"])
        print(f"  第 {k} 步：", "  ".join(f"P({x}) = {fr(p)}" for x, p in P.items()))
    assert list(P.values()) == [F(1, 9), F(2, 9), F(3, 9), F(2, 9), F(1, 9)]
    # 用 n×n 转移矩阵 M_u（列和为 1，式 10.16）在 0..10 上再算一遍
    n = 11
    M = [[F(0)] * n for _ in range(n)]
    for j in range(n):
        for th in MODEL1["Theta"]:
            i = j + 2 + th
            if 0 <= i < n:
                M[i][j] += F(1, 3)
    v = [F(0)] * n
    v[0] = F(1)
    for _ in range(2):
        v = [sum(M[i][j] * v[j] for j in range(n)) for i in range(n)]
    print("  v' = M_u M_u v：", [fr(x) for x in v[:8]], "...（与上面一致）")
    assert v[2:7] == [F(1, 9), F(2, 9), F(3, 9), F(2, 9), F(1, 9)]
    # 模型 2：两步之后的分布（页面「前向投影」图的模型 2）
    P = {0: F(1)}
    for _ in range(2):
        P = fp_prob(P, 1, MODEL2["Theta"])
    print("  模型 2，x1 = 0，两次 u = 1：", "  ".join(f"{x}:{fr(p)}" for x, p in P.items()))


def WB(S, u, Theta):
    """式 (10.22)：在一个足够大的窗口里枚举。"""
    return {x for x in range(-30, 31) if any(x + u + th in S for th in Theta)}


def SB(S, u, Theta):
    """式 (10.24)。"""
    return {x for x in range(-30, 31) if all(x + u + th in S for th in Theta)}


def item3():
    show("3. 例 10.5：反向投影")
    Th = MODEL1["Theta"]
    print("  WB(0, 2) =", sorted(WB({0}, 2, Th)), "  SB(0, 2) =", sorted(SB({0}, 2, Th)))
    XG = {-1, 0, 1}
    print("  WB(X_G, 2) =", sorted(WB(XG, 2, Th)), "  SB(X_G, 2) =", sorted(SB(XG, 2, Th)))
    print("  ∪_x SB(x, 2) =", sorted(set().union(*(SB({x}, 2, Th) for x in XG))), "（≠ SB(X_G, 2)，习题 1）")
    wb_all = WB(XG, 2, Th) | WB(XG, -2, Th) | XG   # u_T：x 留在原地
    sb_all = SB(XG, 2, Th) | SB(XG, -2, Th) | XG
    print("  WB(X_G) =", sorted(wb_all), "  SB(X_G) =", sorted(sb_all))
    print("  不允许 u_T 时 SB(X_G) =", sorted(SB(XG, 2, Th) | SB(XG, -2, Th)))
    assert sorted(WB(XG, 2, Th)) == [-4, -3, -2, -1, 0] and SB(XG, 2, Th) == {-2}


# ============================================================================ 4 网格（图 10.1）
MOVES = {0: (0, 0), 1: (1, 0), 2: (0, 1), 3: (-1, 0), 4: (0, -1)}   # 停、右、上、左、下（例 10.2）


def fig101():
    """图 10.1：15×15，中间 5×5 不属于 X，右上 5×5 是 X_G，x_I = (1,1)。坐标从 1 开始。"""
    X = {(i, j) for i in range(1, 16) for j in range(1, 16) if not (6 <= i <= 10 and 6 <= j <= 10)}
    XG = {(i, j) for i in range(11, 16) for j in range(11, 16)}
    return X, XG, (1, 1)


def add(x, a):
    return (x[0] + a[0], x[1] + a[1])


def actions(X, x):
    """U(x)：停留以及能留在 X 里的四个移动（u_T 另外处理）。"""
    return [u for u, d in MOVES.items() if add(x, d) in X]


def nature(X, x, u, model, slip=0.2):
    """返回 [(θ, P(θ|x,u))]。model:
       'none'  —— 没有自然（θ = 0）；
       'ex102' —— 例 10.2：Θ(x,u) 是从 x+u 出发所有可用的动作，均匀分布；
       'slip'  —— 补充：只会向 u 的两侧横滑；停留时自然不动。不可用的方向不计入，概率重新归一；
       ('ice', 冰面集合) —— 补充：只在冰面上按 'slip' 横滑，其余地方没有自然。"""
    y = add(x, MOVES[u])
    if model == "none":
        return [(0, F(1))]
    if model == "ex102":
        th = [a for a, d in MOVES.items() if add(y, d) in X]
        return [(a, F(1, len(th))) for a in th]
    if isinstance(model, tuple) and model[0] == "ice":
        # 补充：Θ 依赖于状态——只有在冰面 model[1] 上才会横滑（「反向投影与 Dijkstra」互动图）
        if x not in model[1]:
            return [(0, F(1))]
        model = "slip"
    if model == "slip":
        if u == 0:
            return [(0, F(1))]
        side = [2, 4] if u in (1, 3) else [1, 3]
        cand = [(0, 1 - slip)] + [(a, slip / 2) for a in side if add(y, MOVES[a]) in X]
        tot = sum(p for _, p in cand)
        return [(a, p / tot) for a, p in cand]
    raise ValueError(model)


def succ(X, x, u, model, slip=0.2):
    out = {}
    for th, p in nature(X, x, u, model, slip):
        z = add(add(x, MOVES[u]), MOVES[th])
        out[z] = out.get(z, 0) + p
    return out


def value_iteration(X, XG, model, kind, lF=INF, slip=0.2, eps=1e-9, max_it=20000):
    """10.2.1 节的后向值迭代。kind = 'worst'（式 10.39）或 'exp'（式 10.46）。
       每次迭代：X_G 中用 u_T（代价 0）；其余状态 G ← min{ l_F(x) [u_T], min_u (1 + 合成项) }。
       返回 (G, π, 迭代次数)。"""
    G = {x: (0.0 if x in XG else lF) for x in X}
    S = {(x, u): succ(X, x, u, model, slip) for x in X if x not in XG for u in actions(X, x)}
    for it in range(1, max_it + 1):
        Gn, change = {}, 0.0
        for x in X:
            if x in XG:
                Gn[x] = 0.0
                continue
            best = lF
            for u in actions(X, x):
                nxt = S[(x, u)]
                if kind == "worst":
                    v = 1 + max(G[z] for z in nxt)
                else:
                    v = 1 + sum(float(p) * G[z] for z, p in nxt.items()) if all(G[z] < INF for z in nxt) else INF
                best = min(best, v)
            Gn[x] = best
            if best < INF and G[x] < INF:
                change = max(change, abs(best - G[x]))
            elif (best < INF) != (G[x] < INF):
                change = INF
        G = Gn
        if change <= eps:
            break
    pi = {}
    for x in X:
        if x in XG:
            pi[x] = "T"
            continue
        best, bu = INF, None
        for u in actions(X, x):
            nxt = S[(x, u)]
            v = 1 + (max(G[z] for z in nxt) if kind == "worst" else sum(float(p) * G[z] for z, p in nxt.items()))
            if v < best - 1e-12:
                best, bu = v, u
        pi[x] = bu
    return G, pi, it


def simulate(X, XG, pi, model, x0, rng, slip=0.2, cap=2000):
    x, k = x0, 0
    while x not in XG and k < cap:
        u = pi[x]
        th = nature(X, x, u, model, slip)
        r, acc = rng.random(), 0
        for a, p in th:
            acc += float(p)
            if r <= acc:
                break
        x = add(add(x, MOVES[u]), MOVES[a])
        k += 1
    return k


def item4():
    show("4. 例 10.2（图 10.1）：网格上的值迭代")
    X, XG, xI = fig101()
    print(f"  |X| = {len(X)}（225 − 25 个障碍格），|X_G| = {len(XG)}")
    G, pi, it = value_iteration(X, XG, "none", "worst")
    print(f"  无自然：G*(x_I) = {G[xI]:.0f}（10 + 10 步），{it} 次迭代后不再变化")
    G, pi, it = value_iteration(X, XG, "ex102", "worst")
    fin = sum(1 for x in X if G[x] < INF and x not in XG)
    print(f"  例 10.2 的自然、最坏情况：X_G 之外有限值的状态数 = {fin}（自然总能把移动抵消掉）")
    G, pi, it = value_iteration(X, XG, "ex102", "exp", lF=INF, max_it=200)
    fin = sum(1 for x in X if G[x] < INF and x not in XG)
    print(f"  例 10.2 的自然、期望、l_F = ∞：200 次迭代后 X_G 之外有限值的状态数 = {fin}")
    for lF in (100.0,):
        G, pi, it = value_iteration(X, XG, "ex102", "exp", lF=lF)
        rng = random.Random(1)
        runs = [simulate(X, XG, pi, "ex102", xI, rng) for _ in range(4000)]
        print(f"  例 10.2 的自然、期望、l_F = {lF:g}：{it} 次迭代收敛（最大变化 ≤ 1e-9），G*(x_I) = {G[xI]:.4f}；"
              f"按 π* 模拟 4000 次的平均阶段数 = {sum(runs) / len(runs):.3f}")
        far = max((g, x) for x, g in G.items())
        print(f"    最大的 G* = {far[0]:.4f}，在 {far[1]}")
        # 页面上 l_F = 100 时 G*(x_I) 达到的精度
        G1, _, it1 = value_iteration(X, XG, "ex102", "exp", lF=lF, eps=1e-6)
        print(f"    （页面用阈值 1e-6：{it1} 次迭代，G*(x_I) = {G1[xI]:.4f}）")
    for slip in (0.2, 0.4):
        Gw, pw, itw = value_iteration(X, XG, "slip", "worst", slip=slip)
        Ge, pe, ite = value_iteration(X, XG, "slip", "exp", lF=100.0, slip=slip)
        fin = sum(1 for x in X if Gw[x] < INF and x not in XG)
        print(f"  侧滑（补充），横滑概率 {slip}：最坏情况 G*(x_I) = {Gw[xI]:.0f}（{itw} 次迭代；X_G 外 {fin} 个状态有限），"
              f"期望 G*(x_I) = {Ge[xI]:.4f}（{ite} 次迭代）")


# ============================================================================ 5 计划与 G_π（补充小网格）
def plan_world():
    """「计划与 G_π」互动图：7×4 的小网格（坐标从 0 开始，y 向上），处处侧滑；X_G 是最右一列。"""
    X = {(i, j) for i in range(7) for j in range(4)}
    XG = {(6, j) for j in range(4)}
    return X, XG


PRESET_RIGHT = {(i, j): 1 for i in range(6) for j in range(4)}          # 全部向右
PRESET_LOOP = dict(PRESET_RIGHT)
PRESET_LOOP.update({(3, 1): 2, (2, 2): 4})                               # (3,1)↑ 与 (2,2)↓ 可能互相踢皮球
PRESET_TRAP = dict(PRESET_LOOP)
PRESET_TRAP.update({(0, 0): 2, (0, 1): 4, (1, 0): 3, (1, 1): 3, (0, 2): 4})   # 左下角 5 个状态自成闭集


def plan_costs(X, XG, pi, model="slip", slip=0.2):
    """最坏情况代价 (10.31)：G_π 中到 X_G 的最长路（若能进入不含目标的环则为 ∞）；
       期望代价 (10.32)：解线性方程组（这里用迭代到收敛）；以 1 的概率到不了目标则为 ∞。"""
    nxt = {x: (succ(X, x, pi[x], model, slip) if x not in XG else {x: 1}) for x in X}
    # 可能到达：在 G_π 中存在到 X_G 的路
    poss = set(XG)
    changed = True
    while changed:
        changed = False
        for x in X:
            if x not in poss and any(z in poss for z in nxt[x]):
                poss.add(x)
                changed = True
    # 保证到达：所有后继都已保证（最小不动点）；同时得到最坏代价
    worst = {x: (0 if x in XG else INF) for x in X}
    for _ in range(len(X) + 2):
        for x in X:
            if x in XG:
                continue
            m = max(worst[z] for z in nxt[x])
            worst[x] = min(worst[x], 1 + m) if m < INF else worst[x]
    # 期望：只在「保证 = 以概率 1」到达的状态上有限（在 G_π 里能到目标的每条边概率都 > 0，
    # 所以概率 1 到达 ⇔ 从 x 出发能到的每个状态都可能到达）
    reach = {}
    for x in X:
        seen, st = {x}, [x]
        while st:
            y = st.pop()
            for z in nxt[y]:
                if z not in seen:
                    seen.add(z)
                    st.append(z)
        reach[x] = seen
    prob1 = {x for x in X if reach[x] <= poss}
    E = {x: 0.0 for x in X}
    for _ in range(5000):
        for x in X:
            if x in XG or x not in prob1:
                continue
            E[x] = 1 + sum(float(p) * E[z] for z, p in nxt[x].items())
    for x in X:
        if x not in prob1:
            E[x] = INF
    return poss, worst, E


def item5():
    show("5. 计划与 G_π（补充小网格，处处侧滑 0.2）")
    X, XG = plan_world()
    for name, pi in (("全部向右（像图 10.2b）", PRESET_RIGHT), ("踢皮球（像图 10.2a）", PRESET_LOOP), ("加上死循环", PRESET_TRAP)):
        poss, worst, E = plan_costs(X, XG, pi)
        g = sum(1 for x in X if worst[x] < INF and x not in XG)
        p = len(poss - XG) - g
        print(f"  {name}：保证到达 {g} 个，只是可能到达 {p} 个，到不了 {len(X) - len(poss)} 个；"
              f"x1 = (0,0)：最坏 G_π = {worst[(0, 0)]}，期望 G_π = {E[(0, 0)]:.4f}；x1 = (2,1)：最坏 {worst[(2, 1)]}，期望 {E[(2, 1)]:.4f}")


# ============================================================================ 6 反向投影算法与非确定 Dijkstra
DIJ_W, DIJ_H = 14, 10


def dij_world():
    """「反向投影与 Dijkstra」互动图的世界（补充）：14×10，坐标从 0 开始。
       X_G 是右上角的 3×3；x = 6 处有一堵竖墙（y = 0..6）；两片冰面，只有在冰面上自然才会横滑。"""
    obs = {(6, j) for j in range(0, 7)}
    X = {(i, j) for i in range(DIJ_W) for j in range(DIJ_H)} - obs
    XG = {(i, j) for i in range(11, 14) for j in range(7, 10)}
    ice = frozenset({(i, j) for i in range(2, 11) for j in range(7, 10)} | {(i, j) for i in range(7, 11) for j in range(0, 7)})
    return X, XG, ("ice", ice)


def backprojection_algorithm(X, XG, model, restrict=False):
    """图 10.6。每一「遍」对 X∖S（或 WB(S)∖S）中的状态检查是否存在 u 使 x ∈ SB(S, u)。
       返回每遍加入的状态集合以及被检查的状态总数。"""
    S = set(XG)
    layers, checked = [], 0
    while True:
        if restrict:
            cand = {x for x in X - S if any(z in S for u in actions(X, x) for z in succ(X, x, u, model))}
        else:
            cand = X - S
        checked += len(cand)
        new = {x for x in cand if any(all(z in S for z in succ(X, x, u, model)) for u in actions(X, x))}
        if not new:
            break
        layers.append(new)
        S |= new          # 书中 Step 2 是边检查边插入；这里按「遍」整体插入，结果集合相同，只是层次更清楚
    return layers, checked


def nondet_dijkstra(X, XG, model):
    """图 10.8，式 (10.64)。返回 G*、π* 和弹出顺序。"""
    G = {x: (0 if x in XG else INF) for x in X}
    A = set(XG)
    S = set()
    order = []
    pi = {x: "T" for x in XG}
    evals = 0
    while A:
        xs = min(A, key=lambda x: (G[x], x))
        A.remove(xs)
        S.add(xs)
        order.append(xs)
        # Front(x_s, S)：x ∉ S，存在 u 使 x_s ∈ X_{k+1}(x,u) ⊆ S
        for x in X - S:
            best, bu = G[x], pi.get(x)
            for u in actions(X, x):
                nx = succ(X, x, u, model)
                if xs in nx and all(z in S for z in nx):
                    evals += 1
                    v = 1 + max(G[z] for z in nx)
                    if v < best:
                        best, bu = v, u
            if best < G[x]:
                G[x] = best
                pi[x] = bu
                A.add(x)
    return G, pi, order, evals


def item6():
    show("6. 反向投影算法（图 10.6）与非确定 Dijkstra（图 10.8），冰面世界")
    X, XG, model = dij_world()
    layers, checked = backprojection_algorithm(X, XG, model)
    layers2, checked2 = backprojection_algorithm(X, XG, model, restrict=True)
    tot = sum(len(L) for L in layers)
    print(f"  |X| = {len(X)}，|X_G| = {len(XG)}；反向投影算法 {len(layers)} 遍后停止，S 增加了 {tot} 个状态，"
          f"{len(X) - len(XG) - tot} 个状态无法保证到达；每遍加入：{[len(L) for L in layers]}")
    print(f"  被检查的状态总数：X∖S 版本 {checked}，WB(S)∖S 版本 {checked2}（结果相同：{layers == layers2}）")
    G, pi, order, evals = nondet_dijkstra(X, XG, model)
    Gv, pv, it = value_iteration(X, XG, model, "worst")
    same = all((G[x] == Gv[x]) or (G[x] == INF and Gv[x] == INF) for x in X)
    print(f"  非确定 Dijkstra：弹出 {len(order)} 个状态，(10.64) 求值 {evals} 次；最大 G* = {max(G.values())}；与最坏情况值迭代一致：{same}")
    print(f"  最坏情况值迭代：{it} 次迭代（每次扫一遍全部 {len(X)} 个状态，共 {it * len(X)} 次状态更新）")
    Ge, pe, ite = value_iteration(X, XG, model, "exp", lF=1000.0)
    Gd, pd, itd = value_iteration(X, XG, "none", "worst")
    print(f"  x = (0,0)：确定性最短 {Gd[(0, 0)]:.0f}，期望 G* = {Ge[(0, 0)]:.4f}，最坏 G* = {G[(0, 0)]}")
    diff = sorted(x for x in X if x not in XG and pi[x] != pe[x])
    print(f"  最坏情况计划与期望计划在 {len(diff)} 个状态上选了不同的动作")


# ============================================================================ 7 例 10.6（图 10.3）
def item7():
    show("7. 例 10.6（图 10.3）")
    # 解析：每多绕一圈代价 +4，概率减半
    s = sum(F(1, 2 ** i) * (3 + 4 * (i - 1)) for i in range(1, 80))
    print(f"  Σ (1/2)^i (3 + 4(i−1)) ≈ {float(s):.12f}；书中 3 + 4 Σ 1/2^i = 7（尾和公式 E[N] = Σ P(N ≥ i)）")
    # 值迭代（对固定计划求值）。节点：I → A → B →(1/2) G, B →(1/2) C → D → A
    for p in (F(1, 2), F(1, 4), F(9, 10)):
        exact = 3 + 4 * (1 - p) / p
        G = {"I": F(0), "A": F(0), "B": F(0), "C": F(0), "D": F(0), "G": F(0)}
        changes = []
        for n in range(1, 801):
            Gn = dict(G)
            Gn["I"] = 1 + G["A"]
            Gn["A"] = 1 + G["B"]
            Gn["B"] = 1 + p * G["G"] + (1 - p) * G["C"]
            Gn["C"] = 1 + G["D"]
            Gn["D"] = 1 + G["A"]
            changes.append(max(abs(Gn[k] - G[k]) for k in G))
            G = Gn
        first = next((n for n, c in enumerate(changes, 1) if c < 1e-9), None)
        print(f"  p = {fr(p)}：G_π(x_I) = 3 + 4(1−p)/p = {fr(exact)}；初值 0 的值迭代：第 20 次迭代的最大变化 = {float(changes[19]):.3g}，"
              f"第 {first} 次迭代起变化 < 1e-9；G_800(x_I) = {float(G['I']):.9f}")
    print("  （变化量正是 P(还没到达)：p = 1/2 时第 n 次迭代的变化 = (1/2)^⌈(n−3)/4⌉）")


# ============================================================================ 8 例 10.7（图 10.5）
P107 = {   # P[(x, u)] = {x': prob}
    ("a", 1): {"a": F(1, 3), "b": F(1, 3), "c": F(1, 3)},
    ("b", 1): {"a": F(1, 3), "b": F(1, 3), "c": F(1, 3)},
    ("a", 2): {"b": F(1, 2), "c": F(1, 2)},
    ("b", 2): {"a": F(1, 4), "c": F(3, 4)},
}


def solve_linear(A, b):
    """精确高斯消元。"""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        r = next(r for r in range(c, n) if M[r][c] != 0)
        M[c], M[r] = M[r], M[c]
        for r in range(n):
            if r != c and M[r][c] != 0:
                f = M[r][c] / M[c][c]
                M[r] = [M[r][k] - f * M[c][k] for k in range(n + 1)]
    return [M[i][n] / M[i][i] for i in range(n)]


def eval_plan(P, pi, states, cost=1):
    """式 (10.53)：G_π(x) = l + Σ G_π(x') P(x'|x, π(x))，目标 c 上 G = 0。"""
    idx = {s: i for i, s in enumerate(states)}
    A = [[F(0)] * len(states) for _ in states]
    b = [F(cost)] * len(states)
    for s in states:
        A[idx[s]][idx[s]] += 1
        for t, p in P[(s, pi[s])].items():
            if t in idx:
                A[idx[s]][idx[t]] -= p
    sol = solve_linear(A, b)
    return {s: sol[idx[s]] for s in states}


def item8():
    show("8. 例 10.7：策略迭代（精确分数）")
    states = ["a", "b"]
    pi = {"a": 1, "b": 1}
    for rnd in range(1, 5):
        G = eval_plan(P107, pi, states)
        print(f"  第 {rnd} 轮  π = (π(a), π(b)) = ({pi['a']}, {pi['b']})：G_π(a) = {fr(G['a'])}，G_π(b) = {fr(G['b'])}")
        Gc = dict(G, c=F(0))
        new = {}
        for s in states:
            vals = {u: 1 + sum(p * Gc[t] for t, p in P107[(s, u)].items()) for u in (1, 2)}
            print(f"      (10.54) 在 {s}：u = 1 → {fr(vals[1])}，u = 2 → {fr(vals[2])}")
            new[s] = min(vals, key=lambda u: (vals[u], u))
            if vals[pi[s]] == vals[new[s]]:
                new[s] = pi[s]     # 不严格变好就不换
        if new == pi:
            print("      无法改进 → π* = π")
            break
        pi = new
    assert G == {"a": F(12, 7), "b": F(10, 7)}
    # 值迭代对照：从 0 开始，达到 1e-9 需要几次
    G = {"a": 0.0, "b": 0.0, "c": 0.0}
    for n in range(1, 500):
        Gn = dict(G)
        for s in states:
            Gn[s] = min(1 + sum(float(p) * G[t] for t, p in P107[(s, u)].items()) for u in (1, 2))
        ch = max(abs(Gn[s] - G[s]) for s in states)
        G = Gn
        if ch < 1e-9:
            break
    print(f"  值迭代（初值 0）：{n} 次迭代后最大变化 < 1e-9，G(a) = {G['a']:.9f}（12/7 = {12 / 7:.9f}），G(b) = {G['b']:.9f}")


# ============================================================================ 9 无限时域
# 机器保养 MDP（补充）：状态 0 新、1 磨损、2 严重磨损、3 损坏
MACH_RUN_COST = [0, 2, 4, 10]       # 运转一个阶段的代价
MACH_WEAR = [0.3, 0.3, 0.5, 0.0]    # 运转后恶化一级的概率（损坏后保持损坏）
MACH_REPAIR = 5                     # 维修：代价 5，下一阶段回到「新」


def mach_P(x, u):
    if u == "repair":
        return {0: 1.0}
    if x == 3:
        return {3: 1.0}
    return {x: 1 - MACH_WEAR[x], x + 1: MACH_WEAR[x]}


def mach_cost(x, u):
    return MACH_REPAIR if u == "repair" else MACH_RUN_COST[x]


def mach_vi(alpha, eps=1e-10):
    """式 (10.74)/(10.76)：J_i(x) = min_u { l(x,u) + α Σ J_{i−1}(x') P(x'|x,u) }，J_0 = 0。"""
    J = [0.0] * 4
    for it in range(1, 100000):
        Jn = [min(mach_cost(x, u) + alpha * sum(p * J[y] for y, p in mach_P(x, u).items()) for u in ("run", "repair"))
              for x in range(4)]
        ch = max(abs(a - b) for a, b in zip(Jn, J))
        J = Jn
        if ch < eps:
            break
    pi = [min(("run", "repair"), key=lambda u: mach_cost(x, u) + alpha * sum(p * J[y] for y, p in mach_P(x, u).items()))
          for x in range(4)]
    return J, pi, it


def mach_pi(alpha):
    """策略迭代：(10.77) 求值、(10.78) 改进。"""
    pi = ["run"] * 4
    rounds = 0
    while True:
        rounds += 1
        # 求值：解 (I − αP_π) J = l_π
        A = [[F(0)] * 4 for _ in range(4)]
        b = [F(mach_cost(x, pi[x])) for x in range(4)]
        a = F(alpha).limit_denominator(1000)
        for x in range(4):
            A[x][x] += 1
            for y, p in mach_P(x, pi[x]).items():
                A[x][y] -= a * F(p).limit_denominator(1000)
        J = solve_linear(A, b)
        new = []
        for x in range(4):
            vals = {u: mach_cost(x, u) + a * sum(F(p).limit_denominator(1000) * J[y] for y, p in mach_P(x, u).items())
                    for u in ("run", "repair")}
            best = min(vals.values())
            new.append(pi[x] if vals[pi[x]] == best else min(vals, key=vals.get))
        if new == pi:
            return [float(v) for v in J], pi, rounds
        pi = new


def mach_avg(eps=1e-10):
    """平均代价：相对值迭代（[12]），参考状态 s = 0；另用 (10.80) 判断普通值迭代的收敛。"""
    h = [0.0] * 4
    for it in range(1, 100000):
        T = [min(mach_cost(x, u) + sum(p * h[y] for y, p in mach_P(x, u).items()) for u in ("run", "repair")) for x in range(4)]
        g = T[0]
        hn = [t - g for t in T]
        ch = max(abs(a - b) for a, b in zip(hn, h))
        h = hn
        if ch < eps:
            break
    pi = [min(("run", "repair"), key=lambda u: mach_cost(x, u) + sum(p * h[y] for y, p in mach_P(x, u).items())) for x in range(4)]
    # 普通值迭代 + (10.80)
    G = [0.0] * 4
    N = 0
    for N in range(1, 100000):
        Gn = [min(mach_cost(x, u) + sum(p * G[y] for y, p in mach_P(x, u).items()) for u in ("run", "repair")) for x in range(4)]
        if N > 1 and max(abs(Gn[x] / N - G[x] / (N - 1)) for x in range(4)) < 1e-3:
            G = Gn
            break
        G = Gn
    return g, h, pi, it, N, [v / N for v in G]


def item9():
    show("9. 10.3 节：折扣与平均代价")
    for a in (0.5, 0.9, 0.99):
        print(f"  α = {a}：Σ α^k = 1/(1−α) = {1 / (1 - a):g}；前 20 项和 = {sum(a ** k for k in range(21)):.6f}")
    print("  机器保养 MDP（补充）：运转代价", MACH_RUN_COST, "恶化概率", MACH_WEAR, "维修代价", MACH_REPAIR)
    for a in (0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99):
        J, pi, it = mach_vi(a)
        J2, pi2, r = mach_pi(a)
        assert pi == pi2 and max(abs(x - y) for x, y in zip(J, J2)) < 1e-6, (a, pi, pi2)
        print(f"    α = {a:<4}：J* = [{', '.join(f'{v:.3f}' for v in J)}]  π* = {pi}  值迭代 {it} 次，策略迭代 {r} 轮")
    # 策略在哪些 α 处切换
    prev, switches = None, []
    for k in range(1, 1000):
        a = k / 1000
        _, pi, _ = mach_vi(a, eps=1e-11)
        if pi != prev and prev is not None:
            switches.append((a, pi))
        prev = pi
    print("    π* 改变的位置（α 以 0.001 为步长扫描）：", "; ".join(f"α≈{a}: {p}" for a, p in switches))
    g, h, pi, it, N, avg = mach_avg()
    print(f"    平均代价（相对值迭代 {it} 次）：每阶段 {g:.6f}，π* = {pi}，h = [{', '.join(f'{v:.4f}' for v in h)}]")
    print(f"    普通值迭代按 (10.80)、ε = 1e-3：N = {N} 时停止，G_N/N = [{', '.join(f'{v:.4f}' for v in avg)}]")
    J, _, _ = mach_vi(0.999)
    print(f"    对照：(1−α)J*(0) 在 α = 0.999 时 = {(1 - 0.999) * J[0]:.4f}（趋向平均代价）")


# ============================================================================ 10 走廊上的 MC / TD
CORR_N = 8            # 状态 1..8，9 是目标
CORR_P = (0.6, 0.25, 0.15)   # 计划「一直向右」：前进 / 原地 / 后退 的概率（状态 1 不能后退，并入原地）


def corr_next(x):
    pf, ps, pb = CORR_P
    if x == 1:
        return {2: pf, 1: ps + pb}
    return {x + 1: pf, x: ps, x - 1: pb}


def corr_true():
    states = list(range(1, CORR_N + 1))
    idx = {s: i for i, s in enumerate(states)}
    A = [[F(0)] * CORR_N for _ in states]
    b = [F(1)] * CORR_N
    for s in states:
        A[idx[s]][idx[s]] += 1
        for t, p in corr_next(s).items():
            if t in idx:
                A[idx[s]][idx[t]] -= F(p).limit_denominator(100)
    sol = solve_linear(A, b)
    return {s: sol[idx[s]] for s in states}


def corr_trial(rng, x0):
    xs = [x0]
    while xs[-1] <= CORR_N:
        nx = corr_next(xs[-1])
        r, acc = rng.random(), 0
        for t, p in nx.items():
            acc += p
            if r <= acc:
                break
        xs.append(t)
    return xs          # 最后一个是目标 9；每一步代价 1


def corr_learn(method, trials, lam=0.5, rho=0.1, seed=1):
    rng = random.Random(seed)
    Gh = {s: 0.0 for s in range(1, CORR_N + 2)}
    v = {s: 0 for s in range(1, CORR_N + 2)}
    for t in range(trials):
        xs = corr_trial(rng, 1 + t % CORR_N)
        K = len(xs) - 1
        if method == "mc":
            for k in range(K):
                v[xs[k]] += 1
                c = K - k                        # (10.86)：从 x_k 起累计的代价
                Gh[xs[k]] += (c - Gh[xs[k]]) / v[xs[k]]
        else:
            for k in range(K):
                v[xs[k]] += 1
                d = 1 + Gh[xs[k + 1]] - Gh[xs[k]]        # (10.87)，目标上 Ĝ = 0
                if method == "td":                      # TD(λ)，式 (10.93)
                    for j in range(k + 1):
                        Gh[xs[j]] += lam ** (k - j) * d / v[xs[j]]
                elif method == "rho":                   # (10.96)，常数 ρ
                    Gh[xs[k]] += rho * d
    return Gh


def item10():
    show("10. 10.4.2 节：走廊（补充）上的计划评估")
    true = corr_true()
    print("  真值 G_π：", "  ".join(f"{s}:{float(g):.4f}" for s, g in true.items()))
    print(f"  G_π(1) = {fr(true[1])}")
    for method, kw in (("mc", {}), ("td", {"lam": 1.0}), ("td", {"lam": 0.8}), ("td", {"lam": 0.5}), ("td", {"lam": 0.0}),
                       ("rho", {"rho": 0.2}), ("rho", {"rho": 0.05}), ("rho", {"rho": 0.02})):
        errs = []
        for seed in range(1, 21):
            Gh = corr_learn(method, 400, seed=seed, **kw)
            errs.append(math.sqrt(sum((Gh[s] - float(true[s])) ** 2 for s in true) / CORR_N))
        name = method + ("" if not kw else " " + ", ".join(f"{k}={v}" for k, v in kw.items()))
        print(f"    {name:<12} 400 次试验后的 RMS 误差（20 个种子平均）= {sum(errs) / len(errs):.4f}")


# ============================================================================ 11 Q-learning
def q_world():
    """「Q-learning」互动图的世界（补充）：7×5，坐标从 0 开始；目标 (6,4)；两段墙。侧滑 0.2。"""
    obs = {(2, 1), (2, 2), (2, 3), (4, 0), (4, 1), (4, 2)}
    X = {(i, j) for i in range(7) for j in range(5)} - obs
    XG = {(6, 4)}
    return X, XG


def q_learning(X, XG, episodes, rho=None, eps_greedy=0.1, seed=1, slip=0.2):
    rng = random.Random(seed)
    Q = {(x, u): 0.0 for x in X for u in actions(X, x) if u != 0}
    n = {k: 0 for k in Q}
    acts = {x: [u for u in actions(X, x) if u != 0] for x in X}
    starts = sorted(X - XG)
    for _ in range(episodes):
        x = rng.choice(starts)
        for _ in range(300):
            if x in XG:
                break
            if rng.random() < eps_greedy:
                u = rng.choice(acts[x])
            else:
                u = min(acts[x], key=lambda a: (Q[(x, a)], rng.random()))
            th = nature(X, x, u, "slip", slip)
            r, acc = rng.random(), 0
            for a, p in th:
                acc += float(p)
                if r <= acc:
                    break
            y = add(add(x, MOVES[u]), MOVES[a])
            target = 1 + (0.0 if y in XG else min(Q[(y, b)] for b in acts[y]))
            n[(x, u)] += 1
            r_ = rho if rho is not None else 1 / n[(x, u)]
            Q[(x, u)] = (1 - r_) * Q[(x, u)] + r_ * target          # (10.101)
            x = y
    return Q


def item11():
    show("11. 10.4.3 节：Q-learning（补充网格）")
    X, XG = q_world()
    # 「停」在 Q-learning 里没有用处，去掉它再算 G*
    G, pi, it = value_iteration(X, XG, "slip", "exp", lF=1000.0)
    print(f"  值迭代：G*(0,0) = {G[(0, 0)]:.4f}，最大 G* = {max(G.values()):.4f}")
    for rho in (None, 0.2):
        for episodes in (500, 5000):
            errs = []
            for seed in range(1, 11):
                Q = q_learning(X, XG, episodes, rho=rho, eps_greedy=0.2, seed=seed)
                errs.append(max(abs(min(Q[(x, u)] for u in actions(X, x) if u != 0) - G[x]) for x in X if x not in XG))
            name = "1/n" if rho is None else f"{rho}"
            print(f"    ρ = {name:<4}，ε-贪心 0.2，{episodes:>5} 条轨迹：max_x |min_u Q̂(x,u) − G*(x)|（10 个种子平均）= {sum(errs) / len(errs):.4f}")


# ============================================================================ 12–15 博弈
def simplex_max(A, b, c):
    """max c·x  s.t. A x ≤ b, x ≥ 0（b ≥ 0），精确分数单纯形，Bland 规则。返回 (最优值, x, 对偶 y)。"""
    m, n = len(A), len(c)
    T = [[F(v) for v in A[i]] + [F(int(i == j)) for j in range(m)] + [F(b[i])] for i in range(m)]
    z = [F(-v) for v in c] + [F(0)] * m + [F(0)]
    basis = [n + i for i in range(m)]
    while True:
        col = next((j for j in range(n + m) if z[j] < 0), None)
        if col is None:
            break
        ratios = [(T[i][-1] / T[i][col], basis[i], i) for i in range(m) if T[i][col] > 0]
        _, _, row = min(ratios)
        pv = T[row][col]
        T[row] = [v / pv for v in T[row]]
        for i in range(m):
            if i != row and T[i][col] != 0:
                f = T[i][col]
                T[i] = [a - f * bb for a, bb in zip(T[i], T[row])]
        f = z[col]
        z = [a - f * bb for a, bb in zip(z, T[row])]
        basis[row] = col
    x = [F(0)] * n
    for i, bv in enumerate(basis):
        if bv < n:
            x[bv] = T[i][-1]
    y = [z[n + i] for i in range(m)]
    return z[-1], x, y


def matrix_game(A):
    """代价矩阵 A（行 = P1 最小化，列 = P2 最大化）的随机化值与安全策略（9.3.3 节）。"""
    lo = min(min(r) for r in A)
    B = [[F(v) - lo + 1 for v in r] for r in A]
    m, n = len(B), len(B[0])
    # P1：max Σx  s.t. Bᵀx ≤ 1
    val, x, y = simplex_max([[B[i][j] for i in range(m)] for j in range(n)], [1] * n, [1] * m)
    V = 1 / val
    w = [xi * V for xi in x]
    z = [yi * V for yi in y]
    return V + lo - 1, w, z


def det_values(A):
    upper = min(max(r) for r in A)                                 # P1 的安全策略 (9.44)
    lower = max(min(A[i][j] for i in range(len(A))) for j in range(len(A[0])))   # (9.46)
    return upper, lower


def tree_values(leaves, branch, order):
    """自底向上：order[0] 是根那一层由谁选。返回 [根层值, ..., 最底层决策值]（每层一个列表）。"""
    cur = list(leaves)
    out = []
    for who in reversed(order):
        groups = [cur[i:i + branch] for i in range(0, len(cur), branch)]
        cur = [min(g) if who == "min" else max(g) for g in groups]
        out.append(cur)
    return out[::-1]


def alphabeta(leaves, branch, order):
    """深度优先 alpha-beta；返回 (值, 访问过的叶子下标)。"""
    visited = []
    depth = len(order)

    def rec(level, start, span, a, b):
        if level == depth:
            visited.append(start)
            return leaves[start]
        sub = span // branch
        if order[level] == "min":
            v = INF
            for k in range(branch):
                v = min(v, rec(level + 1, start + k * sub, sub, a, b))
                if v <= a:
                    break
                b = min(b, v)
            return v
        v = -INF
        for k in range(branch):
            v = max(v, rec(level + 1, start + k * sub, sub, a, b))
            if v >= b:
                break
            a = max(a, v)
        return v

    val = rec(0, 0, len(leaves), -INF, INF)
    return val, visited


FIG1013 = [4, 2, 0, 0, 1, 0, 3, 2, 2, 3, 1, 2, 4, 1, 3, 2]
FIG1023 = [-1, 2, 0, 1, 2, 4, 1, 5, 7, 1, -1, 3, 1, 0, 2, 4]
FIG1012 = [3, 3, 5, 1, -1, 7, 0, -2, 4]


def leaf(L, u1, v1, u2, v2):
    """图 10.13 的叶子：下标顺序 (u1, v1, u2, v2)，L=0, R=1。"""
    return L[8 * u1 + 4 * v1 + 2 * u2 + v2]


def swap_order(L):
    """P2 先行（图 10.15）：叶子按 (v1, u1, v2, u2) 重新排列。"""
    return [leaf(L, u1, v1, u2, v2) for v1 in (0, 1) for u1 in (0, 1) for v2 in (0, 1) for u2 in (0, 1)]


def open_loop_matrix(L):
    """(10.106)：行 = P1 的计划 (u1,u2)，列 = P2 的计划 (v1,v2)，顺序 LL, LR, RL, RR。"""
    plans = [(0, 0), (0, 1), (1, 0), (1, 1)]
    return [[leaf(L, u1, v1, u2, v2) for (v1, v2) in plans] for (u1, u2) in plans]


def stage_matrices(L):
    """图 10.17：第一阶段 (u1, v1) 之后的 2×2 矩阵（行 u2，列 v2）。"""
    return {(u1, v1): [[leaf(L, u1, v1, u2, v2) for v2 in (0, 1)] for u2 in (0, 1)] for u1 in (0, 1) for v1 in (0, 1)}


def stage_by_stage(L):
    vals = {k: matrix_game(M) for k, M in stage_matrices(L).items()}
    top = [[vals[(u1, v1)][0] for v1 in (0, 1)] for u1 in (0, 1)]
    return vals, top, matrix_game(top)


def item12():
    show("12. 10.5.1 节：博弈树")
    # 图 10.12（解释 1：P2 知道 P1 的动作）
    A = [FIG1012[0:3], FIG1012[3:6], FIG1012[6:9]]
    up = tree_values(FIG1012, 3, ["min", "max"])
    print(f"  图 10.12：P2 知道 P1 的动作时，P2 在三个顶点的最大值 {up[1]}，上值 = {up[0][0]}；矩阵的确定性上 / 下值 = {det_values(A)}（例 9.14：鞍点值 4）")
    # 图 10.13 / 10.14
    lv = tree_values(FIG1013, 2, ["min", "max", "min", "max"])
    print("  图 10.13，P1 的安全计划（图 10.14 自底向上）：")
    for name, vals in zip(["(d) 根，P1", "(c) P2", "(b) P1", "(a) P2"], lv):
        print(f"      {name}: {vals}")
    sw = swap_order(FIG1013)
    print("  图 10.15 的叶子（P2 先行）：", sw)
    lv2 = tree_values(sw, 2, ["max", "min", "max", "min"])
    for name, vals in zip(["根，P2", "P1", "P2", "P1"], lv2):
        print(f"      {name}: {vals}")
    print(f"  上值 = {lv[0][0]}，下值 = {lv2[0][0]}  → 确定性鞍点，值 1")
    v, vis = alphabeta(FIG1013, 2, ["min", "max", "min", "max"])
    print(f"  alpha-beta（P1 先行，从左到右）：值 {v}，只看了 {len(vis)}/16 个叶子：{vis}")
    v, vis = alphabeta(FIG1012, 3, ["min", "max"])
    print(f"  图 10.12 的 alpha-beta：值 {v}，看了 {len(vis)}/9 个叶子：{vis}")
    # 图 10.17、10.18、(10.105)
    vals, top, (V, w, z) = stage_by_stage(FIG1013)
    names = "LR"
    for (u1, v1), (val, ww, zz) in vals.items():
        M = stage_matrices(FIG1013)[(u1, v1)]
        print(f"    第一阶段 ({names[u1]},{names[v1]}) 后的矩阵 {M}：确定性上 / 下值 {det_values(M)}，随机化值 {fr(val)}")
    print(f"  (10.105) 顶层矩阵 {[[fr(a) for a in r] for r in top]}：值 {fr(V)}，P1 策略 {[fr(a) for a in w]}，P2 策略 {[fr(a) for a in z]}")
    # 开环 (10.106)
    M = open_loop_matrix(FIG1013)
    print("  (10.106) 开环 4×4：", M)
    V, w, z = matrix_game(M)
    print(f"    确定性上 / 下值 = {det_values(M)}（没有确定性鞍点）；随机化值 = {fr(V)}")
    print(f"    P1 的随机化安全策略 w = {[fr(a) for a in w]}，P2 的 z = {[fr(a) for a in z]}")
    # 核对：w A z = V，且 w 对 P2 的每个纯策略都 ≤ V
    assert all(sum(w[i] * M[i][j] for i in range(4)) <= V for j in range(4))
    assert all(sum(M[i][j] * z[j] for j in range(4)) >= V for i in range(4))
    # 阶段式下的计划个数
    print("  阶段式模型：每个玩家 5 个决策顶点 → 2^5 = 32 个计划（32×32 矩阵）")


def item13():
    show("13. 图 10.19：有自然的单阶段博弈")
    A1 = [[3, -2], [-6, 3]]
    A2 = [[3, -1], [6, 0]]
    for p in (F(1, 3), F(1, 2), F(2, 3)):
        A = [[p * A1[i][j] + (1 - p) * A2[i][j] for j in range(2)] for i in range(2)]
        up, lo = det_values(A)
        V, w, z = matrix_game(A)
        print(f"  P(左) = {fr(p)}：A = {[[fr(a) for a in r] for r in A]}；确定性上 / 下值 {fr(up)} / {fr(lo)}；随机化值 {fr(V)}")
    print("  p = 1/3 时第一行第二列是 (1/3)(−2) + (2/3)(−1) = −4/3，不是书中 (10.119) 的 0；")
    print("  鞍点在第 2 行（P1 选 R）、第 1 列（P2 选 L），值 2——结论不变。")


def corridor_game(N, K):
    """走廊追逐（补充，「状态空间上的博弈」互动图）：状态 x = (p1, p2)，两人在 0..N−1 的走廊里，
       每个阶段同时选 −1 / 0 / +1（撞墙就停在端点）——阶段式模型。l(x, u, v) = 1 表示这一阶段结束时
       逃跑者 P2 还没被抓到（两人不在同一格），l_F = 0。P1 想让这个计数小，P2 想让它大。
       返回 (上值 (10.110), 下值 (10.111), 随机化值 (10.113))，每个都是 {状态: 值}，对应 k = 1。"""
    cl = lambda q: max(0, min(N - 1, q))
    states = [(a, b) for a in range(N) for b in range(N)]
    Up = {x: 0 for x in states}
    Lo = dict(Up)
    Ra = {x: 0.0 for x in states}

    def mat(x, V):
        a, b = x
        return [[(1 if cl(a + u) != cl(b + v) else 0) + V[(cl(a + u), cl(b + v))] for v in (-1, 0, 1)] for u in (-1, 0, 1)]

    for _ in range(K):
        Up = {x: det_values(mat(x, Up))[0] for x in states}
        Lo = {x: det_values(mat(x, Lo))[1] for x in states}
        Ra = {x: float(matrix_game([[F(v).limit_denominator(10 ** 9) for v in r] for r in mat(x, Ra)])[0]) for x in states}
    return Up, Lo, Ra, mat


def item14():
    show("14. 走廊追逐（补充）：上值 / 下值 / 随机化值")
    N = 5
    for K in (1, 2, 3):
        Up, Lo, Ra, mat = corridor_game(N, K)
        print(f"  K = {K}（剩 K 个阶段时，各状态 (p1, p2) 的 上值 / 下值 / 随机化值）：")
        for a in range(N):
            print("     p1 = %d: " % a + "  ".join(f"{Up[(a, b)]}/{Lo[(a, b)]}/{Ra[(a, b)]:.3f}" for b in range(N)))
    M = [[1 if u != v else 0 for v in (-1, 0, 1)] for u in (-1, 0, 1)]
    V, w, z = matrix_game(M)
    print(f"  K = 1、两人在同一格（中间）时的矩阵 {M}：确定性上 / 下值 {det_values(M)}，随机化值 {fr(V)}，w = {[fr(a) for a in w]}")
    zero = {(a, b): 0 for a in range(N) for b in range(N)}
    M = mat((1, 0), zero)
    V, w, z = matrix_game(M)
    print(f"  K = 1、x = (1, 0)（逃跑者被逼在墙角）的矩阵 {M}：确定性上 / 下值 {det_values(M)}，随机化值 {fr(V)}，"
          f"w = {[fr(a) for a in w]}，z = {[fr(a) for a in z]}")


def item15():
    show("15. 习题 18（图 10.23）：只核对互动图")
    lv = tree_values(FIG1023, 2, ["min", "max", "min", "max"])
    sw = swap_order(FIG1023)
    lv2 = tree_values(sw, 2, ["max", "min", "max", "min"])
    print(f"  交替行动：上值 {lv[0][0]}，下值 {lv2[0][0]}")
    vals, top, (V, w, z) = stage_by_stage(FIG1023)
    for (u1, v1), (val, ww, zz) in vals.items():
        M = stage_matrices(FIG1023)[(u1, v1)]
        print(f"    ({'LR'[u1]},{'LR'[v1]})：{M} 确定性 {det_values(M)}，随机化值 {fr(val)}，w = {[fr(a) for a in ww]}，z = {[fr(a) for a in zz]}")
    print(f"  阶段式随机化值 = {fr(V)}，顶层 w = {[fr(a) for a in w]}，z = {[fr(a) for a in z]}")
    M = open_loop_matrix(FIG1023)
    V2, _, _ = matrix_game(M)
    print(f"  开环 4×4 = {M}，随机化值 = {fr(V2)}")


if __name__ == "__main__":
    item1()
    item2()
    item3()
    item4()
    item5()
    item6()
    item7()
    item8()
    item9()
    item10()
    item11()
    item12()
    item13()
    item14()
    item15()
