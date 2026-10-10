/* 11.5.2 节与 11.5.4 节：简单投影的例子——正弦曲线上的点（例 11.20）、四条边的图（例 11.21）、
   没有传感器的托盘倾斜（例 11.24，补充：栅格化的托盘） */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH11;
  const PI = Math.PI;

  // ---------------------------------------------------------------
  // 组件 10：正弦曲线上的点，只看得到高度（例 11.20，图 11.17–11.19）
  // ---------------------------------------------------------------
  const XL = 3.5 * PI;
  const segOf = (x1) => Math.floor((x1 + PI / 2) / PI);           // 单调段编号 j：x1 ∈ [jπ − π/2, jπ + π/2]
  const posIn = (j, y) => j * PI + (j % 2 === 0 ? 1 : -1) * Math.asin(Math.max(-1, Math.min(1, y)));
  class SineCurve {
    constructor(root) {
      this.nat = "rand"; this.init = "known"; this.showTruth = true; this.rnd = C.rng(C.newSeed());
      const body = C.frame(root, "正弦曲线上的点：只看得到高度", "例 11.20：X = {(x₁, x₂) | x₂ = sin x₁}，y = x₂，自然决定沿曲线向左还是向右");
      this.st = new C.Stage({ view: [-XL - 1.6, XL + 0.3, -1.55, 1.75], aspect: 0.36, maxW: 760, equal: false, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.segN = C.seg([["rand", "自然随机掉头"], ["right", "一直向右"], ["manual", "我来当自然"]], this.nat, (k) => { this.nat = k; this.manualBox.style.display = k === "manual" ? "" : "none"; });
      this.segI = C.seg([["known", "X₀ = {x₀}（初始状态已知）"], ["all", "X₀ = X（完全不知道）"]], this.init, (k) => { this.init = k; this.reset(); });
      this.btnRun = C.button("运行", () => this.run.toggle(), "small primary");
      this.manualBox = h("span", { class: "controls", style: "margin:0;display:none" }, C.button("◀ 向 −x₁", () => (this.dir = -1), "small"), C.button("向 +x₁ ▶", () => (this.dir = 1), "small"));
      this.run = new C.Runner((dt) => { this.step(dt); this.st.draw(); return true; }, () => (this.btnRun.textContent = "运行"));
      C.pauseWhenHidden(root, this.run);
      this.status = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segI, this.segN, this.manualBox),
        h("div", { class: "controls" }, this.btnRun, C.button("重置", () => this.reset(), "small"), C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        this.st.wrap, this.status,
        C.legend([[C.cv("ndet"), "不确定 I-state：曲线上所有可能的点", true], [C.cv("obs"), "传感器读数 y = x₂（左边的竖轴）"], [C.cv("truth"), "真实状态", true]]));
      this.reset();
    }
    reset() {
      this.x1 = 0.3; this.dir = 1; this.events = [];
      this.S = this.init === "known" ? new Set([segOf(this.x1)]) : null;     // null 表示「所有段」
      this.update(); this.st.draw();
    }
    step(dt) {
      if (this.nat === "rand" && this.rnd() < dt * 0.35) this.dir *= -1;
      if (this.nat === "right") this.dir = 1;
      const old = this.x1; let nx = old + this.dir * dt * 1.3;
      if (nx > XL - 0.05 || nx < -XL + 0.05) { this.dir *= -1; nx = Math.max(-XL + 0.05, Math.min(XL - 0.05, nx)); if (this.nat === "right") { this.reset(); return; } }
      // 经过极值点 π/2 + mπ 吗？
      const m0 = Math.floor((old - PI / 2) / PI), m1 = Math.floor((nx - PI / 2) / PI);
      if (m0 !== m1) {
        const m = Math.max(m0, m1), e = m % 2 === 0 ? 1 : -1;            // sin(π/2 + mπ) = (−1)^m
        if (this.S) {
          const T = new Set(this.S);
          for (const j of this.S) { const even = j % 2 === 0; T.add(e === 1 ? (even ? j + 1 : j - 1) : (even ? j - 1 : j + 1)); }
          this.S = T;
        }
        this.events.push(e);
      }
      this.x1 = nx; this.update();
    }
    update() {
      const y = Math.sin(this.x1), n = this.S ? this.S.size : Infinity;
      this.status.innerHTML = `y = ${y.toFixed(3)}，已经碰到 ${this.events.length} 次极值（y = ±1）：${this.events.slice(-8).map((e) => (e > 0 ? "+1" : "−1")).join(" ")}${this.events.length > 8 ? " …" : ""}　→　候选状态 <b>${n === Infinity ? "可数无穷多个" : n + " 个"}</b>`
        + (this.S && this.events.length === 0 ? "　<span class='muted'>y 还没碰到 ±1，所在的单调段是确定的：状态完全已知。</span>" : "")
        + (this.S && this.events.length ? "　<span class='muted'>不确定性只增不减：每碰一次极值多出 2 个候选（相邻的分支在峰顶会合）。</span>" : "");
    }
    draw(st, col) {
      const y = Math.sin(this.x1);
      st.path(Array.from({ length: 701 }, (_, i) => { const x = -XL + (2 * XL * i) / 700; return { x, y: Math.sin(x) }; }), col.text2, 1.5);
      // 左边的 Y 轴
      const ax = -XL - 1.1;
      st.line({ x: ax, y: -1.2 }, { x: ax, y: 1.2 }, col.text, 2);
      st.text("Y", { x: ax, y: -1.42 }, col.muted, { size: 12 }); st.text("X", { x: 0, y: -1.42 }, col.muted, { size: 12 });
      [-1, 0, 1].forEach((v) => { st.line({ x: ax - 0.12, y: v }, { x: ax + 0.12, y: v }, col.text, 1); st.text(String(v).replace("-", "−"), { x: ax, y: v }, col.muted, { size: 10, align: "right", dx: -10 }); });
      st.line({ x: ax, y }, { x: XL, y }, C.alpha(col.obs, 0.6), 1.2, [6, 5]);
      st.arrow({ x: ax + 0.6, y }, { x: ax + 0.05, y }, col.obs, 2.2, 9);
      // 候选点
      const segs = this.S ? [...this.S] : Array.from({ length: 9 }, (_, i) => i - 4);
      for (const j of segs) { const x = posIn(j, y); if (x >= -XL && x <= XL) st.dot({ x, y }, 5.5, C.alpha(col.ndet, 0.35), col.ndet, 2); }
      if (this.showTruth) { st.truth({ x: this.x1, y }, col); st.arrow({ x: this.x1, y: y + 0.28 }, { x: this.x1 + this.dir * 0.7, y: y + 0.28 }, col.nature, 1.6, 7); }
      st.text("…", { x: -XL - 0.2, y: 0 }, col.muted, { size: 14 }); st.text("…", { x: XL + 0.15, y: 0 }, col.muted, { size: 14 });
    }
  }

  // ---------------------------------------------------------------
  // 组件 11：图上的点（例 11.21，图 11.20b、11.21）
  // ---------------------------------------------------------------
  const GE = { T: [[0, 0.62], [1, 0.92]], M: [[0, 0.62], [1, 0.4]], B: [[0, 0.06], [1, 0.4]], R: [[1, 0.4], [1.8, 0.4]] };
  const gpt = (e, sv) => { const [[x0, y0], [x1, y1]] = GE[e]; const t = (sv - x0) / (x1 - x0); return { x: sv, y: y0 + t * (y1 - y0) }; };
  const PIECES = ["TMB", "TM", "TB", "MB", "T", "M", "B", "R"];      // 图 11.21：上排 4 个、下排 4 个（顺序与书中一致）
  class GraphPoint {
    constructor(root) {
      this.init = "R"; this.showTruth = true; this.rnd = C.rng(C.newSeed());
      const body = C.frame(root, "图上的点：只看得到横坐标", "例 11.21：四条边的图；在顶点处自然随便选一条边");
      this.st = new C.Stage({ view: [-0.15, 1.95, -0.42, 1.05], aspect: 0.5, maxW: 520, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.icons = s("svg", { viewBox: "0 0 400 150", width: "100%", style: "max-width:400px" });
      this.segI = C.seg([["R", "已知在最右边"], ["T", "已知在 T"], ["M", "已知在 M"], ["B", "已知在 B"], ["TMB", "左边三条都可能"]], this.init, (k) => { this.init = k; this.reset(); });
      this.btnRun = C.button("运行", () => this.run.toggle(), "small primary");
      this.run = new C.Runner((dt) => { this.step(dt); this.st.draw(); return true; }, () => (this.btnRun.textContent = "运行"));
      C.pauseWhenHidden(root, this.run);
      this.crumbs = h("div", { class: "small mono", style: "word-break:break-all" });
      body.append(h("div", { class: "controls" }, h("label", null, "初始条件"), this.segI),
        h("div", { class: "controls" }, this.btnRun, C.button("掉头", () => (this.v *= -1), "small"), C.button("重置", () => this.reset(), "small"), C.checkbox("显示真实状态", true, (v) => { this.showTruth = v; this.st.draw(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "small muted" }, "I_ndet 的 8 块（图 11.21）；数字 = 来过几次"), h("div", { class: "svg-wrap" }, this.icons))),
        this.crumbs);
      this.reset();
    }
    reset() {
      const e = this.init === "TMB" ? ["T", "M", "B"][Math.floor(this.rnd() * 3)] : this.init;
      this.e = e; this.sv = e === "R" ? 1.45 : 0.5; this.v = e === "R" ? -1 : 1;
      this.S = this.init === "TMB" ? "TMB" : e;
      this.visits = Object.fromEntries(PIECES.map((p) => [p, 0])); this.visits[this.S]++;
      this.hist = [this.S]; this.draw2(); this.st.draw();
    }
    setS(S) { S = [..."TMBR"].filter((c) => S.includes(c)).join(""); if (S !== this.S) { this.S = S; this.visits[S]++; this.hist.push(S); } }
    choose(opts) { return opts[Math.floor(this.rnd() * opts.length)]; }
    step(dt) {
      if (this.rnd() < dt * 0.25) this.v *= -1;
      let ns = this.sv + this.v * dt * 0.45;
      const e = this.e, S = this.S, has = (c) => S.includes(c);
      if (e !== "R" && ns <= 0) {                                   // 到了左端
        ns = 0; this.v = 1;
        if (e !== "B") this.e = this.choose(["T", "M"]);
        this.setS((has("T") || has("M") ? "TM" : "") + (has("B") ? "B" : ""));
      } else if (e !== "R" && ns >= 1) {                            // 到了右端
        ns = 1;
        if (e === "T") { this.v = -1; this.setS((has("T") ? "T" : "") + (has("M") || has("B") ? "MB" : "")); }
        else {
          const c = this.choose(["M", "B", "R"]);
          if (c === "R") { this.e = "R"; this.v = 1; this.setS("R"); }
          else { this.e = c; this.v = -1; this.setS((has("T") ? "T" : "") + "MB"); }
        }
      } else if (e === "R" && ns <= 1) {                            // 从右边回到交汇顶点
        ns = 1;
        const c = this.choose(["M", "B", "R"]);
        if (c === "R") this.v = 1; else { this.e = c; this.v = -1; this.setS("MB"); }
      } else if (e === "R" && ns >= 1.8) { ns = 1.8; this.v = -1; }
      this.sv = ns; this.draw2();
    }
    draw2() {
      const svg = this.icons; svg.innerHTML = "";
      PIECES.forEach((p, n) => {
        const ox = 8 + (n % 4) * 98, oy = n < 4 ? 8 : 80, cur = p === this.S;
        svg.append(s("rect", { x: ox, y: oy, width: 90, height: 62, rx: 8, fill: cur ? "var(--accent-soft)" : "var(--surface)", stroke: cur ? "var(--accent)" : "var(--border)", "stroke-width": cur ? 2 : 1 }));
        const X = (x) => ox + 10 + x * 70, Y = (y) => oy + 56 - y * 50;
        for (const e of p === "R" ? ["R"] : ["T", "M", "B"]) {
          const [[x0, y0], [x1, y1]] = e === "R" ? [[0, 0.5], [1, 0.5]] : GE[e];
          svg.append(s("line", { x1: X(x0), y1: Y(y0), x2: X(x1), y2: Y(y1), stroke: "var(--text-2)", "stroke-width": 1.2 }));
          if (p.includes(e)) { const q = e === "R" ? { x: 0.5, y: 0.5 } : gpt(e, 0.55); svg.append(s("circle", { cx: X(q.x), cy: Y(q.y), r: 4, fill: "var(--surface)", stroke: "var(--accent)", "stroke-width": 1.8 })); }
        }
        if (this.visits[p]) svg.append(s("text", { x: ox + 84, y: oy + 14, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" }, String(this.visits[p])));
      });
      const nm = (p) => "{" + p.split("").join(",") + "}";
      this.crumbs.innerHTML = "走过的 I-state：" + this.hist.slice(-14).map(nm).join(" → ") + (this.hist.length > 14 ? " …" : "")
        + "<br><span class='muted'>从 {R} 出发永远回不到 {T}、{M}、{B}、{T,M}、{T,B}——I_ndet 里有方向性约束；{T} 一直向右只会撞上死胡同，到不了 {R}。</span>";
    }
    draw(st, col) {
      st.line({ x: -0.1, y: -0.3 }, { x: 1.9, y: -0.3 }, col.text, 2.5);
      st.text("Y", { x: -0.1, y: -0.3 }, col.muted, { size: 12, dx: -10 });
      for (const [e, [[x0, y0], [x1, y1]]] of Object.entries(GE)) {
        st.line({ x: x0, y: y0 }, { x: x1, y: y1 }, col.text2, 2);
        const lp = { T: { x: 0.5, y: 0.77 }, M: { x: 0.45, y: 0.52 }, B: { x: 0.55, y: 0.25 }, R: { x: 1.7, y: 0.4 } }[e];
        st.text(e, lp, col.muted, { size: 12, dy: e === "B" ? 12 : -11 });
      }
      [[0, 0.62], [1, 0.4]].forEach(([x, y]) => st.dot({ x, y }, 3.5, col.text2));
      const sv = this.sv;
      st.line({ x: sv, y: 1.0 }, { x: sv, y: -0.27 }, C.alpha(col.obs, 0.75), 1.4, [6, 4]);
      st.arrow({ x: sv, y: -0.12 }, { x: sv, y: -0.29 }, col.obs, 2, 8);
      st.dot({ x: sv, y: -0.3 }, 4, col.obs);
      for (const e of this.S) { const q = gpt(e, Math.min(Math.max(sv, GE[e][0][0]), GE[e][1][0])); st.dot(q, 7, C.alpha(col.ndet, 0.3), col.ndet, 2.2); }
      if (this.showTruth) st.truth(gpt(this.e, sv), col);
    }
  }

  // ---------------------------------------------------------------
  // 组件 13：托盘倾斜（例 11.24，补充：栅格化的托盘）——在 I_ndet 里做广度优先搜索
  // ---------------------------------------------------------------
  const TRAY = [
    "##############",
    "#......#.....#",
    "#.####.#.###.#",
    "#.#....#...#.#",
    "#.#.######.#.#",
    "#.#......#.#.#",
    "#.######.#...#",
    "#......#.###.#",
    "#.####.#.....#",
    "#......#######",
    "##############",
  ];
  const TW = TRAY[0].length, TH = TRAY.length;
  const TILTS = [[[-1, -1], "↖", "左上"], [[0, -1], "↑", "上"], [[1, -1], "↗", "右上"], [[-1, 0], "←", "左"], null, [[1, 0], "→", "右"], [[-1, 1], "↙", "左下"], [[0, 1], "↓", "下"], [[1, 1], "↘", "右下"]];
  const FREE = new Set(); for (let r = 0; r < TH; r++) for (let c = 0; c < TW; c++) if (TRAY[r][c] !== "#") FREE.add(c + "," + r);
  const isFree = (c, r) => FREE.has(c + "," + r);
  function roll(c, r, [dx, dy]) {          // 返回滚过的格子序列
    const P = [[c, r]];
    for (;;) {
      if (dx && dy && isFree(c + dx, r + dy) && isFree(c + dx, r) && isFree(c, r + dy)) { c += dx; r += dy; }
      else if (dx && isFree(c + dx, r)) c += dx;
      else if (dy && isFree(c, r + dy)) r += dy;
      else return P;
      P.push([c, r]);
    }
  }
  class Tray {
    constructor(root) {
      this.goal = "8,3"; this.anim = null; this.rnd = C.rng(C.newSeed()); this.showTruth = false;
      const body = C.frame(root, "托盘倾斜：没有传感器，只靠动作把球送到目标", "例 11.24 的离散版本（补充）：倾斜后球一直滚，斜着撞墙就沿墙滑，直到停下");
      this.st = new C.Stage({ view: [0, TW, 0, TH], aspect: TH / TW, maxW: 520, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { const c = Math.floor(p.x), r = TH - 1 - Math.floor(p.y); if (isFree(c, r)) { this.goal = c + "," + r; this.plan(); } return null; },
        cursor: (p) => (isFree(Math.floor(p.x), TH - 1 - Math.floor(p.y)) ? "pointer" : null) });
      const pad = h("div", { style: "display:grid;grid-template-columns:repeat(3,42px);gap:4px" });
      TILTS.forEach((t) => pad.append(t ? C.button(t[1], () => this.tilt(t[0]), "small primary") : C.button("⟲", () => this.reset(), "small")));
      this.planBox = h("div", { class: "small" });
      this.stats = { n: C.stat("|X(η_k)|：球可能在的格子"), k: C.stat("已倾斜次数") };
      body.append(h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "small muted", style: "margin-bottom:6px" }, "倾斜方向（⟲ = 重置为 X₁ = X）"), pad,
        h("div", { class: "stats" }, Object.values(this.stats)), this.planBox,
        h("div", { class: "controls", style: "margin-top:8px" }, C.button("按最短计划执行", () => this.runPlan(), "small"), C.checkbox("显示「真实」的球", false, (v) => { this.showTruth = v; this.st.draw(); })),
        C.legend([[C.cva("ndet", 0.6), "可能的球位置", true], [C.cva("goal", 0.5), "目标格（点格子可以换）"], [C.cv("truth"), "某个真实位置", true]]))));
      this.reset();
    }
    reset() {
      if (this.anim) cancelAnimationFrame(this.anim.raf);
      this.anim = null;
      this.S = new Set(FREE); this.k = 0;
      const arr = [...FREE]; this.truth = arr[Math.floor(this.rnd() * arr.length)];
      this.plan(); this.st.draw();
    }
    step(S, d) { const o = new Set(); for (const k of S) { const [c, r] = k.split(",").map(Number); const P = roll(c, r, d); o.add(P[P.length - 1].join(",")); } return o; }
    // 在 I_ndet 里从当前 I-state 出发广度优先搜索，找到变成 {goal} 的最短倾斜序列
    plan() {
      const key = (S) => [...S].sort().join(";");
      const start = key(this.S), seen = new Map([[start, null]]), q = [this.S];
      let found = null;
      if (this.S.size === 1 && this.S.has(this.goal)) found = start;
      while (q.length && !found) {
        const S = q.shift(), sk = key(S);
        for (const t of TILTS) {
          if (!t) continue;
          const T = this.step(S, t[0]), tk = key(T);
          if (seen.has(tk)) continue;
          seen.set(tk, [sk, t]); q.push(T);
          if (T.size === 1 && T.has(this.goal)) { found = tk; break; }
        }
      }
      this.planSeq = [];
      if (found) { let k = found; while (seen.get(k)) { const [p, t] = seen.get(k); this.planSeq.unshift(t); k = p; } }
      this.searched = seen.size;
      this.updText(); this.st.draw();
    }
    updText() {
      const [gc, gr] = this.goal.split(",");
      this.stats.n.set(this.S.size); this.stats.k.set(this.k);
      this.planBox.innerHTML = this.planSeq.length || (this.S.size === 1 && this.S.has(this.goal))
        ? `目标 (列 ${gc}, 行 ${gr})：从当前 I-state 出发的最短计划 <b>${this.planSeq.length} 步</b>：${this.planSeq.map((t) => t[1]).join(" ") || "（已到达）"}<br><span class="muted">广度优先搜索访问了 ${this.searched} 个不确定 I-state——I_ndet 就是另一个状态空间。</span>`
        : `目标 (列 ${gc}, 行 ${gr})：<b style="color:var(--bad)">从当前 I-state 出发，没有任何倾斜序列能保证把球送到这里</b>（搜索了 ${this.searched} 个 I-state）。换一个目标格试试。`;
    }
    tilt(d, after) {
      if (this.anim) return;
      const paths = [...this.S].map((k) => { const [c, r] = k.split(",").map(Number); return roll(c, r, d); });
      const [tc, tr] = this.truth.split(",").map(Number), tpath = roll(tc, tr, d);
      const t0 = performance.now(), L = Math.max(...paths.map((p) => p.length), 2), dur = 120 + 45 * L;
      const frame = (t) => {
        const u = Math.max(0, Math.min(1, (t - t0) / dur));      // rAF 的时间戳可能早于 t0
        this.anim.u = u; this.anim.paths = paths; this.anim.tpath = tpath; this.st.draw();
        if (u < 1) this.anim.raf = requestAnimationFrame(frame);
        else { this.anim = null; this.S = new Set(paths.map((p) => p[p.length - 1].join(","))); this.truth = tpath[tpath.length - 1].join(","); this.k++; this.plan(); if (after) after(); }
      };
      this.anim = { raf: requestAnimationFrame(frame), u: 0, paths, tpath };
    }
    runPlan() { if (!this.planSeq.length || this.anim) return; const t = this.planSeq[0]; this.tilt(t[0], () => setTimeout(() => this.runPlan(), 150)); }
    draw(st, col) {
      const Y = (r) => TH - 1 - r;
      for (let r = 0; r < TH; r++) for (let c = 0; c < TW; c++) {
        if (TRAY[r][c] === "#") st.rect(c, Y(r), c + 1, Y(r) + 1, C.alpha(col.wall, 0.85), null);
        else st.rect(c, Y(r), c + 1, Y(r) + 1, col.surface, C.alpha(col.border, 0.9), 0.6);
      }
      const [gc, gr] = this.goal.split(",").map(Number);
      st.rect(gc + 0.06, Y(gr) + 0.06, gc + 0.94, Y(gr) + 0.94, C.alpha(col.goal, 0.45), col.goal, 2);
      const at = (P, u) => { const f = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)); if (P.length < 2) return { x: P[0][0] + 0.5, y: Y(P[0][1]) + 0.5 }; const t = f - i; return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * t + 0.5, y: Y(P[i][1]) + (Y(P[i + 1][1]) - Y(P[i][1])) * t + 0.5 }; };
      if (this.anim) for (const P of this.anim.paths) st.dot(at(P, this.anim.u), st.sx * 0.28, C.alpha(col.ndet, 0.6), col.ndet, 1.5);
      else for (const k of this.S) { const [c, r] = k.split(",").map(Number); st.dot({ x: c + 0.5, y: Y(r) + 0.5 }, st.sx * 0.28, C.alpha(col.ndet, 0.6), col.ndet, 1.5); }
      if (this.showTruth) { const p = this.anim ? at(this.anim.tpath, this.anim.u) : (([c, r]) => ({ x: c + 0.5, y: Y(r) + 0.5 }))(this.truth.split(",").map(Number)); st.dot(p, st.sx * 0.16, col.truth); }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='sine-curve']").forEach((el) => (el._w = new SineCurve(el)));
    document.querySelectorAll("[data-widget='graph-point']").forEach((el) => (el._w = new GraphPoint(el)));
    document.querySelectorAll("[data-widget='tray']").forEach((el) => (el._w = new Tray(el)));
  });
})();
