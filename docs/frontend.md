# 前端设计与实现规范

## 依据

优先级：微软 WinUI 3 / Windows 设计及无障碍 → Fluent React v9 官方能力 → WinBox 已验收产品基线 → 最小自定义。旧效果参考 `v2.8.0`（`3b5eef8`），不恢复旧框架/手写控件。Fluent Web 不等于原生 WinUI，默认像素和 DPI 表现不能视为相同。

官方来源：[字体](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)、[几何](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/geometry)、[颜色](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/color)、[材质](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials)、[动效](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/motion)、[图标](https://learn.microsoft.com/en-us/windows/apps/design/iconography/)、[无障碍](https://learn.microsoft.com/en-us/windows/apps/design/accessibility/accessibility-overview)、[Fluent v9](https://react.fluentui.dev/)。具体能力以安装版本公开类型/导出为准。

## 组件、文字与表面

- 官方 Button、Input/Textarea、Switch、Checkbox、Dropdown/Option、Dialog、MessageBar、RadioGroup、TabList、ProgressBar、SwatchPicker、AreaChart 实际承担交互。主题 token → 公开 props/slots/motion → 必要产品样式；不依赖生成类名/私有 DOM，不复制控件，不做无用代理库。
- `ProductDialog` 是业务弹窗组合，保留官方 focus/Escape/Portal 与离场；`ScrollArea` 复用 OverlayScrollbars。自定义颜色保留原生 `input type=color`，Cancel/Apply 操作不变。
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

`AppContext` 是前端状态入口；Rust 为 running/mode 权威。先完成事件注册再取快照，并防迟到快照覆盖新事件；释放监听/计时器，验证 StrictMode。主题、流量、日志与低频业务上下文分开；Dashboard 不直接订阅流量和日志，对应组件局部更新。日志按 100ms 合批，队列和显示历史均有界，快照不能覆盖更新的日志事件；错误保留草稿并解除忙碌。远程 Markdown 不获得 HTML/IPC 高权限。

每次 UI 改动验证浅/深、320/400/480 宽度、长文本、鼠标/键盘/Escape、焦点恢复、慢操作/失败、减弱动效/高对比度及 100–200% 缩放。实际渲染/逐帧检查不能用编译代替；测试入口见 [development.md](development.md)。

开机启动开关状态局部保存在设置组件中，每次进入/返回设置页查询系统任务；查询失败显示错误并禁用未知状态，操作期间防重复提交，失败后重新查询实际状态。

更新检查保留结构化后端错误；版本未知或元数据无效不能显示 Latest。缺少内核时 Download 直接安装，完成后读取真实后端版本。检查/安装期间锁定更新通道，应用与内核安装互斥；失败保留反馈并允许重试，不用延迟计时器重置新请求。更新日志转义原始 HTML，仅允许 HTTP(S) 链接并经后端打开系统浏览器，图片仅显示替代文本。

更新按钮与下载反馈区域共用 112px 宽、32px 最小高度；下载时在官方 ProgressBar 上方居中显示百分比。可用更新统一使用 secondary 的单行 Update；完整版本号与日志在共用弹窗展示，确认按钮使用 primary。应用与内核升级均先确认，首次下载内核直接执行。日志复用 ScrollArea 限高滚动，页脚保持可见；只做布局，不自绘按钮内填充。

待更新 secondary 按钮仅文字/图标使用 colorBrandForeground1；保留官方背景、焦点与禁用状态，不增加闪烁。强制颜色模式使用系统 ButtonText。日志在 Markdown 文本 token 中转换常用 emoji 简码，代码块、行内代码及链接地址不转换，未知简码保留。当前为有限映射，不宣称完整 GitHub emoji 兼容。
