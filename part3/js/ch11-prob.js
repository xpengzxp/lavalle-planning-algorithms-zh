/* 11.6 节：计算概率 I-state——卡尔曼滤波（11.6.1）、网格法 / 粒子滤波 / 矩近似（11.6.2、11.4.3） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH11;

  // 小矩阵（数组的数组）
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((a, v, k) => a + v * B[k][j], 0)));
  const mt = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const madd = (A, B, s = 1) => A.map((r, i) => r.map((v, j) => v + s * B[i][j]));
  const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  function minv(A) {
    const n = A.length, M = A.map((r, i) => r.concat(eye(n)[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const pv = M[c][c]; M[c] = M[c].map((v) => v / pv);
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; M[r] = M[r].map((v, j) => v - f * M[c][j]); }
    }
    return M.map((r) => r.slice(n));
  }

  // ---------------------------------------------------------------
  // 组件 14：卡尔曼滤波——平面上的机器人（11.6.1 节，习题 19）
  // ---------------------------------------------------------------
  const CHI95 = Math.sqrt(5.991);           // 二维高斯 95% 置信椭圆
  class Kalman {
    constructor(root) {
      this.q = 0.04; this.r = 0.25; this.cMode = "full"; this.cmd = "circle"; this.showTruth = true; this.rnd = C.rng(C.newSeed());
      const body = C.frame(root, "卡尔曼滤波：平面上的机器人", "x_{k+1} = x_k + u_k + θ_k，y_k = C x_k + ψ_k；θ、ψ 是零均值高斯");
      this.st = new C.Stage({ view: [-6, 6, -4.2, 4.2], aspect: 0.66, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.sQ = C.slider("Σ_θ = q I，q", 0.005, 0.3, 0.005, this.q, (v) => (this.q = v), (v) => v.toFixed(3));
      this.sR = C.slider("Σ_ψ = r I，r", 0.01, 2, 0.01, this.r, (v) => (this.r = v), (v) => v.toFixed(2));
      this.segC = C.seg([["full", "C = I（测 x、y）"], ["x", "C = [1 0]（只测 x，秩 1）"], ["none", "不测量（只预测）"]], this.cMode, (k) => { this.cMode = k; });
      this.segU = C.seg([["circle", "u_k：绕圈"], ["line", "u_k：来回直走"]], this.cmd, (k) => { this.cmd = k; });
      this.btnRun = C.button("自动", () => this.run.toggle(), "small primary");
      this.run = new C.Runner((dt) => { this.acc = (this.acc || 0) + dt; if (this.acc < 0.28) return true; this.acc = 0; this.step(); return true; }, () => (this.btnRun.textContent = "自动"));
      C.pauseWhenHidden(root, this.run);
      this.btnPred = C.button("预测 (11.81)", () => this.predict(), "small");
      this.btnUpd = C.button("修正 (11.80)(11.82)(11.83)", () => this.correct(), "small");
      this.stats = { k: C.stat("阶段 k"), tr: C.stat("tr Σ_k"), sd: C.stat("σ_x / σ_y"), err: C.stat("‖μ_k − x_k‖") };
      this.Lbox = h("div", { class: "small mono" });
      body.append(h("div", { class: "controls" }, this.segC, this.segU), h("div", { class: "controls" }, this.sQ, this.sR),
        h("div", { class: "controls" }, this.btnRun, C.button("一步", () => this.step(), "small"), this.btnPred, this.btnUpd, C.button("重置", () => this.reset(), "small"),
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.Lbox,
        C.legend([[C.cv("prob"), "μ_k 与 95% 置信椭圆（Σ_k）"], [C.cva("prob", 0.5), "预测 Σ′_{k+1}（虚线）"], [C.cv("obs"), "观测 y_k"], [C.cv("truth"), "真实轨迹", true]]));
      this.reset();
    }
    C() { return this.cMode === "full" ? [[1, 0], [0, 1]] : this.cMode === "x" ? [[1, 0]] : null; }
    reset() {
      this.run && this.run.stop();
      this.x = [[3], [0]]; this.mu = [[3], [0]]; this.S = [[0.3, 0], [0, 0.3]];       // μ₀、Σ₀（先给一个初始高斯）
      this.k = 1; this.phase = "pred"; this.Sp = null; this.y = null; this.trail = [{ x: 3, y: 0 }]; this.mtrail = [{ x: 3, y: 0 }]; this.L = null; this.ang = 0;
      this.upd();
    }
    u() {
      if (this.cmd === "circle") { this.ang += 0.25; return [[-0.75 * Math.sin(this.ang)], [0.75 * Math.cos(this.ang)]]; }
      this.ang += 1; const dir = Math.floor(this.ang / 12) % 2 === 0 ? 1 : -1; return [[-0.5 * dir], [0]];
    }
    predict() {
      if (this.phase !== "pred") return;
      const u = this.u(), Q = [[this.q, 0], [0, this.q]];
      this.uk = u;
      this.mu = madd(this.mu, u);                                   // A μ + B u（A = B = I）
      this.Sprev = this.S;
      this.Sp = madd(this.S, Q);                                    // (11.81) Σ′ = AΣAᵀ + GΣ_θGᵀ
      const th = [[C.gauss(this.rnd) * Math.sqrt(this.q)], [C.gauss(this.rnd) * Math.sqrt(this.q)]];
      this.x = madd(madd(this.x, u), th);
      this.k++; this.trail.push({ x: this.x[0][0], y: this.x[1][0] });
      this.S = this.Sp; this.phase = "upd"; this.y = null; this.upd();
    }
    correct() {
      if (this.phase !== "upd") return;
      const Cm = this.C();
      if (Cm) {
        const m = Cm.length, Rm = eye(m).map((r) => r.map((v) => v * this.r));      // H Σ_ψ Hᵀ（H = I）
        const ps = Array.from({ length: m }, () => [C.gauss(this.rnd) * Math.sqrt(this.r)]);
        const y = madd(mm(Cm, this.x), ps);
        const L = mm(mm(this.Sp, mt(Cm)), minv(madd(mm(mm(Cm, this.Sp), mt(Cm)), Rm)));   // (11.83)，H Σ_ψ Hᵀ
        this.mu = madd(this.mu, mm(L, madd(y, mm(Cm, this.mu), -1)));                     // (11.80)
        this.S = mm(madd(eye(2), mm(L, Cm), -1), this.Sp);                                // (11.82)
        this.L = L; this.y = y;
      } else { this.L = null; this.y = null; }
      this.mtrail.push({ x: this.mu[0][0], y: this.mu[1][0] });
      this.phase = "pred"; this.upd();
    }
    step() { if (this.phase === "pred") this.predict(); this.correct(); }
    upd() {
      const S = this.S, e = Math.hypot(this.mu[0][0] - this.x[0][0], this.mu[1][0] - this.x[1][0]);
      this.stats.k.set(this.k + (this.phase === "upd" ? "（已预测）" : ""));
      this.stats.tr.set((S[0][0] + S[1][1]).toFixed(3));
      this.stats.sd.set(`${Math.sqrt(S[0][0]).toFixed(2)} / ${Math.sqrt(S[1][1]).toFixed(2)}`);
      this.stats.err.set(e.toFixed(2));
      this.btnPred.disabled = this.phase !== "pred"; this.btnUpd.disabled = this.phase !== "upd";
      const f = (v) => (v >= 0 ? " " : "") + v.toFixed(3);
      this.Lbox.innerHTML = this.L ? `L_k = [${this.L.map((r) => r.map(f).join(" ")).join(" ; ")}]` + (this.cMode === "x" ? "　<span class='muted'>只有 x 方向被修正；y 方向的方差每步加 q，一直长下去。</span>" : "　<span class='muted'>r 大 → L 小（更相信预测）；q 大 → L 大（更相信观测）。</span>")
        : this.cMode === "none" ? "<span class='muted'>没有观测：每一步 Σ 都加上 q I，椭圆不停变大——这就是只做预测的 I-state。</span>" : "";
      this.st.draw();
    }
    draw(st, col) {
      for (let x = -6; x <= 6; x++) st.line({ x, y: -4.2 }, { x, y: 4.2 }, C.alpha(col.border, 0.6), 1);
      for (let y = -4; y <= 4; y++) st.line({ x: -6, y }, { x: 6, y }, C.alpha(col.border, 0.6), 1);
      const mu = { x: this.mu[0][0], y: this.mu[1][0] };
      if (this.phase === "upd" && this.Sprev) st.ellipse({ x: mu.x - this.uk[0][0], y: mu.y - this.uk[1][0] }, this.Sprev, CHI95, null, C.alpha(col.prob, 0.35), 1);
      if (this.phase === "upd") st.ellipse(mu, this.S, CHI95, C.alpha(col.prob, 0.08), col.prob, 1.6, [6, 4]);
      else st.ellipse(mu, this.S, CHI95, C.alpha(col.prob, 0.22), col.prob, 2);
      st.path(this.mtrail, C.alpha(col.prob, 0.7), 1.4);
      st.dot(mu, 4.5, col.prob, col.surface, 1.5);
      if (this.y && this.phase === "pred") {
        if (this.y.length === 2) { const p = { x: this.y[0][0], y: this.y[1][0] }; st.line({ x: p.x - 0.15, y: p.y - 0.15 }, { x: p.x + 0.15, y: p.y + 0.15 }, col.obs, 2.2); st.line({ x: p.x - 0.15, y: p.y + 0.15 }, { x: p.x + 0.15, y: p.y - 0.15 }, col.obs, 2.2); }
        else st.line({ x: this.y[0][0], y: -4.2 }, { x: this.y[0][0], y: 4.2 }, C.alpha(col.obs, 0.7), 1.6, [6, 4]);
      }
      if (this.showTruth) { st.path(this.trail, C.alpha(col.truth, 0.55), 1.2, [3, 3]); st.truth(this.trail[this.trail.length - 1], col); }
    }
  }

  // ---------------------------------------------------------------
  // 组件 15：网格法、粒子滤波与矩近似（11.6.2、11.4.3 节；补充：一维走廊里的门）
  // ---------------------------------------------------------------
  const LEN = 100, DOORS = [12, 31, 70], DW = 2.5, SIGM = 1.0, STEP = 2.5, NF = 1000;
  const nearDoor = (x) => DOORS.some((d) => Math.abs(x - d) <= DW);
  const lik = (x, y) => { const p = nearDoor(x) ? 0.8 : 0.1; return y ? p : 1 - p; };
  const reflect = (x) => (x < 0 ? -x : x > LEN ? 2 * LEN - x : x);
  // 标准正态分布函数（Abramowitz–Stegun 7.1.26，误差 < 1.5e-7）
  function Phi(z) {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const e = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + e) : 0.5 * (1 - e);
  }
  // 把 n 个等宽格子上的分布 P 推进一步：x' = x + u + N(0, σ²)，边界反射。
  // P(s_{k+1} | s_k, u_k) 按书中的「桶」来算：格子内取 sub 个点，求落进每个目标格子的概率再平均
  function propagate(P, u, sub) {
    const n = P.length, w = LEN / n, out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (P[i] < 1e-15) continue;
      for (let t = 0; t < sub; t++) {
        const c = (i + (t + 0.5) / sub) * w + u, j0 = Math.floor((c - 4 * SIGM) / w), j1 = Math.floor((c + 4 * SIGM) / w);
        for (let j = j0; j <= j1; j++) {
          const mass = Phi(((j + 1) * w - c) / SIGM) - Phi((j * w - c) / SIGM);
          let jj = j < 0 ? -1 - j : j >= n ? 2 * n - 1 - j : j; jj = Math.max(0, Math.min(n - 1, jj));
          out[jj] += (P[i] * mass) / sub;
        }
      }
    }
    return out;
  }
  function bayesGrid(P, y) { const n = P.length, w = LEN / n; let s = 0; const o = new Float64Array(n); for (let i = 0; i < n; i++) { o[i] = P[i] * lik((i + 0.5) * w, y); s += o[i]; } for (let i = 0; i < n; i++) o[i] /= s; return o; }
  const unif = (n) => new Float64Array(n).fill(1 / n);
  class Particles {
    constructor(root) {
      this.nb = 25; this.m = 300; this.rnd = C.rng(C.newSeed()); this.show = { exact: true, grid: true, part: true, gauss: true };
      const body = C.frame(root, "网格法、粒子滤波与矩近似", "补充例子：机器人在一维走廊里来回走，传感器只报告「旁边有没有门」");
      this.st = new C.Stage({ view: [-2, 102, -0.08, 1.32], aspect: 0.5, maxW: 760, equal: false, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.sB = C.slider("网格格数", 5, 100, 1, this.nb, (v) => { this.nb = v; this.reset(); });
      this.sM = C.slider("粒子数 m", 10, 3000, 10, this.m, (v) => { this.m = v; this.reset(); });
      this.btnRun = C.button("自动", () => this.run.toggle(), "small primary");
      this.run = new C.Runner((dt) => { this.acc = (this.acc || 0) + dt; if (this.acc < 0.25) return true; this.acc = 0; this.step(); return true; }, () => (this.btnRun.textContent = "自动"));
      C.pauseWhenHidden(root, this.run);
      const chk = (k, t) => C.checkbox(t, true, (v) => { this.show[k] = v; this.st.draw(); });
      this.stats = { k: C.stat("阶段"), g: C.stat("网格 vs 精确（总变差）"), p: C.stat("粒子 vs 精确"), m: C.stat("高斯 vs 精确") };
      body.append(h("div", { class: "controls" }, this.sB, this.sM),
        h("div", { class: "controls" }, this.btnRun, C.button("→ 前进", () => this.step(1), "small"), C.button("← 后退", () => this.step(-1), "small"), C.button("重置（均匀先验）", () => this.reset(), "small")),
        h("div", { class: "controls" }, chk("exact", "精确（1000 格）"), chk("grid", "网格法"), chk("part", "粒子"), chk("gauss", "高斯（只留均值、方差）")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
        C.legend([[C.cv("text2"), "精确后验 p(x_k | η_k)"], [C.cva("prob", 0.45), "网格法（每格一个「桶」）"], [C.cv("prob"), "粒子（竖线高 ∝ 权重）"], [C.cv("bad"), "矩近似：同均值同方差的高斯（虚线）"], [C.cva("goal", 0.6), "门"], [C.cv("truth"), "真实位置", true]]));
      this.reset();
    }
    reset() {
      this.run && this.run.stop();
      this.x = 5 + 90 * this.rnd(); this.dir = 1; this.k = 0; this.y = null;
      this.Pex = unif(NF); this.Pg = unif(this.nb);
      this.parts = Array.from({ length: this.m }, () => LEN * this.rnd()); this.w = new Float64Array(this.m).fill(1 / this.m);
      this.mu = LEN / 2; this.var = LEN * LEN / 12;
      this.upd();
    }
    step(cmd) {
      if (cmd === undefined) { if (this.x > 92) this.dir = -1; if (this.x < 8) this.dir = 1; cmd = this.dir; }
      const u = cmd * STEP;
      this.x = reflect(this.x + u + C.gauss(this.rnd) * SIGM);
      const y = this.rnd() < lik(this.x, 1) ? 1 : 0; this.y = y; this.k++;
      // 精确与网格法：(11.38) 再 (11.39)
      this.Pex = bayesGrid(propagate(this.Pex, u, 2), y);
      this.Pg = bayesGrid(propagate(this.Pg, u, 8), y);
      // 粒子滤波：1 按 P_k 选，2 按 p(x_{k+1}|x_k,u_k) 采样，3 权重 w = p(y_{k+1}|x_{k+1})
      const cum = []; let s = 0; for (let i = 0; i < this.m; i++) { s += this.w[i]; cum.push(s); }
      const np = new Array(this.m), nw = new Float64Array(this.m); let ws = 0;
      for (let i = 0; i < this.m; i++) {
        const r = this.rnd() * s; let lo = 0, hi = this.m - 1; while (lo < hi) { const md = (lo + hi) >> 1; if (cum[md] < r) lo = md + 1; else hi = md; }
        np[i] = reflect(this.parts[lo] + u + C.gauss(this.rnd) * SIGM); nw[i] = lik(np[i], y); ws += nw[i];
      }
      for (let i = 0; i < this.m; i++) nw[i] /= ws;
      this.parts = np; this.w = nw;
      // 矩近似（假设密度滤波）：预测后、修正后都只保留均值与方差（κ_mom）
      this.mu += u; this.var += SIGM * SIGM;
      let z = 0, m1 = 0, m2 = 0;
      for (let i = 0; i < NF; i++) { const xc = (i + 0.5) * (LEN / NF), g = Math.exp(-0.5 * (xc - this.mu) ** 2 / this.var) * lik(xc, y); z += g; m1 += g * xc; m2 += g * xc * xc; }
      if (z > 0) { this.mu = m1 / z; this.var = Math.max(0.05, m2 / z - this.mu * this.mu); }
      this.upd();
    }
    hist(n) { const H = new Float64Array(n), w = LEN / n; for (let i = 0; i < this.m; i++) H[Math.min(n - 1, Math.floor(this.parts[i] / w))] += this.w[i]; return H; }
    tv(P) {          // 与精确后验（NF 格）的总变差距离，把 P 展开到同样的格子上
      const n = P.length; let d = 0;
      for (let i = 0; i < NF; i++) { const j = Math.min(n - 1, Math.floor(((i + 0.5) * n) / NF)); d += Math.abs(this.Pex[i] - P[j] * (n / NF) * 1); }
      return d / 2;
    }
    upd() {
      this.stats.k.set(this.k + (this.y === null ? "" : `（y = ${this.y ? "门" : "无门"}）`));
      this.stats.g.set(this.tv(this.Pg).toFixed(3));
      this.stats.p.set(this.tv(this.hist(50)).toFixed(3));
      const G = new Float64Array(NF); let s = 0; for (let i = 0; i < NF; i++) { const xc = (i + 0.5) * (LEN / NF); G[i] = Math.exp(-0.5 * (xc - this.mu) ** 2 / this.var); s += G[i]; }
      for (let i = 0; i < NF; i++) G[i] /= s;
      this.G = G; this.stats.m.set(this.tv(G).toFixed(3));
      this.st.draw();
    }
    draw(st, col) {
      // 走廊与门
      st.rect(0, 1.12, LEN, 1.3, col.surface2, col.strong, 1);
      DOORS.forEach((d) => st.rect(d - DW, 1.12, d + DW, 1.3, C.alpha(col.goal, 0.55), col.goal, 1));
      st.truth({ x: this.x, y: 1.21 }, col);
      st.line({ x: 0, y: 0 }, { x: LEN, y: 0 }, col.strong, 1);
      for (let x = 0; x <= LEN; x += 10) st.text(String(x), { x, y: 0 }, col.muted, { size: 10, dy: 9 });
      // 用同一个纵轴：概率密度（每单位长度）
      const dens = (P) => { const n = P.length; return Array.from(P, (p) => p * (n / LEN)); };
      const ex = dens(this.Pex); const top = Math.max(0.05, ...ex, ...dens(this.Pg)) * 1.08, Y = (v) => (v / top) * 1.0;
      if (this.show.grid) { const g = dens(this.Pg), w = LEN / g.length; g.forEach((v, i) => st.rect(i * w, 0, (i + 1) * w, Y(v), C.alpha(col.prob, 0.32), C.alpha(col.prob, 0.6), 0.8)); }
      if (this.show.exact) st.path(ex.map((v, i) => ({ x: (i + 0.5) * (LEN / NF), y: Y(v) })), col.text2, 1.6);
      if (this.show.gauss) st.path(Array.from(this.G, (p, i) => ({ x: (i + 0.5) * (LEN / NF), y: Y(p * (NF / LEN)) })), col.bad, 1.6, [6, 4]);
      if (this.show.part) { const wmax = Math.max(...this.w); for (let i = 0; i < this.m; i++) st.line({ x: this.parts[i], y: 1.02 }, { x: this.parts[i], y: 1.02 - 0.09 * (this.w[i] / wmax) }, C.alpha(col.prob, 0.55), 1); st.text("粒子（竖线高 ∝ 权重）", { x: 0, y: 1.065 }, col.prob, { size: 10.5, align: "left" }); }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='kalman']").forEach((el) => (el._w = new Kalman(el)));
    document.querySelectorAll("[data-widget='particles']").forEach((el) => (el._w = new Particles(el)));
  });
})();
