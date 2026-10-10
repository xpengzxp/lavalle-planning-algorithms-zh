/* 2.2 搜索实验室：在网格（Example 2.1）上逐步运行图 2.4 / 2.7 的搜索模板 */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange, fmt, INF } = PA;

  const COLS = 31, ROWS = 17, N = COLS * ROWS;
  const FREE = 0, WALL = 1, MUD = 2;
  const MUD_COST = 5;
  // 书中的动作顺序 U = {(0,1), (0,-1), (1,0), (-1,0)}；屏幕上行号向下增长，所以 dj 取反
  const U = [[0, 1, "(0,1)"], [0, -1, "(0,−1)"], [1, 0, "(1,0)"], [-1, 0, "(−1,0)"]];

  const idx = (c, r) => r * COLS + c;
  const colOf = (k) => k % COLS;
  const rowOf = (k) => Math.floor(k / COLS);
  const bi = (k) => colOf(k);
  const bj = (k) => ROWS - 1 - rowOf(k);
  const lbl = (k) => `(${bi(k)},${bj(k)})`;

  const ALGOS = {
    bfs: { name: "广度优先 BFS", family: "forward", order: "FIFO 队列：先进先出" },
    dfs: { name: "深度优先 DFS", family: "forward", order: "LIFO 栈：后进先出" },
    dijkstra: { name: "Dijkstra", family: "forward", order: "按代价到达 C(x) 从小到大" },
    astar: { name: "A*", family: "forward", order: "按 C(x) + Ĝ*(x) 从小到大" },
    best: { name: "最佳优先 Best-first", family: "forward", order: "只按 Ĝ*(x) 从小到大（贪心）" },
    bidir: { name: "双向 BFS", family: "bidir", order: "两棵树各用 FIFO，交替扩展" },
    iddfs: { name: "迭代加深 ID", family: "iddfs", order: "深度受限 DFS，上限 i = 1, 2, 3, …" },
  };
  const HEURS = {
    manhattan: { name: "曼哈顿 |Δi|+|Δj|", f: (a, b) => Math.abs(bi(a) - bi(b)) + Math.abs(bj(a) - bj(b)) },
    euclid: { name: "欧氏 √(Δi²+Δj²)", f: (a, b) => Math.hypot(bi(a) - bi(b), bj(a) - bj(b)) },
    zero: { name: "零 Ĝ* ≡ 0", f: () => 0 },
    inflated: { name: "曼哈顿 × 3（高估！）", f: (a, b) => 3 * (Math.abs(bi(a) - bi(b)) + Math.abs(bj(a) - bj(b))) },
  };
  const PRESETS = {
    open: "空旷地面（对角目标）",
    maze: "迷宫（带少量环路）",
    trap: "蛇形陷阱（图 2.5 / 习题 2）",
    mud: "泥地带（代价 ≠ 步数）",
    nosol: "无解（目标被围住）",
  };

  const PSEUDO = {
    forward: {
      title: "FORWARD SEARCH（图 2.4）",
      lines: [
        "Q.Insert(x<sub>I</sub>) and mark x<sub>I</sub> as visited",
        "<span class=kw>while</span> Q not empty <span class=kw>do</span>",
        "  x ← Q.GetFirst()",
        "  <span class=kw>if</span> x ∈ X<sub>G</sub>",
        "    <span class=kw>return</span> SUCCESS",
        "  <span class=kw>forall</span> u ∈ U(x)",
        "    x′ ← f(x, u)",
        "    <span class=kw>if</span> x′ not visited",
        "      Mark x′ as visited",
        "      Q.Insert(x′)",
        "    <span class=kw>else</span>",
        "      Resolve duplicate x′",
        "<span class=kw>return</span> FAILURE",
      ],
    },
    bidir: {
      title: "BIDIRECTIONAL SEARCH（图 2.7）",
      lines: [
        "Q<sub>I</sub>.Insert(x<sub>I</sub>) and mark x<sub>I</sub> as visited",
        "Q<sub>G</sub>.Insert(x<sub>G</sub>) and mark x<sub>G</sub> as visited",
        "<span class=kw>while</span> Q<sub>I</sub> not empty <span class=kw>and</span> Q<sub>G</sub> not empty <span class=kw>do</span>",
        "  <span class=kw>if</span> Q<sub>I</sub> not empty",
        "    x ← Q<sub>I</sub>.GetFirst()",
        "    <span class=kw>if</span> x already visited from x<sub>G</sub>",
        "      <span class=kw>return</span> SUCCESS",
        "    <span class=kw>forall</span> u ∈ U(x)",
        "      x′ ← f(x, u)",
        "      <span class=kw>if</span> x′ not visited",
        "        Mark x′ as visited",
        "        Q<sub>I</sub>.Insert(x′)",
        "      <span class=kw>else</span>",
        "        Resolve duplicate x′",
        "  <span class=kw>if</span> Q<sub>G</sub> not empty",
        "    x′ ← Q<sub>G</sub>.GetFirst()",
        "    <span class=kw>if</span> x′ already visited from x<sub>I</sub>",
        "      <span class=kw>return</span> SUCCESS",
        "    <span class=kw>forall</span> u<sup>−1</sup> ∈ U<sup>−1</sup>(x′)",
        "      x ← f<sup>−1</sup>(x′, u<sup>−1</sup>)",
        "      <span class=kw>if</span> x not visited",
        "        Mark x as visited",
        "        Q<sub>G</sub>.Insert(x)",
        "      <span class=kw>else</span>",
        "        Resolve duplicate x",
        "<span class=kw>return</span> FAILURE",
      ],
    },
    iddfs: {
      title: "ITERATIVE DEEPENING（2.2.2 节，按书中描述写成伪代码）",
      lines: [
        "<span class=kw>for</span> i ← 1, 2, 3, …",
        "  丢弃上一轮的全部结果；S.Push(x<sub>I</sub>)   <span class=cm>// S 是栈</span>",
        "  <span class=kw>while</span> S not empty <span class=kw>do</span>",
        "    x ← S.Pop()",
        "    <span class=kw>if</span> x ∈ X<sub>G</sub> <span class=kw>return</span> SUCCESS",
        "    <span class=kw>if</span> depth(x) &lt; i",
        "      <span class=kw>forall</span> u ∈ U(x)",
        "        x′ ← f(x, u)",
        "        <span class=kw>if</span> x′ 没有以更小的深度被访问过",
        "          depth(x′) ← depth(x)+1；S.Push(x′)",
        "  <span class=kw>if</span> 本轮没有被深度上限截断 <span class=kw>return</span> FAILURE",
      ],
    },
  };

  // 可复现的伪随机数
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class SearchLab {
    constructor(root) {
      this.root = root;
      this.grid = new Uint8Array(N);
      this.start = 0; this.goal = 0;
      this.algo = root.dataset.algo || "bfs";
      this.heur = "manhattan";
      this.preset = root.dataset.preset || "open";
      this.mapLabel = PRESETS[this.preset];
      this.tool = "wall";
      this.showNums = false;
      this.fine = false;
      this.playing = false;
      this.speed = 45;
      this.mazeSeed = 7;
      this.log = [];
      this.hover = -1;
      this.build();
      this.loadPreset(this.preset);
      this.resize();   // 不依赖 ResizeObserver 的第一次回调（后台标签页里它可能迟迟不触发）
      onThemeChange(() => this.draw());
    }

    // ---------------- 界面 ----------------
    build() {
      const algoSel = h("select", { "aria-label": "算法" },
        Object.entries(ALGOS).map(([k, a]) => h("option", { value: k, selected: k === this.algo }, a.name)));
      algoSel.addEventListener("change", () => { this.algo = algoSel.value; this.syncHeurVisibility(); this.resetRun(); });
      const heurSel = h("select", { "aria-label": "启发函数" },
        Object.entries(HEURS).map(([k, x]) => h("option", { value: k, selected: k === this.heur }, x.name)));
      heurSel.addEventListener("change", () => { this.heur = heurSel.value; this.resetRun(); });
      const heurLabel = h("label", null, "Ĝ*：", heurSel);
      const presetSel = h("select", { "aria-label": "地图" },
        Object.entries(PRESETS).map(([k, v]) => h("option", { value: k, selected: k === this.preset }, v)));
      presetSel.addEventListener("change", () => this.loadPreset(presetSel.value));
      this.presetSel = presetSel;

      const toolSeg = h("div", { class: "seg", role: "group", "aria-label": "画笔" });
      [["wall", "墙"], ["mud", "泥地 (l=5)"], ["erase", "橡皮"]].forEach(([k, t]) => {
        const b = h("button", { class: k === this.tool ? "on" : "", type: "button" }, t);
        b.addEventListener("click", () => { this.tool = k; toolSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); });
        toolSeg.append(b);
      });

      this.btnStep = h("button", { class: "btn", type: "button", title: "单步" }, "单步 ▸");
      this.btnPlay = h("button", { class: "btn primary", type: "button" }, "▶ 播放");
      this.btnEnd = h("button", { class: "btn", type: "button" }, "跑完 ⏭");
      this.btnReset = h("button", { class: "btn", type: "button" }, "重置搜索");
      const btnClear = h("button", { class: "btn", type: "button" }, "清空地图");
      const btnMaze = h("button", { class: "btn", type: "button" }, "新随机迷宫");
      this.btnStep.addEventListener("click", () => { this.pause(); this.step(); this.render(); });
      this.btnPlay.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
      this.btnEnd.addEventListener("click", () => { this.pause(); this.runToEnd(); });
      this.btnReset.addEventListener("click", () => { this.pause(); this.resetRun(); });
      btnClear.addEventListener("click", () => { this.grid.fill(FREE); this.mapLabel = "自定义"; this.resetRun(); });
      btnMaze.addEventListener("click", () => { this.mazeSeed = Math.floor(Math.random() * 1e9); this.presetSel.value = "maze"; this.loadPreset("maze"); });

      const speed = h("input", { type: "range", min: 0, max: 100, value: this.speed, "aria-label": "速度" });
      speed.addEventListener("input", () => { this.speed = +speed.value; });
      const fineBox = h("input", { type: "checkbox" });
      fineBox.addEventListener("change", () => { this.fine = fineBox.checked; });
      const numsBox = h("input", { type: "checkbox" });
      numsBox.addEventListener("change", () => { this.showNums = numsBox.checked; this.draw(); });

      this.canvas = h("canvas", { "aria-label": "网格搜索画布：点击或拖动来画墙，拖动 I / G 移动起点和目标" });
      this.canvasWrap = h("div", { style: "width:100%" }, this.canvas);
      this.hoverLine = h("div", { class: "status-line small" }, "提示：在格子上拖动画墙 / 泥地；拖动 I、G 圆点可移动起点和目标。");
      this.msg = h("div", { class: "msg info" }, "选择算法后点「播放」或「单步」。");

      this.statEls = {};
      const stat = (k, name) => { const v = h("span", { class: "v" }, "0"); this.statEls[k] = v; return h("div", { class: "stat" }, h("span", { class: "k" }, name), v); };
      const stats = h("div", { class: "stats" }, stat("expanded", "已扩展（出队）"), stat("visited", "已访问"), stat("q", "|Q| 活跃"), stat("steps", "计划步数"), stat("cost", "计划代价"));

      const legend = h("div", { class: "legend" },
        this.legendItem("var(--c-unvisited)", "未访问 unvisited"),
        this.legendItem("var(--c-alive)", "活跃 alive（在 Q 里）"),
        this.legendItem("var(--c-dead)", "死亡 dead（已扩展）"),
        this.legendItem("transparent", "当前 x", "var(--c-current)"),
        this.legendItem("var(--c-path)", "找到的计划"),
        this.legendItem("var(--c-wall)", "墙"),
        this.legendItem("var(--c-mud)", "泥地：进入代价 5"),
      );
      this.legend2 = h("div", { class: "legend hidden" },
        this.legendItem("var(--c-alive2)", "从 x_G 出发的活跃"),
        this.legendItem("var(--c-dead2)", "从 x_G 出发的死亡"));

      this.pseudoTitle = h("div", { class: "panel-title" });
      this.pseudo = h("div", { class: "pseudo" });
      this.note = h("div", { class: "panel-body small", style: "min-height:2.6em;border-top:1px solid var(--border)" }, "—");
      this.qTitle = h("div", { class: "panel-title" }, "优先队列 Q（队首在上）");
      this.qBody = h("div", { class: "panel-body" });
      this.orderLine = h("div", { class: "panel-body small muted", style: "border-bottom:1px solid var(--border)" });

      this.logBody = h("tbody");
      const logTable = h("div", { class: "table-wrap" }, h("table", { class: "data small" },
        h("thead", null, h("tr", null, ["算法", "地图", "扩展数", "步数", "代价", "结果"].map((t) => h("th", null, t)))), this.logBody));
      const btnClearLog = h("button", { class: "btn small", type: "button" }, "清空记录");
      btnClearLog.addEventListener("click", () => { this.log = []; this.renderLog(); });

      this.heurLabel = heurLabel;
      const body = h("div", { class: "widget-body" },
        h("div", { class: "controls" }, h("label", null, "算法：", algoSel), heurLabel, h("span", { class: "sep" }), h("label", null, "地图：", presetSel), btnMaze, btnClear),
        h("div", { class: "controls" }, h("label", null, "画笔：", toolSeg), h("span", { class: "sep" }),
          this.btnStep, this.btnPlay, this.btnEnd, this.btnReset,
          h("label", null, "速度", speed), h("label", { title: "单步时停在伪代码的每一行" }, fineBox, "逐行单步"), h("label", null, numsBox, "显示数值")),
        h("div", { class: "lab-grid" },
          h("div", null, this.canvasWrap, legend, this.legend2, this.hoverLine, this.msg, stats),
          h("div", { class: "lab-side" },
            h("div", { class: "panel" }, this.pseudoTitle, this.pseudo, this.note),
            h("div", { class: "panel" }, this.qTitle, this.orderLine, this.qBody))),
        h("details", { style: "margin-top:12px" }, h("summary", { style: "cursor:pointer;font-weight:600;font-size:14px" }, "对比记录（每次跑完自动记一行）"), logTable, btnClearLog));

      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "搜索实验室"), h("span", { class: "w-sub" }, "图 2.4 通用前向搜索 + 各种 Q 排序 · 双向搜索 · 迭代加深"), h("span", { class: "w-badge" }, "互动")),
        body);

      this.bindCanvas();
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.canvasWrap);
      this.syncHeurVisibility();
    }

    legendItem(bg, text, border) {
      return h("span", null, h("i", { style: `background:${bg};${border ? `border:2px solid ${border}` : ""}` }), text);
    }

    syncHeurVisibility() {
      const needs = this.algo === "astar" || this.algo === "best";
      this.heurLabel.classList.toggle("hidden", !needs);
      this.legend2.classList.toggle("hidden", this.algo !== "bidir");
      const fam = ALGOS[this.algo].family;
      this.pseudoTitle.textContent = PSEUDO[fam].title;
      this.pseudo.innerHTML = "";
      this.pseudoLines = PSEUDO[fam].lines.map((t) => { const e = h("span", { class: "ln", html: t }); this.pseudo.append(e); return e; });
      this.orderLine.textContent = "Q 的排序：" + ALGOS[this.algo].order;
    }

    resize() {
      const w = this.canvasWrap.clientWidth;
      if (!w) return;
      this.cell = Math.max(8, Math.min(28, Math.floor(w / COLS)));
      this.ctx = fitCanvas(this.canvas, this.cell * COLS, this.cell * ROWS);
      this.draw();
    }

    // ---------------- 地图 ----------------
    loadPreset(name) {
      this.pause();
      this.preset = name;
      this.mapLabel = PRESETS[name];
      const g = this.grid;
      g.fill(FREE);
      const wall = (c, r) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) g[idx(c, r)] = WALL; };
      if (name === "open") {
        this.start = idx(3, 13); this.goal = idx(27, 3);
      } else if (name === "maze") {
        g.fill(WALL);
        const rand = rng(this.mazeSeed);
        const stack = [[1, 1]];
        g[idx(1, 1)] = FREE;
        while (stack.length) {
          const [c, r] = stack[stack.length - 1];
          const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dc, dr]) => [c + dc, r + dr, dc, dr])
            .filter(([cc, rr]) => cc > 0 && cc < COLS - 1 && rr > 0 && rr < ROWS - 1 && g[idx(cc, rr)] === WALL);
          if (!nb.length) { stack.pop(); continue; }
          const [cc, rr, dc, dr] = nb[Math.floor(rand() * nb.length)];
          g[idx(c + dc / 2, r + dr / 2)] = FREE; g[idx(cc, rr)] = FREE;
          stack.push([cc, rr]);
        }
        // 打通一些墙，制造环路，让不同算法的差异更明显
        for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
          const k = idx(c, r);
          if (g[k] !== WALL) continue;
          const horiz = g[idx(c - 1, r)] === FREE && g[idx(c + 1, r)] === FREE;
          const vert = g[idx(c, r - 1)] === FREE && g[idx(c, r + 1)] === FREE;
          if ((horiz || vert) && rand() < 0.08) g[k] = FREE;
        }
        this.start = idx(1, ROWS - 2); this.goal = idx(COLS - 2, 1);
      } else if (name === "trap") {
        // 二维版的图 2.5：一个盒子，里面是蛇形走廊，顶上和底下各开一个口。
        // 贪心的最佳优先会一路往「离目标更近」的下方钻，走完整条蛇形；最优路线其实是绕到盒子外面。
        const c0 = 9, c1 = 21, r0 = 2, r1 = 14;
        for (let c = c0; c <= c1; c++) { wall(c, r0); wall(c, r1); }
        for (let r = r0; r <= r1; r++) { wall(c0, r); wall(c1, r); }
        g[idx(15, r0)] = FREE; g[idx(15, r1)] = FREE;
        [4, 6, 8, 10, 12].forEach((r, i) => {
          for (let c = c0 + 1; c < c1; c++) wall(c, r);
          g[idx(i % 2 === 0 ? c1 - 1 : c0 + 1, r)] = FREE;   // 交替在右端、左端留缺口
        });
        this.start = idx(15, 1); this.goal = idx(15, 16);
      } else if (name === "mud") {
        for (let c = 12; c <= 18; c++) for (let r = 0; r <= 12; r++) g[idx(c, r)] = MUD;
        this.start = idx(3, 4); this.goal = idx(27, 4);
      } else if (name === "nosol") {
        for (let c = 21; c <= 27; c++) { wall(c, 5); wall(c, 11); }
        for (let r = 5; r <= 11; r++) { wall(21, r); wall(27, r); }
        for (let r = 0; r < ROWS; r++) if (r < 3 || r > 13) wall(12, r);
        this.start = idx(4, 8); this.goal = idx(24, 8);
      }
      g[this.start] = FREE; g[this.goal] = FREE;
      this.resetRun();
    }

    // ---------------- 搜索状态 ----------------
    resetRun() {
      this.pause();
      this.R = {
        status: "idle", mark: new Uint8Array(N), markG: new Uint8Array(N),
        C: new Float64Array(N).fill(INF), depth: new Float64Array(N).fill(INF),
        parent: new Int32Array(N).fill(-1), parentG: new Int32Array(N).fill(-1),
        Q: [], QG: [], seq: 0, current: -1, current2: -1, probe: -1, path: [], cost: INF,
        expanded: 0, lines: [], note: "", iter: 0, recorded: false,
      };
      this.gen = null;
      this.render();
    }

    hval(k) { return HEURS[this.heur].f(k, this.goal); }
    costInto(k) { return this.grid[k] === MUD ? MUD_COST : 1; }

    *succ(x) {
      const c = colOf(x), r = rowOf(x);
      for (const [di, dj, name] of U) {
        const cc = c + di, rr = r - dj;
        if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) continue;
        const k = idx(cc, rr);
        if (this.grid[k] === WALL) continue;
        yield [k, this.costInto(k), name];
      }
    }

    key(e) {
      const R = this.R;
      switch (this.algo) {
        case "bfs": return e.seq;
        case "dfs": return -e.seq;
        case "dijkstra": return R.C[e.x];
        case "astar": return R.C[e.x] + this.hval(e.x);
        case "best": return this.hval(e.x);
        default: return e.seq;
      }
    }
    popFirst(Q) {
      let bi_ = 0;
      for (let i = 1; i < Q.length; i++) {
        const a = Q[i], b = Q[bi_];
        const ka = this.key(a), kb = this.key(b);
        if (ka < kb || (ka === kb && a.seq < b.seq)) bi_ = i;
      }
      return Q.splice(bi_, 1)[0].x;
    }

    *genForward() {
      const R = this.R, P = this;
      const decrease = this.algo === "dijkstra" || this.algo === "astar";
      R.C[P.start] = 0; R.mark[P.start] = 1; R.Q.push({ x: P.start, seq: R.seq++ });
      yield { lines: [1], note: `把 x<sub>I</sub> = ${lbl(P.start)} 放进 Q，标记为已访问。` };
      while (true) {
        yield { lines: [2], boundary: true, note: R.Q.length ? `Q 中还有 ${R.Q.length} 个活跃状态。` : "Q 已空。" };
        if (!R.Q.length) break;
        const x = this.popFirst(R.Q);
        R.current = x; R.probe = -1; R.expanded++;
        yield { lines: [3], note: `取出队首 x = ${lbl(x)}${this.keyNote(x)}。` };
        if (x === P.goal) {
          this.finishForward(x);
          yield { lines: [4, 5], done: true, note: `x = ${lbl(x)} ∈ X<sub>G</sub>，返回 SUCCESS。沿父指针回溯得到计划。` };
          return;
        }
        yield { lines: [4], note: `${lbl(x)} ∉ X<sub>G</sub>，逐个尝试 U(x) 里的动作。` };
        for (const [x2, cost, uName] of this.succ(x)) {
          R.probe = x2;
          yield { lines: [6, 7], note: `u = ${uName}：x′ = f(x,u) = ${lbl(x2)}，l(x,u) = ${cost}。` };
          const nc = R.C[x] + cost;
          if (R.mark[x2] === 0) {
            R.mark[x2] = 1; R.C[x2] = nc; R.parent[x2] = x; R.Q.push({ x: x2, seq: R.seq++ });
            yield { lines: [8, 9, 10], note: `${lbl(x2)} 第一次遇到 → 标记、记父指针、插入 Q${decrease ? `（C = ${fmt(nc)}）` : ""}。` };
          } else if (decrease && R.mark[x2] === 1 && nc < R.C[x2]) {
            const old = R.C[x2];
            R.C[x2] = nc; R.parent[x2] = x;
            yield { lines: [11, 12], note: `${lbl(x2)} 已在 Q 中，但新路径更便宜：C 从 ${fmt(old)} 降到 ${fmt(nc)}，Q 重新排序。` };
          } else {
            yield { lines: [11, 12], note: `${lbl(x2)} 已访问过（${R.mark[x2] === 2 ? "死亡" : "活跃"}），${decrease ? "新代价不更好，" : ""}什么也不做。` };
          }
        }
        R.mark[x] = 2; R.probe = -1;
      }
      R.status = "failure"; R.current = -1;
      yield { lines: [13], done: true, note: "Q 空了也没碰到目标：所有可达状态都已探索，返回 FAILURE。" };
    }

    keyNote(x) {
      const R = this.R;
      if (this.algo === "dijkstra") return `（C = ${fmt(R.C[x])}，最小）`;
      if (this.algo === "astar") return `（C + Ĝ* = ${fmt(R.C[x])} + ${fmt(this.hval(x))} = ${fmt(R.C[x] + this.hval(x))}，最小）`;
      if (this.algo === "best") return `（Ĝ* = ${fmt(this.hval(x))}，最小）`;
      if (this.algo === "bfs") return "（等得最久的）";
      if (this.algo === "dfs") return "（最新放进来的）";
      return "";
    }

    finishForward(x) {
      const R = this.R;
      R.status = "success";
      const path = [];
      for (let k = x; k !== -1; k = R.parent[k]) path.push(k);
      R.path = path.reverse();
      R.cost = this.pathCost(R.path);
      R.mark[x] = 2;
    }

    pathCost(path) {
      let c = 0;
      for (let i = 1; i < path.length; i++) c += this.costInto(path[i]);
      return c;
    }

    *genBidir() {
      const R = this.R, P = this;
      R.mark[P.start] = 1; R.Q.push({ x: P.start, seq: R.seq++ });
      yield { lines: [1], note: `Q<sub>I</sub> ← x<sub>I</sub> = ${lbl(P.start)}` };
      R.markG[P.goal] = 1; R.QG.push({ x: P.goal, seq: R.seq++ });
      yield { lines: [2], note: `Q<sub>G</sub> ← x<sub>G</sub> = ${lbl(P.goal)}（网格上每条边都可逆，所以 f<sup>−1</sup> 就是反方向走一步）` };
      while (true) {
        yield { lines: [3], boundary: true, note: `Q<sub>I</sub> 有 ${R.Q.length} 个，Q<sub>G</sub> 有 ${R.QG.length} 个。` };
        if (!R.Q.length || !R.QG.length) break;
        // 从 x_I 长出的树
        const x = R.Q.shift().x;
        R.current = x; R.expanded++; R.probe = -1;
        yield { lines: [4, 5], note: `前向树取出 x = ${lbl(x)}` };
        if (R.markG[x]) { this.finishBidir(x); yield { lines: [6, 7], done: true, note: `${lbl(x)} 已经被反向树访问过 → 两棵树相遇，SUCCESS！` }; return; }
        for (const [x2, , uName] of this.succ(x)) {
          R.probe = x2;
          if (!R.mark[x2]) { R.mark[x2] = 1; R.parent[x2] = x; R.Q.push({ x: x2, seq: R.seq++ }); yield { lines: [8, 9, 10, 11, 12], note: `u = ${uName}：${lbl(x2)} 加入 Q<sub>I</sub>` }; }
          else yield { lines: [13, 14], note: `${lbl(x2)} 前向树已访问` };
        }
        R.mark[x] = 2;
        // 从 x_G 长出的树
        const y = R.QG.shift().x;
        R.current2 = y; R.expanded++; R.probe = -1;
        yield { lines: [15, 16], note: `反向树取出 x′ = ${lbl(y)}` };
        if (R.mark[y]) { this.finishBidir(y); yield { lines: [17, 18], done: true, note: `${lbl(y)} 已经被前向树访问过 → 两棵树相遇，SUCCESS！` }; return; }
        for (const [x0] of this.succ(y)) {
          R.probe = x0;
          if (!R.markG[x0]) { R.markG[x0] = 1; R.parentG[x0] = y; R.QG.push({ x: x0, seq: R.seq++ }); yield { lines: [19, 20, 21, 22, 23], note: `${lbl(x0)} 加入 Q<sub>G</sub>（它走一步能到 ${lbl(y)}）` }; }
          else yield { lines: [24, 25], note: `${lbl(x0)} 反向树已访问` };
        }
        R.markG[y] = 2;
      }
      R.status = "failure"; R.current = R.current2 = -1;
      yield { lines: [26], done: true, note: "有一个队列空了，两棵树没相遇：FAILURE。" };
    }

    finishBidir(meet) {
      const R = this.R;
      R.status = "success";
      const a = [];
      for (let k = meet; k !== -1; k = R.parent[k]) a.push(k);
      a.reverse();
      for (let k = R.parentG[meet]; k !== -1; k = R.parentG[k]) a.push(k);
      R.path = a; R.cost = this.pathCost(a); R.meet = meet;
    }

    *genID() {
      const R = this.R, P = this;
      for (let lim = 1; lim <= N; lim++) {
        R.iter = lim;
        R.mark.fill(0); R.depth.fill(INF); R.parent.fill(-1);
        R.Q = [{ x: P.start, d: 0, seq: R.seq++ }];
        R.depth[P.start] = 0; R.mark[P.start] = 1; R.current = -1;
        let cutoff = false;
        yield { lines: [1, 2], boundary: true, note: `第 ${lim} 轮：深度上限 i = ${lim}。上一轮的结果全部丢弃，从 x<sub>I</sub> 重新开始。` };
        while (R.Q.length) {
          const { x, d } = R.Q.pop();
          if (d > R.depth[x]) continue;
          R.current = x; R.expanded++; R.mark[x] = 2;
          yield { lines: [3, 4], note: `弹出 x = ${lbl(x)}，depth = ${d}` };
          if (x === P.goal) { this.finishForward(x); yield { lines: [5], done: true, note: `找到目标！深度 ${d} = 最少步数（和 BFS 一样），但总共扩展了 ${R.expanded} 次。` }; return; }
          if (d < lim) {
            for (const [x2, , uName] of this.succ(x)) {
              if (d + 1 < R.depth[x2]) {
                R.depth[x2] = d + 1; R.parent[x2] = x; R.mark[x2] = 1;
                R.Q.push({ x: x2, d: d + 1, seq: R.seq++ });
                R.probe = x2;
                yield { lines: [7, 8, 9, 10], note: `u = ${uName}：压入 ${lbl(x2)}，depth = ${d + 1}` };
              }
            }
          } else {
            for (const _ of this.succ(x)) { cutoff = true; break; }
          }
          R.probe = -1;
          yield { lines: [6], boundary: true, note: d < lim ? `${lbl(x)} 展开完毕。` : `${lbl(x)} 已到深度上限 ${lim}，不再往下。` };
        }
        if (!cutoff) { R.status = "failure"; yield { lines: [11], done: true, note: "这一轮没有任何状态被深度上限截断，说明整个可达集合都看过了：FAILURE。" }; return; }
      }
    }

    ensureGen() {
      if (this.gen) return;
      const fam = ALGOS[this.algo].family;
      this.R.status = "running";
      this.gen = fam === "forward" ? this.genForward() : fam === "bidir" ? this.genBidir() : this.genID();
    }

    advance() {
      if (this.R.status === "success" || this.R.status === "failure") return null;
      this.ensureGen();
      const r = this.gen.next();
      if (r.done) return null;
      const ev = r.value;
      this.R.lines = ev.lines || [];
      this.R.note = ev.note || "";
      if (ev.done) this.onFinish();
      return ev;
    }

    step() {
      if (this.fine) { this.advance(); return; }
      let ev;
      let n = 0;
      do { ev = this.advance(); n++; } while (ev && !ev.done && !(ev.boundary && n > 1));
    }

    runToEnd() {
      let guard = 0;
      while (this.R.status !== "success" && this.R.status !== "failure" && guard++ < 5000000) this.advance();
      this.render();
    }

    play() {
      if (this.R.status === "success" || this.R.status === "failure") this.resetRun();
      this.playing = true;
      this.btnPlay.textContent = "⏸ 暂停";
      let last = performance.now(), acc = 0;
      const tick = (t) => {
        if (!this.playing) return;
        const sps = 1.5 * Math.pow(1.065, this.speed);
        acc += ((t - last) / 1000) * sps; last = t;
        let n = Math.min(Math.floor(acc), 500);
        acc -= n;
        const saveFine = this.fine; this.fine = false;
        while (n-- > 0 && this.R.status !== "success" && this.R.status !== "failure") this.step();
        this.fine = saveFine;
        this.render();
        if (this.R.status === "success" || this.R.status === "failure") { this.pause(); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }

    pause() {
      this.playing = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.btnPlay) this.btnPlay.textContent = "▶ 播放";
    }

    onFinish() {
      const R = this.R;
      if (R.recorded) return;
      R.recorded = true;
      const needsH = this.algo === "astar" || this.algo === "best";
      this.log.unshift({
        algo: ALGOS[this.algo].name + (needsH ? `（${HEURS[this.heur].name}）` : ""),
        map: this.mapLabel, expanded: R.expanded,
        steps: R.status === "success" ? R.path.length - 1 : "—",
        cost: R.status === "success" ? fmt(R.cost) : "—",
        ok: R.status === "success",
      });
      this.log = this.log.slice(0, 12);
      this.renderLog();
    }

    renderLog() {
      this.logBody.innerHTML = "";
      if (!this.log.length) { this.logBody.append(h("tr", null, h("td", { colspan: 6, class: "muted" }, "还没有记录。"))); return; }
      for (const r of this.log) {
        this.logBody.append(h("tr", null, h("td", null, r.algo), h("td", null, r.map), h("td", null, r.expanded), h("td", null, r.steps), h("td", null, r.cost),
          h("td", null, h("span", { class: r.ok ? "yes" : "no" }, r.ok ? "SUCCESS" : "FAILURE"))));
      }
    }

    // ---------------- 绘制 ----------------
    colors() {
      const v = (n) => cssVar(n, this.root);
      return {
        unvisited: v("--c-unvisited"), grid: v("--c-grid"), alive: v("--c-alive"), dead: v("--c-dead"),
        alive2: v("--c-alive2"), dead2: v("--c-dead2"), current: v("--c-current"), path: v("--c-path"),
        start: v("--c-start"), goal: v("--c-goal"), wall: v("--c-wall"), mud: v("--c-mud"), text: v("--text"), muted: v("--muted"),
      };
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const cs = this.cell, R = this.R, col = this.colors(), g = this.grid;
      ctx.clearRect(0, 0, cs * COLS, cs * ROWS);
      const statusColor = (m) => (m === 1 ? col.alive : m === 2 ? col.dead : null);
      const statusColorG = (m) => (m === 1 ? col.alive2 : m === 2 ? col.dead2 : null);
      for (let k = 0; k < N; k++) {
        const x0 = colOf(k) * cs, y0 = rowOf(k) * cs;
        if (g[k] === WALL) { ctx.fillStyle = col.wall; ctx.fillRect(x0, y0, cs, cs); continue; }
        const a = statusColor(R.mark[k]);
        const b = this.algo === "bidir" ? statusColorG(R.markG[k]) : null;
        if (a && b) {
          ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + cs, y0); ctx.lineTo(x0, y0 + cs); ctx.fill();
          ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x0 + cs, y0); ctx.lineTo(x0 + cs, y0 + cs); ctx.lineTo(x0, y0 + cs); ctx.fill();
        } else {
          ctx.fillStyle = a || b || (g[k] === MUD ? col.mud : col.unvisited);
          ctx.fillRect(x0, y0, cs, cs);
        }
        if (g[k] === MUD && (a || b)) {
          ctx.strokeStyle = col.mud; ctx.lineWidth = Math.max(1.5, cs / 9);
          ctx.beginPath(); ctx.moveTo(x0, y0 + cs * 0.5); ctx.lineTo(x0 + cs * 0.5, y0); ctx.moveTo(x0 + cs * 0.5, y0 + cs); ctx.lineTo(x0 + cs, y0 + cs * 0.5); ctx.stroke();
        }
      }
      // 网格线
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= COLS; c++) { ctx.moveTo(c * cs + 0.5, 0); ctx.lineTo(c * cs + 0.5, ROWS * cs); }
      for (let r = 0; r <= ROWS; r++) { ctx.moveTo(0, r * cs + 0.5); ctx.lineTo(COLS * cs, r * cs + 0.5); }
      ctx.stroke();

      // 数值
      if (this.showNums && cs >= 16) {
        ctx.fillStyle = col.text; ctx.font = `${Math.floor(cs * 0.36)}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let k = 0; k < N; k++) {
          if (g[k] === WALL) continue;
          let val = null;
          if (this.algo === "best") val = (R.mark[k] ? this.hval(k) : null);
          else if (this.algo === "iddfs") val = R.depth[k];
          else if (this.algo === "bidir") val = null;
          else val = R.C[k];
          if (val === null || val === INF) continue;
          ctx.fillText(Number.isInteger(val) ? String(val) : val.toFixed(1), colOf(k) * cs + cs / 2, rowOf(k) * cs + cs / 2 + 0.5);
        }
      }

      // 计划
      if (R.path.length > 1) {
        ctx.strokeStyle = col.path; ctx.lineWidth = Math.max(3, cs * 0.32); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        R.path.forEach((k, i) => { const x = colOf(k) * cs + cs / 2, y = rowOf(k) * cs + cs / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      // 当前 x 与正在检查的 x'
      const outline = (k, dash) => {
        if (k < 0) return;
        ctx.save(); ctx.strokeStyle = col.current; ctx.lineWidth = dash ? 2 : 3;
        if (dash) ctx.setLineDash([3, 3]);
        ctx.strokeRect(colOf(k) * cs + 1.5, rowOf(k) * cs + 1.5, cs - 3, cs - 3); ctx.restore();
      };
      if (R.status === "running") { outline(R.current, false); outline(R.current2, false); outline(R.probe, true); }

      // 起点 / 目标
      const dot = (k, color, letter) => {
        const x = colOf(k) * cs + cs / 2, y = rowOf(k) * cs + cs / 2, r = cs * 0.42;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.floor(cs * 0.5)}px -apple-system, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(letter, x, y + 0.5);
      };
      dot(this.start, col.start, "I");
      dot(this.goal, col.goal, "G");
      // 悬停
      if (this.hover >= 0) { ctx.strokeStyle = col.text; ctx.lineWidth = 1; ctx.strokeRect(colOf(this.hover) * cs + 0.5, rowOf(this.hover) * cs + 0.5, cs - 1, cs - 1); }
    }

    render() {
      const R = this.R;
      this.draw();
      this.pseudoLines.forEach((e, i) => e.classList.toggle("hl", R.lines.includes(i + 1)));
      this.note.innerHTML = R.note || "—";
      let visited = 0;
      for (let k = 0; k < N; k++) if (R.mark[k] || R.markG[k]) visited++;
      this.statEls.expanded.textContent = R.expanded;
      this.statEls.visited.textContent = visited;
      this.statEls.q.textContent = this.algo === "bidir" ? `${R.Q.length}+${R.QG.length}` : R.Q.length;
      this.statEls.steps.textContent = R.status === "success" ? R.path.length - 1 : "—";
      this.statEls.cost.textContent = R.status === "success" ? fmt(R.cost) : "—";
      if (R.status === "success") {
        this.msg.className = "msg ok";
        this.msg.textContent = `SUCCESS：计划 ${R.path.length - 1} 步，总代价 ${fmt(R.cost)}，共扩展 ${R.expanded} 个状态。` + this.verdict();
      } else if (R.status === "failure") {
        this.msg.className = "msg bad";
        this.msg.textContent = this.algo === "bidir"
          ? `FAILURE：有一棵树的队列先空了（这里是从 x_G 出发的那棵：目标被围住，反向能到的状态很少），两棵树不可能相遇。只扩展了 ${R.expanded} 个状态——双向搜索只要一边耗尽就能停。`
          : `FAILURE：从 x_I 出发可达的状态都看完了，到不了目标（扩展了 ${R.expanded} 个状态）。`;
      } else if (R.status === "running") {
        this.msg.className = "msg info";
        this.msg.textContent = this.algo === "iddfs" ? `运行中… 当前深度上限 i = ${R.iter}` : "运行中…";
      } else {
        this.msg.className = "msg info";
        this.msg.textContent = "准备就绪：点「播放」或「单步」。";
      }
      this.renderQ();
      if (this.hover >= 0) this.updateHover();
    }

    verdict() {
      if (this.algo === "best") return " 注意：Best-first 不保证最优。";
      if (this.algo === "astar" && this.heur === "inflated") return " 启发函数高估了真实代价，A* 不再保证最优！";
      if (this.algo === "bfs" || this.algo === "bidir" || this.algo === "iddfs") return this.preset === "mud" ? " 它保证的是「步数最少」，不是「代价最小」。" : "";
      if (this.algo === "dfs") return " DFS 找到的计划往往很绕。";
      return " 这是最优计划。";
    }

    renderQ() {
      const R = this.R;
      this.qBody.innerHTML = "";
      const list = (Q, keyFn, title) => {
        const sorted = Q.slice().sort((a, b) => keyFn(a) - keyFn(b) || a.seq - b.seq);
        const ul = h("ul", { class: "qlist" });
        if (title) this.qBody.append(h("div", { class: "small muted", style: "margin-top:4px" }, title));
        if (!sorted.length) ul.append(h("li", { class: "more" }, "（空）"));
        sorted.slice(0, 8).forEach((e) => ul.append(h("li", null, h("span", null, lbl(e.x)), h("span", { class: "muted" }, this.entryKey(e)))));
        if (sorted.length > 8) ul.append(h("li", { class: "more" }, `… 还有 ${sorted.length - 8} 个`));
        this.qBody.append(ul);
      };
      if (this.algo === "bidir") {
        this.qTitle.textContent = "两个队列（队首在上）";
        list(R.Q, (e) => e.seq, "Q_I（从 x_I 出发）");
        list(R.QG, (e) => e.seq, "Q_G（从 x_G 出发）");
      } else if (this.algo === "iddfs") {
        this.qTitle.textContent = "栈 S（栈顶在上）";
        list(R.Q, (e) => -e.seq);
      } else {
        this.qTitle.textContent = "优先队列 Q（队首在上）";
        list(R.Q, (e) => this.key(e));
      }
    }

    entryKey(e) {
      const R = this.R;
      switch (this.algo) {
        case "bfs": return `入队 #${e.seq}`;
        case "dfs": return `入栈 #${e.seq}`;
        case "dijkstra": return `C=${fmt(R.C[e.x])}`;
        case "astar": return `${fmt(R.C[e.x])}+${fmt(this.hval(e.x))}=${fmt(R.C[e.x] + this.hval(e.x))}`;
        case "best": return `Ĝ*=${fmt(this.hval(e.x))}`;
        case "iddfs": return `depth=${e.d}`;
        default: return `#${e.seq}`;
      }
    }

    // ---------------- 鼠标 / 触摸 ----------------
    cellAt(ev) {
      const rect = this.canvas.getBoundingClientRect();
      const c = Math.floor((ev.clientX - rect.left) / this.cell), r = Math.floor((ev.clientY - rect.top) / this.cell);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
      return idx(c, r);
    }

    bindCanvas() {
      let drag = null, paintVal = WALL, lastK = -1;
      const apply = (k) => {
        if (k < 0 || k === this.start || k === this.goal || k === lastK) return;
        lastK = k;
        if (this.grid[k] !== paintVal) { this.grid[k] = paintVal; this.mapChanged(); }
      };
      this.canvas.addEventListener("pointerdown", (ev) => {
        const k = this.cellAt(ev);
        if (k < 0) return;
        this.canvas.setPointerCapture(ev.pointerId);
        lastK = -1;
        if (k === this.start) drag = "start";
        else if (k === this.goal) drag = "goal";
        else {
          drag = "paint";
          if (this.tool === "erase") paintVal = FREE;
          else if (this.tool === "wall") paintVal = this.grid[k] === WALL ? FREE : WALL;
          else paintVal = this.grid[k] === MUD ? FREE : MUD;
          apply(k);
        }
      });
      this.canvas.addEventListener("pointermove", (ev) => {
        const k = this.cellAt(ev);
        if (drag === "paint") apply(k);
        else if ((drag === "start" || drag === "goal") && k >= 0 && this.grid[k] !== WALL && k !== this.start && k !== this.goal) {
          this[drag] = k; this.mapChanged();
        }
        if (k !== this.hover) { this.hover = k; this.updateHover(); this.draw(); }
      });
      const end = () => { drag = null; lastK = -1; };
      this.canvas.addEventListener("pointerup", end);
      this.canvas.addEventListener("pointercancel", end);
      this.canvas.addEventListener("pointerleave", () => { this.hover = -1; this.draw(); });
    }

    mapChanged() {
      this.mapLabel = "自定义";
      this.resetRun();
    }

    updateHover() {
      const k = this.hover, R = this.R;
      if (k < 0) return;
      if (this.grid[k] === WALL) { this.hoverLine.innerHTML = `格子 <b>${lbl(k)}</b>：墙（这个顶点和它的边已从状态转移图中删除）`; return; }
      const st = ["未访问", "活跃（在 Q 中）", "死亡（已扩展）"][R.mark[k]] || "";
      const parts = [`格子 <b>${lbl(k)}</b>`, st];
      if (this.algo === "bidir" && R.markG[k]) parts.push("反向树：" + ["", "活跃", "死亡"][R.markG[k]]);
      if (R.C[k] < INF && this.algo !== "bidir" && this.algo !== "iddfs") parts.push(`C = ${fmt(R.C[k])}`);
      if (this.algo === "iddfs" && R.depth[k] < INF) parts.push(`depth = ${R.depth[k]}`);
      if (this.algo === "astar" || this.algo === "best") parts.push(`Ĝ* = ${fmt(this.hval(k))}`);
      if (this.algo === "astar" && R.C[k] < INF) parts.push(`C+Ĝ* = ${fmt(R.C[k] + this.hval(k))}`);
      parts.push(`进入代价 l = ${this.costInto(k)}`);
      this.hoverLine.innerHTML = parts.join(" · ");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='search-lab']").forEach((el) => {
      const lab = new SearchLab(el);
      lab.renderLog();
    });
  });
})();
