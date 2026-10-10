/* 7.2 节：多个机器人——装配规划（图 7.7）、优先级规划丢失完备性（图 7.8）、
   固定路径协调（式 7.11、7.12，图 7.9、7.43）、固定路线图协调与立方复形（图 7.10） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH7;
  const SUP = ["¹", "²", "³", "⁴", "⁵", "⁶", "⁷"];

  // =================================================================
  // 组件 1：装配规划——逐块拆卸，反过来就是装配顺序（图 7.7）
  // =================================================================
  // 每行一个字符串，从上（y = H-1）到下（y = 0）；数字是零件编号，"." 是空格
  const ASM_PRESETS = {
    seven: { name: "七块拼成一个长方形（图 7.7 风格）", rows: [
      "1144444477",
      "1333555577",
      "1323566557",
      "1223366577",
      "2222222577"] },
    corner: { name: "零件得先右移再上移", rows: [
      "2222.22",
      "2222.22",
      "2222.22",
      "21....2",
      "2222222"] },
    lock: { name: "互锁的一对（怎么都拆不开）", rows: [
      "...2...",
      "1112111",
      "1222221",
      "1111111"] },
  };
  const DIRS = [[0, 1, "↑"], [1, 0, "→"], [0, -1, "↓"], [-1, 0, "←"]];
  function parseAsm(rows) {
    const H = rows.length, W = rows[0].length, pieces = new Map();
    rows.forEach((row, r) => [...row].forEach((ch, x) => { if (ch !== ".") { const y = H - 1 - r; if (!pieces.has(ch)) pieces.set(ch, []); pieces.get(ch).push([x, y]); } }));
    const ids = [...pieces.keys()].sort();
    return { W, H, pieces: ids.map((id) => ({ id, cells: pieces.get(id) })) };
  }
  // 拆卸规划：每次找一块能移出包围盒的零件拿走。mode = "line" 只允许一条直线平移到无穷远；
  // mode = "multi" 允许多段平移（对这一块做网格 BFS）。拿走零件只会让别的零件更容易拿走，所以贪心是完备的。
  function disassemble(A, mode) {
    const occ = new Map();
    A.pieces.forEach((p, k) => p.cells.forEach(([x, y]) => occ.set(x + "," + y, k)));
    const left = new Set(A.pieces.map((_, k) => k)), steps = [];
    const free = (k, x, y) => { const o = occ.get(x + "," + y); return o === undefined || o === k || !left.has(o); };
    const outside = (cells, dx, dy) => cells.every(([x, y]) => x + dx < 0 || x + dx >= A.W || y + dy < 0 || y + dy >= A.H);
    function lineOut(k) {
      const P = A.pieces[k].cells;
      for (const [dx, dy, name] of DIRS) {
        let ok = true;
        for (const [x, y] of P) { for (let s = 1; s <= A.W + A.H && ok; s++) if (!free(k, x + s * dx, y + s * dy)) ok = false; if (!ok) break; }
        if (ok) { const n = dx ? A.W : A.H; return { moves: Array(n).fill([dx, dy]), label: name }; }
      }
      return null;
    }
    function bfsOut(k) {
      const P = A.pieces[k].cells, M = A.W + A.H, key = (dx, dy) => dx + "," + dy;
      const prev = new Map([[key(0, 0), null]]), Q = [[0, 0]];
      while (Q.length) {
        const [dx, dy] = Q.shift();
        if (outside(P, dx, dy)) {
          const moves = []; let c = key(dx, dy);
          while (prev.get(c)) { const [px, py, mx, my] = prev.get(c); moves.push([mx, my]); c = key(px, py); }
          moves.reverse();
          // 把连续同方向的单位移动压缩成「段」，用于显示
          const segs = []; for (const m of moves) { const d = DIRS.find(([a, b]) => a === m[0] && b === m[1])[2]; if (segs.length && segs[segs.length - 1][0] === d) segs[segs.length - 1][1]++; else segs.push([d, 1]); }
          return { moves, label: segs.map(([d, n]) => d + (n > 1 && segs.length > 1 ? n : "")).join("") };
        }
        for (const [mx, my] of DIRS) {
          const nx = dx + mx, ny = dy + my, kk = key(nx, ny);
          if (prev.has(kk) || Math.abs(nx) > M || Math.abs(ny) > M) continue;
          if (P.every(([x, y]) => free(k, x + nx, y + ny))) { prev.set(kk, [dx, dy, mx, my]); Q.push([nx, ny]); }
        }
      }
      return null;
    }
    while (left.size) {
      let done = false;
      for (const k of [...left].sort((a, b) => a - b)) {
        const r = mode === "line" ? lineOut(k) : bfsOut(k);
        if (r) { steps.push({ k, ...r }); left.delete(k); done = true; break; }
      }
      if (!done) return { ok: false, steps, stuck: [...left] };
    }
    return { ok: true, steps };
  }

  class Assembly {
    constructor(root) {
      this.preset = "seven"; this.mode = "line"; this.reverse = false; this.u = 0;
      const body = C.frame(root, "装配规划：先算拆卸顺序，再反过来", "每块零件看成一个机器人；从装好的状态出发，一块一块往外移");
      this.st = new C.Stage({ view: [-4, 14, -3.5, 8.5], maxW: 560, aspect: 0.62, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.selP = C.select(Object.entries(ASM_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.update(); });
      this.segM = C.seg([["line", "每块只能沿一条直线移走"], ["multi", "每块可以走多段直线"]], this.mode, (k) => { this.mode = k; this.update(); });
      this.segR = C.seg([["dis", "播放拆卸"], ["asm", "播放装配（倒放）"]], "dis", (k) => { this.reverse = k === "asm"; this.tl.set(0); });
      this.tl = new C.Timeline((u) => { this.u = u; this.render(); }, { label: "进度", dur: 7, fmt: (u) => Math.round(u * 100) + "%" });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP, this.segM, this.segR), this.st.wrap, this.tl.el, this.out);
      this.update();
    }
    update() {
      this.A = parseAsm(ASM_PRESETS[this.preset].rows);
      this.res = disassemble(this.A, this.mode);
      const W = this.A.W, H = this.A.H, m = Math.max(W, H) * 0.45 + 2;
      this.st.setView([-m, W + m, -m * 0.8, H + m * 0.8]);
      this.tl.set(0);
    }
    // 第 i 块零件在当前时刻的偏移量（null 表示已经拿走）
    offsets() {
      const S = this.res.steps, n = S.length, u = this.reverse ? 1 - this.u : this.u;
      const pos = u * n, cur = Math.min(n - 1, Math.floor(pos)), f = pos - cur;
      const off = this.A.pieces.map(() => [0, 0]), gone = this.A.pieces.map(() => false);
      S.forEach((s, i) => {
        if (i < cur || (i === cur && u >= 1)) { gone[s.k] = true; return; }
        if (i === cur) {
          const L = s.moves.length, q = f * L, j = Math.floor(q); let x = 0, y = 0;
          for (let t = 0; t < j && t < L; t++) { x += s.moves[t][0]; y += s.moves[t][1]; }
          if (j < L) { x += s.moves[j][0] * (q - j); y += s.moves[j][1] * (q - j); }
          off[s.k] = [x, y];
        }
      });
      return { off, gone, cur, n };
    }
    render() {
      const S = this.res.steps, name = (k) => "A" + SUP[k];
      const dis = S.map((s) => `${name(s.k)}${s.label}`).join("，");
      const asm = S.slice().reverse().map((s) => name(s.k)).join(" → ");
      if (this.res.ok) this.out.innerHTML = `拆卸：${dis}。<br><b>装配顺序</b>（倒过来）：${asm}。`;
      else this.out.innerHTML = (S.length ? `先拆下 ${S.map((s) => name(s.k)).join("、")}；` : "") +
        `剩下的 ${this.res.stuck.map(name).join("、")} 一块也拿不出来。` +
        (this.mode === "line" ? "试试「多段直线」。" : "在只允许一块一块平移的前提下，这个物体<b>无法装配</b>——规划器正确地报告了无解。");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col);
      const A = this.A;
      st.box({ x0: 0, y0: 0, x1: A.W, y1: A.H }, col.surface2, C.alpha(col.muted, 0.6), 1);
      const pal = [col.accent, col.goal, col.alive, col.ok, col.alive2, col.warn, col.mud, col.bad];
      const { off, gone } = this.res.steps.length ? this.offsets() : { off: A.pieces.map(() => [0, 0]), gone: [] };
      A.pieces.forEach((p, k) => {
        if (gone[k]) return;
        const [ox, oy] = off[k], set = new Set(p.cells.map(([x, y]) => x + "," + y)), c = pal[k % pal.length];
        for (const [x, y] of p.cells) st.box({ x0: x + ox, y0: y + oy, x1: x + ox + 1, y1: y + oy + 1 }, C.alpha(c, 0.8), null);
        for (const [x, y] of p.cells) {
          const X = x + ox, Y = y + oy;
          if (!set.has(x + "," + (y + 1))) st.line({ x: X, y: Y + 1 }, { x: X + 1, y: Y + 1 }, col.text, 1.4);
          if (!set.has(x + "," + (y - 1))) st.line({ x: X, y: Y }, { x: X + 1, y: Y }, col.text, 1.4);
          if (!set.has((x - 1) + "," + y)) st.line({ x: X, y: Y }, { x: X, y: Y + 1 }, col.text, 1.4);
          if (!set.has((x + 1) + "," + y)) st.line({ x: X + 1, y: Y }, { x: X + 1, y: Y + 1 }, col.text, 1.4);
        }
        const [cx, cy] = p.cells.reduce((s, [x, y]) => [s[0] + x, s[1] + y], [0, 0]).map((v) => v / p.cells.length);
        const best = p.cells.reduce((b, c2) => (Math.hypot(c2[0] - cx, c2[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? c2 : b));
        st.text("A" + SUP[k], { x: best[0] + ox + 0.5, y: best[1] + oy + 0.5 }, col.text, { size: 13, weight: 700 });
      });
    }
  }

  // =================================================================
  // 组件 2：优先级规划（7.2.2 节，图 7.8）——高优先级的机器人不理会低优先级者，完备性就丢了
  // =================================================================
  // 走廊 (0..9, 0) 加一个凹口 (4, 1)
  const CORR = (() => {
    const cells = []; for (let x = 0; x < 10; x++) cells.push([x, 0]); cells.push([4, 1]);
    const id = new Map(cells.map(([x, y], i) => [x + "," + y, i]));
    const nb = cells.map(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => id.get((x + a) + "," + (y + b))).filter((v) => v !== undefined));
    return { cells, id, nb, cell: (x, y) => id.get(x + "," + y) };
  })();
  const PR = { s1: CORR.cell(6, 0), g1: CORR.cell(3, 0), s2: CORR.cell(0, 0), g2: CORR.cell(9, 0) };
  function soloPath(s, g) { const r = C.bfs(s, (u) => u === g, (u) => CORR.nb[u].map((v) => [v])); return r.path; }
  // 低优先级机器人：在（位置, 时刻）空间里 BFS，把高优先级机器人的轨迹 hi 当作移动障碍
  function lowPriority(s, g, hi, Tmax) {
    Tmax = Tmax || 40;
    const at = (t) => hi[Math.min(t, hi.length - 1)], n = CORR.cells.length;
    const enc = (c, t) => t * n + c;
    const safeForever = (c, t) => { for (let k = t; k < hi.length; k++) if (at(k) === c) return false; return at(hi.length - 1) !== c; };
    const r = C.bfs(enc(s, 0), (u) => { const c = u % n, t = Math.floor(u / n); return c === g && safeForever(c, t); }, (u) => {
      const c = u % n, t = Math.floor(u / n); if (t >= Tmax) return [];
      return [c, ...CORR.nb[c]].filter((v) => v !== at(t + 1) && !(v === at(t) && at(t + 1) === c)).map((v) => [enc(v, t + 1)]);
    });
    return { found: r.found, expanded: r.expanded, path: r.path.map((u) => u % n) };
  }
  // 集中式：在 X = C¹ × C² 上 BFS（每一步两个机器人各自停留或移动一格，不能重叠、不能对穿）
  function centralized(s1, g1, s2, g2) {
    const n = CORR.cells.length, enc = (a, b) => a * n + b;
    const r = C.bfs(enc(s1, s2), (u) => u === enc(g1, g2), (u) => {
      const a = Math.floor(u / n), b = u % n, out = [];
      for (const a2 of [a, ...CORR.nb[a]]) for (const b2 of [b, ...CORR.nb[b]]) if (a2 !== b2 && !(a2 === b && b2 === a)) out.push([enc(a2, b2)]);
      return out;
    });
    return { found: r.found, expanded: r.expanded, p1: r.path.map((u) => Math.floor(u / n)), p2: r.path.map((u) => u % n) };
  }
  function prioritizedPlan(mode) {
    if (mode === "central") { const r = centralized(PR.s1, PR.g1, PR.s2, PR.g2); return { mode, found: r.found, p1: r.p1, p2: r.p2, expanded: r.expanded }; }
    if (mode === "a1") { const p1 = soloPath(PR.s1, PR.g1), r = lowPriority(PR.s2, PR.g2, p1); return { mode, found: r.found, p1, p2: r.found ? r.path : [PR.s2], expanded: r.expanded }; }
    const p2 = soloPath(PR.s2, PR.g2), r = lowPriority(PR.s1, PR.g1, p2); return { mode, found: r.found, p1: r.found ? r.path : [PR.s1], p2, expanded: r.expanded };
  }

  class Prioritized {
    constructor(root) {
      this.mode = "a1"; this.u = 0;
      const body = C.frame(root, "优先级规划与完备性", "图 7.8：走廊只容一个机器人通过，中间有一个凹口。A¹ 要往左到虚线框，A² 要往右到虚线框");
      this.st = new C.Stage({ view: [-0.3, 10.3, -0.3, 2.6], maxW: 620, aspect: 0.29, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.segM = C.seg([["a1", "A¹ 优先（A¹ 先规划）"], ["a2", "A² 优先"], ["central", "集中式：在 X = C¹ × C² 中搜索"]], this.mode, (k) => { this.mode = k; this.update(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.st.draw(); }, { label: "时间", dur: 6, fmt: (u) => (u * this.T).toFixed(1) });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.segM), this.st.wrap, this.tl.el, this.out);
      this.update();
    }
    update() {
      this.r = prioritizedPlan(this.mode);
      this.T = Math.max(this.r.p1.length, this.r.p2.length, 2) - 1 + 1;
      const r = this.r;
      this.out.innerHTML = this.mode === "a1" ?
        (r.found ? "找到了解。" : `A¹ 只顾自己：沿走廊直接左移 3 格到终点，然后永远停在那里。A² 把它当作移动障碍，在（位置, 时刻）空间里搜索了 ${r.expanded} 个状态，<span class="no">找不到解</span>——A¹ 停下之后，走廊被永远堵死。可是这个问题是有解的（看另外两种）。`) :
        this.mode === "a2" ? (r.found ? `A² 只顾自己直奔终点；A¹ 把它当作移动障碍，<span class="yes">找到了解</span>：先躲进凹口，等 A² 过去再出来（搜索了 ${r.expanded} 个状态）。<b>优先级的顺序决定成败</b>，而事先并不知道该怎么排。` : "无解。") :
          (r.found ? `在 C¹ × C² 上 BFS（共 ${CORR.cells.length}² = ${CORR.cells.length ** 2} 个状态，展开了 ${r.expanded} 个）：<span class="yes">找到最短的联合计划</span>，共 ${r.p1.length - 1} 步。集中式搜索是完备的，代价是状态空间的维数随机器人个数线性增长。` : "无解。");
      this.tl.set(0);
    }
    pos(P, t) {
      const i = Math.min(P.length - 1, Math.floor(t)), j = Math.min(P.length - 1, i + 1), f = t - Math.floor(t);
      const a = CORR.cells[P[i]], b = CORR.cells[P[j]];
      return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
    }
    draw(ctx, st, col) {
      st.frame(col);
      // 墙与走廊
      st.box({ x0: -0.3, y0: -0.3, x1: 10.3, y1: 2.6 }, C.alpha(col.wall, 0.85), null);
      for (const [x, y] of CORR.cells) st.box({ x0: x, y0: y, x1: x + 1, y1: y + 1 }, col.surface, C.alpha(col.muted, 0.25), 1);
      const g = (c, k) => { const [x, y] = CORR.cells[c]; st.box({ x0: x + 0.08, y0: y + 0.08, x1: x + 0.92, y1: y + 0.92 }, null, col.robot[k], 2); ctx.setLineDash([]); };
      ctx.setLineDash([5, 4]); g(PR.g1, 0); ctx.setLineDash([5, 4]); g(PR.g2, 1); ctx.setLineDash([]);
      const t = this.u * this.T;
      const draw = (P, k) => {
        const p = this.pos(P, t);
        st.box({ x0: p.x + 0.12, y0: p.y + 0.12, x1: p.x + 0.88, y1: p.y + 0.88 }, C.alpha(col.robot[k], 0.85), col.robot[k], 1.5);
        st.text("A" + SUP[k], { x: p.x + 0.5, y: p.y + 0.5 }, "#fff", { weight: 700, size: 13 });
      };
      draw(this.r.p1, 0); draw(this.r.p2, 1);
      st.text(`t = ${t.toFixed(1)}`, { x: -0.2, y: 2.45 }, "#fff", { align: "left", base: "top", size: 12 });
    }
  }

  // =================================================================
  // 组件 3：两个机器人的固定路径协调（式 7.11、7.12；图 7.43 = 习题 4）
  // =================================================================
  const CO_PRESETS = {
    cross: { name: "十字路口", r: 0.06, paths: [[{ x: 0.08, y: 0.5 }, { x: 0.92, y: 0.5 }], [{ x: 0.5, y: 0.08 }, { x: 0.5, y: 0.92 }]] },
    fig743: { name: "图 7.43（习题 4）", r: 0.032, paths: [
      [{ x: 0.12, y: 0.8 }, { x: 0.88, y: 0.8 }, { x: 0.88, y: 0.64 }, { x: 0.15, y: 0.64 }, { x: 0.15, y: 0.48 }, { x: 0.88, y: 0.48 }, { x: 0.88, y: 0.32 }, { x: 0.12, y: 0.32 }],
      [{ x: 0.47, y: 0.94 }, { x: 0.47, y: 0.14 }, { x: 0.57, y: 0.14 }, { x: 0.57, y: 0.94 }]] },
    swap: { name: "迎面相遇（交换位置）", r: 0.06, paths: [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], [{ x: 0.9, y: 0.52 }, { x: 0.1, y: 0.52 }]] },
    detour: { name: "迎面相遇，但有一个让路的小弯", r: 0.06, paths: [[{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], [{ x: 0.9, y: 0.56 }, { x: 0.77, y: 0.56 }, { x: 0.72, y: 0.86 }, { x: 0.67, y: 0.56 }, { x: 0.1, y: 0.56 }]] },
  };
  // 在 N×N 网格上算 X_obs^{12}（式 7.11）：两个圆盘机器人的中心距离小于 2r
  function coordGrid(P1, P2, r, N) {
    const A = Array.from({ length: N + 1 }, (_, i) => C.polyAt(P1, i / N)), B = Array.from({ length: N + 1 }, (_, j) => C.polyAt(P2, j / N));
    const obs = new Uint8Array((N + 1) * (N + 1));
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) obs[j * (N + 1) + i] = C.dist(A[i], B[j]) < 2 * r ? 1 : 0;
    return obs;
  }
  // 8 邻接网格上的 A*，从 (0,0) 到 (N,N)；不要求单调（可以往回走）
  function gridAstar(obs, N) {
    const M = N + 1, s = 0, g = N * M + N;
    if (obs[s] || obs[g]) return null;
    const G = new Float64Array(M * M).fill(Infinity), par = new Int32Array(M * M).fill(-1), closed = new Uint8Array(M * M), H = new C.Heap();
    G[s] = 0; H.push(s, 0);
    const hh = (u) => Math.hypot(N - (u % M), N - Math.floor(u / M));
    while (H.size) {
      const u = H.pop(); if (closed[u]) continue; closed[u] = 1;
      if (u === g) break;
      const i = u % M, j = Math.floor(u / M);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a > N || b > N) continue;
        const v = b * M + a; if (obs[v] || closed[v]) continue;
        const nd = G[u] + Math.hypot(di, dj);
        if (nd < G[v]) { G[v] = nd; par[v] = u; H.push(v, nd + hh(v)); }
      }
    }
    if (!closed[g]) return null;
    const P = []; for (let c = g; c >= 0; c = par[c]) P.push([(c % M) / N, Math.floor(c / M) / N]);
    P.reverse();
    // 网格路径锯齿很多：沿直线可见性拉直（直线上按半格采样，查最近的网格点）
    const free = ([x, y]) => !obs[Math.round(y * N) * M + Math.round(x * N)];
    return C.shortcut(P, free, 0.5 / N).map(([x, y]) => ({ x, y }));
  }

  class Coord2 {
    constructor(root) {
      this.preset = "cross"; this.N = 120; this.u = 0;
      const body = C.frame(root, "固定路径协调：协调空间 X = [0,1]²", "左：两个圆盘机器人沿各自的路径 τ₁、τ₂（拖动路径的顶点）；右：X 中的障碍 X_obs 与协调路径 h");
      const near = (p) => { for (let k = 0; k < 2; k++) for (let i = 0; i < this.paths[k].length; i++) if (C.dist(p, this.paths[k][i]) < 0.035) return { k, i }; return null; };
      this.stW = new C.Stage({ view: [0, 1, 0, 1], maxW: 330, onDraw: (ctx, st, col) => this.drawW(ctx, st, col), onDown: near,
        onMove: (p, d) => { this.paths[d.k][d.i] = { x: C.clamp(p.x, 0.02, 0.98), y: C.clamp(p.y, 0.02, 0.98) }; this.planSoon(); }, cursor: (p) => (near(p) ? "grab" : null) });
      this.stX = new C.Stage({ view: [0, 1, 0, 1], maxW: 330, onDraw: (ctx, st, col) => this.drawX(ctx, st, col) });
      this.selP = C.select(Object.entries(CO_PRESETS).map(([k, v]) => [k, v.name]), this.preset, (k) => { this.preset = k; this.load(); });
      this.tl = new C.Timeline((u) => { this.u = u; this.stW.draw(); this.stX.draw(); }, { label: "沿 h 前进", dur: 6, fmt: (u) => Math.round(u * 100) + "%" });
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, this.selP),
        h("div", { class: "split" }, this.stW.wrap, this.stX.wrap), this.tl.el, this.out,
        C.legend([[C.cv("start"), "A¹ 与 τ₁"], [C.cv("goal"), "A² 与 τ₂"], [C.cva("wall", 0.8), "X_obs = X¹²_obs"], [C.cv("path"), "h（不必单调）"], [C.cva("bad", 0.8), "直接走对角线会撞上"]]));
      this.load();
    }
    load() { const P = CO_PRESETS[this.preset]; this.paths = P.paths.map((Q) => Q.map((p) => ({ ...p }))); this.r = P.r; this.plan(); }
    planSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.plan(); }); }
    plan() {
      this.obs = coordGrid(this.paths[0], this.paths[1], this.r, this.N);
      this.h = gridAstar(this.obs, this.N);
      const N = this.N, M = N + 1;
      let diagHit = false; for (let i = 0; i <= N; i++) if (this.obs[i * M + i]) diagHit = true;
      const L = this.h ? C.polyLen(this.h) : 0;
      let mono = true; if (this.h) for (let i = 1; i < this.h.length; i++) if (this.h[i].x < this.h[i - 1].x - 1e-9 || this.h[i].y < this.h[i - 1].y - 1e-9) mono = false;
      this.out.innerHTML = this.obs[0] || this.obs[N * M + N] ? "起点或终点处两个机器人已经相撞，拖开路径的端点。" :
        !this.h ? '<span class="no">协调空间里没有从 (0,0) 到 (1,1) 的路径</span>：X_obs 把 X 切断了。沿<b>固定</b>路径无论怎么安排时间都不行——这正是要引入「固定路线图协调」的原因。' :
          `${diagHit ? "对角线（两个机器人同时全速走）会撞上；" : "对角线本身就无碰撞；"}A* 找到的 h 长 ${L.toFixed(3)}${mono ? "" : "，而且<b>不单调</b>：有一段某个机器人沿自己的路径倒退"}。h 上横着走 = 只有 A¹ 动，竖着走 = 只有 A² 动，斜着走 = 两个都动。`;
      this.tl.set(this.u);
    }
    cur() { if (!this.h) return { x: 0, y: 0 }; return C.polyAt(this.h, this.u); }
    drawX(ctx, st, col) {
      st.frame(col);
      const N = this.N, M = N + 1, [wr, wg, wb] = C.rgb(col.wall);
      st.raster(M, M, -0.5 / N, 1 + 0.5 / N, -0.5 / N, 1 + 0.5 / N, (i, j) => (this.obs[j * M + i] ? [wr, wg, wb, 200] : null));
      // 对角线
      ctx.setLineDash([5, 4]); st.line({ x: 0, y: 0 }, { x: 1, y: 1 }, C.alpha(col.bad, 0.75), 1.4); ctx.setLineDash([]);
      for (let i = 0; i <= N; i++) if (this.obs[i * M + i]) st.dot({ x: i / N, y: i / N }, 1.6, col.bad);
      if (this.h) { st.polyline(this.h, col.path, 2.6); st.dot(this.cur(), 5, col.path, col.surface, 1.5); }
      st.text("s₁ →", { x: 1, y: 0 }, col.muted, { align: "right", base: "bottom", dx: -4, dy: -3, size: 11.5 });
      st.text("s₂", { x: 0, y: 1 }, col.muted, { align: "left", base: "top", dx: 4, dy: 3, size: 11.5 });
    }
    drawW(ctx, st, col) {
      st.frame(col);
      const c = this.cur();
      this.paths.forEach((P, k) => {
        st.polyline(P, C.alpha(col.robot[k], 0.55), 1.6, [6, 4]);
        P.forEach((p, i) => st.dot(p, 3.5, i === 0 ? col.robot[k] : col.surface, col.robot[k], 1.4));
        st.arrow(C.polyAt(P, 0.97), P[P.length - 1], col.robot[k], 1.4, 7);
        const q = C.polyAt(P, k ? c.y : c.x);
        st.dot(q, this.r * st.scale, C.alpha(col.robot[k], 0.8), col.robot[k], 1.5);
        st.text("A" + SUP[k], q, "#fff", { weight: 700, size: 11 });
      });
    }
  }

  // =================================================================
  // 组件 4：三个机器人的协调空间 [0,1]³（图 7.9）——X_obs 由三个柱体组成，三张二维投影完全刻画它
  // =================================================================
  const CO3 = { r: 0.065, paths: [
    [{ x: 0.08, y: 0.28 }, { x: 0.92, y: 0.7 }],
    [{ x: 0.08, y: 0.72 }, { x: 0.92, y: 0.3 }],
    [{ x: 0.44, y: 0.95 }, { x: 0.58, y: 0.05 }]] };
  const PAIRS = [[0, 1, 2], [0, 2, 1], [1, 2, 0]];   // (i, j, 拉伸方向 k)
  function coord3Plan(paths, r, N) {
    const F = PAIRS.map(([i, j]) => coordGrid(paths[i], paths[j], r, N)), M = N + 1;
    const blocked = (a, b, c) => F[0][b * M + a] || F[1][c * M + a] || F[2][c * M + b];   // 柱体结构：只看两两投影
    const enc = (a, b, c) => (c * M + b) * M + a, G = new Float32Array(M * M * M).fill(Infinity), par = new Int32Array(M * M * M).fill(-1);
    const closed = new Uint8Array(M * M * M), H = new C.Heap(), g = enc(N, N, N);
    if (blocked(0, 0, 0) || blocked(N, N, N)) return { F, path: null };
    G[0] = 0; H.push(0, 0);
    const hh = (a, b, c) => Math.hypot(N - a, N - b, N - c);
    let exp = 0;
    while (H.size) {
      const u = H.pop(); if (closed[u]) continue; closed[u] = 1; exp++;
      if (u === g) break;
      const a = u % M, b = Math.floor(u / M) % M, c = Math.floor(u / M / M);
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
        if (!da && !db && !dc) continue;
        const A = a + da, B = b + db, Cc = c + dc;
        if (A < 0 || B < 0 || Cc < 0 || A > N || B > N || Cc > N || blocked(A, B, Cc)) continue;
        const v = enc(A, B, Cc); if (closed[v]) continue;
        const nd = G[u] + Math.hypot(da, db, dc);
        if (nd < G[v]) { G[v] = nd; par[v] = u; H.push(v, nd + hh(A, B, Cc)); }
      }
    }
    if (!closed[g]) return { F, path: null, exp };
    const P = []; for (let u = g; u >= 0; u = par[u]) P.push([(u % M) / N, (Math.floor(u / M) % M) / N, Math.floor(u / M / M) / N]);
    P.reverse();
    const free = (p) => !blocked(...p.map((v) => Math.round(v * N)));
    return { F, path: C.shortcut(P, free, 0.5 / N), exp };
  }

  class Coord3 {
    constructor(root) {
      this.N = 40; this.u = 0; this.paths = CO3.paths.map((Q) => Q.map((p) => ({ ...p })));
      this.v3 = new C.View3D(-0.75, 0.42, [0.5, 0.5, 0.5]);
      const body = C.frame(root, "三个机器人的协调空间", "图 7.9：X_obs 的每个分量都是柱体；½m(m−1) = 3 张轴对齐投影就完全刻画了 X_obs。拖动三维图旋转，拖动左下图的路径端点");
      this.st3 = new C.Stage(Object.assign({ view: [-0.95, 0.95, -0.85, 0.85], maxW: 420, aspect: 0.9, onDraw: (ctx, st, col) => this.draw3(ctx, st, col), cursor: () => "grab" }, this.v3.dragHandlers(() => this.st3.draw())));
      const near = (p) => { for (let k = 0; k < 3; k++) for (let i = 0; i < this.paths[k].length; i++) if (C.dist(p, this.paths[k][i]) < 0.04) return { k, i }; return null; };
      this.stW = new C.Stage({ view: [0, 1, 0, 1], maxW: 250, onDraw: (ctx, st, col) => this.drawW(ctx, st, col), onDown: near,
        onMove: (p, d) => { this.paths[d.k][d.i] = { x: C.clamp(p.x, 0.02, 0.98), y: C.clamp(p.y, 0.02, 0.98) }; this.planSoon(); }, cursor: (p) => (near(p) ? "grab" : null) });
      this.proj = PAIRS.map((pr, n) => new C.Stage({ view: [0, 1, 0, 1], maxW: 150, minW: 90, pad: 3, onDraw: (ctx, st, col) => this.drawProj(ctx, st, col, n) }));
      this.tl = new C.Timeline((u) => { this.u = u; this.redraw(); }, { label: "沿 h 前进", dur: 7, fmt: (u) => Math.round(u * 100) + "%" });
      this.out = h("div", { class: "status-line" });
      const pl = (n) => h("div", { style: "text-align:center" }, this.proj[n].wrap, h("div", { class: "small muted" }, ["s₁–s₂（X¹²_obs）", "s₁–s₃（X¹³_obs）", "s₂–s₃（X²³_obs）"][n]));
      body.append(h("div", { class: "split" }, this.st3.wrap, h("div", null, this.stW.wrap, h("div", { class: "small muted", style: "text-align:center" }, "工作空间：A¹ 蓝、A² 粉、A³ 琥珀"))),
        h("div", { style: "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px" }, pl(0), pl(1), pl(2)), this.tl.el, this.out);
      this.plan();
    }
    planSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.plan(); }); }
    plan() {
      const t0 = performance.now();
      this.res = coord3Plan(this.paths, CO3.r, this.N);
      const ms = performance.now() - t0, M = this.N + 1;
      // 每个柱体在自己的二维投影上的边界线段（障碍格与自由格之间的格边）
      this.edges = this.res.F.map((F) => {
        const E = [], o = (i, j) => (i < 0 || j < 0 || i > this.N || j > this.N ? 0 : F[j * M + i]), d = 0.5 / this.N;
        for (let i = 0; i <= this.N; i++) for (let j = 0; j <= this.N; j++) {
          if (!o(i, j)) continue;
          const x = i / this.N, y = j / this.N;
          if (!o(i + 1, j)) E.push([x + d, y - d, x + d, y + d]); if (!o(i - 1, j)) E.push([x - d, y - d, x - d, y + d]);
          if (!o(i, j + 1)) E.push([x - d, y + d, x + d, y + d]); if (!o(i, j - 1)) E.push([x - d, y - d, x + d, y - d]);
        }
        return E;
      });
      this.out.innerHTML = this.res.path ? `在 ${M}³ = ${(M ** 3).toLocaleString()} 个格点上做 A*（26 邻接），展开 ${this.res.exp.toLocaleString()} 个，用时 ${ms.toFixed(0)} ms。判断一个格点是否在 X_obs 里只需查三张 ${M}×${M} 的投影表——这就是柱体结构的好处。` :
        '<span class="no">没有协调路径。</span>';
      this.redraw();
    }
    redraw() { this.st3.draw(); this.stW.draw(); this.proj.forEach((s) => s.draw()); }
    cur() { const P = this.res.path; if (!P) return [0, 0, 0]; const pts = P.map((p) => ({ x: 0, y: 0, p })); const L = []; let acc = 0; L.push(0); for (let i = 1; i < P.length; i++) { acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); L.push(acc); } const T = this.u * acc; let i = 1; while (i < P.length - 1 && L[i] < T) i++; const f = L[i] > L[i - 1] ? (T - L[i - 1]) / (L[i] - L[i - 1]) : 0; return [0, 1, 2].map((k) => P[i - 1][k] + (P[i][k] - P[i - 1][k]) * C.clamp(f, 0, 1)); }
    draw3(ctx, st, col) {
      const V = this.v3, cc = [col.accent, col.goal, col.warn];
      V.cube(st, col, [0, 1, 0, 1, 0, 1], ["s₁", "s₂", "s₃"]);
      // 三个柱体：在拉伸方向的两端各画一次边界，并在投影面（拉伸坐标 = 0）上涂色
      const at = (n, a, b, c) => { const [i, j, k] = PAIRS[n], v = [0, 0, 0]; v[i] = a; v[j] = b; v[k] = c; return v; };
      this.edges.forEach((E, n) => {
        for (const [x0, y0, x1, y1] of E) {
          V.line(st, at(n, x0, y0, 0), at(n, x1, y1, 0), C.alpha(cc[n], 0.95), 1.3);
          V.line(st, at(n, x0, y0, 1), at(n, x1, y1, 1), C.alpha(cc[n], 0.55), 1);
        }
        // 柱体的几根母线：投影区域在两个方向上的极值点
        const pts = E.map(([x0, y0]) => [x0, y0]);
        if (pts.length) for (const f of [(p) => p[0], (p) => -p[0], (p) => p[1], (p) => -p[1]]) {
          const p = pts.reduce((b, q) => (f(q) > f(b) ? q : b));
          V.line(st, at(n, p[0], p[1], 0), at(n, p[0], p[1], 1), C.alpha(cc[n], 0.45), 1);
        }
      });
      if (this.res.path) {
        st.polyline(this.res.path.map((p) => V.proj(p)), col.path, 2.6);
        st.dot(V.proj(this.cur()), 5, col.path, col.surface, 1.5);
      }
      st.dot(V.proj([0, 0, 0]), 4, col.text); st.dot(V.proj([1, 1, 1]), 4, col.text);
    }
    drawProj(ctx, st, col, n) {
      st.frame(col);
      const M = this.N + 1, F = this.res.F[n], cc = [col.accent, col.goal, col.warn][n], [r, g, b] = C.rgb(cc);
      st.raster(M, M, -0.5 / this.N, 1 + 0.5 / this.N, -0.5 / this.N, 1 + 0.5 / this.N, (i, j) => (F[j * M + i] ? [r, g, b, 190] : null));
      const [i, j] = PAIRS[n];
      if (this.res.path) { st.polyline(this.res.path.map((p) => ({ x: p[i], y: p[j] })), col.path, 2); const c = this.cur(); st.dot({ x: c[i], y: c[j] }, 3.5, col.path, col.surface, 1); }
    }
    drawW(ctx, st, col) {
      st.frame(col);
      const c = this.cur();
      this.paths.forEach((P, k) => {
        st.polyline(P, C.alpha(col.robot[k], 0.55), 1.5, [5, 4]);
        P.forEach((p, i) => st.dot(p, 3.5, i === 0 ? col.robot[k] : col.surface, col.robot[k], 1.4));
        const q = C.polyAt(P, c[k]);
        st.dot(q, CO3.r * st.scale, C.alpha(col.robot[k], 0.8), col.robot[k], 1.5);
        st.text(String(k + 1), q, "#fff", { weight: 700, size: 11 });
      });
    }
  }

  // =================================================================
  // 组件 5：固定路线图协调的立方复形（图 7.10；习题 5、7）
  // =================================================================
  const GRAPHS = {
    path: { name: "一条路径", V: [[0.12, 0.5], [0.88, 0.5]], E: [[0, 1]] },
    two: { name: "两条首尾相接", V: [[0.1, 0.3], [0.5, 0.7], [0.9, 0.3]], E: [[0, 1], [1, 2]] },
    star: { name: "T / Y 形：三条交于一点", V: [[0.15, 0.82], [0.15, 0.18], [0.5, 0.5], [0.9, 0.5]], E: [[0, 2], [1, 2], [2, 3]] },
    tri: { name: "三角形：三条首尾成环", V: [[0.5, 0.88], [0.12, 0.2], [0.88, 0.2]], E: [[0, 1], [1, 2], [2, 0]] },
  };
  function cubeComplex(G1, G2) {
    const n0 = G1.V.length * G2.V.length, n1 = G1.V.length * G2.E.length + G1.E.length * G2.V.length, n2 = G1.E.length * G2.E.length;
    // 每个 1-立方体被几个 2-立方体（正方形）用作面
    const use = new Map(), key = (a, b) => a + "|" + b;
    G1.E.forEach((e1, i) => G2.E.forEach((e2, j) => {
      for (const k of [key("v" + e1[0], "e" + j), key("v" + e1[1], "e" + j), key("e" + i, "v" + e2[0]), key("e" + i, "v" + e2[1])]) use.set(k, (use.get(k) || 0) + 1);
    }));
    const hist = { 1: 0, 2: 0, 3: 0 };
    for (const [, c] of use) hist[Math.min(3, c)]++;
    const chi = n0 - n1 + n2;
    const loop = (G) => G.E.length === G.V.length;    // 这几个图里：边数 = 顶点数 ⇔ 有一个环
    const branch = (G) => G.V.some((_, v) => G.E.filter((e) => e[0] === v || e[1] === v).length >= 3);
    let shape;
    if (branch(G1) || branch(G2)) shape = "有一条棱被 ≥ 3 个正方形共用：像几页书粘在同一条书脊上，不是流形（图 7.10b 就是这种）";
    else if (loop(G1) && loop(G2)) shape = "每条棱恰好被 2 个正方形共用、没有边界：闭曲面，S¹ × S¹ = 环面 T²";
    else if (loop(G1) || loop(G2)) shape = "S¹ × [0,1]：圆柱面（有两条边界圆）";
    else shape = "[0,1] × [0,1]（路径拼成的仍是线段）：一块长方形";
    return { n0, n1, n2, chi, hist, use, shape, key };
  }

  class CubeComplex {
    constructor(root) {
      this.g1 = "star"; this.g2 = "path"; this.hover = null;
      const body = C.frame(root, "固定路线图协调：立方复形", "A¹ 在拓扑图 G₁ 上走、A² 在 G₂ 上走；每对边 (τᵢ, σⱼ) 给一个正方形，颜色相同的棱粘在一起");
      this.sel1 = C.select(Object.entries(GRAPHS).map(([k, v]) => [k, v.name]), this.g1, (k) => { this.g1 = k; this.update(); });
      this.sel2 = C.select(Object.entries(GRAPHS).map(([k, v]) => [k, v.name]), this.g2, (k) => { this.g2 = k; this.update(); });
      this.stG = [0, 1].map((k) => new C.Stage({ view: [0, 1, 0, 1], maxW: 150, minW: 100, pad: 4, onDraw: (ctx, st, col) => this.drawG(ctx, st, col, k) }));
      this.stK = new C.Stage({ view: [0, 1, 0, 1], maxW: 440, aspect: 0.9, onDraw: (ctx, st, col) => this.drawK(ctx, st, col),
        onHover: (p) => { this.hover = this.pickEdge(p); this.stK.draw(); }, onLeave: () => { this.hover = null; this.stK.draw(); } });
      this.stats = { n0: C.stat("0-立方体（角点）"), n1: C.stat("1-立方体（棱）"), n2: C.stat("2-立方体（正方形）"), chi: C.stat("欧拉示性数 χ") };
      this.out = h("div", { class: "status-line" });
      body.append(h("div", { class: "controls" }, h("label", null, "G₁（A¹）", this.sel1), h("label", null, "G₂（A²）", this.sel2)),
        h("div", { class: "split" }, this.stK.wrap, h("div", null,
          h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" }, ...[0, 1].map((k) => h("div", { style: "text-align:center" }, this.stG[k].wrap, h("div", { class: "small muted" }, k ? "G₂：边 σⱼ" : "G₁：边 τᵢ")))),
          h("div", { class: "stats" }, Object.values(this.stats)), this.out)));
      this.update();
    }
    update() {
      this.G1 = GRAPHS[this.g1]; this.G2 = GRAPHS[this.g2];
      this.K = cubeComplex(this.G1, this.G2);
      const K = this.K;
      this.stats.n0.set(K.n0); this.stats.n1.set(K.n1); this.stats.n2.set(K.n2); this.stats.chi.set(K.chi);
      this.out.innerHTML = `2-立方体 = n₁n₂ = ${this.G1.E.length}×${this.G2.E.length}；1-立方体 = |V₁||E₂| + |E₁||V₂| = ${this.G1.V.length}×${this.G2.E.length} + ${this.G1.E.length}×${this.G2.V.length}；0-立方体 = |V₁||V₂|。` +
        `<br>棱的使用次数：1 次（边界）${K.hist[1]} 条，2 次 ${K.hist[2]} 条，≥ 3 次 ${K.hist[3]} 条。<b>${K.shape}</b>。<span class="muted">（补充：这个复形就是乘积 G₁ × G₂，所以 χ = χ(G₁)·χ(G₂)。）</span>`;
      // 正方形的排布：行 = G₁ 的边，列 = G₂ 的边
      this.layout();
      this.stK.draw(); this.stG.forEach((s) => s.draw());
    }
    layout() {
      const r = this.G1.E.length, c = this.G2.E.length, gap = 0.08, S = Math.min((1 - gap * (c + 1)) / c, (1 - gap * (r + 1)) / r);
      this.sq = [];
      for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) {
        const x0 = gap + j * (S + gap) + (1 - (c * S + (c + 1) * gap)) / 2, y0 = 1 - (gap + (i + 1) * (S + gap)) + gap - (1 - (r * S + (r + 1) * gap)) / 2;
        this.sq.push({ i, j, x0, y0, S });
      }
      // 每个 1-立方体分配一个编号和颜色
      this.ids = new Map(); for (const k of this.K.use.keys()) this.ids.set(k, this.ids.size);
    }
    sides(q) {
      const e1 = this.G1.E[q.i], e2 = this.G2.E[q.j], k = this.K.key, { x0, y0, S } = q;
      // 横向是 τᵢ 的参数，纵向是 σⱼ 的参数
      return [
        { k: k("v" + e1[0], "e" + q.j), a: { x: x0, y: y0 }, b: { x: x0, y: y0 + S } },
        { k: k("v" + e1[1], "e" + q.j), a: { x: x0 + S, y: y0 }, b: { x: x0 + S, y: y0 + S } },
        { k: k("e" + q.i, "v" + e2[0]), a: { x: x0, y: y0 }, b: { x: x0 + S, y: y0 } },
        { k: k("e" + q.i, "v" + e2[1]), a: { x: x0, y: y0 + S }, b: { x: x0 + S, y: y0 + S } },
      ];
    }
    pickEdge(p) {
      for (const q of this.sq) for (const s of this.sides(q)) if (C.segPointDist(p, s.a, s.b).d < 0.025) return s.k;
      return null;
    }
    edgeColor(col, k) {
      const pal = [col.accent, col.goal, col.ok, col.warn, col.alive2, col.mud, col.bad, col.start, col.alive, col.dead];
      return pal[this.ids.get(k) % pal.length];
    }
    drawK(ctx, st, col) {
      st.frame(col);
      for (const q of this.sq) {
        st.box({ x0: q.x0, y0: q.y0, x1: q.x0 + q.S, y1: q.y0 + q.S }, col.surface2, null);
        st.text(`(τ${q.i + 1}, σ${q.j + 1})`, { x: q.x0 + q.S / 2, y: q.y0 + q.S / 2 }, col.text2, { size: 12 });
      }
      for (const q of this.sq) for (const s of this.sides(q)) {
        const on = this.hover === s.k, c = this.edgeColor(col, s.k), n = this.K.use.get(s.k);
        st.line(s.a, s.b, on ? col.text : c, on ? 5 : 3);
        const m = C.lerp(s.a, s.b, 0.5), vert = Math.abs(s.a.x - s.b.x) < 1e-9;
        st.text(String(this.ids.get(s.k) + 1) + (n >= 3 ? "!" : ""), m, on ? col.text : c, { size: 10.5, weight: 700, dx: vert ? (s.a.x < q.x0 + q.S / 2 ? 9 : -9) : 0, dy: vert ? 0 : (s.a.y < q.y0 + q.S / 2 ? -8 : 8) });
      }
      st.text(this.hover ? `棱 ${this.ids.get(this.hover) + 1}：被 ${this.K.use.get(this.hover)} 个正方形共用` : "把鼠标移到一条棱上", { x: 0.02, y: 0.015 }, col.muted, { align: "left", base: "bottom", size: 11.5 });
    }
    drawG(ctx, st, col, k) {
      st.frame(col);
      const G = k ? this.G2 : this.G1, c = col.robot[k];
      G.E.forEach(([a, b], i) => {
        const A = { x: G.V[a][0], y: G.V[a][1] }, B = { x: G.V[b][0], y: G.V[b][1] };
        st.arrow(A, C.lerp(A, B, 0.93), c, 1.8, 7);
        st.text((k ? "σ" : "τ") + (i + 1), C.lerp(A, B, 0.5), col.text2, { size: 11, dy: -9 });
      });
      G.V.forEach(([x, y]) => st.dot({ x, y }, 4, col.surface, c, 1.6));
    }
  }

  CH7.multi = { Assembly, Prioritized, Coord2, Coord3, CubeComplex, parseAsm, disassemble, ASM_PRESETS, CORR, PR, soloPath, lowPriority, centralized, prioritizedPlan, coordGrid, gridAstar, CO_PRESETS, coord3Plan, CO3, cubeComplex, GRAPHS };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='assembly']").forEach((el) => el._w = new Assembly(el));
    document.querySelectorAll("[data-widget='prioritized']").forEach((el) => el._w = new Prioritized(el));
    document.querySelectorAll("[data-widget='coord2']").forEach((el) => el._w = new Coord2(el));
    document.querySelectorAll("[data-widget='coord3']").forEach((el) => el._w = new Coord3(el));
    document.querySelectorAll("[data-widget='cube-complex']").forEach((el) => el._w = new CubeComplex(el));
  });
})();
