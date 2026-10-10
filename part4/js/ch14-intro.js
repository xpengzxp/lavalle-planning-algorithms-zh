/* 14.1 节：速度集 f(x,U) 与系统性质（漂移、对称、欠驱动）；例 14.1 不可避免碰撞区 X_ric（图 14.3） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // ---------------------------------------------------------------
  // 组件：速度集 f(x, U) 与系统性质（14.1.2 节）
  // ---------------------------------------------------------------
  const SYSTEMS = {
    disc: {
      name: "ẋ = u，U = 单位圆盘（例 14.2）", ax: ["ẋ", "ẏ"], dimC: 2, m: 2, order: 1,
      set: () => ({ kind: "disc", r: 1 }),
      note: "C = ℝ²，速度可以取单位圆盘里任何方向。它就是第 II 部分的模型加上速度上界：既没有漂移，也对称，也不是欠驱动。这类约束完全可积，所以不是非完整约束。",
      tags: { nonhol: false, kino: false },
    },
    dubins: {
      name: "Dubins 车（只能前进）", ax: ["前进速度 v", "角速度 θ̇"], dimC: 3, m: 2, order: 1,
      set: () => ({ kind: "segs", segs: [[{ x: 1, y: -1 }, { x: 1, y: 1 }]], pts: [{ x: 0, y: 0 }] }),
      note: "u_s ∈ {0, 1}、|θ̇| ≤ 1/ρ_min。能停下（u_s = 0）所以<b>无漂移</b>；但速度集关于原点不对称——倒车的那一半不存在，所以<b>不对称</b>：一条轨迹倒过来走一般做不到。2 个动作变量 &lt; dim C = 3，是欠驱动的、非完整的。",
      tags: { nonhol: true, kino: false },
    },
    rs: {
      name: "Reeds–Shepp 车（可倒车）", ax: ["前进速度 v", "角速度 θ̇"], dimC: 3, m: 2, order: 1,
      set: () => ({ kind: "segs", segs: [[{ x: 1, y: -1 }, { x: 1, y: 1 }], [{ x: -1, y: -1 }, { x: -1, y: 1 }]], pts: [{ x: 0, y: 0 }] }),
      note: "u_s ∈ {−1, 0, 1}：比 Dubins 车多了倒车，速度集关于原点对称（虚线与实线重合），所以是<b>对称系统</b>：任何轨迹都可以按相反顺序原路走回。",
      tags: { nonhol: true, kino: false },
    },
    diff: {
      name: "差速驱动（13.1.2 节）", ax: ["前进速度 v", "角速度 θ̇"], dimC: 3, m: 2, order: 1,
      set: () => ({ kind: "poly", P: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }] }),
      note: "两个轮子的角速度 (u_r, u_l) ∈ [−1,1]²，v ∝ u_r + u_l、θ̇ ∝ u_r − u_l，速度集是一个菱形：对称、无漂移，但仍是欠驱动的（不能侧移）。",
      tags: { nonhol: true, kino: false },
    },
    di: {
      name: "双积分器 q̈ = u（例 13.3）", ax: ["q 方向分量 = q̇", "q̇ 方向分量 = q̈ = u"], dimC: 1, m: 1, order: 2,
      set: (st) => ({ kind: "segs", segs: [[{ x: st.qd, y: -1 }, { x: st.qd, y: 1 }]], pts: [] }),
      note: "相空间 X = ℝ²，x = (q, q̇)，ẋ = (q̇, u)。速度集是一条竖线段，位置由当前速度 q̇ 决定：只要 q̇ ≠ 0，原点就不在速度集里——<b>不能立刻停下，这就是漂移</b>。1 个动作 = dim C，所以是完全驱动的；有二阶约束，属于动力学（kinodynamic）规划。",
      tags: { nonhol: false, kino: true },
    },
  };

  class VelocitySets {
    constructor(root) {
      this.key = "dubins"; this.qd = 0.6;
      const body = C.frame(root, "速度集 f(x, U) 与系统性质", "实线 = f(x,U)，虚线 = −f(x,U)；对称 ⇔ 两者重合，无漂移 ⇔ 原点在集合里");
      this.st = new C.Stage({ view: [-1.6, 1.6, -1.6, 1.6], maxW: 380, pad: 22, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sel = C.select(Object.entries(SYSTEMS).map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.render(); });
      this.sQd = C.slider("当前速度 q̇", -1.4, 1.4, 0.05, this.qd, (v) => { this.qd = v; this.render(); }, (v) => v.toFixed(2));
      this.table = h("div", { class: "table-wrap" });
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "系统 ", this.sel), this.sQd),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.table, this.msg,
          C.legend([[C.cv("accent"), "f(x, U)"], [C.cv("muted"), "−f(x, U)（虚线）"], [C.cv("current"), "原点（零速度）", true]]))));
      this.render();
    }
    props() {
      const S = SYSTEMS[this.key], set = S.set(this);
      // 对称：集合关于原点对称；漂移：原点不在集合里
      let sym, stop;
      if (set.kind === "disc" || set.kind === "poly") { sym = true; stop = true; }
      else if (this.key === "dubins") { sym = false; stop = true; }
      else if (this.key === "rs") { sym = true; stop = true; }
      else { sym = Math.abs(this.qd) < 1e-9; stop = Math.abs(this.qd) < 1e-9; }
      return { S, set, sym, stop };
    }
    render() {
      const { S, sym, stop } = this.props();
      this.sQd.style.display = this.key === "di" ? "" : "none";
      const yes = (b, t, f) => `<span class="${b ? "yes" : "no"}">${b ? "✓ " + t : "✗ " + f}</span>`;
      const drift = this.key === "di";
      this.table.innerHTML = `<table class="data"><tbody>
        <tr><td>dim C / 动作数 m</td><td>${S.dimC} / ${S.m}</td></tr>
        <tr><td>在这个状态能立刻停下？</td><td>${yes(stop, "能（原点在速度集里）", "不能（原点不在速度集里）")}</td></tr>
        <tr><td>漂移 drift</td><td>${drift ? '<span class="no">有：只要 q̇ ≠ 0 就停不下</span>' : '<span class="yes">无漂移 driftless</span>'}</td></tr>
        <tr><td>对称 symmetric</td><td>${this.key === "di" ? '<span class="no">否（有漂移的系统不可能对称）</span>' : yes(sym, "是", "否")}</td></tr>
        <tr><td>欠驱动 underactuated</td><td>${S.m < S.dimC ? `<span class="no">是：m = ${S.m} &lt; dim C = ${S.dimC}</span>` : `<span class="yes">否：完全驱动（m = dim C）</span>`}</td></tr>
        <tr><td>按文献的叫法</td><td>${S.tags.kino ? "动力学规划 kinodynamic（二阶约束）" : S.tags.nonhol ? "非完整规划 nonholonomic（速度约束不可积）" : "约束可积：就是第 II 部分的问题"}</td></tr>
      </tbody></table>`;
      this.msg.innerHTML = S.note + (this.key === "di" ? (stop ? " 现在 q̇ = 0：恰好在这一点上原点在速度集里。" : " 把 q̇ 拖到 0 看看。") : "");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.axes(col, { xticks: [-1, 0, 1], yticks: [-1, 0, 1], xlabel: SYSTEMS[this.key].ax[0], ylabel: SYSTEMS[this.key].ax[1] });
      const { set } = this.props();
      const neg = (p) => ({ x: -p.x, y: -p.y });
      const drawSet = (s, color, dash, fillA) => {
        if (s.kind === "disc") st.circle({ x: 0, y: 0 }, s.r, fillA ? C.alpha(color, fillA) : null, color, 2.2, dash);
        if (s.kind === "poly") { st.poly(s.P, fillA ? C.alpha(color, fillA) : null, null); st.polyline(s.P.concat([s.P[0]]), color, 2.2, dash); }
        if (s.kind === "segs") {
          for (const [a, b] of s.segs) st.line(a, b, color, dash ? 2 : 4.5, dash);
          for (const p of s.pts) st.dot(p, dash ? 3 : 5, dash ? null : color, dash ? color : null, 1.5);
        }
      };
      const negSet = set.kind === "disc" ? set : set.kind === "poly" ? { kind: "poly", P: set.P.map(neg) } : { kind: "segs", segs: set.segs.map(([a, b]) => [neg(a), neg(b)]), pts: set.pts.map(neg) };
      drawSet(set, col.accent, null, 0.18);
      drawSet(negSet, col.muted, [5, 4], 0);
      st.dot({ x: 0, y: 0 }, 4, col.current);
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 14.1 不可避免碰撞区（图 14.3）
  // W = ℝ，双积分器 q̈ = u，U = [−a, a]；障碍：一个点和一个区间
  // ---------------------------------------------------------------
  class XRic {
    constructor(root) {
      this.amax = 1; this.x = { x: -0.6, y: 1.3 }; this.obs = [[-2, -2], [1, 2]]; this.vbound = false; this.vmax = 2.2;
      this.anim = null;
      const body = C.frame(root, "不可避免碰撞区 X_ric", "例 14.1：拖动状态 x(0) = (q, q̇)；下面是 W = ℝ 上的机器人");
      this.st = new C.Stage({
        view: [-4, 4, -3, 3], aspect: 0.62, maxW: 640, stretch: true, padL: 26, padB: 18,
        onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.stop(); this.x = this.clampX(p); this.render(); return "x"; },
        onMove: (p) => { this.x = this.clampX(p); this.render(); },
        cursor: () => "crosshair",
      });
      this.line = new C.Stage({ view: [-4, 4, -0.5, 0.5], aspect: 0.12, maxW: 640, stretch: true, padL: 26, padB: 4, onDraw: (ctx, st, col) => this.drawLine(ctx, st, col) });
      this.sA = C.slider("刹车能力 a_max（U = [−a_max, a_max]）", 0.3, 3, 0.1, this.amax, (v) => { this.amax = v; this.render(); }, (v) => v.toFixed(1));
      this.cV = C.chip("加相约束 |q̇| ≤ 2.2", false, (on) => { this.vbound = on; this.render(); });
      this.stats = { sd: C.stat("刹车距离 q̇²/(2a_max)"), res: C.stat("x(0) ∈ X_ric ?") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sA, h("div", { class: "chips" }, this.cV),
        C.button("全力刹车（动画）", () => this.play(), "small")),
        this.st.wrap, this.line.wrap,
        h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("wall"), "X_obs（C_obs 上方的柱体）"], [C.cv("bad"), "X_ric \\ X_obs"], [C.cv("ok"), "全力刹车的轨迹（安全）"], [C.cv("current"), "全力刹车的轨迹（撞）"]]));
      this.render();
    }
    clampX(p) { return { x: C.clamp(p.x, -3.95, 3.95), y: C.clamp(p.y, -2.95, 2.95) }; }
    // 一维里最好的办法就是全力刹车；x ∈ X_ric ⇔ 刹车扫过的区间与某个障碍相交
    inRic(q, v) {
      const d = (v * v) / (2 * this.amax), lo = v >= 0 ? q : q - d, hi = v >= 0 ? q + d : q;
      return this.obs.some(([a, b]) => !(hi < a || lo > b));
    }
    brakeTraj(q, v, n = 80) {
      const s = v >= 0 ? -1 : 1, T = Math.abs(v) / this.amax, out = [];
      for (let k = 0; k <= n; k++) { const t = (T * k) / n; out.push({ x: q + v * t + 0.5 * s * this.amax * t * t, y: v + s * this.amax * t }); }
      return out;
    }
    render() {
      const { x: q, y: v } = this.x, d = (v * v) / (2 * this.amax), ric = this.inRic(q, v);
      const inObs = this.obs.some(([a, b]) => q >= a && q <= b);
      this.stats.sd.set(d.toFixed(3));
      this.stats.res.set(inObs ? '<span class="no">已在 X_obs 里</span>' : ric ? '<span class="no">是：怎么做都会撞</span>' : '<span class="yes">否：刹得住</span>');
      this.msg.innerHTML = (Math.abs(v) < 0.05 ? "q̇ ≈ 0：这一片切片上 X_ric = X_obs = C_obs。往上拖，看红色区域怎样向左长出来。" :
        v > 0 ? `q̇ > 0（向右运动）：X_ric 只<b>向障碍左边</b>延伸，宽度是刹车距离 q̇²/(2a_max) = ${d.toFixed(2)}，随速度<b>平方</b>增长（图 14.3 的抛物线边界）。在障碍右边，速度再大也安全。` :
          `q̇ < 0（向左运动）：X_ric 改为<b>向障碍右边</b>延伸。`) +
        (this.vbound ? " 相约束 |q̇| ≤ 2.2 把上下两条带子也变成了「违规」区域：这类约束一般写成 h_i(x) ≤ 0，直接放进 X 的定义里。" : "");
      this.st.draw(); this.line.draw();
    }
    play() {
      this.stop();
      const { x: q, y: v } = this.x, s = v >= 0 ? -1 : 1, T = Math.abs(v) / this.amax;
      let hit = Infinity;
      // 找到撞上障碍的时刻
      for (let k = 0; k <= 400; k++) { const t = (T * k) / 400, qq = q + v * t + 0.5 * s * this.amax * t * t; if (this.obs.some(([a, b]) => qq >= a - 1e-9 && qq <= b + 1e-9)) { hit = t; break; } }
      const t0 = performance.now(), Tend = Math.min(T, hit);
      this.anim = { t: 0, T: Tend, hit: hit < Infinity, q0: q, v0: v, s };
      this.runner = new C.Runner(() => {
        const t = Math.min(Tend, ((performance.now() - t0) / 1000) * 1.2);
        this.anim.t = t; this.line.draw(); this.st.draw();
        return t < Tend;
      });
      this.runner.start();
    }
    stop() { if (this.runner) this.runner.stop(); this.anim = null; }
    draw(ctx, st, col) {
      st.frame(col);
      const [x0, x1, y0, y1] = st.view;
      // X_ric（含 X_obs）：逐列扫描 q̇ 着色
      const n = 160;
      for (let j = 0; j < n; j++) {
        const v0 = y0 + ((j + 0.5) / n) * (y1 - y0), dv = (y1 - y0) / n;
        for (const [a, b] of this.obs) {
          const d = (v0 * v0) / (2 * this.amax);
          const lo = v0 >= 0 ? a - d : a, hi = v0 >= 0 ? b : b + d;
          st.rectW(Math.max(x0, lo), v0 - dv / 2, Math.min(x1, hi), v0 + dv / 2 + 1e-3, C.alpha(col.bad, 0.28), null);
        }
      }
      // 抛物线边界
      for (const [a, b] of this.obs) {
        const P = [], Q = [];
        for (let k = 0; k <= 60; k++) { const v = (y1 * k) / 60; P.push({ x: a - (v * v) / (2 * this.amax), y: v }); Q.push({ x: b + (v * v) / (2 * this.amax), y: -v }); }
        st.polyline(P, col.bad, 1.6); st.polyline(Q, col.bad, 1.6);
      }
      // X_obs：C_obs 上方的柱体
      for (const [a, b] of this.obs) {
        if (a === b) st.line({ x: a, y: y0 }, { x: a, y: y1 }, col.wall, 3);
        else st.rectW(a, y0, b, y1, C.alpha(col.wall, 0.75), col.wall, 1);
      }
      if (this.vbound) { st.rectW(x0, this.vmax, x1, y1, C.alpha(col.warn, 0.18), null); st.rectW(x0, y0, x1, -this.vmax, C.alpha(col.warn, 0.18), null); st.line({ x: x0, y: this.vmax }, { x: x1, y: this.vmax }, col.warn, 1.2, [5, 4]); st.line({ x: x0, y: -this.vmax }, { x: x1, y: -this.vmax }, col.warn, 1.2, [5, 4]); }
      st.axes(col, { xlabel: "q", ylabel: "q̇", grid: false });
      st.text("X_obs", { x: 1.5, y: 2.6 }, col.surface, { weight: 700 });
      // 当前状态与刹车轨迹
      const { x: q, y: v } = this.x, ric = this.inRic(q, v);
      const tr = this.brakeTraj(q, v);
      let cut = tr.length;
      for (let i = 0; i < tr.length; i++) if (this.obs.some(([a, b]) => tr[i].x >= a && tr[i].x <= b)) { cut = i + 1; break; }
      st.polyline(tr.slice(0, cut), ric ? col.current : col.ok, 2.4);
      if (this.anim) { const t = this.anim.t, p = { x: this.anim.q0 + this.anim.v0 * t + 0.5 * this.anim.s * this.amax * t * t, y: this.anim.v0 + this.anim.s * this.amax * t }; st.dot(p, 4.5, col.text); }
      st.dot(this.x, 6.5, col.start, col.surface, 2);
      st.text("x(0)", this.x, col.start, { dy: -13, weight: 650 });
    }
    drawLine(ctx, st, col) {
      st.frame(col);
      st.line({ x: -4, y: 0 }, { x: 4, y: 0 }, col.strong, 1);
      for (const [a, b] of this.obs) { if (a === b) st.dot({ x: a, y: 0 }, 5, col.wall); else st.rectW(a, -0.18, b, 0.18, col.wall, null); }
      const { x: q, y: v } = this.x, d = (v * v) / (2 * this.amax), stopQ = v >= 0 ? q + d : q - d;
      st.line({ x: q, y: 0.28 }, { x: stopQ, y: 0.28 }, this.inRic(q, v) ? col.current : col.ok, 2.2);
      st.dot({ x: stopQ, y: 0.28 }, 3, this.inRic(q, v) ? col.current : col.ok);
      let qq = q;
      if (this.anim) { const t = this.anim.t; qq = this.anim.q0 + this.anim.v0 * t + 0.5 * this.anim.s * this.amax * t * t; }
      st.dot({ x: qq, y: 0 }, 7, col.start, col.surface, 2);
      if (this.anim && this.anim.hit && this.anim.t >= this.anim.T - 1e-6) st.text("撞！", { x: qq, y: 0 }, col.bad, { dy: -12, weight: 700 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='velocity-sets']").forEach((el) => el._w = new VelocitySets(el));
    document.querySelectorAll("[data-widget='xric']").forEach((el) => el._w = new XRic(el));
  });
})();
