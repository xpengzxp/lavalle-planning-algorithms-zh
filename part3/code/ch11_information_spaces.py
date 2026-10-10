"""第 11 章「传感器与信息空间」参考实现：核对教程页面上出现的数值、互动图的默认设置，以及原书笔误的判断。

只用 Python 标准库。运行：

    python3 part3/code/ch11_information_spaces.py

各节编号与页面对应：
   1. 11.1.1  离散传感器的原像 H(y)：例 11.1–11.9（划分 / 非划分、非确定扰动让奇偶传感器失效）
   2. 11.1.2  历史 I-空间的大小：|I_k| = |I_0|·|U|^(k-1)·|Y|^k
   3. 11.2.2  例 11.13 三状态例子：(11.33)(11.34)、H(4) = {2}
   4. 11.2.1  I-map 的充分性检验（补充）：κ_ndet、κ_sf、κ_2、κ_stage 充分；「最小可能状态」「可能状态个数」不充分
   5. 11.2.3  三状态例子的概率 I-state（补充：自然动作取均匀分布）；习题 5（按更正后的读法）
   6. 11.3.1  例 11.15：η_5 与模型矛盾（原书笔误）；传感器反馈计划 (11.43)
   7. 11.3.1  例 11.16：目标可识别性——不确定 I-state 的宽度永远 ≤ 11
   8. 11.3.1  例 11.17：L 形走廊——书中的状态序列、κ_stage 计划、κ_19 在全部 2^19 − 1 个 I-state 上充分、κ_3 不充分
   9. 11.3.2  例 11.18、11.19：由 δ (11.47) 推出 F (11.50)；(11.52)；子集构造得到的 DFA
  10. 11.3.3 / 11.4.3  单纯形维数、球与椭球的参数个数、I_gauss 的维数
  11. 11.5.2  例 11.20：正弦曲线——经过 n 个极值后候选状态的个数
  12. 11.5.2  例 11.21：四条边的图——8 块 I-state 之间的转移（图 11.21）
  13. 11.5.4  例 11.24：托盘倾斜（补充：栅格化的托盘）——在 I_ndet 里广度优先搜索
  14. 11.6.1  卡尔曼滤波：(11.78)–(11.83) 与直接做高斯条件化一致；(11.83) 少了转置的反例
  15. 11.6.2  网格法与粒子滤波（补充：一维环形走廊里的门）
  16. 11.7.1  图 11.30 四种信息模型下的博弈值；例 11.26（图 11.31）
  17. 11.7.2  例 11.27 战舰（补充：7×7 小棋盘）的状态个数
"""
import itertools
import math
import random
from collections import deque
from fractions import Fraction as F


def header(t):
    print("\n" + "=" * 76 + "\n" + t + "\n" + "=" * 76)


def fr(x):
    if isinstance(x, F):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    if isinstance(x, float):
        return f"{x:.6g}"
    return str(x)


def vec(v):
    return "[" + ", ".join(fr(x) for x in v) + "]"


def sgn(x):
    return (x > 0) - (x < 0)


# ====================================================================== 1. 传感器与原像
WIN = range(-6, 7)   # 只在一个窗口里看整数线


def preimages(h, Psi, X=WIN):
    """H(y) = {x | ∃ψ ∈ Ψ(x), y = h(x, ψ)}（式 11.11；Ψ 只有一个元素时就是 11.6）。"""
    H = {}
    for x in X:
        for psi in Psi(x):
            H.setdefault(h(x, psi), set()).add(x)
    return {y: sorted(v) for y, v in sorted(H.items())}


def is_partition(H, X=WIN):
    seen = [x for v in H.values() for x in v]
    return len(seen) == len(set(seen)) == len(list(X))


SENSORS = {
    "奇偶 (11.2)": (lambda x, p: x % 2, lambda x: [0]),
    "模 3 (11.3)": (lambda x, p: x % 3, lambda x: [0]),
    "符号 (11.4)": (lambda x, p: sgn(x), lambda x: [0]),
    "恒等 (例 11.5)": (lambda x, p: x, lambda x: [0]),
    "零传感器 (例 11.6)": (lambda x, p: 0, lambda x: [0]),
    "扰动 x+ψ (11.8)": (lambda x, p: x + p, lambda x: [-1, 0, 1]),
    "扰动符号 (11.9)": (lambda x, p: sgn(x + p), lambda x: [-1, 0, 1]),
    "扰动奇偶 (11.10)": (lambda x, p: (x + p) % 2, lambda x: [0, 1]),
}


def item1():
    header("1. 11.1.1 传感器的原像（窗口 x ∈ [−6, 6]）")
    for name, (h, Psi) in SENSORS.items():
        H = preimages(h, Psi)
        short = {y: (v if len(v) <= 6 else v[:2] + ["…"] + v[-2:]) for y, v in H.items()}
        print(f"  {name:16s} 划分？{'是' if is_partition(H) else '否'}   H = {short}")
    H = preimages(*SENSORS["扰动符号 (11.9)"])
    assert H[0] == [-1, 0, 1] and all(0 in v for v in H.values())
    print("  例 11.8：H(0) = {−1, 0, 1}，三个原像都含 0 —— 与书中一致，不是划分")
    H = preimages(*SENSORS["扰动奇偶 (11.10)"])
    assert H[0] == H[1] == list(WIN)
    print("  例 11.9：非确定模型下 H(0) = H(1) = X，观测不提供任何信息")
    # 概率版：ψ 在 Ψ 上均匀时的 P(y|x)（式 11.7 的推广：对所有满足 y = h(x,ψ) 的 ψ 求和）
    h, Psi = SENSORS["扰动奇偶 (11.10)"]
    for q in (F(1, 2), F(4, 5)):
        Pyx = {x: {y: sum((q if p == 0 else 1 - q) for p in Psi(x) if h(x, p) == y) for y in (0, 1)} for x in (0, 1)}
        print(f"  扰动奇偶，P(ψ=0) = {fr(q)}：P(y|x=0) = {vec([Pyx[0][0], Pyx[0][1]])}，P(y|x=1) = {vec([Pyx[1][0], Pyx[1][1]])}"
              + ("（与 x 无关，没有信息）" if q == F(1, 2) else "（不同了：概率模型下有信息）"))


# ====================================================================== 2. 历史 I-空间的大小
def item2():
    header("2. 11.1.2 历史 I-空间 I_k = I_0 × Ũ_{k−1} × Ỹ_k 的大小（例 11.13 的 |U| = 3，|Y| = 5，I_0 只含一个初始条件）")
    for k in range(1, 7):
        n = 3 ** (k - 1) * 5 ** k
        print(f"  k = {k}: |I_k| = 3^{k - 1}·5^{k} = {n}")
    print("  I_hist 是这些集合的并 (11.19)，不是笛卡儿积；不确定 I-空间 pow(X) 只有 2^3 = 8 个元素 (11.32)")


# ====================================================================== 3. 例 11.13
X3 = (0, 1, 2)
U3 = (-1, 0, 1)
TH3 = (0, 1)
PS3 = (0, 1, 2)


def f3(x, u, th):
    return (x + u + th) % 3


def F3(x, u):
    """(11.28)"""
    return {f3(x, u, th) for th in TH3}


def H3(y):
    """(11.6)/(11.11)：y = x + ψ"""
    return {x for x in X3 for p in PS3 if x + p == y}


def ndet_step(S, u, y):
    """(11.30) 再 (11.31)"""
    pred = set().union(*[F3(x, u) for x in S]) if S else set()
    return pred, pred & H3(y)


def item3():
    header("3. 11.2.2 例 11.13：三状态例子的不确定 I-state")
    print(f"  H(y)：{ {y: sorted(H3(y)) for y in range(5)} }")
    X1 = {0, 2}
    S1 = X1 & H3(2)                                   # (11.29)
    assert S1 == {0, 2}
    print(f"  X_1 = {{0,2}}，y_1 = 2：X_1(η_1) = X_1 ∩ H(2) = {sorted(S1)}")
    assert f3(0, 1, 1) == 2
    pred, S2 = ndet_step(S1, 1, 3)
    assert F3(2, 1) == {0, 1} and F3(0, 1) == {1, 2} and pred == {0, 1, 2} and S2 == {1, 2}
    print(f"  u_1 = 1：F(2,1) ∪ F(0,1) = {sorted(F3(2, 1))} ∪ {sorted(F3(0, 1))} = {sorted(pred)}  (11.33)")
    print(f"  y_2 = 3：{sorted(pred)} ∩ H(3) = {sorted(S2)}  (11.34)；H(4) = {sorted(H3(4))}")
    # 所有可达的不确定 I-state（从任意非空初始集合出发）
    reach = set()
    for r in range(1, 4):
        for X1 in itertools.combinations(X3, r):
            for y in range(5):
                S = frozenset(set(X1) & H3(y))
                if S:
                    reach.add(S)
    print(f"  从任意初始集合出发，一步观测后可能出现的非空 I-state：{sorted(sorted(s) for s in reach)}")


# ====================================================================== 4. I-map 的充分性（补充）
def histories(X1, depth):
    """枚举例 11.13 中所有「可能出现」的历史 (u_1..u_{k-1}, y_1..y_k)（初始条件 X_1 固定），k ≤ depth。
       返回 [(us, ys, 不确定 I-state)]。"""
    out = []

    def rec(us, ys, S):
        out.append((us, ys, S))
        if len(ys) == depth:
            return
        for u in U3:
            pred = set().union(*[F3(x, u) for x in S])
            for y in range(5):
                S2 = pred & H3(y)
                if S2:
                    rec(us + (u,), ys + (y,), frozenset(S2))

    for y1 in range(5):
        S = frozenset(X1 & H3(y1))
        if S:
            rec((), (y1,), S)
    return out


KAPPAS = {
    "κ_ndet：X_k(η_k)": lambda us, ys, S: tuple(sorted(S)),
    "κ_sf：只记 y_k": lambda us, ys, S: ys[-1],
    "κ_2：最近两阶段 (11.41)": lambda us, ys, S: (us[-2:], ys[-2:]),
    "κ_stage：只记 k": lambda us, ys, S: len(ys),
    "估计：X_k 中最小的状态": lambda us, ys, S: min(S),
    "|X_k(η_k)|：可能状态的个数": lambda us, ys, S: len(S),
}


def sufficiency(kappa, H):
    """充分 ⇔ 只要 κ(η) = κ(η')，对同一个 (u, y) 总有 κ(η u y) = κ(η' u y)（11.2.1 节）。返回反例或 None。"""
    by = {}
    for us, ys, S in H:
        by[(us, ys)] = S
    succ = {}
    for us, ys, S in H:
        k0 = kappa(us, ys, S)
        for u in U3:
            for y in range(5):
                key = (us + (u,), ys + (y,))
                if key in by:
                    k1 = kappa(key[0], key[1], by[key])
                    t = (k0, u, y)
                    if t in succ and succ[t][0] != k1:
                        return (succ[t][1], (us, ys), u, y, succ[t][0], k1)
                    succ.setdefault(t, (k1, (us, ys)))
    return None


def item4():
    header("4. 11.2.1 I-map 的充分性检验（补充；例 11.13，X_1 = {0,1,2}，历史长度 ≤ 4）")
    H = histories({0, 1, 2}, 4)
    print(f"  可能出现的历史一共 {len(H)} 个")
    for name, kap in KAPPAS.items():
        ce = sufficiency(kap, H)
        if ce is None:
            print(f"  {name:28s} 充分")
        else:
            (u1, y1), (u2, y2), u, y, a, b = ce
            print(f"  {name:28s} 不充分：历史 u={u1} y={y1} 与 u={u2} y={y2} 的 κ 相同，再施加 u={u}、观测 y={y} 后分别得到 {a} 和 {b}")
    assert sufficiency(KAPPAS["κ_ndet：X_k(η_k)"], H) is None
    assert sufficiency(KAPPAS["估计：X_k 中最小的状态"], H) is not None


# ====================================================================== 5. 概率 I-state
def bayes(prior, lik):
    s = sum(p * l for p, l in zip(prior, lik))
    return [p * l / s for p, l in zip(prior, lik)], s


def predict(P, T):
    """(11.38)：T[x][x'] = P(x_{k+1} = x' | x_k = x, u_k)"""
    n = len(P)
    return [sum(P[x] * T[x][x2] for x in range(n)) for x2 in range(n)]


def item5():
    header("5. 11.2.3 三状态例子的概率 I-state")
    # 补充：例 11.13 的模型，θ ∈ {0,1} 与 ψ ∈ {0,1,2} 取均匀分布（书中例 11.14 没给数值）
    T = {u: [[F(sum(1 for th in TH3 if f3(x, u, th) == x2), len(TH3)) for x2 in X3] for x in X3] for u in U3}
    L = {y: [F(sum(1 for p in PS3 if x + p == y), len(PS3)) for x in X3] for y in range(5)}
    P = [F(1, 2), F(0), F(1, 2)]                        # 与例 11.13 一样 X_1 = {0, 2}，上面取均匀
    P, _ = bayes(P, L[2])
    print(f"  补充（均匀的 θ、ψ）：P(x_1) 在 {{0,2}} 上均匀，y_1 = 2 → P(x_1|η_1) = {vec(P)}")
    Pp = predict(P, T[1])
    print(f"  u_1 = 1 → P(x_2|η_1,u_1) = {vec(Pp)}  (11.38)；支撑集 {{0,1,2}} 正是 (11.33)")
    P2, _ = bayes(Pp, L[3])
    print(f"  y_2 = 3 → P(x_2|η_2) = {vec(P2)}  (11.39)；支撑集 {{1,2}} 正是 (11.34)")
    assert [p > 0 for p in Pp] == [True, True, True] and [p > 0 for p in P2] == [False, True, True]

    # 习题 5：按「行 = 当前状态」读矩阵，并把 (11.92) 的 5/5 改成 4/5
    print("  习题 5（更正后的读法：第 i 行第 j 列 = P(x_{k+1} = j−1 | x_k = i−1, u)；(11.92) 第一行中间是 4/5）：")
    T0 = [[F(4, 5), F(1, 5), F(0)], [F(1, 10), F(4, 5), F(1, 10)], [F(0), F(1, 5), F(4, 5)]]
    T1 = [[F(1, 10), F(4, 5), F(1, 10)], [F(0), F(1, 5), F(4, 5)], [F(0), F(0), F(1)]]
    T1_printed = [[F(1, 10), F(5, 5), F(1, 10)], [F(0), F(1, 5), F(4, 5)], [F(0), F(0), F(1)]]
    print(f"    行和：(11.91) {vec([sum(r) for r in T0])}，列和 {vec([sum(T0[i][j] for i in range(3)) for j in range(3)])}"
          f"；(11.92) 照印 {vec([sum(r) for r in T1_printed])} → 第一行和为 6/5，不是概率")
    Ly = {0: [F(4, 5), F(1, 2), F(1, 5)], 1: [F(1, 5), F(1, 2), F(4, 5)]}   # P(y | x)，按 x = 0,1,2
    P = [F(1, 3)] * 3
    us, ys = (1, 0), (1, 0, 0)                          # (11.96)
    P, _ = bayes(P, Ly[ys[0]])
    print(f"    P(x_1|η_1) = {vec(P)}")
    for k in range(2):
        P = predict(P, T1 if us[k] == 1 else T0)
        print(f"    P(x_{k + 2}|η_{k + 1}, u_{k + 1}) = {vec(P)}")
        P, _ = bayes(P, Ly[ys[k + 1]])
        print(f"    P(x_{k + 2}|η_{k + 2}) = {vec(P)}")
    print(f"    ≈ {[round(float(p), 4) for p in P]}（这些数也是互动图「概率 I-state 在单纯形上」里「回放习题 5」的结果）")


# ====================================================================== 6. 例 11.15
def item6():
    header("6. 11.3.1 例 11.15：符号传感器")
    us, ys = (-1, 1, 1, -1), (1, 1, 1, 1, 0)           # 书中的 η_5 = (X, −1, 1, 1, −1, 1, 1, 1, 1, 0)

    def consistent(us, ys):
        out = []
        for x1 in range(-50, 51):
            x, ok = x1, sgn(x1) == ys[0]
            for u, y in zip(us, ys[1:]):
                x += u
                ok = ok and sgn(x) == y
            if ok:
                out.append(x1)
        return out

    c = consistent(us, ys)
    print(f"  书中 η_5：u = {us}，y = {ys}；能产生它的 x_1：{c}（空 → 与模型矛盾：x_5 = x_1 + 0 = x_1 > 0，不可能读到 0）")
    assert c == []
    us2 = (-1, -1, -1, -1)
    c2 = consistent(us2, ys)
    print(f"  改成 u = {us2} 就能出现：x_1 ∈ {c2}")
    assert c2 == [4]

    # 传感器反馈计划 (11.43) 从任何 x_1 都在 |x_1| 步后停在 0
    def run(x):
        n = 0
        while True:
            y = sgn(x)
            if y == 0:
                return n
            x += -1 if y == 1 else 1
            n += 1

    assert all(run(x) == abs(x) for x in range(-30, 31))
    print("  传感器反馈计划 π(y) (11.43)：从 x_1 出发恰好 |x_1| 步到 0 后执行 u_T（最短）——核对了 x_1 ∈ [−30, 30]")


# ====================================================================== 7. 例 11.16
def item7():
    header("7. 11.3.1 例 11.16：目标可识别性（Ψ = {−5, …, 5}）")
    rnd = random.Random(1)
    worst = 0
    shrink = 0
    for trial in range(2000):
        x = rnd.randint(-40, 40)
        lo, hi = -10 ** 9, 10 ** 9                       # η_0 = X
        for k in range(60):
            y = x + rnd.randint(-5, 5)
            lo, hi = max(lo, y - 5), min(hi, y + 5)      # (11.31)：区间与 [y−5, y+5] 求交
            assert lo <= x <= hi
            worst = max(worst, hi - lo + 1)
            if -5 <= lo and hi <= 5:
                break
            u = -1 if (lo + hi) / 2 > 0 else 1           # 把区间往 0 推
            x += u
            lo, hi = lo + u, hi + u                       # (11.30)：没有自然干扰，整体平移
        if hi == lo:
            shrink += 1
    print(f"  随机 ψ 下，2000 次试验里不确定 I-state 最宽 {worst} 个状态（书：总是 11 个连续状态的子集）")
    assert worst == 11
    print(f"  到达 X_G = [−5, 5] 时偶尔会碰巧只剩 1 个状态（{shrink} 次），但对手式的自然 ψ = 常数 5 时宽度永远是 11：")
    x, lo, hi = 17, -10 ** 9, 10 ** 9
    for k in range(25):
        y = x + 5
        lo, hi = max(lo, y - 5), min(hi, y + 5)
        u = -1 if (lo + hi) / 2 > 0 else 1
        x += u
        lo, hi = lo + u, hi + u
    print(f"    x_1 = 17、ψ ≡ 5 跑 25 步：区间 [{lo}, {hi}]，宽 {hi - lo + 1}，真实 x = {x}——无法保证到达 {{0}}")


# ====================================================================== 8. 例 11.17 L 形走廊
CELLS = [(i, 1) for i in range(1, 11)] + [(1, j) for j in range(2, 11)]
IDX = {c: n for n, c in enumerate(CELLS)}
ACTS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def corridor_f(x, u, th):
    """沿 u 走 θ 步，被挡住就停在能走到的最远处。"""
    for _ in range(th):
        nx = (x[0] + u[0], x[1] + u[1])
        if nx not in IDX:
            break
        x = nx
    return x


def corridor_F(S, u):
    return {corridor_f(x, u, th) for x in S for th in (1, 2, 3)}


def k3(S):
    if S == {(1, 10)}:
        return "g"
    if all(c[0] == 1 for c in S):
        return "l"
    return "a"


def k19(S):
    if S == {(1, 10)}:
        return "g"
    for i in range(1, 11):
        if S <= {(1, j) for j in range(i, 11)}:
            low = i
    if all(c[0] == 1 for c in S):
        return f"l{min(c[1] for c in S)}"
    return f"a{max(c[0] for c in S)}"


def item8():
    header("8. 11.3.1 例 11.17：L 形走廊（19 个状态，没有传感器）")
    assert corridor_f((5, 1), (-1, 0), 2) == (3, 1)
    S = {(10, 1)}
    S = corridor_F(S, (-1, 0))
    assert S == {(7, 1), (8, 1), (9, 1)}
    print(f"  x_1 = (10,1)，u_1 = (−1,0) → {sorted(S)}")
    S = corridor_F(S, (-1, 0))
    assert S == {(i, 1) for i in range(4, 9)}
    print(f"  u_2 = (−1,0) → {sorted(S)}")
    for k in range(7):
        S = corridor_F(S, (-1, 0))
    assert S == {(1, 1)}
    print(f"  再走 7 次（共 9 次）：{sorted(S)}——书：九步或更多步之后 X(η_k) = {{(1,1)}}")
    S = set(CELLS)
    for k in range(9):
        S = corridor_F(S, (-1, 0))
    assert S == {(1, j) for j in range(1, 11)}
    for k in range(9):
        S = corridor_F(S, (0, 1))
    assert S == {(1, 10)}
    print("  κ_stage 计划（9 次 (−1,0)，再 9 次 (0,1)）：从整个 X 出发，9 步后只剩左边那一列，18 步后是 {(1,10)}；"
          "F 对集合单调，所以任何初始子集都行")
    # 用位掩码遍历全部 2^19 − 1 个不确定 I-state
    n = len(CELLS)
    single = {u: [0] * n for u in ACTS}
    for u in ACTS:
        for c in CELLS:
            m = 0
            for d in corridor_F({c}, u):
                m |= 1 << IDX[d]
            single[u][IDX[c]] = m
    N = 1 << n
    left = sum(1 << IDX[(1, j)] for j in range(1, 11))
    goal = 1 << IDX[(1, 10)]

    def lab19(m):
        if m == goal:
            return ("g", 0)
        if m & ~left == 0:                                  # 全是左边的状态：l_i，i = 最低的那个
            j = min(j for j in range(1, 11) if m >> IDX[(1, j)] & 1)
            return ("l", j)
        i = max(i for i in range(2, 11) if m >> IDX[(i, 1)] & 1)
        return ("a", i)

    def lab3(m):
        return "g" if m == goal else ("l" if m & ~left == 0 else "a")

    labels19 = {}
    labels3 = {}
    fwd = {u: [0] * N for u in ACTS}
    for u in ACTS:
        arr = fwd[u]
        for m in range(1, N):
            low = m & -m
            arr[m] = arr[m ^ low] | single[u][low.bit_length() - 1]
    bad19 = bad3 = None
    for m in range(1, N):
        a19, a3 = lab19(m), lab3(m)
        for u in ACTS:
            m2 = fwd[u][m]
            t19 = (a19, u)
            l2 = lab19(m2)
            if t19 in labels19 and labels19[t19][0] != l2 and bad19 is None:
                bad19 = (labels19[t19][1], m)
            labels19.setdefault(t19, (l2, m))
            t3 = (a3, u)
            l3 = lab3(m2)
            if t3 in labels3 and labels3[t3][0] != l3 and bad3 is None:
                bad3 = (t3, labels3[t3], (l3, m))
            labels3.setdefault(t3, (l3, m))
    names = sorted({lab19(m) for m in range(1, N)})
    print(f"  κ_19 的像一共 {len(names)} 个（g、l_1..l_9、a_2..a_10）；在全部 {N - 1} 个非空 I-state 上检查：", end="")
    assert bad19 is None and len(names) == 19
    print("充分")
    (lab, u), (l_a, m_a), (l_b, m_b) = bad3
    dec = lambda m: sorted(CELLS[i] for i in range(n) if m >> i & 1)
    print(f"  κ_3 不充分，反例：{dec(m_a)} 与 {dec(m_b)} 都是「{lab}」，施加 {u} 后分别变成「{l_a}」和「{l_b}」")
    # κ_19 计划（π(g)=u_T, π(l_i)=(0,1), π(a_i)=(−1,0)）的派生转移
    seq = []
    S = {(5, 1), (3, 1)}
    while True:
        lab = k19(S)
        seq.append(lab)
        if lab == "g":
            break
        S = corridor_F(S, (0, 1) if lab[0] == "l" else (-1, 0))
    print(f"  从 {{(3,1),(5,1)}} 按 κ_19 计划执行，派生 I-state 序列：{' → '.join(seq)}")


# ====================================================================== 9. NFA
DELTA = {
    ("a", "0"): set(), ("a", "1"): {"c"}, ("a", "e"): {"b"},
    ("b", "0"): {"a"}, ("b", "1"): set(), ("b", "e"): set(),
    ("c", "0"): {"b", "c"}, ("c", "1"): {"b"}, ("c", "e"): set(),
}


def eclose(S):
    S = set(S)
    stack = list(S)
    while stack:
        x = stack.pop()
        for z in DELTA[(x, "e")]:
            if z not in S:
                S.add(z)
                stack.append(z)
    return S


def nfa_F(x, u):
    """把 ε 闭包并进转移，得到 (11.50) 的 F(x, u)。"""
    return eclose(DELTA[(x, u)])


def item9():
    header("9. 11.3.2 NFA（例 11.18、11.19）")
    table = {x: {u: sorted(nfa_F(x, u)) for u in "01"} for x in "abc"}
    print(f"  由 δ (11.47) 加 ε 闭包得到的 F：{table}")
    assert table == {"a": {"0": [], "1": ["c"]}, "b": {"0": ["a", "b"], "1": []}, "c": {"0": ["b", "c"], "1": ["b"]}}
    S0 = eclose({"a"})
    assert S0 == {"a", "b"}
    step = lambda S, u: set().union(*[nfa_F(x, u) for x in S]) if S else set()
    S, trace = S0, [sorted(S0)]
    for u in "100":
        S = step(S, u)
        trace.append(sorted(S))
    assert trace == [["a", "b"], ["c"], ["b", "c"], ["a", "b", "c"]]
    print(f"  η_0 = {{a,b}}，输入 100：{' → '.join(''.join(t) or '∅' for t in trace)}  (11.52)")
    # 子集构造：从 {a,b} 出发可达的 I-state
    seen, q = {frozenset(S0): ""}, deque([frozenset(S0)])
    while q:
        S = q.popleft()
        for u in "01":
            T = frozenset(step(S, u))
            if T not in seen:
                seen[T] = seen[S] + u
                q.append(T)
    print("  子集构造（DFA 的状态 = 可达的不确定 I-state，括号里是到达它的最短输入）：")
    for S, w in seen.items():
        print(f"     {''.join(sorted(S)) or '∅':4s} ← '{w}'   {'接受' if 'a' in S else ''}")
    acc = [''.join(w) for n in range(0, 5) for w in itertools.product("01", repeat=n)
           if "a" in (lambda S: S)(__import__("functools").reduce(lambda S, u: step(S, u), w, set(S0)))]
    print(f"  长度 ≤ 4 的被接受串：{acc[:20]} …（空串也被接受：初始 I-state 已含 a）")


# ====================================================================== 10. 维数与参数个数
def item10():
    header("10. 11.3.3 / 11.4.3 / 11.6.1 维数与参数个数")
    for n in (2, 3, 4, 6, 10):
        ball = n + 1
        ell = math.comb(n, 2) + 2 * n
        gauss = 2 * n + math.comb(n, 2)
        assert ell == n + n * (n + 1) // 2
        print(f"  n = {n:2d}：球 {ball} 个参数，椭球 C(n,2)+2n = {ell}（中心 n + 对称矩阵 n(n+1)/2），I_gauss ⊂ R^{gauss}")
    print("  |X| = n 的 POMDP：I_prob 是 R^n 中的 (n−1)-单纯形；投影坐标 (p_0..p_{n−2}) 满足 p_0+…+p_{n−2} ≤ 1，p_{n−1} = 1 − p_0 − … − p_{n−2}")


# ====================================================================== 11. 例 11.20
def sine_candidates(events):
    """events：依次经过的极值（+1 / −1）。不确定 I-state = 单调段编号的集合；
       第 j 段是 x1 ∈ [jπ − π/2, jπ + π/2]，偶数段递增、奇数段递减。"""
    S = {0}                                      # X_0 = {x0}，x0 在第 0 段内部
    out = []
    for e in events:
        T = set()
        for j in S:
            up_end_right = (j % 2 == 0)              # 偶数段：右端是 +1
            if e == 1:
                T |= {j, j + 1 if up_end_right else j - 1}
            else:
                T |= {j, j - 1 if up_end_right else j + 1}
        S = T
        out.append(len(S))
    return out


def item11():
    header("11. 11.5.2 例 11.20：正弦曲线")
    c = sine_candidates([1, -1, 1, -1, 1])
    print(f"  依次碰到 y = 1, −1, 1, −1, 1 后（离开极值时）的候选状态个数：{c}")
    assert c[:2] == [2, 4]
    print("  书：碰到 y = 1 后 2 个，再到 y = −1 后 4 个；之后每碰一个极值增加 2 个（相邻的分支在峰顶会合并）")


# ====================================================================== 12. 例 11.21
def graph_transitions():
    """四条边的图（图 11.20b）：T（上边，右端是死胡同）、M（中边）、B（下边，左端是死胡同）、R（最右边）。
       T、M 在左端顶点相接；M、B、R 在右端顶点相接。不确定 I-state 是边的集合。"""
    pieces = [frozenset(s) for r in (1, 2, 3) for s in itertools.combinations("TMB", r)] + [frozenset("R")]
    E = {}
    for S in pieces:
        out = set()
        if S == {"R"}:
            out.add(("向左越过右顶点", frozenset("MB")))
        else:
            left = (frozenset("TM") if S & {"T", "M"} else frozenset()) | (frozenset("B") if "B" in S else frozenset())
            out.add(("到左端后折返", left))
            back = (frozenset("T") if "T" in S else frozenset()) | (frozenset("MB") if S & {"M", "B"} else frozenset())
            out.add(("到右端后折返", back))
            if S & {"M", "B"}:
                out.add(("向右越过右顶点", frozenset("R")))
        E[S] = out
    return pieces, E


def item12():
    header("12. 11.5.2 例 11.21：图上的点——8 块 I-state 之间的转移")
    pieces, E = graph_transitions()
    nm = lambda S: "{" + ",".join(sorted(S)) + "}"
    for S in pieces:
        print(f"  {nm(S):9s} → " + "；".join(f"{a} {nm(T)}" for a, T in sorted(E[S], key=lambda t: t[0])))
    # 从 {R} 出发能到哪些
    seen, q = {frozenset("R")}, deque([frozenset("R")])
    while q:
        S = q.popleft()
        for _, T in E[S]:
            if T not in seen:
                seen.add(T)
                q.append(T)
    print(f"  从 {{R}} 出发能到达：{sorted(nm(s) for s in seen)}——回不到单元素的左边 I-state（方向性约束）")
    assert frozenset("T") not in seen and frozenset("MB") in seen
    assert all(T != frozenset("R") for a, T in E[frozenset("T")])
    print("  {T} 一直向右走只会撞到死胡同，到不了 {R}（书中「图 11.20」应为图 11.21）")


# ====================================================================== 13. 托盘
TRAY = [
    "##############",
    "#......#.....#",
    "#.####.#.###.#",
    "#.#....#...#.#",
    "#.#.######.#.#",
    "#.#......#.#.#",
    "#.######.#...#",
    "#......#.###.#",
    "#.####.#.....#",
    "#......#######",
    "##############",
]
TILTS = [((0, 1), "下"), ((-1, 1), "左下"), ((1, 1), "右下"), ((0, -1), "上"), ((-1, -1), "左上"), ((1, -1), "右上"), ((-1, 0), "左"), ((1, 0), "右")]


def tray_roll(free, c, d):
    """补充的离散规则：沿倾斜方向一格一格滚；斜向被挡住时沿墙滑（先试横向分量，再试纵向分量），都走不动就停。"""
    x, y = c
    dx, dy = d
    while True:
        if dx and dy and (x + dx, y + dy) in free and (x + dx, y) in free and (x, y + dy) in free:
            x, y = x + dx, y + dy
        elif dx and (x + dx, y) in free:
            x += dx
        elif dy and (x, y + dy) in free:
            y += dy
        else:
            return (x, y)


def item13():
    header("13. 11.5.4 例 11.24：托盘倾斜（补充：栅格化的托盘，与互动图相同）")
    free = {(x, y) for y, row in enumerate(TRAY) for x, ch in enumerate(row) if ch != "#"}
    start = frozenset(free)
    prev = {start: None}
    q = deque([start])
    while q:
        S = q.popleft()
        for d, nmd in TILTS:
            T = frozenset(tray_roll(free, c, d) for c in S)
            if T not in prev:
                prev[T] = (S, nmd)
                q.append(T)

    def plan(S):
        out = []
        while prev[S]:
            S, nmd = prev[S]
            out.append(nmd)
        return out[::-1]

    singles = sorted((S for S in prev if len(S) == 1), key=lambda S: (len(plan(S)), sorted(S)))
    print(f"  {len(free)} 个格子；从 X_1 = X 出发可达的不确定 I-state 共 {len(prev)} 个；能被「逼」到的单个格子 {len(singles)} 个：")
    for S in singles:
        (c,) = S
        print(f"     目标 (列 {c[0]}, 行 {c[1]})：{len(plan(S))} 步 {plan(S)}")
    goal = frozenset({(8, 3)})
    assert len(plan(goal)) == 6
    print(f"  互动图默认目标 (8,3)：最短 6 步 {plan(goal)}（与书中图 11.29 一样是 6 次倾斜，但托盘不同）")


# ====================================================================== 14. 卡尔曼
def mat(A):
    return [list(map(float, r)) for r in A]


def mm(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]


def mt(A):
    return [list(r) for r in zip(*A)]


def madd(A, B, s=1.0):
    return [[a + s * b for a, b in zip(ra, rb)] for ra, rb in zip(A, B)]


def minv(A):
    n = len(A)
    M = [list(r) + [1.0 if i == j else 0.0 for j in range(n)] for i, r in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        pv = M[c][c]
        M[c] = [v / pv for v in M[c]]
        for r in range(n):
            if r != c:
                f = M[r][c]
                M[r] = [a - f * b for a, b in zip(M[r], M[c])]
    return [r[n:] for r in M]


def eye(n):
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def kalman_step(mu, S, u, y, A, B, G, C, H, Sth, Sps, transpose=True):
    mp = madd(mm(A, mu), mm(B, u))
    Sp = madd(mm(mm(A, S), mt(A)), mm(mm(G, Sth), mt(G)))                     # (11.81)
    R = mm(mm(H, Sps), mt(H) if transpose else H)
    L = mm(mm(Sp, mt(C)), minv(madd(mm(mm(C, Sp), mt(C)), R)))                 # (11.83)
    mu2 = madd(mp, mm(L, madd(y, mm(C, mp), -1)))                              # (11.80)
    S2 = mm(madd(eye(len(S)), mm(L, C), -1), Sp)                               # (11.82)
    return mu2, S2


def gauss_condition(mu, S, u, y, A, B, G, C, H, Sth, Sps):
    """直接写出 (x_{k+1}, y_{k+1}) 的联合高斯，再按标准公式条件化——不经过 (11.80)–(11.83)。"""
    mx = madd(mm(A, mu), mm(B, u))
    Sxx = madd(mm(mm(A, S), mt(A)), mm(mm(G, Sth), mt(G)))
    Sxy = mm(Sxx, mt(C))
    Syy = madd(mm(mm(C, Sxx), mt(C)), mm(mm(H, Sps), mt(H)))
    K = mm(Sxy, minv(Syy))
    return madd(mx, mm(K, madd(y, mm(C, mx), -1))), madd(Sxx, mm(K, mt(Sxy)), -1)


def item14():
    header("14. 11.6.1 卡尔曼滤波")
    r2 = math.sqrt(2)
    A = mat([[0, r2, 1], [1, -1, 4], [2, 0, 1]])                     # 例 11.25 (11.76)
    B = mat([[1, 0], [0, 1], [1, 1]])
    G = mat([[1, 1], [0, -1], [0, 1]])
    C = mat([[1, 0, 0], [0, 1, 1]])                                   # 补充：书中没给 C、H、Σ
    H = mat([[1, 0.5], [0, 2]])                                       # 故意取不对称的 H
    Sth = mat([[0.2, 0.05], [0.05, 0.1]])
    Sps = mat([[0.3, 0.0], [0.0, 0.1]])
    mu, S = mat([[0], [0], [0]]), eye(3)
    u, y = mat([[1], [-1]]), mat([[0.4], [2.0]])
    k1 = kalman_step(mu, S, u, y, A, B, G, C, H, Sth, Sps, True)
    g1 = gauss_condition(mu, S, u, y, A, B, G, C, H, Sth, Sps)
    err = max(abs(a - b) for M1, M2 in zip(k1, g1) for ra, rb in zip(M1, M2) for a, b in zip(ra, rb))
    print(f"  例 11.25 的 A、B、G + 补充的 C、H、Σ：(11.80)–(11.83)（H 带转置）与直接条件化的最大差 {err:.2e}")
    assert err < 1e-9
    k2 = kalman_step(mu, S, u, y, A, B, G, C, H, Sth, Sps, False)
    err2 = max(abs(a - b) for M1, M2 in zip(k2, g1) for ra, rb in zip(M1, M2) for a, b in zip(ra, rb))
    print(f"  照印 (11.83) 写成 H Σ_ψ H（没有转置）：最大差 {err2:.3f}——H 不对称时结果错误；与 (11.79) 的 H_1 Σ_ψ H_1ᵀ 不一致")
    assert err2 > 1e-3
    # 平面机器人（互动图「卡尔曼滤波」的默认模型）：x_{k+1} = x_k + u_k + θ_k，y = C x + ψ
    S = [[1.0, 0.0], [0.0, 1.0]]
    I2 = eye(2)
    for k in range(40):
        Sp = madd(S, [[0.04, 0], [0, 0.04]])
        L = mm(Sp, minv(madd(Sp, [[0.25, 0], [0, 0.25]])))
        S = mm(madd(I2, L, -1), Sp)
    print(f"  平面机器人（Σ_θ = 0.04 I，Σ_ψ = 0.25 I，C = I）：40 步后协方差收敛到 {S[0][0]:.4f} I（稳态解 {(-0.04 + math.sqrt(0.04 ** 2 + 4 * 0.04 * 0.25)) / 2:.4f}）")
    S = [[1.0, 0.0], [0.0, 1.0]]
    for k in range(40):
        Sp = madd(S, [[0.04, 0], [0, 0.04]])
        Cx = [[1.0, 0.0]]
        L = mm(mm(Sp, mt(Cx)), minv(madd(mm(mm(Cx, Sp), mt(Cx)), [[0.25]])))
        S = mm(madd(I2, mm(L, Cx), -1), Sp)
    print(f"  只测 x 坐标（C = [1 0]，秩 1）：40 步后 Σ = diag({S[0][0]:.4f}, {S[1][1]:.4f})——y 方向的方差每步 +0.04，无界增长")


# ====================================================================== 15. 网格法与粒子滤波
RING = 100           # 环形走廊长 100 个格（1D，补充例子）
DOORS = (12, 31, 70)


def door_lik(x, y):
    """门传感器：离门 ≤ 2 格时读到「门」的概率 0.8，否则 0.1。"""
    near = any(min(abs(x - d), RING - abs(x - d)) <= 2 for d in DOORS)
    p = 0.8 if near else 0.1
    return p if y == 1 else 1 - p


MOTION = {-1: 0.1, 0: 0.2, 1: 0.4, 2: 0.2, 3: 0.1}  # 命令「前进 1」时实际走的格数


def item15():
    header("15. 11.6.2 网格法与粒子滤波（补充：长 100 的环形走廊，三扇门）")
    rnd = random.Random(7)
    x = 5
    P = [1 / RING] * RING
    parts = [rnd.randrange(RING) for _ in range(2000)]
    w = [1 / len(parts)] * len(parts)
    errs = []
    for k in range(60):
        # 真实运动与观测
        x = (x + rnd.choices(list(MOTION), weights=list(MOTION.values()))[0]) % RING
        y = 1 if rnd.random() < door_lik(x, 1) else 0
        # 网格 (11.38)(11.39)
        Q = [0.0] * RING
        for i, p in enumerate(P):
            for d, q in MOTION.items():
                Q[(i + d) % RING] += p * q
        Q = [q * door_lik(i, y) for i, q in enumerate(Q)]
        s = sum(Q)
        P = [q / s for q in Q]
        # 粒子：1 按 P_k 选，2 按运动模型采样，3 权重 = p(y|x)
        idx = rnd.choices(range(len(parts)), weights=w, k=len(parts))
        parts = [(parts[i] + rnd.choices(list(MOTION), weights=list(MOTION.values()))[0]) % RING for i in idx]
        w = [door_lik(p, y) for p in parts]
        s = sum(w)
        w = [v / s for v in w]
        hist = [0.0] * RING
        for p, v in zip(parts, w):
            hist[p] += v
        errs.append(sum(abs(a - b) for a, b in zip(hist, P)) / 2)
    mode = max(range(RING), key=lambda i: P[i])
    print(f"  60 步后：真实 x = {x}，网格后验的众数 {mode}（P = {P[mode]:.3f}）")
    print(f"  2000 个粒子的直方图与网格后验的总变差距离：前 5 步 {[round(e, 3) for e in errs[:5]]}，最后 5 步 {[round(e, 3) for e in errs[-5:]]}")
    # 补充：多峰时用均值 + 方差（矩近似）会怎样
    P = [1 / RING] * RING
    for y in (1,):
        P = [p * door_lik(i, y) for i, p in enumerate(P)]
        s = sum(P)
        P = [p / s for p in P]
    peaks = sorted(range(RING), key=lambda i: -P[i])[:3]
    m = sum(i * p for i, p in enumerate(P))
    print(f"  第一次就看到门：后验有三个峰（{sorted(peaks)} 附近）；若只保留均值 {m:.1f}——正好落在两扇门之间，那里几乎不可能")


# ====================================================================== 16. 博弈树
def simplex_max(A, b, c):
    """max cᵀx  s.t. Ax ≤ b, x ≥ 0（b ≥ 0），精确分数，Bland 规则。返回 (值, x, 对偶 y)。"""
    m, n = len(A), len(A[0])
    T = [[F(v) for v in A[i]] + [F(1) if j == i else F(0) for j in range(m)] + [F(b[i])] for i in range(m)]
    z = [F(-v) for v in c] + [F(0)] * m + [F(0)]
    basis = [n + i for i in range(m)]
    while True:
        col = next((j for j in range(n + m) if z[j] < 0), None)
        if col is None:
            break
        rows = [(T[i][-1] / T[i][col], basis[i], i) for i in range(m) if T[i][col] > 0]
        _, _, r = min(rows)
        pv = T[r][col]
        T[r] = [v / pv for v in T[r]]
        for i in range(m):
            if i != r and T[i][col] != 0:
                f = T[i][col]
                T[i] = [a - f * bb for a, bb in zip(T[i], T[r])]
        f = z[col]
        z = [a - f * bb for a, bb in zip(z, T[r])]
        basis[r] = col
    x = [F(0)] * n
    for i, bi in enumerate(basis):
        if bi < n:
            x[bi] = T[i][-1]
    y = [z[n + i] for i in range(m)]
    return z[-1], x, y


def matrix_game(A):
    """代价矩阵（行 = P1 最小化，列 = P2 最大化）的随机化值与双方策略。"""
    lo = min(min(r) for r in A)
    Bm = [[F(v) - lo + 1 for v in r] for r in A]
    m, n = len(Bm), len(Bm[0])
    val, x, y = simplex_max([[Bm[i][j] for i in range(m)] for j in range(n)], [1] * n, [1] * m)
    V = 1 / val
    return V + lo - 1, [xi * V for xi in x], [yi * V for yi in y]


def det_values(A):
    return min(max(r) for r in A), max(min(A[i][j] for i in range(len(A))) for j in range(len(A[0])))


FIG1013 = [4, 2, 0, 0, 1, 0, 3, 2, 2, 3, 1, 2, 4, 1, 3, 2]
# 每层顶点用字符串表示走过的分支（L/R），每个信息模型给出各层的 I-state 划分
LEVELS = [[""], ["L", "R"], ["LL", "LR", "RL", "RR"], ["LLL", "LLR", "LRL", "LRR", "RLL", "RLR", "RRL", "RRR"]]
MODELS = {
    "(a) 交替行动": [[[v] for v in lv] for lv in LEVELS],
    "(b) 阶段式": [[[""]], [["L", "R"]], [["LL"], ["LR"], ["RL"], ["RR"]], [["LLL", "LLR"], ["LRL", "LRR"], ["RLL", "RLR"], ["RRL", "RRR"]]],
    "(c) 开环": [[[""]], [["L", "R"]], [["LL", "LR", "RL", "RR"]], [LEVELS[3]]],
    "(d) 别的模型": [[[""]], [["L", "R"]], [["LL", "LR", "RL"], ["RR"]], [["LLL", "LLR", "LRL"], ["LRR", "RLL"], ["RLR"], ["RRL", "RRR"]]],
}


def plans(model, levels):
    """某个玩家（只在 levels 这些层决策）的全部确定性计划：每个 I-state 选 L 或 R。"""
    isets = [I for lv in levels for I in model[lv]]
    for choice in itertools.product("LR", repeat=len(isets)):
        pl = {}
        for I, c in zip(isets, choice):
            for v in I:
                pl[v] = c
        yield pl


def play(p1, p2):
    v = ""
    for lv in range(4):
        v += (p1 if lv % 2 == 0 else p2)[v]
    i = int(v.replace("L", "0").replace("R", "1"), 2)
    return FIG1013[i]


def item16():
    header("16. 11.7.1 图 11.30：同一棵博弈树（图 10.13），四种信息模型")
    for name, model in MODELS.items():
        P1 = list(plans(model, [0, 2]))
        P2 = list(plans(model, [1, 3]))
        A = [[play(a, b) for b in P2] for a in P1]
        up, lo = det_values(A)
        if up == lo:
            val = F(up)
        else:
            val, w, z = matrix_game(A)
        print(f"  {name}：P1 {len(P1)} 个计划、P2 {len(P2)} 个计划；确定性上值 {up}、下值 {lo}；随机化值 {fr(val)}")
    # 例 11.26（图 11.31）
    A = [[3, 3, 5], [1, -1, 7], [0, -2, 4]]
    left = max(A[0])
    sub = A[1:]
    up, lo = det_values(sub)
    print(f"  例 11.26：左边 I-state 的值 max{A[0]} = {left}（P2 回应 3）；右边 2×3 矩阵 {sub} 上值 {up}、下值 {lo} → 鞍点值 {up}")
    assert left == 5 and up == lo == 4
    print(f"  整个博弈：P1 在 {left} 与 {up} 之间选小的 → 值 4（P1 选 3、P2 选 3）")


# ====================================================================== 17. 战舰
def item17():
    header("17. 11.7.2 例 11.27 战舰（补充：7×7 棋盘，舰长 4、3、2）")
    N = 7

    def place(L):
        out = []
        for r in range(N):
            for c in range(N - L + 1):
                out.append(frozenset((r, c + i) for i in range(L)))
        for c in range(N):
            for r in range(N - L + 1):
                out.append(frozenset((r + i, c) for i in range(L)))
        return out

    P4, P3, P2 = place(4), place(3), place(2)
    cnt = 0
    for a in P4:
        for b in P3:
            if a & b:
                continue
            ab = a | b
            for c in P2:
                if not (ab & c):
                    cnt += 1
    print(f"  单舰摆法：长 4 有 {len(P4)} 种、长 3 有 {len(P3)} 种、长 2 有 {len(P2)} 种；三舰互不重叠的状态共 {cnt} 个")
    print("  开局时的不确定 I-state 就是这些状态的全集；每一次「中 / 不中」都把它缩小（互动图里实时计数）")


if __name__ == "__main__":
    for f in (item1, item2, item3, item4, item5, item6, item7, item8, item9, item10, item11, item12, item13, item14, item15, item16, item17):
        f()
    print("\n全部核对通过。")
