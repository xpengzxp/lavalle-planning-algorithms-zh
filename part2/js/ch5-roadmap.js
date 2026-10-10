/* 5.6 节：基于采样的路线图（PRM，图 5.25）、可见性路线图（图 5.28）、改进路线图的采样启发式（图 5.29、5.30） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH5;

  // ---------------------------------------------------------------
  // 采样策略：每次调用 try() 做一次尝试，返回 {q} 表示得到一个保留的样本，或 null；附带 aux 方便画图
  // ---------------------------------------------------------------
  const STRATS = {
    uniform: "均匀随机",
    halton: "Halton（确定性）",
    boundary: "边界采样（图 5.29a）",
    gaussian: "高斯采样",
    bridge: "桥测试（图 5.29b）",
    medial: "中轴采样（图 5.30）",
  };
  function makeSampler(kind, obs, r, sigma) {
    let hi = 1;
    const uni = () => ({ x: r(), y: r() });
    const free = (q) => obs.pointFree(q);
    switch (kind) {
      case "halton": return () => { const q = { x: C.radInv(hi, 2), y: C.radInv(hi++, 3) }; return free(q) ? { q } : null; };
      case "uniform": return () => { const q = uni(); return free(q) ? { q } : null; };
      case "gaussian": return () => {
        const q1 = uni(), q2 = { x: q1.x + sigma * C.gauss(r), y: q1.y + sigma * C.gauss(r) };
        const f1 = free(q1), f2 = free(q2);
        if (f1 !== f2) return { q: f1 ? q1 : q2, aux: { kind: "pair", a: q1, b: q2 } };
        return null;
      };
      case "bridge": return () => {
        const q1 = uni(); if (free(q1)) return null;
        const q2 = { x: q1.x + sigma * C.gauss(r), y: q1.y + sigma * C.gauss(r) }; if (free(q2)) return null;
        const m = C.lerp(q1, q2, 0.5);
        return free(m) ? { q: m, aux: { kind: "bridge", a: q1, b: q2 } } : null;
      };
      case "boundary": return () => {
        const q0 = uni(); if (free(q0)) return null;
        const th = 2 * Math.PI * r(), d = { x: Math.cos(th), y: Math.sin(th) };
        let far = null;
        for (let s = 0.01; s <= 0.6; s += 0.01) { const q = { x: q0.x + d.x * s, y: q0.y + d.y * s }; if (q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) break; if (free(q)) { far = s; break; } }
        if (far === null) return null;
        // τ(0) ∈ Cobs，τ(1) ∈ Cfree，二分找边界
        let lo = 0, hi2 = far; const order = [];
        for (let it = 0; it < 6; it++) { const mid = (lo + hi2) / 2, q = { x: q0.x + d.x * mid, y: q0.y + d.y * mid }; order.push(q); if (free(q)) hi2 = mid; else lo = mid; }
        return { q: { x: q0.x + d.x * hi2, y: q0.y + d.y * hi2 }, aux: { kind: "binary", a: q0, b: { x: q0.x + d.x * far, y: q0.y + d.y * far }, order } };
      };
      case "medial": return () => {
        let q = uni(); if (!free(q)) return null;
        let c = obs.clearance(q); const trail = [q];
        for (let fails = 0, it = 0; fails < 25 && it < 300; it++) {
          const th = 2 * Math.PI * r(), step = 0.012;
          const q2 = { x: q.x + step * Math.cos(th), y: q.y + step * Math.sin(th) };
          const c2 = obs.clearance(q2);
          if (c2 > c) { q = q2; c = c2; trail.push(q); fails = 0; } else fails++;
        }
        return { q, aux: { kind: "trail", trail } };
      };
    }
  }
  const COMP_COLORS = ["accent", "ok", "warn", "alive2", "bad", "start", "goal", "dead"];

  // ---------------------------------------------------------------
  // 组件：基于采样的路线图 PRM（图 5.25、5.26）
  // ---------------------------------------------------------------
  class PRM {
    constructor(root) {
      this.mapKey = "narrow"; this.N = 120; this.nbKind = "knear"; this.K = 10; this.radius = 0.15; this.sameComp = true; this.strat = "uniform"; this.speed = 3;
      const body = C.frame(root, "基于采样的路线图（PRM）", "先建图（预处理），再回答任意多次查询；拖动 qI、qG 就是一次新查询");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 540, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.map.qI) < 0.035 ? "qI" : C.dist(p, this.map.qG) < 0.035 ? "qG" : null),
        onMove: (p, d) => { this.map[d] = { x: Math.max(0.01, Math.min(0.99, p.x)), y: Math.max(0.01, Math.min(0.99, p.y)) }; this.query(); this.render(); },
        cursor: (p) => (C.dist(p, this.map.qI) < 0.035 || C.dist(p, this.map.qG) < 0.035 ? "grab" : null) });
      this.selMap = C.select(["narrow", "tube", "clutter", "maze", "bugtrap"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.map = C.makeMap(k); this.rebuild(); });
      this.selNb = C.select([["knear", "最近 K 个（Nearest K）"], ["compk", "每个分量最近 K 个（Component K）"], ["radius", "半径 r 内（Radius）"], ["all", "全部顶点（Visibility）"]], this.nbKind, (k) => { this.nbKind = k; this.syncUI(); this.rebuild(); });
      this.selS = C.select(Object.entries(STRATS), this.strat, (k) => { this.strat = k; this.rebuild(); });
      this.sN = C.slider("顶点数 N", 10, 600, 10, this.N, (v) => { this.N = v; this.rebuild(); });
      this.sK = C.slider("K", 1, 30, 1, this.K, (v) => { this.K = v; this.rebuild(); });
      this.sR = C.slider("r", 0.03, 0.4, 0.01, this.radius, (v) => { this.radius = v; this.rebuild(); }, (v) => v.toFixed(2));
      const cb = h("input", { type: "checkbox", checked: true });
      cb.addEventListener("change", () => { this.sameComp = cb.checked; this.rebuild(); });
      this.sSpeed = C.slider("速度", 1, 30, 1, this.speed, (v) => { this.speed = v; });
      this.runner = new C.Runner(() => { for (let i = 0; i < this.speed; i++) if (!this.addOne()) { this.query(); this.render(); return false; } this.render(); return true; });
      this.stats = { v: C.stat("顶点"), e: C.stat("边"), comp: C.stat("连通分量"), tries: C.stat("抽样次数（含丢弃）"), conn: C.stat("connect 调用"), q: C.stat("查询") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selMap, this.selS, this.selNb),
        h("div", { class: "controls" }, this.sN, this.sK, this.sR, h("label", { title: "图 5.25 第 6 行" }, cb, "跳过同一分量（same_component）")),
        h("div", { class: "controls" }, C.button("▶ 逐个加点", () => { if (this.V.length >= this.N) this.reset(); this.runner.start(); }, "small primary"), C.button("一次建完", () => { this.runner.stop(); while (this.addOne()); this.query(); this.render(); }, "small"),
          C.button("清空", () => this.reset(), "small"), C.button("换种子重建", () => { this.seed = C.newSeed(); this.rebuild(); }, "small"), this.sSpeed),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg)));
      this.map = C.makeMap(this.mapKey);
      this.syncUI(); this.reset(); this.rebuild();   // 先同步初始化空图，避免画布首次绘制时数据还不存在
    }
    // 改参数后用同一个随机种子重建，方便对比
    rebuild() {
      if (this.pending) return; this.pending = true;
      setTimeout(() => { this.pending = false; this.reset(this.seed); while (this.addOne()); this.query(); this.render(); }, 0);
    }
    syncUI() { this.sK.classList.toggle("hidden", this.nbKind === "all"); this.sR.classList.toggle("hidden", this.nbKind !== "radius"); }
    reset(seed) {
      this.runner && this.runner.stop();
      this.seed = seed || C.newSeed();
      this.r = C.rng(this.seed);
      this.map.obs.checks = 0;
      this.sampler = makeSampler(this.strat, this.map.obs, this.r, 0.05);
      this.V = []; this.E = []; this.adj = []; this.uf = new C.UnionFind(); this.tries = 0; this.conns = 0; this.qres = null; this.last = null;
      this.render();
    }
    neighborhood(q, V) {
      const idx = V.map((_, i) => i).sort((a, b) => C.dist(q, V[a]) - C.dist(q, V[b]));   // 按距离递增（书中建议）
      if (this.nbKind === "knear") return idx.slice(0, this.K);
      if (this.nbKind === "radius") return idx.filter((i) => C.dist(q, V[i]) <= this.radius).slice(0, 20);
      if (this.nbKind === "all") return idx;
      const per = new Map(), out = [];
      for (const i of idx) { const c = this.uf.find(i); const n = per.get(c) || 0; if (n < this.K) { per.set(c, n + 1); out.push(i); } }
      return out;
    }
    connect(a, b) { this.conns++; return this.map.obs.firstHit(a, b) >= 1; }
    addOne() {
      if (this.V.length >= this.N) return false;
      let s = null, guard = 0;
      while (!s && guard++ < 5000) { this.tries++; s = this.sampler(); }
      if (!s) return false;
      const q = s.q, nbs = this.neighborhood(q, this.V);
      const id = this.V.length; this.V.push(q); this.adj.push([]); this.uf.add();
      for (const j of nbs) {
        if (this.sameComp && this.uf.same(id, j)) continue;
        if (this.connect(q, this.V[j])) { this.E.push([id, j]); this.adj[id].push(j); this.adj[j].push(id); this.uf.union(id, j); }
      }
      this.last = q;
      return true;
    }
    query() {
      // 查询阶段：像从 α 里抽到 qI、qG 一样，把它们连进图，然后做 Dijkstra
      const V = this.V; if (!V.length) { this.qres = null; return; }
      const link = (q) => this.neighborhood(q, V).filter((j) => this.map.obs.firstHit(q, V[j]) >= 1 && this.map.obs.pointFreeQuiet(q));
      const LI = link(this.map.qI), LG = link(this.map.qG);
      const n = V.length, I = n, G = n + 1, P = (i) => (i === I ? this.map.qI : i === G ? this.map.qG : V[i]);
      const adj = (i) => (i === I ? LI : i === G ? [] : this.adj[i].concat(LG.includes(i) ? [G] : []));
      const dist = new Map([[I, 0]]), par = new Map(), done = new Set();
      for (;;) {
        let u = -1, bd = Infinity;
        for (const [k, d] of dist) if (!done.has(k) && d < bd) { bd = d; u = k; }
        if (u < 0 || u === G) break;
        done.add(u);
        for (const v of adj(u)) { const nd = bd + C.dist(P(u), P(v)); if (nd < (dist.has(v) ? dist.get(v) : Infinity)) { dist.set(v, nd); par.set(v, u); } }
      }
      if (dist.has(G)) { const path = []; let c = G; while (c !== undefined) { path.push(P(c)); c = par.get(c); } this.qres = { ok: true, path: path.reverse(), len: dist.get(G), LI, LG }; }
      else this.qres = { ok: false, LI, LG };
    }
    render() {
      const comps = new Set(this.V.map((_, i) => this.uf.find(i)));
      this.stats.v.set(this.V.length); this.stats.e.set(this.E.length); this.stats.comp.set(comps.size);
      this.stats.tries.set(this.tries); this.stats.conn.set(this.conns);
      this.stats.q.set(!this.qres ? "—" : this.qres.ok ? `<span class="yes">长 ${this.qres.len.toFixed(3)}</span>` : !this.qres.LI.length || !this.qres.LG.length ? '<span class="no">连不进图</span>' : '<span class="no">不在同一分量</span>');
      // 分量大小排序，给颜色
      const size = new Map(); this.V.forEach((_, i) => { const c = this.uf.find(i); size.set(c, (size.get(c) || 0) + 1); });
      this.compColor = new Map([...size.entries()].sort((a, b) => b[1] - a[1]).map(([c], k) => [c, COMP_COLORS[k % COMP_COLORS.length]]));
      const narrow = this.mapKey === "narrow" ? this.V.filter((q) => q.x > 0.44 && q.x < 0.56 && q.y > 0.47 && q.y < 0.51).length : null;
      this.msg.innerHTML = (narrow !== null ? `落在窄通道附近的顶点：<b>${narrow}</b> 个。` : "") +
        (this.qres && !this.qres.ok ? " 查询失败并不能说明无解——也许只是样本还不够多（尤其是窄通道）。" : "") +
        (this.sameComp ? " 打开 same_component 时，每条新边都会让分量数减 1，所以路线图是一片森林（没有环）。" : " 关掉 same_component 后会出现环，可以得到不同同伦类的路径，但 connect 调用多得多。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.obstacles(this.map.obs, col);
      if (!this.V || !this.compColor) return;
      for (const [a, b] of this.E) st.line(this.V[a], this.V[b], C.alpha(col[this.compColor.get(this.uf.find(a))] || col.accent, 0.55), 1.2);
      this.V.forEach((q, i) => st.dot(q, 3, col[this.compColor.get(this.uf.find(i))] || col.accent));
      if (this.qres) {
        for (const j of this.qres.LI) st.line(this.map.qI, this.V[j], C.alpha(col.start, 0.6), 1, [3, 3]);
        for (const j of this.qres.LG) st.line(this.map.qG, this.V[j], C.alpha(col.goal, 0.6), 1, [3, 3]);
        if (this.qres.ok) for (let i = 1; i < this.qres.path.length; i++) st.line(this.qres.path[i - 1], this.qres.path[i], col.path, 3.2);
      }
      if (this.last && this.runner.running) st.dot(this.last, 6, null, col.current, 2);
      st.qmark(this.map.qI, "I", col); st.qmark(this.map.qG, "G", col);
    }
  }

  // ---------------------------------------------------------------
  // 可见区域 V(q)（直线 LPM 能连到的点）：用射线近似成多边形
  // ---------------------------------------------------------------
  function visPoly(q, obs, rays = 240) {
    const P = [];
    for (let k = 0; k < rays; k++) {
      const th = (k / rays) * 2 * Math.PI, far = { x: q.x + 2 * Math.cos(th), y: q.y + 2 * Math.sin(th) };
      const c = obs.checks; const t = obs.firstHit(q, far); obs.checks = c;
      P.push(C.lerp(q, far, t));
    }
    return P;
  }

  // ---------------------------------------------------------------
  // 组件：可见性路线图（图 5.28）与 ε-goodness（式 5.41）
  // ---------------------------------------------------------------
  class VisibilityRoadmap {
    constructor(root) {
      this.mapKey = "clutter"; this.hover = null;
      const body = C.frame(root, "可见性路线图", "守卫 guard（实心点）互相看不见；连接点 connector（空心点）至少看见两个不同分量的守卫");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 540, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { this.hover = this.map.obs.pointFreeQuiet(p) ? p : null; this.hoverInfo(); this.st.draw(); },
        onLeave: () => { this.hover = null; this.hoverInfo(); this.st.draw(); } });
      this.selMap = C.select(["clutter", "narrow", "maze", "tube"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.map = C.makeMap(k); this.freeA = this.map.obs.freeArea(); this.reset(); });
      this.runner = new C.Runner(() => { this.tick = (this.tick || 0) + 1; if (this.tick % 4) return true; this.addOne(); this.render(); return this.tried < 600; });
      this.stats = { tried: C.stat("已考虑的样本"), g: C.stat("守卫"), c: C.stat("连接点"), d: C.stat("丢弃"), comp: C.stat("连通分量") };
      this.last = h("div", { class: "status-line" });
      this.hv = h("div", { class: "small" });
      this.epsOut = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selMap, C.button("单个样本", () => { this.addOne(); this.render(); }, "small"), C.button("▶ 播放", () => this.runner.start(), "small primary"),
        C.button("暂停", () => this.runner.stop(), "small"), C.button("+100", () => { for (let i = 0; i < 100; i++) this.addOne(); this.render(); }, "small"), C.button("重置", () => this.reset(), "small"),
        C.button("估计 ε-goodness", () => this.estimateEps(), "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.last, this.hv, this.epsOut)));
      this.map = C.makeMap(this.mapKey); this.freeA = this.map.obs.freeArea();
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.r = C.rng(C.newSeed());
      this.G = []; this.E = []; this.uf = new C.UnionFind(); this.tried = 0; this.nd = 0; this.lastS = null; this.worst = null;
      this.epsOut.innerHTML = "";
      this.render();
    }
    addOne() {
      let q; do { q = { x: this.r(), y: this.r() }; } while (!this.map.obs.pointFreeQuiet(q));
      this.tried++;
      const guards = this.G.map((v, i) => i).filter((i) => this.G[i].type === "guard" && this.map.obs.firstHit(q, this.G[i].q) >= 1);
      const byComp = new Map(); for (const i of guards) { const c = this.uf.find(i); if (!byComp.has(c)) byComp.set(c, i); }
      let kind;
      if (!guards.length) { this.G.push({ q, type: "guard" }); this.uf.add(); kind = "guard"; }
      else if (byComp.size >= 2) {
        const id = this.G.length; this.G.push({ q, type: "conn" }); this.uf.add();
        for (const i of byComp.values()) { this.E.push([id, i]); this.uf.union(id, i); }
        kind = "conn";
      } else { this.nd++; kind = "drop"; }
      this.lastS = { q, kind, sees: guards };
    }
    render() {
      const ng = this.G.filter((v) => v.type === "guard").length;
      this.stats.tried.set(this.tried); this.stats.g.set(ng); this.stats.c.set(this.G.length - ng); this.stats.d.set(this.nd);
      this.stats.comp.set(new Set(this.G.map((_, i) => this.uf.find(i))).size);
      const L = this.lastS;
      this.last.innerHTML = !L ? "点「单个样本」开始。" : L.kind === "guard" ? "情形 1：看不见任何守卫 → <b>成为新守卫</b>。" : L.kind === "conn" ? `情形 2：看见 ${L.sees.length} 个守卫，分属至少两个分量 → <b>成为连接点</b>，把它们连起来。` : `情形 3：只看见同一分量的守卫 → <b>丢弃</b>。`;
      this.st.draw();
    }
    hoverInfo() {
      if (!this.hover) { this.hv.innerHTML = '<span class="muted">把鼠标移到自由空间里：显示可见区域 V(q) 和它占 Cfree 的比例。</span>'; return; }
      const P = visPoly(this.hover, this.map.obs, 180);
      this.hv.innerHTML = `μ(V(q)) / μ(Cfree) ≈ <b>${((C.polyArea(P) / this.freeA) * 100).toFixed(1)}%</b>`;
    }
    estimateEps() {
      let worst = null; const r = C.rng(99);
      for (let k = 0; k < 400; k++) {
        const q = { x: r(), y: r() }; if (!this.map.obs.pointFreeQuiet(q)) continue;
        const f = C.polyArea(visPoly(q, this.map.obs, 120)) / this.freeA;
        if (!worst || f < worst.f) worst = { q, f };
      }
      this.worst = worst;
      this.epsOut.innerHTML = `随机试了 400 个点，最小的可见比例 ≈ <b>${(worst.f * 100).toFixed(1)}%</b>（红点）。式 (5.41) 的 ε 是对<b>所有</b> q 取最小，所以真实的 ε 只会更小；这也是书中说它「非常保守、又算不出来」的原因。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.hover) st.poly(visPoly(this.hover, this.map.obs, 240), C.alpha(col.warn, 0.18), C.alpha(col.warn, 0.6), 1);
      if (this.worst) st.poly(visPoly(this.worst.q, this.map.obs, 240), C.alpha(col.bad, 0.12), C.alpha(col.bad, 0.5), 1);
      st.obstacles(this.map.obs, col);
      for (const [a, b] of this.E) st.line(this.G[a].q, this.G[b].q, C.alpha(col.accent, 0.8), 1.6);
      const L = this.lastS;
      if (L) for (const i of L.sees) st.line(L.q, this.G[i].q, C.alpha(col.current, 0.7), 1, [4, 3]);
      for (const v of this.G) {
        if (v.type === "guard") st.dot(v.q, 5.5, col.text, col.surface, 1.5);
        else st.dot(v.q, 5, col.surface, col.text, 2);
      }
      if (L && L.kind === "drop") st.dot(L.q, 4, col.muted);
      if (L) st.dot(L.q, 8, null, col.current, 2);
      if (this.worst) st.dot(this.worst.q, 5, col.bad);
      if (this.hover) st.dot(this.hover, 4, col.warn);
    }
  }

  // ---------------------------------------------------------------
  // 组件：改进路线图的采样启发式（5.6.3 节）
  // ---------------------------------------------------------------
  class SamplingHeuristics {
    constructor(root) {
      this.mapKey = "narrow"; this.strat = "bridge"; this.n = 150; this.sigma = 0.05;
      const body = C.frame(root, "把样本放到「有用」的地方", "同样保留 n 个样本，看它们落在哪里、花了多少次尝试");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.selMap = C.select(["narrow", "clutter", "tube", "maze"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.gen(); });
      this.selS = C.select(Object.entries(STRATS).filter(([k]) => k !== "halton"), this.strat, (k) => { this.strat = k; this.gen(); });
      this.sN = C.slider("保留样本数", 20, 400, 10, this.n, (v) => { this.n = v; this.gen(); });
      this.sSig = C.slider("σ", 0.01, 0.15, 0.005, this.sigma, (v) => { this.sigma = v; this.gen(); }, (v) => v.toFixed(3));
      this.stats = { kept: C.stat("保留"), tries: C.stat("尝试次数"), chk: C.stat("点碰撞检测"), nar: C.stat("窄通道里") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selMap, this.selS, C.button("重新采样", () => this.gen(), "small")), h("div", { class: "controls" }, this.sN, this.sSig),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg)));
      this.gen();
    }
    gen() {
      this.map = C.makeMap(this.mapKey);
      const obs = this.map.obs; obs.checks = 0;
      const smp = makeSampler(this.strat, obs, C.rng(C.newSeed()), this.sigma);
      this.S = []; let tries = 0; this.auxList = [];
      while (this.S.length < this.n && tries < 200000) { tries++; const s = smp(); if (s) { this.S.push(s.q); if (s.aux) this.auxList.push(s.aux); } }
      this.sSig.classList.toggle("hidden", !(this.strat === "gaussian" || this.strat === "bridge"));
      this.stats.kept.set(this.S.length); this.stats.tries.set(tries); this.stats.chk.set(obs.checks);
      this.stats.nar.set(this.mapKey === "narrow" ? this.S.filter((q) => q.x > 0.46 && q.x < 0.54 && q.y > 0.475 && q.y < 0.505).length : "—");
      const notes = {
        uniform: "均匀采样：样本大多落在大片空地里，窄通道（面积很小）几乎抽不到。",
        boundary: "每个落进 Cobs 的样本沿随机方向往外走到 Cfree，再在 τ(0)∈Cobs 与 τ(1)∈Cfree 之间二分（图 5.29a 的 1、2、3、4 顺序），得到紧贴 ∂Cfree 的样本。",
        gaussian: "先均匀取 q₁，再以 q₁ 为均值、σ 为标准差取 q₂；恰好一个在 Cfree 时保留它。样本被「轻轻地」吸向边界，σ 越小越贴边。",
        bridge: "两端都在 Cobs、中点在 Cfree 才保留中点（图 5.29b）。窄通道至少在一个方向上很薄，所以这里特别容易通过测试——看看窄通道里的样本数！",
        medial: "从自由样本出发，反复做随机小扰动，只接受让到 ∂Cfree 的距离变大的那一步。样本被推向中轴（图 5.30 中最大内切球圆心的轨迹）。",
      };
      this.msg.innerHTML = notes[this.strat];
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.obstacles(this.map.obs, col);
      const show = this.auxList.slice(-4);
      for (const a of show) {
        if (a.kind === "pair" || a.kind === "bridge") { st.line(a.a, a.b, C.alpha(col.alive2, 0.8), 1.2, [3, 3]); st.dot(a.a, 3, col.alive2); st.dot(a.b, 3, col.alive2); }
        if (a.kind === "binary") { st.line(a.a, a.b, C.alpha(col.alive2, 0.8), 1.2); a.order.slice(0, 4).forEach((q, i) => { st.dot(q, 2.5, col.alive2); st.text(String(i + 1), q, col.alive2, { dx: 7, dy: -7, size: 10 }); }); }
        if (a.kind === "trail") { for (let i = 1; i < a.trail.length; i++) st.line(a.trail[i - 1], a.trail[i], C.alpha(col.alive2, 0.8), 1.2); st.dot(a.trail[0], 3, col.alive2); }
      }
      for (const q of this.S) st.dot(q, 3, col.accent);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='prm']").forEach((el) => el._w = new PRM(el));
    document.querySelectorAll("[data-widget='visibility-roadmap']").forEach((el) => el._w = new VisibilityRoadmap(el));
    document.querySelectorAll("[data-widget='sampling-heuristics']").forEach((el) => el._w = new SamplingHeuristics(el));
  });
})();
