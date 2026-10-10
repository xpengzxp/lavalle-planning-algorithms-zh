"""第 13 章「微分模型」参考实现：核对教程页面上出现的每一个数值，以及原书笔误的判断。

只用 Python 标准库。运行：

    python3 part4/code/ch13_differential_models.py

各节编号与页面对应：
   1. 13.1.1  平面上的速度约束：8 个例子 + ẋ = x 的可达集（随机积分曲线检验）
   2. 13.1.1  例 13.1、例 13.2：参数式满足隐式约束；(13.9) 的方形回路与 Lie 括号（补充）
   3. 13.1.2  简单车 (13.15)：转弯半径 ρ = L/tan φ；平行泊车的「摆动」（补充）
   4. 13.1.2  差速驱动 (13.16)(13.17)、独轮车 (13.18)、图 13.4 的「转—走—转」
   5. 13.1.2  拖车 (13.19)：与「每节拖车轮子不侧滑」逐步核对
   6. 13.1.3  飞机 (13.20) 的螺旋线；滚球：旋转矩阵实现与 (13.21) 的对照、方形回路的自转（补充）
   7. 13.1.3  困在曲面上 (13.22)–(13.25)
   8. 13.2.1  (13.29)–(13.32) 的特征值；双积分器；积分器链
   9. 13.2.2  例 13.5 的特征值与可控性矩阵（补充）；13.2.3 例 13.6 非完整积分器：Δx₃ = 2·面积
  10. 13.2.4  在动作前加积分器：转向角的光滑性（(13.15)、(13.47)、(13.48)）
  11. 13.3.2  例 13.7 月球着陆器（(13.60) 的笔误）；例 13.8 摆 (13.61)–(13.65)
  12. 13.3.3  (13.85) yaw-pitch-roll 角速度换算的符号（原书笔误）
  13. 13.3.3  Euler 方程 (13.101)(13.102)、能量 (13.106)；四元数 (13.103) 的问题（原书笔误）
  14. 13.3.3  带轮胎侧滑的车 (13.110)–(13.113)：线性化特征值与符号约定
  15. 13.4.1  变分：例 13.9、例 13.10、例 13.11（(13.128)、(13.132) 的笔误）
  16. 13.4.2  例 13.13 两连杆机械臂：由拉格朗日量数值求 M、C、g，与书中公式逐项对照
  17. 13.4.3  例 13.14 球面上的质点：沿大圆运动
  18. 13.4.4  Hamilton 方程的符号（(13.198) 的笔误）、Liouville 定理
  19. 13.5    例 13.16 带自然干扰的简单车：系统误差 vs 噪声；例 13.18 杀人司机（补充的简单策略）
  20. 习题    习题 1、2、3 的答案核对
"""
import math
import random


def header(t):
    print("\n" + "=" * 72 + "\n" + t + "\n" + "=" * 72)


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def check(cond, msg):
    print(("  [OK]  " if cond else "  [!!]  ") + msg)
    if not cond:
        raise SystemExit("检查失败：" + msg)


# ---------------------------------------------------------------- 小工具：向量、矩阵、RK4
def add(a, b):
    return [x + y for x, y in zip(a, b)]


def scale(a, s):
    return [x * s for x in a]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(a):
    return math.sqrt(dot(a, a))


def matmul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]


def matvec(A, v):
    return [sum(A[i][k] * v[k] for k in range(len(v))) for i in range(len(A))]


def transpose(A):
    return [list(r) for r in zip(*A)]


def skew(w):
    return [[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]]


def rk4(f, x, dt):
    k1 = f(x)
    k2 = f(add(x, scale(k1, dt / 2)))
    k3 = f(add(x, scale(k2, dt / 2)))
    k4 = f(add(x, scale(k3, dt)))
    return [xi + dt / 6 * (a + 2 * b + 2 * c + d) for xi, a, b, c, d in zip(x, k1, k2, k3, k4)]


def simulate(f, x, T, dt):
    n = max(1, int(round(T / dt)))
    h = T / n                      # 恰好走到 T
    for _ in range(n):
        x = rk4(f, x, h)
    return x


def eig2(A):
    """2×2 实矩阵的特征值（可能是复数）。"""
    tr = A[0][0] + A[1][1]
    det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    disc = tr * tr / 4 - det
    if disc >= 0:
        r = math.sqrt(disc)
        return [complex(tr / 2 + r, 0), complex(tr / 2 - r, 0)]
    r = math.sqrt(-disc)
    return [complex(tr / 2, r), complex(tr / 2, -r)]


def solve2(M, b):
    det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
    return [(b[0] * M[1][1] - M[0][1] * b[1]) / det, (M[0][0] * b[1] - b[0] * M[1][0]) / det]


def wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


# ====================================================================== 1
def part1():
    header("1. 13.1.1 平面速度约束：随机积分曲线落在预言的可达集中")
    rnd = random.Random(1)

    # 每个约束：在 U(q) 中随机抽速度的方法 + 可达集判据（相对起点 d = q - q0）
    def samp_dir(cond):
        while True:
            v = [rnd.uniform(-2, 2), rnd.uniform(-2, 2)]
            if cond(v):
                return v

    a, b, c = 1.0, 2.0, 1.0
    cases = [
        ("ẋ > 0", lambda q: samp_dir(lambda v: v[0] > 0), lambda d: d[0] > 0),
        ("ẋ ≥ 0", lambda q: samp_dir(lambda v: v[0] >= 0), lambda d: d[0] >= 0),
        ("ẋ > 0, ẏ > 0", lambda q: samp_dir(lambda v: v[0] > 0 and v[1] > 0), lambda d: d[0] > 0 and d[1] > 0),
        ("ẋ = 0", lambda q: [0.0, rnd.uniform(-2, 2)], lambda d: abs(d[0]) < 1e-12),
        ("aẋ + bẏ = 0", lambda q: scale([b, -a], rnd.uniform(-2, 2)), lambda d: abs(a * d[0] + b * d[1]) < 1e-9),
        # aẋ + bẏ = -c：取 v = -c/(a²+b²)·(a,b) + t·(b,-a)
        ("aẋ + bẏ + c = 0", lambda q: add(scale([a, b], -c / (a * a + b * b)), scale([b, -a], rnd.uniform(-3, 3))),
         lambda d: a * d[0] + b * d[1] < 0),      # 整个开半平面 a·d < 0（因为 c > 0）
        ("ẋ² + ẏ² ≤ 1", lambda q: samp_dir(lambda v: v[0] ** 2 + v[1] ** 2 <= 1), lambda d: True),
        ("ẋ² + ẏ² ≥ 1", lambda q: samp_dir(lambda v: v[0] ** 2 + v[1] ** 2 >= 1), lambda d: True),
    ]
    for name, sample, pred in cases:
        ok = True
        for trial in range(200):
            q = [0.3, -0.2]
            q0 = q[:]
            for _ in range(rnd.randint(1, 6)):
                v = sample(q)
                tau = rnd.uniform(0.05, 0.8)
                q = add(q, scale(v, tau))
            d = [q[0] - q0[0], q[1] - q0[1]]
            ok &= pred(d)
        check(ok, f"{name}：200 条随机分段常速度积分曲线都落在预言的可达集里")
    # aẋ + bẏ + c = 0 不能停：(0,0) 不满足
    check(a * 0 + b * 0 + c != 0, "aẋ + bẏ + c = 0（c ≠ 0）不允许 ẋ = ẏ = 0：不能停下")
    # 反方向：半平面里任意一点都能到达（两段速度的正组合）
    tgt = [-2.0, 0.3]
    # 解 τ1 v1 + τ2 v2 = tgt，v_i = p + t_i w，p = -c(a,b)/(a²+b²)，w = (b,-a)
    p = scale([a, b], -c / (a * a + b * b))
    w = [b, -a]
    T = (a * tgt[0] + b * tgt[1]) / (-c)          # 总时间由 a·d = -c·T 决定
    s = dot(add(tgt, scale(p, -T)), w) / dot(w, w)
    check(T > 0, f"目标 {tgt} 在半平面 a·d < 0 里，所需总时间 T = {T:.3f} > 0")
    reach = add(scale(p, T), scale(w, s))
    check(close(reach[0], tgt[0]) and close(reach[1], tgt[1]), "  只用一个常速度 v = p + (s/T)w 走 T 秒就能到达")

    # ẋ = x：x(t) = x0·e^t，从 x0 > 0 出发永远到不了 y 轴；从 y 轴出发永远留在 y 轴
    for x0 in [0.5, 0.0, -0.4]:
        q = [x0, 0.0]
        for _ in range(6):
            yd = rnd.uniform(-2, 2)
            f = lambda s_, yd=yd: [s_[0], yd]
            q = simulate(f, q, 0.3, 0.01)
        if x0 > 0:
            check(q[0] > x0, f"ẋ = x，x0 = {x0}：x 只增不减（终点 x = {q[0]:.4f}）")
        elif x0 < 0:
            check(q[0] < x0, f"ẋ = x，x0 = {x0}：x 只减不增（终点 x = {q[0]:.4f}）")
        else:
            check(q[0] == 0.0, "ẋ = x，从 y 轴出发：积分曲线永远留在 y 轴上")


# ====================================================================== 2
def part2():
    header("2. 例 13.1、例 13.2；(13.9) 的方形回路")
    # 例 13.1：q = (1,2) 处允许的速度是 (u, 1)
    q = (1.0, 2.0)
    for u in [-1.0, 0.0, 2.5]:
        v = (u, q[0])
        check(v[1] == q[0] == 1.0, f"例 13.1：q = (1,2)，u = {u} → q̇ = {v}，满足 ẏ = x")
    # 例 13.2：(13.8) 满足 (13.7)，(13.10) 满足 (13.9)
    rnd = random.Random(2)
    ok1 = ok2 = True
    for _ in range(100):
        u1, u2, q3 = rnd.uniform(-3, 3), rnd.uniform(-3, 3), rnd.uniform(-7, 7)
        qd = (u1, u2, 2 * u1 - u2)
        ok1 &= close(2 * qd[0] - qd[1] - qd[2], 0.0)
        qd = (u1, u2, math.cos(q3) * u1 - math.sin(q3) * u2)
        ok2 &= close(math.cos(q3) * qd[0] - math.sin(q3) * qd[1] - qd[2], 0.0)
    check(ok1, "(13.8) 对任何 u 都满足 Pfaffian 约束 (13.7)")
    check(ok2, "(13.10) 对任何 u 都满足 Pfaffian 约束 (13.9)")

    # 方形回路：u1 走 τ，u2 走 τ，-u1 走 τ，-u2 走 τ
    def loop(g, q, tau):
        for (u1, u2) in [(1, 0), (0, 1), (-1, 0), (0, -1)]:
            q = simulate(lambda s_: g(s_, u1, u2), q, tau, tau / 400)
        return q
    g7 = lambda s_, u1, u2: [u1, u2, 2 * u1 - u2]
    g9 = lambda s_, u1, u2: [u1, u2, math.cos(s_[2]) * u1 - math.sin(s_[2]) * u2]
    for tau in [0.4, 0.2, 0.1]:
        e7 = loop(g7, [0, 0, 0], tau)
        e9 = loop(g9, [0, 0, 0], tau)
        print(f"    τ = {tau}: (13.7) 回路终点 = ({e7[0]:+.2e}, {e7[1]:+.2e}, {e7[2]:+.2e})；"
              f"(13.9) 回路终点 q3 = {e9[2]:+.5f}，−τ² = {-tau * tau:+.5f}")
        check(max(abs(x) for x in e7) < 1e-12, f"  (13.7)：方形回路回到原点（τ = {tau}）")
        check(abs(e9[2] / (-tau * tau) - 1) < 1.5 * tau, f"  (13.9)：方形回路后 q3/(−τ²) = {e9[2] / (-tau * tau):.4f} → 1（误差 O(τ)，τ = {tau}）")
    # Lie 括号 [g1, g2]（补充）：g1 = (1,0,cos q3)，g2 = (0,1,−sin q3)
    q3 = 0.7
    h = 1e-6
    g1 = lambda q3_: [1, 0, math.cos(q3_)]
    g2 = lambda q3_: [0, 1, -math.sin(q3_)]
    dg1 = [(a - b) / (2 * h) for a, b in zip(g1(q3 + h), g1(q3 - h))]   # 只依赖 q3
    dg2 = [(a - b) / (2 * h) for a, b in zip(g2(q3 + h), g2(q3 - h))]
    br = [dg2[i] * g1(q3)[2] - dg1[i] * g2(q3)[2] for i in range(3)]
    check(close(br[0], 0) and close(br[1], 0) and abs(br[2] + 1) < 1e-8, f"[g1, g2] = ({br[0]:.1f}, {br[1]:.1f}, {br[2]:.6f}) = (0,0,−1)，不在 span{{g1,g2}} 中 → (13.9) 不可积")


# ====================================================================== 3
def car(L):
    return lambda s, us, uphi: [us * math.cos(s[2]), us * math.sin(s[2]), us / L * math.tan(uphi)]


def part3():
    header("3. 13.1.2 简单车 (13.15)")
    L = 1.0
    for deg in [10, 30, 45, 60]:
        phi = math.radians(deg)
        rho = L / math.tan(phi)
        f = car(L)
        # 走半圈：所需时间 π·ρ（速度 1）
        s = simulate(lambda x: f(x, 1.0, phi), [0, 0, 0], math.pi * rho, 1e-3)
        diam = math.hypot(s[0], s[1])
        check(abs(diam - 2 * rho) < 1e-6, f"φ = {deg}°：转弯半径 ρ = L/tanφ = {rho:.4f}，半圈后直径 = {diam:.4f}")
    # 平行泊车的摆动（补充）：倒车左打满转 α，倒车右打满转 α，再直行 2ρ sinα
    phimax = math.radians(35)
    rho = L / math.tan(phimax)
    f = car(L)
    print(f"    φmax = 35°，ρmin = {rho:.4f}")
    for alpha_deg in [30, 15, 5]:
        al = math.radians(alpha_deg)
        x = [0.0, 0.0, 0.0]
        x = simulate(lambda s: f(s, -1.0, -phimax), x, rho * al, 1e-4)   # 倒车，后轴中心向右后方
        ymax = abs(x[1])
        x = simulate(lambda s: f(s, -1.0, +phimax), x, rho * al, 1e-4)
        xmin = x[0]
        x = simulate(lambda s: f(s, 1.0, 0.0), x, 2 * rho * math.sin(al), 1e-4)
        lat = 2 * rho * (1 - math.cos(al))
        check(abs(x[2]) < 1e-9 and abs(x[0]) < 1e-6 and abs(abs(x[1]) - lat) < 1e-6,
              f"摆动 α = {alpha_deg}°：净侧移 {abs(x[1]):.5f} = 2ρ(1−cosα)，纵向最多后退 {abs(xmin):.4f} = 2ρ sinα，θ 回到 0")
    print("    α → 0 时侧移 ≈ ρα²、纵向偏移 ≈ 2ρα：侧移每次很小，但所需空间也任意小 → 重复多次即可（STLC 的直觉）")


# ====================================================================== 4
def part4():
    header("4. 差速驱动 (13.16)(13.17)、独轮车 (13.18)")
    r, L = 0.1, 0.5
    dd = lambda s, ul, ur: [r / 2 * (ul + ur) * math.cos(s[2]), r / 2 * (ul + ur) * math.sin(s[2]), r / L * (ur - ul)]
    dd2 = lambda s, uw, upsi: [r * uw * math.cos(s[2]), r * uw * math.sin(s[2]), r / L * upsi]
    rnd = random.Random(4)
    ok = True
    for _ in range(50):
        s = [rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-3, 3)]
        ul, ur = rnd.uniform(-5, 5), rnd.uniform(-5, 5)
        a, b = dd(s, ul, ur), dd2(s, (ur + ul) / 2, ur - ul)
        ok &= all(close(x, y) for x, y in zip(a, b))
    check(ok, "(13.16) 与 (13.17) 在 u_ω = (u_r+u_l)/2、u_ψ = u_r − u_l 下逐项相等")
    v_both = dd([0, 0, 0], 4, 4)[0]
    v_one = dd([0, 0, 0], 0, 4)[0]
    check(close(v_one, v_both / 2), f"只转一个轮子：平移速度 {v_one} 是两轮同速 {v_both} 的一半")
    rot = dd([0, 0, 0], -3, 3)
    check(rot[0] == 0 and rot[1] == 0 and rot[2] > 0, f"u_l = −u_r：原地转（θ̇ = {rot[2]:.2f}，u_r > 0 时逆时针）")
    # 瞬时转动中心：R = (L/2)(u_r+u_l)/(u_r−u_l)
    ul, ur = 2.0, 3.0
    R = L / 2 * (ur + ul) / (ur - ul)
    v = dd([0, 0, 0], ul, ur)
    check(close(v[0] / v[2], R), f"u_l = 2，u_r = 3：轴中心沿半径 R = (L/2)(u_r+u_l)/(u_r−u_l) = {R:.4f} 的圆")
    # 图 13.4：转—走—转，轴中心路程 = 欧氏距离
    q0, q1 = (0.0, 0.0, 0.3), (2.0, 1.0, -1.0)
    d = math.hypot(q1[0] - q0[0], q1[1] - q0[1])
    head = math.atan2(q1[1] - q0[1], q1[0] - q0[0])
    rot_total = abs(wrap(head - q0[2])) + abs(wrap(q1[2] - head))
    print(f"    图 13.4：从 {q0} 到 {q1}，轴中心路程 = {d:.4f}（欧氏距离），两次原地转共 {math.degrees(rot_total):.1f}°（不计入路程）")
    # 独轮车 = 差速驱动 L = 1、u_s = r u_σ（书中说法），这里核对 θ̇ = u_ω 对应 u_ψ = u_ω·L/r
    uni = lambda s, us, uw: [us * math.cos(s[2]), us * math.sin(s[2]), uw]
    s = [0.2, 0.1, 0.4]
    a = uni(s, 0.7, 1.3)
    b = dd2(s, 0.7 / r, 1.3 * L / r)
    check(all(close(x, y) for x, y in zip(a, b)), "独轮车 (13.18) 可由差速驱动模拟：u_ω' = u_s/r，u_ψ = u_ω·L/r")


# ====================================================================== 5
def trailer_rhs(s, phi, L, d):
    """(13.19)：状态 (x, y, θ0, θ1, …, θk)。"""
    k = len(d)
    th = s[2:]
    out = [s_ * 0 for s_ in s]
    sp = 1.0
    out[0] = sp * math.cos(th[0])
    out[1] = sp * math.sin(th[0])
    out[2] = sp / L * math.tan(phi)
    for i in range(1, k + 1):
        prod = 1.0
        for j in range(1, i):
            prod *= math.cos(th[j - 1] - th[j])
        out[2 + i] = sp / d[i - 1] * prod * math.sin(th[i - 1] - th[i])
    return out


def part5():
    header("5. 拖车 (13.19)：每节拖车的轮子都不侧滑")
    L, d = 1.0, [0.8, 0.7, 0.6]
    s = [0.0, 0.0, 0.3, 0.1, -0.2, 0.05]
    phi = lambda t: 0.5 * math.sin(0.7 * t)
    dt = 1e-3
    worst = 0.0
    prev = None
    t = 0.0
    for step in range(6000):
        # 后轴中心位置：p0 = (x, y)，p_i = p_{i-1} − d_i (cos θ_i, sin θ_i)
        pts = [(s[0], s[1])]
        for i, di in enumerate(d):
            th = s[3 + i]
            pts.append((pts[-1][0] - di * math.cos(th), pts[-1][1] - di * math.sin(th)))
        if prev is not None:
            for i in range(1, len(pts)):
                vx, vy = (pts[i][0] - prev[i][0]) / dt, (pts[i][1] - prev[i][1]) / dt
                th = s[2 + i]
                worst = max(worst, abs(-vx * math.sin(th) + vy * math.cos(th)))
        prev = pts
        s = rk4(lambda x: trailer_rhs(x, phi(t), L, d), s, dt)
        t += dt
    check(worst < 1e-3, f"沿 6 秒轨迹，各拖车轴中心的侧向速度最大 {worst:.2e}（数值差分误差量级）≈ 0")
    print(f"    C 的维数 = k + 3 = {len(s)}（3 节拖车）")


# ====================================================================== 6
def rot_axis(axis, ang):
    x, y, z = axis
    c, s_, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return [[c + x * x * C, x * y * C - z * s_, x * z * C + y * s_],
            [y * x * C + z * s_, c + y * y * C, y * z * C - x * s_],
            [z * x * C - y * s_, z * y * C + x * s_, c + z * z * C]]


def roll_ball(R, v, rho, dt):
    """纯滚动（无自转）：ω = ẑ × v / ρ，Ṙ = [ω]× R（空间角速度）。"""
    w = scale(cross([0, 0, 1], v + [0] if len(v) == 2 else v), 1 / rho)
    ang = norm(w) * dt
    if ang == 0:
        return R
    return matmul(rot_axis(scale(w, 1 / norm(w)), ang), R)


def part6():
    header("6. 飞机螺旋线 (13.20)；滚球（补充：旋转矩阵实现）")
    uz, uw = 0.3, 1.5
    f = lambda s: [math.cos(s[3]), math.sin(s[3]), uz, uw]
    s = simulate(f, [0, 0, 0, 0], 2 * math.pi / uw, 1e-4)
    check(abs(s[0]) < 1e-8 and abs(s[1]) < 1e-8 and close(s[2], 2 * math.pi * uz / uw),
          f"u_z = {uz}，u_ω = {uw}：转一圈回到同一 (x,y)，升高 2π u_z/u_ω = {s[2]:.4f}，投影半径 1/u_ω = {1 / uw:.4f}")

    # 滚球：(13.21) 的接触点速度与球上接触点速度一致（纯滚动的必要条件）
    rnd = random.Random(6)
    ok = True
    for _ in range(50):
        th, ps = rnd.uniform(-1.2, 1.2), rnd.uniform(-3, 3)
        u1, u2, rho = rnd.uniform(-2, 2), rnd.uniform(-2, 2), 0.5
        xd = -u1 * rho * math.sin(ps) - u2 * rho * math.cos(ps)
        yd = -u1 * rho * math.cos(ps) + u2 * rho * math.sin(ps)
        thd, phd = -u2, u1 / math.cos(th)
        v_plane = math.hypot(xd, yd)
        v_ball = rho * math.hypot(thd, math.cos(th) * phd)   # 球面上 (θ 纬度, φ 经度) 的弧速度
        ok &= close(v_plane, v_ball)
    check(ok, "(13.21)：平面上接触点的速度 = 球面上接触点的速度 = ρ√(u1²+u2²)（不打滑）")

    # 方形回路后的自转（holonomy）：边长 a，球半径 ρ → 绕竖直轴转 ≈ a²/ρ²
    rho = 1.0
    for a in [0.4, 0.2, 0.1]:
        R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        n = 400
        for v in [(1, 0), (0, 1), (-1, 0), (0, -1)]:
            for _ in range(n):
                R = roll_ball(R, [v[0] * a, v[1] * a, 0], rho, 1 / n)
        # 净旋转的角度与轴
        ang = math.acos(max(-1, min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)))
        axis_z = (R[1][0] - R[0][1]) / (2 * math.sin(ang)) if ang > 1e-12 else 0
        print(f"    方形边长 a = {a}：球回到原位置，净转角 {ang:.6f} rad，转轴 z 分量 {axis_z:+.4f}；a²/ρ² = {a * a:.6f}")
        check(abs(ang - a * a) < 0.1 * a * a and abs(abs(axis_z) - 1) < 0.3 * a, f"  a = {a}：净旋转 ≈ 绕竖直轴转 a²/ρ²（逆时针绕圈 → 球顺时针自转）")


# ====================================================================== 7
def part7():
    header("7. 困在曲面上 (13.22)–(13.25)")
    rnd = random.Random(7)
    x = [0.6, 0.8]
    r0 = math.hypot(*x)
    t = 0.0
    for k in range(4000):
        u = math.sin(3 * t) + rnd.uniform(-2, 2)
        x = rk4(lambda s: [s[1] * u, -s[0] * u], x, 1e-3)
        t += 1e-3
    check(abs(math.hypot(*x) - r0) < 1e-9, f"任意 u(t)：x² + y² 始终 = {r0 ** 2:.6f}（终点 {math.hypot(*x) ** 2:.12f}）")
    ok = all(close(2 * a * (b * u) + 2 * b * (-a * u), 0) for a, b, u in [(0.3, 0.4, 1.7), (-1, 2, -0.5)])
    check(ok, "(13.22) 的速度满足 2xẋ + 2yẏ = 0 (13.25)")


# ====================================================================== 8
def part8():
    header("8. 13.2.1 相空间：(13.29)–(13.32)、双积分器、积分器链")
    A = [[0, 1], [-1, 3]]
    ev = eig2(A)
    check(close(ev[0].real, (3 + math.sqrt(5)) / 2) and close(ev[1].real, (3 - math.sqrt(5)) / 2),
          f"(13.32) ẋ = Ax，A = [[0,1],[−1,3]] 的特征值 (3±√5)/2 = {ev[0].real:.4f}, {ev[1].real:.4f}：两个都为正 → 不稳定结点")
    # 双积分器：u 常数 → q(t) = q0 + q̇0 t + u t²/2
    q0, v0, u, T = 0.5, -1.0, 0.8, 2.0
    s = simulate(lambda x: [x[1], u], [q0, v0], T, 1e-3)
    check(close(s[0], q0 + v0 * T + u * T * T / 2) and close(s[1], v0 + u * T),
          f"双积分器 (13.35)：q(2) = {s[0]:.4f} = q0 + q̇0·T + uT²/2")
    # 漂移：x2 ≠ 0 时，没有 u 能让 ẋ = 0
    check(all(abs(x2) > 0 for x2 in [0.1, -2]), "双积分器在 x2 ≠ 0 处 ẋ1 = x2 ≠ 0：任何 u 都停不下（漂移 drift）")
    # 积分器链：q^(3) = u 常数 → q(t) = u t³ / 6
    s = simulate(lambda x: [x[1], x[2], 1.0], [0, 0, 0], 1.5, 1e-3)
    check(close(s[0], 1.5 ** 3 / 6), f"积分器链 k = 3：q(1.5) = {s[0]:.5f} = t³/6")


# ====================================================================== 9
def part9():
    header("9. 例 13.5（补充：特征值、可控性）；例 13.6 非完整积分器")
    A = [[0, math.sqrt(2), 1], [1, -1, 4], [2, 0, 1]]
    B = [[1, 0], [0, 1], [1, 1]]
    x, u = [1.0, -1.0, 0.5], [0.3, -0.2]
    xd = add(matvec(A, x), matvec(B, u))
    print(f"    (13.38)：x = {x}，u = {u} → ẋ = ({xd[0]:.4f}, {xd[1]:.4f}, {xd[2]:.4f})")
    # 特征多项式 det(λI − A) = λ³ + c2 λ² + c1 λ + c0；用牛顿法找实根
    tr = A[0][0] + A[1][1] + A[2][2]
    minors = (A[0][0] * A[1][1] - A[0][1] * A[1][0]) + (A[0][0] * A[2][2] - A[0][2] * A[2][0]) + (A[1][1] * A[2][2] - A[1][2] * A[2][1])
    det = (A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0])
           + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]))
    p = lambda l: l ** 3 - tr * l * l + minors * l - det
    roots = []
    for g in [-3.0, 0.0, 3.0]:
        l = g
        for _ in range(100):
            dp = 3 * l * l - 2 * tr * l + minors
            if dp == 0:
                break
            l -= p(l) / dp
        if abs(p(l)) < 1e-9 and all(abs(l - r) > 1e-6 for r in roots):
            roots.append(l)
    print(f"    tr A = {tr:g}，主子式之和 = {minors:.4f}，det A = {det:.4f}；特征多项式 λ³ − (tr A)λ² + (主子式和)λ − det A 的实根 {[round(r, 4) for r in roots]}")
    check(any(r > 0 for r in roots), "A 有正实特征值：u = 0 时状态会发散（不稳定）")
    # 可控性矩阵 [B, AB, A²B] 的秩
    AB = matmul(A, B)
    A2B = matmul(A, AB)
    Cm = [B[i] + AB[i] + A2B[i] for i in range(3)]
    # 取前三列的行列式
    M3 = [row[:3] for row in Cm]
    d3 = (M3[0][0] * (M3[1][1] * M3[2][2] - M3[1][2] * M3[2][1]) - M3[0][1] * (M3[1][0] * M3[2][2] - M3[1][2] * M3[2][0])
          + M3[0][2] * (M3[1][0] * M3[2][1] - M3[1][1] * M3[2][0]))
    check(abs(d3) > 1e-9, f"可控性矩阵 [B, AB, A²B] 秩 = 3（前三列行列式 {d3:.4f} ≠ 0）→ 能从任何状态到达任何状态（15.1.3 节）")

    # 非完整积分器：x3 的变化 = ∮ x1 dx2 − x2 dx1 = 2 × (x1,x2) 平面上围成的有向面积
    for (cx, cy, rad) in [(0, 0, 1.0), (1.5, -0.5, 0.5)]:
        s = [cx + rad, cy, 0.0]
        n = 20000
        for k in range(n):
            t = 2 * math.pi * k / n
            u1, u2 = -rad * math.sin(t) * 2 * math.pi, rad * math.cos(t) * 2 * math.pi
            s = rk4(lambda x: [u1, u2, x[0] * u2 - x[1] * u1], s, 1 / n)
        area = math.pi * rad * rad
        check(abs(s[2] - 2 * area) < 1e-3, f"沿圆（中心 ({cx},{cy})，半径 {rad}）逆时针走一圈：Δx3 = {s[2]:.5f} = 2·面积 = {2 * area:.5f}（与圆心位置无关）")


# ====================================================================== 10
def part10():
    header("10. 13.2.4 在动作前加积分器：转向角的光滑性")
    # 方波转向命令：每 1 秒在 ±0.4 之间切换
    cmd = lambda t: 0.4 if int(t) % 2 == 0 else -0.4
    dt = 1e-3
    # k = 0：φ = 命令（不连续）；k = 1：φ̇ = K(命令 − φ) 受限 |φ̇| ≤ 1；k = 2：二阶
    phi1 = 0.0
    phi2, om2 = 0.0, 0.0
    jumps0 = jumps1 = jumps2 = 0.0
    prev0 = cmd(0)
    for k in range(int(6 / dt)):
        t = k * dt
        c = cmd(t)
        jumps0 = max(jumps0, abs(c - prev0))
        prev0 = c
        uw = max(-1.0, min(1.0, 8 * (c - phi1)))          # (13.47) 的 u_ω 有界
        n1 = phi1 + dt * uw
        jumps1 = max(jumps1, abs(n1 - phi1) / dt)
        phi1 = n1
        ua = max(-4.0, min(4.0, 30 * (c - phi2) - 8 * om2))  # (13.48) 的 u_α 有界
        n_om = om2 + dt * ua
        jumps2 = max(jumps2, abs(n_om - om2) / dt)
        om2 = n_om
        phi2 += dt * om2
    print(f"    k = 0 (13.15)：φ 的最大跳变 {jumps0:.2f}（不连续）")
    print(f"    k = 1 (13.47)：|φ̇| 最大 {jumps1:.2f} ≤ 1（φ 连续且 Lipschitz）")
    print(f"    k = 2 (13.48)：|ω̇| = |φ̈| 最大 {jumps2:.2f} ≤ 4（φ 是 C¹）")
    check(jumps0 > 0.7 and jumps1 <= 1 + 1e-9 and jumps2 <= 4 + 1e-9, "每多一个积分器，φ 就多一阶光滑（C^{k−1}）")


# ====================================================================== 11
def part11():
    header("11. 例 13.7 月球着陆器；例 13.8 摆")
    m, g = 1.0, 1.622
    fl = fr = 0.5
    fu = 2.0
    acts = [(a, b, c) for a in (0, 1) for b in (0, 1) for c in (0, 1)]
    check(len(acts) == 8, "U 有 2³ = 8 个动作 (u_l, u_r, u_u)")
    for (ul, ur, uu) in [(0, 0, 0), (1, 0, 1), (1, 1, 0)]:
        x3d = (ul * fl - ur * fr) / m          # (13.58)
        x4d = uu * fu / m - g                  # (13.59)
        print(f"    u = ({ul},{ur},{uu})：ẋ3 = {x3d:+.3f}，ẋ4 = {x4d:+.3f}")
    print("    原书 (13.60) 第三式印成 (f_s/m)(u_l f_l − u_r f_r)，与 (13.58) 的 (1/m)(…) 不符：f_s 是多余的")
    check(fu / m > g, f"f_u/m = {fu / m} > g = {g}：开底部推进器能减速下降")

    # 摆：(13.61)→(13.62)；小角度周期 2π√(L/g)
    gg, Lp, mp = 9.8, 1.0, 1.0
    f = lambda x: [x[1], -gg / Lp * math.sin(x[0])]
    x = [0.05, 0.0]
    T0 = 2 * math.pi * math.sqrt(Lp / gg)
    # 用过零找半周期
    t, dt, last = 0.0, 1e-4, x[0]
    crossings = []
    while len(crossings) < 2 and t < 10:
        x = rk4(f, x, dt)
        t += dt
        if last > 0 >= x[0] or last < 0 <= x[0]:
            crossings.append(t)
        last = x[0]
    T = 2 * (crossings[1] - crossings[0])
    check(abs(T - T0) < 1e-3, f"(13.62) 小角度周期 {T:.4f} ≈ 2π√(L/g) = {T0:.4f}")
    # (13.63)→(13.64)：mLθ̈ = −mg sinθ − kLθ̇ 两边除以 mL
    k = 0.3
    for th, om in [(0.4, 1.1), (-2.0, 0.3)]:
        lhs = (-mp * gg * math.sin(th) - k * Lp * om) / (mp * Lp)
        rhs = -gg / Lp * math.sin(th) - k / mp * om
        check(close(lhs, rhs), f"(13.64)：θ = {th}, θ̇ = {om} 时 ẋ2 = {rhs:.4f}（由 (13.63) 除以 mL 得到）")
    # 无阻尼时能量守恒
    E = lambda x: 0.5 * mp * (Lp * x[1]) ** 2 - mp * gg * Lp * math.cos(x[0])
    x = [2.0, 0.0]
    E0 = E(x)
    x = simulate(f, x, 10.0, 1e-3)
    check(abs(E(x) - E0) < 1e-7, f"无阻尼摆的能量守恒：E(0) = {E0:.6f}，E(10) = {E(x):.6f}")


# ====================================================================== 12
def Rz(a):
    return [[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]]


def Ry(b):
    return [[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]]


def Rx(c):
    return [[1, 0, 0], [0, math.cos(c), -math.sin(c)], [0, math.sin(c), math.cos(c)]]


def ypr(a, b, c):
    return matmul(Rz(a), matmul(Ry(b), Rx(c)))     # (3.42)


def part12():
    header("12. (13.85) 由角速度 ω 求 yaw/pitch/roll 角的变化率")
    rnd = random.Random(12)
    worst_book = worst_fix = 0.0
    for _ in range(20):
        a, b, c = rnd.uniform(-3, 3), rnd.uniform(-1.2, 1.2), rnd.uniform(-3, 3)
        ad, bd, cd = rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)
        h = 1e-6
        R0 = ypr(a, b, c)
        R1 = ypr(a + ad * h, b + bd * h, c + cd * h)
        Rm = ypr(a - ad * h, b - bd * h, c - cd * h)
        Rdot = [[(R1[i][j] - Rm[i][j]) / (2 * h) for j in range(3)] for i in range(3)]
        W = matmul(Rdot, transpose(R0))        # (13.84)：Ṙ = [ω]× R → [ω]× = Ṙ Rᵀ
        w = [W[2][1], W[0][2], W[1][0]]
        cb = math.cos(b)
        book = [[math.cos(a), math.sin(a), 0],
                [-math.sin(a) * cb, math.cos(a) * cb, 0],
                [math.cos(a) * math.sin(b), math.sin(a) * math.sin(b), -cb]]
        fixed = [row[:] for row in book]
        fixed[2][2] = cb
        gbook = [x / cb for x in matvec(book, w)]
        gfix = [x / cb for x in matvec(fixed, w)]
        true = [cd, bd, ad]                    # 按 (13.85) 左边的顺序 (γ̇, β̇, α̇)
        worst_book = max(worst_book, max(abs(x - y) for x, y in zip(gbook, true)))
        worst_fix = max(worst_fix, max(abs(x - y) for x, y in zip(gfix, true)))
    print(f"    按原书 (13.85)（右下角 −cosβ）：与真实 (γ̇, β̇, α̇) 的最大误差 {worst_book:.3f}")
    print(f"    把右下角改成 +cosβ：最大误差 {worst_fix:.2e}")
    check(worst_book > 0.1 and worst_fix < 1e-6, "(13.85) 第三行最后一项应为 +cosβ，即 α̇ = ω3 + tanβ(ω1 cosα + ω2 sinα)")
    # 最简单的反例：只绕世界 z 轴转（β = γ = 0），α̇ 应等于 ω3
    print("    反例：β = γ = 0、ω = (0,0,1)：真实 α̇ = 1，原书给 α̇ = −1")


# ====================================================================== 13
def qmul(p, q):
    a1, b1, c1, d1 = p
    a2, b2, c2, d2 = q
    return [a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
            a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
            a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
            a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2]


def qrot(q):
    a, b, c, d = q
    return [[a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)],
            [2 * (b * c + a * d), a * a - b * b + c * c - d * d, 2 * (c * d - a * b)],
            [2 * (b * d - a * c), 2 * (c * d + a * b), a * a - b * b - c * c + d * d]]


def euler_rhs(I, N=(0, 0, 0)):
    I1, I2, I3 = I
    return lambda w: [(N[0] + (I2 - I3) * w[1] * w[2]) / I1,
                      (N[1] + (I3 - I1) * w[2] * w[0]) / I2,
                      (N[2] + (I1 - I2) * w[0] * w[1]) / I3]


def part13():
    header("13. 刚体转动：Euler 方程 (13.101)(13.102)、(13.106)、四元数 (13.103)")
    I = (1.0, 2.0, 3.0)
    rnd = random.Random(13)
    # (13.101) 与 N = Iω̇ + ω×(Iω) (13.98) 一致
    ok = True
    for _ in range(20):
        w = [rnd.uniform(-2, 2) for _ in range(3)]
        wd = [rnd.uniform(-2, 2) for _ in range(3)]
        Iw = [I[i] * w[i] for i in range(3)]
        N98 = add([I[i] * wd[i] for i in range(3)], cross(w, Iw))
        N101 = [I[0] * wd[0] + (I[2] - I[1]) * w[1] * w[2], I[1] * wd[1] + (I[0] - I[2]) * w[2] * w[0], I[2] * wd[2] + (I[1] - I[0]) * w[0] * w[1]]
        ok &= all(close(x, y) for x, y in zip(N98, N101))
    check(ok, "(13.101) 逐项等于 (13.98) N = Iω̇ + ω × (Iω)（I 为对角阵 (13.99)）")
    # 无外力矩：动能 T = ½ωᵀIω 与角动量大小 |Iω| 守恒
    f = euler_rhs(I)
    w = [0.05, 1.0, 0.05]
    T0 = 0.5 * sum(I[i] * w[i] ** 2 for i in range(3))
    H0 = norm([I[i] * w[i] for i in range(3)])
    wmin2 = 1.0
    for k in range(20000):
        w = rk4(f, w, 1e-3)
        wmin2 = min(wmin2, w[1])
    T1 = 0.5 * sum(I[i] * w[i] ** 2 for i in range(3))
    H1 = norm([I[i] * w[i] for i in range(3)])
    check(abs(T1 - T0) < 1e-8 and abs(H1 - H0) < 1e-8, f"N = 0：T = {T0:.6f} → {T1:.6f}，|Iω| = {H0:.6f} → {H1:.6f}（守恒）")
    check(wmin2 < -0.9, f"中间轴（I22）附近出发：ω2 从 1.0 翻到 {wmin2:.3f}（中间轴不稳定，补充）")
    w = [1.0, 0.05, 0.05]
    lo = 1.0
    for k in range(20000):
        w = rk4(f, w, 1e-3)
        lo = min(lo, w[0])
    check(lo > 0.9, f"最小惯量轴（I11）附近出发：ω1 始终 ≥ {lo:.3f}（稳定）")

    # 四元数：原书 (13.103) vs 正确的 q̇ = ½ q ⊗ (0, ω_body)
    def book_q(q, w):
        a, b, c, d = q
        bd = w[2] * c - w[1] * d
        cd = w[0] * d - w[2] * b
        dd = w[1] * b - w[0] * c
        nb = [b + 1e-3 * bd, c + 1e-3 * cd, d + 1e-3 * dd]
        s2 = sum(x * x for x in nb)
        return [math.sqrt(max(0.0, 1 - s2))] + nb   # 「a 由 a²+b²+c²+d² = 1 恢复」

    def true_q(q, w):
        dq = scale(qmul(q, [0] + list(w)), 0.5)
        q = add(q, scale(dq, 1e-3))
        n = norm(q)
        return [x / n for x in q]
    w = [0.0, 0.0, 1.0]                     # 绕机体 z 轴匀速转，1 rad/s
    qb = [1.0, 0.0, 0.0, 0.0]
    qt = [1.0, 0.0, 0.0, 0.0]
    for k in range(1000):                   # 1 秒
        qb = book_q(qb, w)
        qt = true_q(qt, w)
    ang_b = 2 * math.acos(min(1, abs(qb[0])))
    ang_t = 2 * math.acos(min(1, abs(qt[0])))
    print(f"    从单位四元数出发，ω = (0,0,1) 积分 1 秒：按原书 (13.103) 转了 {ang_b:.4f} rad；按 q̇ = ½q⊗(0,ω) 转了 {ang_t:.4f} rad")
    check(ang_b == 0.0 and abs(ang_t - 1.0) < 1e-3, "(13.103) 从 (1,0,0,0) 出发 b、c、d 恒为 0：物体永远不转——缺了含 a 的项和系数 1/2")
    # 正确公式与 Ṙ = R[ω]× 一致
    q = [0.3, -0.5, 0.7, 0.4]
    q = scale(q, 1 / norm(q))
    wb = [0.4, -1.1, 0.8]
    dq = scale(qmul(q, [0] + wb), 0.5)
    h = 1e-6
    Rp = qrot(add(q, scale(dq, h)))
    Rm = qrot(add(q, scale(dq, -h)))
    Rdot = [[(Rp[i][j] - Rm[i][j]) / (2 * h) for j in range(3)] for i in range(3)]
    target = matmul(qrot(q), skew(wb))
    check(all(abs(Rdot[i][j] - target[i][j]) < 1e-6 for i in range(3) for j in range(3)),
          "q̇ = ½ q⊗(0, ω)：对应 Ṙ = R[ω]×（ω 在机体系，与 Euler 方程 (13.102) 配套）")
    print("    分量：ȧ = −½(bω1+cω2+dω3)，ḃ = ½(aω1+cω3−dω2)，ċ = ½(aω2+dω1−bω3)，ḋ = ½(aω3+bω2−cω1)")


# ====================================================================== 14
def part14():
    header("14. 带轮胎侧滑的车 (13.110)–(13.113)")
    m, cf, cr, a, b, I, s = 1460.0, 17000.0, 20000.0, 1.2, 1.5, 2170.0, 27.0

    def jac(sign):
        # sign = +1：原书字面；sign = −1：轮胎力改成减号（等价于 c_f, c_r 取负，SAE 约定）
        A11 = sign * (cf + cr) / (m * s)
        A12 = -s + sign * (a * cf - b * cr) / (m * s)
        A21 = sign * (a * cf - b * cr) / (I * s)
        A22 = sign * (a * a * cf + b * b * cr) / (I * s)
        return [[A11, A12], [A21, A22]]
    eb = eig2(jac(+1))
    ef = eig2(jac(-1))
    fmt = lambda e: f"{e.real:+.4f}" + (f"{e.imag:+.4f}i" if abs(e.imag) > 1e-12 else "")
    print(f"    原书字面（c_f, c_r > 0）：(v, ω) 线性化的特征值 {fmt(eb[0])}, {fmt(eb[1])}")
    print(f"    轮胎力取恢复方向（补充）：特征值 {fmt(ef[0])}, {fmt(ef[1])}")
    check(max(e.real for e in eb) > 0, "按字面代入书中的正数参数：有正实部特征值 → 侧滑速度自发增长（不合物理）")
    check(max(e.real for e in ef) < 0, "轮胎力取恢复方向：两个特征值实部都为负 → 稳定")
    # 稳态横摆角速度（补充）：与运动学简单车对比
    L = a + b
    phi = math.radians(2.0)
    J = jac(-1)
    # 物理写法：f_f = c_f(φ − (v+aω)/s)，f_r = c_r(bω − v)/s；输入项 B = (c_f/m, a c_f/I)·φ
    Bv = [cf / m * phi, a * cf / I * phi]
    ss = solve2(J, [-Bv[0], -Bv[1]])
    w_kin = s * math.tan(phi) / L
    K = m * (b * cr - a * cf) / (L * cf * cr)
    w_formula = s * phi / (L + K * s * s)
    print(f"    φ = 2°，s = 27 m/s：稳态横摆角速度 {ss[1]:.4f} rad/s，侧滑速度 v = {ss[0]:+.4f} m/s；运动学简单车 s·tanφ/L = {w_kin:.4f}")
    check(abs(ss[1] - w_formula) < 1e-6 and ss[1] < w_kin, f"不足转向（b c_r > a c_f）：ω_ss = sφ/(L + K s²) = {w_formula:.4f} < 运动学值")


# ====================================================================== 15
def part15():
    header("15. 13.4.1 变分法：例 13.9、13.10、13.11")
    # 例 13.9：L = √(1+ẋ²) 的泛函是弧长；直线是极值，加扰动 εh 后变长
    n = 2000
    ts = [i / n for i in range(n + 1)]
    xline = lambda t: 0.2 + 0.5 * t
    hbump = lambda t: math.sin(math.pi * t) ** 2

    def Phi(L, x, eps, T=1.0):
        tot = 0.0
        for i in range(n):
            t0, t1 = ts[i] * T, ts[i + 1] * T
            xa, xb = x(t0) + eps * hbump(t0 / T), x(t1) + eps * hbump(t1 / T)
            xm, xd = (xa + xb) / 2, (xb - xa) / (t1 - t0)
            tot += L(xm, xd, (t0 + t1) / 2) * (t1 - t0)
        return tot
    arc = lambda x, xd, t: math.sqrt(1 + xd * xd)
    vals = [Phi(arc, xline, e) for e in (-0.1, 0.0, 0.1)]
    check(vals[1] < vals[0] and vals[1] < vals[2] and abs(vals[1] - math.sqrt(1.25)) < 1e-9,
          f"弧长：Φ(ε) = {vals[0]:.6f}, {vals[1]:.6f}, {vals[2]:.6f}（ε = −0.1, 0, 0.1）；直线 = √1.25")
    # 例 13.10：L = x³ + ẋ²，Euler–Lagrange 给出 ẍ = 3x²/2
    xd_dd = lambda x: 3 * x * x / 2
    # 打靶：x(0) = 0.5，x(1) = 1.0
    def shoot(v0):
        s_ = [0.5, v0]
        s_ = simulate(lambda y: [y[1], xd_dd(y[0])], s_, 1.0, 1e-3)
        return s_[0]
    lo, hi = -2.0, 2.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if shoot(mid) > 1.0:
            hi = mid
        else:
            lo = mid
    v0 = (lo + hi) / 2
    traj = {}
    s_ = [0.5, v0]
    for i in range(1001):
        traj[i] = s_[0]
        s_ = rk4(lambda y: [y[1], xd_dd(y[0])], s_, 1e-3)
    xe = lambda t: traj[min(1000, int(round(t * 1000)))]
    # 用分段线性插值算 Φ
    def xi(t):
        k = min(999, int(t * 1000))
        f = t * 1000 - k
        return traj[k] * (1 - f) + traj[k + 1] * f
    L10 = lambda x, xd, t: x ** 3 + xd * xd
    d1 = (Phi(L10, xi, 1e-3) - Phi(L10, xi, -1e-3)) / 2e-3
    dline = (Phi(L10, lambda t: 0.5 + 0.5 * t, 1e-3) - Phi(L10, lambda t: 0.5 + 0.5 * t, -1e-3)) / 2e-3
    print(f"    例 13.10：x(0) = 0.5、x(1) = 1 的极值曲线初速度 ẋ(0) = {v0:.5f}")
    check(abs(d1) < 1e-4 and abs(dline) > 1e-3, f"  dΦ/dε 在极值曲线上 = {d1:.2e} ≈ 0；在直线上 = {dline:.4f} ≠ 0")
    # 例 13.11：落体，L = ½mq̇² − mgq；真实轨迹使作用量驻定
    mm, g = 2.0, 9.8
    q0, v = 0.0, 3.0
    T = 0.6
    qtrue = lambda t: q0 + v * t - g * t * t / 2
    Lfall = lambda q, qd, t: 0.5 * mm * qd * qd - mm * g * q
    dPhi = (Phi(Lfall, qtrue, 1e-3, T) - Phi(Lfall, qtrue, -1e-3, T)) / 2e-3
    check(abs(dPhi) < 1e-4, f"落体：真实抛物线上 dΦ/dε = {dPhi:.2e} ≈ 0（Hamilton 原理）")
    # (13.128) 的符号：mq̈ = −∂V/∂q = −mg，所以 d/dt(mq̇) + ∂V/∂q = 0
    check(close(mm * (-g) + mm * g, 0.0), "(13.128) 应为 d/dt(mq̇) + ∂V/∂q = 0（原书印成减号）；(13.135) m q̈3 + mg = 0 与此一致")
    print("    (13.132) 末尾的「= 0」是多余的：L = ½m(q̇1²+q̇2²+q̇3²) − mgq3 并不恒为 0")


# ====================================================================== 16
class TwoLink:
    """例 13.13：θ2 是相对角（图 13.13），d1 = 第一节长度，ℓi = 关节到质心的距离。"""

    def __init__(self, m1=1.0, m2=0.8, d1=1.0, l1=0.5, l2=0.4, I1=0.08, I2=0.05, g=9.8):
        self.m1, self.m2, self.d1, self.l1, self.l2, self.I1, self.I2, self.g = m1, m2, d1, l1, l2, I1, I2, g

    def energy_terms(self, q, qd):
        t1, t2 = q
        w1, w2 = qd
        # 质心位置（正确写法：第二节质心用 θ1 + θ2）
        p1 = (self.l1 * math.cos(t1), self.l1 * math.sin(t1))
        p2 = (self.d1 * math.cos(t1) + self.l2 * math.cos(t1 + t2), self.d1 * math.sin(t1) + self.l2 * math.sin(t1 + t2))
        v1 = (-self.l1 * math.sin(t1) * w1, self.l1 * math.cos(t1) * w1)
        v2 = (-self.d1 * math.sin(t1) * w1 - self.l2 * math.sin(t1 + t2) * (w1 + w2),
              self.d1 * math.cos(t1) * w1 + self.l2 * math.cos(t1 + t2) * (w1 + w2))
        K = 0.5 * self.m1 * dot(v1, v1) + 0.5 * self.I1 * w1 ** 2 + 0.5 * self.m2 * dot(v2, v2) + 0.5 * self.I2 * (w1 + w2) ** 2
        V = self.m1 * self.g * p1[1] + self.m2 * self.g * p2[1]
        return K, V

    def M_book(self, q):
        c2 = math.cos(q[1])
        m11 = self.I1 + self.m1 * self.l1 ** 2 + self.I2 + self.m2 * (self.d1 ** 2 + self.l2 ** 2 + 2 * self.d1 * self.l2 * c2)
        m12 = self.I2 + self.m2 * (self.l2 ** 2 + self.d1 * self.l2 * c2)
        m22 = self.I2 + self.m2 * self.l2 ** 2
        return [[m11, m12], [m12, m22]]

    def hcoef(self, q):
        return self.m2 * self.d1 * self.l2 * math.sin(q[1])

    def C(self, q, qd, book_sign=False):
        h = self.hcoef(q)
        c21 = -qd[0] if not book_sign else qd[0]
        return [[-h * qd[1], -h * (qd[0] + qd[1])], [-h * c21, 0.0]]

    def gvec(self, q):
        t1, t2 = q
        g1 = (self.m1 * self.l1 + self.m2 * self.d1) * self.g * math.cos(t1) + self.m2 * self.l2 * self.g * math.cos(t1 + t2)
        g2 = self.m2 * self.l2 * self.g * math.cos(t1 + t2)
        return [g1, g2]

    def rhs(self, u=(0.0, 0.0), book_sign=False):
        def f(x):
            q, qd = x[:2], x[2:]
            M = self.M_book(q)
            Cq = matvec(self.C(q, qd, book_sign), qd)
            gg = self.gvec(q)
            qdd = solve2(M, [u[0] - Cq[0] - gg[0], u[1] - Cq[1] - gg[1]])   # (13.148)
            return list(qd) + qdd
        return f


def part16():
    header("16. 例 13.13 两连杆机械臂：由拉格朗日量数值求 M、C、g，与书中公式对照")
    arm = TwoLink()
    rnd = random.Random(16)
    hstep = 1e-5
    okM = okC = okg = okBook = okRow2 = True
    for _ in range(10):
        q = [rnd.uniform(-3, 3), rnd.uniform(-3, 3)]
        qd = [rnd.uniform(-2, 2), rnd.uniform(-2, 2)]
        # M = ∂²K/∂q̇²（K 是 q̇ 的二次型）
        Mnum = [[0, 0], [0, 0]]
        for i in range(2):
            for j in range(2):
                e = [[0, 0], [0, 0]]
                def K_at(a, b):
                    v = list(qd)
                    v[i] += a
                    v[j] += b
                    return arm.energy_terms(q, v)[0]
                Mnum[i][j] = (K_at(hstep, hstep) - K_at(hstep, -hstep) - K_at(-hstep, hstep) + K_at(-hstep, -hstep)) / (4 * hstep * hstep)
        Mb = arm.M_book(q)
        okM &= all(abs(Mnum[i][j] - Mb[i][j]) < 1e-4 for i in range(2) for j in range(2))
        # g = ∂V/∂q
        gnum = []
        for i in range(2):
            qa, qb = list(q), list(q)
            qa[i] += hstep
            qb[i] -= hstep
            gnum.append((arm.energy_terms(qa, qd)[1] - arm.energy_terms(qb, qd)[1]) / (2 * hstep))
        okg &= all(abs(a - b) < 1e-5 for a, b in zip(gnum, arm.gvec(q)))
        # Christoffel (13.147)：c_ijk = ½(∂m_ij/∂q_k + ∂m_ik/∂q_j − ∂m_jk/∂q_i)
        dM = []
        for k in range(2):
            qa, qb = list(q), list(q)
            qa[k] += hstep
            qb[k] -= hstep
            Ma, Mb2 = arm.M_book(qa), arm.M_book(qb)
            dM.append([[(Ma[i][j] - Mb2[i][j]) / (2 * hstep) for j in range(2)] for i in range(2)])
        Cn = [[sum(0.5 * (dM[k][i][j] + dM[j][i][k] - dM[i][j][k]) * qd[k] for k in range(2)) for j in range(2)] for i in range(2)]
        Cc = arm.C(q, qd)
        okC &= all(abs(Cn[i][j] - Cc[i][j]) < 1e-5 for i in range(2) for j in range(2))
        Cbk = arm.C(q, qd, book_sign=True)
        okBook &= abs(Cbk[1][0] - Cn[1][0]) > 1e-6 or abs(qd[0] * arm.hcoef(q)) < 1e-6
        # (13.161) 第二行：m21 θ̈1 + m22 θ̈2 + r θ̇1² + g2 = u2（原书把 m21、m22 印反）
        r = arm.hcoef(q)
        row2 = Cn[1][0] * qd[0] + Cn[1][1] * qd[1]
        okRow2 &= abs(row2 - r * qd[0] ** 2) < 1e-5
    check(okM, "M(q)：数值 ∂²K/∂q̇² 与 (13.156) 一致（K 用 ½m₂ṗ·ṗ，第二节质心用 θ1+θ2）")
    check(okg, "g(q)：∂V/∂q = ((m1ℓ1+m2d1)g cosθ1 + m2ℓ2 g cos(θ1+θ2),  m2ℓ2 g cos(θ1+θ2))")
    check(okC, "C(q,q̇)：Christoffel (13.147) 给出 −h[[θ̇2, θ̇1+θ̇2], [−θ̇1, 0]]，h = m2 d1 ℓ2 sinθ2")
    check(okBook, "原书 (13.159) 的 (2,1) 元印成 +θ̇1（乘上前面的 −h 后符号反了）")
    check(okRow2, "(13.161) 第二行的速度项 r θ̇1² 正确（r = h），但质量项应为 m21θ̈1 + m22θ̈2")

    # 能量守恒：u = 0 时 K + V 守恒；用原书 (13.159) 的 C 则不守恒
    for book in (False, True):
        x = [0.9, 0.6, 0.0, 0.0]
        E0 = sum(arm.energy_terms(x[:2], x[2:]))
        drift = 0.0
        f = arm.rhs(book_sign=book)
        for k in range(5000):
            x = rk4(f, x, 1e-3)
            drift = max(drift, abs(sum(arm.energy_terms(x[:2], x[2:])) - E0))
        tag = "原书 (13.159) 的 C" if book else "正确的 C"
        print(f"    u = 0，从 θ = (0.9, 0.6) 静止释放 5 秒：用{tag}，能量最大漂移 {drift:.2e}")
        if book:
            check(drift > 1e-2, "  原书 (13.159) 的符号会凭空产生 / 消耗能量")
        else:
            check(drift < 1e-6, "  正确的 C：能量守恒（数值误差量级）")


# ====================================================================== 17
def part17():
    header("17. 例 13.14 球面上的质点：沿大圆运动")
    # 约束动力学：q̈ = −λ q（λ 由约束 |q| = 1 决定）：λ = |q̇|²
    q = [1.0, 0.0, 0.0]
    v = [0.0, 0.6, 0.8]
    nrm = cross(q, v)
    nrm = scale(nrm, 1 / norm(nrm))
    x = q + v
    f = lambda s: s[3:] + scale(s[:3], -dot(s[3:], s[3:]) / dot(s[:3], s[:3]))
    worst = 0.0
    for k in range(6000):
        x = rk4(f, x, 1e-3)
        worst = max(worst, abs(dot(nrm, x[:3])))
    check(worst < 1e-6 and abs(norm(x[:3]) - 1) < 1e-6, f"6 秒内质点始终在平面 c·q = 0 上（最大偏离 {worst:.1e}）且 |q| = 1：大圆 (13.178)")
    print("    (13.177) 写成 q̈i − 2qiλ1 = 0；按 (13.172) 和 m = 2 直接推导得 2q̈i + 2qiλ1 = 0。两者只差 λ 的缩放和符号（书中也说乘子可取负），不影响结论")


# ====================================================================== 18
def part18():
    header("18. 13.4.4 Hamilton 方程的符号 (13.198)；Liouville 定理")
    m, g, L = 1.0, 9.8, 1.0
    H = lambda q, p: p * p / (2 * m * L * L) - m * g * L * math.cos(q)
    dHdq = lambda q, p: m * g * L * math.sin(q)
    dHdp = lambda q, p: p / (m * L * L)
    right = lambda s: [dHdp(*s), -dHdq(*s)]
    wrong = lambda s: [dHdp(*s), +dHdq(*s)]
    # p = ∂L/∂q̇ = mL²q̇；正确的方程恢复 mL²θ̈ = −mgL sinθ
    s = [0.7, 0.3]
    qdd = right(s)[1] / (m * L * L)
    check(close(qdd, -g / L * math.sin(s[0])), "q̇ = ∂H/∂p，ṗ = −∂H/∂q 恢复摆的方程 θ̈ = −(g/L) sinθ")
    for name, f in (("正确 ṗ = −∂H/∂q", right), ("原书 ṗ = +∂H/∂q", wrong)):
        x = [1.0, 0.0]
        E0 = H(*x)
        x = simulate(f, x, 1.0, 1e-4)
        print(f"    {name}：H 从 {E0:.4f} 变成 {H(*x):.4f}")
    xa = simulate(right, [1.0, 0.0], 1.0, 1e-4)
    xb = simulate(wrong, [1.0, 0.0], 1.0, 1e-4)
    check(abs(H(*xa) - H(1.0, 0.0)) < 1e-8 and abs(H(*xb) - H(1.0, 0.0)) > 0.1, "只有带负号的版本守恒能量（dH/dt = 0）")

    # Liouville：一小块初值区域的面积在演化中不变（用多边形近似）
    def area(P):
        return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2
    for name, f, k in (("无阻尼", right, 0.0), ("有阻尼 k = 0.5", None, 0.5)):
        if f is None:
            f = lambda s, k=k: [dHdp(*s), -dHdq(*s) - k * s[1]]
        P = [[0.5 + 0.2 * math.cos(2 * math.pi * i / 400), 0.5 + 0.2 * math.sin(2 * math.pi * i / 400)] for i in range(400)]
        A0 = area(P)
        P = [simulate(f, p, 1.5, 1e-3) for p in P]
        A1 = area(P)
        print(f"    {name}：相空间中一块圆盘的面积 {A0:.5f} → {A1:.5f}")
        if k == 0:
            check(abs(A1 - A0) < 1e-3, "  Hamilton 系统保持相体积（Liouville）")
        else:
            check(A1 < 0.6 * A0, "  加阻尼（非保守力）后相体积收缩 → 才可能渐近稳定")


# ====================================================================== 19
def part19():
    header("19. 13.5 例 13.16 带自然干扰的简单车；例 13.18 杀人司机（补充）")
    L, us, uphi, thmax = 1.0, 1.0, 0.0, math.radians(10)
    T, dt = 4.0, 0.01
    rnd = random.Random(19)

    def run(gamma_fn):
        s = [0.0, 0.0, 0.0]
        t = 0.0
        while t < T - 1e-12:
            gm = gamma_fn(t)
            s = rk4(lambda x: [us * math.cos(x[2]), us * math.sin(x[2]), us / L * math.tan(uphi + gm)], s, dt)
            t += dt
        return s
    ends_const = [run(lambda t, g=g: g) for g in [-thmax, 0.0, thmax]]
    spread_const = abs(ends_const[2][1] - ends_const[0][1])
    ys = []
    for _ in range(200):
        seq = [rnd.uniform(-thmax, thmax) for _ in range(int(T / dt) + 2)]
        ys.append(run(lambda t, seq=seq: seq[int(t / dt + 1e-9)])[1])
    mean = sum(ys) / len(ys)
    sd = math.sqrt(sum((y - mean) ** 2 for y in ys) / len(ys))
    print(f"    θmax = 10°，T = 4：常值 γ = ±θmax 的终点 y 相差 {spread_const:.3f}；每 0.01 s 独立取 γ（噪声）时 y 的标准差 {sd:.3f}")
    check(spread_const > 5 * sd, "系统误差（常值 γ）造成的偏离远大于快速变化的噪声（后者会相互抵消）")

    # 杀人司机：追捕者 = Dubins 车，用「向逃跑者打方向」的简单追踪（补充）
    s1, s2, Lc, phimax, eps = 1.0, 0.45, 0.5, math.radians(40), 0.12

    def pstep(P, E, h):
        err = wrap(math.atan2(E[1] - P[1], E[0] - P[0]) - P[2])
        u = max(-phimax, min(phimax, 3 * err))
        return [P[0] + h * s1 * math.cos(P[2]), P[1] + h * s1 * math.sin(P[2]), P[2] + h * s1 / Lc * math.tan(u)]

    def flee(P, E):
        return math.atan2(E[1] - P[1], E[0] - P[0])

    def lookahead(P, E, H=1.2, ndir=16, h=0.02):
        # 逃跑者（补充的启发式）：试 16 个方向，预测 H 秒内与追捕者的最近距离，选最大的
        best, bv = -1.0, 0.0
        for k in range(ndir):
            v = 2 * math.pi * k / ndir
            p, e, t, dmin = P[:], E[:], 0.0, 1e9
            while t < H:
                p = pstep(p, e, h)
                e = [e[0] + h * s2 * math.cos(v), e[1] + h * s2 * math.sin(v)]
                dmin = min(dmin, math.hypot(p[0] - e[0], p[1] - e[1]))
                t += h
            if dmin > best:
                best, bv = dmin, v
        return bv

    def chase(strategy, Tmax=40.0):
        P, E, t, h, v, k, dmin = [0.0, 0.0, 0.0], [1.0, 1.0], 0.0, 0.005, 0.0, 0, 1e9
        while t < Tmax:
            d = math.hypot(P[0] - E[0], P[1] - E[1])
            dmin = min(dmin, d)
            if d < eps:
                return t, dmin
            if k % 10 == 0:
                v = strategy(P, E)
            P = pstep(P, E, h)
            E = [E[0] + h * s2 * math.cos(v), E[1] + h * s2 * math.sin(v)]
            t += h
            k += 1
        return None, dmin
    t1, _ = chase(flee)
    t2, d2 = chase(lookahead)
    rmin = Lc / math.tan(phimax)
    print(f"    s1 = {s1}，s2 = {s2}，ρmin = L/tanφmax = {rmin:.3f}，ε = {eps}")
    print(f"    逃跑者一直背向逃：第 {t1:.2f} 秒被抓；向前看 1.2 秒选方向：40 秒内没被抓，最近距离 {d2:.3f}")
    print("    注意：双方都只是简单启发式，不是微分对策意义下的最优策略（最优解见 Isaacs [37]、Başar–Olsder [10]）")
    check(t1 is not None and t2 is None, "速度慢的逃跑者直线逃必被抓；利用追捕者转弯半径的侧闪（在这组参数下）能一直逃脱")


# ====================================================================== 20
def part20():
    header("20. 习题 1、2、3")
    # 习题 1：q̇1+q̇2+q̇3+q̇4 = 0，q̇2 − q̇4 = 0 → k = 2，n − k = 2 个动作
    rnd = random.Random(20)
    ok = True
    for _ in range(50):
        u1, u2 = rnd.uniform(-3, 3), rnd.uniform(-3, 3)
        qd = [u1, u2, -u1 - 2 * u2, u2]          # q̇1 = u1，q̇2 = u2，q̇4 = q̇2，q̇3 = −q̇1 − q̇2 − q̇4
        ok &= close(sum(qd), 0) and close(qd[1] - qd[3], 0)
    check(ok, "习题 1：两个线性无关的 Pfaffian 约束 → 2 个动作：q̇ = (u1, u2, −u1−2u2, u2)")
    # 习题 2：2ÿ − 10ẏ² + 5y = 0 → ẋ1 = x2，ẋ2 = 5x2² − 2.5x1
    y, yd = 0.3, -0.4
    ydd = (10 * yd * yd - 5 * y) / 2
    check(close(ydd, 5 * yd * yd - 2.5 * y), "习题 2：ẋ1 = x2，ẋ2 = 5x2² − (5/2)x1")
    # 习题 3：y⁽⁴⁾ + y = 0 → 4 维，ẋ4 = −x1；解 e^{t/√2}cos(t/√2) 满足
    s = simulate(lambda x: [x[1], x[2], x[3], -x[0]], [1.0, 1 / math.sqrt(2), 0.0, -1 / math.sqrt(2)], 1.0, 1e-3)
    exact = math.exp(1 / math.sqrt(2)) * math.cos(1 / math.sqrt(2))
    check(abs(s[0] - exact) < 1e-8, f"习题 3：ẋ1 = x2，ẋ2 = x3，ẋ3 = x4，ẋ4 = −x1；y(1) = {s[0]:.6f} = e^(1/√2)cos(1/√2)")


if __name__ == "__main__":
    for fn in (part1, part2, part3, part4, part5, part6, part7, part8, part9, part10,
               part11, part12, part13, part14, part15, part16, part17, part18, part19, part20):
        fn()
    print("\n全部检查通过。")
