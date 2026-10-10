/* 第 4 章 · 4.1.2–4.1.3：gluing（图 4.5 + 习题 27 粘合正方形上的直线）、homotopy（图 4.6、例 4.9/4.10 基本群） */
(function () {
  "use strict";
  const { shell, palette, alpha, makeCanvas, onDrag, slider, segmented, button, checkbox, G, num, h } = CH4;

  // =====================================================================
  // 5. 粘合正方形
  // =====================================================================
  const EDGES = {
    L: { pos: (s, d) => (d === "up" ? [0, s] : [0, 1 - s]), par: (p, d) => (d === "up" ? p[1] : 1 - p[1]), tan: (d) => (d === "up" ? [0, 1] : [0, -1]), inward: [1, 0] },
    R: { pos: (s, d) => (d === "up" ? [1, s] : [1, 1 - s]), par: (p, d) => (d === "up" ? p[1] : 1 - p[1]), tan: (d) => (d === "up" ? [0, 1] : [0, -1]), inward: [-1, 0] },
    B: { pos: (s, d) => (d === "right" ? [s, 0] : [1 - s, 0]), par: (p, d) => (d === "right" ? p[0] : 1 - p[0]), tan: (d) => (d === "right" ? [1, 0] : [-1, 0]), inward: [0, 1] },
    T: { pos: (s, d) => (d === "right" ? [s, 1] : [1 - s, 1]), par: (p, d) => (d === "right" ? p[0] : 1 - p[0]), tan: (d) => (d === "right" ? [1, 0] : [-1, 0]), inward: [0, -1] },
  };
  const SURF = {
    plane: { name: "平面 ℝ²", glue: [], ident: "不做任何粘合（开正方形 (0,1)² ≅ ℝ²）", bd: "没有边界点（开集），但走到正方形边缘 = 走向无穷远", orient: "可定向", pi1: "1（单连通）" },
    cyl: { name: "柱面 ℝ×S¹", glue: [["L", "up", "R", "up"]], ident: "(0, y) ∼ (1, y)", bd: "上下两条边仍是边缘", orient: "可定向", pi1: "ℤ" },
    mob: { name: "Möbius 带", glue: [["L", "up", "R", "down"]], ident: "(0, y) ∼ (1, 1 − y)：带一次翻转", bd: "上下两条边仍是边缘", orient: "<b>不可定向</b>", pi1: "ℤ（和柱面一样，基本群看不出扭转）" },
    torus: { name: "环面 T²", glue: [["L", "up", "R", "up"], ["B", "right", "T", "right"]], ident: "(0, y) ∼ (1, y)，(x, 0) ∼ (x, 1)", bd: "无边界，像小行星游戏的屏幕", orient: "可定向", pi1: "ℤ²" },
    klein: { name: "Klein 瓶", glue: [["L", "up", "R", "down"], ["B", "right", "T", "right"]], ident: "左右带翻转，上下不翻转", bd: "无边界", orient: "<b>不可定向</b>", pi1: "⟨a, b | abab⁻¹⟩（补充：不交换）" },
    rp2: { name: "射影平面 ℝP²", glue: [["L", "up", "R", "down"], ["B", "right", "T", "left"]], ident: "左右、上下都带翻转", bd: "无边界", orient: "<b>不可定向</b>", pi1: "ℤ₂（例 4.11）" },
    sphere: { name: "球面 S²", glue: [["L", "down", "T", "right"], ["R", "up", "B", "left"]], ident: "左边粘上边（绕左上角折），右边粘下边（绕右下角折）", bd: "无边界；左上角、右下角是两极", orient: "可定向", pi1: "1（单连通）" },
  };
  class Gluing {
    constructor(root) {
      this.body = shell(root, "粘合正方形上的直线", "图 4.5 + 习题 27：选一种粘合，让小飞船沿直线飞");
      this.sid = root.dataset.surface || "torus";
      this.angle = Math.atan2(2, 3);
      this.speed = 1;
      this.start = [0, 0];
      this.trail = [];
      this.playing = false;
      this.build();
      this.reset();
    }
    build() {
      const b = this.body;
      this.surfSeg = segmented(Object.entries(SURF).map(([k, v]) => [k, v.name]), this.sid, (k) => { this.sid = k; this.reset(); });
      this.angSlider = slider("方向 θ =", 0, 360, 0.1, (this.angle * 180) / Math.PI, (v) => { this.angle = (v * Math.PI) / 180; this.reset(); }, (v) => num(v, 1) + "°");
      const presets = h("span", { class: "controls", style: "margin:0" }, h("span", { class: "small muted" }, "斜率："),
        ...[["1", 1, 1], ["1/2", 2, 1], ["2/3", 3, 2], ["3/5", 5, 3], ["√2（无理）", 1, Math.SQRT2]].map(([lab, dx, dy]) =>
          button(lab, () => { this.angle = Math.atan2(dy, dx); this.angSlider.set((this.angle * 180) / Math.PI); this.reset(); this.play(true); }, "small")));
      this.btnPlay = button("▶ 飞", () => this.play(!this.playing), "primary");
      const ctr2 = h("div", { class: "controls" }, this.btnPlay,
        button("⟲ 回到起点", () => this.reset()),
        slider("速度", 0.1, 3, 0.05, this.speed, (v) => { this.speed = v; }, (v) => num(v, 2) + "×"));
      const cv = h("div");
      this.info = h("div", { class: "panel-body" });
      b.append(h("div", { class: "controls" }, this.surfSeg), h("div", { class: "controls" }, this.angSlider, presets), ctr2,
        h("div", { class: "split" }, cv, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "这个曲面"), this.info)));
      this.cv = makeCanvas(cv, { aspect: 1, maxW: 460 }, (ctx, w, hh) => this.draw(ctx, w, hh));
      onDrag(this.cv.canvas, { down: (p) => { const q = this.toU(p); if (q) { this.start = q; this.reset(); } return false; } });
      this.cv.canvas.style.cursor = "crosshair";
    }
    geom() { const w = this.cv.w, m = 34, S = w - 2 * m; return { m, S }; }
    toU(p) { const { m, S } = this.geom(); const x = (p.x - m) / S, y = 1 - (p.y - m) / S; if (x < 0 || x > 1 || y < 0 || y > 1) return null; return [x, y]; }
    toC(q) { const { m, S } = this.geom(); return [m + q[0] * S, m + (1 - q[1]) * S]; }
    reset() {
      this.v = [Math.cos(this.angle), Math.sin(this.angle)];
      this.l = [-this.v[1], this.v[0]];
      this.p = this.start.slice();
      // 起点在边上时往里推一点
      this.p = [Math.min(1 - 1e-9, Math.max(1e-9, this.p[0])), Math.min(1 - 1e-9, Math.max(1e-9, this.p[1]))];
      this.trail = [[this.p.slice()]];
      this.crossings = 0;
      this.stopped = false;
      this.dist = 0;
      this.renderInfo();
      this.cv.redraw();
    }
    play(on) {
      this.playing = on && !this.stopped;
      this.btnPlay.innerHTML = this.playing ? "⏸ 暂停" : "▶ 飞";
      if (this.playing) {
        let last = performance.now();
        const tick = (now) => {
          if (!this.playing) return;
          const dt = Math.min(0.1, (now - last) / 1000); last = now;
          let steps = Math.ceil(this.speed * 6);
          for (let i = 0; i < steps; i++) this.step((this.speed * dt * 1.6) / steps);
          this.cv.redraw();
          if (this.stopped) { this.play(false); this.renderInfo(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }
    step(ds) {
      const S = SURF[this.sid];
      let rem = ds, guard = 0;
      while (rem > 1e-12 && guard++ < 6) {
        const p = this.p, v = this.v;
        // 到四条边的参数距离
        let tmin = rem, edge = null;
        const cand = [["L", v[0] < 0 ? -p[0] / v[0] : Infinity], ["R", v[0] > 0 ? (1 - p[0]) / v[0] : Infinity], ["B", v[1] < 0 ? -p[1] / v[1] : Infinity], ["T", v[1] > 0 ? (1 - p[1]) / v[1] : Infinity]];
        for (const [e, t] of cand) if (t < tmin) { tmin = t; edge = e; }
        const np = [p[0] + v[0] * tmin, p[1] + v[1] * tmin];
        this.trail[this.trail.length - 1].push(np);
        this.dist += tmin;
        rem -= tmin;
        this.p = np;
        if (!edge) break;
        // 找粘合
        let g = null;
        for (const [e1, d1, e2, d2] of S.glue) {
          if (e1 === edge) g = [e1, d1, e2, d2];
          else if (e2 === edge) g = [e2, d2, e1, d1];
        }
        if (!g) { this.stopped = true; return; }
        const [eA, dA, eB, dB] = g, A = EDGES[eA], B = EDGES[eB];
        const sPar = A.par(np, dA);
        const tA = A.tan(dA), tB = B.tan(dB);
        const map = (u) => { const t = G.dot(u, tA), n = -G.dot(u, A.inward); return [t * tB[0] + n * B.inward[0], t * tB[1] + n * B.inward[1]]; };
        this.v = map(this.v);
        this.l = map(this.l);
        const q = B.pos(sPar, dB);
        this.p = [q[0] + B.inward[0] * 1e-9, q[1] + B.inward[1] * 1e-9];
        this.crossings++;
        this.trail.push([this.p.slice()]);
        if (this.trail.length > 6000) this.trail.splice(0, this.trail.length - 6000);
      }
    }
    renderInfo() {
      const S = SURF[this.sid];
      const mirrored = G.cross(this.v, this.l) < 0;
      const slope = Math.abs(Math.cos(this.angle)) < 1e-9 ? "∞" : num(Math.tan(this.angle), 4);
      this.info.innerHTML = `
        <p style="margin:0 0 4px"><b>${S.name}</b></p>
        <dl class="kv" style="margin:0 0 8px">
          <dt>粘合</dt><dd>${S.ident}</dd>
          <dt>边界</dt><dd>${S.bd}</dd>
          <dt>定向</dt><dd>${S.orient}</dd>
          <dt>π₁</dt><dd>${S.pi1}</dd>
        </dl>
        <p class="small" style="margin:0 0 4px">斜率 tan θ = ${slope}；已穿过粘合边 <b>${this.crossings}</b> 次；飞船${mirrored ? "现在是<b style='color:var(--bad)'>镜像</b>（旗子跑到右边了）" : "手性正常（旗子在左边）"}。</p>
        ${this.stopped ? `<div class="msg info">飞船撞到了没有粘合的边：${this.sid === "plane" ? "在 ℝ² 里这相当于飞向无穷远。" : "这条边是曲面的边缘。"}</div>` : ""}
        <p class="small muted" style="margin:0">点击正方形可以换起点。</p>`;
    }
    draw(ctx, w) {
      const P = palette(), { m, S } = this.geom();
      ctx.clearRect(0, 0, w, w);
      ctx.fillStyle = P.surface2;
      ctx.fillRect(m, m, S, S);
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(m + (S * i) / 4, m); ctx.lineTo(m + (S * i) / 4, m + S); ctx.moveTo(m, m + (S * i) / 4); ctx.lineTo(m + S, m + (S * i) / 4); ctx.stroke(); }
      const Sf = SURF[this.sid];
      // 边与箭头
      const edgeColor = (e) => { const k = Sf.glue.findIndex((g) => g[0] === e || g[2] === e); return k < 0 ? P.borderStrong : k === 0 ? P.accent : P.purple; };
      const corners = { L: [[0, 0], [0, 1]], R: [[1, 0], [1, 1]], B: [[0, 0], [1, 0]], T: [[0, 1], [1, 1]] };
      for (const e of ["L", "R", "B", "T"]) {
        const [a, b] = corners[e].map((q) => this.toC(q));
        const k = Sf.glue.findIndex((g) => g[0] === e || g[2] === e);
        ctx.strokeStyle = edgeColor(e); ctx.lineWidth = k < 0 ? 1.5 : 3;
        ctx.setLineDash(k < 0 ? [6, 5] : []);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        if (k >= 0) {
          const g = Sf.glue[k], d = g[0] === e ? g[1] : g[3];
          const t = EDGES[e].tan(d), mid = this.toC(EDGES[e].pos(0.5, d)), out = [-EDGES[e].inward[0], EDGES[e].inward[1]];
          const tc = [t[0], -t[1]];
          const base = [mid[0] + out[0] * 13, mid[1] + out[1] * 13];
          ctx.fillStyle = edgeColor(e);
          for (let j = 0; j <= k; j++) {
            const c = [base[0] + tc[0] * (j * 10 - k * 5), base[1] + tc[1] * (j * 10 - k * 5)];
            ctx.beginPath();
            ctx.moveTo(c[0] + tc[0] * 7, c[1] + tc[1] * 7);
            ctx.lineTo(c[0] - tc[0] * 5 + tc[1] * 5, c[1] - tc[1] * 5 - tc[0] * 5);
            ctx.lineTo(c[0] - tc[0] * 5 - tc[1] * 5, c[1] - tc[1] * 5 + tc[0] * 5);
            ctx.closePath(); ctx.fill();
          }
        }
      }
      if (this.sid === "sphere") {
        ctx.setLineDash([4, 4]); ctx.strokeStyle = P.muted; ctx.lineWidth = 1;
        const a = this.toC([0, 0]), b = this.toC([1, 1]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
        ctx.fillText("赤道", m + S * 0.5 + 6, m + S * 0.5 - 6);
      }
      // 轨迹
      ctx.strokeStyle = alpha(P.accent, 0.75); ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const seg of this.trail) {
        seg.forEach((q, i) => { const c = this.toC(q); if (i === 0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]); });
      }
      ctx.stroke();
      // 起点
      const s0 = this.toC(this.start);
      ctx.fillStyle = P.start; ctx.beginPath(); ctx.arc(s0[0], s0[1], 4.5, 0, 7); ctx.fill();
      // 飞船：箭头 + 左侧小旗（显示手性）
      const c = this.toC(this.p), vc = [this.v[0], -this.v[1]], lc = [this.l[0], -this.l[1]];
      const sz = 13;
      ctx.fillStyle = P.bad; ctx.strokeStyle = P.bad; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c[0] + vc[0] * sz, c[1] + vc[1] * sz);
      ctx.lineTo(c[0] - vc[0] * sz * 0.6 + lc[0] * sz * 0.5, c[1] - vc[1] * sz * 0.6 + lc[1] * sz * 0.5);
      ctx.lineTo(c[0] - vc[0] * sz * 0.6 - lc[0] * sz * 0.5, c[1] - vc[1] * sz * 0.6 - lc[1] * sz * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.amber;
      ctx.beginPath();
      const f0 = [c[0] - vc[0] * sz * 0.2 + lc[0] * sz * 0.4, c[1] - vc[1] * sz * 0.2 + lc[1] * sz * 0.4];
      ctx.moveTo(f0[0], f0[1]);
      ctx.lineTo(f0[0] + lc[0] * sz * 0.9, f0[1] + lc[1] * sz * 0.9);
      ctx.lineTo(f0[0] + lc[0] * sz * 0.65 + vc[0] * sz * 0.5, f0[1] + lc[1] * sz * 0.65 + vc[1] * sz * 0.5);
      ctx.closePath(); ctx.fill();
      if (this.playing && this.crossings % 1 === 0) this.renderInfoThrottled();
    }
    renderInfoThrottled() { const t = performance.now(); if (!this._t || t - this._t > 200) { this._t = t; this.renderInfo(); } }
  }

  // =====================================================================
  // 6. 同伦与基本群
  // =====================================================================
  const bez = (P, t) => { const u = 1 - t; return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]; };
  function winding(path, c) { // 数学方向（逆时针为正），path 为画布坐标（y 向下）
    let tot = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = Math.atan2(-(path[i][1] - c[1]), path[i][0] - c[0]);
      const b = Math.atan2(-(path[i + 1][1] - c[1]), path[i + 1][0] - c[0]);
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      tot += d;
    }
    return tot / (2 * Math.PI);
  }
  function hitsHole(path, holes) {
    for (let i = 0; i + 1 < path.length; i++) for (const H of holes) if (G.distPointSeg(H.c, path[i], path[i + 1]) < H.r) return H;
    return null;
  }
  class Homotopy {
    constructor(root) {
      this.body = shell(root, "同伦与基本群", "图 4.6、例 4.9、例 4.10：路径能不能连续地变形成另一条？");
      this.mode = "deform";
      this.t = 0;
      this.ctl = [[0.38, 0.62], [0.62, 0.62]]; // τ2 的两个控制点（归一化，y 向下，高 = 0.62）
      this.twoHoles = true;
      this.loop = null;
      this.saved = null;
      this.build();
    }
    build() {
      const b = this.body;
      this.modeSeg = segmented([["deform", "同伦变形（图 4.6）"], ["group", "基本群（例 4.9、4.10）"]], this.mode, (k) => { this.mode = k; this.renderCtl(); this.cv.redraw(); });
      this.ctlA = h("div", { class: "controls" },
        slider("变形旋钮 t =", 0, 1, 0.01, 0, (v) => { this.t = v; this.cv.redraw(); }, (v) => num(v, 2)),
        button("τ₂ 放到洞的上方", () => { this.ctl = [[0.36, 0.06], [0.64, 0.06]]; this.cv.redraw(); }, "small"),
        button("τ₂ 放到洞的下方", () => { this.ctl = [[0.38, 0.62], [0.62, 0.62]]; this.cv.redraw(); }, "small"));
      this.ctlB = h("div", { class: "controls" },
        checkbox("两个洞（取消 = 只有一个洞）", this.twoHoles, (v) => { this.twoHoles = v; this.loop = null; this.saved = null; this.cv.redraw(); }),
        ...[["a", "绕洞 1 一圈"], ["b", "绕洞 2 一圈"], ["aa", "a·a"], ["aA", "a·a⁻¹"], ["comm", "a·b·a⁻¹·b⁻¹"]].map(([k, lab]) => button(lab, () => this.preset(k), "small")),
        button("把当前环路存为 τ₁", () => { if (this.loop && this.loop.ok) { this.saved = this.loop; this.cv.redraw(); } }, "small"),
        button("复合 τ₁ ∘ τ", () => this.compose(), "small"));
      this.info = h("div", { class: "status-line", style: "margin-top:8px" });
      const cv = h("div");
      b.append(h("div", { class: "controls" }, this.modeSeg), this.ctlA, this.ctlB, cv, this.info);
      this.cv = makeCanvas(cv, { aspect: 0.62, maxW: 640 }, (ctx, w, hh) => this.draw(ctx, w, hh));
      let dragK = -1, drawing = false;
      onDrag(this.cv.canvas, {
        down: (p) => {
          const W = this.cv.w;
          if (this.mode === "deform") {
            dragK = this.ctl.findIndex((c) => Math.hypot(c[0] * W - p.x, c[1] * W - p.y) < 14);
            return dragK >= 0;
          }
          const xb = this.base();
          if (Math.hypot(xb[0] - p.x, xb[1] - p.y) > 22) { this.msg = "从基点 x<sub>b</sub>（蓝点）附近开始画。"; this.cv.redraw(); return false; }
          drawing = true; this.raw = [xb, [p.x, p.y]]; this.loop = null; this.msg = ""; return true;
        },
        move: (p) => {
          const W = this.cv.w;
          if (this.mode === "deform" && dragK >= 0) { this.ctl[dragK] = [Math.max(0.02, Math.min(0.98, p.x / W)), Math.max(0.02, Math.min(0.6, p.y / W))]; this.cv.redraw(); }
          else if (drawing) { const last = this.raw[this.raw.length - 1]; if (Math.hypot(last[0] - p.x, last[1] - p.y) > 3) { this.raw.push([p.x, p.y]); this.cv.redraw(); } }
        },
        up: () => { if (drawing) { drawing = false; this.raw.push(this.base()); this.setLoop(this.raw.map((q) => [q[0] / this.cv.w, q[1] / this.cv.w])); this.raw = null; } dragK = -1; },
        hover: (p) => { if (this.mode === "deform") { const W = this.cv.w; this.cv.canvas.style.cursor = this.ctl.some((c) => Math.hypot(c[0] * W - p.x, c[1] * W - p.y) < 14) ? "grab" : "default"; } else this.cv.canvas.style.cursor = "crosshair"; },
      });
      this.renderCtl();
    }
    renderCtl() { this.ctlA.classList.toggle("hidden", this.mode !== "deform"); this.ctlB.classList.toggle("hidden", this.mode !== "group"); }
    holesN() { // 归一化坐标
      if (this.mode === "deform") return [{ c: [0.5, 0.33], r: 0.06, name: "洞" }];
      return this.twoHoles ? [{ c: [0.33, 0.3], r: 0.055, name: "洞 1" }, { c: [0.67, 0.3], r: 0.055, name: "洞 2" }] : [{ c: [0.5, 0.3], r: 0.06, name: "洞 1" }];
    }
    base() { return [0.5 * this.cv.w, 0.55 * this.cv.w]; }
    setLoop(ptsN) {
      const W = this.cv.w, path = ptsN.map((q) => [q[0] * W, q[1] * W]);
      const holes = this.holesN().map((H) => ({ c: [H.c[0] * W, H.c[1] * W], r: H.r * W, name: H.name }));
      const hit = hitsHole(path, holes);
      this.loop = { ptsN, ok: !hit, w: holes.map((H) => Math.round(winding(path, H.c))), hit: hit && hit.name, label: this.pendingLabel || null };
      this.pendingLabel = null;
      this.cv.redraw();
    }
    circleLoop(k, dir, turns) { // 从基点出发绕第 k 个洞
      const H = this.holesN()[k], xb = [0.5, 0.55], R = H.r + 0.05;
      const ang0 = Math.atan2(xb[1] - H.c[1], xb[0] - H.c[0]);
      const p0 = [H.c[0] + R * Math.cos(ang0), H.c[1] + R * Math.sin(ang0)];
      const pts = [xb, p0];
      const N = 60 * turns;
      for (let i = 1; i <= N; i++) { const a = ang0 - dir * (i / 60) * 2 * Math.PI; pts.push([H.c[0] + R * Math.cos(a), H.c[1] + R * Math.sin(a)]); }
      pts.push(xb);
      return pts;
    }
    preset(k) {
      const two = this.twoHoles;
      const a = this.circleLoop(0, 1, 1), A = this.circleLoop(0, -1, 1);
      const b = two ? this.circleLoop(1, 1, 1) : a, B = two ? this.circleLoop(1, -1, 1) : A;
      const cat = (...ls) => ls.reduce((acc, l) => acc.concat(l.slice(acc.length ? 1 : 0)), []);
      const m = { a, b, aa: this.circleLoop(0, 1, 2), aA: cat(a, A), comm: cat(a, b, A, B) };
      this.pendingLabel = { a: "a", b: two ? "b" : "a", aa: "a·a", aA: "a·a⁻¹", comm: "a·b·a⁻¹·b⁻¹" }[k];
      this.setLoop(m[k]);
    }
    compose() {
      if (!this.saved || !this.loop || !this.loop.ok) { this.msg = "先画一条环路并「存为 τ₁」，再画（或选）第二条环路 τ，然后点复合。"; this.cv.redraw(); return; }
      const pts = this.saved.ptsN.concat(this.loop.ptsN.slice(1));
      this.pendingLabel = "τ₁ ∘ τ";
      this.setLoop(pts);
    }
    draw(ctx, w, hh) {
      const P = palette();
      ctx.clearRect(0, 0, w, hh);
      ctx.fillStyle = P.surface; ctx.fillRect(0, 0, w, hh);
      const holes = this.holesN().map((H) => ({ c: [H.c[0] * w, H.c[1] * w], r: H.r * w, name: H.name }));
      const font = "13px " + getComputedStyle(document.body).fontFamily;
      ctx.font = font;
      holes.forEach((H) => {
        ctx.fillStyle = P.wall; ctx.beginPath(); ctx.arc(H.c[0], H.c[1], H.r, 0, 7); ctx.fill();
        ctx.fillStyle = P.surface; ctx.textAlign = "center"; ctx.fillText(H.name, H.c[0], H.c[1] + 4);
      });
      ctx.textAlign = "left";
      const line = (pts, color, width, dash) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]); };
      if (this.mode === "deform") {
        const A = [0.12 * w, 0.33 * w], B = [0.88 * w, 0.33 * w];
        const P1 = [A, [0.35 * w, 0.02 * w], [0.65 * w, 0.02 * w], B];
        const P2 = [A, [this.ctl[0][0] * w, this.ctl[0][1] * w], [this.ctl[1][0] * w, this.ctl[1][1] * w], B];
        const N = 120, t1 = [], t2 = [], ht = [];
        for (let i = 0; i <= N; i++) { const s_ = i / N, a = bez(P1, s_), b = bez(P2, s_); t1.push(a); t2.push(b); ht.push([(1 - this.t) * a[0] + this.t * b[0], (1 - this.t) * a[1] + this.t * b[1]]); }
        const bad2 = hitsHole(t2, holes);
        line(t1, P.accent, 2.5);
        line(t2, bad2 ? P.bad : P.purple, 2.5);
        // 中间几条淡线
        for (const tt of [0.25, 0.5, 0.75]) { const q = t1.map((a, i) => [(1 - tt) * a[0] + tt * t2[i][0], (1 - tt) * a[1] + tt * t2[i][1]]); line(q, alpha(P.muted, 0.35), 1, [3, 4]); }
        const hitT = hitsHole(ht, holes);
        line(ht, hitT ? P.bad : P.warn, 3.2);
        [A, B].forEach((q) => { ctx.fillStyle = P.text; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.fill(); });
        ctx.fillStyle = P.text; ctx.fillText("x₁ = τ(0)", A[0] - 30, A[1] + 22); ctx.fillText("x₂ = τ(1)", B[0] - 30, B[1] + 22);
        ctx.fillStyle = P.accent; ctx.fillText("τ₁ (t = 0)", 0.44 * w, 0.06 * w);
        ctx.fillStyle = P.purple; const m2 = bez(P2, 0.5); ctx.fillText("τ₂ (t = 1)", m2[0] + 8, m2[1] + (m2[1] > 0.33 * w ? 18 : -8));
        // 控制点
        this.ctl.forEach((c, i) => {
          const q = [c[0] * w, c[1] * w];
          line([P2[i === 0 ? 0 : 3], q], alpha(P.purple, 0.4), 1, [2, 3]);
          ctx.fillStyle = P.surface; ctx.strokeStyle = P.purple; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 7); ctx.fill(); ctx.stroke();
        });
        const loop = t1.concat(t2.slice().reverse());
        const wn = Math.round(winding(loop, holes[0].c));
        let msg = bad2 ? "<b style='color:var(--bad)'>τ₂ 穿过了洞</b>，它不是 X 中的路径。把紫色控制点拖开。" :
          wn === 0 ? `<b>τ₁ 与 τ₂ 同伦</b>：τ₁ 接上反向的 τ₂ 绕洞 0 圈。只有一个洞时，绕数相同 ⇔ 同伦。` :
            `<b>τ₁ 与 τ₂ 不同伦</b>：τ₁ 接上反向的 τ₂ 绕洞 ${wn} 圈。无论怎么变形，都必须「跳过」洞，h 就不连续了（图 4.6b）。`;
        msg += hitT ? ` <span style="color:var(--bad)">当前 t = ${num(this.t, 2)} 的中间路径（橙）撞上了洞。</span>${wn === 0 && !bad2 ? "这只是直线插值 (1−t)τ₁ + tτ₂ 失败，换一种变形方式就能绕开。" : ""}` : "";
        this.info.innerHTML = msg + " <span class='muted'>拖动紫色圆点改变 τ₂。</span>";
      } else {
        const xb = this.base();
        if (this.saved) line(this.saved.ptsN.map((q) => [q[0] * w, q[1] * w]), alpha(P.purple, 0.45), 2, [5, 4]);
        if (this.raw) line(this.raw, P.warn, 2.4);
        if (this.loop) {
          const pts = this.loop.ptsN.map((q) => [q[0] * w, q[1] * w]);
          line(pts, this.loop.ok ? P.accent : P.bad, 2.6);
          // 方向箭头
          for (let i = 12; i < pts.length - 1; i += 25) {
            const a = pts[i], b2 = pts[i + 1], d = G.sub(b2, a), L = G.len(d) || 1, u = [d[0] / L, d[1] / L];
            ctx.fillStyle = this.loop.ok ? P.accent : P.bad; ctx.beginPath();
            ctx.moveTo(a[0] + u[0] * 7, a[1] + u[1] * 7); ctx.lineTo(a[0] - u[0] * 5 + u[1] * 5, a[1] - u[1] * 5 - u[0] * 5); ctx.lineTo(a[0] - u[0] * 5 - u[1] * 5, a[1] - u[1] * 5 + u[0] * 5); ctx.fill();
          }
        }
        ctx.fillStyle = P.start; ctx.beginPath(); ctx.arc(xb[0], xb[1], 6, 0, 7); ctx.fill();
        ctx.fillStyle = P.text; ctx.fillText("基点 x_b", xb[0] + 10, xb[1] + 4);
        let msg = this.msg || "";
        if (this.loop) {
          const L = this.loop;
          if (!L.ok) msg = `<b style="color:var(--bad)">这条环路穿过了${L.hit}</b>，不在 X 里。`;
          else {
            const ws = L.w;
            msg = `${L.label ? `<b>${L.label}</b>：` : ""}绕数 = <b>(${ws.join(", ")})</b>，对应 π₁ 的元素 ${ws.length === 1 ? `${ws[0]} ∈ ℤ` : `(${ws.join(", ")}) ∈ ℤ²`}。`;
            if (L.label === "τ₁ ∘ τ") msg += " 复合 = 先走 τ₁ 再走 τ（式 4.9），绕数相加。";
            if (L.label === "a·a⁻¹") msg += " 一来一回抵消，同伦于停在 x_b 不动。";
            if (L.label === "a·b·a⁻¹·b⁻¹") msg += " <b>绕数全是 0，但这条环路收缩不成一点！</b>两洞平面的基本群其实是不交换的自由群，ℤ² 只记录了它的「交换化」（见脚注）。";
          }
          this.msg = "";
        } else if (!msg) msg = "按住基点 x_b 拖动画一条环路（松手时自动回到 x_b），或点上面的预设。";
        if (this.saved) msg += ` <span class="muted">τ₁ 已存（紫色虚线），绕数 (${this.saved.w.join(", ")})。</span>`;
        this.info.innerHTML = msg;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reg = { gluing: Gluing, homotopy: Homotopy };
    for (const [k, C] of Object.entries(reg)) document.querySelectorAll(`[data-widget='${k}']`).forEach((el) => { try { el._w = new C(el); } catch (e) { console.error(k, e); } });
  });
})();
