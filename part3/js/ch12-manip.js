/* 12.5 节：顺应运动的摩擦锥（图 12.44）、预像规划的反向投影（图 12.45–12.49）、平行夹爪挤压零件（图 12.50–12.53、例 12.9） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;

  const DEG = Math.PI / 180, TAU = 2 * Math.PI;
  const mod = (a, m) => ((a % m) + m) % m;
  const wrapPi = (a) => mod(a + Math.PI, TAU) - Math.PI;          // 化到 [−π, π)
  const wrapT = (a, T) => mod(a + T / 2, T) - T / 2;               // 化到 [−T/2, T/2)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const modT = (a, T) => { const r = mod(a, T); return T - r < 1e-9 ? 0 : r; };   // 取模后把「差一点点到 T」的值归 0
  const deg = (r, d) => C.fmtD(r / DEG, d === undefined ? 1 : d) + "°";
  const GRID2 = "display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start";
  const cap = (t) => h("div", { class: "small muted", style: "text-align:center;margin-top:4px" }, t);
  const font = (size, weight) => `${weight || 500} ${size}px ${getComputedStyle(document.body).fontFamily}`;

  // 在 b 处画实心箭头（配合虚线杆使用）
  function head(pl, a, b, color, s) {
    const ctx = pl.ctx, x1 = pl.X(b.x), y1 = pl.Y(b.y), ang = Math.atan2(y1 - pl.Y(a.y), x1 - pl.X(a.x));
    s = s || 9;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - s * Math.cos(ang - 0.4), y1 - s * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - s * Math.cos(ang + 0.4), y1 - s * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  // 圆心在 c、半径 r（世界单位）的扇形；角度按世界坐标（逆时针）给出
  function pie(pl, c, r, a0, a1, fill, stroke, lw) {
    const ctx = pl.ctx; ctx.beginPath(); ctx.moveTo(pl.X(c.x), pl.Y(c.y));
    ctx.arc(pl.X(c.x), pl.Y(c.y), pl.S(r), -a1, -a0); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  }
  // 带一圈底色描边的文字：压在障碍（深色 / 浅色模式下颜色不同）上也看得清
  function haloText(pl, str, p, color, halo, o) {
    o = Object.assign({ size: 12, weight: 600, dx: 0, dy: 0, align: "center" }, o);
    const ctx = pl.ctx, x = pl.X(p.x) + o.dx, y = pl.Y(p.y) + o.dy;
    ctx.font = font(o.size, o.weight); ctx.textAlign = o.align; ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5; ctx.strokeStyle = halo; ctx.lineJoin = "round"; ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  // 宽度不够时把画布拉高一些（窄屏上曲线图不至于压扁）
  function minHeight(pl, base, minH) {
    const orig = pl.resize.bind(pl);
    pl.resize = () => { const w = Math.max(pl.o.minW, Math.min(pl.o.maxW, pl.wrap.clientWidth || 0)); if (w) pl.o.aspect = Math.max(base, minH / w); orig(); };
  }
  // 无坐标轴的画布：铺底色、描边
  function plainBg(pl, col, noBorder) {
    const ctx = pl.ctx; ctx.fillStyle = col.surface; ctx.fillRect(0, 0, pl.W, pl.H);
    if (!noBorder) { ctx.strokeStyle = col.border; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, pl.W - 1, pl.H - 1); }
  }

  // ---------------------------------------------------------------
  // 组件 1：摩擦锥与顺应运动（图 12.44）
  // ---------------------------------------------------------------
  class FrictionCone {
    constructor(root) {
      this.alpha = 20;           // 摩擦锥半顶角（度）
      this.tilt = 0;             // 边界倾角（度）
      this.gravity = false;      // F 固定为竖直向下的重力
      this.F = { x: 0.5, y: -0.95 };
      const body = C.frame(root, "摩擦锥与顺应运动", "图 12.44：在左图上点击或拖动，设定机器人在接触点 q 施加的力 F");
      this.sA = C.slider("摩擦锥半角 α", 0, 60, 1, this.alpha, (v) => { this.alpha = v; this.update(); }, (v) => v + "°");
      this.sT = C.slider("边界倾角", -60, 60, 1, this.tilt, (v) => { this.tilt = v; this.update(); }, (v) => v + "°");
      this.cbG = C.checkbox("F = 重力（竖直向下）", false, (v) => { this.gravity = v; if (v) this.F = { x: 0, y: -1.15 }; this.update(); });
      const bPerp = C.button("F 垂直压向边界", () => this.preset("perp"), "small");
      const bPar = C.button("F 平行于边界", () => this.preset("par"), "small");
      this.scene = new C.Plot({ x: [-2.1, 2.1], y: [-1.5, 1.95], equal: true, aspect: 0.8, maxW: 440, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.drawScene(ctx, pl, col), onDown: (p) => this.setF(p), onMove: (p) => this.setF(p), cursor: () => "crosshair" });
      this.inv = new C.Plot({ x: [-1.45, 1.45], y: [-1.45, 1.45], equal: true, aspect: 0.8, maxW: 440, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.drawInv(ctx, pl, col), onDown: (p) => this.setDir(p), onMove: (p) => this.setDir(p), cursor: () => "crosshair" });
      this.stAng = C.stat("F 与内法向 −n 的夹角");
      this.stA = C.stat("摩擦锥半角 α");
      this.stRes = C.stat("结果");
      this.res = h("div", { class: "small" });
      body.append(
        h("div", { class: "controls" }, this.sA, this.sT),
        h("div", { class: "controls" }, this.cbG, bPerp, bPar),
        h("div", { style: GRID2 },
          h("div", null, this.scene.wrap, cap("(a) 摩擦锥：以外法向 n 为轴、半顶角 α")),
          h("div", null, this.inv.wrap, cap("(b) 倒置摩擦锥：F 指向哪一块，就发生哪种运动"))),
        h("div", { class: "stats" }, this.stAng, this.stA, this.stRes),
        this.res,
        C.legend([[C.cva("cand", 0.35), "摩擦锥"], [C.cv("robot"), "力 F（虚线为 −F）"], [C.cv("best"), "产生的运动"], [C.cv("worst"), "粘住"], [C.cv("obst"), "障碍 Cobs"]]));
      this.update();
    }
    frameVecs() { const a = this.tilt * DEG; return { t: { x: Math.cos(a), y: Math.sin(a) }, n: { x: -Math.sin(a), y: Math.cos(a) } }; }
    // 设定 F：方向取指针相对 q 的方向；接近法向时吸附到恰好垂直（α = 0 时才能看到「粘住」）
    setF(p, keepLen) {
      const len = Math.hypot(p.x, p.y);
      if (len < 0.12) return {};
      if (this.gravity) { this.gravity = false; this.cbG.input.checked = false; }
      let ux = p.x / len, uy = p.y / len;
      const { n } = this.frameVecs(), c = ux * n.x + uy * n.y;
      if (Math.abs(c) > Math.cos(2 * DEG)) { const s = Math.sign(c); ux = s * n.x; uy = s * n.y; }
      const L = keepLen ? Math.hypot(this.F.x, this.F.y) : clamp(len, 0.6, 1.2);
      this.F = { x: ux * L, y: uy * L };
      this.update();
      return {};
    }
    setDir(p) { return this.setF(p, true); }
    preset(k) {
      const { t, n } = this.frameVecs(), L = 1.1;
      this.gravity = false; this.cbG.input.checked = false;
      this.F = k === "perp" ? { x: -n.x * L, y: -n.y * L } : { x: t.x * L, y: t.y * L };
      this.update();
    }
    // 分类：脱离接触 / 粘住 / 向左滑 / 向右滑
    classify() {
      const { t, n } = this.frameVecs(), L = Math.hypot(this.F.x, this.F.y), fx = this.F.x / L, fy = this.F.y / L;
      const fn = fx * n.x + fy * n.y, ft = fx * t.x + fy * t.y;
      const ang = Math.atan2(Math.abs(ft), -fn) / DEG;   // F 与内法向 −n 的夹角（用 atan2，垂直时精确为 0）
      let kind;
      if (fn > 1e-9) kind = "break";
      else if (ang <= this.alpha + 1e-6) kind = "stick";
      else kind = ft < 0 ? "left" : "right";
      return { kind, fn, ft, ang, t, n, L, fx, fy };
    }
    update() {
      const R = this.classify(), a = this.alpha;
      const name = { break: "脱离接触", stick: "粘住", left: "向左滑", right: "向右滑" }[R.kind];
      const cls = R.kind === "stick" ? "no" : "yes";
      this.stAng.set(C.fmtD(R.ang, 1) + "°");
      this.stA.set(a + "°");
      this.stRes.set(`<span class="${cls}">${name}</span>`);
      let s = "";
      if (R.kind === "stick") {
        s = `<p style="margin:0 0 6px">−F 落在摩擦锥里（夹角 ${C.fmtD(R.ang, 1)}° ≤ α = ${a}°）：切向分量相对法向分量太小，被摩擦抵消，机器人<b class="no">粘住不动</b>。</p>`;
        if (a === 0) s += `<p style="margin:0 0 6px">α = 0 时只有 F <b>恰好</b>垂直于边界才会粘住——这正是书中「即使 α = 0 也可能粘住」的原因：自然可以让运动方向恰好垂直于边界。</p>`;
      } else if (R.kind === "break") {
        s = `<p style="margin:0 0 6px">F 指向远离边界的一侧（F·n > 0）：机器人<b>脱离接触</b>，回到自由空间（除非边界是「黏」的）。</p>`;
      } else {
        s = `<p style="margin:0 0 6px">−F 在摩擦锥之外、F 又压向边界：机器人沿边界<b class="yes">${R.kind === "left" ? "向左" : "向右"}滑动</b>——这就是顺应运动 compliant motion。` +
          `绿色箭头长度取 |F∥| − tan α·|F⊥|（库仑摩擦抵消一部分切向力；补充），越靠近锥面滑得越慢。</p>`;
      }
      if (this.gravity) {
        s += `<p style="margin:0 0 6px">F = 重力：倾角 |${this.tilt}°| ${Math.abs(this.tilt) <= a ? "≤" : ">"} α，物体${Math.abs(this.tilt) <= a ? "静止" : "下滑"}。` +
          `倾角超过 α 才开始下滑，α 就是「摩擦角」（补充）。12.5.2 节托盘里的内六角扳手，就是被重力推着做这种顺应运动。</p>`;
      }
      s += `<p class="muted" style="margin:0">图 12.44 的结论：机器人只有在 −F 落在摩擦锥之外时才会沿边界移动。</p>`;
      this.res.innerHTML = s;
      this.scene.draw(); this.inv.draw();
    }
    drawScene(ctx, pl, col) {
      plainBg(pl, col);
      const R = this.classify(), { t, n } = R, a = this.alpha * DEG, O = { x: 0, y: 0 };
      const P = (s, k) => ({ x: t.x * s + n.x * k, y: t.y * s + n.y * k });   // 边界坐标（切向 s、法向 k）→ 世界坐标
      const ray = (ang, r) => ({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
      const th = Math.atan2(n.y, n.x), Rc = 1.5;
      // 障碍：边界下方
      pl.poly([P(-3.6, 0), P(3.6, 0), P(3.6, -2.8), P(-3.6, -2.8)], col.obst);
      // 摩擦锥
      if (a > 1e-9) pie(pl, O, Rc, th - a, th + a, C.alpha(col.cand, R.kind === "stick" ? 0.3 : 0.15));
      pl.line(O, ray(th - a, Rc), col.cand, 2.2); pl.line(O, ray(th + a, Rc), col.cand, 2.2);
      pl.line(O, ray(th, Rc + 0.15), col.muted, 1.2, [3, 4]);
      pl.text("n", ray(th, Rc + 0.29), col.muted, { size: 13, weight: 650 });
      if (a > 5 * DEG) {
        const c = pl.ctx; c.beginPath(); c.arc(pl.X(0), pl.Y(0), pl.S(0.55), -(th + a), -th); c.strokeStyle = col.cand; c.lineWidth = 1.2; c.stroke();
        pl.text("α", ray(th + a / 2, 0.74), col.cand, { size: 13, weight: 700 });
      }
      pl.text("摩擦锥", ray(th - a, Rc * 0.92), col.cand, { size: 12, weight: 650, align: "left", dx: 8 });
      // −F（虚线）与 F（实线），带一圈底色描边，压在障碍上也看得清
      const F = this.F, mF = { x: -F.x, y: -F.y }, L = R.L;
      pl.line(O, mF, col.surface, 5.5);
      pl.line(O, { x: mF.x * (1 - 0.08 / L), y: mF.y * (1 - 0.08 / L) }, col.robot, 2, [6, 4]);
      head(pl, O, mF, col.robot, 10);
      pl.line(O, F, col.surface, 6);
      pl.arrow(O, F, col.robot, 2.6, 10);
      // 标签放在箭头末端的左侧（沿箭头方向看），不和法向、锥面标签挤在一起
      const lab = (v) => ({ x: v.x * 0.86 - (v.y / L) * 0.2, y: v.y * 0.86 + (v.x / L) * 0.2 });
      pl.text("F", lab(F), col.robot, { size: 13, weight: 700 });
      pl.text("−F", lab(mF), col.robot, { size: 13, weight: 700 });
      // 产生的运动
      if (R.kind === "left" || R.kind === "right") {
        const sg = R.kind === "right" ? 1 : -1, eff = Math.max(0, Math.abs(R.ft) - Math.tan(a) * Math.abs(R.fn));
        const len = 0.3 + 1.1 * eff, s0 = P(0, 0.17), s1 = P(sg * len, 0.17);
        pl.arrow(s0, s1, col.best, 3.4, 11);
        pl.text("滑动", P(sg * (len + 0.05), 0.42), col.best, { size: 12.5, weight: 700 });
      } else if (R.kind === "break") {
        const ux = R.fx, uy = R.fy, off = { x: -uy * 0.2, y: ux * 0.2 };
        pl.arrow(off, { x: off.x + ux * 1.05, y: off.y + uy * 1.05 }, col.best, 3.4, 11);
        pl.text("脱离", { x: off.x * 2.2 + ux * 0.7, y: off.y * 2.2 + uy * 0.7 }, col.best, { size: 12.5, weight: 700 });
      } else {
        pl.dot(O, 11, null, col.worst, 2.5);
        pl.text("粘住：不动", P(-0.95, 0.3), col.worst, { size: 12.5, weight: 700 });
      }
      pl.dot(O, 5.5, col.robot, col.surface, 2);
      pl.text("q", P(-0.24, -0.22), col.surface, { size: 12, weight: 700 });
    }
    drawInv(ctx, pl, col) {
      plainBg(pl, col);
      const R = this.classify(), a = this.alpha * DEG, tt = Math.atan2(R.t.y, R.t.x), dn = tt + 1.5 * Math.PI, O = { x: 0, y: 0 };
      const secs = [
        ["break", tt, tt + Math.PI, "脱离接触", col.robot, 0.5],
        ["left", tt + Math.PI, dn - a, "向左滑", col.best, 0.64],
        ["stick", dn - a, dn + a, "粘住", col.worst, 0.64],
        ["right", dn + a, tt + TAU, "向右滑", col.best, 0.64],
      ];
      for (const [k, a0, a1, , c] of secs) if (a1 - a0 > 1e-9) pie(pl, O, 1, a0, a1, C.alpha(c, k === R.kind ? 0.3 : 0.09));
      const cur = secs.find((s) => s[0] === R.kind);
      if (cur[2] - cur[1] > 1e-9) pie(pl, O, 1, cur[1], cur[2], null, cur[4], 2);
      // α = 0：粘住区退化成一条线
      const dv = { x: Math.cos(dn), y: Math.sin(dn) };
      if (a < 1e-9) pl.line(O, dv, col.worst, R.kind === "stick" ? 3 : 2, [5, 4]);
      const c = pl.ctx; c.beginPath(); c.arc(pl.X(0), pl.Y(0), pl.S(1), 0, TAU); c.strokeStyle = col.strong; c.lineWidth = 1.2; c.stroke();
      pl.line({ x: -R.t.x, y: -R.t.y }, R.t, col.strong, 1.6);
      const fa = Math.atan2(R.fy, R.fx);
      for (const [k, a0, a1, name, , rr] of secs) {
        let m = (a0 + a1) / 2;
        const small = k === "stick" && a < 14 * DEG, r = small ? 1.2 : rr, dd = wrapPi(m - fa);
        if (!small && Math.abs(dd) < 0.32) m = fa + (dd >= 0 ? 0.36 : -0.36);   // 别和 F 的箭头叠在一起
        pl.text(name, { x: Math.cos(m) * r, y: Math.sin(m) * r }, k === R.kind ? col.text : col.text2, { size: 12.5, weight: k === R.kind ? 700 : 500 });
      }
      // 当前 F 的方向
      const f = { x: R.fx * 0.9, y: R.fy * 0.9 };
      pl.line(O, f, col.surface, 6); pl.arrow(O, f, col.robot, 2.6, 10);
      const fl = fa + (a < 14 * DEG && Math.abs(wrapPi(fa - dn)) < 0.3 ? (wrapPi(fa - dn) >= 0 ? 0.3 : -0.3) : 0);   // 别压住「粘住」
      pl.text("F", { x: Math.cos(fl) * 1.14, y: Math.sin(fl) * 1.14 }, col.robot, { size: 13, weight: 700 });
      pl.dot(O, 3.5, col.text);
    }
  }

  // ---------------------------------------------------------------
  // 组件 2：反向投影与预像（图 12.45–12.49）
  //   C-space = 平面，障碍为多边形。指令方向 u，自然可在 [u − β, u + β] 内随时改变实际运动方向（有界误差的非确定模型）。
  //   网格近似：每个格子取一个代表点，对误差锥里 17 个方向各走 12 格（含顺应滑动），再做不动点迭代：
  //   强反向投影 —— 所有方向都到达目标或落进已知集合；弱反向投影 —— 某个方向做到即可。
  // ---------------------------------------------------------------
  const GOAL = -1, FAIL = -2;
  const BP_PRESETS = {
    peg: {
      box: [0, 8, 0, 8.4], NX: 160, aspect: 1.05, maxW: 520,
      polys: [[[-1, -1], [9, -1], [9, 3.6], [5.3, 3.6], [5.3, 1], [2.7, 1], [2.7, 3.6], [-1, 3.6]]],
      goal: [[2.7, 1], [5.3, 1]], q: { x: 4.0, y: 6.3 },
      def: { u: 270, beta: 20, alpha: 0, comp: false, mode: "SB" },
    },
    erd: {
      box: [-0.6, 16.2, -0.4, 9.6], NX: 180, aspect: 0.6, maxW: 820,
      polys: [[[0, 0], [3.2, 1.4], [12, 1.4], [12, 3.2], [15.6, 3.2], [15.6, 0]], [[5.8, 4.5], [8.1, 5.35], [9.0, 4.5]]],
      goal: [[3.2, 1.4], [12, 1.4]], q: { x: 9.5, y: 6.9 },
      def: { u: 270, beta: 25, alpha: 0, comp: true, mode: "SB" },
    },
  };
  const near = (x, y, p) => Math.abs(x - p[0]) < 1e-9 && Math.abs(y - p[1]) < 1e-9;
  // 由多边形建立边表：单位切向 t、外法向 n（指向自由空间）、前后邻边、目标区间 [g0, g1]（沿边的弧长）
  function buildEdges(polys, goal, eps) {
    const E = [];
    for (const Q of polys) {
      const pts = Q.map(([x, y]) => ({ x, y })), m = pts.length, ccw = C.polyArea(pts) > 0, base = E.length;
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % m], len = C.dist(a, b), tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
        E.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, tx, ty, nx: ccw ? ty : -ty, ny: ccw ? -tx : tx, len,
          prev: base + ((i + m - 1) % m), next: base + ((i + 1) % m), goal: false, g0: NaN, g1: NaN });
      }
    }
    const [g, k] = goal;
    for (const e of E) {
      if ((near(e.ax, e.ay, g) && near(e.bx, e.by, k)) || (near(e.ax, e.ay, k) && near(e.bx, e.by, g))) {
        e.goal = true;
        if (e.len > 2 * eps + 1e-9) { e.g0 = eps; e.g1 = e.len - eps; }
      }
    }
    return E;
  }
  const inGoal = (e, w) => w >= e.g0 - 1e-9 && w <= e.g1 + 1e-9;   // g0 为 NaN 时恒为 false
  // 在边 e 上会不会粘住：强反向投影按「整条边可能粘住」判断（自然随时可以把方向换成粘住的那个）；弱的只看当前方向
  function stuckOn(e, i, dx, dy, cfg) {
    if (cfg.strong) return cfg.stick[i] === 1;
    return -(dx * e.nx + dy * e.ny) >= cfg.cosA - 1e-12;
  }
  // 从 (x, y) 沿单位方向 (dx, dy) 走 L 的路程（碰到边界时按顺应运动滑动）。
  // 返回 GOAL（碰到目标）、FAIL（粘住 / 卡在凹角 / 不允许接触 / 出界），否则 0，终点写进 out。rec 记录折线顶点。
  function simStep(E, x, y, dx, dy, L, cfg, out, rec) {
    let r = L, ce = -1, w = 0, skip = -1;
    for (let it = 0; it < 24 && r > 1e-10; it++) {
      if (ce < 0) {
        // 自由运动：找第一条迎面的边
        let best = r, bi = -1, bw = 0;
        for (let i = 0; i < E.length; i++) {
          if (i === skip) continue;
          const e = E[i], dn = dx * e.nx + dy * e.ny;
          if (dn > -1e-12) continue;
          const s = ((e.ax - x) * e.nx + (e.ay - y) * e.ny) / dn;
          if (s < -1e-7 || s >= best) continue;
          const ww = (x + s * dx - e.ax) * e.tx + (y + s * dy - e.ay) * e.ty;
          if (ww < -1e-9 || ww > e.len + 1e-9) continue;
          best = s; bi = i; bw = ww;
        }
        skip = -1;
        if (bi < 0) { x += dx * r; y += dy * r; r = 0; if (rec) rec.push(x, y); break; }
        const s = Math.max(best, 0); x += dx * s; y += dy * s; r -= s;
        if (rec) rec.push(x, y);
        const e = E[bi];
        if (inGoal(e, bw)) return GOAL;
        if (!cfg.comp || stuckOn(e, bi, dx, dy, cfg)) return FAIL;
        ce = bi; w = clamp(bw, 0, e.len);
      } else {
        // 沿边 ce 滑动，方向取 F 的切向分量
        const e = E[ce], dt = dx * e.tx + dy * e.ty;
        if (Math.abs(dt) < 1e-12) return FAIL;
        const sg = dt > 0 ? 1 : -1, room = sg > 0 ? e.len - w : w, go = Math.min(r, room), w2 = w + sg * go;
        if (Math.max(w, w2) >= e.g0 - 1e-9 && Math.min(w, w2) <= e.g1 + 1e-9) return GOAL;
        w = w2; x = e.ax + e.tx * w; y = e.ay + e.ty * w; r -= go;
        if (rec) rec.push(x, y);
        if (r <= 1e-10) { x += e.nx * 1e-6; y += e.ny * 1e-6; break; }
        // 滑到了顶点
        const nb = sg > 0 ? e.next : e.prev, f = E[nb], wv = sg > 0 ? 0 : f.len;
        const convex = sg > 0 ? f.tx * e.nx + f.ty * e.ny < -1e-12 : e.tx * f.nx + e.ty * f.ny < -1e-12;
        if (inGoal(f, wv)) return GOAL;
        const dn2 = dx * f.nx + dy * f.ny;
        if (dn2 > -1e-12) {
          if (!convex) return FAIL;        // 凹角：被两条边夹住
          skip = ce; ce = -1; continue;    // 凸角：离开边界，继续自由运动
        }
        if (stuckOn(f, nb, dx, dy, cfg)) return FAIL;   // 顶点处换到邻边：邻边可能粘住，顶点也可能粘住
        const dt2 = dx * f.tx + dy * f.ty;
        if (sg > 0 ? dt2 <= 1e-12 : dt2 >= -1e-12) return FAIL;
        ce = nb; w = wv;
      }
    }
    if (r > 1e-9) return FAIL;
    if (cfg.box && (x < cfg.box[0] || x > cfg.box[1] || y < cfg.box[2] || y > cfg.box[3])) return FAIL;
    out.x = x; out.y = y;
    return 0;
  }
  // 网格：每个与 cl(Cfree) 相交的格子取一个代表点（中心在自由空间就用中心，否则用最近的边界点往外挪一点）
  function buildGrid(P) {
    const [x0, x1, y0, y1r] = P.box, nx = P.NX, hh = (x1 - x0) / nx, ny = Math.ceil((y1r - y0) / hh - 1e-9), y1 = y0 + ny * hh;
    const polys = P.polys.map((Q) => Q.map(([x, y]) => ({ x, y }))), segs = C.polySegs(polys);
    const N = nx * ny, valid = new Uint8Array(N), rx = new Float64Array(N), ry = new Float64Array(N);
    const inObs = (p) => polys.some((Q) => C.inPoly(p, Q));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i, p = { x: x0 + (i + 0.5) * hh, y: y0 + (j + 0.5) * hh };
      if (!inObs(p)) { valid[c] = 1; rx[c] = p.x; ry[c] = p.y; continue; }
      let best = Infinity, bq = null, bs = null;
      for (const sg of segs) { const r = C.distPointSeg(p, sg[0], sg[1]); if (r.d < best) { best = r.d; bq = r.q; bs = sg; } }
      if (best > 0.75 * hh) continue;
      // 往自由空间一侧挪一点：一般沿「中心 → 最近点」方向；中心恰好在边上时改用该边的两个法向试一试
      const L = C.dist(bs[0], bs[1]), nx0 = -(bs[1].y - bs[0].y) / L, ny0 = (bs[1].x - bs[0].x) / L;
      const cand = best > 1e-9 ? [[(bq.x - p.x) / best, (bq.y - p.y) / best]] : [];
      cand.push([nx0, ny0], [-nx0, -ny0]);
      const q = cand.map(([ux, uy]) => ({ x: bq.x + ux * 1e-6, y: bq.y + uy * 1e-6 })).find((r) => !inObs(r) && r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1);
      if (!q) continue;
      valid[c] = 1; rx[c] = q.x; ry[c] = q.y;
    }
    return { x0, x1, y0, y1, nx, ny, h: hh, N, valid, rx, ry, polys };
  }
  function cellOf(G, x, y) {
    const i = Math.floor((x - G.x0) / G.h), j = Math.floor((y - G.y0) / G.h);
    if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) return FAIL;
    const c = j * G.nx + i;
    return G.valid[c] ? c : FAIL;
  }

  class Backproj {
    constructor(root) {
      this.cache = {};
      this.stepCells = 12; this.nDirs = 17;   // 每步走几格、误差锥里取几个方向（步长太短时，从格子中心重新出发的取整误差会把方向「拉」向对角线）
      this.st = { eps: 0.4, pre: false, rays: false };
      const body = C.frame(root, "反向投影与预像", "图 12.45–12.49：拖动查询点 q；黄 = 强反向投影，粉 = 弱反向投影（网格近似）");
      this.swP = C.seg([["peg", "图 12.46 插孔"], ["erd", "图 12.48 / 12.49"]], "peg", (k) => this.setPreset(k));
      this.swM = C.seg([["SB", "强反向投影 SB"], ["WB", "弱反向投影 WB"]], "SB", (k) => { this.st.mode = k; this.schedule(); });
      this.cbC = C.checkbox("允许顺应运动 compliant motion", false, (v) => { this.st.comp = v; this.schedule(); });
      this.sU = C.slider("指令方向 u", 180, 360, 1, 270, (v) => { this.st.u = v; this.schedule(); }, (v) => v + "°");
      this.sB = C.slider("自然的方向误差 ±β", 0, 30, 1, 20, (v) => { this.st.beta = v; this.schedule(); }, (v) => "±" + v + "°");
      this.sA = C.slider("摩擦锥半角 α", 0, 40, 1, 0, (v) => { this.st.alpha = v; this.schedule(); }, (v) => v + "°");
      this.sE = C.slider("感知误差半径 ε", 0, 1, 0.05, this.st.eps, (v) => { this.st.eps = v; if (this.st.pre) this.schedule(); else this.plot.draw(); }, (v) => v.toFixed(2));
      this.cbP = C.checkbox("预像：把目标缩小 ε（G′）", false, (v) => { this.st.pre = v; this.schedule(); });
      this.cbR = C.checkbox("Erdmann 射线（图 12.48）", false, (v) => { this.st.rays = v; this.plot.draw(); });
      this.quick = h("div", { class: "controls" });
      this.plot = new C.Plot({ x: [0, 8], y: [0, 8.4], equal: true, aspect: 0.95, maxW: 560, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.moveQ(p), onMove: (p) => this.moveQ(p), cursor: () => "crosshair" });
      this.stQ = C.stat("查询点 q");
      this.stArea = C.stat("面积");
      this.stGrid = C.stat("网格 / 用时");
      this.info = h("div", { class: "small" });
      body.append(
        h("div", { class: "controls" }, this.swP, this.swM, this.cbC),
        h("div", { class: "controls" }, this.sU, this.sB, this.sA),
        h("div", { class: "controls" }, this.sE, this.cbP, this.cbR),
        this.quick, this.plot.wrap,
        h("div", { class: "stats" }, this.stQ, this.stArea, this.stGrid),
        this.info,
        C.legend([[C.cva("vis", 0.65), "强反向投影 SB"], [C.cva("goal", 0.45), "弱反向投影 WB"], [C.cv("best"), "目标边 G（粗）/ G′"],
          [C.cv("worst"), "可能粘住的边与顶点"], [C.cv("robot"), "q 的前向投影锥与三条轨迹"], [C.cv("prob"), "感知误差球（半径 ε）"]]));
      this.setPreset("peg");
    }
    setPreset(k) {
      this.pk = k; this.P = BP_PRESETS[k];
      this.q = Object.assign({}, this.P.q);
      this.swP.set(k);
      const pl = this.plot;
      pl.o.aspect = this.P.aspect; pl.o.maxW = this.P.maxW;
      pl.W = -1; pl.resize();
      this.quick.innerHTML = "";
      if (k === "peg") {
        this.quick.append(h("span", { class: "small muted" }, "对照图 12.47："),
          C.button("(a) 不接触 · SB", () => this.apply({ u: 270, comp: false, mode: "SB", alpha: 0 }), "small"),
          C.button("(b) 不接触 · WB", () => this.apply({ u: 270, comp: false, mode: "WB", alpha: 0 }), "small"),
          C.button("(c) 顺应 α = 0 · SB", () => this.apply({ u: 270, comp: true, mode: "SB", alpha: 0 }), "small"),
          C.button("(d) u = 225° · SB", () => this.apply({ u: 225, comp: true, mode: "SB", alpha: 0 }), "small"));
      } else {
        this.quick.append(h("span", { class: "small muted" }, "快捷："),
          C.button("图 12.49 的参数", () => this.apply({ u: 270, beta: 25, alpha: 0, comp: true, mode: "SB" }), "small"),
          C.button("α = 20°：右上边也粘住", () => this.apply({ u: 270, beta: 25, alpha: 20, comp: true, mode: "SB" }), "small"),
          C.button("不接触", () => this.apply({ u: 270, beta: 25, alpha: 0, comp: false, mode: "SB" }), "small"));
      }
      this.apply(Object.assign({}, this.P.def), true);
    }
    // 一次改多个参数，并同步控件
    apply(o, now) {
      Object.assign(this.st, o);
      this.sU.set(this.st.u); this.sB.set(this.st.beta); this.sA.set(this.st.alpha);
      this.cbC.input.checked = this.st.comp; this.swM.set(this.st.mode);
      if (now) this.compute(); else this.schedule();
    }
    schedule() { clearTimeout(this.tm); this.tm = setTimeout(() => this.compute(), 25); }
    grid() { return this.cache[this.pk] || (this.cache[this.pk] = buildGrid(this.P)); }
    // 每条边在当前 u、β、α 下是否可能粘住：误差锥 [u − β, u + β] 里有方向与内法向 −n 的夹角 ≤ α
    stickFlags(E) {
      const u = this.st.u * DEG, be = this.st.beta * DEG, al = this.st.alpha * DEG, out = new Uint8Array(E.length);
      E.forEach((e, i) => { const th = Math.atan2(-e.ny, -e.nx); out[i] = Math.abs(wrapPi(th - u)) - be <= al + 1e-9 ? 1 : 0; });
      return out;
    }
    cfg(E, G) {
      return { comp: this.st.comp, strong: this.st.mode === "SB", stick: this.stickFlags(E), cosA: Math.cos(this.st.alpha * DEG), box: [G.x0, G.x1, G.y0, G.y1] };
    }
    compute() {
      clearTimeout(this.tm);
      const t0 = performance.now(), G = this.grid(), st = this.st;
      const E = buildEdges(this.P.polys, this.P.goal, st.pre ? st.eps : 0), cfg = this.cfg(E, G);
      const u = st.u * DEG, be = st.beta * DEG, K = be > 1e-9 ? this.nDirs : 1, dirs = [];
      for (let k = 0; k < K; k++) { const th = K === 1 ? u : u - be + (2 * be * k) / (K - 1); dirs.push(Math.cos(th), Math.sin(th)); }
      const N = G.N, L = this.stepCells * G.h, succ = new Int32Array(N * K).fill(FAIL), out = { x: 0, y: 0 };
      for (let c = 0; c < N; c++) {
        if (!G.valid[c]) continue;
        for (let k = 0; k < K; k++) {
          const r = simStep(E, G.rx[c], G.ry[c], dirs[2 * k], dirs[2 * k + 1], L, cfg, out, null);
          succ[c * K + k] = r === GOAL ? GOAL : r === FAIL ? FAIL : cellOf(G, out.x, out.y);
        }
      }
      // 不动点（吸引子）迭代：反向邻接表 + 计数器，线性时间
      const start = new Int32Array(N + 1);
      for (let i = 0; i < N * K; i++) if (succ[i] >= 0) start[succ[i] + 1]++;
      for (let i = 0; i < N; i++) start[i + 1] += start[i];
      const pred = new Int32Array(start[N]), fillp = start.slice(0, N);
      for (let i = 0; i < N * K; i++) if (succ[i] >= 0) pred[fillp[succ[i]]++] = (i / K) | 0;
      const B = new Uint8Array(N), need = new Int32Array(N), queue = new Int32Array(N), strong = cfg.strong;
      let qt = 0;
      for (let c = 0; c < N; c++) {
        if (!G.valid[c]) continue;
        let g = 0; for (let k = 0; k < K; k++) if (succ[c * K + k] === GOAL) g++;
        need[c] = K - g;
        if (strong ? need[c] === 0 : g > 0) { B[c] = 1; queue[qt++] = c; }
      }
      for (let qh = 0; qh < qt; qh++) {
        const c2 = queue[qh];
        for (let p = start[c2]; p < start[c2 + 1]; p++) {
          const c = pred[p];
          if (B[c]) continue;
          if (strong ? --need[c] === 0 : true) { B[c] = 1; queue[qt++] = c; }
        }
      }
      this.E = E; this.G = G; this.B = B; this.K = K; this.cnt = qt; this.ms = performance.now() - t0;
      this.stArea.set(C.fmtD(qt * G.h * G.h, 1));
      this.stGrid.set(`${G.nx}×${G.ny} · ${Math.round(this.ms)} ms`);
      this.updateInfo();
      this.updateQ();
      this.plot.draw();
    }
    // 测试用：从某点出发，误差锥里各方向走一步的结果（GOAL / FAIL / 终点所在格子是否已在区域里）
    probe(x, y) {
      const G = this.G, E = this.E, cfg = this.cfg(E, G), u = this.st.u * DEG, be = this.st.beta * DEG, K = this.K, out = { x: 0, y: 0 }, res = [];
      for (let k = 0; k < K; k++) {
        const th = K === 1 ? u : u - be + (2 * be * k) / (K - 1), rec = [];
        const r = simStep(E, x, y, Math.cos(th), Math.sin(th), this.stepCells * G.h, cfg, out, rec);
        res.push({ th: +(th / DEG).toFixed(1), r: r === GOAL ? "GOAL" : r === FAIL ? "FAIL" : "end", end: r === 0 ? [+out.x.toFixed(3), +out.y.toFixed(3)] : null, inB: r === 0 ? this.inB(out.x, out.y) : null, rec: rec.map((v) => +v.toFixed(3)) });
      }
      return res;
    }
    // 测试用：区域面积、某点是否在区域里
    area() { return this.cnt * this.G.h * this.G.h; }
    inB(x, y) { const c = cellOf(this.G, x, y); return c >= 0 && this.B[c] === 1; }
    moveQ(p) {
      const G = this.grid();
      this.q = { x: clamp(p.x, G.x0 + 0.02, G.x1 - 0.02), y: clamp(p.y, G.y0 + 0.02, G.y1 - 0.02) };
      this.updateQ(); this.plot.draw();
      return {};
    }
    inObs(p) { return this.grid().polys.some((Q) => C.inPoly(p, Q)); }
    updateQ() {
      if (!this.B) return;
      const name = this.st.mode === "SB" ? "SB" : "WB";
      if (this.inObs(this.q)) this.stQ.set(`<span class="muted">在障碍里</span>`);
      else this.stQ.set(this.inB(this.q.x, this.q.y) ? `<span class="yes">在 ${name} 内</span>` : `<span class="no">不在 ${name} 内</span>`);
    }
    // 从 q 沿固定方向一直走（顺应运动），直到到达目标、粘住或离开画面
    trajectory(th, cfg) {
      const E = this.E, G = this.G, dx = Math.cos(th), dy = Math.sin(th), rec = [this.q.x, this.q.y], out = { x: 0, y: 0 };
      const c2 = Object.assign({}, cfg, { box: null });
      let x = this.q.x, y = this.q.y, res = 0;
      for (let s = 0; s < 120; s++) {
        const r = simStep(E, x, y, dx, dy, 0.5, c2, out, rec);
        if (r !== 0) { res = r; break; }
        x = out.x; y = out.y;
        if (x < G.x0 || x > G.x1 || y < G.y0 || y > G.y1) { res = 1; break; }
      }
      return { rec, res };
    }
    // 标记点（Erdmann 算法第 1 步）：可能粘住的顶点；以及能从那里滑离目标的目标端点
    marks(stick) {
      const E = this.E, pts = [];
      const fullGoal = (e) => e.goal && e.g0 <= 1e-9 && e.g1 >= e.len - 1e-9;
      const sNG = (i) => stick[i] === 1 && !fullGoal(E[i]);
      E.forEach((e, i) => { if (sNG(i) || sNG(e.next)) pts.push({ x: e.bx, y: e.by }); });
      const u = this.st.u * DEG, dx = Math.cos(u), dy = Math.sin(u);
      for (const e of E) {
        if (!(e.g1 >= e.g0)) continue;
        for (const [w, side] of [[e.g0, -1], [e.g1, 1]]) {
          const p = { x: e.ax + e.tx * w, y: e.ay + e.ty * w };
          if (pts.some((q) => C.dist(p, q) < 1e-6)) continue;
          let away;
          if ((side < 0 && w > 1e-9) || (side > 0 && w < e.len - 1e-9)) {
            away = stick[E.indexOf(e)] === 1 || Math.sign(dx * e.tx + dy * e.ty) === side;   // 同一条边上被去掉的那段
          } else {
            const fi = side < 0 ? e.prev : e.next, f = E[fi], ft = dx * f.tx + dy * f.ty;
            away = stick[fi] === 1 || (side < 0 ? ft < 0 : ft > 0);                       // 邻边：会不会沿它滑离目标
          }
          if (away) pts.push(p);
        }
      }
      return pts;
    }
    updateInfo() {
      const st = this.st, SB = st.mode === "SB";
      let s = SB
        ? `<p style="margin:0 0 6px"><b>强反向投影 SB(G, u)</b>：从黄色区域出发，不论自然怎样在 ±${st.beta}° 内随时改变运动方向，都<b>一定</b>到达目标边。</p>`
        : `<p style="margin:0 0 6px"><b>弱反向投影 WB(G, u)</b>：从粉色区域出发，<b>有可能</b>到达目标（自然配合时）。书中只把它用于「错误检测与恢复」EDR，规划默认用强反向投影。</p>`;
      if (this.pk === "peg") {
        s += `<p style="margin:0 0 6px">不允许接触（除了目标）时，SB 是目标上方的三角形（图 12.47a），WB 是向上张开的无界区域（图 12.47b）。` +
          `允许无摩擦的顺应运动后，碰到侧壁就沿壁滑下去，SB 扩大为整个槽加上槽口上方一个更高的三角形（图 12.47c）；` +
          `槽口两侧的水平顶面是粘住边——误差锥里含有恰好垂直于边界的方向，即使 α = 0 也会粘住。u = 225° 对应图 12.47d 那样的斜向指令。</p>`;
        if (st.comp && Math.abs(st.u - 225) < 0.5 && st.alpha < 45 - st.beta - 1e-9 && SB) {
          s += `<p class="muted" style="margin:0 0 6px">注：这时右侧顶面不是粘住边，机器人会沿它向左滑进槽里，所以算出的区域比书中图 12.47d 多出右侧顶面上方的一块（书中的图画得更保守）。</p>`;
        }
      } else {
        s += `<p style="margin:0 0 6px">三角形左上边较平，误差锥里有与它内法向一致的方向，可能粘住（红）；右上边较陡，从它上方落下一定会滑下去，所以它上方的一块属于反向投影（图 12.49）。` +
          `台阶顶面、左侧斜坡也是粘住边。勾选「Erdmann 射线」可以看到图 12.48 那样从标记点向上反推的射线：反向投影的边界由这些射线和障碍边组成。</p>`;
      }
      if (st.pre) {
        const E = this.E, ok = E.some((e) => e.g1 >= e.g0);
        s += ok ? `<p style="margin:0 0 6px">预像：传感器读数 y 落在 G′（目标两端各去掉 ε）里，才能保证真实位置在 G 里；于是对 G′ 求反向投影。ε 越大，G′ 越短，预像越小。</p>`
          : `<p class="no" style="margin:0 0 6px">ε 太大：G′ 是空集，找不到预像——即使原问题有解，感知太差也会让规划失败。</p>`;
      }
      s += `<p class="muted" style="margin:0">网格近似（补充）：每个格子取一个代表点，对误差锥里 ${this.K} 个方向各走 ${this.stepCells} 格（含顺应滑动），终点落进哪个格子就看那个格子，再做不动点迭代；` +
        `自然每走一步可以换一次方向。步子太短不行：每步都从格子中心重新出发，取整会把斜的方向「拉」向对角线。边界误差约一两格。</p>`;
      this.info.innerHTML = s;
    }
    // 用 marching squares 画区域边界（比逐格画方块平滑）；障碍里挨着区域的格子也算在内——反正会被障碍盖住，区域就能一直画到边界上
    drawRegion(pl, G, B, fill) {
      const ctx = pl.ctx, nx = G.nx, ny = G.ny, S = B.slice();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if (G.valid[c]) continue;
        for (let dj = -1; dj <= 1 && !S[c]; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && B[jj * nx + ii]) { S[c] = 1; break; }
        }
      }
      const val = (i, j) => S[clamp(j, 0, ny - 1) * nx + clamp(i, 0, nx - 1)];
      const X = (i) => pl.X(G.x0 + (i + 0.5) * G.h), Y = (j) => pl.Y(G.y0 + (j + 0.5) * G.h);
      ctx.save(); ctx.beginPath(); ctx.rect(pl.X(G.x0), pl.Y(G.y1), pl.X(G.x1) - pl.X(G.x0), pl.Y(G.y0) - pl.Y(G.y1)); ctx.clip();
      ctx.beginPath();
      const v = [0, 0, 0, 0], px = [0, 0, 0, 0], py = [0, 0, 0, 0];
      // 整块在里面的方格按行合并成长条（子路径少，填充快）；只有边界上的方格才按 16 种情形画多边形
      for (let j = -1; j < ny; j++) for (let i = -1; i < nx; i++) {
        v[0] = val(i, j); v[1] = val(i + 1, j); v[2] = val(i + 1, j + 1); v[3] = val(i, j + 1);
        const sum = v[0] + v[1] + v[2] + v[3];
        if (!sum) continue;
        if (sum === 4) {
          let i1 = i;
          while (i1 + 1 < nx && val(i1 + 1, j) && val(i1 + 2, j) && val(i1 + 1, j + 1) && val(i1 + 2, j + 1)) i1++;
          ctx.moveTo(X(i), Y(j)); ctx.lineTo(X(i1 + 1), Y(j)); ctx.lineTo(X(i1 + 1), Y(j + 1)); ctx.lineTo(X(i), Y(j + 1)); ctx.closePath();
          i = i1;
          continue;
        }
        px[0] = px[3] = X(i); px[1] = px[2] = X(i + 1); py[0] = py[1] = Y(j); py[2] = py[3] = Y(j + 1);
        let first = true;
        const add = (x, y) => { if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); };
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) & 3;
          if (v[k]) add(px[k], py[k]);
          if (v[k] !== v[k2]) add((px[k] + px[k2]) / 2, (py[k] + py[k2]) / 2);
        }
        ctx.closePath();
      }
      ctx.fillStyle = fill; ctx.fill();
      ctx.restore();
    }
    draw(ctx, pl, col) {
      const G = this.G, B = this.B, st = this.st;
      if (!G || !B) return;
      pl.setRange([G.x0, G.x1], [G.y0, G.y1]);
      plainBg(pl, col, true);
      pl.rect(G.x0, G.y0, G.x1, G.y1, col.surface, col.strong, 1);
      this.drawRegion(pl, G, B, st.mode === "SB" ? C.alpha(col.vis, 0.62) : C.alpha(col.goal, 0.4));
      const E = this.E, cfg = this.cfg(E, G), stick = cfg.stick;
      pl.clip(() => {
        for (const Q of G.polys) pl.poly(Q, col.obst);
        // 可能粘住的边
        if (st.comp) E.forEach((e, i) => {
          if (!stick[i]) return;
          if (!e.goal) { pl.line({ x: e.ax, y: e.ay }, { x: e.bx, y: e.by }, col.worst, 3.5); return; }
          if (e.g1 >= e.g0) {
            if (e.g0 > 1e-9) pl.line({ x: e.ax, y: e.ay }, { x: e.ax + e.tx * e.g0, y: e.ay + e.ty * e.g0 }, col.worst, 3.5);
            if (e.g1 < e.len - 1e-9) pl.line({ x: e.ax + e.tx * e.g1, y: e.ay + e.ty * e.g1 }, { x: e.bx, y: e.by }, col.worst, 3.5);
          } else pl.line({ x: e.ax, y: e.ay }, { x: e.bx, y: e.by }, col.worst, 3.5);
        });
        // 目标边：G′ 粗线，去掉的两端用细虚线
        for (const e of E) {
          if (!e.goal) continue;
          const A = { x: e.ax, y: e.ay }, Bp = { x: e.bx, y: e.by };
          if (e.g1 >= e.g0) {
            const g0 = { x: e.ax + e.tx * e.g0, y: e.ay + e.ty * e.g0 }, g1 = { x: e.ax + e.tx * e.g1, y: e.ay + e.ty * e.g1 };
            if (e.g0 > 1e-9) { pl.line(A, g0, col.best, 2, [4, 3]); pl.line(g1, Bp, col.best, 2, [4, 3]); }
            pl.line(g0, g1, col.best, 5);
          } else pl.line(A, Bp, col.best, 2, [4, 3]);
          const mid = { x: (e.ax + e.bx) / 2, y: (e.ay + e.by) / 2 };
          haloText(pl, st.pre && e.g0 > 1e-9 ? "G′" : "目标边 G", mid, col.best, col.surface, { size: 12.5, weight: 700, dy: 13 });
        }
        // Erdmann 射线与标记点
        const mk = st.comp ? this.marks(stick) : [];
        if (st.rays) {
          const u = st.u * DEG, be = st.beta * DEG, Lr = (G.x1 - G.x0) + (G.y1 - G.y0);
          for (const p of mk) for (const th of [u - be + Math.PI, u + be + Math.PI]) pl.line(p, { x: p.x + Math.cos(th) * Lr, y: p.y + Math.sin(th) * Lr }, col.text2, 1, [5, 4]);
        }
        for (const p of mk) pl.dot(p, 4, col.worst, col.surface, 1.5);
        // 查询点：前向投影锥（图 12.45a）、三条固定方向的轨迹、感知误差球（图 12.45b）
        const q = this.q, u = st.u * DEG, be = st.beta * DEG;
        if (st.eps > 0) {
          const c = pl.ctx; c.beginPath(); c.arc(pl.X(q.x), pl.Y(q.y), pl.S(st.eps), 0, TAU);
          c.fillStyle = C.alpha(col.prob, 0.12); c.fill(); c.setLineDash([4, 3]); c.strokeStyle = col.prob; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
        }
        if (!this.inObs(q)) {
          const Rc = 1.6;
          if (be > 0) pie(pl, q, Rc, u - be, u + be, C.alpha(col.robot, 0.08));
          for (const th of [u - be, u + be]) pl.line(q, { x: q.x + Math.cos(th) * Rc, y: q.y + Math.sin(th) * Rc }, col.robot, 1.2, [5, 4]);
          const ths = be > 0 ? [u - be, u, u + be] : [u];
          for (const th of ths) {
            const T = this.trajectory(th, cfg), P = [];
            for (let i = 0; i < T.rec.length; i += 2) P.push({ x: T.rec[i], y: T.rec[i + 1] });
            pl.path(P, C.alpha(col.robot, 0.85), 1.6);
            const end = P[P.length - 1];
            if (T.res === GOAL) pl.dot(end, 4.5, col.best, col.surface, 1.5);
            else if (T.res === FAIL) {
              const x = pl.X(end.x), y = pl.Y(end.y), c = pl.ctx;
              c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5);
              c.strokeStyle = col.worst; c.lineWidth = 2.5; c.stroke();
            }
          }
          pl.arrow(q, { x: q.x + Math.cos(u) * 0.9, y: q.y + Math.sin(u) * 0.9 }, col.robot, 2.4, 9);
        }
        pl.dot(q, 5, col.robot, col.surface, 2);
        haloText(pl, "q", q, col.robot, col.surface, { size: 13, weight: 700, dx: -11, dy: -10 });
      });
    }
  }

  // ---------------------------------------------------------------
  // 组件 3：平行夹爪挤压零件（12.5.2 节、图 12.50–12.53、例 12.9）
  //   相对转角 φ = x − u（零件朝向减夹爪角；书中写 α = u − x，只差一个符号）。
  //   直径函数 d(φ)：零件转到 φ 时垂直于夹爪方向的厚度（与 Python 参考实现的 width 相同）。
  // ---------------------------------------------------------------
  const PARTS = [["rect", "矩形"], ["tri", "等边三角形"], ["pent", "不规则五边形"], ["trap", "细长梯形"], ["hex", "正六边形"]];
  function partPoly(k, ratio) {
    let P;
    if (k === "rect") P = [[-ratio / 2, -0.5], [ratio / 2, -0.5], [ratio / 2, 0.5], [-ratio / 2, 0.5]];
    else if (k === "tri") P = [90, 210, 330].map((t) => [Math.cos(t * DEG), Math.sin(t * DEG)]);
    else if (k === "pent") P = [[0, 0], [3, 0], [3.6, 1.4], [1.8, 2.4], [-0.4, 1.2]];
    else if (k === "trap") P = [[0, 0], [4, 0], [3.2, 1], [0.6, 1]];
    else P = [0, 60, 120, 180, 240, 300].map((t) => [Math.cos(t * DEG), Math.sin(t * DEG)]);
    // 以面积形心为原点（只影响画图；厚度与平移无关）
    const pts = P.map(([x, y]) => ({ x, y }));
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], cr = a.x * b.y - b.x * a.y;
      A += cr; cx += (a.x + b.x) * cr; cy += (a.y + b.y) * cr;
    }
    cx /= 3 * A; cy /= 3 * A;
    return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }
  function width(P, phi) {
    const s = Math.sin(phi), c = Math.cos(phi);
    let lo = Infinity, hi = -Infinity;
    for (const p of P) { const v = p.x * s + p.y * c; if (v < lo) lo = v; if (v > hi) hi = v; }
    return hi - lo;
  }
  // 周期、稳定转角（极小）、吸引域边界（极大）
  function analyze(P) {
    const scale = Math.max(...P.map((p) => Math.hypot(p.x, p.y)));
    let T = Math.PI;
    for (let k = 12; k >= 1; k--) {
      const Tk = Math.PI / k;
      let ok = true;
      for (let i = 0; i < 360 && ok; i++) { const f = (Math.PI * i) / 360; if (Math.abs(width(P, f) - width(P, f + Tk)) > 1e-9 * scale) ok = false; }
      if (ok) { T = Tk; break; }
    }
    // 极小只出现在某条边与夹爪平行时（d 在那里有个尖点）
    const mins = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dl = 1e-5;
      let f = mod(-Math.atan2(b.y - a.y, b.x - a.x), T);
      if (T - f < 1e-9) f = 0;
      const d0 = width(P, f);
      if (width(P, f - dl) > d0 + 1e-12 && width(P, f + dl) > d0 + 1e-12 && !mins.some((m) => Math.abs(wrapT(m - f, T)) < 1e-7)) mins.push(f);
    }
    mins.sort((a, b) => a - b);
    // 相邻两个极小之间恰有一个光滑的峰；峰两侧由同一对对踵顶点决定：d = w·(sin φ, cos φ)，在 φ* = atan2(w.x, w.y) 取极大
    const maxs = [];
    for (let i = 0; i < mins.length; i++) {
      const a = mins[i], b = i + 1 < mins.length ? mins[i + 1] : mins[0] + T, n = 600;
      let bi = a, bv = -1;
      for (let j = 1; j < n; j++) { const f = a + ((b - a) * j) / n, v = width(P, f); if (v > bv) { bv = v; bi = f; } }
      const s = Math.sin(bi), c = Math.cos(bi);
      let imax = 0, imin = 0;
      P.forEach((p, k) => { const v = p.x * s + p.y * c; if (v > P[imax].x * s + P[imax].y * c) imax = k; if (v < P[imin].x * s + P[imin].y * c) imin = k; });
      const fs = bi + wrapPi(Math.atan2(P[imax].x - P[imin].x, P[imax].y - P[imin].y) - bi);
      maxs.push(Math.abs(fs - bi) <= (2 * (b - a)) / n && fs > a && fs < b ? fs : bi);   // 未取模：落在 (mins[i], mins[i+1])
    }
    const k = mins.length, basins = mins.map((m, i) => ({ m, lo: i > 0 ? maxs[i - 1] : maxs[k - 1] - T, hi: maxs[i] }));
    let dmax = 0, dmin = Infinity;
    for (let i = 0; i < 720; i++) { const v = width(P, (Math.PI * i) / 720); dmax = Math.max(dmax, v); dmin = Math.min(dmin, v); }
    for (const m of maxs) dmax = Math.max(dmax, width(P, m));
    return { T, mins, maxs, basins, dmax, dmin };
  }
  // Goldberg 的反向贪心（[68]，式 (12.38)、(12.39)）：A₀ = 最大的吸引域；之后每步找最大的区间 A，
  // 使它的像 S(A)（所含极小张成的弧）比上一个区间短；区间长到一个周期 T 就停。返回 A₀, A₋₁, …（反向顺序）
  function goldberg(An) {
    const { T, basins } = An, k = basins.length, ext = [];
    for (let j = -1; j <= 2; j++) for (const b of basins) ext.push({ lo: b.lo + j * T, hi: b.hi + j * T, m: b.m + j * T });
    ext.sort((a, b) => a.m - b.m);
    const b0 = basins.reduce((p, b) => (b.hi - b.lo > p.hi - p.lo ? b : p));
    let A = b0.hi - b0.lo;
    const steps = [{ lo: b0.lo, hi: b0.hi, mins: [b0.m], w: A, img: 0 }];
    while (A < T - 1e-9) {
      let best = 0, bi = -1, bj = -1;
      for (let i = 0; i < ext.length; i++) for (let j = i; j < Math.min(i + k, ext.length); j++) {
        if (ext[j].m - ext[i].m < A - 1e-12) { const w = ext[j].hi - ext[i].lo; if (w > best) { best = w; bi = i; bj = j; } }
      }
      if (best <= A + 1e-12) return null;
      A = Math.min(best, T);
      steps.push({ lo: ext[bi].lo, hi: ext[bj].hi, mins: ext.slice(bi, bj + 1).map((e) => e.m), w: A, img: ext[bj].m - ext[bi].m });
    }
    return steps;
  }
  // 把区间序列从前往后对齐成夹爪角：u₁ = 0；之后让当前可能朝向的区间 [L, R] 落在下一个预像区间正中（(12.40) 第三项的作用）
  function forward(steps) {
    const fw = steps.slice().reverse(), us = [];
    let L = 0, R = 0;
    fw.forEach((P, i) => {
      const u = i === 0 ? 0 : (L + R) / 2 - (P.lo + P.hi) / 2;
      us.push(u);
      L = u + P.mins[0]; R = u + P.mins[P.mins.length - 1];
    });
    return { fw, us, final: L };
  }

  // 不受 Plot 约束的画布（动画格子的行列数随宽度改变）
  class Canvas {
    constructor(dims, onDraw) {
      this.dims = dims; this.onDraw = onDraw;
      this.wrap = h("div", { class: "ch12-plot" }); this.canvas = h("canvas"); this.wrap.append(this.canvas);
      new ResizeObserver(() => this.resize()).observe(this.wrap);
      PA.onThemeChange(() => this.draw());
      requestAnimationFrame(() => this.resize());
    }
    resize(force) {
      const w = this.wrap.clientWidth; if (!w) return;
      const d = this.dims(w);
      if (!force && this.ctx && d.W === this.W && d.H === this.H) return;
      this.W = d.W; this.H = d.H; this.ctx = PA.fitCanvas(this.canvas, this.W, this.H); this.draw();
    }
    draw() { if (this.ctx) this.onDraw(this.ctx, C.colors(this.wrap)); }
  }
  const PI_LAB = ["0", "π/2", "π", "3π/2", "2π"];
  const piLabel = (v) => PI_LAB[Math.round(v / (Math.PI / 2))] || "";
  const PI_TICKS = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, TAU];

  class Squeeze {
    constructor(root) {
      this.pk = "rect"; this.ratio = 2; this.n = 6; this.ug = 0;
      this.seq = null; this.Iset = null; this.hist = []; this.hl = null;
      this.runner = new C.Runner(() => this.tick());
      const body = C.frame(root, "平行夹爪挤压零件", "图 12.50–12.53、例 12.9：不用任何传感器，几次挤压就把任意朝向的零件摆成同一个朝向");
      this.selP = C.select(PARTS, this.pk, (k) => { this.pk = k; this.setPart(); });
      this.sR = C.slider("长宽比 b/a", 1, 3, 0.1, this.ratio, (v) => { this.ratio = v; this.setPart(); }, (v) => v.toFixed(1));
      this.bPlan = C.button("执行计划", () => this.runPlan(), "primary");
      this.bNew = C.button("换一组初始朝向", () => this.newCopies(C.newSeed()));
      this.bReset = C.button("重置", () => this.reset());
      this.sU = C.slider("夹爪角 u", 0, 179, 1, 0, (v) => this.previewU(v), (v) => v + "°");
      this.bSq = C.button("挤一下", () => this.manual());
      this.cv = new Canvas((w) => {
        const cols = w >= 560 ? this.n : Math.ceil(this.n / 2), rows = Math.ceil(this.n / cols), cw = w / cols;
        return { W: w, H: Math.round(rows * Math.min(cw, 170)) };
      }, (ctx, col) => this.drawAnim(ctx, col));
      this.dPlot = new C.Plot({ x: [0, TAU], y: [0, 1], aspect: 0.36, maxW: 820, minW: 260, m: { l: 42, r: 12, t: 12, b: 32 }, onDraw: (ctx, pl, col) => this.drawD(ctx, pl, col) });
      this.sPlot = new C.Plot({ x: [0, TAU], y: [0, TAU], aspect: 0.27, maxW: 820, minW: 260, m: { l: 42, r: 12, t: 10, b: 32 }, onDraw: (ctx, pl, col) => this.drawS(ctx, pl, col) });
      minHeight(this.dPlot, 0.36, 200); minHeight(this.sPlot, 0.27, 165);
      this.status = h("div", { class: "small", style: "margin:8px 0" });
      this.planBox = h("div", { class: "small" });
      this.info = h("div", { class: "small" });
      this.ratioRow = h("span", null, this.sR);
      body.append(
        h("div", { class: "controls" }, h("label", null, "零件", this.selP), this.ratioRow, h("span", { class: "sep" }), this.bPlan, this.bNew, this.bReset),
        h("div", { class: "controls" }, this.sU, this.bSq),
        this.cv.wrap, this.status,
        this.dPlot.wrap, cap("直径函数 d(φ)（图 12.51、12.52）：竖线 = 局部极大，把 [0, 2π) 分成编号的吸引域；绿点 = 稳定转角"),
        this.sPlot.wrap, cap("挤压函数 s(φ)：每个吸引域整段被压到它的极小（阶梯）；虚线是 s(φ) = φ"),
        this.planBox, this.info,
        C.legend([[C.cv("vis"), "零件"], [C.cv("obst"), "夹爪"], [C.cv("best"), "稳定转角", true], [C.cv("robot"), "各副本当前的 φ", true],
          [C.cv("cand"), "I-state：还可能的 φ"], [C.cva("best", 0.3), "本步的预像区间"]]));
      this.newCopies(20251);
      this.setPart();
    }
    setPart() {
      this.stop();
      this.ratioRow.style.display = this.pk === "rect" ? "" : "none";
      this.P = partPoly(this.pk, this.ratio);
      this.A = analyze(this.P);
      this.diam = Math.max(...this.P.flatMap((p) => this.P.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
      this.steps = goldberg(this.A);
      this.plan = this.steps ? forward(this.steps) : null;
      this.dPlot.setRange([0, TAU], [0, this.A.dmax * 1.16]);
      this.resetState();
      this.renderPlan();
      this.renderInfo();
      this.redraw(true);
    }
    newCopies(seed) {
      const r = C.rng(seed);
      this.x0 = Array.from({ length: this.n }, () => r() * TAU);
      if (this.A) { this.stop(); this.resetState(); this.redraw(); }
    }
    resetState() {
      this.copies = this.x0.map((x) => ({ x, sep: this.diam * 1.12 }));
      this.Iset = null; this.hist = []; this.hl = null;
      this.ug = this.sU.input.value * DEG;
      this.updateStatus();
    }
    reset() { this.stop(); this.resetState(); this.redraw(); }
    stop() { this.seq = null; this.runner.stop(); this.setBusy(false); }
    setBusy(b) { [this.bPlan, this.bSq].forEach((x) => (x.disabled = b)); this.sU.input.disabled = b; }
    // 挤压函数：φ 被压到所在吸引域的极小（与 φ 在同一个展开分支上）；恰好在极大上则不动（不稳定平衡）
    sOf(phi) {
      const T = this.A.T, psi = mod(phi, T), base = phi - psi;
      for (const b of this.A.basins) for (const k of [-1, 0, 1]) if (psi > b.lo + k * T && psi < b.hi + k * T) return base + b.m + k * T;
      return phi;
    }
    // 非确定 I-state 的更新：可能的绝对朝向集合（mod T），null 表示「全部」
    predict(I, u) {
      const T = this.A.T, out = [];
      const add = (v) => { v = modT(v, T); if (!out.some((w) => Math.abs(wrapT(w - v, T)) < 1e-6)) out.push(v); };
      if (I === null) for (const b of this.A.basins) add(u + b.m);
      else for (const x of I) {
        const phi = x - u, psi = mod(phi, T);
        if (this.A.maxs.some((M) => Math.abs(wrapT(psi - M, T)) < 1e-6)) { add(u + this.sOf(phi - 1e-4)); add(u + this.sOf(phi + 1e-4)); }
        else add(u + this.sOf(phi));
      }
      return out.sort((a, b) => a - b);
    }
    showSet(I) {
      if (I === null) return "全部朝向";
      return "{" + I.map((v) => deg(v, 1)).join(", ") + "}";
    }
    updateStatus(extra) {
      const T = this.A.T, I = this.Iset, uniq = I && I.length === 1;
      const pv = !this.seq ? this.predict(I, this.ug) : null;
      this.status.innerHTML =
        `<b>I-state</b>（还可能的朝向 x，mod T = ${deg(T, 0)}）：<span style="color:var(--warn);font-weight:650">${this.showSet(I)}</span>` +
        (uniq ? ` <span class="yes">✓ 已唯一确定</span>` : "") +
        `　已挤压：${this.hist.length ? this.hist.map((u) => deg(mod(u, Math.PI), 0)).join("、") : "（还没有）"}` +
        (pv && !uniq ? `<br><span class="muted">若在 u = ${deg(mod(this.ug, Math.PI), 0)} 挤一下 → ${this.showSet(pv)}${pv.length === 1 ? "（唯一）" : ""}</span>` : "") +
        (extra ? "<br>" + extra : "");
    }
    previewU(v) { if (this.seq) return; this.ug = v * DEG; this.updateStatus(); this.redraw(); }
    manual() { this.start([this.sU.input.value * DEG], false); }
    runPlan() {
      if (!this.plan) return;
      this.stop();
      this.copies = this.x0.map((x) => ({ x, sep: this.diam * 1.12 }));
      this.Iset = null; this.hist = [];
      this.start(this.plan.us, true);
    }
    // 动画：转夹爪 → 合拢（零件转向吸引域的极小）→ 张开，逐个执行
    start(list, isPlan) {
      this.seq = { list, isPlan, i: 0 };
      this.setBusy(true);
      this.beginRot();
      this.runner.start();
    }
    beginRot() {
      const S = this.seq, target = S.list[S.i], d = mod(target - this.ug + Math.PI / 2, Math.PI) - Math.PI / 2;   // 夹爪 u 与 u + π 相同：转最短的那一边
      S.phase = "rot"; S.t0 = performance.now(); S.uFrom = this.ug; S.uTo = this.ug + d;
      S.dur = Math.abs(d) < 1e-6 ? 0 : 250 + (550 * Math.abs(d)) / (Math.PI / 2);
      this.hl = S.isPlan ? this.plan.fw[S.i] : null;
    }
    beginClose() {
      const S = this.seq, open = this.diam * 1.12;
      S.phase = "close"; S.t0 = performance.now();
      S.cp = this.copies.map((c) => { const f0 = c.x - this.ug, f1 = this.sOf(f0); return { f0, f1, d0: width(this.P, f0), d1: width(this.P, f1) }; });
      S.cStart = open; S.cEnd = Math.min(...S.cp.map((c) => c.d1));
    }
    tick() {
      const S = this.seq; if (!S) return false;
      const now = performance.now(), el = now - S.t0, ease = (k) => k * k * (3 - 2 * k);
      if (S.phase === "rot") {
        const k = S.dur > 0 ? Math.min(1, el / S.dur) : 1;
        this.ug = S.uFrom + (S.uTo - S.uFrom) * ease(k);
        if (k >= 1) { this.ug = S.uTo; this.beginClose(); }
      } else if (S.phase === "close") {
        const k = Math.min(1, el / 1000), c = S.cStart + (S.cEnd - S.cStart) * k;
        this.copies.forEach((cp, i) => {
          const z = S.cp[i];
          let f = z.f0, sep = c;
          if (c < z.d0) {
            if (c <= z.d1) { f = z.f1; sep = z.d1; }
            else {   // 夹爪间距 = 厚度：在单调分支 [f0, f1] 上二分求 d(f) = c
              let lo = 0, hi = 1;
              for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (width(this.P, z.f0 + (z.f1 - z.f0) * m) > c) lo = m; else hi = m; }
              f = z.f0 + (z.f1 - z.f0) * hi;
            }
          }
          cp.x = this.ug + f; cp.sep = sep;
        });
        if (k >= 1) {
          this.copies.forEach((cp, i) => { cp.x = this.ug + S.cp[i].f1; cp.sep = S.cp[i].d1; });
          this.Iset = this.predict(this.Iset, this.ug); this.hist.push(this.ug);
          S.phase = "open"; S.t0 = now; S.seps = this.copies.map((c) => c.sep);
          this.updateStatus();
        }
      } else {
        const k = Math.min(1, el / 380), open = this.diam * 1.12;
        this.copies.forEach((cp, i) => { cp.sep = S.seps[i] + (open - S.seps[i]) * ease(k); });
        if (k >= 1) {
          S.i++;
          if (S.i >= S.list.length) { this.finish(); return false; }
          this.beginRot();
        }
      }
      this.redraw();
      return true;
    }
    finish() {
      const S = this.seq;
      this.seq = null; this.setBusy(false); this.hl = null;
      this.sU.set(Math.round(mod(this.ug, Math.PI) / DEG) % 180);
      const T = this.A.T, xs = this.copies.map((c) => modT(c.x, T)), same = xs.every((v) => Math.abs(wrapT(v - xs[0], T)) < 1e-6);
      this.updateStatus(S && S.isPlan ? (same ? `<span class="yes">计划执行完毕：${this.n} 个副本的朝向（mod T）都是 ${deg(xs[0], 1)}。</span>` : `<span class="no">计划执行完毕，但朝向不一致（不应出现）。</span>`) : "");
      this.redraw();
    }
    // 测试用：立即在 u（度）挤压一次，不播动画
    squeezeNow(d) {
      this.stop(); const u = d * DEG;
      this.copies.forEach((cp) => { cp.x = u + this.sOf(cp.x - u); });
      this.Iset = this.predict(this.Iset, u); this.hist.push(u); this.ug = u;
      this.updateStatus(); this.redraw();
      return this.Iset.map((v) => v / DEG);
    }
    planWidths() { return this.steps ? this.steps.map((s) => s.w / DEG) : null; }
    planAngles() { return this.plan ? this.plan.us.map((u) => mod(u, Math.PI) / DEG) : null; }
    periodDeg() { return this.A.T / DEG; }
    stableDeg() { const T = this.A.T, out = []; for (let k = 0; k * T < Math.PI - 1e-9; k++) for (const m of this.A.mins) out.push((m + k * T) / DEG); return out.sort((a, b) => a - b); }
    maximaDeg() { const T = this.A.T, out = []; for (let k = 0; k * T < Math.PI - 1e-9; k++) for (const m of this.A.maxs) out.push(mod(m + k * T, Math.PI) / DEG); return out.sort((a, b) => a - b); }
    orientations() { return this.copies.map((c) => modT(c.x, this.A.T) / DEG); }
    redraw(all) { this.cv.draw(); this.dPlot.draw(); if (all) this.sPlot.draw(); }
    renderPlan() {
      const T = this.A.T;
      if (!this.steps) { this.planBox.innerHTML = `<p class="no">反向贪心没能扩大区间。</p>`; return; }
      const back = this.steps.map((s, i) => `|A${i ? "₋" + C.sub(i) : "₀"}| = ${deg(s.w, 2)}`).join("，");
      const rows = this.plan.fw.map((P, i) => {
        const sh = T * Math.floor(P.mins[0] / T + 1e-9);   // 平移整数个周期，让区间里第一个稳定转角落在 [0, T)
        return `<tr><td class="c">${i + 1}</td><td class="c"><b>${deg(mod(this.plan.us[i], Math.PI), 1)}</b></td>` +
        `<td>(${deg(P.lo - sh, 1)}, ${deg(P.hi - sh, 1)})</td><td class="c">${deg(P.w, 2)}</td><td class="c">${deg(P.img, 2)}</td></tr>`;
      }).join("");
      this.planBox.innerHTML =
        `<p style="margin:10px 0 6px"><b>反向贪心</b>（[68]，式 (12.38)、(12.39)）：${back}${this.steps.length > 1 || this.steps[0].w >= T - 1e-9 ? `（≥ 周期 T = ${deg(T, 0)}，停止）` : ""}` +
        ` → 计划长度 <b>${this.steps.length}</b> 次挤压。</p>` +
        `<div class="table-wrap" style="margin:0 0 8px"><table class="data ch12-small"><tr><th class="c">第 i 次</th><th class="c">夹爪角 uᵢ</th><th>预像区间 Pᵢ（相对 φ）</th><th class="c">|Pᵢ|</th><th class="c">像 S(Pᵢ) 的宽度</th></tr>${rows}</table></div>` +
        `<p class="muted" style="margin:0 0 8px">从上往下执行：每次挤压后可能的朝向张成的弧（像的宽度）都比下一行的预像区间短 (12.39)，所以总能把它整个放进下一个预像区间——夹爪角就是这样对齐出来的（式 (12.40) 的思路，这里取正中）。最终朝向 ≡ ${deg(mod(this.plan.final, T), 1)}（mod T）。</p>`;
    }
    renderInfo() {
      const A = this.A, T = A.T, perPi = A.mins.length * Math.round(Math.PI / T);
      this.info.innerHTML =
        `<p style="margin:0 0 6px">当前零件：周期 T = ${deg(T, 0)}，[0, π) 内有 ${perPi} 个稳定转角 ${this.stableDeg().map((v) => C.fmtD(v, 2) + "°").join("、")}；` +
        `吸引域边界（极大）${this.maximaDeg().map((v) => C.fmtD(v, 2) + "°").join("、")}。挤压时厚度 d 只减不增，φ 一路滑到所在吸引域的极小——像 8.5.1 节的漏斗；` +
        `所以一次挤压后，整段吸引域都被压成一个点，不确定性只会减少。</p>` +
        `<p style="margin:0 0 6px">例 12.9：选矩形，先把夹爪角拖到 0° 挤一下（朝向都变成 π/2 的倍数，I-state 剩两个点），再拖到 45° 挤一下——朝向唯一了。整个过程没有任何传感器，I-state 只由挤压历史 (12.36) 决定。</p>` +
        `<p class="muted" style="margin:0">补充：d(φ + π) = d(φ) 总成立（平行夹爪分不清 φ 与 φ + π），所以挤压函数的周期 T 是 π 的约数；对称零件的 T 更小（等边三角形、正六边形 60°，正方形 90°）。` +
        `最终朝向只能确定到 mod T——零件上的小圆点标出同一个顶点，执行完计划后有的副本会差 T 的整数倍。书中记 α = u − x，这里用 φ = x − u，只差一个符号。</p>`;
    }
    // 动画画布：每个副本一格，夹爪画成两条平行的粗线
    drawAnim(ctx, col) {
      const cv = this.cv, W = cv.W, H = cv.H, n = this.copies.length;
      const cols = W >= 560 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows, S = Math.min(cw, ch);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = col.surface; ctx.fillRect(0, 0, W, H);
      const sc = (0.56 * S) / this.diam, u = this.ug, tu = { x: Math.cos(u), y: Math.sin(u) }, nu = { x: -Math.sin(u), y: Math.cos(u) };
      const T = this.A.T, closing = this.seq && this.seq.phase === "close";
      this.copies.forEach((cp, i) => {
        const cx = ((i % cols) + 0.5) * cw, cy = (Math.floor(i / cols) + 0.5) * ch;
        ctx.save(); ctx.beginPath(); ctx.rect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch); ctx.clip();
        // 零件：转到 x，沿夹爪法向居中（两个夹爪对称地夹住它）
        const c = Math.cos(cp.x), s = Math.sin(cp.x), R = this.P.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
        const pr = R.map((p) => p.x * nu.x + p.y * nu.y), mid = (Math.min(...pr) + Math.max(...pr)) / 2;
        const scr = (p) => [cx + (p.x - nu.x * mid) * sc, cy - (p.y - nu.y * mid) * sc];
        ctx.beginPath(); R.forEach((p, k) => { const [x, y] = scr(p); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath();
        ctx.fillStyle = col.vis; ctx.fill(); ctx.strokeStyle = col.text; ctx.lineWidth = 1.2; ctx.lineJoin = "round"; ctx.stroke();
        const [mx, my] = scr({ x: R[0].x * 0.78, y: R[0].y * 0.78 });
        ctx.beginPath(); ctx.arc(mx, my, 2.8, 0, TAU); ctx.fillStyle = col.robot; ctx.fill();
        // 夹爪
        const half = (cp.sep * sc) / 2, Lj = 0.4 * S;
        for (const sd of [-1, 1]) {
          const jx = cx + sd * nu.x * half, jy = cy - sd * nu.y * half;
          ctx.beginPath(); ctx.moveTo(jx - tu.x * Lj, jy + tu.y * Lj); ctx.lineTo(jx + tu.x * Lj, jy - tu.y * Lj);
          ctx.strokeStyle = col.obst; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(jx + sd * nu.x * 3, jy - sd * nu.y * 3); ctx.lineTo(jx + sd * nu.x * 11, jy - sd * nu.y * 11);
          ctx.lineWidth = 7; ctx.lineCap = "butt"; ctx.stroke();
          if (closing) {   // 合拢方向的小箭头
            for (const e of [-0.7, 0.7]) {
              const ax = jx + tu.x * Lj * e + sd * nu.x * 16, ay = jy - tu.y * Lj * e - sd * nu.y * 16, px = -sd * nu.x, py = sd * nu.y;
              ctx.beginPath(); ctx.moveTo(ax + px * 7, ay + py * 7); ctx.lineTo(ax - py * 4, ay + px * 4); ctx.lineTo(ax + py * 4, ay - px * 4); ctx.closePath();
              ctx.fillStyle = col.muted; ctx.fill();
            }
          }
        }
        ctx.restore();
        ctx.font = font(11, 600); ctx.fillStyle = col.muted; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText("#" + (i + 1), (i % cols) * cw + 5, Math.floor(i / cols) * ch + 4);
        ctx.textAlign = "right"; ctx.fillStyle = col.text2;
        ctx.fillText(deg(modT(cp.x, T), 0), (i % cols + 1) * cw - 5, Math.floor(i / cols) * ch + 4);
      });
      ctx.strokeStyle = col.border; ctx.lineWidth = 1;
      for (let k = 1; k < cols; k++) { ctx.beginPath(); ctx.moveTo(Math.round(k * cw) + 0.5, 4); ctx.lineTo(Math.round(k * cw) + 0.5, H - 4); ctx.stroke(); }
      for (let k = 1; k < rows; k++) { ctx.beginPath(); ctx.moveTo(4, Math.round(k * ch) + 0.5); ctx.lineTo(W - 4, Math.round(k * ch) + 0.5); ctx.stroke(); }
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }
    // [0, 2π) 上所有吸引域分段（含跨 0 的那段），编号与图 12.52 一致：含 φ = 0 的那段记为 1
    regions() {
      const T = this.A.T, bs = [];
      for (let k = -2; k * T < TAU + T; k++) for (const M of this.A.maxs) { const v = M + k * T; if (v > 1e-9 && v < TAU - 1e-9) bs.push(v); }
      bs.sort((a, b) => a - b);
      const out = [];
      if (!bs.length) return { segs: [{ lo: 0, hi: TAU, id: 1 }], bs };
      out.push({ lo: 0, hi: bs[0], id: 1 });
      for (let i = 0; i + 1 < bs.length; i++) out.push({ lo: bs[i], hi: bs[i + 1], id: i + 2 });
      out.push({ lo: bs[bs.length - 1], hi: TAU, id: 1 });
      return { segs: out, bs };
    }
    drawD(ctx, pl, col) {
      const A = this.A, T = A.T, P = this.P, ymax = pl.o.y[1];
      pl.axes(col, { xt: PI_TICKS, yt: C.ticks(0, ymax, 4), fx: piLabel, fy: (v) => C.fmtD(v, 2), xl: "φ = x − u", yl: "d(φ)" });
      const R = this.regions();
      pl.clip(() => {
        for (const r of R.segs) if (r.id % 2 === 0) pl.rect(r.lo, 0, r.hi, ymax, C.alpha(col.muted, 0.1));
        if (this.hl) for (let k = -3; k <= Math.ceil(TAU / T) + 2; k++) {
          const lo = this.hl.lo + k * T, hi = this.hl.hi + k * T;
          if (hi > 0 && lo < TAU) pl.rect(lo, 0, hi, ymax, C.alpha(col.best, 0.16));
        }
        for (const b of R.bs) pl.line({ x: b, y: 0 }, { x: b, y: width(P, b) }, col.text2, 1.2);
        pl.curve((f) => width(P, f), 0, TAU, 900, col.text, 2);
        for (let k = 0; k * T < TAU - 1e-9; k++) for (const m of A.mins) pl.dot({ x: m + k * T, y: width(P, m) }, 4.5, col.best, col.surface, 1.5);
        for (const r of R.segs) if (r.hi - r.lo > 0.12) pl.text(String(r.id), { x: (r.lo + r.hi) / 2, y: ymax * 0.07 }, col.muted, { size: 11.5, weight: 650 });
        // I-state：还可能的相对转角 φ = x − u（橙）
        const yb = ymax * 0.015;
        if (this.Iset === null) pl.line({ x: 0, y: yb }, { x: TAU, y: yb }, col.cand, 5);
        else for (const x of this.Iset) for (let k = -2; k <= Math.ceil(TAU / T) + 2; k++) {
          const f = x - this.ug + k * T;
          if (f < -1e-9 || f > TAU + 1e-9) continue;
          pl.line({ x: f, y: 0 }, { x: f, y: width(P, f) }, C.alpha(col.cand, 0.75), 1.5, [3, 3]);
          const ctx2 = pl.ctx, X = pl.X(f), Y = pl.Y(0);
          ctx2.beginPath(); ctx2.moveTo(X, Y - 9); ctx2.lineTo(X - 5, Y); ctx2.lineTo(X + 5, Y); ctx2.closePath(); ctx2.fillStyle = col.cand; ctx2.fill();
        }
        // 各副本当前的 φ（蓝）
        for (const cp of this.copies) { const f = mod(cp.x - this.ug, TAU); pl.dot({ x: f, y: width(P, f) }, 4.5, col.robot, col.surface, 1.5); }
      });
    }
    drawS(ctx, pl, col) {
      const A = this.A, T = A.T;
      pl.axes(col, { xt: PI_TICKS, yt: pl.H < 190 ? [0, Math.PI, TAU] : PI_TICKS, fx: piLabel, fy: piLabel, xl: "φ", yl: "s(φ)" });
      pl.clip(() => {
        pl.line({ x: 0, y: 0 }, { x: TAU, y: TAU }, col.muted, 1, [4, 4]);
        for (let k = -2; k * T < TAU + T; k++) for (const b of A.basins) {
          const lo = Math.max(0, b.lo + k * T), hi = Math.min(TAU, b.hi + k * T);
          if (hi <= lo) continue;
          const y = mod(b.m + k * T, TAU);
          pl.line({ x: lo, y }, { x: hi, y }, col.text, 2.4);
        }
        for (let k = 0; k * T < TAU - 1e-9; k++) for (const m of A.mins) pl.dot({ x: m + k * T, y: m + k * T }, 4, col.best, col.surface, 1.5);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='friction-cone']").forEach((el) => (el._w = new FrictionCone(el)));
    document.querySelectorAll("[data-widget='backprojection']").forEach((el) => (el._w = new Backproj(el)));
    document.querySelectorAll("[data-widget='squeeze']").forEach((el) => (el._w = new Squeeze(el)));
  });
})();
