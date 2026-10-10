/* 14.7 节：基于梯度的轨迹优化——单次打靶，u(t) = w1 + w2 t（式 14.47） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  class Shooting {
    constructor(root) {
      this.tf = 3; this.goal = { x: 1.5, y: 1.5 }; this.obs = false; this.O = { x: 1.25, y: 0.55, r: 0.38 }; this.w = { x: 0.5, y: 0 }; this.hist = [];
      const body = C.frame(root, "打靶法与局部极小", "(14.47)：单位速度的小车，转向角速度 u(t) = w₁ + w₂t，t_F = 3；右图是参数空间里的代价，点一下选初值");
      this.st = new C.Stage({ view: [-0.5, 3, -1, 2.5], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.land = new C.Stage({
        view: [-2.5, 2.5, -2, 8], aspect: 1, maxW: 400, stretch: true, padL: 28, padB: 18, onDraw: (ctx, st, col) => this.drawLand(ctx, st, col),
        onDown: (p) => { this.w = { x: C.clamp(p.x, -2.5, 2.5), y: C.clamp(p.y, -2, 8) }; this.hist = [{ ...this.w }]; this.runner.stop(); this.render(); return null; },
      });
      this.cObs = C.chip("加一个圆形障碍（罚函数）", false, (on) => { this.obs = on; this.hist = [{ ...this.w }]; this.computeLand(); this.render(); });
      this.runner = new C.Runner(() => { const more = this.gdStep(); this.render(); return more && this.hist.length < 400; });
      this.stats = { w: C.stat("(w₁, w₂)"), J: C.stat("代价 J"), miss: C.stat("终点误差 ‖x(t_F) − x_G‖"), it: C.stat("迭代") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, h("div", { class: "chips" }, this.cObs), C.button("梯度下降", () => this.runner.start(), "small primary"), C.button("一步", () => { this.gdStep(); this.render(); }, "small"), C.button("暂停", () => this.runner.stop(), "small")),
        h("div", { class: "split" }, this.st.wrap, this.land.wrap), h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cv("accent"), "代价（由浅到深 = 由小到大，对数刻度）"], [C.cv("path"), "当前轨迹"], [C.cv("current"), "梯度下降的足迹"]]));
      this.hist = [{ ...this.w }];
      this.computeLand(); this.render();
    }
    traj(w1, w2, n = 120) {
      let x = 0, y = 0, th = 0; const hh = this.tf / n, P = [{ x, y }];
      for (let k = 0; k < n; k++) { const om = w1 + w2 * (k + 0.5) * hh; x += hh * Math.cos(th + (om * hh) / 2); y += hh * Math.sin(th + (om * hh) / 2); th += om * hh; P.push({ x, y }); }
      return P;
    }
    cost(w1, w2) {
      const P = this.traj(w1, w2), e = P[P.length - 1];
      let J = (e.x - this.goal.x) ** 2 + (e.y - this.goal.y) ** 2;   // 终止条件 x(t_F) = x_G 写成罚项
      if (this.obs) for (const p of P) { const d = Math.hypot(p.x - this.O.x, p.y - this.O.y), pen = this.O.r + 0.08 - d; if (pen > 0) J += 4 * pen * pen; }
      return J;
    }
    grad(w) { const e = 1e-5; return { x: (this.cost(w.x + e, w.y) - this.cost(w.x - e, w.y)) / (2 * e), y: (this.cost(w.x, w.y + e) - this.cost(w.x, w.y - e)) / (2 * e) }; }
    gdStep() {
      const w = this.w, g = this.grad(w), c0 = this.cost(w.x, w.y); let step = 0.2;
      if (Math.hypot(g.x, g.y) < 1e-7) return false;
      // 回溯线搜索；新参数投影回画出来的范围
      while (step > 1e-10) { const w2 = { x: C.clamp(w.x - step * g.x, -2.5, 2.5), y: C.clamp(w.y - step * g.y, -2, 8) }; if (this.cost(w2.x, w2.y) < c0) { this.w = w2; this.hist.push({ ...w2 }); return c0 - this.cost(w2.x, w2.y) > 1e-12; } step /= 2; }
      return false;
    }
    computeLand() {
      const n = (this.n = 90), V = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) V[j * n + i] = Math.log10(1e-4 + this.cost(-2.5 + ((i + 0.5) / n) * 5, -2 + ((j + 0.5) / n) * 10));
      this.V = V;
    }
    render() {
      const J = this.cost(this.w.x, this.w.y), P = this.traj(this.w.x, this.w.y), e = P[P.length - 1];
      this.stats.w.set(`(${this.w.x.toFixed(3)}, ${this.w.y.toFixed(3)})`); this.stats.J.set(J.toExponential(2)); this.stats.miss.set(Math.hypot(e.x - this.goal.x, e.y - this.goal.y).toFixed(3)); this.stats.it.set(this.hist.length - 1);
      this.msg.innerHTML = "整条轨迹只由两个参数决定，优化就是在 (w₁, w₂) 平面里往代价下降的方向走：每一步积分一次 (14.1) 得到终点，数值地求梯度，沿负梯度方向走一小步（带回溯线搜索）。终止条件 x(t_F) = x_G 在这里写成罚项。" +
        " 右图的代价有好几个「坑」：从 (0.5, 0) 出发会收敛到真正的解，从 (0, 0) 或 (−0.5, 0) 出发会停在终点还差得远的<b>局部极小</b>（参考代码第 14 项）。" +
        (this.obs ? " 加了障碍后，绕左边还是绕右边是两个不同的同伦类：梯度法只能在初值所在的同伦类里改进，跳不到另一类去；罚函数也让代价曲面多出新的坑。" : "") +
        " 小改动 w₁ 会让后面的状态改变很多——这就是多段打靶（multiple shooting）、配点法（collocation）要解决的问题。";
      this.st.draw(); this.land.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.obs) st.circle(this.O, this.O.r, C.alpha(col.wall, 0.82), col.wall, 1);
      const n = this.hist.length;
      this.hist.forEach((w, k) => { if (k % Math.max(1, Math.floor(n / 12)) === 0 && k < n - 1) st.polyline(this.traj(w.x, w.y), C.alpha(col.muted, 0.35), 1); });
      st.polyline(this.traj(this.w.x, this.w.y), col.path, 2.8);
      st.car({ x: 0, y: 0, th: 0 }, 0.22, col.start, col.text);
      st.mark(this.goal, col.goal, "x_G", col);
    }
    drawLand(ctx, st, col) {
      st.frame(col);
      if (this.V) {
        let lo = Infinity, hi = -Infinity; for (const v of this.V) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        C.heat(st, this.n, this.n, [-2.5, 2.5, -2, 8], this.V, (v) => { const c = C.blueRamp(col, (v - lo) / (hi - lo)); return [c[0], c[1], c[2], 255]; });
      }
      st.axes(col, { xlabel: "w₁", ylabel: "w₂", grid: false, xticks: [-2, -1, 0, 1, 2], yticks: [-2, 0, 2, 4, 6, 8] });
      st.polyline(this.hist, col.current, 2);
      for (const w of this.hist.slice(0, 1)) st.dot(w, 4, null, col.current, 2);
      st.dot(this.w, 5, col.current, col.surface, 1.5);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='shooting']").forEach((el) => el._w = new Shooting(el));
  });
})();
