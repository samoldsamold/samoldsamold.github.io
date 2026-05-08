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

#### Three-column CSS Grid

The page uses a single CSS Grid row with three columns: intro text (left), the cat logo navigation (center), and a dynamically updating section panel (right). Both outer columns are `minmax(14rem, 1fr)` so they scale with the viewport while keeping the logo fixed.

#### Vertical alignment via `--content-lift`

Aligning the left-column eyebrow with the right-column kicker across columns of different heights is solved with a CSS custom property `--content-lift`. The intro is shifted upward with `translateY(calc(-1 * var(--content-lift)))`, and every element in the right panel is absolutely positioned with a matching `top: calc(Xrem - var(--content-lift))` offset. This lets both sides share the same visual baseline without any JavaScript measurement.

#### Cursor glow

`body::before` renders a `radial-gradient` anchored to `--cursor-x` / `--cursor-y`. A `pointermove` listener on `window` updates these custom properties, making the green ambient glow track the cursor in real time with no repaints outside the CSS layer.

#### Cat logo hotspots

Six `<a>` elements are absolutely positioned over the logo image, each with an organic `border-radius` shape (e.g. `42% 56% 50% 46% / 40% 52% 48% 55%`) hand-tuned to cover the corresponding letter region. They are invisible by default. On `:hover` or `:focus-visible`, a `.node-icon` pill animates in and a JS function updates the right panel's kicker, title, subtitle, body copy, and CTA link — all without a page load.

#### Logo edge fade

The `samold.webp` logo uses two intersecting `mask-image` linear gradients (horizontal and vertical, both fading transparent at 8% and 92%) composed with `mask-composite: intersect`. This creates a soft vignette on all four edges without any image editing.

#### Responsive behaviour

| Breakpoint | Layout |
|---|---|
| `> 1080px` | Three-column grid, shell flex-centers the content, equal top/bottom padding |
| `≤ 1080px` | Single-column grid; intro and section panel absolutely positioned top/bottom |
| `≤ 640px` | Compact layout; body copy and route list hidden, panel simplified |

#### Equal visual margins

Shell `padding-top` and `padding-bottom` are both `clamp(3rem, 7vh, 5rem)`. The footer is pinned at `bottom: clamp(3rem, 7vh, 5rem)`. This makes the distance from the top of the first text element to the viewport top equal to the distance from the footer text to the viewport bottom.

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

Each room is a standalone HTML page sharing `assets/samold-room.css` and `assets/samold-room.js` for consistent chrome (header, navigation, cursor glow).

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

#### 三列 CSS Grid

页面由一行三列 Grid 构成：左列介绍文字、中列猫咪 Logo 导航、右列动态面板。两侧列为 `minmax(14rem, 1fr)`，随视口等比缩放，Logo 列保持固定尺寸。

#### `--content-lift` 垂直对齐技巧

左右两列内容高度不同，要让两侧的第一行文字保持同一视觉基线，使用了 CSS 自定义属性 `--content-lift`：左侧 intro 用 `translateY(calc(-1 * var(--content-lift)))` 整体上移；右侧面板所有元素绝对定位，`top` 值统一为 `calc(Xrem - var(--content-lift))`。两侧同步偏移，无需 JavaScript 测量任何元素高度。

#### 光标跟随光晕

`body::before` 渲染一个以 `--cursor-x` / `--cursor-y` 为圆心的绿色 `radial-gradient`。`window` 的 `pointermove` 事件实时更新这两个变量，光晕随鼠标移动，全部在 CSS 层完成，不触发重排。

#### 猫咪字母热区

Logo 上叠放六个透明 `<a>` 元素，各自使用手工调试的有机形 `border-radius`（如 `42% 56% 50% 46% / 40% 52% 48% 55%`）覆盖对应字母区域。默认不可见；`:hover` / `:focus-visible` 时，浮动标签 pill 弹出，同时 JS 更新右侧面板的所有内容（标题、副标题、正文、跳转链接），无页面跳转。

#### Logo 四边渐隐

`samold.webp` 使用两条相互垂直的 `mask-image` 线性渐变（各在 8% 和 92% 处淡入/淡出），通过 `mask-composite: intersect` 合成，实现四边羽化效果，无需修改原图。

#### 响应式断点

| 断点 | 布局 |
|---|---|
| `> 1080px` | 三列 Grid，shell 用 flex 垂直居中内容，上下等距留白 |
| `≤ 1080px` | 单列 Grid，左侧文字与右侧面板绝对定位分别锚定顶部和底部 |
| `≤ 640px` | 紧凑布局，正文与导航列表隐藏，面板简化显示 |

#### 等距上下边距

Shell 的 `padding-top` 和 `padding-bottom` 均为 `clamp(3rem, 7vh, 5rem)`，footer 的 `bottom` 使用同一值，确保页面顶部第一个文字元素到视口上边界的距离，等于 footer 文字到视口下边界的距离。

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

每个房间是独立 HTML 页面，共享 `assets/samold-room.css` 和 `assets/samold-room.js` 提供一致的顶部导航与光晕效果。

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
