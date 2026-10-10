/* 第 6 章共用小库：画布舞台、控件、2D 几何、多边形场景、垂直分解 / 柱形分解 / 三角剖分、可见性图 */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange } = PA;

  // ---------------------------------------------------------------
  // 颜色：每次重画时从 CSS 变量读取，深色模式自动生效
  // 约定：灰 = C_obs，绿 = 解路径，蓝 = 单元 / 路线图，橙 = 扫描线 / 事件，紫 = 临界曲线
  // ---------------------------------------------------------------
  const COLOR_VARS = {
    bg: "--bg", surface: "--surface", surface2: "--surface-2", surface3: "--surface-3",
    text: "--text", text2: "--text-2", muted: "--muted", border: "--border", strong: "--border-strong",
    accent: "--accent", accentSoft: "--accent-soft", ok: "--ok", okSoft: "--ok-soft", warn: "--warn", warnSoft: "--warn-soft",
    bad: "--bad", badSoft: "--bad-soft", start: "--c-start", goal: "--c-goal", path: "--c-path", wall: "--c-wall",
    alive: "--c-alive", dead: "--c-dead", alive2: "--c-alive2", dead2: "--c-dead2", current: "--c-current", grid: "--c-grid",
  };
  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
    return o;
  }
  function rgb(hex) {
    hex = (hex || "#888").trim();
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function alpha(hex, a) {
    hex = (hex || "#888").trim();
    if (hex[0] !== "#") return hex;
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  // 给区域着色用的调色板：全部来自 CSS 变量
  const PALETTE = ["accent", "ok", "warn", "alive2", "goal", "dead", "alive", "start", "bad", "path"];

  // 可复现的伪随机数（mulberry32）
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------
  // 2D 几何
  // ---------------------------------------------------------------
  const P = (x, y) => ({ x, y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const EPS = 1e-12;
  function inPoly(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  // 线段 pq 与 ab 在内部真正相交（不算共享端点、不算擦边）
  function properCross(p, q, a, b) {
    const d1 = cross(p, q, a), d2 = cross(p, q, b), d3 = cross(a, b, p), d4 = cross(a, b, q);
    return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
  }
  // 线段 pq 与 ab 相交（含端点接触）
  function segIntersect(p, q, a, b) {
    const d1 = cross(p, q, a), d2 = cross(p, q, b), d3 = cross(a, b, p), d4 = cross(a, b, q);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    const on = (o, s, t) => Math.min(o.x, s.x) - 1e-12 <= t.x && t.x <= Math.max(o.x, s.x) + 1e-12 && Math.min(o.y, s.y) - 1e-12 <= t.y && t.y <= Math.max(o.y, s.y) + 1e-12;
    return (Math.abs(d1) < 1e-12 && on(p, q, a)) || (Math.abs(d2) < 1e-12 && on(p, q, b)) || (Math.abs(d3) < 1e-12 && on(a, b, p)) || (Math.abs(d4) < 1e-12 && on(a, b, q));
  }
  // 沿 p→q 第一次碰到线段 ab 的参数 t，不相交返回 Infinity
  function segHitT(p, q, a, b) {
    const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-14) return Infinity;
    const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den;
    const u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : Infinity;
  }
  function segPointDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
  }
  function polyArea(Q) { let s = 0; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) s += (Q[j].x + Q[i].x) * (Q[j].y - Q[i].y); return s / 2; }
  function centroid(Q) {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) {
      const f = Q[j].x * Q[i].y - Q[i].x * Q[j].y; A += f; cx += (Q[j].x + Q[i].x) * f; cy += (Q[j].y + Q[i].y) * f;
    }
    if (Math.abs(A) < 1e-14) { let sx = 0, sy = 0; Q.forEach((p) => { sx += p.x; sy += p.y; }); return P(sx / Q.length, sy / Q.length); }
    return P(cx / (3 * A), cy / (3 * A));
  }
  // 简单多边形检查：边两两不相交（相邻边除外）
  function isSimple(Q) {
    const n = Q.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segIntersect(Q[i], Q[(i + 1) % n], Q[j], Q[(j + 1) % n])) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // 多边形场景：polys[0] 是外边界；按奇偶规则，自由空间 = 被奇数个多边形包含的点
  // （障碍是外边界里的洞；障碍里还可以再有洞，例如图 6.1 的三角形）
  // ---------------------------------------------------------------
  class Scene {
    constructor(polys, names) {
      this.polys = polys.map((Q) => Q.map((p) => (Array.isArray(p) ? P(p[0], p[1]) : P(p.x, p.y))));
      this.names = names || null;
      this.rebuild();
    }
    rebuild() {
      this.edges = []; this.verts = [];
      let k = 0;
      this.polys.forEach((Q, pi) => {
        Q.forEach((p, i) => {
          this.verts.push({ p, pi, i, id: this.verts.length });
          this.edges.push({ a: p, b: Q[(i + 1) % Q.length], name: this.names ? this.names[k] : "e" + (k + 1), pi, i, id: k });
          k++;
        });
      });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const v of this.verts) { x0 = Math.min(x0, v.p.x); y0 = Math.min(y0, v.p.y); x1 = Math.max(x1, v.p.x); y1 = Math.max(y1, v.p.y); }
      this.box = { x0, y0, x1, y1 };
    }
    clone() { return new Scene(this.polys.map((Q) => Q.map((p) => P(p.x, p.y))), this.names); }
    free(p) { let c = 0; for (const Q of this.polys) if (inPoly(p, Q)) c++; return c % 2 === 1; }
    yAt(e, x) { return e.a.y + ((e.b.y - e.a.y) * (x - e.a.x)) / (e.b.x - e.a.x); }
    vertNeighbors(v) { const Q = this.polys[v.pi], n = Q.length; return [Q[(v.i - 1 + n) % n], Q[(v.i + 1) % n]]; }
    vertId(pi, i) { let k = 0; for (let j = 0; j < pi; j++) k += this.polys[j].length; return k + i; }
    // 移动一个顶点：保持一般位置（x 坐标互不相同）和多边形互不相交，否则拒绝
    tryMove(pi, i, q) {
      const old = this.polys[pi][i];
      const xs = this.verts.filter((v) => !(v.pi === pi && v.i === i)).map((v) => v.p.x);
      let x = q.x;
      for (let it = 0; it < 20 && xs.some((u) => Math.abs(u - x) < 2e-4); it++) x += 3e-4;
      this.polys[pi][i] = P(x, q.y);
      let ok = this.polys.every(isSimple);
      if (ok) {
        // 不同多边形的边不能相交
        outer: for (let a = 0; a < this.polys.length; a++) for (let b = a + 1; b < this.polys.length; b++) {
          const A = this.polys[a], B = this.polys[b];
          for (let s = 0; s < A.length; s++) for (let t = 0; t < B.length; t++) {
            if (segIntersect(A[s], A[(s + 1) % A.length], B[t], B[(t + 1) % B.length])) { ok = false; break outer; }
          }
        }
      }
      if (!ok) { this.polys[pi][i] = old; this.rebuild(); return false; }
      this.rebuild();
      return true;
    }
  }

  // ---------------------------------------------------------------
  // 垂直分解（6.2.2）与柱形分解（6.3.2）
  // 思路：相邻事件之间的竖条被穿过它的边切成若干段；垂直分解把相邻竖条里「下边、上边都相同」的段并成一个梯形
  // ---------------------------------------------------------------
  function decompose(S, cylindrical) {
    const ev = S.verts.slice().sort((a, b) => a.p.x - b.p.x);
    const xs = ev.map((v) => v.p.x);
    const slabs = [];
    for (let k = 0; k + 1 < xs.length; k++) {
      const xm = (xs[k] + xs[k + 1]) / 2;
      const st = S.edges.filter((e) => Math.min(e.a.x, e.b.x) < xm && xm < Math.max(e.a.x, e.b.x));
      st.sort((e1, e2) => S.yAt(e1, xm) - S.yAt(e2, xm));
      const pieces = [], intervals = [];
      for (let j = 0; j + 1 < st.length; j++) {
        const lo = st[j], hi = st[j + 1];
        const fr = S.free(P(xm, (S.yAt(lo, xm) + S.yAt(hi, xm)) / 2));
        intervals.push({ lo, hi, free: fr });
        if (fr) pieces.push({ lo, hi });
      }
      slabs.push({ x0: xs[k], x1: xs[k + 1], L: st, pieces, intervals });
    }
    const cells = [], pieceCell = new Map();
    slabs.forEach((sl, k) => {
      sl.pieces.forEach((pc, j) => {
        let id = -1;
        if (!cylindrical && k > 0) {
          slabs[k - 1].pieces.forEach((pp, jj) => { if (pp.lo === pc.lo && pp.hi === pc.hi) id = pieceCell.get((k - 1) + ":" + jj); });
        }
        if (id < 0) { cells.push({ lo: pc.lo, hi: pc.hi, x0: sl.x0, x1: sl.x1, k0: k }); id = cells.length - 1; }
        else cells[id].x1 = sl.x1;
        pieceCell.set(k + ":" + j, id);
      });
    });
    cells.forEach((c) => {
      c.poly = [P(c.x0, S.yAt(c.lo, c.x0)), P(c.x1, S.yAt(c.lo, c.x1)), P(c.x1, S.yAt(c.hi, c.x1)), P(c.x0, S.yAt(c.hi, c.x0))];
      c.tri = Math.abs(c.poly[0].y - c.poly[3].y) < 1e-9 || Math.abs(c.poly[1].y - c.poly[2].y) < 1e-9;
      c.c = centroid(c.tri ? c.poly.filter((p, i, Q) => i === 0 || dist(p, Q[i - 1]) > 1e-9) : c.poly);
    });
    // 事件：射线、Fig 6.2 的情形、L 的更新方式；1-单元
    const ones = [], events = [];
    ev.forEach((v, k) => {
      const x = v.p.x, Q = S.polys[v.pi], n = Q.length;
      const inc = new Set([S.vertId(v.pi, v.i), S.vertId(v.pi, (v.i - 1 + n) % n)]);
      const st = S.edges.filter((e) => !inc.has(e.id) && Math.min(e.a.x, e.b.x) < x && x < Math.max(e.a.x, e.b.x));
      const ys = st.map((e) => ({ y: S.yAt(e, x), e })).sort((a, b) => a.y - b.y);
      let above = null, below = null;
      for (const o of ys) { if (o.y > v.p.y && !above) above = o; if (o.y < v.p.y) below = o; }
      const up = above && S.free(P(x, (above.y + v.p.y) / 2));
      const down = below && S.free(P(x, (below.y + v.p.y) / 2));
      const [pa, pb] = S.vertNeighbors(v);
      const right = (pa.x > x) + (pb.x > x);
      events.push({ v, k, x, up: !!up, down: !!down, yUp: above ? above.y : null, yDown: below ? below.y : null, eUp: above && above.e, eDown: below && below.e,
        caseNo: up && down ? 1 : up ? 2 : down ? 3 : 4, upd: right === 2 ? "insert" : right === 0 ? "delete" : "replace" });
      const cuts = ys.map((o) => o.y).concat([v.p.y]).sort((a, b) => a - b);
      for (let j = 0; j + 1 < cuts.length; j++) {
        const y0 = cuts[j], y1 = cuts[j + 1];
        if (!S.free(P(x, (y0 + y1) / 2))) continue;
        const touch = Math.abs(y0 - v.p.y) < 1e-12 || Math.abs(y1 - v.p.y) < 1e-12;
        if (!cylindrical && !touch) continue;
        ones.push({ x, y0, y1, k, m: P(x, (y0 + y1) / 2), touch });
      }
    });
    const links = [];
    ones.forEach((o, oi) => {
      for (const side of [o.k - 1, o.k]) {
        if (side < 0 || side >= slabs.length) continue;
        slabs[side].pieces.forEach((pc, j) => {
          if (S.yAt(pc.lo, o.x) - 1e-12 <= o.m.y && o.m.y <= S.yAt(pc.hi, o.x) + 1e-12) links.push([pieceCell.get(side + ":" + j), oi]);
        });
      }
    });
    return { S, ev, xs, slabs, cells, ones, events, links, pieceCell, cylindrical: !!cylindrical };
  }
  function locateCell(D, q) {
    const S = D.S;
    for (let k = 0; k < D.slabs.length; k++) {
      const sl = D.slabs[k];
      if (sl.x0 < q.x && q.x < sl.x1) {
        for (let j = 0; j < sl.pieces.length; j++) {
          const pc = sl.pieces[j];
          if (S.yAt(pc.lo, q.x) < q.y && q.y < S.yAt(pc.hi, q.x)) return D.pieceCell.get(k + ":" + j);
        }
      }
    }
    return -1;
  }

  // ---------------------------------------------------------------
  // 三角剖分（6.3.2）：朴素地逐条加对角线（O(n³)），可选「最短优先」或随机顺序
  // ---------------------------------------------------------------
  function triangulate(S, order, seed) {
    const V = S.verts.map((v) => v.p), n = V.length;
    const E = new Set(), key = (i, j) => (i < j ? i + "," + j : j + "," + i);
    const segs = [];
    S.edges.forEach((e) => {
      const i = S.vertId(e.pi, e.i), j = S.vertId(e.pi, (e.i + 1) % S.polys[e.pi].length);
      E.add(key(i, j)); segs.push([i, j]);
    });
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!E.has(key(i, j))) pairs.push([i, j]);
    if (order === "random") { const r = rng(seed || 7); for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; } }
    else pairs.sort((a, b) => dist(V[a[0]], V[a[1]]) - dist(V[b[0]], V[b[1]]));
    const diags = [];
    let checks = 0;
    for (const [i, j] of pairs) {
      if (!S.free(lerp(V[i], V[j], 0.5))) continue;
      let bad = false;
      for (const [a, b] of segs) { checks++; if (properCross(V[i], V[j], V[a], V[b])) { bad = true; break; } }
      if (bad) continue;
      segs.push([i, j]); E.add(key(i, j)); diags.push([i, j]);
    }
    const adj = Array.from({ length: n }, () => new Set());
    for (const [a, b] of segs) { adj[a].add(b); adj[b].add(a); }
    const tris = [];
    for (let a = 0; a < n; a++) for (const b of adj[a]) {
      if (b <= a) continue;
      for (const c of adj[a]) {
        if (c <= b || !adj[b].has(c)) continue;
        const T = [V[a], V[b], V[c]];
        if (!S.free(centroid(T))) continue;
        let empty = true;
        for (let d = 0; d < n && empty; d++) if (d !== a && d !== b && d !== c && inPoly(V[d], T)) empty = false;
        if (empty) tris.push([a, b, c]);
      }
    }
    // 路线图（图 6.17）：每个三角形和每条对角线（1-单元）一个样本点
    const dIndex = new Map(diags.map((d, i) => [key(d[0], d[1]), i]));
    const links = [];
    tris.forEach((t, ti) => { for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) { const di = dIndex.get(key(a, b)); if (di !== undefined) links.push([ti, di]); } });
    const cells = tris.map((t) => { const poly = t.map((i) => V[i]); return { poly, c: centroid(poly) }; });
    const ones = diags.map(([i, j]) => ({ a: V[i], b: V[j], m: lerp(V[i], V[j], 0.5) }));
    let minAng = 180;
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const a = V[t[k]], b = V[t[(k + 1) % 3]], c = V[t[(k + 2) % 3]];
      const u = P(b.x - a.x, b.y - a.y), w = P(c.x - a.x, c.y - a.y);
      minAng = Math.min(minAng, (Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))))) * 180) / Math.PI);
    }
    return { S, diags, tris, cells, ones, links, checks, minAng };
  }
  function locateTri(T, q) { return T.cells.findIndex((c) => inPoly(q, c.poly)); }

  // ---------------------------------------------------------------
  // 路线图搜索：节点 = 2-单元样本点 + 1-单元样本点；Dijkstra（边长为欧氏长度）
  // ---------------------------------------------------------------
  function cellRoadmapQuery(D, cI, cG, qI, qG) {
    const n2 = D.cells.length, N = n2 + D.ones.length;
    const pos = (u) => (u < n2 ? D.cells[u].c : D.ones[u - n2].m);
    const adj = Array.from({ length: N }, () => []);
    for (const [c, o] of D.links) { adj[c].push(n2 + o); adj[n2 + o].push(c); }
    if (cI < 0 || cG < 0) return null;
    const d = new Float64Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    d[cI] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0) break;
      done[u] = 1;
      if (u === cG) break;
      for (const v of adj[u]) { const w = d[u] + dist(pos(u), pos(v)); if (w < d[v]) { d[v] = w; par[v] = u; } }
    }
    if (d[cG] === Infinity) return { found: false, visited: done.reduce((s, x) => s + x, 0) };
    const seq = [];
    for (let u = cG; u >= 0; u = par[u]) seq.push(u);
    seq.reverse();
    const pts = [qI].concat(seq.map(pos), [qG]);
    let len = 0; for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
    return { found: true, seq, pts, len, visited: done.reduce((s, x) => s + x, 0) };
  }

  // ---------------------------------------------------------------
  // 6.2.4：反射顶点、可见性、左转谓词 (6.2)、双切线测试 (6.1)
  // ---------------------------------------------------------------
  function fl(p1, p2, p3) {
    // det [[1,x1,y1],[1,x2,y2],[1,x3,y3]] > 0
    return (p2.x * p3.y - p3.x * p2.y) - (p1.x * p3.y - p3.x * p1.y) + (p1.x * p2.y - p2.x * p1.y) > 0;
  }
  function detM(p1, p2, p3) { return (p2.x * p3.y - p3.x * p2.y) - (p1.x * p3.y - p3.x * p1.y) + (p1.x * p2.y - p2.x * p1.y); }
  function bitangent61(p1, p2, p3, p4, p5, p6) { return !((fl(p1, p2, p5) !== fl(p3, p2, p5)) || (fl(p4, p5, p2) !== fl(p6, p5, p2))); }
  function reflexVerts(S) {
    const out = [];
    for (const v of S.verts) {
      const [a, b] = S.vertNeighbors(v);
      const u = P(a.x - v.p.x, a.y - v.p.y), w = P(b.x - v.p.x, b.y - v.p.y);
      const lu = Math.hypot(u.x, u.y), lw = Math.hypot(w.x, w.y);
      let d = P(u.x / lu + w.x / lw, u.y / lu + w.y / lw); const ld = Math.hypot(d.x, d.y) || 1;
      if (!S.free(P(v.p.x + (1e-6 * d.x) / ld, v.p.y + (1e-6 * d.y) / ld))) out.push(v.id);
    }
    return out;
  }
  function isEdge(S, p, q) { return S.edges.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p)); }
  function visible(S, p, q) {
    if (isEdge(S, p, q)) return true;
    for (const e of S.edges) if (properCross(p, q, e.a, e.b)) return false;
    for (const t of [0.5, 0.25, 0.75]) if (!S.free(lerp(p, q, t))) return false;
    return true;
  }
  function spRoadmap(S) {
    const R = reflexVerts(S), V = S.verts;
    const E = [];
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const a = V[R[i]], b = V[R[j]];
      if (!visible(S, a.p, b.p)) continue;
      if (isEdge(S, a.p, b.p)) { E.push({ a: a.id, b: b.id, kind: "edge" }); continue; }
      const [a1, a2] = S.vertNeighbors(a), [b1, b2] = S.vertNeighbors(b);
      if (bitangent61(a1, a.p, a2, b1, b.p, b2)) E.push({ a: a.id, b: b.id, kind: "bitangent" });
    }
    return { R, E };
  }
  function fullVisibility(S) {
    const V = S.verts, E = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (visible(S, V[i].p, V[j].p)) E.push({ a: i, b: j, kind: isEdge(S, V[i].p, V[j].p) ? "edge" : "vis" });
    return { R: V.map((v) => v.id), E };
  }
  // 扩展路线图上的最短路：qI、qG 连到所有可见的路线图顶点（图 6.12），Dijkstra（图 6.13）
  function spQuery(S, G, qI, qG) {
    const V = S.verts, nodes = G.R.slice(), N = nodes.length + 2, I = N - 2, T = N - 1;
    const pos = (u) => (u === I ? qI : u === T ? qG : V[nodes[u]].p);
    const idx = new Map(nodes.map((v, k) => [v, k]));
    const adj = Array.from({ length: N }, () => []);
    for (const e of G.E) { const a = idx.get(e.a), b = idx.get(e.b), w = dist(V[e.a].p, V[e.b].p); adj[a].push([b, w]); adj[b].push([a, w]); }
    const qEdges = [];
    for (const s of [I, T]) for (let k = 0; k < nodes.length; k++) if (visible(S, pos(s), pos(k))) { const w = dist(pos(s), pos(k)); adj[s].push([k, w]); adj[k].push([s, w]); qEdges.push([s, k]); }
    if (visible(S, qI, qG)) { adj[I].push([T, dist(qI, qG)]); adj[T].push([I, dist(qI, qG)]); qEdges.push([I, T]); }
    const d = new Float64Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    d[I] = 0;
    for (;;) {
      let u = -1; for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || u === T) break; done[u] = 1;
      for (const [v, w] of adj[u]) if (d[u] + w < d[v]) { d[v] = d[u] + w; par[v] = u; }
    }
    const qe = qEdges.map(([a, b]) => [pos(a), pos(b)]);
    if (d[T] === Infinity) return { found: false, qEdges: qe };
    const pts = []; for (let u = T; u >= 0; u = par[u]) pts.push(pos(u));
    return { found: true, pts: pts.reverse(), len: d[T], qEdges: qe };
  }

  // ---------------------------------------------------------------
  // 示例场景（坐标单位任意；Stage 自动缩放）
  // ---------------------------------------------------------------
  const px66 = (x, y) => [(x - 106) / 256, (395 - y) / 256];
  const SCENES = {
    fig66: {
      name: "图 6.6 的例子",
      // 按原图像素位置重建；边名与图 6.6、6.7 一致
      polys: [
        [px66(106, 139), px66(129, 395), px66(467, 395), px66(411, 139)],
        [px66(152, 318), px66(184, 183), px66(272, 160), px66(207, 243), px66(289, 373)],
        [px66(248, 262), px66(345, 232), px66(317, 187), px66(398, 193), px66(362, 326)],
      ],
      names: ["a", "d", "c", "b", "e", "i", "h", "g", "f", "n", "m", "l", "k", "j"],
      qI: [0.37, 0.88], qG: [1.17, 0.12],
    },
    fig61: {
      name: "图 6.1 风格（带洞的障碍）",
      polys: [
        [[0.03, 0.775], [0.4925, 0.705], [1.025, 0.78], [1.125, 0.1425], [0.045, 0.045]],   // 外边界：顶边中间有个凹口
        [[0.095, 0.4425], [0.3925, 0.22], [0.5075, 0.4375], [0.3175, 0.645]],
        [[0.565, 0.655], [0.645, 0.4375], [0.488, 0.22], [0.925, 0.15], [0.9675, 0.67]],
        [[0.71, 0.3575], [0.7425, 0.2325], [0.85, 0.32]],
      ],
      qI: [0.2, 0.68], qG: [1.05, 0.25],
    },
    corridor: {
      name: "走廊与房间",
      polys: [
        [[0, 0], [1.4, 0.02], [1.38, 1], [0.02, 0.98]],
        [[0.2, 0.18], [0.55, 0.12], [0.6, 0.42], [0.35, 0.5], [0.22, 0.38]],
        [[0.75, 0.6], [1.05, 0.45], [1.2, 0.72], [0.92, 0.86]],
        [[0.3, 0.68], [0.52, 0.62], [0.58, 0.88], [0.36, 0.85]],
        [[0.8, 0.12], [1.18, 0.16], [1.0, 0.3]],
      ],
      qI: [0.08, 0.08], qG: [1.3, 0.92],
    },
    spmap: {
      name: "最短路例子",
      polys: [
        [[0, 0], [1.5, 0.05], [1.45, 1.0], [0.75, 0.92], [0.02, 1.02]],
        [[0.15, 0.35], [0.25, 0.2], [0.45, 0.25], [0.33, 0.45], [0.42, 0.65], [0.22, 0.7]],
        [[0.62, 0.15], [0.78, 0.18], [0.72, 0.7]],
        [[0.95, 0.45], [1.2, 0.3], [1.3, 0.55], [1.08, 0.75]],
        [[0.52, 0.78], [0.66, 0.84], [0.55, 0.88]],
      ],
      qI: [0.07, 0.1], qG: [1.38, 0.88],
    },
  };
  function makeScene(key) { const s = SCENES[key]; const S = new Scene(s.polys, s.names); S.key = key; S.title = s.name; S.qI = P(...s.qI); S.qG = P(...s.qG); return S; }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 0.72, maxW: 620, minW: 220, view: [0, 1, 0, 1], pad: 8 }, opts);
      this.wrap = h("div", { class: "ch6-stage" });
      this.canvas = h("canvas");
      this.wrap.append(this.canvas);
      this.view = this.o.view;
      this.drag = null;
      this.bind();
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.wrap);
      onThemeChange(() => this.draw());
      requestAnimationFrame(() => this.resize());
    }
    resize() {
      if (!this.wrap.clientWidth) return;
      const w = Math.max(this.o.minW, Math.min(this.o.maxW, this.wrap.clientWidth));
      if (w === this.W && this.ctx) return;
      this.W = w; this.H = Math.round(w * this.o.aspect);
      this.ctx = fitCanvas(this.canvas, this.W, this.H);
      this.draw();
    }
    setView(v) { this.view = v; }
    fitScene(S, m) {
      m = m === undefined ? 0.04 : m;
      const b = S.box, w = b.x1 - b.x0, hh = b.y1 - b.y0;
      this.view = [b.x0 - m * w, b.x1 + m * w, b.y0 - m * hh, b.y1 + m * hh];
    }
    get scale() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; return Math.min((this.W - 2 * p) / (x1 - x0), (this.H - 2 * p) / (y1 - y0)); }
    X(x) { const [x0, x1] = this.view, s = this.scale; return (this.W - (x1 - x0) * s) / 2 + (x - x0) * s; }
    Y(y) { const [, , y0, y1] = this.view, s = this.scale; return (this.H + (y1 - y0) * s) / 2 - (y - y0) * s; }
    inv(px, py) {
      const [x0, x1, y0, y1] = this.view, s = this.scale;
      return { x: (px - (this.W - (x1 - x0) * s) / 2) / s + x0, y: ((this.H + (y1 - y0) * s) / 2 - py) / s + y0 };
    }
    draw() {
      if (!this.ctx) return;
      this.col = colors(this.wrap);
      this.ctx.clearRect(0, 0, this.W, this.H);
      if (this.o.onDraw) this.o.onDraw(this.ctx, this, this.col);
    }
    bind() {
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); return this.inv(e.clientX - r.left, e.clientY - r.top); };
      c.addEventListener("pointerdown", (e) => {
        if (!this.o.onDown) return;
        const d = this.o.onDown(pos(e), e);
        if (d) { this.drag = d; c.setPointerCapture(e.pointerId); e.preventDefault(); }
      });
      c.addEventListener("pointermove", (e) => {
        const p = pos(e);
        if (this.drag) { if (this.o.onMove) this.o.onMove(p, this.drag, e); }
        else if (this.o.onHover) this.o.onHover(p, e);
        if (this.o.cursor) c.style.cursor = this.drag ? "grabbing" : (this.o.cursor(p) || "default");
      });
      const up = (e) => { if (this.drag) { const d = this.drag; this.drag = null; if (this.o.onUp) this.o.onUp(pos(e), d, e); } };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("pointerleave", (e) => { if (!this.drag && this.o.onLeave) this.o.onLeave(e); });
    }
    // 常用画法（坐标都是世界坐标）
    pxDist(a, b) { return Math.hypot(this.X(a.x) - this.X(b.x), this.Y(a.y) - this.Y(b.y)); }
    near(p, q, px) { return this.pxDist(p, q) < (px || 10); }
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    path(pts, color, lw, dash, close) {
      if (!pts.length) return;
      const ctx = this.ctx; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      if (close) ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    poly(Q, fill, stroke, lw, dash) {
      const ctx = this.ctx; ctx.beginPath();
      Q.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    arrow(a, b, color, lw, head) {
      const ctx = this.ctx, x1 = this.X(a.x), y1 = this.Y(a.y), x2 = this.X(b.x), y2 = this.Y(b.y);
      const ang = Math.atan2(y2 - y1, x2 - x1), hd = head || 8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hd * Math.cos(ang - 0.4), y2 - hd * Math.sin(ang - 0.4)); ctx.lineTo(x2 - hd * Math.cos(ang + 0.4), y2 - hd * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    // 画场景：外边界之外和障碍画成灰色（C_obs），自由空间画成 surface
    scene(S, col, opts) {
      const o = Object.assign({ edgeNames: false, verts: false, alphaObs: 0.78 }, opts);
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = alpha(col.wall, o.alphaObs * 0.55);
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.beginPath();
      for (const Q of S.polys) Q.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.fillStyle = col.surface;
      ctx.fill("evenodd");
      // 障碍（第 1 个以后的多边形）再盖一层，内部的洞用 evenodd 留出来
      ctx.beginPath();
      for (let k = 1; k < S.polys.length; k++) S.polys[k].forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.fillStyle = alpha(col.wall, o.alphaObs);
      ctx.fill("evenodd");
      ctx.restore();
      for (const e of S.edges) this.line(e.a, e.b, col.wall, 1.4);
      if (o.edgeNames) for (const e of S.edges) {
        const m = lerp(e.a, e.b, 0.5), dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, L = Math.hypot(dx, dy) || 1;
        // 名字放在自由空间一侧
        let nx = -dy / L, ny = dx / L;
        if (!S.free(P(m.x + nx * 1e-3, m.y + ny * 1e-3))) { nx = -nx; ny = -ny; }
        const off = 11 / this.scale;
        this.text(e.name, P(m.x + nx * off, m.y + ny * off), col.text2, { size: 12, weight: 600 });
      }
      if (o.verts) for (const v of S.verts) this.dot(v.p, 3, col.wall);
    }
    qmark(p, kind, col, label) {
      const c = kind === "I" ? col.start : col.goal;
      this.dot(p, 6.5, c, col.surface, 2);
      this.text(label || (kind === "I" ? "qI" : "qG"), p, c, { dy: -14, size: 12, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件外框 & 小控件（与第 5 章同一套样式）
  // ---------------------------------------------------------------
  function frame(root, title, sub) {
    const body = h("div", { class: "widget-body" });
    root.append(h("div", { class: "widget-head" }, h("span", { class: "w-title" }, title), sub ? h("span", { class: "w-sub" }, sub) : null, h("span", { class: "w-badge" }, "互动")), body);
    return body;
  }
  function seg(options, value, onChange) {
    const el = h("div", { class: "seg" });
    const btns = options.map(([k, t]) => {
      const b = h("button", { type: "button", class: k === value ? "on" : "" }, t);
      b.addEventListener("click", () => { btns.forEach((x) => x.classList.toggle("on", x === b)); onChange(k); });
      el.append(b); return b;
    });
    el.set = (k) => btns.forEach((b, i) => b.classList.toggle("on", options[i][0] === k));
    return el;
  }
  function slider(label, min, max, step, value, onInput, fmtFn) {
    const out = h("b", { class: "mono" });
    const inp = h("input", { type: "range", min, max, step, value });
    const show = () => { out.textContent = fmtFn ? fmtFn(+inp.value) : inp.value; };
    inp.addEventListener("input", () => { show(); onInput(+inp.value); });
    show();
    const lab = h("label", null, label, inp, out);
    lab.input = inp; lab.refresh = show;
    lab.set = (v) => { inp.value = v; show(); };
    return lab;
  }
  function select(options, value, onChange) {
    const el = h("select");
    options.forEach(([k, t]) => el.append(h("option", { value: k, selected: k === value ? true : null }, t)));
    el.addEventListener("change", () => onChange(el.value));
    return el;
  }
  function check(label, value, onChange, title) {
    const cb = h("input", { type: "checkbox", checked: value ? true : null });
    cb.addEventListener("change", () => onChange(cb.checked));
    const lab = h("label", { title: title || null }, cb, label);
    lab.input = cb;
    return lab;
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; this.last = 0; this.interval = 0; }
    start(interval) {
      if (this.running) return; this.running = true; this.interval = interval || 0; this.last = 0;
      const loop = (t) => {
        if (!this.running) return;
        if (!this.interval || t - this.last >= this.interval) { this.last = t; if (this.step() === false) { this.stop(); return; } }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // 拖动场景顶点的通用处理：返回 Stage 的 onDown/onMove 片段
  function vertexDragger(getScene, onChange, stageRef) {
    return {
      onDown: (p) => {
        const S = getScene(), st = stageRef();
        let best = null, bd = 11;
        for (const v of S.verts) { const d = st.pxDist(p, v.p); if (d < bd) { bd = d; best = v; } }
        return best ? { kind: "v", pi: best.pi, i: best.i } : null;
      },
      onMove: (p, d) => { if (d.kind !== "v") return false; const ok = getScene().tryMove(d.pi, d.i, p); if (ok) onChange(); return true; },
      hover: (p) => getScene().verts.some((v) => stageRef().pxDist(p, v.p) < 11),
    };
  }

  // 隐函数 f(x, y) = 0 的等值线（marching squares），返回线段列表 [[a, b], ...]
  function contour(f, box, nx, ny) {
    const { x0, x1, y0, y1 } = box, dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
    const val = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) val[j * (nx + 1) + i] = f(x0 + i * dx, y0 + j * dy);
    const segs = [];
    const at = (i, j) => val[j * (nx + 1) + i];
    const ip = (xa, ya, va, xb, yb, vb) => { const t = va / (va - vb); return P(xa + (xb - xa) * t, ya + (yb - ya) * t); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const xa = x0 + i * dx, ya = y0 + j * dy, xb = xa + dx, yb = ya + dy;
      const v00 = at(i, j), v10 = at(i + 1, j), v11 = at(i + 1, j + 1), v01 = at(i, j + 1);
      if (!isFinite(v00 + v10 + v11 + v01)) continue;
      const pts = [];
      if ((v00 > 0) !== (v10 > 0)) pts.push(ip(xa, ya, v00, xb, ya, v10));
      if ((v10 > 0) !== (v11 > 0)) pts.push(ip(xb, ya, v10, xb, yb, v11));
      if ((v11 > 0) !== (v01 > 0)) pts.push(ip(xb, yb, v11, xa, yb, v01));
      if ((v01 > 0) !== (v00 > 0)) pts.push(ip(xa, yb, v01, xa, ya, v00));
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
    }
    return segs;
  }

  window.CH6 = {
    contour,
    colors, alpha, rgb, PALETTE, rng, P, dist, lerp, cross, inPoly, properCross, segIntersect, segHitT, segPointDist, polyArea, centroid, isSimple,
    Scene, SCENES, makeScene, decompose, locateCell, triangulate, locateTri, cellRoadmapQuery,
    fl, detM, bitangent61, reflexVerts, visible, isEdge, spRoadmap, fullVisibility, spQuery,
    Stage, frame, seg, slider, select, check, stat, button, legend, Runner, cv, cva, vertexDragger,
  };
})();
