"""第 14 章参考实现：核对教程页面里出现的数值与公式。

只用 Python 标准库。运行：

    python3 part4/code/ch14_differential.py

会依次打印：
  1. 例 14.1：双积分器的最短刹车距离 v²/2 与 X_ric 的判定；「100 km/h、墙在 2 m 外」（补充）
  2. 例 14.4 / 图 14.6：Dubins 车三个动作的可达树顶点数 3^k，以及合并重复状态后的可达图
  3. 14.2.2 节：一直左转、Δt = 1 时顶点在圆上稠密（ρ_min = 1），ρ_min = 1/π 时两步回到原处
  4. (14.9) 曼哈顿模型：网格 BFS，失败就把 Δt 减半（分辨率完备）
  5. 图 14.13 / (14.23)：双积分器格点的奇偶性与三阶段后的顶点数
  6. 图 14.14 / 习题 4：常值动作可达锥的上下边界是抛物线
  7. 14.3.2 节 / 习题 8：Euler (14.16) 与四阶 Runge–Kutta (14.18)(14.19) 的误差阶
  8. 补充：双积分器回到原点静止的最短时间 T*(q, q̇)（bang-bang）
  9. 补充（15.3.1 节）：Dubins 最短路径长度，前进 vs 后退的不对称
 10. 例 14.6：直线路径上的 s̈ 区间（含原书 |a1| > |a2| 笔误的核对）；(14.39) 的正确形式
 11. 14.6.3 节：路径约束下的极限曲线、动态规划 (14.46) 与 bang-bang（图 14.28）的时间对照
 12. 14.5 节：带插值的值迭代 (14.27) 算出的 cost-to-go 与 T* 对照
 13. 图 14.23：双切线 LPM（只用 CSC）与 Dubins 最优长度对照
 14. (14.47) 打靶法：u(t) = w1 + w2 t 的梯度下降
"""
import math
import random
from collections import deque

TAU = 2 * math.pi


def mod2pi(a):
    return a % TAU


# =========================================================== 1. 例 14.1
def stop_distance(v, amax=1.0):
    """从速度 v 以最大减速度刹车到 0 走过的距离 v²/(2 a_max)。"""
    return v * v / (2 * amax)


def in_xric_1d(q, qd, obstacles, amax=1.0):
    """例 14.1：W = R 中的双积分器，障碍为区间列表 [(a,b),...]（点障碍 a = b）。
    一维里最好的办法就是全力刹车，所以 x ∈ X_ric ⇔ 刹车过程扫过的区间与某个障碍相交。"""
    d = stop_distance(qd, amax)
    lo, hi = (q, q + d) if qd >= 0 else (q - d, q)
    return any(not (hi < a or lo > b) for a, b in obstacles)


def check_ex141():
    print("1. 例 14.1：最短刹车距离 v²/2（a_max = 1）")
    for v in (0.5, 1, 2, 3):
        print(f"   v = {v}: 刹车距离 = {stop_distance(v):.3f}")
    obs = [(-2.0, -2.0), (1.0, 2.0)]   # 一个点障碍、一个区间障碍
    cases = [(0.0, 0.0), (0.0, 1.0), (0.0, 1.5), (-0.5, 1.0), (0.5, -1.0), (-1.0, -1.5), (2.5, 3.0)]
    for q, qd in cases:
        print(f"   x = (q, q̇) = ({q:+.1f}, {qd:+.1f}) ∈ X_ric ? {in_xric_1d(q, qd, obs)}")
    # X_ric 左边界：q = a − q̇²/2（q̇ > 0），右边界：q = b + q̇²/2（q̇ < 0）
    assert in_xric_1d(1.0 - 0.5 + 1e-9, 1.0, obs) and not in_xric_1d(1.0 - 0.5 - 1e-6, 1.0, obs)
    v = 100 / 3.6
    print(f"   补充：100 km/h = {v:.2f} m/s；以 1 g = 9.81 m/s² 刹车需要 {stop_distance(v, 9.81):.1f} m；"
          f"要在 2 m 内停下需要 {v * v / 4:.0f} m/s² ≈ {v * v / 4 / 9.81:.1f} g")


# =========================================================== 2. 例 14.4
def dubins_step(x, y, th, w, T, rho=1.0):
    """Dubins 车以单位速度、转向角速度 w ∈ {−1/ρ, 0, 1/ρ} 走时间 T（闭式积分）。"""
    if abs(w) < 1e-12:
        return x + T * math.cos(th), y + T * math.sin(th), th
    th2 = th + w * T
    return x + (math.sin(th2) - math.sin(th)) / w, y - (math.cos(th2) - math.cos(th)) / w, th2


def key(s, nd=6):
    x, y, th = s
    return (round(x, nd) + 0.0, round(y, nd) + 0.0, round(mod2pi(th) % TAU, nd) % round(TAU, nd))


def check_ex144():
    print("2. 例 14.4 / 图 14.6：Dubins 车，动作 {直行, 左转, 右转}，Δt = π/2（转弯恰好转过 π/2）")
    dt = math.pi / 2
    acts = (0.0, 1.0, -1.0)
    level = [(0.0, 0.0, 0.0)]
    tree_total = 1
    seen = {key(level[0])}
    frontier = [level[0]]
    for k in range(1, 6):
        level = [dubins_step(*s, w, dt) for s in level for w in acts]
        tree_total += len(level)
        new = []
        for s in [dubins_step(*s, w, dt) for s in frontier for w in acts]:
            kk = key(s)
            if kk not in seen:
                seen.add(kk)
                new.append(s)
        frontier = new
        print(f"   k = {k}: 树新增 3^k = {3 ** k:3d} 个，树共 {tree_total:3d} 个顶点；可达图（合并重复）共 {len(seen):3d} 个顶点，本阶段新增 {len(new)}")
    assert tree_total == 1 + 3 + 9 + 27 + 81 + 243


# =========================================================== 3. 稠密的圆
def check_dense_circle():
    print("3. 一直左转、Δt = 1：圆周上的顶点")
    for rho, name in ((1.0, "ρ_min = 1（周长 2π 是无理数）"), (1 / math.pi, "ρ_min = 1/π（周长 = 2）")):
        angles = []
        for k in range(1, 201):
            angles.append(mod2pi(k / rho))   # 以单位速度走 k 秒，转过 k/ρ 弧度
        distinct = len({round(a, 9) % round(TAU, 9) for a in angles})
        s = sorted(angles)
        gaps = [s[i + 1] - s[i] for i in range(len(s) - 1)] + [TAU - s[-1] + s[0]]
        print(f"   {name}: 200 步后不同的顶点 {distinct} 个，最大角间隙 {max(gaps):.4f} rad")


# =========================================================== 4. (14.9) 曼哈顿模型
def grid_bfs(free, start, goal, h):
    """在间距 h 的网格上做 BFS；free(x, y) 判断点是否自由，每条边检查中点与端点。"""
    sx, sy = start
    gx, gy = goal
    def snap(p):
        return (round(p[0] / h), round(p[1] / h))
    s, g = snap(start), snap(goal)
    if not free(s[0] * h, s[1] * h):
        return None
    Q = deque([s])
    par = {s: None}
    while Q:
        c = Q.popleft()
        if c == g:
            path = []
            while c is not None:
                path.append(c)
                c = par[c]
            return path[::-1]
        for dx, dy in ((-1, 0), (0, -1), (1, 0), (0, 1)):    # (14.9) 的四个动作
            n = (c[0] + dx, c[1] + dy)
            if n in par:
                continue
            x, y = n[0] * h, n[1] * h
            if not (0 <= x <= 1 and 0 <= y <= 1):
                continue
            if free(x, y) and free((c[0] + n[0]) * h / 2, (c[1] + n[1]) * h / 2):
                par[n] = c
                Q.append(n)
    return None


def check_manhattan():
    print("4. (14.9) 曼哈顿模型：搜索失败就把 Δt 减半")
    # 一堵墙上留一道宽 0.06 的缝（故意不对齐粗网格）
    def free(x, y):
        return not (0.45 <= x <= 0.55 and not (0.40 < y < 0.46))
    h = 0.25
    while True:
        p = grid_bfs(free, (0.1, 0.5), (0.9, 0.5), h)
        print(f"   Δt = {h:.6f}: {'找到，' + str(len(p) - 1) + ' 步' if p else '没找到'}")
        if p:
            break
        h /= 2


# =========================================================== 5. 双积分器格点
def lattice_states(k, dt=1.0):
    """(14.23)：从 (0,0) 出发 k 个阶段，返回所有 (i, j)，q = i·Δt²/2，q̇ = j·Δt。"""
    S = {(0, 0)}
    allS = {(0, 0)}
    for _ in range(k):
        T = set()
        for i, j in S:
            for u in (-1, 0, 1):
                T.add((i + 2 * j + u, j + u))
        S = T
        allS |= T
    return allS


def check_lattice():
    print("5. 图 14.13 / (14.23)：q_k = q_1 + i·½Δt²，q̇_k = q̇_1 + jΔt")
    for k in (1, 2, 3):
        A = lattice_states(k)
        assert all((i - j) % 2 == 0 for i, j in A)
        print(f"   {k} 个阶段后共 {len(A)} 个不同的状态；全部满足 i ≡ j (mod 2)（格点是「斜」的）")
    # 原点处 u = 0 不产生运动：第一阶段只多出 2 个新状态
    A1 = lattice_states(1)
    print(f"   第 1 阶段：{sorted(A1)}")


# =========================================================== 6. 可达锥
def check_cone():
    print("6. 图 14.14 / 习题 4：常值动作 u ∈ [−1,1]、时间 t ∈ [0,Δt] 的可达锥")
    q0, v0, dt = 0.0, 1.5, 1.0          # 取 v0 > Δt，整个锥里速度都为正
    worst = 0.0
    rnd = random.Random(3)
    for _ in range(20000):
        u = rnd.uniform(-1, 1)
        t = rnd.uniform(0, dt)
        q, v = q0 + v0 * t + 0.5 * u * t * t, v0 + u * t
        up = math.sqrt(v0 * v0 + 2 * (q - q0))                    # u = +1：q̇ = √(q̇0² + 2(q − q0))
        lo = math.sqrt(max(v0 * v0 - 2 * (q - q0), 0.0))          # u = −1：q̇ = √(q̇0² − 2(q − q0))
        worst = max(worst, v - up, lo - v)
    print(f"   上边界 q̇ = √(q̇0² + 2(q − q0))，下边界 q̇ = √(q̇0² − 2(q − q0))；随机 2 万个点越界的最大量 = {worst:.1e}")
    assert worst < 1e-9
    # 已知目标点 (q1, v1)：唯一的常值动作 t = 2(q1−q0)/(v0+v1)，u = (v1−v0)/t
    q0, v0, q1, v1 = 0.0, 0.5, 0.6, 0.9
    t = 2 * (q1 - q0) / (v0 + v1)
    u = (v1 - v0) / t
    print(f"   从 (0, 0.5) 到 (0.6, 0.9)：t = {t:.4f}，u = {u:.4f}（|u| ≤ 1 且 t ≤ Δt = 1，所以在锥里）")


# =========================================================== 7. Euler vs RK4
def euler(f, x, u, h):
    return [xi + h * fi for xi, fi in zip(x, f(x, u(0)))]


def rk4(f, x, u, h):
    w1 = f(x, u(0))
    w2 = f([xi + 0.5 * h * wi for xi, wi in zip(x, w1)], u(0.5 * h))
    w3 = f([xi + 0.5 * h * wi for xi, wi in zip(x, w2)], u(0.5 * h))
    w4 = f([xi + h * wi for xi, wi in zip(x, w3)], u(h))
    return [xi + h / 6 * (a + 2 * b + 2 * c + d) for xi, a, b, c, d in zip(x, w1, w2, w3, w4)]


def chain(n):
    """n 阶积分器链：x = (q, q̇, …, q^(n−1))，q^(n) = u。"""
    def f(x, u):
        return [x[i + 1] for i in range(n - 1)] + [u]
    return f


def simulate(method, f, x0, ufun, T, h):
    x, t = list(x0), 0.0
    N = max(1, round(T / h))
    h = T / N                      # 让步长恰好整除 T
    for _ in range(N):
        x = method(f, x, lambda s, t=t: ufun(t + s), h)
        t += h
    return x


def check_integrators():
    print("7. Euler (14.16) vs 四阶 Runge–Kutta (14.18)(14.19)：u(t) = cos t，积分到 T = 3，看 q(T) 的误差")
    T = 3.0
    exact = {1: math.sin(T), 2: 1 - math.cos(T), 3: T - math.sin(T)}
    for n in (1, 2, 3):
        row = []
        for h in (0.2, 0.1, 0.05):
            e1 = abs(simulate(euler, chain(n), [0.0] * n, math.cos, T, h)[0] - exact[n])
            e4 = abs(simulate(rk4, chain(n), [0.0] * n, math.cos, T, h)[0] - exact[n])
            row.append(f"h={h}: Euler {e1:.2e} / RK4 {e4:.2e}")
        print(f"   {n} 阶积分器  " + "；".join(row))
    # 常值动作时 RK4 对 ≤ 4 阶的积分器链是精确的
    e = abs(simulate(rk4, chain(2), [0.0, 0.0], lambda t: 1.0, 1.0, 0.25)[0] - 0.5)
    print(f"   常值 u = 1 的双积分器，q(1) = 1/2：RK4 误差 {e:.1e}；Euler 误差 {abs(simulate(euler, chain(2), [0.0, 0.0], lambda t: 1.0, 1.0, 0.25)[0] - 0.5):.4f}")

    # 弹簧（谐振子）q̈ = −q：相轨迹是圆，Euler 每步把半径放大 √(1 + h²)，一圈后向外漂
    def spring(x, u):
        return [x[1], -x[0]]
    for N in (20, 100):
        h = TAU / N
        xe = simulate(euler, spring, [1.0, 0.0], lambda t: 0.0, TAU, h)
        xr = simulate(rk4, spring, [1.0, 0.0], lambda t: 0.0, TAU, h)
        print(f"   谐振子 q̈ = −q 一周（应回到 (1, 0)）{N} 步: Euler 半径 {math.hypot(*xe):.4f}（理论 (1+h²)^(N/2) = {(1 + h * h) ** (N / 2):.4f}），RK4 误差 {math.hypot(xr[0] - 1, xr[1]):.1e}")
    def car(x, u):
        return [math.cos(x[2]), math.sin(x[2]), u]
    # 反向积分 (14.20)：对 −f 正向积分
    xf = simulate(rk4, car, [0, 0, 0], lambda t: 1.0, 1.0, 0.01)
    xb = simulate(rk4, lambda x, u: [-c for c in car(x, u)], xf, lambda t: 1.0, 1.0, 0.01)
    print(f"   (14.20) 先正向 1 秒再对 −f 积分 1 秒：回到 x(0) 的误差 {max(abs(c) for c in xb):.1e}")


# =========================================================== 8. 双积分器最短时间
def t_star(q, v):
    """补充：q̈ = u，|u| ≤ 1，从 (q, v) 到 (0, 0) 的最短时间（开关曲线 q = −v|v|/2）。"""
    s = q + v * abs(v) / 2
    if abs(s) < 1e-12:
        return abs(v)
    if s > 0:
        return v + 2 * math.sqrt(q + v * v / 2)
    return -v + 2 * math.sqrt(-q + v * v / 2)


def bangbang_sim(q, v, h=1e-4):
    """按开关曲线反馈 u = −sign(q + v|v|/2) 仿真，返回到达原点附近所用时间。"""
    t = 0.0
    while math.hypot(q, v) > 2e-3 and t < 50:
        s = q + v * abs(v) / 2
        u = -1.0 if s > 0 else 1.0
        if abs(s) < 1e-3:
            u = -math.copysign(1.0, v)
        q, v = q + v * h + 0.5 * u * h * h, v + u * h
        t += h
    return t


def check_tstar():
    print("8. 补充：双积分器回到原点的最短时间 T*（例 15.4 的 bang-bang 控制）")
    for q, v in ((1.0, 0.0), (-2.0, 0.0), (1.0, 1.0), (0.0, 2.0), (-1.0, 1.0)):
        print(f"   T*({q:+.1f}, {v:+.1f}) = {t_star(q, v):.4f}，按开关曲线仿真 ≈ {bangbang_sim(q, v):.3f}")
    print("   静止到静止走距离 d：T* = 2√d（例如 d = 1 → 2）")


# =========================================================== 9. Dubins 最短路径（补充，15.3.1）
def dubins_words(alpha, beta, d):
    """标准化后（起点 (0,0,α)，终点 (d,0,β)，ρ = 1）六种字的 (t, p, q)。"""
    sa, sb, ca, cb = math.sin(alpha), math.sin(beta), math.cos(alpha), math.cos(beta)
    c_ab = math.cos(alpha - beta)
    out = {}
    p2 = 2 + d * d - 2 * c_ab + 2 * d * (sa - sb)
    if p2 >= 0:
        tmp = math.atan2(cb - ca, d + sa - sb)
        out["LSL"] = (mod2pi(-alpha + tmp), math.sqrt(p2), mod2pi(beta - tmp))
    p2 = 2 + d * d - 2 * c_ab + 2 * d * (sb - sa)
    if p2 >= 0:
        tmp = math.atan2(ca - cb, d - sa + sb)
        out["RSR"] = (mod2pi(alpha - tmp), math.sqrt(p2), mod2pi(-beta + tmp))
    p2 = -2 + d * d + 2 * c_ab + 2 * d * (sa + sb)
    if p2 >= 0:
        p = math.sqrt(p2)
        tmp = math.atan2(-ca - cb, d + sa + sb) - math.atan2(-2.0, p)
        out["LSR"] = (mod2pi(-alpha + tmp), p, mod2pi(-beta + tmp))
    p2 = -2 + d * d + 2 * c_ab - 2 * d * (sa + sb)
    if p2 >= 0:
        p = math.sqrt(p2)
        tmp = math.atan2(ca + cb, d - sa - sb) - math.atan2(2.0, p)
        out["RSL"] = (mod2pi(alpha - tmp), p, mod2pi(beta - tmp))
    tmp = (6 - d * d + 2 * c_ab + 2 * d * (sa - sb)) / 8
    if abs(tmp) <= 1:
        p = mod2pi(TAU - math.acos(tmp))
        t = mod2pi(alpha - math.atan2(ca - cb, d - sa + sb) + p / 2)
        out["RLR"] = (t, p, mod2pi(alpha - beta - t + p))
    tmp = (6 - d * d + 2 * c_ab + 2 * d * (sb - sa)) / 8
    if abs(tmp) <= 1:
        p = mod2pi(TAU - math.acos(tmp))
        t = mod2pi(-alpha - math.atan2(ca - cb, d + sa - sb) + p / 2)
        out["LRL"] = (t, p, mod2pi(beta - alpha - t + p))
    return out


def dubins_shortest(q0, q1, rho=1.0, only=None):
    dx, dy = q1[0] - q0[0], q1[1] - q0[1]
    D = math.hypot(dx, dy)
    d = D / rho
    th = mod2pi(math.atan2(dy, dx)) if D > 1e-12 else 0.0
    alpha, beta = mod2pi(q0[2] - th), mod2pi(q1[2] - th)
    best = None
    for w, (t, p, q) in dubins_words(alpha, beta, d).items():
        if only and w not in only:
            continue
        L = (t + p + q) * rho
        if best is None or L < best[0] - 1e-12:
            best = (L, w, (t, p, q))
    return best


def dubins_endpoint(q0, word, seg, rho=1.0):
    x, y, th = q0
    for ch, s in zip(word, seg):
        w = {"L": 1 / rho, "R": -1 / rho, "S": 0.0}[ch]
        x, y, th = dubins_step(x, y, th, w, s * rho, rho)
    return x, y, th


def check_dubins():
    print("9. 补充（15.3.1 节）：Dubins 最短路径（ρ = 1）")
    rnd = random.Random(7)
    worst = 0.0
    for _ in range(3000):
        q0 = (rnd.uniform(-3, 3), rnd.uniform(-3, 3), rnd.uniform(0, TAU))
        q1 = (rnd.uniform(-3, 3), rnd.uniform(-3, 3), rnd.uniform(0, TAU))
        for w, seg in dubins_words(*[mod2pi(q0[2] - math.atan2(q1[1] - q0[1], q1[0] - q0[0])),
                                       mod2pi(q1[2] - math.atan2(q1[1] - q0[1], q1[0] - q0[0])),
                                       math.hypot(q1[0] - q0[0], q1[1] - q0[1])]).items():
            e = dubins_endpoint(q0, w, seg)
            err = max(abs(e[0] - q1[0]), abs(e[1] - q1[1]), abs(math.remainder(e[2] - q1[2], TAU)))
            worst = max(worst, err)
    print(f"   3000 对随机位形、六种字全部正向积分核对，终点最大误差 {worst:.1e}")
    assert worst < 1e-9
    for name, q1 in (("前进 0.5", (0.5, 0, 0)), ("后退 0.5", (-0.5, 0, 0)), ("左移 0.5", (0, 0.5, 0)),
                     ("前进 0.1", (0.1, 0, 0)), ("后退 0.1", (-0.1, 0, 0)), ("后退 0.01", (-0.01, 0, 0))):
        L, w, _ = dubins_shortest((0, 0, 0), q1)
        print(f"   从 (0,0,0) 到 {name} {q1}：长度 {L:.4f}（{w}）；欧氏距离 {math.hypot(q1[0], q1[1]):.2f}")


# =========================================================== 10. 例 14.6
def sdd_interval_line(a1, a2):
    """直线路径 τ(s) = (a1 s + b1, a2 s + b2)，U = [−1,1]²：s̈ = u_i / a_i 的交集。"""
    lo, hi = -math.inf, math.inf
    for a in (a1, a2):
        if a == 0:
            continue
        lo, hi = max(lo, -1 / abs(a)), min(hi, 1 / abs(a))
    return lo, hi


def check_ex146():
    print("10. 例 14.6：直线路径上允许的 s̈")
    for a1, a2 in ((1, 1), (2, 1), (1, 2), (1, -3), (0, 2)):
        lo, hi = sdd_interval_line(a1, a2)
        print(f"   a = ({a1}, {a2})：s̈ ∈ [{lo:.4f}, {hi:.4f}]，由 |a_i| 最大的那个分量决定")
    print("   ⇒ |a1| ≥ |a2| 时区间是 [−1/|a1|, 1/|a1|]；|a1| < |a2| 时是 [−1/|a2|, 1/|a2|]（原书第二种情形误写为 |a1| > |a2|）")
    # (14.39) 的正确形式：s̈ = (h'_i − τ_i'' ṡ²) / τ_i'。用数值微分核对 q̈ = τ' s̈ + τ'' ṡ²
    tau = lambda s: (math.cos(s), math.sin(2 * s))
    s0, sd, sdd = 0.7, 1.3, -0.4
    def q_of_t(t):
        s = s0 + sd * t + 0.5 * sdd * t * t
        return tau(s)
    h = 1e-4
    qdd_num = [(q_of_t(h)[i] - 2 * q_of_t(0)[i] + q_of_t(-h)[i]) / h / h for i in range(2)]
    d1 = (-math.sin(s0), 2 * math.cos(2 * s0))
    d2 = (-math.cos(s0), -4 * math.sin(2 * s0))
    qdd = [d1[i] * sdd + d2[i] * sd * sd for i in range(2)]
    print(f"   (14.34) 核对：q̈ 数值微分 {qdd_num[0]:.5f}, {qdd_num[1]:.5f}；τ's̈ + τ''ṡ² = {qdd[0]:.5f}, {qdd[1]:.5f}")
    for i in range(2):
        u = qdd[i]   # 双积分器 h'_i = u_i
        back = (u - d2[i] * sd * sd) / d1[i]
        print(f"   i = {i + 1}：(u_i − τ_i''ṡ²)/τ_i' = {back:.5f}（= s̈ = {sdd}）；按原书印的 u_i/τ_i' − τ_i''ṡ² 得 {u / d1[i] - d2[i] * sd * sd:.5f}")


# =========================================================== 11. 路径约束
class Path:
    """弧长参数化之外的一般参数路径 τ(s)，s ∈ [0,1]，用解析的一、二阶导数。"""
    def __init__(self, f, df, ddf):
        self.f, self.df, self.ddf = f, df, ddf


def accel_interval(path, s, sd):
    """U'(s, ṡ)：|τ_i' s̈ + τ_i'' ṡ²| ≤ 1，i = 1, 2 的交集。空集返回 None。"""
    d1, d2 = path.df(s), path.ddf(s)
    lo, hi = -math.inf, math.inf
    for i in range(2):
        a, b = d1[i], d2[i] * sd * sd
        if abs(a) < 1e-12:
            if abs(b) > 1 + 1e-12:
                return None
            continue
        l, h = (-1 - b) / a, (1 - b) / a
        if l > h:
            l, h = h, l
        lo, hi = max(lo, l), min(hi, h)
    return (lo, hi) if lo <= hi + 1e-12 else None


def limit_curve(path, s, sdmax=20.0):
    lo, hi = 0.0, sdmax
    if accel_interval(path, s, hi):
        return hi
    for _ in range(60):
        m = (lo + hi) / 2
        if accel_interval(path, s, m):
            lo = m
        else:
            hi = m
    return lo


def two_pass_time(path, N=4000):
    """补充：在细网格上做前向（最大加速）/ 反向（最大减速）两遍，得到最短时间速度剖面。
    只用来核对动态规划与 bang-bang 的结果。"""
    ds = 1.0 / N
    S = [k * ds for k in range(N + 1)]
    lim = [limit_curve(path, s) for s in S]
    v = [0.0] * (N + 1)                     # v = ṡ²
    for k in range(N):
        sd = math.sqrt(v[k])
        I = accel_interval(path, S[k], sd)
        a = I[1] if I else 0.0
        v[k + 1] = min(max(v[k] + 2 * ds * a, 0.0), lim[k + 1] ** 2)
    v[N] = 0.0
    for k in range(N, 0, -1):
        sd = math.sqrt(v[k])
        I = accel_interval(path, S[k], sd)
        a = I[0] if I else 0.0
        v[k - 1] = min(v[k - 1], max(v[k] - 2 * ds * a, 0.0))
    T = 0.0
    for k in range(N):
        sm = (math.sqrt(v[k]) + math.sqrt(v[k + 1])) / 2
        T += ds / max(sm, 1e-9)
    return T, lim


def check_path_constrained():
    print("11. 14.6.3 节：路径约束下的相平面 S")
    # 直线 τ(s) = (4s, 2s)：U' 恒为 [−1/4, 1/4]，静止到静止最短时间 2√(1/(1/4)) = 4
    line = Path(lambda s: (4 * s, 2 * s), lambda s: (4.0, 2.0), lambda s: (0.0, 0.0))
    T, _ = two_pass_time(line)
    print(f"   直线 (4s, 2s)：s̈ ∈ [−1/4, 1/4]，两遍法时间 {T:.4f}（解析 2√(1/0.25) = 4）")
    # 圆弧：航向 ψ ∈ (0, π/2) 时极限曲线 v² = (cos ψ + sin ψ)/κ（v = 物理速率），极限处的加速度 sin ψ − cos ψ
    R, L = 2.0, math.pi / 2 * 2.0
    def arc(s):
        psi = math.pi / 2 * s   # 航向从 0 转到 π/2 的四分之一圆（逆时针）
        return (R * math.sin(psi), R * (1 - math.cos(psi)))
    def darc(s):
        psi = math.pi / 2 * s
        return (L * math.cos(psi), L * math.sin(psi))
    def ddarc(s):
        psi = math.pi / 2 * s
        k = L * L / R
        return (-k * math.sin(psi), k * math.cos(psi))
    P = Path(arc, darc, ddarc)
    for psi_deg in (15, 45, 75):
        s = psi_deg / 90
        sd = limit_curve(P, s)
        v2 = (sd * L) ** 2
        psi = math.radians(psi_deg)
        print(f"   四分之一圆 R = 2，ψ = {psi_deg}°：极限速率² = {v2:.4f}，公式 (cos ψ + sin ψ)R = {(math.cos(psi) + math.sin(psi)) * R:.4f}")
    T, _ = two_pass_time(P)
    print(f"   四分之一圆静止到静止的最短时间（两遍法）≈ {T:.4f}")


# =========================================================== 12. 带插值的值迭代
def vi_double_integrator(n=61, lim=3.0, dt=0.1, goal_r=0.12, M=100.0, obstacle=None, iters=400):
    """(14.27)：在 n×n 网格 P 上做反向值迭代，双线性插值求 G*(x_{k+1})。
    「∞」用一个大数 M 代替：初值除目标外都是 M，越界也算 M；收敛后 ≥ 0.9M 的当作 ∞。
    这样插值时角上的「∞」不会让整片区域卡住（直接用 ∞ 的话，只要一个角是 ∞ 结果就是 ∞）。"""
    xs = [-lim + 2 * lim * i / (n - 1) for i in range(n)]
    h = xs[1] - xs[0]
    in_goal = lambda q, v: math.hypot(q, v) <= goal_r
    bad = lambda q, v: obstacle is not None and obstacle[0] <= q <= obstacle[1]
    G = [[0.0 if in_goal(xs[i], xs[j]) else M for j in range(n)] for i in range(n)]
    def interp(q, v):
        if in_goal(q, v):
            return 0.0
        if not (-lim <= q <= lim and -lim <= v <= lim) or bad(q, v):
            return M
        fi, fj = (q + lim) / h, (v + lim) / h
        i0, j0 = min(int(fi), n - 2), min(int(fj), n - 2)
        a, b = fi - i0, fj - j0
        return ((1 - a) * (1 - b) * G[i0][j0] + a * (1 - b) * G[i0 + 1][j0]
                + (1 - a) * b * G[i0][j0 + 1] + a * b * G[i0 + 1][j0 + 1])
    for it in range(iters):
        change = 0.0
        for i in range(n):
            for j in range(n):
                q, v = xs[i], xs[j]
                if in_goal(q, v) or bad(q, v):
                    continue
                best = M
                for u in (-1.0, 0.0, 1.0):
                    c = dt + interp(q + v * dt + 0.5 * u * dt * dt, v + u * dt)
                    best = min(best, c)
                change = max(change, abs(G[i][j] - best))
                G[i][j] = best
        if change < 1e-7:
            break
    return xs, G, it + 1


def check_vi():
    print("12. 14.5 节：双积分器上带插值的值迭代 (14.27)，与 T* 对照")
    xs, G, its = vi_double_integrator()
    lim, h = 3.0, xs[1] - xs[0]
    print(f"   61×61 网格、Δt = 0.1、目标半径 0.12，{its} 轮后收敛")
    for q, v in ((2.0, 0.0), (-2.0, 1.0), (1.0, 1.0), (0.0, -2.0), (-1.0, 1.0)):
        i, j = round((q + lim) / h), round((v + lim) / h)
        print(f"   G*({q:+.1f}, {v:+.1f}) = {G[i][j]:.3f}；T*（到原点）= {t_star(q, v):.3f}")
    # 有障碍时（区间 [1.0, 1.3] 挡在右边）：q < 1 且向右冲得太快的状态 G* = ∞（落在 X_ric 里）
    xs, G, its = vi_double_integrator(obstacle=(1.0, 1.3))
    i, j = round((0.5 + lim) / h), round((1.5 + lim) / h)
    i2, j2 = round((0.5 + lim) / h), round((0.6 + lim) / h)
    print(f"   障碍 [1.0, 1.3]：G*(0.5, 1.5) = {'∞' if G[i][j] >= 90 else round(G[i][j], 3)}（刹车距离 1.125 > 0.5，在 X_ric 里）；"
          f"G*(0.5, 0.6) = {G[i2][j2]:.3f}")


# =========================================================== 13. 双切线 LPM
def check_bitangent():
    print("13. 图 14.23：双切线 LPM（只用 LSL/LSR/RSL/RSR）与 Dubins 最优长度")
    rnd = random.Random(11)
    worse = 0
    ratio = []
    for _ in range(2000):
        q0 = (0.0, 0.0, rnd.uniform(0, TAU))
        q1 = (rnd.uniform(-4, 4), rnd.uniform(-4, 4), rnd.uniform(0, TAU))
        opt = dubins_shortest(q0, q1)
        csc = dubins_shortest(q0, q1, only=("LSL", "LSR", "RSL", "RSR"))
        if csc is None:
            continue
        assert csc[0] >= opt[0] - 1e-9
        if csc[0] > opt[0] + 1e-9:
            worse += 1
        ratio.append(csc[0] / opt[0])
    print(f"   2000 个随机问题：CSC 比最优长的有 {worse} 个，最大比值 {max(ratio):.3f}")


# =========================================================== 14. 打靶
def check_shooting():
    print("14. (14.47) 打靶法：Dubins 式小车（单位速度），转向 ω(t) = w1 + w2 t，t_F = 3")
    goal = (1.5, 1.5)
    def end(w1, w2, N=300):
        x = y = th = 0.0
        h = 3.0 / N
        for k in range(N):
            t = k * h
            om = w1 + w2 * (t + h / 2)
            x += h * math.cos(th + om * h / 2)
            y += h * math.sin(th + om * h / 2)
            th += om * h
        return x, y
    def cost(w):
        x, y = end(*w)
        return (x - goal[0]) ** 2 + (y - goal[1]) ** 2
    def descend(w, iters=500):
        for _ in range(iters):
            e = 1e-6
            g = [(cost([w[0] + e, w[1]]) - cost([w[0] - e, w[1]])) / (2 * e),
                 (cost([w[0], w[1] + e]) - cost([w[0], w[1] - e])) / (2 * e)]
            c0, step = cost(w), 0.2
            while step > 1e-12:                             # 回溯线搜索
                w2 = [w[0] - step * g[0], w[1] - step * g[1]]
                if cost(w2) < c0:
                    w = w2
                    break
                step /= 2
        return w
    for w0 in ([0.5, 0.0], [0.0, 0.5], [0.0, 0.0], [-0.5, 0.0]):
        w = descend(list(w0))
        print(f"   初值 (w1, w2) = ({w0[0]:+.1f}, {w0[1]:+.1f}) → ({w[0]:+.4f}, {w[1]:+.4f})，终点误差² = {cost(w):.2e}")
    print("   ⇒ 初值不同，梯度下降会停在不同的局部极小（14.7 节：结果强烈依赖初始猜测）")


if __name__ == "__main__":
    for fn in (check_ex141, check_ex144, check_dense_circle, check_manhattan, check_lattice, check_cone,
               check_integrators, check_tstar, check_dubins, check_ex146, check_path_constrained, check_vi,
               check_bitangent, check_shooting):
        fn()
        print()
