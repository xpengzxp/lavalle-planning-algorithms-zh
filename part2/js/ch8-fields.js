/* 8.3.1 节：向量场、积分曲线、分段光滑向量场与 Filippov 解 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;

  const lin = (A) => (p) => ({ x: A[0][0] * p.x + A[0][1] * p.y, y: A[1][0] * p.x + A[1][1] * p.y });
  const FIELDS = {
    c11: { name: "例 8.6 / 图 8.5a：常值场 [1 1]", f: () => ({ x: 1, y: 1 }), exact: (p, t) => ({ x: p.x + t, y: p.y + t }) },
    c12: { name: "例 8.6 正文、例 8.9：常值场 [1 2]", f: () => ({ x: 1, y: 2 }), exact: (p, t) => ({ x: p.x + t, y: p.y + 2 * t }) },
    inward: { name: "例 8.7 / 图 8.5b：向内流 [−x  −y]", A: [[-1, 0], [0, -1]], exact: (p, t) => ({ x: p.x * Math.exp(-t), y: p.y * Math.exp(-t) }) },
    swirl: { name: "例 8.8 / 图 8.6：漩涡 [(y−x)  (−x−y)]", A: [[-1, 1], [-1, -1]],
      exact: (p, t) => { const e = Math.exp(-t), c = Math.cos(t), s = Math.sin(t); return { x: e * (p.x * c + p.y * s), y: e * (-p.x * s + p.y * c) }; } },
    lin810: { name: "例 8.10：线性场 [−2x₁  −x₂]", A: [[-2, 0], [0, -1]], exact: (p, t) => ({ x: p.x * Math.exp(-2 * t), y: p.y * Math.exp(-t) }) },
    custom: { name: "线性场 ẋ = Ax（自己调 A）", A: null },
    nonlip: { name: "补充：不满足 Lipschitz 的场 [1  sgn(x₂)√|x₂|]", f: (p) => ({ x: 1, y: Math.sign(p.y) * Math.sqrt(Math.abs(p.y)) }) },
  };

  // =================================================================
  // 组件 5：向量场图库与积分曲线（例 8.6–8.10，式 8.11–8.16）
  // =================================================================
  class VectorFields {
    constructor(root) {
      this.key = "swirl"; this.method = "rk4"; this.dt = 0.05; this.T = 4; this.A = [[-0.5, 1], [-1, -0.2]]; this.norm = false; this.particles = false;
      this.curves = [];
      const body = C.frame(root, "向量场与积分曲线", "点画布任意处放一个初始状态 x₀，画出从它出发的积分曲线 τ(t)");
      this.st = new C.Stage({ view: [-2.2, 2.2, -2.2, 2.2], maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.addCurve(p); return null; } });
      this.sel = C.select(Object.entries(FIELDS).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.curves = []; this.syncCustom(); this.defaultCurves(); this.redo(); });
      this.segMeth = C.seg([["rk4", "RK4"], ["euler", "Euler"]], this.method, (k) => { this.method = k; this.redo(); });
      this.sDt = C.slider("步长 Δt", 0.01, 0.5, 0.01, this.dt, (v) => { this.dt = v; this.redo(); }, (v) => v.toFixed(2));
      this.sT = C.slider("积分到 t =", 0.5, 8, 0.5, this.T, (v) => { this.T = v; this.redo(); }, (v) => v.toFixed(1));
      this.cbN = C.check("针长归一化", false, (v) => { this.norm = v; this.st.draw(); });
      this.cbP = C.check("粒子流动画", false, (v) => { this.particles = v; if (v) { this.seedParticles(); this.runner.start(); } else { this.runner.stop(); this.st.draw(); } });
      this.runner = new C.Runner(() => { this.advectParticles(); this.st.draw(); return this.particles; });
      this.aBox = h("div", { class: "controls" });
      this.aSl = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([i, j]) => C.slider(`a${i + 1}${j + 1}`, -2, 2, 0.1, this.A[i][j], (v) => { this.A[i][j] = v; this.redo(); }, (v) => v.toFixed(1)));
      this.aBox.append(...this.aSl);
      this.eig = h("div", { class: "small" });
      this.info = h("div", { class: "panel-body" });
      body.append(h("div", { class: "controls" }, this.sel, C.button("清空曲线", () => { this.curves = []; this.redo(); }, "small")),
        h("div", { class: "controls" }, this.segMeth, this.sDt, this.sT), h("div", { class: "controls" }, this.cbN, this.cbP),
        this.aBox,
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.eig, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "最后一条积分曲线"), this.info),
          C.legend([[C.cva("accent", .7), "f(x) 的针状图"], [C.cv("path"), "数值积分得到的 τ(t)"], [C.cv("muted"), "解析解（虚线，已知时）"], [C.cv("start"), "初始状态 x₀"]]))));
      this.syncCustom(); this.defaultCurves(); this.redo();
    }
    field() {
      const F = FIELDS[this.key];
      if (F.f) return F.f;
      return lin(F.A || this.A);
    }
    syncCustom() {
      this.aBox.style.display = this.key === "custom" ? "" : "none";
      const A = FIELDS[this.key].A || (this.key === "custom" ? this.A : null);
      if (!A) { this.eig.innerHTML = this.key === "nonlip" ? '<p class="small muted" style="margin:0 0 8px">在 x₂ = 0 附近 √|x₂| 的斜率趋于无穷，(8.16) 的 Lipschitz 条件不成立。从 x₂ = 0 上的点出发试试。</p>' : '<p class="small muted" style="margin:0 0 8px">常值场：积分曲线是直线 τ(t) = x₀ + t·f。</p>'; return; }
      const tr = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0], disc = tr * tr - 4 * det;
      let ev, kind;
      if (disc < -1e-12) { const re = tr / 2, im = Math.sqrt(-disc) / 2; ev = `${re.toFixed(2)} ± ${im.toFixed(2)}i`; kind = Math.abs(re) < 1e-9 ? "中心：闭合轨道" : re < 0 ? "稳定螺旋点（焦点）：转着圈收敛到原点" : "不稳定螺旋点：转着圈发散"; }
      else { const l1 = (tr + Math.sqrt(Math.max(0, disc))) / 2, l2 = (tr - Math.sqrt(Math.max(0, disc))) / 2; ev = `${l1.toFixed(2)}, ${l2.toFixed(2)}`; kind = det < -1e-12 ? "鞍点：只有一个方向流向原点" : (l1 < 0 && l2 < 0) ? "稳定结点：所有曲线收敛到原点" : (l1 > 0 && l2 > 0) ? "不稳定结点" : "退化（有零特征值）"; }
      this.eig.innerHTML = `<p class="small" style="margin:0 0 8px">A = [[${A[0].map((v) => v.toFixed(1)).join(", ")}], [${A[1].map((v) => v.toFixed(1)).join(", ")}]]，特征值 <b>${ev}</b>：${kind}。</p>`;
    }
    defaultCurves() {
      const starts = { c11: [{ x: -1.8, y: -1.2 }], c12: [{ x: 0, y: 0 }], inward: [{ x: 1.8, y: 1.2 }, { x: -1.5, y: 1.9 }], swirl: [{ x: 1.8, y: 1.6 }], lin810: [{ x: 1, y: 1 }, { x: -1.8, y: 1.9 }], custom: [{ x: 1.5, y: 1.5 }], nonlip: [{ x: -2, y: 0 }, { x: -2, y: -1 }] };
      this.curves = (starts[this.key] || []).map((p) => ({ p0: p }));
    }
    addCurve(p) { this.curves.push({ p0: p }); if (this.curves.length > 8) this.curves.shift(); this.redo(); }
    redo() {
      const f = this.field(), F = FIELDS[this.key];
      const n = Math.max(1, Math.round(this.T / this.dt));
      for (const c of this.curves) {
        c.pts = C.integrate(f, c.p0, { dt: this.T / n, steps: n, method: this.method, stop: (q) => Math.abs(q.x) > 50 || Math.abs(q.y) > 50 });
        c.ex = null;
        if (F.exact) { c.ex = []; for (let k = 0; k <= 200; k++) c.ex.push(F.exact(c.p0, this.T * k / 200)); }
      }
      const c = this.curves[this.curves.length - 1];
      if (c) {
        const end = c.pts[c.pts.length - 1];
        let html = `x₀ = (${c.p0.x.toFixed(2)}, ${c.p0.y.toFixed(2)})<br>数值 τ(${this.T}) = (${end.x.toFixed(4)}, ${end.y.toFixed(4)})，用了 ${c.pts.length - 1} 步`;
        if (F.exact) { const ex = F.exact(c.p0, this.T); html += `<br>解析 τ(${this.T}) = (${ex.x.toFixed(4)}, ${ex.y.toFixed(4)})<br>误差 <b>${C.dist(ex, end).toExponential(2)}</b>`; }
        if (this.key === "nonlip" && Math.abs(c.p0.y) < 0.06) html += '<br><span class="no">x₂(0) ≈ 0：数值积分留在 x₂ = 0 上，但虚线 x₂ = ±((t−c)/2)²（任意 c ≥ 0）也都满足 (8.14)——解不唯一。</span>';
        this.info.innerHTML = html;
      } else this.info.textContent = "点画布添加一条积分曲线。";
      this.st.draw();
    }
    seedParticles() { const r = C.rng(5); this.P = Array.from({ length: 160 }, () => ({ x: -2.2 + 4.4 * r(), y: -2.2 + 4.4 * r(), age: Math.floor(r() * 120) })); this.pr = r; }
    advectParticles() {
      const f = this.field(), r = this.pr;
      for (const q of this.P) {
        const nq = C.rk4(f, q, 0.012);
        q.age++;
        if (!nq || Math.abs(nq.x) > 2.3 || Math.abs(nq.y) > 2.3 || q.age > 160) { q.x = -2.2 + 4.4 * r(); q.y = -2.2 + 4.4 * r(); q.age = 0; continue; }
        q.x = nq.x; q.y = nq.y;
      }
    }
    draw(ctx, st, col) {
      st.frame(col);
      // 坐标轴
      st.line({ x: -2.2, y: 0 }, { x: 2.2, y: 0 }, col.border, 1); st.line({ x: 0, y: -2.2 }, { x: 0, y: 2.2 }, col.border, 1);
      for (const v of [-2, -1, 1, 2]) { st.text(String(v), { x: v, y: 0 }, col.muted, { size: 10, dy: 9 }); st.text(String(v), { x: 0, y: v }, col.muted, { size: 10, dx: -9 }); }
      st.text("x₁", { x: 2.1, y: 0 }, col.muted, { size: 12, dy: -9 }); st.text("x₂", { x: 0, y: 2.1 }, col.muted, { size: 12, dx: 12 });
      const f = this.field();
      st.needles(f, col, { n: 21, normalize: this.norm, color: C.alpha(col.accent, .7), maxLen: .85 });
      if (this.particles && this.P) for (const q of this.P) st.dot(q, 1.8, C.alpha(col.path, Math.min(1, .25 + q.age / 60)));
      for (const c of this.curves) {
        if (c.ex) st.polyline(c.ex, col.muted, 1.6, [5, 4]);
        if (this.key === "nonlip" && Math.abs(c.p0.y) < 0.06) {
          for (const cc of [0, 0.6, 1.2, 1.8]) for (const sg of [1, -1]) { const P = []; for (let k = 0; k <= 60; k++) { const t = cc + (this.T - cc) * k / 60; P.push({ x: c.p0.x + t, y: sg * ((t - cc) / 2) ** 2 }); } st.polyline([{ x: c.p0.x, y: 0 }, { x: c.p0.x + cc, y: 0 }, ...P], C.alpha(col.warn, .8), 1.4, [4, 3]); }
        }
        if (c.pts) { st.polyline(c.pts, col.path, 2.4); if (this.method === "euler" && this.dt >= .1) for (const q of c.pts) st.dot(q, 2, col.path); }
        st.dot(c.p0, 5, col.start, col.surface, 1.5);
      }
    }
  }

  // =================================================================
  // 组件 6：切换边界与 Filippov 解（式 8.17–8.21，图 8.7）
  // =================================================================
  const FLOWS = {
    consistent: { name: "一致流 Consistent", fp: { x: -0.35, y: -1 }, fm: { x: 0.35, y: -1 } },
    inward: { name: "向内流 Inward", fp: { x: 0.45, y: -1 }, fm: { x: 0.45, y: 1 } },
    outward: { name: "向外流 Outward", fp: { x: 0.45, y: 1 }, fm: { x: 0.45, y: -1 } },
    tangent: { name: "切向流 Tangent", fp: { x: -0.9, y: 0 }, fm: { x: -0.45, y: 0 } },
  };

  class Filippov {
    constructor(root) {
      this.flow = "inward"; this.dt = 0.04; this.eps = 0; this.p0 = { x: -0.9, y: 0.7 };
      const body = C.frame(root, "切换边界上的 Filippov 解", "S = {x₂ = 0}：上方 S₊ 用 f₊，下方 S₋ 用 f₋；点画布放初始状态，右边拖箭头改 f₊、f₋");
      this.st = new C.Stage({ view: [-1.2, 1.2, -1, 1], aspect: 2 / 2.4, maxW: 480, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.p0 = { x: C.clamp(p.x, -1.18, 1.18), y: Math.abs(p.y) < 0.03 ? 0 : C.clamp(p.y, -.98, .98) }; this.sim(); return null; } });
      this.ed = new C.Stage({ view: [-1.3, 1.3, -1.3, 1.3], maxW: 210, minW: 150, onDraw: (ctx, st, col) => this.drawEd(ctx, st, col),
        onDown: (p) => (C.dist(p, this.fp) < .22 ? "fp" : C.dist(p, this.fm) < .22 ? "fm" : null),
        onMove: (p, d) => { const q = { x: C.clamp(p.x, -1.2, 1.2), y: C.clamp(p.y, -1.2, 1.2) }; if (Math.abs(q.y) < .06) q.y = 0; this[d] = q; this.flow = "custom"; this.segF.set(""); this.sim(); },
        cursor: (p) => (C.dist(p, this.fp) < .22 || C.dist(p, this.fm) < .22 ? "grab" : null) });
      this.segF = C.seg(Object.entries(FLOWS).map(([k, v]) => [k, v.name]), this.flow, (k) => { this.flow = k; this.fp = { ...FLOWS[k].fp }; this.fm = { ...FLOWS[k].fm }; this.p0 = k === "outward" || k === "tangent" ? { x: -0.9, y: 0 } : { x: -0.9, y: 0.7 }; this.sim(); this.ed.draw(); });
      this.sDt = C.slider("Euler 步长 Δt", 0.005, 0.12, 0.005, this.dt, (v) => { this.dt = v; this.sim(); }, (v) => v.toFixed(3));
      this.sEps = C.slider("正则化：把 S 加厚到 ±ε", 0, 0.2, 0.01, this.eps, (v) => { this.eps = v; this.sim(); }, (v) => (v ? v.toFixed(2) : "不加厚"));
      this.info = h("div", { class: "panel-body" });
      body.append(h("div", { class: "controls" }, this.segF), h("div", { class: "controls" }, this.sDt, this.sEps),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "拖动箭头尖端：f₊（上）与 f₋（下）"), this.ed.wrap),
          h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "在 S 上发生了什么"), this.info))),
        C.legend([[C.cv("warn"), "按区域直接 Euler 积分（会在 S 附近抖动）"], [C.cv("path"), "Filippov 解（理想情形）"], [C.cv("accent"), "加厚 S 后的光滑解"], [C.cva("alive2", .8), "S 上的凸包 hull{f₊, f₋}"]]));
      this.fp = { ...FLOWS[this.flow].fp }; this.fm = { ...FLOWS[this.flow].fm };
      this.sim();
    }
    fRegion(p) { return p.y > 0 ? this.fp : this.fm; }
    fEps(p) {
      const e = this.eps; if (p.y >= e) return this.fp; if (p.y <= -e) return this.fm;
      const a = (p.y + e) / (2 * e); return { x: a * this.fp.x + (1 - a) * this.fm.x, y: a * this.fp.y + (1 - a) * this.fm.y };
    }
    // S 上的滑动速度：凸组合中与 S 相切（y 分量为 0）的那个
    slide() {
      const a = this.fp.y, b = this.fm.y;
      if (Math.abs(a - b) < 1e-12) return Math.abs(a) < 1e-12 ? { x: this.fp.x, y: 0, any: true } : null;
      const al = b / (b - a); if (al < -1e-9 || al > 1 + 1e-9) return null;
      return { x: al * this.fp.x + (1 - al) * this.fm.x, y: 0, al };
    }
    kind() {
      const a = this.fp.y, b = this.fm.y, e = 1e-9;
      if (Math.abs(a) < e && Math.abs(b) < e) return "tangent";
      if (a < -e && b > e) return "inward";
      if (a > e && b < -e) return "outward";
      if ((a < -e && b < -e) || (a > e && b > e)) return "consistent";
      return "edge";
    }
    sim() {
      const T = 3, inView = (q) => Math.abs(q.x) < 1.25 && Math.abs(q.y) < 1.05;
      // 1) 直接 Euler
      const n = Math.round(T / this.dt);
      this.naive = C.integrate((p) => this.fRegion(p), this.p0, { dt: this.dt, steps: n, method: "euler", stop: (q) => !inView(q) });
      let cross = 0; for (let k = 1; k < this.naive.length; k++) if ((this.naive[k].y > 0) !== (this.naive[k - 1].y > 0)) cross++;
      this.crossings = cross;
      // 2) 加厚边界
      this.reg = this.eps > 0 ? C.integrate((p) => this.fEps(p), this.p0, { dt: 0.004, steps: Math.round(T / 0.004), method: "rk4", stop: (q) => !inView(q) }) : null;
      // 3) Filippov 解：两侧都是常值场，所以每段都是直线
      const kind = this.kind(), sl = this.slide();
      this.fil = []; this.contact = null;
      const p0 = this.p0;
      if (Math.abs(p0.y) > 1e-9) {
        const f = this.fRegion(p0);
        const toS = f.y * p0.y < 0 ? -p0.y / f.y : Infinity;   // 何时碰到 S
        if (toS < T) {
          const hit = { x: p0.x + f.x * toS, y: 0 }; this.contact = hit;
          const rest = T - toS;
          if (kind === "inward") this.fil.push([p0, hit, { x: hit.x + sl.x * rest, y: 0 }]);
          else { const g = p0.y > 0 ? this.fm : this.fp; this.fil.push([p0, hit, { x: hit.x + g.x * rest, y: g.y * rest }]); }
        } else this.fil.push([p0, { x: p0.x + f.x * T, y: p0.y + f.y * T }]);
      } else {
        this.contact = p0;
        if (kind === "inward" || kind === "tangent") this.fil.push([p0, { x: p0.x + sl.x * T, y: 0 }]);
        if (kind === "tangent") { this.fil.push([p0, { x: p0.x + this.fp.x * T, y: 0 }]); this.fil.push([p0, { x: p0.x + this.fm.x * T, y: 0 }]); }
        if (kind === "outward") { this.fil.push([p0, { x: p0.x + this.fp.x * T, y: this.fp.y * T }], [p0, { x: p0.x + this.fm.x * T, y: this.fm.y * T }]); if (sl) this.fil.push([p0, { x: p0.x + sl.x * T, y: 0 }]); }
        if (kind === "consistent") { const g = this.fp.y < 0 ? this.fm : this.fp; this.fil.push([p0, { x: p0.x + g.x * T, y: g.y * T }]); }
      }
      const txt = {
        inward: `两侧都指向 S。到达 S 后，Filippov 条件 (8.21) 要求速度落在线段 hull{f₊, f₋} 上，而能留在 S 上的只有与 S 相切的那一个：<b>(${sl ? sl.x.toFixed(2) : "–"}, 0)</b>（α = ${sl && sl.al !== undefined ? sl.al.toFixed(2) : "–"} 的凸组合）。解沿 S 滑动——这就是滑模控制 sliding-mode control 的「滑动」。直接 Euler 积分则在 S 两侧来回跳了 <b>${this.crossings}</b> 次：物理系统里这是振荡。`,
        consistent: `两侧速度都指向同一侧，解直接穿过 S。在 S 上 Filippov 允许 hull{f₊, f₋} 里任何速度，但它们都朝下（或都朝上），所以穿越是唯一的。`,
        outward: `两侧都背离 S。从 S 外出发的解永远不会碰到 S，没有麻烦；但从 S 上出发，往上（f₊）、往下（f₋）、沿 S 滑动 ${sl ? `(${sl.x.toFixed(2)}, 0)` : ""} 都满足 (8.21)：<b>解不唯一</b>。`,
        tangent: `两侧都平行于 S。在 S 上，hull{f₊, f₋} 里每个速度都与 S 相切，于是沿 S 以 ${Math.min(-this.fp.x, -this.fm.x).toFixed(2)} 到 ${Math.max(-this.fp.x, -this.fm.x).toFixed(2)} 之间任何速率前进都是解——另一种不唯一。本章避开这种情形。`,
        edge: `有一侧的速度恰好与 S 相切（f 的 x₂ 分量为 0），处于上面几种情形的分界。`,
      };
      this.info.innerHTML = txt[kind] + (this.eps > 0 ? `<br><span class="muted">加厚：在 |x₂| < ε 内用 f₊、f₋ 的线性混合（正则化），蓝线是光滑的，${kind === "inward" ? "最终停在 S 附近滑动、不再抖动" : "形状与 Filippov 解接近"}。</span>` : "");
      this.st.draw(); this.ed.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.eps > 0) { ctx.fillStyle = C.alpha(col.accent, .1); ctx.fillRect(st.X(-1.2), st.Y(this.eps), 2.4 * st.scale, 2 * this.eps * st.scale); }
      st.needles((p) => (Math.abs(p.y) < 1e-9 ? null : this.fRegion(p)), col, { n: 14, normalize: false, color: C.alpha(col.accent, .55), maxLen: .8, vmax: 1.2 });
      st.line({ x: -1.2, y: 0 }, { x: 1.2, y: 0 }, col.text, 2.2);
      st.text("S：x₂ = 0", { x: 1.15, y: 0 }, col.text2, { align: "right", dy: -10, size: 12 });
      st.text("S₊（f₊）", { x: -1.15, y: .92 }, col.muted, { align: "left", size: 12 });
      st.text("S₋（f₋）", { x: -1.15, y: -.92 }, col.muted, { align: "left", size: 12 });
      st.polyline(this.naive, col.warn, 1.8);
      if (this.reg) st.polyline(this.reg, col.accent, 2.4);
      for (const P of this.fil) st.polyline(P, col.path, 3, this.fil.length > 1 ? [6, 4] : null);
      if (this.contact) {
        // 凸包 hull{f₊, f₋}：画在接触点上（缩短一点）
        const c = this.contact, s = .35;
        const A = { x: c.x + this.fp.x * s, y: c.y + this.fp.y * s }, B = { x: c.x + this.fm.x * s, y: c.y + this.fm.y * s };
        st.poly([c, A, B], C.alpha(col.alive2, .22)); st.line(A, B, col.alive2, 2.5);
        st.arrow(c, { x: this.fp.x * s, y: this.fp.y * s }, col.alive2, { lw: 1.6 }); st.arrow(c, { x: this.fm.x * s, y: this.fm.y * s }, col.alive2, { lw: 1.6 });
        const sl = this.slide(); if (sl && !sl.any && this.kind() !== "consistent") st.arrow(c, { x: sl.x * s, y: 0 }, col.path, { lw: 2.4 });
      }
      st.dot(this.p0, 5.5, col.start, col.surface, 1.5);
    }
    drawEd(ctx, st, col) {
      st.frame(col);
      st.line({ x: -1.3, y: 0 }, { x: 1.3, y: 0 }, col.border, 1); st.line({ x: 0, y: -1.3 }, { x: 0, y: 1.3 }, col.border, 1);
      st.poly([{ x: 0, y: 0 }, this.fp, this.fm], C.alpha(col.alive2, .2)); st.line(this.fp, this.fm, col.alive2, 2);
      st.arrow({ x: 0, y: 0 }, this.fp, col.accent, { lw: 2.2, head: 8 }); st.arrow({ x: 0, y: 0 }, this.fm, col.warn, { lw: 2.2, head: 8 });
      st.dot(this.fp, 6, col.accent, col.surface, 1.5); st.dot(this.fm, 6, col.warn, col.surface, 1.5);
      st.text("f₊", this.fp, col.accent, { dx: 12, dy: -8, weight: 650 }); st.text("f₋", this.fm, col.warn, { dx: 12, dy: 8, weight: 650 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-vfields']").forEach((el) => el._w = new VectorFields(el));
    document.querySelectorAll("[data-widget='ch8-filippov']").forEach((el) => el._w = new Filippov(el));
  });
})();
