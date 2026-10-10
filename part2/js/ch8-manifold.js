/* 8.3.2 节：光滑流形——坐标邻域与坐标变换（S¹），S² 的切空间 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH8;
  const sq = (v) => Math.sqrt(Math.max(0, 1 - v * v));

  // 例 8.14（n = 1）：S¹ 的 4 个坐标邻域
  const CHARTS14 = {
    "1+": { name: "U₁⁺ = {x₁ > 0}", inside: (p) => p.x > 1e-9, coord: (p) => p.y, inv: (u) => ({ x: sq(u), y: u }), book: (u) => ({ x: 1 - sq(u), y: u }), axis: "y", color: "accent" },
    "1-": { name: "U₁⁻ = {x₁ < 0}", inside: (p) => p.x < -1e-9, coord: (p) => p.y, inv: (u) => ({ x: -sq(u), y: u }), axis: "y", color: "warn" },
    "2+": { name: "U₂⁺ = {x₂ > 0}", inside: (p) => p.y > 1e-9, coord: (p) => p.x, inv: (u) => ({ x: u, y: sq(u) }), book: (u) => ({ x: u, y: 1 - sq(u) }), axis: "x", color: "ok" },
    "2-": { name: "U₂⁻ = {x₂ < 0}", inside: (p) => p.y < -1e-9, coord: (p) => p.x, inv: (u) => ({ x: u, y: -sq(u) }), axis: "x", color: "alive2" },
  };
  // 球极投影：从北极 / 南极
  const CHARTS_ST = {
    N: { name: "σ_N：从北极 (0,1) 投影", inside: (p) => p.y < 1 - 1e-9, coord: (p) => p.x / (1 - p.y), inv: (u) => ({ x: 2 * u / (u * u + 1), y: (u * u - 1) / (u * u + 1) }), color: "accent", pole: { x: 0, y: 1 } },
    S: { name: "σ_S：从南极 (0,−1) 投影", inside: (p) => p.y > -1 + 1e-9, coord: (p) => p.x / (1 + p.y), inv: (u) => ({ x: 2 * u / (u * u + 1), y: (1 - u * u) / (u * u + 1) }), color: "warn", pole: { x: 0, y: -1 } },
  };

  // =================================================================
  // 组件 7：坐标邻域与坐标变换（例 8.11、8.14、球极投影；图 8.9）
  // =================================================================
  class Charts {
    constructor(root) {
      this.mode = "proj"; this.th = 2.2; this.from = "2+"; this.to = "1-"; this.bookInv = false;
      const body = C.frame(root, "S¹ 上的坐标邻域与坐标变换", "拖动圆上的点 p：看它落在哪些邻域里、各自的坐标是多少；右边画坐标变换 ψ∘φ⁻¹");
      this.st = new C.Stage({ view: [-1.6, 1.6, -1.6, 1.6], maxW: 400, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (Math.abs(Math.hypot(p.x, p.y) - 1) < .25 ? (this.setTh(Math.atan2(p.y, p.x)), "p") : null),
        onMove: (p) => this.setTh(Math.atan2(p.y, p.x)), cursor: (p) => (Math.abs(Math.hypot(p.x, p.y) - 1) < .25 ? "grab" : null) });
      this.tr = new C.Stage({ view: [-1.2, 1.2, -1.2, 1.2], maxW: 300, minW: 180, onDraw: (ctx, st, col) => this.drawTr(ctx, st, col) });
      this.segM = C.seg([["proj", "例 8.14：投影坐标（4 个邻域）"], ["angle", "例 8.11：角度坐标"], ["stereo", "球极投影（2 个邻域）"]], this.mode, (k) => { this.mode = k; this.syncSel(); this.redraw(); });
      this.selFrom = C.select([], this.from, (k) => { this.from = k; this.redraw(); });
      this.selTo = C.select([], this.to, (k) => { this.to = k; this.redraw(); });
      this.cbBook = C.check("按原书 (8.26) 求逆（多了「1 −」）", false, (v) => { this.bookInv = v; this.redraw(); });
      this.selRow = h("div", { class: "controls" }, h("span", { class: "small" }, "从 φ ="), this.selFrom, h("span", { class: "small" }, "换到 ψ ="), this.selTo, this.cbBook);
      this.info = h("div", { class: "panel-body" });
      this.trNote = h("div", { class: "small muted", style: "margin-top:4px" });
      body.append(h("div", { class: "controls" }, this.segM), this.selRow,
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "p 的坐标"), this.info),
          h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "坐标变换 ψ ∘ φ⁻¹（只在重叠部分有定义）"), this.tr.wrap, h("div", { class: "panel-body" }, this.trNote)))));
      this.syncSel(); this.redraw();
    }
    charts() { return this.mode === "stereo" ? CHARTS_ST : CHARTS14; }
    syncSel() {
      this.selRow.style.display = this.mode === "angle" ? "none" : "";
      this.cbBook.style.display = this.mode === "proj" ? "" : "none";
      const ch = this.charts(), opts = Object.entries(ch).map(([k, v]) => [k, v.name]);
      for (const [sel, cur, def] of [[this.selFrom, "from", this.mode === "stereo" ? "N" : "2+"], [this.selTo, "to", this.mode === "stereo" ? "S" : "1-"]]) {
        sel.innerHTML = ""; this[cur] = def;
        opts.forEach(([k, t]) => sel.append(h("option", { value: k, selected: k === def ? true : null }, t)));
      }
      this.tr.setView(this.mode === "stereo" ? [-4, 4, -4, 4] : [-1.2, 1.2, -1.2, 1.2]);
    }
    setTh(t) { this.th = t; this.redraw(); }
    get p() { return { x: Math.cos(this.th), y: Math.sin(this.th) }; }
    redraw() {
      const p = this.p;
      let html = `p = (${p.x.toFixed(3)}, ${p.y.toFixed(3)})，θ = ${(this.th * 180 / Math.PI).toFixed(1)}°<br>`;
      if (this.mode === "angle") {
        const inside = p.x > 1e-9;
        html += inside ? `在 U = {x > 0} 中：φ(x, y) = tan⁻¹(y/x) = <b>${Math.atan(p.y / p.x).toFixed(3)}</b> ∈ (−π/2, π/2)<br>φ⁻¹(θ) = (cos θ, sin θ)：正是熟悉的参数化。`
          : '<span class="no">p 不在 U = {x > 0} 里：这个坐标邻域只覆盖右半个圆。</span>要覆盖整个 S¹ 至少要两个邻域（例如再加 x < 0 的一个），而且它们必须<b>重叠</b>——只用开集的话，x = 0 上的两点总会漏掉。';
      } else {
        const ch = this.charts();
        const rows = Object.entries(ch).filter(([, c]) => c.inside(p)).map(([, c]) => `<b style="color:${C.cv(c.color)}">${c.name}</b>：坐标 ${c.coord(p).toFixed(3)}`);
        html += `p 在 ${rows.length} 个邻域里：<br>` + rows.join("<br>");
        if (this.mode === "stereo") html += `<br><span class="muted">σ_N · σ_S = ${ch.N.inside(p) && ch.S.inside(p) ? (ch.N.coord(p) * ch.S.coord(p)).toFixed(4) : "—"}（p 不是两极时恒为 1）</span>`;
      }
      this.info.innerHTML = html;
      this.updTrNote();
      this.st.draw(); this.tr.draw();
    }
    // 在 from 的坐标 u 下，从 from 的逆映射得到点，再看它是否在 to 的邻域里
    trCurve() {
      const ch = this.charts(), A = ch[this.from], B = ch[this.to];
      const pts = [], [u0, u1] = this.mode === "stereo" ? [-4, 4] : [-1, 1];
      let seg = [];
      for (let k = 0; k <= 400; k++) {
        const u = u0 + (u1 - u0) * k / 400;
        if (this.mode === "proj" && (u <= -1 || u >= 1)) { if (seg.length) { pts.push(seg); seg = []; } continue; }
        const q = A.inv(u);
        if (A.inside(q) && B.inside(q)) seg.push({ x: u, y: B.coord(q) }); else if (seg.length) { pts.push(seg); seg = []; }
      }
      if (seg.length) pts.push(seg);
      return pts;
    }
    updTrNote() {
      if (this.mode === "angle") { this.trNote.textContent = "例 8.11 的参数化 θ ↦ (cos θ, sin θ)：横轴 θ ∈ (−π/2, π/2)，纵轴画 x 与 y。"; return; }
      const ch = this.charts(), A = ch[this.from], B = ch[this.to], p = this.p;
      if (this.from === this.to) { this.trNote.textContent = "同一个邻域：变换是恒等映射。"; return; }
      const segs = this.trCurve();
      if (!segs.length) { this.trNote.innerHTML = `${A.name} 与 ${B.name} <b>不重叠</b>，不需要坐标变换。`; return; }
      let s = `重叠部分上 ψ∘φ⁻¹ 是光滑函数（两个邻域<b>相容 compatible</b>）。`;
      if (this.mode === "proj") s += `例如 U₂⁺→U₁⁻：u ↦ √(1−u²)，u ∈ (−1, 0)。`;
      else s += `重叠处 σ_S = 1/σ_N（u ≠ 0），光滑。`;
      if (A.inside(p) && B.inside(p)) s += ` 当前 p：${A.coord(p).toFixed(3)} ↦ ${B.coord(p).toFixed(3)}。`;
      if (this.bookInv && this.mode === "proj" && A.book) { const u = A.coord(p), q = A.book(u); s += ` <span class="no">按原书 (8.26)：(φ⁻¹)(${u.toFixed(3)}) = (${q.x.toFixed(3)}, ${q.y.toFixed(3)})，模长 ${Math.hypot(q.x, q.y).toFixed(3)} ≠ 1，不在圆上。</span>`; }
      this.trNote.innerHTML = s;
    }
    draw(ctx, st, col) {
      st.frame(col);
      st.line({ x: -1.6, y: 0 }, { x: 1.6, y: 0 }, col.border, 1); st.line({ x: 0, y: -1.6 }, { x: 0, y: 1.6 }, col.border, 1);
      st.circle({ x: 0, y: 0 }, 1, null, col.text2, 2);
      const p = this.p;
      if (this.mode === "proj") {
        const arcs = { "1+": [-Math.PI / 2, Math.PI / 2], "1-": [Math.PI / 2, 3 * Math.PI / 2], "2+": [0, Math.PI], "2-": [Math.PI, 2 * Math.PI] };
        Object.entries(CHARTS14).forEach(([k, c], i) => {
          const r = 1.1 + .1 * i, [a0, a1] = arcs[k];
          ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), r * st.scale, -a0, -a1, true); ctx.strokeStyle = C.alpha(col[c.color], c.inside(p) ? .95 : .35); ctx.lineWidth = c.inside(p) ? 4 : 3; ctx.lineCap = "butt"; ctx.stroke();
          const am = (a0 + a1) / 2; st.text(c.name.split(" ")[0], { x: (r + .02) * Math.cos(am + .5), y: (r + .02) * Math.sin(am + .5) }, col[c.color], { size: 11, weight: 650 });
          if (c.inside(p)) { const q = c.axis === "y" ? { x: 0, y: p.y } : { x: p.x, y: 0 }; st.line(p, q, C.alpha(col[c.color], .9), 1.5, [4, 3]); st.dot(q, 4, col[c.color]); }
        });
        if (this.bookInv) {
          for (const k of ["1+", "2+"]) { const c = CHARTS14[k]; if (!c.inside(p)) continue; const q = c.book(c.coord(p)); st.xmark(q, col.bad, 6); st.line(p, q, C.alpha(col.bad, .6), 1.2, [3, 3]); st.text("原书 (8.26)", q, col.bad, { size: 11, dy: 13 }); }
        }
      } else if (this.mode === "angle") {
        ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), 1.12 * st.scale, Math.PI / 2, -Math.PI / 2, true); ctx.strokeStyle = C.alpha(col.accent, .9); ctx.lineWidth = 4; ctx.stroke();
        st.dot({ x: 0, y: 1 }, 4.5, col.surface, col.bad, 2); st.dot({ x: 0, y: -1 }, 4.5, col.surface, col.bad, 2);
        st.text("U = {x > 0}", { x: 1.2, y: 1.1 }, col.accent, { size: 12, weight: 650 });
        if (p.x > 1e-9) { const ctx2 = ctx; ctx2.beginPath(); ctx2.moveTo(st.X(0), st.Y(0)); ctx2.arc(st.X(0), st.Y(0), .35 * st.scale, 0, -this.th, this.th > 0); ctx2.strokeStyle = col.accent; ctx2.lineWidth = 2; ctx2.stroke(); st.line({ x: 0, y: 0 }, p, col.accent, 1.5); }
      } else {
        for (const [k, c] of Object.entries(CHARTS_ST)) {
          if (!c.inside(p)) continue;
          const u = c.coord(p), q = { x: u, y: 0 };
          st.line(c.pole, Math.abs(u) < 1.6 ? q : C.lerp(c.pole, q, 1.6 / Math.max(1.6, Math.abs(u))), C.alpha(col[c.color], .85), 1.6, [5, 3]);
          if (Math.abs(u) < 1.6) st.dot(q, 4.5, col[c.color]);
          st.dot(c.pole, 5, col.surface, col[c.color], 2); st.text(k === "N" ? "北极" : "南极", c.pole, col[c.color], { size: 11, dx: 22 });
        }
      }
      st.dot(p, 7, col.start, col.surface, 2); st.text("p", p, col.start, { dx: 12, dy: -10, weight: 700 });
    }
    drawTr(ctx, st, col) {
      st.frame(col);
      const [x0, x1, y0, y1] = st.view;
      st.line({ x: x0, y: 0 }, { x: x1, y: 0 }, col.border, 1); st.line({ x: 0, y: y0 }, { x: 0, y: y1 }, col.border, 1);
      if (this.mode === "angle") {
        const X = [], Y = []; for (let k = 0; k <= 100; k++) { const t = -Math.PI / 2 + Math.PI * k / 100; X.push({ x: t / (Math.PI / 2) * 1.1, y: Math.cos(t) }); Y.push({ x: t / (Math.PI / 2) * 1.1, y: Math.sin(t) }); }
        st.polyline(X, col.accent, 2); st.polyline(Y, col.warn, 2);
        st.text("x = cos θ", { x: .55, y: 1.05 }, col.accent, { size: 11 }); st.text("y = sin θ", { x: .75, y: .45 }, col.warn, { size: 11 });
        if (this.p.x > 1e-9) { const t = Math.atan(this.p.y / this.p.x); st.dot({ x: t / (Math.PI / 2) * 1.1, y: this.p.x }, 4, col.accent); st.dot({ x: t / (Math.PI / 2) * 1.1, y: this.p.y }, 4, col.warn); }
        return;
      }
      for (const v of [-1, 1].concat(this.mode === "stereo" ? [-3, -2, 2, 3] : [])) { st.text(String(v), { x: v, y: 0 }, col.muted, { size: 10, dy: 9 }); st.text(String(v), { x: 0, y: v }, col.muted, { size: 10, dx: -9 }); }
      for (const s of this.trCurve()) st.polyline(s, col.path, 2.4);
      const ch = this.charts(), A = ch[this.from], B = ch[this.to], p = this.p;
      if (A.inside(p) && B.inside(p)) st.dot({ x: A.coord(p), y: B.coord(p) }, 5, col.start, col.surface, 1.5);
      st.text("φ 坐标 →", { x: x1, y: y0 }, col.muted, { size: 10.5, align: "right", dy: -8, dx: -4 });
    }
  }

  // =================================================================
  // 组件 8：S² 的切空间（例 8.16，图 8.8，式 8.35–8.37）
  // =================================================================
  class TangentS2 {
    constructor(root) {
      this.th = 0.7; this.ph = 1.1; this.yaw = 0.45; this.pitch = -0.4; this.vth = 0.8; this.vph = 0.5; this.step = 0.4;
      const body = C.frame(root, "S² 上的切空间", "p 的球坐标 (θ, φ)；切平面由 ∂/∂θ 和 ∂/∂φ 张成，法向量就是 p 本身；拖动画布可以转动球");
      this.st = new C.Stage({ view: [-1.5, 1.5, -1.5, 1.5], maxW: 420, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p, e) => { this.dragFrom = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; return "rot"; },
        onMove: (p, d, e) => { const f = this.dragFrom; this.yaw = f.yaw + (e.clientX - f.x) * .01; this.pitch = C.clamp(f.pitch - (e.clientY - f.y) * .01, -1.4, 1.4); this.st.draw(); },
        cursor: () => "grab" });
      const deg = (v) => `${(v * 180 / Math.PI).toFixed(0)}°`;
      this.sTh = C.slider("θ", 0.02, 2 * Math.PI - .02, .01, this.th, (v) => { this.th = v; this.upd(); }, deg);
      this.sPh = C.slider("φ", 0.02, Math.PI - .02, .01, this.ph, (v) => { this.ph = v; this.upd(); }, deg);
      this.sVt = C.slider("θ̇", -1.5, 1.5, .05, this.vth, (v) => { this.vth = v; this.upd(); }, (v) => v.toFixed(2));
      this.sVp = C.slider("φ̇", -1.5, 1.5, .05, this.vph, (v) => { this.vph = v; this.upd(); }, (v) => v.toFixed(2));
      this.sStep = C.slider("沿切向量直走 Δt", 0, 1, .05, this.step, (v) => { this.step = v; this.upd(); }, (v) => v.toFixed(2));
      this.info = h("div", { class: "panel-body mono", style: "font-size:12.5px;line-height:1.7" });
      body.append(h("div", { class: "controls" }, this.sTh, this.sPh), h("div", { class: "controls" }, h("span", { class: "small" }, "速度（坐标邻域里的 R² 向量）："), this.sVt, this.sVp, this.sStep),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "在 p 处"), this.info),
          C.legend([[C.cv("accent"), "e_θ（∂/∂θ 归一化）"], [C.cv("warn"), "e_φ = ∂/∂φ"], [C.cv("muted"), "法向量 [x y z]"], [C.cv("path"), "速度 v 与对应的曲线"], [C.cv("bad"), "x + Δt·v：离开了球面"]]))));
      this.upd();
    }
    P(th, ph) { return [Math.cos(th) * Math.sin(ph), Math.sin(th) * Math.sin(ph), Math.cos(ph)]; }
    // 旋转后投影：屏幕 x 向右、z 向上、y 指向观察者（右手系）；depth > 0 表示在前半球
    proj(v) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const x1 = cy * v[0] - sy * v[1], y1 = sy * v[0] + cy * v[1], z1 = v[2];
      const y2 = cp * y1 - sp * z1, z2 = sp * y1 + cp * z1;
      return { x: x1, y: z2, depth: y2 };
    }
    upd() {
      const { th, ph } = this, p = this.P(th, ph);
      const dth = [-Math.sin(th) * Math.sin(ph), Math.cos(th) * Math.sin(ph), 0], dph = [Math.cos(th) * Math.cos(ph), Math.sin(th) * Math.cos(ph), -Math.sin(ph)];
      const n = Math.hypot(...dth), eth = dth.map((v) => v / n);
      const v = dth.map((a, i) => this.vth * a + this.vph * dph[i]);
      const q = p.map((a, i) => a + this.step * v[i]);
      const f = (a) => a.map((x) => (x >= 0 ? " " : "") + x.toFixed(3)).join(" ");
      this.info.innerHTML = `p = [${f(p)}]<br>∂/∂θ = [${f(dth)}]，长 sinφ = ${n.toFixed(3)}<br>e_θ = [−sinθ cosθ 0] = [${f(eth)}]<br>e_φ = [cosθcosφ sinθcosφ −sinφ]<br>&nbsp;&nbsp;&nbsp;&nbsp;= [${f(dph)}]<br>e_θ·p = ${(eth[0] * p[0] + eth[1] * p[1]).toFixed(3)}，e_φ·p = ${(dph[0] * p[0] + dph[1] * p[1] + dph[2] * p[2]).toFixed(3)}，e_θ·e_φ = ${(eth[0] * dph[0] + eth[1] * dph[1]).toFixed(3)}<br>切平面 (8.37)：${p[0].toFixed(2)}(x−${p[0].toFixed(2)}) + ${p[1].toFixed(2)}(y−${p[1].toFixed(2)}) + ${p[2].toFixed(2)}(z−${p[2].toFixed(2)}) = 0<br>v = θ̇·∂/∂θ + φ̇·∂/∂φ = [${f(v)}]<br>|p + Δt·v| = ${Math.hypot(...q).toFixed(4)}（≠ 1：一阶近似离开了 S²）` +
        (n < .15 ? '<br><span style="color:var(--bad)">靠近极点：∂/∂θ 几乎为 0，这个坐标邻域在极点退化（所以例 8.16 要求 φ ∈ (0, π)）。</span>' : "");
      this.cache = { p, eth, dph, dth, v, q };
      this.st.draw();
    }
    draw(ctx, st, col) {
      const S = (v) => { const r = this.proj(v); return { x: r.x, y: r.y, d: r.depth }; };
      // 球体
      const grd = ctx.createRadialGradient(st.X(-.35), st.Y(.35), 4, st.X(0), st.Y(0), st.scale);
      grd.addColorStop(0, C.alpha(col.accent, .1)); grd.addColorStop(1, C.alpha(col.accent, .22));
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), st.scale, 0, 2 * Math.PI); ctx.fillStyle = grd; ctx.fill(); ctx.strokeStyle = col.strong; ctx.lineWidth = 1.2; ctx.stroke();
      // 经纬线：前半球实线、后半球很淡
      const curve = (fn, n) => { let prev = null; for (let k = 0; k <= n; k++) { const q = S(fn(k / n)); if (prev) st.line(prev, q, q.d > 0 && prev.d > 0 ? C.alpha(col.muted, .55) : C.alpha(col.muted, .13), 1); prev = q; } };
      for (let i = 1; i < 6; i++) curve((t) => this.P(2 * Math.PI * t, Math.PI * i / 6), 72);
      for (let i = 0; i < 12; i++) curve((t) => this.P(Math.PI * i / 6, Math.PI * t), 48);
      const { p, eth, dph, dth, v, q } = this.cache;
      const front = S(p).d > -0.05, al = front ? 1 : .35;
      // 切平面小块
      const s = .45, corner = (a, b) => S(p.map((x, i) => x + a * s * eth[i] + b * s * dph[i]));
      st.poly([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], C.alpha(col.ok, .16 * al + .04), C.alpha(col.ok, .7 * al), 1.2);
      // 沿 (θ̇, φ̇) 的坐标曲线（在 S² 上）
      const cur = []; for (let k = 0; k <= 60; k++) { const t = 1.2 * k / 60; cur.push(S(this.P(this.th + this.vth * t, Math.min(Math.PI - 1e-3, Math.max(1e-3, this.ph + this.vph * t))))); }
      st.polyline(cur, C.alpha(col.path, .55 * al + .2), 2, [4, 3]);
      const P0 = S(p), add = (w, k) => { const r = S(p.map((x, i) => x + k * w[i])); return { x: r.x - P0.x, y: r.y - P0.y }; };
      st.arrow(P0, add(p, .45), C.alpha(col.muted, al), { lw: 1.6 });
      st.arrow(P0, add(eth, .45), C.alpha(col.accent, al), { lw: 2.2, head: 7 });
      st.arrow(P0, add(dph, .45), C.alpha(col.warn, al), { lw: 2.2, head: 7 });
      st.arrow(P0, add(v, .45), C.alpha(col.path, al), { lw: 2.6, head: 8 });
      if (this.step > 0) { const Q = S(q); st.line(P0, Q, C.alpha(col.bad, .7 * al), 1.4, [3, 3]); st.dot(Q, 4.5, col.bad); }
      st.dot(P0, 5.5, col.start, col.surface, 1.5);
      st.text("p", P0, col.start, { dx: -10, dy: -10, weight: 700 });
      const ax = (v, t) => { const r = S(v); st.text(t, { x: r.x * 1.12, y: r.y * 1.12 }, C.alpha(col.muted, r.d > 0 ? 1 : .4), { size: 11 }); };
      ax([0, 0, 1], "z（φ=0）"); ax([1, 0, 0], "x"); ax([0, 1, 0], "y");
      if (!front) st.text("p 在背面（拖动转过来）", { x: 0, y: -1.38 }, col.muted, { size: 11.5 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='ch8-charts']").forEach((el) => el._w = new Charts(el));
    document.querySelectorAll("[data-widget='ch8-tangent-s2']").forEach((el) => el._w = new TangentS2(el));
  });
})();
