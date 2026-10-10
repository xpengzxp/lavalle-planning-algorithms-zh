/* 第 12 章共用小库：颜色、坐标图画布、组件外框与小控件、平面几何与可见性、栅格环境、树的绘制、离散定位的地图
   颜色约定（沿用 Part III，第 12 章补充）：蓝 = 机器人的真实状态 / 动作，橙 = 非确定 I-state 里「还可能」的状态，
   紫 = 概率 I-state（信念、粒子），绿 = 目标 / 已确定 / 已清除，红 = 最坏情况 / 被污染，深灰 = 障碍，黄 = 当前可见区域。 */
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
    alive: "--c-alive", dead: "--c-dead", alive2: "--c-alive2", dead2: "--c-dead2", current: "--c-current", grid: "--c-grid", mud: "--c-mud",
  };
  // 角色色：机器人、非确定候选、概率、目标 / 清除、最坏 / 污染、可见区域
  const ROLE = { robot: "accent", cand: "warn", prob: "alive2", best: "ok", worst: "bad", vis: "alive", obst: "wall" };

  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
    for (const [k, v] of Object.entries(ROLE)) o[k] = o[v];
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
  function mix(c1, c2, t) { const a = rgb(c1), b = rgb(c2); const m = a.map((x, i) => Math.round(x + (b[i] - x) * t)); return `rgb(${m[0]},${m[1]},${m[2]})`; }
  const cv = (key) => `var(${COLOR_VARS[ROLE[key] || key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[ROLE[key] || key]}) ${Math.round(a * 100)}%, transparent)`;

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
  let seedCounter = 12121;
  const newSeed = () => (seedCounter = (Math.imul(seedCounter, 1103515245) + 12345 + Date.now()) >>> 0);
  function pick(weights, r) {
    const s = weights.reduce((a, b) => a + b, 0);
    let x = r() * s;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }

  // ---------------------------------------------------------------
  // 数的显示
  // ---------------------------------------------------------------
  const minus = (s) => s.replace(/^-/, "−");
  function toFrac(x, maxDen = 64, tol = 1e-9) {
    if (!isFinite(x)) return null;
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      if (Math.abs(n / d - x) < tol * Math.max(1, Math.abs(x))) return [n, d];
    }
    return null;
  }
  function fmt(x, digits = 3, maxDen = 16) {
    if (x === Infinity) return "∞";
    if (x === -Infinity) return "−∞";
    if (!isFinite(x)) return "–";
    if (Math.abs(x) < 1e-12) return "0";
    const f = toFrac(x, maxDen);
    if (f) return minus(f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);
    return minus(String(+x.toFixed(digits)));
  }
  const fmtD = (x, d = 2) => (x === Infinity ? "∞" : isFinite(x) ? minus(String(+x.toFixed(d))) : "–");
  const fmtP = (x) => (x * 100).toFixed(x < 0.001 ? 3 : 1) + "%";
  const sub = (k) => String(k).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[+c] || c).join("");

  // ---------------------------------------------------------------
  // 坐标图画布：自适应宽度、高分屏、主题切换重画、equal 时等比例、拖拽
  // ---------------------------------------------------------------
  class Plot {
    constructor(o) {
      this.o = Object.assign({ x: [0, 1], y: [0, 1], aspect: 0.62, maxW: 560, minW: 220, m: { l: 50, r: 14, t: 14, b: 34 }, equal: false }, o);
      this.wrap = h("div", { class: "ch12-plot" });
      this.canvas = h("canvas");
      this.wrap.append(this.canvas);
      this.drag = null;
      this.bind();
      new ResizeObserver(() => this.resize()).observe(this.wrap);
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
    setRange(x, y) { if (x) this.o.x = x; if (y) this.o.y = y; }
    setAspect(a) { if (Math.abs(a - this.o.aspect) < 1e-6) return; this.o.aspect = a; this.W = 0; this.resize(); }
    geom() {
      const { m, x, y } = this.o;
      const w = this.W - m.l - m.r, hh = this.H - m.t - m.b;
      let sx = w / (x[1] - x[0]), sy = hh / (y[1] - y[0]), ox = m.l, oy = this.H - m.b;
      if (this.o.equal) {
        const s = Math.min(sx, sy);
        ox = m.l + (w - s * (x[1] - x[0])) / 2; oy = this.H - m.b - (hh - s * (y[1] - y[0])) / 2; sx = sy = s;
      }
      return { sx, sy, ox, oy };
    }
    X(v) { const g = this.geom(); return g.ox + (v - this.o.x[0]) * g.sx; }
    Y(v) { const g = this.geom(); return g.oy - (v - this.o.y[0]) * g.sy; }
    S(len) { return len * this.geom().sx; }
    inv(px, py) { const g = this.geom(); return { x: this.o.x[0] + (px - g.ox) / g.sx, y: this.o.y[0] + (g.oy - py) / g.sy }; }
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
    pxDist(a, b) { return Math.hypot(this.X(a.x) - this.X(b.x), this.Y(a.y) - this.Y(b.y)); }
    font(size, weight) { return `${weight || 500} ${size || 12}px ${getComputedStyle(document.body).fontFamily}`; }
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    arrow(a, b, color, lw, head) {
      this.line(a, b, color, lw);
      const ctx = this.ctx, x1 = this.X(b.x), y1 = this.Y(b.y), ang = Math.atan2(y1 - this.Y(a.y), x1 - this.X(a.x)), s = head || 8;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - s * Math.cos(ang - 0.4), y1 - s * Math.sin(ang - 0.4));
      ctx.lineTo(x1 - s * Math.cos(ang + 0.4), y1 - s * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    path(P, color, lw, dash) {
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw, dash) {
      if (!P.length) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.stroke(); ctx.setLineDash([]); }
    }
    // 带洞的多个多边形一起填充（evenodd）
    polys(list, fill) {
      const ctx = this.ctx; ctx.beginPath();
      for (const P of list) P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.fillStyle = fill; ctx.fill("evenodd");
    }
    rect(x0, y0, x1, y1, fill, stroke, lw) { this.poly([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], fill, stroke, lw); }
    curve(fn, x0, x1, n, color, lw, dash) {
      const P = [];
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (isFinite(y)) P.push({ x, y }); }
      this.path(P, color, lw, dash);
      return P;
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = this.font(o.size, o.weight);
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    axes(col, o) {
      o = Object.assign({ xt: [], yt: [], fx: fmt, fy: fmt, xl: "", yl: "", grid: true }, o);
      const ctx = this.ctx, [x0, x1] = this.o.x, [y0, y1] = this.o.y;
      ctx.fillStyle = col.surface; ctx.fillRect(this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1));
      ctx.font = this.font(11); ctx.fillStyle = col.muted;
      for (const t of o.xt) {
        if (o.grid) this.line({ x: t, y: y0 }, { x: t, y: y1 }, col.grid, 1);
        ctx.fillStyle = col.muted; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(o.fx(t), this.X(t), this.Y(y0) + 4);
      }
      for (const t of o.yt) {
        if (o.grid) this.line({ x: x0, y: t }, { x: x1, y: t }, col.grid, 1);
        ctx.fillStyle = col.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(o.fy(t), this.X(x0) - 5, this.Y(t));
      }
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1;
      ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, this.X(x1) - this.X(x0) - 1, this.Y(y0) - this.Y(y1) - 1);
      ctx.fillStyle = col.text2; ctx.font = this.font(11.5, 600);
      if (o.xl) { ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(o.xl, this.X(x1), this.H - 2); }
      if (o.yl) { ctx.save(); ctx.translate(11, this.Y(y1)); ctx.rotate(-Math.PI / 2); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(o.yl, 0, 0); ctx.restore(); }
    }
    clip(fn) {
      const ctx = this.ctx, [x0, x1] = this.o.x, [y0, y1] = this.o.y;
      ctx.save(); ctx.beginPath(); ctx.rect(this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1)); ctx.clip();
      fn(); ctx.restore();
    }
  }
  function ticks(a, b, n = 5) {
    const span = b - a; if (!(span > 0)) return [a];
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => span / s <= n + 0.5) || 10 * p;
    const out = []; for (let t = Math.ceil(a / step - 1e-9) * step; t <= b + 1e-9; t += step) out.push(+t.toFixed(10));
    return out;
  }

  // ---------------------------------------------------------------
  // 组件外框 & 小控件
  // ---------------------------------------------------------------
  function frame(root, title, subt) {
    const body = h("div", { class: "widget-body" });
    root.append(h("div", { class: "widget-head" }, h("span", { class: "w-title" }, title), subt ? h("span", { class: "w-sub" }, subt) : null, h("span", { class: "w-badge" }, "互动")), body);
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
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; el.key = (x) => { el.querySelector(".k").textContent = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }
  function checkbox(label, value, onChange) {
    const cb = h("input", { type: "checkbox", checked: value ? true : null });
    cb.addEventListener("change", () => onChange(cb.checked));
    const lab = h("label", null, cb, label); lab.input = cb; return lab;
  }
  function math(el) { if (window.renderMathInElement) PA.renderMath(el); }

  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // ---------------------------------------------------------------
  // 平面几何：线段求交、射线、点在多边形内、可见多边形
  // ---------------------------------------------------------------
  const EPS = 1e-9;
  const sub2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 线段 pq 与 ab 的交点参数（沿 pq 的 t ∈ [0,1]），不相交返回 null
  function segX(p, q, a, b) {
    const r = sub2(q, p), s = sub2(b, a), d = cross(r, s);
    if (Math.abs(d) < 1e-14) return null;
    const ap = sub2(a, p), t = cross(ap, s) / d, u = cross(ap, r) / d;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return t;
  }
  // 射线 p + t·dir（t > 0）与线段集合的最近交点
  function rayHit(p, dir, segs) {
    let best = Infinity, bi = -1;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const s = sub2(b, a), d = cross(dir, s);
      if (Math.abs(d) < 1e-14) continue;
      const ap = sub2(a, p), t = cross(ap, s) / d, u = cross(ap, dir) / d;
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) { best = t; bi = i; }
    }
    return { t: best, i: bi, p: { x: p.x + dir.x * best, y: p.y + dir.y * best } };
  }
  function polySegs(polys) {
    const out = [];
    for (const P of polys) for (let i = 0; i < P.length; i++) out.push([P[i], P[(i + 1) % P.length]]);
    return out;
  }
  function inPoly(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function polyPerim(P) { let s = 0; for (let i = 0; i < P.length; i++) s += dist(P[i], P[(i + 1) % P.length]); return s; }
  function polyArea(P) { let s = 0; for (let i = 0; i < P.length; i++) s += cross(P[i], P[(i + 1) % P.length]); return s / 2; }
  // 线段 pq 是否穿过任何障碍边（端点接触不算）
  function segFree(p, q, segs) {
    for (const [a, b] of segs) {
      const t = segX(p, q, a, b);
      if (t !== null && t > 1e-7 && t < 1 - 1e-7) return false;
    }
    return true;
  }
  // 可见多边形：对每个顶点方向及其两侧小角度各打一条射线，按角度排序
  function visPoly(p, segs, verts) {
    const angs = [];
    for (const v of verts) {
      const a = Math.atan2(v.y - p.y, v.x - p.x);
      angs.push(a - 1e-5, a, a + 1e-5);
    }
    angs.sort((a, b) => a - b);
    const out = [];
    for (const a of angs) {
      const r = rayHit(p, { x: Math.cos(a), y: Math.sin(a) }, segs);
      if (isFinite(r.t)) out.push({ x: r.p.x, y: r.p.y, a, d: r.t });
    }
    return out;
  }
  function distPointSeg(p, a, b) {
    const ab = sub2(b, a), t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return { d: dist(p, q), q, t };
  }

  // ---------------------------------------------------------------
  // 栅格环境：字符串地图（'#' 障碍，其它字符可通行），第 0 行画在最上面
  // ---------------------------------------------------------------
  class GridEnv {
    constructor(rows) {
      this.rows = rows;
      this.H = rows.length; this.W = rows[0].length;
      this.free = new Uint8Array(this.W * this.H);
      this.marks = {};
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
        const ch = rows[j][i];
        if (ch !== "#") this.free[this.idx(i, j)] = 1;
        if (ch !== "#" && ch !== ".") (this.marks[ch] = this.marks[ch] || []).push([i, j]);
      }
      this.cells = [];
      for (let k = 0; k < this.W * this.H; k++) if (this.free[k]) this.cells.push(k);
    }
    idx(i, j) { return j * this.W + i; }
    ij(k) { return [k % this.W, Math.floor(k / this.W)]; }
    isFree(i, j) { return i >= 0 && j >= 0 && i < this.W && j < this.H && this.free[this.idx(i, j)] === 1; }
    // 两个格子中心之间是否可见：沿线段做超覆盖遍历，经过的格子都必须可通行（角点擦过两个障碍格时视为挡住）
    los(i0, j0, i1, j1) {
      let x = i0, y = j0;
      const dx = Math.abs(i1 - i0), dy = Math.abs(j1 - j0), sx = i1 > i0 ? 1 : -1, sy = j1 > j0 ? 1 : -1;
      let n = dx + dy;
      // Amanatides–Woo 遍历：tx / ty 是沿线段（参数 0..1）下一次穿过竖 / 横格线的位置
      let tx = dx === 0 ? Infinity : 1 / (2 * dx), ty = dy === 0 ? Infinity : 1 / (2 * dy);
      const stx = dx === 0 ? Infinity : 1 / dx, sty = dy === 0 ? Infinity : 1 / dy;
      while (n > 0) {
        if (Math.abs(tx - ty) < 1e-12) {
          // 恰好穿过格点：两个侧边的格子有一个通就算通（避免对角缝隙误判），两个都堵则挡住
          if (!this.isFree(x + sx, y) && !this.isFree(x, y + sy)) return false;
          x += sx; y += sy; tx += stx; ty += sty; n -= 2;
        } else if (tx < ty) { x += sx; tx += stx; n--; }
        else { y += sy; ty += sty; n--; }
        if (!this.isFree(x, y)) return false;
      }
      return true;
    }
    // 从格子 k 看得见的全部格子
    visible(k) {
      const [i0, j0] = this.ij(k), out = new Uint8Array(this.W * this.H);
      for (const c of this.cells) { const [i, j] = this.ij(c); if (this.los(i0, j0, i, j)) out[c] = 1; }
      return out;
    }
    // mask 中的连通分量（4 邻接）；返回 Int16Array，-1 表示不在 mask 中，以及分量个数
    components(mask) {
      const lab = new Int16Array(this.W * this.H).fill(-1);
      let n = 0;
      const st = [];
      for (const c of this.cells) {
        if (!mask[c] || lab[c] >= 0) continue;
        lab[c] = n; st.push(c);
        while (st.length) {
          const k = st.pop(), i = k % this.W, j = (k - i) / this.W;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ii = i + a, jj = j + b;
            if (ii < 0 || jj < 0 || ii >= this.W || jj >= this.H) continue;
            const q = jj * this.W + ii;
            if (mask[q] && lab[q] < 0 && this.free[q]) { lab[q] = n; st.push(q); }
          }
        }
        n++;
      }
      return { lab, n };
    }
    // 画：障碍格、网格线（可选）
    draw(pl, col, o) {
      o = Object.assign({ gridLines: false, wall: col.obst, freeFill: col.surface }, o);
      const ctx = pl.ctx;
      ctx.fillStyle = o.freeFill;
      ctx.fillRect(pl.X(0), pl.Y(this.H), pl.X(this.W) - pl.X(0), pl.Y(0) - pl.Y(this.H));
      ctx.fillStyle = o.wall;
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (!this.free[this.idx(i, j)]) {
        const x0 = pl.X(i), y0 = pl.Y(this.H - j), x1 = pl.X(i + 1), y1 = pl.Y(this.H - j - 1);
        ctx.fillRect(Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0) + 0.5, Math.ceil(y1 - y0) + 0.5);
      }
      if (o.gridLines) {
        ctx.strokeStyle = col.grid; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= this.W; i++) { ctx.moveTo(pl.X(i) + 0.5, pl.Y(0)); ctx.lineTo(pl.X(i) + 0.5, pl.Y(this.H)); }
        for (let j = 0; j <= this.H; j++) { ctx.moveTo(pl.X(0), pl.Y(j) + 0.5); ctx.lineTo(pl.X(this.W), pl.Y(j) + 0.5); }
        ctx.stroke();
      }
    }
    // 在格子 k 上画一个填充方块（画布坐标：第 0 行在最上）
    fillCell(pl, k, color, inset) {
      const [i, j] = this.ij(k), e = inset || 0;
      const x0 = pl.X(i + e), y0 = pl.Y(this.H - j - e), x1 = pl.X(i + 1 - e), y1 = pl.Y(this.H - j - 1 + e);
      pl.ctx.fillStyle = color; pl.ctx.fillRect(x0, y0, x1 - x0 + 0.6, y1 - y0 + 0.6);
    }
    center(k) { const [i, j] = this.ij(k); return { x: i + 0.5, y: this.H - j - 0.5 }; }
    cellAt(p) { const i = Math.floor(p.x), j = this.H - 1 - Math.floor(p.y); return this.isFree(i, j) ? this.idx(i, j) : -1; }
  }

  // ---------------------------------------------------------------
  // 树：简单的「叶子计数」布局，画在 canvas 上
  //   node = { children: [], shape: "disc" | "circle" | "square", label, color, hl }
  // ---------------------------------------------------------------
  function layoutTree(root, o) {
    o = Object.assign({ dx: 34, dy: 46, x0: 20, y0: 20 }, o);
    let leaf = 0, depth = 0;
    (function rec(n, d) {
      depth = Math.max(depth, d);
      n._d = d;
      if (!n.children || !n.children.length) { n._x = leaf++; return; }
      n.children.forEach((c) => rec(c, d + 1));
      n._x = (n.children[0]._x + n.children[n.children.length - 1]._x) / 2;
    })(root, 0);
    (function rec(n) { n.px = o.x0 + n._x * o.dx; n.py = o.y0 + n._d * o.dy; (n.children || []).forEach(rec); })(root);
    return { leaves: Math.max(1, leaf), depth };
  }
  function drawTree(ctx, root, col, o) {
    o = Object.assign({ r: 10, font: "12px sans-serif" }, o);
    (function edges(n) {
      for (const c of n.children || []) {
        ctx.beginPath(); ctx.moveTo(n.px, n.py); ctx.lineTo(c.px, c.py);
        ctx.strokeStyle = c.edgeColor || col.strong; ctx.lineWidth = c.edgeWidth || 1.4; ctx.stroke();
        if (c.edgeLabel) {
          ctx.font = o.font; ctx.fillStyle = col.muted; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(c.edgeLabel, (n.px + c.px) / 2 + (c.px < n.px ? -7 : c.px > n.px ? 7 : 8), (n.py + c.py) / 2);
        }
        edges(c);
      }
    })(root);
    (function nodes(n) {
      const r = n.r || o.r;
      ctx.beginPath();
      if (n.shape === "square") ctx.rect(n.px - r, n.py - r, 2 * r, 2 * r);
      else ctx.arc(n.px, n.py, n.shape === "disc" ? r * 0.75 : r, 0, 2 * Math.PI);
      ctx.fillStyle = n.shape === "disc" ? (n.color || col.text) : (n.fill || col.surface); ctx.fill();
      ctx.strokeStyle = n.color || col.text2; ctx.lineWidth = n.hl ? 3 : 1.4; ctx.stroke();
      if (n.label !== undefined && n.shape !== "disc") {
        ctx.font = n.font || o.font; ctx.fillStyle = n.textColor || col.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(n.label), n.px, n.py + 0.5);
      }
      (n.children || []).forEach(nodes);
    })(root);
  }

  // ---------------------------------------------------------------
  // 离散定位的世界：格子 + 朝向（12.2.1 / 12.2.3 / 12.3.1 共用）
  // ---------------------------------------------------------------
  const DIRS = ["N", "E", "S", "W"];
  const DV = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
  const TURN = { F: 0, R: 1, B: 2, L: 3 };
  const DIR_ZH = { N: "北", E: "东", S: "南", W: "西" };
  const ACT_ZH = { F: "前进 F", B: "后退 B", R: "右转 R", L: "左转 L", N: "向北 N", E: "向东 E", S: "向南 S", W: "向西 W" };
  const turnDir = (d, u) => DIRS[(DIRS.indexOf(d) + TURN[u]) % 4];
  // cells：{ 名字: [x, y] }（y 向上）
  class TileWorld {
    constructor(cells, opts) {
      this.cells = cells;
      this.opts = Object.assign({ compass: false }, opts);
      this.key = {};
      this.name = {};
      for (const [n, [x, y]] of Object.entries(cells)) { this.key[x + "," + y] = n; this.name[n] = [x, y]; }
      const xs = Object.values(cells).map((c) => c[0]), ys = Object.values(cells).map((c) => c[1]);
      this.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      this.states = [];
      for (const n of Object.keys(cells)) for (const d of DIRS) this.states.push(n + d);
    }
    U() { return this.opts.compass ? ["N", "E", "S", "W"] : ["F", "B", "R", "L"]; }
    // 状态用字符串「名字 + 朝向」表示，例如 "3N"
    split(s) { return [s.slice(0, -1), s.slice(-1)]; }
    f(s, u) {
      const [n, d] = this.split(s);
      const nd = this.opts.compass ? u : turnDir(d, u);
      const [x, y] = this.name[n], v = DV[nd];
      const q = this.key[(x + v[0]) + "," + (y + v[1])];
      return (q !== undefined ? q : n) + nd;
    }
    moved(s, s2) { return this.split(s)[0] !== this.split(s2)[0] ? 1 : 0; }
    // 非确定 I-state 的更新：返回 { y: Set }
    step(S, u) {
      const out = {};
      for (const s of S) { const s2 = this.f(s, u), y = this.moved(s, s2); (out[y] = out[y] || new Set()).add(s2); }
      return out;
    }
    show(S) {
      const by = {};
      for (const s of S) { const [n, d] = this.split(s); (by[n] = by[n] || []).push(d); }
      return Object.keys(by).sort((a, b) => (isNaN(a) ? a.localeCompare(b) : a - b)).map((n) => n + "^" + by[n].sort((a, b) => DIRS.indexOf(a) - DIRS.indexOf(b)).join("")).join(" ∪ ");
    }
  }
  // 在 Plot 上画 TileWorld：o.weights（状态 → 0..1 不透明度）、o.truth（真实状态）、o.color
  function tilesAspect(W) { const [x0, y0, x1, y1] = W.box; return Math.max(0.35, Math.min(1.4, (y1 - y0 + 1.8) / (x1 - x0 + 1.8))); }
  function drawTiles(pl, col, W, o) {
    o = Object.assign({ weights: null, truth: null, color: col.cand, labels: true, cellFill: col.surface }, o);
    const [x0, y0, x1, y1] = W.box, ctx = pl.ctx;
    if (!o.keepRange) pl.setRange([x0 - 0.4, x1 + 1.4], [y0 - 0.4, y1 + 1.4]);
    // 外围障碍
    pl.rect(x0 - 0.35, y0 - 0.35, x1 + 1.35, y1 + 1.35, col.obst);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (W.key[x + "," + y] === undefined) pl.rect(x, y, x + 1, y + 1, col.obst);
    for (const [n, [x, y]] of Object.entries(W.name)) {
      pl.rect(x + 0.03, y + 0.03, x + 0.97, y + 0.97, o.cellFill, col.strong, 1);
      if (o.labels) pl.text(n, { x: x + 0.16, y: y + 0.84 }, col.muted, { size: 11, align: "left" });
    }
    const L = pl.S(0.3);
    for (const s of W.states) {
      const w = o.weights ? o.weights.get(s) || 0 : 0;
      const [n, d] = W.split(s), [x, y] = W.name[n], cx = pl.X(x + 0.5), cy = pl.Y(y + 0.5), v = DV[d];
      if (w > 0) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + v[0] * L, cy - v[1] * L);
        ctx.strokeStyle = typeof o.color === "function" ? o.color(s, w) : alpha(o.color, Math.max(0.15, Math.min(1, w)));
        ctx.lineWidth = Math.max(3, pl.S(0.09)); ctx.lineCap = "round"; ctx.stroke();
      }
    }
    for (const [n, [x, y]] of Object.entries(W.name)) {
      const any = W.states.some((s) => W.split(s)[0] === n && o.weights && (o.weights.get(s) || 0) > 0);
      pl.dot({ x: x + 0.5, y: y + 0.5 }, Math.max(2.5, pl.S(0.06)), any ? col.text : col.muted);
    }
    if (o.truth) {
      const [n, d] = W.split(o.truth), [x, y] = W.name[n], v = DV[d], c = { x: x + 0.5, y: y + 0.5 };
      pl.dot(c, Math.max(5, pl.S(0.13)), null, col.robot, 2.5);
      pl.arrow(c, { x: c.x + v[0] * 0.38, y: c.y + v[1] * 0.38 }, col.robot, 2.5, 9);
    }
  }

  window.CH12 = {
    COLOR_VARS, ROLE, colors, rgb, alpha, mix, cv, cva, rng, gauss, newSeed, pick,
    toFrac, fmt, fmtD, fmtP, sub, Plot, ticks, frame, seg, slider, select, stat, button, legend, checkbox, math, Runner,
    EPS, sub2, cross, dist, segX, rayHit, polySegs, inPoly, polyPerim, polyArea, segFree, visPoly, distPointSeg,
    GridEnv, layoutTree, drawTree, DIRS, DV, TURN, DIR_ZH, ACT_ZH, turnDir, TileWorld, drawTiles, tilesAspect,
  };
})();
