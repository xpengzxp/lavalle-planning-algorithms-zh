/* 13.1.2、13.1.3 节：简单车家族与平行泊车、差速驱动 / 独轮车与图 13.4、拖车、推箱子、飞机螺旋线、滚球 */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH13;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------
  // 组件：简单车（图 13.1、式 13.15）及其变体；平行泊车演示（补充）
  // ---------------------------------------------------------------
  const CAR_MODELS = {
    tricycle: { name: "三轮车", phiLim: 90, rev: true, cont: true, desc: "U = [−1,1] × [−π/2, π/2]：前轮能打到 90°，此时后轴中心不动、原地转圈（ρmin = 0）。" },
    simple: { name: "简单车", phiLim: null, rev: true, cont: true, desc: "U = [−1,1] × (−φmax, φmax)：最大转向角 φmax < π/2 带来最小转弯半径 ρmin = L / tan φmax。" },
    rs: { name: "Reeds–Shepp 车", phiLim: null, rev: true, cont: false, desc: "u_s ∈ {−1, 0, 1}：三档——倒车、停、前进。能在任意小的空间里平行泊车（小时间局部可控）。" },
    dubins: { name: "Dubins 车", phiLim: null, rev: false, cont: false, desc: "u_s ∈ {0, 1}：不能倒车。仍是非完整的，在无限大的空地上能到达任何位形，但不再小时间局部可控。" },
    left: { name: "只能左转", phiLim: null, rev: false, cont: false, left: true, desc: "图 1.12a：只能前进、方向盘只能往左打（本页允许回正直行）。" },
  };

  class SimpleCar {
    constructor(root) {
      this.root = root; this.model = "simple"; this.L = 1; this.phimax = 35; this.speed = 1;
      this.s = [-2.5, -1, 0]; this.phi = 0; this.us = 0; this.trace = []; this.queue = null; this.slot = null;
      const body = C.frame(root, "简单车", "↑/↓ 前进 / 倒车，←/→ 打方向（先点一下图）；或用下面的按钮与滑块");
      this.st = new C.Stage({ view: [-5.5, 5.5, -3.3, 3.3], maxW: 640, aspect: 0.6, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.keys = C.keys(root, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
      this.segM = C.seg(Object.entries(CAR_MODELS).map(([k, m]) => [k, m.name]), this.model, (k) => { this.model = k; this.queue = null; this.sticky = null; this.limitPhi(); this.update(); });
      this.sPhi = C.slider("u_φ", -90, 90, 1, 0, (v) => { this.phi = v * DEG; this.limitPhi(); this.update(); }, (v) => v + "°");
      this.sMax = C.slider("φmax", 10, 60, 1, this.phimax, (v) => { this.phimax = v; this.limitPhi(); this.update(); }, (v) => v + "°");
      this.sAlpha = C.slider("摆动角 α", 3, 40, 1, 12, () => {}, (v) => v + "°");
      this.fwd = C.holdButton("▲ 前进", () => this.hold = 1, () => this.hold = 0);
      this.back = C.holdButton("▼ 倒车", () => this.hold = -1, () => this.hold = 0);
      this.hold = 0;
      this.stats = [C.stat("q = (x, y, θ)"), C.stat("u = (u_s, u_φ)"), C.stat("转弯半径 ρ"), C.stat("ρmin = L/tan φmax")];
      this.msg = h("div", { class: "msg info" });
      this.runner = new C.Runner(root, (dt) => this.step(dt));
      body.append(h("div", { class: "controls" }, this.segM),
        h("div", { class: "controls" }, this.fwd, this.back, this.sPhi, this.sMax),
        this.st.wrap,
        h("div", { class: "controls", style: "margin-top:10px" }, h("b", { class: "small" }, "平行泊车（补充）："), this.sAlpha,
          C.button("向右平移一个车宽", () => this.park(), "primary"), C.button("重置", () => this.reset())),
        h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cv("accent"), "车身与后轴中心的轨迹"], [C.cv("warn"), "前轮转向角 u_φ"], [C.cv("ok"), "当前转弯圆（半径 ρ）"], [C.cva("muted", 0.6), "图 13.1 中两条轴线（交点 = 转弯中心）"]]));
      this.runner.start();
      this.update();
    }
    reset() { this.s = [-2.5, -1, 0]; this.phi = 0; this.trace = []; this.queue = null; this.slot = null; this.sticky = null; this.sPhi.set(0); this.update(); }
    lim() { const m = CAR_MODELS[this.model]; return (m.phiLim || this.phimax) * DEG; }
    limitPhi() {
      const m = CAR_MODELS[this.model], L = this.lim();
      this.phi = C.clamp(this.phi, m.left ? 0 : -L, L);
      // 三轮车的 ±90° 会让 tan 发散：数值上停在 89.9°
      this.phi = C.clamp(this.phi, -89.9 * DEG, 89.9 * DEG);
    }
    // 平行泊车：倒车右打 α、倒车左打 α、前进回正——净侧移 2ρ(1−cos α)，θ 回到原值（参考代码第 3 项）
    park() {
      const m = CAR_MODELS[this.model];
      if (!m.rev) { this.sticky = ["bad", `${m.name}不能倒车：这套「摆动」动作用不了。Dubins 车要横移一个车宽，只能绕一个至少 ρmin 大小的圈。`]; this.update(); return; }
      const al = this.sAlpha.input.value * DEG, pm = Math.min(this.lim(), 60 * DEG), rho = this.L / Math.tan(pm);
      const lat = 2 * rho * (1 - Math.cos(al)), target = 0.75, n = Math.max(1, Math.ceil(target / lat - 1e-9));
      const q = [];
      for (let i = 0; i < n; i++) q.push({ us: -1, phi: -pm, T: rho * al }, { us: -1, phi: pm, T: rho * al }, { us: 1, phi: 0, T: 2 * rho * Math.sin(al) });
      this.queue = q; this.cmd = null;
      this.s[2] = Math.round(this.s[2] / (Math.PI / 2)) * (Math.PI / 2);   // 先把车头摆正，便于观察
      this.slot = { x: this.s[0], y: this.s[1], th: this.s[2], lat: n * lat, ext: 2 * rho * Math.sin(al) };
      this.trace = [];
      this.sticky = ["info", `每次摆动：倒车打满方向走 α、反打方向再走 α、前进 ${(2 * rho * Math.sin(al)).toFixed(2)} 回到原纵向位置。净侧移 2ρ(1−cosα) = ${lat.toFixed(3)}，所以要重复 ${n} 次。α 越小，每次侧移 ≈ ρα² 越小，但前后只需要 2ρ sinα ≈ 2ρα 的空间——空间再窄也能挪过去。`];
    }
    f(s, us, phi) { return [us * Math.cos(s[2]), us * Math.sin(s[2]), (us / this.L) * Math.tan(phi)]; }
    step(dt) {
      const m = CAR_MODELS[this.model];
      let us = 0;
      if (this.queue) {
        let left = 2 * dt;   // 演示按 2 倍速播放
        while (left > 1e-9) {
          if (!this.cmd) { this.cmd = this.queue.shift(); if (!this.cmd) { this.queue = null; break; } }
          const hh = Math.min(left, this.cmd.T, 0.01);
          this.s = C.rk4((x) => this.f(x, this.cmd.us, this.cmd.phi), this.s, hh);
          this.phi = this.cmd.phi; us = this.cmd.us;
          this.cmd.T -= hh; left -= hh;
          if (this.cmd.T <= 1e-9) this.cmd = null;
        }
        this.pushTrace(); this.us = us; this.update(); return true;
      }
      const k = this.keys;
      if (k.has("ArrowUp")) us = 1; else if (k.has("ArrowDown")) us = -1; else us = this.hold;
      if (us < 0 && !m.rev) us = 0;
      if (m.cont) us *= this.speed;
      if (k.has("ArrowLeft")) this.phi = this.lim(); else if (k.has("ArrowRight")) this.phi = m.left ? 0 : -this.lim();
      else if (this.keyPhi) this.phi = this.sPhi.input.value * DEG;
      this.keyPhi = !(k.has("ArrowLeft") || k.has("ArrowRight"));
      this.limitPhi();
      this.us = us;
      if (us !== 0) {
        for (let i = 0; i < 4; i++) this.s = C.rk4((x) => this.f(x, us, this.phi), this.s, dt / 4);
        // 出界就从另一边回来
        if (this.s[0] > 6) this.s[0] -= 12; if (this.s[0] < -6) this.s[0] += 12;
        if (this.s[1] > 3.8) this.s[1] -= 7.6; if (this.s[1] < -3.8) this.s[1] += 7.6;
        this.pushTrace(); this.update();
      } else if (this.lastDrawnPhi !== this.phi) this.update();
      return true;
    }
    pushTrace() {
      const p = { x: this.s[0], y: this.s[1] }, last = this.trace[this.trace.length - 1];
      if (last && Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trace.push(null);
      this.trace.push(p); if (this.trace.length > 3000) this.trace.shift();
    }
    update() {
      const m = CAR_MODELS[this.model], s = this.s;
      this.sMax.style.display = m.phiLim ? "none" : "";
      const L = this.lim();
      this.sPhi.input.min = m.left ? 0 : Math.round(-L / DEG); this.sPhi.input.max = Math.round(L / DEG);
      this.stats[0].set(`(${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${(C.wrap(s[2]) / DEG).toFixed(0)}°)`);
      this.stats[1].set(`(${this.us.toFixed(0)}, ${(this.phi / DEG).toFixed(0)}°)`);
      const rho = Math.abs(Math.tan(this.phi)) < 1e-9 ? Infinity : this.L / Math.tan(this.phi);
      this.stats[2].set(isFinite(rho) ? Math.abs(rho).toFixed(3) : "∞（直行）");
      this.stats[3].set(m.phiLim ? "0（三轮车）" : (this.L / Math.tan(this.phimax * DEG)).toFixed(3));
      const [cls, txt] = this.sticky || ["info", m.desc];
      this.msg.className = "msg " + cls; this.msg.textContent = txt;
      this.lastDrawnPhi = this.phi;
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      if (this.slot) {
        const { x, y, th, lat, ext } = this.slot;
        const P = [[-0.5 - ext, 0.45], [1.5, 0.45], [1.5, -lat - 0.45], [-0.5 - ext, -lat - 0.45]].map(([u, v]) => C.body2w(x, y, th, u, v));
        st.poly(P, C.alpha(col.goal, 0.07), C.alpha(col.goal, 0.6), 1.2);
        st.text("所需空间", C.body2w(x, y, th, 0.5, 0.75), col.goal, { size: 11 });
      }
      // 轨迹
      let seg = [];
      for (const p of this.trace) { if (!p) { st.path(seg, col.accent, 1.8); seg = []; } else seg.push(p); }
      st.path(seg, col.accent, 1.8);
      const s = this.s, phi = this.phi;
      // 转弯圆与两条轴线
      if (Math.abs(Math.tan(phi)) > 1e-6) {
        const rho = this.L / Math.tan(phi), c = C.body2w(s[0], s[1], s[2], 0, rho);
        st.circle(c, Math.abs(rho), C.alpha(col.ok, 0.8), 1.4, [6, 5]);
        st.line({ x: s[0], y: s[1] }, c, C.alpha(col.muted, 0.6), 1, [3, 3]);
        st.line(C.body2w(s[0], s[1], s[2], this.L, 0), c, C.alpha(col.muted, 0.6), 1, [3, 3]);
        st.dot(c, 3.5, col.ok);
        st.text("ρ = " + Math.abs(rho).toFixed(2), { x: (c.x + s[0]) / 2, y: (c.y + s[1]) / 2 }, col.ok, { size: 11, dy: -8 });
      }
      C.drawCar(st, s, col, { L: this.L, W: 0.6, phi });
      // 前轮方向（橙）
      const fc = C.body2w(s[0], s[1], s[2], this.L, 0);
      st.arrow(fc, { x: fc.x + 0.7 * Math.cos(s[2] + phi), y: fc.y + 0.7 * Math.sin(s[2] + phi) }, col.warn, 2, 7);
      // 后轴中心的速度：只能沿车身方向（式 13.12）
      if (this.us) st.arrow({ x: s[0], y: s[1] }, { x: s[0] + 0.8 * this.us * Math.cos(s[2]), y: s[1] + 0.8 * this.us * Math.sin(s[2]) }, col.accent, 2.2, 8);
    }
  }

  // ---------------------------------------------------------------
  // 组件：差速驱动（13.16、13.17）、独轮车（13.18）、图 13.4 的「转—走—转」
  // ---------------------------------------------------------------
  class DiffDrive {
    constructor(root) {
      this.r = 0.1; this.L = 0.5; this.ul = 4; this.ur = 6; this.mode = "lr";
      this.s = [-1.5, -0.8, 0.3]; this.trace = []; this.goal = [1.6, 0.9, -1.2]; this.plan = null; this.dist = 0; this.rot = 0;
      const body = C.frame(root, "差速驱动与独轮车", "滑块设定动作；「图 13.4」模式下拖动目标位形（粉色）");
      this.st = new C.Stage({ view: [-3, 3, -2, 2], maxW: 600, aspect: 0.62, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (this.mode === "fig" && Math.hypot(p.x - this.goal[0], p.y - this.goal[1]) < 0.3 ? "g" : this.mode === "fig" && Math.hypot(p.x - this.s[0], p.y - this.s[1]) < 0.3 ? "s" : null),
        onMove: (p, d) => { const t = d === "g" ? this.goal : this.s; t[0] = C.clamp(p.x, -2.8, 2.8); t[1] = C.clamp(p.y, -1.8, 1.8); this.plan = null; this.trace = []; this.update(); },
        cursor: (p) => (this.mode === "fig" && (Math.hypot(p.x - this.goal[0], p.y - this.goal[1]) < 0.3 || Math.hypot(p.x - this.s[0], p.y - this.s[1]) < 0.3) ? "grab" : null) });
      this.segM = C.seg([["lr", "(13.16) 动作 (u_r, u_l)"], ["wp", "(13.17) 动作 (u_ω, u_ψ)"], ["uni", "(13.18) 独轮车"], ["fig", "图 13.4 转—走—转"]], this.mode, (k) => { this.mode = k; this.runner.stop(); this.syncSliders(); this.update(); });
      this.s1 = C.slider("", -10, 10, 0.1, 0, (v) => this.setA(0, v), (v) => v.toFixed(1));
      this.s2 = C.slider("", -10, 10, 0.1, 0, (v) => this.setA(1, v), (v) => v.toFixed(1));
      this.presets = h("span", { class: "controls", style: "margin:0" },
        C.button("纯平移", () => this.preset(5, 5)), C.button("纯旋转", () => this.preset(-3, 3)), C.button("左轮不动", () => this.preset(0, 6)));
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 运行"; });
      this.btn = C.button("▶ 运行", () => { if (this.mode === "fig" && !this.runner.running) { this.planFig(); } this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 暂停" : "▶ 运行"; }, "primary");
      this.stats = [C.stat("(ẋ, ẏ, θ̇)"), C.stat("轴中心速度"), C.stat("转动中心距离 R"), C.stat("轴中心路程")];
      this.note = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.segM),
        h("div", { class: "controls" }, this.s1, this.s2, this.presets, this.btn, C.button("重置", () => { this.runner.stop(); this.s = [-1.5, -0.8, 0.3]; this.trace = []; this.dist = 0; this.rot = 0; this.plan = null; this.update(); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.note,
        C.legend([[C.cv("accent"), "机器人与轴中心轨迹"], [C.cv("warn"), "两个轮子的线速度 r u_l、r u_r"], [C.cv("ok"), "瞬时转动中心与转弯圆"], [C.cv("goal"), "目标位形"]]));
      this.syncSliders(); this.update();
    }
    preset(ul, ur) { this.ul = ul; this.ur = ur; if (this.mode === "fig") this.mode = "lr", this.segM.set("lr"); this.syncSliders(); this.update(); }
    // 不同参数化之间换算
    setA(i, v) {
      if (this.mode === "lr") { if (i === 0) this.ur = v; else this.ul = v; }
      else if (this.mode === "wp") { const w = i === 0 ? v : (this.ur + this.ul) / 2, p = i === 1 ? v : this.ur - this.ul; this.ur = w + p / 2; this.ul = w - p / 2; }
      else if (this.mode === "uni") { // u_s = r u_ω，u_ω(角速度) = r u_ψ / L
        const us = i === 0 ? v : (this.r * (this.ur + this.ul)) / 2, uw = i === 1 ? v : (this.r / this.L) * (this.ur - this.ul);
        const w = us / this.r, p = (uw * this.L) / this.r; this.ur = w + p / 2; this.ul = w - p / 2;
      }
      this.update();
    }
    syncSliders() {
      const set = (sl, lab, min, max, step, val) => { sl.firstChild.textContent = lab; sl.input.min = min; sl.input.max = max; sl.input.step = step; sl.set(val); };
      const show = this.mode !== "fig";
      this.s1.style.display = this.s2.style.display = this.presets.style.display = show ? "" : "none";
      if (this.mode === "lr") { set(this.s1, "u_r", -10, 10, 0.1, this.ur); set(this.s2, "u_l", -10, 10, 0.1, this.ul); }
      if (this.mode === "wp") { set(this.s1, "u_ω（平移）", -10, 10, 0.1, (this.ur + this.ul) / 2); set(this.s2, "u_ψ（转动）", -20, 20, 0.1, this.ur - this.ul); }
      if (this.mode === "uni") { set(this.s1, "u_s", -1, 1, 0.01, (this.r * (this.ur + this.ul)) / 2); set(this.s2, "u_ω", -4, 4, 0.01, (this.r / this.L) * (this.ur - this.ul)); }
    }
    f(s, ul, ur) { const v = (this.r / 2) * (ul + ur); return [v * Math.cos(s[2]), v * Math.sin(s[2]), (this.r / this.L) * (ur - ul)]; }
    // 图 13.4：先原地转到指向目标，再直行，再原地转到目标朝向
    planFig() {
      const [x, y, th] = this.s, [gx, gy, gth] = this.goal;
      const head = Math.atan2(gy - y, gx - x), d = Math.hypot(gx - x, gy - y), w = 6, r = this.r, L = this.L;
      const rot1 = C.wrap(head - th), rot2 = C.wrap(gth - head);
      const tr = (ang) => ({ ul: -Math.sign(ang) * w, ur: Math.sign(ang) * w, T: Math.abs(ang) / ((r / L) * 2 * w) });
      this.plan = [tr(rot1), { ul: w, ur: w, T: d / (r * w) }, tr(rot2)];
      this.dist = 0; this.rot = 0; this.trace = [];
      this.figTotal = { d, rot: Math.abs(rot1) + Math.abs(rot2) };
    }
    step(dt) {
      let ul = this.ul, ur = this.ur, left = dt;
      if (this.mode === "fig") {
        if (!this.plan || !this.plan.length) return false;
        while (left > 1e-9 && this.plan.length) {
          const c = this.plan[0], hh = Math.min(left, c.T, 0.005);
          const old = this.s;
          this.s = C.rk4((x) => this.f(x, c.ul, c.ur), this.s, hh);
          this.dist += Math.hypot(this.s[0] - old[0], this.s[1] - old[1]); this.rot += Math.abs(this.s[2] - old[2]);
          this.cur = c; c.T -= hh; left -= hh;
          if (c.T <= 1e-9) this.plan.shift();
        }
      } else {
        const old = this.s;
        for (let i = 0; i < 4; i++) this.s = C.rk4((x) => this.f(x, ul, ur), this.s, dt / 4);
        this.dist += Math.hypot(this.s[0] - old[0], this.s[1] - old[1]);
        if (Math.abs(this.s[0]) > 3.2 || Math.abs(this.s[1]) > 2.2) { this.s[0] = ((this.s[0] + 3.2) % 6.4 + 6.4) % 6.4 - 3.2; this.s[1] = ((this.s[1] + 2.2) % 4.4 + 4.4) % 4.4 - 2.2; this.trace.push(null); }
      }
      this.trace.push({ x: this.s[0], y: this.s[1] }); if (this.trace.length > 2500) this.trace.shift();
      this.update();
      return true;
    }
    update() {
      const ul = this.mode === "fig" && this.cur ? this.cur.ul : this.ul, ur = this.mode === "fig" && this.cur ? this.cur.ur : this.ur;
      const v = this.f(this.s, ul, ur), sp = (this.r / 2) * (ul + ur);
      this.stats[0].set(`(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`);
      this.stats[1].set(sp.toFixed(3));
      const R = Math.abs(ur - ul) < 1e-9 ? Infinity : (this.L / 2) * (ur + ul) / (ur - ul);
      this.stats[2].set(isFinite(R) ? Math.abs(R).toFixed(3) : "∞");
      this.stats[3].set(this.dist.toFixed(3));
      const notes = {
        lr: "(13.16)：平移速度取两轮角速度的<b>平均</b>，转速正比于两轮之差、反比于轮距 L。左轮不动时平移速度是两轮同速时的一半；u_l = −u_r 时原地转（u_r > 0 逆时针）。",
        wp: "(13.17)：换成 u_ω = (u_r + u_l)/2（「平移」）和 u_ψ = u_r − u_l（「转动」）后，形式和简单车 (13.15) 很像，但转速可以独立于平移速度设定。",
        uni: "(13.18)：独轮车直接以速度 u_s 和角速度 u_ω 为动作。它就是 L = 1 的差速驱动（这里换算成 (u_r, u_l) 来驱动同一个机器人）——两者都不含动力学，所以能互相模拟。",
        fig: this.figTotal ? `图 13.4：先原地转向目标、再直行、再原地转到目标朝向。轴中心走过的路程 = 两点的欧氏距离 ${this.figTotal.d.toFixed(3)}；两次转动共 ${(this.figTotal.rot / DEG).toFixed(1)}°，在「路程」里不花任何代价——所以差速驱动的最短路问题很无趣（除非把轮子转过的总角度也算进代价）。` : "图 13.4：点「运行」，机器人会转—走—转到粉色目标；可以先拖动起点和目标。",
      };
      this.note.innerHTML = notes[this.mode];
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 0.5, { axes: false });
      let seg = [];
      for (const p of this.trace) { if (!p) { st.path(seg, col.accent, 1.8); seg = []; } else seg.push(p); }
      st.path(seg, col.accent, 1.8);
      if (this.mode === "fig") {
        st.line({ x: this.s[0], y: this.s[1] }, { x: this.goal[0], y: this.goal[1] }, C.alpha(col.goal, 0.5), 1, [4, 4]);
        C.drawDiffDrive(st, this.goal, col, { L: this.L, r: this.r, body: col.goal, wheels: C.alpha(col.goal, 0.7) });
      }
      const ul = this.mode === "fig" && this.cur && this.runner.running ? this.cur.ul : this.mode === "fig" ? 0 : this.ul;
      const ur = this.mode === "fig" && this.cur && this.runner.running ? this.cur.ur : this.mode === "fig" ? 0 : this.ur;
      const s = this.s;
      if (Math.abs(ur - ul) > 1e-9 && this.mode !== "fig") {
        const R = (this.L / 2) * (ur + ul) / (ur - ul), c = C.body2w(s[0], s[1], s[2], 0, R);
        if (Math.abs(R) > 1e-6) st.circle(c, Math.abs(R), C.alpha(col.ok, 0.75), 1.3, [6, 5]);
        st.line(C.body2w(s[0], s[1], s[2], 0, -this.L / 2), c, C.alpha(col.ok, 0.6), 1, [3, 3]);
        st.dot(c, 4, col.ok);
      }
      C.drawDiffDrive(st, s, col, { L: this.L, r: this.r });
      const k = 0.18;
      [[this.L / 2, ul], [-this.L / 2, ur]].forEach(([by, u]) => {
        const p = C.body2w(s[0], s[1], s[2], 0, by);
        st.arrow(p, { x: p.x + k * this.r * u * 10 * Math.cos(s[2]), y: p.y + k * this.r * u * 10 * Math.sin(s[2]) }, col.warn, 2, 7);
      });
      st.text("l", C.body2w(s[0], s[1], s[2], -0.12, this.L / 2 + 0.12), col.warn, { size: 11, weight: 700 });
      st.text("r", C.body2w(s[0], s[1], s[2], -0.12, -this.L / 2 - 0.12), col.warn, { size: 11, weight: 700 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：拖车（13.19）
  // ---------------------------------------------------------------
  class Trailers {
    constructor(root) {
      this.k = 2; this.d = 0.9; this.Lc = 1; this.phi = 0; this.dir = 0; this.s = null; this.trace = [];
      const body = C.frame(root, "拉拖车的简单车", "↑/↓ 前进 / 倒车（或按住按钮），←/→ 打方向；k 节拖车，C 的维数是 k + 3");
      this.st = new C.Stage({ view: [-6, 6, -3.4, 3.4], maxW: 640, aspect: 0.56, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.keys = C.keys(root, ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
      this.sK = C.slider("拖车数 k", 0, 6, 1, this.k, (v) => { this.k = v; this.reset(); }, (v) => String(v));
      this.sD = C.slider("挂接长度 dᵢ", 0.5, 1.6, 0.05, this.d, (v) => { this.d = v; this.reset(); }, (v) => v.toFixed(2));
      this.sPhi = C.slider("u_φ", -40, 40, 1, 0, (v) => { this.phi = v * DEG; }, (v) => v + "°");
      this.hold = 0;
      this.stats = [C.stat("C 的维数"), C.stat("θ₀ … θ_k（度）"), C.stat("最大夹角 |θᵢ₋₁ − θᵢ|")];
      this.msg = h("div", { class: "msg info" }, "前进时拖车会自然「排成一列」；倒车时稍一打方向，夹角就会越来越大（折刀 jackknife）——这就是倒车入库难的原因。");
      this.runner = new C.Runner(root, (dt) => this.step(dt));
      body.append(h("div", { class: "controls" }, this.sK, this.sD, this.sPhi),
        h("div", { class: "controls" }, C.holdButton("▲ 前进", () => this.hold = 1, () => this.hold = 0), C.holdButton("▼ 倒车", () => this.hold = -1, () => this.hold = 0),
          C.button("重置", () => this.reset()), C.button("倒车演示（u_φ = 3°）", () => { this.reset(); this.demo = 6; this.phi = 3 * DEG; this.sPhi.set(3); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats), this.msg,
        C.legend([[C.cv("accent"), "车"], [C.cv("purple"), "拖车（颜色越淡越靠后）"], [C.cv("bad"), "夹角超过 90°：折刀"]]));
      this.reset();
      this.runner.start();
    }
    reset() { this.s = [1.5 + 0.5 * this.k * this.d, 0, 0, ...new Array(this.k).fill(0)]; this.trace = []; this.demo = 0; this.update(); }
    rhs(s, sp) {
      const k = this.k, th = s.slice(2), out = new Array(s.length).fill(0);
      out[0] = sp * Math.cos(th[0]); out[1] = sp * Math.sin(th[0]); out[2] = (sp / this.Lc) * Math.tan(this.phi);
      let prod = 1;
      for (let i = 1; i <= k; i++) {
        if (i > 1) prod *= Math.cos(th[i - 2] - th[i - 1]);
        out[2 + i] = (sp / this.d) * prod * Math.sin(th[i - 1] - th[i]);   // (13.19)
      }
      return out;
    }
    step(dt) {
      let sp = this.hold;
      if (this.keys.has("ArrowUp")) sp = 1; if (this.keys.has("ArrowDown")) sp = -1;
      if (this.keys.has("ArrowLeft")) this.phi = 35 * DEG; else if (this.keys.has("ArrowRight")) this.phi = -35 * DEG; else this.phi = this.sPhi.input.value * DEG;
      if (this.demo > 0) { sp = -1; this.demo -= dt; }
      if (!sp) return true;
      for (let i = 0; i < 4; i++) this.s = C.rk4((x) => this.rhs(x, sp), this.s, dt / 4);
      // 出界：整列平移回来
      const wrapAxis = (i, lim) => { if (this.s[i] > lim) { this.s[i] -= 2 * lim; this.trace.push(null); } if (this.s[i] < -lim) { this.s[i] += 2 * lim; this.trace.push(null); } };
      wrapAxis(0, 6.5); wrapAxis(1, 3.9);
      this.trace.push({ x: this.s[0], y: this.s[1] }); if (this.trace.length > 2000) this.trace.shift();
      this.update();
      return true;
    }
    points() {
      const pts = [{ x: this.s[0], y: this.s[1] }];
      for (let i = 1; i <= this.k; i++) { const th = this.s[2 + i]; pts.push({ x: pts[i - 1].x - this.d * Math.cos(th), y: pts[i - 1].y - this.d * Math.sin(th) }); }
      return pts;
    }
    maxAngle() { let m = 0; for (let i = 1; i <= this.k; i++) m = Math.max(m, Math.abs(C.wrap(this.s[1 + i] - this.s[2 + i]))); return m; }
    update() {
      this.stats[0].set(String(this.k + 3));
      this.stats[1].set(this.s.slice(2).map((t) => (C.wrap(t) / DEG).toFixed(0)).join(", "));
      const m = this.maxAngle();
      this.stats[2].set(this.k ? (m / DEG).toFixed(1) + "°" : "–");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      let seg = [];
      for (const p of this.trace) { if (!p) { st.path(seg, C.alpha(col.accent, 0.6), 1.4); seg = []; } else seg.push(p); }
      st.path(seg, C.alpha(col.accent, 0.6), 1.4);
      const pts = this.points();
      for (let i = this.k; i >= 1; i--) {
        const th = this.s[2 + i], p = pts[i], hitch = pts[i - 1];
        const bad = Math.abs(C.wrap(this.s[1 + i] - th)) > Math.PI / 2;
        const c = bad ? col.bad : C.mix(col.purple, col.surface, (0.5 * (i - 1)) / Math.max(1, this.k));
        st.line(p, hitch, c, 2);
        const w = 0.5, len = Math.max(0.2, this.d - 0.42);   // 拖车车厢比挂接长度短，留出牵引杆
        const P = [[-0.22, -w / 2], [len, -w / 2], [len, w / 2], [-0.22, w / 2]].map(([u, v]) => C.body2w(p.x, p.y, th, u, v));
        st.poly(P, C.alpha(c, 0.22), c, 1.5);
        C.wheel(st, p.x, p.y, th, 0, w / 2, 0, 0.3, 0.08, col.text); C.wheel(st, p.x, p.y, th, 0, -w / 2, 0, 0.3, 0.08, col.text);
        st.dot(hitch, 3, col.text);
        st.text("θ" + i, p, c, { dy: -18, size: 11, weight: 650 });
      }
      C.drawCar(st, this.s.slice(0, 3), col, { L: this.Lc, W: 0.6, phi: this.phi });
    }
  }

  // ---------------------------------------------------------------
  // 组件：推箱子（图 13.7）——稳定推动 = 转向范围不对称的 Dubins 车
  // ---------------------------------------------------------------
  class PushBox {
    constructor(root) {
      this.a = -0.5; this.b = 0.9; this.psi = 0; this.s = [-3.5, -1, 0.2]; this.box = null; this.trace = []; this.boxTrace = []; this.state = "stable";
      const body = C.frame(root, "推箱子", "机器人只能前进；转速 ψ 必须在 [a, b] 内，否则箱子会滑走或转走（图 13.7）");
      this.st = new C.Stage({ view: [-5, 5, -3, 3], maxW: 600, aspect: 0.6, onDraw: (ctx, st, col) => this.draw(ctx, st, col) });
      this.sPsi = C.slider("转速 ψ", -1.5, 1.5, 0.05, 0, (v) => { this.psi = v; }, (v) => v.toFixed(2));
      this.sA = C.slider("a", -1.4, -0.1, 0.05, this.a, (v) => { this.a = v; this.update(); }, (v) => v.toFixed(2));
      this.sB = C.slider("b", 0.1, 1.4, 0.05, this.b, (v) => { this.b = v; this.update(); }, (v) => v.toFixed(2));
      this.runner = new C.Runner(root, (dt) => this.step(dt), () => { this.btn.textContent = "▶ 推"; });
      this.btn = C.button("▶ 推", () => { this.runner.toggle(); this.btn.textContent = this.runner.running ? "❚❚ 停" : "▶ 推"; }, "primary");
      this.msg = h("div", { class: "msg ok" });
      body.append(h("div", { class: "controls" }, this.btn, this.sPsi, C.button("重置", () => this.reset())),
        h("div", { class: "controls" }, h("span", { class: "small" }, "稳定推动的转速范围 [a, b]（取决于摩擦和箱子形状）："), this.sA, this.sB),
        this.st.wrap, this.msg,
        C.legend([[C.cv("accent"), "差速驱动机器人"], [C.cv("warn"), "箱子"], [C.cv("ok"), "左、右两侧的最小转弯圆（半径 s/b、s/|a|）"], [C.cv("bad"), "非法：箱子滑走或转走"]]));
      this.reset();
    }
    reset() { this.runner.stop(); this.s = [-3.5, -1, 0.2]; this.box = null; this.trace = []; this.state = "stable"; this.update(); }
    step(dt) {
      const sp = 0.8;
      if (this.state === "stable" && (this.psi < this.a || this.psi > this.b)) {
        this.state = this.psi > this.b ? "slide" : "rotate";
        const c = C.body2w(this.s[0], this.s[1], this.s[2], 0.62, 0);
        this.box = { x: c.x, y: c.y, th: this.s[2] };
      }
      for (let i = 0; i < 4; i++) this.s = C.rk4((x) => [sp * Math.cos(x[2]), sp * Math.sin(x[2]), this.psi], this.s, dt / 4);
      if (Math.abs(this.s[0]) > 5.3 || Math.abs(this.s[1]) > 3.3) { this.reset(); return false; }
      this.trace.push({ x: this.s[0], y: this.s[1] });
      this.update();
      return true;
    }
    update() {
      if (this.state === "stable") { this.msg.className = "msg ok"; this.msg.textContent = `稳定推动：ψ = ${this.psi.toFixed(2)} ∈ [${this.a.toFixed(2)}, ${this.b.toFixed(2)}]，箱子像焊在机器人上一样。这个运动模型和 Dubins 车类似（只能前进、转向有界），区别是左右两边的最大「转向」可以不同。`; }
      else { this.msg.className = "msg bad"; this.msg.textContent = `转得太急：ψ 超出了 [${this.a.toFixed(2)}, ${this.b.toFixed(2)}]，箱子不再跟着机器人走——滑走或转走（图 13.7b、c），这种运动是非法的。点「重置」重来。`; }
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 1, { axes: false });
      st.path(this.trace, col.accent, 1.6);
      const s = this.s, sp = 0.8;
      // 最小转弯圆：左 R = s/b，右 R = s/|a|
      const cl = C.body2w(s[0], s[1], s[2], 0, sp / this.b), cr = C.body2w(s[0], s[1], s[2], 0, -sp / Math.abs(this.a));
      st.circle(cl, sp / this.b, C.alpha(col.ok, 0.6), 1.2, [5, 4]); st.circle(cr, sp / Math.abs(this.a), C.alpha(col.ok, 0.6), 1.2, [5, 4]);
      C.drawDiffDrive(st, s, col, { L: 0.7, r: 0.12 });
      const boxP = (x, y, th, color) => st.poly([[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]].map(([u, v]) => C.body2w(x, y, th, u, v)), C.alpha(color, 0.3), color, 1.8);
      if (this.state === "stable") { const c = C.body2w(s[0], s[1], s[2], 0.62, 0); boxP(c.x, c.y, s[2], col.warn); }
      else boxP(this.box.x, this.box.y, this.box.th, col.bad);
    }
  }

  // ---------------------------------------------------------------
  // 组件：飞机（13.20）的螺旋线
  // ---------------------------------------------------------------
  class Airplane {
    constructor(root) {
      this.uz = 0.25; this.uw = 1.2; this.T = 12;
      const body = C.frame(root, "飞机：ẋ = cos θ，ẏ = sin θ，ż = u_z，θ̇ = u_ω", "拖动画面旋转；固定 u 时轨迹是轴平行于 z 的螺旋线");
      this.v = new C.View3D({ R: 2.6, az: -0.7, el: 0.35, maxW: 470, aspect: 0.85, onDraw: (ctx, V, col) => this.draw(ctx, V, col) });
      this.sZ = C.slider("u_z", -0.5, 0.5, 0.01, this.uz, (v) => { this.uz = v; this.update(); }, (v) => v.toFixed(2));
      this.sW = C.slider("u_ω", -2.5, 2.5, 0.05, this.uw, (v) => { this.uw = v; this.update(); }, (v) => v.toFixed(2));
      this.sT = C.slider("飞行时间", 1, 20, 0.5, this.T, (v) => { this.T = v; this.update(); }, (v) => v.toFixed(1));
      this.stats = [C.stat("投影圆半径 1/|u_ω|"), C.stat("每圈升高 2π u_z / u_ω"), C.stat("终点高度")];
      body.append(h("div", { class: "controls" }, this.sZ, this.sW, this.sT),
        h("div", { class: "split" }, this.v.wrap, h("div", null, h("div", { class: "stats" }, this.stats),
          h("p", { class: "small" }, "u_z = 0 时就是在固定高度上飞的 Dubins 车（速度 s = 1，不能为 0——飞机不能悬停）。u_ω = 0 时沿直线爬升。真实的模型还要考虑俯仰、滚转、扰动和动力学，这里都忽略了。"),
          C.legend([[C.cv("accent"), "三维轨迹"], [C.cva("muted", 0.7), "在 xy 平面上的投影"]]))));
      this.update();
    }
    update() {
      const r = Math.abs(this.uw) < 1e-9 ? Infinity : 1 / Math.abs(this.uw);
      this.stats[0].set(isFinite(r) ? r.toFixed(3) : "∞");
      this.stats[1].set(Math.abs(this.uw) < 1e-9 ? "–" : ((2 * Math.PI * this.uz) / Math.abs(this.uw)).toFixed(3));
      this.stats[2].set((this.uz * this.T).toFixed(2));
      this.v.draw();
    }
    draw(ctx, V, col) {
      V.st.frame(col);
      const P = [], Q = [];
      let s = [0, 0, 0, 0];
      const zs = this.uz * this.T, z0 = -zs / 2;
      for (let t = 0, dt = 0.02; t <= this.T + 1e-9; t += dt) {
        P.push([s[0], s[1], s[2] + z0]); Q.push([s[0], s[1], -1.8]);
        s = C.rk4((x) => [Math.cos(x[3]), Math.sin(x[3]), this.uz, this.uw], s, dt);
      }
      // 地面网格
      for (let g = -2; g <= 2; g += 1) { V.line([g, -2, -1.8], [g, 2, -1.8], col.grid, 1); V.line([-2, g, -1.8], [2, g, -1.8], col.grid, 1); }
      V.path(Q, C.alpha(col.muted, 0.7), 1.2, [4, 3]);
      V.path(P, col.accent, 2.2);
      const e = P[P.length - 1];
      V.dot(P[0], 4, col.text); V.dot(e, 6, col.accent, col.surface, 2);
      V.line([0, 0, -1.8], [0, 0, 1.8], C.alpha(col.muted, 0.4), 1, [2, 4]);
      V.text("z", [0, 0, 1.95], col.muted, { weight: 650 });
    }
  }

  // ---------------------------------------------------------------
  // 组件：滚球（补充：用旋转矩阵直接模拟纯滚动 ω = ẑ × v / ρ）
  // ---------------------------------------------------------------
  const RB_R0 = () => C.m3.axis([1, 0.6, 0], 0.8);   // 初始姿态稍微倾斜，球面上的三条大圆都看得见
  class RollingBall {
    constructor(root) {
      this.rho = 0.6; this.p = { x: 0, y: 0 }; this.R = RB_R0(); this.Rref = this.R; this.trace = [{ x: 0, y: 0 }]; this.a = 0.3; this.queue = null;
      const body = C.frame(root, "在平面上滚球", "按住球拖动 = 用手掌推着它滚（不打滑、不自转）；或点「沿正方形滚一圈」");
      this.st = new C.Stage({ view: [-4, 4, -2.6, 2.6], maxW: 600, aspect: 0.65, onDraw: (ctx, st, col) => this.draw(ctx, st, col),
        onDown: (p) => (Math.hypot(p.x - this.p.x, p.y - this.p.y) < this.rho + 0.1 ? { last: p } : null),
        onMove: (p, d) => { this.rollTo({ x: C.clamp(p.x, -3.9, 3.9), y: C.clamp(p.y, -2.5, 2.5) }); d.last = p; },
        cursor: (p) => (Math.hypot(p.x - this.p.x, p.y - this.p.y) < this.rho + 0.1 ? "grab" : null) });
      this.sA = C.slider("正方形边长 a", 0.1, 1.5, 0.05, this.a, (v) => { this.a = v; }, (v) => v.toFixed(2));
      this.stats = [C.stat("球心 (x, y)"), C.stat("相对参考姿态的转角"), C.stat("转轴（z 分量）"), C.stat("a²/ρ²（ρ = 0.6）")];
      this.runner = new C.Runner(root, (dt) => this.step(dt));
      body.append(h("div", { class: "controls" }, this.sA, C.button("沿正方形滚一圈", () => this.square(), "primary"), C.button("重置", () => { this.runner.stop(); this.queue = null; this.p = { x: 0, y: 0 }; this.R = RB_R0(); this.Rref = this.R; this.trace = [{ x: 0, y: 0 }]; this.update(); })),
        this.st.wrap, h("div", { class: "stats" }, this.stats),
        h("p", { class: "small" }, "球有 5 个自由度（C = ℝ² × SO(3)）却只有 2 个动作。沿一个闭合回路滚回原处，球的姿态却变了——对小正方形，净效果近似是绕竖直轴转了 a²/ρ²（逆时针绕圈 → 球顺时针自转；参考代码第 6 项）。组合这类回路，就能把球滚到任意位置、任意姿态 [48, 39]。"),
        C.legend([[C.cv("accent"), "接触点轨迹"], [C.cv("warn"), "球面上的标记（只画朝上的半球）"]]));
      this.update();
    }
    rollTo(q) {
      const dx = q.x - this.p.x, dy = q.y - this.p.y, d = Math.hypot(dx, dy);
      if (d < 1e-9) return;
      const n = Math.ceil(d / 0.02);
      for (let i = 0; i < n; i++) {
        const sx = dx / n, sy = dy / n, sd = d / n;
        this.R = C.m3.mul(C.m3.axis([-sy, sx, 0], sd / this.rho), this.R);   // ω ∝ ẑ × v
      }
      this.R = C.m3.ortho(this.R);
      this.p = { x: q.x, y: q.y };
      this.trace.push({ ...this.p }); if (this.trace.length > 4000) this.trace.shift();
      this.update();
    }
    square() {
      const a = this.a;
      this.queue = [[a, 0], [0, a], [-a, 0], [0, -a]].map(([x, y]) => ({ dx: x, dy: y, left: Math.hypot(x, y) }));
      this.Rref = this.R; this.trace = [{ ...this.p }]; this.runner.start();
    }
    step(dt) {
      if (!this.queue || !this.queue.length) { this.queue = null; return false; }
      const c = this.queue[0], v = 1.0, ds = Math.min(c.left, v * dt), L = Math.hypot(c.dx, c.dy);
      this.rollTo({ x: this.p.x + (c.dx / L) * ds, y: this.p.y + (c.dy / L) * ds });
      c.left -= ds; if (c.left <= 1e-9) this.queue.shift();
      return true;
    }
    update() {
      const R = C.m3.mul(this.R, C.m3.T(this.Rref)), tr = R[0][0] + R[1][1] + R[2][2], ang = Math.acos(C.clamp((tr - 1) / 2, -1, 1));
      const ax = ang > 1e-9 ? C.v3.unit([R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]]) : [0, 0, 0];
      this.stats[0].set(`(${this.p.x.toFixed(2)}, ${this.p.y.toFixed(2)})`);
      this.stats[1].set((ang / DEG).toFixed(2) + "°");
      this.stats[2].set(ang > 1e-9 ? ax[2].toFixed(3) : "–");
      this.stats[3].set(((this.a * this.a) / (this.rho * this.rho) / DEG).toFixed(2) + "°");
      this.st.draw();
    }
    draw(ctx, st, col) {
      st.frame(col); st.grid(col, 0.5, { axes: false });
      st.path(this.trace, col.accent, 1.6);
      const c = this.p, r = this.rho;
      st.circle(c, r, col.strong, 1.5, null, C.alpha(col.accent, 0.08));
      // 球面上的经纬线与几个标记点：机体系中的点经 R 旋转，z > 0 的可见
      const proj = (b) => { const w = C.m3.vec(this.R, b); return { p: { x: c.x + r * w[0], y: c.y + r * w[1] }, z: w[2] }; };
      const circleBody = (fn, color, lw) => {
        let seg = [];
        for (let i = 0; i <= 96; i++) {
          const t = (2 * Math.PI * i) / 96, q = proj(fn(t));
          if (q.z > 0) seg.push(q.p); else { st.path(seg, color, lw); seg = []; }
        }
        st.path(seg, color, lw);
      };
      circleBody((t) => [Math.cos(t), Math.sin(t), 0], C.alpha(col.muted, 0.8), 1.2);
      circleBody((t) => [Math.cos(t), 0, Math.sin(t)], C.alpha(col.muted, 0.8), 1.2);
      circleBody((t) => [0, Math.cos(t), Math.sin(t)], C.alpha(col.muted, 0.8), 1.2);
      const marks = [[[0, 0, 1], col.warn, "N"], [[0, 0, -1], col.purple, "S"], [[1, 0, 0], col.ok, ""], [[-1, 0, 0], col.ok, ""], [[0, 1, 0], col.bad, ""], [[0, -1, 0], col.bad, ""]];
      for (const [b, color, lab] of marks) { const q = proj(b); if (q.z > 0) { st.dot(q.p, 4 + 3 * q.z, color, col.surface, 1.2); if (lab) st.text(lab, q.p, col.surface, { size: 9, weight: 700 }); } }
      st.dot(c, 2.5, col.text);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='simple-car']").forEach((el) => el._w = new SimpleCar(el));
    document.querySelectorAll("[data-widget='diff-drive']").forEach((el) => el._w = new DiffDrive(el));
    document.querySelectorAll("[data-widget='trailers']").forEach((el) => el._w = new Trailers(el));
    document.querySelectorAll("[data-widget='push-box']").forEach((el) => el._w = new PushBox(el));
    document.querySelectorAll("[data-widget='airplane']").forEach((el) => el._w = new Airplane(el));
    document.querySelectorAll("[data-widget='rolling-ball']").forEach((el) => el._w = new RollingBall(el));
  });
})();
