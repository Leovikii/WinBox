# 前端设计与实现规范

`3.0.0-beta.2` 恢复 inbound 标签官方指示条与内容切换动效，左对齐标签组，并统一其他弹窗的间距、按钮顺序与忙碌关闭反馈；验证边界见 [审查与验证报告](review.md)。

## 布局验收

- 收起的单行卡片应让可见标题行和控件在卡片内容盒中垂直居中；高度预算包括边框、padding、控件 root/slot 的实际高度。稳定帧中心偏差目标不超过 1 CSS px，这是产品验收公差。展开卡片仍按标题/内容分区排版。
- 隐藏内容的布局占位与 inert/aria-hidden 分别检查；修复不得只用透明度隐藏，或靠负 margin/translateY 补偿偏移。保持下方两卡和启停中间帧几何约束。
- 测量控件真实盒模型和层叠结果，不能只读单条 CSS 的 min-height；优先公开 size/slot/token，明确紧凑文字例外。弹窗长内容、低窗口高度和文字缩放时仍须可滚动到内容，操作与焦点始终可达。
- Profile 收起态通过 flex 居中，并将隐藏行移出正常布局；离线状态卡使用居中内容预算。通用弹窗内容可滚动、标题可换行，只有 JSON 编辑器内容区保留专用 overflow。标题栏提示统一使用 Fluent Tooltip。浏览器 deviceScaleFactor 不替代 Windows DPI 与文字缩放实测。
- 下拉按钮的 12/16 与模式标签的 12/16 保留为紧凑密度例外，普通设置标签继续 14/20；控件交互、焦点、禁用和高对比度仍由 Fluent 公开 root/slot 承担。

权限交互：复用 ProductDialog、状态卡、Start 和设置行；TUN/mixed 授权后自动重启连接，取消保持未连接。开机自动连接只记录等待授权，不抢焦点或主动弹 UAC；手动启动可显示授权确认。权限等待与内核 busy/running 分离，状态以后端为准。启动按钮始终使用 Start，不因取消授权改名；普通权限 TUN/mixed 从首次启动即显示盾牌。授权弹窗采用一句说明、并排 Continue/Cancel，复用 dialog-actions-stretch。UWP 授权保留草稿，重开后重新确认；不新增权限页面或通用弹窗框架。设置页不展示权限状态行；普通权限无标识，管理员运行仅在标题栏显示可聚焦盾牌及 Fluent Tooltip。Auto connect 保持单行，标签旁的 Fluent 帮助按钮通过悬停/键盘焦点显示简短 Tooltip，不常驻说明段落。

## 依据

初始化快照的模式使用独立 modeRevision 校验，只有新的模式事件/成功离线模式保存才使模式快照过期。权限、busy、status 等生命周期事件不会丢弃已保存的 TUN/mixed 模式；运行状态仍用生命周期 revision 防止旧快照覆盖新事件。

开机 TUN/mixed 等待授权时发送一次 Windows 通知，点击打开主界面后复用 Start/授权弹窗；不自动弹 UAC。系统通知被关闭或勿扰隐藏时保留托盘短提示及主界面等待状态。启动代理恢复失败从初始化快照读取 `proxyError`，不依赖前端尚未订阅时的瞬时事件。

全局错误复用单个 Fluent Toaster，在顶部居中、48px 标题栏下方覆盖显示（控件自带 16px 间距），不遮挡窗口按钮、不挤动页面。复用现有错误状态，新错误更新当前 Toast、不堆叠；保持显示至关闭或重试 Start。保留完整英文错误原文，长文本换行、超长内容在 ToastBody 内滚动，关闭按钮始终可见，正文可键盘聚焦滚动。表单局部校验仍保留就近 MessageBar；系统开机通知与应用内 Toast 分开。

优先级：微软 WinUI 3 / Windows 设计及无障碍 → Fluent React v9 官方能力 → WinBox 已验收产品基线 → 最小自定义。旧效果参考 `v2.8.0`（`3b5eef8`），不恢复旧框架/手写控件。Fluent Web 不等于原生 WinUI，默认像素和 DPI 表现不能视为相同。

官方来源：[字体](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)、[几何](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/geometry)、[颜色](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/color)、[材质](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials)、[动效](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/motion)、[图标](https://learn.microsoft.com/en-us/windows/apps/design/iconography/)、[无障碍](https://learn.microsoft.com/en-us/windows/apps/design/accessibility/accessibility-overview)、[Fluent v9](https://react.fluentui.dev/)。具体能力以安装版本公开类型/导出为准。

## 组件、文字与表面

- Inbound 编辑器为两个固定内容页，保留 Fluent TabList 默认 medium/transparent 样式与官方指示条，标签置于标题下、编辑器上方并靠左；去除内容区额外顶部 20px padding。左对齐是产品布局选择，不是 Windows 强制像素规则。[Windows TabView 指南](https://learn.microsoft.com/en-us/windows/apps/design/controls/tab-view)允许静态标签；[Pivot 指南](https://learn.microsoft.com/en-us/windows/apps/design/controls/pivot)已不推荐旧式 Pivot。Fluent Web TabList 不宣称与原生 WinUI TabView 完全相同。
- 加载/保存时 Tab 使用 aria-disabled，AppContext 的同步 in-flight guard 阻止切换；不使用会令 Fluent 跳过指示条动画并清除 aria-selected 的原生 disabled。编辑器仍禁用输入；当前标签重复点击不重读配置、不清空草稿。Tab 与 tabpanel 显式关联，内容复用官方 PageMotion，减弱动效由官方 presence 及现有 CSS 处理。JSON textarea slot 去掉默认 min/max-height，随编辑区伸缩并在框内滚动。切换到另一页仍沿用重新读取配置的既有语义。

- 官方 Button、Input/Textarea、Switch、Checkbox、Dropdown/Option、Dialog、MessageBar、Toaster/Toast、RadioGroup、TabList、ProgressBar、SwatchPicker、AreaChart 实际承担交互。主题 token → 公开 props/slots/motion → 必要产品样式；不依赖生成类名/私有 DOM，不复制控件，不做无用代理库。
- `ProductDialog` 是业务弹窗组合，保留官方 focus/Escape/Portal 与离场；`ScrollArea` 复用 OverlayScrollbars。自定义颜色保留原生 `input type=color`，Cancel/Apply 操作不变。
- 所有弹窗共用标题底部 12px、内容底部 20px、内容项间 16px 的产品间距，直接段落不再叠加浏览器 margin。固定内容弹窗与长列表保持内容滚动、底栏可达；镜像 URL 编辑使用紧凑 96px 输入区，不占用 JSON 编辑器的固定大高度。
- 按 [Windows 对话框指南](https://learn.microsoft.com/en-us/windows/apps/design/controls/dialogs-and-flyouts/dialogs)，执行动作在左，安全关闭动作在最后（Cancel / Close / Later），保留右上角关闭和 Escape；不添加危险动作的 Enter 自动提交。日志增加底部 Close、退出选项增加 Cancel。配置管理 Add profile 与保存/取消在容纳得下时同排，窄窗口自动换行；按钮不压缩到文字所需宽度以下。
- 共用 Dialog 保留官方 250ms 入场 / 167ms 退场与 83ms 遮罩。编辑器内容只在标签切换时播放 PageMotion，初次打开由 Dialog 动画负责。busy 同时锁定标题关闭、Escape 和遮罩关闭；UWP 保存和权限请求期间传入 busy，UWP 复选框也随保存禁用。可取消的配置加载仍允许关闭，原有业务关闭边界不扩大到全部异步操作。
- 正文/设置标签 14/20 Regular，小标题 14/20 Semibold，辅助信息 12/16 Regular，弹窗标题 20/28 Semibold。不要缩小文字解决溢出；紧凑控件有产品密度例外，以当前实现和缩放回归为准。
- Segoe UI Variable → Segoe UI → system-ui/sans-serif；日志用等宽回退。sentence case，保留 TUN/UWP/IPv6。普通图标用原生 16Regular，空态 24Regular，不把大图标统一缩小；纯图标按钮有可访问名称。GitHub 为单色 16px 品牌标志。
- 通常控件 4px、菜单/Dialog 8px；产品卡片 8px。间距优先 4/8/12/16/24。单个 FluentProvider 统一浅/深/系统主题；强调色的 normal/hover/pressed/selected 必须可区分，极亮极暗自定义色仍可读。
- 普通文本对比度至少 4.5:1、大字 3:1、必要焦点/控件信息 3:1；状态兼用文字/图标。保留官方键盘焦点，不以去掉焦点修复鼠标边框。
- Mica 由 Rust 窗口负责，CSS blur 不等于 Mica。Dialog 表面遮蔽底层文字；菜单中性细边框/官方阴影，不重复画 slot/root 两层边框。高对比度用系统色，无透明/blur 仍可操作。

## 主页与动效硬约束

- 四卡布局：状态/配置卡在启停间交换 58px 与内容区四分之一高度，二者总高不变；下方控制/日志卡 top、height、width 在所有中间帧不变。400×720 是参考 viewport，不等于物理像素。
- 卡片高度、Start 满行→中间三分之一及侧按钮联动为 333ms。只有后端 status 确认就绪/退出才转换；Starting/Stopping/Restarting 是操作反馈，不能靠动画结束推断内核状态。重启中间离线态保持 busy，运行中模式滑块等 state-sync 才提交。离线模式保存只标记模式区域 aria-busy，保存成功才提交，不触发全局忙碌图标/禁用闪动；本地防重入及后端 operation 锁阻止与启停交错。
- 离线 PlugDisconnected16Regular，运行 PlugConnected16Regular；忙碌 ArrowSync。状态光晕参照 2.8：背景 inset 0、scale 3、blur 6px、opacity .4，1000ms cubic-bezier(.4,0,.2,1)；图标 drop-shadow 6px、filter 500ms。装饰不遮字，不缩放状态图标。
- Dropdown 宽度/锚点由 Fluent 管理；Portal 中禁止 `min-width:100%` 扩展到页面宽，禁止动画覆盖定位 transform；菜单只淡入（167ms）。逐帧检查首次打开、键盘、上下展开、窄窗口和浅深主题。
- 页面/展开使用官方 presence；通常进入/连接 250ms、退出167ms，遮罩83ms，以 `motion.ts` / Dialog 公共 motion 参数为准。不要叠加两套入场，避免 transition:all、无用途无限动画和逐帧 JS 测高。
- reduced-motion 关闭装饰/长过渡；forced-colors 去掉光晕/阴影并保留状态和焦点。隐藏页 inert，不丢设置滚动位置、图表历史或草稿；禁用恢复后保留键盘焦点。

## 状态和验证

自动连接检查的 Detecting / Standby / Net Timeout UI 保留。通过 startup-status 事件及 get_init_data.startupStatus 恢复真实阶段，不依赖前端及时收到瞬时 log/core-lock；初始化快照不能覆盖更新的检查事件。检测中禁用 Start，检测结束恢复操作；检查已在窗口出现前结束时显示实际结果，不延迟内核或补播假进度。

启动 HTML 在外部资源加载前解析缓存主题（无效或不可读时跟随系统），同步设置 color-scheme、dark 类及临时浅/深底色。React 首轮主题沿用该结果，提交后恢复透明 Mica 并通过 backend.ts 的 FrontendReady 通知 Rust。原生窗口初始隐藏，后端 setup 与前端提交均完成后才按启动意图显示；不等待业务初始化或网络请求，不依赖隐藏窗口可能暂停的 rAF。后端10秒失败兜底，HTML 保留加载及托盘退出提示。后端快照仍为最终主题权威，并更新下次启动缓存。原生合成器首帧必须实机验证。

`AppContext` 是前端状态入口；Rust 为 running/mode 权威。必需事件注册失败时保持未初始化并显示带 Retry initialization 的 Toast，重试清理旧监听；不把失败的监听当作就绪。先完成事件注册再取快照，并防迟到快照覆盖新事件；释放监听/计时器，验证 StrictMode。主题、流量、日志与低频业务上下文分开；Dashboard 不直接订阅流量和日志，对应组件局部更新。日志按 100ms 合批，队列和显示历史均有界，快照不能覆盖更新的日志事件；错误保留草稿并解除忙碌。远程 Markdown 不获得 HTML/IPC 高权限。

每次 UI 改动验证浅/深、320/400/480 宽度、长文本、鼠标/键盘/Escape、焦点恢复、慢操作/失败、减弱动效/高对比度及 100–200% 缩放。实际渲染/逐帧检查不能用编译代替；测试入口见 [development.md](development.md)。

开机启动开关状态局部保存在设置组件中，每次进入/返回设置页查询当前用户自启项；查询失败显示错误并禁用未知状态，操作期间防重复提交，失败后重新查询实际状态。

更新检查保留结构化后端错误；版本未知或元数据无效不能显示 Latest。缺少内核时 Download 直接安装，完成后读取真实后端版本。检查/安装期间锁定更新通道，应用与内核安装互斥；失败保留反馈并允许重试，不用延迟计时器重置新请求。更新日志转义原始 HTML，仅允许 HTTP(S) 链接并经后端打开系统浏览器，图片仅显示替代文本。

更新按钮与下载反馈区域共用 112px 宽、32px 最小高度；下载时在官方 ProgressBar 上方居中显示百分比。可用更新统一使用 secondary 的单行 Update；完整版本号与日志在共用弹窗展示，确认按钮使用 primary。应用与内核升级均先确认，首次下载内核直接执行。日志复用 ScrollArea 限高滚动，页脚保持可见；只做布局，不自绘按钮内填充。

待更新 secondary 按钮仅文字/图标使用 colorBrandForeground1；保留官方背景、焦点与禁用状态，不增加闪烁。强制颜色模式使用系统 ButtonText。日志在 Markdown 文本 token 中转换常用 emoji 简码，代码块、行内代码及链接地址不转换，未知简码保留。当前为有限映射，不宣称完整 GitHub emoji 兼容。

档案管理先校验整份草稿再写入；保存期间锁定输入、添加、删除及关闭，逐项保留成功结果，失败后重试不得重复新增。新增使用草稿的稳定 UUID 并接受后端返回的 ProfileDto。编辑器加载/保存有忙碌保护，关闭或重开使旧响应失效；成功保存立即关闭，不留下延迟关闭计时器。重置仍直接持久化，切页仍读取对应配置，未改变既有草稿语义。
