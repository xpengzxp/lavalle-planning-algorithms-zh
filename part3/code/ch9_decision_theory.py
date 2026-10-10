"""第 9 章「基本决策论」参考实现：核对教程页面上出现的每一个数值，以及原书笔误的判断。

只用 Python 标准库。运行：

    python3 part3/code/ch9_decision_theory.py

各节编号与页面对应：
   1. 9.1.1  Pareto 最优：例 9.1、例 9.2（收费公路）、习题 1
   2. 9.1.2  两颗骰子的事件与期望（例 9.4、9.5）、贝叶斯马赛克的默认数值
   3. 9.1.3  随机化策略：(9.13) 是线性的；猜硬币（例 9.7）对手会学习时
   4. 9.2.2  例 9.8–9.10、(9.17)、遗憾矩阵；原书例 9.10 笔误；习题 2、3、4、5、8
   5. 9.2.2  先验单纯形：例 9.8 在哪些 P(θ) 下选哪个动作
   6. 9.2.3  噪声传感器 y = θ + ψ（补充例子）：Θ(y)、后验 (9.25)(9.31)
   7. 9.2.4  例 9.11 OCR：图 9.1 的特征、冲突、补充的角点数 c、朴素贝叶斯的错误率
   8. 9.2.4  例 9.12 / 习题 16：参数估计（平方损失下最优估计 = 后验均值）
   9. 9.3.2  例 9.13–9.15：安全策略、上/下值、鞍点；原书 9.3.2 节「遗憾」段的笔误
  10. 9.3.3  随机化鞍点（精确分数单纯形法求线性规划）：(9.63)、习题 15、猜硬币、石头剪刀布
  11. 9.4.1  例 9.17–9.20：纯 Nash、可容许、混合 Nash；(9.75)(9.76) 丢掉的常数
  12. 9.4.2  例 9.21：三人博弈的纯 Nash 均衡（原书笔误核对）
  13. 9.5.1  例 9.22、9.23：期望、效用、确定性等价；例 9.24 的偏好
  14. 9.5.2  频率学派风险 (9.88)；例 9.26、9.27 的「无信息先验」
  15. 9.5.3  例 9.28：支票 vs 现金，反推先验的阈值
  16. 9.5.4  重复囚徒困境的循环赛（补充，Tit-for-Tat）
  17. 习题  习题 7 的分类边界、习题 11 的反例
"""
import itertools
import math
import random
from fractions import Fraction as F


def show(x):
    if isinstance(x, F):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    if isinstance(x, float):
        return f"{x:.6g}"
    return str(x)


def vec(v):
    return "[" + ", ".join(show(x) for x in v) + "]"


def header(t):
    print("\n" + "=" * 72 + "\n" + t + "\n" + "=" * 72)


# ====================================================================== 1. Pareto
def dominates(a, b):
    """a 支配 b：两者不等价，且每个分量都 ≤（9.1.1 节）。"""
    return tuple(a) != tuple(b) and all(x <= y for x, y in zip(a, b))


def pareto(costs):
    return [u for u, c in costs.items() if not any(dominates(d, c) for v, d in costs.items() if v != u)]


def fine(speed):
    """例 9.2 的罚款：56–65 罚 $50，66–75 罚 $100，76–85 罚 $200，86–100 罚 $500。"""
    if speed <= 55:
        return 0
    if speed <= 65:
        return 50
    if speed <= 75:
        return 100
    if speed <= 85:
        return 200
    return 500


def part1():
    header("1. Pareto 最优（9.1.1 节）")
    ex91 = {1: (4, 0), 2: (3, 3), 3: (2, 2), 4: (5, 7), 5: (9, 0)}
    print("例 9.1 Pareto 最优动作:", pareto(ex91), "（书：u = 1 和 u = 3）")
    for u, c in ex91.items():
        by = [v for v, d in ex91.items() if dominates(d, c)]
        print(f"   L({u}) = {c}  被支配于: {by}")
    D = 360  # 补充假设：宾夕法尼亚收费公路约 360 英里；Pareto 集与 D 无关
    tp = {s: (F(D, s), fine(s)) for s in range(50, 101)}
    ps = pareto(tp)
    print("例 9.2 Pareto 最优车速:", ps, "（书：55, 65, 75, 85, 100）")
    for s in ps:
        print(f"   {s} mph: 时间 {float(tp[s][0]):.3f} h, 罚款 ${tp[s][1]}")
    assert ps == [55, 65, 75, 85, 100]
    # 习题 1：U = [-10, 10]，L = (u², u − 1)
    grid = [F(i, 10) for i in range(-100, 101)]
    ex1 = {u: (u * u, u - 1) for u in grid}
    ps1 = pareto(ex1)
    print(f"习题 1（网格 0.1）Pareto 集: [{show(min(ps1))}, {show(max(ps1))}]，共 {len(ps1)} 个格点")
    assert min(ps1) == -10 and max(ps1) == 0


# ====================================================================== 2. 概率
def part2():
    header("2. 概率论回顾（9.1.2 节）")
    S = [(i, j) for i in range(1, 7) for j in range(1, 7)]
    P = F(1, 36)
    die = range(1, 7)
    print("例 9.5 一颗骰子 E[X] =", show(sum(F(s, 6) for s in die)), "；E[X | {4,5,6}] =", show(F(4 + 5 + 6, 3)))
    print("两颗骰子 X = i + j：E[X] =", show(sum((i + j) * P for i, j in S)))

    def report(name, E, Fv):
        pE = len(E) * P
        pF = len(Fv) * P
        pEF = len(E & Fv) * P
        cond = pEF / pF
        ex = sum(F(i + j) for i, j in Fv) / len(Fv)
        print(f"  {name}: P(E)={show(pE)}, P(F)={show(pF)}, P(E∩F)={show(pEF)}, P(E|F)={show(cond)}, "
              f"独立? {pEF == pE * pF}, E[X|F]={show(ex)}")
        return pE, pF, pEF

    # 骰子实验室的预设
    E7 = {s for s in S if s[0] + s[1] == 7}
    F3 = {s for s in S if s[0] == 3}
    report("E=和为7, F=第一颗是3", E7, F3)
    E10 = {s for s in S if s[0] + s[1] >= 10}
    F6 = {s for s in S if s[0] == 6}
    report("E=和≥10, F=第一颗是6", E10, F6)
    Eeven = {s for s in S if (s[0] + s[1]) % 2 == 0}
    Fdbl = {s for s in S if s[0] == s[1]}
    report("E=和为偶数, F=两颗相同", Eeven, Fdbl)
    # 条件独立的例子（补充）：G = 第一颗是奇数
    # 贝叶斯马赛克默认：罕见病检测
    prior, sens, fpr = F(1, 100), F(95, 100), F(5, 100)
    pE = sens * prior + fpr * (1 - prior)
    print(f"马赛克默认（补充：罕见病检测）：P(E) = {show(pE)} = {float(pE):.4f}，P(病|阳性) = {float(sens * prior / pE):.4f}")
    # 三个假设的预设：机器人在哪个房间（补充）
    pri = [F(1, 2), F(3, 10), F(1, 5)]
    lik = [F(1, 10), F(1, 2), F(9, 10)]
    pE = sum(a * b for a, b in zip(pri, lik))
    print("马赛克预设（三个房间）：P(E) =", show(pE), " 后验 =", vec([a * b / pE for a, b in zip(pri, lik)]))


# ====================================================================== 3. 随机化策略
def part3():
    header("3. 随机化策略（9.1.3 节）")
    La, Lb = 3, 5
    for w in (F(0), F(1, 4), F(1, 2), F(1)):
        print(f"  L(a)=3, L(b)=5, P(a)={show(w)}: L̄(w) = {show(w * La + (1 - w) * Lb)}")
    print("  (9.13) 是 w 的线性函数，最小值总在单纯形的顶点上取到 → 随机化不会更好")
    # 猜硬币：P1 代价矩阵（行 = P1 出 H/T，列 = P2 出 H/T）；HH/TT 时 P1 付 1
    A = [[1, -1], [-1, 1]]
    for p in (F(1, 2), F(6, 10), F(1)):
        best = max(p * A[0][j] + (1 - p) * A[1][j] for j in range(2))
        print(f"  P1 以概率 {show(p)} 出 H，对手知道 p 并最优应对时 P1 的期望代价 = {show(best)}")


# ====================================================================== 4. 与自然对弈
def regret_matrix(L):
    cols = list(zip(*L))
    mins = [min(c) for c in cols]
    return [[L[i][j] - mins[j] for j in range(len(mins))] for i in range(len(L))]


def expected(row, p):
    return sum(F(c) * q for c, q in zip(row, p))


def argmins(vals):
    m = min(vals)
    return [i + 1 for i, v in enumerate(vals) if v == m], m


def criteria(L, p, name):
    print(f"--- {name}")
    T = regret_matrix(L)
    wc = [max(r) for r in L]
    ec = [expected(r, p) for r in L]
    bc = [min(r) for r in L]
    wr = [max(r) for r in T]
    er = [expected(r, p) for r in T]
    print("  最坏代价 (9.14):", vec(wc), "→ u", argmins(wc))
    print("  期望代价 (9.15):", vec(ec), "→ u", argmins(ec))
    print("  最好代价（习题 3a）:", vec(bc), "→ u", argmins(bc))
    print("  遗憾矩阵 (9.20):", T)
    print("  最坏遗憾 (9.21):", vec(wr), "→ u", argmins(wr))
    print("  期望遗憾 (9.22):", vec(er), "→ u", argmins(er))
    return T, ec, er


def hurwicz_ranges(L):
    """(9.94)：α·max + (1−α)·min。返回 α 在 [0,1] 上的最优动作分段（精确分数）。"""
    lines = [(max(r) - min(r), min(r)) for r in L]  # 值 = a·α + b
    bps = {F(0), F(1)}
    for (a1, b1), (a2, b2) in itertools.combinations(lines, 2):
        if a1 != a2:
            x = F(b2 - b1, a1 - a2)
            if 0 < x < 1:
                bps.add(x)
    bps = sorted(bps)
    out = []
    for lo, hi in zip(bps, bps[1:]):
        mid = (lo + hi) / 2
        vals = [a * mid + b for a, b in lines]
        out.append((lo, hi, argmins(vals)[0]))
    return out


def part4():
    header("4. 与自然对弈（9.2.2 节）")
    L98 = [[1, -1, 0], [-1, 2, -2], [2, -1, 1]]
    T, ec, er = criteria(L98, [F(1, 5), F(1, 5), F(3, 5)], "例 9.8/9.9，P(θ) = [1/5, 1/5, 3/5]")
    assert ec == [0, -1, F(4, 5)]
    _, ec2, _ = criteria(L98, [F(1, 10), F(4, 5), F(1, 10)], "例 9.9，P(θ) = [1/10, 4/5, 1/10]")
    assert argmins(ec2)[0] == [1]
    _, _, er3 = criteria(L98, [F(1, 3)] * 3, "例 9.10，均匀 P(θ)")
    assert T == [[2, 0, 2], [0, 3, 0], [3, 0, 3]]
    print("  ★ 原书笔误：例 9.10 说期望遗憾最优是 u1、值为 1；实际 u1 = 4/3、u2 = 1、u3 = 2，最优是 u2。")
    assert er3 == [F(4, 3), 1, 2]
    print("  例 9.8 的乐观系数 (9.94) 分段:", [(show(a), show(b), u) for a, b, u in hurwicz_ranges(L98)])

    L2 = [[-1, 3, 2, -1], [-1, 0, 7, -1], [1, 5, 5, -2]]
    p2 = [F(1, 5), F(2, 5), F(1, 10), F(3, 10)]
    _, ec, er = criteria(L2, p2, "习题 2（以及 3、4）")
    print("  习题 3b 分段:", [(show(a), show(b), u) for a, b, u in hurwicz_ranges(L2)])
    # 习题 5：minimax 的 u1 同时是期望最优 ⇔ 3 p2 ≤ 5 p3 且 p4 ≤ 2 p1 + 2 p2 + 3 p3
    rnd = random.Random(5)
    agree = 0
    N = 200000
    for _ in range(N):
        x = sorted(rnd.random() for _ in range(3))
        p = [x[0], x[1] - x[0], x[2] - x[1], 1 - x[2]]
        e = [sum(c * q for c, q in zip(r, p)) for r in L2]
        ok = e[0] <= min(e)
        cond = 3 * p[1] <= 5 * p[2] and p[3] <= 2 * p[0] + 2 * p[1] + 3 * p[2]
        assert ok == cond
        agree += ok
    print(f"  习题 5：在 Δ³ 上均匀抽 {N} 个先验，minimax 与期望最优一致的比例 ≈ {agree / N:.3f}")
    L8 = [[2, -2, -2, 1], [-1, -2, -2, 6], [4, 0, -3, 4]]
    criteria(L8, [F(1, 4), F(1, 2), F(1, 8), F(1, 8)], "习题 8")


# ====================================================================== 5. 先验单纯形
def part5():
    header("5. 先验单纯形：例 9.8 的期望最优动作区域（互动图「P(θ) 决定一切」）")
    L = [[1, -1, 0], [-1, 2, -2], [2, -1, 1]]
    res = 300
    cnt = [0, 0, 0]
    tot = 0
    for i in range(res + 1):
        for j in range(res + 1 - i):
            p = (i / res, j / res, 1 - (i + j) / res)
            e = [sum(c * q for c, q in zip(r, p)) for r in L]
            cnt[e.index(min(e))] += 1
            tot += 1
    print("  三个动作在单纯形上的面积比例（u1, u2, u3）:", [round(c / tot, 3) for c in cnt])
    # u1 与 u2 的分界线：E1 − E2 = 2p1 − 3p2 + 2p3 = 0
    print("  E[L(u1)] − E[L(u2)] = 2p1 − 3p2 + 2p3；E[L(u1)] − E[L(u3)] = −p1 − p3 ≤ 0 → u3 永远不是唯一最优")


# ====================================================================== 6. 噪声传感器
def part6():
    header("6. 噪声传感器 y = h(θ, ψ) = θ + ψ（9.2.3 节的补充例子）")
    Theta = list(range(0, 21))
    psi = {-1: F(1, 4), 0: F(1, 2), 1: F(1, 4)}

    def lik(y, th):
        return psi.get(y - th, F(0))

    ys = [7, 8, 8]
    post = {th: F(1, len(Theta)) for th in Theta}
    sets = set(Theta)
    for y in ys:
        sets &= {th for th in Theta if y - th in psi}
        post = {th: post[th] * lik(y, th) for th in Theta}
        Z = sum(post.values())
        post = {th: v / Z for th, v in post.items()}
        print(f"  观测 y = {y}: Θ(y1)∩… = {sorted(sets)}，后验 = {{" +
              ", ".join(f'{th}: {show(v)}' for th, v in post.items() if v) + "}")
    mean = sum(th * v for th, v in post.items())
    print("  平方损失下的最优猜测（后验均值）=", show(mean), "；0-1 损失下（后验众数）=", max(post, key=post.get))


# ====================================================================== 7. OCR
# 图 9.1：形状 s、端点数 e、洞数 h。角点数 c 只有 E=2、F=1 来自书中，其余是我们按页面上的字形补充的
OCR = {
    "A": (0, 2, 1, 0), "B": (1, 0, 2, 2), "C": (1, 2, 0, 0), "D": (1, 0, 1, 2),
    "E": (0, 3, 0, 2), "F": (0, 3, 0, 1), "G": (1, 2, 0, 1), "H": (0, 4, 0, 0),
}
RANGES = [2, 5, 3, 3]  # s∈{0,1}, e∈{0..4}, h∈{0,1,2}, c∈{0,1,2}
# 英文字母频率（%），只取 A–H 再归一化（补充）
FREQ = {"A": 8.2, "B": 1.5, "C": 2.8, "D": 4.3, "E": 12.7, "F": 2.2, "G": 2.0, "H": 6.1}


def ocr_groups(use):
    groups = {}
    for L, f in OCR.items():
        groups.setdefault(tuple(f[i] for i in use), []).append(L)
    return groups


def ocr_error(use, eps, prior):
    """每个特征提取器以 1−ε 报告真值，否则均匀报告其它某个值；朴素贝叶斯分类器的精确错误率。"""
    letters = list(OCR)
    total_correct = 0.0
    for y in itertools.product(*[range(RANGES[i]) for i in use]):
        joint = []
        for L in letters:
            p = prior[L]
            for k, i in enumerate(use):
                p *= (1 - eps) if OCR[L][i] == y[k] else eps / (RANGES[i] - 1)
            joint.append(p)
        total_correct += max(joint)  # 选后验最大的类 = 最小化 (9.32) 的期望
    return 1 - total_correct


def part7():
    header("7. 例 9.11 OCR（9.2.4 节）")
    for use, name in (([0, 1, 2], "y = (s, e, h)"), ([0, 1, 2, 3], "y = (s, e, h, c)")):
        g = ocr_groups(use)
        amb = {k: v for k, v in g.items() if len(v) > 1}
        print(f"  {name}: 冲突组 = {amb}")
    print("  ★ 书中只指出 (0,3,0) 同时对应 E、F；按图 9.1，C 和 G 也都是 (1,2,0)。")
    tot = sum(FREQ.values())
    prior = {k: v / tot for k, v in FREQ.items()}
    uni = {k: 1 / 8 for k in OCR}
    print("  先验（英文字母频率归一化）:", {k: round(v, 4) for k, v in prior.items()})
    for eps in (0.0, 0.05, 0.1, 0.2):
        print(f"  ε = {eps}: 错误率 (s,e,h) 频率先验 {ocr_error([0, 1, 2], eps, prior):.4f}, "
              f"(s,e,h,c) 频率先验 {ocr_error([0, 1, 2, 3], eps, prior):.4f}, (s,e,h,c) 均匀先验 {ocr_error([0, 1, 2, 3], eps, uni):.4f}")


# ====================================================================== 8. 参数估计
def phi(x):
    return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


def Phi(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def part8():
    header("8. 参数估计（例 9.12、习题 16）")
    # 例 9.12：均匀先验 [a,b]，一个观测 y，噪声 σ；(9.39) 的最小点 = 截断正态均值
    a, b, sig, y = 0.0, 10.0, 2.0, 9.0
    al, be = (a - y) / sig, (b - y) / sig
    mean = y + sig * (phi(al) - phi(be)) / (Phi(be) - Phi(al))
    n = 20000
    num = den = 0.0
    for i in range(n):
        th = a + (b - a) * (i + 0.5) / n
        w = math.exp(-((y - th) ** 2) / (2 * sig * sig))
        num += th * w
        den += w
    print(f"  例 9.12（补充数值）：θ ~ U[0,10]，σ = 2，y = 9 → u* = {mean:.4f}（数值积分 {num / den:.4f}），比 y 更靠近中间")

    def cost(u):
        return sum(((u - (a + (b - a) * (i + 0.5) / 2000)) ** 2) * math.exp(-((y - (a + (b - a) * (i + 0.5) / 2000)) ** 2) / (2 * sig * sig)) for i in range(2000))

    us = [mean - 0.3, mean, mean + 0.3]
    print("  (9.39) 在 u*−0.3, u*, u*+0.3 处:", [round(cost(u) / 2000 * (b - a), 4) for u in us], "（中间最小）")
    # 习题 16：先验 N(0, 4²)，观测 N(θ, 9²)，y_i = 4
    for k in (1, 10, 1000):
        u = F(64 * k, 81 + 16 * k)
        post_sd = math.sqrt(1 / (1 / 16 + k / 81))
        print(f"  习题 16，k = {k}: u* = 后验均值 = {show(u)} ≈ {float(u):.4f}，后验标准差 {post_sd:.4f}")


# ====================================================================== 9. 零和：确定性
def security(A):
    rowmax = [max(r) for r in A]
    colmin = [min(A[i][j] for i in range(len(A))) for j in range(len(A[0]))]
    up, lo = min(rowmax), max(colmin)
    return rowmax, colmin, [i + 1 for i, v in enumerate(rowmax) if v == up], [j + 1 for j, v in enumerate(colmin) if v == lo], up, lo


def saddles(A):
    return [(i + 1, j + 1) for i, r in enumerate(A) for j, v in enumerate(r)
            if v == max(r) and v == min(A[k][j] for k in range(len(A)))]


def part9():
    header("9. 零和博弈：确定性策略（9.3.2 节）")
    for name, A in (("(9.42)", [[1, 3, 3, 2], [0, -1, 2, 1], [-2, 2, 0, 1]]),
                    ("(9.53)", [[3, 3, 5], [1, -1, 7], [0, -2, 4]]),
                    ("(9.54)", [[4, 3, 5, 1, 2], [-1, 0, -2, 0, -1], [-4, 1, 4, 3, 5], [-3, 0, -1, 0, -2], [3, 2, -7, 3, 8]])):
        rm, cm, us, vs, up, lo = security(A)
        print(f"  {name}: 行最大 {rm} → u* ∈ {us}, 上值 {up}；列最小 {cm} → v* ∈ {vs}, 下值 {lo}；鞍点 {saddles(A)}")
    A = [[1, 3, 3, 2], [0, -1, 2, 1], [-2, 2, 0, 1]]
    row = A[1]
    print(f"  (9.42) 中 u = 2 那一行: {row}；P2 的最好回应是 v = {row.index(max(row)) + 1}，代价 {max(row)}")
    print("  ★ 原书笔误：书中说 P2 应改选 v = 2 得到 L(2,2) = 2；实际 L(2,2) = −1，应为 v = 3、L(2,3) = 2。")
    assert A[1][1] == -1 and A[1][2] == 2


# ====================================================================== 10. 零和：随机化（线性规划）
def simplex_max(c, A, b):
    """max c·x  s.t. A x ≤ b, x ≥ 0（b ≥ 0），Bland 规则，精确分数。返回 (x, 对偶 y, 最优值)。"""
    m, n = len(A), len(c)
    T = [[F(v) for v in A[i]] + [F(int(i == k)) for k in range(m)] + [F(b[i])] for i in range(m)]
    z = [F(-v) for v in c] + [F(0)] * (m + 1)
    basis = [n + i for i in range(m)]
    while True:
        enter = next((j for j in range(n + m) if z[j] < 0), None)
        if enter is None:
            break
        rows = [(T[i][-1] / T[i][enter], basis[i], i) for i in range(m) if T[i][enter] > 0]
        _, _, r = min(rows)
        piv = T[r][enter]
        T[r] = [v / piv for v in T[r]]
        for i in range(m):
            if i != r and T[i][enter] != 0:
                f = T[i][enter]
                T[i] = [x - f * y for x, y in zip(T[i], T[r])]
        f = z[enter]
        z = [x - f * y for x, y in zip(z, T[r])]
        basis[r] = enter
    x = [F(0)] * n
    for i, j in enumerate(basis):
        if j < n:
            x[j] = T[i][-1]
    return x, [z[n + i] for i in range(m)], z[-1]


def solve_zero_sum(A):
    """P1 最小化 wAz、P2 最大化。返回 (w*, z*, 随机化值)。"""
    m, n = len(A), len(A[0])
    c = 1 - min(min(r) for r in A)
    Ap = [[F(A[i][j]) + c for j in range(n)] for i in range(m)]
    AT = [[Ap[i][j] for i in range(m)] for j in range(n)]
    x, y, opt = simplex_max([1] * m, AT, [1] * n)
    V = 1 / opt
    return [xi * V for xi in x], [yi * V for yi in y], V - c


def part10():
    header("10. 零和博弈：随机化鞍点（9.3.3 节，线性规划）")
    games = {
        "(9.63) 例 9.16": [[3, 0], [-1, 1]],
        "习题 15 (9.97)": [[0, -1], [-1, 2]],
        "猜硬币 例 9.7": [[1, -1], [-1, 1]],
        "石头剪刀布": [[0, 1, -1], [-1, 0, 1], [1, -1, 0]],
        "(9.42)": [[1, 3, 3, 2], [0, -1, 2, 1], [-2, 2, 0, 1]],
        "(9.53)": [[3, 3, 5], [1, -1, 7], [0, -2, 4]],
        "2×4 补充": [[3, -1, 2, 0], [-2, 4, -1, 1]],
        "3×2 补充": [[3, -1], [0, 2], [-2, 4]],
        "3×3 补充": [[2, -1, 0], [-1, 1, 2], [0, 3, -2]],
    }
    for name, A in games.items():
        w, z, v = solve_zero_sum(A)
        # 检查：w*A 的每个分量 ≤ v，A z* 的每个分量 ≥ v
        assert all(sum(w[i] * A[i][j] for i in range(len(A))) <= v for j in range(len(A[0])))
        assert all(sum(A[i][j] * z[j] for j in range(len(A[0]))) >= v for i in range(len(A)))
        _, _, _, _, up, lo = security(A)
        print(f"  {name}: w* = {vec(w)}, z* = {vec(z)}, 随机化值 = {show(v)}；确定性 下值 {lo} ≤ {show(v)} ≤ 上值 {up}")
    w, z, v = solve_zero_sum([[3, 0], [-1, 1]])
    assert w == [F(2, 5), F(3, 5)] and z == [F(1, 5), F(4, 5)] and v == F(3, 5)
    assert solve_zero_sum([[2, -1, 0], [-1, 1, 2], [0, 3, -2]])[2] == F(7, 15)
    # 习题 11 的反例：c < 0 时鞍点会变
    A = [[1, 2], [3, 4]]
    negA = [[-x for x in r] for r in A]
    print(f"  习题 11 反例：A = {A} 的鞍点 {saddles(A)}；−A 的鞍点 {saddles(negA)} → 「非零 c」应为 c > 0")
    assert saddles(A) != saddles(negA)


# ====================================================================== 11. 非零和二人博弈
def pure_nash(A, B):
    return [(i + 1, j + 1) for i in range(len(A)) for j in range(len(A[0]))
            if A[i][j] == min(A[k][j] for k in range(len(A))) and B[i][j] == min(B[i])]


def admissible(vs):
    return [v for v in vs if not any(dominates(w, v) for w in vs)]


def mixed_2x2(A, B):
    """内部混合均衡：z1 让 P1 无差别，w1 让 P2 无差别。"""
    da = A[0][0] - A[0][1] - A[1][0] + A[1][1]
    db = B[0][0] - B[0][1] - B[1][0] + B[1][1]
    if da == 0 or db == 0:
        return None
    z1 = F(A[1][1] - A[0][1], da)
    w1 = F(B[1][1] - B[1][0], db)
    if 0 <= z1 <= 1 and 0 <= w1 <= 1:
        return w1, z1
    return None


def ecost(M, w, z):
    return sum(M[i][j] * w[i] * z[j] for i in range(len(w)) for j in range(len(z)))


def part11():
    header("11. 非零和博弈（9.4.1 节）")
    games = {
        "例 9.17 (9.68)": ([[9, 4, 7], [6, -1, 5], [1, 4, 2]], [[2, 1, 6], [5, 0, 2], [2, 2, 5]]),
        "例 9.18 性别之战 (9.69)": ([[-2, 0], [0, -1]], [[-1, 0], [0, -2]]),
        "例 9.19 囚徒困境 (9.70)": ([[8, 0], [30, 2]], [[8, 30], [0, 2]]),
        "猜硬币（双矩阵写法）": ([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]),
        "胆小鬼博弈（补充）": ([[0, -1], [1, 10]], [[0, 1], [-1, 10]]),
    }
    for name, (A, B) in games.items():
        ne = pure_nash(A, B)
        cv = [(A[i - 1][j - 1], B[i - 1][j - 1]) for i, j in ne]
        sec1 = [i + 1 for i, r in enumerate(A) if max(r) == min(max(rr) for rr in A)]
        colmax = [max(B[i][j] for i in range(len(B))) for j in range(len(B[0]))]
        sec2 = [j + 1 for j, v in enumerate(colmax) if v == min(colmax)]
        line = f"  {name}: 纯 Nash {ne}，代价 {cv}，可容许 {admissible(cv)}；安全策略 P1 {sec1}、P2 {sec2}"
        if len(A) == 2 and len(A[0]) == 2:
            mx = mixed_2x2(A, B)
            if mx:
                w1, z1 = mx
                w, z = [w1, 1 - w1], [z1, 1 - z1]
                line += f"；混合 Nash w1 = {show(w1)}, z1 = {show(z1)}，期望代价 ({show(ecost(A, w, z))}, {show(ecost(B, w, z))})"
        print(line)
    # (9.75)(9.76) 的最后一行：检查丢掉的常数
    A, B = [[-2, 0], [0, -1]], [[-1, 0], [0, -2]]
    for w1, z1 in ((F(1, 3), F(1, 2)), (F(0), F(0)), (F(2, 3), F(1, 3))):
        w, z = [w1, 1 - w1], [z1, 1 - z1]
        l1, l2 = ecost(A, w, z), ecost(B, w, z)
        book1, book2 = -3 * w1 * z1 + w1 + z1, -3 * w1 * z1 + 2 * w1 + 2 * z1
        print(f"  w1={show(w1)}, z1={show(z1)}: wAz = {show(l1)}，书中末行 {show(book1)}（差 {show(l1 - book1)}）；"
              f"wBz = {show(l2)}，书中末行 {show(book2)}（差 {show(l2 - book2)}）")
        assert l1 - book1 == -1 and l2 - book2 == -2
    # 囚徒困境的两个变体（页面「试一试」）：把「双方拒绝」改成 (1,1) 或 (−1,−1)
    for r in (1, -1):
        A, B = [[8, 0], [30, r]], [[8, 30], [0, r]]
        print(f"  囚徒困境变体：双方拒绝 = ({r},{r}) → 纯 Nash {pure_nash(A, B)}")
    assert pure_nash([[8, 0], [30, 1]], [[8, 30], [0, 1]]) == [(1, 1)]
    assert pure_nash([[8, 0], [30, -1]], [[8, 30], [0, -1]]) == [(1, 1), (2, 2)]
    print("  ★ 原书笔误：(9.75) 末行应为 −3w1z1 + w1 + z1 − 1，(9.76) 末行应为 −3w1z1 + 2w1 + 2z1 − 2（导数不受影响）。")


# ====================================================================== 12. 三人博弈
def part12():
    header("12. 例 9.21 三人非零和博弈（9.4.2 节）")
    L = {(1, 1, 1): (1, 1, -2), (1, 1, 2): (-4, 3, 1), (1, 2, 1): (2, -4, 2), (1, 2, 2): (-5, -5, 10),
         (2, 1, 1): (3, -2, -1), (2, 1, 2): (-6, -6, 12), (2, 2, 1): (2, 2, -4), (2, 2, 2): (-2, 3, -1)}
    nes = []
    for a in L:
        devs = []
        for i in range(3):
            b = list(a)
            b[i] = 3 - b[i]
            b = tuple(b)
            if L[b][i] < L[a][i]:
                devs.append(f"P{i + 1}→{b} ({L[a][i]}→{L[b][i]})")
        print(f"  {a} 代价 {L[a]}: " + ("Nash 均衡" if not devs else "有人想改: " + "; ".join(devs)))
        if not devs:
            nes.append(a)
    print("  纯 Nash 均衡:", nes, "代价", [L[a] for a in nes])
    print("  ★ 原书笔误：书中说有两个纯 Nash 均衡，代价 (2,−4,2) 和 (3,−2,−1)；"
          "后者对应 (2,1,1)，但 P1 改选 1 后代价从 3 降到 L1(1,1,1) = 1，所以不是均衡。")
    assert nes == [(1, 2, 1)]
    # 补充：若 L1(1,1,1) ≥ 3（例如 4），(2,1,1) 也成为均衡，书中的说法就成立
    L2 = dict(L)
    L2[(1, 1, 1)] = (4, 1, -2)
    nes2 = [a for a in L2 if all(L2[tuple(3 - x if k == i else x for k, x in enumerate(a))][i] >= L2[a][i] for i in range(3))]
    print("  把 L1(1,1,1) 改成 4 后的纯 Nash 均衡:", nes2)
    assert nes2 == [(1, 2, 1), (2, 1, 1)]


# ====================================================================== 13. 效用
def part13():
    header("13. 效用理论（9.5.1 节）")
    lots = {"1: 确定 1000": [(1, 1000)], "2: 硬币 2000/0": [(0.5, 2000), (0.5, 0)],
            "3: 2/3 得 3000，1/3 付 3000": [(2 / 3, 3000), (1 / 3, -3000)]}
    W0 = 5000.0  # 补充：初始财富
    for name, L in lots.items():
        ev = sum(p * x for p, x in L)
        eu = sum(p * math.log(W0 + x) for p, x in L)
        ce = math.exp(eu) - W0
        print(f"  例 9.22 {name}: 期望 {ev:.0f}；𝒰 = ln(5000 + x) 时确定性等价 {ce:.1f}")
    # 例 9.23 情形 4：$10,000 vs 1/2 × $25,000；穷学生（财富 $1,000）用 ln
    for W in (1000.0, 1e7):
        eu1 = math.log(W + 10000)
        eu2 = 0.5 * math.log(W + 25000) + 0.5 * math.log(W)
        print(f"  例 9.23 情形 4，初始财富 ${W:,.0f}，𝒰 = ln: E𝒰(u1) = {eu1:.5f}，E𝒰(u2) = {eu2:.5f} → 选 {'u1' if eu1 > eu2 else 'u2'}")
    # 情形 5：100 次，每次 1/2 得 $250；总额 > $10,000 ⇔ 正面次数 > 40
    p_gt = sum(math.comb(100, k) for k in range(41, 101)) / 2 ** 100
    p_ge = sum(math.comb(100, k) for k in range(40, 101)) / 2 ** 100
    print(f"  例 9.23 情形 5：P(总额 > $10,000) = P(正面 ≥ 41) = {p_gt:.4f}；P(总额 ≥ $10,000) = {p_ge:.4f}")
    # 例 9.24：X = {0,1,2} 金币，𝒰(x) = x 时的期望效用
    z = {"z1": (F(1, 2), F(1, 4), F(1, 4)), "z2": (F(1, 3), F(1, 3), F(1, 3)), "z3": (F(1), F(0), F(0))}
    for k, v in z.items():
        print(f"  例 9.24 {k} = {vec(v)}：𝒰 = (0,1,2) 时 E[𝒰] = {show(sum(p * x for p, x in zip(v, (0, 1, 2))))}")


# ====================================================================== 14. 频率学派风险、无信息先验
def entropy(p):
    return -sum(x * math.log2(x) for x in p if x > 0)


def part14():
    header("14. 对概率模型的质疑（9.5.2 节）")
    # (9.88) 对 π_c(y) = c·y，y ~ N(θ, σ²)，平方损失：R(θ, π_c) = c²σ² + (1−c)²θ²
    sig = 1.0
    rnd = random.Random(1)
    for c, th in ((1.0, 0.5), (0.5, 0.5), (0.5, 2.0)):
        mc = sum((c * (th + rnd.gauss(0, sig)) - th) ** 2 for _ in range(200000)) / 200000
        print(f"  R(θ={th}, π_c={c}) 公式 {c * c * sig * sig + (1 - c) ** 2 * th * th:.4f}，蒙特卡罗 {mc:.4f}")
    print("  c = 1 与 c = 1/2 的风险曲线在 |θ| = √3·σ 处相交：", round(math.sqrt(3), 4))
    print(f"  例 9.26：H(1/2,1/2) = {entropy([.5, .5]):.4f} bit，H(1/3,1/3,1/3) = {entropy([1 / 3] * 3):.4f} bit；"
          "下雨或下雪的概率从 1/2 变成 2/3")
    # 例 9.27：上半球面 vs 上半立方体表面上的均匀分布，直线法向角 φ = atan2(θ2, θ1) 的分布
    rnd = random.Random(2)

    def sphere():
        while True:
            v = [rnd.gauss(0, 1) for _ in range(3)]
            r = math.sqrt(sum(x * x for x in v))
            v = [x / r for x in v]
            if v[0] < 0:
                v = [-x for x in v]
            return v

    def cube():
        # 立方体 [-1,1]^3 的表面（6 个面等面积），再把 θ1 < 0 的点取反
        f = rnd.randrange(6)
        a, b = rnd.uniform(-1, 1), rnd.uniform(-1, 1)
        ax, s = f // 2, 1 if f % 2 else -1
        v = [0.0, 0.0, 0.0]
        v[ax] = s
        others = [i for i in range(3) if i != ax]
        v[others[0]], v[others[1]] = a, b
        if v[0] < 0:
            v = [-x for x in v]
        return v

    N = 400000
    for name, gen in (("上半球面", sphere), ("上半立方体表面", cube)):
        near_axis = 0
        for _ in range(N):
            t = gen()
            phi_ = math.atan2(t[1], t[0])
            if abs(phi_) < math.pi / 8:
                near_axis += 1
        print(f"  例 9.27 {name}: P(|φ| < π/8) ≈ {near_axis / N:.4f}（φ 均匀时应为 0.25）")


# ====================================================================== 15. 支票 vs 现金
def part15():
    header("15. 例 9.28 支票 vs 现金（9.5.3 节）")
    # 收益：现金 1；支票 1000（兑现）或 0（跳票）
    p_star = F(999, 1000)
    print(f"  按期望收益，支票更好 ⇔ 1000·(1 − p) > 1 ⇔ 跳票概率 p < {show(p_star)}")
    print("  书中举的 0.999999 > 0.999，所以那样的先验下期望最优也是现金")


# ====================================================================== 16. 重复囚徒困境
COST = {("C", "C"): (8, 8), ("C", "R"): (0, 30), ("R", "C"): (30, 0), ("R", "R"): (2, 2)}  # C = 与当局合作（坦白），R = 拒绝（沉默）


def strat_moves(name, my_hist, op_hist):
    if name == "always_C":
        return "C"
    if name == "always_R":
        return "R"
    if name == "tft":
        return op_hist[-1] if op_hist else "R"
    if name == "grim":
        return "C" if "C" in op_hist else "R"
    if name == "alt":
        return "R" if len(my_hist) % 2 == 0 else "C"
    if name == "pavlov":  # 赢则保持、输则改变（补充）
        if not my_hist:
            return "R"
        c = COST[(my_hist[-1], op_hist[-1])][0]
        return my_hist[-1] if c <= 2 else ("C" if my_hist[-1] == "R" else "R")
    raise ValueError(name)


def play(a, b, rounds):
    ha, hb = [], []
    ca = cb = 0
    for _ in range(rounds):
        ma, mb = strat_moves(a, ha, hb), strat_moves(b, hb, ha)
        x, y = COST[(ma, mb)]
        ca += x
        cb += y
        ha.append(ma)
        hb.append(mb)
    return ca, cb


def part16():
    header("16. 重复囚徒困境循环赛（补充，9.5.4 节提到的 Tit-for-Tat）")
    def tour(field, rounds):
        tot = {n: 0 for n in field}
        for i, a in enumerate(field):
            for b in field[i:]:
                ca, cb = play(a, b, rounds)
                tot[a] += ca
                if a != b:
                    tot[b] += cb
        return tot

    default = ["always_C", "always_R", "tft", "grim", "pavlov"]
    t = tour(default, 20)
    print("  页面默认的 5 种策略、每场 20 轮:", sorted(t.items(), key=lambda x: x[1]))
    assert t["tft"] == t["grim"] == 342 and min(t.values()) == 342
    names = ["always_C", "always_R", "tft", "grim", "alt", "pavlov"]
    rounds = 20
    tot = {n: 0 for n in names}
    for i, a in enumerate(names):
        for b in names[i:]:
            ca, cb = play(a, b, rounds)
            if a == b:
                tot[a] += ca
            else:
                tot[a] += ca
                tot[b] += cb
    for n in sorted(names, key=lambda n: tot[n]):
        print(f"  {n:9s} 总刑期 {tot[n]}（每人与其余 5 种及自己各对局 {rounds} 轮）")
    print("  tft vs always_C:", play("tft", "always_C", rounds), " tft vs always_R:", play("tft", "always_R", rounds))


# ====================================================================== 17. 习题
def part17():
    header("17. 习题")
    # 习题 7：ω1 ~ N(0,1)，ω2 ~ N(6, 4)，等先验；选 ω1 ⇔ y² + 4y − 12 − (8/3) ln 2 < 0
    r = math.sqrt(16 + 8 / 3 * math.log(2))
    lo, hi = -2 - r, -2 + r

    def p(y, mu, s2):
        return math.exp(-(y - mu) ** 2 / (2 * s2)) / math.sqrt(2 * math.pi * s2)

    for y in (lo - 1e-6, lo + 1e-6, hi - 1e-6, hi + 1e-6):
        assert (p(y, 0, 1) > p(y, 6, 4)) == (lo < y < hi)
    err = 0.5 * (Phi(lo) + 1 - Phi(hi)) + 0.5 * (Phi((hi - 6) / 2) - Phi((lo - 6) / 2))
    print(f"  习题 7：γ(y) = ω1 ⇔ y ∈ ({lo:.4f}, {hi:.4f})，否则 ω2；错误率 {err:.4f}")


if __name__ == "__main__":
    for f in (part1, part2, part3, part4, part5, part6, part7, part8, part9, part10, part11, part12, part13, part14, part15, part16, part17):
        f()
    print("\n全部断言通过。")
