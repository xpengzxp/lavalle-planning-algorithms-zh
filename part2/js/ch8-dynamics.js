/* 8.4.4 节：迈向动力学——加速度控制模型与加速度界、Rimon–Koditschek 导航函数、调和势函数 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;

  // =================================================================
  // 组件 12：加速度控制模型 (8.47) 与加速度界
  // =================================================================
  const L_REGION = [[.05, .1], [.75, .1], [.75, .92], [.55, .92], [.55, .3], [.05, .3]].map(([x, y]) => ({ x, y }));
  class AccelControl {
    constructor(root) {
      this.w = 0; this.v = .35; this.amax = .5; this.K = 8; this.start = { x: .1, y: .2 };
      this.xc = .62; this.yG = .86;
      const body = C.frame(root, "按向量场开车：加速度控制模型", "f(x) 只是「想要的」速度；真实速度 ẋ 要靠有界的加速度 u 去追，u = K(f(x) − ẋ) + ∇_ẋ f(x)");
      this.st = new C.Stage({ maxW: 380, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (C.dist(p, this.start) < .04 ? "I" : null),
        onMove: (p) => { if (C.inPoly(p, L_REGION) && p.x < .5) { this.start = p; this.reset(); } },
        cursor: (p) => (C.dist(p, this.start) < .04 ? "grab" : null) });
      this.ts = new C.Stage({ view: [0, 1, 0, .55], aspect: .55, maxW: 420, minW: 200, pad: 4, onDraw: (ctx, st, col) => this.drawTS(ctx, st, col) });
      this.sW = C.slider("拐弯过渡宽度 w", 0, .24, .01, this.w, (v) => { this.w = v; this.reset(); }, (v) => (v ? v.toFixed(2) : "0（不连续）"));
      this.sV = C.slider("速率 |f|", .1, .5, .01, this.v, (v) => { this.v = v; this.reset(); }, (v) => v.toFixed(2));
      this.sA = C.slider("加速度上界 a_max", .1, 2, .05, this.amax, (v) => { this.amax = v; this.reset(); }, (v) => v.toFixed(2));
      this.sK = C.slider("增益 K", 1, 30, 1, this.K, (v) => { this.K = v; this.reset(); });
      this.runner = new C.Runner(() => { for (let i = 0; i < 12; i++) if (!this.step()) { this.st.draw(); this.ts.draw(); return false; } this.st.draw(); this.ts.draw(); return true; }, () => { this.bRun.textContent = "▶ 执行"; });
      this.bRun = C.button("▶ 执行", () => { if (this.runner.running) this.runner.stop(); else { if (this.done) this.reset(); this.runner.start(); this.bRun.textContent = "⏸ 暂停"; } }, "primary");
      this.stats = { res: C.stat("结果"), C: C.stat("场的 Lipschitz 常数 C"), cv: C.stat("C·|f| vs a_max"), err: C.stat("最大 ‖f(x) − ẋ‖") };
      body.append(h("div", { class: "controls" }, this.bRun, C.button("重置", () => this.reset()), this.sW, this.sV), h("div", { class: "controls" }, this.sA, this.sK),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "随时间变化"), this.ts.wrap),
          C.legend([[C.cv("bad"), "a_max"], [C.cv("accent"), "实际加速度 ‖u‖"], [C.cv("warn"), "跟住 f 需要的 ‖∇_ẋ f‖"], [C.cv("muted"), "误差 ‖f − ẋ‖"]]))),
        C.legend([[C.cva("accent", .6), "f(x) 的针状图"], [C.cv("muted"), "理想积分曲线 ẋ = f(x)（虚线）"], [C.cv("path"), "有界加速度下的实际轨迹"]]));
      this.reset();
    }
    psi(x) { if (this.w <= 0) return x >= this.xc ? Math.PI / 2 : 0; const t = C.clamp((x - (this.xc - this.w / 2)) / this.w, 0, 1); return Math.PI / 2 * t * t * (3 - 2 * t); }
    dpsi(x) { if (this.w <= 0) return 0; const t = (x - (this.xc - this.w / 2)) / this.w; if (t <= 0 || t >= 1) return 0; return Math.PI / 2 * 6 * t * (1 - t) / this.w; }
    g(y) { return C.clamp((this.yG - y) / .18, 0, 1); }
    dg(y) { return y > this.yG - .18 && y < this.yG ? -1 / .18 : 0; }
    f(p) { const s = this.v * this.g(p.y), a = this.psi(p.x); return { x: s * Math.cos(a), y: s * Math.sin(a) }; }
    // ∇_ẋ f(x) = Df(x)·ẋ（解析求导；不连续处取 0，由 K 项负责追上）
    df(p, xd) {
      const a = this.psi(p.x), ca = Math.cos(a), sa = Math.sin(a), g = this.g(p.y);
      const t1 = this.v * this.dg(p.y) * xd.y, t2 = this.v * g * this.dpsi(p.x) * xd.x;
      return { x: t1 * ca - t2 * sa, y: t1 * sa + t2 * ca };
    }
    reset() {
      if (this.runner) this.runner.stop();
      this.x = { ...this.start }; this.xd = this.f(this.x); this.t = 0; this.done = false; this.res = ""; this.tr = [this.x]; this.ser = [];
      this.ideal = C.integrate((p) => this.f(p), this.start, { dt: .01, steps: 2000, stop: (q) => Math.hypot(...Object.values(this.f(q))) < 1e-3 || !C.inPoly(q, L_REGION) });
      const Cl = this.w > 0 ? this.v * Math.PI / 2 * 1.5 / this.w : Infinity;
      this.stats.C.set(isFinite(Cl) ? Cl.toFixed(2) : "∞（不连续）");
      this.stats.cv.set(isFinite(Cl) ? `${(Cl * this.v).toFixed(2)} ${Cl * this.v <= this.amax ? "≤" : ">"} ${this.amax.toFixed(2)}` : `∞ > ${this.amax.toFixed(2)}`);
      this.update(); this.st.draw(); this.ts.draw();
    }
    step() {
      if (this.done) return false;
      const dt = .002, fx = this.f(this.x), gr = this.df(this.x, this.xd);
      let u = { x: this.K * (fx.x - this.xd.x) + gr.x, y: this.K * (fx.y - this.xd.y) + gr.y };
      const nu = Math.hypot(u.x, u.y); if (nu > this.amax) u = { x: u.x / nu * this.amax, y: u.y / nu * this.amax };
      this.xd = { x: this.xd.x + u.x * dt, y: this.xd.y + u.y * dt };
      this.x = { x: this.x.x + this.xd.x * dt, y: this.x.y + this.xd.y * dt };
      this.t += dt;
      if ((this.ser.length === 0) || this.t - this.ser[this.ser.length - 1].t > .02) {
        this.ser.push({ t: this.t, u: Math.hypot(u.x, u.y), need: Math.hypot(gr.x, gr.y), err: Math.hypot(fx.x - this.xd.x, fx.y - this.xd.y) });
        this.tr.push(this.x);
      }
      if (!C.inPoly(this.x, L_REGION)) { this.done = true; this.res = "hit"; this.tr.push(this.x); }
      else if (this.x.y > this.yG - .02 && Math.hypot(this.xd.x, this.xd.y) < .01) { this.done = true; this.res = "goal"; }
      else if (this.t > 30) { this.done = true; this.res = "slow"; }
      if (this.done) this.update();
      return !this.done;
    }
    update() {
      const m = this.ser.reduce((a, s) => Math.max(a, s.err), 0);
      this.stats.err.set(this.ser.length ? m.toFixed(3) : "—");
      this.stats.res.set(this.res === "hit" ? '<span class="no">✕ 撞墙</span>' : this.res === "goal" ? `<span class="yes">✓ 到达（t = ${this.t.toFixed(1)}）</span>` : this.res === "slow" ? "超时" : "点「执行」");
    }
    draw(ctx, st, col) {
      st.frame(col, C.alpha(col.wall, .85));
      st.poly(L_REGION, col.surface, col.wall, 1.5);
      ctx.fillStyle = C.alpha(col.goal, .14); ctx.fillRect(st.X(.55), st.Y(.92), .2 * st.scale, .1 * st.scale);
      st.text("X_G", { x: .65, y: .88 }, col.goal, { size: 12, weight: 650 });
      if (this.w > 0) { ctx.save(); ctx.beginPath(); L_REGION.forEach((q, i) => (i ? ctx.lineTo(st.X(q.x), st.Y(q.y)) : ctx.moveTo(st.X(q.x), st.Y(q.y)))); ctx.closePath(); ctx.clip(); ctx.fillStyle = C.alpha(col.warn, .1); ctx.fillRect(st.X(this.xc - this.w / 2), st.Y(.92), this.w * st.scale, .82 * st.scale); ctx.restore(); }
      else st.line({ x: this.xc, y: .1 }, { x: this.xc, y: .92 }, C.alpha(col.warn, .7), 1.5, [4, 3]);
      st.needles((p) => (C.inPoly(p, L_REGION) ? this.f(p) : null), col, { n: 16, normalize: true, color: C.alpha(col.accent, .5), lw: 1, head: 3.5 });
      st.polyline(this.ideal, col.muted, 1.8, [5, 4]);
      st.polyline(this.tr, col.path, 2.6);
      if (this.res === "hit") st.xmark(this.x, col.bad, 7); else st.dot(this.x, 5, col.path, col.surface, 1.5);
      st.qmark(this.start, "I", col);
    }
    drawTS(ctx, st, col) {
      // 舞台是等比例缩放的；这里把 (t, 值) 手动归一化到 [0,1] × [0,0.55]
      const T = Math.max(6, this.t), Y = Math.max(this.amax * 1.6, .5), H = .55;
      const P = (t, v) => ({ x: t / T, y: H * Math.min(1, v / Y) });
      st.setView([0, 1, 0, H]);
      st.frame(col);
      for (let k = 1; k < 4; k++) st.line(P(0, Y * k / 4), P(T, Y * k / 4), col.border, 1);
      st.line(P(0, this.amax), P(T, this.amax), col.bad, 1.5, [5, 3]);
      st.text("a_max = " + this.amax.toFixed(2), P(T, this.amax), col.bad, { align: "right", dy: -8, dx: -3, size: 11 });
      const S = this.ser;
      st.polyline(S.map((s) => P(s.t, s.err)), col.muted, 1.5);
      st.polyline(S.map((s) => P(s.t, s.need)), col.warn, 1.6, [4, 2]);
      st.polyline(S.map((s) => P(s.t, s.u)), col.accent, 2);
      st.text(`t → ${T.toFixed(0)}`, P(T, 0), col.muted, { align: "right", dy: -7, dx: -3, size: 10.5 });
      st.text(Y.toFixed(1), P(0, Y), col.muted, { align: "left", dy: 8, dx: 3, size: 10 });
    }
  }

  // =================================================================
  // 组件 13：Rimon–Koditschek 意义下的导航函数（球形世界；公式为补充）
  // =================================================================
  class RimonKoditschek {
    constructor(root) {
      this.k = 2; this.goal = { x: .6, y: .2 };
      this.obs = [{ x: -.42, y: .18, r: .2 }, { x: .22, y: -.12, r: .2 }, { x: -.05, y: .55, r: .14 }, { x: .05, y: -.62, r: .16 }];
      this.runs = []; this.cloud = null; this.showNeedles = false;
      const body = C.frame(root, "Rimon–Koditschek 导航函数与临界点", "φ = γ / (γᵏ + β)^{1/k}：γ = ‖q − q_G‖²，β = 所有障碍函数之积；k 越大，「假」的局部极小越少");
      this.st = new C.Stage({ view: [-1.05, 1.05, -1.05, 1.05], maxW: 480, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => {
          if (C.dist(p, this.goal) < .05) return "G";
          for (const o of this.obs) if (C.dist(p, o) < o.r) return o;
          if (this.free(p)) { this.runs.push(this.descend(p)); if (this.runs.length > 6) this.runs.shift(); this.st.draw(); }
          return null;
        },
        onMove: (p, d) => {
          if (d === "G") { if (this.free(p)) this.goal = p; }
          else { const old = { x: d.x, y: d.y }; d.x = p.x; d.y = p.y; const ok = Math.hypot(d.x, d.y) + d.r < .97 && this.obs.every((o) => o === d || C.dist(o, d) > o.r + d.r + .02) && this.free(this.goal); if (!ok) { d.x = old.x; d.y = old.y; } }
          this.recompute();
        },
        cursor: (p) => (C.dist(p, this.goal) < .05 || this.obs.some((o) => C.dist(p, o) < o.r) ? "grab" : "crosshair") });
      this.sK = C.slider("k", 1, 12, 1, this.k, (v) => { this.k = v; this.recompute(); });
      this.cbN = C.check("针状图（−∇φ 方向）", false, (v) => { this.showNeedles = v; this.st.draw(); });
      this.checks = h("div", { class: "panel-body" });
      this.stats = { min: C.stat("目标以外的局部极小"), sad: C.stat("鞍点"), cloud: C.stat("撒点：到达 / 总数") };
      body.append(h("div", { class: "controls" }, this.sK, C.button("从 150 个起点各下降一次", () => this.spray(), "primary"), C.button("清空", () => { this.runs = []; this.cloud = null; this.updStats(); this.st.draw(); }, "small"), this.cbN),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "stats" }, Object.values(this.stats)),
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "四条性质（[79]）"), this.checks),
          C.legend([[C.cv("bad"), "局部极小 ●"], [C.cv("warn"), "鞍点 ◆"], [C.cv("path"), "梯度下降到达目标"], [C.cva("accent", .55), "φ 的等值线（按分位数取；越深 φ 越大）"]]))));
      this.recompute();
    }
    parts(q) {
      const g = this.goal, gamma = (q.x - g.x) ** 2 + (q.y - g.y) ** 2, dgam = { x: 2 * (q.x - g.x), y: 2 * (q.y - g.y) };
      const bs = [1 - q.x * q.x - q.y * q.y], dbs = [{ x: -2 * q.x, y: -2 * q.y }];
      for (const o of this.obs) { bs.push((q.x - o.x) ** 2 + (q.y - o.y) ** 2 - o.r * o.r); dbs.push({ x: 2 * (q.x - o.x), y: 2 * (q.y - o.y) }); }
      let beta = 1; for (const b of bs) beta *= b;
      const db = { x: 0, y: 0 };
      dbs.forEach((d, i) => { let pr = 1; bs.forEach((b, j) => { if (j !== i) pr *= b; }); db.x += d.x * pr; db.y += d.y * pr; });
      return { gamma, dgam, beta, db, bs };
    }
    free(q) { return this.parts(q).bs.every((b) => b > 0); }
    phi(q) { const P = this.parts(q); if (!P.bs.every((b) => b > 0)) return Infinity; return P.gamma / Math.pow(Math.pow(P.gamma, this.k) + P.beta, 1 / this.k); }
    // ∇φ = 0（q ≠ q_G）⇔ F = kβ∇γ − γ∇β = 0；而且 −F 与 −∇φ 同方向
    F(q) { const P = this.parts(q); return { x: this.k * P.beta * P.dgam.x - P.gamma * P.db.x, y: this.k * P.beta * P.dgam.y - P.gamma * P.db.y }; }
    critical() {
      const pts = [], hh = 1e-6, res = 46;
      for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) {
        let q = { x: -1 + 2 * (i + .5) / res, y: -1 + 2 * (j + .5) / res };
        if (!this.free(q)) continue;
        let ok = false;
        for (let it = 0; it < 50; it++) {
          const F = this.F(q), Fx = this.F({ x: q.x + hh, y: q.y }), Fy = this.F({ x: q.x, y: q.y + hh });
          const a = (Fx.x - F.x) / hh, b = (Fy.x - F.x) / hh, c = (Fx.y - F.y) / hh, d = (Fy.y - F.y) / hh, det = a * d - b * c;
          if (!det) break;
          let dx = (d * F.x - b * F.y) / det, dy = (-c * F.x + a * F.y) / det;
          const L = Math.hypot(dx, dy); if (L > .05) { dx *= .05 / L; dy *= .05 / L; }
          q = { x: q.x - dx, y: q.y - dy };
          if (!this.free(q)) break;
          if (Math.hypot(dx, dy) < 1e-12) { ok = true; break; }
        }
        if (!ok || C.dist(q, this.goal) < 1e-6 || pts.some((p) => C.dist(p, q) < 1e-5)) continue;
        const e = 1e-4, f0 = this.phi(q);
        const fxx = (this.phi({ x: q.x + e, y: q.y }) - 2 * f0 + this.phi({ x: q.x - e, y: q.y })) / (e * e);
        const fyy = (this.phi({ x: q.x, y: q.y + e }) - 2 * f0 + this.phi({ x: q.x, y: q.y - e })) / (e * e);
        const fxy = (this.phi({ x: q.x + e, y: q.y + e }) - this.phi({ x: q.x + e, y: q.y - e }) - this.phi({ x: q.x - e, y: q.y + e }) + this.phi({ x: q.x - e, y: q.y - e })) / (4 * e * e);
        const det = fxx * fyy - fxy * fxy;
        pts.push({ x: q.x, y: q.y, kind: det < 0 ? "saddle" : fxx > 0 ? "min" : "max", det });
      }
      return pts;
    }
    descend(p0) {
      const pts = [p0]; let p = p0, res = "trap";
      for (let k = 0; k < 2500; k++) {
        if (C.dist(p, this.goal) < .012) { res = "goal"; break; }
        const F = this.F(p), n = Math.hypot(F.x, F.y); if (n < 1e-300) break;
        const s = Math.min(.004, C.dist(p, this.goal));
        p = { x: p.x - s * F.x / n, y: p.y - s * F.y / n }; pts.push(p);
        if (!this.free(p)) { res = "obs"; break; }
        if (k > 200 && k % 50 === 0 && C.dist(p, pts[pts.length - 151]) < .015) break;
      }
      return { pts, res };
    }
    recompute() {
      this.crit = this.critical();
      const N = 140; this.field = C.sampleField((q) => this.phi(q), N, N, [-1.05, 1.05, -1.05, 1.05]); this.N = N;
      this.runs = this.runs.map((r) => this.descend(r.pts[0]));
      if (this.cloud) this.spray(true); else { this.updStats(); this.st.draw(); }
    }
    spray() {
      const r = C.rng(29), out = [];
      while (out.length < 150) { const p = { x: -1 + 2 * r(), y: -1 + 2 * r() }; if (!this.free(p)) continue; const d = this.descend(p); out.push({ p, res: d.res, end: d.pts[d.pts.length - 1] }); }
      this.cloud = out; this.updStats(); this.st.draw();
    }
    updStats() {
      const mins = this.crit.filter((c) => c.kind === "min"), sad = this.crit.filter((c) => c.kind === "saddle"), mx = this.crit.filter((c) => c.kind === "max");
      this.stats.min.set(mins.length ? `<span class="no">${mins.length}</span>` : '<span class="yes">0</span>');
      this.stats.sad.set(sad.length + (mx.length ? `（另有极大 ${mx.length}）` : ""));
      this.stats.cloud.set(this.cloud ? `${this.cloud.filter((c) => c.res === "goal").length} / ${this.cloud.length}` : "—");
      const ok = (b) => (b ? '<span class="yes">✓</span>' : '<span class="no">✗</span>');
      const morse = this.crit.every((c) => Math.abs(c.det) > 1e-6);
      this.checks.innerHTML = `<div>${ok(true)} 1. 光滑（有理函数，在 C_free 内分母为正）</div>
        <div>${ok(!mins.length)} 2. 含 x_G 的连通分量上只有一个局部极小，在 x_G ${mins.length ? `<span class="muted">（还有 ${mins.length} 个假极小：k 再大一点试试）</span>` : ""}</div>
        <div>${ok(true)} 3. 在 ∂C_free 上 β = 0，所以 φ = 1：最大且为常数</div>
        <div>${ok(morse)} 4. Morse：每个临界点的 Hessian 非退化 <span class="muted">（${this.crit.length} 个临界点 + 目标处的极小）</span></div>`;
    }
    draw(ctx, st, col) {
      st.frame(col);
      const F = this.field, N = this.N;
      // φ 在大部分区域都很接近 1：按分位数分层（直方图均衡），等值线也取在分位数上
      const sorted = Array.from(F.vals).filter(isFinite).sort((a, b) => a - b), Q = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      const lv = []; for (let k = 1; k < 16; k++) lv.push(Q(k / 16));
      const rank = (v) => { let lo = 0, hi = lv.length; while (lo < hi) { const m = (lo + hi) >> 1; if (lv[m] < v) lo = m + 1; else hi = m; } return lo / 16; };
      st.heat(F.vals, N, N, rank, col, { bands: 16, smooth: false, rect: [-1.05 - 1.05 / N, 1.05 + 1.05 / N, -1.05 - 1.05 / N, 1.05 + 1.05 / N] });
      st.contours(F.vals, N, N, lv, C.alpha(col.muted, .45), 1, { rect: [-1.05, 1.05, -1.05, 1.05] });
      // 外边界外面和障碍
      ctx.save(); ctx.beginPath(); ctx.rect(st.X(-1.05), st.Y(1.05), 2.1 * st.scale, 2.1 * st.scale); ctx.arc(st.X(0), st.Y(0), st.scale, 0, 2 * Math.PI, true); ctx.fillStyle = C.alpha(col.wall, .85); ctx.fill("evenodd"); ctx.restore();
      for (const o of this.obs) st.circle(o, o.r, C.alpha(col.wall, .88), col.wall, 1);
      if (this.showNeedles) st.needles((q) => { if (!this.free(q)) return null; const f = this.F(q); return { x: -f.x, y: -f.y }; }, col, { n: 22, color: C.alpha(col.accent, .55), lw: 1, head: 3 });
      if (this.cloud) for (const c of this.cloud) { st.dot(c.p, 2.5, c.res === "goal" ? C.alpha(col.path, .75) : col.bad); }
      for (const r of this.runs) { st.polyline(r.pts, r.res === "goal" ? col.path : col.bad, 2.4); st.dot(r.pts[0], 4.5, col.start, col.surface, 1.5); }
      for (const c of this.crit) {
        const x = st.X(c.x), y = st.Y(c.y);
        if (c.kind === "saddle") { ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fillStyle = col.warn; ctx.fill(); ctx.strokeStyle = col.surface; ctx.lineWidth = 1.5; ctx.stroke(); st.text("鞍点", c, col.warn, { size: 10.5, dy: 14, weight: 650 }); }
        else { st.dot(c, 6.5, c.kind === "min" ? col.bad : col.text, col.surface, 1.5); st.text(c.kind === "min" ? "假极小" : "极大", c, col.bad, { size: 11, dy: 15, weight: 700 }); }
      }
      st.qmark(this.goal, "G", col);
    }
  }

  // =================================================================
  // 组件 14：调和势函数 ∇²φ = 0（式 8.49），Gauss–Seidel 迭代
  // =================================================================
  class Harmonic {
    constructor(root) {
      this.NX = 64; this.NY = 40; this.mode = "dir"; this.sweeps = 0; this.lines = [];
      this.rects = [[.3, .15, .4, .75], [.72, 0, .82, .55], [1.05, .35, 1.4, .45], [1.05, .45, 1.15, .85]];
      this.goal = [58, 8];
      const body = C.frame(root, "调和势函数：解拉普拉斯方程", "目标 φ = 0、外边界 φ = 1；障碍上用 Dirichlet（φ = 1）或 Neumann（∂φ/∂n = 0）；每轮 Gauss–Seidel 把每个格子换成邻居的平均");
      this.st = new C.Stage({ view: [0, 1.6, 0, 1], aspect: 1 / 1.6, maxW: 600, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => { if (p.x < 0 || p.y < 0 || p.x > 1.6 || p.y > 1) return null; this.lines.push(this.stream(p)); if (this.lines.length > 8) this.lines.shift(); this.st.draw(); return null; } });
      this.segM = C.seg([["dir", "障碍：Dirichlet φ = 1"], ["neu", "障碍：Neumann ∂φ/∂n = 0（外边界仍为 φ = 1）"]], this.mode, (k) => { this.mode = k; this.reset(); });
      this.runner = new C.Runner(() => { for (let i = 0; i < 6; i++) this.sweep(); this.lines = this.lines.map((l) => this.stream(l[0])); this.update(); this.st.draw(); return this.delta > 1e-13 && this.sweeps < 40000; }, () => { this.bRun.textContent = "▶ 迭代"; });
      this.bRun = C.button("▶ 迭代", () => { if (this.runner.running) this.runner.stop(); else { this.runner.start(); this.bRun.textContent = "⏸ 暂停"; } }, "primary");
      this.stats = { it: C.stat("Gauss–Seidel 轮数"), d: C.stat("本轮最大改变量"), far: C.stat("1 − φ 在左上角") };
      body.append(h("div", { class: "controls" }, this.segM), h("div", { class: "controls" }, this.bRun, C.button("+1 轮", () => { this.sweep(); this.update(); this.st.draw(); }), C.button("一次跑到收敛", () => { while (this.delta > 1e-12 && this.sweeps < 40000) this.sweep(); this.lines = this.lines.map((l) => this.stream(l[0])); this.update(); this.st.draw(); }), C.button("重置", () => this.reset())),
        this.st.wrap, h("div", { class: "stats" }, Object.values(this.stats)),
        h("p", { class: "small muted", style: "margin:4px 0" }, "颜色按 −log₁₀(1 − φ) 分层：每一层差 10 倍。点画布从那里沿 −∇φ 走（流线）。"),
        C.legend([[C.cv("path"), "流线：到达目标"], [C.cv("bad"), "梯度在浮点精度下为 0，走不动（✕）"]]));
      this.reset();
    }
    reset() {
      if (this.runner) this.runner.stop();
      const NX = this.NX, NY = this.NY;
      this.obs = new Uint8Array(NX * NY); this.phi = new Float64Array(NX * NY).fill(1);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = (i + .5) * 1.6 / NX, y = (j + .5) / NY; if (this.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) this.obs[j * NX + i] = 1; }
      this.phi[this.goal[1] * NX + this.goal[0]] = 0;
      this.sweeps = 0; this.delta = Infinity; this.lines = [{ x: .1, y: .9 }, { x: .55, y: .1 }].map((p) => this.stream(p));
      this.update(); this.st.draw();
    }
    sweep() {
      const NX = this.NX, NY = this.NY, P = this.phi, O = this.obs, neu = this.mode === "neu", g = this.goal[1] * NX + this.goal[0];
      let d = 0;
      for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
        const k = j * NX + i; if (O[k] || k === g) continue;
        let s = 0, n = 0;
        for (const q of [k + 1, k - 1, k + NX, k - NX]) { if (O[q]) { if (neu) continue; s += 1; n++; } else { s += P[q]; n++; } }
        const v = s / n; d = Math.max(d, Math.abs(v - P[k])); P[k] = v;
      }
      this.delta = d; this.sweeps++;
    }
    val(i, j) { i = C.clamp(i, 0, this.NX - 1); j = C.clamp(j, 0, this.NY - 1); const k = j * this.NX + i; return this.obs[k] ? NaN : this.phi[k]; }
    // 用中心差分估计 −∇φ，沿它走（每步固定长度）
    stream(p0) {
      const NX = this.NX, NY = this.NY, hx = 1.6 / NX, pts = [p0]; let p = p0, res = "stuck";
      const gp = { x: (this.goal[0] + .5) * hx, y: (this.goal[1] + .5) / NY };
      for (let k = 0; k < 600; k++) {
        if (C.dist(p, gp) < .02) { res = "goal"; break; }
        const i = Math.floor(p.x / hx), j = Math.floor(p.y * NY);
        if (i < 1 || j < 1 || i >= NX - 1 || j >= NY - 1 || this.obs[j * NX + i]) break;
        const c = this.val(i, j);
        const gx = (isNaN(this.val(i + 1, j)) ? c : this.val(i + 1, j)) - (isNaN(this.val(i - 1, j)) ? c : this.val(i - 1, j));
        const gy = (isNaN(this.val(i, j + 1)) ? c : this.val(i, j + 1)) - (isNaN(this.val(i, j - 1)) ? c : this.val(i, j - 1));
        const n = Math.hypot(gx, gy); if (!(n > 0)) break;
        p = { x: p.x - .012 * gx / n, y: p.y - .012 * gy / n }; pts.push(p);
      }
      pts.res = res; return pts;
    }
    update() {
      this.stats.it.set(this.sweeps);
      this.stats.d.set(isFinite(this.delta) ? this.delta.toExponential(1) : "—");
      const far = 1 - this.phi[(this.NY - 3) * this.NX + 2];
      this.stats.far.set(far > 0 ? far.toExponential(1) : "0（还没传到）");
    }
    draw(ctx, st, col) {
      st.frame(col);
      const NX = this.NX, NY = this.NY, vals = new Float64Array(NX * NY);
      for (let k = 0; k < NX * NY; k++) vals[k] = this.obs[k] ? NaN : -Math.log10(Math.max(1e-16, 1 - this.phi[k]));
      st.heat(vals, NX, NY, (v) => v / 16, col, { bands: 16, smooth: false, rect: [0, 1.6, 0, 1], inf: col.wall });
      ctx.globalAlpha = .9; for (const [x0, y0, x1, y1] of this.rects) st.poly(C.rect(x0, y0, x1, y1), null, col.wall, 1); ctx.globalAlpha = 1;
      for (const l of this.lines) { st.polyline(l, l.res === "goal" ? col.path : col.bad, 2.4); st.dot(l[0], 4, col.start, col.surface, 1.5); if (l.res !== "goal") st.xmark(l[l.length - 1], col.bad, 5); }
      st.qmark({ x: (this.goal[0] + .5) * 1.6 / NX, y: (this.goal[1] + .5) / NY }, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-accel']").forEach((el) => el._w = new AccelControl(el));
    document.querySelectorAll("[data-widget='ch8-rk']").forEach((el) => el._w = new RimonKoditschek(el));
    document.querySelectorAll("[data-widget='ch8-harmonic']").forEach((el) => el._w = new Harmonic(el));
  });
})();
