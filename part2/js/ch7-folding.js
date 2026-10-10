/* 7.5 节：折叠问题——纸箱是转动关节连成的树（图 7.28–7.30）、能量函数是「软障碍」（式 7.25、图 7.33）、
   结的化简（图 7.31） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // 3D 小工具
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], norm = (a) => Math.hypot(a[0], a[1], a[2]);
  // 绕过点 p、方向为单位向量 k 的轴转角 t（Rodrigues 公式）
  function rotAbout(v, p, k, t) {
    const w = sub(v, p), c = Math.cos(t), s = Math.sin(t);
    return add(p, add(add(scl(w, c), scl(cross(k, w), s)), scl(k, dot(k, w) * (1 - c))));
  }

  // =================================================================
  // 组件 1：纸箱折叠——一棵由转动关节连起来的「树」（图 7.28–7.30）
  // =================================================================
  // 展开图：底面 [0,1]²；前、后、左、右四片侧板；盖子连在后侧板的外边上
  const NET = [
    { name: "底", parent: -1, quad: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
    { name: "前", parent: 0, hinge: [[0, 0, 0], [1, 0, 0]], quad: [[0, -1, 0], [1, -1, 0], [1, 0, 0], [0, 0, 0]] },
    { name: "左", parent: 0, hinge: [[0, 0, 0], [0, 1, 0]], quad: [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [-1, 1, 0]] },
    { name: "右", parent: 0, hinge: [[1, 0, 0], [1, 1, 0]], quad: [[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]] },
    { name: "后", parent: 0, hinge: [[0, 1, 0], [1, 1, 0]], quad: [[0, 1, 0], [1, 1, 0], [1, 2, 0], [0, 2, 0]] },
    { name: "盖", parent: 4, hinge: [[0, 2, 0], [1, 2, 0]], quad: [[0, 2, 0], [1, 2, 0], [1, 3, 0], [0, 3, 0]] },
  ];
  const FOLD_SEQ = [[2, 3], [1], [4], [5]];   // 按关节分组依次折：左右、前、后、盖
  // 正运动学：θ_i ∈ [0, 1] 表示折过 θ_i·90°；子面先绕自己的铰链转，再跟着父面一起动
  function cartonFaces(theta) {
    const T = NET.map(() => null);
    const apply = (i, v) => { let w = v.slice(); for (let j = i; j > 0; j = NET[j].parent) w = T[j](w); return w; };
    NET.forEach((f, i) => {
      if (f.parent < 0) { T[i] = (v) => v; return; }
      const [a, b] = f.hinge, k = scl(sub(b, a), 1 / norm(sub(b, a)));
      const ctr = f.quad.reduce((s, v) => add(s, scl(v, 0.25)), [0, 0, 0]);
      // 选转向：让面的中心往 +z 方向抬
      const sgn = rotAbout(ctr, a, k, 0.1)[2] > 0 ? 1 : -1, t = sgn * theta[i] * Math.PI / 2;
      T[i] = (v) => rotAbout(v, a, k, t);
    });
    return NET.map((f, i) => ({ name: f.name, pts: f.quad.map((v) => apply(i, v)) }));
  }

  class Carton {
    constructor(root) {
      this.theta = NET.map(() => 0); this.v3 = new C.View3D(-0.6, 0.62, [0.5, 0.6, 0.5]);
      const body = C.frame(root, "纸箱折叠：一棵转动关节的树", "图 7.29：每块纸板是一个刚体，折痕是转动关节；盖子挂在后侧板上（树的深度为 2）。拖动图旋转");
      this.st = new C.Stage(Object.assign({ view: [-2.1, 2.1, -1.6, 1.7], maxW: 440, aspect: 0.8, onDraw: (ctx, st, col) => this.draw(ctx, st, col), cursor: () => "grab" }, this.v3.dragHandlers(() => this.st.draw())));
      this.sl = NET.slice(1).map((f, j) => C.slider(`θ${j + 1}（${f.name}）`, 0, 1, 0.01, 0, (v) => { this.theta[j + 1] = v; this.st.draw(); }, (v) => Math.round(v * 90) + "°"));
      this.tl = new C.Timeline((u) => this.play(u), { label: "按顺序折", dur: 6, fmt: (u) => Math.round(u * 100) + "%" });
      body.append(h("div", { class: "split" }, this.st.wrap, h("div", null, ...this.sl.map((s) => h("div", { class: "controls", style: "margin:0 0 4px" }, s)),
        h("p", { class: "small muted" }, "「按顺序折」依次折：左右两片 → 前 → 后 → 盖（与图 7.30 一样，一次动一组关节）。先折盖子再折后侧板也可以，但真实的纸箱要考虑自碰撞和夹具，规划器要在这些顺序里找可行的。"))), this.tl.el);
      this.st.draw();
    }
    play(u) {
      const n = FOLD_SEQ.length, p = u * n;
      FOLD_SEQ.forEach((g, k) => g.forEach((j) => { this.theta[j] = C.clamp(p - k, 0, 1); this.sl[j - 1].set(this.theta[j]); }));
      this.st.draw();
    }
    draw(ctx, st, col) {
      const V = this.v3, faces = cartonFaces(this.theta);
      // 地面网格
      for (let i = -2; i <= 3; i++) { V.line(st, [i, -1.5, 0], [i, 3.5, 0], C.alpha(col.muted, 0.18), 1); V.line(st, [-1.5, i, 0], [2.5, i, 0], C.alpha(col.muted, 0.18), 1); }
      const depth = (F) => F.pts.reduce((s, v) => s + V.proj(v).depth, 0) / 4;
      faces.sort((a, b) => depth(b) - depth(a));
      const pal = { 底: col.mud, 前: col.alive, 左: col.warn, 右: col.warn, 后: col.alive, 盖: col.mud };
      for (const F of faces) {
        V.poly(st, F.pts, C.alpha(pal[F.name], 0.78), col.text, 1.2);
        const c = F.pts.reduce((s, v) => add(s, scl(v, 0.25)), [0, 0, 0]);
        st.text(F.name, V.proj(c), col.text, { size: 11, weight: 650 });
      }
    }
  }

  // =================================================================
  // 组件 2：能量函数当「软障碍」（式 7.25 的简化版，补充）
  // =================================================================
  // 平面上的 6 原子链：键长 1，键角固定；只有原子 2、3 处的两个「可旋转键」θ₁、θ₂ 可以转 → C = T²
  const MOL = { n: 6, fixedTurn: [0, 0.55, 0, 0, -0.5, 0], rot: [2, 3], charge: [0.5, 0, 0, 0, 0, -0.5], Kd: 0.5, p: 3, sigma: 0.95, epsLJ: 0.25 };
  function molAtoms(t1, t2) {
    const P = [[0, 0]]; let a = 0;
    for (let i = 1; i < MOL.n; i++) {
      a += MOL.fixedTurn[i - 1] + (i - 1 === MOL.rot[0] ? t1 : 0) + (i - 1 === MOL.rot[1] ? t2 : 0);
      P.push([P[i - 1][0] + Math.cos(a), P[i - 1][1] + Math.sin(a)]);
    }
    return P;
  }
  // 扭转项 K_d[1 + cos(pθ − θ')]（取 θ' = 0）+ 非键原子对的 Lennard-Jones 与 Coulomb 项（键长、键角固定，前两项是常数）
  function energy(t1, t2) {
    const P = molAtoms(t1, t2);
    let e = MOL.Kd * (1 + Math.cos(MOL.p * t1)) + MOL.Kd * (1 + Math.cos(MOL.p * t2));
    for (let i = 0; i < MOL.n; i++) for (let j = i + 3; j < MOL.n; j++) {
      const r = Math.max(0.3, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1])), sr = (MOL.sigma / r) ** 6;
      e += 4 * MOL.epsLJ * (sr * sr - sr) + MOL.charge[i] * MOL.charge[j] / r;
    }
    return e;
  }

  class Energy {
    constructor(root) {
      this.t = [2.1, -1.0]; this.thr = 1.6; this.pharma = false; this.res = 96;
      const body = C.frame(root, "能量函数：软障碍", "补充演示：6 个原子的平面链，只有两个键能转，C = T²。右图是能量 e(θ₁, θ₂)，点一下换构象");
      this.stM = new C.Stage({ view: [-2.2, 4.4, -2.6, 3.0], maxW: 300, aspect: 0.85, onDraw: (ctx, st, col) => this.drawMol(ctx, st, col) });
      this.stE = new C.Stage({ view: [-Math.PI, Math.PI, -Math.PI, Math.PI], maxW: 330, onDraw: (ctx, st, col) => this.drawE(ctx, st, col),
        onDown: (p) => { this.set(p); return "drag"; }, onMove: (p) => this.set(p), cursor: () => "crosshair" });
      this.sT = C.slider("阈值", 0.5, 4, 0.05, this.thr, (v) => { this.thr = v; this.update(); }, (v) => v.toFixed(2));
      this.cP = C.check("加药效团约束：末端原子 5 必须在圆圈里", this.pharma, (v) => { this.pharma = v; this.update(); });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.sT, this.cP, C.button("走到最近的局部极小", () => this.descend(), "small")),
        h("div", { class: "split" }, this.stE.wrap, this.stM.wrap), this.out,
        C.legend([[C.cva("wall", 0.7), "e(q) > 阈值：被当成 C_obs"], [C.cva("accent", 0.5), "低能量（颜色越深越低）"], [C.cv("ok"), "药效团约束 → C_clo（7.4 节）"]]));
      this.grid();
      this.update();
    }
    grid() {
      const N = this.res; this.E = new Float64Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.E[j * N + i] = energy(-Math.PI + (i + 0.5) * 2 * Math.PI / N, -Math.PI + (j + 0.5) * 2 * Math.PI / N);
      let k = 0; for (let m = 1; m < N * N; m++) if (this.E[m] < this.E[k]) k = m;
      this.gmin = [-Math.PI + ((k % N) + 0.5) * 2 * Math.PI / N, -Math.PI + (Math.floor(k / N) + 0.5) * 2 * Math.PI / N];
      this.lo = this.E[k]; this.hi = Math.min(6, Math.max(...this.E));
    }
    target() { const P = molAtoms(this.gmin[0], this.gmin[1]); return { x: P[5][0] + 0.15, y: P[5][1] - 0.25, r: 0.35 }; }
    pharmaOK(t1, t2) { const T = this.target(), P = molAtoms(t1, t2)[5]; return Math.hypot(P[0] - T.x, P[1] - T.y) < T.r; }
    set(p) { this.t = [C.clamp(p.x, -Math.PI, Math.PI), C.clamp(p.y, -Math.PI, Math.PI)]; this.update(); }
    descend() {
      let [a, b] = this.t; const s = 0.01;
      for (let it = 0; it < 3000; it++) {
        const ga = (energy(a + 1e-4, b) - energy(a - 1e-4, b)) / 2e-4, gb = (energy(a, b + 1e-4) - energy(a, b - 1e-4)) / 2e-4;
        const g = Math.hypot(ga, gb); if (g < 1e-4) break;
        a -= s * ga / Math.max(1, g); b -= s * gb / Math.max(1, g);
        a = Math.atan2(Math.sin(a), Math.cos(a)); b = Math.atan2(Math.sin(b), Math.cos(b));
      }
      this.t = [a, b]; this.update();
    }
    update() {
      const e = energy(...this.t), N = this.res;
      let below = 0; for (const v of this.E) if (v <= this.thr) below++;
      this.out.innerHTML = `当前 e(q) = <b>${e.toFixed(3)}</b>（${e > this.thr ? '<span class="no">高于阈值，算作碰撞</span>' : '<span class="yes">低于阈值</span>'}）。阈值以下的部分占 C 的 ${(100 * below / (N * N)).toFixed(0)}%。` +
        "阈值是人为挑的：能量函数比一个「是 / 否」的 C_obs 多带了信息——哪里能量更低、往哪边走更好。" +
        (this.pharma ? ` 药效团约束把可行构象限制在绿色的 C_clo 上；药物设计就是在 C_clo 上找低能量的构象（没有预先给定的目标构型）。当前构象 ${this.pharmaOK(...this.t) ? "满足" : "不满足"}约束。` : "");
      this.stE.draw(); this.stM.draw();
    }
    drawE(ctx, st, col) {
      st.frame(col);
      const N = this.res, [ar, ag, ab] = C.rgb(col.accent), [wr, wg, wb] = C.rgb(col.wall), [sr, sg, sb] = C.rgb(col.surface), [okr, okg, okb] = C.rgb(col.ok);
      st.raster(N, N, -Math.PI, Math.PI, -Math.PI, Math.PI, (i, j) => {
        const v = this.E[j * N + i];
        if (this.pharma && this.pharmaOK(-Math.PI + (i + 0.5) * 2 * Math.PI / N, -Math.PI + (j + 0.5) * 2 * Math.PI / N)) return [okr, okg, okb, 220];
        if (v > this.thr) return [wr, wg, wb, 170];
        const t = C.clamp((this.thr - v) / (this.thr - this.lo + 1e-9), 0, 1);
        return [sr + (ar - sr) * t * 0.85, sg + (ag - sg) * t * 0.85, sb + (ab - sb) * t * 0.85, 255];
      });
      st.dot({ x: this.gmin[0], y: this.gmin[1] }, 4, null, col.text, 1.2);
      st.dot({ x: this.t[0], y: this.t[1] }, 6, col.warn, col.surface, 2);
      st.text("θ₁ →", { x: Math.PI, y: -Math.PI }, col.text2, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11.5 });
      st.text("θ₂", { x: -Math.PI, y: Math.PI }, col.text2, { align: "left", base: "top", dx: 4, dy: 3, size: 11.5 });
    }
    drawMol(ctx, st, col) {
      st.frame(col);
      const P = molAtoms(...this.t);
      if (this.pharma) { const T = this.target(); ctx.beginPath(); ctx.arc(st.X(T.x), st.Y(T.y), T.r * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = col.ok; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
      for (let i = 1; i < P.length; i++) st.line({ x: P[i - 1][0], y: P[i - 1][1] }, { x: P[i][0], y: P[i][1] }, col.text2, 3);
      P.forEach((p, i) => {
        const q = MOL.charge[i], c = q > 0 ? col.bad : q < 0 ? col.accent : col.muted;
        st.dot({ x: p[0], y: p[1] }, MOL.rot.includes(i) ? 9 : 7, c, MOL.rot.includes(i) ? col.warn : col.surface, MOL.rot.includes(i) ? 2.5 : 1.5);
        st.text(i === 0 ? "根" : String(i), { x: p[0], y: p[1] }, "#fff", { size: 9.5, weight: 700 });
      });
      st.text("红 +，蓝 −；黄圈 = 可旋转键", { x: -2.1, y: 2.9 }, col.muted, { align: "left", base: "top", size: 10.5 });
    }
  }

  // =================================================================
  // 组件 3：结的化简（图 7.31 的思路，补充实现）——删顶点、挪顶点，过程中线段不许相互穿过
  // =================================================================
  // 线段 pq 是否穿过三角形 abc（Möller–Trumbore；只算内部穿过）
  function segTri(p, q, a, b, c) {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), hh = cross(d, e2), det = dot(e1, hh);
    if (Math.abs(det) < 1e-12) return false;
    const f = 1 / det, s = sub(p, a), u = f * dot(s, hh); if (u < -1e-9 || u > 1 + 1e-9) return false;
    const qq = cross(s, e1), v = f * dot(d, qq); if (v < -1e-9 || u + v > 1 + 1e-9) return false;
    const t = f * dot(e2, qq); return t > -1e-9 && t < 1 + 1e-9;
  }
  // 三角形 (a, b, c) 扫过的区域里有没有别的线段（idx 是不参与检查的边的起点下标）
  function triClear(P, a, b, c, skip) {
    const n = P.length;
    for (let i = 0; i < n; i++) { if (skip.has(i)) continue; if (segTri(P[i], P[(i + 1) % n], a, b, c)) return false; }
    return true;
  }
  function tryDelete(P, i) {
    const n = P.length; if (n <= 3) return false;
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const skip = new Set([(i - 2 + n) % n, (i - 1 + n) % n, i, (i + 1) % n]);
    return triClear(P, a, b, c, skip);
  }
  function tryMove(P, i, to) {
    const n = P.length, a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    // 每个三角形只跳过与它共顶点的边：(a, b, to) 跳过 i−2、i−1、i；(c, b, to) 跳过 i−1、i、i+1
    return triClear(P, a, b, to, new Set([(i - 2 + n) % n, (i - 1 + n) % n, i])) && triClear(P, c, b, to, new Set([(i - 1 + n) % n, i, (i + 1) % n]));
  }
  const knotLen = (P) => P.reduce((s, p, i) => s + norm(sub(P[(i + 1) % P.length], p)), 0);
  function trefoil(n) { return Array.from({ length: n }, (_, k) => { const t = 2 * Math.PI * k / n; return [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]; }); }
  // 乱成一团的平凡结：从平面上的圆出发，只做「不穿过」的随机挪动，所以它一定还是平凡结
  function tangledUnknot(n, seed) {
    const r = C.rng(seed), P = Array.from({ length: n }, (_, k) => { const t = 2 * Math.PI * k / n; return [2.2 * Math.cos(t), 2.2 * Math.sin(t), 0]; });
    for (let it = 0; it < 6000; it++) {
      const i = Math.floor(r() * n), to = add(P[i], [(r() - 0.5) * 1.6, (r() - 0.5) * 1.6, (r() - 0.5) * 1.6]);
      if (norm(to) > 2.6) continue;
      if (tryMove(P, i, to)) P[i] = to;
    }
    return P;
  }
  // 化简一步：随机挑一个顶点，先试删除；不行就朝两邻居中点的方向挪一点（降低总长度）
  function simplifyStep(P, r) {
    const n = P.length, i = Math.floor(r() * n);
    if (tryDelete(P, i)) { P.splice(i, 1); return "delete"; }
    const a = P[(i - 1 + n) % n], c = P[(i + 1) % n], m = scl(add(a, c), 0.5);
    const to = add(add(P[i], scl(sub(m, P[i]), 0.25 + 0.5 * r())), [(r() - 0.5) * 0.2, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2]);
    if (tryMove(P, i, to)) { P[i] = to; return "move"; }
    return "fail";
  }

  class Knot {
    constructor(root) {
      this.kind = "unknot"; this.v3 = new C.View3D(0.4, 0.5, [0, 0, 0]); this.seed = 3;
      const body = C.frame(root, "结的化简", "补充实现：只允许「不让线段相互穿过」的局部操作——删掉一个顶点（相邻两点直接连上），或把顶点往邻居中点挪一点。拖动图旋转");
      this.st = new C.Stage(Object.assign({ view: [-3.4, 3.4, -3.1, 3.1], maxW: 460, aspect: 0.9, onDraw: (ctx, st, col) => this.draw(ctx, st, col), cursor: () => "grab" }, this.v3.dragHandlers(() => this.st.draw())));
      this.segK = C.seg([["unknot", "乱成一团的平凡结"], ["trefoil", "三叶结"]], this.kind, (k) => { this.kind = k; this.reset(); });
      this.runner = new C.Runner(() => { for (let i = 0; i < 60; i++) this.one(); this.render(); return this.stall <= 4000 && this.P.length > 3; }, () => this.render());
      this.stats = { n: C.stat("顶点数"), len: C.stat("总长度（能量）"), del: C.stat("删除次数"), stall: C.stat("上次删除后失败的尝试") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segK, C.button("▶ 化简", () => this.runner.start(), "small primary"), C.button("暂停", () => this.runner.stop(), "small"), C.button("重新打乱", () => { this.seed = C.newSeed(); this.reset(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg);
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.P = this.kind === "unknot" ? tangledUnknot(36, this.seed) : trefoil(30);
      this.r = C.rng(this.seed + 1); this.dels = 0; this.stall = 0;
      this.render();
    }
    one() { if (this.P.length <= 3) return; const k = simplifyStep(this.P, this.r); if (k === "delete") { this.dels++; this.stall = 0; } else if (k === "fail") this.stall++; }
    render() {
      this.stats.n.set(this.P.length); this.stats.len.set(knotLen(this.P).toFixed(2)); this.stats.del.set(this.dels); this.stats.stall.set(this.stall);
      const done = !this.runner.running && this.stall > 4000;
      this.msg.innerHTML = this.kind === "unknot" ?
        (this.P.length === 3 ? '<span class="yes">化成了三角形</span>：这个缠成一团的闭曲线等价于平凡结（unknot）。' : "平凡结可以一直化简到只剩 3 个顶点（三角形）。") :
        (done || this.P.length <= 8 ? `三叶结停在了 ${this.P.length} 个顶点，无论怎么试都删不掉更多——它<b>不</b>等价于平凡结（三叶结至少要 6 根线段）。` : "三叶结也能化简一部分，但永远到不了三角形。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const V = this.v3, P = this.P, n = P.length;
      // 由远到近画线段，每段先画一圈底色「描边」，造出上下交叉的效果
      // 结在化简时会越缩越小：按当前大小自动缩放到画布里
      const ctr = P.reduce((s, p) => add(s, scl(p, 1 / n)), [0, 0, 0]), R = Math.max(...P.map((p) => norm(sub(p, ctr)))) || 1, k = 2.7 / R;
      const pr = (p) => { const q = V.proj(sub(p, ctr)); return { x: q.x * k, y: q.y * k, depth: q.depth }; };
      const segs = P.map((p, i) => ({ a: pr(p), b: pr(P[(i + 1) % n]) })).map((s) => ({ ...s, d: (s.a.depth + s.b.depth) / 2 }));
      segs.sort((x, y) => y.d - x.d);
      const dmin = Math.min(...segs.map((s) => s.d)), dmax = Math.max(...segs.map((s) => s.d));
      for (const s of segs) {
        const A = s.a, B = s.b, t = (s.d - dmin) / (dmax - dmin + 1e-9);
        st.line(A, B, col.surface, 10);
        st.line(A, B, C.alpha(this.kind === "unknot" ? col.accent : col.goal, 1 - 0.55 * t), 4.5);
      }
      for (const p of P) st.dot(pr(p), 2.2, col.text);
    }
  }

  CH7.folding = { Carton, Energy, Knot, cartonFaces, NET, energy, molAtoms, segTri, tryDelete, tryMove, trefoil, tangledUnknot, simplifyStep, knotLen };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='carton']").forEach((el) => el._w = new Carton(el));
    document.querySelectorAll("[data-widget='energy']").forEach((el) => el._w = new Energy(el));
    document.querySelectorAll("[data-widget='knot']").forEach((el) => el._w = new Knot(el));
  });
})();
