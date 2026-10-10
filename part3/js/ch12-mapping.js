/* 12.3 节：环境不确定——判定环境（例 12.4、12.5，图 12.12、12.13）、Blum–Kozen 迷宫搜索（纬度 + 模 3 转角，图 12.14–12.16）、
   间隙导航树 GNT（图 12.27–12.36，例 12.6） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH12;
  const { DIRS, DV } = C;
  const ARROW = { N: "↑", E: "→", S: "↓", W: "←" };

  // ---------------------------------------------------------------
  // 组件：判定环境（例 12.4、12.5、习题 5）
  //   状态 x = (p, d, e)；环境 e 用白格集合表示，坐标以原点（白圈）为 (0, 0)。
  // ---------------------------------------------------------------
  // 图 12.12 / 12.13：3×3，行从上往下写；'#' 障碍、'.' 白格、'o' 原点
  const ENV_ROWS = {
    e1: ["...", ".#.", "o.."], e2: [".#.", ".#.", "o.."], e3: ["...", ".##", "o##"],
    e4: ["#.#", "...", "o.."], e5: ["#..", "##.", "o.."], e6: ["...", "...", "o.."],
    e7: ["o..", ".#.", "..."], e8: ["...", ".#.", "o#."], e9: ["...", ".##", "o#."],
  };
  const ENVS = {};
  for (const [k, rows] of Object.entries(ENV_ROWS)) {
    const cells = new Set(); let o = null;
    rows.slice().reverse().forEach((line, r) => [...line].forEach((ch, c) => { if (ch !== "#") cells.add(c + "," + r); if (ch === "o") o = [c, r]; }));
    ENVS[k] = { cells, o, rows };
  }
  // 状态的字符串表示：「e|c,r|d」，c, r 是 3×3 里的列、行（行 0 在下）；书中坐标 p = (c − o_c, r − o_r)
  const st = (e, c, r, d) => `${e}|${c},${r}|${d}`;
  const parse = (s) => { const [e, cr, d] = s.split("|"); const [c, r] = cr.split(",").map(Number); return { e, c, r, d }; };
  function envF(s, u) {
    const { e, c, r, d } = parse(s);
    const nd = C.turnDir(d, u), v = DV[nd], c2 = c + v[0], r2 = r + v[1];
    return ENVS[e].cells.has(c2 + "," + r2) ? st(e, c2, r2, nd) : st(e, c, r, nd);
  }
  const movedEnv = (a, b) => (a.split("|")[1] !== b.split("|")[1] ? 1 : 0);
  const EPRESETS = {
    ex124: { label: "例 12.4", envs: 6, known: false, truth: st("e3", 0, 0, "E"), seq: "FRRRFRFR" },
    ex124b: { label: "例 12.4 + e7–e9", envs: 9, known: false, truth: st("e3", 0, 0, "E"), seq: "FRRRFRFR" },
    hw5: { label: "习题 5", envs: 6, known: false, truth: st("e1", 2, 2, "N"), seq: "FRBFLLF" },
    ex125: { label: "例 12.5（已知起点）", envs: 6, known: true, truth: st("e4", 0, 0, "E"), seq: "FF" },
    ex125b: { label: "例 12.5：(F,L,R,L)", envs: 6, known: true, truth: st("e6", 0, 0, "E"), seq: "FLRL" },
  };
  class EnvId {
    constructor(root) {
      this.nEnv = 6; this.known = false; this.truth = st("e3", 0, 0, "E"); this.queue = [];
      const body = C.frame(root, "判定环境：状态里也包含地图 e", "I-state 是 (位置, 朝向, 环境) 的集合；被排除的环境变暗");
      this.envCb = C.checkbox("加入图 12.13 的 e7–e9", false, (v) => { this.nEnv = v ? 9 : 6; this.reset(); });
      this.knownCb = C.checkbox("已知从原点朝东出发（例 12.5）", false, (v) => { this.known = v; this.reset(); });
      this.presetSeg = C.seg(Object.entries(EPRESETS).map(([k, p]) => [k, p.label]), null, (k) => this.preset(k));
      this.plot = new C.Plot({ aspect: 0.72, maxW: 560, minW: 280, equal: true, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.click(p), cursor: () => "pointer" });
      this.next = C.button("▶ 按预设走下一步", () => this.playNext(), "primary");
      this.stats = { e: C.stat("可能的环境"), x: C.stat("|X_k|") };
      this.histEl = h("div", { class: "table-wrap", style: "margin:6px 0 0;max-height:250px;overflow:auto" });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.envCb, this.knownCb),
        h("div", { class: "controls" }, h("span", { class: "small muted" }, "预设："), this.presetSeg),
        h("div", { class: "split" },
          h("div", null, this.plot.wrap, h("div", { class: "small muted" }, "点任一张图里的白格：把真实环境和位置设在那里（再点换朝向）。")),
          h("div", null, h("div", { class: "controls" }, ...["F", "B", "R", "L"].map((u) => C.button(C.ACT_ZH[u], () => { this.queue = []; this.act(u); this.updNext(); }))),
            h("div", { class: "controls" }, this.next, C.button("重新开始", () => this.reset())),
            h("div", { class: "stats" }, ...Object.values(this.stats)), this.info, this.histEl)),
        C.legend([[C.cv("cand"), "还可能的（位置, 朝向）"], [C.cv("robot"), "真实状态", true], [C.cv("best"), "原点 (0, 0)", true]]));
      this.reset();
    }
    envList() { return Object.keys(ENVS).slice(0, this.nEnv); }
    preset(k) {
      const p = EPRESETS[k];
      this.nEnv = p.envs; this.envCb.input.checked = p.envs === 9;
      this.known = p.known; this.knownCb.input.checked = p.known;
      this.truth = p.truth; this.reset();
      this.queue = p.seq.split(""); this.updNext();
    }
    reset() {
      const S = new Set();
      for (const e of this.envList()) {
        if (this.known) { const o = ENVS[e].o; S.add(st(e, o[0], o[1], "E")); continue; }
        for (const k of ENVS[e].cells) { const [c, r] = k.split(",").map(Number); for (const d of DIRS) S.add(st(e, c, r, d)); }
      }
      if (!this.envList().includes(parse(this.truth).e)) this.truth = st("e3", 0, 0, "E");
      if (this.known) { const t = parse(this.truth), o = ENVS[t.e].o; this.truth = st(t.e, o[0], o[1], "E"); }
      this.S = S; this.x = this.truth; this.hist = []; this.queue = [];
      this.updNext(); this.update();
    }
    updNext() { this.next.disabled = !this.queue.length; this.next.textContent = this.queue.length ? `▶ 下一步：${this.queue[0]}（还剩 ${this.queue.length}）` : "▶ 按预设走下一步"; }
    playNext() { if (this.queue.length) { this.act(this.queue.shift()); this.updNext(); } }
    act(u) {
      const x2 = envF(this.x, u), y = movedEnv(this.x, x2), S2 = new Set();
      for (const s of this.S) { const s2 = envF(s, u); if (movedEnv(s, s2) === y) S2.add(s2); }
      this.hist.push({ u, y, S: S2 });
      this.S = S2; this.x = x2;
      this.update();
    }
    envsOf(S) { return [...new Set([...S].map((s) => parse(s).e))].sort((a, b) => a.slice(1) - b.slice(1)); }
    update() {
      this.plot.setAspect((this.layout().rows * 4.6 + 1) / (3 * 4.3 + 0.2));
      const envs = this.envsOf(this.S);
      this.stats.e.set(envs.join("、") || "∅"); this.stats.x.set(this.S.size);
      const rows = this.hist.map((e, i) => `<tr><td class="c">${i + 1}</td><td class="c">${e.u}</td><td class="c">${e.y ? "动了" : "没动"}</td><td>${this.envsOf(e.S).join("、")}</td><td class="c">${e.S.size}</td></tr>`);
      this.histEl.innerHTML = `<table class="data ch12-small"><thead><tr><th class="c">k</th><th class="c">u_k</th><th class="c">y_{k+1}</th><th>还可能的环境</th><th class="c">|X|</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
      this.histEl.scrollTop = this.histEl.scrollHeight;
      let msg = "";
      if (this.S.size === 1) msg = "所有不确定性都消除了：环境、位置、朝向都确定。";
      else if (envs.length === 1) msg = `环境已确定是 ${envs[0]}，但位置 / 朝向还有 ${this.S.size} 种可能。`;
      else if (this.nEnv === 9) msg = "e1 与 e7、e2 与 e8 对任何动作序列都给出完全相同的观测（只是原点或画法不同）；e9 多出的那个白格根本到不了——这些区别对机器人来说不存在，可以把它们当作等价的环境。";
      else msg = this.known ? "已知起点时，导航只需要排除「挡路」的环境，不必知道到底是哪一个。" : "机器人从不改变环境，只有关于「在哪个环境里」的信息会变。";
      this.info.textContent = msg;
      this.plot.draw();
    }
    layout() {
      const list = this.envList(), cols = 3, rows = Math.ceil(list.length / cols);
      return { list, cols, rows, pos: (i) => ({ x: (i % cols) * 4.3, y: (rows - 1 - Math.floor(i / cols)) * 4.6 + 0.8 }) };
    }
    click(p) {
      const L = this.layout();
      for (let i = 0; i < L.list.length; i++) {
        const o = L.pos(i), c = Math.floor(p.x - o.x - 0.3), r = Math.floor(p.y - o.y - 0.3), e = L.list[i];
        if (c >= 0 && c < 3 && r >= 0 && r < 3 && ENVS[e].cells.has(c + "," + r)) {
          const t = parse(this.truth);
          this.truth = (t.e === e && t.c === c && t.r === r) ? st(e, c, r, DIRS[(DIRS.indexOf(t.d) + 1) % 4]) : st(e, c, r, "E");
          if (this.known) { this.known = false; this.knownCb.input.checked = false; }
          this.reset();
        }
      }
      return null;
    }
    draw(ctx, pl, col) {
      const L = this.layout();
      pl.setRange([-0.1, 3 * 4.3 + 0.1], [-0.1, L.rows * 4.6 + 0.9]);
      const alive = new Set(this.envsOf(this.S)), t = parse(this.x);
      L.list.forEach((e, i) => {
        const o = L.pos(i), E = ENVS[e], on = alive.has(e), X0 = o.x + 0.3, Y0 = o.y + 0.3;
        pl.rect(o.x, o.y, o.x + 3.6, o.y + 3.6, on ? col.obst : C.alpha(col.obst, 0.35));
        for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) if (E.cells.has(c + "," + r))
          pl.rect(X0 + c + 0.03, Y0 + r + 0.03, X0 + c + 0.97, Y0 + r + 0.97, on ? col.surface : col.surface2);
        pl.dot({ x: X0 + E.o[0] + 0.5, y: Y0 + E.o[1] + 0.5 }, Math.max(3, pl.S(0.12)), null, col.best, 2);
        pl.text(e + (on ? "" : "（排除）"), { x: o.x + 1.8, y: o.y }, on ? col.text : col.muted, { size: 12, weight: 650, base: "top", dy: 3 });
        const Lr = pl.S(0.32);
        for (const s of this.S) {
          const q = parse(s); if (q.e !== e) continue;
          const cx = pl.X(X0 + q.c + 0.5), cy = pl.Y(Y0 + q.r + 0.5), v = DV[q.d];
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + v[0] * Lr, cy - v[1] * Lr);
          ctx.strokeStyle = col.cand; ctx.lineWidth = Math.max(3, pl.S(0.1)); ctx.lineCap = "round"; ctx.stroke();
        }
        if (t.e === e) {
          const c0 = { x: X0 + t.c + 0.5, y: Y0 + t.r + 0.5 }, v = DV[t.d];
          pl.dot(c0, Math.max(5, pl.S(0.15)), null, col.robot, 2.5);
          pl.arrow(c0, { x: c0.x + v[0] * 0.4, y: c0.y + v[1] * 0.4 }, col.robot, 2.5, 8);
        }
      });
    }
  }

  // ---------------------------------------------------------------
  // 组件：Blum–Kozen 迷宫搜索——只记纬度 l（一个计数器）和转角 r mod 3；虚拟障碍把所有障碍连到外墙
  // ---------------------------------------------------------------
  const MAZE = [
    "###################",
    "#.................#",
    "#.##........#.....#",
    "#.##..###...#..#..#",
    "#.....#.....#..#..#",
    "#..#..#..####..#..#",
    "#..#..............#",
    "#..####...##......#",
    "#.........##..###.#",
    "#.....#.......#...#",
    "#.....#.......#...#",
    "###################",
  ];
  class Maze {
    constructor(root) {
      this.env = new C.GridEnv(MAZE);
      this.fict = true; this.cover = false; this.speed = 6;
      const body = C.frame(root, "迷宫搜索：一个计数器 + 模 3", "沿墙走（墙在左手边）；只记纬度 l 与 r mod 3，就能保证绕回起点、不在圈里打转");
      this.fictCb = C.checkbox("加虚拟细墙（图 12.15）", this.fict, (v) => { this.fict = v; this.rebuild(); });
      this.coverCb = C.checkbox("覆盖所有格子（图 12.16b 的意思；补充：用生成树代替书中的之字形规则）", this.cover, (v) => { this.cover = v; this.rebuild(); });
      this.runner = new C.Runner(() => this.tick(), () => (this.runBtn.textContent = "▶ 运行"));
      this.runBtn = C.button("▶ 运行", () => { if (this.runner.running) this.runner.stop(); else { this.runner.start(); this.runBtn.textContent = "⏸ 暂停"; } }, "primary");
      this.plot = new C.Plot({ aspect: MAZE.length / MAZE[0].length, maxW: 640, minW: 280, equal: true, m: { l: 2, r: 2, t: 2, b: 2 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.click(p), cursor: () => "pointer" });
      this.stats = { l: C.stat("纬度 l（二进制）"), r3: C.stat("r mod 3"), r: C.stat("真实 r = 右转 − 左转"), v: C.stat("访问过的格子"), s: C.stat("步数") };
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.fictCb, this.coverCb),
        h("div", { class: "controls" }, this.runBtn, C.button("单步", () => this.tick()), C.button("重新开始", () => this.reset()),
          C.slider("速度", 1, 30, 1, this.speed, (v) => { this.speed = v; })),
        this.plot.wrap, h("div", { class: "small muted" }, "点一个白格把机器人放在那里：它先一直往西走到墙，然后右转、开始沿墙走。"),
        h("div", { class: "stats" }, ...Object.values(this.stats)), this.info,
        C.legend([[C.cv("robot"), "机器人与走过的路"], [C.cva("best", 0.3), "访问过的格子"], [C.cv("best"), "唯一点与向南的虚拟细墙", true], [C.cv("obst"), "障碍"]]));
      this.start = [1, 10];
      this.rebuild();
    }
    // 虚拟细墙：每个内部障碍的「唯一点」= 最南一排格子里最西那格的左下角，从那里往南画一条细墙直到碰到障碍
    rebuild() {
      const E = this.env, W = E.W, H = E.H;
      const lab = new Int16Array(W * H).fill(-1); let n = 0;
      const border = (i, j) => i === 0 || j === 0 || i === W - 1 || j === H - 1;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (E.free[E.idx(i, j)] || lab[E.idx(i, j)] >= 0) continue;
        const stack = [[i, j]]; lab[E.idx(i, j)] = n; let touches = false;
        while (stack.length) {
          const [a, b] = stack.pop(); if (border(a, b)) touches = true;
          for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a2 = a + da, b2 = b + db;
            if (a2 < 0 || b2 < 0 || a2 >= W || b2 >= H) continue;
            const k = E.idx(a2, b2); if (!E.free[k] && lab[k] < 0) { lab[k] = n; stack.push([a2, b2]); }
          }
        }
        if (touches) for (let k = 0; k < W * H; k++) if (lab[k] === n) lab[k] = -2;
        n++;
      }
      this.uniq = []; this.walls = new Set();   // 细墙：键「i,j,dir」表示格子 (i,j) 的这一侧有墙
      const wall = (i, j, d) => this.walls.add(`${i},${j},${d}`);
      for (let id = 0; id < n; id++) {
        let best = null;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (lab[E.idx(i, j)] === id) {
          if (!best || j > best[1] || (j === best[1] && i < best[0])) best = [i, j];   // j 大 = 更靠南
        }
        if (!best) continue;
        const [ui, uj] = best;
        this.uniq.push({ x: ui, y: H - 1 - uj, len: 0 });   // 角点坐标（画布坐标，y 向上）
        if (!this.fict) continue;
        let j = uj + 1, len = 0;
        while (j < H && E.isFree(ui, j) && E.isFree(ui - 1, j)) { wall(ui, j, "W"); wall(ui - 1, j, "E"); j++; len++; }
        this.uniq[this.uniq.length - 1].len = len;
      }
      // 覆盖模式（补充）：在白格上取一棵「尽量竖着连」的生成树，树外的相邻关系都加细墙，沿墙走就走遍整棵树
      if (this.cover) {
        const par = new Int32Array(W * H).map((_, k) => k), find = (k) => (par[k] === k ? k : (par[k] = find(par[k])));
        const blocked = (i, j, d) => this.walls.has(`${i},${j},${d}`);
        const edges = [];
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (E.isFree(i, j)) {
          if (E.isFree(i, j + 1) && !blocked(i, j, "S")) edges.push([0, i, j, i, j + 1, "S", "N"]);
          if (E.isFree(i + 1, j) && !blocked(i, j, "E")) edges.push([1, i, j, i + 1, j, "E", "W"]);
        }
        edges.sort((a, b) => a[0] - b[0] || b[2] - a[2]);   // 先竖边；横边从南往北
        for (const [, i, j, i2, j2, d, d2] of edges) {
          const a = find(E.idx(i, j)), b = find(E.idx(i2, j2));
          if (a !== b) par[a] = b; else { wall(i, j, d); wall(i2, j2, d2); }
        }
      }
      this.reset();
    }
    open(i, j, d) {
      const v = DV[d], i2 = i + v[0], j2 = j - v[1];
      return this.env.isFree(i2, j2) && !this.walls.has(`${i},${j},${d}`);
    }
    reset() {
      this.runner.stop();
      const [i, j] = this.start;
      this.s = { i, j, d: "W" }; this.phase = 0; this.l = 0; this.r = 0; this.steps = 0;
      this.trail = [[i, j]]; this.visited = new Set([i + "," + j]); this.loop0 = null; this.closed = false; this.loops = 0;
      this.update();
    }
    turn(k) { this.s.d = DIRS[(DIRS.indexOf(this.s.d) + k + 4) % 4]; this.r += k; }
    fwd() {
      const v = DV[this.s.d]; this.s.i += v[0]; this.s.j -= v[1];
      if (this.s.d === "N") this.l++; if (this.s.d === "S") this.l--;
      this.trail.push([this.s.i, this.s.j]); this.visited.add(this.s.i + "," + this.s.j);
    }
    step() {
      const { i, j, d } = this.s;
      if (this.phase === 0) {   // 先往西走到墙，再右转，让墙在左手边
        if (this.open(i, j, d)) this.fwd(); else { this.turn(1); this.phase = 1; this.r = 0; this.l = 0; this.loop0 = `${this.s.i},${this.s.j},${this.s.d}`; }
        this.steps++; return;
      }
      const left = DIRS[(DIRS.indexOf(d) + 3) % 4];
      if (this.open(i, j, left)) { this.turn(-1); this.fwd(); }
      else if (this.open(i, j, d)) this.fwd();
      else this.turn(1);
      this.steps++;
      if (`${this.s.i},${this.s.j},${this.s.d}` === this.loop0) { this.closed = true; this.loops++; }
    }
    tick() {
      if (this.closed) { this.runner.stop(); return false; }
      for (let k = 0; k < (this.runner.running ? this.speed : 1) && !this.closed; k++) this.step();
      this.update();
      return !this.closed;
    }
    click(p) {
      const i = Math.floor(p.x), j = this.env.H - 1 - Math.floor(p.y);
      if (this.env.isFree(i, j)) { this.start = [i, j]; this.reset(); }
      return null;
    }
    update() {
      const r3 = ((this.r % 3) + 3) % 3;
      this.stats.l.set(`${this.l}（${this.l < 0 ? "−" + (-this.l).toString(2) : this.l.toString(2)}）`);
      this.stats.r3.set(this.phase ? r3 : "–"); this.stats.r.set(this.phase ? (this.r > 0 ? "+" : "") + this.r : "–");
      const free = this.env.cells.length;
      this.stats.v.set(`${this.visited.size} / ${free}`); this.stats.s.set(this.steps);
      let msg;
      if (this.closed) {
        const cw = r3 === 1;
        msg = `<b>绕回起点</b>：r = ${this.r > 0 ? "+" : ""}${this.r}，r mod 3 = ${r3} ⇒ ${cw ? "顺时针" : "逆时针"}。` +
          `注意：r = +4（四次右转）≡ 1、r = −4 ≡ 2 (mod 3)，所以「≡ 1 ⇒ 顺时针、≡ 2 ⇒ 逆时针」——原书把这两句写反了<sup class="fn"><a href="#fn-5">5</a></sup>。` +
          (cw ? " 墙在左手边、顺时针绕的是外墙（以及由虚拟细墙连上外墙的所有障碍）。" : " 逆时针说明绕的是一个「漂浮」在中间的障碍：没有虚拟细墙时，机器人会一直绕着它转。") +
          ` 访问了 ${this.visited.size} / ${free} 个格子${this.visited.size < free ? "——单纯沿墙走并不能保证访问每个格子（图 12.16）" : ""}。`;
      } else msg = this.phase ? "沿墙走中：每次北移 l + 1、南移 l − 1；右转 r + 1、左转 r − 1（只存 mod 3）。纬度 l 需要无界计数器；转角只需要 2 比特。" : "第一阶段：一直往西走到墙。";
      this.info.innerHTML = msg;
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const E = this.env, H = E.H;
      pl.setRange([0, E.W], [0, H]);
      E.draw(pl, col, { gridLines: true });
      for (const k of this.visited) { const [i, j] = k.split(",").map(Number); E.fillCell(pl, E.idx(i, j), C.alpha(col.best, 0.22), 0.04); }
      // 细墙
      ctx.lineCap = "round";
      for (const w of this.walls) {
        const [i, j, d] = w.split(","); const x = +i, y = H - 1 - +j;
        let a, b;
        if (d === "W") { a = { x, y }; b = { x, y: y + 1 }; } else if (d === "E") { a = { x: x + 1, y }; b = { x: x + 1, y: y + 1 }; }
        else if (d === "S") { a = { x, y }; b = { x: x + 1, y }; } else { a = { x, y: y + 1 }; b = { x: x + 1, y: y + 1 }; }
        pl.line(a, b, this.cover ? C.alpha(col.text2, 0.7) : col.best, this.cover ? 1.6 : 2.6);
      }
      for (const u of this.uniq) pl.dot(u, Math.max(3.5, pl.S(0.16)), col.best, col.surface, 1.2);
      pl.path(this.trail.map(([i, j]) => ({ x: i + 0.5, y: H - j - 0.5 })), C.alpha(col.robot, 0.75), 2);
      const c = { x: this.s.i + 0.5, y: H - this.s.j - 0.5 }, v = DV[this.s.d];
      pl.dot(c, Math.max(4, pl.S(0.28)), col.robot);
      pl.arrow(c, { x: c.x + v[0] * 0.48, y: c.y + v[1] * 0.48 }, col.robot, 2.5, 7);
    }
  }

  // ---------------------------------------------------------------
  // 组件：间隙导航树 GNT（12.3.4）
  //   简单多边形里，每个间隙由一个反射顶点「挡出」，用这个顶点给间隙编号；在相邻两个位置之间比较间隙集合得到四种临界事件：
  //   出现（该顶点原来就看得见）、消失（顶点仍看得见）、分裂（顶点原来看不见）、合并（顶点现在看不见）。
  // ---------------------------------------------------------------
  // 一条大厅 + 三个「拐角房间」（入口窄、里面有一块从大厅看不见）：沿大厅走会遇到合并 / 分裂，进出房间会遇到出现 / 消失
  // 顶点稍微错开一点，满足书中的「一般位置」假设（不会有三个间隙同时合并之类的退化情形）
  const GNT_ENV = [[0, 0], [14, 0], [14, 3.1], [12, 3.04], [12.08, 7], [9, 6.92], [9.04, 5.06], [11, 5.12], [11.06, 2.94], [7, 3.02], [7.08, 7.04], [4, 6.95],
    [4.05, 5.08], [6, 4.96], [6.06, 3.14], [3, 3.07], [3.09, 6.9], [0, 7], [0, 5.05], [2, 4.9], [2.05, 2.88], [0, 3.03]].map(([x, y]) => ({ x, y }));
  const GNT_START = { x: 1, y: 1.5 };
  const GNT_ROUTE = [[13, 1.5], [11.5, 1.5], [11.5, 5.6], [9.8, 6.2], [11.5, 5.6], [11.5, 1.5], [6.5, 1.5], [6.5, 5.6], [4.8, 6.2], [6.5, 5.6], [6.5, 1.5],
    [2.5, 1.5], [2.5, 5.6], [0.8, 6.2], [2.5, 5.6], [2.5, 1.5], [1, 1.5]].map(([x, y]) => ({ x, y }));
  // 书中图 12.35 的树（转录）：c = 子结点；p = 是否原始（方块）；s = 阴影在间隙的左 / 右
  const BOOK_TREES = [
    ["T₁", [{ s: "R" }]], ["T₂", [{ s: "R" }, { s: "R" }]], ["T₃", [{ s: "R" }]], ["T₄", [{ s: "L", p: 1 }, { s: "R" }]], ["T₅", [{ s: "L", p: 1 }]],
    ["T₆", [{ s: "L", p: 1 }, { s: "L", p: 1 }]], ["T₇", [{ s: "L", c: [{ s: "L", p: 1 }, { s: "L", p: 1 }] }]], ["T′₆", [{ s: "L", p: 1 }, { s: "L", p: 1 }]],
    ["T′₅", [{ s: "L", p: 1 }]], ["T′₄", [{ s: "L", p: 1 }, { s: "R", p: 1 }]], ["T′₃", [{ s: "R", p: 1 }]], ["T′₂", [{ s: "R", p: 1 }, { s: "R", p: 1 }]],
    ["T′₁", [{ s: "R", c: [{ s: "R", p: 1 }, { s: "R", p: 1 }] }]],
  ];
  class GNT {
    constructor(root) {
      this.P = GNT_ENV; this.segs = C.polySegs([this.P]); this.mode = "live";
      const n = this.P.length;
      this.reflex = this.P.map((v, i) => C.cross(C.sub2(v, this.P[(i - 1 + n) % n]), C.sub2(this.P[(i + 1) % n], v)) < 0);
      const body = C.frame(root, "间隙导航树 GNT", "机器人只有间隙传感器：看得见哪些间隙、它们的环形次序；没有距离、没有指南针");
      this.modeSeg = C.seg([["live", "自己拖着走"], ["book", "书中例 12.6（图 12.35）"]], "live", (k) => { this.mode = k; this.layoutMode(); });
      this.runner = new C.Runner(() => this.tick(), () => this.updBtns());
      this.plot = new C.Plot({ aspect: 7.8 / 14.8, maxW: 520, minW: 260, equal: true, m: { l: 4, r: 4, t: 4, b: 4 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.down(p), onMove: (p) => this.dragTo(p), cursor: () => "grab" });
      this.treeWrap = h("div", { class: "ch12-treewrap" }); this.tcanvas = h("canvas"); this.treeWrap.append(this.tcanvas);
      this.tcanvas.addEventListener("pointerdown", (e) => this.clickTree(e));
      this.log = h("div", { class: "small ch12-log mono", style: "max-height:120px;overflow:auto" });
      this.info = h("div", { class: "small" });
      this.btnRoute = C.button("▶ 沿路线走一圈", () => this.startRoute(), "primary");
      this.btnExplore = C.button("探索：追非原始叶子", () => this.startExplore());
      this.btnObj = C.button("在这里放一个物体", () => this.placeObject());
      this.btnBack = C.button("回到物体（追挡住它的结点）", () => this.startBack());
      this.liveBox = h("div", null,
        h("div", { class: "controls" }, this.btnRoute, this.btnExplore, C.button("重置", () => this.reset())),
        h("div", { class: "controls" }, this.btnObj, this.btnBack),
        h("div", { class: "split" }, h("div", null, this.plot.wrap, h("div", { class: "small muted" }, "拖动蓝点移动机器人；点树上的结点：机器人去「追」它（图 12.36）。")),
          h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "当前的 GNT（根 = 间隙传感器）"), this.treeWrap), this.log)),
        this.info);
      this.bookCanvas = h("canvas"); this.bookWrap = h("div", { class: "ch12-treewrap" }, this.bookCanvas);
      this.bookI = 0;
      this.bookBox = h("div", null,
        h("div", { class: "controls" }, C.button("◀", () => { this.bookI = Math.max(0, this.bookI - 1); this.drawBook(); }), C.button("▶", () => { this.bookI = Math.min(BOOK_TREES.length - 1, this.bookI + 1); this.drawBook(); }, "primary"),
          h("span", { class: "small muted" }, "机器人从单元 1 走到 7，再回到 1；「R」「L」表示阴影在间隙的右 / 左（算法并不需要，只是帮助理解）。")),
        this.bookWrap, h("div", { class: "small", style: "margin-top:6px" }));
      body.append(h("div", { class: "controls" }, this.modeSeg), this.liveBox, this.bookBox,
        C.legend([[C.cv("text"), "根（实心）"], [C.cv("text2"), "圆 = 还不知道是否原始（后面可能藏着东西）"], [C.cv("best"), "方块 = 原始：出现事件产生，追它只会消失"], [C.cv("cand"), "间隙方向（传感器上的刻度）"], [C.cv("goal"), "物体", true]]));
      new ResizeObserver(() => { this.drawTree(); if (this.mode === "book") this.drawBook(); }).observe(this.treeWrap);
      PA.onThemeChange(() => { this.drawTree(); this.drawBook(); });
      this.reset(); this.layoutMode();
    }
    layoutMode() { this.liveBox.classList.toggle("hidden", this.mode !== "live"); this.bookBox.classList.toggle("hidden", this.mode !== "book"); if (this.mode === "book") this.drawBook(); else { this.drawTree(); this.plot.draw(); } }
    // ---------- 几何 ----------
    visible(x, v) { return C.segFree(x, v, this.segs) && C.inPoly({ x: (x.x + v.x) / 2 + 1e-7, y: (x.y + v.y) / 2 + 1e-7 }, this.P); }
    gaps(x) {
      const out = new Map(), n = this.P.length;
      for (let i = 0; i < n; i++) {
        if (!this.reflex[i]) continue;
        const v = this.P[i];
        if (C.dist(x, v) < 1e-6 || !this.visible(x, v)) continue;
        const d = C.sub2(v, x), a = this.P[(i - 1 + n) % n], b = this.P[(i + 1) % n];
        const sa = C.cross(d, C.sub2(a, x)), sb = C.cross(d, C.sub2(b, x));
        if (sa * sb <= 0) continue;   // 两条邻边在视线两侧：这个顶点不挡东西
        const L = Math.hypot(d.x, d.y), u = { x: d.x / L, y: d.y / L };
        const beyond = { x: v.x + u.x * 1e-4, y: v.y + u.y * 1e-4 };
        if (!C.inPoly(beyond, this.P)) continue;
        const hit = C.rayHit(beyond, u, this.segs);
        out.set(i, { v, far: hit.p, ang: Math.atan2(d.y, d.x), side: sa > 0 ? "L" : "R" });
      }
      return out;
    }
    // ---------- 树 ----------
    newNode(vid, prim) { const i = this.nameI++; return { vid, prim, children: [], name: String.fromCharCode(97 + (i % 26)) + "′".repeat(Math.floor(i / 26)) }; }
    reset() {
      this.runner.stop(); this.task = null;
      this.x = { ...GNT_START }; this.trail = [{ ...this.x }]; this.nameI = 0; this.events = []; this.obj = null; this.objNode = null; this.objVisible = false;
      this.G = this.gaps(this.x);
      this.rootKids = new Map();
      for (const [vid] of this.G) this.rootKids.set(vid, this.newNode(vid, false));
      this.updBtns(); this.update();
    }
    findPath(node, target, path = []) {
      if (node === target) return [...path, node];
      for (const c of node.children) { const r = this.findPath(c, target, [...path, node]); if (r) return r; }
      return null;
    }
    findVid(node, vid) {
      for (const c of node.children) { if (c.vid === vid) return { node: c, parent: node }; const r = this.findVid(c, vid); if (r) return r; }
      return null;
    }
    // 把机器人挪到 y，逐个处理途中的临界事件
    moveTo(y) {
      const d = C.dist(this.x, y), n = Math.max(1, Math.ceil(d / 0.012));
      const x0 = this.x;
      for (let k = 1; k <= n; k++) {
        const p = { x: x0.x + (y.x - x0.x) * k / n, y: x0.y + (y.y - x0.y) * k / n };
        if (!C.inPoly(p, this.P) || !C.segFree(this.x, p, this.segs)) break;
        this.stepTo(p);
      }
      this.trail.push({ ...this.x });
      if (this.trail.length > 1500) this.trail.splice(0, this.trail.length - 1500);
      return C.dist(this.x, x0);
    }
    stepTo(p) {
      const old = this.G, nw = this.gaps(p), prev = this.x;
      this.x = p; this.G = nw; this.orphans = new Map();
      // 先处理消失 / 合并
      for (const [vid, g] of old) {
        if (nw.has(vid)) continue;
        const node = this.rootKids.get(vid); this.rootKids.delete(vid);
        if (this.visible(p, g.v)) {
          this.ev(`消失：${node.name}`);
          // 同一小步里若还有分裂（离散化造成），先把它的后代暂存起来，等下面的分裂来认领
          const stash = (nd) => nd.children.forEach((c) => { this.orphans.set(c.vid, c); stash(c); });
          stash(node);
          if (node === this.objNode) this.objNode = null;
        }
        else {
          // 合并：被哪个还在的间隙挡住了——方向最接近的那个
          let best = null, bd = Infinity;
          for (const [u, gu] of nw) if (old.has(u)) { const da = Math.abs(Math.atan2(Math.sin(gu.ang - g.ang), Math.cos(gu.ang - g.ang))); if (da < bd) { bd = da; best = u; } }
          if (best === null) { this.ev(`消失：${node.name}`); continue; }
          const keep = this.rootKids.get(best), M = this.newNode(best, false);
          M.children = [keep, node];
          this.rootKids.set(best, M);
          this.ev(`合并：${keep.name} + ${node.name} → ${M.name}`);
        }
      }
      // 再处理出现 / 分裂
      for (const [vid, g] of nw) {
        if (old.has(vid)) continue;
        if (this.visible(prev, g.v)) { const nd = this.newNode(vid, true); this.rootKids.set(vid, nd); this.ev(`出现：${nd.name}（原始）`); continue; }
        // 分裂：在树里找这个顶点对应的结点，把它摘出来
        let found = null;
        for (const [u, R] of this.rootKids) {
          if (R.vid === vid) continue;
          const r = this.findVid(R, vid);
          if (r) { found = { r, u, R }; break; }
        }
        if (!found && this.orphans.has(vid)) {
          const nd = this.orphans.get(vid); nd.children = nd.children.filter((c) => !this.orphans.has(c.vid) || c.vid === vid);
          this.rootKids.set(vid, nd); this.ev(`分裂：${nd.name}`); continue;
        }
        if (found) {
          const { r, u, R } = found;
          r.parent.children = r.parent.children.filter((c) => c !== r.node);
          this.rootKids.set(vid, r.node);
          // 只剩一个孩子的中间结点要去掉（图 12.32）
          const collapse = (par, node) => {
            if (node.children.length === 1 && !node.prim) return node.children[0];
            node.children = node.children.map((c) => collapse(node, c));
            return node;
          };
          const R2 = collapse(null, R);
          this.rootKids.set(u, R2);
          this.ev(`分裂：${r.node.name} 从 ${R.name} 里分出来`);
        } else {
          const nd = this.newNode(vid, false); this.rootKids.set(vid, nd);
          this.ev(`分裂：新间隙 ${nd.name}`);
        }
      }
      // 物体：看得见 ↔ 看不见
      if (this.obj) {
        const vis = this.visible(p, this.obj);
        if (this.objVisible && !vis) {
          let best = null, bd = Infinity;
          const a = Math.atan2(this.obj.y - p.y, this.obj.x - p.x);
          for (const [u, gu] of nw) { const da = Math.abs(Math.atan2(Math.sin(gu.ang - a), Math.cos(gu.ang - a))); if (da < bd) { bd = da; best = u; } }
          if (best !== null) { this.objNode = this.rootKids.get(best); this.ev(`物体被 ${this.objNode.name} 挡住`); }
        }
        if (!this.objVisible && vis) this.ev("物体又看得见了");
        this.objVisible = vis;
      }
    }
    ev(s) { this.events.push(s); if (this.events.length > 60) this.events.shift(); }
    // ---------- 交互 ----------
    down(p) { if (C.dist(p, this.x) < 0.6) { this.runner.stop(); this.task = null; return { drag: true }; } return null; }
    dragTo(p) { if (!C.inPoly(p, this.P)) return; this.moveTo(p); this.update(); }
    startRoute() { this.reset(); this.task = { kind: "route", i: 0 }; this.runner.start(); this.updBtns(); }
    startExplore() { this.task = { kind: "explore", n: 0 }; this.runner.start(); this.updBtns(); }
    startBack() { if (!this.objNode) return; this.task = { kind: "chase", target: this.objNode, n: 0, back: true }; this.runner.start(); this.updBtns(); }
    placeObject() { this.obj = { ...this.x }; this.objVisible = true; this.objNode = null; this.ev("放下物体"); this.update(); }
    updBtns() { this.btnBack.disabled = !this.objNode; }
    // 追某个结点：找出包含它的根孩子，朝那个间隙走（图 12.27）。目标点取间隙线段上靠近反射顶点的一点——
    // 间隙线段在可见区域的边界上，所以直线过去不会撞墙；到了那里阴影就开始暴露，再重新看
    chaseStep(target) {
      let root = null;
      for (const [u, R] of this.rootKids) if (this.findPath(R, target)) { root = u; break; }
      if (root === null) return false;   // 已经消失
      const g = this.G.get(root), L = C.dist(g.v, g.far) || 1, t = Math.min(0.5, 1.2 / L);
      // 机器人、顶点、间隙线段共线：目标点往可见的一侧（阴影的另一侧）偏一点，才能从顶点旁边绕过去
      const u = { x: (g.far.x - g.v.x) / L, y: (g.far.y - g.v.y) / L }, n = g.side === "L" ? { x: u.y, y: -u.x } : { x: -u.y, y: u.x };
      for (const off of [0.25, 0.5, 0.1]) {
        const goal = { x: g.v.x + (g.far.x - g.v.x) * t + n.x * off, y: g.v.y + (g.far.y - g.v.y) * t + n.y * off };
        if (!C.inPoly(goal, this.P)) continue;
        const dd = C.dist(this.x, goal) || 1, step = Math.min(0.1, dd);
        if (this.moveTo({ x: this.x.x + (goal.x - this.x.x) * step / dd, y: this.x.y + (goal.y - this.x.y) * step / dd }) > 1e-5) return true;
      }
      return false;
    }
    tick() {
      const t = this.task;
      if (!t) return false;
      if (t.kind === "route") {
        const wp = GNT_ROUTE[t.i];
        if (!wp) { this.task = null; this.update(); return false; }
        const d = C.dist(this.x, wp);
        if (d < 0.05) t.i++;
        else { const s = Math.min(0.09, d); if (this.moveTo({ x: this.x.x + (wp.x - this.x.x) * s / d, y: this.x.y + (wp.y - this.x.y) * s / d }) < 1e-5) t.i++; }
      } else if (t.kind === "chase") {
        if (++t.n > 2000 || !this.chaseStep(t.target)) { this.task = null; this.update(); return false; }
      } else if (t.kind === "explore") {
        // 选一个非原始的叶子去追
        if (!t.target || !this.alive(t.target)) {
          t.target = null;
          const leaves = []; const rec = (nd) => { if (!nd.children.length) { if (!nd.prim) leaves.push(nd); } else nd.children.forEach(rec); };
          for (const R of this.rootKids.values()) rec(R);
          if (!leaves.length) { this.task = null; this.ev("所有叶子都是原始的：环境已完全学到"); this.update(); return false; }
          t.target = leaves[0];
        }
        if (++t.n > 4000) { this.task = null; this.update(); return false; }
        if (!this.chaseStep(t.target)) { if (this.alive(t.target)) t.stuck = (t.stuck || 0) + 1; if (t.stuck > 20) { this.task = null; this.ev("卡住了"); this.update(); return false; } }
      }
      this.update();
      return true;
    }
    alive(node) { for (const R of this.rootKids.values()) if (this.findPath(R, node)) return true; return false; }
    clickTree(e) {
      const r = this.tcanvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bd = 16;
      (function rec(n) { const d = Math.hypot(n.px - px, n.py - py); if (n.vid !== undefined && d < bd) { bd = d; best = n; } (n.children || []).forEach(rec); })(this.treeRoot || { children: [] });
      if (best) { this.task = { kind: "chase", target: best, n: 0 }; this.runner.start(); }
    }
    // ---------- 显示 ----------
    update() {
      const leaves = []; const rec = (nd) => { if (!nd.children.length) leaves.push(nd); else nd.children.forEach(rec); };
      for (const R of this.rootKids.values()) rec(R);
      const allPrim = leaves.every((l) => l.prim);
      this.info.innerHTML = `当前看得见 ${this.G.size} 个间隙；树有 ${leaves.length} 片叶子，其中 ${leaves.filter((l) => !l.prim).length} 片还是圆（后面可能还有没看过的地方）。` +
        (allPrim ? " <b>所有叶子都是方块</b>：在间隙传感器的分辨率下，环境已经完全学到了。" : "") +
        (this.objNode ? ` 物体藏在结点 ${this.objNode.name} 后面：追它，就沿最短路回到物体（[186]：追 GNT 的结点恰好沿 6.2.4 节的最短路路线图走）。` : "");
      this.log.innerHTML = this.events.slice(-8).map((s) => `<div>${s}</div>`).join("");
      this.log.scrollTop = this.log.scrollHeight;
      this.updBtns();
      this.plot.draw(); this.drawTree();
    }
    draw(ctx, pl, col) {
      if (!this.G) return;
      pl.setRange([-0.4, 14.4], [-0.4, 7.4]);
      pl.rect(-0.4, -0.4, 14.4, 7.4, col.obst);
      pl.poly(this.P, col.surface);
      pl.poly(C.visPoly(this.x, this.segs, this.P), C.alpha(col.vis, 0.35));
      for (const [, g] of this.G) pl.line(g.v, g.far, col.cand, 2, [5, 4]);
      pl.poly(this.P, null, col.text2, 1.4);
      pl.path(this.trail, C.alpha(col.robot, 0.5), 1.6);
      if (this.obj) pl.dot(this.obj, 6, col.goal, col.surface, 1.5);
      // 间隙传感器：小圆上的刻度
      const R = 0.55;
      pl.dot(this.x, pl.S(R), null, C.alpha(col.text2, 0.6), 1.2);
      for (const [vid, g] of this.G) {
        const a = { x: this.x.x + Math.cos(g.ang) * R, y: this.x.y + Math.sin(g.ang) * R }, b = { x: this.x.x + Math.cos(g.ang) * (R + 0.25), y: this.x.y + Math.sin(g.ang) * (R + 0.25) };
        pl.line(a, b, col.cand, 3);
        const nd = this.rootKids.get(vid);
        if (nd) pl.text(nd.name, { x: this.x.x + Math.cos(g.ang) * (R + 0.55), y: this.x.y + Math.sin(g.ang) * (R + 0.55) }, col.text, { size: 12, weight: 650 });
      }
      pl.dot(this.x, 6, col.robot, col.surface, 1.5);
    }
    drawTree() {
      if (!this.rootKids) return;
      const col = C.colors(this.treeWrap);
      const kids = [...this.rootKids.entries()].sort((a, b) => this.G.get(a[0]).ang - this.G.get(b[0]).ang).map((e) => e[1]);
      const root = { children: kids, shape: "disc" };
      this.treeRoot = root;
      const lay = C.layoutTree(root, { dx: 1, dy: 1 });
      const avail = Math.max(220, this.treeWrap.clientWidth || 300), dx = Math.max(26, Math.min(48, (avail - 30) / Math.max(1, lay.leaves))), dy = 46;
      const W = Math.max(avail, lay.leaves * dx + 30), H = Math.max(120, (lay.depth + 1) * dy + 20);
      C.layoutTree(root, { dx, dy, x0: (W - (lay.leaves - 1) * dx) / 2, y0: 18 });
      const ctx = PA.fitCanvas(this.tcanvas, W, H); ctx.clearRect(0, 0, W, H);
      const dec = (n) => {
        for (const c of n.children) {
          c.shape = c.prim ? "square" : "circle"; c.label = c.name; c.r = 10;
          c.color = c === this.objNode ? col.goal : c.prim ? col.best : col.text2;
          c.fill = c.prim ? C.alpha(col.best, 0.2) : col.surface;
          c.hl = this.task && this.task.target === c;
          dec(c);
        }
      };
      dec(root);
      root.color = col.text;
      C.drawTree(ctx, root, col, { font: "600 11px " + getComputedStyle(document.body).fontFamily });
    }
    drawBook() {
      const col = C.colors(this.bookWrap);
      const avail = Math.max(300, this.bookWrap.clientWidth || 600);
      const per = 5, cw = avail / per, rows = Math.ceil(BOOK_TREES.length / per), rh = 128;
      const ctx = PA.fitCanvas(this.bookCanvas, avail, rows * rh); ctx.clearRect(0, 0, avail, rows * rh);
      BOOK_TREES.forEach(([name, kids], i) => {
        const mk = (k) => ({ shape: k.p ? "square" : "circle", label: k.s, children: (k.c || []).map(mk) });
        const root = { shape: "disc", children: kids.map(mk) };
        const lay = C.layoutTree(root, { dx: 1, dy: 1 });
        const ox = (i % per) * cw + cw / 2, oy = Math.floor(i / per) * rh + 16;
        C.layoutTree(root, { dx: 30, dy: 34, x0: ox - (lay.leaves - 1) * 15, y0: oy });
        const on = i === this.bookI;
        const dec = (n) => { n.r = 9; n.color = n.shape === "disc" ? col.text : on ? (n.shape === "square" ? col.best : col.text2) : C.alpha(col.text2, 0.45); n.fill = n.shape === "square" ? C.alpha(col.best, on ? 0.25 : 0.1) : col.surface; n.textColor = on ? col.text : col.muted; n.edgeColor = on ? col.strong : C.alpha(col.strong, 0.5); n.children.forEach(dec); };
        dec(root);
        if (on) { ctx.fillStyle = C.alpha(col.accent, 0.1); ctx.fillRect((i % per) * cw + 3, Math.floor(i / per) * rh + 2, cw - 6, rh - 6); }
        C.drawTree(ctx, root, col, { font: "10px " + getComputedStyle(document.body).fontFamily });
        ctx.font = "600 12px " + getComputedStyle(document.body).fontFamily; ctx.fillStyle = on ? col.text : col.muted; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(name, ox, Math.floor(i / per) * rh + rh - 14);
      });
      const cell = [1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1][this.bookI];
      const note = ["开始：只有一个间隙，后面是什么不知道（圆）。", "看见了两个间隙。", "又只剩一个。", "出现事件：左边新出现一个间隙（方块，原始）。", "到了单元 5：此时所有叶子都是方块——整个环境都看过了。",
        "出现事件：又出现一个原始间隙。", "两个间隙合并：插入一个中间结点（圆，图 12.31）。", "分裂：中间结点去掉，两个孩子重新挂到根上（图 12.32）。", "往回走：一个间隙消失。",
        "出现事件：右边的间隙重新出现——这次是方块（原始），因为它是「出现」而来的。", "左边的间隙消失。", "又出现一个原始间隙。",
        "回到单元 1：两个方块合并成中间结点。树比 T₁ 大，因为它知道「右边那块其实由两个更小的区域组成」；所有叶子都是方块。"][this.bookI];
      this.bookBox.lastChild.innerHTML = `<b>${BOOK_TREES[this.bookI][0]}</b>：机器人在单元 ${cell}。${note}`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='env-id']").forEach((el) => (el._w = new EnvId(el)));
    document.querySelectorAll("[data-widget='maze']").forEach((el) => (el._w = new Maze(el)));
    document.querySelectorAll("[data-widget='gnt']").forEach((el) => (el._w = new GNT(el)));
  });
})();
