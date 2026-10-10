/* 15.5 节：P. Hall 基的转向法（扩展系统 + CFS 方程，例 15.21、15.23）、正弦输入、链式系统与差速车平行泊车、微分平坦 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH15;
  const TAU = 2 * Math.PI;

  // 非完整积分器 ẋ1 = u1, ẋ2 = u2, ẋ3 = x1u2 − x2u1：常值动作下可以精确积分（x3 的增量 = 2 × 扫过的有向面积）
  function niStep(x, u1, u2, t) { return [x[0] + u1 * t, x[1] + u2 * t, x[2] + (x[0] * u2 - x[1] * u1) * t]; }

  // ===============================================================
  // 组件 1：扩展系统 + CFS 方程（例 15.21、15.23）
  // ===============================================================
  class CFSSteer {
    constructor(root) {
      this.xI = { x: -1.2, y: -0.6 }; this.xG = { x: 1.0, y: 0.7 }; this.x3G = 1.2; this.order = "right";
      const body = C.frame(root, "P. Hall 基的转向法：非完整积分器", "拖动 x_I、x_G 的 (x₁, x₂)；滑块设 x₃ 的目标值");
      this.st = new C.Stage({ view: [-2.2, 2.2, -1.7, 1.7], aspect: 0.77, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xI) < 0.15 ? "xI" : C.dist(p, this.xG) < 0.15 ? "xG" : null),
        onMove: (p, d) => { this[d] = { x: C.clamp(p.x, -2.1, 2.1), y: C.clamp(p.y, -1.6, 1.6) }; this.update(); },
        cursor: (p) => (C.dist(p, this.xI) < 0.15 || C.dist(p, this.xG) < 0.15 ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.55, maxW: 380, xlim: [0, 1], ylim: [-2, 2], xlab: "执行进度", ylab: "x₃" });
      this.s3 = C.slider("x₃ 的目标 =", -2, 2, 0.05, this.x3G, (v) => { this.x3G = v; this.update(); }, (v) => v.toFixed(2));
      this.ord = C.seg([["right", "按 (15.143) 的约定：b₃ → b₂ → b₁"], ["text", "按原书文字：b₁ → b₂ → b₃"]], this.order, (k) => { this.order = k; this.update(); });
      this.stats = [C.stat("v = (v₁, v₂, v₃)"), C.stat("z(1) = (z₁, z₂, z₃)"), C.stat("终点误差")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.s3, this.ord),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap, this.note)),
        C.legend([[C.cv("muted"), "第 1 阶段：扩展系统沿直线 τ 走（投影）"], [C.cv("alive2"), "b₃ = [b₁, b₂] 方向：用换位运动（正方形）实现"], [C.cv("warn"), "b₂ 段"], [C.cv("accent"), "b₁ 段"]]));
      this.update();
    }
    update() {
      const xI = [this.xI.x, this.xI.y, 0], xG = [this.xG.x, this.xG.y, this.x3G];
      // 第 1 阶段：τ(t) = x_I + t(x_G − x_I)，τ̇ = v1 b1 + v2 b2 + v3 b3，其中 b3 = (0, 0, 2)
      const d = [xG[0] - xI[0], xG[1] - xI[1], xG[2] - xI[2]];
      const v1 = d[0], v2 = d[1], v3 = (d[2] - (xI[0] * d[1] - xI[1] * d[0])) / 2;   // τ1 v2 − τ2 v1 在直线上是常数
      // 第 2 阶段：积分 CFS 方程 (15.143)：ż1 = v1, ż2 = v2, ż3 = v3 + z1 v2，从 z(0) = 0 到 t = 1
      const z = [v1, v2, v3 + 0.5 * v1 * v2];
      this.v = [v1, v2, v3]; this.z = z;
      // 用原来的两个动作实现 e^{z3 b3} e^{z2 b2} e^{z1 b1}：系统幂零，e^{z3[b1,b2]} 恰好等于一个换位运动
      const comm = (sq) => { const a = Math.sqrt(Math.abs(z[2])); return z[2] >= 0 ? [[a, 0, "b3"], [0, a, "b3"], [-a, 0, "b3"], [0, -a, "b3"]] : [[0, a, "b3"], [a, 0, "b3"], [0, -a, "b3"], [-a, 0, "b3"]]; };
      let prims = this.order === "right" ? [...comm(), [0, z[1], "b2"], [z[0], 0, "b1"]] : [[z[0], 0, "b1"], [0, z[1], "b2"], ...comm()];
      // 逐段精确执行（每段动作常值、时长 1，动作 = 位移）
      let x = xI.slice(); const path = [{ x: x[0], y: x[1], x3: x[2], tag: "start" }];
      for (const [a, b, tag] of prims) { for (let k = 1; k <= 20; k++) { const y = niStep(x, a, b, k / 20); path.push({ x: y[0], y: y[1], x3: y[2], tag }); } x = niStep(x, a, b, 1); }
      this.path = path; this.end = x;
      const err = Math.hypot(x[0] - xG[0], x[1] - xG[1], x[2] - xG[2]);
      const f = (v) => `(${v.map((a) => a.toFixed(2)).join(", ")})`;
      this.stats[0].set(f(this.v)); this.stats[1].set(f(z)); this.stats[2].set(err < 1e-9 ? "<span class='yes'>0</span>" : `<span class='no'>${err.toFixed(3)}</span>`);
      const pts = path.map((p, i) => [i / (path.length - 1), p.x3]), ym = Math.max(1, ...pts.map((p) => Math.abs(p[1])), Math.abs(this.x3G)) * 1.15;
      this.plot.set({ ylim: [-ym, ym], series: [{ pts, ckey: "alive2", label: "x₃" }], marks: [{ y: this.x3G, label: "目标 x₃", color: undefined }] });
      this.note.innerHTML = this.order === "right"
        ? `扩展系统 (15.115) 沿直线 τ 走只需常值的 v（第 1 阶段）。CFS 方程给出后向 P. Hall 坐标 z(1)，于是 x(1) = e^{z₃b₃}e^{z₂b₂}e^{z₁b₁} 作用于 x_I：<b>先</b>沿 b₃ 走 z₃（这里没有真的 b₃ 动作，用一个面积为 |z₃| 的正方形换位运动代替，x₃ 增加 2·面积 = 2z₃），<b>再</b>沿 b₂ 走 z₂、沿 b₁ 走 z₁。因为非完整积分器是幂零的（Lie 括号到第二层就停），这样恰好到达 x_G。`
        : `按原书文字「先积分 b₁ 走 z₁(t)，再 b₂ ……」的顺序执行，x₁、x₂ 照样到位，x₃ 却差了 ${Math.abs(this.end[2] - this.x3G).toFixed(3)}：b₁ 与 b₂ 的流不交换（这正是 Lie 括号非零的意思），顺序一换，x₃ 多出 ±2z₁z₂ 一类的项。按 (15.128) Ṡ = S·(Σvᵢbᵢ) 的约定，乘积 e^{z₃b₃}e^{z₂b₂}e^{z₁b₁} 里<b>最左边</b>的因子最先执行（参考代码第 15 项用数值积分核对过）。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      st.line(this.xI, this.xG, col.muted, 1.6, [6, 4]);
      const colOf = (t) => (t === "b3" ? col.alive2 : t === "b2" ? col.warn : col.accent);
      for (let k = 1; k < this.path.length; k++) st.line(this.path[k - 1], this.path[k], colOf(this.path[k].tag), 2.6);
      st.qmark(this.xI, "I", col, "x_I（x₃ = 0）"); st.qmark(this.xG, "G", col, `x_G（x₃ = ${this.x3G.toFixed(2)}）`);
      const e = { x: this.end[0], y: this.end[1] }; st.dot(e, 4, col.text);
      st.text("x₁", { x: 2.2, y: 0 }, col.muted, { dx: -8, dy: -8, size: 11 }); st.text("x₂", { x: 0, y: 1.7 }, col.muted, { dx: 10, dy: 8, size: 11 });
    }
  }

  // ===============================================================
  // 组件 2：正弦输入（式 15.146–15.154）
  // ===============================================================
  class Sinusoid {
    constructor(root) {
      this.xG = { x: 1.0, y: 0.5 }; this.x3G = 0.6; this.k = 1; this.phi = 0;
      const body = C.frame(root, "用正弦输入转向非完整积分器", "两阶段：先直线把 (x₁, x₂) 送到位，再画圆调 x₃");
      this.st = new C.Stage({ view: [-1.6, 2.2, -1.4, 1.6], aspect: 0.79, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xG) < 0.15 ? "g" : null), onMove: (p) => { this.xG = { x: C.clamp(p.x, -1.5, 2.1), y: C.clamp(p.y, -1.3, 1.5) }; this.update(); },
        cursor: (p) => (C.dist(p, this.xG) < 0.15 ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.55, maxW: 380, xlim: [0, 2], ylim: [-3, 3], xlab: "t" });
      this.s3 = C.slider("x₃ 目标 =", -1.5, 1.5, 0.05, this.x3G, (v) => { this.x3G = v; this.update(); }, (v) => v.toFixed(2));
      this.sk = C.seg([["1", "k = 1"], ["2", "k = 2"], ["3", "k = 3"]], "1", (v) => { this.k = +v; this.update(); });
      this.sphi = C.slider("u(0) 的方向", 0, 360, 5, 0, (v) => { this.phi = v * Math.PI / 180; this.update(); }, (v) => v + "°");
      this.stats = [C.stat("第 2 阶段要补的 a"), C.stat("λ = 2kπ·sgn a"), C.stat("‖u(0)‖ = √(λa)"), C.stat("第 2 阶段代价 λa"), C.stat("正方形换位运动的代价")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.s3, this.sk, this.sphi),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap)), this.note,
        C.legend([[C.cv("accent"), "第 1 阶段：直线"], [C.cv("ok"), "第 2 阶段：正弦输入 ⇒ (x₁, x₂) 走圆"], [C.cv("alive2"), "对照：同样面积的正方形（换位运动）"]]));
      this.update();
    }
    update() {
      // 第 1 阶段：u = x_G − 0，常值 1 秒；从原点出发的直线不改变 x3
      const g = [this.xG.x, this.xG.y], x1 = [g[0], g[1], 0];
      const a = this.x3G - x1[2], sg = a >= 0 ? 1 : -1, lam = sg * this.k * TAU, r = Math.sqrt(Math.max(0, lam * a));
      const u10 = r * Math.cos(this.phi), u20 = r * Math.sin(this.phi);
      // 第 2 阶段 (15.151)：u1 = u1(0)cosλt − u2(0)sinλt，u2 = u1(0)sinλt + u2(0)cosλt
      const P1 = [], P2 = [], U = [], X3 = [];
      for (let k = 0; k <= 50; k++) { const t = k / 50; P1.push({ x: g[0] * t, y: g[1] * t }); U.push([t, g[0], g[1]]); X3.push([t, 0]); }
      for (let k = 0; k <= 400; k++) {
        const t = k / 400, u1 = u10 * Math.cos(lam * t) - u20 * Math.sin(lam * t), u2 = u10 * Math.sin(lam * t) + u20 * Math.cos(lam * t);
        const x = g[0] + (u10 * Math.sin(lam * t) + u20 * Math.cos(lam * t) - u20) / lam, y = g[1] + (-u10 * Math.cos(lam * t) + u20 * Math.sin(lam * t) + u10) / lam;
        P2.push({ x, y }); U.push([1 + t, u1, u2]);
        // x3 增量：(15.153) 积分到 t 的闭式（数值累加即可）
        X3.push([1 + t, 0]);
      }
      // 数值积分 x3（第 2 阶段）
      let x3 = 0; for (let k = 1; k < P2.length; k++) { const p = P2[k - 1], q = P2[k]; x3 += p.x * (q.y - p.y) - p.y * (q.x - p.x); X3[51 + k][1] = x3; }
      this.P1 = P1; this.P2 = P2; this.lam = lam;
      // 对照：总时间 1 的正方形回路，面积 |a|/2：边长 L = √(|a|/2)，速度 4L，代价 16L² = 8|a|
      const L = Math.sqrt(Math.abs(a) / 2); this.sq = L;
      this.stats[0].set(a.toFixed(3)); this.stats[1].set(lam.toFixed(3)); this.stats[2].set(r.toFixed(3)); this.stats[3].set((lam * a).toFixed(3)); this.stats[4].set((8 * Math.abs(a)).toFixed(3));
      const um = Math.max(1.5, r, Math.abs(g[0]), Math.abs(g[1])) * 1.1;
      this.plot.set({ ylim: [-um, um], series: [{ pts: U.map((p) => [p[0], p[1]]), ckey: "accent", label: "u₁" }, { pts: U.map((p) => [p[0], p[2]]), ckey: "warn", label: "u₂" }, { pts: X3.map((p) => [p[0], p[1] * um / Math.max(1, Math.abs(this.x3G) * 1.2)]), ckey: "alive2", label: "x₃（缩放）", dash: [4, 3] }],
        marks: [{ x: 1, label: "换阶段" }] });
      this.note.innerHTML = `第 2 阶段从 (x₁, x₂) 出发转 |k| 整圈回到原处（λ = 2kπ 保证 x₁(1) = x₂(1)），x₃ 增加 2 × 圈出的面积 = ‖u(0)‖²/λ = a（式 15.153，这里数值积分得 ${x3.toFixed(4)}）。代价 (15.147) = ‖u(0)‖² = λa，所以 |k| = 1 最省：λ = 2π，‖u(0)‖ = √(2π|a|)。` +
        `<span class="muted">（原书把这一句写成「k = −1，λ = 2π，‖u‖ = 2πa」，见脚注。）</span> 同样的 Δx₃，用总时长 1 的正方形换位运动要花 8|a|，比圆的 2π|a| 贵——等周不等式：面积一定时圆的周长最短，而代价正比于速度的平方。u(0) 的方向不影响代价，只决定圆在哪一侧。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const g = this.xG;
      const L = this.sq, s = this.x3G >= 0 ? 1 : -1;
      st.poly([g, { x: g.x + L, y: g.y }, { x: g.x + L, y: g.y + s * L }, { x: g.x, y: g.y + s * L }], C.alpha(col.alive2, 0.08), C.alpha(col.alive2, 0.9), 1.4);
      st.poly(this.P2, C.alpha(col.ok, 0.12), null);
      st.polyline(this.P1, col.accent, 2.6); st.polyline(this.P2, col.ok, 2.6);
      st.arrow(this.P2[20], this.P2[24], col.ok, 2.4, 9);
      st.dot({ x: 0, y: 0 }, 6, col.start, col.surface, 2); st.text("x_I", { x: 0, y: 0 }, col.start, { dx: -14, dy: 12, weight: 650 });
      st.qmark(g, "G", col, "(x₁, x₂) 的目标");
    }
  }

  // ===============================================================
  // 组件 3：链式系统 (15.160)–(15.162) 与差速车平行泊车（补充）
  // ===============================================================
  class Chained {
    constructor(root) {
      this.tab = "abstract"; this.n = 5; this.printed = false; this.seed = 3; this.aT = { abstract: 8, park: 4 }; this.goal = null;
      this.qG = { x: 0, y: 0.8, th: 0 };
      const body = C.frame(root, "链式系统的多阶段正弦转向", "每个阶段只改一个变量（及后面的），前面的都回到原值");
      this.tabs = C.seg([["abstract", "抽象链式系统 (15.160)"], ["park", "差速车平行泊车（n = 3，补充）"]], this.tab, (k) => { this.tab = k; this.sa.setValue(this.aT[k]); this.update(); });
      this.sn = C.slider("n =", 3, 6, 1, this.n, (v) => { this.n = v; this.goal = null; this.update(); }, String);
      this.pr = C.toggle("按原书 (15.161) 印的输入（u₁ = a sin 2πkt, u₂ = b cos 2πkt）", false, (v) => { this.printed = v; this.update(); });
      this.sa = C.slider("a =", 1, 12, 0.1, this.aT.abstract, (v) => { this.aT[this.tab] = v; this.update(); }, (v) => v.toFixed(1));
      this.newGoal = C.button("随机目标", () => { this.seed++; this.goal = null; this.update(); });
      this.st = new C.Stage({ view: [-1.2, 1.2, -0.8, 1.4], aspect: 0.8, maxW: 520, onDraw: (ctx, st, col) => this.drawPark(ctx, st, col),
        onDown: (p) => (C.dist(p, this.qG) < 0.2 ? "g" : null), onMove: (p) => { this.qG = { ...this.qG, x: C.clamp(p.x, -1, 1), y: C.clamp(p.y, -0.7, 1.3) }; this.update(); },
        cursor: (p) => (C.dist(p, this.qG) < 0.2 ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.5, maxW: 760, xlim: [0, 4], ylim: [-1, 1], xlab: "t（每个阶段 1 秒）" });
      this.stats = h("div", { class: "stats" });
      this.note = h("p", { class: "small" });
      this.row1 = h("div", { class: "controls" }, this.sn, this.newGoal);
      this.parkWrap = h("div", null, this.st.wrap);
      body.append(h("div", { class: "controls" }, this.tabs), this.row1, h("div", { class: "controls" }, this.sa, this.pr), this.parkWrap, this.plot.wrap, this.stats, this.note);
      this.update();
    }
    // 链式系统的精确积分（RK4，细步长）
    simulate(x0, phases) {
      const n = x0.length, traj = [[0, x0.slice()]]; let x = x0.slice(), t0 = 0;
      for (const u of phases) {
        const N = 400;
        for (let k = 0; k < N; k++) {
          x = C.rk4Step((t, s) => { const [u1, u2] = u(t); const d = [u1, u2]; for (let j = 2; j < n; j++) d.push(s[j - 1] * u1); return d; }, k / N, x, 1 / N);
          if ((k + 1) % 4 === 0) traj.push([t0 + (k + 1) / N, x.slice()]);
        }
        t0 += 1;
      }
      return { traj, x };
    }
    plan(x0, xg, n) {
      // 第 1 阶段：u1, u2 常值，把 x1、x2 送到目标；之后每个 k = 3..n 一个正弦阶段
      const phases = [], a = this.aT[this.tab];
      let cur = this.simulate(x0, [() => [xg[0] - x0[0], xg[1] - x0[1]]]).x; phases.push(((d1, d2) => () => [d1, d2])(xg[0] - x0[0], xg[1] - x0[1]));
      for (let k = 3; k <= n; k++) {
        const need = xg[k - 1] - cur[k - 1];
        const b = need * fact(k - 2) / Math.pow(a / (4 * Math.PI), k - 2);   // 由 (15.162) 反解
        const u = this.printed ? ((b, k) => (t) => [a * Math.sin(TAU * k * t), b * Math.cos(TAU * k * t)])(b, k) : ((b, k) => (t) => [a * Math.sin(TAU * t), b * Math.cos(TAU * (k - 2) * t)])(b, k);
        phases.push(u); cur = this.simulate(cur, [u]).x;
      }
      return phases;
    }
    update() {
      const park = this.tab === "park";
      this.row1.style.display = park ? "none" : ""; this.parkWrap.style.display = park ? "" : "none";
      let n, x0, xg, names;
      if (park) {
        // 差速车 → 链式：z1 = θ, z2 = x cosθ + y sinθ, z3 = x sinθ − y cosθ；u1 = ω，u2 = v − z3 ω
        n = 3; const q0 = { x: 0, y: 0, th: 0 }, g = this.qG;
        const z = (q) => [q.th, q.x * Math.cos(q.th) + q.y * Math.sin(q.th), q.x * Math.sin(q.th) - q.y * Math.cos(q.th)];
        x0 = z(q0); xg = z(g); names = ["z₁ = θ", "z₂", "z₃"];
      } else {
        n = this.n; x0 = new Array(n).fill(0);
        if (!this.goal || this.goal.length !== n) { const r = C.rng(this.seed), mag = [0.8, 0.8, 0.5, 0.3, 0.2, 0.1]; this.goal = Array.from({ length: n }, (_, i) => +((r() < 0.5 ? -1 : 1) * (0.4 + 0.6 * r()) * mag[i]).toFixed(2)); }
        xg = this.goal; names = Array.from({ length: n }, (_, i) => `x${"₁₂₃₄₅₆"[i]}`);
      }
      const phases = this.plan(x0, xg, n), sim = this.simulate(x0, phases);
      this.sim = sim; this.x0 = x0;
      const keys = ["accent", "warn", "ok", "alive2", "goal", "bad"];
      let ym = 0.5; for (const [, x] of sim.traj) for (const v of x) ym = Math.max(ym, Math.abs(v));
      const gm = Math.max(0.3, ...xg.map(Math.abs)); this.clipped = ym > 3 * gm; ym = Math.min(ym, 3 * gm);
      this.plot.set({ xlim: [0, phases.length], ylim: [-ym * 1.1, ym * 1.1], series: names.map((nm, i) => ({ pts: sim.traj.map(([t, x]) => [t, x[i]]), ckey: keys[i], label: nm })),
        marks: Array.from({ length: phases.length - 1 }, (_, i) => ({ x: i + 1, label: `阶段 ${i + 2}` })) });
      this.stats.innerHTML = "";
      const err = sim.x.map((v, i) => v - xg[i]);
      names.forEach((nm, i) => { const s = C.stat(`${nm}：目标 ${xg[i].toFixed(2)}`); s.set(`${sim.x[i].toFixed(3)} <span class="${Math.abs(err[i]) < 1e-3 ? "yes" : "no"}" style="font-size:12px">${Math.abs(err[i]) < 1e-3 ? "✓" : "✗"}</span>`); this.stats.append(s); });
      if (park) {
        // 还原到差速车：θ = z1，x = z2 cosθ + z3 sinθ，y = z2 sinθ − z3 cosθ
        this.carPath = sim.traj.map(([, z]) => ({ x: z[1] * Math.cos(z[0]) + z[2] * Math.sin(z[0]), y: z[1] * Math.sin(z[0]) - z[2] * Math.cos(z[0]), th: z[0] }));
        this.st.draw();
      }
      this.note.innerHTML = park
        ? "差速车（单轮车）可以化成 n = 3 的链式形式（补充；坐标变换见参考代码第 18 项）：z₁ = θ，z₂ = x cosθ + y sinθ，z₃ = x sinθ − y cosθ，取 u₁ = ω、u₂ = v − z₃ω。第 1 阶段把 θ 和 z₂ 调到目标，第 2 阶段用 u₁ = a sin 2πt、u₂ = b cos 2πt 调 z₃，b = 4πΔz₃/a。拖动目标位形看车怎么「扭」过去；a 越大，扭得越厉害，但需要的 b 越小。"
        : this.printed
          ? "按原书 (15.161) 印的输入（u₁、u₂ 都用频率 k）：每个阶段都会扰动 x₃，而 x₃ 的阶段已经过去了，最后到不了目标（标 ✗ 的分量）。(15.162) 的系数对应的是 u₁ = a sin 2πt、u₂ = b cos 2π(k−2)t（Murray–Sastry 的写法；参考代码第 16 项逐阶段核对）。"
          : "第 1 阶段：常值动作把 x₁、x₂ 送到目标。第 k 阶段（k = 3…n）：u₁ = a sin 2πt、u₂ = b cos 2π(k−2)t，由 (15.162) 反解 b。每个阶段结束时 x₁…x_{k−1} 都回到原值，x_k 到位，后面的变量被扰动、留给后面的阶段处理。(15.162) 里有因子 (a/4π)^{k−2}/(k−2)!：越靠后的变量越「难推」，a 小时需要的 b 会非常大（试试把 a 调小）。" + (this.clipped ? "（纵轴已截断：x₂ 在后面的阶段振荡幅度很大。）" : "");
    }
    drawPark(ctx, st, col) {
      st.frame(col); st.grid(col, 0.5);
      if (!this.carPath) return;
      st.polyline(this.carPath, col.path, 2.2);
      for (let k = 0; k < this.carPath.length; k += 25) C.drawDiff(st, this.carPath[k], C.alpha(col.text2, 0.6), { size: 0.18, alpha: 0.55 });
      C.drawDiff(st, { x: 0, y: 0, th: 0 }, col.start, { size: 0.24 }); C.drawDiff(st, this.qG, col.goal, { size: 0.24 });
      const end = this.carPath[this.carPath.length - 1]; C.drawDiff(st, end, col.text, { size: 0.2 });
      st.text("q_I", { x: 0, y: 0 }, col.start, { dy: 22, weight: 650 }); st.text("q_G（拖动）", this.qG, col.goal, { dy: -22, weight: 650 });
    }
  }
  function fact(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }

  // ===============================================================
  // 组件 4：微分平坦（式 15.163–15.165）
  // ===============================================================
  class Flatness {
    constructor(root) {
      this.P = [{ x: -2.2, y: -0.8 }, { x: -0.4, y: -1.2 }, { x: 0.4, y: 1.3 }, { x: 2.2, y: 0.6 }]; this.L = 0.5; this.phiMax = 40;
      const body = C.frame(root, "微分平坦：只规划平坦输出，状态和动作都直接算出来", "拖动四个 Bézier 控制点；中间两个决定起点、终点朝向");
      this.st = new C.Stage({ view: [-2.8, 2.8, -1.8, 1.8], aspect: 0.64, maxW: 720, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const i = this.P.findIndex((q) => C.dist(p, q) < 0.15); return i >= 0 ? { i } : null; },
        onMove: (p, d) => { this.P[d.i] = { x: C.clamp(p.x, -2.7, 2.7), y: C.clamp(p.y, -1.7, 1.7) }; this.update(); },
        cursor: (p) => (this.P.some((q) => C.dist(p, q) < 0.15) ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.4, maxW: 720, xlim: [0, 1], ylim: [-2, 2], xlab: "t" });
      this.sL = C.slider("车的轴距 L =", 0.2, 1.2, 0.05, this.L, (v) => { this.L = v; this.update(); }, (v) => v.toFixed(2));
      this.sP = C.slider("φ_max =", 15, 80, 1, this.phiMax, (v) => { this.phiMax = v; this.update(); }, (v) => v + "°");
      this.stats = [C.stat("积分出的终点 vs 平坦输出的终点"), C.stat("最大 |转向角 φ|"), C.stat("简单车可行？")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sL, this.sP), this.st.wrap, h("div", { class: "stats" }, this.stats), this.plot.wrap, this.note,
        C.legend([[C.cv("path"), "平坦输出 y(t) = (x(t), y(t))"], [C.cv("accent"), "用算出的 v、ω 积分得到的轨迹（应与之重合）"], [C.cv("bad"), "需要 |φ| > φ_max 的地方"]]));
      this.update();
    }
    B(t, d) {
      const P = this.P, u = 1 - t;
      const c = d === 0 ? [u * u * u, 3 * t * u * u, 3 * t * t * u, t * t * t] : d === 1 ? [-3 * u * u, 3 * u * u - 6 * t * u, 6 * t * u - 3 * t * t, 3 * t * t] : [6 * u, -12 * u + 6 * t, 6 * u - 12 * t, 6 * t];
      return { x: c.reduce((s, k, i) => s + k * P[i].x, 0), y: c.reduce((s, k, i) => s + k * P[i].y, 0) };
    }
    update() {
      // (15.164)(15.165)：θ = atan2(ẏ, ẋ)，v = ‖ẏ‖，ω = (ẋÿ − ẏẍ)/v²；简单车 tan φ = L·κ，κ = ω/v
      const N = 300, samp = [];
      for (let k = 0; k <= N; k++) {
        const t = k / N, p = this.B(t, 0), d1 = this.B(t, 1), d2 = this.B(t, 2), v = Math.hypot(d1.x, d1.y);
        const w = (d1.x * d2.y - d1.y * d2.x) / Math.max(1e-9, v * v), kap = w / Math.max(1e-9, v);
        samp.push({ t, x: p.x, y: p.y, th: Math.atan2(d1.y, d1.x), v, w, phi: Math.atan(this.L * kap) });
      }
      this.samp = samp;
      // 只用 v(t)、ω(t) 积分（RK4，t 上线性插值）
      const at = (t, key) => { const s = Math.min(N - 1, Math.floor(t * N)), f = t * N - s; return samp[s][key] * (1 - f) + samp[s + 1][key] * f; };
      const tr = C.integrate((t, s) => [at(t, "v") * Math.cos(s[2]), at(t, "v") * Math.sin(s[2]), at(t, "w")], [samp[0].x, samp[0].y, samp[0].th], 1, 3000, 15);
      this.int = tr.map((k) => ({ x: k.x[0], y: k.x[1] }));
      const e = tr[tr.length - 1].x, last = samp[N];
      this.stats[0].set(`误差 ${Math.hypot(e[0] - last.x, e[1] - last.y).toExponential(1)}`);
      const pm = Math.max(...samp.map((s) => Math.abs(s.phi))) * 180 / Math.PI;
      this.stats[1].set(pm.toFixed(1) + "°"); this.stats[2].set(pm <= this.phiMax ? "<span class='yes'>是</span>" : "<span class='no'>否</span>");
      const vm = Math.max(1, ...samp.map((s) => Math.max(s.v, Math.abs(s.w))));
      this.plot.set({ ylim: [-vm * 1.1, vm * 1.1], series: [{ pts: samp.map((s) => [s.t, s.v]), ckey: "accent", label: "v(t)" }, { pts: samp.map((s) => [s.t, s.w]), ckey: "warn", label: "ω(t)" }, { pts: samp.map((s) => [s.t, s.phi * 180 / Math.PI / 45 * vm * 0.5]), ckey: "alive2", label: "φ(t)（缩放）", dash: [4, 3] }] });
      this.note.innerHTML = "单轮车的平坦输出就是位置 y = (x, y)：给定任意光滑曲线 y(t)，θ = atan2(ẏ, ẋ)、v = ‖ẏ‖、ω = (ẋÿ − ẏẍ)/v² 都是 y 的导数的函数——(15.164)(15.165) 的形式，完全不需要积分。画面里蓝线是把这些 v、ω 真的积分一遍的结果，与绿线重合。对简单车（13.15），后轴中心同样是平坦输出，转向角由曲率给出 tan φ = Lκ；超过 φ_max 的部分标红——平坦性把「满足微分约束」变成了「曲线的曲率够不够小」这样的几何条件。书中提到的带拖车的车，平坦输出是最后一节拖车的位置。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      const P = this.P;
      st.line(P[0], P[1], col.muted, 1, [4, 3]); st.line(P[2], P[3], col.muted, 1, [4, 3]);
      st.polyline(this.samp, col.path, 5);
      const lim = this.phiMax * Math.PI / 180;
      for (let k = 1; k < this.samp.length; k++) if (Math.abs(this.samp[k].phi) > lim) st.line(this.samp[k - 1], this.samp[k], col.bad, 5);
      st.polyline(this.int, col.accent, 1.8, [6, 4]);
      for (let k = 0; k <= 300; k += 50) C.drawCar(st, this.samp[k], C.alpha(col.text2, 0.85), { size: 0.4, steer: this.samp[k].phi, lw: 1.2 });
      P.forEach((p, i) => st.dot(p, 6, i === 0 ? col.start : i === 3 ? col.goal : col.surface, i === 0 ? col.start : i === 3 ? col.goal : col.text2, 2));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='cfs-steer']").forEach((el) => (el._w = new CFSSteer(el)));
    document.querySelectorAll("[data-widget='sinusoid']").forEach((el) => (el._w = new Sinusoid(el)));
    document.querySelectorAll("[data-widget='chained']").forEach((el) => (el._w = new Chained(el)));
    document.querySelectorAll("[data-widget='flatness']").forEach((el) => (el._w = new Flatness(el)));
  });
})();
