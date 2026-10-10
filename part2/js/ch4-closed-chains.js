/* 第 4 章 · 4.4 闭链：variety-2link（图 4.22/4.23）、variety-3link（图 4.24–4.26）、linkage-graph（4.4.3 连杆图与自由度上界） */
(function () {
  "use strict";
  const { shell, palette, alpha, makeCanvas, onDrag, svgPoint, slider, segmented, button, checkbox, G, num, h, s } = CH4;
  const TAU = 2 * Math.PI;

  // 网格上的等值线（marching squares），返回线段 [[x0,y0],[x1,y1]]（θ 坐标）
  function contour(f, M) {
    const v = new Float64Array((M + 1) * (M + 1)), X = (i) => ((i + 0.5) / M) * TAU - (0.5 / M) * TAU;
    for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) v[j * (M + 1) + i] = f((i / M) * TAU + 1e-7, (j / M) * TAU + 1.3e-7);
    const segs = [];
    const lerp = (a, b, va, vb) => { const t = va / (va - vb); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [(a / M) * TAU, (b / M) * TAU]);
      const val = [v[j * (M + 1) + i], v[j * (M + 1) + i + 1], v[(j + 1) * (M + 1) + i + 1], v[(j + 1) * (M + 1) + i]];
      const pts = [];
      for (let k = 0; k < 4; k++) { const a = val[k], b = val[(k + 1) % 4]; if ((a < 0) !== (b < 0)) pts.push(lerp(p[k], p[(k + 1) % 4], a, b)); }
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) { const c = (val[0] + val[1] + val[2] + val[3]) / 4; if ((c < 0) === (val[0] < 0)) { segs.push([pts[0], pts[3]]); segs.push([pts[1], pts[2]]); } else { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); } }
    }
    void X;
    return segs;
  }

  // =====================================================================
  // 13. 两连杆的 variety
  // =====================================================================
  class Variety2 {
    constructor(root) {
      this.body = shell(root, "两连杆的 variety", "图 4.22、4.23：两根长度为 1 的连杆，末端点 p 被约束");
      this.mode = "line"; this.c = 0; this.cur = [Math.PI / 3, Math.PI - 2 * (Math.PI / 3)];
      this.build();
    }
    build() {
      const b = this.body;
      this.cSl = slider("约束 f₁ = x(p) =", -2.5, 2.5, 0.005, this.c, (v) => { this.c = v; this.update(); }, (v) => num(v, 3));
      this.lineCtl = h("span", { class: "controls", style: "margin:0" }, this.cSl,
        ...[[0, "0"], [0.125, "1/8"], [1, "1"], [2, "2"], [2.3, "2.3"]].map(([v, l]) => button(l, () => { this.c = v; this.cSl.set(v); this.update(); }, "small")));
      b.append(h("div", { class: "controls" }, segmented([["point", "零维：p 固定在 (1, 1)"], ["line", "一维：只固定 p 的 x 坐标"]], this.mode, (k) => { this.mode = k; this.update(); }), this.lineCtl));
      const c1 = h("div"), c2 = h("div");
      this.info = h("div", { class: "status-line", style: "margin-top:8px" });
      b.append(h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, c1, c2), this.info);
      this.ws = makeCanvas(c1, { aspect: 1, maxW: 380 }, (ctx, w) => this.drawW(ctx, w));
      this.cs = makeCanvas(c2, { aspect: 1, maxW: 380 }, (ctx, w) => this.drawC(ctx, w));
      const pick = (p) => {
        const { m, S } = this.geom(); const t = [((p.x - m) / S) * TAU, (1 - (p.y - 8) / S) * TAU];
        let best = null, bd = Infinity;
        if (this.mode === "point") { for (const q of this.sols) { const d = Math.hypot(q[0] - t[0], q[1] - t[1]); if (d < bd) { bd = d; best = q; } } }
        else for (const sg of this.segs) { const r = G.closestOnSeg(t, sg[0], sg[1]); const d = G.len(G.sub(r.p, t)); if (d < bd) { bd = d; best = r.p; } }
        if (best) { this.cur = best.slice(); this.ws.redraw(); this.cs.redraw(); this.status(); }
      };
      onDrag(this.cs.canvas, { down: pick, move: pick });
      this.cs.canvas.style.cursor = "crosshair";
      this.update();
    }
    geom() { const w = this.cs.w, m = 28; return { m, S: w - m - 8 }; }
    update() {
      this.lineCtl.classList.toggle("hidden", this.mode !== "line");
      const M = 220;
      if (this.mode === "line") {
        this.segs = contour((a, b) => Math.cos(a) + Math.cos(a + b) - this.c, M);
        this.segs2 = [];
        // 当前点吸附到新的 variety 上
        const ref = this.cur || [Math.PI / 3, Math.PI / 3];
        let best = null, bd = Infinity;
        for (const sg of this.segs) { const r = G.closestOnSeg(ref, sg[0], sg[1]); const d = G.len(G.sub(r.p, ref)); if (d < bd) { bd = d; best = r.p; } }
        this.cur = best ? best : null;
        if (Math.abs(Math.abs(this.c) - 2) < 1e-9) this.cur = this.c > 0 ? [0, 0] : [Math.PI, 0];
      } else {
        this.segs = contour((a, b) => Math.cos(a) + Math.cos(a + b) - 1, M);
        this.segs2 = contour((a, b) => Math.sin(a) + Math.sin(a + b) - 1, M);
        this.sols = [[0, Math.PI / 2], [Math.PI / 2, 1.5 * Math.PI]];
        this.cur = this.sols[0].slice();
      }
      this.ws.redraw(); this.cs.redraw(); this.status();
    }
    topo() {
      const a = Math.abs(this.c), e = 1e-9;
      if (a > 2 + e) return "<b>空集</b>：p 够不着这条线（两根连杆加起来只有 2 长）。";
      if (Math.abs(a - 2) <= e) return `<b>一个点</b>：只有 θ₁ = ${this.c > 0 ? "0" : "π"}、θ₂ = 0（手臂伸直）。`;
      if (a <= e) return "<b>不是流形</b>：水平线 θ₂ = π（两根连杆完全重叠一起转）与斜线 θ₂ = π − 2θ₁ 交叉。交叉点 (π, π) 在正中央，(0, π) 在左右边上（左右边是粘在一起的）。";
      return "<b>同胚于 S¹</b>：一条光滑的闭曲线（注意左右、上下边是粘在一起的）。";
    }
    status() {
      if (this.mode === "point") { this.info.innerHTML = "variety (4.64) 只有两个点：(θ₁, θ₂) = (0, π/2) 和 (π/2, −π/2)。四个方程、四个变量 → 零维。蓝线 = {x(p) = 1}，紫线 = {y(p) = 1}，它们的交点就是解。点右图切换两个解。"; return; }
      this.info.innerHTML = `f₁ = cos θ₁ + cos(θ₁ + θ₂) = ${num(this.c, 3)}：${this.topo()}` + (this.cur ? ` <span class="muted">当前 (θ₁, θ₂) = (${num((this.cur[0] * 180) / Math.PI, 0)}°, ${num((this.cur[1] * 180) / Math.PI, 0)}°)。在右图上拖动，手臂会沿着 variety 动。</span>` : "");
    }
    drawW(ctx, w) {
      const P = palette(), k = w / 5, T = (p) => [w / 2 + k * p[0], w / 2 - k * p[1]];
      ctx.clearRect(0, 0, w, w);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, w / 2); ctx.lineTo(w, w / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, w); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(w / 2, w / 2, 2 * k, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (this.mode === "line") {
        const a = T([this.c, -2.5]), b = T([this.c, 2.5]);
        ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = P.accent; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillText(`x = ${num(this.c, 3)}`, a[0] + 5, T([0, 2.3])[1]);
      } else {
        const q = T([1, 1]); ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, 7); ctx.stroke();
      }
      if (!this.cur) return;
      const t = this.cur, p1 = [Math.cos(t[0]), Math.sin(t[0])], p2 = G.add(p1, [Math.cos(t[0] + t[1]), Math.sin(t[0] + t[1])]);
      const J = [[0, 0], p1, p2].map(T);
      ctx.lineCap = "round";
      ctx.strokeStyle = P.bad; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(J[0][0], J[0][1]); ctx.lineTo(J[1][0], J[1][1]); ctx.stroke();
      ctx.strokeStyle = CH4.mix(P.bad, P.surface, 0.35); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(J[1][0], J[1][1]); ctx.lineTo(J[2][0], J[2][1]); ctx.stroke();
      ctx.fillStyle = P.text; J.forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 7); ctx.fill(); });
      ctx.fillStyle = P.text; ctx.font = "13px " + getComputedStyle(document.body).fontFamily; ctx.fillText("p", J[2][0] + 7, J[2][1] - 7);
      ctx.fillText("A₁", (J[0][0] + J[1][0]) / 2 + 6, (J[0][1] + J[1][1]) / 2 + 14); ctx.fillText("A₂", (J[1][0] + J[2][0]) / 2 + 6, (J[1][1] + J[2][1]) / 2 + 14);
    }
    drawC(ctx, w) {
      const P = palette(), { m, S } = this.geom();
      ctx.clearRect(0, 0, w, w);
      ctx.fillStyle = P.surface; ctx.fillRect(m, 8, S, S);
      const T = (t) => [m + (t[0] / TAU) * S, 8 + (1 - t[1] / TAU) * S];
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(m + (k * S) / 4, 8); ctx.lineTo(m + (k * S) / 4, 8 + S); ctx.moveTo(m, 8 + (k * S) / 4); ctx.lineTo(m + S, 8 + (k * S) / 4); ctx.stroke(); }
      ctx.strokeStyle = P.accent; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.strokeRect(m, 8, S, S); ctx.setLineDash([]);
      const drawSegs = (segs, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.beginPath(); segs.forEach(([a, b]) => { const A = T(a), B = T(b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }); ctx.stroke(); };
      drawSegs(this.segs, P.accent);
      if (this.mode === "point") {
        drawSegs(this.segs2, P.purple);
        this.sols.forEach((q) => { const p = T(q); ctx.fillStyle = P.warn; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); });
      } else {
        if (Math.abs(this.c) < 1e-9) [[0, Math.PI], [Math.PI, Math.PI], [TAU, Math.PI]].forEach((q) => { const p = T(q); ctx.strokeStyle = P.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, 7); ctx.stroke(); });
        if (Math.abs(Math.abs(this.c) - 2) < 1e-9) { const pts = this.c > 0 ? [[0, 0], [TAU, 0], [0, TAU], [TAU, TAU]] : [[Math.PI, 0], [Math.PI, TAU]]; pts.forEach((q) => { const p = T(q); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); }); }
      }
      if (this.cur) { const p = T(this.cur); ctx.strokeStyle = P.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.stroke(); }
      ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "center";
      ctx.fillText("θ₁：0 → 2π", m + S / 2, w - 1);
      ctx.save(); ctx.translate(12, 8 + S / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("θ₂：0 → 2π", 0, 0); ctx.restore(); ctx.textAlign = "left";
    }
  }

  // =====================================================================
  // 14. 三连杆的 variety（三维立方体，对面粘合）
  // =====================================================================
  const FOURBAR = [(t) => [0, 2 * t, Math.PI], (t) => [t, TAU - t, Math.PI + t], (t) => [TAU - t, t, Math.PI - t], (t) => [TAU - t, Math.PI, Math.PI + t], (t) => [t, Math.PI, Math.PI - t]];
  class Variety3 {
    constructor(root) {
      this.body = shell(root, "三连杆的 variety", "图 4.24–4.26：立方体 [0, 2π]³，对面粘合；拖动画面旋转");
      this.mode = "surface"; this.c = 0; this.cam = [0.7, 0.45]; this.t = 0.6; this.pick = null;
      this.build();
    }
    build() {
      const b = this.body;
      this.cSl = slider("f₁ = x(p) =", -0.5, 3.3, 0.005, this.c, (v) => { this.c = v; this.compute(); }, (v) => num(v, 3));
      this.surfCtl = h("span", { class: "controls", style: "margin:0" }, this.cSl,
        ...[[0, "0"], [0.875, "7/8"], [1, "1"], [2, "2"], [3, "3"]].map(([v, l]) => button(l, () => { this.c = v; this.cSl.set(v); this.compute(); }, "small")),
        button("随机取 variety 上一点", () => { if (this.pts.length) { this.pick = this.pts[(Math.random() * this.pts.length) | 0]; this.drawAll(); } }, "small"));
      this.tSl = slider("沿曲线走 t =", 0, 5, 0.002, this.t, (v) => { this.t = v; this.drawAll(); }, (v) => num(v, 2));
      this.fbCtl = h("span", { class: "controls", style: "margin:0" }, this.tSl, button("▶ 播放", () => this.play(), "small"));
      b.append(h("div", { class: "controls" }, segmented([["surface", "只约束 x(p) = f₁（曲面）"], ["fourbar", "再加 y(p) = 0：四连杆（曲线）"]], this.mode, (k) => { this.mode = k; this.compute(); }), this.surfCtl, this.fbCtl));
      const c1 = h("div"), c2 = h("div");
      this.info = h("div", { class: "status-line", style: "margin-top:8px" });
      b.append(h("div", { class: "split", style: "grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)" }, c1, c2), this.info);
      this.cv = makeCanvas(c1, { aspect: 0.9, maxW: 480 }, (ctx, w, hh) => this.draw3(ctx, w, hh));
      this.arm = makeCanvas(c2, { aspect: 1, maxW: 320 }, (ctx, w) => this.drawArm(ctx, w));
      let last = null, moved = false;
      onDrag(this.cv.canvas, {
        down: (p) => { last = p; moved = false; },
        move: (p) => { if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) > 0) moved = true; this.cam[0] += (p.x - last.x) * 0.01; this.cam[1] = Math.max(-1.4, Math.min(1.4, this.cam[1] + (p.y - last.y) * 0.01)); last = p; this.cv.redraw(); },
        up: (p) => { if (!moved && this.mode === "surface") this.pickAt(p); },
      });
      this.cv.canvas.style.cursor = "grab";
      this.compute();
    }
    f(t) { return Math.cos(t[0]) + Math.cos(t[0] + t[1]) + Math.cos(t[0] + t[1] + t[2]); }
    compute() {
      this.surfCtl.classList.toggle("hidden", this.mode !== "surface");
      this.fbCtl.classList.toggle("hidden", this.mode !== "fourbar");
      const pts = [];
      if (this.mode === "surface") {
        const M = 46, c = this.c, val = new Float64Array((M + 1) ** 3);
        const id = (i, j, k) => (k * (M + 1) + j) * (M + 1) + i;
        for (let k = 0; k <= M; k++) for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) val[id(i, j, k)] = this.f([(i / M) * TAU + 1e-7, (j / M) * TAU + 2e-7, (k / M) * TAU + 3e-7]) - c;
        for (let k = 0; k <= M; k++) for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
          const a = val[id(i, j, k)];
          if (i < M) { const b = val[id(i + 1, j, k)]; if ((a < 0) !== (b < 0)) { const u = a / (a - b); pts.push([((i + u) / M) * TAU, (j / M) * TAU, (k / M) * TAU]); } }
          if (j < M) { const b = val[id(i, j + 1, k)]; if ((a < 0) !== (b < 0)) { const u = a / (a - b); pts.push([(i / M) * TAU, ((j + u) / M) * TAU, (k / M) * TAU]); } }
          if (k < M) { const b = val[id(i, j, k + 1)]; if ((a < 0) !== (b < 0)) { const u = a / (a - b); pts.push([(i / M) * TAU, (j / M) * TAU, ((k + u) / M) * TAU]); } }
        }
        if (Math.abs(c - 3) < 1e-9) for (const x of [0, TAU]) for (const y of [0, TAU]) for (const z of [0, TAU]) pts.push([x, y, z]);
        this.pick = pts.length ? pts[(pts.length * 0.37) | 0] : null;
      } else {
        FOURBAR.forEach((g) => { for (let i = 0; i <= 80; i++) pts.push(g((i / 80) * Math.PI)); });
      }
      this.pts = pts;
      this.drawAll();
    }
    curFB() { const k = Math.min(4, Math.floor(this.t)), u = (this.t - k) * Math.PI; return FOURBAR[k](u).map((x) => ((x % TAU) + TAU) % TAU); }
    play() {
      if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; return; }
      const step = () => { this.t = (this.t + 0.01) % 5; this.tSl.set(this.t); this.drawAll(); this.anim = requestAnimationFrame(step); };
      this.anim = requestAnimationFrame(step);
    }
    drawAll() { this.cv.redraw(); this.arm.redraw(); this.status(); }
    status() {
      if (this.mode === "fourbar") { const t = this.curFB(); this.info.innerHTML = `f₁ = 1 且 f₂ = 0：末端固定在 (1, 0)，相当于一个四连杆（第四根杆是 x 轴上的 [0, 1]）。variety 是五段直线（书中的参数化），在交点处相交，<b>不是流形</b>。当前 (θ₁, θ₂, θ₃) = (${t.map((x) => num((x * 180) / Math.PI, 0) + "°").join(", ")})。`; return; }
      const a = Math.abs(this.c), e = 1e-9;
      let tp;
      if (a > 3 + e) tp = "<b>空集</b>：三根长度为 1 的连杆最远只能伸到 3。";
      else if (Math.abs(a - 3) <= e) tp = "<b>一个点</b>：θ₁ = θ₂ = θ₃ = 0（立方体的 8 个角粘成同一点）。";
      else if (a > 1 + e) tp = "<b>同胚于 S²</b>（书中图 4.25 右画的是 f₁ = 2 的情形）。";
      else if (Math.abs(a - 1) <= e) tp = "<b>不是流形</b>（书中所说：f₁ = 1 时拓扑在这里改变）。";
      else tp = a < e ? "一个二维流形（图 4.24）。" : "仍是二维流形，正在收缩（图 4.25 左，f₁ = 7/8）。";
      this.info.innerHTML = `f₁ = ${num(this.c, 3)}：${tp} <span class="muted">共 ${this.pts.length} 个采样点。点击画面上的点可以在右边看到对应的手臂。拓扑在 f₁ = ±1、±3 处改变——正是三根连杆共线的那些值。</span>`;
    }
    proj(p, w, hh) { // p ∈ [0, 2π]³ → 屏幕
      const q = p.map((x) => x / Math.PI - 1);
      const [yaw, pitch] = this.cam;
      const x1 = q[0] * Math.cos(yaw) - q[1] * Math.sin(yaw), y1 = q[0] * Math.sin(yaw) + q[1] * Math.cos(yaw);
      const depth = y1 * Math.cos(pitch) + q[2] * Math.sin(pitch), sy = -y1 * Math.sin(pitch) + q[2] * Math.cos(pitch);
      const k = Math.min(w, hh) * 0.3;
      return [w / 2 + k * x1, hh / 2 - k * sy, depth];
    }
    pickAt(p) {
      let best = null, bd = 14;
      for (const q of this.pts) { const s_ = this.proj(q, this.cv.w, this.cv.h); const d = Math.hypot(s_[0] - p.x, s_[1] - p.y) - s_[2] * 2; if (d < bd) { bd = d; best = q; } }
      if (best) { this.pick = best; this.drawAll(); }
    }
    draw3(ctx, w, hh) {
      const P = palette(); ctx.clearRect(0, 0, w, hh);
      const C = [0, TAU];
      const corners = []; for (const x of C) for (const y of C) for (const z of C) corners.push([x, y, z]);
      const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      ctx.strokeStyle = P.borderStrong; ctx.lineWidth = 1;
      E.forEach(([i, j]) => { const a = this.proj(corners[i], w, hh), b = this.proj(corners[j], w, hh); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillStyle = P.muted;
      [[[TAU * 1.08, 0, 0], "θ₁"], [[0, TAU * 1.08, 0], "θ₂"], [[0, 0, TAU * 1.08], "θ₃"]].forEach(([p, l]) => { const a = this.proj(p, w, hh); ctx.fillText(l, a[0] - 6, a[1] + 4); });
      if (this.mode === "surface") {
        const proj = this.pts.map((p) => this.proj(p, w, hh));
        for (let i = 0; i < proj.length; i++) { const q = proj[i], a = 0.25 + 0.55 * ((q[2] + 1.8) / 3.6); ctx.fillStyle = alpha(P.accent, Math.max(0.12, Math.min(0.9, a))); ctx.fillRect(q[0] - 1.1, q[1] - 1.1, 2.2, 2.2); }
        if (Math.abs(this.c - 3) < 1e-9) proj.forEach((q) => { ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 7); ctx.fill(); });
        if (this.pick) { const q = this.proj(this.pick, w, hh); ctx.strokeStyle = P.bad; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, 7); ctx.stroke(); }
      } else {
        ctx.strokeStyle = P.accent; ctx.lineWidth = 3; ctx.lineCap = "round";
        FOURBAR.forEach((g) => { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const q = this.proj(g((i / 40) * Math.PI), w, hh); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); });
        const q = this.proj(FOURBAR[Math.min(4, Math.floor(this.t))]((this.t - Math.min(4, Math.floor(this.t))) * Math.PI), w, hh);
        ctx.fillStyle = P.bad; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, 7); ctx.fill();
      }
    }
    drawArm(ctx, w) {
      const P = palette(), k = w / 7, T = (p) => [w / 2 + k * p[0], w / 2 - k * p[1]];
      ctx.clearRect(0, 0, w, w);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, w / 2); ctx.lineTo(w, w / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, w); ctx.stroke();
      let t;
      if (this.mode === "fourbar") {
        t = this.curFB();
        const a = T([0, 0]), b = T([1, 0]); ctx.strokeStyle = P.ok; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.fillStyle = P.ok; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillText("A₄（固定）", a[0] + 4, a[1] + 20);
      } else {
        const a = T([this.c, -3.4]), b = T([this.c, 3.4]); ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        t = this.pick;
      }
      if (!t) return;
      let p = [0, 0], ang = 0; const J = [p];
      for (let i = 0; i < 3; i++) { ang += t[i]; p = G.add(p, [Math.cos(ang), Math.sin(ang)]); J.push(p); }
      const S = J.map(T);
      const cols = [P.bad, CH4.mix(P.bad, P.surface, 0.3), CH4.mix(P.bad, P.surface, 0.55)];
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = cols[i]; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(S[i + 1][0], S[i + 1][1]); ctx.stroke(); }
      ctx.fillStyle = P.text; S.forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], 3.5, 0, 7); ctx.fill(); });
      ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillText("p", S[3][0] + 6, S[3][1] - 6);
    }
  }

  // =====================================================================
  // 15. 连杆图、生成树与自由度上界
  // =====================================================================
  const LINKAGES = {
    four: { name: "四连杆（图 4.26）", nodes: [[140, 230], [140, 80], [380, 80], [380, 230]], edges: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    five: { name: "五连杆", nodes: [[110, 230], [90, 110], [270, 50], [450, 110], [430, 230]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
    watt: { name: "Watt 六连杆", nodes: [[100, 230], [440, 230], [90, 80], [250, 150], [270, 40], [430, 80]], edges: [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 4], [3, 5]] },
    steph: { name: "Stephenson 六连杆", nodes: [[100, 230], [270, 60], [270, 160], [440, 230], [90, 80], [450, 80]], edges: [[0, 1], [1, 3], [0, 2], [2, 3], [0, 4], [4, 5], [5, 3]] },
    tri: { name: "三角形（刚性结构）", nodes: [[120, 230], [270, 60], [420, 230]], edges: [[0, 1], [1, 2], [2, 0]] },
  };
  class LinkageGraph {
    constructor(root) {
      this.body = shell(root, "连杆图与自由度上界", "4.4.3 节：顶点 = 连杆，边 = 关节；点一条边把它在「生成树 / 剪掉」之间切换");
      this.pid = "four"; this.freeRoot = false;
      const sel = h("select", null, Object.entries(LINKAGES).map(([k, v]) => h("option", { value: k }, v.name)));
      sel.addEventListener("change", () => { this.pid = sel.value; this.reset(); });
      this.body.append(h("div", { class: "controls" }, sel, button("自动选一棵生成树（BFS）", () => this.reset(), "small"),
        checkbox("根连杆 A₁ 也可以在平面里自由移动（+SE(2) 的 3 维）", false, (v) => { this.freeRoot = v; this.render(); })));
      this.svg = s("svg", { viewBox: "0 0 540 280", style: "width:100%;max-width:620px;display:block;margin:0 auto;user-select:none" });
      this.info = h("div", { class: "panel-body" });
      this.body.append(h("div", { class: "split" }, h("div", { class: "svg-wrap" }, this.svg), h("div", { class: "panel" }, h("div", { class: "panel-title" }, "计数"), this.info)));
      this.reset();
    }
    reset() {
      const L = LINKAGES[this.pid], n = L.nodes.length;
      this.cut = new Set(L.edges.map((_, i) => i));
      const seen = new Set([0]), Q = [0];
      while (Q.length) { const u = Q.shift(); L.edges.forEach(([a, b], i) => { const v = a === u ? b : b === u ? a : -1; if (v >= 0 && !seen.has(v)) { seen.add(v); Q.push(v); this.cut.delete(i); } }); }
      void n;
      this.render();
    }
    render() {
      const L = LINKAGES[this.pid], svg = this.svg, n = L.nodes.length;
      svg.innerHTML = "";
      L.edges.forEach(([a, b], i) => {
        const p = L.nodes[a], q = L.nodes[b], cut = this.cut.has(i);
        const ln = s("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: cut ? "var(--warn)" : "var(--accent)", "stroke-width": cut ? 3 : 4, "stroke-dasharray": cut ? "7 5" : "none", style: "cursor:pointer" });
        const hit = s("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: "transparent", "stroke-width": 18, style: "cursor:pointer" });
        const tog = () => { if (this.cut.has(i)) this.cut.delete(i); else this.cut.add(i); this.render(); };
        hit.addEventListener("click", tog); ln.addEventListener("click", tog);
        svg.append(ln, hit);
        svg.append(s("text", { x: (p[0] + q[0]) / 2 + 6, y: (p[1] + q[1]) / 2 - 6, "font-size": 11, fill: cut ? "var(--warn)" : "var(--muted)" }, cut ? "剪掉" : "关节"));
      });
      L.nodes.forEach((p, i) => {
        svg.append(s("circle", { cx: p[0], cy: p[1], r: 17, fill: i === 0 ? "var(--ok-soft)" : "var(--surface)", stroke: i === 0 ? "var(--ok)" : "var(--text-2)", "stroke-width": 2 }));
        svg.append(s("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 13, fill: "var(--text)" }, `A${i + 1}`));
      });
      svg.append(s("text", { x: 10, y: 272, "font-size": 11, fill: "var(--ok)" }, "A₁ = 根（默认固定在 W 中）"));
      // 检查生成树
      const tree = L.edges.filter((_, i) => !this.cut.has(i));
      const parent = [...Array(n).keys()], find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      let cyc = false; tree.forEach(([a, b]) => { const ra = find(a), rb = find(b); if (ra === rb) cyc = true; else parent[ra] = rb; });
      const comps = new Set([...Array(n).keys()].map(find)).size;
      const ok = !cyc && comps === 1;
      const J = L.edges.length, cuts = this.cut.size;
      const m = tree.length + (this.freeRoot ? 3 : 0), l = 2 * cuts;
      const grub = 3 * (n - 1) - 2 * J + (this.freeRoot ? 3 : 0);
      this.info.innerHTML = (ok ? `<div class="msg ok">✓ 实线构成一棵生成树：每个连杆都能从根走到。</div>` :
        `<div class="msg bad">✗ 实线${cyc ? "里有圈" : ""}${cyc && comps > 1 ? "，而且" : ""}${comps > 1 ? `不连通（${comps} 块）` : ""}，还不是生成树。</div>`) +
        `<dl class="kv"><dt>连杆数 N</dt><dd>${n}（含根）</dd><dt>转动副 J</dt><dd>${J}</dd>` +
        `<dt>生成树的自由度 m</dt><dd>${tree.length}（树上每个转动副 1 个）${this.freeRoot ? " + 3（根在 SE(2) 里）" : ""} = ${m}</dd>` +
        `<dt>闭合约束 l</dt><dd>剪掉 ${cuts} 条边 × 每条 2 个方程（x、y）= ${l}</dd>` +
        `<dt>上界 m − l</dt><dd><b>${ok ? m - l : "—"}</b></dd>` +
        `<dt>Grübler 公式</dt><dd>3(N − 1) − 2J${this.freeRoot ? " + 3" : ""} = <b>${grub}</b></dd></dl>` +
        `<p class="small muted" style="margin:6px 0 0">${ok ? "无论选哪棵生成树，m − l 都等于 Grübler 公式（补充：两者是同一件事）。它只是上界：遇到平行四边形之类的特殊尺寸，约束不独立，实际自由度可能更大。" : "调整到实线恰好构成生成树。"}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reg = { "variety-2link": Variety2, "variety-3link": Variety3, "linkage-graph": LinkageGraph };
    for (const [k, C] of Object.entries(reg)) document.querySelectorAll(`[data-widget='${k}']`).forEach((el) => { try { el._w = new C(el); } catch (e) { console.error(k, e); } });
  });
})();
