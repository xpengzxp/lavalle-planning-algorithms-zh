/* 5.5 节：RDT 探索（图 5.16–5.19）、Kd 树最近邻（图 5.23）、用 RRT 做规划（单树 / 平衡双向，图 5.24） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH5;

  // ---------------------------------------------------------------
  // 组件：没有障碍时的 RDT 探索（SIMPLE_RDT，图 5.16–5.19）
  // ---------------------------------------------------------------
  class RDTExplore {
    constructor(root) {
      this.seqKind = "random"; this.nearMode = "swath"; this.showVor = true; this.seed = 21;
      const body = C.frame(root, "快速探索稠密树 RDT", "无障碍时的 SIMPLE_RDT：每一步把 α(i) 连到树上最近的点");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segSeq = C.seg([["random", "随机 α → RRT"], ["halton", "Halton α"], ["mrgrid", "多分辨率网格 α"]], this.seqKind, (k) => { this.seqKind = k; this.reset(); });
      this.segNear = C.seg([["swath", "最近点取在整个 swath S 上"], ["vertex", "只看顶点"]], this.nearMode, (k) => { this.nearMode = k; this.reset(); });
      const vorBtn = h("button", { type: "button", class: "chip on" }, "顶点的 Voronoi 区域");
      vorBtn.addEventListener("click", () => { this.showVor = !this.showVor; vorBtn.classList.toggle("on", this.showVor); this.st.draw(); });
      this.runner = new C.Runner(() => { const target = this.target; const n = Math.min(target - this.i, Math.max(1, Math.ceil((target - this.i) / 20))); for (let j = 0; j < n; j++) this.step(); this.render(); return this.i < target; });
      this.stats = { i: C.stat("迭代 i"), v: C.stat("顶点"), e: C.stat("边"), split: C.stat("最近点落在边内部（分裂边）") };
      this.msg = h("p", { class: "small" });
      const go = (n) => () => { const t = n === "+10" ? this.i + 10 : n; if (this.i > t) this.reset(); this.target = t; this.runner.start(); };
      body.append(h("div", { class: "controls" }, this.segSeq, this.segNear),
        h("div", { class: "controls" }, C.button("单步", () => { this.step(); this.render(); }, "small"), C.button("+10", go("+10"), "small"), C.button("跑到 45 步", go(45), "small"),
          C.button("跑到 2345 步（图 5.19）", go(2345), "small"), C.button("重置", () => this.reset(), "small"), h("div", { class: "chips" }, vorBtn)),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cv("text2"), "树的边"], [C.cv("current"), "α(i)", true], [C.cv("warn"), "最近点 qn", true], [C.cv("ok"), "这一步新加的边"]]))));
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.alpha = C.makeSequence(this.seqKind, this.seed = C.newSeed());
      this.V = [{ x: 0.5, y: 0.5 }]; this.E = []; this.i = 0; this.splits = 0; this.last = null;
      this.render();
    }
    step() {
      const a = this.alpha(); this.i++;
      let best = { d: Infinity };
      if (this.nearMode === "vertex" || this.E.length === 0) {
        this.V.forEach((v, k) => { const d = C.dist(v, a); if (d < best.d) best = { d, vid: k }; });
      } else {
        this.E.forEach((e, k) => {
          const r = C.segPointDist(a, this.V[e[0]], this.V[e[1]]);
          if (r.d < best.d) best = { d: r.d, eid: k, t: r.t };
        });
      }
      let qn;
      if (best.eid !== undefined) {
        const e = this.E[best.eid];
        if (best.t <= 1e-9) qn = e[0]; else if (best.t >= 1 - 1e-9) qn = e[1];
        else {   // 图 5.18：最近点在边内部 → 把边分成两段，插入新顶点
          const p = C.lerp(this.V[e[0]], this.V[e[1]], best.t);
          this.V.push(p); qn = this.V.length - 1;
          this.E.splice(best.eid, 1, [e[0], qn], [qn, e[1]]);
          this.splits++;
        }
      } else qn = best.vid;
      this.V.push(a); this.E.push([qn, this.V.length - 1]);
      this.last = { a, qn: this.V[qn] };
    }
    render() {
      this.stats.i.set(this.i); this.stats.v.set(this.V.length); this.stats.e.set(this.E.length); this.stats.split.set(this.splits);
      const vorOk = this.V.length <= 400;
      this.msg.innerHTML = (this.i < 60 ? "最开始几步就伸出几条长长的主枝，奔向远处的角落：<b>Voronoi 区域越大的顶点，越可能被 α(i) 选中</b>（Voronoi 偏向）。" :
        "主枝之后，越来越短的小枝把空隙填满——分辨率在自动提高，但从来没设过分辨率参数。在极限下树是稠密的。") +
        (this.showVor && !vorOk ? ' <span class="muted">（顶点超过 400 个后不再画 Voronoi 图。）</span>' : "") +
        (this.nearMode === "vertex" ? " 只看顶点时最近点总是顶点，不会分裂边；这就是 5.5.2 节的近似做法（实际实现常再插入中间顶点）。" : "");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.showVor && this.V.length <= 400 && this.V.length > 1) C.drawVoronoi(st, C.nearestField(this.V, 200, "l2", false), this.V.length, col, true);
      ctx.lineCap = "round";
      for (const e of this.E) st.line(this.V[e[0]], this.V[e[1]], col.text2, this.i > 800 ? 0.8 : 1.4);
      if (this.last && this.i < 3000) {
        st.line(this.last.qn, this.last.a, col.ok, 3);
        st.dot(this.last.qn, 5, col.warn, col.surface, 1.5);
        st.dot(this.last.a, 5, col.current, col.surface, 1.5);
      }
      st.dot({ x: 0.5, y: 0.5 }, 5, col.start, col.surface, 1.5);
    }
  }

  // ---------------------------------------------------------------
  // 组件：Kd 树（图 5.23）
  // ---------------------------------------------------------------
  class KdTree {
    constructor(root) {
      this.n = 14; this.seed = 5; this.q = { x: 0.62, y: 0.38 };
      const body = C.frame(root, "Kd 树最近邻", "拖动查询点 q；左：平面划分，右：树");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 440, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: () => "q", onMove: (p) => { this.q = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }; this.query(); }, cursor: () => "crosshair" });
      this.tree = new C.Stage({ view: [0, 1, 0, 0.75], aspect: 0.75, maxW: 440, onDraw: (ctx, st, col) => this.drawTree(ctx, st, col) });
      this.sN = C.slider("点数", 4, 300, 1, this.n, (v) => { this.n = v; this.build(); });
      this.stats = { dc: C.stat("距离计算次数"), naive: C.stat("朴素扫描"), depth: C.stat("树高"), nn: C.stat("最近距离") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sN, C.button("换一组点", () => { this.seed = C.newSeed(); this.build(); }, "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.tree.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg)));
      this.build();
    }
    build() {
      const r = C.rng(this.seed);
      this.P = Array.from({ length: this.n }, (_, i) => ({ x: r(), y: r(), id: i + 1 }));
      let order = 0;
      const mk = (pts, depth, box) => {
        if (!pts.length) return null;
        const axis = depth % 2 === 0 ? "x" : "y";
        pts = pts.slice().sort((a, b) => a[axis] - b[axis]);
        const m = Math.floor((pts.length - 1) / 2);   // 中位数
        const node = { p: pts[m], axis, depth, box };
        const lb = { ...box }, rb = { ...box };
        if (axis === "x") { lb.x1 = pts[m].x; rb.x0 = pts[m].x; } else { lb.y1 = pts[m].y; rb.y0 = pts[m].y; }
        node.l = mk(pts.slice(0, m), depth + 1, lb);
        node.order = order++;
        node.r = mk(pts.slice(m + 1), depth + 1, rb);
        return node;
      };
      this.root = mk(this.P, 0, { x0: 0, x1: 1, y0: 0, y1: 1 });
      const hgt = (n) => (n ? 1 + Math.max(hgt(n.l), hgt(n.r)) : 0);
      this.height = hgt(this.root); this.count = order;
      this.query();
    }
    query() {
      const q = this.q; let best = null, dc = 0; const visited = new Set(), pruned = new Set();
      const boxDist = (b) => Math.hypot(Math.max(b.x0 - q.x, 0, q.x - b.x1), Math.max(b.y0 - q.y, 0, q.y - b.y1));
      const rec = (n) => {
        if (!n) return;
        if (best && boxDist(n.box) >= best.d) { pruned.add(n); return; }   // 整块区域都比当前最近点远 → 剪掉
        visited.add(n); dc++;
        const d = C.dist(q, n.p); if (!best || d < best.d) best = { d, n };
        const goLeft = q[n.axis] < n.p[n.axis];
        rec(goLeft ? n.l : n.r);   // 先下到包含 q 的那一侧
        rec(goLeft ? n.r : n.l);   // 再看另一侧（若它的区域可能更近）
      };
      rec(this.root);
      this.best = best; this.visited = visited; this.pruned = pruned;
      this.stats.dc.set(dc); this.stats.naive.set(this.n); this.stats.depth.set(this.height); this.stats.nn.set(best.d.toFixed(3));
      this.msg.innerHTML = `查询先沿树下降到包含 q 的叶子，再回头检查<b>区域到 q 的距离小于当前最近距离</b>的兄弟子树；其余整棵子树直接剪掉（灰色）。这次只算了 ${dc} 次距离，而朴素扫描要 ${this.n} 次。`;
      this.st.draw(); this.tree.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const walk = (n) => {
        if (!n) return;
        if (this.pruned.has(n)) st.poly(C.rect(n.box.x0, n.box.y0, n.box.x1, n.box.y1), C.alpha(col.muted, 0.16), null);
        const a = Math.max(0.25, 1 - n.depth * 0.15);
        if (n.axis === "x") st.line({ x: n.p.x, y: n.box.y0 }, { x: n.p.x, y: n.box.y1 }, C.alpha(col.accent, a), 1.6 - n.depth * 0.15);
        else st.line({ x: n.box.x0, y: n.p.y }, { x: n.box.x1, y: n.p.y }, C.alpha(col.ok, a), 1.6 - n.depth * 0.15);
        walk(n.l); walk(n.r);
      };
      walk(this.root);
      for (const p of this.P) st.dot(p, 3.5, col.text2);
      const vis = (n) => { if (!n) return; if (this.visited.has(n)) st.dot(n.p, 5, null, col.warn, 2); vis(n.l); vis(n.r); };
      vis(this.root);
      if (this.n <= 30) for (const p of this.P) st.text(String(p.id), p, col.muted, { dx: 9, dy: -8, size: 10 });
      const b = this.best;
      ctx.beginPath(); ctx.arc(st.X(this.q.x), st.Y(this.q.y), b.d * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = C.alpha(col.current, 0.6); ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      st.line(this.q, b.n.p, col.current, 2);
      st.dot(b.n.p, 6, col.current);
      st.dot(this.q, 6, col.surface, col.current, 2.5); st.text("q", this.q, col.current, { dx: 10, dy: 10, weight: 700 });
    }
    drawTree(ctx, st, col) {
      st.frame(col);
      const H = Math.max(1, this.height), N = this.count;
      const pos = (n) => ({ x: (n.order + 0.5) / N, y: 0.75 * (1 - (n.depth + 0.6) / (H + 0.4)) });
      const walk = (n) => {
        if (!n) return; const p = pos(n);
        for (const c of [n.l, n.r]) if (c) st.line(p, pos(c), this.pruned.has(c) ? C.alpha(col.muted, 0.35) : col.strong, 1);
        walk(n.l); walk(n.r);
      };
      walk(this.root);
      const dots = (n) => {
        if (!n) return; const p = pos(n), r = N > 60 ? 2.5 : 4.5;
        const fill = this.best.n === n ? col.current : this.visited.has(n) ? col.warn : this.pruned.has(n) ? C.alpha(col.muted, 0.4) : col.surface;
        st.dot(p, r, fill, n.axis === "x" ? col.accent : col.ok, 1.4);
        if (N <= 30) st.text(String(n.p.id), p, col.text2, { dy: -10, size: 9.5 });
        dots(n.l); dots(n.r);
      };
      dots(this.root);
      st.text("蓝框 = 按 x 切，绿框 = 按 y 切；橙 = 访问过，灰 = 剪掉", { x: 0.5, y: 0.025 }, col.muted, { size: 10.5 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：用 RRT 做规划（5.5.3 节，图 5.21、5.24）
  // ---------------------------------------------------------------
  const DQ = 0.02;   // 中间顶点间距（图 5.22 的近似做法）
  class Tree {
    constructor(root) { this.P = [root]; this.par = [-1]; }
    nearest(q) { let bi = 0, bd = Infinity; const P = this.P; for (let i = 0; i < P.length; i++) { const d = (P[i].x - q.x) ** 2 + (P[i].y - q.y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; }
    // 从顶点 i 连一条线段到 q（中间插点），返回终点的下标
    addPath(i, q) {
      const a = this.P[i], L = C.dist(a, q), n = Math.max(1, Math.ceil(L / DQ));
      let prev = i;
      for (let k = 1; k <= n; k++) { this.P.push(C.lerp(a, q, k / n)); this.par.push(prev); prev = this.P.length - 1; }
      return prev;
    }
    pathTo(i) { const out = []; while (i >= 0) { out.push(this.P[i]); i = this.par[i]; } return out.reverse(); }
  }
  class RRTPlanner {
    constructor(root) {
      this.mapKey = "bugtrap"; this.algo = "bi"; this.bias = 0.01; this.eps = 0; this.speed = 6; this.maxIt = 6000;
      const body = C.frame(root, "RRT 规划器", "拖动 qI、qG；换地图和算法比较");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 540, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.map.qI) < 0.035 ? "qI" : C.dist(p, this.map.qG) < 0.035 ? "qG" : null),
        onMove: (p, d) => { this.map[d] = { x: Math.max(0.01, Math.min(0.99, p.x)), y: Math.max(0.01, Math.min(0.99, p.y)) }; this.reset(); },
        cursor: (p) => (C.dist(p, this.map.qI) < 0.035 || C.dist(p, this.map.qG) < 0.035 ? "grab" : null) });
      this.selMap = C.select(["bugtrap", "double", "narrow", "clutter", "maze", "tube", "empty"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.map = C.makeMap(k); this.reset(); });
      this.selAlgo = C.select([["single", "单树 RRT + 目标偏置"], ["bi", "平衡双向（按正文：总是扩展较小的树）"], ["literal", "双向，按图 5.24 第 14 行字面"], ["unbal", "不平衡双向（每轮交换）"]], this.algo, (k) => { this.algo = k; this.syncUI(); this.reset(); });
      this.sBias = C.slider("目标偏置概率", 0, 0.3, 0.01, this.bias, (v) => { this.bias = v; }, (v) => v.toFixed(2));
      this.sEps = C.slider("步长 ε", 0, 0.2, 0.01, this.eps, (v) => { this.eps = v; }, (v) => (v === 0 ? "∞（连到 α 或障碍）" : v.toFixed(2)));
      this.sSpeed = C.slider("速度", 1, 60, 1, this.speed, (v) => { this.speed = v; });
      this.runner = new C.Runner(() => { for (let i = 0; i < this.speed; i++) if (!this.step()) { this.render(); return false; } this.render(); return true; });
      this.stats = { it: C.stat("迭代"), na: C.stat("qI 树顶点"), nb: C.stat("qG 树顶点"), chk: C.stat("碰撞检测"), res: C.stat("结果"), len: C.stat("路径长度") };
      this.batchOut = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selMap, this.selAlgo),
        h("div", { class: "controls" }, this.sBias, this.sEps, this.sSpeed),
        h("div", { class: "controls" }, C.button("▶ 运行", () => { if (this.done) this.reset(); this.runner.start(); }, "small primary"), C.button("暂停", () => this.runner.stop(), "small"),
          C.button("单步", () => { this.step(); this.render(); }, "small"), C.button("重置", () => this.reset(), "small"), C.button("批量跑 20 次", () => this.batch(), "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.batchOut,
          C.legend([[C.cv("accent"), "从 qI 长出的树"], [C.cv("alive2"), "从 qG 长出的树"], [C.cv("current"), "α(i)", true], [C.cv("path"), "解"]]))));
      this.map = C.makeMap(this.mapKey);
      this.syncUI(); this.reset();
    }
    syncUI() { this.sBias.classList.toggle("hidden", this.algo !== "single"); }
    reset(seed) {
      this.runner && this.runner.stop();
      this.r = C.rng(seed || C.newSeed());
      this.map.obs.checks = 0;
      this.TI = new Tree({ ...this.map.qI }); this.TG = new Tree({ ...this.map.qG });
      this.Ta = this.TI; this.Tb = this.algo === "single" ? null : this.TG;
      this.iter = 0; this.done = false; this.path = null; this.lastA = null;
      if (!seed) this.render();
    }
    // stopping-configuration：从 qn 沿直线朝 q 走，碰到障碍前停下（留一点余量）
    stopping(qn, q) {
      if (this.eps > 0) { const d = C.dist(qn, q); if (d > this.eps) q = C.lerp(qn, q, this.eps / d); }
      const t = this.map.obs.firstHit(qn, q), L = C.dist(qn, q);
      if (t >= 1) return { q, full: true };
      const back = Math.max(0, t * L - 0.004);
      if (back < 1e-4) return null;
      return { q: C.lerp(qn, q, back / L), full: false };
    }
    step() {
      if (this.done) return false;
      if (this.iter >= this.maxIt) { this.done = true; return false; }
      this.iter++;
      const r = this.r;
      if (this.algo === "single") {
        const goal = r() < this.bias;
        const a = goal ? { ...this.map.qG } : { x: r(), y: r() };
        this.lastA = a;
        const ni = this.Ta.nearest(a), qn = this.Ta.P[ni];
        const s = this.stopping(qn, a); if (!s) return true;
        const vi = this.Ta.addPath(ni, s.q);
        if (C.dist(s.q, this.map.qG) < 1e-9 || (C.dist(s.q, this.map.qG) < 0.03 && this.map.obs.segFree(s.q, this.map.qG))) {
          const vg = this.Ta.addPath(vi, this.map.qG);
          this.path = this.Ta.pathTo(vg); this.done = true; return false;
        }
        return true;
      }
      // 双向（图 5.24）
      const a = { x: r(), y: r() }; this.lastA = a;
      const Ta = this.Ta, Tb = this.Tb;
      const ni = Ta.nearest(a), s = this.stopping(Ta.P[ni], a);
      if (s) {
        const vi = Ta.addPath(ni, s.q);
        const qs = Ta.P[vi];
        const nj = Tb.nearest(qs), s2 = this.stopping(Tb.P[nj], qs);
        if (s2) {
          const vj = Tb.addPath(nj, s2.q);
          if (s2.full && (this.eps === 0 || C.dist(s2.q, qs) < 1e-9)) {   // q's = qs：两棵树连上了
            const pa = Ta.pathTo(vi), pb = Tb.pathTo(vj).reverse();
            const P = pa.concat(pb.slice(1));
            this.path = Ta === this.TI ? P : P.reverse();
            this.done = true; return false;
          }
        }
      }
      // 第 14 行
      if (this.algo === "bi") { if (this.Ta.P.length > this.Tb.P.length) [this.Ta, this.Tb] = [this.Tb, this.Ta]; }
      else if (this.algo === "literal") { if (this.Tb.P.length > this.Ta.P.length) [this.Ta, this.Tb] = [this.Tb, this.Ta]; }
      else [this.Ta, this.Tb] = [this.Tb, this.Ta];
      return true;
    }
    pathLen(P) { return P ? P.reduce((s, q, i) => (i ? s + C.dist(P[i - 1], q) : 0), 0) : 0; }
    render() {
      this.stats.it.set(this.iter); this.stats.na.set(this.TI.P.length); this.stats.nb.set(this.algo === "single" ? "—" : this.TG.P.length);
      this.stats.chk.set(this.map.obs.checks);
      this.stats.res.set(this.path ? '<span class="yes">找到</span>' : this.done ? '<span class="no">到上限</span>' : "…");
      this.stats.len.set(this.path ? this.pathLen(this.path).toFixed(3) : "—");
      this.st.draw();
    }
    batch() {
      this.runner.stop();
      const runs = 20, its = [];
      let k = 0;
      this.batchOut.textContent = "运行中…";
      const one = () => {
        this.reset(1000 + k * 7919);
        while (this.step());
        its.push(this.path ? this.iter : Infinity);
        k++;
        if (k < runs) { this.batchOut.textContent = `运行中… ${k}/${runs}`; setTimeout(one, 0); return; }
        const ok = its.filter((x) => x < Infinity).sort((a, b) => a - b);
        const med = its.slice().sort((a, b) => a - b)[Math.floor(runs / 2)];
        this.batchOut.innerHTML = `<b>${this.selAlgo.selectedOptions[0].textContent}</b> · ${this.map.name}：成功 ${ok.length}/${runs}（上限 ${this.maxIt} 次迭代），迭代次数中位数 ${med === Infinity ? "∞" : med}` +
          (ok.length ? `，最少 ${ok[0]}、最多 ${ok[ok.length - 1]}` : "") + "。";
        this.render();
      };
      setTimeout(one, 0);
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.obstacles(this.map.obs, col);
      const drawTree = (T, c) => { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < T.P.length; i++) { const a = T.P[T.par[i]], b = T.P[i]; ctx.moveTo(st.X(a.x), st.Y(a.y)); ctx.lineTo(st.X(b.x), st.Y(b.y)); } ctx.stroke(); };
      drawTree(this.TI, C.alpha(col.accent, 0.85));
      if (this.algo !== "single") drawTree(this.TG, C.alpha(col.alive2, 0.9));
      if (this.lastA && !this.done) st.dot(this.lastA, 4, col.current);
      if (this.path) for (let i = 1; i < this.path.length; i++) st.line(this.path[i - 1], this.path[i], col.path, 3);
      st.qmark(this.map.qI, "I", col); st.qmark(this.map.qG, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='rdt-explore']").forEach((el) => el._w = new RDTExplore(el));
    document.querySelectorAll("[data-widget='kdtree']").forEach((el) => el._w = new KdTree(el));
    document.querySelectorAll("[data-widget='rrt-planner']").forEach((el) => el._w = new RRTPlanner(el));
  });
})();
