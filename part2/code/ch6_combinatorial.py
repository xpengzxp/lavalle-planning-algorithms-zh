"""第 6 章参考实现：核对教程页面里出现的数值与原书笔误。

只用 Python 标准库。运行：

    python3 part2/code/ch6_combinatorial.py

会依次打印：
  1. 图 6.6 / 图 6.7：平面扫描时有序边表 L 在 14 个事件后的状态（按我们重建的几何）
  2. 图 6.3 / 6.4 / 6.18：垂直分解与柱形分解的单元个数、路线图规模、一次查询
  3. 6.3.2 节：三角剖分的三角形个数 = n + 2h − 2（贪心「最短对角线优先」）
  4. (6.1)(6.2)：左转谓词与双切线测试；与「两侧邻点同侧」的几何定义逐一对照
  5. 6.2.4 节：简化可见性图（只用反射顶点 + 双切线）与完整可见性图给出同样的最短路长度
  6. (6.7)：Nicomedes 蚌线——原书印的 (x²−y²) 与更正后的 (x²+y²) 谁真的为零
  7. 例 6.3：Φ(z) = ∃y∀x (x² − z x² − y < 0) 在 z = 1 处为真，所以 φ(z) 应是 z ≥ 1
  8. 例 6.5：一维分解、样本点；(6.21)(6.22) 用 ≥ 与用 ≤ 的对比
  9. 例 6.4 / 图 6.30：姜饼人脸的符号不变区域（两种符号约定）
 10. 例 6.6 / 图 6.35：姜饼人脸柱形代数分解的单元数 37 / 64 / 28；习题 9 三个圆
 11. 例 6.7 / 例 6.8：球面与环面上 Canny 方法的临界点
 12. 6.3.4 节：线段机器人的「雷达图」表示 (6.6)：图 6.22 与图 6.23 的场景
 13. 6.5.2 节：Davenport–Schinzel 序列 λ_s(n) 的小值（暴力枚举）与线段下包络
 14. 6.5.2 节：Ackermann 函数与反函数 α(n)
 15. 6.3.1 节：图 6.15 两个例子的单纯复形检查
"""
import itertools
import math
import random
import sys

EPS = 1e-9


# ====================================================================== 基础几何
def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def in_poly(p, P):
    c = False
    n = len(P)
    for i in range(n):
        a, b = P[i], P[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]):
            x = (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]
            if p[0] < x:
                c = not c
    return c


def seg_proper_cross(p, q, a, b):
    """线段 pq 与 ab 是否在内部真正相交（不算共享端点）。"""
    d1, d2 = cross(p, q, a), cross(p, q, b)
    d3, d4 = cross(a, b, p), cross(a, b, q)
    return (d1 > EPS and d2 < -EPS or d1 < -EPS and d2 > EPS) and (d3 > EPS and d4 < -EPS or d3 < -EPS and d4 > EPS)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


class Scene:
    """C_free = 外边界多边形内部，按奇偶规则减去障碍（障碍里还可以有洞）。"""

    def __init__(self, polys, names=None):
        self.polys = polys                     # 第 0 个是外边界
        self.edges = []                        # (a, b, name, poly, i)
        k = 0
        for pi, P in enumerate(polys):
            for i in range(len(P)):
                a, b = P[i], P[(i + 1) % len(P)]
                nm = names[k] if names else "e%d" % (k + 1)
                self.edges.append((a, b, nm, pi, i))
                k += 1
        self.verts = [(P[i], pi, i) for pi, P in enumerate(polys) for i in range(len(P))]

    def free(self, p):
        return sum(in_poly(p, P) for P in self.polys) % 2 == 1

    @staticmethod
    def y_at(e, x):
        (ax, ay), (bx, by) = e[0], e[1]
        return ay + (by - ay) * (x - ax) / (bx - ax)


# ====================================================================== 1. 图 6.6 的几何（按原图像素位置重建）
def fig66_scene():
    # 像素 → 单位：x' = (x − 106)/256, y' = (395 − y)/256；外边界是一个左右两边倾斜的梯形
    px = lambda x, y: ((x - 106) / 256, (395 - y) / 256)
    O0, O1, O12, O13 = px(106, 139), px(129, 395), px(411, 139), px(467, 395)
    L2, L3, L4, L6, L7 = px(152, 318), px(184, 183), px(207, 243), px(272, 160), px(289, 373)
    R5, R8, R9, R10, R11 = px(248, 262), px(317, 187), px(345, 232), px(362, 326), px(398, 193)
    outer = [O0, O1, O13, O12]                  # 边：a(O0O1) d(O1O13) c(O13O12) b(O12O0)
    left = [L2, L3, L6, L4, L7]                 # 边：e(L2L3) i(L3L6) h(L6L4) g(L4L7) f(L7L2)
    right = [R5, R9, R8, R11, R10]              # 边：n(R5R9) m(R9R8) l(R8R11) k(R11R10) j(R10R5)
    names = list("adcb") + list("eihgf") + list("nmlkj")
    return Scene([outer, left, right], names)


def decompose(S, cylindrical=False):
    """垂直分解（6.2.2）/ 柱形分解（6.3.2）。返回事件、各事件后的 L、单元与路线图。"""
    ev = sorted(S.verts, key=lambda v: v[0][0])
    xs = [v[0][0] for v in ev]
    assert all(xs[i + 1] - xs[i] > 1e-9 for i in range(len(xs) - 1)), "一般位置：x 坐标互不相同"
    slabs = []
    for k in range(len(xs) - 1):
        xm = (xs[k] + xs[k + 1]) / 2
        st = [e for e in S.edges if min(e[0][0], e[1][0]) < xm < max(e[0][0], e[1][0])]
        st.sort(key=lambda e: S.y_at(e, xm))
        pieces = []
        for lo, hi in zip(st, st[1:]):
            ym = (S.y_at(lo, xm) + S.y_at(hi, xm)) / 2
            if S.free((xm, ym)):
                pieces.append((lo[2], hi[2], lo, hi))
        slabs.append({"x0": xs[k], "x1": xs[k + 1], "L": [e[2] for e in st], "pieces": pieces})
    # 2-单元：垂直分解把相邻条带里 (下边, 上边) 相同的块合并成一个梯形
    cells, piece_cell = [], {}
    for k, sl in enumerate(slabs):
        for j, pc in enumerate(sl["pieces"]):
            key = (pc[0], pc[1])
            prev = None
            if not cylindrical and k > 0:
                for jj, pp in enumerate(slabs[k - 1]["pieces"]):
                    if (pp[0], pp[1]) == key:
                        prev = piece_cell[(k - 1, jj)]
            if prev is None:
                cells.append({"lo": pc[2], "hi": pc[3], "x0": sl["x0"], "x1": sl["x1"]})
                prev = len(cells) - 1
            else:
                cells[prev]["x1"] = sl["x1"]
            piece_cell[(k, j)] = prev
    # 1-单元：事件竖线上的自由区间（垂直分解只取与顶点 p 相邻的上、下两段）
    ones = []
    for k, (p, pi, i) in enumerate(ev):
        x = p[0]
        inc = {(pi, i), (pi, (i - 1) % len(S.polys[pi]))}
        st = [e for e in S.edges if (e[3], e[4]) not in inc and min(e[0][0], e[1][0]) < x < max(e[0][0], e[1][0])]
        ys = sorted([S.y_at(e, x) for e in st] + [p[1]])
        for y0, y1 in zip(ys, ys[1:]):
            if not S.free((x, (y0 + y1) / 2)):
                continue
            if not cylindrical and not (abs(y0 - p[1]) < 1e-12 or abs(y1 - p[1]) < 1e-12):
                continue
            ones.append({"x": x, "y0": y0, "y1": y1, "k": k})
    # 路线图：每个 2-单元、1-单元一个顶点；1-单元连到它左右两侧的 2-单元
    edges = []
    for oi, o in enumerate(ones):
        ym = (o["y0"] + o["y1"]) / 2
        for side in (o["k"] - 1, o["k"]):
            if side < 0 or side >= len(slabs):
                continue
            for j, pc in enumerate(slabs[side]["pieces"]):
                if S.y_at(pc[2], o["x"]) - 1e-12 <= ym <= S.y_at(pc[3], o["x"]) + 1e-12:
                    edges.append((piece_cell[(side, j)], oi))
    return {"events": ev, "slabs": slabs, "cells": cells, "ones": ones, "edges": edges, "piece_cell": piece_cell}


def cell_poly(S, c):
    return [(c["x0"], S.y_at(c["lo"], c["x0"])), (c["x1"], S.y_at(c["lo"], c["x1"])),
            (c["x1"], S.y_at(c["hi"], c["x1"])), (c["x0"], S.y_at(c["hi"], c["x0"]))]


def locate(S, D, q):
    for k, sl in enumerate(D["slabs"]):
        if sl["x0"] < q[0] < sl["x1"]:
            for j, pc in enumerate(sl["pieces"]):
                if S.y_at(pc[2], q[0]) < q[1] < S.y_at(pc[3], q[0]):
                    return D["piece_cell"][(k, j)]
    return None


def section1():
    print("=" * 72)
    print("1. 图 6.6 / 图 6.7：扫描线 L 在每个事件之后的状态")
    S = fig66_scene()
    D = decompose(S)
    book = ["ab", "db", "dfeb", "dfib", "dfghib", "dfgjnhib", "dfgjnb", "djnb", "djnmlb", "djlb", "dklb", "db", "dc", ""]
    ok = True
    for k in range(len(D["events"])):
        L = "".join(D["slabs"][k]["L"]) if k < len(D["slabs"]) else ""
        same = L == book[k]
        ok &= same
        print(f"  事件 {k:2d}  x = {D['events'][k][0][0]:.4f}   L = {{{', '.join(L)}}}   图 6.7: {{{', '.join(book[k])}}}  {'✓' if same else '✗'}")
    print("  与图 6.7 完全一致：", ok)
    return S, D


def section2(S, D):
    print("=" * 72)
    print("2. 垂直分解 / 柱形分解的单元个数与一次查询（图 6.3、6.4、6.5、6.18、6.19）")
    print(f"  垂直分解：2-单元（梯形/三角形）{len(D['cells'])} 个，1-单元（竖直线段）{len(D['ones'])} 个，0-单元 0 个")
    tri = sum(1 for c in D["cells"] if min(abs(S.y_at(c['hi'], c['x0']) - S.y_at(c['lo'], c['x0'])),
                                         abs(S.y_at(c['hi'], c['x1']) - S.y_at(c['lo'], c['x1']))) < 1e-9)
    print(f"    其中退化成三角形的 {tri} 个；路线图顶点 {len(D['cells']) + len(D['ones'])}、边 {len(D['edges'])}")
    Dc = decompose(S, cylindrical=True)
    print(f"  柱形分解（只数 C_free 里的）：2-单元 {len(Dc['cells'])} 个，1-单元 {len(Dc['ones'])} 个")
    # 图 6.19 的交替性质：事件 4 与 5 之间那条竖带
    sl = D["slabs"][4]
    xm = (sl["x0"] + sl["x1"]) / 2
    labels = []
    st = [e for e in S.edges if e[2] in sl["L"]]
    st.sort(key=lambda e: S.y_at(e, xm))
    ys = [S.y_at(e, xm) for e in st]
    for (y0, y1), (e0, e1) in zip(zip(ys, ys[1:]), zip(st, st[1:])):
        labels.append(f"{e0[2]}–{e1[2]}:{'free' if S.free((xm, (y0 + y1) / 2)) else 'obs'}")
    print("  事件 4 与 5 之间竖带自下而上：", ", ".join(labels), "（自由/障碍交替，图 6.19）")
    # 查询：BFS
    qI, qG = (0.37, 0.88), (1.17, 0.12)
    cI, cG = locate(S, D, qI), locate(S, D, qG)
    n2 = len(D["cells"])
    adj = {}
    for c, o in D["edges"]:
        adj.setdefault(c, []).append(n2 + o)
        adj.setdefault(n2 + o, []).append(c)
    prev = {cI: None}
    Q = [cI]
    for u in Q:
        for v in adj.get(u, []):
            if v not in prev:
                prev[v] = u
                Q.append(v)
    path = []
    u = cG
    while u is not None:
        path.append(u)
        u = prev[u]
    path.reverse()
    pts = [qI]
    for u in path:
        if u < n2:
            P = cell_poly(S, D["cells"][u])
            pts.append((sum(p[0] for p in P) / 4, sum(p[1] for p in P) / 4))
        else:
            o = D["ones"][u - n2]
            pts.append((o["x"], (o["y0"] + o["y1"]) / 2))
    pts.append(qG)
    # 每一小段都应在 C_free 里（用密集采样检查）
    good = all(S.free((a[0] + (b[0] - a[0]) * t / 50, a[1] + (b[1] - a[1]) * t / 50)) for a, b in zip(pts, pts[1:]) for t in range(1, 50))
    length = sum(dist(a, b) for a, b in zip(pts, pts[1:]))
    print(f"  查询 qI={qI} → qG={qG}：经过 {len(path)} 个单元（含 1-单元），折线 {len(pts) - 1} 段，长度 {length:.3f}，全程无碰撞：{good}")


# ====================================================================== 3. 三角剖分
def triangulate(S, order="short"):
    V = [v[0] for v in S.verts]
    E = set()
    idx = {}
    for j, (p, pi, i) in enumerate(S.verts):
        idx[(pi, i)] = j
    for (a, b, nm, pi, i) in S.edges:
        j1, j2 = idx[(pi, i)], idx[(pi, (i + 1) % len(S.polys[pi]))]
        E.add((min(j1, j2), max(j1, j2)))
    pairs = [(i, j) for i in range(len(V)) for j in range(i + 1, len(V)) if (i, j) not in E]
    if order == "short":
        pairs.sort(key=lambda ij: dist(V[ij[0]], V[ij[1]]))
    else:
        random.Random(1).shuffle(pairs)
    diag = []
    for i, j in pairs:
        p, q = V[i], V[j]
        mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        if not S.free(mid):
            continue
        if any(seg_proper_cross(p, q, V[a], V[b]) for a, b in list(E)):
            continue
        E.add((i, j))
        diag.append((i, j))
    # 三角形：三条边都在 E 里、内部自由、且内部没有其它顶点
    adj = {i: set() for i in range(len(V))}
    for a, b in E:
        adj[a].add(b)
        adj[b].add(a)
    tris = []
    for a in range(len(V)):
        for b in adj[a]:
            if b <= a:
                continue
            for c in adj[a] & adj[b]:
                if c <= b:
                    continue
                cen = ((V[a][0] + V[b][0] + V[c][0]) / 3, (V[a][1] + V[b][1] + V[c][1]) / 3)
                if not S.free(cen):
                    continue
                T = [V[a], V[b], V[c]]
                if any(in_poly(V[d], T) for d in range(len(V)) if d not in (a, b, c)):
                    continue
                tris.append((a, b, c))
    return diag, tris


def section3(S):
    print("=" * 72)
    print("3. 6.3.2 节：三角剖分（朴素的逐条加对角线，O(n³)）")
    n = len(S.verts)
    h = len(S.polys) - 1
    for order in ("short", "random"):
        diag, tris = triangulate(S, order)
        minang = 180
        V = [v[0] for v in S.verts]
        for t in tris:
            for k in range(3):
                a, b, c = V[t[k]], V[t[(k + 1) % 3]], V[t[(k + 2) % 3]]
                u, w = (b[0] - a[0], b[1] - a[1]), (c[0] - a[0], c[1] - a[1])
                ang = math.degrees(math.acos(max(-1, min(1, (u[0] * w[0] + u[1] * w[1]) / (math.hypot(*u) * math.hypot(*w))))))
                minang = min(minang, ang)
        print(f"  顺序={order:6s}：对角线 {len(diag)} 条（理论 n+3h−3 = {n + 3 * h - 3}），三角形 {len(tris)} 个（理论 n+2h−2 = {n + 2 * h - 2}），最小内角 {minang:.1f}°")


# ====================================================================== 4. 左转谓词与双切线测试
def f_l(p1, p2, p3):
    """(6.2)：det M(p1,p2,p3) > 0 ⇔ p3 在从 p1 出发、穿过 p2 的射线左侧。"""
    det = (p2[0] * p3[1] - p3[0] * p2[1]) - (p1[0] * p3[1] - p3[0] * p1[1]) + (p1[0] * p2[1] - p2[0] * p1[1])
    return det > 0


def bitangent_61(p1, p2, p3, p4, p5, p6):
    """(6.1) 为 FALSE 时 (p2, p5) 是双切线。"""
    return not ((f_l(p1, p2, p5) ^ f_l(p3, p2, p5)) or (f_l(p4, p5, p2) ^ f_l(p6, p5, p2)))


def same_side(a, c, v, w):
    """几何定义：v 的两个邻点 a、c 在直线 vw 的同一侧（直线在 v 处不刺入障碍）。"""
    return cross(v, w, a) * cross(v, w, c) > 0


def section4():
    print("=" * 72)
    print("4. (6.1)(6.2)：左转谓词与双切线测试")
    p1, p2, p3 = (0.0, 1.0), (0.6, 0.0), (1.2, 1.0)        # 图 6.14 左边的三角形，p2 在下
    p6, p4, p5 = (2.0, 0.0), (3.6, 0.0), (2.8, 1.3)        # 右边的三角形，p5 在上
    print("  f_l(p1,p2,p5) =", f_l(p1, p2, p5), " f_l(p3,p2,p5) =", f_l(p3, p2, p5))
    print("  f_l(p4,p5,p2) =", f_l(p4, p5, p2), " f_l(p6,p5,p2) =", f_l(p6, p5, p2))
    print("  图 6.14 的 (p2,p5) 是双切线：", bitangent_61(p1, p2, p3, p4, p5, p6))
    rng = random.Random(6)
    agree = 0
    N = 20000
    for _ in range(N):
        P = [(rng.random(), rng.random()) for _ in range(6)]
        a, v, c, d, w, e = P
        geo = same_side(a, c, v, w) and same_side(d, e, w, v)
        agree += geo == bitangent_61(a, v, c, d, w, e)
    print(f"  随机 {N} 组：(6.1) 与「两侧邻点同侧」的几何定义一致 {agree} 次")


# ====================================================================== 5. 可见性图
def reflex_vertices(S):
    out = []
    for j, (v, pi, i) in enumerate(S.verts):
        P = S.polys[pi]
        a, b = P[i - 1], P[(i + 1) % len(P)]
        u = (a[0] - v[0], a[1] - v[1])
        w = (b[0] - v[0], b[1] - v[1])
        lu, lw = math.hypot(*u), math.hypot(*w)
        d = (u[0] / lu + w[0] / lw, u[1] / lu + w[1] / lw)
        ld = math.hypot(*d)
        probe = (v[0] + 1e-5 * d[0] / ld, v[1] + 1e-5 * d[1] / ld)
        if not S.free(probe):           # 小于 π 的那一侧是障碍 ⇒ 自由空间一侧的内角大于 π
            out.append(j)
    return out


def visible(S, p, q):
    """p、q 在 cl(C_free) 里互相可见：线段不穿过 C_obs 的内部（沿障碍的边走也算可见）。"""
    for (a, b, nm, pi, i) in S.edges:
        if (a, b) in ((p, q), (q, p)):
            return True
    for (a, b, nm, pi, i) in S.edges:
        if seg_proper_cross(p, q, a, b):
            return False
    for t in (0.5, 0.25, 0.75):
        if not S.free((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)):
            return False
    return True


def neighbors_of(S, j):
    v, pi, i = S.verts[j]
    P = S.polys[pi]
    return P[i - 1], P[(i + 1) % len(P)]


def dijkstra(n, adj, s, t):
    import heapq
    D = [math.inf] * n
    D[s] = 0
    H = [(0, s)]
    while H:
        d, u = heapq.heappop(H)
        if d > D[u]:
            continue
        for v, w in adj[u]:
            if d + w < D[v]:
                D[v] = d + w
                heapq.heappush(H, (D[v], v))
    return D[t]


def sp_scene():
    outer = [(0, 0), (1.5, 0.05), (1.45, 1.0), (0.75, 0.92), (0.02, 1.02)]
    obs = [
        [(0.15, 0.35), (0.25, 0.2), (0.45, 0.25), (0.33, 0.45), (0.42, 0.65), (0.22, 0.7)],
        [(0.62, 0.15), (0.78, 0.18), (0.72, 0.7)],
        [(0.95, 0.45), (1.2, 0.3), (1.3, 0.55), (1.08, 0.75)],
        [(0.52, 0.78), (0.66, 0.84), (0.55, 0.88)],
    ]
    return Scene([outer] + obs)


def section5():
    print("=" * 72)
    print("5. 6.2.4 节：简化可见性图 vs 完整可见性图")
    S = sp_scene()
    V = [v[0] for v in S.verts]
    R = reflex_vertices(S)
    print(f"  顶点 {len(V)} 个，其中反射顶点（自由空间一侧内角 > π）{len(R)} 个")
    # 简化可见性图（最短路路线图）
    E = []
    for a, b in itertools.combinations(R, 2):
        if not visible(S, V[a], V[b]):
            continue
        va, vb = S.verts[a], S.verts[b]
        consecutive = va[1] == vb[1] and (abs(va[2] - vb[2]) == 1 or abs(va[2] - vb[2]) == len(S.polys[va[1]]) - 1)
        if consecutive:
            E.append((a, b, "edge"))
            continue
        a1, a2 = neighbors_of(S, a)
        b1, b2 = neighbors_of(S, b)
        if bitangent_61(a1, V[a], a2, b1, V[b], b2):
            E.append((a, b, "bitangent"))
    full = [(a, b) for a, b in itertools.combinations(range(len(V)), 2) if visible(S, V[a], V[b])]
    print(f"  最短路路线图：{len(E)} 条边（相邻反射顶点 {sum(e[2] == 'edge' for e in E)}，双切线 {sum(e[2] == 'bitangent' for e in E)}）；完整可见性图 {len(full)} 条边")
    rng = random.Random(3)
    worst = 0
    for trial in range(200):
        while True:
            qI = (rng.uniform(0, 1.5), rng.uniform(0, 1))
            qG = (rng.uniform(0, 1.5), rng.uniform(0, 1))
            if S.free(qI) and S.free(qG):
                break
        def solve(nodes, edges):
            pts = [V[i] for i in nodes] + [qI, qG]
            n = len(pts)
            adj = [[] for _ in range(n)]
            pos = {v: k for k, v in enumerate(nodes)}
            for a, b in edges:
                w = dist(V[a], V[b])
                adj[pos[a]].append((pos[b], w))
                adj[pos[b]].append((pos[a], w))
            for s in (n - 2, n - 1):
                for k in range(n - 2):
                    if visible(S, pts[s], pts[k]):
                        w = dist(pts[s], pts[k])
                        adj[s].append((k, w))
                        adj[k].append((s, w))
            if visible(S, qI, qG):
                adj[n - 2].append((n - 1, dist(qI, qG)))
            return dijkstra(n, adj, n - 2, n - 1)
        d1 = solve(R, [(a, b) for a, b, _ in E])
        d2 = solve(list(range(len(V))), full)
        worst = max(worst, abs(d1 - d2))
    print(f"  200 次随机查询：两者最短路长度的最大差 = {worst:.2e}")


# ====================================================================== 6. 蚌线
def section6():
    print("=" * 72)
    print("6. (6.7) Nicomedes 蚌线：v 在原点，e 是直线 y = −d，机器人长 L，同时接触 v 与 e")
    for d, L in ((0.4, 1.0), (0.7, 1.0)):
        mb = mf = 0
        for k in range(-200, 201):
            q = (k / 100 * L, -d)                  # e 上的接触点
            r = math.hypot(*q)
            if r > L or r < 1e-9:
                continue
            # 机器人的原点：从 q 出发穿过 v，再走到总长 L
            p = (q[0] * (1 - L / r), q[1] * (1 - L / r))
            x, y = p
            book = (x * x - y * y) * (y + d) ** 2 - y * y * L * L
            fixed = (x * x + y * y) * (y + d) ** 2 - y * y * L * L
            mb, mf = max(mb, abs(book)), max(mf, abs(fixed))
        print(f"  d={d}, L={L}：原书 (x²−y²)… 的最大 |残差| = {mb:.3e}；更正后 (x²+y²)… 的最大 |残差| = {mf:.1e}")
    print("  例：d=0.4、L=1 时环顶点 (0, L−d) = (0, 0.6) 两式都为零（x = 0 时 x² 项不起作用），所以只看对称轴上的点发现不了这个笔误")


# ====================================================================== 7. 例 6.3
def section7():
    print("=" * 72)
    print("7. 例 6.3：Φ(z) = ∃y ∀x (x² − z x² − y < 0)")
    for z in (0.5, 0.99, 1.0, 1.5):
        ok_y = None
        for y in [k / 10 for k in range(-20, 41)]:
            # ∀x：sup_x (1−z)x² − y < 0。z ≥ 1 时 sup 在 x = 0 处取到 −y；z < 1 时 sup = +∞
            sup = -y if z >= 1 else math.inf
            if sup < 0:
                ok_y = y
                break
        print(f"  z = {z:4}: Φ(z) = {ok_y is not None}" + (f"（取 y = {ok_y} 即可）" if ok_y is not None else "（任何 y 都有 x 使 (1−z)x² ≥ y）")
              + f"   原书 φ(z) = (z > 1) → {z > 1}，更正 φ(z) = (z ≥ 1) → {z >= 1}")


# ====================================================================== 8. 例 6.5
def section8():
    print("=" * 72)
    print("8. 例 6.5：f1 = x² − 2x, f2 = x² − 4x + 3 的一维分解")
    f1 = lambda x: x * x - 2 * x
    f2 = lambda x: x * x - 4 * x + 3
    roots = sorted({0.0, 2.0, 1.0, 3.0})
    cells, samples = [], []
    cells.append("(−∞, %g)" % roots[0]); samples.append(roots[0] - 1)
    for i, b in enumerate(roots):
        cells.append("[%g, %g]" % (b, b)); samples.append(b)
        if i + 1 < len(roots):
            cells.append("(%g, %g)" % (b, roots[i + 1])); samples.append((b + roots[i + 1]) / 2)
    cells.append("(%g, ∞)" % roots[-1]); samples.append(roots[-1] + 1)
    sg = lambda v: (v > 0) - (v < 0)
    for c, s in zip(cells, samples):
        print(f"  {c:9s} 样本 {s:4g}   sgn(f1, f2) = ({sg(f1(s)):+d}, {sg(f2(s)):+d})")
    for rel, op in (("≥（原书）", lambda v: v >= 0), ("≤（更正）", lambda v: v <= 0)):
        S = [c for c, s in zip(cells, samples) if op(f1(s)) and op(f2(s))]
        first = next((s for s in samples if op(f1(s)) and op(f2(s))), None)
        print(f"  φ 用 {rel}：集合 = {' ∪ '.join(S)}；按顺序试样本点，第一个使 Φ 为真的是 x = {first}")


# ====================================================================== 9–10. 姜饼人脸
GINGER = dict(r1=2.0, eyes=((-0.7, 0.6), (0.7, 0.6)), re=0.3, y4=-0.7, a=1.15, b=0.25)


def ginger_polys(negate):
    g = GINGER
    s = -1 if negate else 1
    return [
        lambda x, y: x * x + y * y - g["r1"] ** 2,
        lambda x, y: s * ((x - g["eyes"][0][0]) ** 2 + (y - g["eyes"][0][1]) ** 2 - g["re"] ** 2),
        lambda x, y: s * ((x - g["eyes"][1][0]) ** 2 + (y - g["eyes"][1][1]) ** 2 - g["re"] ** 2),
        lambda x, y: s * (x * x / g["a"] ** 2 + (y - g["y4"]) ** 2 / g["b"] ** 2 - 1),
    ]


def section9():
    print("=" * 72)
    print("9. 例 6.4 / 图 6.30：符号不变区域（只数二维区域；一维区域就是四条曲线本身）")
    for negate in (False, True):
        F = ginger_polys(negate)
        N = 260
        lab = {}
        seen = {}
        for i in range(N):
            for j in range(N):
                x, y = -2.6 + 5.2 * (i + .5) / N, -2.6 + 5.2 * (j + .5) / N
                key = tuple((f(x, y) > 0) - (f(x, y) < 0) for f in F)
                lab[(i, j)] = key
        comp = 0
        keys = []
        vis = set()
        for s in lab:
            if s in vis:
                continue
            comp += 1
            keys.append(lab[s])
            st = [s]
            vis.add(s)
            while st:
                u = st.pop()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    v = (u[0] + dx, u[1] + dy)
                    if v in lab and v not in vis and lab[v] == lab[u]:
                        vis.add(v)
                        st.append(v)
        conv = "例 3.1 (3.11)，f2–f4 取负" if negate else "图 6.30 的标注（f2–f4 不取负）"
        fmt = lambda k: "(" + ",".join("%d" % v for v in k) + ")"
        print(f"  {conv}：二维区域 {comp} 个：{', '.join(fmt(k) for k in keys)}")
    print("  两种约定都是 5 个二维区域 + 4 个一维区域 = 9 个；只是 f2、f3、f4 的符号整体相反")


def curve_branches(c, x):
    """c = (cx, cy, a, b)：轴对齐椭圆 ((x−cx)/a)² + ((y−cy)/b)² = 1 在竖线 x 上的交点。"""
    cx, cy, a, b = c
    u = (x - cx) / a
    if abs(u) > 1 + 1e-12:
        return []
    h = b * math.sqrt(max(0.0, 1 - u * u))
    return [cy - h, cy + h]


def cad_counts(curves):
    crit = []
    for c in curves:
        crit += [c[0] - c[2], c[0] + c[2]]
    # 两两交点的 x 坐标：扫描两条曲线各分支之差的变号，再二分
    for c1, c2 in itertools.combinations(curves, 2):
        lo, hi = max(c1[0] - c1[2], c2[0] - c2[2]), min(c1[0] + c1[2], c2[0] + c2[2])
        if lo >= hi:
            continue
        for s1 in (0, 1):
            for s2 in (0, 1):
                g = lambda x: curve_branches(c1, x)[s1] - curve_branches(c2, x)[s2]
                M = 4000
                xs = [lo + (hi - lo) * (k + 0.5) / M for k in range(M)]
                for x0, x1 in zip(xs, xs[1:]):
                    if g(x0) * g(x1) < 0:
                        a_, b_ = x0, x1
                        for _ in range(80):
                            m = (a_ + b_) / 2
                            if g(a_) * g(m) <= 0:
                                b_ = m
                            else:
                                a_ = m
                        crit.append((a_ + b_) / 2)
    crit = sorted(crit)
    beta = []
    for x in crit:
        if not beta or x - beta[-1] > 1e-7:
            beta.append(x)
    def ys_at(x):
        ys = sorted(y for c in curves for y in curve_branches(c, x))
        out = []
        for y in ys:
            if not out or y - out[-1] > 1e-5:
                out.append(y)
        return out
    two = one = zero = 0
    pts = [beta[0] - 1] + [(beta[i] + beta[i + 1]) / 2 for i in range(len(beta) - 1)] + [beta[-1] + 1]
    for x in pts:                       # 一维分解的 1-单元上方的柱体
        k = len(ys_at(x))
        two += k + 1
        one += k
    for x in beta:                      # 0-单元上方的竖线
        k = len(ys_at(x))
        one += k + 1
        zero += k
    return len(beta), two, one, zero


def section10():
    print("=" * 72)
    print("10. 例 6.6 / 图 6.35：柱形代数分解（向 x 轴投影）的单元个数")
    g = GINGER
    face = [(0, 0, g["r1"], g["r1"]), (g["eyes"][0][0], g["eyes"][0][1], g["re"], g["re"]),
            (g["eyes"][1][0], g["eyes"][1][1], g["re"], g["re"]), (0, g["y4"], g["a"], g["b"])]
    nb, two, one, zero = cad_counts(face)
    print(f"  姜饼人脸（参数 {GINGER}）：R 上 {nb} 个 0-单元；2-单元 {two}、1-单元 {one}、0-单元 {zero}（图 6.35：37、64、28）")
    face2 = [(0, 0, 2, 2), (-0.7, 0.6, 0.3, 0.3), (0.7, 0.6, 0.3, 0.3), (0, -0.7, 2.3, 0.25)]
    print("  把嘴拉宽到 a = 2.3（伸出脸外，与 f1 相交）：(2-单元, 1-单元, 0-单元) =", cad_counts(face2)[1:], "← 单元数随几何改变")
    circles = [(0, 0, 1, 1), (1.475, 0, 1, 1), (0.725, -1.2, 1, 1)]
    nb, two, one, zero = cad_counts(circles)
    print(f"  习题 9 / 图 6.43 的三个圆（按图中位置量出的一组参数）：R 上 {nb} 个 0-单元；2-单元 {two}、1-单元 {one}、0-单元 {zero}")


# ====================================================================== 11. Canny：球面与环面
def section11():
    print("=" * 72)
    print("11. 例 6.7 / 6.8：Canny 方法的临界点")
    # 球面：J = [∇f; ∇g]，在球面上找 J 不满秩的点
    pts = []
    N = 400
    for i in range(N):
        for j in range(N):
            th, ph = math.pi * (i + 0.5) / N, 2 * math.pi * j / N
            x = (math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th))
            pts.append(x)
    grad = lambda x: (2 * x[0], 2 * x[1], 2 * x[2])
    m1 = min(pts, key=lambda x: abs(grad(x)[1]) + abs(grad(x)[2]))   # g = x1：2×2 子式 −2x2、−2x3
    print(f"  (6.30) g = x1：子式 (−2x2, −2x3, 0) 同时为零 ⇔ x2 = x3 = 0 → 临界点 (±1, 0, 0)；网格上最接近的点 {tuple(round(v, 3) for v in m1)}")
    print("  (6.31) g = (x1, x2)：det = 2x3 = 0 ⇔ 赤道 x1² + x2² = 1（它在 S² 上，不是原书写的 S³）")
    r1, r2 = 2.0, 0.7
    f = lambda x1, x2, x3: (x1 * x1 + x2 * x2 + x3 * x3 - (r1 * r1 + r2 * r2)) ** 2 - 4 * r1 * r1 * (r2 * r2 - x3 * x3)
    def gradf(x1, x2, x3):
        S = x1 * x1 + x2 * x2 + x3 * x3 - (r1 * r1 + r2 * r2)
        return (4 * x1 * S, 4 * x2 * S, 4 * x3 * S + 8 * r1 * r1 * x3)
    cps = [(s * (r1 + t * r2), 0.0, 0.0) for s in (1, -1) for t in (1, -1)]
    for c in cps:
        gx = gradf(*c)
        print(f"  环面 (6.40) r1={r1}, r2={r2}：点 {c}  f = {f(*c):+.1e}，∇f = ({gx[0]:+.2f}, {gx[1]:+.2f}, {gx[2]:+.2f})"
              + ("  ← ∂f/∂x2 = ∂f/∂x3 = 0：g1 = x1 的临界点"))
    c = r1 - r2
    g = gradf(c, 0, 0)
    print(f"  切片 x1 = r1 − r2 = {c}：曲线 f({c}, x2, x3) = 0 在 (0,0) 处 ∂/∂x2 = {g[1]:.1f}、∂/∂x3 = {g[2]:.1f}——自交点（图 6.38 的「8」字）")
    w = 2 * math.sqrt(r1 * r2)
    print(f"  这条「8」字在 x3 = 0 处还经过 (x2 = ±{w:.4f})，正好落在外轮廓圆 x1² + x2² = (r1+r2)² 上："
          f"{c * c + w * w:.4f} vs {(r1 + r2) ** 2:.4f}")


# ====================================================================== 12. 线段机器人的雷达图
def seg_hits_poly(p, q, P):
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        d1, d2 = cross(p, q, a), cross(p, q, b)
        d3, d4 = cross(a, b, p), cross(a, b, q)
        if (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0):
            return True
    return in_poly(q, P) or in_poly(p, P)


def radar(origin, L, obstacles, feats, N=3600):
    """返回 (6.6) 的环形表示：逆时针列出自由的朝向区间 [f_i, f_{i+1}]。"""
    def free(th):
        q = (origin[0] + L * math.cos(th), origin[1] + L * math.sin(th))
        return not any(seg_hits_poly(origin, q, P) for P in obstacles)
    ths = [2 * math.pi * k / N for k in range(N)]
    fr = [free(t) for t in ths]
    if all(fr):
        return "()"
    if not any(fr):
        return "∅"
    def refine(t0, t1):                         # fr(t0) != fr(t1)
        f0 = free(t0)
        for _ in range(40):
            m = (t0 + t1) / 2
            if free(m) == f0:
                t0 = m
            else:
                t1 = m
        return (t0 + t1) / 2
    def feature(th):
        q = (origin[0] + L * math.cos(th), origin[1] + L * math.sin(th))
        best, nm = 1e9, None
        for name, kind, geo in feats:
            if kind == "e":                     # 端点 q 碰到边（Type VE）
                a, b = geo
                dx, dy = b[0] - a[0], b[1] - a[1]
                t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)))
                d = math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy)
                if 1e-6 < t < 1 - 1e-6 and d < best:
                    best, nm = d, name
            else:                               # 线段内部碰到顶点（Type EV）
                v = geo
                dx, dy = q[0] - origin[0], q[1] - origin[1]
                t = ((v[0] - origin[0]) * dx + (v[1] - origin[1]) * dy) / (dx * dx + dy * dy)
                d = math.hypot(origin[0] + t * dx - v[0], origin[1] + t * dy - v[1])
                if 0 < t < 1 and d < best:
                    best, nm = d, name
        return nm
    # 找自由区间的起止
    k0 = next(k for k in range(N) if not fr[k])
    ivs = []
    k = k0
    for step in range(N):
        a, b = (k0 + step) % N, (k0 + step + 1) % N
        if not fr[a] and fr[b]:
            start = refine(ths[a], ths[a] + 2 * math.pi / N)
        if fr[a] and not fr[b]:
            end = refine(ths[a], ths[a] + 2 * math.pi / N)
            ivs.append((start, end))
    # 逆时针排列；跨过 θ = 0 的那个区间排在最前（环形顺序，从哪个开始都一样）
    ivs.sort(key=lambda iv: (iv[0] % (2 * math.pi)) - (2 * math.pi if iv[0] % (2 * math.pi) > iv[1] % (2 * math.pi) else 0))
    return "(" + ", ".join(f"[{feature(s)}, {feature(e)}]" for s, e in ivs) + ")"


def fig622_scene():
    v1, A, B = (-0.1, 0.8), (-1.0, 1.2), (-1.1, 0.45)
    tri = [v1, A, B]
    bar = [(-2.2, -0.75), (2.6, -0.75), (2.6, -1.0), (-2.2, -1.0)]
    feats = [("e1", "e", (v1, A)), ("e4", "e", (A, B)), ("e2", "e", (B, v1)), ("v1", "v", v1), ("v2", "v", A), ("v3", "v", B),
             ("e3", "e", (bar[0], bar[1])), ("v4", "v", bar[0]), ("v5", "v", bar[1])]
    return [tri, bar], feats


def section12():
    print("=" * 72)
    print("12. 6.3.4 节：线段机器人的雷达图（L = 1）")
    obs, feats = fig622_scene()
    print("  图 6.22 的位置 (0, 0)：", radar((0.0, 0.0), 1.0, obs, feats), "  （原书：([e3, v1], [e2, e3])）")
    print("  图 6.23 的位置 (0.6, 0)：", radar((0.6, 0.0), 1.0, obs, feats), "  （原书：([e3, e3])）")
    print("  再移到 (1.3, 0.3)：", radar((1.3, 0.3), 1.0, obs, feats), "  （到 e3 与 v1 的距离都 > L：任何朝向都自由，记作 ()）")


# ====================================================================== 13. Davenport–Schinzel
def is_ds(seq, s):
    if any(a == b for a, b in zip(seq, seq[1:])):
        return False
    syms = set(seq)
    for a in syms:
        for b in syms:
            if a == b:
                continue
            # 最长交替子序列 a b a b …（贪心）
            want, length = a, 0
            for u in seq:
                if u == want:
                    length += 1
                    want = b if want == a else a
            if length >= s + 2:
                return False
    return True


def lam(n, s):
    best = [0]
    def alt_ok(seq):
        last = seq[-1]
        for b in set(seq):
            if b == last:
                continue
            for first in (b, last):          # 交替子序列可以从任一个符号开始
                want, length = first, 0
                for u in seq:
                    if u == want:
                        length += 1
                        want = last if want == b else b
                if length >= s + 2:
                    return False
        return True
    def dfs(seq, used):
        best[0] = max(best[0], len(seq))
        for c in range(min(used + 1, n)):
            if seq and seq[-1] == c:
                continue
            seq.append(c)
            if alt_ok(seq):
                dfs(seq, max(used, c + 1))
            seq.pop()
    dfs([], 0)
    return best[0]


def section13():
    print("=" * 72)
    print("13. 6.5.2 节：Davenport–Schinzel 序列")
    print("  (a b a b a) 是 (2,3) 序列吗？", is_ds(list("ababa"), 3), "；是 (2,4) 序列吗？", is_ds(list("ababa"), 4))
    slow = "--slow" in sys.argv
    for s, nmax in ((1, 6), (2, 6), (3, 6 if slow else 5), (4, 5 if slow else 4)):
        vals = [lam(n, s) for n in range(1, nmax + 1)]
        print(f"  λ_{s}(n), n = 1..{nmax}:", vals, {1: "= n", 2: "= 2n − 1", 3: "（已知值 1, 4, 8, 12, 17, 22）", 4: ""}[s])
    if not slow:
        print("  （加 --slow 参数会多算 λ_3(6) = 22 和 λ_4(5) = 22，各要十几秒）")
    # 线段的下包络
    rng = random.Random(5)
    worst = 0
    for trial in range(300):
        n = rng.randint(2, 6)
        segs = []
        for _ in range(n):
            x0 = rng.uniform(0, 1)
            x1 = rng.uniform(0, 1)
            x0, x1 = min(x0, x1), max(x0, x1)
            segs.append((x0, rng.uniform(0, 1), x1, rng.uniform(0, 1)))
        seq = []
        M = 4000
        for k in range(M):
            x = (k + 0.5) / M
            best, bi = math.inf, None
            for i, (a, ya, b, yb) in enumerate(segs):
                if a <= x <= b:
                    y = ya + (yb - ya) * (x - a) / (b - a)
                    if y < best:
                        best, bi = y, i
            if bi is not None and (not seq or seq[-1] != bi):
                seq.append(bi)
        assert is_ds(seq, 3), seq
        worst = max(worst, len(seq) - n)
    print("  300 组随机线段（2–6 条）：下包络序列全是 (n,3) DS 序列（每对线段最多交 1 次，部分定义 → s+2 = 3）")


# ====================================================================== 14. Ackermann
def section14():
    print("=" * 72)
    print("14. 6.5.2 节：Ackermann 函数 A(n) = A_n(n)，A_1(m) = 2m，A_{n+1}(m) = A_n 迭代 m 次（从 1 开始）")
    def A(n, m):
        if n == 1:
            return 2 * m
        v = 1
        for _ in range(m):
            v = A(n - 1, v)
        return v
    print("  A_2(m) = 2^m：", [A(2, m) for m in range(1, 6)])
    print("  A_3(m) = 2 的塔：", [A(3, m) for m in range(1, 5)])
    print("  A(1), A(2), A(3) =", A(1, 1), A(2, 2), A(3, 3), "；A(4) = A_3(65536)，是高 65536 的 2 的塔")


# ====================================================================== 15. 单纯复形
def tri_overlap_area(T1, T2):
    """两个三角形的交（凸多边形裁剪）的面积。"""
    def clip(P, a, b):
        out = []
        for i in range(len(P)):
            cur, prv = P[i], P[i - 1]
            ci, pi_ = cross(a, b, cur) >= -1e-12, cross(a, b, prv) >= -1e-12
            if ci:
                if not pi_:
                    out.append(inter(prv, cur, a, b))
                out.append(cur)
            elif pi_:
                out.append(inter(prv, cur, a, b))
        return out
    def inter(p, q, a, b):
        d1, d2 = cross(a, b, p), cross(a, b, q)
        t = d1 / (d1 - d2)
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    def ccw(T):
        return T if cross(*T) > 0 else [T[0], T[2], T[1]]
    P = ccw(T1)
    Q = ccw(T2)
    for i in range(3):
        if not P:
            break
        P = clip(P, Q[i], Q[(i + 1) % 3])
    if len(P) < 3:
        return 0.0
    return abs(sum(P[i - 1][0] * P[i][1] - P[i][0] * P[i - 1][1] for i in range(len(P)))) / 2


def check_complex(pts, tris):
    bad = []
    for (i, t1), (j, t2) in itertools.combinations(enumerate(tris), 2):
        T1, T2 = [pts[k] for k in t1], [pts[k] for k in t2]
        shared = set(t1) & set(t2)
        if tri_overlap_area(T1, T2) > 1e-9:
            bad.append((i, j, "内部重叠"))
            continue
        # 边与边真正相交，或一个三角形的顶点落在另一个的边内部（T 形接头）
        for a, b in ((t1[0], t1[1]), (t1[1], t1[2]), (t1[2], t1[0])):
            for c, d in ((t2[0], t2[1]), (t2[1], t2[2]), (t2[2], t2[0])):
                if seg_proper_cross(pts[a], pts[b], pts[c], pts[d]):
                    bad.append((i, j, "边相交"))
        for v in t1:
            if v in shared:
                continue
            for c, d in ((t2[0], t2[1]), (t2[1], t2[2]), (t2[2], t2[0])):
                p, q = pts[c], pts[d]
                if abs(cross(p, q, pts[v])) < 1e-9 and min(p[0], q[0]) - 1e-9 <= pts[v][0] <= max(p[0], q[0]) + 1e-9 \
                        and min(p[1], q[1]) - 1e-9 <= pts[v][1] <= max(p[1], q[1]) + 1e-9:
                    bad.append((i, j, "T 形接头"))
        for v in t2:
            if v in shared:
                continue
            for c, d in ((t1[0], t1[1]), (t1[1], t1[2]), (t1[2], t1[0])):
                p, q = pts[c], pts[d]
                if abs(cross(p, q, pts[v])) < 1e-9 and min(p[0], q[0]) - 1e-9 <= pts[v][0] <= max(p[0], q[0]) + 1e-9 \
                        and min(p[1], q[1]) - 1e-9 <= pts[v][1] <= max(p[1], q[1]) + 1e-9:
                    bad.append((i, j, "T 形接头"))
    return bad


def section15():
    print("=" * 72)
    print("15. 6.3.1 节：图 6.15 的两个例子")
    # 左：中间的三角形倒立，顶点落在左右两个三角形的边内部；上方一条线段搭在顶点上
    pts = [(0, 0), (2, 0), (1, 1.6), (1.5, 0.8), (3, 1.6), (2.5, 0), (3.5, 0.2), (4.6, 0.2), (3.4, 1.2)]
    tris = [(0, 1, 2), (3, 4, 5), (6, 7, 8)]
    print("  图 6.15 左（我们的仿制）：", check_complex(pts, tris))
    pts2 = [(0, 0.4), (1, 1.2), (1.6, 0), (2.3, 1.3), (3, 0.3), (3.6, 1.1), (2.0, 2.0)]
    tris2 = [(0, 1, 2), (1, 2, 3), (2, 3, 4), (3, 4, 5), (1, 3, 6), (3, 5, 6)]
    print("  图 6.15 右（我们的仿制）：", check_complex(pts2, tris2) or "满足两条条件，是单纯复形")


def main():
    S, D = section1()
    section2(S, D)
    section3(S)
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


if __name__ == "__main__":
    main()
