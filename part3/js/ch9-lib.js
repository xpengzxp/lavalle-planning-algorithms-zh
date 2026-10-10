/* 第 9 章共用小库：颜色、坐标图画布、组件外框与小控件、矩阵编辑器、数的显示、决策准则与博弈求解、单纯形坐标
   颜色约定（Part III）：蓝 = 机器人 / P1 的动作 u（行），橙 = 自然 / P2 的动作 θ、v（列），
   绿 = 选中的最优 / 均衡，红 = 最坏情况 / 遗憾 / 被支配，紫 = 概率分布（先验、后验、随机化策略）。 */
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
  // Part III 的角色色：P1 / 机器人、P2 / 自然、P3、最优、最坏、概率
  const ROLE = { p1: "accent", p2: "warn", p3: "goal", best: "ok", worst: "bad", prob: "alive2" };
  // 按动作区分区域时用的类别色（u1, u2, u3, u4）
  const ACT = ["accent", "goal", "mud", "dead"];

  function colors(el) {
    const o = {};
    for (const [k, v] of Object.entries(COLOR_VARS)) o[k] = cssVar(v, el) || "#888";
    for (const [k, v] of Object.entries(ROLE)) o[k] = o[v];
    o.act = ACT.map((k) => o[k]);
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
  function mix(c1, c2, t) { const a = rgb(c1), b = rgb(c2); return a.map((x, i) => Math.round(x + (b[i] - x) * t)); }
  // 图例 / 行内样式用：直接引用 CSS 变量，切换深浅色后自动更新
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
  let seedCounter = 9091;
  const newSeed = () => (seedCounter = (Math.imul(seedCounter, 1103515245) + 12345 + Date.now()) >>> 0);
  // 按权重抽一个下标
  function pick(weights, r) {
    const s = weights.reduce((a, b) => a + b, 0);
    let x = r() * s;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }

  // ---------------------------------------------------------------
  // 数：解析（支持 3/5 这样的分数）与显示（能写成小分母分数就写分数）
  // ---------------------------------------------------------------
  function parseNum(str) {
    str = String(str).trim().replace(/[−–]/g, "-");
    if (str === "") return NaN;
    const m = str.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) { const d = parseFloat(m[2]); return d === 0 ? NaN : parseFloat(m[1]) / d; }
    return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(str) ? parseFloat(str) : NaN;
  }
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
  const fmtP = (x) => (x * 100).toFixed(x < 0.001 ? 3 : 1) + "%";
  const fmtD = (x, d = 3) => (isFinite(x) ? minus(String(+x.toFixed(d))) : "–");
  const sub = (k) => String(k).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[+c] || c).join("");

  // ---------------------------------------------------------------
  // 坐标图画布：自适应宽度、高分屏、主题切换重画、x / y 独立缩放（equal: true 时等比例）、拖拽
  // ---------------------------------------------------------------
  class Plot {
    constructor(o) {
      this.o = Object.assign({ x: [0, 1], y: [0, 1], aspect: 0.62, maxW: 560, minW: 220, m: { l: 50, r: 14, t: 14, b: 34 }, equal: false }, o);
      this.wrap = h("div", { class: "ch9-plot" });
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
    // 像素距离（判断是否点中）
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
    path(P, color, lw, dash) {
      if (P.length < 2) return;
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.lineJoin = "round"; ctx.stroke(); ctx.setLineDash([]);
    }
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
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
    // 画框、网格、刻度与轴标签；xt / yt 是刻度数组，fx / fy 是刻度格式化函数
    axes(col, o) {
      o = Object.assign({ xt: [], yt: [], fx: fmt, fy: fmt, xl: "", yl: "", grid: true }, o);
      const ctx = this.ctx, [x0, x1] = this.o.x, [y0, y1] = this.o.y;
      ctx.fillStyle = col.surface; ctx.fillRect(this.X(x0), this.Y(y1), this.X(x1) - this.X(x0), this.Y(y0) - this.Y(y1));
      ctx.font = this.font(11); ctx.fillStyle = col.muted;
      for (const t of o.xt) {
        if (o.grid) this.line({ x: t, y: y0 }, { x: t, y: y1 }, col.grid, 1);
        ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(o.fx(t), this.X(t), this.Y(y0) + 4);
      }
      for (const t of o.yt) {
        if (o.grid) this.line({ x: x0, y: t }, { x: x1, y: t }, col.grid, 1);
        ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(o.fy(t), this.X(x0) - 5, this.Y(t));
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
  // 漂亮的刻度
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
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; el.key = (x) => { el.querySelector(".k").textContent = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }
  function checkbox(label, value, onChange) {
    const cb = h("input", { type: "checkbox", checked: value ? true : null });
    cb.addEventListener("change", () => onChange(cb.checked));
    const lab = h("label", null, cb, label); lab.input = cb; return lab;
  }
  // 公式 / 说明里出现 \( \) 时，重新交给 KaTeX 渲染
  function math(el) { if (window.renderMathInElement) PA.renderMath(el); }

  // 动画循环
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // ---------------------------------------------------------------
  // 矩阵编辑器：行 = P1 / 机器人（蓝），列 = P2 / 自然（橙）
  //   o.A：数矩阵；o.B：给出时为双矩阵模式（每格两个数 a, b）
  //   o.xcols / o.xrows：附加列 / 行的表头（例如「行最大」「列最小」），内容由 decorate 填
  //   o.decorate(ed)：每次数据变化后调用，用 ed.td(i,j) / ed.xc[k][i] / ed.xr[k][j] 上色、填数
  //   o.onCell(i,j)：非编辑状态下点击格子
  // ---------------------------------------------------------------
  class MatrixEditor {
    constructor(o) {
      this.o = Object.assign({ rowName: (i) => "u" + sub(i + 1), colName: (j) => "θ" + sub(j + 1), corner: "", minR: 2, maxR: 5, minC: 2, maxC: 5, resizable: true, xcols: [], xrows: [], editing: false }, o);
      this.A = o.A.map((r) => r.slice());
      this.B = o.B ? o.B.map((r) => r.slice()) : null;
      this.editing = this.o.editing;
      this.el = h("div", { class: "mx-wrap" });
      this.tools = h("div", { class: "mx-tools" });
      this.tbl = h("table", { class: "mx" + (this.B ? " pair" : "") });
      this.el.append(h("div", { class: "table-wrap", style: "margin:0" }, this.tbl), this.tools);
      this.editBtn = button("✎ 编辑数字", () => { this.editing = !this.editing; this.build(); });
      this.tools.append(this.editBtn);
      if (this.o.resizable) {
        this.tools.append(button("+ 行", () => this.resize(1, 0), "small"), button("− 行", () => this.resize(-1, 0), "small"),
          button("+ 列", () => this.resize(0, 1), "small"), button("− 列", () => this.resize(0, -1), "small"));
      }
      if (this.o.extraTools) this.tools.append(...this.o.extraTools);
      this.build();
    }
    get m() { return this.A.length; }
    get n() { return this.A[0].length; }
    set(A, B) { this.A = A.map((r) => r.slice()); if (B) this.B = B.map((r) => r.slice()); this.build(); this.changed(); }
    resize(dr, dc) {
      const m = Math.max(this.o.minR, Math.min(this.o.maxR, this.m + dr)), n = Math.max(this.o.minC, Math.min(this.o.maxC, this.n + dc));
      if (m === this.m && n === this.n) return;
      const grow = (M) => Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (M[i] && M[i][j] !== undefined ? M[i][j] : 0)));
      this.A = grow(this.A); if (this.B) this.B = grow(this.B);
      this.build(); this.changed();
    }
    changed() { if (this.o.onChange) this.o.onChange(this.A, this.B); this.decorate(); }
    input(M, i, j, cls) {
      const inp = h("input", { type: "text", inputmode: "decimal", value: fmt(M[i][j]).replace("−", "-"), class: cls || "", "aria-label": `${this.o.rowName(i)}, ${this.o.colName(j)}` });
      inp.addEventListener("input", () => { const v = parseNum(inp.value); inp.classList.toggle("bad-input", isNaN(v)); if (!isNaN(v)) { M[i][j] = v; this.changed(); } });
      return inp;
    }
    build() {
      const { o } = this;
      this.editBtn.textContent = this.editing ? "✓ 完成编辑" : "✎ 编辑数字";
      this.editBtn.classList.toggle("active", this.editing);
      this.tbl.innerHTML = "";
      const head = h("tr", null, h("th", { class: "corner" }, o.corner));
      for (let j = 0; j < this.n; j++) head.append(h("th", { class: "c" }, o.colName(j)));
      o.xcols.forEach((t) => head.append(h("th", { class: "x" }, t)));
      this.tbl.append(head);
      this.cells = []; this.xc = o.xcols.map(() => []); this.xr = o.xrows.map(() => []);
      for (let i = 0; i < this.m; i++) {
        const tr = h("tr", null, h("th", { class: "r" }, o.rowName(i)));
        const row = [];
        for (let j = 0; j < this.n; j++) {
          const td = h("td", { class: "cell" });
          if (this.editing) {
            if (this.B) td.append(this.input(this.A, i, j, "a"), h("span", { class: "comma" }, ","), this.input(this.B, i, j, "b"));
            else td.append(this.input(this.A, i, j));
          } else {
            td.classList.add("ro");
            if (this.B) td.append(h("span", { class: "a" }, fmt(this.A[i][j])), h("span", { class: "comma" }, ", "), h("span", { class: "b" }, fmt(this.B[i][j])));
            else td.append(h("span", { class: "v" }, fmt(this.A[i][j])));
            if (o.onCell) td.addEventListener("click", () => o.onCell(i, j));
          }
          row.push(td); tr.append(td);
        }
        o.xcols.forEach((_, k) => { const td = h("td", { class: "x" }); this.xc[k].push(td); tr.append(td); });
        this.cells.push(row); this.tbl.append(tr);
      }
      o.xrows.forEach((t, k) => {
        const tr = h("tr", { class: "xrow" }, h("th", { class: "x" }, t));
        for (let j = 0; j < this.n; j++) { const td = h("td", { class: "x" }); this.xr[k].push(td); tr.append(td); }
        o.xcols.forEach(() => tr.append(h("td", { class: "x blank" })));
        this.tbl.append(tr);
      });
      this.decorate();
    }
    td(i, j) { return this.cells[i][j]; }
    clearMarks() {
      this.cells.flat().forEach((td) => { td.className = "cell" + (this.editing ? "" : " ro"); td.removeAttribute("title"); });
      [...this.xc.flat(), ...this.xr.flat()].forEach((td) => { td.className = "x"; td.textContent = ""; });
    }
    decorate() { this.clearMarks(); if (this.o.decorate) this.o.decorate(this); }
  }

  // ---------------------------------------------------------------
  // 决策准则（9.2 节）与博弈求解（9.3、9.4 节）
  // ---------------------------------------------------------------
  const EPS = 1e-9;
  const argminAll = (vals) => { const m = Math.min(...vals); return vals.map((v, i) => (Math.abs(v - m) < EPS ? i : -1)).filter((i) => i >= 0); };
  const argmaxAll = (vals) => { const m = Math.max(...vals); return vals.map((v, i) => (Math.abs(v - m) < EPS ? i : -1)).filter((i) => i >= 0); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const colOf = (A, j) => A.map((r) => r[j]);
  function normalize(p) { const s = p.reduce((a, b) => a + b, 0); return s > 0 ? p.map((x) => x / s) : p.map(() => 1 / p.length); }
  // (9.20) 遗憾矩阵 T(u,θ) = L(u,θ) − min_u' L(u',θ)
  function regretMatrix(L) {
    const mins = L[0].map((_, j) => Math.min(...colOf(L, j)));
    return L.map((r) => r.map((v, j) => v - mins[j]));
  }
  // 9.1.1 节：a 支配 b
  const dominates = (a, b) => a.some((x, i) => x !== b[i]) && a.every((x, i) => x <= b[i] + EPS);

  // 零和：行最大、列最小、安全策略、上 / 下值、鞍点（9.3.2 节）
  function security(A) {
    const rowMax = A.map((r) => Math.max(...r));
    const colMin = A[0].map((_, j) => Math.min(...colOf(A, j)));
    const upper = Math.min(...rowMax), lower = Math.max(...colMin);
    return { rowMax, colMin, upper, lower, us: argminAll(rowMax), vs: argmaxAll(colMin) };
  }
  function saddles(A) {
    const out = [];
    A.forEach((r, i) => r.forEach((v, j) => {
      if (Math.abs(v - Math.max(...r)) < EPS && Math.abs(v - Math.min(...colOf(A, j))) < EPS) out.push([i, j]);
    }));
    return out;
  }
  // max c·x s.t. Mx ≤ b, x ≥ 0（b ≥ 0），Bland 规则；返回 {x, y(对偶), val}
  function simplexMax(c, M, b) {
    const m = M.length, n = c.length;
    const T = M.map((row, i) => [...row, ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)), b[i]]);
    let z = [...c.map((v) => -v), ...Array(m + 1).fill(0)];
    const basis = Array.from({ length: m }, (_, i) => n + i);
    for (let it = 0; it < 500; it++) {
      let enter = -1;
      for (let j = 0; j < n + m; j++) if (z[j] < -1e-11) { enter = j; break; }
      if (enter < 0) break;
      let r = -1, best = Infinity;
      for (let i = 0; i < m; i++) if (T[i][enter] > 1e-11) {
        const ratio = T[i][n + m] / T[i][enter];
        if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[r])) { best = ratio; r = i; }
      }
      if (r < 0) throw new Error("unbounded");
      const piv = T[r][enter]; T[r] = T[r].map((v) => v / piv);
      for (let i = 0; i < m; i++) if (i !== r && Math.abs(T[i][enter]) > 0) { const f = T[i][enter]; T[i] = T[i].map((v, k) => v - f * T[r][k]); }
      const f = z[enter]; z = z.map((v, k) => v - f * T[r][k]);
      basis[r] = enter;
    }
    const x = Array(n).fill(0);
    basis.forEach((j, i) => { if (j < n) x[j] = T[i][n + m]; });
    return { x, y: Array.from({ length: m }, (_, i) => z[n + i]), val: z[n + m] };
  }
  // 零和矩阵博弈的随机化鞍点（9.3.3 节）：P1 最小化 wAz，P2 最大化
  function solveZeroSum(A) {
    const m = A.length, n = A[0].length;
    const c = 1 - Math.min(...A.flat());
    const AT = Array.from({ length: n }, (_, j) => A.map((r) => r[j] + c));
    const { x, y, val } = simplexMax(Array(m).fill(1), AT, Array(n).fill(1));
    const V = 1 / val;
    const clean = (v) => normalize(v.map((t) => Math.max(0, t * V)));
    return { w: clean(x), z: clean(y), value: V - c };
  }
  // 非零和：纯 Nash（9.66、9.67）、混合（2×2 无差别条件）
  function pureNash(A, B) {
    const out = [];
    A.forEach((r, i) => r.forEach((a, j) => {
      if (Math.abs(a - Math.min(...colOf(A, j))) < EPS && Math.abs(B[i][j] - Math.min(...B[i])) < EPS) out.push([i, j]);
    }));
    return out;
  }
  function mixed2x2(A, B) {
    const da = A[0][0] - A[0][1] - A[1][0] + A[1][1], db = B[0][0] - B[0][1] - B[1][0] + B[1][1];
    if (Math.abs(da) < EPS || Math.abs(db) < EPS) return null;
    const z1 = (A[1][1] - A[0][1]) / da, w1 = (B[1][1] - B[1][0]) / db;
    if (z1 < -EPS || z1 > 1 + EPS || w1 < -EPS || w1 > 1 + EPS) return null;
    return { w1, z1 };
  }
  const expCost = (M, w, z) => w.reduce((s, wi, i) => s + wi * dot(M[i], z), 0);

  // ---------------------------------------------------------------
  // 概率：正态密度、分布函数
  // ---------------------------------------------------------------
  function erf(x) {
    // Abramowitz–Stegun 7.1.26 的改进版（误差 < 1.2e-7）
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  const npdf = (x, mu = 0, s = 1) => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
  const ncdf = (x, mu = 0, s = 1) => 0.5 * (1 + erf((x - mu) / (s * Math.SQRT2)));
  const entropy = (p) => -p.reduce((s, x) => s + (x > 0 ? x * Math.log2(x) : 0), 0);

  // ---------------------------------------------------------------
  // 概率单纯形（三个结果）：p = (p0, p1, p2) ↔ 平面坐标；顶点 V0 左下、V1 右下、V2 上
  // ---------------------------------------------------------------
  const SQ3 = Math.sqrt(3) / 2;
  const triXY = (p) => ({ x: p[1] + 0.5 * p[2], y: SQ3 * p[2] });
  function triP(q) { const p2 = q.y / SQ3, p1 = q.x - 0.5 * p2; return [1 - p1 - p2, p1, p2]; }
  function triClamp(p) { const c = p.map((x) => Math.max(0, x)); return normalize(c); }
  const TRI_V = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: SQ3 }];

  // 在单纯形上按函数着色（ImageData），fn(p) 返回 [r,g,b] 或 null
  function paintTriangle(plot, res, fn) {
    const x0 = plot.X(0), x1 = plot.X(1), yb = plot.Y(0), yt = plot.Y(SQ3);
    const W = Math.max(1, Math.round((x1 - x0) / res)), H = Math.max(1, Math.round((yb - yt) / res));
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const octx = off.getContext("2d"), img = octx.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = { x: (i + 0.5) / W, y: SQ3 * (1 - (j + 0.5) / H) };
      const p = triP(q);
      if (p[0] < -1e-9 || p[1] < -1e-9 || p[2] < -1e-9) continue;
      const c = fn(p); if (!c) continue;
      const o = (j * W + i) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    plot.ctx.imageSmoothingEnabled = true;
    plot.ctx.drawImage(off, x0, yt, x1 - x0, yb - yt);
  }

  window.CH9 = {
    COLOR_VARS, ROLE, ACT, colors, rgb, alpha, mix, cv, cva, rng, gauss, newSeed, pick,
    parseNum, toFrac, fmt, fmtP, fmtD, sub, Plot, ticks, frame, seg, slider, select, stat, button, legend, checkbox, math, Runner,
    MatrixEditor, EPS, argminAll, argmaxAll, dot, colOf, normalize, regretMatrix, dominates,
    security, saddles, simplexMax, solveZeroSum, pureNash, mixed2x2, expCost,
    erf, npdf, ncdf, entropy, SQ3, triXY, triP, triClamp, TRI_V, paintTriangle,
  };
})();
