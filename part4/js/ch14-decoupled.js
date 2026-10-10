/* 14.6 节：先规划再变换（图 14.21–14.24，Dubins 车）；路径约束下的允许加速度（例 14.6、式 14.32–14.43）；
   路径约束相平面 S、极限曲线、动态规划 (14.46) 与 bang-bang 算法（图 14.27–14.29） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // ---------------------------------------------------------------
  // 组件：PLAN-AND-TRANSFORM（图 14.21），LPM = 两个最小转弯圆的公切线（图 14.23）
  // ---------------------------------------------------------------
  const DS = 0.04;
  function resample(poly) {
    const out = [];
    for (let k = 0; k + 1 < poly.length; k++) {
      const a = poly[k], b = poly[k + 1], L = C.dist(a, b), th = Math.atan2(b.y - a.y, b.x - a.x), n = Math.max(1, Math.round(L / DS));
      for (let i = 0; i < n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n, th });
    }
    const a = poly[poly.length - 2], b = poly[poly.length - 1];
    out.push({ x: b.x, y: b.y, th: Math.atan2(b.y - a.y, b.x - a.x) });
    return out;
  }
  class PlanTransform {
    constructor(root) {
      this.rho = 0.7; this.mode = "random"; this.seed = 5;
      this.W = new C.World([C.rect(2.6, 3.6, 3.6, 6), C.rect(5.0, 0, 6.2, 1.1), [{ x: 6.8, y: 3.4 }, { x: 8.6, y: 3.0 }, { x: 8.2, y: 3.9 }]], { x0: 0, y0: 0, x1: 10, y1: 6 });
      this.way = [{ x: 1.0, y: 0.8 }, { x: 1.0, y: 4.6 }, { x: 8.4, y: 1.4 }, { x: 7.4, y: 5.2 }];
      const body = C.frame(root, "先规划、再变换", "图 14.21–14.24：先找一条忽略微分约束的路径 τ，再反复把其中一段换成 Dubins 车能走的 γ；拖动折点");
      this.st = new C.Stage({
        view: [0, 10, 0, 6], aspect: 0.6, maxW: 720, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const k = this.way.findIndex((w) => C.dist(w, p) < 0.3); return k >= 0 ? { k } : null; },
        onMove: (p, d) => { this.way[d.k] = { x: C.clamp(p.x, 0.2, 9.8), y: C.clamp(p.y, 0.2, 5.8) }; this.reset(); },
        cursor: (p) => (this.way.some((w) => C.dist(w, p) < 0.3) ? "grab" : "default"),
      });
      this.sRho = C.slider("最小转弯半径 ρ_min", 0.3, 1.4, 0.05, this.rho, (v) => { this.rho = v; this.reset(); }, (v) => v.toFixed(2));
      this.segMode = C.seg([["random", "随机选 s₁ < s₂"], ["bisect", "二分：从整段开始逐层细分"]], this.mode, (k) => { this.mode = k; this.reset(); });
      this.runner = new C.Runner(() => { const more = this.step(); this.render(); return more; });
      this.stats = { it: C.stat("迭代"), ok: C.stat("成功替换"), kinks: C.stat("剩下的「折角」"), len: C.stat("路径长度") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sRho, this.segMode),
        h("div", { class: "controls" }, C.button("一步", () => { this.step(); this.render(); }, "small"), C.button("跑到满足约束", () => this.runner.start(), "small primary"), C.button("重置", () => { this.seed = C.newSeed(); this.reset(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("muted"), "初始路径 τ（忽略微分约束）"], [C.cv("accent"), "当前路径"], [C.cv("bad"), "车走不了的折角", true], [C.cv("ok"), "这一步成功的 γ"], [C.cv("current"), "这一步失败的 γ（碰撞）"]]));
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.P = resample(this.way); this.P0 = this.P.slice(); this.r = C.rng(this.seed);
      this.it = 0; this.ok = 0; this.last = null; this.queue = [[0, 1]];
      this.render();
    }
    kinks() {
      const out = [], lim = (DS * 1.08) / this.rho + 1e-6;
      for (let i = 1; i < this.P.length; i++) { const dth = Math.abs(C.angDiff(this.P[i].th, this.P[i - 1].th)), ds = C.dist(this.P[i], this.P[i - 1]); if (dth > Math.max(lim, (ds * 1.08) / this.rho + 1e-6)) out.push(i); }
      return out;
    }
    pick() {
      const N = this.P.length - 1;
      if (this.mode === "bisect") {
        // 按层次细分 [0,1]：先整段，再两半，再四份……（只挑含折角的区间）
        const K = new Set(this.kinks());
        while (this.queue.length) {
          const [a, b] = this.queue.shift(), i1 = Math.round(a * N), i2 = Math.round(b * N);
          let has = false; for (let i = i1 + 1; i <= i2; i++) if (K.has(i)) { has = true; break; }
          if (!has || i2 - i1 < 3) continue;
          const m = (a + b) / 2; this.queue.push([a, m], [m, b], [(a + m) / 2, (m + b) / 2]);
          return [i1, i2];
        }
        this.queue = [[0, 1]]; return null;
      }
      const r = this.r; let s1 = r(), s2 = r(); if (s1 > s2) [s1, s2] = [s2, s1];
      if (r() < 0.15) s1 = 0; else if (r() < 0.15) s2 = 1;   // 区间 [0, s] 与 [s, 1] 不能漏掉
      return [Math.round(s1 * N), Math.round(s2 * N)];
    }
    step() {
      if (!this.kinks().length) return false;
      if (this.it > 400) return false;
      const pr = this.pick(); this.it++;
      if (!pr) { this.last = null; return true; }
      const [i1, i2] = pr; if (i2 - i1 < 2) { this.last = null; return true; }
      const a = this.P[i1], b = this.P[i2];
      // LPM：起止位形各画两个最小转弯圆，取与「行驶方向」一致的公切线（CSC 四种字中最短的无碰者）
      const res = C.dubins(a, b, this.rho, ["LSL", "LSR", "RSL", "RSR"]);
      let gamma = null;
      if (res) for (const c of res.all) { const pts = C.dubinsSample(a, c.word, c.seg, this.rho, DS); if (this.W.pathFree(pts, 0.08)) { gamma = pts; break; } else if (!gamma) this.lastBad = pts; }
      if (gamma) {
        // (14.30)：τ′(s) = τ(s)（s < s₁）、γ((s − s₁)/(s₂ − s₁))（s ∈ [s₁, s₂]）、τ(s)（s > s₂）
        this.P = this.P.slice(0, i1).concat(gamma.slice(0, -1), this.P.slice(i2));
        this.ok++; this.last = { ok: true, pts: gamma, a, b };
      } else this.last = { ok: false, pts: this.lastBad, a, b };
      return true;
    }
    render() {
      const K = this.kinks(); let L = 0; for (let i = 1; i < this.P.length; i++) L += C.dist(this.P[i], this.P[i - 1]);
      this.stats.it.set(this.it); this.stats.ok.set(this.ok); this.stats.kinks.set(K.length ? `<span class="no">${K.length}</span>` : '<span class="yes">0：满足约束</span>'); this.stats.len.set(L.toFixed(2));
      this.msg.innerHTML = "每次迭代选 s₁ < s₂，用 LPM 试着把 τ(s₁) 到 τ(s₂) 这一段换成满足约束的 γ；朝向也是位形的一部分，所以 γ 必须在两端对上朝向。Dubins 车的 LPM 很简单：在起止位形各画最左转、最右转两个圆，圆就像<b>单行道</b>，找一条顺着行驶方向的公切线（图 14.23；它不一定最短，最优路径见 15.3.1 节）。" +
        " 注意 Dubins 车的 LPM <b>不满足拓扑性质</b>：两个位形再近，往后挪一点也得绕圈，γ 不会贴近原路径——所以在窄走廊里可能根本变换不出来，而有倒挡的 Reeds–Shepp 车（小时间局部可控）就没有这个问题。把 ρ_min 调大、或把折点拖到障碍旁边试试。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.world(this.W, col);
      st.polyline(this.P0, C.alpha(col.muted, 0.8), 1.5, [5, 4]);
      if (this.last && this.last.pts) {
        st.polyline(this.last.pts, this.last.ok ? col.ok : col.current, 4);
        for (const q of [this.last.a, this.last.b]) for (const s of [1, -1]) st.circle({ x: q.x - s * this.rho * Math.sin(q.th), y: q.y + s * this.rho * Math.cos(q.th) }, this.rho, null, C.alpha(col.text2, 0.5), 1, [3, 3]);
      }
      st.polyline(this.P, col.accent, 2.4);
      for (const w of this.way) st.dot(w, 4.5, col.surface, col.text2, 1.5);
      for (const i of this.kinks()) st.dot(this.P[i], 5.5, col.bad, col.surface, 1.2);
      st.car(this.P[0], 0.45, col.start, col.text); st.car(this.P[this.P.length - 1], 0.45, C.alpha(col.goal, 0.85), col.text);
    }
  }

  // ---------------------------------------------------------------
  // 路径族：τ(s)，s ∈ [0,1]；导数用中心差分
  // ---------------------------------------------------------------
  const PATHS = {
    line: { name: "直线（例 14.6）", f: (s) => [4 * s - 2, 2 * s - 1] },
    arc: { name: "四分之一圆 R = 2", f: (s) => [2 * Math.sin((Math.PI / 2) * s) - 1, 2 * (1 - Math.cos((Math.PI / 2) * s)) - 1] },
    wavy: { name: "斜向波浪线", f: (s) => [4 * s - 2, 0.3 * Math.sin(2 * Math.PI * s) + 2 * s - 1] },
    hairpin: { name: "发夹弯（图 14.26 那种急转弯，已圆角）", f: (s) => { const t = Math.PI * (s - 0.5); return [2.2 * Math.cos(t) - 1.1, 0.6 * Math.sin(t)]; } },
  };
  function deriv(f, s) {
    // 这些路径在 [0,1] 外也有定义，直接用中心差分
    const e1 = 1e-5, e2 = 1e-3, p = f(s - e1), q = f(s + e1), a = f(s - e2), b = f(s + e2), m = f(s);
    return { d1: [(q[0] - p[0]) / (2 * e1), (q[1] - p[1]) / (2 * e1)], d2: [(b[0] - 2 * m[0] + a[0]) / (e2 * e2), (b[1] - 2 * m[1] + a[1]) / (e2 * e2)] };
  }
  // U′(s, ṡ)：|τ_i′ s̈ + τ_i″ ṡ²| ≤ 1（i = 1, 2）的交集——(14.39) 的正确形式 s̈ = (u_i − τ_i″ṡ²)/τ_i′
  function accelInterval(D, sd) {
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < 2; i++) {
      const a = D.d1[i], b = D.d2[i] * sd * sd;
      if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1 + 1e-12) return null; continue; }
      let l = (-1 - b) / a, u = (1 - b) / a; if (l > u) [l, u] = [u, l];
      lo = Math.max(lo, l); hi = Math.min(hi, u);
    }
    return lo <= hi + 1e-12 ? [lo, hi] : null;
  }

  // ---------------------------------------------------------------
  // 组件：路径约束下的允许加速度（14.32–14.43、例 14.6）
  // q̈ = τ′(s) s̈ + τ″(s) ṡ²：随 s̈ 变化是一条直线，与 U = [−1,1]² 的交就是可行的加速度
  // ---------------------------------------------------------------
  class PathAccel {
    constructor(root) {
      this.key = "arc"; this.s = 0.5; this.sd = 0.3;
      const body = C.frame(root, "沿路径走时允许的加速度", "例 14.6：平面上两个双积分器，U = [−1,1]²；左：路径与当前位置，右：加速度平面");
      this.path = new C.Stage({ view: [-2.6, 2.6, -1.8, 1.8], aspect: 0.7, maxW: 380, onDraw: (ctx, st, col) => this.drawPath(ctx, st, col) });
      this.acc = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], aspect: 1, maxW: 320, pad: 22, onDraw: (ctx, st, col) => this.drawAcc(ctx, st, col) });
      this.segP = C.seg(Object.entries(PATHS).map(([k, p]) => [k, p.name]), this.key, (k) => { this.key = k; this.render(); });
      this.sS = C.slider("s", 0, 1, 0.005, this.s, (v) => { this.s = v; this.render(); }, (v) => v.toFixed(3));
      this.sSd = C.slider("ṡ", 0, 1.2, 0.005, this.sd, (v) => { this.sd = v; this.render(); }, (v) => v.toFixed(3));
      this.stats = { I: C.stat("U′(s, ṡ)：s̈ 的允许区间"), tau: C.stat("τ′(s) / τ″(s)ṡ²") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segP), h("div", { class: "controls" }, this.sS, this.sSd),
        h("div", { class: "split" }, this.path.wrap, this.acc.wrap), h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("strong"), "U = [−1,1]²"], [C.cv("accent"), "q̈ = τ′s̈ + τ″ṡ²（s̈ 取遍 ℝ）"], [C.cv("ok"), "能留在路径上的加速度"], [C.cv("warn"), "τ″ṡ²：向心项"]]));
      this.render();
    }
    render() {
      const P = PATHS[this.key], D = deriv(P.f, this.s), I = accelInterval(D, this.sd);
      this.D = D; this.I = I;
      this.stats.I.set(I ? `[${I[0].toFixed(3)}, ${I[1].toFixed(3)}]` : '<span class="no">空集：(s, ṡ) ∈ S_obs</span>');
      this.stats.tau.set(`(${D.d1[0].toFixed(2)}, ${D.d1[1].toFixed(2)}) / (${(D.d2[0] * this.sd * this.sd).toFixed(2)}, ${(D.d2[1] * this.sd * this.sd).toFixed(2)})`);
      const lin = this.key === "line";
      this.msg.innerHTML = "由链式法则 (14.33)(14.34)：q̇ = τ′ṡ，q̈ = τ″ṡ² + τ′s̈。固定 (s, ṡ) 时，s̈ 取遍实数，q̈ 就走过一条方向为 τ′、过点 τ″ṡ² 的直线（蓝）；它与 U 的交（绿）就是能让质点<b>留在路径上</b>的加速度，对应的 s̈ 组成 U′(s, ṡ)。" +
        (lin ? " 直线路径 τ″ = 0：蓝线总是过原点，U′ 与 ṡ 无关——例 14.6 说这是退化情形；区间由 |a_i| 较大的那个分量决定：[−1/max|a_i|, 1/max|a_i|]。" :
          " 弯路上 τ″ ≠ 0：ṡ 越大，蓝线被向心项推得越远，绿段越短；推出正方形时 U′ = ∅——这一对 (s, ṡ) 就属于 S_obs。这就是「在高速时，留在路径上需要的加速度落在 [−1,1]ⁿ 之外」。");
      this.path.draw(); this.acc.draw();
    }
    drawPath(ctx, st, col) {
      st.frame(col);
      const f = PATHS[this.key].f, P = []; for (let k = 0; k <= 200; k++) { const p = f(k / 200); P.push({ x: p[0], y: p[1] }); }
      st.polyline(P, col.text2, 2.2);
      const p = f(this.s), q = { x: p[0], y: p[1] }, D = this.D;
      st.arrow(q, { x: q.x + D.d1[0] * this.sd * 0.5, y: q.y + D.d1[1] * this.sd * 0.5 }, col.accent, 2, 7);
      st.arrow(q, { x: q.x + D.d2[0] * this.sd * this.sd * 0.25, y: q.y + D.d2[1] * this.sd * this.sd * 0.25 }, col.warn, 2, 7);
      st.dot(q, 5.5, col.current);
      st.text("q̇ = τ′ṡ（×0.5）", { x: q.x, y: q.y }, col.accent, { dx: 8, dy: 16, align: "left", size: 10.5 });
    }
    drawAcc(ctx, st, col) {
      st.frame(col);
      st.axes(col, { xlabel: "q̈₁", ylabel: "q̈₂", xticks: [-2, -1, 0, 1, 2], yticks: [-2, -1, 0, 1, 2] });
      st.rectW(-1, -1, 1, 1, C.alpha(col.text2, 0.08), col.strong, 1.6);
      const D = this.D, sd2 = this.sd * this.sd, c = { x: D.d2[0] * sd2, y: D.d2[1] * sd2 }, d = { x: D.d1[0], y: D.d1[1] }, L = Math.hypot(d.x, d.y) || 1;
      st.line({ x: c.x - (d.x / L) * 10, y: c.y - (d.y / L) * 10 }, { x: c.x + (d.x / L) * 10, y: c.y + (d.y / L) * 10 }, col.accent, 1.6);
      st.arrow({ x: 0, y: 0 }, c, col.warn, 1.8, 6);
      if (this.I) { const a = this.I[0], b = this.I[1]; st.line({ x: c.x + d.x * a, y: c.y + d.y * a }, { x: c.x + d.x * b, y: c.y + d.y * b }, col.ok, 5); }
    }
  }

  // ---------------------------------------------------------------
  // 组件：路径约束相平面 S（图 14.27–14.29）
  // ---------------------------------------------------------------
  class PathPhase {
    constructor(root) {
      this.key = "arc"; this.mode = "bang"; this.N = 600; this.m = 80; this.nv = 100; this.anim = 0; this.cap = 1.2;
      const body = C.frame(root, "路径约束相平面 S", "图 14.27–14.29：横轴 s，纵轴 ṡ；红色 = S_obs（U′ 为空），黑线 = 极限曲线 φ(s)");
      this.st = new C.Stage({ view: [0, 1, 0, 1], aspect: 0.62, maxW: 560, stretch: true, padL: 30, padB: 18, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.pathSt = new C.Stage({ view: [-2.6, 2.6, -1.8, 1.8], aspect: 0.7, maxW: 300, onDraw: (ctx, st, col) => this.drawPath(ctx, st, col) });
      this.segP = C.seg(Object.entries(PATHS).map(([k, p]) => [k, p.name]), this.key, (k) => { this.key = k; this.compute(); });
      this.segM = C.seg([["bang", "bang-bang（图 14.28）"], ["dp", "动态规划 (14.46)（图 14.27b）"]], this.mode, (k) => { this.mode = k; this.compute(); });
      this.sM = C.slider("竖线数 m", 10, 160, 5, this.m, (v) => { this.m = v; if (this.mode === "dp") this.compute(); });
      this.runner = new C.Runner(() => { this.anim += 1 / 60; this.pathSt.draw(); this.st.draw(); return this.anim < this.T; });
      this.stats = { T: C.stat("走完路径的时间"), sw: C.stat("切换点 / 切点"), cmp: C.stat("另一种方法的时间") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segP), h("div", { class: "controls" }, this.segM, this.sM, C.button("沿路径播放", () => { this.anim = 0; this.runner.start(); }, "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.pathSt.wrap, h("div", { class: "stats" }, Object.values(this.stats)))), this.msg,
        C.legend([[C.cv("badSoft"), "S_obs"], [C.cv("text"), "极限曲线 φ(s)"], [C.cv("alive2"), "目标曲线：从 (1, 0) 反向全力减速"], [C.cv("accent"), "全力加速 / 减速的曲线"], [C.cv("path"), "解"]]));
      this.compute();
    }
    D(s) { return deriv(PATHS[this.key].f, s); }
    phi(s) {
      const D = this.D(s); if (accelInterval(D, this.cap)) return this.cap;
      let lo = 0, hi = this.cap; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (accelInterval(D, m)) lo = m; else hi = m; }
      return lo;
    }
    I(s, sd) { return accelInterval(this.D(Math.max(0, Math.min(1, s))), sd); }
    phiAt(s) { const f = Math.max(0, Math.min(1, s)) * this.N, k = Math.min(this.N - 1, Math.floor(f)), a = f - k; return (1 - a) * this.phiS[k] + a * this.phiS[k + 1]; }
    // 在 v = ṡ² 坐标里积分：dv/ds = 2 s̈。tol > 0 时允许略微越过极限曲线（数值上的「刚好擦过」），越过量在容差内就贴回曲线
    integrate(s0, v0, dir, pick, stop, tol) {
      tol = tol || 0;
      const ds = 1 / this.N, out = [{ s: s0, v: v0 }]; let s = s0, v = v0;
      for (let k = 0; k < 4 * this.N; k++) {
        const lim2 = this.phiAt(s) ** 2, I = this.I(s, Math.sqrt(Math.max(0, Math.min(v, lim2 * (1 - 1e-9)))));
        if (!I) { out.obs = true; break; }
        const a = pick === "max" ? I[1] : I[0], s2 = s + dir * ds; let v2 = v + dir * 2 * a * ds;
        if (s2 < -1e-9 || s2 > 1 + 1e-9) break;
        if (v2 < 0) { out.push({ s: s2, v: 0 }); out.zero = true; break; }
        const l2 = this.phiAt(s2) ** 2;
        if (v2 > l2) { if (tol > 0 && v2 <= l2 * (1 + tol) + 1e-7) v2 = l2 * (1 - 1e-9); else { out.obs = true; out.push({ s: s2, v: v2 }); break; } }
        s = s2; v = v2; out.push({ s, v });
        if (stop && stop(s, v)) break;
      }
      return out;
    }
    compute() {
      this.runner && this.runner.stop();
      const N = this.N; this.phiS = []; for (let k = 0; k <= N; k++) this.phiS.push(this.phi(k / N));
      let top = 0; for (const p of this.phiS) top = Math.max(top, p); top = Math.min(this.cap, top * 1.35 + 0.02);
      this.st.setView([0, 1, 0, Math.max(0.1, top)]);
      this.curves = []; this.switches = []; this.sol = null; this.fallback = false;
      const tb = this.bangBang(), curves = this.curves, sw = this.switches, td = this.dp(), t2 = this.twoPass();
      // 书中的 bang-bang 描述假设切点孤立、处处 dτ_i/ds ≠ 0；结果不可行（或比两遍法还快，说明数值上越界了）就退回补充的两遍法
      const ok = tb.sol && this.violation(tb.sol) < 0.05 && tb.T >= t2 - 1e-3;
      const f = (T) => (T === Infinity ? "∞" : T.toFixed(3));
      if (this.mode === "bang") {
        if (ok) { this.sol = tb.sol; this.T = tb.T; this.curves = curves; this.switches = sw; }
        else { this.fallback = true; this.sol = this.two; this.T = t2; this.curves = curves.slice(0, 1); this.switches = this.touchPoints(this.two); }
        this.stats.cmp.set(`动态规划 ${f(td.T)} · 两遍法核对 ${t2.toFixed(3)}`);
      } else { this.sol = td.sol; this.T = td.T; this.curves = []; this.switches = []; this.stats.cmp.set(`bang-bang ${ok ? f(tb.T) : "（退回两遍法）" + t2.toFixed(3)} · 两遍法核对 ${t2.toFixed(3)}`); }
      this.stats.T.set(this.T === Infinity ? '<span class="no">∞</span>' : this.T.toFixed(3));
      this.stats.sw.set(this.mode === "bang" ? this.switches.length : "–");
      this.anim = 0; this.render();
    }
    // 速度剖面的可行性：相邻两点所需的 s̈ 与 U′ 的最大偏差
    violation(sol) {
      let worst = 0;
      for (let k = 0; k + 1 < sol.length; k++) {
        const ds = sol[k + 1].s - sol[k].s; if (ds <= 0) continue;
        const a = (sol[k + 1].v - sol[k].v) / (2 * ds), I = this.I(sol[k].s, Math.sqrt(Math.min(sol[k].v, this.phiAt(sol[k].s) ** 2 * (1 - 1e-9))));
        if (!I) return Infinity; worst = Math.max(worst, a - I[1], I[0] - a);
      }
      return worst;
    }
    // 两遍法剖面贴到极限曲线的地方（图 14.29 里「连起来的点」）
    touchPoints(sol) {
      const out = []; let on = false;
      for (const p of sol) { const t = p.v >= this.phiAt(p.s) ** 2 * 0.995 && p.v > 1e-6; if (t && !on) out.push(p); on = t; }
      return out;
    }
    timeOf(sol) {
      let T = 0; for (let k = 1; k < sol.length; k++) { const a = Math.sqrt(sol[k - 1].v), b = Math.sqrt(sol[k].v), ds = Math.abs(sol[k].s - sol[k - 1].s); if (ds < 1e-15) continue; if (a + b < 1e-12) return Infinity; T += (2 * ds) / (a + b); } return T;
    }
    // 补充：前向全力加速 / 反向全力减速两遍、都贴着极限曲线截断，得到最短时间速度剖面（只用来核对，参考代码第 11 项）
    twoPass() {
      const N = this.N, ds = 1 / N, v = new Float64Array(N + 1);
      for (let k = 0; k < N; k++) { const I = this.I(k * ds, Math.sqrt(Math.min(v[k], this.phiS[k] ** 2 * (1 - 1e-9)))); v[k + 1] = Math.min(Math.max(v[k] + 2 * ds * (I ? I[1] : 0), 0), this.phiS[k + 1] ** 2); }
      v[N] = 0;
      for (let k = N; k > 0; k--) { const I = this.I(k * ds, Math.sqrt(Math.min(v[k], this.phiS[k] ** 2 * (1 - 1e-9)))); v[k - 1] = Math.min(v[k - 1], Math.max(v[k] - 2 * ds * (I ? I[0] : 0), 0)); }
      const sol = []; for (let k = 0; k <= N; k++) sol.push({ s: k * ds, v: v[k] });
      this.two = sol; return this.timeOf(sol);
    }
    // 图 14.28 BANG-BANG APPROACH。prof[k] 记录已经确定的速度剖面 v = ṡ²（s = k/N）
    bangBang() {
      const N = this.N, TOL = 0.004, fail = { sol: null, T: Infinity };
      // 1. 从 (1, 0) 对 s̈ = u′_min 反向积分，得到「目标曲线」；直到进入 S_obs 或 ṡ = 0（后者报告失败）
      const goal = this.integrate(1, 0, -1, "min"); if (goal.zero) return fail;
      goal.reverse(); this.curves = [{ pts: goal, kind: "goal" }];
      const gV = new Float64Array(N + 1).fill(Infinity); for (const p of goal) gV[Math.round(p.s * N)] = p.v;
      // 2. (s_cur, ṡ_cur) = (0, 0)
      const prof = new Float64Array(N + 1).fill(NaN); prof[0] = 0; let kc = 0; this.switches = [];
      const finish = () => { const sol = []; for (let k = 0; k <= N; k++) if (!Number.isNaN(prof[k])) sol.push({ s: k / N, v: prof[k] }); return { sol, T: this.timeOf(sol) }; };
      for (let iter = 0; iter < 2 * N; iter++) {
        // 3. 从当前点全力加速，直到进入 S_obs 的内部，或越过第 1 步的曲线（后者：问题解决）
        const fw = this.integrate(kc / N, prof[kc], 1, "max", (s, v) => v >= gV[Math.round(s * N)]);
        this.curves.push({ pts: fw, kind: "acc" });
        const last = fw[fw.length - 1], valid = fw.obs ? fw.slice(0, -1) : fw;
        for (const p of valid) prof[Math.round(p.s * N)] = p.v;
        if (!fw.obs) {
          const ke = Math.round(last.s * N);
          if (last.v < gV[ke] - 1e-12) return fail;
          prof[ke] = gV[ke];   // 交点落在 ke−1 与 ke 之间：从 ke 起改走目标曲线
          for (let k = ke + 1; k <= N; k++) prof[k] = gV[k];
          this.switches.push(last);
          return finish();
        }
        const kf = Math.round(valid[valid.length - 1].s * N);
        // 4. 沿极限曲线往右找下一个切点：从那里反向全力减速（往左走），刚好擦过 S_obs，并与已经确定的剖面相交。
        //    在刺穿点附近，减速曲线应当在加速曲线<b>下方</b>；往左走时它上升、加速曲线下降，二者相交处就是切换点。
        let found = null;
        for (let k = Math.max(kc + 1, kf); k <= N && !found; k++) {
          let below = false, met = false, bad = false;
          const back = this.integrate(k / N, this.phiS[k] ** 2 * (1 - 1e-9), -1, "min", (ss, vv) => {
            const j = Math.round(ss * N); if (j > kf) return false;
            if (vv < prof[j]) { below = true; return false; }
            if (below) { met = true; return true; }
            bad = true; return true;   // 一进入重叠区就在剖面上方：不是要找的切点
          }, TOL);
          if (!met || bad || back.obs || back.zero) continue;
          found = { k, back };
        }
        if (!found) return fail;
        for (let j = found.k + 1; j <= N; j++) prof[j] = NaN;
        for (const p of found.back) prof[Math.round(p.s * N)] = p.v;
        this.curves.push({ pts: found.back, kind: "dec" });
        this.switches.push(found.back[found.back.length - 1], found.back[0]);
        kc = found.k;
        if (kc >= N) return finish();
      }
      return fail;
    }
    // 图 14.27b：竖线上的波前 (14.46)。第 k 列取 nv + 1 个 ṡ 样本，G*_{k+1} 沿竖轴线性插值（两侧都有限才算有限）；
    // 动作取 U′(s_k, ṡ) 里均匀的 A 个值，再加上恰好落到下一列样本上的那些值（否则终点 (1, 0) 很难恰好到达）
    dp() {
      const m = this.m, nv = this.nv, top = this.st.view[3], ds = 1 / m, dv = top / nv, A = 9, BIG = 1000;
      const G = []; for (let k = 0; k <= m; k++) G.push(new Float64Array(nv + 1).fill(BIG));
      G[m][0] = 0;   // 目标：(1, 0)
      const Ds = []; for (let k = 0; k <= m; k++) Ds.push(this.D(k * ds));
      // 「∞」用大数 BIG 代替再做线性插值：严格的 ∞ 插值会让有限区域每一列都往里缩一点，几十列下来解就被压得很慢
      const interp = (g, sd) => { if (sd < -1e-12 || sd > top + 1e-12) return BIG; const f = Math.min(nv, Math.max(0, sd / dv)), i0 = Math.min(nv - 1, Math.floor(f)), a = f - i0; return (1 - a) * g[i0] + a * g[i0 + 1]; };
      const best = (k, sd) => {
        const I = accelInterval(Ds[k], sd); if (!I) return null;
        const U = []; for (let a = 0; a < A; a++) U.push(I[0] + ((I[1] - I[0]) * a) / (A - 1));
        const lo = sd * sd + 2 * I[0] * ds, hi = sd * sd + 2 * I[1] * ds;
        for (let j = Math.ceil(Math.sqrt(Math.max(0, lo)) / dv - 1e-9); j * dv <= Math.sqrt(Math.max(0, hi)) + 1e-12 && j <= nv; j++) U.push(((j * dv) ** 2 - sd * sd) / (2 * ds));
        let bc = BIG, bs = -1;
        for (const u of U) {
          const v2 = sd * sd + 2 * u * ds; if (v2 < -1e-12) continue;
          const sd2 = Math.sqrt(Math.max(0, v2)); if (sd + sd2 < 1e-12) continue;
          const J = accelInterval(Ds[k + 1], sd2); if (!J) continue;
          const c = (2 * ds) / (sd + sd2) + interp(G[k + 1], sd2);
          if (c < bc) { bc = c; bs = sd2; }
        }
        return { c: bc, sd2: bs };
      };
      for (let k = m - 1; k >= 0; k--) for (let i = 0; i <= nv; i++) { const r = best(k, i * dv); if (r) G[k][i] = Math.min(BIG, r.c); }
      this.Gdp = G; this.BIG = BIG;
      if (G[0][0] >= 0.5 * BIG) return { sol: null, T: Infinity };
      // 用局部算子 (14.28) 从 (0, 0) 往前走：每列在实际的 ṡ 上重新取 argmin
      const sol = [{ s: 0, v: 0 }]; let sd = 0;
      for (let k = 0; k < m; k++) { const r = best(k, sd); if (!r || r.c >= 0.5 * BIG || r.sd2 < 0) return { sol: null, T: Infinity }; sd = r.sd2; sol.push({ s: (k + 1) * ds, v: sd * sd }); }
      return { sol, T: this.timeOf(sol) };
    }
    render() {
      const bang = this.mode === "bang";
      this.msg.innerHTML = "给定路径 τ 之后只剩两个自由度：位置 s 和速率 ṡ。满足 (14.39) 的 s̈ 组成 U′(s, ṡ)，系统变成<b>一个双积分器</b> s̈ = u′。U′ 为空的状态组成 S_obs，它的下边界就是<b>极限曲线</b> φ(s)。" +
        (bang ? " bang-bang：先从终点 (1, 0) 反向全力减速得到目标曲线（紫）；从 (0, 0) 全力加速（蓝），撞上极限曲线时，沿极限曲线向右找下一个<b>切点</b>，从那里反向全力减速、刚好擦过 S_obs 接上加速曲线；再从切点继续加速……直到碰到目标曲线。解就是把这些点连起来（图 14.29），在边界上走，所以执行时没有任何余量去跟踪误差。" +
          (this.fallback ? ' <span class="no">这条路径上书中的简化步骤不够用</span>：极限曲线附近允许的 s̈ 有时全为正（想减速都不行），或者有 dτ_i/ds = 0 的点（发夹弯的弯尖），最优解要沿极限曲线「滑行」一段（奇异弧），书中把这些情形留给了 [128][129]。这里改为显示补充的<b>两遍法</b>：从左往右全力加速、从右往左全力减速，两条都贴着极限曲线截断，取较小者——得到的同样是全力加速、全力减速、贴着极限曲线三种段交替的最短时间剖面；黑点是它碰到极限曲线的地方。' : "") :
          " 动态规划：把 s 轴分成 m 段，从 s = 1 开始一列一列往回做 (14.46)，每列上的 ṡ 采样、用一维线性插值求 G*_{k+1}。因为 ṡ > 0，只需要一次从右往左的「波前」就算完（图 14.27b）。终点要求 ṡ 落在最低的一个采样格里（相当于一个小的目标容差）。") +
        (this.key === "hairpin" ? " 发夹弯处极限曲线几乎降到 0：车必须在弯道前几乎停下——就像双层观光巴士过急弯，否则会侧翻。" : "") +
        "<span class=\"muted\">（补充：两种方法的时间应当接近；动态规划受 m 和 ṡ 采样的影响，略慢一点。）</span>";
      this.st.draw(); this.pathSt.draw();
    }
    sdAt(t) {
      // 沿解按时间插值，返回当前 s
      if (!this.sol) return 0;
      let T = 0; for (let k = 1; k < this.sol.length; k++) { const a = Math.sqrt(this.sol[k - 1].v), b = Math.sqrt(this.sol[k].v), ds = this.sol[k].s - this.sol[k - 1].s, dt = (2 * ds) / Math.max(1e-9, a + b); if (T + dt >= t) return this.sol[k - 1].s + (ds * (t - T)) / dt; T += dt; }
      return 1;
    }
    draw(ctx, st, col) {
      st.frame(col);
      const N = this.N, top = st.view[3];
      const lim = []; for (let k = 0; k <= N; k++) lim.push({ x: k / N, y: Math.min(top, this.phiS[k]) });
      st.poly([{ x: 0, y: top }].concat(lim, [{ x: 1, y: top }]), C.alpha(col.bad, 0.18), null);
      st.polyline(lim, col.text, 2);
      st.axes(col, { xlabel: "s", ylabel: "ṡ", xticks: [0, 0.25, 0.5, 0.75, 1], grid: false, zero: false });
      if (this.mode === "dp" && this.Gdp) for (let k = 0; k <= this.m; k++) st.line({ x: k / this.m, y: 0 }, { x: k / this.m, y: top }, C.alpha(col.accent, 0.18), 1);
      for (const c of this.curves) st.polyline(c.pts.map((p) => ({ x: p.s, y: Math.sqrt(Math.max(0, p.v)) })), c.kind === "goal" ? col.alive2 : C.alpha(col.accent, c.kind === "dec" ? 0.9 : 0.6), c.kind === "goal" ? 2 : 1.4, c.kind === "dec" ? [5, 3] : null);
      if (this.sol) st.polyline(this.sol.map((p) => ({ x: p.s, y: Math.sqrt(Math.max(0, p.v)) })), col.path, 3);
      for (const p of this.switches) st.dot({ x: p.s, y: Math.sqrt(Math.max(0, p.v)) }, 4, col.text);
      if (this.runner.running || this.anim > 0) { const s = this.sdAt(this.anim); st.line({ x: s, y: 0 }, { x: s, y: top }, col.current, 1.2, [3, 3]); }
    }
    drawPath(ctx, st, col) {
      st.frame(col);
      const f = PATHS[this.key].f, P = []; for (let k = 0; k <= 200; k++) { const p = f(k / 200); P.push({ x: p[0], y: p[1] }); }
      // 按极限曲线给路径着色：越红越需要慢
      for (let k = 1; k < P.length; k++) { const phi = this.phiS[Math.round((k / 200) * this.N)], t = 1 - Math.min(1, phi / (this.st.view[3] || 1)); st.line(P[k - 1], P[k], C.mix(col.ok, col.bad, t), 4); }
      const s = this.sdAt(this.anim), p = f(s); st.dot({ x: p[0], y: p[1] }, 6, col.current, col.surface, 2);
      st.text(`t = ${Math.min(this.anim, this.T || 0).toFixed(2)}`, { x: st.view[0] + 0.5, y: st.view[3] - 0.25 }, col.muted, { size: 10.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='plan-transform']").forEach((el) => el._w = new PlanTransform(el));
    document.querySelectorAll("[data-widget='path-accel']").forEach((el) => el._w = new PathAccel(el));
    document.querySelectorAll("[data-widget='path-phase']").forEach((el) => el._w = new PathPhase(el));
  });
})();
