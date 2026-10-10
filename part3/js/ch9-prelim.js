/* 9.1 节：Pareto 最优、两颗骰子的事件实验室、贝叶斯马赛克、随机化策略与猜硬币 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH9;

  // ---------------------------------------------------------------
  // 组件：Pareto 最优（例 9.1、9.2、9.3、习题 1）
  // ---------------------------------------------------------------
  const TURNPIKE_MILES = 360;  // 补充假设：宾夕法尼亚收费公路约 360 英里；Pareto 集与这个数无关
  const fine = (s) => (s <= 55 ? 0 : s <= 65 ? 50 : s <= 75 ? 100 : s <= 85 ? 200 : 500);

  class Pareto {
    constructor(root) {
      this.mode = "ex91";
      this.pts91 = [[4, 0], [3, 3], [2, 2], [5, 7], [9, 0]];
      this.sel = 1; this.speed = 56; this.u3 = 0.35; this.u1 = 3;
      const body = C.frame(root, "Pareto 最优", "每个动作 u 是平面上的一个代价点 L(u) = (L₁, L₂)；越往左下越好");
      this.sw = C.seg([["ex91", "例 9.1（可拖动）"], ["tp", "例 9.2 收费公路"], ["cont", "例 9.3 连续"], ["ex1", "习题 1"]], this.mode, (k) => this.setMode(k));
      this.plot = new C.Plot({ aspect: 0.72, maxW: 520, onDraw: (ctx, pl, col) => this.draw(ctx, pl, col),
        onDown: (p) => this.down(p), onMove: (p, d) => this.move(p, d), cursor: (p) => (this.hit(p) >= 0 ? "grab" : null) });
      this.sl = h("div", { class: "controls", style: "margin:8px 0 0" });
      this.info = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sw),
        h("div", { class: "split" }, h("div", null, this.plot.wrap, this.sl),
          h("div", null, this.info, C.legend([[C.cv("best"), "Pareto 最优", true], [C.cv("worst"), "被支配", true],
            [C.cva("best", 0.25), "能支配选中点的区域"], [C.cva("worst", 0.18), "选中点支配的区域"]]))));
      this.setMode("ex91");
    }
    setMode(k) {
      this.mode = k;
      this.sl.innerHTML = "";
      if (k === "ex91") { this.plot.setRange([0, 10], [-0.5, 8]); this.sl.append(h("span", { class: "small muted" }, "拖动任一点（自动取整）；点一下选中它。")); }
      if (k === "tp") {
        this.plot.setRange([3.3, 7.4], [-40, 560]);
        this.sl.append(C.slider("车速", 50, 100, 1, this.speed, (v) => { this.speed = v; this.update(); }, (v) => v + " mph"));
      }
      if (k === "cont") { this.plot.setRange([-0.1, 1.15], [-0.1, 1.15]); this.sl.append(C.slider("u =", 0, 1, 0.01, this.u3, (v) => { this.u3 = v; this.update(); }, (v) => v.toFixed(2))); }
      if (k === "ex1") { this.plot.setRange([-5, 105], [-12, 10]); this.sl.append(C.slider("u =", -10, 10, 0.1, this.u1, (v) => { this.u1 = v; this.update(); }, (v) => v.toFixed(1))); }
      this.update();
    }
    // 当前模式下的全部点（离散）或曲线（连续）
    points() {
      if (this.mode === "ex91") return this.pts91.map((c, i) => ({ x: c[0], y: c[1], lab: "u=" + (i + 1) }));
      if (this.mode === "tp") { const out = []; for (let s = 50; s <= 100; s++) out.push({ x: TURNPIKE_MILES / s, y: fine(s), lab: s + "", s }); return out; }
      return [];
    }
    selected() {
      if (this.mode === "ex91") { const c = this.pts91[this.sel]; return { x: c[0], y: c[1] }; }
      if (this.mode === "tp") return { x: TURNPIKE_MILES / this.speed, y: fine(this.speed) };
      if (this.mode === "cont") return { x: this.u3, y: 1 - this.u3 };
      return { x: this.u1 * this.u1, y: this.u1 - 1 };
    }
    hit(p) {
      if (this.mode !== "ex91" || !this.plot.ctx) return -1;
      const P = this.points();
      for (let i = 0; i < P.length; i++) if (this.plot.pxDist(p, P[i]) < 11) return i;
      return -1;
    }
    down(p) { const i = this.hit(p); if (i >= 0) { this.sel = i; this.update(); return { i }; } return null; }
    move(p, d) {
      this.pts91[d.i] = [Math.max(0, Math.min(10, Math.round(p.x))), Math.max(0, Math.min(8, Math.round(p.y)))];
      this.update();
    }
    update() {
      const P = this.points();
      this.dom = P.map((a) => P.filter((b) => b !== a && C.dominates([b.x, b.y], [a.x, a.y])));
      const info = this.info;
      if (this.mode === "ex91") {
        const rows = this.pts91.map((c, i) => {
          const by = this.dom[i].map((b) => b.lab.replace("u=", "")).join("、");
          return h("tr", { class: i === this.sel ? "sel" : "" }, h("td", null, "u = " + (i + 1)), h("td", { class: "mono" }, `(${c[0]}, ${c[1]})`),
            h("td", { class: by ? "no" : "yes" }, by ? "被 u = " + by + " 支配" : "Pareto 最优"));
        });
        info.innerHTML = "";
        info.append(h("div", { class: "table-wrap", style: "margin:0 0 8px" }, h("table", { class: "data" }, h("tr", null, h("th", null, "动作"), h("th", null, "L(u)"), h("th", null, "结论")), rows)),
          h("p", { style: "margin:0" }, "Pareto 最优集合：", h("b", null, "{" + P.filter((_, i) => !this.dom[i].length).map((p) => p.lab.replace("u=", "")).join(", ") + "}"),
            "。书中的数据：L(1) = (4,0)，L(2) = (3,3)，L(3) = (2,2)，L(4) = (5,7)，L(5) = (9,0)，答案是 {1, 3}。"));
      } else if (this.mode === "tp") {
        const i = this.speed - 50, by = this.dom[i].map((b) => b.s);
        const ranges = [];
        by.forEach((s) => { const r = ranges[ranges.length - 1]; if (r && r[1] === s - 1) r[1] = s; else ranges.push([s, s]); });
        const pareto = P.filter((_, k) => !this.dom[k].length).map((p) => p.s);
        info.innerHTML = `<p style="margin:0 0 6px"><b>${this.speed} mph</b>：用时 ${(TURNPIKE_MILES / this.speed).toFixed(2)} 小时，罚款 $${fine(this.speed)}。</p>` +
          (by.length ? `<p class="no" style="margin:0 0 6px">被 ${ranges.map((r) => (r[0] === r[1] ? r[0] : r[0] + "–" + r[1])).join("、")} mph 支配：罚款不多于它，时间更短。</p>`
            : `<p class="yes" style="margin:0 0 6px">Pareto 最优：想更快就得多交罚款。</p>`) +
          `<p style="margin:0 0 6px">Pareto 最优车速：<b>${pareto.join(", ")}</b>（书中答案 55, 65, 75, 85, 100）。每个罚款档里只有最快的那个速度留下来。</p>` +
          `<p class="muted" style="margin:0">补充：书中没给公路长度，这里假设约 ${TURNPIKE_MILES} 英里；换成别的长度，横轴伸缩，Pareto 集不变。</p>`;
      } else if (this.mode === "cont") {
        info.innerHTML = `<p style="margin:0 0 6px">L(u) = (u, 1 − u) = (${this.u3.toFixed(2)}, ${(1 - this.u3).toFixed(2)})。</p>` +
          `<p style="margin:0 0 6px">绿色区域（能支配它的点）里没有任何别的代价点：想让 L₁ 变小，L₂ 就一定变大。所以 <b>[0, 1] 中每个 u 都是 Pareto 最优</b>，两两不可比——Pareto 最优「什么都没筛掉」。</p>`;
      } else {
        const u = this.u1, ok = u <= 1e-9;
        info.innerHTML = `<p style="margin:0 0 6px">u = ${u.toFixed(1)}：L(u) = (u², u − 1) = (${(u * u).toFixed(2)}, ${(u - 1).toFixed(2)})。</p>` +
          (ok ? `<p class="yes" style="margin:0 0 6px">Pareto 最优：再往左（u 变小）L₂ 变小但 L₁ 变大；往右则 L₁ 变小、L₂ 变大。</p>`
            : `<p class="no" style="margin:0 0 6px">被支配：例如 u = 0 给出 (0, −1)，两个分量都不比它差（u = −${u.toFixed(1)} 的 L₁ 相同而 L₂ 更小，也支配它）。</p>`) +
          `<p class="muted" style="margin:0">习题 1 的答案就在图上：曲线的绿色部分对应哪些 u？</p>`;
      }
      this.plot.draw();
    }
    cones(pl, col, c) {
      const [x0, x1] = pl.o.x, [y0, y1] = pl.o.y;
      pl.clip(() => {
        pl.rect(x0, y0, c.x, c.y, C.alpha(col.best, 0.16));
        pl.rect(c.x, c.y, x1, y1, C.alpha(col.worst, 0.1));
        pl.line({ x: c.x, y: y0 }, { x: c.x, y: y1 }, C.alpha(col.muted, 0.6), 1, [4, 4]);
        pl.line({ x: x0, y: c.y }, { x: x1, y: c.y }, C.alpha(col.muted, 0.6), 1, [4, 4]);
      });
    }
    draw(ctx, pl, col) {
      const m = this.mode;
      const lab = { ex91: ["L₁(u)", "L₂(u)"], tp: ["穿过全州的时间（小时）", "罚款（美元）"], cont: ["L₁ = u", "L₂ = 1 − u"], ex1: ["L₁ = u²", "L₂ = u − 1"] }[m];
      pl.axes(col, { xt: C.ticks(...pl.o.x, 6), yt: C.ticks(...pl.o.y, 6), xl: lab[0], yl: lab[1] });
      const s = this.selected();
      this.cones(pl, col, s);
      if (m === "ex91" || m === "tp") {
        const P = this.points();
        const front = P.filter((_, i) => !this.dom[i].length).sort((a, b) => a.x - b.x);
        const stair = [];
        front.forEach((p, i) => { if (i) stair.push({ x: p.x, y: front[i - 1].y }); stair.push(p); });
        pl.path(stair, C.alpha(col.best, 0.7), 1.5, [5, 4]);
        P.forEach((p, i) => {
          const isSel = m === "ex91" ? i === this.sel : p.s === this.speed;
          const ok = !this.dom[i].length;
          pl.dot(p, isSel ? 8 : m === "tp" ? 4 : 6.5, ok ? col.best : col.worst, isSel ? col.text : col.surface, isSel ? 2.5 : 1.5);
          if (m === "ex91") pl.text(p.lab, p, col.text, { dx: 18, dy: -10, size: 12, weight: 650 });
          if (m === "tp" && ok) pl.text(p.s + "", p, col.best, { dy: -13, size: 11.5, weight: 650 });
        });
      } else if (m === "cont") {
        pl.line({ x: 0, y: 1 }, { x: 1, y: 0 }, col.best, 4);
        pl.dot({ x: 0, y: 1 }, 4, col.best); pl.dot({ x: 1, y: 0 }, 4, col.best);
        pl.dot(s, 8, col.best, col.text, 2.5);
      } else {
        const P = []; for (let i = 0; i <= 400; i++) { const u = -10 + i / 20; P.push({ x: u * u, y: u - 1, u }); }
        pl.path(P.filter((p) => p.u <= 0), col.best, 4);
        pl.path(P.filter((p) => p.u >= 0), col.worst, 3);
        pl.text("u = −10", { x: 100, y: -11 }, col.best, { dx: -26, dy: -8, size: 11 });
        pl.text("u = 10", { x: 100, y: 9 }, col.worst, { dx: -24, dy: 8, size: 11 });
        pl.text("u = 0", { x: 0, y: -1 }, col.text, { dx: 22, dy: 10, size: 11 });
        pl.dot(s, 8, this.u1 <= 1e-9 ? col.best : col.worst, col.text, 2.5);
      }
    }
  }

  // ---------------------------------------------------------------
  // 组件：两颗骰子的事件实验室（式 9.4、9.5、9.10、9.12，独立性）
  // ---------------------------------------------------------------
  const DICE_PRESETS = {
    sum7: ["E = 和为 7，F = 第一颗是 3", (i, j) => i + j === 7, (i) => i === 3],
    sum10: ["E = 和 ≥ 10，F = 第一颗是 6", (i, j) => i + j >= 10, (i) => i === 6],
    even: ["E = 和为偶数，F = 两颗相同", (i, j) => (i + j) % 2 === 0, (i, j) => i === j],
    big: ["E = 第一颗 ≥ 4，F = 第二颗 ≥ 4", (i) => i >= 4, (i, j) => j >= 4],
    clear: ["清空", () => false, () => false],
  };
  class DiceLab {
    constructor(root) {
      this.E = new Set(); this.F = new Set(); this.brush = "E"; this.painting = null;
      const body = C.frame(root, "两颗骰子：事件、条件概率与期望", "36 个等可能的结果 s = (i, j)；格子里的数是随机变量 X(s) = i + j");
      this.bsw = C.seg([["E", "画事件 E"], ["F", "画事件 F"]], "E", (k) => { this.brush = k; });
      this.pre = C.select(Object.entries(DICE_PRESETS).map(([k, v]) => [k, v[0]]), "sum7", (k) => this.preset(k));
      this.grid = h("div", { class: "dice-grid", role: "grid" });
      this.cells = {};
      this.grid.append(h("div", { class: "dh" }, "i \\ j"));
      for (let j = 1; j <= 6; j++) this.grid.append(h("div", { class: "dh" }, j));
      for (let i = 1; i <= 6; i++) {
        this.grid.append(h("div", { class: "dh" }, i));
        for (let j = 1; j <= 6; j++) {
          const c = h("button", { type: "button", class: "dc", "aria-label": `(${i}, ${j})` }, String(i + j));
          const key = i + "," + j; this.cells[key] = c;
          c.addEventListener("pointerdown", (e) => { e.preventDefault(); const S = this[this.brush]; this.painting = !S.has(key); this.paint(key); });
          c.addEventListener("pointerenter", () => { if (this.painting !== null) this.paint(key); });
          this.grid.append(c);
        }
      }
      window.addEventListener("pointerup", () => { this.painting = null; });
      this.stats = ["P(E)", "P(F)", "P(E∩F)", "P(E)·P(F)", "P(E | F)", "P(F | E)", "E[X | F]", "E[X | E]"].map((k) => C.stat(k));
      this.note = h("div", { class: "small" });
      body.append(h("div", { class: "controls" }, this.bsw, h("label", null, "预设：", this.pre)),
        h("div", { class: "split" }, h("div", null, this.grid, C.legend([[C.cva("p1", 0.35), "E"], [C.cv("p2"), "F（粗框）"]])),
          h("div", null, h("div", { class: "stats" }, this.stats), this.note)));
      this.preset("sum7");
    }
    paint(key) { const S = this[this.brush]; if (this.painting) S.add(key); else S.delete(key); this.update(); }
    preset(k) {
      const [, e, f] = DICE_PRESETS[k];
      this.E.clear(); this.F.clear();
      for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) { if (e(i, j)) this.E.add(i + "," + j); if (f(i, j)) this.F.add(i + "," + j); }
      this.update();
    }
    update() {
      const P = (S) => S.size / 36;
      const both = new Set([...this.E].filter((k) => this.F.has(k)));
      const ex = (S) => { if (!S.size) return NaN; let s = 0; S.forEach((k) => { const [i, j] = k.split(",").map(Number); s += i + j; }); return s / S.size; };
      const pE = P(this.E), pF = P(this.F), pEF = P(both);
      const vals = [pE, pF, pEF, pE * pF, pF ? pEF / pF : NaN, pE ? pEF / pE : NaN, ex(this.F), ex(this.E)];
      this.stats.forEach((s, k) => s.set(C.fmt(vals[k], 3, 72)));
      for (const [key, c] of Object.entries(this.cells)) { c.classList.toggle("inE", this.E.has(key)); c.classList.toggle("inF", this.F.has(key)); }
      const indep = Math.abs(pEF - pE * pF) < 1e-12;
      let msg;
      if (!this.E.size || !this.F.size) msg = "先在左边画出两个非空事件。";
      else msg = (indep ? `<p class="yes" style="margin:0 0 6px">E 与 F <b>独立</b>：P(E∩F) = P(E)P(F) = ${C.fmt(pEF)}；知道 F 发生并不改变 E 的概率（P(E|F) = P(E)）。</p>`
        : `<p class="no" style="margin:0 0 6px">E 与 F <b>不独立</b>：P(E∩F) = ${C.fmt(pEF)} ≠ P(E)P(F) = ${C.fmt(pE * pF, 3, 1296)}。</p>`) +
        `<p style="margin:0 0 6px">式 (9.5)：P(F)·P(E|F) = ${C.fmt(pF)} × ${C.fmt(pEF / pF)} = ${C.fmt(pEF)} = P(E)·P(F|E)。</p>`;
      msg += `<p class="muted" style="margin:0">无条件期望 E[X] = 7（例 9.5）。条件期望 (9.12) 只在 F 的格子上按 P(s|F) = 1/|F| 加权平均。</p>`;
      this.note.innerHTML = msg;
    }
  }

  // ---------------------------------------------------------------
  // 组件：贝叶斯马赛克（式 9.6、9.8、9.9）
  // ---------------------------------------------------------------
  const BAYES = {
    disease: { name: "罕见病检测（补充）", F: ["患病", "健康"], E: "检测呈阳性", prior: [0.01, 0.99], lik: [0.95, 0.05] },
    rooms: { name: "机器人在哪个房间（补充）", F: ["厨房", "走廊", "客厅"], E: "看到一扇门", prior: [0.5, 0.3, 0.2], lik: [0.1, 0.5, 0.9] },
  };
  class BayesMosaic {
    constructor(root) {
      const body = C.frame(root, "贝叶斯马赛克", "宽度 = 先验 P(Fᵢ)，紫色高度 = 似然 P(E | Fᵢ)；紫色面积之比就是后验");
      this.pre = C.select(Object.entries(BAYES).map(([k, v]) => [k, v.name]), "rooms", (k) => this.load(k));
      this.plot = new C.Plot({ x: [0, 1.42], y: [0, 1.08], aspect: 0.52, maxW: 720, m: { l: 8, r: 8, t: 22, b: 30 },
        onDraw: (ctx, pl, col) => this.draw(ctx, pl, col), onDown: (p) => this.down(p), onMove: (p, d) => this.move(p, d),
        cursor: (p) => (this.grab(p) ? (this.grab(p).k === "lik" ? "ns-resize" : "ew-resize") : null) });
      this.sliders = h("div", { class: "controls", style: "margin:6px 0 0" });
      this.formula = h("div", { class: "small eq-line" });
      this.again = C.button("再观测一次 E（后验当作新的先验）", () => { this.prior = this.post.slice(); this.nObs++; this.update(); });
      body.append(h("div", { class: "controls" }, h("label", null, "例子：", this.pre), this.again, C.button("重置", () => this.load(this.key))),
        this.plot.wrap, this.sliders, this.formula);
      this.load("rooms");
    }
    load(k) {
      this.key = k; const b = BAYES[k];
      this.names = b.F; this.Ename = b.E; this.prior = b.prior.slice(); this.lik = b.lik.slice(); this.nObs = 1;
      this.sliders.innerHTML = "";
      this.prSl = this.names.slice(0, -1).map((n, i) => C.slider(`P(${n})`, 0.001, 0.999, 0.001, this.prior[i], (v) => this.setPrior(i, v), (v) => v.toFixed(3)));
      this.lkSl = this.names.map((n, i) => C.slider(`P(E | ${n})`, 0, 1, 0.01, this.lik[i], (v) => { this.lik[i] = v; this.update(); }, (v) => v.toFixed(2)));
      this.sliders.append(...this.prSl, h("span", { class: "sep" }), ...this.lkSl);
      this.update();
    }
    setPrior(i, v) {
      const n = this.prior.length, rest = this.prior.reduce((s, x, k) => (k !== i && k !== n - 1 ? s + x : s), 0);
      this.prior[i] = Math.min(v, 1 - rest - 0.001);
      this.prior[n - 1] = 1 - this.prior.slice(0, -1).reduce((a, b) => a + b, 0);
      this.update();
    }
    edges() { const e = [0]; this.prior.forEach((p) => e.push(e[e.length - 1] + p)); return e; }
    grab(p) {
      if (!this.plot.ctx) return null;
      const e = this.edges();
      for (let i = 1; i < e.length - 1; i++) if (Math.abs(this.plot.X(e[i]) - this.plot.X(p.x)) < 6 && p.y >= 0 && p.y <= 1) return { k: "edge", i };
      for (let i = 0; i < this.prior.length; i++) if (p.x > e[i] && p.x < e[i + 1] && Math.abs(this.plot.Y(this.lik[i]) - this.plot.Y(p.y)) < 7) return { k: "lik", i };
      return null;
    }
    down(p) { return this.grab(p); }
    move(p, d) {
      if (d.k === "lik") { this.lik[d.i] = Math.max(0, Math.min(1, Math.round(p.y * 100) / 100)); this.lkSl[d.i].set(this.lik[d.i]); }
      else {
        const e = this.edges(), lo = e[d.i - 1] + 0.001, hi = e[d.i + 1] - 0.001, x = Math.max(lo, Math.min(hi, p.x));
        this.prior[d.i - 1] = x - e[d.i - 1]; this.prior[d.i] = e[d.i + 1] - x;
      }
      this.update();
    }
    update() {
      this.prSl.forEach((s, i) => s.set(this.prior[i]));
      const joint = this.prior.map((p, i) => p * this.lik[i]);
      this.pE = joint.reduce((a, b) => a + b, 0);
      this.post = this.pE > 0 ? joint.map((j) => j / this.pE) : this.prior.slice();
      const t = (x) => x.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
      const terms = this.names.map((n, i) => `P(E|${n})P(${n}) = ${t(this.lik[i])}×${t(this.prior[i])}`).join(" + ");
      this.formula.innerHTML = `<p style="margin:6px 0 4px">(9.8) 边缘化：P(E) = ${terms} = <b>${t(this.pE)}</b></p>` +
        `<p style="margin:0 0 4px">(9.9) 后验：` + this.names.map((n, i) => `P(${n} | E) = ${t(joint[i])} / ${t(this.pE)} = <b>${(100 * this.post[i]).toFixed(1)}%</b>`).join("；") + `</p>` +
        (this.nObs > 1 ? `<p class="muted" style="margin:0">已经观测了 ${this.nObs} 次 E。把上一次的后验当作先验再更新一次，相当于假设各次观测在给定 Fᵢ 时条件独立——这正是 (9.31) 的做法。</p>`
          : `<p class="muted" style="margin:0">「E = ${this.Ename}」。拖动列与列之间的竖线改先验，拖动紫色块的上沿改似然。</p>`);
      this.plot.draw();
    }
    draw(ctx, pl, col) {
      const e = this.edges(), cols = [col.p1, col.p2, col.p3];
      pl.rect(0, 0, 1, 1, col.surface2, col.strong, 1);
      this.prior.forEach((p, i) => {
        pl.rect(e[i], 0, e[i + 1], this.lik[i], C.alpha(col.prob, 0.75));
        pl.rect(e[i], this.lik[i], e[i + 1], 1, C.alpha(col.muted, 0.12));
        pl.line({ x: e[i], y: this.lik[i] }, { x: e[i + 1], y: this.lik[i] }, col.prob, 2.5);
        pl.rect(e[i], 1.005, e[i + 1], 1.03, cols[i]);
        const mid = (e[i] + e[i + 1]) / 2, wpx = pl.X(e[i + 1]) - pl.X(e[i]);
        if (wpx > 34) pl.text(this.names[i], { x: mid, y: 1.03 }, col.text, { dy: -9, size: 12, weight: 650 });
        else pl.text(this.names[i] + (i ? "" : " →"), { x: e[i], y: 1.03 }, cols[i], { dy: -9, align: i ? "right" : "left", size: 11.5, weight: 650 });
        if (wpx > 44) pl.text(`P = ${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`, { x: mid, y: 0 }, col.muted, { dy: 12, size: 11 });
      });
      for (let i = 1; i < e.length - 1; i++) pl.line({ x: e[i], y: 0 }, { x: e[i], y: 1 }, col.text, 2);
      // 右侧：后验条
      const bx0 = 1.12, bx1 = 1.3;
      pl.text("后验 P(Fᵢ | E)", { x: (bx0 + bx1) / 2, y: 1.03 }, col.text, { dy: -9, size: 12, weight: 650 });
      let y = 0;
      this.post.forEach((q, i) => {
        pl.rect(bx0, y, bx1, y + q, C.alpha(cols[i], 0.7), col.surface, 1.5);
        if (pl.Y(y) - pl.Y(y + q) > 14) pl.text(`${this.names[i]} ${(q * 100).toFixed(1)}%`, { x: bx1, y: y + q / 2 }, col.text, { align: "left", dx: 6, size: 11.5 });
        y += q;
      });
      pl.text("把紫色块挤成一列再拉满", { x: (bx0 + bx1) / 2, y: 0 }, col.muted, { dy: 12, size: 10.5 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：随机化策略（式 9.13）与猜硬币（例 9.7）
  // ---------------------------------------------------------------
  class Randomized {
    constructor(root) {
      this.La = 3; this.Lb = 5; this.w = 0.5;
      this.p = 1; this.opp = "learn"; this.N = 400; this.seed = 7;
      const body = C.frame(root, "随机化策略：什么时候有用？", "左：单人优化（式 9.13）；右：反复猜硬币（例 9.7）");
      // 左
      this.pl1 = new C.Plot({ x: [0, 1], y: [-6, 6], aspect: 0.75, maxW: 360, onDraw: (ctx, pl, col) => this.drawL(ctx, pl, col) });
      const left = h("div", null, h("div", { class: "panel-title" }, "(a) Formulation 9.1：U = {a, b}"),
        this.pl1.wrap,
        h("div", { class: "controls", style: "margin:6px 0 0" },
          C.slider("L(a)", -5, 5, 0.5, this.La, (v) => { this.La = v; this.upL(); }),
          C.slider("L(b)", -5, 5, 0.5, this.Lb, (v) => { this.Lb = v; this.upL(); }),
          C.slider("w = P(a)", 0, 1, 0.01, this.w, (v) => { this.w = v; this.upL(); }, (v) => v.toFixed(2))),
        this.infoL = h("p", { class: "small" }));
      // 右
      this.pl2 = new C.Plot({ x: [0, this.N], y: [-1.05, 1.05], aspect: 0.75, maxW: 380, onDraw: (ctx, pl, col) => this.drawR(ctx, pl, col) });
      this.oppSel = C.select([["learn", "P2 会学习：统计你出 H 的频率，然后去猜中你"], ["rand", "P2 随机 50 / 50"], ["H", "P2 总出 H"]], this.opp, (k) => { this.opp = k; this.reset(); });
      this.runner = new C.Runner(() => this.step(), () => { this.runBtn.textContent = "▶ 连续猜"; });
      this.runBtn = C.button("▶ 连续猜", () => { if (this.runner.running) this.runner.stop(); else { if (this.t >= this.N) this.reset(); this.runBtn.textContent = "❚❚ 暂停"; this.runner.start(); } }, "primary");
      const right = h("div", null, h("div", { class: "panel-title" }, "(b) 猜硬币：P1 的平均代价（HH、TT 时 P1 付 1 比索）"),
        this.pl2.wrap,
        h("div", { class: "controls", style: "margin:6px 0 0" },
          C.slider("P1 出 H 的概率 p", 0, 1, 0.05, this.p, (v) => { this.p = v; this.reset(); }, (v) => v.toFixed(2)), this.oppSel,
          this.runBtn, C.button("重来", () => { this.seed++; this.reset(); })),
        this.infoR = h("p", { class: "small" }));
      body.append(h("div", { class: "split", style: "grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)" }, left, right));
      this.upL(); this.reset();
    }
    upL() {
      const Lw = this.w * this.La + (1 - this.w) * this.Lb, best = Math.min(this.La, this.Lb);
      this.infoL.innerHTML = `L̄(w) = w·L(a) + (1−w)·L(b) = <b>${Lw.toFixed(2)}</b>。它是 w 的<b>线性</b>函数，最小值 ${best} 总在端点（确定性策略）取到；` +
        (this.La === this.Lb ? "两个动作一样好时，任何 w 都最优——但也不会更好。" : `随机化只会把代价拉向较差的 ${Math.max(this.La, this.Lb)}。`);
      this.pl1.draw();
    }
    drawL(ctx, pl, col) {
      pl.axes(col, { xt: [0, 0.25, 0.5, 0.75, 1], yt: [-6, -3, 0, 3, 6], xl: "w = P(a)", yl: "期望代价 L̄(w)" });
      pl.line({ x: 0, y: this.Lb }, { x: 1, y: this.La }, col.prob, 3);
      const bestEnd = this.La < this.Lb ? { x: 1, y: this.La } : { x: 0, y: this.Lb };
      if (this.La !== this.Lb) pl.dot(bestEnd, 8, col.best, col.surface, 2);
      pl.text("只选 b", { x: 0, y: this.Lb }, col.text, { dx: 26, dy: this.Lb > 4 ? 12 : -12, size: 11 });
      pl.text("只选 a", { x: 1, y: this.La }, col.text, { dx: -26, dy: this.La > 4 ? 12 : -12, size: 11 });
      const Lw = this.w * this.La + (1 - this.w) * this.Lb;
      pl.line({ x: this.w, y: -6 }, { x: this.w, y: Lw }, col.muted, 1, [4, 3]);
      pl.dot({ x: this.w, y: Lw }, 6, col.prob, col.surface, 2);
    }
    reset() {
      this.runner && this.runner.stop();
      this.r = C.rng(this.seed); this.t = 0; this.total = 0; this.nH = 0; this.hist = [{ x: 0, y: 0 }];
      this.pl2 && this.pl2.draw(); this.upR();
    }
    step() {
      for (let k = 0; k < 3 && this.t < this.N; k++) {
        const a = this.r() < this.p ? "H" : "T";
        let b;
        if (this.opp === "H") b = "H";
        else if (this.opp === "rand") b = this.r() < 0.5 ? "H" : "T";
        else { const ph = (this.nH + 1) / (this.t + 2); b = ph > 0.5 ? "H" : ph < 0.5 ? "T" : (this.r() < 0.5 ? "H" : "T"); }
        this.total += a === b ? 1 : -1; this.nH += a === "H"; this.t++;
        this.hist.push({ x: this.t, y: this.total / this.t });
      }
      this.pl2.draw(); this.upR();
      return this.t < this.N;
    }
    theory() {
      const vs = { H: 2 * this.p - 1, rand: 0, learn: Math.abs(2 * this.p - 1) };
      return vs[this.opp];
    }
    upR() {
      const avg = this.t ? this.total / this.t : 0;
      this.infoR.innerHTML = `已猜 ${this.t} 次，P1 平均每次付 <b>${avg.toFixed(3)}</b> 比索（负数表示赢钱）；长期期望 ${this.theory().toFixed(2)}（虚线）。` +
        (this.opp === "learn" ? (this.p === 0.5 ? " p = 1/2 时对手学不到任何东西：这就是例 9.7 的「最好的随机化策略」，平均下来不输不赢。"
          : " 只要 p ≠ 1/2，会学习的对手迟早发现你的偏好；确定性策略（p = 0 或 1）每次都输。") : "");
    }
    drawR(ctx, pl, col) {
      pl.axes(col, { xt: C.ticks(0, this.N, 4), yt: [-1, -0.5, 0, 0.5, 1], xl: "第几次", yl: "P1 的平均代价" });
      pl.line({ x: 0, y: this.theory() }, { x: this.N, y: this.theory() }, col.muted, 1.5, [6, 4]);
      pl.path(this.hist, col.p1, 2);
      if (this.t) pl.dot(this.hist[this.hist.length - 1], 4, col.p1);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='pareto']").forEach((el) => (el._w = new Pareto(el)));
    document.querySelectorAll("[data-widget='dice']").forEach((el) => (el._w = new DiceLab(el)));
    document.querySelectorAll("[data-widget='bayes-mosaic']").forEach((el) => (el._w = new BayesMosaic(el)));
    document.querySelectorAll("[data-widget='randomized']").forEach((el) => (el._w = new Randomized(el)));
  });
})();
