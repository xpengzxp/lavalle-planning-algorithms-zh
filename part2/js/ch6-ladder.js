/* 6.3.4 节：线段机器人（「梯子」）的单元分解——雷达图 (6.6)、五种临界曲线（图 6.24、6.25）、非临界区域（图 6.26）、
   Nicomedes 蚌线 (6.7) 及其笔误 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;
  const TAU = 2 * Math.PI;

  // ---------------------------------------------------------------
  // 场景：障碍是若干多边形，自由空间是它们的补集（没有外边界）
  // 每个场景给特征（边、顶点）起名字；与书中图 6.22、6.26 对得上的用书里的名字
  // ---------------------------------------------------------------
  function buildScene(def) {
    const polys = def.polys.map((Q) => Q.map(([x, y]) => P(x, y)));
    const edges = [], verts = [];
    let ke = 0, kv = 0;
    polys.forEach((Q, pi) => Q.forEach((p, i) => {
      const nmE = (def.edgeNames && def.edgeNames[pi] && def.edgeNames[pi][i]) || null;
      const nmV = (def.vertNames && def.vertNames[pi] && def.vertNames[pi][i]) || null;
      edges.push({ a: p, b: Q[(i + 1) % Q.length], pi, i, name: nmE || "f" + ++ke });
      verts.push({ p, pi, i, name: nmV || "u" + ++kv, prev: Q[(i - 1 + Q.length) % Q.length], next: Q[(i + 1) % Q.length] });
    }));
    const free = (q) => !polys.some((Q) => C.inPoly(q, Q));
    // 「凸角」：自由空间一侧的内角 > π（书中称 reflex vertex）
    verts.forEach((v) => {
      const u = P(v.prev.x - v.p.x, v.prev.y - v.p.y), w = P(v.next.x - v.p.x, v.next.y - v.p.y);
      const lu = Math.hypot(u.x, u.y), lw = Math.hypot(w.x, w.y), d = P(u.x / lu + w.x / lw, u.y / lu + w.y / lw), ld = Math.hypot(d.x, d.y) || 1;
      v.reflex = !free(P(v.p.x + (1e-6 * d.x) / ld, v.p.y + (1e-6 * d.y) / ld));
    });
    return Object.assign({}, def, { polys, edges, verts, free });
  }
  const LSCENES = {
    fig622: {
      name: "图 6.22 / 6.23 的场景",
      polys: [[[-0.1, 0.8], [-1.0, 1.2], [-1.1, 0.45]], [[-2.2, -0.75], [2.6, -0.75], [2.6, -1.0], [-2.2, -1.0]]],
      edgeNames: [["e1", "e4", "e2"], ["e3", "e5", "e6", "e7"]], vertNames: [["v1", "v2", "v3"], ["v4", "v5", "v6", "v7"]],
      view: [-1.7, 2.3, -1.2, 1.45], p: [0, 0], L: 1, labels: ["e1", "e2", "e3", "v1"],
    },
    fig626: {
      name: "仿图 6.26 的楔形走廊",
      polys: [[[-2.5, 0.357], [1.6, 0.357], [-2.5, 2.66]],
        [[-2.5, 0], [3.11, 0], [-2.5, 3.0669], [-2.5, 3.6], [3.9, 3.6], [3.9, -0.6], [-2.5, -0.6]]],
      edgeNames: [["e1", "e2", "g1"], ["e3", "e4", "g2", "g3", "g4", "g5", "g6"]], vertNames: [["w1", "x1", "w2"], ["w3", "x2", "w4", "w5", "w6", "w7", "w8"]],
      view: [-0.35, 3.35, -0.25, 1.95], p: [0.4, 1.25], L: 1, labels: ["e1", "e2", "e3", "e4", "x1", "x2"],
    },
  };

  // 线段机器人：原点 p、长度 L、朝向 θ；与障碍相交（含接触）即碰撞
  function segFree(Sc, p, L, th) {
    const q = P(p.x + L * Math.cos(th), p.y + L * Math.sin(th));
    for (const e of Sc.edges) if (C.segIntersect(p, q, e.a, e.b)) return false;
    return true;
  }
  // 在临界朝向 θ* 时，线段碰到的是哪个特征：端点碰边（Type VE）或内部碰顶点（Type EV）
  function contactFeature(Sc, p, L, th) {
    const q = P(p.x + L * Math.cos(th), p.y + L * Math.sin(th));
    let best = Infinity, nm = "?";
    for (const e of Sc.edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, t = ((q.x - e.a.x) * dx + (q.y - e.a.y) * dy) / (dx * dx + dy * dy);
      if (t > 1e-6 && t < 1 - 1e-6) { const d = Math.abs((q.x - e.a.x) * dy - (q.y - e.a.y) * dx) / Math.hypot(dx, dy); if (d < best) { best = d; nm = e.name; } }
    }
    for (const v of Sc.verts) {
      const dx = q.x - p.x, dy = q.y - p.y, t = ((v.p.x - p.x) * dx + (v.p.y - p.y) * dy) / (dx * dx + dy * dy);
      if (t > 0 && t < 1) { const d = Math.abs((v.p.x - p.x) * dy - (v.p.y - p.y) * dx) / Math.hypot(dx, dy); if (d < best) { best = d; nm = v.name; } }
    }
    return nm;
  }
  // 雷达图：返回逆时针排列的自由区间 [{t0, t1, f0, f1}]；全自由返回 "all"，全碰撞返回 "none"
  function radar(Sc, p, L, N) {
    N = N || 720;
    if (!Sc.free(p)) return "none";
    const fr = new Uint8Array(N);
    let any = 0, all = 1;
    for (let k = 0; k < N; k++) { fr[k] = segFree(Sc, p, L, (k * TAU) / N) ? 1 : 0; any |= fr[k]; all &= fr[k]; }
    if (all) return "all";
    if (!any) return "none";
    const refine = (a, b) => { const fa = segFree(Sc, p, L, a); for (let it = 0; it < 26; it++) { const m = (a + b) / 2; if (segFree(Sc, p, L, m) === fa) a = m; else b = m; } return (a + b) / 2; };
    const k0 = fr.indexOf(0), out = [];
    let start = null;
    for (let s = 0; s < N; s++) {
      const a = (k0 + s) % N, b = (a + 1) % N;
      const ta = (a * TAU) / N, tb = ta + TAU / N;
      if (!fr[a] && fr[b]) start = refine(ta, tb);
      if (fr[a] && !fr[b] && start !== null) { const end = refine(ta, tb); out.push({ t0: start % TAU, t1: end % TAU }); }
    }
    // 跨过 θ = 0 的区间排第一（环形顺序，从哪个开始都一样）
    out.forEach((iv) => { iv.wrap = iv.t0 > iv.t1; iv.f0 = contactFeature(Sc, p, L, iv.t0 - 1e-7); iv.f1 = contactFeature(Sc, p, L, iv.t1 + 1e-7); });
    out.sort((a, b) => (a.wrap ? a.t0 - TAU : a.t0) - (b.wrap ? b.t0 - TAU : b.t0));
    return out;
  }
  function repr(R) { return R === "all" ? "()" : R === "none" ? "∅" : "(" + R.map((iv) => `[${iv.f0}, ${iv.f1}]`).join(", ") + ")"; }
  function classify(oldR, newR) {
    if (oldR === newR) return null;
    if (newR === "all") return "最后一段碰撞（黑带）消失：自由区间首尾相接成整个圆，记作 ()";
    if (oldR === "all") return "出现了碰撞：整圆的自由朝向被切出一段黑带";
    if (newR === "none" || oldR === "none") return newR === "none" ? "原点进入了 C_obs：任何朝向都碰撞（∅）" : "原点离开了 C_obs";
    const keys = (R) => (Array.isArray(R) ? R.map((iv) => iv.f0 + "|" + iv.f1) : R === "all" ? ["()"] : []);
    const A = keys(oldR), B = keys(newR);
    if (A.join() === B.join() || (A.length === B.length && A.every((k) => B.includes(k)))) return null;
    if (B.length > A.length) return A.every((k) => B.includes(k)) ? "1) 出现了一个新的自由区间" : "3) 一个自由区间分裂成两个";
    if (B.length < A.length) return B.every((k) => A.includes(k)) ? "2) 一个自由区间消失了" : "4) 两个自由区间合并成一个";
    return "5) 某个区间端点处接触的特征换了";
  }

  // ---------------------------------------------------------------
  // 五种临界曲线（图 6.24、6.25）；只保留机器人原点在 C_free、且被接触的特征「看得见」的部分（激光的比喻）
  // ---------------------------------------------------------------
  function seesPoint(Sc, p, q, skipEdge) {
    for (const e of Sc.edges) { if (e === skipEdge || e.a === q || e.b === q) continue; if (C.properCross(p, q, e.a, e.b)) return false; }
    return Sc.free(C.lerp(p, q, 0.5)) || C.dist(p, q) < 1e-9;
  }
  function criticalCurves(Sc, L) {
    const out = { a: [], b: [], c: [], d: [], e: [] };
    const pushRun = (arr, pts, ok) => { let run = []; pts.forEach((p, i) => { if (ok[i]) run.push(p); else { if (run.length > 1) arr.push(run); run = []; } }); if (run.length > 1) arr.push(run); };
    // (a) 与边平行、相距 L 的线段
    for (const e of Sc.edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, l = Math.hypot(dx, dy); let nx = -dy / l, ny = dx / l;
      const m = C.lerp(e.a, e.b, 0.5); if (!Sc.free(P(m.x + nx * 1e-4, m.y + ny * 1e-4))) { nx = -nx; ny = -ny; }
      const pts = [], ok = [];
      for (let k = 1; k < 120; k++) { const f = C.lerp(e.a, e.b, k / 120), p = P(f.x + nx * L, f.y + ny * L); pts.push(p); ok.push(Sc.free(p) && seesPoint(Sc, p, f, e)); }
      pushRun(out.a, pts, ok);
    }
    // (b) 以顶点为心、半径 L 的圆
    for (const v of Sc.verts) {
      if (!v.reflex) continue;
      const pts = [], ok = [];
      for (let k = 0; k <= 360; k++) { const t = (k / 360) * TAU, p = P(v.p.x + L * Math.cos(t), v.p.y + L * Math.sin(t)); pts.push(p); ok.push(Sc.free(p) && seesPoint(Sc, p, v.p)); }
      pushRun(out.b, pts, ok);
    }
    // (c) 在凸角（自由空间内角 > π）处把边延长出去
    for (const v of Sc.verts) {
      if (!v.reflex) continue;
      for (const o of [v.prev, v.next]) {
        const dx = v.p.x - o.x, dy = v.p.y - o.y, l = Math.hypot(dx, dy);
        const pts = [], ok = [];
        for (let k = 1; k <= 60; k++) { const p = P(v.p.x + (dx / l) * L * k / 60, v.p.y + (dy / l) * L * k / 60); pts.push(p); ok.push(Sc.free(p)); }
        pushRun(out.c, pts, ok);
      }
    }
    // (d) 双切线：两个互相可见、相距 < L 的凸角，沿连线往外延长 L − |v1v2|
    const R = Sc.verts.filter((v) => v.reflex);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const v1 = R[i], v2 = R[j], d = C.dist(v1.p, v2.p);
      if (d >= L || !seesPoint(Sc, v1.p, v2.p)) continue;
      if (!C.bitangent61(v1.prev, v1.p, v1.next, v2.prev, v2.p, v2.next)) continue;
      for (const [a, b] of [[v1, v2], [v2, v1]]) {
        const ux = (a.p.x - b.p.x) / d, uy = (a.p.y - b.p.y) / d, pts = [], ok = [];
        for (let k = 1; k <= 40; k++) { const p = P(a.p.x + ux * (L - d) * k / 40, a.p.y + uy * (L - d) * k / 40); pts.push(p); ok.push(Sc.free(p)); }
        pushRun(out.d, pts, ok);
      }
    }
    // (e) 蚌线：线段同时擦过顶点 v、端点落在边 e 上
    for (const v of R) for (const e of Sc.edges) {
      if (e.a === v.p || e.b === v.p) continue;
      const pts = [], ok = [];
      for (let k = 1; k < 200; k++) {
        const q = C.lerp(e.a, e.b, k / 200), r = C.dist(q, v.p);
        if (r > L || r < 1e-9) { pts.push(null); ok.push(false); continue; }
        const p = P(q.x + ((v.p.x - q.x) * L) / r, q.y + ((v.p.y - q.y) * L) / r);
        const good = Sc.free(p) && seesPoint(Sc, q, v.p, e) && seesPoint(Sc, p, v.p) && (C.cross(p, q, v.prev) > 0) === (C.cross(p, q, v.next) > 0);
        pts.push(p); ok.push(good);
      }
      pushRun(out.e, pts, ok);
    }
    return out;
  }

  class Radar {
    constructor(root) {
      this.key = root.dataset.scene || "fig622";
      this.showCrit = true; this.colorReg = false; this.th = 0.4;
      const body = C.frame(root, "雷达图与临界曲线", "拖动机器人的原点（黑点）；拖动末端改朝向 θ");
      this.st = new C.Stage({ aspect: 0.7, maxW: 560, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { if (this.st.near(p, this.p, 14)) return "p"; if (this.st.near(p, this.tip(), 14)) return "tip"; return null; },
        onMove: (p, d) => {
          if (d === "p") { this.p = p; this.update(); }
          else { this.th = (Math.atan2(p.y - this.p.y, p.x - this.p.x) + TAU) % TAU; this.st.draw(); this.st2.draw(); }
        },
        cursor: (p) => (this.st.near(p, this.p, 14) || this.st.near(p, this.tip(), 14) ? "grab" : null) });
      this.st2 = new C.Stage({ aspect: 1, maxW: 260, view: [-1.45, 1.45, -1.45, 1.45], onDraw: (ctx, st, col) => this.drawRadar(st, col),
        onDown: (p) => { this.th = (Math.atan2(p.y, p.x) + TAU) % TAU; this.st.draw(); this.st2.draw(); return "r"; },
        onMove: (p) => { this.th = (Math.atan2(p.y, p.x) + TAU) % TAU; this.st.draw(); this.st2.draw(); } });
      this.selS = C.select(Object.entries(LSCENES).map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.load(); });
      this.sL = C.slider("长度 L", 0.4, 1.6, 0.01, 1, (v) => { this.L = v; this.crit = criticalCurves(this.Sc, this.L); this.regions = null; this.update(); }, (v) => v.toFixed(2));
      this.cbK = C.check("临界曲线（图 6.24、6.25）", true, (v) => { this.showCrit = v; this.st.draw(); });
      this.btnR = C.button("给平面着色：按 (6.6) 的表示分区（图 6.26）", () => this.computeRegions(), "small");
      this.repr = h("div", { class: "msg info mono", style: "font-size:13.5px" });
      this.change = h("div", { class: "small", style: "min-height:2.8em" });
      this.regInfo = h("div", { class: "small muted" });
      body.append(h("div", { class: "controls" }, this.selS, this.sL, this.cbK, this.btnR),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.st2.wrap, this.repr, this.change, this.regInfo)),
        C.legend([[C.cv("bad"), "机器人 A（碰撞时变虚线）"], [C.cv("ok"), "雷达图上的自由朝向"], [C.cv("alive2"), "临界曲线 (a)–(e)"], [C.cva("wall", 0.7), "障碍"]]));
      this.load();
    }
    tip() { return P(this.p.x + this.L * Math.cos(this.th), this.p.y + this.L * Math.sin(this.th)); }
    load() {
      const def = LSCENES[this.key];
      this.Sc = buildScene(def); this.p = P(...def.p); this.L = def.L; this.sL.set(this.L);
      this.st.setView(def.view);
      this.crit = criticalCurves(this.Sc, this.L);
      this.regions = null; this.prevR = null; this.regInfo.textContent = "";
      this.update();
    }
    update() {
      const R = radar(this.Sc, this.p, this.L);
      const ch = this.prevR ? classify(this.prevR, R) : null;
      if (ch) this.change.innerHTML = `<b>临界变化</b>：${ch}<br><span class="muted">${repr(this.prevR)} → ${repr(R)}</span>`;
      this.prevR = R; this.R = R;
      this.repr.textContent = "(6.6) 的表示：" + repr(R);
      this.st.draw(); this.st2.draw();
    }
    computeRegions() {
      // 逐行计算每个格点的表示 (6.6)，再把相同表示的相邻格点并成区域
      const [x0, x1, y0, y1] = this.st.view, nx = 120, ny = Math.round(120 * (y1 - y0) / (x1 - x0));
      const keys = new Array(nx * ny);
      let j = 0;
      this.btnR.disabled = true;
      const step = () => {
        const t0 = performance.now();
        while (j < ny && performance.now() - t0 < 30) {
          for (let i = 0; i < nx; i++) {
            const p = P(x0 + ((i + 0.5) * (x1 - x0)) / nx, y0 + ((j + 0.5) * (y1 - y0)) / ny);
            const R = radar(this.Sc, p, this.L, 360);
            keys[j * nx + i] = R === "none" ? null : repr(R);
          }
          j++;
        }
        this.regInfo.textContent = `正在计算… ${Math.round((100 * j) / ny)}%`;
        if (j < ny) { requestAnimationFrame(step); return; }
        // 连通分量
        const lab = new Int32Array(nx * ny).fill(-1), regs = [];
        for (let k = 0; k < nx * ny; k++) {
          if (keys[k] === null || lab[k] >= 0) continue;
          const id = regs.length, q = [k]; lab[k] = id; let n = 0;
          while (q.length) { const u = q.pop(); n++; const i = u % nx, jj = (u - i) / nx; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + di, j2 = jj + dj; if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue; const k2 = j2 * nx + i2; if (lab[k2] < 0 && keys[k2] === keys[k]) { lab[k2] = id; q.push(k2); } } }
          regs.push({ key: keys[k], n });
        }
        // 相邻区域用不同颜色（贪心着色）
        const nb = regs.map(() => new Set());
        for (let k = 0; k < nx * ny; k++) { if (lab[k] < 0) continue; const i = k % nx; if (i + 1 < nx && lab[k + 1] >= 0 && lab[k + 1] !== lab[k]) { nb[lab[k]].add(lab[k + 1]); nb[lab[k + 1]].add(lab[k]); } if (k + nx < nx * ny && lab[k + nx] >= 0 && lab[k + nx] !== lab[k]) { nb[lab[k]].add(lab[k + nx]); nb[lab[k + nx]].add(lab[k]); } }
        const colr = regs.map(() => -1);
        regs.forEach((r, i) => { const used = new Set([...nb[i]].map((u) => colr[u])); let c = 0; while (used.has(c)) c++; colr[i] = c; });
        this.regions = { nx, ny, lab, colr, view: [x0, x1, y0, y1] };
        const big = regs.filter((r) => r.n >= 6).length;
        this.regInfo.innerHTML = `得到 ${big} 个（面积不太小的）非临界区域；同色块内 (6.6) 的表示处处相同，色块边界就是临界曲线。<span class="muted">（补充演示：格点上的数值计算，很窄的区域可能漏掉。）</span>`;
        this.btnR.disabled = false;
        this.st.draw();
      };
      requestAnimationFrame(step);
    }
    draw(st, col) {
      const Sc = this.Sc;
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      if (this.regions) {
        // 先画到一张与格点同分辨率的离屏图上，再整体放大（避免相邻小格叠出网纹）
        const { nx, ny, lab, colr, view } = this.regions, ctx = st.ctx;
        const off = document.createElement("canvas"); off.width = nx; off.height = ny;
        const octx = off.getContext("2d"), img = octx.createImageData(nx, ny);
        const sf = C.rgb(col.surface);
        for (let k = 0; k < nx * ny; k++) {
          if (lab[k] < 0) continue;
          const i = k % nx, j = (k - i) / nx, o = ((ny - 1 - j) * nx + i) * 4;
          const c = C.rgb(col[C.PALETTE[colr[lab[k]] % C.PALETTE.length]]), a = 0.3;
          img.data[o] = sf[0] * (1 - a) + c[0] * a; img.data[o + 1] = sf[1] * (1 - a) + c[1] * a; img.data[o + 2] = sf[2] * (1 - a) + c[2] * a; img.data[o + 3] = 255;
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, st.X(view[0]), st.Y(view[3]), (view[1] - view[0]) * st.scale, (view[3] - view[2]) * st.scale);
        ctx.imageSmoothingEnabled = true;
      }
      for (const Q of Sc.polys) st.poly(Q, C.alpha(col.wall, 0.78), col.wall, 1.2);
      if (this.showCrit) {
        const dash = { a: null, b: null, c: [6, 3], d: [2, 3], e: null };
        for (const k of ["a", "b", "c", "d", "e"]) for (const run of this.crit[k]) st.path(run, k === "e" ? col.alive2 : C.alpha(col.alive2, 0.8), k === "e" ? 2 : 1.4, dash[k]);
      }
      // 特征名（只标书中图里出现的那几个）
      for (const e of Sc.edges) if (Sc.labels.includes(e.name)) {
        // 名字放在自由空间一侧；边很长时取它在视野里的那一段的中点
        const [vx0, vx1] = st.view, a = e.a.x < e.b.x ? e.a : e.b, b = e.a.x < e.b.x ? e.b : e.a;
        const t0 = Math.max(0, (vx0 - a.x) / (b.x - a.x || 1)), t1 = Math.min(1, (vx1 - a.x) / (b.x - a.x || 1));
        const m = C.lerp(a, b, (t0 + t1) / 2), dx = b.x - a.x, dy = b.y - a.y, Ln = Math.hypot(dx, dy);
        let nx = -dy / Ln, ny = dx / Ln; if (!Sc.free(P(m.x + nx * 1e-3, m.y + ny * 1e-3))) { nx = -nx; ny = -ny; }
        const off = 12 / st.scale;
        st.text(e.name, P(m.x + nx * off, m.y + ny * off), col.text2, { size: 12, weight: 650 });
      }
      for (const v of Sc.verts) if (Sc.labels.includes(v.name)) { st.dot(v.p, 3.5, col.wall); st.text(v.name, v.p, col.text2, { dx: 12, dy: -8, size: 12, weight: 600 }); }
      // 半径 L 的圆与机器人
      const ctx = st.ctx; ctx.beginPath(); ctx.arc(st.X(this.p.x), st.Y(this.p.y), this.L * st.scale, 0, TAU); ctx.strokeStyle = C.alpha(col.text, 0.35); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      if (Array.isArray(this.R)) for (const iv of this.R) {
        // 自由朝向的扇形边界
        for (const t of [iv.t0, iv.t1]) st.line(this.p, P(this.p.x + this.L * Math.cos(t), this.p.y + this.L * Math.sin(t)), C.alpha(col.ok, 0.7), 1.2);
      }
      const fr = Sc.free(this.p) && segFree(Sc, this.p, this.L, this.th);
      st.line(this.p, this.tip(), col.bad, 4, fr ? null : [5, 4]);
      st.dot(this.p, 6, col.text, col.surface, 2);
      st.dot(this.tip(), 4.5, col.surface, col.bad, 2);
    }
    drawRadar(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const ctx = st.ctx, c = P(0, 0), r = 1;
      ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), r * st.scale, 0, TAU); ctx.strokeStyle = C.alpha(col.text, 0.3); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const arc = (t0, t1, color, w) => { ctx.beginPath(); ctx.arc(st.X(0), st.Y(0), r * st.scale, -t0, -t1, true); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };
      if (this.R === "all") arc(0, TAU - 1e-6, col.ok, 7);
      else if (this.R === "none") arc(0, TAU - 1e-6, col.wall, 7);
      else {
        arc(0, TAU - 1e-6, col.wall, 7);
        for (const iv of this.R) {
          const t1 = iv.t1 < iv.t0 ? iv.t1 + TAU : iv.t1;
          arc(iv.t0, t1, col.ok, 7);
          for (const [t, f] of [[iv.t0, iv.f0], [iv.t1, iv.f1]]) {
            st.line(c, P(Math.cos(t), Math.sin(t)), C.alpha(col.ok, 0.5), 1);
            st.text(f, P(1.22 * Math.cos(t), 1.22 * Math.sin(t)), col.text, { size: 12, weight: 650 });
          }
        }
      }
      st.line(c, P(Math.cos(this.th), Math.sin(this.th)), col.bad, 3);
      st.dot(c, 4, col.text);
      st.text("θ = " + Math.round((this.th * 180) / Math.PI) + "°", P(0, -0.25), col.text2, { size: 11.5 });
    }
  }

  // ===============================================================
  // 图 6.25 与式 (6.7)：Nicomedes 蚌线
  // ===============================================================
  class Conchoid {
    constructor(root) {
      this.d = 0.4; this.L = 1; this.s = 0.35; this.showBook = true;
      const body = C.frame(root, "Nicomedes 蚌线：同时碰到顶点 v 和边 e", "拖动接触点在 e 上的位置；改 d、L 看「泪滴」");
      this.st = new C.Stage({ aspect: 0.72, maxW: 560, view: [-1.25, 1.25, -0.75, 1.05], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: () => "s", onMove: (p) => { this.s = Math.max(-this.maxS(), Math.min(this.maxS(), p.x)); this.render(); }, cursor: () => "ew-resize" });
      this.sd = C.slider("d（v 到 e 的距离）", 0.1, 0.95, 0.01, this.d, (v) => { this.d = v; this.s = Math.max(-this.maxS(), Math.min(this.maxS(), this.s)); this.render(); }, (v) => v.toFixed(2));
      this.sL = C.slider("L", 0.5, 1.4, 0.01, this.L, (v) => { this.L = v; this.s = Math.max(-this.maxS(), Math.min(this.maxS(), this.s)); this.render(); }, (v) => v.toFixed(2));
      this.cb = C.check("同时画出原书印的 (x² − y²) 版本", true, (v) => { this.showBook = v; this.render(); });
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sd, this.sL, this.cb), h("div", { class: "split" }, this.st.wrap, this.out),
        C.legend([[C.cv("alive2"), "(x² + y²)(y + d)² − y²L² = 0（更正）"], [C.cv("bad"), "(x² − y²)(y + d)² − y²L² = 0（原书 6.7）"], [C.cv("warn"), "机器人原点走过的环"]]));
      this.render();
    }
    maxS() { return Math.sqrt(Math.max(0, this.L * this.L - this.d * this.d)) - 1e-3; }
    render() {
      const q = P(this.s, -this.d), r = Math.hypot(q.x, q.y), L = this.L, d = this.d;
      this.pp = P(q.x * (1 - L / r), q.y * (1 - L / r));
      const { x, y } = this.pp;
      const fix = (x * x + y * y) * (y + d) ** 2 - y * y * L * L, book = (x * x - y * y) * (y + d) ** 2 - y * y * L * L;
      this.out.innerHTML = `<p>v 在原点，e 是直线 \\(y = -d\\)。机器人从原点 \\(p = (${x.toFixed(3)}, ${y.toFixed(3)})\\) 出发，擦过 v，末端落在 e 上的 \\((${q.x.toFixed(3)}, ${(-d).toFixed(2)})\\)，总长 L。</p>`
        + `<p class="mono">更正式：${fix.toExponential(2)}<br>原书 (6.7)：${book.toExponential(2)}</p>`
        + `<p>p 永远满足更正后的方程（数值误差 ~1e-16），而原书的式子只在 \\(x = 0\\) 时为零。推导：以 v 为极点，\\(p\\) 与 \\(q\\) 在同一条过 v 的直线上，\\(|pq| = L\\)；由相似三角形 \\(\\frac{|y+d|}{L} = \\frac{|y|}{\\sqrt{x^2+y^2}}\\)，平方后就是 \\((x^2+y^2)(y+d)^2 = y^2L^2\\)。</p>`
        + `<p class="muted">环内：机器人能碰到 e 但碰不到 v；刚出环：又能碰到 v。环顶在 \\((0, L-d)\\)；\\(d \\ge L\\) 时没有环。</p>`;
      PA.renderMath(this.out);
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      const d = this.d, L = this.L, box = { x0: -1.25, x1: 1.25, y0: -0.75, y1: 1.05 };
      st.poly([P(-3, -d), P(3, -d), P(3, -3), P(-3, -3)], C.alpha(col.wall, 0.7), col.wall, 1);
      st.poly([P(0, 0), P(-1.6, 0.35), P(-1.6, -0.12)], C.alpha(col.wall, 0.7), col.wall, 1);
      st.text("e", P(0.9, -d), col.text2, { dy: 12, weight: 650 }); st.text("v", P(0, 0), col.text2, { dx: 10, dy: 12, weight: 650 });
      const segs = (f) => C.contour(f, box, 200, 150);
      // 原点走过的环（只画 v 上方那支）：先画成宽而淡的底色，再在上面画方程的曲线，看它们是否重合
      const loop = []; const m = this.maxS();
      for (let k = 0; k <= 200; k++) { const s = -m + (2 * m * k) / 200, r = Math.hypot(s, d); loop.push(P(s * (1 - L / r), -d * (1 - L / r))); }
      st.path(loop, C.alpha(col.warn, 0.45), 8);
      if (this.showBook) for (const [a, b] of segs((x, y) => (x * x - y * y) * (y + d) ** 2 - y * y * L * L)) st.line(a, b, C.alpha(col.bad, 0.85), 1.6, [4, 3]);
      for (const [a, b] of segs((x, y) => (x * x + y * y) * (y + d) ** 2 - y * y * L * L)) st.line(a, b, col.alive2, 2.2);
      const q = P(this.s, -d);
      st.line(this.pp, q, col.bad, 4);
      st.dot(this.pp, 6, col.text, col.surface, 2); st.dot(q, 4, col.surface, col.bad, 2); st.dot(P(0, 0), 4, col.wall);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='radar']").forEach((el) => el._w = new Radar(el));
    document.querySelectorAll("[data-widget='conchoid']").forEach((el) => el._w = new Conchoid(el));
  });
  window.CH6.ladder = { buildScene, LSCENES, radar, repr, criticalCurves, classify };
})();
