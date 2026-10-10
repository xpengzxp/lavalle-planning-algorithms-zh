/* 2.3 值迭代实验室：五状态例子（图 2.8）与习题 1（图 2.21） */
(function () {
  "use strict";
  const { h, s, arrowDefs, onThemeChange, fmt, INF } = PA;

  const PROBLEMS = {
    fig28: {
      name: "图 2.8（例 2.3–2.5）",
      X: ["a", "b", "c", "d", "e"],
      E: [["a", "a", 2], ["a", "b", 2], ["b", "c", 1], ["b", "d", 4], ["c", "d", 1], ["c", "a", 1], ["d", "c", 1], ["d", "e", 1]],
      xI: "a", goal: "d", xIvar: "b", K: 4,
    },
    fig221: {
      name: "图 2.21（习题 1：x_I = a，X_G = {e}）",
      X: ["a", "b", "c", "d", "e"],
      E: [["a", "b", 2], ["b", "a", 1], ["b", "c", 4], ["c", "d", 3], ["d", "c", 1], ["c", "e", 7], ["d", "e", 1], ["d", "d", 1]],
      xI: "a", goal: "e", xIvar: "a", K: 4,
      answer: { G: { a: 10, b: 8, c: 4, d: 1, e: 0 }, C: { a: 0, b: 2, c: 6, d: 9, e: 10 } },
    },
    lc: {
      name: "标号修正演示（自编小例子，非书中）",
      X: ["a", "b", "c", "d", "e"],
      // a→d 的直达边很贵，且排在前面：FIFO 会先用贵的代价处理 d，之后 d 必须「复活」
      E: [["a", "d", 5], ["a", "b", 1], ["b", "c", 1], ["c", "d", 1], ["d", "e", 1]],
      xI: "a", goal: "e", xIvar: "a", K: 4,
    },
  };

  const MODES = {
    bfix: { name: "固定 K · 反向", hint: "Example 2.3 / 图 2.9：从 G*<sub>F</sub> = l<sub>F</sub> 开始，用 (2.11) 一层层往回算。" },
    ffix: { name: "固定 K · 正向", hint: "Example 2.4 / 图 2.12：从 C*<sub>1</sub> = l<sub>I</sub> 开始，用 (2.16) 一层层往前算。" },
    bvar: { name: "不定长 · 反向", hint: "Example 2.5 / 图 2.14：每个状态多了一个终止动作 u<sub>T</sub>（虚线，代价 0），一直迭代到平稳。" },
    fvar: { name: "不定长 · 正向", hint: "Example 2.5 / 图 2.15：正向版本加上 u<sub>T</sub>，迭代到平稳得到 C*。" },
    dijk: { name: "Dijkstra / 标号修正", hint: "2.3.3 节 / 图 2.16：只在「有意思」的状态上做更新，而不是每轮扫遍整个 X。" },
  };

  const sub = (t) => `<sub>${t}</sub>`;
  const val = (v) => (v === INF ? "∞" : fmt(v));

  class VILab {
    constructor(root) {
      this.root = root;
      this.pid = root.dataset.problem || "fig28";
      this.mode = root.dataset.mode || "bfix";
      this.shown = 0;
      this.sel = null;
      this.plan = null;
      this.qOrder = "cost";
      this.build();
      this.recompute();
      onThemeChange(() => this.render());
    }
    get P() { return PROBLEMS[this.pid]; }

    // ---------------- 计算 ----------------
    recompute() {
      this.shown = 0; this.sel = null; this.plan = null;
      if (this.mode === "dijk") { this.initDijkstra(); this.render(); return; }
      const P = this.P, X = P.X;
      const rows = [];
      const out = (x) => P.E.filter((e) => e[0] === x);
      const inn = (x) => P.E.filter((e) => e[1] === x);
      const variable = this.mode === "bvar" || this.mode === "fvar";
      const backward = this.mode === "bfix" || this.mode === "bvar";
      const goal = P.goal;
      const xI = this.mode === "fvar" ? P.xIvar : P.xI;
      this.xIused = xI;

      const mkRow = (label, prev) => {
        const vals = {}, det = {};
        for (const x of X) {
          const cands = [];
          if (backward) {
            for (const [, to, l] of out(x)) cands.push({ from: x, to, l, base: prev[to], total: l + prev[to] });
            if (variable) cands.push({ from: x, to: x, l: 0, base: prev[x], total: prev[x], isT: true });
          } else {
            for (const [from, , l] of inn(x)) cands.push({ from, to: x, l, base: prev[from], total: prev[from] + l });
            if (variable) cands.push({ from: x, to: x, l: 0, base: prev[x], total: prev[x], isT: true });
          }
          const m = Math.min(INF, ...cands.map((c) => c.total));
          vals[x] = m;
          det[x] = { cands, best: m < INF ? cands.map((c, i) => (c.total === m ? i : -1)).filter((i) => i >= 0) : [] };
        }
        return { label, vals, det };
      };

      if (this.mode === "bfix") {
        const F = P.K + 1;
        const base = {}; for (const x of X) base[x] = x === goal ? 0 : INF;
        rows.push({ label: `G*${sub(F)}`, vals: base, det: null, stage: F, init: "l<sub>F</sub>" });
        for (let k = P.K; k >= 1; k--) {
          const r = mkRow(`G*${sub(k)}`, rows[rows.length - 1].vals);
          r.stage = k; r.prevLabel = `G*${sub(k + 1)}`; rows.push(r);
        }
        this.cols = Array.from({ length: F }, (_, i) => ({ label: `k=${i + 1}` }));
        rows.forEach((r) => { r.col = r.stage - 1; });
      } else if (this.mode === "ffix") {
        const F = P.K + 1;
        const base = {}; for (const x of X) base[x] = x === xI ? 0 : INF;
        rows.push({ label: `C*${sub(1)}`, vals: base, det: null, stage: 1, init: "l<sub>I</sub>" });
        for (let k = 2; k <= F; k++) {
          const r = mkRow(`C*${sub(k)}`, rows[rows.length - 1].vals);
          r.stage = k; r.prevLabel = `C*${sub(k - 1)}`; rows.push(r);
        }
        this.cols = Array.from({ length: F }, (_, i) => ({ label: `k=${i + 1}` }));
        rows.forEach((r) => { r.col = r.stage - 1; });
      } else {
        const base = {};
        for (const x of X) base[x] = backward ? (x === goal ? 0 : INF) : (x === xI ? 0 : INF);
        const sym = backward ? "G*" : "C*";
        rows.push({ label: backward ? `G*${sub(0)}` : `C*${sub(1)}`, vals: base, det: null, init: backward ? "l<sub>F</sub>" : "l<sub>I</sub>" });
        for (let i = 1; i < 30; i++) {
          const prev = rows[rows.length - 1];
          const r = mkRow(backward ? `G*${sub("−" + i)}` : `C*${sub(i + 1)}`, prev.vals);
          r.prevLabel = prev.label;
          rows.push(r);
          if (X.every((x) => r.vals[x] === prev.vals[x])) { r.stationary = true; break; }
        }
        const last = rows[rows.length - 1];
        rows.push({ label: sym, vals: last.vals, det: null, summary: true });
        const n = rows.length - 1;
        this.cols = Array.from({ length: n }, (_, i) => ({ label: backward ? (i === n - 1 ? "0" : `−${n - 1 - i}`) : `${i + 1}` }));
        rows.forEach((r, i) => { if (!r.summary) r.col = backward ? n - 1 - i : i; });
      }
      this.rows = rows;
      this.backward = backward;
      this.variable = variable;
      this.render();
    }

    // ---------------- Dijkstra / 标号修正（图 2.16） ----------------
    initDijkstra() {
      const P = this.P;
      const D = this.D = { C: {}, parent: {}, Q: [], seq: 0, pops: 0, checks: 0, updates: 0, revived: 0, log: [], done: false, popped: new Set(), inQ: new Set(), current: null, lines: [1, 2] };
      for (const x of P.X) { D.C[x] = INF; D.parent[x] = null; }
      D.C[P.xI] = 0;
      D.Q.push({ x: P.xI, seq: D.seq++ }); D.inQ.add(P.xI);
      D.log.push(`初始化：C(${P.xI}) = 0，其余为 ∞；Q = {${P.xI}}。目标 x<sub>G</sub> = ${P.goal}。`);
    }

    dijkstraStep() {
      const P = this.P, D = this.D;
      if (D.done) return;
      if (!D.Q.length) {
        D.done = true; D.current = null; D.lines = [3];
        D.log.push(`Q 空，结束。C(${P.goal}) = ${val(D.C[P.goal])} 就是最优代价。`);
        return;
      }
      // Q.GetFirst()：不同排序方式
      let bi = 0;
      const key = (e) => (this.qOrder === "cost" ? D.C[e.x] : this.qOrder === "fifo" ? e.seq : -e.seq);
      for (let i = 1; i < D.Q.length; i++) {
        const a = D.Q[i], b = D.Q[bi];
        if (key(a) < key(b) || (key(a) === key(b) && a.seq < b.seq)) bi = i;
      }
      const x = D.Q.splice(bi, 1)[0].x;
      D.inQ.delete(x); D.popped.add(x); D.pops++; D.current = x;
      const msgs = [];
      for (const [from, to, l] of P.E) {
        if (from !== x) continue;
        D.checks++;
        const nc = D.C[x] + l, oldTo = D.C[to], oldG = D.C[P.goal], bound = Math.min(oldTo, oldG);
        if (nc < bound) {
          D.C[to] = nc; D.parent[to] = x; D.updates++;
          let ins = "";
          if (to !== P.goal) {
            if (!D.inQ.has(to)) {
              D.Q.push({ x: to, seq: D.seq++ }); D.inQ.add(to);
              if (D.popped.has(to)) { D.revived++; ins = "，<b>重新插入 Q——它又「活」了</b>"; } else ins = "，插入 Q";
            }
            else ins = "（已在 Q 中）";
          } else ins = "（x<sub>G</sub> 不进 Q）";
          msgs.push(`${x}→${to}：${val(D.C[x])}+${l} = ${nc} &lt; min{C(${to})=${val(oldTo)}, C(x<sub>G</sub>)=${val(oldG)}} → C(${to}) = ${nc}${ins}`);
        } else {
          msgs.push(`<span class="muted">${x}→${to}：${val(D.C[x])}+${l} = ${val(nc)}，不小于 ${val(bound)}，跳过</span>`);
        }
      }
      D.lines = [4, 5, 6, 7, 8, 9, 10];
      D.log.push(`<b>取出 ${x}</b>（C = ${val(D.C[x])}）<br>` + (msgs.length ? msgs.join("<br>") : "没有出边。"));
    }

    // ---------------- 界面 ----------------
    build() {
      const probSel = h("select", { "aria-label": "问题" }, Object.entries(PROBLEMS).map(([k, p]) => h("option", { value: k, selected: k === this.pid }, p.name)));
      probSel.addEventListener("change", () => { this.pid = probSel.value; this.recompute(); });
      this.modeSeg = h("div", { class: "seg", role: "group" });
      Object.entries(MODES).forEach(([k, m]) => {
        const b = h("button", { type: "button", class: k === this.mode ? "on" : "" }, m.name);
        b.addEventListener("click", () => { this.mode = k; this.modeSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); this.recompute(); });
        this.modeSeg.append(b);
      });
      this.btnReset = h("button", { class: "btn", type: "button" }, "重置");
      this.btnBack = h("button", { class: "btn", type: "button" }, "◀ 上一步");
      this.btnNext = h("button", { class: "btn primary", type: "button" }, "下一次迭代 ▶");
      this.btnAll = h("button", { class: "btn", type: "button" }, "全部算完 ⏭");
      this.btnReset.addEventListener("click", () => this.recompute());
      this.btnBack.addEventListener("click", () => { if (this.mode === "dijk") return; this.shown = Math.max(0, this.shown - 1); this.sel = null; this.plan = null; this.render(); });
      this.btnNext.addEventListener("click", () => this.next());
      this.btnAll.addEventListener("click", () => {
        if (this.mode === "dijk") { let g = 0; while (!this.D.done && g++ < 100) this.dijkstraStep(); }
        else this.shown = this.rows.length;
        this.render();
      });
      this.qSel = h("select", { "aria-label": "Q 排序" },
        h("option", { value: "cost" }, "按 C(x)：Dijkstra"), h("option", { value: "fifo" }, "FIFO：标号修正（BFS 顺序）"), h("option", { value: "lifo" }, "LIFO：标号修正（DFS 顺序）"));
      this.qSel.addEventListener("change", () => { this.qOrder = this.qSel.value; this.recompute(); });
      this.qLabel = h("label", { class: "hidden" }, "Q 排序：", this.qSel);

      this.hint = h("div", { class: "small muted", style: "margin:-4px 0 10px" });
      this.graphHost = h("div", { class: "svg-wrap" });
      this.trellisHost = h("div", { class: "svg-wrap" });
      this.explain = h("div", { class: "panel-body", style: "min-height:120px" });
      this.tableHost = h("div", { class: "table-wrap" });
      this.planHost = h("div");
      this.exerciseHost = h("div");
      this.dijkHost = h("div", { class: "hidden" });
      this.viHost = h("div", null,
        h("div", { class: "lab-grid" },
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "阶段图（trellis）：横轴是阶段 k，纵轴是状态。点任意圆圈看它是怎么算出来的"), this.trellisHost),
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "这个数是怎么来的"), this.explain)),
        this.tableHost, this.planHost);

      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "值迭代实验室"), h("span", { class: "w-sub" }, "动态规划原理：最优计划的一部分本身也是最优的"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" },
          h("div", { class: "controls" }, h("label", null, "问题：", probSel), this.qLabel),
          h("div", { class: "controls" }, this.modeSeg),
          this.hint,
          h("div", { class: "controls" }, this.btnReset, this.btnBack, this.btnNext, this.btnAll, this.statusEl = h("span", { class: "small muted" })),
          h("div", { class: "panel", style: "margin-bottom:12px" }, h("div", { class: "panel-title" }, "状态转移图：边上的数字是 l(x,u)"), this.graphHost),
          this.viHost, this.dijkHost, this.exerciseHost));
    }

    next() {
      if (this.mode === "dijk") { this.dijkstraStep(); this.render(); return; }
      if (this.shown < this.rows.length) { this.shown++; this.sel = null; this.plan = null; }
      this.render();
    }

    render() {
      const isD = this.mode === "dijk";
      this.hint.innerHTML = MODES[this.mode].hint;
      this.viHost.classList.toggle("hidden", isD);
      this.dijkHost.classList.toggle("hidden", !isD);
      this.qLabel.classList.toggle("hidden", !isD);
      this.btnBack.disabled = isD || this.shown === 0;
      if (isD) {
        this.btnNext.textContent = "取出下一个 ▶";
        this.btnNext.disabled = this.D.done;
        this.statusEl.innerHTML = this.D.done ? "已结束" : `x<sub>I</sub> = ${this.P.xI}，x<sub>G</sub> = ${this.P.goal}`;
      } else {
        this.btnNext.textContent = this.shown === 0 ? "初始化 ▶" : "下一次迭代 ▶";
        this.btnNext.disabled = this.shown >= this.rows.length;
        const tail = this.shown >= this.rows.length ? (this.variable ? "已平稳 (stationary) ✓" : "全部算完 ✓") : "";
        const who = this.backward ? `X<sub>G</sub> = {${this.P.goal}}` : `x<sub>I</sub> = ${this.xIused}`;
        this.statusEl.innerHTML = `${who}${this.variable ? "" : `，K = ${this.P.K}`} · 已算 ${this.shown}/${this.rows.length} 行 ${tail}`;
      }
      this.renderGraph();
      if (isD) this.renderDijkstra();
      else { this.renderTrellis(); this.renderExplain(); this.renderTable(); this.renderPlan(); }
      this.renderExercise();
    }

    // ---------------- 状态转移图 ----------------
    nodePos(i) { return { x: 100 + i * 118, y: 100 }; }

    edgeGeom(e) {
      const X = this.P.X;
      const i = X.indexOf(e[0]), j = X.indexOf(e[1]);
      const a = this.nodePos(i), b = this.nodePos(j), R = 17;
      if (i === j) {
        if (i === 0) return { d: `M${a.x - 13},${a.y - 11} C${a.x - 70},${a.y - 45} ${a.x - 70},${a.y + 45} ${a.x - 13},${a.y + 11}`, lx: a.x - 64, ly: a.y + 5 };
        return { d: `M${a.x + 11},${a.y + 13} C${a.x + 45},${a.y + 70} ${a.x - 45},${a.y + 70} ${a.x - 11},${a.y + 13}`, lx: a.x, ly: a.y + 70 };
      }
      const span = Math.abs(j - i);
      const up = j > i;
      const hgt = (up ? -1 : 1) * (24 + 20 * (span - 1));
      const cx = (a.x + b.x) / 2, cy = a.y + hgt * 2;
      const trim = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy); return { x: p.x + (dx / L) * R, y: p.y + (dy / L) * R }; };
      const p0 = trim(a, { x: cx, y: cy }), p2 = trim(b, { x: cx, y: cy });
      const mx = 0.25 * p0.x + 0.5 * cx + 0.25 * p2.x, my = 0.25 * p0.y + 0.5 * cy + 0.25 * p2.y;
      return { d: `M${p0.x},${p0.y} Q${cx},${cy} ${p2.x},${p2.y}`, lx: mx, ly: my + (up ? -7 : 16) };
    }

    renderGraph() {
      const P = this.P;
      const svg = s("svg", { viewBox: "0 0 640 200", role: "img", "aria-label": "五状态的状态转移图" });
      arrowDefs(svg, { "vi-arr": "var(--muted)", "vi-arr-hl": "var(--c-path)", "vi-arr-c": "var(--c-alive)" });
      const hl = this.graphHighlights();
      for (const e of P.E) {
        const g = this.edgeGeom(e);
        const key = e[0] + ">" + e[1];
        const kind = hl.edges.get(key);
        const color = kind === "best" ? "var(--c-path)" : kind === "cand" ? "var(--c-alive)" : "var(--muted)";
        svg.append(s("path", { d: g.d, fill: "none", stroke: color, "stroke-width": kind ? 2.6 : 1.4, "marker-end": `url(#${kind === "best" ? "vi-arr-hl" : kind === "cand" ? "vi-arr-c" : "vi-arr"})` }));
        svg.append(s("text", { x: g.lx, y: g.ly, "text-anchor": "middle", "font-size": 14, fill: kind ? color : "var(--text-2)", "font-weight": kind ? 700 : 400 }, e[2]));
      }
      P.X.forEach((x, i) => {
        const p = this.nodePos(i);
        const st = hl.nodes.get(x);
        let fill = "var(--surface)", stroke = "var(--border-strong)";
        if (st === "alive") fill = "var(--c-alive)";
        else if (st === "dead") fill = "var(--c-dead)";
        else if (st === "sel") { stroke = "var(--c-current)"; }
        else if (st === "path") { fill = "var(--ok-soft)"; stroke = "var(--c-path)"; }
        const isGoal = (this.mode === "fvar") ? false : x === P.goal;
        const isStart = (this.mode === "bfix" || this.mode === "bvar") ? false : x === (this.mode === "fvar" ? P.xIvar : P.xI);
        svg.append(s("circle", { cx: p.x, cy: p.y, r: 17, fill, stroke, "stroke-width": st === "sel" ? 3 : 1.6 }));
        if (isGoal) svg.append(s("circle", { cx: p.x, cy: p.y, r: 21, fill: "none", stroke: "var(--c-goal)", "stroke-width": 1.5 }));
        svg.append(s("text", { x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": 16, "font-style": "italic", fill: "var(--text)" }, x));
        if (isStart) svg.append(s("text", { x: p.x, y: p.y + 40, "text-anchor": "middle", "font-size": 12, fill: "var(--c-start)" }, "x_I"));
        if (isGoal) svg.append(s("text", { x: p.x, y: p.y + 40, "text-anchor": "middle", "font-size": 12, fill: "var(--c-goal)" }, "X_G"));
        if (hl.labels && hl.labels[x] !== undefined) svg.append(s("text", { x: p.x, y: p.y - 26, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--accent-text)" }, hl.labels[x]));
      });
      this.graphHost.innerHTML = "";
      this.graphHost.append(svg);
    }

    graphHighlights() {
      const edges = new Map(), nodes = new Map();
      let labels = null;
      if (this.mode === "dijk") {
        const D = this.D;
        labels = {};
        for (const x of this.P.X) {
          labels[x] = "C=" + val(D.C[x]);
          if (D.inQ.has(x)) nodes.set(x, "alive");
          else if (D.popped.has(x)) nodes.set(x, "dead");
        }
        for (const x of this.P.X) if (D.parent[x]) edges.set(D.parent[x] + ">" + x, "best");
        return { edges, nodes, labels };
      }
      if (this.plan) {
        for (let i = 1; i < this.plan.length; i++) edges.set(this.plan[i - 1] + ">" + this.plan[i], "best");
        this.plan.forEach((x) => nodes.set(x, "path"));
      } else if (this.sel) {
        const r = this.rows[this.sel.row];
        if (r.det) {
          const d = r.det[this.sel.x];
          d.cands.forEach((c, i) => { if (!c.isT) edges.set(c.from + ">" + c.to, d.best.includes(i) ? "best" : "cand"); });
        }
        nodes.set(this.sel.x, "sel");
      }
      return { edges, nodes, labels };
    }

    // ---------------- 阶段图 trellis ----------------
    renderTrellis() {
      const P = this.P, X = P.X, ncol = this.cols.length;
      const gap = ncol > 5 ? 100 : 118;
      const W = 90 + gap * (ncol - 1) + 50, H = 300;
      const pos = (c, i) => ({ x: 70 + c * gap, y: 50 + i * 52 });
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "阶段图" });
      arrowDefs(svg, { "tr-arr": "var(--border-strong)" });
      // 哪些列已经算出来了
      const colRow = new Map();
      this.rows.slice(0, this.shown).forEach((r, i) => { if (!r.summary) colRow.set(r.col, i); });
      const newestRow = this.shown > 0 ? this.rows[this.shown - 1] : null;

      // 最优边与选中格子的候选边
      const best = new Set(), cand = new Map();
      for (const [col, ri] of colRow) {
        const r = this.rows[ri];
        if (!r.det) continue;
        const fromCol = this.backward ? col : col - 1;
        for (const x of X) r.det[x].best.forEach((bi) => { const c = r.det[x].cands[bi]; best.add(`${fromCol}|${c.from}|${c.to}`); });
      }
      if (this.sel) {
        const r = this.rows[this.sel.row];
        if (r.det && r.col !== undefined) {
          const fromCol = this.backward ? r.col : r.col - 1;
          const d = r.det[this.sel.x];
          d.cands.forEach((c, i) => cand.set(`${fromCol}|${c.from}|${c.to}`, { best: d.best.includes(i), l: c.l }));
        }
      }
      // 列标题
      this.cols.forEach((c, ci) => {
        const p = pos(ci, 0);
        const filled = colRow.has(ci);
        svg.append(s("text", { x: p.x, y: 20, "text-anchor": "middle", "font-size": 12.5, fill: filled ? "var(--text)" : "var(--muted)", "font-weight": filled ? 600 : 400 }, this.variable && this.backward ? `阶段 ${c.label}` : c.label));
      });
      X.forEach((x, i) => svg.append(s("text", { x: 22, y: pos(0, i).y + 5, "text-anchor": "middle", "font-size": 15, "font-style": "italic", fill: "var(--text-2)" }, x)));
      // 边
      for (let c = 0; c < ncol - 1; c++) {
        const list = P.E.map((e) => ({ from: e[0], to: e[1], l: e[2] }));
        if (this.variable) X.forEach((x) => list.push({ from: x, to: x, l: 0, isT: true }));
        for (const e of list) {
          const a = pos(c, X.indexOf(e.from)), b = pos(c + 1, X.indexOf(e.to));
          const key = `${c}|${e.from}|${e.to}`;
          const cd = cand.get(key);
          const isBest = best.has(key);
          let stroke = "var(--border)", w = 1, dash = e.isT ? "4 4" : null, op = 1;
          if (isBest) { stroke = "var(--c-path)"; w = 2.2; op = this.sel ? 0.35 : 1; }
          if (cd) { stroke = cd.best ? "var(--c-path)" : "var(--c-alive)"; w = cd.best ? 3.2 : 2.2; op = 1; }
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), R = 16;
          svg.append(s("line", { x1: a.x + (dx / L) * R, y1: a.y + (dy / L) * R, x2: b.x - (dx / L) * R, y2: b.y - (dy / L) * R, stroke, "stroke-width": w, "stroke-dasharray": dash, opacity: op }));
          if (cd) {
            const t = 0.42;
            svg.append(s("rect", { x: a.x + dx * t - 9, y: a.y + dy * t - 9, width: 18, height: 16, rx: 4, fill: "var(--surface)", stroke }));
            svg.append(s("text", { x: a.x + dx * t, y: a.y + dy * t + 3.5, "text-anchor": "middle", "font-size": 11.5, "font-weight": 700, fill: "var(--text)" }, e.l));
          }
        }
      }
      // 节点
      for (let c = 0; c < ncol; c++) {
        X.forEach((x, i) => {
          const p = pos(c, i);
          const ri = colRow.get(c);
          const filled = ri !== undefined;
          const v = filled ? this.rows[ri].vals[x] : null;
          const isSel = this.sel && filled && this.sel.row === ri && this.sel.x === x;
          const isNew = filled && newestRow && this.rows[ri] === newestRow;
          const g = s("g", { style: filled ? "cursor:pointer" : null });
          g.append(s("circle", {
            cx: p.x, cy: p.y, r: 16,
            fill: filled ? (v === INF ? "var(--surface-2)" : "var(--surface)") : "var(--surface-2)",
            stroke: isSel ? "var(--c-current)" : isNew ? "var(--accent)" : filled ? "var(--border-strong)" : "var(--border)",
            "stroke-width": isSel ? 3 : isNew ? 2.2 : 1.2, "stroke-dasharray": filled ? null : "3 3",
          }));
          if (filled) g.append(s("text", { x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: v === INF ? "var(--muted)" : "var(--text)" }, val(v)));
          if (filled) g.addEventListener("click", () => { this.sel = { row: ri, x }; this.plan = null; this.render(); });
          svg.append(g);
        });
      }
      this.trellisHost.innerHTML = "";
      this.trellisHost.append(svg);
    }

    renderExplain() {
      const ex = this.explain;
      ex.innerHTML = "";
      if (!this.sel) {
        const eq = this.backward
          ? (this.variable ? "G*<sub>k</sub>(x) = min{ l(x,u) + G*<sub>k+1</sub>(f(x,u)) }，u 取遍 U(x) ∪ {u<sub>T</sub>}" : "G*<sub>k</sub>(x<sub>k</sub>) = min<sub>u<sub>k</sub></sub> { l(x<sub>k</sub>,u<sub>k</sub>) + G*<sub>k+1</sub>(x<sub>k+1</sub>) }　(2.11)")
          : (this.variable ? "C*<sub>k</sub>(x) = min{ C*<sub>k−1</sub>(x<sub>prev</sub>) + l(x<sub>prev</sub>,u) }，包括 u<sub>T</sub>（停在 x）" : "C*<sub>k</sub>(x<sub>k</sub>) = min<sub>u<sup>−1</sup></sub> { C*<sub>k−1</sub>(x<sub>k−1</sub>) + l(x<sub>k−1</sub>,u<sub>k−1</sub>) }　(2.16)");
        ex.append(h("div", { class: "mono", style: "font-size:13px;line-height:1.7", html: eq }),
          h("p", { class: "small muted" }, this.shown === 0 ? "点「初始化」开始。" : "点阶段图里任意一个已算出的圆圈，这里会展开对应的 min{…}；绿色是取到最小值的那一项。"));
        return;
      }
      const r = this.rows[this.sel.row], x = this.sel.x;
      if (!r.det) {
        const isGoal = this.backward ? x === this.P.goal : x === this.xIused;
        ex.append(h("div", { class: "mono", html: `${r.label}(${x}) = ${r.init}(${x}) = <b>${val(r.vals[x])}</b>` }),
          h("p", { class: "small muted" }, this.backward
            ? (isGoal ? "x ∈ X_G，最终阶段代价为 0。" : "x ∉ X_G：l_F = ∞，把没到达目标的计划「罚」成不可行。")
            : (isGoal ? "x = x_I，从这里出发不花代价。" : "x ≠ x_I：l_I = ∞，不从 x_I 出发的计划一律淘汰。")));
        return;
      }
      const d = r.det[x];
      const lines = d.cands.map((c, i) => {
        const isB = d.best.includes(i);
        let txt;
        if (this.backward) {
          txt = c.isT ? `u<sub>T</sub>（停在 ${x}）: 0 + ${r.prevLabel}(${x}) = 0 + ${val(c.base)}` : `${x}→${c.to}: l = ${c.l}，+ ${r.prevLabel}(${c.to}) = ${c.l} + ${val(c.base)}`;
        } else {
          txt = c.isT ? `u<sub>T</sub>（之前已停在 ${x}）: ${r.prevLabel}(${x}) + 0 = ${val(c.base)} + 0` : `${c.from}→${x}: ${r.prevLabel}(${c.from}) + l = ${val(c.base)} + ${c.l}`;
        }
        return h("div", { class: "mono", style: `padding:2px 6px;border-radius:4px;${isB ? "background:var(--ok-soft);color:var(--ok);font-weight:600" : ""}`, html: `${txt} = ${val(c.total)}` });
      });
      ex.append(h("div", { style: "margin-bottom:6px", html: `<b>${r.label}(${x})</b> = min{ … } = <b>${val(r.vals[x])}</b>` }));
      if (!lines.length) ex.append(h("div", { class: "small muted" }, this.backward ? `${x} 没有出边（U(${x}) 为空），只能是 ∞。` : `没有边进入 ${x}，只能是 ∞。`));
      lines.forEach((l) => ex.append(l));
      if (r.vals[x] === INF && lines.length) ex.append(h("p", { class: "small muted" }, this.backward ? "所有候选都是 ∞：从这里在剩下的阶段内到不了 X_G。" : "所有候选都是 ∞：从 x_I 出发在这么多步内到不了这里。"));
    }

    renderTable() {
      const X = this.P.X;
      const t = h("table", { class: "data" });
      t.append(h("thead", null, h("tr", null, h("th", null, ""), X.map((x) => h("th", { class: "c", style: "font-style:italic" }, x)))));
      const tb = h("tbody");
      this.rows.forEach((r, ri) => {
        const visible = ri < this.shown;
        const tr = h("tr", { style: r.summary ? "border-top:2px solid var(--border-strong)" : null });
        tr.append(h("th", { html: r.label + (r.stationary ? ' <span class="tag green">平稳</span>' : "") }));
        X.forEach((x) => {
          const td = h("td", { class: "c mono", style: visible && !r.summary && r.det ? "cursor:pointer" : null }, visible ? val(r.vals[x]) : "");
          if (this.sel && this.sel.row === ri && this.sel.x === x) td.style.background = "var(--warn-soft)";
          if (visible && !r.summary) td.addEventListener("click", () => { this.sel = { row: ri, x }; this.plan = null; this.render(); });
          tr.append(td);
        });
        tb.append(tr);
      });
      t.append(tb);
      this.tableHost.innerHTML = "";
      this.tableHost.append(h("div", { class: "small muted", style: "margin:10px 0 4px" }, "和书里的表对照（行按计算顺序排列；点格子也能看计算过程）："), t);
    }

    renderPlan() {
      const host = this.planHost;
      host.innerHTML = "";
      if (this.shown < this.rows.length) return;
      const P = this.P, X = P.X;
      const sel = h("select", { "aria-label": "选择状态" }, X.map((x) => h("option", { value: x }, x)));
      sel.value = this.backward ? (this.variable ? P.xI : P.xI) : P.goal;
      const out = h("span", { class: "small" });
      const btn = h("button", { class: "btn small", type: "button" }, this.backward ? "用 (2.19) 提取最优计划" : "用 (2.20) 回溯最优计划");
      btn.addEventListener("click", () => {
        const res = this.backward ? this.extractBackward(sel.value) : this.extractForward(sel.value);
        if (!res) { this.plan = null; out.innerHTML = `<span class="no">没有可行计划（代价 ∞）。</span>`; this.renderGraph(); return; }
        this.plan = res.path; this.sel = null;
        this.renderGraph(); this.renderTrellis(); this.renderExplain();
        out.innerHTML = `计划：<b>${res.path.join(" → ")}</b>，总代价 ${res.cost}${res.note ? "　" + res.note : ""}`;
      });
      host.append(h("div", { class: "controls", style: "margin-top:12px" },
        h("label", null, this.backward ? "从状态" : "到状态", sel), btn, out));
    }

    extractBackward(x) {
      const P = this.P;
      const step = (y, G) => {
        const opts = P.E.filter((e) => e[0] === y).map((e) => ({ to: e[1], v: e[2] + G[e[1]], l: e[2] }));
        if (!opts.length) return null;
        return opts.reduce((a, b) => (b.v < a.v ? b : a));
      };
      if (this.variable) {
        const G = this.rows[this.rows.length - 1].vals;
        if (G[x] === INF) return null;
        const path = [x]; let cost = 0, y = x, guard = 0;
        while (y !== P.goal && guard++ < 50) { const o = step(y, G); cost += o.l; y = o.to; path.push(y); }
        return { path, cost, note: "（到了 X_G 后执行 u_T）" };
      }
      // 固定长度：第 k 步用 G*_{k+1}
      const byStage = {}; this.rows.forEach((r) => { byStage[r.stage] = r.vals; });
      if (byStage[1][x] === INF) return null;
      const path = [x]; let cost = 0, y = x;
      for (let k = 1; k <= P.K; k++) { const o = step(y, byStage[k + 1]); cost += o.l; y = o.to; path.push(y); }
      return { path, cost, note: `（恰好 ${P.K} 步）` };
    }

    extractForward(x) {
      const P = this.P;
      const back = (y, C) => {
        const opts = P.E.filter((e) => e[1] === y).map((e) => ({ from: e[0], v: C[e[0]] + e[2], l: e[2] }));
        if (!opts.length) return null;
        return opts.reduce((a, b) => (b.v < a.v ? b : a));
      };
      if (this.variable) {
        const C = this.rows[this.rows.length - 1].vals;
        if (C[x] === INF) return null;
        const path = [x]; let y = x, guard = 0;
        while (y !== this.xIused && guard++ < 50) { const o = back(y, C); y = o.from; path.unshift(y); }
        return { path, cost: C[x] };
      }
      const byStage = {}; this.rows.forEach((r) => { byStage[r.stage] = r.vals; });
      const F = P.K + 1;
      if (byStage[F][x] === INF) return null;
      const path = [x]; let y = x;
      for (let k = F; k >= 2; k--) { const o = back(y, byStage[k - 1]); y = o.from; path.unshift(y); }
      return { path, cost: byStage[F][x], note: `（恰好 ${P.K} 步）` };
    }

    // ---------------- Dijkstra 视图 ----------------
    renderDijkstra() {
      const D = this.D, P = this.P;
      const host = this.dijkHost;
      host.innerHTML = "";
      const pseudo = h("div", { class: "pseudo" });
      ["Set C(x) = ∞ for all x ≠ x<sub>I</sub>, and set C(x<sub>I</sub>) = 0", "Q.Insert(x<sub>I</sub>)", "<span class=kw>while</span> Q not empty <span class=kw>do</span>",
        "  x ← Q.GetFirst()", "  <span class=kw>forall</span> u ∈ U(x)", "    x′ ← f(x, u)", "    <span class=kw>if</span> C(x) + l(x,u) &lt; min{C(x′), C(x<sub>G</sub>)} <span class=kw>then</span>",
        "      C(x′) ← C(x) + l(x, u)", "      <span class=kw>if</span> x′ ≠ x<sub>G</sub> <span class=kw>then</span>", "        Q.Insert(x′)"]
        .forEach((t, i) => pseudo.append(h("span", { class: "ln" + (D.lines.includes(i + 1) ? " hl" : ""), html: t })));
      const sorted = D.Q.slice().sort((a, b) => {
        const k = (e) => (this.qOrder === "cost" ? D.C[e.x] : this.qOrder === "fifo" ? e.seq : -e.seq);
        return k(a) - k(b) || a.seq - b.seq;
      });
      const ql = h("ul", { class: "qlist" });
      if (!sorted.length) ql.append(h("li", { class: "more" }, "（空）"));
      sorted.forEach((e) => ql.append(h("li", null, h("span", null, e.x), h("span", { class: "muted" }, "C=" + val(D.C[e.x])))));
      const viRows = this.viCost();
      const stats = h("div", { class: "stats" },
        h("div", { class: "stat" }, h("span", { class: "k" }, "出队次数"), h("span", { class: "v" }, D.pops)),
        h("div", { class: "stat" }, h("span", { class: "k" }, "检查的边"), h("span", { class: "v" }, D.checks)),
        h("div", { class: "stat" }, h("span", { class: "k" }, "C 被改小"), h("span", { class: "v" }, D.updates)),
        h("div", { class: "stat" }, h("span", { class: "k" }, "复活次数"), h("span", { class: "v" }, D.revived)),
        h("div", { class: "stat" }, h("span", { class: "k" }, "对照：正向值迭代的候选计算"), h("span", { class: "v" }, viRows)));
      const log = h("div", { class: "panel-body small", style: "max-height:260px;overflow:auto;line-height:1.6" });
      D.log.slice().reverse().forEach((t, i) => log.append(h("div", { style: `padding:4px 0;${i ? "border-top:1px solid var(--border);opacity:.75" : ""}`, html: t })));
      const legend = h("div", { class: "legend" },
        h("span", null, h("i", { style: "background:var(--surface)" }), "未访问（C=∞）"),
        h("span", null, h("i", { style: "background:var(--c-alive)" }), "活跃：在 Q 中"),
        h("span", null, h("i", { style: "background:var(--c-dead)" }), "死亡：已取出"),
        h("span", null, h("i", { style: "background:var(--c-path)" }), "当前父指针（最优树）"));
      host.append(legend, stats,
        h("div", { class: "panel", style: "margin-bottom:12px" }, h("div", { class: "panel-title" }, "FORWARD LABEL CORRECTING（图 2.16）"), pseudo));
      host.append(...[
        h("div", { class: "split split-31" },
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "过程记录（最新在上）"), log),
          h("div", { class: "panel", style: "align-self:start" }, h("div", { class: "panel-title" }, "Q"), h("div", { class: "panel-body" }, ql))),
        D.done ? h("div", { class: "msg ok" }, `最优代价 C*(${P.goal}) = ${val(D.C[P.goal])}，共出队 ${D.pops} 次。` + (this.qOrder === "cost"
          ? "按 C 排序时每个状态最多出队一次——这就是 Dijkstra。"
          : D.revived
            ? `有 ${D.revived} 次「复活」：某个已经出过队的状态后来找到了更便宜的路径，只好重新入队。多做了些工作，但只要 X 有限，结果仍然最优。`
            : this.pid === "lc" ? "这种排序在这个图上恰好没有复活；换成 FIFO 试试。" : "这一次恰好没有状态被复活（这个图太小了）；把「问题」换成「标号修正演示」再用 FIFO 试试。")) : null,
      ].filter(Boolean));
    }

    viCost() {
      // 正向不定长值迭代：每轮对每个状态计算 (入边数 + 1 个 u_T) 个候选
      const P = this.P;
      const C0 = {}; P.X.forEach((x) => { C0[x] = x === P.xI ? 0 : INF; });
      let prev = C0, iters = 0;
      for (let i = 0; i < 30; i++) {
        const cur = {};
        P.X.forEach((x) => { cur[x] = Math.min(prev[x], ...P.E.filter((e) => e[1] === x).map((e) => prev[e[0]] + e[2])); });
        iters++;
        if (P.X.every((x) => cur[x] === prev[x])) break;
        prev = cur;
      }
      return iters * (P.E.length + P.X.length);
    }

    // ---------------- 习题自测 ----------------
    renderExercise() {
      const host = this.exerciseHost;
      host.innerHTML = "";
      const P = this.P;
      if (!P.answer) return;
      const mk = (kind, title) => {
        const inputs = {};
        const row = h("div", { class: "controls" }, h("span", { class: "small", style: "min-width:120px" }, title));
        P.X.forEach((x) => { const inp = h("input", { type: "text", size: 3, style: "width:52px;text-align:center", placeholder: x, "aria-label": `${kind}(${x})` }); inputs[x] = inp; row.append(h("label", null, h("i", null, x), inp)); });
        const res = h("span", { class: "small" });
        const btn = h("button", { class: "btn small", type: "button" }, "检查");
        btn.addEventListener("click", () => {
          let ok = 0;
          P.X.forEach((x) => {
            const raw = inputs[x].value.trim();
            const v = raw === "∞" || raw.toLowerCase() === "inf" ? INF : Number(raw);
            const right = v === P.answer[kind][x];
            inputs[x].style.borderColor = raw === "" ? "" : right ? "var(--ok)" : "var(--bad)";
            if (right) ok++;
          });
          res.innerHTML = ok === P.X.length ? `<span class="yes">全对！</span>` : `${ok}/${P.X.length} 正确（红框是错的，∞ 可以输入 inf）`;
        });
        row.append(btn, res);
        return row;
      };
      host.append(h("div", { class: "box warn", style: "margin-top:14px" },
        h("div", { class: "box-title" }, "习题 1 自测"),
        h("p", { class: "small", style: "margin:0 0 8px" }, "先在纸上算，再填进来检查。之后可以切换上面的模式，逐步对照每一轮。"),
        mk("G", "(a) 反向：G*（X_G={e}）"), mk("C", "(b) 正向：C*（x_I=a）")));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='vi-lab']").forEach((el) => new VILab(el));
  });
})();
