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

1. **下载并阅读原书 PDF**：下载到 `book/`，地址是 `https://lavalle.pl/planning/chK.pdf`（单章）或 `parN.pdf`（整部分）。读的时候 PDF 页面和提取的文字**两者都要用**：
   - **提取文字**：用临时 venv 装 `pypdf`，把全文提取成 txt，用来通读和搜索。这台 Mac 没有 `pdftotext`。
   - **直接看 PDF**：用 Read 工具读 PDF 页面（`pages` 参数，每次最多 20 页）。txt 里看不到图，公式的上下标、分式、希腊字母也常常错乱，所以写每一节之前，都要直接看这一节的 PDF 原页，确认图、公式、式号、图号。
   - **原书笔误**：要标「原书笔误」的地方，必须对着 PDF 原页确认过，不能只凭 txt 下结论，因为很多「笔误」其实是文字提取出的错。
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

## 5. 云端会话（Claude Code cloud）的补充约定

从第 6 章起，每章由一个**云端会话**生成，最多 5 个会话**同时**写不同的章。仓库是 `github.com/xpengzxp/planning-algorithms-study`（目前私有，全部写完后开源）。本地有一个协调会话负责启动和检查。模型统一用 Opus 5.5，推理强度 xhigh（`.claude/settings.json` 里的 `effortLevel`）。云端会话除了第 2 节的流程，还要遵守：

- **只用 `main`**：不建任何分支，直接在 `main` 上提交，推送到 `origin main`。别的会话也在同时往 `main` 推，所以：
  - 只改自己这一章的文件（`partN/chK-*.html`、`partN/js/chK-*.js`、`partN/code/chK_*.py`）和登记点（`index.html`、`assets/roadmap.js`、`README.md`、`CLAUDE.md` 第 4 节）。不碰别的章节的文件，也不重写共享文件里不属于自己的部分。
  - 登记点只做「插入一行 / 一张卡片」这样的局部修改，按章号顺序插入，不要重新排版整个文件。
  - 推送步骤：`git fetch origin && git rebase origin/main`。有冲突时只会出现在登记点：**两边的内容都保留**（别人的卡片、表格行一行都不能丢），按章号排好。然后重新做一遍检查，再 `git push origin HEAD:main`。如果因为别人刚推过而被拒，重复 fetch、rebase、push，最多重试 10 次。绝对不要 `--force`。
  - 中途可以多次提交、推送，好让进度保存在远端；最后一个提交信息写 `chK: done`。
- **PDF**：`book/` 在 `.gitignore` 里（版权原因，原书 PDF 不进 `main`）。云端访问 lavalle.pl 会返回 403，所以从 `book-pdfs` 分支取：`git fetch origin book-pdfs && git show origin/book-pdfs:book/chK.pdf > book/chK.pdf`。不要把 PDF 提交进 `main`。页面里的原书链接一律指向 `https://lavalle.pl/planning/chK.pdf`。阅读方法见第 2 节第 1 步：txt 用来通读和搜索，图、公式、笔误都要用 Read 直接看 PDF 原页确认。
- **新的 Part**：主页上 Part III、Part IV 的分区已经建好，往对应的 `.chapter-cards` 里加卡片即可。`part3/`、`part4/` 目录可能是你第一个建的，也可能别人已经建好，两种情况都正常。每章的共用库命名为 `partN/js/chK-lib.js`，不要建不带章号前缀、多章共用的文件，以免并行会话之间互相覆盖。
- **验证**：云端没有浏览器面板。用 `node --check` 检查每个 JS 文件，用 `python3 -m http.server` 加 `curl` 确认页面引用的本地文件都返回 200，参考代码用 `python3` 跑通。浏览器里的实际渲染和交互检查由本地协调会话完成。
- **收尾**：在对话最后用中文写一段总结：做了哪些互动图、哪些地方标了「补充」、原书有哪些笔误、还有哪些没验证的地方。
