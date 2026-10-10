/* 12.4 节：基于可见性的追逃——在网格上近似维护非确定 I-state E(η_t)（每个阴影分量「清除 / 污染」）、
   例 12.7 的 V(V(p)) 判据、12.4.2 的完整算法（在「位置 × 标签」图上搜索，网格近似） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;

  // 环境：'#' 障碍，'P' 追捕者起点；都是简单连通的
  const PE_ENVS = {
    corridor: { name: "图 12.38 风格：拐角走廊", rows: [
      "##############################",
      "##################.....#######",
      "##################.....#######",
      "##################...#########",
      "##################...#########",
      "#.............................",
      "#............................#",
      "#............................#",
      "#..........P.................#",
      "#............................#",
      "#............................#",
      "##############################",
    ] },
    two: { name: "两条拐两次弯的走廊（有解）", rows: [
      "############################",
      "######...........###########",
      "######...........###########",
      "######..#######..###########",
      "######..#######..###########",
      "######..####..........######",
      "############....P.....######",
      "############..............##",
      "############..............##",
      "########################..##",
      "########################..##",
      "##################........##",
      "##################........##",
      "############################",
      "############################",
    ] },
    three: { name: "三条拐两次弯的走廊（无解，例 12.7）", rows: [
      "############################",
      "######...........###########",
      "######...........###########",
      "######..#######..###########",
      "######..#######..###########",
      "######..####..........######",
      "##..########....P.....######",
      "##..########..............##",
      "##..########..............##",
      "##..########..##########..##",
      "##..########..##########..##",
      "##............####........##",
      "##............####........##",
      "############################",
      "############################",
    ] },
    rooms: { name: "图 12.39 风格：两个贴墙的 T 形障碍", rows: [
      "##############################",
      "#.......##...................#",
      "#.......##...................#",
      "#.......##...................#",
      "#.......##.......########....#",
      "#.......##.......########....#",
      "#....########.......##.......#",
      "#....########.......##.......#",
      "#...................##.......#",
      "#...................##.......#",
      "#.P.................##.......#",
      "#...................##.......#",
      "##############################",
    ] },
    holes: { name: "有洞的环境（多连通）", rows: [
      "##########################",
      "#........................#",
      "#........................#",
      "#........................#",
      "#........########........#",
      "#........########........#",
      "#........########........#",
      "#........########........#",
      "#........................#",
      "#..P.....................#",
      "#........................#",
      "##########################",
    ] },
  };
  // 修正：没有外框的行补成障碍（保证边界封闭）
  for (const e of Object.values(PE_ENVS)) {
    const W = Math.max(...e.rows.map((r) => r.length));
    e.rows = e.rows.map((r, j) => {
      r = r.padEnd(W, "#");
      if (j === 0 || j === e.rows.length - 1) return "#".repeat(W);
      return "#" + r.slice(1, W - 1) + "#";
    });
  }

  class Pursuit {
    constructor(root) {
      this.envKey = "corridor"; this.mode = "play"; this.showCells = false;
      const body = C.frame(root, "可见性追逃：污染 / 清除", "追捕者（蓝）看得见的区域是黄色；看不见的阴影分量要么一定没有逃逸者（绿 = 清除），要么可能有（红 = 污染）");
      this.envSel = C.select(Object.entries(PE_ENVS).map(([k, e]) => [k, e.name]), this.envKey, (k) => { this.envKey = k; this.build(); });
      this.modeSeg = C.seg([["play", "移动追捕者"], ["vv", "例 12.7：放三个点 p₁, p₂, p₃"]], "play", (k) => { this.mode = k; this.vv = []; this.update(); });
      this.runner = new C.Runner(() => this.tick(), () => {});
      this.plot = new C.Plot({ aspect: 0.45, maxW: 760, minW: 280, equal: true, m: { l: 2, r: 2, t: 2, b: 2 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.down(p), onMove: (p, d) => this.drag(p, d), cursor: () => "pointer" });
      this.stats = { n: C.stat("阴影分量"), c: C.stat("其中被污染"), s: C.stat("走过的格子") };
      this.info = h("div", { class: "small" });
      this.solveBtn = C.button("完整算法：自动求解（网格近似）", () => this.solve(), "primary");
      this.cellsCb = C.checkbox("显示信息守恒单元（近似图 12.42）", false, (v) => { this.showCells = v; if (v) this.ensurePre(() => { this.computeCells(); this.update(); }); else this.update(); });
      body.append(h("div", { class: "controls" }, h("label", null, "环境", this.envSel), this.modeSeg),
        h("div", { class: "controls" }, this.solveBtn, C.button("重新开始", () => this.reset()), this.cellsCb),
        this.plot.wrap, h("div", { class: "small muted" }, "点一个格子或拖动：追捕者沿最短格子路径走过去，途中每一步都更新标签。"),
        h("div", { class: "stats" }, ...Object.values(this.stats)), this.info,
        C.legend([[C.cv("robot"), "追捕者", true], [C.cva("vis", 0.5), "V(p(t))"], [C.cva("worst", 0.45), "污染的阴影分量"], [C.cva("best", 0.35), "清除的阴影分量"], [C.cv("cand"), "例 12.7：V(V(pᵢ))"]]));
      this.build();
    }
    build() {
      this.runner.stop();
      const E = (this.E = new C.GridEnv(PE_ENVS[this.envKey].rows));
      this.plot.setAspect(E.H / E.W);
      this.pre = null; this.cellsData = null; this.solveMsg = "";
      const s = E.marks.P ? E.marks.P[0] : [1, 1];
      this.start = E.idx(s[0], s[1]);
      this.reset();
    }
    reset() {
      this.runner.stop(); this.queue = []; this.vv = [];
      this.p = this.start; this.trail = [this.p];
      const V = this.E.visible(this.p);
      this.cont = new Uint8Array(this.E.W * this.E.H);
      for (const c of this.E.cells) if (!V[c]) this.cont[c] = 1;   // 一开始所有阴影都被污染
      this.V = V;
      this.update();
    }
    // 追捕者走到相邻格子 q：新的阴影分量只要与旧的污染区域有重叠就被污染（逃逸者速度无界）
    // 这一条规则同时给出书中的四种情形：出现 → 清除；消失 → 没了；分裂 → 两块继承原标签；合并 → 有一块污染就污染
    stepTo(q) {
      const E = this.E, V2 = E.visible(q), shadow = new Uint8Array(E.W * E.H);
      for (const c of E.cells) if (!V2[c]) shadow[c] = 1;
      const { lab, n } = E.components(shadow);
      const dirty = new Uint8Array(n);
      for (const c of E.cells) if (lab[c] >= 0 && this.cont[c]) dirty[lab[c]] = 1;
      const cont = new Uint8Array(E.W * E.H);
      for (const c of E.cells) if (lab[c] >= 0 && dirty[lab[c]]) cont[c] = 1;
      this.cont = cont; this.V = V2; this.p = q; this.trail.push(q);
    }
    bfsPath(a, b) {
      const E = this.E, prev = new Int32Array(E.W * E.H).fill(-1), q = [a]; prev[a] = a;
      while (q.length) {
        const c = q.shift(); if (c === b) break;
        const [i, j] = E.ij(c);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!E.isFree(i + di, j + dj)) continue; const k = E.idx(i + di, j + dj); if (prev[k] < 0) { prev[k] = c; q.push(k); } }
      }
      if (prev[b] < 0) return [];
      const path = []; for (let c = b; c !== a; c = prev[c]) path.push(c);
      return path.reverse();
    }
    down(p) {
      const k = this.E.cellAt(p); if (k < 0) return null;
      if (this.mode === "vv") { this.vv.push(k); if (this.vv.length > 3) this.vv.shift(); this.ensurePre(() => this.update()); return null; }
      this.queue = this.bfsPath(this.p, k); this.runner.start();
      return { drag: true };
    }
    drag(p) {
      if (this.mode !== "play") return;
      const k = this.E.cellAt(p); if (k < 0) return;
      const last = this.queue.length ? this.queue[this.queue.length - 1] : this.p;
      if (k !== last) { this.queue.push(...this.bfsPath(last, k)); this.runner.start(); }
    }
    tick() {
      if (!this.queue.length) { this.update(); return false; }
      this.stepTo(this.queue.shift());
      if (!this.queue.length || this.queue.length % 2 === 0) this.update();
      return true;
    }
    // ---------- 预计算：每个格子的可见集合与阴影分量（求解 / V(V(p)) / 单元分解用） ----------
    ensurePre(cb) {
      if (this.pre) { cb(); return; }
      this.info.textContent = "正在计算每个格子的可见区域……";
      setTimeout(() => {
        const E = this.E, N = E.W * E.H, vis = new Map(), lab = new Map(), ncomp = new Map();
        for (const c of E.cells) {
          const V = E.visible(c); vis.set(c, V);
          const sh = new Uint8Array(N); for (const k of E.cells) if (!V[k]) sh[k] = 1;
          const r = E.components(sh); lab.set(c, r.lab); ncomp.set(c, r.n);
        }
        this.pre = { vis, lab, ncomp };
        cb();
      }, 20);
    }
    // 从 (c, 标签) 走到相邻格子 c2 后的标签：c2 的第 j 个分量被污染 ⇔ 它与 c 的某个被污染分量重叠
    nextMask(c, mask, c2) {
      const E = this.E, l1 = this.pre.lab.get(c), l2 = this.pre.lab.get(c2), n2 = this.pre.ncomp.get(c2);
      let out = 0;
      for (const k of E.cells) { const j = l2[k]; if (j >= 0 && !(out & (1 << j))) { const i = l1[k]; if (i >= 0 && (mask & (1 << i))) out |= 1 << j; } }
      return out & ((1 << n2) - 1);
    }
    solve() {
      this.runner.stop();
      this.ensurePre(() => {
        const E = this.E, t0 = performance.now();
        // 12.4.2：图 G_I 的顶点 = (位置, 每个阴影分量的标签)；从「全部污染」出发做广度优先搜索，找「全部清除」
        const n0 = this.pre.ncomp.get(this.start), m0 = (1 << n0) - 1;
        const key = (c, m) => c * 4096 + m;
        const prev = new Map([[key(this.start, m0), -1]]), q = [[this.start, m0]];
        let goal = null, expanded = 0;
        while (q.length && expanded < 400000) {
          const [c, m] = q.shift(); expanded++;
          if (m === 0) { goal = [c, m]; break; }
          const [i, j] = E.ij(c);
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (!E.isFree(i + di, j + dj)) continue;
            const c2 = E.idx(i + di, j + dj), m2 = this.nextMask(c, m, c2), k2 = key(c2, m2);
            if (!prev.has(k2)) { prev.set(k2, key(c, m)); q.push([c2, m2]); }
          }
        }
        const ms = Math.round(performance.now() - t0);
        if (!goal) {
          this.solveMsg = `搜索了 G_I 中从起点可达的全部 ${prev.size} 个顶点（${ms} ms），没有一个是「全部清除」：<b>一个追捕者无解</b>。`;
          this.reset(); return;
        }
        const path = []; for (let k = key(goal[0], goal[1]); k !== -1; k = prev.get(k)) path.push(Math.floor(k / 4096));
        path.reverse();
        this.solveMsg = `在 G_I 上广度优先搜索：访问了 ${prev.size} 个（位置, 标签）顶点，${ms} ms；找到一条 ${path.length - 1} 步的路线。`;
        this.reset(); this.solveMsg2 = true;
        this.queue = path.slice(1); this.runner.start();
      });
    }
    computeCells() {
      // 相邻两格之间若阴影分量一一对应（没有出现 / 消失 / 分裂 / 合并），就属于同一个「信息守恒单元」
      const E = this.E, par = new Map(E.cells.map((c) => [c, c])), find = (c) => (par.get(c) === c ? c : (par.set(c, find(par.get(c))), par.get(c)));
      for (const c of E.cells) {
        const [i, j] = E.ij(c);
        for (const [di, dj] of [[1, 0], [0, 1]]) {
          if (!E.isFree(i + di, j + dj)) continue;
          const c2 = E.idx(i + di, j + dj), l1 = this.pre.lab.get(c), l2 = this.pre.lab.get(c2);
          const n1 = this.pre.ncomp.get(c), n2 = this.pre.ncomp.get(c2);
          if (n1 !== n2) continue;
          const map = new Map(); let ok = true;
          for (const k of E.cells) {
            const a = l1[k], b = l2[k];
            if (a >= 0 && b >= 0) { if (map.has(a) && map.get(a) !== b) { ok = false; break; } map.set(a, b); }
          }
          if (ok && map.size === n1 && new Set(map.values()).size === n1) par.set(find(c), find(c2));
        }
      }
      const ids = new Map(); for (const c of E.cells) { const r = find(c); if (!ids.has(r)) ids.set(r, ids.size); }
      this.cellsData = { id: (c) => ids.get(find(c)), n: ids.size };
    }
    update() {
      const E = this.E, shadow = new Uint8Array(E.W * E.H);
      for (const c of E.cells) if (!this.V[c]) shadow[c] = 1;
      const { lab, n } = E.components(shadow);
      const dirty = new Set(); for (const c of E.cells) if (lab[c] >= 0 && this.cont[c]) dirty.add(lab[c]);
      this.lab = lab;
      this.stats.n.set(n); this.stats.c.set(dirty.size); this.stats.s.set(this.trail.length - 1);
      let msg = "";
      if (this.mode === "vv") {
        msg = "例 12.7：点三个位置。若三块 V(V(pᵢ)) 两两不相交（看是否有重叠的橙色），一个追捕者就不可能保证找到逃逸者：他在一处搜索时，逃逸者总能溜到另一处。";
        if (this.vv.length === 3 && this.pre) {
          const VV = this.vv.map((c) => this.VofV(c));
          let disj = true; for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const k of E.cells) if (VV[a][k] && VV[b][k]) disj = false;
          msg += disj ? " <b>两两不相交 ⇒ 一个追捕者无解</b>（习题 14）。" : " 有重叠：这三个点不能证明无解。";
        }
      } else {
        if (dirty.size === 0) msg = `<span class="msg ok" style="display:inline-block">所有阴影分量都已清除：任何逃逸者都一定已经被看见过。</span> `;
        msg += this.solveMsg ? this.solveMsg + " " : "";
        msg += "只有「合并」能把工作撤销（再污染 recontamination）：清除的分量一碰到污染的分量就重新变红。";
        if (this.showCells && this.cellsData) msg += ` 网格上找到 ${this.cellsData.n} 个信息守恒单元：在单元内部绕圈回到原处，标签不变（12.4.2）。`;
      }
      this.info.innerHTML = msg;
      this.plot.draw();
    }
    VofV(c) {
      const E = this.E, V = this.pre.vis.get(c), out = new Uint8Array(E.W * E.H);
      for (const k of E.cells) if (V[k]) { const V2 = this.pre.vis.get(k); for (const m of E.cells) if (V2[m]) out[m] = 1; }
      return out;
    }
    draw(ctx, pl, col) {
      if (!this.E || !this.V) return;
      const E = this.E;
      pl.setRange([0, E.W], [0, E.H]);
      E.draw(pl, col);
      if (this.showCells && this.cellsData) {
        const pal = [col.accent, col.warn, col.ok, col.bad, col.alive2, col.goal, col.mud, col.dead];
        for (const c of E.cells) { const id = this.cellsData.id(c); E.fillCell(pl, c, C.alpha(pal[(id * 3) % pal.length], 0.22 + 0.1 * (Math.floor(id / pal.length) % 3))); }
      }
      if (this.mode === "vv" && this.pre) {
        this.vv.forEach((c) => { const VV = this.VofV(c); for (const k of E.cells) if (VV[k]) E.fillCell(pl, k, C.alpha(col.cand, 0.22)); });
        this.vv.forEach((c, i) => { pl.dot(E.center(c), 6, col.cand, col.surface, 1.5); pl.text("p" + "₁₂₃"[i], { x: E.center(c).x + 0.6, y: E.center(c).y + 0.6 }, col.text, { size: 12, weight: 650 }); });
      } else if (!this.showCells) {
        for (const c of E.cells) {
          if (this.V[c]) E.fillCell(pl, c, C.alpha(col.vis, 0.42));
          else E.fillCell(pl, c, this.cont[c] ? C.alpha(col.worst, 0.42) : C.alpha(col.best, 0.3));
        }
      }
      if (this.mode === "play") {
        pl.path(this.trail.map((c) => E.center(c)), C.alpha(col.robot, 0.7), 2);
        if (this.queue.length) pl.path([E.center(this.p), ...this.queue.map((c) => E.center(c))], C.alpha(col.robot, 0.35), 1.5, [4, 4]);
        pl.dot(E.center(this.p), Math.max(5, pl.S(0.4)), col.robot, col.surface, 1.5);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='pursuit']").forEach((el) => (el._w = new Pursuit(el)));
  });
})();
