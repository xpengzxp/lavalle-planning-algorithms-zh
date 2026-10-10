/* 2.5.3 规划即可满足性：手电筒例子的布尔编码（Example 2.9） */
(function () {
  "use strict";
  const { h } = PA;
  const FL = PA.flashlight;
  const K = 4, F = K + 1;
  const OPS = FL.ops;               // RC, PC, I1, I2
  const LITS = FL.lits;             // O, I1, I2
  const sub = (k) => `<sub>${k}</sub>`;
  const litName = { O: "O(C,F", I1: "I(B1,F", I2: "I(B2,F" };
  const L = (l, k, pos = true) => `${pos ? "" : "¬"}${litName[l]},${k})`;
  const OPN = (o, k, pos = true) => `${pos ? "" : "¬"}${o.id}${sub(k)}`;

  // 构造全部「项」（书中五类），每项是一个对赋值 A 求真假的函数
  function buildTerms() {
    const T = [];
    const lit = (A, l, k) => A.lit[l][k];
    const op = (A, o, k) => A.op[o.id][k];
    // 1. 初始状态
    LITS.forEach((l) => { const v = FL.S[l]; T.push({ cat: 0, text: L(l, 1, v), f: (A) => lit(A, l, 1) === v }); });
    // 2. 目标
    LITS.forEach((l) => { const v = FL.G[l]; T.push({ cat: 1, text: L(l, F, v), f: (A) => lit(A, l, F) === v }); });
    // 3. 算子编码 (2.33)：¬o_k ∨ (前提@k ∧ 效果@k+1)
    for (let k = 1; k <= K; k++) OPS.forEach((o) => {
      const parts = o.pre.map(([l, v]) => L(l, k, v)).concat(o.eff.map(([l, v]) => L(l, k + 1, v)));
      T.push({ cat: 2, text: `${OPN(o, k, false)} ∨ (${parts.join(" ∧ ")})`, f: (A) => !op(A, o, k) || (o.pre.every(([l, v]) => lit(A, l, k) === v) && o.eff.every(([l, v]) => lit(A, l, k + 1) === v)) });
    });
    // 4. 框架公理 (2.34)：字面量变了，就必须有一个以新值为效果的算子被执行
    for (let k = 1; k <= K; k++) LITS.forEach((l) => {
      [true, false].forEach((newV) => {
        const causes = OPS.filter((o) => o.eff.some(([ll, vv]) => ll === l && vv === newV));
        const txt = `(${L(l, k, newV)} ∨ ${L(l, k + 1, !newV)})` + (causes.length ? ` ∨ (${causes.map((o) => OPN(o, k)).join(" ∨ ")})` : "");
        T.push({ cat: 3, text: txt, f: (A) => lit(A, l, k) === newV || lit(A, l, k + 1) !== newV || causes.some((o) => op(A, o, k)) });
      });
    });
    // 5. 完全排斥 (2.35)：每个阶段最多一个算子
    for (let k = 1; k <= K; k++) for (let a = 0; a < OPS.length; a++) for (let b = a + 1; b < OPS.length; b++) {
      const o = OPS[a], q = OPS[b];
      T.push({ cat: 4, text: `${OPN(o, k, false)} ∨ ${OPN(q, k, false)}`, f: (A) => !(op(A, o, k) && op(A, q, k)) });
    }
    return T;
  }
  const CATS = ["初始状态", "目标状态", "算子编码 (2.33)", "框架公理 (2.34)", "完全排斥 (2.35)"];

  function emptyAssign() {
    const A = { op: {}, lit: {} };
    OPS.forEach((o) => { A.op[o.id] = {}; for (let k = 1; k <= K; k++) A.op[o.id][k] = false; });
    LITS.forEach((l) => { A.lit[l] = {}; for (let k = 1; k <= F; k++) A.lit[l][k] = false; });
    return A;
  }
  // 按选中的算子「模拟」出各阶段字面量（框架公理：没被改的保持不变）
  function simulate(A) {
    LITS.forEach((l) => { A.lit[l][1] = FL.S[l]; });
    for (let k = 1; k <= K; k++) {
      LITS.forEach((l) => { A.lit[l][k + 1] = A.lit[l][k]; });
      OPS.forEach((o) => { if (A.op[o.id][k]) o.eff.forEach(([l, v]) => { A.lit[l][k + 1] = v; }); });
    }
  }

  class SatLab {
    constructor(root) {
      this.root = root;
      this.T = buildTerms();
      this.A = emptyAssign();
      this.build();
      this.render();
    }
    build() {
      this.opHost = h("div", { class: "table-wrap" });
      this.litHost = h("div", { class: "table-wrap" });
      this.sumHost = h("div");
      this.listHost = h("div", { class: "small", style: "max-height:260px;overflow:auto" });
      this.solHost = h("div", { class: "small" });
      const bSim = h("button", { class: "btn", type: "button" }, "按算子模拟填好字面量");
      const bBook = h("button", { class: "btn", type: "button" }, "载入书中的解");
      const bClr = h("button", { class: "btn", type: "button" }, "全部清空");
      const bSolve = h("button", { class: "btn primary", type: "button" }, "枚举求解");
      bSim.addEventListener("click", () => { simulate(this.A); this.render(); });
      bBook.addEventListener("click", () => {
        this.A = emptyAssign();
        this.A.op.RC[1] = true; this.A.op.I1[2] = true; this.A.op.I2[3] = true; this.A.op.PC[4] = true;
        simulate(this.A); this.render();
      });
      bClr.addEventListener("click", () => { this.A = emptyAssign(); this.solHost.innerHTML = ""; this.render(); });
      bSolve.addEventListener("click", () => this.solve());
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "把规划写成一个巨大的布尔式"), h("span", { class: "w-sub" }, "Example 2.9：K = 4，F = 5"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" },
          h("p", { class: "small muted", style: "margin-top:0" }, "点格子切换 真(T) / 假(·)。左表是「第 k 阶段执行了哪个算子」（RC = RemoveCap，PC = PlaceCap，I1 / I2 = Insert(Battery1 / 2)），右表是「第 k 阶段各字面量的真值」。下面实时显示哪些项被违反。"),
          h("div", { class: "split", style: "grid-template-columns:repeat(auto-fit,minmax(min(310px,100%),1fr))" }, h("div", null, h("div", { class: "small", style: "font-weight:600" }, "算子变量 o_k"), this.opHost), h("div", null, h("div", { class: "small", style: "font-weight:600" }, "字面量变量 l_k"), this.litHost)),
          h("div", { class: "controls", style: "margin-top:8px" }, bSim, bBook, bClr, bSolve),
          this.sumHost,
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "被违反的项（最多显示 40 条）"), h("div", { class: "panel-body" }, this.listHost)),
          this.solHost));
    }
    cell(get, set, label) {
      const v = get();
      const td = h("td", { class: "c mono", style: `cursor:pointer;user-select:none;${v ? "background:var(--accent-soft);color:var(--accent-text);font-weight:700" : "color:var(--muted)"}`, title: label, role: "button", "aria-pressed": v ? "true" : "false" }, v ? "T" : "·");
      td.addEventListener("click", () => { set(!v); this.render(); });
      return td;
    }
    render() {
      const A = this.A;
      const t1 = h("table", { class: "data" });
      t1.append(h("thead", null, h("tr", null, h("th", null, ""), Array.from({ length: K }, (_, i) => h("th", { class: "c" }, "k=" + (i + 1))))));
      const b1 = h("tbody");
      OPS.forEach((o) => b1.append(h("tr", null, h("th", { title: o.name }, o.id),
        Array.from({ length: K }, (_, i) => this.cell(() => A.op[o.id][i + 1], (v) => { A.op[o.id][i + 1] = v; }, `${o.id}_${i + 1}`)))));
      t1.append(b1);
      const t2 = h("table", { class: "data" });
      t2.append(h("thead", null, h("tr", null, h("th", null, ""), Array.from({ length: F }, (_, i) => h("th", { class: "c" }, "k=" + (i + 1))))));
      const b2 = h("tbody");
      LITS.forEach((l) => b2.append(h("tr", null, h("th", { class: "mono" }, FL.short[l]),
        Array.from({ length: F }, (_, i) => this.cell(() => A.lit[l][i + 1], (v) => { A.lit[l][i + 1] = v; }, `${l}_${i + 1}`)))));
      t2.append(b2);
      this.opHost.innerHTML = ""; this.opHost.append(t1);
      this.litHost.innerHTML = ""; this.litHost.append(t2);

      const bad = this.T.filter((t) => !t.f(A));
      const per = CATS.map((_, c) => ({ total: this.T.filter((t) => t.cat === c).length, bad: bad.filter((t) => t.cat === c).length }));
      this.sumHost.innerHTML = "";
      this.sumHost.append(h("div", { class: "stats" }, per.map((p, c) =>
        h("div", { class: "stat", style: p.bad ? "box-shadow:inset 3px 0 0 var(--bad)" : "box-shadow:inset 3px 0 0 var(--ok)" },
          h("span", { class: "k" }, CATS[c]), h("span", { class: "v" }, `${p.total - p.bad}/${p.total}`)))));
      if (!bad.length) {
        const plan = [];
        for (let k = 1; k <= K; k++) OPS.forEach((o) => { if (A.op[o.id][k]) plan.push(`${o.name}（k=${k}）`); });
        this.sumHost.append(h("div", { class: "msg ok" }, `整个合取式为真（${this.T.length} 项全部满足）！按阶段下标读出计划：${plan.join(" → ")}`));
      } else {
        this.sumHost.append(h("div", { class: "msg bad" }, `${this.T.length} 项中有 ${bad.length} 项为假，整个合取式为假。`));
      }
      this.listHost.innerHTML = "";
      bad.slice(0, 40).forEach((t) => this.listHost.append(h("div", { class: "mono", style: "padding:2px 0;border-bottom:1px solid var(--border)", html: `<span class="tag red">${CATS[t.cat]}</span> ${t.text}` })));
      if (!bad.length) this.listHost.append(h("div", { class: "muted" }, "没有。"));
    }
    solve() {
      // 每个阶段选 0 或 1 个算子：5^4 = 625 种；字面量由模拟决定，再检查所有项
      const sols = [];
      const choices = [null].concat(OPS);
      let tried = 0;
      const rec = (k, pick) => {
        if (k > K) {
          tried++;
          const A = emptyAssign();
          pick.forEach((o, i) => { if (o) A.op[o.id][i + 1] = true; });
          simulate(A);
          if (this.T.every((t) => t.f(A))) sols.push(pick.slice());
          return;
        }
        for (const c of choices) { pick.push(c); rec(k + 1, pick); pick.pop(); }
      };
      rec(1, []);
      this.solHost.innerHTML = "";
      this.solHost.append(h("div", { class: "msg info", html:
        `枚举了 ${tried} 种「每阶段至多一个算子」的选择，找到 <b>${sols.length}</b> 个满足赋值：<br>` +
        sols.map((p) => p.map((o, i) => (o ? `${o.id}${sub(i + 1)}` : `—${sub(i + 1)}`)).join(", ")).join("<br>") +
        `<br>与书中一致：RC${sub(1)}, I1${sub(2)}, I2${sub(3)}, PC${sub(4)} 以及交换两节电池顺序的那个解。真正的 SAT 求解器（如 Davis–Putnam）不会这样暴力枚举，而是边赋值边化简、失败就回溯。` }));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='sat']").forEach((el) => new SatLab(el));
  });
})();
