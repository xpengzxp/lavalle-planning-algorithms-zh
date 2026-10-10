/* 7.1 节：时变问题——状态空间 X = C × T（例 7.1、图 7.1）、伪度量 ρ_X 与速度锥（式 7.3、7.4，图 7.3）、
   单元必须是 T 上的柱体（图 7.2）、速度调节法（式 7.5，图 7.4、7.5） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // 分段线性运动：关键帧 [{t, x, y}]，在关键帧之间线性插值；关键帧的时刻就是「临界时刻」
  function plAt(K, t) {
    if (t <= K[0].t) return { x: K[0].x, y: K[0].y };
    for (let i = 1; i < K.length; i++) {
      if (t <= K[i].t) { const a = K[i - 1], b = K[i], u = (t - a.t) / (b.t - a.t || 1); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
    }
    const z = K[K.length - 1]; return { x: z.x, y: z.y };
  }

  // =================================================================
  // 组件 1：例 7.1 / 图 7.1 —— X = C × T 的三维视图 + C_free(t) 切片 + 时间展开网格上的时间单调路径
  // =================================================================
  const HEX = Array.from({ length: 6 }, (_, i) => ({ x: Math.cos(i * Math.PI / 3 + 0.25), y: Math.sin(i * Math.PI / 3 + 0.25) }));
  const TV_PRESETS = {
    fig71: { name: "两个临界时刻（图 7.1）", K: [{ t: 0, x: 0.22, y: 0.24 }, { t: 0.3, x: 0.34, y: 0.26 }, { t: 0.65, x: 0.68, y: 0.66 }, { t: 1, x: 0.68, y: 0.66 }] },
    sweep: { name: "上下扫过（三个临界时刻）", K: [{ t: 0, x: 0.5, y: 0.16 }, { t: 0.3, x: 0.5, y: 0.84 }, { t: 0.6, x: 0.5, y: 0.16 }, { t: 0.85, x: 0.5, y: 0.84 }, { t: 1, x: 0.5, y: 0.84 }] },
    linear: { name: "匀速直线（没有临界时刻）", K: [{ t: 0, x: 0.24, y: 0.2 }, { t: 1, x: 0.8, y: 0.76 }] },
  };

  // 时变障碍：C_obs(t) 是半径 R、中心按关键帧移动的六边形
  function hexAt(K, R, t) { const c = plAt(K, t); return HEX.map((v) => ({ x: c.x + R * v.x, y: c.y + R * v.y })); }
  function inHexObs(K, R, p, t) { const c = plAt(K, t); return C.inPoly({ x: (p.x - c.x) / R, y: (p.y - c.y) / R }, HEX); }

  // 时间展开的网格搜索：N×N 个位形 × KT 个时间步。每一步只能前进一个 Δt（时间单调），
  // 位移不超过 b·Δt（速度上限，式 7.4）；按时间分层的 BFS 找到最早到达 q_G 的路径。
  function planTimeGrid(K, R, qI, qG, b, N, KT) {
    N = N || 40; KT = KT || 24;
    const cell = (p) => C.clamp(Math.floor(p.y * N), 0, N - 1) * N + C.clamp(Math.floor(p.x * N), 0, N - 1);
    const ctr = (c) => ({ x: ((c % N) + 0.5) / N, y: (Math.floor(c / N) + 0.5) / N });
    const s = cell(qI), g = cell(qG), dt = 1 / KT;
    if (inHexObs(K, R, ctr(s), 0)) return { found: false, reason: "start" };
    const r = (b * dt) * N, ri = Math.floor(r + 1e-9);
    const moves = [];
    for (let di = -ri; di <= ri; di++) for (let dj = -ri; dj <= ri; dj++) if (Math.hypot(di, dj) <= r + 1e-9) moves.push([di, dj]);
    moves.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));   // 原地等待排在最前：同样早到时优先选「等一等」
    const NN = N * N, parent = new Int32Array((KT + 1) * NN).fill(-1);
    let front = [s]; parent[s] = s;
    let found = -1, expanded = 0;
    for (let k = 0; k < KT && found < 0; k++) {
      const nxt = [];
      for (const c of front) {
        expanded++;
        const i = c % N, j = Math.floor(c / N), p = ctr(c);
        for (const [di, dj] of moves) {
          const a = i + di, bb = j + dj;
          if (a < 0 || bb < 0 || a >= N || bb >= N) continue;
          const nc = bb * N + a, id = (k + 1) * NN + nc;
          if (parent[id] >= 0) continue;
          const q = ctr(nc);
          let ok = true;
          for (const u of [0.5, 1]) if (inHexObs(K, R, C.lerp(p, q, u), (k + u) * dt)) { ok = false; break; }
          if (!ok) continue;
          parent[id] = c; nxt.push(nc);
          if (nc === g) { found = k + 1; break; }
        }
        if (found >= 0) break;
      }
      front = nxt;
      if (!front.length) break;
    }
    if (found < 0) return { found: false, expanded, reason: "none" };
    const path = [];
    for (let k = found, c = g; k >= 0; k--) { const p = ctr(c); path.push({ t: k * dt, x: p.x, y: p.y }); c = parent[k * NN + c]; }
    path.reverse();
    let waits = 0, len = 0;
    for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); len += d; if (d < 1e-12) waits++; }
    return { found: true, arrival: found * dt, path, waits, len, expanded };
  }
  function pathAt(path, t) {
    if (t <= path[0].t) return path[0];
    for (let i = 1; i < path.length; i++) if (t <= path[i].t) { const a = path[i - 1], b = path[i], u = (t - a.t) / (b.t - a.t); return { t, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
    return path[path.length - 1];
  }

  class TimeVaryingX {
    constructor(root) {
      this.preset = "fig71"; this.R = 0.15; this.b = 2; this.t = 0.45;
      this.qI = { x: 0.1125, y: 0.8875 }; this.qG = { x: 0.9125, y: 0.1125 };
      this.v3 = new C.View3D(-0.62, 0.38, [0.5, 0.5, 0.5]);
      const body = C.frame(root, "时变障碍：状态空间 X = C × T", "例 7.1：凸多边形 C_obs(t) 分段线性运动，X_obs 是多面体；拖动左图旋转，拖动右图的 qI、qG");
      this.st3 = new C.Stage(Object.assign({ view: [-0.95, 0.95, -0.82, 0.82], aspect: 0.86, maxW: 470, onDraw: (ctx, st, col) => this.draw3(ctx, st, col), cursor: () => "grab" },
        this.v3.dragHandlers(() => this.st3.draw())));
      const near = (p) => (C.dist(p, this.qI) < 0.05 ? "qI" : C.dist(p, this.qG) < 0.05 ? "qG" : null);
      this.st2 = new C.Stage({ view: [0, 1, 0, 1], maxW: 330, onDraw: (ctx, st, col) => this.draw2(ctx, st, col), onDown: near,
        onMove: (p, d) => { const N = 40; this[d] = { x: (C.clamp(Math.floor(p.x * N), 0, N - 1) + 0.5) / N, y: (C.clamp(Math.floor(p.y * N), 0, N - 1) + 0.5) / N }; this.planSoon(); },
        cursor: (p) => (near(p) ? "grab" : null) });
      this.selP = C.select(Object.entries(TV_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.plan(); });
      this.sB = C.slider("速度上限 b", 1.5, 4, 0.25, this.b, (v) => { this.b = v; this.planSoon(); }, (v) => v.toFixed(2));
      this.sR = C.slider("障碍半径", 0.08, 0.22, 0.01, this.R, (v) => { this.R = v; this.planSoon(); }, (v) => v.toFixed(2));
      this.tl = new C.Timeline((u) => { this.t = u; this.redraw(); }, { label: "时刻 t", dur: 5, fmt: (u) => u.toFixed(2) });
      this.stats = { crit: C.stat("临界时刻"), arr: C.stat("最早到达时刻"), straight: C.stat("没有障碍时（直线全速）"), wait: C.stat("原地等待的步数"), len: C.stat("C 中路径长度") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP, this.sB, this.sR),
        h("div", { class: "split" }, this.st3.wrap, h("div", null, this.st2.wrap, h("div", { class: "small muted", style: "text-align:center" }, "切片 C_free(t)：灰 = C_obs(t)，虚线 = 临界时刻的位置"))),
        this.tl.el, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cva("wall", 0.5), "X_obs（多面体）"], [C.cva("accent", 0.25), "当前时刻的切片平面"], [C.cv("goal"), "静止目标 X_G：平行于 T 轴的直线"], [C.cv("path"), "时间单调路径 τ"]]));
      this.tl.set(this.t);
      this.plan();
    }
    get K() { return TV_PRESETS[this.preset].K; }
    planSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.plan(); }); }
    plan() {
      this.res = planTimeGrid(this.K, this.R, this.qI, this.qG, this.b);
      const r = this.res, crit = this.K.slice(1, -1).map((k) => k.t);
      this.stats.crit.set(crit.length ? crit.map((t) => t.toFixed(2)).join("、") : "无");
      this.stats.straight.set((C.dist(this.qI, this.qG) / this.b).toFixed(2));
      if (!r.found) {
        this.stats.arr.set('<span class="no">—</span>'); this.stats.wait.set("—"); this.stats.len.set("—");
        this.msg.innerHTML = r.reason === "start" ? "x_I = (q_I, 0) 落在 X_obs 里了：Formulation 7.1 要求初始状态无碰撞，把 qI 拖开。" : "在 T = [0, 1] 内到不了目标：试试调大速度上限 b，或换个障碍运动。";
      } else {
        this.stats.arr.set(r.arrival.toFixed(2)); this.stats.wait.set(r.waits); this.stats.len.set(r.len.toFixed(3));
        this.msg.innerHTML = `时间展开的网格（40×40 个位形 × 24 个时间步）：每一步时间都前进 Δt = 1/24（<b>时间单调</b>），位移是长度不超过 b·Δt 的格点向量（式 7.4 的离散版）。按时间分层 BFS，得到最早在 ${r.arrival.toFixed(2)} 到达 X_G 的路径。`;
      }
      this.redraw();
    }
    redraw() { this.st3.draw(); this.st2.draw(); }
    draw3(ctx, st, col) {
      const V = this.v3, K = this.K, R = this.R;
      const P3 = (t, p) => [t, p.x, p.y];
      // X_obs：每一段线性运动扫出一个凸多面体（两端切片的凸包）；按深度从远到近画
      const faces = [];
      for (let i = 1; i < K.length; i++) {
        const A = hexAt(K, R, K[i - 1].t).map((p) => P3(K[i - 1].t, p)), B = hexAt(K, R, K[i].t).map((p) => P3(K[i].t, p));
        faces.push(A, B);
        for (let j = 0; j < 6; j++) faces.push([A[j], A[(j + 1) % 6], B[(j + 1) % 6], B[j]]);
      }
      const depth = (F) => F.reduce((s, v) => s + V.proj(v).depth, 0) / F.length;
      faces.sort((a, b) => depth(b) - depth(a));
      V.cube(st, col, [0, 1, 0, 1, 0, 1], ["t", "x", "y"]);
      for (const F of faces) V.poly(st, F, C.alpha(col.wall, 0.16), C.alpha(col.wall, 0.5), 0.8);
      // 切片平面
      const t = this.t;
      V.poly(st, [[t, 0, 0], [t, 1, 0], [t, 1, 1], [t, 0, 1]], C.alpha(col.accent, 0.1), C.alpha(col.accent, 0.7), 1);
      V.poly(st, hexAt(K, R, t).map((p) => P3(t, p)), C.alpha(col.wall, 0.75), col.wall, 1);
      // 静止目标：一条平行于 T 轴的直线
      V.line(st, P3(0, this.qG), P3(1, this.qG), col.goal, 2.2);
      st.dot(V.proj(P3(0, this.qI)), 5, col.start, col.surface, 1.5);
      if (this.res.found) {
        const P = this.res.path.map((p) => V.proj([p.t, p.x, p.y]));
        st.polyline(P, col.path, 2.4);
        const c = pathAt(this.res.path, Math.min(t, this.res.arrival));
        st.dot(V.proj([Math.min(t, this.res.arrival), c.x, c.y]), 5, col.path, col.surface, 1.5);
      }
      // 临界时刻刻度
      for (const k of K.slice(1, -1)) { const p = V.proj([k.t, 0, 0]); st.text("t=" + k.t, p, col.muted, { size: 10.5, dy: 12 }); }
    }
    draw2(ctx, st, col) {
      st.frame(col);
      const K = this.K, R = this.R;
      for (const k of K) st.poly(hexAt(K, R, k.t), null, C.alpha(col.muted, 0.55), 1);
      ctx.setLineDash([4, 4]); st.polyline(K.map((k) => ({ x: k.x, y: k.y })), C.alpha(col.muted, 0.6), 1); ctx.setLineDash([]);
      st.poly(hexAt(K, R, this.t), C.alpha(col.wall, 0.78), col.wall, 1);
      if (this.res.found) {
        st.polyline(this.res.path, C.alpha(col.path, 0.45), 2);
        const at = this.t >= this.res.arrival ? this.qG : pathAt(this.res.path, this.t);
        st.dot(at, 6, col.path, col.surface, 2);
      }
      st.dot(this.qI, 6, col.start, col.surface, 2); st.text("qI", this.qI, col.start, { dy: -14, weight: 650 });
      st.dot(this.qG, 6, col.goal, col.surface, 2); st.text("qG", this.qG, col.goal, { dy: -14, weight: 650 });
      st.text(`t = ${this.t.toFixed(2)}`, { x: 0.02, y: 0.98 }, col.text2, { align: "left", base: "top", size: 12 });
    }
  }

  // =================================================================
  // 组件 2：伪度量 ρ_X（式 7.3）+ 速度锥（式 7.4、图 7.3）下的 RDT；C = [0,1]，X = T × C 是平面
  // =================================================================
  // X_obs 直接给成 (t, q) 平面里的凸多边形
  const lane = (q0, q1, wins) => wins.map(([a, b]) => [{ x: a, y: q0 }, { x: b, y: q0 }, { x: b, y: q1 }, { x: a, y: q1 }]);
  const walker = (ta, ya, tb, yb, w) => [{ x: ta, y: ya - w }, { x: tb, y: yb - w }, { x: tb, y: yb + w }, { x: ta, y: ya + w }];
  const RRT_PRESETS = {
    road: { name: "过马路：四条车道间歇来车", yI: 0.06, yG: 0.94, polys: [
      ...lane(0.18, 0.3, [[0.05, 0.17], [0.38, 0.5], [0.71, 0.83]]), ...lane(0.36, 0.48, [[0.2, 0.36], [0.55, 0.7], [0.88, 1]]),
      ...lane(0.54, 0.66, [[0, 0.1], [0.28, 0.42], [0.62, 0.76]]), ...lane(0.72, 0.84, [[0.12, 0.3], [0.45, 0.58], [0.8, 0.95]])] },
    hall: { name: "走廊里进进出出的行人", yI: 0.06, yG: 0.94, polys: [
      walker(0, 0.25, 0.3, 0.55, 0.05), walker(0.3, 0.8, 0.55, 0.4, 0.05), walker(0.5, 0.1, 0.8, 0.55, 0.05), walker(0.55, 0.98, 0.7, 0.82, 0.05)] },
  };
  function inObs1D(polys, t, y) { for (const P of polys) if (C.inPoly({ x: t, y }, P)) return true; return false; }
  // 伪度量 (7.3)：x = (q, t) 是树上的顶点，x' = (q', t') 是样本
  function rhoX(v, a) { if (v.y === a.y) return 0; if (a.t <= v.t) return Infinity; return Math.abs(v.y - a.y); }

  class TimeRRT {
    constructor(root) {
      this.preset = "road"; this.metric = "rhoX"; this.bounded = true; this.b = 2.2; this.eps = 0.06; this.hover = null; this.seed = 20240;
      const body = C.frame(root, "时变问题上的 RDT：伪度量与速度锥", "横轴 t、纵轴 q（C = [0,1]）；目标 X_G 是 q = q_G 的整条水平线");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 480, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { this.hover = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? p : null; this.st.draw(); }, onLeave: () => { this.hover = null; this.st.draw(); } });
      this.selP = C.select(Object.entries(RRT_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.reset(); });
      this.segM = C.seg([["rhoX", "伪度量 ρ_X（式 7.3）"], ["rhoXt", "ρ_X + 时间差（补充）"], ["euclid", "对称的欧氏距离"]], this.metric, (k) => { this.metric = k; this.reset(); });
      this.cB = C.check("速度上限", this.bounded, (v) => { this.bounded = v; this.reset(); });
      this.sB = C.slider("b", 0.8, 6, 0.1, this.b, (v) => { this.b = v; this.reset(); }, (v) => v.toFixed(1));
      this.runner = new C.Runner(() => { for (let i = 0; i < 4; i++) if (!this.step()) return false; this.render(); return true; }, () => this.render());
      this.stats = { v: C.stat("顶点"), back: C.stat("时间倒流的边"), clip: C.stat("被速度锥截断的扩展"), sol: C.stat("解") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP, this.segM),
        h("div", { class: "controls" }, this.cB, this.sB, C.button("▶ 运行", () => { if (this.done) this.reset(); this.runner.start(); }, "small primary"), C.button("暂停", () => this.runner.stop(), "small"), C.button("+1", () => { this.step(); this.render(); }, "small"), C.button("换个种子", () => { this.seed = C.newSeed(); this.reset(); }, "small")),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
        C.legend([[C.cva("wall", 0.7), "X_obs"], [C.cv("accent"), "树（时间向前的边）"], [C.cv("bad"), "时间倒流的边"], [C.cva("warn", 0.4), "鼠标处的速度锥"], [C.cv("path"), "解"]]));
      this.reset();
    }
    get P() { return RRT_PRESETS[this.preset]; }
    reset() {
      this.runner && this.runner.stop();
      this.r = C.rng(this.seed);
      this.V = [{ t: 0, y: this.P.yI, parent: -1 }];
      this.back = 0; this.clips = 0; this.done = false; this.sol = null;
      this.render();
    }
    segFree(a, b) {
      for (let i = 1; i <= 16; i++) { const u = i / 16, t = a.t + (b.t - a.t) * u, y = a.y + (b.y - a.y) * u; if (t < 0 || t > 1 || y < 0 || y > 1 || inObs1D(this.P.polys, t, y)) return false; }
      return true;
    }
    step() {
      if (this.done || this.V.length >= 2000) { this.done = true; return false; }
      const a = { t: this.r(), y: this.r() < 0.08 ? this.P.yG : this.r() };   // 8% 的样本取在目标线上（目标偏置）
      let best = -1, bd = Infinity;
      this.V.forEach((v, i) => {
        const d = this.metric === "rhoX" ? rhoX(v, a) : this.metric === "rhoXt" ? (a.t <= v.t ? Infinity : Math.abs(v.y - a.y) + (a.t - v.t)) : Math.hypot(v.t - a.t, v.y - a.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0 || bd === Infinity) return true;
      const v = this.V[best];
      let dt = a.t - v.t, dy = a.y - v.y;
      const L = Math.hypot(dt, dy); if (L > this.eps) { dt *= this.eps / L; dy *= this.eps / L; }
      if (this.bounded && dt > 0 && Math.abs(dy) > this.b * dt) { dy = Math.sign(dy) * this.b * dt; this.clips++; }   // 投影进速度锥
      const n = { t: v.t + dt, y: v.y + dy, parent: best, backward: dt < 0 };
      if (!this.segFree(v, n)) return true;
      if (n.backward) this.back++;
      this.V.push(n);
      // 离目标线很近时，以允许的最快速度靠上去
      const yG = this.P.yG, need = Math.abs(yG - n.y);
      if (need < 0.04) {
        const g = { t: n.t + (this.bounded ? need / this.b : 0) + 0.005, y: yG, parent: this.V.length - 1 };
        if (g.t <= 1 && this.segFree(n, g)) { this.V.push(g); this.sol = this.V.length - 1; this.done = true; return false; }
      }
      return true;
    }
    pathIdx() { const P = []; for (let c = this.sol; c >= 0; c = this.V[c].parent) P.push(c); return P.reverse(); }
    render() {
      this.stats.v.set(this.V.length); this.stats.back.set(this.back ? `<span class="no">${this.back}</span>` : 0);
      this.stats.clip.set(this.bounded ? this.clips : "—");
      if (this.sol !== null) {
        const P = this.pathIdx(), nb = P.filter((i) => this.V[i].backward).length;
        this.stats.sol.set(nb ? '<span class="no">非法</span>' : `<span class="yes">t = ${this.V[this.sol].t.toFixed(2)}</span>`);
        this.msg.innerHTML = nb ? `找到的「解」里有 <b>${nb}</b> 段时间倒流——对称度量会把样本连到「未来」的顶点上，路径不是时间单调的。改用 ρ_X。` :
          "所有边都沿时间前进：ρ_X 把「过去」的顶点到样本的距离设为 ∞，单棵树就自动保证时间单调。";
      } else {
        this.stats.sol.set(this.done ? '<span class="no">未找到</span>' : "—");
        this.msg.innerHTML = this.done ? "顶点数到上限了还没连到目标线。速度上限太小时，可能根本赶不上闸门打开的时机。" :
          (this.metric === "rhoX" ? "最近点只在比样本<b>更早</b>的顶点中找（式 7.3 的第二行）；打开速度上限时，新边被压进速度锥里。注意 ρ_X 只看 |q − q'|、不管早了多久，常常挑中一个「很久以前」、早已被堵死的顶点。" :
            this.metric === "rhoXt" ? "（补充）在 ρ_X 上再加时间差 t' − t：仍然只连「过去」的顶点，但不再偏爱很早以前的顶点。在「走廊」里比纯 ρ_X 容易成功得多。" :
            "最近点按 (t, q) 平面的欧氏距离找——它不知道时间只能向前。");
      }
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const P of this.P.polys) st.poly(P, C.alpha(col.wall, 0.75), col.wall, 1);
      // 目标线与起点
      st.line({ x: 0, y: this.P.yG }, { x: 1, y: this.P.yG }, col.goal, 2.2);
      st.text("X_G", { x: 0.985, y: this.P.yG }, col.goal, { align: "right", dy: -10, weight: 650 });
      // 速度锥（图 7.3）
      const cone = (p, a) => {
        if (!this.bounded) return;
        const L = 0.25, b = this.b;
        st.poly([p, { x: p.x + L, y: p.y + b * L }, { x: p.x + L, y: p.y - b * L }], C.alpha(col.warn, a), C.alpha(col.warn, Math.min(1, a * 3)), 1);
      };
      if (this.hover) cone(this.hover, 0.18);
      for (const v of this.V) if (v.parent >= 0) {
        const p = this.V[v.parent];
        st.line({ x: p.t, y: p.y }, { x: v.t, y: v.y }, v.backward ? col.bad : C.alpha(col.accent, 0.75), v.backward ? 1.8 : 1.1, v.backward ? [3, 2] : null);
      }
      for (const v of this.V) { ctx.fillStyle = v.backward ? col.bad : col.accent; ctx.fillRect(st.X(v.t) - 1.5, st.Y(v.y) - 1.5, 3, 3); }
      if (this.sol !== null) { const P = this.pathIdx().map((i) => ({ x: this.V[i].t, y: this.V[i].y })); st.polyline(P, col.path, 3); }
      st.dot({ x: 0, y: this.P.yI }, 6, col.start, col.surface, 2);
      st.text("x_I", { x: 0, y: this.P.yI }, col.start, { align: "left", dx: 9, dy: -10, weight: 650 });
      st.text("t →", { x: 1, y: 0 }, col.muted, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11.5 });
      st.text("q", { x: 0, y: 1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 3, size: 11.5 });
    }
  }

  // =================================================================
  // 组件 3：图 7.2 —— 单元不按时间切成柱体时，「可达」不再有传递性
  // =================================================================
  class Transitivity {
    constructor(root) {
      // 三个单元从下到上：C3、C2、C1（同图 7.2）；q 区间相邻，t 区间可拖动
      this.cells = [
        { name: "C₁", q0: 0.62, q1: 0.84, t0: 0.5, t1: 0.86 },
        { name: "C₂", q0: 0.4, q1: 0.62, t0: 0.27, t1: 0.58 },
        { name: "C₃", q0: 0.18, q1: 0.4, t0: 0.1, t1: 0.36 },
      ];
      this.start = 0; this.slabs = false;
      const body = C.frame(root, "单元必须是 T 上的柱体", "图 7.2：拖动单元的左右边改变它的时间范围；点一个单元把它设为出发单元");
      this.st = new C.Stage({ view: [0, 1, 0, 1], maxW: 520, aspect: 0.72, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.pick(p), onMove: (p, d) => this.dragTo(p, d), onUp: (p, d) => { if (!d.moved) { this.start = d.i; this.update(); } },
        cursor: (p) => { const d = this.pick(p, true); return d ? (d.edge ? "ew-resize" : "pointer") : null; } });
      this.cS = C.check("按 T 切成柱体（在所有端点处竖直切开）", this.slabs, (v) => { this.slabs = v; this.update(); });
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.cS), h("div", { class: "split" }, this.st.wrap, this.out));
      this.update();
    }
    pick(p, quiet) {
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (p.y < c.q0 || p.y > c.q1) continue;
        if (Math.abs(p.x - c.t0) < 0.02) return { i, edge: "t0" };
        if (Math.abs(p.x - c.t1) < 0.02) return { i, edge: "t1" };
        if (p.x > c.t0 && p.x < c.t1) return { i, edge: null, x0: p.x, a: c.t0, b: c.t1 };
      }
      return null;
    }
    dragTo(p, d) {
      const c = this.cells[d.i];
      if (d.edge === "t0") c.t0 = C.clamp(p.x, 0.02, c.t1 - 0.05);
      else if (d.edge === "t1") c.t1 = C.clamp(p.x, c.t0 + 0.05, 0.98);
      else { const dx = C.clamp(p.x - d.x0, 0.02 - d.a, 0.98 - d.b); c.t0 = d.a + dx; c.t1 = d.b + dx; }
      d.moved = true; this.update();
    }
    // 相邻单元之间共享边界的时间窗 (a, b)
    windowOf(A, B) {
      const adj = Math.abs(A.q1 - B.q0) < 1e-9 || Math.abs(A.q0 - B.q1) < 1e-9;
      if (!adj) return null;
      const a = Math.max(A.t0, B.t0), b = Math.min(A.t1, B.t1);
      return a < b ? [a, b] : null;
    }
    // 真实可达：从出发单元的最早时刻开始，按「最早到达时刻」传播（只能在时间窗内、时间向前穿过边界）
    trueReach(s) {
      const n = this.cells.length, E = Array(n).fill(Infinity); E[s] = this.cells[s].t0;
      for (let it = 0; it < n; it++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j || E[i] === Infinity) continue;
        const w = this.windowOf(this.cells[i], this.cells[j]);
        if (w && E[i] < w[1]) { const c = Math.max(E[i], w[0]); if (c < E[j]) E[j] = c; }
      }
      return E;
    }
    // 「直接可达」关系的传递闭包（错误的推理）
    naiveReach(s) {
      const n = this.cells.length, R = new Set([s]), Q = [s];
      while (Q.length) { const i = Q.shift(); for (let j = 0; j < n; j++) if (!R.has(j) && this.windowOf(this.cells[i], this.cells[j])) { R.add(j); Q.push(j); } }
      return R;
    }
    // 按所有端点切成时间片后的小单元图：同一片里上下相邻可以互通，同一单元的相邻片只能向后走
    slabGraph(s) {
      const T = [...new Set(this.cells.flatMap((c) => [c.t0, c.t1]))].sort((a, b) => a - b);
      const pieces = [];
      this.cells.forEach((c, i) => { for (let k = 0; k + 1 < T.length; k++) if (T[k] >= c.t0 - 1e-9 && T[k + 1] <= c.t1 + 1e-9) pieces.push({ i, k, a: T[k], b: T[k + 1] }); });
      const id = (i, k) => pieces.findIndex((p) => p.i === i && p.k === k);
      const edges = [];
      pieces.forEach((p, u) => {
        const f = id(p.i, p.k + 1); if (f >= 0) edges.push([u, f, "time"]);
        pieces.forEach((q, v) => { if (u !== v && q.k === p.k && this.windowOf(this.cells[p.i], this.cells[q.i])) edges.push([u, v, "cross"]); });
      });
      const seen = new Set(), Q = [];
      pieces.forEach((p, u) => { if (p.i === s) { seen.add(u); Q.push(u); } });
      while (Q.length) { const u = Q.shift(); for (const [a, b] of edges) if (a === u && !seen.has(b)) { seen.add(b); Q.push(b); } }
      return { T, pieces, edges, seen };
    }
    update() {
      const s = this.start, E = this.trueReach(s), N = this.naiveReach(s), n = this.cells.length;
      const rows = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const w = this.windowOf(this.cells[i], this.cells[j]);
        if (Math.abs(i - j) === 1) rows.push(h("li", null, `${this.cells[i].name} → ${this.cells[j].name}：`, w ? h("span", { class: "yes" }, `直接可达（在 t ∈ (${w[0].toFixed(2)}, ${w[1].toFixed(2)}) 穿过边界）`) : h("span", { class: "no" }, "不直接相通")));
      }
      const res = this.cells.map((c, j) => j === s ? null : h("tr", null, h("td", null, c.name),
        h("td", { class: "c" }, N.has(j) ? "可达" : "—"),
        h("td", { class: "c" }, E[j] < Infinity ? h("span", { class: "yes" }, `可达（最早 ${E[j].toFixed(2)}）`) : h("span", { class: "no" }, "不可达")))).filter(Boolean);
      this.sg = this.slabs ? this.slabGraph(s) : null;
      const slabLine = this.sg ? h("p", { class: "small", style: "margin:.4em 0 0" }, `切成 ${this.sg.T.length - 1} 个时间片、${this.sg.pieces.length} 个小单元后，小单元图上的可达（${this.cells.filter((c, j) => j !== s && this.sg.pieces.some((p, u) => p.i === j && this.sg.seen.has(u))).map((c) => c.name).join("、") || "无"}）与右列「真实」完全一致：每条边要么在同一时间片里上下穿过，要么沿时间前进一片，所以可达关系可以放心传递。`) : null;
      this.out.innerHTML = "";
      this.out.append(h("div", { class: "panel" }, h("div", { class: "panel-title" }, "相邻单元之间"), h("div", { class: "panel-body" }, h("ul", { style: "margin:0;padding-left:1.1em" }, rows))),
        h("div", { class: "table-wrap", style: "margin:.6em 0 0" }, h("table", { class: "data" },
          h("tr", null, h("th", null, `从 ${this.cells[s].name} 出发`), h("th", null, "按「直接可达」传递推断"), h("th", null, "真实（时间单调）")), res)), ...(slabLine ? [slabLine] : []));
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const s = this.start, E = this.trueReach(s);
      if (this.sg) {
        for (const t of this.sg.T) st.line({ x: t, y: 0.04 }, { x: t, y: 0.96 }, C.alpha(col.muted, 0.6), 1, [4, 4]);
      }
      this.cells.forEach((c, i) => {
        const reach = E[i] < Infinity;
        st.box({ x0: c.t0, y0: c.q0, x1: c.t1, y1: c.q1 }, i === s ? C.alpha(col.accent, 0.28) : reach ? C.alpha(col.ok, 0.2) : col.surface2, i === s ? col.accent : col.strong, i === s ? 2 : 1.2);
        st.text(c.name, { x: (c.t0 + c.t1) / 2, y: (c.q0 + c.q1) / 2 }, col.text, { size: 15, weight: 650 });
        if (reach && i !== s) st.line({ x: E[i], y: c.q0 }, { x: E[i], y: c.q1 }, col.ok, 2);
      });
      if (this.sg) {
        const ctr = (p) => ({ x: (p.a + p.b) / 2, y: (this.cells[p.i].q0 + this.cells[p.i].q1) / 2 + 0.06 });
        for (const [a, b, kind] of this.sg.edges) {
          const A = ctr(this.sg.pieces[a]), B = ctr(this.sg.pieces[b]);
          const on = this.sg.seen.has(a) && this.sg.seen.has(b);
          if (kind === "time") st.arrow(A, { x: B.x - 0.012, y: B.y }, on ? col.ok : C.alpha(col.muted, 0.6), 1.2, 6);
          else if (a < b) st.line(A, B, on ? col.ok : C.alpha(col.muted, 0.6), 1.2, [2, 2]);
        }
        for (let u = 0; u < this.sg.pieces.length; u++) st.dot(ctr(this.sg.pieces[u]), 3.2, this.sg.seen.has(u) ? col.ok : col.muted);
      }
      st.text("t →", { x: 1, y: 0 }, col.muted, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11.5 });
      st.text("q", { x: 0, y: 1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 3, size: 11.5 });
    }
  }

  // =================================================================
  // 组件 4：速度调节法（7.1.3 节，式 7.5，图 7.4、7.5）
  // =================================================================
  // 机器人：边长 0.1 的方块，沿 τ 从 x = 0.08 走到 x = 0.92（y = 0.5）；障碍：边长 0.1 的方块，按关键帧运动
  const ROB = { x0: 0.08, x1: 0.92, y: 0.5, half: 0.05 };
  const VT_PRESETS = {
    fig74: { name: "一个障碍：下去、横移、上来（图 7.4）", obs: [[{ t: 0, x: 0.3, y: 0.95 }, { t: 0.45, x: 0.3, y: 0.05 }, { t: 0.55, x: 0.72, y: 0.05 }, { t: 1, x: 0.72, y: 0.95 }]] },
    elev: { name: "两部电梯", obs: [
      [{ t: 0, x: 0.34, y: 0.05 }, { t: 0.25, x: 0.34, y: 0.95 }, { t: 0.5, x: 0.34, y: 0.05 }, { t: 0.75, x: 0.34, y: 0.95 }, { t: 1, x: 0.34, y: 0.05 }],
      [{ t: 0, x: 0.64, y: 0.95 }, { t: 0.2, x: 0.64, y: 0.05 }, { t: 0.45, x: 0.64, y: 0.95 }, { t: 0.7, x: 0.64, y: 0.05 }, { t: 0.95, x: 0.64, y: 0.95 }, { t: 1, x: 0.64, y: 0.8 }]] },
    back: { name: "进退两难：得沿 τ 后退", obs: [
      [{ t: 0, x: 0.164, y: 0.8 }, { t: 0.5625, x: 0.164, y: 0.05 }, { t: 1, x: 0.164, y: 0.05 }],
      [{ t: 0, x: 0.458, y: 0.95 }, { t: 0.2, x: 0.458, y: 0.5 }, { t: 0.56, x: 0.458, y: 0.5 }, { t: 0.74, x: 0.458, y: 0.05 }, { t: 1, x: 0.458, y: 0.05 }],
      [{ t: 0, x: 0.307, y: 0.05 }, { t: 0.0875, x: 0.307, y: 0.05 }, { t: 0.7625, x: 0.307, y: 0.95 }, { t: 1, x: 0.307, y: 0.95 }]] },
  };
  const tauX = (s) => ROB.x0 + (ROB.x1 - ROB.x0) * s;
  // 式 (7.5) 的 X_obs：障碍只在竖直运动或静止时出现在机器人所在的水平带里，所以每次穿越得到 (t, s) 平面里的一个矩形
  function xobsRects(obs) {
    const R = [], band = 2 * ROB.half, sw = (ROB.x1 - ROB.x0);
    for (const K of obs) {
      const mine = [];
      for (let i = 1; i < K.length; i++) {
        const a = K[i - 1], b = K[i];
        const inBand = (y) => Math.abs(y - ROB.y) < band;
        if (Math.abs(a.x - b.x) > 1e-9) { if (inBand(a.y) || inBand(b.y)) throw new Error("横移时不应穿过机器人的带"); continue; }
        let t0, t1;
        if (Math.abs(a.y - b.y) < 1e-12) { if (!inBand(a.y)) continue; t0 = a.t; t1 = b.t; }
        else {
          const tAt = (y) => a.t + (b.t - a.t) * (y - a.y) / (b.y - a.y);   // y(t) 是线性的
          t0 = tAt(ROB.y - band); t1 = tAt(ROB.y + band); if (t0 > t1) [t0, t1] = [t1, t0];
          t0 = Math.max(t0, a.t); t1 = Math.min(t1, b.t); if (t1 <= t0) continue;
        }
        const r = { t0, t1, s0: (a.x - band - ROB.x0) / sw, s1: (a.x + band - ROB.x0) / sw };   // 不截断到 [0,1]：s = 0、1 处也要算碰撞
        const last = mine[mine.length - 1];   // 同一个障碍连续几段的矩形首尾相接时合并成一个
        if (last && Math.abs(last.t1 - r.t0) < 1e-9 && Math.abs(last.s0 - r.s0) < 1e-9) last.t1 = r.t1; else mine.push(r);
      }
      R.push(...mine);
    }
    return R;
  }
  // 竖直单元分解（6.2.2 节的做法，沿时间轴扫描）。返回时间片、每片里的自由区间（小块）以及它们所属的单元
  function verticalDecomposition(R) {
    const eps = 1e-9;
    const T = [...new Set([0, 1, ...R.flatMap((r) => [r.t0, r.t1]).filter((t) => t > eps && t < 1 - eps)])].sort((a, b) => a - b);
    const pieces = [];
    for (let k = 0; k + 1 < T.length; k++) {
      const tm = (T[k] + T[k + 1]) / 2;
      const blk = R.filter((r) => r.t0 < tm && tm < r.t1).map((r) => [r.s0, r.s1]).sort((a, b) => a[0] - b[0]);
      let lo = 0;
      for (const [a, b] of blk) { if (a > lo + eps) pieces.push({ k, a: T[k], b: T[k + 1], lo, hi: a }); lo = Math.max(lo, b); }
      if (lo < 1 - eps) pieces.push({ k, a: T[k], b: T[k + 1], lo, hi: 1 });
    }
    // 在时刻 T_k 处，从矩形的角向上、向下延伸的竖直线段（直到碰到别的矩形或边界）
    const cuts = T.map((t) => {
      const segs = [], here = R.filter((r) => Math.abs(r.t0 - t) < eps || Math.abs(r.t1 - t) < eps);
      const blockers = R.filter((r) => r.t0 <= t + eps && t - eps <= r.t1);
      for (const r of here) {
        let up = 1, dn = 0;
        for (const o of blockers) { if (o === r) continue; if (o.s0 >= r.s1 - eps) up = Math.min(up, o.s0); if (o.s1 <= r.s0 + eps) dn = Math.max(dn, o.s1); }
        segs.push([dn, up]);
      }
      return segs;
    });
    const uf = new C.UnionFind(pieces.length), links = [];
    for (let u = 0; u < pieces.length; u++) for (let v = 0; v < pieces.length; v++) {
      const p = pieces[u], q = pieces[v];
      if (q.k !== p.k + 1) continue;
      const lo = Math.max(p.lo, q.lo), hi = Math.min(p.hi, q.hi);
      if (hi - lo <= eps) continue;
      links.push([u, v, lo, hi]);
      const cut = cuts[q.k].some(([c0, c1]) => c0 < hi - eps && c1 > lo + eps);
      if (!cut) uf.union(u, v);
    }
    const ids = new Map(); pieces.forEach((p, u) => { const r = uf.find(u); if (!ids.has(r)) ids.set(r, ids.size); p.cell = ids.get(r); });
    return { T, pieces, links, cuts, ncell: ids.size };
  }
  // 无速度上限：在小块图上找一条时间向前的路径（经过相邻小块公共边的中点）
  function cellPath(D) {
    const start = D.pieces.findIndex((p) => p.k === 0 && p.lo < 1e-9);
    if (start < 0) return null;
    const prev = new Map([[start, -1]]), Q = [start];
    let goal = -1;
    while (Q.length) {
      const u = Q.shift();
      if (D.pieces[u].hi > 1 - 1e-9) { goal = u; break; }
      for (const [a, b] of D.links) if (a === u && !prev.has(b)) { prev.set(b, a); Q.push(b); }
    }
    const reach = new Set(prev.keys());
    if (goal < 0) return { found: false, reach };
    const chain = []; for (let c = goal; c >= 0; c = prev.get(c)) chain.push(c); chain.reverse();
    const P = [{ x: 0, y: 0 }];
    for (let i = 1; i < chain.length; i++) { const l = D.links.find(([a, b]) => a === chain[i - 1] && b === chain[i]); P.push({ x: D.pieces[chain[i]].a, y: (l[2] + l[3]) / 2 }); }
    const last = D.pieces[goal], t0 = P[P.length - 1].x;
    P.push({ x: t0 + Math.min(0.03, (last.b - t0) / 2), y: 1 });
    return { found: true, reach, path: P, arrival: P[P.length - 1].x };
  }
  // 有速度上限 |ds/dt| ≤ b：在 (t, s) 网格上按时间分层做动态规划（最早到达，其次总位移最小）
  function speedPath(R, b, NS, KT) {
    NS = NS || 240; KT = KT || 240;
    const r = Math.max(1, Math.floor(b * NS / KT + 1e-9)), dt = 1 / KT;
    const blocked = (t, s) => R.some((q) => q.t0 < t && t < q.t1 && q.s0 < s && s < q.s1);
    let cost = new Float64Array(NS + 1).fill(Infinity); cost[0] = 0;
    const par = [];
    for (let k = 0; k < KT; k++) {
      const nc = new Float64Array(NS + 1).fill(Infinity), pk = new Int16Array(NS + 1).fill(-1);
      for (let s = 0; s <= NS; s++) {
        if (cost[s] === Infinity) continue;
        for (let d = -r; d <= r; d++) {
          const s2 = s + d; if (s2 < 0 || s2 > NS) continue;
          const t1 = (k + 1) * dt, sm = (s + s2) / 2 / NS;
          if (blocked(t1, s2 / NS) || blocked(t1 - dt / 2, sm)) continue;
          const c = cost[s] + Math.abs(d);
          if (c < nc[s2]) { nc[s2] = c; pk[s2] = s; }
        }
      }
      par.push(pk); cost = nc;
      if (cost[NS] < Infinity) {
        const P = []; let s = NS;
        for (let kk = k + 1; kk >= 0; kk--) { P.push({ x: kk * dt, y: s / NS }); if (kk > 0) s = par[kk - 1][s]; }
        return { found: true, path: P.reverse(), arrival: (k + 1) * dt, r };
      }
    }
    return { found: false, r };
  }
  function pathSAt(P, t) {
    if (t <= P[0].x) return P[0].y;
    for (let i = 1; i < P.length; i++) if (t <= P[i].x) { const a = P[i - 1], b = P[i]; return a.y + (b.y - a.y) * (t - a.x) / (b.x - a.x || 1); }
    return P[P.length - 1].y;
  }

  class VelocityTuning {
    constructor(root) {
      this.preset = "fig74"; this.mode = "speed"; this.b = 2; this.t = 0.3; this.showDec = true;
      const body = C.frame(root, "速度调节：先定路径 τ，再定时间函数 σ", "左：工作空间 W；右：状态空间 X = T × S（式 7.5）。目标是到达右图顶上的水平线 s = 1");
      this.stW = new C.Stage({ view: [0, 1, 0, 1], maxW: 300, onDraw: (ctx, st, col) => this.drawW(ctx, st, col) });
      this.stX = new C.Stage({ view: [0, 1, 0, 1], maxW: 420, aspect: 0.8, onDraw: (ctx, st, col) => this.drawX(ctx, st, col) });
      this.selP = C.select(Object.entries(VT_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.update(); });
      this.segM = C.seg([["cells", "无速度上限：竖直单元分解"], ["speed", "有速度上限：网格搜索"]], this.mode, (k) => { this.mode = k; this.update(); });
      this.sB = C.slider("速度上限 b = max|ds/dt|", 1, 8, 1, this.b, (v) => { this.b = v; if (this.mode === "speed") this.update(); }, (v) => String(v));
      this.cD = C.check("显示单元分解", this.showDec, (v) => { this.showDec = v; this.stX.draw(); });
      this.tl = new C.Timeline((u) => { this.t = u; this.stW.draw(); this.stX.draw(); }, { label: "t", dur: 6 });
      this.stats = { rect: C.stat("X_obs 的矩形"), cells: C.stat("2-单元"), reach: C.stat("可到达的单元"), arr: C.stat("到达 s = 1 的时刻") };
      this.msg = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP, this.segM), h("div", { class: "controls" }, this.sB, this.cD),
        h("div", { class: "split" }, this.stX.wrap, h("div", null, this.stW.wrap, h("div", { class: "small muted", style: "text-align:center" }, "工作空间：蓝 = 机器人 A，灰 = 移动障碍 O(t)"))),
        this.tl.el, h("div", { class: "stats" }, Object.values(this.stats)), this.msg);
      this.tl.set(this.t);
      this.update();
    }
    update() {
      const P = VT_PRESETS[this.preset];
      this.R = xobsRects(P.obs);
      this.D = verticalDecomposition(this.R);
      this.cp = cellPath(this.D);
      this.sp = this.mode === "speed" ? speedPath(this.R, this.b) : null;
      const sol = this.mode === "speed" ? this.sp : this.cp;
      this.stats.rect.set(this.R.length); this.stats.cells.set(this.D.ncell);
      const rc = new Set([...this.cp.reach].map((u) => this.D.pieces[u].cell));
      this.stats.reach.set(`${rc.size} / ${this.D.ncell}`);
      this.stats.arr.set(sol && sol.found ? sol.arrival.toFixed(3) : '<span class="no">到不了</span>');
      this.msg.innerHTML = this.mode === "cells" ?
        "速度不受限：蓝色路线图只连<b>沿时间向前</b>的相邻单元（左边的到右边的）。从任何一个挨着顶边的 2-单元都能直接冲上 s = 1——包括第一个单元，所以最短的解一步就到。" :
        (!this.sp.found ? `速度上限 b = ${this.b} 时，在 T = [0, 1] 内到不了 s = 1。` :
          `每个 Δt = 1/240 最多沿 τ 前进或后退 ${this.sp.r}/240 的路程（按时间分层的动态规划：最早到达，其次总位移最小）。` +
          (this.sp.path.some((p, i) => i && p.y < this.sp.path[i - 1].y - 1e-9) ? "这条路径<b>沿 τ 倒退</b>了一段——s 方向不必单调，只有 t 必须单调。" :
            this.sp.arrival < (this.R.length ? Math.min(...this.R.map((r) => r.t0)) : 1) + 0.1 ? "速度够大：机器人在障碍到来之前就从第一个 2-单元冲到了 s = 1（图 7.5 图题最后一句）。" : "机器人停下来等障碍过去，再继续前进。"));
      this.stW.draw(); this.stX.draw();
    }
    sol() { return this.mode === "speed" ? this.sp : this.cp; }
    drawX(ctx, st, col) {
      st.frame(col);
      const D = this.D;
      if (this.showDec) {
        const tints = [col.accentSoft, col.okSoft, col.warnSoft, col.surface3];
        for (const p of D.pieces) st.box({ x0: p.a, y0: p.lo, x1: p.b, y1: p.hi }, C.alpha(tints[p.cell % 4], 0.9), null);
        D.cuts.forEach((segs, k) => { for (const [a, b] of segs) st.line({ x: D.T[k], y: a }, { x: D.T[k], y: b }, C.alpha(col.muted, 0.9), 1, [4, 3]); });
        const seen = new Set();
        for (const p of D.pieces) if (!seen.has(p.cell)) { seen.add(p.cell); const all = D.pieces.filter((q) => q.cell === p.cell), mid = all[Math.floor(all.length / 2)]; st.text(String(p.cell + 1), { x: (mid.a + mid.b) / 2, y: (mid.lo + mid.hi) / 2 }, col.muted, { size: 11 }); }
      }
      for (const r of this.R) st.box({ x0: r.t0, y0: Math.max(0, r.s0), x1: r.t1, y1: Math.min(1, r.s1) }, C.alpha(col.wall, 0.85), col.wall);
      st.line({ x: 0, y: 1 }, { x: 1, y: 1 }, col.goal, 3);
      if (this.mode === "cells") {
        // 图 7.5 那样的路线图：每个小块一个样本点，经过公共边的中点连到下一时间片的小块；挨着顶边的小块连到 s = 1
        const ctr = (p) => ({ x: (p.a + p.b) / 2, y: (p.lo + p.hi) / 2 });
        const rc = C.alpha(col.accent, 0.75);
        for (const [u, v, lo, hi] of D.links) { const m = { x: D.pieces[v].a, y: (lo + hi) / 2 }; st.line(ctr(D.pieces[u]), m, rc, 1.1); st.arrow(m, ctr(D.pieces[v]), rc, 1.1, 6); }
        for (const p of D.pieces) { const c = ctr(p); st.dot(c, 2.6, col.accent); if (p.hi > 1 - 1e-9) st.arrow(c, { x: c.x, y: 0.995 }, rc, 1.1, 6); }
      }
      const s = this.sol();
      if (s && s.found) st.polyline(s.path, col.path, 2.6);
      st.line({ x: this.t, y: 0 }, { x: this.t, y: 1 }, C.alpha(col.accent, 0.8), 1.2);
      if (s && s.found) st.dot({ x: this.t, y: this.sAt() }, 5, col.start, col.surface, 1.5);
      st.text("t →", { x: 1, y: 0 }, col.muted, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11.5 });
      st.text("s", { x: 0, y: 1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 4, size: 11.5 });
    }
    sAt() { const s = this.sol(); if (!s || !s.found) return 0; return this.t >= s.arrival ? 1 : C.clamp(pathSAt(s.path, this.t), 0, 1); }
    drawW(ctx, st, col) {
      st.frame(col);
      const P = VT_PRESETS[this.preset];
      st.line({ x: ROB.x0, y: ROB.y }, { x: ROB.x1, y: ROB.y }, C.alpha(col.start, 0.6), 1.5, [5, 4]);
      st.text("τ", { x: ROB.x1, y: ROB.y }, col.start, { dx: 8, dy: -8, weight: 650 });
      for (const K of P.obs) {
        st.polyline(K.map((k) => ({ x: k.x, y: k.y })), C.alpha(col.muted, 0.6), 1, [3, 3]);
        const c = plAt(K, this.t);
        st.box({ x0: c.x - 0.05, y0: c.y - 0.05, x1: c.x + 0.05, y1: c.y + 0.05 }, C.alpha(col.wall, 0.85), col.wall);
      }
      const x = tauX(this.sAt());
      st.box({ x0: x - ROB.half, y0: ROB.y - ROB.half, x1: x + ROB.half, y1: ROB.y + ROB.half }, C.alpha(col.start, 0.85), col.start, 1.5);
      st.text("A", { x, y: ROB.y }, "#fff", { weight: 700, size: 11 });
      st.text(`t = ${this.t.toFixed(2)}`, { x: 0.03, y: 0.97 }, col.text2, { align: "left", base: "top" });
    }
  }

  CH7.time = { TimeVaryingX, TimeRRT, Transitivity, VelocityTuning, plAt, planTimeGrid, rhoX, inObs1D, xobsRects, verticalDecomposition, cellPath, speedPath, VT_PRESETS, TV_PRESETS, RRT_PRESETS };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='tv-xspace']").forEach((el) => el._w = new TimeVaryingX(el));
    document.querySelectorAll("[data-widget='tv-rdt']").forEach((el) => el._w = new TimeRRT(el));
    document.querySelectorAll("[data-widget='tv-transitivity']").forEach((el) => el._w = new Transitivity(el));
    document.querySelectorAll("[data-widget='velocity-tuning']").forEach((el) => el._w = new VelocityTuning(el));
  });
})();
