/* 15.4 节：换位运动与 Lie 括号、分布（切丛的切片）、符号 Lie 括号计算器（P. Hall 基 + 秩条件）、P. Hall 基生成器 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH15;

  // ===============================================================
  // 小型符号代数：多项式，变量分「线性」与「角度」（角度变量只以 sin、cos 出现，sin² 化成 1 − cos²）
  // 与参考代码第 11 项的 Python 版本相同
  // ===============================================================
  class Poly {
    constructor(V, t) { this.V = V; this.t = new Map(); if (t) for (const [k, c] of t) if (Math.abs(c) > 1e-12) this.t.set(k, c); }
    static layout(V) { const pos = []; let n = 0; for (const v of V) { pos.push(n); n += v.kind === "ang" ? 2 : 1; } return { pos, n }; }
    static zero(V) { return new Poly(V); }
    static const(V, c) { const { n } = Poly.layout(V); return new Poly(V, [[new Array(n).fill(0).join(","), c]]); }
    static vr(V, i, which) { const { pos, n } = Poly.layout(V), e = new Array(n).fill(0); e[pos[i] + (which === "cos" ? 1 : 0)] = 1; return new Poly(V, [[e.join(","), 1]]); }
    norm() {
      const { pos } = Poly.layout(this.V), out = new Map(), stack = [...this.t.entries()];
      while (stack.length) {
        const [k, c] = stack.pop(), e = k.split(",").map(Number);
        let red = -1; this.V.forEach((v, i) => { if (red < 0 && v.kind === "ang" && e[pos[i]] >= 2) red = pos[i]; });
        if (red < 0) { out.set(k, (out.get(k) || 0) + c); continue; }
        const e1 = e.slice(); e1[red] -= 2; stack.push([e1.join(","), c]);
        const e2 = e1.slice(); e2[red + 1] += 2; stack.push([e2.join(","), -c]);
      }
      return new Poly(this.V, [...out.entries()].map(([k, c]) => [k, Math.abs(c - Math.round(c)) < 1e-10 ? Math.round(c) : c]));
    }
    add(o, s) { s = s === undefined ? 1 : s; const r = new Map(this.t); for (const [k, c] of o.t) r.set(k, (r.get(k) || 0) + s * c); return new Poly(this.V, [...r.entries()]); }
    mul(o) {
      if (typeof o === "number") return new Poly(this.V, [...this.t.entries()].map(([k, c]) => [k, c * o]));
      const r = new Map();
      for (const [k1, c1] of this.t) { const e1 = k1.split(",").map(Number); for (const [k2, c2] of o.t) { const e2 = k2.split(","); const k = e1.map((v, i) => v + +e2[i]).join(","); r.set(k, (r.get(k) || 0) + c1 * c2); } }
      return new Poly(this.V, [...r.entries()]).norm();
    }
    pow(n) { let r = Poly.const(this.V, 1); for (let i = 0; i < n; i++) r = r.mul(this); return r; }
    d(i) {
      const { pos } = Poly.layout(this.V), p = pos[i], ang = this.V[i].kind === "ang", r = new Map();
      const put = (e, c) => { const k = e.join(","); r.set(k, (r.get(k) || 0) + c); };
      for (const [k, c] of this.t) {
        const e = k.split(",").map(Number);
        if (!ang) { if (e[p]) { const e1 = e.slice(); e1[p]--; put(e1, c * e[p]); } }
        else {
          const a = e[p], b = e[p + 1];
          if (a) { const e1 = e.slice(); e1[p]--; e1[p + 1]++; put(e1, c * a); }
          if (b) { const e1 = e.slice(); e1[p + 1]--; e1[p]++; put(e1, -c * b); }
        }
      }
      return new Poly(this.V, [...r.entries()]).norm();
    }
    ev(x) {
      const { pos } = Poly.layout(this.V); let tot = 0;
      for (const [k, c] of this.t) {
        const e = k.split(",").map(Number); let m = c;
        this.V.forEach((v, i) => { if (v.kind === "ang") m *= Math.pow(Math.sin(x[i]), e[pos[i]]) * Math.pow(Math.cos(x[i]), e[pos[i] + 1]); else m *= Math.pow(x[i], e[pos[i]]); });
        tot += m;
      }
      return tot;
    }
    isZero() { return this.t.size === 0; }
    str() {
      if (!this.t.size) return "0";
      const { pos } = Poly.layout(this.V);
      const sup = (n) => (n > 1 ? String(n).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]).join("") : "");
      const terms = [...this.t.entries()].map(([k, c]) => {
        const e = k.split(",").map(Number), f = [];
        this.V.forEach((v, i) => {
          if (v.kind === "ang") { if (e[pos[i]]) f.push("sin" + sup(e[pos[i]]) + v.name); if (e[pos[i] + 1]) f.push("cos" + sup(e[pos[i] + 1]) + v.name); }
          else if (e[pos[i]]) f.push(v.name + sup(e[pos[i]]));
        });
        return { c, m: f.join(" "), deg: e.reduce((a, b) => a + b, 0) };
      }).sort((a, b) => b.deg - a.deg || a.m.localeCompare(b.m));
      let s = "";
      terms.forEach((t, i) => {
        const neg = t.c < 0, a = Math.abs(t.c), cs = Number.isInteger(a) ? String(a) : +a.toFixed(4) + "";
        const body = t.m ? (a === 1 ? t.m : cs + t.m) : cs;
        s += i === 0 ? (neg ? "−" : "") + body : (neg ? " − " : " + ") + body;
      });
      return s;
    }
  }
  function bracket(f, g) {
    const n = f.length, V = f[0].V;
    return f.map((_, i) => { let s = Poly.zero(V); for (let j = 0; j < n; j++) s = s.add(g[i].d(j).mul(f[j])).add(f[i].d(j).mul(g[j]), -1); return s.norm(); });
  }
  const vfStr = (v) => "(" + v.map((p) => p.str()).join(", ") + ")";

  // 解析器：支持 + − * ^ 括号、数字、变量名、sin(变量)、cos(变量)；数字与变量相邻视为相乘
  function parseSystem(varsText, fieldsText) {
    const names = varsText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) throw new Error("请先写出状态变量");
    const lines = fieldsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const comps = lines.map((l) => l.replace(/^[^:：]*[:：]/, "").split(/[;；]/).map((s) => s.trim()));
    // 先找出哪些变量在 sin/cos 里出现
    const ang = new Set(); for (const m of fieldsText.matchAll(/(sin|cos)\s*\(\s*([^\s()]+)\s*\)/g)) ang.add(m[2]);
    const V = names.map((nm) => ({ name: nm, kind: ang.has(nm) ? "ang" : "lin" }));
    const fields = comps.map((cs, li) => {
      if (cs.length !== names.length) throw new Error(`第 ${li + 1} 个向量场有 ${cs.length} 个分量，应为 ${names.length} 个（分量之间用分号 ; 隔开）`);
      return cs.map((src) => parseExpr(src, V));
    });
    return { V, fields };
  }
  function parseExpr(src, V) {
    const toks = src.match(/\d+\.?\d*|[A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*|[-+*^()]|\S/g) || [];
    let i = 0; const peek = () => toks[i], next = () => toks[i++];
    const idx = (nm) => V.findIndex((v) => v.name === nm);
    function primary() {
      const t = next();
      if (t === undefined) throw new Error(`「${src}」不完整`);
      if (/^\d/.test(t)) return Poly.const(V, parseFloat(t));
      if (t === "(") { const e = expr(); if (next() !== ")") throw new Error(`「${src}」括号不配对`); return e; }
      if (t === "sin" || t === "cos") {
        if (next() !== "(") throw new Error(`${t} 后面要跟 (变量)`);
        const nm = next(), k = idx(nm); if (k < 0) throw new Error(`${t}(${nm})：${nm} 不是状态变量`);
        if (next() !== ")") throw new Error(`${t}(…) 里只能是单个变量`);
        return Poly.vr(V, k, t);
      }
      const k = idx(t);
      if (k < 0) throw new Error(`不认识「${t}」`);
      if (V[k].kind === "ang") throw new Error(`${t} 是角度变量（出现在 sin/cos 里），不能再单独出现`);
      return Poly.vr(V, k);
    }
    function power() { let b = primary(); if (peek() === "^") { next(); const e = next(); if (!/^\d+$/.test(e)) throw new Error("指数只能是非负整数"); b = b.pow(+e); } return b; }
    function unary() { if (peek() === "-") { next(); return unary().mul(-1); } if (peek() === "+") { next(); return unary(); } return power(); }
    function term() {
      let a = unary();
      for (;;) {
        if (peek() === "*") { next(); a = a.mul(unary()); }
        else if (peek() !== undefined && peek() !== "+" && peek() !== "-" && peek() !== ")" && peek() !== "^") a = a.mul(unary());
        else return a;
      }
    }
    function expr() { let a = term(); while (peek() === "+" || peek() === "-") { const op = next(); a = a.add(term(), op === "-" ? -1 : 1); } return a; }
    const e = expr(); if (i < toks.length) throw new Error(`「${src}」末尾多了「${toks.slice(i).join("")}」`);
    return e.norm();
  }

  // P. Hall 基（书中 15.4.3 节的三条规则；与参考代码第 13 项相同）
  function phall(m, depth) {
    const PH = [], dep = [];
    for (let i = 0; i < m; i++) { PH.push({ gen: i }); dep.push(1); }
    for (let d = 2; d <= depth; d++) {
      const nw = [];
      for (let j = 0; j < PH.length; j++) for (let i = 0; i < j; i++) {
        if (dep[i] + dep[j] !== d) continue;
        const pj = PH[j];
        if (pj.gen !== undefined || pj.l <= i) nw.push({ l: i, r: j });
      }
      nw.sort((a, b) => a.l - b.l || a.r - b.r);
      for (const b of nw) { PH.push(b); dep.push(d); }
    }
    return { PH, dep };
  }
  function phName(PH, k, names) { const b = PH[k]; return b.gen !== undefined ? names[b.gen] : `[${phName(PH, b.l, names)},${phName(PH, b.r, names)}]`; }
  function mobius(n) { let r = 1, k = n; for (let p = 2; p * p <= k; p++) if (k % p === 0) { k /= p; if (k % p === 0) return 0; r = -r; } return k > 1 ? -r : r; }
  function witt(m, d) { let s = 0; for (let e = 1; e <= d; e++) if (d % e === 0) s += mobius(e) * Math.pow(m, d / e); return s / d; }

  // ===============================================================
  // 组件 1：换位运动 (15.71)，图 15.16、15.17
  // ===============================================================
  class Commutator {
    constructor(root) {
      this.sys = "diff"; this.dt = 0.5; this.prog = 4; this.rev = false;
      const body = C.frame(root, "换位运动：f、g、−f、−g 各走 Δt", "净位移 ≈ Δt²·[f, g]，方向是系统分布里「没有」的方向");
      this.st = new C.Stage({ view: [-1.6, 1.6, -1.2, 1.2], aspect: 0.72, maxW: 560, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sel = C.seg([["diff", "差速驱动 (15.54)"], ["ni", "非完整积分器 (15.83)"]], this.sys, (k) => { this.sys = k; this.update(); });
      this.sDt = C.slider("Δt =", 0.05, 1.2, 0.01, this.dt, (v) => { this.dt = v; this.update(); }, (v) => v.toFixed(2));
      this.rv = C.toggle("换个顺序：g、f、−g、−f", false, (v) => { this.rev = v; this.update(); });
      this.runner = new C.Runner(() => { this.prog = Math.min(4, this.prog + 0.025); this.st.draw(); return this.prog < 4; });
      this.stats = [C.stat("净位移"), C.stat("Δt²·[f, g]"), C.stat("|误差| / Δt²")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, this.sDt, this.rv, C.button("▶ 播放四段动作", () => { this.prog = 0; this.runner.start(); }, "primary")),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.note,
        C.legend([[C.cv("accent"), "u = (1,0) 或 (−1,0)：第一个向量场 ±f"], [C.cv("warn"), "u = (0,1) 或 (0,−1)：±g"], [C.cv("alive2"), "预测 Δt²[f,g]"], [C.cv("bad"), "实际净位移"]]));
      this.update();
    }
    // 四段精确积分：返回每段结束时的状态（含中间采样）
    run() {
      const dt = this.dt, order = this.rev ? [[0, 1], [1, 0], [0, -1], [-1, 0]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
      let q = [0, 0, 0]; const segs = [];
      for (const [u1, u2] of order) {
        const pts = [];
        for (let k = 0; k <= 30; k++) {
          const s = dt * k / 30;
          if (this.sys === "diff") pts.push([q[0] + u1 * s * Math.cos(q[2]), q[1] + u1 * s * Math.sin(q[2]), q[2] + u2 * s]);
          else pts.push([q[0] + u1 * s, q[1] + u2 * s, q[2] + (q[0] * u2 - q[1] * u1) * s]);
        }
        segs.push({ pts, u: [u1, u2] }); q = pts[pts.length - 1];
      }
      return segs;
    }
    update() {
      this.segs = this.run();
      const end = this.segs[3].pts[30], dt = this.dt, s = this.rev ? -1 : 1;
      const pred = this.sys === "diff" ? [0, -dt * dt * s, 0] : [0, 0, 2 * dt * dt * s];
      const f = (v) => `(${v.map((x) => (Math.abs(x) < 5e-7 ? "0" : x.toFixed(4))).join(", ")})`;
      this.stats[0].set(f(end)); this.stats[1].set(f(pred));
      this.stats[2].set((Math.hypot(end[0] - pred[0], end[1] - pred[1], end[2] - pred[2]) / (dt * dt)).toFixed(4));
      const sc = this.sys === "diff" ? dt * 1.25 + 0.08 : dt * 1.15 + 0.1;
      this.st.setView([-1.6 * sc, 1.6 * sc, -1.2 * sc, 1.2 * sc]);
      this.note.innerHTML = this.sys === "diff"
        ? `差速驱动：f = (cosθ, sinθ, 0)，g = (0, 0, 1)，例 15.9 算出 [f, g] = (sinθ, −cosθ, 0)，在 θ = 0 处是 (0, −1, 0)——<b>侧移</b>。精确的净位移是 (Δt(1 − cos Δt), −Δt sin Δt, 0)：侧移 ≈ Δt²，外加「稍微向前」≈ Δt³/2（脚注 9；参考代码第 12 项）。最后一栏随 Δt → 0 趋于 0，这正是极限 (15.80)。换个顺序，侧移反向：[g, f] = −[f, g]。`
        : `非完整积分器：f = (1, 0, −x₂)，g = (0, 1, x₁)，[f, g] = (0, 0, 2)（例 15.10）。在 (x₁, x₂) 平面里四段动作围成一个边长 Δt 的正方形，x₃ 的增量 = 2 × 围出的有向面积 = 2Δt²——这里没有高阶误差，因为这个系统是幂零的（它的 Lie 括号到第二层就是常数）。`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, Math.pow(10, Math.floor(Math.log10(st.view[1]))) / 2);
      const segs = this.segs, cols = [col.accent, col.warn, col.accent, col.warn];
      const full = Math.floor(this.prog), frac = this.prog - full;
      if (this.sys === "ni") {
        const P = segs.flatMap((s) => s.pts.map((p) => ({ x: p[0], y: p[1] })));
        st.poly(P, C.alpha(col.alive2, 0.15), null);
      }
      let cur = null;
      segs.forEach((s, i) => {
        if (i > full) return;
        const n = i < full ? 30 : Math.round(frac * 30);
        const P = s.pts.slice(0, n + 1).map((p) => ({ x: p[0], y: p[1] }));
        st.polyline(P, cols[i], 2.6);
        if (P.length > 1 && i < full) st.arrow(P[P.length - 2], P[P.length - 1], cols[i], 2.6, 8);
        cur = s.pts[n];
      });
      const end = segs[3].pts[30], dt = this.dt, s = this.rev ? -1 : 1;
      if (this.prog >= 4) {
        if (this.sys === "diff") { st.arrow({ x: 0, y: 0 }, { x: 0, y: -dt * dt * s }, col.alive2, 2.2, 8); st.arrow({ x: 0, y: 0 }, { x: end[0], y: end[1] }, col.bad, 1.8, 7); }
        else {
          const bx = 1.3 * st.view[1] / 1.6, h0 = 0, h1 = end[2];
          st.line({ x: bx, y: h0 }, { x: bx, y: h1 }, col.bad, 6); st.text(`Δx₃ = ${end[2].toFixed(3)}`, { x: bx, y: h1 }, col.bad, { dy: h1 >= 0 ? -10 : 10, size: 11, weight: 650 });
          st.text("x₃ 的变化", { x: bx, y: 0 }, col.muted, { dy: h1 >= 0 ? 12 : -12, size: 10.5 });
        }
      }
      if (this.sys === "diff") {
        const q = cur ? { x: cur[0], y: cur[1], th: cur[2] } : { x: 0, y: 0, th: 0 };
        const rs = Math.max(0.03, 0.45 * this.dt);
        C.drawDiff(st, { x: 0, y: 0, th: 0 }, C.alpha(col.muted, 0.6), { size: rs });
        C.drawDiff(st, q, col.text, { size: rs });
      } else if (cur) st.dot({ x: cur[0], y: cur[1] }, 6, col.text, col.surface, 2);
      st.dot({ x: 0, y: 0 }, 3.5, col.goal);
      st.text(this.sys === "diff" ? "x" : "x₁", { x: st.view[1], y: 0 }, col.muted, { dx: -10, dy: -8, size: 11 });
      st.text(this.sys === "diff" ? "y" : "x₂", { x: 0, y: st.view[3] }, col.muted, { dx: 10, dy: 10, size: 11 });
    }
  }

  // ===============================================================
  // 组件 2：分布 = 切丛的一个切片（图 15.15）；完全可积 vs 非完整
  // ===============================================================
  const DIST = {
    diff: { name: "差速驱动 (15.68)", axes: ["x", "y", "θ"], f: (p) => [[Math.cos(p[2]), Math.sin(p[2]), 0], [0, 0, 1]], box: 1.4,
      note: "△ = span{(cosθ, sinθ, 0), (0, 0, 1)}：每一点都是一张竖直的「小平面」，随 θ 绕竖轴转动。这些平面拼不成一族曲面（不可积）——随机动作的曲线可以到达附近的任何地方。" },
    ni: { name: "非完整积分器", axes: ["x₁", "x₂", "x₃"], f: (p) => [[1, 0, -p[1]], [0, 1, p[0]]], box: 1.4,
      note: "△ = span{(1, 0, −x₂), (0, 1, x₁)}：沿着 x₁、x₂ 越往外，小平面扭得越厉害（像 Heisenberg 群的「接触结构」）。同样不可积。" },
    sphere: { name: "困在球面上（例 15.13）", axes: ["x₁", "x₂", "x₃"], f: (p) => [[p[1], -p[0], 0], [p[2], 0, -p[0]]], box: 1.4, sphere: true,
      note: "(15.89) 的两个向量场张成的小平面恰好与过该点、以原点为心的球面相切（例 15.13）。这些平面拼成一族同心球面——叶状结构（foliation），每个球面是一片叶子（leaf）。随机动作的曲线永远离不开出发时所在的球面：完全可积。" },
  };
  class Distribution3D {
    constructor(root) {
      this.key = "diff"; this.v = new C.View3D(0.7, 0.45); this.curve = null;
      const body = C.frame(root, "分布：在每一点只允许一张「小平面」里的速度", "拖动画布旋转视角；「随机走一段」看积分曲线能去哪里");
      this.st = new C.Stage({ view: [-2.3, 2.3, -1.9, 1.9], aspect: 0.8, maxW: 560, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p, e) => ({ x: e.clientX, y: e.clientY, yaw: this.v.yaw, pitch: this.v.pitch }),
        onMove: (p, d, e) => { this.v.yaw = d.yaw + (e.clientX - d.x) * 0.01; this.v.pitch = C.clamp(d.pitch + (e.clientY - d.y) * 0.01, -1.4, 1.4); this.st.draw(); }, cursor: () => "grab" });
      this.sel = C.seg(Object.entries(DIST).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.curve = null; this.update(); });
      this.stats = [C.stat("dim △(x)"), C.stat("曲线终点到原点的距离 / 起点的距离")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, C.button("随机走一段", () => this.walk(), "primary")), this.st.wrap, h("div", { class: "stats" }, this.stats), this.note);
      this.update();
    }
    get S() { return DIST[this.key]; }
    walk() {
      const r = C.rng((Date.now() & 0xffff) + 1), S = this.S, p0 = S.sphere ? [0.75, 0.35, 0.45] : [0.2, -0.3, 0.1];
      let p = p0.slice(); const pts = [p.slice()];
      for (let k = 0; k < 12; k++) {
        const u = [r() * 2 - 1, r() * 2 - 1];
        for (let m = 0; m < 25; m++) {
          p = C.rk4Step((t, x) => { const F = S.f(x); return [0, 1, 2].map((i) => u[0] * F[0][i] + u[1] * F[1][i]); }, 0, p, 0.012);
          pts.push(p.slice());
        }
      }
      this.curve = pts; this.update();
    }
    update() {
      const S = this.S;
      this.stats[0].set(S.sphere ? "2（原点处为 0）" : "2");
      if (this.curve) { const a = this.curve[0], b = this.curve[this.curve.length - 1]; this.stats[1].set(`${Math.hypot(...b).toFixed(4)} / ${Math.hypot(...a).toFixed(4)}`); }
      else this.stats[1].set("–");
      this.note.innerHTML = S.note;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const S = this.S, v = this.v, B = S.box, P = (p) => v.proj(p);
      // 坐标轴
      [[B, 0, 0], [0, B, 0], [0, 0, B]].forEach((a, i) => { const q = P(a); st.arrow(P([0, 0, 0]), q, col.strong, 1.2, 6); st.text(S.axes[i], q, col.muted, { dx: 8, dy: -6, size: 12 }); });
      if (S.sphere) {
        const r0 = Math.hypot(0.75, 0.35, 0.45);
        for (let k = 0; k < 8; k++) {
          const a = Math.PI * k / 8, L = [], M = [];
          for (let t = 0; t <= 48; t++) { const b = 2 * Math.PI * t / 48; L.push(P([r0 * Math.cos(b) * Math.cos(a), r0 * Math.sin(b), r0 * Math.cos(b) * Math.sin(a)])); }
          for (let t = 0; t <= 48; t++) { const b = 2 * Math.PI * t / 48, z = r0 * Math.cos(Math.PI * (k + 0.5) / 8), rr = Math.sqrt(Math.max(0, r0 * r0 - z * z)); M.push(P([rr * Math.cos(b), rr * Math.sin(b), z])); }
          st.polyline(L, C.alpha(col.ok, 0.25), 1); st.polyline(M, C.alpha(col.ok, 0.25), 1);
        }
      }
      // 小平面
      const patches = [], g = [-1, -0.5, 0, 0.5, 1];
      for (const x of g) for (const y of g) for (const z of [-0.9, -0.3, 0.3, 0.9]) {
        const p = [x, y, z]; if (S.sphere && Math.hypot(...p) < 0.2) continue;
        let [a, b] = S.f(p);
        // Gram–Schmidt，画成边长固定的小方块
        const na = Math.hypot(...a); if (na < 1e-9) continue; a = a.map((c) => c / na);
        const dot = b[0] * a[0] + b[1] * a[1] + b[2] * a[2]; b = b.map((c, i) => c - dot * a[i]); const nb = Math.hypot(...b); if (nb < 1e-9) continue; b = b.map((c) => c / nb);
        const s = 0.16, corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => P(p.map((c, k) => c + s * (i * a[k] + j * b[k]))));
        patches.push({ corners, depth: P(p).depth });
      }
      patches.sort((a, b) => b.depth - a.depth);
      for (const pt of patches) st.poly(pt.corners, C.alpha(col.accent, 0.22), C.alpha(col.accent, 0.75), 1);
      if (this.curve) { st.polyline(this.curve.map(P), col.bad, 2.4); st.dot(P(this.curve[0]), 5, col.start, col.surface, 1.5); st.dot(P(this.curve[this.curve.length - 1]), 5, col.goal, col.surface, 1.5); }
    }
  }

  // ===============================================================
  // 组件 3：Lie 括号计算器（P. Hall 基 + Lie 代数秩条件）
  // ===============================================================
  const PRESETS = {
    diff: { name: "差速驱动 (15.54)", vars: "x, y, θ", fields: "h1: cos(θ); sin(θ); 0\nh2: 0; 0; 1" },
    ni: { name: "非完整积分器 (15.83)", vars: "x1, x2, x3", fields: "h1: 1; 0; -x2\nh2: 0; 1; x1" },
    sphere: { name: "困在球面上 (15.89)", vars: "x1, x2, x3", fields: "h1: x2; -x1; 0\nh2: x3; 0; -x1" },
    chained: { name: "链式系统 (15.102)", vars: "x1, x2, x3, x4, x5", fields: "h1: 1; 0; x2; x3; x4\nh2: 0; 1; 0; 0; 0" },
    singular: { name: "奇异分布（例 15.8）", vars: "x1, x2, x3", fields: "h1: x1; 1 + x3; 1\nh2: x1*x2; (1 + x3)*x2; x2\nh3: x1; x1; 0" },
    drift: { name: "有漂移（例 15.20）", vars: "x1, x2", fields: "h0: 0; x1^2\nh1: 1; 0", drift: true },
    nonnil: { name: "不幂零的多项式场（补充）", vars: "x1, x2", fields: "h1: x1; 0\nh2: 1; 0" },
  };
  class LieCalc {
    constructor(root) {
      this.depth = 4;
      const body = C.frame(root, "Lie 括号计算器", "符号计算 [f, g] = (∂g/∂x)f − (∂f/∂x)g，按 P. Hall 基逐层生成，并检查秩");
      this.sel = C.select(Object.entries(PRESETS).map(([k, v]) => [k, v.name]), "diff", (k) => this.load(k));
      this.varsIn = h("input", { type: "text", style: "width:220px" });
      this.fieldsIn = h("textarea", { rows: 4, style: "width:100%;font-family:var(--mono);font-size:13px;border:1px solid var(--border-strong);border-radius:8px;padding:6px 8px;background:var(--surface);color:var(--text)" });
      this.driftCb = h("input", { type: "checkbox" });
      this.sD = C.slider("最大深度", 1, 5, 1, this.depth, (v) => { this.depth = v; this.compute(); }, (v) => String(v));
      this.ptIn = h("input", { type: "text", style: "width:200px", value: "" });
      this.out = h("div");
      for (const el of [this.varsIn, this.fieldsIn, this.ptIn]) el.addEventListener("input", () => this.compute());
      this.driftCb.addEventListener("change", () => this.compute());
      body.append(h("div", { class: "controls" }, h("label", null, "预设", this.sel), this.sD),
        h("div", { class: "controls" }, h("label", null, "状态变量", this.varsIn), h("label", null, this.driftCb, "第一个场是漂移项 h₀"), h("label", null, "在点 x =", this.ptIn)),
        h("div", { class: "small muted" }, "每行一个向量场（「名字:」可省略），分量之间用分号隔开；支持 + − * ^、括号、sin(变量)、cos(变量)。出现在 sin/cos 里的变量按角度处理。"),
        this.fieldsIn, this.out);
      this.load("diff");
    }
    load(k) {
      const p = PRESETS[k]; this.varsIn.value = p.vars; this.fieldsIn.value = p.fields; this.driftCb.checked = !!p.drift;
      const n = p.vars.split(",").length; this.ptIn.value = Array.from({ length: n }, (_, i) => [0.3, -0.7, 0.5, 0.2, -0.4][i]).join(", ");
      this.compute();
    }
    compute() {
      this.out.innerHTML = "";
      let sys;
      try { sys = parseSystem(this.varsIn.value, this.fieldsIn.value); } catch (e) { this.out.append(h("div", { class: "msg bad" }, String(e.message || e))); return; }
      const { V, fields } = sys, n = V.length, drift = this.driftCb.checked, m = fields.length;
      if (!m) return;
      const names = fields.map((_, i) => (drift ? `h${i}` : `h${i + 1}`));
      let x = this.ptIn.value.split(/[,，\s]+/).filter(Boolean).map(Number);
      if (x.length !== n || x.some((v) => !isFinite(v))) { x = V.map((_, i) => 0.3 + 0.1 * i); }
      const { PH, dep } = phall(m, this.depth);
      const vals = [], t0 = performance.now();
      let stopped = false;
      for (let k = 0; k < PH.length; k++) {
        if (performance.now() - t0 > 1500) { stopped = true; break; }
        const b = PH[k]; vals.push(b.gen !== undefined ? fields[b.gen] : bracket(vals[b.l], vals[b.r]));
      }
      // 随机「一般位置」的点，用来判断「对几乎所有 x」的秩
      const rr = C.rng(99), gen = [0, 1, 2].map(() => V.map(() => rr() * 2 - 1));
      const evalAt = (v, p) => v.map((c) => c.ev(p));
      const rows = [], chosenAt = [], chosenGen = gen.map(() => []);
      let dimAt = 0, dimGen = 0;
      vals.forEach((v, k) => {
        const zero = v.every((c) => c.isZero());
        const at = evalAt(v, x), cand = chosenAt.concat([at]);
        const indAt = !zero && C.rank(cand.length ? C.transpose(cand) : [[0]], 1e-8) > chosenAt.length;
        if (indAt) { chosenAt.push(at); dimAt++; }
        let indGen = false;
        gen.forEach((p, gi) => { const a = evalAt(v, p), c2 = chosenGen[gi].concat([a]); if (!zero && C.rank(C.transpose(c2), 1e-8) > chosenGen[gi].length) { chosenGen[gi].push(a); indGen = true; } });
        rows.push({ name: phName(PH, k, names), d: dep[k], expr: zero ? "0" : vfStr(v), indAt, zero });
      });
      dimGen = Math.max(...chosenGen.map((c) => c.length));
      const H = C.transpose(fields.map((f) => evalAt(f, x))), dimDelta = C.rank(H, 1e-8);
      const tb = h("tbody");
      for (const r of rows) tb.append(h("tr", null, h("td", { class: "mono" }, r.name), h("td", { class: "c" }, r.d), h("td", { class: "mono", style: "font-size:12.5px" }, r.expr),
        h("td", { class: "c", html: r.zero ? "<span class='muted'>零</span>" : r.indAt ? "<span class='yes'>✓ 新方向</span>" : "<span class='muted'>已在张成里</span>" })));
      const tbl = h("div", { class: "table-wrap", style: "max-height:330px;overflow:auto" }, h("table", { class: "data" }, h("thead", null, h("tr", null, h("th", null, "P. Hall 基元素"), h("th", { class: "c" }, "深度"), h("th", null, "向量场"), h("th", { class: "c" }, `在 x = (${x.map((v) => +v.toFixed(3)).join(", ")}) 处`))), tb));
      const mm = drift ? m - 1 : m;
      let verdict, cls;
      if (drift) {
        cls = dimAt === n ? "info" : "bad";
        verdict = `有漂移：包含 h₀ 生成的 Lie 代数在 x 处的维数 = ${dimAt}${dimAt === n ? " = n，所以系统在 x 处 accessible；但这<b>不</b>保证 STLC——还要看「好 / 坏括号」（例 15.20 就是反例）。" : " < n：连 accessible 都不是。"}`;
      } else if (dimAt === n) { cls = "ok"; verdict = `dim 𝓛_x(△) = ${n} = n：按 Chow–Rashevskii 定理，系统在 x 处 <b>STLC</b>（也就是 (15.110) 的第 3 种情形：非完整且 STLC）。`; }
      else if (dimAt === dimDelta) { cls = "info"; verdict = `dim 𝓛_x(△) = ${dimAt} = dim △(x)：括号没有产生新方向——在 x 附近<b>完全可积</b>（Frobenius 定理；(15.110) 的第 1 种情形）${dimGen > dimAt ? `。注意在一般位置的点上维数是 ${dimGen}，x 可能是奇异点` : ""}。`; }
      else { cls = "info"; verdict = `dim △(x) = ${dimDelta} < dim 𝓛_x(△) = ${dimAt} < n = ${n}：<b>非完整，但不是 STLC</b>（(15.110) 的第 2 种情形）。`; }
      const extra = [];
      if (stopped) extra.push("（表达式太大，计算在 1.5 秒处停止——减小深度。）");
      if (dimDelta < mm) extra.push(`在 x 处 rank[h₁ … h_m] = ${dimDelta} < m = ${mm}：x 是奇异点（例 15.8）。`);
      this.out.append(h("div", { class: "stats" }, (() => { const s = [C.stat("n（状态维数）"), C.stat("m（动作数）"), C.stat("dim △(x)"), C.stat("dim 𝓛_x(△)"), C.stat("一般位置的维数")]; [n, mm, dimDelta, dimAt, dimGen].forEach((v, i) => s[i].set(v)); return s; })()),
        h("div", { class: "msg " + cls, html: verdict + " " + extra.join(" ") }), tbl);
    }
  }

  // ===============================================================
  // 组件 4：P. Hall 基生成器（例 15.18；实现题 15）
  // ===============================================================
  class PHallGen {
    constructor(root) {
      this.m = 3; this.d = 3;
      const body = C.frame(root, "P. Hall 基", "按书中三条规则逐层生成；与自由 Lie 代数的维数（Witt 公式）对照");
      this.sm = C.slider("生成元个数 m =", 2, 4, 1, this.m, (v) => { this.m = v; this.update(); }, String);
      this.sd = C.slider("深度 ≤", 1, 6, 1, this.d, (v) => { this.d = v; this.update(); }, String);
      this.tbl = h("div", { class: "table-wrap" }); this.list = h("div", { class: "mono small", style: "line-height:1.9;max-height:260px;overflow:auto" });
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sm, this.sd), this.tbl, this.list, this.note);
      this.update();
    }
    update() {
      const { m, d } = this, names = Array.from({ length: m }, (_, i) => `h${i + 1}`);
      const { PH, dep } = phall(m, d);
      // 统计每层的候选 [φi, φj]（d(φi)+d(φj) = 层数）被各条规则剔除的情况
      const rows = [];
      for (let k = 1; k <= d; k++) {
        const cnt = dep.filter((x) => x === k).length;
        let same = 0, anti = 0, jac = 0;
        if (k > 1) for (let j = 0; j < PH.length; j++) for (let i = 0; i < PH.length; i++) {
          if (dep[i] + dep[j] !== k || dep[i] >= k || dep[j] >= k) continue;
          if (i === j) same++; else if (i > j) anti++; else if (!(PH[j].gen !== undefined || PH[j].l <= i)) jac++;
        }
        rows.push(`<tr><td class="c">${k}</td><td class="c"><b>${cnt}</b></td><td class="c">${witt(m, k)}</td><td class="c">${k > 1 ? same : "–"}</td><td class="c">${k > 1 ? anti : "–"}</td><td class="c">${k > 1 ? jac : "–"}</td></tr>`);
      }
      this.tbl.innerHTML = `<table class="data"><thead><tr><th class="c">深度</th><th class="c">P. Hall 基里的个数</th><th class="c">Witt 公式</th><th class="c">剔除：[φ, φ] = 0</th><th class="c">剔除：反对称 i > j</th><th class="c">剔除：规则 3(b)（Jacobi）</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
      const shown = PH.slice(0, 160).map((_, k) => `<span style="white-space:nowrap;margin-right:14px">${phName(PH, k, names)}</span>`).join("");
      this.list.innerHTML = shown + (PH.length > 160 ? `<span class="muted">…… 共 ${PH.length} 个</span>` : "");
      this.note.innerHTML = m === 3 && d >= 3
        ? "m = 3、深度 3 时就是例 15.18：深度 3 的候选里只有 [h1,[h2,h3]] 被规则 3(b) 剔除——它可以用 Jacobi 恒等式写成 [h2,[h1,h3]] − [h3,[h1,h2]]（式 15.109）。原书把深度 2 的三个元素按 [h1,h2]、[h2,h3]、[h1,h3] 的顺序列出；这里按下标排序，规则 2 只要求深度递增，两种顺序都可以。"
        : "每层的个数与 Witt 公式 (1/d) Σ_{e|d} μ(e) m^{d/e} 完全一致——P. Hall 基正好是自由 Lie 代数的一组基。对具体的系统，还要再做线性无关检查（见上面的计算器）。";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='commutator']").forEach((el) => (el._w = new Commutator(el)));
    document.querySelectorAll("[data-widget='distribution3d']").forEach((el) => (el._w = new Distribution3D(el)));
    document.querySelectorAll("[data-widget='lie-calc']").forEach((el) => (el._w = new LieCalc(el)));
    document.querySelectorAll("[data-widget='phall']").forEach((el) => (el._w = new PHallGen(el)));
  });
  window.CH15LIE = { Poly, bracket, parseSystem, phall, witt };
})();
