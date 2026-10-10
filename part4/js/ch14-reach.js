/* 14.2 节：可达集（例 14.2、例 14.3 / 图 14.4）、可达树与可达图（例 14.4 / 图 14.6）、
   圆上稠密的顶点、曼哈顿模型的分辨率完备（式 14.9）、交错搜索（图 14.7）、机动自动机（图 14.8） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH14;

  // ---------------------------------------------------------------
  // 组件：例 14.2 简单不等式约束下的可达集
  // ---------------------------------------------------------------
  const CONSTRAINTS = {
    pos: { name: "u₁ > 0", ok: (u) => u.x > 1e-3 },
    nonpos: { name: "u₁ ≤ 0", ok: (u) => u.x <= 0 },
    quad: { name: "u₁ > 0 且 u₂ > 0", ok: (u) => u.x > 1e-3 && u.y > 1e-3 },
    line: { name: "a u₁ + b u₂ = 0", ok: null },
    disc: { name: "u₁² + u₂² ≤ 1", ok: (u) => u.x * u.x + u.y * u.y <= 1 },
  };
  class ReachSimple {
    constructor(root) {
      this.kind = "pos"; this.q0 = { x: -0.6, y: -0.3 }; this.ang = 30; this.t = 1.2; this.seed = 3;
      const body = C.frame(root, "简单约束下的可达集", "例 14.2：X = C = ℝ²，ẋ = u₁，ẏ = u₂；拖动 q₀");
      this.st = new C.Stage({
        view: [-3, 3, -2, 2], aspect: 0.66, maxW: 600, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.q0) < 0.3 ? "q" : null), onMove: (p) => { this.q0 = { x: C.clamp(p.x, -2.9, 2.9), y: C.clamp(p.y, -1.9, 1.9) }; this.st.draw(); },
        cursor: (p) => (C.dist(p, this.q0) < 0.3 ? "grab" : "default"),
      });
      this.segK = C.seg(Object.entries(CONSTRAINTS).map(([k, c]) => [k, c.name]), this.kind, (k) => { this.kind = k; this.render(); });
      this.sAng = C.slider("法向量 (a, b) 的方向", 0, 180, 1, this.ang, (v) => { this.ang = v; this.render(); }, (v) => v + "°");
      this.sT = C.slider("时间上限 t", 0.1, 2.5, 0.05, this.t, (v) => { this.t = v; this.render(); }, (v) => v.toFixed(2));
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segK), h("div", { class: "controls" }, this.sAng, this.sT, C.button("换一批轨迹", () => { this.seed = C.newSeed(); this.st.draw(); }, "small")),
        this.st.wrap, this.msg,
        C.legend([[C.cv("accentSoft"), "R(q₀, 𝒰)"], [C.cv("accent"), "满足约束的随机动作轨迹"], [C.cv("warn"), "时间受限可达集 R(q₀, 𝒰, t)"]]));
      this.render();
    }
    render() {
      this.sAng.style.display = this.kind === "line" ? "" : "none";
      this.sT.style.display = this.kind === "disc" || this.kind === "line" ? "" : "none";
      const M = {
        pos: "u₁ > 0（就是 13.1.1 节的 ẋ > 0）：只能向右，可达集是竖线 x = x₀ 右边的<b>开</b>半平面（虚线边界不含在内）。",
        nonpos: "u₁ ≤ 0：可达集是竖线左边的<b>闭</b>半平面（u₁ = 0 时可以沿竖线上下走，所以边界在内）。",
        quad: "u₁ > 0 且 u₂ > 0：可达集是一个象限。注意每条轨迹都在象限里，但速度方向可以随时变。",
        line: "a u₁ + b u₂ = 0：速度永远平行于同一条直线，可达集就是过 q₀、法向量为 (a, b) 的那条直线。换不同的 q₀ 得到一族平行线——这叫<b>叶状结构 foliation</b>，每条线叫一片<b>叶 leaf</b>。这时约束是可积的，系统被困在比 C 低一维的子流形上。",
        disc: "u₁² + u₂² ≤ 1：任何状态都能到达任何状态，R(q₀, 𝒰) = ℝ²。时间受限可达集 R(q₀, 𝒰, t) 是以 q₀ 为圆心、半径 t 的闭圆盘；它的边界就是「代价到达 = t」的等值线，像一圈向外传播的波前。",
      };
      this.msg.innerHTML = M[this.kind];
      this.st.draw();
    }
    sampleU(r) {
      const k = this.kind;
      for (let it = 0; it < 200; it++) {
        const u = { x: r() * 2 - 1, y: r() * 2 - 1 };
        if (k === "line") { const a = (this.ang * Math.PI) / 180, s = r() * 2 - 1; return { x: -Math.sin(a) * s, y: Math.cos(a) * s }; }
        if (CONSTRAINTS[k].ok(u)) return u;
      }
      return { x: 0, y: 0 };
    }
    draw(ctx, st, col) {
      st.frame(col);
      const [x0, x1, y0, y1] = st.view, q = this.q0, fill = C.alpha(col.accent, 0.16);
      if (this.kind === "pos") { st.rectW(q.x, y0, x1, y1, fill, null); st.line({ x: q.x, y: y0 }, { x: q.x, y: y1 }, col.accent, 1.5, [6, 5]); }
      if (this.kind === "nonpos") { st.rectW(x0, y0, q.x, y1, fill, null); st.line({ x: q.x, y: y0 }, { x: q.x, y: y1 }, col.accent, 2); }
      if (this.kind === "quad") { st.rectW(q.x, q.y, x1, y1, fill, null); st.line({ x: q.x, y: q.y }, { x: q.x, y: y1 }, col.accent, 1.5, [6, 5]); st.line({ x: q.x, y: q.y }, { x: x1, y: q.y }, col.accent, 1.5, [6, 5]); }
      if (this.kind === "disc") { st.rectW(x0, y0, x1, y1, fill, null); st.circle(q, this.t, C.alpha(col.warn, 0.18), col.warn, 2); }
      if (this.kind === "line") {
        const a = (this.ang * Math.PI) / 180, d = { x: -Math.sin(a), y: Math.cos(a) };
        for (let k = -12; k <= 12; k++) {   // 叶状结构：一族平行线
          const n = { x: Math.cos(a), y: Math.sin(a) }, c = { x: q.x + n.x * k * 0.35, y: q.y + n.y * k * 0.35 };
          st.line({ x: c.x - d.x * 8, y: c.y - d.y * 8 }, { x: c.x + d.x * 8, y: c.y + d.y * 8 }, k === 0 ? col.accent : C.alpha(col.muted, 0.35), k === 0 ? 3 : 1);
        }
        st.line({ x: q.x - d.x * this.t, y: q.y - d.y * this.t }, { x: q.x + d.x * this.t, y: q.y + d.y * this.t }, col.warn, 5);
        st.arrow(q, { x: q.x + Math.cos(a) * 0.5, y: q.y + Math.sin(a) * 0.5 }, col.text2, 1.5);
        st.text("(a, b)", { x: q.x + Math.cos(a) * 0.62, y: q.y + Math.sin(a) * 0.62 }, col.text2, { size: 11 });
      }
      // 随机的分段常值动作轨迹
      const r = C.rng(this.seed);
      for (let n = 0; n < 14; n++) {
        let p = { ...q }; const P = [p];
        for (let k = 0; k < 6; k++) { const u = this.sampleU(r), dt = 0.12 + r() * 0.25; p = { x: p.x + u.x * dt, y: p.y + u.y * dt }; P.push(p); }
        st.polyline(P, C.alpha(col.accent, 0.75), 1.4);
      }
      st.mark(q, col.start, "q₀", col);
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 14.3 / 图 14.4 简单车的时间受限可达集（蒙特卡罗投影到 xy 平面）
  // ---------------------------------------------------------------
  class CarReach {
    constructor(root) {
      this.t = 1.0; this.N = 60000; this.show = { dub: true, wrong: true, rs: false }; this.seed = 7;
      const body = C.frame(root, "简单车的时间受限可达集", "例 14.3：ρ_min = 1、速率 ≤ 1，R(q, 𝒰, t) 投影到 xy 平面（车在原点，朝右）");
      this.st = new C.Stage({ view: [-1.3, 1.3, -1.3, 1.3], maxW: 520, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sT = C.slider("时间 t", 0.2, 7, 0.05, this.t, (v) => { this.t = v; this.compute(); }, (v) => v.toFixed(2));
      this.chips = {
        dub: C.chip("Dubins（只前进）", true, (on) => { this.show.dub = on; this.st.draw(); }),
        wrong: C.chip("「错误」猜测：Dubins ∪ 镜像", true, (on) => { this.show.wrong = on; this.st.draw(); }),
        rs: C.chip("Reeds–Shepp 的真实可达集", false, (on) => { this.show.rs = on; this.st.draw(); }),
      };
      this.stats = { extra: C.stat("RS 可达、但「错误猜测」里没有的格子") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sT, C.button("重新采样", () => { this.seed = C.newSeed(); this.compute(); }, "small")),
        h("div", { class: "chips" }, Object.values(this.chips)),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cv("accent"), "Dubins 车"], [C.cv("warn"), "「错误」猜测的轮廓（图 14.4b）"], [C.cv("alive2"), "Reeds–Shepp 车"], [C.cv("ok"), "RS 多出来的部分"]]))));
      this.compute();
    }
    // 随机分段常值动作：K 段，每段 v ∈ V、w ∈ {−1, 0, 1}，总时长 ≤ t
    sample(V, r) {
      const K = 1 + Math.floor(r() * 6);
      let s = { x: 0, y: 0, th: 0 }, left = this.t * (r() < 0.7 ? 1 : r());
      for (let k = 0; k < K && left > 1e-9; k++) {
        const dt = k === K - 1 ? left : left * r() * (r() < 0.3 ? 0.25 : 1);
        const v = V[Math.floor(r() * V.length)], w = [-1, 0, 1][Math.floor(r() * 3)] * Math.abs(v) * (r() < 0.85 ? 1 : r());
        s = C.carStep(s, v, w, dt); left -= dt;
      }
      return s;
    }
    compute() {
      const R = Math.max(1.0, this.t) * 1.12;
      this.st.setView([-R, R, -R, R]);
      const n = (this.n = 150), grid = (p) => { const i = Math.floor(((p.x + R) / (2 * R)) * n), j = Math.floor(((p.y + R) / (2 * R)) * n); return i >= 0 && i < n && j >= 0 && j < n ? j * n + i : -1; };
      const dub = new Uint8Array(n * n), rs = new Uint8Array(n * n), r = C.rng(this.seed);
      for (let k = 0; k < this.N; k++) { const g = grid(this.sample([1], r)); if (g >= 0) dub[g] = 1; }
      for (let k = 0; k < this.N * 1.5; k++) { const g = grid(this.sample([1, -1], r)); if (g >= 0) rs[g] = 1; }
      // 把 RS 里的真实可达点也补上 Dubins 及其镜像（RS 包含它们）
      const wrong = new Uint8Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (dub[j * n + i]) { wrong[j * n + i] = 1; wrong[j * n + (n - 1 - i)] = 1; }
      for (let k = 0; k < n * n; k++) if (wrong[k]) rs[k] = 1;
      let extra = 0; for (let k = 0; k < n * n; k++) if (rs[k] && !wrong[k]) extra++;
      this.grids = { dub, rs, wrong, R }; this.extra = extra;
      this.stats.extra.set(extra);
      const t = this.t;
      this.msg.innerHTML = (t <= Math.PI / 2 ? "t ≤ π/2：车最多转 π/2，Dubins 的可达集是图 14.4a 那样向右鼓出的一块（真实的可达集是 xyθ 空间里的三维区域，这里只是它在 xy 上的投影）。" :
        t < 2 * Math.PI ? "t 增大：Dubins 车开始能绕到身后，可达集慢慢把原点包起来。" :
          "t > 2π：Dubins 车可以开一整圈，t → ∞ 时 R(q, 𝒰) = C——没有倒挡只是需要更多的回旋余地。") +
        " 对 Reeds–Shepp 车，把 Dubins 的可达集和它的镜像拼起来（橙色轮廓、图 14.4b）<b>是错的</b>：任意短的时间里车都能像侧方停车那样来回「蹭」着横挪，所以 R(q, 𝒰, t) 总包含 q 的一个开邻域（绿色）。这就是 15.4 节的<b>小时间可控性</b>。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const G = this.grids; if (!G) return;
      const n = this.n, R = G.R, box = [-R, R, -R, R];
      const a = C.rgb(col.accent), p = C.rgb(col.alive2), g = C.rgb(col.ok);
      if (this.show.rs) C.heat(st, n, n, box, G.rs.map((v, k) => (v ? (G.wrong[k] ? 1 : 2) : 0)), (v) => (v === 1 ? [p[0], p[1], p[2], 120] : v === 2 ? [g[0], g[1], g[2], 230] : null));
      if (this.show.dub) C.heat(st, n, n, box, G.dub, (v) => (v ? [a[0], a[1], a[2], 150] : null));
      if (this.show.wrong) {
        // 轮廓：相邻格子取值不同的地方
        ctx.fillStyle = col.warn; const cw = (2 * R) / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          const v = G.wrong[j * n + i]; if (!v) continue;
          if (i === 0 || j === 0 || i === n - 1 || j === n - 1 || !G.wrong[j * n + i - 1] || !G.wrong[j * n + i + 1] || !G.wrong[(j - 1) * n + i] || !G.wrong[(j + 1) * n + i]) {
            const x = -R + i * cw, y = -R + j * cw; ctx.fillRect(st.X(x), st.Y(y + cw), Math.max(1.5, cw * st.sx), Math.max(1.5, cw * st.sy));
          }
        }
      }
      st.car({ x: 0, y: 0, th: 0 }, Math.min(0.22, R * 0.12), col.alive, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：例 14.4 / 图 14.6 可达树与可达图
  // ---------------------------------------------------------------
  const TREE_SYS = {
    dubins: { name: "Dubins 车（3 个动作）", dt: Math.PI / 2, acts: [[1, 0, "S"], [1, 1, "L"], [1, -1, "R"]], kmax: 5 },
    rs: { name: "Reeds–Shepp 车（6 个动作，习题 3）", dt: Math.PI / 2, acts: [[1, 0, "S"], [1, 1, "L"], [1, -1, "R"], [-1, 0, "S⁻"], [-1, 1, "L⁻"], [-1, -1, "R⁻"]], kmax: 4 },
    diff: { name: "差速驱动 (1,0)/(0,1)/(1,1)（习题 6）", dt: Math.PI / 2, acts: [[0.5, 1, "(1,0)"], [0.5, -1, "(0,1)"], [1, 0, "(1,1)"]], kmax: 5 },
    grid: { name: "ẋ = u 的曼哈顿模型 (14.9)", dt: 1, acts: [[1, 0, "→"], [1, 0, "↑"], [1, 0, "←"], [1, 0, "↓"]], kmax: 6, manhattan: true },
  };
  class ReachTree {
    constructor(root) {
      this.sys = "dubins"; this.k = 2; this.merge = false; this.hover = null;
      const body = C.frame(root, "可达树 T_r 与可达图 G_r", "例 14.4 / 图 14.6：离散时间模型下从 x₀ 出发的所有动作序列");
      this.st = new C.Stage({ view: [-7, 7, -7, 7], maxW: 540, onDraw: (ctx, st, col) => this.draw(ctx, st, col), onHover: (p) => this.onHover(p), onLeave: () => { this.hover = null; this.st.draw(); } });
      this.sel = C.select(Object.entries(TREE_SYS).map(([k, s]) => [k, s.name]), this.sys, (k) => { this.sys = k; this.sK.input.max = TREE_SYS[k].kmax; if (this.k > TREE_SYS[k].kmax) { this.k = TREE_SYS[k].kmax; this.sK.setValue(this.k); } this.build(); });
      this.sK = C.slider("阶段数 k", 1, 5, 1, this.k, (v) => { this.k = v; this.build(); });
      this.segM = C.seg([["tree", "可达树 T_r（不合并）"], ["graph", "可达图 G_r（合并重复状态）"]], "tree", (m) => { this.merge = m === "graph"; this.build(); });
      this.tbl = h("div", { class: "table-wrap" });
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, h("label", null, "系统 ", this.sel), this.sK), h("div", { class: "controls" }, this.segM),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.tbl, this.msg,
          C.legend([[C.cv("text2"), "边（状态轨迹 x̃_e）= swath"], [C.cv("ok"), "顶点", true], [C.cv("warn"), "鼠标处：被几条动作序列到达", true]]))));
      this.build();
    }
    step(s, a) {
      const S = TREE_SYS[this.sys];
      if (S.manhattan) { const d = [[1, 0], [0, 1], [-1, 0], [0, -1]][S.acts.indexOf(a)]; return { x: s.x + d[0] * S.dt, y: s.y + d[1] * S.dt, th: 0 }; }
      return C.carStep(s, a[0], a[1], S.dt);
    }
    key(s) { return `${Math.round(s.x * 1e5)},${Math.round(s.y * 1e5)},${Math.round(C.mod2pi(s.th + 1e-7) * 1e4) % Math.round(C.TAU * 1e4)}`; }
    build() {
      const S = TREE_SYS[this.sys], m = S.acts.length;
      const root = { x: 0, y: 0, th: 0 };
      // 总是把整棵树展开：count 记录每个（合并后的）状态被多少个树顶点（= 多少条动作序列）表示
      let level = [root]; const count = new Map([[this.key(root), { s: root, seqs: 1, lvl: 0 }]]), edgeSet = new Map();
      this.E = []; this.rows = []; let treeTotal = 1;
      for (let k = 1; k <= this.k; k++) {
        const next = [];
        for (const v of level) S.acts.forEach((a, ai) => {
          const s2 = this.step(v, a), kk = this.key(s2);
          if (this.merge) { const ek = this.key(v) + "|" + ai; if (!edgeSet.has(ek)) edgeSet.set(ek, { from: v, a }); }
          else this.E.push({ from: v, a });
          const ex = count.get(kk); if (ex) ex.seqs++; else count.set(kk, { s: s2, seqs: 1, lvl: k });
          next.push(s2);
        });
        treeTotal += Math.pow(m, k); level = next;
        this.rows.push({ k, leaves: Math.pow(m, k), tree: treeTotal, graph: count.size });
      }
      if (this.merge) this.E = [...edgeSet.values()];
      this.seen = count; this.nV = this.merge ? count.size : treeTotal;
      this.V = [...count.values()];
      let R = 1; for (const v of this.V) R = Math.max(R, Math.abs(v.s.x), Math.abs(v.s.y));
      R = R * 1.08 + 0.3; this.st.setView([-R, R, -R, R]);
      this.tbl.innerHTML = `<table class="data"><thead><tr><th>k</th><th>第 k 阶段新增（树）= ${m}<sup>k</sup></th><th>树的顶点总数</th><th>可达图的顶点数</th></tr></thead><tbody>${this.rows.map((r) => `<tr><td>${r.k}</td><td>${r.leaves}</td><td>${r.tree}</td><td>${r.graph}</td></tr>`).join("")}</tbody></table>`;
      const last = this.rows[this.rows.length - 1];
      this.msg.innerHTML = (this.sys === "dubins" ? `Δt 取得让左/右转恰好转过 π/2（ρ_min = 1 时 Δt = π/2）。树的第 k 阶段新增 3<sup>k</sup> 个顶点；k = 4 时是 81 + 27 + 9 + 3 + 1 = 121 个。` :
        this.sys === "grid" ? "Δt = 1、四个动作：可达图就是熟悉的二维网格（例 2.1），顶点是所有整数坐标点。树却仍然按 4<sup>k</sup> 爆炸——合并重复状态在这里收益巨大。" :
          this.sys === "rs" ? "Reeds–Shepp 车多了三个倒车动作，6<sup>k</sup> 增长得更快；很多动作序列回到同一个状态（例如前进再后退）。" :
            "差速驱动的参数是我们补充的：轮半径 r = 1、轮距 L = 1、Δt = π/2；(1,0) 只转右轮（向左绕左轮转）、(0,1) 只转左轮、(1,1) 直行。") +
        ` 现在 k = ${last.k}：树有 ${last.tree} 个顶点，合并重复状态后的可达图只有 ${last.graph} 个。` +
        (this.merge ? " 把鼠标移到顶点上，看它被多少条不同的动作序列到达。" : " 切到「可达图」看合并。");
      this.st.draw();
    }
    onHover(p) {
      let best = null, bd = Infinity;
      for (const v of this.seen.values()) { const d = Math.hypot(v.s.x - p.x, v.s.y - p.y); if (d < bd) { bd = d; best = v; } }
      this.hover = best && this.st.pxDist(best.s, p) < 10 ? best : null; this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const S = TREE_SYS[this.sys];
      ctx.lineCap = "round";
      for (const e of this.E) {
        if (S.manhattan) { const s2 = this.step(e.from, e.a); st.line(e.from, s2, C.alpha(col.text2, 0.8), 1.4); continue; }
        st.polyline(C.carSample(e.from, e.a[0], e.a[1], S.dt, 16), C.alpha(col.text2, e.a[0] < 0 ? 0.45 : 0.8), 1.2, e.a[0] < 0 ? [4, 3] : null);
      }
      const r = this.nV > 400 ? 2 : 3;
      for (const v of this.seen.values()) st.dot(v.s, r, col.ok);
      st.car({ x: 0, y: 0, th: 0 }, Math.min(0.9, st.view[1] * 0.08), col.alive, col.text);
      if (this.hover) {
        st.dot(this.hover.s, 6, null, col.warn, 2.5);
        st.text(`${this.hover.seqs} 条序列 · 第 ${this.hover.lvl} 阶段`, this.hover.s, col.warn, { dy: -14, weight: 650, size: 11.5 });
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件：一直左转时，圆上的顶点（14.2.2 节「Resolution completeness for ẋ = f(x,u)」）
  // ---------------------------------------------------------------
  class DenseCircle {
    constructor(root) {
      this.rho = 1; this.k = 12;
      const body = C.frame(root, "一直左转：顶点会回到原处吗？", "Δt = 1，单位速度，左转半径 ρ_min；第 k 个顶点在圆上转过 k/ρ_min 弧度");
      this.st = new C.Stage({ view: [-1.25, 1.25, -1.25, 1.25], maxW: 340, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segR = C.seg([["1", "ρ_min = 1（周长 2π）"], [String(1 / Math.PI), "ρ_min = 1/π（周长 2）"], [String(2 / Math.PI), "ρ_min = 2/π（周长 4）"], [String(5 / (2 * Math.PI)), "ρ_min = 5/(2π)（周长 5）"]], "1", (v) => { this.rho = +v; this.render(); });
      this.sK = C.slider("步数 k", 1, 600, 1, this.k, (v) => { this.k = v; this.render(); });
      this.stats = { n: C.stat("不同的顶点"), gap: C.stat("最大角间隙"), back: C.stat("第一次回到起点") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segR), h("div", { class: "controls" }, this.sK),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg)));
      this.render();
    }
    render() {
      const per = C.TAU * this.rho;   // 周长（= 回到原处需要的时间）
      const A = []; for (let k = 0; k <= this.k; k++) A.push(C.mod2pi(k / this.rho));
      const uniq = []; for (const a of A) if (!uniq.some((b) => Math.abs(C.angDiff(a, b)) < 1e-7)) uniq.push(a);
      const s = uniq.slice().sort((a, b) => a - b); let gap = 0; for (let i = 0; i < s.length; i++) gap = Math.max(gap, i + 1 < s.length ? s[i + 1] - s[i] : C.TAU - s[i] + s[0]);
      const back = Math.abs(per - Math.round(per)) < 1e-9 ? Math.round(per) : null;
      this.stats.n.set(uniq.length); this.stats.gap.set(gap.toFixed(4) + " rad"); this.stats.back.set(back ? `k = ${back}` : "永远不会");
      this.msg.innerHTML = back ? `周长 ${per.toFixed(0)} 与 Δt = 1 有理相关（这里甚至是整数倍），走 ${back} 步就回到起点，这条分支只有 ${back} 个顶点——图 14.6 就是这种情况（Δt 选成了四分之一圈）。` :
        "周长 2πρ_min 与 Δt 的比是无理数：永远回不到起点，甚至回不到圆上任何一个已到过的点。这一条分支就给可达图贡献了<b>可数无穷</b>个顶点，并且它们在圆上<b>稠密</b>——即使 X 有界、Δt 固定、U_d 有限，可达图也可能是无穷的。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.circle({ x: 0, y: 0 }, 1, null, col.strong, 1.2);
      for (let k = 0; k <= this.k; k++) {
        const a = k / this.rho - Math.PI / 2, p = { x: Math.cos(a), y: Math.sin(a) };
        st.dot(p, k === this.k ? 5 : 2.6, k === this.k ? col.current : col.ok);
      }
      st.dot({ x: 0, y: -1 }, 5, null, col.start, 2);
      st.text("x₀", { x: 0, y: -1 }, col.start, { dy: 14, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：(14.9) 曼哈顿模型——搜索失败就把 Δt 减半
  // ---------------------------------------------------------------
  class Staircase {
    constructor(root) {
      this.h = 0.25; this.qI = { x: 0.1, y: 0.17 }; this.qG = { x: 0.9, y: 0.82 }; this.log = [];
      this.W = new C.World([C.rect(0.3, 0, 0.36, 0.555), C.rect(0.3, 0.6, 0.36, 1), C.rect(0.62, 0.2, 0.68, 1), C.rect(0.62, 0, 0.68, 0.158)]);
      const body = C.frame(root, "离散时间模型的分辨率完备", "(14.9)：U = [−1,1]²，U_d = 四个方向，Δt 失败就减半；拖动 x_I、x_G");
      this.st = new C.Stage({
        view: [0, 1, 0, 1], maxW: 480, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.qI) < 0.04 ? "I" : C.dist(p, this.qG) < 0.04 ? "G" : null),
        onMove: (p, d) => { const q = { x: C.clamp(p.x, 0.01, 0.99), y: C.clamp(p.y, 0.01, 0.99) }; if (!this.W.free(q)) return; if (d === "I") this.qI = q; else this.qG = q; this.reset(); },
        cursor: (p) => (C.dist(p, this.qI) < 0.04 || C.dist(p, this.qG) < 0.04 ? "grab" : "default"),
      });
      this.stats = { dt: C.stat("当前 Δt"), n: C.stat("扩展的顶点"), len: C.stat("路径长度 / 欧氏下界") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, C.button("用当前 Δt 搜索", () => this.search(), "small"), C.button("Δt ← Δt/2", () => { this.h /= 2; this.res = null; this.render(); }, "small"),
        C.button("自动：失败就减半直到找到", () => this.auto(), "small primary"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)), this.msg,
          C.legend([[C.cv("muted"), "网格（由 Δt 隐式定义）"], [C.cv("accent"), "BFS 访问过的顶点", true], [C.cv("path"), "阶梯路径"]]))));
      this.reset();
    }
    reset() { this.h = 0.25; this.res = null; this.log = []; this.render(); }
    search() {
      const hh = this.h, snap = (p) => ({ i: Math.round((p.x - this.qI.x) / hh), j: Math.round((p.y - this.qI.y) / hh) });
      // 网格以 x_I 为原点；x_G 不一定在网格上：到达 x_G 附近半个格子以内就算到达（14.4.1 节提到的「连接到网格点」问题）
      const pt = (c) => ({ x: this.qI.x + c.i * hh, y: this.qI.y + c.j * hh });
      const g = snap(this.qG), key = (c) => c.i + "," + c.j, par = new Map([[key({ i: 0, j: 0 }), null]]), Q = [{ i: 0, j: 0 }], visited = [];
      let found = null;
      while (Q.length) {
        const c = Q.shift(); visited.push(c);
        if (Math.abs(c.i - g.i) + Math.abs(c.j - g.j) === 0 && this.W.free(this.qG)) { found = c; break; }
        for (const [di, dj] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
          const n = { i: c.i + di, j: c.j + dj }, k = key(n); if (par.has(k)) continue;
          const a = pt(c), b = pt(n); let ok = true;
          for (let t = 1; t <= 6 && ok; t++) ok = this.W.free(C.lerp(a, b, t / 6));
          if (ok) { par.set(k, c); Q.push(n); }
        }
      }
      let path = null;
      if (found) { path = [this.qG]; let c = found; while (c) { path.push(pt(c)); c = par.get(key(c)); } path.reverse(); }
      this.res = { visited: visited.map(pt), path };
      this.log.push({ h: hh, ok: !!path });
      this.render();
      return !!path;
    }
    auto() { this.h = 0.25; this.log = []; for (let k = 0; k < 9; k++) { if (this.search()) return; this.h /= 2; } this.render(); }
    render() {
      this.stats.dt.set(this.h.toFixed(4));
      this.stats.n.set(this.res ? this.res.visited.length : "–");
      if (this.res && this.res.path) { let L = 0; for (let i = 1; i < this.res.path.length; i++) L += C.dist(this.res.path[i - 1], this.res.path[i]); this.stats.len.set(`${L.toFixed(3)} / ${C.dist(this.qI, this.qG).toFixed(3)}`); } else this.stats.len.set("–");
      const hist = this.log.map((r) => `Δt = ${r.h.toFixed(4)} ${r.ok ? '<span class="yes">找到</span>' : '<span class="no">失败</span>'}`).join(" → ");
      this.msg.innerHTML = (hist ? hist + "。<br>" : "") + "固定 Δt 时，可达图就是一张以 x_I 为原点、间距 Δt 的网格，所有阶梯形路径都在上面；系统地搜索它就能判断这一分辨率下有没有解。没有就把 Δt 减半再搜——有解时一定会在有限步内找到，无解时永远跑下去：这正是第 5 章意义下的<b>分辨率完备</b>。" +
        "<span class=\"muted\">（补充：阶梯路径会一致地逼近任何一条解路径，但它的<b>长度</b>并不趋于那条路径的长度——斜着走时阶梯长度始终是 L₁ 距离。）</span>";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const hh = this.h;
      if (hh >= 0.015) {
        for (let x = this.qI.x % hh; x <= 1; x += hh) st.line({ x, y: 0 }, { x, y: 1 }, C.alpha(col.muted, 0.18), 1);
        for (let y = this.qI.y % hh; y <= 1; y += hh) st.line({ x: 0, y }, { x: 1, y }, C.alpha(col.muted, 0.18), 1);
      }
      st.world(this.W, col);
      if (this.res) {
        for (const p of this.res.visited) st.dot(p, Math.max(1.2, Math.min(3, hh * 40)), C.alpha(col.accent, 0.45));
        if (this.res.path) st.polyline(this.res.path, col.path, 3);
      }
      st.mark(this.qI, col.start, "x_I", col); st.mark(this.qG, col.goal, "x_G", col);
    }
  }

  // ---------------------------------------------------------------
  // 组件：图 14.7 交错（三角形枚举）地探索一串可达图
  // 每一列是一个离散时间模型（Dubins 车，Δt, Δt/2, Δt/4, …），每列各自做 BFS；
  // 按 ℕ×ℕ 的之字形顺序，每一步只让某一列多探索一个顶点
  // ---------------------------------------------------------------
  class Dovetail {
    constructor(root) {
      this.cols = 6; this.dt0 = 1.6;
      this.W = new C.World([C.rect(1.2, -2.5, 1.5, -0.2), C.rect(1.2, 0.2, 1.5, 2.5)], { x0: -1, y0: -2.5, x1: 4, y1: 2.5 });
      this.goal = { x: 3.0, y: 1.3, r: 0.3 };
      const body = C.frame(root, "交错探索一串可达图", "图 14.7：横轴 = 越来越细的离散时间模型，纵轴 = 各自已探索的顶点数");
      this.grid = new C.Stage({ view: [0.4, 6.6, 0.4, 7.4], aspect: 0.95, maxW: 330, stretch: true, padL: 30, padB: 26, onDraw: (ctx, st, col) => this.drawGrid(ctx, st, col) });
      this.st = new C.Stage({ view: [-1, 4, -2.5, 2.5], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.runner = new C.Runner(() => { for (let k = 0; k < this.speed; k++) if (!this.step()) { this.render(); return false; } this.render(); return true; });
      this.speed = 1;
      this.stats = { steps: C.stat("总步数"), per: C.stat("各列已探索"), found: C.stat("结果") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, C.button("单步", () => { this.step(); this.render(); }, "small"), C.button("播放", () => { this.speed = 1; this.runner.start(); }, "small"),
        C.button("快进到找到解", () => { this.speed = 40; this.runner.start(); }, "small primary"), C.button("暂停", () => this.runner.stop(), "small"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "split" }, this.grid.wrap, this.st.wrap), h("div", { class: "stats" }, Object.values(this.stats)), this.msg);
      this.reset();
    }
    reset() {
      this.runner && this.runner.stop();
      this.G = []; for (let j = 0; j < this.cols; j++) { const dt = this.dt0 / Math.pow(2, j); this.G.push({ dt, Q: [{ s: { x: 0, y: 0, th: 0 }, par: null }], head: 0, V: [], E: [], done: false }); }
      this.order = []; this.diag = 1; this.di = 0; this.steps = 0; this.found = null; this.cur = null;
      this.render();
    }
    // 第 d 条对角线上的 (列, 行)，按图 14.7 的来回扫描顺序
    nextCell() {
      for (;;) {
        const d = this.diag, cells = [];
        for (let c = 1; c <= d; c++) cells.push([c, d + 1 - c]);
        if (d % 2 === 1) cells.reverse();   // 奇数条对角线从最右一列往左上走，偶数条从第 1 列往右下走
        if (this.di < cells.length) { const cell = cells[this.di++]; if (cell[0] <= this.cols) return cell; continue; }
        this.diag++; this.di = 0;
      }
    }
    step() {
      if (this.found) return false;
      const [c, r] = this.nextCell(); this.steps++; this.cur = [c, r];
      const G = this.G[c - 1];
      if (G.head >= G.Q.length) return true;   // 这张图已经探索完（有界区域里被障碍和边界截断）
      const node = G.Q[G.head++]; G.V.push(node);
      const acts = [[1, 0], [1, 1], [1, -1]];
      for (const a of acts) {
        const pts = C.carSample(node.s, a[0], a[1], G.dt, Math.max(4, Math.ceil(G.dt * 10)));
        if (!this.W.pathFree(pts, 0.05)) continue;
        const s2 = pts[pts.length - 1], child = { s: s2, par: node, pts };
        G.Q.push(child); G.E.push(pts);
        if (Math.hypot(s2.x - this.goal.x, s2.y - this.goal.y) <= this.goal.r) { this.found = { col: c, node: child }; return false; }
      }
      return true;
    }
    render() {
      this.stats.steps.set(this.steps);
      this.stats.per.set(this.G.map((g) => g.V.length).join(" / "));
      this.stats.found.set(this.found ? `<span class="yes">第 ${this.found.col} 列（Δt = ${this.G[this.found.col - 1].dt.toFixed(3)}）找到</span>` : "还没有");
      this.msg.innerHTML = "每一列是一个离散时间模型：Dubins 车 + 三个动作，第 j 列的 Δt = 1.6/2<sup>j−1</sup>。每张可达图都可能有<b>可数无穷</b>个顶点，所以不能先把第 1 列搜完再去第 2 列——那样可能永远到不了第 2 列。按左图的之字形顺序走（就是证明 ℕ×ℕ 可数的<b>三角形枚举</b>），每张图都会被探索到任意深度：一台计算机就等价于「可数无穷台计算机并行」。" +
        (this.found ? " 粗的模型（大 Δt）转弯太大、钻不过缝；细的模型可以。" : "");
      this.grid.draw(); this.st.draw();
    }
    drawGrid(ctx, st, col) {
      st.frame(col);
      // 之字形路线（前 7 条对角线）
      const pts = []; let d = 1, i = 0;
      while (pts.length < 24) { const cells = []; for (let c = 1; c <= d; c++) cells.push([c, d + 1 - c]); if (d % 2 === 1) cells.reverse(); for (const c of cells) if (c[0] <= 6 && c[1] <= 7) pts.push({ x: c[0], y: c[1] }); d++; i++; if (d > 8) break; }
      for (let k = 1; k < pts.length; k++) st.arrow(pts[k - 1], pts[k], C.alpha(col.text2, 0.7), 1.1, 6);
      for (let c = 1; c <= 6; c++) for (let r = 1; r <= 7; r++) {
        const done = this.G[c - 1] && this.G[c - 1].V.length >= r;
        st.dot({ x: c, y: r }, 4, done ? col.ok : col.surface, done ? col.ok : col.strong, 1.2);
      }
      if (this.cur && this.cur[0] <= 6 && this.cur[1] <= 7) st.dot({ x: this.cur[0], y: this.cur[1] }, 7, null, col.current, 2.5);
      const ctx2 = st.ctx; ctx2.font = `500 10px ${getComputedStyle(document.body).fontFamily}`; ctx2.fillStyle = col.muted; ctx2.textAlign = "center"; ctx2.textBaseline = "top";
      const lab = ["Δt", "½Δt", "¼Δt", "⅛Δt", "Δt/16", "Δt/32"]; for (let c = 1; c <= 6; c++) ctx2.fillText(lab[c - 1], st.X(c), st.Y(0.4) + 4);
      ctx2.textAlign = "right"; ctx2.textBaseline = "middle"; for (let r = 1; r <= 7; r++) ctx2.fillText(String(r), st.X(0.4) - 5, st.Y(r));
      st.text("已探索的顶点数 ↑", { x: 0.5, y: 7.3 }, col.text2, { align: "left", size: 10.5 });
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.world(this.W, col);
      st.circle(this.goal, this.goal.r, C.alpha(col.goal, 0.25), col.goal, 1.5);
      const hues = [col.muted, col.alive, col.alive2, col.accent, col.ok, col.current];
      this.G.forEach((G, j) => { for (const pts of G.E) st.polyline(pts, C.alpha(hues[j % hues.length], 0.65), 1); });
      if (this.found) { let n = this.found.node; while (n && n.pts) { st.polyline(n.pts, col.path, 3.2); n = n.par; } }
      st.car({ x: 0, y: 0, th: 0 }, 0.3, col.alive, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件：图 14.8 机动自动机（Frazzoli）
  // 配平轨迹 trim = 稳态运动（模式），机动 maneuver = 模式之间的过渡；状态空间扩充为 X × M
  // ---------------------------------------------------------------
  const MODES = { hover: { name: "悬停 Hover", v: 0, w: 0 }, fwd: { name: "前飞 Forward flight", v: 1, w: 0 }, left: { name: "稳定左转", v: 1, w: 1 }, right: { name: "稳定右转", v: 1, w: -1 } };
  const EDGES = { hover: ["fwd"], fwd: ["hover", "left", "right"], left: ["fwd", "right"], right: ["fwd", "left"] };
  class Maneuver {
    constructor(root) {
      this.trimT = 1.2; this.manT = 0.6;
      const body = C.frame(root, "机动自动机", "图 14.8：只能沿自动机的边切换运动基元；实线 = 配平轨迹，虚线 = 机动");
      this.svg = PA.s("svg", { viewBox: "0 0 420 230", style: "width:100%;max-width:420px;display:block" });
      this.st = new C.Stage({ view: [-1, 7, -3, 3], aspect: 0.75, maxW: 480, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sT = C.slider("配平轨迹时长", 0.3, 3, 0.1, this.trimT, (v) => { this.trimT = v; });
      this.seqEl = h("p", { class: "small mono" });
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sT, C.button("撤销", () => { this.seq.pop(); this.rebuild(); }, "small"), C.button("重置", () => this.reset(), "small")),
        h("div", { class: "split" }, h("div", null, this.svg, h("p", { class: "small muted" }, "点自动机里可以去的模式（高亮的节点）。")), this.st.wrap), this.seqEl, this.msg,
        C.legend([[C.cv("accent"), "配平轨迹（稳态）"], [C.cv("warn"), "机动（过渡）"]]));
      this.reset();
    }
    reset() { this.seq = []; this.rebuild(); }
    // 依次积分：每段 {kind: 'trim'|'man', from, to, T}
    rebuild() {
      let s = { x: 0, y: 0, th: 0 }; let mode = "hover"; this.segs = [];
      for (const it of this.seq) {
        if (it.kind === "man") {
          const a = MODES[mode], b = MODES[it.to], n = 30, pts = [s];
          for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, v = a.v + (b.v - a.v) * t, w = a.w + (b.w - a.w) * t; s = C.carStep(s, v, w, this.manT / n); pts.push(s); }
          this.segs.push({ kind: "man", pts }); mode = it.to;
        } else {
          const m = MODES[mode], pts = m.v === 0 ? [s, s] : C.carSample(s, m.v, m.w, it.T, 30); s = pts[pts.length - 1];
          this.segs.push({ kind: "trim", pts, hover: m.v === 0 });
        }
      }
      this.s = s; this.mode = mode;
      let R = 3; for (const g of this.segs) for (const p of g.pts) R = Math.max(R, Math.abs(p.x - 3) + 1, Math.abs(p.y) + 1);
      this.st.setView([3 - R * 1.33, 3 + R * 1.33, -R, R]);
      this.drawSvg(); this.st.draw();
      this.seqEl.textContent = "动作序列：" + (this.seq.length ? this.seq.map((it) => (it.kind === "man" ? `→${MODES[it.to].name.split(" ")[0]}` : `[${it.T.toFixed(1)}s]`)).join(" ") : "（从悬停开始）");
      this.msg.innerHTML = `当前模式：<b>${MODES[this.mode].name}</b>，扩充状态 (x, y, θ, m) = (${this.s.x.toFixed(2)}, ${this.s.y.toFixed(2)}, ${(C.mod2pi(this.s.th) * 180 / Math.PI).toFixed(0)}°, ${this.mode})。` +
        "从悬停不能直接进入转弯——必须先经过「前飞」。每个配平轨迹、每个机动其实都是一族带参数的运动基元（这里只有时长一个参数）；离散阶段的转移方程 (14.13) 中，第 k 步选的就是这样一个基元，时间不再是 (k−1)Δt，而是前面各基元时长之和。";
    }
    go(to) { this.seq.push({ kind: "man", to }, { kind: "trim", T: this.trimT }); this.rebuild(); }
    drawSvg() {
      const S = PA.s, svg = this.svg; svg.innerHTML = "";
      const P = { hover: [60, 115], fwd: [200, 115], left: [345, 45], right: [345, 185] };
      PA.arrowDefs(svg, { mauto: "var(--muted)", mautoOn: "var(--accent)" });
      // 二次 Bézier；两端从椭圆中心沿控制点方向缩到椭圆边上，箭头才不会被节点盖住
      const edgePt = (c, toward) => { const dx = toward[0] - c[0], dy = toward[1] - c[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, r = 1 / Math.hypot(ux / 58, uy / 24); return [c[0] + ux * r, c[1] + uy * r]; };
      const curve = (a, b, bend) => {
        const [x1, y1] = P[a], [x2, y2] = P[b], ctl = [(x1 + x2) / 2 - (y2 - y1) * bend, (y1 + y2) / 2 + (x2 - x1) * bend];
        const s0 = edgePt(P[a], ctl), s1 = edgePt(P[b], ctl);
        return `M${s0[0]},${s0[1]} Q${ctl[0]},${ctl[1]} ${s1[0]},${s1[1]}`;
      };
      for (const [a, outs] of Object.entries(EDGES)) for (const b of outs) {
        const on = a === this.mode;
        svg.append(S("path", { d: curve(a, b, 0.18), fill: "none", stroke: on ? "var(--accent)" : "var(--border-strong)", "stroke-width": on ? 2 : 1.3, "marker-end": `url(#${on ? "mautoOn" : "mauto"})` }));
      }
      for (const [k, m] of Object.entries(MODES)) {
        const [x, y] = P[k], cur = k === this.mode, can = EDGES[this.mode].includes(k);
        const g = S("g", { style: can ? "cursor:pointer" : "" });
        g.append(S("ellipse", { cx: x, cy: y, rx: 56, ry: 22, fill: cur ? "var(--accent-soft)" : can ? "var(--ok-soft)" : "var(--surface-2)", stroke: cur ? "var(--accent)" : can ? "var(--ok)" : "var(--border-strong)", "stroke-width": cur || can ? 2 : 1 }));
        g.append(S("text", { x, y: y + 4, "text-anchor": "middle", "font-size": 11.5, fill: "var(--text)" }, m.name.split(" ")[0]));
        if (can) g.addEventListener("click", () => this.go(k));
        svg.append(g);
      }
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const g of this.segs) {
        if (g.kind === "trim" && g.hover) { st.circle(g.pts[0], 0.12, null, col.accent, 2); continue; }
        st.polyline(g.pts, g.kind === "man" ? col.warn : col.accent, g.kind === "man" ? 2.5 : 2.5, g.kind === "man" ? [5, 4] : null);
      }
      st.car(this.s, 0.45, col.alive, col.text);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='reach-simple']").forEach((el) => el._w = new ReachSimple(el));
    document.querySelectorAll("[data-widget='car-reach']").forEach((el) => el._w = new CarReach(el));
    document.querySelectorAll("[data-widget='reach-tree']").forEach((el) => el._w = new ReachTree(el));
    document.querySelectorAll("[data-widget='dense-circle']").forEach((el) => el._w = new DenseCircle(el));
    document.querySelectorAll("[data-widget='staircase']").forEach((el) => el._w = new Staircase(el));
    document.querySelectorAll("[data-widget='dovetail']").forEach((el) => el._w = new Dovetail(el));
    document.querySelectorAll("[data-widget='maneuver']").forEach((el) => el._w = new Maneuver(el));
  });
})();
