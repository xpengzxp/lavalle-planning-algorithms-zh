/* 6.2.3–6.2.4 节：最大间隙路线图（广义 Voronoi 图，图 6.8、6.9）、左转谓词与双切线测试（图 6.14，式 6.1、6.2）、
   最短路路线图 = 简化可见性图（图 6.10–6.13） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;

  // ---------------------------------------------------------------
  // 特征（6.2.3 沿用 5.3.3 节的概念）：C_obs 的边（开线段）和顶点
  // 到边特征的距离只在垂足落在边内部时有定义，否则为 ∞（交给端点那个顶点特征）
  // ---------------------------------------------------------------
  function featDist(f, x) {
    if (f.kind === "v") return Math.hypot(x.x - f.p.x, x.y - f.p.y);
    const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y, L2 = dx * dx + dy * dy;
    const t = ((x.x - f.a.x) * dx + (x.y - f.a.y) * dy) / L2;
    if (t <= 1e-9 || t >= 1 - 1e-9) return Infinity;
    return Math.abs((x.x - f.a.x) * dy - (x.y - f.a.y) * dx) / Math.sqrt(L2);
  }
  // 一对特征的「等距曲线」候选（图 6.9 的三种情形），返回若干条折线（点列）
  function bisector(f1, f2, box, n) {
    n = n || 360;
    const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.5, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const lineSamples = (o, d) => {
      // 直线 o + s d 落在包围盒附近的部分
      const L = Math.hypot(d.x, d.y); d = P(d.x / L, d.y / L);
      const s0 = (cx - o.x) * d.x + (cy - o.y) * d.y;
      const out = []; for (let k = 0; k <= n; k++) { const s = s0 - span + (2 * span * k) / n; out.push(P(o.x + s * d.x, o.y + s * d.y)); }
      return out;
    };
    if (f1.kind === "v" && f2.kind === "v") {
      // 顶点–顶点：中垂线
      const m = C.lerp(f1.p, f2.p, 0.5);
      return [{ type: "VV", pts: lineSamples(m, P(-(f2.p.y - f1.p.y), f2.p.x - f1.p.x)) }];
    }
    if (f1.kind === "e" && f2.kind === "e") {
      // 边–边：两条支撑直线的角平分线（平行时是中线）
      const u1 = P(f1.b.x - f1.a.x, f1.b.y - f1.a.y), u2 = P(f2.b.x - f2.a.x, f2.b.y - f2.a.y);
      const l1 = Math.hypot(u1.x, u1.y), l2 = Math.hypot(u2.x, u2.y);
      const d1 = P(u1.x / l1, u1.y / l1), d2 = P(u2.x / l2, u2.y / l2);
      const den = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(den) < 1e-9) {
        const n1 = P(-d1.y, d1.x), off = (f2.a.x - f1.a.x) * n1.x + (f2.a.y - f1.a.y) * n1.y;
        return [{ type: "EE", pts: lineSamples(P(f1.a.x + n1.x * off / 2, f1.a.y + n1.y * off / 2), d1) }];
      }
      const t = ((f2.a.x - f1.a.x) * d2.y - (f2.a.y - f1.a.y) * d2.x) / den;
      const O = P(f1.a.x + t * d1.x, f1.a.y + t * d1.y);
      return [{ type: "EE", pts: lineSamples(O, P(d1.x + d2.x, d1.y + d2.y)) }, { type: "EE", pts: lineSamples(O, P(d1.x - d2.x, d1.y - d2.y)) }];
    }
    // 顶点–边：抛物线（焦点 = 顶点，准线 = 边所在直线）
    const v = f1.kind === "v" ? f1 : f2, e = f1.kind === "v" ? f2 : f1;
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, L = Math.hypot(dx, dy);
    let nx = -dy / L, ny = dx / L;
    let side = (v.p.x - e.a.x) * nx + (v.p.y - e.a.y) * ny;
    if (Math.abs(side) < 1e-9) return [];
    if (side < 0) { nx = -nx; ny = -ny; side = -side; }
    const pts = [];
    for (let k = 1; k < n; k++) {
      const t = k / n, f = P(e.a.x + t * dx, e.a.y + t * dy);
      const w = P(v.p.x - f.x, v.p.y - f.y), wn = w.x * nx + w.y * ny;
      if (wn <= 1e-12) continue;
      const s = (w.x * w.x + w.y * w.y) / (2 * wn);
      pts.push(P(f.x + s * nx, f.y + s * ny));
    }
    return [{ type: "VE", pts }];
  }
  function features(S) {
    const F = [];
    S.edges.forEach((e) => F.push({ kind: "e", a: e.a, b: e.b, id: F.length, name: e.name }));
    S.verts.forEach((v) => F.push({ kind: "v", p: v.p, id: F.length, vid: v.id }));
    return F;
  }
  // 朴素算法（6.2.3 节）：每对特征生成候选曲线，只保留「这两个特征确实是最近特征」的部分
  function naiveGVD(S, nSamp) {
    const F = features(S), box = S.box, cand = [], kept = [];
    let pairs = 0;
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const f1 = F[i], f2 = F[j];
      // 同一条边和它自己的端点：没有等距曲线
      if (f1.kind !== f2.kind) { const v = f1.kind === "v" ? f1 : f2, e = f1.kind === "v" ? f2 : f1; if (v.p === e.a || v.p === e.b) continue; }
      pairs++;
      for (const cur of bisector(f1, f2, box, nSamp)) {
        const run = [];
        let segs = [];
        for (const x of cur.pts) {
          if (x.x < box.x0 || x.x > box.x1 || x.y < box.y0 || x.y > box.y1) { if (run.length > 1) segs.push(run.slice()); run.length = 0; continue; }
          const d1 = featDist(f1, x), d2 = featDist(f2, x);
          let ok = isFinite(d1) && isFinite(d2) && Math.abs(d1 - d2) < 1e-7 * (1 + d1) && S.free(x);
          if (ok) for (const g of F) { if (g === f1 || g === f2) continue; if (featDist(g, x) < d1 - 1e-9) { ok = false; break; } }
          if (ok) run.push(x); else { if (run.length > 1) segs.push(run.slice()); run.length = 0; }
        }
        if (run.length > 1) segs.push(run.slice());
        cand.push({ type: cur.type, pts: cur.pts.filter((x) => x.x >= box.x0 && x.x <= box.x1 && x.y >= box.y0 && x.y <= box.y1) });
        segs.forEach((sg) => kept.push({ type: cur.type, pts: sg }));
      }
    }
    return { F, cand, kept, pairs };
  }
  // 栅格上的间隙场：用来演示「一层层削掉边界」和把 q 收缩（retract）到骨架上
  function clearanceField(S, res) {
    const b = S.box, W = res, Hh = Math.round(res * (b.y1 - b.y0) / (b.x1 - b.x0));
    const cw = (b.x1 - b.x0) / W, ch = (b.y1 - b.y0) / Hh;
    const d = new Float32Array(W * Hh).fill(-1), lab = new Int32Array(W * Hh).fill(-1);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const x = P(b.x0 + (i + 0.5) * cw, b.y0 + (j + 0.5) * ch);
      if (!S.free(x)) continue;
      let best = Infinity, bl = -1;
      S.edges.forEach((e) => {
        const r = C.segPointDist(x, e.a, e.b);
        if (r.d < best) { best = r.d; bl = r.t <= 1e-9 ? 1e6 + S.vertId(e.pi, e.i) : r.t >= 1 - 1e-9 ? 1e6 + S.vertId(e.pi, (e.i + 1) % S.polys[e.pi].length) : e.id; }
      });
      d[j * W + i] = best; lab[j * W + i] = bl;
    }
    // 骨架：相邻格子的最近特征不同（且不是「边与它自己的端点」这种只差一个法线方向的情形）
    const adjFeat = (a, b2) => {
      if (a === b2) return true;
      const ev = (x, y) => { if (x >= 1e6 || y < 1e6) return false; const e = S.edges[x], v = S.verts[y - 1e6].p; return e.a === v || e.b === v; };
      return ev(a, b2) || ev(b2, a);
    };
    const skel = new Uint8Array(W * Hh);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (d[k] < 0) continue;
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const i2 = i + di, j2 = j + dj; if (i2 >= W || j2 >= Hh) continue;
        const k2 = j2 * W + i2; if (d[k2] < 0) continue;
        if (!adjFeat(lab[k], lab[k2])) { if (d[k] >= d[k2]) skel[k] = 1; else skel[k2] = 1; }
      }
    }
    // 去掉角落里栅格化产生的孤立小碎片（只保留像样的连通块）
    const seen = new Uint8Array(W * Hh);
    for (let k0 = 0; k0 < W * Hh; k0++) {
      if (!skel[k0] || seen[k0]) continue;
      const comp = [k0]; seen[k0] = 1;
      for (let q = 0; q < comp.length; q++) {
        const u = comp[q], i = u % W, j = (u - i) / W;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= W || j2 >= Hh) continue;
          const k2 = j2 * W + i2; if (skel[k2] && !seen[k2]) { seen[k2] = 1; comp.push(k2); }
        }
      }
      if (comp.length < 12) for (const u of comp) skel[u] = 0;
    }
    return { W, H: Hh, cw, ch, d, lab, skel, b };
  }

  // ===============================================================
  // 图 6.8、6.9：等距点的三种情形
  // ===============================================================
  class GVDPieces {
    constructor(root) {
      this.mode = "corridor";
      this.presets = {
        corridor: { name: "走廊（图 6.8）", feats: () => [{ kind: "e", a: P(-1, -0.5), b: P(1, -0.5) }, { kind: "e", a: P(1, 0.5), b: P(-1, 0.5) }] },
        EE: { name: "边–边", feats: () => [{ kind: "e", a: P(-0.9, -0.55), b: P(0.8, -0.45) }, { kind: "e", a: P(-0.9, 0.05), b: P(0.6, 0.6) }] },
        VV: { name: "顶点–顶点", feats: () => [{ kind: "v", p: P(-0.1, 0.35) }, { kind: "v", p: P(0.15, -0.3) }] },
        VE: { name: "顶点–边", feats: () => [{ kind: "v", p: P(0.05, 0.1) }, { kind: "e", a: P(-1, -0.45), b: P(1, -0.45) }] },
      };
      this.feats = this.presets.corridor.feats(); this.probe = P(-0.45, 0.22);
      const body = C.frame(root, "到两个特征等距的点", "拖动探针点，或拖动特征的端点");
      this.st = new C.Stage({ aspect: 0.62, maxW: 560, view: [-1.1, 1.1, -0.72, 0.72], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { if (this.st.near(p, this.probe, 13)) return { k: "probe" }; for (let i = 0; i < this.feats.length; i++) { const f = this.feats[i]; for (const key of f.kind === "v" ? ["p"] : ["a", "b"]) if (this.st.near(p, f[key], 11)) return { k: "f", i, key }; } return { k: "probe", jump: true }; },
        onMove: (p, d) => { if (d.k === "probe") this.probe = p; else this.feats[d.i][d.key] = p; this.st.draw(); this.info(); },
        cursor: () => "crosshair" });
      this.out = h("div", { class: "small mono", style: "white-space:pre-line" });
      body.append(h("div", { class: "controls" }, C.seg(Object.entries(this.presets).map(([k, v]) => [k, v.name]), this.mode, (k) => { this.mode = k; this.feats = this.presets[k].feats(); this.st.draw(); this.info(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.out,
          C.legend([[C.cv("wall"), "特征（边 / 顶点）"], [C.cv("alive2"), "等距曲线"], [C.cv("warn"), "探针到最近点"]]))));
      this.info();
    }
    info() {
      const [f1, f2] = this.feats, x = this.probe;
      const d1 = featDist(f1, x), d2 = featDist(f2, x);
      const fmt = (d) => (isFinite(d) ? d.toFixed(3) : "∞（垂足不在边内）");
      const typ = { corridor: "边–边（平行）→ 中线", EE: "边–边 → 直线（角平分线）", VV: "顶点–顶点 → 直线（中垂线）", VE: "顶点–边 → 抛物线（二次曲线）" }[this.mode];
      const eq = isFinite(d1) && isFinite(d2) && Math.abs(d1 - d2) < 0.012;
      this.out.textContent = `曲线类型：${typ}\nd(探针, 特征 1) = ${fmt(d1)}\nd(探针, 特征 2) = ${fmt(d2)}\n${eq ? "≈ 相等：探针在曲线上，有两个最近点" : "不相等：只有一个最近点"}`;
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const box = { x0: -1.1, x1: 1.1, y0: -0.72, y1: 0.72 };
      const [f1, f2] = this.feats;
      if (this.mode === "corridor") { st.poly([P(-2, -0.5), P(2, -0.5), P(2, -2), P(-2, -2)], C.alpha(col.wall, 0.7)); st.poly([P(-2, 0.5), P(2, 0.5), P(2, 2), P(-2, 2)], C.alpha(col.wall, 0.7)); }
      for (const cur of bisector(f1, f2, box, 600)) {
        // 只画两个特征的距离都有定义的部分
        let run = [];
        const flush = () => { if (run.length > 1) st.path(run, col.alive2, 2.6, cur.type === "VV" ? [7, 5] : null); run = []; };
        for (const x of cur.pts) { if (isFinite(featDist(f1, x)) && isFinite(featDist(f2, x))) run.push(x); else flush(); }
        flush();
      }
      for (const f of this.feats) {
        if (f.kind === "e") { st.line(f.a, f.b, col.wall, 4); st.dot(f.a, 5, col.surface, col.wall, 2); st.dot(f.b, 5, col.surface, col.wall, 2); }
        else st.dot(f.p, 6.5, col.wall, col.surface, 2);
      }
      // 探针到两个特征的最近点
      const x = this.probe;
      const r = [];
      for (const f of this.feats) {
        const d = featDist(f, x); if (!isFinite(d)) continue;
        let q; if (f.kind === "v") q = f.p; else { const { t } = C.segPointDist(x, f.a, f.b); q = C.lerp(f.a, f.b, t); }
        r.push({ d, q });
      }
      const m = Math.min(...r.map((o) => o.d));
      for (const o of r) st.line(x, o.q, Math.abs(o.d - m) < 0.012 ? col.warn : C.alpha(col.muted, 0.7), Math.abs(o.d - m) < 0.012 ? 2.2 : 1.2, Math.abs(o.d - m) < 0.012 ? null : [4, 4]);
      if (isFinite(m)) { st.ctx.beginPath(); st.ctx.arc(st.X(x.x), st.Y(x.y), m * st.scale, 0, 2 * Math.PI); st.ctx.strokeStyle = C.alpha(col.warn, 0.45); st.ctx.lineWidth = 1; st.ctx.stroke(); }
      st.dot(x, 6, col.warn, col.surface, 2);
    }
  }

  // ===============================================================
  // 6.2.3：最大间隙路线图（朴素算法 + 削边界 + 收缩查询）
  // ===============================================================
  class MaxClearance {
    constructor(root) {
      this.key = "corridor"; this.showCand = false; this.shave = 0; this.showSP = true;
      const body = C.frame(root, "最大间隙路线图（广义 Voronoi 图）", "拖动 qI、qG；拖动「削掉的厚度」看收缩过程");
      this.st = new C.Stage({ aspect: 0.66, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => (this.st.near(p, this.S.qI, 12) ? "qI" : this.st.near(p, this.S.qG, 12) ? "qG" : null),
        onMove: (p, d) => { if (this.S.free(p)) { this.S[d] = p; this.query(); this.st.draw(); } },
        cursor: (p) => (this.st.near(p, this.S.qI, 12) || this.st.near(p, this.S.qG, 12) ? "grab" : null) });
      this.selS = C.select(Object.entries(C.SCENES).filter(([k]) => k !== "fig61").map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.load(); });
      this.cbC = C.check("显示全部候选曲线", false, (v) => { this.showCand = v; this.st.draw(); });
      this.cbS = C.check("对比最短路（6.2.4）", true, (v) => { this.showSP = v; this.st.draw(); this.stats(); });
      this.sShave = C.slider("削掉的厚度", 0, 0.2, 0.002, 0, (v) => { this.shave = v; this.st.draw(); }, (v) => v.toFixed(3));
      this.stt = { pairs: C.stat("特征对（候选曲线）"), len: C.stat("最大间隙路径：长度 / 最小间隙"), sp: C.stat("最短路：长度 / 最小间隙") };
      body.append(h("div", { class: "controls" }, this.selS, this.cbC, this.cbS), h("div", { class: "controls" }, this.sShave),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stt)),
        C.legend([[C.cv("alive2"), "最大间隙路线图"], [C.cv("path"), "沿路线图的解（先收缩到路线图）"], [C.cv("goal"), "最短路（贴着角走）"], [C.cva("warn", 0.4), "已被「削掉」的部分"]]));
      this.load();
    }
    load() {
      this.S = C.makeScene(this.key); this.st.fitScene(this.S, 0.03);
      this.G = naiveGVD(this.S, 320);
      this.Fd = clearanceField(this.S, 260);
      this.sp = C.spRoadmap(this.S);
      this.sShave.input.max = (Math.max(...this.Fd.d) * 0.98).toFixed(3);
      this.query(); this.st.draw();
    }
    cellOf(q) { const F = this.Fd; const i = Math.floor((q.x - F.b.x0) / F.cw), j = Math.floor((q.y - F.b.y0) / F.ch); return i >= 0 && j >= 0 && i < F.W && j < F.H ? [i, j] : null; }
    center(i, j) { const F = this.Fd; return P(F.b.x0 + (i + 0.5) * F.cw, F.b.y0 + (j + 0.5) * F.ch); }
    retract(q) {
      // 收缩（retraction）：沿「远离最近障碍点」的方向走，直到碰到骨架
      const F = this.Fd, pts = [q]; let x = q;
      for (let it = 0; it < 600; it++) {
        const c = this.cellOf(x); if (!c) break;
        const k = c[1] * F.W + c[0];
        if (F.skel[k]) return { pts, cell: c };
        let best = Infinity, bq = null;
        for (const e of this.S.edges) { const r = C.segPointDist(x, e.a, e.b); if (r.d < best) { best = r.d; bq = C.lerp(e.a, e.b, r.t); } }
        const dx = x.x - bq.x, dy = x.y - bq.y, L = Math.hypot(dx, dy) || 1, step = Math.min(F.cw, F.ch) * 0.7;
        const nx = P(x.x + (dx / L) * step, x.y + (dy / L) * step);
        // 跨过骨架的那一步：检查附近格子
        const c2 = this.cellOf(nx); if (!c2) break;
        let hit = null;
        for (let di = -1; di <= 1 && !hit; di++) for (let dj = -1; dj <= 1 && !hit; dj++) { const i = c2[0] + di, j = c2[1] + dj; if (i >= 0 && j >= 0 && i < F.W && j < F.H && F.skel[j * F.W + i]) hit = [i, j]; }
        x = nx; pts.push(x);
        if (hit) { pts.push(this.center(...hit)); return { pts, cell: hit }; }
      }
      return { pts, cell: null };
    }
    query() {
      const F = this.Fd, S = this.S;
      const rI = this.retract(S.qI), rG = this.retract(S.qG);
      this.rI = rI; this.rG = rG; this.path = null;
      if (rI.cell && rG.cell) {
        // 在骨架格子上做 Dijkstra（8 邻接）
        const N = F.W * F.H, dist = new Float64Array(N).fill(Infinity), par = new Int32Array(N).fill(-1);
        const s = rI.cell[1] * F.W + rI.cell[0], t = rG.cell[1] * F.W + rG.cell[0];
        dist[s] = 0; const heap = [[0, s]];
        const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        while (heap.length) {
          const [d, k] = pop(); if (d > dist[k]) continue; if (k === t) break;
          const i = k % F.W, j = (k - i) / F.W;
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue; const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= F.W || j2 >= F.H) continue;
            const k2 = j2 * F.W + i2; if (!F.skel[k2]) continue;
            const w = Math.hypot(di * F.cw, dj * F.ch); if (d + w < dist[k2]) { dist[k2] = d + w; par[k2] = k; push(d + w, k2); }
          }
        }
        if (dist[t] < Infinity) {
          const cells = []; for (let k = t; k >= 0; k = par[k]) cells.push(this.center(k % F.W, Math.floor(k / F.W)));
          cells.reverse();
          // 轻微平滑，去掉栅格锯齿
          const sm = cells.map((p, i) => { if (i === 0 || i === cells.length - 1) return p; let sx = 0, sy = 0, n = 0; for (let k = Math.max(0, i - 3); k <= Math.min(cells.length - 1, i + 3); k++) { sx += cells[k].x; sy += cells[k].y; n++; } return P(sx / n, sy / n); });
          this.path = rI.pts.concat(sm, rG.pts.slice().reverse());
        }
      }
      this.spRes = C.spQuery(S, this.sp, S.qI, S.qG);
      this.stats();
    }
    minClear(pts) {
      let m = Infinity;
      for (let i = 1; i < pts.length; i++) for (let k = 0; k <= 4; k++) {
        const x = C.lerp(pts[i - 1], pts[i], k / 4);
        for (const e of this.S.edges) m = Math.min(m, C.segPointDist(x, e.a, e.b).d);
      }
      return m;
    }
    stats() {
      this.stt.pairs.set(`${this.G.pairs}（O(n²) 条，交点 O(n⁴)）`);
      const len = (pts) => pts.reduce((s, p, i) => (i ? s + C.dist(pts[i - 1], p) : 0), 0);
      // 起点、终点附近的间隙不算（它们由 qI、qG 决定）
      const inner = (pts) => { const L = len(pts); let acc = 0; const out = []; for (let i = 0; i < pts.length; i++) { if (i) acc += C.dist(pts[i - 1], pts[i]); if (acc > 0.12 * L && acc < 0.88 * L) out.push(pts[i]); } return out.length > 1 ? out : pts; };
      this.stt.len.set(this.path ? `${len(this.path).toFixed(3)} / ${this.minClear(inner(this.path)).toFixed(3)}` : "–");
      this.stt.sp.set(this.spRes && this.spRes.found ? `${this.spRes.len.toFixed(3)} / ${this.minClear(this.spRes.pts).toFixed(3)}` : "–");
    }
    draw(st, col) {
      const S = this.S, F = this.Fd;
      st.scene(S, col);
      if (this.shave > 0) {
        // 削掉的薄层：间隙小于阈值、且不在骨架上的格子
        const ctx = st.ctx; ctx.fillStyle = C.alpha(col.warn, 0.32);
        const pw = F.cw * st.scale + 0.6, ph = F.ch * st.scale + 0.6;
        for (let j = 0; j < F.H; j++) for (let i = 0; i < F.W; i++) {
          const k = j * F.W + i; if (F.d[k] < 0 || F.d[k] >= this.shave || F.skel[k]) continue;
          ctx.fillRect(st.X(F.b.x0 + i * F.cw), st.Y(F.b.y0 + (j + 1) * F.ch), pw, ph);
        }
      }
      if (this.showCand) for (const c of this.G.cand) st.path(c.pts, C.alpha(col.alive2, 0.25), 1, [3, 3]);
      for (const k of this.G.kept) st.path(k.pts, col.alive2, 2.6);
      if (this.showSP && this.spRes && this.spRes.found) st.path(this.spRes.pts, C.alpha(col.goal, 0.85), 2, [6, 4]);
      if (this.path) {
        st.path(this.rI.pts, col.path, 2, [3, 3]); st.path(this.rG.pts, col.path, 2, [3, 3]);
        st.path(this.path, C.alpha(col.path, 0.9), 3);
      }
      st.qmark(S.qI, "I", col); st.qmark(S.qG, "G", col);
    }
  }

  // ===============================================================
  // 式 (6.2) 左转谓词 与 式 (6.1) 双切线测试（图 6.14）
  // ===============================================================
  class LeftTurn {
    constructor(root) {
      this.mode = "bit";
      this.pts = { p1: P(0.0, 1.0), p2: P(0.6, 0.0), p3: P(1.2, 1.0), p4: P(3.6, 0.0), p5: P(2.8, 1.3), p6: P(2.0, 0.0) };
      const body = C.frame(root, "不用三角函数的双切线测试", "拖动任何一个点");
      this.st = new C.Stage({ aspect: 0.55, maxW: 600, view: [-0.6, 4.2, -0.9, 1.9], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { for (const k in this.pts) if ((this.mode === "bit" || ["p1", "p2", "p3"].includes(k)) && this.st.near(p, this.pts[k], 13)) return k; return null; },
        onMove: (p, k) => { this.pts[k] = p; this.render(); },
        cursor: (p) => (Object.keys(this.pts).some((k) => (this.mode === "bit" || ["p1", "p2", "p3"].includes(k)) && this.st.near(p, this.pts[k], 13)) ? "grab" : null) });
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, C.seg([["fl", "左转谓词 f_l (6.2)"], ["bit", "双切线测试 (6.1)"]], this.mode, (k) => { this.mode = k; this.render(); })),
        h("div", { class: "split" }, this.st.wrap, this.out));
      this.render();
    }
    render() {
      const { p1, p2, p3, p4, p5, p6 } = this.pts, f = C.fl;
      const b = (v) => (v ? '<span class="yes">TRUE</span>' : '<span class="no">FALSE</span>');
      if (this.mode === "fl") {
        const D = C.detM(p1, p2, p3), r = (p) => `1 & ${p.x.toFixed(2)} & ${p.y.toFixed(2)}`;
        this.out.innerHTML = `$$M(p_1,p_2,p_3)=\\begin{pmatrix}${r(p1)}\\\\ ${r(p2)}\\\\ ${r(p3)}\\end{pmatrix}$$<p>\\(\\det M = ${D.toFixed(3)}\\)，所以 \\(f_l(p_1,p_2,p_3)\\) = ${b(D > 0)}：p3 ${D > 0 ? "在" : "不在"}从 p1 出发穿过 p2 的射线<b>左侧</b>。</p><p class="muted">只用乘法和加减，没有 atan2、没有除法，数值上更稳。det M 正好是三角形 p1p2p3 有向面积的 2 倍。</p>`;
      } else {
        const a = f(p1, p2, p5), c = f(p3, p2, p5), d = f(p4, p5, p2), e = f(p6, p5, p2);
        const x1 = a !== c, x2 = d !== e, val = x1 || x2;
        const seg = !this.blocked();
        this.out.innerHTML = `<div class="table-wrap" style="margin:0"><table class="data" style="font-size:13px"><tr><td>\\(f_l(p_1,p_2,p_5)\\)</td><td>${b(a)}</td><td>\\(f_l(p_4,p_5,p_2)\\)</td><td>${b(d)}</td></tr><tr><td>\\(f_l(p_3,p_2,p_5)\\)</td><td>${b(c)}</td><td>\\(f_l(p_6,p_5,p_2)\\)</td><td>${b(e)}</td></tr><tr><td>异或 ⊕</td><td>${b(x1)}</td><td>异或 ⊕</td><td>${b(x2)}</td></tr></table></div>`
          + `<p>(6.1) = ${b(x1)} ∨ ${b(x2)} = ${b(val)}，所以 (p2, p5) ${val ? "<b>不是</b>双切线：直线在" + (x1 ? " p2 " : "") + (x1 && x2 ? "和" : "") + (x2 ? " p5 " : "") + "处刺进了障碍。" : "<b>是</b>双切线。"}</p>`
          + `<p class="muted">异或为 TRUE ⇔ 该顶点的两个邻点分在直线 p2p5 的两侧 ⇔ 直线在这里刺进障碍。${seg ? "" : '<span class="no">注意：线段 p2p5 穿过了三角形——(6.1) 假设它不碰撞，所以此时结论不可信。</span>'}</p>`;
      }
      PA.renderMath(this.out);
      this.st.draw();
    }
    blocked() {
      const { p1, p2, p3, p4, p5, p6 } = this.pts;
      const T1 = [p1, p2, p3], T2 = [p4, p5, p6];
      for (const T of [T1, T2]) for (let i = 0; i < 3; i++) if (C.properCross(p2, p5, T[i], T[(i + 1) % 3])) return true;
      return C.inPoly(C.lerp(p2, p5, 0.5), T1) || C.inPoly(C.lerp(p2, p5, 0.5), T2);
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const { p1, p2, p3, p4, p5, p6 } = this.pts;
      const label = (k, p, c) => { st.dot(p, 6, c || col.surface, col.text, 2); st.text(k, p, col.text, { dy: -15, weight: 650 }); };
      if (this.mode === "fl") {
        // 射线 p1→p2 左侧上色
        const d = P(p2.x - p1.x, p2.y - p1.y), L = Math.hypot(d.x, d.y) || 1, u = P(d.x / L, d.y / L), n = P(-u.y, u.x), R = 20;
        st.poly([P(p1.x - u.x * R, p1.y - u.y * R), P(p1.x + u.x * R, p1.y + u.y * R), P(p1.x + u.x * R + n.x * R, p1.y + u.y * R + n.y * R), P(p1.x - u.x * R + n.x * R, p1.y - u.y * R + n.y * R)], C.alpha(col.ok, 0.12));
        st.line(p1, P(p1.x + u.x * R, p1.y + u.y * R), col.text2, 1.5);
        st.arrow(p1, p2, col.text2, 2);
        st.poly([p1, p2, p3], C.alpha(C.fl(p1, p2, p3) ? col.ok : col.bad, 0.2), C.fl(p1, p2, p3) ? col.ok : col.bad, 1.5, [4, 4]);
        st.text("左侧", P(p1.x + u.x * 0.5 + n.x * 0.35, p1.y + u.y * 0.5 + n.y * 0.35), col.ok, { size: 12 });
        label("p1", p1); label("p2", p2); label("p3", p3, C.fl(p1, p2, p3) ? col.ok : col.bad);
        return;
      }
      st.poly([p1, p2, p3], C.alpha(col.wall, 0.75), col.wall, 1);
      st.poly([p4, p5, p6], C.alpha(col.wall, 0.75), col.wall, 1);
      const d = P(p5.x - p2.x, p5.y - p2.y), R = 3;
      const val = (C.fl(p1, p2, p5) !== C.fl(p3, p2, p5)) || (C.fl(p4, p5, p2) !== C.fl(p6, p5, p2));
      st.line(P(p2.x - d.x * R, p2.y - d.y * R), P(p5.x + d.x * R, p5.y + d.y * R), C.alpha(val ? col.bad : col.ok, 0.6), 1.4, [6, 4]);
      st.line(p2, p5, val ? col.bad : col.ok, 3);
      for (const k of ["p1", "p2", "p3", "p4", "p5", "p6"]) label(k, this.pts[k], k === "p2" || k === "p5" ? col.warn : null);
    }
  }

  // ===============================================================
  // 6.2.4：最短路路线图（简化可见性图）与查询；径向扫描
  // ===============================================================
  class Visibility {
    constructor(root) {
      this.key = "spmap"; this.full = false; this.showQ = true; this.sweepV = null; this.theta = 0;
      const body = C.frame(root, "最短路路线图（简化可见性图）", "拖动 qI、qG 或障碍顶点；点一个反射顶点看径向扫描");
      this.st = new C.Stage({ aspect: 0.66, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p, e) => {
          if (this.st.near(p, this.S.qI, 12)) return "qI";
          if (this.st.near(p, this.S.qG, 12)) return "qG";
          const v = this.S.verts.find((v) => this.st.near(p, v.p, 10));
          if (v && this.sweepMode) { this.sweepV = v.id; this.theta = 0; this.sTheta.set(0); this.render(); return null; }
          return this.drag.onDown(p);
        },
        onMove: (p, d) => {
          if (d === "qI" || d === "qG") { if (this.S.free(p)) { this.S[d] = p; this.query(); this.render(); } return; }
          this.drag.onMove(p, d);
        },
        cursor: (p) => (this.st.near(p, this.S.qI, 12) || this.st.near(p, this.S.qG, 12) || this.drag.hover(p) ? (this.sweepMode ? "pointer" : "grab") : null) });
      this.drag = C.vertexDragger(() => this.S, () => this.rebuild(), () => this.st);
      this.selS = C.select(Object.entries(C.SCENES).filter(([k]) => k !== "fig61").map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.load(); });
      this.cbF = C.check("改用完整可见性图（所有互相可见的顶点对）", false, (v) => { this.full = v; this.rebuild(); });
      this.cbQ = C.check("显示查询边（图 6.12）", true, (v) => { this.showQ = v; this.st.draw(); });
      this.cbW = C.check("径向扫描模式（点顶点）", false, (v) => { this.sweepMode = v; this.sweepV = v ? (this.G.R[0] ?? null) : null; this.render(); });
      this.sTheta = C.slider("射线角 θ", 0, 360, 1, 0, (v) => { this.theta = v; this.render(); }, (v) => v + "°");
      this.stt = { r: C.stat("反射顶点 / 全部顶点"), e: C.stat("路线图的边"), len: C.stat("最短路长度"), chk: C.stat("与完整可见性图比较") };
      this.sweepOut = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selS, this.cbF, this.cbQ), h("div", { class: "controls" }, this.cbW, this.sTheta),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stt)), this.sweepOut,
        C.legend([[C.cv("warn"), "反射顶点"], [C.cv("accent"), "相邻反射顶点之间的边"], [C.cv("alive2"), "双切线边"], [C.cv("muted"), "查询边"], [C.cv("path"), "最短路"]]));
      this.load();
    }
    load() { this.S = C.makeScene(this.key); this.st.fitScene(this.S, 0.03); this.rebuild(); }
    rebuild() { this.G = this.full ? C.fullVisibility(this.S) : C.spRoadmap(this.S); this.Gfull = C.fullVisibility(this.S); this.Gred = C.spRoadmap(this.S); this.query(); this.render(); }
    query() { this.res = C.spQuery(this.S, this.G, this.S.qI, this.S.qG); const other = C.spQuery(this.S, this.full ? this.Gred : this.Gfull, this.S.qI, this.S.qG); this.other = other; }
    render() {
      const S = this.S, R = C.reflexVerts(S);
      this.stt.r.set(`${R.length} / ${S.verts.length}`);
      const nb = this.G.E.filter((e) => e.kind === "bitangent").length;
      this.stt.e.set(this.full ? `${this.G.E.length}` : `${this.G.E.length}（双切线 ${nb}）`);
      this.stt.len.set(this.res.found ? this.res.len.toFixed(4) : '<span class="no">无解</span>');
      const same = this.res.found && this.other.found && Math.abs(this.res.len - this.other.len) < 1e-9;
      this.stt.chk.set(this.res.found ? (same ? `<span class="yes">长度相同 ✓</span>（${this.full ? "简化图" : "完整图"} ${this.full ? this.Gred.E.length : this.Gfull.E.length} 条边）` : '<span class="no">不同</span>') : "–");
      // 径向扫描：从选中的顶点 v 出发，按角度依次「碰到」其它顶点；在射线扫过的范围内找出 v 的双切线
      if (this.sweepMode && this.sweepV !== null) {
        const v = S.verts[this.sweepV], th = (this.theta * Math.PI) / 180;
        const ang = (p) => { let a = Math.atan2(p.y - v.p.y, p.x - v.p.x); if (a < 0) a += 2 * Math.PI; return a; };
        const evs = S.verts.filter((w) => w.id !== v.id).map((w) => ({ w, a: ang(w.p) })).sort((x, y) => x.a - y.a);
        const passed = evs.filter((o) => o.a <= th);
        const isR = R.includes(v.id);
        const found = this.Gred.E.filter((e) => (e.a === v.id || e.b === v.id)).map((e) => (e.a === v.id ? e.b : e.a)).filter((u) => passed.some((o) => o.w.id === u));
        this.sweepInfo = { v, th, passed, found, isR };
        this.sweepOut.innerHTML = isR
          ? `径向扫描：从顶点 v 出发的射线已扫过 ${passed.length} / ${evs.length} 个事件（顶点按角度排好序，用平衡树维护射线碰到的边，一个顶点 \\(O(n\\lg n)\\)，全部反射顶点 \\(O(n^2\\lg n)\\)）。目前确认的路线图邻居：${found.length} 个。`
          : "这个顶点不是反射顶点（自由空间一侧的内角 < π），最短路永远不会在这里拐弯，所以它不进路线图。换一个顶点。";
        PA.renderMath(this.sweepOut);
      } else { this.sweepInfo = null; this.sweepOut.textContent = ""; }
      this.st.draw();
    }
    draw(st, col) {
      const S = this.S, V = S.verts, G = this.G;
      st.scene(S, col);
      if (this.showQ && this.res.qEdges) for (const [a, b] of this.res.qEdges) st.line(a, b, C.alpha(col.muted, 0.45), 1);
      for (const e of G.E) st.line(V[e.a].p, V[e.b].p, e.kind === "edge" ? col.accent : e.kind === "bitangent" ? col.alive2 : C.alpha(col.alive2, 0.6), e.kind === "edge" ? 3 : 1.6);
      const R = new Set(C.reflexVerts(S));
      for (const v of V) st.dot(v.p, R.has(v.id) ? 4.5 : 3, R.has(v.id) ? col.warn : col.wall, R.has(v.id) ? col.surface : null, 1);
      if (this.res.found) st.path(this.res.pts, col.path, 3.4);
      if (this.sweepInfo) {
        const { v, th, passed, found } = this.sweepInfo;
        // 射线：画到第一次碰到的边
        const far = P(v.p.x + 5 * Math.cos(th), v.p.y + 5 * Math.sin(th));
        let t = 1; for (const e of S.edges) { if (e.a === v.p || e.b === v.p) continue; t = Math.min(t, C.segHitT(v.p, far, e.a, e.b)); }
        st.line(v.p, C.lerp(v.p, far, t), col.warn, 2);
        for (const o of passed) st.dot(o.w.p, 6, null, C.alpha(col.warn, 0.7), 1.5);
        for (const u of found) st.line(v.p, V[u].p, col.warn, 3);
        st.dot(v.p, 7, col.warn, col.surface, 2);
      }
      st.qmark(S.qI, "I", col); st.qmark(S.qG, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='gvd-pieces']").forEach((el) => el._w = new GVDPieces(el));
    document.querySelectorAll("[data-widget='max-clearance']").forEach((el) => el._w = new MaxClearance(el));
    document.querySelectorAll("[data-widget='left-turn']").forEach((el) => el._w = new LeftTurn(el));
    document.querySelectorAll("[data-widget='visibility']").forEach((el) => el._w = new Visibility(el));
  });
  window.CH6.naiveGVD = naiveGVD;
  window.CH6.clearanceField = clearanceField;
})();
