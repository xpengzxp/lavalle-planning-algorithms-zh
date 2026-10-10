/* 14.4.2–14.4.3 节：按状态空间单元剪枝的搜索（图 14.16–14.18，Barraquand–Latombe）；
   微分约束下的 RDT（图 14.19、14.20），含距离函数的选择、X_ric 的陷阱与双向搜索的「缝」（图 14.11d） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // ---------------------------------------------------------------
  // 组件：CELL-BASED SEARCH（图 14.17），Dubins 车
  // ---------------------------------------------------------------
  const CELL_MAPS = {
    open: {
      name: "空地（图 14.16）", B: { x0: -4, y0: -4, x1: 4, y1: 4 }, polys: [], start: { x: 0, y: 0, th: 0 }, goal: null, rho: 1, dt: Math.PI / 2, cell: 1, thDiv: 1, stages: 4,
    },
    uturn: {
      name: "大转弯半径的 U 形掉头（图 14.18）", B: { x0: 0, y0: 0, x1: 10, y1: 8 },
      polys: [C.rect(0, 0, 10, 0.6), C.rect(0, 7.4, 10, 8), C.rect(0, 0, 0.3, 8), C.rect(3.0, 2.85, 10, 5.15)],
      start: { x: 8.6, y: 6.25, th: Math.PI }, goal: { x: 9.0, y: 1.75, r: 0.55 }, rho: 2.25, dt: 1.0, cell: 0.7, thDiv: 8,
    },
  };
  class CellSearch {
    constructor(root) {
      this.mapKey = "uturn"; this.costKind = "time"; this.extraU = false; this.anim = null;
      const body = C.frame(root, "按单元剪枝的搜索", "图 14.17：一个单元里最多一个顶点；Δt、U_d、单元大小三处都要加密才分辨率完备");
      this.st = new C.Stage({ view: [0, 10, 0, 8], aspect: 0.8, maxW: 620, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segMap = C.seg(Object.entries(CELL_MAPS).map(([k, m]) => [k, m.name]), this.mapKey, (k) => { this.mapKey = k; this.loadMap(); });
      this.sCell = C.slider("单元边长", 0.25, 2, 0.05, 1, (v) => { this.cell = v; this.run(); }, (v) => v.toFixed(2));
      this.sTh = C.slider("θ 方向分几段", 1, 32, 1, 8, (v) => { this.thDiv = v; this.run(); });
      this.sDt = C.slider("Δt", 0.2, 1.8, 0.05, 0.6, (v) => { this.dt = v; this.run(); }, (v) => v.toFixed(2));
      this.cU = C.chip("U_d 加两个半舵角动作", false, (on) => { this.extraU = on; this.run(); });
      this.segCost = C.seg([["time", "Q 按时间（步数）排序"], ["switch", "Q 按动作切换次数排序"]], this.costKind, (k) => { this.costKind = k; this.run(); });
      this.stats = { v: C.stat("搜索图的顶点"), c: C.stat("访问过的单元"), r: C.stat("结果") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segMap), h("div", { class: "controls" }, this.sCell, this.sTh, this.sDt), h("div", { class: "controls" }, h("div", { class: "chips" }, this.cU), this.segCost),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "单元边界"], [C.cv("text2"), "搜索图的边"], [C.cv("muted"), "被剪掉的分支（只在空地上画）"], [C.cv("path"), "解"]]));
      this.loadMap();
    }
    loadMap() {
      const M = (this.M = CELL_MAPS[this.mapKey]);
      this.W = new C.World(M.polys, M.B);
      this.cell = M.cell; this.thDiv = M.thDiv; this.dt = M.dt;
      this.sCell.setValue(this.cell); this.sTh.setValue(this.thDiv); this.sDt.setValue(+this.dt.toFixed(2));
      this.st.setView([M.B.x0, M.B.x1, M.B.y0, M.B.y1]);
      this.run();
    }
    acts() {
      const w = 1 / this.M.rho, A = [[1, 0], [1, w], [1, -w]];
      if (this.extraU) A.push([1, w / 2], [1, -w / 2]);
      return A;
    }
    cellOf(s) {
      const B = this.M.B, c = this.cell, n = this.thDiv;
      return Math.floor((s.x - B.x0) / c) + "," + Math.floor((s.y - B.y0) / c) + "," + (n > 1 ? Math.floor((C.mod2pi(s.th) / C.TAU) * n) % n : 0);
    }
    run() {
      const M = this.M, A = this.acts(), dt = this.dt;
      const start = { s: { ...M.start }, par: null, pts: null, cost: 0, a: -1 };
      const visited = new Set([this.cellOf(start.s)]);
      const Q = new C.Heap((x, y) => x.k < y.k || (x.k === y.k && x.id < y.id));
      let id = 0; Q.push({ k: 0, id: id++, n: start });
      this.V = [start]; this.found = null; this.pruned = [];
      const maxV = 6000, maxStage = M.stages || Infinity;
      while (Q.size && !this.found && this.V.length < maxV) {
        const { n } = Q.pop();
        const depth = n.depth || 0; if (depth >= maxStage) continue;
        // REACHED(x_cur)：对每个 u ∈ U_d 积分 Δt，只报告无碰的状态
        A.forEach((a, ai) => {
          if (this.found) return;
          const pts = C.carSample(n.s, a[0], a[1], dt, Math.max(4, Math.ceil(dt * 8)));
          if (!this.W.pathFree(pts, 0.12)) return;
          const s2 = pts[pts.length - 1], cell = this.cellOf(s2);
          if (visited.has(cell)) { if (this.mapKey === "open") this.pruned.push(pts); return; }
          visited.add(cell);
          const cost = this.costKind === "time" ? n.cost + 1 : n.cost + (n.a >= 0 && n.a !== ai ? 1 : 0) + 1e-3;
          const child = { s: s2, par: n, pts, cost, a: ai, depth: depth + 1 };
          this.V.push(child); Q.push({ k: cost, id: id++, n: child });
          if (M.goal && Math.hypot(s2.x - M.goal.x, s2.y - M.goal.y) <= M.goal.r) this.found = child;
        });
      }
      this.cells = visited.size; this.exhausted = !this.found && !Q.size;
      this.render();
    }
    render() {
      this.stats.v.set(this.V.length); this.stats.c.set(this.cells);
      this.stats.r.set(!this.M.goal ? "（只看剪枝）" : this.found ? '<span class="yes">找到</span>' : this.exhausted ? '<span class="no">Q 空了：报告失败</span>' : '<span class="no">达到顶点上限</span>');
      this.msg.innerHTML = this.mapKey === "open" ?
        "灰色是前四个阶段完整（稠密）的可达图，深色是「每个单元最多一个顶点」的搜索图：大量分支被剪掉。这个例子里 θ 方向不分段（和图 14.16 一样），所以朝向不同但落在同一个 (x, y) 格子里的状态也会被剪掉。" :
        "Dubins 车的最小转弯半径很大，掉头只能「左转打满」贴着墙绕过去（图 14.18a）。单元太粗时，这条轨迹沿途某个单元<b>已经被别的顶点占了</b>，需要的那个顶点被剪掉，搜索失败（图 14.18b）——几阶段之前错过的一个动作，会在很多阶段之后造成严重后果。试试：缩小单元、增加 θ 分段、减小 Δt，或给 U_d 加动作。书中说要求最优解时每个轴要 50–100 个单元，所以这只适合维数很低的状态空间。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const B = this.M.B, c = this.cell;
      if (c >= 0.2) {
        for (let x = B.x0; x <= B.x1 + 1e-9; x += c) st.line({ x, y: B.y0 }, { x, y: B.y1 }, C.alpha(col.accent, 0.3), 1);
        for (let y = B.y0; y <= B.y1 + 1e-9; y += c) st.line({ x: B.x0, y }, { x: B.x1, y }, C.alpha(col.accent, 0.3), 1);
      }
      st.world(this.W, col);
      if (this.M.goal) st.circle(this.M.goal, this.M.goal.r, C.alpha(col.goal, 0.2), col.goal, 1.5);
      for (const pts of this.pruned) st.polyline(pts, C.alpha(col.muted, 0.45), 1);
      for (const v of this.V) if (v.pts) st.polyline(v.pts, C.alpha(col.text2, 0.75), 1.1);
      for (const v of this.V) st.dot(v.s, 1.8, col.text2);
      if (this.found) { let n = this.found; while (n && n.pts) { st.polyline(n.pts, col.path, 3); n = n.par; } }
      st.car(this.M.start, this.mapKey === "open" ? 0.45 : 0.55, col.alive, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：微分约束下的 RDT（图 14.19 SIMPLE_RDT_WITH_DIFFERENTIAL_CONSTRAINTS）
  // ---------------------------------------------------------------
  const RDT_MAPS = {
    car: {
      name: "Dubins 车 · 走廊", B: { x0: 0, y0: 0, x1: 10, y1: 6 },
      polys: [C.rect(3, 0, 3.5, 3.8), C.rect(6.4, 2.2, 6.9, 6), [{ x: 1.2, y: 4.2 }, { x: 2.2, y: 4.0 }, { x: 1.8, y: 5.0 }]],
      xI: { x: 1, y: 1, th: 0 }, xG: { x: 9, y: 5, th: Math.PI / 2 },
    },
    di: {
      name: "平面点质量（双积分器）· 带动量", B: { x0: 0, y0: 0, x1: 10, y1: 6 },
      polys: [C.rect(3, 0, 3.5, 3.8), C.rect(6.4, 2.2, 6.9, 6), [{ x: 1.2, y: 4.2 }, { x: 2.2, y: 4.0 }, { x: 1.8, y: 5.0 }]],
      xI: { x: 1, y: 1, vx: 0, vy: 0 }, xG: { x: 9, y: 5, vx: 0, vy: 0 },
    },
  };
  class RDTDiff {
    constructor(root) {
      this.sys = "car"; this.metric = "weighted"; this.bidir = false; this.dt = 0.5; this.goalR = 0.45; this.bias = 0.05; this.tol = 0.6; this.seed = 11; this.maxIt = 3000;
      const body = C.frame(root, "微分约束下的 RDT", "图 14.19：x_n = 离 α(i) 最近的点，LPM 试遍 U_d 里没试过的动作，选使 ρ(x_r, α(i)) 最小的那个");
      this.st = new C.Stage({ view: [0, 10, 0, 6], aspect: 0.6, maxW: 720, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segSys = C.seg(Object.entries(RDT_MAPS).map(([k, m]) => [k, m.name]), this.sys, (k) => { this.sys = k; this.updMetricSeg(); this.reset(); });
      this.metricSel = C.select([["weighted", "加权欧氏"], ["dubins", "Dubins 最短路径长（接近 ρ*）"], ["xy", "只看位置 (x, y)"]], this.metric, (k) => { this.metric = k; this.reset(); });
      this.cBi = C.chip("双向（第二棵树反向积分）", false, (on) => { this.bidir = on; this.reset(); });
      this.sDt = C.slider("Δt", 0.2, 1.5, 0.05, this.dt, (v) => { this.dt = v; this.reset(); }, (v) => v.toFixed(2));
      this.sR = C.slider("目标容差", 0.15, 1.2, 0.05, this.goalR, (v) => { this.goalR = v; this.tol = v * 1.3; this.reset(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => { for (let k = 0; k < 25; k++) if (!this.step()) { this.render(); return false; } this.render(); return true; });
      this.stats = { it: C.stat("迭代"), v: C.stat("顶点"), fail: C.stat("LPM 失败（整步都碰撞）"), dead: C.stat("所有动作都碰撞的顶点"), res: C.stat("结果") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segSys), h("div", { class: "controls" }, h("label", null, "距离函数 ρ ", this.metricSel), h("div", { class: "chips" }, this.cBi), this.sDt, this.sR),
        h("div", { class: "controls" }, C.button("运行", () => this.runner.start(), "small primary"), C.button("暂停", () => this.runner.stop(), "small"), C.button("单步", () => { this.step(); this.render(); }, "small"), C.button("换种子重来", () => { this.seed = C.newSeed(); this.reset(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "从 x_I 的树"], [C.cv("alive2"), "从 x_G 的树（反向积分）"], [C.cv("current"), "α(i)", true], [C.cv("bad"), "所有动作都碰撞的顶点（可能已在 X_ric 里）", true], [C.cv("path"), "解"], [C.cv("bad"), "两树之间的缝（BVP）"]]));
      this.updMetricSeg(); this.reset();
    }
    updMetricSeg() {
      const car = this.sys === "car";
      [...this.metricSel.children].forEach((o) => { if (o.value === "dubins") o.disabled = !car; });
      if (!car && this.metric === "dubins") { this.metric = "weighted"; this.metricSel.value = "weighted"; }
    }
    // ---- 系统 ----
    actions() {
      if (this.sys === "car") return [[1, 0], [1, 1], [1, -1]];   // 单位速度、ρ_min = 1
      const A = []; for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) A.push([a, b]); return A;
    }
    // 从 s 施加动作 a 走 Δt（back = 反向积分 −f），返回采样点
    simulate(s, a, back) {
      const dt = this.dt, n = 6, out = [];
      if (this.sys === "car") { for (let k = 0; k <= n; k++) out.push(C.carStep(s, back ? -a[0] : a[0], back ? -a[1] : a[1], (dt * k) / n)); return out; }
      const sg = back ? -1 : 1;
      for (let k = 0; k <= n; k++) { const t = (dt * k) / n; out.push({ x: s.x + sg * s.vx * t + 0.5 * a[0] * t * t, y: s.y + sg * s.vy * t + 0.5 * a[1] * t * t, vx: s.vx + sg * a[0] * t, vy: s.vy + sg * a[1] * t }); }
      return out;
    }
    valid(pts) {
      if (!this.W.pathFree(pts, 0.1)) return false;
      if (this.sys === "di") for (const p of pts) if (Math.abs(p.vx) > 2 || Math.abs(p.vy) > 2) return false;   // 相约束 |q̇_i| ≤ 2
      return true;
    }
    rho(a, b) {
      if (this.metric === "xy") return Math.hypot(a.x - b.x, a.y - b.y);
      if (this.sys === "car") return this.metric === "dubins" ? C.dubins(a, b, 1).L : Math.hypot(a.x - b.x, a.y - b.y, 1.0 * C.angDiff(a.th, b.th));
      return Math.hypot(a.x - b.x, a.y - b.y, 0.8 * (a.vx - b.vx), 0.8 * (a.vy - b.vy));
    }
    sample() {
      const r = this.r, B = this.M.B;
      if (this.sys === "car") return { x: B.x0 + r() * (B.x1 - B.x0), y: B.y0 + r() * (B.y1 - B.y0), th: r() * C.TAU };
      return { x: B.x0 + r() * (B.x1 - B.x0), y: B.y0 + r() * (B.y1 - B.y0), vx: r() * 4 - 2, vy: r() * 4 - 2 };
    }
    reset() {
      this.runner && this.runner.stop();
      this.M = RDT_MAPS[this.sys]; this.W = new C.World(this.M.polys, this.M.B);
      this.r = C.rng(this.seed); this.it = 0; this.fails = 0; this.done = null; this.alpha = null;
      const mk = (s) => ({ s: { ...s }, par: null, pts: null, tried: new Set() });
      this.TA = [mk(this.M.xI)]; this.TB = this.bidir ? [mk(this.M.xG)] : null;
      this.render();
    }
    nearest(T, a, backward) {
      // 树的 swath 用顶点近似（14.4.3 节「Efficiently finding nearest points」）；反向树要量「从顶点到 α」的反方向
      let best = null, bd = Infinity;
      for (const v of T) {
        if (this.metric === "dubins") { const e = Math.hypot(v.s.x - a.x, v.s.y - a.y); if (e >= bd) continue; }   // Dubins 长度 ≥ 欧氏距离：先剪枝
        const d = backward ? this.rho(a, v.s) : this.rho(v.s, a);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    }
    // LPM：从 x_n 试遍还没试过的动作，选 ρ(x_r, α) 最小且无碰的
    extend(T, a, backward) {
      const xn = this.nearest(T, a, backward); if (!xn) return null;
      const A = this.actions(); let best = null, bd = Infinity;
      A.forEach((u, ui) => {
        if (xn.tried.has(ui)) return;
        const pts = this.simulate(xn.s, u, backward);
        if (!this.valid(pts)) { xn.tried.add(ui); return; }
        const xr = pts[pts.length - 1], d = backward ? this.rho(a, xr) : this.rho(xr, a);
        if (d < bd) { bd = d; best = { ui, pts, xr }; }
      });
      if (!best) { this.fails++; return null; }
      xn.tried.add(best.ui);
      const node = { s: best.xr, par: xn, pts: best.pts, tried: new Set() };
      T.push(node);
      return node;
    }
    closeTo(a, b) {
      const dp = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.sys === "car") return dp <= this.goalR && Math.abs(C.angDiff(a.th, b.th)) <= 0.6;
      return dp <= this.goalR && Math.hypot(a.vx - b.vx, a.vy - b.vy) <= 0.6;
    }
    step() {
      if (this.done || this.it >= this.maxIt) return false;
      this.it++;
      const goalBias = !this.bidir && this.r() < this.bias;
      const a = goalBias ? { ...this.M.xG } : this.sample(); this.alpha = a;
      const n = this.extend(this.TA, a, false);
      if (n && !this.bidir && this.closeTo(n.s, this.M.xG)) { this.done = { a: n }; return false; }
      if (this.bidir) {
        // 另一棵树也朝同一个 α 长，然后看两棵树是否已经足够接近
        const m = this.extend(this.TB, a, true);
        const pairs = [];
        if (n) { const o = this.nearest(this.TB, n.s, true); if (o) pairs.push([n, o]); }
        if (m) { const o = this.nearest(this.TA, m.s, false); if (o) pairs.push([o, m]); }
        for (const [x, y] of pairs) if (this.closeTo(x.s, y.s)) { this.done = { a: x, b: y }; return false; }
      }
      return true;
    }
    deadCount() { let k = 0; const nA = this.actions().length; for (const v of this.TA) if (v.tried.size === nA && !this.TA.some((w) => w.par === v)) k++; return k; }
    render() {
      this.stats.it.set(this.it); this.stats.v.set(this.TA.length + (this.TB ? this.TB.length : 0)); this.stats.fail.set(this.fails); this.stats.dead.set(this.deadCount());
      this.stats.res.set(this.done ? (this.done.b ? `<span class="yes">两树相接</span>，缝 ${Math.hypot(this.done.a.s.x - this.done.b.s.x, this.done.a.s.y - this.done.b.s.y).toFixed(2)}` : '<span class="yes">到达 X_G</span>') : this.it >= this.maxIt ? '<span class="no">迭代上限</span>' : "进行中");
      this.msg.innerHTML = (this.sys === "car" ?
        "Dubins 车只能前进，每条边是一段 Δt 长的直线或圆弧。距离函数非常关键：加权欧氏度量以为车身后或侧面的点「很近」，树会花很多力气徒劳地朝它们长；换成 Dubins 最短路径长度（理想距离 ρ* 的无障碍近似），树长得更有方向感。" :
        "点质量有动量：树把顶点拉得离障碍很近时，很多顶点其实已经在 X_ric 里——刹不住了，所有动作都会撞（红点）。它们的 Voronoi 区域大，常被选中，却怎么也长不出去，这就是 14.4.3 节说的 RDT 被「困住」。可以把 Δt 调大一些对比。") +
        (this.bidir ? " 双向时两棵树不会恰好相遇：只能在某个容差内「几乎相接」，剩下的缝（红色虚线）是一个 BVP（图 14.11d）。容差越小越难接上，有漂移时尤其如此。" : " 目标是一个小区域，所以前向单树配上一点目标偏置就能避开 BVP（图 14.11a）；把目标容差调小，搜索时间会迅速变长。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.world(this.W, col);
      const nA = this.actions().length;
      const drawTree = (T, c) => { for (const v of T) if (v.pts) st.polyline(v.pts, c, 1); };
      drawTree(this.TA, C.alpha(col.accent, 0.8));
      if (this.TB) drawTree(this.TB, C.alpha(col.alive2, 0.85));
      for (const v of this.TA) if (v.tried.size === nA && !this.TA.some((w) => w.par === v)) st.dot(v.s, 2.6, col.bad);
      if (this.alpha && !this.done) st.dot(this.alpha, 4, col.current);
      if (this.done) {
        const trace = (n) => { while (n && n.pts) { st.polyline(n.pts, col.path, 3); n = n.par; } };
        trace(this.done.a); if (this.done.b) { trace(this.done.b); st.line(this.done.a.s, this.done.b.s, col.bad, 2.5, [4, 3]); }
      }
      st.circle(this.M.xG, this.goalR, C.alpha(col.goal, 0.15), col.goal, 1.2, [4, 3]);
      if (this.sys === "car") { st.car(this.M.xI, 0.5, col.start, col.text); st.car(this.M.xG, 0.5, C.alpha(col.goal, 0.85), col.text); }
      else { st.mark(this.M.xI, col.start, "x_I", col); st.mark(this.M.xG, col.goal, "x_G", col); }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='cell-search']").forEach((el) => el._w = new CellSearch(el));
    document.querySelectorAll("[data-widget='rdt-diff']").forEach((el) => el._w = new RDTDiff(el));
  });
})();
