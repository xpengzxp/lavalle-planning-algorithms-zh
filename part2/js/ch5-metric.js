/* 5.1 节：Lp 度量、SO(2) 度量与等同、机器人位移度量、球面 / SO(3) 上的均匀采样 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH5;

  // ---------------------------------------------------------------
  // 组件：Lp 度量（式 5.1、5.2）——过同一点 b 的三种「球」
  // ---------------------------------------------------------------
  class LpMetric {
    constructor(root) {
      this.a = { x: -0.7, y: -0.5 }; this.b = { x: 0.5, y: 0.6 }; this.p = 3;
      this.show = { l1: true, l2: true, linf: true, lp: true };
      const body = C.frame(root, "Lp 度量", "拖动 a、b；三种「球」都经过 b：ρ(a,x) = ρ(a,b)");
      this.st = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], maxW: 440, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.a) < 0.18 ? "a" : C.dist(p, this.b) < 0.18 ? "b" : null),
        onMove: (p, d) => { this[d].x = Math.max(-2.1, Math.min(2.1, p.x)); this[d].y = Math.max(-2.1, Math.min(2.1, p.y)); this.update(); },
        cursor: (p) => (C.dist(p, this.a) < 0.18 || C.dist(p, this.b) < 0.18 ? "grab" : null) });
      this.sP = C.slider("p =", 1, 11, 0.1, 3, (v) => { this.p = v; this.update(); }, (v) => (v > 10.5 ? "∞" : v.toFixed(1)));
      const toggles = h("div", { class: "chips" });
      [["l1", "L1 曼哈顿"], ["l2", "L2 欧氏"], ["linf", "L∞"], ["lp", "自选 p"]].forEach(([k, t]) => {
        const b = h("button", { type: "button", class: "chip on" }, t);
        b.addEventListener("click", () => { this.show[k] = !this.show[k]; b.classList.toggle("on", this.show[k]); this.st.draw(); });
        toggles.append(b);
      });
      this.stats = [C.stat("L1"), C.stat("L2"), C.stat("L∞"), C.stat("Lp")];
      const col = C.colors(root);
      body.append(h("div", { class: "controls" }, toggles, this.sP),
        h("div", { class: "split" }, this.st.wrap,
          h("div", null, h("div", { class: "stats" }, this.stats),
            h("p", { class: "small" }, "绿色折线是 L1 的「走街区」路径：先东西、再南北，长度 = |Δx| + |Δy|。"),
            h("p", { class: "small muted", html: "恒有 L∞ ≤ L2 ≤ L1；p 越大，(5.1) 中最大的那一项越占主导，Lp 越接近 L∞。" }),
            C.legend([[C.cv("ok"), "L1 球（菱形）"], [C.cv("accent"), "L2 球（圆）"], [C.cv("warn"), "L∞ 球（正方形）"], [C.cv("alive2"), "自选 p 的球"]]))));
      this.update();
    }
    lp(a, b, p) { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); return p > 10.5 ? Math.max(dx, dy) : Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p); }
    update() {
      const { a, b } = this;
      this.stats[0].set(this.lp(a, b, 1).toFixed(3)); this.stats[1].set(this.lp(a, b, 2).toFixed(3));
      this.stats[2].set(this.lp(a, b, 99).toFixed(3)); this.stats[3].set(this.lp(a, b, this.p).toFixed(3));
      this.stats[3].querySelector(".k").textContent = this.p > 10.5 ? "L∞（p→∞）" : `L${this.p.toFixed(1)}`;
      this.st.draw();
    }
    ball(st, c, r, p, color, lw) {
      const ctx = st.ctx; ctx.beginPath();
      if (p > 10.5) { ctx.rect(st.X(c.x - r), st.Y(c.y + r), 2 * r * st.scale, 2 * r * st.scale); }
      else {
        for (let i = 0; i <= 240; i++) {
          const t = (i / 240) * 2 * Math.PI, ct = Math.cos(t), sn = Math.sin(t);
          const x = c.x + r * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / p), y = c.y + r * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p);
          i ? ctx.lineTo(st.X(x), st.Y(y)) : ctx.moveTo(st.X(x), st.Y(y));
        }
        ctx.closePath();
      }
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    }
    draw(ctx, st, col) {
      st.frame(col);
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
      for (let g = -2; g <= 2; g += 0.5) { st.line({ x: g, y: -2.2 }, { x: g, y: 2.2 }, col.grid, g === 0 ? 1.5 : 0.7); st.line({ x: -2.2, y: g }, { x: 2.2, y: g }, col.grid, g === 0 ? 1.5 : 0.7); }
      const { a, b } = this;
      if (this.show.l1) this.ball(st, a, this.lp(a, b, 1), 1, col.ok, 1.8);
      if (this.show.l2) this.ball(st, a, this.lp(a, b, 2), 2, col.accent, 1.8);
      if (this.show.linf) this.ball(st, a, this.lp(a, b, 99), 99, col.warn, 1.8);
      if (this.show.lp) this.ball(st, a, this.lp(a, b, this.p), this.p, col.alive2, 2.6);
      st.line(a, { x: b.x, y: a.y }, col.ok, 2.5, [6, 4]); st.line({ x: b.x, y: a.y }, b, col.ok, 2.5, [6, 4]);
      st.line(a, b, col.accent, 1.5);
      st.dot(a, 7, col.text, col.surface, 2); st.text("a", a, col.text, { dx: -12, dy: 12, weight: 700 });
      st.dot(b, 7, col.current, col.surface, 2); st.text("b", b, col.current, { dx: 12, dy: -12, weight: 700 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：SO(2) 的三种度量（式 5.6–5.8）与「对径点等同」（式 5.9、5.11 的一维类比）
  // ---------------------------------------------------------------
  class SO2Metric {
    constructor(root) {
      this.t1 = (20 * Math.PI) / 180; this.t2 = (320 * Math.PI) / 180; this.anti = false;
      const body = C.frame(root, "SO(2) 上的距离", "拖动圆上的两个点 θ₁、θ₂");
      const L = 1.75, R = 4.75;
      this.lineX = [L, R];
      this.st = new C.Stage({ view: [-1.35, 5.0, -1.35, 1.35], aspect: 0.43, maxW: 820,
        onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.pick(p), onMove: (p, d) => this.move(p, d), cursor: (p) => (this.pick(p) ? "grab" : null) });
      this.sw = C.seg([["so2", "SO(2)：θ ∈ [0,2π]/∼"], ["anti", "再把对径点等同：h ∼ −h"]], "so2", (k) => { this.anti = k === "anti"; this.update(); });
      this.stats = [C.stat("天真的 |θ₁−θ₂|"), C.stat("(5.7) 沿圆周"), C.stat("(5.6) 弦长"), C.stat("对径等同后")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sw), this.st.wrap, h("div", { class: "stats" }, this.stats), this.note);
      this.update();
    }
    pt(t) { return { x: Math.cos(t), y: Math.sin(t) }; }
    pick(p) {
      if (C.dist(p, this.pt(this.t1)) < 0.2) return "t1";
      if (C.dist(p, this.pt(this.t2)) < 0.2) return "t2";
      const [L, R] = this.lineX;
      for (const k of ["t1", "t2"]) { const x = L + (this[k] / (2 * Math.PI)) * (R - L); if (Math.abs(p.x - x) < 0.15 && Math.abs(p.y) < 0.3) return k + "L"; }
      return null;
    }
    move(p, d) {
      if (d.endsWith("L")) { const [L, R] = this.lineX; this[d.slice(0, 2)] = Math.max(0, Math.min(0.9999, (p.x - L) / (R - L))) * 2 * Math.PI; }
      else { let t = Math.atan2(p.y, p.x); if (t < 0) t += 2 * Math.PI; this[d] = t; }
      this.update();
    }
    update() {
      const deg = (r) => ((r * 180) / Math.PI).toFixed(1) + "°";
      const d = Math.abs(this.t1 - this.t2), m = Math.min(d, 2 * Math.PI - d);
      const p1 = this.pt(this.t1), p2 = this.pt(this.t2), chord = C.dist(p1, p2);
      this.stats[0].set(deg(d)); this.stats[1].set(deg(m)); this.stats[2].set(chord.toFixed(3));
      const p2n = { x: -p2.x, y: -p2.y }, chordA = Math.min(chord, C.dist(p1, p2n)), arcA = Math.min(m, Math.PI - m);
      this.stats[3].set(this.anti ? `${deg(arcA)} · 弦 ${chordA.toFixed(3)}` : "—");
      this.note.innerHTML = this.anti
        ? "现在 h 和 −h（虚线点）代表同一个元素，就像单位四元数 h 与 −h 是同一个三维旋转。所以距离要对「到 h₂」和「到 −h₂」取 min：弦长版本是式 (5.9) 的类比，沿圆周版本是式 (5.11) 的类比。注意等同后两点间的最大距离只有 90°。"
        : `直接比较角度会出错：θ₁ = ${deg(this.t1)}、θ₂ = ${deg(this.t2)} 时，|θ₁−θ₂| = ${deg(d)}，但沿圆周走另一边只要 ${deg(2 * Math.PI - d)}。式 (5.7) 用 min 处理 0 ∼ 2π 的等同。弦长 (5.6) 抄了「穿过圆内部」的近路，所以和弧长不成正比。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      const p1 = this.pt(this.t1), p2 = this.pt(this.t2);
      // 圆
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), st.scale, 0, 2 * Math.PI); ctx.strokeStyle = col.strong; ctx.lineWidth = 2; ctx.stroke();
      // 较短的弧
      let a1 = this.t1, a2 = this.t2; let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), st.scale, -a1, -(a1 + d), d > 0); ctx.strokeStyle = col.ok; ctx.lineWidth = 5; ctx.stroke();
      st.line(p1, p2, col.warn, 2, [5, 4]);
      if (this.anti) {
        const q = { x: -p2.x, y: -p2.y };
        st.dot(q, 7, null, col.goal, 2); st.text("−h₂", q, col.goal, { dx: 18, dy: 0 });
        st.line({ x: 0, y: 0 }, p2, col.goal, 1, [3, 3]); st.line({ x: 0, y: 0 }, q, col.goal, 1, [3, 3]);
        const near = C.dist(p1, q) < C.dist(p1, p2) ? q : p2;
        st.line(p1, near, col.current, 2.5);
      }
      st.dot({ x: 0, y: 0 }, 2.5, col.muted);
      st.dot(p1, 8, col.start, col.surface, 2); st.text(this.anti ? "h₁" : "θ₁", p1, col.start, { dx: 16 * Math.cos(this.t1) + 4, dy: -16 * Math.sin(this.t1), weight: 700 });
      st.dot(p2, 8, col.goal, col.surface, 2); st.text(this.anti ? "h₂" : "θ₂", p2, col.goal, { dx: 16 * Math.cos(this.t2) + 4, dy: -16 * Math.sin(this.t2), weight: 700 });
      // 展开成区间 [0, 2π)，两端等同
      const [L, R] = this.lineX, X = (t) => L + (t / (2 * Math.PI)) * (R - L);
      st.line({ x: L, y: 0 }, { x: R, y: 0 }, col.strong, 2);
      st.text("0", { x: L, y: 0 }, col.muted, { dy: 16 }); st.text("2π", { x: R, y: 0 }, col.muted, { dy: 16 });
      st.text("0 与 2π 是同一点", { x: (L + R) / 2, y: -0.75 }, col.muted, { size: 11.5 });
      ctx.beginPath(); ctx.moveTo(st.X(L), st.Y(-0.12)); ctx.quadraticCurveTo(st.X((L + R) / 2), st.Y(-0.55), st.X(R), st.Y(-0.12));
      ctx.strokeStyle = col.muted; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const x1 = X(this.t1), x2 = X(this.t2), lo = Math.min(x1, x2), hi = Math.max(x1, x2);
      const direct = Math.abs(this.t1 - this.t2) <= Math.PI;
      st.line({ x: lo, y: 0.28 }, { x: hi, y: 0.28 }, direct ? col.ok : col.muted, direct ? 5 : 2);
      st.line({ x: L, y: 0.42 }, { x: lo, y: 0.42 }, direct ? col.muted : col.ok, direct ? 2 : 5);
      st.line({ x: hi, y: 0.42 }, { x: R, y: 0.42 }, direct ? col.muted : col.ok, direct ? 2 : 5);
      st.text(direct ? "直接走更短" : "绕过 0 ∼ 2π 更短", { x: (L + R) / 2, y: 0.72 }, col.ok, { size: 12, weight: 650 });
      st.dot({ x: x1, y: 0 }, 7, col.start, col.surface, 2); st.dot({ x: x2, y: 0 }, 7, col.goal, col.surface, 2);
    }
  }

  // ---------------------------------------------------------------
  // 组件：SE(2) 的单位不相容（例 5.5）、机器人位移度量（例 5.6）与位移上界（式 5.30、5.31）
  // ---------------------------------------------------------------
  const ROBOT = [{ x: -0.3, y: -0.25 }, { x: 1.3, y: -0.25 }, { x: 1.3, y: 0.15 }, { x: 0.25, y: 0.15 }, { x: 0.25, y: 0.75 }, { x: -0.3, y: 0.75 }];
  class Displacement {
    constructor(root) {
      this.q1 = { x: 1.2, y: 1.0, t: 0 }; this.q2 = { x: 2.6, y: 1.4, t: 0.7 };
      this.c2 = 1; this.unit = "rad";
      const body = C.frame(root, "SE(2) 上该用什么距离？", "拖动红色机器人平移；拖它身上的圆点旋转");
      this.st = new C.Stage({ view: [-0.4, 4.6, -0.6, 3.0], aspect: 0.72, maxW: 560, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.pick(p), onMove: (p, d) => this.move(p, d), cursor: (p) => (this.pick(p) ? "grab" : null) });
      this.sw = C.seg([["rad", "θ 用弧度"], ["deg", "θ 用角度"]], "rad", (k) => { this.unit = k; this.update(); });
      this.sC = C.slider("c₂ =", 0.1, 3, 0.1, 1, (v) => { this.c2 = v; this.update(); }, (v) => v.toFixed(1));
      this.stats = [C.stat("(5.4) ‖Δt‖ + c₂|Δθ|"), C.stat("(5.12) 位移度量"), C.stat("(5.31) 上界 |Δx|+|Δy|+r|Δθ|"), C.stat("r（最远点半径）")];
      this.note = h("p", { class: "small" });
      const col = C.colors(root);
      body.append(h("div", { class: "controls" }, this.sw, this.sC, C.button("只旋转", () => { this.q2 = { x: this.q1.x, y: this.q1.y, t: 1.2 }; this.update(); }, "small"),
        C.button("只平移", () => { this.q2 = { x: this.q1.x + 1.6, y: this.q1.y + 0.5, t: this.q1.t }; this.update(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.note,
        C.legend([[C.cva("dead", 0.6), "A(q₁)（固定）"], [C.cva("bad", 0.5), "A(q₂)"], [C.cv("warn"), "位移最大的那个点"], [C.cv("accent"), "a_r：离旋转中心最远的点"]]));
      this.update();
    }
    tf(q, a) { const c = Math.cos(q.t), s = Math.sin(q.t); return { x: q.x + c * a.x - s * a.y, y: q.y + s * a.x + c * a.y }; }
    handle() { return this.tf(this.q2, { x: 1.1, y: -0.05 }); }
    pick(p) {
      if (C.dist(p, this.handle()) < 0.16) return "rot";
      const body = ROBOT.map((a) => this.tf(this.q2, a));
      if (C.inPoly(p, body)) return { kind: "move", dx: p.x - this.q2.x, dy: p.y - this.q2.y };
      return null;
    }
    move(p, d) {
      if (d === "rot") this.q2.t = Math.atan2(p.y - this.q2.y, p.x - this.q2.x) + Math.atan2(0.05, 1.1);
      else { this.q2.x = Math.max(0, Math.min(4.2, p.x - d.dx)); this.q2.y = Math.max(-0.2, Math.min(2.6, p.y - d.dy)); }
      this.update();
    }
    update() {
      let dth = this.q2.t - this.q1.t; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      this.dth = dth;
      const dt = Math.hypot(this.q2.x - this.q1.x, this.q2.y - this.q1.y);
      const ang = this.unit === "rad" ? Math.abs(dth) : (Math.abs(dth) * 180) / Math.PI;
      const m54 = dt + this.c2 * ang;
      let best = -1, bi = 0;
      ROBOT.forEach((a, i) => { const d = C.dist(this.tf(this.q1, a), this.tf(this.q2, a)); if (d > best) { best = d; bi = i; } });
      this.maxI = bi;
      const r = Math.max(...ROBOT.map((a) => Math.hypot(a.x, a.y)));
      this.rI = ROBOT.findIndex((a) => Math.hypot(a.x, a.y) === r);
      const bound = Math.abs(this.q2.x - this.q1.x) + Math.abs(this.q2.y - this.q1.y) + r * Math.abs(dth);
      this.stats[0].set(m54.toFixed(3)); this.stats[1].set(best.toFixed(3)); this.stats[2].set(bound.toFixed(3)); this.stats[3].set(r.toFixed(3));
      this.note.innerHTML = `|Δθ| = ${Math.abs(dth).toFixed(3)} rad = ${((Math.abs(dth) * 180) / Math.PI).toFixed(1)}°。` +
        `把弧度换成角度，(5.4) 的值从 ${(dt + this.c2 * Math.abs(dth)).toFixed(2)} 变成 ${(dt + (this.c2 * Math.abs(dth) * 180) / Math.PI).toFixed(2)}——<b>同一对位形，距离差了几十倍</b>，这就是例 5.5 说的「单位不相容」。` +
        `位移度量 (5.12) 量的是机器人上某个点在 W 里实际移动的最远距离，单位天然统一；它永远不超过 (5.31) 的上界（这里 ${best.toFixed(3)} ≤ ${bound.toFixed(3)}）。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (let g = 0; g <= 4.5; g += 0.5) st.line({ x: g, y: -0.6 }, { x: g, y: 3 }, col.grid, 0.6);
      for (let g = -0.5; g <= 3; g += 0.5) st.line({ x: -0.4, y: g }, { x: 4.6, y: g }, col.grid, 0.6);
      const A1 = ROBOT.map((a) => this.tf(this.q1, a)), A2 = ROBOT.map((a) => this.tf(this.q2, a));
      st.poly(A1, C.alpha(col.dead, 0.45), col.dead, 1.5);
      st.poly(A2, C.alpha(col.bad, 0.35), col.bad, 2);
      ROBOT.forEach((a, i) => st.line(A1[i], A2[i], i === this.maxI ? col.warn : C.alpha(col.muted, 0.7), i === this.maxI ? 3 : 1, i === this.maxI ? [] : [3, 3]));
      st.dot(A2[this.maxI], 5, col.warn);
      // a_r 的圆弧（只转不移时它走的路）
      const ar = ROBOT[this.rI], r = Math.hypot(ar.x, ar.y);
      ctx.beginPath(); ctx.arc(st.X(this.q2.x), st.Y(this.q2.y), r * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = C.alpha(col.accent, 0.35); ctx.setLineDash([4, 5]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      st.dot(this.tf(this.q2, ar), 5, col.accent); st.text("a_r", this.tf(this.q2, ar), col.accent, { dx: -14, dy: -10, weight: 700 });
      st.dot({ x: this.q1.x, y: this.q1.y }, 3.5, col.dead); st.text("q₁", { x: this.q1.x, y: this.q1.y }, col.muted, { dx: -12, dy: 12 });
      st.dot({ x: this.q2.x, y: this.q2.y }, 3.5, col.bad); st.text("q₂", { x: this.q2.x, y: this.q2.y }, col.bad, { dx: -12, dy: 12 });
      st.dot(this.handle(), 7, col.surface, col.bad, 2.5);
    }
  }

  // ---------------------------------------------------------------
  // 组件：S² 与 SO(3) 上的均匀采样（例 5.14、式 5.15、「随机方向」）
  // ---------------------------------------------------------------
  const SPH = {
    naive: { name: "经纬度都均匀（错）", ok: false },
    slicer: { name: "z 均匀 + 经度均匀（切面包，对）", ok: true },
    cube: { name: "立方体里均匀再归一化（错）", ok: false },
    gauss: { name: "高斯再归一化（对）", ok: true },
    euler: { name: "SO(3)：均匀欧拉角，看 x 轴落点（错）", ok: false },
    quat: { name: "SO(3)：式 (5.15) 四元数，看 x 轴落点（对）", ok: true },
  };
  class SphereSampling {
    constructor(root) {
      this.method = "naive"; this.n = 1500; this.seed = 3; this.yaw = 0.6; this.pitch = 0.45;
      const body = C.frame(root, "球面与旋转的均匀采样", "拖动球体旋转视角；右侧是 z 分量的直方图");
      this.st = new C.Stage({ view: [-1.15, 1.15, -1.15, 1.15], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => ({ p0: p, yaw: this.yaw, pitch: this.pitch }),
        onMove: (p, d) => { this.yaw = d.yaw + (p.x - d.p0.x) * 2; this.pitch = Math.max(-1.5, Math.min(1.5, d.pitch - (p.y - d.p0.y) * 2)); this.st.draw(); },
        cursor: () => "grab" });
      this.hist = new C.Stage({ view: [-0.05, 1.05, -0.12, 1.05], aspect: 1.15, maxW: 260, onDraw: (ctx, st, col) => this.drawHist(ctx, st, col) });
      this.sel = C.select(Object.entries(SPH).map(([k, v]) => [k, v.name]), this.method, (k) => { this.method = k; this.gen(); });
      this.sN = C.slider("点数", 200, 5000, 100, this.n, (v) => { this.n = v; this.gen(); });
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, this.sN, C.button("重新采样", () => { this.seed = C.newSeed(); this.gen(); }, "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.hist.wrap, this.note)));
      this.gen();
    }
    gen() {
      const r = C.rng(this.seed), P = [];
      for (let i = 0; i < this.n; i++) {
        let v;
        switch (this.method) {
          case "naive": { const lon = 2 * Math.PI * r(), lat = Math.PI * (r() - 0.5); v = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; break; }
          case "slicer": { const z = 2 * r() - 1, lon = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); v = [s * Math.cos(lon), s * Math.sin(lon), z]; break; }
          case "cube": { const a = [2 * r() - 1, 2 * r() - 1, 2 * r() - 1], n = Math.hypot(...a) || 1; v = a.map((c) => c / n); break; }
          case "gauss": { const a = [C.gauss(r), C.gauss(r), C.gauss(r)], n = Math.hypot(...a) || 1; v = a.map((c) => c / n); break; }
          case "euler": { const al = 2 * Math.PI * r(), be = Math.PI * (r() - 0.5); r(); v = [Math.cos(al) * Math.cos(be), Math.sin(al) * Math.cos(be), -Math.sin(be)]; break; }
          case "quat": {
            const u1 = r(), u2 = r(), u3 = r();
            const a = Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), b = Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2), c = Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), d = Math.sqrt(u1) * Math.cos(2 * Math.PI * u3);
            v = [a * a + b * b - c * c - d * d, 2 * (b * c + a * d), 2 * (b * d - a * c)]; break;
          }
        }
        P.push(v);
      }
      this.P = P;
      const bins = new Array(10).fill(0);
      P.forEach((v) => { bins[Math.min(9, Math.floor(((v[2] + 1) / 2) * 10))]++; });
      this.bins = bins.map((b) => (b / this.n) * 10);
      const ok = SPH[this.method].ok;
      const notes = {
        naive: "纬度均匀 ≠ 面积均匀：靠近两极的纬度圈很短，同样多的点挤在更小的面积里。直方图两端（z ≈ ±1）明显偏高。",
        slicer: "书中的「切面包」论证：用平行于赤道、等厚的刀切球，每片的外皮面积相等（阿基米德）。所以 z 均匀 + 经度均匀就是面积均匀。",
        cube: "书中说：每个坐标都在 [−1,1] 上均匀，会把方向偏向立方体的角。拖动球体，看 8 个「角方向」是否更密；直方图也不平。",
        gauss: "三维各向同性高斯的等值面是球，所以归一化后方向均匀。书中用这个方法生成 n ≠ 4 维的随机方向（n = 4 用四元数技巧）。",
        euler: "均匀的欧拉角不是 SO(3) 上的 Haar 测度。看旋转后 x 轴的落点：两极附近明显更密。（参考代码第 8 项：两端格子约是理想值的 2 倍。）",
        quat: "式 (5.15)：u₁,u₂,u₃ 在 [0,1] 均匀 → 单位四元数在 S³ 上均匀 → 旋转在 SO(3) 上按 Haar 测度均匀。旋转后的 x 轴均匀铺满 S²。",
      };
      this.note.innerHTML = `<span class="${ok ? "yes" : "no"}">${ok ? "均匀" : "有偏"}</span> · ${notes[this.method]}` +
        (this.method === "euler" || this.method === "quat" ? ` <span class="muted">（补充：「x 轴落点均匀」只是 SO(3) 均匀的必要条件，用来直观对比。）</span>` : "");
      this.st.draw(); this.hist.draw();
    }
    proj(v) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const x1 = cy * v[0] + sy * v[1], y1 = -sy * v[0] + cy * v[1], z1 = v[2];
      // 绕水平轴俯仰：屏幕 y = z 方向
      return { x: y1, y: cp * z1 - sp * x1, depth: sp * z1 + cp * x1 };
    }
    draw(ctx, st, col) {
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), st.scale, 0, 2 * Math.PI); ctx.fillStyle = col.surface2; ctx.fill(); ctx.strokeStyle = col.strong; ctx.lineWidth = 1.5; ctx.stroke();
      // 赤道与经线
      const ring = (f) => { ctx.beginPath(); for (let i = 0; i <= 96; i++) { const p = this.proj(f((i / 96) * 2 * Math.PI)); i ? ctx.lineTo(st.X(p.x), st.Y(p.y)) : ctx.moveTo(st.X(p.x), st.Y(p.y)); } ctx.strokeStyle = C.alpha(col.muted, 0.45); ctx.lineWidth = 1; ctx.stroke(); };
      ring((t) => [Math.cos(t), Math.sin(t), 0]);
      ring((t) => [Math.cos(t), 0, Math.sin(t)]);
      ring((t) => [0, Math.cos(t), Math.sin(t)]);
      const pts = this.P.map((v) => this.proj(v)).sort((a, b) => a.depth - b.depth);
      for (const p of pts) {
        const front = p.depth > 0;
        ctx.fillStyle = front ? C.alpha(col.accent, 0.85) : C.alpha(col.muted, 0.25);
        ctx.fillRect(st.X(p.x) - 1.2, st.Y(p.y) - 1.2, 2.4, 2.4);
      }
      const N = this.proj([0, 0, 1]); st.text("z", { x: N.x * 1.08, y: N.y * 1.08 }, col.text, { weight: 700 });
    }
    drawHist(ctx, st, col) {
      st.frame(col);
      const maxV = Math.max(2.2, ...this.bins);
      const sy = 1 / maxV;
      this.bins.forEach((b, i) => {
        const x0 = i / 10 + 0.008, x1 = (i + 1) / 10 - 0.008;
        st.poly(C.rect(x0, 0, x1, b * sy), C.alpha(SPH[this.method].ok ? col.ok : col.bad, 0.55), null);
      });
      st.line({ x: 0, y: sy }, { x: 1, y: sy }, col.text, 1.5, [5, 4]);
      st.text("理想 = 1", { x: 0.83, y: sy }, col.text, { dy: -9, size: 11 });
      st.text("z = −1", { x: 0.04, y: 0 }, col.muted, { dy: 9, size: 11 }); st.text("+1", { x: 0.97, y: 0 }, col.muted, { dy: 9, size: 11 });
      st.text("z 分量的相对密度", { x: 0.5, y: 1.0 }, col.muted, { size: 11.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='lp-metric']").forEach((el) => el._w = new LpMetric(el));
    document.querySelectorAll("[data-widget='so2-metric']").forEach((el) => el._w = new SO2Metric(el));
    document.querySelectorAll("[data-widget='displacement']").forEach((el) => el._w = new Displacement(el));
    document.querySelectorAll("[data-widget='sphere-sampling']").forEach((el) => el._w = new SphereSampling(el));
  });
})();
