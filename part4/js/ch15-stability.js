/* 15.1 节：稳定性的 ε–δ 定义、吸引域与极限环、线性系统特征值、Lyapunov 函数、能控性（Kalman 秩条件）、小时间可达集 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH15;

  // 在舞台上画归一化的「针」表示向量场
  function needles(st, col, f, n, color) {
    const [x0, x1, y0, y1] = st.view, dx = (x1 - x0) / n, len = dx * 0.38;
    for (let x = x0 + dx / 2; x < x1; x += dx) for (let y = y0 + dx / 2; y < y1; y += dx) {
      const v = f(x, y), m = Math.hypot(v[0], v[1]);
      if (!(m > 1e-9) || !isFinite(m)) { st.dot({ x, y }, 1.4, color); continue; }
      const ux = v[0] / m * len, uy = v[1] / m * len;
      st.arrow({ x: x - ux / 2, y: y - uy / 2 }, { x: x + ux / 2, y: y + uy / 2 }, color, 1, 4.5);
    }
  }
  const field2 = (F) => (t, s) => F(s[0], s[1]);
  // 一条积分曲线：返回点列
  function curve(F, p, T, n, bound) {
    const tr = C.integrate(field2(F), [p.x, p.y], T, n, 2, (s) => Math.abs(s[0]) > bound || Math.abs(s[1]) > bound);
    return tr.map((k) => ({ x: k.x[0], y: k.x[1], t: k.t }));
  }

  // ===============================================================
  // 组件 1：稳定性的定义（图 15.1、式 15.2）
  // ===============================================================
  const STAB = {
    focus: { name: "稳定焦点", f: (x, y) => [-0.3 * x + y, -x - 0.3 * y], g: [0, 0], note: "线性场 A = [[−0.3, 1], [−1, −0.3]]，特征值 −0.3 ± i：渐近稳定，而且是指数稳定（m = 1、α = 0.3 就满足 (15.2)）。" },
    center: { name: "中心（无阻尼振子）", f: (x, y) => [y, -x], g: [0, 0], note: "ẋ = y, ẏ = −x：积分曲线是同心圆。取 δ = ε 就行，所以是 Lyapunov 稳定；但永远不收敛，不是渐近稳定。" },
    cubic: { name: "立方阻尼", f: (x, y) => { const r2 = x * x + y * y; return [y - x * r2, -x - y * r2]; }, g: [0, 0], note: "极坐标下 ṙ = −r³、θ̇ = −1，r(t) = r₀/√(1 + 2r₀²t)：渐近稳定，但只按 t^(−1/2) 衰减，不是指数稳定。对数坐标里的曲线会越来越平。（补充例子）" },
    unstable: { name: "不稳定焦点", f: (x, y) => [0.15 * x + y, -x + 0.15 * y], g: [0, 0], note: "特征值 0.15 ± i，实部为正：任何 δ 都不行，不是 Lyapunov 稳定。" },
    attract: { name: "吸引但不稳定（补充）", T: 150, noDelta: true, f: (x, y) => { const r = Math.hypot(x, y), th = Math.atan2(y, x), rd = r * (1 - r), td = Math.pow(Math.sin(th / 2), 2); return [rd * Math.cos(th) - r * td * Math.sin(th), rd * Math.sin(th) + r * td * Math.cos(th)]; }, g: [1, 0],
      note: "ṙ = r(1 − r)、θ̇ = sin²(θ/2)，x_G = (1, 0)。除原点外每条积分曲线都收敛到 x_G（满足渐近稳定的第 2 条），但从 x_G 上方一点点出发的会绕单位圆一整圈才回来——任何 δ 都管不住，第 1 条失败。这正是书中说「两条要求都需要」的原因。θ 的方程可以精确积分：cot(θ/2) = cot(θ₀/2) − t/2，所以 θ₀ ∈ (0, 2π) 的点迟早都会经过 θ = π（离 x_G 的距离约为 2）；θ₀ 越小绕得越晚，有限时间的数值检查看不出来，这里的 δ 结论按这个解析结果给出。点在 x_G 正上方 0.1 左右的位置试试（积分 150 秒）。" },
  };
  class StabilityDef {
    constructor(root) {
      this.key = "focus"; this.eps = 0.6; this.trajs = []; this.last = null;
      const body = C.frame(root, "Lyapunov 稳定、渐近稳定、指数稳定", "点画布放初始点 x_I；拖动 ε 看能否找到 δ");
      this.st = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], maxW: 470, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.launch(p); return null; }, cursor: () => "crosshair" });
      this.plot = new C.Plot({ aspect: 0.55, maxW: 380, xlim: [0, 30], ylim: [-4, 0.5], xlab: "t", ylab: "lg d" });
      this.sel = C.select(Object.entries(STAB).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.trajs = []; this.last = null; this.update(); });
      this.sEps = C.slider("ε =", 0.15, 1.5, 0.05, this.eps, (v) => { this.eps = v; this.update(); }, (v) => v.toFixed(2));
      this.stats = [C.stat("最大的 δ（数值）"), C.stat("O₂ 的判断"), C.stat("最近一条：t=30 时距离")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, this.sEps, C.button("清除轨迹", () => { this.trajs = []; this.last = null; this.update(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap,
          h("p", { class: "small muted" }, "右图是最近一条积分曲线到 x_G 的距离 d 的常用对数 lg d。指数稳定 ⇔ 曲线被一条斜率为负的直线 log m − αt/ln10 压在下面。"))),
        this.note, C.legend([[C.cv("bad"), "O₁ = ε 球"], [C.cv("ok"), "O₂ = δ 球（数值找到的最大者）"], [C.cv("accent"), "积分曲线"], [C.cv("goal"), "x_G"]]));
      this.update();
    }
    get S() { return STAB[this.key]; }
    // 数值找 δ：半径为 r 的圆上 64 个点出发，30 秒内都不离开 ε 球
    findDelta() {
      const S = this.S, g = { x: S.g[0], y: S.g[1] }, eps = this.eps;
      if (S.noDelta) return 0;
      const ok = (r) => {
        for (let k = 0; k < 64; k++) {
          const a = C.TAU * k / 64, p = { x: g.x + r * Math.cos(a), y: g.y + r * Math.sin(a) };
          const tr = curve(S.f, p, 30, 1500, 50);
          if (tr.some((q) => Math.hypot(q.x - g.x, q.y - g.y) > eps)) return false;
        }
        return true;
      };
      if (!ok(0.02 * eps)) return 0;
      let lo = 0.02 * eps, hi = eps;
      if (ok(hi)) return hi;
      for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
      return lo;
    }
    launch(p) {
      const T = this.S.T || 30, tr = curve(this.S.f, p, T, T * 100, 50);
      this.trajs.push(tr); if (this.trajs.length > 8) this.trajs.shift();
      this.last = tr; this.update(true);
    }
    update(keepDelta) {
      if (!keepDelta) this.delta = this.findDelta();
      const S = this.S;
      this.stats[0].set(this.delta > 0 ? this.delta.toFixed(3) : "不存在");
      this.stats[1].set(this.delta > 0 ? "<span class='yes'>找到了</span>" : "<span class='no'>找不到</span>");
      if (this.last) {
        const L = this.last[this.last.length - 1], d = Math.hypot(L.x - S.g[0], L.y - S.g[1]);
        const T = S.T || 30;
        this.stats[2].key(`最近一条：t=${T} 时距离`);
        this.stats[2].set(this.last[this.last.length - 1].t < T - 0.1 ? "飞出画面" : d.toExponential(2));
        this.plot.set({ xlim: [0, T], series: [{ pts: this.last.map((q) => [q.t, Math.log10(Math.max(1e-12, Math.hypot(q.x - S.g[0], q.y - S.g[1])))]), ckey: "accent" }] });
      } else { this.stats[2].set("–"); this.plot.set({ series: [] }); }
      this.note.innerHTML = S.note;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const S = this.S, g = { x: S.g[0], y: S.g[1] };
      needles(st, col, S.f, 17, C.alpha(col.muted, 0.7));
      if (this.key === "attract") st.circle({ x: 0, y: 0 }, 1, col.strong, 1, null, [4, 4]);
      st.circle(g, this.eps, col.bad, 2, C.alpha(col.bad, 0.06));
      if (this.delta > 0) st.circle(g, this.delta, col.ok, 2, C.alpha(col.ok, 0.12));
      st.text("O₁", { x: g.x + this.eps * 0.72, y: g.y + this.eps * 0.72 }, col.bad, { weight: 700, dx: 8 });
      if (this.delta > 0) st.text("O₂", { x: g.x - this.delta * 0.7, y: g.y - this.delta * 0.7 }, col.ok, { weight: 700, dx: -8 });
      this.trajs.forEach((tr, i) => {
        st.polyline(tr, i === this.trajs.length - 1 ? col.accent : C.alpha(col.accent, 0.45), i === this.trajs.length - 1 ? 2.2 : 1.4);
        st.dot(tr[0], 4, col.start, col.surface, 1.5);
      });
      st.dot(g, 6, col.goal, col.surface, 2); st.text("x_G", g, col.goal, { dy: 14, weight: 650 });
    }
  }

  // ===============================================================
  // 组件 2：吸引域与极限环
  // ===============================================================
  const ATTR = {
    pendulum: { name: "阻尼单摆（多个平衡点）", view: [-9, 9, -4.5, 4.5], f: (x, y) => [y, -Math.sin(x) - 0.25 * y],
      cls: (s) => (Math.abs(s[1]) < 0.2 ? Math.round(s[0] / C.TAU) : null), ncls: 3, labels: (k) => `收敛到 (${k === 0 ? "0" : (k > 0 ? "" : "−") + (Math.abs(k) === 1 ? "" : Math.abs(k)) + "2π"}, 0)`,
      note: "平衡点 (2kπ, 0) 都渐近稳定，(π + 2kπ, 0) 是鞍点。每个稳定平衡点的吸引域是缠绕在一起的螺旋带——都只是局部的。" },
    bistable: { name: "双稳态 ẋ = x − x³, ẏ = −y", view: [-2.2, 2.2, -2.2, 2.2], f: (x, y) => [x - x * x * x, -y], cls: (s) => (Math.abs(s[0] - 1) < 0.1 ? 1 : Math.abs(s[0] + 1) < 0.1 ? -1 : null), ncls: 1,
      labels: (k) => (k > 0 ? "收敛到 (1, 0)" : "收敛到 (−1, 0)"), note: "(±1, 0) 都渐近稳定，吸引域各占半个平面；y 轴上的点收敛到鞍点 (0, 0)。" },
    disk: { name: "有界吸引域 ṙ = −r(1 − r²)", view: [-2.2, 2.2, -2.2, 2.2], f: (x, y) => { const r2 = x * x + y * y; return [-x * (1 - r2) - 0.6 * y, -y * (1 - r2) + 0.6 * x]; },
      cls: (s) => (Math.hypot(s[0], s[1]) < 0.05 ? 0 : Math.hypot(s[0], s[1]) > 3 ? 9 : null), ncls: 1, labels: (k) => (k === 0 ? "收敛到原点" : "发散"),
      note: "原点渐近稳定，但吸引域只是单位圆盘（局部）；圆外的点飞向无穷，单位圆本身是一个不稳定的极限环。" },
    cycle: { name: "稳定极限环 ṙ = r(1 − r²)", view: [-2.2, 2.2, -2.2, 2.2], f: (x, y) => { const r2 = x * x + y * y; return [x * (1 - r2) - y, y * (1 - r2) + x]; },
      cls: (s) => (Math.abs(Math.hypot(s[0], s[1]) - 1) < 0.05 ? 1 : null), ncls: 1, labels: () => "趋于单位圆",
      note: "原点是不稳定平衡点；除原点外所有积分曲线都被吸引到单位圆上转圈——收敛到一条回路而不是一个点。" },
    vdp: { name: "Van der Pol（μ = 1）", view: [-4, 4, -4, 4], f: (x, y) => [y, (1 - x * x) * y - x], cls: () => 1, ncls: 1, labels: () => "趋于极限环",
      note: "机械振荡里常见的极限环；环的形状不是圆。" },
  };
  class Attraction {
    constructor(root) {
      this.key = "pendulum"; this.trajs = [];
      const body = C.frame(root, "吸引域与极限环", "底色 = 从该点出发最后去了哪里；点画布画积分曲线");
      this.st = new C.Stage({ view: ATTR.pendulum.view, aspect: 0.62, maxW: 720, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.trajs.push(curve(this.S.f, p, 40, 4000, 40)); if (this.trajs.length > 10) this.trajs.shift(); this.st.draw(); return null; }, cursor: () => "crosshair" });
      this.sel = C.seg(Object.entries(ATTR).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.trajs = []; this.compute(); });
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel), this.st.wrap, this.note);
      this.compute();
    }
    get S() { return ATTR[this.key]; }
    compute() {
      const S = this.S; this.st.setView(S.view);
      const [x0, x1, y0, y1] = S.view, nx = 90, ny = Math.round(nx * (y1 - y0) / (x1 - x0));
      this.G = C.sampleGrid((x, y) => {
        let s = [x, y];
        for (let k = 0; k < 600; k++) { s = C.rk4Step(field2(S.f), 0, s, 0.05); if (!isFinite(s[0]) || Math.abs(s[0]) > 1e3) return 9; }
        const c = S.cls(s); return c === null ? NaN : c;
      }, nx, ny, S.view);
      this.note.innerHTML = S.note;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const pal = [col.accent, col.warn, col.ok, col.alive2, col.goal];
      C.drawHeat(st, this.G, (v) => {
        if (!isFinite(v)) return [...C.rgb(col.surface), 255];
        if (v === 9) return [...C.mixRGB(col.surface, col.bad, 0.28), 255];
        const c = pal[((v % 5) + 5) % 5];
        return [...C.mixRGB(col.surface, c, 0.3), 255];
      });
      st.grid(col, this.key === "pendulum" ? Math.PI : 1, { axes: true });
      needles(st, col, this.S.f, this.key === "pendulum" ? 30 : 18, C.alpha(col.text2, 0.55));
      if (this.key === "cycle" || this.key === "disk") st.circle({ x: 0, y: 0 }, 1, this.key === "cycle" ? col.ok : col.bad, 2.2, null, this.key === "disk" ? [6, 4] : null);
      for (const tr of this.trajs) { st.polyline(tr, col.text, 1.6); st.dot(tr[0], 3.5, col.start); }
      if (this.key === "pendulum") for (let k = -1; k <= 1; k++) { st.dot({ x: k * C.TAU, y: 0 }, 4.5, col.ok, col.surface, 1.5); st.dot({ x: Math.PI + k * C.TAU, y: 0 }, 3.5, null, col.bad, 1.5); }
      if (this.key === "bistable") { st.dot({ x: 1, y: 0 }, 4.5, col.ok, col.surface, 1.5); st.dot({ x: -1, y: 0 }, 4.5, col.ok, col.surface, 1.5); st.dot({ x: 0, y: 0 }, 3.5, null, col.bad, 1.5); }
    }
  }

  // ===============================================================
  // 组件 3：线性系统 ẋ = Ax 的特征值
  // ===============================================================
  const LIN = {
    focus: { name: "稳定焦点", A: [[-0.5, 1], [-1, -0.5]] }, node: { name: "稳定结点", A: [[-1, 0], [0, -0.3]] }, center: { name: "中心", A: [[0, 1], [-1, 0]] },
    saddle: { name: "鞍点", A: [[1, 0], [0, -1]] }, ufocus: { name: "不稳定焦点", A: [[0.3, 1], [-1, 0.3]] }, zero: { name: "零矩阵", A: [[0, 0], [0, 0]] }, jordan: { name: "Jordan 块", A: [[0, 1], [0, 0]] },
  };
  class LinearEig {
    constructor(root) {
      this.A = LIN.focus.A.map((r) => r.slice());
      const body = C.frame(root, "线性系统 ẋ = Ax：特征值决定稳定性", "拖滑块改 A 的四个元素，或选一个预设");
      this.st = new C.Stage({ view: [-2.5, 2.5, -2.5, 2.5], maxW: 430, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.ev = new C.Stage({ view: [-2.6, 2.6, -2.2, 2.2], maxW: 300, aspect: 0.85, onDraw: (ctx, st, col) => this.drawEig(ctx, st, col) });
      this.sl = [];
      const names = [["a₁₁", 0, 0], ["a₁₂", 0, 1], ["a₂₁", 1, 0], ["a₂₂", 1, 1]];
      for (const [nm, i, j] of names) this.sl.push(C.slider(nm, -2, 2, 0.05, this.A[i][j], (v) => { this.A[i][j] = v; this.preset.set(null); this.update(); }, (v) => v.toFixed(2)));
      this.preset = C.seg(Object.entries(LIN).map(([k, v]) => [k, v.name]), "focus", (k) => { this.A = LIN[k].A.map((r) => r.slice()); this.sl.forEach((s, n) => s.setValue(this.A[names[n][1]][names[n][2]])); this.update(); });
      this.verdict = h("div", { class: "msg info" });
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.preset), h("div", { class: "controls" }, ...this.sl),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "small muted" }, "特征值（复平面；绿色 = 左半平面）"), this.ev.wrap, this.verdict, this.note)));
      this.update();
    }
    classify() {
      const A = this.A, e = C.eig2(A), tol = 1e-9;
      const re = Math.max(e[0].re, e[1].re);
      if (re < -tol) return { cls: "ok", txt: "所有特征值实部 < 0：x = 0 渐近稳定（线性时也就是指数稳定、全局）。" };
      if (re > tol) return { cls: "bad", txt: "有特征值实部 > 0：不稳定。" };
      // 有零实部的特征值
      const zeroRe = e.filter((z) => Math.abs(z.re) <= tol);
      const repeated = Math.abs(e[0].re - e[1].re) < tol && Math.abs(e[0].im - e[1].im) < tol;
      if (repeated && zeroRe.length === 2) {
        const isZero = A.every((r) => r.every((v) => Math.abs(v) < tol));
        return isZero ? { cls: "info", txt: "两个特征值都是 0（重根），但 A = 0 可对角化：每个点都不动，Lyapunov 稳定、不渐近稳定。书中「零实部的特征值是互异根」只是充分条件，这个例子不满足它却仍稳定（补充）。" }
          : { cls: "bad", txt: "0 是二重根且 A 不可对角化（Jordan 块）：e^{At} 里出现 t 项，解线性增长——不是 Lyapunov 稳定。这就是书中要求「零实部的特征值是特征多项式的互异根」的原因。" };
      }
      return { cls: "info", txt: "实部 ≤ 0，零实部的特征值互不相同：Lyapunov 稳定，但不是渐近稳定（有不衰减的模态）。" };
    }
    update() {
      const e = C.eig2(this.A), f = (z) => `${z.re.toFixed(2)}${z.im >= 0 ? "+" : "−"}${Math.abs(z.im).toFixed(2)}i`;
      const c = this.classify();
      this.verdict.className = "msg " + c.cls; this.verdict.innerHTML = c.txt;
      this.note.innerHTML = `λ₁ = ${f(e[0])}，λ₂ = ${f(e[1])}；tr A = ${(this.A[0][0] + this.A[1][1]).toFixed(2)}，det A = ${(this.A[0][0] * this.A[1][1] - this.A[0][1] * this.A[1][0]).toFixed(2)}。标量情形 ẋ = ax 的解是 x(0)e^{at}，a < 0 才收敛——每个特征值各管一个这样的「模态」。`;
      this.st.draw(); this.ev.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const A = this.A, F = (x, y) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
      needles(st, col, F, 15, C.alpha(col.muted, 0.65));
      for (let k = 0; k < 12; k++) {
        const a = C.TAU * k / 12 + 0.13, p = { x: 2 * Math.cos(a), y: 2 * Math.sin(a) };
        st.polyline(curve(F, p, 12, 1200, 6), C.alpha(col.accent, 0.85), 1.5); st.dot(p, 2.5, col.start);
        st.polyline(curve(F, { x: 0.5 * Math.cos(a + 0.26), y: 0.5 * Math.sin(a + 0.26) }, 12, 1200, 6), C.alpha(col.accent, 0.5), 1.2);
      }
      st.dot({ x: 0, y: 0 }, 5, col.goal, col.surface, 1.5);
    }
    drawEig(ctx, st, col) {
      st.frame(col);
      st.poly([{ x: -2.6, y: -2.2 }, { x: 0, y: -2.2 }, { x: 0, y: 2.2 }, { x: -2.6, y: 2.2 }], C.alpha(col.ok, 0.12));
      st.grid(col, 1, { labels: true });
      st.text("Re", { x: 2.5, y: 0 }, col.muted, { dy: -9, size: 11 }); st.text("Im", { x: 0, y: 2.1 }, col.muted, { dx: 12, size: 11 });
      const e = C.eig2(this.A);
      e.forEach((z, i) => { const p = { x: C.clamp(z.re, -2.5, 2.5), y: C.clamp(z.im, -2.1, 2.1) }; st.dot(p, i ? 6 : 8, i ? col.alive2 : null, col.alive2, 2.2); });
    }
  }

  // ===============================================================
  // 组件 4：Lyapunov 函数实验室（式 15.3 与 Lyapunov 定理）
  // ===============================================================
  const LYAP = {
    s1: { name: "ẋ=−x+y, ẏ=−x−y³", f: (x, y) => [-x + y, -x - y * y * y], M: [1, 0, 1], note: "取 φ = x² + y²：φ̇ = −2x² − 2y⁴，除原点外处处 < 0，φ 与 −φ̇ 都全局正定 ⇒ 全局渐近稳定。" },
    s2: { name: "阻尼振子 ẋ=y, ẏ=−x−y", lin: [[0, 1], [-1, -1]], f: (x, y) => [y, -x - y], M: [1, 0, 1], note: "φ = x² + y² 给出 φ̇ = −2y²：只是 ≤ 0（x 轴上等于 0），定理只能推出 Lyapunov 稳定。把 m₁₂ 调到 0.5 左右再看——同一个系统，换一个候选函数就证出了渐近稳定（或者用 LaSalle 不变原理）。" },
    s3: { name: "ẋ=−x+4y, ẏ=−x−y", lin: [[-1, 4], [-1, -1]], f: (x, y) => [-x + 4 * y, -x - y], M: [1, 0, 1], note: "特征值 −1 ± 2i，系统明明渐近稳定，可 φ = x² + y² 在斜线方向上 φ̇ > 0（红色）——候选函数失败不说明系统不稳定（Lyapunov 函数是充分条件）。点「解 Lyapunov 方程」：对线性系统解 AᵀM + MA = −I 总能找到一个合格的二次型。" },
    s4: { name: "ẋ=−x⁵, ẏ=−y（例 15.1 的二维版）", f: (x, y) => [-Math.pow(x, 5), -y], M: [0.5, 0, 0.5], note: "第一个分量就是例 15.1：φ = ½x² 的 Lie 导数是 −x⁶。这里 φ = ½(x² + y²)，φ̇ = −x⁶ − y² < 0。" },
    pend: { name: "阻尼单摆（能量）", f: (x, y) => [y, -Math.sin(x) - 0.3 * y], M: null, note: "候选函数用机械能 φ = (1 − cos x) + y²/2：φ̇ = −0.3y² ≤ 0。φ 只在 |x| < 2π 内局部正定，所以结论是局部的——这也呼应「在某些空间上，由于拓扑原因不可能有全局正定的 φ」（8.4.4 节）。" },
  };
  class Lyapunov {
    constructor(root) {
      this.key = "s1"; this.M = LYAP.s1.M.slice();
      const body = C.frame(root, "Lyapunov 函数：猜一个 φ，再验证 φ̇ ≤ 0", "红色 = φ̇ > 0 的地方；灰线 = φ 的等值线");
      this.st = new C.Stage({ view: [-2.5, 2.5, -2.5, 2.5], maxW: 460, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sel = C.select(Object.entries(LYAP).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; if (LYAP[k].M) { this.M = LYAP[k].M.slice(); this.sl.forEach((s, i) => s.setValue(this.M[i])); } this.update(); });
      this.sl = ["m₁₁", "m₁₂", "m₂₂"].map((nm, i) => C.slider(nm, i === 1 ? -1.5 : 0, 2, 0.05, this.M[i], (v) => { this.M[i] = v; this.update(); }, (v) => v.toFixed(2)));
      this.solveBtn = C.button("解 Lyapunov 方程 AᵀM + MA = −I", () => this.solveLyap());
      this.stats = [C.stat("M 正定？"), C.stat("φ̇ ≤ 0（画面内）？"), C.stat("−φ̇ 正定？")];
      this.verdict = h("div", { class: "msg info" }); this.note = h("p", { class: "small" });
      this.mrow = h("div", { class: "controls" }, ...this.sl, this.solveBtn);
      body.append(h("div", { class: "controls" }, this.sel), this.mrow,
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("p", { class: "small", html: "候选函数 φ(x) = xᵀMx，M = [[m₁₁, m₁₂], [m₁₂, m₂₂]]。Lie 导数 (15.3)：φ̇(x) = Σ (∂φ/∂xᵢ) fᵢ(x)。" }),
          h("div", { class: "stats" }, this.stats), this.verdict, this.note)));
      this.update();
    }
    get S() { return LYAP[this.key]; }
    phi(x, y) { if (!this.S.M) return 1 - Math.cos(x) + y * y / 2; const [a, b, c] = this.M; return a * x * x + 2 * b * x * y + c * y * y; }
    dphi(x, y) {
      const f = this.S.f(x, y);
      if (!this.S.M) return Math.sin(x) * f[0] + y * f[1];
      const [a, b, c] = this.M; return (2 * a * x + 2 * b * y) * f[0] + (2 * b * x + 2 * c * y) * f[1];
    }
    solveLyap() {
      const A = this.S.lin; if (!A) return;
      // 未知数 m11, m12, m22；AᵀM + MA = −I 的三个独立方程
      const [[a, b], [c, d]] = A;
      const Mx = [[2 * a, 2 * c, 0], [b, a + d, c], [0, 2 * b, 2 * d]], rhs = [-1, 0, -1];
      const D = C.det(Mx); if (Math.abs(D) < 1e-12) return;
      const sol = [0, 1, 2].map((k) => C.det(Mx.map((r, i) => r.map((v, j) => (j === k ? rhs[i] : v)))) / D);
      this.M = sol; this.sl.forEach((s, i) => s.setValue(C.clamp(sol[i], -1.5, 2))); this.M = sol; this.update();
    }
    update() {
      const S = this.S;
      this.mrow.style.display = S.M ? "" : "none";
      this.solveBtn.style.display = S.lin ? "" : "none";
      let pd, maxd = -Infinity, negdef = true;
      if (S.M) { const [a, b, c] = this.M; pd = a > 1e-9 && a * c - b * b > 1e-9; } else pd = true;
      this.G = C.sampleGrid((x, y) => this.dphi(x, y), 121, 121, [-2.5, 2.5, -2.5, 2.5]);
      this.P = C.sampleGrid((x, y) => this.phi(x, y), 121, 121, [-2.5, 2.5, -2.5, 2.5]);
      for (let j = 0; j < 121; j++) for (let i = 0; i < 121; i++) {
        const x = -2.5 + 5 * i / 120, y = -2.5 + 5 * j / 120, v = this.G.v[j * 121 + i], r = Math.hypot(x, y);
        maxd = Math.max(maxd, v);
        if (r > 0.05 && v > -1e-9 * (1 + r)) negdef = false;
      }
      const le0 = maxd <= 1e-9;
      this.stats[0].set(pd ? "<span class='yes'>是</span>" : "<span class='no'>否</span>");
      this.stats[1].set(le0 ? "<span class='yes'>是</span>" : "<span class='no'>否</span>");
      this.stats[2].set(negdef ? "<span class='yes'>是</span>" : "<span class='no'>否</span>");
      let v;
      if (!pd) v = ["bad", "φ 不是正定的，定理用不上。"];
      else if (!le0) v = ["bad", "有地方 φ̇ > 0：这个 φ 证明不了稳定（但不代表系统不稳定）。"];
      else if (negdef) v = ["ok", "φ 正定、−φ̇ 正定 ⇒ 渐近稳定（在画面范围内验证；二次型的 φ 径向无界，书中的全局结论需要整个 ℝ² 上成立）。"];
      else v = ["info", "φ 正定、φ̇ ≤ 0 ⇒ Lyapunov 稳定；φ̇ 有零点（不是负定），这个 φ 推不出渐近稳定。"];
      this.verdict.className = "msg " + v[0]; this.verdict.textContent = v[1];
      this.note.innerHTML = S.note;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const pos = C.rgb(col.bad), neg = C.rgb(col.ok);
      let mx = 1e-9; for (const v of this.G.v) mx = Math.max(mx, Math.abs(v));
      C.drawHeat(st, this.G, (v) => {
        const t = Math.min(1, Math.pow(Math.abs(v) / mx, 0.35));
        const base = C.rgb(col.surface), c = v > 1e-9 ? pos : neg, a = v > 1e-9 ? 0.15 + 0.45 * t : 0.1 + 0.25 * t;
        return [0, 1, 2].map((k) => Math.round(base[k] * (1 - a) + c[k] * a)).concat([255]);
      });
      st.grid(col, 1);
      const levels = []; let pm = 0; for (const v of this.P.v) pm = Math.max(pm, v);
      for (let k = 1; k <= 10; k++) levels.push(pm * Math.pow(k / 10.5, 2));
      C.drawContours(st, this.P, levels, C.alpha(col.text2, 0.7), 1.1);
      needles(st, col, this.S.f, 15, C.alpha(col.accent, 0.8));
      st.dot({ x: 0, y: 0 }, 5, col.goal, col.surface, 1.5);
    }
  }

  // ===============================================================
  // 组件 5：能控性（式 15.4）与最小能量转向（补充）
  // ===============================================================
  const CTRB = {
    di: { name: "双积分器", A: [[0, 1], [0, 0]], B: [0, 1] },
    pos: { name: "只推位置", A: [[0, 1], [0, 0]], B: [1, 0] },
    same: { name: "解耦、同速", A: [[-1, 0], [0, -1]], B: [1, 1] },
    diff: { name: "解耦、不同速", A: [[-1, 0], [0, -2]], B: [1, 1] },
    osc: { name: "振子 + 推力", A: [[0, 1], [-1, 0]], B: [0, 1] },
  };
  function expmt(A, t) { // 2×2 矩阵指数（级数 + 缩放平方）
    let s = 0; const nrm = Math.max(...A.flat().map(Math.abs)) * Math.abs(t); while (nrm / Math.pow(2, s) > 0.5) s++;
    const M = A.map((r) => r.map((v) => v * t / Math.pow(2, s)));
    let R = [[1, 0], [0, 1]], T = [[1, 0], [0, 1]];
    for (let k = 1; k < 16; k++) { T = C.matmul(T, M).map((r) => r.map((v) => v / k)); R = R.map((r, i) => r.map((v, j) => v + T[i][j])); }
    for (let k = 0; k < s; k++) R = C.matmul(R, R);
    return R;
  }
  class Controllability {
    constructor(root) {
      this.key = "di"; this.A = CTRB.di.A.map((r) => r.slice()); this.B = CTRB.di.B.slice(); this.T = 2;
      this.xI = { x: -1.2, y: 0.6 }; this.xG = { x: 1.2, y: -0.4 }; this.cloud = [];
      const body = C.frame(root, "Kalman 秩条件：(A, B) 能控吗？", "拖动 x_I、x_G；「撒点」看随机动作能到哪里");
      this.st = new C.Stage({ view: [-2.6, 2.6, -2.2, 2.2], aspect: 0.85, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xI) < 0.15 ? "xI" : C.dist(p, this.xG) < 0.15 ? "xG" : null),
        onMove: (p, d) => { this[d] = { x: C.clamp(p.x, -2.5, 2.5), y: C.clamp(p.y, -2.1, 2.1) }; this.cloud = []; this.update(); },
        cursor: (p) => (C.dist(p, this.xI) < 0.15 || C.dist(p, this.xG) < 0.15 ? "grab" : null) });
      this.uplot = new C.Plot({ aspect: 0.45, maxW: 380, xlim: [0, 2], ylim: [-3, 3], xlab: "t", ylab: "u" });
      this.sel = C.seg(Object.entries(CTRB).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.A = CTRB[k].A.map((r) => r.slice()); this.B = CTRB[k].B.slice(); this.cloud = []; this.update(); });
      this.sT = C.slider("T =", 0.5, 4, 0.1, this.T, (v) => { this.T = v; this.cloud = []; this.update(); }, (v) => v.toFixed(1));
      this.mtx = h("div", { class: "mono small" });
      this.verdict = h("div", { class: "msg info" });
      body.append(h("div", { class: "controls" }, this.sel, this.sT, C.button("撒点：随机动作", () => this.scatter())),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.mtx, this.verdict, h("div", { class: "small muted" }, "最小能量动作 u(t)（能控时）："), this.uplot.wrap)),
        C.legend([[C.cv("ok"), "最小能量轨迹（补充：用能控性 Gramian 构造）"], [C.cva("accent", 0.6), "随机分段常值动作的终点 x(T)"], [C.cv("alive2"), "能控子空间 = M 的列空间"]]));
      this.update();
    }
    f(x, u) { const A = this.A, B = this.B; return [A[0][0] * x[0] + A[0][1] * x[1] + B[0] * u, A[1][0] * x[0] + A[1][1] * x[1] + B[1] * u]; }
    update() {
      const A = this.A, B = [[this.B[0]], [this.B[1]]], AB = C.matmul(A, B);
      const M = [[B[0][0], AB[0][0]], [B[1][0], AB[1][0]]], r = C.rank(M);
      this.M = M; this.r = r;
      this.mtx.innerHTML = `A = [[${A[0].join(", ")}], [${A[1].join(", ")}]]，B = [${this.B.join(", ")}]ᵀ<br>M = [B ⋮ AB] = [[${M[0].join(", ")}], [${M[1].join(", ")}]]，秩 = <b>${r}</b>`;
      // Gramian W = ∫₀ᵀ e^{Aτ} B Bᵀ e^{Aᵀτ} dτ；u(t) = Bᵀ e^{Aᵀ(T−t)} W⁻¹ (x_G − e^{AT} x_I)
      this.path = null; this.u = null;
      if (r === 2) {
        const N = 200, T = this.T; let W = [[0, 0], [0, 0]];
        for (let k = 0; k <= N; k++) {
          const tau = T * k / N, E = expmt(A, tau), eb = C.matvec(E, this.B), w = (k === 0 || k === N ? 0.5 : 1) * T / N;
          W = W.map((row, i) => row.map((v, j) => v + w * eb[i] * eb[j]));
        }
        const D = W[0][0] * W[1][1] - W[0][1] * W[1][0];
        const eAT = expmt(A, T), free = C.matvec(eAT, [this.xI.x, this.xI.y]), dx = [this.xG.x - free[0], this.xG.y - free[1]];
        const lam = [(W[1][1] * dx[0] - W[0][1] * dx[1]) / D, (-W[1][0] * dx[0] + W[0][0] * dx[1]) / D];
        const ufn = (t) => { const E = expmt(A, T - t), eb = C.matvec(E, this.B); return eb[0] * lam[0] + eb[1] * lam[1]; };
        const tr = C.integrate((t, s) => this.f(s, ufn(t)), [this.xI.x, this.xI.y], T, 400, 2);
        this.path = tr.map((k) => ({ x: k.x[0], y: k.x[1] }));
        const us = []; let umax = 1; for (let k = 0; k <= 100; k++) { const t = T * k / 100, u = ufn(t); us.push([t, u]); umax = Math.max(umax, Math.abs(u)); }
        this.uplot.set({ xlim: [0, T], ylim: [-umax * 1.1, umax * 1.1], series: [{ pts: us, ckey: "ok", label: "u(t)" }] });
        const end = this.path[this.path.length - 1];
        this.verdict.className = "msg ok";
        this.verdict.innerHTML = `秩 = n = 2：能控。任何 x_I 都能在任意给定的 T 内被送到任何 x_G（这里终点误差 ${C.dist(end, this.xG).toExponential(1)}）。`;
      } else {
        this.uplot.set({ series: [] });
        this.verdict.className = "msg bad";
        this.verdict.innerHTML = r === 1 ? "秩 = 1 < 2：不能控。x(T) − e^{AT}x_I 永远落在 M 的列空间（紫线方向）里，偏离它的 x_G 到不了。" : "秩 = 0：B = 0，动作完全不起作用。";
      }
      this.st.draw();
    }
    scatter() {
      const r = C.rng(Date.now() & 0xffff), T = this.T, K = 6, out = [];
      for (let n = 0; n < 500; n++) {
        const us = Array.from({ length: K }, () => (r() * 2 - 1) * 2.5);
        let s = [this.xI.x, this.xI.y];
        for (let k = 0; k < K; k++) for (let m = 0; m < 6; m++) s = C.rk4Step((t, x) => this.f(x, us[k]), 0, s, T / K / 6);
        out.push({ x: s[0], y: s[1] });
      }
      this.cloud = out; this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      // e^{AT} x_I + 列空间
      const free = C.matvec(expmt(this.A, this.T), [this.xI.x, this.xI.y]), fp = { x: free[0], y: free[1] };
      if (this.r === 1) {
        let v = [this.M[0][0], this.M[1][0]]; if (Math.hypot(...v) < 1e-9) v = [this.M[0][1], this.M[1][1]];
        const n = Math.hypot(...v); v = [v[0] / n, v[1] / n];
        st.line({ x: fp.x - 6 * v[0], y: fp.y - 6 * v[1] }, { x: fp.x + 6 * v[0], y: fp.y + 6 * v[1] }, col.alive2, 2.5);
      }
      for (const p of this.cloud) st.dot(p, 2, C.alpha(col.accent, 0.55));
      st.dot(fp, 4, null, col.muted, 1.5); st.text("e^{AT}x_I", fp, col.muted, { dy: 13, size: 11 });
      if (this.path) st.polyline(this.path, col.ok, 2.4);
      st.qmark(this.xI, "I", col); st.qmark(this.xG, "G", col);
    }
  }

  // ===============================================================
  // 组件 6：小时间可达集与 STLC（图 15.2）
  // ===============================================================
  const REACH = {
    rs: { name: "Reeds–Shepp 车", dim: 3 }, dubins: { name: "Dubins 车", dim: 3 }, diff: { name: "差速驱动", dim: 3 },
    ex20: { name: "例 15.20：ẋ₁=u, ẋ₂=x₁²", dim: 2 },
  };
  class STLCReach {
    constructor(root) {
      this.key = "rs"; this.t = 0.6; this.pts = [];
      const body = C.frame(root, "小时间可达集 R(x_I, 𝒰, t)", "随机分段常值动作在 t 秒内能到的点；x_I 在它的内部吗？");
      this.st = new C.Stage({ view: [-1, 1, -0.8, 0.8], aspect: 0.8, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sel = C.seg(Object.entries(REACH).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.sample(); });
      this.sT = C.slider("t =", 0.1, 1.5, 0.05, this.t, (v) => { this.t = v; this.sample(); }, (v) => v.toFixed(2));
      this.verdict = h("div", { class: "msg info" });
      this.legendEl = h("div");
      body.append(h("div", { class: "controls" }, this.sel, this.sT), this.st.wrap, this.legendEl, this.verdict);
      this.sample();
    }
    sample() {
      const r = C.rng(7), t = this.t, K = 4, out = [], key = this.key;
      for (let n = 0; n < 2500; n++) {
        let q = key === "ex20" ? [0, 0] : [0, 0, 0];
        // 各段时长随机（总和为 t），这样终点能铺满可达集
        const w8 = Array.from({ length: K }, () => -Math.log(1 - r() * 0.999)), sw = w8.reduce((a, b) => a + b, 0);
        for (let k = 0; k < K; k++) {
          const dt = t * w8[k] / sw;
          if (key === "ex20") { const u = (r() * 2 - 1) * 2; for (let m = 0; m < 4; m++) q = C.rk4Step((tt, s) => [u, s[0] * s[0]], 0, q, dt / 4); continue; }
          let v, w;
          if (key === "dubins") { v = 1; w = [-1, 0, 1][Math.floor(r() * 3)]; }
          else if (key === "rs") { v = r() < 0.5 ? -1 : 1; w = v * [-1, 0, 1][Math.floor(r() * 3)]; }
          else { const ul = r() * 2 - 1, ur = r() * 2 - 1; v = (ul + ur) / 2; w = (ur - ul) / 2; }
          // 精确积分常值 (v, w)
          const [x, y, th] = q;
          if (Math.abs(w) < 1e-12) q = [x + v * dt * Math.cos(th), y + v * dt * Math.sin(th), th];
          else q = [x + v / w * (Math.sin(th + w * dt) - Math.sin(th)), y - v / w * (Math.cos(th + w * dt) - Math.cos(th)), th + w * dt];
        }
        out.push(q);
      }
      this.pts = out;
      const mx = (i) => Math.max(...out.map((p) => p[i])), mn = (i) => Math.min(...out.map((p) => p[i]));
      const s = Math.max(0.2, ...out.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 1.15;
      this.st.setView([-s, s, -s * 0.8, s * 0.8]);
      const tag = (b) => (b ? "<span class='yes'>是</span>" : "<span class='no'>否</span>");
      if (key === "ex20") {
        this.verdict.className = "msg bad";
        this.verdict.innerHTML = `x₂ 的最小值 = ${mn(1).toExponential(1)} ≥ 0：可达集整个在 x₂ ≥ 0 一侧，x_I = 0 在它的边界上而不在内部 ⇒ <b>不是 STLC</b>。可达集有二维的内部 ⇒ 是 <b>accessible</b>（15.1.3 节末的定义），这正是例 15.20。`;
        this.legendEl.innerHTML = "";
      } else {
        const inside = mn(0) < -1e-6 && mx(0) > 1e-6 && mn(1) < -1e-6 && mx(1) > 1e-6 && mn(2) < -1e-6 && mx(2) > 1e-6;
        this.verdict.className = "msg " + (inside ? "ok" : "bad");
        this.verdict.innerHTML = `x 的范围 [${mn(0).toFixed(3)}, ${mx(0).toFixed(3)}]，y 的范围 [${mn(1).toFixed(3)}, ${mx(1).toFixed(3)}]，θ 的范围 [${mn(2).toFixed(2)}, ${mx(2).toFixed(2)}]。三个方向上都把 x_I 夹在中间？${tag(inside)}。` +
          (key === "dubins" ? " Dubins 车只能前进，x 总是 > 0：x_I 不在可达集内部，<b>不是 STLC</b>——再小的 t 也不行。" : " 随着 t → 0，可达集缩小但始终把 x_I 包在里面（y 方向厚度约是 t²：侧向只能靠「扭」出来）——这就是 <b>STLC</b>（15.4 节用 Lie 括号证明）。");
        this.legendEl.innerHTML = "";
        this.legendEl.append(C.legend([[C.cv("accent"), "θ < 0 的终点"], [C.cv("warn"), "θ > 0 的终点"], [C.cv("goal"), "x_I"]]));
      }
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const [x0, x1] = st.view; st.grid(col, Math.pow(10, Math.floor(Math.log10(x1 - x0))) / 2);
      const thMax = Math.max(1e-9, ...this.pts.map((p) => Math.abs(p[2] || 0)));
      for (const p of this.pts) {
        if (this.key === "ex20") { st.dot({ x: p[0], y: p[1] }, 1.8, C.alpha(col.accent, 0.5)); continue; }
        const t = p[2] / thMax, c = t < 0 ? col.accent : col.warn;
        st.dot({ x: p[0], y: p[1] }, 1.8, C.alpha(c, 0.25 + 0.6 * Math.abs(t)));
      }
      st.dot({ x: 0, y: 0 }, 5.5, col.goal, col.surface, 2);
      st.text(this.key === "ex20" ? "x₁" : "x", { x: x1, y: 0 }, col.muted, { dx: -8, dy: -8, size: 11 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='stability-def']").forEach((el) => (el._w = new StabilityDef(el)));
    document.querySelectorAll("[data-widget='attraction']").forEach((el) => (el._w = new Attraction(el)));
    document.querySelectorAll("[data-widget='linear-eig']").forEach((el) => (el._w = new LinearEig(el)));
    document.querySelectorAll("[data-widget='lyapunov']").forEach((el) => (el._w = new Lyapunov(el)));
    document.querySelectorAll("[data-widget='controllability']").forEach((el) => (el._w = new Controllability(el)));
    document.querySelectorAll("[data-widget='stlc-reach']").forEach((el) => (el._w = new STLCReach(el)));
  });
})();
