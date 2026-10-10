/* 12.1 节：把 I-空间当作大状态空间——非确定 I-空间上的最坏情况值迭代 (12.7)；概率 I-空间（POMDP）的 α-向量与插值近似 (12.10) */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;

  // ---------------------------------------------------------------
  // 组件：五格走廊上的 I_ndet 值迭代（补充的小例子）
  //   X = {1,…,n}；U = {L, R}；自然：无 / 打滑（可能不动）/ 冲过头（可能走两格）；
  //   传感器：无 / 「在 1 号格吗」/ 「在两端吗」/ 位置奇偶；目标：确知自己在 g 号格（(12.1)：X(η) ⊆ X_G）。
  // ---------------------------------------------------------------
  const NATURE = [["none", "无（确定）"], ["slip", "可能打滑"], ["over", "可能冲过头"]];
  const SENSOR = [["none", "无传感器"], ["at1", "在 1 号格吗"], ["ends", "在两端吗"], ["parity", "位置奇偶"]];
  const SENSOR_Y = { none: ["–"], at1: ["否", "是"], ends: ["否", "是"], parity: ["偶", "奇"] };

  class NdetVI {
    constructor(root) {
      this.n = 5; this.g = 1; this.nature = "none"; this.sensor = "none"; this.adv = true;
      const body = C.frame(root, "I_ndet 上的值迭代", "走廊里的机器人不知道自己在哪；把「可能位置的集合」（非确定 I-state）当成新状态，用 (12.7) 求最坏情况代价");
      this.sel = {
        n: C.slider("格数 n", 3, 7, 1, this.n, (v) => { this.n = v; this.g = Math.min(this.g, v); this.rebuild(); }),
        nat: C.select(NATURE, this.nature, (v) => { this.nature = v; this.rebuild(); }),
        sen: C.select(SENSOR, this.sensor, (v) => { this.sensor = v; this.rebuild(); }),
      };
      this.advSeg = C.seg([["adv", "自然：对抗"], ["rand", "自然：随机"]], "adv", (k) => { this.adv = k === "adv"; });
      this.plot = new C.Plot({ aspect: 0.3, maxW: 520, minW: 260, equal: true, m: { l: 8, r: 8, t: 8, b: 8 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.click(p), cursor: () => "pointer" });
      this.stats = { X: C.stat("|X|"), Xd: C.stat("|I_ndet| = 2ⁿ − 1"), R: C.stat("从 X 可达"), G: C.stat("G*(X)") };
      this.tbl = h("div", { class: "ch12-istable" });
      this.log = h("div", { class: "small ch12-log" });
      this.info = h("div", { class: "small" });
      const act = h("div", { class: "controls" },
        C.button("按计划走一步", () => this.stepPlan(), "primary"), C.button("L", () => this.act("L")), C.button("R", () => this.act("R")),
        C.button("重新开始", () => this.restart()), this.advSeg);
      body.append(h("div", { class: "controls" }, this.sel.n, h("span", { class: "sep" }), h("label", null, "自然", this.sel.nat), h("label", null, "传感器", this.sel.sen)),
        h("div", { class: "split" },
          h("div", null, this.plot.wrap, h("div", { class: "small muted" }, "点格子：设真实位置（蓝）；点格子下方的「目标」行：改目标格 g。"), act, h("div", { class: "stats" }, ...Object.values(this.stats)), this.info, this.log),
          h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "从 X 出发可达的 I-state（按 G* 排序）"), this.tbl))),
        C.legend([[C.cv("cand"), "I-state 中还可能的位置"], [C.cv("robot"), "真实位置", true], [C.cv("best"), "目标格 g"]]));
      this.rebuild();
    }
    // ---------- 模型 ----------
    move(x, u, k) { return u === "L" ? Math.max(1, x - k) : Math.min(this.n, x + k); }
    f(x, u) {
      if (this.nature === "slip") return [...new Set([this.move(x, u, 1), x])];
      if (this.nature === "over") return [...new Set([this.move(x, u, 1), this.move(x, u, 2)])];
      return [this.move(x, u, 1)];
    }
    hh(x) {
      if (this.sensor === "at1") return x === 1 ? 1 : 0;
      if (this.sensor === "ends") return x === 1 || x === this.n ? 1 : 0;
      if (this.sensor === "parity") return x % 2;
      return 0;
    }
    bit(x) { return 1 << (x - 1); }
    members(S) { const out = []; for (let x = 1; x <= this.n; x++) if (S & this.bit(x)) out.push(x); return out; }
    // (12.8)：Θ⃗(x⃗, u) = 可能收到的观测；返回 { y: 下一个 I-state }
    step(S, u) {
      const out = {};
      for (const x of this.members(S)) for (const x2 of this.f(x, u)) { const y = this.hh(x2); out[y] = (out[y] || 0) | this.bit(x2); }
      return out;
    }
    rebuild() {
      const all = (1 << this.n) - 1;
      this.X0 = all;
      // 可达 I-state
      const seen = new Set([all]), st = [all];
      while (st.length) { const S = st.pop(); for (const u of "LR") for (const S2 of Object.values(this.step(S, u))) if (!seen.has(S2)) { seen.add(S2); st.push(S2); } }
      this.reach = [...seen];
      // (12.7)：G*(x⃗) = min_u max_θ⃗ { 1 + G*(f⃗(x⃗, u, θ⃗)) }，目标 x⃗ ⊆ {g}
      const goal = this.bit(this.g);
      this.G = new Map(this.reach.map((S) => [S, S === goal ? 0 : Infinity]));
      this.pi = new Map();
      for (let it = 0; it < 200; it++) {
        let ch = false;
        for (const S of this.reach) {
          if (S === goal) continue;
          for (const u of "LR") {
            const v = Math.max(...Object.values(this.step(S, u)).map((S2) => 1 + this.G.get(S2)));
            if (v < this.G.get(S)) { this.G.set(S, v); this.pi.set(S, u); ch = true; }
          }
        }
        if (!ch) break;
      }
      this.reach.sort((a, b) => this.G.get(a) - this.G.get(b) || this.members(a).length - this.members(b).length || a - b);
      this.truth = Math.min(this.truth || Math.ceil(this.n / 2) + 1, this.n);
      this.restart();
    }
    restart() {
      this.S = this.X0; this.hist = []; this.x = Math.min(this.truth, this.n);
      this.update();
    }
    act(u) {
      const opts = this.f(this.x, u);
      let x2;
      if (this.adv) {
        // 对抗的自然：挑让下一个 I-state 最坏的那个结果
        let best = -1;
        for (const c of opts) { const S2 = this.step(this.S, u)[this.hh(c)]; const v = this.G.get(S2); if (v > best || x2 === undefined) { best = v; x2 = c; } }
      } else x2 = opts[Math.floor(Math.random() * opts.length)];
      const y = this.hh(x2), S2 = this.step(this.S, u)[y];
      this.hist.push({ S: this.S, u, y, S2, x: this.x, x2 });
      this.S = S2; this.x = x2;
      this.update();
    }
    stepPlan() {
      if (this.S === this.bit(this.g)) return;
      const u = this.pi.get(this.S);
      if (!u) { this.info.innerHTML = `<span class="msg bad" style="display:inline-block">当前 I-state 的 G* = ∞：最坏情况下没有能保证到达目标的计划。</span>`; return; }
      this.act(u);
    }
    click(p) {
      const i = Math.floor(p.x);
      if (i < 0 || i >= this.n) return null;
      if (p.y < 0) { this.g = i + 1; this.rebuild(); } else { this.truth = i + 1; this.restart(); }
      return null;
    }
    strip(S) {
      return h("span", { class: "ib-strip" }, ...Array.from({ length: this.n }, (_, i) =>
        h("i", { class: "ib" + (S & (1 << i) ? " on" : "") + (i + 1 === this.g ? " g" : "") })));
    }
    setText(S) { return "{" + this.members(S).join(", ") + "}"; }
    update() {
      const g = this.G.get(this.X0);
      this.stats.X.set(this.n); this.stats.Xd.set((1 << this.n) - 1); this.stats.R.set(this.reach.length); this.stats.G.set(C.fmt(g));
      // 表格
      this.tbl.innerHTML = "";
      const t = h("table", { class: "data ch12-small" }, h("thead", null, h("tr", null, h("th", null, "I-state"), h("th", { class: "c" }, "G*"), h("th", { class: "c" }, "π"), h("th", null, "可能的观测"))));
      const tb = h("tbody");
      for (const S of this.reach) {
        const u = this.pi.get(S), goal = S === this.bit(this.g);
        const obs = u ? Object.keys(this.step(S, u)).map((y) => SENSOR_Y[this.sensor][+y] || y).join("、") : "";
        const tr = h("tr", { class: (S === this.S ? "sel" : "") + (goal ? " goal" : "") },
          h("td", null, this.strip(S)), h("td", { class: "c" }, C.fmt(this.G.get(S))), h("td", { class: "c" }, goal ? "到达" : u || "—"), h("td", { class: "small" }, obs));
        tr.addEventListener("click", () => { const m = this.members(S); this.S = S; this.x = m[Math.floor(m.length / 2)]; this.hist = []; this.update(); });
        tb.append(tr);
      }
      t.append(tb); this.tbl.append(t);
      const cur = this.tbl.querySelector("tr.sel");
      if (cur && this.hist.length && this.tbl.scrollHeight > this.tbl.clientHeight) this.tbl.scrollTop = Math.max(0, cur.offsetTop - this.tbl.clientHeight / 2);
      // 日志
      this.log.innerHTML = "";
      if (this.hist.length) {
        const lines = this.hist.map((e, k) => `X${C.sub(k + 1)} = ${this.setText(e.S)} —${e.u}→ ${this.sensor === "none" ? "" : `y = ${SENSOR_Y[this.sensor][e.y]} → `}X${C.sub(k + 2)} = ${this.setText(e.S2)}`);
        this.log.append(...lines.slice(-6).map((s) => h("div", { class: "mono" }, s)));
      }
      const done = this.S === this.bit(this.g);
      let msg;
      if (done) msg = `<span class="msg ok" style="display:inline-block">I-state = {${this.g}} ⊆ X_G：机器人<b>保证</b>在目标格，用了 ${this.hist.length} 步。</span>`;
      else if (g === Infinity) msg = `G*(X) = ∞：${this.nature === "slip" ? "自然可以一直让机器人打滑；只要求最坏情况保证，就永远不能确知到达" : "从 X 出发没有能保证到达的计划"}。换个传感器或目标试试。`;
      else msg = `最坏情况下 ${C.fmt(g)} 步一定能确知到达 g = ${this.g}。${this.sensor === "none" ? "没有传感器时 I-state 的路径完全可预测（12.1.1 末尾）：计划就是一串动作。" : "有观测时下一步的 I-state 不可预测，要用信息反馈。"}`;
      this.info.innerHTML = msg;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const n = this.n;
      pl.setRange([-0.2, n + 0.2], [-0.75, 1.25]);
      for (let i = 0; i < n; i++) {
        const inS = this.S & (1 << i);
        pl.rect(i + 0.04, 0.04, i + 0.96, 0.96, inS ? C.alpha(col.cand, 0.42) : col.surface, col.strong, 1.2);
        pl.text(String(i + 1), { x: i + 0.15, y: 0.82 }, col.muted, { size: 11, align: "left" });
        if (this.sensor !== "none") pl.text("y=" + SENSOR_Y[this.sensor][this.hh(i + 1)], { x: i + 0.5, y: 0.18 }, col.muted, { size: 10 });
        const isG = i + 1 === this.g;
        pl.rect(i + 0.2, -0.62, i + 0.8, -0.18, isG ? col.best : col.surface2, isG ? col.best : col.strong, 1);
        pl.text(isG ? "目标" : "", { x: i + 0.5, y: -0.4 }, col.surface, { size: 10.5, weight: 650 });
      }
      pl.rect(-0.2, 0, 0, 1, col.obst); pl.rect(n, 0, n + 0.2, 1, col.obst);
      pl.dot({ x: this.x - 0.5, y: 0.5 }, Math.max(6, pl.S(0.18)), col.robot);
    }
  }

  // ---------------------------------------------------------------
  // 组件：双状态 POMDP（补充）——α-向量精确值迭代、书中的「枚举 I-state」精确方法、插值近似 (12.10)
  //   x₁ = 坑在左门后，x₂ = 坑在右门后；信念 b = P(x₂ | η)。
  //   动作：听（代价 1，正确率 0.85）、走左门、走右门（掉坑 100，安全 −10；之后问题重置为 b = 1/2）。
  // ---------------------------------------------------------------
  const ACTS = ["左", "听", "右"];
  class Pomdp {
    constructor(root) {
      this.k = 4; this.b = 0.5; this.acc = 0.85; this.N = 9; this.showAll = true; this.showInterp = false;
      const body = C.frame(root, "概率 I-空间上的值迭代（POMDP）", "两扇门、一扇后面是坑：横轴是信念 b = P(坑在右)，纵轴是剩 k 步时的最优期望代价 G*ₖ(b)");
      this.kS = C.slider("剩余步数 k", 1, 10, 1, this.k, (v) => { this.k = v; this.compute(); });
      this.accS = C.slider("听的正确率", 0.55, 0.99, 0.01, this.acc, (v) => { this.acc = v; this.compute(); }, (v) => v.toFixed(2));
      this.NS = C.slider("采样点 N", 3, 41, 1, this.N, (v) => { this.N = v; this.compute(); });
      this.plot = new C.Plot({ aspect: 0.62, maxW: 600, m: { l: 52, r: 14, t: 14, b: 36 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col),
        onDown: (p) => { this.setB(p.x); return { b: true }; }, onMove: (p) => this.setB(p.x), cursor: () => "ew-resize" });
      this.stats = { a: C.stat("α-向量（剪枝后）"), e: C.stat("书中精确方法要枚举的 I-state"), g: C.stat("G*ₖ(b)"), u: C.stat("最优动作") };
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.kS, this.accS),
        h("div", { class: "controls" }, C.checkbox("显示每条 α-向量", this.showAll, (v) => { this.showAll = v; this.plot.draw(); }),
          C.checkbox("插值近似 (12.10)", this.showInterp, (v) => { this.showInterp = v; this.compute(); }), this.NS),
        this.plot.wrap,
        h("div", { class: "controls", style: "margin-top:8px" }, h("span", { class: "small muted" }, "拖动竖线改 b；或者让信念按 (11.38)(11.39) 更新："),
          C.button("听到「坑在左」", () => this.hear(0)), C.button("听到「坑在右」", () => this.hear(1)), C.button("走一扇门 → b = 1/2", () => this.setB(0.5))),
        h("div", { class: "stats" }, ...Object.values(this.stats)), this.info,
        C.legend([[C.cv("accent"), "走左门的 α"], [C.cv("goal"), "听的 α"], [C.cv("mud"), "走右门的 α"], [C.cv("text"), "下包络 G*ₖ(b)"], [C.cv("prob"), "插值近似"]]));
      this.compute();
    }
    // 观测模型与转移：x ∈ {0, 1}，y ∈ {0 = 听到左, 1 = 听到右}
    pObs(u, x2, y) { if (u !== 1) return 0.5; return (y === x2) ? this.acc : 1 - this.acc; }
    pTr(x, u, x2) { if (u === 1) return x === x2 ? 1 : 0; return 0.5; }
    cost(u, x) { if (u === 1) return 1; return (u === 0) === (x === 0) ? 100 : -10; }
    // 一维下包络：直线 v(b) = a0 + (a1 − a0) b，保留在 [0,1] 上某处取到最小值的那些（凸包技巧）
    envelope(V) {
      const L = V.map((a) => ({ a, m: a[1] - a[0], c: a[0] })).sort((p, q) => q.m - p.m || p.c - q.c);
      const hull = [];
      const xAt = (p, q) => (q.c - p.c) / (p.m - q.m);
      for (const l of L) {
        if (hull.length && Math.abs(hull[hull.length - 1].m - l.m) < 1e-12) continue; // 同斜率保留截距小的（已排序）
        while (hull.length >= 2 && xAt(hull[hull.length - 2], l) <= xAt(hull[hull.length - 2], hull[hull.length - 1]) + 1e-12) hull.pop();
        hull.push(l);
      }
      // 裁到 [0, 1]
      const out = [];
      for (let i = 0; i < hull.length; i++) {
        const lo = i ? xAt(hull[i - 1], hull[i]) : -Infinity, hi = i < hull.length - 1 ? xAt(hull[i], hull[i + 1]) : Infinity;
        if (hi > 1e-12 && lo < 1 - 1e-12 && hi - lo > 1e-12) out.push(hull[i].a);
      }
      return out;
    }
    backup(alphas) {
      const cand = [];
      for (let u = 0; u < 3; u++) {
        if (u !== 1) {
          // 走门：转移到均匀分布、观测无信息 → 下一阶段的贡献与 x 无关：min_α (α₀ + α₁)/2
          const m = Math.min(...alphas.map((a) => (a[0] + a[1]) / 2));
          cand.push([this.cost(u, 0) + m, this.cost(u, 1) + m, u]);
          continue;
        }
        // 听：对每个观测 y 选一条下一阶段的 α，逐个观测做「交叉和」并剪枝（增量剪枝）
        let acc = [[0, 0]];
        for (const y of [0, 1]) {
          const proj = this.envelope(alphas.map((a) => [0, 1].map((x) => [0, 1].reduce((s, x2) => s + this.pTr(x, u, x2) * this.pObs(u, x2, y) * a[x2], 0))));
          const nxt = [];
          for (const p of acc) for (const q of proj) nxt.push([p[0] + q[0], p[1] + q[1]]);
          acc = this.envelope(nxt);
        }
        for (const a of acc) cand.push([this.cost(u, 0) + a[0], this.cost(u, 1) + a[1], u]);
      }
      return this.envelope(cand);
    }
    upd(b, u, y) {
      const pred = [0, 1].map((x2) => [0, 1].reduce((s, x) => s + (x ? b : 1 - b) * this.pTr(x, u, x2), 0));
      const post = [0, 1].map((x2) => pred[x2] * this.pObs(u, x2, y));
      const s = post[0] + post[1];
      return { b: s ? post[1] / s : b, p: s };
    }
    compute() {
      this.layers = [[[0, 0, -1]]];
      for (let k = 1; k <= this.k; k++) this.layers.push(this.backup(this.layers[k - 1]));
      this.alphas = this.layers[this.k];
      // 插值近似 (12.10)：在 N 个均匀信念上做值迭代，中间线性插值
      if (this.showInterp) {
        const N = this.N, grid = Array.from({ length: N }, (_, i) => i / (N - 1));
        let G = grid.map(() => 0);
        const interp = (b, G) => { const t = b * (N - 1), i = Math.min(N - 2, Math.floor(t)), w = t - i; return G[i] * (1 - w) + G[i + 1] * w; };
        for (let k = 1; k <= this.k; k++) {
          G = grid.map((b) => Math.min(...[0, 1, 2].map((u) => {
            let c = (1 - b) * this.cost(u, 0) + b * this.cost(u, 1);
            for (const y of [0, 1]) { const r = this.upd(b, u, y); if (r.p > 0) c += r.p * interp(r.b, G); }
            return c;
          })));
        }
        this.interp = { grid, G, f: (b) => interp(b, G) };
      }
      this.update();
    }
    G(b, A) { return Math.min(...(A || this.alphas).map((a) => a[0] * (1 - b) + a[1] * b)); }
    best(b) { let bi = 0, bv = Infinity; this.alphas.forEach((a, i) => { const v = a[0] * (1 - b) + a[1] * b; if (v < bv - 1e-12) { bv = v; bi = i; } }); return this.alphas[bi]; }
    setB(b) { this.b = Math.max(0, Math.min(1, b)); this.update(); }
    hear(y) { this.b = this.upd(this.b, 1, y).b; this.update(); }
    update() {
      const k = this.k, cnt = (Math.pow(6, k + 1) - 1) / 5;
      this.stats.a.set(this.alphas.length);
      this.stats.e.set(cnt >= 1e6 ? cnt.toExponential(2).replace("e+", "×10^") : String(cnt));
      const a = this.best(this.b);
      this.stats.g.set(C.fmtD(this.G(this.b), 3));
      this.stats.u.set(a[2] === 1 ? "听" : a[2] === 0 ? "走左门" : "走右门");
      // 「听」区间
      const xs = []; for (let i = 0; i <= 400; i++) { const b = i / 400; if (this.best(b)[2] === 1) xs.push(b); }
      const lo = xs.length ? xs[0] : null, hi = xs.length ? xs[xs.length - 1] : null;
      this.info.innerHTML = `G*ₖ 是 ${this.alphas.length} 条直线的<b>下包络</b>——分段线性、<b>凹</b>（代价最小化；若按回报最大化写成值函数，就是书中所说的分段线性<b>凸</b>函数）。` +
        (lo !== null ? `剩 ${k} 步时，b ∈ [${lo.toFixed(2)}, ${hi.toFixed(2)}] 该先听，两端才值得直接走门。` : `剩 ${k} 步时，任何信念下都不值得听。`) +
        ` 书中 12.1.3 的精确方法要从 η₀ 枚举所有可能的终端 I-state，个数按 (|U|·|Y|)ᵏ = 6ᵏ 增长；α-向量只要 ${this.alphas.length} 条。` +
        (this.showInterp ? ` 紫色虚线是只在 ${this.N} 个采样信念上做 (12.10) 再线性插值的结果：采样太稀时误差很大。` : "");
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const ys = [];
      for (let i = 0; i <= 50; i++) ys.push(this.G(i / 50));
      const maxA = Math.max(...this.alphas.map((a) => Math.max(a[0], a[1])));
      let y0 = Math.min(...ys), y1 = Math.max(Math.max(...ys), Math.min(maxA, Math.max(...ys) + 40));
      if (this.showInterp) { y0 = Math.min(y0, ...this.interp.G); y1 = Math.max(y1, ...this.interp.G); }
      const pad = (y1 - y0) * 0.08 + 1;
      pl.setRange([0, 1], [y0 - pad, y1 + pad]);
      pl.axes(col, { xt: [0, 0.25, 0.5, 0.75, 1], yt: C.ticks(y0 - pad, y1 + pad, 6), xl: "b = P(坑在右)", yl: "G*ₖ(b)", fx: (t) => String(t) });
      const AC = [col.accent, col.goal, col.mud];
      pl.clip(() => {
        if (this.showAll) for (const a of this.alphas) pl.line({ x: 0, y: a[0] }, { x: 1, y: a[1] }, C.alpha(AC[a[2]], 0.55), 1.2);
        // 下包络
        const P = []; for (let i = 0; i <= 400; i++) P.push({ x: i / 400, y: this.G(i / 400) });
        pl.path(P, col.text, 2.6);
        // 用动作给包络下方着色
        for (let i = 0; i < 400; i++) {
          const b = (i + 0.5) / 400, a = this.best(b);
          pl.rect(i / 400, y0 - pad, (i + 1) / 400, y0 - pad + (y1 - y0) * 0.03 + 0.5, AC[a[2]]);
        }
        if (this.showInterp) {
          const Q = []; for (let i = 0; i <= 200; i++) Q.push({ x: i / 200, y: this.interp.f(i / 200) });
          pl.path(Q, col.prob, 2, [6, 4]);
          this.interp.grid.forEach((b, i) => pl.dot({ x: b, y: this.interp.G[i] }, 3, col.prob));
        }
      });
      pl.line({ x: this.b, y: y0 - pad }, { x: this.b, y: y1 + pad }, col.robot, 1.5, [5, 4]);
      pl.dot({ x: this.b, y: this.G(this.b) }, 5, col.robot);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ndet-vi']").forEach((el) => (el._w = new NdetVI(el)));
    document.querySelectorAll("[data-widget='pomdp']").forEach((el) => (el._w = new Pomdp(el)));
  });
})();
