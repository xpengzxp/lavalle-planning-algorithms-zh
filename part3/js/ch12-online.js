/* 12.3.2–12.3.3：未知环境中的导航
   · dstar：Stentz 的 D*（图 12.18、图 12.19）——地形代价在执行中才被感知，cost-to-go 只做局部修补
   · bug：Bug1 / Bug2（图 12.20–12.23，界 (12.25)(12.26)）——只有目标传感器与接触传感器的点机器人
   · lost-cow：竞争比 (12.28) 与迷路的牛（图 12.26，习题 8） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;
  const SQ2 = Math.SQRT2;
  const mod = (a, m) => ((a % m) + m) % m;

  // 组件滚出屏幕时暂停动画，滚回来再接着播（w.runner 是 C.Runner，w.play() 继续播放）
  function pauseOffscreen(root, w) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting && w.runner.running) { w._resume = true; w.runner.stop(); }
        else if (e.isIntersecting && w._resume) { w._resume = false; w.play(); }
      }
    }).observe(root);
  }

  // 用户主动停下（暂停、跳到结尾、拖动……）时，取消「滚回来再继续」
  function halt(w) { w._resume = false; w.runner.stop(); }

  // 二叉堆（最小堆），键为数，值为整数下标；D* 的 Q 与 Dijkstra 共用
  class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v;
      let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, lk = k.pop(), lv = v.pop(), n = k.length;
      if (!n) return;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
  }

  // ===============================================================
  // 组件 1：Stentz 的 D*（图 12.18、图 12.19）
  // ===============================================================
  const DS_W = 60, DS_H = 40, BARRIER = 200;
  const NEW = 0, OPEN = 1, CLOSED = 2;

  // 随机分形地形（多层值噪声，补充）：c(x) ∈ [1, 20] 的整数；中间一圈代价 200 的环形屏障，
  // 左侧敞口、正下方留一条缝——对应图 12.19：「中间极高代价的地形是屏障，向下有一条逃生路线」
  function makeTerrain(seed, W, H) {
    const r = C.rng(seed), n = new Float64Array(W * H);
    let amp = 1;
    for (const cell of [20, 10, 5, 2.5]) {
      const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, g = new Float64Array(gw * gh);
      for (let q = 0; q < g.length; q++) g[q] = r();
      const ox = r() * cell, oy = r() * cell;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const x = (i + ox) / cell, y = (j + oy) / cell, x0 = Math.floor(x), y0 = Math.floor(y);
        let fx = x - x0, fy = y - y0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
        n[j * W + i] += amp * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
      }
      amp *= 0.55;
    }
    let lo = Infinity, hi = -Infinity;
    for (const v of n) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const cost = new Float64Array(W * H);
    const cx = 0.56 * W, cy = H / 2, R = 9;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const t = (n[j * W + i] - lo) / (hi - lo || 1);
      let c = Math.round(1 + 19 * Math.pow(t, 1.7));
      const dx = i + 0.5 - cx, dy = cy - (j + 0.5), rho = Math.hypot(dx, dy), th = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (Math.abs(rho - R) <= 1.3 && Math.abs(th) <= 125 && Math.abs(th + 90) > 10) c = BARRIER;
      cost[j * W + i] = c;
    }
    return cost;
  }

  // D*：k(x) = G_best(x)（键值，x 在 Q 里时见过的最小 cost-to-go），h(x) = G_cur(x)（当前 cost-to-go），b(x) = π(x)（反向指针）
  // 边代价：从 x′ 走进相邻格 x，l(x′, u′) = c(x)（斜走再乘 √2）。c 是机器人「当前以为」的代价表，会被原地修改。
  class DStar {
    constructor(W, H, cost, nbr) {
      this.W = W; this.H = H; this.N = W * H; this.c = cost;
      const K = nbr === 8 ? 8 : 4, N = this.N;
      const off = K === 8 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      this.K = K; this.nb = new Int32Array(N * K).fill(-1); this.nm = new Float64Array(N * K);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) off.forEach(([a, b], q) => {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) return;
        this.nb[(j * W + i) * K + q] = jj * W + ii; this.nm[(j * W + i) * K + q] = a && b ? SQ2 : 1;
      });
      this.hval = new Float64Array(N).fill(Infinity);   // h(x) = G_cur(x)
      this.kval = new Float64Array(N).fill(Infinity);   // k(x) = G_best(x)
      this.b = new Int32Array(N).fill(-1);              // π(x)：指向下一格
      this.tag = new Uint8Array(N);                     // NEW / OPEN（在 Q 中）/ CLOSED（「dead」：访问过、已出 Q）
      this.open = new Heap();
      this.expanded = 0;
      this.log = null;                                  // 记录一次重规划里展开了哪些状态、哪些是 RAISE
    }
    // INSERT：放进 Q，键值 k = min(旧键或旧 h, 新 h)
    insert(x, hn) {
      const t = this.tag[x];
      if (t === NEW) this.kval[x] = hn;
      else if (t === OPEN) this.kval[x] = Math.min(this.kval[x], hn);
      else this.kval[x] = Math.min(this.hval[x], hn);
      this.hval[x] = hn; this.tag[x] = OPEN;
      this.open.push(this.kval[x], x);
    }
    // Q 中键值最小的状态（堆里过期的条目顺手丢掉）
    minState() {
      const H = this.open;
      while (H.size) {
        const kv = H.k[0], x = H.v[0];
        if (this.tag[x] === OPEN && this.kval[x] === kv) return x;
        H.pop();
      }
      return -1;
    }
    kMin() { const x = this.minState(); return x < 0 ? null : this.kval[x]; }
    // 图 12.18 的「一轮」= Stentz 的 PROCESS-STATE；返回之后 Q 的最小键
    process() {
      const { hval: hv, b, tag, c, nb, nm, K } = this;
      // 步骤 1：从 Q 中取出 G_best 最小的 x
      const x = this.minState();
      if (x < 0) return null;
      const kold = this.kval[x];
      this.open.pop(); tag[x] = CLOSED; this.expanded++;
      const raise = kold < hv[x];
      if (this.log) { this.log.exp.push(x); if (raise) this.log.raise.push(x); }
      // 步骤 2：G_best(x) < G_cur(x)（RAISE：x 在 Q 中时代价升高了）。
      //   对每个 u，x′ = f(x, u)：若 G_via(x, x′) < G_cur(x) 且 G_cur(x′) ≤ G_best(x)（x′ 的 cost-to-go 已是最优），就改走 x′
      if (raise) {
        for (let q = 0; q < K; q++) {
          const y = nb[x * K + q]; if (y < 0) continue;
          const via = hv[y] + c[y] * nm[x * K + q];
          if (tag[y] !== NEW && hv[y] <= kold && hv[x] > via) { b[x] = y; hv[x] = via; }
        }
      }
      // 步骤 3–6：对每个能一步走到 x 的 x′（u′ 使 x = f(x′, u′)），G_via(x′, x) = G_cur(x) + c(x)
      for (let q = 0; q < K; q++) {
        const y = nb[x * K + q]; if (y < 0) continue;
        const via = hv[x] + c[x] * nm[x * K + q], t = tag[y];
        if (kold === hv[x]) {
          // LOWER（G_cur(x) = G_best(x)，x 的最优 cost-to-go 已知）：
          //   步骤 3 x′ 未访问；步骤 4 π(x′) = u′ 但 G_via ≠ G_cur(x′)；步骤 5 π(x′) ≠ u′ 但经 x 更好 → π(x′) := u′，x′ 以 G_via 入 Q
          if (t === NEW || (b[y] === x && hv[y] !== via) || (b[y] !== x && hv[y] > via)) { b[y] = x; this.insert(y, via); }
        } else {
          // RAISE：
          if (t === NEW || (b[y] === x && hv[y] !== via)) { b[y] = x; this.insert(y, via); }   // 步骤 3、4：代价升高沿 π 往外传
          else if (b[y] !== x && hv[y] > via) this.insert(x, hv[x]);                         // 步骤 5「否则」：把 x 自己以 G_cur(x) 放回 Q
          else if (b[y] !== x && hv[x] > hv[y] + c[y] * nm[x * K + q] && t === CLOSED && hv[y] > kold) this.insert(y, hv[y]);
          // ↑ 步骤 6：x′ 已 dead，π(x′) ≠ u′，G_via(x, x′) < G_cur(x) → x′ 以 G_cur(x′) 放回 Q，避免出环。
          //   最后一个条件按 Stentz 原文 h(Y) > k_old，即 G_cur(x′) > G_best(x)；图 12.18 写作 G_cur(x) > G_best(x)
        }
      }
      return this.kMin();
    }
    // MODIFY-COST：格 x 的代价变了 ⇒ 所有走进 x 的边都变了；若 x 已 dead，就以 G_cur(x) 放回 Q（键值 min(h, h) = h）
    modifyCost(x) { if (this.tag[x] === CLOSED) this.insert(x, this.hval[x]); }
    // 反复执行 PROCESS-STATE，直到 Q 中最小的 G_best ≥ G_cur(x_k)（书中：对所有 x ∈ Q，G_cur(x_k) ≤ G_best(x)）
    replan(xr) {
      for (;;) {
        const km = this.kMin();
        if (km === null || (this.tag[xr] !== NEW && km >= this.hval[xr])) return;
        this.process();
      }
    }
  }

  // 反向 Dijkstra（从目标出发），到 target 出队即停；返回 d、展开数、parent（可选）
  function dijkstraBack(ds, cost, goal, target) {
    const { N, nb, nm, K } = ds;
    const d = new Float64Array(N).fill(Infinity), done = new Uint8Array(N), par = new Int32Array(N).fill(-1), pq = new Heap();
    d[goal] = 0; pq.push(0, goal);
    let n = 0;
    while (pq.size) {
      const dv = pq.k[0], x = pq.v[0]; pq.pop();
      if (done[x]) continue;
      done[x] = 1; n++;
      if (x === target) break;
      for (let q = 0; q < K; q++) {
        const y = nb[x * K + q]; if (y < 0 || done[y]) continue;
        const nd = dv + cost[x] * nm[x * K + q];
        if (nd < d[y]) { d[y] = nd; par[y] = x; pq.push(nd, y); }
      }
    }
    return { d, n, par };
  }

  class DStarDemo {
    constructor(root) {
      this.W = DS_W; this.H = DS_H; this.N = this.W * this.H;
      this.start = (this.H >> 1) * this.W; this.goal = (this.H >> 1) * this.W + this.W - 1;
      this.nbr = 8; this.radius = 3; this.speed = 12; this.showTruth = false; this.check = true; this.hover = -1;
      this.off = document.createElement("canvas"); this.off.width = this.W * 6; this.off.height = this.H * 6;
      this.offCtx = this.off.getContext("2d"); this.offKey = ""; this.ver = 0;
      const body = C.frame(root, "Stentz 的 D*：边走边发现代价", "图 12.18、图 12.19 · cost-to-go 只在代价变化处局部修补");
      this.runner = new C.Runner(() => this.tick(), () => this.render());
      this.plot = new C.Plot({ x: [0, this.W], y: [0, this.H], equal: true, aspect: this.H / this.W, maxW: 820, minW: 240,
        m: { l: 2, r: 2, t: 2, b: 2 }, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col),
        onHover: (p) => this.hoverAt(p), onLeave: () => this.hoverAt(null) });
      this.btnRun = C.button("运行", () => this.play(), "small primary");
      this.segN = C.seg([["4", "4 邻接"], ["8", "8 邻接（斜走 ×√2）"]], "8", (k) => { this.nbr = +k; this.reset(); });
      this.sR = C.slider("感知半径 r", 1, 6, 1, this.radius, (v) => { this.radius = v; this.reset(); });
      this.sV = C.slider("速度", 1, 40, 1, this.speed, (v) => { this.speed = v; }, (v) => v + " 步/秒");
      this.cbTruth = C.checkbox("显示真实地形", false, (v) => { this.showTruth = v; this.plot.draw(); });
      this.cbCheck = C.checkbox("核对：每次重规划后与 Dijkstra 比较", true, (v) => { this.check = v; this.render(); });
      this.st = { k: C.stat("阶段 k"), rep: C.stat("重规划次数"), exp: C.stat("D* 展开（累计）"), dij: C.stat("每次从头反向 Dijkstra（累计）"),
        cost: C.stat("已走代价 / 全知最优"), hx: C.stat("G_cur(x_k) = h(x_k)"), chk: C.stat("核对") };
      this.hoverLine = h("div", { class: "status-line small", style: "min-height:2.9em;margin-top:6px" });
      this.msg = h("div", { class: "small", style: "margin-top:4px" });
      body.append(
        h("div", { class: "controls" }, C.button("单步", () => { halt(this); this.stage(); this.render(); }, "small"), this.btnRun,
          C.button("暂停", () => halt(this), "small"), C.button("重置", () => this.reset(), "small"),
          C.button("新地形", () => this.newTerrain(), "small"), h("span", { class: "sep" }), this.segN),
        h("div", { class: "controls" }, this.sR, this.sV, this.cbTruth, this.cbCheck),
        this.plot.wrap, this.hoverLine,
        h("div", { class: "stats" }, Object.values(this.st)), this.msg,
        C.legend([[C.cva("obst", 0.75), "已感知的地形（越重代价越高）"], [C.cva("muted", 0.18), "未感知（斜线；机器人假设 c = 1）"],
          [C.cv("robot"), "规划路径（虚线）/ 机器人"], [C.cv("best"), "已走路径"], [C.cv("goal"), "目标 x_G", true],
          [C.cv("cand"), "Q（OPEN）中的状态", true], [C.cv("worst"), "RAISE 状态", true], [C.cva("cand", 0.3), "上次重规划展开过的状态"]]),
        h("div", { class: "small", style: "margin-top:10px", html:
          "<p style=\"margin:0 0 6px\">机器人从左边中点出发去右边中点。它一开始<b>假设每格代价都是 1</b>（书中：平坦地面的代价可以统一假设），只能感知半径 r 内各格的真实代价 c(x)。每个阶段：" +
          "① 感知，代价与假设不符的格子调用 MODIFY-COST——走进这一格的边 l(x′, u′) = c(x) 全变了，若它已 dead（访问过、不在 Q 中）就以 G_cur 放回 Q；" +
          "② 反复执行图 12.18 的一轮，直到 Q 中最小的 G_best ≥ G_cur(x_k)；③ 沿 π(x_k) 走一步。</p>" +
          "<p style=\"margin:0\">绿色的已走路径是<b>一串最优路径</b>拼起来的：每一步都是「根据当时已知的代价算出的最优路径」的第一步。" +
          "<span class=\"muted\">补充：地形由多层值噪声生成，c(x) ∈ [1, 20]，环形屏障代价 200；感知范围取格心距离 ≤ r + ½ 的格子。" +
          "对照的 Dijkstra 每次在当前已知代价上从 x_G 重新做、x_k 出队即停；两列展开数都含初始规划。</span></p>" }));
      pauseOffscreen(root, this);
      this.newTerrain(40);
    }
    newTerrain(seed) {
      this.seed = seed === undefined ? C.newSeed() : seed;
      this.truth = makeTerrain(this.seed, this.W, this.H);
      this.truth[this.start] = this.truth[this.goal] = 1;
      this.reset();
    }
    reset() {
      halt(this);
      const { N, start, goal } = this;
      this.known = new Float64Array(N).fill(1);
      this.seen = new Uint8Array(N);
      this.ds = new DStar(this.W, this.H, this.known, this.nbr);
      // 全知最优：在真实代价上做一次完整的反向 Dijkstra
      const full = dijkstraBack(this.ds, this.truth, goal, -1);
      this.optCost = full.d[start];
      this.optPath = [start]; for (let y = start, g = 0; y !== goal && g < N; g++) { y = full.par[y]; this.optPath.push(y); }
      // 初始规划：所有格子都按 c = 1，从 x_G 往外扩展，直到 x_I 出 Q 且 Q 中最小键 ≥ h(x_I)
      const ds = this.ds;
      ds.log = { exp: [], raise: [] };
      ds.insert(goal, 0);
      for (;;) {
        const km = ds.kMin();
        if (km === null || (ds.tag[start] === CLOSED && km >= ds.hval[start])) break;
        ds.process();
      }
      this.lastLog = ds.log; ds.log = null;
      this.dijTotal = dijkstraBack(ds, this.known, goal, start).n;
      this.x = start; this.exec = [start]; this.steps = 0; this.replans = 0; this.cost = 0; this.done = false;
      this.checks = { ok: 0, bad: 0, last: null };
      this.ver++;
      this.render();
    }
    // 感知：格心距离 ≤ r + ½ 的格子换成真实代价，返回代价变了的格子
    sense(x) {
      const W = this.W, i0 = x % W, j0 = (x / W) | 0, R = this.radius + 0.5, changed = [];
      for (let j = Math.max(0, j0 - this.radius); j <= Math.min(this.H - 1, j0 + this.radius); j++)
        for (let i = Math.max(0, i0 - this.radius); i <= Math.min(W - 1, i0 + this.radius); i++) {
          if ((i - i0) ** 2 + (j - j0) ** 2 > R * R) continue;
          const k = j * W + i;
          if (!this.seen[k]) { this.seen[k] = 1; this.ver++; }
          if (this.known[k] !== this.truth[k]) { this.known[k] = this.truth[k]; changed.push(k); }
        }
      return changed;
    }
    mult(a, b) { const W = this.W; return a % W !== b % W && ((a / W) | 0) !== ((b / W) | 0) ? SQ2 : 1; }
    // 一个阶段：感知 →（必要时）重规划 → 沿 π 走一步。到达目标后返回 false
    stage() {
      if (this.done) return false;
      const x = this.x, ds = this.ds;
      const changed = this.sense(x);
      if (changed.length) {
        this.replans++;
        ds.log = { exp: [], raise: [] };
        for (const c of changed) ds.modifyCost(c);
        ds.replan(x);
        this.lastLog = ds.log; ds.log = null;
        const r = dijkstraBack(ds, this.known, this.goal, x);   // 对照：每次都从头做反向 Dijkstra
        this.dijTotal += r.n;
        if (this.check) this.verify(x, r.d[x]);
      }
      const y = ds.b[x];
      if (y < 0) { this.done = true; return false; }
      this.cost += this.truth[y] * this.mult(x, y);
      this.x = y; this.exec.push(y); this.steps++;
      if (y === this.goal || this.steps > 4 * this.N) this.done = true;
      return !this.done;
    }
    // 核对：h(x_k) 与沿 π 走到目标的代价都应等于在当前已知代价上重新做 Dijkstra 的结果
    verify(x, dij) {
      const ds = this.ds;
      let tot = 0;
      for (let y = x, g = 0; y !== this.goal; g++) {
        const z = ds.b[y];
        if (z < 0 || g > this.N) { tot = NaN; break; }
        tot += this.known[z] * this.mult(y, z); y = z;
      }
      const tol = 1e-7 * Math.max(1, dij);
      if (Math.abs(ds.hval[x] - dij) < tol && Math.abs(tot - dij) < tol) this.checks.ok++;
      else { this.checks.bad++; this.checks.last = { k: this.steps, h: ds.hval[x], dij, tot }; }
    }
    play() {
      if (this.done) return;
      this.last = performance.now(); this.acc = 1;
      this.runner.start(); this.render();
    }
    tick() {
      const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now; this.acc += dt * this.speed;
      let n = 0, more = !this.done;
      while (this.acc >= 1 && n < 30 && more) { this.acc -= 1; n++; more = this.stage(); }
      if (n) this.render();
      return more;
    }
    planned() {
      const out = [this.x], ds = this.ds;
      for (let y = this.x, g = 0; y !== this.goal && g < this.N; g++) { y = ds.b[y]; if (y < 0) break; out.push(y); }
      return out;
    }
    hoverAt(p) {
      this.hover = -1;
      if (p) {
        const i = Math.floor(p.x), j = this.H - 1 - Math.floor(p.y);
        if (i >= 0 && j >= 0 && i < this.W && j < this.H) this.hover = j * this.W + i;
      }
      this.updateHover(); this.plot.draw();
    }
    updateHover() {
      const k = this.hover, ds = this.ds;
      if (k < 0) { this.hoverLine.innerHTML = "<span class=\"muted\">把鼠标移到某一格上，查看它的 c(x)、G_cur = h、G_best = k 与 π。</span>"; return; }
      const ij = (z) => `(${z % this.W}, ${(z / this.W) | 0})`;
      const t = ds.tag[k], hv = ds.hval[k], kv = ds.kval[k];
      const state = t === NEW ? "NEW（还没被访问过）" : t === OPEN ? `在 Q 中（${kv < hv ? "<b style=\"color:var(--bad)\">RAISE</b>：G_best &lt; G_cur" : "LOWER：G_best = G_cur"}）` : "dead（访问过、已出 Q）";
      this.hoverLine.innerHTML = `格 ${ij(k)}：真实 c = <b>${this.truth[k]}</b>，机器人以为 c = <b>${this.known[k]}</b>${this.seen[k] ? "（已感知）" : "（未感知，按 1 算）"}；` +
        `G_cur = h = <b>${C.fmtD(hv, 2)}</b>，G_best = k = <b>${C.fmtD(kv, 2)}</b>；${state}${ds.b[k] >= 0 ? `；π 指向 ${ij(ds.b[k])}` : ""}`;
    }
    render() {
      const ds = this.ds, st = this.st;
      st.k.set(this.steps); st.rep.set(this.replans); st.exp.set(ds.expanded); st.dij.set(this.dijTotal);
      st.cost.set(`${C.fmtD(this.cost, 1)} / ${C.fmtD(this.optCost, 1)}`);
      st.hx.set(C.fmtD(ds.hval[this.x], 2));
      const ck = this.checks;
      st.chk.set(!this.check ? "<span class=\"muted\">关闭</span>" : ck.bad ? `<span class="no">✗ ${ck.bad}</span>` : `<span class="yes">✓ ${ck.ok}/${ck.ok}</span>`);
      this.btnRun.disabled = this.done || this.runner.running;
      const lg = this.lastLog;
      let m = `上次重规划展开了 <b>${lg.exp.length}</b> 个状态（其中 RAISE <b>${lg.raise.length}</b> 个）。`;
      if (this.check && ck.bad) m += ` <span class="no">核对失败（阶段 ${ck.last.k}）：h = ${ck.last.h}，Dijkstra = ${ck.last.dij}，沿 π = ${ck.last.tot}</span>`;
      if (this.done && this.x === this.goal)
        m += ` <b>到达目标</b>：执行代价 ${C.fmtD(this.cost, 1)}，是全知最优 ${C.fmtD(this.optCost, 1)} 的 ${(this.cost / this.optCost).toFixed(2)} 倍；` +
          `D* 共展开 ${ds.expanded} 个状态，每次从头做 Dijkstra 要 ${this.dijTotal} 个（约 ${(this.dijTotal / Math.max(1, ds.expanded)).toFixed(1)} 倍）。`;
      this.msg.innerHTML = m;
      this.updateHover();
      this.plot.draw();
    }
    // 地形画进离屏画布（每格 6×6 像素，未感知的格子加斜线）；颜色或已知信息变化时才重画
    paintTerrain(col) {
      const key = [col.surface, col.obst, col.muted, this.showTruth, this.ver].join("|");
      if (key === this.offKey) return;
      this.offKey = key;
      const S = 6, W = this.W, H = this.H, img = this.offCtx.createImageData(W * S, H * S), d = img.data;
      const bg = C.rgb(col.surface), ob = C.rgb(col.obst), mu = C.rgb(col.muted);
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      // 灰度：c = 1…20 对数映射到 6%…72%，屏障（c = 200）取障碍色本身
      const tval = (c) => (c >= BARRIER ? 1 : 0.06 + (0.66 * Math.log(c)) / Math.log(20));
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i, tv = tval(this.truth[k]);
        let base, hatch = null;
        if (this.seen[k]) base = lerp(bg, ob, tv);
        else if (this.showTruth) { base = lerp(bg, ob, 0.5 * tv); hatch = lerp(base, mu, 0.45); }
        else { base = lerp(bg, mu, 0.06); hatch = lerp(bg, mu, 0.3); }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const c = hatch && (x + y) % S === 0 ? hatch : base, p = ((j * S + y) * W * S + i * S + x) * 4;
          d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
        }
      }
      this.offCtx.putImageData(img, 0, 0);
    }
    draw(ctx, pl, col) {
      if (!this.ds) return;
      this.paintTerrain(col);
      const W = this.W, X0 = pl.X(0), Y0 = pl.Y(this.H), s = pl.S(1), ww = s * W, hh = s * this.H, ds = this.ds;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.off, X0, Y0, ww, hh); ctx.restore();
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(X0 + 0.5, Y0 + 0.5, ww - 1, hh - 1);
      const px = (k) => X0 + ((k % W) + 0.5) * s, py = (k) => Y0 + (((k / W) | 0) + 0.5) * s;
      const cell = (k) => ctx.fillRect(X0 + (k % W) * s, Y0 + ((k / W) | 0) * s, s, s);
      const line = (list, color, lw, dash) => {
        if (list.length < 2) return;
        ctx.beginPath(); list.forEach((k, i) => (i ? ctx.lineTo(px(k), py(k)) : ctx.moveTo(px(k), py(k))));
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); ctx.setLineDash([]);
      };
      // 上次重规划展开过的状态
      const lg = this.lastLog;
      ctx.fillStyle = C.alpha(col.cand, 0.15); for (const k of lg.exp) cell(k);
      ctx.fillStyle = C.alpha(col.worst, 0.3); for (const k of lg.raise) cell(k);
      // 全知最优路径（只在「显示真实地形」时）
      if (this.showTruth) line(this.optPath, C.alpha(col.text, 0.55), 1.5, [2, 4]);
      // Q 中的状态：橙 = LOWER，红 = RAISE
      const r0 = Math.max(1.1, s * 0.15);
      for (let k = 0; k < this.N; k++) if (ds.tag[k] === OPEN) {
        const rs = ds.kval[k] < ds.hval[k];
        ctx.beginPath(); ctx.arc(px(k), py(k), r0, 0, 2 * Math.PI); ctx.fillStyle = rs ? col.worst : col.cand; ctx.fill();
      }
      // 规划路径、已走路径
      line(this.planned(), col.robot, Math.max(1.5, s * 0.22), [5, 4]);
      line(this.exec, col.best, Math.max(2, s * 0.32));
      // 感知范围
      ctx.beginPath(); ctx.arc(px(this.x), py(this.x), (this.radius + 0.5) * s, 0, 2 * Math.PI);
      ctx.fillStyle = C.alpha(col.robot, 0.06); ctx.fill(); ctx.strokeStyle = C.alpha(col.robot, 0.7); ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      // 起点、目标、机器人
      const dot = (k, r, fill, stroke, lw) => { ctx.beginPath(); ctx.arc(px(k), py(k), r, 0, 2 * Math.PI); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); } };
      const R = Math.max(4, s * 0.55);
      dot(this.start, R, col.surface, col.robot, 2);
      dot(this.goal, R, col.goal, col.surface, 1.5);
      dot(this.x, R * 0.95, col.robot, col.surface, 1.8);
      ctx.font = pl.font(11.5, 650); ctx.textBaseline = "middle";
      ctx.fillStyle = col.robot; ctx.textAlign = "left"; ctx.fillText("x_I", px(this.start) + R + 3, py(this.start) - R - 7);
      ctx.fillStyle = col.goal; ctx.textAlign = "right"; ctx.fillText("x_G", px(this.goal) - R - 3, py(this.goal) - R - 7);
      if (this.hover >= 0) { ctx.strokeStyle = col.text; ctx.lineWidth = 1.5; ctx.strokeRect(X0 + (this.hover % W) * s, Y0 + ((this.hover / W) | 0) * s, s, s); }
    }
  }

  // ===============================================================
  // 组件 2：Bug1 / Bug2（图 12.20–12.23）
  // ===============================================================
  // 场景：每个障碍是若干条边界环（第一条外边界，其余是洞）；坐标 y 向上
  const pts = (arr) => arr.map(([x, y]) => ({ x, y }));
  const diamond = (cx, cy, a) => pts([[cx - a, cy], [cx, cy - a], [cx + a, cy], [cx, cy + a]]);
  const rectP = (x0, y0, x1, y1) => pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const BUG_SCENES = {
    fig20: {
      name: "图 12.20 风格", view: [[0, 22.4], [0.2, 14.4]], xI: { x: 1.25, y: 8.9 }, xG: { x: 21, y: 8.9 },
      obs: [[pts([[3.0, 12.5], [5.5, 13.6], [7.5, 12.9], [6.5, 11.1], [9.25, 9.25], [8.75, 7.0], [13.75, 5.75], [13.75, 4.25], [7.25, 3.75], [1.75, 6.0], [3.9, 9.25]])],
        [pts([[14.0, 11.25], [16.25, 11.25], [21.5, 6.25], [19.0, 1.4], [13.5, 1.0], [13.25, 2.25], [17.5, 3.9], [17.75, 7.5], [14.6, 10.15]])]],
    },
    diamonds: {
      name: "图 12.21：Bug1 的坏例子", view: [[0, 20], [0, 8]], xI: { x: 0.8, y: 4 }, xG: { x: 19.2, y: 4 },
      obs: [[diamond(5.5, 4, 2.5)], [diamond(14.5, 4, 2.5)]],
    },
    comb: {
      name: "图 12.23：Bug2 的坏例子", view: [[-1, 41.5], [-1.5, 13.5]], xI: { x: 4, y: 6 }, xG: { x: 40, y: 6 },
      obs: [[pts([[0, 0], [31, 0], [31, 7.5], [29.5, 7.5], [29.5, 1.5], [20, 1.5], [20, 7.5], [18.5, 7.5], [18.5, 1.5], [9.5, 1.5], [9.5, 7.5], [8, 7.5],
        [8, 1.5], [1.5, 1.5], [1.5, 10.5], [13, 10.5], [13, 4.5], [14.5, 4.5], [14.5, 10.5], [24, 10.5], [24, 4.5], [25.5, 4.5], [25.5, 10.5], [35.5, 10.5],
        [35.5, 4.5], [37, 4.5], [37, 12], [0, 12]])]],
    },
    enclosed: {
      name: "不可达", view: [[0, 21], [0, 12]], xI: { x: 2, y: 6 }, xG: { x: 15, y: 6 },
      obs: [[rectP(9, 1, 19, 11), rectP(12, 3.5, 17, 8.5)], [pts([[4.2, 8.6], [6.2, 7.6], [5.6, 10.4]])]],
    },
  };

  // 预处理：外边界取逆时针、洞取顺时针，于是「障碍内部总在环的左手边」；顺时针走 = s 递减 = 障碍在机器人右手边
  function prepScene(def) {
    const S = { def, obs: [], loops: [], segs: [], verts: [] };
    def.obs.forEach((loops, oi) => {
      const o = { loops: [], perim: 0 };
      loops.forEach((P0, li) => {
        let P = P0.map((p) => ({ x: p.x, y: p.y }));
        if ((C.polyArea(P) > 0) !== (li === 0)) P = P.reverse();
        const n = P.length, cum = [0], len = [];
        for (let i = 0; i < n; i++) { len.push(C.dist(P[i], P[(i + 1) % n])); cum.push(cum[i] + len[i]); }
        const L = { pts: P, cum, len, P: cum[n], obs: oi, n, idx: S.loops.length };
        o.loops.push(L); S.loops.push(L); o.perim += L.P;
        for (let i = 0; i < n; i++) S.segs.push([P[i], P[(i + 1) % n]]);
        S.verts.push(...P);
      });
      S.obs.push(o);
    });
    return S;
  }
  const boundaryDist = (S, p) => { let d = Infinity; for (const [a, b] of S.segs) d = Math.min(d, C.distPointSeg(p, a, b).d); return d; };
  const inObs = (o, p) => C.inPoly(p, o.loops[0].pts) && !o.loops.slice(1).some((L) => C.inPoly(p, L.pts));
  // p 在哪个障碍的内部（边界上算自由空间）；不在任何障碍内返回 −1
  function insideAny(S, p) {
    for (let i = 0; i < S.obs.length; i++) if (inObs(S.obs[i], p)) return boundaryDist(S, p) > 1e-9 ? i : -1;
    return -1;
  }
  // 线段 p→g 与一组边的所有接触参数 t（含共线重叠的端点），排序去重
  function cutParams(p, g, segs) {
    const ts = [0, 1], d = C.sub2(g, p), len = Math.hypot(d.x, d.y);
    for (const [a, b] of segs) {
      const t = C.segX(p, g, a, b);
      if (t !== null) ts.push(Math.max(0, Math.min(1, t)));
      else if (Math.abs(C.cross(d, C.sub2(b, a))) < 1e-12 * len * C.dist(a, b) + 1e-15 && Math.abs(C.cross(C.sub2(a, p), d)) < 1e-9 * len) {
        for (const q of [a, b]) { const t2 = ((q.x - p.x) * d.x + (q.y - p.y) * d.y) / (len * len); if (t2 > 0 && t2 < 1) ts.push(t2); }
      }
    }
    ts.sort((a, b) => a - b);
    const out = [ts[0]];
    for (const t of ts) if ((t - out[out.length - 1]) * len > 1e-9) out.push(t);
    if (out[out.length - 1] !== 1) out[out.length - 1] = 1;
    return out;
  }
  // 第 1 步「朝目标直走」：解析地求出第一次要钻进障碍的位置。逐段检查相邻交点之间的中点是否在障碍内部，
  // 这样擦过顶点、沿边滑行都不会误判为碰撞。blocked = 一出发就钻进障碍（朝目标的方向指向障碍内部）
  function toGoal(S, p, g) {
    if (C.dist(p, g) < 1e-12) return { reached: true, q: g };
    const ts = cutParams(p, g, S.segs), at = (t) => ({ x: p.x + (g.x - p.x) * t, y: p.y + (g.y - p.y) * t });
    for (let i = 0; i + 1 < ts.length; i++) {
      const o = insideAny(S, at((ts[i] + ts[i + 1]) / 2));
      if (o >= 0) return i === 0 ? { blocked: true, q: p, obs: o } : { hit: true, q: at(ts[i]), obs: o };
    }
    return { reached: true, q: g };
  }
  // 边界上的点 q 属于障碍 obs 的哪条环、弧长位置 s（从顶点 0 沿逆时针量）
  function locate(S, obs, q) {
    let best = { d: Infinity };
    for (const L of S.obs[obs].loops) for (let e = 0; e < L.n; e++) {
      const r = C.distPointSeg(q, L.pts[e], L.pts[(e + 1) % L.n]);
      if (r.d < best.d) best = { d: r.d, L, s: mod(L.cum[e] + r.t * L.len[e], L.P) };
    }
    return best;
  }
  function pointAt(L, s) {
    s = mod(s, L.P);
    let e = 0; while (e < L.n - 1 && L.cum[e + 1] <= s) e++;
    const t = L.len[e] ? (s - L.cum[e]) / L.len[e] : 0, a = L.pts[e], b = L.pts[(e + 1) % L.n];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  // 沿环走 len 的长度：dir = −1 顺时针（障碍在右手边，「左转」后的方向），+1 逆时针；返回途经的顶点和终点
  function walk(L, s0, len, dir) {
    const out = [];
    if (len < 1e-12) return out;
    const end = s0 + dir * len;
    if (dir < 0) { for (let w = 0; w <= 3; w++) for (let v = L.n - 1; v >= 0; v--) { const a = L.cum[v] - w * L.P; if (a < s0 - 1e-12 && a > end + 1e-12) out.push(L.pts[v]); } }
    else { for (let w = 0; w <= 3; w++) for (let v = 0; v < L.n; v++) { const a = L.cum[v] + w * L.P; if (a > s0 + 1e-12 && a < end - 1e-12) out.push(L.pts[v]); } }
    out.push(pointAt(L, end));
    return out;
  }
  // 线段 a→b 穿过障碍 o 的边界几次（进出各算一次）
  function crossings(S, o, a, b) {
    const segs = [];
    for (const L of o.loops) for (let i = 0; i < L.n; i++) segs.push([L.pts[i], L.pts[(i + 1) % L.n]]);
    const ts = cutParams(a, b, segs);
    let inside = false, cnt = 0;
    for (let i = 0; i + 1 < ts.length; i++) {
      const t = (ts[i] + ts[i + 1]) / 2, m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const inn = inObs(o, m) && boundaryDist(S, m) > 1e-9;
      if (inn !== inside) { cnt++; inside = inn; }
    }
    return cnt + (inside ? 1 : 0);
  }

  // Bug1：① 朝目标走；② 碰到障碍就「左转」沿边界走完整一圈（目标传感器读数重复 ⇒ 绕回了碰撞点），
  //       再沿较短的一侧回到边界上离目标最近的点，回到 ①。若在该点朝目标的方向指向障碍内部 ⇒ 目标不可达
  function bug1(S, xI, xG) {
    const path = [xI], ev = [], walked = S.loops.map(() => 0);
    let p = xI;
    for (let it = 0; it < 80; it++) {
      const m = toGoal(S, p, xG);
      if (m.reached) { path.push(xG); return { path, ev, walked, result: "goal" }; }
      if (m.blocked) return { path, ev, walked, result: "unreachable" };
      path.push(m.q); ev.push({ type: "H", idx: path.length - 1, p: m.q });
      const { L, s: s0 } = locate(S, m.obs, m.q);
      path.push(...walk(L, s0, L.P, -1));
      path[path.length - 1] = m.q;
      walked[L.idx] += L.P;
      // 整圈边界上离目标最近的点；并列时取顺时针最先遇到的
      let best = Infinity, sL = s0, aL = 0;
      for (let e = 0; e < L.n; e++) {
        const r = C.distPointSeg(xG, L.pts[e], L.pts[(e + 1) % L.n]), s = mod(L.cum[e] + r.t * L.len[e], L.P), a = mod(s0 - s, L.P);
        if (r.d < best - 1e-9 || (Math.abs(r.d - best) <= 1e-9 && a < aL)) { best = r.d; sL = s; aL = a; }
      }
      // 机器人记得沿边界回去的较短一侧（(12.25) 的 3/2 依赖这一点）
      if (aL <= L.P - aL) path.push(...walk(L, s0, aL, -1)); else path.push(...walk(L, s0, L.P - aL, +1));
      walked[L.idx] += Math.min(aL, L.P - aL);
      p = pointAt(L, sL);
      if (path.length) path[path.length - 1] = p;
      ev.push({ type: "L", idx: path.length - 1, p });
    }
    return { path, ev, walked, result: "limit" };
  }

  // Bug2：m-line = 线段 x_I x_G。① 朝目标走（沿 m-line）；② 碰到障碍就左转沿边界走，直到在 m-line 上遇到
  //       比碰撞点 H_i 离目标更近、而且能朝目标走的点，回到 ①；若绕回 H_i 仍没找到 ⇒ 目标不可达
  function bug2(S, xI, xG) {
    const path = [xI], ev = [], walked = S.loops.map(() => 0);
    const md = C.sub2(xG, xI), mlen = Math.hypot(md.x, md.y);
    let p = xI;
    for (let it = 0; it < 200; it++) {
      const m = toGoal(S, p, xG);
      if (m.reached) { path.push(xG); return { path, ev, walked, result: "goal" }; }
      if (m.blocked) return { path, ev, walked, result: "unreachable" };
      path.push(m.q); ev.push({ type: "H", idx: path.length - 1, p: m.q });
      const { L, s: s0 } = locate(S, m.obs, m.q), dH = C.dist(m.q, xG);
      // 候选离开点：这条环与 m-line 的交点（共线的边取两个端点），按顺时针走到的先后排序
      const cand = [];
      for (let e = 0; e < L.n; e++) {
        const a = L.pts[e], b = L.pts[(e + 1) % L.n], t = C.segX(a, b, xI, xG);
        const add = (s, q) => { let aa = mod(s0 - s, L.P); if (aa < 1e-9) aa = L.P; cand.push({ a: aa, q }); };
        if (t !== null) add(L.cum[e] + t * L.len[e], { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        else if (Math.abs(C.cross(C.sub2(b, a), md)) < 1e-12 * mlen * L.len[e] + 1e-15 && Math.abs(C.cross(C.sub2(a, xI), md)) < 1e-9 * mlen) {
          for (const [q, s] of [[a, L.cum[e]], [b, L.cum[e] + L.len[e]]]) {
            const u = ((q.x - xI.x) * md.x + (q.y - xI.y) * md.y) / (mlen * mlen);
            if (u >= 0 && u <= 1) add(s, q);
          }
        }
      }
      cand.sort((u, v) => u.a - v.a);
      const leave = cand.find((c) => C.dist(c.q, xG) < dH - 1e-9 && !toGoal(S, c.q, xG).blocked);
      if (!leave) { path.push(...walk(L, s0, L.P, -1)); path[path.length - 1] = m.q; walked[L.idx] += L.P; return { path, ev, walked, result: "unreachable" }; }
      path.push(...walk(L, s0, leave.a, -1));
      walked[L.idx] += leave.a;
      path[path.length - 1] = leave.q;
      p = leave.q;
      ev.push({ type: "L", idx: path.length - 1, p });
    }
    return { path, ev, walked, result: "limit" };
  }

  class BugDemo {
    constructor(root) {
      this.sceneKey = "fig20"; this.alg = "bug1"; this.speed = 5; this.showDepth = false; this.t = 0;
      const body = C.frame(root, "Bug1 与 Bug2", "图 12.20–12.23 · 只有目标传感器和接触传感器；可拖动 x_I、x_G");
      this.runner = new C.Runner(() => this.tick(), () => this.render());
      this.segScene = C.seg(Object.entries(BUG_SCENES).map(([k, v]) => [k, v.name]), this.sceneKey, (k) => this.setScene(k));
      this.segAlg = C.seg([["bug1", "Bug1"], ["bug2", "Bug2"]], this.alg, (k) => { this.alg = k; this.plan(); this.play(true); });
      this.plot = new C.Plot({ equal: true, aspect: 0.62, maxW: 820, minW: 240, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.down(p), onMove: (p, d) => this.move(p, d),
        onUp: () => this.play(true), cursor: (p) => (this.near(p) ? "grab" : null) });
      this.btnPlay = C.button("播放", () => this.play(false), "small primary");
      this.sV = C.slider("速度", 1, 10, 1, this.speed, (v) => { this.speed = v; });
      this.cbDepth = C.checkbox("显示测距传感器的深度间断点（图 12.25）", false, (v) => { this.showDepth = v; this.plot.draw(); });
      this.st = { L: C.stat("已走路程 L"), d: C.stat("d = |x_I x_G|"), p: C.stat("Σ pᵢ"), b: C.stat("上界"), r: C.stat("L / 上界") };
      this.msg = h("div", { class: "small", style: "margin-top:4px" });
      this.info = h("div", { class: "small", style: "margin-top:8px" });
      body.append(h("div", { class: "controls" }, this.segScene),
        h("div", { class: "controls" }, this.segAlg, h("span", { class: "sep" }), this.btnPlay, C.button("暂停", () => halt(this), "small"),
          C.button("重播", () => this.play(true), "small"), C.button("跳到结尾", () => { halt(this); this.t = this.res.total; this.render(); }, "small"), this.sV),
        h("div", { class: "controls" }, this.cbDepth),
        this.plot.wrap, h("div", { class: "stats" }, Object.values(this.st)), this.msg,
        C.legend([[C.cv("obst"), "障碍"], [C.cv("best"), "已走路径"], [C.cva("muted", 0.45), "尚未走的部分"], [C.cv("cand"), "m-line（Bug2）"],
          [C.cv("worst"), "Hᵢ 碰到障碍", true], [C.cv("prob"), "Lᵢ 离开障碍", true], [C.cv("robot"), "机器人 / x_I", true], [C.cv("goal"), "目标 x_G", true]]),
        this.info);
      pauseOffscreen(root, this);
      this.setScene(this.sceneKey);
    }
    setScene(k) {
      this.sceneKey = k; this.segScene.set(k);
      const def = BUG_SCENES[k];
      this.S = prepScene(def);
      this.xI = { ...def.xI }; this.xG = { ...def.xG };
      this.plot.setRange(def.view[0], def.view[1]);
      this.plot.o.aspect = Math.max(0.36, Math.min(0.7, (def.view[1][1] - def.view[1][0]) / (def.view[0][1] - def.view[0][0])));
      this.plot.W = 0; this.plot.resize();
      this.plan(); this.play(true);
    }
    // 解析地算出整条路径，然后只做动画
    plan() {
      const S = this.S, res = (this.alg === "bug1" ? bug1 : bug2)(S, this.xI, this.xG);
      res.cum = [0];
      for (let i = 1; i < res.path.length; i++) res.cum.push(res.cum[i - 1] + C.dist(res.path[i - 1], res.path[i]));
      res.total = res.cum[res.cum.length - 1];
      res.ev.forEach((e) => (e.at = res.cum[e.idx]));
      res.d = C.dist(this.xI, this.xG);
      res.p = S.obs.map((o) => o.perim);
      res.n = S.obs.map((o) => crossings(S, o, this.xI, this.xG));
      res.bound1 = res.d + 1.5 * res.p.reduce((a, b) => a + b, 0);
      res.bound2 = res.d + 0.5 * res.p.reduce((a, b, i) => a + b * res.n[i], 0);
      this.res = res;
    }
    play(restart) {
      if (restart) this.t = 0;
      if (this.t >= this.res.total - 1e-9) this.t = 0;
      this.last = performance.now();
      this.runner.start(); this.render();
    }
    tick() {
      const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000), [x0, x1] = this.plot.o.x;
      this.last = now;
      this.t = Math.min(this.res.total, this.t + dt * this.speed * Math.max((x1 - x0) / 22, this.res.total / 90));
      this.render();
      return this.t < this.res.total;
    }
    posAt(t) {
      const { path, cum } = this.res;
      let i = 1; while (i < cum.length - 1 && cum[i] < t) i++;
      const a = path[i - 1], b = path[i] || a, seg = cum[i] - cum[i - 1], u = seg > 0 ? Math.max(0, Math.min(1, (t - cum[i - 1]) / seg)) : 1;
      return { i, p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u } };
    }
    near(p) {
      if (!this.plot.ctx) return null;
      if (this.plot.pxDist(p, this.xG) < 14) return "xG";
      if (this.plot.pxDist(p, this.xI) < 14) return "xI";
      return null;
    }
    down(p) { const w = this.near(p); if (!w) return null; halt(this); return { w }; }
    move(p, d) {
      const [x0, x1] = this.plot.o.x, [y0, y1] = this.plot.o.y;
      const q = { x: Math.max(x0 + 0.2, Math.min(x1 - 0.2, p.x)), y: Math.max(y0 + 0.2, Math.min(y1 - 0.2, p.y)) };
      if (insideAny(this.S, q) >= 0 || boundaryDist(this.S, q) < 0.08) return;
      this[d.w] = q;
      this.plan(); this.t = this.res.total; this.render();
    }
    render() {
      const r = this.res, st = this.st, b1 = this.alg === "bug1", bound = b1 ? r.bound1 : r.bound2, sub = C.sub;
      st.L.set(`${r.total.toFixed(1)}${this.t < r.total - 1e-9 ? ` <span class="muted" style="font-size:12px">（已走 ${this.t.toFixed(1)}）</span>` : ""}`);
      st.d.set(r.d.toFixed(2));
      st.p.set(r.p.reduce((a, b) => a + b, 0).toFixed(1));
      st.b.key(b1 ? "上界 (12.25) d + (3/2)Σ pᵢ" : "上界 (12.26) d + (1/2)Σ nᵢpᵢ");
      st.b.set(bound.toFixed(1));
      st.r.set((r.total / bound).toFixed(3));
      this.btnPlay.disabled = this.runner.running;
      const done = this.t >= r.total - 1e-9, nH = r.ev.filter((e) => e.type === "H").length;
      let m;
      if (r.result === "goal") m = done ? `<span class="yes">到达目标</span>：碰到障碍 ${nH} 次，L = ${r.total.toFixed(2)} ≤ 上界 ${bound.toFixed(2)}。` : "运行中……";
      else if (r.result === "unreachable") {
        m = !done ? "运行中……" : b1
          ? `<span class="no">报告「目标不可达」</span>：回到整圈边界上离目标最近的点 L${sub(nH)} 后，朝目标的方向指向障碍内部。`
          : `<span class="no">报告「目标不可达」</span>：沿边界绕回了碰撞点 H${sub(nH)}，途中没有比它离目标更近、又能朝目标走的 m-line 点。`;
      } else m = "<span class=\"no\">超出迭代上限</span>";
      this.msg.innerHTML = m;
      const nStr = r.n.map((v, i) => `n${sub(i + 1)} = ${v}`).join("，"), pStr = r.p.map((v, i) => `p${sub(i + 1)} = ${v.toFixed(1)}`).join("，");
      // 每个障碍：沿它被走过的那条边界环走了几圈（按该环的周长算）
      const lapStr = this.S.obs.map((o, i) => `障碍 ${i + 1}：${o.loops.map((L) => r.walked[L.idx] / L.P).filter((v, k) => v > 0 || k === 0).map((v) => v.toFixed(2)).join(" + ")} 圈`).join("，");
      const holes = this.S.obs.some((o) => o.loops.length > 1);
      this.info.innerHTML =
        `<p style="margin:0 0 6px">${pStr}；m-line 穿过各障碍边界的次数 ${nStr}。两个上界都对<b>全部 M = ${r.p.length} 个障碍</b>求和（不管碰没碰到），` +
        `所以对照用：Bug1 (12.25) = ${r.bound1.toFixed(1)}，Bug2 (12.26) = ${r.bound2.toFixed(1)}。` +
        `整条路径沿各障碍边界走了：${lapStr}。${holes ? "<span class=\"muted\">（环形障碍的 pᵢ 取内外两圈边界的总长。）</span>" : ""}</p>` +
        (b1 ? "<p style=\"margin:0\">Bug1：碰到障碍就左转（障碍在右手边，顺时针）走完整一圈——目标传感器的读数重复就说明绕回来了，不需要做记号；" +
          "然后沿<b>较短的一侧</b>回到离目标最近的点再出发。每个障碍的边界最多走 3/2 圈。</p>"
          : "<p style=\"margin:0\">Bug2：碰到障碍就左转沿边界走，回到 m-line（虚线）上、且比碰撞点 H<sub>i</sub> 离目标更近、又能朝目标走时就离开。" +
          "<span class=\"muted\">补充：书中说「比上次离开边界时更近」，这里按 Lumelsky 的原始版本取碰撞点 H<sub>i</sub>，保证不会兜圈。</span></p>");
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      if (!this.res) return;
      const S = this.S, r = this.res, [x0, x1] = pl.o.x, [y0, y1] = pl.o.y;
      pl.rect(x0, y0, x1, y1, col.surface, col.strong, 1);
      const cur = this.posAt(this.t);
      if (this.showDepth) this.drawDepth(pl, col, cur.p);
      for (const o of S.obs) pl.polys(o.loops.map((L) => L.pts), C.alpha(col.obst, 0.88));
      if (this.alg === "bug2") pl.line(this.xI, this.xG, col.cand, 1.6, [7, 5]);
      // 整条路径（淡）与已走部分
      pl.path(r.path, C.alpha(col.muted, 0.45), 1.2);
      const done = r.path.slice(0, cur.i).concat([cur.p]);
      pl.path(done, col.best, 2.6);
      this.arrows(pl, done, col.best);
      // Hᵢ、Lᵢ
      let nh = 0, nl = 0;
      for (const e of r.ev) {
        const k = e.type === "H" ? ++nh : ++nl;
        if (e.at > this.t + 1e-9) continue;
        const isH = e.type === "H", c = isH ? col.worst : col.prob;
        pl.dot(e.p, 4.5, c, col.surface, 1.5);
        pl.text((isH ? "H" : "L") + C.sub(k), e.p, c, { dx: isH ? -9 : 9, dy: isH ? -10 : 10, size: 11.5, weight: 700, align: isH ? "right" : "left" });
      }
      pl.dot(this.xI, 5.5, col.surface, col.robot, 2.2);
      pl.text("x_I", this.xI, col.robot, { dy: -14, size: 12, weight: 700 });
      pl.dot(this.xG, 6, col.goal, col.surface, 1.5);
      pl.text("x_G", this.xG, col.goal, { dy: -14, size: 12, weight: 700 });
      pl.dot(cur.p, 5.5, col.robot, col.surface, 1.8);
    }
    // 沿已走路径每隔约 60 像素画一个小箭头，表示方向
    arrows(pl, P, color) {
      const ctx = pl.ctx, gap = 60;
      let acc = gap / 2;
      for (let i = 1; i < P.length; i++) {
        const ax = pl.X(P[i - 1].x), ay = pl.Y(P[i - 1].y), bx = pl.X(P[i].x), by = pl.Y(P[i].y), L = Math.hypot(bx - ax, by - ay);
        if (L < 1e-6) continue;
        const ux = (bx - ax) / L, uy = (by - ay) / L;
        let s = acc;
        for (; s < L; s += gap) {
          const x = ax + ux * s, y = ay + uy * s;
          ctx.beginPath(); ctx.moveTo(x + ux * 5, y + uy * 5); ctx.lineTo(x - ux * 4 - uy * 4, y - uy * 4 + ux * 4); ctx.lineTo(x - ux * 4 + uy * 4, y - uy * 4 - ux * 4);
          ctx.closePath(); ctx.fillStyle = color; ctx.fill();
        }
        acc = s - L;
      }
    }
    // 图 12.25：测距传感器的深度图在「轮廓顶点」处不连续——两条邻边都在视线同侧的可见顶点；视距用画面边界截断（补充）
    drawDepth(pl, col, p) {
      const S = this.S, [x0, x1] = pl.o.x, [y0, y1] = pl.o.y;
      // 机器人贴着边界时，把测量点往自由空间挪一点点，免得射线擦着自己所在的边
      if (boundaryDist(S, p) < 1e-3) {
        const eps = (x1 - x0) * 2e-3;
        let best = null, bd = -1;
        for (let k = 0; k < 24; k++) {
          const q = { x: p.x + eps * Math.cos((k * Math.PI) / 12), y: p.y + eps * Math.sin((k * Math.PI) / 12) };
          if (insideAny(S, q) >= 0) continue;
          const d = boundaryDist(S, q);
          if (d > bd) { bd = d; best = q; }
        }
        if (best) p = best;
      }
      const box = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
      const segs = S.segs.concat(C.polySegs([box]));
      const vp = C.visPoly(p, segs, S.verts.concat(box));
      if (vp.length > 2) pl.poly(vp, C.alpha(col.vis, 0.16));
      for (const L of S.loops) for (let i = 0; i < L.n; i++) {
        const v = L.pts[i], u = L.pts[(i + L.n - 1) % L.n], w = L.pts[(i + 1) % L.n], dv = C.sub2(v, p), dl = Math.hypot(dv.x, dv.y);
        if (dl < 1e-6) continue;
        const c1 = C.cross(dv, C.sub2(u, v)), c2 = C.cross(dv, C.sub2(w, v));
        if (c1 * c2 <= 0) continue;
        if (!C.segFree(p, v, S.segs) || insideAny(S, { x: (p.x + v.x) / 2, y: (p.y + v.y) / 2 }) >= 0) continue;
        const dir = { x: dv.x / dl, y: dv.y / dl }, far = C.rayHit({ x: v.x + dir.x * 1e-7, y: v.y + dir.y * 1e-7 }, dir, segs);
        pl.line(p, v, C.alpha(col.cand, 0.55), 1);
        if (isFinite(far.t)) { pl.line(v, far.p, C.alpha(col.cand, 0.9), 1.3, [4, 3]); pl.dot(far.p, 3.5, col.surface, col.cand, 1.8); }
        pl.dot(v, 3.5, col.surface, col.cand, 1.8);
      }
    }
  }

  // ===============================================================
  // 组件 3：竞争比与迷路的牛（图 12.26、(12.28)、习题 8）
  // ===============================================================
  const COW = {
    exact1: { name: "已知距离恰为 1：左 1 → 回头 → 右 1", theo: 3 },
    double: { name: "倍增：左 1、右 2、左 4、右 8 …（折返点 −(−2)ⁱ）", theo: 9 },
    book: { name: "原书文字逐字执行：左 1、右 1、左 2、右 2、左 4 …", theo: 13 },
    r: { name: "一般增长因子 r：折返点 −1, r, −r², r³, …（补充）", theo: null },
  };
  const cowF = (r) => 1 + (2 * r * r) / (r - 1);
  // 折返点（带符号，向右为正）
  function cowTurns(strat, r) {
    if (strat === "exact1") return [-1, 1];
    const out = [];
    if (strat === "book") { for (let i = 0; 2 ** i < 1e12; i++) out.push(-(2 ** i), 2 ** i); return out; }
    const q = strat === "double" ? 2 : r;
    for (let i = 0; i < 600; i++) { const t = -Math.pow(-q, i); out.push(t); if (Math.abs(t) > 1e12) break; }
    return out;
  }
  // 牛按折返点来回走，直到第一次到达门 D；返回每一段和总路程（与 ch12_sensing_uncertainty.py 的 cow_ratio 相同）
  function cowRun(turns, D) {
    const legs = [];
    let dist = 0, pos = 0;
    for (const t of turns) {
      if ((D > 0 && pos <= D && D <= t) || (D < 0 && t <= D && D <= pos)) { legs.push([pos, D]); dist += Math.abs(D - pos); return { legs, dist, found: true }; }
      legs.push([pos, t]); dist += Math.abs(t - pos); pos = t;
    }
    return { legs, dist: Infinity, found: false };
  }
  const cowRatio = (turns, Ds) => Math.max(...Ds.map((D) => cowRun(turns, D).dist / Math.abs(D)));

  class LostCow {
    constructor(root) {
      this.strat = "double"; this.r = 2; this.side = 1; this.D = 5.3; this.u = 0; this.speed = 2;
      const body = C.frame(root, "迷路的牛：竞争比", "图 12.26、(12.28)、习题 8 · 牛不知道门在左边还是右边，也不知道有多远");
      this.runner = new C.Runner(() => this.tick(), () => this.render());
      this.sel = C.select(Object.entries(COW).map(([k, v]) => [k, v.name]), this.strat, (k) => this.setStrat(k));
      this.sel.style.maxWidth = "100%";
      this.segSide = C.seg([["-1", "门在左边"], ["1", "门在右边"]], "1", (k) => { this.side = +k; this.setD(this.side * Math.abs(this.D)); });
      this.sD = C.slider("|D|", 0, 3, 0.001, Math.log10(this.D), (v) => this.setD(this.side * Math.pow(10, v), true), (v) => C.fmtD(Math.pow(10, v), 2));
      this.sR = C.slider("r", 1.1, 4, 0.05, this.r, (v) => { this.r = v; this.update(true); }, (v) => v.toFixed(2));
      this.sV = C.slider("速度", 1, 8, 1, this.speed, (v) => { this.speed = v; });
      this.btnPlay = C.button("播放", () => this.play(), "small primary");
      this.pa = new C.Plot({ aspect: 0.4, maxW: 820, minW: 240, m: { l: 14, r: 14, t: 26, b: 30 }, onDraw: (ctx, pl, col) => this.drawA(ctx, pl, col),
        onDown: (p) => this.downA(p), onMove: (p) => this.moveA(p), onUp: () => { this.dragX = false; this.update(true); },
        cursor: (p) => (this.nearGate(p) ? "ew-resize" : null) });
      this.pb = new C.Plot({ x: [0, 3], y: [0, 12], aspect: 0.72, maxW: 460, minW: 220, m: { l: 46, r: 16, t: 12, b: 34 },
        onDraw: (ctx, pl, col) => this.drawB(ctx, pl, col), onDown: (p) => { this.setD(this.side * Math.pow(10, Math.max(0, Math.min(3, p.x)))); return null; } });
      this.pc = new C.Plot({ x: [1, 4.1], y: [0, 27], aspect: 0.72, maxW: 460, minW: 220, m: { l: 46, r: 16, t: 12, b: 34 },
        onDraw: (ctx, pl, col) => this.drawC(ctx, pl, col),
        onDown: (p) => { if (p.x >= 1.1 && p.x <= 4) { this.r = Math.round(p.x * 20) / 20; this.sR.set(this.r); if (this.strat !== "r") { this.sel.value = "r"; this.setStrat("r"); } else this.update(true); } return null; } });
      this.st = { dist: C.stat("已走路程"), D: C.stat("|D|（最优路程）"), ratio: C.stat("比值 路程 / |D|"), sup: C.stat("本策略的最坏比（上确界）") };
      this.msg = h("div", { class: "small", style: "margin-top:4px" });
      this.info = h("div", { class: "small", style: "margin-top:10px" });
      body.append(h("div", { class: "controls" }, this.sel),
        h("div", { class: "controls" }, this.segSide, this.sD, this.sR),
        h("div", { class: "controls" }, this.btnPlay, C.button("跳到结尾", () => { halt(this); this.u = this.run.legs.length; this.render(); }, "small"),
          C.button("把门放到最坏处", () => this.worst(), "small"), this.sV),
        h("div", { class: "small muted", style: "margin:0 0 4px" }, "(a) 每一行是一段折返（从上往下依次走），竖虚线是折返点；拖动绿色的门改变 D"),
        this.pa.wrap, h("div", { class: "stats" }, Object.values(this.st)), this.msg,
        h("div", { class: "split", style: "margin-top:10px" },
          h("div", null, h("div", { class: "small muted", style: "margin:0 0 4px" }, "(b) 比值随 |D| 变化（横轴对数，点击可设 |D|）"), this.pb.wrap,
            C.legend([[C.cv("robot"), "门在右边"], [C.cv("cand"), "门在左边"], [C.cv("worst"), "理论上确界"], [C.cv("best"), "当前的门", true]])),
          h("div", null, h("div", { class: "small muted", style: "margin:0 0 4px" }, "(c) 最坏比 1 + 2r²/(r − 1) 随 r 变化（点击设 r）"), this.pc.wrap,
            C.legend([[C.cv("text"), "公式"], [C.cv("prob"), "数值模拟的上确界", true], [C.cv("best"), "r = 2 时最小：9", true], [C.cv("robot"), "当前 r", true]]))),
        this.info);
      pauseOffscreen(root, this);
      this.setStrat(this.strat);
    }
    setStrat(k) {
      this.strat = k;
      this.sR.input.disabled = k !== "r";
      this.sD.input.disabled = k === "exact1";
      if (k === "double") this.r = 2;
      if (k === "exact1") this.D = this.side;
      this.update(true);
    }
    theo() { return this.strat === "r" ? cowF(this.r) : COW[this.strat].theo; }
    setD(D, fromSlider) {
      if (this.strat === "exact1") D = Math.sign(D) || 1;
      if (Math.abs(D) < 1) D = Math.sign(D) || 1;
      this.D = D; this.side = D < 0 ? -1 : 1; this.segSide.set(String(this.side));
      if (!fromSlider) this.sD.set(Math.log10(Math.abs(D)));
      this.update(true);
    }
    update(restart) {
      this.turns = cowTurns(this.strat, this.r);
      this.run = cowRun(this.turns, this.D);
      this.legDur();
      this.curve = null;
      if (restart) this.play(true); else this.render();
    }
    // 门放在「刚好越过某个折返点」处（ε = 10⁻⁶·|D|）：在 1 ≤ |D| ≤ 1000 里挑比值最大的那个
    worst() {
      if (this.strat === "exact1") { this.setD(1); return; }
      let best = null;
      for (const t of this.turns) {
        if (Math.abs(t) < 1 || Math.abs(t) * (1 + 1e-6) > 1000) continue;
        const D = t * (1 + 1e-6), q = cowRun(this.turns, D).dist / Math.abs(D);
        if (!best || q > best.q) best = { D, q };
      }
      if (best) this.setD(best.D);
    }
    play(restart) {
      if (restart || this.u >= this.run.legs.length) this.u = 0;
      this.last = performance.now();
      this.runner.start(); this.render();
    }
    // 每段折返的动画时长（秒，速度 = 1 时）：长段慢、短段快，但都看得见
    legDur() {
      const lens = this.run.legs.map(([a, b]) => Math.abs(b - a)), mx = Math.max(...lens, 1e-9);
      this.dur = lens.map((l) => 0.25 + 1.6 * Math.sqrt(l / mx));
    }
    tick() {
      const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000), k = Math.floor(this.u);
      this.last = now;
      this.u = Math.min(this.run.legs.length, this.u + (dt * this.speed) / (this.dur[k] || 1));
      this.render();
      return this.u < this.run.legs.length;
    }
    traveled() {
      const L = this.run.legs, k = Math.floor(this.u);
      let s = 0;
      for (let i = 0; i < Math.min(k, L.length); i++) s += Math.abs(L[i][1] - L[i][0]);
      if (k < L.length) s += Math.abs(L[k][1] - L[k][0]) * (this.u - k);
      return s;
    }
    render() {
      const run = this.run, D = this.D, fin = this.u >= run.legs.length, tr = this.traveled(), st = this.st;
      st.dist.set(run.found ? `${C.fmtD(tr, 3)}${fin ? "" : " …"}` : "∞");
      st.D.set(C.fmtD(Math.abs(D), 6));
      st.ratio.set(run.found ? (fin ? `<b>${(run.dist / Math.abs(D)).toFixed(4)}</b>` : (tr / Math.abs(D)).toFixed(3) + " …") : "∞");
      const th = this.theo();
      st.sup.set(this.strat === "exact1" ? "3" : th.toFixed(this.strat === "r" ? 3 : 0));
      this.btnPlay.disabled = this.runner.running;
      const legs = run.legs.length;
      this.msg.innerHTML = run.found
        ? `门在 D = ${C.fmtD(D, 6)}：牛走了 ${legs} 段（${legs - 1} 次折返）才到门口，共 ${C.fmtD(run.dist, 4)}，是直接走过去的 <b>${(run.dist / Math.abs(D)).toFixed(4)}</b> 倍。`
        : "<span class=\"no\">这个策略只在 |D| = 1 时有效：门更远就永远找不到。</span>";
      const sup = this.supObserved();
      let info = `<p style="margin:0 0 6px">竞争比 (12.28) = 所有环境（门的位置 D）上「不知道 D 的策略的路程」与「知道 D 的路程 |D|」之比的最大值。`;
      if (this.strat === "exact1") info += "门恰在距离 1：最坏是先往左走 1、回头再走 2，路程 3，竞争比 3。";
      else info += `本策略在 1 ≤ |D| ≤ 1000 上的最大比值是 <b>${sup.toFixed(4)}</b>（门刚好越过某个折返点时最坏），理论上确界 ${th.toFixed(this.strat === "r" ? 3 : 0)}——只能逼近、取不到。`;
      info += "</p>";
      if (this.strat === "book")
        info += "<p style=\"margin:0 0 6px\"><b>注意</b>：原书说「左 1、右 1、左 2、右 2、左 4……竞争比是 9」。逐字照这个次序走（每个距离左右各一次再加倍），门刚越过右边的 2ᵏ 时，" +
          "路程是 13·2ᵏ − 4，比值趋于 <b>13</b>（门在左边时趋于 9）。竞争比 9 对应的是「每次换方向就把距离加倍」：左 1、右 2、左 4、右 8……（折返点 −(−2)ⁱ）。</p>";
      if (this.strat === "double")
        info += "<p style=\"margin:0 0 6px\">习题 8：门刚越过第 k 个折返点 2ᵏ 时，牛白走了 2(1 + 2 + … + 2ᵏ⁺¹) = 2(2ᵏ⁺² − 1)，再走 2ᵏ 到门，比值 9 − 2/2ᵏ → 9。</p>";
      if (this.strat === "r")
        info += `<p style="margin:0 0 6px">补充：折返点按 rⁱ 增长时，门刚越过 rᵏ 的比值是 1 + 2(rᵏ⁺² − 1)/((r − 1)rᵏ) → 1 + 2r²/(r − 1)，在 r = 2 处取最小值 9（图 (c)）。r = ${this.r.toFixed(2)} 时为 ${cowF(this.r).toFixed(3)}。</p>`;
      info += "<p style=\"margin:0\" class=\"muted\">约定：向右为正，牛先往左走；左右对称，最坏比与先走哪边无关。</p>";
      this.info.innerHTML = info;
      this.pa.draw(); this.pb.draw(); this.pc.draw();
    }
    // 1 ≤ |D| ≤ 1000 上比值随 |D| 的曲线（两侧），在折返点处取左右两个值以画出跳变
    curves() {
      if (this.curve) return this.curve;
      const out = { right: [], left: [], max: 0 };
      if (this.strat === "exact1") { out.right = [{ x: 0, y: 3 }]; out.left = [{ x: 0, y: 1 }]; out.max = 3; return (this.curve = out); }
      for (const side of [1, -1]) {
        const xs = [];
        for (let i = 0; i <= 360; i++) xs.push(Math.pow(10, (3 * i) / 360));
        for (const t of this.turns) if (Math.sign(t) === side && Math.abs(t) >= 1 && Math.abs(t) <= 1000) xs.push(Math.abs(t), Math.abs(t) * (1 + 1e-9));
        xs.sort((a, b) => a - b);
        const arr = xs.filter((x) => x <= 1000).map((x) => ({ x: Math.log10(x), y: cowRun(this.turns, side * x).dist / x }));
        out[side > 0 ? "right" : "left"] = arr;
        for (const p of arr) out.max = Math.max(out.max, p.y);
      }
      return (this.curve = out);
    }
    supObserved() { return this.curves().max; }
    // (a) 栅栏、门与逐段折返
    drawA(ctx, pl, col) {
      const run = this.run, legs = run.legs, n = Math.max(1, legs.length);
      let X = Math.abs(this.D);
      for (const [a, b] of legs) X = Math.max(X, Math.abs(a), Math.abs(b));
      X *= 1.1;
      if (!this.dragX) pl.setRange([-X, X], [-(n + 0.6), 0.9]);
      const [x0, x1] = pl.o.x, [y0, y1] = pl.o.y;
      pl.axes(col, { xt: C.ticks(x0, x1, 8), yt: [], grid: false, fx: (v) => C.fmtD(v, 2) });
      // 栅栏（顶部）与门
      pl.clip(() => {
        pl.line({ x: x0, y: 0.45 }, { x: x1, y: 0.45 }, col.strong, 3);
        pl.rect(this.D - (x1 - x0) * 0.006, 0.3, this.D + (x1 - x0) * 0.006, 0.6, col.surface);
        pl.line({ x: this.D, y: 0.9 }, { x: this.D, y: y0 }, C.alpha(col.best, 0.8), 2, [6, 4]);
        // 折返点的竖线
        for (const [, b] of legs.slice(0, -1)) pl.line({ x: b, y: 0.2 }, { x: b, y: y0 }, C.alpha(col.muted, 0.55), 1, [3, 4]);
        pl.line({ x: 0, y: 0.2 }, { x: 0, y: y0 }, col.strong, 1);
      });
      // 每段一行：已走完的实线，正在走的画到当前位置
      const k = Math.floor(this.u), rowPx = pl.Y(-1) - pl.Y(0), lw = Math.max(1, Math.min(3, 0.5 * rowPx));
      legs.forEach(([a, b], i) => {
        if (i > k || (i === k && this.u <= k)) return;
        const y = -(i + 0.5), last = i === legs.length - 1, c = last && run.found ? col.best : col.robot;
        const e = i < k ? b : a + (b - a) * (this.u - k);
        pl.line({ x: a, y }, { x: e, y }, c, lw);
        if (i < k && Math.abs(b - a) > 0 && rowPx > 6) pl.arrow({ x: a + (b - a) * 0.6, y }, { x: b, y }, c, lw, Math.min(7, rowPx));
      });
      // 牛
      if (legs.length) {
        const i = Math.min(k, legs.length - 1), [a, b] = legs[i], uu = k >= legs.length ? 1 : this.u - k, p = { x: a + (b - a) * uu, y: -(i + 0.5) };
        pl.dot(p, 6, col.robot, col.surface, 2);
      }
      pl.text("牛从 0 出发", { x: 0, y: 0.45 }, col.text2, { dy: -14, size: 11.5 });
      pl.text("门 D", { x: this.D, y: 0.45 }, col.best, { dy: -14, size: 12, weight: 700 });
      pl.rect(this.D - (x1 - x0) * 0.008, 0.32, this.D + (x1 - x0) * 0.008, 0.58, col.best);
    }
    nearGate(p) { return this.pa.ctx && Math.abs(this.pa.X(p.x) - this.pa.X(this.D)) < 12 && p.y > -1.5; }
    downA(p) { if (!this.nearGate(p) || this.strat === "exact1") return null; halt(this); this.dragX = true; return { gate: true }; }
    moveA(p) {
      let D = p.x;
      if (Math.abs(D) < 1) D = D < 0 ? -1 : 1;
      this.D = Math.max(-1000, Math.min(1000, D)); this.side = this.D < 0 ? -1 : 1; this.segSide.set(String(this.side));
      this.sD.set(Math.log10(Math.abs(this.D)));
      this.run = cowRun(this.turns, this.D); this.legDur(); this.u = this.run.legs.length; this.render();
    }
    // (b) 比值 vs |D|（对数横轴）
    drawB(ctx, pl, col) {
      const cv = this.curves(), th = this.theo();
      const ymax = this.strat === "exact1" ? 5 : Math.ceil(th + 3);
      pl.setRange([0, 3], [0, ymax]);
      pl.axes(col, { xt: [0, 1, 2, 3], yt: C.ticks(0, ymax, 5), fx: (t) => String(Math.round(Math.pow(10, t))), fy: (v) => C.fmtD(v, 1), xl: "|D|", yl: "比值" });
      pl.clip(() => {
        pl.line({ x: 0, y: th }, { x: 3, y: th }, col.worst, 1.5, [6, 4]);
        if (this.strat === "exact1") {
          pl.dot(cv.right[0], 5, col.robot); pl.dot(cv.left[0], 5, col.cand);
          pl.text("|D| > 1：找不到门", { x: 1.5, y: ymax * 0.55 }, col.muted, { size: 12 });
        } else { pl.path(cv.left, col.cand, 1.6); pl.path(cv.right, col.robot, 1.6); }
        if (this.run.found) pl.dot({ x: Math.log10(Math.abs(this.D)), y: this.run.dist / Math.abs(this.D) }, 5.5, col.best, col.surface, 1.5);
      });
      pl.text(`上确界 ${th.toFixed(this.strat === "r" ? 2 : 0)}`, { x: 3, y: th }, col.worst, { align: "right", dx: -4, dy: -9, size: 11.5, weight: 650 });
    }
    // (c) 1 + 2r²/(r − 1)
    drawC(ctx, pl, col) {
      pl.axes(col, { xt: [1, 1.5, 2, 2.5, 3, 3.5, 4], yt: [0, 5, 9, 15, 20, 25], fx: (v) => C.fmtD(v, 1), fy: (v) => C.fmtD(v, 1), xl: "r", yl: "最坏比" });
      if (!this.numDots) {
        this.numDots = [];
        for (let r = 1.25; r <= 4.001; r += 0.25) {
          const turns = cowTurns("r", r), Ds = [];
          for (let i = 0; Math.pow(r, i) < 1e6; i++) Ds.push(Math.pow(r, i) * (1 + 1e-9), -Math.pow(r, i) * (1 + 1e-9));
          this.numDots.push({ x: r, y: cowRatio(turns, Ds) });
        }
      }
      pl.clip(() => {
        pl.line({ x: 1, y: 9 }, { x: 4.1, y: 9 }, C.alpha(col.best, 0.5), 1, [4, 4]);
        pl.curve(cowF, 1.09, 4.1, 300, col.text, 1.8);
        for (const p of this.numDots) pl.dot(p, 3.5, col.prob);
        pl.dot({ x: 2, y: 9 }, 6, col.best, col.surface, 1.5);
        if (this.strat === "r" || this.strat === "double") pl.dot({ x: this.r, y: cowF(this.r) }, 5, null, col.robot, 2.5);
      });
      pl.text("r = 2，比值 9", { x: 2, y: 9 }, col.best, { dy: 14, size: 11.5, weight: 650 });
      if (this.strat === "book") pl.text("原书文字的次序不是等比折返", { x: 2.6, y: 22 }, col.muted, { size: 11.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='dstar']").forEach((el) => (el._w = new DStarDemo(el)));
    document.querySelectorAll("[data-widget='bug']").forEach((el) => (el._w = new BugDemo(el)));
    document.querySelectorAll("[data-widget='lost-cow']").forEach((el) => (el._w = new LostCow(el)));
  });
  // 供测试 / 调试
  window.CH12_ONLINE = { DStar, dijkstraBack, makeTerrain, prepScene, bug1, bug2, crossings, BUG_SCENES, cowTurns, cowRun, cowRatio, cowF };
})();
