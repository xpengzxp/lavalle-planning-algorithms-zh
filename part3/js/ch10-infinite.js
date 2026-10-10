/* 10.3 节：折扣因子与几何级数（式 10.66–10.68、图 10.10）；机器保养 MDP（补充）上的折扣值迭代 / 策略迭代与平均代价 */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH10;

  // ---------------------------------------------------------------
  // 组件：折扣因子
  // ---------------------------------------------------------------
  class Discount {
    constructor(root) {
      this.a = 0.9; this.costKind = "const";
      const body = C.frame(root, "折扣因子 α", "式 (10.66)–(10.68)：未来第 k 个阶段的代价乘上 α^k");
      this.sA = C.slider("α", 0.05, 0.999, 0.001, this.a, (v) => { this.a = v; this.render(); }, (v) => v.toFixed(3));
      const preset = (v) => () => { this.a = v; this.sA.set(v); this.render(); };
      this.segC = C.seg([["const", "每阶段代价 l = 1"], ["wave", "代价时高时低（补充）"]], this.costKind, (k) => { this.costKind = k; this.render(); });
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.stats = { lim: C.stat("Σ α^k = 1/(1−α)"), k1: C.stat("权重降到 1% 以下"), sum: C.stat("前 K 个阶段的折扣代价"), bound: C.stat("上界 c/(1−α) (10.68)") };
      this.table = h("div", { class: "small mono", style: "margin-top:6px" });
      body.append(h("div", { class: "controls" }, this.sA, C.button("α = 1/2", preset(0.5), "small"), C.button("0.9", preset(0.9), "small"), C.button("0.99", preset(0.99), "small"), C.button("0.999", preset(0.999), "small")),
        h("div", { class: "controls" }, this.segC), this.svgWrap, h("div", { class: "stats" }, Object.values(this.stats)), this.table);
      this.render();
    }
    cost(k) { return this.costKind === "const" ? 1 : [3, 0, 1, 4, 0, 2, 1, 0][k % 8] / 2; }
    render() {
      const a = this.a, K = 60, W = 640, H = 200, L = 40, B = 26, T = 10;
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "折扣权重" });
      const bw = (W - L - 10) / (K + 1), lim = 1 / (1 - a);
      let sum = 0; const cum = [];
      for (let k = 0; k <= K; k++) { sum += Math.pow(a, k) * this.cost(k); cum.push(sum); }
      const cmax = this.costKind === "const" ? 1 : 2;
      const ymax2 = Math.max(cum[K], this.costKind === "const" ? Math.min(lim, 120) : cum[K]) * 1.05;
      svg.append(s("rect", { x: L, y: T, width: W - L - 10, height: H - T - B, fill: "var(--surface)", stroke: "var(--border)" }));
      for (let k = 0; k <= K; k++) {
        const w = Math.pow(a, k), hh = (H - T - B) * w * this.cost(k) / cmax;
        svg.append(s("rect", { x: L + k * bw + 1, y: H - B - hh, width: Math.max(1, bw - 2), height: hh, fill: C.cva("accent", 0.65) }));
        if (k % 10 === 0) svg.append(s("text", { x: L + (k + 0.5) * bw, y: H - B + 14, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, k));
      }
      const yc = (v) => T + (1 - v / ymax2) * (H - T - B);
      svg.append(s("polyline", { points: cum.map((v, k) => `${(L + (k + 0.5) * bw).toFixed(1)},${yc(v).toFixed(1)}`).join(" "), fill: "none", stroke: "var(--warn)", "stroke-width": 2 }));
      if (this.costKind === "const" && lim <= ymax2) {
        svg.append(s("line", { x1: L, x2: W - 10, y1: yc(lim), y2: yc(lim), stroke: "var(--ok)", "stroke-dasharray": "5 4" }));
        svg.append(s("text", { x: W - 14, y: yc(lim) - 4, "text-anchor": "end", "font-size": 10.5, fill: "var(--ok)" }, `1/(1−α) = ${lim.toFixed(2)}`));
      }

      svg.append(s("text", { x: (L + W) / 2, y: H - 3, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, "阶段 k"));
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg,
        C.legend([[C.cva("accent", 0.65), "柱：第 k 个阶段的折扣代价 α^k·l_k（相对高度）"], ["var(--warn)", `折线：累计折扣代价 Σ α^k l_k（纵轴顶端 = ${ymax2.toFixed(1)}）`], ["var(--ok)", "虚线：极限 1/(1−α)"]]));
      this.stats.lim.set(lim.toFixed(lim > 100 ? 0 : 3));
      this.stats.k1.set(`k ≥ ${Math.ceil(Math.log(0.01) / Math.log(a))}`);
      this.stats.sum.set(`K = ${K}：${cum[K].toFixed(3)}`);
      this.stats.bound.set((cmax / (1 - a)).toFixed(2));
      // 图 10.10 的表
      const rows = [];
      for (let k = 0; k <= 4; k++) { let t = []; for (let i = 0; i <= k; i++) t.push(i === 0 ? "l0" : `${i === 1 ? "α" : "α" + "²³⁴"[i - 2]}l${i}`); rows.push(`K = ${k}   L*_K = ${t.join(" + ")}`); }
      this.table.innerHTML = rows.join("<br>") + `<br><span class="muted">（图 10.10：K+1 阶段问题 = 第一阶段代价 l0 + α ×（K 阶段问题的代价，下标整体后移一位）——这就是 (10.74) 能写成平稳形式的原因。）</span>`;
    }
  }

  // ---------------------------------------------------------------
  // 机器保养 MDP（补充）：状态 0 新、1 磨损、2 严重磨损、3 损坏；动作「运转」/「维修」
  // ---------------------------------------------------------------
  const RUN = [0, 2, 4, 10], WEAR = [0.3, 0.3, 0.5, 0], REPAIR = 5;
  const STATES = ["新", "磨损", "严重磨损", "损坏"];
  const mP = (x, u) => (u === 1 ? [[0, 1]] : x === 3 ? [[3, 1]] : [[x, 1 - WEAR[x]], [x + 1, WEAR[x]]]);
  const mL = (x, u) => (u === 1 ? REPAIR : RUN[x]);
  function machVI(a, eps = 1e-10, maxIt = 200000) {
    let J = [0, 0, 0, 0]; const ch = []; let it = 0;
    for (it = 1; it <= maxIt; it++) {
      const Jn = J.map((_, x) => Math.min(...[0, 1].map((u) => mL(x, u) + a * mP(x, u).reduce((s2, [y, p]) => s2 + p * J[y], 0))));
      const c = Math.max(...Jn.map((v, x) => Math.abs(v - J[x]))); ch.push(c); J = Jn; if (c < eps) break;
    }
    const pi = J.map((_, x) => { const q = [0, 1].map((u) => mL(x, u) + a * mP(x, u).reduce((s2, [y, p]) => s2 + p * J[y], 0)); return q[1] < q[0] - 1e-12 ? 1 : 0; });
    return { J, pi, it, ch };
  }
  function machPI(a) {
    let pi = [0, 0, 0, 0], rounds = 0, J;
    while (rounds < 50) {
      rounds++;
      const A = [0, 1, 2, 3].map((x) => [0, 1, 2, 3].map((y) => (x === y ? 1 : 0) - a * (mP(x, pi[x]).find(([z]) => z === y) || [0, 0])[1]));
      J = C.solve(A, [0, 1, 2, 3].map((x) => mL(x, pi[x])));                      // 式 (10.77)
      const np = [0, 1, 2, 3].map((x) => {                                         // 式 (10.78)
        const q = [0, 1].map((u) => mL(x, u) + a * mP(x, u).reduce((s2, [y, p]) => s2 + p * J[y], 0));
        return q[1 - pi[x]] < q[pi[x]] - 1e-10 ? 1 - pi[x] : pi[x];
      });
      if (np.every((u, x) => u === pi[x])) break;
      pi = np;
    }
    return { J, pi, rounds };
  }
  function machAvg() {
    // 相对值迭代：每次减去参考状态 s = 0 的值（[12]）
    let hv = [0, 0, 0, 0], g = 0, it;
    for (it = 1; it < 100000; it++) {
      const T = hv.map((_, x) => Math.min(...[0, 1].map((u) => mL(x, u) + mP(x, u).reduce((s2, [y, p]) => s2 + p * hv[y], 0))));
      g = T[0]; const hn = T.map((v) => v - g);
      const c = Math.max(...hn.map((v, x) => Math.abs(v - hv[x]))); hv = hn; if (c < 1e-10) break;
    }
    const pi = hv.map((_, x) => { const q = [0, 1].map((u) => mL(x, u) + mP(x, u).reduce((s2, [y, p]) => s2 + p * hv[y], 0)); return q[1] < q[0] - 1e-12 ? 1 : 0; });
    // 普通值迭代 + 判据 (10.80)
    let G = [0, 0, 0, 0], N;
    for (N = 1; N < 100000; N++) {
      const Gn = G.map((_, x) => Math.min(...[0, 1].map((u) => mL(x, u) + mP(x, u).reduce((s2, [y, p]) => s2 + p * G[y], 0))));
      if (N > 1 && Math.max(...Gn.map((v, x) => Math.abs(v / N - G[x] / (N - 1)))) < 1e-3) { G = Gn; break; }
      G = Gn;
    }
    return { g, h: hv, pi, it, N, avg: G.map((v) => v / N) };
  }
  class Maintenance {
    constructor(root) {
      this.a = 0.5; this.avg = false;
      const body = C.frame(root, "无限时域：机器保养（补充例子）", "运转：代价随磨损增加，可能恶化一级；维修：代价 5，下一阶段回到「新」");
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.sA = C.slider("折扣因子 α", 0.05, 0.99, 0.01, this.a, (v) => { this.a = v; this.render(); }, (v) => v.toFixed(2));
      this.chk = C.checkbox("改用平均代价（10.69）", this.avg, (v) => { this.avg = v; this.render(); });
      this.stats = { vi: C.stat("值迭代次数（变化 < 10⁻¹⁰）"), pi: C.stat("策略迭代轮数"), J: C.stat("J*（四个状态）") };
      this.msg = h("div", { class: "small", style: "min-height:2.6em" });
      this.chartA = h("div", { class: "svg-wrap" }); this.chartB = h("div", { class: "svg-wrap" });
      body.append(h("div", { class: "controls" }, this.sA, this.chk), this.svgWrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        h("div", { class: "split", style: "grid-template-columns:1fr 1fr" }, this.chartA, this.chartB));
      // 预先扫描 α，画 J*(x) 随 α 的曲线与策略分界
      this.sweep = [];
      for (let k = 5; k <= 99; k++) { const a = k / 100, r = machVI(a, 1e-10); this.sweep.push({ a, J: r.J, pi: r.pi }); }
      this.render();
    }
    render() {
      let J, pi, info;
      if (this.avg) {
        const r = machAvg(); pi = r.pi; J = r.h;
        this.stats.vi.set(`相对值迭代 ${r.it} 次`); this.stats.pi.set("—");
        this.stats.J.set(`每阶段 ${r.g.toFixed(4)}`);
        info = `平均代价下最优计划在状态 ${pi.map((u, x) => (u ? STATES[x] : null)).filter(Boolean).join("、")} 维修，每阶段平均代价 g = ${r.g.toFixed(4)}（相对值 h = [${r.h.map((v) => v.toFixed(3)).join(", ")}]）。` +
          `普通值迭代配合判据 (10.80)、ε = 10⁻³ 在 N = ${r.N} 时停止，G_N/N ≈ [${r.avg.map((v) => v.toFixed(3)).join(", ")}]。`;
      } else {
        const r = machVI(this.a), p = machPI(this.a); J = r.J; pi = r.pi;
        this.stats.vi.set(r.it); this.stats.pi.set(p.rounds);
        this.stats.J.set(J.map((v) => v.toFixed(2)).join(" / "));
        info = `α = ${this.a.toFixed(2)}：最优计划在 ${pi.some((u) => u) ? pi.map((u, x) => (u ? `「${STATES[x]}」` : null)).filter(Boolean).join("、") + "时维修" : "任何状态都不维修"}。` +
          (this.a < 0.3 ? " α 很小：未来几乎不算数，只有损坏时才修——典型的「短视」。" : this.a > 0.8 ? " α 大：愿意为长远付出眼前的维修代价。值迭代的次数大约与 1/(1−α) 成正比。" : "");
        this.chartB.innerHTML = "";
        this.chartB.append(C.lineChart([{ pts: r.ch.map((c, i) => [i + 1, Math.max(c, 1e-12)]), color: "var(--warn)" }], { w: 300, h: 150, logY: true, xLabel: "值迭代次数 i", yLabel: "最大变化" }));
      }
      this.msg.innerHTML = info;
      this.drawMDP(pi);
      // J*(x) 随 α 的曲线（log 刻度）+ 策略分界
      const cols = ["var(--ok)", "var(--accent)", "var(--c-alive2)", "var(--bad)"];
      const series = [0, 1, 2, 3].map((x) => ({ pts: this.sweep.map((r) => [r.a * 100, r.J[x]]), color: cols[x] }));
      const marks = [];
      for (let k = 1; k < this.sweep.length; k++) if (this.sweep[k].pi.join() !== this.sweep[k - 1].pi.join()) marks.push({ x: this.sweep[k].a * 100, label: `α≈${this.sweep[k].a.toFixed(2)}`, color: "var(--muted)" });
      if (!this.avg) marks.push({ x: this.a * 100, color: "var(--warn)" });
      this.chartA.innerHTML = "";
      this.chartA.append(C.lineChart(series, { w: 300, h: 150, logY: true, xLabel: "100 α", yLabel: "J*(x)（对数）", marks }));
      if (this.avg) { this.chartB.innerHTML = ""; }
      this.chartA.append(C.legend(STATES.map((n, x) => [cols[x], n])));
    }
    drawMDP(pi) {
      const W = 620, H = 150, svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "机器保养 MDP" });
      const defs = s("defs"); defs.append(s("marker", { id: "mt-a", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--text-2)" })));
      defs.append(s("marker", { id: "mt-b", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--accent)" })));
      svg.append(defs);
      const X = (x) => 70 + x * 160, Y = 70;
      for (let x = 0; x < 3; x++) {
        svg.append(s("line", { x1: X(x) + 30, y1: Y, x2: X(x + 1) - 32, y2: Y, stroke: pi[x] ? "var(--border-strong)" : "var(--text-2)", "stroke-width": 1.5, "marker-end": "url(#mt-a)" }));
        svg.append(s("text", { x: (X(x) + X(x + 1)) / 2, y: Y - 8, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, `运转：${WEAR[x]}`));
      }
      for (let x = 1; x < 4; x++) if (pi[x]) svg.append(s("path", { d: `M${X(x)},${Y + 28} Q${(X(x) + X(0)) / 2},${Y + 72} ${X(0) + 8},${Y + 30}`, fill: "none", stroke: "var(--accent)", "stroke-width": 2, "marker-end": "url(#mt-b)" }));
      for (let x = 0; x < 4; x++) {
        svg.append(s("rect", { x: X(x) - 30, y: Y - 26, width: 60, height: 52, rx: 10, fill: pi[x] ? C.cva("accent", 0.18) : "var(--surface)", stroke: pi[x] ? "var(--accent)" : "var(--border-strong)", "stroke-width": 1.5 }));
        svg.append(s("text", { x: X(x), y: Y - 6, "text-anchor": "middle", "font-size": 12.5, fill: "var(--text)" }, STATES[x]));
        svg.append(s("text", { x: X(x), y: Y + 12, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, `运转代价 ${RUN[x]}`));
        svg.append(s("text", { x: X(x), y: 20, "text-anchor": "middle", "font-size": 11.5, fill: pi[x] ? "var(--accent-text)" : "var(--text-2)", "font-weight": 650 }, pi[x] ? "π* = 维修" : "π* = 运转"));
      }
      svg.append(s("text", { x: W - 8, y: H - 8, "text-anchor": "end", "font-size": 10.5, fill: "var(--accent-text)" }, "蓝色弧：维修（代价 5）→ 新"));
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='discount']").forEach((el) => el._w = new Discount(el));
    document.querySelectorAll("[data-widget='maintenance']").forEach((el) => el._w = new Maintenance(el));
  });
})();
