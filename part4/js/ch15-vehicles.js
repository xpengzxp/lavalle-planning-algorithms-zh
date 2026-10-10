/* 15.3 节：Dubins 曲线、最优词的单元划分与 Dubins / Reeds–Shepp 度量、Reeds–Shepp 曲线、Balkcom–Mason 曲线；
   15.1.3 节：STLC 与递归细分的 plan-and-transform */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH15;
  const PI = Math.PI;

  // 两个位形手柄：拖位置点或朝向点
  function poseHandles(self, keys, len) {
    return {
      pick(p) {
        for (const k of keys) {
          const q = self[k];
          if (C.dist(p, C.headingHandle(q, len)) < 0.22) return { k, mode: "th" };
          if (C.dist(p, q) < 0.25) return { k, mode: "pos", dx: q.x - p.x, dy: q.y - p.y };
        }
        return null;
      },
      move(p, d, bounds) {
        const q = self[d.k];
        if (d.mode === "th") q.th = Math.atan2(p.y - q.y, p.x - q.x);
        else { q.x = C.clamp(p.x + d.dx, bounds[0], bounds[1]); q.y = C.clamp(p.y + d.dy, bounds[2], bounds[3]); }
      },
    };
  }
  function drawPose(st, q, color, label, len, col) {
    const hh = C.headingHandle(q, len);
    st.line(q, hh, color, 1.4, [3, 3]); st.dot(hh, 5, col.surface, color, 2);
    C.drawCar(st, q, color, { size: 0.55, lw: 1.6 });
    st.text(label, q, color, { dx: -14, dy: 16, weight: 700 });
  }
  const DUB_WORDS = ["LSL", "RSR", "LSR", "RSL", "RLR", "LRL"];
  const wordColor = (col, w) => ({ LSL: col.accent, RSR: col.warn, LSR: col.ok, RSL: col.alive2, RLR: col.goal, LRL: col.dead }[w]);

  // ===============================================================
  // 组件 1：Dubins 曲线（式 15.42–15.47，图 15.3、15.4）
  // ===============================================================
  class Dubins {
    constructor(root) {
      this.qI = { x: -2.6, y: -0.6, th: 0.5 }; this.qG = { x: 2.4, y: 0.9, th: -2.2 }; this.rho = 1; this.all = true; this.anim = null;
      const body = C.frame(root, "Dubins 曲线：只能前进的车的最短路", "拖动车身移动位置、拖虚线端点改朝向");
      this.H = poseHandles(this, ["qI", "qG"], 0.95);
      this.st = new C.Stage({ view: [-5, 5, -3.4, 3.4], aspect: 0.68, maxW: 760, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.H.pick(p), onMove: (p, d) => { this.H.move(p, d, [-4.8, 4.8, -3.2, 3.2]); this.update(); },
        cursor: (p) => (this.H.pick(p) ? "grab" : null) });
      this.sR = C.slider("ρ_min =", 0.4, 2, 0.05, this.rho, (v) => { this.rho = v; this.update(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => { this.anim += 0.04; if (this.anim > this.best.len) { this.anim = null; this.st.draw(); return false; } this.st.draw(); return true; });
      this.tbl = h("div", { class: "table-wrap" });
      body.append(h("div", { class: "controls" }, this.sR, C.toggle("显示全部 6 个词", true, (v) => { this.all = v; this.st.draw(); }),
        C.button("▶ 开车", () => { this.anim = 0; this.runner.start(); }, "primary")), this.st.wrap, this.tbl,
        C.legend([[C.cv("path"), "最短的 Dubins 曲线"], [C.cv("muted"), "最小转弯半径圆（起点、终点各两个）"]]));
      this.update();
    }
    update() {
      this.words = C.dubinsWords(this.qI, this.qG, this.rho);
      this.best = C.dubinsBest(this.qI, this.qG, this.rho);
      const fmtA = (v) => (v * 180 / PI).toFixed(0) + "°";
      const rows = DUB_WORDS.map((w) => {
        const p = this.words[w];
        if (!p) return `<tr><td>${w}</td><td colspan="4" class="muted">无解（几何上不可能）</td></tr>`;
        const L = this.rho * (p[0] + p[1] + p[2]), isB = w === this.best.word, ccc = w[1] !== "S";
        const mid = ccc ? `β = ${fmtA(p[1])}${p[1] <= PI + 1e-9 ? " <span class='muted'>(≤ π)</span>" : ""}` : `d = ${(this.rho * p[1]).toFixed(2)}`;
        return `<tr${isB ? " style='background:var(--ok-soft)'" : ""}><td><b style="color:${C.cv("text")}">${w[0]}<sub>α</sub> ${w[1]}<sub>${ccc ? "β" : "d"}</sub> ${w[2]}<sub>γ</sub></b></td><td>α = ${fmtA(p[0])}</td><td>${mid}</td><td>γ = ${fmtA(p[2])}</td><td class="mono">${L.toFixed(3)}${isB ? " ← 最短" : ""}</td></tr>`;
      }).join("");
      this.tbl.innerHTML = `<table class="data"><thead><tr><th>词 (15.45)</th><th>α</th><th>β 或 d</th><th>γ</th><th>长度（= 时间）</th></tr></thead><tbody>${rows}</tbody></table>`;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      const r = this.rho;
      for (const [q, c] of [[this.qI, col.start], [this.qG, col.goal]]) for (const s of [1, -1]) {
        st.circle({ x: q.x - s * r * Math.sin(q.th), y: q.y + s * r * Math.cos(q.th) }, r, C.alpha(c, 0.35), 1, null, [4, 4]);
      }
      if (this.all) for (const w of DUB_WORDS) {
        const p = this.words[w]; if (!p || w === this.best.word) continue;
        const pts = C.samplePath(this.qI, w, p, r, 0.04);
        st.polyline(pts, C.alpha(wordColor(col, w), 0.55), 1.5, [6, 4]);
        const m = pts[Math.floor(pts.length * 0.45)]; st.text(w, m, wordColor(col, w), { size: 11, weight: 650, dy: -8 });
      }
      const b = this.best, pts = C.samplePath(this.qI, b.word, b.segs, r, 0.03);
      st.polyline(pts, col.path, 3.4);
      let q = { ...this.qI };
      for (let i = 0; i < 3; i++) { q = C.stepSeg(q, b.word[i], b.segs[i], r); if (i < 2) st.dot(q, 4, col.surface, col.path, 2); }
      const m = pts[Math.floor(pts.length / 2)]; st.text(b.word, m, col.path, { size: 13, weight: 750, dy: 14 });
      drawPose(st, this.qI, col.start, "q_I", 0.95, col); drawPose(st, this.qG, col.goal, "q_G", 0.95, col);
      if (this.anim !== null) { const a = pts.find((p) => p.s >= this.anim) || pts[pts.length - 1]; C.drawCar(st, a, col.text, { size: 0.55, fill: C.alpha(col.ok, 0.35) }); }
    }
  }

  // ===============================================================
  // 组件 2：最优词的单元（图 15.5）与度量的等值线（图 15.6）
  // ===============================================================
  class DubinsMap {
    constructor(root) {
      this.mode = "cells"; this.th = PI; this.hover = null; this.pick = null; this.freeTh = false;
      const body = C.frame(root, "单元分解与「Dubins 度量」", "鼠标悬停看该点的最优词与长度；点击画出那条曲线");
      this.st = new C.Stage({ view: [-5, 5, -3.6, 3.6], aspect: 0.72, maxW: 760, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onHover: (p) => { this.hover = p; this.showHover(); }, onLeave: () => { this.hover = null; this.showHover(); },
        onDown: (p) => { this.pick = p; this.st.draw(); return null; }, cursor: () => "crosshair" });
      this.modeSel = C.seg([["cells", "最优词（图 15.5）"], ["dub", "Dubins 度量"], ["rs", "Reeds–Shepp 度量"]], this.mode, (k) => { this.mode = k; this.compute(); });
      this.sTh = C.slider("θ =", -180, 180, 5, 180, (v) => { this.th = v * PI / 180; this.compute(); }, (v) => v + "°");
      this.free = C.toggle("θ 任意（对 θ 取最小）", false, (v) => { this.freeTh = v; this.compute(); });
      this.info = h("div", { class: "status-line" });
      this.note = h("p", { class: "small" });
      this.leg = h("div");
      body.append(h("div", { class: "controls" }, this.modeSel, this.sTh, this.free), this.st.wrap, this.info, this.leg, this.note);
      this.compute();
    }
    // 单元图：q_G = (0,0,0) 固定，q_I = (x, y, θ)（书中图 15.5 的设定）；度量图：q_I = (0,0,0)，到 (x, y, θ)
    compute() {
      const view = [-5, 5, -3.6, 3.6], th = this.th;
      this.free.style.display = this.mode === "cells" ? "none" : "";
      if (this.mode === "cells") {
        this.G = C.sampleGrid((x, y) => DUB_WORDS.indexOf(C.dubinsBest({ x, y, th }, { x: 0, y: 0, th: 0 }).word), 251, 183, view);
      } else {
        const f = this.mode === "dub" ? (a, b) => C.dubinsBest(a, b).len : (a, b) => C.rsBest(a, b).len;
        const o = { x: 0, y: 0, th: 0 };
        const val = this.freeTh
          ? (x, y) => { let m = Infinity; for (let k = 0; k < 48; k++) m = Math.min(m, f(o, { x, y, th: -PI + C.TAU * k / 48 })); return m; }
          : (x, y) => f(o, { x, y, th });
        this.G = C.sampleGrid(val, this.freeTh ? 141 : 201, this.freeTh ? 103 : 147, view);
        // 标出相邻格点的跳变（不连续）
        const { nx, ny, v } = this.G, J = new Uint8Array(nx * ny), cell = 10 / (nx - 1), lim = this.freeTh ? 0.6 : 0.5;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const a = v[j * nx + i];
          if (i + 1 < nx && Math.abs(a - v[j * nx + i + 1]) > lim + 3 * cell) J[j * nx + i] = 1;
          if (j + 1 < ny && Math.abs(a - v[(j + 1) * nx + i]) > lim + 3 * cell) J[j * nx + i] = 1;
        }
        this.J = J;
      }
      this.leg.innerHTML = "";
      if (this.mode === "cells") this.leg.append(C.legend(DUB_WORDS.map((w) => [`var(${{ LSL: "--accent", RSR: "--warn", LSR: "--ok", RSL: "--c-alive2", RLR: "--c-goal", LRL: "--c-dead" }[w]})`, w])));
      else this.leg.append(C.legend([[C.cv("accent"), "长度由小到大（蓝色由浅到深）"], [C.cv("text2"), "等值线（间隔 0.5）"], [C.cv("bad"), "相邻格点跳变 > 0.5：不连续"]]));
      this.note.innerHTML = this.mode === "cells"
        ? "设定与书中一致：q_G = (0, 0, 0)，按 q_I = (x, y, θ) 着色。θ = 180° 时就是图 15.5：上方 LSL、下方 RSR，中间一带左右是 LSR / RSL，圆内上半 RLR、下半 LRL（参考代码第 8 项打印了同一张图）。拖 θ 看单元的形状怎么变——这正是「已知单元边界，直接查出该用哪个词」的 LPM 思路。"
        : this.mode === "dub"
          ? "从 q_I = (0, 0, 0) 出发到 (x, y, θ) 的最短长度，也就是代价到达 G*。红色是数值上的跳变：Dubins 车不是 STLC，度量在某些曲线上不连续（例：到 (1, −1, −90°) 只要 π/2，旁边 (0.99, −1, −90°) 却要 7.84，参考代码第 8 项）。打开「θ 任意」时，跳变集中在起点的两个转弯圆上，像图 15.6 那样。"
          : "Reeds–Shepp 车是 STLC，度量是连续的：没有红色的跳变（与 Dubins 对比）。它也是对称的：ρ(q, q′) = ρ(q′, q)。";
      this.st.draw(); this.showHover();
    }
    showHover() {
      const p = this.hover;
      if (!p) { this.info.innerHTML = "&nbsp;"; return; }
      if (this.mode === "cells") { const b = C.dubinsBest({ x: p.x, y: p.y, th: this.th }, { x: 0, y: 0, th: 0 }); this.info.innerHTML = `q_I = (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${(this.th * 180 / PI).toFixed(0)}°)：最优词 <b>${b.word}</b>，长度 ${b.len.toFixed(3)}`; }
      else { const f = this.mode === "dub" ? C.dubinsBest : C.rsBest, b = f({ x: 0, y: 0, th: 0 }, { x: p.x, y: p.y, th: this.th }); this.info.innerHTML = `到 (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${(this.th * 180 / PI).toFixed(0)}°)：${this.mode === "rs" ? C.bookWord(b.word, b.segs) : b.word}，长度 ${b.len.toFixed(3)}`; }
    }
    draw(ctx, st, col) {
      st.frame(col);
      if (this.mode === "cells") {
        const cs = DUB_WORDS.map((w) => C.mixRGB(col.surface, wordColor(col, w), 0.45));
        C.drawHeat(st, this.G, (v) => [...cs[v], 255]);
        st.grid(col, 1);
        if (Math.abs(Math.abs(this.th) - PI) < 1e-6) { st.circle({ x: 0, y: 0 }, 2, col.text2, 1.4, null, [5, 4]); for (const y of [-2, 2]) st.line({ x: -5, y }, { x: 5, y }, col.text2, 1, [5, 4]); }
      } else {
        const lo = C.rgb(col.surface), hi = C.rgb(col.accent);
        C.drawHeat(st, this.G, (v) => { const t = Math.min(1, v / 12) * 0.7; return [0, 1, 2].map((i) => Math.round(lo[i] + (hi[i] - lo[i]) * t)).concat([255]); });
        const levels = []; for (let v = 0.5; v < 14; v += 0.5) levels.push(v);
        C.drawContours(st, this.G, levels, C.alpha(col.text2, 0.55), 0.9, true);
        const { nx, ny, view } = this.G, [x0, x1, y0, y1] = view;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (this.J[j * nx + i]) st.dot({ x: x0 + (x1 - x0) * i / (nx - 1), y: y0 + (y1 - y0) * j / (ny - 1) }, 1.4, col.bad);
        st.grid(col, 1);
      }
      const o = { x: 0, y: 0, th: 0 };
      C.drawCar(st, o, this.mode === "cells" ? col.goal : col.start, { size: 0.5 });
      if (this.pick) {
        const p = this.pick;
        if (this.mode === "cells") {
          const q = { x: p.x, y: p.y, th: this.th }, b = C.dubinsBest(q, o);
          st.polyline(C.samplePath(q, b.word, b.segs, 1, 0.03), col.text, 2.4); C.drawCar(st, q, col.start, { size: 0.5 });
        } else {
          const q = { x: p.x, y: p.y, th: this.th }, b = this.mode === "dub" ? C.dubinsBest(o, q) : C.rsBest(o, q);
          const pts = C.samplePath(o, b.word, b.segs, 1, 0.03);
          for (let k = 1; k < pts.length; k++) st.line(pts[k - 1], pts[k], pts[k].dir > 0 ? col.text : col.warn, 2.4);
          C.drawCar(st, q, col.goal, { size: 0.5 });
        }
      }
    }
  }

  // ===============================================================
  // 组件 3：Reeds–Shepp 曲线（式 15.48、15.49，图 15.7–15.10）
  // ===============================================================
  const FIG1510 = [["C|C|C", 4], ["CC|C", 4], ["C|CC", 4], ["CSC", 8], ["CCβ|CβC", 4], ["C|CβCβ|C", 4], ["C|Cπ/2SC", 8], ["CSCπ/2|C", 8], ["C|Cπ/2SCπ/2|C", 4]];
  class ReedsShepp {
    constructor(root) {
      this.qI = { x: -1.2, y: -0.5, th: 0 }; this.qG = { x: 0.2, y: 0.6, th: 0.15 }; this.rho = 1; this.sel = 0; this.anim = null;
      const body = C.frame(root, "Reeds–Shepp 曲线：可以倒车的车的最短路", "拖动车身移动位置、拖虚线端点改朝向；点表格里的一行看别的候选");
      this.H = poseHandles(this, ["qI", "qG"], 0.95);
      this.st = new C.Stage({ view: [-4.2, 4.2, -2.8, 2.8], aspect: 0.66, maxW: 760, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => this.H.pick(p), onMove: (p, d) => { this.H.move(p, d, [-4, 4, -2.6, 2.6]); this.sel = 0; this.update(); },
        cursor: (p) => (this.H.pick(p) ? "grab" : null) });
      this.sR = C.slider("ρ_min =", 0.4, 1.6, 0.05, this.rho, (v) => { this.rho = v; this.sel = 0; this.update(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(() => { this.anim += 0.03; const L = this.cands[this.sel].len; if (this.anim > L) { this.anim = null; this.st.draw(); return false; } this.st.draw(); return true; });
      this.stats = [C.stat("最短 RS 长度"), C.stat("同样两点的 Dubins 长度"), C.stat("换挡（尖点）次数"), C.stat("可行候选数")];
      this.wordEl = h("div", { class: "msg info" });
      this.tbl = h("div", { class: "table-wrap", style: "max-height:260px;overflow:auto" });
      this.fam = h("div", { class: "chips" });
      body.append(h("div", { class: "controls" }, this.sR, C.button("▶ 开车", () => { this.anim = 0; this.runner.start(); }, "primary"),
        C.button("平行泊车", () => { this.qI = { x: -0.5, y: -0.4, th: 0 }; this.qG = { x: -0.5, y: 0.4, th: 0 }; this.sel = 0; this.update(); }),
        C.button("原地掉头", () => { this.qI = { x: 0, y: 0, th: 0 }; this.qG = { x: 0, y: 0, th: PI }; this.sel = 0; this.update(); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.wordEl,
        h("div", { class: "small muted", style: "margin:6px 0 4px" }, "图 15.10 的 9 个基本词（括号里是展开成的词数，共 48）；高亮的是当前所选曲线所属的那一类："), this.fam,
        h("div", { class: "small muted", style: "margin:8px 0 4px" }, "本次查询所有可行的候选（按长度排序；同一个词可能因为三种对称变换出现多次）："), this.tbl,
        C.legend([[C.cv("accent"), "前进段（+）"], [C.cv("warn"), "倒车段（−）"], [C.cv("bad"), "换挡点 |"]]));
      this.update();
    }
    update() {
      this.cands = C.rsCandidates(this.qI, this.qG, this.rho);
      const best = this.cands[0], cur = this.cands[this.sel], db = C.dubinsBest(this.qI, this.qG, this.rho);
      const cusps = (c) => { let n = 0, last = 0; for (const v of c.segs) { if (Math.abs(v) < 1e-9) continue; const s = Math.sign(v); if (last && s !== last) n++; last = s; } return n; };
      this.stats[0].set(best.len.toFixed(3)); this.stats[1].set(db.len.toFixed(3)); this.stats[2].set(cusps(cur)); this.stats[3].set(this.cands.length);
      const fam = C.rsBase(cur.word, cur.segs);
      this.wordEl.innerHTML = `${this.sel === 0 ? "最短" : "所选"}：<b>${C.bookWord(cur.word, cur.segs, true)}</b>（基本词 ${fam}），长度 ${cur.len.toFixed(3)}。` +
        "记号同图 15.8：上标 + / − 是前进 / 倒车挡；L⁻ 表示方向盘向左打、但在倒车（车身顺时针转）。";
      this.fam.innerHTML = "";
      for (const [f, n] of FIG1510) this.fam.append(h("span", { class: "chip" + (f === fam ? " on" : "") }, `${f} (${n})`));
      const seen = new Set();
      this.tbl.innerHTML = "";
      const tb = h("tbody");
      this.cands.forEach((c, i) => {
        const key = C.bookWord(c.word, c.segs, true) + c.len.toFixed(6); if (seen.has(key)) return; seen.add(key);
        const tr = h("tr", { style: "cursor:pointer" + (i === this.sel ? ";background:var(--accent-soft)" : "") },
          h("td", { html: C.bookWord(c.word, c.segs, true) }), h("td", null, C.rsBase(c.word, c.segs)), h("td", { class: "mono" }, c.len.toFixed(3) + (i === 0 ? " ← 最短" : "")));
        tr.addEventListener("click", () => { this.sel = i; this.update(); });
        tb.append(tr);
      });
      this.tbl.append(h("table", { class: "data" }, h("thead", null, h("tr", null, h("th", null, "词"), h("th", null, "基本词"), h("th", null, "长度"))), tb));
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      const c = this.cands[this.sel], pts = C.samplePath(this.qI, c.word, c.segs, this.rho, 0.025);
      if (this.sel !== 0) { const b = this.cands[0]; st.polyline(C.samplePath(this.qI, b.word, b.segs, this.rho, 0.03), C.alpha(col.path, 0.5), 2, [6, 4]); }
      for (let k = 1; k < pts.length; k++) st.line(pts[k - 1], pts[k], pts[k].dir > 0 ? col.accent : col.warn, 3.2);
      let q = { ...this.qI }, last = 0;
      for (let i = 0; i < c.word.length; i++) {
        const v = c.segs[i]; if (Math.abs(v) < 1e-9) continue;
        const s = Math.sign(v); if (last && s !== last) { st.dot(q, 5.5, col.bad, col.surface, 1.5); }
        else if (last) st.dot(q, 3.5, col.surface, col.text2, 1.5);
        last = s; q = C.stepSeg(q, c.word[i], v, this.rho);
      }
      drawPose(st, this.qI, col.start, "q_I", 0.95, col); drawPose(st, this.qG, col.goal, "q_G", 0.95, col);
      if (this.anim !== null) { const a = pts.find((p) => p.s >= this.anim) || pts[pts.length - 1]; C.drawCar(st, a, col.text, { size: 0.55, fill: C.alpha(a.dir > 0 ? col.accent : col.warn, 0.35) }); }
    }
  }

  // ===============================================================
  // 组件 4：Balkcom–Mason 曲线（式 15.50、15.51，图 15.11–15.13）
  // ===============================================================
  const BM_BASE = ["↷", "⇓", "⇓↷", "↷⇓↷", "⇑↶π⇓", "↶⇓↷", "⇓↷⇑", "↶⇓↷⇑", "⇑↶⇓↷⇑"];
  const BM_PRINTED7 = "⇓↷↷";
  const tok = (w) => { const t = []; for (let i = 0; i < w.length; i++) { if (w[i + 1] === "π") { t.push(w[i] + "π"); i++; } else t.push(w[i]); } return t; };
  const T1 = (t) => t.map((x) => x.replace("⇑", "#").replace("⇓", "⇑").replace("#", "⇓"));
  const T2 = (t) => t.slice().reverse();
  const T3 = (t) => t.map((x) => x.replace("↶", "#").replace("↷", "↶").replace("#", "↷"));
  const COMBOS = [["Base", (t) => t], ["T₁", T1], ["T₂", T2], ["T₃", T3], ["T₂∘T₁", (t) => T2(T1(t))], ["T₃∘T₁", (t) => T3(T1(t))], ["T₃∘T₂", (t) => T3(T2(t))], ["T₃∘T₂∘T₁", (t) => T3(T2(T1(t)))]];
  class BalkcomMason {
    constructor(root) {
      this.row = 7; this.col = 0; this.printed = false; this.trans = 1.2; this.rot = 0.9;
      const body = C.frame(root, "Balkcom–Mason 曲线：差速驱动的时间最优", "点表格中的一格，让机器人执行那个词");
      this.st = new C.Stage({ view: [-3.2, 3.2, -2.2, 2.2], aspect: 0.62, maxW: 680, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.tbl = h("div", { class: "table-wrap" });
      this.sT = C.slider("每段平移时长", 0.2, 2, 0.05, this.trans, (v) => { this.trans = v; this.st.draw(); this.info(); }, (v) => v.toFixed(2));
      this.sRot = C.slider("每段旋转时长", 0.1, 2, 0.05, this.rot, (v) => { this.rot = v; this.st.draw(); this.info(); }, (v) => v.toFixed(2));
      this.pr = C.toggle("G 行改用 (15.51) 原样印的 ⇓↷↷", false, (v) => { this.printed = v; this.build(); });
      this.stats = [C.stat("词"), C.stat("总时间 = (15.50) 的代价"), C.stat("这一行不同的词数"), C.stat("全表不同的词数")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sT, this.sRot, this.pr), this.tbl, h("div", { class: "stats" }, this.stats), this.st.wrap, this.note,
        C.legend([[C.cv("accent"), "⇑ 前进 / ⇓ 后退（轴中心走直线）"], [C.cv("warn"), "↶ 逆时针 / ↷ 顺时针原地转"], [C.cv("muted"), "机器人轮廓（每段结束时）"]]));
      this.build();
    }
    base(r) { return r === 6 && this.printed ? BM_PRINTED7 : BM_BASE[r]; }
    build() {
      const all = new Set(); this.cells = [];
      const tb = h("tbody");
      BM_BASE.forEach((_, r) => {
        const tr = h("tr", null, h("td", null, "ABCDEFGHI"[r] + "."));
        const row = COMBOS.map(([, f]) => f(tok(this.base(r))).join(""));
        row.forEach((w, c) => {
          all.add(w);
          const td = h("td", { class: "c", style: "cursor:pointer;font-size:15px;white-space:nowrap" + (r === this.row && c === this.col ? ";background:var(--accent-soft);outline:2px solid var(--accent)" : "") }, w);
          td.addEventListener("click", () => { this.row = r; this.col = c; this.build(); });
          tr.append(td);
        });
        tb.append(tr); this.cells.push(row);
      });
      this.tbl.innerHTML = "";
      this.tbl.append(h("table", { class: "data" }, h("thead", null, h("tr", null, h("th", null, ""), COMBOS.map(([n]) => h("th", { class: "c" }, n)))), tb));
      this.allCount = all.size;
      this.info(); this.st.draw();
    }
    word() { return tok(this.cells[this.row][this.col]); }
    durations() { return this.word().map((p) => (p.endsWith("π") ? PI : p[0] === "⇑" || p[0] === "⇓" ? this.trans : this.rot)); }
    info() {
      const w = this.word(), d = this.durations(), rowSet = new Set(this.cells[this.row]);
      const dup = w.some((p, i) => i > 0 && p === w[i - 1]);
      this.stats[0].set(w.join("")); this.stats[1].set(d.reduce((a, b) => a + b, 0).toFixed(2));
      this.stats[2].set(rowSet.size); this.stats[3].set(this.allCount);
      this.note.innerHTML = (dup ? "<span class='no'>这个词里有两个相同的原语相邻——同向的原地转连着做就是一段更长的原地转，不会作为两个原语出现。这说明 (15.51) 第 7 个词印错了，应为 ⇓↷⇑（与图 15.13 的 G 行一致）。</span> " : "") +
        "差速驱动 (13.16) 取 r = 1、半轴距 1（两轮间距 L = 2）：⇑⇓ 时轴中心速度为 1，↶↷ 时角速度为 1，于是 (15.50) 的被积函数 |v| + |θ̇| 在四个原语上都等于 1，代价恰好是时间。" +
        " T₁ 交换 ⇑ 与 ⇓，T₂ 倒转顺序，T₃ 交换 ↶ 与 ↷；三者可交换，合起来 8 种组合，图 15.13 的 72 格去重后是 40 种（参考代码第 10 项）。";
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      const w = this.word(), d = this.durations();
      // 先算出总位移，把路径平移到画面中心
      let q = { x: 0, y: 0, th: PI / 2 }; const segs = [], poses = [q];
      for (let i = 0; i < w.length; i++) {
        const p = w[i][0], q0 = q;
        if (p === "⇑" || p === "⇓") { const s = p === "⇑" ? 1 : -1; q = { x: q.x + s * d[i] * Math.cos(q.th), y: q.y + s * d[i] * Math.sin(q.th), th: q.th }; segs.push(["T", q0, q]); }
        else { const s = p === "↶" ? 1 : -1; q = { ...q, th: q.th + s * d[i] }; segs.push(["R", q0, q, s]); }
        poses.push(q);
      }
      const xs = poses.map((p) => p.x), ys = poses.map((p) => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const sh = (p) => ({ x: p.x - cx, y: p.y - cy, th: p.th });
      poses.forEach((p, i) => C.drawDiff(st, sh(p), i === 0 ? col.start : i === poses.length - 1 ? col.goal : col.muted, { size: 0.55, alpha: i === 0 || i === poses.length - 1 ? 1 : 0.55 }));
      for (const s of segs) {
        if (s[0] === "T") st.arrow(sh(s[1]), sh(s[2]), col.accent, 3, 10);
        else {
          const c = sh(s[1]), a0 = s[1].th, a1 = s[2].th, R = 0.45, P = [];
          for (let k = 0; k <= 30; k++) { const a = a0 + (a1 - a0) * k / 30; P.push({ x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) }); }
          st.polyline(P, col.warn, 2.6); st.arrow(P[P.length - 2], P[P.length - 1], col.warn, 2.6, 9);
        }
      }
      st.text("起点", sh(poses[0]), col.start, { dy: 26, weight: 650 });
    }
  }

  // ===============================================================
  // 组件 5：STLC 与递归细分（15.1.3 节，plan-and-transform 见 14.6.2 节）
  // ===============================================================
  // 原路径 x̃：一条折线，拐角处原地转向；它被一根半径为 ε 的无碰撞「管子」保护着（书中 15.1.3 节的设定）
  const PT_PATH = [{ x: -4.3, y: -1.7 }, { x: -2.4, y: -1.7 }, { x: -2.4, y: 1.5 }, { x: -0.2, y: 1.5 }, { x: -0.2, y: -1.5 }, { x: 2.2, y: -1.5 }, { x: 2.2, y: 1.7 }, { x: 4.3, y: 1.7 }];
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    const t = L > 0 ? C.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L, 0, 1) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  class PlanTransform {
    constructor(root) {
      this.lpm = "rs"; this.rho = 0.6; this.maxDepth = 6; this.eps = 0.35;
      const body = C.frame(root, "STLC 的用处：把一条「不满足微分约束」的路径逐段替换", "原路径（灰虚线）在拐角处原地转向；用 LPM 替换整段，出了管子就二分");
      this.st = new C.Stage({ view: [-5, 5, -2.7, 2.7], aspect: 0.54, maxW: 760, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sel = C.seg([["rs", "LPM = Reeds–Shepp（STLC）"], ["dub", "LPM = Dubins（非 STLC）"]], this.lpm, (k) => { this.lpm = k; this.run(); });
      this.sR = C.slider("ρ_min =", 0.2, 1.2, 0.05, this.rho, (v) => { this.rho = v; this.run(); }, (v) => v.toFixed(2));
      this.sE = C.slider("管子半径 ε =", 0.15, 1, 0.05, this.eps, (v) => { this.eps = v; this.run(); }, (v) => v.toFixed(2));
      this.sD = C.slider("最大细分层数", 0, 10, 1, this.maxDepth, (v) => { this.maxDepth = v; this.run(); }, (v) => String(v));
      this.stats = [C.stat("结果"), C.stat("被接受的 LPM 段数"), C.stat("用到的最深层数"), C.stat("换挡次数"), C.stat("总长度")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sel, this.sR), h("div", { class: "controls" }, this.sE, this.sD), this.st.wrap, h("div", { class: "stats" }, this.stats), this.note,
        C.legend([[C.cv("muted"), "原路径 x̃（无碰撞，但车做不到原地转）"], [C.cv("surface3"), "半径 ε 的无碰撞管子（外面都是障碍）"], [C.cv("accent"), "接受的 LPM 段（前进）"], [C.cv("warn"), "倒车"], [C.cv("bad"), "层数用完仍出管子的段"]]));
      this.buildPath(); this.run();
    }
    // 参数化：沿折线走，拐角处原地转向（θ 连续变化）；路程按「长度 + 转过的弧度」计
    buildPath() {
      const P = PT_PATH, keys = []; let s = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const th = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x);
        if (i > 0) { const prev = keys[keys.length - 1]; const d = C.wrap(th - prev.th); s += Math.abs(d); keys.push({ s, x: P[i].x, y: P[i].y, th: prev.th + d }); }
        else keys.push({ s, x: P[i].x, y: P[i].y, th });
        s += Math.hypot(P[i + 1].x - P[i].x, P[i + 1].y - P[i].y);
        keys.push({ s, x: P[i + 1].x, y: P[i + 1].y, th: keys[keys.length - 1].th });
      }
      this.keys = keys; this.S = s;
    }
    at(s) {
      const K = this.keys; let i = 0; while (i < K.length - 2 && K[i + 1].s < s) i++;
      const a = K[i], b = K[i + 1], t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, th: a.th + (b.th - a.th) * t };
    }
    free(p) { let d = Infinity; for (let i = 0; i < PT_PATH.length - 1; i++) d = Math.min(d, segDist(p, PT_PATH[i], PT_PATH[i + 1])); return d < this.eps; }
    lpmPath(a, b) { return this.lpm === "rs" ? C.rsBest(a, b, this.rho) : C.dubinsBest(a, b, this.rho); }
    run() {
      this.acc = []; this.bad = []; this.depthUsed = 0; let total = 0, cusps = 0;
      const rec = (s0, s1, d) => {
        const a = this.at(s0), b = this.at(s1), c = this.lpmPath(a, b), pts = C.samplePath(a, c.word, c.segs, this.rho, 0.02);
        if (pts.every((p) => this.free(p))) {
          this.acc.push(pts); total += c.len; this.depthUsed = Math.max(this.depthUsed, d);
          let last = 0; for (const v of c.segs) { if (Math.abs(v) < 1e-9) continue; if (last && Math.sign(v) !== last) cusps++; last = Math.sign(v); }
          return true;
        }
        if (d >= this.maxDepth) { this.bad.push(pts); return false; }
        const m = (s0 + s1) / 2; const r1 = rec(s0, m, d + 1), r2 = rec(m, s1, d + 1); return r1 && r2;
      };
      this.ok = rec(0, this.S, 0);
      this.stats[0].set(this.ok ? "<span class='yes'>成功</span>" : "<span class='no'>失败</span>");
      this.stats[1].set(this.acc.length); this.stats[2].set(this.depthUsed); this.stats[3].set(cusps); this.stats[4].set(this.ok ? total.toFixed(2) : "–");
      this.note.innerHTML = this.lpm === "rs"
        ? "Reeds–Shepp 车是 STLC：区间越短，两端位形越近，最短 RS 曲线就越短、离原路径越近（书中 15.1.3 节的理由：时间区间小，来不及偏离太远）。所以只要细分得够深，每一段最终都待在管子里——拐角处的原地转向被替换成几次小的前后挪动。把「最大细分层数」从 0 慢慢调大、或把 ε 调小，看需要的层数怎么变。"
        : "Dubins 车不是 STLC：即使两端位形非常接近（比如拐角处只差一点朝向），最短 Dubins 曲线也要绕一个半径 ρ 的圈，ρ 比管子宽时必然出界。细分再深也救不回来——这就是 STLC 对「有障碍的规划」重要的原因。把 ρ 调到比 ε 小很多，Dubins 才可能在拐角处绕圈通过。";
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col, C.alpha(col.wall, 0.75));
      ctx.save(); ctx.beginPath(); PT_PATH.forEach((p, i) => (i ? ctx.lineTo(st.X(p.x), st.Y(p.y)) : ctx.moveTo(st.X(p.x), st.Y(p.y))));
      ctx.strokeStyle = col.surface; ctx.lineWidth = 2 * this.eps * st.sx; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); ctx.restore();
      st.polyline(PT_PATH, col.muted, 2, [6, 5]);
      for (const pts of this.bad) st.polyline(pts, C.alpha(col.bad, 0.85), 1.8);
      for (const pts of this.acc) for (let k = 1; k < pts.length; k++) st.line(pts[k - 1], pts[k], pts[k].dir > 0 ? col.accent : col.warn, 2.4);
      for (const pts of this.acc) st.dot(pts[0], 2.2, col.text2);
      C.drawCar(st, this.at(0), col.start, { size: 0.4 }); C.drawCar(st, this.at(this.S), col.goal, { size: 0.4 });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='dubins']").forEach((el) => (el._w = new Dubins(el)));
    document.querySelectorAll("[data-widget='dubins-map']").forEach((el) => (el._w = new DubinsMap(el)));
    document.querySelectorAll("[data-widget='reeds-shepp']").forEach((el) => (el._w = new ReedsShepp(el)));
    document.querySelectorAll("[data-widget='balkcom-mason']").forEach((el) => (el._w = new BalkcomMason(el)));
    document.querySelectorAll("[data-widget='plan-transform']").forEach((el) => (el._w = new PlanTransform(el)));
  });
})();
