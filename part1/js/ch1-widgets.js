/* 第 1 章的互动组件：应用示例、基本要素对照、机器/环境与计划的用法 */
(function () {
  "use strict";
  const { h, s, arrowDefs } = PA;

  // ---------------------------------------------------------------
  // 1.2 动机示例：按书中的部分筛选
  // ---------------------------------------------------------------
  const APPS = [
    { t: "魔方、滑块拼图、下棋", part: "I", where: "第 2 章", tags: ["离散"], d: "状态有限、动作有限，天然是离散规划。离散规划技术也用在火星车、EO-1 卫星等航天任务里。" },
    { t: "Alpha 1.0 拼图", part: "II", where: "5.5 节", tags: ["连续"], d: "把两根扭曲的金属棒分开。没有规则网格和对称性可利用，必须在连续空间里规划；用 5.5 节的方法在 PC 上几分钟可解。" },
    { t: "汽车装配：雨刮器电机", part: "II", where: "Part II", tags: ["连续"], d: "直接在 CAD 模型上判断零件能否装入/取出车身腔体，省掉昂贵的实体样机。" },
    { t: "汽车密封（Volvo）", part: "II", where: "Part II", tags: ["连续"], d: "工程师只指定「沿接缝喷胶」这种高层任务，机器人的运动由规划软件自动算出。" },
    { t: "三台移动机器人搬钢琴", part: "II", where: "4.4、7.4 节", tags: ["连续", "闭链"], d: "名字取自 Piano Mover's Problem。机器人、钢琴和地面形成闭运动链（closed kinematic chain）。" },
    { t: "药物设计：分子对接", part: "II", where: "7.5 节", tags: ["连续"], d: "柔性小分子能否插入蛋白质的空腔且保持低能量？套上几何模型后，就和装配问题非常像。" },
    { t: "虚拟人、人形机器人、游戏角色", part: "II", where: "Part II", tags: ["连续"], d: "让角色/机器人接受高层指令（「去冰箱拿东西」），自动计算出全身运动，而不是逐帧手工指定。" },
    { t: "移动机器人导航与建图", part: "III", where: "第 11、12 章", tags: ["不确定性", "感知"], d: "在不确定性中建地图、定位、到达目标。传感器多就一定好吗？还是用很少的感知也能可靠完成任务？" },
    { t: "捉迷藏 / 洞穴搜救", part: "III", where: "第 11 章、12.4 节", tags: ["不确定性", "博弈"], d: "拿着灯笼进漆黑的洞穴：是否存在保证找到所有人的策略？要防止「逃跑者」溜回已搜过的地方，需要信息空间。" },
    { t: "多机器人协作与竞争", part: "III", where: "9.3、9.4、10.5、11.7、13.5 节", tags: ["博弈"], d: "如何通信、集中还是分布式协调、如何互相避碰；如果彼此竞争，就要用到博弈论。" },
    { t: "平行泊车、倒拖车", part: "IV", where: "第 13 章", tags: ["微分约束"], d: "车只能沿后轮方向运动（非完整约束 nonholonomic）。如果四个轮子都能任意转向，这个难题就消失了。" },
    { t: "高速驾驶、越野车", part: "IV", where: "Part IV", tags: ["微分约束", "动力学"], d: "速度一高就不能瞬间启停，必须把车当作有动量的动力系统；还可以用规划去「找」设计缺陷（验证）。" },
    { t: "直升机、航天器", part: "IV", where: "14.1.3 节", tags: ["微分约束", "动力学"], d: "绕开空间站结构计算推力；为可重复使用飞行器设计再入轨迹；甚至用于太阳帆的星际任务规划。" },
  ];

  class Apps {
    constructor(root) {
      this.root = root; this.f = "all";
      const chips = h("div", { class: "chips" });
      [["all", "全部"], ["I", "Part I"], ["II", "Part II"], ["III", "Part III"], ["IV", "Part IV"]].forEach(([k, t]) => {
        const b = h("button", { type: "button", class: "chip" + (k === this.f ? " on" : "") }, t);
        b.addEventListener("click", () => { this.f = k; chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); this.render(); });
        chips.append(b);
      });
      this.cards = h("div", { class: "cards" });
      root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "1.2 节的应用示例"), h("span", { class: "w-sub" }, "按「这本书在哪一部分讲它」筛选"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" }, chips, this.cards));
      this.render();
    }
    render() {
      const tagCls = { 离散: "blue", 连续: "green", 不确定性: "amber", 感知: "amber", 博弈: "red", 微分约束: "red", 动力学: "red", 闭链: "green" };
      this.cards.innerHTML = "";
      APPS.filter((a) => this.f === "all" || a.part === this.f).forEach((a) => {
        this.cards.append(h("div", { class: "card" }, h("h4", null, a.t), h("p", null, a.d),
          h("div", { class: "tags" }, h("span", { class: "tag" }, `Part ${a.part} · ${a.where}`), a.tags.map((t) => h("span", { class: "tag " + (tagCls[t] || "") }, t)))));
      });
    }
  }

  // ---------------------------------------------------------------
  // 1.3 规划的基本要素：同一张表，换不同的例子
  // ---------------------------------------------------------------
  const ING = [
    { k: "state", name: "状态 State", en: "state space", def: "刻画所有可能出现的情形。可以是离散的（有限或可数无限），也可以是连续的（不可数无限）。通常被<b>隐式</b>表示——太大了，没法显式列出。" },
    { k: "time", name: "时间 Time", en: "time", def: "所有规划问题都是一串随时间做出的决策。时间可以显式建模，也可以是隐式的——只要求动作的先后顺序。" },
    { k: "action", name: "动作 Actions", en: "actions / operators / inputs / controls", def: "计划产生动作来改变状态。必须指明动作如何改变状态：离散时间里是一个状态值函数，连续时间里是常微分方程。" },
    { k: "ig", name: "初始与目标", en: "initial and goal states", def: "从某个初始状态出发，到达某个目标状态（或目标集合中的任意一个）。" },
    { k: "crit", name: "准则 Criterion", en: "feasibility vs. optimality", def: "<b>可行性</b>：只要到达目标；<b>最优性</b>：在可行的前提下，按某种细致定义的方式优化性能。本书大部分问题光是可行性就够难了。" },
    { k: "plan", name: "计划 Plan", en: "plan", def: "给决策者施加的策略或行为。可以只是一个动作序列；预测不了未来就做成「状态 → 动作」的反馈；连状态都测不到，就以<b>信息状态</b>为条件。" },
  ];
  const EX = {
    cube: { name: "魔方", kind: "离散", v: {
      state: "魔方的所有构型（整体朝向无关），约 4.3 × 10¹⁹ 个——只能隐式表示。",
      time: "隐式：只需要动作的先后顺序，不关心每一步花多久。",
      action: "12 种：把某一层 3×3 小块转 90°（Example 2.2）。",
      ig: "初始：某个打乱的构型；目标：六个面各自同色。",
      crit: "可行性（能还原就行）；或最优性（步数最少）。",
      plan: "一个有限的动作序列。" } },
    grid: { name: "网格机器人", kind: "离散", v: {
      state: "整数坐标 (i, j) ∈ ℤ²；涂黑的格子是障碍，从状态空间中删除（Example 2.1）。",
      time: "离散的步：k = 1, 2, 3, …",
      action: "U = {(0,1), (0,−1), (1,0), (−1,0)}，f(x,u) = x + u。",
      ig: "x_I = (0,0)，X_G = {(100,100)}。",
      crit: "可行性；或最少步数 / 最小代价（第 2.3 节）。",
      plan: "动作序列；或者是一个告诉你在每个格子该往哪走的反馈（第 8 章）。" } },
    piano: { name: "搬钢琴", kind: "连续", v: {
      state: "钢琴的位置与朝向：配置空间（第 4 章），连续、不可数。",
      time: "隐式：解是一条路径，可以做成动画，但计划不规定速度。",
      action: "平移与旋转；运动规划里通常直接给出连续状态空间中的一条路径。",
      ig: "从一个房间到另一个房间。",
      crit: "可行性：找到一条不碰撞的路径。",
      plan: "配置空间中的一条无碰撞路径。" } },
    park: { name: "平行泊车", kind: "连续 + 微分约束", v: {
      state: "车的位置和朝向 (x, y, θ)；高速时还要加上速度（Part IV）。",
      time: "连续时间。",
      action: "速度与转向输入；车只能沿后轮指向的方向移动，这是微分约束。",
      ig: "从路上停进车位。",
      crit: "可行性（不刮蹭）；或时间最短。",
      plan: "输入随时间变化的函数；或根据当前状态给出输入的反馈律。" } },
    hover: { name: "冰面气垫船", kind: "连续 + 动力学", v: {
      state: "位置和速度（控制论里的状态 / 物理里的相空间）。",
      time: "连续时间，状态满足微分方程。",
      action: "推力输入（control）。",
      ig: "从一处静止出发，最后静止在另一处。",
      crit: "可行性已经很难；可再加上最省能量 / 最省时间。",
      plan: "控制律（control law）/ 反馈策略（policy）。" } },
    cave: { name: "洞穴搜救", kind: "离散/连续 + 不确定性", v: {
      state: "搜索者的位置——但真正需要的是「哪些区域可能还藏着人」，即信息状态（第 11 章）。",
      time: "可以离散也可以连续。",
      action: "移动、用灯照；逃跑者的移动不受我们控制。",
      ig: "从洞口出发；目标是保证找到所有人。",
      crit: "可行性：最坏情况下也必须成功。",
      plan: "以信息状态为条件的策略（12.4 节）。" } },
  };

  class Ingredients {
    constructor(root) {
      this.root = root; this.ex = "cube";
      const chips = h("div", { class: "chips" });
      Object.entries(EX).forEach(([k, e]) => {
        const b = h("button", { type: "button", class: "chip" + (k === this.ex ? " on" : "") }, e.name);
        b.addEventListener("click", () => { this.ex = k; chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b)); this.render(); });
        chips.append(b);
      });
      this.table = h("div", { class: "table-wrap" });
      root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "规划的六个基本要素"), h("span", { class: "w-sub" }, "1.3 节：换一个例子，看同一套要素怎么落地"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" }, chips, this.table));
      this.render();
    }
    render() {
      const e = EX[this.ex];
      const t = h("table", { class: "data" });
      t.append(h("thead", null, h("tr", null, h("th", { style: "width:22%" }, "要素"), h("th", { style: "width:38%" }, "书中的一般说法"), h("th", null, `例子：${e.name} `, h("span", { class: "tag blue" }, e.kind)))));
      const tb = h("tbody");
      ING.forEach((g) => tb.append(h("tr", null,
        h("td", null, h("b", null, g.name), h("div", { class: "small muted" }, g.en)),
        h("td", { class: "small", html: g.def }),
        h("td", null, e.v[g.k]))));
      t.append(tb);
      this.table.innerHTML = "";
      this.table.append(t);
    }
  }

  // ---------------------------------------------------------------
  // 1.4 机器与环境的边界（图 1.16）+ 计划的三种用法（图 1.18–1.20）
  // ---------------------------------------------------------------
  const PIECES = ["规划算法", "计算机", "电机驱动器", "机械臂", "夹爪里的杯子", "桌子与房间"];

  class PlanUse {
    constructor(root) {
      this.root = root; this.tab = "boundary"; this.cut = 3; this.refStep = 0;
      this.tabs = h("div", { class: "seg" });
      [["boundary", "机器 / 环境边界"], ["exec", "执行 Execution"], ["refine", "精化 Refinement"], ["hier", "层级包含 Hierarchical"]].forEach(([k, t]) => {
        const b = h("button", { type: "button", class: k === this.tab ? "on" : "" }, t);
        b.addEventListener("click", () => { this.tab = k; this.tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); this.render(); });
        this.tabs.append(b);
      });
      this.body = h("div");
      root.append(
        h("div", { class: "widget-head" }, h("span", { class: "w-title" }, "算法、规划器与计划"), h("span", { class: "w-sub" }, "1.4 节 · 图 1.16、1.18、1.19、1.20"), h("span", { class: "w-badge" }, "互动")),
        h("div", { class: "widget-body" }, h("div", { class: "controls" }, this.tabs), this.body));
      this.render();
    }
    render() {
      this.body.innerHTML = "";
      if (this.tab === "boundary") this.renderBoundary();
      else if (this.tab === "exec") this.renderExec();
      else if (this.tab === "refine") this.renderRefine();
      else this.renderHier();
    }
    renderBoundary() {
      const slider = h("input", { type: "range", min: 1, max: PIECES.length - 1, value: this.cut, "aria-label": "边界位置" });
      slider.addEventListener("input", () => { this.cut = +slider.value; this.render(); });
      const W = 720, bw = 100, gap = 14, x0 = 20;
      const svg = s("svg", { viewBox: `0 0 ${W} 190`, role: "img", "aria-label": "机器与环境的边界" });
      arrowDefs(svg, { "pu-a": "var(--accent)", "pu-b": "var(--ok)" });
      const bx = x0 + this.cut * (bw + gap) - gap / 2;
      svg.append(s("rect", { x: 6, y: 40, width: bx - 6, height: 76, rx: 12, fill: "var(--accent-soft)", stroke: "var(--accent)", "stroke-dasharray": "5 4" }));
      svg.append(s("rect", { x: bx, y: 40, width: W - bx - 6, height: 76, rx: 12, fill: "var(--ok-soft)", stroke: "var(--ok)", "stroke-dasharray": "5 4" }));
      svg.append(s("text", { x: (6 + bx) / 2, y: 30, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--accent-text)" }, "机器 M"));
      svg.append(s("text", { x: (bx + W) / 2, y: 30, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--ok)" }, "环境 E"));
      PIECES.forEach((p, i) => {
        const x = x0 + i * (bw + gap);
        svg.append(s("rect", { x, y: 58, width: bw, height: 40, rx: 8, fill: "var(--surface)", stroke: "var(--border-strong)" }));
        svg.append(s("text", { x: x + bw / 2, y: 83, "text-anchor": "middle", "font-size": 12.5, fill: "var(--text)" }, p));
      });
      svg.append(s("line", { x1: bx, y1: 36, x2: bx, y2: 122, stroke: "var(--c-current)", "stroke-width": 3 }));
      svg.append(s("path", { d: `M${bx - 60},140 Q${bx},165 ${bx + 60},140`, fill: "none", stroke: "var(--accent)", "stroke-width": 2, "marker-end": "url(#pu-a)" }));
      svg.append(s("text", { x: bx, y: 180, "text-anchor": "middle", "font-size": 12.5, fill: "var(--accent-text)" }, "执行 actuation →"));
      svg.append(s("path", { d: `M${bx + 60},128 Q${bx},150 ${bx - 60},128`, fill: "none", stroke: "var(--ok)", "stroke-width": 2, "marker-end": "url(#pu-b)" }));
      svg.append(s("text", { x: bx, y: 136, "text-anchor": "middle", "font-size": 12.5, fill: "var(--ok)" }, "← 感知 sensing"));
      this.body.append(
        h("label", { style: "display:flex;gap:10px;align-items:center;font-size:14px" }, "拖动边界：", slider),
        h("div", { class: "svg-wrap" }, svg),
        h("p", { class: "small", style: "margin:4px 0 0" },
          `现在「${PIECES.slice(0, this.cut).join("、")}」算机器，「${PIECES.slice(this.cut).join("、")}」算环境。` +
          "书里强调：这条线是任意画的，取决于问题。一旦画定，机器只通过感知（输入）和执行（输出）与环境交互——这正是 Turing 机模型不够用的地方：Turing 机假设世界事先都写在纸带上了。"));
    }
    renderExec() {
      const box = (svg, x, y, w, hh, label, fill, stroke) => {
        svg.append(s("rect", { x, y, width: w, height: hh, rx: 9, fill, stroke }));
        svg.append(s("text", { x: x + w / 2, y: y + hh / 2 + 5, "text-anchor": "middle", "font-size": 13.5, fill: "var(--text)" }, label));
      };
      const mk = (title, machineLabel) => {
        const svg = s("svg", { viewBox: "0 0 330 210", role: "img", "aria-label": title });
        arrowDefs(svg, { ["ex-" + machineLabel.length]: "var(--muted)" });
        const id = "ex-" + machineLabel.length;
        box(svg, 115, 10, 100, 36, "规划器 Planner", "var(--warn-soft)", "var(--warn)");
        box(svg, 95, 90, 140, 40, machineLabel, "var(--accent-soft)", "var(--accent)");
        box(svg, 95, 166, 140, 36, "环境 E", "var(--ok-soft)", "var(--ok)");
        svg.append(s("line", { x1: 165, y1: 46, x2: 165, y2: 88, stroke: "var(--muted)", "stroke-width": 1.8, "marker-end": `url(#${id})` }));
        svg.append(s("text", { x: 172, y: 72, "font-size": 12, fill: "var(--muted)" }, machineLabel === "机器 M" ? "计划 Plan" : "设计出整台机器"));
        svg.append(s("path", { d: "M 120 130 C 70 145, 70 160, 110 168", fill: "none", stroke: "var(--muted)", "stroke-width": 1.6, "marker-end": `url(#${id})` }));
        svg.append(s("path", { d: "M 220 168 C 260 160, 260 145, 212 131", fill: "none", stroke: "var(--muted)", "stroke-width": 1.6, "marker-end": `url(#${id})` }));
        svg.append(s("text", { x: 20, y: 152, "font-size": 11.5, fill: "var(--muted)" }, "执行"));
        svg.append(s("text", { x: 268, y: 152, "font-size": 11.5, fill: "var(--muted)" }, "感知"));
        return h("div", { class: "panel" }, h("div", { class: "panel-title" }, title), h("div", { class: "svg-wrap", style: "padding:6px" }, svg));
      };
      this.body.append(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px" },
        mk("(a) 计划作为输入交给可编程机器", "机器 M"), mk("(b) 计划本身就是一台专用机器", "机器 / 计划")),
        h("p", { class: "small", style: "margin:8px 0 0" }, "(a) 中计划交给机器后，机器就自主运行，不再和规划器交互（书中对自主性的严格要求：计划本身就应该考虑执行时会出现的新信息）。(b) 中规划器设计出的是整台机器——可以追求「极简」，设计足以完成任务的最简单的机器；如果它是有限状态机，有时也可以看作 Turing 意义下的算法。"));
    }
    renderRefine() {
      const steps = [
        ["世界的几何模型", "输入：房间、障碍物、机器人的几何描述（第 3 章）。"],
        ["计算无碰撞路径", "第一版计划：一条在建筑里不碰撞的路径（Part II，第 4–6 章）。"],
        ["平滑以满足微分约束", "第二版：把路径改成满足车轮运动约束的路径，比如车不能横着走（Part IV，第 13–14 章；回忆图 1.11 的泊车）。"],
        ["设计轨迹（速度函数）", "第三版：决定沿路径以什么速度走，满足动量等考虑。"],
        ["设计跟踪反馈律", "第四版：加入反馈，在不可预测的扰动下尽量贴着规划的路径走（第 8 章、14.6.1 节）。"],
        ["执行反馈计划", "最终在机器人上执行。"],
      ];
      const list = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center" });
      steps.forEach(([t], i) => {
        const b = h("button", { type: "button", class: "btn" + (i === this.refStep ? " active" : "") }, `${i + 1}. ${t}`);
        b.addEventListener("click", () => { this.refStep = i; this.render(); });
        list.append(b);
        if (i < steps.length - 1) list.append(h("span", { class: "muted" }, "→"));
      });
      this.body.append(list,
        h("div", { class: "msg info", style: "margin-top:10px" }, steps[this.refStep][1]),
        h("p", { class: "small", style: "margin:6px 0 0" }, "图 1.19：机器人学里沿用了几十年的精化（refinement）流水线。每一步把上一步的计划当作输入，产生一个考虑了更多问题因素的新计划。"));
    }
    renderHier() {
      const svg = s("svg", { viewBox: "0 0 700 230", role: "img", "aria-label": "层级包含" });
      // 嵌套的 M1/E1/M2/E2（图 1.20）
      svg.append(s("rect", { x: 10, y: 20, width: 330, height: 200, rx: 14, fill: "var(--ok-soft)", stroke: "var(--ok)" }));
      svg.append(s("text", { x: 24, y: 42, "font-size": 14, "font-weight": 700, fill: "var(--ok)" }, "E1"));
      svg.append(s("rect", { x: 30, y: 90, width: 70, height: 50, rx: 8, fill: "var(--accent-soft)", stroke: "var(--accent)" }));
      svg.append(s("text", { x: 65, y: 120, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: "var(--accent-text)" }, "M1"));
      svg.append(s("rect", { x: 130, y: 50, width: 195, height: 150, rx: 12, fill: "var(--surface)", stroke: "var(--ok)", "stroke-dasharray": "5 4" }));
      svg.append(s("text", { x: 142, y: 70, "font-size": 13, "font-weight": 700, fill: "var(--ok)" }, "E2"));
      svg.append(s("rect", { x: 200, y: 100, width: 70, height: 50, rx: 8, fill: "var(--accent-soft)", stroke: "var(--accent)" }));
      svg.append(s("text", { x: 235, y: 130, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: "var(--accent-text)" }, "M2"));
      svg.append(s("text", { x: 175, y: 215, "text-anchor": "middle", "font-size": 11.5, fill: "var(--muted)" }, "M1 的环境里包含另一台机器 M2"));
      // 计划树
      const node = (x, y, t, sub_) => { svg.append(s("rect", { x: x - 52, y: y - 16, width: 104, height: 32, rx: 8, fill: "var(--warn-soft)", stroke: "var(--warn)" })); svg.append(s("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 12.5, fill: "var(--text)" }, t)); if (sub_) svg.append(s("text", { x, y: y + 30, "text-anchor": "middle", "font-size": 10.5, fill: "var(--muted)" }, sub_)); };
      const edge = (x1, y1, x2, y2) => svg.append(s("line", { x1, y1: y1 + 16, x2, y2: y2 - 16, stroke: "var(--border-strong)", "stroke-width": 1.5 }));
      edge(530, 45, 430, 120); edge(530, 45, 530, 120); edge(530, 45, 630, 120); edge(430, 120, 400, 190); edge(430, 120, 465, 190);
      node(530, 45, "主计划（根）", "");
      node(430, 120, "子计划：开门"); node(530, 120, "子计划：穿过走廊"); node(630, 120, "子计划：放下杯子");
      svg.append(s("rect", { x: 370, y: 178, width: 60, height: 26, rx: 6, fill: "var(--surface-2)", stroke: "var(--border-strong)" }));
      svg.append(s("text", { x: 400, y: 195, "text-anchor": "middle", "font-size": 11, fill: "var(--text-2)" }, "抓门把"));
      svg.append(s("rect", { x: 437, y: 178, width: 60, height: 26, rx: 6, fill: "var(--surface-2)", stroke: "var(--border-strong)" }));
      svg.append(s("text", { x: 467, y: 195, "text-anchor": "middle", "font-size": 11, fill: "var(--text-2)" }, "转动"));
      svg.append(s("text", { x: 530, y: 225, "text-anchor": "middle", "font-size": 11.5, fill: "var(--muted)" }, "每个顶点是一个计划；孩子是被当作「一个动作」用在父计划里的子计划"));
      this.body.append(h("div", { class: "svg-wrap" }, svg),
        h("p", { class: "small", style: "margin:6px 0 0" }, "层级包含（hierarchical inclusion）：把一个计划打包成更高层计划里的一个动作，就像子程序。前提是子计划保证终止，否则父计划没法继续执行后面的动作。反复这样做就得到一棵以主计划为根的计划树；机器与环境的分界线也被画在多个地方（右图的例子是为了说明而虚构的）。"));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-widget='apps']").forEach((el) => new Apps(el));
    document.querySelectorAll("[data-widget='ingredients']").forEach((el) => new Ingredients(el));
    document.querySelectorAll("[data-widget='plan-use']").forEach((el) => new PlanUse(el));
  });
})();
