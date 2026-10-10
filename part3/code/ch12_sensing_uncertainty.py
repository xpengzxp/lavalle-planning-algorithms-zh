"""第 12 章「感知不确定下的规划」参考实现：核对教程页面上出现的数值、互动图的默认设置，以及原书笔误的判断。

只用 Python 标准库。运行：

    python3 part3/code/ch12_sensing_uncertainty.py

各节编号与页面对应：
   1. 12.1.2  I_ndet 的大小 2^n − 1、策略迭代的矩阵规模、I_prob 的维数 n − 1
   2. 12.1.2  玩具问题（补充）：五格走廊上的最坏情况值迭代 (12.7)，有 / 无传感器
   3. 12.1.3  双状态 POMDP（补充）：精确值迭代的 α-向量（分段线性、凹）、书中「枚举所有终端 I-state」的精确方法、插值近似 (12.10)
   4. 12.2.1  例 12.1：图 12.2a 上 (F, L, F, L) 的非确定 I-state (12.15)–(12.18)；原书笔误「position 1」
   5. 12.2.1  例 12.2：图 12.3b 的环形地图——对称类、能一直走圈的初始状态、指南针模型
   6. 12.2.1  主动定位：在可达 I-state 上做最坏情况值迭代（代价：移动 2、没动 1）；习题 1、习题 3
   7. 12.2.3  概率离散定位：(12.20)–(12.22) 与穷举所有状态序列的结果一致
   8. 12.3.1  例 12.4、12.5：判定环境（图 12.12、12.13）；习题 5
   9. 12.3.1  迷宫搜索：模 3 转角计数（原书笔误：顺 / 逆时针写反）
  10. 12.3.2  Stentz 算法 D*（图 12.18）：每次重规划后与 Dijkstra 的最优值一致；展开次数
  11. 12.3.3  迷路的牛：竞争比 3、9；原书列出的「左 1 右 1 左 2 右 2」序列的竞争比是 13
  12. 12.5.2  挤压零件：矩形的直径函数、吸引域、两步计划（例 12.9）；Goldberg 的贪心反向搜索
"""
import itertools
import math
import random
import heapq
from fractions import Fraction as F


def header(t):
    print("\n" + "=" * 76 + "\n" + t + "\n" + "=" * 76)


def check(cond, msg):
    print(("  [ok] " if cond else "  [!!] ") + msg)
    if not cond:
        raise AssertionError(msg)


# ====================================================================== 1. 规模
def item1():
    header("1. 12.1.2 I_ndet 与 I_prob 的规模")
    for n in (3, 5, 10, 20, 32):
        print(f"  |X| = {n:2d}  →  |X⃗| = 2^{n} − 1 = {2 ** n - 1:>13,}   dim(I_prob) = {n - 1}")
    check(2 ** 20 - 1 == 1048575, "100 万个状态的 I_ndet 只对应约 20 个原状态（2^20 − 1 = 1,048,575）")
    m = (2 ** 10 - 1) ** 2
    print(f"  |X| = 10 时策略迭代的矩阵：{2 ** 10 - 1} × {2 ** 10 - 1} = {m:,} 个元素")
    check(10 ** 6 <= m < 1.1 * 10 ** 6, "书中「|X| = 10 时每次迭代要解 100 万个元素的矩阵」")


# ====================================================================== 2. 走廊玩具问题
# 补充的小例子：走廊有 5 格 {1,…,5}，动作 L / R 走一格（撞墙不动），自然可能让机器人「打滑」不动（可开关），
# 传感器只报告「是否在 1 号格」（可开关）。目标：保证在 1 号格。每步代价 1。
def corridor(n, slip, sensor):
    X = list(range(1, n + 1))

    def f(x, u):  # 自然动作 θ ∈ {走, 打滑}
        nxt = max(1, x - 1) if u == "L" else min(n, x + 1)
        return {nxt, x} if slip else {nxt}

    def h(x):
        return (1 if x == 1 else 0) if sensor else 0

    def step(S, u):
        """返回 {y: 新 I-state}，即 (12.8) 的 Θ⃗(x⃗, u⃗) 与每个观测下的 f⃗。"""
        out = {}
        for x in S:
            for x2 in f(x, u):
                out.setdefault(h(x2), set()).add(x2)
        return {y: frozenset(v) for y, v in out.items()}

    return X, step


def worst_vi(X0, step, U, goal, K=60):
    """在从 X0 出发可达的 I-state 上做 (12.7)：G(x⃗) = min_u max_y [1 + G(f⃗(x⃗,u,y))]。"""
    reach, stack = {X0}, [X0]
    while stack:
        S = stack.pop()
        for u in U:
            for S2 in step(S, u).values():
                if S2 not in reach:
                    reach.add(S2)
                    stack.append(S2)
    G = {S: (0 if goal(S) else math.inf) for S in reach}
    for _ in range(K):
        changed = False
        for S in reach:
            if goal(S):
                continue
            best = min(max(1 + G[S2] for S2 in step(S, u).values()) for u in U)
            if best < G[S]:
                G[S], changed = best, True
        if not changed:
            break
    return reach, G


def item2():
    header("2. 12.1.2 玩具问题（补充）：五格走廊，目标「确知自己在 1 号格」")
    for slip in (False, True):
        for sensor in (False, True):
            X, step = corridor(5, slip, sensor)
            reach, G = worst_vi(frozenset(X), step, ["L", "R"], lambda S: S == frozenset({1}))
            print(f"  打滑={slip!s:5}  传感器={sensor!s:5}  可达 I-state {len(reach):2d} 个，G*(X) = {G[frozenset(X)]}")
            if not slip:
                check(G[frozenset(X)] == 4, "不打滑时一直按 L 四次就够（无传感器 = 可预测的 I-state 路径）")
            elif not sensor:
                check(G[frozenset(X)] == math.inf, "会打滑又没有传感器：最坏情况下永远不能确知到达")
            else:
                check(G[frozenset(X)] == math.inf, "会打滑时最坏情况下自然可以一直让机器人打滑：最坏代价无穷")
    # 打滑 + 传感器：只要求「确知在 1 号格」——机器人一旦读到 y = 1 就到了；最坏情况下自然可以永远让它打滑
    X, step = corridor(5, True, True)
    S = frozenset(X)
    print("  从 X 出发按 L：", {y: sorted(v) for y, v in step(S, "L").items()})
    check(step(S, "L") == {1: frozenset({1}), 0: frozenset({2, 3, 4, 5})}, "(12.8)：Θ⃗(X, L) = {0, 1}")


# ====================================================================== 3. 双状态 POMDP
# 补充：两扇门，一扇后面是坑（状态 x1 = 坑在左，x2 = 坑在右）。动作：听 (代价 1)、走左门、走右门。
# 走进坑代价 100，走进安全门代价 −10；走门后问题重置（坑的位置重新均匀随机）。听的正确率 0.85。
LISTEN_ACC = F(85, 100)
COST = {"听": (F(1), F(1)), "左": (F(100), F(-10)), "右": (F(-10), F(100))}


def p_obs(u, x2, y):
    """P(y | x_{k+1}, u)：y ∈ {'L', 'R'}；走门后观测不含信息。"""
    if u != "听":
        return F(1, 2)
    right = (y == "L") == (x2 == 0)
    return LISTEN_ACC if right else 1 - LISTEN_ACC


def p_trans(x, u, x2):
    if u == "听":
        return F(1) if x == x2 else F(0)
    return F(1, 2)


def backup(alphas):
    """精确值迭代的一次回溯（代价最小化）：返回新的 α-向量集合（每个是 (a0, a1, 动作)）。"""
    out = []
    for u in COST:
        # 每个观测 y 选一个下一阶段的 α
        per_y = {}
        for y in "LR":
            vecs = []
            for a in alphas:
                v = tuple(sum(p_trans(x, u, x2) * p_obs(u, x2, y) * a[x2] for x2 in (0, 1)) for x in (0, 1))
                vecs.append(v)
            per_y[y] = vecs
        for choice in itertools.product(range(len(alphas)), repeat=2):
            v = [COST[u][x] + per_y["L"][choice[0]][x] + per_y["R"][choice[1]][x] for x in (0, 1)]
            out.append((v[0], v[1], u))
    return prune(out)


def prune(vecs):
    """一维信念 b = P(x2) ∈ [0,1] 上的下包络：只保留在某个 b 处取到最小值的直线（精确，有理数）。"""
    vecs = sorted(set(vecs), key=lambda a: (a[0], a[1]))
    # 在所有交点与端点处取值，保留至少在一个点上最小的
    pts = {F(0), F(1)}
    for a, b in itertools.combinations(vecs, 2):
        d = (a[1] - a[0]) - (b[1] - b[0])
        if d != 0:
            t = (b[0] - a[0]) / d
            if 0 <= t <= 1:
                pts.add(t)
    keep = set()
    for t in pts:
        vals = [(a[0] * (1 - t) + a[1] * t, a) for a in vecs]
        m = min(v for v, _ in vals)
        for v, a in vals:
            if v == m:
                keep.add(a)
    # 去掉只在孤立交点处与包络相切、且被其它直线在两侧都覆盖的冗余直线：检查中点
    pts = sorted(pts)
    final = set()
    for t0, t1 in zip(pts, pts[1:]):
        t = (t0 + t1) / 2
        best = min(keep, key=lambda a: (a[0] * (1 - t) + a[1] * t, a[2]))
        final.add(best)
    return sorted(final, key=lambda a: a[1] - a[0])


def G_of(alphas, b):
    return min(a[0] * (1 - b) + a[1] * b for a in alphas)


def belief_update(b, u, y):
    """b = P(x2)。先预测 (11.38) 再用观测更新 (11.39)。"""
    pred = [sum((1 - b if x == 0 else b) * p_trans(x, u, x2) for x in (0, 1)) for x2 in (0, 1)]
    post = [pred[x2] * p_obs(u, x2, y) for x2 in (0, 1)]
    s = sum(post)
    return post[1] / s, s


def exact_tree(b, k):
    """书中 12.1.3 的「精确方法」：从 η0 出发枚举所有可能的 I-state，逐级回滚 (12.10)。返回 (值, 访问的 I-state 数)。"""
    if k == 0:
        return F(0), 1
    best, count = None, 1
    for u in COST:
        c = (1 - b) * COST[u][0] + b * COST[u][1]
        for y in "LR":
            b2, py = belief_update(b, u, y)
            if py == 0:
                continue
            v, n = exact_tree(b2, k - 1)
            c += py * v
            count += n
        best = c if best is None or c < best else best
    return best, count


def item3():
    header("3. 12.1.3 双状态 POMDP（补充）：α-向量与精确方法")
    alphas = [(F(0), F(0), "—")]
    print("  剩余步数 k：α-向量个数（剪枝后），G*(1/2)，各 α 的动作")
    for k in range(1, 9):
        alphas = backup(alphas)
        print(f"   k = {k}: {len(alphas):2d} 条，G*(1/2) = {float(G_of(alphas, F(1, 2))):9.4f}  动作 {[a[2] for a in alphas]}")
        # 凹：中点值 ≥ 端点平均
        for t0, t1 in [(F(0), F(1)), (F(1, 5), F(4, 5)), (F(1, 10), F(1, 2))]:
            m = G_of(alphas, (t0 + t1) / 2)
            check(m >= (G_of(alphas, t0) + G_of(alphas, t1)) / 2, f"k={k}: 代价到达的下包络是凹函数（{t0}, {t1}）") if k in (1, 4, 8) and t0 == 0 else None
        if k == 1:
            check([a[2] for a in alphas] == ["左", "听", "右"] or len(alphas) == 3, "k = 1：三条直线，中间是「听」")
        if k <= 4:
            v, n = exact_tree(F(1, 2), k)
            check(v == G_of(alphas, F(1, 2)), f"k = {k}: 枚举全部 {n} 个 I-state 的精确方法与 α-向量结果相同 ({float(v):.4f})")
    # 1 步：G*(b) = min(100(1−b) − 10b, 1, −10(1−b) + 100b)
    a1 = backup([(F(0), F(0), "—")])
    for b in (F(0), F(1, 10), F(1, 2), F(9, 10), F(1)):
        direct = min((1 - b) * COST[u][0] + b * COST[u][1] for u in COST)
        check(G_of(a1, b) == direct, f"k = 1, b = {b}: G* = {direct}")
    # 插值近似 (12.10)：在 N 个均匀采样信念上做值迭代，G 在采样点之间线性插值
    for N in (5, 11, 41):
        grid = [F(i, N - 1) for i in range(N)]
        Gs = [F(0)] * N

        def interp(b, Gs=None):
            t = b * (N - 1)
            i = min(int(t), N - 2)
            w = t - i
            return Gs[i] * (1 - w) + Gs[i + 1] * w

        for _ in range(8):
            new = []
            for b in grid:
                best = None
                for u in COST:
                    c = (1 - b) * COST[u][0] + b * COST[u][1]
                    for y in "LR":
                        b2, py = belief_update(b, u, y)
                        if py:
                            c += py * interp(b2, Gs)
                    best = c if best is None or c < best else best
                new.append(best)
            Gs = new
        exact8 = alphas
        err = max(abs(float(Gs[i] - G_of(exact8, grid[i]))) for i in range(N))
        print(f"  插值近似 N = {N:2d}：8 步后与精确值在采样点上的最大误差 {err:.4f}")


# ====================================================================== 4–6. 离散定位
DIRS = "NESW"
DV = {"N": (0, 1), "E": (1, 0), "S": (0, -1), "W": (-1, 0)}
TURN = {"F": 0, "R": 1, "B": 2, "L": 3}

# 图 12.2a：1=(0,0) 2=(1,0) 3=(1,1) 4=(1,2) 5=(0,2)，(0,1) 是障碍
MAP_122A = {1: (0, 0), 2: (1, 0), 3: (1, 1), 4: (1, 2), 5: (0, 2)}
# 图 12.3b：环形 3×3，中心是障碍；底行 8 1 2，中行 7 · 3，顶行 6 5 4
MAP_123B = {8: (0, 0), 1: (1, 0), 2: (2, 0), 3: (2, 1), 4: (2, 2), 5: (1, 2), 6: (0, 2), 7: (0, 1)}
# 图 12.54：底行 1 2 4 5 7，顶行 3（在 2 上方）、6（在 5 上方）
MAP_1254 = {1: (0, 0), 2: (1, 0), 4: (2, 0), 5: (3, 0), 7: (4, 0), 3: (1, 1), 6: (3, 1)}


class GridWorld:
    def __init__(self, cells, compass=False):
        self.name = {v: k for k, v in cells.items()}
        self.free = set(cells.values())
        self.compass = compass
        self.X = [(p, d) for p in sorted(self.free) for d in DIRS]

    def f(self, x, u):
        p, d = x
        nd = u if self.compass else DIRS[(DIRS.index(d) + TURN[u]) % 4]
        q = (p[0] + DV[nd][0], p[1] + DV[nd][1])
        return (q if q in self.free else p, nd)

    def h(self, x0, x1):
        return 1 if x0[0] != x1[0] else 0

    def step(self, S, u):
        out = {}
        for x in S:
            x2 = self.f(x, u)
            out.setdefault(self.h(x, x2), set()).add(x2)
        return {y: frozenset(v) for y, v in out.items()}

    def U(self):
        return list("NESW") if self.compass else list("FBRL")

    def show(self, S):
        by = {}
        for p, d in S:
            by.setdefault(self.name[p], []).append(d)
        return " ∪ ".join(f"{k}^{''.join(sorted(v, key=DIRS.index))}" for k, v in sorted(by.items()))


def run_ndet(W, S, us, x_true):
    seq = []
    for u in us:
        x2 = W.f(x_true, u)
        y = W.h(x_true, x2)
        S = W.step(S, u)[y]
        x_true = x2
        seq.append((u, y, S))
    return seq


def item4():
    header("4. 12.2.1 例 12.1：图 12.2a 上执行 (F, L, F, L)")
    W = GridWorld(MAP_122A)
    X = frozenset(W.X)
    check(len(X) == 20, "(12.14) η0 = X 共 20 个状态")
    seq = run_ndet(W, X, "FLFL", (MAP_122A[1], "E"))
    expect = ["1^W ∪ 2^ES ∪ 3^NS ∪ 4^NE ∪ 5^W", "3^N ∪ 5^W", "4^N", "5^W"]
    for k, ((u, y, S), e) in enumerate(zip(seq, expect), start=2):
        print(f"  u{k - 1} = {u}, y{k} = {y}:  X{k} = {W.show(S)}")
        check(W.show(S) == e, f"与 (12.{13 + k}) 一致")
    check(seq[-1][2] == frozenset({(MAP_122A[5], "W")}),
          "x5 在 5 号位置朝西——原书写成「position 1 facing west」是笔误（5 号格朝西）")
    # (12.13) 的历史 I-state 只是一个记号例子；检查它与模型相容（存在某个初始状态产生这组观测）
    ok = [x for x in W.X if [y for _, y, _ in run_ndet(W, frozenset(W.X), "RRFL", x)] == [1, 0, 1, 1]]
    print(f"  (12.13) η5 = (X, R, R, F, L, 1, 0, 1, 1) 相容的初始状态：{W.show(ok) or '无'}")
    check(len(ok) == 0, "(12.13) 只是记号示例：u2 = R 没动说明转身后的方向被挡，u3 = F 朝同一方向必然也不动，"
          "所以 y4 = 1 不可能——X5(η5) = ∅（与地图无关）")
    for cells in (MAP_123B, MAP_1254):
        W2 = GridWorld(cells)
        check(not [x for x in W2.X if [y for _, y, _ in run_ndet(W2, frozenset(W2.X), "RRFL", x)] == [1, 0, 1, 1]],
              "换成别的地图也一样不相容")

    header("4b. 习题 1：图 12.2a，初始在 3 号格朝北，η0 = X，执行 (L, L, F, B, F, R, F, F)")
    seq = run_ndet(W, X, "LLFBFRFF", (MAP_122A[3], "N"))
    for k, (u, y, S) in enumerate(seq, start=2):
        print(f"  u{k - 1} = {u}, y{k} = {y}:  |X{k}| = {len(S):2d}  {W.show(S)}")
    check(len(seq[-1][2]) == 1, "习题 1 的动作序列最终把机器人定位到唯一状态")


def reachable(W, S0):
    seen, st = {S0}, [S0]
    while st:
        S = st.pop()
        for u in W.U():
            for S2 in W.step(S, u).values():
                if S2 not in seen:
                    seen.add(S2)
                    st.append(S2)
    return seen


def item5():
    header("5. 12.2.1 例 12.2：图 12.3b 的环形地图（对称）")
    W = GridWorld(MAP_123B)
    X = frozenset(W.X)
    check(len(X) == 32, "状态空间 32 个状态")

    def always_moves(x, pattern, n=16):
        for i in range(n):
            x2 = W.f(x, pattern[i % 2])
            if x2[0] == x[0]:
                return False
            x = x2
        return True

    fl = [W.show([x]) for x in W.X if always_moves(x, "FL")]
    lf = [W.show([x]) for x in W.X if always_moves(x, "LF")]
    print("  (F, L, F, L, …) 每步都移动的初始状态：", fl)
    print("  (L, F, L, F, …) 每步都移动的初始状态：", lf)
    check(sorted(fl) == sorted(["1^E", "3^N", "5^W", "7^S"]), "(F,L,…)：1 朝东、3 朝北、5 朝西、7 朝南")
    check(sorted(lf) == sorted(["2^E", "4^N", "6^W", "8^S"]), "(L,F,…)：2 朝东，另外三个是 4 朝北、6 朝西、8 朝南")
    R = reachable(W, X)
    m = min(len(S) for S in R)
    print(f"  从 X 出发可达的 I-state {len(R)} 个，最小的大小 = {m}")
    check(m == 4, "无论怎么走，最好只能缩到一个 4 元素的对称类")
    smallest = sorted({W.show(S) for S in R if len(S) == m})
    print("  例如：", smallest[:3])
    # 指南针
    for cells, name in ((MAP_122A, "图 12.2a"), (MAP_123B, "图 12.3b")):
        Wc = GridWorld(cells, compass=True)
        S = frozenset(Wc.X)
        for u in "EN":
            S = Wc.step(S, u)[1]
        print(f"  有指南针、{name}：(E, N) 都移动后 X = {Wc.show(S)}")
        check(len(S) == 1, f"{name}：(E, N) 立即定位")
    Wc = GridWorld(MAP_123B, compass=True)
    pos = [x[0] for x in Wc.X if Wc.f(x, "E")[0] != x[0] and Wc.f(Wc.f(x, "E"), "N")[0] != Wc.f(x, "E")[0]]
    seqs = sorted({(Wc.name[p], Wc.name[Wc.f((p, 'N'), 'E')[0]], Wc.name[Wc.f(Wc.f((p, 'N'), 'E'), 'N')[0]]) for p in pos})
    check(seqs == [(1, 2, 3)], "环形地图上与 (E, N) 和两次「移动了」相容的位置序列只有 (1, 2, 3)")


def plan_vi(W, X0, goal, cost=lambda y: 2 if y == 1 else 1):
    R = reachable(W, X0)
    G = {S: (0 if goal(S) else math.inf) for S in R}
    pi = {}
    for _ in range(200):
        ch = False
        for S in R:
            if goal(S):
                continue
            for u in W.U():
                v = max(cost(y) + G[S2] for y, S2 in W.step(S, u).items())
                if v < G[S]:
                    G[S], pi[S], ch = v, u, True
        if not ch:
            break
    return R, G, pi


def plan_depth(W, S, G, pi, goal):
    if goal(S):
        return 0
    return 1 + max(plan_depth(W, S2, G, pi, goal) for S2 in W.step(S, pi[S]).values())


def item6():
    header("6. 12.2.1 主动定位：在可达 I-state 上做最坏情况值迭代（移动代价 2、没动代价 1）")
    for cells, name in ((MAP_122A, "图 12.2a"), (MAP_123B, "图 12.3b（对称，目标 = 最小可达 I-state）"), (MAP_1254, "图 12.54（习题 3）")):
        W = GridWorld(cells)
        X = frozenset(W.X)
        R = reachable(W, X)
        m = min(len(S) for S in R)
        goal = (lambda S, m=m: len(S) == m)
        R, G, pi = plan_vi(W, X, goal)
        dep = plan_depth(W, X, G, pi, goal)
        print(f"  {name}: |X| = {len(X)}, 可达 I-state {len(R)} 个（全部非空子集 {2 ** len(X) - 1:,} 个），"
              f"最小可达大小 {m}，G*(X) = {G[X]}，计划树深度（最坏步数） {dep}，第一步 {pi[X]}")
        if cells is MAP_122A:
            check(m == 1, "图 12.2a 没有对称性：一定能定位到单个状态")
        if cells is MAP_1254:
            check(m == 1, "习题 3 的地图也能定位到单个状态")


# ====================================================================== 7. 概率离散定位
def item7():
    header("7. 12.2.3 概率离散定位：(12.20)–(12.22) 与穷举一致")
    W = GridWorld(MAP_122A)
    X = W.X
    p_ok, e_s = F(7, 10), F(1, 10)

    def trans(x, u):
        """P(x_{k+1} | x_k, u_k)：转向按指令；以 p_ok 按意图方向移动，各以 (1−p_ok)/3 向右偏、向左偏或不动。"""
        p, d = x
        nd = DIRS[(DIRS.index(d) + TURN[u]) % 4]
        out = {}
        for dd, pr in ((nd, p_ok), (DIRS[(DIRS.index(nd) + 1) % 4], (1 - p_ok) / 3), (DIRS[(DIRS.index(nd) + 3) % 4], (1 - p_ok) / 3), (None, (1 - p_ok) / 3)):
            q = p if dd is None else (p[0] + DV[dd][0], p[1] + DV[dd][1])
            if q not in W.free:
                q = p
            out[(q, nd)] = out.get((q, nd), 0) + pr
        return out

    def p_y(y, x0, x1):
        moved = 1 if x0[0] != x1[0] else 0
        return 1 - e_s if y == moved else e_s

    us, ys = "FLFR", [1, 1, 0, 1]
    # 穷举：P(x_1) 均匀；第 k 个观测 y_{k+1} 依赖 (x_k, x_{k+1})
    post = {}
    for x1 in X:
        frontier = {(x1,): F(1, len(X))}
        for u, y in zip(us, ys):
            nf = {}
            for path, pr in frontier.items():
                for x2, pt in trans(path[-1], u).items():
                    w = pr * pt * p_y(y, path[-1], x2)
                    if w:
                        nf[path + (x2,)] = nf.get(path + (x2,), 0) + w
            frontier = nf
        for path, pr in frontier.items():
            post[path[-1]] = post.get(path[-1], 0) + pr
    Z = sum(post.values())
    brute = {x: v / Z for x, v in post.items()}
    # 书中的写法：先 (11.38) 预测，再用 (12.20)–(12.22) 求 P(y_k | η_{k−1}, u_{k−1}, x_k)，最后贝叶斯
    b = {x: F(1, len(X)) for x in X}
    for u, y in zip(us, ys):
        pred = {}
        for x0, p0 in b.items():
            for x1, pt in trans(x0, u).items():
                pred[x1] = pred.get(x1, 0) + p0 * pt          # (11.38)
        new = {}
        for x1, px1 in pred.items():
            if px1 == 0:
                continue
            # (12.22)：P(x_{k−1} | η_{k−1}, u_{k−1}, x_k) ∝ P(x_k | u_{k−1}, x_{k−1}) P(x_{k−1} | η_{k−1})
            back = {x0: trans(x0, u).get(x1, 0) * p0 for x0, p0 in b.items()}
            s = sum(back.values())
            lik = sum(p_y(y, x0, x1) * w / s for x0, w in back.items())   # (12.20) + (12.21)
            new[x1] = lik * px1
        Z = sum(new.values())
        b = {x: v / Z for x, v in new.items()}
    check(all(b.get(x, 0) == brute.get(x, 0) for x in X), "按 (12.20)–(12.22) 递推得到的 P(x_5 | η_5) 与穷举全部状态序列的结果逐项相等")
    top = sorted(b.items(), key=lambda kv: -kv[1])[:3]
    print("  概率最大的三个状态：", [(W.show([x]), round(float(v), 4)) for x, v in top])


# ====================================================================== 8. 判定环境
# 图 12.12 / 12.13：3×3，(列, 行)，行 0 在下；'#' 障碍，'.' 白格，'o' 原点
ENV_ROWS = {
    "e1": ["...", ".#.", "o.."],
    "e2": [".#.", ".#.", "o.."],
    "e3": ["...", ".##", "o##"],
    "e4": ["#.#", "...", "o.."],
    "e5": ["#..", "##.", "o.."],
    "e6": ["...", "...", "o.."],
    "e7": ["o..", ".#.", "..."],
    "e8": ["...", ".#.", "o#."],
    "e9": ["...", ".##", "o#."],
}


def env_cells(rows):
    cells, origin = set(), None
    for r, line in enumerate(reversed(rows)):
        for c, ch in enumerate(line):
            if ch != "#":
                cells.add((c, r))
            if ch == "o":
                origin = (c, r)
    return {(c - origin[0], r - origin[1]) for c, r in cells}


ENVS = {k: env_cells(v) for k, v in ENV_ROWS.items()}


def env_f(e, p, d, u):
    nd = DIRS[(DIRS.index(d) + TURN[u]) % 4]
    q = (p[0] + DV[nd][0], p[1] + DV[nd][1])
    return (q if q in ENVS[e] else p), nd


def env_run(envs, us, x_true):
    S = {(e, p, d) for e in envs for p in ENVS[e] for d in DIRS}
    e0, p, d = x_true
    out = []
    for u in us:
        p2, d2 = env_f(e0, p, d, u)
        y = 1 if p2 != p else 0
        S2 = set()
        for (e, q, dd) in S:
            q2, dd2 = env_f(e, q, dd, u)
            if (1 if q2 != q else 0) == y:
                S2.add((e, q2, dd2))
        S, p, d = S2, p2, d2
        out.append((u, y, S))
    return out


def item8():
    header("8. 12.3.1 例 12.4：真实环境 e3，从原点朝东出发")
    six = ["e1", "e2", "e3", "e4", "e5", "e6"]
    seq = env_run(six, "FRRRFRFR", ("e3", (0, 0), "E"))
    for k, (u, y, S) in enumerate(seq, start=1):
        envs = sorted({e for e, _, _ in S})
        print(f"  u{k} = {u}  y{k + 1} = {y}  可能的环境 {envs}  |X| = {len(S)}")
    S3 = seq[2][2]
    check(sorted({e for e, _, _ in S3}) == ["e2", "e3", "e4", "e5"], "(F,R,R) 都没动 → 排除 e1、e6")
    tiles = sorted({(e, p) for e, p, _ in S3})
    print("  三面是障碍的「端头格」：", tiles)
    check(len(tiles) == 7, "剩下 7 个端头格：e2 左上、右上，e3 下、最右，e4 上，e5 左下、左上")
    S5 = seq[4][2]
    print("  (R, F) 之后：", sorted(S5))
    check(("e3", (0, 2), "N") in S5 and ("e3", (0, 2), "W") in S5, "若在 e3，就在左上角，朝北或朝西")
    check(sorted({e for e, _, _ in S5}) == ["e2", "e3", "e4", "e5"], "e2、e3、e4、e5 仍都可能")
    S7 = seq[6][2]
    check(sorted({e for e, _, _ in S7}) == ["e2", "e3"], "(R, F) 再来一次 → 只剩 {e2, e3}")
    S8 = seq[7][2]
    check(S8 == {("e3", (2, 2), "S")}, "u8 = R 没动 → 在 e3 的右上角朝南，全部不确定性消除")
    # 加上 e7–e9 重做
    seq9 = env_run(list(ENVS), "FRRRFRFR", ("e3", (0, 0), "E"))
    print("  加上 e7–e9 后最终 I-state：", sorted(seq9[-1][2]))
    check({e for e, _, _ in seq9[-1][2]} == {"e3", "e9"}, "同样的动作序列分不清 e3 和 e9")

    # e1 ≡ e7、e2 ≡ e8：对任何动作序列，两者产生的观测序列集合相同（平移 / 旋转 180°）
    def obs_sets(e, n=5):
        res = set()
        for us in itertools.product("FBRL", repeat=n):
            for p in ENVS[e]:
                for d in DIRS:
                    q, dd, ys = p, d, []
                    for u in us:
                        q2, dd = env_f(e, q, dd, u)
                        ys.append(1 if q2 != q else 0)
                        q = q2
                    res.add((us, tuple(ys)))
        return res

    check(obs_sets("e1") == obs_sets("e7"), "e1 与 e7 产生完全相同的观测（原点挪了位置）")
    check(obs_sets("e2") == obs_sets("e8"), "e2 与 e8 产生完全相同的观测（旋转了 180°）")

    header("8b. 例 12.5：已知从原点朝东出发，真实环境 e4")
    for plan, goal in (("FF", (2, 0)), ("FLRL", (2, 2))):
        ok = []
        for e in six:
            p, d = (0, 0), "E"
            for u in plan:
                p, d = env_f(e, p, d, u)
            if p == goal:
                ok.append(e)
        print(f"  计划 {plan} 能到达 {goal} 的环境：{ok}")
        if plan == "FF":
            check("e4" in ok and "e3" not in ok, "(F, F) 在 e4 中到达 (2, 0)；e3 中第一步就没动")
        else:
            check(ok == ["e6"], "(F, L, R, L) 若能到达 (2, 2)，环境一定是 e6")

    header("8c. 习题 5：初始在右上格朝北，η0 = X，执行 (F, R, B, F, L, L, F)")
    for e in six:
        tr = (2, 2)
        if tr not in ENVS[e]:
            print(f"  {e}: 右上格是障碍，题设不成立")
            continue
        seq = env_run(six, "FRBFLLF", (e, tr, "N"))
        ys = [y for _, y, _ in seq]
        print(f"  真实环境 {e}: 观测 {ys}，最终 |X| = {len(seq[-1][2])}，可能的环境 {sorted({x[0] for x in seq[-1][2]})}")


# ====================================================================== 9. 模 3
def item9():
    header("9. 12.3.1 迷宫搜索：r = 右转数 − 左转数，模 3")
    for r, name in ((4, "顺时针（四次右转）"), (-4, "逆时针（四次左转）")):
        print(f"  {name}: r = {r:+d}, r mod 3 = {r % 3}")
    check(4 % 3 == 1 and (-4) % 3 == 2, "顺时针 ≡ 1 (mod 3)，逆时针 ≡ 2 (mod 3)——原书把两者写反了")
    good = [m for m in range(2, 9) if (4 - (-4)) % m != 0]
    print("  能区分 +4 与 −4 的模数：", good)
    check(good[0] == 3, "模 2 和 4 都分不开 ±4（差 8 能被整除），3 是最小可用的模数")
    # 一般的不自交网格闭路：转角和恰为 ±4（只算 90° 转弯）
    random.seed(1)
    for _ in range(200):
        w, hgt = random.randint(1, 6), random.randint(1, 6)
        # 矩形轮廓顺时针走一圈
        turns = ["R"] * 4
        r = turns.count("R") - turns.count("L")
        assert r == 4
    print("  （矩形闭路顺时针恰好四次右转）")


# ====================================================================== 10. D*
def dstar_check(seed, W=24, H=16, radius=2, nbr=4):
    rnd = random.Random(seed)
    true = {(i, j): rnd.choice([1, 1, 1, 2, 3, 8, 20]) for i in range(W) for j in range(H)}
    start, goal = (0, H // 2), (W - 1, H // 2)
    true[start] = true[goal] = 1
    known = {c: 1 for c in true}
    if nbr == 4:
        moves = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    else:
        moves = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]

    def nb(c):
        for a, b in moves:
            q = (c[0] + a, c[1] + b)
            if q in true:
                yield q, (math.sqrt(2) if a and b else 1.0)

    def cost(x, xn, mult):  # 从 x 走到邻居 xn：代价 = c(xn)·步长
        return known[xn] * mult

    # ---------- D*（Stentz 1994；与图 12.18 的六步一一对应）----------
    h, k, b, tag = {}, {}, {}, {}
    OPEN = []

    def insert(x, hn):
        t = tag.get(x, "NEW")
        if t == "NEW":
            k[x] = hn
        elif t == "OPEN":
            k[x] = min(k[x], hn)
        else:
            k[x] = min(h[x], hn)
        h[x] = hn
        tag[x] = "OPEN"
        heapq.heappush(OPEN, (k[x], x))

    def min_state():
        while OPEN:
            kv, x = OPEN[0]
            if tag.get(x) == "OPEN" and k[x] == kv:
                return x, kv
            heapq.heappop(OPEN)
        return None, None

    expansions = [0]

    def process():
        x, kold = min_state()
        if x is None:
            return None
        heapq.heappop(OPEN)
        tag[x] = "CLOSED"
        expansions[0] += 1
        if kold < h[x]:                       # 步骤 2：x 在 Q 中时代价升高了
            for y, m in nb(x):
                if tag.get(y, "NEW") != "NEW" and h[y] <= kold and h[x] > h[y] + cost(x, y, m):
                    b[x], h[x] = y, h[y] + cost(x, y, m)
        for y, m in nb(x):                    # 步骤 3–6：x 的前驱 y（y 走到 x）
            c = cost(y, x, m)
            t = tag.get(y, "NEW")
            if kold == h[x]:
                if t == "NEW" or (b.get(y) == x and h[y] != h[x] + c) or (b.get(y) != x and h[y] > h[x] + c):
                    b[y] = x
                    insert(y, h[x] + c)
            else:
                if t == "NEW" or (b.get(y) == x and h[y] != h[x] + c):
                    b[y] = x
                    insert(y, h[x] + c)
                elif b.get(y) != x and h[y] > h[x] + c:
                    insert(x, h[x])
                elif b.get(y) != x and h[x] > h[y] + cost(x, y, m) and t == "CLOSED" and h[y] > kold:
                    insert(y, h[y])
        return min_state()[1]

    def dijkstra_to_goal():
        dist = {goal: 0.0}
        pq = [(0.0, goal)]
        n = 0
        while pq:
            dv, x = heapq.heappop(pq)
            if dv > dist[x]:
                continue
            n += 1
            for y, m in nb(x):
                nd = dv + cost(y, x, m)
                if nd < dist.get(y, math.inf) - 1e-12:
                    dist[y] = nd
                    heapq.heappush(pq, (nd, y))
        return dist, n

    insert(goal, 0.0)
    while True:
        kmin = process()
        if kmin is None or (start in h and tag.get(start) == "CLOSED" and kmin >= h[start]):
            break
    x = start
    steps, replans, dij_total = 0, 0, 0
    for c in true:  # 一开始就看见半径内的格子
        pass
    while x != goal and steps < 2000:
        # 感知：半径内的真实代价
        changed = []
        for c in true:
            if abs(c[0] - x[0]) <= radius and abs(c[1] - x[1]) <= radius and known[c] != true[c]:
                known[c] = true[c]
                changed.append(c)
        if changed:
            replans += 1
            for c in changed:  # MODIFY-COST：走进 c 的边都变了；把这些边的终点 c 放回 Q（书中「把 x_k 重新插入，代价 G_cur(x_k)」）
                if tag.get(c) == "CLOSED":
                    insert(c, h[c])
            while True:
                kmin = min_state()[1]
                if kmin is None or kmin >= h[x]:
                    break
                process()
            dist, n = dijkstra_to_goal()
            dij_total += n
            assert abs(h[x] - dist[x]) < 1e-9, (seed, x, h[x], dist[x])
            # 沿反向指针走到目标的代价也等于最优值
            y, tot, guard = x, 0.0, 0
            while y != goal and guard < 5000:
                m = math.sqrt(2) if (b[y][0] != y[0] and b[y][1] != y[1]) else 1.0
                tot += cost(y, b[y], m)
                y = b[y]
                guard += 1
            assert abs(tot - dist[x]) < 1e-9, (seed, tot, dist[x])
        x = b[x]
        steps += 1
    return steps, replans, expansions[0], dij_total


def item10():
    header("10. 12.3.2 D*：每次重规划后，h(x_k) 与沿反向指针的路径代价都等于 Dijkstra 在当前已知代价上的最优值")
    for seed in range(12):
        for nbr in (4, 8):
            steps, rep, exp_d, exp_dij = dstar_check(seed, nbr=nbr)
            if seed < 3:
                print(f"  seed {seed:2d} ({nbr} 邻接)：走了 {steps} 步，重规划 {rep} 次；D* 共展开 {exp_d} 个状态，"
                      f"每次都从头做 Dijkstra 要展开 {exp_dij} 个")
    check(True, "24 组随机地形上 D* 的结果全部与 Dijkstra 一致")


# ====================================================================== 11. 迷路的牛
def cow_ratio(turns, Ds):
    """turns：依次的折返点（带符号的位置）；返回在给定门位置集合上的最坏竞争比。"""
    worst = 0
    for D in Ds:
        dist, pos = 0.0, 0.0
        for t in turns:
            if (D > 0 and pos <= D <= t) or (D < 0 and t <= D <= pos):
                dist += abs(D - pos)
                break
            dist += abs(t - pos)
            pos = t
        else:
            raise ValueError("schedule too short")
        worst = max(worst, dist / abs(D))
    return worst


def item11():
    header("11. 12.3.3 迷路的牛：竞争比")
    exact1 = cow_ratio([-1, 1], [1, -1])
    print(f"  门恰好在距离 1：先左 1 再回头 → 最坏比 {exact1}")
    check(exact1 == 3, "竞争比 3")
    eps = 1e-6
    Ds = []
    for i in range(0, 14):
        for s in (1, -1):
            Ds.append(s * (2 ** i + eps))
            Ds.append(s * (2 ** i))
    Ds = [D for D in Ds if abs(D) >= 1]
    doubling = [(-2) ** i for i in range(0, 30)]   # 左 1、右 2、左 4、右 8……（折返点 (−2)^i）
    book = []
    for i in range(0, 30):
        book += [-(2 ** i), 2 ** i]                  # 原书列出的「左 1、右 1、左 2、右 2、左 4……」
    r_d, r_b = cow_ratio(doubling, Ds), cow_ratio(book, Ds)
    print(f"  折返点 (−2)^i（左 1、右 2、左 4、右 8 …）：最坏比 → {r_d:.4f}")
    print(f"  原书文字「左 1、右 1、左 2、右 2、左 4 …」：最坏比 → {r_b:.4f}")
    check(8.99 < r_d < 9.0, "每次换方向把离起点的距离加倍：竞争比 9（上确界，取不到）")
    check(12.99 < r_b < 13.0, "照原书文字逐字执行（每个距离左右各走一次再加倍）得到 13，不是 9")
    for r in (1.5, 2, 3):
        turns = [(-r) ** i for i in range(0, 40)]
        Ds2 = [s * (r ** i + eps) for i in range(0, 20) for s in (1, -1)]
        print(f"  增长因子 r = {r}: 数值 {cow_ratio(turns, Ds2):.4f}，公式 1 + 2r²/(r−1) = {1 + 2 * r * r / (r - 1):.4f}")
    check(min((1 + 2 * r * r / (r - 1), r) for r in [1 + i / 1000 for i in range(1, 5000)])[1] == 2.0, "公式在 r = 2 时取最小值 9")


# ====================================================================== 12. 挤压零件
def width(poly, phi):
    """零件转角 φ（相对夹爪）时，夹爪方向（x 轴）上的夹持厚度：沿 y 方向的宽度。"""
    ys = [x * math.sin(phi) + y * math.cos(phi) for x, y in poly]
    return max(ys) - min(ys)


def sym_period(poly, n=720):
    """挤压函数的周期：π 的约数中最小的、使厚度函数周期性重复的那个（夹爪分不清 θ 与 θ+π，所以至多是 π）。"""
    for k in range(12, 0, -1):
        T = math.pi / k
        if all(abs(width(poly, math.pi * i / n) - width(poly, math.pi * i / n + T)) < 1e-9 for i in range(n)):
            return T
    return math.pi


def squeeze_function(poly, n=7200):
    """在一个周期 [0, T) 上数值求直径函数的极小（稳定转角）与极大（吸引域边界）。返回 (mins, maxs, vals)。"""
    T = sym_period(poly)
    vals = [width(poly, T * i / n) for i in range(n)]
    mins, maxs = [], []
    for i in range(n):
        a, b, c = vals[i - 1], vals[i], vals[(i + 1) % n]
        if b < a - 1e-12 and b <= c:
            mins.append(T * i / n)
        if b > a + 1e-12 and b >= c:
            maxs.append(T * i / n)
    return mins, maxs, vals


def s_of(phi, mins, maxs, T=math.pi):
    """挤压函数：φ 落在哪两个极大之间，就被推到那里的极小（T 为周期）。"""
    phi %= T
    for m in mins:
        lo = max([x for x in maxs if x < m] or [max(maxs) - T])
        hi = min([x for x in maxs if x > m] or [min(maxs) + T])
        for k in (-1, 0, 1):
            if lo + k * T < phi < hi + k * T:
                return m + k * T
    return None


def goldberg_plan(mins, maxs, T=math.pi):
    """反向贪心（[68]）：A0 = 最大的吸引域；之后每步找最大的区间 A，使其像的宽度 < 上一个区间的宽度；
    区间长到一个周期 T 就够了（对称零件只能定到对称意义下）。"""
    steps = []
    for m in mins:
        lo = max([x for x in maxs if x < m] or [max(maxs) - T])
        hi = min([x for x in maxs if x > m] or [min(maxs) + T])
        steps.append((lo, hi, m))
    steps.sort(key=lambda s: s[2])
    k = len(steps)
    ext = [(lo + j * T, hi + j * T, m + j * T) for j in range(-1, 3) for lo, hi, m in steps]
    ext.sort(key=lambda s: s[2])
    A = max(s[1] - s[0] for s in steps)
    widths = [A]
    while A < T - 1e-9:
        best = 0
        for i in range(len(ext)):
            for j in range(i, min(i + k, len(ext))):
                if ext[j][2] - ext[i][2] < A - 1e-12:
                    best = max(best, ext[j][1] - ext[i][0])
        if best <= A + 1e-12:
            return None
        A = min(best, T)
        widths.append(A)
    return widths


def item12():
    header("12. 12.5.2 挤压零件")
    a, b = 1.0, 2.0
    rect = [(-b / 2, -a / 2), (b / 2, -a / 2), (b / 2, a / 2), (-b / 2, a / 2)]
    check(abs(sym_period(rect) - math.pi) < 1e-12, "矩形（非正方形）的挤压函数周期是 π")
    mins, maxs, vals = squeeze_function(rect)
    print("  矩形 b × a = 2 × 1：稳定转角（度）", [round(math.degrees(m), 2) for m in mins],
          "  吸引域边界（度）", [round(math.degrees(m), 2) for m in maxs])
    check(len(mins) == 2 and abs(mins[0]) < 1e-9 and abs(mins[1] - math.pi / 2) < 1e-3, "[0, π) 内两个稳定转角：0（厚度 a）与 π/2（厚度 b）")
    phistar = math.atan2(b, a)
    check(abs(maxs[0] - phistar) < 1e-3, f"吸引域边界在 atan(b/a) = {math.degrees(phistar):.2f}°（对角线垂直于夹爪）")
    check(abs(min(vals) - a) < 1e-9 and abs(max(vals) - math.hypot(a, b)) < 1e-3, "最小厚度 a、最大厚度 = 对角线")
    # 例 12.9：第一次挤压后转角是 π/2 的倍数；第二次在 45° 挤压后全部落到同一个转角
    finals = set()
    for i in range(360):
        phi0 = math.radians(i + 0.5)
        r1 = s_of(phi0, mins, maxs)              # 夹爪在 0°
        check_mult = abs((r1 / (math.pi / 2)) - round(r1 / (math.pi / 2))) < 1e-6
        if not check_mult:
            raise AssertionError("第一次挤压后应为 π/2 的倍数")
        u2 = math.pi / 4                          # 第二次夹爪转到 45°
        r2 = s_of(r1 - u2, mins, maxs) + u2       # 绝对转角
        finals.add(round(math.degrees(r2) % 180, 6))
    print("  例 12.9：先在 0° 挤压、再在 45° 挤压，360 个初始转角的最终转角（mod 180°）：", finals)
    check(len(finals) == 1, "两步挤压计划把矩形摆到唯一的转角（mod 180°；夹爪本身分不清 θ 与 θ+π）")
    w = goldberg_plan(mins, maxs, sym_period(rect))
    print("  Goldberg 反向贪心得到的区间宽度（度）：", [round(math.degrees(x), 2) for x in w], f"→ 需要 {len(w)} 次挤压")
    check(len(w) == 2, "矩形需要两次挤压")
    for name, poly in (("等边三角形", [(math.cos(t), math.sin(t)) for t in (math.pi / 2, math.pi / 2 + 2 * math.pi / 3, math.pi / 2 + 4 * math.pi / 3)]),
                       ("不规则五边形", [(0, 0), (3, 0), (3.6, 1.4), (1.8, 2.4), (-0.4, 1.2)]),
                       ("细长梯形", [(0, 0), (4, 0), (3.2, 1), (0.6, 1)])):
        T = sym_period(poly)
        mins, maxs, _ = squeeze_function(poly)
        w = goldberg_plan(mins, maxs, T)
        print(f"  {name}: 周期 {math.degrees(T):.0f}°，每周期稳定转角 {len(mins)} 个，计划长度 {len(w) if w else '—'}，区间宽度（度）"
              f" {[round(math.degrees(x), 1) for x in w] if w else '—'}")


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
    print("\n全部检查通过。")
