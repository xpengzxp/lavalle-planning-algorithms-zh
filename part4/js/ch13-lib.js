/* 第 13 章共用小库：画布舞台（2D / 简易 3D）、时间曲线、RK4、车辆画法、组件外框与小控件
   Part IV 颜色约定：蓝 = 系统本体与实际轨迹，绿 = 允许的速度 / 可达集 / 积分曲线族，红 = 被禁止的速度 / 违反约束，
   橙 = 动作 u（转向、推力、力矩），紫 = 自然 / 第二个决策者，深灰 = 障碍，粉 = 目标。 */
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
    purple: "--c-alive2", purpleSoft: "--c-dead2", current: "--c-current", grid: "--c-grid", mud: "--c-mud",
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
    const A = rgb(hexA), B = rgb(hexB);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;

  // ---------------------------------------------------------------
  // 数学小工具
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;
  // 状态是普通数组；f(x) 返回同长度的导数数组
  function rk4(f, x, dt) {
    const n = x.length, k1 = f(x), t = new Array(n);
    for (let i = 0; i < n; i++) t[i] = x[i] + 0.5 * dt * k1[i];
    const k2 = f(t);
    for (let i = 0; i < n; i++) t[i] = x[i] + 0.5 * dt * k2[i];
    const k3 = f(t);
    for (let i = 0; i < n; i++) t[i] = x[i] + dt * k3[i];
    const k4 = f(t);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = x[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return out;
  }
  // 3D 向量
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => Math.hypot(a[0], a[1], a[2]),
    unit: (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
  };
  // 3×3 矩阵（行优先的嵌套数组）
  const m3 = {
    I: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    mul: (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])),
    vec: (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]),
    T: (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]),
    axis(u, ang) {
      const [x, y, z] = v3.unit(u), c = Math.cos(ang), s = Math.sin(ang), C = 1 - c;
      return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
    },
    // 正交化（Gram–Schmidt，防止数值积分累积误差）
    ortho(R) {
      const c0 = v3.unit([R[0][0], R[1][0], R[2][0]]);
      let c1 = [R[0][1], R[1][1], R[2][1]];
      c1 = v3.unit(v3.sub(c1, v3.mul(c0, v3.dot(c0, c1))));
      const c2 = v3.cross(c0, c1);
      return [[c0[0], c1[0], c2[0]], [c0[1], c1[1], c2[1]], [c0[2], c1[2], c2[2]]];
    },
  };

  // ---------------------------------------------------------------
  // 2D 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 200, view: [0, 1, 0, 1], pad: 6 }, opts);
      this.wrap = h("div", { class: "ch13-stage" });
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
    // 默认两轴等比例（iso）；o.iso === false 时 x、y 各自铺满画布（用于相平面、函数图）
    get sx() { const [x0, x1, y0, y1] = this.view, p = this.o.pad, a = (this.W - 2 * p) / (x1 - x0), b = (this.H - 2 * p) / (y1 - y0); return this.o.iso === false ? a : Math.min(a, b); }
    get sy() { const [x0, x1, y0, y1] = this.view, p = this.o.pad, a = (this.W - 2 * p) / (x1 - x0), b = (this.H - 2 * p) / (y1 - y0); return this.o.iso === false ? b : Math.min(a, b); }
    get scale() { return Math.min(this.sx, this.sy); }
    X(x) { const [x0, x1] = this.view, s = this.sx; return (this.W - (x1 - x0) * s) / 2 + (x - x0) * s; }
    Y(y) { const [, , y0, y1] = this.view, s = this.sy; return (this.H + (y1 - y0) * s) / 2 - (y - y0) * s; }
    inv(px, py) {
      const [x0, x1, y0, y1] = this.view, sx = this.sx, sy = this.sy;
      return { x: (px - (this.W - (x1 - x0) * sx) / 2) / sx + x0, y: ((this.H + (y1 - y0) * sy) / 2 - py) / sy + y0 };
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
        p.px = e.clientX; p.py = e.clientY;
        const d = this.o.onDown(p, e);
        if (d) { this.drag = d; c.setPointerCapture(e.pointerId); e.preventDefault(); }
      });
      c.addEventListener("pointermove", (e) => {
        const p = pos(e);
        p.px = e.clientX; p.py = e.clientY;
        if (this.drag) { if (this.o.onMove) this.o.onMove(p, this.drag, e); }
        else if (this.o.onHover) this.o.onHover(p, e);
        if (this.o.cursor) c.style.cursor = this.drag ? "grabbing" : (this.o.cursor(p) || "default");
      });
      const up = (e) => { if (this.drag) { const d = this.drag; this.drag = null; if (this.o.onUp) this.o.onUp(pos(e), d, e); } };
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      c.addEventListener("pointerleave", (e) => { if (!this.drag && this.o.onLeave) this.o.onLeave(e); });
    }
    // ---- 常用画法（参数都是世界坐标）
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    circle(c, r, stroke, lw, dash, fill) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(c.x), this.Y(c.y), Math.abs(r) * this.scale, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    path(P, color, lw, dash) {
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
    // 箭头：头部大小按像素给
    arrow(a, b, color, lw, head) {
      const ctx = this.ctx, x0 = this.X(a.x), y0 = this.Y(a.y), x1 = this.X(b.x), y1 = this.Y(b.y);
      const L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.5) return;
      const hd = Math.min(head || 9, L * 0.6), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6);
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - ux * hd - uy * hd * 0.45, y1 - uy * hd + ux * hd * 0.45);
      ctx.lineTo(x1 - ux * hd + uy * hd * 0.45, y1 - uy * hd - ux * hd * 0.45);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    frame(col) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      ctx.fillStyle = col.surface; ctx.fillRect(this.X(x0), this.Y(y1), (x1 - x0) * this.sx, (y1 - y0) * this.sy);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, (x1 - x0) * this.sx - 1, (y1 - y0) * this.sy - 1);
    }
    // 背景网格与坐标轴
    grid(col, step, opts) {
      const o = Object.assign({ axes: true, labels: false }, opts);
      const [x0, x1, y0, y1] = this.view;
      for (let g = Math.ceil(x0 / step) * step; g <= x1 + 1e-9; g += step) this.line({ x: g, y: y0 }, { x: g, y: y1 }, col.grid, Math.abs(g) < 1e-9 && o.axes ? 1.4 : 0.7);
      for (let g = Math.ceil(y0 / step) * step; g <= y1 + 1e-9; g += step) this.line({ x: x0, y: g }, { x: x1, y: g }, col.grid, Math.abs(g) < 1e-9 && o.axes ? 1.4 : 0.7);
      if (o.labels) {
        for (let g = Math.ceil(x0 / step) * step; g <= x1 + 1e-9; g += step) if (Math.abs(g) > 1e-9) this.text(+g.toFixed(2) + "", { x: g, y: Math.max(y0, Math.min(y1, 0)) }, col.muted, { size: 10, dy: 8 });
        for (let g = Math.ceil(y0 / step) * step; g <= y1 + 1e-9; g += step) if (Math.abs(g) > 1e-9) this.text(+g.toFixed(2) + "", { x: Math.max(x0, Math.min(x1, 0)), y: g }, col.muted, { size: 10, dx: -10, align: "right" });
      }
    }
    // 向量场的针状图：f(p) 返回 {x,y} 或 null；箭头在像素空间里等长（len = 占格子的比例）
    needles(f, col, color, n, len) {
      const [x0, x1, y0, y1] = this.view, nx = n || 15;
      const ny = Math.max(1, Math.round((nx * (y1 - y0) * this.sy) / ((x1 - x0) * this.sx)));
      const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny, Lpx = (len || 0.42) * Math.min(dx * this.sx, dy * this.sy);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const p = { x: x0 + (i + 0.5) * dx, y: y0 + (j + 0.5) * dy };
        const v = f(p); if (!v) continue;
        const vx = v.x * this.sx, vy = -v.y * this.sy, L = Math.hypot(vx, vy);
        if (L < 1e-12) { this.dot(p, 1.5, color); continue; }
        const px = this.X(p.x), py = this.Y(p.y), ux = (vx / L) * Lpx * 0.5, uy = (vy / L) * Lpx * 0.5;
        this.arrow(this.inv(px - ux, py - uy), this.inv(px + ux, py + uy), color, 1.1, 5);
      }
    }
    // 逐格着色：fn(x, y) 返回 [r, g, b, a(0–255)] 或 null；res = 横向格数
    raster(fn, res) {
      const [x0, x1, y0, y1] = this.view, rx = res, ry = Math.max(1, Math.round((res * (y1 - y0) * this.sy) / ((x1 - x0) * this.sx)));
      const off = document.createElement("canvas"); off.width = rx; off.height = ry;
      const o = off.getContext("2d"), img = o.createImageData(rx, ry);
      for (let j = 0; j < ry; j++) {
        const y = y1 - ((j + 0.5) * (y1 - y0)) / ry;
        for (let i = 0; i < rx; i++) {
          const c = fn(x0 + ((i + 0.5) * (x1 - x0)) / rx, y); if (!c) continue;
          const k = (j * rx + i) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = c[3];
        }
      }
      o.putImageData(img, 0, 0);
      const ctx = this.ctx; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, this.X(x0), this.Y(y1), (x1 - x0) * this.sx, (y1 - y0) * this.sy);
      ctx.imageSmoothingEnabled = true;
    }
  }

  // ---------------------------------------------------------------
  // 简易 3D：正交投影 + 拖动旋转（方位角 az、仰角 el）。世界坐标 z 轴向上。
  // ---------------------------------------------------------------
  class View3D {
    constructor(opts) {
      this.o = Object.assign({ R: 2, az: -0.6, el: 0.45, maxW: 480, aspect: 0.85, onDown: null }, opts);
      this.az = this.o.az; this.el = this.o.el; this.target = [0, 0, 0];
      const R = this.o.R;
      this.st = new Stage({
        view: [-R, R, -R * this.o.aspect, R * this.o.aspect], maxW: this.o.maxW, aspect: this.o.aspect,
        onDraw: (ctx, st, col) => { this.col = col; if (this.o.onDraw) this.o.onDraw(ctx, this, col); },
        onDown: (p, e) => {
          if (this.o.onDown) { const d = this.o.onDown(p, e); if (d) return d; }
          return { rot: true, px: e.clientX, py: e.clientY, az: this.az, el: this.el };
        },
        onMove: (p, d, e) => {
          if (d.rot) {
            this.az = d.az - (e.clientX - d.px) * 0.01;
            this.el = clamp(d.el + (e.clientY - d.py) * 0.01, -1.45, 1.45);
            this.st.draw();
          } else if (this.o.onMove) this.o.onMove(p, d, e);
        },
        onUp: (p, d, e) => { if (!d.rot && this.o.onUp) this.o.onUp(p, d, e); },
        cursor: (p) => (this.o.cursor ? this.o.cursor(p) : null) || "grab",
      });
      this.wrap = this.st.wrap;
    }
    draw() { this.st.draw(); }
    // 返回 {x, y, z}：x,y 是画布世界坐标，z 是朝向观察者的深度（越大越靠前）
    proj(p) {
      const q = [p[0] - this.target[0], p[1] - this.target[1], p[2] - this.target[2]];
      const ca = Math.cos(this.az), sa = Math.sin(this.az), ce = Math.cos(this.el), se = Math.sin(this.el);
      const x1 = ca * q[0] - sa * q[1], y1 = sa * q[0] + ca * q[1];       // 绕 z 轴转 az
      return { x: x1, y: -se * y1 + ce * q[2], z: ce * y1 + se * q[2] };    // 抬起仰角 el
    }
    line(a, b, color, lw, dash) { this.st.line(this.proj(a), this.proj(b), color, lw, dash); }
    path(P, color, lw, dash) { this.st.path(P.map((p) => this.proj(p)), color, lw, dash); }
    poly(P, fill, stroke, lw) { this.st.poly(P.map((p) => this.proj(p)), fill, stroke, lw); }
    dot(p, r, fill, stroke, lw) { this.st.dot(this.proj(p), r, fill, stroke, lw); }
    arrow(a, b, color, lw, head) { this.st.arrow(this.proj(a), this.proj(b), color, lw, head); }
    text(str, p, color, opts) { this.st.text(str, this.proj(p), color, opts); }
    axes(len, col, labels) {
      const L = len || 1, lab = labels || ["x", "y", "z"];
      [[L, 0, 0], [0, L, 0], [0, 0, L]].forEach((e, i) => {
        this.arrow([0, 0, 0], e, col.muted, 1.2, 7);
        this.text(lab[i], v3.mul(e, 1.12), col.muted, { size: 12, weight: 650 });
      });
    }
  }

  // ---------------------------------------------------------------
  // 时间曲线：series = [{data:[[t,y],…], color（颜色键名如 "accent"，或具体颜色）, lw, dash}]
  // ---------------------------------------------------------------
  class TimePlot {
    constructor(opts) {
      this.o = Object.assign({ aspect: 0.42, maxW: 560, xlabel: "t", ylabel: "", yrange: null, xrange: null }, opts);
      this.series = [];
      this.st = new Stage({ aspect: this.o.aspect, maxW: this.o.maxW, view: [0, 1, 0, 1], pad: 0, onDraw: (ctx, st, col) => this.render(ctx, st, col) });
      this.wrap = this.st.wrap;
    }
    set(series, xr, yr) { this.series = series; if (xr) this.o.xrange = xr; if (yr) this.o.yrange = yr; this.st.draw(); }
    render(ctx, st, col) {
      const W = st.W, H = st.H, L = 40, R = 10, T = 10, B = 24;
      let [t0, t1] = this.o.xrange || [0, 1], [y0, y1] = this.o.yrange || [Infinity, -Infinity];
      if (!this.o.xrange) { t0 = Infinity; t1 = -Infinity; this.series.forEach((s) => s.data.forEach(([t]) => { t0 = Math.min(t0, t); t1 = Math.max(t1, t); })); if (!(t1 > t0)) { t0 = 0; t1 = 1; } }
      if (!this.o.yrange) { this.series.forEach((s) => s.data.forEach(([, y]) => { if (isFinite(y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } })); if (!(y1 > y0)) { y0 -= 1; y1 += 1; } const m = (y1 - y0) * 0.08; y0 -= m; y1 += m; }
      const X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R), Y = (y) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
      ctx.fillStyle = col.surface; ctx.fillRect(L, T, W - L - R, H - T - B);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(L + 0.5, T + 0.5, W - L - R - 1, H - T - B - 1);
      ctx.font = `500 10.5px ${getComputedStyle(document.body).fontFamily}`; ctx.fillStyle = col.muted;
      const ticks = (a, b, n) => { const raw = (b - a) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), st_ = [1, 2, 5, 10].map((k) => k * mag).find((k) => k >= raw) || raw; const out = []; for (let v = Math.ceil(a / st_) * st_; v <= b + 1e-9; v += st_) out.push(+v.toFixed(10)); return out; };
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ticks(y0, y1, 4).forEach((v) => { const y = Y(v); ctx.strokeStyle = col.grid; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.fillText(String(+v.toPrecision(3)), L - 4, y); });
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ticks(t0, t1, 6).forEach((v) => { ctx.fillText(String(+v.toPrecision(3)), X(v), H - B + 4); });
      ctx.textAlign = "right"; ctx.fillText(this.o.xlabel, W - R, H - 12);
      if (this.o.ylabel) { ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(this.o.ylabel, L + 4, T + 3); }
      ctx.save(); ctx.beginPath(); ctx.rect(L, T, W - L - R, H - T - B); ctx.clip();
      for (const s of this.series) {
        if (s.data.length < 2) continue;
        ctx.beginPath(); s.data.forEach(([t, y], i) => (i ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y))));
        ctx.strokeStyle = col[s.color] || s.color; ctx.lineWidth = s.lw || 1.6; ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
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
    const lab = h("label", null, cb, label); lab.input = cb; return lab;
  }
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; el.label = (t) => { el.querySelector(".k").textContent = t; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }
  // 按住才生效的按钮（触屏友好）
  function holdButton(text, onDown, onUp, cls) {
    const b = h("button", { type: "button", class: "btn " + (cls || "") }, text);
    const up = () => { b.classList.remove("active"); onUp(); };
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add("active"); onDown(); });
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    return b;
  }
  // 键盘：组件根节点可聚焦，按下的键记在 set 里
  function keys(root, watch) {
    const down = new Set();
    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", (e) => { if (watch.includes(e.key)) { down.add(e.key); e.preventDefault(); } });
    root.addEventListener("keyup", (e) => { down.delete(e.key); });
    root.addEventListener("blur", () => down.clear());
    return down;
  }

  // 动画循环：step(dt 秒) 返回 false 时停止；组件滚出视野时自动暂停、回来后继续
  class Runner {
    constructor(root, step, onStop) {
      this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; this.visible = true; this.last = 0;
      if (root && "IntersectionObserver" in window) {
        new IntersectionObserver((es) => es.forEach((e) => { this.visible = e.isIntersecting; if (this.visible && this.running && !this.raf) this.loop(); })).observe(root);
      }
    }
    loop() {
      this.last = 0;
      const tick = (ts) => {
        this.raf = 0;
        if (!this.running) return;
        if (!this.visible) return;           // 暂停，等重新可见
        const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 1 / 60;
        this.last = ts;
        if (this.step(dt) === false) { this.stop(); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    start() { if (this.running) return; this.running = true; this.loop(); }
    stop() { if (!this.running) return; this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; if (this.onStop) this.onStop(); }
    toggle() { if (this.running) this.stop(); else this.start(); }
  }

  // ---------------------------------------------------------------
  // 车辆画法（世界坐标，原点 = 后轴中心，θ = 车身朝向）
  // ---------------------------------------------------------------
  // 把车身坐标系里的点 (bx, by) 变到世界
  const body2w = (x, y, th, bx, by) => ({ x: x + bx * Math.cos(th) - by * Math.sin(th), y: y + bx * Math.sin(th) + by * Math.cos(th) });
  function wheel(st, x, y, th, bx, by, ang, len, wid, color) {
    const c = body2w(x, y, th, bx, by), a = th + ang, ca = Math.cos(a), sa = Math.sin(a);
    const P = [[-len / 2, -wid / 2], [len / 2, -wid / 2], [len / 2, wid / 2], [-len / 2, wid / 2]].map(([u, v]) => ({ x: c.x + u * ca - v * sa, y: c.y + u * sa + v * ca }));
    st.poly(P, color, null);
  }
  // 简单车（图 13.1）：L = 轴距，W = 车宽
  function drawCar(st, s, col, o) {
    o = Object.assign({ L: 1, W: 0.55, phi: 0, body: col.accent, fill: null, wheels: col.text, axle: true, lw: 1.6 }, o);
    const [x, y, th] = s, L = o.L, W = o.W, ov = 0.22 * L;
    const P = [[-ov, -W / 2], [L + ov, -W / 2], [L + ov, W / 2], [-ov, W / 2]].map(([u, v]) => body2w(x, y, th, u, v));
    st.poly(P, o.fill || alpha(o.body, 0.16), o.body, o.lw);
    const wl = 0.34 * L, ww = 0.11 * L;
    wheel(st, x, y, th, 0, W / 2 - ww * 0.2, 0, wl, ww, o.wheels);
    wheel(st, x, y, th, 0, -W / 2 + ww * 0.2, 0, wl, ww, o.wheels);
    wheel(st, x, y, th, L, W / 2 - ww * 0.2, o.phi, wl, ww, o.wheels);
    wheel(st, x, y, th, L, -W / 2 + ww * 0.2, o.phi, wl, ww, o.wheels);
    if (o.axle) { st.line(body2w(x, y, th, 0, -W / 2), body2w(x, y, th, 0, W / 2), o.wheels, 1); st.dot({ x, y }, 3.2, o.body, col.surface, 1.2); }
  }
  // 差速驱动（图 13.2b）：原点 = 两轮轴中心，L = 两轮间距，r = 轮半径
  function drawDiffDrive(st, s, col, o) {
    o = Object.assign({ L: 0.5, r: 0.1, body: col.accent, wheels: col.text, lw: 1.6 }, o);
    const [x, y, th] = s, L = o.L;
    const P = [[-0.35 * L, -0.42 * L], [0.12 * L, -0.42 * L], [0.38 * L, -0.2 * L], [0.38 * L, 0.2 * L], [0.12 * L, 0.42 * L], [-0.35 * L, 0.42 * L]].map(([u, v]) => body2w(x, y, th, u, v));
    st.poly(P, alpha(o.body, 0.16), o.body, o.lw);
    wheel(st, x, y, th, 0, L / 2, 0, 2 * o.r, 0.06 * L + 0.02, o.wheels);
    wheel(st, x, y, th, 0, -L / 2, 0, 2 * o.r, 0.06 * L + 0.02, o.wheels);
    st.line(body2w(x, y, th, 0, -L / 2), body2w(x, y, th, 0, L / 2), o.wheels, 1);
    st.dot({ x, y }, 3, o.body, col.surface, 1.2);
    st.arrow(body2w(x, y, th, 0, 0), body2w(x, y, th, 0.32 * L, 0), o.body, 1.4, 6);
  }

  window.CH13 = {
    colors, alpha, rgb, mix, cv, cva, rng, gauss, clamp, wrap, deg, rad, rk4, v3, m3,
    Stage, View3D, TimePlot, frame, seg, slider, select, check, stat, button, legend, holdButton, keys, Runner,
    body2w, wheel, drawCar, drawDiffDrive,
  };
})();
