# SAMOLD — samoldsamold.github.io

> **[English](#english) | [中文](#中文)**

**Live:** [samoldsamold.github.io](https://samoldsamold.github.io)

---

## English

### What it is

A personal website structured around the acronym **SAMOLD** — six rooms, six ways in. The landing page is built around a hand-drawn cat logo where each letter (S · A · M · O · L · D) is an invisible interactive hotspot. Hovering a letter reveals a floating label and updates a live panel on the right describing that room.

No frameworks. No build step. Pure HTML, CSS, and vanilla JavaScript hosted on GitHub Pages.

---

### Landing page — frontend highlights

#### Responsive stage grid

The page uses a three-column CSS Grid stage: intro text (left), the cat logo navigation (center), and a live room panel (right). Shared custom properties such as `--stage-width`, `--stage-gap`, `--logo-size`, and `--panel-width` keep the composition balanced from laptop screens to 27-inch displays without manually pinning text coordinates.

#### Flow-based panel layout

The right panel is normal Flex/Grid flow rather than absolute-positioned text blocks. The kicker, title, Chinese label, body copy, CTA, and room list stack naturally, so larger desktop font sizes cannot overlap when the viewport grows.

#### Cursor glow

`body::before` renders a `radial-gradient` anchored to `--cursor-x` / `--cursor-y`. A `pointermove` listener on `window` updates these custom properties, making the green ambient glow track the cursor in real time with no repaints outside the CSS layer.

#### Cat logo hotspots

Six `<a>` elements are absolutely positioned over the logo image, each with an organic `border-radius` shape (e.g. `42% 56% 50% 46% / 40% 52% 48% 55%`) hand-tuned to cover the corresponding letter region. They are invisible by default. On `:hover` or `:focus-visible`, a `.node-icon` pill animates in and a JS function updates the right panel's kicker, title, subtitle, body copy, and CTA link — all without a page load.

#### Logo edge fade

The `samold.webp` logo uses two intersecting `mask-image` linear gradients (horizontal and vertical, both fading transparent at 8% and 92%) composed with `mask-composite: intersect`. This creates a soft vignette on all four edges without any image editing.

#### Responsive behaviour

| Breakpoint | Layout |
|---|---|
| `> 1080px` | Three-column stage, content centered in normal document flow |
| `≤ 1080px` | Two-column tablet flow with the panel below intro, logo beside them |
| `≤ 640px` | Compact single-column layout with mobile language bubble and room carousel |

#### Large-screen scaling

Large desktop breakpoints increase the stage, logo, room panel, hover pills, and typography together while retaining maximum bounds. This prevents the site from looking tiny on 2560×1440 displays or stretching endlessly on 4K screens.

---

### The six rooms

| Letter | Room | Content |
|---|---|---|
| **S** | Showcase | Finished projects, design visuals, photography, and open-source work |
| **A** | Articles | Long-form technical notes, engineering reflections, and slower thinking |
| **M** | Moments | Short updates, daily fragments, photos, and passing thoughts |
| **O** | Overview | Background, contact info, and the formal resume |
| **L** | Labs | Side projects, half-finished prototypes, and playful experiments |
| **D** | Discoveries | Tools, books, films, links, and useful finds from the web |

Each room is a standalone HTML page sharing `assets/samold-room.css` and `assets/samold-room.js` for consistent chrome (header, navigation, cursor glow). Room home sections use a full-viewport hero grid with centered copy, then reveal the room content on scroll.

---

### Tech stack

| Layer | Choice |
|---|---|
| Layout | Vanilla CSS Grid + Flexbox, no framework |
| Typography | Space Grotesk (headings) · Inter (body) via Google Fonts |
| Icons | Material Symbols Outlined |
| Interactivity | Vanilla JS — event delegation, CSS custom property updates |
| Hosting | GitHub Pages (root of `main` branch) |

### File structure

```
.
├── index.html          # Landing page — SAMOLD cat nav
├── overview.html       # O · Overview
├── showcase.html       # S · Showcase
├── articles.html       # A · Articles
├── moments.html        # M · Moments
├── labs.html           # L · Labs
├── discoveries.html    # D · Discoveries
├── resume.html         # Formal resume (linked from Overview)
└── assets/
    ├── samold.webp     # Hand-drawn cat logo
    ├── samold-room.css # Shared room styles
    └── samold-room.js  # Shared room scripts
```

### Local preview

```bash
open index.html        # macOS
xdg-open index.html    # Linux / WSL
```

No build step — any modern browser works.

---

## 中文

### 简介

这是一个以 **SAMOLD** 为主轴的个人网站，包含六个独立的"房间"。落地页以手绘猫咪 Logo 为核心导航：S · A · M · O · L · D 六个字母区域各自对应一个隐形热区，鼠标悬停时浮现标签，并实时刷新页面右侧的房间介绍面板。

无框架、无构建步骤，纯 HTML + CSS + 原生 JavaScript，托管于 GitHub Pages。

---

### 落地页前端实现要点

#### 响应式 Stage Grid

落地页使用三列 CSS Grid：左列介绍文字、中列猫咪 Logo 导航、右列动态房间面板。`--stage-width`、`--stage-gap`、`--logo-size`、`--panel-width` 等变量统一控制整体舞台比例，让 13 寸笔记本和 27 寸显示器都保持稳定构图。

#### 文档流动态面板

右侧面板不再用绝对定位叠放文字，而是使用正常 Flex/Grid 文档流。kicker、标题、中文说明、正文、CTA 和房间目录自然向下排列，因此大屏字体放大后不会互相覆盖。

#### 光标跟随光晕

`body::before` 渲染一个以 `--cursor-x` / `--cursor-y` 为圆心的绿色 `radial-gradient`。`window` 的 `pointermove` 事件实时更新这两个变量，光晕随鼠标移动，全部在 CSS 层完成，不触发重排。

#### 猫咪字母热区

Logo 上叠放六个透明 `<a>` 元素，各自使用手工调试的有机形 `border-radius`（如 `42% 56% 50% 46% / 40% 52% 48% 55%`）覆盖对应字母区域。默认不可见；`:hover` / `:focus-visible` 时，浮动标签 pill 弹出，同时 JS 更新右侧面板的所有内容（标题、副标题、正文、跳转链接），无页面跳转。

#### Logo 四边渐隐

`samold.webp` 使用两条相互垂直的 `mask-image` 线性渐变（各在 8% 和 92% 处淡入/淡出），通过 `mask-composite: intersect` 合成，实现四边羽化效果，无需修改原图。

#### 响应式断点

| 断点 | 布局 |
|---|---|
| `> 1080px` | 三列舞台布局，主内容在正常文档流中居中 |
| `≤ 1080px` | 平板双列布局，面板位于简介下方，Logo 位于旁侧 |
| `≤ 640px` | 手机单列布局，保留语言泡泡和房间轮播 |

#### 大屏缩放

大屏断点会同步放大 stage、Logo、右侧面板、hover 标签和字体，同时设置最大值，避免 2560×1440 下显得过小，也避免 4K 屏无限扩散。

---

### 六个房间

| 字母 | 房间 | 内容 |
|---|---|---|
| **S** | Showcase 展示 | 完成的项目、设计稿、摄影作品、开源代码 |
| **A** | Articles 文章 | 深度长文、技术笔记、工程思考 |
| **M** | Moments 瞬间 | 日常碎片、照片、随想、简短动态 |
| **O** | Overview 概览 | 个人背景、联系方式、简历入口 |
| **L** | Labs 实验室 | 业余项目、半成品原型、技术实验 |
| **D** | Discoveries 发现 | 工具、书影、好链接、网络淘到的好东西 |

每个房间是独立 HTML 页面，共享 `assets/samold-room.css` 和 `assets/samold-room.js` 提供一致的顶部导航与光晕效果。房间首页使用占满首屏的居中 hero，向下滚动后展示具体内容。

---

### 技术栈

| 层级 | 选择 |
|---|---|
| 布局 | 原生 CSS Grid + Flexbox，无 UI 框架 |
| 字体 | Space Grotesk（标题）· Inter（正文），Google Fonts 加载 |
| 图标 | Material Symbols Outlined |
| 交互 | 原生 JS — 事件委托、CSS 自定义属性实时更新 |
| 托管 | GitHub Pages（`main` 分支根目录） |

### 文件结构

```
.
├── index.html          # 落地页 — SAMOLD 猫咪导航
├── overview.html       # O · 概览
├── showcase.html       # S · 展示
├── articles.html       # A · 文章
├── moments.html        # M · 瞬间
├── labs.html           # L · 实验室
├── discoveries.html    # D · 发现
├── resume.html         # 正式简历（从 Overview 跳转）
└── assets/
    ├── samold.webp     # 手绘猫咪 Logo
    ├── samold-room.css # 房间页公共样式
    └── samold-room.js  # 房间页公共脚本
```

### 本地预览

```bash
open index.html        # macOS
xdg-open index.html    # Linux / WSL
```

无需构建，现代浏览器直接打开即可。
