/* 6.5 节：上界的增长速度（双重指数 vs 单指数，补充示意）、Davenport–Schinzel 序列与下包络（图 6.42、例 6.9） */
(function () {
  "use strict";
  const { h } = PA;
  const C = CH6;
  const P = C.P;

  // ===============================================================
  // 双重指数 vs 单指数（补充示意：O(·) 里的常数一律取 1、2，只为看出形状）
  // ===============================================================
  class Growth {
    constructor(root) {
      this.m = 4; this.d = 2;
      const body = C.frame(root, "维数 n 增加时：双重指数 vs 单指数", "补充示意：把 O(·) 里看不见的常数取成具体值，只为看形状");
      this.st = new C.Stage({ aspect: 0.6, maxW: 620, view: [0, 1, 0, 1], pad: 0, onDraw: (ctx, st, col) => this.draw(st, col) });
      this.sm = C.slider("多项式个数 m", 2, 50, 1, this.m, (v) => { this.m = v; this.render(); });
      this.sd = C.slider("最高次数 d", 2, 8, 1, this.d, (v) => { this.d = v; this.render(); });
      this.out = h("p", { class: "small" });
      body.append(h("div", { class: "controls" }, this.sm, this.sd), this.st.wrap, this.out,
        C.legend([[C.cv("bad"), "柱形代数分解 (md)^(2^n)"], [C.cv("accent"), "Canny 一类 m^n · d^(n²)"], [C.cv("muted"), "10¹⁸ 次运算（每秒 10⁹ 次，约 30 年）"]]));
      this.render();
    }
    lg(n) { const m = this.m, d = this.d; return { cad: Math.pow(2, n) * Math.log10(m * d), canny: n * Math.log10(m) + n * n * Math.log10(d) }; }
    render() {
      let cross = null; for (let n = 1; n <= 12; n++) { const v = this.lg(n); if (v.cad > v.canny) { cross = n; break; } }
      const v6 = this.lg(6), v10 = this.lg(10);
      this.out.innerHTML = `纵轴是 log₁₀(运行时间)。n = 6 时两者约为 10^${v6.cad.toFixed(0)} 与 10^${v6.canny.toFixed(0)}；n = 10 时约为 10^${v10.cad.toFixed(0)} 与 10^${v10.canny.toFixed(0)}。${cross ? `从 n = ${cross} 起双重指数的那条线就再也追不上了。` : ""}`
        + ` <span class="muted">真实的界里还有未知常数（(md)^{O(1)^n}、m^n (lg m) d^{O(n⁴)}…），所以交点位置没有意义；有意义的是：一条线随 n 是「指数的指数」，另一条只是「指数」。两者对 m、d 都只是多项式。</span>`;
      this.st.draw();
    }
    draw(st, col) {
      const ctx = st.ctx, W = st.W, H = st.H, L = 46, R = 12, T = 12, B = 30;
      ctx.fillStyle = col.surface; ctx.fillRect(0, 0, W, H);
      const ymax = 160, X = (n) => L + ((W - L - R) * (n - 1)) / 11, Y = (v) => H - B - ((H - T - B) * Math.min(v, ymax)) / ymax;
      ctx.strokeStyle = C.alpha(col.text, 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
      ctx.font = `11px ${getComputedStyle(document.body).fontFamily}`; ctx.fillStyle = col.text2; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (let n = 1; n <= 12; n++) ctx.fillText(String(n), X(n), H - B + 4);
      ctx.fillText("维数 n", (L + W - R) / 2, H - 14);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let v = 0; v <= ymax; v += 40) { ctx.fillText("10^" + v, L - 4, Y(v)); ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.strokeStyle = C.alpha(col.text, 0.08); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(L, Y(18)); ctx.lineTo(W - R, Y(18)); ctx.strokeStyle = col.muted; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      const curve = (key, c) => { ctx.beginPath(); for (let k = 0; k <= 220; k++) { const n = 1 + (11 * k) / 220, v = this.lg(n)[key]; const x = X(n), y = Y(v); if (!k) ctx.moveTo(x, y); else ctx.lineTo(x, y); if (v > ymax) break; } ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.stroke(); };
      curve("cad", col.bad); curve("canny", col.accent);
    }
  }

  // ===============================================================
  // Davenport–Schinzel 序列与下包络
  // ===============================================================
  const LAMBDA = { 1: (n) => n, 2: (n) => 2 * n - 1, 3: (n) => [0, 1, 4, 8, 12, 17, 22][n], 4: (n) => [0, 1, 5, 10, 16, 22][n] };
  // 序列里最长的双符号交替子序列（贪心），用来检查 (n,s) 条件
  function longestAlt(seq) {
    const syms = [...new Set(seq)]; let best = { len: Math.min(seq.length, 1), a: seq[0], b: null, idx: [0] };
    for (const a of syms) for (const b of syms) {
      if (a === b) continue;
      let want = a; const idx = [];
      seq.forEach((u, i) => { if (u === want) { idx.push(i); want = want === a ? b : a; } });
      if (idx.length > best.len) best = { len: idx.length, a, b, idx };
    }
    return best;
  }
  function isDS(seq, s) { if (seq.some((u, i) => i && u === seq[i - 1])) return false; return longestAlt(seq).len < s + 2; }

  class DSEnvelope {
    constructor(root) {
      this.kind = "seg"; this.n = 5; this.seed = 3;
      const body = C.frame(root, "下包络与 Davenport–Schinzel 序列", "换一组函数，或拖动线段端点；下面还能手动检查一个序列");
      this.st = new C.Stage({ aspect: 0.55, maxW: 620, view: [-0.03, 1.03, -0.05, 1.05], onDraw: (ctx, st, col) => this.draw(st, col),
        onDown: (p) => { if (this.kind === "parab") return null; for (let i = 0; i < this.F.length; i++) for (const k of ["a", "b"]) if (this.st.near(p, this.F[i][k], 11)) return { i, k }; return null; },
        onMove: (p, d) => { const f = this.F[d.i]; f[d.k] = P(Math.max(0, Math.min(1, p.x)), Math.max(0, Math.min(1, p.y))); if (Math.abs(f.a.x - f.b.x) > 0.01) { this.compute(); this.st.draw(); } },
        cursor: (p) => (this.kind !== "parab" && this.F.some((f) => this.st.near(p, f.a, 11) || this.st.near(p, f.b, 11)) ? "grab" : null) });
      this.selK = C.seg([["line", "直线：每对至多交 1 次"], ["parab", "抛物线：至多交 2 次"], ["seg", "线段（例 6.9）"]], this.kind, (k) => { this.kind = k; this.gen(); });
      this.sn = C.slider("函数个数 n", 2, 6, 1, this.n, (v) => { this.n = v; this.gen(); });
      this.out = h("div", { class: "small" });
      this.inp = h("input", { type: "text", value: "a b a b a", style: "width:12em;font-family:var(--mono)" });
      this.sInp = h("input", { type: "number", value: 3, min: 1, max: 6, style: "width:4em" });
      this.chk = h("div", { class: "small" });
      const doCheck = () => this.checkInput();
      this.inp.addEventListener("input", doCheck); this.sInp.addEventListener("input", doCheck);
      body.append(h("div", { class: "controls" }, this.selK, this.sn, C.button("换一组", () => { this.seed++; this.gen(); }, "small")),
        this.st.wrap, this.out,
        h("div", { class: "panel", style: "margin-top:10px" }, h("div", { class: "panel-title" }, "手动检查：输入一个序列（用空格隔开）和 s"),
          h("div", { class: "panel-body" }, h("div", { class: "controls", style: "margin:0" }, h("label", null, "序列 ", this.inp), h("label", null, "s = ", this.sInp)), this.chk)),
        C.legend([[C.cv("accent"), "各个函数"], [C.cv("path"), "下包络"]]));
      this.gen(); this.checkInput();
    }
    gen() {
      const r = C.rng(this.seed * 97 + this.n * 7 + (this.kind === "seg" ? 1 : this.kind === "line" ? 2 : 3));
      this.F = [];
      for (let i = 0; i < this.n; i++) {
        if (this.kind === "line") this.F.push({ a: P(0, 0.1 + 0.8 * r()), b: P(1, 0.1 + 0.8 * r()) });
        else if (this.kind === "seg") { let x0 = r() * 0.8, x1 = x0 + 0.15 + r() * (0.95 - x0); x1 = Math.min(1, x1); this.F.push({ a: P(x0, 0.1 + 0.8 * r()), b: P(x1, 0.1 + 0.8 * r()) }); }
        else { const c = r(), k = (r() * 2 - 1) * 3.2, y0 = 0.25 + 0.5 * r(); this.F.push({ c, k, y0 }); }
      }
      this.compute(); this.st.draw();
    }
    val(f, x) {
      if (this.kind === "parab") return f.y0 + f.k * (x - f.c) ** 2;
      if (x < Math.min(f.a.x, f.b.x) || x > Math.max(f.a.x, f.b.x)) return Infinity;
      return f.a.y + ((f.b.y - f.a.y) * (x - f.a.x)) / (f.b.x - f.a.x);
    }
    compute() {
      const N = 1600, seq = [], env = [];
      let run = [];
      for (let k = 0; k <= N; k++) {
        const x = k / N; let best = Infinity, bi = -1;
        this.F.forEach((f, i) => { const v = this.val(f, x); if (v < best) { best = v; bi = i; } });
        if (bi >= 0 && (!seq.length || seq[seq.length - 1] !== bi)) seq.push(bi);
        if (bi >= 0 && best >= -0.05 && best <= 1.05) run.push(P(x, best)); else { if (run.length) env.push(run); run = []; }
        if (bi >= 0 && run.length > 1 && Math.abs(run[run.length - 1].y - run[run.length - 2].y) > 0.05) { const last = run.pop(); env.push(run); run = [last]; }
      }
      if (run.length) env.push(run);
      this.seq = seq; this.env = env;
      const s = this.kind === "line" ? 1 : this.kind === "parab" ? 2 : 3, n = this.n;
      const ok = isDS(seq, s), lam = LAMBDA[s] && LAMBDA[s](n);
      const letters = seq.map((i) => String.fromCharCode(97 + i)).join(" ");
      this.out.innerHTML = `<p>下包络依次经过的函数：<span class="mono">(${letters})</span>，长度 ${seq.length}。`
        + `这是一个 (${n}, ${s}) Davenport–Schinzel 序列：${ok ? '<span class="yes">✓</span>' : '<span class="no">✗</span>'}；所以长度 ≤ λ<sub>${s}</sub>(${n}) = ${lam}。</p>`
        + `<p class="muted">${this.kind === "seg" ? "线段两两至多交一次，但它们只在一段 x 上有定义——相当于 s = 1 的函数被「截断」，包络序列是 (n, s+2) = (n, 3) 序列，长度是 Θ(λ₃(n)) = Θ(n α(n))，比直线的 n 多出一个反 Ackermann 因子。" : this.kind === "line" ? "直线两两至多交一次：每条直线在下包络上最多出现一段，λ₁(n) = n。" : "抛物线两两至多交两次：λ₂(n) = 2n − 1。"}</p>`;
    }
    checkInput() {
      const seq = this.inp.value.trim().split(/[\s,]+/).filter(Boolean), s = Math.max(1, +this.sInp.value || 1);
      if (!seq.length) { this.chk.textContent = ""; return; }
      const n = new Set(seq).size, rep = seq.findIndex((u, i) => i && u === seq[i - 1]);
      const alt = longestAlt(seq);
      let msg;
      if (rep > 0) msg = `<span class="no">不是</span>：第 ${rep} 与第 ${rep + 1} 个符号相同（违反条件 1）。`;
      else if (alt.len >= s + 2) msg = `<span class="no">不是 (${n}, ${s}) 序列</span>：有长度 ${alt.len} 的交替子序列 <span class="mono">${alt.idx.map((i) => seq[i]).join(" ")}</span>（位置 ${alt.idx.map((i) => i + 1).join(", ")}），而条件 2 要求 < s + 2 = ${s + 2}。`;
      else msg = `<span class="yes">是 (${n}, ${s}) Davenport–Schinzel 序列</span>：没有相邻重复，最长的双符号交替子序列长 ${alt.len} < ${s + 2}。${LAMBDA[s] && LAMBDA[s](n) ? `λ<sub>${s}</sub>(${n}) = ${LAMBDA[s](n)}。` : ""}`;
      this.chk.innerHTML = msg + ' <span class="muted">（λ 的小值由参考代码暴力枚举得到。）</span>';
    }
    draw(st, col) {
      st.ctx.fillStyle = col.surface; st.ctx.fillRect(0, 0, st.W, st.H);
      st.line(P(0, 0), P(1, 0), C.alpha(col.text, 0.4), 1);
      this.F.forEach((f, i) => {
        const nm = String.fromCharCode(97 + i);
        if (this.kind === "parab") {
          const pts = []; for (let k = 0; k <= 200; k++) { const x = k / 200; pts.push(P(x, this.val(f, x))); }
          st.path(pts.filter((p) => p.y > -0.2 && p.y < 1.2), C.alpha(col.accent, 0.6), 1.6);
          st.text(nm, P(f.c, Math.min(1, Math.max(0, f.y0))), col.accent, { dy: f.k > 0 ? 12 : -12, weight: 650 });
        }
        else { st.line(f.a, f.b, C.alpha(col.accent, 0.6), 1.6); st.dot(f.a, 4, col.surface, col.accent, 1.5); st.dot(f.b, 4, col.surface, col.accent, 1.5); st.text(nm, C.lerp(f.a, f.b, 0.5), col.accent, { dy: -10, weight: 650 }); }
      });
      for (const run of this.env) st.path(run, col.path, 3.6);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='growth']").forEach((el) => el._w = new Growth(el));
    document.querySelectorAll("[data-widget='ds-envelope']").forEach((el) => el._w = new DSEnvelope(el));
  });
  window.CH6.isDS = isDS;
})();
