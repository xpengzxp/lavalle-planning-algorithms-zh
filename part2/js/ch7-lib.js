/* 第 7 章共用小库：画布舞台、3D 视图、可复现随机数、2D 几何、堆 / 并查集、栅格画法、控件与时间轴 */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange } = PA;

  // ---------------------------------------------------------------
  // 颜色：每次重画时从 CSS 变量读取，深色模式自动生效
  // 本章约定：灰 = 障碍 O / X_obs，绿 = 解路径；A¹ 蓝、A² 粉、A³ 琥珀；transit 蓝、transfer 琥珀
  // ---------------------------------------------------------------
  const COLOR_VARS = {
    bg: "--bg", surface: "--surface", surface2: "--surface-2", surface3: "--surface-3",
    text: "--text", text2: "--text-2", muted: "--muted", border: "--border", strong: "--border-strong",
    accent: "--accent", accentSoft: "--accent-soft", ok: "--ok", okSoft: "--ok-soft", warn: "--warn", warnSoft: "--warn-soft",
    bad: "--bad", badSoft: "--bad-soft", start: "--c-start", goal: "--c-goal", path: "--c-path", wall: "--c-wall",
    alive: "--c-alive", dead: "--c-dead", alive2: "--c-alive2", dead2: "--c-dead2", current: "--c-current", grid: "--c-grid",
    mud: "--c-mud",
  };
  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
    o.robot = [o.start, o.goal, o.alive, o.alive2];   // A¹, A², A³, A⁴
    return o;
  }
  function rgb(hex) {
    hex = (hex || "#888").trim();
    if (hex[0] !== "#") return [136, 136, 136];
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function alpha(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  // 两种颜色线性混合（t=0 → a，t=1 → b），返回 [r,g,b]
  function mixRGB(a, b, t) { const A = rgb(a), B = rgb(b); return [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)); }

  // ---------------------------------------------------------------
  // 可复现的伪随机数（mulberry32）
  // ---------------------------------------------------------------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  let seedCounter = 4242;
  const newSeed = () => (seedCounter = (seedCounter * 1103515245 + 12345 + Date.now()) >>> 0);

  // ---------------------------------------------------------------
  // 2D 几何
  // ---------------------------------------------------------------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rect(x0, y0, x1, y1) { return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]; }
  function polyBox(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of P) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1 };
  }
  function inPoly(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  // 线段 p→q 与线段 a→b 的交点参数 t（沿 p→q），不相交返回 Infinity
  function segHitT(p, q, a, b) {
    const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-14) return Infinity;
    const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den;
    const u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : Infinity;
  }
  function segPointDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
    t = clamp(t, 0, 1);
    return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
  }
  function polyArea(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j].x + P[i].x) * (P[j].y - P[i].y); return Math.abs(s) / 2; }
  // 两个凸多边形是否相交（分离轴定理；touch 为 true 时把「恰好接触」也算相交）
  function convexOverlap(A, B, touch) {
    const eps = touch ? 1e-9 : -1e-9;
    for (const P of [A, B]) {
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const nx = P[i].y - P[j].y, ny = P[j].x - P[i].x;
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of A) { const v = p.x * nx + p.y * ny; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
        for (const p of B) { const v = p.x * nx + p.y * ny; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
        if (a1 < b0 - eps || b1 < a0 - eps) return false;
      }
    }
    return true;
  }
  // 轴对齐矩形 {x0,y0,x1,y1} 的相交（开集：只接触不算）
  const boxOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  // 折线：总长、按弧长参数 s∈[0,1] 取点
  function polyLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += dist(P[i - 1], P[i]); return L; }
  function polyAt(P, s) {
    const L = polyLen(P) * clamp(s, 0, 1); let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const d = dist(P[i - 1], P[i]);
      if (acc + d >= L - 1e-12) return lerp(P[i - 1], P[i], d ? (L - acc) / d : 0);
      acc += d;
    }
    return { ...P[P.length - 1] };
  }

  // 网格路径的「拉直」：从当前点出发，跳到最远的、直线可见的后续点（点用数组 [x, y, …] 表示）
  function shortcut(P, free, step) {
    if (P.length < 3) return P.slice();
    const segFree = (a, b) => {
      const L = Math.hypot(...a.map((v, i) => b[i] - v)), n = Math.max(1, Math.ceil(L / step));
      for (let k = 1; k < n; k++) if (!free(a.map((v, i) => v + (b[i] - v) * k / n))) return false;
      return true;
    };
    const out = [P[0]]; let i = 0;
    while (i < P.length - 1) {
      let j = P.length - 1;
      while (j > i + 1 && !segFree(P[i], P[j])) j--;
      out.push(P[j]); i = j;
    }
    return out;
  }

  // ---------------------------------------------------------------
  // 二叉堆（最小）与并查集
  // ---------------------------------------------------------------
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item, key) {
      const a = this.a; a.push({ item, key }); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].key <= a[i].key) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].key < a[m].key) m = l; if (r < a.length && a[r].key < a[m].key) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; }
      }
      return top.item;
    }
  }
  class UnionFind {
    constructor(n) { this.p = Array.from({ length: n || 0 }, (_, i) => i); }
    add() { this.p.push(this.p.length); return this.p.length - 1; }
    find(i) { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; }
    union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; return a !== b; }
  }

  // 通用 BFS：状态用整数编码；nbrs(u) 返回 [v, label] 列表；返回 {found, path:[状态], labels:[动作]}
  function bfs(start, isGoal, nbrs, maxStates) {
    const parent = new Map([[start, -1]]), how = new Map(), Q = [start];
    let head = 0, goal = -1;
    while (head < Q.length) {
      const u = Q[head++];
      if (isGoal(u)) { goal = u; break; }
      if (maxStates && parent.size > maxStates) break;
      for (const [v, lab] of nbrs(u)) if (!parent.has(v)) { parent.set(v, u); how.set(v, lab); Q.push(v); }
    }
    if (goal < 0) return { found: false, expanded: head, path: [], labels: [] };
    const path = [], labels = [];
    for (let c = goal; c !== -1; c = parent.get(c)) { path.push(c); labels.push(how.get(c)); }
    path.reverse(); labels.reverse();
    return { found: true, expanded: head, path, labels };
  }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 200, view: [0, 1, 0, 1], pad: 6 }, opts);
      this.wrap = h("div", { class: "ch7-stage" });
      this.canvas = h("canvas");
      this.wrap.append(this.canvas);
      this.view = this.o.view;
      this.drag = null;
      this.bind();
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.wrap);
      onThemeChange(() => this.draw());
      requestAnimationFrame(() => this.resize());
    }
    resize() {
      if (!this.wrap.clientWidth) return;
      const w = Math.max(this.o.minW, Math.min(this.o.maxW, this.wrap.clientWidth));
      if (w === this.W && this.ctx) return;
      this.W = w; this.H = Math.round(w * this.o.aspect);
      this.ctx = fitCanvas(this.canvas, this.W, this.H);
      this.draw();
    }
    setView(v) { this.view = v; }
    get scale() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; return Math.min((this.W - 2 * p) / (x1 - x0), (this.H - 2 * p) / (y1 - y0)); }
    X(x) { const [x0, x1] = this.view, s = this.scale; return (this.W - (x1 - x0) * s) / 2 + (x - x0) * s; }
    Y(y) { const [, , y0, y1] = this.view, s = this.scale; return (this.H + (y1 - y0) * s) / 2 - (y - y0) * s; }
    inv(px, py) {
      const [x0, x1, y0, y1] = this.view, s = this.scale;
      return { x: (px - (this.W - (x1 - x0) * s) / 2) / s + x0, y: ((this.H + (y1 - y0) * s) / 2 - py) / s + y0 };
    }
    draw() {
      if (!this.ctx) return;
      this.col = colors(this.wrap);
      this.ctx.clearRect(0, 0, this.W, this.H);
      if (this.o.onDraw) this.o.onDraw(this.ctx, this, this.col);
    }
    bind() {
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); return this.inv(e.clientX - r.left, e.clientY - r.top); };
      c.addEventListener("pointerdown", (e) => {
        if (!this.o.onDown) return;
        const d = this.o.onDown(pos(e), e);
        if (d) { this.drag = d; c.setPointerCapture(e.pointerId); e.preventDefault(); }
      });
      c.addEventListener("pointermove", (e) => {
        const p = pos(e);
        if (this.drag) { if (this.o.onMove) this.o.onMove(p, this.drag, e); }
        else if (this.o.onHover) this.o.onHover(p, e);
        if (this.o.cursor) c.style.cursor = this.drag ? "grabbing" : (this.o.cursor(p) || "default");
      });
      const up = (e) => { if (this.drag) { const d = this.drag; this.drag = null; if (this.o.onUp) this.o.onUp(pos(e), d, e); } };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("pointerleave", (e) => { if (!this.drag && this.o.onLeave) this.o.onLeave(e); });
    }
    // 常用画法（世界坐标）
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    polyline(P, color, lw, dash) {
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    box(b, fill, stroke, lw) { this.poly(rect(b.x0, b.y0, b.x1, b.y1), fill, stroke, lw); }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    arrow(a, b, color, lw, head) {
      this.line(a, b, color, lw);
      const ctx = this.ctx, ax = this.X(a.x), ay = this.Y(a.y), bx = this.X(b.x), by = this.Y(b.y);
      const ang = Math.atan2(by - ay, bx - ax), L = head || 8;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx - L * Math.cos(ang - 0.4), by - L * Math.sin(ang - 0.4));
      ctx.lineTo(bx - L * Math.cos(ang + 0.4), by - L * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    // 把后续绘制裁剪到 view 的矩形里；返回一个恢复函数
    clip() {
      const ctx = this.ctx, [x0, x1, y0, y1] = this.view;
      ctx.save(); ctx.beginPath(); ctx.rect(this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale); ctx.clip();
      return () => ctx.restore();
    }
    frame(col, fill) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      ctx.fillStyle = fill || col.surface; ctx.fillRect(this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, (x1 - x0) * this.scale - 1, (y1 - y0) * this.scale - 1);
    }
    // 在世界矩形 [x0,x1]×[y0,y1] 上画一张 nx×ny 的栅格；fn(i,j) 返回 [r,g,b,a] 或 null（j 从下往上）
    raster(nx, ny, x0, x1, y0, y1, fn) {
      const off = document.createElement("canvas"); off.width = nx; off.height = ny;
      const octx = off.getContext("2d"), img = octx.createImageData(nx, ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = fn(i, j); if (!c) continue;
        const o = ((ny - 1 - j) * nx + i) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] === undefined ? 255 : c[3];
      }
      octx.putImageData(img, 0, 0);
      const ctx = this.ctx; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale);
      ctx.imageSmoothingEnabled = true;
    }
    // 坐标轴刻度与标签（在 view 的左、下边）
    axes(col, xl, yl) {
      const [x0, x1, y0, y1] = this.view;
      this.text(xl, { x: x1, y: y0 }, col.muted, { align: "right", base: "top", dy: 3, size: 11.5 });
      this.text(yl, { x: x0, y: y1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 2, size: 11.5 });
    }
  }

  // ---------------------------------------------------------------
  // 简单的 3D 视图：yaw / pitch 旋转 + 正交投影；在 Stage 上拖拽旋转
  // ---------------------------------------------------------------
  class View3D {
    constructor(yaw, pitch, center) { this.yaw = yaw; this.pitch = pitch; this.c = center || [0, 0, 0]; }
    proj(v) {
      const x = v[0] - this.c[0], y = v[1] - this.c[1], z = v[2] - this.c[2];
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const x1 = cy * x - sy * y, y1 = sy * x + cy * y;          // 绕 z 轴转 yaw
      const y2 = cp * y1 - sp * z, z2 = sp * y1 + cp * z;          // 绕 x 轴转 pitch
      return { x: x1, y: z2, depth: y2 };                          // 屏幕 x、屏幕 y（向上）、深度（越大越远）
    }
    // 返回给 Stage 用的拖拽回调
    dragHandlers(redraw) {
      return {
        onDown: (p) => ({ p0: p, yaw: this.yaw, pitch: this.pitch }),
        onMove: (p, d) => { this.yaw = d.yaw - (p.x - d.p0.x) * 2.2; this.pitch = clamp(d.pitch + (p.y - d.p0.y) * 2.2, -1.45, 1.45); redraw(); },
      };
    }
    line(st, a, b, color, lw, dash) { const A = this.proj(a), B = this.proj(b); st.line(A, B, color, lw, dash); }
    poly(st, P, fill, stroke, lw) { st.poly(P.map((v) => this.proj(v)), fill, stroke, lw); }
    // 单位立方体 [0,1]^3（或给定边界）的线框
    cube(st, col, b, labels) {
      b = b || [0, 1, 0, 1, 0, 1];
      const V = [];
      for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) V.push([x, y, z]);
      const E = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
      for (const [i, j] of E) this.line(st, V[i], V[j], alpha(col.muted, 0.6), 1);
      if (labels) {
        const t = (v, s) => st.text(s, this.proj(v), col.text2, { size: 12, weight: 650 });
        t([b[1] + 0.12 * (b[1] - b[0]), b[2], b[4]], labels[0]);
        t([b[0], b[3] + 0.12 * (b[3] - b[2]), b[4]], labels[1]);
        t([b[0], b[2], b[5] + 0.1 * (b[5] - b[4])], labels[2]);
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件外框 & 小控件
  // ---------------------------------------------------------------
  function frame(root, title, sub) {
    const body = h("div", { class: "widget-body" });
    root.append(h("div", { class: "widget-head" }, h("span", { class: "w-title" }, title), sub ? h("span", { class: "w-sub" }, sub) : null, h("span", { class: "w-badge" }, "互动")), body);
    return body;
  }
  function seg(options, value, onChange) {
    const el = h("div", { class: "seg" });
    const btns = options.map(([k, t]) => {
      const b = h("button", { type: "button", class: k === value ? "on" : "" }, t);
      b.addEventListener("click", () => { btns.forEach((x) => x.classList.toggle("on", x === b)); onChange(k); });
      el.append(b); return b;
    });
    el.set = (k) => btns.forEach((b, i) => b.classList.toggle("on", options[i][0] === k));
    return el;
  }
  function slider(label, min, max, step, value, onInput, fmtFn) {
    const out = h("b", { class: "mono" });
    const inp = h("input", { type: "range", min, max, step, value });
    const show = () => { out.textContent = fmtFn ? fmtFn(+inp.value) : inp.value; };
    inp.addEventListener("input", () => { show(); onInput(+inp.value); });
    show();
    const lab = h("label", null, label, inp, out);
    lab.input = inp; lab.refresh = show;
    lab.set = (v) => { inp.value = v; show(); };
    return lab;
  }
  function select(options, value, onChange) {
    const el = h("select");
    options.forEach(([k, t]) => el.append(h("option", { value: k, selected: k === value ? true : null }, t)));
    el.addEventListener("change", () => onChange(el.value));
    return el;
  }
  function check(label, value, onChange) {
    const cb = h("input", { type: "checkbox", checked: value ? true : null });
    cb.addEventListener("change", () => onChange(cb.checked));
    const lab = h("label", null, cb, label); lab.input = cb;
    return lab;
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  // 动画循环
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // 时间轴：播放 / 暂停 + 拖动条；onChange(u) 中 u∈[0,1]
  class Timeline {
    constructor(onChange, opts) {
      this.o = Object.assign({ label: "时间", dur: 4, fmt: (u) => u.toFixed(2) }, opts);
      this.u = 0; this.onChange = onChange;
      this.btn = button("▶ 播放", () => (this.runner.running ? this.runner.stop() : this.play()), "small primary");
      this.sl = slider(this.o.label, 0, 1000, 1, 0, (v) => { this.runner.stop(); this.u = v / 1000; this.onChange(this.u); }, (v) => this.o.fmt(v / 1000));
      this.runner = new Runner(() => {
        const now = performance.now(), dt = (now - this.t0) / 1000; this.t0 = now;
        this.u = Math.min(1, this.u + dt / this.o.dur); this.sl.set(Math.round(this.u * 1000)); this.onChange(this.u);
        return this.u < 1;
      }, () => { this.btn.textContent = "▶ 播放"; });
      this.el = h("div", { class: "controls", style: "margin:8px 0 0" }, this.btn, this.sl);
      this.sl.input.style.width = "200px";
    }
    play() { if (this.u >= 1) this.u = 0; this.t0 = performance.now(); this.btn.textContent = "❚❚ 暂停"; this.runner.start(); }
    set(u) { this.runner.stop(); this.u = u; this.sl.set(Math.round(u * 1000)); this.onChange(u); }
  }

  window.CH7 = {
    colors, rgb, alpha, mixRGB, rng, gauss, newSeed,
    dist, lerp, clamp, rect, polyBox, inPoly, segHitT, segPointDist, polyArea, convexOverlap, boxOverlap, polyLen, polyAt,
    Heap, UnionFind, bfs, shortcut, Stage, View3D, frame, seg, slider, select, check, cv, cva, stat, button, legend, Runner, Timeline,
  };
})();
