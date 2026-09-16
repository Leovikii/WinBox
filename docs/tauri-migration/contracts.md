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
| config/profiles.json | Profile 数组 |
| config/overrides/tun.json | TUN 覆盖配置 |
| config/overrides/mixed.json | mixed 覆盖配置 |
| profiles/<id>.json | 下载并保存的订阅配置 |
| core/sing-box.exe | Windows 内核 |
| core/config.json | 生成的运行配置，不能冒充源订阅 |
| core/box.log | 内核文件日志 |
| app.log | 应用日志；归档规则 P0 补充 fixture |

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

后续记录：任务 ID、旧→新字段/命令、影响调用者、存储兼容性、验证 ID、临时桥删除条件。禁止只改 Rust 或只改前端一端。
