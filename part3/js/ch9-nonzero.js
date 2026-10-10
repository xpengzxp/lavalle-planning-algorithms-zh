/* 9.4 节：双矩阵博弈的 Nash 均衡（图 9.5、例 9.17–9.20）与三人博弈的「改选图」（例 9.21） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH9;

  const BI = {
    ex917: { name: "例 9.17 (9.68)", A: [[9, 4, 7], [6, -1, 5], [1, 4, 2]], B: [[2, 1, 6], [5, 0, 2], [2, 2, 5]],
      note: "两个纯 Nash 均衡：(3,1) 代价 (1,2)，(2,2) 代价 (−1,0)。后者对双方都更好，是唯一可容许的。" },
    bos: { name: "例 9.18 性别之战 (9.69)", A: [[-2, 0], [0, -1]], B: [[-1, 0], [0, -2]],
      note: "u = v = 1（一起去购物）与 u = v = 2（一起看球）都是 Nash 均衡，代价 (−2,−1)、(−1,−2) 互不可比，都可容许；中间还有一个混合均衡 w₁ = 2/3、z₁ = 1/3（例 9.20）。" },
    pd: { name: "例 9.19 囚徒困境 (9.70)", A: [[8, 0], [30, 2]], B: [[8, 30], [0, 2]],
      note: "动作 1 = 与当局合作（坦白），2 = 拒绝。唯一的 Nash 均衡是双方都坦白、各判 8 年；双方都拒绝只判 2 年，却不是均衡——每个人都想改成坦白（0 年）。它同时也是双方的安全策略。" },
    pennies: { name: "猜硬币（双矩阵写法）", A: [[1, -1], [-1, 1]], B: [[-1, 1], [1, -1]],
      note: "B = −A，零和：没有纯 Nash 均衡，只有混合均衡 (1/2, 1/2)——就是随机化鞍点。" },
    chicken: { name: "胆小鬼博弈（补充）", A: [[0, -1], [1, 10]], B: [[0, 1], [-1, 10]],
      note: "动作 1 = 转向，2 = 直冲。按 (9.66)(9.67) 唯一的纯 Nash 均衡是双方都转向 (0,0)（代价越小越好）。" },
    zs963: { name: "例 9.16 写成 (A, −A)", A: [[3, 0], [-1, 1]], B: [[-3, 0], [1, -1]],
      note: "A = −B 时，Nash 均衡就是鞍点（图 9.5 → 图 9.2）。这里没有纯鞍点，混合均衡 w* = [2/5, 3/5]、z* = [1/5, 4/5]，与例 9.16 一致。" },
  };

  // ---------------------------------------------------------------
  // 组件：双矩阵博弈（式 9.66、9.67、9.71–9.78）
  // ---------------------------------------------------------------
  class Bimatrix {
    constructor(root) {
      const body = C.frame(root, "双矩阵博弈与 Nash 均衡", "每格是 (L₁, L₂)，两人都想让自己的数小");
      this.pre = C.select(Object.entries(BI).map(([k, v]) => [k, v.name]), "bos", (k) => this.load(k));
      this.ed = new C.MatrixEditor({ A: BI.bos.A, B: BI.bos.B, minR: 2, maxR: 3, minC: 2, maxC: 3, rowName: (i) => "u=" + (i + 1), colName: (j) => "v=" + (j + 1),
        corner: "L₁, L₂", onChange: () => this.update(), decorate: (ed) => this.decorate(ed) });
      this.sc = new C.Plot({ aspect: 0.85, maxW: 330, onDraw: (ctx, pl, col) => this.drawScatter(ctx, pl, col) });
      this.br = new C.Plot({ x: [0, 1], y: [0, 1], aspect: 1, maxW: 300, m: { l: 42, r: 12, t: 12, b: 36 }, onDraw: (ctx, pl, col) => this.drawBR(ctx, pl, col) });
      this.brBox = h("div", null, h("div", { class: "panel-title" }, "最好回应图（只对 2×2）"), this.br.wrap);
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "例子：", this.pre)),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, h("div", null, this.ed.el,
          C.legend([[C.cv("p1"), "该列中 L₁ 最小（P1 的最好回应）"], [C.cv("p2"), "该行中 L₂ 最小（P2 的最好回应）"], [C.cva("best", 0.35), "两者兼有 = Nash 均衡"]]), this.info),
          h("div", null, h("div", { class: "panel-title" }, "代价向量 (L₁, L₂)"), this.sc.wrap, this.brBox)));
      this.load("bos");
    }
    load(k) { this.key = k; this.ed.set(BI[k].A, BI[k].B); }
    decorate(ed) {
      const A = ed.A, B = ed.B;
      A.forEach((r, i) => r.forEach((a, j) => {
        const td = ed.td(i, j);
        const b1 = Math.abs(a - Math.min(...C.colOf(A, j))) < C.EPS, b2 = Math.abs(B[i][j] - Math.min(...B[i])) < C.EPS;
        if (b1) td.classList.add("br1"); if (b2) td.classList.add("br2"); if (b1 && b2) td.classList.add("nash");
      }));
    }
    update() {
      const A = this.ed.A, B = this.ed.B, ne = C.pureNash(A, B);
      const cv = ne.map(([i, j]) => [A[i][j], B[i][j]]);
      const adm = cv.filter((v) => !cv.some((w) => C.dominates(w, v)));
      // 安全策略：P1 看 A 的行最大，P2 看 B 的列最大（各自最坏情况）
      const r1 = A.map((r) => Math.max(...r)), c2 = A[0].map((_, j) => Math.max(...C.colOf(B, j)));
      const s1 = C.argminAll(r1), s2 = C.argminAll(c2);
      const mixed = A.length === 2 && A[0].length === 2 ? C.mixed2x2(A, B) : null;
      let html = `<p style="margin:8px 0 6px">纯 Nash 均衡（式 9.66、9.67）：${ne.length ? ne.map(([i, j]) => `(${i + 1},${j + 1}) → (${C.fmt(A[i][j])}, ${C.fmt(B[i][j])})`).join("；") : "<b class='no'>没有</b>"}。` +
        (ne.length > 1 ? ` 可容许（不被别的均衡支配）的：${adm.map((v) => `(${v.map((x) => C.fmt(x)).join(", ")})`).join("、")}。` : "") + `</p>` +
        `<p style="margin:0 0 6px">安全策略：P1 选 u = ${s1.map((i) => i + 1).join(" 或 ")}（最坏 ${C.fmt(Math.min(...r1))}），P2 选 v = ${s2.map((j) => j + 1).join(" 或 ")}（最坏 ${C.fmt(Math.min(...c2))}）。</p>`;
      if (mixed) {
        const w = [mixed.w1, 1 - mixed.w1], z = [mixed.z1, 1 - mixed.z1];
        html += `<p style="margin:0 0 6px">混合 Nash 均衡（无差别条件，式 9.77、9.78）：w₁ = ${C.fmt(mixed.w1)}，z₁ = ${C.fmt(mixed.z1)}，期望代价 (${C.fmt(C.expCost(A, w, z), 3)}, ${C.fmt(C.expCost(B, w, z), 3)})。</p>`;
      }
      if (BI[this.key] && this.sameAsPreset()) html += `<p class="muted" style="margin:0">${BI[this.key].note}</p>`;
      this.info.innerHTML = html;
      this.brBox.classList.toggle("hidden", !(A.length === 2 && A[0].length === 2));
      this.ne = ne; this.adm = adm; this.mixed = mixed;
      this.sc.draw(); this.br.draw();
    }
    sameAsPreset() { const p = BI[this.key]; return JSON.stringify(p.A) === JSON.stringify(this.ed.A) && JSON.stringify(p.B) === JSON.stringify(this.ed.B); }
    drawScatter(ctx, pl, col) {
      const A = this.ed.A, B = this.ed.B, xs = A.flat(), ys = B.flat();
      const pad = (a) => { const lo = Math.min(...a), hi = Math.max(...a), d = Math.max(1, (hi - lo) * 0.15); return [lo - d, hi + d]; };
      pl.setRange(pad(xs), pad(ys));
      pl.axes(col, { xt: C.ticks(...pl.o.x, 5), yt: C.ticks(...pl.o.y, 5), xl: "L₁（P1 的代价）", yl: "L₂（P2 的代价）" });
      // 代价向量相同的格子合并成一个点、一个标签
      const groups = new Map();
      A.forEach((r, i) => r.forEach((a, j) => {
        const key = a + "," + B[i][j], g = groups.get(key) || { p: { x: a, y: B[i][j] }, cells: [], isN: false };
        g.cells.push(`(${i + 1},${j + 1})`); if (this.ne.some(([u, v]) => u === i && v === j)) g.isN = true; groups.set(key, g);
      }));
      groups.forEach((g) => {
        const isA = g.isN && this.adm.some((v) => v[0] === g.p.x && v[1] === g.p.y);
        pl.dot(g.p, g.isN ? 7 : 4.5, g.isN ? (isA ? col.best : C.alpha(col.best, 0.45)) : C.alpha(col.muted, 0.55), g.isN ? col.surface : null, 2);
        pl.text(g.cells.join(" "), g.p, g.isN ? col.text : col.muted, { dy: -12, size: 10.5, weight: g.isN ? 650 : 500 });
      });
      if (this.mixed && A.length === 2) {
        const w = [this.mixed.w1, 1 - this.mixed.w1], z = [this.mixed.z1, 1 - this.mixed.z1];
        const p = { x: C.expCost(A, w, z), y: C.expCost(B, w, z) };
        pl.dot(p, 6, col.prob, col.surface, 2); pl.text("混合", p, col.prob, { dy: 13, size: 10.5, weight: 650 });
      }
    }
    drawBR(ctx, pl, col) {
      const A = this.ed.A, B = this.ed.B;
      if (A.length !== 2 || A[0].length !== 2) return;
      pl.axes(col, { xt: [0, 0.5, 1], yt: [0, 0.5, 1], xl: "w₁ = P(u=1)", yl: "z₁ = P(v=1)" });
      // P1：给定 z1，比较 u=1 与 u=2 的期望代价
      const d1 = (z) => (A[0][0] * z + A[0][1] * (1 - z)) - (A[1][0] * z + A[1][1] * (1 - z));  // <0 → w1 = 1
      const d2 = (w) => (B[0][0] * w + B[1][0] * (1 - w)) - (B[0][1] * w + B[1][1] * (1 - w));  // <0 → z1 = 1
      const P1 = [], P2 = [];
      for (let i = 0; i <= 400; i++) {
        const t = i / 400, a = d1(t), b = d2(t);
        P1.push(Math.abs(a) < 1e-9 ? null : { x: a < 0 ? 1 : 0, y: t });
        P2.push(Math.abs(b) < 1e-9 ? null : { x: t, y: b < 0 ? 1 : 0 });
      }
      const drawBR = (pts, color) => {
        // 相邻两点取值不同就用一段跳跃连接（无差别处整条线段都是最好回应）
        let prev = null;
        for (const p of pts) {
          if (p && prev) pl.line(prev, p, color, 3.5);
          if (p) prev = p;
        }
      };
      drawBR(P1, C.alpha(col.p1, 0.85)); drawBR(P2, C.alpha(col.p2, 0.85));
      this.ne.forEach(([i, j]) => pl.dot({ x: i === 0 ? 1 : 0, y: j === 0 ? 1 : 0 }, 7, col.best, col.surface, 2));
      if (this.mixed) pl.dot({ x: this.mixed.w1, y: this.mixed.z1 }, 7, col.best, col.surface, 2);
      pl.text("P1 的最好回应", { x: 0.02, y: 0.97 }, col.p1, { align: "left", size: 10.5, weight: 650 });
      pl.text("P2 的最好回应", { x: 0.98, y: 0.03 }, col.p2, { align: "right", size: 10.5, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：三人博弈的改选图（例 9.21，式 9.79）
  // ---------------------------------------------------------------
  const KEYS = ["111", "112", "121", "122", "211", "212", "221", "222"];
  const BOOK921 = { 111: [1, 1, -2], 112: [-4, 3, 1], 121: [2, -4, 2], 122: [-5, -5, 10], 211: [3, -2, -1], 212: [-6, -6, 12], 221: [2, 2, -4], 222: [-2, 3, -1] };
  class ThreePlayer {
    constructor(root) {
      this.L = JSON.parse(JSON.stringify(BOOK921)); this.sel = "211";
      const body = C.frame(root, "三人博弈：谁想改选？", "立方体的 8 个顶点是 8 种纯策略组合 (u¹, u², u³)；沿某个方向的边 = 那个玩家单独改选");
      this.pre = C.select([["book", "例 9.21（原书数据）"], ["fix", "把 L₁(1,1,1) 改成 4（补充）"], ["rand", "随机生成"]], "book", (k) => this.load(k));
      this.plot = new C.Plot({ x: [-0.55, 2.05], y: [-0.5, 1.75], aspect: 0.82, maxW: 470, equal: true, m: { l: 6, r: 6, t: 6, b: 6 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.pick(p), cursor: (p) => (this.hit(p) ? "pointer" : null) });
      this.table = h("table", { class: "mx three" });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "数据：", this.pre)),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)" },
          h("div", null, this.plot.wrap, C.legend([[C.cv("p1"), "P1 改选（左右）"], [C.cv("p2"), "P2 改选（上下）"], [C.cv("p3"), "P3 改选（前后）"], [C.cva("best", 0.6), "Nash：没有箭头离开", true]])),
          h("div", null, h("div", { class: "table-wrap", style: "margin:0" }, this.table), this.info)));
      this.buildTable(); this.update();
    }
    load(k) {
      if (k === "book") this.L = JSON.parse(JSON.stringify(BOOK921));
      else if (k === "fix") { this.L = JSON.parse(JSON.stringify(BOOK921)); this.L[111][0] = 4; }
      else { const r = C.rng(C.newSeed()); KEYS.forEach((q) => { this.L[q] = [0, 1, 2].map(() => Math.floor(r() * 13) - 6); }); }
      this.buildTable(); this.update();
    }
    pos(key) { const [i, j, k] = key.split("").map(Number); return { x: (i - 1) * 1.15 + (k - 1) * 0.55, y: (j - 1) * 0.95 + (k - 1) * 0.5 }; }
    hit(p) { return this.plot.ctx ? KEYS.find((q) => this.plot.pxDist(p, this.pos(q)) < 16) : null; }
    pick(p) { const q = this.hit(p); if (q) { this.sel = q; this.update(); } return null; }
    flip(key, i) { const a = key.split(""); a[i] = a[i] === "1" ? "2" : "1"; return a.join(""); }
    buildTable() {
      this.table.innerHTML = "";
      this.table.append(h("tr", null, h("th", { class: "corner" }, "(u¹,u²,u³)"), h("th", { class: "c p1h" }, "L₁"), h("th", { class: "c p2h" }, "L₂"), h("th", { class: "c p3h" }, "L₃")));
      this.rows = {};
      KEYS.forEach((q) => {
        const tr = h("tr", null, h("th", { class: "r" }, `(${q.split("").join(",")})`));
        [0, 1, 2].forEach((i) => {
          const inp = h("input", { type: "text", inputmode: "decimal", value: String(this.L[q][i]) });
          inp.addEventListener("input", () => { const v = C.parseNum(inp.value); inp.classList.toggle("bad-input", isNaN(v)); if (!isNaN(v)) { this.L[q][i] = v; this.update(); } });
          tr.append(h("td", { class: "cell" }, inp));
        });
        tr.addEventListener("click", (e) => { if (e.target.tagName !== "INPUT") { this.sel = q; this.update(); } });
        this.rows[q] = tr; this.table.append(tr);
      });
    }
    devs(q) { return [0, 1, 2].map((i) => { const o = this.flip(q, i); return { i, o, gain: this.L[q][i] - this.L[o][i] }; }).filter((d) => d.gain > C.EPS); }
    update() {
      this.nash = KEYS.filter((q) => !this.devs(q).length);
      KEYS.forEach((q) => { this.rows[q].classList.toggle("nashrow", this.nash.includes(q)); this.rows[q].classList.toggle("selrow", q === this.sel); });
      const d = this.devs(this.sel), L = this.L[this.sel], fmtK = (q) => `(${q.split("").join(",")})`;
      let html = `<p style="margin:8px 0 6px">纯 Nash 均衡（式 9.79）：${this.nash.length ? this.nash.map((q) => `${fmtK(q)} → (${this.L[q].map((x) => C.fmt(x)).join(", ")})`).join("；") : "<b class='no'>没有</b>"}。</p>`;
      html += `<p style="margin:0 0 6px">选中 ${fmtK(this.sel)}，代价 (${L.map((x) => C.fmt(x)).join(", ")})：` +
        (d.length ? d.map((x) => `P${x.i + 1} 改到 ${fmtK(x.o)} 能把自己的代价从 ${C.fmt(L[x.i])} 降到 ${C.fmt(this.L[x.o][x.i])}`).join("；") + "，所以<b class='no'>不是</b>均衡。"
          : "<b class='yes'>谁单独改选都不能更好</b>，是 Nash 均衡。") + `</p>`;
      if (this.pre.value === "book") html += `<p class="muted" style="margin:0">书中说有两个纯均衡，代价 (2,−4,2) 和 (3,−2,−1)。后者是 (2,1,1)，但 P1 改到 (1,1,1) 代价从 3 变成 1——按 (9.79) 它不是均衡，原书笔误（见脚注）。把 L₁(1,1,1) 改成不小于 3 的数（如第二个数据集），书中的说法就成立了。</p>`;
      this.info.innerHTML = html;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const pc = [col.p1, col.p2, col.p3];
      // 边：每条边连接只差一个玩家动作的两个顶点，箭头指向该玩家代价更小的一端
      KEYS.forEach((q) => [0, 1, 2].forEach((i) => {
        const o = this.flip(q, i); if (q > o) return;
        const a = this.pos(q), b = this.pos(o), g = this.L[q][i] - this.L[o][i];
        if (Math.abs(g) < C.EPS) { pl.line(a, b, C.alpha(pc[i], 0.6), 2, [5, 4]); return; }
        const [from, to] = g > 0 ? [a, b] : [b, a];
        pl.line(from, to, C.alpha(pc[i], 0.85), 2.4);
        const t = 0.62, m = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
        const ang = Math.atan2(-(pl.Y(to.y) - pl.Y(from.y)), pl.X(to.x) - pl.X(from.x));
        const X = pl.X(m.x), Y = pl.Y(m.y), s = 9;
        ctx.beginPath(); ctx.moveTo(X + s * Math.cos(ang), Y - s * Math.sin(ang));
        ctx.lineTo(X + s * Math.cos(ang + 2.5), Y - s * Math.sin(ang + 2.5)); ctx.lineTo(X + s * Math.cos(ang - 2.5), Y - s * Math.sin(ang - 2.5));
        ctx.closePath(); ctx.fillStyle = pc[i]; ctx.fill();
      }));
      KEYS.forEach((q) => {
        const p = this.pos(q), isN = this.nash.includes(q), isS = q === this.sel;
        pl.dot(p, isN ? 11 : 8, isN ? col.best : col.surface, isS ? col.text : col.strong, isS ? 3 : 1.5);
        pl.text(q.split("").join(","), p, col.text, { dy: -18, size: 11, weight: 650 });
        pl.text("(" + this.L[q].map((x) => C.fmt(x)).join(",") + ")", p, col.muted, { dy: 19, size: 10.5 });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='bimatrix']").forEach((el) => (el._w = new Bimatrix(el)));
    document.querySelectorAll("[data-widget='three-player']").forEach((el) => (el._w = new ThreePlayer(el)));
  });
  CH9.nonzero = { BI, BOOK921 };
})();
