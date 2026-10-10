/* 第 11 章共用小库：颜色、画布舞台、组件外框与小控件、栅格集合（2D 不确定 I-state）、最小包围圆、
   矩阵博弈求解（单纯形）、2×2 线性代数与协方差椭圆。
   颜色约定（沿用 Part III，第 9 章定）：蓝 = 机器人的动作 u，以及机器人「知道」的不确定 I-state X_k(η_k)；
   橙 = 自然（干扰 θ、传感噪声 ψ）、观测 y 与原像 H(y)；紫 = 概率 I-state（分布、粒子、高斯）；
   绿 = 目标 / 成功；红 = 被排除 / 矛盾 / 最坏情况；深色实心点 = 规划者看不到的真实状态 x。 */
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
  // 本章的角色色
  const ROLE = { robot: "accent", ndet: "accent", nature: "warn", obs: "warn", prob: "alive2", goal: "ok", bad: "bad", truth: "text", p1: "accent", p2: "warn" };
  const CAT = ["accent", "goal", "mud", "dead", "ok", "warn", "alive2", "current"];   // 类别色（按观测值着色等）

  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
    for (const [k, v] of Object.entries(ROLE)) o[k] = o[v];
    o.cat = CAT.map((k) => o[k]);
    return o;
  }
  function rgb(c) {
    c = (c || "#888").trim();
    if (c[0] !== "#") { const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [136, 136, 136]; }
    if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function alpha(c, a) { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; }
  const cv = (key) => `var(${COLOR_VARS[ROLE[key] || key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[ROLE[key] || key]}) ${Math.round(a * 100)}%, transparent)`;
  const catVar = (i) => `var(${COLOR_VARS[CAT[((i % CAT.length) + CAT.length) % CAT.length]]})`;

  // ---------------------------------------------------------------
  // 随机数（可复现）
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
  let seedCounter = 1111;
  const newSeed = () => (seedCounter = (Math.imul(seedCounter, 1103515245) + 12345 + Date.now()) >>> 0);
  function pick(weights, r) {
    const s = weights.reduce((a, b) => a + b, 0);
    let x = r() * s;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }
  const randInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  // ---------------------------------------------------------------
  // 数的显示
  // ---------------------------------------------------------------
  function toFrac(x, maxDen = 64, tol = 1e-9) {
    if (!isFinite(x)) return null;
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      if (Math.abs(n / d - x) < tol * Math.max(1, Math.abs(x))) return [n, d];
    }
    return null;
  }
  const minus = (s) => s.replace(/^-/, "−");
  function fmt(x, digits = 3, maxDen = 64) {
    if (x === Infinity) return "∞";
    if (x === -Infinity) return "−∞";
    if (!isFinite(x)) return "–";
    if (Math.abs(x) < 1e-12) return "0";
    const f = toFrac(x, maxDen);
    if (f) return minus(f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);
    return minus(String(+x.toFixed(digits)));
  }
  const fmtD = (x, d = 3) => (isFinite(x) ? minus(String(+x.toFixed(d))) : "–");
  const sub = (k) => String(k).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[+c] || (c === "-" ? "₋" : c === "+" ? "₊" : c)).join("");
  const setStr = (arr, empty = "∅") => (arr.length ? "{" + arr.join(", ") + "}" : empty);

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // equal = true 时 x、y 等比例（默认），否则各自铺满
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 0.6, maxW: 620, minW: 220, view: [0, 1, 0, 1], pad: 6, equal: true }, opts);
      this.wrap = h("div", { class: "ch11-stage" });
      this.canvas = h("canvas");
      this.wrap.append(this.canvas);
      this.view = this.o.view;
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
    setView(v) { this.view = v; }
    get sx() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; const a = (this.W - 2 * p) / (x1 - x0), b = (this.H - 2 * p) / (y1 - y0); return this.o.equal ? Math.min(a, b) : a; }
    get sy() { const [x0, x1, y0, y1] = this.view, p = this.o.pad; const a = (this.W - 2 * p) / (x1 - x0), b = (this.H - 2 * p) / (y1 - y0); return this.o.equal ? Math.min(a, b) : b; }
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
    font(size, weight) { return `${weight || 500} ${size || 12}px ${getComputedStyle(document.body).fontFamily}`; }
    pxDist(a, b) { return Math.hypot(this.X(a.x) - this.X(b.x), this.Y(a.y) - this.Y(b.y)); }
    dot(p, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(a, b, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(a.x), this.Y(a.y)); ctx.lineTo(this.X(b.x), this.Y(b.y));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    path(P, color, lw, dash) {
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw, dash) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    rect(x0, y0, x1, y1, fill, stroke, lw, dash) { this.poly([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], fill, stroke, lw, dash); }
    circle(c, r, fill, stroke, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(c.x), this.Y(c.y), Math.max(0.5, r * this.sx), 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    }
    arrow(a, b, color, lw, head) {
      const ctx = this.ctx, ax = this.X(a.x), ay = this.Y(a.y), bx = this.X(b.x), by = this.Y(b.y);
      const L = Math.hypot(bx - ax, by - ay); if (L < 1) return;
      const ux = (bx - ax) / L, uy = (by - ay) / L, hd = head || 8;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - ux * hd * 0.6, by - uy * hd * 0.6);
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * hd - uy * hd * 0.45, by - uy * hd + ux * hd * 0.45);
      ctx.lineTo(bx - ux * hd + uy * hd * 0.45, by - uy * hd - ux * hd * 0.45); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = this.font(o.size, o.weight);
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    // 协方差椭圆：Σ 的 k 倍标准差等高线
    ellipse(mu, S, k, fill, stroke, lw, dash) {
      const e = eig2(S), P = [];
      for (let i = 0; i <= 72; i++) {
        const t = (2 * Math.PI * i) / 72, a = k * Math.sqrt(Math.max(e.l1, 0)) * Math.cos(t), b = k * Math.sqrt(Math.max(e.l2, 0)) * Math.sin(t);
        P.push({ x: mu.x + a * e.v1.x + b * e.v2.x, y: mu.y + a * e.v1.y + b * e.v2.y });
      }
      this.poly(P, fill, stroke, lw, dash);
    }
    truth(p, col, label) {      // 隐藏的真实状态
      this.dot(p, 5.5, col.text, col.surface, 2);
      if (label) this.text(label, p, col.text, { dy: -13, size: 11.5, weight: 650 });
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
    lab.setValue = (v) => { inp.value = v; show(); };
    return lab;
  }
  function select(options, value, onChange) {
    const el = h("select");
    options.forEach(([k, t]) => el.append(h("option", { value: k, selected: k === value ? true : null }, t)));
    el.addEventListener("change", () => onChange(el.value));
    return el;
  }
  function checkbox(label, value, onChange) {
    const inp = h("input", { type: "checkbox", checked: value ? true : null });
    inp.addEventListener("change", () => onChange(inp.checked));
    const lab = h("label", null, inp, label);
    lab.input = inp;
    return lab;
  }
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; this.last = 0; }
    start() {
      if (this.running) return; this.running = true; this.last = performance.now();
      const loop = (t) => { if (!this.running) return; const dt = Math.max(0, Math.min(0.05, (t - this.last) / 1000)); this.last = t; const more = this.step(dt); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
    toggle() { if (this.running) this.stop(); else this.start(); }
  }
  // 组件离开视口时自动暂停动画（省电）
  function pauseWhenHidden(el, runner) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver((ents) => ents.forEach((en) => { if (!en.isIntersecting) runner.stop(); })).observe(el);
  }

  // ---------------------------------------------------------------
  // 栅格集合：用来表示连续状态空间 X ⊂ R² 里的不确定 I-state
  // ---------------------------------------------------------------
  class Raster {
    constructor(x0, x1, y0, y1, cell) {
      this.x0 = x0; this.y0 = y0; this.cell = cell;
      this.nx = Math.round((x1 - x0) / cell); this.ny = Math.round((y1 - y0) / cell);
      this.x1 = x0 + this.nx * cell; this.y1 = y0 + this.ny * cell;
      this.a = new Uint8Array(this.nx * this.ny);
    }
    like() { return new Raster(this.x0, this.x1, this.y0, this.y1, this.cell); }
    copy() { const r = this.like(); r.a.set(this.a); return r; }
    cx(i) { return this.x0 + (i + 0.5) * this.cell; }
    cy(j) { return this.y0 + (j + 0.5) * this.cell; }
    ij(x, y) { return [Math.floor((x - this.x0) / this.cell), Math.floor((y - this.y0) / this.cell)]; }
    get(i, j) { return i >= 0 && j >= 0 && i < this.nx && j < this.ny ? this.a[j * this.nx + i] : 0; }
    set(i, j, v = 1) { if (i >= 0 && j >= 0 && i < this.nx && j < this.ny) this.a[j * this.nx + i] = v; }
    clear() { this.a.fill(0); return this; }
    fill(pred) { for (let j = 0; j < this.ny; j++) { const y = this.cy(j); for (let i = 0; i < this.nx; i++) this.a[j * this.nx + i] = pred(this.cx(i), y) ? 1 : 0; } return this; }
    and(pred) { for (let j = 0; j < this.ny; j++) { const y = this.cy(j); for (let i = 0; i < this.nx; i++) { const k = j * this.nx + i; if (this.a[k] && !pred(this.cx(i), y)) this.a[k] = 0; } } return this; }
    andR(r) { for (let k = 0; k < this.a.length; k++) this.a[k] &= r.a[k]; return this; }
    orR(r) { for (let k = 0; k < this.a.length; k++) this.a[k] |= r.a[k]; return this; }
    count() { let n = 0; for (let k = 0; k < this.a.length; k++) n += this.a[k]; return n; }
    empty() { for (let k = 0; k < this.a.length; k++) if (this.a[k]) return false; return true; }
    area() { return this.count() * this.cell * this.cell; }
    // 闵可夫斯基和：∪_{x ∈ 本集合} (x + K)，K 是格子偏移量列表
    dilate(K) {
      const r = this.like(), nx = this.nx, ny = this.ny, a = this.a, b = r.a;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!a[j * nx + i]) continue;
        for (let t = 0; t < K.length; t++) {
          const ii = i + K[t][0], jj = j + K[t][1];
          if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) b[jj * nx + ii] = 1;
        }
      }
      return r;
    }
    // 把连续的位移集合 {d : pred(d)} 离散成格子偏移量（以格子中心对格子中心）
    kernel(pred, R) {
      const n = Math.ceil(R / this.cell) + 1, K = [];
      for (let dj = -n; dj <= n; dj++) for (let di = -n; di <= n; di++) if (pred(di * this.cell, dj * this.cell)) K.push([di, dj]);
      return K.length ? K : [[0, 0]];
    }
    // 边界格子（集合内、但四邻居有不在集合内的）的角点，用来算包围圆 / 包围盒
    boundaryPts() {
      const P = [], c = this.cell;
      for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
        if (!this.get(i, j)) continue;
        if (this.get(i - 1, j) && this.get(i + 1, j) && this.get(i, j - 1) && this.get(i, j + 1)) continue;
        const x = this.x0 + i * c, y = this.y0 + j * c;
        P.push({ x, y }, { x: x + c, y }, { x, y: y + c }, { x: x + c, y: y + c });
      }
      return P;
    }
    bbox() {
      let i0 = Infinity, i1 = -1, j0 = Infinity, j1 = -1;
      for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) if (this.a[j * this.nx + i]) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
      if (i1 < 0) return null;
      return { x0: this.x0 + i0 * this.cell, x1: this.x0 + (i1 + 1) * this.cell, y0: this.y0 + j0 * this.cell, y1: this.y0 + (j1 + 1) * this.cell };
    }
    // 画到舞台上：rgba 是 [r,g,b,a(0..255)]
    draw(stage, color, a) {
      const off = document.createElement("canvas"); off.width = this.nx; off.height = this.ny;
      const octx = off.getContext("2d"), img = octx.createImageData(this.nx, this.ny);
      const [r, g, b] = rgb(color), A = Math.round((a === undefined ? 0.5 : a) * 255);
      for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
        if (!this.a[j * this.nx + i]) continue;
        const o = ((this.ny - 1 - j) * this.nx + i) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = A;
      }
      octx.putImageData(img, 0, 0);
      const ctx = stage.ctx; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, stage.X(this.x0), stage.Y(this.y1), (this.x1 - this.x0) * stage.sx, (this.y1 - this.y0) * stage.sy);
      ctx.imageSmoothingEnabled = true;
    }
    // 只画边界轮廓（格子边）
    outline(stage, color, lw) {
      const ctx = stage.ctx, c = this.cell; ctx.beginPath();
      for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
        if (!this.get(i, j)) continue;
        const x = this.x0 + i * c, y = this.y0 + j * c;
        if (!this.get(i - 1, j)) { ctx.moveTo(stage.X(x), stage.Y(y)); ctx.lineTo(stage.X(x), stage.Y(y + c)); }
        if (!this.get(i + 1, j)) { ctx.moveTo(stage.X(x + c), stage.Y(y)); ctx.lineTo(stage.X(x + c), stage.Y(y + c)); }
        if (!this.get(i, j - 1)) { ctx.moveTo(stage.X(x), stage.Y(y)); ctx.lineTo(stage.X(x + c), stage.Y(y)); }
        if (!this.get(i, j + 1)) { ctx.moveTo(stage.X(x), stage.Y(y + c)); ctx.lineTo(stage.X(x + c), stage.Y(y + c)); }
      }
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.2; ctx.stroke();
    }
  }

  // 最小包围圆（Welzl 的迭代版本，期望线性时间）
  function minCircle(pts, seed) {
    const P = pts.slice(), r = rng(seed || 7);
    for (let i = P.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
    const inC = (c, p) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 1e-9;
    const c2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: Math.hypot(a.x - b.x, a.y - b.y) / 2 });
    const c3 = (a, b, c) => {
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-12) { const cs = [c2(a, b), c2(a, c), c2(b, c)]; return cs.reduce((m, x) => (x.r > m.r ? x : m)); }
      const A = a.x * a.x + a.y * a.y, B = b.x * b.x + b.y * b.y, C = c.x * c.x + c.y * c.y;
      const x = (A * (b.y - c.y) + B * (c.y - a.y) + C * (a.y - b.y)) / d, y = (A * (c.x - b.x) + B * (a.x - c.x) + C * (b.x - a.x)) / d;
      return { x, y, r: Math.hypot(a.x - x, a.y - y) };
    };
    if (!P.length) return null;
    let c = { x: P[0].x, y: P[0].y, r: 0 };
    for (let i = 1; i < P.length; i++) {
      if (inC(c, P[i])) continue;
      c = { x: P[i].x, y: P[i].y, r: 0 };
      for (let j = 0; j < i; j++) {
        if (inC(c, P[j])) continue;
        c = c2(P[i], P[j]);
        for (let k = 0; k < j; k++) if (!inC(c, P[k])) c = c3(P[i], P[j], P[k]);
      }
    }
    return c;
  }

  // ---------------------------------------------------------------
  // 2×2 线性代数（卡尔曼滤波、协方差椭圆）
  // ---------------------------------------------------------------
  const M2 = {
    mul: (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]],
    add: (A, B, s = 1) => [[A[0][0] + s * B[0][0], A[0][1] + s * B[0][1]], [A[1][0] + s * B[1][0], A[1][1] + s * B[1][1]]],
    T: (A) => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]],
    I: () => [[1, 0], [0, 1]],
    det: (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0],
    inv: (A) => { const d = A[0][0] * A[1][1] - A[0][1] * A[1][0]; return [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]]; },
    mv: (A, v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]],
    scale: (A, s) => [[A[0][0] * s, A[0][1] * s], [A[1][0] * s, A[1][1] * s]],
  };
  function eig2(S) {
    const a = S[0][0], b = (S[0][1] + S[1][0]) / 2, d = S[1][1];
    const tr = a + d, df = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
    const l1 = tr / 2 + df, l2 = tr / 2 - df;
    let v1 = Math.abs(b) > 1e-12 ? { x: l1 - d, y: b } : (a >= d ? { x: 1, y: 0 } : { x: 0, y: 1 });
    const n = Math.hypot(v1.x, v1.y); v1 = { x: v1.x / n, y: v1.y / n };
    return { l1, l2, v1, v2: { x: -v1.y, y: v1.x } };
  }

  // ---------------------------------------------------------------
  // 矩阵博弈（代价矩阵：行 = P1 最小化，列 = P2 最大化）的随机化值——单纯形法
  // 先合并重复的行 / 列（同一组结局的计划），再解 max Σp  s.t. A'ᵀp ≤ 1
  // ---------------------------------------------------------------
  function dedupe(A) {
    const rowKey = new Map(), rows = [], rowOf = [];
    A.forEach((r, i) => { const k = r.join(","); if (!rowKey.has(k)) { rowKey.set(k, rows.length); rows.push(i); } rowOf.push(rowKey.get(k)); });
    const B = rows.map((i) => A[i]);
    const colKey = new Map(), cols = [], colOf = [];
    for (let j = 0; j < A[0].length; j++) { const k = B.map((r) => r[j]).join(","); if (!colKey.has(k)) { colKey.set(k, cols.length); cols.push(j); } colOf.push(colKey.get(k)); }
    return { M: B.map((r) => cols.map((j) => r[j])), rows, cols };
  }
  function simplexMax(A, b, c) {
    const m = A.length, n = A[0].length, W = n + m + 1;
    const T = A.map((r, i) => { const row = new Float64Array(W); for (let j = 0; j < n; j++) row[j] = r[j]; row[n + i] = 1; row[W - 1] = b[i]; return row; });
    const z = new Float64Array(W); for (let j = 0; j < n; j++) z[j] = -c[j];
    const basis = Array.from({ length: m }, (_, i) => n + i);
    for (let it = 0; it < 5000; it++) {
      let col = -1;
      for (let j = 0; j < W - 1; j++) if (z[j] < -1e-11) { col = j; break; }     // Bland 规则
      if (col < 0) break;
      let r = -1, best = Infinity;
      for (let i = 0; i < m; i++) if (T[i][col] > 1e-12) { const q = T[i][W - 1] / T[i][col]; if (q < best - 1e-12 || (Math.abs(q - best) <= 1e-12 && basis[i] < basis[r])) { best = q; r = i; } }
      if (r < 0) break;
      const pr = T[r], pv = pr[col];
      for (let j = 0; j < W; j++) pr[j] /= pv;
      for (let i = 0; i < m; i++) if (i !== r) { const f = T[i][col]; if (f !== 0) { const row = T[i]; for (let j = 0; j < W; j++) row[j] -= f * pr[j]; } }
      const f = z[col]; for (let j = 0; j < W; j++) z[j] -= f * pr[j];
      basis[r] = col;
    }
    const x = new Array(n).fill(0); basis.forEach((bi, i) => { if (bi < n) x[bi] = T[i][W - 1]; });
    const y = Array.from({ length: m }, (_, i) => z[n + i]);
    return { val: z[W - 1], x, y };
  }
  function matrixGame(A) {
    const { M, rows, cols } = dedupe(A);
    let up = Infinity, lo = -Infinity;
    M.forEach((r) => { up = Math.min(up, Math.max(...r)); });
    for (let j = 0; j < M[0].length; j++) { let mn = Infinity; for (const r of M) mn = Math.min(mn, r[j]); lo = Math.max(lo, mn); }
    const res = { upper: up, lower: lo, rows: M.length, cols: M[0].length };
    if (up === lo) {
      const i = M.findIndex((r) => Math.max(...r) === up);
      let jj = 0; for (let j = 0; j < M[0].length; j++) { let mn = Infinity; for (const r of M) mn = Math.min(mn, r[j]); if (mn === lo) { jj = j; break; } }
      return Object.assign(res, { value: up, w: [[rows[i], 1]], z: [[cols[jj], 1]] });
    }
    const mn = Math.min(...M.map((r) => Math.min(...r)));
    const B = M.map((r) => r.map((v) => v - mn + 1));
    const m = B.length, n = B[0].length;
    const At = Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => B[i][j]));
    const { val, x, y } = simplexMax(At, new Array(n).fill(1), new Array(m).fill(1));
    const V = 1 / val;
    const w = x.map((v, i) => [rows[i], v * V]).filter((t) => t[1] > 1e-9);
    const z = y.map((v, j) => [cols[j], v * V]).filter((t) => t[1] > 1e-9);
    return Object.assign(res, { value: V + mn - 1, w, z });
  }

  window.CH11 = {
    colors, rgb, alpha, cv, cva, catVar, rng, gauss, newSeed, pick, randInt, toFrac, fmt, fmtD, sub, setStr,
    Stage, frame, seg, slider, select, checkbox, stat, button, legend, Runner, pauseWhenHidden,
    Raster, minCircle, M2, eig2, simplexMax, matrixGame,
  };
})();
