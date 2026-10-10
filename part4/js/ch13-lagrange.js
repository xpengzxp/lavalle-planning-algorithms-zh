/* 13.4 节：变分（图 13.12、例 13.9–13.11）、两连杆机械臂（例 13.13）、球面上的质点（例 13.14）、Hamilton 相流与 Liouville */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;

  // ---------------------------------------------------------------
  // 组件：变分与 Euler–Lagrange 方程
  // ---------------------------------------------------------------
  const FUN = {
    arc: { name: "例 13.9 弧长 L = √(1+ẋ²)", L: (x, xd) => Math.sqrt(1 + xd * xd), T: 1, xa: 0.2, xb: 0.7, yr: [-0.4, 1.4],
      ext: (t) => 0.2 + 0.5 * t, el: "Euler–Lagrange：d/dt(ẋ/√(1+ẋ²)) = 0 ⇒ ẋ 为常数 ⇒ 直线。" },
    ex10: { name: "例 13.10 L = x³ + ẋ²", L: (x, xd) => x * x * x + xd * xd, T: 1, xa: 0.5, xb: 1.0, yr: [-0.2, 1.6],
      ext: null, el: "Euler–Lagrange (13.123)：2ẍ − 3x² = 0 ⇒ ẍ = 3x²/2。本页用打靶法求出满足两端条件的解。" },
    fall: { name: "例 13.11 落体 L = ½mq̇² − mgq", L: (x, xd) => 0.5 * xd * xd - 9.8 * x, T: 0.8, xa: 0, xb: 0, yr: [-0.5, 1.4],
      ext: (t) => 9.8 * 0.4 * t - 4.9 * t * t, el: "Euler–Lagrange 给出 mq̈ + mg = 0 (13.135)：真实轨迹是抛物线，它让作用量 (13.127) 取驻值（这里 m = 1、g = 9.8）。" },
  };
  class Variations {
    constructor(root) {
      this.k = "ex10"; this.c = 0.5; this.w = 0.35; this.eps = 0.15; this.base = "ext";
      const body = C.frame(root, "变分：在整条曲线上做「微小扰动」", "图 13.12：x̃ + εh，h 在两端为 0。拖动中间的三个控制点可以自己造一条曲线");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 420, aspect: 0.8, iso: false, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { if (this.base !== "free") return null; const i = this.ctrl.findIndex((c) => Math.abs(c.t - p.x) < 0.06 * this.F.T && Math.abs(c.x - p.y) < 0.12); return i >= 0 ? { i } : null; },
        onMove: (p, d) => { this.ctrl[d.i].x = C.clamp(p.y, this.F.yr[0], this.F.yr[1]); this.update(); },
        cursor: (p) => (this.base === "free" && this.ctrl.some((c) => Math.abs(c.t - p.x) < 0.06 * this.F.T && Math.abs(c.x - p.y) < 0.12) ? "grab" : null) });
      this.plot = new C.TimePlot({ aspect: 0.62, maxW: 340, xlabel: "ε", ylabel: "Φ(x̃ + εh)" });
      this.segF = C.seg(Object.entries(FUN).map(([k, f]) => [k, f.name]), this.k, (k) => { this.k = k; this.setup(); });
      this.segB = C.seg([["ext", "x̃ = 极值曲线"], ["line", "x̃ = 直线"], ["free", "x̃ = 自己拖"]], this.base, (k) => { this.base = k; this.setup(); });
      this.sC = C.slider("h 的位置", 0.15, 0.85, 0.01, this.c, (v) => { this.c = v; this.update(); }, (v) => v.toFixed(2));
      this.sW = C.slider("h 的宽度", 0.1, 0.5, 0.01, this.w, (v) => { this.w = v; this.update(); }, (v) => v.toFixed(2));
      this.sE = C.slider("ε", -0.4, 0.4, 0.01, this.eps, (v) => { this.eps = v; this.update(); }, (v) => v.toFixed(2));
      this.stats = [C.stat("Φ(x̃)"), C.stat("dΦ/dε 在 ε = 0"), C.stat("E–L 残差 max|d/dt ∂L/∂ẋ − ∂L/∂x|")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segF), h("div", { class: "controls" }, this.segB),
        h("div", { class: "controls" }, this.sC, this.sW, this.sE),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.plot.wrap, h("div", { class: "stats" }, this.stats), this.note)),
        C.legend([[C.cv("accent"), "x̃(t)"], [C.cva("ok", 0.9), "x̃ + εh（竖线是变分 εh）"], [C.cv("muted"), "Φ 随 ε 的变化"]]));
      this.setup();
    }
    get F() { return FUN[this.k]; }
    // 例 13.10 的极值曲线：打靶
    shoot10() {
      const F = this.F, run = (v0) => { let s = [F.xa, v0]; const n = 400; for (let i = 0; i < n; i++) s = C.rk4((y) => [y[1], 1.5 * y[0] * y[0]], s, F.T / n); return s[0]; };
      let lo = -3, hi = 3; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (run(m) > F.xb) hi = m; else lo = m; }
      const v0 = (lo + hi) / 2, n = 400, pts = []; let s = [F.xa, v0];
      for (let i = 0; i <= n; i++) { pts.push(s[0]); s = C.rk4((y) => [y[1], 1.5 * y[0] * y[0]], s, F.T / n); }
      return (t) => { const u = C.clamp(t / F.T, 0, 1) * n, i = Math.min(n - 1, Math.floor(u)), f = u - i; return pts[i] * (1 - f) + pts[i + 1] * f; };
    }
    setup() {
      const F = this.F;
      this.st.setView([-0.04 * F.T, 1.04 * F.T, F.yr[0], F.yr[1]]);
      this.extremal = F.ext || this.shoot10();
      const line = (t) => F.xa + ((F.xb - F.xa) * t) / F.T;
      this.ctrl = [0.25, 0.5, 0.75].map((u) => ({ t: u * F.T, x: this.extremal(u * F.T) + (this.base === "free" ? 0.15 * Math.sin(6 * u) : 0) }));
      this.baseFn = this.base === "ext" ? this.extremal : this.base === "line" ? line : (t) => this.spline(t);
      this.update();
    }
    // 过端点与三个控制点的 Catmull–Rom 样条
    spline(t) {
      const F = this.F, P = [{ t: 0, x: F.xa }, ...this.ctrl, { t: F.T, x: F.xb }];
      let i = 0; while (i < P.length - 2 && t > P[i + 1].t) i++;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const u = (t - p1.t) / (p2.t - p1.t), m1 = (p2.x - p0.x) / (p2.t - p0.t) * (p2.t - p1.t), m2 = (p3.x - p1.x) / (p3.t - p1.t) * (p2.t - p1.t);
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * p1.x + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2.x + (u3 - u2) * m2;
    }
    hfun(t) { const T = this.F.T, u = t / T, c = this.c, w = this.w; return Math.abs(u - c) < w ? Math.pow(Math.cos((Math.PI * (u - c)) / (2 * w)), 2) : 0; }
    Phi(eps) {
      const F = this.F, n = 400, dt = F.T / n; let s = 0;
      for (let i = 0; i < n; i++) {
        const t0 = i * dt, t1 = t0 + dt;
        const a = this.baseFn(t0) + eps * this.hfun(t0), b = this.baseFn(t1) + eps * this.hfun(t1);
        s += F.L((a + b) / 2, (b - a) / dt) * dt;
      }
      return s;
    }
    residual() {
      // 有限差分算 E–L 残差：d/dt ∂L/∂ẋ − ∂L/∂x
      const F = this.F, n = 200, dt = F.T / n, x = (t) => this.baseFn(t), e = 1e-5;
      let worst = 0;
      const dLdxd = (t) => { const xd = (x(t + dt / 2) - x(t - dt / 2)) / dt, xm = x(t); return (F.L(xm, xd + e) - F.L(xm, xd - e)) / (2 * e); };
      for (let i = 3; i < n - 2; i++) {
        const t = i * dt, xd = (x(t + dt / 2) - x(t - dt / 2)) / dt, xm = x(t);
        const r = (dLdxd(t + dt / 2) - dLdxd(t - dt / 2)) / dt - (F.L(xm + e, xd) - F.L(xm - e, xd)) / (2 * e);
        worst = Math.max(worst, Math.abs(r));
      }
      return worst;
    }
    update() {
      const P0 = this.Phi(0), d = (this.Phi(1e-4) - this.Phi(-1e-4)) / 2e-4;
      this.stats[0].set(P0.toFixed(5)); this.stats[1].set(Math.abs(d) < 5e-5 ? "≈ 0" : d.toFixed(4)); this.stats[2].set(this.residual().toFixed(3));
      const data = []; for (let e = -0.4; e <= 0.4001; e += 0.02) data.push([e, this.Phi(e)]);
      const lo = Math.min(...data.map((d) => d[1])), hi = Math.max(...data.map((d) => d[1])), m = 0.08 * (hi - lo || 1);
      this.plot.set([{ data, color: "muted", lw: 2 }, { data: [[this.eps, lo - m], [this.eps, hi + m]], color: "ok", dash: [4, 3], lw: 1.4 }], [-0.4, 0.4], [lo - m, hi + m]);
      this.note.innerHTML = this.F.el + (this.base === "ext" ? " 在极值曲线上，Φ(ε) 在 ε = 0 处是平的（导数为 0），无论 h 放在哪里。" : " 这条曲线不是极值曲线：选合适的 h，Φ 在 ε = 0 处有非零斜率，可以沿该方向把 Φ 变小。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 0.2, { axes: false });
      const F = this.F, n = 160, P = [], Q = [];
      for (let i = 0; i <= n; i++) { const t = (F.T * i) / n; P.push({ x: t, y: this.baseFn(t) }); Q.push({ x: t, y: this.baseFn(t) + this.eps * this.hfun(t) }); }
      for (let i = 0; i <= 40; i++) { const t = (F.T * i) / 40, a = this.baseFn(t), e = this.eps * this.hfun(t); if (Math.abs(e) > 1e-4) st.line({ x: t, y: a }, { x: t, y: a + e }, C.alpha(col.ok, 0.6), 1); }
      st.path(Q, col.ok, 1.8, [5, 3]);
      st.path(P, col.accent, 2.4);
      st.dot({ x: 0, y: F.xa }, 5, col.text); st.dot({ x: F.T, y: F.xb }, 5, col.text);
      if (this.base === "free") this.ctrl.forEach((c) => st.dot({ x: c.t, y: c.x }, 7, col.accent, col.surface, 2));
      st.text("t", { x: F.T, y: F.yr[0] }, col.muted, { dx: 8, dy: -8 });
      st.text(this.k === "fall" ? "q(t)" : "x(t)", { x: 0, y: F.yr[1] }, col.muted, { dx: 18, dy: 10 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：两连杆机械臂（例 13.13）
  // ---------------------------------------------------------------
  class TwoLink {
    constructor(root) {
      Object.assign(this, { m1: 1, m2: 0.8, d1: 1, d2: 0.8, l1: 0.5, l2: 0.4, I1: 0.08, I2: 0.05, g: 9.8 });
      this.book = false; this.grav = true; this.ctl = "free"; this.u = [0, 0]; this.target = [0.6, 0.8];
      const body = C.frame(root, "两连杆机械臂", "拖动肘部 / 末端设定初始位形；动力学 M(q)q̈ + C(q,q̇)q̇ + g(q) = u (13.142)");
      this.st = new C.Stage({ view: [-2, 2, -2, 2], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const [e, t] = this.joints(); if (Math.hypot(p.x - t.x, p.y - t.y) < 0.2) return "t"; if (Math.hypot(p.x - e.x, p.y - e.y) < 0.2) return "e"; return null; },
        onMove: (p, d) => { this.runner.stop(); this.btn.textContent = "▶ 运行"; if (d === "e") this.x[0] = Math.atan2(p.y, p.x); else { const e = this.joints()[0]; this.x[1] = C.wrap(Math.atan2(p.y - e.y, p.x - e.x) - this.x[0]); } this.x[2] = this.x[3] = 0; this.t = 0; this.hist = []; this.E0 = this.energy(); this.update(); },
        cursor: (p) => { const [e, t] = this.joints(); return Math.hypot(p.x - t.x, p.y - t.y) < 0.2 || Math.hypot(p.x - e.x, p.y - e.y) < 0.2 ? "grab" : null; } });
      this.plot = new C.TimePlot({ aspect: 0.55, maxW: 360, ylabel: "总能量 K + V − E(0)" });
      this.segC = C.seg([["free", "u = 0 自由摆动"], ["pd", "PD + 重力补偿（补充）"]], this.ctl, (k) => { this.ctl = k; this.update(); });
      this.segB = C.seg([["fix", "C(q,q̇) 正确"], ["book", "按原书 (13.159) 字面"]], "fix", (k) => { this.book = k === "book"; this.restart(); });
      this.cbG = C.check("重力", true, (v) => { this.grav = v; this.restart(); });
      this.s1 = C.slider("目标 θ₁*", -3.1, 3.1, 0.05, this.target[0], (v) => { this.target[0] = v; }, (v) => v.toFixed(2));
      this.s2 = C.slider("目标 θ₂*", -3.1, 3.1, 0.05, this.target[1], (v) => { this.target[1] = v; }, (v) => v.toFixed(2));
      this.stats = [C.stat("q = (θ₁, θ₂)"), C.stat("m₁₁, m₁₂, m₂₂"), C.stat("r = m₂d₁ℓ₂ sin θ₂"), C.stat("能量漂移")];
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 运行"; });
      this.btn = C.button("▶ 运行", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 运行"; }, "primary");
      body.append(h("div", { class: "controls" }, this.btn, C.button("从 (0.9, 0.6) 静止释放", () => { this.x = [0.9, 0.6, 0, 0]; this.restart(); }), this.cbG),
        h("div", { class: "controls" }, this.segB), h("div", { class: "controls" }, this.segC, this.s1, this.s2),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap, this.note = h("p", { class: "small" }))),
        C.legend([[C.cv("accent"), "连杆 A₁、A₂（小圆点 = 质心）"], [C.cv("warn"), "关节力矩 u₁、u₂"], [C.cv("goal"), "PD 的目标位形"]]));
      this.x = [0.9, 0.6, 0, 0];
      this.restart();
    }
    restart() { this.t = 0; this.hist = []; this.x[2] = this.x[3] = 0; this.E0 = this.energy(); this.update(); }
    joints() { const [a, b] = this.x; const e = { x: this.d1 * Math.cos(a), y: this.d1 * Math.sin(a) }; return [e, { x: e.x + this.d2 * Math.cos(a + b), y: e.y + this.d2 * Math.sin(a + b) }]; }
    M(q) { const c2 = Math.cos(q[1]), m22 = this.I2 + this.m2 * this.l2 ** 2, m12 = this.I2 + this.m2 * (this.l2 ** 2 + this.d1 * this.l2 * c2); return [[this.I1 + this.m1 * this.l1 ** 2 + this.I2 + this.m2 * (this.d1 ** 2 + this.l2 ** 2 + 2 * this.d1 * this.l2 * c2), m12], [m12, m22]]; }   // (13.156)
    gv(q) { const G = this.grav ? this.g : 0, c12 = Math.cos(q[0] + q[1]); return [(this.m1 * this.l1 + this.m2 * this.d1) * G * Math.cos(q[0]) + this.m2 * this.l2 * G * c12, this.m2 * this.l2 * G * c12]; }
    Cm(q, qd) { const r = this.m2 * this.d1 * this.l2 * Math.sin(q[1]); return [[-r * qd[1], -r * (qd[0] + qd[1])], [this.book ? -r * qd[0] : r * qd[0], 0]]; }   // 正确：(2,1) 元 = +r θ̇₁
    energy() {
      const [a, b, w1, w2] = this.x, G = this.grav ? this.g : 0;
      const v1 = this.l1 * w1, v2x = -this.d1 * Math.sin(a) * w1 - this.l2 * Math.sin(a + b) * (w1 + w2), v2y = this.d1 * Math.cos(a) * w1 + this.l2 * Math.cos(a + b) * (w1 + w2);
      const K = 0.5 * this.m1 * v1 * v1 + 0.5 * this.I1 * w1 * w1 + 0.5 * this.m2 * (v2x * v2x + v2y * v2y) + 0.5 * this.I2 * (w1 + w2) ** 2;
      const V = this.m1 * G * this.l1 * Math.sin(a) + this.m2 * G * (this.d1 * Math.sin(a) + this.l2 * Math.sin(a + b));
      return K + V;
    }
    control(x) {
      if (this.ctl !== "pd") return [0, 0];
      const q = [x[0], x[1]], gg = this.gv(q), e = [C.wrap(this.target[0] - x[0]), C.wrap(this.target[1] - x[1])];
      return [gg[0] + 30 * e[0] - 8 * x[2], gg[1] + 20 * e[1] - 5 * x[3]];
    }
    f(x) {
      const q = [x[0], x[1]], qd = [x[2], x[3]], M = this.M(q), Cq = this.Cm(q, qd), gg = this.gv(q), u = this.control(x);
      const rhs = [u[0] - Cq[0][0] * qd[0] - Cq[0][1] * qd[1] - gg[0], u[1] - Cq[1][0] * qd[0] - Cq[1][1] * qd[1] - gg[1]];
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      return [qd[0], qd[1], (rhs[0] * M[1][1] - M[0][1] * rhs[1]) / det, (M[0][0] * rhs[1] - rhs[0] * M[1][0]) / det];   // (13.148)
    }
    step(dt) {
      const n = 20;
      for (let i = 0; i < n; i++) { this.x = C.rk4((x) => this.f(x), this.x, dt / n); this.t += dt / n; }
      this.u = this.control(this.x);
      this.hist.push([this.t, this.energy() - this.E0]); if (this.hist.length > 900) this.hist.shift();
      if (!this.x.every(isFinite) || Math.abs(this.x[2]) > 200) { this.x = [0.9, 0.6, 0, 0]; this.restart(); return false; }
      this.update();
      return true;
    }
    update() {
      const q = [this.x[0], this.x[1]], M = this.M(q), dE = this.energy() - this.E0;
      this.stats[0].set(`(${this.x[0].toFixed(2)}, ${this.x[1].toFixed(2)})`);
      this.stats[1].set(`${M[0][0].toFixed(3)}, ${M[0][1].toFixed(3)}, ${M[1][1].toFixed(3)}`);
      this.stats[2].set((this.m2 * this.d1 * this.l2 * Math.sin(q[1])).toFixed(3));
      this.stats[3].set(this.ctl === "pd" ? "（有控制，不守恒）" : dE.toExponential(2));
      const H = this.hist, xr = H.length ? [H[0][0], Math.max(H[0][0] + 5, this.t)] : [0, 5];
      this.plot.set([{ data: H, color: this.book ? "bad" : "accent", lw: 2 }], xr, this.book || this.ctl === "pd" ? null : [-0.01, 0.01]);
      this.s1.style.display = this.s2.style.display = this.ctl === "pd" ? "" : "none";
      this.note.innerHTML = this.book
        ? "按原书 (13.159) 把 C 的 (2,1) 元印成 +θ̇₁（乘上前面的 −m₂ℓ₁ℓ₂p₂），u = 0 时能量会凭空变化——物理上不可能。正确的 C 由 Christoffel 符号 (13.147) 算出：(2,1) 元是 r θ̇₁，正好给出 (13.161) 第二行的 r θ̇₁²（参考代码第 16 项）。"
        : "u = 0 时机械臂是保守系统：K + V 守恒（右图只有数值误差量级的漂移，纵轴 ±0.01）。参数：m₁ = 1，m₂ = 0.8，d₁ = 1，ℓ₁ = 0.5，ℓ₂ = 0.4，I₁ = 0.08，I₂ = 0.05。PD + 重力补偿是第 15 章之前的「补充」，只是为了能把机械臂开到想要的位置。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 0.5);
      if (this.ctl === "pd") {
        const [a, b] = this.target, e = { x: this.d1 * Math.cos(a), y: this.d1 * Math.sin(a) }, t = { x: e.x + this.d2 * Math.cos(a + b), y: e.y + this.d2 * Math.sin(a + b) };
        st.path([{ x: 0, y: 0 }, e, t], C.alpha(col.goal, 0.7), 2, [5, 4]);
      }
      const [e, t] = this.joints(), a = this.x[0], b = this.x[1];
      st.line({ x: 0, y: 0 }, e, col.accent, 9); st.line(e, t, col.accent, 7);
      st.line({ x: 0, y: 0 }, e, col.surface, 5); st.line(e, t, col.surface, 3.5);
      st.dot({ x: this.l1 * Math.cos(a), y: this.l1 * Math.sin(a) }, 4, col.accent);
      st.dot({ x: e.x + this.l2 * Math.cos(a + b), y: e.y + this.l2 * Math.sin(a + b) }, 4, col.accent);
      st.dot({ x: 0, y: 0 }, 7, col.text); st.dot(e, 6, col.text); st.dot(t, 5, col.accent, col.surface, 2);
      const u = this.u, arc = (c, r, val) => { if (Math.abs(val) < 0.05) return; const ang = C.clamp(val / 15, -1.5, 1.5); const P = []; for (let i = 0; i <= 20; i++) { const th = (ang * i) / 20; P.push({ x: c.x + r * Math.cos(th + 0.3), y: c.y + r * Math.sin(th + 0.3) }); } st.path(P, col.warn, 2.2); };
      arc({ x: 0, y: 0 }, 0.22, u[0]); arc(e, 0.18, u[1]);
      st.text("θ₁", { x: 0.35, y: 0.08 }, col.muted, { size: 11 });
      st.line({ x: -2, y: 0 }, { x: 2, y: 0 }, C.alpha(col.muted, 0.5), 1);
      if (this.grav) st.arrow({ x: 1.7, y: 1.6 }, { x: 1.7, y: 1.1 }, col.muted, 1.4, 7), st.text("g", { x: 1.82, y: 1.35 }, col.muted, { size: 11 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：球面上的质点（例 13.14）：约束拉格朗日 → 沿大圆运动
  // ---------------------------------------------------------------
  class ParticleSphere {
    constructor(root) {
      this.dir = 40; this.speed = 1.2; this.grav = false;
      const body = C.frame(root, "球面上的质点", "例 13.14：L = ½m|q̇|²，约束 q₁² + q₂² + q₃² = 1。拖动画面旋转");
      this.V = new C.View3D({ R: 1.5, az: -0.6, el: 0.4, maxW: 420, aspect: 1, onDraw: (ctx, V, col) => this.draw(ctx, V, col) });
      this.sD = C.slider("初速度方向", 0, 180, 1, this.dir, (v) => { this.dir = v; this.reset(); }, (v) => v + "°");
      this.sS = C.slider("速率", 0.3, 3, 0.05, this.speed, (v) => { this.speed = v; this.reset(); }, (v) => v.toFixed(2));
      this.cbG = C.check("加重力 −q₃ 方向（补充：球面摆）", false, (v) => { this.grav = v; this.reset(); });
      this.stats = [C.stat("|q|"), C.stat("与初始平面 c·q = 0 的距离"), C.stat("λ（约束力大小）")];
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 播放", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      body.append(h("div", { class: "controls" }, this.btn, this.sD, this.sS, this.cbG),
        h("div", { class: "split" }, this.V.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.note = h("p", { class: "small" }),
          C.legend([[C.cv("accent"), "质点轨迹"], [C.cva("ok", 0.5), "过球心的平面 c₁q₁ + c₂q₂ + c₃q₃ = 0 (13.178)"]]))));
      this.reset();
    }
    reset() {
      const q = [Math.cos(0.4), 0, Math.sin(0.4)];
      const e1 = C.v3.unit(C.v3.cross([0, 0, 1], q)), e2 = C.v3.cross(q, e1), d = (this.dir * Math.PI) / 180;
      const v = C.v3.mul(C.v3.add(C.v3.mul(e1, Math.cos(d)), C.v3.mul(e2, Math.sin(d))), this.speed);
      this.x = [...q, ...v]; this.trace = [q]; this.n = C.v3.unit(C.v3.cross(q, v)); this.t = 0;
      this.update();
    }
    acc(x) {
      const q = x.slice(0, 3), v = x.slice(3), a = this.grav ? [0, 0, -1.5] : [0, 0, 0];
      const lam = (C.v3.dot(q, a) + C.v3.dot(v, v)) / C.v3.dot(q, q);                 // 约束力 −λq 使 q·q̈ + |q̇|² = 0
      const stab = -20 * (C.v3.dot(q, q) - 1) - 10 * C.v3.dot(q, v);                // 约束漂移的 Baumgarte 稳定化
      this.lam = lam;
      return [...v, ...C.v3.add(a, C.v3.mul(q, -lam + stab * 0.5))];
    }
    step(dt) {
      for (let i = 0; i < 10; i++) this.x = C.rk4((x) => this.acc(x), this.x, dt / 10);
      this.trace.push(this.x.slice(0, 3)); if (this.trace.length > 2500) this.trace.shift();
      this.update();
      return true;
    }
    update() {
      const q = this.x.slice(0, 3);
      this.stats[0].set(C.v3.norm(q).toFixed(6));
      this.stats[1].set(Math.abs(C.v3.dot(this.n, q)).toExponential(2));
      this.stats[2].set((this.lam === undefined ? C.v3.dot(this.x.slice(3), this.x.slice(3)) : this.lam).toFixed(3));
      this.note.innerHTML = this.grav
        ? "加上重力后就不再是大圆了：质点像球面摆一样在两个纬度之间来回（距离初始平面的数值明显不为 0）。这已经超出例 13.14，是补充对比。"
        : "无重力时，(13.177) 给出 q̈ᵢ ∝ qᵢ：加速度始终指向球心，所以 q × q̇ 是常向量 c，q 始终在平面 c·q = 0 上 (13.178)——平面与球面的交线是大圆，也就是球面上的测地线（最短路）。";
      this.V.draw();
    }
    draw(ctx, V, col) {
      V.st.frame(col);
      // 球面经纬线（背面淡一些）
      const ring = (fn) => { const P = []; for (let i = 0; i <= 72; i++) P.push(fn((2 * Math.PI * i) / 72)); let seg = [], front = null; for (const p of P) { const f = V.proj(p).z > 0; if (front !== null && f !== front) { V.path(seg, front ? C.alpha(col.muted, 0.55) : C.alpha(col.muted, 0.18), 1); seg = [seg[seg.length - 1]]; } seg.push(p); front = f; } V.path(seg, front ? C.alpha(col.muted, 0.55) : C.alpha(col.muted, 0.18), 1); };
      for (let k = -2; k <= 2; k++) { const z = k * 0.38, r = Math.sqrt(1 - z * z); ring((t) => [r * Math.cos(t), r * Math.sin(t), z]); }
      for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 6; ring((t) => [Math.cos(a) * Math.cos(t), Math.sin(a) * Math.cos(t), Math.sin(t)]); }
      // 初始平面
      const n = this.n, e1 = C.v3.unit(Math.abs(n[2]) < 0.9 ? C.v3.cross(n, [0, 0, 1]) : C.v3.cross(n, [1, 0, 0])), e2 = C.v3.cross(n, e1);
      const disc = []; for (let i = 0; i < 48; i++) { const t = (2 * Math.PI * i) / 48; disc.push(C.v3.mul(C.v3.add(C.v3.mul(e1, Math.cos(t)), C.v3.mul(e2, Math.sin(t))), 1.25)); }
      V.poly(disc, C.alpha(col.ok, 0.12), C.alpha(col.ok, 0.5), 1);
      V.path(this.trace, col.accent, 2.2);
      const q = this.x.slice(0, 3), v = this.x.slice(3);
      V.arrow(q, C.v3.add(q, C.v3.mul(v, 0.3)), col.accent, 1.8, 7);
      V.dot(q, 6, col.accent, col.surface, 2);
      V.dot([0, 0, 0], 3, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：Hamilton 相流与 Liouville 定理（摆：H = p²/2 − (g/L) cos q，m = L = 1）
  // ---------------------------------------------------------------
  function contour(st, f, nx, ny, levels, color, lw) {
    const [x0, x1, y0, y1] = st.view, dx = (x1 - x0) / nx, dy = (y1 - y0) / ny, V = [];
    for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(f(x0 + i * dx, y0 + j * dy)); V.push(row); }
    const ctx = st.ctx; ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.beginPath();
    for (const lv of levels) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]], pts = [];
      const P = [[x0 + i * dx, y0 + j * dy], [x0 + (i + 1) * dx, y0 + j * dy], [x0 + (i + 1) * dx, y0 + (j + 1) * dy], [x0 + i * dx, y0 + (j + 1) * dy]];
      for (let k = 0; k < 4; k++) { const a = c[k] - lv, b = c[(k + 1) % 4] - lv; if ((a < 0) !== (b < 0)) { const t = a / (a - b); pts.push([P[k][0] + t * (P[(k + 1) % 4][0] - P[k][0]), P[k][1] + t * (P[(k + 1) % 4][1] - P[k][1])]); } }
      for (let k = 0; k + 1 < pts.length; k += 2) { ctx.moveTo(st.X(pts[k][0]), st.Y(pts[k][1])); ctx.lineTo(st.X(pts[k + 1][0]), st.Y(pts[k + 1][1])); }
    }
    ctx.stroke();
  }
  class Hamiltonian {
    constructor(root) {
      this.gL = 9.8; this.mode = "right"; this.k = 0.5; this.c = [0.6, 1.0]; this.r = 0.45;
      const body = C.frame(root, "Hamilton 相流", "相平面 (q, p)：一团初值（蓝色区域）随 Hamilton 方程流动。点击相平面移动这团初值");
      this.st = new C.Stage({ view: [-Math.PI, Math.PI, -8, 8], maxW: 470, aspect: 0.85, iso: false, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.c = [p.x, p.y]; this.reset(); return null; }, cursor: () => "crosshair" });
      this.segM = C.seg([["right", "q̇ = ∂H/∂p，ṗ = −∂H/∂q"], ["book", "原书 (13.198)：ṗ = +∂H/∂q"], ["damp", "加阻尼 −kp（非保守）"]], this.mode, (k) => { this.mode = k; this.reset(); });
      this.stats = [C.stat("t"), C.stat("区域面积（初始）"), C.stat("区域面积（现在）"), C.stat("中心点的 H")];
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 播放", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.btn, C.button("重置", () => this.reset())),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.note = h("p", { class: "small" }),
          C.legend([[C.cva("muted", 0.8), "H 的等值线"], [C.cva("accent", 0.35), "一团初值随流运动"], [C.cv("accent"), "区域中心的轨迹"]]))));
      this.reset();
    }
    H(q, p) { return 0.5 * p * p - this.gL * Math.cos(q); }
    f(x) {
      const [q, p] = x, dHdq = this.gL * Math.sin(q), dHdp = p;
      if (this.mode === "book") return [dHdp, dHdq];
      if (this.mode === "damp") return [dHdp, -dHdq - this.k * p];
      return [dHdp, -dHdq];
    }
    reset() {
      this.runner && this.runner.stop();
      const N = 160; this.blob = []; for (let i = 0; i < N; i++) { const t = (2 * Math.PI * i) / N; this.blob.push([this.c[0] + this.r * Math.cos(t), this.c[1] + this.r * 1.6 * Math.sin(t)]); }
      this.ctr = this.c.slice(); this.trace = [{ x: this.ctr[0], y: this.ctr[1] }]; this.t = 0; this.A0 = this.area();
      if (this.btn) this.btn.textContent = "▶ 播放";
      this.update();
    }
    area() { const B = this.blob; let s = 0; for (let i = 0; i < B.length; i++) { const a = B[i], b = B[(i + 1) % B.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
    step(dt) {
      const n = 4, hh = (dt * 0.7) / n;
      for (let k = 0; k < n; k++) { this.blob = this.blob.map((x) => C.rk4((y) => this.f(y), x, hh)); this.ctr = C.rk4((y) => this.f(y), this.ctr, hh); this.t += hh; }
      // 边界被拉长时在相邻两点间插入中点（误差是二阶小量），保证面积估计准确
      if (this.blob.length < 3000) {
        const B = [];
        for (let i = 0; i < this.blob.length; i++) { const a = this.blob[i], b = this.blob[(i + 1) % this.blob.length]; B.push(a); if (Math.hypot(a[0] - b[0], (a[1] - b[1]) / 2.5) > 0.08) B.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
        this.blob = B;
      }
      this.trace.push({ x: this.ctr[0], y: this.ctr[1] }); if (this.trace.length > 2000) this.trace.shift();
      this.update();
      if (Math.abs(this.ctr[1]) > 60) return false;
      return true;
    }
    update() {
      this.stats[0].set(this.t.toFixed(2)); this.stats[1].set(this.A0.toFixed(4)); this.stats[2].set(this.area().toFixed(4)); this.stats[3].set(this.H(this.ctr[0], this.ctr[1]).toFixed(3));
      const notes = {
        right: "Hamilton 方程（带负号）：H 守恒，每个点都沿着自己那条等值线走；整团区域被拉长、扭曲，但面积不变——Liouville 定理。所以保守系统不可能渐近稳定：一团状态不可能收缩成一个点。",
        book: "按原书 (13.198) 印的 ṗ = +∂H/∂q：H 不再守恒（右上角中心点的 H 一直在变），轨迹横穿等值线，实际上变成了倒立摆的方程 q̈ = +(g/L) sin q。（这个 H 恰好可分离，所以面积碰巧仍守恒——但能量守恒失败已足以说明符号错了；参考代码第 18 项。）",
        damp: "加上阻尼 −kp 这种非保守力后，面积不断缩小，区域最终收缩到最低点附近：只有非保守系统才可能渐近稳定。",
      };
      this.note.innerHTML = notes[this.mode];
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, Math.PI / 2, { axes: true });
      const levels = []; for (let E = -9; E <= 30; E += 3) levels.push(E);
      contour(st, (q, p) => this.H(q, p), 90, 90, levels, C.alpha(col.muted, 0.6), 1);
      contour(st, (q, p) => this.H(q, p), 90, 90, [this.gL], C.alpha(col.muted, 0.95), 1.6);
      ctx.save(); ctx.beginPath(); const [x0, x1, y0, y1] = st.view; ctx.rect(st.X(x0), st.Y(y1), (x1 - x0) * st.sx, (y1 - y0) * st.sy); ctx.clip();
      // 区域（在 q 方向按 2π 周期画三份，便于看到绕出去的部分）
      for (const sh of [-2 * Math.PI, 0, 2 * Math.PI]) st.poly(this.blob.map(([q, p]) => ({ x: q + sh, y: p })), C.alpha(col.accent, 0.3), C.alpha(col.accent, 0.8), 1.2);
      ctx.restore();
      const tr = this.trace.map((p) => ({ x: C.wrap(p.x), y: p.y }));
      let seg = []; for (let i = 0; i < tr.length; i++) { if (i && Math.abs(tr[i].x - tr[i - 1].x) > Math.PI) { st.path(seg, col.accent, 1.8); seg = []; } seg.push(tr[i]); } st.path(seg, col.accent, 1.8);
      st.dot({ x: C.wrap(this.ctr[0]), y: this.ctr[1] }, 5, col.accent, col.surface, 1.5);
      st.text("q", { x: Math.PI, y: 0 }, col.muted, { dx: -10, dy: -10, weight: 650 }); st.text("p", { x: 0, y: 8 }, col.muted, { dx: 10, dy: 10, weight: 650 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='variations']").forEach((el) => el._w = new Variations(el));
    document.querySelectorAll("[data-widget='two-link']").forEach((el) => el._w = new TwoLink(el));
    document.querySelectorAll("[data-widget='particle-sphere']").forEach((el) => el._w = new ParticleSphere(el));
    document.querySelectorAll("[data-widget='hamiltonian']").forEach((el) => el._w = new Hamiltonian(el));
  });
})();
