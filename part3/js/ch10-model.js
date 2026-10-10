/* 10.1 节：数轴上的前向投影与反向投影（例 10.1、10.3–10.5）、网格上的自然（例 10.2）、计划与 G_π */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH10;
  const INF = Infinity;

  // ---------------------------------------------------------------
  // 组件：数轴上的前向投影（例 10.1、10.3、10.4；10.1.3 节按计划的前向投影 (10.28)(10.29)）
  // ---------------------------------------------------------------
  const NL_MODELS = {
    m1: { U: [-2, 2], Th: [-1, 0, 1], name: "模型 1：U = {−2, 2, u_T}，Θ = {−1, 0, 1}" },
    m2: { U: [-1, 1], Th: [-2, -1, 0, 1, 2], name: "模型 2：U = {−1, 1, u_T}，Θ = {−2, …, 2}" },
  };
  const NL_LO = -24, NL_HI = 24;
  class NumberLineForward {
    constructor(root) {
      this.model = "m1"; this.view = "pr"; this.x1 = 0; this.goal = "g3";
      const body = C.frame(root, "数轴上的前向投影", "例 10.1、10.3、10.4：非确定 → 可能状态的集合；概率 → 状态上的分布");
      this.segM = C.seg([["m1", "模型 1：Θ = {−1,0,1}"], ["m2", "模型 2：Θ = {−2,…,2}"]], this.model, (k) => { this.model = k; this.makeButtons(); this.reset(); });
      this.segV = C.seg([["nd", "非确定（集合）"], ["pr", "概率（均匀）"]], this.view, (k) => { this.view = k; this.render(); });
      this.segG = C.seg([["g3", "X_G = {−1, 0, 1}"], ["g1", "X_G = {0}"]], this.goal, (k) => { this.goal = k; this.render(); });
      this.sX = C.slider("x₁", -10, 10, 1, this.x1, (v) => { this.x1 = v; this.reset(); });
      this.btns = h("div", { class: "controls" });
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.info = h("div", { class: "small mono", style: "min-height:3.2em;margin-top:6px;white-space:pre-wrap" });
      body.append(h("div", { class: "controls" }, this.segM, this.segV), h("div", { class: "controls" }, this.sX, this.segG), this.btns, this.svgWrap, this.info,
        C.legend([[C.cva("warn", 0.75), "可能的状态 / 概率（越深越大）"], [C.cva("ok", 0.3), "目标集 X_G"], [C.cv("accent"), "x₁"]]));
      this.makeButtons();
      this.reset();
    }
    get M() { return NL_MODELS[this.model]; }
    get G() { return this.goal === "g3" ? [-1, 0, 1] : [0]; }
    makeButtons() {
      this.btns.innerHTML = "";
      for (const u of this.M.U) this.btns.append(C.button(`施加 u = ${u > 0 ? "+" : ""}${u}`, () => this.step(u), "small"));
      this.btns.append(C.button("按反馈计划 π 走一步", () => this.step("pi"), "small primary"),
        h("span", { class: "sep" }), C.button("撤销", () => { if (this.rows.length > 1) { this.rows.pop(); this.render(); } }, "small"),
        C.button("重置", () => this.reset(), "small"));
    }
    reset() { this.rows = [{ P: new Map([[this.x1, 1]]), u: null }]; this.render(); }
    step(u) {
      if (this.rows.length >= 12) return;
      const last = this.rows[this.rows.length - 1].P, P = new Map(), Th = this.M.Th, G = this.G;
      const p = 1 / Th.length;
      for (const [x, px] of last) {
        let a = u;
        if (u === "pi") {        // 反馈计划：进了 X_G 就 u_T，否则朝目标走
          if (G.includes(x)) { P.set(x, (P.get(x) || 0) + px); continue; }
          a = x > Math.max(...G) ? this.M.U[0] : this.M.U[1];
        }
        for (const th of Th) { const z = x + a + th; P.set(z, (P.get(z) || 0) + px * p); }
      }
      this.rows.push({ P, u });
      this.render();
    }
    render() {
      const n = NL_HI - NL_LO + 1, cw = 15, rh = 24, L = 74, T = 22;
      const W = L + n * cw + 8, H = T + this.rows.length * rh + 8;
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "前向投影的时空图" });
      const G = this.G;
      for (const g of G) svg.append(s("rect", { x: L + (g - NL_LO) * cw, y: T - 4, width: cw, height: this.rows.length * rh + 4, fill: C.cva("ok", 0.22) }));
      for (let x = NL_LO; x <= NL_HI; x++) if (x % 4 === 0) svg.append(s("text", { x: L + (x - NL_LO + 0.5) * cw, y: 13, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, x));
      this.rows.forEach((row, k) => {
        const y = T + k * rh;
        const lab = k === 0 ? "k = 1" : `k = ${k + 1}  ${row.u === "pi" ? "π" : (row.u > 0 ? "+" : "") + row.u}`;
        svg.append(s("text", { x: 4, y: y + rh / 2 + 4, "font-size": 11, fill: "var(--text-2)" }, lab));
        let pmax = 0; for (const v of row.P.values()) pmax = Math.max(pmax, v);
        for (let x = NL_LO; x <= NL_HI; x++) {
          const pr = row.P.get(x) || 0;
          const a = pr > 0 ? (this.view === "nd" ? 0.8 : 0.18 + 0.72 * pr / pmax) : 0;
          svg.append(s("rect", { x: L + (x - NL_LO) * cw + 1, y: y + 2, width: cw - 2, height: rh - 4, rx: 3,
            fill: pr > 0 ? (k === 0 ? "var(--accent)" : C.cva("warn", a)) : "var(--surface-2)", stroke: "var(--border)", "stroke-width": 0.5 }));
        }
        const out = Array.from(row.P.keys()).filter((x) => x < NL_LO || x > NL_HI).length;
        if (out) svg.append(s("text", { x: W - 4, y: y + rh / 2 + 4, "text-anchor": "end", "font-size": 10, fill: "var(--bad)" }, "…"));
      });
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
      // 文字：最后一行的集合 / 分布
      const last = this.rows[this.rows.length - 1].P, keys = Array.from(last.keys()).sort((a, b) => a - b), k = this.rows.length;
      let txt = this.view === "nd" ? `X_${k} = {${compress(keys)}}` : `P(x_${k} | ·) ：` + keys.map((x) => `${x}: ${C.niceFrac(last.get(x), 2000)}`).join("  ");
      const inG = keys.every((x) => G.includes(x)), touch = keys.some((x) => G.includes(x));
      let pG = 0; for (const x of keys) if (G.includes(x)) pG += last.get(x);
      txt += "\n" + (inG ? "✓ 所有可能的状态都在 X_G 里：目标被「保证」达到。" : touch ? `部分可能状态在 X_G 里（概率 ${C.niceFrac(pG, 2000)}）——只是「可能」达到。` : "还没有任何可能状态落在 X_G 里。");
      this.info.textContent = txt;
    }
  }
  function compress(xs) {
    if (!xs.length) return "";
    const out = []; let a = xs[0], b = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === b + 1) { b = xs[i]; continue; }
      out.push(a === b ? String(a) : b === a + 1 ? `${a}, ${b}` : `${a}, …, ${b}`);
      if (i < xs.length) { a = b = xs[i]; }
    }
    return out.join(", ");
  }

  // ---------------------------------------------------------------
  // 组件：弱 / 强反向投影（例 10.5，式 10.20–10.26）
  // ---------------------------------------------------------------
  const BP_LO = -8, BP_HI = 8, BP_TH = [-1, 0, 1];
  class Backprojection {
    constructor(root) {
      this.S = new Set([-1, 0, 1]); this.u = "2"; this.allowT = true; this.hover = null;
      const body = C.frame(root, "弱反向投影与强反向投影", "模型 1：U = {−2, 2, u_T}，Θ = {−1, 0, 1}；点格子把它加入 / 移出 S");
      this.segU = C.seg([["-2", "u = −2"], ["2", "u = +2"], ["T", "u = u_T"], ["all", "所有 u：WB(S)、SB(S)"]], this.u, (k) => { this.u = k; this.render(); });
      this.chkT = C.checkbox("允许 u_T", this.allowT, (v) => { this.allowT = v; this.render(); });
      const preset = (S) => () => { this.S = new Set(S); this.render(); };
      body.append(h("div", { class: "controls" }, this.segU, this.chkT),
        h("div", { class: "controls" }, h("span", { class: "small muted" }, "预设 S："), C.button("{0}", preset([0]), "small"), C.button("X_G = {−1, 0, 1}", preset([-1, 0, 1]), "small"),
          C.button("{−1, 1}", preset([-1, 1]), "small"), C.button("清空", preset([]), "small")));
      this.svgWrap = h("div", { class: "svg-wrap" });
      this.info = h("div", { class: "small mono", style: "white-space:pre-wrap;min-height:4.8em;margin-top:6px" });
      body.append(this.svgWrap, this.info,
        C.legend([[C.cv("ok"), "S"], [C.cva("warn", 0.55), "WB：存在某个自然动作能进 S"], [C.cv("accent"), "SB：所有自然动作都进 S"], [C.cva("accent", 0.35), "∪ SB(x, u)：逐点求再并起来"]]));
      this.render();
    }
    // 对单个动作 u：x' 的前向投影（u_T：留在原地）
    fp(x, u) { return u === "T" ? [x] : BP_TH.map((th) => x + Number(u) + th); }
    acts() { return this.u === "all" ? ["-2", "2"].concat(this.allowT ? ["T"] : []) : [this.u]; }
    sets() {
      const S = this.S, WB = new Set(), SB = new Set(), USB = new Set();
      for (let x = BP_LO - 6; x <= BP_HI + 6; x++) {
        for (const u of this.acts()) {
          const F = this.fp(x, u);
          if (F.some((z) => S.has(z))) WB.add(x);
          if (F.every((z) => S.has(z))) SB.add(x);
          for (const z of S) if (F.every((y) => y === z)) USB.add(x);   // SB(z, u) 的并
        }
      }
      return { WB, SB, USB };
    }
    render() {
      const { WB, SB, USB } = this.sets();
      const n = BP_HI - BP_LO + 1, cw = 34, rh = 34, L = 108, T = 70;
      const rows = this.u === "all" ? [["S", this.S, "ok"], ["WB(S)", WB, "warn"], ["SB(S)", SB, "accent"]]
        : [["S", this.S, "ok"], [`WB(S, u)`, WB, "warn"], [`SB(S, u)`, SB, "accent"], ["∪ₓ SB(x, u)", USB, "accentSoft"]];
      const W = L + n * cw + 10, H = T + rows.length * rh + 10;
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "反向投影" });
      const defs = s("defs");
      [["bpa-ok", "var(--ok)"], ["bpa-bad", "var(--bad)"]].forEach(([id, c]) => defs.append(s("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: c }))));
      svg.append(defs);
      for (let x = BP_LO; x <= BP_HI; x++) svg.append(s("text", { x: L + (x - BP_LO + 0.5) * cw, y: T - 6, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, x));
      rows.forEach(([name, set, c], r) => {
        const y = T + r * rh;
        svg.append(s("text", { x: 4, y: y + rh / 2 + 4, "font-size": 12, fill: "var(--text-2)" }, name));
        for (let x = BP_LO; x <= BP_HI; x++) {
          const on = set.has(x);
          const fill = !on ? "var(--surface-2)" : c === "warn" ? C.cva("warn", 0.55) : c === "accentSoft" ? C.cva("accent", 0.35) : `var(--${c === "ok" ? "ok" : "accent"})`;
          const rect = s("rect", { x: L + (x - BP_LO) * cw + 2, y: y + 3, width: cw - 4, height: rh - 6, rx: 5, fill, stroke: "var(--border-strong)", "stroke-width": 0.6, style: "cursor:pointer" });
          rect.addEventListener("click", () => { if (r === 0) { this.S.has(x) ? this.S.delete(x) : this.S.add(x); this.render(); } });
          rect.addEventListener("mouseenter", () => { this.hover = x; this.drawHover(svg, L, T, cw); });
          svg.append(rect);
        }
      });
      svg.addEventListener("mouseleave", () => { this.hover = null; this.drawHover(svg, L, T, cw); });
      this.nrows = rows.length;
      this.svgWrap.innerHTML = ""; this.svgWrap.append(svg);
      this.drawHover(svg, L, T, cw);
      const fmtS = (A) => { const a = Array.from(A).filter((x) => x >= BP_LO - 6 && x <= BP_HI + 6).sort((p, q) => p - q); return a.length ? "{" + a.join(", ") + "}" : "∅"; };
      const uName = this.u === "all" ? "" : this.u === "T" ? ", u_T" : `, ${this.u}`;
      this.info.textContent = this.u === "all"
        ? `WB(S) = ${fmtS(WB)}\nSB(S) = ${fmtS(SB)}${this.allowT ? "" : "    （不允许 u_T）"}`
        : `WB(S${uName}) = ${fmtS(WB)}\nSB(S${uName}) = ${fmtS(SB)}\n∪_{x∈S} SB(x${uName}) = ${fmtS(USB)}${!setEq(USB, SB) ? "   ≠ SB(S, u)：强反向投影不能逐点求再取并（习题 1）" : ""}`;
    }
    // 鼠标所在的 x'：画出它在每个动作下的一步前向投影
    drawHover(svg, L, T, cw) {
      svg.querySelectorAll(".bp-hover").forEach((e) => e.remove());
      if (this.hover === null) return;
      const x = this.hover, cx = (v) => L + (v - BP_LO + 0.5) * cw, yb = T - 18;
      const g = s("g", { class: "bp-hover" });
      g.append(s("rect", { x: cx(x) - cw / 2 + 1, y: T + 1, width: cw - 2, height: this.nrows * 34 - 2, fill: "none", stroke: "var(--text-2)", "stroke-dasharray": "3 3", rx: 5 }));
      this.acts().forEach((u, k) => {
        const F = this.fp(x, u);
        F.forEach((z) => {
          const ok = this.S.has(z), x0 = cx(x), x1 = cx(z), hgt = 14 + k * 9;
          if (z === x) { g.append(s("circle", { cx: x0, cy: yb - hgt + 6, r: 5, fill: "none", stroke: ok ? "var(--ok)" : "var(--bad)", "stroke-width": 1.6 })); return; }
          g.append(s("path", { d: `M${x0},${yb} Q${(x0 + x1) / 2},${yb - hgt * 2} ${x1},${yb}`, fill: "none", stroke: ok ? "var(--ok)" : "var(--bad)", "stroke-width": 1.6, "marker-end": `url(#${ok ? "bpa-ok" : "bpa-bad"})` }));
        });
      });
      svg.append(g);
    }
  }
  const setEq = (A, B) => A.size === B.size && Array.from(A).every((x) => B.has(x));

  // ---------------------------------------------------------------
  // 图 10.1 的网格（坐标从 1 开始；内部用 0 起的下标）
  // ---------------------------------------------------------------
  function fig101Grid() {
    const obs = [], goal = [];
    for (let i = 5; i <= 9; i++) for (let j = 5; j <= 9; j++) obs.push(i + "," + j);
    for (let i = 10; i <= 14; i++) for (let j = 10; j <= 14; j++) goal.push(i + "," + j);
    return new C.Grid(15, 15, obs, goal, { origin: 1 });
  }

  // ---------------------------------------------------------------
  // 组件：网格上的自然（例 10.2、图 10.1）
  // ---------------------------------------------------------------
  class GridNature {
    constructor(root) {
      this.grid = fig101Grid(); this.x = this.grid.id(1, 1); this.u = 3; this.k = 1; this.model = { kind: "ex102" };
      const body = C.frame(root, "网格上的自然", "例 10.2：先执行 u，自然再从「此处可用的动作」里均匀地挑一个 θ；点任意格子换 x");
      this.st = new C.Stage({ view: [0, 15, 0, 15], maxW: 470, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const id = C.cellAt(this.grid, p); if (id >= 0 && this.grid.free(id)) { this.x = id; if (!this.grid.actions(id).includes(this.u)) this.u = 0; this.render(); } return null; },
        cursor: () => "pointer" });
      this.segA = h("div", { class: "seg" });
      this.segN = C.seg([["ex102", "例 10.2 的自然"], ["slip", "侧滑（补充）"]], "ex102", (k) => { this.model = k === "slip" ? { kind: "slip", p: 0.4 } : { kind: "ex102" }; this.render(); });
      this.sK = C.slider("一直用这个动作 k 步", 1, 10, 1, this.k, (v) => { this.k = v; this.render(); });
      this.info = h("div", { class: "small", style: "min-height:5em" });
      body.append(h("div", { class: "controls" }, h("span", { class: "small muted" }, "动作 u："), this.segA, this.segN), h("div", { class: "controls" }, this.sK),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.info,
          C.legend([[C.cv("accent"), "x 与 x + u", true], [C.cva("warn", 0.8), "可能的下一状态 / k 步分布"], [C.cva("ok", 0.3), "X_G"], [C.cva("wall", 0.85), "不属于 X"]]))));
      this.render();
    }
    render() {
      const acts = this.grid.actions(this.x);
      this.segA.innerHTML = "";
      for (let u = 0; u < 5; u++) {
        const b = h("button", { type: "button", class: u === this.u ? "on" : "", disabled: acts.includes(u) ? null : true, title: acts.includes(u) ? "" : "这个方向不在 U(x) 里" }, `${u} ${C.MOVE_NAME[u]}`);
        b.addEventListener("click", () => { this.u = u; this.render(); });
        this.segA.append(b);
      }
      // k 步前向投影（一直尝试 u；撞墙时改为停——补充约定）
      let P = new Map([[this.x, 1]]);
      for (let t = 0; t < this.k; t++) {
        const Q = new Map();
        for (const [z, pz] of P) {
          const u = this.grid.actions(z).includes(this.u) ? this.u : 0;
          for (const [y, p] of this.grid.succ(z, u, this.model)) Q.set(y, (Q.get(y) || 0) + pz * p);
        }
        P = Q;
      }
      this.P = P;
      const th = this.grid.nature(this.x, this.u, this.model);
      const thStr = th.map(([a]) => `${a}`).join(", "), names = th.map(([a]) => C.MOVE_NAME[a]).join("、");
      const [i, j] = this.grid.ij(this.x), y = this.grid.id(i + C.MOVES[this.u][0], j + C.MOVES[this.u][1]);
      let pG = 0; for (const [z, p] of P) if (this.grid.isGoal(z)) pG += p;
      this.info.innerHTML = `x = <b>${this.grid.label(this.x)}</b>，u = ${this.u}（${C.MOVE_NAME[this.u]}）→ x + u = ${this.grid.label(y)}<br>` +
        `Θ(x, u) = {${thStr}}（${names}），每个概率 ${this.model.kind === "ex102" ? "1/" + th.length : th.map(([, p]) => C.niceFrac(p)).join(" / ")}<br>` +
        `一步之后的可能状态：${this.grid.succ(this.x, this.u, this.model).map(([z, p]) => `${this.grid.label(z)} <span class="muted">${C.niceFrac(p)}</span>`).join("，")}<br>` +
        `k = ${this.k} 步后：${P.size} 个可能状态，落在 X_G 的概率 ${pG.toFixed(3)}`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      let pmax = 0; for (const p of this.P.values()) pmax = Math.max(pmax, p);
      C.drawGrid(st, this.grid, col, { fill: (id) => (this.P.has(id) && this.k > 1 ? C.mix(col.surface, col.warn, 0.15 + 0.7 * this.P.get(id) / pmax) : null) });
      const [i, j] = this.grid.ij(this.x), yi = i + C.MOVES[this.u][0], yj = j + C.MOVES[this.u][1];
      for (const [z] of this.grid.succ(this.x, this.u, this.model)) {
        const [zi, zj] = this.grid.ij(z);
        if (z === this.grid.id(yi, yj)) { st.dot(zi + 0.5, zj + 0.5, st.scale * 0.36, null, col.warn, 2.2); continue; }
        st.arrow(yi + 0.5, yj + 0.5, zi + 0.5, zj + 0.5, col.warn, 2.2, 8);
      }
      if (this.u !== 0) st.arrow(i + 0.5, j + 0.5, yi + 0.5, yj + 0.5, col.accent, 2.6, 9);
      st.dot(i + 0.5, j + 0.5, st.scale * 0.24, col.accent, col.surface, 1.5);
      st.dot(yi + 0.5, yj + 0.5, st.scale * 0.16, null, col.accent, 2);
      st.text("x_I", 0.5, 0.5, col.text2, { size: 10, dy: st.scale * 0.32 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：计划与它的执行（10.1.3 节）：G_π、按计划的前向投影、最坏 / 期望代价
  // ---------------------------------------------------------------
  const PG_W = 7, PG_H = 4;
  class PlanGraph {
    constructor(root) {
      const goal = []; for (let j = 0; j < PG_H; j++) goal.push((PG_W - 1) + "," + j);
      this.grid = new C.Grid(PG_W, PG_H, [], goal);
      this.model = { kind: "slip", p: 0.2 };
      this.mode = "edit"; this.x1 = this.grid.id(0, 0); this.k = 3; this.showEdges = true;
      this.preset("right");
      const body = C.frame(root, "计划、G_π 与代价", "处处侧滑（补充）：执行 u 后，自然可能把机器人横推一格；X_G = 最右一列");
      this.st = new C.Stage({ view: [0, PG_W, 0, PG_H], aspect: PG_H / PG_W, maxW: 600, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.click(C.cellAt(this.grid, p)); return null; }, cursor: () => "pointer" });
      this.segMode = C.seg([["edit", "点击：改 π(x)"], ["x1", "点击：选 x₁"]], this.mode, (k) => { this.mode = k; });
      this.sK = C.slider("前向投影 k", 1, 12, 1, this.k, (v) => { this.k = v; this.render(); });
      this.sP = C.slider("横滑概率", 0.05, 0.6, 0.05, this.model.p, (v) => { this.model.p = v; this.render(); }, (v) => v.toFixed(2));
      this.chk = C.checkbox("画出 G_π 的边", this.showEdges, (v) => { this.showEdges = v; this.render(); });
      this.stats = { g: C.stat("保证到达"), p: C.stat("只是可能到达"), n: C.stat("到不了"), w: C.stat("x₁ 的最坏代价 (10.31)"), e: C.stat("x₁ 的期望代价 (10.32)") };
      body.append(h("div", { class: "controls" }, h("span", { class: "small muted" }, "预设："), C.button("全部向右", () => { this.preset("right"); this.render(); }, "small"),
        C.button("踢皮球（像图 10.2a）", () => { this.preset("loop"); this.render(); }, "small"), C.button("加上死循环", () => { this.preset("trap"); this.render(); }, "small")),
        h("div", { class: "controls" }, this.segMode, this.chk), h("div", { class: "controls" }, this.sK, this.sP),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
        C.legend([[C.cva("ok", 0.35), "保证到达（所有自然动作序列都到 X_G）"], [C.cva("warn", 0.4), "只是可能到达"], [C.cva("bad", 0.35), "到不了"], [C.cv("accent"), "π(x)"], [C.cva("warn", 0.9), "G_π 的边 / 前向投影 X_k(x₁, π)"]]),
        h("p", { class: "small muted", style: "margin:6px 0 0" }, "每格里：上 = 最坏代价 (10.31)，下 = 期望代价 (10.32)。前向投影格子里的数字是 P(x_k | x₁, π)。"));
      this.render();
    }
    preset(name) {
      this.pi = new Int8Array(this.grid.N).fill(1);
      for (let j = 0; j < PG_H; j++) this.pi[this.grid.id(PG_W - 1, j)] = -1;
      const set = (i, j, u) => { this.pi[this.grid.id(i, j)] = u; };
      if (name === "loop" || name === "trap") { set(3, 1, 2); set(2, 2, 4); }
      if (name === "trap") { set(0, 0, 2); set(0, 1, 4); set(1, 0, 3); set(1, 1, 3); set(0, 2, 4); }
    }
    click(id) {
      if (id < 0) return;
      if (this.mode === "x1") { this.x1 = id; this.render(); return; }
      if (this.grid.isGoal(id)) return;
      const acts = this.grid.actions(id, true), order = [1, 2, 3, 4, 0].filter((u) => acts.includes(u));
      const k = order.indexOf(this.pi[id]);
      this.pi[id] = order[(k + 1) % order.length];
      this.render();
    }
    analyze() {
      const g = this.grid, N = g.N, nx = [];
      for (let x = 0; x < N; x++) nx.push(g.isGoal(x) ? [[x, 1]] : g.succ(x, this.pi[x], this.model));
      // 可能到达：G_π 中有到 X_G 的路
      const poss = new Uint8Array(N); for (let x = 0; x < N; x++) poss[x] = g.isGoal(x) ? 1 : 0;
      for (let changed = true; changed;) { changed = false; for (let x = 0; x < N; x++) if (!poss[x] && nx[x].some(([z]) => poss[z])) { poss[x] = 1; changed = true; } }
      // 最坏代价：最小不动点（只在保证到达的状态上有限）
      const worst = new Float64Array(N).fill(INF); for (let x = 0; x < N; x++) if (g.isGoal(x)) worst[x] = 0;
      for (let it = 0; it < N + 2; it++) for (let x = 0; x < N; x++) {
        if (g.isGoal(x)) continue; let m = 0; for (const [z] of nx[x]) m = Math.max(m, worst[z]); if (m < INF) worst[x] = Math.min(worst[x], 1 + m);
      }
      // 期望代价：以概率 1 到达 ⇔ 从 x 出发能到的每个状态都「可能到达」
      const prob1 = new Uint8Array(N);
      for (let x = 0; x < N; x++) {
        const seen = new Set([x]), st = [x]; let ok = true;
        while (st.length && ok) { const y = st.pop(); if (!poss[y]) { ok = false; break; } for (const [z] of nx[y]) if (!seen.has(z)) { seen.add(z); st.push(z); } }
        prob1[x] = ok ? 1 : 0;
      }
      const E = new Float64Array(N);
      for (let it = 0; it < 3000; it++) { let ch = 0; for (let x = 0; x < N; x++) { if (g.isGoal(x) || !prob1[x]) continue; let v = 1; for (const [z, p] of nx[x]) v += p * E[z]; ch = Math.max(ch, Math.abs(v - E[x])); E[x] = v; } if (ch < 1e-12) break; }
      for (let x = 0; x < N; x++) if (!prob1[x]) E[x] = INF;
      // 按计划的前向投影 (10.28)(10.29)
      let P = new Map([[this.x1, 1]]);
      for (let t = 1; t < this.k; t++) { const Q = new Map(); for (const [y, py] of P) for (const [z, p] of nx[y]) Q.set(z, (Q.get(z) || 0) + py * p); P = Q; }
      return { nx, poss, worst, E, P };
    }
    render() {
      this.A = this.analyze();
      const g = this.grid; let G = 0, Pn = 0, Nn = 0;
      for (let x = 0; x < g.N; x++) { if (g.isGoal(x)) continue; if (this.A.worst[x] < INF) G++; else if (this.A.poss[x]) Pn++; else Nn++; }
      this.stats.g.set(G); this.stats.p.set(Pn); this.stats.n.set(Nn);
      this.stats.w.set(C.fmt(this.A.worst[this.x1])); this.stats.e.set(C.fmt(this.A.E[this.x1], 3));
      this.st.draw();
    }
    draw(ctx, st, col) {
      const g = this.grid, A = this.A;
      C.drawGrid(st, g, col, { fill: (x) => g.isGoal(x) ? null : A.worst[x] < INF ? C.alpha(col.ok, 0.2) : A.poss[x] ? C.alpha(col.warn, 0.22) : C.alpha(col.bad, 0.2) });
      // 前向投影
      for (const [z, p] of A.P) {
        const [i, j] = g.ij(z);
        st.rect(i + 0.05, j + 0.05, i + 0.95, j + 0.95, null, col.warn, 2.5);
        st.text(C.fmt(p, 3), i + 0.5, j + 0.12, col.warn, { size: 10.5, weight: 650, base: "bottom", dy: 0 });
      }
      if (this.showEdges) for (let x = 0; x < g.N; x++) {
        if (g.isGoal(x)) continue; const [i, j] = g.ij(x);
        for (const [z] of A.nx[x]) { if (z === x) continue; const [zi, zj] = g.ij(z); st.arrow(i + 0.5, j + 0.5, i + 0.5 + (zi - i) * 0.78, j + 0.5 + (zj - j) * 0.78, C.alpha(col.warn, 0.55), 1.1, 6); }
      }
      for (let x = 0; x < g.N; x++) {
        const [i, j] = g.ij(x);
        if (g.isGoal(x)) { st.text("u_T", i + 0.5, j + 0.5, col.ok, { size: 12, weight: 650 }); continue; }
        C.drawArrow(st, i, j, this.pi[x], col.accent, 0.22, 2.4);
        st.text(C.fmt(A.worst[x]), i + 0.85, j + 0.82, col.text2, { size: 10.5, align: "right" });
        st.text(A.E[x] < INF ? A.E[x].toFixed(2) : "∞", i + 0.85, j + 0.2, col.muted, { size: 10, align: "right" });
      }
      const [xi, xj] = g.ij(this.x1);
      st.dot(xi + 0.16, xj + 0.82, 5, col.accent, col.surface, 1.5);
      st.text("x₁", xi + 0.16, xj + 0.82, col.accent, { size: 11, weight: 700, dx: 12 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='nl-forward']").forEach((el) => el._w = new NumberLineForward(el));
    document.querySelectorAll("[data-widget='backprojection']").forEach((el) => el._w = new Backprojection(el));
    document.querySelectorAll("[data-widget='grid-nature']").forEach((el) => el._w = new GridNature(el));
    document.querySelectorAll("[data-widget='plan-graph']").forEach((el) => el._w = new PlanGraph(el));
  });
  window.CH10.fig101Grid = fig101Grid;
})();
