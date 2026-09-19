# 决策、依赖、风险与延期台账

记录设计依据，不重复任务进度。`accepted` 为用户批准原则；`candidate` 需技术验证；`open` 尚未决定。调整实现细节可在批准范围内自行记录，改变产品范围须取得确认。

范围修订（2026-09-18）：本版只支持 Windows AMD64/x64。ARM64 文字若出现在下方早期研究或历史验证记录中，仅表示当时被观察过的上游资产或原方案；ARM64 不构建、不发布、不作为 tracker 阻塞或最终验收条件。

## 已批准决策

| ID | 决策 | 理由与边界 | 状态 |
| --- | --- | --- | --- |
| ADR-001 | Tauri 2 + Rust + Vue 3 + 独立 sing-box | 迁移框架和业务后端，复用网络内核；不长期保留 Go sidecar | accepted |
| ADR-002 | 本版 Windows，下版 Linux | 通过模块/cfg 隔离真实平台差异，不实现空 Linux 能力 | accepted |
| ADR-003 | 前端视觉/交互保留，内部允许优化简化 | 2026-09-16 用户补充；可直接迁移新协议，临时桥不成为永久约束 | accepted |
| ADR-004 | 内置/官方插件/成熟组件优先 | 不重复实现已有基础能力，也不为插件数量增加复杂度 | accepted |
| ADR-005 | 本版维持既有管理员行为 | 基线 requireAdministrator + 最高权限任务计划；暂不扩展为常驻服务 | accepted |
| ADR-006 | 数据备份、校验、失败恢复优先 | 保留便携体验；不将框架迁移变成无必要的数据库迁移 | accepted |
| ADR-007 | 两类更新分离，应用 updater 优先 | 便携/旧客户端兼容须前置验证，不能削减既有功能 | accepted |
| ADR-008 | 一套状态来源，小模块，按阶段验收 | 不建通用工厂/总线，复杂度由实际需求支撑 | accepted |

## 依赖选型台账

以下均为候选方向，尚未锁定版本或完成项目适配验证。实施时为每项补：准确版本/commit、最近维护证据、许可证及分发义务、支持平台、实测限制、锁文件位置、替代方案、验证日期。没有理由的候选可以删除，不是必装清单。

| ID | 能力/候选 | 来源 | 选择依据与需验证点 |
| --- | --- | --- | --- |
| D01 | Tauri 2 内置窗口、托盘、事件、菜单 | [tauri](https://github.com/tauri-apps/tauri) | 编译原型锁定 `tauri 2.11.5`、`tauri-build 2.6.3`；Mica、透明背景、缩放、权限、关闭行为仍需实机验证；不另写桌面框架 |
| D02 | single-instance、opener、log | [官方 plugins-workspace](https://github.com/tauri-apps/plugins-workspace) | 编译原型锁定 `tauri-plugin-single-instance 2.4.4`、`tauri-plugin-opener 2.5.5`；log 插件暂不引入，先复用 Rust core 日志边界 |
| D03 | updater；必要时 process | [updater 文档](https://v2.tauri.app/plugin/updater/)、[插件源码](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater) | 选 `tauri-plugin-updater 2.11.0`（crates.io，稳定版；`3.0.0-alpha.0` 不选）。官方 updater 要求签名，Windows 产物为 MSI/NSIS 及其 updater ZIP；plain portable binary 不作为官方 updater 路径。先在发行原型锁定 endpoint、密钥和退出清理，再接入 Rust。许可证：MIT 或 MIT/Apache-2.0。 |
| D04 | autostart 或任务计划薄适配 | [autostart 源码](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/src/lib.rs) | 不选官方 autostart 作为既有语义的替代；保留 Windows Task Scheduler 薄适配，复用 `schtasks.exe` 参数/结果检查，保持 `WinBoxAutostart`、登录触发、30 秒延迟、HighestAvailable、`-minimized`。候选插件没有证明这些语义等价。 |
| D05 | shell；不足时 tokio::process | [shell](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell)、[tokio](https://github.com/tokio-rs/tokio) | 不向前端暴露通用 shell；原型锁定 `tokio 1.53.1`（crates.io/upstream Tokio，MIT；已由 Tauri 锁入，项目持续维护），只启用 `io-util`、`process`、`rt`、`time`，在平台边界实现隐藏窗口、优雅停止、超时和进程归属检查。shell 插件暂不引入，避免新增高权限 IPC；最终日志/状态协调待 MIG-009。 |
| D06 | reqwest | [reqwest](https://github.com/seanmonstar/reqwest) | 候选 `reqwest 0.13.5`（crates.io，2026-09-08 更新，MIT OR Apache-2.0）；后端统一 HTTP/下载、代理、TLS、超时与取消，不同时安装前端 HTTP 插件。实现时写入 Cargo.lock，并以真实镜像/断网检查锁定 feature。 |
| D07 | tokio-tungstenite | [项目](https://github.com/snapview/tokio-tungstenite) | 候选 `tokio-tungstenite 0.30.0`（crates.io，2026-07-11 更新，MIT）；仅用于既有流量 WebSocket，复用同一 Tokio runtime，不启动第二套 runtime。到流量阶段再加入，先不把未使用依赖写入锁文件。 |
| D08 | serde、serde_json、zip | [serde](https://github.com/serde-rs/serde)、[json](https://github.com/serde-rs/json)、[zip](https://github.com/zip-rs/zip2) | `serde/serde_json` 已锁定；更新/解压锁定 `zip 4.6.1`（MIT，crates.io，`deflate-flate2-zlib-rs` feature），不选当前 9.0.0-pre3。只允许受控条目、文件大小和路径边界，先写临时位置并执行内核 check，再替换有效核心；本阶段只实现校验与暂存，不接下载或替换。 |
| D09 | windows-rs | [Microsoft 项目](https://github.com/microsoft/windows-rs) | 候选 `windows-sys 0.60.2`（MIT OR Apache-2.0）用于明确的 Win32/注册表/系统 API；只启用需要的 features。若标准库、`schtasks.exe` 或 Tauri API 已覆盖能力，不直接增加该依赖。 |
| D10 | tauri-action | [官方 action](https://github.com/tauri-apps/tauri-action) | 选 `action-v1.0.0`，解析到 commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`（MIT）；用于 Windows x64 构建、签名产物和受控发布。PR 只构建，签名密钥只进 CI secrets，不在仓库中生成或保存。 |
| D11 | SHA-256 完整性校验 | [RustCrypto/hashes](https://github.com/RustCrypto/hashes) | 锁定 `sha2 0.10.9`（crates.io，MIT OR Apache-2.0，维护项目为 RustCrypto/hashes）；只用于流式 SHA-256 digest 比对，已写入 `src-tauri/Cargo.lock`。digest 证明下载字节完整，不替代发布者签名或来源真实性。 |
| D12 | Tauri 前端 IPC/event API | [官方 `@tauri-apps/api`](https://github.com/tauri-apps/tauri/tree/dev/packages/api) | 锁定 npm `@tauri-apps/api 2.11.1`（npm registry；2026-09-12 元数据更新时间；仓库 `tauri-apps/tauri`；Apache-2.0 OR MIT），写入 `frontend/package-lock.json`。仅使用官方 `core.invoke`、`core.isTauri` 和 `event.listen`；不启用 globalTauri、不暴露通用 shell。限制：Rust command/event 仍需逐项迁移和实机验证。 |
| D13 | 跨平台本地时间格式化 | [chrono](https://github.com/chronotope/chrono) | 锁定 `chrono 0.4.45`（crates.io，MIT OR Apache-2.0，维护项目为 chronotope/chrono）；仅启用 `clock`，用于本地日志/配置更新时间格式化。Windows 与未来 Linux 共用同一实现，不增加平台 API。 |

存储暂不采用数据库；store 插件仅在能简化且不破坏旧数据/原子写入要求时选用。fs、http、dialog 等插件无实际调用需求不安装。UUID、版本比较等新增需求优先检查已有依赖和标准能力，再决定成熟 crate，不手写通用算法。

2026-09-16 研究证据：已读取官方 v2 分支 autostart `src/lib.rs`、updater/shell `README.md`。这些链接为可变分支；P0 锁定版本后须记录对应 tag/commit。其余项目在此为候选，未声称已审计维护状态或许可证。

## 待决问题

| ID | 问题 | 建议方向/所需证据 | 解决任务 |
| --- | --- | --- | --- |
| Q01 | 便携自动更新与安装版组合 | 验证 updater 支持的实际 Windows 产物；保留便携体验，无法对等时提出具体方案供用户决定 | MIG-002/004 |
| Q02 | 旧 Wails 客户端过渡 | 对照旧 ZIP/文件名选择逻辑，确定兼容资产或桥接版本；不能默认旧版识别 updater 元数据 | MIG-004 |
| Q03 | Windows 支持范围与架构证据 | 确定最低 OS、WebView2 安装策略、Mica 降级和 x64 设备目标；ARM64 排除在本版之外 | MIG-001/002 |
| Q04 | 数据模式与路径发现 | 便携模式选择方式、安装版数据路径、同机多份旧目录优先级、权限不足处理 | MIG-004 |
| Q05 | 内核下载真实性校验 | 核查上游签名/checksum 可得性、可信来源和镜像影响；明确验证边界 | MIG-004 |
| Q06 | 新 DTO/事件与生成类型需求 | 手写薄类型是否足够；如采用代码生成，记录收益，避免引入完整框架 | MIG-005 |

Q01–Q05 未解决前不得将对应功能标为可发行。Q06 可在 P1 内完成，不要求用户逐项批准命名。

### 2026-09-17 P0 观察（不是问题结论）

- 当前环境为 Windows 10.0.26200.0、x64、非管理员；WebView2 Runtime 已安装 `152.0.4191.62`。
- Rust 仅安装 `x86_64-pc-windows-msvc` target，未宣称 ARM64 支持；`cargo-tauri` 尚未安装，Tauri 仅有 x64 编译壳，未完成前端接入、打包或实机验证。
- `src-tauri` 初始 Rust core 使用 `serde 1.0.229`、`serde_json 1.0.151`，来源为 crates.io，版本由 `src-tauri/Cargo.lock` 锁定；直接及传递依赖许可证已用 Cargo metadata 核对，主要许可证为 MIT、Apache-2.0（`memchr` 为 Unlicense OR MIT，`zmij` 为 MIT）。
- 该依赖只用于旧 JSON 数据模型和存储边界；不引入数据库、store 插件或第二套运行时。Tauri、Windows API、HTTP、进程和压缩依赖仍保持候选状态，待 P0 原型后再登记。
- Tauri 编译原型已选定 `tauri 2.11.5`、`tauri-build 2.6.3`、`tauri-plugin-single-instance 2.4.4`、`tauri-plugin-opener 2.5.5`；均来自 crates.io，许可证为 MIT 或 Apache-2.0，版本由 `src-tauri/Cargo.lock` 锁定。crates.io 元数据显示核心包 2026-07-01 发布，两个直接插件 2026-08-31 发布；尚未引入 updater、shell、HTTP、WebSocket 或 `windows-sys` 业务依赖。
- 原型复用 `build/windows/icon.ico`，`bundle.active=false`；`tokio 1.53.1` 已作为直接依赖锁入 `Cargo.lock`，用于进程排空/等待/超时。管理员 manifest、托盘、Mica、前端通信和发行配置仍不等于已完成；npm CLI/API 仍待前端切换任务再加入并锁定。

### 2026-09-17 P0 选型结论 — MIG-002

- **Q01 便携更新与安装版**：分成两条明确渠道。安装版使用官方 updater 的签名 NSIS/MSI；portable 继续发布旧格式 ZIP 作为迁移和兼容资产。Tauri 官方 action 明确提示 plain binary 不是官方 portable 模式，因此不能把单个 `.exe` 上传后宣称可由 updater 安全更新。portable 自动更新在 MIG-013 前实现独立签名 helper 或等价的受控替换流程；在完成 V14 之前不宣称自动更新已保留。
- **Q02 旧 Wails 客户端过渡**：现有发布资产为 `WinBox-v2.8.0-windows-amd64.zip`，旧代码按 `windows-amd64` 和 ZIP 内 `WinBox.exe` 选择。首个 Tauri x64 portable 版本保持同一文件名模式、顶层布局和 EXE 名称，旧 Wails 客户端可以识别并替换；Tauri updater 的 `*.nsis.zip`/`*.msi.zip` 和 `latest.json` 不发送给旧客户端。ARM64 资产研究记录不属于本版发布渠道。
- **Q03 Windows/WebView2/架构**：当前本版最低目标按 Tauri 官方 WebView2 条件取 Windows 10 1803+；安装版默认先选 `downloadBootstrapper`（需联网），离线版只有在固定 WebView2 体积和更新策略验证后再选 `offlineInstaller`。portable 要求系统已有 WebView2，缺失时必须给出可行动错误。本版只支持并验证 Windows x64；ARM64 明确排除，不作为目标设计或验收条件。Mica 降级与管理员 manifest 留在 MIG-003/006 实机原型。
- **Q04 数据模式与路径发现**：本次迁移保持 portable-only 数据策略：数据根固定为运行中 EXE 的同级 `data/`，不在 `data/` 不存在时静默扫描或回退 AppData，也不在多目录之间自动择优覆盖。未来若明确引入安装版，使用 Tauri appDataDir 并提供一次性、可回退的旧 portable 导入；本阶段不实现第二数据模式。
- **Q05 内核下载真实性**：2026-09-17 读取 sing-box `v1.14.1` 稳定版和 `v1.15.0-alpha.5` 预发布版 GitHub Release；本版只消费 `windows-amd64.zip`，GitHub API 提供该资产的 SHA-256 `digest`。历史研究同时观察到 ARM64 资产，但其不属于本版发布或验收范围。稳定版资产列表未发现独立 checksum/signature 文件，因此 digest 只作为对指定 GitHub 资产的完整性证据，不能单独宣称发布者真实性。实现必须绑定官方 owner/repo/tag/精确资产名，校验 digest、ZIP 条目/大小/路径，再执行 `sing-box check`；镜像只允许代理下载，不能改写预期元数据或绕过校验。

以上结论不等于 updater、签名和 x64 实机行为已通过；对应验证仍由 MIG-003/004/012–014 完成。ARM64 已明确排除，不形成未完成项。

### 2026-09-17 P0 原型结论 — MIG-003

- **权限**：`tauri-build` 通过 `src-tauri/windows-app.manifest` 嵌入 `requireAdministrator`、`uiAccess=false` 和 per-monitor DPI 声明；生成的 resource script 已包含这些节点。构建不会把权限降为 `asInvoker`。
- **自启**：保留 `WinBoxAutostart` 任务计划而不是引入官方 autostart 插件；XML 固定登录、30 秒延迟、最高可用权限和 `-minimized`。创建/删除/查询均检查 `schtasks` 结果，创建失败不会更新业务设置。
- **进程**：`CoreProcess` 使用锁定的 `tokio::process`，只启动 `core/sing-box.exe run -c config.json`，固定排空 stdout/stderr；停止前按子进程句柄核对完整镜像路径，优雅退出等待 2 秒后才强制结束。没有全局 `sing-box.exe` 扫描或误杀路径。
- **限制**：当前采用 `CREATE_NO_WINDOW` 保持无控制台窗口；`CTRL_BREAK` 适配已隔离，但尚未在真实 sing-box 子进程上验证隐藏控制台下的优雅信号。尚未创建/删除任务、运行 Tauri UAC、登录触发或故障注入；这些必须在保存系统原状态的管理员实机检查中完成。

### 2026-09-17 P0 原型结论 — MIG-004

- **Q01/Q02 便携与旧客户端**：保留 `WinBox-v<version>-windows-amd64.zip` 和 ZIP 内精确 `WinBox.exe` 的命名校验；ARM64 资产不纳入本版。只证明旧资产选择契约可验证，未实现 portable helper、Tauri updater 或真实升级链。
- **Q03 架构**：资产映射固定为 Rust `x86_64` → `windows-amd64`；其他架构（包括 `aarch64`）拒绝。当前环境只运行 x64；ARM64 为本版明确排除项，不要求构建或实机验证。
- **Q04 数据与暂存**：继续使用 EXE 同级 `data/`；内核 ZIP 只写入新暂存目录，禁止覆盖现有 `core/sing-box.exe`，失败时清理本次暂存目录；替换和回滚留到 MIG-012。
- **Q05 完整性真实性**：`sha2 0.10.9` 流式校验 GitHub API `sha256:` digest，MIG-004 原型曾将受控 ZIP 的压缩包和声明解压内容都限制为 64 MiB，并只抽取 `sing-box.exe`。上游 digest 仍只是指定资产的完整性材料，不是发布者签名；未下载/执行真实 sing-box 资产或运行 `sing-box check`。当前实现的解压内容预算由 MIG-030 调整为 128 MiB，压缩包上限仍为 64 MiB。
- **阶段结论**：`MIG-004-PROT-2026-09-17` 证明 P0 校验边界原型可编译、可测试；V13/V14 的真实网络、签名、替换失败恢复、重启和 x64 实机仍为未执行，不能标记发布可用。ARM64 不属于本版验收。

### 2026-09-17 P1 实施决策 — MIG-005-a

- 前端暂时只允许通过 `frontend/src/api/backend.ts` 访问旧 Wails 生成 API/runtime；初始化快照、流量和模式同步事件在该边界声明 TypeScript DTO。这样可以一次迁移调用者，避免组件继续扩散框架依赖。
- 不为该适配层新增 npm 依赖，也不把 Wails 适配当作新后端。删除条件是对应 Rust/Tauri command、事件和错误映射通过 V04；之后替换该文件内部实现并删除 `frontend/wailsjs`。本阶段不宣称 Tauri IPC 已完成。

### 2026-09-18 P1 实施决策 — MIG-005 初始化只读切片

- 新增官方 `@tauri-apps/api@2.11.1` 是当前 `invoke`/`listen` 所需的最小前端依赖；准确版本、来源、许可证和锁文件登记在 D12。没有引入 shell、fs、http 或状态管理依赖。
- `backend.ts` 按运行容器选择后端：Tauri 中直接调用 `get_init_data`，旧 Wails 仅在非 Tauri 环境继续提供尚未迁移的 command。真实 Tauri command 错误不回退到 Wails，避免把后端故障隐藏成旧实现结果。
- 初始化 command 只读现有 Rust storage；未接入生命周期前如实返回 `running=false`/`localVersion=Unknown`（核心存在时），避免以文件存在冒充进程运行或执行未验证的核心二进制。
- 应用版本使用 Rust `AppHandle::package_info().version` 作为唯一 Tauri 运行时来源；前端 `getProductVersion()` 统一返回 Promise，旧 Wails 的 `GetProgramVersion` 只保留非 Tauri 兼容路径。删除了 `@wails` alias 和 `vite-env` 版本声明，不增加第二份版本配置。
- 事件包装先完成官方 `listen` 和可取消注册的边界，Rust 事件发布留给后续生命周期切片；因此本决策不关闭 R06，也不改变 MIG-005/V04 的阶段状态。

### 2026-09-18 P1 实施决策 — MIG-005 override 读写切片

- override 读写 command 只迁移编辑器需要的路径；复用 `Storage::load()`、`Storage::save_override()` 与现有默认配置常量，不新增存储层或 JSON 解析依赖。
- 在 Rust command 边界拒绝除 `tun`/`mixed` 外的名称，并用稳定脱敏 `AppError` 返回；不复制旧 Wails 对未知名称静默返回 `{}`/空字符串的行为，避免高权限应用把输入错误隐藏掉。
- `useKernelUpdate` 的打开、切换、保存和重置后刷新统一经 API 适配层；Tauri reject 显示为编辑器错误提示，非 Tauri 兼容路径把旧 `Success`/`Error: ...` 结果转换为成功或异常。
- 影响：`contracts.md` 增加 override 读写契约；验证证据为 `MIG-005-OVERRIDE-2026-09-18`、`MIG-005-OVERRIDE-WRITE-2026-09-18`；MIG-005、V04 继续 `in_progress`/局部通过。

### 2026-09-18 实施收口决策 — Tauri runtime、更新与发行

- **不引入 `tauri-plugin-updater`**：当前产品必须同时保留 portable ZIP 和安装版；没有入库签名密钥或已验证 endpoint 时，官方 updater 不能安全替代 portable 更新。安装版 bundle 先固定 NSIS/MSI，签名和 updater 元数据作为发布前置条件，不把未签名 plain binary 宣称为 updater。
- **portable helper 采用独立 Rust binary**：`winbox-updater` 只接收绝对路径、要求 stage 位于应用目录下且入口是 `WinBox.exe`，替换失败/新进程启动失败恢复旧 EXE；Tauri bundle 直接收集第二 binary，portable ZIP 单独重命名为 `WinBox-updater.exe`。没有建立长期 sidecar 或通用 shell 入口。
- **直接依赖版本锁定**：`tauri 2.11.5`、`tauri-build 2.6.3`、`tauri-plugin-single-instance 2.4.4`、`tauri-plugin-opener 2.5.5`、`reqwest 0.13.5`、`tokio-tungstenite 0.30.0`、`futures-util 0.3.31`、`tokio 1.53.1`、`uuid 1.26.1`、`sha2 0.10.9`、`zip 4.6.1`，均记录于 `src-tauri/Cargo.lock`；前端 `@tauri-apps/api 2.11.1` 记录于 `frontend/package-lock.json`。直接依赖使用 MIT 或 MIT/Apache-2.0 许可组合，最终分发仍需随产物做许可证审查。
- **窗口/托盘不增加自定义框架**：使用 Tauri 原生 EffectsBuilder/Mica、tray-icon、menu 和 single-instance；Rust `RuntimeState`/`Storage` 是唯一状态源，托盘命令复用同一应用操作路径。
- **CI 构建顺序固定**：先 `npm ci --prefix frontend`，再运行 Tauri bundle；Tauri CLI 的 `cargo build --bins` 会同时生成 `WinBox.exe` 与 `winbox-updater.exe`，不再额外预编译或显式复制同一 MSI/NSIS resource，避免 WiX 重复组件。普通 `cargo check/test` 不依赖 bundle。未安装 `cargo-tauri` 的开发机只执行 Rust/前端检查，不能伪造 bundle 证据。
- **前端工具链安全维护**：2026-09-18 将 Vite 更新到 `8.3.0`、`@vitejs/plugin-vue` 更新到 `6.0.9`、PostCSS 更新到 `8.5.28`，并用 npm `overrides` 固定 `browserslist 4.29.0` 与 `baseline-browser-mapping 2.11.25`；Node 26 满足 Vite 8 的 Node 要求。`npm ci`、完整 audit 和生产构建均通过，不升级 Tailwind/Vue 等无安全必要的业务/样式依赖。

### 2026-09-18 发行构建修正 — 主入口与 binary resource

- 将主 Cargo binary 固定为 `WinBox.exe`，保留旧 portable ZIP 和旧客户端的入口契约；`default-run` 固定 Tauri CLI 在主 GUI 与 updater helper 两个 binary 中选择 GUI。
- 本机 x64 Tauri CLI 证明会把两个 Cargo binary 自动写入 NSIS/MSI；显式 `bundle.resources` 会导致 WiX ICE30 重复组件，因此删除该配置。安装包内 helper 仍是 `winbox-updater.exe`，portable ZIP 内按兼容契约重命名为 `WinBox-updater.exe`。
- 未签名、未执行桌面/UAC/真实更新链的限制不变；本版仅发布 x64，ARM64 不在范围内；本证据只关闭 bundle 配置和入口命名风险。

### 2026-09-18 AMD64/x64 硬边界 — MIG-025

- **accepted**：本版只支持 Windows AMD64/x64（Rust `x86_64-pc-windows-msvc`）。编译期拒绝其他 OS/架构，Windows manifest 的公共控件依赖声明固定为 `amd64`。
- **未选方案**：不增加 ARM64 构建矩阵、资产、发布渠道或实机验收；锁文件中由 Tauri/构建工具带入的跨平台 crate 条目不视为产品支持。
- **影响**：CI、更新资产和验收边界保持 `x86_64`/`windows-amd64`；ARM64 只可作为拒绝分支或历史研究上下文出现，不形成未完成项。关联 contracts、tracker、validation 的 MIG-025。

### 2026-09-19 问题修复决策 — MIG-029

- **内核更新继续保留 Tauri command 编排**：`tauri-plugin-updater` 不适合独立下载并运行的 sing-box 核心；暂存核心先执行 `sing-box check`，Windows 替换使用原生 `ReplaceFileW` 备份交换、锁冲突短重试和阶段化 app log，启动失败回滚旧核心。
- **流量继续单链路**：Rust WebSocket → Tauri `traffic-update` → Vue 图表；将 `0.0.0.0` 仅用于监听的地址映射为 loopback，使用已有 `tokio-tungstenite` 发送可选 Clash API Bearer secret，加入连接超时和有界重连日志。不新增轮询库、事件桥或状态源。
- **影响/限制**：无新增依赖、无架构范围变化、无视觉或交互流程变化；自动证据见 `MIG-029-ISSUE-FIX-2026-09-19`，真实 Windows x64 sing-box/WebView 行为仍需复测。

### 2026-09-19 问题复盘与最小修复决策 — MIG-030

- **内核暂存上限**：保留 64 MiB 压缩包上限，将声明解压内容上限改为 128 MiB。当前官方 Windows x64 `sing-box` 核心约 81.9 MB，旧上限会在替换前错误拒绝；同时保留独立的超限错误，便于区分下载包过大与解压内容过大。未增加动态配置或额外解压库。
- **WebSocket 握手**：删除自建 `Request` 的握手路径，使用现有 `tokio-tungstenite` 的 `IntoClientRequest` 生成标准 `Sec-WebSocket-Key` 等头部，只在需要时追加 `Authorization: Bearer`。这是对用户日志中缺少 `sec-websocket-key` 的直接修复，不新增事件桥、轮询或网络依赖。
- **保留项**：loopback 映射、5 秒连接超时、受控重连、错误日志、暂存 `sing-box check`、Windows 原生替换/回滚均仍有独立边界价值，未因本次根因已定位而删除。
- **影响/限制**：无新增依赖、无架构范围变化、无视觉或交互流程变化；自动证据见 `MIG-030-ISSUE-FIX-2026-09-19`，真实 Windows x64 sing-box/WebView 行为仍需复测。本决策补充并覆盖 MIG-029 中对应的解压预算和 WebSocket 握手实现细节。

### 2026-09-19 窗口行为与主题材质修复决策 — MIG-032

- **窗口入口**：继续复用已有 `minimize`、`minimize_to_tray`、`show` Rust command。前端不再直接调用需要额外 capability 的窗口控制 API，避免为最小化/隐藏/聚焦扩大权限面；新增 `set_window_theme` 作为唯一主题原生入口。
- **主题材质**：`light` 使用 WebView `Theme::Light` + `MicaLight`，`dark` 使用 `Theme::Dark` + `MicaDark`，`system` 使用系统主题 + `Mica`。启动阶段读取已保存 `theme_mode` 并应用同一映射，切换时由前端 API 调用同一 command；不再固定 `Effect::Mica`。
- **窗口交互**：使用 Tauri 原生 `center: true` 恢复初始居中；只增加 `core:window:allow-start-dragging`；标题栏左侧剩余区域为拖动区，右侧设置/最小化/关闭按钮保持非拖动区域。托盘组件、动态图标和模式菜单不变。
- **影响/限制**：无新增依赖、无架构范围变化；Rust/前端自动检查见 `MIG-032-WINDOW-FIX-2026-09-19`。当前会话没有可绑定的原生 Tauri 窗口，Windows x64 的实际 Mica、DPI、拖动和托盘效果仍需人工复测。

### 2026-09-19 托盘应用重启清理路径决策 — MIG-033（accepted）

- **问题与约束**：托盘菜单回调运行在 Tauri 主线程；当前 `AppHandle::restart()` 在该线程会绕过 `RunEvent::ExitRequested`。项目自定义 sing-box、流量和代理清理只在该事件中执行，导致父进程重启时内核可能残留。
- **选定候选方案**：将 `commands::restart` 改为 `app.request_restart(); Ok(())`。这是 Tauri 2.11.5 官方提供的事件驱动重启入口，保持现有单一 `shutdown_runtime` 清理链，不增加依赖、线程或重复进程管理。
- **未选方案**：不在托盘回调中复制一套同步 shutdown；不通过另一个线程调用 `restart()` 规避主线程特例；两者都会增加清理路径或竞态面。`request_restart` 的正常事件循环路径必须由 Windows x64 实机验证。
- **影响/证据**：该阶段性修复记录保留用于解释 sing-box 残留的历史根因；后续用户复测发现 Tauri relaunch 仍不可靠，最终处置由 `MIG-035`/`MIG-036` 改为删除 Restart APP。核心清理链仍由 `Restart Core` 和统一退出路径复用。

### 2026-09-19 托盘应用重启未重新拉起处置 — MIG-035（accepted）

- **已确认**：`request_restart()` 解决了上一阶段的 sing-box 残留路径；当前用户复测表明内核已退出，但应用 relaunch 没有可见结果。Tauri 内部 relaunch 的 spawn 错误不会进入 WinBox 日志；`-minimized` 原始参数还可能使新进程仅隐藏启动。
- **选定方案**：删除 `Restart APP` 托盘菜单、Rust command 注册/实现及无调用的前端 API；保留 `Restart Core`、`Quit` 和程序更新 helper。该入口没有前端调用者，且 Tauri relaunch 的失败不可观测，继续维护会增加不必要的 Windows 进程启动边界。
- **未选方案**：不新增 launcher、延迟启动或第二套退出/清理链；完整应用重启如未来确有需求，另立任务并先设计可观测的 Windows relaunch 契约。
- **影响/证据**：托盘交互从 `Restart Core` 直接进入核心生命周期；BUG-004 通过移除失效入口关闭。实现与自动检查见 `MIG-036-CORE-RESTART-AUDIT-2026-09-19`。

### 2026-09-19 内核重启并发审计 — MIG-036（accepted）

- **发现并修复**：`restart_core_impl` 原先在获取 `RuntimeState.operation` 锁前读取 `runtime.core()`；与停止、模式切换或另一条重启请求并发时可能使用过期运行状态。现将检查移入操作锁内，所有排队请求按锁内状态决定是否执行。
- **前端防重入**：界面重启按钮在收到后端事件前立即设置 processing，并忽略重复点击；后端操作锁仍是最终一致性边界，托盘入口继续复用同一 `restart_core_impl`。
- **审计结论**：启停、模式切换、profile 切换、内核更新、自动启动和统一退出均在同一操作锁内进入 start/stop；核心监视器清理前也取得该锁并按 `Arc` 身份确认，不会清掉随后启动的新核心或停止其流量任务；启动失败会显式回收尚未登记的核心。未新增依赖或第二套进程清理路径。
- **限制**：自动检查不能替代真实 Windows AMD64/x64 sing-box 进程回归；仍需人工验证重复点击/托盘快速操作时始终只有一个核心 PID，重启失败时状态和系统代理可恢复。

### 2026-09-19 核心生命周期复核 — MIG-037

- **发现并修复**：旧核心监视器原先在未持有生命周期锁时执行 `clear_core_if` 后再停止流量；重启恰好完成停止并建立新核心时，旧监视器可能误停新核心的流量任务。现将监视器的身份清理和后续恢复放入 `RuntimeState.operation` 锁内。
- **启动失败清理**：核心已创建但代理状态读取/持久化或输出通道获取失败时，先显式停止未登记进程，再恢复代理状态并返回错误；不依赖 `kill_on_drop` 作为唯一清理手段。
- **自动启动竞态**：smart 网络探测结束后重新取得操作锁、读取最新快照并检查当前核心；若用户/托盘已经启动核心则跳过自动启动，避免探测期间产生第二个 sing-box。
- **边界**：不新增依赖、线程或第二套生命周期入口；真实 Windows x64 sing-box 的快速重启、单 PID、代理和 traffic 恢复仍需人工复测。

### 2026-09-19 配置下载 UA 与远程错误日志修复 — MIG-038（accepted）

- **问题**：迁移后的共享 HTTP 客户端仍使用 `WinBox/2.8`，远端配置下发服务按旧客户端契约要求 `sing-box`；配置添加/更新失败、程序更新失败和部分更新元数据早退也没有统一进入 app log。
- **选定方案**：在唯一共享 `reqwest` 客户端固定 `User-Agent: sing-box`，让配置、核心/程序资产和 release 元数据请求共同继承；远程操作失败通过 `RuntimeState` 统一写入 app log，非 2xx 错误保留状态码，配置校验错误只记录脱敏原因。
- **未选方案**：不为配置、内核、程序分别创建 HTTP 客户端，不新增重试库或日志框架；不记录请求 URL、响应正文、订阅 Token 或配置内容。
- **影响/证据**：不改变前端 command 名称、视觉/交互、更新资产或 Windows x64 范围；自动证据见 `MIG-038-CONFIG-HTTP-FIX-2026-09-19`，真实配置下发服务与 Windows WebView 复测仍待用户执行。

### 2026-09-19 时间与日志生命周期修复 — MIG-039（accepted）

- **问题**：迁移后的应用日志和 `Profile.updated` 使用 Unix 秒数；Tauri 启动没有清空上一次的 `app.log`/`core/box.log`，也遗漏了旧版启动/退出日志和应用日志轮转。
- **选定方案**：新增直接依赖 `chrono 0.4.45`（crates.io，MIT/Apache-2.0，已存在于锁文件，`clock` feature），由 Rust 共用一个本地时间格式化函数；日志使用 `YYYY-MM-DD HH:mm:ss`，配置更新时间使用 `YYYY-MM-DD HH:mm`。用跨平台库而不是 Windows API，避免 Linux 阶段重复实现日期/时区逻辑。
- **日志行为**：Tauri setup 在异步自动连接前清空两个当前日志文件并写入 `Application started`；正常退出写入 `Application shutdown`；应用日志达到 10 MiB 时按旧行为轮转并保留 5 个归档。前端兼容迁移期间已经落盘的 Unix 秒/毫秒值和旧日期字符串。
- **未选方案**：不增加 Windows-only 时间 API、日志框架或新的前端日期库；不改变用户日志查看和手动清空入口。
- **影响/证据**：跨平台格式化代码不改变本版 Windows AMD64/x64 范围；自动检查见 `MIG-039-LOG-TIME-2026-09-19`，Linux 仅登记为后续大版本的构建验证，不在本版构建或验收。

## 风险台账

| ID | 风险/级别 | 触发与影响 | 控制/证据 | 责任任务 |
| --- | --- | --- | --- | --- |
| R01 | 高：插件自启不等价 | UAC 或登录时无法静默运行，丢失延迟/权限 | 保留系统任务计划并实测 V11 | MIG-003/011 |
| R02 | 高：错误进程/代理清理 | 影响其他代理软件或留下断网状态 | 进程归属、代理归属、崩溃恢复 V09 | MIG-009/011 |
| R03 | 高：数据迁移/落盘失败 | 覆盖唯一副本、错误成功提示 | 备份、幂等、写入失败/中断 V05 | MIG-007 |
| R04 | 高：更新路径不兼容 | 便携或旧客户端无法升级/错误替换 | 真实产物升级链与回退 V13–V15 | MIG-004/012/013 |
| R05 | 高：全应用管理员权限扩大影响 | 不受控 IPC/远程内容/路径导致高权限操作 | command 输入校验、最小权限、受控内容与 URL，V16 | MIG-005/015 |
| R06 | 中：事件/快照竞态 | 页面卡忙碌态、重复流量、状态回退 | 单一来源、订阅释放/顺序检查 V04/V07 | MIG-005/009 |
| R07 | 中：视觉或交互回归 | Mica/缩放/动画、关闭逻辑改变 | 同环境截图与行为 V02/V03 | MIG-006/015 |
| R08 | 高：内核替换失败无恢复 | 旧核心被破坏或状态虚报运行 | 分阶段替换与故障注入 V13 | MIG-012 |
| R09 | 中：x64 发行架构边界被破坏 | 非 x64 资产误选、构建或发布配置漂移 | 固定 `x86_64-pc-windows-msvc`、精确 x64 资产名和 V15 证据 | MIG-014 |
| R10 | 中：迁移扩大为重写框架 | 平台抽象/双后端/前端状态系统膨胀 | ADR-001/003/008，审查依赖与临时桥清理 V17 | MIG-016 |

初始风险均为 open（待验证），并非已发生缺陷。关闭风险须补证据 ID 和日期；不能只写“已处理”。

## 延期与技术债

| ID | 内容 | 延期理由 | 重新评估条件 |
| --- | --- | --- | --- |
| DEFER-001 | Linux 具体实现与打包 | 用户明确下个大版本引入 | Linux 版本启动；复用平台边界 |
| DEFER-002 | 独立高权限服务/细粒度提权架构 | 本次保持现有权限体验，避免扩大迁移 | 新权限产品需求或确认的安全/体验问题 |
| DEFER-003 | UI 重设计 | 用户要求保持视觉及交互 | 用户明确提出新设计 |
| DEFER-004 | Rust core 初版按现有文件逐个提交，尚无多文件 journal/manifest | 先锁定旧 JSON 布局并完成单文件原子写入；跨文件崩溃恢复属于存储阶段，不在当前基线提早搭建 | MIG-007/V05 进行中断、只读、占用与恢复注入；若需要再引入 journal |

临时兼容桥、为赶进度削减的真实能力、未满足的验收项不得放进上述延期表而直接结项；需独立任务、到期条件和明确范围批准。

## 决策更新模板

ID / 日期 / accepted、candidate 或 superseded；问题与约束；选定方案；未选方案及具体理由；影响的契约/任务/验收；证据；若改变用户范围则附批准依据。保留被替代决策的摘要，避免后续 agent 重复争论。
