/* 9.2 节：先验单纯形、决策准则实验室、噪声传感器（观测与 Θ(y)）、OCR 分类器（例 9.11）、参数估计（例 9.12） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH9;

  const EX98 = [[1, -1, 0], [-1, 2, -2], [2, -1, 1]];

  // ---------------------------------------------------------------
  // 组件：先验单纯形——P(θ) 落在哪里，期望最优动作就是哪个（例 9.8、9.9、9.10；习题 5）
  // ---------------------------------------------------------------
  class PriorSimplex {
    constructor(root) {
      this.P = [0.2, 0.2, 0.6]; this.useT = false;
      const body = C.frame(root, "P(θ) 决定一切：先验单纯形", "三角形里每一点是一个 P(θ)；颜色 = 该先验下期望代价最小的动作");
      this.ed = new C.MatrixEditor({ A: EX98, minC: 3, maxC: 3, minR: 2, maxR: 4, onChange: () => this.update(),
        decorate: (ed) => this.decorate(ed), xcols: ["最坏 (9.14)", "E[L] (9.16)"] });
      this.plot = new C.Plot({ x: [-0.08, 1.08], y: [-0.1, C.SQ3 + 0.08], aspect: 0.86, maxW: 420, equal: true, m: { l: 6, r: 6, t: 8, b: 8 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.grab(p), onMove: (p) => this.move(p),
        cursor: (p) => (this.near(p) ? "grab" : "crosshair") });
      this.tg = C.checkbox("用遗憾矩阵 T 代替 L 着色", false, (v) => { this.useT = v; this.update(); });
      const presets = h("div", { class: "chips" },
        ...[["例 9.9：[1/5, 1/5, 3/5]", [0.2, 0.2, 0.6]], ["例 9.9：[1/10, 4/5, 1/10]", [0.1, 0.8, 0.1]], ["例 9.10：均匀", [1 / 3, 1 / 3, 1 / 3]]].map(([t, p]) => {
          const b = h("button", { type: "button", class: "chip" }, t); b.addEventListener("click", () => { this.P = p.slice(); this.update(); }); return b;
        }));
      this.info = h("div", { class: "small" });
      this.legend = h("div");
      body.append(h("div", { class: "controls" }, presets, this.tg),
        h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1.05fr)" },
          h("div", null, this.plot.wrap, this.legend), h("div", null, this.ed.el, this.info)));
      this.update();
    }
    near(p) { return this.plot.ctx && this.plot.pxDist(p, C.triXY(this.P)) < 12; }
    grab(p) { this.move(p); return true; }
    move(p) { this.P = C.triClamp(C.triP(p)); this.update(); }
    M() { return this.useT ? C.regretMatrix(this.ed.A) : this.ed.A; }
    best(p) { const M = this.M(); return C.argminAll(M.map((r) => C.dot(r, p))); }
    decorate(ed) {
      const A = ed.A, e = A.map((r) => C.dot(r, this.P)), wc = A.map((r) => Math.max(...r));
      const be = C.argminAll(e), bw = C.argminAll(wc);
      A.forEach((r, i) => {
        ed.xc[0][i].textContent = C.fmt(wc[i]); ed.xc[1][i].textContent = C.fmt(e[i], 3);
        if (bw.includes(i)) ed.xc[0][i].classList.add("best");
        if (be.includes(i)) ed.xc[1][i].classList.add("best");
        ed.td(i, 0).parentNode.firstChild.style.color = C.cv(C.ACT[i] || "accent");
      });
    }
    update() {
      const A = this.ed.A, wc = A.map((r) => Math.max(...r)), bw = C.argminAll(wc);
      const e = A.map((r) => C.dot(r, this.P)), be = C.argminAll(e);
      const name = (ix) => ix.map((i) => "u" + C.sub(i + 1)).join("、");
      const same = be.length === 1 && bw.includes(be[0]);
      this.info.innerHTML = `<p style="margin:8px 0 6px">当前 P(θ) = [${this.P.map((x) => C.fmt(x, 3, 20)).join(", ")}]：期望代价最小的是 <b>${name(be)}</b>（${C.fmt(Math.min(...e), 3)}）。</p>` +
        `<p style="margin:0 0 6px">非确定性模型不看 P(θ)，永远选 <b>${name(bw)}</b>（最坏代价 ${C.fmt(Math.min(...wc))}）。` +
        (same ? "现在两种模型给出<b>同一个</b>决策。" : "现在两种模型的决策<b>不同</b>。") + `</p>` +
        (this.useT ? `<p class="yes" style="margin:0">着色和用 L 时完全一样（补充）：E[T(u,θ)] = E[L(u,θ)] − E[min<sub>u'</sub> L(u',θ)]，后一项与 u 无关，所以 (9.22) 与 (9.15) 永远选同一个动作。这也印证了例 9.10 的笔误：均匀先验下期望遗憾最小的是 u₂，不是 u₁。</p>`
          : `<p class="muted" style="margin:0">「${name(bw)}」颜色的区域，就是能「反推」出 minimax 决策的那些先验（9.5.3 节、习题 5）。</p>`);
      this.legend.innerHTML = "";
      this.legend.append(C.legend(A.map((_, i) => [C.cva(C.ACT[i] || "accent", 0.45), "u" + C.sub(i + 1) + " 最优"]).concat([[C.cv("prob"), "当前 P(θ)", true]])));
      this.ed.decorate();
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const M = this.M(), res = 2;
      const x0 = pl.X(0), x1 = pl.X(1), yb = pl.Y(0), yt = pl.Y(C.SQ3);
      const W = Math.round((x1 - x0) / res), H = Math.round((yb - yt) / res);
      const idx = new Int8Array(W * H).fill(-1);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const p = C.triP({ x: (i + 0.5) / W, y: C.SQ3 * (1 - (j + 0.5) / H) });
        if (p[0] < 0 || p[1] < 0 || p[2] < 0) continue;
        let b = 0, bv = Infinity; M.forEach((r, k) => { const v = C.dot(r, p); if (v < bv - 1e-12) { bv = v; b = k; } }); idx[j * W + i] = b;
      }
      const off = document.createElement("canvas"); off.width = W; off.height = H;
      const octx = off.getContext("2d"), img = octx.createImageData(W, H);
      const fills = col.act.map((c) => C.mix(col.surface, c, 0.42)), edge = C.rgb(col.text);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = idx[j * W + i]; if (k < 0) continue;
        const isEdge = (i + 1 < W && idx[j * W + i + 1] >= 0 && idx[j * W + i + 1] !== k) || (j + 1 < H && idx[(j + 1) * W + i] >= 0 && idx[(j + 1) * W + i] !== k);
        const c = isEdge ? edge : fills[k % fills.length], o = (j * W + i) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, x0, yt, x1 - x0, yb - yt);
      pl.poly(C.TRI_V, null, col.strong, 1.5);
      ["θ₁", "θ₂", "θ₃"].forEach((t, k) => pl.text(`P(${t}) = 1`, C.TRI_V[k], col.p2, { dy: k === 2 ? -10 : 14, dx: k === 0 ? 18 : k === 1 ? -18 : 0, size: 11.5, weight: 650 }));
      pl.text("均匀", C.triXY([1 / 3, 1 / 3, 1 / 3]), col.muted, { dy: 12, size: 10.5 });
      pl.dot(C.triXY([1 / 3, 1 / 3, 1 / 3]), 2.5, col.muted);
      const q = C.triXY(this.P);
      pl.dot(q, 8, col.prob, col.surface, 2.5);
    }
  }

  // ---------------------------------------------------------------
  // 组件：决策准则实验室（式 9.14、9.15、9.20–9.22、习题 3 的乐观系数 9.94；例 9.28）
  // ---------------------------------------------------------------
  const CRIT_PRESETS = {
    ex98: { name: "例 9.8", A: EX98, w: [1, 1, 3], rows: null, cols: null },
    ex2: { name: "习题 2", A: [[-1, 3, 2, -1], [-1, 0, 7, -1], [1, 5, 5, -2]], w: [2, 4, 1, 3] },
    ex8: { name: "习题 8", A: [[2, -2, -2, 1], [-1, -2, -2, 6], [4, 0, -3, 4]], w: [2, 4, 1, 1] },
    ex928: { name: "例 9.28 支票 vs 现金", A: [[-1, -1], [-1000, 0]], w: [1, 1], rows: ["现金", "支票"], cols: ["兑现", "跳票"] },
  };
  class Criteria {
    constructor(root) {
      this.alpha = 0.5;
      const body = C.frame(root, "决策准则实验室", "同一张代价矩阵，换一个准则就可能换一个答案；绿色 = 该准则选中的动作");
      this.pre = C.select(Object.entries(CRIT_PRESETS).map(([k, v]) => [k, v.name]), "ex98", (k) => this.load(k));
      this.wbox = h("div", { class: "controls", style: "margin:4px 0 0" });
      this.ed = new C.MatrixEditor({ A: EX98, minR: 2, maxR: 4, minC: 2, maxC: 4, onChange: () => this.resized(),
        rowName: (i) => this.rn(i), colName: (j) => this.cn(j),
        xcols: ["最坏", "期望", "最好", "Hurwicz", "最坏遗憾", "期望遗憾"], decorate: (ed) => this.decorate(ed) });
      this.aSl = C.slider("Hurwicz 系数 α（9.94）", 0, 1, 0.01, this.alpha, (v) => { this.alpha = v; this.update(); }, (v) => v.toFixed(2));
      this.Tbox = h("div");
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "预设：", this.pre), this.aSl), this.ed.el,
        h("div", { class: "small muted", style: "margin:8px 0 0" }, "自然的随机化策略 P(θ)（拖动权重，自动归一化）："), this.wbox,
        h("div", { class: "split", style: "margin-top:8px" }, this.info, this.Tbox));
      this.load("ex98");
    }
    load(k) {
      const p = CRIT_PRESETS[k];
      this.key = k; this.rows = p.rows || null; this.cols = p.cols || null;
      this.w = p.w.slice();
      this.ed.set(p.A);
      this.buildW();
      this.update();
    }
    resized() {
      const n = this.ed.n;
      if (this.w.length !== n) { while (this.w.length < n) this.w.push(1); this.w.length = n; this.buildW(); }
      this.update();
    }
    buildW() {
      this.wbox.innerHTML = "";
      const step = this.key === "ex928" ? 0.001 : 0.01;
      this.wSl = this.w.map((v, j) => C.slider(this.cn(j), 0, 1 * (this.key === "ex928" ? 1 : 5), step, v,
        (x) => { this.w[j] = x; this.update(); }, () => "P = " + C.fmt(this.P()[j], 4, 20)));
      this.wbox.append(...this.wSl);
    }
    rn(i) { return this.rows && this.rows[i] ? this.rows[i] : "u" + C.sub(i + 1); }
    cn(j) { return this.cols && this.cols[j] ? this.cols[j] : "θ" + C.sub(j + 1); }
    P() { return C.normalize(this.w); }
    crit(A) {
      A = A || this.ed.A;
      const T = C.regretMatrix(A), P = this.P(), a = this.alpha;
      return [A.map((r) => Math.max(...r)), A.map((r) => C.dot(r, P)), A.map((r) => Math.min(...r)),
        A.map((r) => a * Math.max(...r) + (1 - a) * Math.min(...r)), T.map((r) => Math.max(...r)), T.map((r) => C.dot(r, P))];
    }
    decorate(ed) {
      if (!this.w || this.w.length !== ed.n) return;
      const cr = this.crit(ed.A);
      cr.forEach((vals, k) => {
        const best = C.argminAll(vals);
        vals.forEach((v, i) => { ed.xc[k][i].textContent = C.fmt(v, 3); if (best.includes(i)) ed.xc[k][i].classList.add("best"); });
      });
    }
    update() {
      if (this.wSl) this.wSl.forEach((s) => s.refresh());
      this.ed.decorate();
      const A = this.ed.A, T = C.regretMatrix(A), cr = this.crit();
      const nm = (i) => this.rn(i);
      const pick = (k) => C.argminAll(cr[k]).map(nm).join("、");
      // 遗憾矩阵
      this.Tbox.innerHTML = "";
      const colMin = A[0].map((_, j) => Math.min(...C.colOf(A, j)));
      const t = h("table", { class: "mx ro-table" }, h("tr", null, h("th", { class: "corner" }, "T"), ...A[0].map((_, j) => h("th", { class: "c" }, this.cn(j)))),
        ...T.map((r, i) => h("tr", null, h("th", { class: "r" }, nm(i)), ...r.map((v, j) => h("td", { class: "cell ro" + (v === 0 ? " zero" : "") }, C.fmt(v))))),
        h("tr", { class: "xrow" }, h("th", { class: "x" }, "列最小"), ...colMin.map((v) => h("td", { class: "x" }, C.fmt(v)))));
      this.Tbox.append(h("div", { class: "panel-title", style: "border:1px solid var(--border);border-bottom:0;border-radius:6px 6px 0 0" }, "遗憾矩阵 (9.20)：每列减去该列最小值"), h("div", { class: "table-wrap", style: "margin:0" }, t));
      let html = `<p style="margin:0 0 6px"><b>非确定性</b>（最坏情况 9.14）选 ${pick(0)}；<b>概率</b>（期望 9.15）选 ${pick(1)}；` +
        `最坏遗憾 (9.21) 选 ${pick(4)}；期望遗憾 (9.22) 选 ${pick(5)}。</p>` +
        `<p style="margin:0 0 6px">极端乐观（习题 3a，最好情况）选 ${pick(2)}；α = ${this.alpha.toFixed(2)} 的 Hurwicz 准则选 ${pick(3)}。α = 1 就是最坏情况，α = 0 就是最好情况。</p>`;
      if (this.key === "ex928") {
        const pb = this.P()[1];
        html += `<p style="margin:0">例 9.28：表中是代价 = −收益（书中 (9.93) 直接写的是收益，并且行列与前文相反）。跳票概率 ${C.fmt(pb, 4, 20)}：` +
          (pb < 0.999 ? "按期望该拿支票。" : "按期望也该拿现金。") + ` 临界值是 0.999（参考代码第 15 项）——书中说「几乎任何最坏情况决策都能反推出一个先验」，就是把先验推到这种极端。</p>`;
      } else html += `<p class="muted" style="margin:0">「期望遗憾」那一列永远和「期望」选同一行（补充：两者只差一个与 u 无关的常数）。</p>`;
      this.info.innerHTML = html;
    }
  }

  // ---------------------------------------------------------------
  // 组件：噪声传感器 y = h(θ, ψ) = θ + ψ（Formulation 9.5、9.6；式 9.23–9.31；9.5.3 节）
  // ---------------------------------------------------------------
  const NTH = 21;  // Θ = {0, 1, ..., 20}
  const SENSORS = {
    small: { name: "小误差：ψ ∈ {−1, 0, 1}", psi: [[-1, 0.25], [0, 0.5], [1, 0.25]] },
    outlier: { name: "偶尔大误差（10%：ψ ∈ {−8…8}）", psi: (() => { const o = []; for (let k = -8; k <= 8; k++) o.push([k, 0.1 / 17 + (k === 0 ? 0.45 : Math.abs(k) === 1 ? 0.225 : 0)]); return o; })() },
    lost: { name: "偶尔丢回波（20%：报告 ∞）", psi: [[-1, 0.2], [0, 0.4], [1, 0.2], ["inf", 0.2]] },
  };
  class Sensor {
    constructor(root) {
      this.model = "small"; this.theta = 8; this.priorKind = "uniform"; this.ys = []; this.r = C.rng(C.newSeed());
      const body = C.frame(root, "噪声传感器：观测把 Θ 缩小", "声呐测机器人到墙的距离 θ ∈ {0,…,20}；读数 y = θ + ψ，ψ 是自然的「观测动作」");
      this.msel = C.select(Object.entries(SENSORS).map(([k, v]) => [k, v.name]), this.model, (k) => { this.model = k; this.ys = []; this.update(); });
      this.psel = C.seg([["uniform", "先验均匀"], ["near", "先验偏向近处"]], "uniform", (k) => { this.priorKind = k; this.update(); });
      this.thSl = C.slider("真实 θ", 0, 20, 1, this.theta, (v) => { this.theta = v; this.ys = []; this.update(); });
      this.plot = new C.Plot({ x: [-0.7, 20.7], y: [0, 1], aspect: 0.42, maxW: 760, m: { l: 52, r: 10, t: 16, b: 34 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.obs = h("div", { class: "chips", style: "min-height:28px" });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "传感器：", this.msel), this.psel, this.thSl),
        h("div", { class: "controls" }, C.button("测一次", () => this.measure(1), "primary"), C.button("测 5 次", () => this.measure(5)), C.button("清空读数", () => { this.ys = []; this.update(); }),
          h("span", { class: "small muted" }, "读数："), this.obs),
        this.plot.wrap,
        C.legend([[C.cva("p2", 0.22), "非确定性：Θ(y₁) ∩ … ∩ Θ(yₙ)（式 9.30）"], [C.cv("prob"), "概率：后验 P(θ | y₁,…,yₙ)（式 9.31）"], [C.cv("text"), "真实 θ（机器人不知道）"]]),
        this.info);
      this.update();
    }
    psi() { return SENSORS[this.model].psi; }
    lik(y, th) { let s = 0; for (const [d, p] of this.psi()) { if (d === "inf" ? y === "inf" : y !== "inf" && th + d === y) s += p; } return s; }
    prior() { const p = Array.from({ length: NTH }, (_, t) => (this.priorKind === "near" ? NTH - t : 1)); return C.normalize(p); }
    measure(k) {
      for (let i = 0; i < k; i++) { const j = C.pick(this.psi().map((x) => x[1]), this.r), d = this.psi()[j][0]; this.ys.push(d === "inf" ? "inf" : this.theta + d); }
      this.update();
    }
    update() {
      const th = Array.from({ length: NTH }, (_, t) => t);
      // 非确定性：Θ(y) = {θ | y ∈ Y(θ)}，逐个求交（式 9.23、9.27、9.30）
      this.set = th.filter((t) => this.ys.every((y) => this.lik(y, t) > 0));
      // 概率：P(θ | y1..yn) ∝ P(θ) Π P(yi | θ)（式 9.25、9.31）
      const pr = this.prior();
      const post = th.map((t) => this.ys.reduce((s, y) => s * this.lik(y, t), pr[t]));
      this.post = C.normalize(post);
      this.mean = this.post.reduce((s, p, t) => s + p * t, 0);
      this.mode = this.post.indexOf(Math.max(...this.post));
      this.obs.innerHTML = "";
      this.ys.slice(-14).forEach((y) => this.obs.append(h("span", { class: "tag" + (y === "inf" ? " red" : "") }, y === "inf" ? "∞" : String(y))));
      if (this.ys.length > 14) this.obs.append(h("span", { class: "small muted" }, `…共 ${this.ys.length} 个`));
      const S = this.set;
      let msg;
      if (!this.ys.length) msg = "还没有读数：非确定性模型只知道 θ ∈ Θ，概率模型只有先验。点「测一次」。";
      else {
        const lo = Math.min(...S), hi = Math.max(...S), mid = (lo + hi) / 2;
        msg = `<p style="margin:6px 0">非确定性：θ ∈ {${S.length > 8 ? lo + ", …, " + hi : S.join(", ")}}，共 ${S.length} 个可能。若代价是 |u − θ|，最坏情况最优的猜测是区间中点 <b>u = ${mid}</b>（最坏误差 ${(hi - lo) / 2}）。</p>` +
          `<p style="margin:0 0 6px">概率：后验均值 <b>${this.mean.toFixed(2)}</b>（平方损失 (u−θ)² 下的最优猜测），后验众数 ${this.mode}（0-1 损失下的最优猜测），P(θ = ${this.mode} | y) = ${(100 * Math.max(...this.post)).toFixed(1)}%。</p>`;
        if (this.model === "outlier") msg += `<p class="muted" style="margin:0">9.5.3 节的难处：为了「保证」正确，Ψ(θ) 必须包含偶尔出现的大误差 ±8，于是每个读数只能把 θ 限制在 17 个值里；概率模型给大误差很小的概率，很快就集中到真值附近。</p>`;
        if (this.model === "lost") msg += `<p class="muted" style="margin:0">读到 ∞ 时：Θ(∞) = Θ，什么也没排除；P(∞ | θ) 对所有 θ 都是 0.2，后验也不变。最坏情况的推理会认为传感器可能永远只报 ∞，因而「毫无用处」（9.5.3 节）。</p>`;
      }
      this.info.innerHTML = msg;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const ymax = Math.max(0.3, ...this.post) * 1.12;
      pl.setRange(null, [0, ymax]);
      pl.axes(col, { xt: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], yt: C.ticks(0, ymax, 4), xl: "θ（距离）", yl: "P(θ | y)", fy: (v) => v.toFixed(2) });
      this.set.forEach((t) => pl.rect(t - 0.5, 0, t + 0.5, ymax, C.alpha(col.p2, 0.16)));
      const pr = this.prior();
      this.post.forEach((p, t) => {
        pl.rect(t - 0.32, 0, t + 0.32, p, C.alpha(col.prob, 0.8));
        if (!this.ys.length) pl.rect(t - 0.32, 0, t + 0.32, pr[t], C.alpha(col.prob, 0.3));
      });
      pl.line({ x: this.theta, y: 0 }, { x: this.theta, y: ymax }, col.text, 1.5, [5, 4]);
      pl.text("真实 θ", { x: this.theta, y: ymax }, col.text, { dy: 8, dx: 22, size: 11 });
      if (this.ys.length) {
        pl.dot({ x: this.mean, y: 0 }, 5, col.prob, col.surface, 1.5);
        const lo = Math.min(...this.set), hi = Math.max(...this.set);
        pl.dot({ x: (lo + hi) / 2, y: ymax * 0.96 }, 5, col.p2, col.surface, 1.5);
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件：OCR 分类器（例 9.11、图 9.1；式 9.31–9.34）
  // ---------------------------------------------------------------
  const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  // 字形：笔画（折线）、端点、直角拐点、洞（多边形）。坐标在 [0,1]²，y 向上
  const GLYPHS = {
    A: { s: [[[0.12, 0], [0.5, 1], [0.88, 0]], [[0.3, 0.45], [0.7, 0.45]]], ends: [[0.12, 0], [0.88, 0]], corners: [], holes: [[[0.3, 0.45], [0.5, 1], [0.7, 0.45]]] },
    B: { s: [[[0.2, 0], [0.2, 1]], [[0.2, 1], [0.52, 1], ...arc(0.52, 0.75, 0.25, 90, -90), [0.2, 0.5]], [[0.2, 0.5], [0.58, 0.5], ...arc(0.58, 0.25, 0.25, 90, -90), [0.2, 0]]],
      ends: [], corners: [[0.2, 1], [0.2, 0]], holes: [[[0.2, 1], [0.52, 1], ...arc(0.52, 0.75, 0.25, 90, -90), [0.2, 0.5]], [[0.2, 0.5], [0.58, 0.5], ...arc(0.58, 0.25, 0.25, 90, -90), [0.2, 0]]] },
    C: { s: [arc(0.56, 0.5, 0.47, 48, 312)], ends: [arc(0.56, 0.5, 0.47, 48, 48, 1)[0], arc(0.56, 0.5, 0.47, 312, 312, 1)[0]], corners: [], holes: [] },
    D: { s: [[[0.2, 0], [0.2, 1], [0.38, 1], ...arc(0.38, 0.5, 0.5, 90, -90), [0.2, 0]]], ends: [], corners: [[0.2, 1], [0.2, 0]], holes: [[[0.2, 0], [0.2, 1], [0.38, 1], ...arc(0.38, 0.5, 0.5, 90, -90)]] },
    E: { s: [[[0.85, 1], [0.2, 1], [0.2, 0], [0.85, 0]], [[0.2, 0.5], [0.7, 0.5]]], ends: [[0.85, 1], [0.85, 0], [0.7, 0.5]], corners: [[0.2, 1], [0.2, 0]], holes: [] },
    F: { s: [[[0.85, 1], [0.2, 1], [0.2, 0]], [[0.2, 0.5], [0.7, 0.5]]], ends: [[0.85, 1], [0.2, 0], [0.7, 0.5]], corners: [[0.2, 1]], holes: [] },
    G: { s: [[...arc(0.56, 0.5, 0.47, 48, 330), [0.967, 0.46], [0.6, 0.46]]], ends: [arc(0.56, 0.5, 0.47, 48, 48, 1)[0], [0.6, 0.46]], corners: [[0.967, 0.46]], holes: [] },
    H: { s: [[[0.15, 0], [0.15, 1]], [[0.85, 0], [0.85, 1]], [[0.15, 0.5], [0.85, 0.5]]], ends: [[0.15, 0], [0.15, 1], [0.85, 0], [0.85, 1]], corners: [], holes: [] },
  };
  // 图 9.1 的 (s, e, h)；c 只有 E = 2、F = 1 来自书中，其余按上面的字形补充
  const OCR = { A: [0, 2, 1, 0], B: [1, 0, 2, 2], C: [1, 2, 0, 0], D: [1, 0, 1, 2], E: [0, 3, 0, 2], F: [0, 3, 0, 1], G: [1, 2, 0, 1], H: [0, 4, 0, 0] };
  const RANGES = [2, 5, 3, 3];
  const FEAT = ["s 形状", "e 端点", "h 洞", "c 直角"];
  const FREQ = { A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2.0, H: 6.1 };
  const LET = Object.keys(OCR);
  class OCRWidget {
    constructor(root) {
      this.use = [true, true, true, false]; this.mode = "nondet"; this.eps = 0.1; this.priorKind = "freq";
      this.sample = null; this.tally = { n: 0, ok: 0 }; this.r = C.rng(C.newSeed());
      const body = C.frame(root, "OCR：用特征给字母分类", "图 9.1 的三个特征 + 补充的「直角数」c；行为 = 猜字母，代价 (9.32)：猜错为 1");
      this.fbox = h("div", { class: "chips" });
      FEAT.forEach((f, i) => { const b = h("button", { type: "button", class: "chip" + (this.use[i] ? " on" : "") }, f); b.addEventListener("click", () => { this.use[i] = !this.use[i]; if (!this.use.some(Boolean)) this.use[i] = true; b.classList.toggle("on", this.use[i]); this.sample = null; this.tally = { n: 0, ok: 0 }; this.update(); }); this.fbox.append(b); });
      this.msw = C.seg([["nondet", "非确定性：特征总是对的"], ["prob", "概率：提取器会出错（朴素贝叶斯）"]], this.mode, (k) => { this.mode = k; this.probBox.classList.toggle("hidden", k !== "prob"); this.update(); });
      this.probBox = h("div", { class: "controls hidden" },
        C.slider("每个特征出错的概率 ε", 0, 0.4, 0.01, this.eps, (v) => { this.eps = v; this.tally = { n: 0, ok: 0 }; this.update(); }, (v) => v.toFixed(2)),
        C.seg([["freq", "先验 = 英文字母频率"], ["uni", "先验均匀"]], "freq", (k) => { this.priorKind = k; this.tally = { n: 0, ok: 0 }; this.update(); }),
        C.button("随机写一个字母", () => this.draw1(), "primary"), C.button("连写 1000 个", () => this.drawMany(1000)));
      this.plot = new C.Plot({ x: [0, 8], y: [-0.62, 1.3], aspect: 0.3, maxW: 820, equal: true, m: { l: 4, r: 4, t: 4, b: 4 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("span", { class: "small" }, "使用的特征："), this.fbox), h("div", { class: "controls" }, this.msw), this.probBox, this.plot.wrap,
        C.legend([[C.cv("worst"), "端点", true], [C.cv("p1"), "直角拐点"], [C.cva("prob", 0.3), "洞"]]), this.info);
      this.update();
    }
    idx() { return this.use.map((u, i) => (u ? i : -1)).filter((i) => i >= 0); }
    prior() { const p = LET.map((L) => (this.priorKind === "freq" ? FREQ[L] : 1)); return C.normalize(p); }
    likF(L, i, v) { return OCR[L][i] === v ? 1 - this.eps : this.eps / (RANGES[i] - 1); }
    posterior(y) { const pr = this.prior(), I = this.idx(); return C.normalize(LET.map((L, k) => I.reduce((s, i, t) => s * this.likF(L, i, y[t]), pr[k]))); }
    // 朴素贝叶斯分类器的精确错误率：对所有可能的 y 求和（与参考代码第 7 项相同）
    errorRate() {
      const I = this.idx(), pr = this.prior();
      let correct = 0;
      const rec = (t, y) => {
        if (t === I.length) { correct += Math.max(...LET.map((L, k) => I.reduce((s, i, q) => s * this.likF(L, i, y[q]), pr[k]))); return; }
        for (let v = 0; v < RANGES[I[t]]; v++) rec(t + 1, [...y, v]);
      };
      rec(0, []);
      return 1 - correct;
    }
    noisy(L) {
      return this.idx().map((i) => { if (this.r() >= this.eps) return OCR[L][i]; const others = [...Array(RANGES[i]).keys()].filter((v) => v !== OCR[L][i]); return others[Math.floor(this.r() * others.length)]; });
    }
    draw1() { const L = LET[C.pick(this.prior(), this.r)]; const y = this.noisy(L); const post = this.posterior(y); const g = post.indexOf(Math.max(...post)); this.sample = { L, y, post, g }; this.tally.n++; this.tally.ok += LET[g] === L; this.update(); }
    drawMany(n) { for (let k = 0; k < n; k++) { const L = LET[C.pick(this.prior(), this.r)]; const post = this.posterior(this.noisy(L)); this.tally.n++; this.tally.ok += LET[post.indexOf(Math.max(...post))] === L; } this.update(); }
    groups() { const g = {}; LET.forEach((L) => { const key = this.idx().map((i) => OCR[L][i]).join(","); (g[key] = g[key] || []).push(L); }); return g; }
    update() {
      const I = this.idx(), g = this.groups();
      const amb = Object.entries(g).filter(([, v]) => v.length > 1);
      let html = "";
      if (this.mode === "nondet") {
        html = `<p style="margin:6px 0">y = (${I.map((i) => "sehc"[i]).join(", ")})。` + (amb.length
          ? `有 ${amb.length} 组字母给出相同的 y：${amb.map(([k, v]) => `(${k}) → Θ(y) = {${v.join(", ")}}`).join("；")}。最坏情况下 (9.32) 的代价是 <b class="no">1</b>：必然可能猜错。`
          : `每个 y 至多对应一个字母：Θ(y) 都是单点，存在<b class="yes">完美分类器</b>，最坏代价 0。`) + `</p>` +
          `<p class="muted" style="margin:0">书中只指出 (0,3,0) 同时对应 E、F，加上直角数 c 后 E（c = 2）、F（c = 1）就分开了。按图 9.1，C 和 G 其实也都是 (1,2,0)——它们靠 c 分开要求 G 有一个直角（横杠与竖笔相接处），这是我们按字形补充的。</p>`;
      } else {
        const err = this.errorRate();
        html = `<p style="margin:6px 0">朴素贝叶斯：P(y | θ) = ∏ P(yᵢ | θ)（式 9.31、9.33），选后验最大的字母（= 让 (9.32) 的期望最小）。这个分类器的<b>精确错误率 ${(100 * err).toFixed(2)}%</b>` +
          (this.tally.n ? `；模拟 ${this.tally.n} 次，错了 ${this.tally.n - this.tally.ok} 次（${(100 * (1 - this.tally.ok / this.tally.n)).toFixed(1)}%）。` : "。") + `</p>`;
        if (this.sample) {
          const { L, y, g: gi } = this.sample;
          html += `<p style="margin:0 0 6px">写的是 <b>${L}</b>，提取器报告 y = (${y.map((v, t) => (v === OCR[L][I[t]] ? v : `<span class="no">${v}</span>`)).join(", ")})（红色 = 报错），分类器判为 <b class="${LET[gi] === L ? "yes" : "no"}">${LET[gi]}</b>。</p>`;
        }
        html += `<p class="muted" style="margin:0">先验用英文里的字母频率（补充，只取 A–H 再归一化）：E 最常见，所以 (0,3,0) 在没有 c 时总被判成 E。每个提取器以 1 − ε 报真值、否则均匀报一个错值（补充的噪声模型）。</p>`;
      }
      this.info.innerHTML = html;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const I = this.idx(), g = this.groups();
      const post = this.mode === "prob" && this.sample ? this.sample.post : null;
      LET.forEach((L, k) => {
        const ox = k + 0.18, oy = 0.12, s = 0.64, T = ([x, y]) => ({ x: ox + x * s, y: oy + y * s });
        const key = I.map((i) => OCR[L][i]).join(","), ambig = g[key].length > 1;
        const isSample = this.sample && this.mode === "prob" && this.sample.L === L, isGuess = this.sample && this.mode === "prob" && LET[this.sample.g] === L;
        pl.rect(k + 0.04, -0.6, k + 0.96, 1.26, isGuess ? C.alpha(col.best, 0.14) : col.surface2, isSample ? col.text : col.border, isSample ? 2 : 1);
        if (I.includes(2)) GLYPHS[L].holes.forEach((H) => pl.poly(H.map(T), C.alpha(col.prob, 0.3)));
        const stroke = this.mode === "nondet" && ambig ? col.worst : col.text;
        GLYPHS[L].s.forEach((S) => pl.path(S.map(T), stroke, 3.2));
        if (I.includes(1)) GLYPHS[L].ends.forEach((p) => pl.dot(T(p), 3.6, col.worst));
        if (I.includes(3)) GLYPHS[L].corners.forEach((p) => { const q = T(p); pl.rect(q.x - 0.035, q.y - 0.035, q.x + 0.035, q.y + 0.035, col.p1); });
        pl.text("(" + I.map((i) => OCR[L][i]).join(",") + ")", { x: k + 0.5, y: 0 }, this.mode === "nondet" && ambig ? col.worst : col.muted, { dy: 9, size: 11, weight: 600 });
        if (post) {
          const bh = 0.36 * post[k];
          pl.rect(k + 0.25, -0.56, k + 0.75, -0.56 + bh, C.alpha(col.prob, 0.85));
          pl.text((100 * post[k]).toFixed(0) + "%", { x: k + 0.5, y: -0.56 + bh }, col.text, { dy: -7, size: 10.5 });
        } else if (this.mode === "prob") {
          const p = this.prior()[k]; pl.rect(k + 0.25, -0.56, k + 0.75, -0.56 + 0.36 * p, C.alpha(col.prob, 0.35));
          pl.text("先验 " + (100 * p).toFixed(0) + "%", { x: k + 0.5, y: -0.56 + 0.36 * p }, col.muted, { dy: -7, size: 10 });
        }
      });
    }
  }

  // ---------------------------------------------------------------
  // 组件：参数估计（例 9.12、习题 16；式 9.35–9.40）
  // ---------------------------------------------------------------
  class ParamEst {
    constructor(root) {
      this.kind = "uniform"; this.sigma = 2; this.theta = 9; this.n = 0; this.S = 0; this.SS = 0; this.r = C.rng(C.newSeed());
      const body = C.frame(root, "参数估计：后验与期望代价", "自然选 θ，传感器给 y ~ N(θ, σ²)；代价 L(u, θ) = (u − θ)²（式 9.35）");
      this.ksw = C.seg([["uniform", "先验 U[0, 10]（例 9.12）"], ["normal", "先验 N(0, 4²)（习题 16）"]], this.kind, (k) => this.setKind(k));
      this.sSl = C.slider("噪声 σ", 0.5, 10, 0.5, this.sigma, (v) => { this.sigma = v; this.update(); }, (v) => v.toFixed(1));
      this.tSl = C.slider("真实 θ", -10, 14, 0.5, this.theta, (v) => { this.theta = v; this.update(); }, (v) => v.toFixed(1));
      this.kSel = C.select([["1", "k = 1"], ["10", "k = 10"], ["1000", "k = 1000"]], "1", () => {});
      this.dens = new C.Plot({ x: [-12, 16], y: [0, 1], aspect: 0.4, maxW: 760, m: { l: 52, r: 10, t: 12, b: 30 }, onDraw: (ctx, pl, col) => this.drawD(ctx, pl, col) });
      this.cost = new C.Plot({ x: [-12, 16], y: [0, 1], aspect: 0.22, maxW: 760, m: { l: 52, r: 10, t: 8, b: 30 }, onDraw: (ctx, pl, col) => this.drawC(ctx, pl, col) });
      this.stats = ["观测数 k", "ȳ（只看数据）", "u* = 后验均值", "后验标准差", "最小期望代价"].map((k) => C.stat(k));
      this.info = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.ksw, this.sSl, this.tSl),
        h("div", { class: "controls" }, C.button("观测一次", () => this.obs(1), "primary"), C.button("观测 10 次", () => this.obs(10)), C.button("清空", () => { this.n = this.S = this.SS = 0; this.update(); }),
          h("span", { class: "sep" }), h("label", null, "习题 16：", this.kSel), C.button("令 yᵢ = 4", () => this.ex16())),
        this.dens.wrap, this.cost.wrap,
        C.legend([[C.cv("muted"), "先验 p(θ)"], [C.cv("p2"), "似然 p(y₁…y_k | θ)（缩放）"], [C.cv("prob"), "后验 p(θ | y)"], [C.cv("best"), "期望代价 ∫(u−θ)² p(θ|y)dθ"]]),
        h("div", { class: "stats" }, this.stats), this.info);
      this.setKind("uniform");
    }
    setKind(k) {
      this.kind = k; this.n = this.S = this.SS = 0;
      if (k === "normal") { this.sigma = 9; this.theta = 4; } else { this.sigma = 2; this.theta = 9; }
      this.sSl.set(this.sigma); this.tSl.set(this.theta);
      this.update();
    }
    obs(k) { for (let i = 0; i < k; i++) { const y = this.theta + this.sigma * C.gauss(this.r); this.n++; this.S += y; this.SS += y * y; } this.update(); }
    ex16() { if (this.kind !== "normal") { this.kind = "normal"; this.ksw.set("normal"); } this.sigma = 9; this.sSl.set(9); this.theta = 4; this.tSl.set(4); const k = +this.kSel.value; this.n = k; this.S = 4 * k; this.SS = 16 * k; this.update(); }
    logPrior(t) { return this.kind === "uniform" ? (t >= 0 && t <= 10 ? 0 : -Infinity) : -(t * t) / (2 * 16); }
    update() {
      const [x0, x1] = this.dens.o.x, N = 1400, dx = (x1 - x0) / N, s2 = this.sigma * this.sigma;
      const logLik = (t) => -(this.n * t * t - 2 * t * this.S + this.SS) / (2 * s2);
      // 后验均值与方差：正态先验用共轭公式；均匀先验在 [0,10] 上用中点法积分（不受画图范围截断的影响）
      if (this.kind === "normal") {
        const prec = 1 / 16 + this.n / s2;
        this.mean = this.S / s2 / prec; this.var = 1 / prec;
      } else {
        const M = 4000, h0 = 10 / M; let m0 = -Infinity;
        for (let j = 0; j < M; j++) m0 = Math.max(m0, logLik((j + 0.5) * h0));
        let z = 0, s1 = 0, sq = 0;
        for (let j = 0; j < M; j++) { const t = (j + 0.5) * h0, w = Math.exp(logLik(t) - m0); z += w; s1 += w * t; sq += w * t * t; }
        this.mean = s1 / z; this.var = sq / z - this.mean * this.mean;
      }
      // 画图用的网格（中点）
      const th = [], lp = [], ll = [];
      for (let i = 0; i < N; i++) { const t = x0 + (i + 0.5) * dx; th.push(t); lp.push(this.logPrior(t)); ll.push(logLik(t)); }
      const lpost = lp.map((v, i) => v + ll[i]), m = Math.max(...lpost);
      let post = lpost.map((v) => (isFinite(v) ? Math.exp(v - m) : 0)); const Z = post.reduce((a, b) => a + b, 0) * dx; post = post.map((v) => v / Z);
      if (this.kind === "normal") post = th.map((t) => C.npdf(t, this.mean, Math.sqrt(this.var)));
      const prior = lp.map((v) => (isFinite(v) ? Math.exp(v) : 0)); const Zp = prior.reduce((a, b) => a + b, 0) * dx;
      const mL = Math.max(...ll); const lik = ll.map((v) => Math.exp(v - mL));
      this.th = th; this.post = post; this.prior = prior.map((v) => v / Zp); this.lik = lik;
      const yb = this.n ? this.S / this.n : NaN;
      this.stats[0].set(String(this.n)); this.stats[1].set(this.n ? yb.toFixed(4) : "–");
      this.stats[2].set(this.mean.toFixed(4)); this.stats[3].set(Math.sqrt(this.var).toFixed(4)); this.stats[4].set(this.var.toFixed(4));
      let msg = "期望代价 (9.37) 对 u 是一条抛物线：∫(u−θ)²p(θ|y)dθ = Var(θ|y) + (u − E[θ|y])²，所以最优估计就是<b>后验均值</b>，最小期望代价就是后验方差（补充推导）。";
      if (this.kind === "uniform" && this.n) msg += ` 均匀先验把后验截在 [0, 10] 里：观测靠近边界时，u* 会比 ȳ 更往里收（参考代码第 8 项：y = 9、σ = 2 时 u* ≈ 7.98）。`;
      if (this.kind === "normal" && this.n) msg += ` 正态先验 + 正态噪声：u* = (k·ȳ/σ²) / (1/16 + k/σ²)。习题 16 中 yᵢ = 4、σ = 9：k = 1 → 0.6598，k = 10 → 2.6556，k = 1000 → 3.9799；先验的影响随 k 增大而消失（9.5.2 节）。`;
      this.info.innerHTML = msg;
      this.dens.draw(); this.cost.draw();
    }
    drawD(ctx, pl, col) {
      const ymax = Math.max(...this.post, ...this.prior) * 1.1 || 1;
      pl.setRange(null, [0, ymax]);
      pl.axes(col, { xt: C.ticks(...pl.o.x, 8), yt: C.ticks(0, ymax, 3), fy: (v) => v.toFixed(2), xl: "θ" });
      const pts = (arr, sc = 1) => this.th.map((t, i) => ({ x: t, y: arr[i] * sc }));
      pl.path(pts(this.prior), col.muted, 1.5, [5, 4]);
      if (this.n) pl.path(pts(this.lik, Math.max(...this.post)), C.alpha(col.p2, 0.9), 1.8);
      const P = pts(this.post); pl.poly([{ x: P[0].x, y: 0 }, ...P, { x: P[P.length - 1].x, y: 0 }], C.alpha(col.prob, 0.28), null);
      pl.path(P, col.prob, 2.2);
      pl.line({ x: this.theta, y: 0 }, { x: this.theta, y: ymax }, col.text, 1.2, [3, 4]);
      pl.text("真实 θ", { x: this.theta, y: ymax }, col.text, { dy: 9, dx: 20, size: 11 });
      pl.line({ x: this.mean, y: 0 }, { x: this.mean, y: ymax * 0.9 }, col.best, 2);
      pl.text("u*", { x: this.mean, y: ymax * 0.9 }, col.best, { dy: -7, size: 12, weight: 700 });
    }
    drawC(ctx, pl, col) {
      const f = (u) => this.var + (u - this.mean) ** 2, [x0, x1] = pl.o.x, ymax = Math.max(f(x0), f(x1));
      pl.setRange(null, [0, ymax]);
      pl.axes(col, { xt: C.ticks(x0, x1, 8), yt: [0, ymax], fy: (v) => v.toFixed(0), xl: "u（猜测）" });
      pl.curve(f, x0, x1, 200, col.best, 2);
      pl.dot({ x: this.mean, y: this.var }, 5, col.best, col.surface, 1.5);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='prior-simplex']").forEach((el) => (el._w = new PriorSimplex(el)));
    document.querySelectorAll("[data-widget='criteria']").forEach((el) => (el._w = new Criteria(el)));
    document.querySelectorAll("[data-widget='sensor']").forEach((el) => (el._w = new Sensor(el)));
    document.querySelectorAll("[data-widget='ocr']").forEach((el) => (el._w = new OCRWidget(el)));
    document.querySelectorAll("[data-widget='param-est']").forEach((el) => (el._w = new ParamEst(el)));
  });
  // 供测试用
  CH9.nature = { OCR, RANGES, FREQ, SENSORS, GLYPHS };
})();
