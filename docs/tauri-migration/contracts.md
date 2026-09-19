# 行为契约与迁移映射

基线：`3b5eef88a252206cf82db4752999a6e0054c0795`。以下旧契约来自源码阅读；尚未执行运行验证。新 command 名为建议值，P0 盘点全部调用者后锁定；改名不需额外用户审批，但须同步本文和全部调用者。

## 迁移原则

- 保留用户行为，不强制保留旧 IPC 形状。直接迁移前端时可使用类型化返回与错误；暂留旧调用者时用临时适配转换。
- Rust command 建议返回 `Result<T, AppError>`，错误至少含稳定 `code` 和可展示 `message`；按需要附上下文，不泄露订阅凭据。前端统一处理失败、忙碌态和提示，不逐组件匹配 `Error:` 字符串。
- 参数采用对象，明确 Tauri JS/Rust 命名转换；新 DTO 统一 camelCase，旧磁盘 JSON 保持原字段。用序列化检查避免混淆。
- 删除旧导出前执行全库调用搜索。无前端调用的旧公共方法不自动变为 Tauri command；内部生命周期不暴露给前端。

## 方法映射

表中 `string` 表示旧返回，通常成功为 `Success`、失败为 `Error: ...`；特例见后文。所有新业务调用均经受控 Rust 入口，窗口等可直接使用 Tauri 官方 API。

| 旧入口（Go App） | 参数 | 旧结果 | 新入口建议/责任 |
| --- | --- | --- | --- |
| GetInitData | 无 | 对象 | `get_init_data`：初始化快照 |
| AddProfile | name, url | string | `add_profile` |
| DeleteProfile | id | void | `delete_profile`：改为可报告失败 |
| SelectProfile | id | string | `select_profile`：运行中切换会重启 |
| UpdateActiveProfile | 无 | string | `update_active_profile` |
| EditProfile | id, name, url | string | `edit_profile` |
| GetOverride | name | JSON 文本 | `get_override` |
| GetDefaultOverride | name | JSON 文本 | `get_default_override` |
| SaveOverride | name, content | string | `save_override` |
| ResetOverride | name | string | `reset_override` |
| SaveSettings | mirror, enabled | string | `set_mirror`，不是保存全部设置 |
| SetStartOnBoot | enabled | string | `set_start_on_boot` |
| SetAutoConnect | state | string | `set_auto_connect` |
| SaveTheme | mode, accentColor | string | `save_theme` |
| SaveMode | tunMode, sysProxy | string | `save_mode`：仅保存选择 |
| ToggleIPv6 | enabled | string | `set_ipv6_enabled` |
| SetLogConfig | level, toFile | string | `set_log_config` |
| SetPreRelease | enabled | string | `set_pre_release` |
| SetCloseBehavior | behavior | string | `set_close_behavior` |
| ApplyState | targetTun, targetProxy | string | `apply_state`：实际启停/模式变更 |
| ToggleService | 无 | string | 盘点调用后决定删除或内部化 |
| RestartCore | 无 | string | `restart_core` |
| GetAppLog | 无 | 文本，至多 5000 行 | `get_app_log` |
| GetKernelLog | 无 | 内存日志文本 | `get_kernel_log` |
| GetLogFile | 无 | 内核日志文件内容 | 盘点后合并或保留，不能误当路径 |
| ClearAppLog | 无 | string | `clear_app_log` |
| ClearKernelLog | 无 | string | `clear_kernel_log` |
| OpenDashboard | 无 | void | 后端解析地址 + opener；旧地址 `http://127.0.0.1:9090/ui` |
| GetLocalVersion | 无 | 内核版本文本 | `get_kernel_version` |
| CheckUpdate | 无 | 内核版本或错误文本 | `check_kernel_update` |
| UpdateKernel | mirrorUrl | string | `update_kernel` |
| GetProgramVersion | 无 | 编译版本 | Tauri 应用元数据，避免重复源 |
| CheckProgramUpdate | 无 | `{version,changelog}` 或 `{error}` | `check_program_update`/updater 受控封装 |
| UpdateProgram | mirrorUrl | string | `update_program`/updater 受控封装 |
| GetUWPApps | 无 | UWPApp 数组 | `get_uwp_apps`：读取失败独立于空数组 |
| SetUWPLoopbackExemptions | selectedSIDs | string | `set_uwp_loopback_exemptions` |
| Minimize | 无 | void | Tauri 窗口最小化 |
| MinimizeToTray | 无 | void | 隐藏窗口、处理流量推送 |
| Show | 无 | void | 显示并聚焦、恢复数据刷新 |
| Quit | 无 | void | 统一有序退出入口 |
| Restart | 无 | void | 清理后重启，保留延迟/单实例语义 |

`Startup`、`OnShutdown`、`StartTray`、`UpdateTrayIcon`、`UpdateTrayMenu` 为生命周期或内部辅助，不生成前端命令。P0 对比所有导出和调用者，确认不存在动态调用遗漏。

### 旧返回特例

- `ApplyState`：缺配置为 `config-missing`；停止可能为 `Stopped` 或 `Already stopped`。停止并不等于清除已选模式。
- `RestartCore`：未运行时返回错误。新实现保留可解释的用户结果，不伪报成功。
- `GetDefaultOverride`：未知名称为空字符串；`ResetOverride` 为 `Unknown type`。新入口统一拒绝非法名称。
- `GetLocalVersion`：未安装状态由 `Not Installed` 表示。新 DTO 可改为明确的安装状态。
- `UpdateKernel`：还可能返回 `No matching asset found`、`Download Fail`、`exe not found in zip`；新错误模型区分发现/下载/校验/替换/启动失败。
- `DeleteProfile` 当前忽略错误；`GetUWPApps` 读取失败返回空数组。这些不是必须复制的行为，迁移时修正并验证已有提示交互。

## 数据模型

### 初始化旧对象

| 字段 | 类型/语义 |
| --- | --- |
| running, coreExists | boolean：实际运行、内核是否存在 |
| localVersion | string：内核版本 |
| tunMode, sysProxy | boolean：选择模式 |
| profiles | Profile[] |
| activeProfile | Profile；无活动配置时旧端为零值对象 |
| mirror, mirrorEnabled | string、boolean |
| startOnBoot | boolean |
| autoConnectState | string：P0 核对 UI 值域，含 `off`、`smart` |
| themeMode, accentColor | string：light/dark/system、颜色 |
| ipv6_enabled, pre_release, log_to_file | boolean |
| log_level | string：含空值，核对支持级别 |
| close_behavior | string：ask/tray/quit |

新快照允许统一 camelCase、将无活动配置改为 null，并显式表示内核运行阶段；必须同时更新前端所有读取、默认模式规则及测试。不把配置选择模式错误地映射为实际运行。

`Profile` 旧字段为 `id,name,url,path,updated`（均 string）。`updated` 格式需 fixture 验证，不能只凭界面显示推断。`UWPApp` 为 `sid,displayName,packageName`（string）及 `isExempt`（boolean）。

### 文件契约（相对数据根目录）

| 文件 | 已知内容/作用 |
| --- | --- |
| config/settings.json | mirror、mirror_enabled、auto_connect_state、start_on_boot、close_behavior、theme_mode、accent_color、ipv6_enabled、log_level、log_to_file、pre_release；旧类型还含可选 auto_connect |
| config/state.json | active_id、tun_mode、sys_proxy |
| system-proxy.json | WinBox 接管系统代理前后的最小快照；停止/崩溃恢复后按当前值匹配才删除，不存在时不覆盖其他软件状态 |
| config/profiles.json | Profile 数组 |
| config/overrides/tun.json | TUN 覆盖配置 |
| config/overrides/mixed.json | mixed 覆盖配置 |
| profiles/<id>.json | 下载并保存的订阅配置 |
| core/sing-box.exe | Windows 内核 |
| core/config.json | 生成的运行配置，不能冒充源订阅 |
| core/box.log | 内核文件日志 |
| app.log | 应用日志；归档规则 P0 补充 fixture |

### Windows 平台原型契约（MIG-003）

- Tauri Windows 可执行文件嵌入 `requireAdministrator`、`uiAccess=false` 和现有 per-monitor DPI 声明；这保持旧 Wails 的权限边界，不建立常驻服务。
- 自启只通过 `schtasks.exe` 的受控参数调用管理 `WinBoxAutostart`。任务 XML 固定为登录触发、`PT30S` 延迟、`HighestAvailable`、`-minimized`、`IgnoreNew`；创建后查询确认，删除后再次查询确认。临时 XML 写入系统临时目录，不写入应用数据根。
- 内核进程只能从 `core/sing-box.exe` 启动，路径必须是 `core` 的直接子文件；停止前按子进程句柄查询镜像路径，不按进程名批量终止。镜像归属查询失败直接报停止失败，不进入强杀；只有已确认归属且优雅退出失败或超时才使用该子进程句柄强制结束。
- 停止流程在确认进程停止前保留 `RuntimeState` 中的进程句柄；停止失败时不丢失进程归属、不启动第二个内核，调用方恢复之前状态并返回失败。
- 系统代理恢复先读取当前快照；原快照中不存在的注册表值只有在当前确实存在时才删除，避免重复恢复或本地化 `reg.exe` 缺失值错误。
- 当前原型不向前端暴露通用 shell，也不扫描或终止其他 `sing-box.exe`。stdout/stderr 持续排空；输出通道关闭后监视器仍轮询进程但不忙等，日志 DTO 和状态协调留在 MIG-009。

### 发行与旧客户端过渡契约（P0）

- 旧 Wails portable 资产保持 `WinBox-v<version>-windows-amd64.zip` 命名，ZIP 内提供 `WinBox.exe`；首个 Tauri x64 过渡资产继续使用该布局，使旧客户端的资产筛选和 EXE 替换逻辑仍可工作。
- Tauri 官方 updater 资产使用签名的 Windows NSIS/MSI updater 包（例如 `*.nsis.zip` 或 `*.msi.zip`）及 `latest.json`，不能把这些资产投喂给旧 Wails 更新器，也不能把 plain binary 当作官方 portable updater。
- portable 模式的数据根仍是运行中 EXE 同级的 `data/`。在本次迁移中不自动扫描 AppData 或其他目录；未来安装版导入必须是显式、可恢复的迁移步骤。
- sing-box 下载必须匹配 Windows x64 的精确资产名 `windows-amd64`，并在替换前完成发布元数据 digest、ZIP 边界和内核配置检查。ARM64 资产不属于本版支持范围。

### 数据/更新兼容原型契约（MIG-004）

- `TargetArchitecture` 只接受 `x86_64`，映射为 `windows-amd64`；包括 `aarch64` 在内的其他架构和架构不匹配的精确资产名拒绝。sing-box 版本传入不含 tag 的 `v` 前缀，例如 `1.14.1`。
- sing-box 资产名必须精确为 `sing-box-<version>-windows-amd64.zip`；旧 Wails portable 资产名必须精确为 `WinBox-v<version>-windows-amd64.zip`，其兼容 ZIP 入口必须为精确的 `WinBox.exe`。
- `sha256:` 或裸 64 位十六进制值在写入核心前流式校验；digest 是完整性检查，不代表发布者签名。当前原型不接 HTTP、镜像选择、签名验证或 updater。
- ZIP 暂存只接受安全相对路径，拒绝绝对路径、盘符/UNC、反斜杠、`.`/`..`、符号链接和重复的 `sing-box.exe`；最多 128 个条目，压缩包不超过 64 MiB、声明解压内容不超过 128 MiB，只将预期内核写入新暂存目录。128 MiB 上限覆盖当前 Windows x64 sing-box 核心大小，详见 MIG-030。
- 暂存目录必须不存在，输出使用 `create_new`，现有 `core/sing-box.exe` 不被覆盖；暂存失败清理本次新目录。`sing-box check`、有效配置配对、停止/替换/回滚和恢复原状态属于 MIG-012，不由本原型宣称完成。

### 前端 API 边界原型契约（MIG-005-a，历史记录）

- `frontend/src/api/backend.ts` 是迁移期间唯一允许引用 `frontend/wailsjs` 和 `@wails` 的前端文件；组件和 composables 不得直接导入 Wails 生成模块或 runtime。
- `getInitData()` 返回 `InitDataDto`；`TrafficUpdateDto` 与 `StateSyncDto` 固定初始化快照、流量和模式同步事件的字段。初始化 DTO 对外统一使用 camelCase；旧 Wails 的 `ipv6_enabled`、`pre_release`、`log_level`、`log_to_file`、`close_behavior` 只在适配层归一化。
- Tauri 运行时的 `getInitData()` 通过 `invoke('get_init_data')` 调用 Rust；非 Tauri 运行时才调用旧 Wails，作为开发/分阶段兼容路径。Tauri 事件入口已接入 `listen`/独立卸载，但 Rust 事件发送和状态协调尚未迁移。
- `getProductVersion()` 在 Tauri 运行时通过 `invoke('get_product_version')` 读取 Tauri `AppHandle` 的 package metadata；非 Tauri 运行时才调用旧 `GetProgramVersion`。不再从 `wails.json` 或 `@wails` 读取版本。
- 视觉、交互、状态来源和旧 command 名称本阶段不变；Tauri command/event 实现必须在后续同一变更中同步 Rust、DTO、全部 callers、错误映射和订阅释放，再删除适配层。
- 适配层删除条件：Rust/Tauri command、事件初始化/卸载、错误和快照顺序通过 V04，且前端不再有 `wailsjs`/`@wails` 活动引用。

### P1 初始化只读 command 契约（MIG-005）

- Rust command 名为 `get_init_data`，返回 `Result<InitDataDto, AppError>`；`AppError` 至少含稳定 `code` 和不包含用户路径/订阅内容的 `message`。
- `InitDataDto` 使用 camelCase 序列化；`activeProfile` 在 `active_id` 找不到匹配配置时为 `null`，不返回旧 Wails 的零值对象。
- 当前只读切片从 EXE 同级 `data/` 加载现有 JSON；`coreExists` 只检查 `core/sing-box.exe` 文件，未接入内核生命周期时 `running=false`，已有核心的 `localVersion` 暂为 `Unknown`。这些是明确的阶段限制，不是运行状态 mock，待 MIG-009 接入真实协调器后替换。
- `frontend/src/api/backend.ts` 的 Tauri `listen` 适配必须在注册完成前也支持卸载；调用者保存并调用各自的返回函数，不互相移除订阅。Rust 尚未发送这些旧事件，因此本切片不宣称 V04/V07 事件验收通过。

### P1 受控 override 读写 command 契约（MIG-005）

- Rust command 为 `get_override(name)` 和 `get_default_override(name)`，均返回 `Result<String, AppError>`；`name` 只接受 `tun` 或 `mixed`。
- `get_override` 复用现有 `Storage::load()`，分别返回 `config/overrides/tun.json` 或 `mixed.json` 的有效 JSON 文本；文件缺失时返回已有产品默认配置，不写回磁盘。
- `get_default_override` 返回 `DEFAULT_TUN_CONFIG` 或 `DEFAULT_MIXED_CONFIG`，不访问用户文件。
- `save_override(name, content)` 返回 `Result<(), AppError>`，只接受合法 JSON 并复用现有原子写入；`reset_override(name)` 将对应产品默认配置原子写回同一文件。
- 非法名称在读文件前拒绝，返回稳定 `code=invalid_override_type` 和脱敏消息 `Override type must be tun or mixed`；存储加载失败返回统一 `storage_load_failed`，不泄露本地路径或订阅内容。
- 无效 JSON 返回 `code=invalid_override_json`；写入 I/O 失败返回 `code=storage_write_failed`；两者消息均不包含路径或原始内容。
- `frontend/src/api/backend.ts` 暴露 `getOverride`/`getDefaultOverride`/`saveOverride`/`resetOverride`；Tauri 使用 `invoke` 对象参数 `{ name }`（保存还包含 `{ content }`），非 Tauri 才调用旧 Wails 并把旧字符串错误转换为异常。编辑器读写 command 已迁移，但真实 Tauri WebView 和完整 UI 验收仍未完成。

### 当前实现契约（2026-09-18）

- `frontend/src/api/backend.ts` 现在是纯 Tauri 边界：业务调用统一使用 `invoke`、`listen` 和当前窗口 API；Wails 生成目录、Go backend 和兼容回退已删除。事件订阅返回独立卸载函数，按事件名维护，不会用一次卸载误删其他事件。
- 初始化顺序契约：`App` 与 `useAppState` 先注册各自事件，再等待 `EventsOn` 的 Tauri listener 注册完成，之后才读取 `get_init_data`；这样启动期间到达的状态/流量事件不会被初始化快照覆盖。卸载时逐个调用保存的卸载函数，重复挂载不会留下监听。
- 已注册 command 覆盖初始化/版本、设置/模式、override、profile/订阅、启停/重启、日志、UWP、窗口/外部 URL、托盘、内核更新和程序更新。Rust 输入在 URL、路径、profile ID、override JSON、架构/资产名、UWP SID 等边界拒绝非法值；错误通过脱敏 `AppError { code, message }` 或既有 UI 结果字符串映射。
- 运行状态唯一来源是 Rust `RuntimeState` + `Storage`：操作锁串行化启停/模式/更新，`CoreProcess` 只接受 EXE 同级 `data/core/sing-box.exe`，监视器处理意外退出，流量 WebSocket 将 wildcard controller 映射到 loopback、按配置发送 Clash API Bearer secret、带连接超时/受控重连和可取消停止。
- 更新契约：sing-box 下载先校验 GitHub digest、ZIP 安全边界和暂存核心 `sing-box check`；Windows 替换使用 `ReplaceFileW` 旧文件备份、锁冲突短重试和阶段化 app log，启动新核心失败时恢复旧文件并尝试恢复旧进程。程序 portable 更新使用同级 `WinBox-updater.exe`；安装 bundle 的 `winbox-updater.exe` 也由后端识别，helper 在替换后清理 stage，启动失败恢复旧 EXE。
- Windows 桌面契约：Tauri 窗口保持 400×720、无边框、透明/Mica；单实例聚焦现有窗口；托盘保留 Show、Mixed/Tun/Proxy/Stop、Restart Core、Restart APP、Quit，动态图标和模式勾选由 Rust 状态刷新；关闭请求仍由 `ask`/`tray`/`quit` 决定。
- 发行契约：Tauri package 保留 `WinBox.exe` 主入口和 `winbox-updater.exe` 第二 binary；Tauri bundle 自动收集两个 Cargo binary，不再重复声明 resource。CI 直接 bundle 后，portable ZIP 另放 `WinBox.exe` 与 `WinBox-updater.exe`。签名密钥不入库，未生成签名发行物前不得宣称 updater/发布验收通过。

默认值参考 `internal/storage.go` 和 `internal/models.go`：smart 自动连接、system 主题、`#0090FF` 强调色、IPv6 开、文件日志开、镜像默认配置等。必须通过旧样本锁定缺失字段处理，避免把反序列化零值当产品默认值。不自动“修复”用户自定义覆盖为默认内容。

## 事件迁移

| 旧事件 | payload | 用户语义 |
| --- | --- | --- |
| status | boolean | 实际运行变化 |
| state-sync | `{tunMode:boolean,sysProxy:boolean}` | 模式同步 |
| core-starting | 无 | 启动中、禁用冲突操作 |
| core-stopping | 无 | 停止中 |
| core-restarting | 无 | 重启中 |
| core-lock | boolean | 自动连接阶段锁定 |
| log | string | 当前状态提示；旧前端还解析日志文字 |
| onAppLog | string | 带时间与级别的新增日志行 |
| traffic-update | `{upload:number,download:number}` | 速率，UI 按 B/s 格式化；停止归零 |
| download-progress | integer 0–100 | 旧端应用/内核更新共用 |

目标建议：将前六项和状态提示收敛为类型化运行快照事件，日志只做日志；应用与内核更新用带 `kind`/操作标识的进度事件区分，防止相互覆盖。具体命名与字段在 P1 实现前补入本文，不需要为保留旧事件名制造多层适配。订阅初始化、卸载、重复进入页面、显示/隐藏窗口、重启和失败都要验证。

## UI 行为基线

必须覆盖 Proxy/TUN/Mixed 切换、停止后保留选择、配置缺失提示、运行中配置切换、智能连接 Standby/超时、忙碌禁用态、订阅增删改、设置保存、更新进度与完成状态、日志滚动/清空、UWP 选择保存、关闭询问/托盘/退出、主题和外部仪表盘。

不能将旧源码缺陷等同于交互要求：例如状态卡死、重复监听、忽略写入失败、启动失败仍发运行事件，应修复并记录。若修复会实质改变用户可见操作流程或视觉，先说明差异并取得确认。

## 契约变更记录

| 日期 | 变更 | 状态/关联 |
| --- | --- | --- |
| 2026-09-16 | 建立旧源码契约；允许同步优化前后端协议 | 已批准原则，具体新 DTO 待 MIG-005 锁定 |
| 2026-09-17 | 新增 `src-tauri` Rust storage core；磁盘 JSON 保持 snake_case，未知顶层字段在 settings/state/profile 中保留，覆盖配置写入前校验 JSON | 不改变前端 IPC；仅为后续迁移准备内部存储边界，未替代 Go/Wails 运行路径；关联 MIG-001、MIG-007/V05 |
| 2026-09-17 | 建立最小 Tauri 2 编译壳并在 setup 挂载 storage；暂未新增 command、事件或前端 caller | 仅验证依赖和生命周期入口，bundle 关闭；新 DTO/IPC 仍待 MIG-005 锁定，关联 MIG-002-a |
| 2026-09-17 | 固定 portable/安装版更新分流、旧 Wails ZIP 兼容资产与 EXE 同级数据根；明确 sing-box 目标架构资产匹配和 digest 边界 | P0 选型结论，未实现 updater/helper 或发行产物；关联 MIG-002、MIG-004、MIG-013 |
| 2026-09-17 | Tauri 入口识别旧 `-minimized`、`-delay-start` 参数；延迟启动 1.5 秒并在 setup 阶段隐藏主窗口 | 仅完成参数/入口代码和单元测试，尚未做 Tauri Windows 实机行为验证；关联 MIG-002、MIG-003/V03 |
| 2026-09-17 | 增加 Windows manifest、任务计划薄适配和受控 `tokio::process` 原型；固定内核路径核对、句柄级停止与超时强制结束边界 | 原型已编译并有单元检查；任务创建/删除、实际 sing-box 优雅退出、Tauri UAC 和登录行为仍需管理员实机验证；关联 MIG-003/V03/V07/V09/V11 |
| 2026-09-17 | 增加 `updates` 原型：目标架构/资产名、SHA-256、旧 Wails ZIP 命名、ZIP 路径/大小/条目边界和新暂存目录 | 15 个 Rust 测试通过；不接 HTTP、签名、`sing-box check`、替换/回滚或 updater；关联 MIG-004/V05/V13/V14 |
| 2026-09-17 | 新增 `frontend/src/api/backend.ts` 作为唯一前端后端适配入口，并为初始化快照/流量/模式同步增加 DTO | Wails 直连仅保留在适配文件；前端构建通过；Tauri IPC 尚未接入，适配删除条件关联 MIG-005/V04 |
| 2026-09-18 | 新增 `src-tauri/src/commands.rs` 的 `get_init_data` 与 camelCase `InitDataDto`；适配层在 Tauri 使用 `invoke`/`listen`，旧 Wails 仅保留非 Tauri 回退 | Rust DTO/错误边界、前端归一化和单元/构建检查通过；真实 Tauri 运行状态、Rust 事件发送和全量错误/订阅验收仍待 MIG-005/V04、MIG-009 |
| 2026-09-18 | 新增 `get_product_version` command；前端版本读取改为异步 Tauri metadata，并移除 `@wails`/`wails.json` 版本引用 | Rust/前端构建通过；版本值尚未在 Tauri WebView 实机验证，旧 command 仍经阶段适配；关联 MIG-005/V04 |
| 2026-09-18 | 新增 override `get`/`get_default`/`save`/`reset` command；固定 `tun`/`mixed` 输入、错误码和原子写入边界 | Rust/前端构建与 21 个单元检查通过；真实 Tauri WebView、文件权限和事件/生命周期仍待验证；关联 MIG-005/V04 |
| 2026-09-18 | 完成 Tauri command/API 全量接线；加入 RuntimeState、托盘/Mica、Windows 平台边界、独立 portable updater、核心替换回滚和 NSIS/MSI bundle | Rust 19 个单元检查、fmt、clippy、helper release build 通过；前端 tsc 通过；WebView、管理员系统状态、真实 sing-box、签名和 x64 仍按 V02/V03/V09/V11/V13–V15 待实机验收；ARM64 已排除；关联 MIG-005–016 |
| 2026-09-18 | 修复前端初始化监听竞态：先注册 traffic/window-close/state 事件并等待 Tauri listener 完成，再读取初始化快照；卸载逐项释放；重新生成 x64 bundle | 前端 TypeScript/Vite、Rust 20/20、fmt、clippy、Tauri NSIS/MSI、PE/portable/MSI 自动检查通过；真实 WebView 反复挂载和桌面行为仍待 x64 实机验收；ARM64 不在范围；关联 MIG-021/V04/V15 |
| 2026-09-18 | 将 Windows manifest 依赖架构收紧为 `amd64`，并在 Rust crate 增加仅 Windows `x86_64` 的编译期门槛 | 只允许 AMD64/x64 构建；ARM64 不构建、不发布、不验收；关联 MIG-025/V15 |
| 2026-09-19 | 根据真实 x64 测试日志修正 sing-box 解压内容预算为 128 MiB，并删除手工 WebSocket 握手，改用 tungstenite 标准请求生成 | 修复当前 x64 核心被 64 MiB 上限误拒绝和缺少 `Sec-WebSocket-Key`；保留鉴权、超时、重连、检查、替换回滚边界；关联 MIG-030 |

后续记录：任务 ID、旧→新字段/命令、影响调用者、存储兼容性、验证 ID、临时桥删除条件。禁止只改 Rust 或只改前端一端。
