"""LaValle《Planning Algorithms》第 4 章 配置空间 —— 参考实现与数值核对。

教程页 part2/ch4-configuration-space.html 里出现的数字都由本文件验证。
运行：python3 ch4_configuration_space.py   （只用标准库）

依次核对：
  1. 例 4.13  一维 C-space 障碍（Minkowski 差）以及式 (4.38) 的卷积写法
  2. 例 4.15 / 图 4.19  三角形机器人 + 正方形障碍的 Cobs（星形算法），逐行核对半平面
  3. 例 4.16  允许旋转时的 v1, v2, v
  4. 式 (4.19)–(4.30)  四元数：乘法、R(h)=R(-h)、从矩阵反求四元数及其失效情形
  5. 4.4.2 节两连杆 variety：零维解、f1=0 的对角线与奇点
  6. 4.4.2 节三连杆：式 (4.70)(4.71) 与矩阵乘积 (4.69) 的对照；四连杆参数化 (4.73)
  7. 4.4.3 节自由度上界 m - l 与 Grübler 公式
"""
import math
import random
from fractions import Fraction as F

random.seed(4)
OK = "✓"
BAD = "✗"


def head(t):
    print("\n" + "=" * 70 + "\n" + t + "\n" + "=" * 70)


# ---------------------------------------------------------------- 1
head("1. 例 4.13：A = [-1, 2]，O = [0, 4]")
A1, O1 = (-1, 2), (0, 4)
cobs = (O1[0] - A1[1], O1[1] - A1[0])
print("Cobs = O ⊖ A =", cobs, OK if cobs == (-2, 5) else BAD)


def overlap(I, J):
    return max(0.0, min(I[1], J[1]) - max(I[0], J[0]))


def support(fn):
    qs = [i / 100 for i in range(-800, 1001)]
    pos = [q for q in qs if fn(q) > 1e-12]
    return (min(pos), max(pos))

# 机器人放在 q 时占据 A + q；碰撞 ⇔ |O ∩ (A+q)| > 0（这是「相关」correlation）
corr = support(lambda q: overlap(O1, (A1[0] + q, A1[1] + q)))
# 书中 (4.38) 写的是 h(x) = ∫ f(τ) g(x-τ) dτ，g(x-τ)=1 ⇔ τ ∈ x - A = [x-2, x+1]
conv = support(lambda x: overlap(O1, (x - A1[1], x - A1[0])))
print("h(q)=|O∩(A+q)| > 0 的开区间约为", corr, "→ int(Cobs) = (-2, 5)")
print("按 (4.38) 字面 g(x-τ) 计算 > 0 的区间约为", conv, "→ 这是 O ⊕ A = (-1, 6)，不是 Cobs")


# ---------------------------------------------------------------- 2
head("2. 例 4.15 / 图 4.19：星形算法")
A = [(F(1), F(0)), (F(0), F(1)), (F(-1), F(-1))]          # a1, a2, a3（逆时针）
O = [(F(1), F(1)), (F(-1), F(1)), (F(-1), F(-1)), (F(1), F(-1))]  # b1..b4（逆时针）
An = ["a1", "a2", "a3"]
On = ["b1", "b2", "b3", "b4"]


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def dot(p, q):
    return p[0] * q[0] + p[1] * q[1]


def outward(d):           # 逆时针多边形的边方向 d → 外法向（不单位化）
    return (d[1], -d[0])


def ang(v):
    a = math.atan2(v[1], v[0])
    return a + 2 * math.pi if a < 0 else a


def star(A, O):
    """返回按法向角排序的接触列表：(type, 法向角, 顶点名, 边名, n, 常数向量 c, 符号)。
    半平面统一写成  s * (n · q) + n · c <= 0。"""
    items = []
    m, k = len(A), len(O)
    for j in range(k):                       # O 的外法向 β → Type VE
        d = sub(O[(j + 1) % k], O[j])
        n = outward(d)
        # A 中与该边接触的顶点：在 -n 方向最远（n·a 最小）
        i = min(range(m), key=lambda i: dot(n, A[i]))
        items.append(("VE", ang(n), An[i], On[j] + "-" + On[(j + 1) % k], n, sub(A[i], O[j]), +1))
    for i in range(m):                       # A 的内法向 α → Type EV
        d = sub(A[(i + 1) % m], A[i])
        n = outward(d)                       # 半平面用 A 边的外法向
        inward = (-n[0], -n[1])
        j = max(range(k), key=lambda j: dot(n, O[j]) * -1)  # O 中在 -n 方向最远的顶点
        items.append(("EV", ang(inward), On[j], An[i] + "-" + An[(i + 1) % m], n, sub(O[j], A[i]), -1))
    items.sort(key=lambda t: t[1])
    return items


def fmt_hp(n, c, s):
    a, b, k = s * n[0], s * n[1], dot(n, c)
    g = math.gcd(math.gcd(int(abs(a)), int(abs(b))), int(abs(k))) or 1   # 去掉正的公因子，便于和书对照
    a, b, k = a / g, b / g, k / g
    terms = []
    for coef, var in ((a, "xt"), (b, "yt")):
        if coef == 0:
            continue
        sgn = "-" if coef < 0 else "+"
        mag = "" if abs(coef) == 1 else str(abs(coef))
        terms.append(f"{sgn} {mag}{var}")
    if k != 0:
        terms.append(("- " if k < 0 else "+ ") + str(abs(k)))
    s_ = " ".join(terms)
    s_ = s_[2:] if s_.startswith("+ ") else "-" + s_[2:]
    return s_ + " <= 0", (a, b, k)


book = {  # 图 4.19 的半平面：a*xt + b*yt + k <= 0
    ("VE", "a3", "b4-b1"): (1, 0, -2),
    ("VE", "a3", "b1-b2"): (0, 1, -2),
    ("EV", "b2", "a3-a1"): (-1, 2, -4),
    ("VE", "a1", "b2-b3"): (-1, 0, -2),
    ("EV", "b3", "a1-a2"): (-1, -1, -1),
    ("VE", "a2", "b3-b4"): (0, -1, -2),
    ("EV", "b4", "a2-a3"): (2, -1, -4),
}
rows = star(A, O)
mine = {}
for t, a_, v, e, n, c, s in rows:
    txt, coef = fmt_hp(n, c, s)
    key = (t, v, e)
    mine[key] = coef
    flag = OK if book.get(key) == coef else BAD + f"  书中为 {book.get(key)}（原书笔误，见教程脚注）"
    print(f"{t}  {v:>2}  {e:<6} α/β={math.degrees(a_):6.1f}°  {txt:<24} {flag}")

# 独立核对：Cobs = O ⊕ (-A) 的凸包
pts = [(o[0] - a[0], o[1] - a[1]) for o in O for a in A]


def hull(P):
    P = sorted(set(P))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

H = hull(pts)
print("Cobs 顶点（逆时针）:", [(int(x), int(y)) for x, y in H], f"共 {len(H)} 条边", OK if len(H) == 7 else BAD)
for key, (a, b, k) in mine.items():
    vals = [a * x + b * y + k for x, y in H]
    assert max(vals) == 0, key       # 每个半平面都恰好支撑凸包
print("我们算出的 7 个半平面都恰好支撑 O ⊕ (-A) 的凸包", OK)
q = (-1.5, -1.2)                     # 一个确实碰撞的配置
Aq = [(x + q[0], y + q[1]) for x, y in A]
print(f"反例：q = {q} 时 A(q) 的边 a1a2 穿过正方形（如 (-0.9,-0.8) 在 A(q) 边上且在 O 内）",
      "→ 书中第 5 行 -xt - yt - 1 <= 0 给出", -q[0] - q[1] - 1, "> 0，会把它误判为自由")


# ---------------------------------------------------------------- 3
head("3. 例 4.16：允许旋转（a = cos θ, b = sin θ）")
for _ in range(3):
    th = random.uniform(0, 2 * math.pi)
    a, b = math.cos(th), math.sin(th)
    xt, yt = random.uniform(-3, 3), random.uniform(-3, 3)
    R = lambda p: (a * p[0] - b * p[1] + xt, b * p[0] + a * p[1] + yt)
    a1, a2, a3 = R((1, 0)), R((0, 1)), R((-1, -1))
    v1, v2, v = sub(a2, a3), sub(a1, a3), sub(a3, (1, -1))
    exp1, exp2 = (a - 2 * b, 2 * a + b), (2 * a - b, a + 2 * b)
    expv = (-a + b + xt - 1, -a - b + yt + 1)
    good = all(abs(p - r) < 1e-12 for p, r in zip(v1 + v2 + v, exp1 + exp2 + expv))
    print(f"θ={th:.3f}: v1, v2, v 与书中表达式一致 {OK if good else BAD}")
print("原语个数：12 EV + 12 VE，每个 3 个原语，再加 Hs：", 24 * 3 + 1)


# ---------------------------------------------------------------- 4
head("4. 四元数")


def qmul(h1, h2):  # (4.19)
    a1, b1, c1, d1 = h1
    a2, b2, c2, d2 = h2
    return (a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
            a1 * b2 + a2 * b1 + c1 * d2 - c2 * d1,
            a1 * c2 + a2 * c1 + b2 * d1 - b1 * d2,
            a1 * d2 + a2 * d1 + b1 * c2 - b2 * c1)


def Rq(h):  # (4.20)
    a, b, c, d = h
    return [[2 * (a * a + b * b) - 1, 2 * (b * c - a * d), 2 * (b * d + a * c)],
            [2 * (b * c + a * d), 2 * (a * a + c * c) - 1, 2 * (c * d - a * b)],
            [2 * (b * d - a * c), 2 * (c * d + a * b), 2 * (a * a + d * d) - 1]]


def mm(X, Y):
    return [[sum(X[i][k] * Y[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def det3(M):
    return (M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
            + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]))


def close(X, Y, eps=1e-9):
    return all(abs(X[i][j] - Y[i][j]) < eps for i in range(3) for j in range(3))


def axis_angle(v, th):  # (4.21)
    n = math.sqrt(sum(x * x for x in v))
    v = [x / n for x in v]
    s = math.sin(th / 2)
    return (math.cos(th / 2), v[0] * s, v[1] * s, v[2] * s)


def rodrigues(v, th):
    n = math.sqrt(sum(x * x for x in v))
    x, y, z = [t / n for t in v]
    c, s, C = math.cos(th), math.sin(th), 1 - math.cos(th)
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]


def rand_unit_q():
    while True:
        h = [random.gauss(0, 1) for _ in range(4)]
        n = math.sqrt(sum(x * x for x in h))
        if n > 1e-6:
            return tuple(x / n for x in h)

ok = True
for _ in range(200):
    h1, h2 = rand_unit_q(), rand_unit_q()
    M = Rq(h1)
    ok &= close(mm(M, [list(r) for r in zip(*M)]), [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
    ok &= abs(det3(M) - 1) < 1e-9
    ok &= close(M, Rq(tuple(-x for x in h1)))
    ok &= close(Rq(qmul(h1, h2)), mm(Rq(h1), Rq(h2)))
print("200 个随机单位四元数：R(h) 正交、det=1、R(h)=R(-h)、R(h1·h2)=R(h1)R(h2)", OK if ok else BAD)
ok = all(close(Rq(axis_angle(v, th)), rodrigues(v, th))
         for v, th in [((1, 1, 1), 2.1), ((0, 0, 1), 0.7), ((1, -2, 0.5), 5.5)])
print("(4.21) 轴角 → 四元数 与 Rodrigues 公式一致", OK if ok else BAD)
hx, hz = axis_angle((1, 0, 0), math.pi / 2), axis_angle((0, 0, 1), math.pi / 2)
p, r = qmul(hx, hz), qmul(hz, hx)
print("不交换：hx·hz =", tuple(round(t, 4) for t in p), " hz·hx =", tuple(round(t, 4) for t in r))
# h p h* 旋转点
hpt = (0, 1.0, 2.0, 3.0)
for h in (hx, rand_unit_q()):
    hc = (h[0], -h[1], -h[2], -h[3])
    out = qmul(qmul(h, hpt), hc)[1:]
    M = Rq(h)
    ref = [sum(M[i][k] * hpt[1 + k] for k in range(3)) for i in range(3)]
    assert all(abs(x - y) < 1e-12 for x, y in zip(out, ref))
print("h·p·h* 与 R(h)p 一致", OK)


def quat_from_R(M):  # (4.24)–(4.30)
    r = lambda i, j: M[i - 1][j - 1]
    a = 0.5 * math.sqrt(max(0.0, r(1, 1) + r(2, 2) + r(3, 3) + 1))
    if a > 1e-6:   # a 很小时 (4.25)–(4.27) 数值上不稳定，改用 (4.28)–(4.30)
        return (a, (r(3, 2) - r(2, 3)) / (4 * a), (r(1, 3) - r(3, 1)) / (4 * a), (r(2, 1) - r(1, 2)) / (4 * a))
    den = math.sqrt(r(1, 2) ** 2 * r(1, 3) ** 2 + r(1, 2) ** 2 * r(2, 3) ** 2 + r(1, 3) ** 2 * r(2, 3) ** 2)
    if den < 1e-12:
        return None
    return (0.0, r(1, 3) * r(1, 2) / den, r(1, 2) * r(2, 3) / den, r(1, 3) * r(2, 3) / den)

ok = True
for _ in range(200):
    h = rand_unit_q()
    g = quat_from_R(Rq(h))
    ok &= all(abs(x - y) < 1e-9 for x, y in zip(g, h)) or all(abs(x + y) < 1e-9 for x, y in zip(g, h))
for _ in range(200):  # a = 0：绕任意轴转 π
    v = [random.gauss(0, 1) for _ in range(3)]
    h = axis_angle(v, math.pi)
    g = quat_from_R(Rq(h))
    ok &= all(abs(x - y) < 1e-9 for x, y in zip(g, h)) or all(abs(x + y) < 1e-9 for x, y in zip(g, h))
print("从矩阵反求四元数（含 a=0 的赤道情形）得到 h 或 -h", OK if ok else BAD)
for name, v in [("绕 x 转 π (r12=r13=0)", (1, 0, 0)), ("绕 y 转 π (r12=r23=0)", (0, 1, 0)), ("绕 z 转 π (r13=r23=0)", (0, 0, 1))]:
    print(f"  {name}: 分母为 0 → 失效 {OK if quat_from_R(Rq(axis_angle(v, math.pi))) is None else BAD}")
print("  → 失效的三种情形是 r12=r13=0、r12=r23=0、r13=r23=0（书中把 r12=r23=0 写了两遍）")


# ---------------------------------------------------------------- 5
head("5. 两连杆 variety")
sols = [(1, 0, 0, 1), (0, 1, 0, -1)]
for a1, b1, a2, b2 in sols:
    fs = (a1 * a2 - b1 * b2 + a1 - 1, a1 * b2 + a2 * b1 + b1 - 1, a1 * a1 + b1 * b1 - 1, a2 * a2 + b2 * b2 - 1)
    print("(a1,b1,a2,b2) =", (a1, b1, a2, b2), "代入 (4.64) 的四个多项式:", fs, OK if fs == (0, 0, 0, 0) else BAD)

f = lambda t1, t2: math.cos(t1) + math.cos(t1 + t2)   # 点 (1,0) ∈ A2 的 x 坐标 = (4.60) 取 x=1,y=0
ts = [i * 2 * math.pi / 360 for i in range(361)]
print("θ2 = π - 2θ1 处 max|f1| =", max(abs(f(t, math.pi - 2 * t)) for t in ts))
print("θ2 = π       处 max|f1| =", max(abs(f(t, math.pi)) for t in ts))
print("θ2 = π - θ1 （书中写法）处 max|f1| =", round(max(abs(f(t, math.pi - t)) for t in ts), 3), "→ 不在 variety 上")
crit = []
for t1 in (0, math.pi):
    for t2 in (0, math.pi):
        g1 = -math.sin(t1) - math.sin(t1 + t2)
        g2 = -math.sin(t1 + t2)
        if abs(g1) < 1e-12 and abs(g2) < 1e-12:
            crit.append((t1, t2, round(f(t1, t2), 12)))
print("梯度为 0 的点 (θ1, θ2, f1):", [(round(a, 3), round(b, 3), c) for a, b, c in crit])
print("  → f1 = 0 上有两个奇点 (0, π) 和 (π, π)；临界值 -2, 0, 2 决定拓扑在何处改变")


# ---------------------------------------------------------------- 6
head("6. 三连杆：式 (4.70)(4.71) 对照")


def fk3(t1, t2, t3, x=1.0, y=0.0):
    def T(th, tx):
        return [[math.cos(th), -math.sin(th), tx], [math.sin(th), math.cos(th), 0], [0, 0, 1]]
    M = mm(mm(T(t1, 0), T(t2, 1)), T(t3, 1))
    return (M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2])


def book470(a1, b1, a2, b2, a3, b3):
    return 2 * a1 * a2 * a3 - a1 * b2 * b3 + a1 * a2 - 2 * b1 * b2 * a3 - b1 * a2 * b3 + a1


def book471(a1, b1, a2, b2, a3, b3):
    return 2 * b1 * a2 * a3 - b1 * b2 * b3 + b1 * a2 + 2 * a1 * b2 * a3 + a1 * a2 * b3


def ours_x(a1, b1, a2, b2, a3, b3):
    return a1 + a1 * a2 - b1 * b2 + a1 * a2 * a3 - b1 * b2 * a3 - a1 * b2 * b3 - b1 * a2 * b3


def ours_y(a1, b1, a2, b2, a3, b3):
    return b1 + b1 * a2 + a1 * b2 + b1 * a2 * a3 + a1 * b2 * a3 + a1 * a2 * b3 - b1 * b2 * b3

e_book = e_ours = 0
for _ in range(500):
    t = [random.uniform(0, 2 * math.pi) for _ in range(3)]
    ab = [g(x) for x in t for g in (math.cos, math.sin)]
    X, Y = fk3(*t)
    e_book = max(e_book, abs(book470(*ab) - X), abs(book471(*ab) - Y))
    e_ours = max(e_ours, abs(ours_x(*ab) - X), abs(ours_y(*ab) - Y))
print("与 (4.69) 矩阵乘积的最大误差：书中 (4.70)(4.71) =", round(e_book, 3), "；按 (4.69) 展开 =", e_ours)
print("全零角度时：书中 (4.70) =", book470(1, 0, 1, 0, 1, 0), "；实际 x =", fk3(0, 0, 0)[0], "（最远只能伸到 3）")

segs = [lambda t: (0, 2 * t, math.pi), lambda t: (t, 2 * math.pi - t, math.pi + t),
        lambda t: (2 * math.pi - t, t, math.pi - t), lambda t: (2 * math.pi - t, math.pi, math.pi + t),
        lambda t: (t, math.pi, math.pi - t)]
err = max(math.dist(fk3(*sg(t)), (1, 0)) for sg in segs for t in [i * math.pi / 100 for i in range(101)])
print("四连杆参数化（f1=1, f2=0）的五段线段，末端到 (1,0) 的最大距离:", f"{err:.2e}", OK if err < 1e-9 else BAD)


# ---------------------------------------------------------------- 7
head("7. 自由度上界 m - l 与 Grübler 公式（平面、全转动副、根固定）")
presets = {"四连杆": (4, 4), "五连杆": (5, 5), "Watt 六连杆": (6, 7), "Stephenson 六连杆": (6, 7), "三角形桁架": (3, 3)}
for name, (N, J) in presets.items():
    m = N - 1                 # 生成树：N-1 条边，每个转动副 1 个自由度
    l = 2 * (J - (N - 1))     # 每条被剪掉的边（闭合约束）贡献 x、y 两个方程
    print(f"{name:<14} N={N} J={J}  m-l = {m}-{l} = {m - l}   Grübler 3(N-1)-2J = {3 * (N - 1) - 2 * J}")

print("\n全部核对完成。")
