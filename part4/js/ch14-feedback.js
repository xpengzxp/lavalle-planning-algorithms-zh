/* 14.5 节：带插值的值迭代 (14.27) 与局部算子 (14.28)，在双积分器的相平面上 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // 补充：双积分器回到原点静止的最短时间（开关曲线 q = −q̇|q̇|/2），参考代码第 8 项
  function tStar(q, v) {
    const s = q + (v * Math.abs(v)) / 2;
    if (Math.abs(s) < 1e-12) return Math.abs(v);
    return s > 0 ? v + 2 * Math.sqrt(q + (v * v) / 2) : -v + 2 * Math.sqrt(-q + (v * v) / 2);
  }

  class VIInterp {
    constructor(root) {
      this.n = 61; this.dt = 0.1; this.goalR = 0.12; this.obs = false; this.five = false; this.M = 100; this.lim = 3;
      this.start = { x: 1.5, y: 0.8 }; this.traj = null; this.iter = 0;
      const body = C.frame(root, "带插值的值迭代", "14.5 节：P = 网格样本，G*(x_{k+1}) 用双线性插值；点相平面里任一点执行反馈计划 (14.28)");
      this.st = new C.Stage({
        view: [-3, 3, -3, 3], aspect: 0.82, maxW: 560, stretch: true, padL: 26, padB: 18, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.start = { x: C.clamp(p.x, -2.95, 2.95), y: C.clamp(p.y, -2.95, 2.95) }; this.execute(); return null; },
      });
      this.sN = C.slider("每轴样本数", 21, 101, 10, this.n, (v) => { this.n = v; this.reset(); });
      this.sDt = C.slider("Δt", 0.04, 0.4, 0.02, this.dt, (v) => { this.dt = v; this.reset(); }, (v) => v.toFixed(2));
      this.cObs = C.chip("障碍：C 中的区间 [1.0, 1.3]", false, (on) => { this.obs = on; this.reset(); });
      this.cFive = C.chip("U_d 加上 ±½", false, (on) => { this.five = on; this.reset(); });
      this.runner = new C.Runner(() => { const ch = this.sweep(); this.render(); return ch > 1e-6 && this.iter < 600; });
      this.stats = { it: C.stat("迭代轮数"), ch: C.stat("本轮最大变化"), g: C.stat("起点处 G* / T*"), ex: C.stat("执行反馈计划用时") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sN, this.sDt, h("div", { class: "chips" }, this.cObs, this.cFive)),
        h("div", { class: "controls" }, C.button("一轮", () => { this.sweep(); this.render(); }, "small"), C.button("迭代到收敛", () => this.runner.start(), "small primary"), C.button("重置", () => this.reset(), "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "G*（由浅到深 = 由小到大）"], [C.cv("badSoft"), "G* = ∞"], [C.cv("warn"), "开关曲线 q = −q̇|q̇|/2（补充：无障碍时的最优切换）"], [C.cv("path"), "反馈计划的执行轨迹"]]));
      this.reset();
      // 打开页面时先迭代到收敛，并从默认起点执行一次反馈计划；「重置」可以回到全 ∞ 的初始状态一步步看
      for (let k = 0; k < 600 && this.sweep() > 1e-6; k++);
      this.execute();
    }
    acts() { return this.five ? [-1, -0.5, 0, 0.5, 1] : [-1, 0, 1]; }
    inGoal(q, v) { return Math.hypot(q, v) <= this.goalR; }
    bad(q) { return this.obs && q >= 1.0 && q <= 1.3; }
    reset() {
      this.runner && this.runner.stop();
      const n = this.n, L = this.lim; this.hx = (2 * L) / (n - 1);
      this.xs = Array.from({ length: n }, (_, i) => -L + i * this.hx);
      this.G = new Float64Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) this.G[j * n + i] = this.inGoal(this.xs[i], this.xs[j]) ? 0 : this.M;
      this.iter = 0; this.lastChange = Infinity; this.traj = null;
      this.render();
    }
    // 双线性插值；目标里取 0，越界或进入 X_obs 取「∞」= M
    interp(q, v) {
      if (this.inGoal(q, v)) return 0;
      const L = this.lim, n = this.n;
      if (q < -L || q > L || v < -L || v > L || this.bad(q)) return this.M;
      const fi = (q + L) / this.hx, fj = (v + L) / this.hx, i0 = Math.min(Math.floor(fi), n - 2), j0 = Math.min(Math.floor(fj), n - 2), a = fi - i0, b = fj - j0, G = this.G;
      return (1 - a) * (1 - b) * G[j0 * n + i0] + a * (1 - b) * G[j0 * n + i0 + 1] + (1 - a) * b * G[(j0 + 1) * n + i0] + a * b * G[(j0 + 1) * n + i0 + 1];
    }
    // f_d：常值 u 走 Δt 的闭式解；途中进入 X_obs 则代价无穷（l_d = ∞）
    fd(q, v, u) {
      const dt = this.dt, q2 = q + v * dt + 0.5 * u * dt * dt;
      if (this.obs) for (let k = 1; k <= 4; k++) { const t = (dt * k) / 4; if (this.bad(q + v * t + 0.5 * u * t * t)) return null; }
      return { q: q2, v: v + u * dt };
    }
    sweep() {
      const n = this.n, G = this.G, A = this.acts(); let change = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const q = this.xs[i], v = this.xs[j];
        if (this.inGoal(q, v) || this.bad(q)) continue;
        let best = this.M;
        for (const u of A) { const x2 = this.fd(q, v, u); if (!x2) continue; const c = this.dt + this.interp(x2.q, x2.v); if (c < best) best = c; }
        change = Math.max(change, Math.abs(G[j * n + i] - best)); G[j * n + i] = best;
      }
      this.iter++; this.lastChange = change;
      if (this.traj) this.execute(true);
      return change;
    }
    // 局部算子 (14.28)：π(x) = argmin_u { l_d(x,u) + G*(f_d(x,u)) }
    execute(silent) {
      const A = this.acts(); let q = this.start.x, v = this.start.y; const P = [{ x: q, y: v }]; let t = 0, ok = false;
      for (let k = 0; k < 600; k++) {
        if (this.inGoal(q, v)) { ok = true; break; }
        let best = Infinity, bu = 0, bx = null;
        for (const u of A) { const x2 = this.fd(q, v, u); if (!x2) continue; const c = this.dt + this.interp(x2.q, x2.v); if (c < best) { best = c; bu = u; bx = x2; } }
        if (!bx || best >= 0.9 * this.M) break;
        for (let s = 1; s <= 4; s++) { const tt = (this.dt * s) / 4; P.push({ x: q + v * tt + 0.5 * bu * tt * tt, y: v + bu * tt }); }
        q = bx.q; v = bx.v; t += this.dt;
      }
      this.traj = { P, t, ok };
      if (!silent) this.render();
    }
    render() {
      this.stats.it.set(this.iter); this.stats.ch.set(this.lastChange === Infinity ? "–" : this.lastChange.toExponential(1));
      const g = this.interp(this.start.x, this.start.y);
      this.stats.g.set(`${g >= 0.9 * this.M ? "∞" : g.toFixed(3)} / ${this.obs ? "—" : tStar(this.start.x, this.start.y).toFixed(3)}`);
      this.stats.ex.set(this.traj ? (this.traj.ok ? this.traj.t.toFixed(2) : '<span class="no">没到目标</span>') : "点一下相平面");
      this.msg.innerHTML = "反向值迭代从最终阶段开始：目标样本 G* = 0，其余为 ∞（这里用一个大数代替 ∞，否则只要插值的一个角是 ∞，整片区域都会卡住——见参考代码第 12 项）。每一轮对 P 中每个样本按 (14.27) 取最小，G*(x_{k+1}) 用相邻四个样本插值。代价值稳定后得到的 G* 就是一个<b>导航函数</b>，用局部算子 (14.28) 就能从任何状态得到反馈动作。" +
        (this.obs ? " 加了障碍后，障碍左边、向右冲得太快的状态 G* = ∞：它们落在 X_ric 里，什么反馈都救不了。" : " 迭代收敛后，G* 的「折痕」正好落在补充画出的开关曲线上：bang-bang 控制在那里从全力加速切换到全力减速。") +
        " 注意相平面被截在 [−3, 3]² 里：右上、左下两角那些冲得太快、来不及在边界前停住的状态也是 ∞——越界在这里就相当于碰撞，紧贴这条边的样本插值后代价很大（深色的一圈）。" +
        " 这种方法只适合很低维的 X：动力学会让维数翻倍，平面里的刚体就有 dim X = 6，已经到了实用的上限。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      // 色标用有限值的 85% 分位数：贴着 ∞ 边界的样本插值后会混进很大的数，不能让它们决定色标
      const n = this.n, M = this.M, fin = [];
      for (let k = 0; k < n * n; k++) if (this.G[k] < 0.9 * M) fin.push(this.G[k]);
      fin.sort((a, b) => a - b); const mx = fin.length ? fin[Math.floor(fin.length * 0.85)] : 0;
      const bs = C.rgb(col.badSoft);
      const h2 = this.hx / 2;
      C.heat(st, n, n, [-this.lim - h2, this.lim + h2, -this.lim - h2, this.lim + h2], this.G, (v) => (v >= 0.9 * M ? [bs[0], bs[1], bs[2], 255] : C.blueRamp(col, mx > 0 ? v / mx : 0)));
      if (this.obs) st.rectW(1.0, -3, 1.3, 3, C.alpha(col.wall, 0.8), null);
      if (!this.obs) {
        const P1 = [], P2 = []; for (let k = 0; k <= 40; k++) { const v = (3 * k) / 40; P1.push({ x: -(v * v) / 2, y: v }); P2.push({ x: (v * v) / 2, y: -v }); }
        st.polyline(P1, col.warn, 1.6, [6, 4]); st.polyline(P2, col.warn, 1.6, [6, 4]);
      }
      st.axes(col, { xlabel: "q", ylabel: "q̇", grid: false });
      st.circle({ x: 0, y: 0 }, this.goalR, C.alpha(col.goal, 0.35), col.goal, 1.5);
      if (this.traj) st.polyline(this.traj.P, col.path, 2.6);
      st.mark(this.start, col.start, "x", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='vi-interp']").forEach((el) => el._w = new VIInterp(el));
  });
})();
