/* 10.6 节：连续状态空间里的值迭代（插值）与「与自然对抗的运动规划」（像图 10.20）；
   混合系统：会开关的门（像图 10.21、10.22，Formulation 10.5） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH10;
  const INF = Infinity;

  // 点是否在三角形 / 多边形内
  function inPoly(x, y, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [ax, ay] = P[i], [bx, by] = P[j];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c;
    }
    return c;
  }

  // ---------------------------------------------------------------
  // 组件：与自然对抗的运动规划（像图 10.20；几何、方向数、噪声模型是补充的具体选择）
  // ---------------------------------------------------------------
  const OBST = [
    [[0.0, 0.88], [0.0, 0.74], [0.58, 0.74]],
    [[1.0, 0.70], [1.0, 0.56], [0.42, 0.56]],
    [[0.0, 0.52], [0.0, 0.38], [0.58, 0.38]],
    [[1.0, 0.34], [1.0, 0.20], [0.42, 0.20]],
    [[0.10, 0.04], [0.90, 0.04], [0.90, 0.10], [0.10, 0.10]],
  ];
  const GOALB = [0.45, 0.105, 0.55, 0.165];   // x0, y0, x1, y1
  const XI = { x: 0.55, y: 0.94 };
  const NA = 16, NT = 5, STEP = 0.025;
  class ContinuousNature {
    constructor(root) {
      this.M = 50; this.sigma = 40; this.showLevels = true; this.showField = true; this.trajs = [];
      const body = C.frame(root, "连续空间：与自然对抗的运动规划", "x(t+Δt) = x(t) + Δt·(u + θ)：机器人选方向，自然在 [−σ, σ] 里均匀地扭转方向；带插值的值迭代");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 500, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sS = C.slider("自然的扭转幅度 σ", 0, 90, 5, this.sigma, (v) => { this.sigma = v; }, (v) => v + "°");
      this.btnC = C.button("计算代价到目标", () => this.compute(), "small primary");
      this.chkL = C.checkbox("等高线", this.showLevels, (v) => { this.showLevels = v; this.st.draw(); });
      this.chkF = C.checkbox("向量场", this.showField, (v) => { this.showField = v; this.st.draw(); });
      this.stats = { it: C.stat("值迭代次数"), g: C.stat("G*(x_I)（时间）"), sim: C.stat("模拟 30 次的平均时间") };
      this.msg = h("div", { class: "small", style: "min-height:2.6em" });
      body.append(h("div", { class: "controls" }, this.sS, this.btnC, C.button("从 x_I 模拟 30 次执行", () => this.simulate(), "small")),
        h("div", { class: "controls" }, this.chkL, this.chkF),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cva("accent", 0.55), "代价到目标（越深越久）"], [C.cv("text2"), "等高线"], [C.cv("accent"), "向量场：每处的最优方向"], [C.cv("path"), "执行轨迹"], [C.cva("ok", 0.4), "X_G"]]))));
      this.compute();
    }
    blocked(x, y) { if (x < 0 || y < 0 || x > 1 || y > 1) return true; for (const P of OBST) if (inPoly(x, y, P)) return true; return false; }
    inGoal(x, y) { return x >= GOALB[0] && x <= GOALB[2] && y >= GOALB[1] && y <= GOALB[3]; }
    // 双线性插值的权重（只用自由的格点，权重重新归一）
    weights(x, y) {
      const M = this.M, fx = x * M - 0.5, fy = y * M - 0.5;
      const i0 = Math.max(0, Math.min(M - 2, Math.floor(fx))), j0 = Math.max(0, Math.min(M - 2, Math.floor(fy)));
      const tx = Math.max(0, Math.min(1, fx - i0)), ty = Math.max(0, Math.min(1, fy - j0));
      const out = []; let tot = 0;
      for (const [di, dj, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
        const k = (j0 + dj) * M + (i0 + di);
        if (this.free[k] && w > 1e-9) { out.push([k, w]); tot += w; }
      }
      if (tot < 1e-6) return null;
      return out.map(([k, w]) => [k, w / tot]);
    }
    next(x, y, ang) { const nx = x + STEP * Math.cos(ang), ny = y + STEP * Math.sin(ang); return this.blocked(nx, ny) ? [x, y] : [nx, ny]; }
    thetas() { const sg = this.sigma * Math.PI / 180; return Array.from({ length: NT }, (_, k) => (NT === 1 ? 0 : -sg + 2 * sg * (k + 0.5) / NT)); }
    compute() {
      if (this.job) cancelAnimationFrame(this.job);
      const M = this.M, N = M * M;
      this.free = new Uint8Array(N); this.goal = new Uint8Array(N);
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const x = (i + 0.5) / M, y = (j + 0.5) / M, k = j * M + i; this.free[k] = this.blocked(x, y) ? 0 : 1; this.goal[k] = this.inGoal(x, y) ? 1 : 0; }
      // 预先算好每个 (样本, 动作, 自然样本) 的插值权重——它们在迭代中不变
      const TH = this.thetas(); this.TH = TH;
      const idx = [], wts = [], start = new Int32Array(N * NA + 1);
      let c = 0;
      for (let k = 0; k < N; k++) for (let a = 0; a < NA; a++) {
        start[k * NA + a] = c;
        if (this.free[k] && !this.goal[k]) {
          const x = ((k % M) + 0.5) / M, y = (Math.floor(k / M) + 0.5) / M;
          for (const th of TH) {
            const [nx, ny] = this.next(x, y, 2 * Math.PI * a / NA + th);
            const W = this.weights(nx, ny) || [[k, 1]];
            for (const [kk, w] of W) { idx.push(kk); wts.push(w / TH.length); c++; }
          }
        }
      }
      start[N * NA] = c;
      this.idx = Int32Array.from(idx); this.wts = Float64Array.from(wts); this.start = start;
      this.G = new Float64Array(N).fill(0);
      this.it = 0; this.trajs = []; this.simMean = null; this.ready = false;
      this.btnC.disabled = true;
      const loop = () => {
        let ch = 0;
        for (let rep = 0; rep < 15; rep++) { ch = this.sweep(); this.it++; if (ch < 1e-5 || this.it > 3000) break; }
        this.msg.textContent = `计算中…… 第 ${this.it} 次迭代，最大变化 ${ch.toExponential(1)}`;
        this.stats.it.set(this.it);
        if (ch < 1e-5 || this.it > 3000) { this.ready = true; this.btnC.disabled = false; this.finish(); return; }
        this.st.draw();
        this.job = requestAnimationFrame(loop);
      };
      this.job = requestAnimationFrame(loop);
    }
    // Gauss–Seidel 式的一次扫描：G(s) = min_u Σ_θ P(θ) [Δt + G(插值(下一点))]，这里 Δt 记作 1 个时间单位
    sweep() {
      const M = this.M, N = M * M, G = this.G, idx = this.idx, wts = this.wts, start = this.start;
      let ch = 0;
      for (let k = 0; k < N; k++) {
        if (!this.free[k] || this.goal[k]) continue;
        let best = INF;
        for (let a = 0; a < NA; a++) {
          let v = 1; const e = start[k * NA + a + 1];
          for (let c = start[k * NA + a]; c < e; c++) v += wts[c] * G[idx[c]];
          if (v < best) best = v;
        }
        if (this.it === 0 && G[k] === 0) { G[k] = best; ch = INF; continue; }
        ch = Math.max(ch, Math.abs(best - G[k])); G[k] = best;
      }
      return ch === INF ? 1 : ch;
    }
    interpG(x, y) { const W = this.weights(x, y); if (!W) return INF; return W.reduce((s, [k, w]) => s + w * this.G[k], 0); }
    // 执行时直接用插值后的代价到目标恢复动作（10.2.1 节「Using the plan」）
    bestAction(x, y) {
      let best = INF, ba = 0;
      for (let a = 0; a < NA; a++) {
        let v = 1;
        for (const th of this.TH) { const [nx, ny] = this.next(x, y, 2 * Math.PI * a / NA + th); v += (this.inGoal(nx, ny) ? 0 : this.interpG(nx, ny)) / this.TH.length; }
        if (v < best) { best = v; ba = a; }
      }
      return ba;
    }
    simulate() {
      if (!this.ready) return;
      const r = C.rng(C.newSeed()), sg = this.sigma * Math.PI / 180; this.trajs = []; let tot = 0, ok = 0;
      for (let t = 0; t < 30; t++) {
        let x = XI.x, y = XI.y; const path = [[x, y]]; let k = 0;
        while (!this.inGoal(x, y) && k < 600) {
          const a = this.bestAction(x, y), th = -sg + 2 * sg * r();
          [x, y] = this.next(x, y, 2 * Math.PI * a / NA + th); path.push([x, y]); k++;
        }
        if (this.inGoal(x, y)) { tot += k; ok++; }
        this.trajs.push(path);
      }
      this.simMean = ok ? tot / ok : null;
      this.finish();
    }
    finish() {
      const gI = this.interpG(XI.x, XI.y);
      this.stats.g.set(isFinite(gI) ? gI.toFixed(1) : "∞");
      this.stats.sim.set(this.simMean === null ? "–" : this.simMean.toFixed(1));
      this.msg.innerHTML = `收敛：${this.it} 次迭代（最大变化 < 10⁻⁵）。时间单位 = 一个 Δt，每步走 ${STEP}。` +
        (this.simMean !== null ? ` 每次执行的轨迹都不同，但平均时间（${this.simMean.toFixed(1)}）接近期望最优值 G*(x_I)。` : " 点「模拟」看执行。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      const M = this.M; let vmax = 1;
      if (this.G) for (let k = 0; k < M * M; k++) if (this.free[k] && this.G[k] < INF) vmax = Math.max(vmax, this.G[k]);
      st.rect(0, 0, 1, 1, col.surface);
      if (this.G) for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        const k = j * M + i;
        let v = this.G[k];
        if (!this.free[k]) {           // 中心落在障碍里的格子：借用相邻自由格子的值，免得斜边旁出现白色锯齿
          v = INF;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b2 = j + dj; if (a >= 0 && b2 >= 0 && a < M && b2 < M && this.free[b2 * M + a]) v = Math.min(v, this.G[b2 * M + a]); }
          if (v === INF) continue;
        }
        st.rect(i / M, j / M, (i + 1) / M + 0.0005, (j + 1) / M + 0.0005, C.heat(col, v, vmax));
      }
      // 等高线：在格点之间做 marching squares（只画线段的近似）
      if (this.G && this.showLevels && this.ready) {
        const step = Math.max(2, Math.round(vmax / 18));
        ctx.strokeStyle = C.alpha(col.text2, 0.55); ctx.lineWidth = 1;
        for (let lv = step; lv < vmax; lv += step) {
          ctx.beginPath();
          for (let j = 0; j < M - 1; j++) for (let i = 0; i < M - 1; i++) {
            const ks = [j * M + i, j * M + i + 1, (j + 1) * M + i + 1, (j + 1) * M + i];
            if (ks.some((k) => !this.free[k])) continue;
            const v = ks.map((k) => this.G[k]), P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
            const pts = [];
            for (let e = 0; e < 4; e++) {
              const a = v[e], b = v[(e + 1) % 4];
              if ((a < lv) !== (b < lv)) { const t = (lv - a) / (b - a), [x0, y0] = P[e], [x1, y1] = P[(e + 1) % 4]; pts.push([(x0 + (x1 - x0) * t + 0.5) / M, (y0 + (y1 - y0) * t + 0.5) / M]); }
            }
            for (let q = 0; q + 1 < pts.length; q += 2) { ctx.moveTo(st.X(pts[q][0]), st.Y(pts[q][1])); ctx.lineTo(st.X(pts[q + 1][0]), st.Y(pts[q + 1][1])); }
          }
          ctx.stroke();
        }
      }
      for (const P of OBST) { ctx.beginPath(); P.forEach(([x, y], q) => (q ? ctx.lineTo(st.X(x), st.Y(y)) : ctx.moveTo(st.X(x), st.Y(y)))); ctx.closePath(); ctx.fillStyle = C.alpha(col.wall, 0.85); ctx.fill(); }
      st.rect(GOALB[0], GOALB[1], GOALB[2], GOALB[3], C.alpha(col.ok, 0.35), col.ok, 1.5);
      st.text("X_G", (GOALB[0] + GOALB[2]) / 2, (GOALB[1] + GOALB[3]) / 2, col.ok, { size: 11, weight: 700 });
      if (this.showField && this.ready) {
        for (let j = 1; j < M; j += 3) for (let i = 1; i < M; i += 3) {
          const k = j * M + i; if (!this.free[k] || this.goal[k]) continue;
          const x = (i + 0.5) / M, y = (j + 0.5) / M, a = 2 * Math.PI * this.bestAction(x, y) / NA, L = 0.022;
          st.arrow(x - L * 0.5 * Math.cos(a), y - L * 0.5 * Math.sin(a), x + L * 0.5 * Math.cos(a), y + L * 0.5 * Math.sin(a), C.alpha(col.accent, 0.85), 1.2, 4.5);
        }
      }
      for (const path of this.trajs) {
        ctx.beginPath(); path.forEach(([x, y], q) => (q ? ctx.lineTo(st.X(x), st.Y(y)) : ctx.moveTo(st.X(x), st.Y(y))));
        ctx.strokeStyle = C.alpha(col.path, 0.5); ctx.lineWidth = 1.3; ctx.stroke();
      }
      ctx.strokeStyle = col.strong; ctx.lineWidth = 2; ctx.strokeRect(st.X(0), st.Y(1), st.scale, st.scale);
      st.dot(XI.x, XI.y, 5, col.start, col.surface, 1.5);
      st.text("x_I", XI.x, XI.y, col.start, { size: 12, weight: 700, dx: 16 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：混合系统——会开关的门（Formulation 10.5；房间形状模仿图 10.21）
  // ---------------------------------------------------------------
  const DM = 40;
  class DoorHybrid {
    constructor(root) {
      this.pOC = 0.1; this.pCO = 0.1; this.trajs = [];
      const body = C.frame(root, "混合系统：会开关的门", "两个模式 m ∈ {开, 关}，门是一个平稳 Markov 过程；40×40 网格、8 邻接移动、最小化期望时间");
      this.stO = new C.Stage({ view: [0, DM, 0, DM], maxW: 330, onDraw: (ctx, st, col) => this.draw(ctx, st, col, 0) });
      this.stC = new C.Stage({ view: [0, DM, 0, DM], maxW: 330, onDraw: (ctx, st, col) => this.draw(ctx, st, col, 1) });
      this.sOC = C.slider("每阶段 P(开 → 关)", 0, 0.5, 0.01, this.pOC, (v) => { this.pOC = v; this.compute(); }, (v) => v.toFixed(2));
      this.sCO = C.slider("每阶段 P(关 → 开)", 0, 0.5, 0.01, this.pCO, (v) => { this.pCO = v; this.compute(); }, (v) => v.toFixed(2));
      this.msg = h("div", { class: "small", style: "min-height:2.6em" });
      body.append(h("div", { class: "controls" }, this.sOC, this.sCO),
        h("div", { class: "controls" }, C.button("模拟 12 次执行（门随机开关）", () => this.simulate(), "small primary"), C.button("清除轨迹", () => { this.trajs = []; this.draw2(); }, "small")),
        h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px" },
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "门开着时的代价到目标与向量场"), this.stO.wrap),
          h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "门关着时"), this.stC.wrap)),
        this.msg, C.legend([[C.cva("accent", 0.55), "期望时间（越深越久）"], [C.cv("accent"), "最优移动方向"], [C.cv("warn"), "门（关着时是墙）"], [C.cv("path"), "执行轨迹（画在执行开始时门的模式下）"]]));
      this.buildMap();
      this.compute();
    }
    buildMap() {
      // 墙：y = 20 一行，从左边界到 x = 31（右端是尖的）；门在 x = 4..6；右侧留出通道
      this.wall = new Uint8Array(DM * DM); this.door = new Uint8Array(DM * DM); this.goal = new Uint8Array(DM * DM);
      for (let i = 0; i <= 31; i++) { this.wall[20 * DM + i] = 1; this.wall[21 * DM + i] = 1; }
      this.wall[22 * DM + 30] = 1; this.wall[19 * DM + 30] = 1; this.wall[22 * DM + 29] = 1; this.wall[19 * DM + 29] = 1;
      for (let i = 4; i <= 6; i++) { this.wall[20 * DM + i] = 0; this.wall[21 * DM + i] = 0; this.door[20 * DM + i] = 1; this.door[21 * DM + i] = 1; }
      for (let i = 1; i <= 6; i++) for (let j = 1; j <= 3; j++) this.goal[j * DM + i] = 1;
      this.xI = { i: 12, j: 34 };
    }
    // 能否「走进」格子 (i, j)：墙永远不行，门格只在门开着时可以
    blocked(i, j, m) { if (i < 0 || j < 0 || i >= DM || j >= DM) return true; const k = j * DM + i; return this.wall[k] === 1 || (m === 1 && this.door[k] === 1); }
    moves(i, j, m) {
      const out = [];
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) { out.push([i, j, 1]); continue; }
        const ni = i + di, nj = j + dj;
        if (this.blocked(ni, nj, m)) continue;
        if (di && dj && (this.blocked(i + di, j, m) || this.blocked(i, j + dj, m))) continue;   // 不能斜穿墙角
        out.push([ni, nj, di && dj ? Math.SQRT2 : 1]);
      }
      return out;
    }
    compute() {
      // G(q, m) = min_u { c(u) + Σ_{m'} P(m'|m) G(q', m') }：先移动，再由自然决定门的下一个模式
      const N = DM * DM, P = [[1 - this.pOC, this.pOC], [this.pCO, 1 - this.pCO]];
      const G = [new Float64Array(N).fill(1e6), new Float64Array(N).fill(1e6)];
      for (let m = 0; m < 2; m++) for (let k = 0; k < N; k++) if (this.goal[k]) G[m][k] = 0;
      let it;
      for (it = 0; it < 4000; it++) {
        let ch = 0;
        for (let m = 0; m < 2; m++) for (let j = 0; j < DM; j++) for (let i = 0; i < DM; i++) {
          // 门关上时机器人可能正站在门口：那仍是合法状态，只是不能再「走进」门格
          const k = j * DM + i; if (this.goal[k] || this.wall[k]) continue;
          let best = INF;
          for (const [ni, nj, c] of this.moves(i, j, m)) { const kk = nj * DM + ni; const v = c + P[m][0] * G[0][kk] + P[m][1] * G[1][kk]; if (v < best) best = v; }
          ch = Math.max(ch, Math.abs(best - G[m][k])); G[m][k] = best;
        }
        if (ch < 1e-7) break;
      }
      this.G = G; this.P = P; this.it = it + 1;
      const gO = G[0][this.xI.j * DM + this.xI.i], gC = G[1][this.xI.j * DM + this.xI.i];
      const dirC = this.policy(this.xI.i, this.xI.j, 1);
      this.msg.innerHTML = `值迭代 ${this.it} 次收敛。从 x_I 出发的期望时间：门开 ${gO.toFixed(1)}，门关 ${gC.toFixed(1)}。` +
        ` 门关着时，x_I 处的最优动作是向${dirC[0] < 0 ? "左" : dirC[0] > 0 ? "右" : ""}${dirC[1] < 0 ? "下" : dirC[1] > 0 ? "上" : ""}` +
        (dirC[0] < 0 ? "——朝门走，赌它很快会开。" : dirC[0] > 0 ? "——绕远路走右边的通道。" : "。") + " 两层的代价不能分开算：每一层都用到了门的转移概率。";
      this.trajs = [];
      this.draw2();
    }
    policy(i, j, m) {
      let best = INF, bm = [0, 0];
      for (const [ni, nj, c] of this.moves(i, j, m)) { const kk = nj * DM + ni; const v = c + this.P[m][0] * this.G[0][kk] + this.P[m][1] * this.G[1][kk]; if (v < best - 1e-9) { best = v; bm = [ni - i, nj - j]; } }
      return bm;
    }
    simulate() {
      const r = C.rng(C.newSeed());
      this.trajs = [];
      for (let t = 0; t < 12; t++) {
        let i = this.xI.i, j = this.xI.j, m = t % 2; const m0 = m; const path = [[i, j]];
        for (let k = 0; k < 400 && !this.goal[j * DM + i]; k++) {
          const [di, dj] = this.policy(i, j, m); i += di; j += dj; path.push([i, j]);
          m = r() < this.P[m][1] ? 1 : 0;
        }
        this.trajs.push({ path, m0 });
      }
      this.draw2();
    }
    draw2() { this.stO.draw(); this.stC.draw(); }
    draw(ctx, st, col, m) {
      if (!this.G) return;
      const G = this.G[m]; let vmax = 1;
      for (let k = 0; k < DM * DM; k++) if (G[k] < 1e5) vmax = Math.max(vmax, G[k]);
      for (let j = 0; j < DM; j++) for (let i = 0; i < DM; i++) {
        const k = j * DM + i;
        let f;
        if (this.door[k]) f = m === 1 ? col.warn : C.alpha(col.warn, 0.25);
        else if (this.wall[k]) f = C.alpha(col.wall, 0.9);
        else if (this.goal[k]) f = C.alpha(col.ok, 0.45);
        else f = C.heat(col, G[k], vmax);
        st.rect(i, j, i + 1.02, j + 1.02, f);
      }
      // 等时线（每 4 个时间单位）
      ctx.strokeStyle = C.alpha(col.text2, 0.45); ctx.lineWidth = 1; ctx.beginPath();
      for (let j = 0; j < DM; j++) for (let i = 0; i < DM; i++) {
        const k = j * DM + i; if (this.blocked(i, j, m) || this.goal[k]) continue;
        const band = Math.floor(G[k] / 4);
        if (i + 1 < DM && !this.blocked(i + 1, j, m) && Math.floor(G[k + 1] / 4) !== band) { ctx.moveTo(st.X(i + 1), st.Y(j)); ctx.lineTo(st.X(i + 1), st.Y(j + 1)); }
        if (j + 1 < DM && !this.blocked(i, j + 1, m) && Math.floor(G[k + DM] / 4) !== band) { ctx.moveTo(st.X(i), st.Y(j + 1)); ctx.lineTo(st.X(i + 1), st.Y(j + 1)); }
      }
      ctx.stroke();
      for (let j = 1; j < DM; j += 3) for (let i = 1; i < DM; i += 3) {
        const k = j * DM + i; if (this.blocked(i, j, m) || this.goal[k]) continue;
        const [di, dj] = this.policy(i, j, m); if (!di && !dj) continue;
        const L = Math.hypot(di, dj);
        st.arrow(i + 0.5 - di / L * 0.9, j + 0.5 - dj / L * 0.9, i + 0.5 + di / L * 0.9, j + 0.5 + dj / L * 0.9, C.alpha(col.accent, 0.85), 1.2, 4.5);
      }
      for (const { path, m0 } of this.trajs) {
        if (m0 !== m) continue;
        ctx.beginPath(); path.forEach(([i, j], q) => (q ? ctx.lineTo(st.X(i + 0.5), st.Y(j + 0.5)) : ctx.moveTo(st.X(i + 0.5), st.Y(j + 0.5))));
        ctx.strokeStyle = C.alpha(col.path, 0.65); ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.strokeStyle = col.strong; ctx.lineWidth = 2; ctx.strokeRect(st.X(0), st.Y(DM), DM * st.scale, DM * st.scale);
      st.dot(this.xI.i + 0.5, this.xI.j + 0.5, 4.5, col.start, col.surface, 1.5);
      st.text("x_I", this.xI.i + 0.5, this.xI.j + 0.5, col.start, { size: 11, weight: 700, dx: 14 });
      st.text("X_G", 3.5, 2, col.ok, { size: 11, weight: 700 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='continuous-nature']").forEach((el) => el._w = new ContinuousNature(el));
    document.querySelectorAll("[data-widget='door-hybrid']").forEach((el) => el._w = new DoorHybrid(el));
  });
})();
