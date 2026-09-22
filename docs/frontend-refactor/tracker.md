# 前端迁移台账

目标版本：`3.0.0-alpha.2`。本台账只维护前端阶段状态；后端未完成人工测试继续保留在 [原台账](../tauri-migration/tracker.md)，不阻止前端迁移启动，不据此标记后端验收完成。

状态：`todo` → `in_progress` → `review` → `done`；只有缺实际外部条件时使用 `blocked`。计划写完不等于实现完成。

| ID | 工作 | 依赖 | 状态 | 负责人 | 验收/证据 |
| --- | --- | --- | --- | --- | --- |
| FE-001 | 开发计划、源码盘点和官方组件选型 | 用户要求 | done | Codex / 2026-09-21 | README/decisions 已完成；官方 registry/源码核对记录见 decisions；本地链接、任务依赖、版本边界与 diff 检查通过 |
| FE-002 | alpha.1 视觉、动效、交互与性能基线 | FE-001 | done | Codex / 2026-09-22 | 以 alpha.1 源码数值建立对照；生产预览覆盖 400×720/窄视口、浅/深主题、空/错/忙状态和弹窗场景；用户确认 Windows x64 实机视觉、动效和交互回归通过 |
| FE-003 | Fluent v9 主题与高风险组件对照原型 | FE-002 | done | Codex / 2026-09-21 | FluentProvider、Button/Input/Switch/Dropdown/Dialog/Tab/Swatch/Chart/Scroll 已实际运行；下拉 Portal、Dialog anatomy、焦点/Escape、图表和滚动浏览器回归通过 |
| FE-004 | React 工程入口与 alpha.2 版本同步 | FE-003 | done | Codex / 2026-09-22 | React 19.3.0 + TypeScript + Vite；package/Cargo/Tauri 版本均为 alpha.2；前端 build/tsc、x64 Tauri NSIS 和用户实机启动回归通过 |
| FE-005 | 通信、状态与生命周期迁移 | FE-004 | done | Codex / 2026-09-22 | AppContext 为唯一应用状态入口，事件/定时器按生命周期释放，busy/finally/错误路径已回归；StrictMode/浏览器异常路径和用户 Tauri 实机回归通过 |
| FE-006 | 主界面、核心控制、配置和日志迁移 | FE-005 | done | Codex / 2026-09-22 | 主界面、模式滑块初始/切换、控制按钮、profile/log dialog、v9 AreaChart、连续流量图和滚动已覆盖；用户确认 Windows x64 运行态回归通过 |
| FE-007 | 设置、更新、主题、UWP 与其余弹窗迁移 | FE-006 | done | Codex / 2026-09-22 | 设置 Dropdown、主题颜色、UWP、编辑器、更新/退出/日志/档案弹窗通过窄视口与 Windows x64 实机回归；无已报告前端阻塞 |
| FE-008 | 删除 Vue 旧栈与冗余样式、Windows x64 验收 | FE-007 | done | Codex / 2026-09-22 | Vue/W* 基础控件/Tailwind/Font Awesome CDN/旧入口删除；audit 0 vulnerabilities、diff check、Rust 33/33 + clippy、x64 unsigned NSIS 和用户桌面回归通过；正式签名 Release 仍由 main workflow 负责 |

## 当前交接

- 2026-09-21：用户要求保留后端人工测试，先迁移前端到 React + 微软 Fluent 官方组件；版本目标 alpha.2；当前 Windows x64，下版 Linux。
- 2026-09-22：用户确认 alpha.2 前端 Windows x64 实机回归通过，FE-002/004/005/006/007/008 关闭为 `done`；前端已具备发布候选条件。`dev` 推送后由维护者手动创建到 `main` 的 PR，签名 Release 不在本地直接创建。
- 组件交接：旧 Vue/W* 控件由 Fluent 官方 Button/Input/Textarea/Switch/Checkbox/Dropdown/Dialog/MessageBar/Tab/Swatch/Progress/Chart 承接；产品 CSS 只保留 Mica、布局、状态色、模式滑块、动效和响应式规则。`ProductDialog` 使用 Fluent 官方 Dialog anatomy，修复嵌套滚动导致的弹窗收缩、底层内容透出和窄窗口按钮截断；标题栏 Tooltip Portal 已移除以修复 hover 闪烁，受控弹窗仅保留最小焦点恢复桥接。
- 删除内容：Vue 页面/composables、W* 基础控件、Tailwind/PostCSS 配置、Font Awesome CDN、旧入口；不恢复 Wails 双后端，不提前建立 Linux 空实现。完整切片说明见 [README 当前实现交接](README.md#9-当前实现交接2026-09-22) 与 [decisions 实施记录](decisions.md#实施交接证据2026-09-21)。
- 自动验证：`npm run build`、`npx tsc --noEmit`、`npm audit --audit-level=high`（0 vulnerabilities）、`git diff --check`；x64 `cargo fmt --check`、`cargo test --locked --offline`（33/33）、`cargo clippy --locked --offline -- -D warnings`；`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign` 均通过。
- 当前产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe` 版本 `3.0.0-alpha.2`、PE `0x8664`、大小 `18,959,872` bytes、SHA-256 `9677374CDD2FA440AF05A6A76CA0DE4E39B3DE98C812A4601CE1AD696CDB5101`；NSIS `WinBox_3.0.0-alpha.2_x64-setup.exe` 大小 `4,775,019` bytes、SHA-256 `DD9AB7B39F461805DF639AA5F029A7C40143101410213A006A2FC6B70B2A8DCE`；bundle 目录仅有 nsis。
- 浏览器回归：生产预览覆盖 Dropdown 点击展开/选择/Escape、主题/日志/退出/档案/UWP/编辑器弹窗、空/错状态和标题栏 hover；当前窄视口无内容收缩/按钮裁剪，生产构建无控制台错误。AX/DOM 确认选项无 `.fui-Option__checkIcon` 节点和内部边框，选中项仅保留背景色；开发环境仅有 Fluent Keyborg/React StrictMode 警告。
- 2026-09-22 追加回归：重新生成生产 `dist` 后确认浅色 Dialog Surface 不透出底层文字、编辑器 Surface 的 body/content/footer 连续填满、Dropdown 菜单为单一轻边框且无左侧勾选图标/自定义竖条；`ProductDialog` 的 Escape/关闭按钮退出后焦点恢复到触发控件。浅/深主题和普通/编辑器弹窗均通过浏览器视觉检查。更新检查竞态保护与 `Unknown` 版本安全分支已登记在 `AppContext`。
- 前端原生阻塞已解除：用户已以 Windows x64 实机确认 alpha.2 前端运行态回归通过；先前非管理员启动返回 `0xc0000142`/`os error 740` 仅是本地权限边界，不是本轮前端缺陷。浏览器中 `invoke` undefined 仍只是无 Tauri runtime 的预览限制。
- 未执行/必须人工（后端范围）：安装器安装/卸载细节、跨版本 updater、真实 UWP/托盘/自启、旧数据边界、其他 sing-box 故障注入和 100/125/150/200% DPI 的完整迁移矩阵继续由原台账维护；不阻止已通过的前端 alpha.2 交接。
- 2026-09-22 模式/顶部状态追加：修复模式滑块位移百分比基准错误，显式覆盖 Fluent Radio 标签为 12/16px、Regular/选中 Semibold、sentence case；依据 WinUI Motion 保持 250ms point-to-point 曲线。恢复旧版状态 ambient bloom，并用 Fluent AreaChart 公开 `tozeroy`/linear 线条参数复刻旧版图表层次；自动构建、类型检查、diff check、本地样式重载和用户 Windows x64 实机回归确认通过。
