/* 7.3 节：离散与连续混合——门和钥匙（例 7.2、图 7.11、7.12）、可重构机器人（例 7.3、图 7.13、7.14）、
   操作规划中的位形子集（式 7.14–7.20、图 7.15）、transit / transfer 交替与操作图（图 7.16） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;

  // 网格世界小工具：字符画 → 格子集合（第一行是最上面一行）
  function parseGrid(rows) {
    const H = rows.length, W = rows[0].length, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "#" : rows[H - 1 - y][x]);
    return { W, H, at };
  }

  // =================================================================
  // 组件 1：例 7.2「门卫室的力量」——状态 x = (q, m)，m 记录手里的钥匙和两扇门的开关
  // =================================================================
  // # 墙，1 / 2 门，P 门卫室（portiernia），S 起点，G 目标
  const PORT_ROWS = [
    "################",
    "#PP............#",
    "#PP............#",
    "#...###########",
    "#...#.........##",
    "#...#.........##",
    "#S..#...###2####",
    "#...#...#......#",
    "#...1...#......#",
    "#...#...#...G..#",
    "#...#...#......#",
    "################"];
  // 门卫室只信任机器人拿一把钥匙。模式 m = 钥匙(0 无 / 1 / 2) × 门 1(0 关 / 1 开) × 门 2
  const KEYN = ["无", "门 1 的钥匙", "门 2 的钥匙"];
  const modeOf = (k, d1, d2) => k * 4 + d1 * 2 + d2;
  const modeParts = (m) => ({ k: Math.floor(m / 4), d1: (m >> 1) & 1, d2: m & 1 });
  function portierniaWorld() {
    const rows = PORT_ROWS.map((r) => r.padEnd(16, "#")), G = parseGrid(rows);
    let S, Gl; const doors = {};
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const c = G.at(x, y);
      if (c === "S") S = [x, y]; if (c === "G") Gl = [x, y]; if (c === "1" || c === "2") doors[c] = [x, y];
    }
    return { ...G, S, G: Gl, doors };
  }
  function planPortiernia(Wd, returnKey) {
    const enc = (x, y, m) => (y * Wd.W + x) * 12 + m, dec = (u) => { const m = u % 12, c = Math.floor(u / 12); return [c % Wd.W, Math.floor(c / Wd.W), m]; };
    const start = enc(Wd.S[0], Wd.S[1], modeOf(0, 0, 0));
    const isGoal = (u) => { const [x, y, m] = dec(u); return x === Wd.G[0] && y === Wd.G[1] && (!returnKey || modeParts(m).k === 0); };
    const nbrs = (u) => {
      const [x, y, m] = dec(u), { k, d1, d2 } = modeParts(m), out = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = Wd.at(x + dx, y + dy);
        if (c === "#" || (c === "1" && !d1) || (c === "2" && !d2)) continue;
        out.push([enc(x + dx, y + dy, m), null]);
      }
      if (Wd.at(x, y) === "P") for (const k2 of [0, 1, 2]) if (k2 !== k) out.push([enc(x, y, modeOf(k2, d1, d2)), k2 ? (k ? `换成钥匙 ${k2}` : `取钥匙 ${k2}`) : "还钥匙"]);
      for (const i of [1, 2]) {
        const [dx, dy] = Wd.doors[i], open = i === 1 ? d1 : d2;
        if (!open && k === i && Math.abs(dx - x) + Math.abs(dy - y) === 1) out.push([enc(x, y, i === 1 ? modeOf(k, 1, d2) : modeOf(k, d1, 1)), `开门 ${i}`]);
      }
      return out;
    };
    const r = C.bfs(start, isGoal, nbrs);
    return { found: r.found, states: r.path.map(dec), labels: r.labels, expanded: r.expanded };
  }

  class Portiernia {
    constructor(root) {
      this.ret = false; this.u = 0; this.Wd = portierniaWorld();
      const body = C.frame(root, "门卫室的力量（例 7.2）", "机器人在左上角的门卫室（红）领钥匙；拿着对的钥匙碰到门，门就打开。目标：右下角的虚线框");
      this.st = new C.Stage({ view: [0, 16, 0, 12], maxW: 430, aspect: 0.75, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.stM = new C.Stage({ view: [-0.2, 4.2, -0.15, 3.35], maxW: 320, aspect: 0.8, onDraw: (ctx, st, col) => this.drawModes(ctx, st, col) });
      this.cR = C.check("最后还要把钥匙还回门卫室", this.ret, (v) => { this.ret = v; this.update(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.st.draw(); this.stM.draw(); this.status(); }, { label: "步", dur: 9, fmt: (u) => String(Math.round(u * (this.n - 1))) });
      this.cur = h("div", { class: "status-line" }); this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.cR),
        h("div", { class: "split" }, this.st.wrap, h("div", null, h("div", { class: "small muted", style: "text-align:center" }, "模式空间 M（12 个模式；图 7.11 左半）"), this.stM.wrap, this.cur)),
        this.tl.el, this.out);
      this.update();
    }
    update() {
      this.res = planPortiernia(this.Wd, this.ret);
      this.n = this.res.states.length;
      const acts = this.res.labels.map((l, i) => (l ? [i, l] : null)).filter(Boolean);
      this.out.innerHTML = `在 X = C × M 上 BFS（${this.Wd.W * this.Wd.H} 个格子 × 12 个模式），展开 ${this.res.expanded} 个状态。计划共 ${this.n - 1} 步，其中改变模式的动作依次是：<b>${acts.map(([, l]) => l).join(" → ")}</b>。其余每一步都是「移动、模式不变」；在门卫室和门旁边以外的地方，机器人没有改变模式的动作可选。`;
      this.tl.set(0);
    }
    stateAt() { const i = Math.min(this.n - 1, Math.round(this.u * (this.n - 1))); return { i, s: this.res.states[i] }; }
    status() {
      const { i, s } = this.stateAt(), { k, d1, d2 } = modeParts(s[2]);
      this.cur.innerHTML = `第 ${i} 步：手里 <b>${KEYN[k]}</b>；门 1 ${d1 ? "开" : "关"}，门 2 ${d2 ? "开" : "关"}。${this.res.labels[i] ? `（这一步的动作：<b>${this.res.labels[i]}</b>）` : ""}`;
    }
    draw(ctx, st, col) {
      st.frame(col);
      const Wd = this.Wd, { i, s } = this.stateAt(), { k, d1, d2 } = modeParts(s[2]);
      for (let y = 0; y < Wd.H; y++) for (let x = 0; x < Wd.W; x++) {
        const c = Wd.at(x, y), b = { x0: x, y0: y, x1: x + 1, y1: y + 1 };
        if (c === "#") st.box(b, C.alpha(col.wall, 0.88), null);
        else if (c === "P") st.box(b, C.alpha(col.bad, 0.75), null);
        else if (c === "1" || c === "2") {
          const open = c === "1" ? d1 : d2;
          if (open) st.box(b, null, col.warn, 1.5); else st.box(b, C.alpha(col.warn, 0.85), col.warn);
          st.text(c, { x: x + 0.5, y: y + 0.5 }, open ? col.warn : "#fff", { weight: 700, size: 12 });
        }
      }
      ctx.setLineDash([4, 3]); st.box({ x0: Wd.G[0] - 0.4, y0: Wd.G[1] - 0.4, x1: Wd.G[0] + 1.4, y1: Wd.G[1] + 1.4 }, null, col.text2, 1.4); ctx.setLineDash([]);
      st.text("门卫室", { x: 2, y: 10.05 }, "#fff", { size: 11, weight: 650 });
      // 走过的轨迹
      const P = this.res.states.slice(0, i + 1).map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
      st.polyline(P, C.alpha(col.path, 0.85), 2.4);
      this.res.labels.forEach((l, j) => { if (l && j <= i) { const [x, y] = this.res.states[j]; st.dot({ x: x + 0.5, y: y + 0.5 }, 4, col.warn, col.surface, 1.2); } });
      const [x, y] = s;
      st.box({ x0: x + 0.12, y0: y + 0.12, x1: x + 0.88, y1: y + 0.88 }, C.alpha(col.alive, 0.95), col.text, 1.2);
      st.text("A", { x: x + 0.5, y: y + 0.5 }, "#222", { weight: 700, size: 11 });
      if (k) { st.dot({ x: x + 0.95, y: y + 0.95 }, 7, col.accent, col.surface, 1.5); st.text(String(k), { x: x + 0.95, y: y + 0.95 }, "#fff", { weight: 700, size: 10 }); }
    }
    drawModes(ctx, st, col) {
      st.frame(col);
      const pos = (m) => { const { k, d1, d2 } = modeParts(m); return { x: d1 * 2 + d2 + 0.5, y: 2.6 - k * 1.15 }; };
      ["1关 2关", "1关 2开", "1开 2关", "1开 2开"].forEach((t, j) => st.text(t, { x: j + 0.5, y: 3.22 }, col.muted, { size: 10 }));
      // 走过的模式转移
      const S = this.res.states, { i } = this.stateAt();
      for (let j = 1; j <= i; j++) if (S[j][2] !== S[j - 1][2]) st.arrow(pos(S[j - 1][2]), C.lerp(pos(S[j - 1][2]), pos(S[j][2]), 0.82), col.warn, 1.6, 7);
      const visited = new Set(S.slice(0, i + 1).map((s) => s[2])), cur = S[i][2];
      for (let m = 0; m < 12; m++) {
        const p = pos(m);
        st.dot(p, 13, m === cur ? col.warn : visited.has(m) ? C.alpha(col.warn, 0.3) : col.surface2, m === cur ? col.warn : col.strong, 1.2);
        st.text(["无", "钥1", "钥2"][Math.floor(m / 4)], p, m === cur ? "#fff" : col.text2, { size: 10, weight: 650 });
        if (m % 4 === 0) st.text(["无钥匙", "钥匙 1", "钥匙 2"][m / 4], { x: -0.17, y: p.y }, col.muted, { size: 10, align: "left" });
      }
    }
  }

  // =================================================================
  // 组件 2：例 7.3 可重构机器人——两个模式「长条」「方块」，C_free(m) 不同（图 7.13、7.14）
  // =================================================================
  const RECON_ROWS = [
    "########################",
    "#......#..#......#.....#",
    "#......#..#......#.....#",
    "#.........#......#.....#",
    "#.........#......#.....#",
    "#......#..#............#",
    "#......#..#......#.....#",
    "#......#.........#.....#",
    "#......#.........#.....#",
    "########################"];
  // 模式 0：长条（4×1，横放）；模式 1：方块（2×2）。锚点是左下角的格子
  const SHAPES = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]]];
  const SPOTS = [[2, 4], [13, 4]];   // 「只能在这里变形」时允许变形的锚点
  function reconWorld() { return parseGrid(RECON_ROWS); }
  function shapeFree(Wd, m, x, y) { return SHAPES[m].every(([a, b]) => Wd.at(x + a, y + b) !== "#"); }
  function planRecon(Wd, onlySpots) {
    const enc = (x, y, m) => (y * Wd.W + x) * 2 + m, dec = (u) => { const m = u % 2, c = u >> 1; return [c % Wd.W, Math.floor(c / Wd.W), m]; };
    const isGoal = (u) => { const [x, , m] = dec(u); return SHAPES[m].every(([a]) => x + a >= 18); };
    const r = C.bfs(enc(2, 2, 0), isGoal, (u) => {
      const [x, y, m] = dec(u), out = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (shapeFree(Wd, m, x + dx, y + dy)) out.push([enc(x + dx, y + dy, m), null]);
      const okSpot = !onlySpots || SPOTS.some(([a, b]) => a === x && b === y);
      if (okSpot && shapeFree(Wd, 1 - m, x, y)) out.push([enc(x, y, 1 - m), m ? "变成长条" : "变成方块"]);
      return out;
    });
    return { found: r.found, states: r.path.map(dec), labels: r.labels };
  }

  class Reconfig {
    constructor(root) {
      this.spots = false; this.u = 0; this.Wd = reconWorld();
      const body = C.frame(root, "可重构机器人（例 7.3）", "两个模式：长条（elongated）和方块（compressed）。从左边房间出发，要进最右边的房间");
      this.st = new C.Stage({ view: [0, 24, 0, 10], maxW: 620, aspect: 0.42, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.stC = [0, 1].map((m) => new C.Stage({ view: [0, 24, 0, 10], maxW: 320, minW: 150, aspect: 0.42, pad: 3, onDraw: (ctx, st, col) => this.drawC(ctx, st, col, m) }));
      this.cS = C.check("只能在两个圆圈处变形", this.spots, (v) => { this.spots = v; this.update(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.redraw(); }, { label: "步", dur: 8, fmt: (u) => String(Math.round(u * (this.n - 1))) });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.cS), this.st.wrap,
        h("div", { style: "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px" },
          ...[0, 1].map((m) => h("div", { style: "text-align:center" }, this.stC[m].wrap, h("div", { class: "small muted" }, m ? "C_free(方块)：锚点（左下角）能放的位置" : "C_free(长条)：锚点（左下角）能放的位置")))),
        this.tl.el, this.out);
      this.update();
    }
    update() {
      this.res = planRecon(this.Wd, this.spots);
      this.n = this.res.states.length;
      const sw = this.res.labels.filter(Boolean);
      this.out.innerHTML = this.res.found ? `解共 ${this.n - 1} 步，变形 ${sw.length} 次（${sw.join(" → ")}）。左边的弯道只有方块转得过去；右边那道一格高的缝只有横着的长条钻得过去——单独哪一个模式都到不了，必须在中途换模式。` : "无解。";
      this.tl.set(0);
    }
    redraw() { this.st.draw(); this.stC.forEach((s) => s.draw()); }
    stateAt() { return this.res.states[Math.min(this.n - 1, Math.round(this.u * (this.n - 1)))]; }
    walls(st, col) { for (let y = 0; y < this.Wd.H; y++) for (let x = 0; x < this.Wd.W; x++) if (this.Wd.at(x, y) === "#") st.box({ x0: x, y0: y, x1: x + 1, y1: y + 1 }, C.alpha(col.wall, 0.88), null); }
    draw(ctx, st, col) {
      st.frame(col); this.walls(st, col);
      for (const [x, y] of SPOTS) st.dot({ x: x + 1, y: y + 1 }, 9, null, this.spots ? col.ok : C.alpha(col.muted, 0.5), 1.6);
      const [x, y, m] = this.stateAt();
      for (const [a, b] of SHAPES[m]) st.box({ x0: x + a + 0.06, y0: y + b + 0.06, x1: x + a + 0.94, y1: y + b + 0.94 }, C.alpha(col.alive, 0.95), null);
      st.box({ x0: x, y0: y, x1: x + (m ? 2 : 4), y1: y + (m ? 2 : 1) }, null, col.text, 1.4);
      st.text("A", { x: x + (m ? 1 : 2), y: y + (m ? 1 : 0.5) }, "#222", { weight: 700, size: 11 });
      ctx.setLineDash([4, 3]); st.box({ x0: 18, y0: 1, x1: 23, y1: 9 }, null, col.text2, 1.2); ctx.setLineDash([]);
    }
    drawC(ctx, st, col, m) {
      st.frame(col);
      const [ar, ag, ab] = C.rgb(col.wall);
      st.raster(this.Wd.W, this.Wd.H, 0, this.Wd.W, 0, this.Wd.H, (x, y) => (shapeFree(this.Wd, m, x, y) ? null : [ar, ag, ab, 150]));
      // 解路径在这个模式下的那几段（锚点轨迹）
      const S = this.res.states, cur = this.stateAt();
      for (let i = 1; i < S.length; i++) if (S[i][2] === m && S[i - 1][2] === m) st.line({ x: S[i - 1][0] + 0.5, y: S[i - 1][1] + 0.5 }, { x: S[i][0] + 0.5, y: S[i][1] + 0.5 }, col.path, 2.2);
      S.forEach((s, i) => { if (i && s[2] !== S[i - 1][2]) st.dot({ x: s[0] + 0.5, y: s[1] + 0.5 }, 4, col.warn); });
      if (cur[2] === m) st.dot({ x: cur[0] + 0.5, y: cur[1] + 0.5 }, 4.5, col.alive, col.text, 1.2);
    }
  }

  // =================================================================
  // 组件 3：操作规划里的位形子集（式 7.14–7.20、图 7.15）。侧视图，机械手和零件都只平移（补充简化）
  // =================================================================
  const MS = {
    obs: [C.rect(0, 0, 10, 0.6), C.rect(6.6, 3.0, 9.6, 3.35), [{ x: 2.3, y: 0.6 }, { x: 4.1, y: 0.6 }, { x: 3.2, y: 2.7 }]],
    supports: [{ y: 0.6, x0: 0, x1: 10 }, { y: 3.35, x0: 6.6, x1: 9.6 }],
  };
  // 零件 P(q^p)：宽底座 + 窄把手；q^p 是底边中点
  const partPolys = (q) => [C.rect(q.x - 1, q.y, q.x + 1, q.y + 0.8), C.rect(q.x - 0.55, q.y + 0.8, q.x + 0.55, q.y + 1.6)];
  // 机械手 A(q^a)：倒 U 形夹爪 + 手臂；q^a 是夹爪内侧底边中点。内宽 1.1 恰好等于把手宽度
  const clawPolys = (q) => [C.rect(q.x - 0.8, q.y, q.x - 0.55, q.y + 0.9), C.rect(q.x + 0.55, q.y, q.x + 0.8, q.y + 0.9), C.rect(q.x - 0.8, q.y + 0.9, q.x + 0.8, q.y + 1.2), C.rect(q.x - 0.12, q.y + 1.2, q.x + 0.12, q.y + 2.6)];
  const anyOverlap = (A, B, touch) => A.some((a) => B.some((b) => C.convexOverlap(a, b, touch)));
  function classify(qa, qp) {
    const A = clawPolys(qa), P = partPolys(qp), tol = 0.03;
    const aObs = anyOverlap(A, MS.obs, true);           // (7.15)：A(q^a) ∩ O ≠ ∅（闭集，碰到也算）
    const pObs = anyOverlap(P, MS.obs, false);          // (7.16)：int(P(q^p)) ∩ O ≠ ∅（零件可以「贴着」障碍）
    const apObs = anyOverlap(A, P, false);              // (7.17)：A(q^a) ∩ int(P(q^p)) ≠ ∅
    const adm = !aObs && !pObs && !apObs;               // (7.18)
    const stableP = MS.supports.some((s) => Math.abs(qp.y - s.y) < tol && qp.x >= s.x0 && qp.x <= s.x1);
    const sta = adm && stableP;                         // (7.19)
    const dy = qa.y - qp.y, gr = adm && Math.abs(qa.x - qp.x) < tol && dy >= 0.8 - tol && dy <= 1.2 + tol;
    return { aObs, pObs, apObs, adm, sta, gr, tra: sta && gr, stableP };
  }
  const MS_PRESETS = [
    ["q ∈ C^a_obs", { x: 3.2, y: 1.7 }, { x: 1.15, y: 0.6 }],
    ["q ∈ C^p_obs", { x: 6.5, y: 4.6 }, { x: 3.6, y: 1.3 }],
    ["q ∈ C^ap_obs", { x: 5.4, y: 0.95 }, { x: 5.9, y: 0.6 }],
    ["q ∈ C_gr", { x: 5.3, y: 4.0 }, { x: 5.3, y: 3.1 }],
    ["q ∈ C_sta", { x: 1.4, y: 4.2 }, { x: 8.0, y: 3.35 }],
    ["q ∈ C_tra", { x: 7.6, y: 4.25 }, { x: 7.6, y: 3.35 }],
  ];

  class ManipSets {
    constructor(root) {
      this.qa = { ...MS_PRESETS[5][1] }; this.qp = { ...MS_PRESETS[5][2] };
      const body = C.frame(root, "操作规划中的位形子集", "拖动夹爪（黄）和零件（青）；q = (q^a, q^p) ∈ C = C^a × C^p。靠近桌面 / 抓取位置时会自动吸附");
      this.st = new C.Stage({ view: [0, 10, 0, 7], maxW: 520, aspect: 0.7, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (anyOverlap([C.rect(p.x - 0.05, p.y - 0.05, p.x + 0.05, p.y + 0.05)], clawPolys(this.qa), true) ? { w: "qa", o: { x: p.x - this.qa.x, y: p.y - this.qa.y } } :
          anyOverlap([C.rect(p.x - 0.05, p.y - 0.05, p.x + 0.05, p.y + 0.05)], partPolys(this.qp), true) ? { w: "qp", o: { x: p.x - this.qp.x, y: p.y - this.qp.y } } : null),
        onMove: (p, d) => { this[d.w] = this.snap(d.w, { x: C.clamp(p.x - d.o.x, 0.5, 9.5), y: C.clamp(p.y - d.o.y, 0, 6.2) }); this.update(); },
        cursor: () => "grab" });
      this.tbl = h("div");
      body.append(h("div", { class: "controls" }, ...MS_PRESETS.map(([n, a, b]) => C.button(n, () => { this.qa = { ...a }; this.qp = { ...b }; this.update(); }, "small"))),
        h("div", { class: "split" }, this.st.wrap, this.tbl));
      this.update();
    }
    snap(w, q) {
      if (w === "qp") { for (const s of MS.supports) if (Math.abs(q.y - s.y) < 0.25 && q.x >= s.x0 - 0.2 && q.x <= s.x1 + 0.2) return { x: q.x, y: s.y }; return q; }
      const dy = q.y - this.qp.y;
      if (Math.abs(q.x - this.qp.x) < 0.3 && dy > 0.6 && dy < 1.4) return { x: this.qp.x, y: this.qp.y + C.clamp(dy, 0.8, 1.2) };
      return q;
    }
    update() {
      const r = classify(this.qa, this.qp);
      const row = (name, eq, v, note) => h("tr", null, h("td", null, name), h("td", { class: "c" }, eq), h("td", { class: "c" }, v ? h("span", { class: "yes" }, "∈") : h("span", { class: "muted" }, "∉")), h("td", { class: "small" }, note));
      this.tbl.innerHTML = "";
      this.tbl.append(h("div", { class: "table-wrap", style: "margin:0" }, h("table", { class: "data" },
        h("tr", null, h("th", null, "集合"), h("th", null, "式"), h("th", null, "q"), h("th", null, "含义")),
        row("C^a_obs", "(7.15)", r.aObs, "机械手碰到障碍（接触也算）"),
        row("C^p_obs", "(7.16)", r.pObs, "零件的内部碰到障碍（可以贴着桌面）"),
        row("C^ap_obs", "(7.17)", r.apObs, "机械手侵入零件内部"),
        row("C_adm", "(7.18)", r.adm, "可容许：上面三种都不是"),
        row("C_sta", "(7.19)", r.sta, "零件稳稳地放在支撑面上"),
        row("C_gr", "—", r.gr, "机械手夹住了零件（能搬走）"),
        row("C_tra", "C_sta ∩ C_gr", r.tra, "只有这里才能切换 transit / transfer"))),
        h("p", { class: "small muted", style: "margin:.5em 0 0" }, `q^a = (${this.qa.x.toFixed(2)}, ${this.qa.y.toFixed(2)})，q^p = (${this.qp.x.toFixed(2)}, ${this.qp.y.toFixed(2)})。C_free = C_sta ∪ C_gr：任何时刻零件要么放稳，要么被夹住。（补充：「稳定」在这里简化为底边落在支撑面上、重心在支撑面范围内；「夹住」简化为夹爪对准把手、手指至少包住把手的一半。）`));
      this.r = r; this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (const P of MS.obs) st.poly(P, C.alpha(col.wall, 0.85), col.wall);
      for (const s of MS.supports) st.line({ x: s.x0, y: s.y }, { x: s.x1, y: s.y }, col.ok, 2.2);
      const r = this.r;
      for (const P of partPolys(this.qp)) st.poly(P, C.alpha(col.accent, 0.55), col.accent, 1.4);
      for (const P of clawPolys(this.qa)) st.poly(P, C.alpha(col.alive, 0.75), col.warn, 1.4);
      st.text(r.tra ? "q ∈ C_tra" : r.gr ? "q ∈ C_gr" : r.sta ? "q ∈ C_sta" : r.adm ? "q ∈ C_adm" : "q ∉ C_adm", { x: 0.2, y: 6.8 }, r.adm ? col.ok : col.bad, { align: "left", base: "top", size: 13, weight: 700 });
    }
  }

  // =================================================================
  // 组件 4：操作规划——transit / transfer 交替（图 7.16）与操作图 G_m
  // =================================================================
  // 侧视网格：# 实体（地面、墙、桌子）；零件必须落在实体上才「稳定」；夹爪可以从上、左、右三个方向夹
  const MP_ROWS = [
    "##################",
    "#........#.......#",
    "#........#.......#",
    "#........#.......#",
    "#........#.......#",
    "#........#.......#",
    "#........#...###.#",
    "#.#.#............#",
    "##################"];
  const GRASPS = [[0, 1, "上"], [-1, 0, "左"], [1, 0, "右"]];   // 夹爪相对零件的位置
  const MP = { part0: [3, 1], partG: [14, 3], grip0: [6, 5] };
  function mpWorld() { return parseGrid(MP_ROWS); }
  function mpSolve(Wd) {
    const N = Wd.W * Wd.H, id = (x, y) => y * Wd.W + x, xy = (c) => [c % Wd.W, Math.floor(c / Wd.W)];
    const solid = (x, y) => Wd.at(x, y) === "#", stable = (x, y) => !solid(x, y) && solid(x, y - 1);
    const grasp = (g, p) => { const [gx, gy] = xy(g), [px, py] = xy(p); return GRASPS.findIndex(([a, b]) => gx - px === a && gy - py === b); };
    const enc = (g, p, m) => (g * N + p) * 2 + m, dec = (u) => [Math.floor(u / 2 / N), Math.floor(u / 2) % N, u % 2];
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // 动作：transit 只动夹爪；transfer 两者一起平移；只在 C_tra（零件稳定且被夹住）里切换模式
    const nbrs = (u, onlyMode) => {
      const [g, p, m] = dec(u), [gx, gy] = xy(g), [px, py] = xy(p), out = [];
      if (m === 0) { for (const [dx, dy] of D4) { const nx = gx + dx, ny = gy + dy; if (!solid(nx, ny) && id(nx, ny) !== p) out.push([enc(id(nx, ny), p, 0), null]); } }
      else for (const [dx, dy] of D4) if (!solid(gx + dx, gy + dy) && !solid(px + dx, py + dy)) out.push([enc(id(gx + dx, gy + dy), id(px + dx, py + dy), 1), null]);
      if (onlyMode === undefined && stable(px, py) && grasp(g, p) >= 0) out.push([enc(g, p, 1 - m), m ? "放下" : "夹住"]);
      return out;
    };
    const start = enc(id(...MP.grip0), id(...MP.part0), 0), goalP = id(...MP.partG);
    const sol = C.bfs(start, (u) => { const [, p, m] = dec(u); return p === goalP && m === 0; }, (u) => nbrs(u));
    // C_tra 的连通分量（只用停留在 C_tra 里的 transfer 平移连接）→ 操作图 G_m 的顶点
    const tra = [];
    for (let p = 0; p < N; p++) { const [px, py] = xy(p); if (!stable(px, py)) continue; for (const [a, b] of GRASPS) { const gx = px + a, gy = py + b; if (!solid(gx, gy)) tra.push([id(gx, gy), p]); } }
    const key = (g, p) => g * N + p, idx = new Map(tra.map(([g, p], i) => [key(g, p), i])), uf = new C.UnionFind(tra.length);
    tra.forEach(([g, p], i) => { const [gx, gy] = xy(g), [px, py] = xy(p); for (const [dx, dy] of D4) { const j = idx.get(key(id(gx + dx, gy + dy), id(px + dx, py + dy))); if (j !== undefined && !solid(gx + dx, gy + dy)) uf.union(i, j); } });
    const compOf = new Map(), comps = [];
    tra.forEach(([g, p], i) => { const r = uf.find(i); if (!compOf.has(r)) { compOf.set(r, comps.length); comps.push({ members: [], grasp: grasp(g, p) }); } comps[compOf.get(r)].members.push([g, p]); });
    const compIdx = (g, p) => { const i = idx.get(key(g, p)); return i === undefined ? -1 : compOf.get(uf.find(i)); };
    comps.forEach((c) => { const P = c.members.map(([, p]) => xy(p)); c.x0 = Math.min(...P.map((q) => q[0])); c.x1 = Math.max(...P.map((q) => q[0])); c.y = P[0][1]; c.cx = (c.x0 + c.x1) / 2 + 0.5; c.cy = c.y + 0.5; });
    // 操作图的边：从一个分量出发，只用 transit（或只用 transfer）动作能到达的其它分量
    const edges = [];
    comps.forEach((c, a) => {
      for (const m of [0, 1]) {
        const seen = new Set(), Q = [];
        for (const [g, p] of c.members) { const u = enc(g, p, m); seen.add(u); Q.push(u); }
        const hit = new Set();
        while (Q.length) {
          const u = Q.shift();
          for (const [v] of nbrs(u, m)) {
            if (seen.has(v)) continue; seen.add(v);
            const [g, p] = dec(v), b = compIdx(g, p);
            if (b >= 0 && b !== a) { hit.add(b); continue; }   // 进入另一个分量就停
            Q.push(v);
          }
        }
        for (const b of hit) if (a < b || !edges.some((e) => e.a === b && e.b === a && e.m === m)) edges.push({ a, b, m });
      }
    });
    const states = sol.path.map(dec).map(([g, p, m]) => ({ g: xy(g), p: xy(p), m }));
    return { found: sol.found, states, labels: sol.labels, expanded: sol.expanded, comps, edges, compIdx: (s) => compIdx(id(...s.g), id(...s.p)) };
  }

  class ManipPlan {
    constructor(root) {
      this.u = 0; this.showGm = true; this.Wd = mpWorld();
      const body = C.frame(root, "操作规划：transit 与 transfer 交替", "侧视图。零件（青）在左边的坑里，要放到右边的桌子上（虚线框）；墙上那条一格高的隧道只容横着的「夹爪 + 零件」通过");
      this.st = new C.Stage({ view: [0, 18, 0, 9], maxW: 620, aspect: 0.5, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.stL = new C.Stage({ view: [0, 5, 0, 1], maxW: 620, aspect: 0.2, pad: 4, onDraw: (ctx, st, col) => this.drawLayers(ctx, st, col) });
      this.cG = C.check("显示操作图 G_m（C_tra 的连通分量与它们之间的边）", this.showGm, (v) => { this.showGm = v; this.st.draw(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.st.draw(); this.stL.draw(); this.status(); }, { label: "步", dur: 10, fmt: (u) => String(Math.round(u * (this.n - 1))) });
      this.cur = h("div", { class: "status-line" }); this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.cG), this.st.wrap, h("div", { class: "small muted" }, "图 7.16 的展开版：横轴是步数，下层 transit、上层 transfer，竖线是模式切换（只能发生在 C_tra 里）"), this.stL.wrap,
        this.tl.el, this.cur, this.out, C.legend([[C.cv("accent"), "transit 路径（零件不动）"], [C.cv("warn"), "transfer 路径（夹着零件）"], [C.cv("ok"), "C_tra 的分量 = G_m 的顶点"]]));
      this.res = mpSolve(this.Wd); this.n = this.res.states.length;
      const sw = this.res.labels.filter(Boolean).length, segs = this.segments();
      this.out.innerHTML = `BFS 在 X = C × M 上展开 ${this.res.expanded.toLocaleString()} 个状态，计划共 ${this.n - 1} 步：${segs.length} 段路径（${segs.map((s) => (s.m ? "transfer" : "transit")).join(" → ")}），切换模式 ${sw} 次。` +
        `零件在坑里只能从上面夹；夹着它竖成两格高过不了隧道，所以必须先放到地上、绕到侧面<b>重新夹</b>（regrasp）。G_m 有 ${this.res.comps.length} 个顶点、${this.res.edges.length} 条边。`;
      this.tl.set(0);
    }
    segments() {
      const S = this.res.states, out = []; let a = 0;
      for (let i = 1; i <= S.length; i++) if (i === S.length || S[i].m !== S[a].m) { out.push({ a, b: i - 1, m: S[a].m }); a = i; }
      return out.filter((s) => s.b > s.a);
    }
    stateAt() { const i = Math.min(this.n - 1, Math.round(this.u * (this.n - 1))); return { i, s: this.res.states[i] }; }
    status() {
      const { i, s } = this.stateAt(), c = this.res.compIdx(s);
      this.cur.innerHTML = `第 ${i} 步：<b>${s.m ? "transfer" : "transit"}</b> 模式；${c >= 0 ? `q ∈ C_tra（分量 ${c + 1}，可以切换模式）` : "q ∉ C_tra（不能切换模式）"}${this.res.labels[i] ? `；动作：<b>${this.res.labels[i]}</b>` : ""}。`;
    }
    draw(ctx, st, col) {
      st.frame(col);
      for (let y = 0; y < this.Wd.H; y++) for (let x = 0; x < this.Wd.W; x++) if (this.Wd.at(x, y) === "#") st.box({ x0: x, y0: y, x1: x + 1, y1: y + 1 }, C.alpha(col.wall, 0.88), null);
      ctx.setLineDash([4, 3]); st.box({ x0: MP.partG[0] + 0.05, y0: MP.partG[1] + 0.05, x1: MP.partG[0] + 0.95, y1: MP.partG[1] + 0.95 }, null, col.text2, 1.4); ctx.setLineDash([]);
      const S = this.res.states, { i, s } = this.stateAt();
      if (this.showGm) {
        // G_m：顶点画在该分量里零件位置的中点（按抓法错开），边只画成淡淡的直线
        const R = this.res, pt = (c) => ({ x: c.cx + [0, -0.3, 0.3][c.grasp], y: c.cy + [0.32, 0, 0][c.grasp] });
        for (const e of R.edges) st.line(pt(R.comps[e.a]), pt(R.comps[e.b]), C.alpha(e.m ? col.warn : col.accent, 0.28), 1, e.m ? null : [3, 3]);
        R.comps.forEach((c) => st.line({ x: c.x0 + 0.5, y: c.cy - 0.42 }, { x: c.x1 + 0.5, y: c.cy - 0.42 }, C.alpha(col.ok, 0.55), 3));
        R.comps.forEach((c, k) => { st.dot(pt(c), 6.5, col.okSoft, col.ok, 1.3); st.text(String(k + 1), pt(c), col.ok, { size: 8.5, weight: 700 }); });
      }
      // 已走过的轨迹：夹爪中心，按模式着色
      for (let j = 1; j <= i; j++) { const a = S[j - 1], b = S[j]; st.line({ x: a.g[0] + 0.5, y: a.g[1] + 0.5 }, { x: b.g[0] + 0.5, y: b.g[1] + 0.5 }, b.m ? col.warn : col.accent, 2.4); }
      const [px, py] = s.p, [gx, gy] = s.g;
      st.box({ x0: px + 0.08, y0: py, x1: px + 0.92, y1: py + 0.84 }, C.alpha(col.accent, 0.55), col.accent, 1.5);
      st.text("P", { x: px + 0.5, y: py + 0.42 }, col.text, { weight: 700, size: 11 });
      st.box({ x0: gx + 0.12, y0: gy + 0.12, x1: gx + 0.88, y1: gy + 0.88 }, C.alpha(col.alive, 0.95), s.m ? col.warn : col.text, s.m ? 2.4 : 1.2);
      st.text("A", { x: gx + 0.5, y: gy + 0.5 }, "#222", { weight: 700, size: 11 });
    }
    drawLayers(ctx, st, col) {
      st.frame(col);
      const S = this.res.states, n = S.length - 1, X = (j) => 0.55 + 4.35 * j / n, Y = (m) => (m ? 0.72 : 0.28);
      st.line({ x: 0.55, y: 0.72 }, { x: 4.9, y: 0.72 }, C.alpha(col.muted, 0.3), 8); st.line({ x: 0.55, y: 0.28 }, { x: 4.9, y: 0.28 }, C.alpha(col.muted, 0.3), 8);
      st.text("Transfer", { x: 0.05, y: 0.72 }, col.muted, { align: "left", size: 11 }); st.text("Transit", { x: 0.05, y: 0.28 }, col.muted, { align: "left", size: 11 });
      for (let j = 1; j <= n; j++) {
        const a = S[j - 1], b = S[j];
        if (a.m === b.m) st.line({ x: X(j - 1), y: Y(a.m) }, { x: X(j), y: Y(b.m) }, a.m ? col.warn : col.accent, 3);
        else st.line({ x: X(j), y: Y(a.m) }, { x: X(j), y: Y(b.m) }, col.ok, 2);
      }
      const { i } = this.stateAt(); st.dot({ x: X(i), y: Y(S[i].m) }, 5, col.current, col.surface, 1.5);
    }
  }

  CH7.hybrid = { Portiernia, Reconfig, ManipSets, ManipPlan, portierniaWorld, planPortiernia, modeParts, reconWorld, planRecon, shapeFree, classify, MS_PRESETS, mpWorld, mpSolve };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='portiernia']").forEach((el) => el._w = new Portiernia(el));
    document.querySelectorAll("[data-widget='reconfig']").forEach((el) => el._w = new Reconfig(el));
    document.querySelectorAll("[data-widget='manip-sets']").forEach((el) => el._w = new ManipSets(el));
    document.querySelectorAll("[data-widget='manip-plan']").forEach((el) => el._w = new ManipPlan(el));
  });
})();
