/* 11.3 节：离散状态空间的例子——符号传感器与目标可识别性（例 11.15、11.16）、L 形走廊（例 11.17）、NFA（例 11.18、11.19） */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH11;
  const sgn = (x) => (x > 0) - (x < 0);
  const m = (v) => String(v).replace(/-/g, "−");

  // ---------------------------------------------------------------
  // 组件 5：整数线——符号传感器（例 11.15）与目标可识别性（例 11.16）
  // ---------------------------------------------------------------
  const BIG = 1e9;
  class IntegerLine {
    constructor(root) {
      this.mode = "sign"; this.goal = "wide"; this.nat = "rand"; this.showTruth = true; this.r = C.rng(C.newSeed());
      const body = C.frame(root, "整数线上的 I-state", "X = ℤ，U = {−1, 1, u_T}，x_{k+1} = x_k + u_k");
      this.st = new C.Stage({ view: [-16.5, 16.5, -2.3, 2.6], aspect: 0.3, maxW: 720, equal: false, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { const x = Math.round(p.x); if (this.k === 1 && Math.abs(x) <= 16) { this.x0 = x; this.reset(); } return null; }, cursor: () => (this.k === 1 ? "pointer" : null) });
      this.segMode = C.seg([["sign", "例 11.15：符号传感器 y = sgn x"], ["dist", "例 11.16：y = x + ψ，ψ ∈ {−5, …, 5}"]], this.mode, (k) => { this.mode = k; this.updUI(); this.reset(); });
      this.segGoal = C.seg([["wide", "X_G = {−5, …, 5}"], ["zero", "X_G = {0}"]], this.goal, (k) => { this.goal = k; this.reset(); });
      this.segNat = C.seg([["rand", "ψ 随机"], ["adv", "ψ 对手式（让区间尽量宽）"]], this.nat, (k) => { this.nat = k; });
      this.natBox = h("span", { class: "controls", style: "margin:0" }, h("label", null, "目标"), this.segGoal, h("label", null, "自然"), this.segNat);
      this.btnL = C.button("u = −1", () => this.act(-1), "small primary");
      this.btnR = C.button("u = +1", () => this.act(1), "small primary");
      this.btnT = C.button("u_T（宣布到达）", () => this.act(0), "small");
      this.btnPlan = C.button("执行计划一步", () => this.planStep(), "small");
      this.btnAuto = C.button("自动执行计划", () => this.run.toggle(), "small");
      this.run = new C.Runner((dt) => { this.acc = (this.acc || 0) + dt; if (this.acc < 0.35) return true; this.acc = 0; return this.planStep(); }, () => (this.btnAuto.textContent = "自动执行计划"));
      C.pauseWhenHidden(root, this.run);
      this.status = h("div", { class: "status-line" });
      this.hist = h("div", { class: "mono small", style: "word-break:break-all;line-height:1.6" });
      body.append(h("div", { class: "controls" }, this.segMode), h("div", { class: "controls" }, this.natBox),
        h("div", { class: "controls" }, this.btnL, this.btnR, this.btnT, h("span", { class: "sep" }), this.btnPlan, this.btnAuto, C.button("重置", () => this.reset(), "small"),
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        this.st.wrap, this.status, this.hist,
        C.legend([[C.cva("ndet", 0.45), "X_k(η_k)"], [C.cva("obs", 0.35), "当前观测的原像 H(y_k)"], [C.cva("goal", 0.4), "目标 X_G"], [C.cv("truth"), "真实 x（点数轴可以改初始状态）", true]]));
      this.x0 = 9;
      this.updUI(); this.reset();
    }
    updUI() { this.natBox.style.display = this.mode === "dist" ? "" : "none"; }
    H(y) { return this.mode === "sign" ? (y > 0 ? [1, BIG] : y < 0 ? [-BIG, -1] : [0, 0]) : [y - 5, y + 5]; }
    goalSet() { return this.mode === "sign" || this.goal === "zero" ? [0, 0] : [-5, 5]; }
    sense() {
      if (this.mode === "sign") return sgn(this.x);
      if (this.nat === "rand") return this.x + C.randInt(this.r, -5, 5);
      // 对手式：让 [y−5, y+5] 尽量盖住当前区间（区间越宽越好）
      const c = Math.round((this.lo + this.hi) / 2), lo = Math.max(-BIG, this.lo), hi = Math.min(BIG, this.hi);
      const cc = Math.abs(lo) > 1e8 || Math.abs(hi) > 1e8 ? this.x + (this.x > 0 ? 5 : -5) : c;
      return Math.max(this.x - 5, Math.min(this.x + 5, cc));
    }
    reset() {
      this.run.stop();
      this.x = this.x0; this.k = 1; this.us = []; this.ys = []; this.done = false; this.fail = false;
      this.lo = -BIG; this.hi = BIG;                // η₀ = X
      this.observe();
    }
    observe() {
      const y = this.sense(); this.ys.push(y);
      const [a, b] = this.H(y);
      this.lo = Math.max(this.lo, a); this.hi = Math.min(this.hi, b);   // (11.31)
      this.y = y; this.st.draw(); this.text();
    }
    act(u) {
      if (this.done) return;
      if (u === 0) {
        const [g0, g1] = this.goalSet();
        this.done = true; this.fail = !(g0 <= this.lo && this.hi <= g1);
        this.us.push("u_T"); this.st.draw(); this.text(); return;
      }
      this.us.push(u); this.k++;
      this.x += u;
      this.lo = this.lo <= -BIG ? -BIG : this.lo + u; this.hi = this.hi >= BIG ? BIG : this.hi + u;   // (11.30)：没有预测不确定性
      this.observe();
    }
    // 计划：X_k ⊆ X_G 就停；否则把区间往 0 推（例 11.15 就是 (11.43) 的传感器反馈计划）
    planStep() {
      if (this.done) return false;
      const [g0, g1] = this.goalSet();
      if (g0 <= this.lo && this.hi <= g1) { this.act(0); return false; }
      if (this.k > 80) { this.status.innerHTML += "　<b>（80 步了还没法确定到达——停下）</b>"; return false; }
      const mid = this.lo <= -BIG ? -1 : this.hi >= BIG ? 1 : (this.lo + this.hi) / 2;
      this.act(mid > 0 ? -1 : 1);
      if (this.run.running) this.btnAuto.textContent = "暂停";
      return true;
    }
    fmtSet(lo, hi) {
      if (lo <= -BIG && hi >= BIG) return "X = ℤ";
      if (lo <= -BIG) return `{…, ${m(hi - 1)}, ${m(hi)}}`;
      if (hi >= BIG) return `{${m(lo)}, ${m(lo + 1)}, …}`;
      if (lo === hi) return `{${m(lo)}}`;
      return `{${m(lo)}, …, ${m(hi)}}（${hi - lo + 1} 个）`;
    }
    text() {
      const [g0, g1] = this.goalSet();
      let st = `k = ${this.k}，y_k = ${m(this.y)}，X_k(η_k) = ${this.fmtSet(this.lo, this.hi)}`;
      if (this.done) st += this.fail ? "　<b style='color:var(--bad)'>执行了 u_T，但 X_k 不在 X_G 里——不能保证到达</b>" : `　<b style='color:var(--ok)'>X_k ⊆ X_G，执行 u_T：保证到达（真实 x = ${m(this.x)}）</b>`;
      else if (this.mode === "dist" && this.goal === "zero") st += "　<span class='muted'>X_G = {0} 时，区间要缩成 {0} 才能停——对手式的自然永远不让它发生。</span>";
      this.status.innerHTML = st;
      const us = this.us.map(m).join(", ");
      this.hist.innerHTML = `η${C.sub(this.k)} = (X, ${us ? us + ", " : ""}${this.ys.map(m).join(", ")})`
        + (this.mode === "sign" ? `<br><span class="muted">传感器反馈计划 (11.43)：π(1) = −1，π(−1) = 1，π(0) = u_T——只看当前 y，不用记历史。</span>` : "");
    }
    draw(st, col) {
      const [x0, x1] = [-16, 16];
      const clip = (v) => Math.max(x0 - 0.5, Math.min(x1 + 0.5, v));
      const [g0, g1] = this.goalSet();
      st.rect(clip(g0 - 0.5), -0.5, clip(g1 + 0.5), 0.5, C.alpha(col.goal, 0.22), col.goal, 1);
      const [a, b] = this.H(this.y);
      st.rect(clip(a - 0.5), 0.75, clip(b + 0.5), 1.25, C.alpha(col.obs, 0.3), col.obs, 1);
      st.text("H(y_k)", { x: x0 - 0.4, y: 1.55 }, col.obs, { align: "left", size: 11.5, weight: 650 });
      st.rect(clip(this.lo - 0.5), -1.45, clip(this.hi + 0.5), -0.95, C.alpha(col.ndet, 0.45), col.ndet, 1.2);
      st.text("X_k(η_k)", { x: x0 - 0.4, y: -1.8 }, col.ndet, { align: "left", size: 11.5, weight: 650 });
      for (let x = x0; x <= x1; x++) {
        st.line({ x, y: -0.25 }, { x, y: 0.25 }, col.strong, 1);
        if (x % 2 === 0) st.text(m(x), { x, y: -0.72 }, col.muted, { size: 10.5 });
      }
      st.line({ x: x0 - 0.5, y: 0 }, { x: x1 + 0.5, y: 0 }, col.strong, 1.2);
      st.text("…", { x: x0 - 0.5, y: 0.25 }, col.muted, { size: 14, align: "right" }); st.text("…", { x: x1 + 0.5, y: 0.25 }, col.muted, { size: 14, align: "left" });
      if (this.showTruth) st.truth({ x: Math.max(x0, Math.min(x1, this.x)), y: 0 }, col, Math.abs(this.x) > 16 ? `x = ${m(this.x)}` : "x");
      if (this.us.length && typeof this.us[this.us.length - 1] === "number") st.text(`上一步 u = ${m(this.us[this.us.length - 1])}`, { x: x0, y: 2.1 }, col.robot, { align: "left", size: 12 });
    }
  }

  // ---------------------------------------------------------------
  // 组件 6：L 形走廊（例 11.17，图 11.7）——κ_stage、κ₃、κ₁₉
  // ---------------------------------------------------------------
  const CELLS = [];
  for (let i = 1; i <= 10; i++) CELLS.push([i, 1]);
  for (let j = 2; j <= 10; j++) CELLS.push([1, j]);
  const ID = new Map(CELLS.map((c, n) => [c.join(","), n]));
  const ACTS = [[[-1, 0], "←"], [[1, 0], "→"], [[0, 1], "↑"], [[0, -1], "↓"]];
  function cf(c, u, th) { let x = c; for (let t = 0; t < th; t++) { const n = [x[0] + u[0], x[1] + u[1]]; if (!ID.has(n.join(","))) break; x = n; } return x; }
  function cF(S, u) { const o = new Set(); for (const n of S) for (let th = 1; th <= 3; th++) o.add(ID.get(cf(CELLS[n], u, th).join(","))); return o; }
  const GOALN = ID.get("1,10");
  function k3(S) { if (S.size === 1 && S.has(GOALN)) return "g"; return [...S].every((n) => CELLS[n][0] === 1) ? "l" : "a"; }
  function k19(S) {
    if (S.size === 1 && S.has(GOALN)) return "g";
    if ([...S].every((n) => CELLS[n][0] === 1)) return "l" + Math.min(...[...S].map((n) => CELLS[n][1]));
    return "a" + Math.max(...[...S].filter((n) => CELLS[n][1] === 1).map((n) => CELLS[n][0]));
  }
  const labT = (l) => (l === "g" ? "g" : l[0] + C.sub(l.slice(1)));

  class Corridor {
    constructor(root) {
      this.r = C.rng(C.newSeed()); this.showTruth = true; this.nature = "rand";
      const body = C.frame(root, "L 形走廊：没有传感器也能把不确定性消掉", "例 11.17：每步自然让机器人走 θ ∈ {1, 2, 3} 格，撞墙就停");
      this.st = new C.Stage({ view: [0.3, 10.7, 0.3, 10.7], aspect: 1, maxW: 400, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { const c = [Math.round(p.x), Math.round(p.y)]; const n = ID.get(c.join(",")); if (n === undefined) return null; this.toggleCell(n); return null; },
        cursor: (p) => (ID.has([Math.round(p.x), Math.round(p.y)].join(",")) ? "pointer" : null) });
      this.btns = ACTS.map(([u, t]) => C.button(t, () => this.act(u), "small primary"));
      this.btnStage = C.button("按 κ_stage 计划走一步", () => this.planStep("stage"), "small");
      this.btn19 = C.button("按 κ₁₉ 计划走一步", () => this.planStep("19"), "small");
      this.btn3 = C.button("按 κ₃ 计划走一步", () => this.planStep("3"), "small");
      this.segInit = C.seg([["one", "X₁ = {(10,1)}（书中）"], ["all", "X₁ = X（完全不知道）"], ["custom", "点格子自定义"]], "one", (k) => { this.init = k; this.reset(); });
      this.segNat = C.seg([["rand", "θ 随机"], ["one", "θ 总是 1"], ["three", "θ 总是 3"]], "rand", (k) => { this.nature = k; });
      this.labels = h("div", { class: "table-wrap" });
      this.status = h("div", { class: "status-line" });
      this.init = "one";
      body.append(h("div", { class: "controls" }, h("label", null, "初始条件"), this.segInit, h("label", null, "自然"), this.segNat),
        h("div", { class: "controls" }, h("label", null, "动作"), ...this.btns, h("span", { class: "sep" }), this.btnStage, this.btn19, this.btn3, C.button("重置", () => this.reset(), "small"),
          C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.labels, this.status)),
        C.legend([[C.cva("ndet", 0.55), "X(η)：可能的位置"], [C.cva("goal", 0.5), "目标 (1,10)"], [C.cv("truth"), "真实位置", true]]));
      this.reset();
    }
    toggleCell(n) {
      if (this.init !== "custom" || this.k !== 1) { this.init = "custom"; this.segInit.set("custom"); this.S = new Set(); }
      if (this.S.has(n)) { if (this.S.size > 1) this.S.delete(n); } else this.S.add(n);
      this.S0 = new Set(this.S); this.k = 1; this.hist = []; this.prevLabels = null;
      const arr = [...this.S]; this.x = arr[Math.floor(this.r() * arr.length)];
      this.update();
    }
    reset() {
      this.S = this.init === "all" ? new Set(CELLS.map((_, n) => n)) : this.init === "custom" && this.S0 ? new Set(this.S0) : new Set([ID.get("10,1")]);
      this.S0 = new Set(this.S);
      const arr = [...this.S]; this.x = arr[Math.floor(this.r() * arr.length)];
      this.k = 1; this.hist = []; this.prevLabels = null; this.update();
    }
    act(u) {
      const before = { k3: k3(this.S), k19: k19(this.S) };
      this.S = cF(this.S, u);
      const th = this.nature === "rand" ? C.randInt(this.r, 1, 3) : this.nature === "one" ? 1 : 3;
      this.x = ID.get(cf(CELLS[this.x], u, th).join(","));
      this.k++; this.hist.push(ACTS.find((a) => a[0][0] === u[0] && a[0][1] === u[1])[1]);
      this.prevLabels = { ...before, u };
      this.update();
    }
    planStep(kind) {
      if (this.S.size === 1 && this.S.has(GOALN)) { this.status.innerHTML = "<b style='color:var(--ok)'>已经在 g：执行 u_T。</b>"; return; }
      let u;
      if (kind === "stage") u = this.k <= 9 ? [-1, 0] : this.k <= 18 ? [0, 1] : null;
      else { const l = kind === "19" ? k19(this.S) : k3(this.S); u = l[0] === "l" ? [0, 1] : [-1, 0]; }
      if (!u) { this.status.innerHTML = "κ_stage 计划：k > 18，执行 u_T。"; return; }
      this.act(u);
    }
    update() {
      const L3 = k3(this.S), L19 = k19(this.S);
      const rows = [["κ_stage（例 11.12）", `k = ${this.k}`, this.k <= 9 ? "(−1, 0)" : this.k <= 18 ? "(0, 1)" : "u_T", "充分"],
        ["κ₃ (11.46)", L3, L3 === "g" ? "u_T" : L3 === "l" ? "(0, 1)" : "(−1, 0)", "<span class='no'>不充分</span>"],
        ["κ₁₉", labT(L19), L19 === "g" ? "u_T" : L19[0] === "l" ? "(0, 1)" : "(−1, 0)", "<span class='yes'>充分</span>"],
        ["κ_ndet", `${this.S.size} 个格子`, "—", "充分"]];
      this.labels.innerHTML = `<table class="data" style="font-size:13px"><thead><tr><th>I-map</th><th>派生 I-state</th><th>它的计划给出的动作</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      let msg = `k = ${this.k}，|X(η)| = ${this.S.size}${this.hist.length ? "，动作历史：" + this.hist.join(" ") : ""}。`;
      if (this.S.size === 1 && this.S.has(GOALN)) msg += " <b style='color:var(--ok)'>X(η) = {(1,10)}：不用传感器，也确定到达目标。</b>";
      // κ₃ 的不充分：标签 a 加 (−1,0) 之后，下一个标签取决于标签看不见的东西
      if (L3 === "a") msg += "<br><span class='muted'>κ₃ 只告诉你「a」。若下一步是 (−1,0)，结果可能是 l 也可能还是 a——例如 {(2,1)} 会变成 l，{(3,1)} 却仍是 a。所以机器人还得在旁边维护完整的 X(η)，κ₃ 不充分。</span>";
      if (this.prevLabels) msg += `<br>上一步：κ₁₉ ${labT(this.prevLabels.k19)} → ${labT(L19)}，κ₃ ${this.prevLabels.k3} → ${L3}`;
      this.status.innerHTML = msg;
      this.st.draw();
    }
    draw(st, col) {
      CELLS.forEach(([i, j], n) => {
        const inS = this.S.has(n);
        st.rect(i - 0.47, j - 0.47, i + 0.47, j + 0.47, n === GOALN ? C.alpha(col.goal, 0.35) : col.surface, col.strong, 1);
        if (inS) st.rect(i - 0.4, j - 0.4, i + 0.4, j + 0.4, C.alpha(col.ndet, 0.55), col.ndet, 1.5);
        else st.dot({ x: i, y: j }, 2, col.muted);
      });
      for (let i = 1; i <= 10; i++) st.text(String(i), { x: i, y: 0.5 }, col.muted, { size: 10, dy: 2 });
      for (let j = 2; j <= 10; j++) st.text(String(j), { x: 0.5, y: j }, col.muted, { size: 10, dx: 2 });
      st.text("x_G", { x: 2.2, y: 10 }, col.goal, { size: 13, weight: 650 });
      st.text(`2¹⁹ = 524 288 个不确定 I-state`, { x: 6, y: 7.2 }, col.muted, { size: 12 });
      st.text(`κ₁₉ 把它们压成 19 个`, { x: 6, y: 6.4 }, col.muted, { size: 12 });
      if (this.showTruth) { const [i, j] = CELLS[this.x]; st.truth({ x: i, y: j }, col); }
    }
  }

  // ---------------------------------------------------------------
  // 组件 7：NFA 与不确定 I-空间（例 11.18、11.19，图 11.8）
  // ---------------------------------------------------------------
  const DELTA = { a: { 0: [], 1: ["c"], e: ["b"] }, b: { 0: ["a"], 1: [], e: [] }, c: { 0: ["b", "c"], 1: ["b"], e: [] } };
  function eclose(S) { const o = new Set(S), st = [...S]; while (st.length) { const x = st.pop(); for (const z of DELTA[x].e) if (!o.has(z)) { o.add(z); st.push(z); } } return o; }
  const nF = (x, u) => eclose(DELTA[x][u]);                                 // (11.50)
  const nStep = (S, u) => { const o = new Set(); S.forEach((x) => nF(x, u).forEach((z) => o.add(z))); return o; };
  const nKey = (S) => [...S].sort().join("") || "∅";
  class NFA {
    constructor(root) {
      this.str = "100";
      const body = C.frame(root, "NFA = 在不确定 I-空间里规划", "图 11.8b 的三状态 NFA；接受状态 a（双圈）");
      this.svgN = s("svg", { viewBox: "0 0 300 230", width: "100%", style: "max-width:300px" });
      this.svgD = s("svg", { viewBox: "0 0 380 260", width: "100%", style: "max-width:380px" });
      this.tape = h("div", { class: "controls" });
      this.res = h("div", { class: "status-line" });
      this.trace = h("div", { class: "mono small" });
      this.pos = this.str.length;
      body.append(h("div", { class: "controls" }, C.button("输入 0", () => this.push("0"), "small primary"), C.button("输入 1", () => this.push("1"), "small primary"),
        C.button("退格", () => { this.str = this.str.slice(0, -1); this.pos = this.str.length; this.update(); }, "small"), C.button("清空", () => { this.str = ""; this.pos = 0; this.update(); }, "small"),
        h("span", { class: "sep" }), C.button("◀ 单步", () => { this.pos = Math.max(0, this.pos - 1); this.update(); }, "small"), C.button("单步 ▶", () => { this.pos = Math.min(this.str.length, this.pos + 1); this.update(); }, "small"),
        h("span", { class: "sep" }), ...["100", "110", "1010", "111"].map((w) => C.button(`“${w}”`, () => { this.str = w; this.pos = w.length; this.update(); }, "small"))),
        this.tape, h("div", { class: "split" }, h("div", null, h("div", { class: "small muted" }, "NFA 本身（蓝色 = 当前所有「克隆」所在的状态）"), h("div", { class: "svg-wrap" }, this.svgN)),
          h("div", null, h("div", { class: "small muted" }, "子集构造：从 {a,b} 出发可达的不确定 I-state = 等价 DFA 的状态"), h("div", { class: "svg-wrap" }, this.svgD))),
        this.res, this.trace);
      this.update();
    }
    push(c) { this.str = this.str.slice(0, this.pos) + c; this.pos = this.str.length; this.update(); }
    update() {
      const seq = [eclose(["a"])];
      for (let i = 0; i < this.pos; i++) seq.push(nStep(seq[i], this.str[i]));
      const S = seq[seq.length - 1];
      this.tape.innerHTML = "";
      this.tape.append(h("label", null, "输入串（计划 π = (u₁, …, u_K, u_T)）："));
      if (!this.str.length) this.tape.append(h("span", { class: "muted small" }, "（空串）"));
      [...this.str].forEach((c, i) => this.tape.append(h("span", { class: "tag " + (i < this.pos ? "blue" : ""), style: "font-family:var(--mono);font-size:14px" }, c)));
      const acc = S.has("a");
      this.res.innerHTML = `读完 ${this.pos} 个符号后 X(η) = {${[...S].sort().join(", ")}}　` + (this.pos < this.str.length ? "（还没读完）"
        : acc ? "<b style='color:var(--ok)'>含接受状态 a：至少有一个「平行宇宙」接受——NFA 接受这个串（X ∩ X_G ≠ ∅）</b>" : S.size ? "<b style='color:var(--bad)'>不含 a：拒绝</b>" : "<b style='color:var(--bad)'>空集：所有克隆都死了</b>");
      this.trace.innerHTML = seq.map((T, i) => (i ? ` —${this.str[i - 1]}→ ` : "") + `{${[...T].sort().join(",")}}`).join("") + (this.pos === this.str.length && this.pos ? ` —u_T→ {${[...S].sort().join(",")}}` : "");
      this.drawNFA(S);
      this.drawDFA(seq);
    }
    drawNFA(S) {
      const svg = this.svgN; svg.innerHTML = "";
      PA.arrowDefs(svg, { na: "var(--muted)" });
      const P = { a: [150, 50], b: [65, 175], c: [235, 175] };
      const edge = (d, lab, lx, ly) => { svg.append(s("path", { d, fill: "none", stroke: "var(--muted)", "stroke-width": 1.4, "marker-end": "url(#na)" })); svg.append(s("text", { x: lx, y: ly, "font-size": 14, fill: "var(--text)", "text-anchor": "middle" }, lab)); };
      svg.append(s("path", { d: "M70,20 Q110,22 128,38", fill: "none", stroke: "var(--muted)", "stroke-width": 1.4, "marker-end": "url(#na)" }));
      edge("M132,66 Q85,95 72,152", "ε", 88, 100);
      edge("M85,160 Q130,120 145,74", "0", 128, 132);
      edge("M168,66 Q215,95 228,152", "1", 212, 100);
      edge("M212,180 Q150,195 90,182", "0,1", 150, 207);
      edge("M255,165 Q295,150 280,185 Q270,205 252,192", "0", 292, 200);
      for (const [k, [x, y]] of Object.entries(P)) {
        const on = S.has(k);
        svg.append(s("circle", { cx: x, cy: y, r: 22, fill: on ? "color-mix(in srgb, var(--accent) 45%, var(--surface))" : "var(--surface)", stroke: on ? "var(--accent)" : "var(--text-2)", "stroke-width": on ? 2.2 : 1.3 }));
        if (k === "a") svg.append(s("circle", { cx: x, cy: y, r: 17, fill: "none", stroke: on ? "var(--accent)" : "var(--text-2)", "stroke-width": 1.2 }));
        svg.append(s("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 15, fill: "var(--text)" }, k));
      }
    }
    drawDFA(seq) {
      const svg = this.svgD; svg.innerHTML = "";
      PA.arrowDefs(svg, { da: "var(--muted)", dh: "var(--accent)" });
      const P = { ab: [60, 70], c: [190, 70], bc: [320, 70], abc: [320, 175], b: [190, 175], "∅": [60, 175] };
      const E = new Map();            // "a>b" → 标签列表
      for (const k of Object.keys(P)) for (const u of ["0", "1"]) { const S = k === "∅" ? new Set() : new Set(k.split("")); const kk = k + ">" + nKey(nStep(S, u)); E.set(kk, (E.get(kk) || []).concat([u])); }
      const used = new Set(); for (let i = 1; i < seq.length; i++) used.add(nKey(seq[i - 1]) + ">" + nKey(seq[i]));
      for (const [kk, labs] of E) {
        const [a, b] = kk.split(">"), hot = used.has(kk), lab = labs.join(",");
        const [x1, y1] = P[a], [x2, y2] = P[b];
        const stroke = hot ? "var(--accent)" : "var(--muted)", sw = hot ? 2.2 : 1.2, mk = `url(#${hot ? "dh" : "da"})`;
        if (a === b) {
          const dn = y1 > 100 ? 1 : -1;       // 下排的自环画在下面
          svg.append(s("path", { d: `M${x1 - 12},${y1 + dn * 18} C${x1 - 30},${y1 + dn * 56} ${x1 + 30},${y1 + dn * 56} ${x1 + 12},${y1 + dn * 18}`, fill: "none", stroke, "stroke-width": sw, "marker-end": mk }));
          svg.append(s("text", { x: x1, y: y1 + dn * 50 + (dn > 0 ? 12 : 0), "text-anchor": "middle", "font-size": 12, fill: "var(--text)" }, lab));
          continue;
        }
        const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, bend = E.has(b + ">" + a) ? 16 : 0;
        const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
        svg.append(s("path", { d: `M${x1 + ux * 24},${y1 + uy * 20} Q${mx},${my} ${x2 - ux * 26},${y2 - uy * 21}`, fill: "none", stroke, "stroke-width": sw, "marker-end": mk }));
        svg.append(s("text", { x: mx - uy * 9, y: my + ux * 9 + 4, "text-anchor": "middle", "font-size": 12, fill: "var(--text)" }, lab));
      }
      const cur = nKey(seq[seq.length - 1]);
      for (const [k, [x, y]] of Object.entries(P)) {
        const acc = k.includes("a");
        svg.append(s("rect", { x: x - 23, y: y - 17, width: 46, height: 34, rx: 17, fill: k === cur ? "var(--accent)" : "var(--surface)", stroke: acc ? "var(--ok)" : "var(--border-strong)", "stroke-width": acc ? 2.4 : 1 }));
        svg.append(s("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 13, fill: k === cur ? "#fff" : "var(--text)" }, k === "∅" ? "∅" : "{" + k.split("").join(",") + "}"));
      }
      svg.append(s("text", { x: 190, y: 252, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, "绿框 = 含 a 的接受 I-state；8 个子集里只有 6 个可达"));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='integer-line']").forEach((el) => (el._w = new IntegerLine(el)));
    document.querySelectorAll("[data-widget='corridor']").forEach((el) => (el._w = new Corridor(el)));
    document.querySelectorAll("[data-widget='nfa']").forEach((el) => (el._w = new NFA(el)));
  });
})();
