# 决策、依赖、风险与延期台账

记录设计依据，不重复任务进度。`accepted` 为用户批准原则；`candidate` 需技术验证；`open` 尚未决定。调整实现细节可在批准范围内自行记录，改变产品范围须取得确认。

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
| D01 | Tauri 2 内置窗口、托盘、事件、菜单 | [tauri](https://github.com/tauri-apps/tauri) | Mica、透明背景、缩放、权限、关闭行为；不另写桌面框架 |
| D02 | single-instance、opener、log | [官方 plugins-workspace](https://github.com/tauri-apps/plugins-workspace) | 管理员单实例、受控外链、日志格式/轮转/前端消费 |
| D03 | updater；必要时 process | [updater 文档](https://v2.tauri.app/plugin/updater/) | 签名元数据和产物；优先 Rust 端编排清理后安装/重启 |
| D04 | autostart 或任务计划薄适配 | [autostart 源码](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/autostart/src/lib.rs) | 已查公开 builder 提供 args/app_name 等，无现有最高权限和延迟任务配置；不得直接认为行为等价 |
| D05 | shell；不足时 tokio::process | [shell](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell)、[tokio](https://github.com/tokio-rs/tokio) | 动态下载二进制、隐藏窗口、优雅停止/回收；仅选最小有效路径 |
| D06 | reqwest | [reqwest](https://github.com/seanmonstar/reqwest) | Rust 后端 HTTP/下载；代理、TLS、超时、取消；无须同时安装前端 HTTP 插件 |
| D07 | tokio-tungstenite | [项目](https://github.com/snapview/tokio-tungstenite) | 流量 WebSocket；与既有异步运行时配合，不启动第二套 runtime |
| D08 | serde、serde_json、zip | [serde](https://github.com/serde-rs/serde)、[json](https://github.com/serde-rs/json)、[zip](https://github.com/zip-rs/zip2) | 标准序列化/解压；路径与大小边界、版本兼容、许可证核查 |
| D09 | windows-rs | [Microsoft 项目](https://github.com/microsoft/windows-rs) | Win32/注册表/系统能力，只启用需要的 API features |
| D10 | tauri-action | [官方 action](https://github.com/tauri-apps/tauri-action) | 构建、签名产物、两架构、受控发布 |

存储暂不采用数据库；store 插件仅在能简化且不破坏旧数据/原子写入要求时选用。fs、http、dialog 等插件无实际调用需求不安装。UUID、版本比较等新增需求优先检查已有依赖和标准能力，再决定成熟 crate，不手写通用算法。

2026-09-16 研究证据：已读取官方 v2 分支 autostart `src/lib.rs`、updater/shell `README.md`。这些链接为可变分支；P0 锁定版本后须记录对应 tag/commit。其余项目在此为候选，未声称已审计维护状态或许可证。

## 待决问题

| ID | 问题 | 建议方向/所需证据 | 解决任务 |
| --- | --- | --- | --- |
| Q01 | 便携自动更新与安装版组合 | 验证 updater 支持的实际 Windows 产物；保留便携体验，无法对等时提出具体方案供用户决定 | MIG-002/004 |
| Q02 | 旧 Wails 客户端过渡 | 对照旧 ZIP/文件名选择逻辑，确定兼容资产或桥接版本；不能默认旧版识别 updater 元数据 | MIG-004 |
| Q03 | Windows 支持范围与架构证据 | 确定最低 OS、WebView2 安装策略、Mica 降级、x64/ARM64 设备及目标 | MIG-001/002 |
| Q04 | 数据模式与路径发现 | 便携模式选择方式、安装版数据路径、同机多份旧目录优先级、权限不足处理 | MIG-004 |
| Q05 | 内核下载真实性校验 | 核查上游签名/checksum 可得性、可信来源和镜像影响；明确验证边界 | MIG-004 |
| Q06 | 新 DTO/事件与生成类型需求 | 手写薄类型是否足够；如采用代码生成，记录收益，避免引入完整框架 | MIG-005 |

Q01–Q05 未解决前不得将对应功能标为可发行。Q06 可在 P1 内完成，不要求用户逐项批准命名。

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
| R09 | 中：架构支持被夸大 | ARM64 仅编译未运行、资源匹配错误 | 分离构建与实机证据 V15 | MIG-014 |
| R10 | 中：迁移扩大为重写框架 | 平台抽象/双后端/前端状态系统膨胀 | ADR-001/003/008，审查依赖与临时桥清理 V17 | MIG-016 |

初始风险均为 open（待验证），并非已发生缺陷。关闭风险须补证据 ID 和日期；不能只写“已处理”。

## 延期与技术债

| ID | 内容 | 延期理由 | 重新评估条件 |
| --- | --- | --- | --- |
| DEFER-001 | Linux 具体实现与打包 | 用户明确下个大版本引入 | Linux 版本启动；复用平台边界 |
| DEFER-002 | 独立高权限服务/细粒度提权架构 | 本次保持现有权限体验，避免扩大迁移 | 新权限产品需求或确认的安全/体验问题 |
| DEFER-003 | UI 重设计 | 用户要求保持视觉及交互 | 用户明确提出新设计 |

临时兼容桥、为赶进度削减的真实能力、未满足的验收项不得放进上述延期表而直接结项；需独立任务、到期条件和明确范围批准。

## 决策更新模板

ID / 日期 / accepted、candidate 或 superseded；问题与约束；选定方案；未选方案及具体理由；影响的契约/任务/验收；证据；若改变用户范围则附批准依据。保留被替代决策的摘要，避免后续 agent 重复争论。
