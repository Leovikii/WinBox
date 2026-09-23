# 后端规范与契约

alpha.4 开发约束：普通权限主进程，TUN/mixed 及 UWP 修改由统一权限边界检查；Windows 原生提权/降权与有限动作交接只在 Rust platform 内实现。跨账户交接拒绝，UAC 取消原实例保留，禁止任意路径/命令入口。用户级自启替代最高权限计划任务；不保留旧任务迁移代码。管理员状态更新先交接到普通权限，再调用官方 updater。

## 状态与进程

- 所有启停、重启、运行中档案/模式切换、内核替换共用 RuntimeState operation 锁。离线 save_mode 使用同一锁，不发布内核 busy；后台线程只原子更新 state.json，不重写设置、档案和覆盖配置，内核已运行时拒绝离线保存。用户选定模式与实际运行分开；停止/退出不清除持久模式。
- `CoreProcess` 只启动受控目录中的 `sing-box.exe run -c config.json`；先 `check` 验证生成配置。只管理自身子进程，停止核对镜像路径；优雅退出最多2秒，再 kill+wait，不按名称批量杀进程。
- spawn 不等于 ready：等待本进程拥有的 TCP 监听（Windows GetExtendedTcpTable，IPv4/IPv6）及 `/version` 成功 JSON，确认仍存活后才注册运行态。reqwest no_proxy/禁止重定向，请求500ms、重试间隔100ms、总限30秒；不依赖日志或固定成功延迟。依据 sing-box [启动顺序](https://github.com/SagerNet/sing-box/blob/v1.12.0/box.go) 与 [Clash API](https://github.com/SagerNet/sing-box/blob/v1.12.0/experimental/clashapi/server.go)。就绪不是远端互联网可达证明。
- 缺少 controller 时只在生成配置补随机 loopback 端口/secret；不改保存档案。已有 IP/secret/UI 保留，localhost 明确 IPv4，通配地址用 loopback 检查；域名和端口0不支持，明确失败。PID 不匹配不能探测或误报成功。
- stdout/stderr 持续消费，内存日志最多5000行；启动失败保留错误并停止子进程/尝试恢复代理。停止完成后发布真实状态，重启中途旧进程退出不能解除操作锁。

## IPC

设置枚举：自动连接显示 Smart / Always / Off，提交 `smart` / `always` / `off`。日志级别支持内核的 `trace`、`debug`、`info`、`warn`、`error`、`fatal`、`panic`；Default 提交空字符串，保留档案中的日志级别。显示文本与内部值按语义映射，不把标签直接作为 IPC 参数。

注册入口 `lib.rs`，Rust DTO/command 在 `commands.rs`，前端映射在 `api/backend.ts`；这三处及调用者/fixture 同步变更，不另维护全量重复签名表。参数/DTO 为 camelCase，持久字段保持已有 JSON 兼容。

| 事件/快照 | 含义 |
| --- | --- |
| `get_init_data` | running、coreBusy、设置、模式、档案、版本快照；自启状态另行查询 |
| `get_start_on_boot` / `set_start_on_boot` | Result<bool, AppError>；当前用户 Run 项实际配置状态，错误保留阶段及 HRESULT |
| `status: boolean` | 实际 ready/停止；前端不得用命令成功字符串覆盖更新的退出事件 |
| `state-sync: {tunMode,sysProxy}` | 确认模式，运行中切换成功后才提交选择 |
| `core-busy: boolean` | RAII 操作锁生命周期，包括失败/提前返回；stop→start 全程 true |
| `core-starting/stopping/restarting` | 过程文字，无 payload，不是进度或完成信号 |
| `core-lock: boolean` | 自动连接网络检测锁；前端 busy = 本地请求 OR core-busy OR core-lock |
| `traffic-update: {upload,download}` | B/s，停止清空；流量连接成功不是独立运行态来源 |
| `log: string` / `onAppLog: string` | 状态/错误提示；追加的应用日志 |
| `download-progress: 0..100` | 应用/内核更新共用，避免重叠与过期响应 |

现有命令仍有 Success/Stopped/Already stopped、config-missing 与 Error 字符串；部分 Result 使用 AppError(code,message)，backend.ts 统一解包。重构返回类型时一起改调用者，不能只改一端。无调用者的旧 toggle_service 与前端托盘刷新命令已删除；托盘初始化/刷新由 Rust 生命周期负责。内核诊断读取/清理 commands 保留，前端无用途包装已删。

## Windows 与安全

通知点击采用 Windows 协议激活 `winbox-notification://open`，NSIS 按 Tauri 配置注册当前用户协议并在卸载时按路径归属删除。入口仅打开窗口：已有实例走 single-instance 回调并解除最小化；冷启动跳过自动连接，不接受任意命令、路径或连接参数。复用 WinRT 发送通知，不再依赖进程内 Activated 回调，因此不需要保留通知对象或新增运行时插件/服务。实际通知中心点击需用安装后的新通知验证，旧通知不会自动改写激活方式。

- `asInvoker` 默认普通权限；当前用户 Run 项 `WinBox` 保存当前 EXE 的绝对引用路径及 `-minimized -autostart`，原生注册表读取/写入并复核，不创建计划任务。不存在才表示关闭；读取失败必须报告。检测到 Windows Startup apps 禁用或未知审批状态时报告错误，引导用户在系统设置处理，不改写审批记录或绕过禁用。
- TUN/mixed 按实际生成配置的 TUN inbound 判断权限，前端、托盘、自动连接共用后端校验。权限等待单独事件/快照，不能作为 running/busy。开机 Smart 判断需要连接后仍须用户授权；每次自启最多发送一次 Windows 通知，点击仅打开主界面，不自动触发 UAC。托盘显示 `WinBox - Needs approval`。通知使用 windows 0.61.3 WinRT API 和 NSIS 已有开始菜单快捷方式 AUMID；系统勿扰/通知关闭可能隐藏通知，托盘与主界面状态仍保留。
- `handoff.rs` 仅支持连接、UWP 草稿恢复和应用更新动作，127.0.0.1 随机端口/一次性令牌交接；双方核对进程映像、账户、会话和权限，接收方核对监听 PID。UAC 取消/接管准备失败保留原实例；提交前统一停止内核和恢复代理，接收方等待原进程退出后才初始化单实例。无磁盘交接文件或常驻 helper。管理员更新使用同账户桌面 shell 的普通令牌启动本 EXE，再运行官方 updater；失败不回退高权限安装。
- UWP 保存普通权限下先申请授权，交接仅带草稿、不自动修改豁免；新实例重新枚举后确认保存。不支持输入其他管理员账户来接管当前用户数据。
- mixed inbound 由 sing-box 写系统代理。记录原值及拥有值，持久化 system-proxy.json；正常停止仅恢复仍属于本应用的状态，不能清空其他软件新设置。所有启动（含权限交接）在 setup 中、开放命令及网络检测之前先恢复代理，不依赖自动连接开关、内核存在或管理员权限。恢复失败保留记录、暂停自动连接并显示主窗口；`get_init_data.proxyError` 保证前端加载后仍能显示错误。手动启动内核前重试恢复，成功才允许继续。以磁盘记录作为唯一恢复来源，读取/解析错误不能视为无记录；其他软件已修改代理时放弃旧记录，不覆盖它的新值。
- UWP 枚举 AppContainer Mappings；UTF-16 原生注册表读名称，HKEY_CURRENT_USER 的子路径不能再带 HKCU 前缀；资源名/空名回退包名或 SID，不丢行。SID 验证，CheckNetIsolation 参数数组调用，读取失败不能当作空豁免。
- capability 最小权限；command 自行校验。外链限制 HTTP(S)，远程 Markdown 不渲染高权限 HTML；日志不得泄露订阅 URL/凭据/配置内容。

## 存储、网络和更新

- 唯一 AppPaths 数据根；订阅路径由受控 ID 重建，不信任保存的绝对路径。保留默认值、未知兼容字段及旧 auto_connect 处理；坏 JSON/写入错误不能静默覆盖。写入使用 Windows 原子替换，成功落盘再更新状态。
- 已知边界：多个 JSON 文件顺序提交，不是跨文件事务；真正需要崩溃一致性时再加 journal。不要把每文件原子替换宣称为全局事务。
- 运行配置仅做必要 serde_json 覆盖，保留无关字段；TUN/mixed、IPv6/日志语义不变，候选调用内核 check。默认值以 models.rs/storage.rs 为准。
- 远程下载/元数据请求 UA `sing-box`；非2xx保留状态码。超时、大小、路径、架构校验不可省略。sing-box 精确官方 windows-amd64.zip，压缩64MiB、解压128MiB预算；核对 GitHub digest、拒绝越界归档，只提取目标 exe。普通 SHA-256 不等于发布者签名，镜像不得绕过校验。
- 内核：下载/校验/候选检查→停止→备份替换→按原状态启动/确认ready→清理；失败恢复旧内核/配置，恢复材料不能提前删。
- 应用：官方 updater 2.11.0，沿用 pre_release 选择 GitHub 稳定/预发布；无 latest.json 表示该通道无可用更新。Tauri 更新签名 NSIS + .sig + latest.json，不使用自制 helper/portable ZIP；安装前统一 shutdown 停流量、内核、恢复代理。
- 日志为本地时间；app.log 10MiB轮转保留5份；启动清空当前 app/kernel 会话日志，记录 Application started/shutdown。

应用更新说明仅取自与 updater 目标版本匹配的 GitHub Release body；不读取 latest.json.notes。正文缺失或版本不匹配时返回说明及目标 Release 链接，不影响可用更新。发布工作流不再将日志复制到 latest.json。

`check_update` 与 `check_program_update` 均返回 `{version, changelog}`；内核日志取 sing-box 对应 Release 正文，缺失时提供 Release 链接。`update_kernel` 接受可空 `expectedVersion`（仅首次安装省略），`update_program` 接受必填 `expectedVersion`；下载前验证指定 Release/updater 元数据版本与确认版本一致，不安装未经确认的版本。

网络请求：预发布按单条分页搜索（最多30条、总查询30秒），稳定版直接取 latest；安装按已确认版本 tag 请求，不随 latest 漂移。程序已为相同版本时跳过 updater 元数据请求。元数据请求20秒，连接8秒，读取停滞30秒；订阅总时限120秒，安装包总时限30分钟。应用/内核仅在整数进度变化时通知前端。保留系统代理、下载镜像、大小限制、验签/摘要与回滚；不缓存 Release 正文，保证重新检查可读取修改。
