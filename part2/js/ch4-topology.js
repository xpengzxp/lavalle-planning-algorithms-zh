/* 第 4 章 · 4.1 拓扑基本概念的互动图：
   point-class（图 4.1 内点/外点/边界点）、finite-topology（例 4.4 / 习题 1）、
   homeo（例 4.5 区间同胚）、manifold-test（图 4.4 / 例 4.6） */
(function () {
  "use strict";
  const { shell, svgPoint, slider, segmented, button, checkbox, G, num, h, s } = CH4;

  // =====================================================================
  // 1. 内点 / 外点 / 边界点
  // =====================================================================
  class PointClass {
    constructor(root) {
      this.body = shell(root, "内点、外点、边界点", "图 4.1：拖动点 x，调开球半径 ε");
      this.mode = "2d";
      this.eps = 26;
      this.closed2d = true;
      this.p = [300, 150];
      this.itype = "[)";
      this.x1 = 0.0;
      this.eps1 = 0.12;
      this.showSeq = true;
      // U：一个不规则的「土豆」
      this.U = [];
      for (let i = 0; i < 90; i++) {
        const t = (i / 90) * 2 * Math.PI;
        const r = 105 + 18 * Math.sin(3 * t) + 10 * Math.cos(5 * t + 0.6);
        this.U.push([250 + 1.25 * r * Math.cos(t), 165 - 0.95 * r * Math.sin(t)]);
      }
      this.build();
    }
    build() {
      const b = this.body;
      const ctr = h("div", { class: "controls" });
      ctr.append(
        segmented([["2d", "二维：图 4.1"], ["1d", "一维：区间"]], this.mode, (k) => { this.mode = k; this.render(); }),
      );
      this.ctr2 = h("span", { class: "controls", style: "margin:0" },
        slider("ε =", 2, 80, 1, this.eps, (v) => { this.eps = v; this.render(); }, (v) => v + " px"),
        checkbox("U 包含自己的边界（闭集）", this.closed2d, (v) => { this.closed2d = v; this.render(); }));
      const itSeg = segmented([["()", "(0,1)"], ["[]", "[0,1]"], ["[)", "[0,1)"], ["(]", "(0,1]"]], this.itype, (k) => { this.itype = k; this.render(); });
      this.ctr1 = h("span", { class: "controls", style: "margin:0" }, itSeg,
        slider("ε =", 0.01, 0.4, 0.01, this.eps1, (v) => { this.eps1 = v; this.render(); }, (v) => num(v, 2)),
        checkbox("显示数列 1/2<sup>i</sup>", this.showSeq, (v) => { this.showSeq = v; this.render(); }));
      ctr.append(this.ctr2, this.ctr1);
      this.svg = s("svg", { viewBox: "0 0 560 320", style: "width:100%;max-width:640px;display:block;margin:0 auto;touch-action:none;user-select:none" });
      this.info = h("div", { class: "panel-body", style: "min-height:110px" });
      b.append(ctr, h("div", { class: "split" },
        h("div", { class: "svg-wrap" }, this.svg),
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, "判定"), this.info)));
      // 拖拽：整个 svg 都可以拖
      let drag = false;
      const move = (e) => {
        const p = svgPoint(this.svg, e);
        if (this.mode === "2d") {
          let q = [Math.max(10, Math.min(550, p.x)), Math.max(10, Math.min(310, p.y))];
          const c = this.closest(q);
          if (c.d < 7) q = c.p; // 吸附到边界上
          this.p = q;
        } else {
          this.x1 = Math.max(-0.45, Math.min(1.45, this.fromX(p.x)));
          for (const v of [0, 1]) if (Math.abs(this.x1 - v) < 0.025) this.x1 = v;
        }
        this.render();
      };
      this.svg.addEventListener("pointerdown", (e) => { drag = true; try { this.svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } move(e); });
      this.svg.addEventListener("pointermove", (e) => { if (drag) move(e); });
      this.svg.addEventListener("pointerup", () => { drag = false; });
      this.render();
    }
    closest(q) {
      let best = { d: Infinity, p: q };
      for (let i = 0; i < this.U.length; i++) {
        const a = this.U[i], c = this.U[(i + 1) % this.U.length];
        const r = G.closestOnSeg(q, a, c);
        const d = G.len(G.sub(q, r.p));
        if (d < best.d) best = { d, p: r.p };
      }
      return best;
    }
    toX(x) { return 80 + 400 * x; }
    fromX(X) { return (X - 80) / 400; }
    render() {
      this.ctr2.classList.toggle("hidden", this.mode !== "2d");
      this.ctr1.classList.toggle("hidden", this.mode !== "1d");
      this.svg.innerHTML = "";
      if (this.mode === "2d") this.render2d(); else this.render1d();
    }
    render2d() {
      const svg = this.svg, U = this.U, p = this.p, eps = this.eps;
      svg.append(s("text", { x: 14, y: 24, fill: "var(--muted)", "font-size": 13 }, "X = ℝ²"));
      const d = "M" + U.map((q) => q.map((v) => v.toFixed(1)).join(",")).join("L") + "Z";
      svg.append(s("path", { d, fill: "var(--accent-soft)", stroke: "var(--accent)", "stroke-width": 2.2, "stroke-dasharray": this.closed2d ? "none" : "6 5" }));
      svg.append(s("text", { x: 250, y: 172, fill: "var(--accent-text)", "font-size": 22, "font-style": "italic", "text-anchor": "middle" }, "U"));
      const c = this.closest(p);
      const inside = G.pointInPoly(p, U);
      const onB = c.d < 0.5;
      const dist = c.d;
      let kind, ballCls;
      if (onB) kind = "boundary"; else kind = inside ? "interior" : "exterior";
      if (onB || eps >= dist) ballCls = "straddle"; else ballCls = inside ? "in" : "out";
      const col = { in: "var(--ok)", out: "var(--muted)", straddle: "var(--warn)" }[ballCls];
      svg.append(s("circle", { cx: p[0], cy: p[1], r: eps, fill: col, "fill-opacity": 0.14, stroke: col, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
      if (!onB) svg.append(s("line", { x1: p[0], y1: p[1], x2: c.p[0], y2: c.p[1], stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "2 3" }));
      const inU = kind === "interior" || (kind === "boundary" && this.closed2d);
      svg.append(s("circle", { cx: p[0], cy: p[1], r: 6.5, fill: inU ? "var(--bad)" : "var(--surface)", stroke: "var(--bad)", "stroke-width": 2.4 }));
      svg.append(s("text", { x: p[0] + 10, y: p[1] - 10, fill: "var(--bad)", "font-size": 15, "font-style": "italic" }, "x"));
      svg.append(s("text", { x: 546, y: 308, fill: "var(--muted)", "font-size": 12, "text-anchor": "end" }, "点 x 拖到边界附近会自动吸附到边界上"));
      const names = { interior: "内点 interior point", exterior: "外点 exterior point", boundary: "边界点 boundary point" };
      const why = {
        interior: `取任意 ε &lt; d = ${num(dist, 1)} px，开球 B(x, ε) 整个落在 U 里 → 存在开集 O<sub>1</sub> ∋ x 且 O<sub>1</sub> ⊆ U。`,
        exterior: `取任意 ε &lt; d = ${num(dist, 1)} px，开球 B(x, ε) 整个落在 X \\ U 里 → 存在开集 O<sub>2</sub> ∋ x 且 O<sub>2</sub> ⊆ X \\ U。`,
        boundary: "无论 ε 取多小，B(x, ε) 总是既含 U 的点又含 U 外的点 → 既不是内点也不是外点。",
      };
      this.info.innerHTML = `
        <p style="margin:0 0 6px"><b>x 是 U 的${names[kind]}</b></p>
        <p class="small" style="margin:0 0 6px">${why[kind]}</p>
        <p class="small" style="margin:0 0 6px">当前 ε = ${eps} px：开球${ballCls === "in" ? "⊆ U" : ballCls === "out" ? "⊆ X \\ U" : "跨过了边界"}。${ballCls === "straddle" && !onB ? "把 ε 调小，开球就会完全落到一侧。" : ""}</p>
        <p class="small" style="margin:0 0 6px">x ${kind === "exterior" ? "<b>不是</b>" : "<b>是</b>"}极限点（limit point），${kind === "exterior" ? "不在" : "在"} cl(U) 里。${kind === "boundary" ? (this.closed2d ? "现在 U 包含边界，所以 x ∈ U。" : "现在 U 不含边界（虚线），所以 x ∉ U。") : ""}</p>
        <p class="small muted" style="margin:0">U 现在是${this.closed2d ? "<b>闭集</b>（含全部边界点；补集是开集）" : "<b>开集</b>（不含任何边界点）"}。</p>`;
    }
    render1d() {
      const svg = this.svg, t = this.itype, x = this.x1, eps = this.eps1;
      const y0 = 170;
      svg.append(s("text", { x: 14, y: 24, fill: "var(--muted)", "font-size": 13 }, "X = ℝ"));
      svg.append(s("line", { x1: 20, y1: y0, x2: 540, y2: y0, stroke: "var(--border-strong)", "stroke-width": 1.5 }));
      for (let k = -0.25; k <= 1.251; k += 0.25) {
        const X = this.toX(k);
        svg.append(s("line", { x1: X, y1: y0 - 5, x2: X, y2: y0 + 5, stroke: "var(--muted)" }));
        svg.append(s("text", { x: X, y: y0 + 24, "text-anchor": "middle", fill: "var(--muted)", "font-size": 12 }, num(k, 2)));
      }
      svg.append(s("line", { x1: this.toX(0), y1: y0, x2: this.toX(1), y2: y0, stroke: "var(--accent)", "stroke-width": 7, "stroke-linecap": "butt", opacity: 0.85 }));
      const lc = t[0] === "[", rc = t[1] === "]";
      svg.append(s("circle", { cx: this.toX(0), cy: y0, r: 7, fill: lc ? "var(--accent)" : "var(--surface)", stroke: "var(--accent)", "stroke-width": 2.4 }));
      svg.append(s("circle", { cx: this.toX(1), cy: y0, r: 7, fill: rc ? "var(--accent)" : "var(--surface)", stroke: "var(--accent)", "stroke-width": 2.4 }));
      const label = { "()": "(0, 1)", "[]": "[0, 1]", "[)": "[0, 1)", "(]": "(0, 1]" }[t];
      svg.append(s("text", { x: this.toX(0.5), y: y0 - 18, "text-anchor": "middle", fill: "var(--accent-text)", "font-size": 16 }, "U = " + label));
      if (this.showSeq) {
        for (let i = 1; i <= 9; i++) {
          const v = Math.pow(2, -i);
          svg.append(s("circle", { cx: this.toX(v), cy: y0 + 46, r: 3.2, fill: "var(--c-alive2)" }));
        }
        svg.append(s("text", { x: this.toX(0.5), y: y0 + 70, "text-anchor": "middle", fill: "var(--c-alive2)", "font-size": 12 }, "数列 1/2, 1/4, 1/8, … 全在 U 里，极限 0 是 U 的极限点"));
      }
      // 开球（区间）
      const X = this.toX(x), E = 400 * eps;
      const onB = x === 0 || x === 1;
      const inside = x > 0 && x < 1;
      const ballIn = inside && x - eps > 0 && x + eps < 1;
      const ballOut = !inside && !onB && (x + eps < 0 || x - eps > 1);
      const col = ballIn ? "var(--ok)" : ballOut ? "var(--muted)" : "var(--warn)";
      svg.append(s("rect", { x: X - E, y: y0 - 50, width: 2 * E, height: 18, rx: 9, fill: col, "fill-opacity": 0.18, stroke: col, "stroke-dasharray": "4 3" }));
      svg.append(s("text", { x: X, y: y0 - 56, "text-anchor": "middle", fill: col, "font-size": 12 }, "(x − ε, x + ε)"));
      const inU = inside || (x === 0 && lc) || (x === 1 && rc);
      svg.append(s("circle", { cx: X, cy: y0 - 41, r: 5.5, fill: inU ? "var(--bad)" : "var(--surface)", stroke: "var(--bad)", "stroke-width": 2.2 }));
      svg.append(s("line", { x1: X, y1: y0 - 35, x2: X, y2: y0 - 4, stroke: "var(--bad)", "stroke-dasharray": "2 2" }));
      svg.append(s("text", { x: X + 9, y: y0 - 60 + 0, fill: "var(--bad)", "font-size": 14, "font-style": "italic" }, ""));
      const kind = onB ? "边界点" : inside ? "内点" : "外点";
      const openSet = !lc && !rc, closedSet = lc && rc;
      const verdict = openSet ? "<b>开集</b>：不含任何边界点。" : closedSet ? "<b>闭集</b>：包含全部边界点（补集 (−∞,0) ∪ (1,∞) 是开集）。" :
        `<b>既不开也不闭</b>：含一个边界点、缺另一个。补集 ${t === "[)" ? "(−∞, 0) ∪ [1, ∞)" : "(−∞, 0] ∪ (1, ∞)"} 也既不开也不闭。书里的 [0, 2π) 就是这种情况。`;
      this.info.innerHTML = `
        <p style="margin:0 0 6px">x = ${num(x, 3)} 是 U 的<b>${kind}</b>，${inU ? "属于" : "不属于"} U。</p>
        <p class="small" style="margin:0 0 6px">${onB ? "任意小的 (x−ε, x+ε) 都同时碰到 U 内外。" : inside ? `ε &lt; ${num(Math.min(x, 1 - x), 3)} 时区间整个在 U 里。` : `ε &lt; ${num(x < 0 ? -x : x - 1, 3)} 时区间整个在 U 外。`}</p>
        <p class="small" style="margin:0 0 6px">所有点：(0,1) 内都是内点；0 和 1 是边界点；cl(U) = [0, 1]。</p>
        <p class="small" style="margin:0">${verdict}</p>`;
    }
  }

  // =====================================================================
  // 2. 有限集合上的拓扑检查器
  // =====================================================================
  const TOPO_PRESETS = {
    ex44: { name: "例 4.4 奇怪的拓扑", X: ["cat", "dog", "tree", "house"], open: [[], ["cat", "dog", "tree", "house"], ["cat"], ["dog"]] },
    ex1: { name: "习题 1", X: ["1", "2", "3", "4", "5"], open: [[], ["1", "2", "3", "4", "5"], ["1", "3"], ["1", "2"], ["2", "3"], ["1"], ["2"], ["3"]] },
    trivial: { name: "平凡拓扑（例 4.3）", X: ["1", "2", "3"], open: [[], ["1", "2", "3"]] },
    discrete: { name: "离散拓扑（补充）", X: ["1", "2", "3"], open: "all" },
    sierp: { name: "Sierpiński 空间（补充）", X: ["0", "1"], open: [[], ["1"], ["0", "1"]] },
  };
  class FiniteTopology {
    constructor(root) {
      this.body = shell(root, "有限集合上的拓扑检查器", "点子集把它设为开集 / 取消；下方自动检查公理");
      this.pid = root.dataset.preset || "ex44";
      this.build();
      this.load(this.pid);
    }
    load(pid) {
      const P = TOPO_PRESETS[pid];
      this.X = P.X;
      this.n = P.X.length;
      this.full = (1 << this.n) - 1;
      this.open = new Set();
      if (P.open === "all") for (let m = 0; m <= this.full; m++) this.open.add(m);
      else P.open.forEach((arr) => this.open.add(arr.reduce((m, e) => m | (1 << P.X.indexOf(e)), 0)));
      this.U = 0;
      this.render();
    }
    name(m) {
      if (m === 0) return "∅";
      const els = this.X.filter((_, i) => m & (1 << i));
      return "{" + els.join(", ") + "}";
    }
    build() {
      const sel = h("select", { "aria-label": "预设" }, Object.entries(TOPO_PRESETS).map(([k, p]) => h("option", { value: k, selected: k === this.pid }, p.name)));
      sel.addEventListener("change", () => this.load(sel.value));
      this.ctr = h("div", { class: "controls" }, sel,
        button("补全为它生成的拓扑", () => this.complete()),
        button("清空（只留 ∅ 和 X）", () => { this.open = new Set([0, this.full]); this.render(); }));
      this.chips = h("div", { class: "chips", style: "margin:8px 0" });
      this.result = h("div", { class: "panel-body" });
      this.probeChips = h("div", { class: "chips" });
      this.probe = h("div", { class: "panel-body" });
      this.body.append(this.ctr,
        h("div", { class: "small muted" }, "所有子集（蓝色 = 当前被声明为开集）："), this.chips,
        h("div", { class: "split" },
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "公理检查与闭集"), this.result),
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "选一个子集 U，看 int(U)、cl(U)、∂U"),
            h("div", { class: "panel-body" }, this.probeChips), this.probe)));
    }
    complete() {
      let changed = true;
      while (changed) {
        changed = false;
        const arr = [...this.open];
        for (const a of arr) for (const b of arr) {
          for (const c of [a | b, a & b]) if (!this.open.has(c)) { this.open.add(c); changed = true; }
        }
      }
      this.open.add(0); this.open.add(this.full);
      this.render();
    }
    render() {
      const all = [];
      for (let m = 0; m <= this.full; m++) all.push(m);
      const pc = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
      all.sort((a, b) => pc(a) - pc(b) || a - b);
      this.chips.innerHTML = "";
      all.forEach((m) => {
        const b = h("button", { type: "button", class: "chip" + (this.open.has(m) ? " on" : "") }, this.name(m));
        b.addEventListener("click", () => { if (this.open.has(m)) this.open.delete(m); else this.open.add(m); this.render(); });
        this.chips.append(b);
      });
      // 公理
      const vio = [];
      if (!this.open.has(0)) vio.push("∅ 不是开集（公理 3）");
      if (!this.open.has(this.full)) vio.push("X 不是开集（公理 3）");
      const arr = [...this.open].sort((a, b) => a - b);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        if (!this.open.has(a | b)) vio.push(`${this.name(a)} ∪ ${this.name(b)} = ${this.name(a | b)} 不是开集（公理 1）`);
        if (!this.open.has(a & b)) vio.push(`${this.name(a)} ∩ ${this.name(b)} = ${this.name(a & b)} 不是开集（公理 2）`);
      }
      const ok = vio.length === 0;
      let html = ok ? `<div class="msg ok">✓ 这是一个拓扑空间（共 ${arr.length} 个开集）</div>` :
        `<div class="msg bad">✗ 不是拓扑空间：</div><ul class="small" style="margin:4px 0 8px">${vio.slice(0, 5).map((v) => `<li>${v}</li>`).join("")}${vio.length > 5 ? `<li class="muted">……还有 ${vio.length - 5} 处</li>` : ""}</ul>`;
      if (ok) {
        const closed = all.filter((m) => this.open.has(this.full & ~m));
        const clopen = all.filter((m) => this.open.has(m) && closed.includes(m));
        const neither = all.filter((m) => !this.open.has(m) && !closed.includes(m));
        html += `<p class="small" style="margin:4px 0"><b>闭集</b>（补集是开集）：${closed.map((m) => this.name(m)).join("、")}</p>`;
        html += `<p class="small" style="margin:4px 0"><b>既开又闭</b>：${clopen.map((m) => this.name(m)).join("、")}</p>`;
        html += `<p class="small" style="margin:4px 0"><b>既不开也不闭</b>：${neither.length} 个${neither.length ? "，例如 " + neither.slice(0, 4).map((m) => this.name(m)).join("、") : ""}</p>`;
        // Hausdorff
        let haus = null;
        for (let i = 0; i < this.n && !haus; i++) for (let j = i + 1; j < this.n && !haus; j++) {
          const sep = arr.some((a) => (a >> i) & 1 && arr.some((b) => (b >> j) & 1 && (a & b) === 0));
          if (!sep) haus = [this.X[i], this.X[j]];
        }
        html += `<p class="small" style="margin:4px 0"><b>Hausdorff？</b>${haus ? `否：${haus[0]} 和 ${haus[1]} 无法用不相交的开集分开。` : "是：任意两点都能用不相交的开集分开。"}</p>`;
      }
      this.result.innerHTML = html;
      // 探针
      this.probeChips.innerHTML = "";
      this.X.forEach((e, i) => {
        const b = h("button", { type: "button", class: "chip" + (this.U & (1 << i) ? " on" : "") }, e);
        b.addEventListener("click", () => { this.U ^= 1 << i; this.render(); });
        this.probeChips.append(b);
      });
      if (!ok) { this.probe.innerHTML = `<p class="small muted" style="margin:0">先让它成为拓扑空间（可以点「补全」）。</p>`; return; }
      const U = this.U;
      let interior = 0;
      arr.forEach((a) => { if ((a & ~U) === 0) interior |= a; });
      let closure = this.full;
      all.forEach((m) => { if (this.open.has(this.full & ~m) && (U & ~m) === 0) closure &= m; });
      const boundary = closure & ~interior;
      const isOpen = this.open.has(U), isClosed = this.open.has(this.full & ~U);
      this.probe.innerHTML = `
        <p class="small" style="margin:0 0 4px">U = <b>${this.name(U)}</b>：${isOpen && isClosed ? "既开又闭" : isOpen ? "开集" : isClosed ? "闭集" : "既不开也不闭"}</p>
        <p class="small" style="margin:0 0 4px">int(U) = ${this.name(interior)}　<span class="muted">（含于 U 的开集之并）</span></p>
        <p class="small" style="margin:0 0 4px">cl(U) = ${this.name(closure)}　<span class="muted">（包含 U 的闭集之交）</span></p>
        <p class="small" style="margin:0">∂U = cl(U) \\ int(U) = ${this.name(boundary)}</p>`;
    }
  }

  // =====================================================================
  // 3. 区间同胚（例 4.5）
  // =====================================================================
  const MAPS = {
    lin: { name: "x ↦ 5x", dom: [0, 1], cod: [0, 5], f: (x) => 5 * x, finv: (y) => y / 5, domOpen: [true, true], codOpen: [true, true], domL: "(0, 1)", codL: "(0, 5)" },
    inv: { name: "x ↦ 1/x", dom: [0, 1], cod: [0, 12], f: (x) => 1 / x, finv: (y) => 1 / y, domOpen: [true, true], codOpen: [true, false], domL: "(0, 1)", codL: "(1, ∞)", codInf: true, codMin: 1 },
    atan: { name: "x ↦ 2·tan⁻¹(x)/π", dom: [-12, 12], cod: [-1, 1], f: (x) => (2 * Math.atan(x)) / Math.PI, finv: (y) => Math.tan((Math.PI * y) / 2), domOpen: [false, false], codOpen: [true, true], domL: "ℝ", codL: "(−1, 1)", domInf: true },
  };
  class Homeo {
    constructor(root) {
      this.body = shell(root, "区间之间的同胚", "例 4.5：拖动上方的点 x，看 f(x) 落在哪里");
      this.mid = "atan";
      this.x = 2;
      const ctr = h("div", { class: "controls" }, segmented(Object.entries(MAPS).map(([k, m]) => [k, m.name]), this.mid, (k) => { this.mid = k; this.x = k === "atan" ? 2 : 0.3; this.render(); }));
      this.svg = s("svg", { viewBox: "0 0 600 230", style: "width:100%;max-width:680px;display:block;margin:0 auto;touch-action:none;user-select:none" });
      this.info = h("p", { class: "small", style: "margin:8px 0 0" });
      this.body.append(ctr, h("div", { class: "svg-wrap" }, this.svg), this.info);
      let drag = false;
      const mv = (e) => {
        const M = MAPS[this.mid], p = svgPoint(this.svg, e);
        let x = M.dom[0] + ((p.x - 50) / 500) * (M.dom[1] - M.dom[0]);
        const eps = (M.dom[1] - M.dom[0]) * 0.004;
        x = Math.max(M.dom[0] + eps, Math.min(M.dom[1] - eps, x));
        this.x = x; this.render();
      };
      this.svg.addEventListener("pointerdown", (e) => { drag = true; try { this.svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } mv(e); });
      this.svg.addEventListener("pointermove", (e) => { if (drag) mv(e); });
      this.svg.addEventListener("pointerup", () => { drag = false; });
      this.render();
    }
    render() {
      const M = MAPS[this.mid], svg = this.svg;
      svg.innerHTML = "";
      const yT = 50, yB = 180;
      const X1 = (x) => 50 + ((x - M.dom[0]) / (M.dom[1] - M.dom[0])) * 500;
      const X2 = (y) => 50 + ((y - M.cod[0]) / (M.cod[1] - M.cod[0])) * 500;
      // 连线
      const N = 40;
      for (let i = 1; i < N; i++) {
        const x = M.dom[0] + ((M.dom[1] - M.dom[0]) * i) / N;
        const y = M.f(x);
        const cx = Math.max(M.cod[0], Math.min(M.cod[1], y));
        const clipped = y > M.cod[1];
        svg.append(s("line", { x1: X1(x), y1: yT, x2: X2(cx), y2: yB, stroke: "var(--accent)", "stroke-opacity": clipped ? 0.15 : 0.35, "stroke-width": 1 }));
      }
      const axis = (y, lo, hi, X, label, opens, infL, infR, ticks) => {
        svg.append(s("line", { x1: 40, y1: y, x2: 560, y2: y, stroke: "var(--border-strong)", "stroke-width": 1.2 }));
        svg.append(s("line", { x1: X(lo), y1: y, x2: X(hi), y2: y, stroke: "var(--accent)", "stroke-width": 6, opacity: 0.8 }));
        ticks.forEach((t) => {
          svg.append(s("line", { x1: X(t), y1: y - 4, x2: X(t), y2: y + 4, stroke: "var(--muted)" }));
          svg.append(s("text", { x: X(t), y: y + (y < 100 ? -12 : 22), "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, num(t, 2)));
        });
        if (opens[0]) svg.append(s("circle", { cx: X(lo), cy: y, r: 6, fill: "var(--surface)", stroke: "var(--accent)", "stroke-width": 2 }));
        if (opens[1] && !infR) svg.append(s("circle", { cx: X(hi), cy: y, r: 6, fill: "var(--surface)", stroke: "var(--accent)", "stroke-width": 2 }));
        if (infL) svg.append(s("text", { x: 30, y: y + 5, "font-size": 14, fill: "var(--accent-text)", "text-anchor": "middle" }, "←∞"));
        if (infR) svg.append(s("text", { x: 576, y: y + 5, "font-size": 14, fill: "var(--accent-text)", "text-anchor": "middle" }, "∞→"));
        svg.append(s("text", { x: 590, y: y + (y < 100 ? -16 : 30), "text-anchor": "end", "font-size": 14, fill: "var(--accent-text)" }, label));
      };
      const domTicks = M.domInf ? [-10, -5, 0, 5, 10] : [0, 0.5, 1];
      const codTicks = M.codInf ? [1, 2, 4, 6, 8, 10] : M.cod[0] < 0 ? [-1, 0, 1] : [0, 1, 2, 3, 4, 5];
      axis(yT, M.dom[0], M.dom[1], X1, "定义域 " + M.domL, M.domOpen, M.domInf, M.domInf, domTicks);
      const cLo = M.codMin !== undefined ? M.codMin : M.cod[0];
      axis(yB, cLo, M.cod[1], X2, "值域 " + M.codL, M.codOpen, false, !!M.codInf, codTicks);
      if (M.codMin !== undefined) svg.append(s("circle", { cx: X2(M.codMin), cy: yB, r: 6, fill: "var(--surface)", stroke: "var(--accent)", "stroke-width": 2 }));
      const y = M.f(this.x), yy = Math.min(M.cod[1], y);
      svg.append(s("line", { x1: X1(this.x), y1: yT, x2: X2(yy), y2: yB, stroke: "var(--bad)", "stroke-width": 2.4 }));
      svg.append(s("circle", { cx: X1(this.x), cy: yT, r: 7, fill: "var(--bad)", style: "cursor:grab" }));
      svg.append(s("circle", { cx: X2(yy), cy: yB, r: 7, fill: y > M.cod[1] ? "var(--surface)" : "var(--bad)", stroke: "var(--bad)", "stroke-width": 2 }));
      this.info.innerHTML = `x = <b>${num(this.x, 3)}</b> → f(x) = <b>${num(y, 3)}</b>${y > M.cod[1] ? "（已超出画面，继续向右）" : ""}。f 是双射，f 和 f<sup>−1</sup> 都连续，所以 ${M.domL} ≅ ${M.codL}。` +
        (this.mid === "atan" ? " 无界的 ℝ 和有界的 (−1, 1) 竟然同胚：同胚只关心「连成什么样」，不关心长度和有界性。" :
          this.mid === "inv" ? " 越靠近 0 的点被甩得越远：有界区间 (0, 1) 和无界区间 (1, ∞) 同胚。" : " 线性伸缩是最简单的同胚。");
    }
  }

  // =====================================================================
  // 4. 流形检测器（图 4.4、例 4.6）
  // =====================================================================
  function circlePts(cx, cy, r, n, a0) { const out = []; for (let i = 0; i <= n; i++) { const t = (a0 || 0) + (i / n) * 2 * Math.PI; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return out; }
  const SHAPES = {
    circle: { name: "圆 S¹", lines: [circlePts(0, 0, 0.75, 72)], nodes: [] },
    eight: { name: "8 字形", lines: [circlePts(-0.55, 0, 0.55, 72, 0), circlePts(0.55, 0, 0.55, 72, Math.PI)], nodes: [{ p: [0, 0], deg: 4 }] },
    open: { name: "开线段 (0,1)", lines: [[[-1, 0], [1, 0]]], nodes: [{ p: [-1, 0], deg: 1, open: true }, { p: [1, 0], deg: 1, open: true }] },
    closed: { name: "闭线段 [0,1]", lines: [[[-1, 0], [1, 0]]], nodes: [{ p: [-1, 0], deg: 1 }, { p: [1, 0], deg: 1 }] },
    T: { name: "字母 T", lines: [[[-0.9, 0.6], [0, 0.6], [0.9, 0.6]], [[0, 0.6], [0, -0.8]]], nodes: [{ p: [0, 0.6], deg: 3 }, { p: [-0.9, 0.6], deg: 1 }, { p: [0.9, 0.6], deg: 1 }, { p: [0, -0.8], deg: 1 }] },
    theta: { name: "θ 形", lines: [circlePts(0, 0, 0.75, 72), [[-0.75, 0], [0.75, 0]]], nodes: [{ p: [-0.75, 0], deg: 3 }, { p: [0.75, 0], deg: 3 }] },
    poly: { name: "带「无用顶点」的圈（图 4.2）", lines: [[[-0.9, -0.6], [0.2, -0.75], [0.9, -0.1], [0.4, 0.7], [-0.6, 0.55], [-0.9, -0.6]]], nodes: [{ p: [-0.9, -0.6], deg: 2 }, { p: [0.2, -0.75], deg: 2 }, { p: [0.9, -0.1], deg: 2 }, { p: [0.4, 0.7], deg: 2 }, { p: [-0.6, 0.55], deg: 2 }] },
  };
  class ManifoldTest {
    constructor(root) {
      this.body = shell(root, "流形检测器", "把鼠标移到图形上：一个点的小邻域长得像 ℝ 吗？");
      this.sid = "eight";
      this.eps = 22;
      this.showDeg = true;
      this.pt = null;
      const ctr = h("div", { class: "controls" },
        segmented(Object.entries(SHAPES).map(([k, v]) => [k, v.name]), this.sid, (k) => { this.sid = k; this.pt = null; this.render(); }));
      const ctr2 = h("div", { class: "controls" },
        slider("邻域半径 ε =", 4, 60, 1, this.eps, (v) => { this.eps = v; this.render(); }, (v) => v + " px"),
        checkbox("显示顶点度数", this.showDeg, (v) => { this.showDeg = v; this.render(); }));
      this.svg = s("svg", { viewBox: "0 0 520 300", style: "width:100%;max-width:600px;display:block;margin:0 auto;touch-action:none;user-select:none;cursor:crosshair" });
      this.info = h("div", { class: "panel-body", style: "min-height:96px" });
      this.body.append(ctr, ctr2, h("div", { class: "split" }, h("div", { class: "svg-wrap" }, this.svg), h("div", { class: "panel" }, h("div", { class: "panel-title" }, "判定"), this.info)));
      const mv = (e) => { const p = svgPoint(this.svg, e); this.snap([p.x, p.y]); this.render(); };
      this.svg.addEventListener("pointermove", mv);
      this.svg.addEventListener("pointerdown", mv);
      this.render();
    }
    T(p) { return [260 + 150 * p[0], 150 - 150 * p[1]]; }
    snap(q) {
      const S = SHAPES[this.sid];
      let best = { d: Infinity };
      S.lines.forEach((L) => {
        for (let i = 0; i + 1 < L.length; i++) {
          const a = this.T(L[i]), b = this.T(L[i + 1]);
          const r = G.closestOnSeg(q, a, b), d = G.len(G.sub(q, r.p));
          if (d < best.d) best = { d, p: r.p };
        }
      });
      if (best.d > 40) { this.pt = null; return; }
      let node = null;
      S.nodes.forEach((n) => { const P = this.T(n.p); if (G.len(G.sub(P, best.p)) < 8) node = n; });
      this.pt = { p: node ? this.T(node.p) : best.p, node };
    }
    render() {
      const S = SHAPES[this.sid], svg = this.svg;
      svg.innerHTML = "";
      S.lines.forEach((L) => svg.append(s("polyline", { points: L.map((p) => this.T(p).join(",")).join(" "), fill: "none", stroke: "var(--text-2)", "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" })));
      S.nodes.forEach((n) => {
        const P = this.T(n.p);
        const bad = n.deg >= 3;
        svg.append(s("circle", { cx: P[0], cy: P[1], r: n.open ? 6 : 4.5, fill: n.open ? "var(--surface)" : bad ? "var(--bad)" : n.deg === 1 ? "var(--warn)" : "var(--text-2)", stroke: n.open ? "var(--text-2)" : "none", "stroke-width": 2 }));
        if (this.showDeg && !n.open) svg.append(s("text", { x: P[0] + 8, y: P[1] - 8, "font-size": 12, fill: bad ? "var(--bad)" : "var(--muted)" }, "度 " + n.deg));
      });
      let html = "";
      if (this.pt) {
        const c = this.pt.p, eps = this.eps;
        let hits = [];
        S.lines.forEach((L) => { for (let i = 0; i + 1 < L.length; i++) { const a = this.T(L[i]), b = this.T(L[i + 1]); G.segCircleHits(a, b, c, eps).forEach((t) => hits.push(G.add(a, [(b[0] - a[0]) * t, (b[1] - a[1]) * t]))); } });
        // 去重（折线顶点处可能重复）
        hits = hits.filter((p, i) => hits.findIndex((q) => G.len(G.sub(p, q)) < 0.5) === i);
        const node = this.pt.node;
        const k0 = node ? (node.open ? -1 : node.deg) : 2;
        const col = k0 === 2 ? "var(--ok)" : k0 === 1 ? "var(--warn)" : k0 < 0 ? "var(--muted)" : "var(--bad)";
        svg.append(s("circle", { cx: c[0], cy: c[1], r: eps, fill: col, "fill-opacity": 0.1, stroke: col, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
        hits.forEach((p) => svg.append(s("circle", { cx: p[0], cy: p[1], r: 3.5, fill: col })));
        svg.append(s("circle", { cx: c[0], cy: c[1], r: 5, fill: "var(--accent)" }));
        const verdict = k0 < 0 ? "这个端点<b>不属于</b>集合（开线段）。它附近集合里的点，邻域都像 ℝ。" :
          k0 === 2 ? "邻域是一条穿过去的弧，<b>同胚于 ℝ</b> → 这里像一维流形。" :
            k0 === 1 ? "邻域只有一侧，同胚于半直线 [0, 1) → <b>边界点</b>（带边流形允许，流形不允许）。" :
              `有 ${k0} 条分支在这里汇合，去掉这个点邻域会断成 ${k0} 段，而 ℝ 去掉一点只断成 2 段 → <b>不同胚于 ℝ</b>。`;
        html = `<p style="margin:0 0 6px">ε 圆与集合交了 <b>${hits.length}</b> 次${hits.length !== Math.max(k0, 0) && k0 >= 0 ? `（ε 再小一点会稳定在 ${k0}）` : ""}。</p><p class="small" style="margin:0 0 8px">${verdict}</p>`;
      } else html = `<p class="small muted" style="margin:0 0 8px">把鼠标移到图形上。</p>`;
      const maxDeg = Math.max(2, ...S.nodes.filter((n) => !n.open).map((n) => n.deg));
      const hasBd = S.nodes.some((n) => !n.open && n.deg === 1);
      html += `<p class="small" style="margin:0"><b>整体：</b>${maxDeg >= 3 ? "不是流形（存在度 ≥ 3 的点）。" : hasBd ? "带边的一维流形（有度为 1 的端点）。" : "一维流形。"}${this.sid === "poly" ? " 这些度为 2 的顶点都是「无用顶点」：删掉它们，图就变成只有一个顶点和一条自环的图，同胚于圆。" : ""}</p>`;
      this.info.innerHTML = html;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reg = { "point-class": PointClass, "finite-topology": FiniteTopology, homeo: Homeo, "manifold-test": ManifoldTest };
    for (const [k, C] of Object.entries(reg)) document.querySelectorAll(`[data-widget='${k}']`).forEach((el) => { try { el._w = new C(el); } catch (e) { console.error(k, e); } });
  });
})();
