/* 13.1.1、13.1.3 节：平面速度约束画廊、q̇ = f(q,u) 的两种解读、Pfaffian 约束的可积与不可积、困在圆上 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;

  // ---------------------------------------------------------------
  // 组件：速度约束画廊（13.1.1 节的 8 个例子 + ẋ = x）
  // ---------------------------------------------------------------
  const CONS = {
    c1: { name: "1. ẋ > 0", tex: "ẋ > 0", eq: false },
    c2: { name: "2. ẋ ≥ 0", tex: "ẋ ≥ 0", eq: false },
    c3: { name: "3. ẋ > 0, ẏ > 0", tex: "ẋ > 0 且 ẏ > 0", eq: false },
    c4: { name: "4. ẋ = 0", tex: "ẋ = 0", eq: true },
    c5: { name: "5. aẋ + bẏ = 0", tex: "aẋ + bẏ = 0", eq: true },
    c6: { name: "6. aẋ + bẏ + c = 0", tex: "aẋ + bẏ + c = 0", eq: true },
    c7: { name: "7. ẋ² + ẏ² ≤ 1", tex: "ẋ² + ẏ² ≤ 1", eq: false },
    c8: { name: "8. ẋ² + ẏ² ≥ 1", tex: "ẋ² + ẏ² ≥ 1", eq: false },
    c9: { name: "ẋ = x（依赖 q）", tex: "ẋ = x", eq: true },
  };

  class VelocityGallery {
    constructor(root) {
      this.k = "c1"; this.a = 1; this.b = 1; this.c = 1;
      this.q0 = { x: 0.6, y: -0.4 }; this.v = { x: 1.0, y: 0.6 };
      this.curves = []; this.walk = null;
      this.rnd = C.rng(7);
      const body = C.frame(root, "速度约束画廊", "左：q 处的切空间 T_q(ℝ²)，拖动速度箭头；右：C-space，拖动起点 q₀");
      this.sel = C.select(Object.entries(CONS).map(([k, o]) => [k, o.name]), this.k, (k) => { this.k = k; this.curves = []; this.walk = null; this.snap(); this.update(); });
      this.sA = C.slider("a", -2, 2, 0.1, 1, (v) => { this.a = v; this.curves = []; this.snap(); this.update(); }, (v) => v.toFixed(1));
      this.sB = C.slider("b", -2, 2, 0.1, 1, (v) => { this.b = v; this.curves = []; this.snap(); this.update(); }, (v) => v.toFixed(1));
      this.sC = C.slider("c", -2, 2, 0.1, 1, (v) => { this.c = v; this.curves = []; this.snap(); this.update(); }, (v) => v.toFixed(1));
      this.abc = h("span", { class: "controls", style: "margin:0" }, this.sA, this.sB, this.sC);
      this.vel = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], maxW: 340, onDraw: (ctx, st, col) => this.drawVel(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.v.x, p.y - this.v.y) < 0.35 ? "v" : null),
        onMove: (p) => { this.v = { x: C.clamp(p.x, -2.1, 2.1), y: C.clamp(p.y, -2.1, 2.1) }; this.snap(); this.walk = null; this.update(); },
        cursor: (p) => (Math.hypot(p.x - this.v.x, p.y - this.v.y) < 0.35 ? "grab" : null) });
      this.cs = new C.Stage({ view: [-3, 3, -3, 3], maxW: 400, onDraw: (ctx, st, col) => this.drawCS(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.q0.x, p.y - this.q0.y) < 0.3 ? "q" : null),
        onMove: (p) => { this.q0 = { x: C.clamp(p.x, -2.9, 2.9), y: C.clamp(p.y, -2.9, 2.9) }; if (Math.abs(this.q0.x) < 0.08) this.q0.x = 0; this.curves = []; this.walk = null; this.snap(); this.update(); },
        cursor: (p) => (Math.hypot(p.x - this.q0.x, p.y - this.q0.y) < 0.3 ? "grab" : null) });
      this.msg = h("div", { class: "msg info" });
      this.stats = [C.stat("U(q) 的维数"), C.stat("能停下（0 ∈ U(q)）？"), C.stat("含 0 的开邻域？")];
      body.append(
        h("div", { class: "controls" }, h("label", null, "约束", this.sel), this.abc,
          C.button("撒 40 条随机积分曲线", () => this.scatter(), "primary"), C.button("沿箭头走 2 秒", () => this.go()), C.button("清空", () => { this.curves = []; this.walk = null; this.cs.draw(); })),
        h("div", { class: "split" },
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "速度空间（ẋ, ẏ）"), this.vel.wrap),
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "C = ℝ²：浅绿 = 从 q₀ 出发的可达集"), this.cs.wrap)),
        h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cva("ok", 0.35), "允许的速度 U(q)"], [C.cva("bad", 0.18), "被禁止的速度"], [C.cv("accent"), "选中的速度 / 沿它走的路径"], [C.cv("ok"), "随机积分曲线"]]));
      this.update();
    }
    // 速度 v 在 q 处是否允许（等式约束带容差）
    allowed(v, q, tol) {
      const e = tol || 1e-9, { a, b, c } = this;
      switch (this.k) {
        case "c1": return v.x > 1e-9;
        case "c2": return v.x >= -e;
        case "c3": return v.x > 1e-9 && v.y > 1e-9;
        case "c4": return Math.abs(v.x) <= e;
        case "c5": return Math.abs(a * v.x + b * v.y) <= e * Math.max(1e-9, Math.hypot(a, b));
        case "c6": return Math.abs(a * v.x + b * v.y + c) <= e * Math.max(1e-9, Math.hypot(a, b));
        case "c7": return v.x * v.x + v.y * v.y <= 1 + e;
        case "c8": return v.x * v.x + v.y * v.y >= 1 - e;
        case "c9": return Math.abs(v.x - q.x) <= e;
      }
    }
    // 等式约束：把箭头吸附到允许的直线上
    snap() {
      const { a, b, c } = this, v = this.v;
      const tol = 0.12;
      const proj = (n, d) => { const nn = n.x * n.x + n.y * n.y; if (nn < 1e-12) return; const r = (n.x * v.x + n.y * v.y + d) / Math.sqrt(nn); if (Math.abs(r) < tol) { v.x -= (r * n.x) / Math.sqrt(nn); v.y -= (r * n.y) / Math.sqrt(nn); } };
      if (this.k === "c4") proj({ x: 1, y: 0 }, 0);
      if (this.k === "c5") proj({ x: a, y: b }, 0);
      if (this.k === "c6") proj({ x: a, y: b }, c);
      if (this.k === "c9") proj({ x: 1, y: 0 }, -this.q0.x);
    }
    // 从 U(q) 中随机取一个速度（|v| ≤ 2）
    sample(q) {
      const r = this.rnd, U = () => r() * 4 - 2, { a, b, c } = this;
      const rej = (ok) => { for (let i = 0; i < 1000; i++) { const v = { x: U(), y: U() }; if (ok(v)) return v; } return { x: 0, y: 0 }; };
      const nab = Math.hypot(a, b) || 1;
      switch (this.k) {
        case "c1": return rej((v) => v.x > 0);
        case "c2": return r() < 0.2 ? { x: 0, y: U() } : rej((v) => v.x >= 0);
        case "c3": return rej((v) => v.x > 0 && v.y > 0);
        case "c4": return { x: 0, y: U() };
        case "c5": { const t = U(); return { x: (t * b) / nab, y: (-t * a) / nab }; }
        case "c6": { const t = U(); return { x: (-c * a) / (nab * nab) + (t * b) / nab, y: (-c * b) / (nab * nab) - (t * a) / nab }; }
        case "c7": return rej((v) => v.x * v.x + v.y * v.y <= 1);
        case "c8": return rej((v) => v.x * v.x + v.y * v.y >= 1);
        case "c9": return { x: q.x, y: U() };
      }
    }
    // 沿常速度（c9 时 ẋ = x）走 τ 秒，返回折线
    flow(q, v, tau) {
      const pts = [], n = 24;
      for (let i = 1; i <= n; i++) {
        const t = (tau * i) / n;
        pts.push(this.k === "c9" ? { x: q.x * Math.exp(t), y: q.y + v.y * t } : { x: q.x + v.x * t, y: q.y + v.y * t });
      }
      return pts;
    }
    scatter() {
      this.curves = [];
      for (let k = 0; k < 40; k++) {
        let q = { ...this.q0 }; const P = [q];
        const segs = 2 + Math.floor(this.rnd() * 4);
        for (let s = 0; s < segs; s++) {
          const v = this.sample(q), tau = 0.1 + this.rnd() * 0.5;
          const seg = this.flow(q, v, tau); P.push(...seg); q = seg[seg.length - 1];
        }
        this.curves.push(P);
      }
      this.cs.draw();
    }
    go() {
      if (!this.allowed(this.v, this.q0, 1e-6)) { this.msg.className = "msg bad"; this.msg.textContent = "这个速度不在 U(q₀) 里，不能这样走。先把箭头拖进绿色区域（等式约束会自动吸附到绿线上）。"; return; }
      this.walk = [this.q0, ...this.flow(this.q0, this.v, 2)];
      this.cs.draw();
    }
    // 可达集判据（相对起点 d）
    inReach(d) {
      const { a, b, c } = this, x0 = this.q0.x;
      switch (this.k) {
        case "c1": return d.x > 0;
        case "c2": return d.x >= 0;
        case "c3": return d.x > 0 && d.y > 0;
        case "c5": return a === 0 && b === 0;
        case "c6": return a === 0 && b === 0 ? c === 0 : c === 0 ? false : c * (a * d.x + b * d.y) < 0;
        case "c7": case "c8": return true;
        case "c9": return x0 > 0 ? d.x >= 0 : x0 < 0 ? d.x <= 0 : false;
        default: return false;
      }
    }
    update() {
      const cons = CONS[this.k], q = this.q0, { a, b, c } = this;
      this.abc.style.display = this.k === "c5" || this.k === "c6" ? "" : "none";
      this.sC.style.display = this.k === "c6" ? "" : "none";
      const dim = this.k === "c4" || this.k === "c5" || this.k === "c6" || this.k === "c9" ? 1 : 2;
      const stop = this.allowed({ x: 0, y: 0 }, q, 1e-9);
      const nbhd = this.k === "c7";
      const degenerate = (this.k === "c5" || this.k === "c6") && a === 0 && b === 0;
      this.stats[0].set(degenerate ? (this.k === "c6" && c !== 0 ? "空集" : "2") : String(dim));
      this.stats[1].set(stop ? "能" : "不能");
      this.stats[2].set(nbhd ? "是" : "否");
      const ok = this.allowed(this.v, q, 1e-6);
      const notes = {
        c1: "像在向 +x 方向流动的急流里划船：y 方向随便，但永远不能逆流。所有积分曲线都沿 x 单调增加。",
        c2: "允许停在 x 方向上：例如 (0,1) 让你以单位速度沿 +y 走。",
        c3: "积分曲线在 x、y 两个方向上都单调增加，只能到达右上方的象限。",
        c4: "U(q) 降成一维：只剩 (0, ẏ)。从 (x₀, y₀) 出发的积分曲线被困在竖直线 x = x₀ 上。",
        c5: "和例 4 本质一样，只是直线方向由 a、b 决定（a = b = 1 时只能沿斜线 ẋ = −ẏ 走）。",
        c6: "允许的速度是一条不过原点的直线：不能停下（ẋ = ẏ = 0 违反约束），却能到达一整个半平面。",
        c7: "第 8 章用过的约束：只限制最大速度，对「有没有解」毫无影响——U(q) 含有 0 的一个开邻域。",
        c8: "任何方向都行，但速度不能低于 1：不能停下，也不能慢下来。",
        c9: "约束依赖于 q：在 q = (x, y) 处只能取 ẋ = x。x 越大，x 方向的速度也越大；从 x₀ > 0 出发永远到不了 y 轴，而从 y 轴上出发就永远留在 y 轴上。",
      };
      this.msg.className = "msg " + (ok ? "ok" : "bad");
      this.msg.textContent = `${cons.tex}：选中的速度 (${this.v.x.toFixed(2)}, ${this.v.y.toFixed(2)}) ${ok ? "允许" : "被禁止"}。` + notes[this.k];
      this.vel.draw(); this.cs.draw();
    }
    drawVel(ctx, st, col) {
      st.frame(col);
      // 底色：逐格判定
      const okc = C.rgb(col.ok), badc = C.rgb(col.bad), eq = CONS[this.k].eq;
      st.raster((x, y) => (!eq && this.allowed({ x, y }, this.q0, 1e-9) ? [...okc, 80] : [...badc, 26]), 110);
      st.grid(col, 1);
      const { a, b, c } = this, L = 3;
      const lineThrough = (p, d) => { const n = Math.hypot(d.x, d.y) || 1; st.line({ x: p.x - (L * d.x) / n, y: p.y - (L * d.y) / n }, { x: p.x + (L * d.x) / n, y: p.y + (L * d.y) / n }, col.ok, 4); };
      if (this.k === "c4") lineThrough({ x: 0, y: 0 }, { x: 0, y: 1 });
      if (this.k === "c5") { if (a || b) lineThrough({ x: 0, y: 0 }, { x: b, y: -a }); }
      if (this.k === "c6") { const nn = a * a + b * b; if (nn > 0) lineThrough({ x: (-c * a) / nn, y: (-c * b) / nn }, { x: b, y: -a }); }
      if (this.k === "c9") lineThrough({ x: this.q0.x, y: 0 }, { x: 0, y: 1 });
      if (this.k === "c7" || this.k === "c8") st.circle({ x: 0, y: 0 }, 1, col.ok, 1.6);
      st.dot({ x: 0, y: 0 }, 4, col.text);
      st.text("0", { x: 0, y: 0 }, col.text, { dx: -9, dy: 10, size: 11 });
      const ok = this.allowed(this.v, this.q0, 1e-6);
      st.arrow({ x: 0, y: 0 }, this.v, ok ? col.accent : col.bad, 2.6, 11);
      st.dot(this.v, 7, ok ? col.accent : col.bad, col.surface, 2);
      st.text("ẋ", { x: 2.05, y: 0 }, col.muted, { dy: -10, size: 12, weight: 650 });
      st.text("ẏ", { x: 0, y: 2.05 }, col.muted, { dx: 10, size: 12, weight: 650 });
    }
    drawCS(ctx, st, col) {
      st.frame(col);
      const q = this.q0, okc = C.rgb(col.ok);
      st.raster((x, y) => (this.inReach({ x: x - q.x, y: y - q.y }) ? [...okc, 48] : null), 120);
      st.grid(col, 1);
      // 一维的可达集画成粗线
      const { a, b, c } = this;
      const reachLine = (d) => { const n = Math.hypot(d.x, d.y) || 1; st.line({ x: q.x - (9 * d.x) / n, y: q.y - (9 * d.y) / n }, { x: q.x + (9 * d.x) / n, y: q.y + (9 * d.y) / n }, C.alpha(col.ok, 0.45), 6); };
      if (this.k === "c4" || (this.k === "c9" && q.x === 0)) reachLine({ x: 0, y: 1 });
      if (this.k === "c5" && (a || b)) reachLine({ x: b, y: -a });
      if (this.k === "c6" && c === 0 && (a || b)) reachLine({ x: b, y: -a });
      for (const P of this.curves) st.path(P, C.alpha(col.ok, 0.75), 1.2);
      for (const P of this.curves) st.dot(P[P.length - 1], 2.2, col.ok);
      if (this.walk) { st.path(this.walk, col.accent, 2.6); st.dot(this.walk[this.walk.length - 1], 4, col.accent); }
      st.dot(q, 7, col.accent, col.surface, 2);
      st.text("q₀", q, col.accent, { dy: -15, weight: 700 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 13.1 的两种解读（ẋ = u，ẏ = x）
  // ---------------------------------------------------------------
  class TwoInterp {
    constructor(root) {
      this.q = { x: 1, y: 2 }; this.u = 0.6; this.curves = [];
      const body = C.frame(root, "q̇ = f(q, u) 的两种解读", "例 13.1：ẋ = u，ẏ = x。拖动 q；在右图点击放一条积分曲线");
      const view = [-2.4, 2.4, -1, 3.8];
      this.L = new C.Stage({ view, maxW: 380, aspect: 1, onDraw: (ctx, st, col) => this.drawL(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.q.x, p.y - this.q.y) < 0.3 ? "q" : null),
        onMove: (p) => { this.q = { x: C.clamp(p.x, -2.3, 2.3), y: C.clamp(p.y, -0.9, 3.7) }; this.update(); },
        cursor: (p) => (Math.hypot(p.x - this.q.x, p.y - this.q.y) < 0.3 ? "grab" : null) });
      this.R = new C.Stage({ view, maxW: 380, aspect: 1, onDraw: (ctx, st, col) => this.drawR(ctx, st, col),
        onDown: (p) => { if (Math.hypot(p.x - this.q.x, p.y - this.q.y) < 0.3) return "q"; this.curves.push({ ...p }); if (this.curves.length > 8) this.curves.shift(); this.R.draw(); return null; },
        onMove: (p) => { this.q = { x: C.clamp(p.x, -2.3, 2.3), y: C.clamp(p.y, -0.9, 3.7) }; this.update(); },
        cursor: (p) => (Math.hypot(p.x - this.q.x, p.y - this.q.y) < 0.3 ? "grab" : "crosshair") });
      this.sU = C.slider("u =", -2, 2, 0.05, this.u, (v) => { this.u = v; this.update(); }, (v) => v.toFixed(2));
      this.info = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sU, C.button("q = (1, 2)", () => { this.q = { x: 1, y: 2 }; this.update(); }), C.button("清空积分曲线", () => { this.curves = []; this.R.draw(); })),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" },
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "① 固定 q：U(q) 是切空间里的一条直线"), this.L.wrap),
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "② 固定 u：f(·, u) 是 ℝ² 上的向量场"), this.R.wrap)),
        this.info,
        C.legend([[C.cv("ok"), "U(q) = {(u, x)}：所有 u 给出的速度"], [C.cv("warn"), "当前 u 给出的速度"], [C.cv("accent"), "积分曲线（抛物线）"]]));
      this.update();
    }
    update() {
      const { q, u } = this;
      this.info.innerHTML = `在 q = (${q.x.toFixed(2)}, ${q.y.toFixed(2)})：允许的速度集合是 {(ẋ, ẏ) | ẏ = ${q.x.toFixed(2)}}（式 13.3），u 只决定水平分量。当前 u = ${u.toFixed(2)} 给出 q̇ = (${u.toFixed(2)}, ${q.x.toFixed(2)})——左图的橙色箭头和右图 q 处的向量是同一个。`;
      this.L.draw(); this.R.draw();
    }
    drawL(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const { q } = this, s = 0.55;
      for (let u = -2; u <= 2.001; u += 0.5) st.arrow(q, { x: q.x + s * u, y: q.y + s * q.x }, C.alpha(col.ok, 0.75), 1.3, 7);
      st.line({ x: q.x - 3 * s, y: q.y + s * q.x }, { x: q.x + 3 * s, y: q.y + s * q.x }, col.ok, 2.6);
      st.arrow(q, { x: q.x + s * this.u, y: q.y + s * q.x }, col.warn, 2.8, 11);
      st.dot(q, 7, col.accent, col.surface, 2);
      st.text("q", q, col.accent, { dx: -12, dy: 12, weight: 700 });
      st.text("ẏ = x 的直线", { x: q.x + 1.6 * s, y: q.y + s * q.x }, col.ok, { dy: -10, size: 11 });
    }
    drawR(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const u = this.u;
      st.needles((p) => ({ x: u, y: p.x }), col, C.alpha(col.muted, 0.9), 13, 0.75);
      // 积分曲线：x(t) = x0 + u t，y(t) = y0 + x0 t + u t²/2
      for (const p0 of this.curves) {
        const P = [];
        for (let t = -6; t <= 6; t += 0.02) P.push({ x: p0.x + u * t, y: p0.y + p0.x * t + (u * t * t) / 2 });
        st.path(P, col.accent, 1.8); st.dot(p0, 3.5, col.accent);
      }
      const { q } = this;
      st.arrow(q, { x: q.x + 0.55 * u, y: q.y + 0.55 * q.x }, col.warn, 2.8, 11);
      st.dot(q, 7, col.accent, col.surface, 2);
      st.text("q", q, col.accent, { dx: -12, dy: 12, weight: 700 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：Pfaffian 约束 (13.7) 与 (13.9)：允许速度的平面族、方形回路
  // ---------------------------------------------------------------
  class Pfaffian3D {
    constructor(root) {
      this.k = "13.9"; this.tau = 0.6; this.path = []; this.q = [0, 0, 0]; this.anim = null;
      const body = C.frame(root, "Pfaffian 约束：允许速度构成的平面族", "拖动画面旋转；绿色小片 = 各点处允许速度张成的平面");
      this.v = new C.View3D({ R: 2.3, az: -0.75, el: 0.42, maxW: 470, aspect: 0.82, onDraw: (ctx, V, col) => this.draw(ctx, V, col) });
      this.segK = C.seg([["13.7", "(13.7) 2q̇₁ − q̇₂ − q̇₃ = 0"], ["13.9", "(13.9) cos q₃ q̇₁ − sin q₃ q̇₂ − q̇₃ = 0"]], this.k, (k) => { this.k = k; this.reset(); });
      this.sT = C.slider("回路边长 τ", 0.1, 1.2, 0.05, this.tau, (v) => { this.tau = v; }, (v) => v.toFixed(2));
      this.stats = [C.stat("当前 q"), C.stat("回路净位移 Δq"), C.stat("q₃ − (2q₁ − q₂)")];
      this.runner = new C.Runner(root, (dt) => this.stepAnim(dt));
      body.append(h("div", { class: "controls" }, this.segK),
        h("div", { class: "controls" }, this.sT, C.button("走方形回路 u₁, u₂, −u₁, −u₂", () => this.loop(), "primary"), C.button("随机驾驶 6 秒", () => this.random()), C.button("回到原点", () => this.reset())),
        h("div", { class: "split" }, this.v.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.note = h("p", { class: "small" }),
          C.legend([[C.cva("ok", 0.45), "允许速度张成的平面（每点一片）"], [C.cv("accent"), "实际走过的路径"], [C.cv("warn"), "当前动作 q̇ = u₁g₁ + u₂g₂"]]))));
      this.reset();
    }
    f(q, u1, u2) { return this.k === "13.7" ? [u1, u2, 2 * u1 - u2] : [u1, u2, Math.cos(q[2]) * u1 - Math.sin(q[2]) * u2]; }
    basis(q) {
      const g1 = this.f(q, 1, 0), g2 = this.f(q, 0, 1);
      const e1 = C.v3.unit(g1), e2 = C.v3.unit(C.v3.sub(g2, C.v3.mul(e1, C.v3.dot(e1, g2))));
      return [e1, e2];
    }
    reset() { this.runner.stop(); this.q = [0, 0, 0]; this.path = [[0, 0, 0]]; this.cmd = null; this.lastLoop = null; this.update(); }
    // 动画：依次执行一列 (u1, u2, 时长)
    play(seq) { this.queue = seq.map((s) => ({ ...s })); this.cmd = null; this.runner.start(); }
    loop() { this.q = [0, 0, 0]; this.path = [[0, 0, 0]]; this.loopStart = [0, 0, 0]; this.lastLoop = "running"; const t = this.tau; this.play([{ u1: 1, u2: 0, T: t }, { u1: 0, u2: 1, T: t }, { u1: -1, u2: 0, T: t }, { u1: 0, u2: -1, T: t }]); }
    random() {
      const r = C.rng(Math.floor(Math.random() * 1e9)); const seq = [];
      for (let i = 0; i < 12; i++) seq.push({ u1: r() * 2 - 1, u2: r() * 2 - 1, T: 0.5 });
      this.lastLoop = null; this.play(seq);
    }
    stepAnim(dt) {
      let left = dt * 1.2;
      while (left > 0) {
        if (!this.cmd) { this.cmd = this.queue.shift(); if (!this.cmd) { if (this.lastLoop === "running") this.lastLoop = C.v3.sub(this.q, this.loopStart); this.update(); return false; } }
        const h_ = Math.min(left, this.cmd.T, 0.01);
        this.q = C.rk4((x) => this.f(x, this.cmd.u1, this.cmd.u2), this.q, h_);
        this.cmd.T -= h_; left -= h_;
        if (this.cmd.T <= 1e-12) this.cmd = null;
      }
      this.path.push(this.q.slice());
      this.update();
      return true;
    }
    update() {
      const q = this.q, f = (x) => x.toFixed(3);
      this.stats[0].set(`(${f(q[0])}, ${f(q[1])}, ${f(q[2])})`);
      this.stats[1].set(Array.isArray(this.lastLoop) ? `(${this.lastLoop.map((x) => (Math.abs(x) < 5e-4 ? "0" : x.toFixed(3))).join(", ")})` : "–");
      this.stats[2].set(f(q[2] - (2 * q[0] - q[1])));
      this.note.innerHTML = this.k === "13.7"
        ? "(13.7) 的系数是常数：每一点允许的平面都<b>平行</b>。从原点出发的任何路径都落在平面 q₃ = 2q₁ − q₂ 上（右侧第三个数始终是 0）——方形回路回到原点。这就是 13.1.3 节说的<b>完全可积</b>：约束等价于 h(q) = q₃ − 2q₁ + q₂ = 常数。"
        : "(13.9) 的平面随 q₃ <b>扭转</b>。方形回路回不到原点：走完 u₁、u₂、−u₁、−u₂ 后 q₃ 净变化约 −τ²（τ 越小越准；参考代码第 2 项）。只靠两个动作就能在 q₃ 方向挪动——约束<b>不可积</b>，即非完整 nonholonomic。<span class='muted'>（补充：这个净位移正是 Lie 括号 [g₁, g₂] = (0, 0, −1) 的方向，15.4 节会系统地讲。）</span>";
      this.v.draw();
    }
    draw(ctx, V, col) {
      V.st.frame(col);
      V.axes(1.8, col, ["q₁", "q₂", "q₃"]);
      // 平面小片：按深度排序
      const pts = [], g = [-1.2, -0.4, 0.4, 1.2];
      for (const a of g) for (const b of g) for (const c of [-1, 0, 1]) pts.push([a, b, c]);
      const items = pts.map((p) => ({ p, d: V.proj(p).z })).sort((A, B) => A.d - B.d);
      for (const { p } of items) {
        const [e1, e2] = this.basis(p), s = 0.22;
        const P = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => C.v3.add(p, C.v3.add(C.v3.mul(e1, a * s), C.v3.mul(e2, b * s))));
        V.poly(P, C.alpha(col.ok, 0.28), C.alpha(col.ok, 0.7), 1);
      }
      V.path(this.path, col.accent, 2.4);
      if (this.cmd) { const v = this.f(this.q, this.cmd.u1, this.cmd.u2); V.arrow(this.q, C.v3.add(this.q, C.v3.mul(v, 0.5)), col.warn, 2.4, 9); }
      V.dot([0, 0, 0], 4, col.text);
      V.dot(this.q, 6, col.accent, col.surface, 2);
    }
  }

  // ---------------------------------------------------------------
  // 组件：困在圆上（13.22）–（13.25）
  // ---------------------------------------------------------------
  class Trapped {
    constructor(root) {
      this.p0 = { x: 1.2, y: 0.9 }; this.mode = "rand"; this.x = [1.2, 0.9]; this.t = 0; this.trace = []; this.hs = [];
      this.rnd = C.rng(22);
      const body = C.frame(root, "困在圆上：ẋ = yu，ẏ = −xu", "拖动起点；选一种 u(t) 再播放");
      this.st = new C.Stage({ view: [-2.4, 2.4, -2.4, 2.4], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.x[0], p.y - this.x[1]) < 0.3 ? "p" : null),
        onMove: (p) => { this.runner.stop(); this.x = [C.clamp(p.x, -2.3, 2.3), C.clamp(p.y, -2.3, 2.3)]; this.p0 = { x: this.x[0], y: this.x[1] }; this.t = 0; this.trace = []; this.hs = []; this.update(); },
        cursor: (p) => (Math.hypot(p.x - this.x[0], p.y - this.x[1]) < 0.3 ? "grab" : null) });
      this.plot = new C.TimePlot({ aspect: 0.5, maxW: 340, ylabel: "h(x,y) = x² + y² − r²", yrange: [-0.05, 0.05] });
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => this.btn.textContent = "▶ 播放");
      this.btn = C.button("▶ 播放", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 播放"; }, "primary");
      this.segU = C.seg([["pos", "u = +1"], ["neg", "u = −1"], ["sin", "u = 2 sin 1.3t"], ["rand", "u 随机跳"]], this.mode, (k) => { this.mode = k; });
      this.stats = [C.stat("t"), C.stat("u(t)"), C.stat("x² + y²"), C.stat("r₀² = x₀² + y₀²")];
      body.append(h("div", { class: "controls" }, this.segU, this.btn),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, this.stats), this.plot.wrap,
          h("p", { class: "small" }, "无论 u(t) 怎样变化，状态都被困在过起点、以原点为圆心的圆上；h 始终是 0。允许的速度只有切向 (y, −x) 的倍数（绿），径向（红）永远被禁止。"),
          C.legend([[C.cv("ok"), "允许的速度方向"], [C.cv("bad"), "被禁止的方向（径向）"], [C.cv("accent"), "实际轨迹"]]))));
      this.update();
    }
    u() { const t = this.t; return this.mode === "pos" ? 1 : this.mode === "neg" ? -1 : this.mode === "sin" ? 2 * Math.sin(1.3 * t) : this.ucur; }
    step(dt) {
      for (let k = 0; k < 4; k++) {
        const h_ = dt / 4;
        if (this.mode === "rand" && (this.ucur === undefined || this.rnd() < h_ * 2.5)) this.ucur = (this.rnd() * 2 - 1) * 2.2;
        const u = this.u();
        this.x = C.rk4((s) => [s[1] * u, -s[0] * u], this.x, h_);
        this.t += h_;
      }
      this.trace.push({ x: this.x[0], y: this.x[1] }); if (this.trace.length > 600) this.trace.shift();
      const r0 = this.p0.x ** 2 + this.p0.y ** 2;
      this.hs.push([this.t, this.x[0] ** 2 + this.x[1] ** 2 - r0]); if (this.hs.length > 600) this.hs.shift();
      this.update();
      return true;
    }
    update() {
      const r2 = this.x[0] ** 2 + this.x[1] ** 2, r0 = this.p0.x ** 2 + this.p0.y ** 2;
      this.stats[0].set(this.t.toFixed(2)); this.stats[1].set(this.t ? this.u().toFixed(2) : "–");
      this.stats[2].set(r2.toFixed(6)); this.stats[3].set(r0.toFixed(6));
      this.plot.set([{ data: this.hs, color: "accent" }], this.hs.length ? [this.hs[0][0], Math.max(this.hs[0][0] + 1, this.t)] : [0, 1]);
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      st.needles((p) => ({ x: p.y, y: -p.x }), col, C.alpha(col.muted, 0.7), 12, 0.7);
      const r0 = Math.hypot(this.p0.x, this.p0.y);
      st.circle({ x: 0, y: 0 }, r0, C.alpha(col.ok, 0.6), 1.5, [5, 4]);
      st.path(this.trace, col.accent, 2.2);
      const p = { x: this.x[0], y: this.x[1] }, n = Math.hypot(p.x, p.y) || 1;
      st.line({ x: p.x - (0.8 * p.y) / n, y: p.y + (0.8 * p.x) / n }, { x: p.x + (0.8 * p.y) / n, y: p.y - (0.8 * p.x) / n }, col.ok, 3);
      st.arrow(p, { x: p.x + (0.6 * p.x) / n, y: p.y + (0.6 * p.y) / n }, col.bad, 2, 8);
      st.text("✕", { x: p.x + (0.7 * p.x) / n, y: p.y + (0.7 * p.y) / n }, col.bad, { size: 13, weight: 700 });
      st.dot(p, 7, col.accent, col.surface, 2);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='velocity-gallery']").forEach((el) => el._w = new VelocityGallery(el));
    document.querySelectorAll("[data-widget='two-interp']").forEach((el) => el._w = new TwoInterp(el));
    document.querySelectorAll("[data-widget='pfaffian-3d']").forEach((el) => el._w = new Pfaffian3D(el));
    document.querySelectorAll("[data-widget='trapped']").forEach((el) => el._w = new Trapped(el));
  });
})();
