/* 14.4.1 节：双积分器格点（图 14.12、14.13）、可达锥（图 14.14）、平面点质量的格点搜索与 δ(c0,c1)-安全（式 14.25）、
   完全驱动机械臂的新动作集 U′(q, q̇)（图 14.15） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // 双积分器 q̈ = u：常值动作 u 走时间 t 的闭式解 (14.21)(14.22)
  const diStep = (q, v, u, t) => ({ x: q + v * t + 0.5 * u * t * t, y: v + u * t });
  const diArc = (q, v, u, t, n = 12) => { const out = []; for (let k = 0; k <= n; k++) out.push(diStep(q, v, u, (t * k) / n)); return out; };
  // 补充：两点最短时间（先 +1 后 −1 或反过来），见参考代码第 15 项
  function tStar2(q0, v0, q1, v1) {
    let best = Infinity;
    for (const s of [1, -1]) {
      const vs2 = (v0 * v0 + v1 * v1) / 2 + s * (q1 - q0); if (vs2 < 0) continue;
      const vs = s * Math.sqrt(vs2), t1 = s * (vs - v0), t2 = s * (vs - v1);
      if (t1 >= -1e-12 && t2 >= -1e-12) best = Math.min(best, t1 + t2);
    }
    return best;
  }
  // 从 (q0, v0) 用一个常值动作在 (0, Δt] 内恰好到达 (q1, v1)？返回 {t, u} 或 null
  function constConnect(q0, v0, q1, v1, dt) {
    const s = v0 + v1;
    if (Math.abs(s) < 1e-12) return Math.abs(q1 - q0) < 1e-12 && Math.abs(v1 - v0) < 1e-12 ? { t: 0, u: 0 } : null;
    const t = (2 * (q1 - q0)) / s;
    if (!(t > 1e-9 && t <= dt + 1e-9)) return null;
    const u = (v1 - v0) / t;
    return Math.abs(u) <= 1 + 1e-9 ? { t, u } : null;
  }

  // ---------------------------------------------------------------
  // 组件：双积分器格点（图 14.12、14.13）
  // ---------------------------------------------------------------
  class DILattice {
    constructor(root) {
      this.dt = 1; this.k = 3; this.field = "0"; this.arcs = false; this.belts = false; this.goal = null; this.hover = null;
      const body = C.frame(root, "双积分器的格点", "图 14.12–14.13：U_d = {−1, 0, 1}，每过 Δt 在三个向量场之间切换；点一个格点做最短时间搜索");
      this.st = new C.Stage({
        view: [-7, 7, -4, 4], aspect: 0.6, maxW: 720, stretch: true, padL: 26, padB: 18, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { this.hover = this.nearestNode(p); this.st.draw(); },
        onDown: (p) => { const n = this.nearestLattice(p); if (n) { this.goal = n; this.plan(); } return null; },
      });
      this.segF = C.seg([["none", "不画向量场"], ["-1", "u = −1"], ["0", "u = 0"], ["1", "u = +1"]], this.field, (k) => { this.field = k; this.st.draw(); });
      this.sK = C.slider("阶段数", 1, 4, 1, this.k, (v) => { this.k = v; this.build(); });
      this.sDt = C.slider("Δt", 0.5, 1.5, 0.05, this.dt, (v) => { this.dt = v; this.goal = null; this.build(); }, (v) => v.toFixed(2));
      this.cArc = C.chip("画真实的抛物线弧（习题 9）", false, (on) => { this.arcs = on; this.st.draw(); });
      this.cBelt = C.chip("传送带（u = 0 时每步的位移）", false, (on) => { this.belts = on; this.st.draw(); });
      this.stats = { n: C.stat("可达图顶点数"), seq: C.stat("鼠标处的动作序列"), plan: C.stat("BFS：阶段数 × Δt") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segF), h("div", { class: "controls" }, this.sK, this.sDt, h("div", { class: "chips" }, this.cArc, this.cBelt), C.button("清除目标", () => { this.goal = null; this.plan(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("muted"), "格点 (iΔt²/2, jΔt)，i ≡ j (mod 2)", true], [C.cv("text2"), "可达图的边"], [C.cv("ok"), "可达图顶点", true], [C.cv("path"), "最短时间路径（格点上）"]]));
      this.build();
    }
    key(p) { return Math.round(p.x / (this.dt * this.dt / 2)) + "," + Math.round(p.y / this.dt); }
    build() {
      const dt = this.dt; let level = [{ x: 0, y: 0 }];
      this.nodes = new Map([[this.key(level[0]), { p: level[0], seq: [] }]]); this.E = [];
      for (let k = 1; k <= this.k; k++) {
        const next = [];
        for (const p of level) for (const u of [-1, 0, 1]) {
          const q = diStep(p.x, p.y, u, dt), kk = this.key(q), par = this.nodes.get(this.key(p));
          this.E.push({ p, u });
          if (!this.nodes.has(kk)) { this.nodes.set(kk, { p: q, seq: par.seq.concat([u]) }); next.push(q); }
        }
        level = next;
      }
      this.plan();
    }
    nearestNode(p) {
      let best = null, bd = Infinity;
      for (const n of this.nodes.values()) { const d = this.st.pxDist(n.p, p); if (d < bd) { bd = d; best = n; } }
      return bd < 10 ? best : null;
    }
    nearestLattice(p) {
      const hq = (this.dt * this.dt) / 2, j = Math.round(p.y / this.dt); let i = Math.round(p.x / hq);
      if ((((i - j) % 2) + 2) % 2) i += p.x / hq > i ? 1 : -1;   // 只有 i ≡ j 的格点从原点可达
      return { x: i * hq, y: j * this.dt, i, j };
    }
    plan() {
      this.path = null;
      if (this.goal) {
        // 格点上的 BFS：|q| ≤ 7、|q̇| ≤ 4（C 有界、速度有上界 ⇒ 图是有限的）
        const dt = this.dt, hq = (dt * dt) / 2, g = this.goal, key = (i, j) => i + "," + j;
        const par = new Map([[key(0, 0), null]]), Q = [[0, 0]]; let head = 0, found = null;
        while (head < Q.length) {
          const [i, j] = Q[head++];
          if (i === g.i && j === g.j) { found = [i, j]; break; }
          for (const u of [-1, 0, 1]) {
            const i2 = i + 2 * j + u, j2 = j + u, k2 = key(i2, j2);
            if (Math.abs(i2 * hq) > 7 || Math.abs(j2 * dt) > 4 || par.has(k2)) continue;
            par.set(k2, [i, j, u]); Q.push([i2, j2]);
          }
        }
        if (found) {
          const seq = []; let c = found;
          while (par.get(key(c[0], c[1]))) { const [i, j, u] = par.get(key(c[0], c[1])); seq.unshift({ i, j, u }); c = [i, j]; }
          this.path = seq; this.expanded = head;
        } else this.expanded = head;
      }
      this.render();
    }
    render() {
      this.stats.n.set(this.nodes.size);
      this.stats.seq.set(this.hover ? "(" + this.hover.seq.join(", ") + ")" : "–");
      if (this.goal) {
        const T = tStar2(0, 0, this.goal.x, this.goal.y);
        this.stats.plan.set(this.path ? `${this.path.length} × ${this.dt.toFixed(2)} = ${(this.path.length * this.dt).toFixed(2)} <span class="muted">（T* = ${T.toFixed(2)}）</span>` : "格点上到不了");
      } else this.stats.plan.set("点一个格点");
      this.msg.innerHTML = "从 x₁ = (0, 0) 出发，任何动作序列都落在 (14.23) 的格点 q = iΔt²/2、q̇ = jΔt 上。格点是「斜」的（i 与 j 同奇偶）：改变速度一定伴随位移，只有无穷大的加速度才能竖直移动。u = 0 时就像一排排水平的<b>传送带</b>：q̇ > 0 的向右、q̇ < 0 的向左，每步走 q̇Δt——速度越大，一步走得越远，这正是图 14.13 里边越来越长的原因。" +
        (this.goal ? " 点了目标后，BFS 给出格点上的<b>最短阶段数</b>（近似时间最优）。<span class=\"muted\">（补充：T* 是连续时间的最短时间。必须恰好落在格点上时，Δt 的整数倍不一定凑得出 T*，所以格点解可能稍慢；见参考代码第 15 项。）</span>" : "");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const dt = this.dt, hq = (dt * dt) / 2, [x0, x1, y0, y1] = st.view;
      // 向量场（图 14.12）
      if (this.field !== "none") {
        const u = +this.field;
        for (let q = -6.5; q <= 6.5; q += 0.65) for (let v = -3.6; v <= 3.6; v += 0.45) {
          const L = Math.hypot(v, u) || 1, s = 0.28 / Math.max(L, 0.8);
          st.arrow({ x: q, y: v }, { x: q + v * s * 1.6, y: v + u * s * 0.9 }, C.alpha(col.accent, 0.4), 1, 4);
        }
      }
      st.axes(col, { xlabel: "q", ylabel: "q̇", grid: false });
      // 格点
      const jmax = Math.floor(y1 / dt), imax = Math.floor(x1 / hq);
      if (imax < 200) for (let j = -jmax; j <= jmax; j++) for (let i = -imax; i <= imax; i++) if ((((i - j) % 2) + 2) % 2 === 0) st.dot({ x: i * hq, y: j * dt }, 1.6, C.alpha(col.muted, 0.7));
      if (this.belts) for (let j = -jmax; j <= jmax; j++) { const v = j * dt; if (j === 0) continue; for (let q = -6; q <= 6; q += 3) st.arrow({ x: q, y: v }, { x: q + v * dt, y: v }, C.alpha(col.warn, 0.8), 1.6, 6); }
      // 可达图
      ctx.lineCap = "round";
      for (const e of this.E) {
        const q = diStep(e.p.x, e.p.y, e.u, dt);
        if (this.arcs) st.polyline(diArc(e.p.x, e.p.y, e.u, dt), C.alpha(col.text2, 0.85), 1.3);
        else st.line(e.p, q, C.alpha(col.text2, 0.85), 1.3);
        st.arrow(this.arcs ? diStep(e.p.x, e.p.y, e.u, dt * 0.85) : C.lerp(e.p, q, 0.85), q, C.alpha(col.text2, 0.85), 1.2, 5);
      }
      for (const n of this.nodes.values()) st.dot(n.p, 3, col.ok);
      if (this.path) {
        for (const s of this.path) st.polyline(diArc(s.i * hq, s.j * dt, s.u, dt), col.path, 3);
      }
      if (this.goal) st.mark(this.goal, col.goal, "x_G", col);
      st.dot({ x: 0, y: 0 }, 5, col.start);
      if (this.hover) st.dot(this.hover.p, 6, null, col.warn, 2);
    }
  }

  // ---------------------------------------------------------------
  // 组件：可达锥（图 14.14、习题 4）——把不在格点上的 x_I、x_G 接到格点上
  // ---------------------------------------------------------------
  class DICones {
    constructor(root) {
      this.dt = 0.6; this.tc = 1.5; this.xI = { x: -3.6, y: 1.0 }; this.xG = { x: 3.4, y: 0.8 }; this.conn = null;
      const body = C.frame(root, "可达锥：把 x_I、x_G 接到格点上", "图 14.14：一个常值动作 u ∈ [−1,1]、时长 ≤ t_c 能到的区域；拖动 x_I、x_G");
      this.st = new C.Stage({
        view: [-5, 5, -2.5, 2.5], aspect: 0.55, maxW: 720, stretch: true, padL: 26, padB: 18, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (this.st.pxDist(p, this.xI) < 12 ? "I" : this.st.pxDist(p, this.xG) < 12 ? "G" : null),
        onMove: (p, d) => { const q = { x: C.clamp(p.x, -4.8, 4.8), y: C.clamp(p.y, -2.3, 2.3) }; if (d === "I") this.xI = q; else this.xG = q; this.conn = null; this.render(); },
        cursor: (p) => (this.st.pxDist(p, this.xI) < 12 || this.st.pxDist(p, this.xG) < 12 ? "grab" : "default"),
      });
      this.sDt = C.slider("格点的 Δt", 0.4, 1.2, 0.05, this.dt, (v) => { this.dt = v; this.conn = null; this.render(); }, (v) => v.toFixed(2));
      this.sTc = C.slider("锥的时长上限 t_c", 0.3, 2.5, 0.05, this.tc, (v) => { this.tc = v; this.conn = null; this.render(); }, (v) => v.toFixed(2));
      this.stats = { f: C.stat("前向锥里的格点"), b: C.stat("反向锥里的格点"), T: C.stat("整条轨迹时间") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sDt, this.sTc, C.button("在格点上搜索，把两个锥连起来", () => this.connect(), "small primary")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "前向可达锥（从 x_I）"], [C.cv("alive2"), "反向可达锥（到 x_G）"], [C.cv("path"), "x_I → 格点 → … → 格点 → x_G"]]));
      this.render();
    }
    lattice() {
      const dt = this.dt, hq = (dt * dt) / 2, out = [];
      for (let j = -Math.floor(2.4 / dt); j <= Math.floor(2.4 / dt); j++) for (let i = -Math.floor(5 / hq); i <= Math.floor(5 / hq); i++) if ((((i - j) % 2) + 2) % 2 === 0) out.push({ x: i * hq, y: j * dt, i, j });
      return out;
    }
    render() {
      const L = this.lattice(), dt = this.dt;
      this.fw = []; this.bw = [];
      for (const p of L) {
        const a = constConnect(this.xI.x, this.xI.y, p.x, p.y, this.tc); if (a) this.fw.push({ p, ...a });
        const b = constConnect(p.x, p.y, this.xG.x, this.xG.y, this.tc); if (b) this.bw.push({ p, ...b });
      }
      this.stats.f.set(this.fw.length); this.stats.b.set(this.bw.length);
      this.stats.T.set(this.conn ? this.conn.T.toFixed(3) + ` <span class="muted">（T* = ${tStar2(this.xI.x, this.xI.y, this.xG.x, this.xG.y).toFixed(3)}）</span>` : "–");
      this.msg.innerHTML = "x_G 是单个点、又不在格点上时，严格说要解一个 BVP；但对双积分器这很容易：<b>能用一个常值动作在限定时间内到达 x_G 的状态</b>组成一个锥（紫色，反向可达集），锥里的格点用一个常值动作就能接到 x_G。x_I 同理（蓝色，前向可达集）。锥的两条边是 u = ±1 的抛物线：q̇ = √(q̇₀² ± 2(q − q₀))（q̇ > 0 时；习题 4）。<span class=\"muted\">（书中锥的时长就取 Δt；这里把它单独做成滑块 t_c，好让锥里能落进几个格点——接入段只是一段常值动作，时长不必是 Δt 的整数倍。）</span>" +
        (this.fw.length === 0 || this.bw.length === 0 ? ' <span class="no">现在有一个锥里没有格点，增大 Δt 或挪一挪。</span>' : "");
      this.st.draw();
    }
    connect() {
      const dt = this.dt, hq = (dt * dt) / 2, key = (i, j) => i + "," + j;
      const goals = new Map(this.bw.map((b) => [key(b.p.i, b.p.j), b]));
      const par = new Map(), Q = [];
      for (const f of this.fw) { const k = key(f.p.i, f.p.j); if (!par.has(k)) { par.set(k, { start: f }); Q.push([f.p.i, f.p.j, f.t]); } }
      // 每条边的时间都是 Δt，起点那段的时间不同：按「阶段数」BFS 后再在同层里挑总时间最短的（够用的近似）
      let head = 0, found = null;
      while (head < Q.length && !found) {
        const [i, j] = Q[head++];
        if (goals.has(key(i, j))) { found = [i, j]; break; }
        for (const u of [-1, 0, 1]) {
          const i2 = i + 2 * j + u, j2 = j + u, k2 = key(i2, j2);
          if (Math.abs(i2 * hq) > 5 || Math.abs(j2 * dt) > 2.4 || par.has(k2)) continue;
          par.set(k2, { from: [i, j], u }); Q.push([i2, j2]);
        }
      }
      if (!found) { this.conn = null; this.render(); return; }
      const segs = []; let c = found, rec = par.get(key(c[0], c[1]));
      while (rec && !rec.start) { segs.unshift(diArc(rec.from[0] * hq, rec.from[1] * dt, rec.u, dt)); c = rec.from; rec = par.get(key(c[0], c[1])); }
      const f = rec.start, b = goals.get(key(found[0], found[1]));
      segs.unshift(diArc(this.xI.x, this.xI.y, f.u, f.t)); segs.push(diArc(b.p.x, b.p.y, b.u, b.t));
      this.conn = { segs, T: f.t + b.t + (segs.length - 2) * dt };
      this.render();
    }
    cone(x, dir) {
      // dir = +1：前向（t ∈ [0, Δt]）；−1：反向（t ∈ [−Δt, 0]）
      const dt = this.tc, P = [], n = 24;
      for (let k = 0; k <= n; k++) P.push(diStep(x.x, x.y, 1, (dir * dt * k) / n));
      for (let k = 0; k <= n; k++) P.push(diStep(x.x, x.y, 1 - (2 * k) / n, dir * dt));
      for (let k = n; k >= 0; k--) P.push(diStep(x.x, x.y, -1, (dir * dt * k) / n));
      return P;
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.axes(col, { xlabel: "q", ylabel: "q̇", grid: false });
      for (const p of this.lattice()) st.dot(p, 1.8, C.alpha(col.muted, 0.75));
      st.poly(this.cone(this.xI, 1), C.alpha(col.accent, 0.2), col.accent, 1.4);
      st.poly(this.cone(this.xG, -1), C.alpha(col.alive2, 0.22), col.alive2, 1.4);
      for (const f of this.fw) { st.polyline(diArc(this.xI.x, this.xI.y, f.u, f.t), C.alpha(col.accent, 0.8), 1.2); st.dot(f.p, 3.5, col.accent); }
      for (const b of this.bw) { st.polyline(diArc(b.p.x, b.p.y, b.u, b.t), C.alpha(col.alive2, 0.8), 1.2); st.dot(b.p, 3.5, col.alive2); }
      if (this.conn) for (const s of this.conn.segs) st.polyline(s, col.path, 3);
      st.mark(this.xI, col.start, "x_I", col); st.mark(this.xG, col.goal, "x_G", col);
    }
  }

  // ---------------------------------------------------------------
  // 组件：平面里的点质量 = 两个独立的双积分器；X = ℝ⁴ 上的格点 BFS 与 δ(c0,c1)-安全 (14.25)
  // ---------------------------------------------------------------
  class Kinodynamic {
    constructor(root) {
      this.dt = 0.7; this.vmax = 2; this.c0 = 0.12; this.c1 = 0.12; this.xI = { x: 1, y: 1 }; this.xG = { x: 9, y: 5 }; this.res = null; this.anim = 0;
      this.W = new C.World([C.rect(3, 0, 3.6, 3.6), C.rect(6.2, 2.4, 6.8, 6), [{ x: 4.6, y: 4.4 }, { x: 5.6, y: 4.1 }, { x: 5.2, y: 5.3 }]], { x0: 0, y0: 0, x1: 10, y1: 6 });
      const body = C.frame(root, "平面点质量的格点搜索", "两个独立双积分器，X = ℝ⁴；BFS ≈ 时间最优；圆盘半径 δ = c₀ + c₁‖q̇‖ 随速度变大");
      this.st = new C.Stage({
        view: [0, 10, 0, 6], aspect: 0.6, maxW: 720, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xI) < 0.35 ? "I" : C.dist(p, this.xG) < 0.35 ? "G" : null),
        onMove: (p, d) => { const q = { x: C.clamp(p.x, 0.2, 9.8), y: C.clamp(p.y, 0.2, 5.8) }; if (!this.W.free(q, 0.15)) return; if (d === "I") this.xI = q; else this.xG = q; this.res = null; this.st.draw(); },
        cursor: (p) => (C.dist(p, this.xI) < 0.35 || C.dist(p, this.xG) < 0.35 ? "grab" : "default"),
      });
      this.segDt = C.seg([["1", "Δt = 1"], ["0.7", "Δt = 0.7"], ["0.5", "Δt = 0.5"]], "0.7", (k) => { this.dt = +k; this.res = null; this.st.draw(); });
      this.sC0 = C.slider("c₀", 0, 0.4, 0.02, this.c0, (v) => { this.c0 = v; this.res = null; this.st.draw(); }, (v) => v.toFixed(2));
      this.sC1 = C.slider("c₁", 0, 0.4, 0.02, this.c1, (v) => { this.c1 = v; this.res = null; this.st.draw(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => { this.anim += 0.03; this.st.draw(); return this.res && this.res.path && this.anim < this.res.path.length * this.dt; });
      this.stats = { n: C.stat("扩展的状态"), k: C.stat("阶段数 × Δt"), ms: C.stat("用时") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segDt, this.sC0, this.sC1, C.button("BFS 搜索", () => this.search(), "small primary"), C.button("播放", () => { this.anim = 0; this.runner.start(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "BFS 到过的位置", true], [C.cv("path"), "解轨迹（抛物线段）"], [C.cv("warn"), "δ(c₀,c₁)(q̇) 圆盘"]]));
      this.search();
    }
    search() {
      const t0 = performance.now(), dt = this.dt, hq = (dt * dt) / 2, J = Math.floor(this.vmax / dt + 1e-9), NJ = 2 * J + 1;
      const ax = (q0, lo, hi) => ({ imin: -Math.floor((q0 - lo) / hq), imax: Math.floor((hi - q0) / hq) });
      const X = ax(this.xI.x, 0, 10), Y = ax(this.xI.y, 0, 6), NX = X.imax - X.imin + 1, NY = Y.imax - Y.imin + 1;
      const idx = (i1, j1, i2, j2) => (((i1 - X.imin) * NJ + (j1 + J)) * NY + (i2 - Y.imin)) * NJ + (j2 + J);
      const N = NX * NJ * NY * NJ, par = new Int32Array(N).fill(-1), act = new Int8Array(N);
      const Q = new Int32Array(N); let head = 0, tail = 0;
      const s0 = idx(0, 0, 0, 0); par[s0] = s0; Q[tail++] = s0;
      const dec = (s) => { const j2 = (s % NJ) - J; s = Math.floor(s / NJ); const i2 = (s % NY) + Y.imin; s = Math.floor(s / NY); const j1 = (s % NJ) - J; const i1 = Math.floor(s / NJ) + X.imin; return [i1, j1, i2, j2]; };
      const pos = (i1, i2) => ({ x: this.xI.x + i1 * hq, y: this.xI.y + i2 * hq });
      let found = -1;
      while (head < tail) {
        const s = Q[head++], [i1, j1, i2, j2] = dec(s), p = pos(i1, i2);
        if (j1 === 0 && j2 === 0 && C.dist(p, this.xG) <= 0.3) { found = s; break; }
        for (let u1 = -1; u1 <= 1; u1++) for (let u2 = -1; u2 <= 1; u2++) {
          const n1 = i1 + 2 * j1 + u1, m1 = j1 + u1, n2 = i2 + 2 * j2 + u2, m2 = j2 + u2;
          if (Math.abs(m1) > J || Math.abs(m2) > J || n1 < X.imin || n1 > X.imax || n2 < Y.imin || n2 > Y.imax) continue;
          const t = idx(n1, m1, n2, m2); if (par[t] >= 0) continue;
          // 沿抛物线弧检查：每个采样点处半径 δ = c0 + c1‖q̇‖ 的圆盘无碰
          let ok = true;
          for (let k = 1; k <= 4 && ok; k++) {
            const tt = (dt * k) / 4, a = diStep(p.x, j1 * dt, u1, tt), b = diStep(p.y, j2 * dt, u2, tt);
            ok = this.W.free({ x: a.x, y: b.x }, this.c0 + this.c1 * Math.hypot(a.y, b.y));
          }
          if (!ok) continue;
          par[t] = s; act[t] = (u1 + 1) * 3 + (u2 + 1); Q[tail++] = t;
        }
      }
      const visited = []; const stride = Math.max(1, Math.floor(head / 6000));
      for (let k = 0; k < head; k += stride) { const [i1, , i2] = dec(Q[k]); visited.push(pos(i1, i2)); }
      let path = null;
      if (found >= 0) {
        path = []; let s = found;
        while (s !== s0) { const p = par[s], [i1, j1, i2, j2] = dec(p), a = act[s]; path.unshift({ q: pos(i1, i2), v: { x: j1 * dt, y: j2 * dt }, u: { x: Math.floor(a / 3) - 1, y: (a % 3) - 1 } }); s = p; }
      }
      this.res = { visited, path, expanded: head, ms: performance.now() - t0 };
      this.anim = 0; this.render();
    }
    stateAt(t) {
      const P = this.res.path, dt = this.dt, k = Math.min(P.length - 1, Math.floor(t / dt)), s = P[k], tt = Math.min(dt, t - k * dt);
      const a = diStep(s.q.x, s.v.x, s.u.x, tt), b = diStep(s.q.y, s.v.y, s.u.y, tt);
      return { q: { x: a.x, y: b.x }, v: Math.hypot(a.y, b.y) };
    }
    render() {
      const r = this.res;
      this.stats.n.set(r ? r.expanded : "–");
      this.stats.k.set(r ? (r.path ? `${r.path.length} × ${this.dt} = ${(r.path.length * this.dt).toFixed(1)}` : '<span class="no">没找到</span>') : "–");
      this.stats.ms.set(r ? r.ms.toFixed(0) + " ms" : "–");
      this.msg.innerHTML = "两个坐标各自是一个双积分器，互不影响，所以格点直接取两份的笛卡儿积：每个格点有 3² = 9 条出边（某个坐标速度为 0 时，那个坐标的 u = 0 不产生运动）。轨迹是直线段或抛物线段，有闭式解 (14.22)，不需要数值积分，只需沿每条边做碰撞检测。" +
        " 14.4.1 节的近似算法框架说：若存在终止于 x_G、用时 t_opt 的 δ(c₀,c₁)-安全轨迹，适当选 Δt 后 BFS 会找到一条 (1−ε)δ(c₀,c₁)-安全、用时不超过 (1+ε)t_opt 的轨迹。把 c₁ 调大：机器人在狭窄处必须<b>减速</b>，因为安全圆盘随速度变大。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.world(this.W, col);
      const r = this.res;
      if (r) {
        for (const p of r.visited) st.dot(p, 1.3, C.alpha(col.accent, 0.35));
        if (r.path) {
          for (const s of r.path) {
            const P = []; for (let k = 0; k <= 10; k++) { const tt = (this.dt * k) / 10; P.push({ x: diStep(s.q.x, s.v.x, s.u.x, tt).x, y: diStep(s.q.y, s.v.y, s.u.y, tt).x }); }
            st.polyline(P, col.path, 2.6);
            st.circle(s.q, this.c0 + this.c1 * Math.hypot(s.v.x, s.v.y), null, C.alpha(col.warn, 0.55), 1);
          }
          if (this.runner.running || this.anim > 0) { const s = this.stateAt(this.anim); st.circle(s.q, this.c0 + this.c1 * s.v, C.alpha(col.warn, 0.35), col.warn, 1.5); st.dot(s.q, 4, col.text); }
        }
      }
      st.mark(this.xI, col.start, "x_I", col); st.circle(this.xG, 0.3, C.alpha(col.goal, 0.15), col.goal, 1.2, [4, 3]); st.mark(this.xG, col.goal, "x_G", col);
    }
  }

  // ---------------------------------------------------------------
  // 组件：完全驱动机械臂的新动作集 U′(q, q̇)（图 14.15）
  // 补充：两连杆平面臂，连杆末端各一个单位质点、l₁ = l₂ = 1、水平面内（无重力）
  // M(q) = [[3 + 2cos q₂, 1 + cos q₂], [1 + cos q₂, 1]]，科氏项 c(q, q̇) = [−sin q₂(2q̇₁q̇₂ + q̇₂²), sin q₂ q̇₁²]
  // q̈ = h(q, q̇, u) = M⁻¹(u − c)，U = [−1,1]² 是力矩上下限
  // ---------------------------------------------------------------
  function armAccel(q2, qd1, qd2, u) {
    const c2 = Math.cos(q2), s2 = Math.sin(q2);
    const m11 = 3 + 2 * c2, m12 = 1 + c2, m22 = 1, det = m11 * m22 - m12 * m12;
    const r1 = u[0] + s2 * (2 * qd1 * qd2 + qd2 * qd2), r2 = u[1] - s2 * qd1 * qd1;
    return { x: (m22 * r1 - m12 * r2) / det, y: (-m12 * r1 + m11 * r2) / det };
  }
  function inConvex(p, P) {
    let sgn = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); if (Math.abs(c) < 1e-12) continue; const s = c > 0 ? 1 : -1; if (!sgn) sgn = s; else if (s !== sgn) return false; }
    return true;
  }
  class AccelSet {
    constructor(root) {
      this.q2 = 1.0; this.qd1 = 0.3; this.qd2 = 0.2; this.grid = 0.25; this.dt = 0.03;
      const body = C.frame(root, "新的动作集 U′(q, q̇)", "图 14.15：两连杆臂，力矩 u ∈ [−1,1]² 经 q̈ = M⁻¹(u − c(q,q̇)) 变成可用加速度；网格点 = 采样到的 u′");
      this.st = new C.Stage({ view: [-4, 4, -6, 6], aspect: 1, maxW: 430, pad: 22, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.arm = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], maxW: 200, onDraw: (ctx, st, col) => this.drawArm(ctx, st, col) });
      this.sQ2 = C.slider("肘关节角 q₂", -3, 3, 0.05, this.q2, (v) => { this.q2 = v; this.render(); }, (v) => v.toFixed(2));
      this.sQd1 = C.slider("q̇₁", -2, 2, 0.05, this.qd1, (v) => { this.qd1 = v; this.render(); }, (v) => v.toFixed(2));
      this.sQd2 = C.slider("q̇₂", -2, 2, 0.05, this.qd2, (v) => { this.qd2 = v; this.render(); }, (v) => v.toFixed(2));
      this.sG = C.slider("网格间距", 0.15, 1, 0.05, this.grid, (v) => { this.grid = v; this.render(); }, (v) => v.toFixed(2));
      this.sDt = C.slider("Δt", 0, 0.12, 0.005, this.dt, (v) => { this.dt = v; this.render(); }, (v) => v.toFixed(3));
      this.stats = { tot: C.stat("落在 U′ 里的网格点"), safe: C.stat("整个 Δt 内都安全的"), det: C.stat("det M(q)") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sQ2, this.sQd1, this.sQd2), h("div", { class: "controls" }, this.sG, this.sDt),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.arm.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cv("accent"), "U′(q, q̇)：平行四边形"], [C.cv("ok"), "安全的网格点", true], [C.cv("warn"), "靠边、Δt 内可能出界", true]]))));
      this.render();
    }
    para(q2, qd1, qd2) { return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map((u) => armAccel(q2, qd1, qd2, u)); }
    render() {
      const P = (this.P = this.para(this.q2, this.qd1, this.qd2));
      // Δt 内状态的变化范围：用 U′ 的最大加速度估一个盒子，取盒子角上的 U′，安全点要在它们的交集里
      let amax = 0; for (const p of P) amax = Math.max(amax, Math.abs(p.x), Math.abs(p.y));
      const dt = this.dt, dq2 = Math.abs(this.qd2) * dt + 0.5 * amax * dt * dt, dv = amax * dt;
      this.others = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) this.others.push(this.para(this.q2 + a * dq2, this.qd1 + b * dv, this.qd2 + c * dv));
      this.pts = []; let tot = 0, safe = 0;
      const g = this.grid;
      for (let x = -Math.floor(4 / g) * g; x <= 4; x += g) for (let y = -Math.floor(6 / g) * g; y <= 6; y += g) {
        const p = { x, y }; if (!inConvex(p, P)) continue; tot++;
        const ok = this.others.every((Q) => inConvex(p, Q)); if (ok) safe++;
        this.pts.push({ p, ok });
      }
      const c2 = Math.cos(this.q2); this.stats.tot.set(tot); this.stats.safe.set(safe); this.stats.det.set((2 - c2 * c2).toFixed(3));
      this.msg.innerHTML = "q、q̇ 固定时，q̈ = M(q)⁻¹(u − c) 是 u 的仿射函数：力矩的长方形被<b>剪切</b>成平行四边形（13.140 的线性变换），再被科氏项平移。于是 q̈ = u′、u′ ∈ U′(q, q̇) 看起来就像多个独立的双积分器，只是 (1) U′ 的形状复杂，(2) 它随 q、q̇ <b>变化</b>。前者用网格采样解决；后者要去掉边界附近的一层：Δt 内状态在变，靠边的 u′ 可能滑到新动作集外面（图 14.15b）。拖 q̇ 和 Δt 看看安全层有多厚。";
      this.st.draw(); this.arm.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.axes(col, { xlabel: "q̈₁", ylabel: "q̈₂", xticks: [-4, -2, 0, 2, 4], yticks: [-6, -3, 0, 3, 6] });
      for (const Q of this.others) st.poly(Q, null, C.alpha(col.muted, 0.5), 1);
      st.poly(this.P, C.alpha(col.accent, 0.18), col.accent, 2);
      for (const { p, ok } of this.pts) st.dot(p, 2.6, ok ? col.ok : col.warn);
    }
    drawArm(ctx, st, col) {
      st.frame(col);
      const a = { x: 0, y: 0 }, b = { x: 1, y: 0 }, c = { x: 1 + Math.cos(this.q2), y: Math.sin(this.q2) };
      st.line(a, b, col.text2, 6); st.line(b, c, col.text2, 6);
      st.dot(a, 5, col.surface, col.text, 2); st.dot(b, 5, col.surface, col.text, 2); st.dot(c, 5, col.current);
      st.text("q₁ = 0 时的姿态", { x: 0, y: -1.8 }, col.muted, { size: 10.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='di-lattice']").forEach((el) => el._w = new DILattice(el));
    document.querySelectorAll("[data-widget='di-cones']").forEach((el) => el._w = new DICones(el));
    document.querySelectorAll("[data-widget='kinodynamic']").forEach((el) => el._w = new Kinodynamic(el));
    document.querySelectorAll("[data-widget='accel-set']").forEach((el) => el._w = new AccelSet(el));
  });
})();
