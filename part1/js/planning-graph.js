/* 2.5.2 规划图（planning graph）：手电筒例子（Example 2.8，图 2.20） */
(function () {
  "use strict";
  const { h, s } = PA;
  const FL = PA.flashlight;

  // 字面量用字符串表示："O" / "¬O" 等
  const neg = (l) => (l.startsWith("¬") ? l.slice(1) : "¬" + l);
  const LIT_ORDER = ["O", "¬O", "I1", "¬I1", "I2", "¬I2"];
  const litLabel = (l) => (l.startsWith("¬") ? "¬" : "") + FL.short[l.replace("¬", "")];
  const REAL = FL.ops.map((o) => ({
    id: o.id, name: o.name,
    pre: o.pre.map(([l, v]) => (v ? l : "¬" + l)),
    eff: o.eff.map(([l, v]) => (v ? l : "¬" + l)),
  }));
  const NOOP = LIT_ORDER.map((l) => ({ id: "noop:" + l, name: "平凡算子(" + litLabel(l) + ")", pre: [l], eff: [l], trivial: true }));
  const ALL_OPS = REAL.concat(NOOP);
  const GOAL = ["O", "I1", "I2"];
  const INIT = ["O", "¬I1", "¬I2"];

  const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  function buildGraph(maxLayers) {
    const L = [new Set(INIT)];
    const litMx = [new Map()];  // 第一层只有互补对才互斥，初始状态里没有互补对
    const O = [], opMx = [];
    for (let i = 0; i < maxLayers; i++) {
      const Li = L[i];
      const Oi = ALL_OPS.filter((o) => o.pre.every((p) => Li.has(p)));
      // 算子互斥
      const om = new Map();
      for (let a = 0; a < Oi.length; a++) for (let b = a + 1; b < Oi.length; b++) {
        const o = Oi[a], q = Oi[b];
        let why = null;
        if (o.eff.some((e) => q.eff.includes(neg(e)))) why = "效果不一致（inconsistent effects）：一个的效果是另一个效果的否定";
        else if (o.eff.some((e) => q.pre.includes(neg(e))) || q.eff.some((e) => o.pre.includes(neg(e)))) why = "干扰（interference）：一个的效果否定了另一个的前提";
        else {
          for (const p of o.pre) for (const r of q.pre) if (litMx[i].has(pairKey(p, r))) { why = `需求冲突（competing needs）：前提 ${litLabel(p)} 与 ${litLabel(r)} 在 L${i + 1} 中互斥`; break; }
        }
        if (why) om.set(pairKey(o.id, q.id), why);
      }
      const Lnext = new Set();
      Oi.forEach((o) => o.eff.forEach((e) => Lnext.add(e)));
      // 字面量互斥
      const lm = new Map();
      const lits = LIT_ORDER.filter((l) => Lnext.has(l));
      for (let a = 0; a < lits.length; a++) for (let b = a + 1; b < lits.length; b++) {
        const l = lits[a], m = lits[b];
        if (neg(l) === m) { lm.set(pairKey(l, m), "互补对（negated literals）"); continue; }
        const A = Oi.filter((o) => o.eff.includes(l)), B = Oi.filter((o) => o.eff.includes(m));
        if (A.some((o) => B.includes(o))) continue;
        const allMx = A.every((o) => B.every((q) => om.has(pairKey(o.id, q.id))));
        if (allMx) lm.set(pairKey(l, m), `支持不一致（inconsistent support）：能产生 ${litLabel(l)} 的算子 {${A.map(opShort).join(", ")}} 与能产生 ${litLabel(m)} 的 {${B.map(opShort).join(", ")}} 两两互斥`);
      }
      O.push(Oi); opMx.push(om); L.push(Lnext); litMx.push(lm);
    }
    return { L, O, litMx, opMx };
  }
  function opShort(o) { return o.trivial ? "noop(" + litLabel(o.pre[0]) + ")" : o.id; }

  function stableAt(G) {
    // 返回第一个 i（0 起）使得 L[i] = L[i-1] 且 O[i] = O[i-1]，即书中的 L_{i+1} = L_i、O_{i+1} = O_i
    for (let i = 1; i < G.O.length; i++) {
      const sameL = G.L[i].size === G.L[i - 1].size && [...G.L[i]].every((l) => G.L[i - 1].has(l));
      const sameO = G.O[i].length === G.O[i - 1].length;
      if (sameL && sameO) return i;
    }
    return -1;
  }

  // 反向 and/or 搜索：在 L[level] 实现 goals
  function extract(G, goals, level) {
    if (level === 0) return goals.every((g) => G.L[0].has(g)) ? [] : null;
    const Oi = G.O[level - 1], om = G.opMx[level - 1];
    const chosen = [];
    const tryGoal = (gi) => {
      if (gi === goals.length) {
        const pre = [...new Set(chosen.flatMap((o) => o.pre))];
        const sub = extract(G, pre, level - 1);
        return sub ? sub.concat([chosen.slice()]) : null;
      }
      const g = goals[gi];
      if (chosen.some((o) => o.eff.includes(g))) return tryGoal(gi + 1);
      // 「或」：先试平凡算子（保持不变），再试真正的算子
      const cands = Oi.filter((o) => o.eff.includes(g)).sort((a, b) => (b.trivial ? 1 : 0) - (a.trivial ? 1 : 0));
      for (const o of cands) {
        if (chosen.some((q) => om.has(pairKey(o.id, q.id)))) continue;
        chosen.push(o);
        const r = tryGoal(gi + 1);
        if (r) return r;
        chosen.pop();
      }
      return null;
    };
    return tryGoal(0);
  }

  class PGLab {
    constructor(root) {
      this.root = root;
      this.G = buildGraph(5);
      this.shownOps = 0;     // 已展开的算子层数
      this.showTrivial = true;
      this.focus = null;     // {kind:'lit'|'op', layer, id}
      this.plan = null;
      this.build();
      this.render();
    }
    build() {
      this.btnNext = h("button", { class: "btn primary", type: "button" }, "扩展一层 ▶");
      this.btnReset = h("button", { class: "btn", type: "button" }, "重置");
      this.btnExtract = h("button", { class: "btn", type: "button" }, "提取计划");
      const triv = h("input", { type: "checkbox", checked: true });
      triv.addEventListener("change", () => { this.showTrivial = triv.checked; this.render(); });
      this.btnNext.addEventListener("click", () => { if (this.shownOps < 3) this.shownOps++; this.plan = null; this.render(); });
      this.btnReset.addEventListener("click", () => { this.shownOps = 0; this.focus = null; this.plan = null; this.render(); });
      this.btnExtract.addEventListener("click", () => this.doExtract());
      this.svgHost = h("div", { class: "svg-wrap" });
      this.side = h("div", { class: "panel-body", style: "min-height:110px" });
      this.msg = h("div", { class: "small" });
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "规划图与互斥关系"), h("span", { class: "w-sub" }, "Example 2.8 · 图 2.20：字面量层 L 与算子层 O 交替"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" },
          h("div", { class: "controls" }, this.btnNext, this.btnReset, this.btnExtract, h("label", null, triv, "显示平凡算子（小圆点）")),
          this.svgHost, this.msg,
          h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "点任意节点：红框 = 与它互斥（mutex）的同层节点"), this.side)));
    }

    layout() {
      const nCols = 2 * this.shownOps + 1;
      const colX = (c) => 70 + c * 112;
      const litY = (l) => 40 + LIT_ORDER.indexOf(l) * 54;
      const realY = { RC: 67, PC: 121, I1: 175, I2: 229 };
      const opPos = (o, layer) => (o.trivial ? { x: colX(2 * layer + 1), y: litY(o.pre[0]) } : { x: colX(2 * layer + 1), y: realY[o.id] });
      return { nCols, colX, litY, opPos, W: colX(nCols - 1) + 80, H: 340 };
    }

    render() {
      const G = this.G, Lay = this.layout();
      const svg = s("svg", { viewBox: `0 0 ${Math.max(Lay.W, 300)} ${Lay.H}`, role: "img", "aria-label": "规划图", style: `min-width:${Math.min(Lay.W, 600)}px` });
      const planIds = new Set();
      const planLits = new Set();
      if (this.plan) this.plan.forEach((A, i) => A.forEach((o) => { planIds.add(i + "|" + o.id); o.pre.forEach((p) => planLits.add(i + "|" + p)); o.eff.forEach((e) => planLits.add(i + 1 + "|" + e)); }));
      // 焦点的互斥集合
      const mxSet = new Set();
      if (this.focus) {
        const f = this.focus;
        const map = f.kind === "lit" ? G.litMx[f.layer] : G.opMx[f.layer];
        for (const k of map.keys()) { const [a, b] = k.split("|"); if (a === f.id) mxSet.add(b); else if (b === f.id) mxSet.add(a); }
      }
      // 列标题
      for (let c = 0; c < Lay.nCols; c++) {
        const isL = c % 2 === 0, idx = Math.floor(c / 2) + 1;
        svg.append(s("text", { x: Lay.colX(c), y: 16, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: isL ? "var(--accent-text)" : "var(--warn)" }, (isL ? "L" : "O") + idx));
      }
      // 边
      for (let i = 0; i < this.shownOps; i++) {
        G.O[i].forEach((o) => {
          if (o.trivial && !this.showTrivial) return;
          const p = Lay.opPos(o, i);
          const onPlan = planIds.has(i + "|" + o.id);
          const focusEdge = this.focus && ((this.focus.kind === "op" && this.focus.layer === i && this.focus.id === o.id));
          const stroke = onPlan ? "var(--c-path)" : focusEdge ? "var(--c-current)" : "var(--border-strong)";
          const w = onPlan ? 2.4 : focusEdge ? 2 : 1;
          o.pre.forEach((l) => {
            const x1 = Lay.colX(2 * i) + 44, y1 = Lay.litY(l);
            svg.append(s("line", { x1, y1, x2: p.x - (o.trivial ? 4 : 20), y2: p.y, stroke, "stroke-width": w, opacity: o.trivial && !onPlan ? 0.6 : 1 }));
          });
          o.eff.forEach((l) => {
            const x2 = Lay.colX(2 * i + 2) - 44, y2 = Lay.litY(l);
            svg.append(s("line", { x1: p.x + (o.trivial ? 4 : 20), y1: p.y, x2, y2, stroke, "stroke-width": w, opacity: o.trivial && !onPlan ? 0.6 : 1, "stroke-dasharray": l.startsWith("¬") && !o.trivial ? "4 3" : null }));
          });
        });
      }
      // 字面量节点
      for (let i = 0; i <= this.shownOps; i++) {
        LIT_ORDER.forEach((l) => {
          if (!G.L[i].has(l)) return;
          const x = Lay.colX(2 * i), y = Lay.litY(l);
          const isFocus = this.focus && this.focus.kind === "lit" && this.focus.layer === i && this.focus.id === l;
          const isMx = this.focus && this.focus.kind === "lit" && this.focus.layer === i && mxSet.has(l);
          const onPlan = planLits.has(i + "|" + l);
          const isGoal = i === this.shownOps && GOAL.includes(l);
          const g = s("g", { style: "cursor:pointer" });
          g.append(s("rect", { x: x - 44, y: y - 13, width: 88, height: 26, rx: 7,
            fill: onPlan ? "var(--ok-soft)" : "var(--surface)",
            stroke: isFocus ? "var(--c-current)" : isMx ? "var(--bad)" : isGoal ? "var(--c-goal)" : "var(--border-strong)",
            "stroke-width": isFocus || isMx ? 2.6 : isGoal ? 1.8 : 1, "stroke-dasharray": isMx ? "5 3" : null }));
          g.append(s("text", { x, y: y + 4.5, "text-anchor": "middle", "font-size": 12, "font-family": "ui-monospace, Menlo, monospace", fill: "var(--text)" }, litLabel(l)));
          g.addEventListener("click", () => { this.focus = { kind: "lit", layer: i, id: l }; this.render(); });
          svg.append(g);
        });
      }
      // 算子节点
      for (let i = 0; i < this.shownOps; i++) {
        G.O[i].forEach((o) => {
          if (o.trivial && !this.showTrivial) return;
          const p = Lay.opPos(o, i);
          const isFocus = this.focus && this.focus.kind === "op" && this.focus.layer === i && this.focus.id === o.id;
          const isMx = this.focus && this.focus.kind === "op" && this.focus.layer === i && mxSet.has(o.id);
          const onPlan = planIds.has(i + "|" + o.id);
          const g = s("g", { style: "cursor:pointer" });
          if (o.trivial) {
            g.append(s("circle", { cx: p.x, cy: p.y, r: isFocus || isMx ? 7 : 5, fill: onPlan ? "var(--c-path)" : "var(--muted)", stroke: isFocus ? "var(--c-current)" : isMx ? "var(--bad)" : "none", "stroke-width": 2.5 }));
          } else {
            g.append(s("rect", { x: p.x - 20, y: p.y - 12, width: 40, height: 24, rx: 5, fill: onPlan ? "var(--c-path)" : "var(--warn-soft)", stroke: isFocus ? "var(--c-current)" : isMx ? "var(--bad)" : "var(--warn)", "stroke-width": isFocus || isMx ? 2.6 : 1.2, "stroke-dasharray": isMx ? "5 3" : null }));
            g.append(s("text", { x: p.x, y: p.y + 4.5, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: onPlan ? "#fff" : "var(--text)" }, o.id));
          }
          g.addEventListener("click", () => { this.focus = { kind: "op", layer: i, id: o.id }; this.render(); });
          svg.append(g);
        });
      }
      this.svgHost.innerHTML = "";
      this.svgHost.append(svg);
      this.renderSide(mxSet);
      this.renderMsg();
    }

    renderSide(mxSet) {
      const G = this.G, f = this.focus;
      this.side.innerHTML = "";
      if (!f) {
        this.side.append(h("p", { class: "small muted", style: "margin:0" }, "RC = RemoveCap，PC = PlaceCap，I1/I2 = Insert(Battery1/2)。虚线效果边表示产生否定字面量。点一个节点看它在本层与谁互斥、为什么。"));
        return;
      }
      const map = f.kind === "lit" ? G.litMx[f.layer] : G.opMx[f.layer];
      const name = f.kind === "lit" ? litLabel(f.id) : (ALL_OPS.find((o) => o.id === f.id) || {}).name;
      const layerName = (f.kind === "lit" ? "L" : "O") + (f.layer + 1);
      this.side.append(h("div", { html: `<b>${name}</b>（${layerName}）` }));
      if (!mxSet.size) { this.side.append(h("div", { class: "small muted" }, "在这一层里不和任何节点互斥。")); return; }
      const ul = h("ul", { class: "small", style: "margin:6px 0 0" });
      for (const other of mxSet) {
        const why = map.get(pairKey(f.id, other));
        const oname = f.kind === "lit" ? litLabel(other) : opShort(ALL_OPS.find((o) => o.id === other));
        ul.append(h("li", { html: `与 <b>${oname}</b> 互斥：${why}` }));
      }
      this.side.append(ul);
    }

    renderMsg() {
      const G = this.G, k = this.shownOps;
      const st = stableAt(G);
      const Lk = G.L[k];
      const lines = [];
      lines.push(`L${k + 1} 中有 ${Lk.size} 个字面量，${G.litMx[k].size} 对互斥。`);
      const missing = GOAL.filter((g) => !Lk.has(g));
      if (missing.length) lines.push(`目标字面量 ${missing.map(litLabel).join("、")} 还没出现。`);
      else {
        const mx = [];
        for (let a = 0; a < GOAL.length; a++) for (let b = a + 1; b < GOAL.length; b++) if (G.litMx[k].has(pairKey(GOAL[a], GOAL[b]))) mx.push(`${litLabel(GOAL[a])} 与 ${litLabel(GOAL[b])}`);
        lines.push(mx.length ? `目标字面量都出现了，但 ${mx.join("；")} 互斥 → 还不能提取计划，继续扩展。` : `<span class="yes">目标字面量都在 L${k + 1} 中且两两不互斥，可以尝试「提取计划」。</span>`);
      }
      if (st >= 0 && k >= st) lines.push(`规划图已稳定：L${st + 1} = L${st}，而且再扩展一层 O${st + 1} 也会和 O${st} 完全一样。`);
      this.btnNext.disabled = k >= 3;
      this.msg.innerHTML = lines.join(" ");
      if (this.planText) this.msg.innerHTML += "<br>" + this.planText;
    }

    doExtract() {
      const k = this.shownOps;
      const res = k ? extract(this.G, GOAL, k) : null;
      if (!res) {
        this.plan = null;
        this.planText = `<span class="no">在 L${k + 1} 上提取失败。</span>`;
      } else {
        this.plan = res;
        const layered = res.map((A) => "{" + A.filter((o) => !o.trivial).map((o) => o.name).join(", ") + "}");
        this.planText = `<b>分层计划（layered plan）</b>：(${layered.join(", ")})　——同一层里的算子互不冲突，可以任意顺序执行；线性化后就是 (2.24)。`;
      }
      this.render();
      this.planText = null;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='planning-graph']").forEach((el) => new PGLab(el));
  });
})();
