# Wails → Tauri 后端迁移

批准日期：2026-09-16。后端迁移实现已完成，`3.0.0-alpha.1` 已发布；计划仍处于验收收尾，尚未整体关闭。唯一进度来源为 [tracker.md](tracker.md)。

## 当前入口

- [待补人工验收](validation.md#待补人工验收2026-09-21)：已合并重复场景；卸载和数据清理由用户确认通过。
- [前端迁移计划](../frontend-refactor/README.md)：alpha.2 已迁移到 React + Fluent UI；用户已确认 Windows x64 前端实机回归通过，待从 `dev` 创建 PR 到 `main` 触发签名发布，后端人工测试仍独立保留。
- 发布与 CI 证据：`MIG-045-RELEASE-AUDIT-2026-09-21`，见 [validation.md](validation.md)。已确认 main 签名构建成功，Release 包含 x64 NSIS、同名 `.sig` 与 `latest.json`。

首个 alpha 的发布不替代跨版本更新、系统状态恢复和桌面回归证据。剩余场景通过，或用户明确批准具体范围例外并登记后，才能关闭整体计划。

## 最终实现与边界

- Tauri 2 + Rust + React + Microsoft Fluent UI + 独立 sing-box；Go/Wails 活动代码和临时兼容桥已移除，旧实现从 Git 历史查阅。
- 本版仅 Windows AMD64/x64，只发行 NSIS。portable ZIP、单 EXE 发行、MSI 和 ARM64 不在范围；Linux 留到下个大版本。
- 安装目录为 `%ProgramFiles%\WinBox\`；用户数据唯一根为 `%LOCALAPPDATA%\com.leovikii.winbox\`（Tauri `appLocalDataDir()`）。配置、订阅、核心和日志不写入安装目录。
- 旧便携数据不自动扫描、复制或合并；人工备份/复制步骤见 [项目 README](../../README.md#installation)。
- 应用更新使用官方 `tauri-plugin-updater 2.11.0`，复用现有 `pre_release` 设置；sing-box 更新独立。安装前复用统一退出清理，不保留自定义应用 updater。
- 前端已接入唯一 Tauri API 边界；后续允许优化内部实现，保持既有样式、视觉效果和交互逻辑，实质变化另行确认。

## 文档分工

| 文档 | 用途 |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | 当前开发规则与批准边界 |
| [tracker.md](tracker.md) | 唯一任务状态、问题与交接 |
| [architecture.md](architecture.md) | 实际模块边界、数据与系统能力 |
| [contracts.md](contracts.md) | 当前契约与标记为历史的旧映射 |
| [plan.md](plan.md) | 已实施阶段及尚未满足的关闭门槛 |
| [decisions.md](decisions.md) | 最终决策、依赖、风险与延期 |
| [validation.md](validation.md) | 验收矩阵、待补人工测试与原始证据 |

历史记录保留用于追溯，不作为新的实施任务；早期 portable/MSI、EXE 同级 data、Wails 适配和自定义 updater 方案均已被最终 NSIS 决策替代。
