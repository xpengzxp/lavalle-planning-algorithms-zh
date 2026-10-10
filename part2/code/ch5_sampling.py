"""第 5 章参考实现：核对教程页面里出现的数值。

只用 Python 标准库。运行：

    python3 part2/code/ch5_sampling.py

会依次打印：
  1. 图 5.2：van der Corput 序列（二进制位反转）
  2. van der Corput 在 [0,1]/~ 上的分散度：i 为 2 的幂时 = 1/(2i)
  3. 例 5.15：9 个点的 Sukharev 网格 / 标准网格在正方形与环面上的 L∞ 分散度
  4. 式 (5.20) 的下界与「维数灾难」表
  5. Halton (5.25) / Hammersley (5.26) 的前几个点
  6. 式 (5.18) 卡方误差 e(P)：随机点的期望值 k(1-1/100)，网格点为 0
  7. 例 5.1、5.2、5.4 的 SO(2)/SO(3) 度量；L1 例子 (0,0)→(2,5) = 7
  8. 式 (5.15) 均匀随机四元数 vs. 均匀随机欧拉角：旋转后 x 轴的 z 分量直方图
  9. 5.3.4 节 50 连杆链的逐参数 Lipschitz 常数（伸直 vs. 折叠）
 10. 5.3.4 节：按 van der Corput 顺序检查路径段的前几个参数
 11. 习题 6：van der Corput 在 [0,1]/~ 上的平均分散度 (5.42)，与闭式解对照
"""
import math
import random
from fractions import Fraction


# ---------------------------------------------------------------- 序列
def radical_inverse(i: int, p: int) -> Fraction:
    """式 (5.24)：把 i 的 p 进制表示反转到小数点后面。"""
    r, f = Fraction(0), Fraction(1, p)
    while i > 0:
        r += f * (i % p)
        i //= p
        f /= p
    return r


def van_der_corput(i: int) -> Fraction:
    """图 5.2 的 ν(i)，i 从 1 开始（第 1 个点是 0）。"""
    return radical_inverse(i - 1, 2)


def halton(i: int, primes=(2, 3)):
    """式 (5.25)，i 从 0 开始。"""
    return tuple(radical_inverse(i, p) for p in primes)


def hammersley(i: int, k: int, primes=(2,)):
    """式 (5.26)，i 从 0 开始，共 k 个点。"""
    return (Fraction(i, k),) + tuple(radical_inverse(i, p) for p in primes)


# ---------------------------------------------------------------- 分散度
def circle_dispersion(points):
    """[0,1]/~（圆周）上点集的分散度 = 最大间隙的一半。"""
    xs = sorted(points)
    gaps = [xs[j + 1] - xs[j] for j in range(len(xs) - 1)] + [1 - xs[-1] + xs[0]]
    return max(gaps) / 2


def linf_dispersion_2d(points, torus=False, res=600):
    """在 [0,1]^2 上用细网格数值估计 L∞ 分散度（sup_x min_p ρ(x,p)）。"""
    best = 0.0
    for a in range(res + 1):
        x = a / res
        for b in range(res + 1):
            y = b / res
            m = float("inf")
            for (px, py) in points:
                dx, dy = abs(x - px), abs(y - py)
                if torus:
                    dx, dy = min(dx, 1 - dx), min(dy, 1 - dy)
                m = min(m, max(dx, dy))
            best = max(best, m)
    return best


# ---------------------------------------------------------------- 度量
def so2_angle_metric(t1, t2):
    """式 (5.7)。"""
    d = abs(t1 - t2) % (2 * math.pi)
    return min(d, 2 * math.pi - d)


def quat_metric(h1, h2):
    """式 (5.10)(5.11)：沿 S^3 的距离，并把 h 与 -h 等同。"""
    dot = sum(a * b for a, b in zip(h1, h2))
    dot = max(-1.0, min(1.0, dot))
    return min(math.acos(dot), math.acos(-dot))


def quat_from_axis_angle(axis, theta):
    n = math.sqrt(sum(c * c for c in axis))
    s = math.sin(theta / 2) / n
    return (math.cos(theta / 2), axis[0] * s, axis[1] * s, axis[2] * s)


# ---------------------------------------------------------------- 旋转采样
def random_quaternion(rng):
    """式 (5.15)。"""
    u1, u2, u3 = rng.random(), rng.random(), rng.random()
    return (math.sqrt(1 - u1) * math.sin(2 * math.pi * u2),
            math.sqrt(1 - u1) * math.cos(2 * math.pi * u2),
            math.sqrt(u1) * math.sin(2 * math.pi * u3),
            math.sqrt(u1) * math.cos(2 * math.pi * u3))


def rotate_x_axis_by_quat(h):
    """把 (1,0,0) 用单位四元数 h=(a,b,c,d) 旋转，返回结果向量。"""
    a, b, c, d = h
    # 旋转矩阵的第一列
    return (a * a + b * b - c * c - d * d, 2 * (b * c + a * d), 2 * (b * d - a * c))


def rotate_x_axis_by_ypr(alpha, beta, gamma):
    """R = Rz(α) Ry(β) Rx(γ)（式 3.42 的 yaw-pitch-roll）作用在 (1,0,0)：第一列。"""
    return (math.cos(alpha) * math.cos(beta), math.sin(alpha) * math.cos(beta), -math.sin(beta))


def z_histogram(vectors, bins=10):
    hist = [0] * bins
    for v in vectors:
        z = max(-1.0, min(0.999999, v[2]))
        hist[int((z + 1) / 2 * bins)] += 1
    return hist


# ---------------------------------------------------------------- 主程序
def main():
    print("=" * 70)
    print("1. 图 5.2：van der Corput 序列")
    print(f"{'i':>3} {'naive':>7} {'binary':>8} {'reverse':>8} {'ν(i)':>7}")
    for i in range(1, 17):
        naive = Fraction(i - 1, 16)
        b = format(i - 1, "04b")
        print(f"{i:>3} {str(naive):>7} {'.' + b:>8} {'.' + b[::-1]:>8} {str(van_der_corput(i)):>7}")

    print("\n2. van der Corput 在圆周 [0,1]/~ 上的分散度（i 个点）")
    for i in [1, 2, 3, 4, 5, 6, 7, 8, 10, 16, 20, 32]:
        pts = [van_der_corput(j) for j in range(1, i + 1)]
        d = circle_dispersion(pts)
        print(f"   i={i:>3}: δ = {str(d):>6} = {float(d):.4f}   (1/(2i) = {1/(2*i):.4f}, 1/i = {1/i:.4f})")

    print("\n3. 例 5.15：k = 9，L∞ 分散度")
    suk = [((2 * a + 1) / 6, (2 * b + 1) / 6) for a in range(3) for b in range(3)]
    std = [(a / 3, b / 3) for a in range(3) for b in range(3)]
    print(f"   Sukharev 网格（1/6,1/2,5/6）在正方形上: {linf_dispersion_2d(suk):.4f}   书中: 1/6 = {1/6:.4f}")
    print(f"   Sukharev 网格在环面上:                 {linf_dispersion_2d(suk, torus=True):.4f}")
    print(f"   标准网格（0,1/3,2/3）在环面上:         {linf_dispersion_2d(std, torus=True):.4f}   书中: 1/6")
    print(f"   标准网格在正方形上（补充）:            {linf_dispersion_2d(std):.4f}   = 1/3，角 (1,1) 离最近点 1/3")

    print("\n4. 式 (5.20) 下界 δ ≥ 1/(2⌊k^(1/d)⌋)，以及保持 δ = 0.05 需要的点数 (⌈1/(2δ)⌉)^d")
    for d in [1, 2, 3, 6, 10, 20]:
        k = math.ceil(1 / (2 * 0.05)) ** d
        print(f"   d={d:>2}: k = 10^{d} = {k:,}")
    print(f"   k=196, d=2: 下界 = 1/(2*14) = {1/28:.4f}")

    print("\n5. Halton (2,3) 前 8 个点（i 从 0 开始）与 Hammersley k=8")
    for i in range(8):
        hx, hy = halton(i)
        mx, my = hammersley(i, 8)
        print(f"   i={i}: Halton ({str(hx):>5}, {str(hy):>5})   Hammersley ({str(mx):>4}, {str(my):>5})")

    print("\n6. 式 (5.18) 卡方误差 e(P)，10×10 个盒子")
    rng = random.Random(5)
    for k in [196, 1000, 10000]:
        vals = []
        for _ in range(200):
            boxes = [0] * 100
            for _ in range(k):
                boxes[int(rng.random() * 10) * 10 + int(rng.random() * 10)] += 1
            vals.append(sum((b - k / 100) ** 2 for b in boxes))
        print(f"   k={k:>5}: 随机点 e(P) 的平均值 ≈ {sum(vals)/len(vals):9.1f}   理论期望 k(1-1/100) = {k*0.99:9.1f}")
    print("   100×100 标准网格 (k=10000) 每个盒子恰好 100 个点: e(P) = 0 —— 「太均匀，不像随机」")

    print("\n7. 度量例子")
    print(f"   L1((0,0),(2,5)) = {abs(2-0)+abs(5-0)}   L2 = {math.hypot(2,5):.4f}   L∞ = {max(2,5)}")
    t1, t2 = math.radians(10), math.radians(350)
    print(f"   SO(2) θ1=10°, θ2=350°: |θ1-θ2| = {math.degrees(abs(t1-t2)):.0f}°, 式(5.7) = {math.degrees(so2_angle_metric(t1,t2)):.0f}°, 弦长(5.6) = {math.hypot(math.cos(t1)-math.cos(t2), math.sin(t1)-math.sin(t2)):.4f}")
    h1 = quat_from_axis_angle((0, 0, 1), math.radians(10))
    h2 = quat_from_axis_angle((0, 0, 1), math.radians(350))
    print(f"   SO(3) 绕 z 转 10° 与 350°: ρ_s(h1,h2) = {math.degrees(math.acos(sum(a*b for a,b in zip(h1,h2)))):.1f}° (S^3 上的角)，"
          f"式(5.11) = {math.degrees(quat_metric(h1,h2)):.1f}°（四元数是半角，所以 10° = 实际相差 20° 的旋转）")

    print("\n8. 式 (5.15) vs 均匀欧拉角：把 x 轴旋转后，z 分量的直方图（均匀分布在 S^2 上 ⇔ z 均匀）")
    rng = random.Random(1)
    N = 200000
    vq = [rotate_x_axis_by_quat(random_quaternion(rng)) for _ in range(N)]
    vy = [rotate_x_axis_by_ypr(rng.uniform(0, 2 * math.pi), rng.uniform(-math.pi / 2, math.pi / 2), rng.uniform(0, 2 * math.pi)) for _ in range(N)]
    norms = [math.sqrt(sum(c * c for c in random_quaternion(rng))) for _ in range(5)]
    print(f"   |h| 检查: {['%.6f' % n for n in norms]}")
    print("   四元数(5.15):", [round(c / N * 10, 3) for c in z_histogram(vq)])
    print("   均匀欧拉角  :", [round(c / N * 10, 3) for c in z_histogram(vy)])
    print("   （理想值每格 1.0；欧拉角在两极 z≈±1 处偏多、赤道附近偏少——β 均匀，但纬度带的面积 ∝ cos β）")

    print("\n9. 5.3.4 节：50 连杆、每节长 10 的平面链，第 i 个关节的局部 Lipschitz 常数 c_i")
    def ci(thetas, i, L=10):
        # c_i = 关节 i 到它后面所有点的最大距离（转 θ_i 时最远点的半径）
        pts, x, y, a = [(0.0, 0.0)], 0.0, 0.0, 0.0
        for t in thetas:
            a += t
            x += L * math.cos(a)
            y += L * math.sin(a)
            pts.append((x, y))
        jx, jy = pts[i - 1]
        return max(math.hypot(px - jx, py - jy) for px, py in pts[i - 1:])
    straight = [0.0] * 50
    folded = [0.0] + [math.pi] * 49
    print(f"   伸直 (θ=0):    末端在 (500,0)；c_1 = {ci(straight,1):.0f}, c_50 = {ci(straight,50):.0f}")
    print(f"   折叠 (θ_i=π):  c_1 = {ci(folded,1):.0f}, c_50 = {ci(folded,50):.0f}  —— 折叠后转 θ1，最远点只离关节 10")

    print("\n10. 用 van der Corput 顺序检查路径段：先 τ(1)，然后 τ(ν(1)), τ(ν(2)), ...")
    print("    ", ["1"] + [str(van_der_corput(i)) for i in range(1, 10)])

    print("\n11. 习题 6：平均分散度 = Σ g²/4（每段长 g 的空隙里，到最近点的平均距离是 g/4）")
    print("    闭式解（补充推导）：i = 2^m + j (0 ≤ j < 2^m) 时 = (2^(m+1) - j) / 2^(2m+3)")
    for i in [1, 2, 3, 4, 5, 6, 7, 8, 12, 16]:
        xs = sorted(van_der_corput(t) for t in range(1, i + 1))
        gaps = [xs[t + 1] - xs[t] for t in range(len(xs) - 1)] + [1 - xs[-1] + xs[0]]
        avg = sum(g * g for g in gaps) / 4
        m = i.bit_length() - 1
        j = i - 2 ** m
        closed = Fraction(2 ** (m + 1) - j, 2 ** (2 * m + 3))
        print(f"    i={i:>2}: Σg²/4 = {str(avg):>6}   闭式 = {str(closed):>6}   {'✓' if avg == closed else '✗'}")


if __name__ == "__main__":
    main()
