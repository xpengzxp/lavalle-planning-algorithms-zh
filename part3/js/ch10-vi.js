/* 10.2 节：值迭代实验室（图 10.1）、例 10.6 的循环与渐近收敛（图 10.3）、例 10.7 的策略迭代（图 10.5）、
   反向投影算法与非确定 Dijkstra（图 10.6、10.8） */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH10;
  const INF = Infinity;

  // ---------------------------------------------------------------
  // 组件：值迭代实验室（10.2.1 节，例 10.2 的网格）
  // ---------------------------------------------------------------
  class VILab {
    constructor(root) {
      this.grid = C.fig101Grid(); this.xI = this.grid.id(0, 0);
      this.natureKind = "ex102"; this.slip = 0.2; this.kind = "exp"; this.lF = 100; this.trajs = []; this.simMean = null;
      const body = C.frame(root, "值迭代实验室", "式 (10.39) 最坏情况 / (10.46) 期望；箭头是用 (10.48)/(10.49) 从代价到目标恢复的动作");
      this.st = new C.Stage({ view: [0, 15, 0, 15], maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const id = C.cellAt(this.grid, p); if (id >= 0 && this.grid.free(id) && !this.grid.isGoal(id)) { this.xI = id; this.trajs = []; this.simMean = null; this.render(); } return null; },
        cursor: () => "pointer" });
      this.segN = C.seg([["none", "无自然"], ["ex102", "例 10.2 的自然"], ["slip", "侧滑（补充）"]], this.natureKind, (k) => { this.natureKind = k; this.sSlip.style.display = k === "slip" ? "" : "none"; this.reset(); });
      this.sSlip = C.slider("横滑概率", 0.05, 0.8, 0.05, this.slip, (v) => { this.slip = v; this.reset(); }, (v) => v.toFixed(2));
      this.sSlip.style.display = "none";
      this.segK = C.seg([["worst", "最坏情况 (10.39)"], ["exp", "期望 (10.46)"]], this.kind, (k) => {
        this.kind = k;
        // 最坏情况下若 l_F 有限，「在目标外直接终止」会变成一个合法选择，把所有 ∞ 掩盖掉；所以固定用 ∞
        if (k === "worst") { this.lF = INF; this.selF.value = "inf"; this.selF.disabled = true; }
        else { this.selF.disabled = false; this.lF = this.selF.value === "inf" ? INF : 100; }
        this.reset();
      });
      this.selF = C.select([["inf", "非目标的 l_F = ∞（式 10.9）"], ["100", "非目标的 l_F = 100（大的有限值）"]], "100", (v) => { this.lF = v === "inf" ? INF : 100; this.reset(); });
      this.runner = new C.Runner(() => { const more = this.iterate(); this.render(); return more; }, () => this.render());
      this.stats = { it: C.stat("迭代次数"), ch: C.stat("最大变化"), g: C.stat("G*(x_I)"), sim: C.stat("模拟 20 次的平均阶段数") };
      this.msg = h("div", { class: "small", style: "min-height:2.6em" });
      this.chart = h("div", { class: "svg-wrap" });
      body.append(h("div", { class: "controls" }, this.segN, this.sSlip), h("div", { class: "controls" }, this.segK, this.selF),
        h("div", { class: "controls" }, C.button("迭代一次", () => { this.iterate(); this.render(); }, "small"),
          C.button("运行到收敛", () => this.runner.start(), "small primary"), C.button("重置", () => this.reset(), "small"),
          h("span", { class: "sep" }), C.button("从 x_I 模拟 20 次执行", () => this.simulate(), "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg, this.chart,
          C.legend([[C.cva("accent", 0.6), "代价到目标（越深越大）"], [C.cv("badSoft"), "∞"], [C.cva("ok", 0.3), "X_G（u_T，代价 0）"], [C.cv("path"), "模拟的执行轨迹"]]),
          h("p", { class: "small muted", style: "margin:4px 0 0" }, "点任意自由格子把它设为 x_I。"))));
      this.reset();
    }
    get model() { return this.natureKind === "slip" ? { kind: "slip", p: this.slip } : { kind: this.natureKind }; }
    reset() {
      this.runner.stop();
      this.cache = C.succCache(this.grid, this.model);
      this.G = new Float64Array(this.grid.N).fill(INF);
      for (let x = 0; x < this.grid.N; x++) if (this.grid.free(x)) this.G[x] = this.grid.isGoal(x) ? 0 : this.lF;
      this.it = 0; this.changes = []; this.done = false; this.trajs = []; this.simMean = null;
      this.render();
    }
    iterate() {
      if (this.done) return false;
      const r = C.viSweep(this.grid, this.G, this.model, this.kind, this.lF, true, this.cache);
      this.G = r.G; this.it++; this.changes.push(r.change);
      const tol = this.kind === "worst" ? 0 : 1e-6;
      if ((r.change <= tol && this.it > 1) || this.it >= 400) this.done = true;
      return !this.done;
    }
    policy(x) { return C.greedy(this.grid, this.G, this.model, this.kind, x, true, this.cache).u; }
    simulate() {
      if (this.G[this.xI] === INF) { this.msg.innerHTML = '<span class="no">x_I 的代价到目标是 ∞，没有可执行的计划。</span>'; return; }
      const r = C.rng(C.newSeed()), g = this.grid; this.trajs = []; let tot = 0;
      for (let t = 0; t < 20; t++) {
        let x = this.xI; const path = [x]; let k = 0;
        while (!g.isGoal(x) && k < 400) {
          const u = this.policy(x); if (u < 0) break;
          const th = C.pick(g.nature(x, u, this.model), r);
          const [i, j] = g.ij(x); x = g.id(i + C.MOVES[u][0] + C.MOVES[th][0], j + C.MOVES[u][1] + C.MOVES[th][1]);
          path.push(x); k++;
        }
        tot += k; this.trajs.push(path);
      }
      this.simMean = tot / 20;
      this.render();
    }
    render() {
      const g = this.grid, Gx = this.G[this.xI];
      this.stats.it.set(this.it);
      const ch = this.changes.length ? this.changes[this.changes.length - 1] : null;
      this.stats.ch.set(ch === null ? "–" : ch === INF ? "∞→有限" : ch.toExponential(1));
      this.stats.g.set(C.fmt(Gx, 3));
      this.stats.sim.set(this.simMean === null ? "–" : this.simMean.toFixed(2));
      let finite = 0; for (let x = 0; x < g.N; x++) if (g.free(x) && !g.isGoal(x) && this.G[x] < INF) finite++;
      let m = "";
      if (this.done) {
        if (finite === 0) m = this.kind === "worst" ? '<span class="no">X_G 之外全是 ∞。</span>最坏情况下自然总能把机器人的移动抵消（或把它横推出去），目标永远不能被<b>保证</b>到达。'
          : '<span class="no">X_G 之外全是 ∞。</span>概率模型下每个动作都有正概率落在目标外，任何有限 K 阶段问题的期望代价都含 ∞ 项——这就是书中建议给 l_F 一个<b>大的有限值</b>的原因。';
        else m = `<span class="yes">收敛</span>（${this.kind === "worst" ? "值完全不再变化" : "最大变化 < 10⁻⁶"}）：X_G 之外有 ${finite} 个状态的代价有限。` + (this.kind === "exp" ? " 期望情形的收敛是渐近的。" : "");
      } else m = this.it === 0 ? "初值：X_G 上为 0，其余为 l_F。点「迭代一次」看代价一圈一圈向外传播。" : `已迭代 ${this.it} 次，还在变化。`;
      this.msg.innerHTML = m;
      const pts = this.changes.map((c, i) => [i + 1, c === INF ? NaN : Math.max(c, 1e-12)]).filter(([, c]) => isFinite(c) && c > 0);
      this.chart.innerHTML = "";
      if (pts.length > 1) this.chart.append(C.lineChart([{ pts, color: "var(--accent)" }], { w: 300, h: 140, logY: true, xLabel: "迭代次数", yLabel: "最大变化" }));
      this.st.draw();
    }
    draw(ctx, st, col) {
      const g = this.grid; let vmax = 0;
      for (let x = 0; x < g.N; x++) if (g.free(x) && this.G[x] < INF) vmax = Math.max(vmax, this.G[x]);
      vmax = Math.min(vmax, 60);
      C.drawGrid(st, g, col, {
        fill: (x) => (g.isGoal(x) ? null : C.heat(col, this.G[x], vmax)),
        label: (x) => (g.isGoal(x) ? "" : this.G[x] === INF ? "∞" : this.kind === "worst" || this.natureKind === "none" ? C.fmt(this.G[x], 0) : this.G[x] >= 99.95 ? "100" : this.G[x].toFixed(1)),
        labelColor: (x) => (this.G[x] === INF ? col.bad : this.G[x] > vmax * 0.6 ? col.surface : col.text2),
        labelSize: Math.max(7.5, st.scale * 0.29),
      });
      if (this.done) for (let x = 0; x < g.N; x++) {
        if (!g.free(x) || g.isGoal(x) || this.G[x] === INF) continue;
        const u = this.policy(x); const [i, j] = g.ij(x);
        if (u >= 0) C.drawChevron(st, i, j, u, C.alpha(col.accent, 0.9));
      }
      for (const path of this.trajs) {
        ctx.beginPath(); path.forEach((x, k) => { const [i, j] = g.ij(x); const X = st.X(i + 0.5), Y = st.Y(j + 0.5); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.strokeStyle = C.alpha(col.path, 0.45); ctx.lineWidth = 2; ctx.stroke();
      }
      const [i, j] = g.ij(this.xI);
      st.dot(i + 0.5, j + 0.5, st.scale * 0.3, null, col.start, 2.5);
      st.text("x_I", i + 0.5, j + 1, col.start, { size: 11, weight: 700, dy: -2, base: "bottom" });
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 10.6 / 图 10.3——循环与渐近收敛
  // ---------------------------------------------------------------
  const CY_NODES = { I: [40, 40], A: [170, 40], B: [300, 40], G: [430, 40], D: [170, 140], Cn: [300, 140] };
  class CycleConvergence {
    constructor(root) {
      this.p = 0.5; this.kind = "exp"; this.walk = null; this.samples = [];
      const body = C.frame(root, "图 10.3：循环让值迭代只能渐近收敛", "例 10.6：每条边代价 1；在 B 处以概率 p 到达 x_G，否则绕一圈（代价 +4）");
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.sP = C.slider("p = P(B → x_G)", 0.05, 0.95, 0.05, this.p, (v) => { this.p = v; this.samples = []; this.render(); }, (v) => v.toFixed(2));
      this.segK = C.seg([["exp", "概率（期望代价）"], ["worst", "非确定（最坏情况）"]], this.kind, (k) => { this.kind = k; this.render(); });
      this.stats = { ex: C.stat("精确值 G_π(x_I)"), n20: C.stat("第 20 次迭代的变化"), n6: C.stat("变化 < 10⁻⁶ 需要"), n9: C.stat("变化 < 10⁻⁹ 需要"), mc: C.stat("抽样平均（次数）") };
      this.chartA = h("div", { class: "svg-wrap" }); this.chartB = h("div", { class: "svg-wrap" });
      this.msg = h("div", { class: "small", style: "min-height:1.6em" });
      body.append(h("div", { class: "controls" }, this.sP, this.segK),
        h("div", { class: "controls" }, C.button("走一条随机轨迹（动画）", () => this.animate(), "small"), C.button("抽样 1000 条", () => this.sample(1000), "small"), C.button("清空抽样", () => { this.samples = []; this.render(); }, "small")),
        this.svgWrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        h("div", { class: "split", style: "grid-template-columns:1fr 1fr" }, this.chartA, this.chartB));
      this.render();
    }
    // 对固定计划做值迭代（初值 0），返回每次迭代后的 G(x_I) 与最大变化
    vi(nmax) {
      const p = this.p; let G = { I: 0, A: 0, B: 0, Cn: 0, D: 0 }; const gi = [0], ch = [];
      for (let n = 1; n <= nmax; n++) {
        const B = this.kind === "exp" ? 1 + (1 - p) * G.Cn : 1 + Math.max(0, G.Cn);
        const Gn = { I: 1 + G.A, A: 1 + G.B, B, Cn: 1 + G.D, D: 1 + G.A };
        ch.push(Math.max(...Object.keys(G).map((k) => Math.abs(Gn[k] - G[k])))); G = Gn; gi.push(G.I);
      }
      return { gi, ch };
    }
    sample(n) {
      const r = C.rng(C.newSeed());
      for (let t = 0; t < n; t++) { let c = 3; while (r() >= this.p) c += 4; this.samples.push(c); }
      this.render();
    }
    animate() {
      if (this.walkTimer) return;
      const r = C.rng(C.newSeed()), seq = ["I", "A", "B"];
      while (true) { if (r() < this.p) { seq.push("G"); break; } seq.push("Cn", "D", "A", "B"); if (seq.length > 60) break; }
      let k = 0;
      this.walkTimer = setInterval(() => {
        this.walk = { node: seq[k], cost: k };
        this.drawGraph();
        if (++k >= seq.length) { clearInterval(this.walkTimer); this.walkTimer = null; if (seq[seq.length - 1] === "G") { this.samples.push(seq.length - 1); this.render(); } }
      }, 380);
    }
    drawGraph() {
      const W = 470, H = 180, svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "图 10.3" });
      const defs = s("defs"); defs.append(s("marker", { id: "cy-a", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--text-2)" })));
      svg.append(defs);
      const N = CY_NODES, edge = (a, b, lab, dx, dy, color) => {
        const [x0, y0] = N[a], [x1, y1] = N[b], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
        svg.append(s("line", { x1: x0 + ux * 13, y1: y0 + uy * 13, x2: x1 - ux * 15, y2: y1 - uy * 15, stroke: color || "var(--text-2)", "stroke-width": 1.6, "marker-end": "url(#cy-a)" }));
        svg.append(s("text", { x: (x0 + x1) / 2 + dx, y: (y0 + y1) / 2 + dy, "text-anchor": "middle", "font-size": 12, fill: color || "var(--text-2)" }, lab));
      };
      const pTxt = C.niceFrac(this.p, 20), qTxt = C.niceFrac(1 - this.p, 20);
      edge("I", "A", "1", 0, -8); edge("A", "B", "1", 0, -8); edge("B", "G", this.kind === "exp" ? pTxt : "可能", 0, -8, "var(--ok)");
      edge("B", "Cn", this.kind === "exp" ? qTxt : "可能", 22, 4, "var(--warn)"); edge("Cn", "D", "1", 0, 16); edge("D", "A", "1", -10, 4);
      const lab = { I: "x_I", A: "A", B: "B", G: "x_G", D: "D", Cn: "C" };
      for (const [k, [x, y]] of Object.entries(N)) {
        const on = this.walk && this.walk.node === k;
        svg.append(s("circle", { cx: x, cy: y, r: 12, fill: on ? "var(--accent)" : k === "G" ? C.cva("ok", 0.3) : "var(--surface)", stroke: k === "G" ? "var(--ok)" : "var(--border-strong)", "stroke-width": 1.5 }));
        svg.append(s("text", { x, y: y + 4, "text-anchor": "middle", "font-size": 11, fill: on ? "#fff" : "var(--text)" }, lab[k]));
      }
      if (this.walk) svg.append(s("text", { x: 40, y: 160, "font-size": 12, fill: "var(--accent-text)" }, `当前累计代价：${this.walk.cost}`));
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
    }
    render() {
      this.drawGraph();
      const exact = this.kind === "exp" ? 3 + 4 * (1 - this.p) / this.p : INF;
      const { gi, ch } = this.vi(1500);
      const first = (eps) => { const k = ch.findIndex((c) => c < eps); return k < 0 ? "> 1500 次" : `${k + 1} 次`; };
      this.stats.ex.set(this.kind === "exp" ? `${C.niceFrac(exact, 400)}${Number.isInteger(exact) ? "" : " ≈ " + exact.toFixed(3)}` : "∞");
      this.stats.n20.set(ch[19] < 1e-3 ? ch[19].toExponential(1) : ch[19].toFixed(4));
      this.stats.n6.set(this.kind === "exp" ? first(1e-6) : "永远不");
      this.stats.n9.set(this.kind === "exp" ? first(1e-9) : "永远不");
      const mean = this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : null;
      this.stats.mc.set(mean === null ? "–" : `${mean.toFixed(3)}（${this.samples.length}）`);
      this.msg.innerHTML = this.kind === "exp"
        ? `G_π(x_I) = 3 + 4·E[绕圈次数] = 3 + 4·(1−p)/p。值迭代第 n 次的变化量恰好是「n 步内还没到达」的概率，按 (1−p)<sup>⌈(n−3)/4⌉</sup> 指数衰减——只在极限下等于精确值。`
        : '最坏情况下自然总让机器人绕圈：代价线性增长，<span class="no">值迭代不收敛</span>（G_π(x_I) = ∞）。';
      const NN = 120;
      this.chartA.innerHTML = ""; this.chartB.innerHTML = "";
      this.chartA.append(C.lineChart([{ pts: gi.slice(0, NN + 1).map((v, n) => [n, v]), color: "var(--accent)" }],
        { w: 300, h: 150, xLabel: "迭代次数 n", yLabel: "G_n(x_I)", marks: this.kind === "exp" ? [{ y: exact, label: "精确值", color: "var(--ok)" }] : [] }));
      if (this.kind === "exp") this.chartB.append(C.lineChart([{ pts: ch.slice(0, NN).map((v, n) => [n + 1, v]), color: "var(--warn)" }],
        { w: 300, h: 150, logY: true, xLabel: "迭代次数 n", yLabel: "最大变化（对数）", marks: [{ x: 20, label: "n = 20", color: "var(--muted)" }] }));
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 10.7 / 图 10.5——策略迭代
  // ---------------------------------------------------------------
  const F = C.Frac;
  const BOOK_P = () => ({
    "a,1": { a: new F(1, 3), b: new F(1, 3), c: new F(1, 3) }, "b,1": { a: new F(1, 3), b: new F(1, 3), c: new F(1, 3) },
    "a,2": { a: new F(0), b: new F(1, 2), c: new F(1, 2) }, "b,2": { a: new F(1, 4), b: new F(0), c: new F(3, 4) },
  });
  class PolicyIteration {
    constructor(root) {
      this.P = BOOK_P(); this.init = { a: 1, b: 1 }; this.book = true;
      const body = C.frame(root, "策略迭代：例 10.7", "图 10.4 的算法：交替地「求值 (10.53)」和「改进 (10.54)」，直到计划不再变化");
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.selA = C.seg([["1", "π(a) = 1"], ["2", "π(a) = 2"]], "1", (k) => { this.init.a = +k; this.reset(); });
      this.selB = C.seg([["1", "π(b) = 1"], ["2", "π(b) = 2"]], "1", (k) => { this.init.b = +k; this.reset(); });
      this.btnE = C.button("第 2 步：求值 (10.53)", () => this.evaluate(), "small primary");
      this.btnI = C.button("第 3 步：改进 (10.54)", () => this.improve(), "small primary");
      this.log = h("div", { class: "small", style: "margin-top:8px" });
      this.vi = h("div", { class: "small muted", style: "margin-top:6px" });
      body.append(h("div", { class: "controls" }, h("span", { class: "small muted" }, "初始计划："), this.selA, this.selB),
        h("div", { class: "controls" }, this.btnE, this.btnI, C.button("自动跑完", () => this.auto(), "small"), C.button("重置", () => this.reset(), "small"),
          h("span", { class: "sep" }), C.button("随机一组概率（补充）", () => this.randomize(), "small"), C.button("恢复书中数值", () => { this.P = BOOK_P(); this.book = true; this.reset(); }, "small")),
        this.svgWrap, this.log, this.vi);
      this.reset();
    }
    reset() { this.pi = { ...this.init }; this.G = null; this.phase = "eval"; this.round = 1; this.log.innerHTML = ""; this.finished = false; this.render(); this.viCompare(); }
    randomize() {
      const r = C.rng(C.newSeed()), D = 12;
      for (const k of Object.keys(this.P)) {
        const [x] = k.split(",");
        // c 的概率至少 1/12，保证每个计划都以概率 1 到达目标
        const pc = 1 + Math.floor(r() * 8), rest = D - pc, pa = Math.floor(r() * (rest + 1)), pb = rest - pa;
        const pr = { a: new F(pa, D), b: new F(pb, D), c: new F(pc, D) };
        this.P[k] = pr; void x;
      }
      this.book = false; this.reset();
    }
    evaluate() {
      if (this.phase !== "eval" || this.finished) return;
      const pi = this.pi, P = this.P;
      // (I − P_π) G = 1，只对 a、b（G(c) = 0）
      const row = (x) => { const q = P[`${x},${pi[x]}`]; return [x === "a" ? new F(1).sub(q.a) : q.a.neg(), x === "b" ? new F(1).sub(q.b) : q.b.neg()]; };
      const sol = C.solveFrac([row("a"), row("b")], [1, 1]);
      this.G = { a: sol[0], b: sol[1], c: new F(0) };
      const eq = (x) => { const q = P[`${x},${pi[x]}`]; return `G_\\pi(${x}) = 1 + ${q.a.tex()}\\,G_\\pi(a) + ${q.b.tex()}\\,G_\\pi(b) + ${q.c.tex()}\\,G_\\pi(c)`; };
      const div = h("div", { class: "box", style: "margin:8px 0;padding:8px 12px" },
        h("div", { class: "box-title" }, `第 ${this.round} 轮 · 求值：π = (π(a), π(b)) = (${pi.a}, ${pi.b})`),
        h("div", { html: `$$${eq("a")}$$ $$${eq("b")}$$` }),
        h("div", { html: `解得 \\(G_\\pi(a) = ${this.G.a.tex()}\\)，\\(G_\\pi(b) = ${this.G.b.tex()}\\)，\\(G_\\pi(c) = 0\\)。` }));
      this.log.append(div); C.tex(div);
      this.phase = "improve"; this.render();
    }
    improve() {
      if (this.phase !== "improve" || this.finished) return;
      const P = this.P, G = this.G, val = (x, u) => { const q = P[`${x},${u}`]; return new F(1).add(q.a.mul(G.a)).add(q.b.mul(G.b)).add(q.c.mul(G.c)); };
      const rows = [], newPi = {};
      let changed = false;
      for (const x of ["a", "b"]) {
        const v1 = val(x, 1), v2 = val(x, 2);
        let best = v1.cmp(v2) < 0 ? 1 : v2.cmp(v1) < 0 ? 2 : this.pi[x];     // 平局时不换
        newPi[x] = best; if (best !== this.pi[x]) changed = true;
        rows.push(h("tr", null, h("td", null, x), ...[1, 2].map((u) => h("td", { class: "c", style: u === best ? "background:var(--accent-soft);font-weight:650" : "" }, (u === 1 ? v1 : v2).toString())), h("td", { class: "c" }, String(best))));
      }
      const div = h("div", { class: "box", style: "margin:8px 0;padding:8px 12px" },
        h("div", { class: "box-title" }, `第 ${this.round} 轮 · 改进：对每个状态算 l(x,u) + Σ G_π(x′) P(x′|x,u)`),
        h("div", { class: "table-wrap", style: "margin:4px 0" }, h("table", { class: "data", style: "max-width:420px" },
          h("tr", null, h("th", null, "x"), h("th", { class: "c" }, "u = 1"), h("th", { class: "c" }, "u = 2"), h("th", { class: "c" }, "π′(x)")), ...rows)),
        h("div", { html: changed ? "至少一个状态的代价变小了：\\(\\pi \\leftarrow \\pi'\\)，回到第 2 步。" : '<span class="yes">没有任何状态能改进</span>：(10.54) 已与平稳动态规划方程一致，宣布 \\(\\pi^* = \\pi\\)。' }));
      this.log.append(div); C.tex(div);
      if (changed) { this.pi = newPi; this.round++; this.phase = "eval"; } else this.finished = true;
      this.render();
    }
    auto() { for (let g = 0; g < 20 && !this.finished; g++) { if (this.phase === "eval") this.evaluate(); else this.improve(); } }
    viCompare() {
      const P = this.P; let G = { a: 0, b: 0, c: 0 }, n = 0;
      for (n = 1; n < 10000; n++) {
        const Gn = { c: 0 };
        for (const x of ["a", "b"]) Gn[x] = Math.min(...[1, 2].map((u) => { const q = P[`${x},${u}`]; return 1 + q.a.v * G.a + q.b.v * G.b; }));
        const ch = Math.max(Math.abs(Gn.a - G.a), Math.abs(Gn.b - G.b)); G = Gn; if (ch < 1e-9) break;
      }
      this.vi.innerHTML = `对照（值迭代，初值 0）：要 <b>${n}</b> 次迭代才让最大变化 < 10⁻⁹，得到 G(a) ≈ ${G.a.toFixed(6)}，G(b) ≈ ${G.b.toFixed(6)}。策略迭代每轮解一个线性方程组，通常几轮就<b>精确</b>结束。`;
    }
    render() {
      this.btnE.disabled = this.phase !== "eval" || this.finished; this.btnI.disabled = this.phase !== "improve" || this.finished;
      const W = 620, H = 175, svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "图 10.5" });
      const defs = s("defs");
      [["pi-on", "var(--accent)"], ["pi-off", "var(--border-strong)"]].forEach(([id, c]) => defs.append(s("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: c }))));
      svg.append(defs);
      [1, 2].forEach((u, panel) => {
        const ox = panel * 310, pos = { a: [ox + 70, 95], b: [ox + 175, 95], c: [ox + 285, 95] };
        svg.append(s("text", { x: ox + 175, y: 168, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, `u = ${u}`));
        for (const x of ["a", "b"]) {
          const on = this.pi[x] === u, col = on ? "var(--accent)" : "var(--border-strong)", mk = on ? "url(#pi-on)" : "url(#pi-off)";
          const q = this.P[`${x},${u}`];
          for (const y of ["a", "b", "c"]) {
            const pr = q[y]; if (pr.isZero()) continue;
            const [x0, y0] = pos[x], [x1, y1] = pos[y];
            let d, lx, ly;
            if (x === y && x === "a") { d = `M${x0 - 11},${y0 - 6} C${x0 - 52},${y0 - 34} ${x0 - 52},${y0 + 34} ${x0 - 12},${y0 + 6}`; lx = x0 - 30; ly = y0 + 34; }
            else if (x === y) { d = `M${x0 + 5},${y0 + 11} C${x0 + 18},${y0 + 52} ${x0 + 54},${y0 + 32} ${x0 + 12},${y0 + 5}`; lx = x0 + 40; ly = y0 + 50; }
            else {
              const bend = (x === "a" && y === "c") ? -100 : (x === "b" && y === "a") ? 34 : -22, mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + bend;
              const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L;
              d = `M${x0 + ux * 12},${y0} Q${mx},${my} ${x1 - ux * 13},${y1}`; lx = mx; ly = (y0 + my) / 2 + (bend < 0 ? -2 : 12);
            }
            svg.append(s("path", { d, fill: "none", stroke: col, "stroke-width": on ? 2 : 1.2, "marker-end": mk }));
            svg.append(s("text", { x: lx, y: ly, "text-anchor": "middle", "font-size": 11.5, fill: on ? "var(--accent-text)" : "var(--muted)" }, pr.toString()));
          }
        }
        for (const [x, [cx, cy]] of Object.entries(pos)) {
          svg.append(s("circle", { cx, cy, r: 12, fill: x === "c" ? C.cva("ok", 0.3) : "var(--surface)", stroke: x === "c" ? "var(--ok)" : "var(--text-2)", "stroke-width": 1.5 }));
          svg.append(s("text", { x: cx, y: cy + 4, "text-anchor": "middle", "font-size": 12, fill: "var(--text)" }, x));
        }
        svg.append(s("text", { x: pos.c[0], y: pos.c[1] + 30, "text-anchor": "middle", "font-size": 11, fill: "var(--ok)" }, "x_G"));
      });
      svg.append(s("text", { x: 4, y: 14, "font-size": 11.5, fill: "var(--accent-text)" },
        `当前计划 π = (${this.pi.a}, ${this.pi.b})（蓝色边）` + (this.G ? `；G_π(a) = ${this.G.a}，G_π(b) = ${this.G.b}` : "")));
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
    }
  }

  // ---------------------------------------------------------------
  // 组件：反向投影算法（图 10.6）与非确定 Dijkstra（图 10.8）——冰面世界（补充）
  // ---------------------------------------------------------------
  function iceGrid() {
    const obs = [], goal = [], ice = [];
    for (let j = 0; j <= 6; j++) obs.push("6," + j);
    for (let i = 11; i <= 13; i++) for (let j = 7; j <= 9; j++) goal.push(i + "," + j);
    for (let i = 2; i <= 10; i++) for (let j = 7; j <= 9; j++) ice.push(i + "," + j);
    for (let i = 7; i <= 10; i++) for (let j = 0; j <= 6; j++) ice.push(i + "," + j);
    return new C.Grid(14, 10, obs, goal, { ice });
  }
  class NondetDijkstra {
    constructor(root) {
      this.grid = iceGrid(); this.model = { kind: "ice", p: 0.2 }; this.algo = "bp"; this.restrict = false; this.hover = -1; this.showExp = false;
      const body = C.frame(root, "反向投影算法与非确定 Dijkstra", "冰面（斜线格）上执行 u 后可能被横推一格，其它地方没有自然；X_G = 右上角 3×3");
      this.st = new C.Stage({ view: [0, 14, 0, 10], aspect: 10 / 14, maxW: 600, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { const id = C.cellAt(this.grid, p); if (id !== this.hover) { this.hover = id; this.st.draw(); } }, onLeave: () => { this.hover = -1; this.st.draw(); } });
      this.segA = C.seg([["bp", "反向投影算法（图 10.6）"], ["dij", "非确定 Dijkstra（图 10.8）"]], this.algo, (k) => { this.algo = k; this.reset(); });
      this.chk = C.checkbox("只检查 WB(S)∖S", this.restrict, (v) => { this.restrict = v; this.reset(); });
      this.chkE = C.checkbox("对比：期望代价计划（横滑概率 0.2）", this.showExp, (v) => { this.showExp = v; this.st.draw(); });
      this.runner = new C.Runner(() => { const more = this.step(); this.render(); return more; });
      this.stats = { a: C.stat("遍数 / 弹出数"), s: C.stat("|S|"), c: C.stat("被检查的状态 / (10.64) 求值"), vi: C.stat("对照：最坏情况值迭代") };
      this.msg = h("div", { class: "small", style: "min-height:2.8em" });
      body.append(h("div", { class: "controls" }, this.segA, this.chk),
        h("div", { class: "controls" }, C.button("一步", () => { this.step(); this.render(); }, "small"), C.button("跑完", () => this.runner.start(), "small primary"), C.button("重置", () => this.reset(), "small"), this.chkE),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cva("ok", 0.3), "X_G / 已在 S 中（颜色越深 G* 越大）"], [C.cva("warn", 0.8), "当前一步加入 / 前沿 Front(x_s, S)"], [C.cv("current"), "x_s（刚从 A 中取出）", true], [C.cva("accent", 0.28), "冰面"], [C.cv("accent"), "π*(x)"]]),
        h("p", { class: "small muted", style: "margin:6px 0 0" }, "把鼠标移到任意格子上：画出它每个动作的一步前向投影——绿色箭头表示整个前向投影都在 S 里（x ∈ SB(S, u)），红色表示没有。"));
      this.computeReference();
      this.reset();
    }
    computeReference() {
      // 最坏情况值迭代（用来对照）与期望值迭代（对比计划）
      const g = this.grid, cache = C.succCache(g, this.model);
      let G = new Float64Array(g.N).fill(INF); for (let x = 0; x < g.N; x++) if (g.free(x) && g.isGoal(x)) G[x] = 0;
      let it = 0; for (; it < 500; it++) { const r = C.viSweep(g, G, this.model, "worst", INF, false, cache); G = r.G; if (r.change === 0) break; }
      this.viSweeps = it + 1; this.Gvi = G;
      let E = new Float64Array(g.N).fill(0); for (let k = 0; k < 2000; k++) { const r = C.viSweep(g, E, this.model, "exp", 1000, false, cache); E = r.G; if (r.change < 1e-10) break; }
      this.piExp = new Int8Array(g.N).fill(-1);
      for (let x = 0; x < g.N; x++) if (g.free(x) && !g.isGoal(x)) this.piExp[x] = C.greedy(g, E, this.model, "exp", x, false, cache).u;
      this.cache = cache;
    }
    reset() {
      this.runner.stop();
      const g = this.grid, N = g.N;
      this.inS = new Uint8Array(N); this.G = new Float64Array(N).fill(INF); this.pi = new Int8Array(N).fill(-1);
      this.layer = new Int16Array(N).fill(-1); this.lastAdded = []; this.front = []; this.xs = -1;
      this.passes = 0; this.checked = 0; this.evals = 0; this.done = false;
      if (this.algo === "bp") { for (let x = 0; x < N; x++) if (g.free(x) && g.isGoal(x)) { this.inS[x] = 1; this.G[x] = 0; this.layer[x] = 0; } }
      else { this.inA = new Uint8Array(N); for (let x = 0; x < N; x++) if (g.free(x) && g.isGoal(x)) { this.inA[x] = 1; this.G[x] = 0; } }
      this.render();
    }
    fp(x, u) { return this.cache(x, u).map(([z]) => z); }
    step() {
      if (this.done) return false;
      const g = this.grid;
      if (this.algo === "bp") {
        // 图 10.6 第 2 步：对 X∖S（或 WB(S)∖S）里的每个 x，若存在 u 使 x ∈ SB(S, u) 就加入（这里按「遍」整体加入）
        const add = [];
        for (let x = 0; x < g.N; x++) {
          if (!g.free(x) || this.inS[x]) continue;
          const acts = g.actions(x, false);
          if (this.restrict && !acts.some((u) => this.fp(x, u).some((z) => this.inS[z]))) continue;
          this.checked++;
          for (const u of acts) { const F = this.fp(x, u); if (F.every((z) => this.inS[z])) { add.push([x, u, 1 + Math.max(...F.map((z) => this.G[z]))]); break; } }
        }
        this.lastAdded = add.map((a) => a[0]);
        if (!add.length) { this.done = true; return false; }
        this.passes++;
        for (const [x, u, v] of add) { this.inS[x] = 1; this.pi[x] = u; this.G[x] = v; this.layer[x] = this.passes; }
        return true;
      }
      // 非确定 Dijkstra：第 2 步取 A 中 G 最小的 x_s
      let xs = -1; for (let x = 0; x < g.N; x++) if (this.inA[x] && (xs < 0 || this.G[x] < this.G[xs])) xs = x;
      if (xs < 0) { this.done = true; this.xs = -1; this.front = []; return false; }
      this.inA[xs] = 0; this.inS[xs] = 1; this.xs = xs; this.passes++;
      // 第 4 步：Front(x_s, S)
      this.front = [];
      for (let x = 0; x < g.N; x++) {
        if (!g.free(x) || this.inS[x]) continue;
        let best = this.G[x], bu = this.pi[x], inF = false;
        for (const u of g.actions(x, false)) {
          const F = this.fp(x, u);
          if (F.includes(xs) && F.every((z) => this.inS[z])) {
            inF = true; this.evals++;
            const v = 1 + Math.max(...F.map((z) => this.G[z]));       // 式 (10.64)
            if (v < best) { best = v; bu = u; }
          }
        }
        if (inF) { this.front.push(x); if (best < this.G[x]) { this.G[x] = best; this.pi[x] = bu; } this.inA[x] = 1; }
      }
      return true;
    }
    render() {
      const g = this.grid; let nS = 0; for (let x = 0; x < g.N; x++) if (this.inS[x]) nS++;
      this.stats.a.set(this.passes); this.stats.s.set(nS);
      this.stats.c.set(this.algo === "bp" ? this.checked : this.evals);
      this.stats.vi.set(`${this.viSweeps} 遍 × ${g.freeIds().length} 个状态`);
      let m;
      if (this.algo === "bp") m = this.done ? `<span class="yes">第 2 步无法再扩大 S</span>：SB(S) = S，算法停止。S 覆盖了全部 ${nS} 个自由状态——每个状态都能<b>保证</b>到达 X_G。格子里的数字是所得计划的最坏代价，不一定最优（对照非确定 Dijkstra）。` + (this.restrict ? "" : " 勾选「只检查 WB(S)∖S」看被检查的状态数降多少。")
        : this.passes === 0 ? "初始化：S = X_G，在 X_G 上 π = u_T。点「一步」执行一遍图 10.6 的第 2 步。"
        : `第 ${this.passes} 遍加入 ${this.lastAdded.length} 个状态（橙色）：它们存在某个动作，整个一步前向投影都已在 S 里。`;
      else m = this.done ? `<span class="yes">A 为空，算法结束</span>：G 即最坏情况最优代价 G*，与值迭代结果${this.agree() ? "完全一致" : "<b>不一致</b>"}。最大 G* = ${Math.max(...Array.from(this.G).filter((v) => v < INF))}。`
        : this.xs < 0 ? "初始化：S = ∅，A = X_G，G = 0（其余 ∞）。点「一步」。" : `取出 x_s = (${g.ij(this.xs).join(", ")})，G*(x_s) = ${this.G[this.xs]}；前沿有 ${this.front.length} 个状态（橙色），用 (10.64) 更新它们的 G。`;
      this.msg.innerHTML = m;
      this.st.draw();
    }
    agree() { for (let x = 0; x < this.grid.N; x++) if (this.grid.free(x) && this.G[x] !== this.Gvi[x]) return false; return true; }
    draw(ctx, st, col) {
      const g = this.grid; let vmax = 1; for (let x = 0; x < g.N; x++) if (this.inS[x] && this.G[x] < INF) vmax = Math.max(vmax, this.G[x]);
      const cur = new Set(this.algo === "bp" ? this.lastAdded : this.front);
      C.drawGrid(st, g, col, {
        fill: (x) => (cur.has(x) ? C.alpha(col.warn, 0.55) : this.inS[x] ? C.mix(col.okSoft, col.ok, 0.1 + 0.5 * this.G[x] / vmax) : null),
        label: (x) => (this.inS[x] || cur.has(x)) && this.G[x] < INF && !g.isGoal(x) ? this.G[x] : "",
        labelSize: Math.max(8, st.scale * 0.3),
      });
      for (let x = 0; x < g.N; x++) {
        if (!g.free(x) || g.isGoal(x)) continue;
        const [i, j] = g.ij(x);
        if (this.showExp) {
          const u = this.piExp[x]; if (u >= 0) C.drawChevron(st, i, j, u, C.alpha(col.alive2, 0.95));
          if (this.done && this.pi[x] >= 0 && this.pi[x] !== u) st.rect(i + 0.06, j + 0.06, i + 0.94, j + 0.94, null, col.alive2, 1.5);
        } else if (this.pi[x] >= 0 && (this.inS[x] || cur.has(x))) C.drawChevron(st, i, j, this.pi[x], C.alpha(col.accent, 0.9));
      }
      if (this.xs >= 0) { const [i, j] = g.ij(this.xs); st.dot(i + 0.5, j + 0.5, st.scale * 0.22, col.current, col.surface, 1.5); }
      if (this.hover >= 0 && g.free(this.hover) && !g.isGoal(this.hover)) {
        const x = this.hover, [i, j] = g.ij(x);
        st.rect(i, j, i + 1, j + 1, null, col.text, 2);
        g.actions(x, false).forEach((u) => {
          const F = this.fp(x, u), ok = F.every((z) => this.inS[z]);
          for (const z of F) { const [zi, zj] = g.ij(z); st.arrow(i + 0.5, j + 0.5, zi + 0.5, zj + 0.5, ok ? col.ok : C.alpha(col.bad, 0.75), 1.6, 7); }
        });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='vi-lab']").forEach((el) => el._w = new VILab(el));
    document.querySelectorAll("[data-widget='cycle']").forEach((el) => el._w = new CycleConvergence(el));
    document.querySelectorAll("[data-widget='policy-iteration']").forEach((el) => el._w = new PolicyIteration(el));
    document.querySelectorAll("[data-widget='nd-dijkstra']").forEach((el) => el._w = new NondetDijkstra(el));
  });
})();
