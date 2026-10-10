/* 第 4 章 · 4.2 定义配置空间：o2（例 4.12 O(2) 是两个圆）、cylinder（图 4.8 柱面上的规划）、quaternion（式 4.19–4.27） */
(function () {
  "use strict";
  const { shell, palette, alpha, makeCanvas, onDrag, svgPoint, slider, segmented, button, checkbox, G, num, piStr, h, s } = CH4;

  // =====================================================================
  // 7. O(2) = 两个圆，SO(2) 选其中一个
  // =====================================================================
  const F_SHAPE = [[-0.35, -0.8], [-0.35, 0.8], [0.55, 0.8], [0.55, 0.5], [-0.05, 0.5], [-0.05, 0.15], [0.4, 0.15], [0.4, -0.15], [-0.05, -0.15], [-0.05, -0.8]];
  class O2 {
    constructor(root) {
      this.body = shell(root, "O(2) 是两个不相连的圆", "例 4.12：拖动 (a, b)，再选 (c, d) 的两种取法之一");
      this.th = 0.6;
      this.det = 1;
      const ctr = h("div", { class: "controls" },
        segmented([["1", "c = −b, d = a（det = +1）"], ["-1", "c = b, d = −a（det = −1）"]], "1", (k) => { this.det = +k; this.render(); }));
      this.svg = s("svg", { viewBox: "0 0 640 270", style: "width:100%;max-width:720px;display:block;margin:0 auto;touch-action:none;user-select:none" });
      this.info = h("div", { class: "small", style: "margin-top:8px" });
      this.body.append(ctr, h("div", { class: "svg-wrap" }, this.svg), this.info);
      let drag = false;
      const mv = (e) => { const p = svgPoint(this.svg, e); this.th = Math.atan2(-(p.y - 135), p.x - 120); this.render(); };
      this.svg.addEventListener("pointerdown", (e) => { const p = svgPoint(this.svg, e); if (p.x < 240) { drag = true; try { this.svg.setPointerCapture(e.pointerId); } catch (er) { /* */ } mv(e); } });
      this.svg.addEventListener("pointermove", (e) => { if (drag) mv(e); });
      this.svg.addEventListener("pointerup", () => { drag = false; });
      this.render();
    }
    render() {
      const svg = this.svg; svg.innerHTML = "";
      const a = Math.cos(this.th), b = Math.sin(this.th);
      const c = this.det > 0 ? -b : b, d = this.det > 0 ? a : -a;
      // 左：第一行 (a, b) 所在的单位圆
      const C0 = [120, 135], R = 88;
      svg.append(s("line", { x1: 20, y1: 135, x2: 220, y2: 135, stroke: "var(--border)" }), s("line", { x1: 120, y1: 35, x2: 120, y2: 235, stroke: "var(--border)" }));
      svg.append(s("circle", { cx: C0[0], cy: C0[1], r: R, fill: "none", stroke: "var(--accent)", "stroke-width": 2 }));
      const P = [C0[0] + R * a, C0[1] - R * b];
      svg.append(s("line", { x1: C0[0], y1: C0[1], x2: P[0], y2: P[1], stroke: "var(--accent)", "stroke-width": 1.5 }));
      svg.append(s("circle", { cx: P[0], cy: P[1], r: 8, fill: "var(--accent)", style: "cursor:grab" }));
      svg.append(s("text", { x: P[0] + 10, y: P[1] - 10, "font-size": 13, fill: "var(--accent-text)" }, "(a, b)"));
      svg.append(s("text", { x: 120, y: 260, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, "a² + b² = 1：第一行在 S¹ 上"));
      // 中：O(2) 的两个分支
      const comps = [[330, 78, "det = +1：SO(2)"], [330, 190, "det = −1：镜像"]];
      comps.forEach(([x, y, lab], i) => {
        const on = (i === 0) === (this.det > 0);
        svg.append(s("circle", { cx: x, cy: y, r: 42, fill: "none", stroke: on ? (i === 0 ? "var(--ok)" : "var(--bad)") : "var(--border-strong)", "stroke-width": on ? 3 : 1.5, "stroke-dasharray": on ? "none" : "4 4" }));
        svg.append(s("text", { x: x + 52, y: y + 4, "text-anchor": "start", "font-size": 12, fill: on ? "var(--text)" : "var(--muted)" }, lab));
        if (on) svg.append(s("circle", { cx: x + 42 * a, cy: y - 42 * b, r: 6, fill: i === 0 ? "var(--ok)" : "var(--bad)" }));
      });
      svg.append(s("text", { x: 330, y: 260, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, "O(2) = S¹ ⊔ S¹：两个分支"));
      // 右：把字母 F 用矩阵 A 变换
      const C1 = [545, 130], k = 62;
      svg.append(s("line", { x1: 470, y1: 130, x2: 625, y2: 130, stroke: "var(--border)" }), s("line", { x1: 545, y1: 45, x2: 545, y2: 215, stroke: "var(--border)" }));
      const toS = (p) => [C1[0] + k * p[0], C1[1] - k * p[1]];
      svg.append(s("polygon", { points: F_SHAPE.map((p) => toS(p).join(",")).join(" "), fill: "none", stroke: "var(--border-strong)", "stroke-dasharray": "3 3" }));
      const Fp = F_SHAPE.map((p) => [a * p[0] + b * p[1], c * p[0] + d * p[1]]);
      svg.append(s("polygon", { points: Fp.map((p) => toS(p).join(",")).join(" "), fill: this.det > 0 ? "var(--ok)" : "var(--bad)", "fill-opacity": 0.3, stroke: this.det > 0 ? "var(--ok)" : "var(--bad)", "stroke-width": 2 }));
      svg.append(s("text", { x: 545, y: 245, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)" }, "虚线 = 原来的 F；实色 = A 作用后"));
      const f = (v) => num(v, 3);
      this.info.innerHTML = `A = ( ${f(a)} &nbsp; ${f(b)} ; &nbsp; ${f(c)} &nbsp; ${f(d)} )　·　a²+b² = ${f(a * a + b * b)}，ac+bd = ${f(a * c + b * d)}，c²+d² = ${f(c * c + d * d)}　·　<b>det A = ${f(a * d - b * c)}</b><br>` +
        (this.det > 0 ? `这是旋转矩阵（F 没有被翻面）。对应式 (3.31) 中的 θ = ${num((Math.atan2(-b, a) * 180) / Math.PI, 1)}°。拖动 (a, b) 绕一圈，矩阵就走遍整个 SO(2) ≅ S¹。` :
          "F 被翻成了镜像：这是「旋转 + 反射」，满足 AA<sup>T</sup> = I 但不是刚体运动。det 是连续函数，只能取 ±1，所以两个圆之间没有连续路径。");
    }
  }

  // =====================================================================
  // 8. 柱面 ℝ × S¹ 上的规划（图 4.8）
  // =====================================================================
  class Cylinder {
    constructor(root) {
      this.body = shell(root, "柱面上的规划", "图 4.8：C = ℝ × S¹，上下两条边是同一条线");
      this.NX = 32; this.NY = 32;
      this.wrap = true;
      this.rot = 0.4;
      this.bookLayout();
      this.build();
    }
    bookLayout() {
      this.occ = new Uint8Array(this.NX * this.NY);
      for (let i = 0; i < this.NX; i++) for (let j = 13; j <= 18; j++) this.occ[j * this.NX + i] = 1;
      this.qI = [8, 6]; this.qG = [23, 25];
    }
    build() {
      const b = this.body;
      const ctr = h("div", { class: "controls" },
        checkbox("识别上下边：θ = 0 与 θ = 2π 是同一处", this.wrap, (v) => { this.wrap = v; this.solve(); }),
        button("恢复书中布局", () => { this.bookLayout(); this.solve(); }),
        button("清空障碍", () => { this.occ.fill(0); this.solve(); }));
      const c1 = h("div"), c2 = h("div");
      this.info = h("div", { class: "status-line", style: "margin-top:8px" });
      b.append(ctr, h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1fr)" }, c1, c2), this.info);
      this.flat = makeCanvas(c1, { aspect: 1, maxW: 380 }, (ctx, w, hh) => this.drawFlat(ctx, w, hh));
      this.cyl = makeCanvas(c2, { aspect: 1, maxW: 380 }, (ctx, w, hh) => this.drawCyl(ctx, w, hh));
      let mode = null, paint = 0;
      onDrag(this.flat.canvas, {
        down: (p) => {
          const c = this.cell(p); if (!c) return false;
          if (c[0] === this.qI[0] && c[1] === this.qI[1]) mode = "I";
          else if (c[0] === this.qG[0] && c[1] === this.qG[1]) mode = "G";
          else { mode = "paint"; paint = this.occ[c[1] * this.NX + c[0]] ? 0 : 1; this.occ[c[1] * this.NX + c[0]] = paint; this.solve(); }
        },
        move: (p) => {
          const c = this.cell(p); if (!c) return;
          if (mode === "I" && !this.occ[c[1] * this.NX + c[0]]) { this.qI = c; this.solve(); }
          else if (mode === "G" && !this.occ[c[1] * this.NX + c[0]]) { this.qG = c; this.solve(); }
          else if (mode === "paint" && !(c[0] === this.qI[0] && c[1] === this.qI[1]) && !(c[0] === this.qG[0] && c[1] === this.qG[1])) { this.occ[c[1] * this.NX + c[0]] = paint; this.solve(); }
        },
        up: () => { mode = null; },
      });
      this.flat.canvas.style.cursor = "crosshair";
      let lx = 0;
      onDrag(this.cyl.canvas, { down: (p) => { lx = p.x; }, move: (p) => { this.rot += (p.x - lx) * 0.012; lx = p.x; this.cyl.redraw(); } });
      this.cyl.canvas.style.cursor = "ew-resize";
      this.solve();
    }
    geomF() { const w = this.flat.w, m = 26, S = w - m - 10; return { m, S, cw: S / this.NX, ch: S / this.NY }; }
    cell(p) { const { m, cw, ch } = this.geomF(); const i = Math.floor((p.x - m) / cw), j = this.NY - 1 - Math.floor((p.y - 10) / ch); if (i < 0 || j < 0 || i >= this.NX || j >= this.NY) return null; return [i, j]; }
    solve() {
      const { NX, NY } = this, prev = new Int32Array(NX * NY).fill(-1), seen = new Uint8Array(NX * NY);
      const s0 = this.qI[1] * NX + this.qI[0], g = this.qG[1] * NX + this.qG[0];
      const Q = [s0]; seen[s0] = 1;
      let found = false;
      for (let qi = 0; qi < Q.length; qi++) {
        const u = Q[qi];
        if (u === g) { found = true; break; }
        const i = u % NX, j = (u / NX) | 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di; let nj = j + dj;
          if (ni < 0 || ni >= NX) continue;
          if (nj < 0 || nj >= NY) { if (!this.wrap) continue; nj = (nj + NY) % NY; }
          const v = nj * NX + ni;
          if (seen[v] || this.occ[v]) continue;
          if (di && dj) { // 不允许切角穿过障碍
            const a = j * NX + ni, bb = nj * NX + i;
            if (this.occ[a] || this.occ[bb]) continue;
          }
          seen[v] = 1; prev[v] = u; Q.push(v);
        }
      }
      this.path = null;
      if (found) { const path = []; for (let u = g; u !== -1; u = prev[u]) path.push([u % NX, (u / NX) | 0]); this.path = path.reverse(); }
      this.reached = seen;
      const crosses = this.path ? this.path.slice(1).filter((c, k) => Math.abs(c[1] - this.path[k][1]) > 1).length : 0;
      this.info.innerHTML = this.path ? `<b style="color:var(--ok)">找到路径</b>（${this.path.length - 1} 步）${crosses ? `，其中 <b>${crosses}</b> 次穿过 θ = 0 ∼ 2π 的识别边（虚线）——这正是图 4.8 想说的：规划器必须知道这里是柱面。` : "，没有用到识别边。"}` :
        `<b style="color:var(--bad)">找不到路径</b>。${!this.wrap ? "把左上角的「识别上下边」勾上再试：如果规划器不知道 θ 会绕回来，潜在的解就丢了。" : "q<sub>I</sub> 和 q<sub>G</sub> 确实不连通。"}`;
      this.info.innerHTML += " <span class='muted'>左图：拖动起点/终点、点格子画障碍。右图：左右拖动转动柱面。</span>";
      this.flat.redraw(); this.cyl.redraw();
    }
    drawFlat(ctx, w) {
      const P = palette(), { m, S, cw, ch } = this.geomF(), NX = this.NX, NY = this.NY;
      ctx.clearRect(0, 0, w, w);
      const X = (i) => m + i * cw, Y = (j) => 10 + (NY - j) * ch;
      ctx.fillStyle = P.surface; ctx.fillRect(m, 10, S, S);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (this.occ[k]) { ctx.fillStyle = P.ok; ctx.fillRect(X(i), Y(j + 1), cw + 0.5, ch + 0.5); }
        else if (this.reached[k]) { ctx.fillStyle = alpha(P.accent, 0.08); ctx.fillRect(X(i), Y(j + 1), cw + 0.5, ch + 0.5); }
      }
      ctx.strokeStyle = P.grid; ctx.lineWidth = 0.5;
      for (let i = 0; i <= NX; i++) { ctx.beginPath(); ctx.moveTo(X(i), 10); ctx.lineTo(X(i), 10 + S); ctx.stroke(); }
      for (let j = 0; j <= NY; j++) { ctx.beginPath(); ctx.moveTo(m, Y(j)); ctx.lineTo(m + S, Y(j)); ctx.stroke(); }
      ctx.strokeStyle = this.wrap ? P.accent : P.borderStrong; ctx.lineWidth = 2.5; ctx.setLineDash(this.wrap ? [7, 5] : []);
      ctx.beginPath(); ctx.moveTo(m, 10); ctx.lineTo(m + S, 10); ctx.moveTo(m, 10 + S); ctx.lineTo(m + S, 10 + S); ctx.stroke(); ctx.setLineDash([]);
      this.drawPath(ctx, (c) => [X(c[0] + 0.5), Y(c[1] + 0.5)], (a, b) => Math.abs(a[1] - b[1]) > 1, P);
      for (const [q, col, lab] of [[this.qI, P.start, "q_I"], [this.qG, P.goal, "q_G"]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(q[0] + 0.5), Y(q[1] + 0.5), Math.max(5, cw * 0.55), 0, 7); ctx.fill();
        ctx.fillStyle = P.text; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.fillText(lab, X(q[0] + 0.5) + 8, Y(q[1] + 0.5) - 6);
      }
      ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
      ctx.save(); ctx.translate(12, 10 + S / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("θ ∈ S¹（0 → 2π）", 0, 0); ctx.restore();
      ctx.textAlign = "center"; ctx.fillText("x ∈ ℝ", m + S / 2, w - 1); ctx.textAlign = "left";
    }
    drawPath(ctx, proj, jump, P) {
      if (!this.path) return;
      ctx.strokeStyle = P.path; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath();
      this.path.forEach((c, k) => { const p = proj(c); if (k === 0 || jump(this.path[k - 1], c)) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.stroke();
    }
    proj3(x, th, w) { // x ∈ [0,1]，th ∈ [0, 2π)
      const L = w * 0.62, R = w * 0.2, psi = 0.42, tau = 0.3;
      const u = (x - 0.5) * L, phi = th + this.rot;
      const y = R * Math.cos(phi), z = R * Math.sin(phi);
      const u1 = u * Math.cos(psi) + z * Math.sin(psi), z1 = -u * Math.sin(psi) + z * Math.cos(psi);
      const y2 = y * Math.cos(tau) - z1 * Math.sin(tau), z2 = y * Math.sin(tau) + z1 * Math.cos(tau);
      return [w / 2 + u1, w / 2 - y2, z2];
    }
    drawCyl(ctx, w) {
      const P = palette(), NX = this.NX, NY = this.NY;
      ctx.clearRect(0, 0, w, w);
      const T = (2 * Math.PI) / NY;
      const quads = [];
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        if (!this.occ[j * NX + i]) continue;
        const pts = [[i / NX, j * T], [(i + 1) / NX, j * T], [(i + 1) / NX, (j + 1) * T], [i / NX, (j + 1) * T]].map((q) => this.proj3(q[0], q[1], w));
        quads.push({ pts, z: pts.reduce((a, p) => a + p[2], 0) / 4 });
      }
      // 网格线（经线、纬线）
      const lines = [];
      for (let j = 0; j < NY; j += 4) { const seg = []; for (let k = 0; k <= 16; k++) seg.push(this.proj3(k / 16, j * T, w)); lines.push(seg); }
      for (const x of [0, 1]) { const seg = []; for (let k = 0; k <= 48; k++) seg.push(this.proj3(x, (k / 48) * 2 * Math.PI, w)); lines.push(seg); }
      const drawLines = (front) => {
        ctx.lineWidth = 1;
        lines.forEach((seg) => { for (let k = 0; k + 1 < seg.length; k++) { const z = (seg[k][2] + seg[k + 1][2]) / 2; if ((z > 0) !== front) continue; ctx.strokeStyle = front ? P.borderStrong : alpha(P.borderStrong, 0.35); ctx.beginPath(); ctx.moveTo(seg[k][0], seg[k][1]); ctx.lineTo(seg[k + 1][0], seg[k + 1][1]); ctx.stroke(); } });
      };
      const drawQuads = (front) => quads.filter((q) => (q.z > 0) === front).sort((a, b) => a.z - b.z).forEach((q) => {
        ctx.fillStyle = front ? alpha(P.ok, 0.85) : alpha(P.ok, 0.18);
        ctx.beginPath(); q.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      });
      // θ = 0 的识别线
      const seam = []; for (let k = 0; k <= 16; k++) seam.push(this.proj3(k / 16, 0, w));
      const drawSeam = (front) => { ctx.strokeStyle = front ? P.accent : alpha(P.accent, 0.3); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); for (let k = 0; k < 16; k++) { if ((seam[k][2] > 0) !== front) continue; ctx.beginPath(); ctx.moveTo(seam[k][0], seam[k][1]); ctx.lineTo(seam[k + 1][0], seam[k + 1][1]); ctx.stroke(); } ctx.setLineDash([]); };
      const pathPts = this.path ? this.path.map((c) => this.proj3((c[0] + 0.5) / NX, (c[1] + 0.5) * T, w)) : [];
      const drawPathPart = (front) => {
        ctx.strokeStyle = front ? P.path : alpha(P.path, 0.3); ctx.lineWidth = front ? 3 : 2; ctx.lineCap = "round";
        for (let k = 0; k + 1 < pathPts.length; k++) {
          const a = pathPts[k], b = pathPts[k + 1];
          if (((a[2] + b[2]) / 2 > 0) !== front) continue;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      };
      drawLines(false); drawQuads(false); drawSeam(false); drawPathPart(false);
      drawLines(true); drawQuads(true); drawSeam(true); drawPathPart(true);
      for (const [q, col] of [[this.qI, P.start], [this.qG, P.goal]]) {
        const p = this.proj3((q[0] + 0.5) / NX, (q[1] + 0.5) * T, w);
        ctx.fillStyle = p[2] > 0 ? col : alpha(col, 0.35); ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill();
      }
      ctx.fillStyle = P.muted; ctx.font = "12px " + getComputedStyle(document.body).fontFamily; ctx.textAlign = "center";
      ctx.fillText(this.wrap ? "粘起来以后：一个柱面" : "（未识别：右图仅示意，规划器把它当成长方形）", w / 2, w - 8);
      ctx.textAlign = "left";
    }
  }

  // =====================================================================
  // 9. 四元数
  // =====================================================================
  const qmul = (p, q) => [p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3], p[0] * q[1] + q[0] * p[1] + p[2] * q[3] - q[2] * p[3], p[0] * q[2] + q[0] * p[2] + q[1] * p[3] - p[1] * q[3], p[0] * q[3] + q[0] * p[3] + p[1] * q[2] - q[1] * p[2]];
  const Rq = (q) => { const [a, b, c, d] = q; return [[2 * (a * a + b * b) - 1, 2 * (b * c - a * d), 2 * (b * d + a * c)], [2 * (b * c + a * d), 2 * (a * a + c * c) - 1, 2 * (c * d - a * b)], [2 * (b * d - a * c), 2 * (c * d + a * b), 2 * (a * a + d * d) - 1]]; };
  const mv3 = (M, p) => [0, 1, 2].map((i) => M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2]);
  function quatFromR(M) {
    const r = (i, j) => M[i - 1][j - 1];
    const a = 0.5 * Math.sqrt(Math.max(0, r(1, 1) + r(2, 2) + r(3, 3) + 1));
    if (a > 1e-6) return { q: [a, (r(3, 2) - r(2, 3)) / (4 * a), (r(1, 3) - r(3, 1)) / (4 * a), (r(2, 1) - r(1, 2)) / (4 * a)], how: "式 (4.24)–(4.27)" };
    const den = Math.sqrt(r(1, 2) ** 2 * r(1, 3) ** 2 + r(1, 2) ** 2 * r(2, 3) ** 2 + r(1, 3) ** 2 * r(2, 3) ** 2);
    if (den < 1e-9) return { q: null, how: "a = 0 且 r12、r13、r23 中有两个为 0：式 (4.28)–(4.30) 失效（纯 yaw/pitch/roll 转 π，需要单独处理）" };
    return { q: [0, (r(1, 3) * r(1, 2)) / den, (r(1, 2) * r(2, 3)) / den, (r(1, 3) * r(2, 3)) / den], how: "a = 0（赤道）：式 (4.28)–(4.30)" };
  }
  const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], d: [1, 1, 1], c: null };
  const BOX = (() => { const v = []; for (const x of [-1, 1]) for (const y of [-0.55, 0.55]) for (const z of [-0.3, 0.3]) v.push([x, y, z]); return v; })();
  const BOX_E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  class Quaternion {
    constructor(root) {
      this.body = shell(root, "四元数与 SO(3) ≅ ℝP³", "图 4.9、4.10，式 (4.20)–(4.27)：转轴 v、转角 θ");
      this.axisK = "d"; this.az = 0.6; this.el = 0.5;
      this.theta = (2 * Math.PI) / 3;
      this.cam = [-0.6, 0.35];
      this.build();
    }
    axis() {
      let v = this.axisK === "c" ? [Math.cos(this.el) * Math.cos(this.az), Math.cos(this.el) * Math.sin(this.az), Math.sin(this.el)] : AXES[this.axisK];
      const n = Math.hypot(...v); return v.map((x) => x / n);
    }
    build() {
      const b = this.body;
      this.customCtl = h("span", { class: "controls", style: "margin:0" },
        slider("方位", -3.14, 3.14, 0.01, this.az, (v) => { this.az = v; this.render(); }, (v) => num((v * 180) / Math.PI, 0) + "°"),
        slider("仰角", -1.57, 1.57, 0.01, this.el, (v) => { this.el = v; this.render(); }, (v) => num((v * 180) / Math.PI, 0) + "°"));
      this.thSlider = slider("转角 θ =", 0, 720, 0.5, (this.theta * 180) / Math.PI, (v) => { this.theta = (v * Math.PI) / 180; this.render(); }, (v) => num(v, 1) + "°");
      b.append(h("div", { class: "controls" }, h("span", { class: "small muted" }, "转轴 v："),
        segmented([["x", "x 轴"], ["y", "y 轴"], ["z", "z 轴"], ["d", "(1,1,1)/√3"], ["c", "自定义"]], this.axisK, (k) => { this.axisK = k; this.render(); }), this.customCtl),
      h("div", { class: "controls" }, this.thSlider, button("θ = 180°", () => { this.theta = Math.PI; this.thSlider.set(180); this.render(); }, "small"), button("θ = 360°", () => { this.theta = 2 * Math.PI; this.thSlider.set(360); this.render(); }, "small")));
      const cv = h("div");
      this.panel = h("div", { class: "panel-body mono", style: "font-size:12.5px;line-height:1.7" });
      this.chart = s("svg", { viewBox: "0 0 300 110", style: "width:100%;display:block" });
      b.append(h("div", { class: "split" }, cv, h("div", { style: "display:flex;flex-direction:column;gap:10px" },
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, "数值"), this.panel),
        h("div", { class: "panel" }, h("div", { class: "panel-title" }, "a = cos(θ/2)：转 2π 回到同一个旋转，h 却变成 −h"), h("div", { class: "panel-body" }, this.chart)))));
      this.comp = h("div", { class: "panel-body small" });
      b.append(h("div", { class: "panel", style: "margin-top:12px" }, h("div", { class: "panel-title" }, "乘法不交换（式 4.19）"), this.comp));
      this.cv = makeCanvas(cv, { aspect: 0.95, maxW: 440 }, (ctx, w, hh) => this.draw(ctx, w, hh));
      let last = null;
      onDrag(this.cv.canvas, { down: (p) => { last = p; }, move: (p) => { this.cam[0] += (p.x - last.x) * 0.01; this.cam[1] = Math.max(-1.4, Math.min(1.4, this.cam[1] + (p.y - last.y) * 0.01)); last = p; this.cv.redraw(); } });
      this.cv.canvas.style.cursor = "grab";
      this.render();
    }
    quat() { const v = this.axis(), s_ = Math.sin(this.theta / 2); return [Math.cos(this.theta / 2), v[0] * s_, v[1] * s_, v[2] * s_]; }
    render() {
      this.customCtl.classList.toggle("hidden", this.axisK !== "c");
      const q = this.quat(), M = Rq(q), nq = q.map((x) => -x), Mn = Rq(nq);
      const same = M.every((r, i) => r.every((x, j) => Math.abs(x - Mn[i][j]) < 1e-12));
      const f = (x) => (x >= 0 ? " " : "") + num(x, 3).padEnd(x >= 0 ? 5 : 6, " ");
      const qs = (q_) => `${num(q_[0], 3)} ${q_[1] < 0 ? "−" : "+"} ${num(Math.abs(q_[1]), 3)}i ${q_[2] < 0 ? "−" : "+"} ${num(Math.abs(q_[2]), 3)}j ${q_[3] < 0 ? "−" : "+"} ${num(Math.abs(q_[3]), 3)}k`;
      const inv = quatFromR(M);
      const canon = q[0] > 1e-9 || (Math.abs(q[0]) <= 1e-9 && (q[1] > 1e-9 || (Math.abs(q[1]) <= 1e-9 && (q[2] > 1e-9 || (Math.abs(q[2]) <= 1e-9 && q[3] > 0))))) ? "h" : "−h";
      this.panel.innerHTML =
        `h &nbsp;= ${qs(q)}<br>−h = ${qs(nq)}<br>` +
        `R(h) = [${M.map((r) => r.map(f).join(" ")).join("]<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [")}]<br>` +
        `R(h) ${same ? "=" : "≠"} R(−h) ${same ? "✓" : ""}　|h| = ${num(Math.hypot(...q), 6)}<br>` +
        `<span style="font-family:var(--font)">规范代表（a ≥ 0 的上半球）：<b>${canon}</b>${Math.abs(q[0]) < 1e-9 ? "（正好在赤道 a = 0 上，要再看 b、c、d 的符号）" : ""}<br>` +
        `从矩阵反求（${inv.how}）：${inv.q ? qs(inv.q) : "—"}</span>`;
      // 图表
      const ch = this.chart; ch.innerHTML = "";
      const X = (t) => 20 + (t / (4 * Math.PI)) * 270, Y = (a) => 55 - a * 40;
      ch.append(s("rect", { x: X(Math.PI), y: 10, width: X(3 * Math.PI) - X(Math.PI), height: 90, fill: "var(--bad-soft)" }));
      ch.append(s("line", { x1: 20, y1: 55, x2: 290, y2: 55, stroke: "var(--border-strong)" }));
      let d = "";
      for (let i = 0; i <= 120; i++) { const t = (i / 120) * 4 * Math.PI; d += (i ? "L" : "M") + X(t).toFixed(1) + "," + Y(Math.cos(t / 2)).toFixed(1); }
      ch.append(s("path", { d, fill: "none", stroke: "var(--accent)", "stroke-width": 2 }));
      [[0, "0"], [Math.PI, "π"], [2 * Math.PI, "2π"], [3 * Math.PI, "3π"], [4 * Math.PI, "4π"]].forEach(([t, l]) => ch.append(s("text", { x: X(t), y: 108, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, l)));
      ch.append(s("text", { x: X(2 * Math.PI), y: 22, "text-anchor": "middle", "font-size": 10, fill: "var(--bad)" }, "a < 0：规范代表要换成 −h"));
      ch.append(s("circle", { cx: X(this.theta), cy: Y(Math.cos(this.theta / 2)), r: 5, fill: "var(--bad)" }));
      // 乘法
      const hx = [Math.SQRT1_2, Math.SQRT1_2, 0, 0], hz = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
      const p1 = qmul(hz, hx), p2 = qmul(hx, hz);
      const aa = (q_) => { const t = 2 * Math.acos(Math.max(-1, Math.min(1, q_[0]))), sn = Math.sin(t / 2); return `转 ${num((t * 180) / Math.PI, 1)}°，轴 (${[1, 2, 3].map((i) => num(q_[i] / sn, 3)).join(", ")})`; };
      this.comp.innerHTML = `h<sub>x</sub> = 绕 x 轴 90°，h<sub>z</sub> = 绕 z 轴 90°。<br>` +
        `先 h<sub>x</sub> 再 h<sub>z</sub>：R(h<sub>z</sub>)R(h<sub>x</sub>) = R(h<sub>z</sub>·h<sub>x</sub>)，h<sub>z</sub>·h<sub>x</sub> = <span class="mono">${qs(p1)}</span> → ${aa(p1)}<br>` +
        `先 h<sub>z</sub> 再 h<sub>x</sub>：h<sub>x</sub>·h<sub>z</sub> = <span class="mono">${qs(p2)}</span> → ${aa(p2)}<br>` +
        `两者不同：四元数乘法和三维旋转一样不交换。`;
      const showBtn = (lab, q_) => button(lab, () => { const t = 2 * Math.acos(q_[0]), sn = Math.sin(t / 2); this.axisK = "c"; const v = [q_[1] / sn, q_[2] / sn, q_[3] / sn]; this.el = Math.asin(v[2]); this.az = Math.atan2(v[1], v[0]); this.theta = t; this.thSlider.set((t * 180) / Math.PI); this.customCtl.querySelectorAll("label").forEach((l, i) => l.set(i ? this.el : this.az)); this.render(); }, "small");
      this.comp.append(h("div", { class: "controls", style: "margin:6px 0 0" }, showBtn("在 3D 里看 h<sub>z</sub>·h<sub>x</sub>", p1), showBtn("在 3D 里看 h<sub>x</sub>·h<sub>z</sub>", p2)));
      if (this.cv) this.cv.redraw();
    }
    proj(p, w) {
      const [yaw, pitch] = this.cam;
      // 世界 z 轴朝上
      const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw);
      const sx = x1, depth = y1 * Math.cos(pitch) + p[2] * Math.sin(pitch), sy = -y1 * Math.sin(pitch) + p[2] * Math.cos(pitch);
      const k = w * 0.27;
      return [w / 2 + k * sx, w * 0.5 - k * sy, depth];
    }
    draw(ctx, w, hh) {
      const P = palette(); ctx.clearRect(0, 0, w, hh);
      const q = this.quat(), M = Rq(q), v = this.axis();
      const line = (a, b, col, wd, dash) => { const A = this.proj(a, w), B = this.proj(b, w); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]); };
      const font = "12px " + getComputedStyle(document.body).fontFamily; ctx.font = font;
      const lab = (p, t, col) => { const A = this.proj(p, w); ctx.fillStyle = col; ctx.fillText(t, A[0] + 4, A[1] - 4); };
      // 世界坐标轴
      [[1, 0, 0, P.bad, "x"], [0, 1, 0, P.ok, "y"], [0, 0, 1, P.accent, "z"]].forEach(([x, y, z, c, t]) => { line([0, 0, 0], [1.7 * x, 1.7 * y, 1.7 * z], alpha(c, 0.35), 1, [3, 3]); lab([1.75 * x, 1.75 * y, 1.75 * z], t, alpha(c, 0.6)); });
      // 原来的盒子（淡）
      BOX_E.forEach(([i, j]) => line(BOX[i], BOX[j], alpha(P.muted, 0.35), 1));
      // 转轴
      line(v.map((x) => -1.9 * x), v.map((x) => 1.9 * x), P.warn, 2, [6, 4]);
      lab(v.map((x) => 1.95 * x), "v", P.warn);
      // 旋转后的盒子：前面 (x = +1) 填色，显示朝向
      const RB = BOX.map((p) => mv3(M, p));
      const face = [1, 3, 7, 5].map((i) => this.proj(RB[i], w));
      ctx.fillStyle = alpha(P.bad, 0.28); ctx.beginPath(); face.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      const top = [2, 3, 7, 6].map((i) => this.proj(RB[i], w));
      ctx.fillStyle = alpha(P.ok, 0.2); ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      BOX_E.forEach(([i, j]) => line(RB[i], RB[j], P.text, 1.6));
      // 物体坐标系
      [[1, 0, 0, P.bad], [0, 1, 0, P.ok], [0, 0, 1, P.accent]].forEach(([x, y, z, c]) => line([0, 0, 0], mv3(M, [1.3 * x, 1.3 * y, 1.3 * z]), c, 2.6));
      // 角度弧：在垂直于 v 的平面里
      const u0 = Math.abs(v[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      let e1 = [u0[1] * v[2] - u0[2] * v[1], u0[2] * v[0] - u0[0] * v[2], u0[0] * v[1] - u0[1] * v[0]]; const n1 = Math.hypot(...e1); e1 = e1.map((x) => x / n1);
      const e2 = [v[1] * e1[2] - v[2] * e1[1], v[2] * e1[0] - v[0] * e1[2], v[0] * e1[1] - v[1] * e1[0]];
      const arc = [];
      const tt = Math.min(this.theta, 4 * Math.PI);
      for (let i = 0; i <= 80; i++) { const t = (i / 80) * tt, r = 0.5 + (0.1 * t) / (2 * Math.PI); arc.push([0, 1, 2].map((k) => 1.2 * v[k] + r * (Math.cos(t) * e1[k] + Math.sin(t) * e2[k]))); }
      ctx.strokeStyle = P.warn; ctx.lineWidth = 1.8; ctx.beginPath(); arc.forEach((p, i) => { const A = this.proj(p, w); if (i) ctx.lineTo(A[0], A[1]); else ctx.moveTo(A[0], A[1]); }); ctx.stroke();
      ctx.fillStyle = P.muted; ctx.fillText("拖动画面可以转视角；红面 = 物体的 +x 面", 8, hh - 8);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const reg = { o2: O2, cylinder: Cylinder, quaternion: Quaternion };
    for (const [k, C] of Object.entries(reg)) document.querySelectorAll(`[data-widget='${k}']`).forEach((el) => { try { el._w = new C(el); } catch (e) { console.error(k, e); } });
  });
})();
