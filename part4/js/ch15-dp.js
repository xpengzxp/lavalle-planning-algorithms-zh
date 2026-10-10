/* 15.2 节：HJB 方程（逐点看 min_u H = 0）、值迭代逼近 HJB、线性二次问题（Riccati）、Pontryagin 最小值原理（例 15.4） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH15;

  // 双积分器 x1' = x2, x2' = u, |u| ≤ 1 到原点的解析最短时间 G*（参考代码第 5、6 项）
  function Gstar(x1, x2) {
    if (x1 > -0.5 * x2 * Math.abs(x2)) return x2 + 2 * Math.sqrt(x1 + 0.5 * x2 * x2);
    return -x2 + 2 * Math.sqrt(-x1 + 0.5 * x2 * x2);
  }
  function gradG(x1, x2) {
    if (x1 > -0.5 * x2 * Math.abs(x2)) { const s = Math.sqrt(x1 + 0.5 * x2 * x2); return [1 / s, 1 + x2 / s]; }
    const s = Math.sqrt(-x1 + 0.5 * x2 * x2); return [-1 / s, -1 + x2 / s];
  }
  const switchCurve = (st, col, color) => {
    const P1 = [], P2 = [];
    for (let k = 0; k <= 80; k++) { const v = 3 * k / 80; P1.push({ x: -0.5 * v * v, y: v }); P2.push({ x: 0.5 * v * v, y: -v }); }
    st.polyline(P1, color, 2.4); st.polyline(P2, color, 2.4);
  };
  // 代价到目标 G* 的蓝色热图（由浅到深 = 由小到大）
  function blueHeat(st, col, G, vmax) {
    const lo = C.rgb(col.surface), hi = C.rgb(col.accent);
    C.drawHeat(st, G, (v) => {
      if (!isFinite(v)) return [...C.mixRGB(col.surface, col.bad, 0.18), 255];
      const t = Math.min(1, v / vmax) * 0.55;
      return [0, 1, 2].map((i) => Math.round(lo[i] + (hi[i] - lo[i]) * t)).concat([255]);
    });
  }

  // ===============================================================
  // 组件 1：逐点看 HJB (15.14)：min_u { l + ∇G*·f(x,u) } = 0
  // ===============================================================
  class HJBPoint {
    constructor(root) {
      this.x = { x: 1.2, y: 0.4 }; this.timeView = false;
      const body = C.frame(root, "HJB 方程在一个点上", "拖动状态 x；看哪个 u 让 G* 下降得最快");
      this.st = new C.Stage({ view: [-2.6, 2.6, -2.2, 2.2], aspect: 0.85, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.x) < 0.2 ? "x" : (this.x = p, this.update(), "x")),
        onMove: (p) => { this.x = { x: C.clamp(p.x, -2.5, 2.5), y: C.clamp(p.y, -2.1, 2.1) }; this.update(); }, cursor: () => "grab" });
      this.G = C.sampleGrid(Gstar, 131, 111, [-2.6, 2.6, -2.2, 2.2]);
      this.plot = new C.Plot({ aspect: 0.6, maxW: 360, xlim: [-1, 1], ylim: [-2, 2], xlab: "u", ylab: "H" });
      this.stats = [C.stat("G*(x)"), C.stat("λ = ∇G*"), C.stat("u*"), C.stat("min_u H")];
      this.tv = C.toggle("时间最优的看法：λ = −∂G*/∂x (15.40)", false, (v) => { this.timeView = v; this.update(); });
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.tv),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap, this.note)),
        C.legend([[C.cv("accent"), "G* 由小到大（蓝色由浅到深）"], [C.cv("text2"), "G* 的等值线 = 反向可达集的边界"], [C.cv("warn"), "切换曲线"], [C.cv("ok"), "最优速度 f(x, u*)"], [C.cv("alive2"), "−∇G*（最陡下降方向）"]]));
      this.update();
    }
    update() {
      const { x: x1, y: x2 } = this.x, g = gradG(x1, x2), G = Gstar(x1, x2);
      const ustar = g[1] > 0 ? -1 : 1, H = (u) => 1 + g[0] * x2 + g[1] * u;
      this.stats[0].set(G.toFixed(3));
      this.stats[1].set(`(${g[0].toFixed(2)}, ${g[1].toFixed(2)})`);
      this.stats[2].set(ustar > 0 ? "+1" : "−1");
      this.stats[3].set(H(ustar).toExponential(1));
      const pts = [[-1, H(-1)], [1, H(1)]], ymax = Math.max(2, Math.abs(H(-1)), Math.abs(H(1))) * 1.1;
      if (this.timeView) {
        const Ht = (u) => -(g[0] * x2 + g[1] * u); // ⟨−∂G*/∂x, f⟩
        this.plot.set({ ylim: [-ymax, ymax], ylab: "H̃", series: [{ pts: [[-1, Ht(-1)], [1, Ht(1)]], ckey: "alive2", label: "⟨−∂G*/∂x, f(x,u)⟩" }],
          marks: [{ x: ustar, color: undefined, label: "u*" }, { y: 1, label: "最大值 = 1" }] });
        this.note.innerHTML = `书中 (15.40)(15.41)：时间最优时 l = 1 可以不管，令 λ = −∂G*/∂x，哈密顿量 H = ⟨−∂G*/∂x, f(x,u)⟩ 要<b>最大化</b>（Pontryagin 原始的写法）。u* 让速度 f 尽量对准最陡下降方向，最大值恰好是 1：G* 每秒正好减少 1。`;
      } else {
        this.plot.set({ ylim: [-ymax, ymax], ylab: "H", series: [{ pts, ckey: "accent", label: "H(x,u,λ) = 1 + λ₁x₂ + λ₂u" }],
          marks: [{ x: ustar, label: "u*" }, { y: 0, label: "0" }] });
        this.note.innerHTML = `H 对 u 是线性的，最小值在端点 u* = ${ustar > 0 ? "+1" : "−1"} 处取到，而且恰好等于 0——这就是 HJB (15.14)。等价地，(15.15)：沿最优方向的方向导数 ∇G*·f(x,u*) = ${(g[0] * x2 + g[1] * ustar).toFixed(4)} = −l = −1。切换曲线上 G* 不可微（梯度跳变），那里 u* 从 −1 换成 +1。`;
      }
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      blueHeat(st, col, this.G, 6);
      const levels = []; for (let v = 0.5; v <= 7; v += 0.5) levels.push(v);
      C.drawContours(st, this.G, levels, C.alpha(col.text2, 0.55), 1);
      st.grid(col, 1, { axes: true });
      switchCurve(st, col, col.warn);
      const { x: x1, y: x2 } = this.x, g = gradG(x1, x2), s = 0.45, ustar = g[1] > 0 ? -1 : 1;
      // 速度集合 f(x, U) = {(x2, u) : u ∈ [−1, 1]}
      const a = { x: x1 + s * x2, y: x2 - s }, b = { x: x1 + s * x2, y: x2 + s };
      st.line(a, b, col.text2, 3);
      st.text("u = −1", a, col.text2, { dy: 11, size: 10.5 }); st.text("u = +1", b, col.text2, { dy: -11, size: 10.5 });
      st.arrow(this.x, { x: x1 + s * x2, y: x2 + s * ustar }, col.ok, 2.6, 9);
      const n = Math.hypot(g[0], g[1]);
      st.arrow(this.x, { x: x1 - 0.55 * g[0] / n, y: x2 - 0.55 * g[1] / n }, col.alive2, 2.2, 8);
      st.dot(this.x, 6.5, col.start, col.surface, 2); st.text("x", this.x, col.start, { dx: -12, dy: -10, weight: 700 });
      st.dot({ x: 0, y: 0 }, 5, col.goal, col.surface, 1.5); st.text("x_G", { x: 0, y: 0 }, col.goal, { dx: 16, dy: 10, size: 11 });
      st.text("x₁（位置）", { x: 2.6, y: 0 }, col.muted, { dx: -30, dy: 10, size: 11 }); st.text("x₂（速度）", { x: 0, y: 2.2 }, col.muted, { dx: 30, dy: 8, size: 11 });
    }
  }

  // ===============================================================
  // 组件 2：值迭代 (15.6)/(15.9) 逼近 HJB
  // ===============================================================
  class VIHJB {
    constructor(root) {
      this.n = 41; this.dt = 0.1; this.iter = 0;
      const body = C.frame(root, "从离散动态规划到 HJB：值迭代", "半拉格朗日格式：G(x) ← min_u { Δt + G(x + f(x,u)Δt) }，G 在格点间双线性插值");
      this.st = new C.Stage({ view: [-2, 2, -2, 2], maxW: 470, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.selN = C.seg([["21", "21×21"], ["41", "41×41"], ["61", "61×61"]], "41", (k) => { this.n = +k; this.reset(); });
      this.sDt = C.slider("Δt =", 0.03, 0.3, 0.01, this.dt, (v) => { this.dt = v; this.reset(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => { const more = this.sweep(); this.refresh(); return more; });
      this.stats = [C.stat("迭代次数"), C.stat("|x|∞ ≤ 1 内平均 |误差|"), C.stat("最大误差"), C.stat("已赋值格点")];
      this.showErr = false;
      body.append(h("div", { class: "controls" }, this.selN, this.sDt),
        h("div", { class: "controls" }, C.button("一步迭代", () => { this.sweep(); this.refresh(); }), C.button("迭代到收敛", () => this.runner.start(), "primary"),
          C.button("重置", () => this.reset()), C.toggle("底色显示误差", false, (v) => { this.showErr = v; this.st.draw(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats),
          h("p", { class: "small" }, "实线：值迭代得到的 G 的等值线；虚线：解析的 G*（参考代码第 5 项）。目标换成半径为一个格距的小球，Δt 是离散时间模型（14.2.2 节）的时间步。"),
          h("p", { class: "small muted" }, "动作只取 u ∈ {−1, 0, 1}——最优动作本来就在端点上（见上一个图）。"))),
        C.legend([[C.cv("accent"), "值迭代的等值线"], [C.cv("text"), "解析 G* 的等值线（虚线）"], [C.cv("warn"), "切换曲线"]]));
      this.reset();
    }
    reset() {
      this.runner.stop();
      const n = this.n, hh = 4 / (n - 1); this.h = hh; this.gr = hh * 1.0;
      this.V = new Float64Array(n * n).fill(Infinity);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (Math.hypot(-2 + i * hh, -2 + j * hh) <= this.gr + 1e-9) this.V[j * n + i] = 0;
      this.iter = 0; this.refresh();
    }
    interp(x, y) {
      const n = this.n, hh = this.h, fx = (x + 2) / hh, fy = (y + 2) / hh;
      if (fx < 0 || fy < 0 || fx > n - 1 || fy > n - 1) return Infinity;
      const i = Math.min(Math.floor(fx), n - 2), j = Math.min(Math.floor(fy), n - 2), ax = fx - i, ay = fy - j, V = this.V;
      let s = 0, w = 0;
      for (const [v, ww] of [[V[j * n + i], (1 - ax) * (1 - ay)], [V[j * n + i + 1], ax * (1 - ay)], [V[(j + 1) * n + i], (1 - ax) * ay], [V[(j + 1) * n + i + 1], ax * ay]])
        if (isFinite(v) && ww > 0) { s += ww * v; w += ww; }
      return w > 1e-9 ? s / w : Infinity;   // 忽略还是 ∞ 的角点（与第 8 章的做法相同）
    }
    sweep() {
      const n = this.n, hh = this.h, dt = this.dt, NV = new Float64Array(this.V); let change = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x1 = -2 + i * hh, x2 = -2 + j * hh;
        if (Math.hypot(x1, x2) <= this.gr + 1e-9) continue;
        let best = Infinity;
        for (const u of [-1, 0, 1]) best = Math.min(best, dt + this.interp(x1 + x2 * dt + 0.5 * u * dt * dt, x2 + u * dt));
        if (isFinite(best)) { const old = this.V[j * n + i]; change = Math.max(change, isFinite(old) ? Math.abs(old - best) : 1); NV[j * n + i] = best; }
      }
      this.V = NV; this.iter++;
      return change > 1e-7 && this.iter < 3000;
    }
    refresh() {
      const n = this.n, hh = this.h; let s = 0, cnt = 0, mx = 0, fin = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const v = this.V[j * n + i]; if (isFinite(v)) fin++;
        const x1 = -2 + i * hh, x2 = -2 + j * hh;
        if (Math.abs(x1) <= 1 + 1e-9 && Math.abs(x2) <= 1 + 1e-9 && isFinite(v)) { const e = Math.abs(v - Gstar(x1, x2)); s += e; cnt++; mx = Math.max(mx, e); }
      }
      this.stats[0].set(this.iter); this.stats[1].set(cnt ? (s / cnt).toFixed(3) : "–"); this.stats[2].set(cnt ? mx.toFixed(3) : "–"); this.stats[3].set(`${fin} / ${n * n}`);
      this.grid = { nx: n, ny: n, v: this.V, view: [-2, 2, -2, 2] };
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.showErr) {
        const n = this.n, hh = this.h, E = new Float64Array(n * n);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) E[j * n + i] = Math.abs(this.V[j * n + i] - Gstar(-2 + i * hh, -2 + j * hh));
        const lo = C.rgb(col.surface), hi = C.rgb(col.bad);
        C.drawHeat(st, { nx: n, ny: n, v: E, view: [-2, 2, -2, 2] }, (v) => (isFinite(v) ? [0, 1, 2].map((k) => Math.round(lo[k] + (hi[k] - lo[k]) * Math.min(1, v / 0.6) * 0.8)).concat([255]) : [...C.rgb(col.surface3), 255]));
      } else blueHeat(st, col, this.grid, 6);
      st.grid(col, 1);
      const levels = [0.5, 1, 1.5, 2, 2.5, 3, 3.5];
      const A = C.sampleGrid(Gstar, 101, 101, [-2, 2, -2, 2]);
      C.drawContours(st, this.grid, levels, col.accent, 2);
      st.ctx.setLineDash([4, 3]); C.drawContours(st, A, levels, col.text, 1.2); st.ctx.setLineDash([]);
      switchCurve(st, col, C.alpha(col.warn, 0.8));
      st.circle({ x: 0, y: 0 }, this.gr, col.goal, 1.5, C.alpha(col.goal, 0.25));
    }
  }

  // ===============================================================
  // 组件 3：线性二次问题 (15.20)–(15.24)
  // ===============================================================
  const LQ = {
    di: { name: "双积分器", A: [[0, 1], [0, 0]], B: [0, 1] },
    pend: { name: "倒立摆（线性化，不稳定）", A: [[0, 1], [1, 0]], B: [0, 1] },
    osc: { name: "弱阻尼振子", A: [[0, 1], [-1, -0.1]], B: [0, 1] },
  };
  function riccati(A, B, Q, R) {
    // 沿逆时间积分 Ṡ = SA + AᵀS − S B R⁻¹ Bᵀ S + Q 直到收敛（参考代码第 4 项用同样的方法）
    let S = [[0, 0], [0, 0]];
    const rhs = (S) => {
      const SB = [S[0][0] * B[0] + S[0][1] * B[1], S[1][0] * B[0] + S[1][1] * B[1]];
      const SA = C.matmul(S, A), AtS = C.matmul(C.transpose(A), S);
      return [0, 1].map((i) => [0, 1].map((j) => SA[i][j] + AtS[i][j] - SB[i] * SB[j] / R + Q[i][j]));
    };
    const dt = 0.004;
    for (let k = 0; k < 200000; k++) {
      const add = (X, Y, c) => X.map((r, i) => r.map((v, j) => v + c * Y[i][j]));
      const k1 = rhs(S), k2 = rhs(add(S, k1, dt / 2)), k3 = rhs(add(S, k2, dt / 2)), k4 = rhs(add(S, k3, dt));
      const d = k1.map((r, i) => r.map((v, j) => (v + 2 * k2[i][j] + 2 * k3[i][j] + k4[i][j]) / 6));
      S = add(S, d, dt);
      if (Math.max(...d.flat().map(Math.abs)) < 1e-11) break;
    }
    return S;
  }
  class LQR {
    constructor(root) {
      this.key = "di"; this.q1 = 1; this.q2 = 1; this.R = 1; this.x0 = { x: 1.6, y: 0.2 };
      const body = C.frame(root, "线性二次调节器：解代数 Riccati 方程 (15.21)", "拖动 x(0)；调 Q、R 看反馈增益怎么变");
      this.st = new C.Stage({ view: [-2.4, 2.4, -2, 2], aspect: 0.83, maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.x0) < 0.2 ? "x0" : null), onMove: (p) => { this.x0 = { x: C.clamp(p.x, -2.3, 2.3), y: C.clamp(p.y, -1.9, 1.9) }; this.simulate(); },
        cursor: (p) => (C.dist(p, this.x0) < 0.2 ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.55, maxW: 380, xlim: [0, 10], ylim: [-2, 2], xlab: "t" });
      this.sel = C.seg(Object.entries(LQ).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.solve(); });
      const lg = (v) => Math.pow(10, v).toFixed(v < 0 ? 2 : 1);
      this.sl = [C.slider("Q₁₁ =", -1, 1.5, 0.05, 0, (v) => { this.q1 = Math.pow(10, v); this.solve(); }, lg),
        C.slider("Q₂₂ =", -1, 1.5, 0.05, 0, (v) => { this.q2 = Math.pow(10, v); this.solve(); }, lg),
        C.slider("R =", -1.5, 1.5, 0.05, 0, (v) => { this.R = Math.pow(10, v); this.solve(); }, lg)];
      this.info = h("div", { class: "small mono" });
      this.stats = [C.stat("模拟的代价 L (15.20)"), C.stat("½ x₀ᵀ S x₀ (15.24)"), C.stat("闭环特征值 (15.22)")];
      body.append(h("div", { class: "controls" }, this.sel), h("div", { class: "controls" }, ...this.sl),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.info, h("div", { class: "stats" }, this.stats), this.plot.wrap)),
        C.legend([[C.cv("ok"), "闭环轨迹 ẋ = (A − BR⁻¹BᵀS)x"], [C.cv("muted"), "不加控制（u = 0）"], [C.cv("text2"), "G*(x) = ½xᵀSx 的等值线"]]));
      this.solve();
    }
    solve() {
      const { A, B } = LQ[this.key], Q = [[this.q1, 0], [0, this.q2]];
      this.S = riccati(A, B, Q, this.R);
      const S = this.S, K = [(B[0] * S[0][0] + B[1] * S[1][0]) / this.R, (B[0] * S[0][1] + B[1] * S[1][1]) / this.R];
      this.K = K;
      const Acl = [[A[0][0] - B[0] * K[0], A[0][1] - B[0] * K[1]], [A[1][0] - B[1] * K[0], A[1][1] - B[1] * K[1]]];
      this.Acl = Acl;
      const SB = [S[0][0] * B[0] + S[0][1] * B[1], S[1][0] * B[0] + S[1][1] * B[1]], SA = C.matmul(S, A), AtS = C.matmul(C.transpose(A), S);
      const res = Math.max(...[0, 1].flatMap((i) => [0, 1].map((j) => Math.abs(SA[i][j] + AtS[i][j] - SB[i] * SB[j] / this.R + Q[i][j]))));
      const e = C.eig2(Acl), f = (z) => `${z.re.toFixed(2)}${z.im ? (z.im > 0 ? "+" : "−") + Math.abs(z.im).toFixed(2) + "i" : ""}`;
      this.info.innerHTML = `S = [[${S[0][0].toFixed(3)}, ${S[0][1].toFixed(3)}], [${S[1][0].toFixed(3)}, ${S[1][1].toFixed(3)}]]　Riccati 残差 ${res.toExponential(1)}<br>π(x) = −R⁻¹BᵀSx = −[${K[0].toFixed(3)}, ${K[1].toFixed(3)}] x　(15.23)`;
      this.stats[2].set(`${f(e[0])}, ${f(e[1])}`);
      this.G = C.sampleGrid((x, y) => 0.5 * (S[0][0] * x * x + 2 * S[0][1] * x * y + S[1][1] * y * y), 97, 81, [-2.4, 2.4, -2, 2]);
      this.simulate();
    }
    simulate() {
      const { A, B } = LQ[this.key], K = this.K, R = this.R, q1 = this.q1, q2 = this.q2;
      const f = (t, s) => { const u = -(K[0] * s[0] + K[1] * s[1]); return [A[0][0] * s[0] + A[0][1] * s[1] + B[0] * u, A[1][0] * s[0] + A[1][1] * s[1] + B[1] * u, 0.5 * (q1 * s[0] * s[0] + q2 * s[1] * s[1] + R * u * u)]; };
      const tr = C.integrate(f, [this.x0.x, this.x0.y, 0], 40, 8000, 10);
      this.path = tr.filter((k) => k.t <= 10).map((k) => ({ x: k.x[0], y: k.x[1] }));
      const fo = (t, s) => [A[0][0] * s[0] + A[0][1] * s[1], A[1][0] * s[0] + A[1][1] * s[1]];
      this.open = C.integrate(fo, [this.x0.x, this.x0.y], 6, 1200, 4, (s) => Math.abs(s[0]) > 4 || Math.abs(s[1]) > 4).map((k) => ({ x: k.x[0], y: k.x[1] }));
      const S = this.S, x0 = [this.x0.x, this.x0.y];
      const G0 = 0.5 * (S[0][0] * x0[0] * x0[0] + 2 * S[0][1] * x0[0] * x0[1] + S[1][1] * x0[1] * x0[1]);
      this.stats[0].set(tr[tr.length - 1].x[2].toFixed(4)); this.stats[1].set(G0.toFixed(4));
      const part = tr.filter((k) => k.t <= 10);
      const xs = part.map((k) => [k.t, k.x[0]]), vs = part.map((k) => [k.t, k.x[1]]), us = part.map((k) => [k.t, -(K[0] * k.x[0] + K[1] * k.x[1])]);
      const ym = Math.max(1, ...part.map((k) => Math.max(Math.abs(k.x[0]), Math.abs(k.x[1]), Math.abs(K[0] * k.x[0] + K[1] * k.x[1])))) * 1.1;
      this.plot.set({ ylim: [-ym, ym], series: [{ pts: xs, ckey: "accent", label: "x₁" }, { pts: vs, ckey: "alive2", label: "x₂" }, { pts: us, ckey: "warn", label: "u" }] });
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const levels = []; for (let k = 1; k <= 12; k++) levels.push(0.15 * k * k);
      C.drawContours(st, this.G, levels, C.alpha(col.text2, 0.55), 1);
      st.polyline(this.open, col.muted, 1.6, [5, 4]);
      st.polyline(this.path, col.ok, 2.6);
      st.dot({ x: 0, y: 0 }, 5, col.goal, col.surface, 1.5);
      st.dot(this.x0, 7, col.start, col.surface, 2); st.text("x(0)", this.x0, col.start, { dy: -14, weight: 650 });
      st.text("x₁", { x: 2.4, y: 0 }, col.muted, { dx: -8, dy: -9, size: 11 }); st.text("x₂", { x: 0, y: 2 }, col.muted, { dx: 10, dy: 8, size: 11 });
    }
  }

  // ===============================================================
  // 组件 4：例 15.4 —— 双积分器的时间最优（Pontryagin）
  // ===============================================================
  // 与参考代码 di_bangbang 相同：返回 {T, segs:[[u, 时长],...], tsw}
  function bangbang(x, g) {
    let best = null;
    for (const a of [1, -1]) {
      const s2 = a * (g[0] - x[0]) + (g[1] * g[1] + x[1] * x[1]) / 2;
      if (s2 < -1e-12) continue;
      const r = Math.sqrt(Math.max(0, s2));
      for (const vs of [r, -r]) {
        const t1 = (vs - x[1]) / a, t2 = (vs - g[1]) / a;
        if (t1 < -1e-9 || t2 < -1e-9) continue;
        const T = Math.max(t1, 0) + Math.max(t2, 0);
        if (!best || T < best.T - 1e-12) best = { T, segs: [[a, Math.max(t1, 0)], [-a, Math.max(t2, 0)]] };
      }
    }
    best.segs = best.segs.filter((s) => s[1] > 1e-9);
    best.tsw = best.segs.length === 2 ? best.segs[0][1] : null;
    return best;
  }
  const CASES = { "1": "情形 1：一直全力加速（u* = 1）", "2": "情形 2：一直全力减速（u* = −1）", "3": "情形 3：先全力加速，在 t′ 切换为全力减速", "4": "情形 4：先全力减速，在 t′ 切换为全力加速" };
  class PMPDI {
    constructor(root) {
      this.xI = { x: -1.8, y: 0.8 }; this.xG = { x: 1.2, y: -0.4 }; this.tcur = null;
      const body = C.frame(root, "例 15.4：双积分器的时间最优轨迹", "拖动 x_I、x_G（相平面：横轴位置 x₁，纵轴速度 x₂）");
      this.st = new C.Stage({ view: [-3, 3, -2.4, 2.4], aspect: 0.8, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xI) < 0.18 ? "xI" : C.dist(p, this.xG) < 0.18 ? "xG" : null),
        onMove: (p, d) => { this[d] = { x: C.clamp(p.x, -2.9, 2.9), y: C.clamp(p.y, -2.3, 2.3) }; this.update(); },
        cursor: (p) => (C.dist(p, this.xI) < 0.18 || C.dist(p, this.xG) < 0.18 ? "grab" : null) });
      this.plot = new C.Plot({ aspect: 0.6, maxW: 380, xlim: [0, 3], ylim: [-1.5, 1.5], xlab: "t" });
      this.runner = new C.Runner(() => { this.tcur += 0.02; if (this.tcur > this.sol.T) { this.tcur = this.sol.T; this.st.draw(); return false; } this.st.draw(); return true; });
      this.stats = [C.stat("最短时间 T*"), C.stat("切换时间 t′"), C.stat("沿轨迹 max|H|")];
      this.caseEl = h("div", { class: "msg info" }); this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, C.button("▶ 播放", () => { this.tcur = 0; this.runner.start(); }, "primary")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.caseEl, this.plot.wrap, this.note)),
        C.legend([[C.cv("accent"), "u = +1 的弧（抛物线 x₁ − x₂²/2 = 常数）"], [C.cv("warn"), "u = −1 的弧"], [C.cv("muted"), "过 x_G 的两条末段抛物线（切换曲线）"]]));
      this.update();
    }
    update() {
      const x = [this.xI.x, this.xI.y], g = [this.xG.x, this.xG.y], sol = bangbang(x, g); this.sol = sol;
      // 轨迹采样
      const pts = []; let s = x.slice(), t = 0;
      for (const [u, d] of sol.segs) { const n = Math.max(2, Math.ceil(d / 0.01)); for (let k = 0; k <= n; k++) { const tt = d * k / n; pts.push({ x: s[0] + s[1] * tt + 0.5 * u * tt * tt, y: s[1] + u * tt, t: t + tt, u }); } s = [s[0] + s[1] * d + 0.5 * u * d * d, s[1] + u * d]; t += d; }
      this.pts = pts;
      // 伴随变量：有切换时 λ₁ = c₁ = −1/x₂(t′)，λ₂(t) = c₁ (t′ − t)；没有切换时取 λ₁ = 0、λ₂ = −u（不唯一）
      let lam;
      if (sol.tsw !== null) { const x2s = x[1] + sol.segs[0][0] * sol.tsw, c1 = -1 / x2s; lam = (tt) => [c1, c1 * (sol.tsw - tt)]; }
      else { const u = sol.segs[0][0]; lam = () => [0, -u]; }
      let mh = 0; for (const p of pts) { const l = lam(p.t); mh = Math.max(mh, Math.abs(1 + l[0] * p.y + l[1] * p.u)); }
      this.stats[0].set(sol.T.toFixed(3)); this.stats[1].set(sol.tsw === null ? "无" : sol.tsw.toFixed(3)); this.stats[2].set(mh.toExponential(1));
      const u0 = sol.segs[0][0], cs = sol.segs.length === 1 ? (u0 > 0 ? "1" : "2") : (u0 > 0 ? "3" : "4");
      this.caseEl.textContent = CASES[cs];
      const us = [], l2 = []; for (let k = 0; k <= 200; k++) { const tt = sol.T * k / 200; const seg = sol.tsw !== null && tt > sol.tsw ? 1 : 0; us.push([tt, sol.segs[seg][0]]); l2.push([tt, lam(tt)[1]]); }
      const lm = Math.max(1.2, ...l2.map((p) => Math.abs(p[1]))) * 1.1;
      this.plot.set({ xlim: [0, Math.max(0.5, sol.T)], ylim: [-lm, lm], series: [{ pts: us, ckey: "ok", label: "u*(t)" }, { pts: l2, ckey: "alive2", label: "λ₂(t)" }],
        marks: sol.tsw !== null ? [{ x: sol.tsw, label: "t′" }] : [] });
      this.note.innerHTML = sol.tsw !== null
        ? `λ₁ = c₁ = ${lam(0)[0].toFixed(3)} 不变，λ₂(t) = c₂ − c₁t 是一条直线，在 t′ 处穿过 0：之前 λ₂ ${lam(0)[1] > 0 ? "> 0 ⇒ u* = −1" : "< 0 ⇒ u* = +1"}，之后反号。常数由 H ≡ 0 定出：在 t′ 处 λ₂ = 0，所以 1 + c₁x₂(t′) = 0。`
        : "x_I 恰好在过 x_G 的末段抛物线上，一段 bang 就到。此时伴随变量不唯一（例如 λ₁ = 0、λ₂ = −u*），λ₂ 不变号。";
      this.tcur = null; this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const g = [this.xG.x, this.xG.y];
      // 过 x_G 的末段：u = +1 到达（速度从下方增加到 g2）：x1 = g1 + (x2² − g2²)/2，x2 ≤ g2；u = −1：x1 = g1 − (x2² − g2²)/2，x2 ≥ g2
      const A = [], B = []; for (let k = 0; k <= 80; k++) { const v1 = g[1] - 4 * k / 80, v2 = g[1] + 4 * k / 80; A.push({ x: g[0] + (v1 * v1 - g[1] * g[1]) / 2, y: v1 }); B.push({ x: g[0] - (v2 * v2 - g[1] * g[1]) / 2, y: v2 }); }
      st.polyline(A, C.alpha(col.muted, 0.9), 1.6, [6, 4]); st.polyline(B, C.alpha(col.muted, 0.9), 1.6, [6, 4]);
      for (let k = 1; k < this.pts.length; k++) { const a = this.pts[k - 1], b = this.pts[k]; st.line(a, b, b.u > 0 ? col.accent : col.warn, 3); }
      if (this.sol.tsw !== null) { const p = this.pts.find((q) => q.t >= this.sol.tsw - 1e-9); st.dot(p, 5, col.alive2, col.surface, 1.5); st.text("切换", p, col.alive2, { dx: 18, dy: -8, size: 11, weight: 650 }); }
      if (this.tcur !== null) { const p = this.pts.reduce((a, q) => (Math.abs(q.t - this.tcur) < Math.abs(a.t - this.tcur) ? q : a)); st.dot(p, 7, col.ok, col.surface, 2); }
      st.qmark(this.xI, "I", col); st.qmark(this.xG, "G", col);
      st.text("x₁", { x: 3, y: 0 }, col.muted, { dx: -8, dy: -9, size: 11 }); st.text("x₂", { x: 0, y: 2.4 }, col.muted, { dx: 10, dy: 8, size: 11 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='hjb-point']").forEach((el) => (el._w = new HJBPoint(el)));
    document.querySelectorAll("[data-widget='vi-hjb']").forEach((el) => (el._w = new VIHJB(el)));
    document.querySelectorAll("[data-widget='lqr']").forEach((el) => (el._w = new LQR(el)));
    document.querySelectorAll("[data-widget='pmp-di']").forEach((el) => (el._w = new PMPDI(el)));
  });
})();
