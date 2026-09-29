# 3.0.0-beta.1 更新修复与验证

日期：2026-09-29。当前工作基于 dev。按用户要求将版本拼写从 bata 改为 beta，已删除 GitHub 预发布 v3.0.0-bata.1（release ID 398864435）和远端/本地同名 tag。此次仅交付 dev；维护者手动 PR 到 main，原工作流负责签名发布，不自行创建新 Release。

## 修复结果

| 问题 | 根因与修复 |
| --- | --- |
| 管理员更新提前降权，TUN 代理丢失 | 原 update_program 在下载前交接，交接会停止内核、恢复代理。现在管理员实例先通过官方 updater 下载并验签，再通过现有受认证交接传递版本、签名和最多512MiB的包；接收方就绪后才停止原内核。普通实例通过内存回环源再次交给官方 updater 验签、安装，无须再次访问 GitHub |
| 更新下载中退出冻结 | ExitRequested 在 UI 线程 block_on shutdown，而下载持有同一 operation 锁。现在退出通知下载取消，异步获取锁并停内核/恢复代理，清理结束才真正退出；重复 Quit 只启动一次清理。应用元数据/下载及内核下载可取消，内核替换/恢复阶段不强行中断 |
| 更新交接后重启参数 | 官方 updater 默认重放当前进程参数。交接安装禁用此重放，由既有 NSIS 模板正常自动启动，避免携带失效的 --handoff 令牌 |
| 本轮新增测试触发 TaskDialogIndirect 弹窗 | 官方 updater mock 测试令测试 EXE 引用了 Windows 对话框代码。tauri-build 原先仅给 bin 链接资源，现在 updater 集成测试目标也链接既有 Windows manifest，包含 Common Controls v6；修复后完整测试成功运行 |

保留普通权限安装、NSIS、内置签名公钥、同账户/会话/进程身份校验及现有 closeBehavior（tray/quit/ask）。交接失败不回退管理员安装。无新增生产依赖，测试只启用已有 Tauri 的 test feature。

官方 updater 没有公开离线 Update 构造接口，所以普通接收实例使用仅绑定127.0.0.1、随机令牌路径、两次请求、60秒上限的内存 HTTP 源。只有已通过认证的更新交接接收实例在内存配置中允许 HTTP endpoint；正常启动仍要求 HTTPS，签名公钥不变。本地请求禁用系统代理，源随作用域结束/取消关闭，无任意文件、命令或可执行路径接口。二进制交接不经 JSON，不落盘暂存。

## 本轮验证

| 检查 | 结果 |
| --- | --- |
| Rust 常规测试 | 56项单元测试及1项官方 updater 集成测试通过，0失败；2个需真实内核/UWP环境的专项未执行 |
| 新增回归 | 退出取消长期等待并释放操作锁、重复退出/迟到取消订阅；交接包长度/截断/序列化边界；回环元数据与包一致、错误路径及关闭；实际官方 updater 读取本地包并拒绝错误签名 |
| 前端生产构建与 Node 逻辑检查 | 通过；保留既有大于500kB的 bundle 提示 |
| Clippy / rustfmt | all-targets Clippy（-D warnings）及 rustfmt通过 |
| Windows x64 未签名 NSIS | 构建通过；本机测试包不得作为正式发布资产 |
| UI 真实渲染 | 本轮未改布局/控件，仅更新交接 DTO，未重跑浏览器视觉矩阵 |

新增官方 updater 测试首次因测试 EXE manifest 缺失而未能运行；修复后的57项结果才计为通过。测试不启动安装器、不使用用户配置、不改变系统代理。

## 实机验收与限制

用户已使用最新源码 a3e3173、仅将版本覆盖为3.0.0-alpha.1的测试 EXE 实测，确认更新功能正常，检查更新报错问题已解决。远端 beta.1 更新元数据和安装包返回HTTP 200，签名资产与元数据一致；原报错未在最新源码复现，按旧 alpha 客户端问题关闭，未进一步证实旧版的具体网络失败根因。

上一轮启动白屏和自动连接检查 UI 也已获用户确认。上述总体更新确认不等于下列专项均逐项执行；发布时按改动范围复验：

1. 管理员 TUN/mixed 依赖代理联网，确认下载/验签完成前不降权、不停内核；交接后无外网也可安装并普通权限重启。
2. 慢下载时右上角关闭并选择 Quit、直接 Quit、托盘 Quit，确认窗口不冻结、下载取消、内核退出并恢复属于 WinBox 的代理；tray 模式关闭只隐藏并继续下载。
3. 交接失败、包截断、错误签名、普通权限安装失败、安装后重启、数据保留及失败重试。
4. Windows 原生窗口/托盘、跨账户拒绝、WebView2缺失、异常断电等发布矩阵按开发指南执行。

回归测试中的错误签名拒绝不等于真实签名安装成功；异步退出与锁取消测试不等于已经观察到原生窗口退出。未签名 NSIS 构建也不证明官方 updater 能安装它。不得将未执行矩阵标为通过。

本轮用户验收测试程序：%TEMP%/winbox-update-check/WinBox.exe（源码a3e3173，版本覆盖3.0.0-alpha.1）。target目录的同名EXE也已被低版本构建覆盖；原beta.1 EXE备份为%TEMP%/winbox-update-check/WinBox-beta.1-original.exe。
本机未签名安装包：src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/WinBox_3.0.0-beta.1_x64-setup.exe。

安装包 SHA-256：E590949725BD4E96ADC1BE6EF3660A2540EF0F6AB7E83DC56A9B0EA6A645C882。该安装包构建时的EXE ProductVersion/FileVersion为3.0.0-beta.1，PE Machine为0x8664；低版本测试未重建此安装包。
