/* 5.2 节：van der Corput 序列、采样方法对比（分散度 / 差异 / 卡方 / Voronoi）、维数灾难 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH5;

  // ---------------------------------------------------------------
  // 组件：van der Corput 序列（图 5.2）
  // ---------------------------------------------------------------
  class VanDerCorput {
    constructor(root) {
      this.i = 5; this.N = 16; this.base = 2;
      const body = C.frame(root, "van der Corput 序列", "图 5.2：把二进制位倒过来");
      this.lines = new C.Stage({ view: [-0.04, 1.04, -0.08, 0.31], aspect: 0.36, maxW: 820, onDraw: (ctx, st, col) => this.drawLines(ctx, st, col) });
      this.plot = new C.Stage({ view: [-0.12, 1.04, -0.16, 1.04], aspect: 1.03, maxW: 380, onDraw: (ctx, st, col) => this.drawPlot(ctx, st, col) });
      this.sI = C.slider("已取点数 i", 1, 64, 1, this.i, (v) => { this.i = v; this.update(); });
      this.segN = C.seg([["16", "朴素序列共 N = 16"], ["64", "N = 64"]], "16", (k) => { this.N = +k; this.update(); });
      this.segB = C.seg([["2", "基 2"], ["3", "基 3（Halton 的第 2 个坐标）"]], "2", (k) => { this.base = +k; this.update(); });
      this.runner = new C.Runner(() => { if (this.i >= 64) return false; this.i++; this.sI.input.value = this.i; this.sI.refresh(); this.update(); this.skip = 8; return true; });
      let tick = 0; const step = this.runner.step; this.runner.step = () => (++tick % 12 === 0 ? step() : true);
      this.table = h("table", { class: "data mono", style: "font-size:12.5px" });
      this.stats = [C.stat("朴素序列分散度"), C.stat("van der Corput 分散度"), C.stat("1/(2i)")];
      body.append(
        h("div", { class: "controls" }, this.sI, C.button("▶ 自动", () => { if (this.i >= 64) { this.i = 1; } this.runner.start(); }, "small"), C.button("暂停", () => this.runner.stop(), "small"), this.segN, this.segB),
        this.lines.wrap,
        h("div", { class: "split" }, h("div", null, this.plot.wrap, h("div", { class: "stats" }, this.stats)),
          h("div", { class: "table-wrap", style: "max-height:330px;overflow:auto;margin:0" }, this.table)));
      this.update();
    }
    vdc(i) { return C.radInv(i - 1, this.base); }
    naive(i) { return (i - 1) / this.N; }
    disp(pts) { // 圆周 [0,1]/~ 上：最大间隙的一半
      const xs = pts.slice().sort((a, b) => a - b); let g = 1 - xs[xs.length - 1] + xs[0];
      for (let j = 0; j + 1 < xs.length; j++) g = Math.max(g, xs[j + 1] - xs[j]);
      return g / 2;
    }
    update() {
      const i = this.i;
      const nv = Array.from({ length: Math.min(i, this.N) }, (_, j) => this.naive(j + 1));
      const vd = Array.from({ length: i }, (_, j) => this.vdc(j + 1));
      this.stats[0].set(i > this.N ? "（已用完）" : this.disp(nv).toFixed(4));
      this.stats[1].set(this.disp(vd).toFixed(4));
      this.stats[2].set((1 / (2 * i)).toFixed(4));
      // 图 5.2 的表（只对基 2）
      const t = this.table; t.innerHTML = "";
      const b = this.base;
      t.append(h("tr", null, ["i", "朴素", `${b} 进制`, "反转", "ν(i)"].map((x) => h("th", null, x))));
      for (let r = 1; r <= 16; r++) {
        const digits = (r - 1).toString(b).padStart(b === 2 ? 4 : 3, "0");
        const v = this.vdc(r);
        const fracStr = b === 2 ? `${Math.round(v * 16)}/16` : `${Math.round(v * 27)}/27`;
        t.append(h("tr", { style: r === i ? "background:var(--warn-soft)" : r < i ? "" : "color:var(--muted)" },
          h("td", null, r), h("td", null, `${r - 1}/16`), h("td", null, "." + digits), h("td", null, "." + digits.split("").reverse().join("")), h("td", null, fracStr)));
      }
      this.lines.draw(); this.plot.draw();
    }
    drawLines(ctx, st, col) {
      const rows = [[0.2, "朴素序列", (j) => this.naive(j), Math.min(this.i, this.N)], [0.055, "van der Corput", (j) => this.vdc(j), this.i]];
      for (const [y, name, f, n] of rows) {
        // 最大空隙（圆周 [0,1]/~ 上，可能跨过 1∼0）
        const pts = Array.from({ length: n }, (_, j) => f(j + 1)).sort((a, b) => a - b);
        let g = 1 - pts[pts.length - 1] + pts[0], gs = pts[pts.length - 1];
        for (let j = 0; j + 1 < pts.length; j++) if (pts[j + 1] - pts[j] > g) { g = pts[j + 1] - pts[j]; gs = pts[j]; }
        const ge = gs + g, hh = 0.028;
        ctx.fillStyle = C.alpha(col.bad, 0.22);
        if (ge <= 1.0001) ctx.fillRect(st.X(gs), st.Y(y + hh), (ge - gs) * st.scale, 2 * hh * st.scale);
        else { ctx.fillRect(st.X(gs), st.Y(y + hh), (1 - gs) * st.scale, 2 * hh * st.scale); ctx.fillRect(st.X(0), st.Y(y + hh), (ge - 1) * st.scale, 2 * hh * st.scale); }
        st.line({ x: 0, y }, { x: 1, y }, col.strong, 2);
        for (let k = 0; k <= 8; k++) st.line({ x: k / 8, y: y - 0.012 }, { x: k / 8, y: y + 0.012 }, col.strong, 1);
        st.text(name, { x: 0, y: y + 0.052 }, col.text2, { align: "left", size: 12.5, weight: 650 });
        for (let j = 1; j <= n; j++) {
          const x = f(j), last = j === n;
          st.dot({ x, y }, last ? 6.5 : 4, last ? col.current : C.alpha(col.accent, 0.4 + 0.6 * (j / n)), last ? col.surface : null, 2);
        }
      }
      st.text("0", { x: 0, y: 0.055 }, col.muted, { size: 11, dy: 16 }); st.text("1 ∼ 0", { x: 1, y: 0.055 }, col.muted, { size: 11, dy: 16 });
      st.text("红色阴影 = 最大空隙（分散度 = 它的一半）", { x: 1, y: 0.285 }, col.muted, { align: "right", size: 11.5 });
    }
    drawPlot(ctx, st, col) {
      // 横轴 log2 i ∈ [0,6]，纵轴 log2 δ ∈ [-8, 0]
      const X = (i) => Math.log2(i) / 6, Y = (d) => 1 + Math.log2(d) / 8;
      st.frame(col);
      for (let k = 0; k <= 6; k++) { st.line({ x: k / 6, y: 0 }, { x: k / 6, y: 1 }, col.grid, 0.7); st.text(String(2 ** k), { x: k / 6, y: 0 }, col.muted, { dy: 10, size: 10.5 }); }
      for (let k = 0; k <= 8; k += 2) { st.line({ x: 0, y: 1 - k / 8 }, { x: 1, y: 1 - k / 8 }, col.grid, 0.7); st.text(`2⁻${k}`.replace("⁻0", "⁰"), { x: 0, y: 1 - k / 8 }, col.muted, { dx: -14, size: 10.5 }); }
      const curve = (f, color, lw, dash, maxI) => {
        ctx.beginPath(); let started = false;
        for (let i = 1; i <= (maxI || 64); i++) { const d = f(i); if (d === null) continue; const px = st.X(X(i)), py = st.Y(Y(d)); started ? ctx.lineTo(px, py) : ctx.moveTo(px, py); started = true; }
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      };
      curve((i) => 1 / i, col.muted, 1.2, [4, 4]);
      curve((i) => 1 / (2 * i), col.muted, 1.2, [1, 3]);
      curve((i) => (i > this.N ? null : this.disp(Array.from({ length: i }, (_, j) => this.naive(j + 1)))), col.warn, 2);
      curve((i) => this.disp(Array.from({ length: i }, (_, j) => this.vdc(j + 1))), col.accent, 2.4);
      const i = this.i, d = this.disp(Array.from({ length: i }, (_, j) => this.vdc(j + 1)));
      st.dot({ x: X(i), y: Y(d) }, 5, col.current, col.surface, 1.5);
      st.text("分散度 δ（对数坐标）", { x: 0.02, y: 1.0 }, col.muted, { align: "left", dy: -8, size: 11 });
      st.text("i", { x: 1.0, y: 0 }, col.muted, { dy: 22, size: 11 });
      st.text("1/i", { x: X(40), y: Y(1 / 40) }, col.muted, { dy: -9, size: 10.5 });
      st.text("1/(2i)", { x: X(40), y: Y(1 / 80) }, col.muted, { dy: 10, size: 10.5 });
      st.text("van der Corput", { x: X(3), y: Y(1 / 12) }, col.accent, { size: 11, weight: 650 });
      st.text("朴素", { x: X(5), y: Y(0.45) }, col.warn, { size: 11, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：采样方法对比——分散度（5.19）、卡方误差（5.18）、星差异、Voronoi 图（图 5.3–5.8）
  // ---------------------------------------------------------------
  class SampleCompare {
    constructor(root) {
      const ds = root.dataset;
      this.method = ds.method || "random"; this.k = +(ds.k || 196); this.metric = ds.metric || "l2"; this.torus = ds.torus === "true"; this.seed = 11;
      const ovs = (ds.overlays || "vor,ball").split(",");
      this.ov = { vor: ovs.includes("vor"), ball: ovs.includes("ball"), chi: ovs.includes("chi"), disc: ovs.includes("disc") };
      const body = C.frame(root, "采样方法对比", "同样 k 个点，谁覆盖得更好？");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 500, pad: 4, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      const methods = ["random", "lcgBad", "lcgGood", "stdgrid", "sukharev", "mrgrid", "halton", "hammersley", "lattice"].map((k) => [k, C.SAMPLERS[k].name]);
      this.sel = C.select(methods, this.method, (k) => { this.method = k; this.recompute(); });
      this.sK = C.slider("k =", 4, 500, 1, this.k, (v) => { this.k = v; this.schedule(); });
      this.segM = C.seg([["l2", "L2"], ["linf", "L∞"]], this.metric, (k) => { this.metric = k; this.recompute(); });
      this.segT = C.seg([["sq", "[0,1]²"], ["torus", "环面 [0,1]²/∼"]], this.torus ? "torus" : "sq", (k) => { this.torus = k === "torus"; this.recompute(); });
      const chips = h("div", { class: "chips" });
      [["vor", "Voronoi 图"], ["ball", "最大空球"], ["chi", "10×10 卡方盒"], ["disc", "最差的锚定盒"]].forEach(([k, t]) => {
        const b = h("button", { type: "button", class: "chip" + (this.ov[k] ? " on" : "") }, t);
        b.addEventListener("click", () => { this.ov[k] = !this.ov[k]; b.classList.toggle("on", this.ov[k]); this.st.draw(); });
        chips.append(b);
      });
      this.stats = { disp: C.stat("分散度 δ (5.19)"), bound: C.stat("下界 (5.20)"), chi: C.stat("卡方 e(P) (5.18)"), chiE: C.stat("随机时 E[e(P)]"), disc: C.stat("星差异 D*（补充）") };
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, this.sK, C.button("换个种子", () => { this.seed = C.newSeed(); this.recompute(); }, "small")),
        h("div", { class: "controls" }, this.segM, this.segT, chips),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.note)));
      this.recompute();
    }
    schedule() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.recompute(); }); }
    recompute() {
      const S = C.SAMPLERS[this.method];
      this.pts = S.gen(this.k, this.seed);
      const res = this.k > 300 ? 170 : 210;
      this.field = C.nearestField(this.pts, res, this.metric, this.torus);
      this.disp = C.dispersion(this.pts, this.metric, this.torus, this.field);
      // 卡方 (5.18)
      const boxes = new Array(100).fill(0);
      this.pts.forEach((p) => { boxes[Math.min(9, Math.floor(p.x * 10)) * 10 + Math.min(9, Math.floor(p.y * 10))]++; });
      this.chi = boxes.reduce((s, b) => s + (b - this.k / 100) ** 2, 0);
      this.star = this.starDisc();
      const m = Math.floor(Math.sqrt(this.k));
      this.stats.disp.set(this.disp.r.toFixed(4));
      this.stats.bound.set(this.metric === "linf" ? (1 / (2 * m)).toFixed(4) : "仅 L∞");
      this.stats.chi.set(this.chi.toFixed(1));
      this.stats.chiE.set((0.99 * this.k).toFixed(1));
      this.stats.disc.set(this.star.d.toFixed(4));
      const notes = {
        random: "Voronoi 单元大小参差不齐（图 5.3）：有的地方挤，有的地方空。卡方 e(P) 在期望值 0.99k 附近波动——随机就该这么「不规整」。",
        lcgBad: "式 (5.16) 的线性同余生成器，故意选了坏参数 M = 2¹⁶、a = 9、c = 1（补充例子）。把相邻两个数当 (x,y)，点全落在 9 条平行线上——这就是书里说的「跨笛卡儿积的规律性」。",
        lcgGood: "M = 2³¹ − 1、a = 16807（补充例子，经典的 Park–Miller 参数）。在这个尺度上看不出规律，但它仍然是确定性的。",
        stdgrid: "标准网格放在原点。在正方形上，右边和上边缘离最近点很远（例 5.15：k = 9 时 L∞ 分散度是 1/3）；切换到环面，它和 Sukharev 网格一样好（1/6）。",
        sukharev: "把正方形切成 ⌊√k⌋² 个小方块，每块中心一个点：L∞ 分散度达到下界 (5.20)。多出来的 k − ⌊√k⌋² 个点随便放都不影响分散度（这里随机放）。卡方误差可能非常小——「太均匀，不像随机」。",
        mrgrid: "无限网格序列：每两位二进制选一次象限。k = 4ⁱ 时恰好是完整网格（在环面上看）。其它 k 是「部分网格」，仍保持 L∞ 最优分散度。",
        halton: "式 (5.25)：x 用基 2、y 用基 3 的 van der Corput。比随机规整（对比图 5.8a 与 5.3），又不会和坐标轴对齐。",
        hammersley: "式 (5.26)：需要事先知道 k，第一个坐标直接取 i/k。通常比 Halton 再均匀一点（图 5.8b）。",
        lattice: "式 (5.27)：(i/k, {iα})，α 取黄金比 (√5+1)/2（图 5.5b）。格点结构让邻居容易找（5.4.2 节会用到）。",
      };
      this.note.innerHTML = notes[this.method] + (this.metric === "linf" ? ` <span class="muted">L∞ 的「球」是正方形。</span>` : "");
      this.st.draw();
    }
    starDisc() {
      const P = this.pts, k = P.length;
      const xs = Array.from(new Set(P.map((p) => p.x).concat([1]))).sort((a, b) => a - b);
      const ys = Array.from(new Set(P.map((p) => p.y).concat([1]))).sort((a, b) => a - b);
      const nx = xs.length, ny = ys.length;
      const xi = new Map(xs.map((v, i) => [v, i])), yi = new Map(ys.map((v, i) => [v, i]));
      const G = new Int32Array((nx + 1) * (ny + 1));
      P.forEach((p) => { G[(xi.get(p.x) + 1) * (ny + 1) + yi.get(p.y) + 1]++; });
      for (let a = 1; a <= nx; a++) for (let b = 1; b <= ny; b++) G[a * (ny + 1) + b] += G[(a - 1) * (ny + 1) + b] + G[a * (ny + 1) + b - 1] - G[(a - 1) * (ny + 1) + b - 1];
      let best = 0, box = { x: 1, y: 1, closed: false };
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        const vol = xs[a] * ys[b];
        const open = G[a * (ny + 1) + b] / k, closed = G[(a + 1) * (ny + 1) + b + 1] / k;
        if (Math.abs(open - vol) > best) { best = Math.abs(open - vol); box = { x: xs[a], y: ys[b], cnt: G[a * (ny + 1) + b] }; }
        if (Math.abs(closed - vol) > best) { best = Math.abs(closed - vol); box = { x: xs[a], y: ys[b], cnt: G[(a + 1) * (ny + 1) + b + 1] }; }
      }
      return { d: best, box };
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.ov.vor) C.drawVoronoi(st, this.field, this.pts.length, col, true);
      if (this.ov.chi) { for (let g = 0.1; g < 0.99; g += 0.1) { st.line({ x: g, y: 0 }, { x: g, y: 1 }, C.alpha(col.warn, 0.7), 1); st.line({ x: 0, y: g }, { x: 1, y: g }, C.alpha(col.warn, 0.7), 1); } }
      if (this.ov.disc) {
        const b = this.star.box;
        st.poly(C.rect(0, 0, b.x, b.y), C.alpha(col.alive2, 0.18), col.alive2, 2);
        st.text(`${b.cnt} 个点 / 期望 ${(b.x * b.y * this.k).toFixed(1)}`, { x: b.x / 2, y: b.y / 2 }, col.alive2, { size: 11.5, weight: 650 });
      }
      if (this.ov.ball) {
        const { r, c } = this.disp;
        ctx.save(); ctx.beginPath(); ctx.rect(st.X(0), st.Y(1), st.scale, st.scale); ctx.clip();
        const offs = this.torus ? [-1, 0, 1] : [0];
        for (const ox of offs) for (const oy of offs) {
          const cc = { x: c.x + ox, y: c.y + oy };
          ctx.beginPath();
          if (this.metric === "linf") ctx.rect(st.X(cc.x - r), st.Y(cc.y + r), 2 * r * st.scale, 2 * r * st.scale);
          else ctx.arc(st.X(cc.x), st.Y(cc.y), r * st.scale, 0, 2 * Math.PI);
          ctx.fillStyle = C.alpha(col.bad, 0.16); ctx.fill(); ctx.strokeStyle = col.bad; ctx.lineWidth = 2; ctx.stroke();
          st.dot(cc, 3, col.bad);
        }
        ctx.restore();
      }
      for (const p of this.pts) st.dot(p, this.k > 300 ? 2 : 2.8, p.extra ? col.muted : col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：维数灾难——保持分散度需要的点数（式 5.20）
  // ---------------------------------------------------------------
  class DimCurse {
    constructor(root) {
      this.d = 6; this.delta = 0.05;
      const body = C.frame(root, "维数灾难", "式 (5.20)：要把 L∞ 分散度压到 δ，至少需要 ⌈1/(2δ)⌉ᵈ 个点");
      this.st = new C.Stage({ view: [0, 21, -0.7, 10.6], aspect: 0.54, maxW: 760, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sD = C.slider("维数 d", 1, 20, 1, this.d, (v) => { this.d = v; this.update(); });
      this.sDelta = C.slider("目标分散度 δ", 0.01, 0.25, 0.01, this.delta, (v) => { this.delta = v; this.update(); }, (v) => v.toFixed(2));
      this.out = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sD, this.sDelta), this.st.wrap, this.out);
      this.update();
    }
    k(d) { return Math.pow(Math.ceil(1 / (2 * this.delta) - 1e-9), d); }
    update() {
      const k = this.k(this.d), m = Math.ceil(1 / (2 * this.delta) - 1e-9);
      const fmtBig = (x) => (x < 1e6 ? Math.round(x).toLocaleString() : x.toExponential(2).replace("e+", " × 10^"));
      const secs = k * 1e-6;
      const time = secs < 1 ? `${(secs * 1000).toFixed(2)} 毫秒` : secs < 3600 ? `${secs.toFixed(1)} 秒` : secs < 86400 * 365 ? `${(secs / 3600).toFixed(1)} 小时` : `${(secs / (86400 * 365)).toExponential(2).replace("e+", " × 10^")} 年`;
      this.out.innerHTML = `每个轴 ${m} 个点，d = ${this.d} 维共需 <b>${fmtBig(k)}</b> 个点。` +
        `<span class="muted">（补充估算：假设每次碰撞检测 1 微秒，光检查这些点就要 ${time}。）</span> ` +
        `多分辨率网格要在 2<sup>d·i</sup> 个点时才凑满一层：d = ${this.d} 时依次是 ${[1, 2, 3].map((i) => fmtBig(Math.pow(2, this.d * i))).join("、")}……`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const maxLog = 20; // 纵轴 log10 k ∈ [0, 20]
      for (let g = 0; g <= 20; g += 4) { st.line({ x: 0, y: g / 2 }, { x: 21, y: g / 2 }, col.grid, 0.7); st.text(`10^${g}`, { x: 0, y: g / 2 }, col.muted, { align: "left", dx: 4, dy: -7, size: 10.5 }); }
      for (let d = 1; d <= 20; d++) {
        const lk = Math.min(maxLog, Math.log10(this.k(d)));
        st.poly(C.rect(d - 0.38, 0, d + 0.38, Math.max(0.03, lk / 2)), d === this.d ? col.current : C.alpha(col.accent, 0.45), null);
        st.text(String(d), { x: d, y: 0 }, d === this.d ? col.current : col.muted, { dy: 9, size: 10.5, weight: d === this.d ? 700 : 500 });
      }
      st.text("所需点数 k（对数坐标）", { x: 20.8, y: 10.3 }, col.muted, { align: "right", size: 11 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='vdc']").forEach((el) => el._w = new VanDerCorput(el));
    document.querySelectorAll("[data-widget='sample-compare']").forEach((el) => el._w = new SampleCompare(el));
    document.querySelectorAll("[data-widget='dim-curse']").forEach((el) => el._w = new DimCurse(el));
  });
})();
