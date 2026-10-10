/* 13.2 节：相平面（(13.32)、双积分器、摆、线性系统）与漂移；在动作前加积分器；非完整积分器 (13.43) */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;

  // ---------------------------------------------------------------
  // 组件：相平面
  // ---------------------------------------------------------------
  const SYS = {
    eq32: { name: "(13.32) ÿ − 3ẏ + y = 0", view: [-3, 3, -3, 3], x0: [0.4, -0.6], T: 6 },
    dbl: { name: "(13.35) 双积分器 q̈ = u", view: [-3, 3, -3, 3], x0: [-2, 1.5], T: 8 },
    pend: { name: "(13.62)–(13.65) 摆", view: [-Math.PI, Math.PI, -7, 7], x0: [2.6, 0], T: 12 },
    lin: { name: "线性 ẋ = Ax（补充）", view: [-3, 3, -3, 3], x0: [2, 1], T: 8 },
  };

  class PhasePlane {
    constructor(root) {
      this.k = SYS[root.dataset.preset] ? root.dataset.preset : "eq32"; this.u = 0; this.kd = 0; this.uf = 0; this.gL = 9.8;
      this.A = [[-0.3, 1], [-1, -0.3]];
      this.x = SYS[this.k].x0.slice(); this.t = 0; this.trace = []; this.hist = [];
      const body = C.frame(root, "相平面", "点击相平面放一个初始状态 (x₁, x₂) = (q, q̇)；绿色 = 该点允许的速度集合 {f(x, u) | u ∈ U}");
      this.st = new C.Stage({ view: SYS[this.k].view, maxW: 430, aspect: 1, iso: false, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.x = [p.x, p.y]; this.t = 0; this.trace = [{ ...p }]; this.hist = []; this.runner.start(); this.btn.textContent = "❚❚ 暂停"; return null; },
        cursor: () => "crosshair" });
      this.plot = new C.TimePlot({ aspect: 0.45, maxW: 360, ylabel: "x₁ = q（实线）  x₂ = q̇（虚线）" });
      this.pend = new C.Stage({ view: [-1.3, 1.3, -1.3, 1.3], maxW: 170, aspect: 1, onDraw: (ctx, st, col) => this.drawPend(ctx, st, col) });
      this.segK = C.seg(Object.entries(SYS).map(([k, s]) => [k, s.name]), this.k, (k) => { this.k = k; this.st.setView(SYS[k].view); this.reset(); });
      this.sU = C.slider("u", -1, 1, 0.05, 0, (v) => { this.u = v; this.st.draw(); }, (v) => v.toFixed(2));
      this.sK = C.slider("阻尼 k", 0, 1.5, 0.05, 0, (v) => { this.kd = v; this.st.draw(); }, (v) => v.toFixed(2));
      this.sF = C.slider("推力 u_f", -8, 8, 0.25, 0, (v) => { this.uf = v; this.st.draw(); }, (v) => v.toFixed(2));
      this.linS = ["a₁₁", "a₁₂", "a₂₁", "a₂₂"].map((lab, i) => C.slider(lab, -2, 2, 0.1, this.A[i >> 1][i & 1], (v) => { this.A[i >> 1][i & 1] = v; this.update(); }, (v) => v.toFixed(1)));
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 继续"; });
      this.btn = C.button("▶ 播放", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 继续"; }, "primary");
      this.stats = [C.stat("t"), C.stat("x = (x₁, x₂)"), C.stat("")];
      this.note = h("p", { class: "small" });
      this.ctrl = h("div", { class: "controls" });
      body.append(h("div", { class: "controls" }, this.segK), this.ctrl,
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { style: "display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap" }, h("div", { style: "flex:1;min-width:160px" }, h("div", { class: "stats" }, this.stats)), this.pend.wrap), this.plot.wrap, this.note)),
        C.legend([[C.cva("muted", 0.8), "向量场 f(x, u)（当前 u）"], [C.cv("ok"), "允许速度集合 {f(x,u)}"], [C.cv("accent"), "状态轨迹"], [C.cv("bad"), "平衡点"]]));
      this.reset();
    }
    f(x) {
      const [a, b] = x;
      switch (this.k) {
        case "eq32": return [b, 3 * b - a];
        case "dbl": return [b, this.u];
        case "pend": return [b, -this.gL * Math.sin(a) - this.kd * b + this.uf];   // m = L = 1：(13.65)
        case "lin": return [this.A[0][0] * a + this.A[0][1] * b, this.A[1][0] * a + this.A[1][1] * b];
      }
    }
    // 动作集合在 x 处给出的速度：返回线段端点（无动作时返回 null）
    vset(x) {
      if (this.k === "dbl") return [[x[1], -1], [x[1], 1]];
      if (this.k === "pend") { const base = -this.gL * Math.sin(x[0]) - this.kd * x[1]; return [[x[1], base - 8], [x[1], base + 8]]; }
      return null;
    }
    reset() {
      this.runner && this.runner.stop();
      this.x = SYS[this.k].x0.slice(); this.t = 0; this.trace = [{ x: this.x[0], y: this.x[1] }]; this.hist = [];
      this.ctrl.innerHTML = "";
      this.ctrl.append(this.btn, C.button("重置", () => this.reset()));
      if (this.k === "dbl") this.ctrl.append(this.sU);
      if (this.k === "pend") this.ctrl.append(this.sK, this.sF);
      if (this.k === "lin") this.ctrl.append(...this.linS, C.button("中心", () => this.setA([[0, 1], [-1, 0]])), C.button("稳定焦点", () => this.setA([[-0.3, 1], [-1, -0.3]])), C.button("鞍点", () => this.setA([[1, 0], [0, -1]])));
      this.pend.wrap.style.display = this.k === "pend" ? "" : "none";
      this.btn.textContent = "▶ 播放";
      this.update();
    }
    setA(A) { this.A = A; A.flat().forEach((v, i) => this.linS[i].set(v)); this.update(); }
    step(dt) {
      const n = 8;
      for (let i = 0; i < n; i++) { this.x = C.rk4((x) => this.f(x), this.x, dt / n); this.t += dt / n; }
      if (this.k === "pend") { if (this.x[0] > Math.PI) { this.x[0] -= 2 * Math.PI; this.trace.push(null); } if (this.x[0] < -Math.PI) { this.x[0] += 2 * Math.PI; this.trace.push(null); } }
      this.trace.push({ x: this.x[0], y: this.x[1] }); if (this.trace.length > 3000) this.trace.shift();
      this.hist.push([this.t, this.x[0], this.x[1]]); if (this.hist.length > 1500) this.hist.shift();
      this.update();
      const [x0, x1, y0, y1] = this.st.view, big = Math.max(x1 - x0, y1 - y0) * 4;
      if (Math.abs(this.x[0]) > big || Math.abs(this.x[1]) > big) return false;
      return true;
    }
    update() {
      const x = this.x;
      this.stats[0].set(this.t.toFixed(2));
      this.stats[1].set(`(${x[0].toFixed(2)}, ${x[1].toFixed(2)})`);
      const notes = {
        eq32: "(13.29) 是二阶的；令 x₁ = y、x₂ = ẏ 后变成两个一阶方程 (13.32)，即 ℝ² 上的一个向量场。A = [[0,1],[−1,3]] 的特征值 (3 ± √5)/2 都为正，所以除了原点，所有轨迹都远离原点（参考代码第 8 项）。",
        dbl: "双积分器：动作直接设定加速度。绿色竖线是 u ∈ [−1, 1] 时允许的速度——它横向偏离原点 x₂ 那么多。只要 x₂ ≠ 0，绿线就不过原点：<b>任何动作都无法让 ẋ = 0</b>，这就是漂移 drift。u 为常数时轨迹是抛物线（两次积分常数）。",
        pend: "摆 (13.62)：x₁ = θ，x₂ = θ̇（取 m = L = 1，g/L = 9.8）。k = 0 时能量守恒，轨迹是闭曲线（摆动）或越过顶端的波浪线（翻转）；加阻尼 k 后螺旋收敛到最低点 (0,0)。u_f 是垂直于摆绳的推力 (13.65)。",
        lin: "线性系统 ẋ = Ax（u = 0）。相图的形状由 A 的特征值决定：纯虚数 → 中心（闭轨道），负实部复数 → 稳定焦点，一正一负 → 鞍点。",
      };
      this.note.innerHTML = notes[this.k];
      if (this.k === "pend") {
        const E = 0.5 * x[1] * x[1] - this.gL * Math.cos(x[0]);
        this.stats[2].label("能量 ½θ̇² − (g/L)cos θ"); this.stats[2].set(E.toFixed(3));
      } else if (this.k === "lin" || this.k === "eq32") {
        const A = this.k === "lin" ? this.A : [[0, 1], [-1, 3]];
        const tr = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0], disc = (tr * tr) / 4 - det;
        const ev = disc >= 0 ? `${(tr / 2 + Math.sqrt(disc)).toFixed(2)}, ${(tr / 2 - Math.sqrt(disc)).toFixed(2)}` : `${(tr / 2).toFixed(2)} ± ${Math.sqrt(-disc).toFixed(2)}i`;
        this.stats[2].label("A 的特征值"); this.stats[2].set(ev);
      } else { this.stats[2].label("ẋ 能为 0 吗？"); this.stats[2].set(Math.abs(x[1]) < 1e-9 ? "能（u = 0）" : "不能（漂移）"); }
      this.plot.set([{ data: this.hist.map((r) => [r[0], r[1]]), color: "accent" }, { data: this.hist.map((r) => [r[0], r[2]]), color: "accent", dash: [4, 3], lw: 1.2 }],
        this.hist.length ? [this.hist[0][0], Math.max(this.hist[0][0] + 2, this.t)] : [0, 2]);
      this.st.draw(); this.pend.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.grid(col, this.k === "pend" ? Math.PI / 2 : 1);
      st.needles((p) => { const v = this.f([p.x, p.y]); return { x: v[0], y: v[1] }; }, col, C.alpha(col.muted, 0.75), 17, 0.7);
      // 平衡点
      if (this.k === "pend") { const s = this.uf / this.gL; if (Math.abs(s) <= 1) { const a = Math.asin(s); [a, C.wrap(Math.PI - a)].forEach((e) => st.dot({ x: e, y: 0 }, 4.5, col.bad)); } }   // sin θ = u_f/(g/L)
      else if (this.k === "dbl") { if (Math.abs(this.u) < 1e-9) st.line({ x: -3, y: 0 }, { x: 3, y: 0 }, C.alpha(col.bad, 0.6), 2); }
      else st.dot({ x: 0, y: 0 }, 4.5, col.bad);
      let seg = [];
      for (const p of this.trace) { if (!p) { st.path(seg, col.accent, 2); seg = []; } else seg.push(p); }
      st.path(seg, col.accent, 2);
      const x = this.x, p = { x: x[0], y: x[1] };
      const vs = this.vset(x), sc = this.k === "pend" ? 0.12 : 0.35;
      if (vs) { const a = { x: p.x + sc * vs[0][0], y: p.y + sc * vs[0][1] }, b = { x: p.x + sc * vs[1][0], y: p.y + sc * vs[1][1] }; st.line(a, b, col.ok, 4); st.line(p, a, C.alpha(col.ok, 0.4), 1, [3, 3]); st.line(p, b, C.alpha(col.ok, 0.4), 1, [3, 3]); }
      const v = this.f(x);
      st.arrow(p, { x: p.x + sc * v[0], y: p.y + sc * v[1] }, col.warn, 2.2, 8);
      st.dot(p, 6, col.accent, col.surface, 2);
      const lab = this.k === "pend" ? ["θ", "θ̇"] : ["x₁", "x₂"];
      const [x0, x1, y0, y1] = st.view;
      st.text(lab[0], { x: x1, y: 0 }, col.muted, { dx: -10, dy: -10, weight: 650 });
      st.text(lab[1], { x: 0, y: y1 }, col.muted, { dx: 12, dy: 10, weight: 650 });
    }
    drawPend(ctx, st, col) {
      st.frame(col);
      const th = this.x[0], b = { x: Math.sin(th), y: -Math.cos(th) };
      st.line({ x: 0, y: 0.15 }, { x: 0, y: -1.25 }, C.alpha(col.muted, 0.6), 1, [3, 3]);
      st.line({ x: 0, y: 0 }, b, col.text, 2);
      if (Math.abs(this.uf) > 1e-9) st.arrow(b, { x: b.x + 0.05 * this.uf * Math.cos(th), y: b.y + 0.05 * this.uf * Math.sin(th) }, col.warn, 2, 7);
      st.dot({ x: 0, y: 0 }, 3, col.text);
      st.dot(b, 9, col.ok, col.surface, 1.5);
    }
  }

  // ---------------------------------------------------------------
  // 组件：在转向前加积分器（(13.15) → (13.47) → (13.48)）
  // ---------------------------------------------------------------
  class Integrators {
    constructor(root) {
      this.L = 1; this.cmdMode = "square"; this.wmax = 1.2; this.amax = 4; this.phiMax = 0.6;
      const body = C.frame(root, "给转向角加积分器", "三辆车收到同一串转向命令（速度都固定为 1）");
      this.st = new C.Stage({ view: [-1, 15, -4, 4], maxW: 640, aspect: 0.5, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.plot = new C.TimePlot({ aspect: 0.3, maxW: 640, ylabel: "φ(t)：命令（橙）与三种模型的实际转向角", yrange: [-0.75, 0.75] });
      this.segC = C.seg([["square", "方波命令（左右急打）"], ["hold", "按住按钮手动给命令"]], this.cmdMode, (k) => { this.cmdMode = k; this.reset(); });
      this.sW = C.slider("|u_ω| ≤", 0.2, 4, 0.1, this.wmax, (v) => { this.wmax = v; }, (v) => v.toFixed(1));
      this.sA = C.slider("|u_α| ≤", 0.5, 12, 0.5, this.amax, (v) => { this.amax = v; }, (v) => v.toFixed(1));
      this.hold = 0;
      this.holds = h("span", { class: "controls", style: "margin:0" }, C.holdButton("◀ 左打", () => this.hold = 1, () => this.hold = 0), C.holdButton("右打 ▶", () => this.hold = -1, () => this.hold = 0));
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 开车"; });
      this.btn = C.button("▶ 开车", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 开车"; }, "primary");
      body.append(h("div", { class: "controls" }, this.segC, this.holds, this.btn, C.button("重置", () => this.reset())),
        h("div", { class: "controls" }, this.sW, this.sA),
        this.st.wrap, this.plot.wrap,
        h("p", { class: "small" }, "k = 0（13.15）：转向角就是动作，可以瞬间跳变，路径的曲率也跟着跳变（路径在切换点只有 C¹）。k = 1（13.47）：动作是转向角速度 u_ω，有界时 φ(t) 连续且 Lipschitz。k = 2（13.48）：动作是转向角加速度 u_α，φ(t) 变成 C¹ 光滑。每多一个积分器，原动作就多一阶光滑——代价是状态维数加一。"),
        C.legend([[C.cv("warn"), "转向命令"], [C.cva("accent", 0.55), "k = 0：φ = 命令（点线）"], [C.cva("accent", 0.8), "k = 1：φ̇ = u_ω（虚线）"], [C.cv("accent"), "k = 2：φ̈ = u_α（实线）"]]));
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.t = 0;
      this.cars = [0, 1, 2].map(() => ({ s: [0, 0, 0], phi: 0, om: 0, trace: [{ x: 0, y: 0 }] }));
      this.hist = []; this.holds.style.display = this.cmdMode === "hold" ? "" : "none";
      this.update();
    }
    cmd(t) { return this.cmdMode === "square" ? (Math.floor(t / 1.6) % 2 === 0 ? this.phiMax : -this.phiMax) : this.hold * this.phiMax; }
    step(dt) {
      const n = 10, hh = dt / n;
      for (let i = 0; i < n; i++) {
        const c = this.cmd(this.t);
        const [c0, c1, c2] = this.cars;
        c0.phi = c;                                                        // k = 0
        c1.phi += hh * C.clamp(10 * (c - c1.phi), -this.wmax, this.wmax);  // k = 1：u_ω 有界
        const ua = C.clamp(40 * (c - c2.phi) - 10 * c2.om, -this.amax, this.amax);
        c2.om += hh * ua; c2.phi += hh * c2.om;                            // k = 2：u_α 有界
        for (const car of this.cars) car.s = C.rk4((x) => [Math.cos(x[2]), Math.sin(x[2]), Math.tan(car.phi) / this.L], car.s, hh);
        this.t += hh;
      }
      for (const car of this.cars) car.trace.push({ x: car.s[0], y: car.s[1] });
      this.hist.push([this.t, this.cmd(this.t), this.cars[0].phi, this.cars[1].phi, this.cars[2].phi]);
      if (this.hist.length > 900) this.hist.shift();
      this.update();
      if (this.cars[2].s[0] > 15.5) return false;
      return true;
    }
    update() {
      const H = this.hist, xr = H.length ? [H[0][0], Math.max(H[0][0] + 6, this.t)] : [0, 6];
      this.plot.set([
        { data: H.map((r) => [r[0], r[1]]), color: "warn", lw: 1.4 },
        { data: H.map((r) => [r[0], r[2]]), color: "accent", lw: 1.2, dash: [1.5, 3] },
        { data: H.map((r) => [r[0], r[3]]), color: "accent", lw: 1.6, dash: [6, 4] },
        { data: H.map((r) => [r[0], r[4]]), color: "accent", lw: 2.2 },
      ], xr);
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      const styles = [[C.alpha(col.accent, 0.55), 1.4, [1.5, 3]], [C.alpha(col.accent, 0.8), 1.8, [6, 4]], [col.accent, 2.4, null]];
      this.cars.forEach((car, i) => st.path(car.trace, styles[i][0], styles[i][1], styles[i][2]));
      this.cars.forEach((car, i) => C.drawCar(st, car.s, col, { L: this.L * 0.8, W: 0.45, phi: car.phi, body: styles[i][0], lw: 1.2 }));
    }
  }

  // ---------------------------------------------------------------
  // 组件：非完整积分器 (13.43)：Δx₃ = 2 × 有向面积
  // ---------------------------------------------------------------
  class Brockett {
    constructor(root) {
      this.reset0();
      const body = C.frame(root, "非完整积分器：ẋ₁ = u₁，ẋ₂ = u₂，ẋ₃ = x₁u₂ − x₂u₁", "在左图从当前点出发拖出一条路径（u 就是拖动速度）；右图是三维中的同一条路径");
      this.L = new C.Stage({ view: [-2.5, 2.5, -2.5, 2.5], maxW: 380, onDraw: (ctx, st, col) => this.drawL(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.x[0], p.y - this.x[1]) < 0.35 ? "d" : null),
        onMove: (p) => this.moveTo(C.clamp(p.x, -2.45, 2.45), C.clamp(p.y, -2.45, 2.45)),
        cursor: (p) => (Math.hypot(p.x - this.x[0], p.y - this.x[1]) < 0.35 ? "grab" : null) });
      this.V = new C.View3D({ R: 3, az: -0.7, el: 0.35, maxW: 380, aspect: 1, onDraw: (ctx, V, col) => this.drawR(ctx, V, col) });
      this.sR = C.slider("圆半径", 0.2, 1.5, 0.05, 0.8, () => {}, (v) => v.toFixed(2));
      this.stats = [C.stat("x = (x₁, x₂, x₃)"), C.stat("2 × 扫过的有向面积"), C.stat("回到起点了吗")];
      this.runner = new C.Runner(root, (dt) => this.stepCircle(dt));
      body.append(h("div", { class: "controls" }, this.sR, C.button("从当前点逆时针绕圆一圈", () => this.circle(1), "primary"), C.button("顺时针", () => this.circle(-1)), C.button("清空", () => { this.reset0(); this.update(); })),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, this.L.wrap, this.V.wrap),
        h("div", { class: "stats" }, this.stats),
        h("p", { class: "small" }, "ẋ₃ = x₁ẋ₂ − x₂ẋ₁，所以 x₃ 的变化量等于从原点看过去，路径扫过的有向面积的 2 倍（左图：逆时针扫过为绿、顺时针为红）。沿一条闭合曲线回到 (x₁, x₂) 的起点时，x₃ 增加 2 × 围成的面积——与曲线放在哪里无关（参考代码第 9 项）。只有两个动作，却能在第三个方向上移动：这是最简单的无漂移、非完整系统。"),
        C.legend([[C.cv("accent"), "路径"], [C.cva("ok", 0.4), "逆时针扫过的面积（x₃ 增加）"], [C.cva("bad", 0.3), "顺时针扫过的面积（x₃ 减少）"]]));
      this.update();
    }
    reset0() { this.x = [0.8, 0.3, 0]; this.path = [this.x.slice()]; this.start = this.x.slice(); this.area2 = 0; }
    moveTo(px, py) {
      const [x1, x2] = this.x, n = Math.max(1, Math.ceil(Math.hypot(px - x1, py - x2) / 0.01));
      for (let i = 1; i <= n; i++) {
        const a = [this.x[0], this.x[1]], b = [x1 + ((px - x1) * i) / n, x2 + ((py - x2) * i) / n];
        const d3 = a[0] * b[1] - a[1] * b[0];         // 线段上 x₁dx₂ − x₂dx₁ 的精确积分
        this.x = [b[0], b[1], this.x[2] + d3]; this.area2 += d3;
        this.path.push(this.x.slice());
      }
      if (this.path.length > 6000) this.path.splice(0, this.path.length - 6000);
      this.update();
    }
    circle(dir) {
      const r = +this.sR.input.value; this.circ = { c: [this.x[0] - r, this.x[1]], r, dir, ang: 0 };
      this.start = this.x.slice(); this.runner.start();
    }
    stepCircle(dt) {
      const c = this.circ; if (!c) return false;
      c.ang = Math.min(2 * Math.PI, c.ang + dt * 2.2);
      this.moveTo(c.c[0] + c.r * Math.cos(c.dir * c.ang), c.c[1] + c.r * Math.sin(c.dir * c.ang));
      if (c.ang >= 2 * Math.PI) { this.circ = null; return false; }
      return true;
    }
    update() {
      const x = this.x;
      this.stats[0].set(`(${x[0].toFixed(2)}, ${x[1].toFixed(2)}, ${x[2].toFixed(3)})`);
      this.stats[1].set(this.area2.toFixed(3));
      const back = Math.hypot(x[0] - this.start[0], x[1] - this.start[1]) < 0.03;
      this.stats[2].set(back && this.path.length > 5 ? `(x₁,x₂) 回来了，Δx₃ = ${(x[2] - this.start[2]).toFixed(3)}` : "否");
      this.L.draw(); this.V.draw();
    }
    drawL(ctx, st, col) {
      st.frame(col); st.grid(col, 1);
      const P = this.path, O = { x: 0, y: 0 };
      for (let i = 1; i < P.length; i++) {
        const a = { x: P[i - 1][0], y: P[i - 1][1] }, b = { x: P[i][0], y: P[i][1] }, cr = a.x * b.y - a.y * b.x;
        if (Math.abs(cr) < 1e-12) continue;
        st.poly([O, a, b], cr > 0 ? C.alpha(col.ok, 0.32) : C.alpha(col.bad, 0.25), null);
      }
      st.path(P.map((p) => ({ x: p[0], y: p[1] })), col.accent, 2);
      st.dot(O, 3.5, col.text);
      st.dot({ x: this.x[0], y: this.x[1] }, 7, col.accent, col.surface, 2);
      st.text("x₁", { x: 2.5, y: 0 }, col.muted, { dx: -10, dy: -10, weight: 650 }); st.text("x₂", { x: 0, y: 2.5 }, col.muted, { dx: 12, dy: 10, weight: 650 });
    }
    drawR(ctx, V, col) {
      V.st.frame(col);
      for (let g = -2; g <= 2; g++) { V.line([g, -2, 0], [g, 2, 0], col.grid, 1); V.line([-2, g, 0], [2, g, 0], col.grid, 1); }
      V.axes(2.3, col, ["x₁", "x₂", "x₃"]);
      const P = this.path.map((p) => [p[0], p[1], p[2] * 0.5]);
      V.path(P.map((p) => [p[0], p[1], 0]), C.alpha(col.muted, 0.6), 1, [3, 3]);
      V.path(P, col.accent, 2);
      V.dot(P[P.length - 1], 6, col.accent, col.surface, 2);
      V.text("（x₃ 方向按 1/2 缩放）", [0, 0, -2.6], col.muted, { size: 10.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='phase-plane']").forEach((el) => el._w = new PhasePlane(el));
    document.querySelectorAll("[data-widget='integrators']").forEach((el) => el._w = new Integrators(el));
    document.querySelectorAll("[data-widget='brockett']").forEach((el) => el._w = new Brockett(el));
  });
})();
