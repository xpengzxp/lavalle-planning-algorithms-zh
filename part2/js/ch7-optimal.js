/* 7.7 节：最优运动规划——三种动作模型（例 7.4–7.6、图 7.40、7.41）、加权区域（例 7.7）、
   多机器人的 Pareto 最优（式 7.28、7.29，图 7.42） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // =================================================================
  // 组件 1：Manhattan / Independent-Joint / Euclidean 三种动作模型
  // =================================================================
  const MM = {
    obs: [C.rect(0.18, 0.2, 0.42, 0.62), [{ x: 0.55, y: 0.3 }, { x: 0.86, y: 0.42 }, { x: 0.62, y: 0.78 }], C.rect(0.66, 0.0, 0.74, 0.18)],
  };
  const inObs = (p) => MM.obs.some((P) => C.inPoly(p, P));
  // 线段是否完全在自由空间里（允许贴着障碍边走：只拒绝穿进内部的线段）
  function segOK(a, b) {
    for (const P of MM.obs) {
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const t = C.segHitT(a, b, P[j], P[i]);
        if (t > 1e-7 && t < 1 - 1e-7) { const m = C.lerp(a, b, Math.min(1, t + 1e-4)), n = C.lerp(a, b, Math.max(0, t - 1e-4)); if (C.inPoly(m, P) || C.inPoly(n, P)) return false; }
      }
      for (const u of [0.25, 0.5, 0.75]) if (C.inPoly(C.lerp(a, b, u), P)) return false;
    }
    return true;
  }
  // 在 ε = 1/N 的网格上做 Dijkstra；nb = 4（Manhattan）或 8（independent-joint）；cost = "stage"（每阶段代价 1）或 "len"（欧氏长度）
  function gridOpt(N, qI, qG, nb, cost, tie) {
    const M = N + 1, id = (i, j) => j * M + i, P = (k) => ({ x: (k % M) / N, y: Math.floor(k / M) / N });
    const s = id(Math.round(qI.x * N), Math.round(qI.y * N)), g = id(Math.round(qG.x * N), Math.round(qG.y * N));
    const free = new Uint8Array(M * M); for (let k = 0; k < M * M; k++) free[k] = inObs(P(k)) ? 0 : 1;
    const D = new Float64Array(M * M).fill(Infinity), par = new Int32Array(M * M).fill(-1), cnt = new Float64Array(M * M), H = new C.Heap(), done = new Uint8Array(M * M);
    const moves = nb === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    D[s] = 0; cnt[s] = 1; H.push(s, 0);
    while (H.size) {
      const u = H.pop(); if (done[u]) continue; done[u] = 1;
      const i = u % M, j = Math.floor(u / M);
      for (const [a, b] of moves) {
        const x = i + a, y = j + b; if (x < 0 || y < 0 || x > N || y > N) continue;
        const v = id(x, y); if (!free[v] || done[v]) continue;
        if (!segOK(P(u), P(v))) continue;
        // tie > 0 时加一个很小的「离 qI–qG 连线远近」的惩罚，只用来在并列最优的路径里挑一条好看的
        const w = (cost === "len" ? Math.hypot(a, b) : 1) + (tie ? tie * C.segPointDist(P(v), qI, qG).d : 0), nd = D[u] + w;
        if (nd < D[v] - 1e-9) { D[v] = nd; par[v] = u; cnt[v] = cnt[u]; H.push(v, nd); }
        else if (Math.abs(nd - D[v]) < 1e-9) cnt[v] += cnt[u];   // 数一数有多少条最优路径
      }
    }
    if (D[g] === Infinity) return null;
    const path = []; for (let c = g; c >= 0; c = par[c]) path.push(P(c));
    path.reverse();
    return { path, K: path.length - 1, len: C.polyLen(path), count: cnt[g] };
  }
  // 欧氏模型在 ε → 0 时的极限：可见性图上的最短路（6.2.4 节）
  function euclidShortest(qI, qG) {
    const V = [qI, qG, ...MM.obs.flat().map((p) => {
      // 稍微往障碍外推一点，避免数值上「擦进」障碍
      const P = MM.obs.find((Q) => Q.includes(p)), c = P.reduce((s, q) => ({ x: s.x + q.x / P.length, y: s.y + q.y / P.length }), { x: 0, y: 0 }), d = C.dist(p, c) || 1;
      return { x: p.x + (p.x - c.x) / d * 1e-6, y: p.y + (p.y - c.y) / d * 1e-6 };
    }).filter((p) => p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1)];
    const n = V.length, D = Array(n).fill(Infinity), par = Array(n).fill(-1), done = Array(n).fill(false); D[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1; for (let k = 0; k < n; k++) if (!done[k] && (u < 0 || D[k] < D[u])) u = k;
      if (u < 0 || D[u] === Infinity) break; done[u] = true;
      for (let v = 0; v < n; v++) if (!done[v] && segOK(V[u], V[v])) { const nd = D[u] + C.dist(V[u], V[v]); if (nd < D[v]) { D[v] = nd; par[v] = u; } }
    }
    if (D[1] === Infinity) return null;
    const path = []; for (let c = 1; c >= 0; c = par[c]) path.push(V[c]);
    return { path: path.reverse(), len: D[1] };
  }

  class MotionModels {
    constructor(root) {
      this.N = 24; this.qI = { x: 0.04, y: 0.08 }; this.qG = { x: 0.96, y: 0.92 }; this.ijCost = "stage"; this.show = { m: true, ij: true, eu: true };
      const body = C.frame(root, "三种动作模型下的最优路径", "例 7.4–7.6：每一步 q' = q + εu；拖动 qI、qG。三条路径同时画出来对比");
      const near = (p) => (C.dist(p, this.qI) < 0.04 ? "qI" : C.dist(p, this.qG) < 0.04 ? "qG" : null);
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 440, onDraw: (ctx, st, col) => this.draw(ctx, st, col), onDown: near,
        onMove: (p, d) => { const q = { x: C.clamp(Math.round(p.x * this.N) / this.N, 0, 1), y: C.clamp(Math.round(p.y * this.N) / this.N, 0, 1) }; if (!inObs(q)) { this[d] = q; this.updateSoon(); } }, cursor: (p) => (near(p) ? "grab" : null) });
      this.sN = C.slider("1/ε", 6, 48, 2, this.N, (v) => { this.N = v; this.qI = this.snap(this.qI); this.qG = this.snap(this.qG); this.updateSoon(); });
      this.segC = C.seg([["stage", "independent-joint：每阶段代价 1"], ["len", "按欧氏长度计（补充）"]], this.ijCost, (k) => { this.ijCost = k; this.update(); });
      this.tbl = h("div");
      body.append(h("div", { class: "controls" }, this.sN, this.segC), h("div", { class: "split" }, this.st.wrap, this.tbl),
        C.legend([[C.cv("accent"), "Manhattan（4 个方向）"], [C.cv("warn"), "Independent-joint（3ⁿ − 1 = 8 个方向）"], [C.cv("path"), "Euclidean 的极限：真正的最短路"]]));
      this.update();
    }
    snap(q) { return { x: Math.round(q.x * this.N) / this.N, y: Math.round(q.y * this.N) / this.N }; }
    updateSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.update(); }); }
    update() {
      this.qI = this.snap(this.qI); this.qG = this.snap(this.qG);
      // 先用纯代价数出最优路径的条数，再加一个微小的平局惩罚挑一条贴近直线的来画
      const cm = gridOpt(this.N, this.qI, this.qG, 4, "stage"), cij = gridOpt(this.N, this.qI, this.qG, 8, this.ijCost);
      this.rm = cm && { ...gridOpt(this.N, this.qI, this.qG, 4, "stage", 1e-4), count: cm.count, K: cm.K };
      this.rij = cij && { ...gridOpt(this.N, this.qI, this.qG, 8, this.ijCost, 1e-4), count: cij.count, K: cij.K };
      this.re = euclidShortest(this.qI, this.qG);
      const f = (r, k) => (r ? r[k] : null), eps = 1 / this.N;
      const big = (x) => (x > 1e6 ? x.toExponential(2) : Math.round(x).toLocaleString());
      this.tbl.innerHTML = "";
      this.tbl.append(h("div", { class: "table-wrap", style: "margin:0" }, h("table", { class: "data" },
        h("tr", null, h("th", null, "模型"), h("th", { class: "c" }, "阶段数 K"), h("th", { class: "c" }, "路径长度"), h("th", { class: "c" }, "最优路径条数")),
        h("tr", null, h("td", null, "Manhattan"), h("td", { class: "c" }, f(this.rm, "K") ?? "—"), h("td", { class: "c" }, this.rm ? this.rm.len.toFixed(3) : "—"), h("td", { class: "c" }, this.rm ? big(this.rm.count) : "—")),
        h("tr", null, h("td", null, "Independent-joint"), h("td", { class: "c" }, f(this.rij, "K") ?? "—"), h("td", { class: "c" }, this.rij ? this.rij.len.toFixed(3) : "—"), h("td", { class: "c" }, this.rij ? big(this.rij.count) : "—")),
        h("tr", null, h("td", null, "Euclidean（ε → 0）"), h("td", { class: "c" }, "—"), h("td", { class: "c" }, this.re ? this.re.len.toFixed(3) : "—"), h("td", { class: "c" }, "1")))),
        h("p", { class: "small", style: "margin:.6em 0 0" }, `ε = ${eps.toFixed(3)}。Manhattan 下所有沿网格方向的单调路径一样长（图 7.40），所以最优路径多得数不过来；它们的长度都比真正的最短路长。` +
          (this.ijCost === "stage" ? "independent-joint 若按书上那样每阶段代价都是 1，斜走一步和直走一步代价相同（相当于 L∞ 度量），最优路径同样不唯一。" : "（补充）若斜走一步按 √2 计，independent-joint 更接近欧氏最短路，但仍被限制在 8 个方向上。") +
          " 欧氏模型的可达点不在网格上，没法直接用网格搜索，要靠 8.5.2 节在连续空间上近似代价到达函数。"));
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const N = this.N;
      for (let i = 0; i <= N; i++) { st.line({ x: i / N, y: 0 }, { x: i / N, y: 1 }, C.alpha(col.muted, 0.12), 1); st.line({ x: 0, y: i / N }, { x: 1, y: i / N }, C.alpha(col.muted, 0.12), 1); }
      for (const P of MM.obs) st.poly(P, C.alpha(col.wall, 0.85), col.wall);
      if (this.re) st.polyline(this.re.path, col.path, 3.2);
      if (this.rij) st.polyline(this.rij.path, C.alpha(col.warn, 0.95), 2.2);
      if (this.rm) st.polyline(this.rm.path, C.alpha(col.accent, 0.95), 2.2);
      st.dot(this.qI, 6, col.start, col.surface, 2); st.text("qI", this.qI, col.start, { dx: 10, dy: -10, weight: 650 });
      st.dot(this.qG, 6, col.goal, col.surface, 2); st.text("qG", this.qG, col.goal, { dx: -10, dy: 12, weight: 650 });
    }
  }

  // =================================================================
  // 组件 2：例 7.6 的一个具体问题——ε = 1 时能离 (π, π) 多近？
  // =================================================================
  // k 个单位向量之和：k = 1 时是单位圆；k ≥ 2 时是半径 k 的整个闭圆盘（补充）。返回一组恰好到达目标的单位向量
  function unitSteps(target, k) {
    const d = Math.hypot(target.x, target.y), th = Math.atan2(target.y, target.x);
    if (k === 1) return Math.abs(d - 1) < 1e-12 ? [th] : null;
    if (d > k + 1e-12) return null;
    // 先直走 k − 2 步，剩下的距离 r ∈ [0, 2] 用两步「人字形」补上
    const rem = d - (k - 2);
    if (rem >= 0) { const a = Math.acos(C.clamp(rem / 2, -1, 1)); return [...Array(k - 2).fill(th), th + a, th - a]; }
    // 目标太近：前 k − 2 步来回抵消（偶数）或折返，再用两步补
    const out = []; let pos = { x: 0, y: 0 };
    for (let i = 0; i < k - 2; i++) { const a = i % 2 ? th + Math.PI : th; out.push(a); pos = { x: pos.x + Math.cos(a), y: pos.y + Math.sin(a) }; }
    const v = { x: target.x - pos.x, y: target.y - pos.y }, r = Math.hypot(v.x, v.y), t2 = Math.atan2(v.y, v.x), a = Math.acos(C.clamp(r / 2, -1, 1));
    return [...out, t2 + a, t2 - a];
  }
  class EuclidReach {
    constructor(root) {
      this.k = 5; this.target = { x: Math.PI, y: Math.PI };
      const body = C.frame(root, "例 7.6：用单位步长能到 (π, π) 吗？", "U(q) = S¹ ∪ {u_T}，ε = 1；拖动目标点");
      this.st = new C.Stage({ view: [-1.5, 6.6, -1.5, 5.6], maxW: 400, aspect: 0.88, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.target) < 0.3 ? "t" : null), onMove: (p) => { this.target = { x: p.x, y: p.y }; this.update(); }, cursor: (p) => (C.dist(p, this.target) < 0.3 ? "grab" : null) });
      this.sK = C.slider("阶段数 k", 1, 7, 1, this.k, (v) => { this.k = v; this.update(); });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.sK), h("div", { class: "split" }, this.st.wrap, this.out));
      this.update();
    }
    update() {
      const d = Math.hypot(this.target.x, this.target.y), kmin = d <= 1e-12 ? 2 : Math.max(Math.abs(d - 1) < 1e-9 ? 1 : 2, Math.ceil(d - 1e-12));
      this.steps = unitSteps(this.target, this.k);
      this.out.innerHTML = `目标离原点 ${d.toFixed(4)}。k = ${this.k} 步${this.steps ? '<span class="yes">可以恰好到达</span>' : '<span class="no">到不了</span>'}。<br>` +
        `<b>补充</b>：两个单位向量之和的长度可以是 [0, 2] 里的任何数、指向任何方向，所以 k ≥ 2 步的可达集合是半径 k 的整个闭圆盘。` +
        `于是 (π, π)（距离 π√2 ≈ 4.443）用 ${kmin} 步就能<b>恰好</b>到达——书里说「可达点在 ℝⁿ 中稠密、可以任意接近」，这是对的，只是说得保守了。` +
        "真正的麻烦是：可达点不在任何固定的网格上，所以没法像例 7.4、7.5 那样直接做网格搜索。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const done = st.clip();
      for (let r = 1; r <= 7; r++) { ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), r * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = C.alpha(col.muted, r === this.k ? 0 : 0.25); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), this.k * st.scale, 0, 2 * Math.PI);
      if (this.k >= 2) { ctx.fillStyle = C.alpha(col.ok, 0.14); ctx.fill(); }
      ctx.strokeStyle = col.ok; ctx.lineWidth = 2; ctx.stroke();
      st.line({ x: -1.5, y: 0 }, { x: 6.6, y: 0 }, C.alpha(col.muted, 0.4), 1); st.line({ x: 0, y: -1.5 }, { x: 0, y: 5.6 }, C.alpha(col.muted, 0.4), 1);
      if (this.steps) { let p = { x: 0, y: 0 }; for (const a of this.steps) { const q = { x: p.x + Math.cos(a), y: p.y + Math.sin(a) }; st.arrow(p, q, col.accent, 2, 7); st.dot(q, 2.5, col.accent); p = q; } }
      done();
      st.dot({ x: 0, y: 0 }, 4, col.start); st.dot(this.target, 6, col.goal, col.surface, 2);
      st.text(`(${this.target.x.toFixed(2)}, ${this.target.y.toFixed(2)})`, this.target, col.goal, { dx: 8, dy: -10, align: "left", size: 11 });
    }
  }

  // =================================================================
  // 组件 3：例 7.7 加权区域——代价到达函数与沿它下降的反馈计划
  // =================================================================
  const TERRAIN = [[1, "路 ×1", "surface"], [2, "草地 ×2", "okSoft"], [5, "泥地 ×5", "mud"], [Infinity, "障碍", "wall"]];
  function terrainPreset(N) {
    const T = new Float64Array(N * N).fill(2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N, y = (j + 0.5) / N;
      if (Math.abs(x - 0.52 - 0.12 * Math.sin(6 * y)) < 0.09) T[j * N + i] = 5;                 // 一条泥河
      if (Math.abs(y - 0.25) < 0.035 && x > 0.3 && x < 0.75) T[j * N + i] = 1;                 // 一座桥 / 一条路
      if (Math.abs(x - 0.12) < 0.03 && y > 0.25) T[j * N + i] = 1;
      if (x > 0.72 && x < 0.86 && y > 0.55 && y < 0.7) T[j * N + i] = Infinity;
    }
    return T;
  }
  // 从目标出发做 Dijkstra：G(x) = 从 x 到目标的最小代价（代价 = 步长 × 两端地形系数的平均）
  function costToGo(T, N, goal) {
    const G = new Float64Array(N * N).fill(Infinity), H = new C.Heap(), done = new Uint8Array(N * N);
    G[goal] = 0; H.push(goal, 0);
    const mv = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (H.size) {
      const u = H.pop(); if (done[u]) continue; done[u] = 1;
      const i = u % N, j = Math.floor(u / N);
      for (const [a, b] of mv) {
        const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const v = y * N + x; if (done[v] || T[v] === Infinity) continue;
        if (a && b && (T[j * N + x] === Infinity || T[y * N + i] === Infinity)) continue;   // 不从障碍的对角缝里钻
        const w = Math.hypot(a, b) * (T[u] + T[v]) / 2 / N, nd = G[u] + w;
        if (nd < G[v]) { G[v] = nd; H.push(v, nd); }
      }
    }
    return G;
  }
  function descend(G, N, s) {
    const P = [s]; let u = s;
    for (let k = 0; k < 4 * N && G[u] > 0; k++) {
      const i = u % N, j = Math.floor(u / N); let best = u;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= N || y >= N) continue; const v = y * N + x; if (G[v] < G[best]) best = v; }
      if (best === u) break; u = best; P.push(u);
    }
    return P;
  }

  class WeightedRegion {
    constructor(root) {
      this.N = 40; this.T = terrainPreset(this.N); this.brush = 5; this.goal = 33 * this.N + 34; this.start = 4 * this.N + 3; this.mode = "start";
      const body = C.frame(root, "加权区域：「灰度」障碍", "例 7.7：每块地形有一个通过难度系数。左键在图上「刷」地形；或选「设起点」再点一下");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 460, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.act(p); return "drag"; }, onMove: (p) => { if (this.mode === "paint") this.act(p); }, cursor: () => "crosshair" });
      this.segB = C.seg([["start", "设起点"], ["goal", "设目标"], ...TERRAIN.map(([v, n], k) => ["t" + k, "刷：" + n])], this.mode, (k) => { if (k[0] === "t") { this.mode = "paint"; this.brush = TERRAIN[+k.slice(1)][0]; } else this.mode = k; });
      this.cH = C.check("显示代价到达函数 G", true, (v) => { this.showG = v; this.st.draw(); }); this.showG = true;
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segB), h("div", { class: "controls" }, this.cH, C.button("恢复地形", () => { this.T = terrainPreset(this.N); this.update(); }, "small")), this.st.wrap, this.out,
        C.legend([[C.cv("surface"), "路 ×1"], [C.cv("okSoft"), "草地 ×2"], [C.cv("mud"), "泥地 ×5"], [C.cva("wall", 0.9), "障碍"], [C.cva("accent", 0.45), "叠加的蓝色越深 = 离目标的代价 G 越小"], [C.cv("path"), "沿 G 下降的路线"]]));
      this.update();
    }
    act(p) {
      const N = this.N, i = Math.floor(p.x * N), j = Math.floor(p.y * N); if (i < 0 || j < 0 || i >= N || j >= N) return;
      const c = j * N + i;
      if (this.mode === "start") { if (this.T[c] < Infinity) { this.start = c; this.path = descend(this.G, N, c); this.render(); } return; }
      if (this.mode === "goal") { if (this.T[c] < Infinity) { this.goal = c; this.update(); } return; }
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < N && y < N && y * N + x !== this.goal) this.T[y * N + x] = this.brush; }
      this.updateSoon();
    }
    updateSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.update(); }); }
    update() { this.G = costToGo(this.T, this.N, this.goal); this.path = descend(this.G, this.N, this.start); this.render(); }
    render() {
      const g = this.G[this.start], N = this.N;
      let geo = 0; for (let k = 1; k < this.path.length; k++) { const a = this.path[k - 1], b = this.path[k]; geo += Math.hypot((a % N) - (b % N), Math.floor(a / N) - Math.floor(b / N)) / N; }
      this.out.innerHTML = g === Infinity ? '<span class="no">起点到不了目标。</span>' :
        `从起点出发的最优代价 G = ${g.toFixed(3)}，路径的几何长度 ${geo.toFixed(3)}。最优路线宁可绕远走「路」，也尽量少踩泥地。G 一旦算好，<b>从任何格子出发</b>都只要每步走向 G 更小的邻居——这就是一个反馈计划（第 8 章），换起点不用重新搜索。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const N = this.N, gmax = Math.max(...Array.from(this.G).filter((v) => v < Infinity));
      const tc = { 1: C.rgb(col.surface), 2: C.rgb(col.okSoft), 5: C.rgb(col.mud) }, wall = C.rgb(col.wall), acc = C.rgb(col.accent);
      st.raster(N, N, 0, 1, 0, 1, (i, j) => {
        const k = j * N + i, t = this.T[k];
        if (t === Infinity) return [...wall, 230];
        let c = tc[t] || tc[2];
        if (this.showG && this.G[k] < Infinity) { const f = 0.45 * (1 - this.G[k] / gmax); c = c.map((v, m) => v + (acc[m] - v) * f); }
        return [...c, 255];
      });
      const ctr = (k) => ({ x: ((k % N) + 0.5) / N, y: (Math.floor(k / N) + 0.5) / N });
      st.polyline(this.path.map(ctr), col.path, 3);
      st.dot(ctr(this.start), 6, col.start, col.surface, 2); st.dot(ctr(this.goal), 6, col.goal, col.surface, 2);
      st.text("qI", ctr(this.start), col.start, { dy: -13, weight: 650 }); st.text("qG", ctr(this.goal), col.goal, { dy: -13, weight: 650 });
    }
  }

  // =================================================================
  // 组件 4：两个机器人的 Pareto 最优协调（图 7.42，式 7.28、7.29）
  // =================================================================
  // 「开 / 关」模型：每一步每个机器人要么沿自己的路径以最大速度前进一格，要么停着。L_i = 机器人 i 在到达前停着的总时间
  const PA_PRESETS = {
    H: { name: "H 形走廊（图 7.42）", r: 0.45, view: [-1.5, 7.5, -1.2, 9.2],
      paths: [[{ x: 0, y: 8 }, { x: 0, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 0 }], [{ x: 6, y: 8 }, { x: 6, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }]],
      walls: [[-0.6, -0.6, 0.6, 8.6], [5.4, -0.6, 6.6, 8.6], [0.6, 3.4, 5.4, 4.6]] },
    zigzag: { name: "之字形三次穿越（补充）", r: 1.0, view: [-1.6, 15.6, -1.2, 9.2],
      paths: [[{ x: 0, y: 4 }, { x: 14, y: 4 }], [{ x: 1.6, y: 6.7 }, { x: 5.5, y: 1.9 }, { x: 8.4, y: 6.1 }, { x: 12.2, y: 1.7 }]],
      walls: [] },
  };
  const H_STEP = 0.25;
  function paretoDP(P1, P2, r) {
    const L1 = C.polyLen(P1), L2 = C.polyLen(P2), N1 = Math.round(L1 / H_STEP), N2 = Math.round(L2 / H_STEP);
    const A = Array.from({ length: 2 * N1 + 1 }, (_, i) => C.polyAt(P1, i / (2 * N1))), B = Array.from({ length: 2 * N2 + 1 }, (_, j) => C.polyAt(P2, j / (2 * N2)));
    const coll = (i2, j2) => C.dist(A[i2], B[j2]) < 2 * r;   // 下标是半步
    const M = N2 + 1, lab = Array.from({ length: (N1 + 1) * M }, () => []);
    const blocked = (i, j) => coll(2 * i, 2 * j);
    if (blocked(0, 0) || blocked(N1, N2)) return { N1, N2, A, B, front: [], blockedAt: blocked, coll };
    lab[0].push({ w: [0, 0], prev: -1, pl: -1 });
    const addLab = (k, w, prev, pl) => {
      const L = lab[k];
      if (L.some((x) => x.w[0] <= w[0] && x.w[1] <= w[1])) return;   // 被支配或相同：丢掉（相同的只留一个代表）
      for (let q = L.length - 1; q >= 0; q--) if (w[0] <= L[q].w[0] && w[1] <= L[q].w[1]) L.splice(q, 1);
      L.push({ w, prev, pl });
    };
    for (let i = 0; i <= N1; i++) for (let j = 0; j <= N2; j++) {
      const k = i * M + j; if (!lab[k].length) continue;
      for (const [di, dj] of [[1, 1], [1, 0], [0, 1]]) {
        const a = i + di, b = j + dj; if (a > N1 || b > N2) continue;
        if (blocked(a, b) || coll(2 * i + di, 2 * j + dj)) continue;
        lab[k].forEach((x, pl) => addLab(a * M + b, [x.w[0] + (di === 0 && i < N1 ? 1 : 0), x.w[1] + (dj === 0 && j < N2 ? 1 : 0)], k, pl));
      }
    }
    const fin = lab[N1 * M + N2];
    const front = fin.map((x, q) => {
      const path = []; let k = N1 * M + N2, pl = q;
      while (k >= 0) { path.push([Math.floor(k / M), k % M]); const y = lab[k][pl]; k = y.prev; pl = y.pl; }
      return { cost: x.w.map((v) => v * H_STEP), path: path.reverse() };
    }).sort((a, b) => a.cost[0] - b.cost[0]);
    // 哪些 Pareto 点能被某个正的线性加权（式 7.29）选中：在下凸包上
    front.forEach((p, q) => {
      p.supported = !front.some((a, x) => front.some((b, y) => {
        if (x === y || x === q || y === q || a.cost[0] >= p.cost[0] || b.cost[0] <= p.cost[0]) return false;
        const t = (p.cost[0] - a.cost[0]) / (b.cost[0] - a.cost[0]); return a.cost[1] + t * (b.cost[1] - a.cost[1]) < p.cost[1] - 1e-9;
      }));
    });
    return { N1, N2, A, B, front, blockedAt: blocked, coll, M };
  }
  // 随机的可行协调计划（大多被支配），用来在代价平面上画一团「云」
  function randomPlans(R, n, seed) {
    const r = C.rng(seed), out = [], M = R.N2 + 1;
    const step = (i, j, a, b) => i + a <= R.N1 && j + b <= R.N2 && !R.blockedAt(i + a, j + b) && !R.coll(2 * i + a, 2 * j + b);
    // 先倒着算出哪些格点还能走到终点，随机游走只进这些格点，就不会卡死在死胡同里
    const ok2 = new Uint8Array((R.N1 + 1) * M); ok2[R.N1 * M + R.N2] = 1;
    for (let i = R.N1; i >= 0; i--) for (let j = R.N2; j >= 0; j--) { if (R.blockedAt(i, j)) continue; for (const [a, b] of [[1, 1], [1, 0], [0, 1]]) if (step(i, j, a, b) && ok2[(i + a) * M + j + b]) ok2[i * M + j] = 1; }
    for (let t = 0; t < n; t++) {
      let i = 0, j = 0, w1 = 0, w2 = 0, ok = true, bias = 0.2 + 0.7 * r();
      while (i < R.N1 || j < R.N2) {
        const opts = [[1, 1], [1, 0], [0, 1]].filter(([a, b]) => step(i, j, a, b) && ok2[(i + a) * M + j + b]);
        if (!opts.length) { ok = false; break; }
        const pick = r() < bias && opts.some(([a, b]) => a && b) ? [1, 1] : opts[Math.floor(r() * opts.length)];
        if (!pick[0] && i < R.N1) w1++; if (!pick[1] && j < R.N2) w2++;
        i += pick[0]; j += pick[1];
      }
      if (ok) out.push([w1 * H_STEP, w2 * H_STEP]);
    }
    return out;
  }

  class Pareto {
    constructor(root) {
      this.preset = "H"; this.alpha = 0.5; this.sel = 0; this.u = 0;
      const body = C.frame(root, "Pareto 最优协调", "开 / 关模型：L_i = 机器人 Aⁱ 在路上停着等待的总时间。右图每个点是一个计划的代价向量 L(γ) = (L₁, L₂)；点一个蓝点看它的计划");
      this.stW = new C.Stage({ view: PA_PRESETS.H.view, maxW: 300, aspect: 1.05, onDraw: (ctx, st, col) => this.drawW(ctx, st, col) });
      this.stL = new C.Stage({ view: [-1, 10, -1, 10], maxW: 330, onDraw: (ctx, st, col) => this.drawL(ctx, st, col),
        onDown: (p) => { let best = -1, bd = 0.6; this.R.front.forEach((f, q) => { const d = Math.hypot(f.cost[0] - p.x, f.cost[1] - p.y); if (d < bd) { bd = d; best = q; } }); if (best >= 0) { this.sel = best; this.tl.set(0); this.render(); } return null; } });
      this.selP = C.select(Object.entries(PA_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.update(); });
      this.sA = C.slider("标量化权重 α₁", 0.02, 0.98, 0.01, this.alpha, (v) => { this.alpha = v; this.render(); }, (v) => `${v.toFixed(2)}，α₂ = ${(1 - v).toFixed(2)}`);
      this.tl = new C.Timeline((u) => { this.u = u; this.stW.draw(); }, { label: "执行所选计划", dur: 6, fmt: (u) => Math.round(u * 100) + "%" });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP, this.sA), h("div", { class: "split" }, this.stW.wrap, this.stL.wrap), this.tl.el, this.out,
        C.legend([[C.cv("accent"), "Pareto 最优（能被某个 α 选中）", true], [C.cv("bad"), "Pareto 最优但任何正权重都选不中（补充）", true], [C.cva("muted", 0.6), "随机的其它计划（被支配）", true], [C.cv("warn"), "式 (7.29) 的等值线与它选中的计划"]]));
      this.update();
    }
    update() {
      const P = PA_PRESETS[this.preset];
      this.R = paretoDP(P.paths[0], P.paths[1], P.r);
      this.cloud = randomPlans(this.R, 400, 7);
      const mx = Math.max(4, ...this.R.front.flatMap((f) => f.cost), ...this.cloud.flat()) * 1.1;
      this.stL.setView([-mx * 0.08, mx, -mx * 0.08, mx]); this.stW.setView(P.view);
      this.sel = 0; this.tl.set(0); this.render();
    }
    render() {
      const F = this.R.front, a = this.alpha;
      let best = -1; F.forEach((f, q) => { if (best < 0 || a * f.cost[0] + (1 - a) * f.cost[1] < a * F[best].cost[0] + (1 - a) * F[best].cost[1] - 1e-9) best = q; });
      this.best = best;
      const uns = F.filter((f) => !f.supported);
      this.out.innerHTML = `${F.length} 个 unique Pareto 最优计划：${F.map((f) => `(${f.cost.map((v) => v.toFixed(2)).join(", ")})`).join("、")}。` +
        `加权和 α₁L₁ + α₂L₂ 选中的是 (${F[best].cost.map((v) => v.toFixed(2)).join(", ")})——它一定是 Pareto 最优的。` +
        (uns.length ? ` 但红色的 ${uns.map((f) => `(${f.cost.map((v) => v.toFixed(2)).join(", ")})`).join("、")} 也是 Pareto 最优的，无论 α 怎么取都选不中它：Pareto 前沿不凸时，标量化会漏掉解。` : " 改变 α 只是在这些 Pareto 点之间切换——标量化相当于人为定了一个优先级，丢掉了「谁做了牺牲」的信息。");
      this.stW.draw(); this.stL.draw();
    }
    drawL(ctx, st, col) {
      st.frame(col);
      const [x0, x1, y0, y1] = st.view, F = this.R.front;
      st.line({ x: 0, y: y0 }, { x: 0, y: y1 }, C.alpha(col.muted, 0.5), 1); st.line({ x: x0, y: 0 }, { x: x1, y: 0 }, C.alpha(col.muted, 0.5), 1);
      st.text("L₁ →", { x: x1, y: 0 }, col.muted, { align: "right", base: "top", dx: -4, dy: 3, size: 11.5 }); st.text("L₂", { x: 0, y: y1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 3, size: 11.5 });
      for (const f of F) st.box({ x0: f.cost[0], y0: f.cost[1], x1, y1 }, C.alpha(col.muted, 0.06), null);   // 被它支配的区域
      for (const [a, b] of this.cloud) st.dot({ x: a, y: b }, 2.2, C.alpha(col.muted, 0.5));
      const b = F[this.best], a = this.alpha, c = a * b.cost[0] + (1 - a) * b.cost[1];
      st.line({ x: x0, y: (c - a * x0) / (1 - a) }, { x: x1, y: (c - a * x1) / (1 - a) }, col.warn, 1.6, [6, 4]);
      F.forEach((f, q) => { st.dot({ x: f.cost[0], y: f.cost[1] }, q === this.sel ? 8 : 6, f.supported ? col.accent : col.bad, q === this.best ? col.warn : col.surface, q === this.best ? 3 : 1.5); });
    }
    drawW(ctx, st, col) {
      st.frame(col);
      const P = PA_PRESETS[this.preset];
      if (P.walls.length) { const [vx0, vx1, vy0, vy1] = P.view; st.box({ x0: vx0, y0: vy0, x1: vx1, y1: vy1 }, C.alpha(col.wall, 0.85), null); for (const [a, b, c, d] of P.walls) st.box({ x0: a, y0: b, x1: c, y1: d }, col.surface, null); }
      P.paths.forEach((Q, k) => { st.polyline(Q, C.alpha(col.robot[k], 0.5), 1.5, [5, 4]); st.arrow(C.polyAt(Q, 0.96), Q[Q.length - 1], col.robot[k], 1.4, 7); const g = Q[Q.length - 1]; ctx.setLineDash([3, 3]); st.box({ x0: g.x - 0.5, y0: g.y - 0.5, x1: g.x + 0.5, y1: g.y + 0.5 }, null, col.robot[k], 1.5); ctx.setLineDash([]); });
      const f = this.R.front[this.sel]; if (!f) return;
      const n = f.path.length - 1, t = this.u * n, k = Math.min(n - 1, Math.floor(t)), fr = t - k;
      const [i0, j0] = f.path[k], [i1, j1] = f.path[Math.min(n, k + 1)];
      const s1 = (i0 + (i1 - i0) * fr) / this.R.N1, s2 = (j0 + (j1 - j0) * fr) / this.R.N2;
      [s1, s2].forEach((s, q) => { const p = C.polyAt(P.paths[q], s); st.dot(p, P.r * st.scale, C.alpha(col.robot[q], 0.85), col.robot[q], 1.5); st.text("A" + ["¹", "²"][q], p, "#fff", { size: 10.5, weight: 700 }); });
      st.text(`计划 (${f.cost.map((v) => v.toFixed(2)).join(", ")})`, { x: st.view[0], y: st.view[3] }, col.text, { align: "left", base: "top", dx: 4, dy: 4, size: 11.5 });
    }
  }

  CH7.optimal = { MotionModels, EuclidReach, WeightedRegion, Pareto, MM, gridOpt, euclidShortest, unitSteps, terrainPreset, costToGo, descend, paretoDP, randomPlans, PA_PRESETS };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='motion-models']").forEach((el) => el._w = new MotionModels(el));
    document.querySelectorAll("[data-widget='euclid-reach']").forEach((el) => el._w = new EuclidReach(el));
    document.querySelectorAll("[data-widget='weighted-region']").forEach((el) => el._w = new WeightedRegion(el));
    document.querySelectorAll("[data-widget='pareto']").forEach((el) => el._w = new Pareto(el));
  });
})();
