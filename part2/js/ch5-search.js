/* 5.4 节：在 C-space 网格上做离散搜索（边在搜索中才做碰撞检测）、随机势场法 */
(function () {
  "use strict";
  const { h, s } = PA;
  const C = CH5;

  // 简单的二叉堆（最小）
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item, key) {
      const a = this.a; a.push({ item, key }); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].key <= a[i].key) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].key < a[m].key) m = l; if (r < a.length && a[r].key < a[m].key) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; }
      }
      return top.item;
    }
  }

  // ---------------------------------------------------------------
  // 组件：网格 + 惰性碰撞检测的 A*（5.4.2 节、图 5.14）
  // ---------------------------------------------------------------
  class GridSearch {
    constructor(root) {
      this.mapKey = "narrow"; this.k = 8; this.nb = 2; this.history = [];
      const body = C.frame(root, "把离散搜索搬到 C-space 网格上", "Sukharev 网格 + A*；顶点和边都在搜索时才做碰撞检测");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.map.qI) < 0.035 ? "qI" : C.dist(p, this.map.qG) < 0.035 ? "qG" : null),
        onMove: (p, d) => { this.map[d] = { x: Math.max(0.01, Math.min(0.99, p.x)), y: Math.max(0.01, Math.min(0.99, p.y)) }; this.solve(); },
        cursor: (p) => (C.dist(p, this.map.qI) < 0.035 || C.dist(p, this.map.qG) < 0.035 ? "grab" : null) });
      this.selMap = C.select(["narrow", "bowl", "maze", "clutter", "tube"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.loadMap(); });
      this.sK = C.slider("每轴点数 k", 2, 64, 1, this.k, (v) => { this.k = v; this.history = []; this.solve(); });
      this.segN = C.seg([["1", "1-邻域（2n = 4 个）"], ["2", "2-邻域（3ⁿ−1 = 8 个）"]], "2", (k) => { this.nb = +k; this.history = []; this.solve(); });
      this.stats = { pts: C.stat("网格点 k²"), exp: C.stat("A* 扩展的顶点"), chk: C.stat("碰撞检测次数"), res: C.stat("结果"), total: C.stat("迭代加密累计检测") };
      this.log = h("div", { class: "small mono", style: "min-height:1.5em" });
      body.append(h("div", { class: "controls" }, this.selMap, this.segN), h("div", { class: "controls" }, this.sK, C.button("迭代加密：k = 2, 3, 4… 直到找到解", () => this.refine(), "small primary")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.log,
          C.legend([[C.cva("accent", 0.8), "被扩展过（已做碰撞检测）", true], [C.cv("bad"), "检测到在 Cobs 里的顶点", true], [C.cv("path"), "解路径"]]))));
      this.loadMap();
    }
    loadMap() { this.map = C.makeMap(this.mapKey); this.history = []; this.solve(); }
    gp(i, j) { return { x: (i + 0.5) / this.k, y: (j + 0.5) / this.k }; }
    // 在当前 k 上跑一次 A*；返回是否找到解
    search(k) {
      const obs = this.map.obs; obs.checks = 0;
      const N = k * k, qI = this.map.qI, qG = this.map.qG;
      const P = (id) => (id === N ? qI : id === N + 1 ? qG : { x: ((id % k) + 0.5) / k, y: (Math.floor(id / k) + 0.5) / k });
      const vFree = new Map(), eFree = new Map();
      const vok = (id) => { if (id >= N) return true; if (!vFree.has(id)) vFree.set(id, obs.pointFree(P(id))); return vFree.get(id); };
      const eok = (a, b) => { const key = a < b ? a + "," + b : b + "," + a; if (!eFree.has(key)) eFree.set(key, obs.firstHit(P(a), P(b)) >= 1); return eFree.get(key); };
      const offs = this.nb === 1 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      const rConn = (this.nb === 1 ? 1 : Math.SQRT2) / k + 1e-9;   // 书中：连到不比最远 k-邻居更远的网格点
      const near = (q) => { const out = []; const i0 = Math.floor(q.x * k), j0 = Math.floor(q.y * k); for (let i = i0 - 2; i <= i0 + 2; i++) for (let j = j0 - 2; j <= j0 + 2; j++) if (i >= 0 && j >= 0 && i < k && j < k && C.dist(q, this.gp(i, j)) <= rConn + 0.5 / k) out.push(j * k + i); return out; };
      const nbrs = (id) => {
        const out = [];
        if (id === N) return near(qI);
        if (id === N + 1) return [];
        const i = id % k, j = Math.floor(id / k);
        for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < k && b < k) out.push(b * k + a); }
        if (C.dist(P(id), qG) <= rConn + 0.5 / k) out.push(N + 1);
        return out;
      };
      const g = new Map([[N, 0]]), parent = new Map(), closed = new Set(), heap = new Heap();
      heap.push(N, C.dist(qI, qG));
      let found = false, expanded = 0;
      while (heap.size) {
        const u = heap.pop(); if (closed.has(u)) continue; closed.add(u); expanded++;
        if (u === N + 1) { found = true; break; }
        if (!vok(u)) continue;
        for (const v of nbrs(u)) {
          if (closed.has(v) || !vok(v)) continue;
          const nd = g.get(u) + C.dist(P(u), P(v));
          if (nd < (g.has(v) ? g.get(v) : Infinity)) {
            if (!eok(u, v)) continue;
            g.set(v, nd); parent.set(v, u); heap.push(v, nd + C.dist(P(v), qG));
          }
        }
      }
      const path = [];
      if (found) { let c = N + 1; while (c !== undefined) { path.push(P(c)); c = parent.get(c); } path.reverse(); }
      return { found, expanded, checks: obs.checks, vFree, path, k, len: found ? g.get(N + 1) : null };
    }
    solve() {
      this.res = this.search(this.k);
      const r = this.res;
      this.stats.pts.set(this.k * this.k); this.stats.exp.set(r.expanded); this.stats.chk.set(r.checks);
      this.stats.res.set(r.found ? `<span class="yes">找到，长 ${r.len.toFixed(3)}</span>` : '<span class="no">此分辨率下无解</span>');
      const tot = this.history.reduce((a, b) => a + b.checks, 0);
      this.stats.total.set(this.history.length ? tot : "—");
      this.st.draw();
    }
    refine() {
      this.history = [];
      for (let k = 2; k <= 64; k++) {
        const r = this.search(k); this.history.push(r);
        if (r.found) { this.k = k; break; }
      }
      this.sK.input.value = this.k; this.sK.refresh();
      this.log.textContent = "k: " + this.history.map((r) => `${r.k}${r.found ? "✓" : "✗"}(${r.checks})`).join(" → ");
      this.solve();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.obstacles(this.map.obs, col);
      const k = this.k, r = this.res;
      const rad = Math.max(1.5, Math.min(4, 120 / k / 6));
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const id = j * k + i, p = this.gp(i, j);
        if (r.vFree.has(id)) st.dot(p, rad + 0.8, r.vFree.get(id) ? C.alpha(col.accent, 0.8) : col.bad);
        else st.dot(p, Math.max(1, rad - 1), C.alpha(col.muted, 0.45));
      }
      if (r.path.length) { for (let i = 0; i + 1 < r.path.length; i++) st.line(r.path[i], r.path[i + 1], col.path, 3); }
      st.qmark(this.map.qI, "I", col); st.qmark(this.map.qG, "G", col);
    }
  }

  // ---------------------------------------------------------------
  // 组件：随机势场法（5.4.3 节、图 5.15 的三状态机、式 5.39 的路径平滑）
  // ---------------------------------------------------------------
  const MODES = { best: "最佳优先 BEST FIRST", walk: "随机游走 RANDOM WALK", back: "回溯 BACKTRACK" };
  class PotentialField {
    constructor(root) {
      this.mapKey = "bowl"; this.K = 20; this.walkMean = 100; this.dq = 0.02; this.speed = 4; this.seed = 7;
      const body = C.frame(root, "随机势场法", "最佳优先下降 g(q)；卡住就随机游走；K 次都不行就回溯");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.map.qI) < 0.035 ? "qI" : C.dist(p, this.map.qG) < 0.035 ? "qG" : null),
        onMove: (p, d) => { this.map[d] = { x: Math.max(0.02, Math.min(0.98, p.x)), y: Math.max(0.02, Math.min(0.98, p.y)) }; this.reset(); },
        cursor: (p) => (C.dist(p, this.map.qI) < 0.035 || C.dist(p, this.map.qG) < 0.035 ? "grab" : null) });
      this.selMap = C.select(["bowl", "clutter", "bugtrap", "narrow", "maze"].map((k) => [k, C.MAPS[k].name]), this.mapKey, (k) => { this.mapKey = k; this.map = C.makeMap(k); this.reset(); });
      this.sK = C.slider("K", 1, 30, 1, this.K, (v) => { this.K = v; });
      this.sW = C.slider("游走步数上限（均值）", 10, 400, 10, this.walkMean, (v) => { this.walkMean = v; });
      this.sSpeed = C.slider("速度", 1, 40, 1, this.speed, (v) => { this.speed = v; });
      this.runner = new C.Runner(() => { for (let i = 0; i < this.speed; i++) if (!this.step()) return false; this.render(); return true; }, () => this.render());
      this.fsm = this.makeFSM();
      this.stats = { it: C.stat("迭代"), v: C.stat("顶点数"), walks: C.stat("随机游走次数"), back: C.stat("回溯次数"), g: C.stat("当前 g(q)"), len: C.stat("路径长度") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selMap, C.button("▶ 运行", () => { if (this.done) this.reset(); this.runner.start(); }, "small primary"), C.button("暂停", () => this.runner.stop(), "small"),
        C.button("单步", () => { this.step(); this.render(); }, "small"), C.button("重置", () => this.reset(), "small"), C.button("路径平滑 (5.39)", () => this.smooth(), "small")),
        h("div", { class: "controls" }, this.sK, this.sW, this.sSpeed),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.fsm.el, h("div", { class: "stats" }, Object.values(this.stats)), this.msg)));
      this.map = C.makeMap(this.mapKey);
      this.reset();
    }
    makeFSM() {
      const svg = s("svg", { viewBox: "0 0 320 190", width: "100%", style: "max-width:340px;display:block" });
      PA.arrowDefs(svg, { "pf-arr": "currentColor" });
      const box = (x, y, w, t) => { const g = s("g"); const r = s("rect", { x, y, width: w, height: 34, rx: 8, fill: "var(--surface-2)", stroke: "var(--border-strong)", "stroke-width": 1.5 }); g.append(r, s("text", { x: x + w / 2, y: y + 22, "text-anchor": "middle", "font-size": 12.5, fill: "var(--text)" }, t)); svg.append(g); return r; };
      const arrow = (d, label, lx, ly) => { svg.append(s("path", { d, fill: "none", stroke: "var(--muted)", "stroke-width": 1.4, "marker-end": "url(#pf-arr)", style: "color:var(--muted)" })); if (label) svg.append(s("text", { x: lx, y: ly, "font-size": 10.5, fill: "var(--muted)", "text-anchor": "middle" }, label)); };
      arrow("M110 20 L110 52", "初始化 i = 1", 160, 26);
      const rb = box(55, 56, 110, "最佳优先");
      const rw = box(205, 56, 108, "随机游走");
      const rk = box(55, 146, 110, "回溯");
      arrow("M165 66 L203 66", "卡住且 i<K", 186, 58);
      arrow("M205 82 C185 104 175 100 165 82", "i 加 1", 192, 112);
      arrow("M95 90 L95 144", "卡住且 i=K", 52, 120);
      arrow("M125 146 L125 92", "i 重置为 1", 170, 124);
      return { el: svg, boxes: { best: rb, walk: rw, back: rk } };
    }
    reset() {
      this.runner && this.runner.stop();
      this.r = C.rng(this.seed = C.newSeed());
      const q = this.snap(this.map.qI);
      this.V = [{ q, parent: -1, walk: false }];
      this.cur = 0; this.mode = "best"; this.i = 1; this.iter = 0; this.walks = 0; this.backs = 0; this.done = false; this.smoothPath = null;
      this.render();
    }
    snap(q) { return { x: Math.round(q.x / this.dq) * this.dq, y: Math.round(q.y / this.dq) * this.dq }; }
    g(q) { return C.dist(q, this.map.qG); }   // 只用吸引项：到目标的欧氏距离
    add(q, walk) { this.V.push({ q, parent: this.cur, walk }); this.cur = this.V.length - 1; }
    step() {
      if (this.done) return false;
      this.iter++;
      const obs = this.map.obs, v = this.V[this.cur].q, dq = this.dq;
      if (this.g(v) < 0.03 && obs.segFree(v, this.map.qG)) { this.V.push({ q: { ...this.map.qG }, parent: this.cur, walk: false }); this.cur = this.V.length - 1; this.done = true; this.runner.stop(); return false; }
      if (this.iter > 60000) { this.done = true; return false; }
      if (this.mode === "best") {
        let best = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const q = { x: v.x + dx * dq, y: v.y + dy * dq };
          if (!obs.pointFree(q) || obs.firstHit(v, q) < 1) continue;
          if (!best || this.g(q) < this.g(best)) best = q;
        }
        if (best && this.g(best) < this.g(v) - 1e-12) { this.add(best, false); return true; }
        // 卡在局部极小
        if (this.i < this.K) { this.mode = "walk"; this.walkStartG = this.g(v); this.walkLeft = Math.max(5, Math.round(this.walkMean * (0.5 + this.r()))); this.walks++; }
        else { this.mode = "back"; }
        return true;
      }
      if (this.mode === "walk") {
        for (let tries = 0; tries < 50; tries++) {
          const q = { x: v.x + (this.r() < 0.5 ? dq : -dq), y: v.y + (this.r() < 0.5 ? dq : -dq) };
          if (obs.pointFree(q) && obs.firstHit(v, q) >= 1) { this.add(q, true); break; }
        }
        this.walkLeft--;
        if (this.g(this.V[this.cur].q) < this.walkStartG - 1e-9 || this.walkLeft <= 0) { this.mode = "best"; this.i++; }
        return true;
      }
      // 回溯：从随机游走得到的顶点里随机挑一个
      const cand = this.V.map((x, k) => (x.walk ? k : -1)).filter((k) => k >= 0);
      if (cand.length) this.cur = cand[Math.floor(this.r() * cand.length)];
      this.backs++; this.i = 1; this.mode = "best";
      return true;
    }
    pathFromTree() { const P = []; let c = this.cur; while (c >= 0) { P.push(this.V[c].q); c = this.V[c].parent; } return P.reverse(); }
    smooth() {
      if (!this.done) { this.msg.innerHTML = "先跑到目标再平滑。"; return; }
      let P = this.smoothPath || this.pathFromTree();
      const obs = this.map.obs;
      const len = (Q) => Q.reduce((s, q, i) => (i ? s + C.dist(Q[i - 1], q) : 0), 0);
      const at = (Q, t) => { const L = len(Q) * t; let acc = 0; for (let i = 1; i < Q.length; i++) { const d = C.dist(Q[i - 1], Q[i]); if (acc + d >= L) return { i, p: C.lerp(Q[i - 1], Q[i], d ? (L - acc) / d : 0) }; acc += d; } return { i: Q.length - 1, p: Q[Q.length - 1] }; };
      const before = len(P);
      for (let it = 0; it < 300; it++) {
        let t1 = this.r(), t2 = this.r(); if (t1 > t2) [t1, t2] = [t2, t1];
        const A = at(P, t1), B = at(P, t2);
        if (B.i - A.i < 1) continue;
        if (obs.segFree(A.p, B.p)) P = P.slice(0, A.i).concat([A.p, B.p], P.slice(B.i));
      }
      this.smoothPath = P;
      this.msg.innerHTML = `随机挑 300 对 t₁ &lt; t₂，用直线段替换 τ([t₁,t₂])（式 5.39），碰撞就放弃：长度 ${before.toFixed(3)} → <b>${len(P).toFixed(3)}</b>。`;
      this.render();
    }
    render() {
      for (const [k, r] of Object.entries(this.fsm.boxes)) { r.setAttribute("fill", k === this.mode && !this.done ? "var(--warn-soft)" : "var(--surface-2)"); r.setAttribute("stroke", k === this.mode && !this.done ? "var(--warn)" : "var(--border-strong)"); }
      this.stats.it.set(this.iter); this.stats.v.set(this.V.length); this.stats.walks.set(this.walks); this.stats.back.set(this.backs);
      this.stats.g.set(this.g(this.V[this.cur].q).toFixed(3));
      const P = this.done ? this.pathFromTree() : null;
      const len = (Q) => Q.reduce((s, q, i) => (i ? s + C.dist(Q[i - 1], q) : 0), 0);
      this.stats.len.set(P ? (this.smoothPath ? len(this.smoothPath) : len(P)).toFixed(3) : "—");
      if (!this.smoothPath) this.msg.innerHTML = this.done ? (this.g(this.V[this.cur].q) < 1e-9 ? '<span class="yes">到达目标。</span>随机游走留下的折线很难看——点「路径平滑」试试。' : "迭代上限（6 万次）到了：势场法在这张图上很难成功——这正是它被更新的方法取代的原因之一。") :
        `当前模式：<b>${MODES[this.mode]}</b>，计数器 i = ${this.i} / K = ${this.K}`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      // 势函数等高线（到目标的距离）
      for (let r = 0.1; r < 1.5; r += 0.1) { ctx.beginPath(); ctx.arc(st.X(this.map.qG.x), st.Y(this.map.qG.y), r * st.scale, 0, 2 * Math.PI); ctx.strokeStyle = C.alpha(col.goal, 0.13); ctx.lineWidth = 1; ctx.stroke(); }
      st.obstacles(this.map.obs, col);
      for (const v of this.V) { const p = v.q; ctx.fillStyle = v.walk ? C.alpha(col.alive2, 0.55) : C.alpha(col.accent, 0.8); ctx.fillRect(st.X(p.x) - 1.3, st.Y(p.y) - 1.3, 2.6, 2.6); }
      if (this.done) { const P = this.pathFromTree(); for (let i = 1; i < P.length; i++) st.line(P[i - 1], P[i], C.alpha(col.path, this.smoothPath ? 0.35 : 1), 2); }
      if (this.smoothPath) { const P = this.smoothPath; for (let i = 1; i < P.length; i++) st.line(P[i - 1], P[i], col.path, 3.2); }
      st.dot(this.V[this.cur].q, 5, col.current, col.surface, 1.5);
      st.qmark(this.map.qI, "I", col); st.qmark(this.map.qG, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='grid-search']").forEach((el) => el._w = new GridSearch(el));
    document.querySelectorAll("[data-widget='potential-field']").forEach((el) => el._w = new PotentialField(el));
  });
})();
