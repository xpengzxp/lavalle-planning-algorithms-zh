/* 第 12 章：概率 I-state 的三个组件
   12.2.3 概率离散定位（(12.20)–(12.22)）、蒙特卡罗定位（图 12.11，即 11.6.2 的粒子滤波）、
   12.3.5 用 EM 同时定位与建图（(12.29)–(12.32)；这里简化成线性高斯模型，属于补充） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;
  const TAU = 2 * Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const wrapAng = (a) => { a = (a + Math.PI) % TAU; return (a < 0 ? a + TAU : a) - Math.PI; };

  // 两个 CSS 颜色按 t 混合再加透明度（C.alpha 只认十六进制，混合色要自己算）
  function ink(c1, c2, t, a) {
    const p = C.rgb(c1), q = C.rgb(c2);
    const m = p.map((x, i) => Math.round(x + (q[i] - x) * t));
    return `rgba(${m[0]},${m[1]},${m[2]},${a === undefined ? 1 : a})`;
  }
  // 组件进出视口时回调（用来在滚出屏幕时暂停动画）
  function watchVisible(el, fn) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting)), { rootMargin: "60px" }).observe(el);
  }
  const supHTML = (str) => str.replace(/\^([NESW]+)/g, "<sup>$1</sup>");

  // ===============================================================
  // 组件 1：概率离散定位（12.2.3「离散问题」）
  //   状态 x = (p, d)，动作 F/B/R/L 相对于当前朝向（与 12.2.1 相同）。
  //   自然：先按指令转向；再以 p_ok 按意图走一格，各以 (1 − p_ok)/3 向右偏、向左偏或原地不动；撞墙则不动。
  //   传感器 (12.19)：y_k = h(x_k, x_{k−1}, ψ_k) =「位置变了没有」，以 e_s 的概率报错。
  //   与 part3/code/ch12_sensing_uncertainty.py 第 7 项的 trans、p_y 完全相同。
  // ===============================================================
  // 补充的「办公室」地图：第 0 个字符串是最上面一行，'#' 是障碍；三个小房间挂在一条走廊上，左右不对称
  const OFFICE_ROWS = [
    "...#..#.#",
    "...#..#..",
    "#.###.##.",
    ".........",
    ".##.###.#",
    ".#...#...",
  ];
  function rowsToCells(rows) {
    const cells = {}; let n = 0;
    for (let j = rows.length - 1; j >= 0; j--) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== "#") cells[++n] = [i, rows.length - 1 - j];
    return cells;
  }
  const PG_MAPS = {
    a: ["图 12.2a", { 1: [0, 0], 2: [1, 0], 3: [1, 1], 4: [1, 2], 5: [0, 2] }],
    ring: ["图 12.3b 环形", { 8: [0, 0], 1: [1, 0], 2: [2, 0], 3: [2, 1], 4: [2, 2], 5: [1, 2], 6: [0, 2], 7: [0, 1] }],
    ex3: ["图 12.54（习题 3）", { 1: [0, 0], 2: [1, 0], 4: [2, 0], 5: [3, 0], 7: [4, 0], 3: [1, 1], 6: [3, 1] }],
    office: ["办公室（补充）", rowsToCells(OFFICE_ROWS)],
  };
  // 例 12.1 中书上给出的非确定 I-state（12.15）–（12.18），按阶段 k 索引
  const BOOK_121 = { 2: ["(12.15)", "1^W ∪ 2^ES ∪ 3^NS ∪ 4^NE ∪ 5^W"], 3: ["(12.16)", "3^N ∪ 5^W"], 4: ["(12.17)", "4^N"], 5: ["(12.18)", "5^W"] };
  // 参考代码第 7 项的设置与输出
  const REF = { us: ["F", "L", "F", "R"], ys: [1, 1, 0, 1], pOk: 0.7, eS: 0.1, top: "1^W 0.1809, 4^N 0.1462, 3^S 0.1331" };

  class ProbGrid {
    constructor(root) {
      this.root = root;
      this.mapKey = "a"; this.pOk = 0.8; this.eS = 0.1;
      this.showTruth = true; this.showSupport = false;
      this.mode = "free";       // free：真实状态按模型抽样；ref：复现参考代码（观测是给定的）；ex121：例 12.1
      this.r = C.rng(C.newSeed());
      const body = C.frame(root, "概率离散定位", "12.2.3：P(x₁) 均匀；转移会打滑，传感器 y（动了没有）偶尔报错");
      this.plot = new C.Plot({ equal: true, aspect: 1, maxW: 520, m: { l: 4, r: 4, t: 4, b: 4 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.mapSel = C.select(Object.entries(PG_MAPS).map(([k, v]) => [k, v[0]]), this.mapKey, (k) => this.reset(k));
      const param = () => { if (this.mode === "ex121") this.mode = "free"; this.recompute(); };
      this.slOk = C.slider("p_ok", 0.5, 1, 0.01, this.pOk, (v) => { this.pOk = v; param(); }, (v) => v.toFixed(2));
      this.slE = C.slider("e_s", 0, 0.4, 0.01, this.eS, (v) => { this.eS = v; param(); }, (v) => v.toFixed(2));
      this.slOk.title = "按意图走一格的概率；其余 (1 − p_ok)/3 各给右偏、左偏、原地不动";
      this.slE.title = "传感器读数 y 报错的概率";
      const acts = ["F", "B", "R", "L"].map((u) => C.button(C.ACT_ZH[u], () => this.act(u)));
      const rand = C.button("随机 5 步", () => { for (let i = 0; i < 5; i++) this.act("FBRL"[Math.floor(this.r() * 4)]); });
      const again = C.button("重新开始", () => this.reset(this.mapKey));
      const pre1 = C.button("复现参考代码", () => this.presetRef(), "small");
      const pre2 = C.button("例 12.1（p_ok = 1，e_s = 0）", () => this.presetEx121(), "small");
      this.cbT = C.checkbox("真实状态", true, (v) => { this.showTruth = v; this.update(); });
      this.cbS = C.checkbox("叠加支撑集（非确定 I-state）", false, (v) => { this.showSupport = v; this.plot.draw(); });
      this.st = { k: C.stat("阶段 k"), H: C.stat("熵 H（比特）"), pmax: C.stat("P(最可能)"), supp: C.stat("|支撑集|"), ptrue: C.stat("P(真实状态)") };
      this.topEl = h("div");
      this.histEl = h("div", { style: "margin-top:10px" });
      this.info = h("div", { class: "small", style: "margin-top:8px" });
      body.append(
        h("div", { class: "controls" }, h("label", null, "地图", this.mapSel), h("span", { class: "sep" }), pre1, pre2),
        h("div", { class: "controls" }, this.slOk, this.slE),
        h("div", { class: "controls" }, acts, rand, again),
        h("div", { class: "split" },
          h("div", null, this.plot.wrap,
            h("div", { class: "controls", style: "margin:8px 0 0" }, this.cbT, this.cbS),
            C.legend([[C.cv("prob"), "P(x_k | η_k)：线越深越可能"], [C.cv("robot"), "真实状态", true], [C.cv("cand"), "支撑集", true]])),
          h("div", null,
            h("div", { class: "stats", style: "margin-top:0" }, Object.values(this.st)),
            h("div", { class: "panel" }, h("div", { class: "panel-title" }, "概率最大的状态"), h("div", { class: "panel-body" }, this.topEl)),
            this.histEl, this.info)));
      this.reset("a");
    }
    setMap(k) {
      this.mapKey = k; this.mapSel.value = k;
      this.W = new C.TileWorld(PG_MAPS[k][1]);
      const [x0, y0, x1, y1] = this.W.box;
      this.plot.setRange([x0 - 0.5, x1 + 1.5], [y0 - 0.5, y1 + 1.5]);
      this.plot.o.aspect = clamp((y1 - y0 + 2) / (x1 - x0 + 2), 0.45, 1.1);
      this.plot.o.maxW = Math.min(520, Math.round(440 / this.plot.o.aspect));   // 竖长的地图别太高
      this.plot.W = 0; this.plot.resize();    // 换地图后按新比例重排画布
    }
    reset(k) {
      this.setMap(k);
      this.mode = "free";
      const X = this.W.states;
      this.hist = [{ u: null, y: null, truth: X[Math.floor(this.r() * X.length)] }];
      this.view = 0;
      this.recompute();
    }
    // P(x_{k+1} | x_k, u_k)：返回 Map(状态 → 概率)，概率为 0 的分支不放进去（这样 p_ok = 1 时支撑集与非确定模型一致）
    trans(s, u) {
      const W = this.W, [n, d] = W.split(s), nd = C.turnDir(d, u), [x, y] = W.name[n], i = C.DIRS.indexOf(nd);
      const out = new Map(), slip = (1 - this.pOk) / 3;
      const add = (dd, pr) => {
        if (!(pr > 0)) return;
        let q = n;
        if (dd) { const v = C.DV[dd], key = W.key[(x + v[0]) + "," + (y + v[1])]; if (key !== undefined) q = key; }
        out.set(q + nd, (out.get(q + nd) || 0) + pr);
      };
      add(nd, this.pOk);                       // 按意图走
      add(C.DIRS[(i + 1) % 4], slip);          // 向右偏
      add(C.DIRS[(i + 3) % 4], slip);          // 向左偏
      add(null, slip);                         // 原地不动
      return out;
    }
    // 传感器模型 (12.21)：P(y_k | x_{k−1}, x_k)
    pY(y, x0, x1) { return y === this.W.moved(x0, x1) ? 1 - this.eS : this.eS; }
    // 一步被动定位：先按 (11.38) 预测，再用 (12.20)–(12.22) 求 P(y_k | η_{k−1}, u_{k−1}, x_k)，最后贝叶斯
    filter(b, u, y) {
      const rev = new Map();     // x_k → [[x_{k−1}, P(x_k | x_{k−1}, u_{k−1})], …]（反向索引）
      const pred = new Map();    // (11.38)：P(x_k | η_{k−1}, u_{k−1}) = Σ_{x_{k−1}} P(x_k | x_{k−1}, u_{k−1}) P(x_{k−1} | η_{k−1})
      for (const [x0, p0] of b) {
        if (!(p0 > 0)) continue;
        for (const [x1, pt] of this.trans(x0, u)) {
          pred.set(x1, (pred.get(x1) || 0) + p0 * pt);
          if (!rev.has(x1)) rev.set(x1, []);
          rev.get(x1).push([x0, pt]);
        }
      }
      const out = new Map();
      let Z = 0;
      for (const [x1, px1] of pred) {
        // (12.22)：P(x_{k−1} | η_{k−1}, u_{k−1}, x_k) = P(x_k | u_{k−1}, x_{k−1}) P(x_{k−1} | η_{k−1}, u_{k−1}) / Σ_{x_{k−1}}(同上)，
        //          分母恰好就是预测值 pred(x_k)；P(x_{k−1} | η_{k−1}, u_{k−1}) 就是上一阶段的信念 b(x_{k−1})
        // (12.20) + (12.21)：P(y_k | η_{k−1}, u_{k−1}, x_k) = Σ_{x_{k−1}} P(y_k | x_{k−1}, x_k) P(x_{k−1} | η_{k−1}, u_{k−1}, x_k)
        let lik = 0;
        for (const [x0, pt] of rev.get(x1)) lik += this.pY(y, x0, x1) * (pt * b.get(x0)) / px1;
        // 贝叶斯 (11.39)：P(x_k | η_k) ∝ P(y_k | η_{k−1}, u_{k−1}, x_k) P(x_k | η_{k−1}, u_{k−1})
        const v = lik * px1;
        if (v > 0) { out.set(x1, v); Z += v; }
      }
      // 把三式合起来就是熟悉的一行：b'(x') ∝ Σ_x b(x) P(x' | x, u) P(y | x, x')
      if (!(Z > 0)) return null;     // 这串观测在当前模型下不可能
      for (const [x, v] of out) out.set(x, v / Z);
      return out;
    }
    // 按存下来的 η_k（动作与观测）在当前参数下重算每个阶段的概率 I-state
    recompute() {
      const X = this.W.states;
      this.bel = [new Map(X.map((s) => [s, 1 / X.length]))];     // P(x_1 | η_1) = P(x_1)：均匀
      for (let i = 1; i < this.hist.length; i++) {
        const prev = this.bel[i - 1];
        this.bel.push(prev ? this.filter(prev, this.hist[i].u, this.hist[i].y) : null);
      }
      this.update();
    }
    sample(m) {
      let x = this.r(), last = null;
      for (const [k, p] of m) { last = k; x -= p; if (x < 0) return k; }
      return last;
    }
    // 执行动作：真实状态按模型抽样，观测按传感器模型抽样，然后滤波
    act(u) {
      if (this.view < this.hist.length - 1) { this.hist.length = this.view + 1; this.bel.length = this.view + 1; }
      const last = this.hist[this.hist.length - 1], bLast = this.bel[this.bel.length - 1];
      if (!last.truth) {                 // 观测是给定的（复现参考代码）：真实状态从当前后验里抽一个接着演
        if (!bLast) return;
        last.truth = this.sample(bLast); last.sampled = true;
      }
      const x1 = this.sample(this.trans(last.truth, u));
      const moved = this.W.moved(last.truth, x1);
      const y = this.r() < this.eS ? 1 - moved : moved;
      this.hist.push({ u, y, truth: x1 });
      this.bel.push(bLast ? this.filter(bLast, u, y) : null);
      this.view = this.hist.length - 1;
      this.mode = "free";       // 走出预设之后就是普通模拟（例 12.1 的预设在动作做完后再把模式设回来）
      this.update();
    }
    setParams(pOk, eS) { this.pOk = pOk; this.eS = eS; this.slOk.set(pOk); this.slE.set(eS); }
    // 预设一：part3/code/ch12_sensing_uncertainty.py 第 7 项（观测给定，不抽样）
    presetRef() {
      this.setMap("a"); this.setParams(REF.pOk, REF.eS);
      this.hist = [{ u: null, y: null, truth: null }];
      REF.us.forEach((u, i) => this.hist.push({ u, y: REF.ys[i], truth: null, forced: true }));
      this.mode = "ref"; this.view = REF.us.length;
      this.recompute();
    }
    // 预设二：例 12.1，真实初态 1 朝东，动作 F, L, F, L；没有噪声时概率 I-state 在非确定 I-state 上均匀
    presetEx121() {
      this.setMap("a"); this.setParams(1, 0);
      this.hist = [{ u: null, y: null, truth: "1E" }];
      this.view = 0; this.recompute();
      for (const u of ["F", "L", "F", "L"]) this.act(u);
      this.mode = "ex121";
      this.update();
    }
    // 概率最大的 n 个状态：[["1^W", 0.1809…], …]（给页面和测试用）
    top(n) {
      const b = this.bel[this.view];
      if (!b) return [];
      return [...b.entries()].filter((e) => e[1] > 0).sort((a, c) => c[1] - a[1]).slice(0, n).map(([s, p]) => [this.W.show([s]), p, s]);
    }
    support() { const b = this.bel[this.view]; return b ? [...b.keys()].filter((s) => b.get(s) > 0) : []; }
    update() {
      const b = this.bel[this.view], hs = this.hist[this.view], X = this.W.states;
      const truth = this.showTruth ? hs.truth : null;
      this.st.k.set(String(this.view + 1));
      if (b) {
        let H = 0, mx = 0;
        for (const p of b.values()) if (p > 0) { H -= p * Math.log2(p); mx = Math.max(mx, p); }
        this.st.H.set(`${H.toFixed(2)}<span class="small muted"> / ${Math.log2(X.length).toFixed(2)}</span>`);
        this.st.pmax.set(mx.toFixed(4));
        this.st.supp.set(`${this.support().length}<span class="small muted"> / ${X.length}</span>`);
        this.st.ptrue.set(hs.truth ? (b.get(hs.truth) || 0).toFixed(4) : "–");
      } else ["H", "pmax", "supp", "ptrue"].forEach((k) => this.st[k].set("–"));
      // 概率最大的几个状态（条形图）
      const top = this.top(6);
      this.topEl.innerHTML = "";
      if (!top.length) this.topEl.append(h("div", { class: "small muted" }, "—"));
      for (const [lab, p, s] of top) {
        this.topEl.append(h("div", { style: "display:grid;grid-template-columns:3.4em 1fr 4.4em 1.1em;gap:6px;align-items:center;font-size:13px;margin:2px 0" },
          h("span", { class: "mono", html: supHTML(lab) }),
          h("span", { style: "display:block;height:10px;background:var(--surface-2);border-radius:3px;overflow:hidden" },
            h("i", { style: `display:block;height:100%;width:${(100 * p / top[0][1]).toFixed(1)}%;background:${C.cv("prob")}` })),
          h("b", { class: "mono", style: "text-align:right" }, p.toFixed(4)),
          h("span", { style: `color:${C.cv("robot")};font-size:11px`, title: "真实状态" }, truth === s ? "●" : "")));
      }
      // 历史 I-state：η_k = (X, u_1, …, u_{k−1}, y_2, …, y_k)，点一下回看那一阶段
      this.histEl.innerHTML = "";
      const chips = h("div", { class: "chips" });
      const first = Math.max(0, this.hist.length - 12);
      if (first > 0) chips.append(h("span", { class: "small muted", style: "align-self:center" }, "…"));
      for (let i = first; i < this.hist.length; i++) {
        const e = this.hist[i];
        const c = h("button", { type: "button", class: "chip" + (i === this.view ? " on" : ""), style: "padding:2px 9px;font-size:12.5px",
          title: i ? `u = ${e.u}，y = ${e.y}` : "初始：η₁，P(x₁) 均匀" }, `η${C.sub(i + 1)}`);
        c.addEventListener("click", () => { this.view = i; this.update(); });
        chips.append(c);
      }
      const H = this.hist.slice(1, this.view + 1);
      const eta = H.length ? `η${C.sub(this.view + 1)} = (X, ${H.map((e) => e.u).join(", ")}; ${H.map((e) => e.y).join(", ")})` : "η₁ = X（还没有动作与观测）";
      this.histEl.append(chips, h("div", { class: "mono", style: "margin-top:6px;word-break:break-all" }, eta));
      // 说明
      const msg = [];
      if (!b) msg.push(`<p class="no" style="margin:0 0 6px">在当前参数下这串观测的概率为 0（例如 e_s = 0 时却出现过与运动不符的读数），概率 I-state 无定义。调大 e_s 或 p_ok 试试。</p>`);
      if (this.mode === "ref") {
        const got = this.top(3).map(([l, p]) => `${l} ${p.toFixed(4)}`).join(", ");
        const same = this.view === REF.us.length && this.mapKey === "a" && this.pOk === REF.pOk && this.eS === REF.eS;
        msg.push(`<p style="margin:0 0 6px">观测固定为 y₂…y₅ = 1, 1, 0, 1（不抽样，所以没有「真实状态」），设置与 <span class="mono">ch12_sensing_uncertainty.py</span> 第 7 项相同。参考输出：<span class="mono">${supHTML(REF.top)}</span>。` +
          (same ? (got === REF.top ? ` <b class="yes">✓ 一致</b>` : ` <b class="no">✗ 本页得到 ${supHTML(got)}</b>`) : "") + `</p>`);
      } else if (this.mode === "ex121") {
        const k = this.view + 1, bk = BOOK_121[k], sup = this.W.show(this.support());
        msg.push(`<p style="margin:0 0 6px">没有噪声时，概率 I-state 就是非确定 I-state 上的均匀分布。支撑集：<span class="mono">${supHTML(sup)}</span>` +
          (bk ? `；书中 ${bk[0]}：<span class="mono">${supHTML(bk[1])}</span> ${sup === bk[1] ? '<b class="yes">✓</b>' : '<b class="no">✗</b>'}` : "") + `。</p>` +
          (k === 5 ? `<p class="muted" style="margin:0 0 6px">原书笔误：例 12.1 正文说 x₅ 时机器人「在位置 1 朝西」，按 (12.18) 应是位置 5。</p>` : ""));
      } else if (hs.sampled || this.hist.slice(0, this.view + 1).some((e) => e.forced)) {
        msg.push(`<p class="muted" style="margin:0 0 6px">前几步的观测是给定的；之后的真实状态是从当时的后验里抽出来接着模拟的。</p>`);
      }
      msg.push(`<p class="muted" style="margin:0">每个格子里的紫线指向一个朝向，越深表示 P(x_k | η_k) 越大；格子右上角的百分数是位置的边缘概率 Σ_d P(p, d)（格子太小时省略）。</p>`);
      this.info.innerHTML = msg.join("");
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      if (!this.bel) return;
      const b = this.bel[this.view], W = this.W;
      let mx = 0;
      if (b) for (const v of b.values()) mx = Math.max(mx, v);
      const wts = new Map();
      if (b) for (const [s, v] of b) if (v > 0) wts.set(s, v / mx);
      const purple = (a) => ink(col.prob, col.text, 0.3, a);
      const truth = this.showTruth ? this.hist[this.view].truth : null;
      // 透明度 ∝ 概率 / 最大概率；极小的概率不画（支撑集叠加层会把它们标出来）
      C.drawTiles(pl, col, W, { weights: wts, truth, color: (s, w) => purple(w < 0.004 ? 0 : 0.12 + 0.88 * w) });
      if (!b) return;
      // 位置的边缘概率
      const marg = {};
      for (const [s, v] of b) { const n = W.split(s)[0]; marg[n] = (marg[n] || 0) + v; }
      // 格子太小时不写（右侧列表里有数），写在右上角，避开左上角的格子名和中间的朝向线
      if (pl.S(1) >= 50) {
        const fs = clamp(pl.S(0.17), 9.5, 11.5);
        for (const [n, [x, y]] of Object.entries(W.name)) {
          const p = marg[n] || 0;
          if (p >= 0.005) pl.text((100 * p).toFixed(p >= 0.095 ? 0 : 1) + "%", { x: x + 0.94, y: y + 0.93 }, purple(1), { size: fs, align: "right", base: "top", weight: 650 });
        }
      }
      // 支撑集（概率 > 0 的状态）= 同一模型下的非确定 I-state
      if (this.showSupport) {
        for (const [s, v] of b) if (v > 0) {
          const [n, d] = W.split(s), [x, y] = W.name[n], dv = C.DV[d];
          pl.dot({ x: x + 0.5 + dv[0] * 0.37, y: y + 0.5 + dv[1] * 0.37 }, Math.max(2.4, pl.S(0.045)), col.cand, col.surface, 1);
        }
      }
    }
  }

  // ===============================================================
  // 组件 2：蒙特卡罗定位（图 12.11；粒子滤波见 11.6.2）
  //   位姿 x = (x, y, θ) ∈ SE(2)；n 条测距光束在机体坐标系中均匀分布；
  //   p(y | x) = 各光束独立高斯密度之积（书 655 页）；运动 = 指令 (v, ω) + 高斯噪声，撞墙则只转不走。
  // ===============================================================
  const MW = 24, MH = 14, RMAX = 8, ROBOT_R = 0.25, NMAX = 3000;
  const TOP_DOORS = [2.2, 6.8, 11, 15.2, 20.5], BOT_DOORS = [2, 6, 10.2, 14.8, 18.7, 22.2];
  const TOP_DIV = [4.5, 9, 13, 17.5], BOT_DIV = [4, 8, 12.5, 17, 20.5];
  // 家具（实心矩形）：让几个房间可以区分；走廊和几个空房间故意保持相似，信念会出现多峰
  const FURN = [[7.6, 10.8, 8.5, 12.6], [18.2, 12.4, 19.4, 13.4], [22.2, 10.0, 23.2, 11.6], [0.6, 0.6, 1.4, 2.4], [10.8, 1.0, 11.8, 2.0], [22.8, 1.5, 23.4, 2.1]];
  // 自动行驶的路标点：沿走廊来回，顺路进几个房间
  const ROUTE = [[1.5, 7], [2.2, 7], [2.2, 11.5], [2.2, 7], [6, 7], [6, 3], [6, 7], [11, 7], [11, 11.5], [11, 7], [14.8, 7], [14.8, 3], [14.8, 7],
    [20.5, 7], [20.5, 11.2], [20.5, 7], [22.6, 7], [12, 7]].map(([x, y]) => ({ x, y }));

  function mclWalls() {
    const S = [];
    const seg = (a, b, c, d) => S.push([a, b, c, d]);
    const rect = (x0, y0, x1, y1) => { seg(x0, y0, x1, y0); seg(x1, y0, x1, y1); seg(x1, y1, x0, y1); seg(x0, y1, x0, y0); };
    rect(0, 0, MW, MH);
    const doorWall = (y, doors) => { let x = 0; for (const d of doors) { seg(x, y, d - 0.6, y); x = d + 0.6; } seg(x, y, MW, y); };
    doorWall(8.5, TOP_DOORS); doorWall(5.5, BOT_DOORS);
    TOP_DIV.forEach((x) => seg(x, 8.5, x, MH)); BOT_DIV.forEach((x) => seg(x, 0, x, 5.5));
    FURN.forEach((b) => rect(...b));
    return S;
  }
  // 均匀网格加速：每个 1 m 的格子记下与它相交（按包围盒）的墙
  function buildGrid(S) {
    const cs = 1, nx = Math.ceil(MW / cs), ny = Math.ceil(MH / cs);
    const lists = Array.from({ length: nx * ny }, () => []);
    const seg = new Float64Array(S.length * 4);
    S.forEach((s, k) => {
      seg.set(s, 4 * k);
      const i0 = clamp(Math.floor((Math.min(s[0], s[2]) - 0.01) / cs), 0, nx - 1), i1 = clamp(Math.floor((Math.max(s[0], s[2]) + 0.01) / cs), 0, nx - 1);
      const j0 = clamp(Math.floor((Math.min(s[1], s[3]) - 0.01) / cs), 0, ny - 1), j1 = clamp(Math.floor((Math.max(s[1], s[3]) + 0.01) / cs), 0, ny - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) lists[j * nx + i].push(k);
    });
    return { cs, nx, ny, seg, cells: lists.map((l) => Int32Array.from(l)) };
  }
  // 射线 (ox, oy) + t (dx, dy)（单位方向）与墙的最近交点 t，最多到 maxR：Amanatides–Woo 逐格遍历，只测经过的格子
  function castRay(G, ox, oy, dx, dy, maxR) {
    const cs = G.cs, nx = G.nx, ny = G.ny, sg = G.seg, cells = G.cells;
    let cx = clamp(Math.floor(ox / cs), 0, nx - 1), cy = clamp(Math.floor(oy / cs), 0, ny - 1);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    let tMaxX = dx !== 0 ? ((cx + (dx > 0 ? 1 : 0)) * cs - ox) / dx : Infinity;
    let tMaxY = dy !== 0 ? ((cy + (dy > 0 ? 1 : 0)) * cs - oy) / dy : Infinity;
    const tdx = dx !== 0 ? cs / Math.abs(dx) : Infinity, tdy = dy !== 0 ? cs / Math.abs(dy) : Infinity;
    let best = maxR;
    for (;;) {
      const L = cells[cy * nx + cx];
      for (let n = 0; n < L.length; n++) {
        const i = L[n] * 4, ax = sg[i], ay = sg[i + 1], ex = sg[i + 2] - ax, ey = sg[i + 3] - ay;
        const den = dx * ey - dy * ex;
        if (den > -1e-12 && den < 1e-12) continue;
        const qx = ax - ox, qy = ay - oy, t = (qx * ey - qy * ex) / den;
        if (t > 1e-9 && t < best) { const u = (qx * dy - qy * dx) / den; if (u >= 0 && u <= 1) best = t; }
      }
      const tn = tMaxX < tMaxY ? tMaxX : tMaxY;
      if (best <= tn || tn >= maxR) break;
      if (tMaxX < tMaxY) { cx += sx; tMaxX += tdx; if (cx < 0 || cx >= nx) break; }
      else { cy += sy; tMaxY += tdy; if (cy < 0 || cy >= ny) break; }
    }
    return best;
  }
  // 线段 (x0,y0)–(x1,y1) 是否穿过任何墙（只测包围盒覆盖的格子）
  function crossesWall(G, x0, y0, x1, y1) {
    const cs = G.cs, nx = G.nx, ny = G.ny, sg = G.seg, dx = x1 - x0, dy = y1 - y0;
    const i0 = clamp(Math.floor(Math.min(x0, x1) / cs), 0, nx - 1), i1 = clamp(Math.floor(Math.max(x0, x1) / cs), 0, nx - 1);
    const j0 = clamp(Math.floor(Math.min(y0, y1) / cs), 0, ny - 1), j1 = clamp(Math.floor(Math.max(y0, y1) / cs), 0, ny - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const L = G.cells[j * nx + i];
      for (let n = 0; n < L.length; n++) {
        const k = L[n] * 4, ax = sg[k], ay = sg[k + 1], ex = sg[k + 2] - ax, ey = sg[k + 3] - ay;
        const den = dx * ey - dy * ex;
        if (den > -1e-12 && den < 1e-12) continue;
        const qx = ax - x0, qy = ay - y0, t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
      }
    }
    return false;
  }
  const inFurniture = (x, y, pad) => FURN.some((b) => x > b[0] - pad && x < b[2] + pad && y > b[1] - pad && y < b[3] + pad);

  class MCLoc {
    constructor(root) {
      this.root = root;
      this.N = 2500; this.nb = 12; this.sz = 0.3; this.sm = 0.1;
      this.inject = false; this.showBeams = true;
      this.sAdd = 0; this.eps = 0; this.temper = true; this.tau = 0.1; this.beta = 1;
      this.r = C.rng(C.newSeed());
      this.S = mclWalls(); this.G = buildGrid(this.S);
      this.px = new Float64Array(NMAX); this.py = new Float64Array(NMAX); this.pt = new Float64Array(NMAX);
      this.lw = new Float64Array(NMAX); this.w = new Float64Array(NMAX); this.llInc = new Float64Array(NMAX);
      this.tx = new Float64Array(NMAX); this.ty = new Float64Array(NMAX); this.tt = new Float64Array(NMAX);
      this.cell = new Int32Array(NMAX);
      this.z = new Float64Array(24);
      this.truth = { x: ROUTE[0].x, y: ROUTE[0].y, th: 0 }; this.wp = 1; this.blocked = 0;
      this.k = 0; this.neff = this.N; this.est = null; this.nClusters = 0; this.ms = 0; this.note = "";
      this.onScreen = true; this.resume = false; this.lastT = 0;
      const body = C.frame(root, "蒙特卡罗定位", "仿图 12.11：粒子是概率 I-state p(x_k | η_k) 的样本；机器人只有测距光束");
      this.plot = new C.Plot({ equal: true, aspect: 0.6, maxW: 900, m: { l: 4, r: 4, t: 4, b: 4 }, x: [-0.3, MW + 0.3], y: [-0.3, MH + 0.3], onDraw: (ctx, pl, col) => this.draw(ctx, pl, col) });
      this.run = new C.Runner(() => this.tick(), () => this.setRunning(false));
      this.btnRun = C.button("▶ 自动行驶", () => this.toggle(), "primary");
      const one = C.button("单步", () => { this.stop(); this.step(this.autoCmd()); });
      const fwd = C.button("前进", () => { this.stop(); this.step({ v: 0.5, w: 0 }); });
      const lt = C.button("左转", () => { this.stop(); this.step({ v: 0, w: Math.PI / 6 }); });
      const rt = C.button("右转", () => { this.stop(); this.step({ v: 0, w: -Math.PI / 6 }); });
      const kid = C.button("绑架机器人", () => this.kidnap());
      const rp = C.button("重置粒子", () => { this.resetParticles(); this.update(); });
      this.slN = C.slider("粒子数 N", 100, NMAX, 100, this.N, (v) => { this.N = v; this.resetParticles(); this.update(); });
      this.slB = C.slider("光束数 n", 4, 24, 1, this.nb, (v) => { this.nb = v; this.sense(); this.plot.draw(); });
      this.slZ = C.slider("测距噪声 σ_z", 0.05, 1, 0.05, this.sz, (v) => { this.sz = v; this.sense(); this.plot.draw(); }, (v) => v.toFixed(2) + " m");
      this.slM = C.slider("运动噪声", 0, 0.4, 0.02, this.sm, (v) => { this.sm = v; }, (v) => v.toFixed(2));
      this.cbI = C.checkbox("注入随机粒子（补充）", false, (v) => { this.inject = v; });
      this.cbT = C.checkbox("自适应退火（补充）", true, (v) => { this.temper = v; });
      this.cbT.title = "没有粒子能解释观测时，暂时用 p(y|x)^β（β < 1）代替 p(y|x)，避免所有粒子被复制到同一个错误位姿";
      this.cbB = C.checkbox("显示光束", true, (v) => { this.showBeams = v; this.plot.draw(); });
      this.st = { k: C.stat("步数 k"), neff: C.stat("有效粒子数 N_eff"), cl: C.stat("粒子簇"), err: C.stat("位置误差"), aerr: C.stat("朝向误差") };
      this.status = h("div", { class: "status-line small" });
      body.append(
        h("div", { class: "controls" }, this.btnRun, one, h("span", { class: "sep" }), fwd, lt, rt, h("span", { class: "sep" }), kid, rp),
        h("div", { class: "controls" }, this.slN, this.slB, this.slZ, this.slM),
        h("div", { class: "controls" }, this.cbT, this.cbI, this.cbB),
        this.plot.wrap,
        h("div", { class: "stats" }, Object.values(this.st)), this.status,
        C.legend([[C.cv("robot"), "真实位姿与光束（测得的距离）", true], [C.cv("prob"), "粒子（越深权重越大，短线是朝向）", true],
          [`transparent;border:2.5px solid ${C.cv("prob")}`, "估计位姿：主簇的加权平均", true], [C.cv("obst"), "墙与家具"]]));
      watchVisible(root, (vis) => {
        this.onScreen = vis;
        if (vis && this.resume) { this.resume = false; this.start(); }
      });
      this.resetParticles();
      this.sense();
      this.update();
    }
    // ---------- 运行控制 ----------
    setRunning(on) { this.btnRun.textContent = on ? "❚❚ 暂停" : "▶ 自动行驶"; }
    start() { this.run.start(); this.setRunning(true); }
    stop() { this.resume = false; this.run.stop(); }
    toggle() { if (this.run.running) this.stop(); else this.start(); }
    tick() {
      if (!this.onScreen) { this.resume = true; return false; }   // 滚出屏幕：停下，回来时自动继续
      const now = performance.now();
      if (now - this.lastT < 75) return true;                       // 节流：约每秒 12 次更新
      this.lastT = now;
      this.step(this.autoCmd());
      return true;
    }
    // ---------- 模拟器：真实机器人 ----------
    // 自动行驶的控制器（按真实位姿走路标点；它只是模拟器的一部分，与定位无关）
    autoCmd() {
      const R = this.truth;
      let p = ROUTE[this.wp], d = Math.hypot(p.x - R.x, p.y - R.y);
      if (d < 0.3) { this.wp = (this.wp + 1) % ROUTE.length; p = ROUTE[this.wp]; d = Math.hypot(p.x - R.x, p.y - R.y); }
      if (this.blocked > 3) this.reroute();
      const e = wrapAng(Math.atan2(p.y - R.y, p.x - R.x) - R.th);
      return { v: Math.abs(e) > 0.5 ? 0 : Math.min(0.4, d), w: clamp(e, -0.6, 0.6) };
    }
    // 卡住或被手动开到别处后：改去最近的、能直线到达的路标点
    reroute() {
      const R = this.truth;
      let best = -1, bd = Infinity;
      ROUTE.forEach((p, i) => {
        const d = Math.hypot(p.x - R.x, p.y - R.y);
        if (d < bd && !crossesWall(this.G, R.x, R.y, p.x, p.y)) { bd = d; best = i; }
      });
      if (best >= 0) this.wp = best;
      this.blocked = 0;
    }
    // 运动模型的一次抽样：先转 ω，再沿新朝向走 v，两者都带高斯噪声（标准差随指令大小增长）
    motion(x, y, th, v, w) {
      const s = this.sm, r = this.r;
      const th2 = th + w + (s * (Math.abs(w) + 0.3 * Math.abs(v)) + 0.004) * C.gauss(r);
      const d = v + (s * Math.abs(v) + 0.004) * C.gauss(r);
      return [x + d * Math.cos(th2), y + d * Math.sin(th2), wrapAng(th2)];
    }
    clearance(x, y) {
      let m = Infinity;
      for (const s of this.S) m = Math.min(m, C.distPointSeg({ x, y }, { x: s[0], y: s[1] }, { x: s[2], y: s[3] }).d);
      return m;
    }
    moveTruth(cmd) {
      const R = this.truth, [x, y, th] = this.motion(R.x, R.y, R.th, cmd.v, cmd.w);
      R.th = th;
      if (!crossesWall(this.G, R.x, R.y, x, y) && this.clearance(x, y) > 0.2) { R.x = x; R.y = y; this.blocked = 0; }
      else if (cmd.v > 0) this.blocked++;
    }
    // 传感器：每条光束测得真实距离 + N(0, σ_z²)，截在 [0, 最大量程]
    sense() {
      const R = this.truth;
      for (let b = 0; b < this.nb; b++) {
        const a = R.th + (TAU * b) / this.nb;
        const d = castRay(this.G, R.x, R.y, Math.cos(a), Math.sin(a), RMAX);
        this.z[b] = clamp(d + this.sz * C.gauss(this.r), 0, RMAX);
      }
    }
    kidnap() {
      // 绑架：把真实机器人瞬移到路线上远处的随机一点、随机朝向；粒子不知道这件事
      const R = this.truth;
      for (let tries = 0; tries < 100; tries++) {
        const i = Math.floor(this.r() * ROUTE.length), a = ROUTE[i], b = ROUTE[(i + 1) % ROUTE.length], t = this.r();
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (Math.hypot(x - R.x, y - R.y) > 6 || tries === 99) { R.x = x; R.y = y; R.th = wrapAng(this.r() * TAU); this.wp = (i + 1) % ROUTE.length; break; }
      }
      this.blocked = 0;
      this.sense();
      this.note = "机器人被绑架到了别处——粒子还以为它在原地。";
      this.update(true);
    }
    // ---------- 粒子滤波 ----------
    randomPose(i) {
      let x, y;
      do { x = 0.15 + this.r() * (MW - 0.3); y = 0.15 + this.r() * (MH - 0.3); } while (inFurniture(x, y, 0.05));
      this.px[i] = x; this.py[i] = y; this.pt[i] = wrapAng(this.r() * TAU);
    }
    resetParticles() {
      // 绑架问题的初始条件：对位姿一无所知，p(x_1) 在自由空间上均匀
      for (let i = 0; i < this.N; i++) { this.randomPose(i); this.lw[i] = 0; this.w[i] = 1 / this.N; }
      this.neff = this.N; this.est = null; this.nClusters = 0; this.k = 0;
      this.note = "粒子在自由空间里均匀撒开：p(x₁) 均匀。";
    }
    step(cmd) {
      const t0 = performance.now();
      this.note = "";
      this.moveTruth(cmd);
      this.sense();
      this.predict(cmd);
      this.weigh();
      this.estimate();
      this.resample();
      this.k++;
      this.ms = performance.now() - t0;
      this.update();
    }
    // 预测：每个粒子独立抽一次运动噪声（11.6.2 中按 p(x_{k+1} | x_k, u_k) 抽样）；穿墙的只转不走
    predict(cmd) {
      for (let i = 0; i < this.N; i++) {
        const [x, y, th] = this.motion(this.px[i], this.py[i], this.pt[i], cmd.v, cmd.w);
        this.pt[i] = th;
        if (!crossesWall(this.G, this.px[i], this.py[i], x, y)) { this.px[i] = x; this.py[i] = y; }
      }
    }
    // 更新权重：log p(y | x) = Σ_b log N(z_b; ẑ_b(x), σ_z²) + 常数（各光束独立的高斯密度之积，书 655 页），用对数避免下溢。
    //   补充一（默认开）：自适应退火。粒子有限时，可能没有一个粒子接近真实位姿，按原样更新会让 N_eff 掉到 1、
    //     所有粒子被复制到同一个错误位姿（粒子贫化）。这时改用 p(y | x)^β，取最大的 β ∈ (0, 1] 使 N_eff ≥ τN；
    //     粒子能解释观测时 β = 1，就是原样的贝叶斯更新。
    //   补充二（默认关）：σ_add > 0 时把 σ² 换成 σ_z² + σ_add²；eps > 0 时每条光束混入一点均匀分布（Thrun 等人的光束模型）。
    weigh() {
      const N = this.N, nb = this.nb, s2 = this.sz * this.sz + this.sAdd * this.sAdd, inv = 1 / (2 * s2), z = this.z, G = this.G;
      const eps = this.eps, floor = eps > 0 ? (eps * Math.sqrt(TAU * s2)) / RMAX : 0, LL = this.llInc;
      const ca = new Float64Array(nb), sa = new Float64Array(nb);
      for (let b = 0; b < nb; b++) { ca[b] = Math.cos((TAU * b) / nb); sa[b] = Math.sin((TAU * b) / nb); }
      let best = -Infinity;
      for (let i = 0; i < N; i++) {
        const x = this.px[i], y = this.py[i], c = Math.cos(this.pt[i]), s = Math.sin(this.pt[i]);
        let ll = 0;
        for (let b = 0; b < nb; b++) {
          const e = z[b] - castRay(G, x, y, c * ca[b] - s * sa[b], s * ca[b] + c * sa[b], RMAX);
          ll += eps > 0 ? Math.log((1 - eps) * Math.exp(-e * e * inv) + floor) : -e * e * inv;
        }
        LL[i] = ll;
        if (ll > best) best = ll;
      }
      this.bestFit = best / nb;       // 最好的粒子平均每条光束的 log 似然（≈ −½ 表示吻合）
      // 权重 ∝ exp(lw + β·LL)，返回归一化后的 N_eff
      const ess = (beta, store) => {
        let mx = -Infinity;
        for (let i = 0; i < N; i++) { const v = this.lw[i] + beta * LL[i]; if (v > mx) mx = v; }
        let sum = 0, sq = 0;
        for (let i = 0; i < N; i++) { const v = Math.exp(this.lw[i] + beta * LL[i] - mx); sum += v; sq += v * v; if (store) this.w[i] = v; }
        if (store) for (let i = 0; i < N; i++) this.w[i] /= sum;
        return (sum * sum) / sq;
      };
      let beta = 1;
      if (this.temper && ess(1) < this.tau * N) {
        let lo = 0, hi = 1;                       // 二分：N_eff(β) 随 β 增大而减小
        for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (ess(m) >= this.tau * N) lo = m; else hi = m; }
        beta = Math.max(lo, 1e-6);
      }
      this.neff = ess(beta, true);
      for (let i = 0; i < N; i++) this.lw[i] += beta * LL[i];
      this.beta = beta;
    }
    // 粗略聚类：1 m 格子上累加权重，权重超过 1% 的格子按 8 邻接连成簇；主簇的加权平均作为估计
    estimate() {
      const N = this.N, cw = new Float64Array(MW * MH);
      for (let i = 0; i < N; i++) {
        const c = clamp(Math.floor(this.py[i]), 0, MH - 1) * MW + clamp(Math.floor(this.px[i]), 0, MW - 1);
        this.cell[i] = c; cw[c] += this.w[i];
      }
      const lab = new Int32Array(MW * MH).fill(-1), mass = [], TH = 0.01;
      for (let c = 0; c < MW * MH; c++) {
        if (cw[c] < TH || lab[c] >= 0) continue;
        const id = mass.length, st = [c];
        lab[c] = id; let m = 0;
        while (st.length) {
          const q = st.pop(), qi = q % MW, qj = (q - qi) / MW;
          m += cw[q];
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const i = qi + di, j = qj + dj;
            if (i < 0 || j < 0 || i >= MW || j >= MH) continue;
            const n = j * MW + i;
            if (lab[n] < 0 && cw[n] >= TH) { lab[n] = id; st.push(n); }
          }
        }
        mass.push(m);
      }
      this.nClusters = mass.filter((m) => m >= 0.05).length;
      if (!mass.length) { this.est = null; return; }
      const dom = mass.indexOf(Math.max(...mass));
      let sw = 0, sx = 0, sy = 0, sc = 0, ss = 0;
      for (let i = 0; i < N; i++) if (lab[this.cell[i]] === dom) {
        const w = this.w[i]; sw += w; sx += w * this.px[i]; sy += w * this.py[i]; sc += w * Math.cos(this.pt[i]); ss += w * Math.sin(this.pt[i]);
      }
      const ex = sx / sw, ey = sy / sw;
      let spread = 0;
      for (let i = 0; i < N; i++) if (lab[this.cell[i]] === dom) spread += this.w[i] * ((this.px[i] - ex) ** 2 + (this.py[i] - ey) ** 2);
      this.est = { x: ex, y: ey, th: Math.atan2(ss, sc), mass: mass[dom], spread: Math.sqrt(spread / sw) };
    }
    // 低方差（系统）重采样：只在 N_eff < N/2 时做；可选地再把一小部分粒子换成均匀随机的（补充）
    resample() {
      const N = this.N;
      // 补充（类似 Thrun 等人的 Augmented MCL）：连最好的粒子都解释不了观测时，说明信念多半错了，就多注入随机粒子
      const f = this.inject ? clamp(0.05 * (-this.bestFit - 1.5), 0, 0.15) : 0;
      if (this.neff >= N / 2 && f === 0) return;
      const w = this.w, r0 = this.r() / N;
      let c = w[0], i = 0;
      for (let m = 0; m < N; m++) {
        const U = r0 + m / N;
        while (U > c && i < N - 1) { i++; c += w[i]; }
        this.tx[m] = this.px[i]; this.ty[m] = this.py[i]; this.tt[m] = this.pt[i];
      }
      [this.px, this.tx] = [this.tx, this.px]; [this.py, this.ty] = [this.ty, this.py]; [this.pt, this.tt] = [this.tt, this.pt];
      for (let m = 0; m < N; m++) { this.lw[m] = 0; this.w[m] = 1 / N; }
      const nInj = Math.floor(f * N);
      for (let k = 0; k < nInj; k++) this.randomPose(Math.floor(this.r() * N));
      this.note = "N_eff < N/2，已重采样" + (nInj ? `；注入 ${nInj} 个随机粒子` : "") + "。";
    }
    // ---------- 显示 ----------
    update(redrawOnly) {
      const R = this.truth, e = this.est;
      this.st.k.set(String(this.k));
      this.st.neff.set(`${Math.round(this.neff)}<span class="small muted"> / ${this.N}</span>`);
      this.st.cl.set(e ? `${this.nClusters}<span class="small muted">（主簇 ${(100 * e.mass).toFixed(0)}%）</span>` : "–");
      if (e) {
        this.st.err.set(Math.hypot(e.x - R.x, e.y - R.y).toFixed(2) + " m");
        this.st.aerr.set(Math.round(Math.abs(wrapAng(e.th - R.th)) * 180 / Math.PI) + "°");
      } else { this.st.err.set("–"); this.st.aerr.set("–"); }
      const temp = this.k && !redrawOnly && this.beta < 1 ? `似然退火 β = ${this.beta.toFixed(3)}。` : "";
      this.status.innerHTML = (this.note || "") + temp + (this.k && !redrawOnly ? ` <span class="muted">本步计算 ${this.ms.toFixed(0)} ms。</span>` : "") || "&nbsp;";
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const g = pl.geom(), X = (x) => g.ox + (x - pl.o.x[0]) * g.sx, Y = (y) => g.oy - (y - pl.o.y[0]) * g.sy;
      pl.rect(0, 0, MW, MH, col.surface);
      for (const b of FURN) pl.rect(b[0], b[1], b[2], b[3], col.obst);
      ctx.lineCap = "square"; ctx.strokeStyle = col.obst; ctx.lineWidth = Math.max(2, g.sx * 0.14);
      ctx.beginPath();
      for (const s of this.S) { ctx.moveTo(X(s[0]), Y(s[1])); ctx.lineTo(X(s[2]), Y(s[3])); }
      ctx.stroke();
      // 粒子：按权重分 4 档透明度，每档一条路径
      const N = this.N, wmax = Math.max(1e-300, ...this.w.subarray(0, N)), A = [0.16, 0.32, 0.55, 0.85], L = Math.max(4, g.sx * 0.3);
      const buckets = [[], [], [], []];
      for (let i = 0; i < N; i++) buckets[Math.min(3, Math.floor((4 * this.w[i]) / wmax))].push(i);
      const r = Math.max(1.1, g.sx * 0.045);
      buckets.forEach((B, k) => {
        if (!B.length) return;
        const c = ink(col.prob, col.text, 0.2, A[k]);
        ctx.beginPath();
        for (const i of B) { const x = X(this.px[i]), y = Y(this.py[i]); ctx.moveTo(x, y); ctx.lineTo(x + L * Math.cos(this.pt[i]), y - L * Math.sin(this.pt[i])); }
        ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.stroke();
        ctx.beginPath();
        for (const i of B) ctx.rect(X(this.px[i]) - r, Y(this.py[i]) - r, 2 * r, 2 * r);
        ctx.fillStyle = c; ctx.fill();
      });
      // 真实机器人与光束
      const R = this.truth, rx = X(R.x), ry = Y(R.y);
      if (this.showBeams) {
        ctx.beginPath();
        for (let b = 0; b < this.nb; b++) {
          const a = R.th + (TAU * b) / this.nb, d = this.z[b];
          ctx.moveTo(rx, ry); ctx.lineTo(X(R.x + d * Math.cos(a)), Y(R.y + d * Math.sin(a)));
        }
        ctx.strokeStyle = C.alpha(col.robot, 0.55); ctx.lineWidth = 1; ctx.stroke();
        for (let b = 0; b < this.nb; b++) {
          const a = R.th + (TAU * b) / this.nb, d = this.z[b];
          if (d < RMAX - 1e-9) pl.dot({ x: R.x + d * Math.cos(a), y: R.y + d * Math.sin(a) }, 2.2, col.robot);
        }
      }
      const rr = Math.max(5, g.sx * ROBOT_R);
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.fillStyle = C.alpha(col.robot, 0.3); ctx.fill();
      ctx.strokeStyle = col.robot; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rr * 1.6 * Math.cos(R.th), ry - rr * 1.6 * Math.sin(R.th)); ctx.lineWidth = 2.5; ctx.stroke();
      // 估计位姿：主簇的加权平均（主簇足够集中时才画）
      const e = this.est;
      if (e && e.mass >= 0.5 && e.spread < 2) {
        const ex = X(e.x), ey = Y(e.y), er = Math.max(8, g.sx * 0.42), c = ink(col.prob, col.text, 0.35, 1);
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.strokeStyle = col.surface; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + er * Math.cos(e.th), ey - er * Math.sin(e.th)); ctx.lineTo(ex + er * 1.7 * Math.cos(e.th), ey - er * 1.7 * Math.sin(e.th)); ctx.stroke();
      }
    }
  }

  // ===============================================================
  // 组件 3：EM 同时定位与建图（12.3.5，(12.29)–(12.32)）
  //   补充的简化模型（线性高斯，只平移不转动，数据关联已知）：
  //     q_{k+1} = q_k + u_k + N(0, σ_u² I)，q_1 = 0 已知；y_{k,j} = e_j − q_k + N(0, σ_y² I)（|e_j − q_k| ≤ r 时才看得到）。
  //   记 J(q̃, e) = Σ_k |q_{k+1} − q_k − u_k|² / (2σ_u²) + Σ_{(k,j)} |e_j − q_k − y_{k,j}|² / (2σ_y²)。
  //   E 步：p(q̃_K | η_K, ê) 是高斯，均值 = argmin_q J(q, ê)，信息矩阵按坐标分开、是三对角（里程计链）+ 对角（观测），
  //         用 Thomas 算法解；它用到了全部阶段的信息（相当于 [182] 的前向–后向平滑）。
  //   M 步 (12.32)：Q(e, ê) = E[log p(η_K, q̃_K | e)] 对 e 求最大，得 ê_j = 该路标所有观测 (y_{k,j} + E[q_k]) 的平均。
  //   后验协方差不依赖 ê，所以 log p(η_K | ê) = −min_q J(q, ê) + 常数：图中画的就是它，EM 保证它单调不减。
  // ===============================================================
  function thomas(diag, off, rhs) {
    const n = diag.length, cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
    let m = diag[0];
    cp[0] = n > 1 ? off[0] / m : 0; dp[0] = rhs[0] / m;
    for (let i = 1; i < n; i++) {
      m = diag[i] - off[i - 1] * cp[i - 1];
      cp[i] = i < n - 1 ? off[i] / m : 0;
      dp[i] = (rhs[i] - off[i - 1] * dp[i - 1]) / m;
    }
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  }
  // 三对角对称正定矩阵之逆的对角元：1/[A⁻¹]_ii = (前向主元) + (后向主元) − A_ii
  function invDiag(diag, off) {
    const n = diag.length, f = new Float64Array(n), b = new Float64Array(n), out = new Float64Array(n);
    f[0] = diag[0];
    for (let i = 1; i < n; i++) f[i] = diag[i] - (off[i - 1] * off[i - 1]) / f[i - 1];
    b[n - 1] = diag[n - 1];
    for (let i = n - 2; i >= 0; i--) b[i] = diag[i] - (off[i] * off[i]) / b[i + 1];
    for (let i = 0; i < n; i++) out[i] = 1 / (f[i] + b[i] - diag[i]);
    return out;
  }
  // 稠密对称正定方程组（Cholesky），给「联合最小二乘最优」做参照
  function cholSolve(A, n, rhsList) {
    const L = new Float64Array(n * n);
    for (let j = 0; j < n; j++) {
      let s = A[j * n + j];
      for (let k = 0; k < j; k++) s -= L[j * n + k] * L[j * n + k];
      const d = Math.sqrt(Math.max(s, 1e-300));
      L[j * n + j] = d;
      for (let i = j + 1; i < n; i++) {
        let t = A[i * n + j];
        for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k];
        L[i * n + j] = t / d;
      }
    }
    return rhsList.map((b) => {
      const y = new Float64Array(n), x = new Float64Array(n);
      for (let i = 0; i < n; i++) { let t = b[i]; for (let k = 0; k < i; k++) t -= L[i * n + k] * y[k]; y[i] = t / L[i * n + i]; }
      for (let i = n - 1; i >= 0; i--) { let t = y[i]; for (let k = i + 1; k < n; k++) t -= L[k * n + i] * x[k]; x[i] = t / L[i * n + i]; }
      return x;
    });
  }

  class EMSlam {
    constructor(root) {
      this.root = root;
      this.seed = 20261;
      this.K = 70; this.su = 0.2; this.sy = 0.25; this.rs = 4.5; this.M = 14;
      this.showCov = false; this.speed = 5; this.llMode = "ll";
      this.onScreen = true; this.resume = false; this.lastT = 0;
      const body = C.frame(root, "EM：同时定位与建图", "12.3.5 的简化版（补充）：线性高斯模型；E 步平滑整条路径，M 步重新放路标");
      this.map = new C.Plot({ equal: true, aspect: 0.8, maxW: 560, m: { l: 4, r: 4, t: 4, b: 4 }, onDraw: (ctx, pl, col) => this.drawMap(ctx, pl, col) });
      this.llp = new C.Plot({ aspect: 0.62, maxW: 380, minW: 220, m: { l: 58, r: 12, t: 12, b: 34 }, onDraw: (ctx, pl, col) => this.drawLL(ctx, pl, col) });
      this.run = new C.Runner(() => this.tick(), () => this.setRunning(false));
      this.btnRun = C.button("▶ 自动迭代", () => this.toggle(), "primary");
      const one = C.button("EM 一步", () => { this.stop(); this.emStep(); });
      const dr = C.button("回到航位推算初值", () => { this.stop(); this.initDR(); });
      const fresh = C.button("新数据", () => { this.stop(); this.seed = C.newSeed(); this.regen(); });
      const re = () => { this.stop(); this.regen(); };
      this.slK = C.slider("阶段数 K", 30, 120, 1, this.K, (v) => { this.K = v; re(); });
      this.slU = C.slider("里程计噪声 σ_u", 0.02, 0.4, 0.01, this.su, (v) => { this.su = v; re(); }, (v) => v.toFixed(2));
      this.slY = C.slider("观测噪声 σ_y", 0.05, 1, 0.05, this.sy, (v) => { this.sy = v; re(); }, (v) => v.toFixed(2));
      this.slR = C.slider("感知半径 r", 3, 8, 0.5, this.rs, (v) => { this.rs = v; re(); }, (v) => v.toFixed(1));
      this.cbC = C.checkbox("E 步后验的 2σ 圆", false, (v) => { this.showCov = v; this.map.draw(); });
      this.spSeg = C.seg([[5, "5 次/秒"], [30, "30 次/秒"]], this.speed, (v) => { this.speed = v; });
      this.modeSeg = C.seg([["ll", "log p(η | ê)"], ["gap", "log₁₀(距最优)"]], this.llMode, (v) => { this.llMode = v; this.llp.draw(); });
      this.st = { it: C.stat("迭代 i"), le: C.stat("路标 RMS 误差"), pe: C.stat("路径 RMS 误差"), ll: C.stat("log p(η | ê)"), gap: C.stat("距最优") };
      this.info = h("div", { class: "small", style: "margin-top:6px" });
      body.append(
        h("div", { class: "controls" }, this.btnRun, this.spSeg, one, dr, fresh),
        h("div", { class: "controls" }, this.slK, this.slU, this.slY, this.slR),
        h("div", { class: "split" },
          h("div", null, this.map.wrap, h("div", { class: "controls", style: "margin:8px 0 0" }, this.cbC),
            C.legend([[C.cv("robot"), "真实路径"], [C.cv("muted"), "航位推算（虚线）"], [C.cv("prob"), "当前估计：路径与路标 ê"],
              [C.cv("text2"), "真实路标（×）"], [`linear-gradient(90deg, ${C.cv("bad")}, ${C.cv("alive")}, ${C.cv("ok")}, ${C.cv("goal")})`, "拼图块 y + q̂（按路标着色）", true]])),
          h("div", null, h("div", { class: "controls", style: "margin-bottom:6px" }, this.modeSeg), this.llp.wrap, h("div", { class: "stats" }, Object.values(this.st)), this.info)));
      watchVisible(root, (vis) => {
        this.onScreen = vis;
        if (vis && this.resume) { this.resume = false; this.start(); }
      });
      this.regen();
    }
    setRunning(on) { this.btnRun.textContent = on ? "❚❚ 暂停" : "▶ 自动迭代"; }
    start() { if (this.converged) this.initDR(); this.run.start(); this.setRunning(true); }
    stop() { this.resume = false; this.run.stop(); }
    toggle() { if (this.run.running) this.stop(); else this.start(); }
    tick() {
      if (!this.onScreen) { this.resume = true; return false; }
      const now = performance.now();
      if (now - this.lastT < 1000 / this.speed - 4) return true;   // 每秒 5 次（或 30 次）迭代
      this.lastT = now;
      this.emStep();
      return !this.converged;
    }
    // ---------- 生成数据 ----------
    regen() {
      const K = this.K, M = this.M, r1 = C.rng(this.seed), r2 = C.rng(this.seed * 7 + 1), r3 = C.rng(this.seed * 13 + 5);
      // 真实路径：绕路标一圈多一点（1.1 圈），这样结尾回到起点附近，形成「闭环」
      const Rx = 8, Ry = 5, ph1 = r1() * TAU, ph2 = r1() * TAU;
      const P = (t) => { const a = TAU * t, s = 1 + 0.07 * Math.sin(3 * a + ph1) + 0.04 * Math.sin(5 * a + ph2); return [Rx * s * Math.sin(a), Ry - Ry * s * Math.cos(a)]; };
      const [x0, y0] = P(0), q = new Float64Array(2 * K);
      for (let k = 0; k < K; k++) { const [x, y] = P((1.1 * k) / (K - 1)); q[2 * k] = x - x0; q[2 * k + 1] = y - y0; }
      const e = new Float64Array(2 * M);
      for (let j = 0; j < M; j++) {
        const phi = (TAU * (j + 0.2 + 0.6 * r1())) / M, rho = r1() < 0.5 ? 0.4 + 0.35 * r1() : 1.2 + 0.3 * r1();
        e[2 * j] = Rx * rho * Math.sin(phi) - x0; e[2 * j + 1] = Ry - Ry * rho * Math.cos(phi) - y0;
      }
      // 里程计 u_k = q_{k+1} − q_k + 噪声（噪声序列只取决于种子，拖动 σ 只改变幅度）
      const u = new Float64Array(2 * (K - 1));
      for (let k = 0; k < K - 1; k++) for (let c = 0; c < 2; c++) u[2 * k + c] = q[2 * k + 2 + c] - q[2 * k + c] + this.su * C.gauss(r2);
      // 观测：对每个 (k, j) 都抽噪声，只保留感知半径内的
      const obs = [], seen = new Int32Array(M);
      for (let k = 0; k < K; k++) for (let j = 0; j < M; j++) {
        const gx = C.gauss(r3), gy = C.gauss(r3), dx = e[2 * j] - q[2 * k], dy = e[2 * j + 1] - q[2 * k + 1];
        if (dx * dx + dy * dy <= this.rs * this.rs) { obs.push({ k, j, x: dx + this.sy * gx, y: dy + this.sy * gy }); seen[j]++; }
      }
      // 航位推算：把里程计直接累加
      const qDR = new Float64Array(2 * K);
      for (let k = 0; k < K - 1; k++) { qDR[2 * k + 2] = qDR[2 * k] + u[2 * k]; qDR[2 * k + 3] = qDR[2 * k + 1] + u[2 * k + 1]; }
      this.data = { K, M, q, e, u, obs, seen, qDR };
      this.opt = this.solveJoint();
      // 视野：真实路径、路标、航位推算路径的包围盒
      let a = [Infinity, Infinity, -Infinity, -Infinity];
      const grow = (arr) => { for (let i = 0; i < arr.length; i += 2) { a = [Math.min(a[0], arr[i]), Math.min(a[1], arr[i + 1]), Math.max(a[2], arr[i]), Math.max(a[3], arr[i + 1])]; } };
      grow(q); grow(e); grow(qDR);
      const cx = (a[0] + a[2]) / 2, cy = (a[1] + a[3]) / 2, w = a[2] - a[0] + 2.4, hh = a[3] - a[1] + 2.4;
      const s = Math.max(w, hh / 0.8);
      this.map.setRange([cx - s / 2, cx + s / 2], [cy - (s * 0.8) / 2, cy + (s * 0.8) / 2]);
      this.initDR();
    }
    // ---------- EM ----------
    // E 步：给定 ê，求 p(q̃_K | η_K, ê) 的均值（整条路径）与每个阶段的方差（x、y 两个坐标相同）
    estep(eh) {
      const { K, u, obs } = this.data, n = K - 1, a = 1 / (this.su * this.su), c = 1 / (this.sy * this.sy);
      const diag = new Float64Array(n), off = new Float64Array(Math.max(1, n - 1)), bx = new Float64Array(n), by = new Float64Array(n);
      // 未知量下标 i ↔ 阶段 k = i + 1（阶段 0 即书中的 q_1 = 0，已知）
      for (let k = 0; k < K - 1; k++) {
        // 残差 q_{k+1} − q_k − u_k
        diag[k] += a; bx[k] += a * u[2 * k]; by[k] += a * u[2 * k + 1];
        if (k >= 1) { diag[k - 1] += a; bx[k - 1] -= a * u[2 * k]; by[k - 1] -= a * u[2 * k + 1]; off[k - 1] -= a; }
      }
      for (const o of obs) if (o.k >= 1) {
        // 残差 ê_j − q_k − y_{k,j}
        const i = o.k - 1;
        diag[i] += c; bx[i] += c * (eh[2 * o.j] - o.x); by[i] += c * (eh[2 * o.j + 1] - o.y);
      }
      const mx = thomas(diag, off, bx), my = thomas(diag, off, by), v = invDiag(diag, off);
      const mean = new Float64Array(2 * K), vr = new Float64Array(K);
      for (let i = 0; i < n; i++) { mean[2 * i + 2] = mx[i]; mean[2 * i + 3] = my[i]; vr[i + 1] = v[i]; }
      return { mean, var: vr };
    }
    // M 步 (12.32)：ê_j = 平均 (y_{k,j} + E[q_k])；没被看到过的路标无法估计（NaN）
    mstep(qm) {
      const M = this.data.M, e = new Float64Array(2 * M), n = new Int32Array(M);
      for (const o of this.data.obs) { e[2 * o.j] += o.x + qm[2 * o.k]; e[2 * o.j + 1] += o.y + qm[2 * o.k + 1]; n[o.j]++; }
      for (let j = 0; j < M; j++) { if (n[j]) { e[2 * j] /= n[j]; e[2 * j + 1] /= n[j]; } else e[2 * j] = e[2 * j + 1] = NaN; }
      return e;
    }
    J(qm, eh) {
      const { K, u, obs } = this.data, a = 1 / (this.su * this.su), c = 1 / (this.sy * this.sy);
      let s = 0;
      for (let k = 0; k < K - 1; k++) {
        const dx = qm[2 * k + 2] - qm[2 * k] - u[2 * k], dy = qm[2 * k + 3] - qm[2 * k + 1] - u[2 * k + 1];
        s += (a * (dx * dx + dy * dy)) / 2;
      }
      for (const o of obs) {
        const rx = eh[2 * o.j] - qm[2 * o.k] - o.x, ry = eh[2 * o.j + 1] - qm[2 * o.k + 1] - o.y;
        s += (c * (rx * rx + ry * ry)) / 2;
      }
      return s;
    }
    // 参照：对 (q̃, e) 一起做最小二乘（EM 的极限，也是最大似然解）
    solveJoint() {
      const { K, M, u, obs, seen } = this.data, a = 1 / (this.su * this.su), c = 1 / (this.sy * this.sy), nq = K - 1;
      const col = new Int32Array(M).fill(-1);
      let m = 0;
      for (let j = 0; j < M; j++) if (seen[j]) col[j] = m++;
      const n = nq + m, A = new Float64Array(n * n), bx = new Float64Array(n), by = new Float64Array(n);
      const add = (terms, cx, cy, w) => {
        for (const [i, ci] of terms) {
          for (const [j, cj] of terms) A[i * n + j] += w * ci * cj;
          bx[i] -= w * ci * cx; by[i] -= w * ci * cy;
        }
      };
      for (let k = 0; k < K - 1; k++) add(k >= 1 ? [[k, 1], [k - 1, -1]] : [[k, 1]], -u[2 * k], -u[2 * k + 1], a);
      for (const o of obs) add(o.k >= 1 ? [[nq + col[o.j], 1], [o.k - 1, -1]] : [[nq + col[o.j], 1]], -o.x, -o.y, c);
      const [zx, zy] = cholSolve(A, n, [bx, by]);
      const q = new Float64Array(2 * K), e = new Float64Array(2 * M).fill(NaN);
      for (let i = 0; i < nq; i++) { q[2 * i + 2] = zx[i]; q[2 * i + 3] = zy[i]; }
      for (let j = 0; j < M; j++) if (col[j] >= 0) { e[2 * j] = zx[nq + col[j]]; e[2 * j + 1] = zy[nq + col[j]]; }
      return { q, e, ll: -this.J(q, e) };
    }
    // 初值：路径 = 航位推算，ê_0 = 在这条路径下的 M 步
    initDR() {
      this.q = this.data.qDR.slice(); this.var = null;
      this.e = this.mstep(this.q);
      this.iter = 0; this.converged = false;
      this.next = this.estep(this.e);                 // 缓存：下一次 E 步，同时给出 log p(η | ê_0)
      this.ll = [-this.J(this.next.mean, this.e)];
      this.update();
    }
    emStep() {
      const E = this.next;                            // E 步：p(q̃_K | η_K, ê_{i−1})
      this.q = E.mean; this.var = E.var;
      this.e = this.mstep(this.q);                    // M 步：ê_i = argmax_e Q(e, ê_{i−1})
      this.iter++;
      this.next = this.estep(this.e);
      const l = -this.J(this.next.mean, this.e), prev = this.ll[this.ll.length - 1];
      this.ll.push(l);
      // 停止准则只看相邻两次的提高量（实际中并不知道最优值）
      if (l - prev < 1e-6 * Math.max(1, Math.abs(l)) || this.iter >= 1000) this.converged = true;
      this.update();
    }
    rms() {
      const D = this.data;
      let se = 0, ne = 0, sp = 0;
      for (let j = 0; j < D.M; j++) if (D.seen[j]) { se += (this.e[2 * j] - D.e[2 * j]) ** 2 + (this.e[2 * j + 1] - D.e[2 * j + 1]) ** 2; ne++; }
      for (let k = 0; k < D.K; k++) sp += (this.q[2 * k] - D.q[2 * k]) ** 2 + (this.q[2 * k + 1] - D.q[2 * k + 1]) ** 2;
      return { lm: Math.sqrt(se / Math.max(1, ne)), path: Math.sqrt(sp / D.K) };
    }
    update() {
      const D = this.data, r = this.rms(), l = this.ll[this.ll.length - 1];
      this.st.it.set(String(this.iter) + (this.converged ? ' <span class="small yes">收敛</span>' : ""));
      this.st.le.set(r.lm.toFixed(3) + " m");
      this.st.pe.set(r.path.toFixed(3) + " m");
      this.st.ll.set(C.fmtD(l, 1));
      const gap = Math.max(0, this.opt.ll - l);
      this.st.gap.set(gap >= 0.01 ? gap.toFixed(2) : gap.toExponential(1));
      const unseen = D.M - D.seen.filter((n) => n > 0).length;
      this.info.innerHTML =
        `<p style="margin:0 0 6px">${D.K} 个阶段、${D.obs.length} 次观测${unseen ? `；有 ${unseen} 个路标从没进入感知半径，无法估计` : ""}。` +
        (this.iter === 0 ? "第 0 步：路径用航位推算，路标放在拼图块的平均位置——同一路标的块散得很开。" :
          "E 步用当前地图 ê 把整条路径重新定位（用到全部阶段，不只是过去），M 步再把每个路标挪到它那堆拼图块的中心。" +
          (this.iter < 30 ? "拼图块几步就对齐了，但整张图相对真实位置的整体漂移要很多次迭代才慢慢纠正。" : "")) + `</p>` +
        `<p class="muted" style="margin:0">纵轴是 log p(η_K | ê_i)（差一个常数）；绿色虚线是对路径和路标一起做最小二乘得到的最优值，EM 单调地逼近它。换成 log₁₀(距最优) 看：后半段近似直线，即线性收敛。</p>`;
      this.map.draw(); this.llp.draw();
    }
    // 每个路标一种颜色（相邻路标颜色不同）；全部取自 CSS 变量
    palette(col, a) {
      return [[col.bad, col.bad, 0], [col.ok, col.ok, 0], [col.goal, col.goal, 0], [col.alive, col.alive, 0], [col.accent, col.ok, 0.5], [col.mud, col.mud, 0], [col.accent, col.muted, 0.6]]
        .map(([c1, c2, t]) => ink(c1, c2, t, a));
    }
    drawMap(ctx, pl, col) {
      const D = this.data, K = D.K, pal = this.palette(col, 0.78);
      const pts = (arr) => Array.from({ length: arr.length / 2 }, (_, k) => ({ x: arr[2 * k], y: arr[2 * k + 1] }));
      pl.rect(pl.o.x[0], pl.o.y[0], pl.o.x[1], pl.o.y[1], col.surface);
      // 2 m 网格
      for (let x = Math.ceil(pl.o.x[0] / 2) * 2; x <= pl.o.x[1]; x += 2) pl.line({ x, y: pl.o.y[0] }, { x, y: pl.o.y[1] }, col.grid, 1);
      for (let y = Math.ceil(pl.o.y[0] / 2) * 2; y <= pl.o.y[1]; y += 2) pl.line({ x: pl.o.x[0], y }, { x: pl.o.x[1], y }, col.grid, 1);
      // 感知半径（画在起点）
      ctx.beginPath(); ctx.arc(pl.X(0), pl.Y(0), pl.S(this.rs), 0, TAU); ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.alpha(col.muted, 0.6); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      pl.path(pts(D.qDR), col.muted, 1.4, [5, 4]);
      pl.path(pts(D.q), col.robot, 1.6);
      const purple = ink(col.prob, col.text, 0.2, 1);
      if (this.showCov && this.var) {
        ctx.fillStyle = C.alpha(col.prob, 0.12);
        for (let k = 1; k < K; k++) { ctx.beginPath(); ctx.arc(pl.X(this.q[2 * k]), pl.Y(this.q[2 * k + 1]), Math.max(1, pl.S(2 * Math.sqrt(this.var[k]))), 0, TAU); ctx.fill(); }
      }
      pl.path(pts(this.q), purple, 2.4);
      // 拼图块：每次观测按当前路径估计放回世界坐标
      const r = clamp(pl.S(0.07), 1.8, 2.8);
      for (const o of D.obs) {
        ctx.beginPath(); ctx.arc(pl.X(o.x + this.q[2 * o.k]), pl.Y(o.y + this.q[2 * o.k + 1]), r, 0, TAU);
        ctx.fillStyle = pal[o.j % pal.length]; ctx.fill();
      }
      // 真实路标（×）与估计路标（紫圈）
      const xs = Math.max(4, pl.S(0.22));
      for (let j = 0; j < D.M; j++) {
        const x = pl.X(D.e[2 * j]), y = pl.Y(D.e[2 * j + 1]);
        ctx.beginPath(); ctx.moveTo(x - xs, y - xs); ctx.lineTo(x + xs, y + xs); ctx.moveTo(x - xs, y + xs); ctx.lineTo(x + xs, y - xs);
        ctx.strokeStyle = D.seen[j] ? col.text2 : col.muted; ctx.lineWidth = 1.8; ctx.stroke();
      }
      for (let j = 0; j < D.M; j++) {
        if (!isFinite(this.e[2 * j])) continue;
        const p = { x: this.e[2 * j], y: this.e[2 * j + 1] };
        pl.dot(p, Math.max(5, pl.S(0.28)), C.alpha(col.prob, 0.25), purple, 2.2);
      }
      // 起点
      pl.dot({ x: 0, y: 0 }, 5, col.robot, col.surface, 1.5);
      pl.text("q₁ = 0", { x: 0, y: 0 }, col.robot, { dy: 14, size: 11.5, weight: 650 });
    }
    drawLL(ctx, pl, col) {
      const L = this.ll, n = Math.max(10, L.length - 1), c = ink(col.prob, col.text, 0.2, 1), gapMode = this.llMode === "gap";
      // 纵轴：log p(η | ê_i)，或 log₁₀(ℓ* − ℓ_i)（线性收敛时是一条直线）
      const V = gapMode ? L.map((v) => Math.log10(Math.max(this.opt.ll - v, 1e-9))) : L;
      let lo = Math.min(...V), hi = gapMode ? Math.max(...V) : Math.max(this.opt.ll, ...V);
      const pad = Math.max((hi - lo) * 0.08, gapMode ? 0.3 : 1);
      lo -= pad; hi += pad;
      pl.setRange([0, n], [lo, hi]);
      pl.axes(col, { xt: C.ticks(0, n, 5), yt: C.ticks(lo, hi, 4), fy: (v) => C.fmtD(v, gapMode ? 1 : 0), xl: "迭代 i", yl: gapMode ? "log₁₀(ℓ* − ℓ)" : "log p(η | ê)" });
      if (!gapMode) {
        pl.line({ x: 0, y: this.opt.ll }, { x: n, y: this.opt.ll }, col.best, 1.4, [5, 4]);
        pl.text("最优 ℓ*", { x: n, y: this.opt.ll }, col.best, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11, weight: 650 });
      }
      const P = V.map((v, i) => ({ x: i, y: v }));
      pl.clip(() => {
        pl.path(P, c, 2);
        if (P.length <= 60) P.forEach((p) => pl.dot(p, 2.4, c));
        else pl.dot(P[P.length - 1], 3, c);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='prob-grid']").forEach((el) => (el._w = new ProbGrid(el)));
    document.querySelectorAll("[data-widget='mcl']").forEach((el) => (el._w = new MCLoc(el)));
    document.querySelectorAll("[data-widget='em-slam']").forEach((el) => (el._w = new EMSlam(el)));
  });
})();
