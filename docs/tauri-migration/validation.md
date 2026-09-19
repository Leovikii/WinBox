# 验收矩阵与验证记录

本文件定义检查标准并登记证据。完整迁移功能当前尚未全量执行，局部 Rust core 检查的通过不等于迁移验收通过。本版只支持 Windows AMD64/x64；ARM64 研究记录若保留，仅用于历史上下文，不是构建、发布、阻塞或验收条件。测试环境使用脱敏配置和独立数据目录；会修改系统代理、自启或 UWP 的检查，保存原状态并在结束后恢复。

## 执行与证据规则

- 记录提交/未提交差异、OS 版本（Windows x64）、权限、WebView2、Rust/Node、sing-box 版本、数据模式及测试日期。
- 自动检查覆盖确定性转换/契约/恢复；真实 Windows 检查覆盖权限、代理、窗口和进程。不用 mock 代替操作系统行为。
- 每条证据包含操作/命令、预期、实际结果、退出码或截图/日志路径；敏感信息脱敏。失败和未执行保留原因。
- 同一任务可关联多次证据；原型通过不等于最终集成通过，发布前对最终产物重跑对应关键检查。
- 前端视觉修改使用同机器、系统主题、窗口尺寸、DPI、数据和应用状态比较。先在 P0 建立真实截图基线，README 展示图不能替代。
- 初期优先 Rust 内置测试与已有前端构建检查；确有复杂交互需要才引入测试工具，不预设大型测试框架。

## 验收矩阵

| ID | 场景与操作 | 通过标准 | 检查方式 | 当前结果 |
| --- | --- | --- | --- | --- |
| V01 | 基线与目标构建 | 目标前端/Rust/helper 构建检查通过，Tauri bundle 另证 | 工具输出与产物 hash | 最新窗口修复由 `MIG-032-WINDOW-FIX-2026-09-19` 记录：Rust fmt/clippy/test（24/24）、x64 单 EXE、前端 tsc/Vite 和配置 JSON 解析通过；历史 x64 bundle 证据仍见 `MIG-024-DEPENDENCY-2026-09-18`、`MIG-025-X64-GATE-2026-09-18` |
| V02 | 视觉：浅/深/系统主题、强调色、400×720 及调整尺寸、100/125/150/200% DPI | 布局/颜色/图标/字体/动画/滚动/Mica 无回归；无裁剪、闪白或按钮拖动误触 | 截图、录屏/实机；固定环境 | 已修复应用主题到 WebView/Mica 的映射、启动居中和左侧拖动区；托盘资源/视觉结构未改；截图、多 DPI 和 Mica 实机仍未执行 |
| V03 | 窗口：最小化、托盘隐藏/显示、关闭 ask/tray/quit、二次启动、隐藏启动、核心重启 | 操作路径保持；单实例正确聚焦；关闭走清理，核心重启不残留内核，托盘模式继续运行 | Windows 实机 | 已移除不可靠的应用级重启入口；核心重启保留并由 MIG-036 审计锁内状态检查和前端防重入；真实窗口/UAC/托盘/主题/核心进程行为仍未执行 |
| V04 | API/事件：参数序列化、错误、初始化快照、反复挂载卸载、注册未完成即卸载 | DTO 对齐；无漏订阅/重复监听/误删其他监听；失败解除忙碌态；事件与快照不会让状态倒退 | 契约检查与交互复现 | 全量 Rust command、camelCase DTO、脱敏错误、Tauri invoke/listen 独立卸载、初始化前等待 listener 注册、全局 composable 引用计数与定时器清理已编译；真实 WebView 反复挂载和错误交互仍未执行 |
| V05 | 数据：正常/旧字段/缺字段/损坏文件、只读/占用、导入中断再试、重复导入、中文空格路径、多源目录 | 原数据可恢复，默认值明确，重复导入安全，不静默覆盖，写入失败可见；退出 flush | 脱敏 fixture、故障注入与 Windows 文件检查 | Rust storage 的默认值、未知字段保留、原子写入、覆盖配置校验和更新 stage 回滚有 19 个单元检查；只读/占用和跨文件崩溃恢复仍未执行 |
| V06 | 订阅增删改/选择/更新、TUN/mixed 覆盖、IPv6/日志、无效 JSON/下载失败 | 用户交互不变；仅覆盖指定字段；无关字段保留；无效候选不破坏有效配置；内核 check 成功 | fixture、sing-box check、交互 | profile/override/配置生成、HTTP 限制、`sing-box check` 和日志设置已实现；真实订阅与内核 fixture 仍未执行 |
| V07 | Proxy/TUN/Mixed 启停、停止后选择、运行中配置切换、核心重启、快速连续点击与托盘同时操作 | 唯一内核、状态一致、无死锁；未就绪不伪报运行；失败解锁，模式与运行区分 | 生命周期检查 + 实机 | RuntimeState 操作锁、CoreProcess、监视器锁内身份清理、三模式 apply/restart、自动启动最终核心复核、前端防重入和托盘复用路径已实现；真实 sing-box 与快速点击仍未执行 |
| V08 | 应用/内核日志、清空、滚动跟随、文件日志开关、大量日志；流量停止/隐藏/恢复 | 日志有界、无阻塞、行为保持；速率单位正确，停止归零，恢复无重复流 | 压力样本与实机 | 有界 kernel log、app log 文件、WebSocket loopback/secret/超时/取消/重连和停止归零已实现；压力与窗口隐藏实机仍未执行 |
| V09 | 正常退出、内核崩溃、应用强制结束、启动超时、退出超时、其他 sing-box/代理软件并存 | 本应用资源可回收/恢复；无误杀，无覆盖别人代理；重启恢复到可用状态 | 保存原状态后的故障注入 | 句柄级路径核对、超时强杀、启动失败未登记进程回收、代理启动前/接管后快照及条件恢复已实现；真实崩溃/超时/并存进程仍未执行 |
| V10 | 自动连接 off/smart/其他实际值、无网络、网络延迟、已有代理环境、取消/退出 | 与已确认基线行为一致；不无限重试/挂起；Standby/超时提示正确；任务可取消 | 网络场景实机 | off/smart/always 分支、15 次网络检测、Standby/Net Timeout 和退出可取消路径已实现；网络场景仍未执行 |
| V11 | 提权拒绝/允许、自启开关、注销登录、任务旧路径更新、带空格路径、电池状态 | 最高权限、延迟、最小化语义保持；失败不保存成功状态；无重复任务，关闭自启有效 | Windows 登录实测 | manifest、任务 XML、创建后查询/删除后查询和固定系统工具路径已实现；管理员/UAC/登录实测仍未执行 |
| V12 | UWP 列表、选择增删、已有其他豁免、读取失败、部分操作失败、非法 SID | 差异更新准确；不把失败当空列表；保留非目标条目并报告部分失败 | 系统状态前后对比 | 注册表枚举、CheckNetIsolation 差异更新和 SID 校验已实现；真实系统状态前后对比仍未执行 |
| V13 | 内核稳定/预发布 x64、镜像、断流/校验错/解压错/被占用/替换后启动失败 | x64 资产准确；有效旧核心/配置可恢复；下载不先切断所依赖代理；用户状态真实 | 测试资产与故障注入 | 官方 sing-box `v1.14.1` x64 资产 digest 校验、`version`、最小配置 `check` 已执行；暂存核心 check、Windows `ReplaceFileW`/重试/阶段日志和旧核心回滚有单元与代码路径；运行进程/文件占用/故障注入仍未执行 |
| V14 | 旧客户端→首个 Tauri→后续版本，便携/安装模式、错误签名、离线、替换失败、重启 | 真实更新链可用，签名错误被拒绝，数据保留，失败可恢复；不静默取消便携能力 | 测试发布源、真实产物 | portable 名称/入口、独立 helper、stage 清理、替换失败/启动失败恢复已实现；x64 ZIP/helper 安全路径已执行；签名、真实替换、安装版 updater 链仍未执行 |
| V15 | CI、干净安装/升级、WebView2 存在/缺失、x64 产物、更新元数据 | x64 构建和实机结果分别记录；产物/版本/签名对应；发布权限和密钥配置正确 | CI 日志 + x64 设备 | 最新管理员上下文 `cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi --no-sign` 通过且 Tauri 输出 `Target: x64`；NSIS/MSI/helper/portable 条目、PE `Machine=0x8664` 和 MSI 提取见 `MIG-025-X64-GATE-2026-09-18`；CI、签名和干净安装实机仍未执行 |
| V16 | 受控 IPC/URL/路径、远程 Markdown；启动/空闲/后台/日志压力性能 | 非授权命令/路径被拒绝；内容无高权限执行入口；对照 P0 指标无未解释回归 | 边界用例、同环境测量 | URL、profile ID、override、archive、SID、helper 路径和 command 错误边界已覆盖；性能/远程内容实机仍未执行 |
| V17 | 去除旧栈、临时桥、双版本源与无用依赖 | 活动构建/代码不依赖 Go/Wails；文档历史引用可保留；新环境独立构建成功 | rg、锁文件、构建 | Go/Wails 源码、生成目录、旧配置和旧构建资源已删除；活动代码无旧栈引用；最终 x64 Tauri bundle 已成功生成 |
| V18 | 文档/实现/台账一致性 | 命令/文件/依赖与实际一致，所有完成项有证据，阻断清零或有明确批准例外 | 文档复核 | `MIG-024-DEPENDENCY-2026-09-18`、`MIG-025-X64-GATE-2026-09-18` 已补充最新 x64 产物、依赖审计、初始化事件顺序、manifest 硬门槛和 MSI/ZIP 证据；x64-only 实现、CI、契约、代理归属保护、下载清理和前端订阅释放已同步；真实 WebView/系统/签名证据仍待登记 |

## 推荐命令

以下命令与当前工程入口一致；bundle/安装器仍需在有对应架构、签名和 Windows 桌面环境时另行验收。

```text
项目根目录: npm ci --prefix frontend
项目根目录: npm --prefix frontend run build
项目根目录: cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
项目根目录: cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings
项目根目录: cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline
项目根目录: cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi --no-sign
```

不要将历史 Go 基线 README 的过时版本要求当作实际工具链要求；架构、目标和外部验收限制以本组文档最新记录为准。

## 证据登记

### DOC-V1 — 文档初始化检查

- 日期：2026-09-16。
- 范围：根 AGENTS.md、七份迁移文档；没有修改应用代码。
- 检查：Markdown 本地链接目标存在；迁移任务 ID 无重复且依赖存在；方法盘点覆盖旧 App 公共方法（含明确内部方法）；`git diff --check`；变更文件范围核对。
- 结果：通过。8 份文档本地链接全部有效；18 个任务（1 个文档任务、17 个迁移任务）无重复 ID/缺失依赖；旧 App 公共方法无遗漏；逐文件 `git -c core.safecrlf=false diff --no-index --check -- /dev/null <file>` 无空白错误，已跟踪应用文件无修改。检查脚本已正确处理 no-index 的差异退出码和仓库 LF/CRLF 提示。
- 未执行：所有 V01–V18 迁移功能检查；无 Rust/Tauri 工程可用于目标构建验证。

### 后续证据模板

```text
证据 ID / 验收 ID / 任务 ID：
日期、执行人、提交与未提交差异：
OS、架构、权限、WebView2、工具链、sing-box、数据模式：
前置条件、操作/准确命令：
预期：
实际、退出码：
日志/截图/测试文件/产物路径：
结果：pass / fail / blocked / not_run
剩余问题及关联 R/Q：
系统状态恢复结果：
```

### MIG-001-BL-2026-09-17 — P0 环境、构建与初始 Rust core

- 日期/分支/提交：2026-09-17；`dev`；`4e8af0efc1a58a53f5fe78d7b1f732726dee1e86`（工作区含本次未提交修改）。
- 环境：Windows `10.0.26200.0`，x64，当前用户非管理员；WebView2 Runtime `152.0.4191.62`；Go `1.26.3 windows/amd64`；Node `v26.1.0`；npm `11.13.0`；Rust `1.97.1` / `x86_64-pc-windows-msvc`；Wails CLI `v2.12.0`；未安装 `cargo-tauri`；仅安装 x64 Rust target。
- V01 基线命令与结果：
  - `go test ./...`：首次因默认 Go cache 位于沙箱不可读目录失败；将 `GOCACHE` 指向工作区后退出码 0，`WinBox` 与 `WinBox/internal` 均通过（无测试文件）。
  - 在 `frontend/` 执行 `npm run build`：退出码 0；TypeScript 与 Vite `5.4.21` 构建通过；Browserslist 有既有数据过期 warning。
  - `wails build -clean -ldflags "-s -w" -trimpath`：退出码 0；产物 `build/bin/WinBox.exe`；SHA-256 `8248F4CE63289B7BFD37B02523DD0ED442F2C0C271EDA65A0C9F0DB57D141615`；仅证明历史 Windows/amd64 基线；ARM64 不在本版范围。
  - `src-tauri`：`cargo fmt --check`、`cargo test --locked`（6 passed）、`cargo clippy --all-targets --locked -- -D warnings` 均退出码 0；这是 Rust storage core 检查，不是 Tauri 打包检查。
- 源码盘点：
  - 后端职责仍在 `internal/app*.go`、`core_manager.go`、`storage.go`、`settings_manager.go`、`profile_manager.go`、`traffic_monitor.go`、`platform_windows.go`、`uwp_loopback.go`、`app_update.go`、`http_client.go`、`app_logger.go`。
  - 前端直接调用 `wailsjs/go/internal/App` 的 composables/components 已由 `rg 'Backend\.' frontend/src` 盘点；事件覆盖 `status`、`state-sync`、`core-starting`、`core-stopping`、`core-restarting`、`core-lock`、`log`、`onAppLog`、`traffic-update`、`download-progress`；调用清单与旧契约映射在 [contracts.md](contracts.md)。
  - 数据根仍为 EXE 同级 `data/`：`config/settings.json`、`state.json`、`profiles.json`、`overrides/{tun,mixed}.json`、`profiles/<id>.json`、`core/{sing-box.exe,config.json,box.log}`、`app.log`。
- 脱敏 fixture 索引：
  - `src-tauri/src/storage.rs::missing_files_use_product_defaults_without_writing`：缺文件与产品默认值。
  - `...::load_preserves_legacy_and_unknown_settings_fields`：`auto_connect`、未知设置字段和 dark 主题；值为示例文本，无真实订阅。
  - `...::invalid_override_is_rejected_without_replacing_existing_file`：合法覆盖与 `not-json` 失败恢复。
  - `...::save_and_reload_round_trips_data`：`profile-1`、`example.invalid`、中文配置名和分文件往返。
  - `src-tauri/src/paths.rs::controlled_ids_cannot_escape_data_root`：profile ID 与 override 类型边界。
- 当前结果/限制：P0 基线证据已开始收集，但 `MIG-001` 仍为 `in_progress`。尚未执行 Tauri 视觉截图、管理员/代理/UWP/自启/进程实机验证；ARM64 已明确排除；旧 Wails 前端和 Go 后端仍是当时的活动参考路径。多文件提交尚无 journal/manifest，关联 DEFER-004、MIG-007/V05。

### MIG-002A-2026-09-17 — Tauri 2 依赖与最小壳编译原型

- 任务/范围：`MIG-002-a`；只验证 Tauri 2 Rust 依赖解析、Windows x64 编译和 storage 挂载，不宣称前端、发行或桌面行为完成。
- 选定依赖：`tauri 2.11.5`、`tauri-build 2.6.3`、`tauri-plugin-single-instance 2.4.4`、`tauri-plugin-opener 2.5.5`；serde/serde_json 沿用已锁定版本；直接包许可证均为 MIT OR Apache-2.0，来源为 crates.io，完整锁文件包含 483 个包。
- 修改：`src-tauri/build.rs`、`src-tauri/src/main.rs`、`src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`、复用的 `src-tauri/icons/icon.ico`、`Cargo.toml`/`Cargo.lock`。
- 检查：
  - `cargo check --manifest-path src-tauri/Cargo.toml --locked`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked`：退出码 0；storage 6/6，binary 0 个测试。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`：退出码 0。
- 实际限制：`bundle.active=false`；无 Tauri command、前端 API、托盘、Mica、管理员 manifest、更新器、进程或网络能力；`cargo-tauri` 未安装；V02 与 Windows 实机仍未执行。首次构建因缺少 `src-tauri/icons/icon.ico` 失败，已复用仓库现有图标后通过。
- 子任务结果：pass；不代表 `MIG-002` 父任务或 P1 功能验收通过。

### MIG-002P0-2026-09-17 — 更新、发行、平台与依赖边界选型

- 任务/范围：`MIG-002` P0 选型；只验证官方能力、旧资产/路径契约和发布元数据，不宣称 updater、签名、portable helper 或 Windows x64 实机行为已经通过。ARM64 研究记录不属于本版范围。
- 环境/状态：2026-09-17，`dev`，Windows x64，当前用户非管理员；WebView2 `152.0.4191.62`；当前只安装 `x86_64-pc-windows-msvc` target；工作区有未提交迁移修改；系统代理 `ProxyEnable=0`；`WinBoxAutostart` 查询结果为任务不存在。查询只读且未改变系统状态。
- 官方资料与依赖元数据：
  - Tauri updater README/官方文档：`tauri-plugin-updater 2.11.0` 支持 Windows；更新必须有签名；Windows updater 产物为 MSI/NSIS 及其签名 ZIP；Windows 安装时应用会先退出。插件源码声明 MIT 或 MIT/Apache-2.0。
  - Tauri 官方 action：`action-v1.0.0`，tag 解析到 commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`；README 明确 `uploadPlainBinary` 不是官方 portable 模式。
  - Tauri Windows 先决条件：WebView2 从 Windows 10 1803 起已随系统提供；配置文档列出 `downloadBootstrapper`、`embedBootstrapper`、`offlineInstaller`，其中离线固定 runtime 会显著增大安装包。
  - 候选版本/来源/许可证：`reqwest 0.13.5`（reqwest，MIT OR Apache-2.0）、`tokio-tungstenite 0.30.0`（snapview，MIT）、`zip 4.6.1`（zip-rs，MIT）、`windows-sys 0.60.2`（Microsoft windows-rs，MIT OR Apache-2.0）；这些尚未使用，未写入当前 Cargo.lock。
- 旧发布/系统检查：
  - WinBox Release API：`v2.8.0` 只有 `WinBox-v2.8.0-windows-amd64.zip`；现有 Go 更新逻辑按 `windows-amd64` 和 ZIP 内 `WinBox.exe` 选择。
  - 现有 `internal/settings_manager.go`：任务名 `WinBoxAutostart`、登录触发、`PT30S`、`HighestAvailable`、`-minimized`；官方 autostart builder 未证明可保持全部语义。
  - `src-tauri/src/paths.rs` 与 Go 基线均使用 EXE 同级 `data/`；不自动选择 AppData 或其他副本。
- sing-box Release API：稳定 `v1.14.1` 提供 `sing-box-1.14.1-windows-amd64.zip`，digest `sha256:5197f16d492d93202dc623622149a6ed040f8eca263128f91d603f2b901baa89`。早期研究同时记录过其他资产，但本版只消费 amd64；稳定版资产列表未发现独立 checksum/signature 文件。
- Tauri 启动入口原型：新增 `src-tauri/src/startup.rs`，保留 `-minimized` 与 `-delay-start`，后者延迟 1.5 秒；`cargo test --manifest-path src-tauri/Cargo.toml --locked` 退出码 0，8/8 通过，其中 2 个测试覆盖启动参数。这里只证明解析和入口编译，不证明隐藏窗口、单实例聚焦或延迟自启的 Windows 实机行为。
- 结果：pass（选型与边界记录）；Q01–Q05 形成可执行方向，决策已同步 `decisions.md`，发行/数据/架构契约已同步 `contracts.md`。GitHub API digest 只作为指定资产完整性证据，不替代发布者签名；镜像不获得覆盖预期元数据的权限。
- 未执行/限制：没有下载或执行发布资产；没有生成 updater 签名或 Windows installer；没有完成 V02、MIG-003 权限/自启/进程原型；portable 自动替换 helper、最终签名和 V14 链路仍待实现与故障注入。ARM64 已排除。
- 系统状态恢复：只读查询，无需恢复；没有创建任务、修改代理、写入注册表或发布 Release。

证据文件按需要存入本目录的 evidence 子目录，台账链接对应路径。不要预建大量空文件，不提交真实订阅地址、token、签名私钥或用户日志。

### MIG-003-PROT-2026-09-17 — Windows 权限/自启/进程原型

- 任务/范围：`MIG-003`；只验证 Rust 原型、manifest 资源生成、任务计划只读查询和路径边界单元检查，不宣称 Windows 功能验收完成。
- 环境：2026-09-17；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；Rust `1.97.1` / `x86_64-pc-windows-msvc`；WebView2 `152.0.4191.62`；仅便携数据设计；未运行 sing-box 资产。
- 修改：`src-tauri/windows-app.manifest`、`src-tauri/build.rs`、`src-tauri/Cargo.toml`/`Cargo.lock`、`src-tauri/src/{lib,core}.rs`、`src-tauri/src/platform/{mod,windows}.rs`；同步 `contracts.md`、`decisions.md`、`tracker.md`。
- 实现检查：manifest 使用 Tauri `WindowsAttributes::app_manifest` 嵌入 `requireAdministrator`、`uiAccess=false`、per-monitor DPI；生成 `target/debug/build/.../out/resource.rc` 可见对应节点。任务 XML 单元检查覆盖 `PT30S`、`HighestAvailable`、`-minimized`、带空格/`&` 路径转义。内核路径单元检查接受 `core/sing-box.exe`，拒绝同级外路径；停止实现按子进程句柄核对镜像路径，优雅等待 2 秒后才强制结束。
- 命令与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib --locked`：退出码 0，10/10 通过。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked`：退出码 0。
  - `git diff --check`：退出码 0（仅既有 CRLF 转换提示）。
  - `schtasks /Query /TN WinBoxAutostart /FO LIST`：退出码 1，`ERROR: The system cannot find the path specified.`；按当前英文系统输出解释为任务不存在。查询只读，未创建/删除任务。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked`：退出码 0；10 个库测试与 0 个 doctest 通过。主 Tauri binary 没有测试目标（`test=false`），不触发非管理员 UAC；管理员实机运行仍需单独验证。
- 结果：原型检查 pass；V03/V07/V09/V11 的真实 Tauri、UAC、计划任务创建/删除/登录、sing-box 启停、崩溃恢复和其他进程并存仍为 not_run。
- 限制与下一步：`CREATE_NO_WINDOW` 保持内核无控制台，`CTRL_BREAK` 适配已隔离但未在真实 sing-box 上验证；未引入全局进程扫描。下一步保存系统原任务状态，在管理员环境用带空格的隔离路径执行创建→查询→删除并恢复；随后用真实 sing-box 或等价受控 fixture 验证优雅退出/超时强杀，再进入 MIG-004。
- 系统状态恢复：本证据只读查询和临时单元 fixture；未修改任务计划、代理、注册表、UWP 或发布状态。

### MIG-004-PROT-2026-09-17 — 数据/更新兼容边界原型

- 任务/范围：`MIG-004`；验证目标架构和旧资产命名、SHA-256 完整性、ZIP 安全暂存及旧核心不覆盖；不宣称下载、签名、内核检查、替换回滚或真实升级链完成。
- 环境：2026-09-17；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；Rust `1.97.1` / `x86_64-pc-windows-msvc`；仅 x64 target；便携数据根设计为 EXE 同级 `data/`；工作区保留未提交迁移修改。
- 依赖：直接锁定 `sha2 0.10.9`（MIT OR Apache-2.0）和 `zip 4.6.1`（MIT，启用 `deflate-flate2-zlib-rs`）；锁文件为 `src-tauri/Cargo.lock`。`zip` 只保留读取所需 DEFLATE backend，不引入 updater、HTTP 或通用 shell。
- 修改：`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/src/lib.rs`、`src-tauri/src/updates.rs`，以及 `contracts.md`、`decisions.md`、`tracker.md`。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；15/15 库测试通过，doctest 0/0。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0。
  - 单元 fixture 覆盖：`x86_64` 映射和包括 `aarch64` 在内的不支持架构拒绝；x64 资产不匹配拒绝；旧 Wails `WinBox-v2.8.0-windows-amd64.zip` 与 `WinBox.exe` 校验；`sha256:` digest 正确/错误分支；ZIP `..`/绝对路径拒绝；安全 archive 只暂存 `sing-box.exe` 且保留已有核心。
- 实际限制：尚未下载真实稳定/预发布 sing-box；尚未运行 `sing-box check`、镜像/断流/被占用/替换失败注入；未执行 portable helper、Tauri updater、签名和 Wails→Tauri 真实升级链。ARM64 已排除。GitHub digest 仍不等于签名。
- 系统状态恢复：只写入工作区编译缓存与测试临时目录；测试结束清理临时 fixture；未修改任务计划、代理、注册表、UWP、发布源或用户数据。
- 结果：原型 `pass`；`MIG-004` 按原型验收范围转 `done`，V05/V13/V14 的真实验收仍未完成。

### MIG-005A-2026-09-17 — 前端 API 边界与 DTO 原型

- 任务/范围：`MIG-005-a`；将前端所有 Wails backend/runtime 直连收敛到 `frontend/src/api/backend.ts`，为初始化快照、流量和模式同步建立 DTO；不宣称 Tauri IPC 已完成，不改变视觉或交互。
- 环境：2026-09-17；`dev`；Windows `10.0.26200.0`、x64；Node `v26.1.0`；npm `11.13.0`；前端保持 Vue 3/Vite 5.4.21；工作区保留未提交迁移修改。
- 修改：新增 `frontend/src/api/backend.ts`；更新 `App.vue`、`useAppState`、`useProfiles`、`useTheme`、`useProgramUpdate`、`useKernelUpdate`、`useUWPLoopback`、`useAppLogs`、`DashboardControl.vue`、`SettingsPage.vue` 的导入；Wails 生成文件仍只由适配文件引用。
- 检查与结果：
  - `npx tsc --noEmit`：退出码 0。
  - `npm run build`：退出码 0；Vite 转换 73 个模块，生成 `frontend/dist`。首次受沙箱限制的 Vite 配置读取失败，使用完整工作区权限重跑通过；仅保留既有 Browserslist/Node deprecation warning。
  - `rg` 盘点：业务源码不再直接导入 `wailsjs/go/internal/App` 或 `wailsjs/runtime/runtime`；仅 `api/backend.ts` 保留阶段适配，`vite-env.d.ts` 只保留类型声明。
- 实际限制：适配层内部仍调用旧 Wails；Rust command/DTO 序列化、Tauri event listen/unlisten、统一错误和状态快照顺序尚未接入/实测。删除适配层必须等 V04 通过，不能把当前 bundle 当作 Tauri 功能验收。
- 系统状态恢复：只写入工作区前端构建输出/缓存；未修改系统代理、自启、注册表、UWP、用户数据或发布状态。
- 结果：`MIG-005-a` `pass`，转 `done`；`MIG-005` 保持 `in_progress`。

### MIG-005-IPC-2026-09-18 — 初始化只读 command 与 Tauri API 边界

- 任务/范围：`MIG-005`；将初始化快照从阶段兼容层迁移到 Rust `get_init_data`，并让统一前端 API 在 Tauri 使用官方 `invoke`/`listen`；不宣称全量 command、事件发布、生命周期或实际 Tauri WebView 已完成。
- 环境：2026-09-18；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；WebView2 `152.0.4191.62`；Node `v26.1.0`、npm `11.13.0`；Rust `1.97.1` / `x86_64-pc-windows-msvc`；工作区保留未提交迁移修改；便携数据根为 EXE 同级 `data/`。
- 修改：新增 `src-tauri/src/commands.rs` 并在 `lib.rs` 注册 `get_init_data`；新增 `AppError`/camelCase `InitDataDto`；前端 `backend.ts` 使用 `@tauri-apps/api@2.11.1` 的 `invoke`、`isTauri`、`listen`，非 Tauri 才调用旧 Wails；`useAppState` 改用 camelCase 字段；更新 `package.json`/`package-lock.json` 与本台账。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；17/17 库测试通过，doctest 0/0；新增 DTO 序列化、active profile、核心存在和错误脱敏 fixture。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0。
  - `npx tsc --noEmit`：退出码 0；`npm ci --ignore-scripts` 使用锁文件安装成功。
  - `npm run build`：退出码 0；Vite `5.4.21` 转换 76 个模块。首次沙箱读取 Vite 配置受限，使用完整工作区权限重跑通过；仅有既有 Browserslist/Node deprecation warning。
  - `npm audit --omit=dev --json`：退出码 1；报告 2 个 high 风险（`nanoid` 间接依赖、`postcss` 直接开发工具依赖）；本切片未执行自动升级，保留为依赖清理事项。
  - `git diff --check`：退出码 0；`rg` 确认 Wails 引用仍只在 `frontend/src/api/backend.ts` 与类型声明中。
- 限制：未启动管理员 Tauri WebView，未验证 UAC/窗口/真实 data 目录；Rust 尚未发布状态、流量或日志事件，Tauri `listen` 仅完成边界包装；`running=false`/核心存在时 `localVersion=Unknown` 是明确阶段限制。`npm audit --omit=dev` 仍报告既有 `postcss`/`nanoid` 依赖风险，本切片未执行破坏性自动升级。
- 系统状态恢复：只写入工作区源文件、锁文件、构建输出与临时测试目录；未修改任务计划、代理、注册表、UWP、用户数据或发布状态。
- 结果：初始化 command/适配切片 `pass`；V04、MIG-005 继续 `in_progress`。

### MIG-005-VERSION-2026-09-18 — 版本只读 command 与单一版本源

- 任务/范围：`MIG-005`；将前端程序版本读取从 `@wails`/`wails.json` 移到 Rust `get_product_version`，并保留旧 Wails 非 Tauri fallback；不宣称 Tauri WebView 实机或更新链通过。
- 环境：2026-09-18；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；Node `v26.1.0`、npm `11.13.0`；Rust `1.97.1` / `x86_64-pc-windows-msvc`；工作区保留未提交迁移修改。
- 修改：`commands.rs` 新增 `get_product_version(AppHandle)` 并注册；`backend.ts` 改为异步 Tauri invoke；`useProgramUpdate` 等待版本加载；删除 Vite `@wails` alias 和 `vite-env.d.ts` 中对应类型声明。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；17/17 库测试通过，doctest 0/0。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0。
  - `npx tsc --noEmit`：退出码 0；`npm run build`：退出码 0，Vite `5.4.21` 转换 75 个模块。沙箱内首次读取 Vite 配置受限，使用完整工作区权限重跑通过；仅有既有 Browserslist/Node deprecation warning。
  - `rg -n '@wails|wails\.json' frontend/src frontend/vite.config.ts`：退出码 1，无活动引用；`git diff --check`：退出码 0。
- 限制：未启动 Tauri WebView 验证 `AppHandle` 返回的版本字符串，未执行真实程序更新检查；旧 Wails command 仍存在于阶段适配，其他后端 command/events 未迁移。
- 系统状态恢复：只写入工作区源文件和构建输出；未修改任务计划、代理、注册表、UWP、用户数据或发布状态。
- 结果：版本读取切片 `pass`；V04、MIG-005 继续 `in_progress`。

### MIG-005-OVERRIDE-2026-09-18 — 受控 override 只读 command

- 任务/范围：`MIG-005`；迁移编辑器所需的 override 读取和默认值读取，不宣称保存/重置、完整编辑器、事件或 Tauri WebView 已通过。
- 环境：2026-09-18；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；WebView2 `152.0.4191.62`；Node `v26.1.0`、npm `11.13.0`；Rust `1.97.1` / `x86_64-pc-windows-msvc`；便携数据根为 EXE 同级 `data/`；工作区保留未提交迁移修改。
- 修改：`commands.rs` 新增 `get_override`/`get_default_override` 并注册；`backend.ts` 增加 Tauri/非 Tauri 双路径适配；`useKernelUpdate.ts` 的打开、标签切换和重置后刷新使用新读取入口并处理 reject；同步 contracts/decisions/tracker。
- 契约检查：Rust 只接受 `tun`/`mixed`；测试覆盖 tun/mixed 内容选择、未知类型稳定错误 `invalid_override_type`、TUN/mixed 默认配置；错误消息不含本地路径或订阅内容。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；20/20 库测试通过，doctest 0/0。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0。
  - `npx tsc --noEmit`：退出码 0。
  - `npm run build`：沙箱内首次因 Vite/esbuild 读取上级目录权限失败；在完整工作区权限下重跑退出码 0，Vite `5.4.21` 转换 75 个模块。仅有既有 Browserslist/Node deprecation warning。
  - `git diff --check`：退出码 0；仅有工作区既有 CRLF 转换提示。
- 限制：未启动管理员 Tauri WebView，未验证真实 `invoke` 返回值、override 编辑器写入和旧数据实机读取；保存/重置 command、状态/流量/日志事件和生命周期仍未迁移。V04、MIG-005 继续进行中。
- 系统状态恢复：只写入工作区源文件、锁文件、构建输出与 Rust 测试临时目录；未修改任务计划、代理、注册表、UWP、用户数据或发布状态。
- 结果：override 读取切片 `pass`；不代表 V04 或 MIG-005 完成。

### MIG-005-OVERRIDE-WRITE-2026-09-18 — override 写入 command

- 任务/范围：`MIG-005`；迁移编辑器保存和重置的受控 IPC，不宣称真实 Tauri WebView、全量 command、事件或生命周期已通过。
- 环境：2026-09-18；`dev`；Windows `10.0.26200.0`、x64、当前用户非管理员；WebView2 `152.0.4191.62`；Node `v26.1.0`、npm `11.13.0`；Rust `1.97.1` / `x86_64-pc-windows-msvc`；便携数据根为 EXE 同级 `data/`；工作区保留未提交迁移修改。
- 修改：新增并注册 Rust `save_override`/`reset_override`；前端 API 在 Tauri 使用 `invoke`，非 Tauri 将旧 Wails 结果统一转换为异常；编辑器保存、重置和重置后刷新改用适配层；同步 contracts/decisions/tracker。
- 契约检查：只接受 `tun`/`mixed`；保存复用 JSON 校验和原子写入；`invalid_override_json`、`storage_write_failed` 与 `invalid_override_type` 消息不暴露路径、订阅内容或原始 JSON。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；21/21 库测试通过，doctest 0/0。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0。
  - `npx tsc --noEmit`：退出码 0。
  - `npm run build`：退出码 0；在完整工作区权限下 Vite `5.4.21` 转换 75 个模块。仅有既有 Browserslist/Node deprecation warning。
  - `rg` 调用扫描：退出码 0；旧 `GetOverride`/`GetDefaultOverride`/`SaveOverride`/`ResetOverride` 仅保留在 `frontend/src/api/backend.ts` 兼容边界，业务 composable 无直接旧入口。
  - `git diff --check`：退出码 0；仅有工作区既有 CRLF 转换提示。
- 限制：未启动管理员 Tauri WebView，未验证真实文件写入、权限拒绝、编辑器失败提示和跨进程数据可见性；状态/流量/日志事件和生命周期仍未迁移。V04、MIG-005 继续进行中。
- 系统状态恢复：只写入工作区源文件、锁文件、构建输出与 Rust 测试临时目录；未修改任务计划、代理、注册表、UWP、用户数据或发布状态。
- 结果：override 写入切片 `pass`；不代表 V04 或 MIG-005 完成。

### MIG-005-FINAL-2026-09-18 — Tauri command/API 全量接线

- 任务/范围：`MIG-005`、`MIG-006`–`MIG-013` 的自动化收口检查；完成 Rust command、RuntimeState、Windows 平台边界、托盘/Mica、portable helper 和核心更新回滚，不把未执行的 WebView/系统状态/发行签名验收标为通过。
- 修改：`src-tauri/src/{commands,core,lib,runtime,startup,storage,updates}.rs`、`src-tauri/src/platform/windows.rs`、`src-tauri/tauri.conf.json`、`src-tauri/windows-app.manifest`、`src-tauri/Cargo.toml`/`Cargo.lock`、`frontend/src/api/backend.ts` 及全部调用者、`.github/workflows/build-and-release.yml`；删除 Go/Wails 源码、生成目录、旧配置和旧构建资源。
- 自动检查结果：
  - `cargo fmt --check`：退出码 0。
  - `cargo clippy --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo test --locked --offline`：退出码 0；19/19 库测试、0 doctest 通过。覆盖 storage 默认/未知字段/原子写入、路径边界、profile/override/URL/模式辅助、ZIP/digest、更新 stage、核心回滚文件恢复、helper stage 路径清理和 Windows 任务 XML/核心路径。
  - `cargo build --release --bin winbox-updater --locked --offline`：退出码 0；helper 已生成于 `src-tauri/target/release/winbox-updater.exe`。
  - `npx tsc --noEmit`：退出码 0。
  - `rg` 活动代码扫描：Go/Wails 源码、`wailsjs`、`wails.json` 和 `@wails` 活动引用已删除；迁移文档中的 Wails 仅保留历史/过渡说明。
- 未完成/限制：本机 `cargo tauri` 未安装；Tauri NSIS/MSI bundle、签名、管理员 WebView、真实 sing-box/订阅/代理/UWP/任务计划和多 DPI 截图尚未执行。ARM64 已排除。沙箱内一次 `npm run build` 因 esbuild 读取工作区父目录被拒绝，需在完整工作区权限下重跑并登记结果。
- 系统状态恢复：代码测试只写入 `src-tauri/target` 和系统临时 fixture；未修改系统代理、任务计划、UWP、用户数据或发布 Release。
- 结果：自动化实现检查 `pass`；V01–V18 的外部验收仍按矩阵保留 `review/not_run`。

### MIG-014-BUNDLE-2026-09-18 — x64 Tauri bundle 与 portable 产物演练

- 任务/范围：`MIG-014`、`MIG-016`；验证最终 Tauri 构建命令、主入口命名、NSIS/MSI 组件、独立 helper 和旧 portable ZIP 布局。不宣称签名、干净安装或完整升级链通过；ARM64 已排除。
- 环境：Windows `10.0.26200.0`、x64；Rust `1.97.1` / `x86_64-pc-windows-msvc`；Node `26.1.0` / npm `11.13.0`；`cargo-tauri 2.11.4`；Tauri crate `2.11.5`；WebView2 `152.0.4191.62`；工作区 `dev`，未提交迁移修改。
- 修改：主 Cargo binary 固定为 `WinBox.exe`，增加 `default-run = "WinBox"`；Tauri hook 使用相对 `src-tauri` 的 `../frontend`；删除重复的显式 helper resource；安装目录 helper 兼容 `winbox-updater.exe`，portable helper 仍为 `WinBox-updater.exe`；CI 删除重复的 helper 预构建步骤；远程 changelog 原始 HTML 改为转义文本。
- 检查与结果：
  - `cargo tauri build --bundles nsis,msi`：退出码 0；前置 frontend build、`cargo build --bins --features tauri/custom-protocol --release` 均通过。
  - 产物：`src-tauri/target/release/bundle/nsis/WinBox_2.8.0_x64-setup.exe`；`src-tauri/target/release/bundle/msi/WinBox_2.8.0_x64_en-US.msi`；`src-tauri/target/release/bundle/portable/WinBox-v2.8.0-windows-amd64.zip`。
  - 最终 SHA-256：NSIS `5588885D923D36BC453EC7E5BD64F2E810D07C0608F63180E7F32039F3E60BA6`；MSI `17E79E2819B4364CBFE8794F9141CEFF6907D30697929D6BA8585AF63DF10B00`；portable `B3D1730D37CD51CE0B5B03C522F7F15D4AABA70032C9E0BAB090887298B948D1`。
  - portable ZIP 条目严格为 `WinBox/WinBox.exe` 与 `WinBox/WinBox-updater.exe`，无路径逃逸；helper 使用 `--invalid` 安全路径退出码 0。
  - `msiexec /a ... /qn` 管理员提取退出码 0；提取目录含 `PFiles/WinBox/WinBox.exe` 与 `PFiles/WinBox/winbox-updater.exe`。WiX 清单只有一个 helper component。
  - 只读 `Invoke-RestMethod` release 元数据：sing-box `v1.14.1` 的 x64 ZIP 带 `sha256:` digest；WinBox `v2.8.0` portable 资产名为 `WinBox-v2.8.0-windows-amd64.zip` 且带 digest，和更新选择契约一致。
  - `cargo fmt --check`、`cargo clippy --all-targets --locked --offline -- -D warnings`、`cargo test --locked --offline`（19/19）、release binaries、`npx tsc --noEmit`、`npm run build` 均退出码 0。
- 首次失败与修正：hook 原为 `frontend` 导致 `src-tauri/frontend/package.json` 不存在；改为 `../frontend`。显式 resource 与 Cargo binary 重复导致 WiX ICE30；删除 resource 后 NSIS/MSI 均通过。主入口最初为 `winbox-tauri.exe`，改为 `WinBox.exe` 以保持旧 portable/update 契约。
- 系统状态恢复：未执行系统安装、未修改任务计划/UWP/代理/发布源；只写入 `src-tauri/target` 构建和 MSI 管理员提取目录。
- 未完成/限制：未签名；未在真实 WebView 执行窗口、Mica、托盘、UAC、任务计划、真实 sing-box、代理和安装升级链；这些继续保持 `review/not_run`，不能以本证据标记完成。ARM64 已排除。
- 结果：x64 bundle/portable 自动演练 `pass`；`MIG-014`、`MIG-016` 仍需对应外部验收证据。

### MIG-018-FINAL-2026-09-18 — x64 范围修订与最终自动回归

- 任务/范围：MIG-002、MIG-012、MIG-014、MIG-015、MIG-016、MIG-017；按用户确认将 Windows 发布范围固定为 AMD64/x64，并复核自动可验证实现。不宣称真实 WebView、UAC、代理/内核生命周期、签名或干净安装升级已通过。
- 环境：Windows `10.0.26200.0`、x64、`dev`、当前用户非管理员；Rust `1.97.1` / `x86_64-pc-windows-msvc`；Node `26.1.0` / npm `11.13.0`；`cargo-tauri 2.11.4`；WebView2 `152.0.4191.62`；工作区保留未提交迁移修改。
- 修改：更新模块只接受 Rust `x86_64` 并生成 `windows-amd64` 资产名；CI matrix 只保留 `x86_64-pc-windows-msvc`；README、迁移契约/决策/计划/台账同步 x64-only 范围，ARM64 仅在历史研究语境中保留并明确排除。
- 修改：`download_file` 在流式网络、写入、超限、flush 或 rename 失败时清理临时 `.part-*`；Windows 代理改为记录启动前与接管后快照，仅在停止/崩溃时当前状态仍匹配本次接管状态才恢复，不再启动时无条件清空或覆盖其他软件改动；前端 composable 和 App 级事件按引用/独立卸载函数清理监听、媒体查询和定时器。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；20/20 库测试、0 doctest 通过，含持久化系统代理 marker 往返 fixture。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo build --manifest-path src-tauri/Cargo.toml --release --bin winbox-updater --locked --offline`：退出码 0。
  - `npm --prefix frontend run build`：完整工作区权限下退出码 0；TypeScript 和 Vite 生产构建均通过。受限沙箱第一次运行仅因 esbuild 读取工作区父目录被拒绝，未产生类型错误。
  - `cargo tauri build --bundles nsis,msi`：完整工作区权限下退出码 0；Tauri 输出 `Target: x64`，NSIS/MSI 均生成。
  - portable ZIP 重新由当前 x64 主程序/helper 打包；条目严格为 `WinBox/WinBox.exe`、`WinBox/WinBox-updater.exe`。
- MIG-018 当时生成的 x64 产物哈希为：主程序 `D88A2D8E1503CC0EBF48D452E251B8F6D7D8A69993D4380C24C45E8025E801A6`；helper `9874DFB6D7A715756CAE93444EC704B6F0385C54963836C47773953E8CEA11E9`；NSIS `13DB920454093DA0B7AFD6AFDAF86EB701C3F16246744390234FA23FB35A4A5A`；MSI `F6E6B153ACAFC9C27395827B81185C25DDBDBAC1C89D9940325D6FFD483E11C3`；portable `5799CF89B8C27E5CE95F520D20B8F539C836D1096D7E195E9F784249A685472A`。停止失败修复后的最新产物见下方 MIG-019。
- 系统状态恢复：本证据只写入 `src-tauri/target`、frontend dist 和临时打包目录；未启动最终 GUI、未修改代理/任务计划/UWP/用户数据、未安装 MSI/NSIS、未发布 Release。
- 未执行/限制：真实 WebView 窗口、主题/Mica/DPI、托盘/单实例、UAC、任务计划登录、真实 sing-box 启停/崩溃/代理、UWP、签名和干净安装/升级仍需 x64 Windows 人工验收；ARM64 不在本版范围，不构成缺失证据。
- 结果：x64 自动回归 `pass`；V02/V03/V07/V09/V11/V12/V14/V15 的人工部分继续保持 `review/not_run`，不将本证据伪标为发布完成。

### MIG-012-KERNEL-2026-09-18 — 官方 sing-box x64 资产检查

- 任务/范围：`MIG-012`、V13；验证真实稳定版 x64 资产 digest、二进制版本和配置检查，不执行 TUN、系统代理或长期核心进程。
- 操作：读取 GitHub Release `v1.14.1` 元数据，下载 `sing-box-1.14.1-windows-amd64.zip` 到 `src-tauri/target/validation-singbox-x64`；SHA-256 期望/实际均为 `5197f16d492d93202dc623622149a6ed040f8eca263128f91d603f2b901baa89`；只提取唯一 `sing-box.exe`。
- 结果：`sing-box.exe version` 退出码 0，输出 `sing-box version 1.14.1`；受控最小 `config.json` 的 `sing-box check -c` 退出码 0。
- 系统状态恢复：只写入工作区 `src-tauri/target` 临时目录；未修改代理、TUN、任务计划、UWP、用户数据或发布状态。
- 未完成/限制：真实 profile/订阅、运行/崩溃/停止超时、被占用替换、镜像/断流故障注入仍需 V07/V09/V13 的最终 x64 实机证据；ARM64 已排除。
- 结果：真实 x64 资产完整性与 check `pass`；不代表内核生命周期或系统代理验收完成。

### MIG-019-STOP-FAILURE-2026-09-18 — 停止失败路径与单内核归属

- 任务/范围：`MIG-009`、`MIG-011`；修复停止失败时提前清除运行态句柄、随后可能启动第二个 sing-box 的生命周期风险。
- 修改：`stop_core_impl` 在 `CoreProcess::stop` 成功后才调用 `clear_core_if`；切换模式、重启和选择 profile 在停止失败时恢复之前状态并返回失败，不继续启动新进程；系统代理恢复只删除当前存在的目标值。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；20/20 库测试、0 doctest 通过。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - 使用官方 sing-box `v1.14.1` x64 二进制启动受控 mixed 配置的代理接管试验：进程可启动且结束后无残留；当前受限环境禁止写入 HKCU Internet Settings，未将该试验记为代理接管通过。测试前后 `ProxyEnable=0`，`ProxyServer`/`ProxyOverride` 均未设置。
- 系统状态恢复：sing-box 进程已结束；代理注册表保持测试前快照；未修改任务计划、UWP、用户数据或发布状态。
- 结果：停止失败路径自动修复 `pass`；V07/V09 的真实停止、崩溃、代理和管理员行为仍为 x64 人工 `review/not_run`。

### MIG-019-BUNDLE-2026-09-18 — 停止失败修复后的 x64 产物复核

- 任务/范围：`MIG-009`、`MIG-011`、`MIG-014`、`MIG-017`；确认停止失败修复进入最终 x64 主程序、helper、NSIS/MSI 和 portable ZIP，不宣称桌面/UAC/签名发布验收。
- 检查与结果：`cargo fmt --check`、`cargo test --locked --offline`（20/20，0 doctest）、`cargo clippy --all-targets --locked --offline -- -D warnings` 和 `npm --prefix frontend run build`（TypeScript/Vite，76 个模块）均通过；MSI 验证日志返回 `MainEngineThread is returning 0`，产品安装成功状态为 0。
- 当前 x64 产物 SHA-256：主程序 `425A0298D470C21EE1858F37650B79EF7B4E02740326CBF66E2644BCF06898A6`；helper `871CC7B0F19569E2943669751215599C010A41CAF2A444C5A3B0F44E27BFCC47`；NSIS `B8B011A2F9605C3F23E538E425766575A5DCF3F14A8EFEC01E9FDB2907AA6BC5`；MSI `560A413498F6C563BD92EE3CBEB69DDEFC96247B1B5D09295379665F5AA64A7F`；portable `318E493D73440643A9B6CB387A9C32322FEE984FFF1F426F6380DA1FB6C021B4`。
- portable ZIP 条目严格为 `WinBox/WinBox.exe`（17,589,760 bytes）和 `WinBox/WinBox-updater.exe`（1,775,104 bytes）；与当前 x64 release binaries 一致，无额外入口。
- 系统状态恢复：只写入工作区构建目录和 frontend dist；sing-box 受控试验进程已结束，未安装最终 MSI/NSIS、未修改代理/任务计划/UWP/用户数据、未签名、未发布 Release。
- 结果：最新 x64 自动产物复核 `pass`；V02/V03/V07/V09/V11/V12/V14/V15 的人工桌面部分仍保持 `review/not_run`，ARM64 不在本版范围内。

### MIG-020-LIFECYCLE-2026-09-18 — 进程监视与停止归属边界硬化

- 任务/范围：`MIG-009`、`MIG-011`、V07/V09；修复输出通道关闭后的监视器忙等，以及停止流程第二次镜像查询失败时可能误强杀的问题。
- 修改：`CoreProcess::stop` 在确认句柄镜像属于本应用后才允许强制结束；归属查询错误直接返回失败；`RuntimeState` 监视器在 stdout/stderr channel 关闭后关闭该 select 分支，保留进程状态轮询。
- 检查与结果：`cargo fmt`、`cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`（20/20 库测试、0 doctest）和 `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings` 均退出码 0。
- 结果：自动生命周期边界检查 `pass`；真实 sing-box 优雅退出、超时强杀、崩溃和并存进程仍需 x64 Windows 实机证据。

### MIG-020-BUNDLE-2026-09-18 — 生命周期修复后的最终 x64 bundle

- 任务/范围：`MIG-009`、`MIG-011`、`MIG-014`、`MIG-017`；确认最新 Rust 生命周期修复已进入最终 Windows x64 产物。
- 检查与结果：`cargo tauri build --bundles nsis,msi` 退出码 0，Tauri 输出 `Target: x64`；前置 `npm --prefix ../frontend run build` 通过并转换 76 个模块；MSI 管理员提取成功，日志返回 `MainEngineThread is returning 0` 和安装成功状态 0。
- 当前产物 SHA-256：主程序 `8125E22F0585EB35FA3B34676A02545EBF51C1A18C2058B3EE3F9E13680C70AC`；helper `01396A35357AD336AA5B6A6EBA3F6EE82010032DBEBEEECF5574F3BFCF15B34E`；NSIS `336157B69E9FDC6FB7A5A474AAFDF3E13AADAD4F499B57D74F8F83CC02B0E060`；MSI `6DAF02B36D592FB33E9311EE76AEC7D78D2CDFB606B348AF0B20F53CFB5D003F`；portable `D9F51D3D9BA2A9DB58FFBEBCBADD1E46F3DB579CB60F3DFB0AE3FE0FA0C08067`。
- 产物边界：主程序/helper PE `Machine=0x8664`；portable ZIP 仅含 `WinBox/WinBox.exe`（17,590,784 bytes）和 `WinBox/WinBox-updater.exe`（1,775,104 bytes）；NSIS/MSI 未签名。
- 结果：最新 x64 自动 bundle 复核 `pass`；真实 WebView/UAC、sing-box 运行/崩溃/代理、干净安装升级、CI 和签名仍需 x64 人工/发布环境证据。

### MIG-021-INIT-ORDER-2026-09-18 — 初始化监听顺序与最终 x64 产物

- 任务/范围：`MIG-005`、`MIG-010`、`MIG-014`、`MIG-017`；修复 Tauri listener 尚未注册完成时读取初始化快照的竞态，并以当前源码按 CI 的 `x86_64-pc-windows-msvc` 目标刷新最终 AMD64/x64 产物。
- 修改：`frontend/src/api/backend.ts` 增加 pending listener 注册跟踪与 `waitForEventsReady()`；`frontend/src/App.vue` 和 `useAppState` 先注册事件再读取快照，卸载逐项调用保存的 unlisten；同步 contracts/tracker/validation。没有引入 ARM64 构建或发布路径。
- 检查与结果：
  - `npm --prefix frontend run build`：退出码 0；TypeScript/Vite 生产构建通过，转换 76 个模块。
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`：退出码 0；20/20 库测试、0 doctest 通过。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi`：退出码 0；Tauri 输出 `Target: x64`，NSIS/MSI 均生成。
  - 主程序/helper PE 均为 `Machine=0x8664`；portable ZIP 条目严格为 `WinBox/WinBox.exe`（17,590,784 bytes）与 `WinBox/WinBox-updater.exe`（1,775,104 bytes）。
  - MSI `/a /qn` 管理员提取退出码 0；日志含 `Product: WinBox -- Installation completed successfully`、`MainEngineThread is returning 0`，提取目录含 `PFiles/WinBox/WinBox.exe` 与 `PFiles/WinBox/winbox-updater.exe`。
- 当前 x64 产物 SHA-256：主程序 `980029FFD0033B08F8B90F84F40F24CD0D597EB97F4CCE8859FE9ED6EDC4986F`；helper `60D4605FF5AB5E3A64B3B799C62634BCA3F12292248946217D8E4375A3067E2D`；NSIS `F4B7A376ABDDF166878CA792BD39685B619A4A9BD21FAE27B26A78970FF08D9B`；MSI `722F641263831324168CFD28D0F2B5D56D5C3E6E74C060C24CCF309D6D250D45`；portable `63FEA0BF55FF831E711597535BA14D7A0880D90F9AC685C9FE10CBEA67E59818`。
- updater `--invalid` 进程启动复核未纳入通过证据：当前受限宿主在启动带 `requireAdministrator` manifest 的显式 x64 helper 时返回 `0xc0000142`，未执行替换；路径边界由 Rust 单元检查覆盖，真实 helper/UAC 行为留给 Windows x64 桌面验收。
- 系统状态恢复：仅写入 `frontend/dist`、`src-tauri/target` 和 MSI 验证目录；未安装最终 MSI/NSIS，未修改代理/任务计划/UWP/用户数据，未签名，未发布 Release。
- 未完成/限制：真实 Tauri WebView 反复挂载、UAC、窗口/Mica/DPI、托盘、sing-box 启停/崩溃/超时、系统代理/UWP/任务计划、干净安装升级、CI 和签名仍需 Windows x64 人工/发布环境证据；ARM64 明确不在本版范围。
- 结果：初始化顺序自动检查 `pass`，最新 x64 自动 bundle/portable/MSI 提取 `pass`；V02/V03/V07/V09/V11/V12/V14/V15 的人工部分继续保持 `review/not_run`。

### MIG-022-DESKTOP-GATE-2026-09-18 — 原生 Windows 桌面验收门槛

- 操作：Computer Use `getState` 返回 `apps=[]`，仅返回 Codex in-app browser，未发现可绑定的 Windows 原生应用窗口。
- 结果：本会话不能启动或观察真实 Tauri WebView、UAC、窗口、托盘或系统设置；没有执行可能改变系统代理、任务计划、UWP 或安装状态的 UI 操作。
- 结论：V02/V03/V07/V09/V11/V12/V14/V15 继续为 `review/not_run`；需要在 Windows AMD64/x64 桌面由用户手动执行并记录系统状态。该限制不扩大支持范围，ARM64 仍不构建、不发布、不验收。

### MIG-023-X64-TEST-2026-09-18 — CI 目标 Rust 测试与 clippy

- 环境：Windows x64；`rustc 1.97.1`，host `x86_64-pc-windows-msvc`；锁文件保持不变，使用 `--locked --offline`。
- 检查：`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline` 退出码 0，20/20 库测试和 0 doctest 通过；`cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings` 退出码 0。
- 结论：精确 CI target 的自动 Rust 验证 `pass`；不替代 Tauri WebView、UAC、系统代理、真实 sing-box、安装升级和签名的 x64 实机/发布环境证据。

### MIG-024-DEPENDENCY-2026-09-18 — 前端依赖安全与最终 x64 产物

- 修改：`frontend/package.json`/`package-lock.json` 将 Vite 更新至 `8.3.0`、`@vitejs/plugin-vue` 更新至 `6.0.9`、PostCSS 更新至 `8.5.28`；通过 npm `overrides` 固定 `browserslist 4.29.0` 和 `baseline-browser-mapping 2.11.25`。未改变运行时依赖、Rust 契约或 UI 源码。
- 检查：按 CI 原命令 `npm ci --prefix frontend` 退出码 0；`npm --prefix frontend audit --json` 返回 0 vulnerabilities；`npm --prefix frontend audit --omit=dev --json` 返回 0 vulnerabilities；`npm --prefix frontend run build` 退出码 0，Vite `8.3.0` 转换 77 个模块。
- 检查：`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi` 退出码 0，输出 `Target: x64`；主程序/helper PE 均为 `Machine=0x8664`；MSI `/a /qn` 管理员提取退出码 0；portable ZIP 条目严格为 `WinBox/WinBox.exe`（17,587,200 bytes）和 `WinBox/WinBox-updater.exe`（1,773,568 bytes）。
- 当前 x64 产物 SHA-256：主程序 `70CBDDF5DC2301E0709D1C3E4C7919CC14043873E578B4D235CA23371E2DDC35`；helper `4AA72FC83D605C459F6B776DAA2EDC43DDF4AAFD6D7E89849AF3CA65B0ECB592`；NSIS `AD9121D00C72AED11BB5D0FC7B7C2B783170F00145A15E43F1346E0CCEA2F731`；MSI `5FDCA7E6C5A6FD9691337FA232D497FAD8CDE774863F69D5E5DC115D0B231AED`；portable `D1C3FA20296CDC9D4CEB399806050EE4EED57949374137AA801FF5EA0971FFC5`。
- 限制：完整依赖审计和自动构建已通过；真实 Tauri WebView/UAC、窗口/Mica/DPI、托盘、sing-box/代理/UWP/任务计划、干净安装升级、签名与 CI 运行仍需 Windows AMD64/x64 人工/发布环境验收，ARM64 不在范围内。

### MIG-025-X64-GATE-2026-09-18 — AMD64/x64 编译与 manifest 硬门槛

- 范围：确认 WinBox 只支持 Windows AMD64/x64，不为 ARM64 提供构建、发布或验收路径。
- 修改：`src-tauri/windows-app.manifest` 的公共控件依赖改为 `processorArchitecture="amd64"`；`src-tauri/src/lib.rs` 增加 `cfg` 编译期门槛，仅允许 `target_os="windows"` 且 `target_arch="x86_64"`；同步 `AGENTS.md` 的工程边界。
- 静态检查：CI matrix 只有 `amd64` / `x86_64-pc-windows-msvc`；`TargetArchitecture::from_rust_arch` 只接受 `x86_64` 并映射为 `windows-amd64`；ARM64 相关依赖锁项仅为上游跨平台依赖解析，不是本项目支持目标。
- 检查与结果：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`（20/20 库测试、0 doctest）、`cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`、`npm --prefix frontend run build` 均退出码 0；管理员上下文运行完整 `cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi --no-sign` 退出码 0，Tauri 输出 `Target: x64`。
- 产物边界：主程序 `WinBox.exe` 与 helper `winbox-updater.exe` 均为 PE `Machine=0x8664`；portable ZIP `WinBox-v2.8.0-windows-amd64.zip` 仅含 `WinBox/WinBox.exe` 与 `WinBox/WinBox-updater.exe`；管理员 `msiexec /a /qn` 返回 0，提取目录含主程序与 helper。当前哈希：主程序 `0C0A0D0A05422F5AF9EBEBEF1E8FDD21F72A07D2ED6216423CF619BAAF2FD629`；helper `FF1965740133454F491CC6B2241E02071DEABFD863A328E7A9169F2166090142`；NSIS `B986895D90CF74BA1E664F7EF81DE9EF843C948D6464A39BA56C06116C6607AE`；MSI `DC72E17837F336CDBE273BCECB1F43EF6B0745F4A9637DAAC1E6877417C181E0`；portable `11CD3BD9EC73CF0E9378A4B38977A6FFE6D4166568148F5D5B8CCBB587DEC962`。
- 环境记录：同一会话的非管理员首次 MSI 尝试曾因 WiX ICE01–ICE32 无法访问 Windows Installer Service（`LGHT0217/LGHT0216`）并在 `/a` 提取时返回 1603（2502/2503）；管理员重跑后完整命令和 MSI 提取均通过。未签名、未发布；真实桌面验收不由自动构建替代。

### MIG-026-FINAL-AUDIT-2026-09-18 — 最终静态与桌面门槛复核

- 范围：复核当前 `dev` 工作区、最新 tracker/decision/validation、x64-only 配置、活动旧栈引用、锁定依赖元数据和本地文档链接。
- 检查与结果：`git diff --check` 通过；`cargo metadata --manifest-path src-tauri/Cargo.toml --locked --offline --no-deps` 通过；迁移文档本地链接检查通过；活动源码无 `wailsjs`、`@wails`、`wails.json`、Go module、TODO/FIXME 或未实现占位；CI matrix、manifest 和 Rust compile gate 只允许 Windows AMD64/x64。
- 更新器安全路径：管理员上下文运行最新 x64 `winbox-updater.exe --invalid` 返回码 0；未替换文件、未启动主程序、未修改应用数据。
- 桌面门槛：Computer Use 当前 `apps=[]`，只有 Codex in-app browser；没有执行或伪造真实 WebView、UAC、窗口/Mica/DPI、托盘、sing-box、代理、UWP、任务计划、干净安装升级或签名/CI 发布验收。
- 结果：静态/文档审计 `pass`；V02/V03/V07/V09/V11/V12/V14/V15 的 Windows AMD64/x64 实机部分仍为 `review/not_run`，迁移目标保持 active。

### MIG-027-VERSION-TEST-2026-09-18 — 3.0.0-alpha.1 单 EXE x64 测试构建

- 范围：将应用版本统一为 `3.0.0-alpha.1`，仅为 Windows AMD64/x64 生成主程序测试 EXE；不生成安装器、portable ZIP 或 updater 成品。
- 清理：删除旧 bundle、NSIS/WiX 输出和 MSI/portable 验证目录；保留 Cargo 编译缓存与 `target/**/data`。
- 检查与结果：`npm --prefix frontend run build` 通过（Vite 8.3.0，77 个模块）；`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline` 通过；`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline` 为 20/20，0 doctest；`git diff --check` 通过。
- 产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,556,480 bytes，文件/产品版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `F8E88DB28E58BD4C23A7667875A9F180B0C10CCE2B76E7589FBB5C9C97444662`；未发现 release 目录下 updater.exe 或 bundle/nsis/msi/resources/wix 输出。
- 限制：未进行真实桌面手动运行；该证据不替代 WebView、托盘、UAC、sing-box、系统代理、安装升级、签名和发布验收。ARM64 不在范围内。

### MIG-028-ISSUE-DIAG-2026-09-19 — 内核升级与网速图表问题定位

- 范围：根据用户在 Windows AMD64/x64 测试中的两个现象进行只读源码追踪；本轮不修改业务实现。
- 内核升级定位：下载与 `stage_sing_box_archive` 有独立边界，但 `update_kernel` 对阶段错误做了通用化处理，`install_staged_file` 的首次旧文件改名直接丢弃 I/O 错误，启动新核心失败时丢弃具体 `AppError` 并只返回失败/回滚码，错误路径没有写入 app/kernel log。因此当前现象不能从 UI 判断是文件替换、核心启动、配置检查、代理恢复还是回滚失败。Windows 原生文件占用/停止竞态是待实机证据的高风险候选，不在静态检查中伪判定。
- 内核升级方案候选：不采用 `tauri-plugin-updater` 处理 sing-box；保留 Rust/Tauri command，增加阶段化错误和日志，停止并确认进程退出，暂存核心先做 `check`，使用 Windows 原生 replace/备份/重试/回滚事务，最后验证新核心存活与 traffic API。
- 网速图表定位：旧 Wails 代码会将 `0.0.0.0` 转为 `127.0.0.1`；当前 `extract_api_url` 保留 `0.0.0.0`，`runtime::traffic_url` 会尝试连接 `ws://0.0.0.0:<port>/traffic`。若用户 profile 使用通配监听地址，该路径足以导致图表没有数据。当前 Rust 对 WebSocket 连接失败、断开和 JSON `up/down` 解析失败均静默处理，故无日志是代码现状；前端 Tauri listener、camelCase DTO 和 `WSpeedChart` 数据绑定链路已存在。
- 网速图表方案候选：规范化 loopback 地址，补 Clash API secret、握手超时/重试状态和错误日志；继续复用 Rust WebSocket 到 Tauri `traffic-update` event 的单一数据链路。需实机验证不同 controller 地址和 secret 配置。
- 结果：两个问题均记录为 `diagnosed-awaiting-fix`；没有把静态候选当作最终根因，也没有修改代码或提前关闭 MIG-010/MIG-012。

### MIG-029-ISSUE-FIX-2026-09-19 — 内核升级与网速图表修复自动检查

- 任务/范围：`BUG-001`/`MIG-012` 与 `BUG-002`/`MIG-010`；按上一条定位实施最小 Rust 修复，不改变前端视觉、Tauri command 名称或 `traffic-update` DTO。
- 内核更新修改：暂存 sing-box 先用当前运行配置执行 `sing-box check`；更新过程写入 app log 的下载、暂存、检查、停止、替换、启动和回滚阶段；Windows 平台边界使用 `ReplaceFileW` 保留旧核心备份，目标不存在时使用 `MoveFileExW`，对 access denied/sharing/lock violation 做短重试；失败消息保留阶段和 OS 错误细节，启动失败恢复旧核心并重启旧核心。
- 流量修改：`0.0.0.0:<port>` 在 command 和 WebSocket URL 两层均规范化为 `127.0.0.1:<port>`；读取 `experimental.clash_api.secret` 并发送 `Authorization: Bearer`；WebSocket 连接增加 5 秒超时、1 秒受控重连，以及连接失败、超时、断开和坏 payload 的有界 app log。
- 自动检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`：退出码 0；22/22 库测试、0 doctest 通过；新增回环地址、traffic payload/鉴权 request 和 Windows 原生 staged replacement/rollback 路径检查通过。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `npm --prefix frontend run build`：退出码 0；Vite 8.3.0 转换 77 个模块。
- x64 单 EXE 测试构建：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline` 退出码 0；产物为 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,568,768 bytes，文件/产品版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `A72D8264FCACF4643D1F14EE0709CD729A5FB1121DAC520E061F193305977FCC`；release 目录没有 updater.exe 或 bundle/installer 输出。
- 未完成/限制：尚未在本会话启动真实 Tauri WebView、真实 sing-box 配置和 Windows 桌面流量 API；因此没有把替换文件锁、真实新核心启动、Clash secret、`traffic-update` 到图表的实机行为伪记为通过。需在 Windows AMD64/x64 测试 EXE 上人工复测；ARM64 不构建、不发布、不验收。
- 系统状态恢复：自动检查只写入工作区源文件、`frontend/dist` 和 `src-tauri/target`；未修改系统代理、任务计划、UWP、用户数据或发布状态。
- 结果：代码与自动检查 `pass`；BUG-001、BUG-002 保持 `fixed-awaiting-retest`，MIG-010/MIG-012 继续 `review`。

### MIG-030-ISSUE-FIX-2026-09-19 — 用户日志根因修复与 x64 单 EXE 复核

- 触发：用户在 Windows AMD64/x64 测试 EXE 上提供了两条明确日志。内核更新在下载完成后报 `ZIP archive exceeds the size limit`；流量连接反复报 `Missing, duplicated or incorrect header sec-websocket-key`。
- 根因：官方 `sing-box 1.14.1` x64 ZIP 约 32.8 MB，解压后的 `sing-box.exe` 约 81.9 MB；旧 64 MiB 是声明解压内容上限而非压缩包大小，导致更新在暂存阶段提前失败。流量代码自建 WebSocket `Request`，绕过了 tungstenite 标准握手头生成，缺少 `Sec-WebSocket-Key`。
- 修改：声明解压内容上限调整为 128 MiB，压缩包仍保持 64 MiB 上限，并分别返回超限错误；便携 ZIP 分支也统一使用解压内容超限错误。删除手工 WebSocket 握手构造，使用 `IntoClientRequest` 生成标准请求，仅追加配置中的 Bearer secret。loopback 映射、5 秒连接超时、受控重连、有界日志、暂存 `sing-box check`、Windows 原生替换/回滚未改变。
- 清理：没有继续保留无调用的旧请求构造；未新增依赖、轮询、事件桥或 updater 插件。此次修复没有改变前端视觉、交互和 `traffic-update` DTO。
- 检查与结果：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`：通过；23/23 库测试、0 doctest。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`：通过。
  - `npm --prefix frontend run build`：通过；Vite 8.3.0 转换 77 个模块。
  - x64 单 EXE 构建：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline`；仅生成主程序，PE `Machine=0x8664`，版本 `3.0.0-alpha.1`。
- 产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,587,200 bytes，文件/产品版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `F5F995482EEB1B4C83BD44CD6E45DC77A99C441A040D8FC45C20873AB149EDAB`；该 release 目录仅有 `WinBox.exe`，未生成 updater.exe、bundle、NSIS、MSI 或 portable 成品。
- 限制：本会话没有可绑定的原生 Tauri WebView，未能自动执行真实 sing-box 更新替换、Clash traffic WebSocket 和 Vue 图表回归；不能把自动检查等同于人工复测。ARM64 不构建、不发布、不验收。
- 结果：代码与自动检查通过；BUG-001、BUG-002 保持 `fixed-awaiting-retest`，MIG-010/MIG-012 继续 `review`，等待用户在新 x64 单 EXE 上复测。

### MIG-031-ISSUE-RETEST-2026-09-19 — 用户 Windows x64 复测通过

- 范围：BUG-001 内核升级和 BUG-002 主界面网速图表。
- 证据：用户确认使用本轮 `3.0.0-alpha.1` Windows AMD64/x64 单 EXE 测试通过，内核升级与网速图表两个问题均已解决。
- 结果：BUG-001、BUG-002 状态更新为 `resolved`；MIG-010/MIG-012 保持 `review`，仅剩阶段级其他验收条件，不把两个问题的关闭扩大为整阶段完成。

### MIG-032-WINDOW-FIX-2026-09-19 — 窗口、主题与拖动修复自动检查

- 日期/分支/状态：2026-09-19；`dev`；基线提交 `cf6ad6c`，工作区包含本次未提交修改。
- 环境：Windows x64；目标 `x86_64-pc-windows-msvc`；Rust `1.97.1`；Node `v26.1.0`；npm `11.13.0`；Vite `8.3.0`；仅验证 AMD64/x64，不构建 ARM64。
- 修改：窗口控制从前端 window API 改为已有 Rust command；新增统一 `set_window_theme`；启动主题从保存设置应用；窗口增加 `center: true`；capability 仅增加 `core:window:allow-start-dragging`；扩大左侧拖动区并保持右侧按钮独立；托盘组件、模式动态图标和交互路径未改。
- 自动检查：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`：退出码 0；24/24 库测试、0 doctest；新增 light/dark/system 与 Mica 映射检查通过。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `npm --prefix frontend run build`：退出码 0；Vite 8.3.0 转换 74 个模块。
  - `src-tauri/tauri.conf.json` 与 `src-tauri/capabilities/default.json` JSON 解析：通过；`git diff --check`：通过（仅 Git 的 LF/CRLF 提示）。
  - x64 单 EXE：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline`：退出码 0。
- 产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,588,736 bytes，SHA-256 `A696D3B99A6AFA9D87B5A94EF0263ECCDECC5516B5E03BC1EF1DC5BED4BFFE1C`；版本保持 `3.0.0-alpha.1`；未生成 updater、安装器、portable ZIP 或 ARM64 成品。
- 桌面检查：Computer Use `getState` 仅返回 Codex in-app browser（`apps=[]`），没有可绑定的原生 Tauri 窗口；未执行窗口拖动、初始位置、最小化、托盘、Mica、单实例、UAC 或 DPI 实机动作，未改变系统状态。
- 结果：自动检查 `pass`；BUG-003 为 `fixed-awaiting-retest`，MIG-006 保持 `review`，等待 Windows AMD64/x64 测试 EXE 人工验收。

### MIG-033-ISSUE-DIAG-2026-09-19 — 托盘应用重启竞态定位

- 范围：`BUG-004`、`MIG-009`、V03/V09；本轮只读诊断，不修改代码。
- 证据：当前托盘 `restart-app` 回调同步运行在 Tauri 主线程并调用 `AppHandle::restart()`；本地锁定的 Tauri `2.11.5` 源码 `src/app.rs` 明确写明，主线程调用 `restart()` 会跳过 `RunEvent::ExitRequested`，直接执行 `cleanup_before_exit()` 后重启；`lib.rs` 的项目清理只注册在 `RunEvent::ExitRequested` 中并调用 `shutdown_runtime`。
- 结论：连接状态下该路径不会执行 `stop_core_impl`，因此无法等待/结束 sing-box，也不会取消 traffic task 或恢复由本次运行接管的代理；这解释了重启后旧 sing-box PID 残留。现有 `CoreProcess::stop` 不是本次首要根因。
- 候选修复：使用 `AppHandle::request_restart()` 并保留 `Result<(), AppError>` 的 `Ok(())` 返回，让 Tauri 事件循环先触发现有清理链；不新增依赖或第二套 shutdown 路径。
- 结果/限制：没有执行修复构建或桌面进程测试；BUG-004 保持 `diagnosed-awaiting-fix`。修复后必须在 Windows AMD64/x64 连接状态下验证旧 PID 退出、重启后单核心、代理恢复和流量停止/恢复。

### MIG-034-ISSUE-FIX-2026-09-19 — 托盘应用重启清理修复

- 范围：`BUG-004`、`MIG-009`、V03/V09；修复托盘 `Restart APP` 绕过退出清理的问题。
- 修改：`commands::restart` 使用 `AppHandle::request_restart()`，随后显式返回 `Ok(())`；保留现有 `RunEvent::ExitRequested` → `shutdown_runtime` → `stop_core_impl` 链路，不新增依赖、线程或第二套进程管理。
- 自动检查：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`：通过，24/24 库测试、0 doctest。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`：通过。
  - `npm --prefix frontend run build`：通过；Vite 转换 74 个模块。
  - 重启入口静态检查：确认 `request_restart` 与 `Ok(())` 同时存在，未残留直接 `app.restart()` 调用。
  - x64 单 EXE：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline` 通过；版本 `3.0.0-alpha.1`，SHA-256 `1BCD3E1BD88C3EA84B48D1E503D7E0EA75DAFAD4DAA7FD34CCE7C9E1DF2C59BB`。
- 限制：未生成安装器、portable ZIP 或 ARM64 产物；当前会话没有可绑定的原生 Tauri 窗口，真实托盘重启、sing-box PID、代理和流量恢复仍需 Windows AMD64/x64 人工复测。BUG-004 为 `fixed-awaiting-retest`。

### MIG-035-ISSUE-DIAG-2026-09-19 — 托盘应用重启未重新拉起

- 范围：`BUG-004`、`MIG-009`、V03/V09；本轮只做原因和成本评估，不修改业务代码。
- 用户证据：当前 `request_restart()` 版本执行托盘 `Restart APP` 后，sing-box 先退出，WinBox 主程序没有自动重新出现。
- 定位：`request_restart()` 已触发项目的 `RunEvent::ExitRequested` 和 `shutdown_runtime`，所以 sing-box 清理部分已生效。之后 Tauri 2.11.5 在 `RunEvent::Exit` 中调用内部 `process::restart()`，使用 `current_exe` 与原始启动参数执行 `Command::spawn()`；spawn 失败只写 Tauri 内部日志。当前源码无法把该错误写入 WinBox app.log，也无法确认新进程是否因 `-minimized` 隐藏或因启动后立即退出而被误判为未启动。
- 排除/未证实：single-instance Windows 插件在 `RunEvent::Exit` 回调中释放 mutex，按本地源码顺序早于 Tauri 的 relaunch；因此单实例不是当前已确认根因，但仍需 x64 进程级测试排除。
- 成本：删除菜单、command 注册/实现和未使用前端 API 属于低成本；保留则需要受控 Windows relaunch、错误可观测性、启动参数处理和单实例/退出时序的中等规模改动，并必须人工复测真实 PID、窗口、托盘和管理员权限行为。
- 结论：`Restart Core` 已覆盖内核重启，程序更新已有 helper 负责更新后启动；当前没有前端调用者的 `Restart APP` 不是核心需求。按 ponytail 最小实现原则，已按用户决定删除该入口；核心重启并发审计转入 `MIG-036-CORE-RESTART-AUDIT-2026-09-19`。

### MIG-036-CORE-RESTART-AUDIT-2026-09-19 — 内核重启并发审计与清理

- 范围：`MIG-009`、BUG-004 后续处置、V03/V07/V09；删除应用级重启入口并复核核心重启的调用链和竞态边界。
- 修改：移除托盘 `Restart APP`、`commands::restart` 注册/实现和未使用的前端 `Restart` API；保留托盘与主界面的 `Restart Core`。将 `restart_core_impl` 的 `runtime.core()` 检查移入 `RuntimeState.operation` 锁内，避免与停止、模式切换、profile 切换、更新或另一条重启请求并发时使用过期状态；前端按钮在 IPC 调用前立即设置 processing，过滤事件回传前的重复点击，失败结果明确切换到错误状态。
- 审计结论：
  - 托盘和前端都进入同一个 `restart_core_impl`，不复制停止/启动逻辑。
  - `apply_state`、`toggle_service`、profile 切换、内核更新、自动启动和 `shutdown_runtime` 均先取得同一操作锁，再调用 `stop_core_impl`/`start_core_impl`。
  - 核心监视器用旧核心的 `Arc` 身份执行 `clear_core_if`，旧进程退出时不会清掉随后建立的新核心；停止路径先取消 traffic task、等待进程退出，再恢复由本次运行接管的代理。
  - 未新增依赖、线程、launcher 或第二套生命周期清理链。
- 自动检查：
  - `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`：退出码 0。
  - `cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`：退出码 0；24/24 库测试、0 doctest。
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`：退出码 0。
  - `npm --prefix frontend run build`：退出码 0；Vite 8.3.0 转换 74 个模块。
  - 静态入口检查：源码仅保留 `restart_core` 与 `restart_core_from_tray`，未残留 `restart-app`、`commands::restart`、`request_restart` 或前端 `Restart` API。
  - x64 单 EXE：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline`：退出码 0；PE `Machine=0x8664`，版本 `3.0.0-alpha.1`，产物 17,583,104 bytes，SHA-256 `8DB6C2AF5A454408A7A3C221406FA07A547D9E6A7C2476A3F48F79D197BBB0FD`。
- 限制：当前会话无法替代真实 Windows AMD64/x64 桌面进程验收；仍需人工快速连续点击界面/托盘 `Restart Core`，确认始终只有一个 sing-box PID、代理恢复、traffic 重连且失败时状态不伪报运行。ARM64 不构建、不发布、不验收。

### MIG-037-CORE-RESTART-RECHECK-2026-09-19 — 核心重启生命周期复核

- 范围：`MIG-009`、BUG-004 后续处置、V07/V09；复核核心监视器、重启时序和启动失败清理。
- 复核发现：旧核心监视器在未持有生命周期锁时执行身份清理后再停止 traffic；若与重启建立新核心交错，理论上可能停止新核心的 traffic task。
- 修复：监视器在 `clear_core_if`、traffic 停止和代理恢复前取得 `RuntimeState.operation`；重启/停止/更新释放锁后，旧监视器按 `Arc` 身份重新确认，当前已是新核心时不执行旧清理。
- 修复：`start_core_impl` 在核心已创建但代理状态读取/持久化或输出通道初始化失败时显式停止未登记核心，再恢复代理状态并返回错误。
- 修复：自动连接网络探测结束后重新读取快照并检查 `RuntimeState.core()`；若探测期间已有启动操作完成，则跳过自动启动，避免第二个核心。
- 自动验证：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`（24/24、0 doctest）、`cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`、`npm --prefix frontend run build` 均通过；未构建 ARM64。
- x64 单 EXE：`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline` 退出码 0；`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,589,248 bytes，文件/产品版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `4B44D385A0CF956601A8ECE73E0255489D9CD62A448B20762CB1ED73C3F3DEB2`；未生成 updater、安装器、portable ZIP 或 ARM64 成品。
- 结果：代码与自动检查 `pass`；仍需 Windows AMD64/x64 实机快速点击界面/托盘 `Restart Core`，确认单一 sing-box PID、代理恢复、traffic 重连和失败状态。
