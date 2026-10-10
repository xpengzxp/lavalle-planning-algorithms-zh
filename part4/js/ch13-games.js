/* 13.5 节：自然的干扰（例 13.15、13.16）与微分对策（例 13.18 杀人司机、例 13.19 两辆车） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------
  // 组件：自然干扰下的前向投影
  // ---------------------------------------------------------------
  class NatureCar {
    constructor(root) {
      this.mode = "car"; this.kind = "const"; this.thmax = 10; this.uphi = 0; this.N = 60; this.T = 4; this.dtN = 0.25; this.seed = 1;
      const body = C.frame(root, "自然干扰下的前向投影", "紫色 = 自然可能造成的结果；蓝色 = 不受干扰时的标称轨迹");
      this.st = new C.Stage({ view: [-0.5, 4.8, -2.4, 2.4], maxW: 620, aspect: 0.6, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segM = C.seg([["car", "例 13.16 简单车：tan(u_φ + γ)"], ["lin", "例 13.15 ẋ = u + θ"]], this.mode, (k) => { this.mode = k; this.run(); });
      this.segK = C.seg([["const", "γ 在开始时选定、之后不变（系统误差）"], ["noise", "每 Δt 重新抽 γ（噪声）"], ["bang", "γ 在 ±θmax 间随机切换（探边界）"]], this.kind, (k) => { this.kind = k; this.run(); });
      this.sTh = C.slider("θmax", 1, 40, 1, this.thmax, (v) => { this.thmax = v; this.run(); }, (v) => (this.mode === "lin" ? (v / 40).toFixed(2) : v + "°"));
      this.sU = C.slider("u_φ", -30, 30, 1, this.uphi, (v) => { this.uphi = v; this.run(); }, (v) => v + "°");
      this.sD = C.slider("Δt", 0.02, 1, 0.02, this.dtN, (v) => { this.dtN = v; this.run(); }, (v) => v.toFixed(2));
      this.stats = [C.stat("t = T 时终点的 y 跨度"), C.stat("终点 y 的标准差"), C.stat("样本数")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.segK),
        h("div", { class: "controls" }, this.sTh, this.sU, this.sD, C.button("重新抽样", () => { this.seed++; this.run(); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.note,
        C.legend([[C.cv("accent"), "标称轨迹（γ = 0 / θ = 0）"], [C.cva("purple", 0.6), "一种自然动作序列下的轨迹"], [C.cv("purple"), "t = 1, 2, 3, 4 时的可能位置"]]));
      this.run();
    }
    run() {
      const r = C.rng(this.seed * 7919), T = this.T, dt = 0.01, steps = Math.round(T / dt);
      const lin = this.mode === "lin", thm = lin ? this.thmax / 40 : this.thmax * DEG, uphi = this.uphi * DEG;
      const fcar = (s, g) => [Math.cos(s[2]), Math.sin(s[2]), Math.tan(C.clamp(uphi + g, -1.5, 1.5))];
      const flin = (s, th) => [1 + th[0], th[1]];   // u = (1, 0)
      const sim = (gen) => {
        let s = [0, 0, 0], P = [{ x: 0, y: 0 }], marks = [], cur = gen(0), next = this.dtN;
        for (let k = 1; k <= steps; k++) {
          const t = k * dt;
          if (this.kind !== "const" && t >= next - 1e-9) { cur = gen(t); next += this.kind === "bang" ? this.dtN * (0.5 + r()) : this.dtN; }
          s = lin ? [s[0] + dt * flin(s, cur)[0], s[1] + dt * flin(s, cur)[1], 0] : C.rk4((x) => fcar(x, cur), s, dt);
          if (k % 5 === 0) P.push({ x: s[0], y: s[1] });
          if (k % 100 === 0) marks.push({ x: s[0], y: s[1] });
        }
        return { P, marks, end: { x: s[0], y: s[1] } };
      };
      const draw1 = () => {
        if (lin) {   // 自然动作 θ 取自半径 θmax 的圆盘
          if (this.kind === "bang") { const a = 2 * Math.PI * r(); return [thm * Math.cos(a), thm * Math.sin(a)]; }
          const a = 2 * Math.PI * r(), rr = thm * Math.sqrt(r()); return [rr * Math.cos(a), rr * Math.sin(a)];
        }
        return this.kind === "bang" ? (r() < 0.5 ? -thm : thm) : (r() * 2 - 1) * thm;
      };
      this.nominal = sim(() => (lin ? [0, 0] : 0));
      this.samples = [];
      for (let i = 0; i < this.N; i++) {
        if (this.kind === "const" && !lin && i < 2) { const g = i === 0 ? -thm : thm; this.samples.push(sim(() => g)); continue; }
        this.samples.push(sim(() => draw1()));
      }
      const ys = this.samples.map((s) => s.end.y), mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      this.stats[0].set((Math.max(...ys) - Math.min(...ys)).toFixed(3));
      this.stats[1].set(Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length).toFixed(3));
      this.stats[2].set(String(this.N));
      this.sD.style.display = this.kind === "const" ? "none" : "";
      this.sU.style.display = lin ? "none" : "";
      this.sTh.refresh();
      this.note.innerHTML = lin
        ? "例 13.15：ẋ = u + θ，θ 取自半径 θmax 的圆盘。不确定性随时间线性增长：t 时刻的非确定前向投影是以标称位置为圆心、半径 θmax·t 的圆盘——在 (x, t) 空间里就是第 12 章图 12.45 的锥。紫点云是抽样得到的若干可能位置（非确定模型只问「哪些可能」，不问概率）。"
        : this.kind === "const"
          ? "例 13.16：自然在开头选定一个转向误差 γ ∈ [−θmax, θmax] 并一直保持（书中说的系统误差，对应建模时的错误或简化）。轨迹像扇子一样张开，最外面两条就是 γ = ±θmax；终点的跨度随时间迅速增大（参考代码第 19 项：θmax = 10°、T = 4 时约 2.7）。"
          : this.kind === "noise"
            ? "每隔 Δt 独立重抽 γ（书中说的噪声）：误差会相互抵消，终点的散布比系统误差小得多；Δt 越小抵消得越彻底。若给 γ 一个概率密度 p(γ)，就得到未来位形上的概率密度 [81]。"
            : "γ 在 ±θmax 之间随机切换，切换时刻也随机：这样的序列更容易碰到非确定前向投影的边界。规划算法在最坏情况分析下必须对这整个集合负责。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 0.5, { axes: false });
      if (this.mode === "lin") for (let t = 1; t <= 4; t++) st.circle({ x: t, y: 0 }, (this.thmax / 40) * t, C.alpha(col.purple, 0.8), 1.2, [4, 3], C.alpha(col.purple, 0.06));
      for (const s of this.samples) st.path(s.P, C.alpha(col.purple, 0.32), 1);
      for (const s of this.samples) for (const m of s.marks) st.dot(m, 2.4, col.purple);
      st.path(this.nominal.P, col.accent, 2.4);
      this.nominal.marks.forEach((m, i) => { st.dot(m, 4, col.accent, col.surface, 1.2); st.text("t=" + (i + 1), m, col.accent, { dy: -12, size: 10.5 }); });
      st.dot({ x: 0, y: 0 }, 5, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：杀人司机（例 13.18）与两辆车（例 13.19）
  // ---------------------------------------------------------------
  class Chauffeur {
    constructor(root) {
      this.s1 = 1; this.s2 = 0.45; this.Lc = 0.5; this.phimax = 40; this.eps = 0.12; this.evMode = "look"; this.game = "hc";
      const body = C.frame(root, "追逃微分对策", "蓝 = 追捕者 P₁（Dubins 车），紫 = 逃跑者 P₂。「鼠标」模式下逃跑者朝鼠标方向跑");
      this.st = new C.Stage({ view: [-5, 5, -3.2, 3.2], maxW: 640, aspect: 0.64, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { this.mouse = p; }, onDown: (p) => { this.mouse = p; return null; } });
      this.segG = C.seg([["hc", "例 13.18 杀人司机（逃跑者是点，可向任意方向）"], ["cars", "例 13.19 两辆车（逃跑者也是 Dubins 车）"]], this.game, (k) => { this.game = k; this.reset(); });
      this.segE = C.seg([["look", "逃跑者：向前看 1.2 s（补充）"], ["flee", "逃跑者：背向逃"], ["mouse", "逃跑者：跟鼠标"]], this.evMode, (k) => { this.evMode = k; this.reset(); });
      this.sS2 = C.slider("s₂ / s₁", 0.2, 0.9, 0.01, this.s2, (v) => { this.s2 = v; this.reset(); }, (v) => v.toFixed(2));
      this.sPm = C.slider("追捕者 φmax", 15, 70, 1, this.phimax, (v) => { this.phimax = v; this.reset(); }, (v) => v + "°");
      this.sE = C.slider("捕获半径 ε", 0.05, 0.4, 0.01, this.eps, (v) => { this.eps = v; this.reset(); }, (v) => v.toFixed(2));
      this.stats = [C.stat("t"), C.stat("距离"), C.stat("最近距离"), C.stat("追捕者 ρmin")];
      this.msg = h("div", { class: "msg info" });
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 开始", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      body.append(h("div", { class: "controls" }, this.segG), h("div", { class: "controls" }, this.segE),
        h("div", { class: "controls" }, this.btn, C.button("重置", () => this.reset()), this.sS2, this.sPm, this.sE),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cv("accent"), "追捕者 P₁ 与它的最小转弯圆"], [C.cv("purple"), "逃跑者 P₂ 与捕获圆（半径 ε）"]]));
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.P = [0, 0, 0]; this.E = [1, 1, this.game === "cars" ? Math.PI / 2 : 0]; this.v = 0; this.t = 0; this.dmin = Infinity; this.over = null;
      this.tp = [{ x: 0, y: 0 }]; this.te = [{ x: 1, y: 1 }]; this.center = { x: 0.5, y: 0.5 }; this.k = 0;
      if (this.btn) this.btn.textContent = "▶ 开始";
      this.update();
    }
    rmin() { return this.Lc / Math.tan(this.phimax * DEG); }
    // 追捕者：朝逃跑者打方向（比例控制，饱和于 φmax）——补充的简单策略
    pstep(P, E, hh) {
      const err = C.wrap(Math.atan2(E[1] - P[1], E[0] - P[0]) - P[2]), u = C.clamp(3 * err, -this.phimax * DEG, this.phimax * DEG);
      return [P[0] + hh * this.s1 * Math.cos(P[2]), P[1] + hh * this.s1 * Math.sin(P[2]), P[2] + (hh * this.s1 / this.Lc) * Math.tan(u)];
    }
    // 逃跑者一步：点模型按方向 v 走；车模型把 v 当作「想去的方向」，有界转向
    estep(E, v, hh) {
      if (this.game === "hc") return [E[0] + hh * this.s2 * Math.cos(v), E[1] + hh * this.s2 * Math.sin(v), v];
      const err = C.wrap(v - E[2]), u = C.clamp(3 * err, -this.phimax * DEG, this.phimax * DEG);
      return [E[0] + hh * this.s2 * Math.cos(E[2]), E[1] + hh * this.s2 * Math.sin(E[2]), E[2] + ((hh * this.s2) / this.Lc) * Math.tan(u)];
    }
    choose() {
      const P = this.P, E = this.E;
      if (this.evMode === "flee") return Math.atan2(E[1] - P[1], E[0] - P[0]);
      if (this.evMode === "mouse") return this.mouse ? Math.atan2(this.mouse.y - E[1], this.mouse.x - E[0]) : E[2];
      let best = -1, bv = 0;
      for (let k = 0; k < 16; k++) {
        const v = (2 * Math.PI * k) / 16; let p = P.slice(), e = E.slice(), dmin = Infinity;
        for (let t = 0; t < 1.2; t += 0.02) { p = this.pstep(p, e, 0.02); e = this.estep(e, v, 0.02); dmin = Math.min(dmin, Math.hypot(p[0] - e[0], p[1] - e[1])); }
        if (dmin > best) { best = dmin; bv = v; }
      }
      return bv;
    }
    step(dt) {
      if (this.over) return false;
      const n = Math.max(1, Math.round(dt / 0.005)), hh = dt / n;
      for (let i = 0; i < n; i++) {
        if (this.k % 10 === 0) this.v = this.choose();
        this.k++;
        this.P = this.pstep(this.P, this.E, hh); this.E = this.estep(this.E, this.v, hh); this.t += hh;
        const d = Math.hypot(this.P[0] - this.E[0], this.P[1] - this.E[1]); this.dmin = Math.min(this.dmin, d);
        if (d < this.eps) { this.over = "caught"; break; }
      }
      if (this.t > 60 && !this.over) this.over = "escaped";
      this.tp.push({ x: this.P[0], y: this.P[1] }); this.te.push({ x: this.E[0], y: this.E[1] });
      if (this.tp.length > 1500) { this.tp.shift(); this.te.shift(); }
      const mx = (this.P[0] + this.E[0]) / 2, my = (this.P[1] + this.E[1]) / 2;
      this.center = { x: this.center.x + 0.08 * (mx - this.center.x), y: this.center.y + 0.08 * (my - this.center.y) };
      this.update();
      return !this.over;
    }
    update() {
      const d = Math.hypot(this.P[0] - this.E[0], this.P[1] - this.E[1]);
      this.stats[0].set(this.t.toFixed(2)); this.stats[1].set(d.toFixed(3)); this.stats[2].set(isFinite(this.dmin) ? this.dmin.toFixed(3) : "–"); this.stats[3].set(this.rmin().toFixed(3));
      if (this.over === "caught") { this.msg.className = "msg bad"; this.msg.textContent = `第 ${this.t.toFixed(2)} 秒被抓住（距离 < ε）。`; }
      else if (this.over === "escaped") { this.msg.className = "msg ok"; this.msg.textContent = `60 秒内没被抓到，最近距离 ${this.dmin.toFixed(3)}。`; }
      else {
        this.msg.className = "msg info";
        this.msg.textContent = this.game === "hc"
          ? "追捕者更快（s₁ = 1 > s₂），但有最小转弯半径。直线逃一定会被追上；聪明的逃跑者在追捕者快撞上来时往侧面一闪——躲进它的转弯圆里，追捕者得绕一圈才能回来，就像斗牛士躲开冲过来的公牛。用默认参数（s₂ = 0.45、φmax = 40°、ε = 0.12）试试三种逃跑者（参考代码第 19 项）。两边都只是简单启发式，不是微分对策的最优策略。"
          : "例 13.19：逃跑者也是 Dubins 车（同样的 L 与 φmax，速度 s₂），转向也受限，所以「侧闪」变难了。";
      }
      const c = this.center; this.st.setView([c.x - 5, c.x + 5, c.y - 3.2, c.y + 3.2]);
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const [x0, x1, y0, y1] = st.view;
      for (let g = Math.ceil(x0); g <= x1; g++) st.line({ x: g, y: y0 }, { x: g, y: y1 }, col.grid, 0.7);
      for (let g = Math.ceil(y0); g <= y1; g++) st.line({ x: x0, y: g }, { x: x1, y: g }, col.grid, 0.7);
      st.path(this.tp, C.alpha(col.accent, 0.7), 1.6); st.path(this.te, C.alpha(col.purple, 0.8), 1.6);
      const P = this.P, E = this.E, r = this.rmin();
      st.circle(C.body2w(P[0], P[1], P[2], 0, r), r, C.alpha(col.accent, 0.5), 1, [4, 4]);
      st.circle(C.body2w(P[0], P[1], P[2], 0, -r), r, C.alpha(col.accent, 0.5), 1, [4, 4]);
      C.drawCar(st, P, col, { L: this.Lc, W: 0.3, phi: 0 });
      st.circle({ x: E[0], y: E[1] }, this.eps, col.purple, 1.4, null, C.alpha(col.purple, 0.15));
      if (this.game === "cars") C.drawCar(st, E, col, { L: this.Lc, W: 0.3, body: col.purple });
      else st.dot({ x: E[0], y: E[1] }, 5, col.purple, col.surface, 1.5);
      if (this.evMode === "mouse" && this.mouse) st.dot(this.mouse, 3, C.alpha(col.purple, 0.6));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='nature-car']").forEach((el) => el._w = new NatureCar(el));
    document.querySelectorAll("[data-widget='chauffeur']").forEach((el) => el._w = new Chauffeur(el));
  });
})();
