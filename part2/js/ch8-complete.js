/* 8.4.1–8.4.3 节：势函数与梯度下降、单元复形上的向量场、平面多边形里的最优导航函数 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;

  // =================================================================
  // 组件 9：势函数 φ = φ_a + φ_r 与梯度下降（例 8.17、8.4.1 节末尾）
  // =================================================================
  class Potential {
    constructor(root) {
      this.mode = "attrep"; this.eta = 0.004; this.rho0 = 0.12; this.goal = { x: .86, y: .5 };
      this.discs = [{ x: .5, y: .5, r: .07 }, { x: .5, y: .34, r: .07 }, { x: .5, y: .66, r: .07 }, { x: .43, y: .22, r: .06 }, { x: .43, y: .78, r: .06 }];
      this.runs = []; this.cloud = null;
      const body = C.frame(root, "势函数与梯度下降", "π(x) = −∇φ|ₓ：沿最速下降方向走；拖动目标和圆盘障碍，点击放起点");
      this.st = new C.Stage({ maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => {
          if (C.dist(p, this.goal) < .03) return "G";
          if (this.mode !== "quad") for (const d of this.discs) if (C.dist(p, d) < d.r) return d;
          this.runs.push(this.descend(p)); if (this.runs.length > 6) this.runs.shift(); this.cloud = null; this.summary(); this.st.draw(); return null;
        },
        onMove: (p, d) => { if (d === "G") this.goal = { x: C.clamp(p.x, .02, .98), y: C.clamp(p.y, .02, .98) }; else { d.x = C.clamp(p.x, .05, .95); d.y = C.clamp(p.y, .05, .95); } this.rerun(); },
        cursor: (p) => (C.dist(p, this.goal) < .03 || (this.mode !== "quad" && this.discs.some((d) => C.dist(p, d) < d.r)) ? "grab" : "crosshair") });
      this.segM = C.seg([["quad", "例 8.17：二次势（无障碍）"], ["attrep", "吸引 + 排斥（补充：Khatib 式公式）"]], this.mode, (k) => { this.mode = k; this.rerun(); this.syncCtl(); });
      this.sEta = C.slider("排斥增益 η", 0, 0.02, 0.0005, this.eta, (v) => { this.eta = v; this.rerun(); }, (v) => v.toFixed(4));
      this.sRho = C.slider("影响半径 ρ₀", 0.03, 0.3, 0.01, this.rho0, (v) => { this.rho0 = v; this.rerun(); }, (v) => v.toFixed(2));
      this.ctl = h("div", { class: "controls" }, this.sEta, this.sRho);
      this.stats = { trap: C.stat("撒点：困在局部极小 / 总数"), last: C.stat("最后一次下降") };
      body.append(h("div", { class: "controls" }, this.segM), this.ctl,
        h("div", { class: "controls" }, C.button("从 120 个起点各下降一次", () => this.spray(), "primary"), C.button("清空", () => { this.runs = []; this.cloud = null; this.summary(); this.st.draw(); }, "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("p", { class: "small muted", style: "margin:6px 0" }, "背景是 φ 的等值线（越深越高），针是 −∇φ 的方向。排斥项只在离障碍 ρ₀ 以内起作用：φ_r = ½η(1/d − 1/ρ₀)²，d 是到圆盘边界的距离。"),
          C.legend([[C.cv("path"), "到达目标"], [C.cv("bad"), "困在局部极小（✕）"], [C.cv("warn"), "撞上障碍（η = 0 时）"], [C.cva("accent", .6), "−∇φ 方向"]]))));
      this.syncCtl(); this.summary();
    }
    syncCtl() { this.ctl.style.display = this.mode === "quad" ? "none" : ""; }
    inObs(p) { if (this.mode === "quad") return false; return this.discs.some((d) => C.dist(p, d) <= d.r); }
    phi(p) {
      const g = this.goal;
      let v = .5 * ((p.x - g.x) ** 2 + (p.y - g.y) ** 2);
      if (this.mode === "quad") return v;
      for (const d of this.discs) { const dd = C.dist(p, d) - d.r; if (dd <= 0) return Infinity; if (dd < this.rho0) v += .5 * this.eta * (1 / dd - 1 / this.rho0) ** 2; }
      return v;
    }
    grad(p) {
      const g = this.goal; let gx = p.x - g.x, gy = p.y - g.y;
      if (this.mode !== "quad") for (const d of this.discs) {
        const r = C.dist(p, d), dd = r - d.r; if (dd <= 0) return null;
        if (dd < this.rho0) { const k = -this.eta * (1 / dd - 1 / this.rho0) / (dd * dd); gx += k * (p.x - d.x) / r; gy += k * (p.y - d.y) / r; }
      }
      return { x: gx, y: gy };
    }
    // 归一化步长的梯度下降；在一小块区域里来回打转就判为困住
    descend(p0) {
      const pts = [p0]; let p = p0, res = "run";
      if (this.inObs(p0)) return { pts, res: "obs" };
      for (let k = 0; k < 1500; k++) {
        if (C.dist(p, this.goal) < .012) { res = "goal"; break; }
        const g = this.grad(p); if (!g) { res = "obs"; break; }
        const n = Math.hypot(g.x, g.y); if (n < 1e-7) { res = "trap"; break; }
        const step = Math.min(.004, n);
        p = { x: p.x - step * g.x / n, y: p.y - step * g.y / n }; pts.push(p);
        if (k > 150 && k % 50 === 0 && C.dist(p, pts[pts.length - 101]) < .01) { res = "trap"; break; }
      }
      if (res === "run") res = C.dist(p, this.goal) < .03 ? "goal" : "trap";
      return { pts, res };
    }
    rerun() { this.runs = this.runs.map((r) => this.descend(r.pts[0])); if (this.cloud) this.spray(true); else { this.summary(); this.st.draw(); } }
    spray(quiet) {
      const r = C.rng(17), out = [];
      while (out.length < 120) { const p = { x: .03 + .94 * r(), y: .03 + .94 * r() }; if (this.inObs(p) || this.phi(p) === Infinity) continue; const d = this.descend(p); out.push({ p, res: d.res, end: d.pts[d.pts.length - 1] }); }
      this.cloud = out; this.summary(); this.st.draw();
    }
    summary() {
      if (this.cloud) { const t = this.cloud.filter((c) => c.res === "trap").length, o = this.cloud.filter((c) => c.res === "obs").length; this.stats.trap.set(`${t} / ${this.cloud.length}` + (o ? `<span class="small muted">（另有 ${o} 个撞上障碍）</span>` : "")); } else this.stats.trap.set("—");
      const r = this.runs[this.runs.length - 1];
      this.stats.last.set(!r ? "点画布" : r.res === "goal" ? '<span class="yes">到达</span>' : r.res === "obs" ? "起点在障碍里" : `<span class="no">困在 (${r.pts[r.pts.length - 1].x.toFixed(2)}, ${r.pts[r.pts.length - 1].y.toFixed(2)})</span>`);
    }
    draw(ctx, st, col) {
      st.frame(col);
      const N = 120, F = C.sampleField((p) => { const v = this.phi(p); return isFinite(v) ? Math.log(v + 1e-4) : Infinity; }, N, N, [0, 1, 0, 1]);
      st.heat(F.vals, N, N, (v) => (v - F.min) / (F.max - F.min || 1), col, { bands: 14 });
      const levels = []; for (let k = 1; k < 14; k++) levels.push(F.min + (F.max - F.min) * k / 14);
      st.contours(F.vals, N, N, levels, C.alpha(col.muted, .35), 1);
      st.needles((p) => { if (this.inObs(p)) return null; const g = this.grad(p); return g ? { x: -g.x, y: -g.y } : null; }, col, { n: 18, color: C.alpha(col.accent, .55), lw: 1, head: 3.5 });
      if (this.mode !== "quad") for (const d of this.discs) { st.circle(d, d.r, C.alpha(col.wall, .85), col.wall, 1); if (this.eta > 0) st.circle(d, d.r + this.rho0, null, C.alpha(col.wall, .35), 1, [3, 3]); }
      if (this.cloud) for (const c of this.cloud) { st.dot(c.p, 2.6, c.res === "goal" ? C.alpha(col.path, .8) : c.res === "obs" ? col.warn : col.bad); if (c.res === "trap") st.xmark(c.end, col.bad, 4); }
      for (const r of this.runs) { st.polyline(r.pts, r.res === "goal" ? col.path : col.bad, 2.4); st.dot(r.pts[0], 4.5, col.start, col.surface, 1.5); if (r.res === "trap") st.xmark(r.pts[r.pts.length - 1], col.bad, 6); }
      st.qmark(this.goal, "G", col);
    }
  }

  // =================================================================
  // 三角剖分：耳切法（洞用「桥」接进外边界）+ Lawson 翻边改善形状
  // =================================================================
  function triangulate(outer, holes) {
    const V = [], add = (p) => { V.push(p); return V.length - 1; };
    const orient = (P, wantCCW) => (C.polyArea(P) > 0) === wantCCW ? P.slice() : P.slice().reverse();
    let ring = orient(outer, true).map(add);
    const H = holes.map((P) => orient(P, false).map(add));
    H.sort((a, b) => Math.max(...b.map((i) => V[i].x)) - Math.max(...a.map((i) => V[i].x)));
    const allHoleSegs = () => { const s = []; for (const hh of H) for (let i = 0; i < hh.length; i++) s.push([V[hh[i]], V[hh[(i + 1) % hh.length]]]); return s; };
    for (const hole of H) {
      let mi = 0; hole.forEach((id, i) => { if (V[id].x > V[hole[mi]].x) mi = i; });
      const M = V[hole[mi]];
      const segs = allHoleSegs(); for (let i = 0; i < ring.length; i++) segs.push([V[ring[i]], V[ring[(i + 1) % ring.length]]]);
      const cand = ring.map((id, k) => ({ id, k, d: C.dist(V[id], M) })).sort((a, b) => a.d - b.d);
      let pick = null;
      for (const c of cand) { const P = V[c.id]; if (segs.some(([a, b]) => C.segCross(M, P, a, b))) continue; pick = c; break; }
      const k = pick.k, rot = hole.slice(mi).concat(hole.slice(0, mi));
      ring = ring.slice(0, k + 1).concat(rot, [hole[mi], ring[k]], ring.slice(k + 1));
    }
    const same = (a, b) => Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12;
    const inTri = (p, a, b, c) => C.cross(a, b, p) >= -1e-12 && C.cross(b, c, p) >= -1e-12 && C.cross(c, a, p) >= -1e-12;
    const poly = ring.slice(), tris = [];
    for (let guard = 0; poly.length > 3 && guard < 100000; guard++) {
      let found = false; const n = poly.length;
      for (let i = 0; i < n; i++) {
        const a = poly[(i - 1 + n) % n], b = poly[i], c = poly[(i + 1) % n];
        if (C.cross(V[a], V[b], V[c]) <= 1e-12) continue;
        let ok = true;
        for (const d of poly) { if (d === a || d === b || d === c) continue; const P = V[d]; if (same(P, V[a]) || same(P, V[b]) || same(P, V[c])) continue; if (inTri(P, V[a], V[b], V[c])) { ok = false; break; } }
        if (!ok) continue;
        tris.push([a, b, c]); poly.splice(i, 1); found = true; break;
      }
      if (!found) break;
    }
    if (poly.length === 3) tris.push(poly.slice());
    // Lawson 翻边：内部边若违反空圆性质就翻转（边界边只属于一个三角形，不会被翻）
    const incircle = (a, b, c, d) => {
      const ax = a.x - d.x, ay = a.y - d.y, bx = b.x - d.x, by = b.y - d.y, cx = c.x - d.x, cy = c.y - d.y;
      return (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
    };
    for (let pass = 0; pass < 200; pass++) {
      const em = new Map(); let flipped = false;
      tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const u = t[e], v = t[(e + 1) % 3], key = u < v ? u + "," + v : v + "," + u; if (!em.has(key)) em.set(key, []); em.get(key).push(ti); } });
      for (const [key, ts] of em) {
        if (ts.length !== 2) continue;
        const [u, v] = key.split(",").map(Number), T1 = tris[ts[0]], T2 = tris[ts[1]];
        const w1 = T1.find((x) => x !== u && x !== v), w2 = T2.find((x) => x !== u && x !== v);
        if (!C.segCross(V[u], V[v], V[w1], V[w2])) continue;
        const t1 = C.cross(V[u], V[v], V[w1]) > 0 ? [u, v, w1] : [v, u, w1];
        if (incircle(V[t1[0]], V[t1[1]], V[t1[2]], V[w2]) > 1e-12) {
          const n1 = [w1, w2, u], n2 = [w2, w1, v];
          if (C.cross(V[n1[0]], V[n1[1]], V[n1[2]]) < 0) n1.reverse();
          if (C.cross(V[n2[0]], V[n2[1]], V[n2[2]]) < 0) n2.reverse();
          tris[ts[0]] = n1; tris[ts[1]] = n2; flipped = true; break;
        }
      }
      if (!flipped) break;
    }
    return { V, tris: tris.map((t) => (C.cross(V[t[0]], V[t[1]], V[t[2]]) < 0 ? [t[0], t[2], t[1]] : t)) };
  }

  // =================================================================
  // 组件 10：单元复形上的向量场（8.4.2 节，图 8.10、8.11）
  // =================================================================
  // 外边界上多放几个共线顶点，免得剖分出横跨整张图的细长三角形
  const CELL_OUTER = [[0, 0], [.25, 0], [.5, 0], [.75, 0], [1, 0], [1, .35], [1, .7], [.75, .7], [.5, .7], [.25, .7], [0, .7], [0, .35]].map(([x, y]) => ({ x, y }));
  const CELL_HOLES = [
    [{ x: .12, y: .14 }, { x: .32, y: .1 }, { x: .36, y: .19 }, { x: .21, y: .23 }, { x: .23, y: .4 }, { x: .36, y: .45 }, { x: .3, y: .55 }, { x: .11, y: .5 }],
    [{ x: .54, y: .12 }, { x: .66, y: .1 }, { x: .6, y: .58 }],
    [{ x: .72, y: .4 }, { x: .84, y: .46 }, { x: .8, y: .6 }, { x: .7, y: .55 }],
    [{ x: .84, y: .12 }, { x: .94, y: .16 }, { x: .9, y: .27 }],
  ];
  class CellComplex {
    constructor(root) {
      this.goal = { x: .92, y: .36 }; this.click = "start"; this.showNeedles = false; this.showNum = false; this.hover = -1; this.repMode = "book";
      this.region = new C.Region(CELL_OUTER, CELL_HOLES);
      const T = triangulate(CELL_OUTER, CELL_HOLES); this.V = T.V; this.tris = T.tris;
      this.build();
      const body = C.frame(root, "三角剖分上的向量场", "离散计划决定「下一个三角形」；每个三角形里从「排斥顶点」往外推，把状态推过出口边");
      this.st = new C.Stage({ view: [0, 1, 0, .7], aspect: .7, maxW: 600, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { if (!this.region.inside(p)) return null; if (this.click === "goal") { this.goal = p; this.plan(); } else { this.starts = [p]; this.flow(); } this.st.draw(); return null; },
        onHover: (p) => { const t = this.locate(p); if (t !== this.hover) { this.hover = t; this.st.draw(); } },
        onLeave: () => { this.hover = -1; this.st.draw(); } });
      this.segC = C.seg([["start", "点击：放起点（画积分曲线）"], ["goal", "点击：移动目标 x_G"]], this.click, (k) => { this.click = k; });
      this.cbN = C.check("针状图", false, (v) => { this.showNeedles = v; this.st.draw(); });
      this.cbS = C.check("显示离散导航函数 φ̌", false, (v) => { this.showNum = v; this.st.draw(); });
      this.stats = { n: C.stat("三角形（2-cell）数"), g: C.stat("目标三角形"), r: C.stat("积分曲线"), e: C.stat("其中贴着三角形边走的比例") };
      this.segR = C.seg([["book", "排斥点 = 排斥顶点（书中）"], ["off", "补充：挪到顶点外侧一点"]], this.repMode, (k) => { this.repMode = k; this.flow(); this.st.draw(); });
      body.append(h("div", { class: "controls" }, this.segR), h("div", { class: "controls" }, this.segC, C.button("撒 40 个起点", () => { const r = C.rng(4); this.starts = []; while (this.starts.length < 40) { const p = { x: r(), y: .7 * r() }; if (this.region.inside(p)) this.starts.push(p); } this.flow(); this.st.draw(); }), this.cbN, this.cbS),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
        C.legend([[C.cv("warn"), "出口边 exit face"], [C.cv("bad"), "排斥顶点（鼠标所在三角形）"], [C.cva("goal", .35), "含 x_G 的三角形"], [C.cv("path"), "积分曲线"]]));
      this.starts = [{ x: .05, y: .64 }];
      this.plan();
    }
    build() {
      const em = new Map();
      this.tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const u = t[e], v = t[(e + 1) % 3], key = u < v ? u + "," + v : v + "," + u; if (!em.has(key)) em.set(key, []); em.get(key).push(ti); } });
      this.nbr = this.tris.map(() => []);
      for (const [key, ts] of em) if (ts.length === 2) { const [u, v] = key.split(",").map(Number); this.nbr[ts[0]].push({ t: ts[1], e: [u, v] }); this.nbr[ts[1]].push({ t: ts[0], e: [u, v] }); }
      this.cent = this.tris.map((t) => ({ x: (this.V[t[0]].x + this.V[t[1]].x + this.V[t[2]].x) / 3, y: (this.V[t[0]].y + this.V[t[1]].y + this.V[t[2]].y) / 3 }));
    }
    inTri(p, ti, eps) { const [a, b, c] = this.tris[ti].map((i) => this.V[i]); const e = eps || 0; return C.cross(a, b, p) >= -e && C.cross(b, c, p) >= -e && C.cross(c, a, p) >= -e; }
    locate(p, hint) {
      if (hint !== undefined && hint >= 0) { if (this.inTri(p, hint, 1e-12)) return hint; for (const n of this.nbr[hint]) if (this.inTri(p, n.t, 1e-12)) return n.t; }
      for (let i = 0; i < this.tris.length; i++) if (this.inTri(p, i, 1e-12)) return i;
      // 数值误差让点落在边界外一点点：取「出界最少」的三角形
      let best = -1, bv = 1e-7;
      for (let i = 0; i < this.tris.length; i++) { const [a, b, c] = this.tris[i].map((k) => this.V[k]); const v = -Math.min(C.cross(a, b, p), C.cross(b, c, p), C.cross(c, a, p)); if (v < bv) { bv = v; best = i; } }
      return best;
    }
    // 超状态 = 三角形；每个动作（跨过一条公共边）代价 1；从目标三角形做 BFS
    plan() {
      const g = this.locate(this.goal); this.gt = g;
      this.phiC = this.tris.map(() => Infinity); this.next = this.tris.map(() => -1); this.exitE = this.tris.map(() => null); this.rep = this.tris.map(() => -1);
      if (g < 0) return;
      this.phiC[g] = 0; const q = [g];
      for (let k = 0; k < q.length; k++) { const t = q[k]; for (const n of this.nbr[t]) if (this.phiC[n.t] === Infinity) { this.phiC[n.t] = this.phiC[t] + 1; q.push(n.t); } }
      this.tris.forEach((t, ti) => {
        if (ti === g || !isFinite(this.phiC[ti])) return;
        // 局部算子：选 φ̌ 更小的邻居；并列时选出口边中点离目标近的
        let best = null;
        for (const n of this.nbr[ti]) { if (this.phiC[n.t] !== this.phiC[ti] - 1) continue; const m = C.lerp(this.V[n.e[0]], this.V[n.e[1]], .5), d = C.dist(m, this.goal); if (!best || d < best.d) best = { ...n, d }; }
        this.next[ti] = best.t; this.exitE[ti] = best.e; this.rep[ti] = t.find((v) => v !== best.e[0] && v !== best.e[1]);
      });
      this.stats.n.set(this.tris.length); this.stats.g.set(g >= 0 ? `#${g}` : "—");
      this.flow();
    }
    // 排斥点：书中用排斥顶点本身；「补充」选项把它挪到顶点外侧一点（沿出口边中点 → 顶点的方向）
    origin(ti) {
      const r = this.V[this.rep[ti]];
      if (this.repMode === "book") return r;
      const [a, b] = this.exitE[ti].map((i) => this.V[i]), m = C.lerp(a, b, .5);
      return { x: r.x - .25 * (m.x - r.x), y: r.y - .25 * (m.y - r.y) };
    }
    f(p, ti) {
      if (ti < 0) return null;
      if (ti === this.gt) { const d = C.dist(p, this.goal); return d < 1e-9 ? { x: 0, y: 0 } : { x: (this.goal.x - p.x) / d, y: (this.goal.y - p.y) / d }; }
      if (this.rep[ti] < 0) return null;
      const o = this.origin(ti), d = C.dist(p, o);
      if (d < 1e-12) { const [a, b] = this.exitE[ti].map((i) => this.V[i]), m = C.lerp(a, b, .5), L = C.dist(m, p); return { x: (m.x - p.x) / L, y: (m.y - p.y) / L }; }
      return { x: (p.x - o.x) / d, y: (p.y - o.y) / d };
    }
    // 每个三角形里的场是「从一点出发的射线」，积分曲线是直线段：直接求它与出口边的交点
    trace(s) {
      const pts = [s]; let p = s, t = this.locate(s);
      for (let k = 0; k < 400; k++) {
        if (t < 0) return { pts, ok: false };
        if (t === this.gt) { pts.push(this.goal); return { pts, ok: true }; }
        const d = this.f(p, t); if (!d) return { pts, ok: false };
        const [a, b] = this.exitE[t].map((i) => this.V[i]), ex = b.x - a.x, ey = b.y - a.y;
        const den = d.x * ey - d.y * ex; if (Math.abs(den) < 1e-14) return { pts, ok: false };
        const ax = a.x - p.x, ay = a.y - p.y;
        const u = C.clamp((ax * d.y - ay * d.x) / den, 0, 1), q = { x: a.x + u * ex, y: a.y + u * ey };
        if (C.dist(q, p) > 1e-12) pts.push(q);
        p = q; t = this.next[t];
      }
      return { pts, ok: false };
    }
    flow() {
      this.curves = (this.starts || []).map((s) => this.trace(s));
      const n = this.curves.length, ok = this.curves.filter((c) => c.ok).length;
      // 沿三角形的边走过的总长度（排斥顶点落在入口边上时会出现）
      let onE = 0, tot = 0;
      const edges = []; this.tris.forEach((t) => { for (let e = 0; e < 3; e++) edges.push([this.V[t[e]], this.V[t[(e + 1) % 3]]]); });
      for (const c of this.curves) for (let k = 1; k < c.pts.length; k++) {
        const A = c.pts[k - 1], B = c.pts[k], L = C.dist(A, B); tot += L;
        const M = C.lerp(A, B, .5); if (L > 1e-9 && edges.some(([u, v]) => C.segPointDist(M, u, v).d < 1e-7 && C.segPointDist(A, u, v).d < 1e-7)) onE += L;
      }
      this.stats.r.set(n ? `${ok} / ${n} 条到达 x_G` : "—");
      this.stats.e.set(tot ? `${(100 * onE / tot).toFixed(0)}%` : "—");
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const P of CELL_HOLES) st.poly(P, C.alpha(col.wall, .85), col.wall, 1);
      if (this.gt >= 0) st.poly(this.tris[this.gt].map((i) => this.V[i]), C.alpha(col.goal, .2));
      if (this.hover >= 0) st.poly(this.tris[this.hover].map((i) => this.V[i]), C.alpha(col.accent, .1));
      for (const t of this.tris) st.poly(t.map((i) => this.V[i]), null, C.alpha(col.muted, .55), 1);
      this.tris.forEach((t, ti) => { if (this.exitE[ti]) st.line(this.V[this.exitE[ti][0]], this.V[this.exitE[ti][1]], C.alpha(col.warn, .75), 2); });
      if (this.showNeedles) st.needles((p) => { const t = this.locate(p); return t >= 0 ? this.f(p, t) : null; }, col, { n: 34, color: C.alpha(col.accent, .55), lw: 1, head: 3 });
      // 每个三角形一个箭头（像图 8.10）
      this.tris.forEach((t, ti) => {
        const c = this.cent[ti];
        if (this.showNum) { st.text(isFinite(this.phiC[ti]) ? String(this.phiC[ti]) : "∞", c, col.text2, { size: 11, weight: 650 }); return; }
        const v = this.f(c, ti); if (v && (v.x || v.y)) st.arrow({ x: c.x - v.x * .02, y: c.y - v.y * .02 }, v, col.text2, { px: 15, lw: 1.5, head: 5 });
      });
      if (this.hover >= 0 && this.hover !== this.gt && this.rep[this.hover] >= 0) {
        const ti = this.hover, r = this.V[this.rep[ti]], [a, b, c] = this.tris[ti].map((i) => this.V[i]);
        for (let i = 1; i < 6; i++) for (let j = 1; j < 6 - i; j++) { const w = [i / 6, j / 6, 1 - i / 6 - j / 6]; const p = { x: w[0] * a.x + w[1] * b.x + w[2] * c.x, y: w[0] * a.y + w[1] * b.y + w[2] * c.y }; st.arrow(p, this.f(p, ti), C.alpha(col.accent, .85), { px: 11, lw: 1.2, head: 3.5 }); }
        st.line(this.V[this.exitE[ti][0]], this.V[this.exitE[ti][1]], col.warn, 3.5);
        const o = this.origin(ti); st.dot(r, 5.5, col.bad, col.surface, 1.5); st.text("排斥顶点", r, col.bad, { size: 11, dy: -12, weight: 650 });
        if (this.repMode !== "book") { st.line(r, o, C.alpha(col.bad, .7), 1.2, [3, 2]); st.xmark(o, col.bad, 4); }
      }
      for (const c of this.curves) { st.polyline(c.pts, c.ok ? col.path : col.bad, this.curves.length > 3 ? 1.6 : 2.6); st.dot(c.pts[0], this.curves.length > 3 ? 2.8 : 4.5, col.start, col.surface, 1); }
      st.qmark(this.goal, "G", col);
    }
  }

  // =================================================================
  // 组件 11：最优导航函数——可见多边形 + 路点（8.4.3 节，图 8.12、8.13）
  // =================================================================
  const OPT_POLY = [[.08, .06], [.52, .06], [.52, .22], [.9, .22], [.9, .36], [.42, .36], [.42, .58], [.66, .48], [.94, .7], [.72, .94], [.56, .7], [.42, .7], [.42, .94], [.08, .94]].map(([x, y]) => ({ x, y }));
  const OPT_HOLE = [[.18, .62], [.3, .62], [.3, .8], [.18, .8]].map(([x, y]) => ({ x, y }));
  class OptNav {
    constructor(root) {
      this.goal = { x: .2, y: .5 }; this.start = { x: .82, y: .66 }; this.hole = false; this.iter = 99;
      const body = C.frame(root, "平面多边形里的最优导航函数", "Z₁ = V(x_G)；每次从队列取一个路点 x，把 φ 扩展到 V(x) 中的新点：φ(x') = φ(x) + ‖x' − x‖");
      this.st = new C.Stage({ maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.goal) < .035 ? "G" : this.region.inside(p) ? (this.start = p, this.st.draw(), "I") : null),
        onMove: (p, d) => { if (!this.region.inside(p)) return; if (d === "G") { this.goal = p; this.compute(); } else { this.start = p; this.st.draw(); } },
        cursor: (p) => (C.dist(p, this.goal) < .035 ? "grab" : "crosshair") });
      this.sIt = C.slider("显示到第 i 次迭代", 1, 10, 1, 10, (v) => { this.iter = v; this.st.draw(); this.renderQ(); }, (v) => (this.anchors && v >= this.anchors.length ? `${v}（全部）` : String(v)));
      this.cbH = C.check("加一个洞（习题 5、18b）", false, (v) => { this.hole = v; this.compute(); });
      this.qbox = h("ul", { class: "qlist" });
      this.stats = { n: C.stat("路点（迭代次数 k−1）"), phi: C.stat("φ(起点)"), path: C.stat("最短路径经过") };
      body.append(h("div", { class: "controls" }, this.sIt, this.cbH),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "处理顺序（像 Dijkstra 一样按 φ 从小到大）"), h("div", { class: "panel-body" }, this.qbox)),
          C.legend([[C.cva("accent", .55), "已定义 φ 的区域 Z_i（越深越远）"], [C.cv("warn"), "本次迭代的可见多边形 V(x)"], [C.cv("alive2"), "路点 way point"], [C.cv("path"), "沿 φ 下降的最短路径"]]))));
      this.compute();
    }
    compute() {
      this.region = new C.Region(OPT_POLY, this.hole ? [OPT_HOLE] : []);
      if (!this.region.inside(this.goal)) this.goal = { x: .2, y: .5 };
      if (!this.region.inside(this.start)) this.start = { x: .82, y: .66 };
      const R = this.region, verts = [...OPT_POLY, ...(this.hole ? OPT_HOLE : [])];
      // 路点：x 能看见的顶点 v，且从 x 经过 v 的射线在 v 之后仍在区域内（v 投下了阴影）
      const wayPoints = (x) => verts.filter((v) => { if (C.dist(v, x) < 1e-9 || !R.visible(x, v)) return false; const d = C.dist(v, x), q = { x: v.x + (v.x - x.x) / d * 1e-4, y: v.y + (v.y - x.y) / d * 1e-4 }; return R.inside(q) && R.visible(x, q); });
      // 处理顺序：用堆按 φ 从小到大（与 Dijkstra 相同）；每个锚点记下父亲
      const anchors = [{ p: this.goal, phi: 0, parent: -1 }];
      const heap = new C.Heap(), seen = new Map();
      const push = (from) => { for (const w of wayPoints(anchors[from].p)) { const key = w.x + "," + w.y, v = anchors[from].phi + C.dist(w, anchors[from].p); if (!seen.has(key) || seen.get(key).phi > v + 1e-12) { seen.set(key, { phi: v, parent: from }); heap.push({ w, key }, v); } } };
      push(0);
      const done = new Set();
      while (heap.size) { const { w, key } = heap.pop(); if (done.has(key)) continue; done.add(key); const s = seen.get(key); anchors.push({ p: w, phi: s.phi, parent: s.parent }); push(anchors.length - 1); }
      this.anchors = anchors;
      this.vis = anchors.map((a) => R.visPoly(a.p));
      // 在像素网格上算 φ：前 i 个锚点里能看见它的，取 φ(a) + ‖x − a‖ 的最小值
      const N = 150; this.N = N;
      this.val = []; this.owner = [];
      const inside = new Uint8Array((N + 1) * (N + 1));
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) inside[j * (N + 1) + i] = R.inside({ x: i / N, y: j / N }) ? 1 : 0;
      const best = new Float64Array((N + 1) * (N + 1)).fill(Infinity), own = new Int16Array((N + 1) * (N + 1)).fill(-1);
      anchors.forEach((a, ai) => {
        for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
          const k = j * (N + 1) + i; if (!inside[k]) continue;
          const p = { x: i / N, y: j / N }, v = a.phi + C.dist(p, a.p);
          if (v < best[k] - 1e-12 && R.visible(a.p, p)) { best[k] = v; own[k] = ai; }
        }
        this.val.push(best.slice()); this.owner.push(own.slice());
      });
      const it = this.anchors.length;
      this.sIt.input.max = it; this.sIt.set(it); this.iter = it;
      this.renderQ(); this.st.draw();
    }
    phiAt(p, upto) {
      let b = Infinity, o = -1;
      for (let ai = 0; ai < Math.min(upto, this.anchors.length); ai++) { const a = this.anchors[ai], v = a.phi + C.dist(p, a.p); if (v < b && this.region.visible(a.p, p)) { b = v; o = ai; } }
      return { v: b, o };
    }
    renderQ() {
      const k = this.iter;
      this.qbox.innerHTML = this.anchors.map((a, i) => `<li style="${i === k - 1 ? "" : "background:none"}${i >= k ? ";opacity:.45" : ""}"><span>${i === 0 ? "x_G（Z₁ = V(x_G)）" : `路点 ${i}：(${a.p.x.toFixed(2)}, ${a.p.y.toFixed(2)})`}</span><span>φ = ${a.phi.toFixed(3)}</span></li>`).join("");
      this.stats.n.set(this.anchors.length - 1);
      const r = this.phiAt(this.start, k);
      this.stats.phi.set(isFinite(r.v) ? r.v.toFixed(3) : "∞（还没覆盖）");
      const chain = []; for (let o = r.o; o > 0; o = this.anchors[o].parent) chain.push(o);
      this.stats.path.set(isFinite(r.v) ? (chain.length ? `路点 ${chain.reverse().join(" → ")}` : "直接可见") : "—");
    }
    draw(ctx, st, col) {
      st.frame(col, col.surface2);
      const N = this.N, k = Math.max(1, Math.min(this.iter, this.anchors.length));
      const vals = this.val[k - 1];
      let mx = 0; for (const v of this.val[this.val.length - 1]) if (isFinite(v)) mx = Math.max(mx, v);
      st.poly(OPT_POLY, col.surface);
      st.heat(vals, N + 1, N + 1, (v) => v / (mx || 1), col, { rect: [-.5 / N, 1 + .5 / N, -.5 / N, 1 + .5 / N], smooth: false });
      const levels = []; for (let L = .05; L < mx; L += .05) levels.push(L);
      st.contours(vals, N + 1, N + 1, levels, C.alpha(col.text2, .45), 1, { rect: [0, 1, 0, 1] });
      if (this.hole) st.poly(OPT_HOLE, C.alpha(col.wall, .85), col.wall, 1);
      st.poly(OPT_POLY, null, col.text2, 2);
      // 当前迭代的可见多边形
      const cur = this.anchors[k - 1], V = this.vis[k - 1];
      st.poly(V, C.alpha(col.warn, .1), col.warn, 1.8);
      this.anchors.forEach((a, i) => { if (i === 0) return; st.dot(a.p, i < k ? 5 : 4, i < k ? col.alive2 : col.surface, col.alive2, 2); st.text(String(i), a.p, col.alive2, { dx: 9, dy: -9, size: 11, weight: 700 }); });
      if (k > 1) st.dot(cur.p, 8, null, col.warn, 2.5);
      // 最短路径
      const r = this.phiAt(this.start, k);
      if (isFinite(r.v)) { const P = [this.start]; for (let o = r.o; o >= 0; o = this.anchors[o].parent) P.push(this.anchors[o].p); st.polyline(P, col.path, 3); }
      st.qmark(this.start, "I", col, "起点"); st.qmark(this.goal, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-potential']").forEach((el) => el._w = new Potential(el));
    document.querySelectorAll("[data-widget='ch8-cells']").forEach((el) => el._w = new CellComplex(el));
    document.querySelectorAll("[data-widget='ch8-optnav']").forEach((el) => el._w = new OptNav(el));
  });
  window.CH8.triangulate = triangulate;
})();
