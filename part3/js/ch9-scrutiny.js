/* 9.5 节：效用与彩票（例 9.22、9.23、9.25，图 9.6）、偏好三角形（例 9.24 与理性公理）、频率学派风险 (9.88)、
   无信息先验（例 9.26、9.27）、重复囚徒困境的循环赛（9.5.4 节的 Tit-for-Tat） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH9;

  // ---------------------------------------------------------------
  // 组件：效用函数与彩票
  // ---------------------------------------------------------------
  const UTILS = {
    lin: { name: "线性 𝒰 = W", f: (W) => W, inv: (u) => u },
    log: { name: "对数 𝒰 = ln W", f: (W) => Math.log(W), inv: (u) => Math.exp(u) },
    sqrt: { name: "平方根 𝒰 = √W", f: (W) => Math.sqrt(W), inv: (u) => u * u },
    exp: { name: "有界 𝒰 = 1 − e^(−W/R)", f: (W, R) => 1 - Math.exp(-W / R), inv: (u, R) => -R * Math.log(1 - u) },
  };
  const binom = (() => { const out = []; let c = 1; for (let k = 0; k <= 100; k++) { out.push(c / 2 ** 100); c = (c * (100 - k)) / (k + 1); } return out; })();
  const LOTS = {
    g922: { name: "例 9.22：三种选择（欧元）", unit: "€", W0: 5000, minW: 3100, lots: [
      { s: "选择 1", name: "1. 确定得 1000", o: [[1000, 1]] },
      { s: "选择 2", name: "2. 硬币：2000 或 0", o: [[2000, 0.5], [0, 0.5]] },
      { s: "选择 3", name: "3. 2/3 得 3000，1/3 付 3000", o: [[3000, 2 / 3], [-3000, 1 / 3]] }] },
    g923a: { name: "例 9.23 情形 4：$10,000 还是赌 $25,000", unit: "$", W0: 1000, minW: 100, lots: [
      { s: "u₁", name: "u₁：确定得 $10,000", o: [[10000, 1]] },
      { s: "u₂", name: "u₂：1/2 得 $25,000", o: [[25000, 0.5], [0, 0.5]] }] },
    g923b: { name: "例 9.23 情形 5：玩 100 次", unit: "$", W0: 1000, minW: 100, lots: [
      { s: "u₁", name: "u₁：每次 $100，共 $10,000", o: [[10000, 1]] },
      { s: "u₂", name: "u₂：每次 1/2 得 $250", o: binom.map((p, k) => [250 * k, p]) }] },
  };
  class Utility {
    constructor(root) {
      this.u = "log"; this.key = "g923a"; this.R = 20000; this.W0 = 1000; this.selLot = 1;
      const body = C.frame(root, "效用：钱越多，新增的钱越不值钱", "比较「期望收益」与「期望效用」两种排序；确定性等价 = 和这张彩票一样好的确定金额");
      this.pre = C.select(Object.entries(LOTS).map(([k, v]) => [k, v.name]), this.key, (k) => { this.key = k; this.W0 = LOTS[k].W0; this.wSl.set(Math.log10(this.W0)); this.selLot = 1; this.update(); });
      this.usw = C.seg(Object.entries(UTILS).map(([k, v]) => [k, v.name]), this.u, (k) => { this.u = k; this.rSl.classList.toggle("hidden", k !== "exp"); this.update(); });
      this.wSl = C.slider("初始财富 W₀", 2, 7, 0.05, Math.log10(this.W0), (v) => { this.W0 = Math.max(LOTS[this.key].minW, Math.round(10 ** v)); this.update(); }, () => (LOTS[this.key].unit + Math.round(this.W0).toLocaleString("en-US")));
      this.rSl = C.slider("风险容忍度 R", 3, 7, 0.05, Math.log10(this.R), (v) => { this.R = Math.round(10 ** v); this.update(); }, () => "$" + this.R.toLocaleString("en-US"));
      this.rSl.classList.add("hidden");
      this.plot = new C.Plot({ aspect: 0.62, maxW: 520, m: { l: 54, r: 14, t: 14, b: 34 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.tbl = h("div");
      body.append(h("div", { class: "controls" }, h("label", null, "场景：", this.pre), this.wSl), h("div", { class: "controls" }, this.usw, this.rSl),
        h("div", { class: "split" }, h("div", null, this.plot.wrap, C.legend([[C.cv("text"), "效用曲线 𝒰(W₀ + x)"], [C.cv("prob"), "选中彩票的各个结果", true], [C.cv("best"), "期望效用与确定性等价", true]])), this.tbl));
      this.update();
    }
    U(x) { return UTILS[this.u].f(this.W0 + x, this.R); }
    CE(eu) { const w = UTILS[this.u].inv(eu, this.R); return isFinite(w) ? w - this.W0 : NaN; }
    update() {
      const L = LOTS[this.key];
      if (this.W0 < L.minW) this.W0 = L.minW;
      this.wSl.refresh();
      this.rows = L.lots.map((lot) => {
        const ev = lot.o.reduce((s, [x, p]) => s + x * p, 0), eu = lot.o.reduce((s, [x, p]) => s + this.U(x) * p, 0);
        return { lot, ev, eu, ce: this.CE(eu) };
      });
      const bestEV = C.argmaxAll(this.rows.map((r) => +r.ev.toFixed(6))), bestEU = C.argmaxAll(this.rows.map((r) => r.eu));
      const money = (x) => (!isFinite(x) ? "–" : (x < 0 ? "−" : "") + L.unit + Math.abs(Math.round(x)).toLocaleString("en-US"));
      this.tbl.innerHTML = "";
      const t = h("table", { class: "data" }, h("tr", null, h("th", null, "选择"), h("th", null, "期望收益"), h("th", null, "确定性等价")),
        ...this.rows.map((r, i) => {
          const tr = h("tr", { class: i === this.selLot ? "sel" : "", style: "cursor:pointer" },
            h("td", null, r.lot.name), h("td", { class: bestEV.includes(i) ? "yes" : "" }, money(r.ev)), h("td", { class: bestEU.includes(i) ? "yes" : "" }, money(r.ce)));
          tr.addEventListener("click", () => { this.selLot = i; this.update(); });
          return tr;
        }));
      let msg = `按期望收益选 <b>${bestEV.map((i) => this.rows[i].lot.s).join("、")}</b>；按期望效用（= 确定性等价最大）选 <b>${bestEU.map((i) => this.rows[i].lot.s).join("、")}</b>。`;
      if (this.key === "g923a") msg += " 穷学生（W₀ ≈ $1,000）用对数效用会拿稳的 $10,000；把 W₀ 拉到 $10,000,000，就会去赌——「先给你 1000 万」之后，1 万块不再那么重要（情形 3、4）。";
      if (this.key === "g923b") { const p = binom.slice(41).reduce((a, b) => a + b, 0); msg += ` 玩 100 次时总额超过 $10,000 的概率是 ${(100 * p).toFixed(1)}%（正面至少 41 次；参考代码第 13 项），赌博几乎稳赢，所以除了极端厌恶风险的效用，两种准则都选 u₂。`; }
      if (this.key === "g922") msg += " 三个选择的期望都是 1000 欧元；凹的效用把它们分开——风险越大，确定性等价越低。";
      this.tbl.append(t, h("p", { class: "small", html: msg }), h("p", { class: "small muted", style: "margin:0" }, "点表格的一行，在图上看它的各个结果。初始财富、效用的形状都是补充的假设：书中只说「对大多数人，新增金钱的价值随财富增加而下降」（例 9.25、图 9.6）。"));
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const L = LOTS[this.key], xs = L.lots.flatMap((l) => l.o.map((o) => o[0])), lo = Math.min(0, ...xs), hi = Math.max(...xs);
      const pad = (hi - lo) * 0.06, x0 = Math.max(lo - pad, -this.W0 + 1), x1 = hi + pad;
      const ys = [this.U(x0), this.U(x1)], yp = Math.abs(ys[1] - ys[0]) > 1e-12 ? (ys[1] - ys[0]) * 0.08 : 1;
      pl.setRange([x0, x1], [ys[0] - yp, ys[1] + yp]);
      const fu = (v) => { const a = Math.abs(v); return (v < 0 ? "−" : "") + (a >= 1000 ? (a / 1000).toFixed(a % 1000 ? 1 : 0) + "k" : String(Math.round(a))); };
      pl.axes(col, { xt: C.ticks(x0, x1, 5), yt: C.ticks(...pl.o.y, 4), fx: fu, fy: (v) => (Math.abs(v) >= 1000 ? fu(v) : +v.toPrecision(3) + ""), xl: "收益 x（W = W₀ + x）", yl: "𝒰" });
      pl.curve((x) => this.U(x), x0, x1, 300, col.text, 2.2);
      const r = this.rows[this.selLot];
      const os = r.lot.o.filter(([, p]) => p > 1e-6);
      const small = os.length > 10;
      os.forEach(([x, p]) => pl.dot({ x, y: this.U(x) }, small ? Math.max(1.5, 30 * p) : 5, C.alpha(col.prob, 0.85)));
      if (!small && os.length > 1) {
        const a = os[0], b = os[os.length - 1];
        pl.line({ x: a[0], y: this.U(a[0]) }, { x: b[0], y: this.U(b[0]) }, C.alpha(col.prob, 0.7), 1.2, [5, 4]);
      }
      const E = { x: r.ev, y: r.eu };
      pl.line({ x: r.ce, y: r.eu }, E, col.best, 1.5, [3, 3]);
      pl.line({ x: r.ev, y: pl.o.y[0] }, { x: r.ev, y: this.U(r.ev) }, C.alpha(col.muted, 0.7), 1, [3, 3]);
      pl.dot(E, 5.5, col.best, col.surface, 1.5);
      pl.dot({ x: r.ce, y: r.eu }, 5.5, col.surface, col.best, 2);
      pl.text("E[x]", { x: r.ev, y: pl.o.y[0] }, col.muted, { dy: -8, size: 10.5 });
      pl.text("确定性等价", { x: r.ce, y: r.eu }, col.best, { dy: -12, size: 10.5, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：偏好三角形（例 9.24、式 9.84–9.87）
  // ---------------------------------------------------------------
  class PrefTriangle {
    constructor(root) {
      this.t = 0.5; this.alpha = 0.5;
      this.z = [[1 / 2, 1 / 4, 1 / 4], [1 / 3, 1 / 3, 1 / 3], [1, 0, 0]];
      const body = C.frame(root, "偏好与期望效用：概率单纯形上的无差异线", "X = {0, 1, 2} 枚金币；三角形里每一点是一个分布 z（例 9.24）");
      this.tSl = C.slider("𝒰(1 枚)（𝒰(0) = 0，𝒰(2) = 1）", 0, 1, 0.01, this.t, (v) => { this.t = v; this.update(); }, (v) => v.toFixed(2));
      this.aSl = C.slider("混入 z₃ 的比例 1 − α", 0, 1, 0.01, 1 - this.alpha, (v) => { this.alpha = 1 - v; this.update(); }, (v) => v.toFixed(2));
      this.plot = new C.Plot({ x: [-0.1, 1.1], y: [-0.1, C.SQ3 + 0.1], aspect: 0.86, maxW: 430, equal: true, m: { l: 6, r: 6, t: 6, b: 6 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.grab(p), onMove: (p, d) => { this.z[d.i] = C.triClamp(C.triP(p)); this.update(); },
        cursor: (p) => (this.hit(p) >= 0 ? "grab" : null) });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.tSl, this.aSl, C.button("恢复书中的 z₁、z₂、z₃", () => { this.z = [[1 / 2, 1 / 4, 1 / 4], [1 / 3, 1 / 3, 1 / 3], [1, 0, 0]]; this.update(); })),
        h("div", { class: "split" }, this.plot.wrap, this.info));
      this.update();
    }
    hit(p) { return this.plot.ctx ? this.z.findIndex((z) => this.plot.pxDist(p, C.triXY(z)) < 12) : -1; }
    grab(p) { const i = this.hit(p); return i >= 0 ? { i } : null; }
    EU(z) { return z[1] * this.t + z[2]; }
    update() {
      const e = this.z.map((z) => this.EU(z));
      const ord = [0, 1, 2].sort((a, b) => e[a] - e[b]);
      const rel = ord.map((i, k) => (k ? (Math.abs(e[i] - e[ord[k - 1]]) < 1e-9 ? " ≈ " : " ≺ ") : "") + "z" + C.sub(i + 1)).join("");
      const bl = (i) => this.z[i].map((x, k) => this.alpha * x + (1 - this.alpha) * this.z[2][k]);
      const b1 = this.EU(bl(0)), b2 = this.EU(bl(1));
      this.info.innerHTML = `<p style="margin:0 0 6px">期望效用 (9.87)：E[𝒰] = P(1 枚)·${this.t.toFixed(2)} + P(2 枚)·1。` +
        e.map((v, i) => `z${C.sub(i + 1)}：${v.toFixed(3)}`).join("，") + `。</p><p style="margin:0 0 6px">于是 <b>${rel}</b>。书中的判断是 z₃ ≺ z₁ ≺ z₂。</p>` +
        `<p style="margin:0 0 6px">E[𝒰] 对 z 是<b>线性</b>的，所以无差异线是一族<b>平行直线</b>。公理 3 (9.84)：把 z₁、z₂ 各按 α = ${this.alpha.toFixed(2)} 与同一个 z₃ 混合，得到的两个空心点 ${b1 < b2 - 1e-9 ? "仍然保持 z₁ 的混合 ≺ z₂ 的混合" : b1 > b2 + 1e-9 ? "仍然保持 z₂ 的混合 ≺ z₁ 的混合" : "仍然无差别"}（${b1.toFixed(3)} 对 ${b2.toFixed(3)}）——混合只是把两点朝 z₃ 按同一比例拉近。</p>` +
        `<p class="muted" style="margin:0">补充：如果一个人的无差异线是弯的或不平行（实验里常见，例如 Allais 悖论），就违反了理性公理，这时不存在能复现其偏好的效用函数。</p>`;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      // 无差异线：E𝒰 = c，在三角形内的线段
      const segs = [];
      for (let k = 1; k < 12; k++) {
        const c = k / 12, pts = [];
        // 沿三条边找 E𝒰 = c 的点：边 V0V1（p2=0, p1∈[0,1]）、V1V2、V0V2
        const edge = (a, b) => { const ea = this.EU(a), eb = this.EU(b); if ((ea - c) * (eb - c) <= 0 && Math.abs(ea - eb) > 1e-12) { const s = (c - ea) / (eb - ea); pts.push(a.map((x, i) => x + s * (b[i] - x))); } };
        edge([1, 0, 0], [0, 1, 0]); edge([0, 1, 0], [0, 0, 1]); edge([1, 0, 0], [0, 0, 1]);
        if (pts.length >= 2) segs.push([C.triXY(pts[0]), C.triXY(pts[1]), c]);
      }
      pl.poly(C.TRI_V, col.surface2, col.strong, 1.5);
      segs.forEach(([a, b, c]) => pl.line(a, b, C.alpha(col.best, 0.25 + 0.6 * c), 1.4));
      ["0 枚", "1 枚", "2 枚"].forEach((s, k) => pl.text(s, C.TRI_V[k], col.text, { dy: k === 2 ? -10 : 13, dx: k === 0 ? 10 : k === 1 ? -10 : 0, size: 11.5, weight: 650 }));
      const z3 = C.triXY(this.z[2]);
      [0, 1].forEach((i) => {
        const zi = C.triXY(this.z[i]), b = C.triXY(this.z[i].map((x, k) => this.alpha * x + (1 - this.alpha) * this.z[2][k]));
        pl.line(zi, z3, C.alpha(col.prob, 0.5), 1.2, [4, 4]);
        pl.dot(b, 5.5, col.surface, col.prob, 2);
      });
      this.z.forEach((z, i) => { const q = C.triXY(z); pl.dot(q, 7, col.prob, col.surface, 2); pl.text("z" + C.sub(i + 1), q, col.text, { dx: 14, dy: -10, size: 12, weight: 700 }); });
      pl.text("颜色越深 = 期望效用越高", { x: 0.5, y: -0.06 }, col.muted, { size: 10.5 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：频率学派风险 (9.88)
  // ---------------------------------------------------------------
  class FreqRisk {
    constructor(root) {
      this.sigma = 1; this.c = 0.6; this.tau = 1.5;
      const body = C.frame(root, "频率学派风险 R(θ, π)", "估计 θ：y ~ N(θ, σ²)，规则 π_c(y) = c·y，平方损失；R(θ, π_c) = c²σ² + (1 − c)²θ²（补充推导）");
      this.plot = new C.Plot({ x: [-4, 4], y: [0, 4], aspect: 0.55, maxW: 640, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.info = h("p", { class: "small" });
      body.append(h("div", { class: "controls" },
        C.slider("自选 c", 0, 1.2, 0.01, this.c, (v) => { this.c = v; this.update(); }, (v) => v.toFixed(2)),
        C.slider("σ", 0.3, 2, 0.05, this.sigma, (v) => { this.sigma = v; this.update(); }, (v) => v.toFixed(2)),
        C.slider("先验 N(0, τ²) 的 τ", 0.2, 4, 0.05, this.tau, (v) => { this.tau = v; this.update(); }, (v) => v.toFixed(2))),
        this.plot.wrap, C.legend([[C.cv("muted"), "c = 0, 0.25, 0.5, 0.75, 1"], [C.cv("prob"), "自选 c"], [C.cv("best"), "贝叶斯最优 c = τ²/(τ² + σ²)"]]), this.info);
      this.update();
    }
    R(th, c) { return c * c * this.sigma ** 2 + (1 - c) ** 2 * th * th; }
    update() {
      const cB = this.tau ** 2 / (this.tau ** 2 + this.sigma ** 2), r = (c) => c * c * this.sigma ** 2 + (1 - c) ** 2 * this.tau ** 2;
      const cross = this.c < 1 ? Math.sqrt((1 - this.c * this.c) / (1 - this.c) ** 2) * this.sigma : NaN;
      this.info.innerHTML = `(9.88) 对 y 求平均，但结果依赖未知的 θ：c = 1（直接用 y）处处风险 σ² = ${(this.sigma ** 2).toFixed(2)}；c = ${this.c.toFixed(2)} 在 |θ| < ${isFinite(cross) ? cross.toFixed(2) : "–"} 时更好、之外更差。` +
        `没有哪条曲线处处最低——就像 9.1.1 节的 Pareto 最优，只能排除「处处更差」的规则（例如 c > 1 的曲线被 c = 1 处处压住）。` +
        ` 贝叶斯的做法是再对先验平均：r(π_c) = c²σ² + (1−c)²τ²，最优 c = ${cB.toFixed(3)}，贝叶斯风险 ${r(cB).toFixed(3)}（自选 c 时为 ${r(this.c).toFixed(3)}）。`;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const ymax = Math.max(2.2, 1.6 * this.sigma ** 2);
      pl.setRange(null, [0, ymax]);
      pl.axes(col, { xt: [-4, -3, -2, -1, 0, 1, 2, 3, 4], yt: C.ticks(0, ymax, 4), xl: "θ（未知）", yl: "R(θ, π_c)" });
      pl.clip(() => {
        [0, 0.25, 0.5, 0.75, 1].forEach((c) => { pl.curve((t) => this.R(t, c), -4, 4, 160, C.alpha(col.muted, 0.7), 1.3); });
        pl.curve((t) => this.R(t, this.tau ** 2 / (this.tau ** 2 + this.sigma ** 2)), -4, 4, 160, col.best, 2.2, [6, 4]);
        pl.curve((t) => this.R(t, this.c), -4, 4, 160, col.prob, 2.8);
      });
      pl.text("c = 1", { x: 3.6, y: this.R(3.6, 1) }, col.muted, { dy: -8, size: 10.5 });
      pl.text("c = 0", { x: 1.2, y: Math.min(ymax * 0.95, this.R(1.2, 0)) }, col.muted, { dx: -18, size: 10.5 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：无信息先验（例 9.26、9.27；式 9.89）
  // ---------------------------------------------------------------
  const WEATHER = {
    two: ["降水", "晴"], three: ["雨", "雪", "晴"], four: ["小雨", "大雨", "雪", "晴"],
  };
  class NonInformative {
    constructor(root) {
      this.tab = "weather"; this.part = "two"; this.method = "sphere"; this.seed = 3;
      const body = C.frame(root, "「无信息」先验真的无信息吗？", "最大熵 = 均匀分布；但「在什么上面均匀」取决于你怎么划分、怎么参数化 Θ");
      this.tsw = C.seg([["weather", "例 9.26 天气"], ["lines", "例 9.27 直线"]], this.tab, (k) => { this.tab = k; this.wBox.classList.toggle("hidden", k !== "weather"); this.lBox.classList.toggle("hidden", k !== "lines"); this.update(); });
      this.wBox = h("div", { class: "controls" }, C.seg([["two", "Θ = {降水, 晴}"], ["three", "Θ = {雨, 雪, 晴}"], ["four", "Θ = {小雨, 大雨, 雪, 晴}"]], this.part, (k) => { this.part = k; this.update(); }));
      this.lBox = h("div", { class: "controls hidden" }, C.seg([["sphere", "θ 在上半球面 S² 上均匀"], ["cube", "θ 在上半立方体表面上均匀"]], this.method, (k) => { this.method = k; this.update(); }),
        C.button("重新抽样", () => { this.seed++; this.update(); }));
      this.p1 = new C.Plot({ aspect: 0.75, maxW: 380, onDraw: (ctx, pl, col) => this.draw1(ctx, pl, col) });
      this.p2 = new C.Plot({ aspect: 0.75, maxW: 380, onDraw: (ctx, pl, col) => this.draw2(ctx, pl, col) });
      this.info = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.tsw), this.wBox, this.lBox, h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, this.p1.wrap, this.p2.wrap), this.info);
      this.update();
    }
    sample() {
      const r = C.rng(this.seed * 7919 + (this.method === "cube" ? 1 : 0)), out = [];
      for (let k = 0; k < 4000; k++) {
        let v;
        if (this.method === "sphere") { v = [C.gauss(r), C.gauss(r), C.gauss(r)]; const n = Math.hypot(...v); v = v.map((x) => x / n); }
        else { const f = Math.floor(r() * 6), ax = f >> 1, s = f & 1 ? 1 : -1; v = [0, 0, 0]; v[ax] = s; const o = [0, 1, 2].filter((i) => i !== ax); v[o[0]] = 2 * r() - 1; v[o[1]] = 2 * r() - 1; }
        if (v[0] < 0) v = v.map((x) => -x);
        out.push(v);
      }
      return out;
    }
    update() {
      if (this.tab === "weather") {
        const n = WEATHER[this.part].length, pc = 1 / n, prec = this.part === "two" ? pc : (n - 1) * pc;
        this.info.innerHTML = `最大化熵 (9.89) −Σ P(θ) lg P(θ) 得到均匀分布，熵 = lg ${n} = ${Math.log2(n).toFixed(3)} 比特。` +
          `P(晴) = ${C.fmt(pc)}，P(有降水) = ${C.fmt(prec)}。` + (n === 2 ? "现在把「降水」细分成雨和雪试试。"
            : `只是把「降水」细分得更多，晴天的概率就从 1/2 掉到了 ${C.fmt(pc)}——「我们想区分不同的降水，真的会影响天气吗？」（例 9.26）`);
      } else {
        this.pts = this.sample();
        const near = this.pts.filter((v) => Math.abs(Math.atan2(v[1], v[0])) < Math.PI / 8).length / this.pts.length;
        this.info.innerHTML = `直线 θ₁z₁ + θ₂z₂ + θ₃ = 0 (9.91)，θ 乘以非零常数不变，所以加约束 θ₁² + θ₂² + θ₃² = 1、θ₁ ≥ 0 (9.92)，再在上半球面上取均匀分布。` +
          `左图：抽出的 40 条直线；右图：法向角 φ = atan2(θ₂, θ₁) 的直方图（4000 个样本）。|φ| < π/8 的比例 = <b>${(100 * near).toFixed(1)}%</b>` +
          (this.method === "sphere" ? "，均匀时应为 25%（参考代码第 14 项 ≈ 25.0%）。" : "，明显偏离 25%（参考代码第 14 项 ≈ 20.8%）：换一种约束，「均匀」就变成另一个先验。") +
          ` 可见「无信息」先验依赖于参数化（例 9.27）。只有在 Haar 测度存在时（如 SO(3)，5.1.4 节），才有不依赖参数化的「均匀」。`;
      }
      this.p1.draw(); this.p2.draw();
    }
    draw1(ctx, pl, col) {
      if (this.tab === "weather") {
        const names = WEATHER[this.part], n = names.length;
        pl.o.equal = false; pl.setRange([0, n], [0, 0.62]); pl.o.m = { l: 40, r: 10, t: 14, b: 34 };
        pl.axes(col, { xt: [], yt: [0, 0.25, 0.5], fy: (v) => v.toFixed(2), yl: "P(θ)" });
        names.forEach((s, i) => { pl.rect(i + 0.18, 0, i + 0.82, 1 / n, s === "晴" ? C.alpha(col.p1, 0.7) : C.alpha(col.prob, 0.7)); pl.text(s, { x: i + 0.5, y: 0 }, col.text, { dy: 13, size: 12 }); pl.text(C.fmt(1 / n), { x: i + 0.5, y: 1 / n }, col.text, { dy: -9, size: 11.5 }); });
      } else {
        pl.setRange([-2, 2], [-2, 2]); pl.o.m = { l: 30, r: 10, t: 10, b: 28 }; pl.o.equal = true;
        pl.axes(col, { xt: [-2, -1, 0, 1, 2], yt: [-2, -1, 0, 1, 2], xl: "z₁", yl: "z₂" });
        pl.clip(() => this.pts.slice(0, 40).forEach(([a, b, c]) => {
          // 直线 a z1 + b z2 + c = 0：取两个远点
          const n2 = a * a + b * b; if (n2 < 1e-9) return;
          const p0 = { x: (-a * c) / n2, y: (-b * c) / n2 }, d = { x: -b, y: a }, L = 10 / Math.sqrt(n2);
          pl.line({ x: p0.x - d.x * L, y: p0.y - d.y * L }, { x: p0.x + d.x * L, y: p0.y + d.y * L }, C.alpha(col.prob, 0.55), 1.1);
        }));
      }
    }
    draw2(ctx, pl, col) {
      if (this.tab === "weather") {
        pl.o.equal = false; pl.setRange([0, 4.5], [0, 2.2]); pl.o.m = { l: 40, r: 10, t: 14, b: 34 };
        pl.axes(col, { xt: [1, 2, 3, 4], yt: [0, 1, 2], fx: (v) => "n=" + v, yl: "熵（比特）" });
        pl.curve((n) => Math.log2(n), 1, 4.4, 80, col.muted, 1.5, [4, 4]);
        [2, 3, 4].forEach((n) => pl.dot({ x: n, y: Math.log2(n) }, WEATHER[this.part].length === n ? 7 : 4, WEATHER[this.part].length === n ? col.prob : col.muted));
        pl.text("均匀分布的熵 lg n", { x: 1.2, y: 2.05 }, col.muted, { align: "left", size: 11 });
      } else {
        const B = 16, cnt = Array(B).fill(0);
        this.pts.forEach(([a, b]) => { const f = Math.atan2(b, a); const k = Math.min(B - 1, Math.floor(((f + Math.PI / 2) / Math.PI) * B)); cnt[k]++; });
        const dens = cnt.map((c) => (c / this.pts.length) * B), ymax = Math.max(1.6, ...dens) * 1.1;
        pl.o.equal = false; pl.o.m = { l: 40, r: 10, t: 14, b: 34 };
        pl.setRange([-Math.PI / 2, Math.PI / 2], [0, ymax]);
        pl.axes(col, { xt: [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2], yt: [0, 0.5, 1, 1.5], fx: (v) => ({ "-2": "−π/2", "-1": "−π/4", 0: "0", 1: "π/4", 2: "π/2" })[Math.round(v / (Math.PI / 4))], xl: "φ = atan2(θ₂, θ₁)", yl: "相对密度" });
        dens.forEach((d, k) => { const a = -Math.PI / 2 + (k * Math.PI) / B; pl.rect(a + 0.01, 0, a + Math.PI / B - 0.01, d, C.alpha(this.method === "sphere" ? col.best : col.worst, 0.6)); });
        pl.line({ x: -Math.PI / 2, y: 1 }, { x: Math.PI / 2, y: 1 }, col.text, 1.3, [5, 4]);
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件：重复囚徒困境循环赛（9.5.4 节；代价用 (9.70)，刑期越少越好）
  // ---------------------------------------------------------------
  const PD = { CC: [8, 8], CR: [0, 30], RC: [30, 0], RR: [2, 2] };  // C = 与当局合作（坦白），R = 拒绝（沉默）
  const STRATS = {
    allC: { name: "总是坦白", f: () => "C" },
    allR: { name: "总是拒绝", f: () => "R" },
    tft: { name: "以牙还牙 TFT", f: (me, op) => (op.length ? op[op.length - 1] : "R") },
    grim: { name: "冷酷（被出卖一次就永远坦白）", f: (me, op) => (op.includes("C") ? "C" : "R") },
    pavlov: { name: "Pavlov（赢则保持、输则改变）", f: (me, op) => (!me.length ? "R" : PD[me[me.length - 1] + op[op.length - 1]][0] <= 2 ? me[me.length - 1] : me[me.length - 1] === "R" ? "C" : "R") },
    alt: { name: "交替（拒绝、坦白、拒绝…）", f: (me) => (me.length % 2 ? "C" : "R") },
    rand: { name: "随机 50 / 50", f: (me, op, r) => (r() < 0.5 ? "C" : "R") },
  };
  class IPD {
    constructor(root) {
      this.rounds = 20; this.on = { allC: true, allR: true, tft: true, grim: true, pavlov: true, alt: false, rand: false }; this.a = "tft"; this.b = "allC";
      const body = C.frame(root, "重复囚徒困境：循环赛", "每对策略（含与自己）连续玩 N 轮，累计刑期；越少越好");
      const chips = h("div", { class: "chips" });
      Object.entries(STRATS).forEach(([k, s]) => { const b = h("button", { type: "button", class: "chip" + (this.on[k] ? " on" : "") }, s.name); b.addEventListener("click", () => { this.on[k] = !this.on[k]; b.classList.toggle("on", this.on[k]); this.update(); }); chips.append(b); });
      this.rSl = C.slider("每场轮数 N", 1, 100, 1, this.rounds, (v) => { this.rounds = v; this.update(); });
      this.tbl = h("div", { class: "table-wrap" });
      this.selA = C.select(Object.entries(STRATS).map(([k, s]) => [k, s.name]), this.a, (k) => { this.a = k; this.update(); });
      this.selB = C.select(Object.entries(STRATS).map(([k, s]) => [k, s.name]), this.b, (k) => { this.b = k; this.update(); });
      this.match = h("div", { class: "ipd-match" });
      this.info = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, chips), h("div", { class: "controls" }, this.rSl), this.tbl, this.info,
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, "单场对局"), h("div", { class: "panel-body" }, h("div", { class: "controls" }, this.selA, h("span", null, "对"), this.selB), this.match,
          C.legend([[C.cv("worst"), "坦白（与当局合作）"], [C.cv("best"), "拒绝（对同伙守口如瓶）"]]))));
      this.update();
    }
    play(a, b, N, seed) {
      const r = C.rng(seed), ha = [], hb = []; let ca = 0, cb = 0;
      for (let t = 0; t < N; t++) { const x = STRATS[a].f(ha, hb, r), y = STRATS[b].f(hb, ha, r); const [p, q] = PD[x + y]; ca += p; cb += q; ha.push(x); hb.push(y); }
      return { ca, cb, ha, hb };
    }
    update() {
      const ks = Object.keys(STRATS).filter((k) => this.on[k]);
      const M = {}; ks.forEach((a) => { M[a] = {}; });
      ks.forEach((a, i) => ks.slice(i).forEach((b, j) => { const g = this.play(a, b, this.rounds, 1000 + i * 31 + j); M[a][b] = g.ca; M[b][a] = g.cb; }));
      const tot = ks.map((a) => ks.reduce((s, b) => s + M[a][b], 0));
      const best = C.argminAll(tot);
      this.tbl.innerHTML = "";
      this.tbl.append(h("table", { class: "data" }, h("tr", null, h("th", null, "↓ 我的刑期 / 对手 →"), ...ks.map((b) => h("th", { class: "c" }, STRATS[b].name.split("（")[0])), h("th", { class: "c" }, "合计")),
        ...ks.map((a, i) => h("tr", null, h("td", null, STRATS[a].name), ...ks.map((b) => h("td", { class: "c mono" }, String(M[a][b]))), h("td", { class: "c mono " + (best.includes(i) ? "yes" : "") }, String(tot[i]))))));
      const order = ks.map((k, i) => [k, tot[i]]).sort((x, y) => x[1] - y[1]);
      this.info.innerHTML = `排名（总刑期从少到多）：${order.map(([k, t], i) => (i ? (t === order[i - 1][1] ? " = " : " < ") : "") + `${STRATS[k].name.split("（")[0]} ${t}`).join("")}。` +
        (this.on.tft ? " 注意以牙还牙在<b>任何一场</b>对局里都不比对手判得少，却能靠「对合作者合作、对背叛者报复」在总分上名列前茅；" +
          "加入「交替」后，以牙还牙会被拖进互相报复的循环——锦标赛的结果依赖于参赛者是谁（参考代码第 16 项）。" : "");
      const g = this.play(this.a, this.b, this.rounds, 77);
      this.match.innerHTML = "";
      const row = (name, hs, c) => h("div", { class: "ipd-row" }, h("span", { class: "ipd-name" }, name), h("span", { class: "ipd-moves" }, ...hs.map((m) => h("i", { class: m === "C" ? "c" : "r", title: m === "C" ? "坦白" : "拒绝" }))), h("b", { class: "mono" }, c + " 年"));
      this.match.append(row(STRATS[this.a].name.split("（")[0], g.ha, g.ca), row(STRATS[this.b].name.split("（")[0], g.hb, g.cb));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='utility']").forEach((el) => (el._w = new Utility(el)));
    document.querySelectorAll("[data-widget='pref-triangle']").forEach((el) => (el._w = new PrefTriangle(el)));
    document.querySelectorAll("[data-widget='freq-risk']").forEach((el) => (el._w = new FreqRisk(el)));
    document.querySelectorAll("[data-widget='noninformative']").forEach((el) => (el._w = new NonInformative(el)));
    document.querySelectorAll("[data-widget='ipd']").forEach((el) => (el._w = new IPD(el)));
  });
  CH9.scrutiny = { UTILS, LOTS, STRATS, PD };
})();
