"""第 7 章参考实现：核对教程页面里出现的数值（与网页里的 JS 各自独立实现）。

只用 Python 标准库。运行：

    python3 part2/code/ch7_extensions.py

会依次打印：
  1. 图 7.2：单元不是 T 上的柱体时，「可达」没有传递性（最早到达时刻的传播）
  2. 7.1.3 节速度调节：三个示例的 X_obs 矩形，以及不同速度上限下最早到达 s = 1 的时刻
  3. 7.2.1 节：12 个 SE(3) 刚体的状态空间维数；例子 Fig 7.8：优先级规划 vs 集中式搜索
  4. 7.2.2 节立方复形：各种拓扑图组合的 0/1/2-立方体个数与欧拉示性数（核对图 7.10 的计数）
  5. 例 7.2 门卫室：12 个模式、BFS 计划里改变模式的动作序列
  6. 7.4 节：七关节平面闭环——C_clo 的维数、闭合约束 Jacobian 的秩（核对 (7.23) 后那句话），
     朴素随机取主动变量 vs 随机环生成器的成功率
  7. 例 7.4–7.6：邻居个数 2n、3^n − 1；Manhattan 最优路径条数 C(a+b, a)；
     ε = 1 时到 (π, π) 所需的最少阶段数
  8. 7.6 节：牛耕式分解与竖直分解的单元数；生成树覆盖经过的小格数 = 4 × 粗格数
  9. 7.7.2 节：开 / 关模型下 H 形走廊与之字形例子的 Pareto 最优代价向量，以及哪些点能被 (7.29) 选中
"""
import math
import random
from collections import deque
from fractions import Fraction


def section(title):
    print("\n" + "=" * 72 + "\n" + title + "\n" + "=" * 72)


# ---------------------------------------------------------------- 1. 图 7.2
def fig72():
    section("1. 图 7.2：传递性被打破")
    # (名字, q0, q1, t0, t1)，与网页默认值相同：C1 在上、C3 在下
    cells = [("C1", 0.62, 0.84, 0.50, 0.86), ("C2", 0.40, 0.62, 0.27, 0.58), ("C3", 0.18, 0.40, 0.10, 0.36)]

    def window(a, b):
        A, B = cells[a], cells[b]
        if not (abs(A[2] - B[1]) < 1e-12 or abs(A[1] - B[2]) < 1e-12):
            return None
        lo, hi = max(A[3], B[3]), min(A[4], B[4])
        return (lo, hi) if lo < hi else None

    for s in range(3):
        E = [math.inf] * 3
        E[s] = cells[s][3]
        for _ in range(3):
            for i in range(3):
                for j in range(3):
                    w = window(i, j) if i != j else None
                    if w and E[i] < w[1]:
                        E[j] = min(E[j], max(E[i], w[0]))
        naive = {s}
        Q = [s]
        while Q:
            i = Q.pop()
            for j in range(3):
                if j not in naive and window(i, j):
                    naive.add(j)
                    Q.append(j)
        print(f"  从 {cells[s][0]} 出发：真实最早到达 {[('∞' if e == math.inf else round(e, 2)) for e in E]}；"
              f"按「直接可达」传递推断能到 {sorted(cells[j][0] for j in naive)}")
    print("  → 从 C1 能到 C2、从 C2 能到 C3，但从 C1 到不了 C3（C1 最早的时刻 0.50 晚于 C3 最晚的 0.36）")


# ---------------------------------------------------------------- 2. 速度调节
ROB = dict(x0=0.08, x1=0.92, y=0.5, half=0.05)
VT = {
    "fig74": [[(0, 0.3, 0.95), (0.45, 0.3, 0.05), (0.55, 0.72, 0.05), (1, 0.72, 0.95)]],
    "elev": [[(0, 0.34, 0.05), (0.25, 0.34, 0.95), (0.5, 0.34, 0.05), (0.75, 0.34, 0.95), (1, 0.34, 0.05)],
             [(0, 0.64, 0.95), (0.2, 0.64, 0.05), (0.45, 0.64, 0.95), (0.7, 0.64, 0.05), (0.95, 0.64, 0.95), (1, 0.64, 0.8)]],
    "back": [[(0, 0.164, 0.8), (0.5625, 0.164, 0.05), (1, 0.164, 0.05)],
             [(0, 0.458, 0.95), (0.2, 0.458, 0.5), (0.56, 0.458, 0.5), (0.74, 0.458, 0.05), (1, 0.458, 0.05)],
             [(0, 0.307, 0.05), (0.0875, 0.307, 0.05), (0.7625, 0.307, 0.95), (1, 0.307, 0.95)]],
}


def xobs_rects(obs):
    band, sw, R = 2 * ROB["half"], ROB["x1"] - ROB["x0"], []
    for K in obs:
        mine = []
        for (ta, xa, ya), (tb, xb, yb) in zip(K, K[1:]):
            if abs(xa - xb) > 1e-12:   # 横移时都离机器人所在的带很远（示例就是这样设计的）
                assert abs(ya - ROB["y"]) >= band and abs(yb - ROB["y"]) >= band
                continue
            if abs(ya - yb) < 1e-12:
                if abs(ya - ROB["y"]) >= band:
                    continue
                t0, t1 = ta, tb
            else:
                f = lambda y: ta + (tb - ta) * (y - ya) / (yb - ya)
                t0, t1 = sorted((f(ROB["y"] - band), f(ROB["y"] + band)))
                t0, t1 = max(t0, ta), min(t1, tb)
                if t1 <= t0:
                    continue
            r = [t0, t1, (xa - band - ROB["x0"]) / sw, (xa + band - ROB["x0"]) / sw]
            if mine and abs(mine[-1][1] - r[0]) < 1e-9 and abs(mine[-1][2] - r[2]) < 1e-9:
                mine[-1][1] = r[1]
            else:
                mine.append(r)
        R += mine
    return R


def speed_path(R, b, NS=240, KT=240):
    """(t, s) 网格上按时间分层：每步 s 最多变 r 格（r = b·NS/KT），返回最早到达 s = 1 的时刻、是否后退过。"""
    r = int(b * NS / KT + 1e-9)
    blocked = lambda t, s: any(q[0] < t < q[1] and q[2] < s < q[3] for q in R)
    cost = {0: 0}
    parents = []
    for k in range(KT):
        t1 = (k + 1) / KT
        nc, par = {}, {}
        for s, c in cost.items():
            for d in range(-r, r + 1):
                s2 = s + d
                if not 0 <= s2 <= NS or blocked(t1, s2 / NS) or blocked(t1 - 0.5 / KT, (s + s2) / 2 / NS):
                    continue
                if c + abs(d) < nc.get(s2, math.inf):
                    nc[s2], par[s2] = c + abs(d), s
        parents.append(par)
        cost = nc
        if NS in cost:
            seq, s = [NS], NS
            for kk in range(k, -1, -1):
                s = parents[kk][s]
                seq.append(s)
            seq.reverse()
            back = any(b2 < a2 for a2, b2 in zip(seq, seq[1:]))
            return (k + 1) / KT, back
    return None, False


def velocity_tuning():
    section("2. 速度调节（式 7.5，图 7.4、7.5）")
    for name, obs in VT.items():
        R = xobs_rects(obs)
        print(f"  {name}: X_obs 矩形 (t0, t1, s0, s1) = " + ", ".join("(" + ", ".join(f"{v:.3f}" for v in q) + ")" for q in R))
        for b in (1, 2, 3, 4, 6):
            arr, back = speed_path(R, b)
            print(f"      b = {b}: " + ("到不了" if arr is None else f"最早 t = {arr:.3f}" + ("，路径沿 τ 后退过" if back else "")))


# ---------------------------------------------------------------- 3. 多机器人
def multi_robot():
    section("3. 多机器人：维数与优先级规划（图 7.8）")
    print(f"  12 个刚体、每个 C^i = SE(3)：dim X = 6 × 12 = {6 * 12}")
    cells = [(x, 0) for x in range(10)] + [(4, 1)]
    idx = {c: i for i, c in enumerate(cells)}
    nb = [[idx[(x + a, y + b)] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + a, y + b) in idx] for x, y in cells]
    s1, g1, s2, g2 = idx[(6, 0)], idx[(3, 0)], idx[(0, 0)], idx[(9, 0)]

    def solo(s, g):
        prev, Q = {s: None}, deque([s])
        while Q:
            u = Q.popleft()
            for v in nb[u]:
                if v not in prev:
                    prev[v] = u
                    Q.append(v)
        p, c = [], g
        while c is not None:
            p.append(c)
            c = prev[c]
        return p[::-1]

    def low(s, g, hi, T=40):
        at = lambda t: hi[min(t, len(hi) - 1)]
        start = (s, 0)
        seen, Q = {start}, deque([start])
        while Q:
            c, t = Q.popleft()
            if c == g and all(at(k) != g for k in range(t, len(hi) + 1)):
                return True
            if t >= T:
                continue
            for v in [c] + nb[c]:
                if v != at(t + 1) and not (v == at(t) and at(t + 1) == c) and (v, t + 1) not in seen:
                    seen.add((v, t + 1))
                    Q.append((v, t + 1))
        return False

    def central():
        start, goal = (s1, s2), (g1, g2)
        dist, Q = {start: 0}, deque([start])
        while Q:
            a, b = Q.popleft()
            if (a, b) == goal:
                return dist[goal]
            for a2 in [a] + nb[a]:
                for b2 in [b] + nb[b]:
                    if a2 != b2 and not (a2 == b and b2 == a) and (a2, b2) not in dist:
                        dist[(a2, b2)] = dist[(a, b)] + 1
                        Q.append((a2, b2))
        return None

    print(f"  A¹ 优先：A² 能否在 A¹ 的计划下找到解？ {low(s2, g2, solo(s1, g1))}")
    print(f"  A² 优先：A¹ 能否在 A² 的计划下找到解？ {low(s1, g1, solo(s2, g2))}")
    print(f"  集中式（{len(cells)}² = {len(cells) ** 2} 个状态）：最短联合计划 {central()} 步")


# ---------------------------------------------------------------- 4. 立方复形
def cube_complex():
    section("4. 固定路线图协调的立方复形（图 7.10、习题 5、7）")
    G = {
        "一条路径": (2, [(0, 1)]),
        "两条首尾相接": (3, [(0, 1), (1, 2)]),
        "T/Y 形": (4, [(0, 2), (1, 2), (2, 3)]),
        "三角形": (3, [(0, 1), (1, 2), (2, 0)]),
    }
    for n1, (V1, E1) in G.items():
        for n2, (V2, E2) in G.items():
            c0, c1, c2 = V1 * V2, V1 * len(E2) + len(E1) * V2, len(E1) * len(E2)
            use = {}
            for i, e1 in enumerate(E1):
                for j, e2 in enumerate(E2):
                    for key in (("v", e1[0], "e", j), ("v", e1[1], "e", j), ("e", i, "v", e2[0]), ("e", i, "v", e2[1])):
                        use[key] = use.get(key, 0) + 1
            assert len(use) == c1   # 每条棱都至少是一个正方形的面（立方复形定义的第 1 条）
            chi1, chi2 = V1 - len(E1), V2 - len(E2)
            assert c0 - c1 + c2 == chi1 * chi2
            mx = max(use.values())
            print(f"  G₁ = {n1:6s} G₂ = {n2:6s}: 0/1/2-立方体 = {c0:2d}/{c1:2d}/{c2:2d}，χ = {c0 - c1 + c2:2d}，一条棱最多被 {mx} 个正方形共用")
    print("  → 图 7.10（T 形 × 一条路径）是 8 个角点、10 条棱、3 个正方形；原书写的「one 1-cube」只数了公共的那条书脊")
    print("  → 三角形 × 三角形：9/18/9，χ = 0，每条棱恰被 2 个正方形共用——环面 T²（习题 5a）")


# ---------------------------------------------------------------- 5. 门卫室
PORT = [
    "################",
    "#PP............#",
    "#PP............#",
    "#...############",
    "#...#.........##",
    "#...#.........##",
    "#S..#...###2####",
    "#...#...#......#",
    "#...1...#......#",
    "#...#...#...G..#",
    "#...#...#......#",
    "################"]


def portiernia():
    section("5. 例 7.2 门卫室：X = C × M，|M| = 3 × 4 = 12")
    H = len(PORT)
    at = lambda x, y: PORT[H - 1 - y][x]
    find = lambda ch: next((x, y) for y in range(H) for x in range(16) if at(x, y) == ch)
    S, Gl, D = find("S"), find("G"), {1: find("1"), 2: find("2")}
    for ret in (False, True):
        start = (S, 0, 0, 0)
        prev, Q = {start: None}, deque([start])
        goal = None
        while Q:
            st = Q.popleft()
            (x, y), k, d1, d2 = st
            if (x, y) == Gl and (not ret or k == 0):
                goal = st
                break
            nxt = []
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c = at(x + a, y + b)
                if c == "#" or (c == "1" and not d1) or (c == "2" and not d2):
                    continue
                nxt.append((((x + a, y + b), k, d1, d2), None))
            if at(x, y) == "P":
                for k2 in (0, 1, 2):
                    if k2 != k:
                        nxt.append((((x, y), k2, d1, d2), "还钥匙" if k2 == 0 else (f"换成钥匙 {k2}" if k else f"取钥匙 {k2}")))
            for i in (1, 2):
                dx, dy = D[i]
                if k == i and abs(dx - x) + abs(dy - y) == 1 and not (d1 if i == 1 else d2):
                    nxt.append((((x, y), k, 1 if i == 1 else d1, 1 if i == 2 else d2), f"开门 {i}"))
            for s2, lab in nxt:
                if s2 not in prev:
                    prev[s2] = (st, lab)
                    Q.append(s2)
        acts, n, c = [], 0, goal
        while prev[c] is not None:
            c, lab = prev[c]
            n += 1
            if lab:
                acts.append(lab)
        print(f"  {'要还钥匙' if ret else '不必还钥匙'}：{n} 步；改变模式的动作：{' → '.join(reversed(acts))}")


# ---------------------------------------------------------------- 6. 闭链
L0, LS = 4.2, [1.1, 1.0, 1.0, 1.0, 1.0, 1.1]


def chain_points(q):
    """七个关节角 q（第 i 根连杆相对前一根的转角，第 1 根相对地面），返回各关节位置。"""
    pts, x, y, a = [(0.0, 0.0)], 0.0, 0.0, 0.0
    for qi, l in zip(q, LS):
        a += qi
        x, y = x + l * math.cos(a), y + l * math.sin(a)
        pts.append((x, y))
    return pts, a


def closure(q):
    """闭合约束：链的末端回到 (L0, 0)，且最后一个关节转完回到地面方向（三个方程）。"""
    pts, a = chain_points(q[:6])
    return [pts[-1][0] - L0, pts[-1][1], math.remainder(a + q[6] - math.pi, 2 * math.pi)]


def rank(M, tol=1e-8):
    M = [row[:] for row in M]
    r, cols = 0, len(M[0])
    for c in range(cols):
        p = max(range(r, len(M)), key=lambda i: abs(M[i][c]), default=None)
        if p is None or abs(M[p][c]) < tol:
            continue
        M[r], M[p] = M[p], M[r]
        for i in range(len(M)):
            if i != r:
                f = M[i][c] / M[r][c]
                M[i] = [u - f * v for u, v in zip(M[i], M[r])]
        r += 1
        if r == len(M):
            break
    return r


def closed_chain():
    section("6. 七关节平面闭环（图 7.23–7.25）")
    # 先找一个闭合的构型：主动变量 q1..q3、q7 取定，被动的三个由两连杆逆运动学求出
    rnd = random.Random(1)
    q = None
    while q is None:
        qa = [rnd.uniform(-math.pi, math.pi) for _ in range(4)]
        P3 = chain_points(qa[:3])[0][-1]
        a7 = qa[3]
        P5 = (L0 + LS[5] * math.cos(a7), LS[5] * math.sin(a7))
        d = math.dist(P3, P5)
        if abs(LS[3] - LS[4]) < d < LS[3] + LS[4]:
            a = (LS[3] ** 2 - LS[4] ** 2 + d * d) / (2 * d)
            hh = math.sqrt(LS[3] ** 2 - a * a)
            P4 = (P3[0] + a * (P5[0] - P3[0]) / d - hh * (P5[1] - P3[1]) / d, P3[1] + a * (P5[1] - P3[1]) / d + hh * (P5[0] - P3[0]) / d)
            pts = chain_points(qa[:3])[0] + [P4, P5, (L0, 0.0)]
            abs_ang = [math.atan2(b[1] - a_[1], b[0] - a_[0]) for a_, b in zip(pts, pts[1:])]
            rel = [abs_ang[0]] + [math.remainder(abs_ang[i] - abs_ang[i - 1], 2 * math.pi) for i in range(1, 6)]
            q = rel + [math.remainder(math.pi - sum(rel), 2 * math.pi)]
    res = closure(q)
    print(f"  找到一个闭合构型，约束残差 {max(abs(v) for v in res):.1e}")
    J = []
    for f in range(3):
        row = []
        for i in range(7):
            e = 1e-6
            qp, qm = q[:], q[:]
            qp[i] += e
            qm[i] -= e
            row.append((closure(qp)[f] - closure(qm)[f]) / (2 * e))
        J.append(row)
    rk = rank(J, 1e-6)
    print(f"  n = dim C = 7，Jacobian (7.23) 是 3×7，秩 = {rk}，所以 m = dim C_clo = n − 秩 = {7 - rk}")
    print("  → 能独立选的位移个数是 m = n − 秩；原书写成「秩为 m 时可以独立选 m 个」是笔误（秩应为 n − m）")
    # 朴素随机 vs 环生成器
    rnd = random.Random(2024)

    def annulus(ls):
        S, M = sum(ls), max(ls)
        return max(0.0, 2 * M - S), S

    def closes(qa):
        P3 = chain_points(qa[:3])[0][-1]
        P5 = (L0 + LS[5] * math.cos(qa[3]), LS[5] * math.sin(qa[3]))
        d = math.dist(P3, P5)
        return abs(LS[3] - LS[4]) <= d <= LS[3] + LS[4]

    N, naive, gen = 1500, 0, 0
    cand = [-math.pi + 2 * math.pi * (i + 0.5) / 360 for i in range(360)]
    for _ in range(N):
        naive += closes([rnd.uniform(-math.pi, math.pi) for _ in range(4)])
        qa = []
        for k in range(4):
            ok = []
            for c in cand:
                trial = qa + [c]
                if k < 3:
                    P = chain_points(trial)[0][-1]
                    lo, hi = annulus(LS[k + 1:])
                    if lo - 1e-9 <= math.dist(P, (L0, 0)) <= hi + 1e-9:
                        ok.append(c)
                else:
                    if closes(trial):
                        ok.append(c)
            qa.append(rnd.choice(ok))
        gen += closes(qa)
    print(f"  {N} 次：朴素随机能闭合 {100 * naive / N:.1f}%，随机环生成器 {100 * gen / N:.1f}%（关节无限位，圆环界是精确的）")


# ---------------------------------------------------------------- 7. 动作模型
def motion_models():
    section("7. 例 7.4–7.6：动作模型")
    for n in (2, 3, 6):
        print(f"  n = {n}: Manhattan 有 2n = {2 * n} 个动作，independent-joint 有 3^n − 1 = {3 ** n - 1} 个非零动作")
    # 空旷网格上 Manhattan 最优路径条数 = C(a+b, a)
    for a, b in ((4, 6), (10, 10)):
        cnt = [[0] * (b + 1) for _ in range(a + 1)]
        for i in range(a + 1):
            for j in range(b + 1):
                cnt[i][j] = 1 if i == 0 or j == 0 else cnt[i - 1][j] + cnt[i][j - 1]
        print(f"  从 (0,0) 到 ({a},{b}) 的最短 Manhattan 路径有 {cnt[a][b]} 条 = C({a + b},{a}) = {math.comb(a + b, a)}")
    d = math.pi * math.sqrt(2)
    k = max(2, math.ceil(d))
    rem = d - (k - 2)
    th = math.pi / 4
    al = math.acos(rem / 2)
    steps = [th] * (k - 2) + [th + al, th - al]
    x = sum(math.cos(s) for s in steps)
    y = sum(math.sin(s) for s in steps)
    print(f"  |(π, π)| = π√2 = {d:.4f}；k ≥ 2 步可达集合是半径 k 的闭圆盘，所以 {k} 步可以恰好到达："
          f"终点 = ({x:.12f}, {y:.12f})")
    # 再随机验证一下：两个单位向量之和的长度遍布 [0, 2]
    rnd = random.Random(0)
    lens = sorted(math.hypot(math.cos(a) + math.cos(b), math.sin(a) + math.sin(b)) for a, b in ((rnd.uniform(0, 2 * math.pi), rnd.uniform(0, 2 * math.pi)) for _ in range(20000)))
    print(f"  两个随机单位向量之和的长度：最小 {lens[0]:.4f}，最大 {lens[-1]:.4f}")


# ---------------------------------------------------------------- 8. 覆盖
OUTER = [(0.5, 0.3), (9.6, 0.3), (9.0, 6.7), (0.1, 6.7)]
OBS = [[(2.0, 1.6), (4.4, 1.1), (3.4, 2.9), (4.4, 4.6), (2.2, 5.0)], [(5.6, 4.4), (7.6, 2.0), (8.2, 5.4), (7.0, 4.9)]]


def in_poly(p, P):
    c = False
    for (ax, ay), (bx, by) in zip(P, P[-1:] + P[:-1]):
        if (ay > p[1]) != (by > p[1]) and p[0] < (bx - ax) * (p[1] - ay) / (by - ay) + ax:
            c = not c
    return c


def free_intervals(x):
    ys = []
    for P in [OUTER] + OBS:
        for (ax, ay), (bx, by) in zip(P, P[-1:] + P[:-1]):
            if ax <= x < bx or bx <= x < ax:
                ys.append(ay + (by - ay) * (x - ax) / (bx - ax))
    ys.sort()
    out = []
    for a, b in zip(ys, ys[1:]):
        m = (x, (a + b) / 2)
        if b - a > 1e-9 and in_poly(m, OUTER) and not any(in_poly(m, P) for P in OBS):
            out.append((a, b))
    return out


def decompose(vertical):
    verts = [v for P in [OUTER] + OBS for v in P]
    xs = sorted({round(v[0], 9) for v in verts})
    pieces = [(k, lo, hi) for k in range(len(xs) - 1) for lo, hi in free_intervals((xs[k] + xs[k + 1]) / 2)]
    parent = list(range(len(pieces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    ov = lambda a, b: min(pieces[a][2], pieces[b][2]) - max(pieces[a][1], pieces[b][1]) > 1e-9
    for k in range(len(xs) - 2):
        L = [i for i, p in enumerate(pieces) if p[0] == k]
        R = [i for i, p in enumerate(pieces) if p[0] == k + 1]
        for a in L:
            for b in R:
                if not ov(a, b):
                    continue
                cut = sum(ov(a, c) for c in R) != 1 or sum(ov(c, b) for c in L) != 1
                if not cut and vertical:
                    lo, hi = min(pieces[a][1], pieces[b][1]), max(pieces[a][2], pieces[b][2])
                    cut = any(abs(v[0] - xs[k + 1]) < 1e-9 and lo - 1e-9 <= v[1] <= hi + 1e-9 for v in verts)
                if not cut:
                    parent[find(a)] = find(b)
    return len({find(i) for i in range(len(pieces))})


STC = ["##############", "##....########", "#........#####", "#.............#", "##.....##.....",
       "###....##....#", "#.............", "#............#", "##########...#"]


def coverage():
    section("8. 覆盖规划")
    print(f"  牛耕式分解：{decompose(False)} 个单元；竖直分解（6.2.2 节）：{decompose(True)} 个单元")
    rows = [r.ljust(14, "#")[:14] for r in STC]
    H = len(rows)
    free = {(x, H - 1 - r) for r, row in enumerate(rows) for x, ch in enumerate(row) if ch == "."}
    start = (1, H - 3)
    seen, Q = {start}, deque([start])
    tree = []
    while Q:
        x, y = Q.popleft()
        for a, b in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            c = (x + a, y + b)
            if c in free and c not in seen:
                seen.add(c)
                tree.append(((x, y), c))
                Q.append(c)
    # 子格图：每个粗格先连一圈，再在树边处交叉连接；检查每个子格度数为 2 且构成一个圈
    E = set()
    sub = lambda X, Y: (X, Y)
    for x, y in seen:
        BL, BR, TL, TR = sub(2 * x, 2 * y), sub(2 * x + 1, 2 * y), sub(2 * x, 2 * y + 1), sub(2 * x + 1, 2 * y + 1)
        for e in ((TL, TR), (TR, BR), (BR, BL), (BL, TL)):
            E.add(frozenset(e))
    for u, v in tree:
        (ax, ay), (bx, by) = sorted([u, v], key=lambda c: (c[1], c[0]))
        if ay == by:
            E -= {frozenset((sub(2 * ax + 1, 2 * ay + 1), sub(2 * ax + 1, 2 * ay))), frozenset((sub(2 * bx, 2 * by + 1), sub(2 * bx, 2 * by)))}
            E |= {frozenset((sub(2 * ax + 1, 2 * ay + 1), sub(2 * bx, 2 * by + 1))), frozenset((sub(2 * ax + 1, 2 * ay), sub(2 * bx, 2 * by)))}
        else:
            E -= {frozenset((sub(2 * ax, 2 * ay + 1), sub(2 * ax + 1, 2 * ay + 1))), frozenset((sub(2 * bx, 2 * by), sub(2 * bx + 1, 2 * by)))}
            E |= {frozenset((sub(2 * ax, 2 * ay + 1), sub(2 * bx, 2 * by))), frozenset((sub(2 * ax + 1, 2 * ay + 1), sub(2 * bx + 1, 2 * by)))}
    nb = {}
    for e in E:
        a, b = tuple(e)
        nb.setdefault(a, []).append(b)
        nb.setdefault(b, []).append(a)
    assert all(len(v) == 2 for v in nb.values())
    s0 = (2 * start[0], 2 * start[1])
    prev, cur, n = None, s0, 0
    while True:
        nxt = nb[cur][0] if nb[cur][0] != prev else nb[cur][1]
        prev, cur, n = cur, nxt, n + 1
        if cur == s0:
            break
    print(f"  生成树覆盖：连通的粗格 {len(seen)} 个（自由粗格共 {len(free)} 个），沿树外围的圈经过 {n} 个小格 = 4 × {len(seen)}")


# ---------------------------------------------------------------- 9. Pareto
def poly_at(P, s):
    L = sum(math.dist(a, b) for a, b in zip(P, P[1:])) * s
    acc = 0.0
    for a, b in zip(P, P[1:]):
        d = math.dist(a, b)
        if acc + d >= L - 1e-12:
            t = (L - acc) / d if d else 0
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        acc += d
    return P[-1]


def pareto(P1, P2, r, h=0.25):
    L1 = sum(math.dist(a, b) for a, b in zip(P1, P1[1:]))
    L2 = sum(math.dist(a, b) for a, b in zip(P2, P2[1:]))
    N1, N2 = round(L1 / h), round(L2 / h)
    A = [poly_at(P1, i / (2 * N1)) for i in range(2 * N1 + 1)]
    B = [poly_at(P2, j / (2 * N2)) for j in range(2 * N2 + 1)]
    coll = lambda i2, j2: math.dist(A[i2], B[j2]) < 2 * r
    lab = {(0, 0): {(0, 0)}}
    for i in range(N1 + 1):
        for j in range(N2 + 1):
            for w in list(lab.get((i, j), ())):
                for di, dj in ((1, 1), (1, 0), (0, 1)):
                    a, b = i + di, j + dj
                    if a > N1 or b > N2 or coll(2 * a, 2 * b) or coll(2 * i + di, 2 * j + dj):
                        continue
                    nw = (w[0] + (1 if di == 0 and i < N1 else 0), w[1] + (1 if dj == 0 and j < N2 else 0))
                    S = lab.setdefault((a, b), set())
                    if any(x[0] <= nw[0] and x[1] <= nw[1] for x in S):
                        continue
                    S -= {x for x in S if nw[0] <= x[0] and nw[1] <= x[1]}
                    S.add(nw)
    front = sorted(lab.get((N1, N2), ()))
    out = []
    for p in front:
        # 能被某个 α > 0 的 (7.29) 选中 ⇔ 不在两个别的 Pareto 点连线的上方
        sup = not any(a[0] < p[0] < b[0] and a[1] + (b[1] - a[1]) * (p[0] - a[0]) / (b[0] - a[0]) < p[1] for a in front for b in front)
        out.append((tuple(Fraction(v) * Fraction(h).limit_denominator() for v in p), sup))
    return out


def pareto_examples():
    section("9. Pareto 最优协调（开 / 关模型，L_i = 停着等待的总时间）")
    H1 = [(0, 8), (0, 4), (6, 4), (6, 0)]
    H2 = [(6, 8), (6, 4), (0, 4), (0, 0)]
    Z1 = [(0, 4), (14, 4)]
    Z2 = [(1.6, 6.7), (5.5, 1.9), (8.4, 6.1), (12.2, 1.7)]
    for name, (P1, P2, r) in {"H 形走廊（图 7.42）": (H1, H2, 0.45), "之字形三次穿越": (Z1, Z2, 1.0)}.items():
        F = pareto(P1, P2, r)
        print(f"  {name}: " + "、".join(f"({float(a):g}, {float(b):g})" + ("" if s else " ← 任何正权重都选不中") for (a, b), s in F))


if __name__ == "__main__":
    fig72()
    velocity_tuning()
    multi_robot()
    cube_complex()
    portiernia()
    closed_chain()
    motion_models()
    coverage()
    pareto_examples()
