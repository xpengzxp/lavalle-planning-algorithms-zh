"""第 8 章参考实现：核对教程页面里出现的数值与「原书笔误」。

只用 Python 标准库。运行：

    python3 part2/code/ch8_feedback.py

会依次打印：
  1. 例 8.2 / 图 8.3：用 wavefront（图 8.4）在图 8.2a 的网格上算导航函数，与书中数字逐格对照
  2. 例 8.1 / 图 8.2b：书中反馈计划的每个箭头都让 φ 减 1；哪些箭头可以换成别的最优箭头
  3. 导航函数的三条性质：最优 cost-to-go 满足；忽略障碍的曼哈顿距离在哪里出现局部极小
  4. Dial 算法（整数代价的桶）与 Dijkstra 结果一致；2-邻域代价 5/7 时同时非空的桶数
  5. NF2（最大间隙导航函数）：在教程互动图的地图上，沿 NF2 与沿最短路径的最小间隙
  6. 例 8.9、8.10：积分曲线的解析解 vs RK4 / Euler 数值积分
  7. 例 8.14：(8.26) 原书写法与改正写法；S¹ 上的坐标变换 φ_1^- ∘ (φ_2^+)^{-1}
  8. 例 8.16：S² 的切空间基向量 (8.35)(8.36) 与法向量
  9. 8.4.4：Lipschitz 常数与加速度界（速度不是 1 时 C < a_max 不够）
 10. 8.4.4：Rimon–Koditschek 导航函数在教程「球形世界」里的临界点个数随 k 的变化
 11. 8.4.4：调和势函数的 Gauss–Seidel 迭代次数；离散极大值原理（没有内部局部极小）
 12. 8.4.3：教程多边形里的最优导航函数（可见性 + 路点），与可见图上的 Dijkstra 对照
 13. 8.5.1：式 (8.53) 的椭球条件并不保证无碰撞（反例），改用 √(Δx²+Δy²)+r|Δθ| < d
 14. 8.5.2：(8.58) 的 α：原书写法在 x = s_{i+1} 处不为 0；多线性插值 vs 单纯形插值
 15. 8.5.2：带插值的值迭代（无障碍时与欧氏距离对照；Δt 太小时点目标让所有值保持 ∞）
 16. 8.5.2：教程「带插值的值迭代」互动图的默认场景：值迭代 vs 类 Dijkstra 的求值次数与结果差异
 17. 8.4.4：教程「加速度控制模型」互动图：拐弯过渡宽度 w、a_max 与能否到达
 18. 8.4.4：教程「调和势函数」互动图的 64×40 网格：两种边界条件下 Gauss–Seidel 的轮数
"""
import heapq
import math
import random

INF = math.inf


# ====================================================================== 1–3 离散网格
# 图 8.2a：10×10 网格，从上到下逐行；# 为障碍，G 为目标 x_G
BOOK_GRID = [
    "..........",
    "..######..",
    "..######..",
    "..........",
    "..........",
    "#######...",
    "#######...",
    ".....##...",
    "..G..##...",
    "..........",
]
# 图 8.3 中印出的数（None = 障碍）
_ = None
BOOK_FIG83 = [
    [22, 21, 22, 21, 20, 19, 18, 17, 16, 17],
    [21, 20, _, _, _, _, _, _, 15, 16],
    [20, 19, _, _, _, _, _, _, 14, 15],
    [19, 18, 17, 16, 15, 14, 13, 12, 13, 14],
    [18, 17, 16, 15, 14, 13, 12, 11, 12, 13],
    [_, _, _, _, _, _, _, 10, 11, 12],
    [_, _, _, _, _, _, _, 9, 10, 11],
    [3, 2, 1, 2, 3, _, _, 8, 9, 10],
    [2, 1, 0, 1, 2, _, _, 7, 8, 9],
    [3, 2, 1, 2, 3, 4, 5, 6, 7, 8],
]
# 图 8.2b 的箭头：U D L R，T = u_T
BOOK_FIG82B = [
    "DDLRRRRRDD",
    "DD######DD",
    "DD######DD",
    "RRRRRRRDDD",
    "RRRRRRRDDD",
    "#######DDD",
    "#######DDD",
    "RRDLL##DDD",
    "RRTLL##DDD",
    "RRULLLLLLL",
]
MOVES4 = {"U": (-1, 0), "D": (1, 0), "L": (0, -1), "R": (0, 1)}


def parse_grid(rows):
    free = [[ch != "#" for ch in r] for r in rows]
    goals = [(i, j) for i, r in enumerate(rows) for j, ch in enumerate(r) if ch == "G"]
    return free, goals


def wavefront(free, goals, moves=((1, 0), (-1, 0), (0, 1), (0, -1))):
    """图 8.4 的 WAVEFRONT PROPAGATION ALGORITHM：W_0 = X_G，φ(x) = i 对 x ∈ W_i。"""
    H, W = len(free), len(free[0])
    phi = [[INF] * W for _ in range(H)]
    Wi = list(goals)
    for (i, j) in Wi:
        phi[i][j] = 0
    i_val = 0
    waves = [list(Wi)]
    while Wi:
        nxt = []
        for (r, c) in Wi:
            for dr, dc in moves:
                a, b = r + dr, c + dc
                if 0 <= a < H and 0 <= b < W and free[a][b] and phi[a][b] == INF:
                    phi[a][b] = i_val + 1
                    nxt.append((a, b))
        i_val += 1
        Wi = nxt
        if Wi:
            waves.append(list(Wi))
    return phi, waves


def section1():
    print("=" * 72)
    print("1. 例 8.2 / 图 8.3：wavefront 在图 8.2a 网格上算出的 φ，与书中数字对照")
    free, goals = parse_grid(BOOK_GRID)
    phi, waves = wavefront(free, goals)
    mism = 0
    for i in range(10):
        row = []
        for j in range(10):
            v = phi[i][j]
            b = BOOK_FIG83[i][j]
            if not free[i][j]:
                row.append(" ##")
                continue
            row.append(f"{v:>3}")
            if b != v:
                mism += 1
        print("   " + "".join(row))
    print(f"   与图 8.3 不一致的格子数：{mism}（0 = 完全一致）；wavefront 共 {len(waves)} 层 W_0..W_{len(waves)-1}")
    print(f"   各层大小 |W_i|：{[len(w) for w in waves]}")
    return phi


def section2(phi):
    print("\n2. 例 8.1 / 图 8.2b：书中计划的每个箭头都让 φ 减 1 吗？哪些格子有不止一个最优动作？")
    bad, multi = [], []
    for i in range(10):
        for j in range(10):
            a = BOOK_FIG82B[i][j]
            if a == "#":
                continue
            if a == "T":
                assert phi[i][j] == 0
                continue
            di, dj = MOVES4[a]
            if phi[i + di][j + dj] != phi[i][j] - 1:
                bad.append((i, j, a))
            opts = [k for k, (di2, dj2) in MOVES4.items()
                    if 0 <= i + di2 < 10 and 0 <= j + dj2 < 10 and phi[i + di2][j + dj2] == phi[i][j] - 1]
            if len(opts) > 1:
                multi.append(((i, j), "".join(sorted(opts))))
    print(f"   不是最优的箭头：{bad if bad else '没有（图 8.2b 是一个最优计划）'}")
    print(f"   有 {len(multi)} 个格子存在两个最优动作（行, 列 从 0 开始，从上往下数）：")
    for k in range(0, len(multi), 6):
        print("     " + "  ".join(f"{p}:{o}" for p, o in multi[k:k + 6]))
    n_plans = 2 ** len(multi)
    print(f"   于是最优反馈计划一共有 2^{len(multi)} = {n_plans} 个（每个格子独立选）")


def section3(phi):
    print("\n3. 导航函数的三条性质（各向同性：l(x,u)=1）")
    free, goals = parse_grid(BOOK_GRID)
    gi, gj = goals[0]

    def check(pot, name):
        c1 = all(pot[i][j] == 0 for (i, j) in goals)
        c3_bad = []
        for i in range(10):
            for j in range(10):
                if not free[i][j] or (i, j) in goals:
                    continue
                best = min((pot[i + di][j + dj] for di, dj in MOVES4.values()
                            if 0 <= i + di < 10 and 0 <= j + dj < 10 and free[i + di][j + dj]), default=INF)
                if not best < pot[i][j]:
                    c3_bad.append((i, j))
        print(f"   {name}: 性质 1 {'✓' if c1 else '✗'}；性质 3 违反的格子 {c3_bad if c3_bad else '无'}")

    check(phi, "最优 cost-to-go（图 8.3）")
    man = [[abs(i - gi) + abs(j - gj) for j in range(10)] for i in range(10)]
    check(man, "忽略障碍的曼哈顿距离")
    print("   （例如 (4,2)：下面是障碍，左、右、上都比它大 —— 局部极小，局部算子在这里停住，所以不是导航函数）")


# ---------------------------------------------------------------------- 4 Dial
def dijkstra_grid(cost, free, goal, moves):
    H, W = len(free), len(free[0])
    d = [[INF] * W for _ in range(H)]
    d[goal[0]][goal[1]] = 0
    pq = [(0, goal)]
    while pq:
        v, (i, j) = heapq.heappop(pq)
        if v > d[i][j]:
            continue
        for (di, dj, w) in moves:
            a, b = i + di, j + dj
            if 0 <= a < H and 0 <= b < W and free[a][b]:
                nv = v + w * cost[a][b]
                if nv < d[a][b]:
                    d[a][b] = nv
                    heapq.heappush(pq, (nv, (a, b)))
    return d


def dial_grid(cost, free, goal, moves):
    """Dial 算法：按 cost-to-go 的整数值分桶，最小桶里的状态可以并行处理。"""
    H, W = len(free), len(free[0])
    d = [[INF] * W for _ in range(H)]
    d[goal[0]][goal[1]] = 0
    buckets = {0: [goal]}
    cur, max_nonempty = 0, 1
    while buckets:
        while cur not in buckets:
            cur += 1
        items = buckets.pop(cur)
        for (i, j) in items:
            if d[i][j] != cur:
                continue  # 过时的条目
            for (di, dj, w) in moves:
                a, b = i + di, j + dj
                if 0 <= a < H and 0 <= b < W and free[a][b]:
                    nv = cur + w * cost[a][b]
                    if nv < d[a][b]:
                        d[a][b] = nv
                        buckets.setdefault(nv, []).append((a, b))
        # 处理完当前桶时，它本身加上仍在等待的桶，就是同时「活着」的桶
        max_nonempty = max(max_nonempty, len(buckets) + 1)
    return d, max_nonempty


def section4():
    print("\n4. Dial 算法 vs Dijkstra")
    rnd = random.Random(8)
    H, W = 30, 40
    free = [[rnd.random() > 0.18 for _ in range(W)] for _ in range(H)]
    free[15][20] = True
    cost = [[1 for _ in range(W)] for _ in range(H)]
    m4 = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1)]
    m8 = m4 + [(1, 1, 0), (1, -1, 0), (-1, 1, 0), (-1, -1, 0)]
    # 2-邻域：直走代价 5、斜走代价 7（7/5 = 1.4 ≈ √2，是我们为 Dial 选的整数近似）
    m8w = [(di, dj, 5 if (di == 0 or dj == 0) else 7) for (di, dj, _) in m8]
    for name, mv in (("1-邻域, 单位代价", m4), ("2-邻域, 代价 5/7", m8w)):
        d1 = dijkstra_grid(cost, free, (15, 20), mv)
        d2, mb = dial_grid(cost, free, (15, 20), mv)
        same = all(d1[i][j] == d2[i][j] for i in range(H) for j in range(W))
        print(f"   {name}: Dial 与 Dijkstra 完全相同 = {same}；同时非空的桶最多 {mb} 个")
    print("   （单位代价时最多 2 个桶——正是 wavefront 的 W_i 与 W_{i+1}；代价 ≤ 7 时不超过 8 个桶，可用循环数组）")
    # 楼梯 vs 斜线：从左上到右下，空地图
    free0 = [[True] * 21 for _ in range(21)]
    d4 = dijkstra_grid(cost, free0, (20, 20), m4)
    d8 = dijkstra_grid(cost, free0, (20, 20), m8w)
    print(f"   空地图 (0,0)→(20,20)：1-邻域步数 {d4[0][0]}（欧氏长度 40，楼梯）；"
          f"2-邻域代价 {d8[0][0]} = 20 步斜走，欧氏长度 {20*math.sqrt(2):.2f}")


# ---------------------------------------------------------------------- 5 NF2
NF2_W, NF2_H = 36, 24
NF2_RECTS = [  # (c0, r0, c1, r1)，左闭右开，行从上往下
    (7, 5, 14, 11),
    (20, 0, 24, 9),
    (19, 15, 31, 18),
    (5, 16, 13, 20),
]
NF2_GOAL = (20, 33)   # (行, 列)
NF2_START = (2, 2)


def nf2_map():
    free = [[True] * NF2_W for _ in range(NF2_H)]
    for (c0, r0, c1, r1) in NF2_RECTS:
        for r in range(r0, r1):
            for c in range(c0, c1):
                free[r][c] = False
    return free


N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))


def nf2(free, goal):
    """最大间隙导航函数 NF2（8.2.3 节的 7 个步骤）。返回 dict，供核对。"""
    H, W = len(free), len(free[0])
    # 障碍编号：每个障碍连通块一个编号；外边界的四条边各一个编号
    lab_obs = [[-1] * W for _ in range(H)]
    nid = 0
    for r in range(H):
        for c in range(W):
            if not free[r][c] and lab_obs[r][c] < 0:
                stack = [(r, c)]
                lab_obs[r][c] = nid
                while stack:
                    a, b = stack.pop()
                    for da, db in N4:
                        x, y = a + da, b + db
                        if 0 <= x < H and 0 <= y < W and not free[x][y] and lab_obs[x][y] < 0:
                            lab_obs[x][y] = nid
                            stack.append((x, y))
                nid += 1
    TOP, BOT, LEFT, RIGHT = nid, nid + 1, nid + 2, nid + 3
    # 步骤 1：W_0 = 至少一个方向被挡住的自由格
    d = [[INF] * W for _ in range(H)]
    lab = [[-1] * W for _ in range(H)]
    W0 = []
    for r in range(H):
        for c in range(W):
            if not free[r][c]:
                continue
            labs = []
            for da, db in N4:
                x, y = r + da, c + db
                if x < 0:
                    labs.append(TOP)
                elif x >= H:
                    labs.append(BOT)
                elif y < 0:
                    labs.append(LEFT)
                elif y >= W:
                    labs.append(RIGHT)
                elif not free[x][y]:
                    labs.append(lab_obs[x][y])
            if labs:
                d[r][c] = 0
                lab[r][c] = min(labs)
                W0.append((r, c))
    # 步骤 2：从障碍边界向外传播波前，同时传播「来自哪个障碍」
    cur = W0
    while cur:
        nxt = []
        for (r, c) in cur:
            for da, db in N4:
                x, y = r + da, c + db
                if 0 <= x < H and 0 <= y < W and free[x][y] and d[x][y] == INF:
                    d[x][y] = d[r][c] + 1
                    lab[x][y] = lab[r][c]
                    nxt.append((x, y))
        cur = nxt
    # 步骤 3：来自不同障碍的波前相遇（或相接）处为骨架；相接时取离障碍较远的那一个
    S = set()
    for r in range(H):
        for c in range(W):
            if not free[r][c]:
                continue
            for da, db in ((1, 0), (0, 1)):
                x, y = r + da, c + db
                if x < H and y < W and free[x][y] and lab[x][y] != lab[r][c]:
                    S.add((r, c) if d[r][c] >= d[x][y] else (x, y))
    # 步骤 4：把 x_G 用 BFS 连到骨架
    prev = {goal: None}
    q = [goal]
    hit = goal if goal in S else None
    k = 0
    while hit is None and k < len(q):
        r, c = q[k]
        k += 1
        for da, db in N4:
            x, y = r + da, c + db
            if 0 <= x < H and 0 <= y < W and free[x][y] and (x, y) not in prev:
                prev[(x, y)] = (r, c)
                if (x, y) in S:
                    hit = (x, y)
                    break
                q.append((x, y))
    p = hit
    while p is not None:
        S.add(p)
        p = prev[p]
    # 步骤 5：在 S 上从 x_G 做 wavefront（S 以外当障碍；骨架是阶梯状的，这里允许 8-邻域）
    phi1 = {goal: 0}
    cur = [goal]
    while cur:
        nxt = []
        for (r, c) in cur:
            for da, db in N8:
                x, y = r + da, c + db
                if (x, y) in S and (x, y) not in phi1:
                    phi1[(x, y)] = phi1[(r, c)] + 1
                    nxt.append((x, y))
        cur = nxt
    S = set(phi1)   # 只保留与 x_G 连通的骨架
    # 步骤 6：把 S 当目标，wavefront 得 φ2，同时记下最近的骨架点 x'
    phi2 = [[INF] * W for _ in range(H)]
    near = [[None] * W for _ in range(H)]
    cur = list(S)
    for (r, c) in cur:
        phi2[r][c] = 0
        near[r][c] = (r, c)
    while cur:
        nxt = []
        for (r, c) in cur:
            for da, db in N4:
                x, y = r + da, c + db
                if 0 <= x < H and 0 <= y < W and free[x][y] and phi2[x][y] == INF:
                    phi2[x][y] = phi2[r][c] + 1
                    near[x][y] = near[r][c]
                    nxt.append((x, y))
        cur = nxt
    # 步骤 7：φ = φ1(x') + φ2(x)
    phi = [[INF] * W for _ in range(H)]
    for r in range(H):
        for c in range(W):
            if near[r][c] is not None:
                phi[r][c] = phi1[near[r][c]] + phi2[r][c]
    return {"d": d, "S": S, "phi": phi}


def descend(phi, start, moves=N8):
    path = [start]
    r, c = start
    H, W = len(phi), len(phi[0])
    while phi[r][c] > 0:
        best = min(((phi[r + a][c + b], (r + a, c + b)) for a, b in moves
                    if 0 <= r + a < H and 0 <= c + b < W), default=(INF, None))
        if not best[0] < phi[r][c]:
            break
        r, c = best[1]
        path.append((r, c))
    return path


def section5():
    print("\n5. NF2（最大间隙导航函数）：教程地图 36×24，起点 (2,2)，目标 (20,33)")
    free = nf2_map()
    res = nf2(free, NF2_GOAL)
    d = res["d"]
    p_nf2 = descend(res["phi"], NF2_START)
    opt, _ = wavefront(free, [NF2_GOAL], moves=N8)
    p_opt = descend(opt, NF2_START)
    clr = lambda p: min(d[r][c] for (r, c) in p[1:-1])
    print(f"   骨架格子数 |S| = {len(res['S'])}")
    print(f"   沿 NF2 下降：{len(p_nf2)-1} 步，路径上（不含两端）离障碍的最小格距 = {clr(p_nf2)}")
    print(f"   沿最短（8-邻域 wavefront）下降：{len(p_opt)-1} 步，最小格距 = {clr(p_opt)}")
    print("   （格距 0 表示贴着障碍：最短路径会擦着障碍角走，NF2 走在两障碍中间）")


# ====================================================================== 6 积分曲线
def rk4(f, x, h):
    k1 = f(x)
    k2 = f([x[i] + h / 2 * k1[i] for i in range(len(x))])
    k3 = f([x[i] + h / 2 * k2[i] for i in range(len(x))])
    k4 = f([x[i] + h * k3[i] for i in range(len(x))])
    return [x[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(len(x))]


def euler(f, x, h):
    v = f(x)
    return [x[i] + h * v[i] for i in range(len(x))]


def section6():
    print("\n6. 积分曲线：例 8.9（常值场 ẋ1=1, ẋ2=2）与例 8.10（ẋ1=-2x1, ẋ2=-x2）")
    f9 = lambda x: [1.0, 2.0]
    x = [0.0, 0.0]
    for _ in range(100):
        x = euler(f9, x, 0.01)
    print(f"   例 8.9：Euler 走到 t=1 得 ({x[0]:.6f}, {x[1]:.6f})，τ(1) = (1, 2)（常值场 Euler 是精确的）")
    f10 = lambda x: [-2 * x[0], -x[1]]
    for h in (0.2, 0.05):
        xe = [1.0, 1.0]
        xr = [1.0, 1.0]
        n = round(1 / h)
        for _ in range(n):
            xe = euler(f10, xe, h)
            xr = rk4(f10, xr, h)
        ex = (math.exp(-2), math.exp(-1))
        print(f"   例 8.10, 步长 {h}: τ(1)=({ex[0]:.6f}, {ex[1]:.6f})  Euler 误差 {math.dist(xe, ex):.2e}  RK4 误差 {math.dist(xr, ex):.2e}")
    # 非 Lipschitz：ẋ = √|x| 从 0 出发有两个解
    print("   补充：ẋ = √|x|（在 0 处不 Lipschitz）从 x(0)=0 出发，x(t)=0 和 x(t)=t²/4 都满足 —— 解不唯一")
    t = 1.3
    print(f"     检查 x=t²/4：dx/dt = t/2 = {t/2:.4f}，√x = {math.sqrt(t*t/4):.4f}")


# ====================================================================== 7 坐标邻域
def inv_phi_plus(i, y, book=False):
    """(8.26)：(φ_i^+)^{-1}，y 是去掉第 i 个坐标后剩下的 n 个坐标（i 从 1 开始）。"""
    s = math.sqrt(max(0.0, 1 - sum(v * v for v in y)))
    xi = 1 - s if book else s
    return y[:i - 1] + [xi] + y[i - 1:]


def section7():
    print("\n7. 例 8.14：S^n 的 2(n+1) 个坐标邻域")
    for y in ([0.6], [0.0], [0.3, -0.4]):
        n = len(y)
        for book in (True, False):
            p = inv_phi_plus(n + 1, list(y), book)
            print(f"   S^{n}, i={n+1}, 坐标 {y}: {'原书 (8.26)' if book else '改正      '} → {[round(v, 4) for v in p]}，"
                  f"模长 {math.sqrt(sum(v*v for v in p)):.4f}")
    print("   （原书写法得到的点不在单位球上；改正后 x_i = +√(1 − Σ_{j≠i} x_j²)）")
    # S^1：U_2^+ = {y>0}（φ_2^+(x,y)=x），U_1^- = {x<0}（φ_1^-(x,y)=y）；重叠是第二象限
    print("   S¹ 上 φ_1^- ∘ (φ_2^+)^{-1}：u ↦ √(1−u²)，定义在 u∈(−1,0)（第二象限），光滑：")
    for u in (-0.9, -0.5, -0.1):
        x, y = inv_phi_plus(2, [u])
        print(f"     u={u:+.1f} → 点 ({x:+.4f},{y:+.4f}) → φ_1^- = {y:.4f}")
    print("   球极投影：σ_N(x,y)=x/(1−y)，σ_S(x,y)=x/(1+y)；重叠处 σ_S = 1/σ_N（u≠0 时光滑）")
    for th in (0.3, 2.0, -1.2):
        x, y = math.cos(th), math.sin(th)
        a, b = x / (1 - y), x / (1 + y)
        print(f"     θ={th:+.1f}: σ_N={a:+.4f}, σ_S={b:+.4f}, σ_N·σ_S={a*b:.4f}")


def section8():
    print("\n8. 例 8.16：S² 上 p(θ,φ) 处的切空间基（θ∈(0,2π)、φ∈(0,π)）")
    for th, ph in ((0.7, 1.1), (2.5, 0.2), (4.0, 2.9)):
        p = (math.cos(th) * math.sin(ph), math.sin(th) * math.sin(ph), math.cos(ph))
        dth = (-math.sin(th) * math.sin(ph), math.cos(th) * math.sin(ph), 0.0)
        dph = (math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), -math.sin(ph))
        nth = math.sqrt(sum(v * v for v in dth))
        e1 = tuple(v / nth for v in dth)
        dot = lambda a, b: sum(x * y for x, y in zip(a, b))
        print(f"   θ={th}, φ={ph}: |∂/∂θ| = sinφ = {nth:.4f}, |∂/∂φ| = {math.sqrt(dot(dph,dph)):.4f}; "
              f"e_θ·n = {dot(e1,p):+.1e}, e_φ·n = {dot(dph,p):+.1e}, e_θ·e_φ = {dot(e1,dph):+.1e}")
    print("   （|∂/∂θ| = sinφ → 0：在两极这个坐标邻域退化，所以 φ∈(0,π) 要排除极点）")


# ====================================================================== 9 Lipschitz 与加速度
def section9():
    print("\n9. 8.4.4：Lipschitz 常数 C 与加速度界")
    # f(x) = [-x2, x1]：Lipschitz 常数 C = 1；沿积分曲线 ẍ = Df·ẋ，|ẍ| = |x|
    for r in (0.5, 1.0, 2.0):
        x = [r, 0.0]
        v = [-x[1], x[0]]
        acc = [-v[1], v[0]]
        print(f"   f=[-x2, x1]（C=1），在半径 {r} 的圆上：速度 {math.hypot(*v):.2f}，所需加速度 {math.hypot(*acc):.2f}")
    print("   ⇒ |ẍ| = |Df·ẋ| ≤ C|ẋ|：需要 C·v_max ≤ a_max；书中「C < a_max」在 |ẋ| ≤ 1 时成立（补充说明）")


# ====================================================================== 10 Rimon–Koditschek
RK_WORLD = {
    "R0": 1.0,                                     # 外边界：以原点为心、半径 1 的圆
    "obs": [(-0.42, 0.18, 0.2), (0.22, -0.12, 0.2), (-0.05, 0.55, 0.14), (0.05, -0.62, 0.16)],
    "goal": (0.6, 0.2),
}


def rk_parts(q, world=RK_WORLD):
    x, y = q
    gx, gy = world["goal"]
    gamma = (x - gx) ** 2 + (y - gy) ** 2
    dgamma = (2 * (x - gx), 2 * (y - gy))
    bs = [world["R0"] ** 2 - x * x - y * y]
    dbs = [(-2 * x, -2 * y)]
    for (cx, cy, r) in world["obs"]:
        bs.append((x - cx) ** 2 + (y - cy) ** 2 - r * r)
        dbs.append((2 * (x - cx), 2 * (y - cy)))
    beta = 1.0
    for b in bs:
        beta *= b
    dbeta = [0.0, 0.0]
    for i, db in enumerate(dbs):
        prod = 1.0
        for j, b in enumerate(bs):
            if j != i:
                prod *= b
        dbeta[0] += db[0] * prod
        dbeta[1] += db[1] * prod
    return gamma, dgamma, beta, dbeta, bs


def rk_free(q, world=RK_WORLD):
    return all(b > 0 for b in rk_parts(q, world)[4])


def rk_phi(q, k, world=RK_WORLD):
    gamma, _, beta, _, _ = rk_parts(q, world)
    return gamma / (gamma ** k + beta) ** (1 / k)


def rk_F(q, k, world=RK_WORLD):
    """∇φ = 0（γ≠0）⇔ F = kβ∇γ − γ∇β = 0。F 是多项式，数值上比直接对 φ 求导稳得多。"""
    gamma, dgamma, beta, dbeta, _ = rk_parts(q, world)
    return (k * beta * dgamma[0] - gamma * dbeta[0], k * beta * dgamma[1] - gamma * dbeta[1])


def rk_critical(k, world=RK_WORLD, res=90):
    pts = []
    h = 1e-6
    for i in range(res):
        for j in range(res):
            q = [-1 + 2 * (i + 0.5) / res, -1 + 2 * (j + 0.5) / res]
            if not rk_free(q, world):
                continue
            ok = False
            for _ in range(60):   # Newton
                F = rk_F(q, k, world)
                Fx1 = rk_F((q[0] + h, q[1]), k, world)
                Fy1 = rk_F((q[0], q[1] + h), k, world)
                J = [[(Fx1[0] - F[0]) / h, (Fy1[0] - F[0]) / h], [(Fx1[1] - F[1]) / h, (Fy1[1] - F[1]) / h]]
                det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
                if abs(det) < 1e-300:
                    break
                dx = (J[1][1] * F[0] - J[0][1] * F[1]) / det
                dy = (-J[1][0] * F[0] + J[0][0] * F[1]) / det
                step = math.hypot(dx, dy)
                if step > 0.05:
                    dx, dy = dx / step * 0.05, dy / step * 0.05
                q = [q[0] - dx, q[1] - dy]
                if not rk_free(q, world):
                    break
                if math.hypot(dx, dy) < 1e-12:
                    ok = True
                    break
            if ok and math.dist(q, world["goal"]) > 1e-6 and all(math.dist(q, p) > 1e-5 for p, _ in pts):
                # 用 φ 的数值 Hessian 分类
                e = 1e-4
                f0 = rk_phi(q, k, world)
                fxx = (rk_phi((q[0] + e, q[1]), k, world) - 2 * f0 + rk_phi((q[0] - e, q[1]), k, world)) / e / e
                fyy = (rk_phi((q[0], q[1] + e), k, world) - 2 * f0 + rk_phi((q[0], q[1] - e), k, world)) / e / e
                fxy = (rk_phi((q[0] + e, q[1] + e), k, world) - rk_phi((q[0] + e, q[1] - e), k, world)
                       - rk_phi((q[0] - e, q[1] + e), k, world) + rk_phi((q[0] - e, q[1] - e), k, world)) / (4 * e * e)
                det = fxx * fyy - fxy * fxy
                kind = "鞍点" if det < 0 else ("极小" if fxx > 0 else "极大")
                pts.append((q, kind))
    return pts


def section10():
    print("\n10. Rimon–Koditschek 导航函数 φ = γ/(γ^k+β)^{1/k}（公式为补充，见 [79]），教程的球形世界")
    print(f"    外边界半径 1；障碍 {RK_WORLD['obs']}；目标 {RK_WORLD['goal']}")
    for k in (1, 2, 3, 4, 5, 6, 10):
        pts = rk_critical(k)
        mins = [p for p in pts if p[1] == "极小"]
        sad = [p for p in pts if p[1] == "鞍点"]
        mx = [p for p in pts if p[1] == "极大"]
        desc = "; ".join(f"{kd}({q[0]:+.3f},{q[1]:+.3f})" for q, kd in pts)
        print(f"    k={k:>2}: 目标以外的极小 {len(mins)} 个、鞍点 {len(sad)} 个、极大 {len(mx)} 个   {desc}")
    print("    （k 足够大时：除目标外没有局部极小，每个障碍旁边恰好一个鞍点 —— Morse 函数，临界点只在零测集上）")


# ====================================================================== 11 调和势函数
def section11():
    print("\n11. 调和势函数 ∇²φ = 0 的 Gauss–Seidel 迭代（Dirichlet：障碍与外边界 φ=1，目标 φ=0）")
    W, H = 48, 32
    obst = lambda i, j: (14 <= i < 20 and 6 <= j < 26) or (30 <= i < 36 and 0 <= j < 20)
    goal = (42, 26)
    phi = [[1.0] * H for _ in range(W)]
    fixed = [[i in (0, W - 1) or j in (0, H - 1) or obst(i, j) for j in range(H)] for i in range(W)]
    phi[goal[0]][goal[1]] = 0.0
    fixed[goal[0]][goal[1]] = True
    it = 0
    while True:
        it += 1
        delta = 0.0
        for i in range(1, W - 1):
            for j in range(1, H - 1):
                if fixed[i][j]:
                    continue
                v = 0.25 * (phi[i + 1][j] + phi[i - 1][j] + phi[i][j + 1] + phi[i][j - 1])
                delta = max(delta, abs(v - phi[i][j]))
                phi[i][j] = v
        if delta < 1e-6 or it > 200000:
            break
    locmin = 0
    for i in range(1, W - 1):
        for j in range(1, H - 1):
            if fixed[i][j]:
                continue
            nb = [phi[i + 1][j], phi[i - 1][j], phi[i][j + 1], phi[i][j - 1]]
            if phi[i][j] <= min(nb):
                locmin += 1
    print(f"    48×32 网格：Gauss–Seidel {it} 轮后最大改变量 < 1e-6；内部局部极小个数 = {locmin}")
    print(f"    （目标旁边的值 {phi[goal[0]-1][goal[1]]:.4f}；远处几乎等于 1，例如 1 − φ(3,3) = {1-phi[3][3]:.1e}：梯度极小，数值上很难用）")


# ====================================================================== 12 多边形里的最优导航函数
POLY = [(0.08, 0.06), (0.52, 0.06), (0.52, 0.22), (0.9, 0.22), (0.9, 0.36), (0.42, 0.36), (0.42, 0.58),
        (0.66, 0.48), (0.94, 0.7), (0.72, 0.94), (0.56, 0.7), (0.42, 0.7), (0.42, 0.94), (0.08, 0.94)]
POLY_GOAL = (0.2, 0.5)


def seg_cross(p, q, a, b):
    """线段 pq 与 ab 是否在内部真相交（端点接触不算）。"""
    def orient(o, s, t):
        return (s[0] - o[0]) * (t[1] - o[1]) - (s[1] - o[1]) * (t[0] - o[0])
    d1, d2 = orient(a, b, p), orient(a, b, q)
    d3, d4 = orient(p, q, a), orient(p, q, b)
    return ((d1 > 1e-12 and d2 < -1e-12) or (d1 < -1e-12 and d2 > 1e-12)) and \
           ((d3 > 1e-12 and d4 < -1e-12) or (d3 < -1e-12 and d4 > 1e-12))


def in_poly(p, P):
    c = False
    for i in range(len(P)):
        a, b = P[i], P[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def visible(p, q, P):
    for i in range(len(P)):
        if seg_cross(p, q, P[i - 1], P[i]):
            return False
    m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    # 端点都在顶点上的对角线：再检查中点在多边形内
    return in_poly(m, P) or math.dist(p, q) < 1e-12


def section12():
    print("\n12. 8.4.3：教程多边形（14 个顶点，无洞）里的最优导航函数")
    P = POLY
    # 可见图上的 Dijkstra（只需凹顶点作路点）
    def reflex(i):
        a, b, c = P[i - 1], P[i], P[(i + 1) % len(P)]
        return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0  # 逆时针多边形中右转 = 凹
    R = [i for i in range(len(P)) if reflex(i)]
    print(f"    凹顶点（可能成为路点）：{[P[i] for i in R]}")
    dist = {i: INF for i in R}
    pq = []
    for i in R:
        if visible(POLY_GOAL, P[i], P):
            dist[i] = math.dist(POLY_GOAL, P[i])
            heapq.heappush(pq, (dist[i], i))
    order = []
    while pq:
        dv, i = heapq.heappop(pq)
        if dv > dist[i]:
            continue
        order.append(i)
        for j in R:
            if j != i and visible(P[i], P[j], P):
                nd = dv + math.dist(P[i], P[j])
                if nd < dist[j]:
                    dist[j] = nd
                    heapq.heappush(pq, (nd, j))
    for i in order:
        print(f"    路点 {P[i]}：φ = {dist[i]:.4f}")

    def phi(x):
        best = math.dist(x, POLY_GOAL) if visible(x, POLY_GOAL, P) else INF
        for i in R:
            if dist[i] < INF and visible(x, P[i], P):
                best = min(best, dist[i] + math.dist(x, P[i]))
        return best
    for x in ((0.3, 0.2), (0.8, 0.3), (0.8, 0.7), (0.3, 0.85), (0.82, 0.66)):
        print(f"    φ{x} = {phi(x):.4f}")


# ====================================================================== 13 (8.53)
def section13():
    print("\n13. 8.5.1：式 (8.53) 的椭球条件 vs 真实位移")
    # 机器人上离旋转中心最远的点 a_r = (r, 0)；先转 Δθ 再平移 Δt
    r, d = 1.0, 1.0
    dth = 0.7
    # 让平移方向与旋转引起的位移同向：最坏情况
    rot = (r * math.cos(dth) - r, r * math.sin(dth))
    nrot = math.hypot(*rot)
    tmag = 0.7
    t = (rot[0] / nrot * tmag, rot[1] / nrot * tmag)
    lhs = t[0] ** 2 + t[1] ** 2 + (r * dth) ** 2
    disp = math.hypot(t[0] + rot[0], t[1] + rot[1])
    print(f"    r=1, d=1, Δθ=0.7, |Δt|=0.7（与旋转位移同向）：(Δx)²+(Δy)²+(rΔθ)² = {lhs:.3f} < d² = 1")
    print(f"    但 a_r 实际位移 = {disp:.4f} > d —— 若最近障碍恰好在那个方向上，就会碰撞")
    rnd = random.Random(1)
    worst_e, worst_c = 0.0, 0.0
    for _ in range(200000):
        th = rnd.uniform(-1, 1)
        ang = rnd.uniform(0, 2 * math.pi)
        rad = rnd.uniform(0, 1)
        tx, ty = rad * math.cos(ang), rad * math.sin(ang)
        a = rnd.uniform(0, 2 * math.pi)
        p = (r * math.cos(a), r * math.sin(a))
        pr = (p[0] * math.cos(th) - p[1] * math.sin(th) + tx, p[0] * math.sin(th) + p[1] * math.cos(th) + ty)
        disp = math.dist(p, pr)
        if tx * tx + ty * ty + (r * th) ** 2 < d * d:
            worst_e = max(worst_e, disp)
        if math.hypot(tx, ty) + r * abs(th) < d:
            worst_c = max(worst_c, disp)
    print(f"    随机 20 万次：满足 (8.53) 时最大位移 ≈ {worst_e:.4f}（可超过 d，理论上接近 √2·d）；"
          f"满足 √(Δx²+Δy²)+r|Δθ|<d 时最大位移 ≈ {worst_c:.4f} < d")


# ====================================================================== 14 插值
def section14():
    print("\n14. 8.5.2：线性插值 (8.57)(8.58)")
    r = 3
    s = [i / r for i in range(r + 1)]
    for x in (s[1], 0.5, s[2] - 1e-12):
        i = max(k for k in range(r + 1) if s[k] <= x and k < r)
        book = 1 - (x - s[i]) / r
        fixed = 1 - r * (x - s[i])
        print(f"    r=3, x={x:.4f}: s_i={s[i]:.4f}; 原书 α = 1−(x−s_i)/r = {book:.4f}；改正 α = 1−r(x−s_i) = {fixed:.4f}")
    print("    （x → s_{i+1} 时改正后的 α → 0，原书写法 → 1−1/r² = 0.8889）")
    print("    多线性插值要 2^n 个邻居，单纯形（Kuhn / Freudenthal）插值只要 n+1 个：")
    print("      n : " + "  ".join(f"{n:>4}" for n in range(1, 9)))
    print("     2^n: " + "  ".join(f"{2**n:>4}" for n in range(1, 9)))
    print("     n+1: " + "  ".join(f"{n+1:>4}" for n in range(1, 9)))
    # 两者对仿射函数都精确
    rnd = random.Random(3)
    c = [rnd.uniform(-1, 1) for _ in range(4)]
    g = lambda x: c[0] + c[1] * x[0] + c[2] * x[1] + c[3] * x[2]
    err_b = err_k = 0.0
    for _ in range(1000):
        x = [rnd.random() for _ in range(3)]
        # 多线性
        vb = 0.0
        for corner in range(8):
            bits = [(corner >> d) & 1 for d in range(3)]
            w = 1.0
            for dd in range(3):
                w *= x[dd] if bits[dd] else 1 - x[dd]
            vb += w * g(bits)
        # Kuhn：按坐标从大到小排序，从 (0,0,0) 开始逐个加 1
        order = sorted(range(3), key=lambda dd: -x[dd])
        v = [0, 0, 0]
        prev = 1.0
        vk = 0.0
        xs = [x[dd] for dd in order] + [0.0]
        vk += (1 - xs[0]) * g(v)
        for m, dd in enumerate(order):
            v = v[:]
            v[dd] = 1
            vk += (xs[m] - xs[m + 1]) * g(v)
        err_b = max(err_b, abs(vb - g(x)))
        err_k = max(err_k, abs(vk - g(x)))
    print(f"    3 维仿射函数上的最大插值误差：多线性 {err_b:.1e}，Kuhn 单纯形 {err_k:.1e}（两者都精确）")


# ====================================================================== 15 带插值的值迭代
def bilinear(G, N, x, y):
    """[0,1]^2 上 N×N 网格（间距 h = 1/(N−1)）的双线性插值；邻居有 ∞ 则返回 ∞。"""
    h = 1 / (N - 1)
    if x < 0 or y < 0 or x > 1 or y > 1:
        return INF
    i = min(N - 2, int(x / h))
    j = min(N - 2, int(y / h))
    a1 = 1 - (x - i * h) / h   # 改正后的 (8.58)
    a2 = 1 - (y - j * h) / h
    v = [G[i][j], G[i][j + 1], G[i + 1][j], G[i + 1][j + 1]]
    w = [a1 * a2, a1 * (1 - a2), (1 - a1) * a2, (1 - a1) * (1 - a2)]
    tot = 0.0
    for vi, wi in zip(v, w):
        if wi > 1e-12:
            if vi == INF:
                return INF
            tot += wi * vi
    return tot


def vi_interp(N, goal, rg, dt, K=16, iters=4000):
    h = 1 / (N - 1)
    U = [(math.cos(2 * math.pi * k / K), math.sin(2 * math.pi * k / K)) for k in range(K)]
    G = [[INF] * N for _ in range(N)]
    isgoal = [[math.dist((i * h, j * h), goal) <= rg for j in range(N)] for i in range(N)]
    for i in range(N):
        for j in range(N):
            if isgoal[i][j]:
                G[i][j] = 0.0
    evals = 0
    for it in range(iters):
        change = 0.0
        newG = [row[:] for row in G]
        for i in range(N):
            for j in range(N):
                if isgoal[i][j]:
                    continue
                best = INF
                for (ux, uy) in U:
                    evals += 1
                    v = bilinear(G, N, i * h + dt * ux, j * h + dt * uy)
                    if v + dt < best:
                        best = v + dt
                newG[i][j] = best
                if best < INF and (G[i][j] == INF or abs(best - G[i][j]) > change):
                    change = max(change, abs(best - G[i][j]) if G[i][j] < INF else 1.0)
        G = newG
        if change < 1e-9:
            break
    return G, it + 1, evals


def section15():
    print("\n15. 带插值的值迭代：[0,1]² 无障碍，目标是圆盘（中心 (0.5,0.5)），16 个单位方向，l_d = Δt")
    for N in (11, 21, 41):
        h = 1 / (N - 1)
        G, its, ev = vi_interp(N, (0.5, 0.5), 0.1, dt=h)
        err = 0.0
        for i in range(N):
            for j in range(N):
                ex = max(0.0, math.dist((i * h, j * h), (0.5, 0.5)) - 0.1)
                err = max(err, abs(G[i][j] - ex))
        print(f"    N={N:>2}（h={h:.3f}），Δt = h：{its} 轮收敛，与欧氏距离 −0.1 的最大误差 {err:.4f}")
    # 曼哈顿（4-邻域离散值迭代）的误差：在 (0,0) 处
    N = 21
    h = 1 / (N - 1)
    print(f"    对照：只走 4 个轴向（曼哈顿模型）时 (0,0) 的 cost-to-go 约 |Δx|+|Δy| = {1.0 - 0.1*math.sqrt(2):.3f}，"
          f"真值 {math.dist((0,0),(0.5,0.5))-0.1:.4f}")
    # Δt < h 且目标只覆盖一个样本：R(G) 为空
    N = 21
    h = 1 / (N - 1)
    G, its, _ = vi_interp(N, (0.5, 0.5), 0.3 * h, dt=0.5 * h, iters=200)
    fin = sum(1 for i in range(N) for j in range(N) if G[i][j] < INF)
    print(f"    N=21，目标半径 0.3h（只盖住 1 个样本），Δt = 0.5h：{its} 轮后有限值的样本数 = {fin}（只有目标本身）")
    G, its, _ = vi_interp(N, (0.5, 0.5), 0.3 * h, dt=1.0 * h, iters=400)
    fin = sum(1 for i in range(N) for j in range(N) if G[i][j] < INF)
    print(f"    同一目标，Δt = h：有限值的样本数 = {fin} / {N*N}（Δt 足够大，新样本能直接落到目标样本上）")


# ====================================================================== 16 教程互动图的场景
VI_OBS = [[(0.3, 0.15), (0.42, 0.15), (0.42, 0.7), (0.3, 0.7)], [(0.58, 0.45), (0.7, 0.45), (0.7, 1), (0.58, 1)],
          [(0.66, 0.1), (0.88, 0.18), (0.72, 0.32)]]
VI_OUTER = [(0, 0), (1, 0), (1, 1), (0, 1)]


def in_poly_js(p, P):
    """与 ch8-lib.js 的 inPoly 完全相同的射线法（包括边界上的浮点细节）。"""
    c = False
    j = len(P) - 1
    for i in range(len(P)):
        a, b = P[i], P[j]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
        j = i
    return c


def seg_point_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L if L > 0 else 0
    t = max(0.0, min(1.0, t))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


class JSHeap:
    """与 ch8-lib.js 里 Heap 相同的二叉堆（并列时的出队顺序也相同）。"""
    def __init__(self):
        self.a = []

    def push(self, item, key):
        a = self.a
        a.append((item, key))
        i = len(a) - 1
        while i > 0:
            p = (i - 1) >> 1
            if a[p][1] <= a[i][1]:
                break
            a[p], a[i] = a[i], a[p]
            i = p

    def pop(self):
        a = self.a
        top = a[0]
        last = a.pop()
        if a:
            a[0] = last
            i = 0
            while True:
                l, r = 2 * i + 1, 2 * i + 2
                m = i
                if l < len(a) and a[l][1] < a[m][1]:
                    m = l
                if r < len(a) and a[r][1] < a[m][1]:
                    m = r
                if m == i:
                    break
                a[m], a[i] = a[i], a[m]
                i = m
        return top[0]


def section16():
    print("\n16. 互动图「带插值的值迭代」默认场景：N=21，16 个方向，Δt=1.5h，目标 (0.86,0.82) 半径 0.07")
    N, K = 21, 16
    h = 1 / (N - 1)
    dt = 1.5 * h
    goal, rg = (0.86, 0.82), 0.07
    segs = []
    for R in [VI_OUTER] + VI_OBS:
        for i in range(len(R)):
            segs.append((R[i], R[(i + 1) % len(R)]))
    idx = lambda i, j: j * N + i
    free = [0] * (N * N)
    isG = [0] * (N * N)
    for j in range(N):
        for i in range(N):
            p = (i * h, j * h)
            inside = in_poly_js(p, VI_OUTER) and not any(in_poly_js(p, P) for P in VI_OBS)
            loose = inside or any(seg_point_dist(p, a, b) < 1e-9 for a, b in segs)
            clear = min(seg_point_dist(p, a, b) for a, b in segs)
            f = inside or (loose and clear < 1e-9 and not any(in_poly_js(p, P) for P in VI_OBS))
            free[idx(i, j)] = 1 if f else 0
            if f and math.dist(p, goal) <= rg:
                isG[idx(i, j)] = 1
    U = [(math.cos(2 * math.pi * k / K), math.sin(2 * math.pi * k / K)) for k in range(K)]
    counter = [0]

    def interp(G, x, y):
        if x < -1e-12 or y < -1e-12 or x > 1 + 1e-12 or y > 1 + 1e-12:
            return INF
        i = min(N - 2, max(0, math.floor(x / h + 1e-12)))
        j = min(N - 2, max(0, math.floor(y / h + 1e-12)))
        a1, a2 = 1 - (x / h - i), 1 - (y / h - j)
        w = [a1 * a2, (1 - a1) * a2, a1 * (1 - a2), (1 - a1) * (1 - a2)]
        ks = [idx(i, j), idx(i + 1, j), idx(i, j + 1), idx(i + 1, j + 1)]
        s = 0.0
        for wk, kk in zip(w, ks):
            if wk <= 1e-12:
                continue
            if not free[kk] or G[kk] == INF:
                return INF
            s += wk * G[kk]
        return s

    def bellman(G, k):
        i, j = k % N, k // N
        best = INF
        for (ux, uy) in U:
            counter[0] += 1
            v = dt + interp(G, i * h + dt * ux, j * h + dt * uy)
            if v < best:
                best = v
        return best

    # 值迭代（同步）
    G = [0.0 if isG[k] else INF for k in range(N * N)]
    it = 0
    while True:
        NG = G[:]
        ch = 0.0
        for k in range(N * N):
            if not free[k] or isG[k]:
                continue
            v = bellman(G, k)
            NG[k] = v
            if v != G[k]:
                ch = max(ch, 1.0 if G[k] == INF else abs(v - G[k]))
        G = NG
        it += 1
        if ch < 1e-9:
            break
    vi_evals = counter[0]
    nfree = sum(free)
    print(f"    自由样本 {nfree} 个，目标样本 {sum(isG)} 个；值迭代 {it} 轮收敛，动作求值 {vi_evals:,} 次")

    # 类 Dijkstra
    def corners(x, y):
        if x < -1e-12 or y < -1e-12 or x > 1 + 1e-12 or y > 1 + 1e-12:
            return []
        i = min(N - 2, max(0, math.floor(x / h + 1e-12)))
        j = min(N - 2, max(0, math.floor(y / h + 1e-12)))
        fx, fy = x / h - i, y / h - j
        out = []
        if (1 - fx) * (1 - fy) > 1e-12:
            out.append(idx(i, j))
        if fx * (1 - fy) > 1e-12:
            out.append(idx(i + 1, j))
        if (1 - fx) * fy > 1e-12:
            out.append(idx(i, j + 1))
        if fx * fy > 1e-12:
            out.append(idx(i + 1, j + 1))
        return out
    dep = [[] for _ in range(N * N)]
    for j in range(N):
        for i in range(N):
            k = idx(i, j)
            if not free[k] or isG[k]:
                continue
            seen = set()
            for (ux, uy) in U:
                for c in corners(i * h + dt * ux, j * h + dt * uy):
                    if c not in seen:
                        seen.add(c)
                        dep[c].append(k)
    counter[0] = 0
    D = [0.0 if isG[k] else INF for k in range(N * N)]
    state = [2 if isG[k] else 0 for k in range(N * N)]
    heap = JSHeap()

    def relax(s_):
        if state[s_] == 2 or not free[s_] or isG[s_]:
            return
        v = bellman(D, s_)
        if v < D[s_] - 1e-12:
            D[s_] = v
            heap.push(s_, v)
            state[s_] = 1
    for k in range(N * N):
        if isG[k]:
            for s_ in dep[k]:
                relax(s_)
    pops = 0
    while heap.a:
        s_ = -1
        while heap.a:
            c = heap.pop()
            if state[c] == 1:
                s_ = c
                break
        if s_ < 0:
            break
        state[s_] = 2
        pops += 1
        for d in dep[s_]:
            relax(d)
    hi = sum(1 for k in range(N * N) if (G[k] < INF or D[k] < INF) and D[k] - G[k] > 1e-9)
    lo = sum(1 for k in range(N * N) if (G[k] < INF or D[k] < INF) and G[k] - D[k] > 1e-9)
    mx = max(abs(D[k] - G[k]) for k in range(N * N) if G[k] < INF or D[k] < INF)
    print(f"    类 Dijkstra：出队 {pops} 次，动作求值 {counter[0]:,} 次（约为值迭代的 {counter[0]/vi_evals:.0%}）")
    print(f"    与值迭代不动点相比：{hi} 个样本偏高、{lo} 个偏低，最大差 {mx:.3f}")
    print("    （偏高的样本：最优动作落点的插值邻居比它自己更晚出队，它出队时用的还是邻居的临时值）")


# ====================================================================== 17 加速度控制模型
L_REGION = [(0.05, 0.1), (0.75, 0.1), (0.75, 0.92), (0.55, 0.92), (0.55, 0.3), (0.05, 0.3)]


def accel_sim(w, v, amax, K=8.0, start=(0.1, 0.2), xc=0.62, yG=0.86):
    """与 ch8-dynamics.js 的 AccelControl 相同：ẍ = u，u = K(f(x) − ẋ) + ∇_ẋ f(x)，‖u‖ 截断到 a_max。"""
    def psi(x):
        if w <= 0:
            return math.pi / 2 if x >= xc else 0.0
        t = min(1.0, max(0.0, (x - (xc - w / 2)) / w))
        return math.pi / 2 * t * t * (3 - 2 * t)

    def dpsi(x):
        if w <= 0:
            return 0.0
        t = (x - (xc - w / 2)) / w
        return 0.0 if t <= 0 or t >= 1 else math.pi / 2 * 6 * t * (1 - t) / w
    g = lambda y: min(1.0, max(0.0, (yG - y) / 0.18))
    dg = lambda y: -1 / 0.18 if yG - 0.18 < y < yG else 0.0

    def f(p):
        sp, a = v * g(p[1]), psi(p[0])
        return (sp * math.cos(a), sp * math.sin(a))
    x = start
    xd = f(x)
    t = 0.0
    dt = 0.002
    while True:
        fx = f(x)
        a = psi(x[0])
        t1 = v * dg(x[1]) * xd[1]
        t2 = v * g(x[1]) * dpsi(x[0]) * xd[0]
        gr = (t1 * math.cos(a) - t2 * math.sin(a), t1 * math.sin(a) + t2 * math.cos(a))
        u = (K * (fx[0] - xd[0]) + gr[0], K * (fx[1] - xd[1]) + gr[1])
        nu = math.hypot(*u)
        if nu > amax:
            u = (u[0] / nu * amax, u[1] / nu * amax)
        xd = (xd[0] + u[0] * dt, xd[1] + u[1] * dt)
        x = (x[0] + xd[0] * dt, x[1] + xd[1] * dt)
        t += dt
        if not in_poly_js(x, L_REGION):
            return "撞墙", t
        if x[1] > yG - 0.02 and math.hypot(*xd) < 0.01:
            return "到达", t
        if t > 30:
            return "超时", t


def section17():
    print("\n17. 加速度控制模型（教程互动图）：|f| = 0.35，K = 8")
    for (w, amax) in ((0, 0.5), (0.06, 0.5), (0.12, 0.5), (0.18, 0.5), (0.24, 0.5), (0, 0.6), (0, 0.7)):
        res, t = accel_sim(w, 0.35, amax)
        C = 0.35 * math.pi / 2 * 1.5 / w if w > 0 else INF
        print(f"    w = {w:.2f}（C = {C:.2f}，C·|f| = {C*0.35:.2f}），a_max = {amax}: {res}（t = {t:.1f}）")
    print("    （C·|f| 都大于 a_max：加速度会饱和，但过渡越平缓，偏离越小；不连续的场需要无穷大的加速度）")


# ====================================================================== 18 调和势函数（互动图的网格）
def section18():
    print("\n18. 调和势函数（教程互动图）：64×40 网格，目标格 (58, 8)")
    NX, NY = 64, 40
    rects = [(0.3, 0.15, 0.4, 0.75), (0.72, 0, 0.82, 0.55), (1.05, 0.35, 1.4, 0.45), (1.05, 0.45, 1.15, 0.85)]
    obs = [0] * (NX * NY)
    for j in range(NY):
        for i in range(NX):
            x, y = (i + 0.5) * 1.6 / NX, (j + 0.5) / NY
            if any(x0 <= x <= x1 and y0 <= y <= y1 for (x0, y0, x1, y1) in rects):
                obs[j * NX + i] = 1
    g = 8 * NX + 58
    for mode in ("dir", "neu"):
        P = [1.0] * (NX * NY)
        P[g] = 0.0
        sweeps = 0
        while True:
            d = 0.0
            for j in range(1, NY - 1):
                for i in range(1, NX - 1):
                    k = j * NX + i
                    if obs[k] or k == g:
                        continue
                    s_ = 0.0
                    n = 0
                    for q in (k + 1, k - 1, k + NX, k - NX):
                        if obs[q]:
                            if mode == "neu":
                                continue
                            s_ += 1
                        else:
                            s_ += P[q]
                        n += 1
                    v_ = s_ / n
                    d = max(d, abs(v_ - P[k]))
                    P[k] = v_
            sweeps += 1
            if d <= 1e-12 or sweeps >= 40000:
                break
        far = 1 - P[(NY - 3) * NX + 2]
        name = "障碍 Dirichlet φ=1" if mode == "dir" else "障碍 Neumann"
        print(f"    {name}：{sweeps} 轮后最大改变量 ≤ 1e-12；左上角 1 − φ = {far:.1e}")


def main():
    phi = section1()
    section2(phi)
    section3(phi)
    section4()
    section5()
    section6()
    section7()
    section8()
    section9()
    section10()
    section11()
    section12()
    section13()
    section14()
    section15()
    section16()
    section17()
    section18()


if __name__ == "__main__":
    main()
