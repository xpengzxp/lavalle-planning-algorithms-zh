/* 6.3.1 与 6.3.3 节：单纯形与单纯复形（式 6.3、图 6.15）；三维垂直分解的递归扫描（图 6.20） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;

  // ---------------------------------------------------------------
  // 单纯复形检查：任意两个三角形的交要么为空，要么是两者的公共面（公共顶点或公共边）
  // ---------------------------------------------------------------
  function clipArea(T1, T2) {
    const ccw = (T) => (C.cross(T[0], T[1], T[2]) > 0 ? T : [T[0], T[2], T[1]]);
    let Q = ccw(T1); const R = ccw(T2);
    const inter = (p, q, a, b) => { const d1 = C.cross(a, b, p), d2 = C.cross(a, b, q), t = d1 / (d1 - d2); return C.lerp(p, q, t); };
    for (let i = 0; i < 3 && Q.length; i++) {
      const a = R[i], b = R[(i + 1) % 3], out = [];
      for (let k = 0; k < Q.length; k++) {
        const cur = Q[k], prv = Q[(k - 1 + Q.length) % Q.length];
        const ci = C.cross(a, b, cur) >= -1e-12, pi = C.cross(a, b, prv) >= -1e-12;
        if (ci) { if (!pi) out.push(inter(prv, cur, a, b)); out.push(cur); } else if (pi) out.push(inter(prv, cur, a, b));
      }
      Q = out;
    }
    return Q.length >= 3 ? Math.abs(C.polyArea(Q)) : 0;
  }
  function onSegInterior(p, a, b) {
    if (Math.abs(C.cross(a, b, p)) > 1e-9 * (1 + C.dist(a, b))) return false;
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    return t > 1e-7 && t < 1 - 1e-7;
  }
  function checkComplex(V, tris) {
    const bad = [];
    const E = (t) => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
    for (let i = 0; i < tris.length; i++) for (let j = i + 1; j < tris.length; j++) {
      const t1 = tris[i], t2 = tris[j], T1 = t1.map((k) => V[k]), T2 = t2.map((k) => V[k]);
      if (clipArea(T1, T2) > 1e-10) { bad.push({ i, j, why: "内部重叠" }); continue; }
      let why = null, at = null;
      for (const [a, b] of E(t1)) for (const [c, d] of E(t2)) if (!why && C.properCross(V[a], V[b], V[c], V[d])) { why = "边在内部相交"; at = C.lerp(V[a], V[b], 0.5); }
      for (const [s, o] of [[t1, t2], [t2, t1]]) for (const v of s) if (!why && !o.includes(v)) for (const [c, d] of E(o)) if (onSegInterior(V[v], V[c], V[d])) { why = "T 形接头：顶点落在另一个三角形的边内部"; at = V[v]; }
      if (why) bad.push({ i, j, why, at });
    }
    return bad;
  }

  class Simplicial {
    constructor(root) {
      this.mode = "simplex";
      this.tri = [P(0.15, 0.2), P(1.25, 0.35), P(0.6, 1.05)]; this.probe = P(0.62, 0.5);
      const body = C.frame(root, "单纯形与单纯复形", "拖动顶点和探针；切到「复形检查」看两条条件");
      this.st = new C.Stage({ aspect: 0.62, maxW: 600, view: [-0.1, 1.5, -0.05, 1.15], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => {
          if (this.mode === "simplex") { if (this.st.near(p, this.probe, 13)) return { k: "probe" }; const i = this.tri.findIndex((q) => this.st.near(p, q, 13)); return i >= 0 ? { k: "v", i } : { k: "probe" }; }
          const i = this.V.findIndex((q) => this.st.near(p, q, 12)); return i >= 0 && this.preset !== "vcd" ? { k: "cv", i } : null;
        },
        onMove: (p, d) => { if (d.k === "probe") this.probe = p; else if (d.k === "v") this.tri[d.i] = p; else this.V[d.i] = p; this.render(); },
        cursor: (p) => (this.mode === "simplex" ? "crosshair" : this.V.some((q) => this.st.near(p, q, 12)) && this.preset !== "vcd" ? "grab" : null) });
      this.out = h("div", { class: "small" });
      this.presetSel = C.seg([["left", "图 6.15 左（仿制）"], ["right", "图 6.15 右（仿制）"], ["vcd", "把梯形对半切成三角形"]], "left", (k) => this.load(k));
      this.modeSel = C.seg([["simplex", "单纯形 (6.3)"], ["complex", "单纯复形检查"]], this.mode, (k) => { this.mode = k; this.presetSel.classList.toggle("hidden", k !== "complex"); this.render(); });
      body.append(h("div", { class: "controls" }, this.modeSel, this.presetSel), h("div", { class: "split" }, this.st.wrap, this.out));
      this.presetSel.classList.add("hidden");
      this.load("left");
    }
    load(k) {
      this.preset = k;
      if (k === "left") {
        this.V = [P(0, 0.05), P(0.6, 0.05), P(0.3, 0.55), P(0.45, 0.3), P(0.95, 0.55), P(0.8, 0.05), P(0.95, 0.05), P(1.4, 0.05), P(1.18, 0.5)];
        this.T = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
        this.segs = [[2, 4]];
      } else if (k === "right") {
        this.V = [P(0, 0.4), P(0.35, 0.8), P(0.5, 0.1), P(0.75, 0.75), P(1.0, 0.25), P(1.3, 0.7), P(0.62, 1.08)];
        this.T = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [1, 3, 6], [3, 5, 6]];
        this.segs = [];
      } else {
        // 6.3.2 节：把垂直分解的每个梯形沿对角线切成两个三角形
        const S = C.makeScene("fig66"), D = C.decompose(S);
        const sc = 1.4 / (S.box.x1 - S.box.x0);
        const V = [], key = (p) => p.x.toFixed(6) + "," + p.y.toFixed(6), idx = new Map();
        const id = (p) => { const q = P((p.x - S.box.x0) * sc, (p.y - S.box.y0) * sc + 0.02); const k2 = key(q); if (!idx.has(k2)) { idx.set(k2, V.length); V.push(q); } return idx.get(k2); };
        const T = [];
        for (const c of D.cells) {
          const Q = c.poly.filter((p, i, A) => C.dist(p, A[(i + A.length - 1) % A.length]) > 1e-9);
          if (Q.length === 3) T.push(Q.map(id)); else { const ids = Q.map(id); T.push([ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]); }
        }
        this.V = V; this.T = T; this.segs = [];
        this.bgScene = S; this.bgScale = sc;
      }
      this.render();
    }
    render() {
      if (this.mode === "simplex") {
        const [p1, p2, p3] = this.tri, x = this.probe;
        const A = C.cross(p1, p2, p3);
        const deg = Math.abs(A) < 1e-4;
        const a1 = C.cross(x, p2, p3) / A, a2 = C.cross(p1, x, p3) / A, a3 = C.cross(p1, p2, x) / A;
        const inside = a1 >= -1e-9 && a2 >= -1e-9 && a3 >= -1e-9;
        const zeros = [a1, a2, a3].map((a, i) => (Math.abs(a) < 0.015 ? i + 1 : 0)).filter(Boolean);
        const face = zeros.length === 1 ? `令 \\(\\alpha_${zeros[0]} = 0\\)：探针在一个面（1-单纯形，即一条边）上` : zeros.length === 2 ? "两个 α 为 0：探针在一个顶点（0-单纯形）上" : inside ? "探针在 2-单纯形的内部，也就是一个 2-单元" : "有 α < 0：探针在单纯形之外";
        this.out.innerHTML = deg ? '<p class="no">三个点几乎共线：不线性无关（脚注 5），不能构成 2-单纯形。</p>'
          : `<p>\\(x = \\alpha_1 p_1 + \\alpha_2 p_2 + \\alpha_3 p_3\\)，其中</p><p class="mono">α₁ = ${a1.toFixed(3)}<br>α₂ = ${a2.toFixed(3)}<br>α₃ = ${a3.toFixed(3)}<br>Σα = ${(a1 + a2 + a3).toFixed(3)}</p><p>${inside ? '<span class="yes">所有 αᵢ ≥ 0</span>，x 属于 (6.3) 定义的 \\([p_1,p_2,p_3]\\)。' : '<span class="no">有 αᵢ < 0</span>，x 不属于 \\([p_1,p_2,p_3]\\)。'}${face}。</p><p class="muted">(6.3) 就是这三点的凸包：所有「非负、和为 1」的组合。</p>`;
      } else {
        this.bad = checkComplex(this.V, this.T);
        const n = this.bad.length;
        const desc = { left: "中间那个三角形的一个顶点落在左边三角形的边内部；上面那条线段也只搭在端点上。", right: "相邻三角形都恰好共享一整条边或一个顶点。", vcd: "垂直分解里，一条竖直线段的端点常常落在相邻梯形侧边的<b>中间</b>。把梯形切成三角形后，这些点就成了 T 形接头——所以「先垂直分解再切三角形」得不到单纯复形（6.3.2 节）。" }[this.preset];
        this.out.innerHTML = `<p>${n ? `<span class="no">不是单纯复形</span>：${n} 对三角形违反条件 2。` : '<span class="yes">是单纯复形</span>：两条条件都满足。'}</p><p class="small">${desc}</p>`
          + (n ? `<ul class="small">${this.bad.slice(0, 6).map((b) => `<li>三角形 ${b.i + 1} 与 ${b.j + 1}：${b.why}</li>`).join("")}${n > 6 ? `<li>…还有 ${n - 6} 对</li>` : ""}</ul>` : "")
          + '<p class="muted small">条件 1（单纯形的面也在 K 里）在这里自动满足：我们把三角形的边和顶点都算作 K 的成员。</p>';
      }
      PA.renderMath(this.out);
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      if (this.mode === "simplex") {
        const [p1, p2, p3] = this.tri, x = this.probe;
        st.poly(this.tri, C.alpha(col.accent, 0.18), col.accent, 2);
        // 重心坐标的等值线 α_i = const
        for (const [a, b, c] of [[p1, p2, p3], [p2, p3, p1], [p3, p1, p2]]) for (let t = 0.25; t < 1; t += 0.25) st.line(C.lerp(a, b, t), C.lerp(a, c, t), C.alpha(col.accent, 0.25), 1, [3, 3]);
        [p1, p2, p3].forEach((p, i) => { st.dot(p, 6, col.surface, col.accent, 2); st.text("p" + (i + 1), p, col.accent, { dy: -15, weight: 650 }); });
        for (const p of [p1, p2, p3]) st.line(x, p, C.alpha(col.warn, 0.5), 1, [4, 3]);
        st.dot(x, 6, col.warn, col.surface, 2); st.text("x", x, col.warn, { dx: 12, dy: -10, weight: 650 });
        return;
      }
      if (this.preset === "vcd") {
        const S = this.bgScene, sc = this.bgScale, tr = (p) => P((p.x - S.box.x0) * sc, (p.y - S.box.y0) * sc + 0.02);
        for (let k = 1; k < S.polys.length; k++) st.poly(S.polys[k].map(tr), C.alpha(col.wall, 0.7));
      }
      const badT = new Set(); (this.bad || []).forEach((b) => { badT.add(b.i); badT.add(b.j); });
      this.T.forEach((t, i) => st.poly(t.map((k) => this.V[k]), C.alpha(badT.has(i) ? col.bad : col.accent, badT.has(i) ? 0.2 : 0.14), badT.has(i) ? col.bad : col.accent, 1.4));
      for (const [a, b] of this.segs) st.line(this.V[a], this.V[b], col.accent, 2);
      this.V.forEach((p) => st.dot(p, this.preset === "vcd" ? 2.4 : 4.5, col.accent, col.surface, 1));
      (this.bad || []).forEach((b) => { if (b.at) st.dot(b.at, 7, null, col.bad, 2.4); });
      if (this.preset !== "vcd") this.T.forEach((t, i) => st.text(String(i + 1), C.centroid(t.map((k) => this.V[k])), col.text2, { size: 11 }));
    }
  }

  // ===============================================================
  // 图 6.20：三维垂直分解——扫描平面切出的每一片都是一个二维问题
  // ===============================================================
  const V3 = (x, y, z) => ({ x, y, z });
  const SOLIDS = [
    { name: "四面体", v: [V3(0.12, 0.52, 0.42), V3(0.3, 0.72, 0.5), V3(0.24, 0.5, 0.72), V3(0.2, 0.36, 0.55)], e: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] },
    { name: "斜放的长方体", v: [V3(0.38, 0.62, 0.76), V3(0.94, 0.42, 0.64), V3(0.92, 0.47, 0.73), V3(0.36, 0.67, 0.85), V3(0.38, 0.57, 0.7), V3(0.94, 0.37, 0.58), V3(0.92, 0.42, 0.67), V3(0.36, 0.62, 0.79)],
      e: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] },
    { name: "金字塔", v: [V3(0.55, 0.22, 0.12), V3(0.82, 0.25, 0.1), V3(0.78, 0.5, 0.14), V3(0.52, 0.46, 0.16), V3(0.66, 0.37, 0.42)], e: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]] },
  ];
  function hull2(pts) {
    const Q = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (Q.length < 3) return Q;
    const lo = [], up = [];
    for (const p of Q) { while (lo.length >= 2 && C.cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = Q.length - 1; i >= 0; i--) { const p = Q[i]; while (up.length >= 2 && C.cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function sliceSolid(sol, x) {
    // 凸多面体与平面 x = const 的交 = 所有穿过平面的棱的交点的凸包（在 yz 平面里）
    const pts = [];
    for (const [a, b] of sol.e) {
      const A = sol.v[a], B = sol.v[b];
      if ((A.x - x) * (B.x - x) < 0) { const t = (x - A.x) / (B.x - A.x); pts.push(P(A.y + t * (B.y - A.y), A.z + t * (B.z - A.z))); }
    }
    const H = hull2(pts);
    return H.length >= 3 && Math.abs(C.polyArea(H)) > 1e-7 ? H : null;
  }

  class Sweep3D {
    constructor(root) {
      this.x = 0.25; this.az = -0.55; this.el = 0.42;
      const body = C.frame(root, "三维垂直分解：扫描平面 + 每一片的二维分解", "拖动扫描平面的位置 x；拖动左图旋转视角");
      this.st = new C.Stage({ aspect: 0.82, maxW: 420, view: [-0.95, 0.95, -0.35, 1.25], onDraw: (ctx, st, col) => this.draw3(st, col),
        onDown: (p) => ({ p0: p, az: this.az, el: this.el }),
        onMove: (p, d) => { this.az = d.az + (p.x - d.p0.x) * 2.2; this.el = Math.max(0.05, Math.min(1.2, d.el - (p.y - d.p0.y) * 1.5)); this.st.draw(); },
        cursor: () => "move" });
      this.st2 = new C.Stage({ aspect: 0.82, maxW: 420, view: [-0.04, 1.04, -0.04, 1.04], onDraw: (ctx, st, col) => this.draw2(st, col) });
      this.events = SOLIDS.flatMap((s) => s.v.map((v) => v.x)).sort((a, b) => a - b);
      this.sx = C.slider("扫描平面 x", 0.02, 0.98, 0.001, this.x, (v) => { this.x = v; this.update(); }, (v) => v.toFixed(3));
      this.out = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sx, C.button("◀ 上一个事件", () => this.jump(-1), "small"), C.button("下一个事件 ▶", () => this.jump(1), "small")),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, this.st.wrap, this.st2.wrap), this.out,
        C.legend([[C.cva("warn", 0.4), "扫描平面"], [C.cva("wall", 0.7), "平面切到的障碍截面"], [C.cva("accent", 0.3), "截面里的 2-单元（= 3-单元的切片）"], [C.cv("accent"), "截面里的竖直线段"]]));
      this.update();
    }
    jump(dir) {
      const xs = this.events; const eps = 1e-4;
      let nx = dir > 0 ? xs.find((x) => x > this.x + eps) : [...xs].reverse().find((x) => x < this.x - eps);
      if (nx === undefined) return;
      this.x = nx + dir * 0.002; this.sx.set(this.x); this.update();
    }
    sliceScene(x) {
      const outer = [P(0.0, 0.002), P(1.0, 0.0), P(1.003, 1.0), P(0.001, 1.002)];
      const polys = [outer];
      SOLIDS.forEach((s) => { const Q = sliceSolid(s, x); if (Q) polys.push(Q); });
      return new C.Scene(polys);
    }
    update() {
      this.Sl = this.sliceScene(this.x);
      this.Dl = C.decompose(this.Sl);
      // 与相邻事件的另一侧比较，看「切片的组合结构」是否变了
      const k = this.events.filter((e) => e < this.x).length;
      const lo = k > 0 ? this.events[k - 1] : 0, hi = k < this.events.length ? this.events[k] : 1;
      const nSol = this.Sl.polys.length - 1;
      this.out.innerHTML = `平面 x = ${this.x.toFixed(3)} 位于第 ${k} 与第 ${k + 1} 个事件之间（${lo.toFixed(3)} 与 ${hi.toFixed(3)}，事件 = 多面体顶点的 x 坐标，共 ${this.events.length} 个）。`
        + `这一片里有 ${nSol} 个障碍截面，二维垂直分解给出 <b>${this.Dl.cells.length}</b> 个 2-单元、${this.Dl.ones.length} 条竖直线段。`
        + `<span class="muted">在两个事件之间移动平面，截面只会平滑地变形，单元的组合结构不变；跨过事件（碰到一个顶点）时才会出现图 6.2 的三维版本的变化。</span>`;
      this.st.draw(); this.st2.draw();
    }
    proj(p) {
      // 绕 z 轴转 az，再抬高视角 el；返回 Stage 世界坐标
      const c = Math.cos(this.az), s = Math.sin(this.az);
      const x = p.x - 0.5, y = p.y - 0.5, z = p.z - 0.5;
      const X = c * x - s * y, D = s * x + c * y;
      return P(X, z * Math.cos(this.el) + D * Math.sin(this.el) * 0.6 + 0.45);
    }
    draw3(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const pr = (p) => this.proj(p);
      // 外框
      const B = [V3(0, 0, 0), V3(1, 0, 0), V3(1, 1, 0), V3(0, 1, 0), V3(0, 0, 1), V3(1, 0, 1), V3(1, 1, 1), V3(0, 1, 1)];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) st.line(pr(B[a]), pr(B[b]), C.alpha(col.text, 0.35), 1);
      // 坐标轴提示
      st.arrow(pr(V3(0, 0, 0)), pr(V3(0.25, 0, 0)), col.text2, 1.5, 6); st.text("x", pr(V3(0.3, 0, 0)), col.text2, { size: 11 });
      st.arrow(pr(V3(0, 0, 0)), pr(V3(0, 0.25, 0)), col.text2, 1.5, 6); st.text("y", pr(V3(0, 0.3, 0)), col.text2, { size: 11 });
      st.arrow(pr(V3(0, 0, 0)), pr(V3(0, 0, 0.25)), col.text2, 1.5, 6); st.text("z", pr(V3(0, 0, 0.3)), col.text2, { size: 11 });
      // 扫描平面
      const x = this.x;
      st.poly([V3(x, 0, 0), V3(x, 1, 0), V3(x, 1, 1), V3(x, 0, 1)].map(pr), C.alpha(col.warn, 0.16), col.warn, 1.2);
      // 多面体（线框；在平面左侧已扫过的部分画实线）
      for (const s of SOLIDS) for (const [a, b] of s.e) {
        const A = s.v[a], Bv = s.v[b];
        st.line(pr(A), pr(Bv), C.alpha(col.wall, 0.9), 1.4);
      }
      for (const s of SOLIDS) for (const v of s.v) st.dot(pr(v), 2.4, Math.abs(v.x - x) < 0.004 ? col.warn : col.wall);
      // 截面画到平面上
      for (const Q of this.Sl.polys.slice(1)) st.poly(Q.map((p) => pr(V3(x, p.x, p.y))), C.alpha(col.wall, 0.75), col.wall, 1.2);
      for (const o of this.Dl.ones) st.line(pr(V3(x, o.x, o.y0)), pr(V3(x, o.x, o.y1)), col.accent, 1.6);
    }
    draw2(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      st.scene(this.Sl, col);
      this.Dl.cells.forEach((c, i) => st.poly(c.poly, C.alpha(col.accent, i % 2 ? 0.12 : 0.24), C.alpha(col.accent, 0.4), 0.8));
      for (const o of this.Dl.ones) st.line(P(o.x, o.y0), P(o.x, o.y1), col.accent, 2);
      st.text("y →", P(0.93, 0.0), col.text2, { dy: -10, size: 11 }); st.text("z ↑", P(0.03, 0.95), col.text2, { size: 11 });
      st.text(`截面 x = ${this.x.toFixed(3)}（平行于 yz 平面）`, P(0.5, 1.0), col.text2, { dy: 10, size: 11.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='simplicial']").forEach((el) => el._w = new Simplicial(el));
    document.querySelectorAll("[data-widget='sweep3d']").forEach((el) => el._w = new Sweep3D(el));
  });
  window.CH6.checkComplex = checkComplex;
  window.CH6.sliceSolidsAt = (x) => SOLIDS.map((s) => sliceSolid(s, x));
})();
