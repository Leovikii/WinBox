# Wails → Tauri 迁移开发文档

批准日期：2026-09-16。状态：方案已批准，实施已进入 P0；实际进度以 [tracker.md](tracker.md) 为准。基线提交：`3b5eef88a252206cf82db4752999a6e0054c0795`，应用版本 `2.8.0`。本组文档为后续 AI agent 的执行与交接依据。

## 用户要求与批准范围

1. 后端采用适度抽象、解耦的跨平台架构，本次只实现 Windows AMD64/x64；Linux 下个大版本引入，Windows ARM64 不在本版范围内。
2. 尽可能使用 Tauri 内置能力、官方插件和成熟 GitHub 组件，避免重复造轮子。
3. 前端**保持样式、视觉效果与交互逻辑**，允许依据新后端优化和简化实现。此前“前端暂时不改动”不再解释为源文件冻结。
4. 迁移到 Tauri 2 + Rust，保留独立 sing-box。迁移完成后移除 Go/Wails，不长期保留双后端。
5. 保持 Windows 既有功能、便携使用和用户数据；关键兼容问题先验证，再扩大实施。

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

- `src-tauri/src/lib.rs`、`commands.rs`、`runtime.rs`：Tauri 生命周期、command/event、托盘、状态编排、日志和更新。
- `src-tauri/src/core.rs`、`platform/windows.rs`：sing-box 启停、路径/进程归属、代理、任务计划和 UWP 边界。
- `src-tauri/src/storage.rs`、`paths.rs`、`models.rs`：EXE 同级 `data/`、分文件 JSON、未知字段保留和原子写入。
- `src-tauri/src/startup.rs`、`updater.rs`：portable 独立更新 helper 和失败恢复。
- `frontend/src/`：Vue 3 与唯一 Tauri API 边界 `frontend/src/api/backend.ts`；保留原样式、视觉和交互路径。
- `.github/workflows/build-and-release.yml`、`src-tauri/tauri.conf.json`：Tauri bundle 自动收集主程序和 helper，CI 另打包 x64 portable ZIP；签名和 x64 实机仍需独立证据。

上述代码链路已完成自动化检查；真实桌面、权限、sing-box、安装器和 x64 行为仍按 V02/V03/V09/V11/V13–V15 验证矩阵登记。

## 总体验收标准

- Windows 功能矩阵全部通过或有用户明确批准的范围例外；不存在未解决的发布阻断项。
- 前端视觉与交互基线通过，对通信与状态实现的简化不改变用户操作路径。
- 旧数据导入、失败恢复、进程清理、系统代理恢复、内核更新和程序更新有实际证据。
- Windows 仅支持 AMD64/x64；x64 构建与实机结果分别记录。ARM64 明确排除在本版之外，不构建、不发布、不作为验收条件。
- Rust/前端构建检查通过，最终构建链不依赖 Go/Wails；依赖、契约和台账与代码一致。
- Linux 未在本版实现或验证，平台边界已清晰隔离。
