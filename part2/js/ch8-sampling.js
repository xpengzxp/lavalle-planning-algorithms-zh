/* 8.5 节：漏斗组合与近似覆盖、无碰撞球 (8.53)、插值 (8.57)–(8.59)、带插值的值迭代与类 Dijkstra 版本 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;

  // =================================================================
  // 组件 15：增量构造近似覆盖 + 漏斗组合（图 8.14–8.18，式 8.50–8.52）
  // =================================================================
  const COVER_OBS = [C.rect(.18, .25, .3, .75), C.rect(.48, 0, .58, .45), C.rect(.48, .62, .58, 1), [{ x: .7, y: .3 }, { x: .9, y: .42 }, { x: .74, y: .58 }]];
  class Cover {
    constructor(root) {
      this.seqKind = "random"; this.m = 300; this.goal = { x: .9, y: .85 }; this.start = { x: .07, y: .1 }; this.showLevels = true;
      this.region = new C.Region(C.rect(0, 0, 1, 1), COVER_OBS);
      const body = C.frame(root, "增量构造近似覆盖，再把漏斗串起来", "图 8.17：样本 α(i) 若在 C_free 里且不在任何邻域中，就以碰撞检测给出的距离 d 为半径放一个球");
      this.st = new C.Stage({ maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { if (!this.region.inside(p)) return null; if (C.dist(p, this.goal) < .03) return "G"; this.start = p; this.exec(); this.st.draw(); return "I"; },
        onMove: (p, d) => { if (!this.region.inside(p)) return; if (d === "G") { this.goal = p; this.plan(); } else { this.start = p; this.exec(); } this.st.draw(); },
        cursor: (p) => (C.dist(p, this.goal) < .03 ? "grab" : "crosshair") });
      this.segS = C.seg([["random", "随机样本"], ["halton", "Halton 序列"]], this.seqKind, (k) => { this.seqKind = k; this.reset(); });
      this.sM = C.slider("终止：最近 m 个自由样本里新邻域 ≤ 1，m =", 50, 1000, 50, this.m, (v) => { this.m = v; this.update(); });
      this.cbL = C.check("显示 φ 的等值线（式 8.51）", true, (v) => { this.showLevels = v; this.st.draw(); });
      this.stats = { i: C.stat("样本 i"), n: C.stat("邻域个数 |O|"), est: C.stat("估计覆盖率"), tru: C.stat("真实覆盖率"), res: C.stat("从起点执行") };
      body.append(h("div", { class: "controls" }, this.segS, C.button("+1", () => this.add(1)), C.button("+10", () => this.add(10)), C.button("+100", () => this.add(100)), C.button("直到满足终止条件", () => this.add(20000, true), "primary"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "controls" }, this.sM, C.button("第 5 步：删掉被别的球包住的球", () => { this.prune(); }, "small"), this.cbL),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("p", { class: "small muted", style: "margin:6px 0" }, "点机器人：碰撞检测给出的距离 d 恰好就是到 C_obs 的距离，所以 B(x, d) ⊂ C_free。覆盖建好后，拖动 x_G 可以立刻换一个目标重算——邻域图不用重建。"),
          C.legend([[C.cva("accent", .5), "邻域（球）"], [C.cv("bad"), "最新的样本"], [C.cv("path"), "沿漏斗走的轨迹"], [C.cva("warn", .6), "相邻漏斗之间的转移点"]]))));
      this.reset();
    }
    reset() {
      this.O = []; this.i = 0; this.hist = []; this.last = null;
      this.r = C.rng(8);
      this.add(60);
    }
    alpha(i) { return this.seqKind === "halton" ? { x: C.radInv(i + 1, 2), y: C.radInv(i + 1, 3) } : { x: this.r(), y: this.r() }; }
    // 图 8.17 的一次迭代
    stepOnce() {
      const x = this.alpha(this.i++); this.last = x;
      if (!this.region.inside(x)) return;
      const covered = this.O.some((o) => C.dist(x, o) < o.r);
      this.hist.push(covered ? 0 : 1);
      if (covered) return;
      const d = this.region.clearance(x);
      if (d > 1e-4) this.O.push({ x: x.x, y: x.y, r: d });
    }
    newInLast() { const H = this.hist, m = this.m; let s = 0; for (let k = Math.max(0, H.length - m); k < H.length; k++) s += H[k]; return s; }
    add(n, untilDone) {
      for (let k = 0; k < n; k++) { this.stepOnce(); if (untilDone && this.hist.length >= this.m && this.newInLast() <= 1) break; }
      this.plan();
    }
    prune() { this.O = this.O.filter((o, i) => !this.O.some((p, j) => j !== i && C.dist(o, p) + o.r <= p.r + 1e-12 && (p.r > o.r || j < i))); this.plan(); }
    trueCoverage() {
      let fr = 0, cv = 0; const N = 120;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = { x: (i + .5) / N, y: (j + .5) / N }; if (!this.region.inside(p)) continue; fr++; if (this.O.some((o) => C.dist(p, o) < o.r)) cv++; }
      return cv / fr;
    }
    // 离散规划：超状态 = 邻域，相交就有超动作；从含 x_G 的邻域做 BFS 得 φ̌
    plan() {
      const O = this.O, n = O.length;
      this.adj = O.map(() => []);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (C.dist(O[i], O[j]) < O[i].r + O[j].r - 1e-9) { this.adj[i].push(j); this.adj[j].push(i); }
      this.phiC = new Array(n).fill(Infinity); this.nxt = new Array(n).fill(-1); this.tgt = new Array(n).fill(null);
      const q = []; O.forEach((o, i) => { if (C.dist(this.goal, o) < o.r) { this.phiC[i] = 0; q.push(i); } });
      for (let k = 0; k < q.length; k++) { const a = q[k]; for (const b of this.adj[a]) if (this.phiC[b] === Infinity) { this.phiC[b] = this.phiC[a] + 1; this.nxt[b] = a; q.push(b); } }
      // 转移点：O 与 O' 重叠透镜的中心，在两个球里都有
      O.forEach((o, i) => {
        if (this.phiC[i] === 0) { this.tgt[i] = this.goal; return; }
        const j = this.nxt[i]; if (j < 0) return;
        const p = O[j], L = C.dist(o, p), s = (o.r + L - p.r) / 2;
        this.tgt[i] = { x: o.x + (p.x - o.x) * s / L, y: o.y + (p.y - o.y) * s / L };
      });
      this.exec(); this.update(); this.st.draw();
    }
    // 式 (8.51)：φ(x) = min_{O ∋ x} { φ_O(x) + c·φ̌(O) }；c 比任何 φ_O 都大
    pick(x) {
      let best = null, bv = Infinity;
      this.O.forEach((o, i) => { if (!this.tgt[i] || C.dist(x, o) >= o.r) return; const v = C.dist(x, this.tgt[i]) + 2 * this.phiC[i]; if (v < bv) { bv = v; best = i; } });
      return { i: best, v: bv };
    }
    exec() {
      const pts = [this.start]; let p = this.start, res = "未覆盖";
      for (let k = 0; k < 3000; k++) {
        if (C.dist(p, this.goal) < .006) { res = "到达"; break; }
        const { i } = this.pick(p); if (i === null) { res = k ? "离开了覆盖" : "起点不在覆盖里"; break; }
        const t = this.tgt[i], d = C.dist(p, t), s = Math.min(.004, d);
        if (d < 1e-12) { p = { x: p.x + 1e-6, y: p.y }; continue; }
        p = { x: p.x + s * (t.x - p.x) / d, y: p.y + s * (t.y - p.y) / d }; pts.push(p);
      }
      this.path = pts; this.res = res;
    }
    update() {
      this.stats.i.set(this.i); this.stats.n.set(this.O.length);
      const H = this.hist, m = Math.min(this.m, H.length), nn = this.newInLast();
      this.stats.est.set(m ? `${(100 * (1 - nn / m)).toFixed(1)}%` + (H.length >= this.m && nn <= 1 ? ' <span class="yes small">✓ 可终止</span>' : "") : "—");
      this.stats.tru.set(`${(100 * this.trueCoverage()).toFixed(1)}%`);
      this.stats.res.set(this.res === "到达" ? '<span class="yes">✓ 到达</span>' : `<span class="no">${this.res}</span>`);
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.showLevels && this.O.length) {
        const N = 110, F = C.sampleField((p) => (this.region.inside(p) ? this.pick(p).v : Infinity), N, N, [0, 1, 0, 1]);
        st.heat(F.vals, N, N, (v) => (v - F.min) / (F.max - F.min || 1), col, { bands: 18, rect: [-.5 / N, 1 + .5 / N, -.5 / N, 1 + .5 / N] });
      }
      for (const o of this.O) st.circle(o, o.r, this.showLevels ? null : C.alpha(col.accent, .08), C.alpha(col.accent, .55), 1);
      for (const P of COVER_OBS) st.poly(P, C.alpha(col.wall, .88), col.wall, 1);
      this.O.forEach((o, i) => { if (this.tgt[i] && this.phiC[i] > 0) st.dot(this.tgt[i], 1.6, C.alpha(col.warn, .7)); });
      if (this.last) st.dot(this.last, 3.5, col.bad);
      st.polyline(this.path, col.path, 2.6);
      st.qmark(this.start, "I", col); st.qmark(this.goal, "G", col);
    }
  }

  // =================================================================
  // 组件 16：SE(2) 中的无碰撞球——式 (8.53) 与改正后的条件
  // =================================================================
  const ROBOT = [[-.18, -.1], [.32, -.1], [.32, .1], [.05, .1], [.05, .22], [-.18, .22]].map(([x, y]) => ({ x, y }));
  const SB_OBS = [[{ x: .45, y: -.55 }, { x: .95, y: -.55 }, { x: .95, y: .05 }, { x: .6, y: -.1 }], [{ x: -.9, y: .35 }, { x: -.35, y: .35 }, { x: -.35, y: .6 }, { x: -.9, y: .6 }]];
  function segSegDist(a, b, c, d) { if (C.segCross(a, b, c, d)) return 0; return Math.min(C.segPointDist(a, c, d).d, C.segPointDist(b, c, d).d, C.segPointDist(c, a, b).d, C.segPointDist(d, a, b).d); }
  function polyDist(P, Q) {
    if (C.inPoly(P[0], Q) || C.inPoly(Q[0], P)) return 0;
    let m = Infinity;
    for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) m = Math.min(m, segSegDist(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length]));
    return m;
  }
  class SafeBall {
    constructor(root) {
      this.q = { x: .08, y: -.02, th: .25 }; this.dx = 0; this.dy = 0; this.dth = 0;
      this.r = Math.max(...ROBOT.map((p) => Math.hypot(p.x, p.y)));
      const body = C.frame(root, "SE(2) 里多大的扰动一定无碰撞？", "机器人 A 平移 (Δx, Δy)、旋转 Δθ；离旋转中心最远的点 a_r 距离为 r，碰撞检测给出距离 d");
      this.st = new C.Stage({ view: [-1, 1, -.7, .7], aspect: .7, maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.inPoly(this.toW(p, true), ROBOT) ? (this.grab = { x: p.x - this.q.x, y: p.y - this.q.y }, "R") : null),
        onMove: (p) => { const q = { ...this.q, x: p.x - this.grab.x, y: p.y - this.grab.y }; if (polyDist(this.place(q), SB_OBS[0]) > 0 && polyDist(this.place(q), SB_OBS[1]) > 0) { this.q = q; this.upd(); } },
        cursor: (p) => (C.inPoly(this.toW(p, true), ROBOT) ? "grab" : null) });
      this.inset = new C.Stage({ view: [-1.25, 1.25, -1.25, 1.25], maxW: 200, minW: 150, onDraw: (ctx, st, col) => this.drawInset(ctx, st, col) });
      this.sTh = C.slider("θ", -3.1, 3.1, .01, this.q.th, (v) => { this.q.th = v; this.upd(); }, (v) => v.toFixed(2));
      this.sDx = C.slider("Δx", -.3, .3, .005, 0, (v) => { this.dx = v; this.upd(); }, (v) => v.toFixed(3));
      this.sDy = C.slider("Δy", -.3, .3, .005, 0, (v) => { this.dy = v; this.upd(); }, (v) => v.toFixed(3));
      this.sDt = C.slider("Δθ", -.8, .8, .005, 0, (v) => { this.dth = v; this.upd(); }, (v) => v.toFixed(3));
      this.info = h("div", { class: "panel-body" });
      body.append(h("div", { class: "controls" }, this.sTh, C.button("找 (8.53) 椭球表面上最坏的扰动", () => this.worst(), "primary"), C.button("清零扰动", () => { this.dx = this.dy = this.dth = 0; this.sync(); this.upd(); }, "small")),
        h("div", { class: "controls" }, this.sDx, this.sDy, this.sDt),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "检查"), this.info),
          h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "截面：横轴 ±√(Δx²+Δy²)/d，纵轴 rΔθ/d"), this.inset.wrap))),
        C.legend([[C.cv("accent"), "机器人在 q"], [C.cv("path"), "扰动后（无碰撞）"], [C.cv("bad"), "扰动后（碰撞）"], [C.cv("warn"), "(8.53) 的圆盘截面"], [C.cv("ok"), "补充：√(Δx²+Δy²) + r|Δθ| < d"]]));
      this.upd();
    }
    place(q) { const c = Math.cos(q.th), s = Math.sin(q.th); return ROBOT.map((p) => ({ x: q.x + c * p.x - s * p.y, y: q.y + s * p.x + c * p.y })); }
    toW(p, inv) { const c = Math.cos(this.q.th), s = Math.sin(this.q.th), x = p.x - this.q.x, y = p.y - this.q.y; return { x: c * x + s * y, y: -s * x + c * y }; }
    dist(q) { const P = this.place(q); return Math.min(...SB_OBS.map((Q) => polyDist(P, Q))); }
    sync() { this.sDx.set(this.dx); this.sDy.set(this.dy); this.sDt.set(this.dth); }
    worst() {
      // 在 (8.53) 椭球表面（缩小 0.1%）上网格搜索：扰动后离障碍最近（或穿透）的那个
      const d = this.dist(this.q), r = this.r; let best = null;
      for (let a = 0; a < 60; a++) {
        const th = (-1 + 2 * (a + .5) / 60) * d / r, rest = Math.sqrt(Math.max(0, d * d - (r * th) ** 2)) * .999;
        for (let b = 0; b < 72; b++) {
          const ang = 2 * Math.PI * b / 72, q = { x: this.q.x + rest * Math.cos(ang), y: this.q.y + rest * Math.sin(ang), th: this.q.th + th };
          const P = this.place(q), dd = Math.min(...SB_OBS.map((Q) => polyDist(P, Q)));
          const pen = dd > 0 ? dd : -this.depth(P);
          if (!best || pen < best.pen) best = { pen, dx: rest * Math.cos(ang), dy: rest * Math.sin(ang), dth: th };
        }
      }
      this.dx = best.dx; this.dy = best.dy; this.dth = best.dth; this.sync(); this.upd();
    }
    // 穿透深度的粗略度量：落在障碍里的机器人顶点离障碍边界的最大距离
    depth(P) { let m = 1e-6; for (const Q of SB_OBS) for (const p of P) if (C.inPoly(p, Q)) { let e = Infinity; for (let j = 0; j < Q.length; j++) e = Math.min(e, C.segPointDist(p, Q[j], Q[(j + 1) % Q.length]).d); m = Math.max(m, e); } return m; }
    upd() {
      const d = this.dist(this.q), r = this.r, t = Math.hypot(this.dx, this.dy);
      const q2 = { x: this.q.x + this.dx, y: this.q.y + this.dy, th: this.q.th + this.dth };
      const P0 = this.place(this.q), P1 = this.place(q2);
      const disp = Math.max(...P0.map((p, i) => C.dist(p, P1[i])));
      const d2 = this.dist(q2), hit = d2 <= 0;
      const ell = this.dx ** 2 + this.dy ** 2 + (r * this.dth) ** 2, cone = t + r * Math.abs(this.dth);
      const ok = (b) => (b ? '<span class="yes">✓</span>' : '<span class="no">✗</span>');
      this.info.innerHTML = `d = <b>${d.toFixed(3)}</b>，r = ${r.toFixed(3)}<br>
        ${ok(ell < d * d)} (8.53)：Δx² + Δy² + (rΔθ)² = ${ell.toFixed(4)} ${ell < d * d ? "<" : "≥"} d² = ${(d * d).toFixed(4)}<br>
        ${ok(cone < d)} 补充：√(Δx²+Δy²) + r|Δθ| = ${cone.toFixed(3)} ${cone < d ? "<" : "≥"} d<br>
        机器人上的点最大位移 = <b>${disp.toFixed(3)}</b> ${disp < d ? "<" : "≥"} d<br>
        扰动后：${hit ? '<span class="no">✕ 碰撞</span>' : `<span class="yes">无碰撞</span>（距离 ${d2.toFixed(3)}）`}` +
        (ell < d * d && hit ? '<br><span class="no">满足 (8.53) 却碰撞了：(8.53) 不足以保证球在 C_free 里。</span>' : "");
      this.cur = { d, hit, q2 };
      this.st.draw(); this.inset.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const Q of SB_OBS) st.poly(Q, C.alpha(col.wall, .88), col.wall, 1);
      const P0 = this.place(this.q);
      st.poly(P0, C.alpha(col.accent, .25), col.accent, 2);
      if (this.cur && (this.dx || this.dy || this.dth)) st.poly(this.place(this.cur.q2), C.alpha(this.cur.hit ? col.bad : col.path, .2), this.cur.hit ? col.bad : col.path, 2);
      st.dot(this.q, 4, col.text, col.surface, 1.5);
      // 离障碍 d 的「安全带」只画一个圆：以 a_r 为圆心半径 d（直观提示）
      const c = Math.cos(this.q.th), s = Math.sin(this.q.th);
      const ar = ROBOT.reduce((a, p) => (Math.hypot(p.x, p.y) > Math.hypot(a.x, a.y) ? p : a));
      const arW = { x: this.q.x + c * ar.x - s * ar.y, y: this.q.y + s * ar.x + c * ar.y };
      st.dot(arW, 4, col.warn); st.text("a_r", arW, col.warn, { dx: 12, dy: -8, size: 11, weight: 650 });
      st.circle(arW, this.cur ? this.cur.d : 0, null, C.alpha(col.warn, .6), 1, [3, 3]);
      st.line(this.q, arW, C.alpha(col.warn, .6), 1, [2, 3]);
    }
    drawInset(ctx, st, col) {
      st.frame(col);
      st.line({ x: -1.25, y: 0 }, { x: 1.25, y: 0 }, col.border, 1); st.line({ x: 0, y: -1.25 }, { x: 0, y: 1.25 }, col.border, 1);
      st.circle({ x: 0, y: 0 }, 1, C.alpha(col.warn, .12), col.warn, 1.5);
      st.poly([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }], C.alpha(col.ok, .18), col.ok, 1.5);
      if (this.cur && this.cur.d > 0) { const p = { x: Math.hypot(this.dx, this.dy) * Math.sign(this.dx || 1) / this.cur.d, y: this.r * this.dth / this.cur.d }; st.dot({ x: C.clamp(p.x, -1.24, 1.24), y: C.clamp(p.y, -1.24, 1.24) }, 4.5, this.cur.hit ? col.bad : col.path, col.surface, 1.5); }
      st.text("圆：(8.53)", { x: .95, y: 1.12 }, col.warn, { size: 10.5, align: "right" });
      st.text("菱形：保证无碰", { x: -1.2, y: -1.12 }, col.ok, { size: 10.5, align: "left" });
    }
  }

  // =================================================================
  // 组件 17：插值——(8.57)(8.58) 的线性插值、(8.59) 双线性、单纯形（Kuhn）插值
  // =================================================================
  class Interp {
    constructor(root) {
      this.r = 3; this.x = .5; this.vals = [.2, .9, .4, .7, .3, .8, .5, .6, .1]; this.p = { x: .62, y: .3 }; this.corner = [1, 3, 2, 5];  // G(0,0), G(1,0), G(0,1), G(1,1)
      const body = C.frame(root, "在样本之间插值", "左：X = [0,1]，s_i = i/r；右：一个网格单元的 4 个角，双线性 (8.59) vs 单纯形插值（图 8.20）");
      this.s1 = new C.Stage({ view: [-.05, 1.05, -.1, 1.1], aspect: .75, maxW: 380, onDraw: (ctx, st, col) => this.draw1(ctx, st, col),
        onDown: (p) => { for (let i = 0; i <= this.r; i++) if (Math.abs(p.x - i / this.r) < .03 && Math.abs(p.y - this.vals[i]) < .06) return i; this.x = C.clamp(p.x, 0, 1); this.upd(); return "x"; },
        onMove: (p, d) => { if (d === "x") this.x = C.clamp(p.x, 0, 1); else this.vals[d] = C.clamp(p.y, 0, 1); this.upd(); } });
      this.s2 = new C.Stage({ view: [-.15, 1.15, -.15, 1.15], maxW: 300, minW: 180, onDraw: (ctx, st, col) => this.draw2(ctx, st, col),
        onDown: (p) => { this.p = { x: C.clamp(p.x, 0, 1), y: C.clamp(p.y, 0, 1) }; this.upd(); return "p"; },
        onMove: (p) => { this.p = { x: C.clamp(p.x, 0, 1), y: C.clamp(p.y, 0, 1) }; this.upd(); } });
      this.sR = C.slider("r", 2, 8, 1, this.r, (v) => { this.r = v; this.upd(); });
      this.info1 = h("div", { class: "panel-body mono", style: "font-size:12.5px" });
      this.info2 = h("div", { class: "panel-body mono", style: "font-size:12.5px" });
      body.append(h("div", { class: "controls" }, this.sR, h("span", { class: "small muted" }, "拖动样本点改值、在左图里点击/拖动 x；右图拖动点 x")),
        h("div", { class: "split" }, h("div", null, this.s1.wrap, h("div", { class: "panel" }, this.info1)), h("div", null, this.s2.wrap, h("div", { class: "panel" }, this.info2))),
        C.legend([[C.cv("accent"), "样本 s_i 与它们的 G 值"], [C.cv("path"), "改正后的 α 给出的插值"], [C.cv("bad"), "按原书 (8.58) 的 α"], [C.cva("warn", .5), "单纯形插值用到的三角形"]]));
      this.upd();
    }
    lin() {
      const r = this.r, x = this.x;
      let i = Math.min(r - 1, Math.floor(x * r + 1e-12)); const si = i / r;
      const a = 1 - r * (x - si), aBook = 1 - (x - si) / r;
      const G = (k) => this.vals[k];
      return { i, si, a, aBook, v: a * G(i) + (1 - a) * G(i + 1), vBook: aBook * G(i) + (1 - aBook) * G(i + 1) };
    }
    upd() {
      const L = this.lin();
      this.info1.innerHTML = `x = ${this.x.toFixed(3)}，插值邻居 s_${L.i} = ${L.si.toFixed(3)}、s_${L.i + 1} = ${((L.i + 1) / this.r).toFixed(3)}<br>
        改正 α = 1 − r(x − s_i) = <b>${L.a.toFixed(3)}</b> → G ≈ ${L.v.toFixed(3)}<br>
        <span style="color:var(--bad)">原书 α = 1 − (x − s_i)/r = ${L.aBook.toFixed(3)} → ${L.vBook.toFixed(3)}</span>`;
      const { x, y } = this.p, [g00, g10, g01, g11] = this.corner;
      const a1 = 1 - x, a2 = 1 - y;
      const bil = a1 * a2 * g00 + (1 - a1) * a2 * g10 + a1 * (1 - a2) * g01 + (1 - a1) * (1 - a2) * g11;
      // Kuhn：按坐标从大到小排序，从 (0,0) 出发逐个坐标加 1；权重是相邻排序值之差
      const up = x >= y, w = up ? [1 - x, x - y, y] : [1 - y, y - x, x], verts = up ? [[0, 0], [1, 0], [1, 1]] : [[0, 0], [0, 1], [1, 1]];
      const gv = { "0,0": g00, "1,0": g10, "0,1": g01, "1,1": g11 };
      const kuhn = w.reduce((s, wi, k) => s + wi * gv[verts[k].join(",")], 0);
      this.kuhn = { verts, w };
      this.info2.innerHTML = `x = (${x.toFixed(2)}, ${y.toFixed(2)})，α₁ = ${a1.toFixed(2)}，α₂ = ${a2.toFixed(2)}<br>
        双线性 (8.59)：4 个邻居，权重 ${[a1 * a2, (1 - a1) * a2, a1 * (1 - a2), (1 - a1) * (1 - a2)].map((v) => v.toFixed(2)).join(" / ")} → <b>${bil.toFixed(3)}</b><br>
        单纯形：${up ? "x₁ ≥ x₂" : "x₁ < x₂"} → 三角形 ${verts.map((v) => `(${v})`).join("")}，权重 ${w.map((v) => v.toFixed(2)).join(" / ")} → <b>${kuhn.toFixed(3)}</b>`;
      this.s1.draw(); this.s2.draw();
    }
    draw1(ctx, st, col) {
      st.frame(col);
      st.line({ x: 0, y: 0 }, { x: 1, y: 0 }, col.border, 1);
      const r = this.r, P = []; for (let i = 0; i <= r; i++) P.push({ x: i / r, y: this.vals[i] });
      st.polyline(P, C.alpha(col.path, .55), 1.6);
      for (let i = 0; i <= r; i++) { st.line({ x: i / r, y: 0 }, P[i], C.alpha(col.muted, .5), 1, [2, 3]); st.dot(P[i], 5.5, col.accent, col.surface, 1.5); st.text(`s${i}`, { x: i / r, y: 0 }, col.muted, { size: 10.5, dy: 11 }); }
      const L = this.lin();
      st.line({ x: this.x, y: 0 }, { x: this.x, y: Math.max(L.v, L.vBook) }, C.alpha(col.text2, .5), 1, [3, 3]);
      st.dot({ x: this.x, y: L.v }, 5.5, col.path, col.surface, 1.5);
      st.xmark({ x: this.x, y: L.vBook }, col.bad, 5);
      st.dot({ x: this.x, y: 0 }, 4, col.start); st.text("x", { x: this.x, y: 0 }, col.start, { dy: 22, weight: 700 });
    }
    draw2(ctx, st, col) {
      st.frame(col);
      const [g00, g10, g01, g11] = this.corner, R = C.ramp(col), mx = Math.max(...this.corner);
      // 单元内的双线性函数用颜色表示
      const N = 40, vals = new Float64Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i / (N - 1), y = j / (N - 1); vals[j * N + i] = (1 - x) * (1 - y) * g00 + x * (1 - y) * g10 + (1 - x) * y * g01 + x * y * g11; }
      st.heat(vals, N, N, (v) => v / mx, col, { rect: [0, 1, 0, 1] });
      st.poly(C.rect(0, 0, 1, 1), null, col.strong, 1.5);
      st.line({ x: 0, y: 0 }, { x: 1, y: 1 }, col.text2, 1.2, [4, 3]);
      st.poly(this.kuhn.verts.map(([a, b]) => ({ x: a, y: b })), C.alpha(col.warn, .25), col.warn, 2);
      [[0, 0, g00], [1, 0, g10], [0, 1, g01], [1, 1, g11]].forEach(([a, b, g]) => { st.dot({ x: a, y: b }, 6, col.accent, col.surface, 1.5); st.text(`G=${g}`, { x: a, y: b }, col.text, { dx: a ? -8 : 8, dy: b ? -12 : 12, size: 11, align: a ? "right" : "left", weight: 650 }); });
      st.dot(this.p, 5, col.start, col.surface, 1.5);
    }
  }

  // =================================================================
  // 组件 18：带插值的值迭代（8.5.2 节；图 8.19、8.21、8.22）
  // =================================================================
  const VI_OBS = [C.rect(.3, .15, .42, .7), C.rect(.58, .45, .7, 1), [{ x: .66, y: .1 }, { x: .88, y: .18 }, { x: .72, y: .32 }]];
  class ValueIter {
    constructor(root) {
      this.N = 21; this.K = 16; this.dtH = 1.5; this.rg = .07; this.goal = { x: .86, y: .82 }; this.mode = "vi"; this.start = { x: .08, y: .1 }; this.hover = null; this.showR = false;
      this.region = new C.Region(C.rect(0, 0, 1, 1), VI_OBS);
      const body = C.frame(root, "带插值的值迭代", "样本是规则网格 S；x + Δt·u 落在样本之间就用双线性插值 (8.59)；鼠标停在一个样本上看图 8.19");
      this.st = new C.Stage({ maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { if (C.dist(p, this.goal) < .04) return "G"; if (this.region.inside(p)) { this.start = p; this.exec(); this.st.draw(); return "I"; } return null; },
        onMove: (p, d) => { if (!this.region.inside(p)) return; if (d === "G") { this.goal = p; this.reset(); } else { this.start = p; this.exec(); this.st.draw(); } },
        onHover: (p) => { const h0 = 1 / (this.N - 1), i = Math.round(p.x / h0), j = Math.round(p.y / h0); const s = i >= 0 && j >= 0 && i < this.N && j < this.N && Math.hypot(p.x - i * h0, p.y - j * h0) < h0 * .3 ? [i, j] : null; if (String(s) !== String(this.hover)) { this.hover = s; this.st.draw(); } },
        onLeave: () => { this.hover = null; this.st.draw(); },
        cursor: (p) => (C.dist(p, this.goal) < .04 ? "grab" : "crosshair") });
      this.segM = C.seg([["vi", "值迭代：每轮更新所有样本"], ["dij", "类 Dijkstra：dead / alive / unvisited"]], this.mode, (k) => { this.mode = k; this.reset(); });
      this.sN = C.slider("每轴样本数 N", 11, 41, 2, this.N, (v) => { this.N = v; this.reset(); });
      this.sK = C.select([["4", "4 个方向（曼哈顿）"], ["8", "8 个方向"], ["16", "16 个方向"], ["32", "32 个方向"]], String(this.K), (v) => { this.K = +v; this.reset(); });
      this.sDt = C.slider("Δt =", .5, 3, .1, this.dtH, (v) => { this.dtH = v; this.reset(); }, (v) => `${v.toFixed(1)} h`);
      this.sRg = C.slider("目标半径", .01, .15, .005, this.rg, (v) => { this.rg = v; this.reset(); }, (v) => v.toFixed(3));
      this.cbR = C.check("显示插值区域 R(S)", false, (v) => { this.showR = v; this.st.draw(); });
      this.runner = new C.Runner(() => { const more = this.iterate(this.mode === "vi" ? 1 : Math.max(1, Math.round(this.N * this.N / 60))); this.update(); this.st.draw(); this.frame++; return more; }, () => { this.bRun.textContent = "▶ 运行"; this.exec(); this.update(); this.st.draw(); });
      this.bRun = C.button("▶ 运行", () => { if (this.runner.running) this.runner.stop(); else { this.runner.start(); this.bRun.textContent = "⏸ 暂停"; } }, "primary");
      this.stats = { it: C.stat("轮数 / 出队数"), ev: C.stat("动作求值次数（每次 = 一次插值）"), fin: C.stat("有限值的样本"), ch: C.stat("最大改变量 / 比较"), path: C.stat("执行：路径长度") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.bRun, C.button("一步", () => { this.iterate(1); this.update(); this.st.draw(); }), C.button("跑完", () => { while (this.iterate(50)); this.exec(); this.update(); this.st.draw(); }), C.button("重置", () => this.reset(), "small"), this.cbR),
        h("div", { class: "controls" }, this.sN, this.sK, this.sDt, this.sRg),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cva("accent", .55), "G*（插值后的 cost-to-go，越深越大）"], [C.cv("dead"), "dead"], [C.cv("alive"), "alive"], [C.cv("goal"), "目标样本 G = S ∩ X_G"], [C.cv("path"), "按 G* 执行的轨迹"], [C.cv("alive2"), "图 8.19：x + Δt·u 与它的插值邻居"]]))));
      this.reset();
    }
    get h() { return 1 / (this.N - 1); }
    idx(i, j) { return j * this.N + i; }
    U() { const K = this.K, out = []; for (let k = 0; k < K; k++) { const a = 2 * Math.PI * k / K; out.push({ x: Math.cos(a), y: Math.sin(a) }); } return out; }
    reset() {
      if (this.runner) this.runner.stop();
      const N = this.N, hh = this.h, n = N * N;
      this.free = new Uint8Array(n); this.isG = new Uint8Array(n); this.G = new Float64Array(n).fill(Infinity);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const p = { x: i * hh, y: j * hh }, k = this.idx(i, j); this.free[k] = this.region.inside(p) || (this.region.insideLoose(p) && this.region.clearance(p) < 1e-9 && !VI_OBS.some((P) => C.inPoly(p, P))) ? 1 : 0; if (this.free[k] && C.dist(p, this.goal) <= this.rg) { this.isG[k] = 1; this.G[k] = 0; } }
      this.dt = this.dtH * hh; this.Us = this.U();
      this.iters = 0; this.evals = 0; this.change = Infinity; this.done = false; this.path = null; this.cmp = null;
      // 类 Dijkstra 的数据结构：依赖关系（谁的某个动作会落到以 s 为角的单元里）
      this.state = new Uint8Array(n);   // 0 unvisited, 1 alive, 2 dead
      if (this.mode === "dij") {
        this.dep = Array.from({ length: n }, () => []);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const k = this.idx(i, j); if (!this.free[k] || this.isG[k]) continue;
          const seen = new Set();
          for (const u of this.Us) for (const c of this.corners(i * hh + this.dt * u.x, j * hh + this.dt * u.y)) if (!seen.has(c)) { seen.add(c); this.dep[c].push(k); }
        }
        this.heap = new C.Heap(); this.pops = 0;
        for (let k = 0; k < n; k++) if (this.isG[k]) this.state[k] = 2;
        for (let k = 0; k < n; k++) if (this.isG[k]) for (const s of this.dep[k]) this.relax(s);
      }
      const gCount = this.isG.reduce((a, b) => a + b, 0);
      this.msg.innerHTML = !gCount ? '<span class="no">目标圆盘里一个样本都没有：G = S ∩ X_G 为空。把目标调大。</span>'
        : this.dtH < 1 ? '<span class="no">Δt < h：每个样本 x 的每个动作都落在以 x 自己为一个角的单元里，插值要用到 G(x) = ∞，于是值永远是 ∞——书中说「Δt 必须足够大，使新的样本能到达 G」。</span>'
          : "";
      this.exec(); this.update(); this.st.draw();
    }
    // 落点 (x, y) 的插值邻居（权重为正的那些单元角）
    corners(x, y) {
      const N = this.N, hh = this.h; if (x < -1e-12 || y < -1e-12 || x > 1 + 1e-12 || y > 1 + 1e-12) return [];
      const i = Math.min(N - 2, Math.max(0, Math.floor(x / hh + 1e-12))), j = Math.min(N - 2, Math.max(0, Math.floor(y / hh + 1e-12)));
      const fx = x / hh - i, fy = y / hh - j, out = [];
      if ((1 - fx) * (1 - fy) > 1e-12) out.push(this.idx(i, j));
      if (fx * (1 - fy) > 1e-12) out.push(this.idx(i + 1, j));
      if ((1 - fx) * fy > 1e-12) out.push(this.idx(i, j + 1));
      if (fx * fy > 1e-12) out.push(this.idx(i + 1, j + 1));
      return out;
    }
    // 双线性插值 (8.59)（α 用改正后的 8.58）；任何插值邻居是 ∞（障碍或尚未到达）都给 ∞
    interp(G, x, y) {
      const N = this.N, hh = this.h; if (x < -1e-12 || y < -1e-12 || x > 1 + 1e-12 || y > 1 + 1e-12) return Infinity;
      const i = Math.min(N - 2, Math.max(0, Math.floor(x / hh + 1e-12))), j = Math.min(N - 2, Math.max(0, Math.floor(y / hh + 1e-12)));
      const a1 = 1 - (x / hh - i), a2 = 1 - (y / hh - j);
      const w = [a1 * a2, (1 - a1) * a2, a1 * (1 - a2), (1 - a1) * (1 - a2)], ks = [this.idx(i, j), this.idx(i + 1, j), this.idx(i, j + 1), this.idx(i + 1, j + 1)];
      let s = 0;
      for (let k = 0; k < 4; k++) { if (w[k] <= 1e-12) continue; const v = G[ks[k]]; if (!this.free[ks[k]] || v === Infinity) return Infinity; s += w[k] * v; }
      return s;
    }
    // (8.56)：G(x) = min_u { l_d + G(x + Δt·u) }，l_d = Δt‖u‖ = Δt
    bellman(G, k) {
      const N = this.N, hh = this.h, i = k % N, j = (k - i) / N; let best = Infinity;
      for (const u of this.Us) { this.evals++; const v = this.dt + this.interp(G, i * hh + this.dt * u.x, j * hh + this.dt * u.y); if (v < best) best = v; }
      return best;
    }
    relax(s) {
      if (this.state[s] === 2 || !this.free[s] || this.isG[s]) return;
      const v = this.bellman(this.G, s);
      if (v < this.G[s] - 1e-12) { this.G[s] = v; this.heap.push(s, v); this.state[s] = 1; }
    }
    iterate(n) {
      if (this.done) return false;
      for (let t = 0; t < n && !this.done; t++) {
        if (this.mode === "vi") {
          const G = this.G, NG = G.slice(); let ch = 0;
          for (let k = 0; k < G.length; k++) { if (!this.free[k] || this.isG[k]) continue; const v = this.bellman(G, k); NG[k] = v; if (v !== G[k]) ch = Math.max(ch, G[k] === Infinity ? 1 : Math.abs(v - G[k])); }
          this.G = NG; this.iters++; this.change = ch;
          if (ch < 1e-9) this.done = true;
        } else {
          let s = -1; while (this.heap.size) { const c = this.heap.pop(); if (this.state[c] === 1) { s = c; break; } }
          if (s < 0) { this.done = true; break; }
          this.state[s] = 2; this.pops++;
          for (const d of this.dep[s]) this.relax(d);
        }
      }
      if (this.done) { this.exec(); if (this.mode === "dij") this.compareVI(); }
      return !this.done;
    }
    // 同一设置下把值迭代跑到不动点，与类 Dijkstra 的结果比较（不计入求值次数）
    compareVI() {
      const ev = this.evals; let G = new Float64Array(this.G.length).fill(Infinity);
      for (let k = 0; k < G.length; k++) if (this.isG[k]) G[k] = 0;
      for (let it = 0; it < 5000; it++) { const NG = G.slice(); let ch = 0; for (let k = 0; k < G.length; k++) { if (!this.free[k] || this.isG[k]) continue; const v = this.bellman(G, k); NG[k] = v; if (v !== G[k]) ch = Math.max(ch, G[k] === Infinity ? 1 : Math.abs(v - G[k])); } G = NG; if (ch < 1e-9) break; }
      this.evals = ev;
      let mx = 0, hi = 0; for (let k = 0; k < G.length; k++) { if (!isFinite(G[k]) && !isFinite(this.G[k])) continue; const d = this.G[k] - G[k]; if (d > 1e-9) hi++; mx = Math.max(mx, Math.abs(d)); }
      this.cmp = { mx, hi };
    }
    // 执行：在任意 x（不一定是样本）上用插值选动作，Euler 前进 Δt
    exec() {
      const pts = [this.start]; let p = this.start, res = "未到达";
      for (let k = 0; k < 400; k++) {
        if (C.dist(p, this.goal) <= this.rg) { res = "到达"; break; }
        let best = Infinity, bu = null;
        for (const u of this.Us) { const v = this.interp(this.G, p.x + this.dt * u.x, p.y + this.dt * u.y); if (v < best) { best = v; bu = u; } }
        if (!bu) { res = k ? "卡住" : "起点处 G = ∞"; break; }
        p = { x: p.x + this.dt * bu.x, y: p.y + this.dt * bu.y }; pts.push(p);
        if (!this.region.inside(p)) { res = "撞上障碍"; break; }
      }
      this.path = pts; this.pathRes = res;
    }
    update() {
      let fin = 0, nf = 0; for (let k = 0; k < this.G.length; k++) if (this.free[k]) { nf++; if (this.G[k] < Infinity) fin++; }
      this.stats.it.set(this.mode === "vi" ? `${this.iters} 轮` : `${this.pops} 次出队`);
      this.stats.ev.set(this.evals.toLocaleString());
      this.stats.fin.set(`${fin} / ${nf}`);
      this.stats.ch.set(this.mode === "vi" ? (isFinite(this.change) ? this.change.toExponential(1) : "—") : (this.cmp ? `与值迭代不动点最多差 ${this.cmp.mx.toFixed(3)}（${this.cmp.hi} 个样本偏高）` : `${this.heap.size} 在队列`));
      let L = 0; if (this.path) for (let k = 1; k < this.path.length; k++) L += C.dist(this.path[k - 1], this.path[k]);
      this.stats.path.set(this.pathRes === "到达" ? `${L.toFixed(3)}（直线 ${Math.max(0, C.dist(this.start, this.goal) - this.rg).toFixed(3)}）` : `<span class="no">${this.pathRes}</span>`);
    }
    draw(ctx, st, col) {
      st.frame(col);
      const N = this.N, hh = this.h;
      let mx = 0; for (const v of this.G) if (isFinite(v)) mx = Math.max(mx, v);
      const M = 160, F = C.sampleField((p) => (this.region.inside(p) ? this.interp(this.G, p.x, p.y) : Infinity), M, M, [0, 1, 0, 1]);
      st.heat(F.vals, M, M, (v) => v / (mx || 1), col, { bands: 20, rect: [-.5 / M, 1 + .5 / M, -.5 / M, 1 + .5 / M] });
      if (this.showR) {
        // 不在 R(S) 里的单元（有角在障碍里）画斜线阴影
        ctx.save(); ctx.strokeStyle = C.alpha(col.bad, .35); ctx.lineWidth = 1;
        for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
          const ok = this.free[this.idx(i, j)] && this.free[this.idx(i + 1, j)] && this.free[this.idx(i, j + 1)] && this.free[this.idx(i + 1, j + 1)];
          if (ok) continue; const x0 = st.X(i * hh), y0 = st.Y((j + 1) * hh), s = hh * st.scale;
          ctx.beginPath(); for (let t = -s; t < s; t += 5) { ctx.moveTo(x0 + Math.max(0, t), y0 + Math.max(0, -t)); ctx.lineTo(x0 + Math.min(s, s + t), y0 + Math.min(s, s - t)); } ctx.stroke();
        }
        ctx.restore();
      }
      for (const P of VI_OBS) st.poly(P, C.alpha(col.wall, .88), col.wall, 1);
      st.circle(this.goal, this.rg, C.alpha(col.goal, .15), col.goal, 1.2);
      const rad = Math.max(1.4, Math.min(3.2, 60 / N));
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = this.idx(i, j), p = { x: i * hh, y: j * hh };
        if (!this.free[k]) { st.dot(p, rad * .7, C.alpha(col.bad, .6)); continue; }
        let c = C.alpha(col.muted, .55);
        if (this.isG[k]) c = col.goal;
        else if (this.mode === "dij") c = this.state[k] === 2 ? col.dead : this.state[k] === 1 ? col.alive : C.alpha(col.muted, .4);
        else if (isFinite(this.G[k])) c = col.dead;
        st.dot(p, rad, c);
      }
      if (this.hover) {
        const [i, j] = this.hover, x = { x: i * hh, y: j * hh };
        for (const u of this.Us) { const q = { x: x.x + this.dt * u.x, y: x.y + this.dt * u.y }; st.line(x, q, C.alpha(col.alive2, .5), 1); st.dot(q, 3, col.alive2); for (const c of this.corners(q.x, q.y)) { const ci = c % N, cj = (c - ci) / N; st.dot({ x: ci * hh, y: cj * hh }, rad + 2, null, col.alive2, 1.5); } }
        st.dot(x, rad + 2.5, col.start, col.surface, 1.5);
      }
      if (this.path) st.polyline(this.path, col.path, 2.6);
      st.qmark(this.start, "I", col); st.qmark(this.goal, "G", col, "");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-cover']").forEach((el) => el._w = new Cover(el));
    document.querySelectorAll("[data-widget='ch8-safeball']").forEach((el) => el._w = new SafeBall(el));
    document.querySelectorAll("[data-widget='ch8-interp']").forEach((el) => el._w = new Interp(el));
    document.querySelectorAll("[data-widget='ch8-vi']").forEach((el) => el._w = new ValueIter(el));
  });
})();
