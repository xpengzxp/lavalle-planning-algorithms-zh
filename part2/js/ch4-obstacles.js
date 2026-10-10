/* 第 4 章 · 4.3 配置空间障碍：minkowski-1d（例 4.13）、star（例 4.14/4.15、图 4.18/4.19，带旋转）、arm-cspace（两连杆 C-space 障碍） */
(function () {
  "use strict";
  const { shell, palette, alpha, makeCanvas, onDrag, svgPoint, slider, segmented, button, checkbox, G, num, h, s } = CH4;

  // =====================================================================
  // 10. 一维 C-space 障碍
  // =====================================================================
  class Minkowski1D {
    constructor(root) {
      this.body = shell(root, "一维 C-space 障碍", "例 4.13 / 图 4.12：拖动红色机器人，看 q 何时落进 Cobs");
      this.A = [-1, 2]; this.O = [0, 4]; this.q = -3.5;
      this.showConv = false;
      const sl = (lab, get, set, lo, hi) => slider(lab, lo, hi, 0.5, get(), (v) => { set(v); this.fix(); this.render(); }, (v) => num(v, 1));
      this.ctr = h("div", { class: "controls" },
        sl("A 左端", () => this.A[0], (v) => (this.A[0] = v), -3, 0), sl("A 右端", () => this.A[1], (v) => (this.A[1] = v), 0, 3),
        sl("O 左端", () => this.O[0], (v) => (this.O[0] = v), -2, 6), sl("O 右端", () => this.O[1], (v) => (this.O[1] = v), -2, 6));
      const ctr2 = h("div", { class: "controls" },
        (this.qSl = slider("机器人位置 q =", -6, 8, 0.05, this.q, (v) => { this.q = v; this.render(); }, (v) => num(v, 2))),
        checkbox("同时画出按式 (4.38) 字面计算的卷积（虚线）", false, (v) => { this.showConv = v; this.render(); }));
      this.svg = s("svg", { viewBox: "0 0 640 318", style: "width:100%;max-width:720px;display:block;margin:0 auto;touch-action:none;user-select:none" });
      this.info = h("div", { class: "status-line", style: "margin-top:6px" });
      this.body.append(this.ctr, ctr2, h("div", { class: "svg-wrap" }, this.svg), this.info);
      let drag = null;
      this.svg.addEventListener("pointerdown", (e) => { const p = svgPoint(this.svg, e); if (p.y < 70) { drag = p.x - this.X(this.q); try { this.svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } } });
      this.svg.addEventListener("pointermove", (e) => { if (drag === null) return; const p = svgPoint(this.svg, e); this.q = Math.max(-6, Math.min(8, Math.round(((p.x - drag - 40) / 37.5 - 6) * 20) / 20)); this.qSl.set(this.q); this.render(); });
      this.svg.addEventListener("pointerup", () => { drag = null; });
      this.render();
    }
    fix() { if (this.O[1] < this.O[0]) this.O = [this.O[1], this.O[0]]; }
    X(x) { return 40 + (x + 6) * 37.5; }
    render() {
      const svg = this.svg; svg.innerHTML = "";
      const A = this.A, O = this.O, q = this.q, X = (x) => this.X(x);
      const cobs = [O[0] - A[1], O[1] - A[0]];
      const Aq = [A[0] + q, A[1] + q];
      const coll = Aq[1] >= O[0] && Aq[0] <= O[1];
      const inC = q >= cobs[0] && q <= cobs[1];
      const bar = (y, I, col, lab, dash, op) => {
        svg.append(s("rect", { x: X(I[0]), y: y - 9, width: Math.max(1, X(I[1]) - X(I[0])), height: 18, rx: 3, fill: col, "fill-opacity": op === undefined ? 0.75 : op, stroke: col, "stroke-width": 1.5, "stroke-dasharray": dash || "none" }));
        svg.append(s("text", { x: 34, y: y + 5, "text-anchor": "end", "font-size": 13, fill: "var(--text-2)" }, lab));
        svg.append(s("text", { x: (X(I[0]) + X(I[1])) / 2, y: y - 14, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, `[${num(I[0], 2)}, ${num(I[1], 2)}]`));
      };
      // 坐标轴
      const axisY = 222;
      svg.append(s("line", { x1: 40, y1: axisY, x2: 600, y2: axisY, stroke: "var(--border-strong)" }));
      for (let k = -6; k <= 8; k++) {
        svg.append(s("line", { x1: X(k), y1: axisY - 4, x2: X(k), y2: axisY + 4, stroke: "var(--muted)" }));
        svg.append(s("text", { x: X(k), y: axisY + 18, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, k));
        svg.append(s("line", { x1: X(k), y1: 20, x2: X(k), y2: axisY - 6, stroke: "var(--c-grid)", "stroke-width": 0.6 }));
      }
      bar(45, Aq, "var(--bad)", "A(q)", null, coll ? 0.85 : 0.55);
      svg.append(s("line", { x1: X(q), y1: 30, x2: X(q), y2: 60, stroke: "var(--text)", "stroke-width": 2 }));
      svg.append(s("text", { x: X(q), y: 72, "text-anchor": "middle", "font-size": 11, fill: "var(--text)" }, "原点"));
      bar(100, O, "var(--ok)", "O");
      bar(140, [-A[1], -A[0]], "var(--bad)", "−A", "4 3", 0.25);
      bar(180, cobs, "var(--accent)", "Cobs", null, 0.35);
      svg.append(s("circle", { cx: X(q), cy: 180, r: 6, fill: inC ? "var(--bad)" : "var(--surface)", stroke: "var(--bad)", "stroke-width": 2.2 }));
      // 重叠长度 h(q)
      const gy = 290, sc = 12;
      const ov = (t) => Math.max(0, Math.min(O[1], A[1] + t) - Math.max(O[0], A[0] + t));
      let d = "";
      for (let i = 0; i <= 280; i++) { const t = -6 + (i / 280) * 14; d += (i ? "L" : "M") + X(t).toFixed(1) + "," + (gy - sc * ov(t)).toFixed(1); }
      svg.append(s("path", { d, fill: "none", stroke: "var(--accent)", "stroke-width": 2 }));
      if (this.showConv) {
        const cv = (t) => Math.max(0, Math.min(O[1], t - A[0]) - Math.max(O[0], t - A[1]));
        let d2 = "";
        for (let i = 0; i <= 280; i++) { const t = -6 + (i / 280) * 14; d2 += (i ? "L" : "M") + X(t).toFixed(1) + "," + (gy - sc * cv(t)).toFixed(1); }
        svg.append(s("path", { d: d2, fill: "none", stroke: "var(--warn)", "stroke-width": 2, "stroke-dasharray": "5 4" }));
      }
      svg.append(s("text", { x: 600, y: gy + 22, "text-anchor": "end", "font-size": 11, fill: "var(--accent-text)" }, "曲线：h(q) = |O ∩ A(q)|（重叠长度），h(q) > 0 ⇔ q ∈ int(Cobs)"));
      svg.append(s("circle", { cx: X(q), cy: gy - sc * ov(q), r: 4, fill: "var(--bad)" }));
      this.info.innerHTML = `Cobs = O ⊖ A = [${num(O[0], 2)} − ${num(A[1], 2)}, ${num(O[1], 2)} − (${num(A[0], 2)})] = <b>[${num(cobs[0], 2)}, ${num(cobs[1], 2)}]</b>。` +
        `q = ${num(q, 2)}：A(q) ${coll ? "<b style='color:var(--bad)'>碰到</b>" : "没碰到"} O，q ${inC ? "<b>∈</b>" : "∉"} Cobs。${q === cobs[0] || q === cobs[1] ? " 正好接触：边界相交也算碰撞，所以 Cobs 是闭集（式 4.35）。" : ""}` +
        (this.showConv ? " <span style='color:var(--warn)'>虚线 = 字面的 ∫f(τ)g(x−τ)dτ，它的支撑是 O ⊕ A，整体偏了（见脚注）。</span>" : "");
    }
  }

  // =====================================================================
  // 11. 星形算法：凸多边形机器人（只平移）+ 凸多边形障碍
  // =====================================================================
  const STAR_PRESETS = {
    book: { name: "例 4.15（图 4.18）", A: [[1, 0], [0, 1], [-1, -1]], O: [[1, 1], [-1, 1], [-1, -1], [1, -1]], An: ["a1", "a2", "a3"], On: ["b1", "b2", "b3", "b4"], q: [-2.6, 1.6] },
    ex11: { name: "习题 11（等边三角形）", A: [[0, 0], [2, 0], [1, Math.sqrt(3)]], O: [[0, 0], [2, 0], [1, Math.sqrt(3)]], An: ["a1", "a2", "a3"], On: ["b1", "b2", "b3"], q: [-2.8, -1.2] },
    pent: { name: "四边形机器人 + 五边形障碍", A: [[0.6, -0.4], [0.7, 0.5], [-0.5, 0.6], [-0.6, -0.3]], O: [[1.2, -0.6], [1.4, 0.8], [0, 1.5], [-1.3, 0.6], [-0.8, -1.0]], An: ["a1", "a2", "a3", "a4"], On: ["b1", "b2", "b3", "b4", "b5"], q: [2.6, 2.4] },
  };
  class Star {
    constructor(root) {
      this.body = shell(root, "星形算法：构造多边形 Cobs", "例 4.14、4.15：拖动机器人；或者让它贴着障碍滑一圈");
      this.pid = "book"; this.theta = 0; this.slideS = null;
      this.load();
      this.build();
    }
    load() { const P = STAR_PRESETS[this.pid]; this.A0 = P.A; this.O = P.O; this.An = P.An; this.On = P.On; this.q = P.q.slice(); }
    build() {
      const b = this.body;
      const sel = h("select", null, Object.entries(STAR_PRESETS).map(([k, p]) => h("option", { value: k }, p.name)));
      sel.addEventListener("change", () => { this.pid = sel.value; this.load(); this.theta = 0; this.thSl.set(0); this.slideS = null; this.sSl.set(0); this.render(); });
      this.thSl = slider("机器人朝向 θ =", 0, 360, 1, 0, (v) => { this.theta = (v * Math.PI) / 180; if (this.slideS !== null) this.placeOnBoundary(this.slideS); this.render(); }, (v) => v + "°");
      this.sSl = slider("贴着障碍滑动 s =", 0, 1, 0.002, 0, (v) => { this.slideS = v; this.placeOnBoundary(v); this.render(); }, (v) => num(v, 3));
      b.append(h("div", { class: "controls" }, sel, this.thSl), h("div", { class: "controls" }, this.sSl,
        button("▶ 自动滑一圈", () => this.animate(), "small")));
      this.svg = s("svg", { viewBox: "0 0 660 400", style: "width:100%;max-width:760px;display:block;margin:0 auto;touch-action:none;user-select:none" });
      this.info = h("div", { class: "status-line", style: "margin:6px 0" });
      this.table = h("div", { class: "table-wrap" });
      b.append(h("div", { class: "svg-wrap" }, this.svg), this.info, this.table);
      let drag = null;
      this.svg.addEventListener("pointerdown", (e) => {
        const p = svgPoint(this.svg, e); const w = this.toW([p.x, p.y]);
        const Aq = this.Aq();
        if (p.x < 400 && (G.pointInPoly(w, Aq) || G.len(G.sub(w, this.q)) < 0.25)) { drag = G.sub(w, this.q); this.slideS = null; try { this.svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } }
      });
      this.svg.addEventListener("pointermove", (e) => { if (!drag) return; const p = svgPoint(this.svg, e); const w = this.toW([p.x, p.y]); this.q = [Math.max(-3.9, Math.min(3.9, w[0] - drag[0])), Math.max(-3.9, Math.min(3.9, w[1] - drag[1]))]; this.render(); });
      this.svg.addEventListener("pointerup", () => { drag = null; });
      this.render();
    }
    toS(p) { return [200 + 48 * p[0], 200 - 48 * p[1]]; }
    toW(p) { return [(p[0] - 200) / 48, (200 - p[1]) / 48]; }
    Abody() { return this.A0.map((p) => G.rot(p, this.theta)); }
    Aq() { return this.Abody().map((p) => G.add(p, this.q)); }
    // 星形算法：返回按法向角排序的接触与 Cobs 顶点
    compute() {
      const A = this.Abody(), O = this.O, m = A.length, k = O.length;
      const items = [];
      for (let j = 0; j < k; j++) {
        const e = G.sub(O[(j + 1) % k], O[j]), n = [e[1], -e[0]];
        let i = 0; for (let t = 1; t < m; t++) if (G.dot(n, A[t]) < G.dot(n, A[i]) - 1e-9) i = t;
        items.push({ type: "VE", ang: G.ang(n), vtx: this.An[i], edge: `${this.On[j]}-${this.On[(j + 1) % k]}`, n, c: G.sub(A[i], O[j]), sgn: 1, ai: i, oj: j, vLabel: `${this.An[i]}(q) − ${this.On[j]}` });
      }
      for (let i = 0; i < m; i++) {
        const e = G.sub(A[(i + 1) % m], A[i]), n = [e[1], -e[0]];
        let j = 0; for (let t = 1; t < k; t++) if (G.dot(n, O[t]) < G.dot(n, O[j]) - 1e-9) j = t;
        items.push({ type: "EV", ang: G.ang([-n[0], -n[1]]), vtx: this.On[j], edge: `${this.An[i]}-${this.An[(i + 1) % m]}`, n, c: G.sub(O[j], A[i]), sgn: -1, ai: i, oj: j, vLabel: `${this.On[j]} − ${this.An[i]}(q)` });
      }
      items.sort((x, y) => x.ang - y.ang);
      // Cobs 顶点：O ⊕ (−A) 的凸包
      const pts = []; O.forEach((o) => A.forEach((a) => pts.push(G.sub(o, a))));
      const hull = G.hull(pts);
      // 给每条凸包边找到对应的接触（法向角相同）
      const edges = hull.map((p, i) => {
        const q = hull[(i + 1) % hull.length], d = G.sub(q, p), ang = G.ang([d[1], -d[0]]);
        const its = items.filter((it) => Math.abs(((it.ang - ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 1e-6);
        return { p, q, ang, its };
      });
      return { items, hull, edges };
    }
    placeOnBoundary(sv) {
      const { hull } = this.compute();
      const L = hull.map((p, i) => G.len(G.sub(hull[(i + 1) % hull.length], p)));
      const tot = L.reduce((a, b) => a + b, 0);
      let t = sv * tot;
      for (let i = 0; i < hull.length; i++) {
        if (t <= L[i] || i === hull.length - 1) { const u = Math.min(1, t / L[i]); const p = hull[i], q = hull[(i + 1) % hull.length]; this.q = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; return; }
        t -= L[i];
      }
    }
    animate() {
      if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; return; }
      let s0 = this.slideS || 0;
      const step = () => { s0 += 0.003; if (s0 > 1) { this.anim = null; return; } this.slideS = s0; this.sSl.set(s0); this.placeOnBoundary(s0); this.render(); this.anim = requestAnimationFrame(step); };
      this.anim = requestAnimationFrame(step);
    }
    coef(it) { // 返回 [a, b, k]：a·xt + b·yt + k ≤ 0，整数时约分
      let a = it.sgn * it.n[0], b = it.sgn * it.n[1], k = G.dot(it.n, it.c);
      const isInt = [a, b, k].every((x) => Math.abs(x - Math.round(x)) < 1e-9);
      if (isInt) {
        const gcd = (x, y) => (y ? gcd(y, x % y) : x);
        const g = gcd(gcd(Math.abs(Math.round(a)), Math.abs(Math.round(b))), Math.abs(Math.round(k))) || 1;
        return [Math.round(a) / g, Math.round(b) / g, Math.round(k) / g, true];
      }
      const L = Math.hypot(a, b); return [a / L, b / L, k / L, false];
    }
    vStr(it) { // v 的显式坐标，例如 [x_t − 2, y_t]
      const d = Math.abs(this.theta) < 1e-9 && this.pid !== "pent" && this.pid !== "ex11" ? 0 : 2;
      const comp = (cst, varName) => {
        const sg = it.sgn; // VE: c + q；EV: c − q
        const v = sg > 0 ? `${varName}` : `−${varName}`;
        if (Math.abs(cst) < 1e-9) return v;
        const cs = num(Math.abs(cst), d);
        return sg > 0 ? `${varName} ${cst < 0 ? "−" : "+"} ${cs}` : `${cst < 0 ? "−" : ""}${cs} − ${varName}`;
      };
      return `[${comp(it.c[0], "x<sub>t</sub>")}, ${comp(it.c[1], "y<sub>t</sub>")}]`;
    }
    hpStr(c) {
      const [a, b, k, isInt] = c, d = isInt ? 0 : 2;
      const term = (v, x, first) => { if (Math.abs(v) < 1e-9) return ""; const sg = v < 0 ? "−" : first ? "" : "+"; const mag = Math.abs(Math.abs(v) - 1) < 1e-9 ? "" : num(Math.abs(v), d); return `${first ? "" : " "}${sg}${first ? "" : " "}${mag}${x}`; };
      let out = term(a, "x<sub>t</sub>", true); out += term(b, "y<sub>t</sub>", !out);
      if (Math.abs(k) > 1e-9) out += ` ${k < 0 ? "−" : "+"} ${num(Math.abs(k), d)}`;
      return out + " ≤ 0";
    }
    render() {
      const svg = this.svg; svg.innerHTML = "";
      const { items, hull, edges } = this.compute();
      const Aq = this.Aq(), O = this.O, q = this.q;
      const coll = G.convexIntersect(Aq, O);
      const vals = items.map((it) => { const c = this.coef(it); return c[0] * q[0] + c[1] * q[1] + c[2]; });
      const inC = vals.every((v) => v <= 1e-9);
      // 网格
      for (let k = -4; k <= 4; k++) {
        const a = this.toS([k, -4]), b = this.toS([k, 4]), c = this.toS([-4, k]), d = this.toS([4, k]);
        svg.append(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: k ? "var(--c-grid)" : "var(--border-strong)", "stroke-width": k ? 0.7 : 1.2 }));
        svg.append(s("line", { x1: c[0], y1: c[1], x2: d[0], y2: d[1], stroke: k ? "var(--c-grid)" : "var(--border-strong)", "stroke-width": k ? 0.7 : 1.2 }));
        if (k) svg.append(s("text", { x: this.toS([k, 0])[0], y: 214, "text-anchor": "middle", "font-size": 9, fill: "var(--muted)" }, k));
      }
      const poly = (P, attrs) => s("polygon", Object.assign({ points: P.map((p) => this.toS(p).map((v) => v.toFixed(1)).join(",")).join(" ") }, attrs));
      svg.append(poly(hull, { fill: "var(--accent)", "fill-opacity": 0.1, stroke: "none" }));
      // 当前接触的边
      let curEdge = -1;
      edges.forEach((e, i) => {
        const onIt = G.distPointSeg(q, e.p, e.q) < 1e-6 && this.slideS !== null;
        if (onIt && curEdge < 0) curEdge = i;
      });
      edges.forEach((e, i) => {
        const a = this.toS(e.p), b = this.toS(e.q), typ = e.its.map((x) => x.type).join("+");
        const col = typ.startsWith("VE") ? "var(--ok)" : "var(--bad)";
        svg.append(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: col, "stroke-width": i === curEdge ? 5 : 2.4, "stroke-dasharray": "7 4" }));
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [Math.cos(e.ang), -Math.sin(e.ang)];
        svg.append(s("text", { x: mid[0] + n[0] * 16, y: mid[1] + n[1] * 16 + 4, "text-anchor": "middle", "font-size": 11, fill: col, "font-weight": 600 }, typ));
      });
      svg.append(poly(O, { fill: "var(--ok)", "fill-opacity": 0.55, stroke: "var(--ok)", "stroke-width": 1.5 }));
      O.forEach((p, j) => { const P = this.toS(p); svg.append(s("text", { x: P[0] + (p[0] >= 0 ? 4 : -18), y: P[1] + (p[1] >= 0 ? -4 : 13), "font-size": 11, fill: "var(--ok)" }, this.On[j])); });
      svg.append(poly(Aq, { fill: "var(--bad)", "fill-opacity": coll ? 0.6 : 0.35, stroke: "var(--bad)", "stroke-width": 1.8, style: "cursor:grab" }));
      Aq.forEach((p, i) => { const P = this.toS(p); svg.append(s("text", { x: P[0] + 4, y: P[1] - 4, "font-size": 11, fill: "var(--bad)" }, this.An[i])); });
      // 接触高亮
      if (curEdge >= 0) {
        edges[curEdge].its.forEach((it) => {
          const m = Aq.length, k = O.length;
          if (it.type === "VE") {
            const P = this.toS(Aq[it.ai]), e0 = this.toS(O[it.oj]), e1 = this.toS(O[(it.oj + 1) % k]);
            svg.append(s("line", { x1: e0[0], y1: e0[1], x2: e1[0], y2: e1[1], stroke: "var(--warn)", "stroke-width": 4 }));
            svg.append(s("circle", { cx: P[0], cy: P[1], r: 6, fill: "var(--warn)" }));
          } else {
            const P = this.toS(O[it.oj]), e0 = this.toS(Aq[it.ai]), e1 = this.toS(Aq[(it.ai + 1) % m]);
            svg.append(s("line", { x1: e0[0], y1: e0[1], x2: e1[0], y2: e1[1], stroke: "var(--warn)", "stroke-width": 4 }));
            svg.append(s("circle", { cx: P[0], cy: P[1], r: 6, fill: "var(--warn)" }));
          }
        });
      }
      // 机器人原点 = q
      const Q = this.toS(q);
      svg.append(s("circle", { cx: Q[0], cy: Q[1], r: 5, fill: "var(--text)", stroke: "var(--surface)", "stroke-width": 1.5 }));
      svg.append(s("text", { x: Q[0] + 7, y: Q[1] + 14, "font-size": 12, fill: "var(--text)" }, "q"));
      // 右侧：S¹ 上的法向排序（图 4.15b）
      const C = [530, 120], R = 78;
      svg.append(s("text", { x: C[0], y: 22, "text-anchor": "middle", "font-size": 12, fill: "var(--text-2)" }, "法向在 S¹ 上排序（图 4.15b）"));
      svg.append(s("circle", { cx: C[0], cy: C[1], r: R, fill: "none", stroke: "var(--border-strong)" }));
      const curIts = curEdge >= 0 ? edges[curEdge].its : [];
      items.forEach((it, idx) => {
        const u = [Math.cos(it.ang), -Math.sin(it.ang)], col = it.type === "VE" ? "var(--ok)" : "var(--bad)";
        const on = curIts.includes(it);
        svg.append(s("line", { x1: C[0], y1: C[1], x2: C[0] + u[0] * R, y2: C[1] + u[1] * R, stroke: col, "stroke-width": on ? 4 : 2 }));
        svg.append(s("circle", { cx: C[0] + u[0] * R, cy: C[1] + u[1] * R, r: on ? 6 : 4, fill: col }));
        svg.append(s("text", { x: C[0] + u[0] * (R + 16), y: C[1] + u[1] * (R + 16) + 4, "text-anchor": "middle", "font-size": 11, fill: col, "font-weight": on ? 700 : 400 }, `${idx + 1}`));
      });
      svg.append(s("text", { x: C[0], y: C[1] + R + 36, "text-anchor": "middle", "font-size": 11, fill: "var(--ok)" }, "绿 β：O 的外法向 → Type VE"));
      svg.append(s("text", { x: C[0], y: C[1] + R + 52, "text-anchor": "middle", "font-size": 11, fill: "var(--bad)" }, "红 α：A 的内法向 → Type EV"));
      svg.append(s("text", { x: C[0], y: C[1] + R + 76, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, `Cobs 有 ${hull.length} 条边（${O.length} + ${Aq.length}${hull.length < O.length + Aq.length ? "，有共线的边被合并" : ""}）`));
      svg.append(s("text", { x: C[0], y: C[1] + R + 96, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, "虚线 = Cobs 的边界（机器人原点的轨迹）"));
      this.info.innerHTML = `q = (${num(q[0], 2)}, ${num(q[1], 2)})：A(q) ${coll ? "<b style='color:var(--bad)'>与 O 相交</b>" : "与 O 不相交"}；按下表的半平面判断，q ${inC ? "<b>∈ Cobs</b>（所有值 ≤ 0）" : "∉ Cobs（至少一个值 &gt; 0）"}。两种判断始终一致。`;
      // 表（图 4.19 的格式）
      const rows = items.map((it, idx) => {
        const c = this.coef(it), v = vals[idx], on = curIts.includes(it);
        const nn = c[3] ? `[${num(it.sgn * c[0], 0)}, ${num(it.sgn * c[1], 0)}]` : `[${num(it.sgn * c[0], 2)}, ${num(it.sgn * c[1], 2)}]`;
        return `<tr style="${on ? "background:var(--warn-soft)" : ""}"><td>${idx + 1}</td><td><b style="color:${it.type === "VE" ? "var(--ok)" : "var(--bad)"}">${it.type}</b></td><td>${it.vtx}</td><td>${it.edge}</td><td class="mono">${nn}</td><td class="mono">${it.vLabel} = ${this.vStr(it)}</td><td>${this.hpStr(c)}</td><td class="mono" style="color:${v > 1e-9 ? "var(--muted)" : "var(--bad)"}">${num(v, 2)}</td></tr>`;
      }).join("");
      this.table.innerHTML = `<table class="data"><thead><tr><th>#</th><th>类型</th><th>顶点</th><th>边</th><th>n（外法向）</th><th>v</th><th>半平面 H</th><th>在 q 处的值</th></tr></thead><tbody>${rows}</tbody></table>` +
        (this.pid === "book" && Math.abs(this.theta) < 1e-9 ? `<p class="small muted" style="margin:4px 0 0">对照原书图 4.19：半平面除第 5 行外完全一致。第 5 行原书写作 v = [−1 − x<sub>t</sub>, −y<sub>t</sub>]、−x<sub>t</sub> − y<sub>t</sub> − 1 ≤ 0，应为上表的结果（见脚注 3）。第 7 行原书的 v 从 a3 出发、这里从 a2 出发：两者相差一个平行于该边的向量，n·v 不变，所以半平面相同。</p>` : "");
    }
  }

  // =====================================================================
  // 12. 两连杆机械臂的 C-space 障碍（环面 T²）
  // =====================================================================
  const ARM_PRESETS = {
    one: { name: "一块障碍", obs: [[[0.9, 0.7], [1.5, 0.7], [1.5, 1.3], [0.9, 1.3]]], qI: [1.49, 0.24], qG: [4.84, 0.24] },
    two: { name: "两块障碍", obs: [[[0.8, 0.5], [1.4, 0.5], [1.4, 1.1], [0.8, 1.1]], [[-1.4, -0.6], [-0.9, -1.2], [-0.5, -0.7], [-1.0, -0.2]]], qI: [0.24, 2.33], qG: [4.42, 0.24] },
    pillar: { name: "左边一根柱子（需要绕回）", obs: [[[-0.95, -0.22], [-0.55, -0.22], [-0.55, 0.22], [-0.95, 0.22]]], qI: [Math.PI / 2, 0.3], qG: [1.5 * Math.PI, 0.3] },
  };

  class ArmCSpace {
    constructor(root) {
      this.body = shell(root, "两连杆机械臂的 C-space 障碍", "左：工作空间 W；右：C = S¹ × S¹（左右、上下各自粘合）");
      this.N = 120; this.L1 = 1; this.L2 = 0.8; this.wrap = true;
      this.pid = "two";
      this.loadPreset();
      this.build();
    }
    loadPreset() { const P = ARM_PRESETS[this.pid]; this.obs = P.obs.map((o) => o.map((p) => p.slice())); this.qI = P.qI.slice(); this.qG = P.qG.slice(); this.cur = P.qI.slice(); this.path = null; }
    build() {
      const b = this.body;
      const sel = h("select", null, Object.entries(ARM_PRESETS).map(([k, p]) => h("option", { value: k, selected: k === this.pid }, p.name)));
      sel.addEventListener("change", () => { this.pid = sel.value; this.loadPreset(); this.recompute(); });
      b.append(h("div", { class: "controls" }, sel,
        slider("L₁", 0.4, 1.4, 0.05, this.L1, (v) => { this.L1 = v; this.recompute(); }, (v) => num(v, 2)),
        slider("L₂", 0.3, 1.2, 0.05, this.L2, (v) => { this.L2 = v; this.recompute(); }, (v) => num(v, 2))),
      h("div", { class: "controls" },
        button("当前配置设为 q<sub>I</sub>", () => { this.qI = this.cur.slice(); this.plan(); }, "small"),
        button("当前配置设为 q<sub>G</sub>", () => { this.qG = this.cur.slice(); this.plan(); }, "small"),
        (this.btnPlay = button("▶ 沿路径运动", () => this.play(), "small primary")),
        checkbox("规划器知道 θ 会绕回（环面拓扑）", this.wrap, (v) => { this.wrap = v; this.plan(); })));
      const c1 = h("div"), c2 = h("div");
      this.info = h("div", { class: "status-line", style: "margin-top:8px" });
      b.append(h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, c1, c2), this.info);
      this.ws = makeCanvas(c1, { aspect: 1, maxW: 400 }, (ctx, w) => this.drawW(ctx, w));
      this.cs = makeCanvas(c2, { aspect: 1, maxW: 400 }, (ctx, w) => this.drawC(ctx, w));
      // 工作空间：拖障碍
      let dragO = -1, last = null;
      onDrag(this.ws.canvas, {
        down: (p) => { const w = this.toW(p); dragO = this.obs.findIndex((o) => G.pointInPoly(w, o)); last = w; return dragO >= 0; },
        move: (p) => { const w = this.toW(p); const d = G.sub(w, last); last = w; this.obs[dragO] = this.obs[dragO].map((v) => G.add(v, d)); this.schedule(); },
        up: () => { dragO = -1; this.plan(); },
        hover: (p) => { const w = this.toW(p); this.ws.canvas.style.cursor = this.obs.some((o) => G.pointInPoly(w, o)) ? "grab" : "default"; },
      });
      // C-space：拖动设置当前配置
      const setCur = (p) => { const g = this.geomC(); const t1 = ((p.x - g.m) / g.S) * 2 * Math.PI, t2 = (1 - (p.y - g.m) / g.S) * 2 * Math.PI; if (t1 < 0 || t1 > 2 * Math.PI || t2 < 0 || t2 > 2 * Math.PI) return; this.cur = [t1, t2]; this.hover = null; this.ws.redraw(); this.cs.redraw(); this.status(); };
      onDrag(this.cs.canvas, { down: (p) => { this.stopPlay(); setCur(p); }, move: setCur, hover: (p) => { const g = this.geomC(); const t1 = ((p.x - g.m) / g.S) * 2 * Math.PI, t2 = (1 - (p.y - g.m) / g.S) * 2 * Math.PI; this.hover = t1 >= 0 && t1 <= 6.2832 && t2 >= 0 && t2 <= 6.2832 ? [t1, t2] : null; this.ws.redraw(); }, leave: () => { this.hover = null; this.ws.redraw(); } });
      this.cs.canvas.style.cursor = "crosshair";
      this.recompute();
    }
    toS(p, w) { const k = w / 4.6; return [w / 2 + k * p[0], w / 2 - k * p[1]]; }
    toW(p) { const w = this.ws.w, k = w / 4.6; return [(p.x - w / 2) / k, (w / 2 - p.y) / k]; }
    geomC() { const w = this.cs.w, m = 28; return { m, S: w - m - 8 }; }
    joints(t) { const p1 = [this.L1 * Math.cos(t[0]), this.L1 * Math.sin(t[0])]; return [[0, 0], p1, G.add(p1, [this.L2 * Math.cos(t[0] + t[1]), this.L2 * Math.sin(t[0] + t[1])])]; }
    collide(t) { // 0 = 自由, 1 = 连杆 1 碰撞, 2 = 只有连杆 2 碰撞
      const J = this.joints(t);
      for (const o of this.obs) if (G.segHitsPoly(J[0], J[1], o)) return 1;
      for (const o of this.obs) if (G.segHitsPoly(J[1], J[2], o)) return 2;
      return 0;
    }
    schedule() { if (this.pending) return; this.pending = requestAnimationFrame(() => { this.pending = null; this.recompute(true); }); }
    recompute(noPlan) {
      const N = this.N; this.grid = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.grid[j * N + i] = this.collide([((i + 0.5) / N) * 2 * Math.PI, ((j + 0.5) / N) * 2 * Math.PI]);
      this.img = null;
      if (noPlan) { this.path = null; this.ws.redraw(); this.cs.redraw(); this.status(); } else this.plan();
    }
    idx(t) { const N = this.N; return [Math.min(N - 1, Math.floor((t[0] / (2 * Math.PI)) * N)), Math.min(N - 1, Math.floor((t[1] / (2 * Math.PI)) * N))]; }
    plan() {
      const N = this.N, [si, sj] = this.idx(this.qI), [gi, gj] = this.idx(this.qG);
      const s0 = sj * N + si, g = gj * N + gi;
      this.path = null;
      if (!this.grid[s0] && !this.grid[g]) {
        const prev = new Int32Array(N * N).fill(-1), seen = new Uint8Array(N * N), Q = [s0]; seen[s0] = 1;
        for (let k = 0; k < Q.length; k++) {
          const u = Q[k]; if (u === g) break;
          const i = u % N, j = (u / N) | 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            let ni = i + di, nj = j + dj;
            if (ni < 0 || ni >= N || nj < 0 || nj >= N) { if (!this.wrap) continue; ni = (ni + N) % N; nj = (nj + N) % N; }
            const v = nj * N + ni; if (seen[v] || this.grid[v]) continue;
            seen[v] = 1; prev[v] = u; Q.push(v);
          }
        }
        if (seen[g]) { const p = []; for (let u = g; u !== -1; u = prev[u]) p.push([(((u % N) + 0.5) / N) * 2 * Math.PI, ((((u / N) | 0) + 0.5) / N) * 2 * Math.PI]); this.path = p.reverse(); }
      }
      this.ws.redraw(); this.cs.redraw(); this.status();
    }
    status() {
      const c = this.collide(this.cur);
      const free = (t) => !this.grid[this.idx(t)[1] * this.N + this.idx(t)[0]];
      const crossings = this.path ? this.path.slice(1).filter((p, k) => Math.abs(p[0] - this.path[k][0]) > 1 || Math.abs(p[1] - this.path[k][1]) > 1).length : 0;
      let msg = `当前 q = (θ₁, θ₂) = (${num((this.cur[0] * 180) / Math.PI, 0)}°, ${num((this.cur[1] * 180) / Math.PI, 0)}°)：${c ? `<b style="color:var(--bad)">碰撞</b>（连杆 ${c} ${c === 2 ? "" : "（第一根）"}）` : "自由"}。`;
      if (!free(this.qI) || !free(this.qG)) msg += " q<sub>I</sub> 或 q<sub>G</sub> 落在 Cobs 里了，重新设置。";
      else msg += this.path ? ` <b style="color:var(--ok)">找到路径</b>${crossings ? `，穿过粘合边 ${crossings} 次` : ""}。` : ` <b style="color:var(--bad)">q<sub>I</sub> 与 q<sub>G</sub> 不连通</b>${this.wrap ? "" : "（试试勾上「环面拓扑」）"}。`;
      this.info.innerHTML = msg + " <span class='muted'>右图拖动/点击 = 选配置；左图拖动障碍物。饱和的绿色 = 第一根连杆撞上；颜色较淡（更接近背景）= 只有第二根撞上。</span>";
    }
    play() {
      if (this.anim) { this.stopPlay(); return; }
      if (!this.path) return;
      let k = 0; this.btnPlay.innerHTML = "⏸ 停";
      const step = () => { if (k >= this.path.length) { this.stopPlay(); return; } this.cur = this.path[k].slice(); k += 1; this.ws.redraw(); this.cs.redraw(); this.status(); this.anim = requestAnimationFrame(step); };
      this.anim = requestAnimationFrame(step);
    }
    stopPlay() { if (this.anim) cancelAnimationFrame(this.anim); this.anim = null; if (this.btnPlay) this.btnPlay.innerHTML = "▶ 沿路径运动"; }
    drawArm(ctx, w, t, col, wd) {
      const J = this.joints(t).map((p) => this.toS(p, w));
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(J[0][0], J[0][1]); ctx.lineTo(J[1][0], J[1][1]); ctx.lineTo(J[2][0], J[2][1]); ctx.stroke();
      ctx.fillStyle = col; J.forEach((p, i) => { ctx.beginPath(); ctx.arc(p[0], p[1], i === 2 ? 3 : 4.5, 0, 7); ctx.fill(); });
    }
    drawW(ctx, w) {
      const P = palette(); ctx.clearRect(0, 0, w, w);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      const r = (this.L1 + this.L2) * (w / 4.6);
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(w / 2, w / 2, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      this.obs.forEach((o) => { ctx.fillStyle = alpha(P.ok, 0.75); ctx.beginPath(); o.forEach((p, i) => { const q = this.toS(p, w); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); });
      if (this.hover) this.drawArm(ctx, w, this.hover, alpha(P.muted, 0.6), 3);
      [[this.qI, P.start], [this.qG, P.goal]].forEach(([t, c]) => this.drawArm(ctx, w, t, alpha(c, 0.45), 3));
      const c = this.collide(this.cur);
      this.drawArm(ctx, w, this.cur, c ? P.bad : P.text, 5);
      ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
      ctx.fillText("W = ℝ²（蓝 = q_I，粉 = q_G）", 8, w - 8);
    }
    drawC(ctx, w) {
      const P = palette(), { m, S } = this.geomC(), N = this.N;
      ctx.clearRect(0, 0, w, w);
      if (!this.img || this.imgTheme !== P.ok + P.surface) {
        const off = document.createElement("canvas"); off.width = N; off.height = N;
        const octx = off.getContext("2d"), id = octx.createImageData(N, N);
        const rgb = (c) => { const m_ = c.match(/\d+/g); if (c.startsWith("#")) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return m_.slice(0, 3).map(Number); };
        const cs = rgb(P.surface), c1 = rgb(P.ok), c2 = rgb(CH4.mix(P.ok, P.surface, 0.55));
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const v = this.grid[j * N + i], col = v === 1 ? c1 : v === 2 ? c2 : cs, k = ((N - 1 - j) * N + i) * 4;
          id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = 255;
        }
        octx.putImageData(id, 0, 0); this.img = off; this.imgTheme = P.ok + P.surface;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.img, m, 8, S, S);
      ctx.strokeStyle = this.wrap ? P.accent : P.borderStrong; ctx.lineWidth = 2; ctx.setLineDash(this.wrap ? [6, 4] : []);
      ctx.strokeRect(m, 8, S, S); ctx.setLineDash([]);
      const T = (t) => [m + (t[0] / (2 * Math.PI)) * S, 8 + (1 - t[1] / (2 * Math.PI)) * S];
      if (this.path) {
        ctx.strokeStyle = P.path; ctx.lineWidth = 2.5; ctx.beginPath();
        this.path.forEach((t, k) => { const p = T(t); if (k === 0 || Math.abs(t[0] - this.path[k - 1][0]) > 1 || Math.abs(t[1] - this.path[k - 1][1]) > 1) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
        ctx.stroke();
      }
      [[this.qI, P.start, "q_I"], [this.qG, P.goal, "q_G"]].forEach(([t, c, l]) => { const p = T(t); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], 5.5, 0, 7); ctx.fill(); ctx.fillStyle = P.text; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillText(l, p[0] + 7, p[1] - 6); });
      const p = T(this.cur); ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = "center"; ctx.fillText("θ₁：0 → 2π", m + S / 2, w - 1);
      ctx.save(); ctx.translate(12, 8 + S / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("θ₂：0 → 2π", 0, 0); ctx.restore(); ctx.textAlign = "left";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reg = { "minkowski-1d": Minkowski1D, star: Star, "arm-cspace": ArmCSpace };
    for (const [k, C] of Object.entries(reg)) document.querySelectorAll(`[data-widget='${k}']`).forEach((el) => { try { el._w = new C(el); } catch (e) { console.error(k, e); } });
  });
})();
