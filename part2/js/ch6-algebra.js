/* 6.4 节：Tarski 语句与量词顺序（例 6.3）、符号分配（例 6.4、图 6.30）、一维分解（例 6.5、图 6.31/6.32）、
   柱形代数分解（例 6.6、图 6.35；习题 9）、Canny 路线图的临界点（例 6.7、6.8） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;
  const TAU = 2 * Math.PI;
  const sgn = (v) => (v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0);

  // ===============================================================
  // 例 6.3：量词的顺序——几何图像
  // ===============================================================
  class Tarski {
    constructor(root) {
      this.mode = "610"; this.x = 1.2; this.y = 2.2; this.z = 0.6;
      const body = C.frame(root, "Tarski 语句：量词的顺序", "∀x∃y 看竖线，∃y∀x 看横线");
      this.st = new C.Stage({ aspect: 0.66, maxW: 560, view: [-3, 3, -2.2, 5.6], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => ({}), onMove: (p) => { if (this.mode === "610") this.x = Math.max(-2.9, Math.min(2.9, p.x)); else this.y = Math.max(-2, Math.min(5.5, p.y)); this.sync(); this.render(); } });
      this.sx = C.slider("x", -2.9, 2.9, 0.01, this.x, (v) => { this.x = v; this.render(); }, (v) => v.toFixed(2));
      this.sy = C.slider("y", -2, 5.5, 0.01, this.y, (v) => { this.y = v; this.render(); }, (v) => v.toFixed(2));
      this.sz = C.slider("z", -1, 3, 0.01, this.z, (v) => { this.z = v; this.render(); }, (v) => v.toFixed(2));
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, C.seg([["610", "(6.10) ∀x∃y"], ["611", "(6.11) ∃y∀x"], ["612", "(6.12) Φ(z) = ∃y∀x"]], this.mode, (k) => { this.mode = k; this.syncUI(); this.render(); })),
        h("div", { class: "controls" }, this.sx, this.sy, this.sz, C.button("z = 1", () => { this.z = 1; this.sz.set(1); this.render(); }, "small")),
        h("div", { class: "split" }, this.st.wrap, this.out));
      this.syncUI(); this.render();
    }
    sync() { this.sx.set(this.x); this.sy.set(this.y); }
    syncUI() { this.sx.classList.toggle("hidden", this.mode !== "610"); this.sz.classList.toggle("hidden", this.mode !== "612"); this.sz.nextSibling && this.sz.nextSibling.classList.toggle("hidden", this.mode !== "612"); }
    k() { return this.mode === "612" ? 1 - this.z : 1; }   // 原子是 k x² − y < 0
    render() {
      const k = this.k(), b = (v) => (v ? '<span class="yes">TRUE</span>' : '<span class="no">FALSE</span>');
      if (this.mode === "610") {
        const wy = this.x * this.x + 1;
        this.out.innerHTML = `<p>阴影 = 原子 \\(x^2 - y < 0\\) 成立的点（抛物线上方）。</p><p>\\(\\forall x\\,\\exists y\\)：<b>每一条竖线</b>都要碰到阴影。在 x = ${this.x.toFixed(2)} 处取 y = x² + 1 = ${wy.toFixed(2)} 就行——任何 x 都可以这样做，所以 (6.10) 为 ${b(true)}。</p><p class="muted">拖动竖线试试：总能在它上面找到阴影里的点。</p>`;
      } else {
        const lineIn = k <= 0 ? this.y > 0 : false;
        const exit = k > 0 ? (this.y > 0 ? Math.sqrt(this.y / k) : 0) : null;
        const truth = this.mode === "611" ? false : this.z >= 1;
        let s = `<p>阴影 = 原子 \\(${this.mode === "612" ? "x^2 - z x^2 - y" : "x^2 - y"} < 0\\) 成立的点${this.mode === "612" ? `，即 \\(y > (1-z)x^2 = ${k.toFixed(2)}\\,x^2\\)` : ""}。</p>`
          + `<p>\\(\\exists y\\,\\forall x\\)：要找<b>一整条横线</b>都落在阴影里。当前横线 y = ${this.y.toFixed(2)}：${lineIn ? '<span class="yes">整条都在阴影里</span>' : exit === 0 ? '<span class="no">x = 0 处就不在阴影里</span>' : `<span class="no">在 x = ±${exit.toFixed(2)} 处离开阴影</span>`}。</p>`;
        if (this.mode === "611") s += `<p>抛物线开口向上，任何横线最终都会穿出阴影，所以 (6.11) 为 ${b(false)}。交换量词的顺序，真假就变了。</p>`;
        else s += `<p>\\(\\Phi(z)\\) = ${b(truth)}（\\(z \\ge 1\\) 时抛物线变平或开口向下，取 y = 1 那条横线就整条在阴影里）。</p>`
          + `<p>原书给的无量词公式 \\(\\phi(z) = (z > 1)\\) = ${b(this.z > 1)}；更正后 \\(\\phi(z) = (z \\ge 1)\\) = ${b(this.z >= 1)}。${Math.abs(this.z - 1) < 1e-9 ? '<span class="no">z = 1 时两者不同：原子变成 −y < 0，取 y = 1 即为真，所以 (6.13) 写的 z ≥ 1 才对。</span>' : "点「z = 1」看两者的分歧。"}</p>`;
        this.out.innerHTML = s;
      }
      PA.renderMath(this.out);
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const k = this.k(), [x0, x1, y0, y1] = st.view;
      // 阴影：y > k x²
      const top = []; for (let i = 0; i <= 120; i++) { const x = x0 + ((x1 - x0) * i) / 120; top.push(P(x, Math.max(y0 - 1, Math.min(y1 + 1, k * x * x)))); }
      st.poly(top.concat([P(x1, y1 + 1), P(x0, y1 + 1)]), C.alpha(col.ok, 0.18));
      st.path(top, col.ok, 2);
      st.line(P(x0, 0), P(x1, 0), C.alpha(col.text, 0.4), 1); st.line(P(0, y0), P(0, y1), C.alpha(col.text, 0.4), 1);
      st.text("x", P(x1, 0), col.text2, { dx: -8, dy: -10, size: 11 }); st.text("y", P(0, y1), col.text2, { dx: 10, dy: 8, size: 11 });
      if (this.mode === "610") {
        st.line(P(this.x, y0), P(this.x, y1), col.warn, 2.2);
        st.dot(P(this.x, this.x * this.x + 1), 6, col.warn, col.surface, 2);
      } else {
        const lineIn = k <= 0 ? this.y > 0 : false;
        st.line(P(x0, this.y), P(x1, this.y), lineIn ? col.ok : col.warn, 2.4);
        if (!lineIn && k > 0 && this.y > 0) { const e = Math.sqrt(this.y / k); for (const s of [-1, 1]) st.dot(P(s * e, this.y), 6, col.bad, col.surface, 2); }
      }
    }
  }

  // ===============================================================
  // 姜饼人脸（例 3.1 的参数是我们取的：头半径 2，眼睛 (±0.7, 0.6) 半径 0.3，嘴 (0, −0.7) 半轴 1.15、0.25）
  // ===============================================================
  const GINGER = { r1: 2, ex: 0.7, ey: 0.6, re: 0.3, y4: -0.7, a: 1.15, b: 0.25 };
  function gingerCurves(g) {
    return [{ cx: 0, cy: 0, a: g.r1, b: g.r1, name: "f1 头" }, { cx: -g.ex, cy: g.ey, a: g.re, b: g.re, name: "f2 左眼" }, { cx: g.ex, cy: g.ey, a: g.re, b: g.re, name: "f3 右眼" }, { cx: 0, cy: g.y4, a: g.a, b: g.b, name: "f4 嘴" }];
  }
  const ellVal = (c, x, y) => ((x - c.cx) / c.a) ** 2 + ((y - c.cy) / c.b) ** 2 - 1;   // 符号与「圆 / 椭圆方程 − 1」一致

  class SignDecomp {
    constructor(root) {
      this.neg = false; this.hover = null;
      const body = C.frame(root, "符号分配：姜饼人脸的 9 个符号不变区域", "把鼠标移到图上看符号向量");
      this.st = new C.Stage({ aspect: 0.82, maxW: 460, view: [-2.6, 2.6, -2.3, 2.3], onDraw: (ctx, st, col) => this.draw(st, col),
        onHover: (p) => { this.hover = p; this.render(); }, onLeave: () => { this.hover = null; this.render(); } });
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, C.seg([["fig", "按图 6.30 的标注"], ["ex31", "按例 3.1 (3.11) 的定义（f2–f4 乘了 −1）"]], "fig", (k) => { this.neg = k === "ex31"; this.render(); })),
        h("div", { class: "split" }, this.st.wrap, this.out));
      this.curves = gingerCurves(GINGER);
      this.render();
    }
    vec(x, y) { return this.curves.map((c, i) => { const v = ellVal(c, x, y) * (i > 0 && this.neg ? -1 : 1); return Math.abs(v) < 0.025 ? 0 : sgn(v); }); }
    render() {
      const f = (v) => "(" + v.map((s) => (s > 0 ? "1" : s < 0 ? "−1" : "0")).join(", ") + ")";
      const regs = [["脸外", [1, 1, 1, 1]], ["左眼里", [-1, -1, 1, 1]], ["右眼里", [-1, 1, -1, 1]], ["嘴里", [-1, 1, 1, -1]], ["脸里（眼、嘴之外）", [-1, 1, 1, 1]]];
      const one = [["头的边界", [0, 1, 1, 1]], ["左眼的边界", [-1, 0, 1, 1]], ["右眼的边界", [-1, 1, 0, 1]], ["嘴的边界", [-1, 1, 1, 0]]];
      const conv = (v) => v.map((s, i) => (i > 0 && this.neg ? -s : s));
      let s = `<table class="data" style="font-size:13px"><tr><th>区域</th><th>\\(\\mathrm{sgn}_{\\mathcal F}\\)</th></tr>`
        + regs.map(([n, v]) => `<tr><td>${n}（二维）</td><td class="mono">${f(conv(v))}</td></tr>`).join("")
        + one.map(([n, v]) => `<tr><td>${n}（一维）</td><td class="mono">${f(conv(v))}</td></tr>`).join("") + "</table>";
      if (this.hover) s = `<p class="msg info mono">鼠标处 (${this.hover.x.toFixed(2)}, ${this.hover.y.toFixed(2)})：sgn = ${f(this.vec(this.hover.x, this.hover.y))}</p>` + s;
      s += `<p class="muted">共 5 个二维 + 4 个一维 = 9 个符号不变区域。「脸里」那个区域有三个洞，所以这不是奇异复形——对运动规划没多大用，但对判定问题足够：每个区域只要查一个点。${this.neg ? "（例 3.1 给 f2、f3、f4 乘了 −1，所以它们的符号与图 6.30 的标注整体相反——图 6.30 实际用的是未取负的圆、椭圆方程。）" : ""}</p>`;
      this.out.innerHTML = s;
      PA.renderMath(this.out);
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const cols = { "1,1,1,1": "surface3", "-1,1,1,1": "accent", "-1,-1,1,1": "warn", "-1,1,-1,1": "alive2", "-1,1,1,-1": "ok" };
      const ctx = st.ctx, [x0, x1, y0, y1] = st.view, N = 160, dx = (x1 - x0) / N, dy = (y1 - y0) / N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + (i + 0.5) * dx, y = y0 + (j + 0.5) * dy;
        const v = this.curves.map((c) => sgn(ellVal(c, x, y)));
        const c = cols[v.join(",")]; if (!c) continue;
        ctx.fillStyle = C.alpha(col[c], c === "surface3" ? 1 : 0.28); ctx.fillRect(st.X(x0 + i * dx), st.Y(y0 + (j + 1) * dy), dx * st.scale + 0.7, dy * st.scale + 0.7);
      }
      for (const c of this.curves) { ctx.beginPath(); ctx.ellipse(st.X(c.cx), st.Y(c.cy), c.a * st.scale, c.b * st.scale, 0, 0, TAU); ctx.strokeStyle = col.text; ctx.lineWidth = 1.6; ctx.stroke(); }
      if (this.hover) st.dot(this.hover, 5, col.bad, col.surface, 1.5);
    }
  }

  // ===============================================================
  // 例 6.5：一维分解与判定问题
  // ===============================================================
  class CAD1D {
    constructor(root) {
      this.rel = "le"; this.shift = 0; this.k = -1; this.order = "lr";
      const body = C.frame(root, "一维分解：两个二次多项式切开实数轴", "选关系符号；逐个试样本点来判定 Φ = ∃x φ(x)");
      this.st = new C.Stage({ aspect: 0.56, maxW: 600, view: [-1.6, 4.6, -1.6, 2.6], onDraw: (ctx, st, col) => this.draw(st, col) });
      this.sShift = C.slider("把 f₂ 上下平移 c", -1.5, 1.2, 0.05, 0, (v) => { this.shift = v; this.k = -1; this.render(); }, (v) => v.toFixed(2));
      this.out = h("div", { class: "small" });
      this.table = h("div", { class: "table-wrap", style: "margin:0" });
      body.append(h("div", { class: "controls" }, C.seg([["ge", "原书 (6.21)：≥ 0"], ["le", "更正：≤ 0"]], this.rel, (k) => { this.rel = k; this.k = -1; this.render(); }), this.sShift),
        h("div", { class: "controls" }, C.button("试下一个样本点 ▶", () => { if (this.found || this.k >= this.cells.length - 1) this.k = -1; this.k++; this.render(); }, "small primary"), C.button("重来", () => { this.k = -1; this.render(); }, "small")),
        this.st.wrap, h("div", { class: "split", style: "margin-top:8px" }, this.table, this.out),
        C.legend([[C.cv("accent"), "f₁ = x² − 2x"], [C.cv("goal"), "f₂ = x² − 4x + 3 (+ c)"], [C.cv("ok"), "φ(x) 为真的单元"], [C.cv("warn"), "正在试的样本点"]]));
      this.render();
    }
    f1(x) { return x * x - 2 * x; }
    f2(x) { return x * x - 4 * x + 3 + this.shift; }
    roots() {
      const r = [0, 2];
      const D = 16 - 4 * (3 + this.shift);
      if (D > 1e-12) { r.push(2 - Math.sqrt(D) / 2, 2 + Math.sqrt(D) / 2); } else if (Math.abs(D) <= 1e-12) r.push(2);
      const s = [...r].sort((a, b) => a - b), out = [];
      for (const x of s) if (!out.length || x - out[out.length - 1] > 1e-9) out.push(x);
      return out;
    }
    phi(x) { const op = this.rel === "ge" ? (v) => v >= -1e-12 : (v) => v <= 1e-12; return op(this.f1(x)) && op(this.f2(x)); }
    render() {
      const B = this.roots(), cells = [];
      const fx = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(3));
      cells.push({ name: `(−∞, ${fx(B[0])})`, s: B[0] - 1, dim: 1 });
      B.forEach((b, i) => { cells.push({ name: `[${fx(b)}, ${fx(b)}]`, s: b, dim: 0 }); if (i + 1 < B.length) cells.push({ name: `(${fx(b)}, ${fx(B[i + 1])})`, s: (b + B[i + 1]) / 2, dim: 1 }); });
      cells.push({ name: `(${fx(B[B.length - 1])}, ∞)`, s: B[B.length - 1] + 1, dim: 1 });
      this.B = B; this.cells = cells;
      this.found = this.k >= 0 && this.phi(cells[this.k].s);
      const sg = (v) => { const s = sgn(v); return s > 0 ? "+" : s < 0 ? "−" : "0"; };
      this.table.innerHTML = `<table class="data" style="font-size:13px"><tr><th>单元</th><th>样本</th><th>sgn f₁</th><th>sgn f₂</th><th>φ</th></tr>`
        + cells.map((c, i) => `<tr style="${i === this.k ? "background:var(--warn-soft)" : ""}"><td class="mono">${c.name}</td><td class="mono">${fx(c.s)}</td><td class="c">${sg(this.f1(c.s))}</td><td class="c">${sg(this.f2(c.s))}</td><td class="c">${this.phi(c.s) ? '<span class="yes">T</span>' : '<span class="no">F</span>'}</td></tr>`).join("") + "</table>";
      const n1 = cells.filter((c) => c.dim === 1).length, n0 = cells.length - n1;
      const set = cells.filter((c) => this.phi(c.s)).map((c) => c.name).join(" ∪ ") || "∅";
      let s = `<p>${n1} 个 1-单元、${n0} 个 0-单元，每个单元上符号不变（6.20）。φ(x) 成立的集合 = <span class="mono">${set}</span>。</p>`;
      if (this.k >= 0) s += `<p>按从左到右的顺序试到第 ${this.k + 1} 个样本 x = ${fx(cells[this.k].s)}：φ = ${this.found ? '<span class="yes">TRUE</span>，所以 Φ = ∃x φ(x) 为真，停。' : '<span class="no">FALSE</span>，继续。'}</p>`;
      else s += "<p>点「试下一个样本点」。只要查这有限几个点，就能判定 ∃x φ(x)。</p>";
      if (this.shift === 0) s += `<p class="${this.rel === "ge" ? "no" : "muted"}">${this.rel === "ge" ? "按原书的 ≥，φ 的集合是 (−∞,0] ∪ [3,∞)，不是图 6.31 标出的 [1,2]；而且第一个样本 x = −1 就让 Φ 为真，和正文「试到 x = 1 才发现为真」对不上。" : "用 ≤ 时集合正好是图 6.31 的 [1, 2]，并且正如正文所说，试到 x = 1 才第一次为真。"}</p>`;
      this.out.innerHTML = s;
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const [x0, x1, y0, y1] = st.view;
      st.line(P(x0, 0), P(x1, 0), col.text2, 1.4);
      for (let x = -1; x <= 4; x++) { st.line(P(x, -0.05), P(x, 0.05), col.text2, 1); }
      const plot = (f, c) => { const pts = []; for (let i = 0; i <= 200; i++) { const x = x0 + ((x1 - x0) * i) / 200; pts.push(P(x, f(x))); } st.path(pts.filter((p) => p.y > y0 - 1 && p.y < y1 + 1), c, 2); };
      plot((x) => this.f1(x), col.accent); plot((x) => this.f2(x), col.goal);
      // 实数轴下方画分解
      const yb = -1.25;
      st.line(P(x0, yb), P(x1, yb), col.text, 1.2);
      this.cells.forEach((c, i) => {
        const ok = this.phi(c.s);
        if (c.dim === 1) {
          const L = i === 0 ? x0 : this.cells[i - 1].s, R = i === this.cells.length - 1 ? x1 : this.cells[i + 1].s;
          if (ok) st.line(P(L, yb), P(R, yb), col.ok, 6);
        } else st.dot(P(c.s, yb), 5, ok ? col.ok : col.text, col.surface, 1.5);
        st.text(c.name, P(c.s, yb), col.muted, { dy: c.dim ? 14 : -12, size: 10 });
      });
      if (this.k >= 0) { const s = this.cells[this.k].s; st.line(P(s, yb), P(s, 2.4), col.warn, 1.4, [4, 4]); st.dot(P(s, yb), 7, col.warn, col.surface, 2); }
      st.text("ℝ", P(x0, yb), col.text2, { dx: 10, dy: -10, size: 12 });
    }
  }

  // ===============================================================
  // 柱形代数分解（例 6.6、图 6.35；习题 9 的三个圆）
  // ===============================================================
  function branches(c, x) {
    const u = (x - c.cx) / c.a;
    if (Math.abs(u) > 1 + 1e-12) return [];
    const hh = c.b * Math.sqrt(Math.max(0, 1 - u * u));
    return [c.cy - hh, c.cy + hh];
  }
  function cad(curves) {
    let crit = [];
    curves.forEach((c) => crit.push(c.cx - c.a, c.cx + c.a));
    // 两两交点：扫描各分支之差的变号，再二分（6.4.2 节：曲面相交处也要立单元边界）
    for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
      const c1 = curves[i], c2 = curves[j], lo = Math.max(c1.cx - c1.a, c2.cx - c2.a), hi = Math.min(c1.cx + c1.a, c2.cx + c2.a);
      if (lo >= hi) continue;
      for (const s1 of [0, 1]) for (const s2 of [0, 1]) {
        const g = (x) => branches(c1, x)[s1] - branches(c2, x)[s2];
        const M = 1500;
        let xa = lo + (hi - lo) * 0.5 / M, ga = g(xa);
        for (let k = 1; k < M; k++) {
          const xb = lo + ((hi - lo) * (k + 0.5)) / M, gb = g(xb);
          if (ga * gb < 0) { let a = xa, b = xb; for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (g(a) * g(m) <= 0) b = m; else a = m; } crit.push((a + b) / 2); }
          xa = xb; ga = gb;
        }
      }
    }
    crit.sort((a, b) => a - b);
    const beta = []; for (const x of crit) if (!beta.length || x - beta[beta.length - 1] > 1e-7) beta.push(x);
    const ysAt = (x) => { const ys = curves.flatMap((c) => branches(c, x)).sort((a, b) => a - b), out = []; for (const y of ys) if (!out.length || y - out[out.length - 1] > 1e-5) out.push(y); return out; };
    // 列：先是 1-单元（开区间）上的柱体，再是 0-单元上的竖线，交替
    const cols = [];
    const mids = [beta[0] - 1].concat(beta.slice(0, -1).map((b, i) => (b + beta[i + 1]) / 2), [beta[beta.length - 1] + 1]);
    let n2 = 0, n1 = 0, n0 = 0, num = 0;
    for (let i = 0; i < mids.length; i++) {
      const ys = ysAt(mids[i]);
      cols.push({ dim: 1, x: mids[i], lo: i ? beta[i - 1] : -Infinity, hi: i < beta.length ? beta[i] : Infinity, k: ys.length, first: num + 1 });
      num += ys.length + 1; n2 += ys.length + 1; n1 += ys.length;
      if (i < beta.length) { const yb = ysAt(beta[i]); cols.push({ dim: 0, x: beta[i], k: yb.length, ys: yb }); n1 += yb.length + 1; n0 += yb.length; }
    }
    return { beta, cols, n2, n1, n0, ysAt };
  }

  class CAD2D {
    constructor(root) {
      this.scene = root.dataset.scene || "ginger"; this.hover = null; this.g = Object.assign({}, GINGER);
      this.circles = [{ cx: 0, cy: 0, a: 1, b: 1 }, { cx: 1.475, cy: 0, a: 1, b: 1 }, { cx: 0.725, cy: -1.2, a: 1, b: 1 }];
      const body = C.frame(root, "柱形代数分解（向 x 轴投影一次、提升一次）", "鼠标移到某个单元上看它是什么；拖动参数看单元数怎样变");
      this.st = new C.Stage({ aspect: 0.86, maxW: 560, onDraw: (ctx, st, col) => this.draw(st, col),
        onHover: (p) => { this.hover = p; this.describe(); this.st.draw(); }, onLeave: () => { this.hover = null; this.describe(); this.st.draw(); },
        onDown: (p) => { if (this.scene !== "circles") return null; const i = this.circles.findIndex((c) => Math.hypot(p.x - c.cx, p.y - c.cy) < 0.25); return i >= 0 ? { i, dx: p.x - this.circles[i].cx, dy: p.y - this.circles[i].cy } : null; },
        onMove: (p, d) => { const c = this.circles[d.i]; c.cx = p.x - d.dx; c.cy = p.y - d.dy; this.rebuild(); },
        cursor: (p) => (this.scene === "circles" && this.circles.some((c) => Math.hypot(p.x - c.cx, p.y - c.cy) < 0.25) ? "grab" : null) });
      this.sA = C.slider("嘴的半宽 a", 0.2, 2.4, 0.01, this.g.a, (v) => { this.g.a = v; this.rebuild(); }, (v) => v.toFixed(2));
      this.sE = C.slider("眼睛间距 2·ex", 0.62, 2.4, 0.01, 2 * this.g.ex, (v) => { this.g.ex = v / 2; this.rebuild(); }, (v) => v.toFixed(2));
      this.selS = C.seg([["ginger", "姜饼人脸（图 6.35）"], ["circles", "三个圆（图 6.43，习题 9）"]], this.scene, (k) => { this.scene = k; this.syncUI(); this.rebuild(); });
      this.stt = { n2: C.stat("2-单元"), n1: C.stat("1-单元"), n0: C.stat("0-单元"), b: C.stat("ℝ 上的 0-单元 β") };
      this.out = h("div", { class: "small", style: "min-height:4.5em" });
      body.append(h("div", { class: "controls" }, this.selS, this.sA, this.sE),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stt)), this.out,
        C.legend([[C.cv("text"), "多项式的零点集"], [C.cv("accent"), "竖线：投影到 ℝ 后的 0-单元"], [C.cva("warn", 0.35), "鼠标所在的单元"]]));
      this.syncUI(); this.rebuild();
    }
    syncUI() { this.sA.classList.toggle("hidden", this.scene !== "ginger"); this.sE.classList.toggle("hidden", this.scene !== "ginger"); this.st.setView(this.scene === "ginger" ? [-2.9, 2.9, -2.75, 2.45] : [-1.6, 3.1, -2.75, 1.45]); }
    curves() { return this.scene === "ginger" ? gingerCurves(this.g) : this.circles; }
    rebuild() {
      this.D = cad(this.curves());
      this.stt.n2.set(this.D.n2); this.stt.n1.set(this.D.n1); this.stt.n0.set(this.D.n0); this.stt.b.set(this.D.beta.length);
      this.describe(); this.st.draw();
    }
    locate(p) {
      const D = this.D, tol = 4 / this.st.scale;
      for (const c of D.cols) if (c.dim === 0 && Math.abs(p.x - c.x) < tol) {
        const ys = c.ys; let j = ys.findIndex((y) => Math.abs(p.y - y) < tol);
        if (j >= 0) return { col: c, kind: "0-cell", j, y: ys[j] };
        j = ys.filter((y) => y < p.y).length;
        return { col: c, kind: "1-cell-v", j, lo: j ? ys[j - 1] : -Infinity, hi: j < ys.length ? ys[j] : Infinity };
      }
      const c = D.cols.find((c) => c.dim === 1 && p.x > c.lo && p.x < c.hi);
      if (!c) return null;
      const ys = D.ysAt(p.x); let j = ys.findIndex((y) => Math.abs(p.y - y) < tol);
      if (j >= 0) return { col: c, kind: "section", j };
      j = ys.filter((y) => y < p.y).length;
      return { col: c, kind: "sector", j, k: ys.length };
    }
    describe() {
      const D = this.D, f = (v) => (isFinite(v) ? v.toFixed(3) : v > 0 ? "∞" : "−∞");
      let s = this.scene === "ginger" ? `四个多项式：头 f₁、两只眼 f₂ f₃、嘴 f₄。投影的临界点只来自每条曲线的左右两端（「折叠」处，图 6.33）——这组参数下曲线互不相交。` : `三个两两相交的圆。除了每个圆的左右两端，两圆的交点也给出临界 x（图 6.33 的「相交」情形）。拖动圆心试试。`;
      s += ` 共 ${D.beta.length} 个 β，${D.cols.filter((c) => c.dim === 1).length} 个开区间。`;
      if (this.scene === "ginger" && Math.abs(this.g.a - GINGER.a) < 1e-9 && Math.abs(this.g.ex - GINGER.ex) < 1e-9) s += " <b>与图 6.35 一样：37 个 2-单元、64 个 1-单元、28 个 0-单元。</b>";
      if (this.hover) {
        const L = this.locate(this.hover);
        if (L) {
          const c = L.col;
          if (c.dim === 1) {
            const sec = L.kind === "sector" ? (L.j === 0 ? "下无界扇区 (6.24)" : L.j === L.k ? "上无界扇区 (6.27)" : "有界扇区 (6.26)") : "截面 (6.25)";
            s = `<b>${L.kind === "sector" ? `2-单元 #${c.first + L.j}` : "1-单元（曲线的一段）"}</b>：1-单元 (${f(c.lo)}, ${f(c.hi)}) 上方柱体里的${sec}${L.kind === "sector" ? `，自下往上第 ${L.j + 1} 个（共 ${L.k + 1} 个）` : ""}。<br>` + s;
          } else s = `<b>${L.kind === "0-cell" ? "0-单元" : "1-单元（竖线上的一段）"}</b>：0-单元 x = ${c.x.toFixed(3)} 上方的${L.kind === "0-cell" ? "截面（一个点）" : "扇区"}。<br>` + s;
        }
      }
      this.out.innerHTML = s;
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const D = this.D, [x0, x1, y0, y1] = st.view, ctx = st.ctx;
      // 鼠标所在单元高亮
      if (this.hover) {
        const L = this.locate(this.hover);
        if (L && L.kind === "sector") {
          const c = L.col, xa = Math.max(x0, c.lo), xb = Math.min(x1, c.hi), N = 60, lo = [], hi = [];
          for (let i = 0; i <= N; i++) { const x = xa + ((xb - xa) * i) / N, ys = D.ysAt(x); lo.push(P(x, L.j ? ys[L.j - 1] : y0 - 1)); hi.push(P(x, L.j < ys.length ? ys[L.j] : y1 + 1)); }
          st.poly(lo.concat(hi.reverse()), C.alpha(col.warn, 0.32));
        }
      }
      for (const b of D.beta) st.line(P(b, y0 - 1), P(b, y1 + 1), C.alpha(col.accent, 0.7), 1.2);
      for (const c of this.curves()) { ctx.beginPath(); ctx.ellipse(st.X(c.cx), st.Y(c.cy), c.a * st.scale, c.b * st.scale, 0, 0, TAU); ctx.strokeStyle = col.text; ctx.lineWidth = 1.8; ctx.stroke(); }
      for (const c of D.cols) if (c.dim === 0) for (const y of c.ys) st.dot(P(c.x, y), 3.2, col.text);
      // 2-单元编号（与图 6.35 相同的编号方式：从左到右、每列自下而上）
      const fs = st.scale > 70 ? 10.5 : 9;
      for (const c of D.cols) if (c.dim === 1) {
        const xa = Math.max(x0 + 0.05, c.lo), xb = Math.min(x1 - 0.05, c.hi), xm = isFinite(c.lo) && isFinite(c.hi) ? (c.lo + c.hi) / 2 : (xa + xb) / 2;
        const ys = D.ysAt(xm);
        for (let j = 0; j <= ys.length; j++) {
          const lo = j ? ys[j - 1] : y0 + 0.25, hi = j < ys.length ? ys[j] : y1 - 0.15;
          if ((hi - lo) * st.scale < 9 || (xb - xa) * st.scale < 9) continue;
          st.text(String(c.first + j), P(xm, (lo + hi) / 2), col.text2, { size: fs });
        }
      }
      // 底部的 ℝ 分解
      const yb = y0 + 0.12;
      st.line(P(x0, yb), P(x1, yb), col.text2, 1.2);
      for (const b of D.beta) st.dot(P(b, yb), 3.5, col.accent);
      st.text("ℝ", P(x0, yb), col.text2, { dx: 10, dy: -9, size: 11 });
    }
  }

  // ===============================================================
  // Canny 路线图：例 6.7（球面）与例 6.8（环面）
  // ===============================================================
  class Canny {
    constructor(root) {
      this.mode = "torus"; this.az = -0.5; this.el = 0.55; this.r1 = 2; this.r2 = 0.7; this.lat = 0.5; this.lon = 0.8; this.gDim = 2;
      this.show = { sil: true, crit: true, slice: true };
      const body = C.frame(root, "Canny 路线图：轮廓线与临界点", "拖动三维图旋转视角");
      this.st = new C.Stage({ aspect: 0.8, maxW: 440, view: [-3, 3, -2.1, 2.7], onDraw: (ctx, st, col) => this.draw3(st, col),
        onDown: (p) => ({ p0: p, az: this.az, el: this.el }),
        onMove: (p, d) => { this.az = d.az + (p.x - d.p0.x) * 0.9; this.el = Math.max(0.05, Math.min(1.45, d.el - (p.y - d.p0.y) * 0.5)); this.st.draw(); }, cursor: () => "move" });
      this.st2 = new C.Stage({ aspect: 0.8, maxW: 380, view: [-3, 3, -2.4, 2.4], onDraw: (ctx, st, col) => this.draw2(st, col) });
      this.selM = C.seg([["sphere", "例 6.7：球面 S²"], ["torus", "例 6.8：环面"]], this.mode, (k) => { this.mode = k; this.syncUI(); this.render(); });
      this.selG = C.seg([[1, "g = x₁"], [2, "g = (x₁, x₂)"]], 2, (k) => { this.gDim = +k; this.render(); });
      this.sLat = C.slider("点的纬度", -1.57, 1.57, 0.01, this.lat, (v) => { this.lat = v; this.render(); }, (v) => ((v * 180) / Math.PI).toFixed(0) + "°");
      this.sLon = C.slider("经度", -3.14, 3.14, 0.01, this.lon, (v) => { this.lon = v; this.render(); }, (v) => ((v * 180) / Math.PI).toFixed(0) + "°");
      this.sR1 = C.slider("r₁", 1.2, 2.4, 0.01, this.r1, (v) => { this.r1 = v; this.render(); }, (v) => v.toFixed(2));
      this.sR2 = C.slider("r₂", 0.3, 1.0, 0.01, this.r2, (v) => { this.r2 = Math.min(v, this.r1 - 0.15); this.render(); }, (v) => v.toFixed(2));
      this.cbs = [["sil", "轮廓线（silhouette）"], ["crit", "g₁ 的临界点"], ["slice", "过内侧临界点的切片（图 6.38）"]].map(([k, t]) => C.check(t, true, (v) => { this.show[k] = v; this.render(); }));
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selM, this.selG), h("div", { class: "controls" }, this.sLat, this.sLon, this.sR1, this.sR2),
        h("div", { class: "controls" }, ...this.cbs),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, this.st.wrap, this.st2.wrap), this.out,
        C.legend([[C.cv("alive2"), "轮廓线"], [C.cv("bad"), "临界点"], [C.cv("warn"), "切片曲线"], [C.cv("accent"), "球面上的探针点"]]));
      this.syncUI(); this.render();
    }
    syncUI() {
      const sp = this.mode === "sphere";
      [this.selG, this.sLat, this.sLon].forEach((e) => e.classList.toggle("hidden", !sp));
      [this.sR1, this.sR2, ...this.cbs].forEach((e) => e.classList.toggle("hidden", sp));
      this.st.setView(sp ? [-1.5, 1.5, -1.2, 1.5] : [-3.1, 3.1, -2.2, 2.8]);
      this.st2.setView(sp ? [-1.3, 1.3, -1.05, 1.05] : [-3.1, 3.1, -2.45, 2.45]);
    }
    proj(x, y, z) { const c = Math.cos(this.az), s = Math.sin(this.az), X = c * x - s * y, D = s * x + c * y; return P(X, z * Math.cos(this.el) + D * Math.sin(this.el) * 0.55); }
    render() {
      if (this.mode === "sphere") {
        const p = [Math.cos(this.lat) * Math.cos(this.lon), Math.cos(this.lat) * Math.sin(this.lon), Math.sin(this.lat)];
        const g = [2 * p[0], 2 * p[1], 2 * p[2]];
        let s;
        if (this.gDim === 1) {
          const m = [-g[1], -g[2], 0];   // 三个 2×2 子式：|2x1 2x2; 1 0| = −2x2 等
          const sing = Math.abs(m[0]) < 0.03 && Math.abs(m[1]) < 0.03;
          s = `$$J = \\begin{pmatrix} ${g[0].toFixed(2)} & ${g[1].toFixed(2)} & ${g[2].toFixed(2)} \\\\ 1 & 0 & 0 \\end{pmatrix}\\quad(6.30)$$<p>三个 2×2 子式：\\(-2x_2 = ${m[0].toFixed(3)}\\)，\\(-2x_3 = ${m[1].toFixed(3)}\\)，\\(0\\)。${sing ? '<span class="yes">全为 0：这是临界点</span>' : "不全为 0：不是临界点"}。临界点只有 \\((\\pm1,0,0)\\)——球面法向与 [1 0 0] 平行的地方。</p>`;
        } else {
          const det = 2 * p[2];
          s = `$$J = \\begin{pmatrix} ${g[0].toFixed(2)} & ${g[1].toFixed(2)} & ${g[2].toFixed(2)} \\\\ 1 & 0 & 0 \\\\ 0 & 1 & 0 \\end{pmatrix}\\quad(6.31)$$<p>\\(\\det J = 2x_3 = ${det.toFixed(3)}\\)。${Math.abs(det) < 0.03 ? '<span class="yes">奇异：探针在赤道（轮廓线）上</span>' : "非奇异"}。临界点是 \\(x_1x_2\\) 平面与 \\(\\mathbb S^2\\) 的交——赤道 \\(x_1^2+x_2^2=1\\)（原书此处写成了 \\(\\mathbb S^3\\)）。把赤道和 g = x₁ 的两个孤立临界点合起来，就是球面的路线图。</p>`;
        }
        this.out.innerHTML = s;
      } else {
        const r1 = this.r1, r2 = this.r2;
        this.out.innerHTML = `<p>环面 (6.40)：\\((x_1^2+x_2^2+x_3^2-(r_1^2+r_2^2))^2 - 4r_1^2(r_2^2-x_3^2) = 0\\)。取 \\(g = (x_1,x_2)\\)，(6.28) 奇异 ⇔ \\(\\partial f/\\partial x_3 = 4x_3(\\|x\\|^2 + r_1^2 - r_2^2) = 0\\) ⇔ \\(x_3 = 0\\)：轮廓线是两个圆，半径 \\(r_1 \\pm r_2\\) = ${(r1 + r2).toFixed(2)}、${(r1 - r2).toFixed(2)}（图 6.37）。</p>`
          + `<p>\\(g_1 = x_1\\) 的临界点：\\(x_1 = \\pm(r_1 \\pm r_2)\\)、\\(x_2 = x_3 = 0\\)，共四个。只有轮廓线时内圈和外圈不连通——路线图没有保持连通性。于是在内侧两个临界点 \\(x_1 = \\pm(r_1 - r_2)\\) 处各取一个平行于 \\(x_2x_3\\) 平面的切片：截出一个「8」字（图 6.38），它从内圈的临界点出发，在 \\(x_2 = \\pm2\\sqrt{r_1r_2} = \\pm${(2 * Math.sqrt(r1 * r2)).toFixed(3)}\\) 处碰到外圈。加上这两条切片曲线，连通性就保住了（图 6.39）。</p>`;
      }
      PA.renderMath(this.out);
      this.st.draw(); this.st2.draw();
    }
    torusPt(u, v) { const r1 = this.r1, r2 = this.r2; return [(r1 + r2 * Math.cos(v)) * Math.cos(u), (r1 + r2 * Math.cos(v)) * Math.sin(u), r2 * Math.sin(v)]; }
    sliceCurve(c) {
      // x1 = c 截环面：对每个 v，cos u = c / (r1 + r2 cos v)
      const r1 = this.r1, r2 = this.r2, A = [], B = [];
      for (let k = 0; k <= 360; k++) {
        const v = (k / 360) * TAU, R = r1 + r2 * Math.cos(v), q = c / R;
        if (Math.abs(q) > 1) { A.push(null); B.push(null); continue; }
        const u = Math.acos(q);
        A.push([c, R * Math.sin(u), r2 * Math.sin(v)]); B.push([c, -R * Math.sin(u), r2 * Math.sin(v)]);
      }
      return [A, B];
    }
    draw3(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const pr = (a) => this.proj(a[0], a[1], a[2]);
      const poly = (arr, c, w, dash) => { let run = []; for (const a of arr) { if (a) run.push(pr(a)); else { if (run.length > 1) st.path(run, c, w, dash); run = []; } } if (run.length > 1) st.path(run, c, w, dash); };
      if (this.mode === "sphere") {
        for (let k = -2; k <= 2; k++) { const la = (k * Math.PI) / 6, arr = []; for (let i = 0; i <= 72; i++) { const lo = (i / 72) * TAU; arr.push([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]); } poly(arr, C.alpha(col.text, 0.22), 1); }
        for (let k = 0; k < 6; k++) { const lo = (k * Math.PI) / 6, arr = []; for (let i = 0; i <= 72; i++) { const la = (i / 72) * TAU; arr.push([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]); } poly(arr, C.alpha(col.text, 0.22), 1); }
        if (this.gDim === 2) { const arr = []; for (let i = 0; i <= 120; i++) { const t = (i / 120) * TAU; arr.push([Math.cos(t), Math.sin(t), 0]); } poly(arr, col.alive2, 3); }
        for (const s of [-1, 1]) st.dot(pr([s, 0, 0]), 6, col.bad, col.surface, 1.5);
        st.arrow(pr([0, 0, 0]), pr([1.45, 0, 0]), col.text2, 1.4, 7); st.text("x₁", pr([1.55, 0, 0]), col.text2, { size: 11 });
        st.arrow(pr([0, 0, 0]), pr([0, 1.45, 0]), col.text2, 1.4, 7); st.text("x₂", pr([0, 1.55, 0]), col.text2, { size: 11 });
        st.arrow(pr([0, 0, 0]), pr([0, 0, 1.4]), col.text2, 1.4, 7); st.text("x₃", pr([0, 0, 1.5]), col.text2, { size: 11 });
        const p = [Math.cos(this.lat) * Math.cos(this.lon), Math.cos(this.lat) * Math.sin(this.lon), Math.sin(this.lat)];
        st.dot(pr(p), 6, col.accent, col.surface, 1.5);
        st.arrow(pr(p), pr([p[0] * 1.4, p[1] * 1.4, p[2] * 1.4]), col.accent, 1.6, 7);
        return;
      }
      for (let k = 0; k < 24; k++) { const u = (k / 24) * TAU, arr = []; for (let i = 0; i <= 48; i++) arr.push(this.torusPt(u, (i / 48) * TAU)); poly(arr, C.alpha(col.text, 0.18), 1); }
      for (let k = 0; k < 12; k++) { const v = (k / 12) * TAU, arr = []; for (let i = 0; i <= 96; i++) arr.push(this.torusPt((i / 96) * TAU, v)); poly(arr, C.alpha(col.text, 0.18), 1); }
      if (this.show.sil) for (const R of [this.r1 + this.r2, this.r1 - this.r2]) { const arr = []; for (let i = 0; i <= 120; i++) { const t = (i / 120) * TAU; arr.push([R * Math.cos(t), R * Math.sin(t), 0]); } poly(arr, col.alive2, 2.8); }
      if (this.show.slice) for (const s of [-1, 1]) for (const br of this.sliceCurve(s * (this.r1 - this.r2))) poly(br, col.warn, 2.4);
      if (this.show.crit) for (const x of [this.r1 + this.r2, this.r1 - this.r2, -(this.r1 - this.r2), -(this.r1 + this.r2)]) st.dot(pr([x, 0, 0]), 5.5, col.bad, col.surface, 1.5);
    }
    draw2(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const ctx = st.ctx;
      if (this.mode === "sphere") {
        // 投影到 x1x2 平面：单位圆盘，轮廓线是边界圆
        ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), st.scale, 0, TAU); ctx.fillStyle = C.alpha(col.accent, 0.08); ctx.fill();
        ctx.strokeStyle = this.gDim === 2 ? col.alive2 : C.alpha(col.text, 0.4); ctx.lineWidth = this.gDim === 2 ? 3 : 1; ctx.stroke();
        for (const s of [-1, 1]) st.dot(P(s, 0), 6, col.bad, col.surface, 1.5);
        const p = [Math.cos(this.lat) * Math.cos(this.lon), Math.cos(this.lat) * Math.sin(this.lon)];
        st.dot(P(p[0], p[1]), 5, col.accent, col.surface, 1.5);
        st.text("投影到 x₁x₂ 平面", P(0, -1.0), col.text2, { size: 11 });
        return;
      }
      // 例 6.8：投影到 x1x2 平面（图 6.37、6.39）
      for (const R of [this.r1 + this.r2, this.r1 - this.r2]) { ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), R * st.scale, 0, TAU); ctx.strokeStyle = this.show.sil ? col.alive2 : C.alpha(col.text, 0.3); ctx.lineWidth = this.show.sil ? 2.6 : 1; ctx.stroke(); }
      if (this.show.slice) for (const s of [-1, 1]) {
        const c = s * (this.r1 - this.r2), w = 2 * Math.sqrt(this.r1 * this.r2);
        st.line(P(c, -w), P(c, w), col.warn, 2.6);
        for (const y of [-w, w]) st.dot(P(c, y), 4, col.warn);
      }
      if (this.show.crit) for (const x of [this.r1 + this.r2, this.r1 - this.r2, -(this.r1 - this.r2), -(this.r1 + this.r2)]) st.dot(P(x, 0), 5.5, col.bad, col.surface, 1.5);
      st.text("投影到 x₁x₂ 平面（俯视）", P(0, -2.3), col.text2, { size: 11 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='tarski']").forEach((el) => el._w = new Tarski(el));
    document.querySelectorAll("[data-widget='sign-decomp']").forEach((el) => el._w = new SignDecomp(el));
    document.querySelectorAll("[data-widget='cad1d']").forEach((el) => el._w = new CAD1D(el));
    document.querySelectorAll("[data-widget='cad2d']").forEach((el) => el._w = new CAD2D(el));
    document.querySelectorAll("[data-widget='canny']").forEach((el) => el._w = new Canny(el));
  });
  window.CH6.cad = cad;
  window.CH6.gingerCurves = gingerCurves;
  window.CH6.GINGER = GINGER;
})();
