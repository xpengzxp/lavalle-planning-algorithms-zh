/* 11.4–11.5 节：连续状态空间——简单移动机器人与保守近似（例 11.23、图 11.9–11.10、11.25–11.27）、
   传感器目录（11.5.1 节，图 11.11–11.16）、在圆盘上方还是下方（例 11.22，图 11.23–11.24） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH11;
  const D2R = Math.PI / 180;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // ---------------------------------------------------------------
  // 组件 8：简单移动机器人与保守近似（例 11.23、(11.60)(11.61)）
  // ---------------------------------------------------------------
  class ApproxRobot {
    constructor(root) {
      this.d = 2; this.ed = 0.4; this.eu = 20; this.r = 1; this.u = 0; this.approx = "circle"; this.showTruth = true; this.rnd = C.rng(C.newSeed());
      const body = C.frame(root, "简单移动机器人：不确定 I-state 与保守近似", "例 11.23：走 d 有误差 ε_d，方向有误差 ε_u；传感器误差 ≤ r（图 11.11）");
      this.st = new C.Stage({ view: [-0.8, 12.8, -3.6, 3.6], aspect: 0.56, maxW: 760, onDraw: (ctx, st, col) => this.draw(st, col) });
      const resetOn = (fn) => (v) => { fn(v); this.reset(); };
      this.sD = C.slider("d", 1, 3, 0.1, this.d, resetOn((v) => (this.d = v)), (v) => v.toFixed(1));
      this.sEd = C.slider("ε_d", 0.1, 0.8, 0.05, this.ed, resetOn((v) => (this.ed = v)), (v) => v.toFixed(2));
      this.sEu = C.slider("ε_u", 2, 45, 1, this.eu, resetOn((v) => (this.eu = v)), (v) => v + "°");
      this.sR = C.slider("传感器 r", 0.4, 2, 0.05, this.r, resetOn((v) => (this.r = v)), (v) => v.toFixed(2));
      this.sU = C.slider("下一步的方向 u", -90, 90, 5, this.u, (v) => (this.u = v), (v) => v + "°");
      this.segA = C.seg([["none", "不近似"], ["circle", "包围圆"], ["box", "轴对齐包围盒"]], this.approx, (k) => { this.approx = k; this.reset(); });
      this.btnNext = C.button("下一步", () => this.next(), "small primary");
      this.stats = { k: C.stat("阶段"), ex: C.stat("真实 I-state 面积"), ap: C.stat("近似 I-state 面积"), ratio: C.stat("近似 / 真实") };
      this.status = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.sD, this.sEd, this.sEu, this.sR),
        h("div", { class: "controls" }, this.sU, this.btnNext, C.button("重置", () => this.reset(), "small"), h("label", null, "保守近似"), this.segA,
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        this.st.wrap, this.status, h("div", { class: "stats" }, Object.values(this.stats)),
        C.legend([[C.cva("ndet", 0.5), "X_k(η_k)：精确的不确定 I-state"], [C.cva("ndet", 0.15), "预测 ∪F(x_k, u_k)（11.30）"], [C.cv("obs"), "H(y)：以 y 为心、半径 r 的圆"], [C.cva("alive", 0.6), "保守近似 X̂_k（同图 11.10 的黄色）"], [C.cv("truth"), "真实轨迹", true]]));
      this.reset();
      for (let i = 0; i < 4; i++) this.next();          // 先走两步，打开时就能看到形状
    }
    kernel(R, u) {
      const pad = R.cell * 0.75, ur = u * D2R, eu = this.eu * D2R;
      return R.kernel((dx, dy) => { const rho = Math.hypot(dx, dy); if (rho < this.d - this.ed - pad || rho > this.d + this.ed + pad) return false; return Math.abs(angDiff(Math.atan2(dy, dx), ur)) <= eu + pad / Math.max(rho, 1e-6); }, this.d + this.ed + 1);
    }
    disc(R, c, r) { return R.like().fill((x, y) => Math.hypot(x - c.x, y - c.y) <= r + R.cell * 0.75); }
    shape(Rs) {          // 把一个栅格集合换成包围它的近似形状（再栅格化）
      if (this.approx === "circle") { const c = C.minCircle(Rs.boundaryPts()); if (!c) return { R: Rs.like(), sh: null }; return { R: Rs.like().fill((x, y) => Math.hypot(x - c.x, y - c.y) <= c.r), sh: { kind: "circle", c } }; }
      const b = Rs.bbox(); if (!b) return { R: Rs.like(), sh: null };
      return { R: Rs.like().fill((x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1), sh: { kind: "box", b } };
    }
    reset() {
      this.R = new C.Raster(-0.8, 12.8, -3.6, 3.6, 0.05);
      this.x = { x: 0, y: 0 }; this.traj = [{ ...this.x }]; this.obs = [];
      const [i, j] = this.R.ij(0, 0);
      this.S = this.R.like(); this.S.set(i, j);                 // x₁ 已知；y₁ 没用（H(y₁) ∩ {x₁} = {x₁}）
      this.A = this.approx === "none" ? null : this.shape(this.S.dilate(this.R.kernel((dx, dy) => Math.hypot(dx, dy) <= 0.12, 0.2)));
      this.k = 1; this.phase = "act"; this.pred = null; this.Apred = null; this.y = null;
      this.status.innerHTML = "k = 1：初始状态已知（单点）。点「下一步」施加 u₁。";
      this.update();
    }
    next() {
      if (this.phase === "act") {
        const K = this.kernel(this.R, this.u);
        this.prev = this.S;
        this.pred = this.S.dilate(K);                             // (11.30)
        if (this.A) this.Apred = this.A.R.dilate(K);
        const dd = this.d + (2 * this.rnd() - 1) * this.ed * 0.98, uu = (this.u + (2 * this.rnd() - 1) * this.eu * 0.98) * D2R;
        this.x = { x: this.x.x + dd * Math.cos(uu), y: this.x.y + dd * Math.sin(uu) };
        this.traj.push({ ...this.x });
        this.k++; this.phase = "obs"; this.y = null;
        this.status.innerHTML = `施加 u${C.sub(this.k - 1)} = ${this.u}°：不确定性按 (11.30) 扩张成 ∪F（浅蓝）。再点「下一步」读传感器。`;
      } else {
        const a = 2 * Math.PI * this.rnd(), rr = this.r * Math.sqrt(this.rnd()) * 0.98;   // ψ 在半径 r 的圆盘里均匀
        this.y = { x: this.x.x + rr * Math.cos(a), y: this.x.y + rr * Math.sin(a) };
        this.obs.push(this.y);
        const Hy = this.disc(this.R, this.y, this.r);
        this.S = this.pred.copy().andR(Hy);                       // (11.31)
        if (this.A) {
          const Xp = this.Apred.copy().andR(Hy);                  // (11.60)
          this.A = this.shape(Xp.empty() ? this.S : Xp);          // X̂_{k+1} ⊇ X̂'_{k+1}
        }
        this.phase = "act";
        this.status.innerHTML = `读到 y${C.sub(this.k)}：与 H(y) 求交 (11.31)。` + (this.A ? "近似 I-state 按 (11.60) 用<b>近似</b>的上一步去预测，再取包围形状——它包含真实的 I-state，但会越来越松（图 11.10）。" : "");
      }
      this.update();
    }
    update() {
      const ex = this.S.area(), ap = this.A ? this.A.R.area() : NaN;
      this.stats.k.set(this.k + (this.phase === "obs" ? "（已预测）" : ""));
      this.stats.ex.set(ex.toFixed(2));
      this.stats.ap.set(this.A ? ap.toFixed(2) : "–");
      this.stats.ratio.set(this.A && ex > 0 ? (ap / ex).toFixed(1) + "×" : "–");
      this.st.draw();
    }
    draw(st, col) {
      for (let x = 0; x <= 12; x += 2) st.line({ x, y: -3.6 }, { x, y: 3.6 }, C.alpha(col.border, 0.8), 1);
      for (let y = -3; y <= 3; y += 1) st.line({ x: -0.8, y }, { x: 12.8, y }, C.alpha(col.border, 0.5), 1);
      if (this.phase === "obs" && this.pred) { this.pred.draw(st, col.ndet, 0.15); this.pred.outline(st, C.alpha(col.ndet, 0.6), 1); this.prev.draw(st, col.ndet, 0.45); }
      else this.S.draw(st, col.ndet, 0.5);
      if (this.phase === "obs" && this.Apred) this.Apred.outline(st, C.alpha(col.alive, 0.8), 1);
      if (this.A && this.A.sh && this.phase === "act") {
        const sh = this.A.sh;
        if (sh.kind === "circle") st.circle(sh.c, sh.c.r, C.alpha(col.alive, 0.18), col.alive, 2, [6, 4]);
        else st.rect(sh.b.x0, sh.b.y0, sh.b.x1, sh.b.y1, C.alpha(col.alive, 0.18), col.alive, 2, [6, 4]);
      }
      if (this.y && this.phase === "act") { st.circle(this.y, this.r, null, col.obs, 1.6); st.dot(this.y, 3.5, col.obs); st.text("y", this.y, col.obs, { dx: 9, dy: -8, size: 12, weight: 650 }); }
      for (const o of this.obs.slice(0, -1)) st.dot(o, 2.5, C.alpha(col.obs, 0.6));
      // 方向示意
      const last = this.traj[this.traj.length - 1];
      if (this.phase === "act") st.arrow(last, { x: last.x + 0.9 * Math.cos(this.u * D2R), y: last.y + 0.9 * Math.sin(this.u * D2R) }, col.robot, 2);
      if (this.showTruth) { st.path(this.traj, C.alpha(col.truth, 0.6), 1.2, [3, 3]); st.truth(last, col); }
    }
  }

  // ---------------------------------------------------------------
  // 组件 9：传感器目录（11.5.1 节）：拖动机器人，看一次观测的原像 H(y)
  // ---------------------------------------------------------------
  const RM = { W: 10, H: 7 };
  const OBS = [[1.5, 1.2, 3, 2.6], [7, 4.4, 8.5, 5.8], [4.4, 0, 5.0, 2.2], [5.0, 4.8, 5.6, 7], [7.2, 1.4, 8.8, 1.9], [1.2, 5.1, 2.8, 5.6]];   // 关于 (5, 3.5) 中心对称
  const SEGS = [];
  { const box = (x0, y0, x1, y1) => { SEGS.push([x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]); }; box(0, 0, RM.W, RM.H); OBS.forEach((o) => box(...o)); }
  const LM = { x: 8.7, y: 6.3 }, BEAC = [{ x: 0.5, y: 6.5 }, { x: 9.5, y: 6.5 }, { x: 5, y: 0.4 }], REG = [3.3, 2.9, 4.3, 4.1];
  const freeAt = (x, y) => x > 0 && y > 0 && x < RM.W && y < RM.H && !OBS.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
  function rayDist(x, y, a) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = 30;
    for (const [x1, y1, x2, y2] of SEGS) {
      const sx = x2 - x1, sy = y2 - y1, den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((x1 - x) * sy - (y1 - y) * sx) / den, u = ((x1 - x) * dy - (y1 - y) * dx) / den;
      if (t > 1e-9 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
  }
  function wallDist(x, y) {
    let best = Infinity;
    for (const [x1, y1, x2, y2] of SEGS) {
      const sx = x2 - x1, sy = y2 - y1, L = sx * sx + sy * sy; let t = ((x - x1) * sx + (y - y1) * sy) / L; t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - x1 - t * sx, y - y1 - t * sy));
    }
    return best;
  }
  const NR = 72, DA = (2 * Math.PI) / NR;
  const CAT_SENSORS = [
    ["pos", "位置传感器 y = p"], ["compass", "指南针 y = s"], ["contact", "接触传感器"], ["prox", "接近传感器（r = 0.6）"],
    ["homing", "归航传感器（地标方向）"], ["geiger", "盖革计数器（到地标的距离）"], ["region", "地标区域检测器"], ["three", "三个归航信标"],
    ["sonar", "4 个声呐（相对机器人朝向）"], ["scan", "距离扫描仪（72 条射线）"], ["gap", "间隙传感器"],
  ];
  class SensorCatalog {
    constructor(root) {
      this.p = { x: 3.6, y: 3.3 }; this.si = 0; this.sensor = "scan"; this.orient = "known";
      const body = C.frame(root, "传感器目录：一次观测能把机器人定位到哪里？", "拖动机器人（黑点）；拖动它前面的小圆改朝向。蓝色 = 原像 H(y) 在平面上的投影");
      this.st = new C.Stage({ view: [-0.2, 10.2, -0.2, 7.2], aspect: 0.7, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { const hd = this.head(); if (Math.hypot(p.x - hd.x, p.y - hd.y) < 0.35) return "rot"; if (Math.hypot(p.x - this.p.x, p.y - this.p.y) < 0.45) return "pos"; if (freeAt(p.x, p.y)) { this.p = this.snap(p); this.compute(); return "pos"; } return null; },
        onMove: (p, d) => { if (d === "pos") { if (freeAt(p.x, p.y)) { this.p = this.snap(p); this.schedule(); } } else { this.si = (Math.round(Math.atan2(p.y - this.p.y, p.x - this.p.x) / DA) % NR + NR) % NR; this.schedule(); } },
        cursor: (p) => { const hd = this.head(); return Math.hypot(p.x - hd.x, p.y - hd.y) < 0.35 || Math.hypot(p.x - this.p.x, p.y - this.p.y) < 0.45 ? "grab" : "crosshair"; } });
      this.sel = C.select(CAT_SENSORS, this.sensor, (v) => { this.sensor = v; this.compute(); });
      this.segO = C.seg([["known", "朝向已知（另有指南针）"], ["unknown", "朝向未知"]], this.orient, (k) => { this.orient = k; this.compute(); });
      this.sTol = C.slider("容差 δ", 0.05, 0.5, 0.01, 0.15, (v) => { this.tol = v; this.compute(); }, (v) => v.toFixed(2));
      this.tol = 0.15;
      this.read = h("div", { class: "status-line" });
      this.note = h("div", { class: "small muted" });
      body.append(h("div", { class: "controls" }, h("label", null, "传感器"), this.sel, this.segO, this.sTol), this.st.wrap, this.read, this.note,
        C.legend([[C.cva("ndet", 0.5), "H(y)：与这次读数相容的位置"], [C.cv("obs"), "传感器的读数 / 射线"], [C.cv("goal"), "地标 / 信标"], [C.cv("wall"), "障碍（X = cl(C_free) 之外）"]]));
      this.R = new C.Raster(0, RM.W, 0, RM.H, 0.125);
      this.precompute();
      this.p = this.snap(this.p);
      this.compute();
    }
    // 机器人位置取到格子中心（补充的离散化：这样原像里一定含机器人自己所在的格子）
    snap(p) { const R = this.R, [i, j] = R.ij(p.x, p.y); return { x: R.cx(i), y: R.cy(j) }; }
    head() { const a = this.si * DA; return { x: this.p.x + 0.7 * Math.cos(a), y: this.p.y + 0.7 * Math.sin(a) }; }
    precompute() {   // 每个格子中心沿 72 个绝对方向的距离（环境不变，算一次）
      const R = this.R; this.scan = new Array(R.nx * R.ny); this.free = new Uint8Array(R.nx * R.ny);
      for (let j = 0; j < R.ny; j++) for (let i = 0; i < R.nx; i++) {
        const x = R.cx(i), y = R.cy(j), k = j * R.nx + i;
        if (!freeAt(x, y)) continue;
        this.free[k] = 1;
        const sc = new Float32Array(NR); for (let a = 0; a < NR; a++) sc[a] = rayDist(x, y, a * DA);
        this.scan[k] = sc;
      }
    }
    schedule() { if (this.pend) return; this.pend = requestAnimationFrame(() => { this.pend = 0; this.compute(); }); }
    gaps(sc) { const g = []; for (let a = 0; a < NR; a++) if (Math.abs(sc[a] - sc[(a + 1) % NR]) > 0.9) g.push(a); return g; }
    compute() {
      const R = this.R, p = this.p, tol = this.tol, S = R.like(), sens = this.sensor;
      const myScan = new Float32Array(NR); for (let a = 0; a < NR; a++) myScan[a] = rayDist(p.x, p.y, a * DA);
      const rel = (sc, sh, a) => sc[(a + sh) % NR];       // 相对朝向 sh 的第 a 条射线
      const shifts = this.orient === "known" ? [this.si] : Array.from({ length: NR }, (_, i) => i);
      const myRel = Array.from({ length: NR }, (_, a) => rel(myScan, this.si, a));
      const ang = (q, l) => Math.atan2(l.y - q.y, l.x - q.x);
      let y = null, reading = "";
      if (sens === "pos") reading = `y = (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
      if (sens === "compass") reading = `y = s = ${(this.si * 5)}°`;
      if (sens === "contact") { y = wallDist(p.x, p.y) < 0.1 ? 1 : 0; reading = `y = ${y}（${y ? "碰到边界" : "没碰到"}）`; }
      if (sens === "prox") { y = wallDist(p.x, p.y) <= 0.6 ? 1 : 0; reading = `y = ${y}（${y ? "离边界 ≤ 0.6" : "离边界 > 0.6"}）`; }
      if (sens === "homing") { y = ang(p, LM); reading = `y = ${(y / D2R).toFixed(1)}°（地标方向）`; }
      if (sens === "geiger") { y = Math.hypot(p.x - LM.x, p.y - LM.y); reading = `y = ‖x − l‖ = ${y.toFixed(2)}`; }
      if (sens === "region") { y = p.x >= REG[0] && p.x <= REG[2] && p.y >= REG[1] && p.y <= REG[3] ? 1 : 0; reading = `y = ${y}`; }
      if (sens === "three") { y = BEAC.map((b) => ang(p, b)); reading = "y = (" + y.map((a) => (a / D2R).toFixed(0) + "°").join(", ") + ")"; }
      if (sens === "sonar") { y = [0, 18, 36, 54].map((a) => myRel[a]); reading = `y = (前 ${y[0].toFixed(2)}，左 ${y[1].toFixed(2)}，后 ${y[2].toFixed(2)}，右 ${y[3].toFixed(2)})`; }
      if (sens === "scan") reading = `y ∈ [0, ∞]^72（最近 ${Math.min(...myScan).toFixed(2)}，最远 ${Math.max(...myScan).toFixed(2)}）`;
      const myGaps = this.gaps(myRel);
      if (sens === "gap") reading = `y = ${myGaps.length} 个间隙，方向（相对朝向）：` + myGaps.map((a) => a * 5 + 2.5 + "°").join("，");
      this.myScan = myScan; this.myGaps = myGaps.map((a) => (a + this.si) % NR);
      const angTol = tol * 0.25;     // 角度类读数的容差（弧度）
      for (let j = 0; j < R.ny; j++) for (let i = 0; i < R.nx; i++) {
        const k = j * R.nx + i; if (!this.free[k]) continue;
        const q = { x: R.cx(i), y: R.cy(j) }; let ok = false;
        switch (sens) {
          case "pos": ok = Math.abs(q.x - p.x) <= R.cell / 2 + 1e-9 && Math.abs(q.y - p.y) <= R.cell / 2 + 1e-9; break;
          case "compass": ok = true; break;
          case "contact": ok = (wallDist(q.x, q.y) < 0.1 + R.cell * 0.5 ? 1 : 0) === y; break;
          case "prox": ok = (wallDist(q.x, q.y) <= 0.6 ? 1 : 0) === y; break;
          case "homing": ok = Math.abs(angDiff(ang(q, LM), y)) <= angTol; break;
          case "geiger": ok = Math.abs(Math.hypot(q.x - LM.x, q.y - LM.y) - y) <= tol; break;
          case "region": ok = (q.x >= REG[0] && q.x <= REG[2] && q.y >= REG[1] && q.y <= REG[3] ? 1 : 0) === y; break;
          case "three": ok = BEAC.every((b, n) => Math.abs(angDiff(ang(q, b), y[n])) <= angTol); break;
          case "sonar": { const sc = this.scan[k]; ok = shifts.some((sh) => [0, 18, 36, 54].every((a, n) => Math.abs(rel(sc, sh, a) - y[n]) <= tol)); break; }
          case "scan": { const sc = this.scan[k]; ok = shifts.some((sh) => { for (let a = 0; a < NR; a++) if (Math.abs(rel(sc, sh, a) - myRel[a]) > tol + 0.02 * myRel[a]) return false; return true; }); break; }
          case "gap": {
            const g = this.gaps(this.scan[k]);
            if (g.length !== myGaps.length) { ok = false; break; }
            ok = shifts.some((sh) => myGaps.every((a, n) => { const t = (a + sh) % NR; return g.some((b) => Math.min(Math.abs(b - t), NR - Math.abs(b - t)) <= 1); }));
            break;
          }
        }
        if (ok) S.a[k] = 1;
      }
      this.S = S;
      const area = S.area(), tot = this.free.reduce((a, b) => a + b, 0) * R.cell * R.cell;
      const nc = S.count();
      this.read.innerHTML = `${reading}　→　H(y) 含 <b>${nc}</b> 个格子，约占 X 的 <b>${((100 * area) / tot).toFixed(nc < 50 ? 2 : 1)}%</b>` + (nc <= 40 && nc > 1 ? "（用圆圈标出）" : "");
      const NOTES = {
        pos: "位置传感器（简单投影传感器）：完全知道 p，但不知道朝向 s——原像是 {p} × S¹，投影到平面上只有一个点。",
        compass: "指南针只报告朝向，位置一无所知：原像投影到平面上是整个 X。",
        contact: "接触传感器 Y = {0, 1}：h(x) = 1 当且仅当 x ∈ ∂X（图 11.12a、b）。读到 1 时只知道「在边界上某处」。",
        prox: "接近传感器：离边界不超过 r 时报告 1（图 11.12c）。",
        homing: "归航传感器只给出地标的方向（图 11.13）：原像是从地标出发、反向延伸的一条射线。<b>注意</b>：原书写 h(x) = atan2(l₁ − x₁, l₂ − x₂)；按第 3 章 (3.47) 的 atan2(纵, 横) 约定，从 x₁ 轴量起的方向角应是 atan2(l₂ − x₂, l₁ − x₁)——两种写法差一个固定的角度变换，信息量相同。",
        geiger: "盖革计数器只报告到地标的距离：原像是一个圆（这里画成宽 2δ 的圆环）。",
        region: "地标区域检测器（pebble 的推广）：x ∈ X_l 时报告 1（虚线框是 X_l）。",
        three: "三个不共线的归航信标：方向两两相交，就能把位置恢复出来（习题 12）——原像缩成一个小点。",
        sonar: "4 个声呐沿机器人的前、左、后、右测距（图 11.14b），y ∈ [0, ∞]⁴。朝向未知时，把四个读数整体旋转后相容的位置也算进来。",
        scan: "距离扫描仪（可见性传感器，图 11.15）：每个方向都给出距离。这个房间关于中心 (5, 3.5) <b>中心对称</b>——朝向未知时，对称位置的扫描只差一个 180° 的旋转，原像里就会出现两个点：机器人分不清自己在哪一个。",
        gap: "间隙传感器（图 11.16）只报告深度不连续的方向，不给距离：信息少得多，原像也大得多。",
      };
      this.note.innerHTML = NOTES[sens] + "　<span class='muted'>（精确等式的原像常常是零测集；这里允许读数误差 δ——相当于带自然传感动作 |ψ| ≤ δ 的版本。）</span>";
      this.st.draw();
    }
    draw(st, col) {
      st.rect(0, 0, RM.W, RM.H, col.surface, col.wall, 2.5);
      if (this.S) {
        this.S.draw(st, col.ndet, 0.45);
        const n = this.S.count(), R = this.S;
        if (n <= 40) for (let k = 0; k < R.a.length; k++) if (R.a[k]) st.dot({ x: R.cx(k % R.nx), y: R.cy(Math.floor(k / R.nx)) }, 9, C.alpha(col.ndet, 0.25), col.ndet, 2.2);   // 很小的原像也要看得见
      }
      OBS.forEach(([a, b, c, d]) => st.rect(a, b, c, d, C.alpha(col.wall, 0.85), col.wall, 1));
      const p = this.p, sens = this.sensor;
      if (sens === "homing" || sens === "geiger") { st.dot(LM, 6, col.goal, col.surface, 2); st.text("地标 l", LM, col.goal, { dy: -14, size: 12, weight: 650 }); }
      if (sens === "homing") st.arrow(p, { x: p.x + 0.9 * Math.cos(Math.atan2(LM.y - p.y, LM.x - p.x)), y: p.y + 0.9 * Math.sin(Math.atan2(LM.y - p.y, LM.x - p.x)) }, col.obs, 2);
      if (sens === "geiger") st.line(p, LM, col.obs, 1.5, [5, 4]);
      if (sens === "three") BEAC.forEach((b, n) => { st.dot(b, 6, col.goal, col.surface, 2); st.line(p, b, C.alpha(col.obs, 0.7), 1.2, [5, 4]); st.text("l" + C.sub(n + 1), b, col.goal, { dy: -14, size: 12 }); });
      if (sens === "region") st.rect(REG[0], REG[1], REG[2], REG[3], C.alpha(col.goal, 0.15), col.goal, 1.5, [5, 3]);
      if (sens === "prox" || sens === "contact") st.text(sens === "prox" ? "r = 0.6" : "", { x: 0.3, y: 6.8 }, col.muted, { align: "left", size: 11 });
      if (sens === "sonar" && this.myScan) [0, 18, 36, 54].forEach((a) => { const t = (a + this.si) % NR, d = this.myScan[t]; st.arrow(p, { x: p.x + d * Math.cos(t * DA), y: p.y + d * Math.sin(t * DA) }, col.obs, 1.6); });
      if ((sens === "scan" || sens === "gap") && this.myScan) {
        const P = []; for (let a = 0; a < NR; a++) { const d = this.myScan[a]; P.push({ x: p.x + d * Math.cos(a * DA), y: p.y + d * Math.sin(a * DA) }); }
        if (sens === "scan") st.poly(P, C.alpha(col.obs, 0.12), C.alpha(col.obs, 0.8), 1.2);
        else this.myGaps.forEach((a) => { const t = (a + 0.5) * DA; st.line(p, { x: p.x + 1.4 * Math.cos(t), y: p.y + 1.4 * Math.sin(t) }, col.obs, 2.2); });
      }
      const hd = this.head();
      st.line(p, hd, col.truth, 2); st.dot(hd, 5, col.surface, col.truth, 2);
      st.dot(p, 6.5, col.truth, col.surface, 2);
    }
  }

  // ---------------------------------------------------------------
  // 组件 12：在圆盘上方还是下方经过？（例 11.22，图 11.23、11.24）
  // ---------------------------------------------------------------
  class AboveBelow {
    constructor(root) {
      this.R = 1.4; this.rs = 1; this.nat = "above"; this.sens = "adv"; this.showTruth = true; this.rnd = C.rng(C.newSeed());
      const body = C.frame(root, "在圆盘上方还是下方经过？", "例 11.22：命令一直是「向右」，自然把方向扭偏至多 ±45°；传感器误差 ≤ r");
      this.st = new C.Stage({ view: [-0.6, 10.6, -4, 4], aspect: 0.62, maxW: 700, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.sR = C.slider("圆盘半径", 0.4, 2.4, 0.05, this.R, (v) => { this.R = v; this.reset(); }, (v) => v.toFixed(2));
      this.sRs = C.slider("传感器误差 r", 0.5, 1.6, 0.05, this.rs, (v) => { this.rs = v; this.reset(); }, (v) => v.toFixed(2));
      this.segN = C.seg([["above", "真实轨迹从上方绕"], ["below", "从下方绕"], ["rand", "随机游走"]], this.nat, (k) => { this.nat = k; this.reset(); });
      this.segS = C.seg([["adv", "ψ 对手式（把观测往中线拉）"], ["rand", "ψ 随机"]], this.sens, (k) => { this.sens = k; this.reset(); });
      this.btnRun = C.button("运行", () => this.run.toggle(), "small primary");
      this.run = new C.Runner((dt) => { this.acc = (this.acc || 0) + dt; while (this.acc > 0.06) { this.acc -= 0.06; if (!this.step()) return false; } this.st.draw(); return true; }, () => (this.btnRun.textContent = "运行"));
      C.pauseWhenHidden(root, this.run);
      this.verdict = h("div", { class: "msg info" });
      body.append(h("div", { class: "controls" }, this.sR, this.sRs), h("div", { class: "controls" }, this.segN, this.segS),
        h("div", { class: "controls" }, this.btnRun, C.button("单步", () => { this.step(); this.st.draw(); }, "small"), C.button("重置", () => this.reset(), "small"),
          C.checkbox("显示真实轨迹", true, (v) => { this.showTruth = v; this.st.draw(); })),
        this.st.wrap, this.verdict,
        C.legend([[C.cva("ndet", 0.5), "还没经过圆盘的可能状态"], [C.cva("ok", 0.55), "相容、且从上方经过的状态"], [C.cva("mud", 0.6), "相容、且从下方经过的状态"], [C.cv("obs"), "观测 y(t) 与 H(y)"], [C.cv("truth"), "真实轨迹", true]]));
      this.reset();
    }
    reset() {
      if (this.run) this.run.stop();
      const R = (this.Rr = new C.Raster(-0.6, 10.6, -4, 4, 0.05));
      this.cx = 5.2; this.dt = 0.2;
      const pad = R.cell * 0.8, c45 = Math.cos(Math.PI / 4) * this.dt;
      this.K = R.kernel((dx, dy) => Math.hypot(dx, dy) <= this.dt + pad && dx >= c45 - pad, this.dt + 0.2);    // dt 时间内可达的集合：弧的凸包
      this.discMask = R.like().fill((x, y) => Math.hypot(x - this.cx, y) < this.R);
      this.U = R.like(); const [i, j] = R.ij(0, 0); this.U.set(i, j);
      this.A = R.like(); this.B = R.like();
      this.x = { x: 0, y: 0 }; this.traj = [{ ...this.x }]; this.obs = []; this.t = 0; this.th = 0; this.y = null;
      this.st.draw(); this.updVerdict();
    }
    theta() {
      const x = this.x, lim = Math.PI / 4;
      if (this.nat === "rand") { this.th = Math.max(-lim, Math.min(lim, this.th + (this.rnd() - 0.5) * 0.6)); }
      else {
        const side = this.nat === "above" ? 1 : -1, near = Math.abs(x.x - this.cx) < this.R + 2.2;
        const target = near ? side * (this.R + 0.35) : 0;
        this.th = Math.max(-lim, Math.min(lim, 1.4 * (target - x.y)));
      }
      // 不允许穿过圆盘：会撞上就往外偏
      const nx = { x: x.x + this.dt * Math.cos(this.th), y: x.y + this.dt * Math.sin(this.th) };
      if (Math.hypot(nx.x - this.cx, nx.y) < this.R + 0.02) this.th = x.y >= 0 ? lim : -lim;
      return this.th;
    }
    step() {
      if (this.x.x > 10.2) return false;
      const th = this.theta();
      this.x = { x: this.x.x + this.dt * Math.cos(th), y: this.x.y + this.dt * Math.sin(th) };
      this.traj.push({ ...this.x }); this.t += this.dt;
      let ox, oy;
      if (this.sens === "rand") { let a = 2 * Math.PI * this.rnd(), r = this.rs * Math.sqrt(this.rnd()) * 0.97; ox = r * Math.cos(a); oy = r * Math.sin(a); }
      else { ox = 0; oy = -Math.sign(this.x.y) * Math.min(this.rs * 0.97, Math.abs(this.x.y)); }
      this.y = { x: this.x.x + ox, y: this.x.y + oy }; this.obs.push(this.y);
      const R = this.Rr, pad = R.cell * 0.8;
      const Hy = R.like().fill((x, y) => Math.hypot(x - this.y.x, y - this.y.y) <= this.rs + pad);
      const notDisc = (S) => { for (let k = 0; k < S.a.length; k++) if (this.discMask.a[k]) S.a[k] = 0; return S; };
      const U = notDisc(this.U.dilate(this.K)).andR(Hy), A = notDisc(this.A.dilate(this.K)).andR(Hy), B = notDisc(this.B.dilate(this.K)).andR(Hy);
      // 越过圆盘中线 x = cx 的状态：按在中线上方还是下方分类
      const ic = Math.floor((this.cx - R.x0) / R.cell);
      for (let j = 0; j < R.ny; j++) for (let i = ic; i < R.nx; i++) { const k = j * R.nx + i; if (U.a[k]) { U.a[k] = 0; if (R.cy(j) > 0) A.a[k] = 1; else B.a[k] = 1; } }
      this.U = U; this.A = A; this.B = B;
      this.updVerdict();
      return true;
    }
    updVerdict() {
      const a = !this.A.empty(), b = !this.B.empty(), u = !this.U.empty();
      let msg;
      if (!a && !b) msg = "还没有任何相容的状态越过圆盘中线。";
      else if (a && !b) msg = "<b>可以断定：从上方经过。</b>所有与观测历史相容的轨迹都在上方。";
      else if (b && !a) msg = "<b>可以断定：从下方经过。</b>";
      else msg = "<b>无法断定。</b>上方、下方都有与观测历史相容的轨迹" + (this.R < this.rs ? "——圆盘半径小于传感器误差时，这种情况确实可能发生（图 11.23b）。" : "（再走一会儿可能就能分清）。");
      if (u && (a || b)) msg += "　<span class='muted'>（还有相容状态没越过中线。）</span>";
      this.verdict.innerHTML = msg + `<br><span class="small muted">书中结论：圆盘半径 &gt; r（这里 r = ${this.rs.toFixed(2)}）时总能分清；半径 &lt; r 时，某些观测历史分不清。试试对手式的 ψ。（补充：本图把圆盘当作轨迹不能穿过的区域，并把连续时间离散成 Δt = 0.2。）</span>`;
    }
    draw(st, col) {
      st.line({ x: -0.6, y: 0 }, { x: 10.6, y: 0 }, C.alpha(col.border, 0.9), 1);
      this.U.draw(st, col.ndet, 0.5); this.A.draw(st, col.ok, 0.55); this.B.draw(st, col.mud, 0.65);
      st.circle({ x: this.cx, y: 0 }, this.R, C.alpha(col.wall, 0.75), col.wall, 1);
      st.line({ x: this.cx, y: -4 }, { x: this.cx, y: 4 }, C.alpha(col.muted, 0.5), 1, [4, 4]);
      // 自然可能的方向（图 11.24 的扇形）
      const o = this.traj[0]; st.poly([o, { x: o.x + 1.4, y: o.y + 1.4 }, { x: o.x + 1.4, y: o.y - 1.4 }], C.alpha(col.alive, 0.25), C.alpha(col.alive, 0.7), 1);
      st.text("±45°", { x: 1.2, y: 1.2 }, col.muted, { size: 11 });
      for (const y of this.obs) st.dot(y, 2, C.alpha(col.obs, 0.55));
      if (this.y) { st.circle(this.y, this.rs, null, col.obs, 1.4); st.dot(this.y, 3.5, col.obs); }
      if (this.showTruth) { st.path(this.traj, C.alpha(col.truth, 0.8), 1.6); st.truth(this.traj[this.traj.length - 1], col); }
      st.text(`t = ${this.t.toFixed(1)}`, { x: -0.4, y: 3.6 }, col.muted, { align: "left", size: 12 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='approx-robot']").forEach((el) => (el._w = new ApproxRobot(el)));
    document.querySelectorAll("[data-widget='sensor-catalog']").forEach((el) => (el._w = new SensorCatalog(el)));
    document.querySelectorAll("[data-widget='above-below']").forEach((el) => (el._w = new AboveBelow(el)));
  });
})();
