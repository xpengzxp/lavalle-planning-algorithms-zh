/* 5.3 节：包围体与层次碰撞检测、特征 Voronoi 区域与增量距离计算、路径段检查、连杆位移的 Lipschitz 常数 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH5;

  // ---------------------------------------------------------------
  // 凸多边形工具
  // ---------------------------------------------------------------
  function satOverlap(A, B) {   // 两个凸多边形是否相交（分离轴定理）
    for (const P of [A, B]) {
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const nx = P[i].y - P[j].y, ny = P[j].x - P[i].x;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of A) { const v = p.x * nx + p.y * ny; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
        for (const p of B) { const v = p.x * nx + p.y * ny; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
        if (a1 < b0 || b1 < a0) return false;
      }
    }
    return true;
  }
  function minCircle(pts) {   // 最小包围圆（Welzl 的迭代版本）
    const P = pts.slice(); const r = C.rng(42);
    for (let i = P.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
    const circ2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: C.dist(a, b) / 2 });
    const circ3 = (a, b, c) => {
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-12) { const cs = [circ2(a, b), circ2(a, c), circ2(b, c)]; return cs.reduce((m, x) => (x.r > m.r ? x : m)); }
      const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
      const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
      return { x: ux, y: uy, r: Math.hypot(a.x - ux, a.y - uy) };
    };
    const inC = (c, p) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 1e-9;
    let c = { x: P[0].x, y: P[0].y, r: 0 };
    for (let i = 1; i < P.length; i++) if (!inC(c, P[i])) {
      c = { x: P[i].x, y: P[i].y, r: 0 };
      for (let j = 0; j < i; j++) if (!inC(c, P[j])) {
        c = circ2(P[i], P[j]);
        for (let k = 0; k < j; k++) if (!inC(c, P[k])) c = circ3(P[i], P[j], P[k]);
      }
    }
    return c;
  }
  function minAreaRect(pts) {   // 最小面积外接矩形（枚举凸包的边方向）
    const H = C.convexHull(pts); let best = null;
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length], L = C.dist(a, b) || 1;
      const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
      for (const p of H) { const s = p.x * ux + p.y * uy, t = -p.x * uy + p.y * ux; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
      const area = (s1 - s0) * (t1 - t0);
      if (!best || area < best.area) {
        const P = (s, t) => ({ x: s * ux - t * uy, y: s * uy + t * ux });
        best = { area, poly: [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)] };
      }
    }
    return best.poly;
  }
  function makeBV(type, pts) {
    if (type === "circle") { const c = minCircle(pts); return { type, c, area: Math.PI * c.r * c.r }; }
    let poly;
    if (type === "aabb") { const b = C.polyBox(pts); poly = C.rect(b.x0, b.y0, b.x1, b.y1); }
    else if (type === "obb") poly = minAreaRect(pts);
    else poly = C.convexHull(pts);
    return { type, poly, area: C.polyArea(poly) };
  }
  function bvOverlap(a, b) {
    if (a.type === "circle") return Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) <= a.c.r + b.c.r;
    return satOverlap(a.poly, b.poly);
  }
  function triangulate(P) {   // 耳切法（逆时针简单多边形）
    const idx = P.map((_, i) => i), tris = [];
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    let guard = 0;
    while (idx.length > 3 && guard++ < 1000) {
      for (let k = 0; k < idx.length; k++) {
        const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        const a = P[i0], b = P[i1], c = P[i2];
        if (cross(a, b, c) <= 1e-12) continue;
        const tri = [a, b, c];
        if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && C.inPoly(P[j], tri))) continue;
        tris.push(tri); idx.splice(k, 1); break;
      }
    }
    tris.push(idx.map((i) => P[i]));
    return tris;
  }

  // 两个示例物体（局部坐标，逆时针）
  const BODY_E = [{ x: 0, y: 0 }, { x: 3.2, y: 0 }, { x: 3.2, y: 0.8 }, { x: 2.8, y: 0.8 }, { x: 2.8, y: 1.6 }, { x: 2.4, y: 1.6 }, { x: 2.4, y: 0.8 },
    { x: 2.0, y: 0.8 }, { x: 2.0, y: 1.6 }, { x: 1.6, y: 1.6 }, { x: 1.6, y: 0.8 }, { x: 0.9, y: 0.8 }, { x: 0.9, y: 4.2 }, { x: 0, y: 4.2 }];
  const BODY_F = (() => { const P = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * 2 * Math.PI, r = i % 2 ? 0.55 : 1.35; P.push({ x: r * Math.cos(a), y: r * Math.sin(a) }); } return P; })();

  function buildTree(tris, type) {
    const all = (ts) => ts.flat();
    const node = (ts) => {
      const n = { tris: ts, bv: makeBV(type, all(ts)) };
      if (ts.length > 1) {
        const cs = ts.map((t) => ({ t, x: (t[0].x + t[1].x + t[2].x) / 3, y: (t[0].y + t[1].y + t[2].y) / 3 }));
        const b = C.polyBox(cs);
        const key = b.x1 - b.x0 >= b.y1 - b.y0 ? "x" : "y";
        cs.sort((p, q) => p[key] - q[key]);
        const mid = Math.floor(cs.length / 2);
        n.kids = [node(cs.slice(0, mid).map((c) => c.t)), node(cs.slice(mid).map((c) => c.t))];
      }
      return n;
    };
    return node(tris);
  }

  // ---------------------------------------------------------------
  // 组件：包围体与层次碰撞检测（图 5.9、5.10）
  // ---------------------------------------------------------------
  class BVH {
    constructor(root) {
      this.type = "circle"; this.depth = 1; this.pose = { x: 6.0, y: 2.4, t: 0.3 };
      const body = C.frame(root, "包围体层次", "拖动右边的星形；看两棵包围体树怎样剪枝");
      this.st = new C.Stage({ view: [0, 9.5, -0.3, 5], aspect: 0.56, maxW: 820, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.inPoly(p, this.worldF()) || C.dist(p, this.pose) < 1.4 ? { dx: p.x - this.pose.x, dy: p.y - this.pose.y } : null),
        onMove: (p, d) => { this.pose.x = Math.max(0.5, Math.min(9, p.x - d.dx)); this.pose.y = Math.max(0.3, Math.min(4.6, p.y - d.dy)); this.query(); },
        cursor: (p) => (C.inPoly(p, this.worldF()) ? "grab" : null) });
      this.segType = C.seg([["circle", "(a) 圆/球"], ["aabb", "(b) AABB"], ["obb", "(c) OBB"], ["hull", "(d) 凸包"]], this.type, (k) => { this.type = k; this.rebuild(); });
      this.sDepth = C.slider("显示第几层", 0, 5, 1, this.depth, (v) => { this.depth = v; this.st.draw(); });
      this.sRot = C.slider("星形转角", 0, 6.28, 0.01, this.pose.t, (v) => { this.pose.t = v; this.query(); }, (v) => ((v * 180) / Math.PI).toFixed(0) + "°");
      this.stats = { tight: C.stat("根包围体紧致度"), bv: C.stat("包围体相交测试"), tri: C.stat("三角形对测试"), naive: C.stat("朴素：所有三角形对"), res: C.stat("结果") };
      const col = C.colors(root);
      body.append(h("div", { class: "controls" }, this.segType, this.sDepth, this.sRot), this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
        C.legend([[C.cva("ok", 0.5), "物体 E 的三角形"], [C.cva("bad", 0.4), "物体 F（机器人）"], [C.cv("accent"), "E 树中第 d 层的包围体"], [C.cv("warn"), "被访问过且相交的叶子"], [C.cv("current"), "真正相交的三角形"]]));
      this.trisE = triangulate(BODY_E).map((t) => t.map((p) => ({ x: p.x + 0.4, y: p.y + 0.2 })));
      this.rebuild();
    }
    worldF() { const c = Math.cos(this.pose.t), s = Math.sin(this.pose.t); return BODY_F.map((p) => ({ x: this.pose.x + c * p.x - s * p.y, y: this.pose.y + s * p.x + c * p.y })); }
    rebuild() {
      this.treeE = buildTree(this.trisE, this.type);
      const area = this.trisE.reduce((s, t) => s + C.polyArea(t), 0);
      this.stats.tight.set(`${((area / this.treeE.bv.area) * 100).toFixed(0)}%`);
      this.query();
    }
    query() {
      const c = Math.cos(this.pose.t), s = Math.sin(this.pose.t);
      const trisF = triangulate(BODY_F).map((t) => t.map((p) => ({ x: this.pose.x + c * p.x - s * p.y, y: this.pose.y + s * p.x + c * p.y })));
      this.treeF = buildTree(trisF, this.type);
      let bvTests = 0, triTests = 0; const hitLeaves = new Set(), hitTris = [];
      const rec = (a, b) => {
        bvTests++;
        if (!bvOverlap(a.bv, b.bv)) return;
        if (!a.kids && !b.kids) {
          triTests++; hitLeaves.add(a); hitLeaves.add(b);
          if (satOverlap(a.tris[0], b.tris[0])) hitTris.push(a.tris[0], b.tris[0]);
          return;
        }
        // 书中的做法：先把 E 这边换成孩子；E 到了叶子再展开 F
        if (a.kids) { rec(a.kids[0], b); rec(a.kids[1], b); } else { rec(a, b.kids[0]); rec(a, b.kids[1]); }
      };
      rec(this.treeE, this.treeF);
      this.hitLeaves = hitLeaves; this.hitTris = hitTris;
      this.stats.bv.set(bvTests); this.stats.tri.set(triTests);
      this.stats.naive.set(`${this.trisE.length} × ${trisF.length} = ${this.trisE.length * trisF.length}`);
      this.stats.res.set(hitTris.length ? '<span class="no">碰撞</span>' : '<span class="yes">不碰撞</span>');
      this.st.draw();
    }
    drawBV(st, bv, color, lw, fill) {
      if (bv.type === "circle") {
        const ctx = st.ctx; ctx.beginPath(); ctx.arc(st.X(bv.c.x), st.Y(bv.c.y), bv.c.r * st.scale, 0, 2 * Math.PI);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
      } else st.poly(bv.poly, fill, color, lw);
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const t of this.trisE) st.poly(t, C.alpha(col.ok, 0.32), C.alpha(col.ok, 0.75), 0.8);
      for (const t of this.treeF ? this.treeF.tris : []) st.poly(t, C.alpha(col.bad, 0.25), C.alpha(col.bad, 0.65), 0.8);
      // 第 d 层（E 和 F 两棵树）
      const level = (n, d, out) => { if (d === 0 || !n.kids) out.push(n); else { level(n.kids[0], d - 1, out); level(n.kids[1], d - 1, out); } return out; };
      for (const n of level(this.treeE, this.depth, [])) this.drawBV(st, n.bv, col.accent, 1.6);
      if (this.treeF) for (const n of level(this.treeF, this.depth, [])) this.drawBV(st, n.bv, C.alpha(col.accent, 0.6), 1.2);
      for (const n of this.hitLeaves || []) this.drawBV(st, n.bv, col.warn, 1.4);
      for (const t of this.hitTris || []) st.poly(t, C.alpha(col.current, 0.6), col.current, 1.5);
      st.text("E", { x: 0.85, y: 4.65 }, col.ok, { weight: 700, size: 14 });
      st.text("F", { x: this.pose.x, y: this.pose.y }, col.bad, { weight: 700, size: 14 });
      st.text(this.depth === 0 ? "第 0 层 = 根" : `第 ${this.depth} 层`, { x: 9.3, y: 4.75 }, col.accent, { align: "right", size: 12, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：凸多边形的特征 Voronoi 区域（图 5.11）与增量距离计算（式 5.29）
  // ---------------------------------------------------------------
  const PENT = (() => { const P = []; for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i / 5) * 2 * Math.PI; P.push({ x: 1.1 * Math.cos(a), y: 1.1 * Math.sin(a) }); } return P; })();
  const QUAD = [{ x: -0.55, y: -0.35 }, { x: 0.6, y: -0.3 }, { x: 0.45, y: 0.4 }, { x: -0.4, y: 0.3 }];
  function features(P) {   // 顶点特征 V0..、边特征 E0..（Ei 连接 Pi 与 Pi+1）
    const out = [];
    P.forEach((p, i) => out.push({ kind: "V", i, P }));
    P.forEach((p, i) => out.push({ kind: "E", i, P }));
    return out;
  }
  function inVor(p, f) {
    const P = f.P, n = P.length;
    if (f.kind === "V") {
      const v = P[f.i], prev = P[(f.i + n - 1) % n], next = P[(f.i + 1) % n];
      return (p.x - v.x) * (v.x - prev.x) + (p.y - v.y) * (v.y - prev.y) >= -1e-9 && (p.x - v.x) * (next.x - v.x) + (p.y - v.y) * (next.y - v.y) <= 1e-9;
    }
    const a = P[f.i], b = P[(f.i + 1) % n], ex = b.x - a.x, ey = b.y - a.y, s = (p.x - a.x) * ex + (p.y - a.y) * ey;
    const nx = ey, ny = -ex; // 逆时针多边形的外法向
    return s >= -1e-9 && s <= ex * ex + ey * ey + 1e-9 && (p.x - a.x) * nx + (p.y - a.y) * ny >= -1e-9;
  }
  function closestOnFeature(p, f) {
    const P = f.P;
    if (f.kind === "V") return P[f.i];
    const a = P[f.i], b = P[(f.i + 1) % P.length], r = C.segPointDist(p, a, b);
    return { x: a.x + r.t * (b.x - a.x), y: a.y + r.t * (b.y - a.y) };
  }
  function featurePairPoints(f1, f2) {   // 两个特征之间的最近点对
    const segs = (f) => (f.kind === "V" ? [[f.P[f.i], f.P[f.i]]] : [[f.P[f.i], f.P[(f.i + 1) % f.P.length]]]);
    const [[a1, b1]] = segs(f1), [[a2, b2]] = segs(f2);
    let best = null;
    const tryPt = (p, a, b, pOn1) => { const r = C.segPointDist(p, a, b); const q = { x: a.x + r.t * (b.x - a.x), y: a.y + r.t * (b.y - a.y) }; if (!best || r.d < best.d) best = pOn1 ? { d: r.d, x1: p, x2: q } : { d: r.d, x1: q, x2: p }; };
    tryPt(a1, a2, b2, true); tryPt(b1, a2, b2, true); tryPt(a2, a1, b1, false); tryPt(b2, a1, b1, false);
    return best;
  }
  class FeatureVoronoi {
    constructor(root) {
      this.pose = { x: 2.6, y: 1.2, t: 0.2 }; this.mode = "pair"; this.q = { x: 2.0, y: 1.4 };
      this.frames = 0; this.kept = 0; this.prev = null;
      const body = C.frame(root, "特征的 Voronoi 区域", "图 5.11 的五边形：5 个顶点区域 V + 5 个边区域 E");
      this.st = new C.Stage({ view: [-3, 4.2, -2.4, 2.6], aspect: 0.7, maxW: 640, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => {
          if (this.mode === "point") return C.dist(p, this.q) < 0.3 ? "q" : null;
          return C.inPoly(p, this.worldQ()) ? { dx: p.x - this.pose.x, dy: p.y - this.pose.y } : null;
        },
        onMove: (p, d) => {
          if (d === "q") { this.q = p; } else { this.pose.x = p.x - d.dx; this.pose.y = p.y - d.dy; }
          this.update();
        },
        cursor: (p) => (this.mode === "point" ? (C.dist(p, this.q) < 0.3 ? "grab" : null) : C.inPoly(p, this.worldQ()) ? "grab" : null) });
      this.segMode = C.seg([["point", "拖一个点"], ["pair", "拖另一个凸多边形"]], this.mode, (k) => { this.mode = k; this.prev = null; this.frames = this.kept = 0; this.update(); });
      this.sRot = C.slider("四边形转角", -3.14, 3.14, 0.01, this.pose.t, (v) => { this.pose.t = v; this.update(); }, (v) => ((v * 180) / Math.PI).toFixed(0) + "°");
      this.info = h("div", { class: "msg info" });
      this.stats = [C.stat("距离"), C.stat("最近特征对"), C.stat("上一对仍满足 (5.29)"), C.stat("需要换特征的比例")];
      body.append(h("div", { class: "controls" }, this.segMode, this.sRot), this.st.wrap, h("div", { class: "stats" }, this.stats), this.info);
      this.update();
    }
    worldQ() { const c = Math.cos(this.pose.t), s = Math.sin(this.pose.t); return QUAD.map((p) => ({ x: this.pose.x + c * p.x - s * p.y, y: this.pose.y + s * p.x + c * p.y })); }
    label(f, which) { return `${f.kind}${which}${f.i}`.replace(/(\d)$/, (m) => "₀₁₂₃₄₅₆"[+m]); }
    update() {
      const F1 = features(PENT);
      if (this.mode === "point") {
        let best = null;
        const inside = C.inPoly(this.q, PENT);
        if (!inside) for (const f of F1) if (inVor(this.q, f)) { const c = closestOnFeature(this.q, f); const d = C.dist(this.q, c); if (!best || d < best.d) best = { f, d, c }; }
        this.cur = best;
        this.stats[0].set(inside ? "0（在内部）" : best.d.toFixed(3));
        this.stats[1].set(inside ? "—" : (best.f.kind === "V" ? "顶点 " : "边 ") + best.f.i);
        this.stats[2].set("—"); this.stats[3].set("—");
        this.info.innerHTML = inside ? "点在多边形内部：Voronoi 区域只对外部的点定义。" :
          `点落在 <b>${best.f.kind === "V" ? "顶点" : "边"}区域</b>，所以它到五边形的最近点就在那个${best.f.kind === "V" ? "顶点" : "边（垂足）"}上。沿着边界走一圈，区域类型在 V 和 E 之间交替。`;
        this.st.draw(); return;
      }
      const Q = this.worldQ(), F2 = features(Q);
      const overlap = satOverlap(PENT, Q);
      // 暴力求真正的最近特征对（只为了画图和对照；增量算法本身不需要这一步）
      // 先枚举顶点-顶点，再枚举顶点-边：只有严格更近才替换，所以垂足落在端点时仍记作顶点-顶点
      let best = null;
      for (const f1 of F1) for (const f2 of F2) {
        if (f1.kind === "E" && f2.kind === "E") continue;
        const r = featurePairPoints(f1, f2);
        if (!best || r.d < best.d - 1e-9) best = { ...r, f1, f2 };
      }
      // 平行的两条边距离相同时，书中把它归为边-边
      let parallelEE = null;
      for (const f1 of F1) for (const f2 of F2) if (!parallelEE && f1.kind === "E" && f2.kind === "E") {
        const r = featurePairPoints(f1, f2);
        const a = f1.P[f1.i], b = f1.P[(f1.i + 1) % 5], c = f2.P[f2.i], d = f2.P[(f2.i + 1) % 4];
        const cr = Math.abs((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)) / (C.dist(a, b) * C.dist(c, d));
        if (cr < 0.02 && Math.abs(r.d - best.d) < 0.01 && (best.f1.kind === "E" || best.f2.kind === "E")) parallelEE = { f1, f2 };
      }
      const kind = parallelEE ? "边-边（两边平行）" : best.f1.kind === "E" ? "边-顶点" : best.f2.kind === "E" ? "顶点-边" : "顶点-顶点";
      this.cur = { best, Q, overlap, parallelEE };
      // 增量：上一帧的特征对在新位置下是否仍满足 (5.29)
      let keep = null;
      if (this.prev && !overlap) {
        const f1 = F1.find((f) => f.kind === this.prev.k1 && f.i === this.prev.i1), f2 = F2.find((f) => f.kind === this.prev.k2 && f.i === this.prev.i2);
        const r = featurePairPoints(f1, f2);
        keep = inVor(r.x1, f2) && inVor(r.x2, f1);
        this.frames++; if (keep) this.kept++;
      }
      this.prev = overlap ? null : { k1: best.f1.kind, i1: best.f1.i, k2: best.f2.kind, i2: best.f2.i };
      this.stats[0].set(overlap ? '<span class="no">相交</span>' : best.d.toFixed(3));
      this.stats[1].set(overlap ? "—" : `${best.f1.kind}${best.f1.i} · ${best.f2.kind}${best.f2.i}`);
      this.stats[2].set(keep === null ? "—" : keep ? '<span class="yes">是 → O(1)</span>' : '<span class="no">否 → 走到邻居</span>');
      this.stats[3].set(this.frames ? `${(((this.frames - this.kept) / this.frames) * 100).toFixed(0)}%（${this.frames - this.kept}/${this.frames}）` : "—");
      this.info.innerHTML = overlap ? "两个多边形相交了：距离为 0。" :
        `最近点对属于 <b>${kind}</b> 组合。条件 (5.29)：五边形上的最近点落在四边形那个特征的 Voronoi 区域里，反之亦然——满足它就能断定这一对就是全局最近，<b>不用看其它特征</b>。慢慢拖动，大多数帧上一对特征仍然成立，这就是「几乎常数时间」。`;
      this.st.draw();
    }
    drawRegions(st, P, col, labels, highlight) {
      const n = P.length, L = 12;
      P.forEach((v, i) => {
        const prev = P[(i + n - 1) % n], next = P[(i + 1) % n];
        const n1 = { x: v.y - prev.y, y: prev.x - v.x }, n2 = { x: next.y - v.y, y: v.x - next.x };
        const l1 = Math.hypot(n1.x, n1.y), l2 = Math.hypot(n2.x, n2.y);
        const a = { x: v.x + (n1.x / l1) * L, y: v.y + (n1.y / l1) * L }, b = { x: v.x + (n2.x / l2) * L, y: v.y + (n2.y / l2) * L };
        const isH = highlight && highlight.kind === "V" && highlight.i === i && highlight.P === P;
        st.poly([v, a, b], isH ? C.alpha(col.warn, 0.3) : C.alpha(col.accent, 0.07), C.alpha(col.accent, 0.35), 1);
        if (labels) { const m = { x: v.x + ((n1.x / l1 + n2.x / l2) / 2) * 0.55, y: v.y + ((n1.y / l1 + n2.y / l2) / 2) * 0.55 }; st.text("V", m, col.accent, { size: 12, weight: 700 }); }
        const e0 = v, e1 = next, ne = { x: (e1.y - e0.y) / C.dist(e0, e1), y: (e0.x - e1.x) / C.dist(e0, e1) };
        const isE = highlight && highlight.kind === "E" && highlight.i === i && highlight.P === P;
        st.poly([e0, e1, { x: e1.x + ne.x * L, y: e1.y + ne.y * L }, { x: e0.x + ne.x * L, y: e0.y + ne.y * L }], isE ? C.alpha(col.warn, 0.3) : C.alpha(col.ok, 0.07), C.alpha(col.ok, 0.35), 1);
        if (labels) st.text("E", { x: (e0.x + e1.x) / 2 + ne.x * 0.55, y: (e0.y + e1.y) / 2 + ne.y * 0.55 }, col.ok, { size: 12, weight: 700 });
      });
    }
    draw(ctx, st, col) {
      st.frame(col);
      const cur = this.cur;
      const hl = this.mode === "point" ? cur && cur.f : cur && !cur.overlap ? cur.best.f1 : null;
      this.drawRegions(st, PENT, col, true, hl);
      st.poly(PENT, C.alpha(col.ok, 0.45), col.ok, 2);
      if (this.mode === "point") {
        if (cur) { st.line(this.q, cur.c, col.current, 2); st.dot(cur.c, 4, col.current); }
        st.dot(this.q, 7, col.current, col.surface, 2); st.text("拖我", this.q, col.current, { dy: -15, size: 11 });
        return;
      }
      const Q = cur.Q;
      st.poly(Q, C.alpha(col.bad, 0.35), col.bad, 2);
      if (!cur.overlap) {
        const b = cur.best;
        st.line(b.x1, b.x2, col.current, 2.5); st.dot(b.x1, 4.5, col.current); st.dot(b.x2, 4.5, col.current);
        // 四边形上那个特征的 Voronoi 区域（虚线）
        const f2 = b.f2;
        if (f2.kind === "V") {
          const n = 4, v = Q[f2.i], prev = Q[(f2.i + n - 1) % n], next = Q[(f2.i + 1) % n];
          const d1 = { x: v.y - prev.y, y: prev.x - v.x }, d2 = { x: next.y - v.y, y: v.x - next.x };
          const l1 = Math.hypot(d1.x, d1.y), l2 = Math.hypot(d2.x, d2.y);
          st.line(v, { x: v.x + (d1.x / l1) * 8, y: v.y + (d1.y / l1) * 8 }, col.bad, 1.2, [5, 4]);
          st.line(v, { x: v.x + (d2.x / l2) * 8, y: v.y + (d2.y / l2) * 8 }, col.bad, 1.2, [5, 4]);
        } else {
          const a = Q[f2.i], c = Q[(f2.i + 1) % 4], L = C.dist(a, c), ne = { x: (c.y - a.y) / L, y: (a.x - c.x) / L };
          st.line(a, { x: a.x + ne.x * 8, y: a.y + ne.y * 8 }, col.bad, 1.2, [5, 4]);
          st.line(c, { x: c.x + ne.x * 8, y: c.y + ne.y * 8 }, col.bad, 1.2, [5, 4]);
        }
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件：检查一条路径段（5.3.4 节）
  // ---------------------------------------------------------------
  class SegmentCheck {
    constructor(root) {
      this.q0 = { x: 0.12, y: 0.35 }; this.q1 = { x: 1.48, y: 0.75 }; this.dq = 0.1; this.order = "vdc";
      // 一道偏离中点的薄墙（演示「跳过」）+ 右下一块厚障碍（演示二分顺序更早发现碰撞）
      this.obs = new C.Obstacles([C.rect(0.88, 0.22, 0.9, 0.9), C.rect(1.05, 0, 1.38, 0.3), C.rect(0.3, 0.62, 0.5, 0.76)], { x0: 0, y0: 0, x1: 1.6, y1: 1 });
      const body = C.frame(root, "检查一条路径段", "拖动两端；调 Δq 看薄障碍能不能被「跳过去」");
      this.st = new C.Stage({ view: [0, 1.6, 0, 1], aspect: 0.62, maxW: 680, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.q0) < 0.05 ? "q0" : C.dist(p, this.q1) < 0.05 ? "q1" : null),
        onMove: (p, d) => { this[d] = { x: Math.max(0.01, Math.min(1.59, p.x)), y: Math.max(0.01, Math.min(0.99, p.y)) }; this.reset(); },
        cursor: (p) => (C.dist(p, this.q0) < 0.05 || C.dist(p, this.q1) < 0.05 ? "grab" : null) });
      this.segO = C.seg([["linear", "从 0 走到 1"], ["vdc", "van der Corput 二分顺序"], ["clear", "用距离认证（补充）"]], this.order, (k) => { this.order = k; this.reset(); });
      this.sDq = C.slider("Δq =", 0.01, 0.25, 0.005, this.dq, (v) => { this.dq = v; this.reset(); }, (v) => v.toFixed(3));
      this.runner = new C.Runner(() => { let t = this.tick = (this.tick || 0) + 1; if (t % 6) return true; return this.step(); });
      this.stats = [C.stat("已检查的点"), C.stat("计划检查的点"), C.stat("结论"), C.stat("真相（精确求交）")];
      this.seqLine = h("div", { class: "mono small", style: "min-height:2.4em;word-break:break-all" });
      body.append(h("div", { class: "controls" }, this.segO, this.sDq),
        h("div", { class: "controls" }, C.button("▶ 播放", () => { if (this.done) this.reset(); this.runner.start(); }, "small primary"), C.button("单步", () => this.step(), "small"), C.button("一次跑完", () => { while (this.step() !== false); }, "small"), C.button("重置", () => this.reset(), "small")),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.seqLine);
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      const L = C.dist(this.q0, this.q1);
      this.checked = []; this.done = false; this.verdict = null; this.circles = [];
      if (this.order === "clear") { this.plan = null; this.s = 0; }
      else {
        const m = Math.max(0, Math.ceil(Math.log2(L / this.dq)));
        const n = 2 ** m;
        const ts = [];
        if (this.order === "linear") for (let j = 0; j <= n; j++) ts.push(j / n);
        else { ts.push(1); for (let i = 0; i < n; i++) ts.push(C.radInv(i, 2)); }
        this.plan = ts; this.n = n;
      }
      const tHit = this.obs.firstHit(this.q0, this.q1);
      this.truth = tHit < 1 || !this.obs.pointFreeQuiet(this.q1) ? "碰撞" : "无碰撞";
      this.update();
    }
    step() {
      if (this.done) return false;
      const P = (t) => C.lerp(this.q0, this.q1, t), L = C.dist(this.q0, this.q1);
      if (this.order === "clear") {
        const q = P(Math.min(1, this.s / L)), d = this.obs.clearance(q, false);
        this.checked.push({ t: this.s / L, free: d > 1e-3 }); this.circles.push({ q, d });
        if (d <= 1e-3) { this.done = true; this.verdict = "碰撞（距离≈0）"; }
        else if (this.s >= L) { this.done = true; this.verdict = "无碰撞（已证明）"; }
        else { this.s = Math.min(L, this.s + d); }
        if (this.checked.length > 400) { this.done = true; this.verdict = "步子越来越小……（贴着障碍走）"; }
      } else {
        const t = this.plan[this.checked.length], free = this.obs.pointFreeQuiet(P(t));
        this.checked.push({ t, free });
        if (!free) { this.done = true; this.verdict = "碰撞"; }
        else if (this.checked.length >= this.plan.length) { this.done = true; this.verdict = "无碰撞（按 Δq 分辨率）"; }
      }
      this.update();
      return !this.done;
    }
    update() {
      this.stats[0].set(this.checked.length);
      this.stats[1].set(this.order === "clear" ? "自适应" : this.plan.length);
      const miss = this.done && this.verdict.startsWith("无碰撞") && this.truth === "碰撞";
      this.stats[2].set(!this.verdict ? "…" : miss ? '<span class="no">漏检！</span>' : this.verdict.startsWith("碰撞") ? '<span class="no">' + this.verdict + "</span>" : '<span class="yes">' + this.verdict + "</span>");
      this.stats[3].set(this.truth === "碰撞" ? '<span class="no">碰撞</span>' : '<span class="yes">无碰撞</span>');
      const shown = this.checked.slice(0, 18).map((c) => (Number.isInteger(c.t * 64) && this.order !== "clear" ? fracStr(c.t) : c.t.toFixed(3)) + (c.free ? "" : "✗"));
      this.seqLine.textContent = "检查顺序 τ(t)：t = " + shown.join(", ") + (this.checked.length > 18 ? ", …" : "");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.obstacles(this.obs, col);
      st.line(this.q0, this.q1, C.alpha(col.text, 0.5), 1.5, [5, 4]);
      for (const c of this.circles) { ctx.beginPath(); ctx.arc(st.X(c.q.x), st.Y(c.q.y), c.d * st.scale, 0, 2 * Math.PI); ctx.fillStyle = C.alpha(col.ok, 0.1); ctx.fill(); ctx.strokeStyle = C.alpha(col.ok, 0.6); ctx.lineWidth = 1; ctx.stroke(); }
      if (this.plan) for (const t of this.plan) st.dot(C.lerp(this.q0, this.q1, t), 2, C.alpha(col.muted, 0.6));
      this.checked.forEach((c, i) => {
        const p = C.lerp(this.q0, this.q1, c.t), last = i === this.checked.length - 1;
        st.dot(p, last ? 6 : 4.5, c.free ? col.ok : col.bad, last ? col.text : null, 1.5);
        if (i < 9 && this.order !== "clear") st.text(String(i + 1), p, col.text2, { dy: -11, size: 10.5 });
      });
      st.qmark(this.q0, "I", col, "τ(0)"); st.qmark(this.q1, "G", col, "τ(1)");
      st.text("薄墙", { x: 0.89, y: 0.93 }, col.muted, { size: 11 }); st.text("厚障碍", { x: 1.215, y: 0.33 }, col.muted, { size: 11 });
    }
  }
  function fracStr(t) {
    if (t === 0 || t === 1) return String(t);
    let d = 1; while (Math.abs(t * d - Math.round(t * d)) > 1e-9) d *= 2;
    return `${Math.round(t * d)}/${d}`;
  }

  // ---------------------------------------------------------------
  // 组件：连杆的逐参数 Lipschitz 常数（式 5.33、5.34，50 连杆例子）
  // ---------------------------------------------------------------
  class ChainLipschitz {
    constructor(root) {
      this.n = 12; this.joint = 1; this.delta = 0.25; this.preset = "straight"; this.L = 10;
      const body = C.frame(root, "每个关节该用多大的步长？", "改变 θᵢ 时，链上的点最多移动 cᵢ|Δθᵢ|");
      this.st = new C.Stage({ view: [-1, 1, -1, 1], aspect: 0.62, maxW: 640, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.bars = new C.Stage({ view: [0, 1, 0, 0.28], aspect: 0.28, maxW: 640, pad: 4, onDraw: (ctx, st, col) => this.drawBars(ctx, st, col) });
      this.segP = C.seg([["straight", "伸直 θᵢ = 0"], ["folded", "折叠 θᵢ = π"], ["curl", "卷曲"], ["random", "随机"]], this.preset, (k) => { this.preset = k; this.setPreset(); });
      this.sN = C.slider("连杆数 n", 2, 50, 1, this.n, (v) => { this.n = v; this.joint = Math.min(this.joint, v); this.sJ.input.max = v; this.sJ.input.value = this.joint; this.sJ.refresh(); this.setPreset(); });
      this.sJ = C.slider("扰动关节 i", 1, this.n, 1, this.joint, (v) => { this.joint = v; this.update(); });
      this.sD = C.slider("Δθᵢ", 0, 1, 0.01, this.delta, (v) => { this.delta = v; this.update(); }, (v) => ((v * 180) / Math.PI).toFixed(0) + "°");
      this.stats = [C.stat("cᵢ（此位形）"), C.stat("实际最大位移"), C.stat("上界 cᵢ|Δθᵢ|"), C.stat("全局常数 (n−i+1)·L")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segP, this.sN), h("div", { class: "controls" }, this.sJ, this.sD), this.st.wrap, this.bars.wrap, h("div", { class: "stats" }, this.stats), this.note);
      this.setPreset();
    }
    setPreset() {
      const r = C.rng(5 + this.n);
      this.th = Array.from({ length: this.n }, (_, i) => this.preset === "straight" ? 0 : this.preset === "folded" ? (i ? Math.PI : 0) : this.preset === "curl" ? (i ? (1.6 * Math.PI) / this.n : 0) : (r() - 0.5) * 2.2);
      this.update();
    }
    fk(th) { const P = [{ x: 0, y: 0 }]; let a = 0, x = 0, y = 0; th.forEach((t) => { a += t; x += this.L * Math.cos(a); y += this.L * Math.sin(a); P.push({ x, y }); }); return P; }
    ci(P, i) { const j = P[i - 1]; return Math.max(...P.slice(i - 1).map((p) => C.dist(p, j))); }
    update() {
      const P = this.fk(this.th), th2 = this.th.slice(); th2[this.joint - 1] += this.delta;
      const P2 = this.fk(th2);
      this.P = P; this.P2 = P2;
      this.cs = Array.from({ length: this.n }, (_, k) => this.ci(P, k + 1));
      const c = this.cs[this.joint - 1];
      const actual = Math.max(...P.map((p, k) => C.dist(p, P2[k])));
      this.stats[0].set(c.toFixed(1)); this.stats[1].set(actual.toFixed(2)); this.stats[2].set((c * this.delta).toFixed(2));
      this.stats[3].set(((this.n - this.joint + 1) * this.L).toFixed(0));
      const all = P.concat(P2);
      const b = C.polyBox(all), pad = this.L * 1.2, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      let w = Math.max(b.x1 - b.x0 + 2 * pad, ((b.y1 - b.y0 + 2 * pad) / 0.62)), hh = w * 0.62;
      this.st.setView([cx - w / 2, cx + w / 2, cy - hh / 2, cy + hh / 2]);
      this.note.innerHTML = this.preset === "straight" ? `伸直时 c₁ = ${(this.n * this.L).toFixed(0)} 而 c_n = ${this.L}：动 θ₁ 整条链都甩出去，动 θ_n 只有最后一节动。所以书中建议给 θ₁ 用更小的步长 Δθ₁。` :
        this.preset === "folded" ? "全部折叠时，转 θ₁ 链子几乎原地打转：最远点离关节 1 只有一节长。同样的 Δθ₁ 在这里安全得多——局部的 Lipschitz 常数比全局的小很多（可以用 Jacobian 做局部分析）。" :
        "柱状图是此位形下每个关节的 cᵢ。cᵢ 越大，该关节的步长 Δqᵢ 就该越小，才能保证链上任何点的位移不超过到障碍的距离 d。";
      this.st.draw(); this.bars.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const j = this.P[this.joint - 1], c = this.cs[this.joint - 1];
      ctx.beginPath(); ctx.arc(st.X(j.x), st.Y(j.y), c * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = C.alpha(col.accent, 0.5); ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      const chain = (P, color, lw) => { for (let k = 0; k + 1 < P.length; k++) st.line(P[k], P[k + 1], color, lw); P.forEach((p) => st.dot(p, lw > 2 ? 2.5 : 1.8, color)); };
      chain(this.P2, C.alpha(col.bad, 0.65), 2);
      chain(this.P, col.text2, 3);
      st.dot(j, 5.5, col.accent, col.surface, 1.5);
      st.dot(this.P[0], 5, col.wall);
      st.text(`关节 ${this.joint}`, j, col.accent, { dy: -13, size: 11.5, weight: 650 });
      st.text(`半径 c${this.joint}`, { x: j.x + c * 0.7071, y: j.y + c * 0.7071 }, col.accent, { size: 11 });
    }
    drawBars(ctx, st, col) {
      st.frame(col);
      const maxC = Math.max(...this.cs, 1), n = this.n;
      this.cs.forEach((c, k) => {
        const x0 = k / n + 0.15 / n, x1 = (k + 1) / n - 0.15 / n;
        st.poly(C.rect(x0, 0.006, x1, 0.006 + (c / maxC) * 0.23), k === this.joint - 1 ? col.accent : C.alpha(col.accent, 0.35), null);
      });
      st.text("cᵢ（i = 1 … n，此位形）", { x: 0.01, y: 0.262 }, col.muted, { align: "left", size: 11 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='bvh']").forEach((el) => el._w = new BVH(el));
    document.querySelectorAll("[data-widget='feature-voronoi']").forEach((el) => el._w = new FeatureVoronoi(el));
    document.querySelectorAll("[data-widget='segment-check']").forEach((el) => el._w = new SegmentCheck(el));
    document.querySelectorAll("[data-widget='chain-lipschitz']").forEach((el) => el._w = new ChainLipschitz(el));
  });
})();
