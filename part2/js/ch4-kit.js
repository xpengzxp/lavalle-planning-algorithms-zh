/* 第 4 章共用小工具：组件外壳、画布、拖拽、颜色、几何 */
(function () {
  "use strict";
  const { h, s, cssVar, onThemeChange } = PA;

  // ---------- 组件外壳 ----------
  function shell(root, title, sub, badge) {
    root.innerHTML = "";
    const body = h("div", { class: "widget-body" });
    root.append(
      h("div", { class: "widget-head" },
        h("span", { class: "w-title" }, title),
        sub ? h("span", { class: "w-sub", html: sub }) : null,
        h("span", { class: "w-badge" }, badge || "互动")),
      body);
    return body;
  }

  // ---------- 颜色 ----------
  function hexToRgb(c) {
    c = (c || "").trim();
    if (c.startsWith("#")) {
      let x = c.slice(1);
      if (x.length === 3) x = x.split("").map((t) => t + t).join("");
      const n = parseInt(x, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/\d+(\.\d+)?/g);
    return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
  }
  function alpha(c, a) { const [r, g, b] = hexToRgb(c); return `rgba(${r},${g},${b},${a})`; }
  function mix(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  }
  function palette() {
    const v = (n) => cssVar(n);
    return {
      bg: v("--bg"), surface: v("--surface"), surface2: v("--surface-2"), surface3: v("--surface-3"),
      text: v("--text"), text2: v("--text-2"), muted: v("--muted"), border: v("--border"), borderStrong: v("--border-strong"),
      grid: v("--c-grid"), accent: v("--accent"), accentSoft: v("--accent-soft"),
      ok: v("--ok"), okSoft: v("--ok-soft"), bad: v("--bad"), badSoft: v("--bad-soft"),
      warn: v("--warn"), warnSoft: v("--warn-soft"), path: v("--c-path"), start: v("--c-start"), goal: v("--c-goal"),
      purple: v("--c-alive2"), amber: v("--c-alive"), current: v("--c-current"), wall: v("--c-wall"),
    };
  }

  // ---------- 画布：宽度随容器，高分屏清晰 ----------
  // opts: {aspect: 高/宽, maxW, minH, maxH}；draw(ctx, w, h) 在尺寸变化时被调用
  function makeCanvas(parent, opts, draw) {
    const wrap = h("div", { style: `width:100%;max-width:${opts.maxW || 9999}px;margin:0 auto;position:relative` });
    const canvas = h("canvas", { style: "border-radius:8px;border:1px solid var(--border);background:var(--surface);max-width:100%" });
    wrap.append(canvas);
    parent.append(wrap);
    const st = { canvas, wrap, ctx: null, w: 0, h: 0 };
    st.resize = () => {
      const w = Math.max(160, Math.floor(wrap.clientWidth || opts.maxW || 400));
      let hh = Math.round(w * (opts.aspect || 1));
      if (opts.maxH) hh = Math.min(hh, opts.maxH);
      if (opts.minH) hh = Math.max(hh, opts.minH);
      if (w === st.w && hh === st.h && st.ctx) return false;
      st.w = w; st.h = hh;
      st.ctx = PA.fitCanvas(canvas, w, hh);
      return true;
    };
    st.redraw = () => { if (!st.ctx) st.resize(); draw(st.ctx, st.w, st.h); };
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => { if (st.resize()) st.redraw(); }).observe(wrap);
    } else {
      window.addEventListener("resize", () => { if (st.resize()) st.redraw(); });
    }
    st.resize();
    requestAnimationFrame(() => st.redraw()); // 等构造函数跑完再画第一帧
    onThemeChange(() => st.redraw());
    return st;
  }

  // 指针拖拽；坐标相对元素（CSS 像素）。handlers.down 返回 false 表示不开始拖拽
  function onDrag(el, handlers) {
    let active = false;
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, e }; };
    el.addEventListener("pointerdown", (e) => {
      const p = pos(e);
      if (handlers.down && handlers.down(p) === false) return;
      active = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      const p = pos(e);
      if (active) { handlers.move && handlers.move(p); } else if (handlers.hover) handlers.hover(p);
    });
    const end = (e) => { if (!active) return; active = false; handlers.up && handlers.up(pos(e)); };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", (e) => { if (!active && handlers.leave) handlers.leave(pos(e)); });
  }

  // SVG 中把屏幕坐标换成 viewBox 坐标
  function svgPoint(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  }
  function svgDrag(svg, el, handlers) {
    let active = false;
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", (e) => {
      active = true; el.style.cursor = "grabbing";
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      handlers.down && handlers.down(svgPoint(svg, e));
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener("pointermove", (e) => { if (active) handlers.move(svgPoint(svg, e)); });
    const end = () => { if (active) { active = false; el.style.cursor = "grab"; handlers.up && handlers.up(); } };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  // ---------- 控件 ----------
  function slider(label, min, max, step, value, oninput, show) {
    const out = h("b", { class: "mono", style: "min-width:4.2em;display:inline-block" });
    const inp = h("input", { type: "range", min, max, step, value, style: "width:150px" });
    const upd = () => { out.innerHTML = show ? show(+inp.value) : inp.value; };
    inp.addEventListener("input", () => { upd(); oninput(+inp.value); });
    upd();
    const el = h("label", null, label, inp, out);
    el.input = inp;
    el.set = (v) => { inp.value = v; upd(); };
    return el;
  }
  function segmented(options, current, onchange) {
    const box = h("div", { class: "seg", role: "group" });
    const btns = [];
    options.forEach(([k, label]) => {
      const b = h("button", { type: "button", class: k === current ? "on" : "", html: label });
      b.addEventListener("click", () => { btns.forEach((x) => x.classList.toggle("on", x === b)); onchange(k); });
      btns.push(b);
      box.append(b);
    });
    box.select = (k) => btns.forEach((b, i) => b.classList.toggle("on", options[i][0] === k));
    return box;
  }
  function button(label, onclick, cls) {
    const b = h("button", { type: "button", class: "btn " + (cls || ""), html: label });
    b.addEventListener("click", onclick);
    return b;
  }
  function checkbox(label, checked, onchange) {
    const cb = h("input", { type: "checkbox", checked: !!checked });
    cb.addEventListener("change", () => onchange(cb.checked));
    const el = h("label", null, cb, h("span", { html: label }));
    el.input = cb;
    return el;
  }

  // ---------- 几何 ----------
  const G = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1],
    cross: (a, b) => a[0] * b[1] - a[1] * b[0],
    len: (a) => Math.hypot(a[0], a[1]),
    rot: (p, t) => [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t)],
    ang: (v) => { const a = Math.atan2(v[1], v[0]); return a < 0 ? a + 2 * Math.PI : a; },
    hull(P) {
      const pts = P.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      if (pts.length < 3) return pts;
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    },
    area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; },
    isConvexCCW(P) {
      if (P.length < 3) return false;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
        if (G.cross(G.sub(b, a), G.sub(c, b)) <= 1e-9) return false;
      }
      return true;
    },
    pointInPoly(p, P) {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const a = P[i], b = P[j];
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    },
    distPointSeg(p, a, b) {
      const ab = G.sub(b, a), t = Math.max(0, Math.min(1, G.dot(G.sub(p, a), ab) / (G.dot(ab, ab) || 1)));
      return G.len(G.sub(p, G.add(a, [ab[0] * t, ab[1] * t])));
    },
    closestOnSeg(p, a, b) {
      const ab = G.sub(b, a), t = Math.max(0, Math.min(1, G.dot(G.sub(p, a), ab) / (G.dot(ab, ab) || 1)));
      return { p: G.add(a, [ab[0] * t, ab[1] * t]), t };
    },
    segsIntersect(p1, p2, p3, p4) {
      const d1 = G.cross(G.sub(p4, p3), G.sub(p1, p3)), d2 = G.cross(G.sub(p4, p3), G.sub(p2, p3));
      const d3 = G.cross(G.sub(p2, p1), G.sub(p3, p1)), d4 = G.cross(G.sub(p2, p1), G.sub(p4, p1));
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
      const on = (a, b, c) => Math.min(a[0], b[0]) - 1e-12 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-12 && Math.min(a[1], b[1]) - 1e-12 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-12;
      if (Math.abs(d1) < 1e-12 && on(p3, p4, p1)) return true;
      if (Math.abs(d2) < 1e-12 && on(p3, p4, p2)) return true;
      if (Math.abs(d3) < 1e-12 && on(p1, p2, p3)) return true;
      if (Math.abs(d4) < 1e-12 && on(p1, p2, p4)) return true;
      return false;
    },
    segHitsPoly(a, b, P) {
      if (G.pointInPoly(a, P) || G.pointInPoly(b, P)) return true;
      for (let i = 0; i < P.length; i++) if (G.segsIntersect(a, b, P[i], P[(i + 1) % P.length])) return true;
      return false;
    },
    // 两个凸多边形（闭集）是否相交：分离轴定理
    convexIntersect(P, Q) {
      for (const poly of [P, Q]) {
        for (let i = 0; i < poly.length; i++) {
          const e = G.sub(poly[(i + 1) % poly.length], poly[i]), n = [e[1], -e[0]];
          let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
          for (const p of P) { const d = G.dot(n, p); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
          for (const p of Q) { const d = G.dot(n, p); b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
          if (a1 < b0 - 1e-9 || b1 < a0 - 1e-9) return false;
        }
      }
      return true;
    },
    // 线段与圆的交点个数（不含相切重复）
    segCircleHits(a, b, c, r) {
      const d = G.sub(b, a), f = G.sub(a, c);
      const A = G.dot(d, d), B = 2 * G.dot(f, d), C = G.dot(f, f) - r * r;
      const disc = B * B - 4 * A * C;
      if (disc < 0 || A === 0) return [];
      const sq = Math.sqrt(disc), out = [];
      for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) if (t >= 0 && t < 1) out.push(t);
      return out;
    },
  };

  // 小数格式
  function num(v, d) {
    d = d === undefined ? 2 : d;
    if (Math.abs(v) < 0.5 * Math.pow(10, -d)) v = 0;
    const t = v.toFixed(d);
    return t.includes(".") ? t.replace(/\.?0+$/, "") : t; // 只去掉小数部分末尾的 0
  }
  const TAU = 2 * Math.PI;
  const wrap2pi = (t) => ((t % TAU) + TAU) % TAU;
  function piStr(t) { // 角度显示为 π 的倍数（近似）
    const k = t / Math.PI;
    const near = [[0, "0"], [0.25, "π/4"], [0.5, "π/2"], [0.75, "3π/4"], [1, "π"], [1.25, "5π/4"], [1.5, "3π/2"], [1.75, "7π/4"], [2, "2π"], [3, "3π"], [4, "4π"], [-0.5, "−π/2"], [-1, "−π"], [-0.25, "−π/4"]];
    for (const [v, s_] of near) if (Math.abs(k - v) < 0.004) return s_;
    return num(k, 2) + "π";
  }

  window.CH4 = { shell, palette, alpha, mix, makeCanvas, onDrag, svgPoint, svgDrag, slider, segmented, button, checkbox, G, num, TAU, wrap2pi, piStr, h, s };
})();
