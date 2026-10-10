"""
Planning Algorithms (LaValle) · 第 2 章 离散规划 —— 参考实现

运行（在仓库根目录）：  python3 part1/code/ch2_discrete_planning.py
会依次复现书中的：
  - 图 2.9   固定长度 K=4 的反向值迭代 (Example 2.3)
  - 图 2.12  固定长度 K=4 的正向值迭代 (Example 2.4)
  - 图 2.14  不定长度（终止动作 u_T）的反向值迭代 (Example 2.5)
  - 图 2.15  不定长度的正向值迭代，x_I = b (Example 2.5)
  - 用 (2.19) 从 G* 中恢复最优计划
  - 网格上的 BFS / DFS / Dijkstra / A* / Best-first（图 2.4 的通用模板）

只用标准库。代码刻意贴近书中的记号：X, U(x), f(x,u), l(x,u), x_I, X_G。
"""

import heapq
import itertools
import math
from collections import deque

INF = math.inf

# ---------------------------------------------------------------------------
# 图 2.8：五状态例子。每条边 (x, x', cost) 都是一个动作 u，f(x,u)=x'，l(x,u)=cost
# ---------------------------------------------------------------------------
FIG_2_8 = {
    "states": ["a", "b", "c", "d", "e"],
    "edges": [("a", "a", 2), ("a", "b", 2), ("b", "c", 1), ("b", "d", 4),
              ("c", "d", 1), ("c", "a", 1), ("d", "c", 1), ("d", "e", 1)],
}

# 图 2.21：习题 1 的五状态问题（x_I = a, X_G = {e}）
FIG_2_21 = {
    "states": ["a", "b", "c", "d", "e"],
    "edges": [("a", "b", 2), ("b", "a", 1), ("b", "c", 4), ("c", "d", 3),
              ("d", "c", 1), ("c", "e", 7), ("d", "e", 1), ("d", "d", 1)],
}


def actions(problem, x):
    """U(x)：从 x 出发的所有 (x', l(x,u))。"""
    return [(x2, c) for (x1, x2, c) in problem["edges"] if x1 == x]


def back_actions(problem, x2):
    """U^{-1}(x')：所有能到达 x' 的 (x, l(x,u))，即把边反向。"""
    return [(x1, c) for (x1, y, c) in problem["edges"] if y == x2]


# ---------------------------------------------------------------------------
# 2.3.1 固定长度：反向值迭代  G*_k(x) = min_u { l(x,u) + G*_{k+1}(f(x,u)) }   (2.11)
# ---------------------------------------------------------------------------
def backward_value_iteration_fixed(problem, K, goal):
    X = problem["states"]
    F = K + 1
    G = {F: {x: (0 if x in goal else INF) for x in X}}         # (2.6) G*_F = l_F
    for k in range(K, 0, -1):
        G[k] = {x: min([c + G[k + 1][x2] for x2, c in actions(problem, x)], default=INF)
                for x in X}
    return G


# 正向值迭代  C*_k(x') = min_{u^{-1}} { C*_{k-1}(x) + l(x,u) }   (2.16)
def forward_value_iteration_fixed(problem, K, x_init):
    X = problem["states"]
    C = {1: {x: (0 if x == x_init else INF) for x in X}}       # (2.13) C*_1 = l_I
    for k in range(2, K + 2):
        C[k] = {x: min([C[k - 1][x1] + c for x1, c in back_actions(problem, x)], default=INF)
                for x in X}
    return C


# ---------------------------------------------------------------------------
# 2.3.2 不定长度：每个 U(x) 都加入终止动作 u_T（停在原地、代价 0），迭代到平稳
# ---------------------------------------------------------------------------
def backward_value_iteration(problem, goal):
    X = problem["states"]
    G = {x: (0 if x in goal else INF) for x in X}
    history = [dict(G)]
    while True:
        G_new = {x: min([G[x]] + [c + G[x2] for x2, c in actions(problem, x)]) for x in X}
        history.append(G_new)
        if G_new == G:                       # 平稳 (stationary) ⇒ G* 满足 (2.18)
            return G_new, history
        G = G_new


def forward_value_iteration(problem, x_init):
    X = problem["states"]
    C = {x: (0 if x == x_init else INF) for x in X}
    history = [dict(C)]
    while True:
        C_new = {x: min([C[x]] + [C[x1] + c for x1, c in back_actions(problem, x)]) for x in X}
        history.append(C_new)
        if C_new == C:
            return C_new, history
        C = C_new


def extract_plan(problem, G_star, x, goal):
    """(2.19)：u* = argmin_u { l(x,u) + G*(f(x,u)) }，沿着 G* "下坡" 走到目标。"""
    path = [x]
    while x not in goal:
        if G_star[x] == INF:
            return None
        x = min(actions(problem, x), key=lambda a: a[1] + G_star[a[0]])[0]
        path.append(x)
    return path


# ---------------------------------------------------------------------------
# 2.2 通用前向搜索（图 2.4）：不同算法只是 Q 的排序方式不同
# ---------------------------------------------------------------------------
def grid_problem(width, height, walls=(), mud=(), mud_cost=5):
    walls, mud = set(walls), set(mud)
    U = [(0, 1), (0, -1), (1, 0), (-1, 0)]          # 与 Example 2.1 中的顺序一致

    def succ(x):
        for u in U:
            x2 = (x[0] + u[0], x[1] + u[1])
            if 0 <= x2[0] < width and 0 <= x2[1] < height and x2 not in walls:
                yield u, x2, (mud_cost if x2 in mud else 1)   # l(x,u) = 进入 x2 的代价
    return succ


def forward_search(succ, x_init, goal, method="bfs", h=lambda x: 0):
    """返回 (plan 的状态序列, 总代价, 扩展的状态数)。"""
    counter = itertools.count()
    C = {x_init: 0}
    parent = {x_init: None}

    def key(x):
        return {"bfs": next(counter),             # FIFO
                "dfs": -next(counter),            # LIFO
                "dijkstra": C[x],                 # cost-to-come
                "astar": C[x] + h(x),             # C + Ĝ*
                "best": h(x)}[method]             # 只看 Ĝ*（贪心）

    Q = [(key(x_init), next(counter), x_init)]
    dead = set()
    expanded = 0
    while Q:
        _, _, x = heapq.heappop(Q)                # Q.GetFirst()
        if x in dead:
            continue                              # 被 decrease-key 替换掉的旧条目
        dead.add(x)
        expanded += 1
        if x == goal:                             # x ∈ X_G → SUCCESS
            path = []
            while x is not None:
                path.append(x)
                x = parent[x]
            return path[::-1], C[goal], expanded
        for _, x2, cost in succ(x):
            new_c = C[x] + cost
            if x2 not in C:                       # x' 未访问：标记并插入
                C[x2], parent[x2] = new_c, x
                heapq.heappush(Q, (key(x2), next(counter), x2))
            elif method in ("dijkstra", "astar") and x2 not in dead and new_c < C[x2]:
                C[x2], parent[x2] = new_c, x      # 第 12 行：Resolve duplicate x'
                heapq.heappush(Q, (key(x2), next(counter), x2))
    return None, INF, expanded                    # FAILURE


def fmt(v):
    return "∞" if v == INF else str(v)


def print_table(title, rows, states):
    print(f"\n{title}")
    print("        " + "  ".join(f"{s:>3}" for s in states))
    for name, row in rows:
        print(f"{name:>7} " + "  ".join(f"{fmt(row[s]):>3}" for s in states))


if __name__ == "__main__":
    S = FIG_2_8["states"]

    G = backward_value_iteration_fixed(FIG_2_8, K=4, goal={"d"})
    print_table("图 2.9  反向值迭代 (K=4, X_G={d})", [(f"G*_{k}", G[k]) for k in range(5, 0, -1)], S)

    C = forward_value_iteration_fixed(FIG_2_8, K=4, x_init="a")
    print_table("图 2.12 正向值迭代 (K=4, x_I=a)", [(f"C*_{k}", C[k]) for k in range(1, 6)], S)

    G_star, hist = backward_value_iteration(FIG_2_8, goal={"d"})
    print_table("图 2.14 不定长度反向值迭代 (X_G={d})",
                [(f"G*_{-i}", r) for i, r in enumerate(hist)] + [("G*", G_star)], S)
    print("由 (2.19) 从 a 出发的最优计划:", " → ".join(extract_plan(FIG_2_8, G_star, "a", {"d"})))

    C_star, hist = forward_value_iteration(FIG_2_8, x_init="b")
    print_table("图 2.15 不定长度正向值迭代 (x_I=b)",
                [(f"C*_{i+1}", r) for i, r in enumerate(hist)] + [("C*", C_star)], S)

    # 网格搜索对比：i=7 这一列从 j=2 往上全是泥地（进入代价 5），j=0,1 是好路
    # 直穿泥地：12 步、代价 16；从下面绕：14 步、代价 14
    W, H = 15, 9
    mud = [(7, j) for j in range(2, H)]
    succ = grid_problem(W, H, walls=[], mud=mud)
    start, goal = (1, 2), (13, 2)
    manhattan = lambda x: abs(x[0] - goal[0]) + abs(x[1] - goal[1])
    print("\n网格搜索（BFS 只数步数，会直穿泥地；Dijkstra / A* 看代价，会绕路）")
    for m in ["bfs", "dfs", "dijkstra", "astar", "best"]:
        path, cost, n = forward_search(succ, start, goal, m, manhattan)
        print(f"  {m:>8}: 步数={len(path)-1:>3}  代价={cost:>3}  扩展状态数={n}")
