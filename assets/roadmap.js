/* 全书路线图（依据 1.5 节 Organization of the Book）。首页与第 1 章共用。 */
(function () {
  "use strict";
  const { h, store } = PA;

  const PARTS = [
    { id: "I", name: "Part I · 入门材料", en: "Introductory Material", pdf: "https://lavalle.pl/planning/par1.pdf",
      note: "为全书打基础。" },
    { id: "II", name: "Part II · 运动规划", en: "Motion Planning（也可以叫：连续状态空间中的规划）", pdf: "https://lavalle.pl/planning/par2.pdf",
      note: "灵感主要来自机器人学，但方法也用于计算生物学、CAD、计算机图形学。" },
    { id: "III", name: "Part III · 决策论规划", en: "Decision-Theoretic Planning（也可以叫：不确定性下的规划）", pdf: "https://lavalle.pl/planning/par3.pdf",
      note: "大部分讨论离散状态空间，读完 Part I 就可以直接进入。" },
    { id: "IV", name: "Part IV · 微分约束下的规划", en: "Planning Under Differential Constraints", pdf: "https://lavalle.pl/planning/par4.pdf",
      note: "可以看作 Part II 的延续：既有全局约束（障碍物），也有局部约束（微分约束）。" },
  ];

  const CHAPTERS = [
    { n: 1, part: "I", title: "引言", en: "Introduction", href: "part1/ch1-introduction.html",
      desc: "规划在机器人学、控制论、AI 中的不同含义；动机示例；规划的基本要素；算法、规划器与计划。", key: "全章", pre: [] },
    { n: 2, part: "I", title: "离散规划", en: "Discrete Planning", href: "part1/ch2-discrete-planning.html",
      desc: "最简单的规划形式：可行规划的搜索方法、最优规划与值迭代、基于逻辑的表示。是进入全书其余部分的跳板。",
      key: "去 Part II 最重要：2.1、2.2；去 Part III 还需要 2.3。2.4、2.5 后面不再用到。", pre: [1] },
    { n: 3, part: "II", title: "几何表示与变换", en: "Geometric Representations and Transformations", href: "part2/ch3-geometric-representations.html",
      desc: "如何构造几何模型（3.1），以及如何对它们做变换（其余各节）。", key: "3.1、3.2 对后面的章节很重要。", pre: [2] },
    { n: 4, part: "II", title: "配置空间", en: "The Configuration Space", href: "part2/ch4-configuration-space.html",
      desc: "引入拓扑概念，并用它们来表述配置空间——运动规划中出现的状态空间。", key: "4.1、4.2、4.3.1 是理解后面大部分内容的关键；整个 4.3 是第 6 章组合方法的背景。", pre: [3] },
    { n: 5, part: "II", title: "基于采样的运动规划", en: "Sampling-Based Motion Planning", href: "part2/ch5-sampling-based-planning.html",
      desc: "近年来主导文献的运动规划算法；只要理解「配置空间是连续状态空间」即可读懂大部分。第 14 章会在微分约束下重访。", key: "", pre: [4, 2] },
    { n: 6, part: "II", title: "组合运动规划", en: "Combinatorial Motion Planning",
      desc: "也叫精确算法：构造离散表示而不丢失信息，是完备的（有解必找到，否则报告失败）。", key: "", pre: [4] },
    { n: 7, part: "II", title: "基本运动规划的扩展", en: "Extensions of Basic Motion Planning",
      desc: "第 5、6 章方法的许多扩展问题与算法。", key: "7.4（闭链）需要 4.4。", pre: [5, 6] },
    { n: 8, part: "II", title: "反馈运动规划", en: "Feedback Motion Planning",
      desc: "过渡性章节：把反馈引入运动规划，但还不引入微分约束。开环计划 vs 闭环计划。", key: "", pre: [5, 6] },
    { n: 9, part: "III", title: "基本决策论", en: "Basic Decision Theory",
      desc: "单步决策：在其他决策者（真实对手或用来建模不确定性的「自然」）的干扰下做出最好的决策。", key: "", pre: [2] },
    { n: 10, part: "III", title: "序贯决策论", en: "Sequential Decision Theory",
      desc: "把第 9 章的单步决策串成多步；2.3 节的动态规划在这里变得重要。假设当前状态总是已知。", key: "", pre: [9, 2] },
    { n: 11, part: "III", title: "传感器与信息空间", en: "Sensors and Information Spaces",
      desc: "执行时当前状态未知：信息来自传感器观测与历史动作。信息空间之于感知不确定性，就像配置空间之于运动规划。", key: "", pre: [10] },
    { n: 12, part: "III", title: "感知不确定下的规划", en: "Planning Under Sensing Uncertainty",
      desc: "定位、建图、追逃（pursuit–evasion）、操作等问题，统一在信息空间中规划。", key: "", pre: [11] },
    { n: 13, part: "IV", title: "微分模型", en: "Differential Models",
      desc: "大量含微分约束的模型：车轮滚动约束、机械系统动力学。", key: "", pre: [4] },
    { n: 14, part: "IV", title: "微分约束下的采样规划", en: "Sampling-Based Planning Under Differential Constraints",
      desc: "第 5 章方法的扩展；在微分约束下组合方法几乎无能为力，所以全部是基于采样的方法。", key: "", pre: [13, 5] },
    { n: 15, part: "IV", title: "系统理论与解析方法", en: "System Theory and Analytical Techniques",
      desc: "主要来自控制理论文献的概念与工具，与第 14 章的算法互补。", key: "", pre: [13] },
  ];

  class Roadmap {
    constructor(root) {
      this.root = root;
      this.base = root.dataset.base || "";        // 从当前页面回到站点根目录的相对路径，如 "../"
      this.progress = root.dataset.progress === "true";
      this.done = store.get("pa-progress", {});
      this.sel = null;
      this.build();
      this.render();
    }
    build() {
      this.grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px" });
      this.detail = h("div", { class: "panel-body", style: "min-height:96px" });
      this.prog = h("div");
      this.root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "全书路线图"), h("span", { class: "w-sub" }, "依据 1.5 节。点一章：蓝色 = 它的前置章节，绿色 = 依赖它的章节"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" }, this.prog, this.grid,
          h("div", { class: "panel", style: "margin-top:12px" }, h("div", { class: "panel-title" }, "章节详情"), this.detail)));
    }
    render() {
      const sel = this.sel;
      const pre = new Set(), post = new Set();
      if (sel) {
        const walk = (n) => CHAPTERS.find((c) => c.n === n).pre.forEach((p) => { if (!pre.has(p)) { pre.add(p); walk(p); } });
        walk(sel);
        CHAPTERS.forEach((c) => { if (c.pre.includes(sel)) post.add(c.n); });
      }
      this.grid.innerHTML = "";
      PARTS.forEach((p) => {
        const col = h("div", { style: "display:flex;flex-direction:column;gap:8px" },
          h("div", null, h("div", { style: "font-weight:650;font-size:14.5px" }, p.name), h("div", { class: "small muted", style: "line-height:1.4" }, p.en)));
        CHAPTERS.filter((c) => c.part === p.id).forEach((c) => {
          const ready = !!c.href;
          let border = "var(--border)", bg = "var(--surface)";
          if (sel === c.n) { border = "var(--c-current)"; bg = "var(--warn-soft)"; }
          else if (pre.has(c.n)) { border = "var(--accent)"; bg = "var(--accent-soft)"; }
          else if (post.has(c.n)) { border = "var(--ok)"; bg = "var(--ok-soft)"; }
          const done = !!this.done[c.n];
          const card = h("button", { type: "button", style: `text-align:left;font:inherit;cursor:pointer;border:1.5px solid ${border};background:${bg};border-radius:10px;padding:8px 10px;color:var(--text)` },
            h("div", { style: "display:flex;justify-content:space-between;gap:6px;align-items:baseline" },
              h("span", { style: "font-weight:600;font-size:14px" }, `Ch ${c.n} ${c.title}`),
              done ? h("span", { class: "tag green" }, "已读") : ready ? h("span", { class: "tag blue" }, "有教程") : null),
            h("div", { class: "small muted", style: "line-height:1.35" }, c.en));
          card.addEventListener("click", () => { this.sel = this.sel === c.n ? null : c.n; this.render(); });
          col.append(card);
        });
        this.grid.append(col);
      });
      this.renderDetail();
      this.renderProgress();
    }
    renderDetail() {
      this.detail.innerHTML = "";
      if (!this.sel) {
        this.detail.append(h("p", { class: "small muted", style: "margin:0" }, "推荐路径：Ch1 → Ch2（2.1、2.2）→ Part II；或 Ch2（含 2.3）→ 直接进入 Part III。Part IV 建立在 Part II 之上。"));
        return;
      }
      const c = CHAPTERS.find((x) => x.n === this.sel);
      const part = PARTS.find((p) => p.id === c.part);
      this.detail.append(...[
        h("div", { style: "font-weight:650" }, `第 ${c.n} 章 ${c.title}`, h("span", { class: "muted", style: "font-weight:400" }, ` · ${c.en}`)),
        h("p", { style: "margin:4px 0" }, c.desc),
        c.key ? h("p", { class: "small", style: "margin:4px 0" }, h("b", null, "书中的阅读建议："), c.key) : null,
        h("p", { class: "small muted", style: "margin:4px 0" }, (c.pre.length ? "主要前置：" + c.pre.map((n) => "Ch" + n).join("、") : "没有前置要求。") + "（依据 1.5 节整理）"),
      ].filter(Boolean));
      const actions = h("div", { class: "controls", style: "margin:6px 0 0" });
      if (c.href) actions.append(h("a", { class: "btn primary", href: this.base + c.href }, "打开教程 →"));
      actions.append(h("a", { class: "btn", href: part.pdf, target: "_blank", rel: "noopener" }, `原书 ${part.name.split(" · ")[0]} PDF ↗`));
      if (this.progress) {
        const cb = h("input", { type: "checkbox", checked: !!this.done[c.n] });
        cb.addEventListener("change", () => { this.done[c.n] = cb.checked; store.set("pa-progress", this.done); this.render(); });
        actions.append(h("label", null, cb, "我已读完这一章"));
      }
      this.detail.append(actions);
    }
    renderProgress() {
      if (!this.progress) return;
      const n = CHAPTERS.filter((c) => this.done[c.n]).length;
      this.prog.innerHTML = "";
      this.prog.append(h("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:12px" },
        h("div", { style: "flex:1;height:8px;background:var(--surface-3);border-radius:99px;overflow:hidden" },
          h("div", { style: `height:100%;width:${(100 * n) / CHAPTERS.length}%;background:var(--ok);transition:width .3s` })),
        h("span", { class: "small" }, `已读 ${n} / ${CHAPTERS.length} 章（只保存在这个浏览器里）`)));
    }
  }

  PA.book = { PARTS, CHAPTERS };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='roadmap']").forEach((el) => new Roadmap(el));
  });
})();
