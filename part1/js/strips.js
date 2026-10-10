/* 2.4 STRIPS：手电筒例子（Example 2.6）+ 状态爆炸计算器 */
(function () {
  "use strict";
  const { h, s, arrowDefs, onThemeChange } = PA;

  // ---- 共享模型（planning-graph.js、sat.js 也会用） ----
  const FL = {
    lits: ["O", "I1", "I2"],
    full: { O: "On(Cap, Flashlight)", I1: "In(Battery1, Flashlight)", I2: "In(Battery2, Flashlight)" },
    short: { O: "O(C,F)", I1: "I(B1,F)", I2: "I(B2,F)" },
    ops: [
      { id: "RC", name: "RemoveCap", pre: [["O", true]], eff: [["O", false]] },
      { id: "PC", name: "PlaceCap", pre: [["O", false]], eff: [["O", true]] },
      { id: "I1", name: "Insert(Battery1)", pre: [["O", false], ["I1", false]], eff: [["I1", true]] },
      { id: "I2", name: "Insert(Battery2)", pre: [["O", false], ["I2", false]], eff: [["I2", true]] },
    ],
    S: { O: true, I1: false, I2: false },
    G: { O: true, I1: true, I2: true },
    applicable(op, st) { return op.pre.every(([l, v]) => st[l] === v); },
    apply(op, st) { const n = Object.assign({}, st); op.eff.forEach(([l, v]) => { n[l] = v; }); return n; },
    bits(st) { return FL.lits.map((l) => (st[l] ? "1" : "0")).join(""); },
    fromBits(b) { const st = {}; FL.lits.forEach((l, i) => { st[l] = b[i] === "1"; }); return st; },
    isGoal(st) { return FL.lits.every((l) => FL.G[l] === undefined || st[l] === FL.G[l]); },
    litText(l, v, short) { return (v ? "" : "¬") + (short ? FL.short[l] : FL.full[l]); },
  };
  PA.flashlight = FL;

  class FlashlightLab {
    constructor(root) {
      this.root = root;
      this.st = Object.assign({}, FL.S);
      this.hist = [];
      this.build();
      this.render();
      onThemeChange(() => this.render());
    }
    build() {
      this.picHost = h("div", { class: "svg-wrap" });
      this.opsHost = h("div", { class: "chips", style: "margin:8px 0" });
      this.litHost = h("div");
      this.graphHost = h("div", { class: "svg-wrap" });
      this.histHost = h("div", { class: "small mono", style: "min-height:1.6em" });
      const reset = h("button", { class: "btn", type: "button" }, "重置到初始状态 S");
      reset.addEventListener("click", () => { this.stopAnim(); this.st = Object.assign({}, FL.S); this.hist = []; this.render(); });
      const solve = h("button", { class: "btn primary", type: "button" }, "BFS 求最短计划");
      solve.addEventListener("click", () => this.solve());
      this.solveMsg = h("div", { class: "small" });
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "手电筒：STRIPS 表示 ↔ 状态空间"), h("span", { class: "w-sub" }, "Example 2.6 · 图 2.17、2.18 · 2.4.2 节"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" },
          h("div", { class: "split", style: "grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))" },
            h("div", null, this.picHost,
              h("div", { class: "small muted", style: "margin-top:6px" }, "算子（灰色 = 前提条件不满足，鼠标悬停看原因）："), this.opsHost,
              h("div", { class: "controls" }, reset, solve), this.solveMsg,
              h("div", { class: "small muted" }, "已执行的算子序列："), this.histHost),
            h("div", { class: "panel", style: "align-self:start" }, h("div", { class: "panel-title" }, "当前状态：每个互补对选一个字面量 → 一个位串 x"), h("div", { class: "panel-body" }, this.litHost))),
          h("div", { class: "panel", style: "margin-top:12px" }, h("div", { class: "panel-title" }, "导出的状态转移图：2³ = 8 个状态（点相邻节点也能执行算子）"),
            h("div", { style: "max-width:520px;margin:0 auto;padding:6px" }, this.graphHost))));
    }

    render() {
      this.renderPic();
      this.renderOps();
      this.renderLits();
      this.renderGraph();
      this.histHost.textContent = this.hist.length ? this.hist.join(" → ") : "（还没有）";
    }

    renderPic() {
      const st = this.st, goal = FL.isGoal(st);
      const svg = s("svg", { viewBox: "0 0 380 175", role: "img", "aria-label": "手电筒示意图" });
      if (goal) svg.append(s("polygon", { points: "52,52 0,10 0,150 52,108", fill: "#ffd84d", opacity: 0.55 }));
      // 灯头
      svg.append(s("path", { d: "M52,50 L80,62 L80,98 L52,110 Z", fill: "var(--surface-3)", stroke: "var(--border-strong)", "stroke-width": 1.5 }));
      svg.append(s("rect", { x: 46, y: 50, width: 7, height: 60, rx: 2, fill: goal ? "#ffd84d" : "var(--surface-2)", stroke: "var(--border-strong)" }));
      // 筒身（半透明，能看到里面的电池）
      svg.append(s("rect", { x: 80, y: 62, width: 200, height: 36, rx: 6, fill: "var(--surface-2)", "fill-opacity": 0.6, stroke: "var(--border-strong)", "stroke-width": 1.5 }));
      svg.append(s("text", { x: 180, y: 56, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, "Flashlight"));
      // 电池
      const battery = (label, inside, slot) => {
        const tx = inside ? 92 + slot * 92 : 85 + slot * 105, ty = inside ? 69 : 128;
        const g = s("g", { style: `transform: translate(${tx}px, ${ty}px); transition: transform .45s ease` });
        g.append(s("rect", { x: 0, y: 0, width: 82, height: 22, rx: 4, fill: slot === 0 ? "#3f7fd9" : "#2fa36b", stroke: "rgba(0,0,0,.25)" }));
        g.append(s("rect", { x: -5, y: 6, width: 5, height: 10, rx: 1.5, fill: "#9aa3ad" }));
        g.append(s("text", { x: 41, y: 15.5, "text-anchor": "middle", "font-size": 11, fill: "#fff", "font-weight": 600 }, label));
        return g;
      };
      svg.append(battery("Battery1", st.I1, 0), battery("Battery2", st.I2, 1));
      // 盖子
      const cap = s("g", { style: `transform: ${st.O ? "translate(280px, 58px)" : "translate(318px, 100px) rotate(25deg)"}; transition: transform .45s ease` });
      cap.append(s("rect", { x: 0, y: 0, width: 20, height: 44, rx: 4, fill: "#d36a3a", stroke: "rgba(0,0,0,.25)" }));
      cap.append(s("text", { x: 10, y: 60, "text-anchor": "middle", "font-size": 11, fill: "var(--text-2)" }, "Cap"));
      svg.append(cap);
      if (goal) svg.append(s("text", { x: 180, y: 170, "text-anchor": "middle", "font-size": 13, fill: "var(--ok)", "font-weight": 700 }, "目标达成：G 中所有字面量为真"));
      this.picHost.innerHTML = "";
      this.picHost.append(svg);
    }

    renderOps() {
      this.opsHost.innerHTML = "";
      FL.ops.forEach((op) => {
        const ok = FL.applicable(op, this.st);
        const fails = op.pre.filter(([l, v]) => this.st[l] !== v).map(([l, v]) => FL.litText(l, v, true));
        const b = h("button", { class: "chip" + (ok ? " on" : ""), type: "button", disabled: !ok, title: ok ? "前提满足，可以执行" : "不满足：" + fails.join("，"), style: ok ? null : "opacity:.45;cursor:not-allowed" }, op.name);
        b.addEventListener("click", () => this.applyOp(op));
        this.opsHost.append(b);
      });
    }

    applyOp(op) {
      if (!FL.applicable(op, this.st)) return;
      this.st = FL.apply(op, this.st);
      this.hist.push(op.name);
      this.render();
    }

    renderLits() {
      const t = h("table", { class: "data" });
      t.append(h("thead", null, h("tr", null, h("th", null, "互补对"), h("th", { class: "c" }, "当前"), h("th", { class: "c" }, "位"), h("th", { class: "c" }, "目标 G"))));
      const tb = h("tbody");
      FL.lits.forEach((l) => {
        const v = this.st[l];
        tb.append(h("tr", null, h("td", { class: "mono", style: "font-size:12px" }, FL.full[l]),
          h("td", { class: "c" }, h("span", { class: v ? "yes" : "no" }, v ? "正 ✓" : "负 ¬")),
          h("td", { class: "c mono" }, v ? "1" : "0"),
          h("td", { class: "c mono" }, FL.G[l] ? "1" : "0")));
      });
      t.append(tb);
      this.litHost.innerHTML = "";
      this.litHost.append(t, h("div", { class: "small", style: "margin-top:6px", html: `x = <b class="mono">${FL.bits(this.st)}</b>　（顺序：O, I1, I2；初始 S 只写正字面量 {On(Cap,Flashlight)}，其余默认为负 → x<sub>I</sub> = 100）` }));
    }

    renderGraph() {
      const pos = (b) => { const O = +b[0], I1 = +b[1], I2 = +b[2]; return { x: 55 + I1 * 175 + I2 * 85, y: 215 - O * 125 - I2 * 55 }; };
      const svg = s("svg", { viewBox: "0 0 380 250", role: "img", "aria-label": "八个状态的转移图" });
      arrowDefs(svg, { "fl-arr": "var(--muted)", "fl-arr-hl": "var(--c-current)" });
      const cur = FL.bits(this.st);
      const all = ["000", "001", "010", "011", "100", "101", "110", "111"];
      // 边
      all.forEach((b) => {
        const st = FL.fromBits(b);
        FL.ops.forEach((op) => {
          if (!FL.applicable(op, st)) return;
          const b2 = FL.bits(FL.apply(op, st));
          const p = pos(b), q = pos(b2);
          const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
          const off = op.id === "RC" || op.id === "PC" ? 7 : 0;
          const R = 20;
          const x1 = p.x + (dx / L) * R + nx * off, y1 = p.y + (dy / L) * R + ny * off;
          const x2 = q.x - (dx / L) * R + nx * off, y2 = q.y - (dy / L) * R + ny * off;
          const hot = b === cur;
          svg.append(s("line", { x1, y1, x2, y2, stroke: hot ? "var(--c-current)" : "var(--muted)", "stroke-width": hot ? 2.2 : 1.2, "marker-end": `url(#${hot ? "fl-arr-hl" : "fl-arr"})`, opacity: hot ? 1 : 0.7 }));
          const lx = (x1 + x2) / 2 + nx * 11, ly = (y1 + y2) / 2 + ny * 11 + 4;
          svg.append(s("text", { x: lx, y: ly, "text-anchor": "middle", "font-size": 10.5, fill: hot ? "var(--c-current)" : "var(--muted)", "font-weight": hot ? 700 : 400 }, op.id));
        });
      });
      // 节点
      all.forEach((b) => {
        const p = pos(b);
        const isCur = b === cur, isI = b === "100", isG = b === "111";
        const nextOp = FL.ops.find((op) => FL.applicable(op, this.st) && FL.bits(FL.apply(op, this.st)) === b);
        const g = s("g", { style: nextOp ? "cursor:pointer" : null });
        g.append(s("circle", { cx: p.x, cy: p.y, r: 19, fill: isCur ? "var(--accent)" : "var(--surface)", stroke: isG ? "var(--c-goal)" : isI ? "var(--c-start)" : "var(--border-strong)", "stroke-width": isG || isI ? 2.5 : 1.3 }));
        g.append(s("text", { x: p.x, y: p.y + 4.5, "text-anchor": "middle", "font-size": 13, "font-family": "ui-monospace, Menlo, monospace", fill: isCur ? "#fff" : "var(--text)", "font-weight": 600 }, b));
        if (isI) g.append(s("text", { x: p.x - 30, y: p.y + 4, "text-anchor": "middle", "font-size": 11, fill: "var(--c-start)" }, "x_I"));
        if (isG) g.append(s("text", { x: p.x + 30, y: p.y + 4, "text-anchor": "middle", "font-size": 11, fill: "var(--c-goal)" }, "X_G"));
        if (nextOp) g.addEventListener("click", () => this.applyOp(nextOp));
        svg.append(g);
      });
      svg.append(s("text", { x: 372, y: 245, "text-anchor": "end", "font-size": 10.5, fill: "var(--muted)" }, "竖直方向 = O，水平 = I1，斜向 = I2"));
      this.graphHost.innerHTML = "";
      this.graphHost.append(svg);
    }

    solve() {
      this.stopAnim();
      const start = FL.bits(this.st);
      const prev = { [start]: null }, Q = [start];
      while (Q.length) {
        const b = Q.shift();
        if (FL.isGoal(FL.fromBits(b))) {
          const plan = [];
          for (let k = b; prev[k]; k = prev[k][0]) plan.unshift(prev[k][1]);
          this.solveMsg.innerHTML = plan.length ? `最短计划（${plan.length} 步）：<b>${plan.map((o) => o.name).join(", ")}</b>` : "已经在目标状态了。";
          let i = 0;
          const stepAnim = () => { if (i >= plan.length) return; this.applyOp(plan[i++]); this.anim = setTimeout(stepAnim, 750); };
          this.anim = setTimeout(stepAnim, 300);
          return;
        }
        FL.ops.forEach((op) => {
          const st = FL.fromBits(b);
          if (!FL.applicable(op, st)) return;
          const b2 = FL.bits(FL.apply(op, st));
          if (!(b2 in prev)) { prev[b2] = [b, op]; Q.push(b2); }
        });
      }
      this.solveMsg.innerHTML = `<span class="no">从当前状态到不了目标：搜索返回 FAILURE。</span>`;
    }
    stopAnim() { clearTimeout(this.anim); }
  }

  // ---- 状态爆炸计算器（式 2.26） ----
  class Explosion {
    constructor(root) {
      this.root = root;
      this.v = { P: 2, I: 4, k: 2 };
      const row = (key, label, min, max) => {
        const out = h("b", { class: "mono" }, this.v[key]);
        const r = h("input", { type: "range", min, max, value: this.v[key], "aria-label": label });
        r.addEventListener("input", () => { this.v[key] = +r.value; out.textContent = r.value; this.render(); });
        return h("label", { style: "display:flex;gap:10px;align-items:center" }, h("span", { style: "min-width:150px" }, label), r, out);
      };
      this.out = h("div");
      root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "状态空间有多大？"), h("span", { class: "w-sub" }, "式 (2.26)：2^{|P||I|^k}"), h("span", { class: "w-badge" }, "计算器")),
        h("div", { class: "widget-body" },
          h("div", { style: "display:flex;flex-direction:column;gap:6px" },
            row("P", "谓词数 |P|", 1, 10), row("I", "实例数 |I|", 1, 30), row("k", "每个谓词的参数个数 k", 1, 3)),
          this.out));
      this.render();
    }
    render() {
      const { P, I, k } = this.v;
      const n = P * Math.pow(I, k);
      const log10 = n * Math.LOG10E * Math.LN2;
      let size;
      if (n <= 40) size = Number(2 ** n).toLocaleString("en-US");
      else size = `≈ 10^${Math.floor(log10)}`;
      const cmp = log10 >= 80 ? "已经超过可观测宇宙中的原子数（约 10^80）！" : log10 >= 19 ? "比魔方的状态数（约 4.3 × 10^19）还多。" : log10 >= 9 ? "几十亿量级：显式存下来已经很吃力。" : "还能显式列举。";
      this.out.innerHTML = "";
      this.out.append(h("div", { class: "stats" },
        h("div", { class: "stat" }, h("span", { class: "k" }, "互补对（位串长度）|P||I|^k"), h("span", { class: "v" }, n.toLocaleString("en-US"))),
        h("div", { class: "stat" }, h("span", { class: "k" }, "状态数 2^{|P||I|^k}"), h("span", { class: "v" }, size))),
        h("div", { class: "msg info" }, cmp + " 输入只需要写下几个谓词、实例和算子——这就是为什么逻辑表示被看成一种「压缩」，而对 |P|、|I| 来说，2.2 节的搜索算法是指数级的。"));
    }
  }

  // ---- 2.5.1 部分计划：因果链接与「威胁」（Example 2.7 的延伸） ----
  class PartialPlan {
    constructor(root) {
      this.root = root;
      this.reset();
      this.body = h("div");
      const bAdd = h("button", { class: "btn", type: "button" }, "加入 PlaceCap（不加任何顺序约束）");
      const bDem = h("button", { class: "btn", type: "button" }, "解决方式 A：PlaceCap ≺ RemoveCap");
      const bPro = h("button", { class: "btn", type: "button" }, "解决方式 B：Insert(Battery1) ≺ PlaceCap");
      const bRst = h("button", { class: "btn", type: "button" }, "回到例 2.7");
      bAdd.addEventListener("click", () => { if (!this.ops.includes("PC")) this.ops.push("PC"); this.render(); });
      bDem.addEventListener("click", () => { if (this.ops.includes("PC")) { this.order = this.order.filter((o) => !(o[0] === "I1" && o[1] === "PC")); this.order.push(["PC", "RC"]); } this.render(); });
      bPro.addEventListener("click", () => { if (this.ops.includes("PC")) { this.order = this.order.filter((o) => !(o[0] === "PC" && o[1] === "RC")); this.order.push(["I1", "PC"]); } this.render(); });
      bRst.addEventListener("click", () => { this.reset(); this.render(); });
      this.btns = { bDem, bPro };
      root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "部分计划：顺序约束 + 因果链接"), h("span", { class: "w-sub" }, "Example 2.7 · 图 2.19 中的两类「缺陷」"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" }, h("div", { class: "controls" }, bAdd, bDem, bPro, bRst), this.body));
      this.render();
    }
    reset() { this.ops = ["RC", "I1"]; this.order = [["RC", "I1"]]; }
    before(a, b) {
      // 传递闭包
      const seen = new Set([a]), st = [a];
      while (st.length) { const x = st.pop(); this.order.forEach(([p, q]) => { if (p === x && !seen.has(q)) { seen.add(q); st.push(q); } }); }
      return seen.has(b) && a !== b;
    }
    linearizations() {
      const res = [];
      const perm = (rest, acc) => {
        if (!rest.length) { res.push(acc.slice()); return; }
        rest.forEach((o, i) => {
          if (rest.some((q) => q !== o && this.before(q, o))) return;
          acc.push(o); perm(rest.filter((_, j) => j !== i), acc); acc.pop();
        });
      };
      perm(this.ops.slice(), []);
      return res;
    }
    render() {
      const opById = Object.fromEntries(FL.ops.map((o) => [o.id, o]));
      const hasPC = this.ops.includes("PC");
      const threat = hasPC && !this.before("PC", "RC") && !this.before("I1", "PC");
      this.btns.bDem.disabled = !hasPC; this.btns.bPro.disabled = !hasPC;
      const svg = s("svg", { viewBox: "0 0 640 190", role: "img", "aria-label": "部分计划" });
      arrowDefs(svg, { "pp-o": "var(--muted)", "pp-c": "var(--ok)", "pp-t": "var(--bad)" });
      const P = { S: [50, 70], RC: [200, 70], I1: [380, 70], G: [580, 70], PC: [290, 160] };
      const node = (id, label, fill, stroke) => {
        const [x, y] = P[id];
        svg.append(s("rect", { x: x - 62, y: y - 16, width: 124, height: 32, rx: 8, fill, stroke }));
        svg.append(s("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 12.5, fill: "var(--text)" }, label));
      };
      const arrow = (a, b, color, mk, dash) => {
        const [x1, y1] = P[a], [x2, y2] = P[b];
        const dx = x2 - x1, dy = y2 - y1;
        // 从矩形中心沿连线走到矩形边界（半宽 62，半高 16）所占的比例
        const t = Math.min(dx ? 64 / Math.abs(dx) : Infinity, dy ? 18 / Math.abs(dy) : Infinity);
        svg.append(s("line", { x1: x1 + dx * t, y1: y1 + dy * t, x2: x2 - dx * t, y2: y2 - dy * t, stroke: color, "stroke-width": 1.8, "marker-end": `url(#${mk})`, "stroke-dasharray": dash || null }));
      };
      // 顺序约束（隐含 Start ≺ 一切 ≺ Finish）
      arrow("S", "RC", "var(--muted)", "pp-o"); arrow("I1", "G", "var(--muted)", "pp-o");
      this.order.forEach(([a, b]) => arrow(a, b, "var(--muted)", "pp-o"));
      if (hasPC && !this.order.some((o) => o.includes("PC"))) { arrow("S", "PC", "var(--border-strong)", "pp-o", "3 3"); arrow("PC", "G", "var(--border-strong)", "pp-o", "3 3"); }
      // 因果链接
      svg.append(s("path", { d: "M200,54 Q290,0 380,54", fill: "none", stroke: "var(--ok)", "stroke-width": 2.2, "marker-end": "url(#pp-c)" }));
      svg.append(s("text", { x: 290, y: 20, "text-anchor": "middle", "font-size": 12, fill: "var(--ok)", "font-weight": 600 }, "因果链接：¬On(Cap,F)"));
      if (threat) {
        svg.append(s("line", { x1: 290, y1: 144, x2: 290, y2: 32, stroke: "var(--bad)", "stroke-width": 2, "stroke-dasharray": "5 4", "marker-end": "url(#pp-t)" }));
        svg.append(s("text", { x: 300, y: 118, "font-size": 12, fill: "var(--bad)", "font-weight": 700 }, "威胁！"));
      }
      node("S", "Start（S）", "var(--surface-2)", "var(--border-strong)");
      node("G", "Finish（目标）", "var(--surface-2)", "var(--border-strong)");
      node("RC", "RemoveCap", "var(--accent-soft)", "var(--accent)");
      node("I1", "Insert(Battery1)", "var(--accent-soft)", "var(--accent)");
      if (hasPC) node("PC", "PlaceCap", threat ? "var(--bad-soft)" : "var(--warn-soft)", threat ? "var(--bad)" : "var(--warn)");

      const lins = this.linearizations();
      const sim = (seq) => {
        let st = Object.assign({}, FL.S);
        for (const id of seq) { const op = opById[id]; if (!FL.applicable(op, st)) return { ok: false, at: op.name, why: op.pre.filter(([l, v]) => st[l] !== v).map(([l, v]) => FL.litText(l, v, true)).join("、") }; st = FL.apply(op, st); }
        return { ok: true };
      };
      const list = h("ul", { class: "small", style: "margin:4px 0" });
      lins.forEach((seq) => {
        const r = sim(seq);
        list.append(h("li", { html: `(${seq.map((id) => opById[id].name).join(", ")})　` + (r.ok ? `<span class="yes">从 S 出发可以执行 ✓</span>` : `<span class="no">✗ 执行到 ${r.at} 时前提 ${r.why} 不成立</span>`) }));
      });
      let msg;
      if (!hasPC) msg = "这个部分计划 σ：O<sub>σ</sub> = {RemoveCap, Insert(Battery1)}，RemoveCap ≺<sub>σ</sub> Insert(Battery1)，以及一条因果链接 (RemoveCap, ¬On(Cap,F), Insert(Battery1))——RemoveCap 产生了 Insert 需要的前提。";
      else if (threat) msg = "PlaceCap 的效果 On(Cap,F) 恰好是因果链接上字面量 ¬On(Cap,F) 的否定，而现在的顺序约束允许它落在 RemoveCap 和 Insert(Battery1) 之间——这就是图 2.19 第 2 步说的「威胁」（threat）。下面列出的线性化里，确实有一个因此失败。";
      else if (this.before("PC", "RC")) msg = "方式 A 把 PlaceCap 挪到 RemoveCap 之前：威胁解除了，但 PlaceCap 自己的前提 ¬On(Cap,F) 在初始状态 S 里不成立——又产生了一个「未达成的前提」缺陷（图 2.19 第 4 步），还得再加算子去满足它。";
      else msg = "方式 B 规定 PlaceCap 在 Insert(Battery1) 之后：威胁解除，唯一的线性化可以执行。（这两种解决办法在文献里通常叫 demotion 和 promotion。）";
      this.body.innerHTML = "";
      this.body.append(h("div", { class: "svg-wrap" }, svg), h("div", { class: "msg " + (threat ? "bad" : "info"), html: msg }),
        h("div", { class: "small", style: "font-weight:600;margin-top:8px" }, `这个部分计划代表的全部线性顺序（${lins.length} 个）：`), list);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='partial-plan']").forEach((el) => new PartialPlan(el));
    document.querySelectorAll("[data-widget='flashlight']").forEach((el) => new FlashlightLab(el));
    document.querySelectorAll("[data-widget='explosion']").forEach((el) => new Explosion(el));
  });
})();
