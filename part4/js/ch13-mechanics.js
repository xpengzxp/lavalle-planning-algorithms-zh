/* 13.3 节：月球着陆器（例 13.7）、自由刚体的转动（Euler 方程与四元数）、平面刚体与推进器（13.109）、带轮胎侧滑的车 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------
  // 组件：月球着陆器（例 13.7、图 13.8）
  // ---------------------------------------------------------------
  // 地形：若干折线（世界坐标，单位 m），着陆台另给
  const TERRAIN = [
    [[0, 8.5], [1.2, 8.2], [1.6, 6.6], [1.1, 4.6], [1.4, 2.6], [3.2, 2.2], [3.6, 1.2], [5.2, 0.9], [5.6, 2.2], [7.4, 1.4], [8.4, 0.4], [10.6, 0.4], [11.6, 1.6], [12.6, 1.5], [13.7, 3.4], [13.1, 5.4], [13.8, 7.2], [13.2, 9.2], [14.4, 10.6]],
    [[4.4, 12], [4.6, 10.2], [5.8, 9.6], [6.2, 7.4], [7.6, 7.0], [8.0, 8.6], [9.6, 8.8], [9.9, 12]],
  ];
  const PAD = [8.6, 10.4, 0.4];

  class LunarLander {
    constructor(root) {
      this.m = 1; this.g = 1.622; this.fl = 0.7; this.fr = 0.7; this.fu = 2.8;
      const body = C.frame(root, "月球着陆器", "→ 点左推进器（向右推），← 点右推进器（向左推），↑ 点底部推进器（先点一下图）；着陆速度须小于 0.6 m/s");
      this.st = new C.Stage({ view: [0, 14.4, 0, 12], maxW: 600, aspect: 0.8, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.keys = C.keys(root, ["ArrowUp", "ArrowLeft", "ArrowRight"]);
      this.btn = { l: 0, r: 0, u: 0 };
      this.stats = [C.stat("x = (q₁, q₂, q̇₁, q̇₂)"), C.stat("u = (u_l, u_r, u_u)"), C.stat("ẋ₃, ẋ₄"), C.stat("燃料时间")];
      this.msg = h("div", { class: "msg info" });
      this.runner = new C.Runner(root, (dt) => this.step(dt));
      body.append(
        h("div", { class: "controls" },
          C.holdButton("← 右推进器", () => this.btn.r = 1, () => this.btn.r = 0), C.holdButton("↑ 底部推进器", () => this.btn.u = 1, () => this.btn.u = 0), C.holdButton("左推进器 →", () => this.btn.l = 1, () => this.btn.l = 0),
          C.button("重新开始", () => this.reset(), "primary")),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cv("accent"), "着陆器（质点，不能转动）与轨迹"], [C.cv("warn"), "开着的推进器（力的方向）"], [C.cv("goal"), "着陆台"], [C.cv("wall"), "地形"]]));
      this.reset();
      this.runner.start();
    }
    reset() { this.x = [2.6, 10.6, 0.3, 0]; this.trace = []; this.state = "fly"; this.burn = 0; this.u = [0, 0, 0]; this.update(); }
    f(x, u) {
      const [ul, ur, uu] = u;
      return [x[2], x[3], (ul * this.fl - ur * this.fr) / this.m, (uu * this.fu) / this.m - this.g];   // (13.58)–(13.60)
    }
    hit(p) {
      const r = 0.22;
      if (p.x < 0 || p.x > 14.4 || p.y < 0) return true;
      for (const L of TERRAIN) for (let i = 1; i < L.length; i++) {
        const a = L[i - 1], b = L[i], dx = b[0] - a[0], dy = b[1] - a[1], t = C.clamp(((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
        if (Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy) < r) return true;
      }
      return false;
    }
    step(dt) {
      if (this.state !== "fly") return true;
      const k = this.keys;
      this.u = [k.has("ArrowRight") || this.btn.l ? 1 : 0, k.has("ArrowLeft") || this.btn.r ? 1 : 0, k.has("ArrowUp") || this.btn.u ? 1 : 0];
      for (let i = 0; i < 4; i++) this.x = C.rk4((x) => this.f(x, this.u), this.x, dt / 4);
      this.burn += dt * (this.u[0] + this.u[1] + this.u[2]);
      const p = { x: this.x[0], y: this.x[1] };
      this.trace.push(p); if (this.trace.length > 4000) this.trace.shift();
      if (p.y - 0.22 <= PAD[2] && p.x > PAD[0] && p.x < PAD[1]) {
        const v = Math.hypot(this.x[2], this.x[3]);
        this.state = v < 0.6 ? "landed" : "crash";
        this.x[1] = PAD[2] + 0.22; this.x[2] = this.x[3] = 0;
        this.landV = v;
      } else if (this.hit(p)) { this.state = "crash"; this.landV = Math.hypot(this.x[2], this.x[3]); }
      this.update();
      return true;
    }
    update() {
      const x = this.x, f = this.f(x, this.u);
      this.stats[0].set(`(${x[0].toFixed(1)}, ${x[1].toFixed(1)}, ${x[2].toFixed(2)}, ${x[3].toFixed(2)})`);
      this.stats[1].set(`(${this.u.join(", ")})`);
      this.stats[2].set(`${f[2].toFixed(2)}, ${f[3].toFixed(2)}`);
      this.stats[3].set(this.burn.toFixed(1) + " s");
      if (this.state === "fly") { this.msg.className = "msg info"; this.msg.textContent = `U 有 2³ = 8 个动作。底部推进器的加速度 f_u/m = ${(this.fu / this.m).toFixed(2)} 只比 g = 1.622 大一点：想减速要提前。左右推进器只改变水平速度——着陆器是质点，不会转动，C = ℝ²、X = ℝ⁴。`; }
      else if (this.state === "landed") { this.msg.className = "msg ok"; this.msg.textContent = `成功着陆！触地速度 ${this.landV.toFixed(2)} m/s，推进器累计工作 ${this.burn.toFixed(1)} s。`; }
      else { this.msg.className = "msg bad"; this.msg.textContent = `坠毁（速度 ${this.landV.toFixed(2)} m/s）。动量让你无法在最后一刻停下——这正是相空间里的漂移。点「重新开始」。`; }
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const L of TERRAIN) st.path(L.map(([x, y]) => ({ x, y })), col.wall, 2.4);
      st.line({ x: PAD[0], y: PAD[2] }, { x: PAD[1], y: PAD[2] }, col.goal, 6);
      st.path(this.trace, C.alpha(col.accent, 0.7), 1.4);
      const p = { x: this.x[0], y: this.x[1] };
      // 推进器的力（箭头画在着陆器上，指向力的方向）
      if (this.u[0]) st.arrow({ x: p.x - 0.25, y: p.y }, { x: p.x + 0.55, y: p.y }, col.warn, 2.6, 8);
      if (this.u[1]) st.arrow({ x: p.x + 0.25, y: p.y }, { x: p.x - 0.55, y: p.y }, col.warn, 2.6, 8);
      if (this.u[2]) st.arrow({ x: p.x, y: p.y - 0.2 }, { x: p.x, y: p.y + 0.75 }, col.warn, 2.6, 8);
      st.arrow({ x: p.x, y: p.y }, { x: p.x, y: p.y - 0.5 }, C.alpha(col.muted, 0.8), 1.2, 6);
      const color = this.state === "crash" ? col.bad : col.accent;
      st.poly([{ x: p.x - 0.2, y: p.y - 0.12 }, { x: p.x + 0.2, y: p.y - 0.12 }, { x: p.x + 0.13, y: p.y + 0.18 }, { x: p.x - 0.13, y: p.y + 0.18 }], C.alpha(color, 0.35), color, 1.6);
      st.line({ x: p.x - 0.15, y: p.y - 0.12 }, { x: p.x - 0.24, y: p.y - 0.24 }, color, 1.4); st.line({ x: p.x + 0.15, y: p.y - 0.12 }, { x: p.x + 0.24, y: p.y - 0.24 }, color, 1.4);
      st.text("mg", { x: p.x + 0.2, y: p.y - 0.5 }, col.muted, { size: 10 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：自由刚体的转动：Euler 方程 (13.102) + 四元数姿态
  // ---------------------------------------------------------------
  function qmul(p, q) {
    return [p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3], p[0] * q[1] + p[1] * q[0] + p[2] * q[3] - p[3] * q[2],
      p[0] * q[2] - p[1] * q[3] + p[2] * q[0] + p[3] * q[1], p[0] * q[3] + p[1] * q[2] - p[2] * q[1] + p[3] * q[0]];
  }
  function qrot(q) {
    const [a, b, c, d] = q;
    return [[a * a + b * b - c * c - d * d, 2 * (b * c - a * d), 2 * (b * d + a * c)], [2 * (b * c + a * d), a * a - b * b + c * c - d * d, 2 * (c * d - a * b)], [2 * (b * d - a * c), 2 * (c * d + a * b), a * a - b * b - c * c + d * d]];
  }
  const qnorm = (q) => { const n = Math.hypot(...q) || 1; return q.map((x) => x / n); };

  class RigidBody3D {
    constructor(root) {
      this.dims = [1.8, 1.2, 0.6];   // 盒子的三边（沿机体 x、y、z）→ I₁₁ < I₂₂ < I₃₃
      this.w0 = [0.03, 2.0, 0.03]; this.ghost = true;
      const body = C.frame(root, "自由刚体的转动", "无外力矩：ω 由 Euler 方程 (13.102) 演化，姿态由四元数积分。拖动画面旋转视角");
      this.V = new C.View3D({ R: 2.1, az: -0.8, el: 0.35, maxW: 430, aspect: 0.9, onDraw: (ctx, V, col) => this.draw(ctx, V, col) });
      this.plot = new C.TimePlot({ aspect: 0.48, maxW: 380, ylabel: "机体角速度 ω₁ ω₂ ω₃", yrange: [-2.6, 2.6] });
      this.segP = C.seg([["mid", "绕中间轴 I₂₂（不稳定）"], ["min", "绕最小惯量轴 I₁₁"], ["max", "绕最大惯量轴 I₃₃"], ["gen", "一般初值"]], "mid", (k) => this.preset(k));
      this.cbG = C.check("同时显示按原书 (13.103) 积分的姿态（红色虚框）", this.ghost, (v) => { this.ghost = v; this.V.draw(); });
      this.stats = [C.stat("I₁₁, I₂₂, I₃₃"), C.stat("动能 T = ½ωᵀIω"), C.stat("|Iω|（角动量大小）"), C.stat("t")];
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 播放", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      body.append(h("div", { class: "controls" }, this.segP, this.btn), h("div", { class: "controls" }, this.cbG),
        h("div", { class: "split" }, this.V.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap,
          h("p", { class: "small" }, "绕最大或最小惯量轴的转动是稳定的；绕中间轴的转动会周期性地翻转（ω₂ 在 ±2 之间跳）——这是「网球拍定理」/Dzhanibekov 效应（补充）。整个过程中 T 与 |Iω| 都守恒。"),
          C.legend([[C.cv("accent"), "刚体（盒子三边 1.8 : 1.2 : 0.6）"], [C.cv("text"), "角动量 Iω（世界系中固定不动）"], [C.cv("bad"), "按原书 (13.103) 积分的姿态"]]))));
      this.preset("mid");
    }
    get I() { const [a, b, c] = this.dims, m = 1; return [(m * (b * b + c * c)) / 12, (m * (a * a + c * c)) / 12, (m * (a * a + b * b)) / 12]; }
    preset(k) {
      this.runner && this.runner.stop();
      this.w = k === "mid" ? [0.05, 2, 0.05] : k === "min" ? [2, 0.05, 0.05] : k === "max" ? [0.05, 0.05, 2] : [0.8, 1.2, 1.0];
      this.q = [1, 0, 0, 0]; this.qb = [1, 0, 0, 0]; this.t = 0; this.hist = [];
      if (this.btn) this.btn.textContent = "▶ 播放";
      this.update();
    }
    step(dt) {
      const I = this.I, n = 12, hh = (1.5 * dt) / n;   // 1.5 倍速播放
      for (let i = 0; i < n; i++) {
        this.w = C.rk4((w) => [((I[1] - I[2]) * w[1] * w[2]) / I[0], ((I[2] - I[0]) * w[2] * w[0]) / I[1], ((I[0] - I[1]) * w[0] * w[1]) / I[2]], this.w, hh);   // (13.102)，N = 0
        const dq = qmul(this.q, [0, ...this.w]).map((x) => 0.5 * x);          // 正确：q̇ = ½ q ⊗ (0, ω)
        this.q = qnorm(this.q.map((x, j) => x + hh * dq[j]));
        const [, b, c, d] = this.qb, w = this.w;                             // 原书 (13.103)
        const nb = [b + hh * (w[2] * c - w[1] * d), c + hh * (w[0] * d - w[2] * b), d + hh * (w[1] * b - w[0] * c)];
        this.qb = [Math.sqrt(Math.max(0, 1 - nb[0] ** 2 - nb[1] ** 2 - nb[2] ** 2)), ...nb];
        this.t += hh;
      }
      this.hist.push([this.t, ...this.w]); if (this.hist.length > 900) this.hist.shift();
      this.update();
      return true;
    }
    update() {
      const I = this.I, w = this.w;
      this.stats[0].set(I.map((x) => x.toFixed(3)).join(", "));
      this.stats[1].set((0.5 * (I[0] * w[0] ** 2 + I[1] * w[1] ** 2 + I[2] * w[2] ** 2)).toFixed(5));
      this.stats[2].set(Math.hypot(I[0] * w[0], I[1] * w[1], I[2] * w[2]).toFixed(5));
      this.stats[3].set(this.t.toFixed(1));
      const H = this.hist, xr = H.length ? [H[0][0], Math.max(H[0][0] + 8, this.t)] : [0, 8];
      this.plot.set([{ data: H.map((r) => [r[0], r[1]]), color: "ok", lw: 1.4 }, { data: H.map((r) => [r[0], r[2]]), color: "accent", lw: 2 }, { data: H.map((r) => [r[0], r[3]]), color: "warn", lw: 1.4 }], xr);
      this.V.draw();
    }
    drawBox(V, R, col, color, fillA, dash) {
      const [a, b, c] = this.dims.map((x) => x / 2);
      const P = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) P.push(C.m3.vec(R, [sx * a, sy * b, sz * c]));
      const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
      const fc = [col.ok, col.ok, col.bad, col.bad, col.warn, col.warn];   // ±x 绿、±y 红、±z 橙：便于看出姿态
      if (fillA > 0) {
        faces.map((f, i) => ({ f, i, z: f.reduce((s, k) => s + V.proj(P[k]).z, 0) / 4 })).sort((A, B) => A.z - B.z)
          .forEach(({ f, i }) => V.poly(f.map((k) => P[k]), C.alpha(fc[i], fillA), C.alpha(color, 0.9), 1.2));
      } else faces.forEach((f) => V.path([...f, f[0]].map((k) => P[k]), color, 1.3, dash));
    }
    draw(ctx, V, col) {
      V.st.frame(col);
      V.axes(1.6, col, ["x", "y", "z"]);
      const R = qrot(this.q);
      if (this.ghost) this.drawBox(V, qrot(this.qb), col, col.bad, 0, [5, 4]);
      this.drawBox(V, R, col, col.accent, 0.45);
      const I = this.I, Lb = [I[0] * this.w[0], I[1] * this.w[1], I[2] * this.w[2]], Lw = C.m3.vec(R, Lb), s = 0.9 / (C.v3.norm(Lw) || 1);
      V.arrow([0, 0, 0], C.v3.mul(Lw, s * 1.6), col.text, 2, 9);
    }
  }

  // ---------------------------------------------------------------
  // 组件：平面刚体与推进器（(13.79)(13.80)、(13.109)）
  // ---------------------------------------------------------------
  // 推进器：作用点 r（机体系）、力的方向（机体系）
  const THR = [
    { name: "T₁ 尾部中心", r: [-0.8, 0], f: [1, 0] },
    { name: "T₂ 尾部左侧", r: [-0.8, 0.4], f: [1, 0] },
    { name: "T₃ 头部左侧", r: [0.6, 0.35], f: [0, -1] },
    { name: "T₄ 尾部右侧", r: [-0.6, -0.35], f: [0, 1] },
  ];
  class PlanarThrusters {
    constructor(root) {
      this.m = 1; this.Iz = 0.25; this.mag = 0.6; this.on = [false, false, false, false];
      const body = C.frame(root, "平面刚体与推进器", "勾选要点火的推进器（二值动作）；F、N 是合力与对质心的合力矩");
      this.st = new C.Stage({ view: [-4.5, 4.5, -2.7, 2.7], maxW: 600, aspect: 0.6, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.cbs = THR.map((t, i) => C.check(t.name, false, (v) => { this.on[i] = v; this.update(); }));
      this.stats = [C.stat("F(u)（世界系）"), C.stat("N(u) = Σ r × f"), C.stat("(v₁, v₂, ω)")];
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 运行", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      body.append(h("div", { class: "controls" }, ...this.cbs), h("div", { class: "controls" }, this.btn, C.button("重置", () => this.reset()), C.button("关掉全部", () => { this.on = [false, false, false, false]; this.cbs.forEach((c) => c.input.checked = false); this.update(); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats),
        h("p", { class: "small" }, "只开 T₁：力过质心，N = 0，纯平移（像例 13.7 的着陆器）。只开 T₂：同样大的力，但作用线偏离质心，既平移又转动——这就是习题 7 要你推广着陆器模型的原因。T₃ + T₄：合力为 0、合力矩不为 0，原地转（一对「力偶」）。由 (13.109)，ω̇ = N/I：2D 中没有力矩时 ω 不会变。"),
        C.legend([[C.cv("accent"), "刚体与质心轨迹"], [C.cv("warn"), "点火的推进器（力 f）"], [C.cv("text"), "合力 F（画在质心）"]]));
      this.reset();
    }
    reset() { this.runner && this.runner.stop(); this.x = [-2.2, -0.8, 0.3, 0, 0, 0]; this.trace = []; if (this.btn) this.btn.textContent = "▶ 运行"; this.update(); }
    FN(th) {
      let F = [0, 0], N = 0;
      THR.forEach((t, i) => {
        if (!this.on[i]) return;
        const f = [t.f[0] * this.mag, t.f[1] * this.mag];
        N += t.r[0] * f[1] - t.r[1] * f[0];                       // r × f（机体系中算，2D 标量）
        F = [F[0] + f[0] * Math.cos(th) - f[1] * Math.sin(th), F[1] + f[0] * Math.sin(th) + f[1] * Math.cos(th)];
      });
      return { F, N };
    }
    f(x) { const { F, N } = this.FN(x[2]); return [x[3], x[4], x[5], F[0] / this.m, F[1] / this.m, N / this.Iz]; }   // (13.109)
    step(dt) {
      for (let i = 0; i < 4; i++) this.x = C.rk4((x) => this.f(x), this.x, dt / 4);
      if (Math.abs(this.x[0]) > 4.8) { this.x[0] -= Math.sign(this.x[0]) * 9.6; this.trace.push(null); }
      if (Math.abs(this.x[1]) > 3) { this.x[1] -= Math.sign(this.x[1]) * 6; this.trace.push(null); }
      this.trace.push({ x: this.x[0], y: this.x[1] }); if (this.trace.length > 3000) this.trace.shift();
      this.update();
      return true;
    }
    update() {
      const { F, N } = this.FN(this.x[2]);
      this.stats[0].set(`(${F[0].toFixed(2)}, ${F[1].toFixed(2)})`);
      this.stats[1].set(N.toFixed(3));
      this.stats[2].set(`(${this.x[3].toFixed(2)}, ${this.x[4].toFixed(2)}, ${this.x[5].toFixed(2)})`);
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      let seg = [];
      for (const p of this.trace) { if (!p) { st.path(seg, C.alpha(col.accent, 0.6), 1.4); seg = []; } else seg.push(p); }
      st.path(seg, C.alpha(col.accent, 0.6), 1.4);
      const [x, y, th] = this.x;
      const shape = [[-0.8, -0.45], [0.4, -0.45], [0.95, 0], [0.4, 0.45], [-0.8, 0.45]].map(([u, v]) => C.body2w(x, y, th, u, v));
      st.poly(shape, C.alpha(col.accent, 0.16), col.accent, 1.8);
      THR.forEach((t, i) => {
        const p = C.body2w(x, y, th, t.r[0], t.r[1]);
        st.dot(p, 3.5, this.on[i] ? col.warn : col.muted);
        if (this.on[i]) { const d = [t.f[0] * Math.cos(th) - t.f[1] * Math.sin(th), t.f[0] * Math.sin(th) + t.f[1] * Math.cos(th)]; st.arrow(p, { x: p.x + 0.7 * d[0], y: p.y + 0.7 * d[1] }, col.warn, 2.2, 7); }
        st.text(String(i + 1), C.body2w(x, y, th, t.r[0] - 0.12, t.r[1] * 1.35), col.muted, { size: 10 });
      });
      const { F } = this.FN(th);
      if (Math.hypot(F[0], F[1]) > 1e-9) st.arrow({ x, y }, { x: x + F[0] * 1.2, y: y + F[1] * 1.2 }, col.text, 2.2, 8);
      st.dot({ x, y }, 4, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：带轮胎侧滑的车（13.110）–（13.113）vs 运动学简单车
  // ---------------------------------------------------------------
  class TireSkid {
    constructor(root) {
      this.P = { m: 1460, cf: 17000, cr: 20000, a: 1.2, b: 1.5, I: 2170 };
      this.s = 27; this.phiDeg = 2; this.sign = "phys";
      const body = C.frame(root, "带轮胎侧滑的车", "书中参数：m = 1460 kg，c_f = 17000，c_r = 20000，a = 1.2 m，b = 1.5 m，I = 2170 kg·m²");
      this.st = new C.Stage({ view: [-20, 300, -100, 180], maxW: 640, aspect: 0.62, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.plot = new C.TimePlot({ aspect: 0.36, maxW: 640, ylabel: "横摆角速度 ω（rad/s）：侧滑模型（蓝）vs 运动学简单车（灰虚线）" });
      this.segS = C.seg([["phys", "轮胎力取恢复方向（补充）"], ["book", "按 (13.111)–(13.113) 字面"]], this.sign, (k) => { this.sign = k; this.run(); });
      this.sV = C.slider("速度 s", 5, 40, 1, this.s, (v) => { this.s = v; this.run(); }, (v) => v + " m/s");
      this.sP = C.slider("转向角 φ（1 秒后阶跃）", -6, 6, 0.25, this.phiDeg, (v) => { this.phiDeg = v; this.run(); }, (v) => v.toFixed(2) + "°");
      this.stats = [C.stat("线性化特征值"), C.stat("稳态 ω（侧滑）"), C.stat("运动学 ω = s tanφ / L"), C.stat("稳态侧滑速度 v")];
      this.msg = h("div", { class: "msg info" });
      body.append(h("div", { class: "controls" }, this.segS), h("div", { class: "controls" }, this.sV, this.sP),
        this.st.wrap, this.plot.wrap, h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cv("accent"), "侧滑模型的轨迹（后轴中心）"], [C.cva("muted", 0.9), "运动学简单车（L = a + b）"], [C.cv("bad"), "失控（侧滑速度发散）"]]));
      this.run();
    }
    // 状态 (x, y, θ, ω, v)；sign = +1 字面，−1 恢复方向
    rhs(x, phi) {
      const { m, cf, cr, a, b, I } = this.P, s = this.s, sg = this.sign === "book" ? 1 : -1;
      const [, , th, w, v] = x;
      // 字面：f_f = c_f((v + aω)/s + φ)，f_r = c_r(v − bω)/s；恢复方向：f_f = c_f(φ − (v + aω)/s)，f_r = c_r(bω − v)/s
      const ff = this.sign === "book" ? cf * ((v + a * w) / s + phi) : cf * (phi - (v + a * w) / s);
      const fr = (sg * cr * (v - b * w)) / s;
      return [s * Math.cos(th) - v * Math.sin(th), s * Math.sin(th) + v * Math.cos(th), w, (a * ff - b * fr) / I, -s * w + (ff + fr) / m];
    }
    jac() {
      const { m, cf, cr, a, b, I } = this.P, s = this.s, sg = this.sign === "book" ? 1 : -1;
      return [[(sg * (cf + cr)) / (m * s), -s + (sg * (a * cf - b * cr)) / (m * s)], [(sg * (a * cf - b * cr)) / (I * s), (sg * (a * a * cf + b * b * cr)) / (I * s)]];
    }
    run() {
      const T = 12, dt = 0.005, phi = this.phiDeg * DEG, L = this.P.a + this.P.b;
      let x = [0, 0, 0, 0, 0], k = [0, 0, 0];
      this.path = [{ x: 0, y: 0 }]; this.kpath = [{ x: 0, y: 0 }]; this.hist = [];
      this.blow = false;
      for (let t = 0; t < T; t += dt) {
        const ph = t < 1 ? 0 : phi;
        x = C.rk4((z) => this.rhs(z, ph), x, dt);
        k = C.rk4((z) => [this.s * Math.cos(z[2]), this.s * Math.sin(z[2]), (this.s / L) * Math.tan(ph)], k, dt);
        if (Math.abs(x[4]) > 60 || !isFinite(x[4])) { this.blow = true; break; }
        if (Math.round(t / dt) % 10 === 0) { this.path.push({ x: x[0], y: x[1] }); this.kpath.push({ x: k[0], y: k[1] }); this.hist.push([t, x[3], (this.s / L) * Math.tan(ph), x[4]]); }
      }
      const J = this.jac(), tr = J[0][0] + J[1][1], det = J[0][0] * J[1][1] - J[0][1] * J[1][0], disc = (tr * tr) / 4 - det;
      const ev = disc >= 0 ? [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)] : null;
      this.stats[0].set(ev ? ev.map((e) => e.toFixed(3)).join(", ") : `${(tr / 2).toFixed(3)} ± ${Math.sqrt(-disc).toFixed(3)}i`);
      const stable = ev ? Math.max(...ev) < 0 : tr < 0;
      // 稳态：J·(v, ω) + B φ = 0
      const { m, cf, a, I } = this.P;
      const B = [(cf * phi) / m, (a * cf * phi) / I];     // 两种写法里 φ 项的符号相同
      const dd = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      const vss = (-B[0] * J[1][1] + J[0][1] * B[1]) / dd, wss = (-J[0][0] * B[1] + B[0] * J[1][0]) / dd;
      this.stats[1].set(stable ? wss.toFixed(4) : "不存在（不稳定）");
      this.stats[2].set(((this.s / L) * Math.tan(phi)).toFixed(4));
      this.stats[3].set(stable ? vss.toFixed(3) + " m/s" : "–");
      if (this.sign === "book") { this.msg.className = "msg bad"; this.msg.textContent = "按字面代入正的 c_f、c_r：轮胎力把车往它正在滑的方向推，线性化有一个正特征值，侧滑速度指数增长——车自己就会打转（参考代码第 14 项）。说明书中的符号约定是：侧偏刚度取负（SAE 约定），或者 (13.111) 里的轮胎力应带负号。"; }
      else { this.msg.className = "msg ok"; this.msg.textContent = `轮胎力指向「阻止侧滑」的方向（补充：c_f(φ − (v+aω)/s)、c_r(bω − v)/s）：两个特征值实部为负，转向后很快进入稳态。这辆车 b·c_r > a·c_f，是不足转向：同样的 φ，实际转得比运动学模型慢，而且速度越高差得越多。`; }
      const H = this.hist;
      this.plot.set([{ data: H.map((r) => [r[0], r[2]]), color: "muted", dash: [5, 4], lw: 1.4 }, { data: H.map((r) => [r[0], r[1]]), color: this.blow ? "bad" : "accent", lw: 2 }], [0, 12],
        this.blow ? [-1.5, 1.5] : null);
      // 视野：包住两条路径
      const all = this.path.concat(this.kpath);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of all) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const pad = 0.08 * Math.max(x1 - x0, y1 - y0, 40);
      this.st.setView([x0 - pad, x1 + pad, y0 - pad, y1 + pad]);
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const span = Math.max(st.view[1] - st.view[0], st.view[3] - st.view[2]), g = Math.pow(10, Math.floor(Math.log10(span / 3)));
      st.grid(col, g, { axes: false });
      st.path(this.kpath, C.alpha(col.muted, 0.9), 1.6, [6, 5]);
      st.path(this.path, this.blow ? col.bad : col.accent, 2.4);
      const e = this.path[this.path.length - 1];
      st.dot(e, 5, this.blow ? col.bad : col.accent, col.surface, 1.5);
      st.dot({ x: 0, y: 0 }, 4, col.text);
      st.text(`网格 ${g} m`, { x: st.view[0], y: st.view[2] }, col.muted, { align: "left", dx: 6, dy: -8, size: 10.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='lunar-lander']").forEach((el) => el._w = new LunarLander(el));
    document.querySelectorAll("[data-widget='rigid-body']").forEach((el) => el._w = new RigidBody3D(el));
    document.querySelectorAll("[data-widget='planar-thrusters']").forEach((el) => el._w = new PlanarThrusters(el));
    document.querySelectorAll("[data-widget='tire-skid']").forEach((el) => el._w = new TireSkid(el));
  });
})();
