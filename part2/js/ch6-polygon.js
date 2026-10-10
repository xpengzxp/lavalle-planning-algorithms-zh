/* 6.1–6.2.2、6.3.1–6.3.2 节：路线图的两个条件、双向边表、图 6.2 的四种情形、平面扫描（图 6.6/6.7）、
   单元分解规划器（垂直分解 / 三角剖分 / 柱形分解） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;

  // ===============================================================
  // 6.1：路线图的两个条件——可达性 & 保持连通性
  // ===============================================================
  class RoadmapProps {
    constructor(root) {
      // 轻微剪切 x ← x + 0.021 y：让竖直边不再竖直，满足一般位置（用 6.2.2 节的算法判定真实答案时需要）
      const sh = ([x, y]) => [x + 0.021 * y, y];
      this.S = new C.Scene([
        [[0, 0], [1.4, 0], [1.4, 1], [0, 1]],
        [[0.4, 0.3], [1.0, 0.3], [1.0, 0.72], [0.4, 0.72]],
        [[0.05, 0.25], [0.05, 0.2], [0.2, 0.2], [0.2, 0.05], [0.25, 0.05], [0.25, 0.25]],
        [[1.15, 0.78], [1.3, 0.78], [1.3, 0.9], [1.15, 0.9]],
      ].map((Q) => Q.map(sh)));
      const N = { TL: [0.2, 0.86], TM: [0.7, 0.86], TR: [1.07, 0.86], RM: [1.2, 0.5], BR: [1.2, 0.15], BM: [0.7, 0.15], BL: [0.33, 0.13], LM: [0.2, 0.5], G1: [0.025, 0.32], G2: [0.025, 0.17], PK: [0.1, 0.1] };
      this.N = Object.fromEntries(Object.entries(N).map(([k, v]) => [k, P(...sh(v))]));
      const ring = [["TL", "TM"], ["TM", "TR"], ["TR", "RM"], ["RM", "BR"], ["BR", "BM"], ["BM", "BL"], ["BL", "LM"], ["LM", "TL"]];
      const spur = [["LM", "G1"], ["G1", "G2"], ["G2", "PK"]];
      this.modes = {
        good: { name: "好的路线图", E: ring.concat(spur) },
        broken: { name: "断开了（不保持连通性）", E: ring.filter(([a, b]) => !(a === "TM" && b === "TR") && !(a === "BR" && b === "BM")).concat(spur) },
        unreach: { name: "伸不进角落（不满足可达性）", E: ring },
      };
      this.mode = "good";
      this.qI = P(0.102, 0.1); this.qG = P(1.307, 0.35);
      const body = C.frame(root, "路线图的两个条件", "拖动 qI、qG；先连到路线图，再在图上搜索");
      this.st = new C.Stage({ aspect: 0.66, maxW: 560, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => (this.st.near(p, this.qI, 12) ? "qI" : this.st.near(p, this.qG, 12) ? "qG" : null),
        onMove: (p, d) => { if (this.S.free(p)) { this[d] = p; this.update(); } },
        cursor: (p) => (this.st.near(p, this.qI, 12) || this.st.near(p, this.qG, 12) ? "grab" : null) });
      this.st.fitScene(this.S, 0.02);
      this.truth = C.decompose(this.S);
      this.msg = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, C.seg(Object.entries(this.modes).map(([k, m]) => [k, m.name]), this.mode, (k) => { this.mode = k; this.update(); })),
        h("div", { class: "split" }, this.st.wrap, h("div", null, this.msg,
          C.legend([[C.cv("accent"), "路线图 G（扫过的集合 S）"], [C.cv("warn"), "到 S 的直线连接（可达性）"], [C.cv("path"), "解路径"], [C.cva("wall", 0.7), "C_obs"]]))));
      this.update();
    }
    attach(q) {
      // 在 S 上找离 q 最近、且与 q 直线可见的点（可达性：简单、高效地连到路线图）
      let best = null;
      for (const [a, b] of this.modes[this.mode].E) {
        const A = this.N[a], B = this.N[b];
        const { t } = C.segPointDist(q, A, B);
        for (const tt of [t, 0, 1, 0.25, 0.5, 0.75]) {
          const s = C.lerp(A, B, tt), d = C.dist(q, s);
          if ((!best || d < best.d) && C.visible(this.S, q, s)) best = { s, d, a, b, t: tt };
        }
      }
      return best;
    }
    update() {
      const E = this.modes[this.mode].E;
      this.sI = this.attach(this.qI); this.sG = this.attach(this.qG);
      // 路线图上的搜索（把 s1、s2 插进它们所在的边）
      this.path = null;
      if (this.sI && this.sG) {
        const nodes = Object.assign({}, this.N, { s1: this.sI.s, s2: this.sG.s });
        const adj = {}; const add = (u, v) => { (adj[u] = adj[u] || []).push(v); (adj[v] = adj[v] || []).push(u); };
        for (const [a, b] of E) {
          const cuts = [];
          if (this.sI.a === a && this.sI.b === b) cuts.push(["s1", this.sI.t]);
          if (this.sG.a === a && this.sG.b === b) cuts.push(["s2", this.sG.t]);
          cuts.sort((x, y) => x[1] - y[1]);
          let prev = a; for (const [nm] of cuts) { add(prev, nm); prev = nm; } add(prev, b);
        }
        const dist = { s1: 0 }, par = {}, done = new Set();
        for (;;) {
          let u = null; for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
          if (u === null || u === "s2") break; done.add(u);
          for (const v of adj[u] || []) { const w = dist[u] + C.dist(nodes[u], nodes[v]); if (dist[v] === undefined || w < dist[v]) { dist[v] = w; par[v] = u; } }
        }
        if (dist.s2 !== undefined) { const pts = []; for (let u = "s2"; u; u = par[u]) pts.push(nodes[u]); this.path = [this.qI].concat(pts.reverse(), [this.qG]); }
      }
      const D = this.truth, cI = C.locateCell(D, this.qI), cG = C.locateCell(D, this.qG);
      const r = C.cellRoadmapQuery(D, cI, cG, this.qI, this.qG);
      this.truthOK = !!(r && r.found);
      const ok = (b) => (b ? '<span class="yes">✓</span>' : '<span class="no">✗</span>');
      let verdict;
      if (!this.sI || !this.sG) verdict = `<div class="msg bad">${!this.sI ? "qI" : "qG"} 看不见路线图上的任何一点——<b>可达性</b>不成立，查询在第一步就失败。</div>`;
      else if (!this.path) verdict = `<div class="msg bad">s1 与 s2 在 G 上不连通${this.truthOK ? "，但 C_free 里其实有解：这张路线图<b>没有保持连通性</b>。" : "，C_free 里也确实无解。"}</div>`;
      else verdict = `<div class="msg ok">找到解：qI → s1 → 沿 G → s2 → qG。</div>`;
      this.msg.innerHTML = `<div class="kv"><dt>qI 连到 S</dt><dd>${ok(this.sI)}</dd><dt>qG 连到 S</dt><dd>${ok(this.sG)}</dd><dt>G 上 s1、s2 连通</dt><dd>${this.sI && this.sG ? ok(this.path) : "–"}</dd>`
        + `<dt>真实答案</dt><dd>${this.truthOK ? "有解" : "无解"} <span class="muted">（用 6.2.2 节的完备算法判定）</span></dd></div>${verdict}`;
      this.st.draw();
    }
    draw(st, col) {
      st.scene(this.S, col);
      for (const [a, b] of this.modes[this.mode].E) st.line(this.N[a], this.N[b], col.accent, 3);
      for (const k in this.N) if (this.modes[this.mode].E.some((e) => e.includes(k))) st.dot(this.N[k], 3.2, col.accent);
      for (const [q, s] of [[this.qI, this.sI], [this.qG, this.sG]]) if (s) { st.line(q, s.s, col.warn, 2, [5, 4]); st.dot(s.s, 4, col.warn); }
      if (this.path) st.path(this.path, C.alpha(col.path, 0.9), 3.5);
      if (this.sI) st.text("s1", this.sI.s, col.warn, { dx: 12, dy: -8, weight: 650 });
      if (this.sG) st.text("s2", this.sG.s, col.warn, { dx: 12, dy: -8, weight: 650 });
      st.qmark(this.qI, "I", col); st.qmark(this.qG, "G", col);
    }
  }

  // ===============================================================
  // 6.2.1：双向边表（doubly connected edge list）
  // ===============================================================
  class DCEL {
    constructor(root) {
      this.S = C.makeScene("fig61");
      this.withCuts = false;
      const body = C.frame(root, "双向边表：四条有向的环", "点一条半边看它的记录；用 next / prev / twin 在表里走");
      this.st = new C.Stage({ aspect: 0.68, maxW: 600, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { const k = this.pick(p); if (k >= 0) { this.sel = k; this.render(); } return null; },
        cursor: (p) => (this.pick(p) >= 0 ? "pointer" : null) });
      this.st.fitScene(this.S, 0.03);
      this.info = h("div", { class: "panel-body mono", style: "white-space:pre-wrap;line-height:1.55" });
      const nav = (k) => C.button(k, () => { const he = this.H[this.sel]; if (!he) return; const t = he[k]; if (t !== null && t !== undefined) { this.sel = t; this.render(); } }, "small");
      this.cbCuts = C.check("加入垂直分解的竖直线段（成对的 twin 半边）", false, (v) => { this.withCuts = v; this.build(); this.render(); });
      this.faceBox = h("div", { class: "panel-body small" });
      body.append(h("div", { class: "controls" }, nav("prev"), nav("next"), nav("twin"), this.cbCuts),
        h("div", { class: "split" }, this.st.wrap, h("div", null,
          h("div", { class: "panel" }, h("div", { class: "panel-title" }, "当前半边的记录"), this.info),
          h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "面（face）记录"), this.faceBox))),
        C.legend([[C.cv("accent"), "障碍的环（逆时针）"], [C.cv("goal"), "洞与外边界的环（顺时针）"], [C.cv("warn"), "选中的半边"], [C.cv("ok"), "竖直线段（twin 成对）"]]));
      this.build(); this.sel = 0; this.render();
    }
    build() {
      const S = this.S, H = [], faces = [];
      // 每个多边形的「深度」：被多少个其它多边形包含。0 = 外边界，1 = 障碍，2 = 障碍里的洞
      const depth = S.polys.map((Q, pi) => S.polys.reduce((s, R, pj) => s + (pj !== pi && C.inPoly(Q[0], R) ? 1 : 0), 0));
      const fname = ["F0 外部（无界，属于 C_obs）", "F1 C_free（外边界之内）", "F2 障碍 A", "F3 障碍 B", "F4 B 里的三角形洞（C_free）"];
      faces.push({ name: fname[0], outer: null, inner: [] });
      faces.push({ name: fname[1], outer: null, inner: [] });
      S.polys.forEach((Q, pi) => {
        // 障碍在左手边：障碍的环逆时针（depth 1），洞和外边界顺时针（depth 0、2）
        const ccw = C.polyArea(Q) > 0, wantCCW = depth[pi] === 1;
        const order = Q.map((_, i) => i); if (ccw !== wantCCW) order.reverse();
        const base = H.length, n = Q.length;
        order.forEach((i, k) => H.push({ id: base + k, o: Q[i], d: Q[order[(k + 1) % n]], next: base + (k + 1) % n, prev: base + (k - 1 + n) % n, twin: null, chain: pi, face: null, kind: wantCCW ? "obs" : "hole" }));
        if (pi === 0) { faces[0].inner.push(base); faces[1].outer = base; H.slice(base).forEach((e) => (e.face = 0)); }
        else if (depth[pi] === 1) { faces.push({ name: fname[faces.length] || "障碍", outer: base, inner: [] }); faces[1].inner.push(base); const f = faces.length - 1; H.slice(base).forEach((e) => (e.face = f)); }
        else { // 洞：所在的障碍面把它列为内部分量
          const host = S.polys.findIndex((R, pj) => pj !== pi && depth[pj] === 1 && C.inPoly(Q[0], R));
          const hf = faces.findIndex((f) => f.outer !== null && H[f.outer].chain === host);
          faces[hf].inner.push(base); faces.push({ name: fname[4], outer: base, inner: [], hole: true }); H.slice(base).forEach((e) => (e.face = hf));
        }
      });
      if (this.withCuts) {
        const D = C.decompose(S);
        for (const o of D.ones) {
          const a = P(o.x, o.y0), b = P(o.x, o.y1), k = H.length;
          H.push({ id: k, o: a, d: b, next: null, prev: null, twin: k + 1, chain: -1, face: "梯形单元", kind: "cut" });
          H.push({ id: k + 1, o: b, d: a, next: null, prev: null, twin: k, chain: -1, face: "梯形单元", kind: "cut" });
        }
      }
      this.H = H; this.faces = faces;
      if (this.sel >= H.length) this.sel = 0;
    }
    pick(p) {
      let best = -1, bd = 9;
      this.H.forEach((e, k) => { const d = C.segPointDist(p, e.o, e.d).d * this.st.scale; if (d < bd) { bd = d; best = k; } });
      if (best >= 0 && this.H[best].kind === "cut") {
        // 两个 twin 重合：交替选择
        if (this.sel === best || this.sel === this.H[best].twin) best = this.sel === best ? this.H[best].twin : best;
      }
      return best;
    }
    render() {
      const e = this.H[this.sel], fmtP = (p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;
      const nm = (k) => (k === null || k === undefined ? "NIL" : "h" + k);
      const fn = typeof e.face === "number" ? this.faces[e.face].name.split(" ")[0] : e.face;
      this.info.textContent = `半边 h${e.id}${e.kind === "cut" ? "（竖直线段，切开 C_free）" : ""}\n起点 origin : ${fmtP(e.o)}\n终点        : ${fmtP(e.d)}\ntwin        : ${nm(e.twin)}${e.twin === null ? "（边界在 C_obs 上，没有孪生）" : ""}\n左侧的面    : ${fn}\nnext        : ${nm(e.next)}\nprev        : ${nm(e.prev)}`;
      this.faceBox.innerHTML = this.faces.map((f) => `<div><b>${f.name}</b>：外边界 → ${f.outer === null ? "NIL" : "h" + f.outer}；内部分量 → [${f.inner.map((k) => "h" + k).join(", ")}]</div>`).join("");
      this.st.draw();
    }
    draw(st, col) {
      st.scene(this.S, col, { alphaObs: 0.55 });
      const cyc = new Set(); if (this.H[this.sel].kind !== "cut") { let k = this.sel; do { cyc.add(k); k = this.H[k].next; } while (k !== this.sel && cyc.size < 999); }
      const off = 5 / st.scale;
      this.H.forEach((e, k) => {
        // 画在左侧（障碍一侧）稍微偏一点
        const dx = e.d.x - e.o.x, dy = e.d.y - e.o.y, L = Math.hypot(dx, dy), nx = -dy / L * off, ny = dx / L * off;
        const a = C.lerp(e.o, e.d, 0.12), b = C.lerp(e.o, e.d, 0.88);
        const sh = (p) => P(p.x + nx, p.y + ny);
        let c = e.kind === "obs" ? col.accent : e.kind === "hole" ? col.goal : col.ok;
        if (cyc.has(k)) c = C.alpha(c, 1);
        if (k === this.sel) c = col.warn;
        st.arrow(sh(a), sh(b), c, k === this.sel ? 3 : cyc.has(k) ? 2 : 1.3, k === this.sel ? 10 : 7);
      });
      const e = this.H[this.sel];
      st.dot(e.o, 5, col.warn, col.surface, 1.5);
      if (e.next !== null) { const n = this.H[e.next]; st.text("next", C.lerp(n.o, n.d, 0.5), col.text2, { dy: -10, size: 11 }); }
      if (e.prev !== null) { const n = this.H[e.prev]; st.text("prev", C.lerp(n.o, n.d, 0.5), col.text2, { dy: -10, size: 11 }); }
    }
  }

  // ===============================================================
  // 图 6.2：在顶点 p 处向上、向下延伸射线的四种情形
  // ===============================================================
  class VCDCases {
    constructor(root) {
      this.p = P(0, 0); this.a = P(0.7, 0.45); this.b = P(0.75, -0.35); this.inside = true;
      const body = C.frame(root, "图 6.2：顶点处的四种情形", "拖动两个邻点 a、b；也可以把障碍换到角的另一侧");
      this.st = new C.Stage({ aspect: 0.62, maxW: 520, view: [-1.1, 1.1, -0.75, 0.75], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => (this.st.near(p, this.a, 14) ? "a" : this.st.near(p, this.b, 14) ? "b" : null),
        onMove: (p, d) => { const q = P(Math.max(-1, Math.min(1, p.x)), Math.max(-0.6, Math.min(0.6, p.y))); if (Math.hypot(q.x, q.y) > 0.15 && Math.abs(q.x) > 0.02) { this[d] = q; this.update(); } },
        cursor: (p) => (this.st.near(p, this.a, 14) || this.st.near(p, this.b, 14) ? "grab" : null) });
      this.out = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, C.seg([["in", "障碍在 ∠apb 里（凸顶点）"], ["out", "障碍在 ∠apb 外（凹顶点）"]], "in", (k) => { this.inside = k === "in"; this.update(); }),
        C.button("情形 1", () => this.preset(1), "small"), C.button("情形 2", () => this.preset(2), "small"), C.button("情形 3", () => this.preset(3), "small"), C.button("情形 4", () => this.preset(4), "small")),
        h("div", { class: "split" }, this.st.wrap, this.out));
      this.update();
    }
    preset(k) {
      const S = { 1: [[0.7, 0.45], [0.75, -0.35], true], 2: [[-0.7, -0.4], [0.8, -0.3], true], 3: [[0.7, 0.42], [-0.75, 0.38], true], 4: [[0.7, 0.42], [0.75, -0.38], false] }[k];
      this.a = P(...S[0]); this.b = P(...S[1]); this.inside = S[2];
      this.root().querySelector(".seg").set(this.inside ? "in" : "out");
      this.update();
    }
    root() { return this.st.wrap.closest(".widget"); }
    inObs(dir) {
      // dir 方向是否落在障碍里：∠apb 指从 pa 逆时针转到 pb 的那个角（小于 π 的一侧）
      const ang = (q) => Math.atan2(q.y, q.x);
      let A = ang(this.a), B = ang(this.b), t = ang(dir);
      const norm = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let span = norm(B - A); let lo = A;
      if (span > Math.PI) { span = 2 * Math.PI - span; lo = B; }
      const inWedge = norm(t - lo) < span;
      return this.inside ? inWedge : !inWedge;
    }
    update() {
      const up = !this.inObs(P(0, 1)), down = !this.inObs(P(0, -1));
      this.caseNo = up && down ? 1 : up ? 2 : down ? 3 : 4;
      const right = (this.a.x > 0) + (this.b.x > 0);
      const upd = right === 2 ? "两条边都在 p 右边：扫描线经过 p 时把它们<b>插入</b> L（镜像情形则是两条边都在左边，<b>删除</b>两条）"
        : right === 0 ? "两条边都在 p 左边：扫描线经过 p 时把它们从 L 中<b>删除</b>"
          : "一条在左、一条在右：L 中把左边那条<b>替换</b>成右边那条";
      const names = { 1: "向上、向下都延伸", 2: "只向上延伸", 3: "只向下延伸", 4: "两边都不能延伸" };
      this.out.innerHTML = `<p style="font-size:1.05em"><b>情形 ${this.caseNo}</b>：${names[this.caseNo]}</p>`
        + `<p>p 正上方 ${up ? '<span class="yes">在 C_free 里</span>' : '<span class="no">在 C_obs 里</span>'}；正下方 ${down ? '<span class="yes">在 C_free 里</span>' : '<span class="no">在 C_obs 里</span>'}。</p>`
        + `<p class="small">${upd}。<span class="muted">（射线由「p 的上下是否在 C_free 中」决定；L 的更新只看两条边在 p 的哪一侧——两件事互相独立。）</span></p>`;
      this.st.draw();
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      // 障碍：用很多小扇形近似 ∠apb（或它的补角）
      const R = 3, ctx = st.ctx;
      ctx.beginPath();
      const N = 360;
      ctx.moveTo(st.X(0), st.Y(0));
      for (let k = 0; k <= N; k++) {
        const t = (k / N) * 2 * Math.PI, d = P(Math.cos(t), Math.sin(t));
        if (this.inObs(d)) ctx.lineTo(st.X(R * d.x), st.Y(R * d.y)); else ctx.lineTo(st.X(0), st.Y(0));
      }
      ctx.closePath(); ctx.fillStyle = C.alpha(col.wall, 0.75); ctx.fill();
      // 上下两条水平边界（代表扫描线上方、下方最近的边）
      st.line(P(-1.2, 0.6), P(1.2, 0.6), col.wall, 2); st.line(P(-1.2, -0.6), P(1.2, -0.6), col.wall, 2);
      st.line(this.p, P(this.a.x * 9, this.a.y * 9), col.wall, 2); st.line(this.p, P(this.b.x * 9, this.b.y * 9), col.wall, 2);
      const up = !this.inObs(P(0, 1)), down = !this.inObs(P(0, -1));
      st.line(P(0, -0.6), P(0, 0.6), C.alpha(col.muted, 0.6), 1, [3, 4]);
      if (up) st.line(this.p, P(0, 0.6), col.accent, 3);
      if (down) st.line(this.p, P(0, -0.6), col.accent, 3);
      st.dot(this.p, 5, col.warn, col.surface, 1.5); st.text("p", this.p, col.warn, { dx: -12, dy: -2, weight: 650 });
      for (const k of ["a", "b"]) { st.dot(this[k], 6, col.surface, col.text, 2); st.text(k, this[k], col.text, { dy: -14, weight: 650 }); }
    }
  }

  // ===============================================================
  // 平面扫描（图 6.6、6.7）与柱形分解（图 6.18、6.19）
  // ===============================================================
  class Sweep {
    constructor(root) {
      this.key = "fig66"; this.cyl = false; this.k = -1;
      const body = C.frame(root, "平面扫描：一条竖线从左扫到右", "逐个事件前进；看有序表 L 怎样被插入、删除、替换");
      this.st = new C.Stage({ aspect: 0.62, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.selS = C.select(Object.entries(C.SCENES).filter(([k]) => k !== "spmap").map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.load(); });
      this.mode = C.seg([["v", "垂直分解（图 6.6）"], ["c", "柱形分解（图 6.18）"]], "v", (k) => { this.cyl = k === "c"; this.load(true); });
      this.runner = new C.Runner(() => { if (this.k >= this.D.events.length - 1) return false; this.k++; this.render(); return true; });
      this.Lbox = h("div", { class: "panel-body", style: "min-height:4.2em" });
      this.evBox = h("div", { class: "small", style: "min-height:5.6em" });
      this.table = h("div", { class: "table-wrap", style: "max-height:300px;overflow:auto;margin:0" });
      body.append(h("div", { class: "controls" }, this.selS, this.mode),
        h("div", { class: "controls" }, C.button("⏮", () => { this.runner.stop(); this.k = -1; this.render(); }, "small"), C.button("◀ 上一个事件", () => { this.runner.stop(); this.k = Math.max(-1, this.k - 1); this.render(); }, "small"),
          C.button("下一个事件 ▶", () => { this.runner.stop(); this.k = Math.min(this.D.events.length - 1, this.k + 1); this.render(); }, "small primary"),
          C.button("▶ 自动", () => { if (this.k >= this.D.events.length - 1) this.k = -1; this.runner.start(700); }, "small"), C.button("⏭", () => { this.runner.stop(); this.k = this.D.events.length - 1; this.render(); }, "small")),
        this.st.wrap,
        h("div", { class: "split", style: "margin-top:10px" },
          h("div", null, h("div", { class: "panel" }, h("div", { class: "panel-title" }, "扫描线刚经过事件后的 L（自下而上）"), this.Lbox), this.evBox),
          this.table),
        C.legend([[C.cv("warn"), "扫描线 / 当前事件"], [C.cva("accent", 0.35), "已完成的梯形"], [C.cv("accent"), "竖直线段（1-单元）"], [C.cva("wall", 0.7), "C_obs"]]));
      this.load();
    }
    load(keepK) {
      this.S = C.makeScene(this.key);
      this.D = C.decompose(this.S, this.cyl);
      this.st.fitScene(this.S, 0.035);
      if (!keepK) this.k = -1;
      this.book = this.key === "fig66" ? ["ab", "db", "dfeb", "dfib", "dfghib", "dfgjnhib", "dfgjnb", "djnb", "djnmlb", "djlb", "dklb", "db", "dc", ""] : null;
      this.render();
    }
    Lafter(k) { return k < 0 ? [] : k < this.D.slabs.length ? this.D.slabs[k].L.map((e) => e.name) : []; }
    render() {
      const D = this.D, k = this.k;
      const L = this.Lafter(k), prev = this.Lafter(k - 1);
      const added = L.filter((x) => !prev.includes(x)), removed = prev.filter((x) => !L.includes(x));
      const chip = (x, cls) => `<span class="tag ${cls}" style="font-family:var(--mono);font-size:13px">${x}</span>`;
      this.Lbox.innerHTML = (L.length ? L.map((x) => chip(x, added.includes(x) ? "green" : "blue")).join(" ") : '<span class="muted">{ }（空）</span>')
        + (removed.length ? `<div class="small" style="margin-top:6px">刚删除：${removed.map((x) => chip(`<s>${x}</s>`, "red")).join(" ")}</div>` : "");
      if (k < 0) this.evBox.innerHTML = "<p>扫描线在最左边（x = −∞），L 为空。点「下一个事件」。</p>";
      else {
        const e = D.events[k];
        const caseTxt = { 1: "向上、向下都延伸", 2: "只向上延伸", 3: "只向下延伸", 4: "不延伸" }[e.caseNo];
        const upd = { insert: "插入两条边", delete: "删除两条边", replace: "一条边替换成另一条" }[e.upd];
        this.evBox.innerHTML = `<p><b>事件 ${k}</b>：顶点 (${e.v.p.x.toFixed(3)}, ${e.v.p.y.toFixed(3)})。图 6.2 的<b>情形 ${e.caseNo}</b>（${caseTxt}）；L 的更新：<b>${upd}</b>。`
          + ` 用平衡二叉搜索树存 L，找 p 上下的边、插入、删除都是 \\(O(\\lg n)\\)，${D.events.length} 个事件合计 \\(O(n\\lg n)\\)。</p>`;
      }
      // 事件表（图 6.7）
      const rows = D.events.map((e, i) => {
        const Li = this.Lafter(i).join(", ");
        const bk = this.book ? this.book[i].split("").join(", ") : null;
        const okb = this.book ? (this.book[i] === this.Lafter(i).join("") ? '<span class="yes">✓</span>' : '<span class="no">✗</span>') : "";
        return `<tr style="${i === k ? "background:var(--warn-soft)" : ""}"><td class="c">${i}</td><td class="mono">{${Li}}</td>${this.book ? `<td class="mono">{${bk}} ${okb}</td>` : ""}<td class="c">${e.caseNo}</td></tr>`;
      }).join("");
      this.table.innerHTML = `<table class="data" style="font-size:13px"><tr><th class="c">事件</th><th>L（本页计算）</th>${this.book ? "<th>图 6.7</th>" : ""}<th class="c">情形</th></tr>${rows}</table>`;
      PA.renderMath(this.evBox);
      this.st.draw();
    }
    draw(st, col) {
      const S = this.S, D = this.D, k = this.k;
      st.scene(S, col, { edgeNames: true });
      const xNow = k < 0 ? -Infinity : D.events[k].x;
      // 已经完全扫过的单元
      D.cells.forEach((c, i) => {
        if (c.x1 <= xNow + 1e-12) st.poly(c.poly, C.alpha(col.accent, i % 2 ? 0.16 : 0.26), null);
      });
      if (this.cyl) {
        // 柱形分解里 C_obs 也被切成单元：在已扫过的竖条里画出 C_obs 的部分
        D.slabs.forEach((sl, j) => { if (sl.x1 <= xNow + 1e-12) sl.intervals.forEach((iv) => { if (!iv.free) { const Q = [P(sl.x0, S.yAt(iv.lo, sl.x0)), P(sl.x1, S.yAt(iv.lo, sl.x1)), P(sl.x1, S.yAt(iv.hi, sl.x1)), P(sl.x0, S.yAt(iv.hi, sl.x0))]; st.poly(Q, null, C.alpha(col.text, 0.35), 1, [2, 3]); } }); });
      }
      // 已经出现的竖直线段
      for (let i = 0; i <= k; i++) {
        const e = D.events[i];
        if (this.cyl) {
          const [y0, y1] = [S.box.y0 - 1, S.box.y1 + 1];
          st.line(P(e.x, y0), P(e.x, y1), C.alpha(col.text, 0.25), 1);
          D.ones.filter((o) => o.k === i).forEach((o) => st.line(P(o.x, o.y0), P(o.x, o.y1), col.accent, 2));
        } else {
          if (e.up) st.line(e.v.p, P(e.x, e.yUp), col.accent, 2.2);
          if (e.down) st.line(e.v.p, P(e.x, e.yDown), col.accent, 2.2);
        }
      }
      // 事件编号（像图 6.6 底下的数字）
      D.events.forEach((e, i) => st.text(String(i), P(e.x, S.box.y0), i === k ? col.warn : col.muted, { dy: 12, size: 10.5, weight: i === k ? 700 : 500 }));
      if (k >= 0) {
        const e = D.events[k];
        st.line(P(e.x, S.box.y0 - 0.05), P(e.x, S.box.y1 + 0.05), col.warn, 1.5, [6, 4]);
        st.dot(e.v.p, 6, col.warn, col.surface, 2);
        // 当前 L 中的边加粗
        const nowL = k < D.slabs.length ? D.slabs[k].L : [];
        nowL.forEach((ed) => st.line(ed.a, ed.b, col.warn, 3));
      }
    }
  }

  // ===============================================================
  // 单元分解 + 路线图 + 查询：垂直分解（图 6.3–6.5）/ 三角剖分（图 6.16、6.17）/ 柱形分解（图 6.18、6.19）
  // ===============================================================
  class CellDecomp {
    constructor(root) {
      this.kind = root.dataset.mode || "vertical"; this.key = root.dataset.scene || "fig66"; this.order = "short";
      this.showCells = true; this.showRM = true; this.showPath = true;
      const titles = { vertical: "垂直单元分解 → 路线图 → 查询", triangulation: "三角剖分 → 路线图", cylindrical: "柱形分解：竖线贯穿所有面" };
      const body = C.frame(root, titles[this.kind], "拖动 qI、qG，或拖动障碍的顶点（保持一般位置）");
      this.st = new C.Stage({ aspect: 0.66, maxW: 640, onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => {
          if (this.st.near(p, this.S.qI, 12)) return "qI";
          if (this.st.near(p, this.S.qG, 12)) return "qG";
          return this.drag.onDown(p);
        },
        onMove: (p, d) => {
          if (d === "qI" || d === "qG") { if (this.S.free(p)) { this.S[d] = p; this.query(); this.st.draw(); this.stats(); } return; }
          this.drag.onMove(p, d);
        },
        cursor: (p) => (this.st.near(p, this.S.qI, 12) || this.st.near(p, this.S.qG, 12) || this.drag.hover(p) ? "grab" : null) });
      this.drag = C.vertexDragger(() => this.S, () => this.rebuild(true), () => this.st);
      this.selS = C.select(Object.entries(C.SCENES).map(([k, s]) => [k, s.name]), this.key, (k) => { this.key = k; this.load(); });
      this.selK = C.seg([["vertical", "垂直分解"], ["triangulation", "三角剖分"], ["cylindrical", "柱形分解"]], this.kind, (k) => { this.kind = k; this.syncUI(); this.rebuild(); });
      this.selO = C.seg([["short", "对角线：最短优先"], ["random", "随机顺序"]], this.order, (k) => { this.order = k; this.rebuild(); });
      this.cbC = C.check("单元", true, (v) => { this.showCells = v; this.st.draw(); });
      this.cbR = C.check("路线图", true, (v) => { this.showRM = v; this.st.draw(); });
      this.cbP = C.check("解路径", true, (v) => { this.showPath = v; this.st.draw(); });
      this.stt = { c2: C.stat("2-单元"), c1: C.stat("1-单元"), v: C.stat("路线图顶点 / 边"), chi: C.stat("χ = V − E + F（补充）"), q: C.stat("查询"), x: C.stat("") };
      this.msg = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.selS, this.selK, this.selO),
        h("div", { class: "controls" }, this.cbC, this.cbR, this.cbP, C.button("复原场景", () => this.load(), "small")),
        this.st.wrap,
        h("div", { class: "stats" }, Object.values(this.stt)), this.msg,
        C.legend([[C.cva("accent", 0.3), "2-单元"], [C.cv("accent"), "1-单元 / 路线图"], [C.cv("path"), "解路径"], [C.cva("wall", 0.7), "C_obs（可拖动顶点）"]]));
      this.syncUI(); this.load();
    }
    syncUI() { this.selO.classList.toggle("hidden", this.kind !== "triangulation"); this.selK.set(this.kind); }
    load() { this.S = C.makeScene(this.key); this.st.fitScene(this.S, 0.035); this.rebuild(); }
    rebuild(live) {
      const t0 = performance.now();
      if (this.kind === "triangulation") this.T = C.triangulate(this.S, this.order, 11);
      else this.T = C.decompose(this.S, this.kind === "cylindrical");
      this.ms = performance.now() - t0;
      this.query(); this.stats(); this.st.draw();
    }
    query() {
      const T = this.T, S = this.S;
      const cI = this.kind === "triangulation" ? C.locateTri(T, S.qI) : C.locateCell(T, S.qI);
      const cG = this.kind === "triangulation" ? C.locateTri(T, S.qG) : C.locateCell(T, S.qG);
      this.cI = cI; this.cG = cG;
      this.res = C.cellRoadmapQuery(T, cI, cG, S.qI, S.qG);
    }
    stats() {
      const T = this.T, S = this.S, n2 = T.cells.length, n1 = T.ones.length, ne = T.links.length;
      this.stt.c2.set(n2); this.stt.c1.set(n1); this.stt.v.set(`${n2 + n1} / ${ne}`);
      // 把分解看成 cl(C_free) 上的胞腔复形（例 6.1 的第二种做法）：
      // 垂直 / 柱形分解 V − E + F = 单元数 − 竖直线段数；三角剖分 V − E + F = 三角形数 − 对角线数
      const chi = n2 - n1;
      const dep = S.polys.map((Q, pi) => S.polys.reduce((c, R, pj) => c + (pj !== pi && C.inPoly(Q[0], R) ? 1 : 0), 0));
      const nObs = dep.filter((d) => d === 1).length, nIsl = dep.filter((d) => d === 2).length;
      const chiWant = 1 - nObs + nIsl;
      this.stt.chi.set(`${chi} ${chi === chiWant ? '<span class="yes">✓</span>' : '<span class="no">✗</span>'}`);
      const r = this.res;
      this.stt.q.set(r ? (r.found ? `<span class="yes">有解</span>，长 ${r.len.toFixed(3)}` : '<span class="no">无解</span>') : "qI/qG 不在 C_free 里");
      const k = this.stt.x.querySelector(".k");
      if (this.kind === "triangulation") { k.textContent = "最小内角 / 交叉检查次数"; this.stt.x.set(`${T.minAng.toFixed(1)}° / ${T.checks}`); }
      else { k.textContent = "其中三角形 / 用时"; this.stt.x.set(`${T.cells.filter((c) => c.tri).length} / ${this.ms.toFixed(1)} ms`); }
      // 每个自由连通分量（外边界之内的主区域 + 障碍里的洞）分别有 n + 2h − 2 个三角形、n + 3h − 3 条对角线
      const nMain = S.polys.reduce((c, Q, pi) => c + (dep[pi] <= 1 ? Q.length : 0), 0);
      const isl = S.polys.filter((Q, pi) => dep[pi] === 2).map((Q) => Q.length);
      const triWant = nMain + 2 * nObs - 2 + isl.reduce((c, m) => c + m - 2, 0), diagWant = nMain + 3 * nObs - 3 + isl.reduce((c, m) => c + m - 3, 0);
      const extra = this.kind === "triangulation"
        ? `三角剖分：主区域有 n = ${nMain} 个顶点、h = ${nObs} 个障碍${isl.length ? `，另有 ${isl.length} 个被障碍包住的自由「孤岛」` : ""}。三角形数恒为 n + 2h − 2${isl.length ? "（孤岛另算 m − 2）" : ""} = ${triWant}，对角线数 n + 3h − 3${isl.length ? "（孤岛 m − 3）" : ""} = ${diagWant}，与加对角线的顺序无关；顺序只影响三角形的形状。`
        : this.kind === "cylindrical"
          ? "柱形分解：每个事件处的竖线一路穿过所有面。单元更多，但每个竖条里自下而上是 C_obs、C_free 交替的「一摞」单元——这是推广到任意维的关键（6.4.2 节）。"
          : "垂直分解：每个顶点只向上、向下延伸到最近的边。2-单元都是梯形或三角形（凸），所以单元内的样本点之间可以直接连直线。";
      this.msg.innerHTML = extra + ` <span class="muted">χ 一栏是补充的拓扑检查：把分解看成 cl(C_free) 上的复形，V − E + F 应等于「自由连通分量数 − 洞数」= ${chiWant}。</span>`;
    }
    draw(st, col) {
      const S = this.S, T = this.T;
      st.scene(S, col);
      if (this.kind === "cylindrical") {
        for (const sl of T.slabs) for (const iv of sl.intervals) if (!iv.free) {
          const Q = [P(sl.x0, S.yAt(iv.lo, sl.x0)), P(sl.x1, S.yAt(iv.lo, sl.x1)), P(sl.x1, S.yAt(iv.hi, sl.x1)), P(sl.x0, S.yAt(iv.hi, sl.x0))];
          st.poly(Q, null, C.alpha(col.surface, 0.55), 1, [2, 3]);
        }
        for (const e of T.events) st.line(P(e.x, S.box.y0 - 1), P(e.x, S.box.y1 + 1), C.alpha(col.text, 0.18), 1);
      }
      if (this.showCells) {
        T.cells.forEach((c, i) => {
          const hl = this.res && this.res.found && this.res.seq.includes(i);
          st.poly(c.poly, C.alpha(col.accent, hl ? 0.34 : i % 2 ? 0.1 : 0.18), C.alpha(col.accent, 0.45), 0.8);
        });
        T.ones.forEach((o) => { if (o.a) st.line(o.a, o.b, C.alpha(col.accent, 0.8), 1.4); else st.line(P(o.x, o.y0), P(o.x, o.y1), col.accent, 1.6); });
      }
      if (this.showRM) {
        const n2 = T.cells.length;
        for (const [c, o] of T.links) st.line(T.cells[c].c, T.ones[o].m, C.alpha(col.text, 0.55), 1);
        T.cells.forEach((c) => st.dot(c.c, 2.8, col.text));
        T.ones.forEach((o) => st.dot(o.m, 2.4, col.surface, col.text, 1));
        void n2;
      }
      for (const e of S.edges) st.line(e.a, e.b, col.wall, 1.4);
      for (const v of S.verts) st.dot(v.p, 2.6, col.wall);
      if (this.showPath && this.res && this.res.found) st.path(this.res.pts, col.path, 3.2);
      st.qmark(S.qI, "I", col); st.qmark(S.qG, "G", col);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='roadmap-props']").forEach((el) => el._w = new RoadmapProps(el));
    document.querySelectorAll("[data-widget='dcel']").forEach((el) => el._w = new DCEL(el));
    document.querySelectorAll("[data-widget='vcd-cases']").forEach((el) => el._w = new VCDCases(el));
    document.querySelectorAll("[data-widget='sweep']").forEach((el) => el._w = new Sweep(el));
    document.querySelectorAll("[data-widget='cell-decomp']").forEach((el) => el._w = new CellDecomp(el));
  });
})();
