/* 10.5 节：博弈树与安全计划（图 10.12–10.16）、三种信息模型（图 10.17、10.18，式 10.105、10.106）、
   有自然的博弈（图 10.19）、状态空间上的序贯博弈（走廊追逐，补充；式 10.110、10.111、10.113） */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH10;
  const INF = Infinity;

  const PRESETS = {
    fig1013: { name: "图 10.13", b: 2, D: 4, leaves: [4, 2, 0, 0, 1, 0, 3, 2, 2, 3, 1, 2, 4, 1, 3, 2] },
    fig1012: { name: "图 10.12（3×3）", b: 3, D: 2, leaves: [3, 3, 5, 1, -1, 7, 0, -2, 4] },
    fig1016: { name: "像图 10.16（补充数值）", b: 3, D: 2, leaves: [0, -1, 1, 2, 4, -2, -1, 3, 0] },
    fig1023: { name: "图 10.23（习题 18）", b: 2, D: 4, leaves: [-1, 2, 0, 1, 2, 4, 1, 5, 7, 1, -1, 3, 1, 0, 2, 4] },
  };
  // 自底向上：order[ℓ] = "min"（P1）或 "max"（P2）。返回 vals[ℓ][i]
  function minimax(leaves, b, order) {
    const D = order.length, vals = new Array(D + 1);
    vals[D] = leaves.slice();
    for (let l = D - 1; l >= 0; l--) {
      vals[l] = [];
      for (let i = 0; i < Math.pow(b, l); i++) {
        const ch = vals[l + 1].slice(i * b, i * b + b);
        vals[l].push(order[l] === "min" ? Math.min(...ch) : Math.max(...ch));
      }
    }
    return vals;
  }
  // 交换 P1、P2 的次序（图 10.15）：叶子按「P2 先」的顺序重排
  function swapLeaves(p) {
    const L = p.leaves;
    if (p.D === 2) { const out = []; for (let v = 0; v < p.b; v++) for (let u = 0; u < p.b; u++) out.push(L[u * p.b + v]); return out; }
    const leaf = (u1, v1, u2, v2) => L[8 * u1 + 4 * v1 + 2 * u2 + v2], out = [];
    for (const v1 of [0, 1]) for (const u1 of [0, 1]) for (const v2 of [0, 1]) for (const u2 of [0, 1]) out.push(leaf(u1, v1, u2, v2));
    return out;
  }

  // ---------------------------------------------------------------
  // 组件：博弈树——安全计划、交换次序、alpha-beta 剪枝
  // ---------------------------------------------------------------
  class GameTree {
    constructor(root) {
      this.key = "fig1013"; this.mode = "upper"; this.level = 0; this.ab = null;
      const body = C.frame(root, "博弈树与安全计划", "P1（蓝）想让代价小，P2（紫）想让代价大；值自底向上传播");
      this.selP = C.select(Object.entries(PRESETS).map(([k, p]) => [k, p.name]), this.key, (k) => { this.key = k; this.load(); });
      this.segM = C.seg([["upper", "上值：P1 的安全计划（图 10.14）"], ["lower", "下值：P2 先行（图 10.15）"], ["ab", "alpha-beta 剪枝（图 10.16）"]], this.mode, (k) => { this.mode = k; this.restart(); });
      this.inp = h("input", { type: "text", style: "width:min(340px,100%)", title: "从左到右的叶子代价，用逗号分隔" });
      this.inp.addEventListener("change", () => this.applyLeaves());
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.msg = h("div", { class: "small", style: "min-height:3.2em" });
      body.append(h("div", { class: "controls" }, this.selP, h("label", null, "叶子：", this.inp), C.button("应用", () => this.applyLeaves(), "small")),
        h("div", { class: "controls" }, this.segM),
        h("div", { class: "controls" }, C.button("一步", () => this.step(), "small primary"), C.button("算完", () => { for (let g = 0; g < 200 && this.step(true); g++); this.render(); }, "small"), C.button("重来", () => this.restart(), "small")),
        this.svgWrap, this.msg,
        C.legend([[C.cv("accent"), "P1 的决策顶点（取最小）", true], [C.cv("alive2"), "P2 的决策顶点（取最大）", true], [C.cv("warn"), "alpha-beta 访问过的叶子", true], [C.cva("muted", 0.35), "被剪掉、不用看的部分"]]));
      this.load();
    }
    load() { this.p = JSON.parse(JSON.stringify(PRESETS[this.key])); this.inp.value = this.p.leaves.join(", "); this.restart(); }
    applyLeaves() {
      const xs = this.inp.value.split(/[,，\s]+/).filter(Boolean).map(Number);
      const n = Math.pow(this.p.b, this.p.D);
      if (xs.length !== n || xs.some((x) => !isFinite(x))) { this.msg.innerHTML = `<span class="no">需要正好 ${n} 个数。</span>`; return; }
      this.p.leaves = xs; this.restart();
    }
    tree() {
      const p = this.p, P1first = this.mode !== "lower";
      const order = Array.from({ length: p.D }, (_, l) => ((l % 2 === 0) === P1first ? "min" : "max"));
      const leaves = P1first ? p.leaves : swapLeaves(p);
      return { order, leaves, vals: minimax(leaves, p.b, order) };
    }
    restart() {
      this.level = this.p.D; this.ab = null; this.done = false;
      if (this.mode === "ab") this.abInit();
      this.render();
    }
    // ---- alpha-beta：显式栈模拟深度优先，便于一步一步地演示
    abInit() {
      const { order, leaves } = this.tree(), b = this.p.b, D = this.p.D;
      this.ab = { visited: new Set(), pruned: [], order, leaves, val: null, log: [] };
      const self = this;
      function* rec(l, i, a, bb) {
        if (l === D) { self.ab.visited.add(i); yield `看叶子 ${i + 1}：代价 ${leaves[i]}`; return leaves[i]; }
        let v = order[l] === "min" ? INF : -INF;
        for (let c = 0; c < b; c++) {
          const r = yield* rec(l + 1, i * b + c, a, bb);
          if (order[l] === "min") {
            v = Math.min(v, r);
            if (v <= a) { if (c < b - 1) { self.ab.pruned.push([l + 1, i * b + c + 1, b - 1 - c]); yield `P1 在这里能拿到 ≤ ${v}，而上面的 P2 已经能保证 ≥ ${a}：剩下的 ${b - 1 - c} 个孩子不用看`; } break; }
            bb = Math.min(bb, v);
          } else {
            v = Math.max(v, r);
            if (v >= bb) { if (c < b - 1) { self.ab.pruned.push([l + 1, i * b + c + 1, b - 1 - c]); yield `P2 在这里能逼到 ≥ ${v}，而 P1 已经能保证 ≤ ${bb}：剩下的 ${b - 1 - c} 个孩子不用看`; } break; }
            a = Math.max(a, v);
          }
        }
        return v;
      }
      this.gen = rec(0, 0, -INF, INF);
    }
    step(silent) {
      if (this.done) return false;
      if (this.mode === "ab") {
        const r = this.gen.next();
        if (r.done) { this.ab.val = r.value; this.done = true; }
        else this.ab.log.push(r.value);
      } else {
        this.level--;
        if (this.level <= 0) { this.level = 0; this.done = true; }
      }
      if (!silent) this.render();
      return !this.done;
    }
    render() {
      const p = this.p, { order, leaves, vals } = this.tree(), D = p.D, b = p.b, nL = Math.pow(b, D);
      const W = Math.max(520, nL * 38 + 90), LY = 54, Ht = 34 + D * LY + 44;
      const svg = s("svg", { viewBox: `0 0 ${W} ${Ht}`, width: W, height: Ht, role: "img", "aria-label": "博弈树" });
      const X0 = 80, xs = (l, i) => X0 + (i + 0.5) * Math.pow(b, D - l) * ((W - X0 - 10) / nL), ys = (l) => 24 + l * LY;
      const labels = b === 2 ? ["L", "R"] : ["1", "2", "3"];
      const pruned = (l, i) => this.ab && this.ab.pruned.some(([pl, pi, cnt]) => { const span = Math.pow(b, l - pl); return l >= pl && Math.floor(i / span) >= pi && Math.floor(i / span) < pi + cnt && Math.floor(i / span / b) === Math.floor(pi / b); });
      // 安全计划的粗线路径（算到根之后）
      const bold = new Set();
      if (this.mode !== "ab" && this.done) {
        let i = 0;
        for (let l = 0; l < D; l++) { const ch = vals[l + 1].slice(i * b, i * b + b); const c = ch.indexOf(vals[l][i]); bold.add(`${l + 1},${i * b + c}`); i = i * b + c; }
      }
      for (let l = 0; l < D; l++) {
        svg.append(s("text", { x: 6, y: ys(l) + 4, "font-size": 12, fill: order[l] === "min" ? "var(--accent-text)" : "var(--c-alive2)" }, `${order[l] === "min" ? "P₁" : "P₂"} 行动`));
        for (let i = 0; i < Math.pow(b, l); i++) for (let c = 0; c < b; c++) {
          const j = i * b + c, isB = bold.has(`${l + 1},${j}`), pr = pruned(l + 1, j);
          svg.append(s("line", { x1: xs(l, i), y1: ys(l), x2: xs(l + 1, j), y2: ys(l + 1), stroke: pr ? C.cva("muted", 0.3) : isB ? "var(--text)" : "var(--border-strong)", "stroke-width": isB ? 3 : 1 }));
          if (nL <= 16) svg.append(s("text", { x: (xs(l, i) * 0.4 + xs(l + 1, j) * 0.6) + (c < (b - 1) / 2 ? -7 : c > (b - 1) / 2 ? 7 : 6), y: (ys(l) * 0.4 + ys(l + 1) * 0.6) + 2, "text-anchor": "middle", "font-size": 9.5, fill: "var(--muted)" }, labels[c]));
        }
      }
      svg.append(s("text", { x: 6, y: ys(D) + 4, "font-size": 12, fill: "var(--text-2)" }, "代价"));
      for (let l = 0; l <= D; l++) for (let i = 0; i < Math.pow(b, l); i++) {
        const x = xs(l, i), y = ys(l), pr = pruned(l, i);
        if (l === D) {
          const vis = this.ab && this.ab.visited.has(i);
          svg.append(s("circle", { cx: x, cy: y, r: 5, fill: pr ? C.cva("muted", 0.3) : vis ? "var(--warn)" : "var(--bad)" }));
          svg.append(s("text", { x, y: y + 19, "text-anchor": "middle", "font-size": 12.5, fill: pr ? "var(--muted)" : "var(--text)" }, leaves[i]));
          continue;
        }
        const isP1 = order[l] === "min";
        svg.append(s("circle", { cx: x, cy: y, r: 6.5, fill: pr ? C.cva("muted", 0.3) : isP1 ? "var(--accent)" : "var(--surface)", stroke: isP1 ? "var(--accent)" : "var(--c-alive2)", "stroke-width": 2 }));
        if (this.mode !== "ab" && l >= this.level) svg.append(s("text", { x: x + 10, y: y + 4, "font-size": 12.5, "font-weight": 650, fill: isP1 ? "var(--accent-text)" : "var(--c-alive2)" }, vals[l][i]));
      }
      if (this.ab && this.ab.pruned.length) {
        for (const [pl, pi, cnt] of this.ab.pruned) {
          if (pl === D) continue;      // 叶子被剪掉时只把它画灰，不再写字
          const x0 = xs(pl, pi) - 14, x1 = xs(pl, pi + cnt - 1) + 14;
          svg.append(s("text", { x: (x0 + x1) / 2, y: ys(pl) - 10, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, "无需探索"));
        }
      }
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
      // 文字
      let m;
      if (this.mode === "ab") {
        const last = this.ab.log.length ? this.ab.log[this.ab.log.length - 1] : "深度优先、从左到右地搜索；点「一步」。";
        m = `${last}<br>已看叶子 ${this.ab.visited.size} / ${nL}` + (this.done ? `，<span class="yes">得到值 ${this.ab.val}</span>（与完整的自底向上计算 ${vals[0][0]} 相同，但少看了 ${nL - this.ab.visited.size} 个叶子）。` : "");
      } else if (!this.done) m = this.level === D ? "从叶子出发，每次「一步」把值向上传一层：P2 的顶点取孩子里的最大值，P1 的顶点取最小值。" : `已经算到第 ${this.level + 1} 层。`;
      else {
        const up = minimax(p.leaves, b, Array.from({ length: D }, (_, l) => (l % 2 === 0 ? "min" : "max")))[0][0];
        const lo = minimax(swapLeaves(p), b, Array.from({ length: D }, (_, l) => (l % 2 === 0 ? "max" : "min")))[0][0];
        m = this.mode === "upper" ? `<b>上值 L̄* = ${vals[0][0]}</b>：P1 不管 P2 怎么应对，都能保证代价不超过它。粗线是双方都按安全计划行动时走的路径。`
          : `<b>下值 L̲* = ${vals[0][0]}</b>（P2 先行，叶子顺序被重排）：P2 能保证代价不低于它。`;
        m += up === lo ? ` 上值 = 下值 = ${up}：<span class="yes">存在确定性鞍点</span>，博弈的值是 ${up}。` : ` 上值 ${up} ≠ 下值 ${lo}：没有确定性鞍点。`;
      }
      this.msg.innerHTML = m;
    }
  }

  // ---------------------------------------------------------------
  // 小工具：把矩阵画成表格（高亮鞍点 / 显示随机化策略）
  // ---------------------------------------------------------------
  const pct = (x) => (x < 1e-9 ? "0" : C.niceFrac(x, 60));
  function matrixTable(A, rowNames, colNames, opts) {
    const o = Object.assign({ saddle: true, mixed: true, fmtCell: (v) => C.niceFrac(v, 60) }, opts);
    const dv = C.detValues(A), mg = C.matrixGame(A), sad = Math.abs(dv.upper - dv.lower) < 1e-9;
    const t = h("table", { class: "data ch10-mini", style: "width:auto;font-size:13px;margin:4px 0" });
    t.append(h("tr", null, h("th", null, ""), ...colNames.map((c) => h("th", { class: "c", style: "color:var(--c-alive2)" }, c)), o.mixed ? h("th", { class: "c" }, "w") : null));
    A.forEach((r, i) => t.append(h("tr", null, h("th", { style: "color:var(--accent-text)" }, rowNames[i]),
      ...r.map((v, j) => h("td", { class: "c", style: o.saddle && sad && i === dv.ui && j === dv.lj ? "background:var(--ok-soft);font-weight:700" : "" }, o.fmtCell(v))),
      o.mixed ? h("td", { class: "c muted" }, pct(mg.w[i])) : null)));
    if (o.mixed) t.append(h("tr", null, h("th", null, "z"), ...mg.z.map((v) => h("td", { class: "c muted" }, pct(v))), h("td", null, "")));
    return { el: h("div", { style: "overflow-x:auto" }, t), dv, mg, sad };
  }

  // ---------------------------------------------------------------
  // 组件：三种信息模型（交替行动 / 阶段式 / 开环）
  // ---------------------------------------------------------------
  class InfoModels {
    constructor(root) {
      this.key = "fig1013"; this.model = "stage";
      const body = C.frame(root, "同一棵树，三种信息模型", "两阶段、每人每次选 L / R 的博弈（图 10.13 或习题 18 的图 10.23）");
      this.selP = C.select([["fig1013", "图 10.13"], ["fig1023", "图 10.23（习题 18）"]], this.key, (k) => { this.key = k; this.render(); });
      this.segM = C.seg([["alt", "交替行动"], ["stage", "阶段式（图 10.17、10.18）"], ["open", "开环（式 10.106）"]], this.model, (k) => { this.model = k; this.render(); });
      this.out = h("div");
      body.append(h("div", { class: "controls" }, this.selP, this.segM), this.out);
      this.render();
    }
    render() {
      const L = PRESETS[this.key].leaves, leaf = (u1, v1, u2, v2) => L[8 * u1 + 4 * v1 + 2 * u2 + v2], LR = ["L", "R"];
      const out = this.out; out.innerHTML = "";
      if (this.model === "alt") {
        const up = minimax(L, 2, ["min", "max", "min", "max"])[0][0], lo = minimax(swapLeaves({ D: 4, b: 2, leaves: L }), 2, ["max", "min", "max", "min"])[0][0];
        out.append(h("p", { html: `每个玩家都知道之前所有的动作（像下棋）。用上面「博弈树」的自底向上计算：<b>上值 ${up}</b>（P1 的安全计划），<b>下值 ${lo}</b>（交换次序后 P2 的安全计划）。` +
          (up === lo ? ` 两者相等：确定性鞍点，值 ${up}——P2 只要在每个阶段对 P1 的计划做最优反应即可。` : " 两者不等。注意：交替行动下 P1 的安全计划本身就是一个合法的解（P2 每步看到 P1 的动作再最优反应），上值就是 P1 能拿到的代价；下值只在 P2 先行的那个博弈里才实现。") }));
        return;
      }
      if (this.model === "stage") {
        out.append(h("p", { class: "small", html: "每个阶段两人<b>同时</b>出手，但都知道之前阶段的动作。最后两层可以换成 4 个 2×2 矩阵博弈（图 10.17）；每个矩阵用它的随机化值代替（图 10.18），剩下的又是一个 2×2 矩阵博弈 (10.105)。行 = P1 的 u₂，列 = P2 的 v₂；w、z 是随机化安全策略，绿色格子是确定性鞍点。" }));
        const grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px" });
        const top = [[0, 0], [0, 0]];
        for (const u1 of [0, 1]) for (const v1 of [0, 1]) {
          const A = [0, 1].map((u2) => [0, 1].map((v2) => leaf(u1, v1, u2, v2)));
          const T = matrixTable(A, LR, LR);
          top[u1][v1] = T.mg.value;
          grid.append(h("div", { class: "panel" }, h("div", { class: "panel-title" }, `第一阶段 (u₁, v₁) = (${LR[u1]}, ${LR[v1]})`),
            h("div", { class: "panel-body" }, T.el, h("div", { class: "small" }, `确定性上 / 下值 ${T.dv.upper} / ${T.dv.lower}；`, h("b", null, `随机化值 ${C.niceFrac(T.mg.value, 60)}`)))));
        }
        out.append(grid);
        const T = matrixTable(top, LR, LR);
        out.append(h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "第一阶段：把上面四个随机化值填进去（式 10.105 / 图 10.18）"),
          h("div", { class: "panel-body" }, T.el, h("div", { class: "small", html: `确定性上 / 下值 ${C.niceFrac(T.dv.upper, 60)} / ${C.niceFrac(T.dv.lower, 60)}；<b>阶段式下的（随机化）值 = ${C.niceFrac(T.mg.value, 60)}</b>。` +
            (T.sad ? " 这里每一步都有确定性鞍点，所以不需要随机化。" : " 有矩阵没有确定性鞍点：到达对应顶点时必须按 w、z 随机出手。") }))));
        out.append(h("p", { class: "small muted" }, "如果把阶段式博弈直接写成矩阵：每人有 5 个决策顶点、每个 2 种选择，|Π₁| = |Π₂| = 2⁵ = 32，是一个 32×32 的矩阵博弈——树形分解把它拆成了 5 个 2×2 的小博弈（动态规划原理）。"));
        return;
      }
      // 开环：4×4
      const plans = [[0, 0], [0, 1], [1, 0], [1, 1]], names = plans.map(([a, c]) => `(${LR[a]},${LR[c]})`);
      const A = plans.map(([u1, u2]) => plans.map(([v1, v2]) => leaf(u1, v1, u2, v2)));
      const T = matrixTable(A, names, names);
      out.append(h("p", { class: "small", html: "两人都看不到对方之前的动作，只知道现在是第几阶段：计划就是动作序列，整个博弈等价于一个 4×4 的单阶段矩阵博弈 (10.106)。行 = P1 的计划 (u₁, u₂)，列 = P2 的计划 (v₁, v₂)。" }),
        T.el, h("p", { class: "small", html: `确定性上 / 下值 ${T.dv.upper} / ${T.dv.lower}${T.sad ? "（有确定性鞍点）" : "：<b>没有确定性鞍点</b>，要解一个 4 维线性规划"}；` +
          `<b>随机化值 = ${C.niceFrac(T.mg.value, 60)}</b>，w = (${T.mg.w.map(pct).join(", ")})，z = (${T.mg.z.map(pct).join(", ")})。与阶段式的结果不同——信息更少，结果也变了。` }));
    }
  }

  // ---------------------------------------------------------------
  // 组件：图 10.19——三个玩家：P1、P2 和自然
  // ---------------------------------------------------------------
  const A1 = [[3, -2], [-6, 3]], A2 = [[3, -1], [6, 0]];
  class NatureGame {
    constructor(root) {
      this.p = 1 / 3;
      const body = C.frame(root, "有自然参与的零和博弈（图 10.19）", "自然以概率 p 选左边的矩阵 A₁、以 1 − p 选右边的 A₂；P1、P2 同时出手，都不知道自然选了哪个");
      this.sP = C.slider("p", 0, 1, 0.01, this.p, (v) => { this.p = v; this.render(); }, (v) => C.niceFrac(v, 12));
      this.out = h("div");
      body.append(h("div", { class: "controls" }, this.sP, C.button("p = 1/3（书中）", () => { this.p = 1 / 3; this.sP.set(this.p); this.sP.input.value = this.p; this.render(); }, "small")), this.out);
      this.render();
    }
    render() {
      const p = this.p, A = A1.map((r, i) => r.map((v, j) => p * v + (1 - p) * A2[i][j])), LR = ["L", "R"];
      const T1 = matrixTable(A1, LR, LR, { mixed: false, saddle: false }), T2 = matrixTable(A2, LR, LR, { mixed: false, saddle: false }), T = matrixTable(A, LR, LR);
      this.out.innerHTML = "";
      this.out.append(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px" },
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, `A₁（概率 ${C.niceFrac(p, 12)}），式 (10.117)`), h("div", { class: "panel-body" }, T1.el)),
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, `A₂（概率 ${C.niceFrac(1 - p, 12)}），式 (10.118)`), h("div", { class: "panel-body" }, T2.el)),
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, "A = p A₁ + (1 − p) A₂"), h("div", { class: "panel-body" }, T.el))));
      const sad = T.sad;
      this.out.append(h("p", { class: "small", html: (sad ? `<span class="yes">有确定性鞍点</span>：P1 选 ${LR[T.dv.ui]}（第 ${T.dv.ui + 1} 行）、P2 选 ${LR[T.dv.lj]}（第 ${T.dv.lj + 1} 列），期望代价 ${C.niceFrac(T.dv.upper, 60)}。`
        : `没有确定性鞍点（上值 ${C.niceFrac(T.dv.upper, 60)} ≠ 下值 ${C.niceFrac(T.dv.lower, 60)}）：随机化值 ${C.niceFrac(T.mg.value, 60)}，P1 按 w、P2 按 z 随机出手。`) +
        ` 期望意义下的分析把「对自然的不确定」先平均掉，再对 P2 做最坏情况分析。` }));
    }
  }

  // ---------------------------------------------------------------
  // 组件：状态空间上的序贯博弈——走廊追逐（补充）
  // ---------------------------------------------------------------
  class CorridorChase {
    constructor(root) {
      this.N = 5; this.K = 2; this.sel = [2, 2];
      const body = C.frame(root, "状态空间上的博弈：走廊追逐（补充）", "x = (P1 位置, P2 位置)；每阶段两人同时选 −1 / 0 / +1；l = 1 表示这一阶段结束时 P2 还没被抓到");
      this.sN = C.slider("走廊长度 N", 3, 7, 1, this.N, (v) => { this.N = v; this.sel = [Math.floor(v / 2), Math.floor(v / 2)]; this.compute(); }, (v) => String(v));
      this.sK = C.slider("剩余阶段数 K", 1, 6, 1, this.K, (v) => { this.K = v; this.compute(); }, (v) => String(v));
      this.maps = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px" });
      this.detail = h("div", { class: "small", style: "margin-top:8px" });
      body.append(h("div", { class: "controls" }, this.sN, this.sK), this.maps, this.detail,
        h("p", { class: "small muted", style: "margin:6px 0 0" }, "点任意格子选状态。行 = P1（追捕者）位置，列 = P2（逃跑者）位置；格里的数是还剩 K 个阶段时的值（P1 想小，P2 想大）。"));
      this.compute();
    }
    compute() {
      const N = this.N, cl = (q) => Math.max(0, Math.min(N - 1, q)), D = [-1, 0, 1];
      const zero = () => Array.from({ length: N }, () => new Array(N).fill(0));
      let Up = zero(), Lo = zero(), Ra = zero();
      const mat = (a, b, V) => D.map((u) => D.map((v) => (cl(a + u) !== cl(b + v) ? 1 : 0) + V[cl(a + u)][cl(b + v)]));
      this.hist = [];
      for (let k = 0; k < this.K; k++) {
        const nU = zero(), nL = zero(), nR = zero();
        for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
          nU[a][b] = C.detValues(mat(a, b, Up)).upper;          // 式 (10.110)
          nL[a][b] = C.detValues(mat(a, b, Lo)).lower;          // 式 (10.111)
          nR[a][b] = C.matrixGame(mat(a, b, Ra)).value;         // 式 (10.113)
        }
        this.hist.push({ Up, Lo, Ra });
        Up = nU; Lo = nL; Ra = nR;
      }
      this.V = { Up, Lo, Ra }; this.mat = mat;
      this.render();
    }
    render() {
      const N = this.N, [sa, sb] = this.sel, V = this.V;
      this.maps.innerHTML = "";
      const mk = (title, M, color, fmtv) => {
        let mx = 0; M.forEach((r) => r.forEach((v) => (mx = Math.max(mx, v))));
        const t = h("table", { class: "data ch10-mini", style: "width:auto;font-size:12.5px;margin:0 auto" });
        t.append(h("tr", null, h("th", null, "p1\\p2"), ...Array.from({ length: N }, (_, b) => h("th", { class: "c" }, b))));
        M.forEach((r, a) => t.append(h("tr", null, h("th", null, a), ...r.map((v, b) => {
          const td = h("td", { class: "c", style: `cursor:pointer;background:color-mix(in srgb, var(${color}) ${Math.round(8 + 50 * v / Math.max(mx, 1e-9))}%, var(--surface));${a === sa && b === sb ? "outline:2px solid var(--text);" : ""}` }, fmtv(v));
          td.addEventListener("click", () => { this.sel = [a, b]; this.render(); });
          return td;
        }))));
        return h("div", { class: "panel" }, h("div", { class: "panel-title" }, title), h("div", { class: "panel-body", style: "overflow-x:auto" }, t));
      };
      this.maps.append(mk("上值 L̄*（10.110）：P1 先亮出动作", V.Up, "--accent", (v) => String(v)),
        mk("下值 L̲*（10.111）：P2 先亮出动作", V.Lo, "--c-alive2", (v) => String(v)),
        mk("随机化值 𝓛*（10.113）", V.Ra, "--warn", (v) => v.toFixed(2)));
      // 选中状态在第一个阶段（剩 K 个阶段）的 3×3 矩阵
      const last = this.hist[this.hist.length - 1];
      const M = this.mat(sa, sb, last.Ra), names = ["−1", "0", "+1"];
      const T = matrixTable(M, names, names, { fmtCell: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)) });
      this.detail.innerHTML = "";
      this.detail.append(h("div", { html: `状态 x = (${sa}, ${sb})，剩 ${this.K} 个阶段。下表是 (10.113) 里要解的矩阵博弈：l(x, u, v) + 𝓛*_{k+1}(f(x, u, v))，行 = P1 的 u，列 = P2 的 v。` }), T.el,
        h("div", { html: `确定性上 / 下值 ${C.fmt(T.dv.upper, 2)} / ${C.fmt(T.dv.lower, 2)}；随机化值 ${T.mg.value.toFixed(3)}。` +
          (T.sad ? " 有确定性鞍点。" : " <b>没有确定性鞍点</b>：两人同时出手时都要随机化（例如两人在同一格时就是「石头剪刀布」式的猜测）。") +
          ` 上值永远等于 K：只要 P2 先看到 P1 的动作，它总能躲开。` }));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='game-tree']").forEach((el) => el._w = new GameTree(el));
    document.querySelectorAll("[data-widget='info-models']").forEach((el) => el._w = new InfoModels(el));
    document.querySelectorAll("[data-widget='nature-game']").forEach((el) => el._w = new NatureGame(el));
    document.querySelectorAll("[data-widget='corridor-chase']").forEach((el) => el._w = new CorridorChase(el));
  });
})();
