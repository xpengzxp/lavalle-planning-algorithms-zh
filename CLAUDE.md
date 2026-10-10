# Planning Algorithms 学习站 —— 给 Claude 的编写约定

这个文件夹是用户学习 LaValle《Planning Algorithms》的个人学习站。用户会在**多个并行的 Claude 会话**里各写一章，所有章节都必须从同一个学习主页 `index.html` 进入。新建任何教程前先读完本文件。

## 1. 目录布局（唯一的约定，不要另起一套）

```
Planning Algorithm/
├── index.html                 学习主页：每章一张卡片 + 全书路线图 + 进度勾选
├── README.md                  给人看的说明（怎么打开、有哪些章）
├── CLAUDE.md                  本文件
├── assets/                    共用样式与脚本
│   ├── style.css              CSS 变量、顶栏、布局、目录、提示框等
│   ├── common.js              深色模式(localStorage 键 pa-theme)、目录高亮、KaTeX 渲染、PA.* 小工具
│   └── roadmap.js             全书路线图；CHAPTERS 数组是章节的唯一登记表
├── book/                      原书 PDF：parN.pdf 或 chK.pdf
├── part1/  Part I  入门材料     第 1–2 章
├── part2/  Part II 运动规划     第 3–8 章
├── part3/  Part III 决策论规划  第 9–12 章
└── part4/  Part IV 微分约束     第 13–15 章
```

每个 `partN/` 里：

- 章节页 `chK-<english-slug>.html`，例如 `part2/ch3-geometric-representations.html`。一章一个文件。
- 该部分的互动组件放 `partN/js/`，可运行的参考代码放 `partN/code/`（可选）。
- 一章若做成**自包含单文件**（样式、脚本都内联，如第 3 章）也可以，但顶栏、面包屑、深浅色键必须与主页一致（见第 3 节）。

## 2. 新增一章的固定流程（逐项做完，缺一不可）

1. **下载并通读原书 PDF**：下载到 `book/`，地址是 `https://lavalle.pl/planning/chK.pdf`（单章）或 `parN.pdf`（整部分）。
   - **通读**：必须用 Read 工具**直接读 PDF**，从第一页读到最后一页，一页都不跳（`pages` 参数，每次最多 20 页，分几次读完）。不能用提取出来的 txt 代替阅读。
   - **笔记**：边读边把各节的要点、式号、图号、例题记进 scratchpad 里的笔记，以免上下文被压缩后丢失细节。
   - **回看**：写某一节时，如果需要核对细节，回到 PDF 原页再看一遍。
   - **原书笔误**：标「原书笔误」之前，必须对着 PDF 原页确认过。
   - **JS 检查**：这台 Mac 没有 `node`，JS 语法靠在浏览器里加载页面来检查。
2. **写章节页** `partN/chK-<slug>.html`，遵守第 3 节的写法约定。
3. **登记到主页** `index.html`：在对应 Part 的 `<div class="chapter-cards">` 里加一张 `<a class="chapter-card" href="partN/chK-….html">` 卡片（结构照抄已有卡片：`.num` 章号、`<h3>中文 <span class="en">English</span></h3>`、一段 `<p>` 概述、`.tags` 列出该章的互动图）。若该 Part 的标题还写着「进行中 / 未开始」，按实际情况更新。
4. **登记到路线图** `assets/roadmap.js`：在 `CHAPTERS` 里找到该章的条目，填上 `href: "partN/chK-….html"`（条目已预先存在，只缺 href）。
5. **更新 README.md** 的章节进度表。
6. **验证**：用 `.claude/launch.json` 里的 `study-site`（`python3 -m http.server 8765`）或直接打开文件，确认：主页卡片能点进去；章节页顶栏能回到主页；路线图里该章变成可点击；深浅色切换两边一致；浏览器控制台无报错。
7. 不要改动其他会话正在写的章节文件；只改自己这一章和上面列出的登记点。

## 3. 章节页写法

- **语言**：中文讲解，关键术语首次出现附英文（如「代价到达 cost-to-come」）。公式、记号、式号、图号与原书一致，便于对照 PDF。
- **结构**：顶栏（`header.topbar`：品牌链接回 `../index.html`、面包屑「首页 › Part N › 第 K 章 标题」、`#theme-toggle` 按钮）→ 左侧本章目录 → 正文。导读说明本章在全书中的位置和读法；文末给速查表 / 要点、常见陷阱、习题导引。
- **互动图**：凡是画图能帮助理解的概念都做成可交互图，嵌在对应概念旁边，不要堆在章末。每个图下给「试一试」提示，列出值得观察的 2–3 个现象。颜色只用 CSS 变量，深色模式自动生效。
- **公式**：共享布局的页面用 KaTeX 0.16.9（jsDelivr；行内 `\( \)`，行间 `$$ $$`）；自包含页面可用 MathJax 3 tex-svg（cdnjs）。两者都只需联网，无构建步骤。
- **深浅色**：主页用 `localStorage` 键 `pa-theme`（JSON 字符串 `"dark"`/`"light"`）并在 `<html>` 上设 `data-theme`。自包含页面在 `<body>` 开头读取同一个键，并提供同样的 `#theme-toggle` 按钮，保证从主页进来后主题一致。
- **真实性**：书中没有、由我们补充的内容标明「补充」；原书笔误用脚注指出，不悄悄改掉；数值例子先用 `partN/code/` 里的参考实现验证再写进页面。
- **纯静态**：原生 HTML/CSS/JS，双击即可打开，不引入构建工具。

## 4. 现有章节（登记表，新章追加）

| 章 | 文件 | 互动图 | 说明 |
|---|---|---|---|
| 1 | `part1/ch1-introduction.html` | 应用示例、六要素、路线图 | 共享布局 |
| 2 | `part1/ch2-discrete-planning.html` | 搜索实验室、值迭代、STRIPS、规划图、SAT | 共享布局 + `part1/js/` + `part1/code/discrete_planning.py` |
| 3 | `part2/ch3-geometric-representations.html` | 12 个：半平面交、姜饼人脸、超椭圆、齐次矩阵、YPR、三连杆、DH、PUMA 560、辛烷、运动树、闭环、线性变换 | 自包含单文件，颜色约定：绿 = 障碍 O，红 = 机器人 A，蓝 = 坐标系 |
| 4 | `part2/ch4-configuration-space.html` | 15 个：内点/边界点、有限拓扑检查器、区间同胚、流形检测、粘合正方形（习题 27）、同伦与基本群、O(2)、柱面规划、四元数、一维 Minkowski、星形算法（含旋转）、两连杆 C-space、两连杆簇、三连杆簇/四连杆、连杆图与 Grübler | 共享布局 + `part2/js/ch4-*.js` + `part2/code/ch4_configuration_space.py`；颜色沿用第 3 章：绿 = 障碍，红 = 机器人，蓝 = 坐标/路径 |
| 5 | `part2/ch5-sampling-based-planning.html` | 21 处（19 种）：Lp 度量、SO(2) 距离、位移度量、球面/SO(3) 采样、van der Corput、采样方法对比（×3：随机/Sukharev/Halton）、维数灾难、包围体层次、特征 Voronoi、路径段检查、连杆 Lipschitz、网格 A*、随机势场、RDT 探索、Kd 树、RRT 规划器、PRM、可见性路线图、采样启发式 | 共享布局 + `part2/js/ch5-*.js`（`ch5-lib.js` 是本章共用库，组件实例挂在 `el._w` 上便于调试）+ `part2/code/ch5_sampling.py`；2D 图都直接画在 C-space 里：灰 = Cobs，绿 = 解路径，蓝 = qI 树，紫 = qG 树 |
| 6 | `part2/ch6-combinatorial-motion-planning.html` | 23 处（20 种）：路线图两条件、双向边表、图 6.2 四种情形、平面扫描（图 6.6/6.7）、单元分解规划器（×3：垂直分解/三角剖分/柱形分解）、等距曲线（图 6.8/6.9）、最大间隙路线图、最短路路线图（含径向扫描）、双切线测试 (6.1)(6.2)、单纯复形检查、三维垂直分解、雷达图与临界曲线（×2：图 6.22/6.26）、Nicomedes 蚌线、Tarski 语句、符号分配、一维分解、柱形代数分解、Canny 路线图、双重 vs 单指数、DS 序列与下包络 | 共享布局 + `part2/js/ch6-*.js`（`ch6-lib.js` 是本章共用库，组件实例挂在 `el._w` 上）+ `part2/code/ch6_combinatorial.py`；颜色沿用第 5 章：灰 = Cobs，绿 = 解路径，蓝 = 单元/路线图，橙 = 扫描线/事件，紫 = Voronoi/临界曲线，红 = 线段机器人 |
| 7 | `part2/ch7-extensions-of-basic-motion-planning.html` | 25 个：时变 X = C×T（例 7.1）、柱体与传递性（图 7.2）、ρ_X 与速度锥 RDT、速度调节（图 7.4/7.5）、装配规划、优先级规划（图 7.8）、两机器人协调空间（含图 7.43）、三机器人柱形障碍（图 7.9）、立方复形（图 7.10）、门卫室（例 7.2）、可重构机器人（例 7.3）、操作规划子集（图 7.15）、transit/transfer 与操作图（图 7.16）、沿 C_clo 步进的 RDT（图 7.21/7.22）、主动–被动分解与环生成器、关节角的界（图 7.26）、纸箱折叠、能量软障碍（式 7.25）、结的化简、牛耕式分解、生成树覆盖、三种动作模型、单位步长可达集（例 7.6）、加权区域（例 7.7）、Pareto 最优协调（图 7.42） | 共享布局 + `part2/js/ch7-*.js`（`ch7-lib.js` 是本章共用库，组件实例挂在 `el._w` 上）+ `part2/code/ch7_extensions.py`；颜色：灰 = 障碍 O / X_obs，绿 = 解路径；多机器人 A¹ 蓝、A² 粉、A³ 琥珀；操作规划 transit 蓝、transfer 琥珀 |
| 8 | `part2/ch8-feedback-motion-planning.html` | 18 个：开环 vs 反馈、网格导航函数（图 8.2/8.3）、wavefront 与 Dial、NF2 最大间隙、向量场与积分曲线、Filippov 切换边界、S¹ 坐标邻域与坐标变换、S² 切空间、吸引 + 排斥势与局部极小、三角剖分上的向量场（图 8.10/8.11）、可见性最优导航函数（图 8.13）、加速度控制模型、Rimon–Koditschek 导航函数与临界点、调和势函数（Gauss–Seidel）、SE(2) 无碰球 (8.53)、增量覆盖与漏斗组合、插值 (8.57)–(8.59)、带插值的值迭代（含类 Dijkstra） | 共享布局 + `part2/js/ch8-*.js`（`ch8-lib.js` 是本章共用库：`Stage`（含针状图 `needles`、热图 `heat`、等值线 `contours`）、`Region`（多边形区域与可见多边形）、RK4 积分、网格 wavefront；组件实例挂在 `el._w` 上）+ `part2/code/ch8_feedback.py`；颜色沿用第 5 章：深灰 = 障碍 / Cobs，粉 = 目标 x_G，蓝 = 起点与针状图，绿 = 积分曲线 / 执行轨迹，蓝色由浅到深 = cost-to-go / 势函数由小到大 |
| 9 | `part3/ch9-basic-decision-theory.html` | 18 个：Pareto 最优、两颗骰子事件实验室、贝叶斯马赛克、随机化策略与猜硬币、先验单纯形、决策准则实验室、噪声传感器、OCR 分类器、参数估计、零和矩阵博弈实验室、上 / 下包络、双矩阵 Nash 均衡、三人博弈改选图、效用与彩票、偏好三角形、频率学派风险、无信息先验、重复囚徒困境 | 共享布局 + `part3/js/ch9-*.js`（`ch9-lib.js` 是本章共用库：坐标图 `Plot`、矩阵编辑器 `MatrixEditor`、零和 LP 求解 `solveZeroSum` 等；组件实例挂在 `el._w` 上）+ `part3/code/ch9_decision_theory.py`；**Part III 颜色约定（第 10–12 章沿用）**：蓝 = 机器人 / P₁ 的动作 u（矩阵的行），橙 = 自然 / P₂ 的动作 θ、v（列），绿 = 选中的最优 / 鞍点 / 均衡，红 = 最坏情况 / 遗憾 / 被支配，紫 = 概率分布（先验、后验、随机化策略）；按动作分区域着色时用类别色 u₁ 蓝、u₂ 粉、u₃ 棕、u₄ 灰蓝 |
| 10 | `part3/ch10-sequential-decision-theory.html` | 18 个：网格上的自然（例 10.2）、数轴前向投影（例 10.3/10.4，含反馈计划）、弱 / 强反向投影（例 10.5）、计划与 G_π（可能 / 保证可达）、图 10.3 循环与渐近收敛、值迭代实验室（图 10.1，无自然 / 例 10.2 / 侧滑，最坏 / 期望）、策略迭代（例 10.7，精确分数）、反向投影算法与非确定 Dijkstra（冰面世界）、折扣因子（图 10.10）、机器保养 MDP（折扣 / 平均代价）、MC / TD(λ) / 常数 ρ 评估、Q-learning、博弈树与 alpha-beta（图 10.12–10.16、10.23）、三种信息模型（图 10.17/10.18，(10.105)(10.106)）、走廊追逐（(10.110)(10.111)(10.113)）、有自然的博弈（图 10.19）、与自然对抗的运动规划（像图 10.20）、会开关的门（Formulation 10.5） | 共享布局 + `part3/js/ch10-*.js`（`ch10-lib.js` 是本章共用库：`Stage`、`Grid`（自然模型 + 值迭代扫描 `viSweep`）、精确分数 `Frac`、矩阵博弈单纯形 `matrixGame`、`lineChart`；组件实例挂在 `el._w` 上）+ `part3/code/ch10_sequential_decision.py`；颜色沿用第 9 章的 Part III 约定（橙 = 自然 / P₂，紫 = 随机化策略），另外：绿 = 目标 X_G 与执行轨迹，红 / 浅红 = ∞，蓝色由浅到深 = 代价到目标由小到大，斜线格 = 冰面 |
| 11 | `part3/ch11-sensors-and-information-spaces.html` | 17 个：传感器与原像（例 11.1–11.9）、三状态例子（历史 I-state + 不确定 I-state + pow(X) 的 Hasse 图，例 11.13）、I-map 充分性检验（补充）、概率 I-state 在单纯形上（例 11.14 + 习题 5）、整数线（例 11.15 符号传感器 / 例 11.16 目标可识别性）、L 形走廊（例 11.17，κ_stage / κ₃ / κ₁₉）、NFA 与子集构造（例 11.18/11.19）、简单移动机器人与保守近似（例 11.23 + (11.60)(11.61)）、传感器目录（11.5.1）、正弦曲线（例 11.20）、图上的点（例 11.21，图 11.21 的 8 块）、圆盘上方还是下方（例 11.22）、托盘倾斜（例 11.24，栅格版）、卡尔曼滤波、网格 / 粒子 / 矩近似（一维走廊）、博弈信息模型（图 11.30、例 11.26）、战舰（例 11.27） | 共享布局 + `part3/js/ch11-*.js`（`ch11-lib.js` 是本章共用库：`Stage`、栅格集合 `Raster`（膨胀 / 求交，表示 2D 不确定 I-state）、最小包围圆、`matrixGame` 单纯形、2×2 线性代数与协方差椭圆；组件实例挂在 `el._w` 上）+ `part3/code/ch11_information_spaces.py`；颜色沿用 Part III 约定，并约定：蓝 = 机器人的动作与它知道的不确定 I-state，橙 = 自然 / 观测与原像 H(y)，紫 = 概率 I-state，绿 = 目标，深色实心点 = 隐藏的真实状态，黄 = 保守近似（同图 11.10） |
| 12 | `part3/ch12-planning-under-sensing-uncertainty.html` | 18 个：I_ndet 上的值迭代（走廊玩具，(12.7)(12.8)）、双状态 POMDP（α-向量下包络、精确枚举、插值近似 (12.10)）、被动定位（图 12.2a / 12.3b / 12.54，例 12.1、12.2、习题 1、指南针）、主动定位计划树（可达 I-state 上的最坏情况值迭代）、可见性定位（H(y)、叠图、可见性单元分解）、概率网格定位（(12.20)–(12.22)）、蒙特卡洛定位（图 12.11）、判定环境（例 12.4、12.5、e1–e9）、Blum–Kozen 迷宫搜索（纬度 + r mod 3、虚拟细墙）、D*（图 12.18/12.19）、Bug1 / Bug2（(12.25)(12.26)）、迷路的牛与竞争比、间隙导航树（含图 12.35）、EM 建图（线性高斯简化）、可见性追逃（污染 / 清除、V(V(p))、G_I 搜索）、摩擦锥（图 12.44）、反向投影（图 12.46–12.49）、挤压零件（图 12.50–12.53） | 共享布局 + `part3/js/ch12-*.js`（`ch12-lib.js` 是本章共用库：`Plot`、多边形几何与可见多边形 `visPoly`、栅格环境 `GridEnv`（格子视线 / 阴影分量）、树布局 `layoutTree`/`drawTree`、离散定位世界 `TileWorld`/`drawTiles`；组件实例挂在 `el._w` 上）+ `part3/code/ch12_sensing_uncertainty.py`；颜色沿用 Part III 约定，另外：橙 = 非确定 I-state 里还可能的状态，紫 = 概率 I-state（信念、粒子），蓝 = 机器人真实状态与轨迹，绿 = 目标 / 已确定 / 已清除，红 = 被污染 / 最坏，黄 = 当前可见区域 V(x)，深灰 = 障碍 |

## 5. 云端会话（Claude Code cloud）的补充约定

从第 6 章起，每章由一个**云端会话**生成，最多 5 个会话**同时**写不同的章。仓库是 `github.com/xpengzxp/planning-algorithms-study`（目前私有，全部写完后开源）。本地有一个协调会话负责启动和检查。模型统一用 Opus 5.5，推理强度 xhigh（`.claude/settings.json` 里的 `effortLevel`）。云端会话除了第 2 节的流程，还要遵守：

- **只用 `main`**：不建任何分支，直接在 `main` 上提交，推送到 `origin main`。别的会话也在同时往 `main` 推，所以：
  - 只改自己这一章的文件（`partN/chK-*.html`、`partN/js/chK-*.js`、`partN/code/chK_*.py`）和登记点（`index.html`、`assets/roadmap.js`、`README.md`、`CLAUDE.md` 第 4 节）。不碰别的章节的文件，也不重写共享文件里不属于自己的部分。
  - 登记点只做「插入一行 / 一张卡片」这样的局部修改，按章号顺序插入，不要重新排版整个文件。
  - 推送步骤：`git fetch origin && git rebase origin/main`。有冲突时只会出现在登记点：**两边的内容都保留**（别人的卡片、表格行一行都不能丢），按章号排好。然后重新做一遍检查，再 `git push origin HEAD:main`。如果因为别人刚推过而被拒，重复 fetch、rebase、push，最多重试 10 次。绝对不要 `--force`。
  - 中途可以多次提交、推送，好让进度保存在远端；最后一个提交信息写 `chK: done`。
- **PDF**：`book/` 在 `.gitignore` 里（版权原因，原书 PDF 不进 `main`）。云端访问 lavalle.pl 会返回 403，所以从 `book-pdfs` 分支取：`git fetch origin book-pdfs && git show origin/book-pdfs:book/chK.pdf > book/chK.pdf`。不要把 PDF 提交进 `main`。页面里的原书链接一律指向 `https://lavalle.pl/planning/chK.pdf`。阅读方法见第 2 节第 1 步：用 Read 直接通读整份 PDF，不能用 txt 代替。
- **新的 Part**：主页上 Part III、Part IV 的分区已经建好，往对应的 `.chapter-cards` 里加卡片即可。`part3/`、`part4/` 目录可能是你第一个建的，也可能别人已经建好，两种情况都正常。每章的共用库命名为 `partN/js/chK-lib.js`，不要建不带章号前缀、多章共用的文件，以免并行会话之间互相覆盖。
- **范本**：动手前读 `part2/ch5-sampling-based-planning.html` 和 `part2/js/ch5-*.js`，把它当作结构、组件写法、语气和完成度的范本，本章要和它像同一套教程。文件名用 `partN/chK-<英文标题 slug>.html`，英文标题以 `assets/roadmap.js` 里的 `en` 为准。原书覆盖全部小节，没有人会回答问题，遇到不确定的就自己做合理决定，并写进最后的总结。
- **新 Part 的颜色**：第 9 章为 Part III、第 13 章为 Part IV 定颜色约定，写进第 4 节；同一 Part 的后续章节沿用。如果开始时还没有约定，就先自定一套，写进自己那一行。
- **验证**：云端没有浏览器面板。用 `node --check` 检查每个 JS 文件，用 `python3 -m http.server` 加 `curl` 确认页面引用的本地文件都返回 200，参考代码用 `python3` 跑通。浏览器里的实际渲染和交互检查由本地协调会话完成。
- **收尾**：在对话最后用中文写一段总结：做了哪些互动图、哪些地方标了「补充」、原书有哪些笔误、还有哪些没验证的地方。
