# 后端规范与契约

## 状态与进程

- 所有启停、重启、运行中档案/模式切换、内核替换共用 RuntimeState operation 锁。离线 save_mode 使用同一锁，不发布内核 busy；后台线程只原子更新 state.json，不重写设置、档案和覆盖配置，内核已运行时拒绝离线保存。用户选定模式与实际运行分开；停止/退出不清除持久模式。
- `CoreProcess` 只启动受控目录中的 `sing-box.exe run -c config.json`；先 `check` 验证生成配置。只管理自身子进程，停止核对镜像路径；优雅退出最多2秒，再 kill+wait，不按名称批量杀进程。
- spawn 不等于 ready：等待本进程拥有的 TCP 监听（Windows GetExtendedTcpTable，IPv4/IPv6）及 `/version` 成功 JSON，确认仍存活后才注册运行态。reqwest no_proxy/禁止重定向，请求500ms、重试间隔100ms、总限30秒；不依赖日志或固定成功延迟。依据 sing-box [启动顺序](https://github.com/SagerNet/sing-box/blob/v1.12.0/box.go) 与 [Clash API](https://github.com/SagerNet/sing-box/blob/v1.12.0/experimental/clashapi/server.go)。就绪不是远端互联网可达证明。
- 缺少 controller 时只在生成配置补随机 loopback 端口/secret；不改保存档案。已有 IP/secret/UI 保留，localhost 明确 IPv4，通配地址用 loopback 检查；域名和端口0不支持，明确失败。PID 不匹配不能探测或误报成功。
- stdout/stderr 持续消费，内存日志最多5000行；启动失败保留错误并停止子进程/尝试恢复代理。停止完成后发布真实状态，重启中途旧进程退出不能解除操作锁。

## IPC

注册入口 `lib.rs`，Rust DTO/command 在 `commands.rs`，前端映射在 `api/backend.ts`；这三处及调用者/fixture 同步变更，不另维护全量重复签名表。参数/DTO 为 camelCase，持久字段保持已有 JSON 兼容。

| 事件/快照 | 含义 |
| --- | --- |
| `get_init_data` | running、coreBusy、设置、模式、档案、版本快照；自启状态另行查询 |
| `get_start_on_boot` / `set_start_on_boot` | Result<bool, AppError>；系统任务的实际启用状态，错误保留阶段及 HRESULT |
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

- `requireAdministrator`、无控制台；任务计划 WinBoxAutostart：登录、30秒延迟、最高权限、`-minimized`；通过原生 Task Scheduler COM 查询/创建/删除并复核，XML 以 UTF-16 BSTR 传入，避免 schtasks 临时文件编码问题。仅 ERROR_FILE_NOT_FOUND 表示任务缺失；权限和服务错误必须报告。读取核对任务启用、当前 EXE 路径与 -minimized 参数。系统任务为唯一状态来源，旧 settings.start_on_boot 仅原样兼容，不驱动开关。COM 创建和释放均在同一 blocking worker 内，接口先于 CoUninitialize 释放；不用普通启动插件替代语义。
- mixed inbound 由 sing-box 写系统代理。记录原值及拥有值，持久化 system-proxy.json；正常停止仅恢复仍属于本应用的状态，不能清空其他软件新设置。
- UWP 枚举 AppContainer Mappings；UTF-16 原生注册表读名称，HKEY_CURRENT_USER 的子路径不能再带 HKCU 前缀；资源名/空名回退包名或 SID，不丢行。SID 验证，CheckNetIsolation 参数数组调用，读取失败不能当作空豁免。
- capability 最小权限；command 自行校验。外链限制 HTTP(S)，远程 Markdown 不渲染高权限 HTML；日志不得泄露订阅 URL/凭据/配置内容。

## 存储、网络和更新

- 唯一 AppPaths 数据根；订阅路径由受控 ID 重建，不信任保存的绝对路径。保留默认值、未知兼容字段及旧 auto_connect 处理；坏 JSON/写入错误不能静默覆盖。写入使用 Windows 原子替换，成功落盘再更新状态。
- 已知边界：多个 JSON 文件顺序提交，不是跨文件事务；真正需要崩溃一致性时再加 journal。不要把每文件原子替换宣称为全局事务。
- 运行配置仅做必要 serde_json 覆盖，保留无关字段；TUN/mixed、IPv6/日志语义不变，候选调用内核 check。默认值以 models.rs/storage.rs 为准。
- 远程下载/元数据请求 UA `sing-box`；非2xx保留状态码。超时、大小、路径、架构校验不可省略。sing-box 精确官方 windows-amd64.zip，压缩64MiB、解压128MiB预算；核对 GitHub digest、拒绝越界归档，只提取目标 exe。普通 SHA-256 不等于发布者签名，镜像不得绕过校验。
- 内核：下载/校验/候选检查→停止→备份替换→按原状态启动/确认ready→清理；失败恢复旧内核/配置，恢复材料不能提前删。
- 应用：官方 updater 2.11.0，沿用 pre_release 选择 GitHub 稳定/预发布；无 latest.json 表示该通道无可用更新。签名 NSIS + .sig + latest.json，不使用自制 helper/portable ZIP；安装前统一 shutdown 停流量、内核、恢复代理。
- 日志为本地时间；app.log 10MiB轮转保留5份；启动清空当前 app/kernel 会话日志，记录 Application started/shutdown。

应用更新说明仅取自与 updater 目标版本匹配的 GitHub Release body；不读取 latest.json.notes。正文缺失或版本不匹配时返回说明及目标 Release 链接，不影响可用更新。发布工作流不再将日志复制到 latest.json。

`check_update` 与 `check_program_update` 均返回 `{version, changelog}`；内核日志取 sing-box 对应 Release 正文，缺失时提供 Release 链接。`update_kernel` 接受可空 `expectedVersion`（仅首次安装省略），`update_program` 接受必填 `expectedVersion`；下载前验证指定 Release/updater 元数据版本与确认版本一致，不安装未经确认的版本。

网络请求：预发布按单条分页搜索（最多30条、总查询30秒），稳定版直接取 latest；安装按已确认版本 tag 请求，不随 latest 漂移。程序已为相同版本时跳过 updater 元数据请求。元数据请求20秒，连接8秒，读取停滞30秒；订阅总时限120秒，安装包总时限30分钟。应用/内核仅在整数进度变化时通知前端。保留系统代理、下载镜像、大小限制、验签/摘要与回滚；不缓存 Release 正文，保证重新检查可读取修改。
