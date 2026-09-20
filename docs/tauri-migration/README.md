# Wails → Tauri 迁移开发文档

批准日期：2026-09-16。状态：迁移实现已完成，当前进入最终发行收尾；实际进度以 [tracker.md](tracker.md) 为准。基线提交：`3b5eef88a252206cf82db4752999a6e0054c0795`，当前应用版本 `3.0.0-alpha.1`。本组文档为后续 AI agent 的执行与交接依据。

## 用户要求与批准范围

1. 后端采用适度抽象、解耦的跨平台架构，本次只实现 Windows AMD64/x64；Linux 下个大版本引入，Windows ARM64 不在本版范围内。
2. 尽可能使用 Tauri 内置能力、官方插件和成熟 GitHub 组件，避免重复造轮子。
3. 前端**保持样式、视觉效果与交互逻辑**，允许依据新后端优化和简化实现。此前“前端暂时不改动”不再解释为源文件冻结。
4. 迁移到 Tauri 2 + Rust，保留独立 sing-box。迁移完成后移除 Go/Wails，不长期保留双后端。
5. 保持 Windows 既有功能和用户数据；本版最终发行形态为 Windows AMD64/x64 NSIS 安装包，不再维护单 EXE 绿色版、portable ZIP 或 MSI。
6. 应用更新使用 Tauri 官方 updater；现有预更新开关继续负责预发布版本选择，不新增独立更新通道。

本次批准首先用于落地完整开发文档，随后已进入实现阶段。文档中的早期 P0 记录保留为历史证据；当前代码状态以 `tracker.md` 最新交接记录和 `validation.md` 矩阵为准，编译通过不替代 Windows 实机/安装器验收。

## 阅读顺序与唯一来源

| 文档 | 负责内容 |
| --- | --- |
| [根 AGENTS.md](../../AGENTS.md) | 所有后续 agent 的工作规则 |
| [tracker.md](tracker.md) | 唯一任务进度、阻塞与交接台账 |
| [architecture.md](architecture.md) | 目标模块边界、前端、权限、数据和更新设计 |
| [contracts.md](contracts.md) | 已知旧契约、迁移映射及契约变更方法 |
| [plan.md](plan.md) | P0–P5 工作包、依赖、退出条件和回退策略 |
| [decisions.md](decisions.md) | 已批准决策、候选依赖、待定问题、风险与延期 |
| [validation.md](validation.md) | 验收场景、检查方式与执行证据 |

## 现状依据

- `src-tauri/src/lib.rs`、`commands.rs`、`runtime.rs`：Tauri 生命周期、command/event、托盘、状态编排、日志和更新；应用更新使用官方 updater，sing-box 更新保持独立。
- `src-tauri/src/core.rs`、`platform/windows.rs`：sing-box 启停、路径/进程归属、代理、任务计划和 UWP 边界。
- `src-tauri/src/storage.rs`、`paths.rs`、`models.rs`：使用 Tauri `appLocalDataDir()`、分文件 JSON、未知字段保留和原子写入；旧单 EXE 的同级 `data/` 不自动迁移。
- `src-tauri/src/startup.rs`：只保留启动参数解析；自定义应用 updater helper、替换和回滚代码已删除，sing-box 核心更新链继续保留。
- `frontend/src/`：Vue 3 与唯一 Tauri API 边界 `frontend/src/api/backend.ts`；保留原样式、视觉和交互路径。
- `.github/workflows/build-and-release.yml`、`src-tauri/tauri.conf.json`、`src-tauri/nsis/installer-hooks.nsh`：只构建 Windows AMD64/x64 NSIS；PR 构建 unsigned 安装器，`main` 构建签名 updater 资产。

上述迁移代码链路已完成自动化检查；真实桌面、权限、sing-box、NSIS 安装、GitHub Action 发布和 x64 应用内更新仍按 V02/V03/V09/V11/V13–V15、V19 验证矩阵登记。

## 最终发行收尾：MIG-042

其余迁移工作已完成，MIG-042 的代码与自动化发布准备已实施；以下外部验收仍是发布前收尾，不扩展产品范围：

1. 已将应用数据根从 EXE 同级 `data/` 收口到 Tauri `appLocalDataDir()`；Windows 典型位置为 `%LOCALAPPDATA%\com.leovikii.winbox\`。配置、订阅、override、核心、日志、备份和更新暂存均不得写入安装目录。
2. 不实现旧单 EXE 的自动升级和旧数据自动迁移。发行说明提供手动备份/复制步骤，由用户决定是否将旧便携 `data` 内容复制到新版数据目录；不扫描、不合并、不覆盖。
3. 已移除自定义 `WinBox-updater.exe`、应用 ZIP 替换/回滚；引入并锁定 `tauri-plugin-updater 2.11.0`，保留现有更新页面和 command 名称的薄 Rust 封装。
4. 官方 updater 下载并验证签名后，通过统一退出流程停止 sing-box、停止流量、恢复本应用代理状态，再启动 NSIS 安装器；内核更新仍由现有核心更新流程负责。
5. GitHub Actions 已固定只构建 `x86_64-pc-windows-msvc`：PR 到 `main` 只验证 unsigned NSIS，合并 `main` 后使用 secrets 签名并发布 NSIS `*-setup.exe`、同名 `.sig` 和 `latest.json`。Tauri v2 Windows updater 直接使用签名 NSIS 安装器，不生成额外 `.nsis.zip`。本机产物只用于测试。
6. 预更新开关复用现有 `pre_release` 设置和版本检查逻辑；不新增独立 alpha channel。官方 updater endpoint 和 Release metadata 必须让稳定/预发布选择遵守这一现有设置。
7. 完成自动检查、Windows x64 安装/升级/卸载、手动数据说明、签名拒绝、退出清理和 GitHub Action/Release 验收后，才能将 MIG-042 和整体迁移标记为 `done`。

### 安装体验与目录精简约束（已实施，待 Windows x64 验收）

以下是已落地的实现约束；本机已生成 unsigned x64 NSIS，签名 Release 和真实安装行为仍需外部验收：

- NSIS 采用单确认的一键安装体验：默认安装到 `%ProgramFiles%\WinBox\`（通常为 `C:\Program Files\WinBox\`），隐藏安装路径、组件和可选功能页面；保留必要的 UAC 确认，安装完成后自动启动 WinBox。
- 缺少 WebView2 时使用 Tauri 官方 bootstrapper 自动处理；不把体积很大的离线 WebView2 runtime 固定塞入安装包，离线且缺少 runtime 时给出明确失败提示。
- 安装目录只允许存在 `WinBox.exe`、Tauri/Windows 运行所需的 loader 或资源文件，以及 NSIS 生成的卸载文件。不得写入 `data/`、`core/`、配置、订阅、日志、`updates/` 或持久化 `backups/`。
- 用户数据唯一根仍为 `%LOCALAPPDATA%\com.leovikii.winbox\`。只保留现有功能需要的 `config/`、按需生成的 `profiles/`、内核运行所需的 `core/`、应用/内核日志和代理恢复状态文件；不为“以后可能使用”新增目录或数据库。
- 下载、原子写入和核心替换产生的临时归档、暂存和回滚文件只在事务期间存在，并且只在成功或恢复完成后清理；若恢复尚未完成，保留完成恢复所需的最小材料，不为目录整洁牺牲可恢复性。官方 updater 使用其临时目录，不建立长期 `updates/` 或 `backups/` 目录。
- 精简不包含合并或重命名现有 JSON、删除日志/内核/代理恢复状态、改变核心更新回滚语义等行为；只有确认没有功能用途的长期目录才可删除。
- 升级只替换安装目录文件，卸载默认保留用户数据；旧单 EXE 的 `data/` 仍不自动扫描、复制、合并或覆盖。

## 总体验收标准

- Windows 功能矩阵全部通过或有用户明确批准的范围例外；不存在未解决的发布阻断项。
- 前端视觉与交互基线通过，对通信与状态实现的简化不改变用户操作路径。
- 旧版本手动数据处理说明、失败恢复、进程清理、系统代理恢复、内核更新和 NSIS 应用更新有实际证据。
- 安装程序完成默认路径的一键安装且无路径/组件选择页，只替换程序文件；用户数据位于 `appLocalDataDir()` 并在升级/卸载策略中有明确记录。
- 安装目录文件清单和数据目录最小清单经过 Windows x64 实机检查，临时更新文件不会长期残留且不破坏核心更新、日志、代理恢复和配置功能。
- Windows 仅支持 AMD64/x64；x64 构建与实机结果分别记录。ARM64 明确排除在本版之外，不构建、不发布、不作为验收条件。
- Rust/前端构建检查通过，最终构建链不依赖 Go/Wails；依赖、契约和台账与代码一致。
- Linux 未在本版实现或验证，平台边界已清晰隔离。
