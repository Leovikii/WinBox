# 前端选型与决策

日期：2026-09-21。目标 `3.0.0-alpha.2`；本轮只做计划，所有新包均未安装。精确候选版本来自当日 npm registry，安装前还需验证实际依赖解析、许可证文件、安全公告与 Tauri WebView 构建，写入锁文件；不能把 peer 范围满足称为实机兼容通过。

## 用户已确定的边界

| ID | 决策 | 边界 |
| --- | --- | --- |
| FE-ADR-001 | Vue → React，通用组件使用微软 Fluent 官方库 | 不保留长期 Vue/React 双前端；不将保留视觉理解为继续保留手写标准控件 |
| FE-ADR-002 | 保留并尽可能优化现有视觉、动画和操作逻辑 | 官方 props/token/slots 优先，必要产品样式集中；明显差异先对照确认，不默认接受官方默认外观 |
| FE-ADR-003 | 本版 Windows AMD64/x64，下版 Linux | 现在考虑材质/字体/布局降级，不实现 Linux 后端/产物，也不构建 ARM64 |
| FE-ADR-004 | 后端人工测试保留，前端先行 | 原 MIG/BUG 状态不批量关闭；新前端回归必须修复，已有后端测试缺口不作为整阶段开工阻塞 |
| FE-ADR-005 | 版本目标 alpha.2，本轮仅计划 | 版本实改随 React 工程切换；不在计划阶段发布或触发 main 工作流 |

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
| React/ReactDOM TypeScript 类型 | 实施时选择匹配19.x的准确稳定版 | DefinitelyTyped/npm；本轮未查询准确版本，未宣称已锁定 | 替换 Vue ambient types；实施时在本表补版本与许可并锁定 |
| overlayscrollbars（已有） | 保持既有锁文件版本 | [现有项目](https://github.com/KingSora/OverlayScrollbars)，已有业务用途 | 优先复用核心 API；若生命周期更简洁，可采用官方项目 React 适配 overlayscrollbars-react 0.5.6（registry MIT），不与 Vue 适配长期并存 |

已有 `@tauri-apps/api`、marked 和业务工具函数按调用需求复用，不因换 React 同时升级所有依赖。新增包需记录直接/传递许可证与已知漏洞检查结果。微软仓库 README 另提示字体/部分引用资产的许可要求，包的 MIT 声明不能视为允许随意打包 Segoe UI 等系统字体；当前计划使用系统字体回退。

### 明确不采用的方向

- `@fluentui/react` v8、Northstar v0、Web Components/React Native：不与所选 v9 通用控件混用；微软 README 推荐新的 React 项目使用 v9，Northstar 已结束维护。
- `@fluentui/react-charting 5.25.11`：虽然也是微软项目，其 peer 依赖 `@fluentui/react ^8.125.7`，本计划选独立 v9 `react-charts`。
- 不假设存在稳定 `@fluentui/react-motion-components` 包（查询返回404）。`react-motion-components-preview 0.15.8` 是预览包，本计划默认不依赖；`react-components` 已依赖稳定 `react-motion ^9.16.3` 并导出创建动效的入口，先复用。
- 不重建 WButton/WSelect/WModal 的通用基础行为；只允许有明确产品语义的组合组件。主题外不建立一套并行设计系统。
- 不默认加入动画、路由、全局状态、表单和大型编辑器依赖；JSON override 当前用官方 Textarea 即可保持功能。

## 必须由原型解决的事项

1. 官方 v9 图表能否保留当前双曲线渐变、无多余坐标/图例、30点滚动与最低纵轴，同时控制包体积和更新开销；本轮未安装/渲染，不能写成通过。
2. Fluent Dialog/Dropdown 的 Portal、主题继承、透明背景与现有 Rust Mica/标题栏能否配合；需要 Windows WebView 实测。
3. 默认 motion 与现有250/100ms弹窗、300ms滑块、400ms按钮布局是否能通过公开配置对齐；只保留一个动画所有者，必要时使用小范围 CSS/WAAPI。
4. Tailwind 临时布局迁移策略与最终删除范围：按实际调用决定，不能为“纯 Fluent”重写所有布局，也不能长期保留两套控件样式覆盖。
5. 状态/更新进度若需要改协议，先查完整调用链并单独登记契约变更；不在视觉迁移中无边界扩展后端重构。

## 查询证据与可复核来源

- [微软 Fluent UI 总入口](https://github.com/microsoft/fluentui)：v9/v8/Web Components 区别、v9推荐、许可证和 Northstar 状态。
- [Fluent UI React 官方文档](https://react.fluentui.dev/)：组件、主题、样式与动效公开入口，实施时按已锁定版本复核示例。
- [官方组件导出源码](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-components/src/index.ts)：本轮只读核对 Accordion、Dropdown、Dialog、ToolbarRadioGroup、TabList、ProgressBar、颜色选择和稳定 motion 等导出；master 是可变来源，不替代安装版本的类型检查。
- npm registry 的 `/包名/latest`、完整包元数据：核对上表版本、peerDependencies、license、发布时间与插件 optional peers。确切候选详情可由 [组件](https://registry.npmjs.org/@fluentui/react-components/9.74.7)、[图表](https://registry.npmjs.org/@fluentui/react-charts/9.3.25)、[图标](https://registry.npmjs.org/@fluentui/react-icons/2.0.341)、[React](https://registry.npmjs.org/react/19.3.0)、[Vite 插件](https://registry.npmjs.org/@vitejs/plugin-react/6.1.1) 复核。
- 部分猜测的 motion/chart README 路径返回404，未作为能力证据；组件能力判断来自上述官方导出与 registry，具体图表表现仍为 FE-003 验证事项。
