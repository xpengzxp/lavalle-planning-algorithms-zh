/* 7.6 节：覆盖规划——牛耕式（boustrophedon）分解（图 7.35、7.36）与生成树覆盖（图 7.37、7.38） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // =================================================================
  // 组件 1：牛耕式分解——只在「连通性改变」的地方切开（图 7.36），每个单元里来回耕
  // =================================================================
  const BOU = {
    outer: [{ x: 0.5, y: 0.3 }, { x: 9.6, y: 0.3 }, { x: 9.0, y: 6.7 }, { x: 0.1, y: 6.7 }],
    obs: [
      [{ x: 2.0, y: 1.6 }, { x: 4.4, y: 1.1 }, { x: 3.4, y: 2.9 }, { x: 4.4, y: 4.6 }, { x: 2.2, y: 5.0 }],
      [{ x: 5.6, y: 4.4 }, { x: 7.6, y: 2.0 }, { x: 8.2, y: 5.4 }, { x: 7.0, y: 4.9 }],
    ],
  };
  const allPolys = () => [BOU.outer, ...BOU.obs];
  const isFree = (p) => C.inPoly(p, BOU.outer) && !BOU.obs.some((P) => C.inPoly(p, P));
  // 竖直线 x 与自由空间的交：若干个区间 [lo, hi]
  function freeIntervals(x) {
    const ys = [];
    for (const P of allPolys()) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[j], b = P[i];
      if ((a.x <= x && x < b.x) || (b.x <= x && x < a.x)) ys.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
    }
    ys.sort((a, b) => a - b);
    const out = [];
    for (let k = 0; k + 1 < ys.length; k++) if (ys[k + 1] - ys[k] > 1e-9 && isFree({ x, y: (ys[k] + ys[k + 1]) / 2 })) out.push([ys[k], ys[k + 1]]);
    return out;
  }
  // 扫描：按所有顶点的 x 切成竖条；相邻竖条里的区间若「一对一」重叠就并成同一个单元（牛耕式）；
  // vertical = true 时还要在每个顶点处切开它所在的那一列（6.2.2 节的竖直分解）
  function decompose(vertical) {
    const xs = [...new Set(allPolys().flat().map((p) => +p.x.toFixed(9)))].sort((a, b) => a - b);
    const verts = allPolys().flat();
    const pieces = [];
    for (let k = 0; k + 1 < xs.length; k++) for (const [lo, hi] of freeIntervals((xs[k] + xs[k + 1]) / 2)) pieces.push({ k, x0: xs[k], x1: xs[k + 1], lo, hi });
    const uf = new C.UnionFind(pieces.length), links = [];
    for (let k = 0; k + 2 < xs.length; k++) {
      const L = pieces.map((p, i) => i).filter((i) => pieces[i].k === k), R = pieces.map((p, i) => i).filter((i) => pieces[i].k === k + 1);
      const ov = (a, b) => Math.min(pieces[a].hi, pieces[b].hi) - Math.max(pieces[a].lo, pieces[b].lo) > 1e-9;
      for (const a of L) for (const b of R) {
        if (!ov(a, b)) continue;
        links.push([a, b]);
        const oneToOne = R.filter((c) => ov(a, c)).length === 1 && L.filter((c) => ov(c, b)).length === 1;
        let cut = !oneToOne;
        if (!cut && vertical) {
          const xb = xs[k + 1], lo = Math.min(pieces[a].lo, pieces[b].lo), hi = Math.max(pieces[a].hi, pieces[b].hi);
          cut = verts.some((v) => Math.abs(v.x - xb) < 1e-9 && v.y >= lo - 1e-9 && v.y <= hi + 1e-9);
        }
        if (!cut) uf.union(a, b);
      }
    }
    const id = new Map(); pieces.forEach((p, i) => { const r = uf.find(i); if (!id.has(r)) id.set(r, id.size); p.cell = id.get(r); });
    const cells = Array.from({ length: id.size }, (_, c) => { const P = pieces.filter((p) => p.cell === c); return { c, pieces: P, x0: Math.min(...P.map((p) => p.x0)), x1: Math.max(...P.map((p) => p.x1)) }; });
    const adj = cells.map(() => new Set()); for (const [a, b] of links) { const u = pieces[a].cell, v = pieces[b].cell; if (u !== v) { adj[u].add(v); adj[v].add(u); } }
    return { xs, pieces, cells, adj };
  }
  // 每个单元里的「之」字形耕作路线：竖直的车道间距 ε，车道两端离边界 ε/2
  function lanes(D, eps) {
    const order = [], seen = new Set();
    const start = D.cells.reduce((b, c) => (c.x0 < b.x0 ? c : b), D.cells[0]).c;
    const dfs = (u) => { seen.add(u); order.push(u); [...D.adj[u]].sort((a, b) => D.cells[a].x0 - D.cells[b].x0).forEach((v) => { if (!seen.has(v)) dfs(v); }); };
    dfs(start);
    const route = [];
    for (const c of order) {
      const cell = D.cells[c], segs = [];
      for (let x = cell.x0 + eps / 2; x < cell.x1 - 1e-9; x += eps) {
        const pc = cell.pieces.find((p) => x >= p.x0 - 1e-9 && x <= p.x1 + 1e-9);
        if (!pc) continue;
        const iv = freeIntervals(x).find(([lo, hi]) => Math.min(hi, pc.hi) - Math.max(lo, pc.lo) > 1e-9);
        if (!iv || iv[1] - iv[0] < eps) continue;
        segs.push([x, iv[0] + eps / 2, iv[1] - eps / 2]);
      }
      route.push({ c, segs });
    }
    return route;
  }

  class Boustrophedon {
    constructor(root) {
      this.eps = 0.35; this.showV = false;
      const body = C.frame(root, "牛耕式分解", "图 7.35、7.36：沿 x 扫描，只在自由区间「分叉 / 合并 / 出现 / 消失」处切开；每个单元里用间距 ε 的竖直车道来回耕");
      this.st = new C.Stage({ view: [0, 10, 0, 7], maxW: 620, aspect: 0.7, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sE = C.slider("工具宽度 ε", 0.15, 0.8, 0.05, this.eps, (v) => { this.eps = v; this.update(); }, (v) => v.toFixed(2));
      this.cV = C.check("对比：6.2.2 节的竖直分解（每个顶点都切）", this.showV, (v) => { this.showV = v; this.update(); });
      this.stats = { b: C.stat("牛耕式单元"), v: C.stat("竖直分解单元"), lanes: C.stat("车道数（≈ 掉头次数）"), len: C.stat("耕作路线长度"), cov: C.stat("覆盖率") };
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.sE, this.cV), this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.out);
      this.update();
    }
    update() {
      this.DB = decompose(false); this.DV = decompose(true);
      const D = this.showV ? this.DV : this.DB;
      this.route = lanes(D, this.eps);
      let nl = 0, len = 0;
      for (const r of this.route) { nl += r.segs.length; r.segs.forEach(([x, a, b], i) => { len += b - a; if (i) len += Math.hypot(x - r.segs[i - 1][0], (i % 2 ? b : a) - (i % 2 ? r.segs[i - 1][2] : r.segs[i - 1][1])); }); }
      // 覆盖率：在自由空间里撒网格点，看离最近车道的水平距离是否 ≤ ε/2
      let tot = 0, cov = 0;
      for (let x = 0.025; x < 10; x += 0.05) for (let y = 0.025; y < 7; y += 0.05) {
        if (!isFree({ x, y })) continue; tot++;
        if (this.route.some((r) => r.segs.some(([lx, a, b]) => Math.abs(lx - x) <= this.eps / 2 + 1e-9 && y >= a - this.eps / 2 && y <= b + this.eps / 2))) cov++;
      }
      this.stats.b.set(this.DB.cells.length); this.stats.v.set(this.DV.cells.length); this.stats.lanes.set(nl); this.stats.len.set(len.toFixed(1)); this.stats.cov.set((100 * cov / tot).toFixed(1) + "%");
      this.out.innerHTML = `牛耕式分解只有 <b>${this.DB.cells.length}</b> 个单元，竖直分解有 ${this.DV.cells.length} 个：多出来的边界会让机器人做不必要的掉头和重新定位。单元不一定是凸的，但总能切成竖条，所以适合来回耕。没覆盖到的主要是贴着斜边和尖角的小三角（单元之间的转移路线不计入长度）。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const D = this.showV ? this.DV : this.DB, tints = [col.accentSoft, col.okSoft, col.warnSoft, col.surface3, col.badSoft];
      st.poly(BOU.outer, col.surface2, col.text2, 1.5);
      // 每个小块其实是梯形：在竖条两端各求一次与它重叠的自由区间
      const at = (x, p) => { let best = null, bo = 0; for (const iv of freeIntervals(x)) { const o = Math.min(iv[1], p.hi) - Math.max(iv[0], p.lo); if (o > bo) { bo = o; best = iv; } } return best || [p.lo, p.hi]; };
      for (const p of D.pieces) { const a = at(p.x0 + 1e-7, p), b = at(p.x1 - 1e-7, p); st.poly([{ x: p.x0, y: a[0] }, { x: p.x1, y: b[0] }, { x: p.x1, y: b[1] }, { x: p.x0, y: a[1] }], C.alpha(tints[p.cell % tints.length], 0.95), null); }
      // 单元边界：同一竖线两侧属于不同单元的地方
      for (let k = 1; k + 1 < D.xs.length; k++) {
        const xb = D.xs[k];
        for (const p of D.pieces.filter((q) => q.k === k)) for (const q of D.pieces.filter((r) => r.k === k - 1)) {
          const lo = Math.max(p.lo, q.lo), hi = Math.min(p.hi, q.hi);
          if (hi > lo && p.cell !== q.cell) st.line({ x: xb, y: lo }, { x: xb, y: hi }, col.text2, 1.2, [4, 3]);
        }
      }
      for (const P of BOU.obs) st.poly(P, C.alpha(col.wall, 0.85), col.wall, 1);
      st.poly(BOU.outer, null, col.text, 1.6);
      const seen = new Set();
      for (const p of D.pieces) if (!seen.has(p.cell)) { seen.add(p.cell); const cell = D.cells[p.cell], q = cell.pieces[Math.floor(cell.pieces.length / 2)]; st.text(String(p.cell + 1), { x: (q.x0 + q.x1) / 2, y: (q.lo + q.hi) / 2 }, col.muted, { size: 12, weight: 700 }); }
      // 耕作路线
      let prev = null;
      for (const r of this.route) {
        r.segs.forEach(([x, a, b], i) => {
          const s = i % 2 ? { x, y: b } : { x, y: a }, e = i % 2 ? { x, y: a } : { x, y: b };
          if (prev) st.line(prev, s, i ? C.alpha(col.path, 0.9) : C.alpha(col.muted, 0.8), i ? 1.6 : 1.2, i ? null : [3, 3]);
          st.line(s, e, col.path, 1.6); prev = e;
        });
      }
    }
  }

  // =================================================================
  // 组件 2：生成树覆盖（Gabriely & Rimon；图 7.37、7.38）
  // =================================================================
  // 粗格子（书中的边长 ε）：. 自由，# 障碍；点击切换。分辨率加倍后每个粗格分成 4 个边长 ε/2 的小格
  const STC_ROWS = [
    "##############",
    "##....########",
    "#........#####",
    "#.............#",
    "##.....##.....",
    "###....##....#",
    "#.............",
    "#............#",
    "##########...#"].map((r) => r.padEnd(14, "#"));
  function stcPlan(free, W, H, start, kind, seed) {
    const id = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    if (!free[start]) return null;
    // 生成树：DFS / BFS / 随机（随机 Prim）
    const parent = new Map([[start, -1]]), tree = [], r = C.rng(seed);
    const nb = (c) => { const x = c % W, y = Math.floor(c / W); return [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([a, b]) => [x + a, y + b]).filter(([a, b]) => inb(a, b) && free[id(a, b)]).map(([a, b]) => id(a, b)); };
    if (kind === "dfs") { const stack = [start]; const vis = new Set(); while (stack.length) { const u = stack.pop(); if (vis.has(u)) continue; vis.add(u); if (parent.get(u) >= 0) tree.push([parent.get(u), u]); for (const v of nb(u).reverse()) if (!vis.has(v)) { parent.set(v, u); stack.push(v); } } }
    else if (kind === "bfs") { const Q = [start]; while (Q.length) { const u = Q.shift(); for (const v of nb(u)) if (!parent.has(v)) { parent.set(v, u); tree.push([u, v]); Q.push(v); } } }
    else { const vis = new Set([start]), F = nb(start).map((v) => [start, v]); while (F.length) { const k = Math.floor(r() * F.length), [u, v] = F[k]; F.splice(k, 1); if (vis.has(v)) continue; vis.add(v); tree.push([u, v]); for (const w of nb(v)) if (!vis.has(w)) F.push([v, w]); } }
    // 小格：粗格 (x, y) 的四个子格（分辨率加倍）。先给每个粗格连一圈，再在树边处「剪开、交叉连接」
    const sid = (x, y) => y * 2 * W + x, E = new Map();
    const addE = (a, b) => { E.set(a + "," + b, [a, b]); }, delE = (a, b) => { E.delete(a + "," + b); E.delete(b + "," + a); };
    const cellsInTree = new Set([start, ...tree.flat()]);
    for (const c of cellsInTree) {
      const x = c % W, y = Math.floor(c / W), BL = sid(2 * x, 2 * y), BR = sid(2 * x + 1, 2 * y), TL = sid(2 * x, 2 * y + 1), TR = sid(2 * x + 1, 2 * y + 1);
      addE(TL, TR); addE(TR, BR); addE(BR, BL); addE(BL, TL);
    }
    for (const [u, v] of tree) {
      const [a, b] = (u % W) + Math.floor(u / W) * 1e6 < (v % W) + Math.floor(v / W) * 1e6 ? [u, v] : [v, u];
      const ax = a % W, ay = Math.floor(a / W), bx = b % W, by = Math.floor(b / W);
      if (by === ay) {   // a 在左，b 在右
        delE(sid(2 * ax + 1, 2 * ay + 1), sid(2 * ax + 1, 2 * ay)); delE(sid(2 * bx, 2 * by + 1), sid(2 * bx, 2 * by));
        addE(sid(2 * ax + 1, 2 * ay + 1), sid(2 * bx, 2 * by + 1)); addE(sid(2 * ax + 1, 2 * ay), sid(2 * bx, 2 * by));
      } else {           // a 在下，b 在上
        delE(sid(2 * ax, 2 * ay + 1), sid(2 * ax + 1, 2 * ay + 1)); delE(sid(2 * bx, 2 * by), sid(2 * bx + 1, 2 * by));
        addE(sid(2 * ax, 2 * ay + 1), sid(2 * bx, 2 * by)); addE(sid(2 * ax + 1, 2 * ay + 1), sid(2 * bx + 1, 2 * by));
      }
    }
    const nbr = new Map(); for (const [a, b] of E.values()) { if (!nbr.has(a)) nbr.set(a, []); if (!nbr.has(b)) nbr.set(b, []); nbr.get(a).push(b); nbr.get(b).push(a); }
    const sx = start % W, sy = Math.floor(start / W), s0 = sid(2 * sx, 2 * sy), cyc = [s0];
    let prev = -1, cur = s0;
    for (let k = 0; k < 4 * cellsInTree.size + 2; k++) { const nx = nbr.get(cur).find((v) => v !== prev); prev = cur; cur = nx; if (cur === s0) break; cyc.push(cur); }
    return { tree, cells: cellsInTree.size, cycle: cyc.map((s) => ({ x: (s % (2 * W)) / 2 + 0.25, y: Math.floor(s / (2 * W)) / 2 + 0.25 })), deg: [...nbr.values()].every((v) => v.length === 2) };
  }

  class SpanningTreeCoverage {
    constructor(root) {
      this.W = 14; this.H = STC_ROWS.length; this.kind = "dfs"; this.seed = 9; this.u = 1; this.showTree = true;
      this.free = new Uint8Array(this.W * this.H);
      STC_ROWS.forEach((row, r) => [...row].forEach((ch, x) => { this.free[(this.H - 1 - r) * this.W + x] = ch === "." ? 1 : 0; }));
      this.start = (this.H - 3) * this.W + 1;
      const body = C.frame(root, "生成树覆盖", "图 7.37、7.38：边长 ε 的方格铺满 C_free，相邻方格中心连成图 G，取一棵生成树；把分辨率加倍，沿树的外围绕一圈。点击方格切换障碍");
      this.st = new C.Stage({ view: [0, this.W, 0, this.H], maxW: 600, aspect: this.H / this.W, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const x = Math.floor(p.x), y = Math.floor(p.y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return null; const c = y * this.W + x; if (c !== this.start) { this.free[c] = 1 - this.free[c]; this.update(); } return null; } });
      this.segK = C.seg([["dfs", "DFS 树"], ["bfs", "BFS 树"], ["rand", "随机树"]], this.kind, (k) => { this.kind = k; this.update(); });
      this.cT = C.check("显示生成树", this.showTree, (v) => { this.showTree = v; this.st.draw(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.st.draw(); }, { label: "沿路线前进", dur: 8, fmt: (u) => Math.round(u * 100) + "%" });
      this.stats = { cells: C.stat("树覆盖的方格"), sub: C.stat("路线经过的小格"), rep: C.stat("重复访问"), len: C.stat("路线长度") };
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segK, this.cT, C.button("换一棵随机树", () => { this.kind = "rand"; this.segK.set("rand"); this.seed = C.newSeed(); this.update(); }, "small")),
        this.st.wrap, this.tl.el, h("div", { class: "stats" }, Object.values(this.stats)), this.out);
      this.update();
    }
    update() {
      this.res = stcPlan(this.free, this.W, this.H, this.start, this.kind, this.seed);
      const r = this.res, free = this.free.reduce((a, b) => a + b, 0);
      this.stats.cells.set(`${r.cells} / ${free}`); this.stats.sub.set(r.cycle.length); this.stats.rep.set(r.cycle.length === 4 * r.cells ? 0 : r.cycle.length - 4 * r.cells);
      this.stats.len.set(`${r.cycle.length} × ε/2 = ${r.cycle.length / 2}ε`);
      this.out.innerHTML = `生成树有 ${r.cells} 个顶点、${r.tree.length} 条边（任何连通图的生成树都能在 O(n) 时间里求出）。沿树的外围走一圈，正好经过 4 × ${r.cells} = ${4 * r.cells} 个小格各一次——在这个近似（只覆盖完整的粗格）下路线是最优的。` +
        (r.cells < free ? ` 有 ${free - r.cells} 个自由粗格和起点不连通，覆盖不到。` : "") + " 换不同的树，路线不同、长度相同；可以按「转弯少」之类的准则挑一棵。";
      this.tl.set(1);
    }
    draw(ctx, st, col) {
      st.frame(col);
      const W = this.W, H = this.H;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const b = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
        if (!this.free[y * W + x]) st.box(b, C.alpha(col.wall, 0.85), null);
        else { st.box(b, col.surface, C.alpha(col.muted, 0.35), 1); st.line({ x: x + 0.5, y }, { x: x + 0.5, y: y + 1 }, C.alpha(col.muted, 0.12), 1); st.line({ x, y: y + 0.5 }, { x: x + 1, y: y + 0.5 }, C.alpha(col.muted, 0.12), 1); }
      }
      const ctr = (c) => ({ x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5 });
      if (this.showTree) { for (const [a, b] of this.res.tree) st.line(ctr(a), ctr(b), C.alpha(col.bad, 0.75), 2.4); for (const c of new Set(this.res.tree.flat())) st.dot(ctr(c), 2.5, col.bad); }
      const P = this.res.cycle, n = Math.max(2, Math.round(this.u * P.length));
      st.polyline(P.slice(0, n).concat(this.u >= 1 ? [P[0]] : []), col.path, 2);
      st.dot(P[Math.min(P.length - 1, n - 1)], 5, col.start, col.surface, 1.5);
      st.dot(ctr(this.start), 4, col.start);
    }
  }

  CH7.coverage = { Boustrophedon, SpanningTreeCoverage, BOU, freeIntervals, decompose, lanes, stcPlan, STC_ROWS };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='boustrophedon']").forEach((el) => el._w = new Boustrophedon(el));
    document.querySelectorAll("[data-widget='stc']").forEach((el) => el._w = new SpanningTreeCoverage(el));
  });
})();
