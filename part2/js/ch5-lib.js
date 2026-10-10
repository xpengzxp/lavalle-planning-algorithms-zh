/* 第 5 章共用小库：画布舞台、可复现随机数、采样序列、2D 几何与碰撞、示例 C-space 地图 */
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
  // "#rrggbb" → "rgba(r,g,b,a)"
  function alpha(hex, a) {
    hex = (hex || "#888").trim();
    if (hex[0] !== "#") return hex;
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function rgb(hex) {
    hex = (hex || "#888").trim();
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
  let seedCounter = 12345;
  const newSeed = () => (seedCounter = (seedCounter * 1103515245 + 12345 + Date.now()) >>> 0);

  // ---------------------------------------------------------------
  // 采样序列（式 5.24–5.27）
  // ---------------------------------------------------------------
  function radInv(i, p) { let f = 1 / p, r = 0; while (i > 0) { r += f * (i % p); i = Math.floor(i / p); f /= p; } return r; }
  const PHI = (Math.sqrt(5) + 1) / 2;
  const frac = (x) => x - Math.floor(x);

  // 二维点集生成器：返回 [{x,y,extra?}]，坐标在 [0,1]
  const SAMPLERS = {
    random: { name: "伪随机", gen(k, seed) { const r = rng(seed); return Array.from({ length: k }, () => ({ x: r(), y: r() })); } },
    lcgBad: {
      name: "LCG（坏参数）", gen(k) {
        // 式 (5.16)(5.17)：M = 2^16, a = 9, c = 1；把相邻两个数当作 (x, y)
        const M = 65536, a = 9, c = 1; let y = 1; const nxt = () => { y = (a * y + c) % M; return y / M; };
        return Array.from({ length: k }, () => ({ x: nxt(), y: nxt() }));
      },
    },
    lcgGood: {
      name: "LCG（M=2³¹−1）", gen(k) {
        const M = 2147483647, a = 16807; let y = 12345;
        const nxt = () => { y = Number((BigInt(a) * BigInt(y)) % BigInt(M)); return y / M; };
        return Array.from({ length: k }, () => ({ x: nxt(), y: nxt() }));
      },
    },
    stdgrid: {
      name: "标准网格", gen(k) {
        const m = Math.max(1, Math.floor(Math.sqrt(k))); const out = [];
        for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) out.push({ x: a / m, y: b / m });
        const r = rng(7); while (out.length < k) out.push({ x: r(), y: r(), extra: true });
        return out;
      },
    },
    sukharev: {
      name: "Sukharev 网格", gen(k) {
        const m = Math.max(1, Math.floor(Math.sqrt(k))); const out = [];
        for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) out.push({ x: (a + 0.5) / m, y: (b + 0.5) / m });
        const r = rng(7); while (out.length < k) out.push({ x: r(), y: r(), extra: true });
        return out;
      },
    },
    mrgrid: {
      name: "多分辨率网格", gen(k) {
        // 5.2.3 节「无限网格序列」：每次取两位二进制选象限（相当于逐坐标做位反转）
        const out = [];
        for (let i = 0; i < k; i++) {
          let x = 0, y = 0, f = 0.5, n = i;
          while (n > 0) { x += f * (n & 1); n >>= 1; y += f * (n & 1); n >>= 1; f /= 2; }
          out.push({ x, y });
        }
        return out;
      },
    },
    halton: { name: "Halton (2,3)", gen(k) { return Array.from({ length: k }, (_, i) => ({ x: radInv(i, 2), y: radInv(i, 3) })); } },
    hammersley: { name: "Hammersley", gen(k) { return Array.from({ length: k }, (_, i) => ({ x: i / k, y: radInv(i, 2) })); } },
    lattice: { name: "黄金比格点", gen(k) { return Array.from({ length: k }, (_, i) => ({ x: i / k, y: frac(i * PHI) })); } },
  };

  // 无限稠密序列 α(i)，i 从 0 开始，返回 [0,1]^2 中的点（供 RDT / PRM 使用）
  function makeSequence(kind, seed) {
    if (kind === "halton") { let i = 1; return () => ({ x: radInv(i, 2), y: radInv(i++, 3) }); }
    if (kind === "mrgrid") {
      let i = 1;
      return () => { let x = 0, y = 0, f = 0.5, n = i++; while (n > 0) { x += f * (n & 1); n >>= 1; y += f * (n & 1); n >>= 1; f /= 2; } return { x: x + 0.5 / 4096, y: y + 0.5 / 4096 }; };
    }
    const r = rng(seed); return () => ({ x: r(), y: r() });
  }

  // ---------------------------------------------------------------
  // 2D 几何
  // ---------------------------------------------------------------
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
    t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), t };
  }
  function polyArea(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j].x + P[i].x) * (P[j].y - P[i].y); return Math.abs(s) / 2; }
  function convexHull(pts) {
    const P = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (P.length < 3) return P;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }

  // ---------------------------------------------------------------
  // 障碍集合（C-space 中的 Cobs，用若干多边形表示）
  // ---------------------------------------------------------------
  class Obstacles {
    constructor(polys, bounds) {
      this.B = bounds || { x0: 0, y0: 0, x1: 1, y1: 1 };
      this.polys = polys.map((P) => ({ P, box: polyBox(P) }));
      this.checks = 0;  // 碰撞检测调用次数（点 + 线段）
    }
    pointFree(p) {
      this.checks++;
      const B = this.B;
      if (p.x < B.x0 || p.x > B.x1 || p.y < B.y0 || p.y > B.y1) return false;
      for (const o of this.polys) {
        if (p.x < o.box.x0 || p.x > o.box.x1 || p.y < o.box.y0 || p.y > o.box.y1) continue;
        if (inPoly(p, o.P)) return false;
      }
      return true;
    }
    // 沿 p→q 第一次碰到障碍的参数 t∈[0,1]；全程无碰撞返回 1（假设 p 本身是自由的）
    firstHit(p, q) {
      this.checks++;
      let best = Infinity;
      const bx0 = Math.min(p.x, q.x), bx1 = Math.max(p.x, q.x), by0 = Math.min(p.y, q.y), by1 = Math.max(p.y, q.y);
      for (const o of this.polys) {
        if (bx1 < o.box.x0 || bx0 > o.box.x1 || by1 < o.box.y0 || by0 > o.box.y1) continue;
        const P = o.P;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const t = segHitT(p, q, P[j], P[i]);
          if (t < best) best = t;
        }
      }
      // C-space 的边界也当作障碍
      const Bd = this.B;
      if (q.x < Bd.x0 || q.x > Bd.x1 || q.y < Bd.y0 || q.y > Bd.y1) {
        const B = rect(Bd.x0, Bd.y0, Bd.x1, Bd.y1);
        for (let i = 0, j = 3; i < 4; j = i++) { const t = segHitT(p, q, B[j], B[i]); if (t < best) best = t; }
      }
      return best === Infinity ? 1 : best;
    }
    segFree(p, q) { return this.firstHit(p, q) >= 1 && this.pointFreeQuiet(q); }
    pointFreeQuiet(p) { const c = this.checks; const r = this.pointFree(p); this.checks = c; return r; }
    // 到障碍（及边界）的欧氏距离；在障碍里返回 0
    clearance(p, withBounds = true) {
      if (!this.pointFreeQuiet(p)) return 0;
      const B = this.B;
      let d = withBounds ? Math.min(p.x - B.x0, B.x1 - p.x, p.y - B.y0, B.y1 - p.y) : Infinity;
      for (const o of this.polys) {
        const P = o.P;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, segPointDist(p, P[j], P[i]).d);
      }
      return d;
    }
    freeArea(res = 160) {
      let n = 0;
      for (let i = 0; i < res; i++) for (let j = 0; j < res; j++) if (this.pointFreeQuiet({ x: (i + 0.5) / res, y: (j + 0.5) / res })) n++;
      return n / (res * res);
    }
  }

  // 示例地图：都直接画在 2D C-space [0,1]^2 里（点机器人），障碍就是 Cobs
  const R = rect;
  const MAPS = {
    empty: { name: "空旷", polys: [], qI: { x: 0.1, y: 0.1 }, qG: { x: 0.9, y: 0.9 } },
    clutter: {
      name: "杂乱障碍",
      polys: [R(.18, .12, .3, .42), R(.42, 0, .5, .3), R(.62, .16, .86, .26), R(.1, .58, .38, .66), R(.48, .44, .6, .78),
        R(.72, .4, .8, .7), R(.22, .78, .36, 1), R(.68, .84, .92, .92),
        [{ x: .02, y: .4 }, { x: .12, y: .46 }, { x: .05, y: .52 }], [{ x: .86, y: .5 }, { x: .98, y: .58 }, { x: .9, y: .68 }]],
      qI: { x: 0.06, y: 0.06 }, qG: { x: 0.94, y: 0.96 },
    },
    narrow: {
      name: "窄通道", polys: [R(.46, 0, .54, .475), R(.46, .505, .54, 1)],
      qI: { x: 0.15, y: 0.5 }, qG: { x: 0.85, y: 0.5 },
    },
    bowl: {
      name: "碗（图 5.13a）",
      polys: [R(.55, .3, .6, .7), R(.38, .3, .6, .35), R(.38, .65, .6, .7)],
      qI: { x: 0.46, y: 0.5 }, qG: { x: 0.9, y: 0.5 },
    },
    bugtrap: {
      name: "虫子陷阱（图 5.13b）",
      // 一个「瓶子」罩住 qI，瓶口朝左上，开口很窄
      polys: [R(.18, .22, .62, .28), R(.56, .22, .62, .72), R(.18, .66, .62, .72), R(.18, .22, .24, .42), R(.18, .48, .24, .72),
        R(.04, .42, .24, .435), R(.04, .465, .24, .48)],
      qI: { x: 0.42, y: 0.47 }, qG: { x: 0.9, y: 0.88 },
    },
    double: {
      name: "双虫子陷阱（图 5.13c）",
      polys: [R(.06, .2, .4, .25), R(.06, .2, .11, .7), R(.06, .65, .4, .7), R(.35, .2, .4, .43), R(.35, .465, .4, .7),
        R(.6, .3, .94, .35), R(.89, .3, .94, .8), R(.6, .75, .94, .8), R(.6, .3, .65, .53), R(.6, .565, .65, .8)],
      qI: { x: 0.2, y: 0.45 }, qG: { x: 0.8, y: 0.55 },
    },
    tube: {
      name: "弯曲细管（图 5.27）",
      // 一条蜿蜒的细通道：上下交错的长墙
      polys: [R(.18, 0, .24, .82), R(.38, .18, .44, 1), R(.58, 0, .64, .82), R(.78, .18, .84, 1)],
      qI: { x: 0.08, y: 0.1 }, qG: { x: 0.92, y: 0.1 },
    },
    maze: {
      name: "迷宫",
      polys: [R(.2, .0, .24, .6), R(.2, .7, .24, 1), R(.4, .15, .44, 1), R(.6, 0, .64, .45), R(.6, .55, .64, .85), R(.8, .15, .84, 1),
        R(.44, .5, .55, .54), R(.64, .7, .74, .74)],
      qI: { x: 0.08, y: 0.5 }, qG: { x: 0.92, y: 0.08 },
    },
  };
  function makeMap(key) { const m = MAPS[key]; return { key, name: m.name, obs: new Obstacles(m.polys), qI: { ...m.qI }, qG: { ...m.qG } }; }

  // ---------------------------------------------------------------
  // 并查集（5.4.2、5.6.1 节都提到它）
  // ---------------------------------------------------------------
  class UnionFind {
    constructor() { this.p = []; }
    add() { this.p.push(this.p.length); return this.p.length - 1; }
    find(i) { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; }
    union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[a] = b; return a !== b; }
    same(a, b) { return this.find(a) === this.find(b); }
  }

  // ---------------------------------------------------------------
  // 画布舞台：自适应宽度、高分屏、主题切换重画、世界坐标（y 轴向上）、拖拽
  // ---------------------------------------------------------------
  class Stage {
    constructor(opts) {
      this.o = Object.assign({ aspect: 1, maxW: 560, minW: 200, view: [0, 1, 0, 1], pad: 6 }, opts);
      this.wrap = h("div", { class: "ch5-stage" });
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
    poly(P, fill, stroke, lw) {
      const ctx = this.ctx; ctx.beginPath();
      P.forEach((p, i) => (i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    text(str, p, color, opts) {
      const ctx = this.ctx; const o = Object.assign({ size: 12, align: "center", base: "middle", dx: 0, dy: 0, weight: 500 }, opts);
      ctx.font = `${o.weight} ${o.size}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
      ctx.fillText(str, this.X(p.x) + o.dx, this.Y(p.y) + o.dy);
    }
    frame(col) {
      const ctx = this.ctx; const [x0, x1, y0, y1] = this.view;
      ctx.fillStyle = col.surface; ctx.fillRect(this.X(x0), this.Y(y1), (x1 - x0) * this.scale, (y1 - y0) * this.scale);
      ctx.strokeStyle = col.strong; ctx.lineWidth = 1; ctx.strokeRect(this.X(x0) + 0.5, this.Y(y1) + 0.5, (x1 - x0) * this.scale - 1, (y1 - y0) * this.scale - 1);
    }
    obstacles(obs, col) { for (const o of obs.polys) this.poly(o.P, alpha(col.wall, 0.82), col.wall, 1); }
    // qI / qG 标记
    qmark(p, kind, col, label) {
      const c = kind === "I" ? col.start : col.goal;
      this.dot(p, 7, c, col.surface, 2);
      this.text(label || (kind === "I" ? "qI" : "qG"), p, c, { dy: -15, size: 12, weight: 650 });
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
    return lab;
  }
  function select(options, value, onChange) {
    const el = h("select");
    options.forEach(([k, t]) => el.append(h("option", { value: k, selected: k === value ? true : null }, t)));
    el.addEventListener("change", () => onChange(el.value));
    return el;
  }
  // 图例用：直接引用 CSS 变量，切换深浅色后自动更新
  const cv = (key) => `var(${COLOR_VARS[key]})`;
  const cva = (key, a) => `color-mix(in srgb, var(${COLOR_VARS[key]}) ${Math.round(a * 100)}%, transparent)`;
  function stat(k) { const v = h("span", { class: "v" }, "–"); const el = h("div", { class: "stat" }, h("span", { class: "k" }, k), v); el.set = (x) => { v.innerHTML = x; }; return el; }
  function button(text, onClick, cls) { const b = h("button", { type: "button", class: "btn " + (cls || "") }, text); b.addEventListener("click", onClick); return b; }
  function legend(items) { return h("div", { class: "legend" }, items.map(([c, t, round]) => h("span", null, h("i", { style: `background:${c};${round ? "border-radius:50%" : ""}` }), t))); }

  // 简单的动画循环控制器
  class Runner {
    constructor(step, onStop) { this.step = step; this.onStop = onStop; this.raf = 0; this.running = false; }
    start() { if (this.running) return; this.running = true; const loop = () => { if (!this.running) return; const more = this.step(); if (more === false) { this.stop(); return; } this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
    stop() { if (!this.running) return; this.running = false; cancelAnimationFrame(this.raf); if (this.onStop) this.onStop(); }
  }

  // ---------------------------------------------------------------
  // 栅格化的最近点场：用于 Voronoi 图与分散度（式 5.19）
  // ---------------------------------------------------------------
  function nearestField(pts, res, metric, torus) {
    const n = pts.length, idx = new Int32Array(res * res), d = new Float32Array(res * res);
    const xs = new Float64Array(n), ys = new Float64Array(n);
    pts.forEach((p, i) => { xs[i] = p.x; ys[i] = p.y; });
    const inf = metric === "linf";
    for (let j = 0; j < res; j++) {
      const y = (j + 0.5) / res;
      for (let i = 0; i < res; i++) {
        const x = (i + 0.5) / res;
        let best = Infinity, bi = -1;
        for (let k = 0; k < n; k++) {
          let dx = Math.abs(x - xs[k]), dy = Math.abs(y - ys[k]);
          if (torus) { if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy; }
          const v = inf ? Math.max(dx, dy) : dx * dx + dy * dy;
          if (v < best) { best = v; bi = k; }
        }
        idx[j * res + i] = bi; d[j * res + i] = inf ? best : Math.sqrt(best);
      }
    }
    return { idx, d, res };
  }
  // 精确一点的分散度：在栅格最大处附近做局部搜索；返回 {r, c:{x,y}}
  function dispersion(pts, metric, torus, field) {
    const res = field.res; let bi = 0;
    for (let k = 1; k < field.d.length; k++) if (field.d[k] > field.d[bi]) bi = k;
    const D = (x, y) => {
      let best = Infinity;
      for (const p of pts) {
        let dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
        if (torus) { if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy; }
        const v = metric === "linf" ? Math.max(dx, dy) : Math.hypot(dx, dy);
        if (v < best) best = v;
      }
      return best;
    };
    // 边界点（正方形的四条边、四个角）也可能是最远点，栅格中心取不到，额外检查
    let cx = ((bi % res) + 0.5) / res, cy = (Math.floor(bi / res) + 0.5) / res, cv = D(cx, cy);
    if (!torus) {
      const cand = [[0, 0], [1, 0], [0, 1], [1, 1]];
      for (let t = 0; t <= 64; t++) { const u = t / 64; cand.push([u, 0], [u, 1], [0, u], [1, u]); }
      for (const [x, y] of cand) { const v = D(x, y); if (v > cv) { cv = v; cx = x; cy = y; } }
    }
    let step = 1 / res;
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        let x = cx + dx * step, y = cy + dy * step;
        if (torus) { x = frac(x); y = frac(y); } else { x = Math.min(1, Math.max(0, x)); y = Math.min(1, Math.max(0, y)); }
        const v = D(x, y);
        if (v > cv + 1e-12) { cv = v; cx = x; cy = y; moved = true; }
      }
      if (!moved) step /= 2;
    }
    return { r: cv, c: { x: cx, y: cy } };
  }

  // 用 ImageData 画 Voronoi：边界 + 按面积深浅着色
  function drawVoronoi(stage, field, n, col, shade) {
    const { idx, res } = field;
    const off = document.createElement("canvas"); off.width = res; off.height = res;
    const octx = off.getContext("2d"); const img = octx.createImageData(res, res);
    const area = new Float64Array(n);
    for (let k = 0; k < idx.length; k++) area[idx[k]]++;
    const [er, eg, eb] = rgb(col.strong), [ar, ag, ab] = rgb(col.accent), [sr, sg, sb] = rgb(col.surface);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const k = j * res + i, o = ((res - 1 - j) * res + i) * 4, me = idx[k];
      const edge = (i + 1 < res && idx[k + 1] !== me) || (j + 1 < res && idx[k + res] !== me);
      let r = sr, g = sg, b = sb;
      if (shade) {
        const rel = Math.min(1, (area[me] / (res * res)) * n / 3);   // 面积 = 3/k 时最深
        const a = 0.42 * rel; r = sr * (1 - a) + ar * a; g = sg * (1 - a) + ag * a; b = sb * (1 - a) + ab * a;
      }
      if (edge) { r = er; g = eg; b = eb; }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    const ctx = stage.ctx; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, stage.X(0), stage.Y(1), stage.scale, stage.scale);
    ctx.imageSmoothingEnabled = true;
  }

  window.CH5 = {
    colors, alpha, rgb, rng, gauss, newSeed, radInv, PHI, frac, SAMPLERS, makeSequence,
    dist, lerp, rect, polyBox, inPoly, segHitT, segPointDist, polyArea, convexHull,
    Obstacles, MAPS, makeMap, UnionFind, Stage, frame, seg, slider, select, stat, button, legend, Runner, cv, cva,
    nearestField, dispersion, drawVoronoi,
  };
})();
