/* 8.1 动机（开环 vs 反馈）与 8.2 离散状态空间：网格上的反馈计划与导航函数、wavefront 与 Dial、NF2 最大间隙 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;

  // =================================================================
  // 组件 1：开环计划 vs 反馈计划（8.1 节）
  // =================================================================
  class OpenLoop {
    constructor(root) {
      this.sigma = 0.004; this.offset = 0; this.seed = 11; this.showField = true; this.pushArmed = false;
      this.holes = [C.rect(.24, 0, .34, .62), C.rect(.56, .38, .66, 1), C.rect(.78, .1, 1, .2)];
      this.region = new C.Region(C.rect(0, 0, 1, 1), this.holes);
      this.xI = { x: .1, y: .12 }; this.xG = { x: .9, y: .86 };
      const body = C.frame(root, "开环计划 vs 反馈计划", "同一个计划器、同一串扰动：一个只记得动作序列，一个在每个状态上都知道该怎么走");
      this.st = new C.Stage({ maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.xI) < .04 ? "I" : C.dist(p, this.xG) < .04 ? "G" : null),
        onMove: (p, d) => { const q = { x: C.clamp(p.x, .01, .99), y: C.clamp(p.y, .01, .99) }; if (!this.region.inside(q)) return; if (d === "I") this.xI = q; else { this.xG = q; this.buildNav(); } this.plan(); this.reset(); },
        cursor: (p) => (C.dist(p, this.xI) < .04 || C.dist(p, this.xG) < .04 ? "grab" : null) });
      this.sS = C.slider("每步随机扰动 σ", 0, 0.012, 0.001, this.sigma, (v) => { this.sigma = v; this.reset(); }, (v) => v.toFixed(3));
      this.sO = C.slider("实际初态偏离 x_I", 0, 0.12, 0.01, this.offset, (v) => { this.offset = v; this.reset(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => this.tick(), () => { this.bRun.textContent = "▶ 执行"; });
      this.bRun = C.button("▶ 执行", () => { if (this.runner.running) this.runner.stop(); else { if (this.done) this.reset(); this.runner.start(); this.bRun.textContent = "⏸ 暂停"; } }, "primary");
      this.bPush = C.button("推一下 ↯", () => { this.pushArmed = true; if (!this.runner.running) { this.runner.start(); this.bRun.textContent = "⏸ 暂停"; } });
      this.bSeed = C.button("换一串扰动", () => { this.seed = (this.seed * 7919 + 13) % 100003; this.reset(); });
      this.cbF = C.check("显示反馈计划（针状图）", true, (v) => { this.showField = v; this.st.draw(); });
      this.stats = { ol: C.stat("开环执行"), fb: C.stat("反馈执行"), t: C.stat("时间步 k") };
      body.append(h("div", { class: "controls" }, this.bRun, this.bPush, this.bSeed, this.cbF),
        h("div", { class: "controls" }, this.sS, this.sO),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("p", { class: "small muted", style: "margin:6px 0" }, "开环：事先从 x_I 出发算好动作序列 u₁, u₂, …，执行时按时间顺序照做，不看当前状态。反馈：每一步都用当前状态 x 查计划 π(x)。拖动 x_I、x_G 会重新规划。"),
          C.legend([[C.cv("muted"), "规划出的路径（虚线）"], [C.cv("warn"), "开环执行"], [C.cv("path"), "反馈执行"], [C.cva("accent", .6), "π(x) 的方向"]]))));
      this.buildNav(); this.plan(); this.reset();
    }
    // 在 100×100 网格上用 Dijkstra 算到 x_G 的 cost-to-go（离障碍留一点余量），当作导航函数
    buildNav() {
      const N = 100, phi = new Float64Array(N * N).fill(Infinity), free = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const p = { x: (i + .5) / N, y: (j + .5) / N };
        free[j * N + i] = this.region.inside(p) && this.region.clearance(p) > 0.022 ? 1 : 0;
      }
      const gi = Math.min(N - 1, Math.floor(this.xG.x * N)), gj = Math.min(N - 1, Math.floor(this.xG.y * N));
      const heap = new C.Heap(); phi[gj * N + gi] = 0; heap.push(gj * N + gi, 0); free[gj * N + gi] = 1;
      while (heap.size) {
        const k = heap.pop(), i = k % N, j = (k - i) / N, v = phi[k];
        for (const [di, dj] of C.N8) {
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N || !free[b * N + a]) continue;
          const nv = v + (di && dj ? Math.SQRT2 : 1) / N;
          if (nv < phi[b * N + a]) { phi[b * N + a] = nv; heap.push(b * N + a, nv); }
        }
      }
      this.N = N; this.phi = phi;
    }
    // 双线性插值；忽略为 ∞ 的角点（剩下的重新归一化）
    phiAt(p) {
      const N = this.N, x = p.x * N - .5, y = p.y * N - .5;
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      let s = 0, w = 0;
      for (const [di, dj, ww] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const v = this.phi[b * N + a]; if (!isFinite(v) || ww <= 0) continue; s += ww * v; w += ww;
      }
      return w > 1e-9 ? s / w : Infinity;
    }
    // 反馈计划：式 (8.41) 的离散版——试 32 个方向走一小步，取 φ 最小的
    pi(p) {
      if (C.dist(p, this.xG) < 0.03) return { x: 0, y: 0 };
      let best = Infinity, bu = null;
      for (let k = 0; k < 32; k++) {
        const a = 2 * Math.PI * k / 32, u = { x: Math.cos(a), y: Math.sin(a) };
        const v = this.phiAt({ x: p.x + .02 * u.x, y: p.y + .02 * u.y });
        if (v < best) { best = v; bu = u; }
      }
      return bu || { x: 0, y: 0 };
    }
    plan() {
      const dt = 0.01; let p = this.xI; this.U = []; this.planned = [p];
      for (let k = 0; k < 600; k++) { const u = this.pi(p); if (!u.x && !u.y) break; this.U.push(u); p = { x: p.x + dt * u.x, y: p.y + dt * u.y }; this.planned.push(p); }
    }
    reset() {
      this.runner.stop();
      const x0 = { x: this.xI.x, y: this.xI.y + this.offset };
      this.ol = { p: x0, tr: [x0], st: "" }; this.fb = { p: x0, tr: [x0], st: "" };
      if (!this.region.inside(x0)) { this.ol.st = this.fb.st = "初态在障碍里"; }
      this.k = 0; this.r = C.rng(this.seed); this.done = false; this.pushArmed = false; this.pushes = [];
      this.update(); this.st.draw();
    }
    tick() {
      for (let s = 0; s < 3; s++) this.stepOnce();
      this.update(); this.st.draw();
      if (this.done) return false;
      return true;
    }
    stepOnce() {
      if (this.done) return;
      const dt = 0.01, w = { x: this.sigma * C.gauss(this.r), y: this.sigma * C.gauss(this.r) };
      let push = null;
      if (this.pushArmed) { const a = this.r() * 2 * Math.PI; push = { x: .07 * Math.cos(a), y: .07 * Math.sin(a) }; this.pushArmed = false; this.pushes.push({ k: this.k, ol: this.ol.p, fb: this.fb.p }); }
      const adv = (E, u) => {
        if (E.st) return;
        let q = { x: E.p.x + dt * u.x + w.x, y: E.p.y + dt * u.y + w.y };
        if (push) q = { x: q.x + push.x, y: q.y + push.y };
        if (!this.region.inside(q) || q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) { E.tr.push(q); E.p = q; E.st = "碰撞"; return; }
        E.p = q; E.tr.push(q);
        if (C.dist(q, this.xG) < 0.03) E.st = "到达";
      };
      if (!this.ol.st) { if (this.k < this.U.length) adv(this.ol, this.U[this.k]); else this.ol.st = "动作用完"; }
      if (!this.fb.st) { const u = this.pi(this.fb.p); if (!u.x && !u.y) this.fb.st = "到达"; else adv(this.fb, u); }
      this.k++;
      if ((this.ol.st && this.fb.st) || this.k > 1500) this.done = true;
    }
    update() {
      const fmt = (E) => {
        const d = C.dist(E.p, this.xG).toFixed(3);
        if (E.st === "碰撞") return '<span class="no">✕ 碰撞</span>';
        if (E.st === "到达") return '<span class="yes">✓ 到达</span>';
        if (E.st === "动作用完") return `<span class="no">停在离目标 ${d}</span>`;
        if (E.st) return E.st;
        return `离目标 ${d}`;
      };
      this.stats.ol.set(fmt(this.ol)); this.stats.fb.set(fmt(this.fb)); this.stats.t.set(`${this.k} / ${this.U.length}`);
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.showField) st.needles((p) => (this.region.inside(p) && C.dist(p, this.xG) > .03 ? this.pi(p) : null), col, { n: 20, color: C.alpha(col.accent, .45), lw: 1, head: 3.5 });
      for (const P of this.holes) st.poly(P, C.alpha(col.wall, .82), col.wall, 1);
      st.polyline(this.planned, C.alpha(col.muted, .9), 1.5, [5, 4]);
      st.polyline(this.ol.tr, col.warn, 2.4);
      st.polyline(this.fb.tr, col.path, 2.4);
      for (const E of [this.ol, this.fb]) {
        if (E.st === "碰撞") st.xmark(E.p, col.bad, 6);
        else st.dot(E.p, 4.5, E === this.ol ? col.warn : col.path, col.surface, 1.5);
      }
      for (const ps of this.pushes) { st.text("↯", ps.fb, col.bad, { size: 15, dy: -10, weight: 700 }); }
      st.circle(this.xG, .03, C.alpha(col.goal, .15), C.alpha(col.goal, .6), 1);
      st.qmark(this.xI, "I", col); st.qmark(this.xG, "G", col);
    }
  }

  // =================================================================
  // 组件 2：网格上的反馈计划与导航函数（例 8.1、8.2，图 8.2、8.3）
  // =================================================================
  const BOOK_GRID = ["..........", "..######..", "..######..", "..........", "..........", "#######...", "#######...", ".....##...", "..G..##...", ".........."];
  const BOOK_82B = ["DDLRRRRRDD", "DD######DD", "DD######DD", "RRRRRRRDDD", "RRRRRRRDDD", "#######DDD", "#######DDD", "RRDLL##DDD", "RRTLL##DDD", "RRULLLLLLL"];
  const ACT = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const ACT_NAME = { U: "↑", D: "↓", L: "←", R: "→" };

  class GridNavFn {
    constructor(root) {
      this.H = 10; this.W = 10; this.mode = "opt"; this.click = "run"; this.showNums = true; this.showAlt = false;
      const body = C.frame(root, "网格上的反馈计划与导航函数", "例 8.1、8.2：φ 是 cost-to-go，局部算子 (8.4) 在每个格子选一个让 φ 下降的动作");
      this.st = new C.Stage({ view: [0, 10, 0, 10], maxW: 440, pad: 2, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { this.onClick(p); return null; } });
      this.segM = C.seg([["opt", "φ = 最优 cost-to-go（图 8.3）"], ["man", "φ = 曼哈顿距离（无视障碍）"]], this.mode, (k) => { this.mode = k; this.compute(); });
      this.segC = C.seg([["run", "点格子：从这里执行"], ["wall", "点格子：加/去障碍"], ["goal", "点格子：移动目标"]], this.click, (k) => { this.click = k; });
      this.cbN = C.check("显示 φ 的数值", true, (v) => { this.showNums = v; this.st.draw(); });
      this.cbA = C.check("显示：哪些箭头可以换（另一个同样最优的动作）", false, (v) => { this.showAlt = v; this.st.draw(); });
      this.checks = h("div", { class: "panel-body" });
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.segC, C.button("恢复图 8.2a", () => this.load(), "small")),
        h("div", { class: "controls" }, this.cbN, this.cbA),
        h("div", { class: "split" }, this.st.wrap, h("div", null,
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "导航函数的三条性质（各向同性代价）"), this.checks), this.msg,
          C.legend([[C.cv("accent"), "π(x)：局部算子选出的动作"], [C.cva("accent", .35), "另一个同样最优的动作"], [C.cv("bad"), "局部极小（✕）"], [C.cv("path"), "执行轨迹"]]))));
      this.runner = new C.Runner(() => this.anim(), null);
      this.load();
    }
    load() {
      this.free = BOOK_GRID.map((r) => [...r].map((ch) => ch !== "#")); this.goal = [8, 2];
      this.path = null; this.compute();
    }
    isBook() {
      if (this.goal[0] !== 8 || this.goal[1] !== 2 || this.mode !== "opt") return false;
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (this.free[r][c] !== (BOOK_GRID[r][c] !== "#")) return false;
      return true;
    }
    compute() {
      const H = this.H, W = this.W, flat = new Uint8Array(H * W);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) flat[r * W + c] = this.free[r][c] ? 1 : 0;
      const wf = C.wavefront(flat, H, W, [this.goal], C.N4);
      this.reach = wf.phi;
      if (this.mode === "opt") this.phi = wf.phi;
      else { this.phi = new Float64Array(H * W); for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) this.phi[r * W + c] = this.free[r][c] ? Math.abs(r - this.goal[0]) + Math.abs(c - this.goal[1]) : Infinity; }
      const book = this.isBook();
      // 每个格子的动作：所有让 φ(f(x,u)) 最小的 u（8.4）；最小值不比 φ(x) 小就是局部极小
      this.acts = []; this.locmin = [];
      for (let r = 0; r < H; r++) { this.acts.push([]); for (let c = 0; c < W; c++) {
        let list = [];
        if (this.free[r][c] && !(r === this.goal[0] && c === this.goal[1])) {
          let best = Infinity;
          for (const [k, [dr, dc]] of Object.entries(ACT)) { const a = r + dr, b = c + dc; if (a < 0 || b < 0 || a >= H || b >= W || !this.free[a][b]) continue; const v = this.phi[a * W + b]; if (v < best - 1e-9) { best = v; list = [k]; } else if (Math.abs(v - best) < 1e-9) list.push(k); }
          if (!(best < this.phi[r * W + c])) { if (isFinite(this.phi[r * W + c])) this.locmin.push([r, c]); list = []; }
          else if (book) { const bk = BOOK_82B[r][c]; list = [bk, ...list.filter((k) => k !== bk)]; }
        }
        this.acts[r].push(list);
      } }
      this.checkProps(); this.st.draw();
    }
    checkProps() {
      const H = this.H, W = this.W, g = this.goal;
      const p1 = this.phi[g[0] * W + g[1]] === 0;
      let p2bad = 0, unreach = 0, optBad = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!this.free[r][c]) continue;
        const reachable = isFinite(this.reach[r * W + c]); if (!reachable) unreach++;
        if (reachable !== isFinite(this.phi[r * W + c])) p2bad++;
        if (reachable && !(r === g[0] && c === g[1])) {
          let m = Infinity; for (const [dr, dc] of Object.values(ACT)) { const a = r + dr, b = c + dc; if (a >= 0 && b >= 0 && a < H && b < W && this.free[a][b]) m = Math.min(m, 1 + this.phi[a * W + b]); }
          if (Math.abs(m - this.phi[r * W + c]) > 1e-9) optBad++;
        }
      }
      const ok = (b) => (b ? '<span class="yes">✓</span>' : '<span class="no">✗</span>');
      const lm = this.locmin.filter(([r, c]) => isFinite(this.reach[r * W + c]));
      this.checks.innerHTML = `
        <div>${ok(p1)} 1. 目标处 φ(x_G) = 0</div>
        <div>${ok(p2bad === 0)} 2. φ(x) = ∞ ⇔ 从 x 到不了目标 <span class="muted">（到不了的格子 ${unreach} 个${p2bad ? `，其中 ${p2bad} 个 φ 却是有限值` : ""}）</span></div>
        <div>${ok(lm.length === 0)} 3. 每个能到目标的 x ∉ X_G，局部算子都能让 φ 严格下降 <span class="muted">${lm.length ? `（局部极小：${lm.map(([r, c]) => `(${r},${c})`).join(" ")}）` : ""}</span></div>
        <div style="margin-top:4px">${ok(optBad === 0)} 另外满足 (8.6) φ(x) = min_u{1 + φ(f(x,u))} ⇒ <b>最优</b>导航函数 <span class="muted">${optBad ? `（${optBad} 个格子不满足）` : ""}</span></div>
        <div class="muted" style="margin-top:4px">${this.isBook() ? "当前就是书中的网格：实线箭头取自图 8.2b。" : "网格或 φ 已改动：实线箭头是局部算子按 ↑↓←→ 顺序取的第一个最优动作。"}</div>`;
    }
    onClick(p) {
      const cell = C.cellAt(this.st, this.H, this.W, p); if (!cell) return;
      const [r, c] = cell;
      if (this.click === "wall") { if (r === this.goal[0] && c === this.goal[1]) return; this.free[r][c] = !this.free[r][c]; this.path = null; this.compute(); return; }
      if (this.click === "goal") { if (!this.free[r][c]) return; this.goal = [r, c]; this.path = null; this.compute(); return; }
      if (!this.free[r][c]) return;
      // 执行：沿实线箭头走
      const path = [[r, c]]; let cr = r, cc = c, stuck = false;
      for (let k = 0; k < 200; k++) {
        if (cr === this.goal[0] && cc === this.goal[1]) break;
        const a = this.acts[cr][cc][0]; if (!a) { stuck = true; break; }
        cr += ACT[a][0]; cc += ACT[a][1]; path.push([cr, cc]);
      }
      this.path = path; this.pathStuck = stuck; this.t = 0;
      const unreachable = !isFinite(this.reach[r * this.W + c]);
      this.msg.innerHTML = unreachable ? '<span class="no">这个格子到不了目标：φ = ∞，计划在这里不做任何事。</span>'
        : stuck ? `<span class="no">走了 ${path.length - 1} 步后卡在局部极小 (${cr},${cc})：四周没有更小的 φ。</span>`
          : `从 (${r},${c}) 出发走了 <b>${path.length - 1}</b> 步到达目标，最后执行 u_T；${this.mode === "opt" ? `正好等于 φ = ${this.phi[r * this.W + c]}。` : ""}`;
      this.runner.stop(); this.runner.start();
    }
    anim() { this.t += 0.25; this.st.draw(); return this.path && this.t < this.path.length - 1; }
    draw(ctx, st, col) {
      const H = this.H, W = this.W, R = C.ramp(col);
      let mx = 0; for (let k = 0; k < H * W; k++) if (isFinite(this.phi[k])) mx = Math.max(mx, this.phi[k]);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!this.free[r][c]) { C.fillCell(st, H, r, c, C.alpha(col.wall, .85)); continue; }
        const v = this.phi[r * W + c];
        if (r === this.goal[0] && c === this.goal[1]) C.fillCell(st, H, r, c, C.alpha(col.goal, .3));
        else if (isFinite(v)) { const q = R(0.05 + .5 * v / (mx || 1)); C.fillCell(st, H, r, c, `rgb(${q[0]},${q[1]},${q[2]})`); }
        else C.fillCell(st, H, r, c, col.surface2);
      }
      C.gridLines(st, H, W, col.border);
      const s = st.scale;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (!this.free[r][c]) continue;
        const ctr = { x: c + .5, y: H - r - .5 }, v = this.phi[r * W + c];
        if (r === this.goal[0] && c === this.goal[1]) { st.text("u_T", ctr, col.goal, { size: Math.max(9, s * .28), weight: 700, dy: this.showNums ? -s * .18 : 0 }); }
        const acts = this.acts[r][c];
        acts.forEach((a, k) => {
          if (k > 1 || (k === 1 && !this.showAlt)) return;
          const [dr, dc] = ACT[a], u = { x: dc, y: -dr };
          const off = this.showNums ? .14 : 0;
          st.arrow({ x: ctr.x - u.x * .3 + (k ? -u.y * .16 : 0), y: ctr.y - u.y * .3 + off + (k ? u.x * .16 : 0) }, { x: u.x, y: u.y }, k ? C.alpha(col.accent, .38) : col.accent, { px: s * .6, lw: k ? 1.2 : 1.7, head: Math.max(4, s * .13), dash: k ? [3, 2] : null });
        });
        if (this.showNums) st.text(isFinite(v) ? String(v) : "∞", { x: ctr.x, y: ctr.y - (r === this.goal[0] && c === this.goal[1] ? -.02 : .22) }, col.text2, { size: Math.max(9, s * .26), weight: 600, dy: r === this.goal[0] && c === this.goal[1] ? s * .12 : 0 });
      }
      for (const [r, c] of this.locmin) st.xmark({ x: c + .5, y: H - r - .5 }, col.bad, s * .22);
      if (this.path) {
        const P = this.path.map(([r, c]) => ({ x: c + .5, y: H - r - .5 }));
        const n = Math.min(P.length - 1, Math.floor(this.t));
        st.polyline(P.slice(0, n + 1).concat([C.lerp(P[n], P[Math.min(P.length - 1, n + 1)], this.t - n)]), col.path, 3);
        st.dot(C.lerp(P[n], P[Math.min(P.length - 1, n + 1)], this.t - n), s * .16, col.path, col.surface, 2);
      }
    }
  }

  // =================================================================
  // 组件 3：wavefront 传播（图 8.4）与 Dial 算法
  // =================================================================
  class Wavefront {
    constructor(root) {
      this.H = 18; this.W = 30; this.mode = "wave"; this.click = "path";
      const body = C.frame(root, "wavefront 传播与 Dial 算法", "W₀ = X_G，一层一层往外推；整数代价时用「桶」代替优先队列");
      this.st = new C.Stage({ view: [0, this.W, 0, this.H], aspect: this.H / this.W, maxW: 600, pad: 2, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.onDown(p), onMove: (p, d) => this.onDrag(p, d) });
      this.segM = C.seg([["wave", "1-邻域 · 单位代价（wavefront）"], ["dial", "2-邻域 · 代价 5 / 7（Dial）"]], this.mode, (k) => { this.mode = k; this.reset(); });
      this.segC = C.seg([["path", "点格子：画出执行路径"], ["wall", "拖动：画/擦障碍"], ["goal", "点格子：移动目标"]], this.click, (k) => { this.click = k; });
      this.runner = new C.Runner(() => { this.frameCount = (this.frameCount || 0) + 1; if (this.frameCount % 6) return true; return this.step(); }, () => { this.bPlay.textContent = "▶ 播放"; });
      this.bPlay = C.button("▶ 播放", () => { if (this.runner.running) this.runner.stop(); else { this.runner.start(); this.bPlay.textContent = "⏸ 暂停"; } }, "primary");
      this.stats = { it: C.stat("当前层 i / 当前桶"), n: C.stat("已赋值的状态"), b: C.stat("非空的桶"), path: C.stat("执行路径") };
      this.pseudo = h("div", { class: "pseudo ch8-wrap" });
      this.buckets = h("ul", { class: "qlist" });
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.bPlay, C.button("下一步", () => this.step()), C.button("一次跑完", () => { while (this.step()); }), C.button("重置", () => this.reset()), h("span", { class: "sep" }), this.segC),
        h("div", { class: "lab-grid" }, h("div", null, this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
          C.legend([[C.cv("alive"), "当前在处理的 W_i / 最小桶"], [C.cv("alive2"), "下一层 / 已进桶、尚未处理"], [C.cva("accent", .55), "已赋值（越深 φ 越大）"], [C.cv("path"), "沿 φ 下降的执行路径"]])),
        h("div", { class: "lab-side" }, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "算法"), this.pseudo), h("div", { class: "panel" }, h("div", { class: "panel-title" }, "桶（cost-to-go 值 → 状态数）"), h("div", { class: "panel-body" }, this.buckets)))));
      this.free = new Uint8Array(this.H * this.W).fill(1);
      const walls = [[3, 6, 4, 14], [8, 0, 9, 9], [3, 14, 12, 15], [12, 18, 13, 27], [0, 22, 7, 23], [14, 8, 18, 9]];
      for (const [r0, c0, r1, c1] of walls) for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) this.free[r * this.W + c] = 0;
      this.goal = [15, 26]; this.query = [1, 1];
      this.reset();
    }
    reset() {
      this.runner.stop();
      const N = this.H * this.W;
      this.phi = new Float64Array(N).fill(Infinity); this.fin = new Uint8Array(N);
      this.phi[this.goal[0] * this.W + this.goal[1]] = 0;
      this.i = 0; this.cur = [this.goal]; this.next = []; this.bk = new Map([[0, [this.goal]]]); this.curKey = 0; this.done = false;
      // 先完整跑一遍，用于配色的最大值
      this.final = this.solveAll();
      this.renderSide(); this.st.draw();
    }
    nb() { return this.mode === "wave" ? C.N4 : C.N8; }
    solveAll() {
      const H = this.H, W = this.W;
      if (this.mode === "wave") return C.wavefront(this.free, H, W, [this.goal], C.N4).phi;
      const d = new Float64Array(H * W).fill(Infinity), heap = new C.Heap(); d[this.goal[0] * W + this.goal[1]] = 0; heap.push(this.goal[0] * W + this.goal[1], 0);
      while (heap.size) { const k = heap.pop(), r = Math.floor(k / W), c = k % W; for (const [dr, dc] of C.N8) { const a = r + dr, b = c + dc; if (a < 0 || b < 0 || a >= H || b >= W || !this.free[a * W + b]) continue; const nv = d[k] + (dr && dc ? 7 : 5); if (nv < d[a * W + b]) { d[a * W + b] = nv; heap.push(a * W + b, nv); } } }
      return d;
    }
    step() {
      if (this.done) return false;
      const H = this.H, W = this.W;
      if (this.mode === "wave") {
        // 图 8.4 第 3 步：W_i 中每个 x 赋 φ = i，并把未探索的邻居放进 W_{i+1}
        const nxt = [];
        for (const [r, c] of this.cur) {
          this.fin[r * W + c] = 1;
          for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc; if (a < 0 || b < 0 || a >= H || b >= W || !this.free[a * W + b] || this.phi[a * W + b] !== Infinity) continue; this.phi[a * W + b] = this.i + 1; nxt.push([a, b]); }
        }
        if (!nxt.length) { this.done = true; this.cur = []; }
        else { this.i++; this.cur = nxt; }
      } else {
        // Dial：取出最小的非空桶，桶里所有状态都已是最优值，可以「并行」处理
        if (!this.bk.size) { this.done = true; this.renderSide(); this.st.draw(); return false; }
        const key = Math.min(...this.bk.keys()); this.curKey = key;
        const items = this.bk.get(key); this.bk.delete(key);
        for (const [r, c] of items) {
          if (this.phi[r * W + c] !== key || this.fin[r * W + c]) continue;
          this.fin[r * W + c] = 1;
          for (const [dr, dc] of C.N8) {
            const a = r + dr, b = c + dc; if (a < 0 || b < 0 || a >= H || b >= W || !this.free[a * W + b]) continue;
            const nv = key + (dr && dc ? 7 : 5);
            if (nv < this.phi[a * W + b]) { this.phi[a * W + b] = nv; if (!this.bk.has(nv)) this.bk.set(nv, []); this.bk.get(nv).push([a, b]); }
          }
        }
        this.cur = items.filter(([r, c]) => this.phi[r * W + c] === key);
        if (!this.bk.size) this.done = true;
      }
      this.renderSide(); this.st.draw();
      return !this.done;
    }
    renderSide() {
      const wave = this.mode === "wave";
      const hl = wave ? (this.done ? 4 : 3) : (this.done ? 4 : 2);
      const lines = wave
        ? ["初始化 W₀ = X_G；i = 0", "初始化 W_{i+1} = ∅", "对每个 x ∈ W_i：φ(x) = i，把 x 的所有未探索邻居放进 W_{i+1}", "若 W_{i+1} = ∅ 则结束；否则 i := i + 1，回到第 2 步"]
        : ["桶 B[0] = {x_G}，其余桶为空", "取出最小的非空桶 B[c]：其中的状态 φ = c 已是最优", "对其中每个 x 的每个邻居 x'：若 c + l(x,x') < φ(x') 就更新，并把 x' 放进桶 B[c + l]", "所有桶都空了就结束；否则回到第 2 步"];
      this.pseudo.innerHTML = lines.map((t, k) => `<span class="ln${k + 1 === hl ? " hl" : ""}">${t}</span>`).join("") +
        `<span class="ln"><span class="cm">${wave ? "图 8.4：Dijkstra 的特例，单位代价时不需要优先队列" : "代价 5 = 直走、7 = 斜走（7/5 ≈ √2，补充选的整数）"}</span></span>`;
      let n = 0; for (let k = 0; k < this.phi.length; k++) if (isFinite(this.phi[k])) n++;
      this.stats.it.set(wave ? `i = ${this.i}` : `c = ${this.curKey}`);
      this.stats.n.set(n);
      if (wave) {
        this.stats.b.set(this.done ? 0 : 2);
        this.buckets.innerHTML = this.done ? '<li class="more">结束</li>' : `<li><span>W_${this.i}（当前）</span><span>${this.cur.length}</span></li><li><span>W_${this.i + 1}（正在填）</span><span>…</span></li><li class="more">单位代价：任何时刻最多两个桶</li>`;
      } else {
        const keys = [...this.bk.keys()].sort((a, b) => a - b);
        this.stats.b.set(keys.length);
        this.buckets.innerHTML = (this.done ? '<li class="more">结束</li>' : "") + keys.slice(0, 10).map((k) => `<li><span>B[${k}]</span><span>${this.bk.get(k).length}</span></li>`).join("") + (keys.length > 10 ? `<li class="more">… 还有 ${keys.length - 10} 个</li>` : "");
      }
      this.updatePath();
    }
    updatePath() {
      if (!this.done || !this.query) { this.path = null; this.stats.path.set("跑完后点一个格子"); return; }
      const [r, c] = this.query;
      if (!isFinite(this.phi[r * this.W + c])) { this.path = null; this.stats.path.set("到不了"); return; }
      this.path = C.descendGrid(this.phi, this.H, this.W, this.query, this.nb());
      let L = 0; for (let k = 1; k < this.path.length; k++) L += Math.hypot(this.path[k][0] - this.path[k - 1][0], this.path[k][1] - this.path[k - 1][1]);
      this.stats.path.set(`${this.path.length - 1} 步，长 ${L.toFixed(1)}`);
    }
    onDown(p) {
      const cell = C.cellAt(this.st, this.H, this.W, p); if (!cell) return null;
      const [r, c] = cell, k = r * this.W + c;
      if (this.click === "path") { this.query = cell; this.updatePath(); this.st.draw(); return null; }
      if (this.click === "goal") { if (!this.free[k]) return null; this.goal = cell; this.reset(); return null; }
      if (r === this.goal[0] && c === this.goal[1]) return null;
      this.paint = this.free[k] ? 0 : 1; this.free[k] = this.paint; this.reset(); return "paint";
    }
    onDrag(p) {
      const cell = C.cellAt(this.st, this.H, this.W, p); if (!cell) return;
      const [r, c] = cell, k = r * this.W + c;
      if ((r === this.goal[0] && c === this.goal[1]) || this.free[k] === this.paint) return;
      this.free[k] = this.paint; this.reset();
    }
    draw(ctx, st, col) {
      const H = this.H, W = this.W, R = C.ramp(col);
      let mx = 0; for (let k = 0; k < H * W; k++) if (isFinite(this.final[k])) mx = Math.max(mx, this.final[k]);
      const curSet = new Set(this.cur.map(([r, c]) => r * W + c));
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const k = r * W + c;
        if (!this.free[k]) { C.fillCell(st, H, r, c, C.alpha(col.wall, .85)); continue; }
        if (curSet.has(k) && !this.done) C.fillCell(st, H, r, c, col.alive);
        else if (this.fin[k] || (this.done && isFinite(this.phi[k]))) { const q = R(.1 + .7 * this.phi[k] / (mx || 1)); C.fillCell(st, H, r, c, `rgb(${q[0]},${q[1]},${q[2]})`); }
        else if (isFinite(this.phi[k])) C.fillCell(st, H, r, c, C.alpha(col.alive2, .55));
        else C.fillCell(st, H, r, c, col.surface);
      }
      C.gridLines(st, H, W, col.border);
      const s = st.scale;
      if (s > 15) for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const v = this.phi[r * W + c]; if (!isFinite(v) || !this.free[r * W + c]) continue;
        st.text(String(v), { x: c + .5, y: H - r - .5 }, col.text2, { size: Math.max(8, s * (v >= 100 ? .3 : .38)) });
      }
      if (this.path) { st.polyline(this.path.map(([r, c]) => ({ x: c + .5, y: H - r - .5 })), col.path, 3); st.dot({ x: this.query[1] + .5, y: H - this.query[0] - .5 }, s * .25, col.start, col.surface, 1.5); }
      st.dot({ x: this.goal[1] + .5, y: H - this.goal[0] - .5 }, s * .3, col.goal, col.surface, 2);
    }
  }

  // =================================================================
  // 组件 4：最大间隙导航函数 NF2（8.2.3 节）
  // =================================================================
  const NF2_RECTS = [[7, 5, 14, 11], [20, 0, 24, 9], [19, 15, 31, 18], [5, 16, 13, 20]];  // (c0, r0, c1, r1)，与参考代码相同
  function nf2Compute(free, H, W, goal) {
    // 障碍编号：每个障碍连通块一个编号；外边界四条边各一个编号
    const lo = new Int32Array(H * W).fill(-1); let nid = 0;
    for (let k = 0; k < H * W; k++) if (!free[k] && lo[k] < 0) {
      const stack = [k]; lo[k] = nid;
      while (stack.length) { const q = stack.pop(), r = Math.floor(q / W), c = q % W; for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc; if (a >= 0 && b >= 0 && a < H && b < W && !free[a * W + b] && lo[a * W + b] < 0) { lo[a * W + b] = nid; stack.push(a * W + b); } } }
      nid++;
    }
    const TOP = nid, BOT = nid + 1, LEFT = nid + 2, RIGHT = nid + 3;
    const d = new Float64Array(H * W).fill(Infinity), lab = new Int32Array(H * W).fill(-1), W0 = [];
    // 步骤 1：W₀ = 至少一个方向被挡住的状态
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!free[r * W + c]) continue;
      const labs = [];
      for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc; if (a < 0) labs.push(TOP); else if (a >= H) labs.push(BOT); else if (b < 0) labs.push(LEFT); else if (b >= W) labs.push(RIGHT); else if (!free[a * W + b]) labs.push(lo[a * W + b]); }
      if (labs.length) { d[r * W + c] = 0; lab[r * W + c] = Math.min(...labs); W0.push([r, c]); }
    }
    // 步骤 2：从障碍边界向外传播
    let cur = W0;
    while (cur.length) { const nxt = []; for (const [r, c] of cur) for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc; if (a >= 0 && b >= 0 && a < H && b < W && free[a * W + b] && d[a * W + b] === Infinity) { d[a * W + b] = d[r * W + c] + 1; lab[a * W + b] = lab[r * W + c]; nxt.push([a, b]); } } cur = nxt; }
    // 步骤 3：来自不同障碍的波前相遇处 = 骨架（只是相接时，取离障碍较远的那个）
    const S0 = new Set();
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { if (!free[r * W + c]) continue; for (const [dr, dc] of [[1, 0], [0, 1]]) { const a = r + dr, b = c + dc; if (a < H && b < W && free[a * W + b] && lab[a * W + b] !== lab[r * W + c]) S0.add(d[r * W + c] >= d[a * W + b] ? r * W + c : a * W + b); } }
    // 步骤 4：用 BFS 把 x_G 连到骨架
    const g = goal[0] * W + goal[1], prev = new Map([[g, -1]]), q = [g]; let hit = S0.has(g) ? g : -1;
    for (let k = 0; hit < 0 && k < q.length; k++) { const v = q[k], r = Math.floor(v / W), c = v % W; for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc, u = a * W + b; if (a >= 0 && b >= 0 && a < H && b < W && free[u] && !prev.has(u)) { prev.set(u, v); if (S0.has(u)) { hit = u; break; } q.push(u); } } }
    const conn = []; for (let p = hit; p >= 0; p = prev.get(p)) conn.push(p);
    const Sall = new Set([...S0, ...conn]);
    // 步骤 5：S 上从 x_G 做 wavefront（其它状态当障碍；骨架是阶梯状的，这里允许 8-邻域）
    const phi1 = new Map([[g, 0]]); cur = [g];
    while (cur.length) { const nxt = []; for (const v of cur) { const r = Math.floor(v / W), c = v % W; for (const [dr, dc] of C.N8) { const a = r + dr, b = c + dc, u = a * W + b; if (a >= 0 && b >= 0 && a < H && b < W && Sall.has(u) && !phi1.has(u)) { phi1.set(u, phi1.get(v) + 1); nxt.push(u); } } } cur = nxt; }
    // 步骤 6：把 S（与 x_G 连通的那部分）当目标，wavefront 得 φ2，并记下最近的骨架点 x'
    const phi2 = new Float64Array(H * W).fill(Infinity), near = new Int32Array(H * W).fill(-1);
    cur = [...phi1.keys()]; for (const v of cur) { phi2[v] = 0; near[v] = v; }
    while (cur.length) { const nxt = []; for (const v of cur) { const r = Math.floor(v / W), c = v % W; for (const [dr, dc] of C.N4) { const a = r + dr, b = c + dc, u = a * W + b; if (a >= 0 && b >= 0 && a < H && b < W && free[u] && phi2[u] === Infinity) { phi2[u] = phi2[v] + 1; near[u] = near[v]; nxt.push(u); } } } cur = nxt; }
    // 步骤 7：合并
    const phi = new Float64Array(H * W).fill(Infinity);
    for (let k = 0; k < H * W; k++) if (near[k] >= 0) phi[k] = phi1.get(near[k]) + phi2[k];
    return { d, W0, S0, conn, phi1, phi2, near, phi };
  }

  class NF2 {
    constructor(root) {
      this.H = 24; this.W = 36; this.stepN = 7; this.click = "start"; this.showOpt = true;
      const body = C.frame(root, "最大间隙导航函数 NF2", "先把机器人引到骨架（离障碍最远的地方），沿骨架走，最后离开骨架到目标");
      this.st = new C.Stage({ view: [0, this.W, 0, this.H], aspect: this.H / this.W, maxW: 600, pad: 2, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { const cell = C.cellAt(this.st, this.H, this.W, p); if (!cell || !this.free[cell[0] * this.W + cell[1]]) return null; if (this.click === "start") this.start = cell; else this.goal = cell; this.compute(); return this.click; },
        onMove: (p, d) => { const cell = C.cellAt(this.st, this.H, this.W, p); if (!cell || !this.free[cell[0] * this.W + cell[1]]) return; if (d === "start") this.start = cell; else this.goal = cell; this.compute(); } });
      const names = ["1 障碍边界 W₀", "2 向外传播", "3 骨架 S", "4 连接 x_G", "5 φ₁（沿骨架）", "6 φ₂（到骨架）", "7 φ = φ₁(x') + φ₂(x)"];
      this.segS = C.seg(names.map((t, k) => [String(k + 1), t]), "7", (k) => { this.stepN = +k; this.st.draw(); this.explain(); });
      this.segC = C.seg([["start", "点击 / 拖动：起点"], ["goal", "点击 / 拖动：目标"]], this.click, (k) => { this.click = k; });
      this.cbO = C.check("对照：最短路径（8-邻域 wavefront）", true, (v) => { this.showOpt = v; this.st.draw(); });
      this.stats = { nf2: C.stat("NF2 路径：步数 / 最小间隙"), opt: C.stat("最短路径：步数 / 最小间隙"), S: C.stat("骨架状态数 |S|") };
      this.note = h("p", { class: "small", style: "margin:6px 0 0;min-height:3em" });
      body.append(h("div", { class: "controls" }, this.segS), h("div", { class: "controls" }, this.segC, this.cbO),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.note,
        C.legend([[C.cv("alive"), "W₀ / 正在强调的集合"], [C.cv("accent"), "骨架 S"], [C.cv("goal"), "x_G 到骨架的连接"], [C.cv("path"), "沿 NF2 下降"], [C.cv("muted"), "最短路径（虚线）"]]));
      this.free = new Uint8Array(this.H * this.W).fill(1);
      for (const [c0, r0, c1, r1] of NF2_RECTS) for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) this.free[r * this.W + c] = 0;
      this.goal = [20, 33]; this.start = [2, 2];
      this.compute();
    }
    compute() {
      this.R = nf2Compute(this.free, this.H, this.W, this.goal);
      this.opt = C.wavefront(this.free, this.H, this.W, [this.goal], C.N8).phi;
      this.pN = C.descendGrid(this.R.phi, this.H, this.W, this.start, C.N8);
      this.pO = C.descendGrid(this.opt, this.H, this.W, this.start, C.N8);
      const clr = (P) => (P.length > 2 ? Math.min(...P.slice(1, -1).map(([r, c]) => this.R.d[r * this.W + c])) : "—");
      this.stats.nf2.set(`${this.pN.length - 1} / ${clr(this.pN)}`); this.stats.opt.set(`${this.pO.length - 1} / ${clr(this.pO)}`); this.stats.S.set(this.R.phi1.size);
      this.explain(); this.st.draw();
    }
    explain() {
      const t = [
        "步骤 1：不用 X_G，而是把「至少一个方向被挡住」的自由状态（离散自由空间的边界）作为 W₀。",
        "步骤 2：从障碍边界出发做 wavefront，代价像波浪一样向外传播；颜色越深离障碍越远。",
        "步骤 3：来自不同障碍（或外墙的不同边）的波前相遇的地方，标为骨架状态——它近似于 6.2.3 节的最大间隙路线图。",
        "步骤 4：用任意搜索把 x_G 连到骨架上，把 x_G 和这条路径加进 S。",
        "步骤 5：只在 S 上（其它状态当障碍）从 x_G 做 wavefront，得到 φ₁：引导 S 上任意点沿骨架走到目标。",
        "步骤 6：把 S 当成目标区域做 wavefront，得到 φ₂：引导任意状态走到骨架上最近的点 x'。",
        "步骤 7：φ(x) = φ₁(x') + φ₂(x)。沿 φ 下降：先去骨架，再沿骨架，最后到目标。对照虚线的最短路径：它擦着障碍角走。",
      ];
      this.note.textContent = t[this.stepN - 1];
    }
    draw(ctx, st, col) {
      const H = this.H, W = this.W, R = this.R, n = this.stepN, rp = C.ramp(col);
      const shade = (v, mx) => { const q = rp(.08 + .75 * v / (mx || 1)); return `rgb(${q[0]},${q[1]},${q[2]})`; };
      let mx = 0, arr = null;
      if (n === 2 || n === 3 || n === 4) arr = R.d; else if (n === 6) arr = R.phi2; else if (n >= 7) arr = R.phi;
      if (arr) for (let k = 0; k < H * W; k++) if (isFinite(arr[k])) mx = Math.max(mx, arr[k]);
      let mx1 = 0; for (const v of R.phi1.values()) mx1 = Math.max(mx1, v);
      const W0 = new Set(R.W0.map(([r, c]) => r * W + c)), conn = new Set(R.conn);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const k = r * W + c;
        if (!this.free[k]) { C.fillCell(st, H, r, c, C.alpha(col.wall, .85)); continue; }
        let fill = col.surface;
        if (n === 1) fill = W0.has(k) ? col.alive : col.surface;
        else if (n === 5) fill = R.phi1.has(k) ? shade(R.phi1.get(k), mx1) : col.surface2;
        else if (arr && isFinite(arr[k])) fill = shade(arr[k], mx);
        C.fillCell(st, H, r, c, fill);
        if (n >= 3 && n !== 5 && R.S0.has(k)) C.fillCell(st, H, r, c, n === 3 ? col.accent : C.alpha(col.accent, .55), st.scale * .22);
        if (n >= 4 && n !== 5 && conn.has(k)) C.fillCell(st, H, r, c, col.goal, st.scale * .22);
      }
      C.gridLines(st, H, W, C.alpha(col.border, .6));
      const P = (path) => path.map(([r, c]) => ({ x: c + .5, y: H - r - .5 }));
      if (n === 7) {
        if (this.showOpt) st.polyline(P(this.pO), col.muted, 2.2, [5, 4]);
        st.polyline(P(this.pN), col.path, 3);
      }
      st.qmark({ x: this.start[1] + .5, y: H - this.start[0] - .5 }, "I", col);
      st.qmark({ x: this.goal[1] + .5, y: H - this.goal[0] - .5 }, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-openloop']").forEach((el) => el._w = new OpenLoop(el));
    document.querySelectorAll("[data-widget='ch8-grid-navfn']").forEach((el) => el._w = new GridNavFn(el));
    document.querySelectorAll("[data-widget='ch8-wavefront']").forEach((el) => el._w = new Wavefront(el));
    document.querySelectorAll("[data-widget='ch8-nf2']").forEach((el) => el._w = new NF2(el));
  });
})();
