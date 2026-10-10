/* 7.4 节：闭运动链——沿 C_clo 步进的 RDT（图 7.21、7.22，式 7.22–7.24）、
   主动–被动分解与随机环生成器（图 7.23–7.25）、关节限位下的可达区域界（图 7.26） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // =================================================================
  // 组件 1：RDT 沿着 C_clo 走（n = 2，k = 1：C = ℝ²，C_clo 是一条隐式曲线 f(q) = 0，维数 m = 1）
  // =================================================================
  const CURVES = {
    peanut: { name: "一个环（花生形）", f: (x, y) => (x * x + y * y) ** 2 - 2 * (x * x - y * y) - (1.08 ** 4 - 1), qI: [1.47, 0], qG: [-1.47, 0], obs: [{ x: 0, y: 0.42, r: 0.15 }] },
    lemn: { name: "8 字形（双纽线，原点是奇点）", f: (x, y) => (x * x + y * y) ** 2 - 2 * (x * x - y * y), qI: [1.38, 0], qG: [-1.38, 0], obs: [{ x: 0.75, y: 0.49, r: 0.12 }] },
    cassini: { name: "两个分开的环（Cassini 卵形线）", f: (x, y) => (x * x + y * y) ** 2 - 2 * (x * x - y * y) - (0.85 ** 4 - 1), qI: [1.3, 0], qG: [-1.3, 0], obs: [{ x: 1.0, y: 0.36, r: 0.12 }] },
  };
  const grad = (f, x, y) => { const e = 1e-5; return [(f(x + e, y) - f(x - e, y)) / (2 * e), (f(x, y + e) - f(x, y - e)) / (2 * e)]; };
  // 沿法向（梯度方向）做几步 Newton，把点拉回 C_clo
  function project(f, x, y) {
    for (let it = 0; it < 8; it++) {
      const v = f(x, y), [gx, gy] = grad(f, x, y), g2 = gx * gx + gy * gy;
      if (g2 < 1e-12) break;
      x -= (v * gx) / g2; y -= (v * gy) / g2;
      if (Math.abs(v) < 1e-10) break;
    }
    return [x, y];
  }
  // 从 q 出发朝样本 a 走：每步把 v = a − q 投影到切线上（式 7.22–7.24 的二维情形），走一小步，再沿法向回到 C_clo
  function stepAlong(f, q, a, eps, obsFree, maxSteps) {
    const pts = [q.slice()]; let [x, y] = q, corr = 0, why = "steps";
    let best = Math.hypot(a[0] - x, a[1] - y);
    for (let s = 0; s < (maxSteps || 40); s++) {
      const [gx, gy] = grad(f, x, y), gn = Math.hypot(gx, gy);
      if (gn < 1e-6) { why = "singular"; break; }
      const tx = -gy / gn, ty = gx / gn, vx = a[0] - x, vy = a[1] - y, vn = Math.hypot(vx, vy);
      const a1 = vx * tx + vy * ty;                      // a₁ = v · e₁（式 7.24，m = 1）
      if (Math.abs(a1) < 0.15 * vn || vn < eps) { why = vn < eps ? "reached" : "perp"; break; }   // 切线几乎垂直于 v：没法再前进
      let nx = x + Math.sign(a1) * Math.min(eps, Math.abs(a1)) * tx, ny = y + Math.sign(a1) * Math.min(eps, Math.abs(a1)) * ty;
      if (Math.abs(f(nx, ny)) > 1e-9) { [nx, ny] = project(f, nx, ny); corr++; }
      const d = Math.hypot(a[0] - nx, a[1] - ny);
      if (!obsFree(nx, ny)) { why = "obstacle"; break; }
      if (d > best - 1e-6) { why = "noprogress"; break; }
      best = d; x = nx; y = ny; pts.push([x, y]);
    }
    return { pts, corr, why };
  }

  class CloRDT {
    constructor(root) {
      this.curve = "peanut"; this.eps = 0.06; this.band = false; this.seed = 11;
      const body = C.frame(root, "沿 C_clo 步进的 RDT", "图 7.21、7.22：样本 α(i) 取在整个矩形里（不必落在 C_clo 上）；每一步都把 v = α(i) − q 投影到切线上再拉回曲线");
      this.st = new C.Stage({ view: [-1.75, 1.75, -1.15, 1.15], maxW: 560, aspect: 0.66, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.selC = C.select(Object.entries(CURVES).map(([k, v]) => [k, v.name]), this.curve, (k) => { this.curve = k; this.reset(); });
      this.sE = C.slider("步长", 0.02, 0.15, 0.01, this.eps, (v) => { this.eps = v; this.reset(); }, (v) => v.toFixed(2));
      this.cB = C.check("显示加厚的带 |f(q)| < ε", this.band, (v) => { this.band = v; this.st.draw(); });
      this.tick = 0;
      this.runner = new C.Runner(() => { if (++this.tick % 4) return true; if (!this.step()) return false; this.render(); return true; }, () => this.render());   // 放慢：每 4 帧一个样本
      this.stats = { s: C.stat("样本数"), on: C.stat("恰好落在 C_clo 上的样本"), v: C.stat("树上的点"), c: C.stat("法向修正次数"), sol: C.stat("连到 q_G") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selC, this.sE, this.cB),
        h("div", { class: "controls" }, C.button("▶ 运行", () => { if (this.done) this.reset(); this.runner.start(); }, "small primary"), C.button("暂停", () => this.runner.stop(), "small"), C.button("单个样本", () => { this.step(); this.render(); }, "small"), C.button("重置", () => { this.seed = C.newSeed(); this.reset(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("muted"), "C_clo（f = 0）", true], [C.cva("bad", 0.5), "障碍（C_obs）"], [C.cv("accent"), "树"], [C.cv("warn"), "当前样本、最近点与切线方向"], [C.cv("path"), "解"]]));
      this.reset();
    }
    get F() { return CURVES[this.curve]; }
    reset() {
      this.runner && this.runner.stop();
      this.r = C.rng(this.seed);
      const f = this.F.f, q = project(f, ...this.F.qI);
      this.V = [{ q, parent: -1, pts: [q] }];
      this.samples = 0; this.corr = 0; this.last = null; this.done = false; this.sol = null; this.whyCount = {};
      this.render();
    }
    step() {
      if (this.done || this.samples >= 600) { this.done = true; return false; }
      const f = this.F.f, a = this.r() < 0.05 ? this.F.qG.slice() : [-1.75 + 3.5 * this.r(), -1.15 + 2.3 * this.r()];
      this.samples++;
      let best = 0, bd = Infinity;
      this.V.forEach((v, i) => { const d = Math.hypot(v.q[0] - a[0], v.q[1] - a[1]); if (d < bd) { bd = d; best = i; } });
      const obs = this.F.obs, qn = this.V[best].q, res = stepAlong(f, qn, a, this.eps, (x, y) => obs.every((o) => Math.hypot(x - o.x, y - o.y) > o.r), 14);
      this.corr += res.corr; this.whyCount[res.why] = (this.whyCount[res.why] || 0) + 1;
      this.last = { a, qn, res };
      if (res.pts.length > 1) {
        // 沿途每隔几步插一个中间顶点（5.5.2 节的近似做法），最后一个点是 stopping configuration q_s
        let parent = best;
        for (let k = 4; k < res.pts.length; k += 4) { this.V.push({ q: res.pts[k], parent, pts: res.pts.slice(k - 4, k + 1) }); parent = this.V.length - 1; }
        const lastK = Math.floor((res.pts.length - 1) / 4) * 4;
        if (lastK < res.pts.length - 1) { this.V.push({ q: res.pts[res.pts.length - 1], parent, pts: res.pts.slice(lastK) }); }
        const qs = this.V[this.V.length - 1].q, G = this.F.qG;
        if (Math.hypot(qs[0] - G[0], qs[1] - G[1]) < 0.05) { this.sol = this.V.length - 1; this.done = true; return false; }
      }
      return true;
    }
    render() {
      this.stats.s.set(this.samples); this.stats.on.set(0); this.stats.v.set(this.V.length); this.stats.c.set(this.corr);
      this.stats.sol.set(this.sol !== null ? '<span class="yes">是</span>' : this.done ? '<span class="no">否</span>' : "—");
      const L = this.last, why = { perp: "切线几乎和 v 垂直", obstacle: "碰到障碍", noprogress: "离样本不再变近", reached: "到达样本附近", steps: "步数用完", singular: "走到奇点（∇f = 0）" };
      this.msg.innerHTML = (L ? `最近这一次扩展停在了 q_s，原因：<b>${why[L.res.why]}</b>。` : "") +
        (this.curve === "cassini" && this.done && this.sol === null ? "两个环互不相连：从 q_I 所在的环永远走不到另一个环——闭链的 C_clo 可能有好几个连通分量。" :
          this.curve === "lemn" ? "在 8 字的交叉点 ∇f = 0，切线没有定义（相当于运动学奇点）；采样规划器在这附近会很吃力。" :
            "在 ℝⁿ 的矩形里随机撒点，落在 C_clo 上的概率是 0——所以样本只用来「拉」树，树上的点全靠投影 + 法向修正得到。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const f = this.F.f, [x0, x1, y0, y1] = st.view, nx = 220, ny = Math.round(nx * (y1 - y0) / (x1 - x0));
      // 加厚的带 |f| < 0.12（栅格），曲线 f = 0 用 marching squares 画成折线
      const [wr, wg, wb] = C.rgb(col.warn), X = (i) => x0 + i * (x1 - x0) / nx, Y = (j) => y0 + j * (y1 - y0) / ny;
      const V = []; for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V.push(f(X(i), Y(j)));
      if (this.band) st.raster(nx, ny, x0, x1, y0, y1, (i, j) => (Math.abs(V[j * (nx + 1) + i]) < 0.12 ? [wr, wg, wb, 70] : null));
      ctx.beginPath();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], v = c.map(([a, b]) => V[b * (nx + 1) + a]), pts = [];
        for (let e = 0; e < 4; e++) { const p = c[e], q = c[(e + 1) % 4], a = v[e], b = v[(e + 1) % 4]; if ((a < 0) !== (b < 0)) { const t = a / (a - b); pts.push([X(p[0] + (q[0] - p[0]) * t), Y(p[1] + (q[1] - p[1]) * t)]); } }
        for (let k = 0; k + 1 < pts.length; k += 2) { ctx.moveTo(st.X(pts[k][0]), st.Y(pts[k][1])); ctx.lineTo(st.X(pts[k + 1][0]), st.Y(pts[k + 1][1])); }
      }
      ctx.strokeStyle = col.muted; ctx.lineWidth = 2; ctx.stroke();
      for (const o of this.F.obs) { ctx.beginPath(); ctx.arc(st.X(o.x), st.Y(o.y), o.r * st.scale, 0, 2 * Math.PI); ctx.fillStyle = C.alpha(col.bad, 0.4); ctx.fill(); ctx.strokeStyle = col.bad; ctx.lineWidth = 1; ctx.stroke(); }
      for (const v of this.V) if (v.parent >= 0) st.polyline(v.pts.map(([x, y]) => ({ x, y })), col.accent, 1.8);
      for (const v of this.V) st.dot({ x: v.q[0], y: v.q[1] }, 2.2, col.accent);
      if (this.sol !== null) { const P = []; for (let c = this.sol; c >= 0; c = this.V[c].parent) P.unshift(...this.V[c].pts.slice().reverse().map(([x, y]) => ({ x, y })).reverse()); st.polyline(P, col.path, 3.2); }
      const L = this.last;
      if (L) {
        const [ax, ay] = L.a, [qx, qy] = L.qn;
        st.dot({ x: ax, y: ay }, 4, col.warn); st.text("α(i)", { x: ax, y: ay }, col.warn, { dx: 6, dy: -8, align: "left", size: 11 });
        st.line({ x: qx, y: qy }, { x: ax, y: ay }, C.alpha(col.warn, 0.8), 1.2, [4, 3]);
        const [gx, gy] = grad(f, qx, qy), gn = Math.hypot(gx, gy) || 1, tx = -gy / gn, ty = gx / gn, s = (ax - qx) * tx + (ay - qy) * ty;
        st.arrow({ x: qx, y: qy }, { x: qx + 0.35 * Math.sign(s) * tx, y: qy + 0.35 * Math.sign(s) * ty }, col.warn, 2, 7);
        st.dot({ x: qx, y: qy }, 3.5, col.warn, col.surface, 1.2);
      }
      st.dot({ x: this.F.qI[0], y: this.F.qI[1] }, 6, col.start, col.surface, 1.5); st.text("qI", { x: this.F.qI[0], y: this.F.qI[1] }, col.start, { dy: -13, weight: 650 });
      st.dot({ x: this.F.qG[0], y: this.F.qG[1] }, 6, col.goal, col.surface, 1.5); st.text("qG", { x: this.F.qG[0], y: this.F.qG[1] }, col.goal, { dy: -13, weight: 650 });
    }
  }

  // =================================================================
  // 组件 2：七关节平面闭环的主动–被动分解（图 7.23–7.25）与随机环生成器
  // =================================================================
  // 地面连杆从 B0 = (0,0) 到 B1 = (L0, 0)；六根活动连杆 l1…l6。主动变量：q1、q2、q3（左边三个关节）和 q7（右下关节）；
  // 被动变量：J3、J4、J5 三个关节（由「两连杆逆运动学」唯一确定，至多两组解）
  const LOOP = { L0: 4.2, l: [1.1, 1.0, 1.0, 1.0, 1.0, 1.1] };
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  // 主动变量 → 各关节位置；q1 是第 1 根连杆的绝对角，q2、q3 是相对转角，q7 是第 6 根连杆（从 B1 出发）的绝对角
  function forwardActive(qa) {
    const { l, L0 } = LOOP, [q1, q2, q3, q7] = qa;
    const P0 = [0, 0], a1 = q1, a2 = a1 + q2, a3 = a2 + q3;
    const P1 = [P0[0] + l[0] * Math.cos(a1), P0[1] + l[0] * Math.sin(a1)];
    const P2 = [P1[0] + l[1] * Math.cos(a2), P1[1] + l[1] * Math.sin(a2)];
    const P3 = [P2[0] + l[2] * Math.cos(a3), P2[1] + l[2] * Math.sin(a3)];
    const B1 = [L0, 0], P5 = [B1[0] + l[5] * Math.cos(q7), B1[1] + l[5] * Math.sin(q7)];
    return { P0, P1, P2, P3, P5, B1 };
  }
  // 被动部分：找 P4 使 |P4 − P3| = l4、|P4 − P5| = l5（两圆求交）
  function closePassive(J, elbow) {
    const l4 = LOOP.l[3], l5 = LOOP.l[4], dx = J.P5[0] - J.P3[0], dy = J.P5[1] - J.P3[1], d = Math.hypot(dx, dy);
    if (d > l4 + l5 || d < Math.abs(l4 - l5) || d < 1e-12) return null;
    const a = (l4 * l4 - l5 * l5 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l4 * l4 - a * a));
    const mx = J.P3[0] + a * dx / d, my = J.P3[1] + a * dy / d, s = elbow ? 1 : -1;
    return [mx - s * hh * dy / d, my + s * hh * dx / d];
  }
  // 平面转动链（关节无限位）从一个固定点出发，末端可达集合恰好是圆环 [r_min, r_max]
  function annulus(ls) { const S = ls.reduce((a, b) => a + b, 0), M = Math.max(...ls); return [Math.max(0, 2 * M - S), S]; }
  // 环生成器：依次为 q1、q2、q3、q7 算出允许区间（在 KC 个候选值里筛），再在区间里随机取值
  const KC = 720, CAND = Array.from({ length: KC }, (_, i) => -Math.PI + (2 * Math.PI * (i + 0.5)) / KC);
  function intervals(prefix) {
    const { l, L0 } = LOOP, k = prefix.length;
    // 已经定下来的那一段链的末端位置与末端连杆的绝对角
    let x = 0, y = 0, a = 0;
    for (let j = 0; j < Math.min(k, 3); j++) { a += prefix[j]; x += l[j] * Math.cos(a); y += l[j] * Math.sin(a); }
    const out = [];
    if (k < 3) {
      const [lo, hi] = annulus(l.slice(k + 1));          // 剩下的连杆 l_{k+2} … l_6 从 B1 出发能到的圆环
      for (const q of CAND) { const b = a + q, px = x + l[k] * Math.cos(b), py = y + l[k] * Math.sin(b), d = Math.hypot(px - L0, py); if (d >= lo - 1e-9 && d <= hi + 1e-9) out.push(q); }
    } else {
      const lo = Math.abs(l[3] - l[4]), hi = l[3] + l[4];   // q7 决定 J5，要求 |J3J5| 在两连杆能够到的范围里
      for (const q of CAND) { const d = Math.hypot(L0 + l[5] * Math.cos(q) - x, l[5] * Math.sin(q) - y); if (d >= lo - 1e-9 && d <= hi + 1e-9) out.push(q); }
    }
    return out;
  }
  function sampleNaive(r) { return [0, 1, 2, 3].map(() => -Math.PI + 2 * Math.PI * r()); }
  function sampleLoopGen(r) {
    const q = [], I = [];
    for (let k = 0; k < 4; k++) {
      const c = intervals(q); I.push(c);
      if (!c.length) return { q: null, I };
      q.push(c[Math.floor(r() * c.length)]);
    }
    return { q, I };
  }

  class LoopGen {
    constructor(root) {
      this.qa = [1.1, -0.9, -0.5, 1.9]; this.elbow = true; this.I = null; this.seed = 5;
      this.r = C.rng(this.seed);
      const body = C.frame(root, "主动–被动分解与随机环生成器", "图 7.23–7.25：七个关节、地面连杆固定，C 是 7 维，C_clo 是 4 维。实心 = 主动关节（自己取值），空心 = 被动关节（由逆运动学算出）");
      this.st = new C.Stage({ view: [-1.5, 5.7, -1.2, 3.6], maxW: 560, aspect: 0.66, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      const names = ["q₁ᵃ", "q₂ᵃ", "q₃ᵃ", "q₇ᵃ"];
      this.sl = names.map((n, k) => C.slider(n, -3.14, 3.14, 0.01, this.qa[k], (v) => { this.qa[k] = v; this.I = null; this.render(); }, (v) => (v * 180 / Math.PI).toFixed(0) + "°"));
      this.segE = C.seg([["1", "被动解 1"], ["0", "被动解 2"]], "1", (k) => { this.elbow = k === "1"; this.render(); });
      this.stats = { naive: C.stat("朴素：4 个主动变量全随机"), gen: C.stat("环生成器"), now: C.stat("当前能闭合吗") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, C.button("朴素随机取一次", () => this.one("naive"), "small"), C.button("环生成器取一次", () => this.one("gen"), "small primary"), C.button("各试 1000 次，统计成功率", () => this.batch(), "small"), this.segE),
        h("div", { class: "split" }, this.st.wrap, h("div", null, ...this.sl.map((s) => h("div", { class: "controls", style: "margin:0 0 4px" }, s)), h("div", { class: "stats" }, Object.values(this.stats)), this.msg)),
        C.legend([[C.cv("text"), "主动关节", true], [C.cv("surface"), "被动关节", true], [C.cva("ok", 0.6), "环生成器给出的允许区间 Iᵢ"], [C.cv("bad"), "闭合不了：|J₃J₅| 超出 l₄ ± l₅"]]));
      this.render();
    }
    one(kind) {
      if (kind === "naive") { this.qa = sampleNaive(this.r); this.I = null; }
      else { const s = sampleLoopGen(this.r); this.I = s.I; if (s.q) this.qa = s.q; }
      this.qa = this.qa.map((v) => Math.atan2(Math.sin(v), Math.cos(v)));
      this.sl.forEach((s, k) => s.set(this.qa[k]));
      this.render();
    }
    batch() {
      const r = C.rng(2024), n = 1000;
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) { if (closePassive(forwardActive(sampleNaive(r)), true)) a++; const s = sampleLoopGen(r); if (s.q && closePassive(forwardActive(s.q), true)) b++; }
      this.stats.naive.set(`${(100 * a / n).toFixed(1)}%`); this.stats.gen.set(`${(100 * b / n).toFixed(1)}%`);
      this.batchMsg = `各取 1000 次（固定随机种子）：全随机时只有 ${(100 * a / n).toFixed(1)}% 能闭合；环生成器 ${(100 * b / n).toFixed(1)}%。（补充：这里关节没有限位，可达集合恰好是圆环，所以区间是精确的，环生成器每次都成功；有限位时区间只是保守的界，书中说「仍可能失败，但成功率高得多」。）`;
      this.render();
    }
    render() {
      const J = forwardActive(this.qa), P4 = closePassive(J, this.elbow);
      this.J = J; this.P4 = P4;
      this.stats.now.set(P4 ? '<span class="yes">能</span>' : '<span class="no">不能</span>');
      const d = Math.hypot(J.P5[0] - J.P3[0], J.P5[1] - J.P3[1]);
      this.msg.innerHTML = (P4 ? `被动关节由「两连杆逆运动学」确定：|J₃J₅| = ${d.toFixed(2)} ∈ [|l₄ − l₅|, l₄ + l₅] = [0, 2]，有两组解（切换「被动解 1/2」）。` :
        `|J₃J₅| = ${d.toFixed(2)} > l₄ + l₅ = 2：无论被动关节取什么值都闭合不了（图 7.25）。`) + (this.batchMsg ? "<br>" + this.batchMsg : "");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const J = this.J, P = [J.P0, J.P1, J.P2, J.P3], pt = (p) => ({ x: p[0], y: p[1] });
      st.box({ x0: -0.6, y0: -0.55, x1: LOOP.L0 + 0.6, y1: -0.12 }, C.alpha(col.ok, 0.55), null);
      st.line(pt(J.P0), pt(J.B1), col.text2, 5);
      // 环生成器的区间：在对应关节处画出允许的方向
      if (this.I) {
        const base = [J.P0, J.P1, J.P2, J.B1], prev = [0, this.qa[0], this.qa[0] + this.qa[1], 0];
        this.I.forEach((I, k) => { if (k > 3) return; for (const q of I.filter((_, i) => i % 6 === 0)) { const a = (k === 3 ? 0 : prev[k]) + q, o = base[k]; st.line(pt(o), { x: o[0] + 0.45 * Math.cos(a), y: o[1] + 0.45 * Math.sin(a) }, C.alpha(col.ok, 0.45), 1); } });
      }
      const link = (a, b, c) => { st.line(pt(a), pt(b), c, 7); st.line(pt(a), pt(b), col.surface, 3); };
      for (let i = 0; i < 3; i++) link(P[i], P[i + 1], col.alive);
      link(J.B1, J.P5, col.alive);
      if (this.P4) { link(J.P3, this.P4, col.warn); link(this.P4, J.P5, col.warn); }
      else st.line(pt(J.P3), pt(J.P5), col.bad, 2, [6, 4]);
      const joint = (p, active, label) => { st.dot(pt(p), 6, active ? col.text : col.surface, col.text, 1.6); st.text(label, pt(p), col.text2, { dy: -15, size: 11 }); };
      joint(J.P0, true, "q₁ᵃ"); joint(J.P1, true, "q₂ᵃ"); joint(J.P2, true, "q₃ᵃ"); joint(J.B1, true, "q₇ᵃ");
      joint(J.P3, false, "J₃"); joint(J.P5, false, "J₅"); if (this.P4) joint(this.P4, false, "J₄");
    }
  }

  // =================================================================
  // 组件 3：关节有限位时，连杆末端可达区域的界（图 7.26）
  // =================================================================
  class ReachBound {
    constructor(root) {
      this.k = 4; this.alpha = 15; this.beta = 20;
      const body = C.frame(root, "关节角的界：连杆能伸到多远", "图 7.26：k 根单位长连杆从原点出发；相邻连杆的夹角限制在 [−α, α]，第一根相对竖直方向限制在 [−β, β]");
      this.st = new C.Stage({ view: [-4.4, 4.4, -1.2, 4.4], maxW: 520, aspect: 0.66, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sK = C.slider("连杆数 k", 2, 6, 1, this.k, (v) => { this.k = v; this.update(); });
      this.sA = C.slider("α", 5, 180, 1, this.alpha, (v) => { this.alpha = v; this.update(); }, (v) => v + "°");
      this.sB = C.slider("β", 0, 180, 1, this.beta, (v) => { this.beta = v; this.update(); }, (v) => v + "°");
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.sK, this.sA, this.sB), this.st.wrap, this.out,
        C.legend([[C.cva("muted", 0.4), "无限位时的界：半径 k 的圆"], [C.cva("ok", 0.35), "有限位时更紧的界（补充推导）"], [C.cv("accent"), "随机采样的末端位置", true]]));
      this.update();
    }
    update() {
      const r = C.rng(77), k = this.k, al = this.alpha * Math.PI / 180, be = this.beta * Math.PI / 180;
      this.pts = [];
      for (let n = 0; n < 2500; n++) {
        let a = Math.PI / 2 + (2 * r() - 1) * be, x = 0, y = 0;
        for (let j = 0; j < k; j++) { if (j) a += (2 * r() - 1) * al; x += Math.cos(a); y += Math.sin(a); }
        this.pts.push({ x, y });
      }
      // 界：第 j 根连杆的方向偏离第 1 根至多 (j−1)α，所以 kα 足够小时末端在一个扇环里
      const spread = (k - 1) * al, rmin = spread <= Math.PI ? Math.max(0, Array.from({ length: k }, (_, j) => Math.cos(j * al)).reduce((s, v) => s + v, 0)) : 0;
      this.bound = { spread, rmin, ok: spread + be <= Math.PI / 2 };   // 半角不超过 90° 时锥是凸的，向量和才留在锥里
      const dmin = Math.min(...this.pts.map((p) => Math.hypot(p.x, p.y)));
      this.out.innerHTML = this.bound.ok ?
        `末端方向偏离竖直至多 β + (k−1)α = ${((be + spread) * 180 / Math.PI).toFixed(0)}°；沿第 1 根连杆方向的投影至少 Σ cos(jα) = ${rmin.toFixed(2)}，所以末端离原点至少这么远（采样到的最小距离 ${dmin.toFixed(2)}）。绿色扇环比整个圆小得多——用它来算环生成器的区间 Iᵢ，筛掉的角度就更多。` :
        "限位太宽（β + (k−1)α > 90°）时，各连杆方向所在的锥不再是凸的，这个简单的界就不成立了，只剩下整个圆。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const done = st.clip();
      const k = this.k, be = this.beta * Math.PI / 180, B = this.bound;
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), k * st.scale, 0, 2 * Math.PI); ctx.fillStyle = C.alpha(col.muted, 0.1); ctx.fill(); ctx.strokeStyle = C.alpha(col.muted, 0.6); ctx.lineWidth = 1; ctx.stroke();
      if (B.ok) {
        const a0 = Math.PI / 2 - be - B.spread, a1 = Math.PI / 2 + be + B.spread;
        ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), k * st.scale, -a0, -a1, true); ctx.arc(st.X(0), st.Y(0), B.rmin * st.scale, -a1, -a0, false); ctx.closePath();
        ctx.fillStyle = C.alpha(col.ok, 0.18); ctx.fill(); ctx.strokeStyle = col.ok; ctx.lineWidth = 1.4; ctx.stroke();
      }
      for (const p of this.pts) { ctx.fillStyle = C.alpha(col.accent, 0.45); ctx.fillRect(st.X(p.x) - 1, st.Y(p.y) - 1, 2, 2); }
      // 画一个伸直的、一个卷到极限的示例
      const chain = (angles, c) => { let a = Math.PI / 2, x = 0, y = 0; const P = [{ x, y }]; angles.forEach((d, j) => { a += j ? d : 0; x += Math.cos(a); y += Math.sin(a); P.push({ x, y }); }); st.polyline(P, c, 3); P.forEach((p) => st.dot(p, 3, col.surface, c, 1.2)); };
      chain(Array(k).fill(this.alpha * Math.PI / 180), col.warn);
      st.dot({ x: 0, y: 0 }, 5, col.text);
      done();
    }
  }

  CH7.closed = { CloRDT, LoopGen, ReachBound, CURVES, project, stepAlong, LOOP, forwardActive, closePassive, annulus, intervals, sampleNaive, sampleLoopGen };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='clo-rdt']").forEach((el) => el._w = new CloRDT(el));
    document.querySelectorAll("[data-widget='loop-generator']").forEach((el) => el._w = new LoopGen(el));
    document.querySelectorAll("[data-widget='reach-bound']").forEach((el) => el._w = new ReachBound(el));
  });
})();
