"""第 15 章「系统理论与解析方法」参考实现：核对教程页面里出现的数值与原书笔误。

只用 Python 标准库。运行：

    python3 part4/code/ch15_system_theory.py

依次打印（编号与页面「参考代码第 N 项」对应）：
   1. 例 15.1：x' = -x^5 的 Lyapunov 函数；闭式解说明它渐近稳定但不是指数稳定（补充）
   2. 线性系统 x' = Ax 的稳定性：特征值；零实部的重根（Jordan 块）为什么会出事（补充）
   3. 能控性矩阵 (15.4) 与 Kalman 秩条件；例 15.2、例 15.3
   4. 线性二次问题 (15.20)–(15.24)：双积分器的 Riccati 解、闭环特征值、代价 = ½ x0ᵀ S x0
   5. 例 15.4：双积分器的时间最优 bang-bang 解、四种情形、切换时间与伴随变量 λ(t)；H ≡ 0
   6. HJB (15.14) 与 (15.15)：用解析的最短时间 G* 在随机点上核对
   7. 离散值迭代 (15.6)/(15.9) 逼近 HJB：网格越细、Δt 越小，误差越小
   8. Dubins 曲线：六个词、终点核对、图 15.5（θ = π 的切片）、度量不对称、图 15.6 的不连续
   9. Reeds–Shepp 曲线：48 个词（图 15.10）、终点核对、对称性、≤ Dubins、与精确格点搜索比较
  10. Balkcom–Mason：图 15.13 的对称变换表（72 个格子 → 40 种）；(15.51) 第 7 个词的笔误
  11. Lie 括号（小型符号计算）：(15.82)(15.85)(15.91)(15.103)–(15.105)(15.112)、例 15.8 的奇异分布
  12. 换位运动 (15.71)：净位移 ≈ Δt²[f,g]；脚注 9 的「稍微向前」是 Δt³/2
  13. P. Hall 基：每层的个数与 Witt 公式；例 15.18；(15.109) 的 Jacobi 恒等式
  14. CBHD 公式 (15.125)：四阶项的符号（随机矩阵数值核对）；(15.126)
  15. CFS 方程 (15.143)：与扩展系统对照；流的执行顺序
  16. 正弦输入：(15.151)–(15.154)、k 与最小代价；(15.158) 的系数；链式系统 (15.161)(15.162)
  17. 微分平坦：单轮车的平坦输出重建状态与动作（不积分），再积分核对
  18. 单轮车 → 链式形式（补充）：坐标变换的核对
  19. 小时间可达集：例 15.20 只能让 x2 增加；Dubins 车 vs Reeds–Shepp 车
"""
import heapq
import math
import random
from fractions import Fraction as F

PI = math.pi
TAU = 2 * PI


def show(title):
    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


# ============================================================================ 小型线性代数
def matmul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]


def matadd(A, B, a=1.0, b=1.0):
    return [[a * A[i][j] + b * B[i][j] for j in range(len(A[0]))] for i in range(len(A))]


def transpose(A):
    return [list(r) for r in zip(*A)]


def eye(n):
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def rank(M, tol=1e-9):
    A = [list(map(float, r)) for r in M]
    rows, cols, r = len(A), len(A[0]), 0
    for c in range(cols):
        piv = max(range(r, rows), key=lambda i: abs(A[i][c]), default=None)
        if piv is None or abs(A[piv][c]) < tol:
            continue
        A[r], A[piv] = A[piv], A[r]
        for i in range(rows):
            if i != r:
                f = A[i][c] / A[r][c]
                A[i] = [A[i][j] - f * A[r][j] for j in range(cols)]
        r += 1
        if r == rows:
            break
    return r


def det(M):
    A = [list(map(float, r)) for r in M]
    n, d = len(A), 1.0
    for c in range(n):
        piv = max(range(c, n), key=lambda i: abs(A[i][c]))
        if abs(A[piv][c]) < 1e-15:
            return 0.0
        if piv != c:
            A[c], A[piv] = A[piv], A[c]
            d = -d
        d *= A[c][c]
        for i in range(c + 1, n):
            f = A[i][c] / A[c][c]
            A[i] = [A[i][j] - f * A[c][j] for j in range(n)]
    return d


def eig2(A):
    """2×2 矩阵的特征值（可能是复数）。"""
    tr, dt = A[0][0] + A[1][1], A[0][0] * A[1][1] - A[0][1] * A[1][0]
    disc = tr * tr / 4 - dt
    if disc >= 0:
        s = math.sqrt(disc)
        return [complex(tr / 2 + s), complex(tr / 2 - s)]
    s = math.sqrt(-disc)
    return [complex(tr / 2, s), complex(tr / 2, -s)]


def expm(A, terms=40):
    n = len(A)
    R, T = eye(n), eye(n)
    for k in range(1, terms):
        T = [[v / k for v in row] for row in matmul(T, A)]
        R = matadd(R, T)
    return R


def logm_near_identity(M, terms=200):
    n = len(M)
    X = matadd(M, eye(n), 1, -1)
    R, P = [[0.0] * n for _ in range(n)], eye(n)
    for k in range(1, terms):
        P = matmul(P, X)
        R = matadd(R, P, 1, ((-1) ** (k + 1)) / k)
    return R


def rk4(f, x, t0, t1, n=2000):
    h, t = (t1 - t0) / n, t0
    x = list(x)
    for _ in range(n):
        k1 = f(t, x)
        k2 = f(t + h / 2, [a + h / 2 * b for a, b in zip(x, k1)])
        k3 = f(t + h / 2, [a + h / 2 * b for a, b in zip(x, k2)])
        k4 = f(t + h, [a + h * b for a, b in zip(x, k3)])
        x = [a + h / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(x, k1, k2, k3, k4)]
        t += h
    return x


def fmt(v, d=4):
    return f"{v:.{d}f}"


# ============================================================================ 1. 例 15.1
def item1():
    show("1. 例 15.1：x' = -x^5，φ(x) = x²/2")
    print("   Lie 导数 (15.3)：φ'(x) = (dφ/dx) f(x) = x·(−x^5) = −x^6；φ 与 −φ' 都全局正定 ⇒ 0 全局渐近稳定")
    print("   补充：闭式解 x(t) = x0 / (1 + 4 x0^4 t)^(1/4)，衰减只有 t^(-1/4)，所以不是指数稳定 (15.2)")
    x0 = 1.0
    sol = lambda t: x0 / (1 + 4 * x0 ** 4 * t) ** 0.25
    num = rk4(lambda t, x: [-x[0] ** 5], [x0], 0, 50, 20000)[0]
    print(f"   x(50)：闭式 {sol(50):.6f}，RK4 {num:.6f}")
    for alpha in (0.05, 0.2):
        ratios = [sol(t) / math.exp(-alpha * t) for t in (10, 50, 200)]
        print(f"   x(t)/e^(-{alpha} t) 在 t = 10, 50, 200：" + ", ".join(f"{r:.3g}" for r in ratios) + "  —— 无界，找不到 m 使 (15.2) 成立")


# ============================================================================ 2. 线性稳定性
LINEAR_PRESETS = {
    "稳定焦点 [[-0.5,1],[-1,-0.5]]": [[-0.5, 1], [-1, -0.5]],
    "稳定结点 [[-1,0],[0,-0.3]]": [[-1, 0], [0, -0.3]],
    "中心 [[0,1],[-1,0]]": [[0, 1], [-1, 0]],
    "鞍点 [[1,0],[0,-1]]": [[1, 0], [0, -1]],
    "零矩阵 [[0,0],[0,0]]": [[0, 0], [0, 0]],
    "Jordan 块 [[0,1],[0,0]]": [[0, 1], [0, 0]],
}


def item2():
    show("2. 线性系统 x' = Ax：特征值与稳定性（15.1.2 节）")
    for name, A in LINEAR_PRESETS.items():
        ev = eig2(A)
        s = ", ".join(f"{e.real:+.2f}{e.imag:+.2f}i" for e in ev)
        print(f"   {name:<28} λ = {s}")
    E = expm([[0, 10.0], [0, 0]])
    print("   Jordan 块：e^(At) = [[1, t],[0, 1]]，t = 10 时 = " + str([[round(v, 6) for v in r] for r in E]))
    print("   ⇒ 从 (0, ε) 出发 x1(t) = ε t 无界：零实部的特征值是重根且不可对角化时不是 Lyapunov 稳定；")
    print("     零矩阵的 0 也是重根，却稳定（每个点都不动）——书中「零实部特征值是互异根」是充分条件（补充）")


# ============================================================================ 3. 能控性
def ctrb(A, B):
    n = len(A)
    cols, AkB = [], [list(r) for r in B]
    for _ in range(n):
        cols.append(AkB)
        AkB = matmul(A, AkB)
    return [[c[i][j] for c in cols for j in range(len(B[0]))] for i in range(n)]


def item3():
    show("3. 能控性矩阵 (15.4) M = [B ⋮ AB ⋮ … ⋮ A^(n-1)B] 与 Kalman 秩条件")
    cases = {
        "双积分器 A=[[0,1],[0,0]], B=[0,1]ᵀ": ([[0, 1], [0, 0]], [[0], [1]]),
        "只推第一个分量 B=[1,0]ᵀ": ([[0, 1], [0, 0]], [[1], [0]]),
        "解耦且同速 A=-I, B=[1,1]ᵀ": ([[-1, 0], [0, -1]], [[1], [1]]),
        "解耦不同速 A=diag(-1,-2), B=[1,1]ᵀ": ([[-1, 0], [0, -2]], [[1], [1]]),
        "三重积分器 n=3": ([[0, 1, 0], [0, 0, 1], [0, 0, 0]], [[0], [0], [1]]),
    }
    for name, (A, B) in cases.items():
        M = ctrb(A, B)
        print(f"   {name:<36} M = {M}  秩 {rank(M)} / {len(A)} → {'能控' if rank(M) == len(A) else '不能控'}")
    print("   例 15.2：X = ℝ, x' = u, U = [0,1]：x 只能增加，从 x_I = 1 到不了 x_G = 0")
    x = rk4(lambda t, s: [s[1] * 0.7, -s[0] * 0.7], [1.0, 0.0], 0, 5.0, 2000)
    print(f"   例 15.3：x' = yu, y' = -xu（u = 0.7 积分 5 秒）：x²+y² = {x[0]**2 + x[1]**2:.9f}，始终在单位圆上 ⇒ 可达集是 1 维，不可达（accessible 不成立）")


# ============================================================================ 4. LQR
def riccati(A, B, Q, R, dt=1e-3, tol=1e-12, max_steps=500000):
    """沿逆时间积分 Riccati 微分方程直到收敛：S' = SA + AᵀS − S B R⁻¹ Bᵀ S + Q（R 为标量）。"""
    n = len(A)
    S = [[0.0] * n for _ in range(n)]
    At, Bt = transpose(A), transpose(B)

    def rhs(S):
        SB = matmul(S, B)
        return matadd(matadd(matadd(matmul(S, A), matmul(At, S)), [[v / R for v in r] for r in matmul(SB, transpose(SB))], 1, -1), Q)

    for _ in range(max_steps):
        k1 = rhs(S)
        k2 = rhs(matadd(S, k1, 1, dt / 2))
        k3 = rhs(matadd(S, k2, 1, dt / 2))
        k4 = rhs(matadd(S, k3, 1, dt))
        dS = [[(a + 2 * b + 2 * c + d) / 6 for a, b, c, d in zip(*rows)] for rows in zip(k1, k2, k3, k4)]
        S = matadd(S, dS, 1, dt)
        if max(abs(v) for r in dS for v in r) < tol:
            break
    return S


def item4():
    show("4. 线性二次问题：双积分器 A=[[0,1],[0,0]], B=[0,1]ᵀ, Q=I, R=1")
    A, B, Q, R = [[0.0, 1.0], [0.0, 0.0]], [[0.0], [1.0]], eye(2), 1.0
    S = riccati(A, B, Q, R)
    print("   (15.21) 的解 S =", [[round(v, 6) for v in r] for r in S], "  解析值 [[√3, 1], [1, √3]] =", round(math.sqrt(3), 6))
    SB = matmul(S, B)
    res = matadd(matadd(matadd(matmul(S, A), matmul(transpose(A), S)), [[v / R for v in r] for r in matmul(SB, transpose(SB))], 1, -1), Q)
    print("   Riccati 残差 max|·| =", f"{max(abs(v) for r in res for v in r):.2e}")
    K = [v / R for v in transpose(SB)[0]]
    Acl = [[A[i][j] - B[i][0] * K[j] for j in range(2)] for i in range(2)]
    ev = eig2(Acl)
    print(f"   π(x) = −R⁻¹BᵀSx = −[{K[0]:.4f}, {K[1]:.4f}] x；闭环 (15.22) 特征值 = {ev[0].real:.4f} ± {abs(ev[0].imag):.4f}i（= −√3/2 ± i/2）")
    x0 = [1.0, 0.0]

    def f(t, s):
        u = -(K[0] * s[0] + K[1] * s[1])
        return [s[1], u, 0.5 * (s[0] ** 2 + s[1] ** 2 + R * u * u)]

    end = rk4(f, x0 + [0.0], 0, 30, 30000)
    G = 0.5 * sum(x0[i] * S[i][j] * x0[j] for i in range(2) for j in range(2))
    print(f"   从 x0 = (1, 0) 出发：模拟的代价 (15.20) = {end[2]:.6f}，½x0ᵀSx0 (15.24) = {G:.6f}")


# ============================================================================ 5–7. 双积分器的时间最优
def di_bangbang(x, g):
    """双积分器 x1' = x2, x2' = u, |u| ≤ 1 从 x 到 g 的时间最优解。
    返回 (T, [(u, 时长), ...], 切换时刻 t' 或 None)。"""
    best = None
    for a in (1.0, -1.0):
        s2 = a * (g[0] - x[0]) + (g[1] ** 2 + x[1] ** 2) / 2
        if s2 < -1e-12:
            continue
        r = math.sqrt(max(0.0, s2))
        for vs in (r, -r):
            t1, t2 = (vs - x[1]) / a, (vs - g[1]) / a
            if t1 < -1e-9 or t2 < -1e-9:
                continue
            T = max(t1, 0) + max(t2, 0)
            if best is None or T < best[0] - 1e-12:
                best = (T, [(a, max(t1, 0.0)), (-a, max(t2, 0.0))])
    T, segs = best
    segs = [s for s in segs if s[1] > 1e-12]
    tsw = segs[0][1] if len(segs) == 2 else None
    return T, segs, tsw


def di_case(segs):
    if len(segs) == 1:
        return "情形 1：一直全力加速" if segs[0][0] > 0 else "情形 2：一直全力减速"
    return "情形 3：先加速后减速" if segs[0][0] > 0 else "情形 4：先减速后加速"


def di_min_time_origin(x1, x2):
    """解析的最短时间 G*（目标是原点）。"""
    if x1 > -0.5 * x2 * abs(x2):
        return x2 + 2 * math.sqrt(x1 + 0.5 * x2 * x2)
    return -x2 + 2 * math.sqrt(-x1 + 0.5 * x2 * x2)


def item5():
    show("5. 例 15.4：双积分器的时间最优（Pontryagin 最小值原理）")
    for x, g in [((1.0, 0.0), (0.0, 0.0)), ((-2.0, 1.0), (0.0, 0.0)), ((0.0, 0.0), (0.5, 1.0)), ((0.0, 0.0), (-0.5, -1.0)),
                 ((-1.5, 0.5), (1.0, -0.5)), ((0.5, -1.0), (0.0, 0.0))]:
        T, segs, tsw = di_bangbang(x, g)
        desc = " → ".join(f"u={int(u):+d} 用 {d:.4f}" for u, d in segs)
        print(f"   x_I = {x}, x_G = {g}: T* = {T:.4f}；{desc}；{di_case(segs)}")
    # 伴随变量：λ1 = c1，λ2 = c1 (t' − t)，c1 = −1/x2(t')；核对 H ≡ 0
    x, g = (1.0, 0.0), (0.0, 0.0)
    T, segs, tsw = di_bangbang(x, g)
    u0 = segs[0][0]
    x2s = x[1] + u0 * tsw
    c1 = -1.0 / x2s
    worst = 0.0
    for k in range(101):
        t = T * k / 100
        if t <= tsw:
            u, s = u0, t
            x2 = x[1] + u * s
        else:
            u, s = -u0, t - tsw
            x2 = x2s + u * s
        l1, l2 = c1, c1 * (tsw - t)
        Hval = 1 + l1 * x2 + l2 * u
        worst = max(worst, abs(Hval))
    print(f"   从 (1,0) 到原点：t' = {tsw:.4f}，x2(t') = {x2s:.4f}，λ1 = c1 = {c1:.4f}，λ2(t) = c1 (t' − t)；max|H| 沿轨迹 = {worst:.1e}")
    print("   λ2 > 0 时 u* = −1，λ2 < 0 时 u* = +1（u* = −sgn λ2），λ2 是直线，最多变号一次 ⇒ 最多切换一次")
    print("   与 G* 的梯度对照：λ(0) = ∇G*(x_I) =", [round(v, 4) for v in grad(lambda a, b: di_min_time_origin(a, b), *x)])


def grad(G, a, b, h=1e-6):
    return [(G(a + h, b) - G(a - h, b)) / (2 * h), (G(a, b + h) - G(a, b - h)) / (2 * h)]


def item6():
    show("6. HJB (15.14)：min_u { l + Σ ∂G*/∂x_i f_i } = 0，用解析 G*（双积分器，l = 1）核对")
    rng = random.Random(7)
    worst, worst15 = 0.0, 0.0
    for _ in range(2000):
        x1, x2 = rng.uniform(-2, 2), rng.uniform(-2, 2)
        if abs(x1 + 0.5 * x2 * abs(x2)) < 1e-3:
            continue  # 切换曲线上 G* 不可微
        g1, g2 = grad(di_min_time_origin, x1, x2)
        vals = [1 + g1 * x2 + g2 * u for u in (-1, 1)]  # H 对 u 是线性的，最小值在端点
        worst = max(worst, abs(min(vals)))
        ustar = -1 if x1 > -0.5 * x2 * abs(x2) else 1
        worst15 = max(worst15, abs(g1 * x2 + g2 * ustar + 1))
    print(f"   2000 个随机点：max |min_u H| = {worst:.1e}；(15.15) Σ∂G*/∂x_i f_i(x,u*) = −l 的最大误差 = {worst15:.1e}")


def bilinear(V, n, lo, hi, x, y):
    """双线性插值；忽略还是 ∞ 的角点，其余权重重新归一化（与第 8 章「带插值的值迭代」相同的做法）。"""
    h = (hi - lo) / (n - 1)
    fx, fy = (x - lo) / h, (y - lo) / h
    if fx < 0 or fy < 0 or fx > n - 1 or fy > n - 1:
        return None
    i, j = min(int(fx), n - 2), min(int(fy), n - 2)
    ax, ay = fx - i, fy - j
    s = w = 0.0
    for v, ww in ((V[j][i], (1 - ax) * (1 - ay)), (V[j][i + 1], ax * (1 - ay)), (V[j + 1][i], (1 - ax) * ay), (V[j + 1][i + 1], ax * ay)):
        if v < 1e8 and ww > 0:
            s += ww * v
            w += ww
    return s / w if w > 1e-9 else None


def di_value_iteration(n, dt, lo=-2.0, hi=2.0, goal_r=0.08, iters=600):
    INF = 1e9
    h = (hi - lo) / (n - 1)
    pts = [lo + h * k for k in range(n)]
    V = [[0.0 if math.hypot(pts[i], pts[j]) <= goal_r + 1e-9 else INF for i in range(n)] for j in range(n)]
    for _ in range(iters):
        changed = 0.0
        newV = [row[:] for row in V]
        for j in range(n):
            for i in range(n):
                x1, x2 = pts[i], pts[j]
                if math.hypot(x1, x2) <= goal_r + 1e-9:
                    continue
                best = INF
                for u in (-1.0, 0.0, 1.0):  # 「蛮力」只取三个动作
                    y1, y2 = x1 + x2 * dt + 0.5 * u * dt * dt, x2 + u * dt
                    v = bilinear(V, n, lo, hi, y1, y2)
                    if v is not None:
                        best = min(best, dt + v)
                if best < INF:  # 标准的 Bellman 更新（不是「只降不升」），否则早期的乐观插值会被锁死
                    changed = max(changed, abs(V[j][i] - best) if V[j][i] < INF else 1.0)
                    newV[j][i] = best
        V = newV
        if changed < 1e-9:
            break
    return V, pts


def item7():
    show("7. 离散值迭代 (15.9) 逼近 HJB：双积分器最短时间，半拉格朗日 + 双线性插值，目标换成小球")
    for n, dt, gr in [(21, 0.2, 0.2), (41, 0.1, 0.1), (61, 0.07, 0.07)]:
        V, pts = di_value_iteration(n, dt, goal_r=gr, iters=5000)
        errs = [V[j][i] - di_min_time_origin(x1, x2) for j, x2 in enumerate(pts) for i, x1 in enumerate(pts)
                if abs(x1) <= 1 and abs(x2) <= 1 and V[j][i] < 1e8]
        print(f"   网格 {n}×{n}, Δt = {dt}, 目标半径 {gr}: |x|∞ ≤ 1 内平均 |误差| {sum(map(abs, errs))/len(errs):.3f}，"
              f"最大高估 {max(errs):.3f}，最大低估 {-min(errs):.3f}")
    print("   误差主要在切换曲线（G* 的梯度在那里不连续）和目标附近；等值线的形状与解析 G* 一致")


# ============================================================================ 8. Dubins 曲线
def mod2pi_pos(x):
    return x - TAU * math.floor(x / TAU)


def dubins_words(q0, q1, rho=1.0):
    """六个 Dubins 词的参数 (α, β 或 d, γ)；d 以 ρ 为单位。式 (15.45)。"""
    dx, dy = q1[0] - q0[0], q1[1] - q0[1]
    D = math.hypot(dx, dy)
    d = D / rho
    th = mod2pi_pos(math.atan2(dy, dx)) if D > 1e-12 else 0.0
    a, b = mod2pi_pos(q0[2] - th), mod2pi_pos(q1[2] - th)
    sa, sb, ca, cb, cab = math.sin(a), math.sin(b), math.cos(a), math.cos(b), math.cos(a - b)
    out = {}
    eps = 1e-10  # 判别式恰好为 0 时（例如只需一段圆弧）舍入误差会让它变成 -1e-16
    sq = lambda v: math.sqrt(max(0.0, v))
    p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb)
    if p2 >= -eps:
        t1 = math.atan2(cb - ca, d + sa - sb)
        out["LSL"] = (mod2pi_pos(-a + t1), sq(p2), mod2pi_pos(b - t1))
    p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa)
    if p2 >= -eps:
        t1 = math.atan2(ca - cb, d - sa + sb)
        out["RSR"] = (mod2pi_pos(a - t1), sq(p2), mod2pi_pos(-b + t1))
    p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb)
    if p2 >= -eps:
        p = sq(p2)
        t2 = math.atan2(-ca - cb, d + sa + sb) - math.atan2(-2, p)
        out["LSR"] = (mod2pi_pos(-a + t2), p, mod2pi_pos(-b + t2))
    p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb)
    if p2 >= -eps:
        p = sq(p2)
        t2 = math.atan2(ca + cb, d - sa - sb) - math.atan2(2, p)
        out["RSL"] = (mod2pi_pos(a - t2), p, mod2pi_pos(b - t2))
    tmp = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8
    if abs(tmp) <= 1 + eps:
        p = mod2pi_pos(TAU - math.acos(max(-1.0, min(1.0, tmp))))
        t = mod2pi_pos(a - math.atan2(ca - cb, d - sa + sb) + p / 2)
        out["RLR"] = (t, p, mod2pi_pos(a - b - t + p))
    tmp = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8
    if abs(tmp) <= 1 + eps:
        p = mod2pi_pos(TAU - math.acos(max(-1.0, min(1.0, tmp))))
        t = mod2pi_pos(-a - math.atan2(ca - cb, d + sa - sb) + p / 2)
        out["LRL"] = (t, p, mod2pi_pos(b - a - t + p))
    return out


def follow(q, word, segs, rho=1.0):
    """沿有符号的段长积分（L、R 的段长是转过的角度，S 的段长以 ρ 为单位；负号 = 倒车）。"""
    x, y, th = q
    for ch, v in zip(word, segs):
        if ch == "S":
            x += rho * v * math.cos(th)
            y += rho * v * math.sin(th)
        elif ch == "L":
            x += rho * (math.sin(th + v) - math.sin(th))
            y += rho * (-math.cos(th + v) + math.cos(th))
            th += v
        else:
            x += rho * (-math.sin(th - v) + math.sin(th))
            y += rho * (math.cos(th - v) - math.cos(th))
            th -= v
    return x, y, th


def dubins(q0, q1, rho=1.0):
    W = dubins_words(q0, q1, rho)
    w, p = min(W.items(), key=lambda kv: sum(kv[1]))
    return rho * sum(p), w, p


def config_err(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1]) + abs(math.remainder(a[2] - b[2], TAU))


def item8():
    show("8. Dubins 曲线（15.3.1 节）")
    rng = random.Random(3)
    bad = cnt = 0
    for _ in range(3000):
        q0 = (rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(-PI, PI))
        q1 = (rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(-PI, PI))
        rho = rng.choice([0.5, 1.0, 2.0])
        for w, p in dubins_words(q0, q1, rho).items():
            cnt += 1
            bad += config_err(follow(q0, w, p, rho), q1) > 1e-9
    print(f"   {cnt} 条候选曲线的终点误差 > 1e-9 的个数：{bad}")
    print("   图 15.5：q_G = (0,0,0)，q_I = (x, y, π) 时最优词的分布（a=LSL b=RSR c=LSR d=RSL E=RLR F=LRL，ρ = 1）")
    for j in range(12, -13, -2):
        y = j * 0.25
        row = ""
        for i in range(-20, 21):
            w = dubins((i * 0.25, y, PI), (0, 0, 0))[1]
            row += {"LSL": "a", "RSR": "b", "LSR": "c", "RSL": "d", "RLR": "E", "LRL": "F"}[w]
        print(f"   {y:+5.2f} {row}")
    print("   ⇒ 上方 LSL、下方 RSR；中间一带左右分别是 LSR/RSL；圆内上半 RLR、下半 LRL —— 与图 15.5 一致")
    a = dubins((0, 0, 0), (1, 0, 0))[0]
    b = dubins((1, 0, 0), (0, 0, 0))[0]
    print(f"   不对称：ρ((0,0,0) → (1,0,0)) = {a:.4f}，反过来 = {b:.4f}（「Dubins 度量」不满足对称性）")
    c0 = dubins((0, 0, 0), (1, -1, -PI / 2))
    c1 = dubins((0, 0, 0), (0.99, -1, -PI / 2))
    eff = lambda w, p: "".join(ch for ch, v in zip(w, p) if v > 1e-9)  # 去掉长度为 0 的段
    print(f"   不连续：到 (1, −1, −π/2) 只要一段 {eff(c0[1], c0[2])}，长 {c0[0]:.4f}；到旁边的 (0.99, −1, −π/2) 却要 {eff(c1[1], c1[2])}，长 {c1[0]:.4f}")


# ============================================================================ 9. Reeds–Shepp 曲线
ZERO = 1e-9


def mod2pi(x):
    v = math.fmod(x, TAU)
    if v < -PI:
        v += TAU
    elif v > PI:
        v -= TAU
    return v


def polar(x, y):
    return math.hypot(x, y), math.atan2(y, x)


def tau_omega(u, v, xi, eta, phi):
    delta = mod2pi(u - v)
    A = math.sin(u) - math.sin(delta)
    B = math.cos(u) - math.cos(delta) - 1
    t1 = math.atan2(eta * A - xi * B, xi * A + eta * B)
    t2 = 2 * (math.cos(delta) - math.cos(v) - math.cos(u)) + 3
    tau = mod2pi(t1 + PI) if t2 < 0 else mod2pi(t1)
    return tau, mod2pi(tau - u + v - phi)


# 下面的公式编号是 Reeds & Shepp 原论文 [73] 的编号（实现方式参照 OMPL）
def LpSpLp(x, y, phi):  # 8.1
    u, t = polar(x - math.sin(phi), y - 1 + math.cos(phi))
    if t >= -ZERO:
        v = mod2pi(phi - t)
        if v >= -ZERO:
            return t, u, v


def LpSpRp(x, y, phi):  # 8.2
    u1, t1 = polar(x + math.sin(phi), y - 1 - math.cos(phi))
    u1 *= u1
    if u1 >= 4:
        u = math.sqrt(u1 - 4)
        t = mod2pi(t1 + math.atan2(2, u))
        v = mod2pi(t - phi)
        if t >= -ZERO and v >= -ZERO:
            return t, u, v


def LpRmL(x, y, phi):  # 8.3 / 8.4
    xi, eta = x - math.sin(phi), y - 1 + math.cos(phi)
    u1, theta = polar(xi, eta)
    if u1 <= 4:
        u = -2 * math.asin(0.25 * u1)
        t = mod2pi(theta + 0.5 * u + PI)
        v = mod2pi(phi - t + u)
        if t >= -ZERO and u <= ZERO:
            return t, u, v


def LpRupLumRm(x, y, phi):  # 8.7
    xi, eta = x + math.sin(phi), y - 1 - math.cos(phi)
    rho = 0.25 * (2 + math.hypot(xi, eta))
    if rho <= 1:
        u = math.acos(rho)
        t, v = tau_omega(u, -u, xi, eta, phi)
        if t >= -ZERO and v <= ZERO:
            return t, u, v


def LpRumLumRp(x, y, phi):  # 8.8
    xi, eta = x + math.sin(phi), y - 1 - math.cos(phi)
    rho = (20 - xi * xi - eta * eta) / 16
    if 0 <= rho <= 1:
        u = -math.acos(rho)
        if u >= -0.5 * PI:
            t, v = tau_omega(u, u, xi, eta, phi)
            if t >= -ZERO and v >= -ZERO:
                return t, u, v


def LpRmSmLm(x, y, phi):  # 8.9
    xi, eta = x - math.sin(phi), y - 1 + math.cos(phi)
    rho, theta = polar(xi, eta)
    if rho >= 2:
        r = math.sqrt(rho * rho - 4)
        u = 2 - r
        t = mod2pi(theta + math.atan2(r, -2))
        v = mod2pi(phi - 0.5 * PI - t)
        if t >= -ZERO and u <= ZERO and v <= ZERO:
            return t, u, v


def LpRmSmRm(x, y, phi):  # 8.10
    xi, eta = x + math.sin(phi), y - 1 - math.cos(phi)
    rho, theta = polar(-eta, xi)
    if rho >= 2:
        t, u = theta, 2 - rho
        v = mod2pi(t + 0.5 * PI - phi)
        if t >= -ZERO and u <= ZERO and v <= ZERO:
            return t, u, v


def LpRmSLmRp(x, y, phi):  # 8.11
    xi, eta = x + math.sin(phi), y - 1 - math.cos(phi)
    rho, theta = polar(xi, eta)
    if rho >= 2:
        u = 4 - math.sqrt(rho * rho - 4)
        if u <= ZERO:
            t = mod2pi(math.atan2((4 - u) * xi - 2 * eta, -2 * xi + (u - 4) * eta))
            v = mod2pi(t - phi)
            if t >= -ZERO and v >= -ZERO:
                return t, u, v


RS_TYPES = ["LRL", "RLR", "LRLR", "RLRL", "LRSL", "RLSR", "LSRL", "RSLR", "LRSR", "RLSL", "RSRL", "LSLR",
            "LSR", "RSL", "LSL", "RSR", "LRSLR", "RLSRL"]


def rs_candidates(x, y, phi):
    """局部坐标（起点在原点、朝 +x，ρ = 1）下所有候选：(字母串, 有符号段长)。用时间翻转、反射、倒序三种对称覆盖全部词。"""
    out = []
    add = lambda tp, segs: out.append((RS_TYPES[tp], list(segs)))
    neg = lambda r: [-r[0], -r[1], -r[2]]
    xb, yb = x * math.cos(phi) + y * math.sin(phi), x * math.sin(phi) - y * math.cos(phi)
    for f, ta, tb in [(LpSpLp, 14, 15), (LpSpRp, 12, 13)]:  # CSC
        r = f(x, y, phi); r and add(ta, r)
        r = f(-x, y, -phi); r and add(ta, neg(r))
        r = f(x, -y, -phi); r and add(tb, r)
        r = f(-x, -y, phi); r and add(tb, neg(r))
    r = LpRmL(x, y, phi); r and add(0, r)  # CCC
    r = LpRmL(-x, y, -phi); r and add(0, neg(r))
    r = LpRmL(x, -y, -phi); r and add(1, r)
    r = LpRmL(-x, -y, phi); r and add(1, neg(r))
    r = LpRmL(xb, yb, phi); r and add(0, r[::-1])
    r = LpRmL(-xb, yb, -phi); r and add(0, neg(r[::-1]))
    r = LpRmL(xb, -yb, -phi); r and add(1, r[::-1])
    r = LpRmL(-xb, -yb, phi); r and add(1, neg(r[::-1]))
    r = LpRupLumRm(x, y, phi); r and add(2, [r[0], r[1], -r[1], r[2]])  # CCCC
    r = LpRupLumRm(-x, y, -phi); r and add(2, [-r[0], -r[1], r[1], -r[2]])
    r = LpRupLumRm(x, -y, -phi); r and add(3, [r[0], r[1], -r[1], r[2]])
    r = LpRupLumRm(-x, -y, phi); r and add(3, [-r[0], -r[1], r[1], -r[2]])
    r = LpRumLumRp(x, y, phi); r and add(2, [r[0], r[1], r[1], r[2]])
    r = LpRumLumRp(-x, y, -phi); r and add(2, [-r[0], -r[1], -r[1], -r[2]])
    r = LpRumLumRp(x, -y, -phi); r and add(3, [r[0], r[1], r[1], r[2]])
    r = LpRumLumRp(-x, -y, phi); r and add(3, [-r[0], -r[1], -r[1], -r[2]])
    h = 0.5 * PI
    for f, ta, tb, tc, td in [(LpRmSmLm, 4, 5, 6, 7), (LpRmSmRm, 8, 9, 10, 11)]:  # CCSC
        r = f(x, y, phi); r and add(ta, [r[0], -h, r[1], r[2]])
        r = f(-x, y, -phi); r and add(ta, [-r[0], h, -r[1], -r[2]])
        r = f(x, -y, -phi); r and add(tb, [r[0], -h, r[1], r[2]])
        r = f(-x, -y, phi); r and add(tb, [-r[0], h, -r[1], -r[2]])
        r = f(xb, yb, phi); r and add(tc, [r[2], r[1], -h, r[0]])
        r = f(-xb, yb, -phi); r and add(tc, [-r[2], -r[1], h, -r[0]])
        r = f(xb, -yb, -phi); r and add(td, [r[2], r[1], -h, r[0]])
        r = f(-xb, -yb, phi); r and add(td, [-r[2], -r[1], h, -r[0]])
    r = LpRmSLmRp(x, y, phi); r and add(16, [r[0], -h, r[1], -h, r[2]])  # CCSCC
    r = LpRmSLmRp(-x, y, -phi); r and add(16, [-r[0], h, -r[1], h, -r[2]])
    r = LpRmSLmRp(x, -y, -phi); r and add(17, [r[0], -h, r[1], -h, r[2]])
    r = LpRmSLmRp(-x, -y, phi); r and add(17, [-r[0], h, -r[1], h, -r[2]])
    return out


def reeds_shepp(q0, q1, rho=1.0):
    dx, dy = q1[0] - q0[0], q1[1] - q0[1]
    c, s = math.cos(q0[2]), math.sin(q0[2])
    cands = rs_candidates((c * dx + s * dy) / rho, (-s * dx + c * dy) / rho, q1[2] - q0[2])
    w, segs = min(cands, key=lambda c: sum(abs(v) for v in c[1]))
    return rho * sum(abs(v) for v in segs), w, segs, cands


def book_word(w, segs):
    """转成书中的写法，如 L+R-L+（倒车段写 −；零长度段省略）。"""
    return " ".join(ch + ("+" if v > 0 else "−") for ch, v in zip(w, segs) if abs(v) > 1e-9)


FIG_15_10 = {
    "C|C|C": ["L+R-L+", "L-R+L-", "R+L-R+", "R-L+R-"],
    "CC|C": ["L+R+L-", "L-R-L+", "R+L+R-", "R-L-R+"],
    "C|CC": ["L+R-L-", "L-R+L+", "R+L-R-", "R-L+R+"],
    "CSC": ["L+S+L+", "L-S-L-", "R+S+R+", "R-S-R-", "L+S+R+", "L-S-R-", "R+S+L+", "R-S-L-"],
    "CCβ|CβC": ["L+R+L-R-", "L-R-L+R+", "R+L+R-L-", "R-L-R+L+"],
    "C|CβCβ|C": ["L+R-L-R+", "L-R+L+R-", "R+L-R-L+", "R-L+R+L-"],
    "C|Cπ/2SC": ["L+R-S-R-", "L-R+S+R+", "R+L-S-L-", "R-L+S+L+", "L+R-S-L-", "L-R+S+L+", "R+L-S-R-", "R-L+S+R+"],
    "CSCπ/2|C": ["L+S+L+R-", "L-S-L-R+", "R+S+R+L-", "R-S-R-L+", "R+S+L+R-", "R-S-L-R+", "L+S+R+L-", "L-S-R-L+"],
    "C|Cπ/2SCπ/2|C": ["L+R-S-L-R+", "L-R+S+L+R-", "R+L-S-R-L+", "R-L+S+R+L-"],
}


def item9():
    show("9. Reeds–Shepp 曲线（15.3.2 节）")
    print("   图 15.10 每行的词数：", {k: len(v) for k, v in FIG_15_10.items()}, "合计", sum(len(v) for v in FIG_15_10.values()))
    print("   ⇒ 展开成 8 个的是 CSC、C|Cπ/2SC、CSCπ/2|C；C|Cπ/2SCπ/2|C 只有 4 个（原书正文说「前六个各 4 个、含 S 的后三个各 8 个」不准确，但总数仍是 48）")
    rng = random.Random(5)
    bad = cnt = 0
    seen = set()
    for _ in range(20000):
        q0 = (rng.uniform(-4, 4), rng.uniform(-4, 4), rng.uniform(-PI, PI))
        q1 = (rng.uniform(-4, 4), rng.uniform(-4, 4), rng.uniform(-PI, PI))
        rho = rng.choice([0.5, 1.0, 1.7])
        L, w, segs, cands = reeds_shepp(q0, q1, rho)
        for cw, cs in cands:
            cnt += 1
            bad += config_err(follow(q0, cw, cs, rho), q1) > 1e-7
            seen.add("".join(ch + ("+" if v >= 0 else "-") for ch, v in zip(cw, cs)))
    all48 = {wd for v in FIG_15_10.values() for wd in v}
    print(f"   随机 2 万次查询：{cnt} 条候选的终点误差 > 1e-7 的个数 = {bad}；候选里出现过的符号词 {len(seen & all48)}/48")
    asym = 0
    worse = 0
    for _ in range(3000):
        q0 = (rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(-PI, PI))
        q1 = (rng.uniform(-3, 3), rng.uniform(-3, 3), rng.uniform(-PI, PI))
        a, b = reeds_shepp(q0, q1)[0], reeds_shepp(q1, q0)[0]
        asym += abs(a - b) > 1e-7
        worse += a > dubins(q0, q1)[0] + 1e-9
    print(f"   3000 对随机位形：ρ(q,q') ≠ ρ(q',q) 的个数 = {asym}（RS 度量对称）；RS 比 Dubins 长的个数 = {worse}")
    # 精确格点：四分之一圆弧（前进 / 倒车）与长 1、0.5 的直线，所有状态都落在精确格点上
    key = lambda q: (round(q[0], 6), round(q[1], 6), round(math.remainder(q[2], TAU) / (PI / 2)) % 4)
    prims = [("L", PI / 2), ("L", -PI / 2), ("R", PI / 2), ("R", -PI / 2), ("S", 1.0), ("S", -1.0), ("S", 0.5), ("S", -0.5)]
    dist, pq = {key((0, 0, 0)): 0.0}, [(0.0, (0.0, 0.0, 0.0))]
    while pq:
        c, q = heapq.heappop(pq)
        if c > dist.get(key(q), 1e18) + 1e-12:
            continue
        for w, v in prims:
            q2 = follow(q, w, [v])
            c2 = c + abs(v)
            if c2 <= 7.0 and c2 < dist.get(key(q2), 1e18) - 1e-12:
                k = key(q2)
                dist[k] = c2
                heapq.heappush(pq, (c2, (k[0], k[1], k[2] * PI / 2)))
    viol = sum(reeds_shepp((0, 0, 0), (k[0], k[1], k[2] * PI / 2))[0] > c + 1e-7 for k, c in dist.items())
    eq = sum(abs(reeds_shepp((0, 0, 0), (k[0], k[1], k[2] * PI / 2))[0] - c) < 1e-7 for k, c in dist.items())
    print(f"   格点 Dijkstra（{len(dist)} 个状态）：RS 长度大于格点代价的次数 = {viol}（应为 0），相等的 {eq} 个")
    L, w, segs, _ = reeds_shepp((0, 0, 0), (0, 1, 0))
    print(f"   例：从 (0,0,0) 到正左方 (0,1,0)（平行泊车）：{book_word(w, segs)}，长 {L:.4f}；Dubins 要 {dubins((0,0,0),(0,1,0))[0]:.4f}")
    # STLC ⇒ 连续
    d1 = reeds_shepp((0, 0, 0), (1, -1, -PI / 2))[0]
    d2 = reeds_shepp((0, 0, 0), (0.99, -1, -PI / 2))[0]
    print(f"   连续性：RS 到 (1,−1,−π/2) = {d1:.4f}，到 (0.99,−1,−π/2) = {d2:.4f}（与第 8 项的 Dubins 对比）")


# ============================================================================ 10. Balkcom–Mason
BM_BASE_PRINTED = ["↷", "⇓", "⇓↷", "↷⇓↷", "⇑↶π⇓", "↶⇓↷", "⇓↷↷", "↶⇓↷⇑", "⇑↶⇓↷⇑"]  # (15.51) 原样
BM_BASE = ["↷", "⇓", "⇓↷", "↷⇓↷", "⇑↶π⇓", "↶⇓↷", "⇓↷⇑", "↶⇓↷⇑", "⇑↶⇓↷⇑"]  # 图 15.13 的 Base 列


def bm_tokens(w):
    toks, i = [], 0
    while i < len(w):
        if i + 1 < len(w) and w[i + 1] == "π":
            toks.append(w[i:i + 2])
            i += 2
        else:
            toks.append(w[i])
            i += 1
    return toks


def T1(t):
    return [x.replace("⇑", "#").replace("⇓", "⇑").replace("#", "⇓") for x in t]


def T2(t):
    return t[::-1]


def T3(t):
    return [x.replace("↶", "#").replace("↷", "↶").replace("#", "↷") for x in t]


def item10():
    show("10. Balkcom–Mason 曲线：图 15.13 的对称变换")
    combos = [("Base", lambda t: t), ("T1", T1), ("T2", T2), ("T3", T3), ("T2∘T1", lambda t: T2(T1(t))),
              ("T3∘T1", lambda t: T3(T1(t))), ("T3∘T2", lambda t: T3(T2(t))), ("T3∘T2∘T1", lambda t: T3(T2(T1(t))))]
    allw, total = set(), 0
    for row, base in zip("ABCDEFGHI", BM_BASE):
        cells = ["".join(fn(bm_tokens(base))) for _, fn in combos]
        total += len(cells)
        allw |= set(cells)
        print(f"   {row}. " + "  ".join(f"{c:<7}" for c in cells) + f"   本行不同的 {len(set(cells))} 种")
    print(f"   共 {total} 个格子，去重后 {len(allw)} 种（书中说 40 种）")
    t = bm_tokens(BM_BASE_PRINTED[6])
    dup = any(a == b for a, b in zip(t, t[1:]))
    print(f"   (15.51) 印的第 7 个词 {BM_BASE_PRINTED[6]}：有两个相同的原语相邻 = {dup}（相邻同向原地转应合并成一个），")
    print(f"   图 15.13 的 G 行 Base 是 {BM_BASE[6]}，按它生成的 G 行与图中 8 个格子逐个一致")


# ============================================================================ 11. Lie 括号（小型符号计算）
class Poly:
    """多项式：变量分「线性」（x、y…）与「角度」（θ、ψ…，只以 sin、cos 出现）。
    单项式是指数元组；角度变量占两个位置 (sin 的次数, cos 的次数)，并用 sin² = 1 − cos² 化简。"""

    def __init__(self, sysvars, terms=None):
        self.V = sysvars
        self.t = {k: v for k, v in (terms or {}).items() if v != 0}

    @staticmethod
    def layout(sysvars):
        pos, k = [], 0
        for name, kind in sysvars:
            pos.append(k)
            k += 2 if kind == "ang" else 1
        return pos, k

    @classmethod
    def const(cls, V, c):
        _, n = cls.layout(V)
        return cls(V, {(0,) * n: F(c)})

    @classmethod
    def var(cls, V, i, which=None):
        pos, n = cls.layout(V)
        e = [0] * n
        e[pos[i] + (1 if which == "cos" else 0)] = 1
        return cls(V, {tuple(e): F(1)})

    def norm(self):
        pos, n = self.layout(self.V)
        out = {}
        stack = list(self.t.items())
        while stack:
            e, c = stack.pop()
            red = None
            for i, (name, kind) in enumerate(self.V):
                if kind == "ang" and e[pos[i]] >= 2:
                    red = pos[i]
                    break
            if red is None:
                out[e] = out.get(e, 0) + c
                continue
            e1 = list(e)
            e1[red] -= 2
            stack.append((tuple(e1), c))
            e2 = list(e1)
            e2[red + 1] += 2
            stack.append((tuple(e2), -c))
        return Poly(self.V, out)

    def __add__(self, o):
        r = dict(self.t)
        for e, c in o.t.items():
            r[e] = r.get(e, 0) + c
        return Poly(self.V, r)

    def __neg__(self):
        return Poly(self.V, {e: -c for e, c in self.t.items()})

    def __sub__(self, o):
        return self + (-o)

    def __mul__(self, o):
        if not isinstance(o, Poly):
            return Poly(self.V, {e: c * F(o) for e, c in self.t.items()})
        r = {}
        for e1, c1 in self.t.items():
            for e2, c2 in o.t.items():
                e = tuple(a + b for a, b in zip(e1, e2))
                r[e] = r.get(e, 0) + c1 * c2
        return Poly(self.V, r).norm()

    def d(self, i):
        pos, n = self.layout(self.V)
        r = {}
        p = pos[i]
        ang = self.V[i][1] == "ang"
        for e, c in self.t.items():
            if not ang:
                if e[p]:
                    e1 = list(e)
                    e1[p] -= 1
                    r[tuple(e1)] = r.get(tuple(e1), 0) + c * e[p]
            else:
                a, b = e[p], e[p + 1]
                if a:  # d(s^a) = a s^(a-1) c
                    e1 = list(e)
                    e1[p] -= 1
                    e1[p + 1] += 1
                    r[tuple(e1)] = r.get(tuple(e1), 0) + c * a
                if b:  # d(c^b) = -b c^(b-1) s
                    e1 = list(e)
                    e1[p + 1] -= 1
                    e1[p] += 1
                    r[tuple(e1)] = r.get(tuple(e1), 0) - c * b
        return Poly(self.V, r).norm()

    def ev(self, x):
        pos, n = self.layout(self.V)
        tot = 0.0
        for e, c in self.t.items():
            m = float(c)
            for i, (name, kind) in enumerate(self.V):
                if kind == "ang":
                    m *= math.sin(x[i]) ** e[pos[i]] * math.cos(x[i]) ** e[pos[i] + 1]
                else:
                    m *= x[i] ** e[pos[i]]
            tot += m
        return tot

    def __str__(self):
        if not self.t:
            return "0"
        pos, n = self.layout(self.V)
        parts = []
        for e, c in sorted(self.t.items(), key=lambda kv: (-sum(kv[0]), kv[0]), reverse=False):
            fac = []
            for i, (name, kind) in enumerate(self.V):
                if kind == "ang":
                    for k, fn in ((0, "sin"), (1, "cos")):
                        if e[pos[i] + k]:
                            fac.append(f"{fn}{name}" + (f"^{e[pos[i]+k]}" if e[pos[i] + k] > 1 else ""))
                elif e[pos[i]]:
                    fac.append(name + (f"^{e[pos[i]]}" if e[pos[i]] > 1 else ""))
            mono = "·".join(fac)
            if not mono:
                parts.append(str(c))
            elif c == 1:
                parts.append(mono)
            elif c == -1:
                parts.append("-" + mono)
            else:
                parts.append(f"{c}·{mono}")
        return " + ".join(parts).replace("+ -", "- ")


def bracket(f, g):
    n = len(f)
    return [sum((f[j] * g[i].d(j) - g[j] * f[i].d(j) for j in range(n)), Poly.const(f[0].V, 0)).norm() for i in range(n)]


def vf_str(v):
    return "(" + ", ".join(str(c) for c in v) + ")"


def make(V, comps):
    """comps 里每个分量是函数 P -> Poly，P(name) 给出变量，S(name)/C(name) 给出 sin、cos。"""
    idx = {name: i for i, (name, k) in enumerate(V)}
    P = lambda nm: Poly.var(V, idx[nm])
    S = lambda nm: Poly.var(V, idx[nm], "sin")
    Cc = lambda nm: Poly.var(V, idx[nm], "cos")
    K = lambda c: Poly.const(V, c)
    return [fn(P, S, Cc, K) for fn in comps]


def item11():
    show("11. Lie 括号（符号计算，[f,g] = (∂g/∂x) f − (∂f/∂x) g，式 15.80/15.81）")
    V = [("x", "lin"), ("y", "lin"), ("θ", "ang")]
    f = make(V, [lambda P, S, C, K: C("θ"), lambda P, S, C, K: S("θ"), lambda P, S, C, K: K(0)])
    g = make(V, [lambda P, S, C, K: K(0), lambda P, S, C, K: K(0), lambda P, S, C, K: K(1)])
    fg = bracket(f, g)
    print("   例 15.9 差速驱动 (15.82)：[f,g] =", vf_str(fg))
    print("   例 15.11：det H'(q) = det[f g [f,g]] 在随机点 =", [round(det([[c.ev(q) for c in (f[i], g[i], fg[i])] for i in range(3)]), 6) for q in ([0.3, -1, 0.7], [2, 1, -2.5])])
    V = [("x1", "lin"), ("x2", "lin"), ("x3", "lin")]
    f = make(V, [lambda P, S, C, K: K(1), lambda P, S, C, K: K(0), lambda P, S, C, K: -P("x2")])
    g = make(V, [lambda P, S, C, K: K(0), lambda P, S, C, K: K(1), lambda P, S, C, K: P("x1")])
    print("   例 15.10 非完整积分器 (15.85)：[f,g] =", vf_str(bracket(f, g)), " （原书 (15.85) 把 g 印成 (0,1,−x1)，应为 (0,1,x1)；结果不受影响）")
    f = make(V, [lambda P, S, C, K: P("x2"), lambda P, S, C, K: -P("x1"), lambda P, S, C, K: K(0)])
    g = make(V, [lambda P, S, C, K: P("x3"), lambda P, S, C, K: K(0), lambda P, S, C, K: -P("x1")])
    fg = bracket(f, g)
    rng = random.Random(1)
    dets = []
    for _ in range(5):
        q = [rng.uniform(-2, 2) for _ in range(3)]
        dets.append(det([[c.ev(q) for c in (f[i], g[i], fg[i])] for i in range(3)]))
    print("   例 15.13 困在球面上 (15.91)：[f,g] =", vf_str(fg), "；det[f g [f,g]] 在 5 个随机点：", [f"{d:.1e}" for d in dets])
    print("     （原书 (15.92) 把 H'(x) 按行写成 f、g、[f,g]，是 (15.87)(15.88) 按列写法的转置；行列式不变）")
    V5 = [(f"x{i}", "lin") for i in range(1, 6)]
    h1 = make(V5, [lambda P, S, C, K: K(1), lambda P, S, C, K: K(0), lambda P, S, C, K: P("x2"), lambda P, S, C, K: P("x3"), lambda P, S, C, K: P("x4")])
    h2 = make(V5, [lambda P, S, C, K, i=i: K(1 if i == 1 else 0) for i in range(5)])
    b1 = bracket(h1, h2)
    b2 = bracket(h1, b1)
    b3 = bracket(h1, b2)
    print("   例 15.17 链式系统：[h1,h2] =", vf_str(b1), "；[h1,[h1,h2]] =", vf_str(b2), "；[h1,[h1,[h1,h2]]] =", vf_str(b3))
    print("     （原书 (15.105) 印成 [0 0 0 0 1]ᵀ，符号应为负；(15.106) 最后一列同理；不影响满秩）")
    V2 = [("x1", "lin"), ("x2", "lin")]
    h0 = make(V2, [lambda P, S, C, K: K(0), lambda P, S, C, K: P("x1") * P("x1")])
    h1 = make(V2, [lambda P, S, C, K: K(1), lambda P, S, C, K: K(0)])
    b = bracket(h0, h1)
    print("   例 15.20：[h0,h1] =", vf_str(b), "；[h1,[h0,h1]] =", vf_str(bracket(h1, b)), "(15.112)")
    V = [("x1", "lin"), ("x2", "lin"), ("x3", "lin")]
    H = [make(V, [lambda P, S, C, K: P("x1"), lambda P, S, C, K: K(1) + P("x3"), lambda P, S, C, K: K(1)]),
         make(V, [lambda P, S, C, K: P("x1") * P("x2"), lambda P, S, C, K: (K(1) + P("x3")) * P("x2"), lambda P, S, C, K: P("x2")]),
         make(V, [lambda P, S, C, K: P("x1"), lambda P, S, C, K: P("x1"), lambda P, S, C, K: K(0)])]
    for q in ([1.0, 0.5, -0.3], [0.0, 0.5, -0.3]):
        M = [[h[i].ev(q) for h in H] for i in range(3)]
        print(f"   例 15.8：x = {q} 处 dim △(x) = rank[h1 h2 h3] = {rank(M)}")


# ============================================================================ 12. 换位运动
def item12():
    show("12. 换位运动 (15.71)：差速驱动依次 (1,0)、(0,1)、(−1,0)、(0,−1)，每段 Δt")
    print("   Δt     净位移 (x, y, θ)                     Δt²[f,g] = (0, −Δt², 0)   x / (Δt³/2)")
    for dt in (0.4, 0.2, 0.1, 0.05):
        q = follow((0, 0, 0), "S", [dt])
        q = (q[0], q[1], q[2] + dt)
        q = follow(q, "S", [-dt])
        q = (q[0], q[1], q[2] - dt)
        exact = (dt * (1 - math.cos(dt)), -dt * math.sin(dt))
        assert abs(q[0] - exact[0]) < 1e-12 and abs(q[1] - exact[1]) < 1e-12
        print(f"   {dt:<5}  ({q[0]:+.6f}, {q[1]:+.6f}, {q[2]:+.1f})   (0, {-dt*dt:+.6f}, 0)          {q[0] / (dt ** 3 / 2):.4f}")
    print("   闭式：净位移 = (Δt(1 − cos Δt), −Δt sin Δt, 0) ≈ (Δt³/2, −Δt², 0)：向 −y 侧移 Δt²，同时「稍微向前」Δt³/2（脚注 9）")
    print("   非完整积分器：边长 Δt 的正方形换位运动使 x3 增加 2Δt²，正好是 Δt²·[f,g] = Δt²·(0,0,2)；x3 的增量 = 2 × (x1,x2) 平面里圈出的有向面积")


# ============================================================================ 13. P. Hall 基
def phall(m, depth):
    """按书中三条规则生成 P. Hall 基（元素用嵌套元组表示，生成元是整数 1..m）。"""
    PH = list(range(1, m + 1))
    dep = {i: 1 for i in PH}
    for d in range(2, depth + 1):
        new = []
        for j, pj in enumerate(PH):
            for i, pi in enumerate(PH):
                if i >= j or dep[pi] + dep[pj] != d:
                    continue
                if isinstance(pj, int) or PH.index(pj[0]) <= i:
                    new.append((pi, pj))
        new.sort(key=lambda b: (PH.index(b[0]), PH.index(b[1])))
        for b in new:
            dep[b] = d
        PH += new
    return PH, dep


def ph_str(b):
    return f"h{b}" if isinstance(b, int) else f"[{ph_str(b[0])},{ph_str(b[1])}]"


def mobius(n):
    r, p, k = 1, 2, n
    while p * p <= k:
        if k % p == 0:
            k //= p
            if k % p == 0:
                return 0
            r = -r
        p += 1
    return -r if k > 1 else r


def witt(m, d):
    return sum(mobius(e) * m ** (d // e) for e in range(1, d + 1) if d % e == 0) // d


def item13():
    show("13. P. Hall 基（15.4.3 节）")
    for m in (2, 3):
        PH, dep = phall(m, 5)
        counts = [sum(1 for b in PH if dep[b] == d) for d in range(1, 6)]
        print(f"   m = {m}：深度 1..5 的个数 {counts}；Witt 公式 {[witt(m, d) for d in range(1, 6)]}")
    PH, dep = phall(3, 3)
    print("   例 15.18（m = 3，深度 ≤ 3）：", ", ".join(ph_str(b) for b in PH))
    print("   被 Jacobi 恒等式剔除的：[h1,[h2,h3]] = [h2,[h1,h3]] − [h3,[h1,h2]] (15.109)")
    rng = random.Random(2)
    M = [[[rng.uniform(-1, 1) for _ in range(3)] for _ in range(3)] for _ in range(3)]
    br = lambda a, b: matadd(matmul(a, b), matmul(b, a), 1, -1)
    lhs = br(M[0], br(M[1], M[2]))
    rhs = matadd(br(M[1], br(M[0], M[2])), br(M[2], br(M[0], M[1])), 1, -1)
    print(f"   用随机矩阵（[A,B] = AB − BA）核对 (15.109)：max 误差 = {max(abs(lhs[i][j] - rhs[i][j]) for i in range(3) for j in range(3)):.1e}")


# ============================================================================ 14. CBHD
def item14():
    show("14. CBHD 公式 (15.125)：log(e^p e^q) 的四阶项符号")
    rng = random.Random(1)
    br = lambda a, b: matadd(matmul(a, b), matmul(b, a), 1, -1)
    for eps in (0.1, 0.05, 0.025):
        p = [[eps * rng.gauss(0, 1) for _ in range(4)] for _ in range(4)]
        q = [[eps * rng.gauss(0, 1) for _ in range(4)] for _ in range(4)]
        Z = logm_near_identity(matmul(expm(p), expm(q)))
        base = matadd(matadd(matadd(matadd(p, q), br(p, q), 1, 0.5), br(br(p, q), q), 1, 1 / 12), br(br(p, q), p), 1, -1 / 12)
        t4 = br(p, br(q, br(p, q)))
        e_plus = max(abs(v) for r in matadd(Z, matadd(base, t4, 1, 1 / 24), 1, -1) for v in r)
        e_minus = max(abs(v) for r in matadd(Z, matadd(base, t4, 1, -1 / 24), 1, -1) for v in r)
        print(f"   ε = {eps:<6}：取 +1/24 的误差 {e_plus:.2e}，取 −1/24 的误差 {e_minus:.2e}")
    print("   ⇒ 误差随 ε 的阶：+1/24 是 O(ε⁴)，−1/24 是 O(ε⁵)。四阶项应为 −(1/24)[p,[q,[p,q]]]（原书 (15.125)(15.145) 印成 +）")
    p = [[0.1 * rng.gauss(0, 1) for _ in range(3)] for _ in range(3)]
    q = [[0.1 * rng.gauss(0, 1) for _ in range(3)] for _ in range(3)]
    lhs = matmul(matmul(expm(p), expm(q)), expm([[-v for v in r] for r in p]))
    S, Ad = [[0.0] * 3 for _ in range(3)], q
    for i in range(12):
        S = matadd(S, Ad, 1, 1 / math.factorial(i))
        Ad = br(p, Ad)
    print(f"   (15.126) e^p e^q e^(−p) = exp(Σ Ad_p^i q / i!)：max 误差 = {max(abs(a - b) for r1, r2 in zip(lhs, expm(S)) for a, b in zip(r1, r2)):.1e}")


# ============================================================================ 15. CFS
B_NI = [lambda x: [1.0, 0.0, -x[1]], lambda x: [0.0, 1.0, x[0]], lambda x: [0.0, 0.0, 2.0]]


def item15():
    show("15. 例 15.23：非完整积分器的 CFS 方程 (15.143) ż1 = v1, ż2 = v2, ż3 = v3 + z1 v2")
    v = lambda t: (math.cos(3 * t) + 0.2, math.sin(2 * t) - 0.4 * t, 0.3 * math.cos(t))
    x0 = [0.2, -0.1, 0.05]
    xT = rk4(lambda t, x: [sum(v(t)[i] * B_NI[i](x)[k] for i in range(3)) for k in range(3)], x0, 0, 2, 4000)
    z = rk4(lambda t, z: [v(t)[0], v(t)[1], v(t)[2] + z[0] * v(t)[1]], [0, 0, 0], 0, 2, 4000)
    flow = lambda i, x, tau: rk4(lambda t, y: B_NI[i](y), x, 0, tau, 2000)
    a = flow(2, flow(1, flow(0, x0, z[0]), z[1]), z[2])
    b = flow(0, flow(1, flow(2, x0, z[2]), z[1]), z[0])
    print("   扩展系统直接积分 x(T)      =", [round(c, 6) for c in xT])
    print("   先 b1(z1)、再 b2(z2)、再 b3(z3) =", [round(c, 6) for c in a], " ← 按原书「先积分 b1」的字面顺序，x3 对不上")
    print("   先 b3(z3)、再 b2(z2)、再 b1(z1) =", [round(c, 6) for c in b], " ← 与 (15.143) 一致：e^{z3 b3} e^{z2 b2} e^{z1 b1} 最左边的因子最先执行")


# ============================================================================ 16. 正弦输入
def item16():
    show("16. 正弦输入（15.5.2 节）")
    for k in (1, 2, -1):
        lam = 2 * k * PI
        u10, u20 = 0.7, -0.3

        def f(t, x):
            u1 = u10 * math.cos(lam * t) - u20 * math.sin(lam * t)
            u2 = u10 * math.sin(lam * t) + u20 * math.cos(lam * t)
            return [u1, u2, x[0] * u2 - x[1] * u1, u1 * u1 + u2 * u2]

        x = rk4(f, [0, 0, 0, 0], 0, 1, 4000)
        print(f"   k = {k:+d}（λ = {lam:+.4f}）：x(1) = ({x[0]:+.1e}, {x[1]:+.1e}, {x[2]:+.6f})；(u1²+u2²)/λ = {(u10**2+u20**2)/lam:+.6f}；代价 {x[3]:.4f} = λa = {lam*x[2]:.4f}")
    a = 0.5
    print(f"   要 x3(1) = a = {a}：代价 λa 最小取 k = 1（a > 0 时；a < 0 取 k = −1），λ = 2π，‖u(0)‖² = 2πa ⇒ ‖u(0)‖ = √(2πa) = {math.sqrt(TAU*a):.4f}")
    print("   （原书写「k = −1，λ = 2π，‖u‖ = 2πa」：k 与 λ = 2kπ 矛盾，且 ‖u‖ 应是 √(2πa)；同段「for some integer n」应为 k）")
    a1, b1, a2, b2 = 0.4, -0.9, 1.1, 0.3

    def g(t, x):
        w = TAU
        u1, u2 = a1 * math.sin(w * t) + b1 * math.cos(w * t), a2 * math.sin(w * t) + b2 * math.cos(w * t)
        return [u1, u2, x[0] * u2 - x[1] * u1, x[0] * u2]

    x = rk4(g, [0, 0, 0, 0], 0, 1, 4000)
    print(f"   (15.158) m = 2：Δx12 = {x[2]:.6f}；书中 ½(a2b1 − a1b2) = {0.5*(a2*b1-a1*b2):.6f}；1/(2π)·(a2b1 − a1b2) = {(a2*b1-a1*b2)/TAU:.6f}")
    print(f"            对 (15.156) ẋ12 = x1u2：Δx12 = {x[3]:.6f} = 1/(4π)·(…) = {(a2*b1-a1*b2)/(2*TAU):.6f}；x1, x2 回到 ({x[0]:.0e}, {x[1]:.0e})")
    n, x0, a, b = 6, [0.3, -0.2, 0.5, 0.1, -0.4, 0.2], 1.3, 0.8

    def chained(u):
        def f(t, x):
            u1, u2 = u(t)
            return [u1, u2] + [x[j - 1] * u1 for j in range(2, n)]
        return f

    print("   链式系统 n = 6，各阶段的净变化 Δx（a = 1.3, b = 0.8）：")
    for k in range(3, n + 1):
        xr = rk4(chained(lambda t: (a * math.sin(TAU * t), b * math.cos(TAU * (k - 2) * t))), x0, 0, 1, 4000)
        xb = rk4(chained(lambda t: (a * math.sin(TAU * k * t), b * math.cos(TAU * k * t))), x0, 0, 1, 4000)
        pred = (a / (4 * PI)) ** (k - 2) * b / math.factorial(k - 2)
        dr = [round(p - q, 6) for p, q in zip(xr, x0)]
        db = [round(p - q, 6) for p, q in zip(xb, x0)]
        print(f"   k = {k}: u1 = a sin2πt, u2 = b cos2π(k−2)t → Δx = {dr}，(15.162) 预测 Δx_k = {pred:.6g}")
        print(f"          按原书 (15.161) 两个都用 2πkt  → Δx = {db}")


# ============================================================================ 17. 微分平坦
def item17():
    show("17. 微分平坦（15.5.3 节）：单轮车 ẋ = v cosθ, ẏ = v sinθ, θ̇ = ω，平坦输出 y = (x, y)")
    P = [(0, 0), (1.5, 0), (2.0, 2.0), (3.5, 2.0)]  # 三次 Bézier 曲线

    def pos(t):
        c = [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3]
        return sum(ci * p[0] for ci, p in zip(c, P)), sum(ci * p[1] for ci, p in zip(c, P))

    def d1(t):
        c = [-3 * (1 - t) ** 2, 3 * (1 - t) ** 2 - 6 * t * (1 - t), 6 * t * (1 - t) - 3 * t * t, 3 * t * t]
        return sum(ci * p[0] for ci, p in zip(c, P)), sum(ci * p[1] for ci, p in zip(c, P))

    def d2(t):
        c = [6 * (1 - t), -12 * (1 - t) + 6 * t, 6 * (1 - t) - 12 * t, 6 * t]
        return sum(ci * p[0] for ci, p in zip(c, P)), sum(ci * p[1] for ci, p in zip(c, P))

    def inputs(t):  # (15.165)：u = g'(y, ẏ, ÿ)
        (xd, yd), (xdd, ydd) = d1(t), d2(t)
        v = math.hypot(xd, yd)
        return v, (xd * ydd - yd * xdd) / (v * v)

    th0 = math.atan2(d1(0)[1], d1(0)[0])  # (15.164)：x = g(y, ẏ)
    end = rk4(lambda t, s: [inputs(t)[0] * math.cos(s[2]), inputs(t)[0] * math.sin(s[2]), inputs(t)[1]], [0, 0, th0], 0, 1, 4000)
    print(f"   由 (y, ẏ, ÿ) 算出 v(t)、ω(t)，再积分：终点 ({end[0]:.6f}, {end[1]:.6f}, θ = {end[2]:.6f})")
    print(f"   平坦输出给出的终点 {pos(1)}，θ = {math.atan2(d1(1)[1], d1(1)[0]):.6f} —— 一致，规划时完全不需要积分")


# ============================================================================ 18. 单轮车 → 链式
def item18():
    show("18. 补充：单轮车化为链式形式 n = 3：z1 = θ, z2 = x cosθ + y sinθ, z3 = x sinθ − y cosθ")
    rng = random.Random(4)
    worst = 0.0
    for _ in range(200):
        x, y, th, v, w = (rng.uniform(-2, 2) for _ in range(5))
        xd, yd, thd = v * math.cos(th), v * math.sin(th), w
        z2d = xd * math.cos(th) + yd * math.sin(th) + (-x * math.sin(th) + y * math.cos(th)) * thd
        z3d = xd * math.sin(th) - yd * math.cos(th) + (x * math.cos(th) + y * math.sin(th)) * thd
        z2, z3 = x * math.cos(th) + y * math.sin(th), x * math.sin(th) - y * math.cos(th)
        u1, u2 = w, v - z3 * w
        worst = max(worst, abs(z2d - u2), abs(z3d - z2 * u1))
    print(f"   取 u1 = ω, u2 = v − z3 ω 后 ż1 = u1, ż2 = u2, ż3 = z2 u1 的最大残差 = {worst:.1e}")


# ============================================================================ 19. 小时间可达集
def item19():
    show("19. 小时间可达集（15.1.3 节，STLC）")
    rng = random.Random(9)
    minx2 = min(rk4(lambda t, s: [u, s[0] ** 2], [0.0, 0.0], 0, 0.5, 50)[1] for u in [rng.uniform(-3, 3) for _ in range(200)])
    print(f"   例 15.20：从原点出发、常值 u 积分 0.5 秒，x2 的最小值 = {minx2:.3e} ≥ 0：可达集在上半平面，原点不在内部 ⇒ 不是 STLC（但可达集有内点 ⇒ accessible）")
    T, n = 0.3, 3
    pts_d, pts_r = [], []
    for _ in range(4000):
        q, q2 = (0.0, 0.0, 0.0), (0.0, 0.0, 0.0)
        for _ in range(n):
            w = rng.choice("LSR")
            q = follow(q, w, [T / n])
            s = rng.choice((1, -1))
            q2 = follow(q2, rng.choice("LSR"), [s * T / n])
        pts_d.append(q)
        pts_r.append(q2)
    print(f"   Dubins 车 t = {T}：min x = {min(p[0] for p in pts_d):+.4f}（只能往前，x_I 不在可达集内部）")
    print(f"   Reeds–Shepp 车 t = {T}：x ∈ [{min(p[0] for p in pts_r):+.3f}, {max(p[0] for p in pts_r):+.3f}]，y ∈ [{min(p[1] for p in pts_r):+.3f}, {max(p[1] for p in pts_r):+.3f}]（包住了 x_I）")


def main():
    for item in (item1, item2, item3, item4, item5, item6, item7, item8, item9, item10, item11, item12, item13,
                 item14, item15, item16, item17, item18, item19):
        item()


if __name__ == "__main__":
    main()
