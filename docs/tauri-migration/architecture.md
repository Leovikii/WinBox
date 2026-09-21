# 目标架构与迁移约束

## 结构与依赖方向

当前是单个 Rust 应用工程；以下为 alpha.1 的实际模块，不要求拆 crate 或补建早期设想的 desktop/profiles/settings 模块。

```text
frontend/src/
  api/backend.ts   唯一 Tauri 调用、DTO、事件入口
  composables/     界面状态与交互
  components/      Vue 组件与既有视觉
src-tauri/src/
  lib.rs           组装、插件、窗口/托盘、生命周期
  main.rs          应用入口
  commands.rs      command、输入校验、设置/订阅/更新编排
  runtime.rs       运行状态、操作锁、日志、流量和代理协调
  core.rs          sing-box 进程生命周期
  storage.rs       文件读写、配置和默认值
  paths.rs         appLocalDataDir 与受控路径
  models.rs        持久化模型
  startup.rs       启动参数
  updates.rs       内核资产、digest、归档校验与暂存
  platform/
    mod.rs         平台入口
    windows.rs     权限、自启、进程操作、代理与 UWP
```

调用方向：Vue → Tauri 接入 → 业务模块 → 通用组件/平台模块。窗口与托盘调用同一业务入口。当前 commands/runtime 直接参与 Tauri 编排，Windows API 隔离在 platform 边界；按实际需求改善职责，不为了符合早期示意图新建通用消息总线。

以 `cfg` 和目标平台依赖隔离 Windows 实现；优先模块函数、具体类型，存在真实替换需求后再引入 trait。Linux 版本新增实际实现与能力声明，本版不创建空实现。UWP 为 Windows 专有能力，不强制 Linux 提供同名功能。

## 前端优化边界

保留布局、颜色、字体、图标、圆角、动效、Mica 效果、窗口行为及操作路径。允许替换 Wails imports、重组 composables、去重请求与监听、统一类型/错误、减少状态与定时器、适配拖动区域及版本来源。

首选直接迁移到薄 Tauri API 层，并同步调整调用者；无需永久保留 Wails 生成目录、旧方法大小写或历史错误字符串。阶段性兼容桥只用于缩小可验证变更，必须关联删除任务。旧契约是行为参考，不是必须永久维持的内部 ABI。

初始化统一负责订阅和状态快照，处理“监听注册尚未完成、页面已卸载”及“快照与事件交错”的竞态。采用订阅就绪后读取快照并做顺序校正/重同步等最小可验证方案，避免新增庞大状态框架。事件只解包一次 payload；各订阅独立释放，不能误删其他组件监听。

`@wails` 版本读取改为 Tauri 应用元数据或同一构建源；不长期维护两份版本。Wails 拖动标记替换为 Tauri 支持方式，按钮区域不应拖动。

## 业务状态与内核生命周期

用单一协调入口串行管理启动、停止、重启、模式切换和内核替换；允许下载与已运行代理并行，替换阶段必须独占。区分用户选择模式和实际进程状态；保存模式本身不等于启动进程，停止或正常退出只结束进程，不清除持久化的用户模式选择。

状态至少可表达停止、启动中、运行、停止中、重启/更新中及失败，具体 enum 以最小实现为准。前端禁用态、状态文字与托盘由同一后端结果驱动；失败结束必须解除忙碌态。不依赖解析日志文字驱动业务状态。

进程启动等待明确就绪或超时失败；stdout/stderr 持续消费，日志有界；停止先优雅退出，再超时强制结束，并统一回收句柄/任务。只管理本应用启动或经路径/身份核对属于本应用的进程。不能按 `sing-box.exe` 名称批量杀进程。

当前使用 `tokio::process` 加最小 Windows 适配，未引入 shell 插件；动态下载的内核不等同于 Tauri 打包 sidecar。Windows Job Object 等机制按实际生命周期需求采用，不同时叠加多套进程框架。

## Windows 权限与系统能力

- 基线 manifest 为 `requireAdministrator`，本版先维持既有权限行为；不额外引入常驻高权限服务。
- 自启基线是 `WinBoxAutostart` 计划任务：登录触发、30 秒延迟、最高可用权限、`-minimized`。官方 autostart 的接口不能直接保证这些语义，优先保留系统任务计划薄适配；创建/删除/查询均须检查结果。
- sing-box 的 mixed inbound 已使用 `set_system_proxy`，必须明确唯一写入责任。恢复前记录并确认状态归属，不无条件清空其他软件刚设置的代理。异常恢复信息持久化，验证崩溃后的恢复路径。
- UWP 复用 Windows API 或系统 `CheckNetIsolation`；使用参数数组、验证 SID，报告部分失败，不能因读取失败将全部应用解释为未豁免。
- Tauri capability/permission 按窗口与用途最小配置。自定义 command 自行验证输入，不能把插件权限当成业务校验。更新说明等远程内容不得获得 IPC 权限；外链仅允许所需协议。保持已有视觉的同时核查 Markdown/链接处理。

## 数据与路径

统一 `AppPaths` 或等价入口管理配置、订阅、内核、日志、临时目录。最终发行版使用 Tauri `appLocalDataDir()` 作为唯一数据根；Windows 典型位置为 `%LOCALAPPDATA%\com.leovikii.winbox\`。NSIS 默认使用 `%ProgramFiles%\WinBox\`（通常为 `C:\Program Files\WinBox\`），不提供安装路径或组件选择页，安装完成自动启动；安装目录只保存程序文件，不写用户数据、核心或日志。旧单 EXE 的同级 `data/` 不作为运行时数据模式，也不由程序自动迁移。

数据目录只保留现有功能需要的文件，保持现有 JSON 布局，不用数据库或额外目录替代它们：

- `config/`：`settings.json`、`state.json`、`profiles.json`，以及用户实际保存的 `overrides/tun.json`、`overrides/mixed.json`。
- `profiles/`：用户已导入的 profile JSON；没有 profile 时不创建无意义的文件。
- `core/`：用户已安装的 `sing-box.exe`、运行配置和 `box.log`；未配置内核时不预置核心目录内容。
- `app.log`、轮转归档和 `system-proxy.json`：分别用于现有日志和代理恢复语义，按功能需要产生。
- 下载、原子写入、核心替换和回滚的暂存文件仅在事务期间存在，并且只在成功或恢复完成后清理；若恢复尚未完成，保留完成恢复所需的最小材料。不保留无功能用途的持久 `updates/` 或 `backups/` 目录，官方应用 updater 使用其自身临时流程。

初期保留现有 JSON 文件布局与字段；Rust 内部类型不受旧 JSON 命名限制。不要为了使用 store 插件强制改格式或引入数据库。文件写入需处理 Windows 替换语义和实际错误，关闭应用时显式 flush；仅在成功落盘后更新写入状态。

新版运行时不实现旧单 EXE 的自动导入、目录扫描或数据合并。旧版本迁移只在发行说明中提供人工步骤：退出应用、备份旧 `data/`、确认新版数据目录为空后复制内容；程序不自动覆盖或修复用户文件。格式改变须记录版本与降级限制。未知字段的保留/拒绝策略、缺失/损坏文件、旧 `auto_connect` 字段处理需以 fixture 明确。订阅路径按受控 ID 重建，不信任持久化的任意绝对路径。

## 配置、网络与更新

使用 serde_json 做必要覆盖，保留不相关字段，不自研 sing-box 配置解析器；调用内核 `check` 验证候选配置，再替换有效配置。保留 TUN/mixed、IPv6、日志、订阅切换等用户语义。

HTTP 与 WebSocket 由后端维护；集中配置超时、取消、代理/直连行为及错误。保留镜像功能并验证断网、代理依赖、预发布渠道和 x64 资产选择。流量/日志事件节流且有界，托盘隐藏时避免无意义渲染。

WinBox 应用更新使用官方 `tauri-plugin-updater 2.11.0`：签名、更新元数据、目标架构和 NSIS 安装产物统一设计。Tauri v2 Windows updater 直接下载签名的 `*-setup.exe`，并发布同名 `.sig` 与 `latest.json`，不生成额外 `.nsis.zip`。删除自定义 helper、应用替换和回滚代码，不再发布 portable 或 MSI。现有 `pre_release` 设置继续决定稳定/预发布检查，不新增独立更新通道；endpoint 和 Release metadata 必须遵守该设置。密钥不入库，私钥只进入 GitHub Actions secrets，镜像不绕过签名。

sing-box 更新独立编排：运行中先下载到临时位置 → 校验来源/可用完整性材料、架构、文件名与解压边界 → 候选版本/配置检查 → 停止旧内核 → 备份并替换 → 按原状态恢复 → 验证成功。失败恢复旧内核及配置；不得将未启动成功报告为运行。上游可提供的校验材料在 P0 核查，记录真实性限制，不宣称普通哈希等于可信签名。

应用正常退出与程序升级统一走清理入口：取消任务、停止内核、恢复属于本应用的系统状态、flush，然后退出。官方 updater 的安装前 hook 必须复用该入口，并设置最小的更新中状态，避免自动连接或监视器重新启动核心。强制崩溃无法依赖退出回调，必须单独验证恢复策略。
