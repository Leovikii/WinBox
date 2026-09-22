# 前端选型与决策

日期：2026-09-21。目标 `3.0.0-alpha.2`；计划已进入实施，依赖已按锁文件安装并通过前端构建/审计。精确版本、许可证与限制仍以本文件和 lockfile 为准；浏览器构建通过不等于 Tauri WebView 实机兼容通过。

## 用户已确定的边界

| ID | 决策 | 边界 |
| --- | --- | --- |
| FE-ADR-001 | Vue → React，通用组件使用微软 Fluent 官方库 | 不保留长期 Vue/React 双前端；不将保留视觉理解为继续保留手写标准控件 |
| FE-ADR-002 | 保留并尽可能优化现有视觉、动画和操作逻辑 | 官方 props/token/slots 优先，必要产品样式集中；明显差异先对照确认，不默认接受官方默认外观 |
| FE-ADR-003 | 本版 Windows AMD64/x64，下版 Linux | 现在考虑材质/字体/布局降级，不实现 Linux 后端/产物，也不构建 ARM64 |
| FE-ADR-004 | 后端人工测试保留，前端先行 | 原 MIG/BUG 状态不批量关闭；新前端回归必须修复，已有后端测试缺口不作为整阶段开工阻塞 |
| FE-ADR-005 | 版本目标 alpha.2，前端实施后再发布 | React 工程、Rust manifest 和锁文件已同步到 alpha.2；本轮不触发 main 发布工作流 |

## 补充约束：官方组件承接 WinUI 效果

- FE-ADR-006（2026-09-21）：用户澄清旧前端本来就是模仿 WinUI 的手写组件；本次由 Fluent 官方组件替代其基础行为，同时保留既有风格与动效。组件替换与效果对照同一切片交付，不能先降级再延期恢复。
- FE-ADR-007：只在真实边界做必要解耦。纯数据逻辑、React 业务状态、Fluent 展示与桌面接入职责分开；窗口材质与通用主题计算分开；Windows 系统实现继续放在 Rust platform。Linux 下版接真实能力，不提前建平台工厂、DI 或假实现。
- FE-ADR-008：正常等价替换、官方无障碍改善和视觉不劣化的优化自行推进并记录；实质视觉或操作路径变化才需确认。自定义样式必须有现有效果/官方缺口依据，不能因保留效果而继续维护另一套手写基础控件。

## 推荐依赖与核对结果

| 包 | 精确候选 | 来源/许可/维护证据 | 使用与限制 |
| --- | --- | --- | --- |
| react / react-dom | 19.3.0 / 19.3.0 | [React 官方仓库](https://github.com/facebook/react)，npm registry 的 repository 指向 react/react；registry license MIT | 同版本锁定；Fluent v9 peer 接受 React/ReactDOM >=16.14、<20；仍需验证 StrictMode、Portal 和 WebView |
| @fluentui/react-components | 9.74.7 | [微软 fluentui](https://github.com/microsoft/fluentui)，MIT；该版本发布时间2026-08-24 | 官方 v9，包含主题、Griffel 样式、Dialog/表单/颜色选择与稳定 motion 导出；只用稳定公开组件，不因聚合包含 preview/alpha 子依赖就主动使用其 API |
| @fluentui/react-icons | 2.0.341 | [微软 fluentui-system-icons](https://github.com/microsoft/fluentui-system-icons)，registry MIT；2026-09-11发布 | 本地按需打包替换 Font Awesome CDN；具体图标粗细/大小需视觉对照；保留品牌资产 |
| @fluentui/react-charts | 9.3.25 | [微软 fluentui](https://github.com/microsoft/fluentui)，registry MIT；2026-08-24发布 | 官方 v9 图表，peer 接受 React <20；新增有明确图表用途，须验证双面积渐变/响应尺寸/连续更新和包体积 |
| @vitejs/plugin-react | 6.1.1 | [Vite 官方插件](https://github.com/vitejs/vite-plugin-react)，registry MIT；2026-08-28发布 | peer Vite ^8，匹配现有 Vite 8.3；Node ^20.19 或 >=22.12；编译器/Babel相关 peer 标为 optional，不为规划自动加 React Compiler |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0 | DefinitelyTyped/npm，MIT；已写入 package-lock | 替换 Vue ambient types；与 React 19.3.0 同步 |
| overlayscrollbars（已有） | 保持既有锁文件版本 | [现有项目](https://github.com/KingSora/OverlayScrollbars)，已有业务用途 | 优先复用核心 API；若生命周期更简洁，可采用官方项目 React 适配 overlayscrollbars-react 0.5.6（registry MIT），不与 Vue 适配长期并存 |

已有 `@tauri-apps/api`、marked 和业务工具函数按调用需求复用，不因换 React 同时升级所有依赖。新增包需记录直接/传递许可证与已知漏洞检查结果。微软仓库 README 另提示字体/部分引用资产的许可要求，包的 MIT 声明不能视为允许随意打包 Segoe UI 等系统字体；当前计划使用系统字体回退。

### 明确不采用的方向

- `@fluentui/react` v8、Northstar v0、Web Components/React Native：不与所选 v9 通用控件混用；微软 README 推荐新的 React 项目使用 v9，Northstar 已结束维护。
- `@fluentui/react-charting 5.25.11`：虽然也是微软项目，其 peer 依赖 `@fluentui/react ^8.125.7`，本计划选独立 v9 `react-charts`。
- 不假设存在稳定 `@fluentui/react-motion-components` 包（查询返回404）。`react-motion-components-preview 0.15.8` 是预览包，本计划默认不依赖；`react-components` 已依赖稳定 `react-motion ^9.16.3` 并导出创建动效的入口，先复用。
- 不重建 WButton/WSelect/WModal 的通用基础行为；只允许有明确产品语义的组合组件。主题外不建立一套并行设计系统。
- 不默认加入动画、路由、全局状态、表单和大型编辑器依赖；JSON override 当前用官方 Textarea 即可保持功能。

## 实施后验证与仍需人工确认

1. v9 `AreaChart` 已承载双曲线渐变、无多余坐标/图例、30 点滚动与最低纵轴；浏览器生产预览通过，真实流量压力和 WebView 重绘预算仍需人工记录。
2. Fluent Dialog/Dropdown 的 Portal、主题继承、透明背景与 Mica 的浏览器预览已通过；真实 Tauri WebView 仍需人工验证。
3. 页面 300ms、弹窗 250ms、滑块 250ms、按钮布局 400ms 等动效已保持单一 CSS/组件所有者；需在真实窗口录屏确认无掉帧。
4. Tailwind、Vue 入口和 W* 基础控件已删除；OverlayScrollbars 只保留在已有日志/列表滚动场景，不与第二套控件基础设施并存。
5. 状态/更新协议未扩展；失败路径、busy/finally、回滚和错误提示已在 React 状态层接线，真实 Tauri IPC 仍需人工操作覆盖。

## 查询证据与可复核来源

- [微软 Fluent UI 总入口](https://github.com/microsoft/fluentui)：v9/v8/Web Components 区别、v9推荐、许可证和 Northstar 状态。
- [Fluent UI React 官方文档](https://react.fluentui.dev/)：组件、主题、样式与动效公开入口，实施时按已锁定版本复核示例。
- [官方组件导出源码](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-components/src/index.ts)：本轮只读核对 Accordion、Dropdown、Dialog、ToolbarRadioGroup、TabList、ProgressBar、颜色选择和稳定 motion 等导出；master 是可变来源，不替代安装版本的类型检查。
- npm registry 的 `/包名/latest`、完整包元数据：核对上表版本、peerDependencies、license、发布时间与插件 optional peers。确切候选详情可由 [组件](https://registry.npmjs.org/@fluentui/react-components/9.74.7)、[图表](https://registry.npmjs.org/@fluentui/react-charts/9.3.25)、[图标](https://registry.npmjs.org/@fluentui/react-icons/2.0.341)、[React](https://registry.npmjs.org/react/19.3.0)、[Vite 插件](https://registry.npmjs.org/@vitejs/plugin-react/6.1.1) 复核。
- 部分猜测的 motion/chart README 路径返回404，未作为能力证据；组件能力判断来自上述官方导出与 registry，具体图表表现仍为 FE-003 验证事项。

## WinUI 3 设计依据与应用记录

实施前阅读并按公开规范校准：

- [Design and UI principles](https://learn.microsoft.com/en-us/windows/apps/design/basics/design-and-ui-intro)：内容优先、清晰层级、直接反馈和一致交互。
- [Geometry](https://learn.microsoft.com/en-us/windows/apps/design/style/geometry)、[Typography](https://learn.microsoft.com/en-us/windows/apps/design/style/typography)、[Iconography](https://learn.microsoft.com/en-us/windows/apps/design/style/iconography)、[Color](https://learn.microsoft.com/en-us/windows/apps/design/style/color)、[Motion](https://learn.microsoft.com/en-us/windows/apps/design/style/motion)：几何/圆角、系统字体层级、图标尺寸、主题色/对比度、缓动与减弱动效。

本次落地为 Fluent v9 token/props/slots 优先，产品 CSS 只负责 Mica 表面、布局、状态色、滑动选中层和必要响应式细节。常规图标收敛到 16px、控件文字约 12px、按钮/下拉高度约 28–36px；弹窗使用官方 anatomy 和焦点/键盘机制。右上角标题栏去除会参与命中区域的 Tooltip Portal，使用 Fluent Button 的 `aria-label` 加原生 `title`，以消除悬停闪变；这不改变点击路径。

## 实施交接证据（2026-09-21）

- React 19.3.0 + Fluent UI v9 9.74.7 已安装并锁定；生产主包约 925.6 kB、设置懒加载包约 85.1 kB；Vite 仍提示主包超过 500 kB，未引入额外拆分框架。
- `npm run build`、`npx tsc --noEmit`、`npm audit --audit-level=high`（0 vulnerabilities）、`git diff --check` 通过；x64 Rust fmt/test（33/33）/clippy 和 unsigned NSIS 通过。
- 浏览器预览只证明 React/Fluent 页面和异常路径；无 Tauri runtime 时的 `invoke` 错误、真实 Windows WebView、安装/更新、代理/UWP/托盘/多 DPI 仍不计为通过。

## 本轮回归修复（2026-09-22）

- 应用更新：检查流程先读取并暂存本机 `get_product_version`，再与远端版本比较；本机版本仍为 `Unknown` 时只显示 `Latest`，不会误报 `available`；同一检查期间的重复触发会被忽略。
- Dropdown：保留 Fluent `Dropdown`/`Option` 的键盘、Portal 和焦点行为；产品 CSS 只覆盖单一根边界、28px 控件密度及菜单表面/选中背景，去掉根节点与 combobox 重叠边框、内部亮白焦点框和默认大图标效果；通过公开 `checkIcon={null}` slot 移除左侧勾选节点，不再增加自定义左侧竖条。
- Dialog：使用不透明的主题 Surface 防止底层页面文字透出；普通弹窗沿用 Fluent 默认尺寸流，编辑器只增加公开类的高度和 `DialogBody` 填充约束。受控弹窗只保留最小焦点恢复桥接，不再为每个实例安装全局指针/键盘监听。
- Dialog 焦点：焦点触发控件在 `useLayoutEffect` 中于 Fluent 自动聚焦前记录，避免普通 `useEffect` 只能捕获 Dialog 内关闭按钮；Escape/关闭按钮完成退出动效后恢复到原控件。
- 证据：最新 `npm run build`、TypeScript 检查和生产预览通过；计算样式确认 Dialog Surface 使用主题不透明面、菜单为主题面且选项无边框；AX/DOM 检查确认每个选项均无 `.fui-Option__checkIcon` 节点。浅/深主题 Dropdown 点击展开、选择、Escape、主题颜色、Manage Profiles、编辑器和日志/退出场景已回归。浏览器无 Tauri runtime 的 `invoke` 错误仍是预览限制。
- 原生启动阻塞：清单要求 `requireAdministrator`；非管理员运行 x64 产物返回 `0xc0000142`/`os error 740`，WebView2 `153.0.4234.48` 已存在。需要管理员人工启动后，才能继续 Tauri IPC、Mica、更新、UWP、托盘和 DPI 验收；不在自动化中绕过 UAC。

## 模式与顶部状态回归（2026-09-22）

- 规范复核：微软 Typography 规定 Segoe UI Variable、12px Regular 为正文最小值、Semibold 用于强调且 UI 文案优先 sentence case；Geometry 规定页内控件 4px、浮层 8px 圆角；Motion 的 point-to-point 动效使用 `cubic-bezier(.55,.55,0,1)` 和 167/250/333ms 档位；Radio buttons 负责互斥选择、方向键和焦点。模式控件因此保留 Fluent `RadioGroup`/`Radio`，只修正产品装饰层和标签密度。
- 附图滑块 bug 的原因是百分比位移写在伪元素 `transform` 中，`100%` 以伪元素自身宽度为基准后又被除以三，导致 TUN/MIXED 永远卡在左侧附近；改为 `100% + 2px` 与 `200% + 4px`，并让伪元素边框采用 border-box。没有增加 JS 测量、ResizeObserver 或新的组件抽象。
- 顶部光晕采用单个 `.status-led::before` 产品伪元素恢复旧版 ambient bloom；它不承担交互、不复制旧控件，且在 forced-colors 隐藏。图表使用已锁定的 Fluent `AreaChart` 公开 `mode`/`lineOptions` 调整为 `tozeroy`、linear、1.5px，避免为视觉复刻再维护第二套 SVG 绘图基础设施。

## alpha.2 实机回归与发布边界（2026-09-22）

- 用户确认 Windows x64 实机回归通过，覆盖 React/Fluent 前端的模式滑块初始位置与切换动画、模式文字密度、顶部状态光晕、连续速度图、右上角控件、Dropdown、浅/深主题及各类弹窗。该证据关闭前端迁移对应的人工回归门槛；后端迁移的独立安装、升级、UWP、托盘、旧数据和其他历史验收仍以 `docs/tauri-migration/validation.md` 为准。
- alpha.2 的版本、锁文件、x64 unsigned NSIS 测试产物和自动检查已齐全；本地不创建 `main` PR 或 Release。维护者手动把 `dev` 提交 PR 到 `main` 后，才允许既有 GitHub Actions 使用签名 secrets 生成 NSIS、同名 `.sig`、`latest.json` 并发布第二个 alpha。
