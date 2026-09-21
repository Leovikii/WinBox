# React + Fluent UI 前端迁移计划

目标版本：`3.0.0-alpha.2`。2026-09-21 用户指定：保留后端人工测试，先进入前端迁移；Vue 3 迁移为 React，通用组件替换为微软 Fluent 官方组件，保留并尽可能优化当前视觉、动画与交互。本版完成 Windows AMD64/x64，Linux 在下个版本开发。

本文件先定义交付计划，实施已在当前 `dev` 工作区推进到前端 review 阶段。前端进度唯一来源为 [tracker.md](tracker.md)，依赖候选、来源及限制见 [decisions.md](decisions.md)。后端未完成人工测试继续在 [原台账](../tauri-migration/tracker.md) 与 [验收清单](../tauri-migration/validation.md#待补人工验收2026-09-21) 保留，不作为前端启动的整体前置门槛，也不因前端构建通过而自动关闭。

## 1. 推荐方案

采用 **React + TypeScript + Vite + Fluent UI React v9**，继续使用现有 Tauri 2/Rust 后端与 `frontend/src/api/backend.ts`。Fluent UI 是 Web 组件体系，不是 Windows 原生 WinUI 控件；适合当前 WebView2，也能用于未来 Linux WebKitGTK，但不代表两个 WebView 的视觉和行为已经等价。

- 控件优先直接使用 `@fluentui/react-components`；图标使用微软 `@fluentui/react-icons`，移除 Font Awesome CDN。保留 WinBox 品牌图标。
- 用一个 `FluentProvider`、浅/深主题、品牌色与少量产品 token 管理视觉；通过官方 props、slots、`makeStyles`/`mergeClasses` 适配尺寸、边框、阴影与布局，不覆盖私有 DOM 或生成类名。
- 使用官方稳定动效入口及 CSS/浏览器动画能力；先匹配现有效果，再做测量驱动的优化，不额外默认引入 Framer Motion、GSAP 或通用动画框架。
- 只保留产品布局、材质、选中滑块和状态切换等必要样式。目标不是零 CSS，而是不再手写按钮、输入框、开关、下拉和弹窗的交互基础设施。
- 不引入 Next.js、路由框架、Redux 或第二套 UI 库；当前主界面/设置两个视图不需要完整路由系统。确有新需求时再评估。

原有控件本身是在模仿 WinUI。本次迁移按“用微软官方控件承接既有 WinUI 风格”实施：替换控件与保留效果在同一个切片内完成，不先做一版视觉缩水的默认界面再等待后续恢复。优先验证官方主题、组件状态和 motion 能力，缺少的产品特有效果才补最小样式。Fluent Web 与原生 WinUI 的实现不同，对照用于校准差异，不作为保留整套手写控件的理由。

## 后续 agent 的执行约束

以下规则是每个实现切片的完成条件，不能只作为建议阅读：

1. 开始时核对工作区，阅读本文件、tracker、decisions 和受影响的后端契约；认领任务并记录范围。本轮文档中的“尚未安装/仅计划”是日期快照，用户后续授权实施后按台账推进，不当作永久禁令。
2. 先盘点控件、调用链与状态，再使用官方组件的公开 props/slots/token/motion 替换；官方组件必须实际承担交互、键盘与焦点行为，不能只包一层外壳，内部继续复制旧控件。
3. 允许直接组合官方组件为业务界面；只有重复且确有产品语义时才抽取组合组件，不建立一套映射所有 Fluent 属性的 W 控件代理库。
4. 样式优先级：官方主题/token → 官方 props/slots 与公开样式接口 → 必要的产品布局/装饰/转场。新增定制需在切片交接中说明对应现有效果、官方能力的具体缺口和验证结果；禁止复制旧 CSS 全集、覆盖私有 DOM/生成类名、用全局 !important 修补组件。
5. 以现有布局、层次、密度、颜色语义、操作路径和动态连续性为验收基线；不要求复刻旧实现的代码或缺陷。官方控件的等价反馈、无障碍改善与不劣化的细节优化可自行实施并记录；只有实质视觉/交互变化才需用户确认。
6. 每个切片记录旧控件→官方组件、保留的效果、删除的旧代码/依赖、实际验证与未执行项。静态截图验证外观，录屏/交互验证动效；未采集到实机证据时保持 review，可继续独立工作，不伪记通过。
7. 平台耦合按下节边界处理；保留后端人工测试，正常实施选择无需重复审批。不得以未来 Linux 为由删除本版 Windows 能力，也不得为跨平台提前创建空实现。

## 2. 现状与迁移风险

源码基线为已发布 alpha.1 的 `d0a199346f383f9a2e42c211979fb88b74b4bcf0`；当前工作区已完成 React/Fluent alpha.2 迁移，以下表格保留为迁移风险和对照基线。

| 当前实现 | 迁移重点 |
| --- | --- |
| `App.vue`：标题栏、主界面/设置、关闭询问、更新说明，使用 KeepAlive | 显式保留页面草稿、滚动位置及图表历史；切页不重复初始化，隐藏页不可聚焦，不无谓持续渲染 |
| 7 个 composables，模块级 Vue ref 与 mountedUsers | 改为单一 React 生命周期入口；不能机械翻译为每组件各自 useEffect 订阅 |
| App/useAppState/useTheme 各调用 getInitData | 一次初始化快照分发；后续按真实操作刷新，合并并发请求，不做永久缓存 |
| `backend.ts` 为纯 TypeScript invoke/listen 边界 | 可复用；目前混合 Promise 异常与字符串结果，迁移时逐功能统一错误处理并更新调用者 |
| 应用/内核更新共用 download-progress，状态文案参与判断 | 先保持既有协议并防止两类更新重叠串进度；若确需 kind/operationId，单独同步 Rust、TS、调用者及 contracts，不顺带大改后端 |
| 自制 W 控件、页面内原生按钮/checkbox、Tailwind 与局部 CSS | 不只替换 W 前缀组件：逐个覆盖页面内直接手写的交互控件 |
| SVG 网速图，30 点、最低 100 KiB/s 纵轴、蓝/绿双面积渐变 | 用 Fluent v9 图表做对照验证；保留缩放、颜色、填充、更新节奏及停止行为 |
| OverlayScrollbars 控制自动隐藏、日志跟随与细滚动条 | Fluent 没有已核实的等价通用滚动组件；优先复用现有成熟滚动库核心，移除 Vue 包，必要时采用 React 适配，不重写滚动条 |

## 3. 组件映射

| 现有控件/场景 | 推荐官方替代 | 需保留的细节 |
| --- | --- | --- |
| WButton、标题栏和列表图标按钮 | Button + Fluent Icons，按需 Tooltip/Spinner | 密度、禁用/忙碌、危险色、按压反馈、标题栏非拖动区 |
| WInput / WTextarea | Field + Input / Textarea | 标签、校验反馈、等宽 JSON 编辑、可选中文本 |
| WSwitch、手写勾选框 | Switch / Checkbox | 现有保存时机、失败回滚、焦点与键盘操作 |
| WSelect | Dropdown + Option；只有确需搜索时用 Combobox | 紧凑尺寸、定位、遮挡、长文本、选中值和关闭行为 |
| WCard、状态/配置卡片 | Card / CardHeader / Text | 当前四区布局、8px 卡片圆角、内阴影、状态色与玻璃层次 |
| WModal、退出/配置/更新/UWP 弹窗 | Dialog / DialogSurface / DialogActions | 现有居中弹窗，不为使用 Drawer 改操作路径；缩放/遮罩、Esc、焦点恢复、嵌套确认层 |
| WInfoBar | MessageBar | 原位置与高度展开效果，不擅自变为全局 Toast |
| WSegmentedControl：模式选择 | ToolbarRadioGroup / ToolbarRadioButton | Proxy/TUN/Mixed 互斥语义、滑动选中背景、禁用；装饰滑块不接管官方键盘/焦点逻辑 |
| WSegmentedControl：编辑器页签 | TabList / Tab | 对应 panel、选中指示、动画；不用 tabs 假装模式单选 |
| WExpandable | Accordion（有展开标题）；其他纯内容展开用官方 motion | 保留高度变化，不引入重复展开状态 |
| WColorPicker、主题自定义颜色 | SwatchPicker / ColorPicker 及官方子组件 | 预设色、自定义色、Cancel/Apply 草稿语义、品牌色对比度 |
| 更新下载进度、加载状态 | ProgressBar / Spinner | 保留原有按钮附近/内部位置、百分比与失败状态，不改变页面结构 |
| WSpeedChart | `@fluentui/react-charts` v9 | 优先官方面积/折线能力；双曲线渐变与30点滑动、无多余轴/图例/交互需原型证明 |

图表是选型门槛：当前已使用 v9 `AreaChart` 承载双曲线、30 点滚动、最低纵轴和无图例/Tooltip 的产品需求，并以浏览器构建和窄视口回归验证。真实流量压力与 Tauri WebView 仍属于人工验收；标准控件不保留一套手写替代品。

## 4. 视觉与动效保留

alpha.1 源码数值作为初始参照，当前已用生产预览截图和交互回归校准；CSS 存在 transition 声明不等于浏览器真的实现了流畅插值，尤其是 SVG path，真实窗口录屏仍待人工验收。

| 场景 | 当前源码基线 | React 迁移要求 |
| --- | --- | --- |
| 页面进入 | 300ms，opacity + translateY(20px)，cubic-bezier(0,0,0,1) | 保留入场方向/节奏；退出与新页衔接不闪屏 |
| 弹窗 | 进入250ms、退出100ms，scale(0.95) + opacity，分别使用进入/退出曲线 | 不在关闭瞬间卸载；不与官方默认 motion 叠加执行两次 |
| 模式滑块 | 300ms ease-out，按选项宽度 translateX | Fluent 负责交互，单一装饰层负责现有滑动反馈 |
| Start → Stop/Web UI/Restart 控制区 | 400ms cubic-bezier(0.25,1,0.5,1)，位移/缩放/布局变化 | 保留按钮展开、收拢和重排连续性；不只做淡入淡出 |
| 配置列表增删 | 400ms 同上曲线，进入 translateY(15px)、退出 scale(0.9) | 保留 keyed 项目及离场生命周期；必要时对布局变更使用最小 WAAPI/FLIP 处理 |
| 内容展开与消息条 | 300ms，grid 高度与 opacity | 优先官方 motion，按原触发时机匹配，避免每帧 JS 测高 |
| 开关/按钮/滚动条 | 150–300ms 各自反馈，hover/press、滚动800ms后隐藏 | 不粗暴统一全局时长；保留精细反馈 |
| 网速图、状态色、更新提示点 | 双渐变、线条及脉冲 | 保持视觉连续性、停止/隐藏行为；不让每条流量事件重渲染整页 |

样式组织：Fluent token 管通用色彩/字体/密度；一处产品主题配置管 Mica 表面、状态色、特殊阴影和动画参数。自定义强调色应生成完整品牌色阶并检查浅/深主题对比度，不只替换一个按钮背景色。

优化只在对照通过后进行：优先 transform/opacity、缩小重绘区域、避免 transition: all、停止不可见的高频动画。新增 `prefers-reduced-motion` 和 forced-colors 适配；这是显式的无障碍分支，正常动效模式继续保留完整效果。屏幕阅读器不逐帧播报网速，不移除焦点轮廓换取视觉一致。

## 5. React 状态与 Tauri 边界

- 一个应用级 Provider 负责初始化、持久设置和低频运行快照，用 React 自带 Context/useReducer 起步；仅被少数组件使用的弹窗、草稿和忙碌态留在对应功能。
- 高频流量与日志独立于全局 Context 更新，保持有界数据与渲染范围；仅在实际订阅需求出现时使用 React `useSyncExternalStore`，不先建通用 store 框架。
- 监听注册完成后读取快照；快照在请求期间可能落后于事件，必须明确缓冲/重放或重新同步策略并测试，而不是宣称“先监听再读”自动消除所有竞态。
- 初始化任务有取消/代际保护；React StrictMode 的挂载→清理→挂载不产生重复 IPC 写入、重复监听或过期响应覆盖。只读检查可合并，实际启停/保存/更新只由用户动作或已定义生命周期触发。
- 订阅、定时器、requestAnimationFrame 和媒体查询监听统一按所有者释放；React 版不复制 Vue 的模块级 mountedUsers 机制。
- 表单保存失败要解除忙碌、显示错误并保留草稿；订阅管理先校验再发写请求，部分失败重新同步实际后端数据，不承诺当前后端没有的跨文件事务。
- Rust 仍为核心实际运行、配置和模式的权威来源；localStorage 只允许作为首屏主题提示，不能成为第二持久化状态源。
- 继续保留远程更新说明的 HTML/URL 安全边界和受控 opener；迁移到 React 不通过 dangerouslySetInnerHTML 放宽原有过滤，也不增加通用 shell/fs 权限。

## 6. Windows 与未来 Linux

同一套 Fluent 主题、组件和布局；平台差异限制在窗口材质、字体与能力边界，不复制 Windows/Linux 两套页面。

- Windows 保持既有 Rust Mica 与 light/dark/system 行为；FluentProvider 和页面背景必须允许系统材质可见，不能被默认不透明白底盖住。
- Linux 不假设有 Mica、Segoe UI 或 WebView2。默认中性不透明背景作为可靠降级；支持时再启用适度半透明。`@supports(backdrop-filter)` 只判断 CSS 能力，不能当作原生 Mica 检测。
- 字体使用系统栈（Windows 的 Segoe UI 优先，其他环境 system-ui/sans-serif），日志/编辑器用跨平台等宽回退；不捆绑未经授权的微软字体。布局给中文、字宽差异、125/150/200% 缩放留空间。
- Portal 中的 Dialog/Dropdown 必须继承主题、层级与方向，不能因渲染到 body 丢失材质/色彩；检查 WebView 边界下的裁剪与焦点。
- UWP、自启和窗口按钮的平台能力通过受控入口隔离。本版 Windows 全部保留，不根据 User-Agent 静默删功能；Linux 开发时再接真实能力声明，不提前造空 Rust 实现或跨平台插件框架。
- 本版可在浏览器预览中验证无 blur、替代字体和 reduced-motion 的展示状态；这些不是 Linux 实机支持证据。下版仍需 Linux/WebKitGTK、窗口管理器和托盘验证，不改当前 x64-only 构建门槛。

### 最小解耦边界（当前迁移必须遵守）

这些是职责边界，按实际规模放入已有文件或少量模块，不强制新建对应目录、接口或类。

| 职责 | 允许依赖 | 不应耦合的内容 |
| --- | --- | --- |
| 纯数据转换：模式映射、版本/速率格式、表单校验 | TypeScript 数据与纯函数 | React、DOM、Tauri、Windows 路径或平台判断 |
| 业务 hooks/状态：订阅、设置、更新、日志 | 统一 backend API、DTO 与 React 生命周期 | 注册表/任务计划、原生窗口句柄、Mica 细节、散落的系统判断 |
| 展示组件 | Fluent 组件、主题、业务数据/回调 | 直接 invoke/listen、独立持久化或重复核心运行状态 |
| 桌面接入 | backend.ts 中受控窗口/主题/外链/能力入口 | 通用 shell/fs 接口、在每个页面解析 OS 或 User-Agent |
| 主题与窗口外观 | Fluent token、媒体查询、集中维护的材质/字体策略 | 用 Windows 字体存在与否推断业务功能，或复制平台专用页面 |
| 系统功能实现 | Rust 现有 platform 边界 | 将 Windows API 与未来 Linux 命令搬进 React |

当前需要把窗口主题/Mica 副作用与通用 Fluent 主题计算分开；主题计算在无原生窗口的浏览器预览中也可工作，实际窗口更新只由桌面入口执行。通用主题与表单模块导入时不执行 Tauri IPC，防止预览/测试依赖管理员桌面。

UWP 页面与 Windows 专属动作保持独立业务组合，共享页面只负责展示其入口。Linux 开发时由后端提供真实受支持能力，再集中决定入口可见/可用与说明；当前只整理调用边界，不提前返回假 Linux 能力，也不把自启简单视为 Linux 永久不支持。若本版确需新增 capability DTO，必须在同一变更同步 Rust/TS/全部调用者/契约和验证。

未来 Linux 应主要新增实际平台实现、窗口材质策略与能力响应，不需要重写通用表单、业务状态或整套页面。检查内容包括：组件中无 Windows 路径拼接、无 navigator.platform/User-Agent 业务分支、无到处散落的 isWindows 判断；CSS 使用可移植能力与回退，不能依赖 Chromium 私有特性才可操作。当前仍不宣称 Linux 构建或实机通过。

## 7. 开发顺序与交付门槛

| 阶段 | 内容 | 退出条件 |
| --- | --- | --- |
| P0 / FE-002 | alpha.1 场景盘点与视觉/交互/性能基线 | 两个页面及所有弹窗、三模式、忙碌/失败/空状态有固定环境基线；保留已知后端问题编号 |
| P1 / FE-003 | React/Fluent 兼容验证；优先做主界面、Dialog、分段滑块、图表与滚动原型 | 官方组件能承载现有视觉和动效；依赖精确版本/许可证/锁文件明确；不接受只看静态截图 |
| P2 / FE-004–005 | React 入口、主题/状态/事件接入；版本切换 alpha.2 | Windows Tauri WebView 真实启动；初始化/卸载/并发/错误检查通过；单一状态与监听归属 |
| P3 / FE-006 | 主界面、配置管理、日志和核心控制 | 控件替换与业务行为均通过；保持页面状态、按钮重排、图表与日志跟随 |
| P4 / FE-007 | 设置、更新、UWP、颜色、关闭询问及剩余弹窗 | 页面内手写交互控件全部盘点替换；无被遗忘功能或视觉降级 |
| P5 / FE-008 | 删除 Vue 与无用依赖/样式；完整回归与 x64 NSIS 测试包 | 构建和 Windows 实机证据齐全；后端遗留清单继续保留，不把 alpha.2 发布准备等同后端全验收 |

迁移放在独立开发分支，以可回退的小提交推进。当前生产入口已切换为 React，未长期并存 Vue/React，也未建立跨框架同步桥；Tailwind 入口、旧 Vue 页面、W* 基础控件和 Font Awesome CDN 已移除，保留 OverlayScrollbars 作为已有日志/列表滚动能力。

版本已在 FE-004 同步：`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 与 Cargo.lock 的本包版本、`frontend/package.json` 与 package-lock 顶层/根包版本均为 `3.0.0-alpha.2`；运行时版本仍由 Tauri metadata 提供。alpha.1 作为历史版本未全仓字符串替换。本轮只生成本机 unsigned x64 NSIS 测试包，不合并 main、不创建 Release；后续发布遵循明确授权。

## 8. 验证和完成定义

1. **构建与依赖**：TypeScript/Vite、Tauri x64 unsigned NSIS；无 Vue runtime、Vue 插件/适配包、旧入口或远程图标 CSS。Rust/契约改动时运行既有 fmt/test/clippy，文档工作不重复构建。
2. **最小自动检查**：对快照/事件交错、StrictMode 异步卸载、失败解除忙碌/草稿保留、进度归属和日志/流量边界保留可运行检查；React 交互使用少量针对性测试，不为每个官方 Button 写镜像测试。
3. **静态视觉**：同机器/数据/主题/窗口对照，基准400×720及可调整尺寸，100/125/150/200% DPI；检查字体、卡片、留白、状态色、滚动条、遮罩和焦点，无裁剪/闪白/层级丢失。
4. **动态对照**：录屏覆盖进入、退出、中途反向切换和快速重复点击；不能用结束帧截图替代按钮重排、滑块或弹窗动画验收。
5. **行为/无障碍**：保留所有窗口/托盘路径、三模式和停止保留选择、配置/override、日志、自动连接、更新和 UWP；检查 Tab/Esc/方向键、焦点圈/恢复、IME、复制选择、高对比度与 reduced-motion。
6. **性能**：相同环境比较首次可交互、切页/开弹窗、流量/日志压力、空闲/隐藏 CPU/内存及产物体积；记录冷/热启动和多次测量，不预先声称 React 更快。60Hz 环境以约16.7ms帧预算观察正常转场，重复长帧或持续资源回归需定位后再验收。
7. **遗留分离**：后端原先未执行的人工场景不自动变 pass，也不要求先全做完才写前端；遇到迁移新引入的行为回归必须修复。可复用本轮产生的同场景证据，避免重复测试。

建议第一个实际实现切片集中在“Fluent 主题 + 主界面核心控制 + 一个 Dialog + 网速图”。先证明最重要的视觉和动效可以保留，再迁移全部设置表单，返工风险最低。

## 9. 当前实现交接（2026-09-22）

- 组件映射已落地：`Button`/Fluent Icons、`Input`/`Textarea`、`Switch`/`Checkbox`、`Dropdown`/`Option`、`Dialog`/`DialogSurface`/`DialogBody`/`DialogContent`/`DialogActions`、`MessageBar`、`RadioGroup`、`TabList`、`SwatchPicker`、`ProgressBar`/`Spinner`、v9 `AreaChart`；业务状态集中在 React `AppContext`，桌面调用集中在 `api/backend.ts`。
- 保留并优化：Mica 透明层次、8px 卡片圆角、状态色、Proxy/Tun/Mixed 选中滑块、页面/弹窗/列表动效、自动隐藏滚动条、日志跟随、焦点轮廓、reduced-motion 和 forced-colors 分支。`ProductDialog` 使用 Fluent 官方 anatomy 和 `DialogTrigger`；移除每个弹窗的全局事件监听，只保留受控 `open` 场景所需的最小焦点恢复桥接，并为编辑器保留明确的 Surface 高度/内容边界。
- 删除内容：旧 Vue 页面/composables、WButton/WInput/WSelect/WModal 等手写基础控件、Tailwind/PostCSS 配置、Font Awesome CDN 和旧入口；没有恢复 Wails 双后端或建立空 Linux 实现。
- WinUI 依据：微软 Design and UI principles、Geometry、Typography、Iconography、Color、Motion 白皮书/规范；当前采用内容层级、紧凑密度、4/8 间距、16px 常规图标、12px 控件文字、轻量边界、品牌色焦点和单一动效所有者。
- 已执行：`npm run build`、`npx tsc --noEmit`、`npm audit --audit-level=high`（0 vulnerabilities）、`git diff --check`；x64 `cargo fmt --check`、`cargo test --locked --offline`（33/33）、`cargo clippy --locked --offline -- -D warnings`；`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign` 通过。
- 视觉/交互证据：生产预览覆盖 400×720 基线与本轮窄视口；设置页 Dropdown 展开、定位、选择和 Escape；主题、日志、退出、Manage Profiles、UWP 空状态、编辑器弹窗；标题栏 hover 连续截图稳定。生产构建控制台无错误；开发环境仅保留 Fluent Keyborg/React StrictMode 相关警告。
- 2026-09-22 回归修复：应用更新比较在取得本机版本后再执行，`Unknown` 不再被当作可比较版本；增加检查中的并发保护。Dropdown 根控件与内部 combobox 只绘制一层 WinUI 边界，Portal 菜单改为不透明主题面、轻边框和选中背景，移除默认亮色焦点框；通过 Fluent `Option` 的公开 `checkIcon={null}` slot 完全移除左侧勾选节点和自定义竖条。弹窗表面改为不透出底层文字，编辑器 DialogBody/内容区/footer 已在窄视口填满；`ProductDialog` 用 `useLayoutEffect` 在 Fluent 自动聚焦前记录触发控件，Escape/关闭按钮退出后焦点恢复到原控件。浅色/深色主题、Dropdown、Manage Profiles、主题颜色和编辑器弹窗已用最新生产预览复核。
- 当前 x64 测试产物：[NSIS 安装器](../../src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/WinBox_3.0.0-alpha.2_x64-setup.exe)，主程序 PE `0x8664`、版本 `3.0.0-alpha.2`、大小 `18,959,872` bytes、SHA-256 `68AD0FC5282F19CE0837759751B744F8407848E16F00B08BBDF781A96C1264C7`；安装器大小 `4,775,180` bytes、SHA-256 `57B104D8FBFB007E4B5A571E4E430B5888DB4F57C18AD01147E80EDEF2BCF264`。只生成 NSIS，不生成 ARM64/MSI/portable。
- 未完成/阻塞：真实 Tauri WebView/NSIS 安装后人工验收，真实 profile/运行态/流量图表/日志压力、启停/模式/更新/UWP/主题材质/窗口按钮、DPI 100/125/150/200% 和旧数据边界。原生清单要求 `requireAdministrator`，当前非管理员启动返回 `0xc0000142`/`os error 740`；WebView2 `153.0.4234.48` 已安装，必须由用户以管理员权限启动并继续人工验收。浏览器预览中出现的 `invoke` 错误是没有 Tauri runtime 的预期限制，不记为前端视觉通过或后端失败修复。
