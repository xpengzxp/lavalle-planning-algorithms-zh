/* 14.3 节：X 上的距离（理想距离 vs 加权欧氏，图示 Dubins 车）；系统模拟器（Euler、RK4、反向积分） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // ---------------------------------------------------------------
  // 组件：理想距离函数 vs 加权欧氏度量（14.3.1 节「The ideal distance function」）
  // Dubins 车的理想距离（忽略障碍）= 最短路径长度，来自 15.3.1 节（补充）
  // ---------------------------------------------------------------
  class MetricDubins {
    constructor(root) {
      this.th = 0; this.w = 1; this.metric = "dubins"; this.dir = "from"; this.hover = { x: -1.2, y: 0.4 };
      const body = C.frame(root, "X 上的「距离」：理想距离 vs 加权欧氏", "车在原点朝右；颜色 = 到 (x, y, θ) 的距离，θ 由滑块给定；鼠标处画出最短路径");
      this.st = new C.Stage({ view: [-4, 4, -4, 4], maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col), onHover: (p) => { this.hover = p; this.render(false); } });
      this.segM = C.seg([["dubins", "Dubins 最短路径长度（理想距离，忽略障碍）"], ["euclid", "加权欧氏 √(Δx²+Δy²+(cΔθ)²)"]], this.metric, (k) => { this.metric = k; this.render(true); });
      this.segD = C.seg([["from", "从车 q₀ 到 q"], ["to", "从 q 到车 q₀"]], this.dir, (k) => { this.dir = k; this.render(true); });
      this.sTh = C.slider("目标朝向 θ", -180, 180, 5, 0, (v) => { this.th = (v * Math.PI) / 180; this.render(true); }, (v) => v + "°");
      this.sW = C.slider("权重 c", 0, 3, 0.1, this.w, (v) => { this.w = v; this.render(true); }, (v) => v.toFixed(1));
      this.stats = { d1: C.stat("ρ(q₀, q)"), d2: C.stat("ρ(q, q₀)"), eu: C.stat("欧氏距离 ‖Δ(x,y)‖") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.segD, this.sTh, this.sW),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cv("accent"), "距离（由浅到深 = 由近到远）"], [C.cv("path"), "鼠标处的 Dubins 最短路径"]]))));
      this.render(true);
    }
    dist(a, b) {
      if (this.metric === "dubins") return C.dubins(a, b, 1).L;
      return Math.hypot(a.x - b.x, a.y - b.y, this.w * C.angDiff(a.th, b.th));
    }
    compute() {
      const n = (this.n = 120), V = new Float32Array(n * n), q0 = { x: 0, y: 0, th: 0 };
      let mx = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const q = { x: -4 + ((i + 0.5) / n) * 8, y: -4 + ((j + 0.5) / n) * 8, th: this.th };
        const d = this.dir === "from" ? this.dist(q0, q) : this.dist(q, q0);
        V[j * n + i] = d; if (d > mx) mx = d;
      }
      this.V = V; this.mx = Math.max(mx, 1);
    }
    render(full) {
      if (full) this.compute();
      const q0 = { x: 0, y: 0, th: 0 }, q = { x: this.hover.x, y: this.hover.y, th: this.th };
      const d1 = C.dubins(q0, q, 1), d2 = C.dubins(q, q0, 1);
      this.path1 = C.dubinsSample(q0, d1.word, d1.seg, 1, 0.03);
      this.stats.d1.set(`${d1.L.toFixed(3)} <span class="muted">(${d1.word})</span>`); this.stats.d2.set(`${d2.L.toFixed(3)} <span class="muted">(${d2.word})</span>`);
      this.stats.eu.set(Math.hypot(q.x, q.y).toFixed(3));
      this.msg.innerHTML = this.metric === "dubins" ?
        "理想的距离是从 x 到 x′ 的<b>最优代价到达</b>（这里忽略障碍、取路径长度）——文献里叫非完整度量、Carnot–Carathéodory 度量或次黎曼度量。它<b>不对称</b>：车正前方很近，正后方哪怕只差一点也要绕一圈（约 2π）。把鼠标移到车的正后方，比较上面两个数。" :
        "加权欧氏（Mahalanobis）度量把位置差和朝向差硬凑在一起：它对称、处处光滑，但完全不知道车不能侧移、不能倒车——车正后方 0.1 处它认为几乎为 0。调 c 也救不了：无论怎么加权，「侧方一点点」和「后方一点点」都会被算得很近。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.V) {
        const n = this.n, bands = 14, mx = this.mx;
        C.heat(st, n, n, [-4, 4, -4, 4], this.V, (v) => { const t = Math.floor((v / mx) * bands) / bands; const c = C.blueRamp(col, t); return [c[0], c[1], c[2], 255]; });
      }
      // 当前朝向的小箭头阵列：提示「到这些位置时车头朝 θ」
      for (let x = -3.5; x <= 3.5; x += 1) for (let y = -3.5; y <= 3.5; y += 1) st.arrow({ x, y }, { x: x + 0.3 * Math.cos(this.th), y: y + 0.3 * Math.sin(this.th) }, C.alpha(col.text, 0.35), 1, 4);
      if (this.path1) st.polyline(this.path1, col.path, 2.6);
      st.car({ x: 0, y: 0, th: 0 }, 0.45, col.alive, col.text);
      st.car({ x: this.hover.x, y: this.hover.y, th: this.th }, 0.35, C.alpha(col.goal, 0.8), col.goal);
    }
  }

  // ---------------------------------------------------------------
  // 组件：系统模拟器——Euler (14.16) vs 四阶 Runge–Kutta (14.18)(14.19)，反向积分 (14.20)
  // ---------------------------------------------------------------
  const SIMS = {
    single: { name: "单积分器 q̇ = u", n: 1, u: Math.cos, exact: (t) => [Math.sin(t)], plot: "time", T: 6 },
    double: { name: "双积分器 q̈ = u", n: 2, u: Math.cos, exact: (t) => [1 - Math.cos(t), Math.sin(t)], plot: "time", T: 6 },
    triple: { name: "三积分器 q⁽³⁾ = u（习题 8）", n: 3, u: Math.cos, exact: (t) => [t - Math.sin(t), 1 - Math.cos(t), Math.sin(t)], plot: "time", T: 6 },
    spring: { name: "弹簧 q̈ = −q（相平面）", n: 2, u: () => 0, exact: (t) => [Math.cos(t), -Math.sin(t)], plot: "phase", T: 2 * Math.PI, x0: [1, 0] },
  };
  class Integrators {
    constructor(root) {
      this.sys = "spring"; this.hh = 0.3;
      const body = C.frame(root, "系统模拟器：Euler vs Runge–Kutta", "积分器链的输入取 u(t) = cos t（可以算出精确解）；弹簧没有输入");
      this.st = new C.Stage({ view: [-1.6, 1.6, -1.6, 1.6], aspect: 0.85, maxW: 440, stretch: true, padL: 30, padB: 20, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.err = new C.Stage({ view: [-6.5, 0.5, -16, 1], aspect: 0.85, maxW: 380, stretch: true, padL: 34, padB: 20, onDraw: (ctx, st, col) => this.drawErr(ctx, st, col) });
      this.sel = C.select(Object.entries(SIMS).map(([k, s]) => [k, s.name]), this.sys, (k) => { this.sys = k; this.render(); });
      this.sH = C.slider("步长 Δt（模拟器内部）", 0.02, 1, 0.01, this.hh, (v) => { this.hh = v; this.render(); }, (v) => v.toFixed(2));
      this.stats = { eE: C.stat("Euler 终点误差"), eR: C.stat("RK4 终点误差"), back: C.stat("RK4 正向再反向：回到 x(0) 的误差") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "系统 ", this.sel), this.sH),
        h("div", { class: "split" }, this.st.wrap, this.err.wrap), h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("text2"), "精确解"], [C.cv("warn"), "Euler", true], [C.cv("accent"), "RK4", true]]));
      this.render();
    }
    f(S) { if (this.sys === "spring") return (x) => [x[1], -x[0]]; return (x, u) => x.slice(1).concat([u]); }
    run(method, hh, T, x0, back) {
      const S = SIMS[this.sys], f = this.f(S), N = Math.max(1, Math.round(T / hh)), dt = T / N;
      const step = method === "euler" ? C.eulerStep : C.rk4Step;
      let x = x0.slice(); const out = [{ t: 0, x }];
      for (let k = 0; k < N; k++) {
        const t = k * dt, sign = back ? -1 : 1;
        // 反向积分 (14.20)：对 −f 正向积分；输入按时间倒放
        const g = back ? (xx, u) => f(xx, u).map((v) => -v) : f;
        const uf = back ? (s) => S.u(T - t - s) : (s) => S.u(t + s);
        x = step(g, x, uf, dt); out.push({ t: t + dt, x });
        void sign;
      }
      return out;
    }
    x0() { const S = SIMS[this.sys]; return S.x0 ? S.x0.slice() : new Array(S.n).fill(0); }
    err0(method, hh) {
      const S = SIMS[this.sys], tr = this.run(method, hh, S.T, this.x0()), xe = S.exact(S.T), x = tr[tr.length - 1].x;
      if (this.sys === "spring") return Math.hypot(x[0] - xe[0], x[1] - xe[1]);
      return Math.abs(x[0] - xe[0]);
    }
    render() {
      const S = SIMS[this.sys];
      this.trE = this.run("euler", this.hh, S.T, this.x0()); this.trR = this.run("rk4", this.hh, S.T, this.x0());
      const eE = this.err0("euler", this.hh), eR = this.err0("rk4", this.hh);
      const back = this.run("rk4", this.hh, S.T, this.trR[this.trR.length - 1].x, true);
      const xb = back[back.length - 1].x, x0 = this.x0();
      this.stats.eE.set(eE.toExponential(2)); this.stats.eR.set(eR.toExponential(2));
      this.stats.back.set(Math.hypot(...xb.map((v, i) => v - x0[i])).toExponential(1));
      this.curve = [];
      for (let k = -6; k <= 0; k += 0.5) { const hh = Math.pow(2, k); this.curve.push({ k, e: Math.max(1e-16, this.err0("euler", hh)), r: Math.max(1e-16, this.err0("rk4", hh)) }); }
      if (S.plot === "phase") this.st.setView([-2.6, 2.6, -2.6, 2.6]);
      else { let lo = Infinity, hi = -Infinity; for (let t = 0; t <= S.T; t += 0.05) { const v = S.exact(t)[0]; lo = Math.min(lo, v); hi = Math.max(hi, v); } for (const p of this.trE) { lo = Math.min(lo, p.x[0]); hi = Math.max(hi, p.x[0]); } const pad = (hi - lo) * 0.1 + 0.1; this.st.setView([0, S.T, lo - pad, hi + pad]); }
      this.msg.innerHTML = (this.sys === "spring" ? `相轨迹应当是单位圆。Euler 每一步把半径放大 √(1 + Δt²)，转一圈后离圆心 ${Math.hypot(...this.trE[this.trE.length - 1].x).toFixed(3)}：误差会<b>累积</b>，模拟器给出的「状态轨迹」可能根本不在真实的可达集里。` :
        "Euler 只用了 Taylor 展开 (14.17) 的第一项，误差是 O(Δt)；RK4 在 0、Δt/2、Δt 三个时刻各取一次动作，误差 O(Δt⁴)。") +
        " 右图是终点误差对 Δt 的对数图：Euler 的斜率约为 1，RK4 约为 4（太小时被浮点误差托底）。<span class=\"muted\">（补充：动作在 [0, Δt) 上为常数时，RK4 对 4 阶以内的积分器链是精确的，所以这里特意用 u(t) = cos t。）</span>";
      this.st.draw(); this.err.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const S = SIMS[this.sys];
      if (S.plot === "phase") {
        st.axes(col, { xlabel: "q", ylabel: "q̇", xticks: [-2, -1, 0, 1, 2], yticks: [-2, -1, 0, 1, 2] });
        const ex = []; for (let t = 0; t <= S.T + 1e-9; t += 0.02) { const e = S.exact(t); ex.push({ x: e[0], y: e[1] }); }
        st.polyline(ex, col.text2, 1.5);
        st.polyline(this.trE.map((p) => ({ x: p.x[0], y: p.x[1] })), col.warn, 1.6); for (const p of this.trE) st.dot({ x: p.x[0], y: p.x[1] }, 2.6, col.warn);
        st.polyline(this.trR.map((p) => ({ x: p.x[0], y: p.x[1] })), col.accent, 1.6); for (const p of this.trR) st.dot({ x: p.x[0], y: p.x[1] }, 2.6, col.accent);
        st.dot({ x: 1, y: 0 }, 5, null, col.start, 2);
      } else {
        st.axes(col, { xlabel: "t", ylabel: "q(t)" });
        const ex = []; for (let t = 0; t <= S.T + 1e-9; t += 0.03) ex.push({ x: t, y: S.exact(t)[0] });
        st.polyline(ex, col.text2, 1.5);
        st.polyline(this.trE.map((p) => ({ x: p.t, y: p.x[0] })), col.warn, 1.4); for (const p of this.trE) st.dot({ x: p.t, y: p.x[0] }, 2.6, col.warn);
        st.polyline(this.trR.map((p) => ({ x: p.t, y: p.x[0] })), col.accent, 1.4); for (const p of this.trR) st.dot({ x: p.t, y: p.x[0] }, 2.6, col.accent);
      }
    }
    drawErr(ctx, st, col) {
      st.frame(col);
      st.axes(col, { xticks: [-6, -4, -2, 0], yticks: [-15, -12, -9, -6, -3, 0], xlabel: "log₂ Δt", ylabel: "log₁₀ 误差", zero: false });
      const L = (v) => Math.log10(v);
      st.polyline(this.curve.map((c) => ({ x: c.k, y: L(c.e) })), col.warn, 2); for (const c of this.curve) st.dot({ x: c.k, y: L(c.e) }, 2.5, col.warn);
      st.polyline(this.curve.map((c) => ({ x: c.k, y: L(c.r) })), col.accent, 2); for (const c of this.curve) st.dot({ x: c.k, y: L(c.r) }, 2.5, col.accent);
      const k = Math.log2(this.hh); st.line({ x: k, y: -16 }, { x: k, y: 1 }, col.current, 1.2, [4, 4]);
      // 参考斜率：误差 ∝ Δt¹ 与 Δt⁴（在 log₂ Δt 轴上，每格 Δt 翻倍误差 ×2 与 ×16）
      const a = this.curve[this.curve.length - 1];
      st.line({ x: 0, y: L(a.e) - 0.3 }, { x: -6, y: L(a.e) - 0.3 - 6 * Math.log10(2) }, C.alpha(col.warn, 0.45), 1, [3, 3]);
      st.line({ x: 0, y: L(a.r) - 0.3 }, { x: -3, y: L(a.r) - 0.3 - 12 * Math.log10(2) }, C.alpha(col.accent, 0.45), 1, [3, 3]);
      st.text("斜率 1", { x: -4.6, y: L(a.e) - 0.3 - 4.6 * Math.log10(2) - 0.9 }, col.warn, { size: 10.5 });
      st.text("斜率 4", { x: -2.4, y: L(a.r) - 0.3 - 9.6 * Math.log10(2) - 1.0 }, col.accent, { size: 10.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='metric-dubins']").forEach((el) => el._w = new MetricDubins(el));
    document.querySelectorAll("[data-widget='integrators']").forEach((el) => el._w = new Integrators(el));
  });
})();
