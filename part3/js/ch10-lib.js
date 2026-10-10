/* 第 10 章共用小库：画布舞台、控件、可复现随机数、精确分数、矩阵博弈求解、网格世界（自然模型、值迭代） */
(function () {
  "use strict";
  const { h, cssVar, fitCanvas, onThemeChange } = PA;
  const INF = Infinity;

  // ---------------------------------------------------------------
  // 颜色：每次重画时从 CSS 变量读取，深色模式自动生效。
  // Part III 的颜色约定：蓝 = 决策者 / P1，琥珀 = 自然，紫 = 对手 P2，绿 = 目标 X_G 与执行轨迹，灰 = 障碍
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
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function alpha(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  // 在两种颜色之间插值，t ∈ [0,1]
  function mix(hexA, hexB, t) {
    const a = rgb(hexA), b = rgb(hexB);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  // 代价热图：0 → 表面色，vmax → 强调色的 70%
  function heat(col, v, vmax) {
    if (v === INF || !(v < INF)) return col.badSoft;
    const t = vmax > 0 ? Math.min(1, Math.max(0, v / vmax)) : 0;
    return mix(col.surface, col.accent, 0.08 + 0.62 * t);
  }
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;

  // ---------------------------------------------------------------
  // 随机数（mulberry32，可复现）
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
  let seedCounter = 4242;
  const newSeed = () => (seedCounter = (seedCounter * 1103515245 + 12345 + Date.now()) >>> 0);
  // 按 [[值, 概率], ...] 抽样
  function pick(pairs, r) {
    let u = r(), acc = 0;
    for (const [v, p] of pairs) { acc += p; if (u <= acc) return v; }
    return pairs[pairs.length - 1][0];
  }

  // ---------------------------------------------------------------
  // 精确分数（分子分母都很小，用 Number 足够）
  // ---------------------------------------------------------------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  class Frac {
    constructor(n, d = 1) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); this.n = n / g; this.d = d / g; }
    static of(x) { return x instanceof Frac ? x : new Frac(x, 1); }
    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    cmp(o) { o = Frac.of(o); return this.n * o.d - o.n * this.d; }
    isZero() { return this.n === 0; }
    get v() { return this.n / this.d; }
    toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
    tex() { return this.d === 1 ? String(this.n) : `${this.n < 0 ? "-" : ""}\\tfrac{${Math.abs(this.n)}}{${this.d}}`; }
  }
  // 精确高斯消元：A x = b（Frac）
  function solveFrac(A, b) {
    const n = b.length, M = A.map((r, i) => r.map(Frac.of).concat([Frac.of(b[i])]));
    for (let c = 0; c < n; c++) {
      let r = c; while (r < n && M[r][c].isZero()) r++;
      if (r === n) return null;
      [M[c], M[r]] = [M[r], M[c]];
      for (let i = 0; i < n; i++) if (i !== c && !M[i][c].isZero()) {
        const f = M[i][c].div(M[c][c]);
        M[i] = M[i].map((v, k) => v.sub(f.mul(M[c][k])));
      }
    }
    return M.map((r, i) => r[n].div(r[i]));
  }
  // 浮点高斯消元（部分选主元）
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.slice().concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let r = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[r][c])) r = i;
      if (Math.abs(M[r][c]) < 1e-14) return null;
      [M[c], M[r]] = [M[r], M[c]];
      for (let i = 0; i < n; i++) if (i !== c) { const f = M[i][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  // 把小数还原成分母不大的分数（只用于显示）
  function niceFrac(x, maxDen = 60) {
    if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
    for (let d = 1; d <= maxDen; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return d === 1 ? String(n) : `${n}/${d}`; }
    return x.toFixed(3);
  }
  const fmt = (v, d = 2) => (v === INF ? "∞" : v === -INF ? "−∞" : (Number.isInteger(v) ? String(v) : v.toFixed(d)));

  // ---------------------------------------------------------------
  // 矩阵博弈（9.3.3 节）：代价矩阵 A，行 = P1（最小化），列 = P2（最大化）
  // ---------------------------------------------------------------
  function detValues(A) {
    const m = A.length, n = A[0].length;
    let upper = INF, lower = -INF, ui = 0, lj = 0;
    for (let i = 0; i < m; i++) { const mx = Math.max(...A[i]); if (mx < upper - 1e-12) { upper = mx; ui = i; } }
    for (let j = 0; j < n; j++) { let mn = INF; for (let i = 0; i < m; i++) mn = Math.min(mn, A[i][j]); if (mn > lower + 1e-12) { lower = mn; lj = j; } }
    return { upper, lower, ui, lj };
  }
  // 单纯形：max c·x s.t. A x ≤ b（b ≥ 0），x ≥ 0；Bland 规则。返回 {val, x, y}（y 为对偶）
  function simplexMax(A, b, c) {
    const m = A.length, n = c.length;
    const T = A.map((r, i) => r.concat(Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), [b[i]]));
    let z = c.map((v) => -v).concat(new Array(m).fill(0), [0]);
    const basis = Array.from({ length: m }, (_, i) => n + i);
    for (let guard = 0; guard < 500; guard++) {
      let col = -1; for (let j = 0; j < n + m; j++) if (z[j] < -1e-12) { col = j; break; }
      if (col < 0) break;
      let row = -1, best = INF;
      for (let i = 0; i < m; i++) if (T[i][col] > 1e-12) {
        const r = T[i][n + m] / T[i][col];
        if (r < best - 1e-12 || (Math.abs(r - best) <= 1e-12 && basis[i] < basis[row])) { best = r; row = i; }
      }
      if (row < 0) break;   // 无界（矩阵博弈里不会发生）
      const pv = T[row][col]; T[row] = T[row].map((v) => v / pv);
      for (let i = 0; i < m; i++) if (i !== row && Math.abs(T[i][col]) > 0) { const f = T[i][col]; T[i] = T[i].map((v, k) => v - f * T[row][k]); }
      const f = z[col]; z = z.map((v, k) => v - f * T[row][k]);
      basis[row] = col;
    }
    const x = new Array(n).fill(0);
    basis.forEach((bv, i) => { if (bv < n) x[bv] = T[i][n + m]; });
    return { val: z[n + m], x, y: z.slice(n, n + m) };
  }
  // 随机化值与随机化安全策略 w（P1）、z（P2）
  function matrixGame(A) {
    const m = A.length, n = A[0].length;
    let lo = INF; for (const r of A) for (const v of r) lo = Math.min(lo, v);
    const B = A.map((r) => r.map((v) => v - lo + 1));
    const Bt = Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => B[i][j]));
    const { val, x, y } = simplexMax(Bt, new Array(n).fill(1), new Array(m).fill(1));
    const V = 1 / val;
    return { value: V + lo - 1, w: x.map((v) => v * V), z: y.map((v) => v * V) };
  }

  // ---------------------------------------------------------------
  // 网格世界：状态 = 格子 (i, j)，动作 0 停、1 右、2 上、3 左、4 下（例 10.2 的编号）
  // ---------------------------------------------------------------
  const MOVES = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]];
  const ARROW = ["·", "→", "↑", "←", "↓"];
  const MOVE_NAME = ["停", "右", "上", "左", "下"];
  class Grid {
    // obs、goal、ice：集合，元素为 "i,j" 字符串
    constructor(W, H, obs, goal, opts) {
      this.W = W; this.H = H;
      this.obs = new Set(obs || []); this.goal = new Set(goal || []);
      this.ice = new Set((opts && opts.ice) || []);
      this.origin = (opts && opts.origin) || 0;   // 图 10.1 的坐标从 1 开始
      this.N = W * H;
    }
    id(i, j) { return j * this.W + i; }
    ij(id) { return [id % this.W, Math.floor(id / this.W)]; }
    key(id) { const [i, j] = this.ij(id); return i + "," + j; }
    inX(i, j) { return i >= 0 && j >= 0 && i < this.W && j < this.H && !this.obs.has(i + "," + j); }
    free(id) { return !this.obs.has(this.key(id)); }
    isGoal(id) { return this.goal.has(this.key(id)); }
    isIce(id) { return this.ice.has(this.key(id)); }
    label(id) { const [i, j] = this.ij(id); return `(${i + this.origin}, ${j + this.origin})`; }
    // U(x)：留在 X 中的动作（不含 u_T）。stay = false 时不含「停」
    actions(id, stay = true) {
      const [i, j] = this.ij(id), out = [];
      for (let u = stay ? 0 : 1; u < 5; u++) if (this.inX(i + MOVES[u][0], j + MOVES[u][1])) out.push(u);
      return out;
    }
    // 自然：返回 [[θ, P(θ|x,u)], ...]
    //   model.kind：'none' 无自然；'ex102' 例 10.2（从 x+u 出发所有可用动作，均匀）；
    //   'slip' 补充：向 u 的两侧横滑，概率 model.p（两侧各一半，不可用的不计，重新归一）；
    //   'ice'  补充：只有在冰面格子上才按 'slip' 横滑。
    nature(id, u, model) {
      const [i, j] = this.ij(id), yi = i + MOVES[u][0], yj = j + MOVES[u][1];
      let kind = model.kind;
      if (kind === "ice") kind = this.isIce(id) ? "slip" : "none";
      if (kind === "none") return [[0, 1]];
      if (kind === "ex102") {
        const th = []; for (let a = 0; a < 5; a++) if (this.inX(yi + MOVES[a][0], yj + MOVES[a][1])) th.push(a);
        return th.map((a) => [a, 1 / th.length]);
      }
      if (u === 0) return [[0, 1]];
      const p = model.p === undefined ? 0.2 : model.p;
      const side = u === 1 || u === 3 ? [2, 4] : [1, 3];
      const cand = [[0, 1 - p]];
      for (const a of side) if (this.inX(yi + MOVES[a][0], yj + MOVES[a][1])) cand.push([a, p / 2]);
      const tot = cand.reduce((s, c) => s + c[1], 0);
      return cand.map(([a, q]) => [a, q / tot]);
    }
    // 下一状态分布：[[id', P], ...]（同一状态合并）
    succ(id, u, model) {
      const [i, j] = this.ij(id), m = new Map();
      for (const [a, p] of this.nature(id, u, model)) {
        const z = this.id(i + MOVES[u][0] + MOVES[a][0], j + MOVES[u][1] + MOVES[a][1]);
        m.set(z, (m.get(z) || 0) + p);
      }
      return Array.from(m.entries());
    }
    freeIds() { const o = []; for (let k = 0; k < this.N; k++) if (this.free(k)) o.push(k); return o; }
  }
  // 后向值迭代的一次扫描（式 10.39 / 10.46）。G：Float64Array（∞ 用 Infinity）
  //   kind：'worst' | 'exp'；lF：非目标状态用 u_T 的代价；stay：是否允许「停」
  function viSweep(grid, G, model, kind, lF, stay, cache) {
    const Gn = new Float64Array(grid.N).fill(INF);
    let change = 0, finiteFlip = false;
    for (let x = 0; x < grid.N; x++) {
      if (!grid.free(x)) continue;
      if (grid.isGoal(x)) { Gn[x] = 0; continue; }
      let best = lF;
      for (const u of grid.actions(x, stay)) {
        const S = cache ? cache(x, u) : grid.succ(x, u, model);
        let v;
        if (kind === "worst") { let m = -INF; for (const [z] of S) m = Math.max(m, G[z]); v = 1 + m; }
        else { let s = 0; for (const [z, p] of S) { if (G[z] === INF) { s = INF; break; } s += p * G[z]; } v = 1 + s; }
        if (v < best) best = v;
      }
      Gn[x] = best;
      if (best < INF && G[x] < INF) change = Math.max(change, Math.abs(best - G[x]));
      else if ((best < INF) !== (G[x] < INF)) finiteFlip = true;
    }
    return { G: Gn, change: finiteFlip ? INF : change };
  }
  // 由代价到目标恢复动作（式 10.48 / 10.49）
  function greedy(grid, G, model, kind, x, stay, cache) {
    let best = INF, bu = -1;
    for (const u of grid.actions(x, stay)) {
      const S = cache ? cache(x, u) : grid.succ(x, u, model);
      let v;
      if (kind === "worst") { let m = -INF; for (const [z] of S) m = Math.max(m, G[z]); v = 1 + m; }
      else { let s = 0; for (const [z, p] of S) s += p * G[z]; v = 1 + s; }
      if (v < best - 1e-9) { best = v; bu = u; }
    }
    return { u: bu, v: best };
  }
  // 带缓存的后继函数
  function succCache(grid, model) {
    const memo = new Map();
    return (x, u) => { const k = x * 5 + u; let s = memo.get(k); if (!s) { s = grid.succ(x, u, model); memo.set(k, s); } return s; };
  }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽 / 点击
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 220, view: [0, 1, 0, 1], pad: 6 }, opts);
      this.wrap = h("div", { class: "ch10-stage" });
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
    dot(x, y, r, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), r, 0, 2 * Math.PI);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
    }
    line(x0, y0, x1, y1, color, lw, dash) {
      const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(this.X(x0), this.Y(y0)); ctx.lineTo(this.X(x1), this.Y(y1));
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
    // 带箭头的线段（像素空间画箭头头部）
    arrow(x0, y0, x1, y1, color, lw, head, dash) {
      const ctx = this.ctx, X0 = this.X(x0), Y0 = this.Y(y0), X1 = this.X(x1), Y1 = this.Y(y1);
      const L = Math.hypot(X1 - X0, Y1 - Y0); if (L < 1e-6) return;
      const hd = head || 7, ux = (X1 - X0) / L, uy = (Y1 - Y0) / L;
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1 - ux * hd * 0.6, Y1 - uy * hd * 0.6);
      ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X1 - ux * hd - uy * hd * 0.5, Y1 - uy * hd + ux * hd * 0.5);
      ctx.lineTo(X1 - ux * hd + uy * hd * 0.5, Y1 - uy * hd - ux * hd * 0.5); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    }
    rect(x0, y0, x1, y1, fill, stroke, lw) {
      const ctx = this.ctx, X = this.X(x0), Y = this.Y(y1), w = this.X(x1) - this.X(x0), hh = this.Y(y0) - this.Y(y1);
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(X, Y, w, hh); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.strokeRect(X + 0.5, Y + 0.5, w - 1, hh - 1); }
    }
    text(str, x, y, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(x) + o.dx, this.Y(y) + o.dy);
    }
  }

  // 在 Stage 上画一个网格世界：单元格 (i, j) 占 [i, i+1] × [j, j+1]
  //   fill(id) 返回填充色（null 用默认）；label(id) 返回格内文字
  function drawGrid(st, grid, col, opts) {
    const o = Object.assign({ fill: null, label: null, labelColor: null, labelSize: 0 }, opts);
    const ctx = st.ctx, s = st.scale;
    for (let id = 0; id < grid.N; id++) {
      const [i, j] = grid.ij(id);
      let f;
      if (!grid.free(id)) f = alpha(col.wall, 0.85);
      else f = (o.fill && o.fill(id)) || (grid.isGoal(id) ? alpha(col.ok, 0.28) : col.surface);
      st.rect(i, j, i + 1, j + 1, f);
      if (grid.free(id) && grid.isIce(id)) {      // 冰面：斜线纹理
        ctx.save(); ctx.beginPath(); ctx.rect(st.X(i), st.Y(j + 1), s, s); ctx.clip();
        ctx.strokeStyle = alpha(col.accent, 0.28); ctx.lineWidth = 1;
        for (let t = -1; t <= 1; t += 0.34) { ctx.beginPath(); ctx.moveTo(st.X(i + t), st.Y(j)); ctx.lineTo(st.X(i + t + 1), st.Y(j + 1)); ctx.stroke(); }
        ctx.restore();
      }
      if (grid.free(id) && grid.isGoal(id)) st.rect(i, j, i + 1, j + 1, null, alpha(col.ok, 0.6), 1);
    }
    // 网格线
    ctx.strokeStyle = col.border; ctx.lineWidth = 1;
    for (let i = 0; i <= grid.W; i++) { ctx.beginPath(); ctx.moveTo(Math.round(st.X(i)) + 0.5, st.Y(0)); ctx.lineTo(Math.round(st.X(i)) + 0.5, st.Y(grid.H)); ctx.stroke(); }
    for (let j = 0; j <= grid.H; j++) { ctx.beginPath(); ctx.moveTo(st.X(0), Math.round(st.Y(j)) + 0.5); ctx.lineTo(st.X(grid.W), Math.round(st.Y(j)) + 0.5); ctx.stroke(); }
    ctx.strokeStyle = col.strong; ctx.lineWidth = 1.5; ctx.strokeRect(st.X(0), st.Y(grid.H), grid.W * s, grid.H * s);
    if (o.label) {
      const size = o.labelSize || Math.max(8, Math.min(13, s * 0.36));
      for (let id = 0; id < grid.N; id++) {
        if (!grid.free(id)) continue;
        const t = o.label(id); if (t === null || t === undefined || t === "") continue;
        const [i, j] = grid.ij(id);
        st.text(String(t), i + 0.5, j + 0.5, (o.labelColor && o.labelColor(id)) || col.text2, { size, weight: 550 });
      }
    }
  }
  // 在格子中心画动作箭头
  function drawArrow(st, i, j, u, color, frac = 0.34, lw = 1.8) {
    if (u === 0) { st.dot(i + 0.5, j + 0.5, Math.max(2, st.scale * 0.08), color); return; }
    const [dx, dy] = MOVES[u];
    st.arrow(i + 0.5 - dx * frac, j + 0.5 - dy * frac, i + 0.5 + dx * frac, j + 0.5 + dy * frac, color, lw, Math.max(5, Math.min(11, st.scale * 0.16)));
  }
  // 贴着格子边缘画一个小三角，指向动作 u 的方向（格子中央留给数字）
  function drawChevron(st, i, j, u, color) {
    const ctx = st.ctx, s2 = st.scale, cx = st.X(i + 0.5), cy = st.Y(j + 0.5);
    if (u === 0) { st.dot(i + 0.5, j + 0.15, Math.max(1.5, s2 * 0.05), color); return; }
    const [dx, dy] = MOVES[u], ux = dx, uy = -dy;           // 像素坐标里 y 向下
    const tip = s2 * 0.47, base = s2 * 0.31, half = s2 * 0.13;
    ctx.beginPath();
    ctx.moveTo(cx + ux * tip, cy + uy * tip);
    ctx.lineTo(cx + ux * base - uy * half, cy + uy * base + ux * half);
    ctx.lineTo(cx + ux * base + uy * half, cy + uy * base - ux * half);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  // 由鼠标位置找格子
  function cellAt(grid, p) { const i = Math.floor(p.x), j = Math.floor(p.y); return i >= 0 && j >= 0 && i < grid.W && j < grid.H ? grid.id(i, j) : -1; }

  // ---------------------------------------------------------------
  // 组件外框 & 小控件（与第 5 章的写法一致）
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
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }
  function checkbox(label, value, onChange) {
    const inp = h("input", { type: "checkbox", checked: value ? true : null });
    inp.addEventListener("change", () => onChange(inp.checked));
    const lab = h("label", null, inp, label); lab.input = inp; return lab;
  }
  // KaTeX 渲染一个元素（页面加载完成之后插入的内容要手动渲染）
  function tex(el) { if (window.renderMathInElement) PA.renderMath(el); else window.addEventListener("load", () => PA.renderMath(el), { once: true }); }

  // 简单的动画循环
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // 小折线图（SVG）：series = [{pts:[[x,y],...], color, label, dash}]；logY 时 y 取 log10
  function lineChart(series, opts) {
    const { s } = PA;
    const o = Object.assign({ w: 360, h: 180, logY: false, xLabel: "", yLabel: "", yMin: null, yMax: null, xMax: null, marks: [] }, opts);
    const L = 44, R = 16, T = o.yLabel ? 22 : 10, B = 30;
    const tr = (y) => (o.logY ? Math.log10(Math.max(y, 1e-16)) : y);
    let xs = [], ys = [];
    for (const se of series) for (const [x, y] of se.pts) if (isFinite(y)) { xs.push(x); ys.push(tr(y)); }
    if (!xs.length) { xs = [0, 1]; ys = [0, 1]; }
    const x0 = 0, x1 = o.xMax !== null ? o.xMax : Math.max(1, ...xs);
    let y0 = o.yMin !== null ? tr(o.yMin) : Math.min(...ys), y1 = o.yMax !== null ? tr(o.yMax) : Math.max(...ys);
    if (y1 - y0 < 1e-9) { y1 += 1; y0 -= o.logY ? 1 : 0; }
    const X = (x) => L + (x - x0) / (x1 - x0) * (o.w - L - R), Y = (y) => T + (1 - (tr(y) - y0) / (y1 - y0)) * (o.h - T - B);
    const svg = s("svg", { viewBox: `0 0 ${o.w} ${o.h}`, width: o.w, height: o.h, role: "img" });
    svg.append(s("rect", { x: L, y: T, width: o.w - L - R, height: o.h - T - B, fill: "var(--surface)", stroke: "var(--border)" }));
    // y 刻度
    const ticks = [];
    if (o.logY) { for (let e = Math.ceil(y0); e <= Math.floor(y1); e++) ticks.push(e); }
    else { const step = niceStep((y1 - y0) / 4); for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) ticks.push(v); }
    for (const t of ticks) {
      const yy = T + (1 - (t - y0) / (y1 - y0)) * (o.h - T - B);
      svg.append(s("line", { x1: L, x2: o.w - R, y1: yy, y2: yy, stroke: "var(--border)", "stroke-dasharray": "2 3" }));
      svg.append(s("text", { x: L - 4, y: yy + 3.5, "text-anchor": "end", "font-size": 10, fill: "var(--muted)" }, o.logY ? `1e${t}` : fmtTick(t)));
    }
    const xstep = niceStep((x1 - x0) / 5);
    for (let v = 0; v <= x1 + 1e-9; v += xstep) svg.append(s("text", { x: X(v), y: o.h - B + 13, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" }, fmtTick(v)));
    if (o.xLabel) svg.append(s("text", { x: (L + o.w - R) / 2, y: o.h - 3, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, o.xLabel));
    if (o.yLabel) svg.append(s("text", { x: L, y: 13, "font-size": 10.5, fill: "var(--muted)" }, o.yLabel));
    for (const m of o.marks) {
      if (m.y !== undefined) { const yy = Y(m.y); svg.append(s("line", { x1: L, x2: o.w - R, y1: yy, y2: yy, stroke: m.color || "var(--muted)", "stroke-dasharray": "5 4" })); if (m.label) svg.append(s("text", { x: o.w - R - 3, y: yy - 4, "text-anchor": "end", "font-size": 10, fill: m.color || "var(--muted)" }, m.label)); }
      if (m.x !== undefined) { const xx = X(m.x); svg.append(s("line", { x1: xx, x2: xx, y1: T, y2: o.h - B, stroke: m.color || "var(--muted)", "stroke-dasharray": "5 4" })); if (m.label) svg.append(s("text", { x: xx + 3, y: T + 11, "font-size": 10, fill: m.color || "var(--muted)" }, m.label)); }
    }
    for (const se of series) {
      const pts = se.pts.filter(([, y]) => isFinite(y));
      if (!pts.length) continue;
      svg.append(s("polyline", { points: pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(Math.max(y, o.logY ? 1e-16 : -INF)).toFixed(1)}`).join(" "), fill: "none", stroke: se.color, "stroke-width": se.width || 1.8, "stroke-dasharray": se.dash || null }));
    }
    return svg;
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-12)))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function fmtTick(v) { return Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(Math.abs(v) < 1 ? 2 : 1); }

  window.CH10 = {
    INF, colors, rgb, alpha, mix, heat, cv, cva, rng, newSeed, pick,
    Frac, solveFrac, solve, niceFrac, fmt, detValues, simplexMax, matrixGame,
    MOVES, ARROW, MOVE_NAME, Grid, viSweep, greedy, succCache,
    Stage, drawGrid, drawArrow, drawChevron, cellAt,
    frame, seg, slider, select, stat, button, legend, checkbox, tex, Runner, lineChart,
  };
})();
