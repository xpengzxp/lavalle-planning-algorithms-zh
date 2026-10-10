/* 第 8 章共用小库：画布舞台、控件、颜色、针状图（向量场）、热图与等值线、数值积分、网格与可见性 */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange } = PA;

  // ---------------------------------------------------------------
  // 颜色：每次重画时从 CSS 变量读取，深色模式自动生效
  // ---------------------------------------------------------------
  const COLOR_VARS = {
    bg: "--bg", surface: "--surface", surface2: "--surface-2", surface3: "--surface-3",
    text: "--text", text2: "--text-2", muted: "--muted", border: "--border", strong: "--border-strong",
    accent: "--accent", accentSoft: "--accent-soft", ok: "--ok", okSoft: "--ok-soft", warn: "--warn", warnSoft: "--warn-soft",
    bad: "--bad", badSoft: "--bad-soft", start: "--c-start", goal: "--c-goal", path: "--c-path", wall: "--c-wall",
    alive: "--c-alive", dead: "--c-dead", alive2: "--c-alive2", dead2: "--c-dead2", current: "--c-current", grid: "--c-grid",
  };
  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
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
  function mix(hexA, hexB, t) {
    const a = rgb(hexA), b = rgb(hexB);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  // 顺序色阶（单一色相，由浅到深）：t∈[0,1] → [r,g,b]；从 surface 过渡到 accent
  function ramp(col, hue) {
    const a = rgb(col.surface), b = rgb(col[hue || "accent"]);
    return (t) => { t = Math.max(0, Math.min(1, t)); const s = 0.08 + 0.8 * t; return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; };
  }

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
  function radInv(i, p) { let f = 1 / p, r = 0; while (i > 0) { r += f * (i % p); i = Math.floor(i / p); f /= p; } return r; }

  // ---------------------------------------------------------------
  // 2D 几何
  // ---------------------------------------------------------------
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rect(x0, y0, x1, y1) { return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]; }
  function inPoly(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  // 线段 p→q 与线段 a→b 的交点参数 t（沿 p→q），不相交返回 Infinity
  function segHitT(p, q, a, b) {
    const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-14) return Infinity;
    const t = ((a.x - p.x) * sy - (a.y - p.y) * sx) / den;
    const u = ((a.x - p.x) * ry - (a.y - p.y) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : Infinity;
  }
  // 两线段在内部真相交（端点相接不算）
  function segCross(p, q, a, b) {
    const d1 = cross(a, b, p), d2 = cross(a, b, q), d3 = cross(p, q, a), d4 = cross(p, q, b);
    const e = 1e-12;
    return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
  }
  function segPointDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t, q: { x: a.x + t * dx, y: a.y + t * dy } };
  }
  function polyArea(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j].x + P[i].x) * (P[j].y - P[i].y); return -s / 2; }  // 逆时针为正

  // 多边形区域（外边界 + 若干洞）：可见性、内部判断
  class Region {
    constructor(outer, holes) {
      this.outer = outer; this.holes = holes || [];
      this.rings = [outer, ...this.holes];
      this.segs = [];
      for (const R of this.rings) for (let i = 0; i < R.length; i++) this.segs.push([R[i], R[(i + 1) % R.length]]);
    }
    inside(p) { if (!inPoly(p, this.outer)) return false; for (const H of this.holes) if (inPoly(p, H)) return false; return true; }
    // p 与 q 之间的线段是否完全在区域内（允许擦过顶点与边界）
    visible(p, q) {
      for (const [a, b] of this.segs) if (segCross(p, q, a, b)) return false;
      // 线段穿过一个顶点进入外部的情形：检查若干内点
      for (const t of [0.5, 0.25, 0.75]) {
        const m = lerp(p, q, t);
        if (!this.insideLoose(m)) return false;
      }
      return true;
    }
    insideLoose(p) {
      if (this.inside(p)) return true;
      for (const [a, b] of this.segs) if (segPointDist(p, a, b).d < 1e-9) return true;
      return false;
    }
    // 从 p 沿方向 (dx,dy) 打出的射线第一次碰到边界的距离
    ray(p, dx, dy) {
      const far = { x: p.x + dx * 10, y: p.y + dy * 10 };
      let best = Infinity;
      for (const [a, b] of this.segs) { const t = segHitT(p, far, a, b); if (t < best) best = t; }
      return best * 10;
    }
    // 可见多边形 V(p)：对每个顶点方向及其两侧各打一条射线（径向扫描的简单版本）
    visPoly(p) {
      const angs = [];
      for (const R of this.rings) for (const v of R) {
        const a = Math.atan2(v.y - p.y, v.x - p.x);
        angs.push(a - 1e-5, a, a + 1e-5);
      }
      angs.sort((a, b) => a - b);
      const pts = [];
      for (const a of angs) { const d = this.ray(p, Math.cos(a), Math.sin(a)); if (isFinite(d)) pts.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, a }); }
      return pts;
    }
    clearance(p) { let d = Infinity; for (const [a, b] of this.segs) d = Math.min(d, segPointDist(p, a, b).d); return d; }
  }

  // ---------------------------------------------------------------
  // 最小二叉堆
  // ---------------------------------------------------------------
  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item, key) {
      const a = this.a; a.push({ item, key }); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].key <= a[i].key) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    peekKey() { return this.a.length ? this.a[0].key : Infinity; }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].key < a[m].key) m = l; if (r < a.length && a[r].key < a[m].key) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; }
      }
      return top.item;
    }
  }

  // ---------------------------------------------------------------
  // 数值积分（式 8.14、8.15 的积分曲线）
  // ---------------------------------------------------------------
  function rk4(f, p, dt) {
    const k1 = f(p); if (!k1) return null;
    const k2 = f({ x: p.x + dt / 2 * k1.x, y: p.y + dt / 2 * k1.y }); if (!k2) return null;
    const k3 = f({ x: p.x + dt / 2 * k2.x, y: p.y + dt / 2 * k2.y }); if (!k3) return null;
    const k4 = f({ x: p.x + dt * k3.x, y: p.y + dt * k3.y }); if (!k4) return null;
    return { x: p.x + dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x), y: p.y + dt / 6 * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) };
  }
  function euler(f, p, dt) { const v = f(p); if (!v) return null; return { x: p.x + dt * v.x, y: p.y + dt * v.y }; }
  // 积分到 stop(p) 为真或步数用完；返回折线
  function integrate(f, p0, o) {
    o = Object.assign({ dt: 0.01, steps: 2000, method: "rk4", stop: null }, o);
    const step = o.method === "euler" ? euler : rk4;
    const pts = [p0]; let p = p0;
    for (let i = 0; i < o.steps; i++) {
      const q = step(f, p, o.dt);
      if (!q || !isFinite(q.x) || !isFinite(q.y)) break;
      pts.push(q); p = q;
      if (o.stop && o.stop(q, i)) break;
    }
    return pts;
  }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 200, view: [0, 1, 0, 1], pad: 6 }, opts);
      this.wrap = h("div", { class: "ch8-stage" });
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
      if (this.o.onResize) this.o.onResize(this);
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
        const p = pos(e);
        const d = this.o.onDown(p, e);
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
    // 常用画法
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    circle(p, rWorld, fill, stroke, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), Math.abs(rWorld * this.scale), 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    polyline(P, color, lw, dash) {
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.lineJoin = "round"; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    // 箭头：从 p 出发，世界坐标向量 v；px 为可选的像素长度（给定时按方向画定长箭头）
    arrow(p, v, color, o) {
      o = Object.assign({ lw: 1.4, head: 5, px: null }, o);
      const ctx = this.ctx;
      const x0 = this.X(p.x), y0 = this.Y(p.y);
      let dx = v.x * this.scale, dy = -v.y * this.scale;
      const L = Math.hypot(dx, dy);
      if (L < 1e-9) { ctx.beginPath(); ctx.arc(x0, y0, 1.3, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); return; }
      if (o.px) { dx = dx / L * o.px; dy = dy / L * o.px; }
      const x1 = x0 + dx, y1 = y0 + dy, L2 = Math.hypot(dx, dy);
      const hd = Math.min(o.head, L2 * 0.45), ux = dx / L2, uy = dy / L2;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = o.lw; ctx.setLineDash(o.dash || []);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hd - uy * hd * 0.55, y1 - uy * hd + ux * hd * 0.55);
      ctx.lineTo(x1 - ux * hd + uy * hd * 0.55, y1 - uy * hd - ux * hd * 0.55); ctx.closePath(); ctx.fill();
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    frame(col, fill) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      ctx.fillStyle = fill || col.surface; ctx.fillRect(this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, (x1 - x0) * this.scale - 1, (y1 - y0) * this.scale - 1);
    }
    // 起点 / 目标标记
    qmark(p, kind, col, label) {
      const c = kind === "I" ? col.start : col.goal;
      this.dot(p, 6.5, c, col.surface, 2);
      if (label !== "") this.text(label || (kind === "I" ? "x_I" : "x_G"), p, c, { dy: -14, size: 12, weight: 650 });
    }
    // 叉号（局部极小、卡住的位置等）
    xmark(p, color, r) {
      const ctx = this.ctx, x = this.X(p.x), y = this.Y(p.y); r = r || 5;
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
    }
    // 针状图（needle diagram）：f(p) → {x,y} 或 null；n×n 个网格点
    needles(f, col, o) {
      o = Object.assign({ n: 17, color: null, normalize: true, maxLen: null, lw: 1.1, head: 4, region: null, scaleLen: 1 }, o);
      const [x0, x1, y0, y1] = this.view;
      const nx = o.n, ny = Math.max(2, Math.round(o.n * (y1 - y0) / (x1 - x0)));
      const cell = Math.min((x1 - x0) / nx, (y1 - y0) / ny);
      const maxPx = (o.maxLen || 0.8) * cell * this.scale;
      const vals = [];
      let vmax = 0;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const p = { x: x0 + (i + 0.5) * (x1 - x0) / nx, y: y0 + (j + 0.5) * (y1 - y0) / ny };
        if (o.region && !o.region(p)) continue;
        const v = f(p); if (!v || !isFinite(v.x) || !isFinite(v.y)) continue;
        const m = Math.hypot(v.x, v.y); vmax = Math.max(vmax, m); vals.push([p, v, m]);
      }
      const color = o.color || alpha(col.accent, 0.85);
      for (const [p, v, m] of vals) {
        if (m < 1e-12) { this.dot(p, 1.2, color); continue; }
        const px = o.normalize ? maxPx * o.scaleLen : maxPx * Math.min(1, m / (o.vmax || vmax || 1)) * o.scaleLen;
        if (px < 1.5) { this.dot(p, 1, color); continue; }
        // 让针在网格点上居中
        const ux = v.x / m, uy = v.y / m, half = px / this.scale / 2;
        this.arrow({ x: p.x - ux * half, y: p.y - uy * half }, { x: ux, y: uy }, color, { px, lw: o.lw, head: o.head });
      }
    }
    // 热图：vals 是 nx×ny 的 Float64Array（列优先：vals[j*nx+i]，j 从下往上），值映射到 t∈[0,1]
    heat(vals, nx, ny, toT, col, o) {
      o = Object.assign({ hue: "accent", bands: 0, inf: null, rect: this.view, smooth: true }, o);
      const R = ramp(col, o.hue);
      const off = document.createElement("canvas"); off.width = nx; off.height = ny;
      const octx = off.getContext("2d"); const img = octx.createImageData(nx, ny);
      const infc = o.inf ? rgb(o.inf) : null;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v = vals[j * nx + i], k = ((ny - 1 - j) * nx + i) * 4;
        if (!isFinite(v) || Number.isNaN(v)) {
          if (infc) { img.data[k] = infc[0]; img.data[k + 1] = infc[1]; img.data[k + 2] = infc[2]; img.data[k + 3] = 255; }
          else img.data[k + 3] = 0;
          continue;
        }
        let t = toT(v);
        if (o.bands) t = (Math.floor(t * o.bands) + 0.5) / o.bands;
        const c = R(t);
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      const ctx = this.ctx; ctx.imageSmoothingEnabled = !!o.smooth;
      const [x0, x1, y0, y1] = o.rect;
      ctx.drawImage(off, this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale);
      ctx.imageSmoothingEnabled = true;
    }
    // 等值线（marching squares）：vals 同上，采样点在 rect 内均匀分布（含边界），levels 为数组
    contours(vals, nx, ny, levels, color, lw, o) {
      o = Object.assign({ rect: this.view }, o);
      const [x0, x1, y0, y1] = o.rect;
      const X = (i) => x0 + (x1 - x0) * i / (nx - 1), Y = (j) => y0 + (y1 - y0) * j / (ny - 1);
      const ctx = this.ctx; ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.beginPath();
      for (const L of levels) {
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const a = vals[j * nx + i], b = vals[j * nx + i + 1], c = vals[(j + 1) * nx + i + 1], d = vals[(j + 1) * nx + i];
          if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;
          const pts = [];
          const edge = (va, vb, pa, pb) => { if ((va < L) !== (vb < L)) { const t = (L - va) / (vb - va); pts.push({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }); } };
          const A = { x: X(i), y: Y(j) }, B = { x: X(i + 1), y: Y(j) }, C = { x: X(i + 1), y: Y(j + 1) }, D = { x: X(i), y: Y(j + 1) };
          edge(a, b, A, B); edge(b, c, B, C); edge(c, d, C, D); edge(d, a, D, A);
          for (let k = 0; k + 1 < pts.length; k += 2) { ctx.moveTo(this.X(pts[k].x), this.Y(pts[k].y)); ctx.lineTo(this.X(pts[k + 1].x), this.Y(pts[k + 1].y)); }
        }
      }
      ctx.stroke();
    }
  }

  // 在 rect 上均匀采样一个标量函数（含边界）：返回 {vals, nx, ny, min, max}
  function sampleField(fn, nx, ny, rectv) {
    const [x0, x1, y0, y1] = rectv;
    const vals = new Float64Array(nx * ny);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = fn({ x: x0 + (x1 - x0) * i / (nx - 1), y: y0 + (y1 - y0) * j / (ny - 1) });
      vals[j * nx + i] = v;
      if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    return { vals, nx, ny, min: mn, max: mx };
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
    const lab = h("label", null, cb, label); lab.input = cb; return lab;
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  // 简单的动画循环控制器：step() 返回 false 时停止
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
    toggle() { if (this.running) this.stop(); else this.start(); }
  }

  // ---------------------------------------------------------------
  // 网格（离散状态空间）：行 r 从上往下，列 c 从左往右
  // ---------------------------------------------------------------
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // 在网格上画格子：view 设为 [0, W, 0, H]，格子 (r,c) 占 [c, c+1] × [H-r-1, H-r]
  const cellRect = (H, r, c) => ({ x0: c, y0: H - r - 1, x1: c + 1, y1: H - r });
  function cellAt(stage, H, W, p) { const c = Math.floor(p.x), r = H - 1 - Math.floor(p.y); return r >= 0 && r < H && c >= 0 && c < W ? [r, c] : null; }
  function fillCell(stage, H, r, c, color, inset) {
    const R = cellRect(H, r, c), ctx = stage.ctx, s = stage.scale, e = inset || 0;
    ctx.fillStyle = color; ctx.fillRect(stage.X(R.x0) + e, stage.Y(R.y1) + e, s - 2 * e, s - 2 * e);
  }
  function gridLines(stage, H, W, color) {
    const ctx = stage.ctx; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    for (let c = 0; c <= W; c++) { const x = Math.round(stage.X(c)) + 0.5; ctx.moveTo(x, stage.Y(H)); ctx.lineTo(x, stage.Y(0)); }
    for (let r = 0; r <= H; r++) { const y = Math.round(stage.Y(r)) + 0.5; ctx.moveTo(stage.X(0), y); ctx.lineTo(stage.X(W), y); }
    ctx.stroke();
  }
  // 宽度优先 wavefront（图 8.4）：返回 {phi, waves}
  function wavefront(free, H, W, goals, nb) {
    const phi = new Float64Array(H * W).fill(Infinity);
    let Wi = goals.filter(([r, c]) => free[r * W + c]);
    for (const [r, c] of Wi) phi[r * W + c] = 0;
    const waves = [Wi.slice()];
    let i = 0;
    while (Wi.length) {
      const nxt = [];
      for (const [r, c] of Wi) for (const [dr, dc] of nb) {
        const a = r + dr, b = c + dc;
        if (a >= 0 && a < H && b >= 0 && b < W && free[a * W + b] && phi[a * W + b] === Infinity) { phi[a * W + b] = i + 1; nxt.push([a, b]); }
      }
      i++; Wi = nxt; if (Wi.length) waves.push(Wi.slice());
    }
    return { phi, waves };
  }
  // 局部算子 (8.4)：沿 φ 下降，直到到达 0 或卡住
  function descendGrid(phi, H, W, start, nb, maxSteps) {
    const path = [start]; let [r, c] = start;
    for (let k = 0; k < (maxSteps || 10000); k++) {
      const v = phi[r * W + c];
      if (!(v > 0) || !isFinite(v)) break;
      let best = v, br = -1, bc = -1;
      for (const [dr, dc] of nb) { const a = r + dr, b = c + dc; if (a >= 0 && a < H && b >= 0 && b < W && phi[a * W + b] < best) { best = phi[a * W + b]; br = a; bc = b; } }
      if (br < 0) break;
      r = br; c = bc; path.push([r, c]);
    }
    return path;
  }

  window.CH8 = {
    colors, rgb, alpha, mix, ramp, rng, gauss, radInv, dist, lerp, clamp, rect, inPoly, cross, segHitT, segCross, segPointDist, polyArea,
    Region, Heap, rk4, euler, integrate, Stage, sampleField, frame, seg, slider, select, check, cv, cva, stat, button, legend, Runner,
    N4, N8, cellRect, cellAt, fillCell, gridLines, wavefront, descendGrid,
  };
})();
