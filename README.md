# Planning Algorithms 学习站

学习 Steven M. LaValle《Planning Algorithms》（Cambridge University Press, 2006）的中文互动教程。
原书全文免费：<https://lavalle.pl/planning/>

## 怎么打开

直接用浏览器打开 **`index.html`**，这是学习主页：每章一张卡片、全书路线图、「我已读完」进度勾选。所有章节都从这里进入；每个章节页的顶栏都能回到主页。公式渲染和字体需要联网，无需任何构建或服务器。

## 目录

```
Planning Algorithm/
├── index.html      学习主页
├── CLAUDE.md       给 Claude 的编写约定与「新增一章」流程
├── assets/         共用样式与脚本（style.css, common.js, roadmap.js）
├── book/           原书 PDF（par1.pdf, ch3.pdf, …）
├── part1/          Part I  入门材料（第 1–2 章）
├── part2/          Part II 运动规划（第 3–8 章）
├── part3/          Part III 决策论规划（第 9–12 章）
└── part4/          Part IV 微分约束下的规划（第 13–15 章）
```

## 章节进度

| 章 | 标题 | 入口 |
|---|---|---|
| 1 | 引言 Introduction | [part1/ch1-introduction.html](part1/ch1-introduction.html) |
| 2 | 离散规划 Discrete Planning | [part1/ch2-discrete-planning.html](part1/ch2-discrete-planning.html) |
| 3 | 几何表示与变换 Geometric Representations and Transformations | [part2/ch3-geometric-representations.html](part2/ch3-geometric-representations.html) |
| 4 | 配置空间 The Configuration Space | [part2/ch4-configuration-space.html](part2/ch4-configuration-space.html) |
| 5 | 基于采样的运动规划 Sampling-Based Motion Planning | [part2/ch5-sampling-based-planning.html](part2/ch5-sampling-based-planning.html) |
| 6 | 组合运动规划 Combinatorial Motion Planning | [part2/ch6-combinatorial-motion-planning.html](part2/ch6-combinatorial-motion-planning.html) |
| 8 | 反馈运动规划 Feedback Motion Planning | [part2/ch8-feedback-motion-planning.html](part2/ch8-feedback-motion-planning.html) |
| 9 | 基本决策论 Basic Decision Theory | [part3/ch9-basic-decision-theory.html](part3/ch9-basic-decision-theory.html) |

## 新增一章

在新的 Claude 对话里直接说「做第 K 章的教程」即可，`CLAUDE.md` 规定了文件放哪、怎么登记到主页和路线图。人工检查清单：主页有卡片、路线图可点击、章节页顶栏能回首页、深浅色一致。
