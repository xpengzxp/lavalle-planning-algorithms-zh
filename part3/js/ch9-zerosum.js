/* 9.3 节：零和矩阵博弈实验室（安全策略、上 / 下值、鞍点、遗憾、随机化值）与上 / 下包络（图 9.4） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH9;

  const GAMES = {
    g942: { name: "例 9.13 (9.42)", A: [[1, 3, 3, 2], [0, -1, 2, 1], [-2, 2, 0, 1]] },
    g953: { name: "例 9.14 (9.53) 鞍点", A: [[3, 3, 5], [1, -1, 7], [0, -2, 4]] },
    g954: { name: "例 9.15 (9.54) 多个鞍点", A: [[4, 3, 5, 1, 2], [-1, 0, -2, 0, -1], [-4, 1, 4, 3, 5], [-3, 0, -1, 0, -2], [3, 2, -7, 3, 8]] },
    g963: { name: "例 9.16 (9.63)", A: [[3, 0], [-1, 1]] },
    ex15: { name: "习题 15 (9.97)", A: [[0, -1], [-1, 2]] },
    pennies: { name: "猜硬币（例 9.7）", A: [[1, -1], [-1, 1]] },
    rps: { name: "石头剪刀布", A: [[0, 1, -1], [-1, 0, 1], [1, -1, 0]] },
    g24: { name: "2×4（补充）", A: [[3, -1, 2, 0], [-2, 4, -1, 1]] },
    g32: { name: "3×2（补充）", A: [[3, -1], [0, 2], [-2, 4]] },
    g33: { name: "3×3（补充）", A: [[2, -1, 0], [-1, 1, 2], [0, 3, -2]] },
  };
  const rowN = (i) => "u=" + (i + 1), colN = (j) => "v=" + (j + 1);
  const vecS = (v) => "[" + v.map((x) => C.fmt(x, 3, 60)).join(", ") + "]";

  // ---------------------------------------------------------------
  // 组件：零和矩阵博弈实验室（式 9.43–9.54；9.3.3 节的随机化值）
  // ---------------------------------------------------------------
  class MatrixGame {
    constructor(root) {
      this.sel = null;
      const keys = ["g942", "g953", "g954", "g963", "ex15", "pennies", "rps"];
      const body = C.frame(root, "零和矩阵博弈实验室", "P1 选行、想让 L 小；P2 选列、想让 L 大。点一个格子看双方的遗憾");
      this.pre = C.select(keys.map((k) => [k, GAMES[k].name]).concat([["rand", "随机 4×4"]]), "g942", (k) => this.load(k));
      this.ed = new C.MatrixEditor({ A: GAMES.g942.A, rowName: rowN, colName: colN, corner: "L(u,v)", xcols: ["行最大"], xrows: ["列最小"],
        onChange: () => { this.sel = null; this.update(); }, onCell: (i, j) => { this.sel = [i, j]; this.update(); }, decorate: (ed) => this.decorate(ed) });
      this.stats = ["上值 L̄*（9.45）", "下值 L̲*（9.47）", "总遗憾 L̄* − L̲*（9.50）", "鞍点个数", "随机化值 𝓛*"].map((k) => C.stat(k));
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "例子：", this.pre)),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)" }, h("div", null, this.ed.el,
          C.legend([[C.cva("p1", 0.22), "P1 的安全策略 u*（行）"], [C.cva("p2", 0.25), "P2 的安全策略 v*（列）"], [C.cva("best", 0.35), "鞍点"], [C.cv("text"), "选中的格子（粗框）"]])),
          h("div", null, h("div", { class: "stats" }, this.stats), this.info)));
      this.update();
    }
    load(k) {
      let A;
      if (k === "rand") { const r = C.rng(C.newSeed()); A = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.floor(r() * 11) - 5)); }
      else A = GAMES[k].A;
      this.sel = null; this.ed.set(A);
    }
    decorate(ed) {
      const A = ed.A, s = C.security(A), sad = C.saddles(A);
      A.forEach((r, i) => {
        ed.xc[0][i].textContent = C.fmt(s.rowMax[i]);
        if (s.us.includes(i)) { ed.xc[0][i].classList.add("best"); r.forEach((_, j) => ed.td(i, j).classList.add("secr")); }
      });
      s.colMin.forEach((v, j) => {
        ed.xr[0][j].textContent = C.fmt(v);
        if (s.vs.includes(j)) { ed.xr[0][j].classList.add("best"); A.forEach((_, i) => ed.td(i, j).classList.add("secc")); }
      });
      sad.forEach(([i, j]) => ed.td(i, j).classList.add("saddle"));
      const sel = this.sel || [s.us[0], s.vs[0]];
      const [si, sj] = sel;
      ed.td(si, sj).classList.add("sel");
      A[si].forEach((_, j) => { if (j !== sj) ed.td(si, j).classList.add("inrow"); });
      A.forEach((_, i) => { if (i !== si) ed.td(i, sj).classList.add("incol"); });
    }
    update() {
      const A = this.ed.A, s = C.security(A), sad = C.saddles(A), z = C.solveZeroSum(A);
      this.stats[0].set(C.fmt(s.upper)); this.stats[1].set(C.fmt(s.lower)); this.stats[2].set(C.fmt(s.upper - s.lower));
      this.stats[3].set(String(sad.length)); this.stats[4].set(C.fmt(z.value, 3, 120));
      const [si, sj] = this.sel || [s.us[0], s.vs[0]];
      const L = A[si][sj], col = C.colOf(A, sj), row = A[si];
      const r1 = L - Math.min(...col), r2 = Math.max(...row) - L;
      const b1 = C.argminAll(col).map(rowN).join("、"), b2 = C.argmaxAll(row).map(colN).join("、");
      let html = `<p style="margin:0 0 6px">选中 (${rowN(si)}, ${colN(sj)})，代价 L = <b>${C.fmt(L)}</b>${this.sel ? "" : "（默认是双方的安全策略）"}。</p>` +
        `<p style="margin:0 0 6px">P1 的遗憾：在这一列里最小是 ${C.fmt(Math.min(...col))}（${b1}），${r1 ? `本可以少付 <b class="no">${C.fmt(r1)}</b>` : `<b class="yes">没有遗憾</b>`}。` +
        `P2 的遗憾：这一行里最大是 ${C.fmt(Math.max(...row))}（${b2}），${r2 ? `本可以多得 <b class="no">${C.fmt(r2)}</b>` : `<b class="yes">没有遗憾</b>`}。</p>`;
      if (sad.length) html += `<p style="margin:0 0 6px">L̲* = L̄* = ${C.fmt(s.upper)}：有鞍点 ${sad.map(([i, j]) => `(${i + 1},${j + 1})`).join("、")}，它在所在行最大、所在列最小（图 9.2 的「+」形）。` + (sad.length > 1 ? "多个鞍点的值都相同，所以双方不用协调（图 9.3）。" : "") + `</p>`;
      else html += `<p style="margin:0 0 6px">L̲* = ${C.fmt(s.lower)} < L̄* = ${C.fmt(s.upper)}：没有确定性鞍点，总有人会后悔。</p>`;
      html += `<p style="margin:0">随机化后（9.3.3 节，线性规划）：w* = ${vecS(z.w)}，z* = ${vecS(z.z)}ᵀ，𝓛* = ${C.fmt(z.value, 3, 120)}，夹在 L̲* 与 L̄* 之间。</p>`;
      if (this.pre.value === "g942" && !this.sel) html += `<p class="muted" style="margin:6px 0 0">书中这一段说 P2 本该选 v = 2 得到 L(2,2) = 2；表里 L(2,2) = −1，能让 P2 得 2 的是 v = 3（原书笔误，见脚注）。</p>`;
      this.info.innerHTML = html;
    }
  }

  // ---------------------------------------------------------------
  // 组件：上包络 / 下包络（图 9.4、例 9.16、习题 17）；3 个动作时画在单纯形上
  // ---------------------------------------------------------------
  class Envelope {
    constructor(root) {
      this.w = [0.5, 0.5, 0]; this.z = [0.5, 0.5, 0];
      const keys = ["g963", "ex15", "pennies", "g24", "g32", "rps", "g33"];
      const body = C.frame(root, "随机化安全策略：上包络与下包络", "固定 w 后 L̄(w,z) 对 z 是线性的，P2 只需考虑纯策略");
      this.pre = C.select(keys.map((k) => [k, GAMES[k].name]), "g963", (k) => { this.ed.set(GAMES[k].A); });
      this.ed = new C.MatrixEditor({ A: GAMES.g963.A, rowName: rowN, colName: colN, corner: "L", minR: 2, maxR: 3, minC: 2, maxC: 4, onChange: () => this.update() });
      const mk = (who) => new C.Plot({ x: [0, 1], y: [-1, 1], aspect: 0.8, maxW: 380, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col, who),
        onDown: (p) => this.drag(p, who), onMove: (p) => this.drag(p, who), cursor: () => "ew-resize" });
      this.pa = mk("P1"); this.pb = mk("P2");
      this.ia = h("p", { class: "small" }); this.ib = h("p", { class: "small" });
      this.sum = h("div", { class: "msg info small" });
      body.append(h("div", { class: "controls" }, h("label", null, "例子：", this.pre)),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)" }, this.ed.el, this.sum),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr);margin-top:10px" },
          h("div", null, h("div", { class: "panel-title" }, "(a) P1 求 w*：上包络的最低点"), this.pa.wrap, this.ia),
          h("div", null, h("div", { class: "panel-title" }, "(b) P2 求 z*：下包络的最高点"), this.pb.wrap, this.ib)));
      this.update();
    }
    drag(p, who) {
      const A = this.ed.A, k = who === "P1" ? A.length : A[0].length;
      if (k === 2) { const t = Math.max(0, Math.min(1, p.x)); if (who === "P1") this.w = [t, 1 - t]; else this.z = [t, 1 - t]; }
      else if (k === 3) { const q = C.triClamp(C.triP(p)); if (who === "P1") this.w = q; else this.z = q; }
      else return null;
      this.update(true);
      return true;
    }
    update(keep) {
      const A = this.ed.A, m = A.length, n = A[0].length;
      this.sol = C.solveZeroSum(A);
      if (!keep) { this.w = Array.from({ length: m }, () => 1 / m); this.z = Array.from({ length: n }, () => 1 / n); }
      if (this.w.length !== m) this.w = Array.from({ length: m }, () => 1 / m);
      if (this.z.length !== n) this.z = Array.from({ length: n }, () => 1 / n);
      const vals = A.flat(), lo = Math.min(...vals), hi = Math.max(...vals), pad = Math.max(0.5, (hi - lo) * 0.12);
      this.yr = [lo - pad, hi + pad];
      for (const [pl, k] of [[this.pa, m], [this.pb, n]]) {
        if (k === 2) { pl.o.equal = false; pl.o.m = { l: 40, r: 12, t: 14, b: 34 }; pl.setRange([0, 1], this.yr); }
        else { pl.o.equal = true; pl.o.m = { l: 8, r: 8, t: 10, b: 10 }; pl.setRange([-0.12, 1.12], [-0.12, C.SQ3 + 0.1]); }
      }
      // 当前 w 下 P2 的最好回应（纯策略），当前 z 下 P1 的最好回应
      const s = A[0].map((_, j) => this.w.reduce((t, wi, i) => t + wi * A[i][j], 0));   // s = wA
      const r = A.map((row) => C.dot(row, this.z));                                     // r = Az
      const up = Math.max(...s), low = Math.min(...r);
      const br2 = C.argmaxAll(s).map(colN).join("、"), br1 = C.argminAll(r).map(rowN).join("、");
      this.ia.innerHTML = m <= 3 ? `w = ${vecS(this.w)}：P2 的最好回应是 ${br2}，P1 的期望代价 max<sub>z</sub> L̄(w,z) = <b>${C.fmt(up, 3)}</b>（拖动${m === 2 ? "竖线" : "紫点"}）。` : "";
      this.ib.innerHTML = n === 4 ? "P2 有 4 个动作：Z 是四面体，这里不画；看上面的数值。" :
        `z = ${vecS(this.z)}：P1 的最好回应是 ${br1}，P2 能保证 min<sub>w</sub> L̄(w,z) = <b>${C.fmt(low, 3)}</b>（拖动${n === 2 ? "竖线" : "紫点"}）。`;
      const { w, z, value } = this.sol, sec = C.security(A);
      this.sum.innerHTML = `线性规划给出 w* = ${vecS(w)}、z* = ${vecS(z)}ᵀ，<b>𝓛̄* = 𝓛̲* = ${C.fmt(value, 3, 120)}</b>（von Neumann：随机化鞍点总存在）。` +
        `对比确定性的 L̲* = ${C.fmt(sec.lower)}、L̄* = ${C.fmt(sec.upper)}：${sec.lower === sec.upper ? "本来就有鞍点，随机化没有带来变化。" : "随机化把两者之间的缺口合上了。"}` +
        (m === 2 && n === 2 && A[0][0] === 3 && A[0][1] === 0 && A[1][0] === -1 && A[1][1] === 1 ? " 这正是图 9.4：w* = [2/5, 3/5]，z* = [1/5, 4/5]ᵀ，值 3/5。" : "");
      this.pa.draw(); this.pb.draw();
    }
    draw(ctx, pl, col, who) {
      const A = this.ed.A, m = A.length, n = A[0].length, k = who === "P1" ? m : n;
      const opt = who === "P1" ? this.sol.w : this.sol.z, cur = who === "P1" ? this.w : this.z;
      if (k === 2) {
        pl.axes(col, { xt: [0, 0.2, 0.4, 0.6, 0.8, 1], yt: C.ticks(...this.yr, 5), xl: who === "P1" ? "w₁ = P(u=1)" : "z₁ = P(v=1)", yl: "期望代价" });
        // 每条线：对方的一个纯策略
        const lines = who === "P1" ? A[0].map((_, j) => [A[0][j], A[1][j]]) : A.map((r) => [r[0], r[1]]);
        const f = (L, t) => t * L[0] + (1 - t) * L[1];
        const others = who === "P1" ? colN : rowN, cc = who === "P1" ? col.p2 : col.p1;
        lines.forEach((L, j) => {
          pl.line({ x: 0, y: L[1] }, { x: 1, y: L[0] }, C.alpha(cc, 0.75), 1.4);
          pl.text(others(j), { x: 1, y: L[0] }, cc, { dx: -18, dy: -8, size: 11 });
        });
        const env = []; for (let i = 0; i <= 200; i++) { const t = i / 200, v = lines.map((L) => f(L, t)); env.push({ x: t, y: who === "P1" ? Math.max(...v) : Math.min(...v) }); }
        pl.path(env, col.text, 3.2);
        const t0 = opt[0], v0 = who === "P1" ? Math.max(...lines.map((L) => f(L, t0))) : Math.min(...lines.map((L) => f(L, t0)));
        pl.line({ x: t0, y: this.yr[0] }, { x: t0, y: v0 }, col.best, 1.5, [5, 4]);
        pl.dot({ x: t0, y: v0 }, 6.5, col.best, col.surface, 2);
        pl.text(`𝓛* = ${C.fmt(v0, 3, 120)}`, { x: t0, y: v0 }, col.best, { dy: who === "P1" ? 16 : -14, size: 12, weight: 650 });
        const c0 = cur[0], cv = who === "P1" ? Math.max(...lines.map((L) => f(L, c0))) : Math.min(...lines.map((L) => f(L, c0)));
        pl.line({ x: c0, y: this.yr[0] }, { x: c0, y: this.yr[1] }, C.alpha(col.prob, 0.8), 1.5);
        pl.dot({ x: c0, y: cv }, 5, col.prob, col.surface, 1.5);
      } else if (k === 3) {
        // 单纯形热图：颜色 = 对 P1 的代价（绿低、红高）
        const M = who === "P1" ? A : A[0].map((_, j) => A.map((r) => r[j]));
        const g = (p) => { const v = (who === "P1" ? A[0].map((_, j) => p.reduce((t, pi, i) => t + pi * A[i][j], 0)) : A.map((r) => C.dot(r, p))); return who === "P1" ? Math.max(...v) : Math.min(...v); };
        const vals = A.flat(), lo = Math.min(...vals), hi = Math.max(...vals);
        const green = col.best, red = col.worst, mid = col.surface;
        C.paintTriangle(pl, 2, (p) => { const t = (g(p) - lo) / (hi - lo || 1); return t < 0.5 ? C.mix(green, mid, t * 2) : C.mix(mid, red, (t - 0.5) * 2); });
        // 等值线：在三角形上采样，画出 g = 常数 的若干条
        pl.poly(C.TRI_V, null, col.strong, 1.5);
        const names = who === "P1" ? [rowN(0), rowN(1), rowN(2)] : [colN(0), colN(1), colN(2)];
        names.forEach((t, i) => pl.text(t, C.TRI_V[i], who === "P1" ? col.p1 : col.p2, { dy: i === 2 ? -9 : 13, dx: i === 0 ? 12 : i === 1 ? -12 : 0, size: 11.5, weight: 650 }));
        const q = C.triXY(opt); pl.dot(q, 7, col.best, col.surface, 2);
        pl.text(`𝓛* = ${C.fmt(g(opt), 3, 120)}`, q, col.text, { dy: -14, size: 11.5, weight: 650 });
        pl.dot(C.triXY(cur), 6, col.prob, col.surface, 2);
        void M;
      } else {
        pl.axes(col, { xt: [], yt: [] });
        pl.text("P2 有 4 个动作：Z 是三维单纯形（四面体）", { x: 0.5, y: 0 }, col.muted, { size: 12 });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='matrix-game']").forEach((el) => (el._w = new MatrixGame(el)));
    document.querySelectorAll("[data-widget='envelope']").forEach((el) => (el._w = new Envelope(el)));
  });
  CH9.zerosum = { GAMES };
})();
