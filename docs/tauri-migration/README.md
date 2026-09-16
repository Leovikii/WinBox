# Wails → Tauri 迁移开发文档

批准日期：2026-09-16。状态：方案已批准，实施尚未开始。基线提交：`3b5eef88a252206cf82db4752999a6e0054c0795`，应用版本 `2.8.0`。本组文档为后续 AI agent 的执行与交接依据。

## 用户要求与批准范围

1. 后端采用适度抽象、解耦的跨平台架构，本次只实现 Windows；Linux 下个大版本引入。
2. 尽可能使用 Tauri 内置能力、官方插件和成熟 GitHub 组件，避免重复造轮子。
3. 前端**保持样式、视觉效果与交互逻辑**，允许依据新后端优化和简化实现。此前“前端暂时不改动”不再解释为源文件冻结。
4. 迁移到 Tauri 2 + Rust，保留独立 sing-box。迁移完成后移除 Go/Wails，不长期保留双后端。
5. 保持 Windows 既有功能、便携使用和用户数据；关键兼容问题先验证，再扩大实施。

本次批准首先用于落地完整开发文档。文档初始化不等于任何实现或实机测试已经完成；后续接到实施任务的 agent 从 P0 开始。

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

- `main.go`：400×720 初始窗口、无边框、Mica、主题、单实例、启动参数。
- `internal/app*.go`：生命周期、IPC、托盘、状态编排、日志、更新；框架与业务仍耦合。
- `internal/core_manager.go`：sing-box 启停、配置生成、日志、Windows 进程检查。
- `internal/settings_manager.go`、`platform_windows.go`、`uwp_loopback.go`：最高权限计划任务、注册表/Win32、UWP。
- `internal/storage.go`：EXE 同级 `data/`，分文件 JSON，延迟写入。
- `frontend/src/`：Vue 3、Wails imports、`@wails` 版本信息、Wails 拖动样式标记。
- `.github/workflows/`：Wails 构建，当前发布 `windows-amd64.zip`；不得据此声称已有 ARM64 实机验证。

上述为源码观察，不是运行验证。契约盘点和行为基线仍需 P0 补充执行证据。

## 总体验收标准

- Windows 功能矩阵全部通过或有用户明确批准的范围例外；不存在未解决的发布阻断项。
- 前端视觉与交互基线通过，对通信与状态实现的简化不改变用户操作路径。
- 旧数据导入、失败恢复、进程清理、系统代理恢复、内核更新和程序更新有实际证据。
- x64/ARM64 分别标明构建与实机结果；未验证目标不宣称已支持。
- Rust/前端构建检查通过，最终构建链不依赖 Go/Wails；依赖、契约和台账与代码一致。
- Linux 未在本版实现或验证，平台边界已清晰隔离。
