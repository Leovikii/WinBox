# 架构与开发入口

`3.0.0-alpha.4` 已完成开发，用户确认本轮问题修复。当前采用用户级 NSIS 安装、默认普通权限、TUN/mixed 按需整进程提权、用户级自启和可见自动更新；不使用服务，不开发 alpha.3 迁移或兼容逻辑。验证边界见 development.md；历史决策从 Git 查阅。

## 模块

| 位置 | 职责 |
| --- | --- |
| `frontend/src/api/backend.ts` | 唯一前端 IPC、DTO、事件订阅边界 |
| `frontend/src/state/AppContext.tsx` | 初始化、业务状态/动作、低频应用、主题、流量、日志各自独立的上下文 |
| `frontend/src/components/`、`App.tsx` | Fluent 展示、业务弹窗和窗口交互 |
| `frontend/src/theme.ts`、`index.css`、`components/motion.ts` | 主题 token、产品布局、官方 presence 动效 |
| `frontend/src/utils/` | 纯数据处理；不依赖桌面运行时 |
| `src-tauri/src/lib.rs`、`main.rs` | 组装、插件、窗口/托盘、应用生命周期 |
| `commands.rs` | command 校验、配置/订阅/更新编排，UI/托盘共用业务入口 |
| `runtime.rs`、`core.rs` | 操作锁、状态、流量/日志、代理恢复及 sing-box 子进程 |
| `storage.rs`、`models.rs`、`paths.rs` | JSON 持久化、默认值、唯一数据根与受控路径 |
| `updates.rs`、`startup.rs`、`handoff.rs` | 内核更新校验/暂存；启动参数；同账户一次性权限交接 |
| `platform/windows.rs`、`platform/privileges.rs`、`platform/notifications.rs` | Windows 权限、进程身份/监听归属、用户级自启、代理、UWP、原生授权提醒 |

调用方向：React → backend.ts → Rust command/runtime → 存储、内核或平台。窗口材质与 Web 主题计算分离。按实际需求解耦，不预建跨平台工厂、消息总线、长期兼容桥或第二套状态来源。

## 数据与发行

- Windows x64，普通权限 manifest，WebView2；NSIS 当前用户安装到 `%LOCALAPPDATA%\Programs\WinBox`，数据根为 `appLocalDataDir()`，通常 `%LOCALAPPDATA%\com.leovikii.winbox`。
- `config/{settings,state,profiles}.json` 与 `config/overrides/{tun,mixed}.json`；`profiles/` 保存订阅；`core/` 保存 sing-box、生成配置和内核日志；根目录 app.log/轮转日志与 system-proxy.json 按需产生。
- 安装目录不写用户数据。暂存/备份仅服务更新、原子替换和恢复，不保留无用途目录。alpha.4 只支持全新安装，不扫描、迁移或兼容旧版安装/数据/自启任务；手动清理步骤见根 README。
- 应用更新走官方 Tauri updater；内核下载/替换是独立流程。具体边界见 [后端](backend.md)，构建及发布见 [开发指南](development.md)。

## 当前技术选择

准确版本以 `frontend/package-lock.json`、`src-tauri/Cargo.lock` 为准。以下为关键直接依赖的选型依据，升级时重新核查维护与许可。

| 依赖 | 用途与来源 |
| --- | --- |
| React/ReactDOM 19.3.0 | [React](https://github.com/facebook/react)，MIT；同版本，Context/hooks 足够，不引入另一状态框架 |
| Fluent components 9.74.7、charts 9.3.25 | [微软 Fluent UI](https://github.com/microsoft/fluentui)，MIT；稳定 v9 公开 API，AreaChart，避免 v8/preview 混用 |
| Fluent icons 2.0.341 | [微软图标](https://github.com/microsoft/fluentui-system-icons)，MIT；按原生尺寸选 Regular |
| OverlayScrollbars / React 0.5.6 | [官方项目](https://github.com/KingSora/OverlayScrollbars)，MIT；Fluent 无等价滚动区，保留成熟实现 |
| Tauri 2.11.5、updater 2.11.0 | [Tauri](https://github.com/tauri-apps/tauri)、官方插件，MIT/Apache-2.0；opener/single-instance 复用官方实现 |
| windows 0.61.3 | [微软 windows-rs](https://github.com/microsoft/windows-rs)，MIT/Apache-2.0，微软持续维护；复用已锁定版本，启用 Security/Registry/Threading/Shell/Environment 及 Data_Xml_Dom/UI_Notifications 绑定，不增加依赖；平台操作留在 Windows 边界，通知在 UI 线程创建，其余阻塞操作放工作线程 |
| Tokio、reqwest、tokio-tungstenite、serde、sha2、zip | 异步进程/网络/JSON/完整性及归档处理；不用 shell 插件管理动态下载的内核 |

GitHub 标志来自 [primer/octicons](https://github.com/primer/octicons)，MIT 原文在 `frontend/src/assets/github.LICENSE`。不打包微软系统字体。图标生成器在 `frontend/src/assets/icon-builder/`，托盘 SVG/ICO 和 README 截图仍有用途，不属于清理对象。
