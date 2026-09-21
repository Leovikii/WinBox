# 前端迁移台账

目标版本：`3.0.0-alpha.2`。本台账只维护前端阶段状态；后端未完成人工测试继续保留在 [原台账](../tauri-migration/tracker.md)，不阻止前端迁移启动，不据此标记后端验收完成。

状态：`todo` → `in_progress` → `review` → `done`；只有缺实际外部条件时使用 `blocked`。计划写完不等于实现完成。

| ID | 工作 | 依赖 | 状态 | 负责人 | 验收/证据 |
| --- | --- | --- | --- | --- | --- |
| FE-001 | 开发计划、源码盘点和官方组件选型 | 用户要求 | done | Codex / 2026-09-21 | README/decisions 已完成；官方 registry/源码核对记录见 decisions；本地链接、任务依赖、版本边界与 diff 检查通过 |
| FE-002 | alpha.1 视觉、动效、交互与性能基线 | FE-001 | review | Codex / 2026-09-21 | 以 alpha.1 源码数值建立对照；生产预览覆盖 400×720/窄视口、浅/深主题、空/错/忙状态和弹窗场景；真实 DPI/桌面录屏待人工 |
| FE-003 | Fluent v9 主题与高风险组件对照原型 | FE-002 | done | Codex / 2026-09-21 | FluentProvider、Button/Input/Switch/Dropdown/Dialog/Tab/Swatch/Chart/Scroll 已实际运行；下拉 Portal、Dialog anatomy、焦点/Escape、图表和滚动浏览器回归通过 |
| FE-004 | React 工程入口与 alpha.2 版本同步 | FE-003 | review | Codex / 2026-09-21 | React 19.3.0 + TypeScript + Vite；package/Cargo/Tauri 版本均为 alpha.2；前端 build/tsc、x64 Tauri NSIS 通过；真实安装后启动待人工 |
| FE-005 | 通信、状态与生命周期迁移 | FE-004 | review | Codex / 2026-09-21 | AppContext 为唯一应用状态入口，事件/定时器按生命周期释放，busy/finally/错误路径已回归；StrictMode/浏览器异常路径通过；Tauri IPC 实机仍待人工 |
| FE-006 | 主界面、核心控制、配置和日志迁移 | FE-005 | review | Codex / 2026-09-21 | 主界面、模式滑块、控制按钮、profile/log dialog、v9 AreaChart 和滚动已覆盖；浏览器空/错状态通过；真实 profile/运行态/流量/启停待人工 |
| FE-007 | 设置、更新、主题、UWP 与其余弹窗迁移 | FE-006 | review | Codex / 2026-09-21 | 设置 Dropdown、主题颜色、UWP、编辑器、更新/退出/日志/档案弹窗通过窄视口交互回归；真实 Windows API、Mica、更新/UWP/键盘和 DPI 待人工 |
| FE-008 | 删除 Vue 旧栈与冗余样式、Windows x64 验收 | FE-007 | review | Codex / 2026-09-21 | Vue/W* 基础控件/Tailwind/Font Awesome CDN/旧入口删除；audit 0 vulnerabilities、diff check、Rust 33/33 + clippy、x64 unsigned NSIS 通过；安装器与桌面人工验收未完成 |

## 当前交接

- 2026-09-21：用户要求保留后端人工测试，先迁移前端到 React + 微软 Fluent 官方组件；版本目标 alpha.2；当前 Windows x64，下版 Linux。实施已完成到 review，未发布 Release。
- 组件交接：旧 Vue/W* 控件由 Fluent 官方 Button/Input/Textarea/Switch/Checkbox/Dropdown/Dialog/MessageBar/Tab/Swatch/Progress/Chart 承接；产品 CSS 只保留 Mica、布局、状态色、模式滑块、动效和响应式规则。`ProductDialog` 使用 Fluent 官方 Dialog anatomy，修复嵌套滚动导致的弹窗收缩、底层内容透出和窄窗口按钮截断；标题栏 Tooltip Portal 已移除以修复 hover 闪烁，受控弹窗仅保留最小焦点恢复桥接。
- 删除内容：Vue 页面/composables、W* 基础控件、Tailwind/PostCSS 配置、Font Awesome CDN、旧入口；不恢复 Wails 双后端，不提前建立 Linux 空实现。完整切片说明见 [README 当前实现交接](README.md#9-当前实现交接2026-09-22) 与 [decisions 实施记录](decisions.md#实施交接证据2026-09-21)。
- 自动验证：`npm run build`、`npx tsc --noEmit`、`npm audit --audit-level=high`（0 vulnerabilities）、`git diff --check`；x64 `cargo fmt --check`、`cargo test --locked --offline`（33/33）、`cargo clippy --locked --offline -- -D warnings`；`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign` 均通过。
- 当前产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe` 版本 `3.0.0-alpha.2`、PE `0x8664`、大小 `18,959,872` bytes、SHA-256 `68AD0FC5282F19CE0837759751B744F8407848E16F00B08BBDF781A96C1264C7`；NSIS `WinBox_3.0.0-alpha.2_x64-setup.exe` 大小 `4,775,180` bytes、SHA-256 `57B104D8FBFB007E4B5A571E4E430B5888DB4F57C18AD01147E80EDEF2BCF264`；bundle 目录仅有 nsis。
- 浏览器回归：生产预览覆盖 Dropdown 点击展开/选择/Escape、主题/日志/退出/档案/UWP/编辑器弹窗、空/错状态和标题栏 hover；当前窄视口无内容收缩/按钮裁剪，生产构建无控制台错误。AX/DOM 确认选项无 `.fui-Option__checkIcon` 节点和内部边框，选中项仅保留背景色；开发环境仅有 Fluent Keyborg/React StrictMode 警告。
- 2026-09-22 追加回归：重新生成生产 `dist` 后确认浅色 Dialog Surface 不透出底层文字、编辑器 Surface 的 body/content/footer 连续填满、Dropdown 菜单为单一轻边框且无左侧勾选图标/自定义竖条；`ProductDialog` 的 Escape/关闭按钮退出后焦点恢复到触发控件。浅/深主题和普通/编辑器弹窗均通过浏览器视觉检查。更新检查竞态保护与 `Unknown` 版本安全分支已登记在 `AppContext`。
- 原生阻塞：清单要求 `requireAdministrator`，非管理员启动返回 `0xc0000142`/`os error 740`；WebView2 `153.0.4234.48` 已安装。必须由用户管理员启动后继续真实 Tauri、安装器、更新/UWP、Mica、托盘、自启和 DPI 人工验收，当前各项保持 `review`。
- 未执行/必须人工：真实 Tauri WebView 启动和安装器安装/卸载、真实 profile/running/chart/log 数据、启停/模式/更新/UWP/主题材质/窗口按钮、100/125/150/200% DPI、托盘/自启/旧数据与后端原有人工清单。浏览器中 `invoke` undefined 仅是无 Tauri runtime 的预览限制，不记为通过或失败。
