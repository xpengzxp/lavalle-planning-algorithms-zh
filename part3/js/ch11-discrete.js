/* 11.1–11.2 节：离散传感器与原像、三状态例子（历史 / 不确定 I-state）、I-map 的充分性、概率 I-state 在单纯形上 */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH11;
  const sgn = (x) => (x > 0) - (x < 0);
  const mod = (a, k) => ((a % k) + k) % k;

  // ---------------------------------------------------------------
  // 组件 1：传感器与原像（11.1.1 节，例 11.1–11.9）
  // ---------------------------------------------------------------
  const SENSORS = {
    oddeven: { name: "奇偶 (11.2)", Y: () => [0, 1], h: (x) => mod(x, 2), Psi: [0] },
    mod: { name: "模 k (11.3)", Y: (k) => Array.from({ length: k }, (_, i) => i), h: (x, p, k) => mod(x, k), Psi: [0] },
    sign: { name: "符号 (11.4)", Y: () => [-1, 0, 1], h: (x) => sgn(x), Psi: [0] },
    sel: { name: "选择性 (11.5)", sel: true },
    id: { name: "恒等 (例 11.5)", Y: () => range(-7, 7), h: (x) => x, Psi: [0] },
    nul: { name: "零传感器 (例 11.6)", Y: () => [0], h: () => 0, Psi: [0] },
    dist: { name: "扰动 x+ψ (11.8)", Y: () => range(-8, 8), h: (x, p) => x + p, Psi: [-1, 0, 1] },
    dsign: { name: "扰动符号 (11.9)", Y: () => [-1, 0, 1], h: (x, p) => sgn(x + p), Psi: [-1, 0, 1] },
    doe: { name: "扰动奇偶 (11.10)", Y: () => [0, 1], h: (x, p) => mod(x + p, 2), Psi: [0, 1] },
  };
  function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
  const XW = range(-7, 7);

  class SensorLab {
    constructor(root) {
      this.key = "sign"; this.k = 3; this.q = 0.6; this.prob = false; this.selX = null; this.selY = null;
      const body = C.frame(root, "传感器与原像", "点一个状态 x 看它可能读出哪些 y；点一个观测 y 看它的原像 H(y)");
      this.svg = s("svg", { viewBox: "0 0 700 250", width: "100%", style: "max-width:700px" });
      this.segS = C.seg(Object.entries(SENSORS).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.selX = this.selY = null; this.update(); });
      this.sK = C.slider("k =", 2, 5, 1, this.k, (v) => { this.k = v; this.selY = null; this.update(); });
      this.chkP = C.checkbox("概率模型（线宽 ∝ P(y|x)）", false, (v) => { this.prob = v; this.update(); });
      this.sQ = C.slider("P(ψ = 0) =", 0.34, 1, 0.02, this.q, (v) => { this.q = v; this.update(); }, (v) => v.toFixed(2));
      this.info = h("div", { class: "status-line" });
      this.tbl = h("div", { class: "small mono", style: "min-height:1.4em" });
      body.append(h("div", { class: "controls" }, this.segS), h("div", { class: "controls" }, this.sK, this.chkP, this.sQ),
        h("div", { class: "svg-wrap" }, this.svg), this.info, this.tbl,
        C.legend([[C.cva("ndet", 0.35), "被点中的原像 H(y)"], [C.cv("nature"), "x 可能读出的观测"], [C.cv("muted"), "h 的对应关系（每条线是一个 ψ）"]]));
      this.update();
    }
    sensor() { return SENSORS[this.key]; }
    // P(ψ | x)：ψ = 0 取 q，其余平分
    pPsi(p, Psi) { if (Psi.length === 1) return 1; return p === 0 ? this.q : (1 - this.q) / (Psi.length - 1); }
    update() {
      const S = this.sensor();
      this.sK.style.display = this.key === "mod" ? "" : "none";
      const hasNature = !S.sel && S.Psi.length > 1;
      this.sQ.style.display = hasNature && this.prob ? "" : "none";
      this.chkP.style.display = hasNature ? "" : "none";
      if (S.sel) return this.drawSel();
      const Y = S.Y(this.k), Psi = S.Psi;
      const svg = this.svg; svg.innerHTML = "";
      const W = 700, xr = 196, yr = 46;
      const xPos = (x) => 44 + ((x - XW[0]) * (W - 88)) / (XW.length - 1);
      const yPos = (y) => (Y.length === 1 ? W / 2 : 40 + (Y.indexOf(y) * (W - 80)) / (Y.length - 1));
      const H = new Map(Y.map((y) => [y, new Set()]));
      const edges = [];
      for (const x of XW) for (const p of Psi) {
        const y = S.h(x, p, this.k);
        if (!H.has(y)) continue;
        H.get(y).add(x);
        const w = this.pPsi(p, Psi);
        const e = edges.find((t) => t.x === x && t.y === y);
        if (e) e.w += w; else edges.push({ x, y, w });
      }
      const partition = Psi.length === 1;
      const selH = this.selY !== null ? H.get(this.selY) : null;
      // 边
      for (const e of edges) {
        const hot = this.selX === e.x || (this.selY === e.y);
        const lw = this.prob && hasNature ? 0.6 + 5 * e.w : (hot ? 2 : 1);
        svg.append(s("line", { x1: xPos(e.x), y1: xr - 13, x2: yPos(e.y), y2: yr + 13, stroke: this.selX === e.x ? "var(--warn)" : hot ? "var(--accent)" : "var(--border-strong)", "stroke-width": lw, opacity: this.selX !== null && this.selX !== e.x ? 0.35 : 1 }));
      }
      // y 盒子
      svg.append(s("text", { x: 8, y: yr - 24, "font-size": 12, fill: "var(--muted)" }, "观测空间 Y"));
      for (const y of Y) {
        const on = this.selY === y, reach = this.selX !== null && edges.some((e) => e.x === this.selX && e.y === y);
        const g = s("g", { style: "cursor:pointer", onclick: () => { this.selY = this.selY === y ? null : y; this.selX = null; this.update(); } });
        g.append(s("rect", { x: yPos(y) - 15, y: yr - 13, width: 30, height: 26, rx: 5, fill: on ? "var(--accent-soft)" : reach ? "var(--warn-soft)" : "var(--surface)", stroke: reach ? "var(--warn)" : on ? "var(--accent)" : "var(--border-strong)", "stroke-width": on || reach ? 2 : 1 }));
        g.append(s("text", { x: yPos(y), y: yr + 4.5, "text-anchor": "middle", "font-size": 13, fill: "var(--text)" }, String(y).replace("-", "−")));
        svg.append(g);
      }
      // x 圆
      svg.append(s("text", { x: 8, y: xr + 34, "font-size": 12, fill: "var(--muted)" }, "状态空间 X = ℤ（只画 −7…7）"));
      for (const x of XW) {
        const inH = selH && selH.has(x), on = this.selX === x;
        let fill = "var(--surface)";
        if (partition && !selH) { const yi = Y.indexOf(S.h(x, 0, this.k)); fill = `color-mix(in srgb, ${C.catVar(yi)} 28%, var(--surface))`; }
        if (inH) fill = "color-mix(in srgb, var(--accent) 40%, var(--surface))";
        const g = s("g", { style: "cursor:pointer", onclick: () => { this.selX = this.selX === x ? null : x; this.selY = null; this.update(); } });
        g.append(s("circle", { cx: xPos(x), cy: xr, r: 13, fill, stroke: on ? "var(--text)" : inH ? "var(--accent)" : "var(--border-strong)", "stroke-width": on || inH ? 2 : 1 }));
        g.append(s("text", { x: xPos(x), y: xr + 4.5, "text-anchor": "middle", "font-size": 12, fill: "var(--text)" }, String(x).replace("-", "−")));
        svg.append(g);
      }
      svg.append(s("text", { x: 6, y: xr + 4, "font-size": 15, fill: "var(--muted)" }, "…"), s("text", { x: W - 22, y: xr + 4, "font-size": 15, fill: "var(--muted)" }, "…"));
      // 文字
      const fmtSet = (set) => {
        const a = [...set].sort((p, q) => p - q);
        if (!a.length) return "∅";
        const leftOpen = a[0] === XW[0] && this.key !== "id", rightOpen = a[a.length - 1] === XW[XW.length - 1] && this.key !== "id";
        const step = a.length > 1 ? a[1] - a[0] : 1;
        let str = a.length > 6 ? `${a[0]}, ${a[1]}, ${a[2]}, …, ${a[a.length - 1]}` : a.join(", ");
        if (leftOpen) str = "…, " + str;
        if (rightOpen) str = str + ", …";
        return ("{" + str + "}").replace(/-/g, "−") + (step > 1 && a.length > 3 ? "" : "");
      };
      const counts = XW.map((x) => Y.filter((y) => H.get(y).has(x)).length);
      const msg = partition
        ? `原像 H(y) 两两不交、并起来是 X——<b>构成 X 的一个划分</b>（式 11.6），一共 ${Y.length} 块；颜色表示 x 落在哪一块。`
        : `有自然传感动作 ψ ∈ Ψ = {${Psi.join(", ").replace(/-/g, "−")}}：原像 (11.11) 会<b>互相重叠</b>，不再是划分（每个 x 属于 ${Math.min(...counts)}–${Math.max(...counts)} 个原像）。`;
      this.info.innerHTML = msg;
      if (this.selY !== null) this.tbl.innerHTML = `H(${String(this.selY).replace("-", "−")}) = ${fmtSet(H.get(this.selY))}` + (H.get(this.selY).size === XW.length ? "　← 整个 X：这个观测没有任何信息" : "");
      else if (this.selX !== null) {
        const ys = Y.filter((y) => edges.some((e) => e.x === this.selX && e.y === y));
        let str = `x = ${String(this.selX).replace("-", "−")} 可能读出 y ∈ {${ys.join(", ").replace(/-/g, "−")}}`;
        if (this.prob && hasNature) str += "；P(y|x)：" + ys.map((y) => `${String(y).replace("-", "−")} → ${C.fmt(edges.find((e) => e.x === this.selX && e.y === y).w, 3, 100)}`).join("，");
        this.tbl.innerHTML = str;
      } else this.tbl.innerHTML = "<span class='muted'>点一个 x 或一个 y。</span>";
      if (this.key === "doe" && this.prob) {
        const q = this.q;
        this.tbl.innerHTML += `<br>P(y = 0 | x 偶) = ${C.fmtD(q, 2)}，P(y = 0 | x 奇) = ${C.fmtD(1 - q, 2)}` + (Math.abs(q - 0.5) < 1e-9 ? "——相等，观测与 x 无关" : "——不相等，观测带有关于奇偶的信息");
      }
    }
    // 选择性传感器：X = ℤ×ℤ，y = h(i, j) = i
    drawSel() {
      const svg = this.svg; svg.innerHTML = "";
      const R = range(-3, 3), x0 = 230, dx = 40, top = 96;
      const X = (i) => x0 + (i + 3) * dx, Yc = (j) => top + (3 - j) * 21;
      for (const i of R) {
        const on = this.selY === i;
        const g = s("g", { style: "cursor:pointer", onclick: () => { this.selY = on ? null : i; this.update(); } });
        g.append(s("rect", { x: X(i) - 15, y: 22, width: 30, height: 26, rx: 5, fill: on ? "var(--accent-soft)" : "var(--surface)", stroke: on ? "var(--accent)" : "var(--border-strong)", "stroke-width": on ? 2 : 1 }));
        g.append(s("text", { x: X(i), y: 39.5, "text-anchor": "middle", "font-size": 13, fill: "var(--text)" }, String(i).replace("-", "−")));
        svg.append(g);
        svg.append(s("line", { x1: X(i), y1: 49, x2: X(i), y2: top - 26, stroke: "var(--border-strong)" }));
        if (on) svg.append(s("rect", { x: X(i) - 13, y: top - 76 + 50, width: 26, height: 21 * 7 + 6, rx: 8, fill: "color-mix(in srgb, var(--accent) 22%, transparent)", stroke: "var(--accent)" }));
        for (const j of R) svg.append(s("circle", { cx: X(i), cy: Yc(j), r: 6.5, fill: on ? "var(--accent)" : `color-mix(in srgb, ${C.catVar(i + 3)} 35%, var(--surface))`, stroke: "var(--border-strong)" }));
      }
      svg.append(s("text", { x: 10, y: 39, "font-size": 12, fill: "var(--muted)" }, "Y = ℤ（第一个分量 i）"));
      svg.append(s("text", { x: 10, y: Yc(0) + 4, "font-size": 12, fill: "var(--muted)" }, "X = ℤ × ℤ（只画 [−3, 3]²）"));
      svg.append(s("text", { x: X(3) + 30, y: Yc(0) + 4, "font-size": 12, fill: "var(--muted)" }, "j ↑"));
      this.info.innerHTML = "选择性传感器只报告状态 (i, j) 的第一个分量：原像是<b>整列</b> {i} × ℤ——它们构成划分，但每一块都是无穷集。";
      this.tbl.innerHTML = this.selY === null ? "<span class='muted'>点上面的一个 y。</span>"
        : `H(${String(this.selY).replace("-", "−")}) = {(${String(this.selY).replace("-", "−")}, j) | j ∈ ℤ}　<span class="muted">（书中简写成「H(i) = ℤ」）</span>`;
    }
  }

  // ---------------------------------------------------------------
  // 例 11.13 的模型（组件 2、3、4 共用）
  // ---------------------------------------------------------------
  const X3 = [0, 1, 2], U3 = [-1, 0, 1], TH3 = [0, 1], PS3 = [0, 1, 2], Y3 = [0, 1, 2, 3, 4];
  const f3 = (x, u, th) => mod(x + u + th, 3);
  const F3 = (x, u) => new Set(TH3.map((th) => f3(x, u, th)));
  const H3 = (y) => new Set(X3.filter((x) => PS3.some((p) => x + p === y)));
  const union = (sets) => { const o = new Set(); sets.forEach((S) => S.forEach((v) => o.add(v))); return o; };
  const inter = (A, B) => new Set([...A].filter((v) => B.has(v)));
  const key = (S) => [...S].sort().join("");
  const showSet = (S) => C.setStr([...S].sort((a, b) => a - b));

  // ---------------------------------------------------------------
  // 组件 2：三状态例子——历史 I-state 与不确定 I-state（例 11.13）
  // ---------------------------------------------------------------
  class ThreeState {
    constructor(root) {
      this.X1 = new Set([0, 2]); this.x1 = 0; this.thMode = "rand"; this.psMode = "rand"; this.showTruth = true; this.r = C.rng(C.newSeed());
      const body = C.frame(root, "三状态例子：历史 I-state 与不确定 I-state", "例 11.13：f = (x + u + θ) mod 3，y = x + ψ");
      this.svg = s("svg", { viewBox: "0 0 430 300", width: "100%", style: "max-width:430px" });
      this.hasse = s("svg", { viewBox: "0 0 250 300", width: "100%", style: "max-width:250px" });
      this.chips = h("span", { class: "chips" });
      [0, 1, 2].forEach((x) => {
        const b = h("button", { type: "button", class: "chip" + (this.X1.has(x) ? " on" : "") }, String(x));
        b.addEventListener("click", () => { if (this.X1.has(x)) { if (this.X1.size > 1) this.X1.delete(x); } else this.X1.add(x); this.syncChips(); this.reset(); });
        this.chips.append(b);
      });
      this.selX1 = C.select([], "", (v) => { this.x1 = +v; this.reset(); });
      this.segTh = C.seg([["rand", "随机"], ["0", "0"], ["1", "1"]], "rand", (k) => { this.thMode = k; });
      this.segPs = C.seg([["rand", "随机"], ["0", "0"], ["1", "1"], ["2", "2"]], "rand", (k) => { this.psMode = k; });
      const ub = U3.map((u) => C.button(`施加 u = ${String(u).replace("-", "−")}`, () => this.act(u), "small primary"));
      this.hist = h("div", { class: "mono small", style: "line-height:1.7;word-break:break-all" });
      this.stats = { k: C.stat("阶段 k"), n: C.stat("|X_k(η_k)|"), hist: C.stat("|I_k|：长度为 k 的历史有多少种") };
      this.syncChips();
      body.append(
        h("div", { class: "controls" }, h("label", null, "初始条件 X₁ ="), this.chips, h("label", null, "真实 x₁（规划者不知道）", this.selX1),
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.draw(); })),
        h("div", { class: "controls" }, h("label", null, "自然的 θ"), this.segTh, h("label", null, "自然的 ψ"), this.segPs),
        h("div", { class: "controls" }, ...ub, h("span", { class: "sep" }), C.button("按书中例子回放", () => this.replay(), "small"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "split" }, h("div", { class: "svg-wrap" }, this.svg), h("div", null, h("div", { class: "svg-wrap" }, this.hasse), h("div", { class: "small muted", style: "text-align:center" }, "I_ndet = pow(X) 的 8 个元素 (11.32)；箭头是走过的路"))),
        h("div", { class: "stats" }, Object.values(this.stats)), this.hist,
        C.legend([[C.cva("ndet", 0.5), "X_k(η_k)：可能的当前状态", true], [C.cva("nature", 0.4), "观测的原像 H(y)", true], [C.cv("truth"), "真实状态（规划者看不到）", true]]));
      this.reset();
    }
    syncChips() {
      [...this.chips.children].forEach((b, i) => b.classList.toggle("on", this.X1.has(i)));
      const opts = [...this.X1].sort();
      if (!this.X1.has(this.x1)) this.x1 = opts[0];
      this.selX1.innerHTML = "";
      opts.forEach((x) => this.selX1.append(h("option", { value: x, selected: x === this.x1 ? true : null }, String(x))));
    }
    psi() { return this.psMode === "rand" ? C.randInt(this.r, 0, 2) : +this.psMode; }
    reset(psi1) {
      this.x = this.x1;
      const y1 = this.x + (psi1 === undefined ? this.psi() : psi1);
      this.us = []; this.ys = [y1];
      this.S = inter(this.X1, H3(y1));                        // (11.29)
      this.trail = [key(this.S)];
      this.last = { kind: "init", y: y1 };
      this.draw();
    }
    act(u, th, ps) {
      const pred = union([...this.S].map((x) => F3(x, u)));  // (11.30)
      const t = th !== undefined ? th : this.thMode === "rand" ? C.randInt(this.r, 0, 1) : +this.thMode;
      const xOld = this.x;
      this.x = f3(this.x, u, t);
      const y = this.x + (ps !== undefined ? ps : this.psi());
      const Sold = this.S;
      this.S = inter(pred, H3(y));                            // (11.31)
      this.us.push(u); this.ys.push(y);
      this.trail.push(key(this.S));
      this.last = { kind: "step", u, th: t, y, pred, Sold, xOld };
      this.draw();
    }
    replay() {
      this.X1 = new Set([0, 2]); this.x1 = 0; this.syncChips();
      this.reset(2);                       // x₁ = 0, ψ₁ = 2 → y₁ = 2
      this.act(1, 1, 1);                   // u₁ = 1, θ₁ = 1 → x₂ = 2；ψ₂ = 1 → y₂ = 3
    }
    draw() {
      const svg = this.svg; svg.innerHTML = "";
      const L = this.last, k = this.ys.length;
      const cx = (x) => 205 + (x - 1) * 70;
      const rows = L.kind === "init"
        ? [["X₁（初始条件）", this.X1, null], [`H(y₁)，y₁ = ${this.ys[0]}`, H3(this.ys[0]), "obs"], ["X₁(η₁) = X₁ ∩ H(y₁)  (11.29)", this.S, "res"]]
        : [[`X_${C.sub(k - 1)}(η_${C.sub(k - 1)})`, L.Sold, null], [`∪ F(x, u = ${String(L.u).replace("-", "−")})  (11.30)`, L.pred, "pred"], [`H(y_${C.sub(k)})，y_${C.sub(k)} = ${L.y}`, H3(L.y), "obs"], [`X_${C.sub(k)}(η_${C.sub(k)}) = 交集  (11.31)`, this.S, "res"]];
      const y0 = 38, dy = rows.length === 3 ? 92 : 72;
      rows.forEach(([label, S, kind], r) => {
        const yy = y0 + r * dy;
        svg.append(s("text", { x: 6, y: yy - 20, "font-size": 12, fill: "var(--muted)" }, label));
        for (const x of X3) {
          const on = S.has(x);
          const fill = !on ? "var(--surface)" : kind === "obs" ? "color-mix(in srgb, var(--warn) 35%, var(--surface))" : kind === "pred" ? "color-mix(in srgb, var(--accent) 22%, var(--surface))" : "color-mix(in srgb, var(--accent) 50%, var(--surface))";
          svg.append(s("circle", { cx: cx(x), cy: yy, r: 15, fill, stroke: on ? (kind === "obs" ? "var(--warn)" : "var(--accent)") : "var(--border-strong)", "stroke-width": on ? 2 : 1, "stroke-dasharray": kind === "pred" && on ? "4 3" : null }));
          svg.append(s("text", { x: cx(x), y: yy + 4.5, "text-anchor": "middle", "font-size": 13, fill: "var(--text)" }, String(x)));
        }
      });
      // F 的箭头
      if (L.kind === "step") {
        const ya = y0 + 15, yb = y0 + dy - 15;
        for (const x of L.Sold) for (const th of TH3) {
          const x2 = f3(x, L.u, th);
          svg.append(s("line", { x1: cx(x), y1: ya, x2: cx(x2) + (th ? 4 : -4), y2: yb, stroke: "var(--accent)", "stroke-width": 1.2, opacity: 0.7 }));
        }
        svg.append(s("text", { x: 340, y: y0 + dy / 2 + 4, "font-size": 11, fill: "var(--warn)" }, "θ ∈ {0, 1}"));
      }
      // 真实状态
      if (this.showTruth) {
        const last = y0 + (rows.length - 1) * dy;
        svg.append(s("circle", { cx: cx(this.x) + 11, cy: last - 11, r: 5, fill: "var(--text)", stroke: "var(--surface)", "stroke-width": 1.5 }));
        if (L.kind === "step") svg.append(s("circle", { cx: cx(L.xOld) + 11, cy: y0 - 11, r: 5, fill: "var(--text)", stroke: "var(--surface)", "stroke-width": 1.5 }));
        if (L.kind === "step") svg.append(s("text", { x: 300, y: 292, "font-size": 11, fill: "var(--muted)" }, `这一步自然选了 θ = ${L.th}，ψ = ${L.y - this.x}`));
      }
      this.drawHasse();
      this.stats.k.set(k);
      this.stats.n.set(this.S.size + (this.S.size === 1 ? "（知道了！）" : ""));
      this.stats.hist.set(`3<sup>${k - 1}</sup>·5<sup>${k}</sup> = ${(3 ** (k - 1) * 5 ** k).toLocaleString()}`);
      const eta = `η${C.sub(k)} = (η₀, ũ${C.sub(k - 1)}, ỹ${C.sub(k)}) = (X₁ = ${showSet(this.X1)}; u: ${this.us.length ? this.us.join(", ").replace(/-/g, "−") : "—"}; y: ${this.ys.join(", ")})`;
      this.hist.innerHTML = `${eta}<br><span class="muted">历史 I-state 随 k 线性变长；而不确定 I-state 始终只是 pow(X) 中 8 个集合之一。</span>`;
    }
    drawHasse() {
      const svg = this.hasse; svg.innerHTML = "";
      PA.arrowDefs(svg, { "h3a": "var(--accent)" });
      const pos = { "": [125, 270], "0": [45, 195], "1": [125, 195], "2": [205, 195], "01": [45, 110], "02": [125, 110], "12": [205, 110], "012": [125, 35] };
      const edges = [["", "0"], ["", "1"], ["", "2"], ["0", "01"], ["0", "02"], ["1", "01"], ["1", "12"], ["2", "02"], ["2", "12"], ["01", "012"], ["02", "012"], ["12", "012"]];
      for (const [a, b] of edges) svg.append(s("line", { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1], stroke: "var(--border)", "stroke-width": 1 }));
      const T = this.trail;
      for (let i = 1; i < T.length; i++) {
        const [x1, y1] = pos[T[i - 1]], [x2, y2] = pos[T[i]];
        if (T[i - 1] === T[i]) { svg.append(s("circle", { cx: x1 + 16, cy: y1 - 14, r: 8, fill: "none", stroke: "var(--accent)", "stroke-width": 1.4, opacity: 0.5 + 0.5 * (i / T.length) })); continue; }
        const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, off = (i % 2 ? 4 : -4);
        svg.append(s("line", { x1: x1 + ux * 18 - uy * off, y1: y1 + uy * 18 + ux * off, x2: x2 - ux * 20 - uy * off, y2: y2 - uy * 20 + ux * off, stroke: "var(--accent)", "stroke-width": 1.6, "marker-end": "url(#h3a)", opacity: 0.35 + 0.65 * (i / T.length) }));
      }
      for (const [k, [x, y]] of Object.entries(pos)) {
        const cur = k === T[T.length - 1];
        svg.append(s("rect", { x: x - 24, y: y - 13, width: 48, height: 26, rx: 13, fill: cur ? "var(--accent)" : T.includes(k) ? "var(--accent-soft)" : "var(--surface)", stroke: cur ? "var(--accent)" : "var(--border-strong)" }));
        svg.append(s("text", { x, y: y + 4.5, "text-anchor": "middle", "font-size": 12, fill: cur ? "#fff" : k === "" ? "var(--muted)" : "var(--text)" }, k === "" ? "∅" : "{" + k.split("").join(",") + "}"));
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件 3：I-map 充分吗？（11.2.1 节，补充的检验器）
  // ---------------------------------------------------------------
  const KAPPAS = [
    { k: "ndet", name: "κ_ndet：X_k(η_k)", f: (us, ys, S) => key(S), show: (v) => "{" + v.split("").join(",") + "}", note: "11.2.2 节：(11.30)(11.31) 只用 X_k、u_k、y_{k+1} 就能算出 X_{k+1}。" },
    { k: "sf", name: "κ_sf：只记最新观测 y_k", f: (us, ys) => ys[ys.length - 1], show: String, note: "传感器反馈：κ(η_{k+1}) = y_{k+1} 直接就是新观测，当然「算得出来」——充分性是相对于派生 I-空间而言的，它丢掉了大量信息。" },
    { k: "k1", name: "κ₁：最近一个阶段 (u_{k−1}, y_k)", f: (us, ys) => (us.length ? us[us.length - 1] : "·") + "|" + ys[ys.length - 1], show: (v) => "(" + v.replace("|", ", ").replace(/-/g, "−") + ")", note: "(11.41) 取 i = 1：窗口往前滑一格，新窗口由旧窗口、u_k、y_{k+1} 决定。" },
    { k: "k2", name: "κ₂：最近两个阶段 (11.41)", f: (us, ys) => us.slice(-2).join(",") + "|" + ys.slice(-2).join(","), show: (v) => "(" + v.replace(/-/g, "−") + ")", note: "有限记忆的 I-map 总是充分的：滑动窗口。" },
    { k: "stage", name: "κ_stage：只记阶段号 k（例 11.12）", f: (us, ys) => ys.length, show: String, note: "κ(η_{k+1}) = k + 1。充分，但对应的计划只是开环的动作序列。" },
    { k: "est", name: "κ_est：估计 = X_k(η_k) 中最小的状态", f: (us, ys, S) => Math.min(...S), show: String, note: "例 11.11 的思路：只留一个估计。估计相同的两段历史，后续可能分道扬镳。" },
    { k: "card", name: "|X_k(η_k)|：可能状态的个数", f: (us, ys, S) => S.size, show: String, note: "只记「有几个可能」，不记「是哪几个」。" },
  ];
  function enumHistories(X1, depth) {
    const out = new Map();
    const rec = (us, ys, S) => {
      out.set(us.join(",") + "|" + ys.join(","), { us, ys, S });
      if (ys.length === depth) return;
      for (const u of U3) {
        const pred = union([...S].map((x) => F3(x, u)));
        for (const y of Y3) { const S2 = inter(pred, H3(y)); if (S2.size) rec(us.concat([u]), ys.concat([y]), S2); }
      }
    };
    for (const y1 of Y3) { const S = inter(X1, H3(y1)); if (S.size) rec([], [y1], S); }
    return out;
  }
  class Sufficiency {
    constructor(root) {
      this.kk = "est";
      const body = C.frame(root, "这个 I-map 充分吗？", "例 11.13，X₁ = {0,1,2}，枚举所有长度 ≤ 4 的可能历史");
      this.H = enumHistories(new Set(X3), 4);
      this.sel = C.select(KAPPAS.map((k) => [k.k, k.name]), this.kk, (v) => { this.kk = v; this.update(); });
      this.svg = s("svg", { viewBox: "0 0 640 230", width: "100%", style: "max-width:640px" });
      this.msg = h("div", { class: "msg" });
      this.note = h("div", { class: "small", style: "margin-top:6px" });
      this.stats = { n: C.stat("可能的历史（≤ 4 阶段）"), d: C.stat("出现过的派生 I-state"), t: C.stat("检查过的 (κ, u, y) 组合") };
      body.append(h("div", { class: "controls" }, h("label", null, "I-map κ"), this.sel), h("div", { class: "stats" }, Object.values(this.stats)), this.msg, h("div", { class: "svg-wrap" }, this.svg), this.note);
      this.update();
    }
    update() {
      const K = KAPPAS.find((k) => k.k === this.kk);
      const H = this.H, succ = new Map(), vals = new Set();
      let bad = null;
      for (const [hk, hv] of H) {
        const k0 = K.f(hv.us, hv.ys, hv.S); vals.add(k0);
        for (const u of U3) for (const y of Y3) {
          const n = H.get(hv.us.concat([u]).join(",") + "|" + hv.ys.concat([y]).join(","));
          if (!n) continue;
          const k1 = K.f(n.us, n.ys, n.S), t = k0 + "#" + u + "#" + y;
          if (succ.has(t)) { if (!bad && succ.get(t).v !== k1) bad = { a: succ.get(t).h, b: hv, u, y, ka: succ.get(t).v, kb: k1, k0 }; }
          else succ.set(t, { v: k1, h: hv });
        }
      }
      this.stats.n.set(H.size.toLocaleString());
      this.stats.d.set(vals.size);
      this.stats.t.set(succ.size.toLocaleString());
      this.msg.className = "msg " + (bad ? "bad" : "ok");
      this.msg.innerHTML = bad ? "<b>不充分</b>：找到两段历史，它们的派生 I-state 相同，接上同样的 u 和 y 之后派生 I-state 却不同——只凭派生 I-state 无法写出派生信息转移方程 (11.27)。"
        : `<b>充分</b>（在枚举到的全部历史上）：派生信息转移方程 (11.27) 存在，一共用到 ${succ.size} 条「(κ(η_k), u_k, y_{k+1}) → κ(η_{k+1})」规则。`;
      this.note.innerHTML = K.note;
      this.drawDiagram(K, bad, succ);
    }
    drawDiagram(K, bad, succ) {
      const svg = this.svg; svg.innerHTML = "";
      PA.arrowDefs(svg, { "sfa": "var(--muted)", "sfr": "var(--bad)", "sfg": "var(--ok)" });
      const box = (x, y, w, t, sub, color) => {
        svg.append(s("rect", { x: x - w / 2, y: y - 17, width: w, height: 34, rx: 7, fill: "var(--surface)", stroke: color || "var(--border-strong)", "stroke-width": color ? 2 : 1 }));
        svg.append(s("text", { x, y: y - 1, "text-anchor": "middle", "font-size": 12, fill: "var(--text)" }, t));
        if (sub) svg.append(s("text", { x, y: y + 12, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, sub));
      };
      const arr = (x1, y1, x2, y2, lab, c) => {
        svg.append(s("line", { x1, y1, x2, y2, stroke: c || "var(--muted)", "stroke-width": 1.4, "marker-end": `url(#${c === "var(--bad)" ? "sfr" : c === "var(--ok)" ? "sfg" : "sfa"})` }));
        if (lab) svg.append(s("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, lab));
      };
      const hs = (hv) => `u:${hv.us.join(",") || "—"} y:${hv.ys.join(",")}`.replace(/-/g, "−");
      if (bad) {
        const nA = this.H.get(bad.a.us.concat([bad.u]).join(",") + "|" + bad.a.ys.concat([bad.y]).join(","));
        const nB = this.H.get(bad.b.us.concat([bad.u]).join(",") + "|" + bad.b.ys.concat([bad.y]).join(","));
        box(110, 40, 190, "η：" + hs(bad.a), "X = " + showSet(bad.a.S));
        box(110, 190, 190, "η′：" + hs(bad.b), "X = " + showSet(bad.b.S));
        box(320, 115, 120, "κ = " + K.show(bad.k0), "两者相同");
        arr(205, 50, 258, 100, "κ"); arr(205, 180, 258, 130, "κ");
        const ul = `u = ${String(bad.u).replace("-", "−")}, y = ${bad.y}`;
        box(520, 40, 200, "κ(η u y) = " + K.show(bad.ka), "X = " + showSet(nA.S), "var(--bad)");
        box(520, 190, 200, "κ(η′ u y) = " + K.show(bad.kb), "X = " + showSet(nB.S), "var(--bad)");
        arr(382, 105, 418, 52, ul, "var(--bad)"); arr(382, 125, 418, 178, ul, "var(--bad)");
        svg.append(s("text", { x: 520, y: 118, "text-anchor": "middle", "font-size": 12, fill: "var(--bad)" }, "≠：不是单点（图 11.4b）"));
      } else {
        // 举一条规则当例子：取一个有代表性的
        const ex = [...succ.entries()].find(([t]) => !t.startsWith("1#")) || [...succ.entries()][0];
        const [k0, u, y] = ex[0].split("#");
        const hv = ex[1].h;
        box(110, 40, 190, "η：" + hs(hv), "X = " + showSet(hv.S));
        box(110, 190, 150, "κ(η) = " + K.show(K.f(hv.us, hv.ys, hv.S)));
        const n = this.H.get(hv.us.concat([+u]).join(",") + "|" + hv.ys.concat([+y]).join(","));
        box(520, 40, 200, "η u y", hs(n));
        box(520, 190, 170, "κ(η u y) = " + K.show(ex[1].v), null, "var(--ok)");
        arr(205, 40, 418, 40, `f_I：u = ${u.replace("-", "−")}, y = ${y}`);
        arr(110, 58, 110, 170, "κ"); arr(520, 58, 520, 170, "κ");
        arr(186, 190, 433, 190, "f_Ider：只用派生 I-state 就能算", "var(--ok)");
        svg.append(s("text", { x: 320, y: 120, "text-anchor": "middle", "font-size": 12, fill: "var(--ok)" }, "两条路径结果相同（图 11.4a）"));
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件 4：概率 I-state 在单纯形上（11.2.3、11.3.3 节，例 11.14，习题 5）
  // ---------------------------------------------------------------
  const MODELS = {
    ex13: {
      name: "例 11.13 的模型（θ、ψ 取均匀分布，补充）", U: U3, Y: Y3,
      T: (u) => X3.map((x) => X3.map((x2) => TH3.filter((th) => f3(x, u, th) === x2).length / TH3.length)),
      L: (y) => X3.map((x) => PS3.filter((p) => x + p === y).length / PS3.length),
    },
    ex5: {
      name: "习题 5 的模型（按更正后的读法）", U: [0, 1], Y: [0, 1],
      T: (u) => (u === 0 ? [[0.8, 0.2, 0], [0.1, 0.8, 0.1], [0, 0.2, 0.8]] : [[0.1, 0.8, 0.1], [0, 0.2, 0.8], [0, 0, 1]]),
      L: (y) => (y === 0 ? [0.8, 0.5, 0.2] : [0.2, 0.5, 0.8]),
    },
  };
  class BeliefSimplex {
    constructor(root) {
      this.mk = "ex5"; this.r = C.rng(C.newSeed()); this.showTruth = true;
      const body = C.frame(root, "概率 I-state 在单纯形上", "I_prob 是 2-单纯形；投影到 (p₀, p₁) 平面就是图 11.6 的三角形");
      this.st = new C.Stage({ view: [-0.12, 1.12, -0.12, 1.1], aspect: 0.86, maxW: 430, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { if (this.k === 1 && this.phase === "obs" && p.x >= 0 && p.y >= 0 && p.x + p.y <= 1) { this.setPrior([p.x, p.y, 1 - p.x - p.y]); return "prior"; } return null; },
        onMove: (p, d) => { if (d === "prior") { const x = Math.max(0, p.x), y = Math.max(0, p.y), sm = x + y; this.setPrior(sm > 1 ? [x / sm, y / sm, 0] : [x, y, 1 - sm]); } },
        cursor: (p) => (this.k === 1 && this.phase === "obs" && p.x >= -0.02 && p.y >= -0.02 && p.x + p.y <= 1.02 ? "crosshair" : null) });
      this.segM = C.seg(Object.entries(MODELS).map(([k, m]) => [k, m.name]), this.mk, (k) => { this.mk = k; this.reset(); });
      this.uBox = h("span", { class: "controls", style: "margin:0" });
      this.yBox = h("span", { class: "controls", style: "margin:0" });
      this.bars = s("svg", { viewBox: "0 0 240 150", width: "100%", style: "max-width:240px" });
      this.log = h("div", { class: "small mono", style: "line-height:1.65;max-height:170px;overflow:auto" });
      this.phaseMsg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segM),
        h("div", { class: "controls" }, h("label", null, "动作"), this.uBox, h("span", { class: "sep" }), h("label", null, "观测"), this.yBox),
        h("div", { class: "controls" }, C.button("回放习题 5 的历史 (11.96)", () => this.replay(), "small"), C.button("重置（均匀先验）", () => this.reset(), "small"),
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.render(); })),
        this.phaseMsg,
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "svg-wrap" }, this.bars), this.log)),
        C.legend([[C.cv("prob"), "P(x_k | η_k)（修正后）", true], [C.cva("prob", 0.45), "P(x_{k+1} | η_k, u_k)（预测）", true], [C.cva("ndet", 0.35), "支撑集 = 不确定 I-state（面）"], [C.cv("truth"), "真实状态所在的顶点", true]]));
      this.reset();
    }
    model() { return MODELS[this.mk]; }
    setPrior(P) { this.P = P; this.pts = [{ P: P.slice(), kind: "prior" }]; this.lines = ["P(x₁) = " + this.vec(P)]; this.x = C.pick(P, this.r); this.render(); }
    reset() { this.k = 1; this.phase = "obs"; this.setPrior([1 / 3, 1 / 3, 1 / 3]); }
    vec(P) { return "[" + P.map((p) => C.fmt(p, 3, 30)).join(", ") + "]"; }
    predictive() { const M = this.model(); return M.Y.map((y) => { const L = M.L(y); return L.reduce((a, l, i) => a + l * this.P[i], 0); }); }
    observe(y) {
      const L = this.model().L(y), s0 = L.reduce((a, l, i) => a + l * this.P[i], 0);
      if (s0 <= 1e-12) return;
      this.P = this.P.map((p, i) => (p * L[i]) / s0);           // (11.36) / (11.39)
      this.pts.push({ P: this.P.slice(), kind: "post" });
      this.lines.push(`y${C.sub(this.k)} = ${y} → P(x${C.sub(this.k)}|η${C.sub(this.k)}) = ${this.vec(this.P)}`);
      this.phase = "act"; this.render();
    }
    act(u) {
      const T = this.model().T(u);
      this.P = X3.map((x2) => X3.reduce((a, x) => a + this.P[x] * T[x][x2], 0));   // (11.38)
      this.x = C.pick(T[this.x], this.r);
      this.k++;
      this.pts.push({ P: this.P.slice(), kind: "pred" });
      this.lines.push(`u${C.sub(this.k - 1)} = ${String(u).replace("-", "−")} → P(x${C.sub(this.k)}|η${C.sub(this.k - 1)}, u${C.sub(this.k - 1)}) = ${this.vec(this.P)}`);
      this.phase = "obs"; this.render();
    }
    sampleY() { const M = this.model(); const y = M.Y[C.pick(M.Y.map((y) => M.L(y)[this.x]), this.r)]; this.observe(y); }
    replay() { this.mk = "ex5"; this.segM.set("ex5"); this.reset(); this.observe(1); this.act(1); this.observe(0); this.act(0); this.observe(0); }
    render() {
      const M = this.model();
      this.uBox.innerHTML = ""; this.yBox.innerHTML = "";
      M.U.forEach((u) => { const b = C.button(`u = ${String(u).replace("-", "−")}`, () => this.act(u), "small primary"); b.disabled = this.phase !== "act"; this.uBox.append(b); });
      const pr = this.predictive();
      M.Y.forEach((y, i) => { const b = C.button(`y = ${y}`, () => this.observe(y), "small"); b.disabled = this.phase !== "obs" || pr[i] < 1e-12; b.title = `P(y | η) = ${pr[i].toFixed(3)}`; this.yBox.append(b); });
      const rb = C.button("按真实状态随机观测", () => this.sampleY(), "small"); rb.disabled = this.phase !== "obs"; this.yBox.append(rb);
      this.phaseMsg.innerHTML = this.phase === "obs"
        ? `阶段 k = ${this.k}：等待观测 y${C.sub(this.k)}（贝叶斯修正 ${this.k === 1 ? "(11.36)" : "(11.39)"}）。${this.k === 1 ? "<span class='muted'>也可以先在三角形里点一下，改变先验 P(x₁)——I₀ = I_prob 时任何一点都可以是初始条件。</span>" : ""}`
        : `阶段 k = ${this.k}：已修正。选一个动作 u${C.sub(this.k)}（预测 (11.38)）。`;
      this.log.innerHTML = this.lines.join("<br>");
      this.drawBars();
      this.st.draw();
    }
    draw(st, col) {
      const T = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
      st.poly(T, C.alpha(col.prob, 0.06), col.strong, 1.2);
      // 坐标轴与标注（图 11.6）
      st.arrow({ x: 0, y: 0 }, { x: 1.1, y: 0 }, col.muted, 1); st.arrow({ x: 0, y: 0 }, { x: 0, y: 1.08 }, col.muted, 1);
      st.text("p₀", { x: 1.1, y: 0.05 }, col.muted, { size: 12 }); st.text("p₁", { x: -0.07, y: 1.04 }, col.muted, { size: 12 });
      st.text("x = 0 确定 (1,0,0)", { x: 0.88, y: -0.07 }, col.text2, { size: 11 });
      st.text("x = 1 确定 (0,1,0)", { x: 0.22, y: 1.05 }, col.text2, { size: 11 });
      st.text("x = 2 确定 (0,0,1)", { x: 0.02, y: -0.07 }, col.text2, { size: 11, align: "left" });
      st.dot({ x: 1 / 3, y: 1 / 3 }, 3, col.muted);
      st.text("均匀", { x: 1 / 3, y: 1 / 3 }, col.muted, { size: 10.5, dy: 11 });
      // 支撑集（不确定 I-state）对应的面
      const supp = this.P.map((p) => p > 1e-9);
      const V = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }];
      const face = V.filter((_, i) => supp[i]);
      if (face.length === 3) st.poly(face, C.alpha(col.ndet, 0.12), null);
      else if (face.length === 2) st.line(face[0], face[1], C.alpha(col.ndet, 0.6), 6);
      else if (face.length === 1) st.dot(face[0], 10, C.alpha(col.ndet, 0.4));
      // 轨迹
      const P2 = (P) => ({ x: P[0], y: P[1] });
      for (let i = 1; i < this.pts.length; i++) {
        const a = P2(this.pts[i - 1].P), b = P2(this.pts[i].P);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) continue;
        if (this.pts[i].kind === "pred") st.line(a, b, C.alpha(col.prob, 0.6), 1.5, [5, 4]);
        else st.arrow(a, b, col.prob, 1.8, 8);
      }
      this.pts.forEach((pt, i) => {
        const last = i === this.pts.length - 1;
        st.dot(P2(pt.P), last ? 6.5 : 4, pt.kind === "pred" ? C.alpha(col.prob, 0.45) : col.prob, last ? col.surface : null, 2);
      });
      if (this.showTruth) st.dot(V[this.x], 6, col.truth, col.surface, 2);
      const sNames = ["{0}", "{1}", "{2}"];
      st.text(`支撑集 = ${C.setStr(X3.filter((x) => supp[x]).map(String))}`, { x: 0.62, y: 0.92 }, col.ndet, { size: 12, weight: 650 });
    }
    drawBars() {
      const svg = this.bars; svg.innerHTML = "";
      X3.forEach((x) => {
        const p = this.P[x], hh = 100 * p, xx = 30 + x * 70;
        svg.append(s("rect", { x: xx, y: 115 - hh, width: 46, height: hh, rx: 3, fill: this.phase === "act" ? "var(--c-alive2)" : "color-mix(in srgb, var(--c-alive2) 50%, transparent)" }));
        svg.append(s("text", { x: xx + 23, y: 110 - hh, "text-anchor": "middle", "font-size": 11.5, fill: "var(--text)" }, p.toFixed(3)));
        svg.append(s("text", { x: xx + 23, y: 133, "text-anchor": "middle", "font-size": 12, fill: this.showTruth && x === this.x ? "var(--text)" : "var(--muted)", "font-weight": this.showTruth && x === this.x ? 700 : 400 }, `x = ${x}` + (this.showTruth && x === this.x ? " ●" : "")));
      });
      svg.append(s("line", { x1: 20, y1: 115, x2: 230, y2: 115, stroke: "var(--border-strong)" }));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='sensor-preimage']").forEach((el) => (el._w = new SensorLab(el)));
    document.querySelectorAll("[data-widget='three-state']").forEach((el) => (el._w = new ThreeState(el)));
    document.querySelectorAll("[data-widget='sufficiency']").forEach((el) => (el._w = new Sufficiency(el)));
    document.querySelectorAll("[data-widget='belief-simplex']").forEach((el) => (el._w = new BeliefSimplex(el)));
  });
})();
