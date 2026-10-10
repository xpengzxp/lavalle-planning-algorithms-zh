/* 第 15 章共用小库：画布舞台、控件、数值积分、线性代数、热图与等值线、3D 投影、
   Dubins / Reeds–Shepp 求解（与 part4/code/ch15_system_theory.py 同一套公式）、车辆绘制 */
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
  // 两种颜色按 t∈[0,1] 混合，返回 [r,g,b]
  function mixRGB(c1, c2, t) { const a = rgb(c1), b = rgb(c2); return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)); }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;

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

  const TAU = 2 * Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 角度规范到 (−π, π]
  const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // stretch: true 时 x、y 方向各自缩放（画函数图用）
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 220, view: [0, 1, 0, 1], pad: 6, stretch: false }, opts);
      this.wrap = h("div", { class: "ch15-stage" });
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
    get sx() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; const a = (this.W - 2 * p) / (x1 - x0); return this.o.stretch ? a : Math.min(a, (this.H - 2 * p) / (y1 - y0)); }
    get sy() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; const b = (this.H - 2 * p) / (y1 - y0); return this.o.stretch ? b : Math.min((this.W - 2 * p) / (x1 - x0), b); }
    get scale() { return this.sx; }
    X(x) { const [x0, x1] = this.view; return (this.W - (x1 - x0) * this.sx) / 2 + (x - x0) * this.sx; }
    Y(y) { const [, , y0, y1] = this.view; return (this.H + (y1 - y0) * this.sy) / 2 - (y - y0) * this.sy; }
    inv(px, py) {
      const [x0, x1, y0, y1] = this.view;
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
    // 常用画法（坐标都是世界坐标）
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
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    circle(c, r, stroke, lw, fill, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.ellipse(this.X(c.x), this.Y(c.y), Math.abs(r * this.sx), Math.abs(r * this.sy), 0, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    // 箭头：从 a 到 b（世界坐标），头部大小以像素计
    arrow(a, b, color, lw, head) {
      const ctx = this.ctx, X0 = this.X(a.x), Y0 = this.Y(a.y), X1 = this.X(b.x), Y1 = this.Y(b.y);
      const L = Math.hypot(X1 - X0, Y1 - Y0); if (L < 0.5) return;
      const hd = Math.min(head || 8, L * 0.6), ux = (X1 - X0) / L, uy = (Y1 - Y0) / L;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 1.5;
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1 - ux * hd * 0.7, Y1 - uy * hd * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X1 - ux * hd - uy * hd * 0.45, Y1 - uy * hd + ux * hd * 0.45);
      ctx.lineTo(X1 - ux * hd + uy * hd * 0.45, Y1 - uy * hd - ux * hd * 0.45); ctx.closePath(); ctx.fill();
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    frame(col, fill) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      ctx.fillStyle = fill || col.surface; ctx.fillRect(this.X(x0), this.Y(y1), (x1 - x0) * this.sx, (y1 - y0) * this.sy);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, (x1 - x0) * this.sx - 1, (y1 - y0) * this.sy - 1);
    }
    // 网格线与坐标轴
    grid(col, step, opts) {
      const o = Object.assign({ axes: true, labels: false, fmt: (v) => String(+v.toFixed(2)) }, opts);
      const [x0, x1, y0, y1] = this.view;
      for (let g = Math.ceil(x0 / step) * step; g <= x1 + 1e-9; g += step) {
        const ax = Math.abs(g) < 1e-9 && o.axes;
        this.line({ x: g, y: y0 }, { x: g, y: y1 }, ax ? col.strong : col.grid, ax ? 1.3 : 0.7);
        if (o.labels && !ax) this.text(o.fmt(g), { x: g, y: y0 }, col.muted, { size: 10, dy: -7 });
      }
      for (let g = Math.ceil(y0 / step) * step; g <= y1 + 1e-9; g += step) {
        const ax = Math.abs(g) < 1e-9 && o.axes;
        this.line({ x: x0, y: g }, { x: x1, y: g }, ax ? col.strong : col.grid, ax ? 1.3 : 0.7);
        if (o.labels && !ax) this.text(o.fmt(g), { x: x0, y: g }, col.muted, { size: 10, dx: 4, align: "left" });
      }
    }
    qmark(p, kind, col, label) {
      const c = kind === "I" ? col.start : col.goal;
      this.dot(p, 6.5, c, col.surface, 2);
      this.text(label || (kind === "I" ? "x_I" : "x_G"), p, c, { dy: -14, size: 12, weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 函数图：横轴 t、纵轴取值，x、y 方向各自缩放
  // series: [{pts:[[t,v],...], color, lw, dash, label}]
  // ---------------------------------------------------------------
  class Plot {
    constructor(opts) {
      this.o = Object.assign({ aspect: 0.42, maxW: 560, xlab: "t", ylab: "", series: [], xlim: [0, 1], ylim: [-1, 1], marks: [] }, opts);
      this.st = new Stage({ aspect: this.o.aspect, maxW: this.o.maxW, stretch: true, pad: 0, view: this.view(), onDraw: (ctx, st, col) => this.render(ctx, st, col),
        onHover: this.o.onHover, onLeave: this.o.onLeave, onDown: this.o.onDown, onMove: this.o.onMove });
      this.wrap = this.st.wrap;
    }
    view() { const [a, b] = this.o.xlim, [c, d] = this.o.ylim; const dx = (b - a) * 0.09, dy = (d - c) * 0.14; return [a - dx, b + dx * 0.4, c - dy, d + dy]; }
    set(o) { Object.assign(this.o, o); this.st.setView(this.view()); this.st.draw(); }
    render(ctx, st, col) {
      const [a, b] = this.o.xlim, [c, d] = this.o.ylim;
      st.poly([{ x: a, y: c }, { x: b, y: c }, { x: b, y: d }, { x: a, y: d }], col.surface, col.border, 1);
      if (c < 0 && d > 0) st.line({ x: a, y: 0 }, { x: b, y: 0 }, col.strong, 1);
      for (const m of this.o.marks) {
        if (m.x !== undefined) st.line({ x: m.x, y: c }, { x: m.x, y: d }, m.color || col.muted, 1, m.dash || [4, 3]);
        if (m.y !== undefined) st.line({ x: a, y: m.y }, { x: b, y: m.y }, m.color || col.muted, 1, m.dash || [4, 3]);
        if (m.label) st.text(m.label, { x: m.x !== undefined ? m.x : b, y: m.y !== undefined ? m.y : d }, m.color || col.muted, { size: 10.5, dy: m.y !== undefined ? -8 : 8, dx: m.x !== undefined ? 4 : -4, align: m.x !== undefined ? "left" : "right" });
      }
      ctx.save(); ctx.beginPath(); ctx.rect(st.X(a), st.Y(d), (b - a) * st.sx, (d - c) * st.sy); ctx.clip();
      for (const s of this.o.series) {
        if (!s.pts || s.pts.length < 2) continue;
        ctx.beginPath(); let started = false;
        for (const [t, v] of s.pts) {
          if (!isFinite(v)) { started = false; continue; }
          const X = st.X(t), Y = st.Y(v);
          if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
        }
        ctx.strokeStyle = s.ckey ? col[s.ckey] : (s.color || col.accent); ctx.lineWidth = s.lw || 1.8; ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
      const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : +v.toFixed(2) + "");
      st.text(fmt(a), { x: a, y: c }, col.muted, { size: 10, dy: 9 });
      st.text(fmt(b), { x: b, y: c }, col.muted, { size: 10, dy: 9 });
      st.text(this.o.xlab, { x: (a + b) / 2, y: c }, col.muted, { size: 10.5, dy: 10 });
      st.text(fmt(d), { x: a, y: d }, col.muted, { size: 10, dx: -4, align: "right" });
      st.text(fmt(c), { x: a, y: c }, col.muted, { size: 10, dx: -4, align: "right" });
      if (this.o.ylab) st.text(this.o.ylab, { x: a, y: (c + d) / 2 }, col.muted, { size: 10.5, dx: -5, align: "right" });
      let lx = a + (b - a) * 0.02;
      for (const s of this.o.series) if (s.label) {
        st.text(s.label, { x: lx, y: d }, s.ckey ? col[s.ckey] : (s.color || col.accent), { size: 11, dy: 9, align: "left", weight: 650 });
        lx += (b - a) * (0.03 + 0.016 * s.label.length);
      }
      if (this.o.extra) this.o.extra(ctx, st, col);
    }
    draw() { this.st.draw(); }
  }

  // ---------------------------------------------------------------
  // 组件外框与小控件（与前几章一致）
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
  function toggle(text, on, onChange) {
    const b = h("button", { type: "button", class: "chip" + (on ? " on" : "") }, text);
    b.addEventListener("click", () => { on = !on; b.classList.toggle("on", on); onChange(on); });
    b.set = (v) => { on = v; b.classList.toggle("on", on); };
    return b;
  }
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; el.key = (x) => { el.querySelector(".k").textContent = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // ---------------------------------------------------------------
  // 数值积分（RK4）。f(t, x) 返回导数数组
  // ---------------------------------------------------------------
  function rk4Step(f, t, x, dt) {
    const n = x.length;
    const k1 = f(t, x);
    const x2 = new Array(n); for (let i = 0; i < n; i++) x2[i] = x[i] + dt / 2 * k1[i];
    const k2 = f(t + dt / 2, x2);
    for (let i = 0; i < n; i++) x2[i] = x[i] + dt / 2 * k2[i];
    const k3 = f(t + dt / 2, x2);
    for (let i = 0; i < n; i++) x2[i] = x[i] + dt * k3[i];
    const k4 = f(t + dt, x2);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = x[i] + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return out;
  }
  // 积分到 T，返回轨迹（每 every 步记一个点）；stop(x) 为真时提前停止
  function integrate(f, x0, T, n, every, stop) {
    const dt = T / n, out = [{ t: 0, x: x0.slice() }];
    let x = x0.slice(), t = 0;
    for (let k = 1; k <= n; k++) {
      x = rk4Step(f, t, x, dt); t += dt;
      if (!x.every(isFinite)) break;
      if (k % (every || 1) === 0 || k === n) out.push({ t, x: x.slice() });
      if (stop && stop(x, t)) { if (out[out.length - 1].t !== t) out.push({ t, x: x.slice() }); break; }
    }
    return out;
  }

  // ---------------------------------------------------------------
  // 小型线性代数
  // ---------------------------------------------------------------
  const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const matvec = (A, v) => A.map((r) => r.reduce((s, a, k) => s + a * v[k], 0));
  const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  function rank(M, tol) {
    tol = tol === undefined ? 1e-9 : tol;
    const A = M.map((r) => r.slice()); const rows = A.length, cols = A[0].length; let r = 0;
    // 用相对容差：按最大元素缩放
    let mx = 0; for (const row of A) for (const v of row) mx = Math.max(mx, Math.abs(v));
    const eps = tol * Math.max(1, mx);
    for (let c = 0; c < cols && r < rows; c++) {
      let piv = r; for (let i = r + 1; i < rows; i++) if (Math.abs(A[i][c]) > Math.abs(A[piv][c])) piv = i;
      if (Math.abs(A[piv][c]) < eps) continue;
      [A[r], A[piv]] = [A[piv], A[r]];
      for (let i = 0; i < rows; i++) if (i !== r) { const f = A[i][c] / A[r][c]; for (let j = c; j < cols; j++) A[i][j] -= f * A[r][j]; }
      r++;
    }
    return r;
  }
  function det(M) {
    const A = M.map((r) => r.slice()); const n = A.length; let d = 1;
    for (let c = 0; c < n; c++) {
      let piv = c; for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[piv][c])) piv = i;
      if (Math.abs(A[piv][c]) < 1e-15) return 0;
      if (piv !== c) { [A[c], A[piv]] = [A[piv], A[c]]; d = -d; }
      d *= A[c][c];
      for (let i = c + 1; i < n; i++) { const f = A[i][c] / A[c][c]; for (let j = c; j < n; j++) A[i][j] -= f * A[c][j]; }
    }
    return d;
  }
  // 2×2 特征值：[{re, im}, {re, im}]
  function eig2(A) {
    const tr = A[0][0] + A[1][1], dt = A[0][0] * A[1][1] - A[0][1] * A[1][0], disc = tr * tr / 4 - dt;
    if (disc >= 0) { const s = Math.sqrt(disc); return [{ re: tr / 2 + s, im: 0 }, { re: tr / 2 - s, im: 0 }]; }
    const s = Math.sqrt(-disc); return [{ re: tr / 2, im: s }, { re: tr / 2, im: -s }];
  }

  // ---------------------------------------------------------------
  // 网格采样、热图、等值线（marching squares）
  // ---------------------------------------------------------------
  function sampleGrid(fn, nx, ny, view) {
    const [x0, x1, y0, y1] = view, v = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = fn(x0 + (x1 - x0) * i / (nx - 1), y0 + (y1 - y0) * j / (ny - 1));
    return { nx, ny, v, view };
  }
  // colorFn(value, i, j) → [r,g,b,a] 或 null（透明）
  function drawHeat(st, G, colorFn) {
    const { nx, ny, v, view } = G;
    const off = document.createElement("canvas"); off.width = nx; off.height = ny;
    const octx = off.getContext("2d"), img = octx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = colorFn(v[j * nx + i], i, j), o = ((ny - 1 - j) * nx + i) * 4;
      if (!c) { img.data[o + 3] = 0; continue; }
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c.length > 3 ? c[3] : 255;
    }
    octx.putImageData(img, 0, 0);
    const [x0, x1, y0, y1] = view, dx = (x1 - x0) / (nx - 1) / 2, dy = (y1 - y0) / (ny - 1) / 2;
    const ctx = st.ctx; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, st.X(x0 - dx), st.Y(y1 + dy), (x1 - x0 + 2 * dx) * st.sx, (y1 - y0 + 2 * dy) * st.sy);
  }
  function contourSegs(G, level) {
    const { nx, ny, v, view } = G, [x0, x1, y0, y1] = view, segs = [];
    const X = (i) => x0 + (x1 - x0) * i / (nx - 1), Y = (j) => y0 + (y1 - y0) * j / (ny - 1);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
      if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;
      const pts = [];
      const e = (p, q, P, Q) => { if ((p < level) !== (q < level)) { const t = (level - p) / (q - p); pts.push({ x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t }); } };
      const A = { x: X(i), y: Y(j) }, B = { x: X(i + 1), y: Y(j) }, Cc = { x: X(i + 1), y: Y(j + 1) }, D = { x: X(i), y: Y(j + 1) };
      e(a, b, A, B); e(b, c, B, Cc); e(c, d, Cc, D); e(d, a, D, A);
      if (pts.length === 2) segs.push(pts);
      else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
    }
    return segs;
  }
  function drawContours(st, G, levels, color, lw, maxJump) {
    const ctx = st.ctx; ctx.strokeStyle = color; ctx.lineWidth = lw || 1;
    const { nx, ny, v, view } = G, [x0, x1, y0, y1] = view, cell = Math.hypot((x1 - x0) / (nx - 1), (y1 - y0) / (ny - 1));
    ctx.beginPath();
    for (const L of levels) for (const [p, q] of contourSegs(G, L)) {
      if (maxJump && Math.hypot(p.x - q.x, p.y - q.y) > cell * 1.5) continue;
      ctx.moveTo(st.X(p.x), st.Y(p.y)); ctx.lineTo(st.X(q.x), st.Y(q.y));
    }
    ctx.stroke();
  }

  // ---------------------------------------------------------------
  // 极简 3D：绕 z 轴偏航 yaw、俯仰 pitch 的正交投影
  // ---------------------------------------------------------------
  class View3D {
    constructor(yaw, pitch) { this.yaw = yaw; this.pitch = pitch; }
    proj(p) {
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const x1 = cy * p[0] - sy * p[1], y1 = sy * p[0] + cy * p[1];
      return { x: x1, y: sp * y1 + cp * p[2], depth: cp * y1 - sp * p[2] };
    }
  }

  // ---------------------------------------------------------------
  // Dubins 曲线（15.3.1 节）：6 个词，参数 (α, β 或 d, γ)，d 以 ρ 为单位
  // ---------------------------------------------------------------
  const mod2piPos = (x) => x - TAU * Math.floor(x / TAU);
  function dubinsWords(q0, q1, rho) {
    rho = rho || 1;
    const dx = q1.x - q0.x, dy = q1.y - q0.y, D = Math.hypot(dx, dy), d = D / rho;
    const th = D > 1e-12 ? mod2piPos(Math.atan2(dy, dx)) : 0;
    const a = mod2piPos(q0.th - th), b = mod2piPos(q1.th - th);
    const sa = Math.sin(a), sb = Math.sin(b), ca = Math.cos(a), cb = Math.cos(b), cab = Math.cos(a - b);
    const eps = 1e-10, sq = (v) => Math.sqrt(Math.max(0, v)), out = {};
    let p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
    if (p2 >= -eps) { const t1 = Math.atan2(cb - ca, d + sa - sb); out.LSL = [mod2piPos(-a + t1), sq(p2), mod2piPos(b - t1)]; }
    p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
    if (p2 >= -eps) { const t1 = Math.atan2(ca - cb, d - sa + sb); out.RSR = [mod2piPos(a - t1), sq(p2), mod2piPos(-b + t1)]; }
    p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
    if (p2 >= -eps) { const p = sq(p2), t2 = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p); out.LSR = [mod2piPos(-a + t2), p, mod2piPos(-b + t2)]; }
    p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb);
    if (p2 >= -eps) { const p = sq(p2), t2 = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p); out.RSL = [mod2piPos(a - t2), p, mod2piPos(b - t2)]; }
    let tmp = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
    if (Math.abs(tmp) <= 1 + eps) { const p = mod2piPos(TAU - Math.acos(clamp(tmp, -1, 1))), t = mod2piPos(a - Math.atan2(ca - cb, d - sa + sb) + p / 2); out.RLR = [t, p, mod2piPos(a - b - t + p)]; }
    tmp = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8;
    if (Math.abs(tmp) <= 1 + eps) { const p = mod2piPos(TAU - Math.acos(clamp(tmp, -1, 1))), t = mod2piPos(-a - Math.atan2(ca - cb, d + sa - sb) + p / 2); out.LRL = [t, p, mod2piPos(b - a - t + p)]; }
    return out;
  }
  function dubinsBest(q0, q1, rho) {
    rho = rho || 1;
    const W = dubinsWords(q0, q1, rho); let best = null;
    for (const [w, p] of Object.entries(W)) { const L = rho * (p[0] + p[1] + p[2]); if (!best || L < best.len) best = { word: w, segs: p, len: L }; }
    return best;
  }

  // ---------------------------------------------------------------
  // Reeds–Shepp 曲线（15.3.2 节）：公式编号沿用 Reeds & Shepp 原文，实现方式参照 OMPL；
  // 局部坐标下（起点在原点朝 +x，ρ = 1）返回所有候选 {word, segs}，segs 带符号（负 = 倒车）
  // ---------------------------------------------------------------
  const RS_ZERO = 1e-9;
  const mod2pi = (x) => { let v = x % TAU; if (v < -Math.PI) v += TAU; else if (v > Math.PI) v -= TAU; return v; };
  const polar = (x, y) => [Math.hypot(x, y), Math.atan2(y, x)];
  function tauOmega(u, v, xi, eta, phi) {
    const delta = mod2pi(u - v), A = Math.sin(u) - Math.sin(delta), B = Math.cos(u) - Math.cos(delta) - 1;
    const t1 = Math.atan2(eta * A - xi * B, xi * A + eta * B), t2 = 2 * (Math.cos(delta) - Math.cos(v) - Math.cos(u)) + 3;
    const tau = t2 < 0 ? mod2pi(t1 + Math.PI) : mod2pi(t1);
    return [tau, mod2pi(tau - u + v - phi)];
  }
  function LpSpLp(x, y, phi) { const [u, t] = polar(x - Math.sin(phi), y - 1 + Math.cos(phi)); if (t >= -RS_ZERO) { const v = mod2pi(phi - t); if (v >= -RS_ZERO) return [t, u, v]; } return null; }
  function LpSpRp(x, y, phi) {
    let [u1, t1] = polar(x + Math.sin(phi), y - 1 - Math.cos(phi)); u1 *= u1;
    if (u1 >= 4) { const u = Math.sqrt(u1 - 4), t = mod2pi(t1 + Math.atan2(2, u)), v = mod2pi(t - phi); if (t >= -RS_ZERO && v >= -RS_ZERO) return [t, u, v]; }
    return null;
  }
  function LpRmL(x, y, phi) {
    const xi = x - Math.sin(phi), eta = y - 1 + Math.cos(phi), [u1, theta] = polar(xi, eta);
    if (u1 <= 4) { const u = -2 * Math.asin(0.25 * u1), t = mod2pi(theta + 0.5 * u + Math.PI), v = mod2pi(phi - t + u); if (t >= -RS_ZERO && u <= RS_ZERO) return [t, u, v]; }
    return null;
  }
  function LpRupLumRm(x, y, phi) {
    const xi = x + Math.sin(phi), eta = y - 1 - Math.cos(phi), rho = 0.25 * (2 + Math.hypot(xi, eta));
    if (rho <= 1) { const u = Math.acos(rho), [t, v] = tauOmega(u, -u, xi, eta, phi); if (t >= -RS_ZERO && v <= RS_ZERO) return [t, u, v]; }
    return null;
  }
  function LpRumLumRp(x, y, phi) {
    const xi = x + Math.sin(phi), eta = y - 1 - Math.cos(phi), rho = (20 - xi * xi - eta * eta) / 16;
    if (rho >= 0 && rho <= 1) { const u = -Math.acos(rho); if (u >= -0.5 * Math.PI) { const [t, v] = tauOmega(u, u, xi, eta, phi); if (t >= -RS_ZERO && v >= -RS_ZERO) return [t, u, v]; } }
    return null;
  }
  function LpRmSmLm(x, y, phi) {
    const xi = x - Math.sin(phi), eta = y - 1 + Math.cos(phi), [rho, theta] = polar(xi, eta);
    if (rho >= 2) { const r = Math.sqrt(rho * rho - 4), u = 2 - r, t = mod2pi(theta + Math.atan2(r, -2)), v = mod2pi(phi - 0.5 * Math.PI - t); if (t >= -RS_ZERO && u <= RS_ZERO && v <= RS_ZERO) return [t, u, v]; }
    return null;
  }
  function LpRmSmRm(x, y, phi) {
    const xi = x + Math.sin(phi), eta = y - 1 - Math.cos(phi), [rho, theta] = polar(-eta, xi);
    if (rho >= 2) { const t = theta, u = 2 - rho, v = mod2pi(t + 0.5 * Math.PI - phi); if (t >= -RS_ZERO && u <= RS_ZERO && v <= RS_ZERO) return [t, u, v]; }
    return null;
  }
  function LpRmSLmRp(x, y, phi) {
    const xi = x + Math.sin(phi), eta = y - 1 - Math.cos(phi), [rho] = polar(xi, eta);
    if (rho >= 2) { const u = 4 - Math.sqrt(rho * rho - 4); if (u <= RS_ZERO) { const t = mod2pi(Math.atan2((4 - u) * xi - 2 * eta, -2 * xi + (u - 4) * eta)), v = mod2pi(t - phi); if (t >= -RS_ZERO && v >= -RS_ZERO) return [t, u, v]; } }
    return null;
  }
  const RS_TYPES = ["LRL", "RLR", "LRLR", "RLRL", "LRSL", "RLSR", "LSRL", "RSLR", "LRSR", "RLSL", "RSRL", "LSLR", "LSR", "RSL", "LSL", "RSR", "LRSLR", "RLSRL"];
  function rsCandidatesLocal(x, y, phi) {
    const out = [], add = (tp, segs) => out.push({ word: RS_TYPES[tp], segs: segs.slice() }), neg = (r) => [-r[0], -r[1], -r[2]];
    const xb = x * Math.cos(phi) + y * Math.sin(phi), yb = x * Math.sin(phi) - y * Math.cos(phi);
    let r;
    for (const [f, ta, tb] of [[LpSpLp, 14, 15], [LpSpRp, 12, 13]]) {
      if ((r = f(x, y, phi))) add(ta, r);
      if ((r = f(-x, y, -phi))) add(ta, neg(r));
      if ((r = f(x, -y, -phi))) add(tb, r);
      if ((r = f(-x, -y, phi))) add(tb, neg(r));
    }
    if ((r = LpRmL(x, y, phi))) add(0, r);
    if ((r = LpRmL(-x, y, -phi))) add(0, neg(r));
    if ((r = LpRmL(x, -y, -phi))) add(1, r);
    if ((r = LpRmL(-x, -y, phi))) add(1, neg(r));
    if ((r = LpRmL(xb, yb, phi))) add(0, [r[2], r[1], r[0]]);
    if ((r = LpRmL(-xb, yb, -phi))) add(0, [-r[2], -r[1], -r[0]]);
    if ((r = LpRmL(xb, -yb, -phi))) add(1, [r[2], r[1], r[0]]);
    if ((r = LpRmL(-xb, -yb, phi))) add(1, [-r[2], -r[1], -r[0]]);
    if ((r = LpRupLumRm(x, y, phi))) add(2, [r[0], r[1], -r[1], r[2]]);
    if ((r = LpRupLumRm(-x, y, -phi))) add(2, [-r[0], -r[1], r[1], -r[2]]);
    if ((r = LpRupLumRm(x, -y, -phi))) add(3, [r[0], r[1], -r[1], r[2]]);
    if ((r = LpRupLumRm(-x, -y, phi))) add(3, [-r[0], -r[1], r[1], -r[2]]);
    if ((r = LpRumLumRp(x, y, phi))) add(2, [r[0], r[1], r[1], r[2]]);
    if ((r = LpRumLumRp(-x, y, -phi))) add(2, [-r[0], -r[1], -r[1], -r[2]]);
    if ((r = LpRumLumRp(x, -y, -phi))) add(3, [r[0], r[1], r[1], r[2]]);
    if ((r = LpRumLumRp(-x, -y, phi))) add(3, [-r[0], -r[1], -r[1], -r[2]]);
    const hp = 0.5 * Math.PI;
    for (const [f, ta, tb, tc, td] of [[LpRmSmLm, 4, 5, 6, 7], [LpRmSmRm, 8, 9, 10, 11]]) {
      if ((r = f(x, y, phi))) add(ta, [r[0], -hp, r[1], r[2]]);
      if ((r = f(-x, y, -phi))) add(ta, [-r[0], hp, -r[1], -r[2]]);
      if ((r = f(x, -y, -phi))) add(tb, [r[0], -hp, r[1], r[2]]);
      if ((r = f(-x, -y, phi))) add(tb, [-r[0], hp, -r[1], -r[2]]);
      if ((r = f(xb, yb, phi))) add(tc, [r[2], r[1], -hp, r[0]]);
      if ((r = f(-xb, yb, -phi))) add(tc, [-r[2], -r[1], hp, -r[0]]);
      if ((r = f(xb, -yb, -phi))) add(td, [r[2], r[1], -hp, r[0]]);
      if ((r = f(-xb, -yb, phi))) add(td, [-r[2], -r[1], hp, -r[0]]);
    }
    if ((r = LpRmSLmRp(x, y, phi))) add(16, [r[0], -hp, r[1], -hp, r[2]]);
    if ((r = LpRmSLmRp(-x, y, -phi))) add(16, [-r[0], hp, -r[1], hp, -r[2]]);
    if ((r = LpRmSLmRp(x, -y, -phi))) add(17, [r[0], -hp, r[1], -hp, r[2]]);
    if ((r = LpRmSLmRp(-x, -y, phi))) add(17, [-r[0], hp, -r[1], hp, -r[2]]);
    return out;
  }
  // 世界坐标下的全部候选（长度已乘 ρ），按长度排序
  function rsCandidates(q0, q1, rho) {
    rho = rho || 1;
    const dx = q1.x - q0.x, dy = q1.y - q0.y, c = Math.cos(q0.th), s = Math.sin(q0.th);
    const cands = rsCandidatesLocal((c * dx + s * dy) / rho, (-s * dx + c * dy) / rho, q1.th - q0.th);
    for (const k of cands) k.len = rho * k.segs.reduce((a, v) => a + Math.abs(v), 0);
    cands.sort((a, b) => a.len - b.len);
    return cands;
  }
  function rsBest(q0, q1, rho) { const c = rsCandidates(q0, q1, rho); return c.length ? c[0] : null; }
  // 书中写法：L+ R− …（零长度段省略）；带 π/2 的段标出来
  function bookWord(word, segs, withSub) {
    const parts = [];
    for (let i = 0; i < word.length; i++) {
      const v = segs[i]; if (Math.abs(v) < 1e-9) continue;
      let sub = "";
      if (withSub && word[i] !== "S" && Math.abs(Math.abs(v) - Math.PI / 2) < 1e-9 && word.length >= 4) sub = "π/2";
      parts.push(word[i] + (v > 0 ? "⁺" : "⁻") + (sub ? `<sub>${sub}</sub>` : ""));
    }
    return parts.join(" ");
  }
  // 书中图 15.10 的「基本词」：由字母与正负号判断
  function rsBase(word, segs) {
    const sg = segs.map((v) => (v >= 0 ? 1 : -1)), n = word.length, hasS = word.includes("S");
    const cusp = (i) => sg[i] !== sg[i + 1];
    if (n === 3 && !hasS) {
      const a = cusp(0), b = cusp(1);
      return a && b ? "C|C|C" : !a && b ? "CC|C" : a && !b ? "C|CC" : "CCC";
    }
    if (n === 3) return "CSC";
    if (n === 4 && !hasS) return cusp(1) && !cusp(0) ? "CCβ|CβC" : "C|CβCβ|C";
    if (n === 4 && word[2] === "S") return "C|Cπ/2SC";
    if (n === 4 && word[1] === "S") return "CSCπ/2|C";
    return "C|Cπ/2SCπ/2|C";
  }

  // ---------------------------------------------------------------
  // 沿词积分与采样（ρ 为最小转弯半径；L、R 的段长是转过的角度，S 的段长以 ρ 为单位）
  // ---------------------------------------------------------------
  function stepSeg(q, ch, v, rho) {
    rho = rho || 1;
    const { x, y, th } = q;
    if (ch === "S") return { x: x + rho * v * Math.cos(th), y: y + rho * v * Math.sin(th), th };
    if (ch === "L") return { x: x + rho * (Math.sin(th + v) - Math.sin(th)), y: y + rho * (-Math.cos(th + v) + Math.cos(th)), th: th + v };
    return { x: x + rho * (-Math.sin(th - v) + Math.sin(th)), y: y + rho * (Math.cos(th - v) - Math.cos(th)), th: th - v };
  }
  function follow(q, word, segs, rho) { let p = { ...q }; for (let i = 0; i < word.length; i++) p = stepSeg(p, word[i], segs[i], rho); return p; }
  // 返回 [{x,y,th,seg,dir,s}]，s 是累计路程（世界单位）
  function samplePath(q, word, segs, rho, step) {
    rho = rho || 1; step = step || 0.03;
    const out = [{ ...q, seg: 0, dir: Math.sign(segs[0]) || 1, s: 0 }]; let p = { ...q }, s = 0;
    for (let i = 0; i < word.length; i++) {
      const v = segs[i], L = Math.abs(v) * rho; if (L < 1e-12) continue;
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = 1; k <= n; k++) { const pk = stepSeg(p, word[i], v * k / n, rho); out.push({ ...pk, seg: i, dir: Math.sign(v), s: s + L * k / n }); }
      p = stepSeg(p, word[i], v, rho); s += L;
    }
    return out;
  }

  // ---------------------------------------------------------------
  // 画车：q = {x,y,th}，参考点是后轴中心（与 13.1.2 节一致）；size 是车长（世界单位）
  // ---------------------------------------------------------------
  function drawCar(st, q, color, opts) {
    const o = Object.assign({ size: 0.6, fill: null, lw: 1.6, alpha: 1, steer: 0 }, opts);
    const L = o.size, W = L * 0.55, c = Math.cos(q.th), s = Math.sin(q.th);
    const P = (a, b) => ({ x: q.x + a * c - b * s, y: q.y + a * s + b * c });
    const ctx = st.ctx; ctx.save(); ctx.globalAlpha = o.alpha;
    st.poly([P(-0.22 * L, -W / 2), P(0.95 * L, -W / 2), P(0.95 * L, W / 2), P(-0.22 * L, W / 2)], o.fill, color, o.lw);
    const wl = 0.22 * L;
    for (const sgn of [-1, 1]) {
      st.line(P(-wl / 2, sgn * W / 2), P(wl / 2, sgn * W / 2), color, 3.2);
      const fc = P(0.72 * L, sgn * W / 2), fa = q.th + o.steer;
      st.line({ x: fc.x - Math.cos(fa) * wl / 2, y: fc.y - Math.sin(fa) * wl / 2 }, { x: fc.x + Math.cos(fa) * wl / 2, y: fc.y + Math.sin(fa) * wl / 2 }, color, 3.2);
    }
    st.arrow(P(0.15 * L, 0), P(0.75 * L, 0), color, 1.4, 7);
    st.dot(q, 2.6, color);
    ctx.restore();
  }
  // 差速驱动：两轮与轴，参考点是轴中心
  function drawDiff(st, q, color, opts) {
    const o = Object.assign({ size: 0.5, lw: 1.6, alpha: 1, fill: null }, opts);
    const R = o.size / 2, c = Math.cos(q.th), s = Math.sin(q.th);
    const P = (a, b) => ({ x: q.x + a * c - b * s, y: q.y + a * s + b * c });
    const ctx = st.ctx; ctx.save(); ctx.globalAlpha = o.alpha;
    const body = []; for (let k = 0; k <= 24; k++) { const a = TAU * k / 24; body.push(P(R * 0.85 * Math.cos(a) + R * 0.15, R * 0.85 * Math.sin(a))); }
    st.poly(body, o.fill, color, o.lw);
    for (const sgn of [-1, 1]) st.line(P(-R * 0.45, sgn * R), P(R * 0.45, sgn * R), color, 4);
    st.line(P(0, -R), P(0, R), color, 1);
    st.arrow(P(0, 0), P(R * 0.95, 0), color, 1.4, 6);
    ctx.restore();
  }
  // 拖动位形的手柄：位置点 + 朝向点
  function headingHandle(q, len) { return { x: q.x + len * Math.cos(q.th), y: q.y + len * Math.sin(q.th) }; }

  window.CH15 = {
    colors, rgb, alpha, mixRGB, cv, cva, rng, gauss, TAU, clamp, dist, wrap,
    Stage, Plot, frame, seg, slider, select, toggle, stat, button, legend, Runner,
    rk4Step, integrate, matmul, matvec, transpose, rank, det, eig2,
    sampleGrid, drawHeat, contourSegs, drawContours, View3D,
    dubinsWords, dubinsBest, rsCandidates, rsBest, bookWord, rsBase, RS_TYPES, stepSeg, follow, samplePath,
    drawCar, drawDiff, headingHandle,
  };
})();
