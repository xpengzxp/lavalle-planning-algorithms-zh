/* 第 14 章共用小库：画布舞台、控件、可复现随机数、2D 几何与障碍、车辆模型的闭式积分、
   Euler / RK4 系统模拟器、Dubins 最短路径（补充，15.3.1 节）、热图 */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange } = PA;

  // ---------------------------------------------------------------
  // 颜色：每次重画时从 CSS 变量读取，深色模式自动生效
  // ---------------------------------------------------------------
  const COLOR_VARS = {
    bg: "--bg", surface: "--surface", surface2: "--surface-2", surface3: "--surface-3",
    text: "--text", text2: "--text-2", muted: "--muted", border: "--border", strong: "--border-strong",
    accent: "--accent", accentSoft: "--accent-soft", accentText: "--accent-text", ok: "--ok", okSoft: "--ok-soft", warn: "--warn", warnSoft: "--warn-soft",
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
  // 两个颜色之间插值，t ∈ [0,1]
  function mix(c1, c2, t) {
    const a = rgb(c1), b = rgb(c2);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }

  // ---------------------------------------------------------------
  // 可复现的伪随机数（mulberry32）与高斯
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
  function radInv(i, p) { let f = 1 / p, r = 0; while (i > 0) { r += f * (i % p); i = Math.floor(i / p); f /= p; } return r; }

  // ---------------------------------------------------------------
  // 角度与 2D 几何
  // ---------------------------------------------------------------
  const TAU = 2 * Math.PI;
  const mod2pi = (a) => ((a % TAU) + TAU) % TAU;
  const angDiff = (a, b) => { let d = mod2pi(a - b); if (d > Math.PI) d -= TAU; return d; };   // a − b ∈ (−π, π]
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
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
  function segPointDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
  }

  // 工作空间 W 里的多边形障碍；机器人看成半径 r 的圆盘（r = 0 时是点）
  class World {
    constructor(polys, bounds) {
      this.B = bounds || { x0: 0, y0: 0, x1: 1, y1: 1 };
      this.polys = polys.map((P) => ({ P, box: polyBox(P) }));
      this.checks = 0;
    }
    free(p, r = 0) {
      this.checks++;
      const B = this.B;
      if (p.x < B.x0 + r || p.x > B.x1 - r || p.y < B.y0 + r || p.y > B.y1 - r) return false;
      for (const o of this.polys) {
        if (p.x < o.box.x0 - r || p.x > o.box.x1 + r || p.y < o.box.y0 - r || p.y > o.box.y1 + r) continue;
        if (inPoly(p, o.P)) return false;
        if (r > 0) { const P = o.P; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (segPointDist(p, P[j], P[i]).d < r) return false; }
      }
      return true;
    }
    // 一串点（状态轨迹的采样）是否全部自由
    pathFree(pts, r = 0) { for (const p of pts) if (!this.free(p, r)) return false; return true; }
  }

  // ---------------------------------------------------------------
  // 车辆模型（13.1.2 节），状态 s = {x, y, th}
  // 以速度 v、角速度 w 走时间 T 的闭式积分；w = v·tan(u_φ)/L
  // ---------------------------------------------------------------
  function carStep(s, v, w, T) {
    if (Math.abs(w) < 1e-12) return { x: s.x + v * T * Math.cos(s.th), y: s.y + v * T * Math.sin(s.th), th: s.th };
    const th2 = s.th + w * T, R = v / w;
    return { x: s.x + R * (Math.sin(th2) - Math.sin(s.th)), y: s.y - R * (Math.cos(th2) - Math.cos(s.th)), th: th2 };
  }
  // 沿一段动作取 n+1 个点（含两端），用于画图和碰撞检测
  function carSample(s, v, w, T, n) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(carStep(s, v, w, (T * k) / n));
    return out;
  }

  // ---------------------------------------------------------------
  // 系统模拟器（14.3.2 节）：Euler (14.16) 与四阶 Runge–Kutta (14.18)(14.19)
  // f(x, u) 返回 ẋ（数组）；uf(t) 给出 [0, h] 内的动作
  // ---------------------------------------------------------------
  function eulerStep(f, x, uf, hh) { const d = f(x, uf(0)); return x.map((xi, i) => xi + hh * d[i]); }
  function rk4Step(f, x, uf, hh) {
    const w1 = f(x, uf(0));
    const w2 = f(x.map((xi, i) => xi + 0.5 * hh * w1[i]), uf(0.5 * hh));
    const w3 = f(x.map((xi, i) => xi + 0.5 * hh * w2[i]), uf(0.5 * hh));
    const w4 = f(x.map((xi, i) => xi + hh * w3[i]), uf(hh));
    return x.map((xi, i) => xi + (hh / 6) * (w1[i] + 2 * w2[i] + 2 * w3[i] + w4[i]));
  }

  // ---------------------------------------------------------------
  // Dubins 最短路径（补充：属于 15.3.1 节；这里只用来做距离函数和 LPM）
  // 标准化：起点 (0,0,α)、终点 (d,0,β)、ρ = 1；返回每种字的三段长度 (t, p, q)
  // 与 part4/code/ch14_differential.py 第 9 项相同，已对 3000 对随机位形逐一积分核对
  // ---------------------------------------------------------------
  function dubinsWords(alpha, beta, d) {
    const sa = Math.sin(alpha), sb = Math.sin(beta), ca = Math.cos(alpha), cb = Math.cos(beta), cab = Math.cos(alpha - beta);
    const out = {};
    let p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
    if (p2 >= 0) { const t = Math.atan2(cb - ca, d + sa - sb); out.LSL = [mod2pi(-alpha + t), Math.sqrt(p2), mod2pi(beta - t)]; }
    p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
    if (p2 >= 0) { const t = Math.atan2(ca - cb, d - sa + sb); out.RSR = [mod2pi(alpha - t), Math.sqrt(p2), mod2pi(-beta + t)]; }
    p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
    if (p2 >= 0) { const p = Math.sqrt(p2), t = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p); out.LSR = [mod2pi(-alpha + t), p, mod2pi(-beta + t)]; }
    p2 = -2 + d * d + 2 * cab - 2 * d * (sa + sb);
    if (p2 >= 0) { const p = Math.sqrt(p2), t = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p); out.RSL = [mod2pi(alpha - t), p, mod2pi(beta - t)]; }
    let tmp = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
    if (Math.abs(tmp) <= 1) { const p = mod2pi(TAU - Math.acos(tmp)), t = mod2pi(alpha - Math.atan2(ca - cb, d - sa + sb) + p / 2); out.RLR = [t, p, mod2pi(alpha - beta - t + p)]; }
    tmp = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8;
    if (Math.abs(tmp) <= 1) { const p = mod2pi(TAU - Math.acos(tmp)), t = mod2pi(-alpha - Math.atan2(ca - cb, d + sa - sb) + p / 2); out.LRL = [t, p, mod2pi(beta - alpha - t + p)]; }
    return out;
  }
  // 从 q0 到 q1 的最短 Dubins 路径；only 可限定只用某些字（例如图 14.23 的 CSC）。返回 {L, word, seg, all}
  function dubins(q0, q1, rho, only) {
    rho = rho || 1;
    const dx = q1.x - q0.x, dy = q1.y - q0.y, D = Math.hypot(dx, dy), d = D / rho;
    const th = D > 1e-12 ? mod2pi(Math.atan2(dy, dx)) : 0;
    const W = dubinsWords(mod2pi(q0.th - th), mod2pi(q1.th - th), d);
    let best = null; const all = [];
    for (const [w, seg] of Object.entries(W)) {
      if (only && !only.includes(w)) continue;
      const L = (seg[0] + seg[1] + seg[2]) * rho;
      all.push({ word: w, seg, L });
      if (!best || L < best.L - 1e-12) best = { L, word: w, seg };
    }
    if (best) best.all = all.sort((a, b) => a.L - b.L);
    return best;
  }
  // 把一条 Dubins 路径采样成状态序列（间距约 ds）
  function dubinsSample(q0, word, seg, rho, ds) {
    rho = rho || 1; ds = ds || 0.02 * rho;
    const out = [{ ...q0 }]; let s = { ...q0 };
    for (let k = 0; k < 3; k++) {
      const L = seg[k] * rho, w = word[k] === "L" ? 1 / rho : word[k] === "R" ? -1 / rho : 0;
      const n = Math.max(1, Math.ceil(L / ds));
      for (let i = 1; i <= n; i++) out.push(carStep(s, 1, w, (L * i) / n));
      s = carStep(s, 1, w, L);
    }
    return out;
  }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 200, view: [0, 1, 0, 1], pad: 6, stretch: false }, opts);
      this.wrap = h("div", { class: "ch14-stage" });
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
      const w = Math.max(this.o.minW, Math.min(this.o.maxW, this.wrap.clientWidth || 0));
      if (!this.wrap.clientWidth) return;
      if (w === this.W && this.ctx) return;
      this.W = w; this.H = Math.round(w * this.o.aspect);
      this.ctx = fitCanvas(this.canvas, this.W, this.H);
      this.draw();
    }
    setView(v) { this.view = v; }
    // stretch = true 时 x、y 方向各自缩放（用于相平面、函数图像）；否则等比例
    get sx() { const [x0, x1, y0, y1] = this.view, p = this.o.pad, L = this.o.padL || p; return this.o.stretch ? (this.W - L - p) / (x1 - x0) : Math.min((this.W - 2 * p) / (x1 - x0), (this.H - 2 * p) / (y1 - y0)); }
    get sy() { const [x0, x1, y0, y1] = this.view, p = this.o.pad, B = this.o.padB || p; return this.o.stretch ? (this.H - B - p) / (y1 - y0) : this.sx; }
    get scale() { return this.sx; }
    X(x) { const [x0, x1] = this.view; if (this.o.stretch) return (this.o.padL || this.o.pad) + (x - x0) * this.sx; return (this.W - (x1 - x0) * this.sx) / 2 + (x - x0) * this.sx; }
    Y(y) { const [, , y0, y1] = this.view; if (this.o.stretch) return this.H - (this.o.padB || this.o.pad) - (y - y0) * this.sy; return (this.H + (y1 - y0) * this.sy) / 2 - (y - y0) * this.sy; }
    inv(px, py) {
      const [x0, x1, y0, y1] = this.view;
      if (this.o.stretch) return { x: (px - (this.o.padL || this.o.pad)) / this.sx + x0, y: (this.H - (this.o.padB || this.o.pad) - py) / this.sy + y0 };
      return { x: (px - (this.W - (x1 - x0) * this.sx) / 2) / this.sx + x0, y: ((this.H + (y1 - y0) * this.sy) / 2 - py) / this.sy + y0 };
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
    pxDist(a, b) { return Math.hypot(this.X(a.x) - this.X(b.x), this.Y(a.y) - this.Y(b.y)); }
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    polyline(P, color, lw, dash) {
      if (!P || P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    rectW(x0, y0, x1, y1, fill, stroke, lw) { this.poly(rect(x0, y0, x1, y1), fill, stroke, lw); }
    circle(c, r, fill, stroke, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(c.x), this.Y(c.y), r * this.sx, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    arrow(a, b, color, lw, head) {
      const ctx = this.ctx, ax = this.X(a.x), ay = this.Y(a.y), bx = this.X(b.x), by = this.Y(b.y);
      const L = Math.hypot(bx - ax, by - ay); if (L < 0.5) return;
      const ux = (bx - ax) / L, uy = (by - ay) / L, hd = Math.min(head || 7, L * 0.6);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 1.3;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * hd * 0.8, by - uy * hd * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * hd - uy * hd * 0.45, by - uy * hd + ux * hd * 0.45); ctx.lineTo(bx - ux * hd + uy * hd * 0.45, by - uy * hd - ux * hd * 0.45); ctx.closePath(); ctx.fill();
    }
    frame(col) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      const L = this.X(x0), T = this.Y(y1), Wd = this.X(x1) - L, Ht = this.Y(y0) - T;
      ctx.fillStyle = col.surface; ctx.fillRect(L, T, Wd, Ht);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(L + 0.5, T + 0.5, Wd - 1, Ht - 1);
    }
    // 坐标轴与刻度（相平面、函数图像用）
    axes(col, o) {
      o = Object.assign({ xticks: null, yticks: null, xlabel: "", ylabel: "", zero: true, grid: true }, o);
      const [x0, x1, y0, y1] = this.view, ctx = this.ctx;
      const ticks = (a, b, n) => { const step = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step; const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toFixed(10)); return out; };
      const xt = o.xticks || ticks(x0, x1, 6), yt = o.yticks || ticks(y0, y1, 5);
      if (o.grid) { for (const v of xt) this.line({ x: v, y: y0 }, { x: v, y: y1 }, col.grid, 1); for (const v of yt) this.line({ x: x0, y: v }, { x: x1, y: v }, col.grid, 1); }
      if (o.zero) { if (x0 < 0 && x1 > 0) this.line({ x: 0, y: y0 }, { x: 0, y: y1 }, col.strong, 1.2); if (y0 < 0 && y1 > 0) this.line({ x: x0, y: 0 }, { x: x1, y: 0 }, col.strong, 1.2); }
      ctx.font = `500 10px ${getComputedStyle(document.body).fontFamily}`; ctx.fillStyle = col.muted;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const v of xt) ctx.fillText(+v.toFixed(3) + "", this.X(v), this.Y(y0) + 3);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (const v of yt) ctx.fillText(+v.toFixed(3) + "", this.X(x0) - 4, this.Y(v));
      ctx.font = `600 11.5px ${getComputedStyle(document.body).fontFamily}`; ctx.fillStyle = col.text2;
      if (o.xlabel) { ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(o.xlabel, this.X(x1) - 4, this.Y(y0) - 3); }
      if (o.ylabel) { ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(o.ylabel, this.X(x0) + 5, this.Y(y1) + 3); }
    }
    world(W, col) {
      for (const o of W.polys) this.poly(o.P, alpha(col.wall, 0.82), col.wall, 1);
    }
    // 画一辆车（三角形 + 车身），s = {x, y, th}，size 为车长（世界单位）
    car(s, size, fill, stroke) {
      const c = Math.cos(s.th), sn = Math.sin(s.th), L = size, W = size * 0.55;
      const pt = (a, b) => ({ x: s.x + a * c - b * sn, y: s.y + a * sn + b * c });
      this.poly([pt(-0.25 * L, -W / 2), pt(0.6 * L, -W / 2), pt(0.85 * L, 0), pt(0.6 * L, W / 2), pt(-0.25 * L, W / 2)], fill, stroke, 1.3);
    }
    // 起点 / 目标标记
    mark(p, color, label, col) {
      this.dot(p, 6.5, color, col.surface, 2);
      if (label) this.text(label, p, color, { dy: -14, size: 12, weight: 650 });
    }
  }

  // 热图：values[j*nx+i]（j 从下往上），colorOf(v) 返回 [r,g,b] 或 null（透明）
  function heat(st, nx, ny, box, values, colorOf) {
    const off = document.createElement("canvas"); off.width = nx; off.height = ny;
    const octx = off.getContext("2d"); const img = octx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = colorOf(values[j * nx + i]); const o = ((ny - 1 - j) * nx + i) * 4;
      if (!c) { img.data[o + 3] = 0; continue; }
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] === undefined ? 255 : c[3];
    }
    octx.putImageData(img, 0, 0);
    const ctx = st.ctx; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, st.X(box[0]), st.Y(box[3]), st.X(box[1]) - st.X(box[0]), st.Y(box[2]) - st.Y(box[3]));
    ctx.imageSmoothingEnabled = true;
  }
  // 「蓝色由浅到深」色带：t ∈ [0,1]
  function blueRamp(col, t) {
    const a = rgb(col.surface), b = rgb(col.accent), c = rgb(col.text);
    t = clamp(t, 0, 1);
    if (t < 0.75) { const u = t / 0.75; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
    const u = (t - 0.75) / 0.25 * 0.45; return [b[0] + (c[0] - b[0]) * u, b[1] + (c[1] - b[1]) * u, b[2] + (c[2] - b[2]) * u];
  }

  // ---------------------------------------------------------------
  // 组件外框 & 小控件（与第 5 章同一套写法）
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
    lab.setValue = (v) => { inp.value = v; show(); };
    return lab;
  }
  function select(options, value, onChange) {
    const el = h("select");
    options.forEach(([k, t]) => el.append(h("option", { value: k, selected: k === value ? true : null }, t)));
    el.addEventListener("change", () => onChange(el.value));
    return el;
  }
  function chip(text, on, onChange) {
    const b = h("button", { type: "button", class: "chip" + (on ? " on" : "") }, text);
    b.addEventListener("click", () => { on = !on; b.classList.toggle("on", on); onChange(on); });
    b.set = (v) => { on = v; b.classList.toggle("on", on); };
    return b;
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  // 简单的动画循环控制器
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // 二叉堆（优先队列）
  class Heap {
    constructor(less) { this.a = []; this.less = less || ((x, y) => x.k < y.k); }
    get size() { return this.a.length; }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.less(a[l], a[m])) m = l; if (r < a.length && this.less(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
      return top;
    }
  }

  const fmt = (v, d = 2) => (v === Infinity ? "∞" : v === -Infinity ? "−∞" : Number.isInteger(v) ? String(v) : v.toFixed(d));

  window.CH14 = {
    colors, rgb, alpha, mix, rng, gauss, newSeed, radInv,
    TAU, mod2pi, angDiff, clamp, dist, lerp, rect, polyBox, inPoly, segPointDist, World,
    carStep, carSample, eulerStep, rk4Step, dubinsWords, dubins, dubinsSample,
    Stage, heat, blueRamp, frame, seg, slider, select, chip, cv, stat, button, legend, Runner, Heap, fmt,
  };
})();
