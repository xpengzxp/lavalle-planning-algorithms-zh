/* 11.7 节：博弈论里的信息空间——同一棵博弈树的不同信息模型（图 11.30、11.31）、战舰（例 11.27，补充：7×7 小棋盘） */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH11;

  // ---------------------------------------------------------------
  // 组件 16：信息模型改变博弈（图 10.13 的博弈树 + 图 11.30 的四种画圈方式；例 11.26）
  // ---------------------------------------------------------------
  const FIG1013 = [4, 2, 0, 0, 1, 0, 3, 2, 2, 3, 1, 2, 4, 1, 3, 2];
  // 每层的划分用「组号数组」表示（同一层相邻顶点组号相同 = 在同一个 I-state 里）
  const sep = (n) => Array.from({ length: n }, (_, i) => i);
  const PRESETS = {
    a: { name: "(a) 交替行动", parts: [[0], sep(2), sep(4), sep(8)] },
    b: { name: "(b) 阶段式", parts: [[0], [0, 0], sep(4), [0, 0, 1, 1, 2, 2, 3, 3]] },
    c: { name: "(c) 开环", parts: [[0], [0, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]] },
    d: { name: "(d) 别的模型", parts: [[0], [0, 0], [0, 0, 0, 1], [0, 0, 0, 1, 1, 2, 3, 3]] },
  };
  const EX1126 = { leaves: [3, 3, 5, 1, -1, 7, 0, -2, 4], b: 3, parts: [[0], [0, 1, 1]] };
  class GameTree {
    constructor(root) {
      this.mode = "d";
      const body = C.frame(root, "同一棵博弈树，不同的信息模型", "图 10.13 的两阶段博弈；P₁（深色）最小化代价，P₂（白色）最大化；圈在一起的顶点 = 同一个 I-state");
      this.svg = s("svg", { viewBox: "0 0 680 300", width: "100%", style: "max-width:680px" });
      this.segM = C.seg([...Object.entries(PRESETS).map(([k, v]) => [k, v.name]), ["custom", "自定义（点顶点之间的空隙）"], ["ex", "例 11.26（图 11.31）"]], this.mode, (k) => { this.setMode(k); });
      this.res = h("div");
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "svg-wrap" }, this.svg), this.res);
      this.setMode("d");
    }
    setMode(k) {
      if (k === "custom") this.parts = (this.mode !== "ex" && this.parts ? this.parts : PRESETS.d.parts).map((p) => p.slice());
      else if (k === "ex") this.parts = EX1126.parts.map((p) => p.slice());
      else this.parts = PRESETS[k].parts.map((p) => p.slice());
      this.mode = k; this.update();
    }
    tree() { return this.mode === "ex" ? { leaves: EX1126.leaves, b: 3, depth: 2 } : { leaves: FIG1013, b: 2, depth: 4 }; }
    names(level, i) { const T = this.tree(); let str = ""; for (let l = level - 1, v = i; l >= 0; l--) { str = (T.b === 2 ? "LR" : "123")[v % T.b] + str; v = Math.floor(v / T.b); } return str || "根"; }
    toggleGap(level, i) {      // 合并 / 拆开第 level 层第 i 与 i+1 个顶点（只允许连续的组）
      if (this.mode !== "custom" && this.mode !== "ex") { this.parts = this.parts.map((p) => p.slice()); this.mode = "custom"; this.segM.set("custom"); }
      const p = this.parts[level];
      if (p[i] === p[i + 1]) { for (let j = i + 1; j < p.length; j++) p[j]++; }
      else { const old = p[i + 1]; for (let j = i + 1; j < p.length; j++) p[j] -= old - p[i]; }
      this.update();
    }
    // 某个玩家的全部确定性计划：对它的每个 I-state 选一个动作
    isets(levels) { const out = []; for (const l of levels) { const p = this.parts[l]; [...new Set(p)].forEach((g) => out.push([l, g])); } return out; }
    allPlans(levels) {
      const T = this.tree(), I = this.isets(levels), plans = [];
      const N = T.b ** I.length;
      for (let n = 0; n < N; n++) { const ch = []; let v = n; for (let i = 0; i < I.length; i++) { ch.push(v % T.b); v = Math.floor(v / T.b); } plans.push(ch); }
      return { I, plans };
    }
    play(p1, p2) {
      const T = this.tree(); let v = 0;
      for (let l = 0; l < T.depth; l++) {
        const P = l % 2 === 0 ? p1 : p2, g = this.parts[l][v], idx = P.I.findIndex(([ll, gg]) => ll === l && gg === g);
        v = v * T.b + P.choice[idx];
      }
      return T.leaves[v];
    }
    perfectRecall(levels) {       // 每个 I-state 内，所有顶点的「自己走过的 I-state 与动作」必须相同
      const T = this.tree();
      for (const l of levels) {
        const hist = new Map();
        for (let v = 0; v < T.b ** l; v++) {
          let str = "", path = [];
          for (let ll = l - 1, w = v; ll >= 0; ll--) { path.unshift([ll, Math.floor(w / T.b), w % T.b]); w = Math.floor(w / T.b); }
          for (const [ll, par, a] of path) if (levels.includes(ll)) str += `${ll}:${this.parts[ll][par]}:${a};`;
          const g = this.parts[l][v];
          if (hist.has(g) && hist.get(g) !== str) return { ok: false, where: [l, g] };
          hist.set(g, str);
        }
      }
      return { ok: true };
    }
    update() {
      const T = this.tree(), L1 = [0, 2].filter((l) => l < T.depth), L2 = [1, 3].filter((l) => l < T.depth);
      const P1 = this.allPlans(L1), P2 = this.allPlans(L2);
      const A = P1.plans.map((c1) => P2.plans.map((c2) => this.play({ I: P1.I, choice: c1 }, { I: P2.I, choice: c2 })));
      const g = C.matrixGame(A);
      this.draw();
      const descr = (P, c) => P.I.map(([l, gg], i) => { const vs = this.parts[l].map((x, j) => (x === gg ? this.names(l, j) : null)).filter(Boolean); return `${vs.length > 1 ? "{" + vs.join(",") + "}" : vs[0]}→${(T.b === 2 ? "LR" : "123")[c[i]]}`; }).join("，");
      const fmtS = (P, list) => list.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([i, p]) => `${C.fmt(p, 3, 30)} × [${descr(P, P.plans[i])}]`).join("<br>");
      const pr1 = this.perfectRecall(L1), pr2 = this.perfectRecall(L2);
      const det = g.upper === g.lower;
      this.res.innerHTML = `<div class="stats">
          <div class="stat"><span class="k">P₁ 的确定性计划</span><span class="v">${P1.plans.length}</span></div>
          <div class="stat"><span class="k">P₂ 的确定性计划</span><span class="v">${P2.plans.length}</span></div>
          <div class="stat"><span class="k">上值（P₁ 的安全值）</span><span class="v">${C.fmt(g.upper)}</span></div>
          <div class="stat"><span class="k">下值</span><span class="v">${C.fmt(g.lower)}</span></div>
          <div class="stat"><span class="k">随机化值</span><span class="v">${C.fmt(g.value, 3, 60)}</span></div></div>
        <div class="msg ${det ? "ok" : "info"}">${det ? "有<b>确定性鞍点</b>：上值 = 下值。" : "没有确定性鞍点：上值 &gt; 下值，要用随机化计划（这里求的是<b>全局随机化</b>的值：在确定性计划上取概率分布，再解矩阵博弈）。"}
          完美回忆：P₁ ${pr1.ok ? "<span class='yes'>是</span>" : "<span class='no'>否</span>"}，P₂ ${pr2.ok ? "<span class='yes'>是</span>" : "<span class='no'>否</span>"}${pr1.ok && pr2.ok ? "" : "——有玩家会「忘事」，按 Kuhn 定理，局部随机化计划不一定能达到这个值。"}</div>
        <div class="small"><b>P₁ 的${det ? "安全计划" : "随机化安全策略"}</b>：<br>${fmtS(P1, g.w.map((x) => x.slice()))}</div>
        <div class="small" style="margin-top:4px"><b>P₂ 的${det ? "安全计划" : "随机化安全策略"}</b>：<br>${fmtS(P2, g.z.map((x) => x.slice()))}</div>
        <div class="small muted" style="margin-top:4px">矩阵去掉重复的行 / 列后是 ${g.rows} × ${g.cols}。</div>`;
    }
    draw() {
      const svg = this.svg; svg.innerHTML = "";
      const T = this.tree(), W = 680, top = 26, dy = T.depth === 4 ? 60 : 95;
      const xs = (l, i) => { const n = T.b ** l; return 70 + ((i + 0.5) * (W - 90)) / n; };
      const yl = (l) => top + l * dy;
      for (let l = 0; l < T.depth; l++) {
        svg.append(s("text", { x: 8, y: yl(l) + 4, "font-size": 12, fill: "var(--muted)" }, l % 2 === 0 ? "P₁" : "P₂"));
        for (let i = 0; i < T.b ** l; i++) for (let a = 0; a < T.b; a++) svg.append(s("line", { x1: xs(l, i), y1: yl(l), x2: xs(l + 1, i * T.b + a), y2: yl(l + 1), stroke: "var(--border-strong)", "stroke-width": 1 }));
      }
      // I-state 的圈
      for (let l = 0; l < T.depth; l++) {
        const p = this.parts[l];
        for (const g of new Set(p)) {
          const idx = p.map((x, i) => (x === g ? i : -1)).filter((i) => i >= 0);
          const x0 = xs(l, idx[0]) - 11, x1 = xs(l, idx[idx.length - 1]) + 11;
          svg.append(s("rect", { x: x0, y: yl(l) - 11, width: x1 - x0, height: 22, rx: 9, fill: "color-mix(in srgb, var(--accent) 8%, transparent)", stroke: "var(--accent)", "stroke-width": 1.6 }));
        }
        // 可点击的空隙
        for (let i = 0; i + 1 < T.b ** l; i++) {
          const gx = (xs(l, i) + xs(l, i + 1)) / 2;
          const hit = s("rect", { x: gx - 9, y: yl(l) - 12, width: 18, height: 24, fill: "transparent", style: "cursor:pointer" });
          hit.addEventListener("click", () => this.toggleGap(l, i));
          svg.append(hit);
        }
        for (let i = 0; i < T.b ** l; i++) svg.append(s("circle", { cx: xs(l, i), cy: yl(l), r: 5.5, fill: l % 2 === 0 ? "var(--c-start)" : "var(--surface)", stroke: "var(--text-2)", "stroke-width": 1, style: "pointer-events:none" }));
      }
      const n = T.b ** T.depth;
      for (let i = 0; i < n; i++) {
        svg.append(s("circle", { cx: xs(T.depth, i), cy: yl(T.depth), r: 4, fill: "var(--bad)" }));
        svg.append(s("text", { x: xs(T.depth, i), y: yl(T.depth) + 19, "text-anchor": "middle", "font-size": 13, fill: "var(--text)" }, String(T.leaves[i]).replace("-", "−")));
      }
      svg.append(s("text", { x: 8, y: yl(T.depth) + 19, "font-size": 12, fill: "var(--muted)" }, "代价"));
    }
  }

  // ---------------------------------------------------------------
  // 组件 17：战舰——用不确定 I-state 来猜（例 11.27、习题 17、21；补充：7×7 棋盘，舰长 4、3、2）
  // ---------------------------------------------------------------
  const N = 7, SHIPS = [4, 3, 2];
  function placements(L) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c + L <= N; c++) out.push(Array.from({ length: L }, (_, i) => r * N + c + i));
    for (let c = 0; c < N; c++) for (let r = 0; r + L <= N; r++) out.push(Array.from({ length: L }, (_, i) => (r + i) * N + c));
    return out;
  }
  let STATES = null;      // { lo, hi, n, cells }
  function buildStates() {
    if (STATES) return STATES;
    const P = SHIPS.map(placements);
    const mask = (cells) => { let lo = 0, hi = 0; for (const c of cells) { if (c < 32) lo |= 1 << c; else hi |= 1 << (c - 32); } return [lo >>> 0, hi >>> 0]; };
    const M = P.map((list) => list.map(mask));
    const lo = [], hi = [];
    for (const a of M[0]) for (const b of M[1]) {
      if ((a[0] & b[0]) || (a[1] & b[1])) continue;
      const l2 = (a[0] | b[0]) >>> 0, h2 = (a[1] | b[1]) >>> 0;
      for (const c of M[2]) { if ((l2 & c[0]) || (h2 & c[1])) continue; lo.push((l2 | c[0]) >>> 0); hi.push((h2 | c[1]) >>> 0); }
    }
    STATES = { lo: Uint32Array.from(lo), hi: Uint32Array.from(hi), n: lo.length };
    return STATES;
  }
  const hasBit = (S, k, c) => (c < 32 ? (S.lo[k] >>> c) & 1 : (S.hi[k] >>> (c - 32)) & 1);
  class Battleship {
    constructor(root) {
      this.rnd = C.rng(C.newSeed()); this.reveal = false;
      const body = C.frame(root, "战舰：用不确定 I-state 来猜", "补充的小棋盘：7×7，三艘船长 4、3、2；只告诉你「中」或「不中」");
      this.svg = s("svg", { viewBox: "0 0 330 330", width: "100%", style: "max-width:330px" });
      this.stats = { n: C.stat("|I-state|：与观测相容的布局"), s: C.stat("已开火"), hit: C.stat("命中") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, C.button("新的一局", () => this.reset(), "small"), C.button("替我选：I-state 里最常有船的格子", () => this.auto(), "small primary"),
        C.button("自动打完", () => this.autoAll(), "small"), C.checkbox("显示答案", false, (v) => { this.reveal = v; this.draw(); })),
        h("div", { class: "split" }, h("div", { class: "svg-wrap" }, this.svg), h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cva("ndet", 0.7), "颜色越深 = 越多相容布局在这一格有船"], [C.cv("bad"), "命中"], [C.cv("muted"), "不中", true], [C.cva("bad", 0.25), "必中（所有相容布局都有船）"]])))) ;
      this.reset();
    }
    reset() {
      const S = buildStates();
      const k = Math.floor(this.rnd() * S.n);
      this.truth = new Set(); for (let c = 0; c < N * N; c++) if (hasBit(S, k, c)) this.truth.add(c);
      this.alive = Int32Array.from({ length: S.n }, (_, i) => i);
      this.shots = new Map(); this.count();
    }
    fire(c) {
      if (this.shots.has(c)) return;
      const hit = this.truth.has(c), S = STATES;
      this.shots.set(c, hit);
      this.alive = this.alive.filter((k) => hasBit(S, k, c) === (hit ? 1 : 0));
      this.count();
    }
    count() {
      const S = STATES, cnt = new Float64Array(N * N);
      for (const k of this.alive) { let lo = S.lo[k], hi = S.hi[k]; while (lo) { const b = 31 - Math.clz32(lo & -lo); cnt[b]++; lo &= lo - 1; } while (hi) { const b = 31 - Math.clz32(hi & -hi); cnt[b + 32]++; hi &= hi - 1; } }
      this.cnt = cnt; this.draw(); this.text();
    }
    best() { let b = -1, bv = -1; for (let c = 0; c < N * N; c++) if (!this.shots.has(c) && this.cnt[c] > bv) { bv = this.cnt[c]; b = c; } return b; }
    auto() { const b = this.best(); if (b >= 0 && this.hits() < 9) this.fire(b); }
    autoAll() { let g = 0; while (this.hits() < 9 && g++ < 49) this.auto(); }
    hits() { let n = 0; this.shots.forEach((v) => (n += v ? 1 : 0)); return n; }
    text() {
      const n = this.alive.length, hits = this.hits();
      this.stats.n.set(n.toLocaleString()); this.stats.s.set(this.shots.size); this.stats.hit.set(`${hits} / 9`);
      let msg = n === 1 && hits < 9 ? `<b style="color:var(--ok)">I-state 只剩一个布局：已经知道所有船在哪了</b>，虽然还有 ${9 - hits} 格没打中（习题 17）。` : "";
      if (hits === 9) msg = `全部击沉，用了 ${this.shots.size} 发。`;
      if (!msg) msg = "点格子开火，或者让 I-state 帮你选。每次「中 / 不中」都把相容布局的集合缩小——这就是 (11.31) 的交集。";
      this.msg.innerHTML = msg + `<br><span class="small muted">开局时的 I-state 有 ${STATES.n.toLocaleString()} 个布局（参考代码第 17 项核对过）。</span>`;
    }
    draw() {
      const svg = this.svg; svg.innerHTML = ""; const sz = 44, o = 11, n = this.alive.length;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const k = r * N + c, x = o + c * sz, y = o + r * sz, shot = this.shots.has(k), f = n ? this.cnt[k] / n : 0;
        let fill = "var(--surface)";
        if (!shot) fill = f === 1 ? "color-mix(in srgb, var(--bad) 25%, var(--surface))" : `color-mix(in srgb, var(--accent) ${Math.round(70 * f)}%, var(--surface))`;
        const g = s("g", { style: shot ? "" : "cursor:crosshair" });
        g.append(s("rect", { x, y, width: sz - 2, height: sz - 2, rx: 4, fill, stroke: this.reveal && this.truth.has(k) ? "var(--text)" : "var(--border-strong)", "stroke-width": this.reveal && this.truth.has(k) ? 2.2 : 1 }));
        if (shot) {
          if (this.shots.get(k)) { g.append(s("line", { x1: x + 10, y1: y + 10, x2: x + sz - 12, y2: y + sz - 12, stroke: "var(--bad)", "stroke-width": 3 })); g.append(s("line", { x1: x + sz - 12, y1: y + 10, x2: x + 10, y2: y + sz - 12, stroke: "var(--bad)", "stroke-width": 3 })); }
          else g.append(s("circle", { cx: x + sz / 2 - 1, cy: y + sz / 2 - 1, r: 4, fill: "var(--muted)" }));
        } else if (f > 0) g.append(s("text", { x: x + sz / 2 - 1, y: y + sz / 2 + 3, "text-anchor": "middle", "font-size": 10.5, fill: f > 0.55 ? "#fff" : "var(--text-2)" }, f === 1 ? "必中" : Math.round(100 * f) + "%"));
        if (!shot) g.addEventListener("click", () => this.fire(k));
        svg.append(g);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='game-tree']").forEach((el) => (el._w = new GameTree(el)));
    document.querySelectorAll("[data-widget='battleship']").forEach((el) => (el._w = new Battleship(el)));
  });
})();
