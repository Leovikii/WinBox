# 迁移进度与交接台账

唯一进度来源。初始化日期：2026-09-16。迁移实现已覆盖 Rust/Tauri 后端、Vue API、Windows 平台边界和核心生命周期；本版只支持 Windows AMD64/x64，ARM64 已排除，不构建、不发布、不作为阻塞或验收条件。MIG-042 的 NSIS/updater 最终发行收尾已实施；BUG-009 模式持久化问题已由用户实测确认解决，MIG-009 与 MIG-042 的其他阶段验收仍待完成。`review` 项不能以编译替代实机验收。

## 状态规则

`todo` → `in_progress` → `review` → `done`；缺外部条件时 `blocked`，记录原因和恢复条件。`done` 必须满足验收条件并关联 validation 证据。负责人 `—` 表示未认领；提交 `—` 表示尚无关联提交，不能填写虚构 hash。

## 任务

| ID | 阶段/任务 | 依赖 | 状态 | 负责人 | 验收条件/证据要求 | 提交/阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-001 | 建立批准后的完整文档与 agent 规则 | 用户批准 | done | 本次文档 agent | 含前端补充要求、计划/契约/决策/台账/验收；DOC-V1 | 未提交工作区 |
| MIG-001 | P0 环境、行为、数据与视觉基线 | DOC-001 | review | Codex / 2026-09-17 | V01、V02；全调用盘点和脱敏 fixture 索引 | `MIG-001-BL-2026-09-17`；代码/构建基线已记录，V02 截图与实机行为待复核 |
| MIG-002 | P0 插件/依赖与发行路径选型 | MIG-001 | review | Codex / 2026-09-17 | D01–D10 有版本/来源/许可与验证记录；Q01–Q04 明确 | `MIG-002P0-2026-09-17`、`MIG-018-FINAL-2026-09-18`、`MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-IMPLEMENTATION-2026-09-20`；最终方向为 x64 NSIS + 官方 updater，Tauri CLI/签名资产自动验证通过，GitHub Action/Release 仍待外部验收 |
| MIG-002-a | P0 Tauri 2 核心/官方插件编译原型 | MIG-001（环境与源码盘点已具备；V02 视觉基线不影响本编译原型） | done | Codex / 2026-09-17 | D01/D02 精确版本、来源/许可和锁文件；最小壳 cargo check/test/clippy | `MIG-002A-2026-09-17`；仅完成 x64 编译原型，运行时、前端接入、发行配置和其余 P0 选型仍待验证 |
| MIG-003 | P0 Windows 权限/自启/进程原型 | MIG-001, MIG-002 | done | Codex / 2026-09-17 | V03、V07、V09、V11 原型证据，限制明确 | `MIG-003-PROT-2026-09-17`；原型验收完成；管理员实机与真实 sing-box 行为转 V11/V09 实机复核 |
| MIG-004 | P0 数据/更新兼容原型与阶段结论 | MIG-002, MIG-003 | done | Codex / 2026-09-17 | Q01–Q05 结论；V05、V13、V14 原型证据；P0 门槛满足 | `MIG-004-PROT-2026-09-17`；原型验收完成；真实下载/签名/替换回滚/升级链转 MIG-012–014，ARM64 已排除 |
| MIG-005 | P1 工程、API/DTO、前端接入简化 | MIG-004 | review | Codex / 2026-09-17 | V01、V04；契约和所有调用者同步，无发行 mock | `MIG-005-FINAL-2026-09-18`；全量 command、Tauri invoke/listen、统一错误和调用者已接入，真实 WebView 证据待复核 |
| MIG-005-a | P1 前端 API 边界与临时兼容适配 | MIG-004 | done | Codex / 2026-09-17 | Tauri API 只有单一业务入口，前端构建通过 | `MIG-005-FINAL-2026-09-18`；已删除 Wails 适配和生成目录 |
| MIG-006 | P1 窗口/托盘/主题/单实例 | MIG-005 | review | Codex / 2026-09-19 | V02、V03；桌面效果及行为对等 | `MIG-006-FINAL-2026-09-18`、`MIG-032-WINDOW-FIX-2026-09-19`；窗口 command 权限、居中、拖动区和应用主题材质已修复并通过自动检查，待 x64 实机证据 |
| MIG-007 | P2 存储、兼容字段与设置 | MIG-006 | review | Codex / 2026-09-18 | V05；可恢复、幂等、写入失败可见 | `MIG-007-FINAL-2026-09-18`；Rust storage、默认值、未知字段保留和原子写入通过单元检查，文件占用/跨文件恢复待实机；旧单 EXE 数据迁移不属于实现范围 |
| MIG-008 | P2 订阅/配置转换/日志接口 | MIG-007 | review | Codex / 2026-09-18 | V06、V08；配置与日志行为通过 | `MIG-008-FINAL-2026-09-18`、`MIG-038-CONFIG-HTTP-FIX-2026-09-19`、`MIG-039-LOG-TIME-2026-09-19`、`MIG-040-ISSUE-RETEST-2026-09-19`；profile、override、日志、时间格式、会话清理、轮转、sing-box check 和下载边界已实现，配置更新与日志/时间场景已由用户在 Windows x64 复测通过，阶段其余验收仍保持 review |
| MIG-009 | P3 内核生命周期、三种模式、状态 | MIG-008 | review | Codex / 2026-09-19 | V07、V09；并发/失败状态收敛 | `MIG-009-FINAL-2026-09-18`、`MIG-020-LIFECYCLE-2026-09-18`、`MIG-036-CORE-RESTART-AUDIT-2026-09-19`、`MIG-037-CORE-RESTART-RECHECK-2026-09-19`、`MIG-043-MODE-PERSISTENCE-2026-09-21`；停止后用户模式保持问题已由用户实测确认解决，真实 sing-box 与其他 V07/V09 场景仍待 x64 复核 |
| MIG-010 | P3 流量、日志流、智能连接 | MIG-009 | review | Codex / 2026-09-18 | V08、V10；可取消、断线恢复、无重复监听 | `MIG-010-FINAL-2026-09-18`、`MIG-028-ISSUE-DIAG-2026-09-19`、`MIG-029-ISSUE-FIX-2026-09-19`、`MIG-030-ISSUE-FIX-2026-09-19`、`MIG-031-ISSUE-RETEST-2026-09-19`；图表问题已由用户在 x64 单 EXE 上复测通过，阶段其余 V08/V10 外部验收仍保持 review |
| MIG-011 | P3 系统代理、自启、权限、UWP | MIG-009, MIG-010 | review | Codex / 2026-09-18 | V09、V11、V12 实机证据 | `MIG-011-FINAL-2026-09-18`、`MIG-020-LIFECYCLE-2026-09-18`；平台命令、manifest、任务计划和 UWP 差异更新已实现，管理员系统状态待实机 |
| MIG-012 | P4 内核更新 | MIG-011 | review | Codex / 2026-09-18 | V13；失败恢复二进制/配置/状态 | `MIG-012-KERNEL-2026-09-18`、`MIG-028-ISSUE-DIAG-2026-09-19`、`MIG-029-ISSUE-FIX-2026-09-19`、`MIG-030-ISSUE-FIX-2026-09-19`、`MIG-031-ISSUE-RETEST-2026-09-19`；解压预算问题已由用户在 x64 单 EXE 上复测通过，阶段其余 V13 外部验收仍保持 review |
| MIG-013 | P4 应用更新与旧客户端过渡 | MIG-012 | review | Codex / 2026-09-18 | V14；NSIS 行为、手动数据说明、签名、恢复实证 | `MIG-013-FINAL-2026-09-18`、`MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-IMPLEMENTATION-2026-09-20`；旧 portable helper 方案已被 MIG-042 替代，官方 updater/NSIS 代码与签名构建已完成，桌面跨版本验收待执行 |
| MIG-014 | P4 CI 与发行产物演练 | MIG-013 | review | Codex / 2026-09-18 | V15；x64 NSIS 构建/运行分别记录 | `MIG-014-BUNDLE-2026-09-18`、`MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-IMPLEMENTATION-2026-09-20`；workflow 已改为 x64 NSIS，unsigned/signed 本地构建与资产模拟通过，GitHub Action/Release 待外部验收 |
| MIG-015 | P5 视觉/交互/性能/故障全量回归 | MIG-014 | review | Codex / 2026-09-18 | V01–V16；无发布阻断风险 | `MIG-015-FINAL-2026-09-18`、`MIG-041-RELEASE-PREP-2026-09-19`；自动检查和远程 changelog 安全边界通过，真实 WebView/管理员/网络/发布更新仍待复核 |
| MIG-016 | P5 移除旧栈与临时适配 | MIG-015 | review | Codex / 2026-09-18 | V17；新环境可独立构建，无活动 Wails 或自定义应用 updater 依赖 | `MIG-014-BUNDLE-2026-09-18`、`MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-IMPLEMENTATION-2026-09-20`；Go/Wails、自定义应用 updater 和旧 helper 活动代码已删除，静态扫描通过 |
| MIG-017 | P5 最终文档、台账和交接 | MIG-016 | review | Codex / 2026-09-18 | V18；文档与最终 NSIS/updater 代码一致，总体验收满足 | `MIG-018-FINAL-2026-09-18`、`MIG-019-BUNDLE-2026-09-18`、`MIG-020-BUNDLE-2026-09-18`、`MIG-021-INIT-ORDER-2026-09-18`、`MIG-023-X64-TEST-2026-09-18`、`MIG-024-DEPENDENCY-2026-09-18`、`MIG-025-X64-GATE-2026-09-18`、`MIG-026-FINAL-AUDIT-2026-09-18`、`MIG-027-VERSION-TEST-2026-09-18`、`MIG-040-ISSUE-RETEST-2026-09-19`、`MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-IMPLEMENTATION-2026-09-20`；最终文档与自动验证完成，真实桌面/Release 证据待外部验收 |
| MIG-042 | P5 最终发行收尾：NSIS、官方 updater 与安装数据 | MIG-017 | review | Codex / 2026-09-20 | V05、V14、V15、V19；x64 一键 NSIS 安装/升级/卸载、默认路径无选择页、安装目录最小清单、数据目录隔离、人工数据说明、官方签名更新、统一退出清理和 main Release 证据 | `MIG-042-RELEASE-PLAN-2026-09-19`、`MIG-042-INSTALL-DATA-SCOPE-2026-09-20`、`MIG-042-IMPLEMENTATION-2026-09-20`、`MIG-042-UPDATE-CHECK-2026-09-20`；代码、NSIS、workflow 和自动检查通过；真实安装/升级/卸载、CI secrets/main Release、官方应用内跨版本更新仍需外部验收 |

依赖代表阶段门槛；同阶段若实际可独立工作，可在解释依赖后细分任务，不必建立新的管理系统。子任务使用 `MIG-xxx-a`，不得将未验证项隐藏在父任务 done 下。

## 当前阻塞

当前没有迁移代码实施阻塞；MIG-042 的代码与自动验证已完成，进入外部 review。当前最终配置只使用 x64 NSIS 和官方 updater，MIG-041 portable-only 内容仅保留为历史记录。私钥不得入库，GitHub Actions secrets、main Release、真实安装/升级/卸载和应用内更新仍需外部验收；Linux/ARM64 不属于本版范围。未完成外部验收不等于 blocked。

| 日期 | 任务 | 实际阻塞 | 恢复条件 | 可继续工作 |
| --- | --- | --- | --- | --- |
| 2026-09-18 | MIG-006/011–015 | Computer Use 当前仅返回浏览器、没有可绑定的原生窗口；管理员 Tauri WebView、真实 sing-box 和 x64 桌面实机证据仍缺 | 在 x64 桌面启动最终 NSIS 产物并保存窗口、系统状态、核心和更新证据 | 用户手动测试最终 NSIS；MIG-042 完成后合并 PR 到 `main` |
| 2026-09-19 | MIG-042 | 尚未配置 updater public key/private key；当前 workflow 和代码仍是旧 portable 草案，不能执行正式签名 Release | 实施官方 updater、配置 GitHub Actions secrets，并完成 Windows x64 NSIS/应用内更新验收 | 用户提供/配置签名材料后继续；预更新选择复用既有 `pre_release`，不需要新增 channel；旧数据由用户按发行说明自行处理 |
| 2026-09-20 | MIG-042 | 当前 GitHub Release 仍只有旧 portable ZIP，稳定版及旧预发布版均无 `latest.json`；本机不能替代 GitHub secrets/main Release 及真实安装/升级/卸载桌面证据 | 合并 dev PR 到 `main`，由 workflow 生成 NSIS、签名和 `latest.json`；之后在 Windows x64 验收安装器、更新、退出清理和数据目录 | 当前无 metadata 应显示 `Latest`；正式 updater 跨版本链仍等待 main Release；不提交私钥、不在本机发布 Release |

## 问题台账

| ID | 范围 | 状态 | 当前定位 | 暂定解决方向 / 下一步证据 |
| --- | --- | --- | --- | --- |
| BUG-001 / MIG-012 | 内核升级 | `resolved` | 用户日志已确定下载成功后在暂存阶段失败：错误为 `ZIP archive exceeds the size limit`。官方 `sing-box 1.14.1` x64 ZIP 约 32.8 MB，但解压后的 `sing-box.exe` 约 81.9 MB；旧 64 MiB 解压上限误拒绝当前核心，因此替换阶段实际尚未执行。现已将声明解压上限调整为 128 MiB，并区分压缩包/解压内容超限；此前增加的 `sing-box check`、阶段日志、`ReplaceFileW` 备份交换、锁冲突短重试和启动失败回滚继续保留，因为它们覆盖后续真实失败路径。用户已确认 Windows x64 测试通过。 | `MIG-031-ISSUE-RETEST-2026-09-19`；问题关闭，继续由 MIG-012 的整体 V13 验收覆盖回归。仍不引入不适配独立 sing-box 的 `tauri-plugin-updater`。 |
| BUG-002 / MIG-010 | 主界面网速图表 | `resolved` | 用户日志已确定连接失败的直接原因：`Missing, duplicated or incorrect header sec-websocket-key`。此前自建 WebSocket `Request` 绕过了 tungstenite 标准握手头生成，缺少 `Sec-WebSocket-Key`；现已删除手工握手构造，改用 `IntoClientRequest`，仅追加已有配置中的 Bearer secret，并保留 loopback 映射、5 秒连接超时、受控重连和有界日志。用户已确认 Windows x64 测试通过。 | `MIG-031-ISSUE-RETEST-2026-09-19`；问题关闭，继续由 MIG-010 的整体 V08/V10 验收覆盖回归。保持 Rust WebSocket→Tauri event→Vue chart 单链路。 |
| BUG-003 / MIG-006 | 窗口拖动、最小化、初始位置与浅色材质 | `fixed-awaiting-retest` | 前端直接调用的窗口 API 未纳入当前 capability，错误未展示；窗口未配置居中；拖动属性只覆盖标题文字；启动始终使用跟随系统的 Mica，不能表达应用浅/深主题。已改为 Rust command 统一处理窗口控制和 `Theme`/`MicaLight`/`MicaDark` 映射，增加居中配置并扩大左侧拖动区。 | `MIG-032-WINDOW-FIX-2026-09-19`；自动检查通过，等待 Windows x64 测试 EXE 复核拖动、最小化、居中、主题材质、托盘和单实例；不改变托盘动态图标/模式菜单。 |
| BUG-004 / MIG-009 | 托盘 Restart APP 后 sing-box 残留及应用未重新拉起 | `resolved` | 已删除无可靠 relaunch 保障且无前端调用者的 `Restart APP` 托盘入口、Rust command/API；不再存在该失败路径。`Restart Core` 保留并统一经过 `RuntimeState.operation` 锁和既有 stop/start 清理链，监视器清理也在同一锁内完成。 | `MIG-035-ISSUE-DIAG-2026-09-19`、`MIG-036-CORE-RESTART-AUDIT-2026-09-19`、`MIG-037-CORE-RESTART-RECHECK-2026-09-19`；自动检查通过，真实 Windows x64 下仍需确认核心重启的单 PID、代理恢复和快速重复操作行为。 |
| BUG-005 / MIG-008 | 配置下载 UA 与失败日志缺失 | `resolved` | 迁移后的共享 `reqwest` 客户端发送 `WinBox/2.8`，远端配置下发服务要求 `sing-box`，导致添加/更新配置失败；`add_profile`、`update_active_profile`、程序更新和版本检查的失败早退没有统一写入 `app.log`，非 2xx 状态也被丢弃。现已统一使用 `sing-box`，远程操作失败写入 `RuntimeState` app log，保留 HTTP 状态码并对配置校验错误脱敏。用户已在 Windows AMD64/x64 测试 EXE 上确认配置更新通过。 | `MIG-038-CONFIG-HTTP-FIX-2026-09-19`、`MIG-040-ISSUE-RETEST-2026-09-19`；问题关闭，继续由 MIG-008 的整体 V06 验收覆盖回归；不记录 URL、响应正文或配置内容。 |
| BUG-006 / MIG-039 | 时间格式、启动日志清理与日志轮转遗漏 | `resolved` | 迁移后应用日志和 `Profile.updated` 写入 Unix 秒数；Tauri 启动未清空 `app.log`/`core/box.log`，缺少旧版启动/退出记录，应用日志也没有 10 MiB/5 归档轮转。Rust 现已使用跨平台本地时间格式化，启动在异步自动连接前清空当前日志并写入启动记录，正常退出写入退出记录，恢复轮转；前端兼容迁移期间已写入的 Unix 秒/毫秒值和旧日期字符串。用户已在 Windows AMD64/x64 测试 EXE 上确认重启后日志清理、日志时间和配置更新时间显示正常。 | `MIG-039-LOG-TIME-2026-09-19`、`MIG-040-ISSUE-RETEST-2026-09-19`；问题关闭，继续由 MIG-008 的整体 V06/V08 验收覆盖回归；Linux 不在本版构建/验收范围。 |
| BUG-007 / MIG-012 | 无活动配置时内核更新暂存失败 | `fixed-awaiting-retest` | `check_staged_core` 原先无条件要求活动 profile，所以没有选择配置时在执行核心检查前报 `No active configuration selected`。现在无活动 ID 时验证暂存核心 `sing-box version` 成功；已有选择时仍生成运行配置并执行 `sing-box check`，损坏/缺失配置仍拒绝更新。 | `MIG-042-UPDATE-CHECK-2026-09-20`；Rust 回归检查通过，等待用户在 Windows x64 无活动配置状态下复测内核更新。 |
| BUG-008 / MIG-013 | 旧 Release 缺少 updater metadata 导致应用更新检查报错 | `fixed-awaiting-retest` | 只读 GitHub Release 查询确认当前 `v2.8.0` 与旧预发布资产只有 portable ZIP，没有 `latest.json`；代码也曾将预发布列表第一项（稳定版）误作预发布。现按 `prerelease=true` 筛选，并检查所选 Release 的 `latest.json`；缺少时返回本机版本，不调用 updater，前端现有同版本分支显示 `Latest`。 | `MIG-042-UPDATE-CHECK-2026-09-20`；当前无 metadata 情况已自动覆盖，等待用户验证 UI；正式签名跨版本更新要等 main workflow 发布带 metadata 的 Release。 |
| BUG-009 / MIG-009 | 停止服务后启动模式复位为默认 Proxy | `resolved` | 共享 `apply_state(false,false)` 成功停止后将 `tun_mode`、`sys_proxy` 一并写成 false；前端将空状态解释成默认 Proxy。现停止路径只停止核心并同步保留模式；离线模式选择与默认 Proxy 持久化改为等待结果，失败可见并回滚选择。用户已确认实测问题解决。此前被旧路径清成 `false/false` 的记录无法反推出历史模式，需由用户重新选择。 | `MIG-043-MODE-PERSISTENCE-2026-09-21`；自动验证及用户实测均通过；BUG-009 关闭，MIG-009 其他 V07/V09 验收仍保持 review。 |

BUG-001/BUG-002/BUG-005/BUG-006 已由用户确认解决；BUG-009 已由用户实测确认解决；BUG-003、BUG-007、BUG-008 仍等待对应桌面复测；BUG-004 已通过删除失效的应用重启入口关闭。核心重启的生命周期回归继续由 MIG-036、MIG-037 和 MIG-009 覆盖；MIG-006/MIG-009/MIG-010/MIG-012 仍保持 `review`，因为阶段级验收还包含其他桌面与生命周期条件。

## 交接日志

### 2026-09-16 — 文档初始化

- 用户批准原计划，并明确前端可依据新后端优化、简化，保持样式、视觉与交互逻辑。
- 已完成：根 AGENTS.md 及七份迁移文档；旧命令/事件/文件契约初始盘点；阶段任务、决策、风险与验收矩阵。
- 代码基线：`3b5eef88a252206cf82db4752999a6e0054c0795`；无迁移实现，未执行 Go/Rust/前端构建或 Windows 功能测试。
- 技术证据：本会话已读取官方 autostart 源码及 updater/shell README；仅能支持候选与限制判断，不证明插件对本项目可用。
- 文档证据：DOC-V1，见 validation；文件尚未提交。
- 下一步：MIG-001，复现 Wails 基线并采集视觉/交互/数据样本，然后进行 P0 选型与边界原型。

### 后续交接模板

日期 / agent / 任务 ID；完成的具体行为；修改文件与提交；检查命令、环境与证据 ID；失败或未验证项；决策变化；下一项可直接执行的操作。对敏感配置使用脱敏样本，不在台账粘贴真实订阅 token。

### 2026-09-17 — MIG-001 进行中 / Rust storage core 起步

- 完成：确认 `dev` 分支和干净基线；盘点 Go/Wails 后端入口、前端 Backend 调用、事件与旧数据布局；新增 `src-tauri` Rust core 的路径、模型、JSON 存储和原子单文件写入；保留未知字段、拒绝非法覆盖 JSON 和受控 profile 路径。
- 修改：`.gitignore`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/src/{lib,models,paths,storage}.rs`、本台账及关联 contracts/decisions/validation 文档。
- 证据：`MIG-001-BL-2026-09-17`；Go `go test ./...`、前端 `npm run build`、Wails x64 构建、Rust `cargo fmt --check`/`cargo test`（6/6）/`cargo clippy -D warnings` 均有记录；Wails 产物 SHA-256 为 `8248F4CE63289B7BFD37B02523DD0ED442F2C0C271EDA65A0C9F0DB57D141615`。
- 未完成/限制：没有 Tauri 壳、IPC、Windows 进程/代理/自启实现；V02 视觉与 Windows 行为未执行；仅 x64 toolchain，ARM64 已排除；多文件 journal 记录为 DEFER-004。
- 下一步：完成 P0 调用/数据/视觉 fixture 与 Tauri/Windows 关键能力选型，再把 Rust storage 接到 Tauri 初始化和类型化 command；不要删除 Go/Wails 参考实现。

### 2026-09-17 — MIG-002-a 完成 / Tauri 编译原型

- 完成：核对稳定 Tauri 2 版本，锁定 `tauri 2.11.5`、`tauri-build 2.6.3`、single-instance `2.4.4`、opener `2.5.5`；新增最小 `src-tauri` binary/build/config/capability，setup 挂载 Rust storage，复用现有 Windows 图标；入口补齐旧 `-minimized`/`-delay-start` 参数解析和 1.5 秒延迟。
- 验证：`cargo check --locked`、`cargo test --locked`（8 个测试通过，含 2 个启动参数测试）、`cargo clippy --all-targets --locked -- -D warnings` 均通过；首次检查缺少 icon 的失败已修复，未引入额外图标依赖。
- 未完成/限制：bundle 暂停、前端仍是 Wails、无 command/事件/托盘/Mica/管理员 manifest/实机运行；`cargo-tauri` 和 Tauri npm API 尚未安装；依赖选型父任务仍未完成。以上不影响该编译原型子任务结项。
- 下一步：继续完成 D03–D10/Q01–Q05 的 P0 验证；P0 门槛明确后再把前端改为 Tauri API，并同步 DTO、caller 和事件生命周期。

### 2026-09-17 — MIG-002 进行中 / 更新、发行与平台边界选型

- 完成：核对 Tauri 官方 updater 文档、插件清单、官方 action、WebView2 先决条件；核对现有 Wails 更新逻辑、GitHub Release 资产命名、Windows 自启任务 XML、便携数据路径与当前系统只读状态；核对 sing-box 稳定版/预发布版 Windows 资产及 GitHub API digest。
- 结论：安装版更新采用签名 NSIS/MSI updater；portable ZIP 保留旧的 `WinBox-v<version>-windows-<arch>.zip` 和 `WinBox.exe` 过渡资产，不能把 plain binary 冒充 Tauri updater。旧 Wails 客户端只接收该兼容 ZIP；portable 自动替换需在 MIG-013 以前完成独立签名 helper/等价安全方案。当前数据模式继续使用 EXE 同级 `data/`，不静默回退到 AppData。
- 依赖候选：`tauri-plugin-updater 2.11.0`、`reqwest 0.13.5`、`tokio-tungstenite 0.30.0`、`zip 4.6.1`、`windows-sys 0.60.2`、`tauri-action action-v1.0.0`（commit `1deb371b0cd8bd54025b384f1cd735e725c4060f`）；未将尚未使用的依赖写入当前 Cargo.lock。
- 证据：`MIG-002P0-2026-09-17`，详见 [validation.md](validation.md)；决策和过渡契约已同步 [decisions.md](decisions.md)、[contracts.md](contracts.md)。
- 未完成/限制：没有生成 updater 签名、实际 Tauri bundle 或 portable helper；sing-box GitHub digest 只证明所取资产的完整性，不替代发布者签名；MIG-001 的 V02/Windows 行为基线仍未结项。ARM64 已排除。
- 下一步：完成 portable replacement/helper 与 Tauri installer 的最小构建演练前置设计，补 Windows manifest/WebView2/签名配置；在 P0 门槛满足前不切入 MIG-005 前端接入。

### 2026-09-17 — MIG-003 原型完成 / 待 Windows 实机复核

- 完成：嵌入 Tauri `requireAdministrator` manifest；新增 `WinBoxAutostart` 任务计划 XML 的创建/查询/删除薄适配，保留登录、30 秒延迟、最高可用权限和 `-minimized`；新增 Windows-only `tokio::process` 内核原型，固定 `core/sing-box.exe` 路径，停止前核对进程镜像并在 2 秒超时后按句柄强制结束，持续排空 stdout/stderr。
- 修改：`src-tauri/windows-app.manifest`、`src-tauri/build.rs`、`src-tauri/Cargo.toml`/`Cargo.lock`、`src-tauri/src/{lib,core}.rs`、`src-tauri/src/platform/{mod,windows}.rs`、本台账及 `contracts/decisions/validation`。
- 证据：`MIG-003-PROT-2026-09-17`；`cargo fmt -- --check`、`cargo test --lib --locked`（10/10）、`cargo clippy --all-targets --locked -- -D warnings`、`cargo build --locked`、`git diff --check` 均通过；只读 `schtasks` 查询确认当前 `WinBoxAutostart` 不存在。
- 限制：主 Tauri binary 已标记 `test=false`，因此非管理员 `cargo test --locked` 可运行库测试；这不替代管理员实机 UAC 运行检查。未创建/删除任务，未运行登录、自启、真实 sing-box 优雅退出/超时/崩溃恢复或其他进程并存检查；`CREATE_NO_WINDOW` 下 CTRL_BREAK 实机行为待验证；代理和前端仍未完成，ARM64 已排除。
- 下一步：在管理员隔离环境保存并恢复任务原状态，执行带空格路径的创建→查询→删除；使用真实 sing-box 或受控 fixture 验证优雅退出/超时强杀，再决定 MIG-003 是否转 `done` 并进入 MIG-004。

### 2026-09-17 — MIG-004 原型完成 / 待更新链实机复核

- 完成：新增 `updates` 最小模块，固定 x64 资产选择和旧 Wails portable 命名；使用 `sha2 0.10.9` 校验 `sha256:` digest；使用 `zip 4.6.1` 做受控 ZIP 路径、符号链接、条目数、压缩包/声明解压大小边界，只把精确 `sing-box.exe` 写入新暂存目录，不覆盖现有核心。
- 修改：`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/src/{lib,updates}.rs`、本台账及 `contracts/decisions/validation`。
- 证据：`MIG-004-PROT-2026-09-17`；格式、15 个库测试/0 个 doctest、clippy `-D warnings`、build 均通过；路径、digest、架构和旧资产 fixture 均有单元检查。
- 限制：未下载/执行真实 sing-box，未调用 `sing-box check`，未实现 HTTP、签名、Tauri updater、portable helper、替换/回滚或进程恢复；`MIG-004` 保持 `review`，不能宣称 V13/V14 或 P0 发布门槛完成。ARM64 已排除。
- 下一步：完成 MIG-003 管理员实机与真实 sing-box 复核；随后在 MIG-012/013 实现配置检查、事务替换/回滚、portable helper 与签名 updater，再做 V13/V14 测试发布链。

### 2026-09-17 — MIG-003/MIG-004 阶段验收关闭 / 进入 MIG-005

- 结论：MIG-003 和 MIG-004 的验收范围是 Windows/更新边界原型；对应原型证据、限制和验证记录齐全，状态改为 `done`。管理员实机、真实 sing-box、真实升级链和签名不被隐藏，继续由 V09/V11/V13/V14/V15 及 MIG-009/011–014 验收；ARM64 已排除。
- 下一步：MIG-005 先完成前端唯一 API 入口、初始化 DTO 和调用者迁移；适配文件的删除条件是 Rust command/event 全量通过 V04，不能把 Wails 生成目录变成长期后端。

### 2026-09-17 — MIG-005-a 完成 / 前端 API 边界原型

- 完成：新增 `frontend/src/api/backend.ts`，业务组件和 composables 不再直接引用 Wails 生成 API/runtime；初始化快照、流量和模式同步事件增加 TypeScript DTO；保留单一阶段兼容入口。
- 修改：前端 API 入口及 10 个调用者导入；同步 `contracts/decisions/validation`。
- 证据：`MIG-005A-2026-09-17`；`npx tsc --noEmit`、`npm run build` 通过，Vite 生成 73 个模块；未改变样式、视觉或交互路径。
- 限制：适配内部仍使用 Wails；Rust/Tauri command、事件生命周期、统一错误和实际 Tauri 运行尚未完成，不能标记 MIG-005 或 V04 完成。
- 下一步：在 MIG-005 中建立最小 Rust command/DTO 与 Tauri `invoke`/`listen` 接入，先迁移初始化快照和一条只读路径，再扩展写入/事件并保持唯一状态来源。

### 2026-09-18 — MIG-005 初始化只读 command 切片

- 完成：新增 `src-tauri/src/commands.rs`，注册 `get_init_data`；从 Rust storage 生成 camelCase `InitDataDto`，以 `AppError { code, message }` 返回加载失败；active profile 无匹配时返回 `null`。
- 完成：`frontend/src/api/backend.ts` 在 Tauri 运行时通过 `@tauri-apps/api@2.11.1` 调用 `invoke`，并将 `listen`/卸载包装在同一适配边界；旧 Wails 只保留非 Tauri fallback。同步更新前端 camelCase 字段调用者和 package lock。
- 修改：`src-tauri/src/{commands,lib}.rs`、`frontend/src/api/backend.ts`、`frontend/src/composables/useAppState.ts`、`frontend/package.json`、`frontend/package-lock.json`，及 `contracts/decisions/validation`。
- 证据：`MIG-005-IPC-2026-09-18`；Rust `cargo fmt --check`、`cargo test --locked --offline`（17/17 + doctest 0）、`cargo clippy --all-targets --locked --offline -- -D warnings`、`cargo build --locked --offline`、前端 `npx tsc --noEmit`、`npm run build`、`git diff --check` 均通过。
- 限制：尚未运行 Tauri WebView/UAC；Rust 未发送状态/流量/日志事件；`running=false` 和已有核心 `localVersion=Unknown` 是当前 command 切片的明确限制，不能标记 V04 或 MIG-005 完成。`frontend/.npm-cache` 等临时缓存已清理。
- 下一步：迁移一个低风险只读 command（建议 `get_product_version` 或日志读取）并补真实 Tauri `invoke` 错误检查；随后实现统一运行快照事件与生命周期协调，避免继续扩散双后端。

### 2026-09-18 — MIG-005 版本只读 command 切片

- 完成：新增并注册 `get_product_version`，直接返回 Tauri `AppHandle` 的 package version；前端 `getProductVersion()` 在 Tauri 使用 `invoke`，旧 Wails 仅保留非 Tauri fallback。
- 完成：`useProgramUpdate` 改为异步加载版本并在检查更新前等待，移除 `@wails` Vite alias 与 `vite-env.d.ts` 版本声明；未改变更新页面的视觉或操作路径。
- 修改：`src-tauri/src/{commands,lib}.rs`、`frontend/src/api/backend.ts`、`frontend/src/composables/useProgramUpdate.ts`、`frontend/vite.config.ts`、`frontend/src/vite-env.d.ts`，及 `contracts/decisions/validation`。
- 证据：`MIG-005-VERSION-2026-09-18`；Rust fmt、17/17 测试、clippy、build，前端 TypeScript/Vite build，Wails 版本引用扫描和 `git diff --check` 通过。
- 限制：未启动 Tauri WebView，未实测 `AppHandle` 返回值与更新检查真实链；Rust 状态/流量/日志事件与其他 command 仍未迁移。MIG-005 保持 `in_progress`。
- 下一步：迁移一个带受控输入的只读 command（建议日志读取或 override 读取），同步统一错误映射后再进入运行快照事件/生命周期。

### 2026-09-18 — MIG-005 override 只读 command 切片

- 完成：新增并注册 `get_override`、`get_default_override`；只接受 `tun`/`mixed`，复用 Rust storage 与默认配置；非法名称在读盘前返回稳定脱敏 `AppError`。
- 完成：`frontend/src/api/backend.ts` 增加 `getOverride`/`getDefaultOverride`；`useKernelUpdate` 的打开、切换和重置后刷新改用适配层，Tauri 读取失败会显示错误且不覆盖现有编辑内容。
- 修改：`src-tauri/src/{commands,lib}.rs`、`frontend/src/api/backend.ts`、`frontend/src/composables/useKernelUpdate.ts`，及本台账与关联 contracts/decisions/validation 文档。
- 证据：`MIG-005-OVERRIDE-2026-09-18`；Rust 20/20 测试、fmt、clippy、build，前端 TypeScript/Vite build，`git diff --check` 通过。
- 限制：未启动 Tauri WebView；真实编辑器写入、状态/流量/日志事件与生命周期仍未迁移；V04/MIG-005 保持进行中。
- 下一步：补真实 Tauri WebView 的读写与错误交互检查，再进入统一运行快照事件与生命周期协调。

### 2026-09-18 — MIG-005 override 写入 command 切片

- 完成：新增并注册 `save_override`、`reset_override`；复用 `Storage::save_override` 的 JSON 校验和原子写入，默认值复用同一 command 常量；非法类型、无效 JSON、写入失败均返回稳定脱敏错误。
- 完成：`backend.ts` 增加 `saveOverride`/`resetOverride`，将旧 Wails 字符串结果转换为异常；`useKernelUpdate` 的保存和重置改用适配层并显示 reject。
- 修改：`src-tauri/src/{commands,lib}.rs`、`frontend/src/api/backend.ts`、`frontend/src/composables/useKernelUpdate.ts`，及本台账与关联 contracts/decisions/validation 文档。
- 证据：`MIG-005-OVERRIDE-WRITE-2026-09-18`；Rust 21/21 测试、fmt、clippy、build，前端 TypeScript/Vite build，旧 command 调用扫描和 `git diff --check` 通过。
- 限制：未启动 Tauri WebView，未实测真实文件写入界面、失败恢复和权限拒绝；事件发送/生命周期与其他 command 仍未迁移。
- 下一步：在 Tauri WebView 中验证 override 读写/失败提示，然后迁移统一运行快照事件与生命周期协调。

### 2026-09-18 — MIG-014/MIG-016 x64 发行构建与自动化收口

- 完成：安装 `cargo-tauri 2.11.4`，修正 Tauri hook 的 `../frontend` 相对路径；主 Cargo binary 固定为 `WinBox.exe` 并设置 `default-run`，helper 保持 `winbox-updater.exe`；删除重复显式 resource，保留 Tauri 自动收集两个 binary；CI action 固定到已登记 commit，并删除重复 helper 预构建步骤。
- 完成：远程 Release changelog 的原始 HTML 改为转义文本；portable ZIP 生成 `WinBox.exe` 与 `WinBox-updater.exe`，安装 bundle 识别相邻小写 helper。
- 完成：读取并校验官方 sing-box `v1.14.1` x64 ZIP，实际 digest/version/最小配置 `check` 通过；未启动核心或修改系统网络状态。
- 证据：`MIG-014-BUNDLE-2026-09-18`；最终 `cargo tauri build --bundles nsis,msi` 通过，NSIS/MSI、portable ZIP、MSI 管理员提取、helper 无效参数安全路径通过；Rust 19/19、fmt、clippy、两 binary release build、前端 tsc/Vite build、旧栈扫描和 `git diff --check` 通过。
- 产物：`src-tauri/target/release/bundle/nsis/WinBox_2.8.0_x64-setup.exe`、`src-tauri/target/release/bundle/msi/WinBox_2.8.0_x64_en-US.msi`、`src-tauri/target/release/bundle/portable/WinBox-v2.8.0-windows-amd64.zip`；哈希和 MSI 提取证据见 validation。
- 限制：本环境的 Computer Use 接口只有浏览器能力，不能读取真实 Tauri WebView/托盘截图；由于启动最终管理员 binary 会清理代理并可能启动内核，自动化 shell 的完整进程启动请求被安全策略拒绝。尚未执行 UAC、窗口/Mica/托盘、多 DPI、任务计划登录、真实 sing-box/代理/UWP、签名和完整安装/升级链；review/not_run 不改为 done。ARM64 已排除。
- 下一步：用户在当前 Windows 桌面手动启动最终 `WinBox.exe` 或 NSIS/MSI，按 V02/V03/V07/V09/V11/V12/V14/V15 验收并回填截图/系统状态；之后才可关闭 MIG-006/011–017 的外部验收项。

### 2026-09-18 — MIG-018 x64 范围修订与最终自动回归

- 完成：按用户确认将本版支持范围固定为 Windows AMD64/x64；`TargetArchitecture` 只接受 `x86_64`，ARM64 不构建、不发布、不作为 tracker/validation 阻塞或最终验收条件；CI matrix 只保留 `x86_64-pc-windows-msvc`；根 README、迁移 README、contracts/decisions/plan/tracker/validation 已同步。
- 完成：流式下载在网络、写入、超限、flush 或 rename 失败时清理 `.part-*`；前端全局 composable 按最后一个使用者清理事件、媒体监听和定时器，所有 App 级事件保存独立卸载函数；删除无调用的 `EventsOff`。
- 完成：移除启动时无条件清空系统代理；WinBox 启动 mixed 代理时记录启动前/接管后的状态，停止或崩溃时仅在当前状态仍属于本次接管时恢复，检测到其他程序改动则不覆盖。
- 证据：`MIG-018-FINAL-2026-09-18`；Rust fmt、20/20 tests、clippy、helper release build、前端 TypeScript/Vite build、`cargo tauri build --bundles nsis,msi` 均通过；Tauri 输出 `Target: x64`；portable ZIP 条目为 `WinBox/WinBox.exe`、`WinBox/WinBox-updater.exe`。
- 当前 x64 产物：NSIS `13DB920454093DA0B7AFD6AFDAF86EB701C3F16246744390234FA23FB35A4A5A`；MSI `F6E6B153ACAFC9C27395827B81185C25DDBDBAC1C89D9940325D6FFD483E11C3`；portable `5799CF89B8C27E5CE95F520D20B8F539C836D1096D7E195E9F784249A685472A`；主程序 `D88A2D8E1503CC0EBF48D452E251B8F6D7D8A69993D4380C24C45E8025E801A6`；helper `9874DFB6D7A715756CAE93444EC704B6F0385C54963836C47773953E8CEA11E9`。
- 限制：自动化未启动真实 Tauri WebView，未执行 UAC、托盘/Mica/DPI、真实 sing-box 启停/崩溃、代理/UWP/任务计划、签名和干净安装升级；这些仍是 x64 人工验收项，不伪标 `done`。ARM64 已排除。
- 下一步：用户手动执行 V02/V03/V07/V09/V11/V12/V14/V15，保存截图和系统状态；若无签名授权，不发布 Release。

### 2026-09-18 — MIG-019 停止失败路径修复

- 完成：停止 sing-box 前不再从 `RuntimeState` 提前移除进程；句柄路径校验、优雅退出或强制结束成功后才清除归属。停止失败时保留句柄，切换/重启/配置选择不会继续启动第二个内核，并恢复失败前的模式或配置选择；代理恢复对缺失注册表值保持幂等。
- 修改：`src-tauri/src/commands.rs`、`src-tauri/src/platform/windows.rs`、`docs/tauri-migration/contracts.md`、`docs/tauri-migration/validation.md`。
- 证据：Rust `cargo fmt --check`、`cargo test --locked --offline`（20/20）、`cargo clippy --all-targets --locked --offline -- -D warnings`、前端 `npm --prefix frontend run build`（TypeScript/Vite，76 个模块）通过；当前 x64 NSIS/MSI bundle 及 portable ZIP 已重新核对。
- 当前 x64 产物 SHA-256：主程序 `425A0298D470C21EE1858F37650B79EF7B4E02740326CBF66E2644BCF06898A6`；helper `871CC7B0F19569E2943669751215599C010A41CAF2A444C5A3B0F44E27BFCC47`；NSIS `B8B011A2F9605C3F23E538E425766575A5DCF3F14A8EFEC01E9FDB2907AA6BC5`；MSI `560A413498F6C563BD92EE3CBEB69DDEFC96247B1B5D09295379665F5AA64A7F`；portable `318E493D73440643A9B6CB387A9C32322FEE984FFF1F426F6380DA1FB6C021B4`。MSI 验证日志返回安装成功状态 0。
- 限制：真实管理员 Tauri WebView、进程停止超时/崩溃和系统代理接管仍需 x64 Windows 实机；受限环境的 sing-box 代理接管试验无法写入 HKCU 注册表，因此不记为代理实机通过。ARM64 不在本版范围。
- 下一步：在 x64 桌面执行 V02/V03/V07/V09/V11/V12/V14/V15，并保留失败注入与系统状态恢复证据。

### 2026-09-18 — MIG-020 生命周期边界硬化

- 完成：核心 stdout/stderr 输出通道关闭后，监视器禁用已关闭的接收分支，继续按固定间隔检查进程，不进入空转；停止前的镜像归属校验只做一次，归属查询失败不强杀，只有已确认归属且 CTRL_BREAK 失败或超时才强制结束。
- 修改：`src-tauri/src/core.rs`、`src-tauri/src/platform/windows.rs`、`src-tauri/src/runtime.rs`、`docs/tauri-migration/contracts.md`、`docs/tauri-migration/validation.md`。
- 证据：`cargo fmt`、`cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`（20/20，0 doctest）、`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings` 均通过。
- 限制：真实 sing-box 隐藏控制台优雅退出、停止超时和其他同名进程并存仍需 x64 Windows 实机；ARM64 不在本版范围。
- 下一步：将该边界与 V07/V09 的实机失败注入一起验收，不把自动检查替代桌面证据。

### 2026-09-18 — MIG-020 x64 最终 bundle 刷新

- 完成：使用 MIG-020 生命周期修复后的 Rust 源码重新执行 `cargo tauri build --bundles nsis,msi`；Tauri 输出 `Target: x64`，前端 Vite 转换 76 个模块，NSIS/MSI 均成功生成；portable ZIP 由当前主程序/helper 重新打包。
- 产物 SHA-256：主程序 `8125E22F0585EB35FA3B34676A02545EBF51C1A18C2058B3EE3F9E13680C70AC`；helper `01396A35357AD336AA5B6A6EBA3F6EE82010032DBEBEEECF5574F3BFCF15B34E`；NSIS `336157B69E9FDC6FB7A5A474AAFDF3E13AADAD4F499B57D74F8F83CC02B0E060`；MSI `6DAF02B36D592FB33E9311EE76AEC7D78D2CDFB606B348AF0B20F53CFB5D003F`；portable `D9F51D3D9BA2A9DB58FFBEBCBADD1E46F3DB579CB60F3DFB0AE3FE0FA0C08067`。
- 证据：主程序/helper PE `Machine=0x8664`；portable 条目为 `WinBox/WinBox.exe`（17,590,784 bytes）和 `WinBox/WinBox-updater.exe`（1,775,104 bytes）；当前 MSI 管理员提取及 `MainEngineThread is returning 0`/安装成功状态 0 通过。
- 限制：未签名、未发布；真实桌面 WebView/UAC、sing-box 生命周期和系统状态仍需 x64 人工验收，ARM64 不在本版范围。

### 2026-09-18 — MIG-021 初始化事件顺序与最终 x64 bundle

- 完成：前端 `App` 和 `useAppState` 在读取初始化快照前先注册事件；`backend.ts` 等待所有 Tauri listener 注册完成，避免启动期事件被 `get_init_data` 的旧快照覆盖；组件卸载逐项释放订阅。
- 修改：`frontend/src/api/backend.ts`、`frontend/src/App.vue`、`frontend/src/composables/useAppState.ts`、`docs/tauri-migration/contracts.md`、`docs/tauri-migration/validation.md`。
- 证据：`npm --prefix frontend run build` 通过（TypeScript/Vite，76 个模块）；`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --manifest-path src-tauri/Cargo.toml --locked --offline`（20/20，0 doctest）、`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked --offline -- -D warnings` 均通过；`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi` 退出码 0，Tauri 输出 `Target: x64`。
- 产物：主程序 `WinBox.exe` 17,591,296 bytes，PE `Machine=0x8664`，SHA-256 `980029FFD0033B08F8B90F84F40F24CD0D597EB97F4CCE8859FE9ED6EDC4986F`；helper `winbox-updater.exe` 1,773,568 bytes，PE `Machine=0x8664`，SHA-256 `60D4605FF5AB5E3A64B3B799C62634BCA3F12292248946217D8E4375A3067E2D`；NSIS `F4B7A376ABDDF166878CA792BD39685B619A4A9BD21FAE27B26A78970FF08D9B`；MSI `722F641263831324168CFD28D0F2B5D56D5C3E6E74C060C24CCF309D6D250D45`；portable `63FEA0BF55FF831E711597535BA14D7A0880D90F9AC685C9FE10CBEA67E59818`。
- 产物边界：portable ZIP 严格只有 `WinBox/WinBox.exe`（17,591,296 bytes）和 `WinBox/WinBox-updater.exe`（1,773,568 bytes）；MSI `/a /qn` 管理员提取退出码 0，日志含 `Product: WinBox -- Installation completed successfully` 与 `MainEngineThread is returning 0`，提取目录含主程序和 helper。
- 限制：产物未签名、未发布；真实 Tauri WebView、UAC、窗口/Mica/DPI、托盘、sing-box 生命周期、系统代理/UWP/任务计划和干净安装升级仍需 x64 人工/发布环境验收；ARM64 不构建、不发布、不验收。
- 下一步：仅剩在 Windows AMD64/x64 桌面执行真实 WebView、UAC、托盘/窗口、sing-box/代理/UWP/任务计划和安装升级验收；未完成这些外部验收前不将 `review` 项改为 `done`，也不发布 Release。

### 2026-09-18 — MIG-022 x64 桌面验收环境复核

- 操作：使用 Computer Use 查询当前 Windows 可用桌面对象；返回原生应用列表为空，仅有 Codex in-app browser，未启动或操控任何终端/系统设置/第三方页面。
- 结果：当前会话没有可绑定的原生 Tauri/WebView 窗口，因此 V02/V03/V07/V09/V11/V12/V14/V15 的真实桌面检查不能在本环境执行；没有把浏览器或静态构建结果当作实机证据。
- 影响：`review` 项保持原状态；这不是 ARM64 范围问题，也不是代码构建阻塞。需要用户在 Windows AMD64/x64 桌面手动启动最终产物并保存截图、UAC/系统状态和失败恢复证据。

### 2026-09-18 — MIG-023 CI 目标 Rust 自动验证

- 操作：在 `dev` 工作区以 `--target x86_64-pc-windows-msvc --locked --offline` 并行执行 `cargo test` 与 `cargo clippy --all-targets -- -D warnings`；`rustc -vV` 的 host 同为 `x86_64-pc-windows-msvc`。
- 结果：Rust 20/20 库测试、0 doctest 和 clippy 均退出码 0；没有新增架构或依赖路径。该证据补充精确 CI target 的自动检查，不替代 Windows 桌面人工验收。

### 2026-09-18 — MIG-024 前端依赖安全与最终 x64 bundle

- 完成：将前端构建工具更新为 `vite 8.3.0`、`@vitejs/plugin-vue 6.0.9`；将直接 `postcss` 更新为 `8.5.28`，并用 npm `overrides` 固定 `browserslist 4.29.0`、`baseline-browser-mapping 2.11.25`。未改变业务依赖、Rust API 或 UI 源码。
- 证据：按 CI 原命令 `npm ci --prefix frontend` 退出码 0；完整 `npm audit --json` 为 0 vulnerabilities；`npm --prefix frontend run build` 通过，Vite `8.3.0` 转换 77 个模块；生产依赖审计和开发工具链审计均已清零。
- 证据：`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi` 退出码 0，Tauri 输出 `Target: x64`；当前主程序/helper PE 均为 `Machine=0x8664`；MSI `/a /qn` 管理员提取退出码 0，主程序和 helper 均存在。
- 当前最终 x64 产物：主程序 `WinBox.exe` 17,587,200 bytes，SHA-256 `70CBDDF5DC2301E0709D1C3E4C7919CC14043873E578B4D235CA23371E2DDC35`；helper `winbox-updater.exe` 1,773,568 bytes，SHA-256 `4AA72FC83D605C459F6B776DAA2EDC43DDF4AAFD6D7E89849AF3CA65B0ECB592`；NSIS `AD9121D00C72AED11BB5D0FC7B7C2B783170F00145A15E43F1346E0CCEA2F731`；MSI `5FDCA7E6C5A6FD9691337FA232D497FAD8CDE774863F69D5E5DC115D0B231AED`；portable `D1C3FA20296CDC9D4CEB399806050EE4EED57949374137AA801FF5EA0971FFC5`。
- portable ZIP 仅含 `WinBox/WinBox.exe`（17,587,200 bytes）和 `WinBox/WinBox-updater.exe`（1,773,568 bytes）；未签名、未发布。真实 Tauri WebView/UAC、sing-box/代理、安装升级和签名仍需 Windows AMD64/x64 人工/发布环境验收。

### 2026-09-18 — MIG-025 x64 架构硬门槛

- 完成：将 Windows manifest 的公共控件依赖从通配 `processorArchitecture="*"` 收紧为 `amd64`；Rust crate 增加编译期门槛，只允许 Windows `x86_64`（AMD64/x64）目标。
- 保持：更新模块仍只把 Rust `x86_64` 映射为 `windows-amd64`，CI matrix 仍只有 `x86_64-pc-windows-msvc`；ARM64 不构建、不发布、不验收。依赖锁文件中的跨平台包名不代表 WinBox 支持这些架构。
- 证据：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --target x86_64-pc-windows-msvc --locked --offline`（20/20，0 doctest）、`cargo clippy --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`、`npm --prefix frontend run build` 均通过；`cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis --no-sign` 通过，主程序/helper PE 均为 `Machine=0x8664`，portable ZIP 仅含两个 x64 入口，`git diff --check` 通过。
- 结果：非管理员受限会话首次运行 MSI 的 WiX `light.exe` ICE01–ICE32 无法访问 Installer Service（`LGHT0217/LGHT0216`），并且受限 `/a` 提取返回 1603（2502/2503）；随后在管理员 Windows x64 上重跑完整 `cargo tauri build --target x86_64-pc-windows-msvc --bundles nsis,msi --no-sign` 通过，MSI `/a /qn` 返回 0，日志含安装成功和 `MainEngineThread is returning 0`，主程序/helper 均提取存在。
- 当前 x64 产物 SHA-256：主程序 `0C0A0D0A05422F5AF9EBEBEF1E8FDD21F72A07D2ED6216423CF619BAAF2FD629`；helper `FF1965740133454F491CC6B2241E02071DEABFD863A328E7A9169F2166090142`；NSIS `B986895D90CF74BA1E664F7EF81DE9EF843C948D6464A39BA56C06116C6607AE`；MSI `DC72E17837F336CDBE273BCECB1F43EF6B0745F4A9637DAAC1E6877417C181E0`；portable `11CD3BD9EC73CF0E9378A4B38977A6FFE6D4166568148F5D5B8CCBB587DEC962`。
- 限制：当前会话仍没有可绑定的原生桌面窗口，真实 WebView/UAC/系统能力/安装升级和签名继续由 Windows AMD64/x64 人工或发布环境验收。

### 2026-09-18 — MIG-026 最终静态审计与桌面门槛复核

- 完成：验收矩阵 V01/V15/V18 改为引用最新 MIG-025；推荐命令全部显式指定 `x86_64-pc-windows-msvc`；Cargo locked metadata、迁移文档本地链接、`git diff --check` 通过。
- 完成：活动代码扫描未发现 `wailsjs`、`@wails`、`wails.json`、Go module 或 TODO/未实现占位；CI、manifest、Rust 编译门槛和更新资产仍只指向 AMD64/x64。
- 补充验证：管理员上下文运行最新 x64 `winbox-updater.exe --invalid` 返回码 0，未执行替换、启动主程序或修改应用数据。
- 复核：Computer Use 当前仍返回 `apps=[]`，只有 Codex in-app browser；未启动或操控真实 Tauri 窗口、系统代理、任务计划、UWP、安装器或发布环境。
- 结果：静态/文档审计 `pass`；V02/V03/V07/V09/V11/V12/V14/V15 的真实 Windows x64 部分继续保持 `review/not_run`，不能标记迁移最终完成。

### 2026-09-18 — MIG-027 3.0.0-alpha.1 单 EXE 测试构建

- 完成：将应用版本同步为 `3.0.0-alpha.1`，涉及 `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`frontend/package.json` 和 `frontend/package-lock.json`；历史 `2.8.0` 基线和旧发布资产测试样例保留不改。
- 清理：删除旧 NSIS/MSI/portable bundle、WiX/NSIS 缓存、MSI/portable 验证目录和旧 target 输出；保留 Cargo 依赖编译缓存及可能含运行数据的 `target/**/data`。
- 验证：`npm --prefix frontend run build`、`cargo build --manifest-path src-tauri/Cargo.toml --release --bin WinBox --target x86_64-pc-windows-msvc --features tauri/custom-protocol --locked --offline`、`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`（20/20，0 doctest）和 `git diff --check` 通过。
- 产物：仅生成 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，大小 17,556,480 bytes，文件/产品版本均为 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `F8E88DB28E58BD4C23A7667875A9F180B0C10CCE2B76E7589FBB5C9C97444662`；未生成 updater、NSIS、MSI 或 portable 成品。
- 限制：该构建用于 x64 手动测试，不等于真实 Windows WebView、托盘、UAC、sing-box、系统代理、安装升级或签名验收。

### 2026-09-19 — MIG-030 用户日志根因修复与 x64 单 EXE 刷新

- 根因：用户日志确认内核下载成功后在暂存阶段触发旧 64 MiB 解压内容上限；官方 `sing-box 1.14.1` x64 核心解压后约 81.9 MB，替换阶段尚未执行。流量图表日志确认自建 WebSocket `Request` 缺少标准 `Sec-WebSocket-Key`，所以服务端拒绝握手。
- 修复与清理：解压内容上限改为 128 MiB，并区分压缩包与解压内容超限；便携 ZIP 分支同步修正超限错误分类。删除手工 WebSocket 握手构造，改用 `IntoClientRequest`，仅保留 Bearer secret。阶段日志、暂存 `sing-box check`、loopback、超时/重连和原生替换回滚均保留，均有独立失败路径价值；未新增依赖或事件链。
- 修改：`src-tauri/src/updates.rs`、`src-tauri/src/runtime.rs`、`docs/tauri-migration/{contracts,decisions,tracker,validation}.md`。
- 证据：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、x64 target `cargo test --locked --offline`（23/23、0 doctest）、x64 target clippy `-D warnings`、`npm --prefix frontend run build`（Vite 8.3.0，77 模块）和 `git diff --check` 均通过。
- 产物：仅刷新 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,587,200 bytes，版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `F5F995482EEB1B4C83BD44CD6E45DC77A99C441A040D8FC45C20873AB149EDAB`；未生成 updater、安装器、portable ZIP 或其他成品。
- 限制：BUG-001/BUG-002 已由用户完成 x64 实机复测并关闭；当前会话仍无可绑定的原生 Tauri WebView，因此其他桌面验收项仍不能由自动化替代；ARM64 不构建、不发布、不验收。

### 2026-09-19 — MIG-032 窗口、主题与拖动修复

- 根因：前端最小化/隐藏/显示/聚焦/主题调用直接走 Tauri window API，但当前 capability 没有对应权限且错误被忽略；窗口配置没有 `center`；拖动属性只覆盖标题文字；固定 `Effect::Mica` 只跟随系统主题，不能表达应用浅色模式。
- 修复：前端窗口控制改为复用已有 Rust `minimize`、`minimize_to_tray`、`show` command；新增受控 `set_window_theme` command，统一设置 WebView `Theme` 与 `Mica`/`MicaLight`/`MicaDark`；启动读取保存的 `theme_mode`；增加 `center: true` 和最小拖动 capability；顶部左侧空白区扩展为拖动区，按钮区保持独立。未修改托盘组件、模式动态图标、菜单或用户交互路径。
- 修改：`src-tauri/capabilities/default.json`、`src-tauri/tauri.conf.json`、`src-tauri/src/{commands,lib}.rs`、`frontend/src/{App.vue,api/backend.ts,composables/useTheme.ts}`，以及关联契约/决策/验收记录。
- 证据：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、x64 target `cargo test --locked --offline`（24/24、0 doctest）、x64 target clippy `-D warnings`、`npm --prefix frontend run build`（Vite 8.3.0，74 模块）、JSON 配置解析和 `git diff --check` 均通过。
- 产物：仅刷新 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,588,736 bytes，版本 `3.0.0-alpha.1`，目标 `x86_64-pc-windows-msvc`，SHA-256 `A696D3B99A6AFA9D87B5A94EF0263ECCDECC5516B5E03BC1EF1DC5BED4BFFE1C`；未生成 updater、安装器、portable ZIP 或 ARM64 成品。
- 限制：Computer Use 当前只返回 Codex 浏览器、没有可绑定的原生 Tauri 窗口，无法在本会话执行真实居中/拖动/最小化/托盘/Mica/单实例回归；MIG-006 与 BUG-003 保持 `review`/`fixed-awaiting-retest`，等待 Windows AMD64/x64 测试 EXE 人工复测。

### 2026-09-19 — MIG-033 托盘应用重启竞态定位

- 范围：`BUG-004`、`MIG-009`、V03/V09；用户在连接状态下通过托盘 `Restart APP` 后发现 sing-box 内核残留。
- 根因：`src-tauri/src/lib.rs` 的 `restart-app` 菜单回调在 Tauri 主线程同步调用 `commands::restart`；`src-tauri/src/commands.rs` 当前使用 `AppHandle::restart()`。Tauri 2.11.5 源码与文档明确规定，主线程调用该方法会跳过 `RunEvent::ExitRequested`，直接执行 Tauri 自身 `cleanup_before_exit()` 并重启进程。项目的 `shutdown_runtime` 只在 `RunEvent::ExitRequested` 中调用，所以不会进入 `stop_core_impl`，也不会取消流量任务或恢复代理。
- 方案：采用 Tauri 官方 `AppHandle::request_restart()`，保留现有 `RunEvent::ExitRequested` → `shutdown_runtime` → `CoreProcess::stop` 清理链；`restart` command 继续返回 `Result<(), AppError>`，在请求后显式返回 `Ok(())`。不新增线程、插件或第二套进程清理逻辑。
- 本轮结果：仅完成源码与 Tauri 2.11.5 本地实现的只读确认，未修改业务代码、未构建产物；BUG-004 保持 `diagnosed-awaiting-fix`。修复后需用 Windows AMD64/x64 测试 EXE 在连接状态下确认旧核心 PID 退出、重启后只存在一个核心，并检查代理、流量和托盘状态。

### 2026-09-19 — MIG-034 托盘应用重启清理修复

- 修改：`src-tauri/src/commands.rs` 的 `restart` command 改用 `AppHandle::request_restart()`，并显式返回 `Ok(())`；未新增依赖、线程或重复清理路径。
- 结果：Tauri 重启请求现在经过 `RunEvent::ExitRequested`，由现有 `shutdown_runtime` 停止流量任务、停止并等待 sing-box、恢复代理后再由 Tauri 重启进程。
- 自动验证：fmt、x64 target Rust 测试（24/24、0 doctest）、x64 target clippy、前端构建和重启入口静态检查通过；x64 单 EXE 构建通过，版本 `3.0.0-alpha.1`，SHA-256 `1BCD3E1BD88C3EA84B48D1E503D7E0EA75DAFAD4DAA7FD34CCE7C9E1DF2C59BB`。
- 限制：本会话没有可绑定的原生 Tauri 窗口，尚未执行真实托盘重启、sing-box PID、代理和流量状态复测；BUG-004 为 `fixed-awaiting-retest`，ARM64 不构建、不发布、不验收。

### 2026-09-19 — MIG-035 托盘应用重启未重新拉起诊断

- 用户复测结果：使用当前 `request_restart()` 版本从托盘执行 `Restart APP` 时，sing-box 先退出，但 WinBox 没有自动重新出现。
- 已确认：上一阶段的清理修复有效；`RunEvent::ExitRequested` → `shutdown_runtime` → `stop_core_impl` 已经执行到足以退出 sing-box。失败点位于清理之后的 Tauri relaunch，不是内核停止逻辑。
- 代码证据：Tauri 2.11.5 的 `request_restart()` 在 `RunEvent::Exit` 后调用内部 `process::restart()`；该实现按 `current_exe` 和原始参数执行 `Command::spawn()`，失败只写 Tauri 内部日志，不返回当前 `AppError` 或 WinBox app.log。single-instance 插件在同一 `RunEvent::Exit` 阶段先释放 Windows mutex，因此单实例竞态尚未被证实。原始启动参数若含 `-minimized`，重启进程会启动后继续隐藏窗口。
- 修复成本评估：删除 Restart APP 为低成本，涉及托盘菜单、Rust command 注册/实现、未使用的前端 API 和关联契约/台账；保留并做到可靠拉起为中等成本，需要受控 relaunch/错误记录、参数策略、单实例/退出时序和 Windows x64 实机回归，可能涉及一个新的 Windows 启动边界，不能只靠自动编译证明。
- 处置结果：用户决定删除 Restart APP；实现与核心重启并发审计记录在 `MIG-036-CORE-RESTART-AUDIT-2026-09-19`，本条诊断结论由该任务收敛。

### 2026-09-19 — MIG-036 内核重启并发审计与清理

- 修改：删除托盘 `Restart APP`、Rust `restart` command 注册/实现和未使用的前端 `Restart` API；保留托盘与界面的 `Restart Core`。
- 并发修复：将 `restart_core_impl` 的运行状态检查移入 `RuntimeState.operation` 锁内；前端重启按钮在调用前设置 processing、忽略重复点击，并在失败结果返回时切换到错误状态；托盘入口继续复用同一锁内实现。
- 审计：启停、模式切换、profile 切换、内核更新、自动启动和统一退出均在同一操作锁内；核心监视器使用旧进程 `Arc` 身份清理，避免误清理新进程。未增加依赖、线程或第二套清理链。
- 验证：`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、x64 target Rust test（24/24、0 doctest）、x64 target clippy `-D warnings`、`npm --prefix frontend run build`（Vite 74 modules）均通过；x64 单 EXE 构建通过，产物 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,583,104 bytes，版本 `3.0.0-alpha.1`，PE `Machine=0x8664`，SHA-256 `8DB6C2AF5A454408A7A3C221406FA07A547D9E6A7C2476A3F48F79D197BBB0FD`；release 目录未生成 updater、bundle、NSIS、MSI 或 ARM64 产物。
- 限制：自动检查不能替代真实 Windows AMD64/x64 快速重复操作、代理恢复和 sing-box 单 PID 人工复测；ARM64 不构建、不发布、不验收。

### 2026-09-19 — MIG-037 核心重启生命周期复核

- 复核发现：旧核心监视器在身份清理后、未持有生命周期锁时停止 traffic；与重启建立新核心的时序交错，理论上可能停止新核心的 traffic task。
- 修复：监视器在 `clear_core_if` 和代理/traffic 清理前取得 `RuntimeState.operation`；重启/停止/更新完成并释放锁后，旧监视器会再次按 `Arc` 身份判断，发现当前已是新核心则不做清理。
- 修复：`start_core_impl` 在进程已创建但代理状态或输出初始化失败时显式停止未登记核心，再返回错误；避免把 `kill_on_drop` 当作正常清理策略。
- 修复：自动连接网络探测结束后重新读取快照并检查 `RuntimeState.core()`；若探测期间已有启动操作完成，则跳过自动启动，避免第二个核心。
- 验证：Rust x64 target 测试 24/24、clippy `-D warnings`、fmt、前端 TypeScript/Vite 构建均通过；静态检查确认仍仅有 `Restart Core` 入口。最新单 EXE 为 `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，PE `Machine=0x8664`，版本 `3.0.0-alpha.1`，17,589,248 bytes，SHA-256 `4B44D385A0CF956601A8ECE73E0255489D9CD62A448B20762CB1ED73C3F3DEB2`；未生成 ARM64 产物。
- 限制：当前会话没有可绑定的原生 Tauri 窗口，无法替代 Windows AMD64/x64 实机的快速点击、PID 唯一性、代理恢复和 traffic 重连验证。

### 2026-09-19 — MIG-038 配置下载 UA 与远程错误日志修复

- 审计：共享 `reqwest` 客户端被配置下载、内核/程序下载和 GitHub release 检查共同使用；迁移后 UA 为 `WinBox/2.8`，与旧 Go `sing-box` 客户端契约不一致。配置添加/更新和程序更新的失败早退也没有统一写入 `app.log`，下载非 2xx 状态被压成无状态的通用错误。
- 修复：共享客户端固定 `User-Agent: sing-box`；配置添加/更新、两个更新检查、内核更新元数据和程序更新失败统一经过 `RuntimeState` app log；HTTP 错误保留状态码。配置校验错误日志只记录 `configuration rejected`，不记录 URL、响应正文、订阅 Token 或配置内容。
- 修改：`src-tauri/src/commands.rs` 及 `docs/tauri-migration/{contracts,decisions,tracker,validation}.md`；不新增依赖、不改变前端 command 名称或视觉/交互。
- 验证：Rust x64 target 测试 25/25、clippy `-D warnings`、fmt、`npm --prefix frontend run build` 和本地 HTTP UA 实际请求头检查通过；x64 单 EXE `src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe` 构建通过，17,678,336 bytes，PE `Machine=0x8664`，版本 `3.0.0-alpha.1`，SHA-256 `84FD503F35BAB69DBB2F61BCF73250DB02D5812558726E068731A8D25B64A82B`。
- 限制：尚未使用用户真实配置下发地址进行 Windows WebView/远程服务复测；BUG-005 保持 `fixed-awaiting-retest`；ARM64 不构建、不发布、不验收。

### 2026-09-19 — MIG-039 时间与日志生命周期修复

- 根因：`RuntimeState.append_app_log` 和 `commands::current_time_string` 使用 Unix 秒数；Tauri setup 只创建 `RuntimeState`，没有执行旧 Go `Startup` 的 app/core 日志清理。旧版 10 MiB/5 归档轮转、启动/退出记录也未迁移。
- 修复：新增已锁定的跨平台 `chrono 0.4.45`，统一生成本地 `YYYY-MM-DD HH:mm:ss`/`YYYY-MM-DD HH:mm`；setup 在异步自动连接前清空 `data/app.log` 与 `data/core/box.log`，写入 `Application started`；统一退出写入 `Application shutdown`；恢复应用日志 10 MiB 轮转和 5 个归档。前端兼容 10/13 位 Unix 时间值及旧日期字符串，并等待日志监听注册后读取文件。
- 修改：`src-tauri/{Cargo.toml,Cargo.lock}`、`src-tauri/src/{runtime,commands,lib}.rs`、`frontend/src/{components/DashboardControl.vue,composables/useAppLogs.ts}`，以及关联 contracts/decisions/tracker/validation；未改变视觉、command 名称、手动清空入口或 x64-only 边界。
- 自动验证：x64 target Rust 测试 29/29、0 doctest，新增时间格式、会话日志清理和轮转检查；x64 target clippy `-D warnings`、fmt、`git diff --check`、前端 TypeScript/Vite 构建均通过。
- x64 单 EXE：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，17,747,968 bytes，PE `Machine=0x8664`，文件/产品版本 `3.0.0-alpha.1`，SHA-256 `DC412BE0E576B9133BB29CF5BB75054A6B146665929EC584110FF4D8807BD295`；未生成 updater、安装器、portable ZIP 或 ARM64 成品。
- 限制：本会话没有可绑定的原生 Tauri 窗口，尚未执行真实重启后的日志内容、配置更新时间和旧数据兼容桌面复测；Linux 不在本版构建/验收范围，仅通过跨平台库避免重复实现。

### 2026-09-19 — MIG-040 用户 Windows x64 复测通过

- 范围：`BUG-005`、`BUG-006`；复测配置更新的 `sing-box` UA、远程失败日志、时间格式、重启后的日志清理和配置更新时间显示。
- 用户验证：在 Windows AMD64/x64 测试 EXE 上确认配置更新成功；确认日志时间可读、配置更新时间显示正常，重启后日志按当前会话清理，问题修复结果符合预期。
- 结果：`BUG-005`、`BUG-006` 状态更新为 `resolved`；`MIG-008` 仍保持 `review`，其余订阅、日志压力和真实核心生命周期验收继续按 V06/V08/V13 执行。ARM64 不构建、不发布、不验收。

### 2026-09-19 — MIG-041 x64 portable 发布准备

- 完成：将 `.github/workflows/build-and-release.yml` 从 Tauri NSIS/MSI bundle 改为只构建 `x86_64-pc-windows-msvc` 的 `WinBox.exe` 与 `winbox-updater.exe`；PR 只上传 Action artifact，合并到 `main` 后才创建版本 Release。
- 产物契约：Release 上传裸 `WinBox.exe` 和 `WinBox-v<version>-windows-amd64.zip`；ZIP 内保留 `WinBox/WinBox.exe`、`WinBox/WinBox-updater.exe`，确保 `update_program` 能找到 helper。未设计或上传安装包，未使用本机测试 EXE 作为发布输入。
- 同步：`src-tauri/tauri.conf.json` 暂停 bundle，根 README、迁移 README、contracts、decisions 和 validation 均改为 portable-only 发布说明；版本保持 `3.0.0-alpha.1`，架构保持 AMD64/x64。
- 自动验证：更新资产/ZIP 安全暂存 6/6，helper 更新阶段 3/3；本机 x64 目标构建命令与前端构建待本轮完成，GitHub Action、Release 和跨版本应用内更新待用户将 PR 合并到 `main` 后验证。

### 2026-09-19 — MIG-042 最终发行收尾计划登记

- 用户将最终发行形式改为 Windows AMD64/x64 NSIS 安装版，并批准使用 Tauri 官方 updater；不再维护单 EXE、portable ZIP 或 MSI，不构建 ARM64/Linux。
- 用户确认现有预更新检查能力已经覆盖稳定/预发布选择，因此不新增独立 alpha channel；MIG-042 复用 `pre_release` 设置和同一版本检查策略。
- 数据契约：安装目录只保存程序文件；用户数据统一使用 Tauri `appLocalDataDir()`，Windows 典型位置为 `%LOCALAPPDATA%\com.leovikii.winbox\`。程序不自动扫描或迁移旧便携 `data/`，发行说明提供人工备份/复制步骤。
- 更新契约：删除自定义 `WinBox-updater.exe`、应用 ZIP 替换/回滚和程序更新 command；官方 updater 安装前复用统一退出清理，sing-box 核心更新保持独立。
- 发布契约：PR 到 `main` 只验证 x64 NSIS；合并 `main` 后 GitHub Actions 使用签名 secrets 发布 NSIS `*-setup.exe`、同名 `.sig` 和 `latest.json`。Tauri v2 Windows updater 直接使用签名安装器，不额外生成 `.nsis.zip`；本机产物只用于测试。
- 计划证据：`MIG-042-RELEASE-PLAN-2026-09-19`；本条只登记方案，不代表代码、签名、安装器或 Release 已执行。下一步按 [plan.md](plan.md) 的 P5.1 顺序实施。

### 2026-09-20 — MIG-042 兼容范围进一步收口

- 用户确认：如果旧单 EXE → NSIS 的自动兼容或旧数据迁移增加复杂度，则不实现；旧版更新日志中明确说明升级方式和手动数据处理步骤。
- 方案调整：删除自动发现、目录选择、数据复制、合并和回滚迁移需求；新版只保证新 `appLocalDataDir()` 数据根，用户自行备份旧 `data/` 后按文档复制。
- 影响：MIG-042 验收从“自动数据迁移”改为“人工说明准确、安装目录与数据目录分离、升级不删除新数据”；不新增迁移代码、依赖或首次启动 UI。

### 2026-09-20 — MIG-042 一键安装与目录精简计划登记

- 用户确认的体验目标：NSIS 默认安装到 `%ProgramFiles%\\WinBox\\`（通常为 `C:\\Program Files\\WinBox\\`），不让用户选择路径或组件，完成必要 UAC 后自动安装并启动；缺少 WebView2 时使用官方 bootstrapper。
- 安装目录白名单：主程序、Tauri/Windows 必需 loader/资源和 NSIS 卸载文件；禁止写入配置、订阅、核心、日志、`updates/` 或持久化 `backups/`。
- 数据目录白名单：现有 `config/`、按需生成的 `profiles/`、内核所需 `core/`、应用/内核日志和代理恢复状态；不改 JSON 布局，不删除功能所需文件。
- 临时文件策略：下载、原子写入、核心替换/回滚和 updater 暂存只在事务期间存在，并且只在成功或恢复完成后清理；恢复未完成时保留最小恢复材料，不为目录整洁牺牲功能；不新增迁移代码、数据库或长期临时目录。
- 验收：MIG-042 执行时补充 NSIS 安装后文件清单、默认路径/无选择页、自动启动、WebView2、数据目录隔离、升级保留数据和卸载保留数据的 Windows x64 证据。本条只登记计划，不代表实现完成。

### 2026-09-20 — MIG-042 预更新检查地址修复

- 根因：官方 updater 的预发布 metadata 使用 GitHub 网页仓库地址是正确的，但用于获取最新预发布 tag 的 `latest_release` 也误用了该网页地址，导致请求返回 HTML 而不是 Release API JSON。
- 修改：分离 `https://github.com/Leovikii/WinBox` 下载/metadata 地址与 `https://api.github.com/repos/Leovikii/WinBox` Release API 地址；稳定与预发布 metadata endpoint 增加回归检查，非法 tag 继续拒绝。
- 自动检查：x64 `cargo fmt -- --check`、`cargo check --locked --offline`、`cargo test --locked --offline`（29/29、0 doctest）、`cargo clippy --all-targets --locked --offline -- -D warnings`、`npm --prefix frontend run build`、unsigned 和 signed x64 NSIS 构建均通过；Tauri 输出 `Target: x64`，主程序 PE `Machine=0x8664`，版本 `3.0.0-alpha.1`。
- 当前 signed x64 测试产物：主程序 SHA-256 `BF22B132D366797D22361F1DDA3C39FA5CE97A1F26A07679FC95DDABBAEF79EF`（18,679,296 bytes）；安装器 SHA-256 `1632519412C7ED812BEA772484DAEEA96EE06964B405818FBB1FC29031693178`（4,583,698 bytes）；同名 `.sig` 428 bytes（SHA-256 `1D77A1F45D2C8E796CE8C52E48059FA92F939DCE1D290F0B73E12B52FE758CBD`）。产物只在本机用于测试，不作为 Release 输入。
- 结果/限制：代码与自动检查通过；MIG-042 仍保持 `review`，等待 Windows x64 真实安装、官方 updater 跨版本更新和 GitHub Actions/main Release 验收。ARM64/Linux 不构建、不发布、不验收。

### 2026-09-20 — MIG-042 应用更新无 metadata 与内核暂存校验修复

- 实测与只读远端核对：官方 updater 报 `Could not fetch a valid release JSON from the remote`。GitHub Release API 返回当前稳定 `v2.8.0`、预发布 `v2.8.0-rc.1` 等旧 Release；它们只有旧 portable ZIP，没有 `latest.json`。同时旧代码在预发布模式下直接取 Release 列表第一项，实际会把稳定 `v2.8.0` 当成预发布目标。
- 应用更新修复：Release 模式按已有 `pre_release` 设置取稳定或只取 `prerelease=true` 的最新项；先检查资产列表是否包含 `latest.json`。缺少官方 updater metadata 时，检查 command 返回当前应用版本（`useProgramUpdate` 的同版本分支显示 `Latest`，不进入 `FAILED`/error）；真正存在 metadata 时仍由 Tauri updater 负责 JSON、签名、下载和安装。手动更新入口在 metadata 缺失时返回 `update_not_available`。无需前端改动或新增 channel。
- 内核更新修复：`check_staged_core` 在没有活动 profile ID 时改为运行暂存 `sing-box.exe version` 并要求成功；已有 profile 仍执行完整 `sing-box check`，已选配置文件缺失或损坏继续拒绝替换。未改变核心独立更新和回滚链。
- 修改：`src-tauri/src/commands.rs`、本台账及 `docs/tauri-migration/{contracts,decisions,validation}.md`；无新依赖、无 UI 样式/交互改动。
- 自动验证：x64 Rust 测试 `32/32`、0 doctest；新增预发布筛选、legacy Release 无 metadata、无 profile/已选 profile 缺失行为测试。x64 clippy `-D warnings`、fmt、前端 TypeScript/Vite build、`git diff --check` 通过。
- 验收边界：当前旧 Release 无法验证 Tauri 跨版本签名安装；需合并 `main` 后由 workflow 发布带 `latest.json` 的新 NSIS Release，再在 Windows AMD64/x64 验证稳定/预发布通道、签名和安装前统一退出清理。内核无活动配置的真实更新仍需用户复测。ARM64/Linux 不构建、不发布、不验收。

### 2026-09-21 — MIG-043 / BUG-009 模式选择持久化修复

- 根因：UI 和托盘复用的 `apply_state(false, false)` 停止分支在核心停止后将持久化模式也写成 `false/false`；初始化随即把空模式默认成 Proxy。
- 同类路径审计：模式字段的其他写入只有显式模式选择。`toggle_service`、正常退出、核心重启、配置切换和内核更新均未清除模式；托盘 Stop 复用已修复的 `apply_state`。前端原先另有离线模式与默认 Proxy 的 fire-and-forget 保存，现等待结果，失败时回滚或显示现有错误状态。
- 修改：停止仅停止核心并同步原有选择，不再保存空模式；模式 JSON、Tauri command/DTO、界面样式和交互选项不变，无新增依赖。
- 自动验证：Windows x64 `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --locked --offline`（33/33、0 doctest）、`cargo clippy --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --all-targets --locked --offline -- -D warnings`、`npm --prefix frontend run build`、`git diff --check` 均通过。新增停止请求与模式选择区分的 Rust 回归测试。
- 本机 unsigned x64 测试产物：`src-tauri/target/x86_64-pc-windows-msvc/release/WinBox.exe`，18,771,456 bytes，版本 `3.0.0-alpha.1`，SHA-256 `8C2A10B86621F58B87C46B003366311854F71ACDE9D4641656794953947B7280`；安装器 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/WinBox_3.0.0-alpha.1_x64-setup.exe`，4,585,218 bytes，SHA-256 `5F98913B2A614A646C58B718F0F6A07394DA2472B469DDE8F97F659443DB17BD`。Tauri 输出 `Target: x64`；unsigned 包无 updater 签名，仅供本机人工测试，不作为 Release 输入。不构建 ARM64。
- 结果/限制：BUG-009 为 `fixed-awaiting-retest`；当前环境不能启动/操作原生 Tauri 窗口。已被旧路径清成 `false/false` 的记录无法恢复历史模式，复测应先重新选择目标模式，再在 Windows AMD64/x64 测试包上验证界面 Stop、托盘 Stop、退出后重启，以及 TUN/Mixed/Proxy 选择在停止和离线保存后的持久性。MIG-009/MIG-042 的其他实机验收保持原状态。
