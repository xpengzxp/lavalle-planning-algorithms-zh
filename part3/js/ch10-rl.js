/* 10.4 节：用模拟评估计划（蒙特卡罗 (10.85)、TD(λ) (10.93)、常数 ρ 的 TD(0) (10.96)）与 Q-learning (10.101) */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH10;
  const INF = Infinity;

  // ---------------------------------------------------------------
  // 走廊（补充）：状态 1..8，9 是目标；计划「一直向右」
  // ---------------------------------------------------------------
  const CN = 8, PF = 0.6, PS = 0.25, PB = 0.15;
  const corrNext = (x) => (x === 1 ? [[2, PF], [1, PS + PB]] : [[x + 1, PF], [x, PS], [x - 1, PB]]);
  function corrTrue() {
    const A = [], b = [];
    for (let x = 1; x <= CN; x++) {
      const row = new Array(CN).fill(0); row[x - 1] += 1;
      for (const [y, p] of corrNext(x)) if (y <= CN) row[y - 1] -= p;
      A.push(row); b.push(1);
    }
    return [0].concat(C.solve(A, b), [0]);    // 下标 0 不用，9 是目标
  }
  const METHODS = [
    { key: "mc", name: "蒙特卡罗 (10.85)", color: "var(--ok)" },
    { key: "td", name: "TD(λ) (10.93)", color: "var(--accent)" },
    { key: "rho", name: "TD(0)，常数 ρ (10.96)", color: "var(--warn)" },
  ];
  class TDEval {
    constructor(root) {
      this.lam = 0.5; this.rho = 0.1; this.truth = corrTrue();
      const body = C.frame(root, "用模拟评估一个计划", "走廊（补充）：计划 π = 一直向右；自然：前进 0.6 / 原地 0.25 / 后退 0.15；每阶段代价 1；状态 9 是目标");
      this.sL = C.slider("λ", 0, 1, 0.05, this.lam, (v) => { this.lam = v; this.reset(); }, (v) => v.toFixed(2));
      this.sR = C.slider("ρ", 0.01, 0.5, 0.01, this.rho, (v) => { this.rho = v; this.reset(); }, (v) => v.toFixed(2));
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.chart = h("div", { class: "svg-wrap" });
      this.last = h("div", { class: "small mono", style: "min-height:1.6em;white-space:nowrap;overflow-x:auto" });
      this.stats = METHODS.map((m) => C.stat(m.name + " 的 RMS 误差"));
      body.append(h("div", { class: "controls" }, this.sL, this.sR),
        h("div", { class: "controls" }, C.button("+1 次试验", () => this.run(1), "small"), C.button("+10", () => this.run(10), "small"), C.button("+100", () => this.run(100), "small primary"), C.button("重置", () => this.reset(), "small")),
        this.svgWrap, this.last, h("div", { class: "stats" }, this.stats), this.chart,
        C.legend(METHODS.map((m) => [m.color, m.name]).concat([["var(--text)", "真值 G_π（解线性方程 (10.84)）"]])));
      this.reset();
    }
    reset() {
      this.r = C.rng(20240611); this.trials = 0; this.hist = [];
      this.est = {}; this.visits = {};
      for (const m of METHODS) { this.est[m.key] = new Float64Array(CN + 2); this.visits[m.key] = new Float64Array(CN + 2); }
      this.lastPath = null; this.render();
    }
    trial() {
      const x0 = 1 + (this.trials % CN), xs = [x0];
      while (xs[xs.length - 1] <= CN && xs.length < 2000) xs.push(C.pick(corrNext(xs[xs.length - 1]), this.r));
      const K = xs.length - 1;
      // 蒙特卡罗：对路径上每次访问用 (10.86) 的累计代价做增量平均 (10.85)
      { const G = this.est.mc, v = this.visits.mc; for (let k = 0; k < K; k++) { const x = xs[k]; v[x]++; G[x] += (K - k - G[x]) / v[x]; } }
      // TD(λ)：每到达 x_{k+1} 就算 d_k (10.87)，按 (10.93) 更新这次试验里之前的所有状态
      { const G = this.est.td, v = this.visits.td, lam = this.lam;
        for (let k = 0; k < K; k++) {
          v[xs[k]]++;
          const d = 1 + G[xs[k + 1]] - G[xs[k]];
          let w = 1; for (let j = k; j >= 0; j--) { G[xs[j]] += w * d / v[xs[j]]; w *= lam; if (w < 1e-12) break; }
        } }
      // 常数 ρ：Ĝ(x) := (1−ρ)Ĝ(x) + ρ(l + Ĝ(x′))
      { const G = this.est.rho; for (let k = 0; k < K; k++) G[xs[k]] = (1 - this.rho) * G[xs[k]] + this.rho * (1 + G[xs[k + 1]]); }
      this.trials++; this.lastPath = xs;
      this.hist.push(METHODS.map((m) => this.rms(m.key)));
    }
    rms(key) { let s2 = 0; for (let x = 1; x <= CN; x++) s2 += (this.est[key][x] - this.truth[x]) ** 2; return Math.sqrt(s2 / CN); }
    run(n) { for (let i = 0; i < n; i++) this.trial(); this.render(); }
    render() {
      const W = 640, H = 210, L = 30, cw = (W - L - 70) / CN, T = 14, B = 40, vmax = Math.max(...this.truth) * 1.25;
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "走廊上的估计" });
      const Y = (v) => T + (1 - Math.min(v, vmax) / vmax) * (H - T - B);
      for (let x = 1; x <= CN + 1; x++) {
        const x0 = L + (x - 1) * cw;
        svg.append(s("rect", { x: x0 + 2, y: H - B + 6, width: cw - 4, height: 22, rx: 4, fill: x === CN + 1 ? C.cva("ok", 0.3) : "var(--surface-2)", stroke: "var(--border-strong)" }));
        svg.append(s("text", { x: x0 + cw / 2, y: H - B + 21, "text-anchor": "middle", "font-size": 11.5, fill: "var(--text)" }, x === CN + 1 ? "9 = X_G" : x));
        if (x > CN) continue;
        METHODS.forEach((m, k) => { const v = this.est[m.key][x], bw = (cw - 12) / 3; svg.append(s("rect", { x: x0 + 6 + k * bw, y: Y(Math.max(0, v)), width: bw - 2, height: H - B - Y(Math.max(0, v)), fill: m.color, opacity: 0.75 })); });
        svg.append(s("line", { x1: x0 + 3, x2: x0 + cw - 3, y1: Y(this.truth[x]), y2: Y(this.truth[x]), stroke: "var(--text)", "stroke-width": 2 }));
        svg.append(s("text", { x: x0 + cw / 2, y: Y(this.truth[x]) - 4, "text-anchor": "middle", "font-size": 10, fill: "var(--text-2)" }, this.truth[x].toFixed(2)));
      }
      if (this.lastPath) {   // 上一次试验经过的状态
        const cnt = new Map(); this.lastPath.forEach((x) => cnt.set(x, (cnt.get(x) || 0) + 1));
        for (const [x, c] of cnt) if (x <= CN) svg.append(s("text", { x: L + (x - 0.5) * cw, y: H - 4, "text-anchor": "middle", "font-size": 10, fill: "var(--warn)" }, `×${c}`));
      }
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
      this.last.textContent = this.lastPath ? `第 ${this.trials} 次试验：${this.lastPath.join(" → ")}（${this.lastPath.length - 1} 个阶段）` : "还没有试验。每次试验从 1, 2, …, 8 轮流出发，直到到达 9。";
      METHODS.forEach((m, k) => this.stats[k].set(this.trials ? this.rms(m.key).toFixed(3) : "–"));
      this.chart.innerHTML = "";
      if (this.hist.length > 1) this.chart.append(C.lineChart(METHODS.map((m, k) => ({ pts: this.hist.map((e, i) => [i + 1, e[k]]), color: m.color })),
        { w: 620, h: 170, xLabel: "试验次数", yLabel: "RMS 误差", yMin: 0 }));
    }
  }

  // ---------------------------------------------------------------
  // Q-learning（补充网格）：7×5，两段墙，处处侧滑 0.2，目标 (6,4)
  // ---------------------------------------------------------------
  function qGrid() {
    const obs = ["2,1", "2,2", "2,3", "4,0", "4,1", "4,2"];
    return new C.Grid(7, 5, obs, ["6,4"]);
  }
  class QLearning {
    constructor(root) {
      this.grid = qGrid(); this.model = { kind: "slip", p: 0.2 }; this.rho = 0.2; this.useN = false; this.eps = 0.2; this.hover = -1;
      const g = this.grid, cache = C.succCache(g, this.model); this.cache = cache;
      // 真值：概率值迭代（不允许「停」）
      let G = new Float64Array(g.N).fill(0);
      for (let k = 0; k < 5000; k++) { const r = C.viSweep(g, G, this.model, "exp", 1000, false, cache); G = r.G; if (r.change < 1e-12) break; }
      this.Gstar = G;
      this.Qstar = (x, u) => 1 + cache(x, u).reduce((a, [z, p]) => a + p * G[z], 0);
      const body = C.frame(root, "Q-learning", "式 (10.101)：只看模拟器给的 (x, u, x′, l)，不知道转移概率；处处侧滑 0.2（补充）");
      this.st = new C.Stage({ view: [0, 7, 0, 5], aspect: 5 / 7, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { const id = C.cellAt(g, p); if (id !== this.hover) { this.hover = id; this.renderSide(); this.st.draw(); } }, onLeave: () => { this.hover = -1; this.renderSide(); this.st.draw(); } });
      this.sR = C.slider("ρ", 0.02, 0.8, 0.02, this.rho, (v) => { this.rho = v; }, (v) => v.toFixed(2));
      this.chkN = C.checkbox("改用 ρ = 1/n(x,u)", this.useN, (v) => { this.useN = v; });
      this.sE = C.slider("ε-贪心的 ε（补充）", 0, 1, 0.05, this.eps, (v) => { this.eps = v; }, (v) => v.toFixed(2));
      this.stats = { ep: C.stat("轨迹数"), steps: C.stat("模拟步数"), err: C.stat("max |min Q̂ − G*|"), ag: C.stat("贪心动作 = 最优") };
      this.side = h("div", { class: "small", style: "min-height:7.5em" });
      this.chart = h("div", { class: "svg-wrap" });
      body.append(h("div", { class: "controls" }, this.sR, this.chkN, this.sE),
        h("div", { class: "controls" }, C.button("+1 条轨迹", () => this.run(1), "small"), C.button("+100", () => this.run(100), "small"), C.button("+1000", () => this.run(1000), "small primary"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.side, this.chart)),
        C.legend([[C.cva("accent", 0.6), "min_u Q̂(x, u)（越深越大）"], [C.cv("accent"), "贪心动作 argmin_u Q̂"], [C.cv("warn"), "与真正的 π* 不同（外框）"], [C.cv("path"), "上一条轨迹"]]),
        h("p", { class: "small muted", style: "margin:6px 0 0" }, "把鼠标移到格子上看 4 个 Q̂(x, u) 与真值 Q*(x, u)。每条轨迹从随机的自由格子出发，直到到达目标（最多 300 步）。"));
      this.reset();
    }
    reset() {
      const g = this.grid;
      this.Q = new Float64Array(g.N * 5); this.n = new Float64Array(g.N * 5);
      this.r = C.rng(777); this.episodes = 0; this.steps = 0; this.hist = []; this.lastPath = null;
      this.render();
    }
    acts(x) { return this.grid.actions(x, false); }
    minQ(x) { if (this.grid.isGoal(x)) return 0; let m = INF; for (const u of this.acts(x)) m = Math.min(m, this.Q[x * 5 + u]); return m; }
    argminQ(x) { let m = INF, bu = -1; for (const u of this.acts(x)) { const q = this.Q[x * 5 + u]; if (q < m - 1e-12) { m = q; bu = u; } } return bu; }
    episode() {
      const g = this.grid, free = g.freeIds().filter((x) => !g.isGoal(x)), r = this.r;
      let x = free[Math.floor(r() * free.length)]; const path = [x];
      for (let t = 0; t < 300 && !g.isGoal(x); t++) {
        const A = this.acts(x);
        let u;
        if (r() < this.eps) u = A[Math.floor(r() * A.length)];
        else { let m = INF; const best = []; for (const a of A) { const q = this.Q[x * 5 + a]; if (q < m - 1e-12) { m = q; best.length = 0; best.push(a); } else if (Math.abs(q - m) <= 1e-12) best.push(a); } u = best[Math.floor(r() * best.length)]; }
        const y = C.pick(this.cache(x, u), r);                                       // 模拟器给出下一状态
        const k = x * 5 + u; this.n[k]++;
        const rho = this.useN ? 1 / this.n[k] : this.rho;
        this.Q[k] = (1 - rho) * this.Q[k] + rho * (1 + this.minQ(y));               // 式 (10.101)
        x = y; path.push(x); this.steps++;
      }
      this.episodes++; this.lastPath = path;
    }
    run(n) { for (let i = 0; i < n; i++) { this.episode(); if (this.episodes % Math.max(1, Math.round(n / 100)) === 0) this.hist.push([this.episodes, this.metrics().err]); } this.render(); }
    metrics() {
      const g = this.grid; let err = 0, ag = 0, tot = 0;
      for (let x = 0; x < g.N; x++) {
        if (!g.free(x) || g.isGoal(x)) continue;
        err = Math.max(err, Math.abs(this.minQ(x) - this.Gstar[x]));
        const u = this.argminQ(x), qs = this.acts(x).map((a) => this.Qstar(x, a)), best = Math.min(...qs);
        if (u >= 0 && this.Qstar(x, u) <= best + 1e-9) ag++; tot++;
      }
      return { err, ag: ag / tot };
    }
    render() {
      const m = this.metrics();
      this.stats.ep.set(this.episodes); this.stats.steps.set(this.steps);
      this.stats.err.set(m.err.toFixed(3)); this.stats.ag.set(`${Math.round(m.ag * 100)}%`);
      this.chart.innerHTML = "";
      if (this.hist.length > 1) this.chart.append(C.lineChart([{ pts: this.hist, color: "var(--accent)" }], { w: 280, h: 140, xLabel: "轨迹数", yLabel: "max 误差", yMin: 0 }));
      this.renderSide(); this.st.draw();
    }
    renderSide() {
      const x = this.hover, g = this.grid;
      if (x < 0 || !g.free(x) || g.isGoal(x)) { this.side.innerHTML = `G*(0, 0) = ${this.Gstar[0].toFixed(3)}（值迭代，已知转移概率）；min Q̂ 在 (0, 0) = ${this.minQ(0).toFixed(3)}。<br><span class="muted">Q̂ 初值全为 0：代价都是正的，所以 0 是「乐观」的估计，没试过的动作看起来最好——这本身就会推动探索。</span>`; return; }
      const rows = this.acts(x).map((u) => `<tr><td>${C.MOVE_NAME[u]} ${C.ARROW[u]}</td><td class="c">${this.Q[x * 5 + u].toFixed(3)}</td><td class="c">${this.Qstar(x, u).toFixed(3)}</td><td class="c">${this.n[x * 5 + u]}</td></tr>`).join("");
      this.side.innerHTML = `x = (${g.ij(x).join(", ")})，G*(x) = ${this.Gstar[x].toFixed(3)}<table class="data" style="margin-top:4px;font-size:12.5px"><tr><th>u</th><th class="c">Q̂(x,u)</th><th class="c">Q*(x,u)</th><th class="c">次数</th></tr>${rows}</table>`;
    }
    draw(ctx, st, col) {
      const g = this.grid; let vmax = 1; for (let x = 0; x < g.N; x++) if (g.free(x)) vmax = Math.max(vmax, this.Gstar[x]);
      C.drawGrid(st, g, col, {
        fill: (x) => (g.isGoal(x) ? null : C.heat(col, Math.max(0, this.minQ(x)), vmax)),
        label: (x) => (g.isGoal(x) ? "" : this.minQ(x).toFixed(1)), labelSize: Math.max(8, st.scale * 0.2),
        labelColor: () => col.muted,
      });
      for (let x = 0; x < g.N; x++) {
        if (!g.free(x) || g.isGoal(x)) continue;
        const [i, j] = g.ij(x), u = this.argminQ(x);
        if (this.episodes > 0 && u >= 0) {
          C.drawChevron(st, i, j, u, col.accent);
          const qs = this.acts(x).map((a) => this.Qstar(x, a)), best = Math.min(...qs);
          if (this.Qstar(x, u) > best + 1e-9) st.rect(i + 0.05, j + 0.05, i + 0.95, j + 0.95, null, col.warn, 2.2);
        }
      }
      if (this.lastPath) {
        ctx.beginPath(); this.lastPath.forEach((x, k) => { const [i, j] = g.ij(x); const X = st.X(i + 0.5), Y = st.Y(j + 0.5); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.strokeStyle = C.alpha(col.path, 0.6); ctx.lineWidth = 2.5; ctx.stroke();
        const [i0, j0] = g.ij(this.lastPath[0]); st.dot(i0 + 0.5, j0 + 0.5, 5, col.path);
      }
      if (this.hover >= 0 && g.free(this.hover) && !g.isGoal(this.hover)) {
        const x = this.hover, [i, j] = g.ij(x);
        st.rect(i, j, i + 1, j + 1, null, col.text, 2);
        for (const u of this.acts(x)) { const [dx, dy] = C.MOVES[u]; st.text(this.Q[x * 5 + u].toFixed(1), i + 0.5 + dx * 0.36, j + 0.5 + dy * 0.34, col.accentText, { size: 10, weight: 700 }); }
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='td-eval']").forEach((el) => el._w = new TDEval(el));
    document.querySelectorAll("[data-widget='q-learning']").forEach((el) => el._w = new QLearning(el));
  });
})();
