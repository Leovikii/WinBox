# 3.0.0-beta.2 UI 修复与验证

日期：2026-09-29。基于 dev，版本同步 frontend、Rust、Tauri 与锁文件。本轮不创建 PR、合并或发布。

## 修复结果

- Inbound 标签切换时，加载配置同步设置 editorBusy，原生 disabled 使 Fluent Tab 跳过指示条动画并移除 aria-selected。改用 aria-disabled 保留焦点、选中语义和官方动画，AppContext 的同步 in-flight guard 继续阻止重复操作，输入和保存仍受忙碌保护。
- 内容页复用官方 PageMotion；补齐 Tab / tabpanel 关联。重复选择当前标签不再重新读取配置或清空草稿。切到另一标签仍按既有语义重新读取对应配置。
- 两个固定内容页继续使用 Fluent TabList 默认 medium/transparent 样式。标签组靠左、置于标题下和编辑器上，删除编辑器内容区额外顶部 20px padding，保留 16px 内容间距和底部操作区。
- Windows 指南允许静态标签，旧式 Pivot 已不推荐。左对齐和间距调整属于此弹窗的产品布局选择，不宣称是微软强制像素要求，也不宣称 Fluent Web 与原生 WinUI 完全等同。来源见 [前端规范](frontend.md)。

## 共用弹窗检查与优化

检查 11 类弹窗：配置管理、日志、退出、主题色、镜像 URL、Inbound、重置确认、UWP、应用更新、内核更新、管理员授权。

- 共用官方 Dialog 的入场、退场、遮罩动画正常，无需自建动画。Inbound 内容只在切换标签时播放，初次打开不叠加内容入场。
- 删除内容顶部额外 padding 和直接段落的默认 margin；标题底部统一 12px。修复配置管理操作组 width:100% 导致的无必要换行；按钮在窄窗口保持文本所需最小宽度。
- 按 Windows ContentDialog 指南排列执行动作与最右侧安全关闭动作；日志增加底部 Close、退出增加 Cancel。右上角关闭、Escape 和原有功能保留，不添加危险动作的 Enter 快捷提交。
- 镜像 URL 编辑改为紧凑宽度和 96px 输入区，保留验证、Reset、Save、Cancel。
- busy 在共用 Dialog 中锁定标题关闭、Escape/遮罩关闭；UWP 保存时同步锁定复选框，管理员请求等待时关闭按钮显示禁用。可取消的配置加载仍可关闭，不改变提权协议或后端权限行为。

## 本轮验证

- 前端生产构建、Node 逻辑检查通过；保留既有大于 500kB bundle 提示。
- Edge 生产 bundle + 官方 MockIPC 完整回归：340 项通过，0 失败。新增检查实际指示条中间帧、内容入场中间帧、慢加载期间选中语义与防重入、重复点击保留草稿、键盘切换、布局对齐；既有保存失败、迟到响应、关闭/重开回归通过。另增底栏安全关闭顺序、配置管理单排布局、镜像编辑器紧凑尺寸、UWP 保存与授权等待关闭保护检查。
- 额外 inbound 视觉矩阵：浅/深色 × 320/400/480 宽度、减弱动效/高对比度、200% CSS zoom、320×360 低高度通过；已检查截图。低高度 textarea 使用公开 slot 去除默认 52px min-height 和 260px max-height，内容在框内滚动。截图、视频和采样数据位于忽略的 frontend/test-results，不入库。
- 11 类弹窗 × 浅/深色 × 320/400/480 宽度共 66 组：布局、按钮文字不溢出、稳定截图、入场/退场帧采样通过。另加 11 类弹窗各自的 320×360 低高度、高对比度/减弱动效、200% CSS zoom 检查，共 99 组通过；减弱动效没有透明度渐变中间帧。具体证据为忽略的 dialog-*-matrix.json 与 dialog-*.png。
- 无 Rust 行为改动，未重跑 Rust 测试、Clippy、NSIS 构建或签名发布。本轮浏览器验证不替代 Windows WebView2、原生 DPI / 文字缩放和实机验收。
- 已按用户要求构建 Windows x64 单 EXE 测试版（Tauri --no-bundle，locked/offline）：`src-tauri/target/test/WinBox-3.0.0-beta.2.exe`，19.11 MiB；ProductVersion/FileVersion 均为 3.0.0-beta.2，PE Machine 0x8664。SHA-256：E0E5D0618424B7CED2266F459CD99BFDE296FB3E73AECC3781A0451A3720851B。前端资源内嵌，沿用现有用户数据与系统 WebView2；用户已于 2026-09-29 确认此测试版实机验证通过，并授权提交、推送 dev；此 EXE 不作为正式发布资产。

本轮 UI 修复及弹窗优化已获用户实机验收。用户未逐项列出 DPI、文字缩放及完整发布矩阵，故不将总体确认扩大为所有专项均已执行。由维护者稍后手动 PR 到 main，原工作流负责发布。

## 延续的实机验收边界

用户已确认此前启动白屏、自动连接检查 UI，以及最新源码低版本测试包更新功能正常；旧 alpha 的检查更新报错已关闭。管理员实例仍先通过官方 updater 下载并验签，再交接普通实例安装；退出仍异步取消下载并清理内核/代理。

上述总体确认不等于发布矩阵逐项执行。管理员 TUN/mixed 依赖代理下载、断网交接安装、慢下载时窗口/托盘退出、交接失败、错误签名、数据保留、原生托盘/自启、跨账户拒绝和 WebView2 缺失等仍按 [开发指南](development.md) 验收。浏览器 MockIPC 不能替代这些实机结论。
