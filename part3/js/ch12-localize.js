/* 12.2 节：离散定位（被动：非确定 I-state 的更新；主动：在可达 I-state 上做最坏情况值迭代得到信息反馈计划树）、
   连续多边形里用指南针 + 可见性传感器定位（H(y)、叠图消歧、可见性单元分解） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;

  // 图 12.2a、图 12.3b、图 12.54 的格子坐标（y 向上）
  const MAPS = {
    a: { name: "图 12.2a", cells: { 1: [0, 0], 2: [1, 0], 3: [1, 1], 4: [1, 2], 5: [0, 2] } },
    loop: { name: "图 12.3b（环形）", cells: { 8: [0, 0], 1: [1, 0], 2: [2, 0], 3: [2, 1], 4: [2, 2], 5: [1, 2], 6: [0, 2], 7: [0, 1] } },
    ex3: { name: "图 12.54（习题 3）", cells: { 1: [0, 0], 2: [1, 0], 4: [2, 0], 5: [3, 0], 7: [4, 0], 3: [1, 1], 6: [3, 1] } },
  };
  const ARROW = { N: "↑", E: "→", S: "↓", W: "←" };
  // 书里的上标记号：3^{N,S} 写成 3 加上指向这些方向的短线；这里用箭头
  function showHTML(W, S) {
    const by = {};
    for (const s of S) { const [n, d] = W.split(s); (by[n] = by[n] || []).push(d); }
    const keys = Object.keys(by).sort((a, b) => a - b);
    if (!keys.length) return "∅";
    return keys.map((n) => `${n}<sup>${by[n].sort((a, b) => C.DIRS.indexOf(a) - C.DIRS.indexOf(b)).map((d) => ARROW[d]).join("")}</sup>`).join(" ∪ ");
  }
  const keyOf = (S) => [...S].sort().join("|");
  // 从 X 出发、所有动作序列下可达的 I-state
  function reachable(W, X0) {
    const seen = new Map([[keyOf(X0), X0]]), st = [X0];
    while (st.length) {
      const S = st.pop();
      for (const u of W.U()) for (const S2 of Object.values(W.step(S, u))) { const k = keyOf(S2); if (!seen.has(k)) { seen.set(k, S2); st.push(S2); } }
    }
    return seen;
  }

  // ---------------------------------------------------------------
  // 组件：被动定位——网格上的非确定 I-state（例 12.1、12.2、习题 1、指南针模型）
  // ---------------------------------------------------------------
  const PRESETS = {
    ex121: { map: "a", compass: false, truth: "1E", seq: "FLFL", label: "例 12.1" },
    ex122: { map: "loop", compass: false, truth: "1E", seq: "FLFLFLFL", label: "例 12.2（对称）" },
    hw1: { map: "a", compass: false, truth: "3N", seq: "LLFBFRFF", label: "习题 1" },
    comp: { map: "loop", compass: true, truth: "1N", seq: "EN", label: "指南针 + 环形" },
  };
  class GridLoc {
    constructor(root) {
      this.mapKey = "a"; this.compass = false; this.showTruth = true; this.truth = "1E"; this.queue = [];
      const body = C.frame(root, "被动定位：非确定 I-state", "机器人有地图、不知道自己在哪、朝哪；唯一的传感器只报告「刚才动了没有」");
      this.mapSel = C.select(Object.entries(MAPS).map(([k, m]) => [k, m.name]), this.mapKey, (k) => { this.mapKey = k; this.reset(true); });
      this.cmpCb = C.checkbox("有指南针（动作 = 东南西北）", this.compass, (v) => { this.compass = v; this.reset(true); });
      this.truthCb = C.checkbox("显示真实状态", this.showTruth, (v) => { this.showTruth = v; this.plot.draw(); });
      this.presetSeg = C.seg(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), null, (k) => this.preset(k));
      this.plot = new C.Plot({ aspect: 0.72, maxW: 380, minW: 220, equal: true, m: { l: 6, r: 6, t: 6, b: 6 },
        onDraw: (ctx, pl, col) => this.S && C.drawTiles(pl, col, this.W, { weights: new Map([...this.S].map((s) => [s, 1])), truth: this.showTruth ? this.x : null }),
        onDown: (p) => this.click(p), cursor: () => "pointer" });
      this.btns = h("div", { class: "controls" });
      this.next = C.button("▶ 按预设走下一步", () => this.playNext(), "primary");
      this.stats = { n: C.stat("|X|"), k: C.stat("|X_k(η_k)|"), s: C.stat("状态") };
      this.cur = h("div", { class: "ch12-istate" });
      this.histEl = h("div", { class: "table-wrap", style: "margin:6px 0 0;max-height:260px;overflow:auto" });
      body.append(h("div", { class: "controls" }, h("label", null, "地图", this.mapSel), this.cmpCb, this.truthCb),
        h("div", { class: "controls" }, h("span", { class: "small muted" }, "预设："), this.presetSeg),
        h("div", { class: "split" },
          h("div", null, this.plot.wrap, h("div", { class: "small muted" }, "点格子设真实位置，再点同一格换朝向（会重新开始）。")),
          h("div", null, this.btns, h("div", { class: "controls" }, this.next, C.button("重新开始", () => this.reset(false))), h("div", { class: "stats" }, ...Object.values(this.stats)), this.cur, this.histEl)),
        C.legend([[C.cv("cand"), "X_k(η_k) 中还可能的（位置, 朝向）"], [C.cv("robot"), "真实状态", true]]));
      this.reset(true);
    }
    preset(k) {
      const p = PRESETS[k];
      this.mapKey = p.map; this.mapSel.value = p.map; this.compass = p.compass; this.cmpCb.input.checked = p.compass;
      this.truth = p.truth;
      this.reset(true);
      this.queue = p.seq.split("");
      this.updateNext();
    }
    reset(rebuild) {
      if (rebuild) {
        this.W = new C.TileWorld(MAPS[this.mapKey].cells, { compass: this.compass });
        this.plot.setAspect(C.tilesAspect(this.W));
        if (!this.W.states.includes(this.truth)) this.truth = this.W.states[0];
        const R = reachable(this.W, new Set(this.W.states));
        this.minSize = Math.min(...[...R.values()].map((S) => S.size));
        this.btns.innerHTML = "";
        this.btns.append(...this.W.U().map((u) => C.button(C.ACT_ZH[u], () => { this.queue = []; this.act(u); this.updateNext(); })));
      }
      this.S = new Set(this.W.states); this.x = this.truth; this.hist = []; this.queue = [];
      this.updateNext();
      this.update();
    }
    updateNext() { this.next.disabled = !this.queue.length; this.next.textContent = this.queue.length ? `▶ 下一步：${this.queue[0]}（还剩 ${this.queue.length}）` : "▶ 按预设走下一步"; }
    playNext() { if (!this.queue.length) return; this.act(this.queue.shift()); this.updateNext(); }
    act(u) {
      const x2 = this.W.f(this.x, u), y = this.W.moved(this.x, x2);
      const S2 = this.W.step(this.S, u)[y] || new Set();
      this.hist.push({ u, y, S: S2 });
      this.S = S2; this.x = x2;
      this.update();
    }
    click(p) {
      const n = this.W.key[Math.floor(p.x) + "," + Math.floor(p.y)];
      if (n === undefined) return null;
      const [n0, d0] = this.W.split(this.truth);
      this.truth = n0 === n ? n + C.DIRS[(C.DIRS.indexOf(d0) + 1) % 4] : n + "E";
      this.reset(false);
      return null;
    }
    update() {
      const k = this.hist.length + 1;
      this.stats.n.set(this.W.states.length);
      this.stats.k.set(this.S.size);
      this.stats.s.set(this.S.size === 1 ? "已定位 ✓" : this.S.size === this.minSize ? "对称类（不能再小）" : "还不确定");
      this.cur.innerHTML = `<span class="muted">X${C.sub(k)}(η${C.sub(k)}) =</span> ${showHTML(this.W, this.S)}`;
      const rows = this.hist.map((e, i) => `<tr><td class="c">${i + 1}</td><td class="c">${e.u}</td><td class="c">y${C.sub(i + 2)} = ${e.y}</td><td>X${C.sub(i + 2)} = ${showHTML(this.W, e.S)}</td><td class="c">${e.S.size}</td></tr>`);
      this.histEl.innerHTML = `<table class="data ch12-small"><thead><tr><th class="c">k</th><th class="c">u_k</th><th class="c">观测</th><th>非确定 I-state</th><th class="c">个数</th></tr></thead><tbody>` +
        `<tr><td class="c">—</td><td class="c">—</td><td class="c">（无 y₁）</td><td>X₁ = X</td><td class="c">${this.W.states.length}</td></tr>${rows.join("")}</tbody></table>`;
      this.histEl.scrollTop = this.histEl.scrollHeight;
      this.plot.draw();
    }
  }

  // ---------------------------------------------------------------
  // 组件：主动定位——在可达 I-state 上做最坏情况值迭代，画出信息反馈计划树
  // ---------------------------------------------------------------
  class ActiveLoc {
    constructor(root) {
      this.mapKey = "a"; this.costMode = "book"; this.truth = "4S"; this.sel = null;
      const body = C.frame(root, "主动定位：信息反馈计划", "从 X 出发，在可达的非确定 I-state 上求最坏情况最优计划 π : X⃗ → U，画成以观测分叉的树");
      this.mapSel = C.select(Object.entries(MAPS).map(([k, m]) => [k, m.name]), this.mapKey, (k) => { this.mapKey = k; this.build(); });
      this.costSeg = C.seg([["book", "代价：动了 2、没动 1（书中）"], ["unit", "每步代价 1"]], this.costMode, (k) => { this.costMode = k; this.build(); });
      this.map = new C.Plot({ aspect: 0.72, maxW: 300, minW: 200, equal: true, m: { l: 6, r: 6, t: 6, b: 6 },
        onDraw: (ctx, pl, col) => C.drawTiles(pl, col, this.W, { weights: new Map([...(this.sel ? this.sel.S : [])].map((s) => [s, 1])), truth: this.truth }),
        onDown: (p) => this.clickMap(p), cursor: () => "pointer" });
      this.treeWrap = h("div", { class: "ch12-treewrap" });
      this.canvas = h("canvas");
      this.treeWrap.append(this.canvas);
      this.canvas.addEventListener("pointerdown", (e) => this.clickTree(e));
      this.stats = { n: C.stat("|X|"), all: C.stat("I_ndet 的大小 2^|X| − 1"), r: C.stat("从 X 可达的 I-state"), g: C.stat("G*(X)"), d: C.stat("最坏步数"), t: C.stat("计划树结点") };
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "地图", this.mapSel), this.costSeg),
        h("div", { class: "stats" }, ...Object.values(this.stats)),
        h("div", { class: "split split-31", style: "grid-template-columns:minmax(0,3fr) minmax(160px,1.1fr)" },
          h("div", null, this.treeWrap),
          h("div", null, this.map.wrap, h("div", { class: "small muted" }, "点地图设真实初始状态（再点换朝向），树上会标出它会走的分支；点树的结点看那个 I-state。"))),
        this.info,
        C.legend([[C.cv("text"), "结点 = 非确定 I-state，数字 = 其中状态个数"], [C.cv("best"), "目标：单个状态 / 最小对称类"], [C.cv("robot"), "真实初始状态下实际走过的分支"]]));
      new ResizeObserver(() => this.drawTree()).observe(this.treeWrap);
      PA.onThemeChange(() => { this.drawTree(); });
      this.build();
    }
    cost(y) { return this.costMode === "book" ? (y ? 2 : 1) : 1; }
    build() {
      this.W = new C.TileWorld(MAPS[this.mapKey].cells);
      this.map.setAspect(C.tilesAspect(this.W));
      if (!this.W.states.includes(this.truth)) this.truth = this.W.states[3];
      const X = new Set(this.W.states);
      this.R = reachable(this.W, X);
      const m = Math.min(...[...this.R.values()].map((S) => S.size));
      this.minSize = m;
      const goal = (S) => S.size === m;
      // 最坏情况值迭代 (12.7)：G(x⃗) = min_u max_y [ l(y) + G(f⃗(x⃗, u, y)) ]
      const G = new Map(), pi = new Map();
      for (const [k, S] of this.R) G.set(k, goal(S) ? 0 : Infinity);
      for (let it = 0; it < 300; it++) {
        let ch = false;
        for (const [k, S] of this.R) {
          if (goal(S)) continue;
          for (const u of this.W.U()) {
            const nx = this.W.step(S, u);
            let v = 0;
            for (const [y, S2] of Object.entries(nx)) v = Math.max(v, this.cost(+y) + G.get(keyOf(S2)));
            if (v < G.get(k) - 1e-12) { G.set(k, v); pi.set(k, u); ch = true; }
          }
        }
        if (!ch) break;
      }
      this.G = G; this.pi = pi;
      // 计划树
      let count = 0;
      const mk = (S, depth, y) => {
        count++;
        const k = keyOf(S), node = { S, key: k, y, depth, children: [] };
        if (goal(S) || depth > 12) return node;
        node.u = pi.get(k);
        const nx = this.W.step(S, node.u);
        for (const yy of Object.keys(nx).sort()) node.children.push(mk(nx[yy], depth + 1, +yy));
        return node;
      };
      this.root = mk(X, 0, null);
      let maxD = 0; (function rec(n) { maxD = Math.max(maxD, n.depth); n.children.forEach(rec); })(this.root);
      this.stats.n.set(X.size); this.stats.all.set((Math.pow(2, X.size) - 1).toLocaleString("en-US"));
      this.stats.r.set(this.R.size); this.stats.g.set(C.fmt(G.get(keyOf(X)))); this.stats.d.set(maxD); this.stats.t.set(count);
      this.info.innerHTML = (m === 1 ? "这张地图没有对称性：计划一定能把 I-state 缩到单个状态。" :
        `这张地图有对称性：从 X 出发能到达的最小 I-state 有 ${m} 个状态（一个<b>对称类</b>），目标就取「最小可达 I-state」——书中 X⃗_G 的第二种定义。`) +
        ` 全部 ${(Math.pow(2, X.size) - 1).toLocaleString("en-US")} 个非空子集里，从 X 出发真正可达的只有 ${this.R.size} 个——初始 I-state 总是 X 时，计划只需定义在这一小部分上（12.2.1「预先计算的计划」）。`;
      this.sel = this.root;
      this.markTruth();
      this.drawTree(); this.map.draw();
    }
    markTruth() {
      // 沿真实初始状态在树上走一遍
      let n = this.root, x = this.truth;
      const clear = (t) => { t.onPath = false; t.children.forEach(clear); };
      clear(this.root);
      n.onPath = true;
      while (n.children.length) {
        const x2 = this.W.f(x, n.u), y = this.W.moved(x, x2);
        n = n.children.find((c) => c.y === y); x = x2;
        if (!n) break;
        n.onPath = true;
      }
    }
    drawTree() {
      if (!this.root) return;
      const col = C.colors(this.treeWrap);
      const lay = C.layoutTree(this.root, { dx: 1, dy: 1, x0: 0, y0: 0 });
      const avail = Math.max(260, this.treeWrap.clientWidth || 520);
      const dx = Math.max(22, Math.min(46, (avail - 40) / lay.leaves)), dy = 54;
      const W = Math.max(avail, lay.leaves * dx + 40), H = (lay.depth + 1) * dy + 24;
      C.layoutTree(this.root, { dx, dy, x0: 20 + (W - 40 - (lay.leaves - 1) * dx) / 2 - 0, y0: 22 });
      const ctx = PA.fitCanvas(this.canvas, W, H);
      ctx.clearRect(0, 0, W, H);
      const dec = (n) => {
        const goal = n.S.size === this.minSize;
        n.shape = goal ? "square" : "circle";
        n.label = n.S.size;
        n.r = 10;
        n.color = n.onPath ? col.robot : goal ? col.best : col.text2;
        n.fill = goal ? C.alpha(col.best, 0.22) : col.surface;
        n.hl = n === this.sel;
        n.edgeColor = n.onPath ? col.robot : col.strong;
        n.edgeWidth = n.onPath ? 2.6 : 1.3;
        n.edgeLabel = n.y === null ? "" : "y=" + n.y;
        n.children.forEach(dec);
      };
      dec(this.root);
      C.drawTree(ctx, this.root, col, { font: "11px " + getComputedStyle(document.body).fontFamily });
      // 动作标在结点右侧
      ctx.font = "600 11px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      (function rec(n) { if (n.u) { ctx.fillStyle = col.accent; ctx.fillText(n.u, n.px + 12, n.py - 9); } n.children.forEach(rec); })(this.root);
      this.nodes = [];
      (function rec(n, arr) { arr.push(n); n.children.forEach((c) => rec(c, arr)); })(this.root, this.nodes);
    }
    clickTree(e) {
      const r = this.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bd = 16;
      for (const n of this.nodes || []) { const d = Math.hypot(n.px - px, n.py - py); if (d < bd) { bd = d; best = n; } }
      if (best) { this.sel = best; this.drawTree(); this.map.draw(); }
    }
    clickMap(p) {
      const n = this.W.key[Math.floor(p.x) + "," + Math.floor(p.y)];
      if (n === undefined) return null;
      const [n0, d0] = this.W.split(this.truth);
      this.truth = n0 === n ? n + C.DIRS[(C.DIRS.indexOf(d0) + 1) % 4] : n + "E";
      this.markTruth(); this.drawTree(); this.map.draw();
      return null;
    }
  }

  // ---------------------------------------------------------------
  // 组件：连续多边形里的组合定位（12.2.2）——指南针 + 可见性传感器
  //   H(y)：与当前距离读数完全一致的位置（只差一个平移）；运动后把每个候选平移同样的位移再筛一遍（叠图）。
  // ---------------------------------------------------------------
  // 单位格子的并 → 简单直角多边形（自由区域在左侧，逆时针），合并共线边
  function rectsToPoly(rects) {
    const free = new Set();
    for (const [x0, y0, x1, y1] of rects) for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) free.add(i + "," + j);
    const F = (i, j) => free.has(i + "," + j), next = new Map();
    for (const k of free) {
      const [i, j] = k.split(",").map(Number);
      if (!F(i, j - 1)) next.set(i + "," + j, [i + 1, j]);
      if (!F(i + 1, j)) next.set((i + 1) + "," + j, [i + 1, j + 1]);
      if (!F(i, j + 1)) next.set((i + 1) + "," + (j + 1), [i, j + 1]);
      if (!F(i - 1, j)) next.set(i + "," + (j + 1), [i, j]);
    }
    const start = next.keys().next().value, P = [];
    let cur = start;
    do { const [x, y] = cur.split(",").map(Number); P.push({ x, y }); const n = next.get(cur); cur = n[0] + "," + n[1]; } while (cur !== start && P.length < 10000);
    return P.filter((p, i) => { const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length]; return Math.abs(C.cross(C.sub2(p, a), C.sub2(b, p))) > 1e-12; });
  }
  // 例 12.3 风格的环境（补充：按图 12.7 的意思自己搭的）：底部走廊 + 四根「F」形竖走廊；顶上的小旗完全一样，
  // 左边两根比右边两根短，每根的侧向小走廊在同一相对高度，但一长一短。
  function combEnv() {
    const R = [[0, 0, 38, 2]];
    const teeth = [[2, 14, 1], [11, 14, 4], [20, 17, 1], [29, 17, 4]];
    for (const [b, top, br] of teeth) { R.push([b, 2, b + 2, top - 2], [b, top - 2, b + 5, top], [b + 2, 6, b + 2 + br, 8]); }
    return { poly: rectsToPoly(R), start: { x: 6.25, y: 13.25 }, box: [-1, -1, 39, 18],
      route: [[{ x: 3.25, y: 13.25 }, { x: 3.25, y: 10.25 }], [{ x: 3.25, y: 7.25 }]] };
  }
  // 图 12.4 风格：有几个反射顶点的多边形，用来看可见性单元分解
  function fig124Env() {
    const P = [[0, 0], [9, 0], [9, 2.2], [12, 2.2], [12, 6], [8, 6], [8, 10], [0, 10], [0, 4.6], [2.4, 4.6], [2.4, 3.4], [0, 3.4]].map(([x, y]) => ({ x, y }));
    return { poly: P, start: { x: 6.25, y: 4.25 }, box: [-0.6, -0.6, 12.6, 10.6], route: [] };
  }
  const NRAY = 720;
  class VisLoc {
    constructor(root) {
      this.envKey = "comb"; this.overlay = false; this.cells = false; this.showVis = true;
      const body = C.frame(root, "可见性传感器 + 指南针的定位", "距离读数在所有方向上都精确；与读数一致的位置集合 H(y) 只差平移。点地图上一个看得见的点，机器人走过去");
      this.envSeg = C.seg([["comb", "例 12.3 风格（补充）"], ["poly", "图 12.4 风格多边形"]], this.envKey, (k) => { this.envKey = k; this.build(); });
      this.plot = new C.Plot({ aspect: 0.5, maxW: 820, minW: 300, equal: true, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.click(p), cursor: () => "crosshair" });
      this.stats = { k: C.stat("|X_k(η_k)|（候选个数）"), d: C.stat("已走距离"), m: C.stat("") };
      this.info = h("div", { class: "small" });
      this.routeBtn = C.button("▶ 按书中路线走下一段", () => this.routeStep(), "primary");
      body.append(h("div", { class: "controls" }, this.envSeg, this.routeBtn, C.button("重置", () => this.reset())),
        h("div", { class: "controls" }, C.checkbox("显示可见多边形 V(x)", this.showVis, (v) => { this.showVis = v; this.plot.draw(); }),
          C.checkbox("叠图：把各个候选平移到同一处", this.overlay, (v) => { this.overlay = v; this.plot.draw(); }),
          C.checkbox("可见性单元分解（近似）", this.cells, (v) => { this.cells = v; if (v) this.computeCells(); this.plot.draw(); })),
        this.plot.wrap, h("div", { class: "stats" }, ...Object.values(this.stats)), this.info,
        C.legend([[C.cv("robot"), "真实位置", true], [C.cv("cand"), "X_k 中的其它候选（及其按同样位移走过的路线）", true], [C.cva("vis", 0.5), "可见多边形 V(x)"]]));
      this.build();
    }
    build() {
      this.env = this.envKey === "comb" ? combEnv() : fig124Env();
      const [x0, y0, x1, y1] = this.env.box;
      this.plot.setAspect((y1 - y0) / (x1 - x0));
      this.plot.setRange([x0, x1], [y0, y1]);
      this.segs = C.polySegs([this.env.poly]);
      this.sigCache = new Map();
      // 候选格点：间距 0.5，偏移 0.25（平移副本之间的位移是整数，格点对齐）
      this.lattice = [];
      for (let x = x0 + 0.25; x < x1; x += 0.5) for (let y = y0 + 0.25; y < y1; y += 0.5) {
        const p = { x: Math.round(x * 4) / 4, y: Math.round(y * 4) / 4 };
        if (C.inPoly(p, this.env.poly)) this.lattice.push(p);
      }
      this.cellData = null;
      if (this.cells) this.computeCells();
      this.reset();
    }
    key(p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }
    // 距离读数 y：NRAY 个固定方向上的距离（有指南针，所以方向是绝对的）
    sig(p) {
      const k = this.key(p);
      let s = this.sigCache.get(k);
      if (!s) {
        s = new Float64Array(NRAY);
        for (let i = 0; i < NRAY; i++) { const a = (2 * Math.PI * i) / NRAY; s[i] = C.rayHit(p, { x: Math.cos(a), y: Math.sin(a) }, this.segs).t; }
        this.sigCache.set(k, s);
      }
      return s;
    }
    same(p, q) {
      const a = this.sig(p), b = this.sig(q);
      for (let i = 0; i < NRAY; i += 45) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
      for (let i = 0; i < NRAY; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false;
      return true;
    }
    reset() {
      this.p = { ...this.env.start }; this.path = [{ ...this.p }]; this.dist = 0; this.routeI = 0;
      // X_1(η_1) = H(y_1)：所有读数相同的格点
      this.cands = this.lattice.filter((q) => this.same(q, this.p)).map((q) => ({ q0: q, q, path: [q] }));
      this.routeBtn.disabled = !this.env.route.length;
      this.update();
    }
    move(to) {
      if (!C.inPoly(to, this.env.poly) || !C.segFree(this.p, to, this.segs)) return false;
      const d = { x: to.x - this.p.x, y: to.y - this.p.y };
      this.dist += Math.hypot(d.x, d.y);
      this.p = to; this.path.push({ ...to });
      // 每个候选都按同样的位移走；撞墙的、或到达后读数不一致的，都被排除
      this.cands = this.cands.filter((c) => {
        const q2 = { x: c.q.x + d.x, y: c.q.y + d.y };
        if (!C.inPoly(q2, this.env.poly) || !C.segFree(c.q, q2, this.segs) || !this.same(q2, to)) return false;
        c.q = q2; c.path.push(q2); return true;
      });
      this.update();
      return true;
    }
    click(p) {
      const to = { x: Math.floor(p.x * 2) / 2 + 0.25, y: Math.floor(p.y * 2) / 2 + 0.25 };
      if (!this.move(to)) this.info.innerHTML = `<span class="msg bad" style="display:inline-block">只能沿直线走到看得见的点（ẋ = u）。</span> ` + this.msg();
      return null;
    }
    routeStep() {
      const leg = this.env.route[this.routeI];
      if (!leg) return;
      for (const q of leg) this.move({ ...q });
      this.routeI++;
      this.routeBtn.disabled = this.routeI >= this.env.route.length;
    }
    msg() {
      const k = this.cands.length;
      if (this.envKey === "poly") return `一般的多边形里，H(y) 往往只有一个点：一次读数就定位了。打开「可见性单元分解」：每个单元里 V(x) 由同一组边构成 [17, 74]。`;
      if (k > 1) return `读数与 ${k} 个位置都一致：把地图平移 ${k} 份叠起来（打开「叠图」），让这些候选重合；找一个只在部分副本里会越过单元边界的运动去消除歧义。`;
      return `只剩一个候选：已经定位。书中 [50] 的策略保证走过的距离不超过「验证这个状态所需的最优距离」的 k 倍（k = 初始候选数）；而一般简单多边形里求最优的定位运动是 NP-难的。`;
    }
    update() {
      this.stats.k.set(this.cands.length);
      this.stats.d.set(this.dist.toFixed(1));
      this.stats.m.key("y 的维数（射线数）"); this.stats.m.set(NRAY);
      this.info.innerHTML = this.msg();
      this.plot.draw();
    }
    computeCells() {
      // 近似的可见性单元分解：每个格点记录「看得见哪些边」，相同的集合涂同一种颜色
      const verts = this.env.poly, out = new Map();
      for (const p of this.lattice) {
        const angs = [];
        for (const v of verts) { const a = Math.atan2(v.y - p.y, v.x - p.x); angs.push(a - 1e-4, a + 1e-4); }
        angs.sort((a, b) => a - b);
        const seen = new Set();
        for (let i = 0; i < angs.length; i++) {
          for (const a of [angs[i], (angs[i] + (angs[(i + 1) % angs.length] + (i === angs.length - 1 ? 2 * Math.PI : 0))) / 2]) {
            const r = C.rayHit(p, { x: Math.cos(a), y: Math.sin(a) }, this.segs);
            if (r.i >= 0) seen.add(r.i);
          }
        }
        out.set(this.key(p), [...seen].sort((a, b) => a - b).join(","));
      }
      const ids = new Map();
      for (const v of out.values()) if (!ids.has(v)) ids.set(v, ids.size);
      this.cellData = { out, ids };
    }
    draw(ctx, pl, col) {
      if (!this.cands) return;
      const P = this.env.poly;
      pl.rect(this.env.box[0], this.env.box[1], this.env.box[2], this.env.box[3], col.obst);
      pl.poly(P, col.surface);
      if (this.cells && this.cellData) {
        const pal = [col.accent, col.warn, col.ok, col.bad, col.alive2, col.goal, col.mud, col.dead];
        for (const p of this.lattice) {
          const id = this.cellData.ids.get(this.cellData.out.get(this.key(p)));
          pl.rect(p.x - 0.25, p.y - 0.25, p.x + 0.25, p.y + 0.25, C.alpha(pal[(id * 5) % pal.length], 0.18 + 0.12 * ((id >> 3) % 3)));
        }
      }
      if (this.showVis) {
        for (const c of this.cands) if (c.q !== this.p && (c.q.x !== this.p.x || c.q.y !== this.p.y)) pl.poly(C.visPoly(c.q, this.segs, P), C.alpha(col.cand, 0.13));
        pl.poly(C.visPoly(this.p, this.segs, P), C.alpha(col.vis, 0.45), C.alpha(col.vis, 0.9), 1);
      }
      if (this.overlay) {
        // 叠图：把第 i 份地图平移 (p − q_i)，使每个候选都落在真实位置上
        for (const c of this.cands) {
          const d = { x: this.p.x - c.q.x, y: this.p.y - c.q.y };
          if (Math.abs(d.x) + Math.abs(d.y) < 1e-9) continue;
          pl.poly(P.map((v) => ({ x: v.x + d.x, y: v.y + d.y })), null, C.alpha(col.cand, 0.8), 1.5, [5, 3]);
        }
      }
      pl.poly(P, null, col.text2, 1.4);
      for (const c of this.cands) {
        if (c.q.x === this.p.x && c.q.y === this.p.y) continue;
        pl.path(c.path, C.alpha(col.cand, 0.85), 2, [5, 4]);
        pl.dot(c.q, 4.5, col.cand);
      }
      pl.path(this.path, col.robot, 2.2);
      pl.dot(this.p, 5.5, col.robot, col.surface, 1.5);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='grid-loc']").forEach((el) => (el._w = new GridLoc(el)));
    document.querySelectorAll("[data-widget='active-loc']").forEach((el) => (el._w = new ActiveLoc(el)));
    document.querySelectorAll("[data-widget='vis-loc']").forEach((el) => (el._w = new VisLoc(el)));
  });
})();
