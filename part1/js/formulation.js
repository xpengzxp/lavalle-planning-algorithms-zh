/* 2.1 形式化：网格 ↔ 状态转移图；2.2 系统性：图 2.3 的两种扩展方式 */
(function () {
  "use strict";
  const { h, s, cssVar, fitCanvas, onThemeChange } = PA;

  // ---------------------------------------------------------------
  // 组件 1：Example 2.1 的有限版本——点格子看 x、U(x)、f(x,u)
  // ---------------------------------------------------------------
  class GridGraph {
    constructor(root) {
      this.root = root;
      this.W = 8; this.H = 5;
      this.obst = new Set(["3,1", "3,2", "3,3", "5,3", "5,4", "6,1"]);
      this.xI = [0, 0]; this.goal = [7, 4];
      this.x = this.xI.slice();
      this.plan = [];
      this.mode = "move";
      this.build();
      this.render();
    }
    key(p) { return p[0] + "," + p[1]; }
    free(p) { return p[0] >= 0 && p[0] < this.W && p[1] >= 0 && p[1] < this.H && !this.obst.has(this.key(p)); }
    U(p) {
      return [[0, 1], [0, -1], [1, 0], [-1, 0]].filter((u) => this.free([p[0] + u[0], p[1] + u[1]]));
    }
    build() {
      const seg = h("div", { class: "seg" });
      [["move", "选择状态 x / 执行动作"], ["obst", "放置 / 移除障碍"]].forEach(([k, t]) => {
        const b = h("button", { type: "button", class: k === this.mode ? "on" : "" }, t);
        b.addEventListener("click", () => { this.mode = k; seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); });
        seg.append(b);
      });
      const showG = h("input", { type: "checkbox", checked: true });
      showG.addEventListener("change", () => { this.showGraph = showG.checked; this.render(); });
      this.showGraph = true;
      const reset = h("button", { class: "btn", type: "button" }, "回到 x_I");
      reset.addEventListener("click", () => { this.x = this.xI.slice(); this.plan = []; this.render(); });
      this.svgHost = h("div", { class: "svg-wrap" });
      this.info = h("div", { class: "panel-body" });
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "网格上的离散规划"), h("span", { class: "w-sub" }, "Example 2.1：状态就是格子，动作就是上下左右"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" },
          h("div", { class: "controls" }, seg, h("label", null, showG, "叠加显示状态转移图"), reset),
          h("div", { class: "split" }, this.svgHost, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "Formulation 2.1 的各个部件"), this.info))));
    }
    render() {
      const W = this.W, H = this.H, cs = 60, pad = 30;
      const svg = s("svg", { viewBox: `0 0 ${W * cs + pad * 2} ${H * cs + pad * 2}`, role: "img", "aria-label": "网格与状态转移图" });
      const px = (i) => pad + i * cs + cs / 2, py = (j) => pad + (H - 1 - j) * cs + cs / 2;
      for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
        const o = this.obst.has(i + "," + j);
        const r = s("rect", { x: pad + i * cs, y: pad + (H - 1 - j) * cs, width: cs, height: cs, fill: o ? "var(--c-wall)" : "var(--surface)", stroke: "var(--border)", style: "cursor:pointer" });
        r.addEventListener("click", () => this.click([i, j]));
        svg.append(r);
      }
      // 坐标轴标注
      for (let i = 0; i < W; i++) svg.append(s("text", { x: px(i), y: pad + H * cs + 18, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, i));
      for (let j = 0; j < H; j++) svg.append(s("text", { x: pad - 12, y: py(j) + 4, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" }, j));
      svg.append(s("text", { x: pad + W * cs + 14, y: pad + H * cs + 18, "font-size": 12, fill: "var(--muted)", "font-style": "italic" }, "i"));
      svg.append(s("text", { x: pad - 12, y: pad - 10, "font-size": 12, fill: "var(--muted)", "font-style": "italic", "text-anchor": "middle" }, "j"));
      if (this.showGraph) {
        for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
          if (!this.free([i, j])) continue;
          if (this.free([i + 1, j])) svg.append(s("line", { x1: px(i) + 8, y1: py(j), x2: px(i + 1) - 8, y2: py(j), stroke: "var(--accent)", "stroke-width": 1.5, opacity: 0.55, "pointer-events": "none" }));
          if (this.free([i, j + 1])) svg.append(s("line", { x1: px(i), y1: py(j) - 8, x2: px(i), y2: py(j + 1) + 8, stroke: "var(--accent)", "stroke-width": 1.5, opacity: 0.55, "pointer-events": "none" }));
        }
        for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) if (this.free([i, j])) svg.append(s("circle", { cx: px(i), cy: py(j), r: 4.5, fill: "var(--accent)", "pointer-events": "none" }));
      }
      // 计划轨迹
      if (this.plan.length) {
        let p = this.xI.slice();
        const pts = [[px(p[0]), py(p[1])]];
        for (const u of this.plan) { p = [p[0] + u[0], p[1] + u[1]]; pts.push([px(p[0]), py(p[1])]); }
        svg.append(s("polyline", { points: pts.map((q) => q.join(",")).join(" "), fill: "none", stroke: "var(--c-path)", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.75, "pointer-events": "none" }));
      }
      // x_I, X_G, x
      const mark = (p, color, t) => {
        svg.append(s("circle", { cx: px(p[0]), cy: py(p[1]), r: 16, fill: color, "pointer-events": "none" }));
        svg.append(s("text", { x: px(p[0]), y: py(p[1]) + 4.5, "text-anchor": "middle", "font-size": 12, fill: "#fff", "font-weight": 700, "pointer-events": "none" }, t));
      };
      mark(this.goal, "var(--c-goal)", "X_G");
      mark(this.xI, "var(--c-start)", "x_I");
      svg.append(s("circle", { cx: px(this.x[0]), cy: py(this.x[1]), r: 22, fill: "none", stroke: "var(--c-current)", "stroke-width": 3.5, "pointer-events": "none" }));
      // 可用动作箭头
      for (const u of this.U(this.x)) {
        const x2 = [this.x[0] + u[0], this.x[1] + u[1]];
        const g = s("g", { style: "cursor:pointer" });
        g.append(s("circle", { cx: (px(this.x[0]) + px(x2[0])) / 2 + u[0] * 6, cy: (py(this.x[1]) + py(x2[1])) / 2 - u[1] * 6, r: 11, fill: "var(--c-current)", opacity: 0.9 }));
        g.append(s("text", { x: (px(this.x[0]) + px(x2[0])) / 2 + u[0] * 6, y: (py(this.x[1]) + py(x2[1])) / 2 - u[1] * 6 + 4.5, "text-anchor": "middle", "font-size": 13, fill: "#fff", "font-weight": 700 }, u[0] === 1 ? "→" : u[0] === -1 ? "←" : u[1] === 1 ? "↑" : "↓"));
        g.addEventListener("click", () => this.apply(u));
        svg.append(g);
      }
      this.svgHost.innerHTML = "";
      this.svgHost.append(svg);
      this.renderInfo();
    }
    click(p) {
      if (this.mode === "obst") {
        const k = this.key(p);
        if (k === this.key(this.xI) || k === this.key(this.goal) || k === this.key(this.x)) return;
        this.obst.has(k) ? this.obst.delete(k) : this.obst.add(k);
        this.plan = []; this.x = this.xI.slice();
      } else if (this.free(p)) {
        // 点相邻格子 = 执行动作；点不相邻的格子 = 把 x_I 挪到那里，重新开始
        const u = [p[0] - this.x[0], p[1] - this.x[1]];
        if (Math.abs(u[0]) + Math.abs(u[1]) === 1) { this.apply(u); return; }
        if (this.key(p) === this.key(this.goal)) return;
        this.xI = p.slice(); this.x = p.slice(); this.plan = [];
      }
      this.render();
    }
    apply(u) {
      this.x = [this.x[0] + u[0], this.x[1] + u[1]];
      this.plan.push(u);
      this.render();
    }
    renderInfo() {
      let nX = 0, nE = 0;
      for (let i = 0; i < this.W; i++) for (let j = 0; j < this.H; j++) if (this.free([i, j])) { nX++; nE += this.U([i, j]).length; }
      const Ux = this.U(this.x);
      const fmtU = (u) => `(${u[0]},${u[1]})`;
      const atGoal = this.key(this.x) === this.key(this.goal);
      const planTxt = this.plan.length ? "(" + this.plan.map(fmtU).join(", ") + ")" : "（空）";
      this.info.innerHTML = "";
      this.info.append(h("dl", { class: "kv" },
        h("dt", null, "状态空间 X"), h("dd", { html: `所有非障碍格子，|X| = <b>${nX}</b>` }),
        h("dt", null, "当前状态 x"), h("dd", { html: `<b>(${this.x[0]}, ${this.x[1]})</b>` }),
        h("dt", null, "动作空间 U(x)"), h("dd", { class: "mono", html: Ux.length ? "{" + Ux.map(fmtU).join(", ") + "}" : "∅" }),
        h("dt", null, "转移 f(x,u)"), h("dd", { class: "mono", html: Ux.map((u) => `f(x,${fmtU(u)}) = (${this.x[0] + u[0]},${this.x[1] + u[1]})`).join("<br>") || "—" }),
        h("dt", null, "初始状态 x_I"), h("dd", null, `(${this.xI[0]}, ${this.xI[1]})`),
        h("dt", null, "目标集合 X_G"), h("dd", null, `{(${this.goal[0]}, ${this.goal[1]})}`),
        h("dt", null, "图的有向边数"), h("dd", { html: `|E| = <b>${nE}</b>（每条蓝线 = 两条方向相反的有向边）` }),
        h("dt", null, "已执行的计划"), h("dd", { class: "mono", style: "word-break:break-all" }, planTxt)));
      if (atGoal && this.plan.length) this.info.append(h("div", { class: "msg ok" }, `到达 X_G！这个长度为 ${this.plan.length} 的动作序列就是一个可行计划。`));
      else this.info.append(h("p", { class: "small muted", style: "margin:8px 0 0" }, "点红色箭头（或相邻格子）执行动作 u；点不相邻的格子会把 x_I 挪过去。切换到「放置障碍」后点格子，看看顶点和边如何从图中删除。"));
    }
  }

  // ---------------------------------------------------------------
  // 组件 2：图 2.3——无限网格上「只往一个方向冲」vs「波前扩展」
  // ---------------------------------------------------------------
  class Systematic {
    constructor(root) {
      this.root = root;
      this.n = 0; this.playing = false;
      this.R = 10;
      this.target = [-3, 4];
      this.build();
      onThemeChange(() => this.draw());
    }
    build() {
      this.c1 = h("canvas", { "aria-label": "单方向搜索" });
      this.c2 = h("canvas", { "aria-label": "波前搜索" });
      this.play = h("button", { class: "btn primary", type: "button" }, "▶ 播放");
      const reset = h("button", { class: "btn", type: "button" }, "重置");
      this.play.addEventListener("click", () => (this.playing ? this.stop() : this.start()));
      reset.addEventListener("click", () => { this.stop(); this.n = 0; this.draw(); });
      this.t1 = h("div", { class: "small", style: "min-height:3.2em" });
      this.t2 = h("div", { class: "small", style: "min-height:3.2em" });
      const col = (title, c, t) => h("div", { class: "panel" }, h("div", { class: "panel-title" }, title), h("div", { class: "panel-body", style: "display:flex;flex-direction:column;align-items:center;gap:6px" }, c, t));
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "系统性（systematic）"), h("span", { class: "w-sub" }, "图 2.3：无限网格上的两种扩展方式"), h("span", { class: "w-badge" }, "动画")),
        h("div", { class: "widget-body" },
          h("div", { class: "controls" }, this.play, reset, h("span", { class: "small muted", html: "粉色格子是某个目标状态 (−3, 4)。视野只显示原点附近，但网格是无限的。" })),
          h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px" },
            col("(a) 总往一个方向走：不系统", this.c1, this.t1), col("(b) 一圈圈波前扩展：系统", this.c2, this.t2))));
      this.draw();
    }
    start() {
      if (this.n > 160) this.n = 0;
      this.playing = true; this.play.textContent = "⏸ 暂停";
      const loop = () => { if (!this.playing) return; this.n++; this.draw(); if (this.n >= 160) { this.stop(); return; } this.timer = setTimeout(loop, 110); };
      loop();
    }
    stop() { this.playing = false; clearTimeout(this.timer); this.play.textContent = "▶ 播放"; }
    draw() {
      const R = this.R, size = 2 * R + 1, cs = 11;
      const col = { grid: cssVar("--c-grid"), alive: cssVar("--c-alive"), dead: cssVar("--c-dead"), goal: cssVar("--c-goal"), start: cssVar("--c-start"), bg: cssVar("--c-unvisited") };
      const paint = (canvas, visitedFn) => {
        const ctx = fitCanvas(canvas, size * cs, size * cs);
        ctx.fillStyle = col.bg; ctx.fillRect(0, 0, size * cs, size * cs);
        for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
          const v = visitedFn(i, j);
          if (v) { ctx.fillStyle = v === 2 ? col.alive : col.dead; ctx.fillRect((i + R) * cs, (R - j) * cs, cs, cs); }
        }
        ctx.strokeStyle = col.goal; ctx.lineWidth = 2.5;
        ctx.strokeRect((this.target[0] + R) * cs + 1, (R - this.target[1]) * cs + 1, cs - 2, cs - 2);
        ctx.strokeStyle = col.grid; ctx.lineWidth = 0.5; ctx.beginPath();
        for (let k = 0; k <= size; k++) { ctx.moveTo(k * cs, 0); ctx.lineTo(k * cs, size * cs); ctx.moveTo(0, k * cs); ctx.lineTo(size * cs, k * cs); }
        ctx.stroke();
        ctx.fillStyle = col.start; ctx.beginPath(); ctx.arc(R * cs + cs / 2, R * cs + cs / 2, cs * 0.4, 0, 7); ctx.fill();
      };
      const n = this.n;
      // (a) 每步向右走一格
      paint(this.c1, (i, j) => (j === 0 && i >= 0 && i <= n ? (i === n ? 2 : 1) : 0));
      // (b) 广度优先：曼哈顿距离 ≤ r 的都已访问；按顺序一格一格扩展
      const layerStart = (r) => (r === 0 ? 0 : 1 + 2 * r * (r - 1)); // 距离 < r 的格子数
      let r = 0; while (layerStart(r + 1) <= n) r++;
      paint(this.c2, (i, j) => { const d = Math.abs(i) + Math.abs(j); if (d < r) return 1; if (d === r) return 2; return 0; });
      const tgtD = Math.abs(this.target[0]) + Math.abs(this.target[1]);
      this.t1.innerHTML = `${n} 步后访问了 ${n + 1} 个状态，<b>没有重复</b>，可是 (0,1)、目标 (−3,4) 永远不会被访问：在极限下几乎整个平面都没覆盖。`;
      this.t2.innerHTML = `已扩展 ${n} 个状态，波前（黄色，活跃）在距离 r = ${r} 处。` + (r >= tgtD ? `<span class="yes">目标在第 ${tgtD} 圈被访问到了。</span>` : `目标在第 ${tgtD} 圈，有限步之内一定会被访问。`);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='grid-graph']").forEach((el) => new GridGraph(el));
    document.querySelectorAll("[data-widget='systematic']").forEach((el) => new Systematic(el));
  });
})();
